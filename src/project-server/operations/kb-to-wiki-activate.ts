import {lstat} from "node:fs/promises";
import {join} from "node:path";

import {
	createGitCommandRunner,
	type GitCommandResult,
	type GitCommandRunner,
} from "../../changes/trace/git-command.ts";
import {
	activateKbToWikiMigrationRefsCas,
	inspectKbToWikiMigrationActivation,
	restoreKbToWikiMigrationSourceCas,
	validateKbToWikiMigrationCommit,
	type KbToWikiMigrationActivationState,
	type KbToWikiMigrationCommitInput,
} from "../../knowledge/kb-to-wiki-git.ts";
import {canonicalJsonDigest, type Sha256Digest} from "../../utils/canonical-json.ts";
import {
	assertStagedKbToWikiMigration,
	type StagedKbToWikiMigration,
} from "./kb-to-wiki-stage.ts";
import {
	activateKbToWikiBackendState,
	canonicalProjectSnapshotDigest,
	readBackendStateBackup,
	readBackendStateManifest,
	readKbToWikiBackendStateActivationReceipt,
	restoreBackendStateBackup,
	type BackendStateManifest,
	type BackendStateRestoreReceipt,
	type KbToWikiBackendStateActivationReceipt,
} from "./state.ts";

export const KB_TO_WIKI_MIGRATION_ACTIVATION_PROTOCOL = Object.freeze({
	id: "codewiki.kb-to-wiki-migration-activation",
	version: "1.0.0",
} as const);

export type KbToWikiMigrationRestartPhase =
	| "not_activated"
	| "refs_activated"
	| "activated"
	| "rolled_back"
	| "private_state_only";

export interface KbToWikiMigrationRestartInspection {
	readonly phase: KbToWikiMigrationRestartPhase;
	readonly refs: KbToWikiMigrationActivationState;
	readonly worktreeClean: boolean;
	readonly stateGeneration: number;
	readonly stateDigest: Sha256Digest;
	readonly backendBuildDigest: Sha256Digest;
}

export interface KbToWikiMigrationActivationReceipt {
	readonly protocol: typeof KB_TO_WIKI_MIGRATION_ACTIVATION_PROTOCOL;
	readonly stageDigest: Sha256Digest;
	readonly migrationReceiptDigest: Sha256Digest;
	readonly migrationCommit: StagedKbToWikiMigration["migrationCommit"];
	readonly targetBackendBuildDigest: Sha256Digest;
	readonly targetStateDigest: Sha256Digest;
	readonly targetStateGeneration: number;
	readonly privateStateActivationDigest: Sha256Digest;
	readonly activatedAt: string;
	readonly activationDigest: Sha256Digest;
}

export interface KbToWikiMigrationRollbackResult {
	readonly inspection: KbToWikiMigrationRestartInspection;
	readonly privateStateRestore: BackendStateRestoreReceipt | null;
}

export async function activateStagedKbToWikiMigration(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly staged: StagedKbToWikiMigration;
	readonly activatedAt?: string;
	readonly runner?: GitCommandRunner;
}): Promise<KbToWikiMigrationActivationReceipt> {
	assertStagedKbToWikiMigration(input.staged);
	const runner = input.runner ?? createGitCommandRunner();
	const before = await inspectKbToWikiMigrationRestart({...input, runner});
	if (before.phase !== "not_activated" || !before.worktreeClean) {
		throw new Error("KB-to-Wiki activation requires the exact clean staged source state.");
	}
	const commitInput = migrationCommitInput(input.repoRoot, input.staged, runner);
	let refsActivated = false;
	try {
		await activateKbToWikiMigrationRefsCas(commitInput);
		refsActivated = true;
		await materializeMigrationWorktree(input.repoRoot, input.staged, "target", runner);
		await validateActivatedRefs(commitInput);
		const privateReceipt = await activatePrivateState(input);
		const targetState = await requireState(input);
		const activatedAt = privateReceipt.activatedAt;
		const body = {
			protocol: KB_TO_WIKI_MIGRATION_ACTIVATION_PROTOCOL,
			stageDigest: input.staged.stageDigest,
			migrationReceiptDigest: input.staged.receipt.receiptDigest,
			migrationCommit: input.staged.migrationCommit,
			targetBackendBuildDigest: input.staged.targetBackendBuild.backendBuildDigest,
			targetStateDigest: targetState.stateDigest,
			targetStateGeneration: targetState.generation,
			privateStateActivationDigest: privateReceipt.activationDigest,
			activatedAt,
		};
		const receipt = Object.freeze({
			...body,
			activationDigest: canonicalJsonDigest(body),
		});
		const after = await inspectKbToWikiMigrationRestart({...input, runner});
		if (after.phase !== "activated" || !after.worktreeClean) {
			throw new Error("KB-to-Wiki activation did not replay complete restart closure.");
		}
		return receipt;
	} catch (error) {
		if (!refsActivated) throw error;
		try {
			await rollbackStagedKbToWikiMigration({
				...input,
				runner,
				targetOnlyCanonicalOperationObserved: false,
			});
		} catch (rollbackError) {
			throw new AggregateError(
				[error, rollbackError],
				"KB-to-Wiki activation failed and bounded rollback also failed.",
			);
		}
		throw error;
	}
}

