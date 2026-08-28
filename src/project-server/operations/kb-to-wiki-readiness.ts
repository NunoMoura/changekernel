import {
	createGitCommandRunner,
	type GitCommandResult,
	type GitCommandRunner,
} from "../../changes/trace/git-command.ts";
import {readProjectCoordinatorOwnership} from "../coordinator/endpoint.ts";
import {assertSemanticRootState} from "../../knowledge/kb-to-wiki-migration.ts";
import {
	assertCanonicalRef,
	assertGitOid,
	assertGitStoreProfile,
	type GitOid,
	type GitStoreProfile,
} from "../../project/git-store-profile.ts";
import type {Sha256Digest} from "../../utils/canonical-json.ts";
import {readStandaloneProjectServerStatus} from "./lifecycle.ts";

const CODEWIKI_ROOT = ".codewiki";

export interface KbToWikiMigrationReadinessInput {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly profile: GitStoreProfile;
	readonly expectedCanonical: GitOid;
	readonly backupRef: string;
	readonly runner?: GitCommandRunner;
}

export interface KbToWikiMigrationReadiness {
	readonly profile: GitStoreProfile;
	readonly sourceCommit: GitOid;
	readonly backupRef: string;
	readonly repositoryIdentity: Sha256Digest;
	readonly stateGeneration: number;
	readonly stateDigest: Sha256Digest;
	readonly backendBuildDigest: Sha256Digest;
	readonly legacyTraceRootPresent: boolean;
}

/**
 * Prove read-only source conditions required before stopped KB-to-Wiki staging.
 * This operation creates no Git objects, refs, backups, Receipts, or target files.
 */
export async function assertKbToWikiMigrationReadiness(
	input: KbToWikiMigrationReadinessInput,
): Promise<KbToWikiMigrationReadiness> {
	assertGitStoreProfile(input.profile);
	assertGitOid(input.expectedCanonical, "expectedCanonical", input.profile.objectFormat);
	assertCanonicalRef(input.backupRef);
	if (input.backupRef === input.profile.canonicalRef) {
		throw new Error("Migration backup ref must differ from the canonical ref.");
	}

	const status = await stoppedMigrationState(input);
	const runner = input.runner ?? createGitCommandRunner();
	await assertRepositoryFormatAndHistory(input, runner);
	const canonical = await canonicalSourceCommit(input, runner);
	await assertMigrationRefsAvailable(input, runner);
	const legacyTraceRootPresent = await inspectLegacySourceTree(input.repoRoot, runner, canonical);
	await assertCodeWikiWorktreeClean(input.repoRoot, runner);

	return Object.freeze({
		profile: Object.freeze({...input.profile}),
		sourceCommit: canonical,
		backupRef: input.backupRef,
		repositoryIdentity: status.repositoryIdentity,
		stateGeneration: status.stateGeneration,
		stateDigest: status.stateDigest,
		backendBuildDigest: status.backendBuildDigest,
		legacyTraceRootPresent,
	});
}

async function stoppedMigrationState(input: KbToWikiMigrationReadinessInput): Promise<{
	readonly repositoryIdentity: Sha256Digest;
	readonly stateGeneration: number;
	readonly stateDigest: Sha256Digest;
	readonly backendBuildDigest: Sha256Digest;
}> {
	const status = await readStandaloneProjectServerStatus({
		repoRoot: input.repoRoot,
		stateRoot: input.stateRoot,
	});
	if (status.lifecycle !== "stopped") {
		throw new Error(
			`KB-to-Wiki migration requires a stopped Project Server; observed ${status.lifecycle}.`,
		);
	}
	if (
		status.stateGeneration === null ||
		status.stateDigest === null ||
		status.backendBuildDigest === null
	) {
		throw new Error("Stopped Project Server state is incomplete for KB-to-Wiki migration.");
	}
	const ownership = await readProjectCoordinatorOwnership(input.repoRoot, input.stateRoot);
	if (ownership) {
		throw new Error("KB-to-Wiki migration requires released Project Server ownership.");
	}
	return Object.freeze({
		repositoryIdentity: status.repositoryIdentity,
		stateGeneration: status.stateGeneration,
		stateDigest: status.stateDigest,
		backendBuildDigest: status.backendBuildDigest,
	});
}

async function assertRepositoryFormatAndHistory(
	input: KbToWikiMigrationReadinessInput,
	runner: GitCommandRunner,
): Promise<void> {
	const formatResult = await git(input.repoRoot, runner, ["rev-parse", "--show-object-format"]);
	if (formatResult.stdout.trim() !== input.profile.objectFormat) {
		throw new Error("Repository object format does not match the Git store profile.");
	}
	const shallowResult = await git(input.repoRoot, runner, [
		"rev-parse",
		"--is-shallow-repository",
	]);
	if (shallowResult.stdout.trim() !== "false") {
		throw new Error("KB-to-Wiki migration requires complete non-shallow Git history.");
	}
}

async function canonicalSourceCommit(
	input: KbToWikiMigrationReadinessInput,
	runner: GitCommandRunner,
): Promise<GitOid> {
	const canonical = await readRef(
		input.repoRoot,
		runner,
		input.profile.canonicalRef,
		input.profile.objectFormat,
	);
	if (canonical === null || canonical.hex !== input.expectedCanonical.hex) {
		throw new Error("Canonical ref does not match expectedCanonical.");
	}
	const typeResult = await git(input.repoRoot, runner, ["cat-file", "-t", canonical.hex]);
	if (typeResult.stdout.trim() !== "commit") {
		throw new Error("Canonical ref must resolve to a commit.");
	}
	return canonical;
}

