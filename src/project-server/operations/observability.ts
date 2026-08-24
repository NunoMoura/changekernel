import {lstat, readFile, readdir} from "node:fs/promises";
import {join} from "node:path";

import {
	assertRuntimeBuildRegistrySnapshot,
	type RunReceipt,
	type RuntimeBuildRegistrySnapshot,
} from "../../runtime/contracts.ts";
import {
	BACKEND_V1_SUPPORT_MATRIX,
	assertRuntimeProductionQualification,
	type RuntimeOperationsInspectionPort,
	type RuntimeProductionQualification,
} from "../../protocol/backend-production.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	sha256Digest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	readDevLog,
	type DevLogEntry,
} from "../persistence/dev-log.ts";
import {
	assertCodeWikiStatePath,
	projectServerStatePaths,
	projectStateRef,
	type ProjectServerStatePaths,
} from "./paths.ts";
import {
	BACKEND_BUILD_TRANSITION_PROTOCOL,
	BACKEND_STATE_MIGRATION_PROTOCOL,
	BACKEND_STATE_RECOVERY_PROTOCOL,
	BACKEND_STATE_RESTORE_PROTOCOL,
} from "./state.ts";
import {
	readStandaloneProjectServerStatus,
	type StandaloneProjectServerStatus,
} from "./lifecycle.ts";
import {BACKEND_OBSERVABILITY_PROTOCOL} from "./contracts.ts";

export {BACKEND_OBSERVABILITY_PROTOCOL} from "./contracts.ts";

export type BackendHealthState = "healthy" | "degraded" | "unhealthy" | "idle";
export type BackendComponentName =
	| "backend-state"
	| "project-server"
	| "runtime-build"
	| "runtime-containment"
	| "provider-broker";

export interface BackendLiveRuntimeObservation {
	readonly observedAt: string;
	readonly activeRunCount: number;
	readonly providerBroker: "idle" | "healthy" | "degraded" | "unavailable";
	readonly evidenceDigest: Sha256Digest;
}

export interface BackendReceiptInspectionRequest {
	readonly runId: string;
	readonly requestDigest: Sha256Digest;
}

export interface BackendComponentHealth {
	readonly component: BackendComponentName;
	readonly state: BackendHealthState;
	readonly identityDigest: Sha256Digest | null;
	readonly message: string;
}

export interface BackendAuditRecord {
	readonly kind: "migration" | "build-transition" | "restore" | "recovery";
	readonly protocol: Readonly<{readonly id: string; readonly version: string}>;
	readonly digest: Sha256Digest;
	readonly contentDigest: Sha256Digest;
	readonly occurredAt: string;
	readonly byteLength: number;
	readonly ref: string;
}

export interface BackendReceiptInspection {
	readonly status: "verified" | "missing";
	readonly runId: string;
	readonly requestDigest: Sha256Digest;
	readonly receiptDigest: Sha256Digest | null;
	readonly outcome: RunReceipt["outcome"] | null;
	readonly runtimeBuildDigest: Sha256Digest | null;
	readonly startedAt: string | null;
	readonly finishedAt: string | null;
	readonly finalEventSequence: number | null;
	readonly executionLedgerDigest: Sha256Digest | null;
	readonly outputDigest: Sha256Digest | null;
	readonly usageDigest: Sha256Digest | null;
	readonly cancellationDigest: Sha256Digest | null;
	readonly quiescenceDigest: Sha256Digest | null;
	readonly custodyGapCount: number;
	readonly operationalGapCount: number;
}

export interface BackendOperationalDiagnostic {
	readonly severity: "info" | "warning" | "error";
	readonly code: string;
	readonly component: BackendComponentName;
	readonly message: string;
	readonly evidenceRefs: readonly string[];
}

export interface BackendOperationalReport {
	readonly protocol: typeof BACKEND_OBSERVABILITY_PROTOCOL;
	readonly observedAt: string;
	readonly repositoryIdentity: Sha256Digest;
	readonly supportMatrixDigest: Sha256Digest;
	readonly overall: BackendHealthState;
	readonly lifecycle: StandaloneProjectServerStatus["lifecycle"];
	readonly components: readonly BackendComponentHealth[];
	readonly metrics: Readonly<{
		readonly activeRuns: number;
		readonly healthyComponents: number;
		readonly degradedComponents: number;
		readonly unhealthyComponents: number;
		readonly auditRecords: number;
		readonly logEntries: number;
		readonly verifiedReceipts: number;
		readonly missingReceipts: number;
	}>;
	readonly audit: Readonly<{
		readonly records: readonly BackendAuditRecord[];
		readonly truncated: boolean;
	}>;
	readonly logs: readonly Readonly<{
		readonly traceId: string;
		readonly entries: readonly DevLogEntry[];
	}>[];
	readonly receipts: readonly BackendReceiptInspection[];
	readonly diagnostics: readonly BackendOperationalDiagnostic[];
	readonly privacy: Readonly<{
		readonly chainOfThought: "excluded";
		readonly secrets: "excluded";
		readonly rawSessionBytes: "excluded";
		readonly rawLogs: "excluded";
	}>;
	readonly reportDigest: Sha256Digest;
}

