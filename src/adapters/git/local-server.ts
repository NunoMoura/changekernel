import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {lstat} from "node:fs/promises";
import {join, resolve} from "node:path";

import {decodeGitRef} from "../../kernel/identity/git.ts";
import {createGitProjectStore} from "./project-store.ts";
import {CODEWIKI_PRODUCT_POLICY_DIGEST} from "../../product.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {sha256Digest} from "../../kernel/identity/sha256.ts";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "../../ports/agent-runtime.ts";
import {CHECK_RUNNER_PORT_PROTOCOL} from "../../ports/check-runner.ts";
import {createProjectAccessPolicy, projectAccessProofDigest} from "../../server/authorization/policy.ts";
import {createProjectServer} from "../../server/index.ts";
import {createMemoryProjectServerFacts} from "../../server/recovery/facts.ts";

export const LOCAL_PROJECT_SERVER_PROTOCOL = Object.freeze({
	id: "codewiki.local-project-server",
	version: "1.0.0",
} as const);

export interface LocalProjectServer {
	readonly protocol: typeof LOCAL_PROJECT_SERVER_PROTOCOL;
	readonly repositoryId: string;
	readonly projectName: string;
	readonly objectFormat: "sha1" | "sha256";
	readonly server: Readonly<{
		protocol: unknown;
		handle(input: unknown): Promise<unknown>;
	}>;
}

export interface LocalProjectServerIssue {
	readonly code: "invalid_project_root" | "store_failed" | "binding_failed" | "object_format_failed";
	readonly message: string;
}

const execFileAsync = promisify(execFile);

const READ_CAPABILITIES = [
	"alignment.read",
	"audit.read",
	"changes.read",
	"checks.read",
	"project.capabilities",
	"project.discover",
	"project.status",
	"review.read",
	"wiki.read",
	"work.read",
] as const;

/**
 * Bounded local Project Server composition for read-first Console use.
 * Composes the real Git Project Store, an unavailable Check Runner (read views remain
 * factual), an unavailable Agent Runtime, and a least-privilege local read policy.
 * Composition never bootstraps, copies, repairs, or rewrites semantic state; it only
 * binds read interfaces over an existing Git root. Mutations fail closed because the
 * read-only authorization grants deny every command operation; unavailable execution
 * ports alone could not supply that guarantee. The composition is for Console reads,
 * never for lifecycle authority.
 */
export async function createLocalProjectServer(
	options: Readonly<{projectRoot: string; projectName?: string}>,
): Promise<Outcome<LocalProjectServer, LocalProjectServerIssue>> {
	if (typeof options !== "object" || options === null ||
		typeof options.projectRoot !== "string" || options.projectRoot.length === 0 ||
		(options.projectName !== undefined && (typeof options.projectName !== "string" || options.projectName.length === 0))) {
		return failure(issue("invalid_project_root", "Local Project Server options are malformed."));
	}
	const projectRoot = resolve(options.projectRoot);

	const projectName = options.projectName ?? "Local Project";
	const rootCheck = await inspectProjectRoot(projectRoot);
	if (!rootCheck.ok) return rootCheck;

	const repositoryId = await deriveRepositoryId(projectRoot);

	const objectFormat = await detectObjectFormat(projectRoot);
	if (!objectFormat.ok) return objectFormat;

	const store = createGitProjectStore({repositoryRoot: projectRoot, repositoryId});
	if (!store.ok) {
		return failure(issue("store_failed", "The local Git Project Store could not be opened."));
	}

	const facts = createMemoryProjectServerFacts();
	if (!facts.ok) {
		return failure(issue("binding_failed", "Local Project Server facts could not be created."));
	}

	const proof = `local-console:${repositoryId}`;
	const proofDigest = projectAccessProofDigest(proof);
	if (!proofDigest.ok) {
		return failure(issue("binding_failed", "Local authentication proof is invalid."));
	}

	const canonicalRefOutcome = decodeGitRef("refs/heads/main");
	if (!canonicalRefOutcome.ok) {
		return failure(issue("binding_failed", "The canonical Project ref is invalid."));
	}
	const canonicalRef = canonicalRefOutcome.value;

	const accessPolicy = createProjectAccessPolicy({
		grants: [{
			authorizationId: "cw:authorization:local-console",
			identityRef: "cw:identity:local-console",
			actorId: "cw:actor:local-console",
			proofDigest: proofDigest.value,
			expiresAt: "2036-01-01T00:00:00Z",
			capabilities: [...READ_CAPABILITIES],
			wikiItemIds: null,
			changeIds: null,
		}],
		now: () => new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
	});
	if (!accessPolicy.ok) {
		return failure(issue("binding_failed", "Local access policy is invalid."));
	}

	const unavailable = async () => failure({code: "executor_unavailable", message: "This local composition is read-only."} as const);
	const runtimeUnavailable = async () => failure({code: "environment_unavailable", message: "Agent Runs are unavailable in the local read-only composition."} as const);

	const bound = createProjectServer({
		ports: {
			projectStore: store.value,
			checkRunner: {protocol: CHECK_RUNNER_PORT_PROTOCOL, run: unavailable},
			facts: facts.value,
			agentRuntime: {protocol: AGENT_RUNTIME_PORT_PROTOCOL, start: runtimeUnavailable, inspect: runtimeUnavailable, cancel: runtimeUnavailable},
		},
		accessPolicy: accessPolicy.value,
		project: {
			projectName,
			repositoryId,
			objectFormat: objectFormat.value,
			canonicalRef: canonicalRef,
			kernelBuildDigest: CODEWIKI_PRODUCT_POLICY_DIGEST,
			retiredWikiItemIds: [],
		},
	});
	if (!bound.ok) {
		return failure(issue("binding_failed", "The local Project Server could not be bound."));
	}

	return success(Object.freeze({
		protocol: LOCAL_PROJECT_SERVER_PROTOCOL,
		repositoryId,
		projectName,
		objectFormat: objectFormat.value,
		server: bound.value,
	}));
}