export async function inspectKbToWikiMigrationRestart(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly staged: StagedKbToWikiMigration;
	readonly runner?: GitCommandRunner;
}): Promise<KbToWikiMigrationRestartInspection> {
	assertStagedKbToWikiMigration(input.staged);
	const runner = input.runner ?? createGitCommandRunner();
	const commitInput = migrationCommitInput(input.repoRoot, input.staged, runner);
	await validateKbToWikiMigrationCommit(commitInput);
	await assertPrivateBackupClosure(input);
	const refs = await inspectKbToWikiMigrationActivation(commitInput);
	const state = await requireState(input);
	const worktreeClean = await canonicalWorktreeClean(input.repoRoot, runner);
	const privatePlan = input.staged.receipt.privateStatePlan;
	const phase = classifyRestartPhase({
		refs,
		state,
		sourceGeneration: privatePlan.sourceGeneration,
		sourceStateDigest: privatePlan.sourceStateDigest,
		sourceBackendBuildDigest: privatePlan.sourceBackendBuildDigest,
		targetGeneration: privatePlan.targetGeneration,
		targetBackendBuildDigest: privatePlan.targetBackendBuildDigest,
		stagedTargetBackendBuildDigest: input.staged.targetBackendBuild.backendBuildDigest,
	});
	if (phase === "activated") {
		await readKbToWikiBackendStateActivationReceipt({
			repoRoot: input.repoRoot,
			stateRoot: input.stateRoot,
			migrationReceiptDigest: input.staged.receipt.receiptDigest,
			backupId: privatePlan.backupId,
			sourceStateDigest: privatePlan.sourceStateDigest,
			sourceStateGeneration: privatePlan.sourceGeneration,
			sourceBackendBuildDigest: privatePlan.sourceBackendBuildDigest,
			targetStateGeneration: privatePlan.targetGeneration,
			targetBackendBuildDigest: privatePlan.targetBackendBuildDigest,
		});
	}
	return Object.freeze({
		phase,
		refs,
		worktreeClean,
		stateGeneration: state.generation,
		stateDigest: state.stateDigest,
		backendBuildDigest: state.activeBuild.backendBuildDigest,
	});
}

export async function recoverStagedKbToWikiMigration(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly staged: StagedKbToWikiMigration;
	readonly recoveredAt?: string;
	readonly runner?: GitCommandRunner;
}): Promise<KbToWikiMigrationRestartInspection> {
	const runner = input.runner ?? createGitCommandRunner();
	const before = await inspectKbToWikiMigrationRestart({...input, runner});
	if (before.phase === "activated") {
		if (!before.worktreeClean) {
			await materializeMigrationWorktree(input.repoRoot, input.staged, "target", runner);
		}
		return inspectKbToWikiMigrationRestart({...input, runner});
	}
	if (before.phase === "refs_activated") {
		await materializeMigrationWorktree(input.repoRoot, input.staged, "target", runner);
		await activatePrivateState({
			...input,
			activatedAt: input.recoveredAt,
		});
		return inspectKbToWikiMigrationRestart({...input, runner});
	}
	if (before.phase === "private_state_only") {
		await restorePrivateSourceState({...input, restoredAt: input.recoveredAt});
		await materializeMigrationWorktree(input.repoRoot, input.staged, "source", runner);
		return inspectKbToWikiMigrationRestart({...input, runner});
	}
	if (!before.worktreeClean) {
		await materializeMigrationWorktree(input.repoRoot, input.staged, "source", runner);
	}
	return inspectKbToWikiMigrationRestart({...input, runner});
}

