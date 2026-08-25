import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash, randomBytes} from "node:crypto";
import {
	chmodSync,
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, isAbsolute, join, relative, resolve, sep} from "node:path";
import {pathToFileURL} from "node:url";

const RELEASE_N_REVISION = "6f9023f9a239e3dbe0d7491fa30b2dee2c686c3f";
const STAGES = ["decision", "planning", "implementation", "review"];
const ROOT = mkdtempSync(join(tmpdir(), "codewiki-b11-dogfood-"));
const SOURCE_ROOT = realpathSync(process.cwd());
const RELEASE_SOURCE_ROOT = join(ROOT, "release-n-source");
const SUBJECT_ROOT = join(ROOT, "subject-n-plus-one");
const STATE_ROOT = join(ROOT, "state");
const CREDENTIAL_ROOT = join(ROOT, "credentials");
const CONTROLLER_PACK_ROOT = join(ROOT, "controller-pack");
const CONTROLLER_INSTALL_ROOT = join(ROOT, "controller-install");
const CANDIDATE_PACK_ROOT = join(ROOT, "candidate-pack");
const CANDIDATE_INSTALL_ROOT = join(ROOT, "candidate-install");
const NPM_CACHE = join(ROOT, "npm-cache");
const REPORT_PATH = process.env.CODEWIKI_DOGFOOD_REPORT;

let controllerLifecycle;
let report;
let worktreeAdded = false;

