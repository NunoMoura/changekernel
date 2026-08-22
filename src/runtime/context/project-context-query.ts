import type {
	ProjectContextQueryRequest,
	ProjectContextSnapshot,
	ProjectContextSourceReference,
} from "../contracts.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const PROJECT_CONTEXT_QUERY_PROTOCOL = Object.freeze({
	id: "codewiki.project-context-query",
	version: "1.0.0",
} as const);
export const PROJECT_CONTEXT_QUERY_MAX_LIMIT = 1_024;
export const PROJECT_CONTEXT_QUERY_MAX_BATCH = 64;

export interface ProjectContextQueryInput {
	readonly request: ProjectContextQueryRequest;
	readonly limit: number;
	readonly cursor?: string | null;
}

export interface ProjectContextQueryResult {
	readonly protocol: typeof PROJECT_CONTEXT_QUERY_PROTOCOL;
	readonly snapshotDigest: Sha256Digest;
	readonly semanticContextDigest: Sha256Digest;
	readonly queryEngineDigest: Sha256Digest;
	readonly requestDigest: Sha256Digest;
	readonly items: readonly CanonicalJsonValue[];
	readonly sourceReferences: readonly ProjectContextSourceReference[];
	readonly coverage: "complete" | "partial" | "unknown";
	readonly unknowns: readonly string[];
	readonly truncated: boolean;
	readonly nextCursor: string | null;
	readonly stale: boolean;
	readonly resultDigest: Sha256Digest;
}

export interface ProjectContextQueryBatchResult {
	readonly protocol: typeof PROJECT_CONTEXT_QUERY_PROTOCOL;
	readonly snapshotDigest: Sha256Digest;
	readonly results: readonly ProjectContextQueryResult[];
	readonly batchDigest: Sha256Digest;
}

export interface ProjectContextFacade {
	readonly snapshotDigest: Sha256Digest;
	readonly knowledge: (input: ServiceQueryInput<"knowledge">) => ProjectContextQueryResult;
	readonly alignment: (input: ServiceQueryInput<"alignment">) => ProjectContextQueryResult;
	readonly projectState: (input: ServiceQueryInput<"project_state">) => ProjectContextQueryResult;
	readonly repository: (input: ServiceQueryInput<"repository">) => ProjectContextQueryResult;
	readonly evidence: (input: ServiceQueryInput<"evidence">) => ProjectContextQueryResult;
	readonly result: (input: ServiceQueryInput<"result">) => ProjectContextQueryResult;
	readonly changeDelta: (input: ServiceQueryInput<"change_delta">) => ProjectContextQueryResult;
	readonly batch: (inputs: readonly ProjectContextQueryInput[]) => ProjectContextQueryBatchResult;
}

type RequestFor<TService extends ProjectContextQueryRequest["service"]> = Extract<
	ProjectContextQueryRequest,
	{readonly service: TService}
>;

export interface ServiceQueryInput<TService extends ProjectContextQueryRequest["service"]> {
	readonly operation: RequestFor<TService>["operation"];
	readonly arguments: CanonicalJsonValue;
	readonly limit: number;
	readonly cursor?: string | null;
}

export function createProjectContextFacade(
	snapshot: ProjectContextSnapshot,
): Readonly<ProjectContextFacade> {
	const query = (input: ProjectContextQueryInput): ProjectContextQueryResult =>
		executeProjectContextQuery(snapshot, input);
	const service = <TService extends ProjectContextQueryRequest["service"]>(serviceName: TService) =>
		(input: ServiceQueryInput<TService>): ProjectContextQueryResult => query({
			request: {
				service: serviceName,
				operation: input.operation,
				arguments: input.arguments,
			} as ProjectContextQueryRequest,
			limit: input.limit,
			cursor: input.cursor,
		});
	return Object.freeze({
		snapshotDigest: snapshot.snapshotDigest,
		knowledge: service("knowledge"),
		alignment: service("alignment"),
		projectState: service("project_state"),
		repository: service("repository"),
		evidence: service("evidence"),
		result: service("result"),
		changeDelta: service("change_delta"),
		batch: (inputs: readonly ProjectContextQueryInput[]) =>
			executeProjectContextQueryBatch(snapshot, inputs),
	});
}