export async function rollbackStagedKbToWikiMigration(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly staged: StagedKbToWikiMigration;
	readonly targetOnlyCanonicalOperationObserved: boolean;
	readonly restoredAt?: string;
	readonly runner?: GitCommandRunner;
}): Promise<KbToWikiMigrationRollbackResult> {
	assertStagedKbToWikiMigration(input.staged);
	const runner = input.runner ?? createGitCommandRunner();
	const commitInput = migrationCommitInput(input.repoRoot, input.staged, runner);
	const refs = await inspectKbToWikiMigrationActivation(commitInput);
	if (refs === "activated") {
		await restoreKbToWikiMigrationSourceCas({
			...commitInput,
			targetOnlyCanonicalOperationObserved: input.targetOnlyCanonicalOperationObserved,
		});
	}
	await materializeMigrationWorktree(input.repoRoot, input.staged, "source", runner);
	const state = await requireState(input);
	const targetBuildDigest = input.staged.receipt.privateStatePlan.targetBackendBuildDigest;
	const privateStateRestore = state.activeBuild.backendBuildDigest === targetBuildDigest
		? await restorePrivateSourceState(input)
		: null;
	const inspection = await inspectKbToWikiMigrationRestart({...input, runner});
	if (inspection.phase !== "not_activated" && inspection.phase !== "rolled_back") {
		throw new Error("KB-to-Wiki rollback did not restore source authority.");
	}
	return Object.freeze({inspection, privateStateRestore});
}

interface RestartPrivateStateInput {
	readonly refs: KbToWikiMigrationActivationState;
	readonly state: BackendStateManifest;
	readonly sourceGeneration: number;
	readonly sourceStateDigest: Sha256Digest;
	readonly sourceBackendBuildDigest: Sha256Digest;
	readonly targetGeneration: number;
	readonly targetBackendBuildDigest: Sha256Digest;
	readonly stagedTargetBackendBuildDigest: Sha256Digest;
}

async function assertPrivateBackupClosure(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly staged: StagedKbToWikiMigration;
}): Promise<void> {
	const plan = input.staged.receipt.privateStatePlan;
	const backup = await readBackendStateBackup({
		repoRoot: input.repoRoot,
		stateRoot: input.stateRoot,
		backupId: plan.backupId,
	});
	if (
		backup.sourceState.stateDigest !== plan.sourceStateDigest ||
		backup.sourceState.generation !== plan.sourceGeneration ||
		backup.sourceState.activeBuild.backendBuildDigest !== plan.sourceBackendBuildDigest
	) {
		throw new Error("KB-to-Wiki staged private backup does not replay source state.");
	}
}

function classifyRestartPhase(
	input: RestartPrivateStateInput,
): KbToWikiMigrationRestartPhase {
	const privateState = classifyRestartPrivateState(input);
	switch (`${input.refs}:${privateState}`) {
		case "not_activated:source": return "not_activated";
		case "activated:source": return "refs_activated";
		case "activated:target": return "activated";
		case "not_activated:rolled-back": return "rolled_back";
		case "not_activated:target": return "private_state_only";
		default:
			throw new Error("KB-to-Wiki restart state is inconsistent with staged closure.");
	}
}

function classifyRestartPrivateState(
	input: RestartPrivateStateInput,
): "source" | "target" | "rolled-back" | "inconsistent" {
	const activeBuildDigest = input.state.activeBuild.backendBuildDigest;
	if (
		input.state.generation === input.sourceGeneration &&
		input.state.stateDigest === input.sourceStateDigest &&
		activeBuildDigest === input.sourceBackendBuildDigest
	) return "source";
	if (
		input.state.generation === input.targetGeneration &&
		activeBuildDigest === input.targetBackendBuildDigest &&
		activeBuildDigest === input.stagedTargetBackendBuildDigest
	) return "target";
	if (activeBuildDigest === input.sourceBackendBuildDigest) return "rolled-back";
	return "inconsistent";
}

