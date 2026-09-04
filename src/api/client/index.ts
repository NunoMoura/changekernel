import type {
	AlignmentReadInput,
	AuditReadInput,
	ChangesReadInput,
	ChecksReadInput,
	ProductReadInput,
	ProductReadOperation,
	ProjectSourceSelector,
	ReviewReadInput,
	WikiReadInput,
	WorkReadInput,
} from "../contracts/read.ts";
import {
	PRODUCT_CLIENT_KINDS,
	createProductTransportRequest,
	decodeProductTransportResponse,
	productError,
	type ProductAuthentication,
	type ProductClientIdentity,
	type ProductError,
} from "../transport/envelope.ts";
import {isNamespacedIdentifier} from "../../kernel/canonical/contract.ts";
import type {CanonicalValue} from "../../kernel/canonical/json.ts";
import {failure, success, type Outcome} from "../../kernel/canonical/outcome.ts";

export interface ProductTransport {
	send(request: unknown): Promise<unknown>;
}

export interface ProductClientInput {
	readonly repositoryId: string;
	readonly transport: ProductTransport;
	readonly client: ProductClientIdentity;
	readonly authentication: ProductAuthentication;
}

export interface ProductCallOptions {
	readonly requestId: string;
	readonly expiresAt: string;
}

export type ProjectStatusCall = Readonly<{source: ProjectSourceSelector}> & ProductCallOptions;
export type WikiReadCall = WikiReadInput & ProductCallOptions;
export type ChangesReadCall = ChangesReadInput & ProductCallOptions;
export type ChecksReadCall = ChecksReadInput & ProductCallOptions;
export type WorkReadCall = WorkReadInput & ProductCallOptions;
export type ReviewReadCall = ReviewReadInput & ProductCallOptions;
export type AlignmentReadCall = AlignmentReadInput & ProductCallOptions;
export type AuditReadCall = AuditReadInput & ProductCallOptions;

export interface CodewikiClient {
	discover(options: ProductCallOptions): Promise<Outcome<CanonicalValue, ProductError>>;
	capabilities(options: ProductCallOptions): Promise<Outcome<CanonicalValue, ProductError>>;
	status(request: ProjectStatusCall): Promise<Outcome<CanonicalValue, ProductError>>;
	wiki(request: WikiReadCall): Promise<Outcome<CanonicalValue, ProductError>>;
	changes(request: ChangesReadCall): Promise<Outcome<CanonicalValue, ProductError>>;
	checks(request: ChecksReadCall): Promise<Outcome<CanonicalValue, ProductError>>;
	work(request: WorkReadCall): Promise<Outcome<CanonicalValue, ProductError>>;
	review(request: ReviewReadCall): Promise<Outcome<CanonicalValue, ProductError>>;
	alignment(request: AlignmentReadCall): Promise<Outcome<CanonicalValue, ProductError>>;
	audit(request: AuditReadCall): Promise<Outcome<CanonicalValue, ProductError>>;
}

export function createCodewikiClient(input: ProductClientInput): Outcome<CodewikiClient, ProductError> {
	if (!validClientInput(input)) return failure(productError(
		"invalid_request",
		"Client identity or sign-in proof is invalid.",
		"Create the Client again with a valid signed-in identity.",
		true,
	));
	const repositoryId = input.repositoryId;
	const clientIdentity = Object.freeze({kind: input.client.kind, instanceId: input.client.instanceId});
	const authentication = Object.freeze({identityRef: input.authentication.identityRef, proof: input.authentication.proof});
	const send = input.transport.send.bind(input.transport);
	const invoke = async (
		operation: ProductReadOperation,
		payload: ProductReadInput,
		options: ProductCallOptions,
	): Promise<Outcome<CanonicalValue, ProductError>> => {
		const request = createProductTransportRequest({
			requestId: options.requestId,
			repositoryId,
			client: clientIdentity,
			authentication,
			expiresAt: options.expiresAt,
			operation,
			input: payload,
		});
		if (!request.ok) return failure(productError(
			"invalid_request",
			"The requested action is malformed.",
			"Correct the action fields and retry.",
			false,
		));
		let rawResponse: unknown;
		try {
			rawResponse = await send(request.value);
		} catch {
			return failure(transportError());
		}
		const response = decodeProductTransportResponse(rawResponse);
		if (!response.ok || response.value.requestId !== request.value.requestId ||
			response.value.requestDigest !== request.value.requestDigest || response.value.operation !== operation) {
			return failure(transportError());
		}
		if (response.value.status === "error") {
			if (response.value.error === null) return failure(transportError());
			return failure(response.value.error);
		}
		if (response.value.data === null) return failure(transportError());
		return success(response.value.data);
	};
	const client: CodewikiClient = Object.freeze({
		discover: (options: ProductCallOptions) => invoke("project.discover", Object.freeze({}), options),
		capabilities: (options: ProductCallOptions) => invoke("project.capabilities", Object.freeze({}), options),
		status: (request: ProjectStatusCall) => invoke("project.status", Object.freeze({source: request.source}), request),
		wiki: (request: WikiReadCall) => invoke("wiki.read", withoutCallOptions(request), request),
		changes: (request: ChangesReadCall) => invoke("changes.read", withoutCallOptions(request), request),
		checks: (request: ChecksReadCall) => invoke("checks.read", withoutCallOptions(request), request),
		work: (request: WorkReadCall) => invoke("work.read", withoutCallOptions(request), request),
		review: (request: ReviewReadCall) => invoke("review.read", withoutCallOptions(request), request),
		alignment: (request: AlignmentReadCall) => invoke("alignment.read", withoutCallOptions(request), request),
		audit: (request: AuditReadCall) => invoke("audit.read", withoutCallOptions(request), request),
	});
	return success(client);
}

function withoutCallOptions<Request extends ProductReadInput & ProductCallOptions>(request: Request): ProductReadInput {
	const {requestId: _requestId, expiresAt: _expiresAt, ...input} = request;
	return Object.freeze(input) as ProductReadInput;
}

function validClientInput(input: ProductClientInput): boolean {
	return typeof input === "object" && input !== null && isNamespacedIdentifier(input.repositoryId) &&
		typeof input.transport === "object" && input.transport !== null &&
		typeof input.transport.send === "function" && typeof input.client === "object" && input.client !== null &&
		PRODUCT_CLIENT_KINDS.includes(input.client.kind) && isNamespacedIdentifier(input.client.instanceId) &&
		typeof input.authentication === "object" && input.authentication !== null &&
		isNamespacedIdentifier(input.authentication.identityRef) && typeof input.authentication.proof === "string" &&
		input.authentication.proof.length > 0 && new TextEncoder().encode(input.authentication.proof).byteLength <= 4_096 &&
		input.authentication.proof.normalize("NFC") === input.authentication.proof && !input.authentication.proof.includes("\0");
}

function transportError(): ProductError {
	return productError(
		"transport_unavailable",
		"The Project service response could not be verified.",
		"Retry after the Project service is available.",
		false,
	);
}