async function assertMigrationRefsAvailable(
	input: KbToWikiMigrationReadinessInput,
	runner: GitCommandRunner,
): Promise<void> {
	const backup = await readRef(
		input.repoRoot,
		runner,
		input.backupRef,
		input.profile.objectFormat,
	);
	if (backup !== null) throw new Error("Migration backup ref already exists.");
	const managedRefs = await listRefs(input.repoRoot, runner, "refs/codewiki/changes/");
	if (managedRefs.length > 0) {
		throw new Error("Target managed Change refs must be absent before KB-to-Wiki migration.");
	}
}

async function inspectLegacySourceTree(
	repoRoot: string,
	runner: GitCommandRunner,
	canonical: GitOid,
): Promise<boolean> {
	const [hasKbRoot, hasWikiRoot, hasTraceRoot, hasChangeRoot, hasRuntimeRoot, hasViewsRoot] =
		await Promise.all([
			hasTree(repoRoot, runner, canonical.hex, codewikiPath("kb")),
			hasTree(repoRoot, runner, canonical.hex, codewikiPath("wiki")),
			hasTree(repoRoot, runner, canonical.hex, codewikiPath("traces")),
			hasTree(repoRoot, runner, canonical.hex, codewikiPath("changes")),
			hasTree(repoRoot, runner, canonical.hex, codewikiPath("runtime")),
			hasTree(repoRoot, runner, canonical.hex, codewikiPath("views")),
		]);
	const semanticRoot = assertSemanticRootState({
		hasKbRoot,
		hasWikiRoot,
		activeReader: "legacy",
	});
	if (semanticRoot !== "legacy") {
		throw new Error("KB-to-Wiki migration requires an active legacy KB root.");
	}
	if (hasChangeRoot) throw new Error("Legacy reader must refuse the target Change root.");
	if (hasRuntimeRoot || hasViewsRoot) {
		throw new Error("Canonical Git contains prohibited Runtime or View residue.");
	}
	return hasTraceRoot;
}

function codewikiPath(name: string): string {
	return `${CODEWIKI_ROOT}/${name}`;
}

async function assertCodeWikiWorktreeClean(
	repoRoot: string,
	runner: GitCommandRunner,
): Promise<void> {
	const status = await git(repoRoot, runner, [
		"status",
		"--porcelain=v1",
		"-z",
		"--untracked-files=all",
		"--",
		".codewiki",
	]);
	if (status.stdout.length > 0) {
		throw new Error("Canonical CodeWiki paths must be clean before KB-to-Wiki migration.");
	}
}

async function readRef(
	repoRoot: string,
	runner: GitCommandRunner,
	ref: string,
	objectFormat: GitStoreProfile["objectFormat"],
): Promise<GitOid | null> {
	const refs = await listRefs(repoRoot, runner, ref);
	const exact = refs.find((entry) => entry.ref === ref);
	if (!exact) return null;
	const oid = {algorithm: objectFormat, hex: exact.oid};
	assertGitOid(oid, ref, objectFormat);
	return Object.freeze(oid);
}

async function listRefs(
	repoRoot: string,
	runner: GitCommandRunner,
	prefix: string,
): Promise<readonly {readonly ref: string; readonly oid: string}[]> {
	const result = await git(repoRoot, runner, [
		"for-each-ref",
		"--format=%(refname)%00%(objectname)",
		prefix,
	]);
	const output = result.stdout;
	if (output.length === 0) return [];
	return output.trimEnd().split("\n").map((line) => {
		const [ref, oid, ...extra] = line.split("\0");
		if (!ref || !oid || extra.length > 0) {
			throw new Error("Git returned a malformed ref record.");
		}
		return Object.freeze({ref, oid});
	});
}

async function hasTree(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
	path: string,
): Promise<boolean> {
	const result = await git(repoRoot, runner, [
		"ls-tree",
		"-z",
		"--full-tree",
		commit,
		"--",
		path,
	]);
	const output = result.stdout;
	if (output.length === 0) return false;
	const records = output.split("\0").filter((record) => record.length > 0);
	if (records.length !== 1) throw new Error(`Git tree lookup for ${path} was ambiguous.`);
	const [metadata, actualPath] = records[0].split("\t");
	const [, type] = metadata.split(" ");
	if (actualPath !== path || type !== "tree") {
		throw new Error(`Canonical path ${path} must resolve to one tree.`);
	}
	return true;
}

async function git(
	repoRoot: string,
	runner: GitCommandRunner,
	args: readonly string[],
): Promise<GitCommandResult> {
	const result = await runner({
		repoRoot,
		args: ["--no-pager", ...args],
		environment: {
			GIT_ATTR_NOSYSTEM: "1",
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_NO_REPLACE_OBJECTS: "1",
			GIT_OPTIONAL_LOCKS: "0",
			GIT_TERMINAL_PROMPT: "0",
		},
	});
	if (result.exitCode !== 0) {
		throw new Error(`Git command failed: git ${args.join(" ")}: ${result.stderr.trim()}`);
	}
	return result;
}
