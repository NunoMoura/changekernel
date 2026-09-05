import {decodeProductCommandInput, PRODUCT_COMMAND_OPERATIONS, type ProductCommandOperation} from "../api/contracts/command.ts";
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
} from "../api/contracts/read.ts";
import {decodeProductReadInput} from "../api/contracts/read.ts";
import {
	createProductTransportResponse,
	decodeProductTransportRequest,
	productError,
	type ProductError,
	type ProductTransportRequest,
	type ProductTransportResponse,
} from "../api/transport/envelope.ts";
import {isNamespacedIdentifier, protocolIdentity} from "../kernel/canonical/contract.ts";
import {isCanonicalObject, type CanonicalValue} from "../kernel/canonical/json.ts";
import {failure, success, type Outcome} from "../kernel/canonical/outcome.ts";
import {decodeGitRef, type GitObjectFormat, type GitRef} from "../kernel/identity/git.ts";
import {decodeSha256Digest, type Sha256Digest} from "../kernel/identity/sha256.ts";
import {CHANGE_TRACE_PROTOCOL, MAX_TRACE_BYTES} from "../kernel/changes/trace.ts";
import {MAXIMUM_WIKI_FILE_BYTES} from "../kernel/wiki/file.ts";
import {WIKI_ITEM_PROTOCOL} from "../kernel/wiki/item.ts";
import {MAXIMUM_WIKI_ITEMS, MAXIMUM_WIKI_TOTAL_BYTES} from "../kernel/wiki/tree.ts";
import {AGENT_RUNTIME_PORT_PROTOCOL, type AgentRuntimePort} from "../ports/agent-runtime.ts";
import {CHECK_RUNNER_PORT_PROTOCOL, type CheckRunnerPort} from "../ports/check-runner.ts";
import {PREVIEW_PORT_PROTOCOL, type PreviewPort} from "../ports/preview.ts";
import {PROJECT_STORE_PORT_PROTOCOL, type ProjectStorePort} from "../ports/project-store.ts";
import {
	PROJECT_ACCESS_POLICY_PROTOCOL,
	type AuthorizedProjectActor,
	type ProjectAccessPolicy,
} from "./authorization/policy.ts";
import {
	discoverProject,
	readAlignment,
	readAudit,
	readChanges,
	readChecks,
	readProjectCapabilities,
	readProjectStatus,
	readReview,
	readWork,
} from "./queries/project.ts";
import {executeLifecycleCommand, type ProtectedEffectConfiguration} from "./commands/lifecycle.ts";
import {PROJECT_SERVER_FACTS_PROTOCOL, type ProjectServerFactsPort} from "./recovery/facts.ts";
import {executeWikiRead} from "./queries/wiki.ts";
import {
	resolveProjectSource,
	type ProjectReadConfiguration,
	type ProjectReadLimits,
	type ProjectSourceIssue,
} from "./queries/source.ts";

export const PROJECT_SERVER_FOUNDATION_PROTOCOL = protocolIdentity("codewiki.project-server-foundation", "1.3.0");
export const PROJECT_SERVER_PROTOCOL = protocolIdentity("codewiki.project-server", "1.2.0");

export interface ProjectServerPorts {
	readonly projectStore: ProjectStorePort;
	readonly checkRunner: CheckRunnerPort;
	readonly facts: ProjectServerFactsPort;
	readonly agentRuntime: AgentRuntimePort;
	readonly preview?: PreviewPort;
}

export interface ProjectServerFoundation {
	readonly protocol: typeof PROJECT_SERVER_FOUNDATION_PROTOCOL;
	readonly capabilities: Readonly<{
		projectStore: "available";
		checkRunner: "available";
		facts: "available";
		agentRuntime: "available";
		preview: "available" | "unavailable";
	}>;
}

export interface ProjectServerProject {
	readonly projectName: string;
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly canonicalRef: GitRef;
	readonly kernelBuildDigest: Sha256Digest;
	readonly retiredWikiItemIds: readonly string[];
}