const MAX_AUDIT_RECORDS = 1_000;
const MAX_AUDIT_FILE_BYTES = 1024 * 1024;
const MAX_AUDIT_DIRECTORY_ENTRIES = 10_000;
const MAX_TRACE_IDS = 32;
const MAX_LOG_ENTRIES_PER_TRACE = 1_000;
const MAX_RECEIPT_QUERIES = 32;

const AUDIT_ROOTS = Object.freeze([
	Object.freeze({
		kind: "migration" as const,
		protocol: BACKEND_STATE_MIGRATION_PROTOCOL,
		digestField: "migrationDigest",
		timestampField: "migratedAt",
		path: (paths: ProjectServerStatePaths) => paths.migrationsRoot,
	}),
	Object.freeze({
		kind: "build-transition" as const,
		protocol: BACKEND_BUILD_TRANSITION_PROTOCOL,
		digestField: "transitionDigest",
		timestampField: "transitionedAt",
		path: (paths: ProjectServerStatePaths) => paths.buildTransitionsRoot,
	}),
	Object.freeze({
		kind: "restore" as const,
		protocol: BACKEND_STATE_RESTORE_PROTOCOL,
		digestField: "restoreDigest",
		timestampField: "restoredAt",
		path: (paths: ProjectServerStatePaths) => paths.restoreReceiptsRoot,
	}),
	Object.freeze({
		kind: "recovery" as const,
		protocol: BACKEND_STATE_RECOVERY_PROTOCOL,
		digestField: "recoveryDigest",
		timestampField: "recoveredAt",
		path: (paths: ProjectServerStatePaths) => paths.recoveryReceiptsRoot,
	}),
]);

export async function inspectBackendOperations(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly observedAt: string;
	readonly runtime: RuntimeOperationsInspectionPort;
	readonly liveRuntime?: BackendLiveRuntimeObservation | null;
	readonly traceIds?: readonly string[];
	readonly receipts?: readonly BackendReceiptInspectionRequest[];
	readonly maximumAuditRecords?: number;
}): Promise<BackendOperationalReport> {
	const observedAt = timestamp(input.observedAt, "Backend observability observedAt");
	const paths = projectServerStatePaths(input);
	const maximumAuditRecords = boundedInteger(
		input.maximumAuditRecords ?? 256,
		"Backend observability maximumAuditRecords",
		1,
		MAX_AUDIT_RECORDS,
	);
	const traceIds = normalizedTraceIds(input.traceIds ?? []);
	const receiptQueries = normalizedReceiptQueries(input.receipts ?? []);
	const liveRuntime = normalizedLiveRuntime(input.liveRuntime ?? null, observedAt);
	const [runtimeBuilds, qualification] = await Promise.all([
		input.runtime.readBuildRegistry(),
		input.runtime.readProductionQualification(),
	]);
	if (runtimeBuilds) assertRuntimeBuildRegistrySnapshot(runtimeBuilds);
	if (qualification) assertRuntimeProductionQualification(qualification);
	const [status, audit, logs, receipts] = await Promise.all([
		readStandaloneProjectServerStatus({
			repoRoot: paths.projectRoot,
			stateRoot: paths.stateRoot,
			runtimeBuildRegistry: runtimeBuilds ?? null,
		}),
		collectBackendAuditRecords(paths, maximumAuditRecords),
		collectBackendLogs(paths.projectRoot, paths.stateRoot, traceIds),
		inspectBackendReceipts(input.runtime, receiptQueries),
	]);
	const diagnostics: BackendOperationalDiagnostic[] = [];
	const components = componentHealth({
		status,
		runtimeBuilds,
		qualification,
		liveRuntime,
		diagnostics,
	});
	for (const receipt of receipts) {
		if (receipt.status === "missing") {
			diagnostics.push(diagnostic(
				"warning",
				"runtime.receipt_missing",
				"runtime-build",
				"Requested Runtime receipt is unavailable.",
				[],
			));
		}
	}
	const orderedDiagnostics = Object.freeze(diagnostics.sort(compareDiagnostic));
	const metrics = Object.freeze({
		activeRuns: liveRuntime?.activeRunCount ?? 0,
		healthyComponents: components.filter(({state}) => state === "healthy").length,
		degradedComponents: components.filter(({state}) => state === "degraded").length,
		unhealthyComponents: components.filter(({state}) => state === "unhealthy").length,
		auditRecords: audit.records.length,
		logEntries: logs.reduce((total, trace) => total + trace.entries.length, 0),
		verifiedReceipts: receipts.filter(({status: value}) => value === "verified").length,
		missingReceipts: receipts.filter(({status: value}) => value === "missing").length,
	});
	const overall = overallHealth(status, components, orderedDiagnostics);
	const body = {
		protocol: BACKEND_OBSERVABILITY_PROTOCOL,
		observedAt,
		repositoryIdentity: paths.repositoryIdentity,
		supportMatrixDigest: BACKEND_V1_SUPPORT_MATRIX.matrixDigest,
		overall,
		lifecycle: status.lifecycle,
		components,
		metrics,
		audit,
		logs,
		receipts,
		diagnostics: orderedDiagnostics,
		privacy: Object.freeze({
			chainOfThought: "excluded" as const,
			secrets: "excluded" as const,
			rawSessionBytes: "excluded" as const,
			rawLogs: "excluded" as const,
		}),
	};
	return Object.freeze({...body, reportDigest: canonicalJsonDigest(body)});
}

