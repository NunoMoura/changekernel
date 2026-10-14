import { createHash } from "node:crypto";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, ScrollView, SelectList, Text, matchesKey, isKeyRelease, isKeyRepeat, visibleWidth, type Component, type TUI } from "@earendil-works/pi-tui";
import { canonical, parseJson, VERSION, type Json } from "./codec.ts";
import { checked, Fact, Mutation, ordered, type MutationValue } from "./schema.ts";

export const POLICY_TEXT = '{"format":"ck-plan-policy","owner":"person-1","ledger":"ledger-1","change":"change-1","coverage":"closed-personal-plan","actions":["open_intent","revise_intent"],"approval":"local-tui-exact","domain_requirements":[],"relationships":[],"external_effects":false}\n';
export const digest = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
export const policyRef = { custody: "custody-1", sha256: digest(POLICY_TEXT), bytes: Buffer.byteLength(POLICY_TEXT), text: "utf8-exact" } as const;
function object(v: Json): Record<string, Json> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("object");
  return v;
}
function keys(v: Record<string, Json>, expected: string[]): void {
  if (Object.keys(v).join(",") !== expected.join(",")) throw new Error("review fields");
}
export function validatePresentation(presentation: string, input: MutationValue): void {
  const bytes = Buffer.from(presentation);
  const p = object(parseJson(bytes, 65_536));
  keys(p, ["format", "input", "policy_text", "previous", "instruction_text", "what_text", "why_text"]);
  if (p.format !== "ck-intent-review" || p.policy_text !== POLICY_TEXT || canonical(p) + "\n" !== presentation) throw new Error("presentation");
  if (canonical(ordered(Mutation, checked(Mutation, p.input))) !== canonical(ordered(Mutation, input))) throw new Error("input changed");
  for (const [ref, text] of [[input.instruction, p.instruction_text], [input.replacement.what, p.what_text], [input.replacement.why, p.why_text]] as const) {
    if (ref === null) { if (text !== null) throw new Error("null Why"); }
    else if (typeof text !== "string" || Buffer.byteLength(text) !== ref.bytes || digest(text) !== ref.sha256 || ref.bytes > 4096) throw new Error("source bytes");
  }
  if (typeof p.instruction_text !== "string" || !p.instruction_text.length || typeof p.what_text !== "string" || !/[^ \t\r\n]/u.test(p.what_text)) throw new Error("source role");
  if (input.op === "open_intent") {
    if (p.previous !== null) throw new Error("previous");
  } else {
    const prev = object(p.previous!); keys(prev, ["fact", "what_text", "why_text"]);
    if (canonical(prev.fact!) !== canonical(ordered(Fact, input.expected)) || typeof prev.what_text !== "string" || (prev.why_text !== null && typeof prev.why_text !== "string")) throw new Error("previous");
  }
}