export interface ProjectServerInput {
	readonly ports: ProjectServerPorts;
	readonly accessPolicy: ProjectAccessPolicy;
	readonly project: ProjectServerProject;
	readonly limits?: Partial<ProjectReadLimits>;
	readonly maximumReplayEntries?: number;
	readonly protectedEffects?: readonly ProtectedEffectConfiguration[];
	readonly clock?: () => string;
}

export interface ProjectServer {
	readonly protocol: typeof PROJECT_SERVER_PROTOCOL;
	handle(input: unknown): Promise<unknown>;
}

export interface ProjectServerBindingFailure {
	readonly code: "invalid_access_policy" | "invalid_configuration" | "invalid_port_protocol";
	readonly field: string;
	readonly message: string;
}

const DEFAULT_LIMITS: ProjectReadLimits = Object.freeze({
	maximumWikiItems: MAXIMUM_WIKI_ITEMS,
	maximumWikiFileBytes: MAXIMUM_WIKI_FILE_BYTES,
	maximumWikiTotalBytes: MAXIMUM_WIKI_TOTAL_BYTES,
	maximumChangeTraces: 1_024,
	maximumTraceBytes: MAX_TRACE_BYTES,
	maximumHistoryCommits: 64,
	maximumHistoryBytes: 32 * 1024 * 1024,
});

