import type {Model, Provider, Usage} from "@earendil-works/pi-ai";

/** Backend-owned route; credentials, transport enforcement and cleanup are not caller data. */
export interface PiModelLease {
	readonly provider: Provider;
	readonly model: Model<"openai-completions">;
	dispose(): void | Promise<void>;
}

export function validatePiModel(lease: PiModelLease, providerId: string, modelId: string): void {
	if (lease.provider.id !== providerId || lease.model.provider !== providerId || lease.model.id !== modelId ||
		lease.model.api !== "openai-completions" || lease.model.compat?.supportsFinishReason === false) {
		throw new Error("Installed Pi model does not match the supported exact route.");
	}
}

/** Pi output includes reasoning; cache reads/writes are separate from uncached input. */
export function piTokenUsage(usage: Usage): Readonly<{inputTokens: number; outputTokens: number}> {
	if (!usage || [usage.input, usage.output, usage.cacheRead, usage.cacheWrite, usage.totalTokens].some(value => !Number.isSafeInteger(value) || value < 0)) {
		throw new Error("Invalid provider token count.");
	}
	const inputTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	if (!Number.isSafeInteger(inputTokens) || inputTokens === 0 || usage.output === 0 || usage.totalTokens !== inputTokens + usage.output) {
		throw new Error("Missing or inconsistent usage for a nonempty model call.");
	}
	if (usage.reasoning !== undefined && (!Number.isSafeInteger(usage.reasoning) || usage.reasoning < 0 || usage.reasoning > usage.output)) {
		throw new Error("Invalid reasoning token subset.");
	}
	return Object.freeze({inputTokens, outputTokens: usage.output});
}
