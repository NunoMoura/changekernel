import {
	BACKLOG_TRIAGE_QUERY_PROTOCOL,
	type BacklogTriageQueryFilters,
	type TriageOrdering,
} from "../../changes/triage/contracts.ts";
import {
	DECISION_ATTENTION_SELECTION_PROTOCOL,
	type DecisionAttentionSelectionCommand,
} from "../../changes/triage/selection.ts";
import {
	assertFrontendRequestContext,
	createFrontendEventBatch,
	FRONTEND_CAPABILITIES,
	FRONTEND_COMMAND_NAMES,
	FRONTEND_EVENT_PROTOCOL,
	FRONTEND_PROJECTION_NAMES,
	FRONTEND_QUERY_NAMES,
	FrontendApiError,
	normalizeFrontendEventRequest,
	type FrontendCapabilityDocument,
	type FrontendEventBatch,
	type FrontendEventRequest,
	type FrontendProjectionInvalidatedEvent,
} from "../../protocol/frontend.ts";
import {
	CLIENT_PROJECT_SERVER_PROTOCOL,
	normalizeClientProjectServerCommand,
	normalizeClientProjectServerOperation,
	normalizeClientProjectServerQuery,
	normalizeClientProjectServerQueryResult,
	runtimeSemanticIdempotencyDigest,
	type ClientProjectServerCommandEnvelope,
	type ClientProjectServerOperationEnvelope,
	type ClientProjectServerQueryEnvelope,
	type ClientProjectServerQueryResultEnvelope,
	type ClientProjectServerRequestContext,
} from "../../protocol/client-project-server.ts";
import {
	assertSha256Digest,
	canonicalJsonDigest,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import type {ProjectServerApi, ProjectServerEvent} from "../api.ts";

export interface FrontendProjectServerGateway {
	capabilities(
		context: ClientProjectServerRequestContext,
	): FrontendCapabilityDocument;
	query(
		context: ClientProjectServerRequestContext,
		value: unknown,
	): Promise<ClientProjectServerQueryResultEnvelope>;
	command(
		context: ClientProjectServerRequestContext,
		value: unknown,
	): Promise<ClientProjectServerOperationEnvelope>;
	events(
		context: ClientProjectServerRequestContext,
		value: unknown,
	): Promise<FrontendEventBatch>;
}

export function createFrontendProjectServerGateway(input: {
	readonly repositoryIdentity: Sha256Digest;
	readonly projectServer: ProjectServerApi;
	readonly now?: () => string;
}): FrontendProjectServerGateway {
	const repositoryIdentity = assertSha256Digest(
		input.repositoryIdentity,
		"frontendGateway.repositoryIdentity",
	);
	const now = input.now || (() => new Date().toISOString());
	return Object.freeze({
		capabilities(context: ClientProjectServerRequestContext) {
			assertAppContext(context);
			return FRONTEND_CAPABILITIES;
		},
		async query(context: ClientProjectServerRequestContext, value: unknown) {
			try {
				const envelope = queryEnvelope(value);
				assertBoundRequest(context, envelope, repositoryIdentity);
				return await executeQuery(input.projectServer, envelope);
			} catch (error) {
				throw frontendFailure(error);
			}
		},
		async command(context: ClientProjectServerRequestContext, value: unknown) {
			try {
				const envelope = commandEnvelope(value, now());
				assertBoundRequest(context, envelope, repositoryIdentity);
				return await executeCommand(input.projectServer, envelope, now);
			} catch (error) {
				throw frontendFailure(error);
			}
		},
		async events(context: ClientProjectServerRequestContext, value: unknown) {
			try {
				const request = eventRequest(value);
				assertBoundRequest(context, request, repositoryIdentity);
				return await readEvents(input.projectServer, request);
			} catch (error) {
				throw frontendFailure(error);
			}
		},
	});
}

async function executeQuery(
	projectServer: ProjectServerApi,
	envelope: ClientProjectServerQueryEnvelope,
): Promise<ClientProjectServerQueryResultEnvelope> {
	if (!FRONTEND_QUERY_NAMES.includes(envelope.queryName as never)) {
		throw new FrontendApiError(
			"unsupported_capability",
			`Frontend query ${envelope.queryName} is unsupported.`,
		);
	}
	const payload =
		envelope.queryName === "codewiki.decision-attention.read"
			? allowedPayload(
					envelope.payload,
					["filters", "orderBy"],
					"Decision attention query payload",
				)
			: exactPayload(envelope.payload, [], "Frontend query payload");
	const context = requestContext(envelope);
	let result: Record<string, unknown>;
	let snapshotDigest: Sha256Digest;
	let truncated = false;
	if (envelope.queryName === "codewiki.app-state.read") {
		const state = await projectServer.queries.appState(context);
		result = {
			...state,
			pipelineQueue: state.pipelineQueue.slice(0, envelope.maxItems),
		};
		truncated = state.pipelineQueue.length > envelope.maxItems;
		snapshotDigest = canonicalJsonDigest(state);
	} else if (envelope.queryName === "codewiki.changes.read") {
		const state = await projectServer.queries.changes(context);
		result = {...state, records: state.records.slice(0, envelope.maxItems)};
		truncated = state.truncated || state.records.length > envelope.maxItems;
		snapshotDigest = assertSha256Digest(
			state.stateDigest,
			"frontendChanges.stateDigest",
		);
	} else if (envelope.queryName === "codewiki.configuration.read") {
		const state = await projectServer.queries.configuration(context);
		result = {
			...state,
			previewProfiles: state.previewProfiles.slice(0, envelope.maxItems),
			uiPreviewTargets: state.uiPreviewTargets.slice(0, envelope.maxItems),
		};
		truncated =
			state.previewProfiles.length > envelope.maxItems ||
			state.uiPreviewTargets.length > envelope.maxItems;
		snapshotDigest = assertSha256Digest(
			state.stateDigest,
			"frontendConfiguration.stateDigest",
		);
	} else {
		const triage = await projectServer.queries.decisionAttention({
			protocol: BACKLOG_TRIAGE_QUERY_PROTOCOL,
			projectionDigest: requiredExpectedSnapshot(envelope),
			limit: envelope.maxItems,
			...decisionAttentionQuery(payload),
		});
		// SAFETY: triage is a validated, immutable protocol object and therefore a string-keyed record.
		result = triage as unknown as Record<string, unknown>;
		truncated = triage.coverage.truncated;
		snapshotDigest = triage.projectionDigest;
	}
	assertExpectedSnapshot(envelope, snapshotDigest);
	return queryResult({
		envelope,
		snapshotDigest,
		truncated,
		payload: result,
	});
}

async function executeCommand(
	projectServer: ProjectServerApi,
	envelope: ClientProjectServerCommandEnvelope,
	now: () => string,
): Promise<ClientProjectServerOperationEnvelope> {
	if (!FRONTEND_COMMAND_NAMES.includes(envelope.commandName as never)) {
		throw new FrontendApiError(
			"unsupported_capability",
			`Frontend command ${envelope.commandName} is unsupported.`,
		);
	}
	if (envelope.requestedCapability !== "codewiki.decision.select") {
		throw new FrontendApiError(
			"authorization_denied",
			"Frontend command capability binding is invalid.",
		);
	}
	const payload = exactPayload(
		envelope.payload,
		["changeId", "changeRevisionId"],
		"Decision selection payload",
	);
	if (envelope.targetRef !== payload.changeId) {
		throw new FrontendApiError(
			"conflict",
			"Decision selection target does not match payload.",
		);
	}
	const command: DecisionAttentionSelectionCommand = {
		protocolId: DECISION_ATTENTION_SELECTION_PROTOCOL.id,
		protocolVersion: DECISION_ATTENTION_SELECTION_PROTOCOL.version,
		idempotencyKey: envelope.semanticIdempotencyKey,
		changeId: requiredText(payload.changeId, "changeId"),
		changeRevisionId: assertSha256Digest(
			payload.changeRevisionId,
			"frontendDecision.changeRevisionId",
		),
		expectedProjectionDigest: envelope.expectedDigest,
	};
	const result = await projectServer.commands.selectDecision(command);
	const acceptedAt = now();
	return normalizeClientProjectServerOperation({
		protocolId: CLIENT_PROJECT_SERVER_PROTOCOL.id,
		protocolVersion: CLIENT_PROJECT_SERVER_PROTOCOL.version,
		kind: "operation",
		operationId: result.attemptOperationId,
		repositoryIdentity: envelope.repositoryIdentity,
		actorId: envelope.actor.actorId,
		commandName: envelope.commandName,
		semanticIdempotencyDigest: runtimeSemanticIdempotencyDigest(envelope),
		status: "accepted",
		acceptedAt,
		updatedAt: acceptedAt,
		snapshotDigest: envelope.expectedDigest,
		payload: {attemptOperationId: result.attemptOperationId},
	});
}

async function readEvents(
	projectServer: ProjectServerApi,
	request: FrontendEventRequest,
): Promise<FrontendEventBatch> {
	const batch = await projectServer.events.read(request.afterCursor, {
		maxEvents: request.maxEvents,
		waitMs: request.waitMs,
	});
	const generationChanged =
		request.generationId !== null && request.generationId !== batch.generationId;
	const resetRequired = generationChanged || batch.resetRequired;
	return createFrontendEventBatch({
		repositoryIdentity: request.repositoryIdentity,
		generationId: batch.generationId,
		latestCursor: batch.latestCursor,
		cursor: resetRequired ? batch.latestCursor : batch.cursor,
		resetRequired,
		events: resetRequired
			? []
			: batch.events.map((event) => frontendEvent(request.repositoryIdentity, event)),
	});
}

function frontendEvent(
	repositoryIdentity: Sha256Digest,
	event: ProjectServerEvent,
): FrontendProjectionInvalidatedEvent {
	const safeSource = {
		generationId: event.generationId,
		cursor: event.cursor,
		state: event.state,
		observedAt: event.observedAt,
		...(event.workStateDigest ? {workStateDigest: event.workStateDigest} : {}),
	};
	const digest = canonicalJsonDigest(safeSource);
	return {
		protocolId: FRONTEND_EVENT_PROTOCOL.id,
		protocolVersion: FRONTEND_EVENT_PROTOCOL.version,
		kind: "event",
		eventId: `frontend-event:${digest.slice("sha256:".length)}`,
		cursor: event.cursor,
		repositoryIdentity,
		eventName: "codewiki.projection.invalidated",
		occurredAt: event.observedAt,
		snapshotDigest:
			event.workStateDigest === undefined
				? digest
				: assertSha256Digest(
						event.workStateDigest,
						"frontendEvent.workStateDigest",
					),
		projections: FRONTEND_PROJECTION_NAMES,
	};
}

function queryResult(input: {
	readonly envelope: ClientProjectServerQueryEnvelope;
	readonly snapshotDigest: Sha256Digest;
	readonly truncated: boolean;
	readonly payload: Record<string, unknown>;
}): ClientProjectServerQueryResultEnvelope {
	return normalizeClientProjectServerQueryResult({
		protocolId: CLIENT_PROJECT_SERVER_PROTOCOL.id,
		protocolVersion: CLIENT_PROJECT_SERVER_PROTOCOL.version,
		kind: "query_result",
		transportRequestId: input.envelope.transportRequestId,
		repositoryIdentity: input.envelope.repositoryIdentity,
		queryName: input.envelope.queryName,
		snapshot: {
			snapshotDigest: input.snapshotDigest,
			provenanceRefs: [`project-server:${input.envelope.queryName}`],
			coverage: input.truncated ? "partial" : "complete",
			truncated: input.truncated,
			stale: false,
			redacted: true,
		},
		payload: input.payload,
	});
}

function queryEnvelope(value: unknown): ClientProjectServerQueryEnvelope {
	try {
		return normalizeClientProjectServerQuery(value);
	} catch (error) {
		throw invalidRequest(error);
	}
}

function commandEnvelope(
	value: unknown,
	observedAt: string,
): ClientProjectServerCommandEnvelope {
	try {
		return normalizeClientProjectServerCommand(value, new Date(observedAt));
	} catch (error) {
		throw invalidRequest(error);
	}
}

function eventRequest(value: unknown): FrontendEventRequest {
	try {
		return normalizeFrontendEventRequest(value);
	} catch (error) {
		if (error instanceof FrontendApiError) throw error;
		throw invalidRequest(error);
	}
}

function assertBoundRequest(
	trusted: ClientProjectServerRequestContext,
	supplied: ClientProjectServerRequestContext & {readonly repositoryIdentity: Sha256Digest},
	repositoryIdentity: Sha256Digest,
): void {
	assertFrontendRequestContext(trusted, supplied);
	if (supplied.repositoryIdentity !== repositoryIdentity) {
		throw new FrontendApiError(
			"authorization_denied",
			"Frontend repository identity does not match authenticated project.",
		);
	}
}

function assertAppContext(context: ClientProjectServerRequestContext): void {
	assertFrontendRequestContext(context, context);
}

function assertExpectedSnapshot(
	envelope: ClientProjectServerQueryEnvelope,
	actual: Sha256Digest,
): void {
	if (
		envelope.expectedSnapshotDigest !== undefined &&
		envelope.expectedSnapshotDigest !== actual
	) {
		throw new FrontendApiError(
			"stale_snapshot",
			"Frontend query expected snapshot is stale.",
		);
	}
}

function requiredExpectedSnapshot(
	envelope: ClientProjectServerQueryEnvelope,
): Sha256Digest {
	if (!envelope.expectedSnapshotDigest) {
		throw new FrontendApiError(
			"invalid_request",
			"Decision attention query requires expectedSnapshotDigest.",
		);
	}
	return envelope.expectedSnapshotDigest;
}

function decisionAttentionQuery(
	payload: Readonly<Record<string, CanonicalJsonValue>>,
): {readonly filters?: BacklogTriageQueryFilters; readonly orderBy?: TriageOrdering} {
	return payload as {
		readonly filters?: BacklogTriageQueryFilters;
		readonly orderBy?: TriageOrdering;
	};
}

function exactPayload(
	value: Readonly<Record<string, CanonicalJsonValue>>,
	fields: readonly string[],
	label: string,
): Readonly<Record<string, CanonicalJsonValue>> {
	const actual = Object.keys(value).sort(compareText);
	const expected = [...fields].sort(compareText);
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new FrontendApiError("invalid_request", `${label} fields are invalid.`);
	}
	return value;
}