async function deriveRepositoryId(projectRoot: string): Promise<string> {
	const digest = await sha256Digest(projectRoot);
	return `cw:repository:local-${digest.slice("sha256:".length, "sha256:".length + 16)}`;
}

/**
 * Read-only root preflight replacing the safety checks implicit bootstrap used to
 * supply: composition requires an existing non-symbolic directory root with its own
 * non-symbolic `.git` directory or file, checked with `lstat` before any Git store
 * binding. A nested path without its own `.git` never falls through to ancestor
 * discovery. These point-in-time checks never write and do not establish physical
 * custody.
 */
async function inspectProjectRoot(projectRoot: string): Promise<Outcome<true, LocalProjectServerIssue>> {
	try {
		const root = await lstat(projectRoot);
		if (root.isSymbolicLink() || !root.isDirectory()) {
			return failure(issue("invalid_project_root", "The project root must be an existing non-symbolic directory."));
		}
	} catch (error) {
		return failure(issue("invalid_project_root", isNotFound(error)
			? "The project root does not exist."
			: `The project root could not be inspected: ${errorDetail(error)}`));
	}
	try {
		const gitState = await lstat(join(projectRoot, ".git"));
		if (gitState.isSymbolicLink() || (!gitState.isDirectory() && !gitState.isFile())) {
			return failure(issue("invalid_project_root", "The project root must contain its own non-symbolic `.git` directory or file."));
		}
	} catch (error) {
		return failure(issue("invalid_project_root", isNotFound(error)
			? "The project root is not a Git repository: it has no `.git` directory or file of its own."
			: `The Git state of the project root could not be inspected: ${errorDetail(error)}`));
	}
	return success(true);
}

function isNotFound(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function errorDetail(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown filesystem failure.";
}

async function detectObjectFormat(
	projectRoot: string,
): Promise<Outcome<"sha1" | "sha256", LocalProjectServerIssue>> {
	try {
		const {stdout} = await execFileAsync("git", ["config", "--get", "extensions.objectformat"], {cwd: projectRoot});
		const value = stdout.trim();
		if (value === "sha256") return success("sha256");
		if (value === "" || value === "sha1") return success("sha1");
		return failure(issue("object_format_failed", `Unsupported Git object format: ${value}`));
	} catch {
		return success("sha1");
	}
}

function issue(code: LocalProjectServerIssue["code"], message: string): LocalProjectServerIssue {
	return Object.freeze({code, message});
}
