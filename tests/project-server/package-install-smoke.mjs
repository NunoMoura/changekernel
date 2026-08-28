import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		...options,
	});
	assert.equal(
		result.status,
		0,
		`${command} ${args.join(" ")} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
	);
	return result;
}

const root = mkdtempSync(join(tmpdir(), "codewiki-package-smoke-"));
const previousStateRoot = process.env.CODEWIKI_STATE_ROOT;
const stateRoot = join(root, "state");
process.env.CODEWIKI_STATE_ROOT = stateRoot;
try {
	const pack = run("npm", ["pack", "--pack-destination", root]);
	const tarball = pack.stdout.trim().split(/\r?\n/).at(-1);
	assert.match(tarball, /^nunomoura-codewiki-.*\.tgz$/);
	const installRoot = join(root, "install");
	run("npm", ["install", "--prefix", installRoot, join(root, tarball)]);
	assert.equal(
		existsSync(
			join(
				installRoot,
				"node_modules",
				".bin",
				process.platform === "win32" ? "codewiki.cmd" : "codewiki",
			),
		),
		false,
	);
	assert.equal(
		existsSync(
			join(installRoot, "node_modules", "@earendil-works", "pi-coding-agent"),
		),
		false,
	);

	const smokeScript = join(installRoot, "smoke.mjs");
	writeFileSync(
		smokeScript,
		`import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as packageModule from "@nunomoura/codewiki";
import {
	CODEWIKI_EXTENSION_AVAILABLE,
	CLIENT_PROJECT_SERVER_PROTOCOL,
	CLIENT_PAIRING_PROTOCOL,
	PROJECT_SERVER_REGISTRY_PROTOCOL,
	PROJECT_SERVER_REPOSITORY_ACCESS_PROTOCOL,
	PROJECT_SERVER_SESSION_PROTOCOL,
	buildWorkState,
	checkProjectServerProviderRepositoryAccess,
	createNextChangeOperation,
	enrollProjectServerOidcActor,
	issueAuthorizedClientPairing,
	revokeAuthorizedClientPairing,
	normalizeClientProjectServerQuery,
	openProjectServerSession,
	projectAlignmentGraph,
	verifyProjectServerAuthentication,
	verifyProjectServerOidcAuthentication,
	normalizeProjectServerRegistrySnapshot,
} from "@nunomoura/codewiki";
import {
	buildWikiState,
	connectProjectServerApi,
	createProjectServerApi,
	runWikiConfig,
	stopProjectServer,
} from "@nunomoura/codewiki/project-server";

function filesUnder(root) {
	const files = [];
	for (const name of readdirSync(root).sort()) {
		const path = join(root, name);
		if (statSync(path).isDirectory()) files.push(...filesUnder(path));
		else files.push(path);
	}
	return files;
}

const packageRoot = join(process.cwd(), "node_modules", "@nunomoura", "codewiki");
const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
assert.equal(packageJson.name, "@nunomoura/codewiki");
assert.equal(packageJson.private, true);
assert.equal(packageJson.bin, undefined);
assert.equal(packageJson.publishConfig, undefined);
assert.deepEqual(packageJson.pi, { extensions: ["dist/pi-extension.js"] });
assert.equal(packageJson.pi.skills, undefined);
assert.deepEqual(
	packageJson.codewiki.checkPacks.map(({stage, packId}) => stage + "/" + packId),
	[
		"decision/software-development-default",
		"planning/software-development-default",
		"implementation/software-development-default",
		"review/software-development-default",
	],
);
assert.equal(
	existsSync(
		join(
			packageRoot,
			"check-packs",
			"decision",
			"software-development-default",
			"active_change_compatibility",
			"CHECK.md",
		),
	),
	true,
);
assert.equal(
	existsSync(join(packageRoot, "check-packs", "decision", "codewiki-project-server")),
	false,
);
assert.deepEqual(Object.keys(packageJson.exports).sort(), [
	".",
	"./checks",
	"./package.json",
	"./project-server",
	"./runtime",
]);
assert.deepEqual(packageJson.exports["./project-server"], {
	types: "./dist/project-server/index.d.ts",
	import: "./dist/project-server/index.js",
});
assert.deepEqual(packageJson.exports["./runtime"], {
	types: "./dist/runtime/index.d.ts",
	import: "./dist/runtime/index.js",
});
assert.deepEqual(packageJson.exports["./checks"], {
	types: "./dist/checks/index.d.ts",
	import: "./dist/checks/index.js",
});
assert.equal(packageJson.exports["./pi-sdk"], undefined);
assert.equal(
\tpackageJson.peerDependencies["@earendil-works/pi-coding-agent"],
\t">=0.80.10 <0.82.0 || 0.84.2",
);
assert.equal(
\tpackageJson.peerDependenciesMeta["@earendil-works/pi-coding-agent"].optional,
\ttrue,
);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "reactions.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "reactions.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "reactor.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "job-id.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "executor.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "executor.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "api", "loop-execution.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "change-trace")), false);
assert.equal(existsSync(join(packageRoot, "dist", "traces")), false);
assert.equal(existsSync(join(packageRoot, "dist", "views")), false);
assert.equal(existsSync(join(packageRoot, "dist", "loops")), true);
assert.equal(existsSync(join(packageRoot, "dist", "checks")), true);
assert.equal(existsSync(join(packageRoot, "dist", "verification")), false);
assert.equal(existsSync(join(packageRoot, "dist", "decision")), false);
assert.equal(existsSync(join(packageRoot, "dist", "planning")), false);
assert.equal(existsSync(join(packageRoot, "dist", "implementation")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "loop-exit")), false);
assert.equal(existsSync(join(packageRoot, "dist", "semantic-loop.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "error-handling", "trace-errors.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "error-handling", "config-errors.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project", "config-errors.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project", "config-errors.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "queries", "projection-types.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "queries", "project-board.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "work-state", "projection-types.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "work-state", "work-queue.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "alignment", "graph.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "alignment", "query.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "checks", "quality", "evaluator.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "checks", "quality", "graph.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "checks", "quality", "runner.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "loops", "implementation", "quality-feedback.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "loops", "review", "contracts.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "runtime", "review", "index.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "runtime", "security", "scanners.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "lifecycle", "decision.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "changes", "trace", "index.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "changes", "trace", "storage-errors.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "runtime-reaction-jobs.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "reactor.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "semantic-job-id.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "semantic-executor.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "persistence", "dev-log.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "persistence", "tmp.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "operations", "state.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "operations", "lifecycle.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project", "private-state.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "persistence", "trace.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "pairing", "authorization.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "pairing", "authorization.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "admission", "authority.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "admission", "authority.d.ts")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "repository-access", "check.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "repository-access", "check.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "implementation", "worker-observation-authority.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "persistence", "trace.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "dev-log.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "tmp.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "trace-writer.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "admission", "automation.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "claims", "policy.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "claims", "policy.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "heartbeat-policy.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "heartbeat-policy.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "policy.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "policy.d.ts")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "implementation-adapter.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "execution-policy.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "prompt.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "reports.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "start.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "handoff.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "checks", "index.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "checks", "packs", "defaults.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "checks", "packs", "loader.js")), true);
assert.equal(
	existsSync(
		join(
			packageRoot,
			"dist",
			"domains",
			"software-development",
			"check-packs.js",
		),
	),
	true,
);
assert.equal(existsSync(join(packageRoot, "dist", "runtime", "checks", "code.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "runtime", "checks", "model.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "changes", "triage", "standards.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "checks", "packs", "runtime.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "user-standard-distillation.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "user-standard-distillation.d.ts")), false);
assert.equal(existsSync(join(packageRoot, "dist", "loops", "decision", "research.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "loops", "decision", "research-claims.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "loops", "decision", "research-executors.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "admission", "start.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "admission", "git.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "admission", "change.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "decision-attempt.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "gate-operations.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "decision-operations.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "lifecycle", "decision.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "lifecycle", "gates.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "research-collection.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "loop-exit-runtime.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "decision-research.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "decision-research-claims.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "native-decision-research.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "decision-attention-selection.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "decision-git-admission.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "native-decision-executor.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "native-decision-operations.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "change-intake.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "decision-research-collection.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "handoff.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "pi", "worker-start.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "pi", "worker-reports.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "clients", "app", "shell.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "clients", "cli", "index.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "cli")), false);
assert.equal(
	existsSync(
		join(
			packageRoot,
			"dist",
			"clients",
			"app",
			"assets",
			"codewiki-logo.png",
		),
	),
	true,
);
assert.equal(
	existsSync(join(packageRoot, "dist", "dashboard")),
	false,
	"legacy Dashboard root is not packaged",
);
for (const name of [
	"app-state",
	"changes",
	"configuration",
	"dev-log",
	"state",
]) {
	assert.equal(
		existsSync(join(packageRoot, "dist", "project-server", "queries", name + ".js")),
		true,
		name,
	);
}
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "app", "daemon.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "app", "server.js")), true);
assert.equal(
	existsSync(join(packageRoot, "dist", "project-server", "app", "request-error.js")),
	false,
);
assert.equal(
	existsSync(join(packageRoot, "dist", "project-server", "app", "installed-codewiki.js")),
	true,
);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator-entrypoint.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator-entrypoint.d.ts")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "index.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "index.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "runtime", "index.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "runtime", "contracts.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "runtime", "runtime.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "runtime", "builds", "store.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "runtime", "processes", "protocol.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "api.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "api.d.ts")), true);
for (const name of ["archive", "implementation", "planning", "work"]) {
	assert.equal(
		existsSync(join(packageRoot, "dist", "project-server", "commands", name + ".js")),
		true,
		name,
	);
}
assert.equal(existsSync(join(packageRoot, "dist", "api")), false);
assert.equal(existsSync(join(packageRoot, "dist", "api", "protocol.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "api", "protocol.d.ts")), false);
assert.equal(existsSync(join(packageRoot, "dist", "protocol", "client-project-server.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "protocol", "client-project-server.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "protocol", "client-pairing.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "protocol", "client-pairing.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "api", "input-validation.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "api", "wiki-config.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "api", "views.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "api", "traces.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "host")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "authentication", "oidc.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "authentication", "oidc.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "authentication", "proof.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "authentication", "proof.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "registry", "enrollment.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "registry", "enrollment.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "registry", "local.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "registry", "local.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "registry", "state.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "registry", "state.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "utils", "time.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "utils", "time.d.ts")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "pairing", "commands.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "pairing", "commands.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "sessions", "contracts.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "sessions", "contracts.d.ts")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "sessions", "state.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "sessions", "state.d.ts")), true);
assert.doesNotMatch(
	readFileSync(join(packageRoot, "dist", "project-server", "pairing", "commands.d.ts"), "utf8"),
	/verifyProjectServerAuthentication|ProjectServerAuthenticationProof|ProjectServerAuthenticationAdapter/,
);
assert.doesNotMatch(
	readFileSync(join(packageRoot, "dist", "project-server", "registry", "state.d.ts"), "utf8"),
	/export (?:interface ProjectServerAuthenticationAssertion|declare function normalizeProjectServerAuthenticationAssertion)/,
);
assert.equal(existsSync(join(packageRoot, "dist", "error-handling", "host-errors.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "error-handling", "execution-errors.js")), false);
assert.equal(CLIENT_PROJECT_SERVER_PROTOCOL.id, "codewiki.client-project-server");
assert.equal(CLIENT_PROJECT_SERVER_PROTOCOL.version, "1.0.0");
assert.equal(PROJECT_SERVER_REGISTRY_PROTOCOL.id, "codewiki.project-server-registry");
assert.equal(PROJECT_SERVER_REGISTRY_PROTOCOL.version, "2.0.0");
assert.equal(CLIENT_PAIRING_PROTOCOL.id, "codewiki.client-pairing");
assert.equal(CLIENT_PAIRING_PROTOCOL.version, "1.0.0");
assert.equal(PROJECT_SERVER_SESSION_PROTOCOL.id, "codewiki.project-server-session");
assert.equal(PROJECT_SERVER_SESSION_PROTOCOL.version, "1.0.0");
assert.equal(PROJECT_SERVER_REPOSITORY_ACCESS_PROTOCOL.version, "1.0.0");
assert.equal(typeof checkProjectServerProviderRepositoryAccess, "function");
assert.equal(typeof createNextChangeOperation, "function");
assert.equal(typeof projectAlignmentGraph, "function");
assert.equal(typeof packageModule.createReviewAttempt, "function");
assert.equal(typeof packageModule.createReviewGate, "function");
assert.equal(typeof packageModule.createGateEvaluationPackage, "function");
assert.equal(typeof packageModule.assertGateEvaluationPackage, "function");
assert.equal(typeof packageModule.commitReviewOperationSequence, "function");
assert.equal(typeof issueAuthorizedClientPairing, "function");
assert.equal(typeof revokeAuthorizedClientPairing, "function");
assert.equal(packageModule.issueClientPairing, undefined);
assert.equal(packageModule.revokeClientPairing, undefined);
assert.equal(typeof openProjectServerSession, "function");
assert.equal(typeof verifyProjectServerAuthentication, "function");
assert.equal(typeof verifyProjectServerOidcAuthentication, "function");
assert.equal(typeof enrollProjectServerOidcActor, "function");
assert.equal(
	normalizeProjectServerRegistrySnapshot({
		protocolId: PROJECT_SERVER_REGISTRY_PROTOCOL.id,
		protocolVersion: PROJECT_SERVER_REGISTRY_PROTOCOL.version,
		generation: 1,
		generatedAt: "2026-08-13T10:00:00.000Z",
		actors: [],
		pairings: [],
		projects: [],
	}).generation,
	1,
);
assert.equal(
	normalizeClientProjectServerQuery({
		protocolId: CLIENT_PROJECT_SERVER_PROTOCOL.id,
		protocolVersion: CLIENT_PROJECT_SERVER_PROTOCOL.version,
		kind: "query",
		transportRequestId: "packed:query",
		actor: {
			actorId: "user:packed",
			authenticatedIdentityRef: "identity:packed",
		},
		client: {
			clientKind: "cli",
			clientInstanceId: "cli:packed",
			authenticationRef: "auth:packed",
		},
		repositoryIdentity: "sha256:" + "1".repeat(64),
		queryName: "runtime.state",
		maxItems: 1,
		payload: {},
	}).actor.actorId,
	"user:packed",
);
assert.equal(existsSync(join(packageRoot, "dist", "loops", "planning", "exit", "index.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "loops", "implementation", "exit", "index.js")), false);
assert.equal(
	existsSync(join(packageRoot, "dist", "harnesses")),
	false,
	"legacy Harness root is not packaged",
);
for (const name of ["adapter", "command", "git-mount", "options"]) {
	assert.equal(
		existsSync(
			join(packageRoot, "dist", "project-server", "workbenches", "container", name + ".js"),
		),
		true,
		name,
	);
}
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "implementation-report-store.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "implementation-artifacts.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "observation.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "dispatch.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "workers", "jobs.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "integration", "worker.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "claims", "release.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "implementation-worker-dispatch.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "implementation-worker-jobs.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "implementation-worker-review.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "implementation-worker-integration.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "claims", "events.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "claims", "leases.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "claims", "work-unit-events.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "claims", "work-unit-selection.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "project-branch-merge.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "project-branch-merge-git.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "project-branch-push.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "project-branch-push-operations.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "project-branch-push-manifest.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "product-publication.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "product-publication-proof.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "product-publication-contract.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "product-publication-artifact.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "product-publication-manifest.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "product-release.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "product-release-proof.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "product-release-contract.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "effects", "product-release-manifest.js")), true);
assert.equal(
	existsSync(join(packageRoot, "dist", "project-server", "coordinator", "daemon-process.js")),
	true,
);
const dshRuntimeArtifact = join(
	packageRoot,
	"dist",
	"runtime-builds",
	"dsh-replay-run-process.mjs",
);
assert.equal(existsSync(dshRuntimeArtifact), true);
const dshRuntimeArtifactSource = readFileSync(dshRuntimeArtifact, "utf8");
assert.equal(dshRuntimeArtifactSource.includes('from "@deepseek-ai/'), false);
assert.equal(dshRuntimeArtifactSource.includes("from '@deepseek-ai/"), false);
assert.equal(CODEWIKI_EXTENSION_AVAILABLE, true);
const runtimeModule = await import("@nunomoura/codewiki/runtime");
assert.equal(typeof runtimeModule.createRuntime, "function");
assert.equal(typeof runtimeModule.createStageContextSnapshot, "function");
assert.equal(typeof runtimeModule.createStageContextBundle, "function");
assert.equal(typeof runtimeModule.createStageContextFacade, "function");
assert.equal(typeof runtimeModule.createProjectContextFacade, "function");
assert.equal(typeof runtimeModule.mountProjectContextSnapshot, "function");
assert.equal(typeof runtimeModule.registerDshProjectContextTools, "function");
assert.match(runtimeModule.DSH_PROJECT_CONTEXT_TOOL_SET_DIGEST, /^sha256:[0-9a-f]{64}$/);
assert.match(runtimeModule.DSH_STAGE_CONTEXT_TOOL_SET_DIGEST, /^sha256:[0-9a-f]{64}$/);
assert.equal(typeof runtimeModule.createRunContinuationBinding, "function");
assert.equal(typeof runtimeModule.createStageRunContinuationBinding, "function");
assert.equal(runtimeModule.RUN_CONTINUATION_PROTOCOL.version, "1.0.0");
assert.equal(runtimeModule.COMPACTION_SUMMARY_PROTOCOL.version, "1.0.0");
assert.equal(typeof runtimeModule.createExecutionLedgerHeader, "function");
assert.equal(typeof runtimeModule.assertExecutionLedgerEntry, "function");
assert.equal(typeof runtimeModule.openStoredExecutionLedger, "function");
assert.equal(typeof runtimeModule.appendStoredRunRawLogChunk, "function");
assert.equal(typeof runtimeModule.recoverStoredRawLogAppends, "function");
assert.equal(typeof runtimeModule.commitStoredRunReceipt, "function");
assert.equal(runtimeModule.LEGACY_RUNTIME_BUILD_SCHEMA_VERSION, "3.0.0");
assert.equal(runtimeModule.RUNTIME_BUILD_SCHEMA_VERSION, "4.0.0");
assert.equal(runtimeModule.BACKEND_SUPPORT_MATRIX_PROTOCOL.version, "1.0.0");
assert.equal(runtimeModule.RUNTIME_PRODUCTION_QUALIFICATION_PROTOCOL.version, "1.0.0");
assert.equal(typeof runtimeModule.createRuntimeProductionQualification, "function");
assert.equal(typeof runtimeModule.createStoredRuntimeOperationsInspectionPort, "function");
assert.equal(typeof runtimeModule.createExecutablePluginAdmissionClosure, "function");
assert.equal(typeof runtimeModule.executablePluginAdmissionClosureDigest, "function");
assert.equal(runtimeModule.createExecutablePluginManifest, undefined);
assert.equal(runtimeModule.createExecutablePluginInventory, undefined);
assert.equal(typeof runtimeModule.runDshRuntimeBridge, "function");
assert.equal(typeof runtimeModule.createDshPrivateProviderBrokerInstaller, "function");
assert.equal(typeof runtimeModule.createPrivateProviderBrokerBinding, "function");
assert.equal(typeof runtimeModule.createProviderBrokerRunAuthorization, "function");
assert.equal(typeof runtimeModule.startPrivateProviderBrokerServer, "function");
assert.equal(typeof runtimeModule.createDshProviderHost, "function");
assert.equal(runtimeModule.DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS.length, 6);
assert.equal(typeof runtimeModule.readDshRuntimeProvenance, "function");
assert.equal(runtimeModule.DSH_REVIEWED_SOURCE.version, "0.1.1-rc.2");
assert.equal(
	runtimeModule.DSH_SUPPORT_PACKAGE_VERSIONS["@deepseek-ai/cordis-plugin-loader"],
	"1.0.2",
);
assert.equal(
	runtimeModule.DSH_SUPPORT_PACKAGE_VERSIONS["@earendil-works/pi-ai"],
	"0.82.1",
);
assert.equal(runtimeModule.DSH_REVIEWED_SOURCE.commit.length, 40);
const checksModule = await import("@nunomoura/codewiki/checks");
assert.equal(typeof checksModule.createCheckSdk, "function");
assert.equal(typeof checksModule.prepareCheckPackTransport, "function");
assert.equal(typeof checksModule.installCheckPackTransport, "function");
const projectServerModule = await import("@nunomoura/codewiki/project-server");
assert.deepEqual(Object.keys(projectServerModule).sort(), [
	"BACKEND_BACKUP_PROTOCOL",
	"BACKEND_BUILD_PROTOCOL",
	"BACKEND_BUILD_TRANSITION_PROTOCOL",
	"BACKEND_FAULT_RECOVERY_MATRIX",
	"BACKEND_FAULT_RECOVERY_PROTOCOL",
	"BACKEND_OBSERVABILITY_PROTOCOL",
	"BACKEND_PRODUCTION_FAULTS",
	"BACKEND_STATE_MIGRATION_PROTOCOL",
	"BACKEND_STATE_PROTOCOL",
	"BACKEND_STATE_RECOVERY_PROTOCOL",
	"BACKEND_STATE_RESTORE_PROTOCOL",
	"BACKEND_V1_RELEASE_EVIDENCE_NAMES",
	"BACKEND_V1_RELEASE_MANIFEST_PROTOCOL",
	"CHANGE_INTAKE_RUNTIME_PROTOCOL",
	"CODEWIKI_MCP_NAMESPACE",
	"CODEWIKI_MCP_OPERATIONS",
	"CODEWIKI_PACKAGE_LOCK_DIGEST",
	"DEFAULT_BACKEND_BUILD",
	"DSH_AGENT_SESSION_CUSTODY_PROTOCOL",
	"EXTERNAL_CANDIDATE_CAPTURE_PROTOCOL",
	"HARNESS_OBSERVER_PROJECTION_PROTOCOL",
	"KB_TO_WIKI_LEGACY_SOURCE_SNAPSHOT_PROTOCOL",
	"KB_TO_WIKI_MIGRATION_STAGING_EVIDENCE_PROTOCOL",
	"LEGACY_BACKEND_BUILD_PROTOCOL",
	"SCHEDULING_PLAN_PROTOCOL",
	"SESSION_CONTINUITY_PROTOCOL",
	"WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL",
	"acquireSessionLease",
	"activateBackendBuild",
	"admitExternalCandidateCapture",
	"appendProjectSessionContinuity",
	"assertBackendBuildBinding",
	"assertBackendFaultRecoveryMatrix",
	"assertBackendV1ReleaseManifest",
	"assertCurrentAggregateReviewAttempt",
	"assertExternalCandidateCapture",
	"assertHarnessInteractionBinding",
	"assertHarnessObserverProjection",
	"assertKbToWikiMigrationReadiness",
	"assertSessionContinuityRecord",
	"authorizeDshAgentSessionCustody",
	"backendBuildDomainClosureCompatible",
	"backendBuildFileSchemasCompatible",
	"backendBuildIncompatibleFileSchema",
	"backendBuildSupportsStateSchema",
	"backendFaultRecoveryPolicy",
	"backendOperationalBinding",
	"backendV1ContractFreezeDigest",
	"bindKbToWikiMigrationStagingEvidence",
	"bootstrapBackendState",
	"bootstrapStandaloneProjectServer",
	"buildKbToWikiLegacySourceSnapshot",
	"buildProjectWikiState",
	"buildWikiState",
	"canonicalProjectSnapshotDigest",
	"collectBackendAuditRecords",
	"commitGuardedDelivery",
	"commitImplementationAggregate",
	"commitPrivateIntegrationAdmission",
	"commitProjectSchedulingPlan",
	"commitSessionRunReceipt",
	"connectProjectServerApi",
	"createAggregateReviewAttempt",
	"createBackendBuildBinding",
	"createBackendStateBackup",
	"createBackendV1ReleaseManifest",
	"createChangeIntakeProjectServer",
	"createCodeWikiLoopExecutionPorts",
	"createCodewikiMcpBinding",
	"createDeliveryAuthority",
	"createExternalCandidateCapture",
	"createGuardedDeliveryOperation",
	"createHarnessCandidateSubmission",
	"createHarnessInteractionBinding",
	"createHarnessObserverProjection",
	"createImplementationAggregateFreeze",
	"createImplementationOperationSequence",
	"createImplementationRunRequest",
	"createImplementationStageGate",
	"createPrivateIntegrationAdmission",
	"createProjectSchedulingPlan",
	"createProjectServerApi",
	"createProjectSessionContinuity",
	"createSchedulingOperationSequence",
	"createSessionContinuity",
	"createWorkUnitModelAssignment",
	"deriveReadyWorkUnits",
	"executionFailureFromProviderReceipt",
	"expireSessionLease",
	"inspectBackendOperations",
	"legacyProjectStateSnapshotDigest",
	"migrateBackendState",
	"normalizeCodewikiMcpRequest",
	"privateChangeIntegrationRef",
	"projectOperationalStatus",
	"pruneBackendStateBackups",
	"readBackendStateBackup",
	"readBackendStateManifest",
	"readProjectSessionContinuity",
	"readStandaloneProjectServerStatus",
	"recoverBackendStateManifest",
	"requestSessionLeaseCancellation",
	"resolveExecutionRecovery",
	"restartStandaloneProjectServer",
	"restoreBackendStateBackup",
	"rollbackStandaloneBackend",
	"rolloverSessionContinuity",
	"runHarnessProducerTurn",
	"runModelRouteForAssignment",
	"runProjectServer",
	"runProjectServerSemanticExecutor",
	"runWikiArchive",
	"runWikiChange",
	"runWikiConfig",
	"runWikiDecide",
	"runWikiOkf",
	"runWikiPlan",
	"startStandaloneProjectServer",
	"stopProjectServer",
	"stopStandaloneProjectServer",
	"uninstallStandaloneBackendState",
	"upgradeStandaloneBackend",
	"wikiChangeOperationMutates",
]);
assert.equal(projectServerModule.WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL.version, "2.0.0");
assert.equal(typeof createProjectServerApi, "function");
const {spawnProjectCoordinatorDaemon} = await import(
	pathToFileURL(
		join(
			packageRoot,
			"dist",
			"project-server",
			"coordinator",
			"daemon-process.js",
		),
	).href,
);
const {bootstrapCodewiki} = await import(
	pathToFileURL(join(packageRoot, "dist", "project", "bootstrap.js")).href,
);
await bootstrapCodewiki(process.cwd(), {projectName: "packed-project-server"});
for (const stage of ["decision", "planning", "implementation", "review"]) {
	assert.equal(
		existsSync(
			join(
				process.cwd(),
				".codewiki",
				"check-packs",
				stage,
				"software-development-default",
			),
		),
		true,
	);
}
assert.equal(
	existsSync(
		join(
			process.cwd(),
			".codewiki",
			"check-packs",
			"decision",
			"codewiki-project-server",
		),
	),
	false,
);
const projectServerApi = await connectProjectServerApi(
	process.cwd(),
	{
		clientId: "packed:runtime-client",
		kind: "test",
		supervision: "approved",
	},
	{spawnDaemon: spawnProjectCoordinatorDaemon},
);
assert.equal((await projectServerApi.queries.state()).supervisorCount, 1);
const appRequestContext = {
	actor: {actorId: "user:pack", authenticatedIdentityRef: "identity:pack"},
	client: {clientKind: "app", clientInstanceId: "app:pack", authenticationRef: "auth:pack"},
};
assert.equal((await projectServerApi.queries.appState(appRequestContext)).projectRoot, process.cwd());
assert.deepEqual((await projectServerApi.queries.changes(appRequestContext)).records, []);
assert.equal((await projectServerApi.queries.configuration(appRequestContext)).validation, "valid");
assert.equal(typeof projectServerApi.queries.inspect, "function");
assert.equal(typeof projectServerApi.queries.decisionAttention, "function");
assert.deepEqual(Object.keys(projectServerApi.queries).sort(), [
	"appState",
	"changes",
	"configuration",
	"decisionAttention",
	"inspect",
	"state",
]);
assert.equal(typeof projectServerApi.commands.selectDecision, "function");
assert.equal(typeof projectServerApi.commands.submitCandidate, "function");
assert.deepEqual(Object.keys(projectServerApi.commands).sort(), [
	"selectDecision",
	"submitCandidate",
]);
assert.equal(
	(await projectServerApi.events.read(0)).events[0].state,
	"client_connected",
);
await projectServerApi.connection.heartbeat();
await projectServerApi.connection.disconnect();
await stopProjectServer(process.cwd());
assert.equal(existsSync(join(process.cwd(), ".codewiki", "runtime")), false);
assert.equal(existsSync(join(process.cwd(), ".codewiki", "views")), false);
await assert.rejects(
	import("@nunomoura/codewiki/coordinator"),
	(error) => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);
const runtimeDeclarations = readFileSync(
	join(packageRoot, "dist", "project-server", "api.d.ts"),
	"utf8",
);
assert.equal(runtimeDeclarations.includes("ProjectCoordinator"), false);
assert.deepEqual(buildWikiState({ records: [] }).traceIds, []);
assert.deepEqual(buildWorkState({ records: [] }).changeIds, []);
assert.match(buildWorkState({ records: [] }).snapshotDigest, /^sha256:[a-f0-9]{64}$/);
assert.equal(runWikiConfig({}).config.project, "codewiki");
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "app", "authorization.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project", "config-digest.js")), false);

for (const dependency of Object.keys(packageJson.dependencies || {})) {
	assert.equal(
		dependency.startsWith("@earendil-works/") &&
		dependency !== "@earendil-works/pi-ai",
		false,
	);
}
assert.equal(packageJson.dependencies["@earendil-works/pi-ai"], "0.82.1");
assert.equal(packageJson.dependencies["js-yaml"], undefined);
assert.equal(packageJson.dependencies.yaml.startsWith("^2."), true);
assert.equal(packageJson.dependencies.typebox, undefined);
assert.deepEqual(packageJson.peerDependencies, {
	"@earendil-works/pi-coding-agent": ">=0.80.10 <0.82.0 || 0.84.2",
	typebox: "*",
});
for (const forbiddenPath of [
	"lab",
	"tests",
	".codewiki",
	".pi",
	"_OLD_VERSION",
	"benchmarks",
	"private",
	"sealed",
	join("dist", "lab"),
	join("dist", "benchmarks"),
	join("dist", "tests"),
	join("dist", "ideas"),
]) {
	assert.equal(existsSync(join(packageRoot, forbiddenPath)), false, forbiddenPath);
}
for (const path of filesUnder(packageRoot)) {
	if (!/\\.(?:js|d\\.ts|md|json)$/.test(path)) continue;
	const content = readFileSync(path, "utf8");
	for (const forbidden of [
		"wiki_ideas",
		"refs/codewiki/ideas",
		"ProposedChange",
		"src/ideas/",
	]) {
		assert.equal(content.includes(forbidden), false, path + ": " + forbidden);
	}
}
assert.equal(readdirSync(join(packageRoot, "dist")).includes("pi"), false);
assert.equal(
	existsSync(join(packageRoot, "dist", "runtime", "pi")),
	false,
	"temporary Pi execution runtime is not packaged",
);
assert.equal(
	existsSync(join(packageRoot, "dist", "runtime", "contracts.js")),
	true,
);
assert.equal(
	existsSync(join(packageRoot, "dist", "pi", "process-session.js")),
	false,
	"legacy trace-host shell is not packaged",
);
assert.equal(existsSync(join(packageRoot, "dist", "preview", "evidence.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "changes", "trace", "store.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "changes", "git-ref-store.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "changes", "legacy-migration.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "changes", "legacy-ref-reader.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "work-state", "projector.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "work-state", "session.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "reactor.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "reactor.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "project.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "entrypoint.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "project-reactors.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "process.js")), true);
assert.equal(existsSync(join(packageRoot, "dist", "project-server", "coordinator", "daemon.js")), true);
assert.equal(
	existsSync(
		join(packageRoot, "dist", "project-server", "coordinator", "daemon-process.js"),
	),
	true,
);
assert.equal(existsSync(join(packageRoot, "dist", "clients", "pi", "project-coordinator-daemon.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "clients", "pi", "project-service-client.js")), true);
assert.equal(
	existsSync(join(packageRoot, "dist", "clients", "pi", "dashboard-session-actions.js")),
	false,
);
assert.equal(existsSync(join(packageRoot, "dist", "dashboard", "session-actions.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "clients", "pi", "runtime-tool-routing.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "pi", "project-coordinator-daemon.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "pi", "project-service-client.js")), false);
assert.equal(existsSync(join(packageRoot, "dist", "pi", "runtime-tool-routing.js")), false);
assert.equal(readFileSync(join(packageRoot, "dist", "pi-extension.js"), "utf8").includes("lab/"), false);
assert.equal(readFileSync(join(packageRoot, "dist", "clients", "pi", "prompt", "index.js"), "utf8").includes("lab/"), false);

const extension = await import(pathToFileURL(join(packageRoot, "dist", "pi-extension.js")).href);
const prompt = await import(pathToFileURL(join(packageRoot, "dist", "clients", "pi", "prompt", "index.js")).href);
const tui = await import(pathToFileURL(join(packageRoot, "dist", "clients", "pi", "tui", "index.js")).href);
assert.equal(prompt.codewikiPromptHooksAvailable, true);
assert.equal(tui.codewikiTuiRenderersAvailable, true);
assert.equal(typeof tui.renderBootstrapCommand, "function");
assert.equal(typeof extension.default, "function");
const tools = [];
const commands = [];
const events = [];
extension.default({
	registerTool(tool) {
		tools.push(tool.name);
	},
	registerCommand(name) {
		commands.push(name);
	},
	on(eventName, handler) {
		events.push({ eventName, handler });
	},
});
assert.deepEqual(tools, [
	"wiki_state",
	"wiki_attention",
	"wiki_config",
	"wiki_change",
	"wiki_archive",
]);
assert.deepEqual(events.map((event) => event.eventName), [
	"before_agent_start",
	"tool_result",
	"session_shutdown",
	"session_start",
	"session_shutdown",
]);
const promptHook = events.find((event) => event.eventName === "before_agent_start");
const footerHook = events.find((event) => event.eventName === "session_start");
const statuses = [];
await footerHook.handler(
	{ reason: "startup" },
	{
		cwd: process.cwd(),
		ui: {
			notify() {},
			setStatus(key, value) {
				statuses.push({ key, value });
			},
		},
	},
);
assert.equal(statuses.length, 1);
assert.equal(statuses[0].key, "codewiki");
assert.match(
	statuses[0].value,
	/^CodeWiki \\S+ non-project · dashboard live · \\/wiki-dashboard reopen$/,
);
assert.deepEqual(commands, [
	"wiki-dashboard",
	"wiki-attention",
	"wiki-select",
	"wiki-resume",
	"wiki-explain",
	"wiki-config",
	"wiki-bootstrap",
]);
const injected = await promptHook.handler({ systemPrompt: "base" }, { cwd: process.cwd() });
assert.match(injected.systemPrompt, /CodeWiki Pi guidance/);
assert.equal(injected.systemPrompt.includes("wiki_state"), true);
assert.equal(injected.systemPrompt.includes("runtimeReaction"), true);
assert.equal(injected.systemPrompt.includes("wiki_decide"), false);
assert.equal(
	injected.systemPrompt.includes("open the Work Pipeline dashboard automatically"),
	true,
);
assert.equal(injected.systemPrompt.includes("/wiki or"), false);
assert.deepEqual(await promptHook.handler({ systemPrompt: injected.systemPrompt }, { cwd: process.cwd() }), {});
`,
	);
	run(process.execPath, [smokeScript], {cwd: installRoot});
} finally {
	const lifecyclePath = join(
		root,
		"install",
		"node_modules",
		"@nunomoura",
		"codewiki",
		"dist",
		"project-server",
		"index.js",
	);
	if (existsSync(lifecyclePath)) {
		const lifecycle = await import(pathToFileURL(lifecyclePath).href);
		await lifecycle.stopStandaloneProjectServer(join(root, "install"), {
			stateRoot,
			timeoutMs: 2_000,
		}).catch(() => undefined);
	}
	if (previousStateRoot === undefined) delete process.env.CODEWIKI_STATE_ROOT;
	else process.env.CODEWIKI_STATE_ROOT = previousStateRoot;
	rmSync(root, {recursive: true, force: true});
}
