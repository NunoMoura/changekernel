import type {CheckStage} from "../../checks/contracts.ts";
import {
	PROJECT_CONTEXT_AUTHORIZATION_PROTOCOL,
	PROJECT_CONTEXT_SNAPSHOT_PROTOCOL,
	PROJECT_CONTEXT_OBSERVATION_PROTOCOL,
	type ProjectContextAuthorization,
	type ProjectContextChunk,
	type ProjectContextSnapshot,
	type ProjectContextHandle,
	type ProjectContextManifest,
	type ProjectContextObservation,
	type ProjectContextQueryRequest,
	type ProjectContextRoute,
	type ProjectContextSourceReference,
	type ProjectContextSourceSnapshots,
} from "../../runtime/contracts.ts";
import {
	assertSha256Digest,
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const PROJECT_CONTEXT_SNAPSHOT_SCHEMA_VERSION = "1.0.0" as const;
export const PROJECT_CONTEXT_MAX_ROUTES = 2_048;
export const PROJECT_CONTEXT_MAX_ROUTE_ITEMS = 16_384;
export const PROJECT_CONTEXT_MAX_CHUNK_BYTES = 512 * 1_024;
export const PROJECT_CONTEXT_MAX_SNAPSHOT_BYTES = 64 * 1_024 * 1_024;

export interface ProjectContextRouteInput {
	readonly request: ProjectContextQueryRequest;
	readonly items: readonly CanonicalJsonValue[];
	readonly sourceReferences: readonly ProjectContextSourceReference[];
	readonly coverage: "complete" | "partial" | "unknown";
	readonly unknowns: readonly string[];
}

export interface ProjectContextHandleTarget {
	readonly targetKey: string;
	readonly request: ProjectContextQueryRequest;
	readonly itemIndex: number;
}

export interface ProjectContextSnapshotInput {
	readonly stage: CheckStage;
	readonly subject: {readonly id: string; readonly digest: Sha256Digest};
	readonly changeRevisionDigest: Sha256Digest;
	readonly sources: ProjectContextSourceSnapshots;
	readonly producerSkillSetDigest: Sha256Digest | null;
	readonly gateFeedbackDigest: Sha256Digest | null;
	readonly queryEngine: {readonly id: string; readonly version: string; readonly digest: Sha256Digest};
	readonly routes: readonly ProjectContextRouteInput[];
	readonly handles?: readonly ProjectContextHandleTarget[];
	readonly observation: {
		readonly capturedAt: string;
		readonly stale: boolean;
		readonly coverage: "complete" | "partial" | "unknown";
		readonly unknowns: readonly string[];
	};
}

export interface ProjectContextIdleBoundary {
	readonly currentSnapshotDigest: Sha256Digest;
	readonly sessionId: string;
	readonly idle: boolean;
	readonly openTurn: boolean;
	readonly pendingToolCalls: number;
	readonly pendingChildren: number;
}

export function createProjectContextSnapshot(
	input: ProjectContextSnapshotInput,
): Readonly<ProjectContextSnapshot> {
	assertHeader(input);
	if (!Array.isArray(input.routes) || input.routes.length > PROJECT_CONTEXT_MAX_ROUTES) {
		throw new Error("Project Context routes exceed the snapshot limit.");
	}
	const chunks = new Map<Sha256Digest, ProjectContextChunk>();
	const routeItems = new Map<Sha256Digest, readonly CanonicalJsonValue[]>();
	const routes = input.routes.map((route) => normalizeRoute(route, chunks, routeItems))
		.sort((left, right) => compareText(left.requestDigest, right.requestDigest));
	assertUnique(routes.map((route) => route.requestDigest), "Project Context route");
	const chunkList = [...chunks.values()].sort((left, right) =>
		compareText(left.chunkDigest, right.chunkDigest)
	);
	const manifestBody = {
		protocol: PROJECT_CONTEXT_SNAPSHOT_PROTOCOL,
		stage: input.stage,
		subject: Object.freeze({id: boundedText(input.subject.id, "subject id", 256), digest: assertSha256Digest(input.subject.digest, "Project Context subject digest")}),
		changeRevisionDigest: assertSha256Digest(input.changeRevisionDigest, "Project Context Change revision digest"),
		sources: normalizeSources(input.sources),
		producerSkillSetDigest: optionalDigest(input.producerSkillSetDigest, "Project Context producer Skill set digest"),
		gateFeedbackDigest: optionalDigest(input.gateFeedbackDigest, "Project Context Gate feedback digest"),
		queryEngine: Object.freeze({
			id: boundedText(input.queryEngine.id, "query engine id", 128),
			version: boundedText(input.queryEngine.version, "query engine version", 64),
			digest: assertSha256Digest(input.queryEngine.digest, "Project Context query engine digest"),
		}),
		routes: Object.freeze(routes),
		chunkDigests: Object.freeze(chunkList.map((chunk) => chunk.chunkDigest)),
	};
	const manifest: ProjectContextManifest = Object.freeze({
		...manifestBody,
		semanticContextDigest: canonicalJsonDigest(manifestBody),
	});
	const observation = createObservation(manifest.semanticContextDigest, input.observation);
	const snapshotDigest = canonicalJsonDigest({
		semanticContextDigest: manifest.semanticContextDigest,
		observationDigest: observation.observationDigest,
	});
	const handles = createHandles(input.handles ?? [], snapshotDigest, routes, routeItems, chunks);
	const snapshot = Object.freeze({
		schemaVersion: PROJECT_CONTEXT_SNAPSHOT_SCHEMA_VERSION,
		manifest,
		observation,
		snapshotDigest,
		chunks: Object.freeze(chunkList),
		handles,
	});
	if (Buffer.byteLength(canonicalJson(snapshot)) > PROJECT_CONTEXT_MAX_SNAPSHOT_BYTES) {
		throw new Error("Project Context Snapshot exceeds its byte limit.");
	}
	return snapshot;
}

export function authorizeProjectContextSnapshot(input: {
	readonly snapshot: ProjectContextSnapshot;
	readonly runId: string;
	readonly actorDigest: Sha256Digest;
	readonly authorizedAt: string;
	readonly expiresAt: string;
}): Readonly<ProjectContextAuthorization> {
	if (input.snapshot.observation.stale) {
		throw new Error("Stale Project Context Snapshot cannot receive Run authorization.");
	}
	const authorizedAt = timestamp(input.authorizedAt, "authorization time");
	const expiresAt = timestamp(input.expiresAt, "authorization expiry");
	if (Date.parse(expiresAt) <= Date.parse(authorizedAt)) {
		throw new Error("Project Context authorization must expire after authorization.");
	}
	const body = {
		protocol: PROJECT_CONTEXT_AUTHORIZATION_PROTOCOL,
		snapshotDigest: input.snapshot.snapshotDigest,
		semanticContextDigest: input.snapshot.manifest.semanticContextDigest,
		runId: boundedText(input.runId, "Run id", 256),
		stage: input.snapshot.manifest.stage,
		subjectDigest: input.snapshot.manifest.subject.digest,
		actorDigest: assertSha256Digest(input.actorDigest, "Project Context actor digest"),
		authorizedAt,
		expiresAt,
	};
	return Object.freeze({...body, authorizationDigest: canonicalJsonDigest(body)});
}

export function expandProjectContextHandle(
	snapshot: ProjectContextSnapshot,
	handleValue: string,
): Readonly<{targetKey: string; value: CanonicalJsonValue; sourceReferences: readonly ProjectContextSourceReference[]}> {
	const handle = snapshot.handles.find((entry) => entry.handle === handleValue);
	if (!handle || handle.snapshotDigest !== snapshot.snapshotDigest) {
		throw new Error("Project Context handle is foreign or stale.");
	}
	const chunk = snapshot.chunks.find((entry) => entry.chunkDigest === handle.chunkDigest);
	const value = chunk?.items[handle.itemIndex];
	if (value === undefined) throw new Error("Project Context handle target is unavailable.");
	const route = snapshot.manifest.routes.find(
		(entry) => entry.requestDigest === handle.requestDigest && entry.chunkDigests.includes(handle.chunkDigest),
	);
	if (!route) throw new Error("Project Context handle route is unavailable.");
	return Object.freeze({targetKey: handle.targetKey, value, sourceReferences: route.sourceReferences});
}

export function refreshProjectContextSnapshotAtIdleBoundary(input: {
	readonly current: ProjectContextSnapshot;
	readonly next: ProjectContextSnapshot;
	readonly boundary: ProjectContextIdleBoundary;
}): ProjectContextSnapshot {
	if (
		input.boundary.currentSnapshotDigest !== input.current.snapshotDigest ||
		!input.boundary.idle ||
		input.boundary.openTurn ||
		input.boundary.pendingToolCalls !== 0 ||
		input.boundary.pendingChildren !== 0
	) {
		throw new Error("Project Context Snapshot refresh requires an exact idle boundary.");
	}
	boundedText(input.boundary.sessionId, "Session id", 256);
	return input.next;
}

function normalizeRoute(
	input: ProjectContextRouteInput,
	chunks: Map<Sha256Digest, ProjectContextChunk>,
	routeItems: Map<Sha256Digest, readonly CanonicalJsonValue[]>,
): ProjectContextRoute {
	// SAFETY: assertQueryRequest validates the canonical value against the closed discriminated union.
	const request = toCanonicalJsonValue(input.request) as unknown as ProjectContextQueryRequest;
	assertQueryRequest(request);
	const requestDigest = canonicalJsonDigest(request);
	if (!Array.isArray(input.items) || input.items.length > PROJECT_CONTEXT_MAX_ROUTE_ITEMS) {
		throw new Error("Project Context route items exceed the route limit.");
	}
	const items = input.items.map((item) => toCanonicalJsonValue(item));
	const routeChunks = chunkItems(items).map((chunkItemsValue) => {
		const chunkBody = {items: chunkItemsValue};
		const byteLength = Buffer.byteLength(canonicalJson(chunkBody));
		const chunk: ProjectContextChunk = Object.freeze({
			chunkDigest: canonicalJsonDigest(chunkBody),
			items: Object.freeze(chunkItemsValue),
			byteLength,
		});
		chunks.set(chunk.chunkDigest, chunk);
		return chunk.chunkDigest;
	});
	routeItems.set(requestDigest, Object.freeze(items));
	const coverage = coverageValue(input.coverage);
	const unknowns = normalizedTextSet(input.unknowns, "Project Context route unknown", 256);
	if (coverage === "complete" && unknowns.length > 0) {
		throw new Error("Complete Project Context route cannot declare unknowns.");
	}
	return Object.freeze({
		request,
		requestDigest,
		chunkDigests: Object.freeze(routeChunks),
		itemCount: items.length,
		sourceReferences: normalizeSourceReferences(input.sourceReferences),
		coverage,
		unknowns,
	});
}

function chunkItems(items: readonly CanonicalJsonValue[]): CanonicalJsonValue[][] {
	if (items.length === 0) return [];
	const chunks: CanonicalJsonValue[][] = [];
	let current: CanonicalJsonValue[] = [];
	for (const item of items) {
		const candidate = [...current, item];
		if (Buffer.byteLength(canonicalJson({items: candidate})) > PROJECT_CONTEXT_MAX_CHUNK_BYTES) {
			if (current.length === 0) throw new Error("One Project Context item exceeds the chunk limit.");
			chunks.push(current);
			current = [item];
		} else {
			current = candidate;
		}
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}

function createObservation(
	semanticContextDigest: Sha256Digest,
	input: ProjectContextSnapshotInput["observation"],
): ProjectContextObservation {
	const coverage = coverageValue(input.coverage);
	const unknowns = normalizedTextSet(input.unknowns, "Project Context observation unknown", 256);
	if (coverage === "complete" && unknowns.length > 0) {
		throw new Error("Complete Project Context observation cannot declare unknowns.");
	}
	const body = {
		protocol: PROJECT_CONTEXT_OBSERVATION_PROTOCOL,
		semanticContextDigest,
		capturedAt: timestamp(input.capturedAt, "capture time"),
		stale: input.stale === true,
		coverage,
		unknowns,
	};
	return Object.freeze({...body, observationDigest: canonicalJsonDigest(body)});
}

function createHandles(
	targets: readonly ProjectContextHandleTarget[],
	snapshotDigest: Sha256Digest,
	routes: readonly ProjectContextRoute[],
	routeItems: ReadonlyMap<Sha256Digest, readonly CanonicalJsonValue[]>,
	chunks: ReadonlyMap<Sha256Digest, ProjectContextChunk>,
): readonly ProjectContextHandle[] {
	const handles = targets.map((target) => {
		const targetKey = boundedText(target.targetKey, "Project Context handle target key", 512);
		const requestDigest = canonicalJsonDigest(toCanonicalJsonValue(target.request));
		const route = routes.find((entry) => entry.requestDigest === requestDigest);
		const items = routeItems.get(requestDigest);
		if (!route || !items || !Number.isInteger(target.itemIndex) || target.itemIndex < 0 || target.itemIndex >= items.length) {
			throw new Error("Project Context handle target is outside its admitted route.");
		}
		let offset = target.itemIndex;
		let chunkDigest: Sha256Digest | null = null;
		let chunkIndex = -1;
		for (const digest of route.chunkDigests) {
			const chunkLength = chunks.get(digest)?.items.length;
			if (chunkLength === undefined) throw new Error("Project Context handle chunk is unavailable.");
			if (offset < chunkLength) {
				chunkDigest = digest;
				chunkIndex = offset;
				break;
			}
			offset -= chunkLength;
		}
		if (!chunkDigest || chunkIndex < 0) throw new Error("Project Context handle chunk is unavailable.");
		const suffix = canonicalJsonDigest({snapshotDigest, targetKey, requestDigest, chunkDigest, itemIndex: chunkIndex}).slice(7, 19);
		return Object.freeze({
			handle: `pch:${snapshotDigest.slice(7, 19)}:${suffix}`,
			snapshotDigest,
			targetKey,
			requestDigest,
			chunkDigest,
			itemIndex: chunkIndex,
		}) satisfies ProjectContextHandle;
	}).sort((left, right) => compareText(left.handle, right.handle));
	assertUnique(handles.map((entry) => entry.handle), "Project Context handle");
	assertUnique(handles.map((entry) => entry.targetKey), "Project Context handle target");
	return Object.freeze(handles);
}

function assertQueryRequest(value: ProjectContextQueryRequest): void {
	const allowed = new Set([
		"knowledge:subject", "knowledge:facet", "knowledge:search", "knowledge:list",
		"alignment:neighbors", "alignment:impact", "alignment:delivery_chain", "alignment:contradictions",
		"project_state:change", "project_state:work_unit", "project_state:readiness", "project_state:active_changes",
		"repository:file", "repository:tree", "repository:search", "repository:ownership",
		"evidence:by_subject", "evidence:by_check", "evidence:artifact",
		"result:by_subject", "result:by_gate", "result:result",
		"change_delta:discover",
	]);
	if (!allowed.has(`${value.service}:${value.operation}`)) {
		throw new Error("Project Context route service operation is invalid.");
	}
}

function normalizeSources(value: ProjectContextSourceSnapshots): ProjectContextSourceSnapshots {
	return Object.freeze({
		workState: assertSha256Digest(value.workState, "Project Context WorkState digest"),
		knowledgeState: assertSha256Digest(value.knowledgeState, "Project Context Knowledge State digest"),
		knowledgeProjection: assertSha256Digest(value.knowledgeProjection, "Project Context Knowledge projection digest"),
		alignment: assertSha256Digest(value.alignment, "Project Context Alignment digest"),
		repositoryTree: assertSha256Digest(value.repositoryTree, "Project Context repository tree digest"),
		acceptedChanges: assertSha256Digest(value.acceptedChanges, "Project Context accepted Changes digest"),
		workGraph: assertSha256Digest(value.workGraph, "Project Context Work Graph digest"),
		evidence: assertSha256Digest(value.evidence, "Project Context Evidence digest"),
		results: assertSha256Digest(value.results, "Project Context Results digest"),
	});
}

function normalizeSourceReferences(values: readonly ProjectContextSourceReference[]): readonly ProjectContextSourceReference[] {
	if (!Array.isArray(values) || values.length > 4_096) throw new Error("Project Context source references exceed the limit.");
	const allowedKinds = new Set(["knowledge", "source", "test", "git", "trace", "evidence", "result"]);
	const normalized = values.map((value) => {
		if (!allowedKinds.has(value.kind)) throw new Error("Project Context source reference kind is invalid.");
		return Object.freeze({
		kind: value.kind,
		ref: boundedText(value.ref, "Project Context source reference", 1_024),
		digest: optionalDigest(value.digest, "Project Context source reference digest"),
	});
	}).sort((left, right) => compareText(`${left.kind}:${left.ref}`, `${right.kind}:${right.ref}`));
	assertUnique(normalized.map((value) => `${value.kind}:${value.ref}:${value.digest ?? ""}`), "Project Context source reference");
	return Object.freeze(normalized);
}

function assertHeader(input: ProjectContextSnapshotInput): void {
	if (!["decision", "planning", "implementation", "review"].includes(input.stage)) throw new Error("Project Context stage is invalid.");
	if (typeof input.observation.stale !== "boolean") throw new Error("Project Context staleness must be explicit.");
}

function coverageValue(value: unknown): "complete" | "partial" | "unknown" {
	if (value !== "complete" && value !== "partial" && value !== "unknown") throw new Error("Project Context coverage is invalid.");
	return value;
}

function normalizedTextSet(values: readonly string[], field: string, limit: number): readonly string[] {
	if (!Array.isArray(values) || values.length > limit) throw new Error(`${field}s exceed the limit.`);
	return Object.freeze([...new Set(values.map((value) => boundedText(value, field, 1_024)))].sort(compareText));
}

function optionalDigest(value: Sha256Digest | null, field: string): Sha256Digest | null {
	return value === null ? null : assertSha256Digest(value, field);
}

function boundedText(value: unknown, field: string, maximum: number): string {
	if (typeof value !== "string" || value.length === 0 || value.length > maximum || value.trim() !== value) throw new Error(`Project Context ${field} is invalid.`);
	return value;
}

function timestamp(value: unknown, field: string): string {
	const text = boundedText(value, field, 64);
	if (!Number.isFinite(Date.parse(text))) throw new Error(`Project Context ${field} is invalid.`);
	return text;
}

function assertUnique(values: readonly string[], field: string): void {
	if (new Set(values).size !== values.length) throw new Error(`${field} identity must be unique.`);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
