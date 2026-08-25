import {
	normalizeClientProjectServerCommand,
	normalizeClientProjectServerOperation,
	normalizeClientProjectServerQuery,
	normalizeClientProjectServerQueryResult,
	type ClientProjectServerCommandEnvelope,
	type ClientProjectServerOperationEnvelope,
	type ClientProjectServerQueryEnvelope,
	type ClientProjectServerQueryResultEnvelope,
} from "../../protocol/client-project-server.ts";

export const CODEWIKI_MCP_NAMESPACE = "codewiki" as const;

export const CODEWIKI_MCP_OPERATIONS = Object.freeze({
	materialQuery: "codewiki.material.query",
	candidateSubmit: "codewiki.candidate.submit",
	operationStatus: "codewiki.operation.status",
	candidateConfirm: "codewiki.candidate.confirm",
	workUnitRead: "codewiki.work_unit.read",
	reviewRead: "codewiki.review.read",
} as const);

export type CodewikiMcpOperationName =
	(typeof CODEWIKI_MCP_OPERATIONS)[keyof typeof CODEWIKI_MCP_OPERATIONS];

export type CodewikiMcpRequest =
	| Readonly<{
			operation: typeof CODEWIKI_MCP_OPERATIONS.materialQuery
				| typeof CODEWIKI_MCP_OPERATIONS.operationStatus
				| typeof CODEWIKI_MCP_OPERATIONS.workUnitRead
				| typeof CODEWIKI_MCP_OPERATIONS.reviewRead;
			envelope: ClientProjectServerQueryEnvelope;
	  }>
	| Readonly<{
			operation: typeof CODEWIKI_MCP_OPERATIONS.candidateSubmit
				| typeof CODEWIKI_MCP_OPERATIONS.candidateConfirm;
			envelope: ClientProjectServerCommandEnvelope;
	  }>;

export type CodewikiMcpResponse =
	| Readonly<{
			operation: CodewikiMcpRequest["operation"];
			kind: "query_result";
			envelope: ClientProjectServerQueryResultEnvelope;
	  }>
	| Readonly<{
			operation: CodewikiMcpRequest["operation"];
			kind: "operation";
			envelope: ClientProjectServerOperationEnvelope;
	  }>;

export interface CodewikiMcpProjectServerPort {
	query(
		operation: Extract<CodewikiMcpRequest, {envelope: ClientProjectServerQueryEnvelope}>["operation"],
		envelope: ClientProjectServerQueryEnvelope,
	): Promise<ClientProjectServerQueryResultEnvelope>;
	command(
		operation: Extract<CodewikiMcpRequest, {envelope: ClientProjectServerCommandEnvelope}>["operation"],
		envelope: ClientProjectServerCommandEnvelope,
	): Promise<ClientProjectServerOperationEnvelope>;
}

export interface CodewikiMcpBinding {
	invoke(value: unknown): Promise<CodewikiMcpResponse>;
}

const QUERY_OPERATIONS = new Set<CodewikiMcpOperationName>([
	CODEWIKI_MCP_OPERATIONS.materialQuery,
	CODEWIKI_MCP_OPERATIONS.operationStatus,
	CODEWIKI_MCP_OPERATIONS.workUnitRead,
	CODEWIKI_MCP_OPERATIONS.reviewRead,
]);

const COMMAND_OPERATIONS = new Set<CodewikiMcpOperationName>([
	CODEWIKI_MCP_OPERATIONS.candidateSubmit,
	CODEWIKI_MCP_OPERATIONS.candidateConfirm,
]);

/**
 * Bind reserved MCP calls to Project Server protocol envelopes. This adapter
 * authenticates no actor, owns no state, and grants no capability: its port
 * must apply ordinary Project Server AuthZ, expected-head, and lifecycle guards.
 */