/** One byte per token. Layout markers are outside the data columns. */
export function byteLines(bytes: Uint8Array, width: number): string[] {
  if (width < 8) throw new Error("width");
  const lines: string[] = [];
  let line = "";
  for (const b of bytes) {
    const token = b === 34 || b === 92 ? `\\${String.fromCharCode(b)}` : b >= 32 && b <= 126 ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2, "0")}`;
    if (line.length + token.length > width - 4) { lines.push(`| ${line} +`); line = ""; }
    line += token;
  }
  lines.push(`| ${line} .`);
  return lines;
}

/** Uses Pi layout/input/scroll state, not a terminal renderer. Only the viewport is sliced. */
export class ReviewScreen implements Component {
  private readonly scroll: ScrollView;
  private readonly selection: SelectList;
  private lines: string[] = [];
  private width = 0;
  private rows = 0;
  private pageHeight = 0;
  private renderedEnd = 0;
  private covered = 0;
  private deciding = false;
  private selectionRendered = false;
  private finished = false;
  private timer: ReturnType<typeof setTimeout>;
  private readonly cancel = () => this.finish(false);
  private readonly tui: Pick<TUI, "terminal" | "requestRender">;
  private readonly presentation: string;
  private readonly input: MutationValue;
  private readonly done: (accepted: boolean) => void;
  private readonly signal?: AbortSignal;
  constructor(tui: Pick<TUI, "terminal" | "requestRender">, presentation: string, input: MutationValue, done: (accepted: boolean) => void, signal?: AbortSignal) {
    this.tui = tui; this.presentation = presentation; this.input = input; this.done = done; this.signal = signal;
    this.scroll = new ScrollView({ render: () => this.lines, invalidate() {} }, { follow: "none", scrollbar: "hidden", overscroll: "contain" });
    const plain = (s: string) => s;
    this.selection = new SelectList([{ value: "cancel", label: "Cancel" }, { value: "adopt", label: "Adopt this exact subject" }], 2, { selectedPrefix: plain, selectedText: plain, description: plain, scrollInfo: plain, noMatch: plain });
    this.selection.onSelect = item => this.finish(item.value === "adopt" && this.deciding && this.selectionRendered && this.covered === this.lines.length);
    this.selection.onCancel = this.cancel;
    this.timer = setTimeout(this.cancel, 120_000);
    signal?.addEventListener("abort", this.cancel, { once: true });
  }
  private finish(accepted: boolean): void {
    if (this.finished) return;
    this.finished = true; clearTimeout(this.timer); this.signal?.removeEventListener("abort", this.cancel);
    this.done(accepted && !this.signal?.aborted);
  }
  dispose(): void { this.finish(false); }
  invalidate(): void { this.scroll.invalidate(); this.selection.invalidate(); }
  render(width: number): string[] {
    try {
      const rows = this.tui.terminal.rows;
      if (this.finished || this.signal?.aborted) { this.finish(false); return []; }
      if (!Number.isInteger(width) || width < 40 || width > 1000 || !Number.isInteger(rows) || rows < 12 || rows > 1000) throw new Error("unsupported layout");
      // Resizing cancels rather than retaining coverage for a different layout.
      if (this.width && (this.width !== width || this.rows !== rows)) throw new Error("resized");
      if (!this.width) {
        this.width = width; this.rows = rows; this.pageHeight = rows - 5;
        const info = new Text([
          `ChangeKernel ${VERSION}: exact adoption`,
          "Encoding: printable ASCII; quote/backslash escaped; other UTF-8 bytes \\xhh.",
          "Data rows: '| ' prefix; ' +' continuation / ' .' end outside data.",
          `Material: custody-1 / ${digest(this.presentation)}`,
          `Bytes: ${Buffer.byteLength(this.presentation)}; text: utf8-exact`,
          `Target: ledger-1/change-1; key: ${this.input.key}`,
          `Expected: ${this.input.op === "revise_intent" ? this.input.expected.seq : "unopened"}`,
          `Replacement Why: ${this.input.replacement.why === null ? "null (absent)" : this.input.replacement.why.bytes === 0 ? "empty text (not null)" : "text"}`,
          "Below: entire input, full fixed policy, previous, instruction, replacement What/Why.",
          "Previous is null for opening. Every Why: null is absent; empty text is present.",
          "Traversal is not proof of comprehension.",
          "AUTHORITATIVE EXACT PRESENTATION BYTES:",
        ].join("\n"), 0, 0);
        this.lines = [...info.render(width), ...byteLines(Buffer.from(this.presentation), width)];
      }
      this.scroll.updateLayout(this.lines.length, this.pageHeight, () => this.tui.requestRender());
      const start = this.scroll.scrollTop;
      const page = this.scroll.render(width).slice(start, start + this.pageHeight);
      const layout = new Container();
      layout.addChild({ render: () => page, invalidate() {} });
      if (this.deciding) {
        layout.addChild(this.selection);
        this.selectionRendered = true;
      } else {
        layout.addChild(new Text(`Rows ${start + 1}-${start + page.length}/${this.lines.length}\nSpace/Right: next; Left: previous; Esc: cancel`, 0, 0));
      }
      const result = layout.render(width);
      if (result.length > rows || result.some(line => visibleWidth(line) > width)) throw new Error("layout overflow");
      this.renderedEnd = start + page.length;
      return result;
    } catch { this.finish(false); return []; }
  }
  handleInput(data: string): void {
    try {
      if (this.finished || isKeyRelease(data) || isKeyRepeat(data)) return;
      if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || this.signal?.aborted) { this.finish(false); return; }
      if (this.width !== this.tui.terminal.columns || this.rows !== this.tui.terminal.rows) { this.finish(false); return; }
      if (this.deciding) { if (this.selectionRendered) this.selection.handleInput(data); return; }
      if (matchesKey(data, "space") || matchesKey(data, "right")) {
        if (this.scroll.scrollTop > this.covered || this.renderedEnd <= this.scroll.scrollTop) return;
        this.covered = Math.max(this.covered, this.renderedEnd);
        if (this.covered === this.lines.length) this.deciding = true;
        else this.scroll.scrollBy(this.pageHeight);
        this.renderedEnd = 0;
      } else if (matchesKey(data, "left")) { this.scroll.scrollBy(-this.pageHeight); this.renderedEnd = 0; }
      this.tui.requestRender();
    } catch { this.finish(false); }
  }
}

export async function review(ctx: ExtensionContext, input: MutationValue, presentation: string, signal?: AbortSignal): Promise<boolean> {
  if (ctx.mode !== "tui" || !process.stdin.isTTY || !process.stdout.isTTY || signal?.aborted) return false;
  try {
    validatePresentation(presentation, input);
    return await ctx.ui.custom<boolean>((tui, _theme, _keys, done) => new ReviewScreen(tui, presentation, input, done, signal), { overlay: true, overlayOptions: { width: "100%", anchor: "top-left" } }) === true;
  } catch { return false; }
}