export async function collectBackendAuditRecords(
	paths: ProjectServerStatePaths,
	maximumRecords = 256,
): Promise<Readonly<{readonly records: readonly BackendAuditRecord[]; readonly truncated: boolean}>> {
	const maximum = boundedInteger(
		maximumRecords,
		"Backend audit maximum records",
		1,
		MAX_AUDIT_RECORDS,
	);
	const records: BackendAuditRecord[] = [];
	for (const root of AUDIT_ROOTS) {
		const directory = root.path(paths);
		const entries = await readDirectoryIfPresent(directory);
		if (entries.length > MAX_AUDIT_DIRECTORY_ENTRIES) {
			throw new Error("Backend audit directory exceeds its entry bound.");
		}
		for (const entry of entries) {
			if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/u.test(entry.name)) {
				throw new Error("Backend audit directory contains undeclared state.");
			}
			const path = join(directory, entry.name);
			await assertCodeWikiStatePath(paths, path);
			const metadata = await lstat(path);
			if (!metadata.isFile() || metadata.isSymbolicLink()) {
				throw new Error("Backend audit record must be a regular file.");
			}
			if (metadata.size < 2 || metadata.size > MAX_AUDIT_FILE_BYTES) {
				throw new Error("Backend audit record exceeds its byte bound.");
			}
			const bytes = await readFile(path);
			const value = parseCanonicalRecord(bytes, "Backend audit record");
			const digest = requiredDigest(value[root.digestField], "Backend audit digest");
			if (entry.name !== `${digest.slice(7)}.json`) {
				throw new Error("Backend audit record filename does not match its digest.");
			}
			if (canonicalJson(value.protocol) !== canonicalJson(root.protocol)) {
				throw new Error("Backend audit record protocol is invalid.");
			}
			const identity = {...value};
			delete identity[root.digestField];
			if (canonicalJsonDigest(identity) !== digest) {
				throw new Error("Backend audit record digest is invalid.");
			}
			records.push(Object.freeze({
				kind: root.kind,
				protocol: root.protocol,
				digest,
				contentDigest: sha256Digest(bytes),
				occurredAt: timestamp(value[root.timestampField], "Backend audit timestamp"),
				byteLength: metadata.size,
				ref: projectStateRef(paths, path),
			}));
		}
	}
	records.sort((left, right) =>
		`${left.occurredAt}/${left.kind}/${left.digest}`.localeCompare(
			`${right.occurredAt}/${right.kind}/${right.digest}`,
		),
	);
	const truncated = records.length > maximum;
	return Object.freeze({
		records: Object.freeze((truncated ? records.slice(-maximum) : records)),
		truncated,
	});
}