export function createCodewikiMcpBinding(
	port: CodewikiMcpProjectServerPort,
): CodewikiMcpBinding {
	return Object.freeze({
		async invoke(value: unknown): Promise<CodewikiMcpResponse> {
			const request = normalizeCodewikiMcpRequest(value);
			if (request.envelope.client.clientKind !== "mcp") {
				throw new Error("CodeWiki MCP requests require an MCP Client context.");
			}
			if (request.envelope.kind === "query") {
				const queryRequest = request as Extract<
					CodewikiMcpRequest,
					{envelope: ClientProjectServerQueryEnvelope}
				>;
				const envelope = normalizeClientProjectServerQueryResult(
					await port.query(queryRequest.operation, queryRequest.envelope),
				);
				assertResponseBinding(queryRequest.envelope, envelope);
				return Object.freeze({
					operation: request.operation,
					kind: "query_result" as const,
					envelope,
				});
			}
			const commandRequest = request as Extract<
				CodewikiMcpRequest,
				{envelope: ClientProjectServerCommandEnvelope}
			>;
			const envelope = normalizeClientProjectServerOperation(
				await port.command(commandRequest.operation, commandRequest.envelope),
			);
			assertCommandResponseBinding(commandRequest.envelope, envelope);
			return Object.freeze({
				operation: request.operation,
				kind: "operation" as const,
				envelope,
			});
		},
	});
}

export function normalizeCodewikiMcpRequest(value: unknown): CodewikiMcpRequest {
	if (!isRecord(value) || !hasExactKeys(value, ["operation", "envelope"])) {
		throw new Error("CodeWiki MCP request is invalid.");
	}
	const operation = mcpOperation(value.operation);
	if (QUERY_OPERATIONS.has(operation)) {
		const envelope = normalizeClientProjectServerQuery(value.envelope);
		assertOperationEnvelopeName(operation, envelope.queryName);
		return Object.freeze({operation: operation as Extract<CodewikiMcpRequest, {envelope: ClientProjectServerQueryEnvelope}>["operation"], envelope});
	}
	if (COMMAND_OPERATIONS.has(operation)) {
		const envelope = normalizeClientProjectServerCommand(value.envelope);
		assertOperationEnvelopeName(operation, envelope.commandName);
		return Object.freeze({operation: operation as Extract<CodewikiMcpRequest, {envelope: ClientProjectServerCommandEnvelope}>["operation"], envelope});
	}
	throw new Error("CodeWiki MCP operation is unsupported.");
}

function mcpOperation(value: unknown): CodewikiMcpOperationName {
	if (typeof value !== "string" || !value.startsWith(`${CODEWIKI_MCP_NAMESPACE}.`)) {
		throw new Error("CodeWiki MCP operation must use the reserved codewiki namespace.");
	}
	const operations = Object.values(CODEWIKI_MCP_OPERATIONS) as string[];
	if (!operations.includes(value)) throw new Error("CodeWiki MCP operation is unsupported.");
	return value as CodewikiMcpOperationName;
}

function assertOperationEnvelopeName(operation: string, envelopeName: string): void {
	if (operation !== envelopeName) {
		throw new Error("CodeWiki MCP operation does not match its protocol envelope.");
	}
}

function assertResponseBinding(
	request: ClientProjectServerQueryEnvelope,
	response: ClientProjectServerQueryResultEnvelope,
): void {
	if (
		response.transportRequestId !== request.transportRequestId ||
		response.repositoryIdentity !== request.repositoryIdentity ||
		response.queryName !== request.queryName
	) {
		throw new Error("CodeWiki MCP query response does not bind its exact request.");
	}
}

function assertCommandResponseBinding(
	request: ClientProjectServerCommandEnvelope,
	response: ClientProjectServerOperationEnvelope,
): void {
	if (
		response.repositoryIdentity !== request.repositoryIdentity ||
		response.actorId !== request.actor.actorId ||
		response.commandName !== request.commandName
	) {
		throw new Error("CodeWiki MCP operation response does not bind its exact request.");
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const actual = Object.keys(value).sort((left, right) =>
		left.localeCompare(right),
	);
	const keys = [...expected].sort((left, right) => left.localeCompare(right));
	return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}
