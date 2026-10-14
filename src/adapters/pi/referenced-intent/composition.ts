import { FRAME_LIMIT } from "./codec.ts";

export class CompositionLimit extends Error {}
/** Shared by every descendant of ONE Pi tool invocation (including a whole Codemode script). */
export class CompositionBudget {
  calls = 0;
  returnedBytes = 0;
  bridgeMs = 0;
  stopped = false;
  preflight(calls = 1): void {
    // Reserve a maximal reply before dispatch: never receive beyond the aggregate byte budget.
    if (this.stopped || this.calls + calls > 64 || this.returnedBytes + calls * FRAME_LIMIT > 8_388_608 || this.bridgeMs >= 60_000) {
      this.stopped = true;
      throw new CompositionLimit("composition exhausted; retain returned coverage and continue explicitly in a new composition");
    }
  }
  begin(): number {
    this.preflight(); this.calls++;
    return Math.min(30_000, 60_000 - this.bridgeMs);
  }
  finish(elapsedMs: number, returnedBytes: number): void {
    this.bridgeMs += elapsedMs; this.returnedBytes += returnedBytes;
    if (this.bridgeMs >= 60_000 || this.returnedBytes >= 8_388_608) this.stopped = true;
  }
}

/** IDs and parentage come from Pi events, never from agent request parameters. */
export class Compositions {
  private scopes = new Map<string, CompositionBudget>();
  begin(id: string, parent?: string): void {
    if (this.scopes.has(id) || this.scopes.size >= 256) return;
    const budget = parent === undefined ? new CompositionBudget() : this.scopes.get(parent);
    if (budget) this.scopes.set(id, budget);
  }
  get(id: string): CompositionBudget | undefined { return this.scopes.get(id); }
  end(id: string): void { this.scopes.delete(id); }
  clear(): void { this.scopes.clear(); }
}