try {
	assert.equal(run("git", ["cat-file", "-e", `${RELEASE_N_REVISION}^{commit}`], SOURCE_ROOT).status, 0);
	addReleaseWorktree();
	installDependencies(RELEASE_SOURCE_ROOT);
	mkdirSync(CONTROLLER_PACK_ROOT, {recursive: true});
	runChecked("npm", ["pack", "--pack-destination", CONTROLLER_PACK_ROOT], RELEASE_SOURCE_ROOT);
	const controllerTarball = onlyTarball(CONTROLLER_PACK_ROOT);
	const controllerArtifactDigest = fileDigest(controllerTarball);
	installTarball(CONTROLLER_INSTALL_ROOT, controllerTarball);

	createCandidateSubject();
	const sourceRevision = runChecked("git", ["rev-parse", "HEAD"], SUBJECT_ROOT).stdout.trim();
	const sourceTreeDigest = projectTreeDigest(SUBJECT_ROOT);
	const subjectCandidateDigest = textDigest(`candidate:${sourceRevision}:${sourceTreeDigest}`);
	createIsolatedCredentialCustody();

	const controllerPackageRoot = realpathSync(
		join(CONTROLLER_INSTALL_ROOT, "node_modules", "@nunomoura", "codewiki"),
	);
	assertOutside(controllerPackageRoot, SOURCE_ROOT, "Controller package resolved from source checkout.");
	assertOutside(controllerPackageRoot, SUBJECT_ROOT, "Controller package resolved from mutable subject.");
	assert.equal(existsSync(CANDIDATE_INSTALL_ROOT), false);

	const controllerBootstrap = await importInstalled(
		controllerPackageRoot,
		"dist/project/bootstrap.js",
	);
	const controllerChanges = await importInstalled(
		controllerPackageRoot,
		"dist/changes/command.js",
	);
	controllerLifecycle = await importInstalled(
		controllerPackageRoot,
		"dist/project-server/operations/lifecycle.js",
	);
	const controllerState = await importInstalled(
		controllerPackageRoot,
		"dist/project-server/operations/state.js",
	);
	const controllerBuild = await importInstalled(
		controllerPackageRoot,
		"dist/project-server/operations/build.js",
	);
	const controllerPacks = await importInstalled(
		controllerPackageRoot,
		"dist/checks/packs/loader.js",
	);

	await controllerBootstrap.bootstrapCodewiki(SUBJECT_ROOT, {force: true});
	const protectedPacks = await loadProtectedPacks(controllerPacks);
	await proveCandidateCannotSelectPolicy(controllerPacks, protectedPacks);
	const changeResult = await controllerChanges.runWikiChange({
		repoRoot: SUBJECT_ROOT,
		operation: "create",
		change: dogfoodChange(),
		expectedHead: null,
		actor: "user:backend-v1-release",
		createdAt: "2026-09-01T12:00:00.000Z",
	});
	assert.match(changeResult.head, /^[a-f0-9]{40}$/u);
	await assert.rejects(
		controllerChanges.runWikiChange({
			repoRoot: SUBJECT_ROOT,
			operation: "create",
			change: dogfoodChange(),
			expectedHead: null,
			actor: "user:backend-v1-release",
			createdAt: "2026-09-01T12:00:01.000Z",
		}),
		/Expected Changes Backlog head empty, found [a-f0-9]{40}/,
	);

	const initialState = await controllerState.bootstrapBackendState({
		repoRoot: SUBJECT_ROOT,
		stateRoot: STATE_ROOT,
		createdAt: "2026-09-01T12:01:00.000Z",
	});
	const runningN = await controllerLifecycle.startStandaloneProjectServer(SUBJECT_ROOT, {
		stateRoot: STATE_ROOT,
		timeoutMs: 10_000,
	});
	assert.equal(runningN.lifecycle, "running");
	assert.equal(runningN.backendBuildDigest, controllerBuild.DEFAULT_BACKEND_BUILD.backendBuildDigest);
	const disabledN = await controllerLifecycle.stopStandaloneProjectServer(SUBJECT_ROOT, {
		stateRoot: STATE_ROOT,
		timeoutMs: 10_000,
	});
	assert.equal(disabledN.lifecycle, "stopped");
	assert.equal(disabledN.process, null);

	const independentCiDigest = runIndependentCandidateCi();
	mkdirSync(CANDIDATE_PACK_ROOT, {recursive: true});
	runChecked("npm", ["pack", "--pack-destination", CANDIDATE_PACK_ROOT], SUBJECT_ROOT);
	const candidateTarball = onlyTarball(CANDIDATE_PACK_ROOT);
	const candidateArtifactDigest = fileDigest(candidateTarball);
	installTarball(CANDIDATE_INSTALL_ROOT, candidateTarball);
	const candidatePackageRoot = realpathSync(
		join(CANDIDATE_INSTALL_ROOT, "node_modules", "@nunomoura", "codewiki"),
	);
	assertOutside(candidatePackageRoot, SOURCE_ROOT, "Candidate package resolved from source checkout.");
	assertOutside(candidatePackageRoot, SUBJECT_ROOT, "Candidate package resolved from mutable subject.");
	assert.notEqual(candidatePackageRoot, controllerPackageRoot);

	const candidateDescriptor = inspectCandidate(candidatePackageRoot);
	controllerBuild.assertBackendBuildBinding(candidateDescriptor.backendBuild);
	assert.notEqual(
		candidateDescriptor.backendBuild.backendBuildDigest,
		controllerBuild.DEFAULT_BACKEND_BUILD.backendBuildDigest,
	);
	const qualificationTargetBuild = controllerBuild.createBackendBuildBinding({
		packageVersion: "0.3.1",
		packageLockDigest: candidateDescriptor.backendBuild.packageLockDigest,
		supportMatrixDigest: candidateDescriptor.backendBuild.supportMatrixDigest,
		dshProfiles: candidateDescriptor.backendBuild.dshProfiles,
		domainPlugins: candidateDescriptor.backendBuild.domainPlugins,
		fileSchemas: candidateDescriptor.backendBuild.fileSchemas,
		protocols: candidateDescriptor.backendBuild.protocols,
	});
	const upgraded = await controllerLifecycle.upgradeStandaloneBackend({
		repoRoot: SUBJECT_ROOT,
		stateRoot: STATE_ROOT,
		expectedStateDigest: initialState.stateDigest,
		targetBuild: qualificationTargetBuild,
		transitionedAt: "2026-09-01T12:02:00.000Z",
	});
	assert.equal(
		upgraded.state.activeBuild.backendBuildDigest,
		qualificationTargetBuild.backendBuildDigest,
	);
	const canonicalSnapshotDigest = await controllerState.canonicalProjectSnapshotDigest({
		repoRoot: SUBJECT_ROOT,
		stateRoot: STATE_ROOT,
	});
	const rolledBack = await controllerLifecycle.rollbackStandaloneBackend({
		repoRoot: SUBJECT_ROOT,
		stateRoot: STATE_ROOT,
		backupId: upgraded.transition.backupId,
		expectedStateDigest: upgraded.state.stateDigest,
		expectedCanonicalSnapshotDigest: canonicalSnapshotDigest,
		restoredAt: "2026-09-01T12:03:00.000Z",
	});
	assert.equal(
		rolledBack.state.activeBuild.backendBuildDigest,
		controllerBuild.DEFAULT_BACKEND_BUILD.backendBuildDigest,
	);

	const rolledBackStatus = await controllerLifecycle.readStandaloneProjectServerStatus({
		repoRoot: SUBJECT_ROOT,
		stateRoot: STATE_ROOT,
	});
	assert.equal(rolledBackStatus.lifecycle, "stopped");
	assert.equal(
		rolledBackStatus.backendBuildDigest,
		controllerBuild.DEFAULT_BACKEND_BUILD.backendBuildDigest,
	);
	const rolledBackState = await controllerState.readBackendStateManifest({
		repoRoot: SUBJECT_ROOT,
		stateRoot: STATE_ROOT,
	});
	assert.ok(rolledBackState);
	const uninstalled = await controllerLifecycle.uninstallStandaloneBackendState({
		repoRoot: SUBJECT_ROOT,
		stateRoot: STATE_ROOT,
		expectedStateDigest: rolledBackState.stateDigest,
		expectedCanonicalSnapshotDigest: canonicalSnapshotDigest,
		removePrivateState: true,
		uninstalledAt: "2026-09-01T12:04:00.000Z",
	});
	assert.equal(uninstalled.privateStateRemoved, true);
	const afterCleanup = await controllerLifecycle.readStandaloneProjectServerStatus({
		repoRoot: SUBJECT_ROOT,
		stateRoot: STATE_ROOT,
	});
	assert.equal(afterCleanup.lifecycle, "unbootstrapped");
	assert.equal(existsSync(join(SUBJECT_ROOT, ".codewiki", "runtime")), false);
	assert.equal(existsSync(join(SUBJECT_ROOT, ".codewiki", "views")), false);
	assert.equal(await containsBytes(SUBJECT_ROOT, readFileSync(join(CREDENTIAL_ROOT, "provider.key"))), false);
	assert.equal(await containsBytes(STATE_ROOT, readFileSync(join(CREDENTIAL_ROOT, "provider.key"))), false);

	report = {
		protocol: {id: "codewiki.external-dogfood-qualification", version: "1.0.0"},
		controller: {
			sourceRevision: RELEASE_N_REVISION,
			packageVersion: controllerBuild.DEFAULT_BACKEND_BUILD.packageVersion,
			packageArtifactDigest: controllerArtifactDigest,
			backendBuildDigest: controllerBuild.DEFAULT_BACKEND_BUILD.backendBuildDigest,
		},
		subject: {
			sourceRevision,
			sourceTreeDigest,
			subjectCandidateDigest,
			packageArtifactDigest: candidateArtifactDigest,
			backendBuildDigest: candidateDescriptor.backendBuild.backendBuildDigest,
			upgradeQualificationBuildDigest: qualificationTargetBuild.backendBuildDigest,
			protectedSourceHead: RELEASE_N_REVISION,
			checkPacks: protectedPacks.map(({stage, checkPackDigest, checkCount}) => ({
				stage,
				checkPackDigest,
				checkCount,
			})),
		},
		gates: {
			controllerIsolation: true,
			candidatePolicyIsolation: true,
			expectedHeadCas: true,
			emergencyDisable: true,
			independentCiDigest,
			upgrade: true,
			rollback: true,
			cleanup: true,
			credentialIsolation: true,
		},
	};
} finally {
	if (controllerLifecycle) {
		await controllerLifecycle.stopStandaloneProjectServer(SUBJECT_ROOT, {
			stateRoot: STATE_ROOT,
			timeoutMs: 2_000,
		}).catch(() => undefined);
	}
	if (worktreeAdded) {
		run("git", ["worktree", "remove", "--force", RELEASE_SOURCE_ROOT], SOURCE_ROOT);
	}
	rmSync(ROOT, {recursive: true, force: true});
}

