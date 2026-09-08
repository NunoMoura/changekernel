import {
	canonicalJson,
	decodeCanonicalValue,
	isCanonicalObject,
	type CanonicalIssue,
	type CanonicalValue,
} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";

export const PROJECT_CONFIG_PROTOCOL = Object.freeze({
	id: "codewiki.project-config",
	version: "2.0.0",
} as const);

const MAXIMUM_CONFIG_BYTES = 1 * 1_024 * 1_024;
const UTF8 = new TextEncoder();

const ALLOWED_TOP_LEVEL_KEYS = Object.freeze([
	"hosts",
	"preview",
	"project",
	"protocol",
	"quality",
	"retention",
	"runtime",
	"triagePreferences",
	"userStandards",
] as const);

export type ProjectConfigFailureCode =
	| "invalid_json"
	| "invalid_project"
	| "invalid_protocol"
	| "invalid_value"
	| "unknown_field";

export interface ProjectConfigFailure {
	readonly code: ProjectConfigFailureCode;
	readonly path: string;
	readonly message: string;
	readonly cause?: CanonicalIssue;
}

export interface DomainFreeProjectConfig {
	readonly protocol: typeof PROJECT_CONFIG_PROTOCOL;
	readonly project: string;
	readonly value: Readonly<{[key: string]: CanonicalValue}>;
}

export function parseProjectConfigJson(
	text: string,
): Outcome<DomainFreeProjectConfig, ProjectConfigFailure> {
	if (UTF8.encode(text).byteLength > MAXIMUM_CONFIG_BYTES) {
		return failure(configFailure("invalid_value", "$", "Project configuration exceeds its byte limit."));
	}
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return failure(configFailure("invalid_json", "$", "Project configuration must be valid JSON."));
	}
	return decodeProjectConfig(value);
}

export function decodeProjectConfig(
	input: unknown,
): Outcome<DomainFreeProjectConfig, ProjectConfigFailure> {
	const decoded = decodeCanonicalValue(input);
	if (!decoded.ok) {
		return failure(configFailure(
			"invalid_value",
			"$",
			"Project configuration must contain canonical values.",
			decoded.error,
		));
	}
	if (!isCanonicalObject(decoded.value)) {
		return failure(configFailure("invalid_value", "$", "Project configuration must be an object."));
	}
	for (const key of Object.keys(decoded.value)) {
		if (!(ALLOWED_TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
			return failure(configFailure("unknown_field", `$[${JSON.stringify(key)}]`, "Unknown configuration field."));
		}
	}
	const protocol = decoded.value.protocol;
	if (
		protocol === undefined ||
		!isCanonicalObject(protocol) ||
		Object.keys(protocol).length !== 2 ||
		protocol.id !== PROJECT_CONFIG_PROTOCOL.id ||
		protocol.version !== PROJECT_CONFIG_PROTOCOL.version
	) {
		return failure(configFailure(
			"invalid_protocol",
			"$.protocol",
			"Project configuration protocol must be codewiki.project-config@2.0.0.",
		));
	}
	const project = decoded.value.project;
	if (
		typeof project !== "string" ||
		project.normalize("NFC") !== project ||
		!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,127}$/.test(project)
	) {
		return failure(configFailure(
			"invalid_project",
			"$.project",
			"Project identity must be 1..128 characters of bounded NFC text.",
		));
	}
	return success(Object.freeze({
		protocol: PROJECT_CONFIG_PROTOCOL,
		project,
		value: decoded.value,
	}));
}

export function serializeBootstrapProjectConfig(
	project: string,
): Outcome<string, ProjectConfigFailure> {
	const decoded = decodeProjectConfig(bootstrapProjectConfigValue(project));
	if (!decoded.ok) return decoded;
	const encoded = canonicalJson(decoded.value.value);
	if (!encoded.ok) {
		return failure(configFailure(
			"invalid_value",
			"$",
			"Project configuration could not be encoded canonically.",
			encoded.error,
		));
	}
	return success(`${encoded.value}\n`);
}

function bootstrapProjectConfigValue(project: string): CanonicalValue {
	return {
		protocol: PROJECT_CONFIG_PROTOCOL,
		project,
		preview: {
			profiles: [],
			uiPreviewTargets: [],
		},
		runtime: {
			maxWorkers: 1,
			worktreeIsolation: "none",
			worktreeSetupCommands: [],
			automation: "manual",
			agency: "assist",
			budgets: {maxIterations: 1},
			modelRouting: {
				qualityFloor: "standard",
				maxEscalations: 0,
				estimatedInputTokens: 75_000,
				estimatedOutputTokens: 25_000,
				routes: [],
				roleRoutes: {
					harness: null,
					decision: "inherit",
					planning: "inherit",
					review: "inherit",
					workers: [],
				},
				escalationTransitions: [],
			},
			approval: {
				cadence: "per_iteration",
				destructiveAction: "ask",
				riskEscalation: "ask",
				requireExpectedBytes: true,
			},
			stopConditions: [
				"semantic_decision",
				"risk_escalation",
				"destructive_action",
			],
		},
		retention: {
			enabled: true,
			archiveRefPrefix: "refs/codewiki/archive/",
			hotTraceLimit: 20,
			requireCloseRecord: true,
			hydrateOnDemand: true,
		},
		hosts: {
			pi: {enabled: false},
			mcp: {enabled: false},
		},
		userStandards: [],
		triagePreferences: [],
		quality: {
			judge: {
				enabled: false,
				provider: "none",
				promptVersion: "loop-quality-judge.v3",
				timeoutMs: 30_000,
			},
			review: {
				enabled: true,
				autoEvidence: true,
				includeCachedEvidence: true,
				timeoutMs: 15_000,
				fastTimeoutMs: 3_000,
				maxCachedEvidenceAgeMs: 600_000,
				enabledPacks: [
					"tsjs.typescript",
					"tsjs.lint",
					"python.ruff",
					"python.pyright",
					"go.test",
					"go.vet",
					"rust.cargo-test",
					"rust.cargo-clippy",
					"shell.shellcheck",
				],
				disabledPacks: [],
				requiredPacks: [],
			},
		},
	};
}

function configFailure(
	code: ProjectConfigFailureCode,
	path: string,
	message: string,
	cause?: CanonicalIssue,
): ProjectConfigFailure {
	return cause === undefined
		? Object.freeze({code, path, message})
		: Object.freeze({code, path, message, cause});
}