function allowedPayload(
	value: Readonly<Record<string, CanonicalJsonValue>>,
	fields: readonly string[],
	label: string,
): Readonly<Record<string, CanonicalJsonValue>> {
	const allowed = new Set(fields);
	if (Object.keys(value).some((field) => !allowed.has(field))) {
		throw new FrontendApiError("invalid_request", `${label} fields are invalid.`);
	}
	return value;
}

function requestContext(
	value: ClientProjectServerRequestContext,
): ClientProjectServerRequestContext {
	return {
		actor: value.actor,
		client: value.client,
		...(value.delegationRef === undefined
			? {}
			: {delegationRef: value.delegationRef}),
	};
}

function requiredText(value: CanonicalJsonValue | undefined, field: string): string {
	if (typeof value !== "string" || !value.trim() || value.length > 512) {
		throw new FrontendApiError("invalid_request", `Frontend ${field} is invalid.`);
	}
	return value;
}

function invalidRequest(error: unknown): FrontendApiError {
	const message =
		error instanceof Error ? error.message : "Frontend request is invalid.";
	if (/exceeds? .*bytes|payload.*exceed/i.test(message)) {
		return new FrontendApiError(
			"payload_too_large",
			"Frontend request exceeds the payload limit.",
		);
	}
	if (/expired/i.test(message)) {
		return new FrontendApiError("expired", "Frontend command has expired.");
	}
	return new FrontendApiError("invalid_request", message);
}

function frontendFailure(error: unknown): FrontendApiError {
	if (error instanceof FrontendApiError) return error;
	const status = errorStatus(error);
	if (status === 400) {
		return new FrontendApiError("invalid_request", "Project Server rejected the request.");
	}
	if (status === 401) {
		return new FrontendApiError("authentication_required", "Project Server authentication is required.");
	}
	if (status === 403) {
		return new FrontendApiError("authorization_denied", "Project Server denied the request.");
	}
	if (status === 409) {
		return new FrontendApiError("conflict", "Project Server state conflicts with the request.");
	}
	if (status === 429) {
		return new FrontendApiError("rate_limited", "Project Server rate limit was reached.", true);
	}
	if (status === 503 || status === 504) {
		return new FrontendApiError("unavailable", "Project Server is unavailable.", true);
	}
	return new FrontendApiError("internal", "Frontend request failed.");
}

function errorStatus(error: unknown): number | undefined {
	if (!error || typeof error !== "object" || !("status" in error)) return undefined;
	const status = error.status;
	return Number.isInteger(status) ? (status as number) : undefined;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
