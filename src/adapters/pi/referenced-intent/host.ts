import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { performance } from "node:perf_hooks";
import { Bridge, TransportFailure } from "./bridge.ts";
import { CompositionBudget, CompositionLimit } from "./composition.ts";
import { canonical, FRAME_LIMIT, type Json } from "./codec.ts";
import { checked, Configuration, Lease, Material, Mutation, ordered, outputs, requests, valid, validReadiness, failure, unknown, type ConfigurationValue, type IncomingValue, type LeaseValue, type MutationValue, type Op, type ResponseValue } from "./schema.ts";
import { digest, policyRef, review, validatePresentation } from "./review.ts";

export class IntentHost {
  private bridge?: Bridge;
  private config?: ConfigurationValue;
  private lease?: LeaseValue;
  private pendingLease?: LeaseValue;
  private leased = false;
  private busy = false;
  private connected = false;
  private stopping = false;
  private active?: AbortController;
  private cleanup?: Promise<boolean>;
  get childPid(): number | undefined { return this.bridge?.pid; }
  get exitObserved(): boolean { return this.bridge?.exitObserved ?? true; }
  setAuthorization(value: unknown): void {
    const lease = checked(Lease, value);
    if (this.leased) this.pendingLease = lease;
    else this.lease = lease;
  }
  private disclosure(): ResponseValue | undefined {
    if (this.lease?.disclose === "deny") return failure("denied");
    if (this.lease?.disclose !== "allow") return failure("unavailable");
    return undefined;
  }
  private async wire(body: Record<string, Json>, signal?: AbortSignal, timeout = 30_000): Promise<IncomingValue> {
    if (this.leased || !this.bridge) throw new TransportFailure("closed");
    this.leased = true;
    try {
      const result = await this.bridge.exchange(body.kind === "discard" ? body : { ...body, authorization: this.lease as Json }, signal, timeout);
      return result;
    } finally {
      this.leased = false;
      if (this.pendingLease) { this.lease = this.pendingLease; this.pendingLease = undefined; }
    }
  }
  async connect(value: unknown): Promise<ResponseValue | undefined> {
    if (this.busy || this.bridge && !this.bridge.exitObserved) return unknown("cleanup_unconfirmed");
    let config: ConfigurationValue;
    try {
      config = checked(Configuration, value);
      for (const path of [config.executable, config.grant.directory, config.grant.anchor]) {
        if (Buffer.byteLength(path) > 4096 || path.split("/").some(c => c === "." || c === "..")) throw new Error("path");
      }
      if (canonical(ordered(Material, config.grant.policy)) !== canonical(policyRef)) throw new Error("fixed policy");
    } catch { return failure("invalid_input"); }
    this.config = config; this.lease = config.authorization;
    const denied = this.disclosure(); if (denied) return denied;
    this.busy = true; this.stopping = false; this.cleanup = undefined; this.connected = false;
    this.bridge = new Bridge();
    try {
      this.bridge.start(config.executable);
      const reply = await this.wire({ kind: "connect", mode: config.mode, grant: config.grant as Json }, undefined, 10_000);
      if (reply.kind !== "connected") {
        if (reply.kind === "reply" && reply.value.kind === "error") return this.disclosure() ?? reply.value;
        throw new TransportFailure("protocol");
      }
      this.connected = true;
      return this.disclosure();
    } catch (e) {
      this.bridge.invalidate();
      return this.disclosure() ?? unknown(e instanceof TransportFailure ? e.reason : "protocol");
    } finally {
      this.busy = false;
      // Failed startup is not an implicit reconnect. Explicit disconnect must confirm exit.
    }
  }
  async execute(op: Op, value: unknown, ctx: ExtensionContext, signal?: AbortSignal, budget = new CompositionBudget()): Promise<ResponseValue> {
    const denied = this.disclosure(); if (denied) return denied;
    if (this.busy || this.stopping || !this.bridge?.isUsable || !this.config || !this.connected) return failure("unavailable");
    if (signal?.aborted) return unknown("cancelled");
    let request;
    try {
      request = checked(requests[op], value);
      const encoded = ordered(requests[op], request);
      const preflight = { bridge: "ck-intent-bridge", id: 1_000_000, kind: "prepare", authorization: this.lease as Json, request: encoded };
      if (Buffer.byteLength(canonical(preflight)) + 1 > FRAME_LIMIT) return failure("unsupported");
      if (request.op === "retain_text" && Buffer.byteLength(request.text) > 65_536) return failure("unsupported");
    } catch { return failure("invalid_input"); }
    this.busy = true;
    const controller = new AbortController(); this.active = controller;
    const abort = () => controller.abort(); signal?.addEventListener("abort", abort, { once: true });
    let prepared = false;
    const call = async (body: Record<string, Json>, cancellation: AbortSignal | undefined = signal) => {
      if (this.stopping) throw new TransportFailure("closed");
      const timeout = budget.begin();
      const start = performance.now();
      let returnedBytes = 0;
      try {
        const r = await this.wire(body, cancellation, timeout);
        returnedBytes = Buffer.byteLength(canonical(r as Json)) + 1;
        return r;
      } finally { budget.finish(performance.now() - start, returnedBytes); }
    };
    try {
      const mutation = op === "open_intent" || op === "revise_intent";
      // Outside TUI, Call still allows exact accepted retries without approval or mutation authority.
      const prepare = mutation && ctx.mode === "tui";
      budget.preflight(prepare ? 2 : 1);
      let reply = await call({ kind: prepare ? "prepare" : "call", request: ordered(requests[op], request) });
      if (reply.kind === "prepared") {
        prepared = true;
        if (!prepare) throw new TransportFailure("protocol");
        const input = checked(Mutation, request) as MutationValue;
        if (canonical(ordered(Mutation, reply.input)) !== canonical(ordered(Mutation, input))) throw new TransportFailure("protocol");
        validatePresentation(reply.presentation, input);
        const disclosure = this.disclosure();
        const adopted = !disclosure && await review(ctx, input, reply.presentation, controller.signal);
        if (!adopted || controller.signal.aborted || this.stopping) {
          if (this.bridge.isUsable && !this.stopping) {
            const discarded = await call({ kind: "discard" }, new AbortController().signal);
            if (discarded.kind !== "reply" || discarded.value.kind !== "discarded") throw new TransportFailure("protocol");
          }
          return this.disclosure() ?? failure("unavailable");
        }
        const disclosureAfterReview = this.disclosure();
        if (disclosureAfterReview || this.lease?.mutate !== "allow") {
          const discarded = await call({ kind: "discard" }, new AbortController().signal);
          if (discarded.kind !== "reply" || discarded.value.kind !== "discarded") throw new TransportFailure("protocol");
          return this.disclosure() ?? failure(this.lease?.mutate === "deny" ? "denied" : "unavailable");
        }
        reply = await call({ kind: "confirm", input: ordered(Mutation, input), confirmed: true });
      }
      if (reply.kind !== "reply" || !valid(outputs[op], reply.value)) throw new TransportFailure("protocol");
      const response = reply.value as ResponseValue;
      if ("readiness" in response && !validReadiness(response.readiness)) throw new TransportFailure("protocol");
      if (response.kind === "operation" && (response.key !== (request as { key: string }).key || (response.status === "accepted") !== (response.result !== null))) throw new TransportFailure("protocol");
      if (response.kind === "accepted" || response.kind === "operation" && response.result !== null) {
        const result = response.result!;
        const opened = result.kind === "opened";
        if (result.key !== (request as { key: string }).key ||
            (opened ? result.fact.seq !== 1 || result.previous !== null : result.fact.seq < 2 || result.previous?.seq !== result.fact.seq - 1)) throw new TransportFailure("protocol");
        if (response.kind === "operation" && (!response.tip || result.fact.seq > response.tip.seq)) throw new TransportFailure("protocol");
        if (response.kind === "accepted" && (opened !== (request.op === "open_intent") ||
            request.op === "revise_intent" && result.previous?.seq !== request.expected.seq)) throw new TransportFailure("protocol");
      }
      if (response.kind === "retained" && request.op === "retain_text" && (response.material.sha256 !== digest(request.text) || response.material.bytes !== Buffer.byteLength(request.text))) throw new TransportFailure("protocol");
      if (response.kind === "resolved" && request.op === "resolve_text" && (canonical(response.material) !== canonical(ordered(requests.resolve_text.properties.material, request.material)) || digest(response.text) !== response.material.sha256 || Buffer.byteLength(response.text) !== response.material.bytes)) throw new TransportFailure("protocol");
      // Apply deferred authorization before final delivery, even for a native accepted response.
      return this.disclosure() ?? response;
    } catch (e) {
      if (e instanceof CompositionLimit) {
        if (prepared) this.bridge.invalidate(); // EOF clears an unconfirmed preparation; no over-budget continuation.
        return this.disclosure() ?? failure("unsupported");
      }
      this.bridge.invalidate();
      return this.disclosure() ?? unknown(e instanceof TransportFailure ? e.reason : "protocol");
    } finally {
      signal?.removeEventListener("abort", abort); this.active = undefined; this.busy = false;
    }
  }
  disconnect(): Promise<boolean> {
    this.stopping = true; this.connected = false;
    // Cancels unconfirmed UI immediately. Native in-flight calls get the bounded shutdown grace.
    this.active?.abort();
    return this.cleanup ??= this.bridge?.disconnect() ?? Promise.resolve(true);
  }
}