async function activatePrivateState(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly staged: StagedKbToWikiMigration;
	readonly activatedAt?: string;
}): Promise<KbToWikiBackendStateActivationReceipt> {
	const plan = input.staged.receipt.privateStatePlan;
	return activateKbToWikiBackendState({
		repoRoot: input.repoRoot,
		stateRoot: input.stateRoot,
		expectedStateDigest: plan.sourceStateDigest,
		migrationReceiptDigest: input.staged.receipt.receiptDigest,
		backupId: plan.backupId,
		sourceStateGeneration: plan.sourceGeneration,
		sourceBackendBuildDigest: plan.sourceBackendBuildDigest,
		targetStateGeneration: plan.targetGeneration,
		targetBuild: input.staged.targetBackendBuild,
		activatedAt: input.activatedAt,
	});
}

async function restorePrivateSourceState(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly staged: StagedKbToWikiMigration;
	readonly restoredAt?: string;
}): Promise<BackendStateRestoreReceipt> {
	const state = await requireState(input);
	const canonicalDigest = await canonicalProjectSnapshotDigest(input);
	return restoreBackendStateBackup({
		repoRoot: input.repoRoot,
		stateRoot: input.stateRoot,
		backupId: input.staged.receipt.privateStatePlan.backupId,
		scopes: ["canonical-project", "project-server-private", "runtime-private"],
		expectedStateDigest: state.stateDigest,
		expectedCanonicalSnapshotDigest: canonicalDigest,
		activateBackupBuild: true,
		restoredAt: input.restoredAt,
	});
}

function migrationCommitInput(
	repoRoot: string,
	staged: StagedKbToWikiMigration,
	runner: GitCommandRunner,
): KbToWikiMigrationCommitInput {
	return {
		repoRoot,
		profile: staged.evidence.sourceSnapshot.readiness.profile,
		plan: staged.plan,
		legacySource: staged.legacySource,
		candidateCommit: staged.migrationCommit,
		receipt: staged.receipt,
		activeManagedRefs: staged.activeManagedRefs,
		runner,
	};
}

async function validateActivatedRefs(input: KbToWikiMigrationCommitInput): Promise<void> {
	await validateKbToWikiMigrationCommit(input);
	if (await inspectKbToWikiMigrationActivation(input) !== "activated") {
		throw new Error("KB-to-Wiki Git ref activation did not replay.");
	}
}

async function materializeMigrationWorktree(
	repoRoot: string,
	staged: StagedKbToWikiMigration,
	target: "source" | "target",
	runner: GitCommandRunner,
): Promise<void> {
	await assertWorktreeAtMigrationEndpoints(repoRoot, staged, runner);
	const canonicalRef = staged.evidence.sourceSnapshot.readiness.profile.canonicalRef;
	const symbolicHead = await git(repoRoot, runner, ["symbolic-ref", "-q", "HEAD"]);
	if (symbolicHead !== canonicalRef) {
		throw new Error("KB-to-Wiki worktree materialization requires canonical ref checked out.");
	}
	const commit = target === "target"
		? staged.migrationCommit.hex
		: staged.plan.source.sourceCommit.hex;
	const writeRoots = target === "target"
		? [".codewiki/config.json", ".codewiki/wiki", ".codewiki/changes"]
		: [".codewiki/config.json", ".codewiki/kb", ".codewiki/traces"];
	const removeRoots = target === "target"
		? [".codewiki/kb", ".codewiki/traces"]
		: [".codewiki/wiki", ".codewiki/changes"];
	for (const path of writeRoots) {
		if (await pathExistsInCommit(repoRoot, runner, commit, path)) {
			await git(repoRoot, runner, ["checkout", commit, "--", path]);
		}
	}
	await git(repoRoot, runner, [
		"rm",
		"-r",
		"-q",
		"-f",
		"--ignore-unmatch",
		"--",
		...removeRoots,
	]);
	const clean = await canonicalWorktreeClean(repoRoot, runner);
	if (!clean) {
		throw new Error(`KB-to-Wiki ${target} worktree materialization is incomplete.`);
	}
}

