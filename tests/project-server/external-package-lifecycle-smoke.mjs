import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { acceptedChangeFixture } from "../helpers/accepted-change.mjs";

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

function mockPi() {
	const tools = [];
	const commands = [];
	return {
		tools,
		commands,
		api: {
			registerTool(tool) {
				tools.push(tool);
			},
			registerCommand(name, command) {
				commands.push({ name, command });
			},
			on() {},
		},
	};
}

function toolByName(pi, name) {
	const tool = pi.tools.find((candidate) => candidate.name === name);
	assert.ok(tool, `missing tool ${name}`);
	return tool;
}

function commandByName(pi, name) {
	const command = pi.commands.find((candidate) => candidate.name === name);
	assert.ok(command, `missing command ${name}`);
	return command.command;
}

function assertToolResult(result, pattern) {
	assert.match(result.content[0].text, pattern);
	assert.ok(result.details.result);
	return result.details.result;
}

const root = mkdtempSync(
	join(tmpdir(), "codewiki-external-package-lifecycle-"),
);
const stateRoot = join(root, "server-state");
process.env.CODEWIKI_STATE_ROOT = stateRoot;
let lifecycleApi;
let projectRoot;
let secondProjectRoot;
try {
	const packRoot = join(root, "pack");
	const installRoot = join(root, "install");
	projectRoot = join(root, "external-project");
	mkdirSync(packRoot);
	mkdirSync(installRoot);
	mkdirSync(projectRoot);
	mkdirSync(join(projectRoot, "src"));
	mkdirSync(join(projectRoot, "tests"));
	writeFileSync(
		join(projectRoot, "package.json"),
		`${JSON.stringify({ name: "codewiki-external-lifecycle", type: "module" }, null, "\t")}\n`,
	);
	writeFileSync(
		join(projectRoot, "README.md"),
		"# External Lifecycle Fixture\n\nA fresh project used by CodeWiki package lifecycle.\n",
	);
	writeFileSync(
		join(projectRoot, "src", "external-feature.js"),
		"export const externalLifecycleFeature = 'ready';\n",
	);
	writeFileSync(
		join(projectRoot, "tests", "external-feature.test.mjs"),
		`import assert from "node:assert/strict";\nimport { externalLifecycleFeature } from "../src/external-feature.js";\nassert.equal(externalLifecycleFeature, "ready");\n`,
	);

	const pack = run("npm", ["pack", "--pack-destination", packRoot]);
	const tarball = pack.stdout.trim().split(/\r?\n/).at(-1);
	assert.match(tarball, /^nunomoura-codewiki-.*\.tgz$/);
	run("npm", ["install", "--prefix", installRoot, join(packRoot, tarball)]);
	assert.equal(existsSync(join(projectRoot, ".codewiki")), false);
	assert.equal(existsSync(stateRoot), false);
	const packageRoot = join(
		installRoot,
		"node_modules",
		"@nunomoura",
		"codewiki",
	);
	assert.equal(
		existsSync(join(packageRoot, "dist", "pi-extension.js")),
		true,
	);

	const {default: codewikiExtension} = await import(
		pathToFileURL(join(packageRoot, "dist", "pi-extension.js")).href
	);
	lifecycleApi = await import(
		pathToFileURL(join(packageRoot, "dist", "project-server", "index.js")).href
	);

	const pi = mockPi();
	codewikiExtension(pi.api);
	const bootstrapCommand = commandByName(pi, "wiki-bootstrap");
	const dashboardCommand = commandByName(pi, "wiki-dashboard");
	const stateTool = toolByName(pi, "wiki_state");
	const attentionTool = toolByName(pi, "wiki_attention");
	const changeTool = toolByName(pi, "wiki_change");
	for (const name of ["wiki_decide", "wiki_plan", "wiki_implement"]) {
		assert.equal(pi.tools.some((tool) => tool.name === name), false, name);
	}
	const notifications = [];
	const ctx = {
		cwd: projectRoot,
		mode: "rpc",
		ui: {
			notify(message) {
				notifications.push(message);
			},
		},
	};

	await assert.rejects(
		() =>
			stateTool.execute("pre-bootstrap-state", {}, undefined, undefined, ctx),
		/No CodeWiki project found/,
	);
	const bootstrap = await bootstrapCommand.handler(
		"--allow-non-project-install --json",
		ctx,
	);
	assert.equal(bootstrap.data.created.includes(".codewiki/config.json"), true);
	assert.equal(existsSync(join(projectRoot, ".codewiki", "runtime")), false);
	assert.equal(existsSync(join(projectRoot, ".codewiki", "views")), false);
	const initialState = await lifecycleApi.bootstrapStandaloneProjectServer({
		repoRoot: projectRoot,
		stateRoot,
		createdAt: "2026-06-18T08:00:00.000Z",
	});
	assert.equal(
		(await lifecycleApi.readStandaloneProjectServerStatus({repoRoot: projectRoot, stateRoot})).lifecycle,
		"stopped",
	);
	const firstStart = await lifecycleApi.startStandaloneProjectServer(projectRoot, {
		stateRoot,
		timeoutMs: 10_000,
	});
	assert.equal(firstStart.lifecycle, "running");
	const restarted = await lifecycleApi.restartStandaloneProjectServer(projectRoot, {
		stateRoot,
		timeoutMs: 10_000,
	});
	assert.equal(restarted.lifecycle, "running");
	assert.notEqual(restarted.process.generationId, firstStart.process.generationId);
	await lifecycleApi.stopStandaloneProjectServer(projectRoot, {stateRoot, timeoutMs: 10_000});
	secondProjectRoot = join(root, "external-project-two");
	mkdirSync(join(secondProjectRoot, ".codewiki"), {recursive: true});
	writeFileSync(join(secondProjectRoot, ".codewiki", "config.json"), "{}\n");
	await lifecycleApi.bootstrapStandaloneProjectServer({
		repoRoot: secondProjectRoot,
		stateRoot,
		createdAt: "2026-06-18T08:02:00.000Z",
	});
	const [firstMultiProject, secondMultiProject] = await Promise.all([
		lifecycleApi.startStandaloneProjectServer(projectRoot, {stateRoot, timeoutMs: 10_000}),
		lifecycleApi.startStandaloneProjectServer(secondProjectRoot, {stateRoot, timeoutMs: 10_000}),
	]);
	assert.notEqual(firstMultiProject.repositoryIdentity, secondMultiProject.repositoryIdentity);
	await lifecycleApi.stopStandaloneProjectServer(projectRoot, {stateRoot, timeoutMs: 10_000});
	assert.equal(
		(await lifecycleApi.readStandaloneProjectServerStatus({
			repoRoot: secondProjectRoot,
			stateRoot,
		})).lifecycle,
		"running",
	);
	await lifecycleApi.stopStandaloneProjectServer(secondProjectRoot, {
		stateRoot,
		timeoutMs: 10_000,
	});
	const targetBuild = lifecycleApi.createBackendBuildBinding({
		packageVersion: "0.4.0",
		packageLockDigest: `sha256:${"b".repeat(64)}`,
		supportMatrixDigest: lifecycleApi.DEFAULT_BACKEND_BUILD.supportMatrixDigest,
		dshProfiles: lifecycleApi.DEFAULT_BACKEND_BUILD.dshProfiles,
		domainPlugins: lifecycleApi.DEFAULT_BACKEND_BUILD.domainPlugins,
		fileSchemas: lifecycleApi.DEFAULT_BACKEND_BUILD.fileSchemas,
		protocols: lifecycleApi.DEFAULT_BACKEND_BUILD.protocols,
	});
	const upgraded = await lifecycleApi.upgradeStandaloneBackend({
		repoRoot: projectRoot,
		stateRoot,
		expectedStateDigest: initialState.stateDigest,
		targetBuild,
		transitionedAt: "2026-06-18T08:05:00.000Z",
	});
	assert.equal(upgraded.state.activeBuild.backendBuildDigest, targetBuild.backendBuildDigest);
	const rolledBack = await lifecycleApi.rollbackStandaloneBackend({
		repoRoot: projectRoot,
		stateRoot,
		backupId: upgraded.transition.backupId,
		expectedStateDigest: upgraded.state.stateDigest,
		expectedCanonicalSnapshotDigest:
			await lifecycleApi.canonicalProjectSnapshotDigest({repoRoot: projectRoot, stateRoot}),
		restoredAt: "2026-06-18T08:10:00.000Z",
	});
	assert.equal(
		rolledBack.state.activeBuild.backendBuildDigest,
		lifecycleApi.DEFAULT_BACKEND_BUILD.backendBuildDigest,
	);
	const emptyState = await stateTool.execute(
		"post-bootstrap-state",
		{ view: "board" },
		undefined,
		undefined,
		ctx,
	);
	assert.equal(emptyState.details.result.data.workQueue.summary.ready, 0);
	const dashboard = await dashboardCommand.handler("--no-open", ctx);
	assert.equal(dashboard.command, "dashboard");
	assert.match(dashboard.url, /^http:\/\/127\.0\.0\.1:/);

	run("git", ["init", "-q"], { cwd: projectRoot });
	const change = acceptedChangeFixture({
		id: "CHG-external-package-lifecycle",
		kind: "harden",
		problem: "Repo-local self-testing can hide package lifecycle drift.",
		objective:
			"A packed install proves guarded lifecycle behavior in a fresh project.",
		rationale:
			"External lifecycle proof is required before broader package use.",
		safetyBoundary:
			"Installed packages mutate only through guarded expected-byte and sequence checks.",
		failureModes: [
			"Install metadata works only inside the source repository.",
			"Bootstrap creates incomplete project-local state.",
		],
		negativeTestPlan:
			"Reject state before bootstrap and require guarded append arguments.",
		sourceRefs: ["README.md", ".codewiki/kb/system/components/runtime.md"],
		proofRefs: ["tests/project-server/external-package-lifecycle-smoke.mjs"],
		acceptedBy: "external-package-lifecycle-smoke",
	});
	assertToolResult(
		await changeTool.execute(
			"external-lifecycle-change-create",
			{
				allowNonProjectInstall: true,
				input: {
					operation: "create",
					expectedHead: null,
					actor: "external-package-lifecycle-smoke",
					createdAt: "2026-06-18T09:00:00.000Z",
					change,
				},
			},
			undefined,
			undefined,
			ctx,
		),
		/wiki_change: completed create operation\./,
	);
	const traceId = `TRACE-${change.id}`;
	await assert.rejects(
		attentionTool.execute(
			"external-lifecycle-attention",
			{},
			undefined,
			undefined,
			ctx,
		),
		/decision_attention_projection_unavailable/,
	);
	await lifecycleApi.stopStandaloneProjectServer(projectRoot, {
		stateRoot,
		timeoutMs: 10_000,
	});
	const finalState = await lifecycleApi.readBackendStateManifest({repoRoot: projectRoot, stateRoot});
	const uninstall = await lifecycleApi.uninstallStandaloneBackendState({
		repoRoot: projectRoot,
		stateRoot,
		expectedStateDigest: finalState.stateDigest,
		expectedCanonicalSnapshotDigest:
			await lifecycleApi.canonicalProjectSnapshotDigest({repoRoot: projectRoot, stateRoot}),
		uninstalledAt: "2026-06-18T10:00:00.000Z",
	});
	assert.equal(uninstall.privateStateRemoved, false);
	run("npm", ["uninstall", "--prefix", installRoot, "@nunomoura/codewiki"]);
	assert.equal(existsSync(packageRoot), false);
	assert.equal(existsSync(join(projectRoot, ".codewiki", "config.json")), true);
	assert.equal(existsSync(join(projectRoot, ".codewiki", "runtime")), false);
	assert.equal(existsSync(join(projectRoot, ".codewiki", "views")), false);
	console.log(
		JSON.stringify(
			{
				ok: true,
				projectRoot,
				traceId,
				semanticToolsAbsent: true,
				lifecycle: ["install", "bootstrap", "start", "restart", "stop", "upgrade", "rollback", "uninstall"],
			},
			null,
			2,
		),
	);
} finally {
	if (lifecycleApi) {
		for (const repoRoot of [projectRoot, secondProjectRoot].filter(Boolean)) {
			await lifecycleApi.stopStandaloneProjectServer(repoRoot, {
				stateRoot,
				timeoutMs: 2_000,
			}).catch(() => undefined);
		}
	}
	rmSync(root, {recursive: true, force: true});
}