async function collectBackendLogs(
	repoRoot: string,
	stateRoot: string,
	traceIds: readonly string[],
): Promise<BackendOperationalReport["logs"]> {
	const traces = await Promise.all(traceIds.map(async (traceId) => Object.freeze({
		traceId,
		entries: await readDevLog(
			repoRoot,
			traceId,
			MAX_LOG_ENTRIES_PER_TRACE,
			stateRoot,
		),
	})));
	return Object.freeze(traces);
}

async function inspectBackendReceipts(
	runtime: RuntimeOperationsInspectionPort,
	queries: readonly BackendReceiptInspectionRequest[],
): Promise<BackendOperationalReport["receipts"]> {
	const receipts = await Promise.all(queries.map(async (query) => {
		const receipt = await runtime.readReceipt({
			runId: query.runId,
			requestDigest: query.requestDigest,
		});
		return receiptProjection(query, receipt);
	}));
	return Object.freeze(receipts);
}

function receiptProjection(
	query: BackendReceiptInspectionRequest,
	receipt: Readonly<RunReceipt> | null,
): Readonly<BackendReceiptInspection> {
	if (!receipt) {
		return Object.freeze({
			status: "missing",
			runId: query.runId,
			requestDigest: query.requestDigest,
			receiptDigest: null,
			outcome: null,
			runtimeBuildDigest: null,
			startedAt: null,
			finishedAt: null,
			finalEventSequence: null,
			executionLedgerDigest: null,
			outputDigest: null,
			usageDigest: null,
			cancellationDigest: null,
			quiescenceDigest: null,
			custodyGapCount: 0,
			operationalGapCount: 0,
		});
	}
	return Object.freeze({
		status: "verified",
		runId: receipt.runId,
		requestDigest: receipt.requestDigest,
		receiptDigest: receipt.receiptDigest,
		outcome: receipt.outcome,
		runtimeBuildDigest: receipt.runtimeBuild.buildDigest,
		startedAt: receipt.startedAt,
		finishedAt: receipt.finishedAt,
		finalEventSequence: receipt.finalEventSequence,
		executionLedgerDigest: receipt.executionLedgerDigest,
		outputDigest: receipt.outputDigest,
		usageDigest: receipt.usageDigest,
		cancellationDigest: receipt.cancellationDigest,
		quiescenceDigest: receipt.quiescenceDigest,
		custodyGapCount: receipt.custodyGaps.length,
		operationalGapCount: receipt.operationalGaps.length,
	});
}

function componentHealth(input: {
	readonly status: StandaloneProjectServerStatus;
	readonly runtimeBuilds: RuntimeBuildRegistrySnapshot | undefined;
	readonly qualification: RuntimeProductionQualification | null;
	readonly liveRuntime: BackendLiveRuntimeObservation | null;
	readonly diagnostics: BackendOperationalDiagnostic[];
}): readonly BackendComponentHealth[] {
	return Object.freeze([
		backendStateHealth(input.status, input.diagnostics),
		projectServerHealth(input.status, input.diagnostics),
		...runtimeBuildHealth(
			input.runtimeBuilds?.activeBuildDigest ?? null,
			input.qualification,
			input.diagnostics,
		),
		providerBrokerHealth(input.liveRuntime, input.diagnostics),
	]);
}

function backendStateHealth(
	status: StandaloneProjectServerStatus,
	diagnostics: BackendOperationalDiagnostic[],
): BackendComponentHealth {
	const backend = status.backend;
	if (!backend) {
		return component("backend-state", "idle", null, "Backend state is not bootstrapped.");
	}
	if (
		backend.backendBuildProtocol.version === "2.0.0" &&
		backend.supportMatrixDigest === BACKEND_V1_SUPPORT_MATRIX.matrixDigest
	) {
		return component(
			"backend-state",
			"healthy",
			backend.backendBuildDigest,
			"Backend State and active Backend Build are verified.",
		);
	}
	diagnostics.push(diagnostic(
		"warning",
		"backend.build_upgrade_required",
		"backend-state",
		"Active Backend Build does not bind the current support matrix.",
		[],
	));
	return component(
		"backend-state",
		"degraded",
		backend.backendBuildDigest,
		"Backend Build requires explicit production-support upgrade.",
	);
}

function projectServerHealth(
	status: StandaloneProjectServerStatus,
	diagnostics: BackendOperationalDiagnostic[],
): BackendComponentHealth {
	const health = projectServerProcessHealth(status.lifecycle);
	if (status.lifecycle === "unresponsive") {
		diagnostics.push(diagnostic(
			"error",
			"project-server.unresponsive",
			"project-server",
			"Project Server endpoint ownership exists but health verification failed.",
			[],
		));
	}
	return component(
		"project-server",
		health.state,
		status.backendBuildDigest,
		health.message,
	);
}

