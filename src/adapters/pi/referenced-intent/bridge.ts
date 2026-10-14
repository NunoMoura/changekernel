import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { canonical, FRAME_LIMIT, parseJson, type Json } from "./codec.ts";
import { checked, Incoming, ordered, type IncomingValue } from "./schema.ts";

export class TransportFailure extends Error {
  readonly reason: "timeout" | "cancelled" | "closed" | "protocol" | "cleanup_unconfirmed";
  constructor(reason: TransportFailure["reason"]) { super(reason); this.reason = reason; }
}
// Survives extension reload in this process. Never adopt or reuse another runtime's child.
const registryKey = Symbol.for("changekernel.referenced-intent.live-owner");
const registry = globalThis as typeof globalThis & { [registryKey]?: Set<object> };
const owners = registry[registryKey] ??= new Set<object>();
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class Bridge {
  private child?: ChildProcessWithoutNullStreams;
  private pending?: { id: number; resolve: (v: IncomingValue) => void; reject: (e: TransportFailure) => void };
  private header = Buffer.alloc(4);
  private headerAt = 0;
  private payload?: Buffer;
  private payloadAt = 0;
  private nextId = 1;
  private usable = false;
  private closing = false;
  private ended = false;
  private cleanup?: Promise<boolean>;
  private stderr = Buffer.alloc(0);
  stderrDropped = 0;
  private exitResolve!: () => void;
  private exited = new Promise<void>(resolve => { this.exitResolve = resolve; });
  get pid(): number | undefined { return this.child?.pid; }
  get exitObserved(): boolean { return this.ended; }
  get isUsable(): boolean { return this.usable && !this.closing; }

  start(executable: string): void {
    if (this.child || this.closing || owners.size) throw new TransportFailure("cleanup_unconfirmed");
    owners.add(this);
    try {
      this.child = spawn(executable, ["--referenced-intent-bridge"], {
        shell: false, stdio: ["pipe", "pipe", "pipe"], env: {}, windowsHide: true,
      });
    } catch {
      owners.delete(this); this.ended = true; this.exitResolve();
      throw new TransportFailure("closed");
    }
    this.usable = true;
    this.child.stdout.on("data", (data: Buffer) => this.receive(data));
    this.child.stderr.on("data", (data: Buffer) => {
      const size = this.stderr.length + data.length;
      this.stderrDropped += Math.max(0, size - 65_536);
      this.stderr = data.length >= 65_536 ? Buffer.from(data.subarray(-65_536)) : Buffer.concat([this.stderr.subarray(Math.max(0, size - 65_536)), data]);
    });
    this.child.stdin.on("error", () => this.fail("closed"));
    this.child.stdout.on("error", () => this.fail("closed"));
    this.child.stderr.on("error", () => this.fail("closed"));
    this.child.on("error", () => this.fail("closed"));
    this.child.on("exit", () => this.fail("closed"));
    this.child.on("close", () => {
      this.fail("closed"); this.ended = true; owners.delete(this); this.exitResolve();
    });
  }
  private fail(reason: TransportFailure["reason"]): void {
    this.usable = false;
    this.payload = undefined; this.payloadAt = 0; this.headerAt = 0;
    const pending = this.pending; this.pending = undefined;
    pending?.reject(new TransportFailure(reason));
    // EOF asks native to leave at its next safe point; never infer rollback or exit.
    this.child?.stdin.end();
  }
  invalidate(): void { this.fail("protocol"); }
  private receive(data: Buffer): void {
    if (!this.usable) return;
    try {
      let at = 0;
      while (at < data.length) {
        if (!this.pending) throw new Error("unsolicited frame");
        if (!this.payload) {
          const n = Math.min(4 - this.headerAt, data.length - at);
          data.copy(this.header, this.headerAt, at, at + n); this.headerAt += n; at += n;
          if (this.headerAt < 4) continue;
          const length = this.header.readUInt32BE();
          if (length < 1 || length > FRAME_LIMIT) throw new Error("length");
          this.payload = Buffer.alloc(length); this.payloadAt = 0;
        }
        const n = Math.min(this.payload.length - this.payloadAt, data.length - at);
        data.copy(this.payload, this.payloadAt, at, at + n); this.payloadAt += n; at += n;
        if (this.payloadAt !== this.payload.length) continue;
        const raw = this.payload;
        const value = checked(Incoming, parseJson(raw));
        if (value.id !== this.pending.id || canonical(ordered(Incoming, value)) + "\n" !== new TextDecoder("utf-8", { fatal: true }).decode(raw)) throw new Error("identity/canonical");
        // A second frame in the same chunk cannot be a reply to an undispatched request.
        if (at !== data.length) throw new Error("extra frame");
        const pending = this.pending; this.pending = undefined;
        this.payload = undefined; this.payloadAt = 0; this.headerAt = 0;
        pending.resolve(value);
      }
    } catch { this.fail("protocol"); }
  }
  async exchange(body: Record<string, Json>, signal?: AbortSignal, timeout = 30_000, shutdown = false): Promise<IncomingValue> {
    if (signal?.aborted) throw new TransportFailure("cancelled");
    if (!this.usable || (this.closing && !shutdown) || !this.child) throw new TransportFailure("closed");
    if (this.pending || this.nextId > 1_000_000) throw new TransportFailure("protocol");
    const id = this.nextId;
    const bytes = Buffer.from(canonical({ bridge: "ck-intent-bridge", id, ...body }) + "\n");
    if (bytes.length > FRAME_LIMIT) throw new TransportFailure("protocol");
    const header = Buffer.alloc(4); header.writeUInt32BE(bytes.length);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => this.fail("cancelled");
    try {
      return await new Promise<IncomingValue>((resolve, reject) => {
        this.pending = { id, resolve, reject };
        signal?.addEventListener("abort", abort, { once: true });
        timer = setTimeout(() => this.fail("timeout"), timeout);
        this.nextId++;
        this.child!.stdin.write(Buffer.concat([header, bytes]), error => { if (error) this.fail("closed"); });
      });
    } finally {
      clearTimeout(timer); signal?.removeEventListener("abort", abort);
    }
  }
  disconnect(): Promise<boolean> {
    if (this.cleanup) return this.cleanup;
    this.closing = true;
    this.cleanup = this.finish();
    return this.cleanup;
  }
  private async waitForExit(ms: number): Promise<void> {
    if (this.ended || ms <= 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([this.exited, new Promise<void>(resolve => { timer = setTimeout(resolve, ms); })]); }
    finally { clearTimeout(timer); }
  }
  private async finish(): Promise<boolean> {
    if (!this.child) return true;
    if (this.pending) {
      const deadline = performance.now() + 2000;
      while (this.pending && !this.ended && performance.now() < deadline) await wait(20);
    }
    const closeStarted = performance.now();
    if (this.usable && !this.pending && !this.ended) {
      try {
        const reply = await this.exchange({ kind: "close" }, undefined, 2000, true);
        if (reply.kind !== "closed") this.fail("protocol");
      } catch { /* absence of Closed never proves descriptor release */ }
    }
    this.fail("closed");
    await this.waitForExit(2000 - (performance.now() - closeStarted));
    for (const signal of ["SIGTERM", "SIGKILL"] as const) {
      if (this.ended) return true;
      try { this.child.kill(signal); } catch { /* still await observed close */ }
      await this.waitForExit(2000);
    }
    return this.ended;
  }
}