function protectedEffectConfiguration(
	input: readonly ProtectedEffectConfiguration[],
): Outcome<readonly ProtectedEffectConfiguration[], ProjectServerBindingFailure> {
	if (!Array.isArray(input) || input.length > 64) {
		return failure(bindingFailure("invalid_configuration", "protectedEffects", "Protected effects must be a bounded array."));
	}
	const capabilities = new Set<string>();
	const refs = new Set<string>();
	const output: ProtectedEffectConfiguration[] = [];
	for (let index = 0; index < input.length; index += 1) {
		const entry = input[index];
		if (typeof entry !== "object" || entry === null || !hasOnlyKeys(entry, ["capability", "ref", "actorIds"]) ||
			!isNamespacedIdentifier(entry.capability) || !decodeGitRef(entry.ref).ok || !entry.ref.startsWith("refs/codewiki/effects/") ||
			!Array.isArray(entry.actorIds) || entry.actorIds.length === 0 || entry.actorIds.length > 256 ||
			entry.actorIds.some((actorId: string) => !isNamespacedIdentifier(actorId)) ||
			new Set(entry.actorIds).size !== entry.actorIds.length || capabilities.has(entry.capability) || refs.has(entry.ref)) {
			return failure(bindingFailure("invalid_configuration", `protectedEffects[${index}]`, "Protected effect authority is malformed or duplicated."));
		}
		capabilities.add(entry.capability);
		refs.add(entry.ref);
		output.push(Object.freeze({
			capability: entry.capability,
			ref: entry.ref,
			actorIds: Object.freeze([...entry.actorIds].sort(compareText)),
		}));
	}
	return success(Object.freeze(output.sort((left, right) => compareText(left.capability, right.capability))));
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function systemTimestamp(): string {
	return new Date(Math.floor(Date.now() / 1_000) * 1_000).toISOString().replace(".000Z", "Z");
}

/** Binds the qualified internal ports while keeping unavailable capabilities explicit. */
export function bindProjectServerFoundation(
	ports: ProjectServerPorts,
): Outcome<ProjectServerFoundation, ProjectServerBindingFailure> {
	if (typeof ports !== "object" || ports === null || !hasOnlyKeys(ports, ["projectStore", "checkRunner", "facts", "agentRuntime", "preview"]) ||
		typeof ports.projectStore !== "object" || ports.projectStore === null ||
		!sameProtocol(ports.projectStore.protocol, PROJECT_STORE_PORT_PROTOCOL) ||
		!hasMethods(ports.projectStore, ["readSnapshot", "readBlob", "readTree", "writeBlob", "writeTree", "createCommit", "compareAndSwapRefs"])) {
		return failure(bindingFailure("invalid_port_protocol", "projectStore", `projectStore must bind ${PROJECT_STORE_PORT_PROTOCOL.id}@${PROJECT_STORE_PORT_PROTOCOL.version}.`));
	}
	if (typeof ports.checkRunner !== "object" || ports.checkRunner === null ||
		!sameProtocol(ports.checkRunner.protocol, CHECK_RUNNER_PORT_PROTOCOL) || !hasMethods(ports.checkRunner, ["run"])) {
		return failure(bindingFailure("invalid_port_protocol", "checkRunner", `checkRunner must bind ${CHECK_RUNNER_PORT_PROTOCOL.id}@${CHECK_RUNNER_PORT_PROTOCOL.version}.`));
	}
	if (typeof ports.facts !== "object" || ports.facts === null ||
		!sameProtocol(ports.facts.protocol, PROJECT_SERVER_FACTS_PROTOCOL) || !hasMethods(ports.facts, ["readGateBundle", "writeGateBundle"])) {
		return failure(bindingFailure("invalid_port_protocol", "facts", `facts must bind ${PROJECT_SERVER_FACTS_PROTOCOL.id}@${PROJECT_SERVER_FACTS_PROTOCOL.version}.`));
	}
	if (typeof ports.agentRuntime !== "object" || ports.agentRuntime === null ||
		!sameProtocol(ports.agentRuntime.protocol, AGENT_RUNTIME_PORT_PROTOCOL) || !hasMethods(ports.agentRuntime, ["start", "inspect", "cancel"])) {
		return failure(bindingFailure("invalid_port_protocol", "agentRuntime", `agentRuntime must bind ${AGENT_RUNTIME_PORT_PROTOCOL.id}@${AGENT_RUNTIME_PORT_PROTOCOL.version}.`));
	}
	let previewCapability: "available" | "unavailable" = "unavailable";
	if (ports.preview !== undefined) {
		if (typeof ports.preview !== "object" || ports.preview === null ||
			!sameProtocol(ports.preview.protocol, PREVIEW_PORT_PROTOCOL) || !hasMethods(ports.preview, ["observe"])) {
			return failure(bindingFailure("invalid_port_protocol", "preview", `preview must bind ${PREVIEW_PORT_PROTOCOL.id}@${PREVIEW_PORT_PROTOCOL.version}.`));
		}
		previewCapability = "available";
	}
	return success(Object.freeze({
		protocol: PROJECT_SERVER_FOUNDATION_PROTOCOL,
		capabilities: Object.freeze({
			projectStore: "available" as const,
			checkRunner: "available" as const,
			facts: "available" as const,
			agentRuntime: "available" as const,
			preview: previewCapability,
		}),
	}));
}

export function createProjectServer(
	input: ProjectServerInput,
): Outcome<ProjectServer, ProjectServerBindingFailure> {
	if (typeof input !== "object" || input === null ||
		!hasOnlyKeys(input, ["ports", "accessPolicy", "project", "limits", "maximumReplayEntries", "protectedEffects", "clock"])) {
		return failure(bindingFailure("invalid_configuration", "$", "Project Server input is malformed."));
	}
	const foundation = bindProjectServerFoundation(input.ports);
	if (!foundation.ok) return foundation;
	if (typeof input.accessPolicy !== "object" || input.accessPolicy === null ||
		!sameProtocol(input.accessPolicy.protocol, PROJECT_ACCESS_POLICY_PROTOCOL) || !hasMethods(input.accessPolicy, ["authorize"])) {
		return failure(bindingFailure("invalid_access_policy", "accessPolicy", "Project access policy is invalid."));
	}
	const configuration = projectConfiguration(input.project, input.limits);
	if (!configuration.ok) return configuration;
	const protectedEffects = protectedEffectConfiguration(input.protectedEffects ?? []);
	if (!protectedEffects.ok) return protectedEffects;
	if (input.clock !== undefined && typeof input.clock !== "function") {
		return failure(bindingFailure("invalid_configuration", "clock", "Project Server clock must be callable."));
	}
	const maximumReplayEntries = input.maximumReplayEntries ?? 1_024;
	if (!Number.isSafeInteger(maximumReplayEntries) || maximumReplayEntries < 1 || maximumReplayEntries > 10_000) {
		return failure(bindingFailure("invalid_configuration", "maximumReplayEntries", "Replay bound must be an integer from 1 to 10000."));
	}
	const replay = new Map<string, Readonly<{requestDigest: Sha256Digest; response: ProductTransportResponse}>>();
	const accessPolicy = input.accessPolicy;
	const projectStore = input.ports.projectStore;
	const commandOperations = new Set<ProductCommandOperation>(PRODUCT_COMMAND_OPERATIONS);
	const now = input.clock ?? systemTimestamp;
	const server = Object.freeze({
		protocol: PROJECT_SERVER_PROTOCOL,
		async handle(raw: unknown): Promise<unknown> {
			const request = decodeProductTransportRequest(raw);
			if (!request.ok) return responseFor(invalidEnvelopeRequest(), failure(productError(
				"invalid_request",
				"The Project request is malformed.",
				"Refresh the action and retry.",
				false,
			)));
			try {
				const actor = accessPolicy.authorize(request.value);
				if (!actor.ok) return responseFor(request.value, actor);
				if (request.value.repositoryId !== configuration.value.repositoryId) return responseFor(request.value, failure(productError(
					"source_not_found",
					"The requested Project is not available through this service.",
					"Choose the configured Project and retry.",
					false,
				)));
				const replayed = replayResponse(replay, actor.value, request.value);
				if (replayed !== null) return replayed;
				let response: unknown;
				if (commandOperations.has(request.value.operation as ProductCommandOperation)) {
					const decoded = decodeProductCommandInput(request.value.operation as ProductCommandOperation, request.value.input);
					if (!decoded.ok) return responseFor(request.value, failure(productError(
						"invalid_request",
						"The lifecycle action is malformed.",
						"Correct the bounded action fields and retry.",
						false,
					)));
					const outcome = await executeLifecycleCommand({
						store: projectStore,
						checkRunner: input.ports.checkRunner,
						facts: input.ports.facts,
						configuration: configuration.value,
						committer: Object.freeze({name: "CodeWiki Project Server", email: "codewiki@localhost"}),
						maximumTreeEntries: 65_536,
						now,
						protectedEffects: protectedEffects.value,
					}, actor.value, request.value.operation as ProductCommandOperation, decoded.value);
					response = outcome.ok
						? responseFor(request.value, success(outcome.value.data), outcome.value.binding)
						: responseFor(request.value, outcome);
				} else {
					const decodedInput = decodeProductReadInput(request.value.operation as ProductReadOperation, request.value.input);
					if (!decodedInput.ok) return responseFor(request.value, failure(productError(
						"invalid_request",
						"The Project read is malformed.",
						"Correct the read fields and retry.",
						false,
					)));
					const prepared = await prepareRead(projectStore, configuration.value, actor.value, request.value, decodedInput.value);
					if (!prepared.ok) return responseFor(request.value, prepared);
					const outcome = await executeRead(projectStore, configuration.value, actor.value, request.value, prepared.value.input);
					const split = splitReadOutcome(outcome);
					response = responseFor(request.value, split.outcome, responseBinding(prepared.value.binding, split.outcome, split.technicalEvidence));
				}
				if (isTransportResponse(response)) rememberResponse(replay, maximumReplayEntries, actor.value, request.value, response);
				return response;
			} catch {
				return responseFor(request.value, failure(productError(
					"internal_failure",
					"The Project service could not complete this request safely.",
					"Retry after the Project service is healthy.",
					false,
				)));
			}
		},
	});
	return success(server);
}

async function executeRead(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	request: ProductTransportRequest,
	input: ProductReadInput,
): Promise<Outcome<unknown, ProductError>> {
	switch (request.operation) {
		case "project.discover":
			return success(discoverProject(configuration));
		case "project.capabilities":
			return success(readProjectCapabilities(actor));
		case "project.status":
			return readProjectStatus(store, configuration, actor, (input as Readonly<{source: ProjectSourceSelector}>).source);
		case "wiki.read":
			return executeWikiRead(store, configuration, actor, input as WikiReadInput);
		case "changes.read":
			return readChanges(store, configuration, actor, input as ChangesReadInput);
		case "checks.read":
			return readChecks(store, configuration, actor, input as ChecksReadInput);
		case "work.read":
			return readWork(store, configuration, actor, input as WorkReadInput);
		case "review.read":
			return readReview(store, configuration, actor, input as ReviewReadInput);
		case "alignment.read":
			return readAlignment(store, configuration, actor, input as AlignmentReadInput);
		case "audit.read":
			return readAudit(store, configuration, actor, input as AuditReadInput);
		default:
			return failure(productError("invalid_request", "The Project read is unsupported.", "Choose an available read and retry.", false));
	}
}

interface PreparedRead {
	readonly input: ProductReadInput;
	readonly binding: CanonicalValue;
}

async function prepareRead(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	request: ProductTransportRequest,
	input: ProductReadInput,
): Promise<Outcome<PreparedRead, ProductError>> {
	const baseBinding = Object.freeze({
		repositoryId: configuration.repositoryId,
		operation: request.operation,
		authorization: Object.freeze({
			authorizationId: actor.authorizationId,
			wiki: actor.wikiItemIds === null ? "all" : "filtered",
			changes: actor.changeIds === null ? "all" : "filtered",
		}),
		derivation: Object.freeze({kernelBuildDigest: configuration.kernelBuildDigest}),
		interpretation: Object.freeze({
			changeTrace: Object.freeze({id: CHANGE_TRACE_PROTOCOL.id, version: CHANGE_TRACE_PROTOCOL.version}),
			wikiItem: WIKI_ITEM_PROTOCOL,
		}),
	});
	if (request.operation === "project.discover" || request.operation === "project.capabilities") {
		return success(Object.freeze({
			input,
			binding: Object.freeze({
				...baseBinding,
				source: null,
				freshness: "configuration",
				ordering: "fixed",
				bounds: Object.freeze({operation: Object.freeze({}), project: canonicalMetadata(configuration.limits)}),
			}),
		}));
	}
	const sourceInput = input as Readonly<{source: ProjectSourceSelector}>;
	const snapshot = await resolveProjectSource(store, configuration, sourceInput.source);
	if (!snapshot.ok) return failure(sourceError(snapshot.error));
	const exactSource = Object.freeze({kind: "commit" as const, commit: snapshot.value.commit});
	let preparedInput = Object.freeze({...sourceInput, source: exactSource}) as ProductReadInput;
	let baseline: CanonicalValue = null;
	if (request.operation === "wiki.read" && (input as WikiReadInput).view === "diff") {
		const diff = input as Extract<WikiReadInput, Readonly<{view: "diff"}>>;
		const baselineSnapshot = await resolveProjectSource(store, configuration, diff.baselineSource);
		if (!baselineSnapshot.ok) return failure(sourceError(baselineSnapshot.error));
		preparedInput = Object.freeze({...diff, source: exactSource, baselineSource: Object.freeze({kind: "commit" as const, commit: baselineSnapshot.value.commit})});
		baseline = canonicalMetadata(baselineSnapshot.value);
	}
	return success(Object.freeze({
		input: preparedInput,
		binding: Object.freeze({
			...baseBinding,
			source: canonicalMetadata(snapshot.value),
			baseline,
			freshness: "exact",
			ordering: operationOrdering(request.operation, input),
			bounds: Object.freeze({operation: operationBounds(input), project: canonicalMetadata(configuration.limits)}),
		}),
	}));
}

interface SplitReadOutcome {
	readonly outcome: Outcome<unknown, ProductError>;
	readonly technicalEvidence: CanonicalValue;
}

function splitReadOutcome(outcome: Outcome<unknown, ProductError>): SplitReadOutcome {
	if (!outcome.ok || typeof outcome.value !== "object" || outcome.value === null ||
		!("presentation" in outcome.value) || !("technicalEvidence" in outcome.value)) {
		return Object.freeze({outcome, technicalEvidence: null});
	}
	const wrapped = outcome.value as Readonly<{presentation: unknown; technicalEvidence: unknown}>;
	return Object.freeze({
		outcome: success(wrapped.presentation),
		technicalEvidence: canonicalMetadata(wrapped.technicalEvidence),
	});
}

function responseBinding(
	binding: CanonicalValue,
	outcome: Outcome<unknown, ProductError>,
	technicalEvidence: CanonicalValue,
): CanonicalValue {
	if (!isCanonicalObject(binding) || !outcome.ok || typeof outcome.value !== "object" || outcome.value === null) return binding;
	const value = outcome.value as Readonly<Record<string, unknown>>;
	return Object.freeze({
		...binding,
		coverage: value.coverage === undefined
			? Object.freeze({complete: true})
			: canonicalMetadata(value.coverage),
		truncation: value.nextCursor === undefined && value.more === undefined
			? Object.freeze({nextCursor: null, more: false})
			: Object.freeze({nextCursor: canonicalMetadata(value.nextCursor), more: canonicalMetadata(value.more)}),
		unknowns: value.unknowns === undefined ? Object.freeze([]) : canonicalMetadata(value.unknowns),
		citations: evidenceCitations(technicalEvidence, binding),
		viewEvidence: technicalEvidence,
	});
}

function operationOrdering(operation: ProductTransportRequest["operation"], input: ProductReadInput): string {
	if (operation === "wiki.read") return `wiki-${(input as WikiReadInput).view}-canonical`;
	if (operation === "changes.read") return (input as ChangesReadInput).view === "decisions"
		? "change-id-and-event-order"
		: "change-id-ascending";
	if (operation === "checks.read") return "change-id-stage-and-work-id-ascending";
	if (operation === "work.read") return "change-id-and-work-id-ascending";
	if (operation === "alignment.read") return "change-id-and-item-id-ascending";
	return "single-result";
}

function operationBounds(input: ProductReadInput): CanonicalValue {
	if (typeof input === "object" && input !== null && "limit" in input && typeof input.limit === "number") {
		return Object.freeze({limit: input.limit});
	}
	return Object.freeze({limit: null});
}

function canonicalMetadata(value: unknown): CanonicalValue {
	if (value === null || typeof value === "string" || typeof value === "boolean" ||
		(typeof value === "number" && Number.isSafeInteger(value))) return value;
	if (Array.isArray(value)) return Object.freeze(value.flatMap((entry) => {
		const canonical = canonicalMetadata(entry);
		return canonical === null && entry !== null ? [] : [canonical];
	}));
	if (typeof value === "object" && value !== null) {
		const output: Record<string, CanonicalValue> = Object.create(null) as Record<string, CanonicalValue>;
		for (const [key, entry] of Object.entries(value)) {
			const canonical = canonicalMetadata(entry);
			if (canonical !== null || entry === null) output[key] = canonical;
		}
		return Object.freeze(output);
	}
	return null;
}

function evidenceCitations(value: CanonicalValue, binding: Readonly<Record<string, CanonicalValue>>): CanonicalValue {
	if (isCanonicalObject(value) && value.metadata !== undefined && isCanonicalObject(value.metadata) &&
		Array.isArray(value.metadata.citations) && value.metadata.citations.length > 0) return value.metadata.citations;
	return binding.source === null || binding.source === undefined
		? Object.freeze([])
		: Object.freeze([Object.freeze({kind: "project-source", source: binding.source})]);
}

function projectConfiguration(
	project: ProjectServerProject,
	inputLimits: Partial<ProjectReadLimits> | undefined,
): Outcome<ProjectReadConfiguration, ProjectServerBindingFailure> {
	if (typeof project !== "object" || project === null || !hasOnlyKeys(project, [
		"projectName", "repositoryId", "objectFormat", "canonicalRef", "kernelBuildDigest", "retiredWikiItemIds",
	]) || typeof project.projectName !== "string" ||
		project.projectName.length === 0 || new TextEncoder().encode(project.projectName).byteLength > 256 ||
		project.projectName.normalize("NFC") !== project.projectName ||
		/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(project.projectName) ||
		!isNamespacedIdentifier(project.repositoryId)) {
		return failure(bindingFailure("invalid_configuration", "project", "Project identity is invalid."));
	}
	if (!(project.objectFormat === "sha1" || project.objectFormat === "sha256") || !decodeSha256Digest(project.kernelBuildDigest).ok) {
		return failure(bindingFailure("invalid_configuration", "project", "Project object or build identity is invalid."));
	}
	const canonicalRef = decodeGitRef(project.canonicalRef);
	if (!canonicalRef.ok || canonicalRef.value !== "refs/heads/main") {
		return failure(bindingFailure("invalid_configuration", "canonicalRef", "Canonical Project ref is invalid."));
	}
	if (!validRetiredIds(project.retiredWikiItemIds)) {
		return failure(bindingFailure("invalid_configuration", "retiredWikiItemIds", "Retired Wiki Item IDs must be sorted and unique."));
	}
	const limits = readLimits(inputLimits);
	if (!limits.ok) return limits;
	return success(Object.freeze({
		projectName: project.projectName,
		repositoryId: project.repositoryId,
		objectFormat: project.objectFormat,
		canonicalRef: canonicalRef.value,
		kernelBuildDigest: project.kernelBuildDigest,
		retiredWikiItemIds: Object.freeze([...project.retiredWikiItemIds]),
		limits: limits.value,
	}));
}

function readLimits(input: Partial<ProjectReadLimits> | undefined): Outcome<ProjectReadLimits, ProjectServerBindingFailure> {
	if (input !== undefined && (typeof input !== "object" || input === null || !hasOnlyKeys(input, [
		"maximumWikiItems", "maximumWikiFileBytes", "maximumWikiTotalBytes", "maximumChangeTraces", "maximumTraceBytes",
		"maximumHistoryCommits", "maximumHistoryBytes",
	]))) return failure(bindingFailure("invalid_configuration", "limits", "Read limits are malformed."));
	const limits: ProjectReadLimits = Object.freeze({
		maximumWikiItems: input?.maximumWikiItems ?? DEFAULT_LIMITS.maximumWikiItems,
		maximumWikiFileBytes: input?.maximumWikiFileBytes ?? DEFAULT_LIMITS.maximumWikiFileBytes,
		maximumWikiTotalBytes: input?.maximumWikiTotalBytes ?? DEFAULT_LIMITS.maximumWikiTotalBytes,
		maximumChangeTraces: input?.maximumChangeTraces ?? DEFAULT_LIMITS.maximumChangeTraces,
		maximumTraceBytes: input?.maximumTraceBytes ?? DEFAULT_LIMITS.maximumTraceBytes,
		maximumHistoryCommits: input?.maximumHistoryCommits ?? DEFAULT_LIMITS.maximumHistoryCommits,
		maximumHistoryBytes: input?.maximumHistoryBytes ?? DEFAULT_LIMITS.maximumHistoryBytes,
	});
	const bounds: readonly Readonly<{field: keyof ProjectReadLimits; minimum: number; maximum: number}>[] = [
		{field: "maximumWikiItems", minimum: 1, maximum: MAXIMUM_WIKI_ITEMS},
		{field: "maximumWikiFileBytes", minimum: 1, maximum: MAXIMUM_WIKI_FILE_BYTES},
		{field: "maximumWikiTotalBytes", minimum: 1, maximum: MAXIMUM_WIKI_TOTAL_BYTES},
		{field: "maximumChangeTraces", minimum: 1, maximum: 4_096},
		{field: "maximumTraceBytes", minimum: 1, maximum: MAX_TRACE_BYTES},
		{field: "maximumHistoryCommits", minimum: 1, maximum: 256},
		{field: "maximumHistoryBytes", minimum: 1, maximum: 64 * 1024 * 1024},
	];
	for (const bound of bounds) {
		const value = limits[bound.field];
		if (!Number.isSafeInteger(value) || value < bound.minimum || value > bound.maximum) {
			return failure(bindingFailure("invalid_configuration", bound.field, `${bound.field} is outside its safe bound.`));
		}
	}
	if (limits.maximumWikiFileBytes > limits.maximumWikiTotalBytes) {
		return failure(bindingFailure("invalid_configuration", "limits", "Wiki file bound cannot exceed the total Wiki bound."));
	}
	return success(limits);
}

function replayResponse(
	replay: ReadonlyMap<string, Readonly<{requestDigest: Sha256Digest; response: ProductTransportResponse}>>,
	actor: AuthorizedProjectActor,
	request: ProductTransportRequest,
): ProductTransportResponse | null {
	const found = replay.get(replayKey(actor, request));
	if (!found) return null;
	if (found.requestDigest === request.requestDigest) return found.response;
	const conflict = responseFor(request, failure(productError(
		"idempotency_conflict",
		"This request ID was already used for a different read.",
		"Retry with a new request ID.",
		false,
	)));
	return isTransportResponse(conflict) ? conflict : null;
}

function rememberResponse(
	replay: Map<string, Readonly<{requestDigest: Sha256Digest; response: ProductTransportResponse}>>,
	maximum: number,
	actor: AuthorizedProjectActor,
	request: ProductTransportRequest,
	response: ProductTransportResponse,
): void {
	if (replay.size >= maximum) {
		const oldest = replay.keys().next().value;
		if (typeof oldest === "string") replay.delete(oldest);
	}
	replay.set(replayKey(actor, request), Object.freeze({requestDigest: request.requestDigest, response}));
}

function responseFor(
	request: Pick<ProductTransportRequest, "requestId" | "requestDigest" | "operation">,
	outcome: Outcome<unknown, ProductError>,
	binding: unknown | null = null,
): ProductTransportResponse | Readonly<{status: "error"}> {
	const response = createProductTransportResponse(request, outcome, binding);
	if (response.ok) return response.value;
	const fallback = createProductTransportResponse(request, failure(productError(
		"internal_failure",
		"The Project service could not encode a safe response.",
		"Retry after the Project service is healthy.",
		false,
	)));
	return fallback.ok ? fallback.value : Object.freeze({status: "error" as const});
}

function invalidEnvelopeRequest(): Pick<ProductTransportRequest, "requestId" | "requestDigest" | "operation"> {
	return Object.freeze({
		requestId: "cw:request:invalid",
		requestDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
		operation: "project.discover",
	});
}

function isTransportResponse(value: unknown): value is ProductTransportResponse {
	return typeof value === "object" && value !== null && "responseDigest" in value;
}

function replayKey(actor: AuthorizedProjectActor, request: ProductTransportRequest): string {
	return `${actor.actorId}\0${request.requestId}`;
}

function validRetiredIds(input: readonly string[]): boolean {
	if (!Array.isArray(input) || input.length > MAXIMUM_WIKI_ITEMS) return false;
	for (let index = 0; index < input.length; index += 1) {
		const value = input[index];
		if (typeof value !== "string" || !isNamespacedIdentifier(value) || (index > 0 && (input[index - 1] ?? "") >= value)) return false;
	}
	return true;
}

function hasOnlyKeys<Value extends object>(value: Value, keys: readonly string[]): boolean {
	return Object.keys(value).every((key) => keys.includes(key));
}

function hasMethods<Value extends object>(value: Value, methods: readonly string[]): boolean {
	return methods.every((method) => method in value && typeof (value as Readonly<Record<string, unknown>>)[method] === "function");
}

function sameProtocol(
	actual: Readonly<{id: string; version: string}> | undefined,
	expected: Readonly<{id: string; version: string}>,
): boolean {
	return actual?.id === expected.id && actual.version === expected.version;
}

function sourceError(value: ProjectSourceIssue): ProductError {
	if (value.code === "source_not_found") return productError("source_not_found", "The requested Project source does not exist.", "Choose the current Project or another available Change.", false);
	if (value.code === "source_stale") return productError("source_stale", "The Project changed before this read completed.", "Refresh and retry from the current Project state.", false);
	if (value.code === "limit_exceeded") return productError("limit_exceeded", "The requested Project information exceeds the safe read bounds.", "Narrow the request and retry.", false);
	return productError("invalid_project_state", "The selected Project state could not be validated.", "Ask a maintainer to inspect the Project state.", true);
}

function bindingFailure(
	code: ProjectServerBindingFailure["code"],
	field: string,
	message: string,
): ProjectServerBindingFailure {
	return Object.freeze({code, field, message});
}