function runtimeBuildHealth(
	activeBuildDigest: Sha256Digest | null,
	qualification: RuntimeProductionQualification | null,
	diagnostics: BackendOperationalDiagnostic[],
): readonly BackendComponentHealth[] {
	if (!activeBuildDigest) {
		return Object.freeze([
			component("runtime-build", "idle", null, "No Runtime Build is active."),
			component(
				"runtime-containment",
				"idle",
				null,
				"No qualified Runtime containment is active.",
			),
		]);
	}
	if (!qualification || qualification.runtimeBuildDigest !== activeBuildDigest) {
		diagnostics.push(diagnostic(
			"error",
			"runtime.production_qualification_missing",
			"runtime-build",
			"Active Runtime Build has no matching exact production qualification.",
			[],
		));
		return Object.freeze([
			component(
				"runtime-build",
				"degraded",
				activeBuildDigest,
				"Active Runtime Build lacks matching production qualification.",
			),
			component(
				"runtime-containment",
				"degraded",
				activeBuildDigest,
				"Runtime containment identity is not qualified for the active Build.",
			),
		]);
	}
	return Object.freeze([
		component(
			"runtime-build",
			"healthy",
			activeBuildDigest,
			"Active Runtime Build has exact production qualification.",
		),
		component(
			"runtime-containment",
			"healthy",
			qualification.sandbox.profileDigest,
			"Bubblewrap, prlimit, and Node identities are exactly qualified.",
		),
	]);
}

function providerBrokerHealth(
	liveRuntime: BackendLiveRuntimeObservation | null,
	diagnostics: BackendOperationalDiagnostic[],
): BackendComponentHealth {
	const state = liveRuntime?.providerBroker ?? "idle";
	if (state === "degraded" || state === "unavailable") {
		diagnostics.push(diagnostic(
			state === "unavailable" ? "error" : "warning",
			`provider-broker.${state}`,
			"provider-broker",
			brokerMessage(state),
			liveRuntime ? [`runtime-evidence:${liveRuntime.evidenceDigest}`] : [],
		));
	}
	return component(
		"provider-broker",
		state === "unavailable" ? "unhealthy" : state,
		liveRuntime?.evidenceDigest ?? null,
		brokerMessage(state),
	);
}

function projectServerProcessHealth(
	lifecycle: StandaloneProjectServerStatus["lifecycle"],
): Readonly<{readonly state: BackendHealthState; readonly message: string}> {
	if (lifecycle === "running") {
		return Object.freeze({
			state: "healthy",
			message: "Project Server process is responsive.",
		});
	}
	if (lifecycle === "unresponsive") {
		return Object.freeze({
			state: "unhealthy",
			message: "Project Server process state is unresponsive.",
		});
	}
	return Object.freeze({state: "idle", message: "Project Server process is stopped."});
}

function component(
	componentName: BackendComponentName,
	state: BackendHealthState,
	identityDigest: Sha256Digest | null,
	message: string,
): Readonly<BackendComponentHealth> {
	return Object.freeze({component: componentName, state, identityDigest, message});
}

function diagnostic(
	severity: BackendOperationalDiagnostic["severity"],
	code: string,
	componentName: BackendComponentName,
	message: string,
	evidenceRefs: readonly string[],
): BackendOperationalDiagnostic {
	assertPublicOperationalText(message, "Backend diagnostic message");
	return Object.freeze({
		severity,
		code,
		component: componentName,
		message,
		evidenceRefs: Object.freeze([...evidenceRefs]),
	});
}

function normalizedLiveRuntime(
	value: BackendLiveRuntimeObservation | null,
	observedAt: string,
): Readonly<BackendLiveRuntimeObservation> | null {
	if (!value) return null;
	const observationTime = timestamp(value.observedAt, "Live Runtime observedAt");
	if (Date.parse(observationTime) > Date.parse(observedAt)) {
		throw new Error("Live Runtime observation cannot be from the future.");
	}
	boundedInteger(value.activeRunCount, "Live Runtime activeRunCount", 0, 10_000);
	if (!["idle", "healthy", "degraded", "unavailable"].includes(value.providerBroker)) {
		throw new Error("Live Runtime provider broker status is invalid.");
	}
	return Object.freeze({
		observedAt: observationTime,
		activeRunCount: value.activeRunCount,
		providerBroker: value.providerBroker,
		evidenceDigest: requiredDigest(value.evidenceDigest, "Live Runtime evidence digest"),
	});
}