async function assertWorktreeAtMigrationEndpoints(
	repoRoot: string,
	staged: StagedKbToWikiMigration,
	runner: GitCommandRunner,
): Promise<void> {
	const source = staged.plan.source.sourceCommit.hex;
	const target = staged.migrationCommit.hex;
	const changedOutput = await git(repoRoot, runner, [
		"diff-tree",
		"--no-commit-id",
		"--name-only",
		"-r",
		"-z",
		source,
		target,
	]);
	const changed = changedOutput.split("\0").filter(Boolean);
	const changedSet = new Set(changed);
	const status = await runGit(repoRoot, runner, [
		"status",
		"--porcelain=v1",
		"-z",
		"--untracked-files=all",
		"--",
		".codewiki",
	]);
	if (status.exitCode !== 0) {
		throw new Error(`Cannot inspect migration worktree endpoints: ${status.stderr.trim()}`);
	}
	for (const record of status.stdout.split("\0").filter(Boolean)) {
		const path = record.slice(3);
		if (!changedSet.has(path)) {
			throw new Error(`KB-to-Wiki recovery found unrelated canonical edit ${path}.`);
		}
	}
	for (const path of changed) {
		const [sourceOid, targetOid, worktreeOid] = await Promise.all([
			commitPathOid(repoRoot, runner, source, path),
			commitPathOid(repoRoot, runner, target, path),
			worktreePathOid(repoRoot, runner, path),
		]);
		if (worktreeOid !== sourceOid && worktreeOid !== targetOid) {
			throw new Error(`KB-to-Wiki recovery found non-endpoint bytes at ${path}.`);
		}
	}
}

async function commitPathOid(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
	path: string,
): Promise<string | null> {
	const exists = await pathExistsInCommit(repoRoot, runner, commit, path);
	if (!exists) return null;
	return git(repoRoot, runner, ["rev-parse", `${commit}:${path}`]);
}

async function worktreePathOid(
	repoRoot: string,
	runner: GitCommandRunner,
	path: string,
): Promise<string | null> {
	try {
		const metadata = await lstat(join(repoRoot, path));
		if (!metadata.isFile()) {
			throw new Error(`KB-to-Wiki migration path ${path} is not a regular file.`);
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	return git(repoRoot, runner, ["hash-object", "--no-filters", "--", path]);
}

async function pathExistsInCommit(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
	path: string,
): Promise<boolean> {
	const result = await runGit(repoRoot, runner, ["cat-file", "-e", `${commit}:${path}`]);
	if (result.exitCode === 0) return true;
	if (result.exitCode === 128) return false;
	throw new Error(`Cannot inspect migration path ${path}: ${result.stderr.trim()}`);
}

async function canonicalWorktreeClean(
	repoRoot: string,
	runner: GitCommandRunner,
): Promise<boolean> {
	const result = await runGit(repoRoot, runner, [
		"status",
		"--porcelain=v1",
		"-z",
		"--untracked-files=all",
		"--",
		".codewiki",
	]);
	if (result.exitCode !== 0) {
		throw new Error(`Cannot inspect canonical worktree: ${result.stderr.trim()}`);
	}
	return result.stdout.length === 0;
}

async function requireState(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
}): Promise<BackendStateManifest> {
	const state = await readBackendStateManifest(input);
	if (!state) throw new Error("KB-to-Wiki activation requires bootstrapped Backend state.");
	return state;
}

async function git(
	repoRoot: string,
	runner: GitCommandRunner,
	args: readonly string[],
): Promise<string> {
	const result = await runGit(repoRoot, runner, args);
	if (result.exitCode !== 0) {
		throw new Error(`Git ${args[0]} failed: ${result.stderr.trim()}`);
	}
	return result.stdout.trim();
}

async function runGit(
	repoRoot: string,
	runner: GitCommandRunner,
	args: readonly string[],
): Promise<GitCommandResult> {
	return runner({repoRoot, args});
}