export function executeProjectContextQuery(
	snapshot: ProjectContextSnapshot,
	input: ProjectContextQueryInput,
): Readonly<ProjectContextQueryResult> {
	// SAFETY: ProjectContextQueryRequest is a JSON-domain discriminated union; canonicalization preserves its fields.
	const request = toCanonicalJsonValue(input.request) as unknown as ProjectContextQueryRequest;
	const requestDigest = canonicalJsonDigest(request);
	const route = snapshot.manifest.routes.find((entry) => entry.requestDigest === requestDigest);
	if (!route || canonicalJson(route.request) !== canonicalJson(request)) {
		throw new Error("Project Context query was not admitted into this snapshot.");
	}
	const limit = boundedInteger(input.limit, "query limit", 1, PROJECT_CONTEXT_QUERY_MAX_LIMIT);
	const offset = decodeCursor(input.cursor ?? null, snapshot.snapshotDigest, requestDigest);
	const items = route.chunkDigests.flatMap((digest) => {
		const chunk = snapshot.chunks.find((entry) => entry.chunkDigest === digest);
		if (!chunk) throw new Error("Project Context query chunk is unavailable.");
		return chunk.items;
	});
	if (items.length !== route.itemCount || offset > items.length) {
		throw new Error("Project Context query route is inconsistent with its chunks.");
	}
	const selected = Object.freeze(items.slice(offset, offset + limit));
	const nextOffset = offset + selected.length;
	const truncated = nextOffset < items.length;
	const body = {
		protocol: PROJECT_CONTEXT_QUERY_PROTOCOL,
		snapshotDigest: snapshot.snapshotDigest,
		semanticContextDigest: snapshot.manifest.semanticContextDigest,
		queryEngineDigest: snapshot.manifest.queryEngine.digest,
		requestDigest,
		items: selected,
		sourceReferences: route.sourceReferences,
		coverage: route.coverage,
		unknowns: route.unknowns,
		truncated,
		nextCursor: truncated
			? encodeCursor(snapshot.snapshotDigest, requestDigest, nextOffset)
			: null,
		stale: snapshot.observation.stale,
	};
	return Object.freeze({...body, resultDigest: canonicalJsonDigest(body)});
}

export function executeProjectContextQueryBatch(
	snapshot: ProjectContextSnapshot,
	inputs: readonly ProjectContextQueryInput[],
): Readonly<ProjectContextQueryBatchResult> {
	if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > PROJECT_CONTEXT_QUERY_MAX_BATCH) {
		throw new Error("Project Context query batch size is invalid.");
	}
	const results = Object.freeze(inputs.map((input) => executeProjectContextQuery(snapshot, input)));
	const body = {
		protocol: PROJECT_CONTEXT_QUERY_PROTOCOL,
		snapshotDigest: snapshot.snapshotDigest,
		results,
	};
	return Object.freeze({...body, batchDigest: canonicalJsonDigest(body)});
}

function encodeCursor(
	snapshotDigest: Sha256Digest,
	requestDigest: Sha256Digest,
	offset: number,
): string {
	return Buffer.from(canonicalJson({snapshotDigest, requestDigest, offset}), "utf8").toString("base64url");
}

function decodeCursor(
	value: string | null,
	snapshotDigest: Sha256Digest,
	requestDigest: Sha256Digest,
): number {
	if (value === null) return 0;
	let decoded: unknown;
	try {
		decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
	} catch {
		throw new Error("Project Context query cursor is invalid.");
	}
	if (!isRecord(decoded)) throw new Error("Project Context query cursor is invalid.");
	if (decoded.snapshotDigest !== snapshotDigest || decoded.requestDigest !== requestDigest) {
		throw new Error("Project Context query cursor belongs to another snapshot or request.");
	}
	return boundedInteger(decoded.offset, "cursor offset", 0, Number.MAX_SAFE_INTEGER);
}

function boundedInteger(
	value: unknown,
	field: string,
	minimum: number,
	maximum: number,
): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
		throw new Error(`Project Context ${field} is invalid.`);
	}
	return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