function normalizedTraceIds(values: readonly string[]): readonly string[] {
	if (!Array.isArray(values) || values.length > MAX_TRACE_IDS) {
		throw new Error("Backend observability trace ids exceed their bound.");
	}
	const normalized = values.map((value) => identifier(value, "Backend observability trace id"));
	if (new Set(normalized).size !== normalized.length) {
		throw new Error("Backend observability trace ids must be unique.");
	}
	return Object.freeze(normalized.sort((left, right) => left.localeCompare(right)));
}

function normalizedReceiptQueries(
	values: readonly BackendReceiptInspectionRequest[],
): readonly BackendReceiptInspectionRequest[] {
	if (!Array.isArray(values) || values.length > MAX_RECEIPT_QUERIES) {
		throw new Error("Backend receipt inspection queries exceed their bound.");
	}
	const normalized = values.map((value) => Object.freeze({
		runId: identifier(value?.runId, "Backend receipt run id"),
		requestDigest: requiredDigest(value?.requestDigest, "Backend receipt request digest"),
	}));
	const keys = normalized.map(({runId, requestDigest}) => `${runId}/${requestDigest}`);
	if (new Set(keys).size !== keys.length) {
		throw new Error("Backend receipt inspection queries must be unique.");
	}
	return Object.freeze(normalized.sort((left, right) =>
		`${left.runId}/${left.requestDigest}`.localeCompare(`${right.runId}/${right.requestDigest}`),
	));
}

function overallHealth(
	status: StandaloneProjectServerStatus,
	components: readonly BackendComponentHealth[],
	diagnostics: readonly BackendOperationalDiagnostic[],
): BackendHealthState {
	if (components.some(({state}) => state === "unhealthy") || diagnostics.some(({severity}) => severity === "error")) {
		return "unhealthy";
	}
	if (components.some(({state}) => state === "degraded") || diagnostics.some(({severity}) => severity === "warning")) {
		return "degraded";
	}
	if (status.lifecycle === "unbootstrapped") return "idle";
	return "healthy";
}

function brokerMessage(value: BackendLiveRuntimeObservation["providerBroker"]): string {
	if (value === "healthy") return "Provider Broker is healthy for observed active Runs.";
	if (value === "degraded") return "Provider Broker reported a recoverable degraded state.";
	if (value === "unavailable") return "Provider Broker is unavailable; new model calls fail closed.";
	return "Provider Broker is idle.";
}

function compareDiagnostic(
	left: BackendOperationalDiagnostic,
	right: BackendOperationalDiagnostic,
): number {
	return `${left.severity}/${left.component}/${left.code}`.localeCompare(
		`${right.severity}/${right.component}/${right.code}`,
	);
}

async function readDirectoryIfPresent(path: string) {
	try {
		return await readdir(path, {withFileTypes: true});
	} catch (error) {
		if (isNotFound(error)) return [];
		throw error;
	}
}

function parseCanonicalRecord(bytes: Buffer, label: string): Record<string, unknown> {
	let value: unknown;
	try {
		value = JSON.parse(bytes.toString("utf8"));
	} catch {
		throw new Error(`${label} is not valid JSON.`);
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object.`);
	}
	if (`${canonicalJson(value)}\n` !== bytes.toString("utf8")) {
		throw new Error(`${label} is not canonical JSON.`);
	}
	return value as Record<string, unknown>;
}

function identifier(value: unknown, field: string): string {
	if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function requiredDigest(value: unknown, field: string): Sha256Digest {
	if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value as Sha256Digest;
}

function timestamp(value: unknown, field: string): string {
	if (
		typeof value !== "string" ||
		Number.isNaN(Date.parse(value)) ||
		new Date(value).toISOString() !== value
	) {
		throw new Error(`${field} must be an exact UTC ISO timestamp.`);
	}
	return value;
}

function boundedInteger(
	value: number,
	field: string,
	minimum: number,
	maximum: number,
): number {
	if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function assertPublicOperationalText(value: string, field: string): void {
	if (
		/\b(?:bearer|authorization|api[_-]?key|access[_-]?token|password|secret)\b\s*[:=]\s*\S+/iu.test(value) ||
		/(?:chain[- ]of[- ]thought|internal reasoning|reasoning trace|<think>)/iu.test(value)
	) {
		throw new Error(`${field} contains private or reasoning text.`);
	}
}

function isNotFound(error: unknown): boolean {
	return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