assert.ok(report);
const finalReport = Object.freeze({
	...report,
	cleanup: Object.freeze({temporaryRootRemoved: !existsSync(ROOT)}),
	reportDigest: textDigest(JSON.stringify(report)),
});
if (REPORT_PATH) {
	mkdirSync(dirname(resolve(REPORT_PATH)), {recursive: true});
	writeFileSync(resolve(REPORT_PATH), `${JSON.stringify(finalReport, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify(finalReport)}\n`);

function addReleaseWorktree() {
	runChecked("git", ["worktree", "add", "--detach", RELEASE_SOURCE_ROOT, RELEASE_N_REVISION], SOURCE_ROOT);
	worktreeAdded = true;
}

function createCandidateSubject() {
	runChecked("git", ["clone", "--quiet", "--no-hardlinks", SOURCE_ROOT, SUBJECT_ROOT], ROOT);
	const diff = runChecked("git", ["diff", "--binary", "--no-ext-diff", "HEAD"], SOURCE_ROOT).stdout;
	if (diff.length > 0) {
		runChecked("git", ["apply", "--binary", "-"], SUBJECT_ROOT, diff);
	}
	const untracked = runChecked(
		"git",
		["ls-files", "--others", "--exclude-standard", "-z"],
		SOURCE_ROOT,
	).stdout.split("\0").filter(Boolean);
	for (const path of untracked) {
		const source = resolve(SOURCE_ROOT, path);
		const target = resolve(SUBJECT_ROOT, path);
		assertContained(source, SOURCE_ROOT);
		assertContained(target, SUBJECT_ROOT);
		mkdirSync(dirname(target), {recursive: true});
		cpSync(source, target, {recursive: true});
	}
}

function createIsolatedCredentialCustody() {
	mkdirSync(CREDENTIAL_ROOT, {recursive: true, mode: 0o700});
	chmodSync(CREDENTIAL_ROOT, 0o700);
	const credentialPath = join(CREDENTIAL_ROOT, "provider.key");
	writeFileSync(credentialPath, randomBytes(32), {mode: 0o600});
	chmodSync(credentialPath, 0o600);
	assert.equal(statSync(CREDENTIAL_ROOT).mode & 0o777, 0o700);
	assert.equal(statSync(credentialPath).mode & 0o777, 0o600);
	assertOutside(CREDENTIAL_ROOT, SUBJECT_ROOT, "Credential custody entered subject repository.");
	assertOutside(CREDENTIAL_ROOT, STATE_ROOT, "Credential custody entered Project Server state.");
}

async function loadProtectedPacks(loader) {
	const snapshots = [];
	for (const stage of STAGES) {
		const snapshot = await loader.loadProtectedCheckPackSnapshot({
			repoRoot: SUBJECT_ROOT,
			stage,
			protectedSourceHead: RELEASE_N_REVISION,
		});
		assert.ok(snapshot.checkCount > 0);
		snapshots.push(snapshot);
	}
	return snapshots;
}

async function proveCandidateCannotSelectPolicy(loader, protectedPacks) {
	const checkPath = join(
		SUBJECT_ROOT,
		".codewiki",
		"check-packs",
		"review",
		"codewiki-project-server",
		"project_server_aggregate_integrity",
		"CHECK.md",
	);
	const accepted = readFileSync(checkPath, "utf8");
	writeFileSync(checkPath, accepted.replace("The exact integrated aggregate", "The candidate-selected aggregate"));
	try {
		const mutable = await loader.loadCheckPackSnapshot({repoRoot: SUBJECT_ROOT, stage: "review"});
		const protectedReview = protectedPacks.find(({stage}) => stage === "review");
		assert.ok(protectedReview);
		assert.notEqual(mutable.checkPackDigest, protectedReview.checkPackDigest);
		const reread = await loader.loadProtectedCheckPackSnapshot({
			repoRoot: SUBJECT_ROOT,
			stage: "review",
			protectedSourceHead: RELEASE_N_REVISION,
		});
		assert.equal(reread.checkPackDigest, protectedReview.checkPackDigest);
	} finally {
		writeFileSync(checkPath, accepted, "utf8");
	}
}

function runIndependentCandidateCi() {
	installDependencies(SUBJECT_ROOT);
	const outputs = [
		runChecked("npm", ["run", "typecheck"], SUBJECT_ROOT).stdout,
		runChecked(process.execPath, [
			"--experimental-strip-types",
			"--test",
			"tests/project-server/operations/release.test.mjs",
			"tests/project-server/operations/lifecycle.test.mjs",
			"tests/runtime/production.test.mjs",
		], SUBJECT_ROOT).stdout,
		runChecked("npm", ["run", "build"], SUBJECT_ROOT).stdout,
	];
	assert.match(outputs[1], /fail 0/);
	return textDigest(outputs.join("\n"));
}

function inspectCandidate(candidatePackageRoot) {
	const script = join(ROOT, "inspect-candidate.mjs");
	writeFileSync(script, `
import {pathToFileURL} from "node:url";
const root = process.env.CODEWIKI_CANDIDATE_ROOT;
const build = await import(pathToFileURL(root + "/dist/project-server/operations/build.js").href);
process.stdout.write(JSON.stringify({backendBuild: build.DEFAULT_BACKEND_BUILD}));
`, "utf8");
	return JSON.parse(runChecked(process.execPath, [script], ROOT, undefined, {
		CODEWIKI_CANDIDATE_ROOT: candidatePackageRoot,
	}).stdout);
}

function installDependencies(root) {
	runChecked("npm", [
		"ci",
		"--ignore-scripts",
		"--no-audit",
		"--no-fund",
		"--cache",
		NPM_CACHE,
	], root);
}

function installTarball(root, tarball) {
	mkdirSync(root, {recursive: true});
	runChecked("npm", [
		"install",
		"--ignore-scripts",
		"--no-audit",
		"--no-fund",
		"--cache",
		NPM_CACHE,
		"--prefix",
		root,
		tarball,
	], ROOT);
}

function onlyTarball(root) {
	const tarballs = readdirSync(root).filter((name) => name.endsWith(".tgz"));
	assert.equal(tarballs.length, 1);
	return join(root, tarballs[0]);
}

function dogfoodChange() {
	return {
		schemaVersion: 3,
		id: "CHG-backend-v1-external-dogfood",
		revision: 1,
		status: "pending",
		intent: {
			question: "Should this validated Change become trace work?",
			problem: "Mutable subject code cannot qualify its own Project Server controller.",
			objective: "Released controller N governs Backend v1 candidate N+1 from an isolated external installation.",
			rationale: "Independent traces require immutable input.",
			nonGoals: ["Do not widen scope beyond this Change."],
			alternatives: ["Keep current behavior."],
		},
		classification: {
			kind: "introduce",
			type: "workflow_change",
			scope: "system",
			affectedLayers: ["changes", "decision", "traces"],
			targetRefs: ["src/project-server/operations/release.ts"],
		},
		impact: {
			user: "Backend v1 has an independently governed release candidate.",
			maintainer: "Controller and subject identities remain attributable.",
		},
		knowledge: {
			kind: "unchanged",
			refs: [{subjectId: "cw:component:package"}],
			rationale: "B11 qualifies delivery evidence without changing accepted package meaning.",
		},
		outcome: {
			successSignals: ["Release N records exact subject policy and package identities."],
			evidenceExpectations: ["External dogfood qualification passes."],
		},
		delivery: {constraints: [], planningQuestions: []},
		evidence: {
			sourceRefs: ["BACKEND_V1_PLAN.md"],
			proofRefs: ["tests/project-server/external-dogfood-smoke.mjs"],
		},
		safety: {
			risk: "low",
			invariants: ["Never load mutable N+1 code in controller N."],
			failureModes: ["Candidate policy could judge itself."],
			regressionPlan: "Run external dogfood qualification.",
		},
		validation: {
			state: "draft",
			issues: [],
			assessments: [],
			recommendations: [],
		},
		estimates: {effort: "medium", workScale: "small"},
		provenance: {
			origin: "user",
			createdBy: "user",
			createdAt: "2026-09-01T12:00:00.000Z",
			updatedAt: "2026-09-01T12:00:00.000Z",
		},
	};
}

function projectTreeDigest(root) {
	const files = runChecked(
		"git",
		["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
		root,
	).stdout.split("\0").filter(Boolean).sort((left, right) => left.localeCompare(right));
	const hash = createHash("sha256");
	for (const path of files) {
		const absolute = resolve(root, path);
		assertContained(absolute, root);
		if (lstatSync(absolute).isSymbolicLink()) {
			throw new Error(`Candidate source tree contains symlink ${path}.`);
		}
		hash.update(path);
		hash.update("\0");
		hash.update(readFileSync(absolute));
		hash.update("\0");
	}
	return `sha256:${hash.digest("hex")}`;
}

async function containsBytes(root, needle) {
	if (!existsSync(root)) return false;
	const stack = [root];
	while (stack.length > 0) {
		const current = stack.pop();
		for (const entry of readdirSync(current, {withFileTypes: true})) {
			const path = join(current, entry.name);
			if (entry.isSymbolicLink()) continue;
			if (entry.isDirectory()) stack.push(path);
			else if (entry.isFile() && readFileSync(path).includes(needle)) return true;
		}
	}
	return false;
}

async function importInstalled(packageRoot, relativePath) {
	const path = realpathSync(join(packageRoot, relativePath));
	assertContained(path, packageRoot);
	return import(`${pathToFileURL(path).href}?b11=${Date.now()}-${Math.random()}`);
}

function assertContained(path, root) {
	const rel = relative(resolve(root), resolve(path));
	if (rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) return;
	throw new Error(`Path escapes root: ${path}`);
}

function assertOutside(path, root, message) {
	const rel = relative(resolve(root), resolve(path));
	assert.ok(rel === ".." || rel.startsWith(`..${sep}`), message);
}

function fileDigest(path) {
	return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function textDigest(value) {
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function runChecked(command, args, cwd, input, extraEnv = {}) {
	const result = run(command, args, cwd, input, extraEnv);
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(" ")} failed (${result.status ?? "signal"}).\n${result.stdout}\n${result.stderr}`,
		);
	}
	return result;
}

function run(command, args, cwd, input, extraEnv = {}) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		input,
		env: {...process.env, ...extraEnv},
		maxBuffer: 32 * 1024 * 1024,
	});
	return {
		status: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}
