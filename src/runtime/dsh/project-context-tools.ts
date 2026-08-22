import type {Context} from "@deepseek-ai/cordis";
import {defineTool, type JsonValue} from "@deepseek-ai/dsh-tools";

import {
	createProjectContextFacade,
	type ProjectContextFacade,
	type ProjectContextQueryInput,
} from "../context/project-context-query.ts";
import type {ProjectContextQueryRequest, ProjectContextSnapshot} from "../contracts.ts";
import type {ExecutionLedgerEntryInput} from "../evidence/execution-ledger.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const DSH_PROJECT_CONTEXT_TOOL_SET_VERSION = "1.0.0" as const;
export const DSH_PROJECT_CONTEXT_BATCH_QUERY_TOOL = "query_project_context_batch" as const;
export const DSH_PROJECT_CONTEXT_TOOL_OUTPUT_MAX_BYTES = 4 * 1_024 * 1_024;

const DIRECT_TOOLS = Object.freeze([
	{service: "knowledge", name: "query_project_knowledge", operations: ["subject", "facet", "search", "list"]},
	{service: "alignment", name: "query_project_alignment", operations: ["neighbors", "impact", "delivery_chain", "contradictions"]},
	{service: "project_state", name: "query_project_state", operations: ["change", "work_unit", "readiness", "active_changes"]},
	{service: "repository", name: "query_project_repository", operations: ["file", "tree", "search", "ownership"]},
	{service: "evidence", name: "query_project_evidence", operations: ["by_subject", "by_check", "artifact"]},
	{service: "result", name: "query_project_results", operations: ["by_subject", "by_gate", "result"]},
	{service: "change_delta", name: "discover_change_delta", operations: ["discover"]},
] as const);

const SERVICE_VALUES = DIRECT_TOOLS.map((tool) => tool.service);
const COMMON_QUERY_PARAMETERS = Object.freeze({
	operation: {
		type: "string" as const,
		required: true as const,
		description: "Closed operation supported by this typed Project Context service.",
	},
	arguments: {
		type: "json" as const,
		required: true as const,
		description: "Lossless JSON arguments selecting one pre-admitted request.",
	},
	limit: {
		type: "integer" as const,
		required: true as const,
		description: "Maximum returned items, from 1 through 1024.",
	},
	cursor: {
		type: "string" as const,
		description: "Opaque next cursor from a previous matching snapshot query.",
	},
});
const BATCH_QUERY_PARAMETERS = Object.freeze({
	queries: {
		type: "array" as const,
		required: true as const,
		description: "One through 64 typed Project Context queries.",
		items: {
			type: "object" as const,
			additionalProperties: false,
			properties: {
				service: {type: "string" as const, enum: SERVICE_VALUES, required: true as const},
				...COMMON_QUERY_PARAMETERS,
			},
		},
	},
});
const QUERY_OUTPUT = Object.freeze({
	schema: {type: "json" as const},
	render: (_arguments: unknown, value: unknown) => [
		{type: "text" as const, text: canonicalJson(value)},
	],
});

export const DSH_PROJECT_CONTEXT_TOOL_SET_DIGEST: Sha256Digest = canonicalJsonDigest({
	version: DSH_PROJECT_CONTEXT_TOOL_SET_VERSION,
	limits: {maximumOutputBytes: DSH_PROJECT_CONTEXT_TOOL_OUTPUT_MAX_BYTES, maximumBatchQueries: 64, maximumItemsPerQuery: 1_024},
	tools: [
		...DIRECT_TOOLS.map((tool) => ({name: tool.name, service: tool.service, operations: tool.operations})),
		{name: DSH_PROJECT_CONTEXT_BATCH_QUERY_TOOL, services: SERVICE_VALUES},
	],
});

export interface DshProjectContextToolRegistrationOptions {
	readonly context: Context;
	readonly snapshot: ProjectContextSnapshot;
	readonly maxToolCalls: number;
	readonly record: (entry: ExecutionLedgerEntryInput) => void;
	readonly now?: () => string;
}

export interface DshProjectContextToolRegistration {
	readonly toolSetDigest: Sha256Digest;
	readonly facade: ProjectContextFacade;
	readonly calls: () => number;
	dispose(): void;
}

export function registerDshProjectContextTools(
	options: DshProjectContextToolRegistrationOptions,
): Readonly<DshProjectContextToolRegistration> {
	if (!Number.isSafeInteger(options.maxToolCalls) || options.maxToolCalls < 1) {
		throw new Error("DSH Project Context tools require a positive tool-call budget.");
	}
	const facade = createProjectContextFacade(options.snapshot);
	const now = options.now ?? (() => new Date().toISOString());
	let calls = 0;
	const admit = (): void => {
		calls += 1;
		if (calls > options.maxToolCalls) throw new Error("DSH Project Context tool-call budget is exhausted.");
	};
	const record = (
		kind: ExecutionLedgerEntryInput["kind"],
		modelVisible: boolean,
		payload: unknown,
	): void => options.record({kind, occurredAt: now(), modelVisible, payload});
	const executeQuery = (
		name: string,
		callId: string,
		argumentsValue: unknown,
		run: () => unknown,
	): JsonValue => {
		record("tool-call", true, {callId, name, snapshotDigest: options.snapshot.snapshotDigest, arguments: argumentsValue});
		try {
			admit();
			const outcome = run();
			record("project-context-query", false, outcome);
			const output = toolOutput(outcome);
			record("tool-result", true, {callId, name, output});
			return output;
		} catch (error) {
			record("tool-result", true, {
				callId,
				name,
				error: error instanceof Error ? error.message : "Unknown Project Context tool failure.",
			});
			throw error;
		}
	};
	const disposers = DIRECT_TOOLS.map((tool) => options.context.tools.register(defineTool({
		name: tool.name,
		description: `Query the mounted ${tool.service} Project Context service. No live project access occurs.`,
		parameters: {
			...COMMON_QUERY_PARAMETERS,
			operation: {...COMMON_QUERY_PARAMETERS.operation, enum: tool.operations},
		},
		output: QUERY_OUTPUT,
		async execute(argumentsValue, execution) {
			const input = directInput(tool.service, argumentsValue);
			return executeQuery(tool.name, execution.callId, input, () => queryFacade(facade, input));
		},
	})));
	const disposeBatch = options.context.tools.register(defineTool({
		name: DSH_PROJECT_CONTEXT_BATCH_QUERY_TOOL,
		description: "Execute one through 64 typed local Project Context queries. No live project access occurs.",
		parameters: BATCH_QUERY_PARAMETERS,
		output: QUERY_OUTPUT,
		async execute(argumentsValue, execution) {
			const inputs = argumentsValue.queries.map(batchInput);
			return executeQuery(
				DSH_PROJECT_CONTEXT_BATCH_QUERY_TOOL,
				execution.callId,
				{queries: inputs},
				() => facade.batch(inputs),
			);
		},
	}));
	let disposed = false;
	return Object.freeze({
		toolSetDigest: DSH_PROJECT_CONTEXT_TOOL_SET_DIGEST,
		facade,
		calls: () => calls,
		dispose: () => {
			if (disposed) return;
			disposed = true;
			disposeBatch();
			for (const dispose of disposers.reverse()) dispose();
		},
	});
}

function directInput(
	service: ProjectContextQueryRequest["service"],
	value: {readonly operation: string; readonly arguments: unknown; readonly limit: number; readonly cursor?: string},
): ProjectContextQueryInput {
	return Object.freeze({
		request: queryRequest(service, value.operation, value.arguments),
		limit: value.limit,
		cursor: value.cursor ?? null,
	});
}

function batchInput(value: {
	readonly service: string;
	readonly operation: string;
	readonly arguments: unknown;
	readonly limit: number;
	readonly cursor?: string;
}): ProjectContextQueryInput {
	if (!SERVICE_VALUES.includes(value.service as ProjectContextQueryRequest["service"])) {
		throw new Error("Project Context batch query service is invalid.");
	}
	return directInput(value.service as ProjectContextQueryRequest["service"], value);
}

function queryRequest(
	service: ProjectContextQueryRequest["service"],
	operation: string,
	argumentsValue: unknown,
): ProjectContextQueryRequest {
	const tool = DIRECT_TOOLS.find((entry) => entry.service === service);
	if (!tool || !tool.operations.includes(operation as never)) {
		throw new Error("Project Context service operation is invalid.");
	}
	// SAFETY: service and operation membership in DIRECT_TOOLS proves the discriminated union pair.
	return {service, operation, arguments: toCanonicalJsonValue(argumentsValue)} as ProjectContextQueryRequest;
}

function queryFacade(
	facade: ProjectContextFacade,
	input: ProjectContextQueryInput,
) {
	const result = facade.batch([input]).results[0];
	if (!result) throw new Error("Project Context direct query returned no result.");
	return result;
}

function toolOutput(value: unknown): JsonValue {
	const canonical = toCanonicalJsonValue(value);
	if (Buffer.byteLength(canonicalJson(canonical)) > DSH_PROJECT_CONTEXT_TOOL_OUTPUT_MAX_BYTES) {
		throw new Error("DSH Project Context tool result exceeds its byte limit.");
	}
	return structuredClone(canonical) as JsonValue;
}
