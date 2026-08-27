import {sha256Base32Nfc} from "../utils/base32.ts";
import {validateWikiTree, type ValidatedWikiTree} from "../knowledge/wiki-tree.ts";
import {
	assertGitOid,
	assertGitStoreProfile,
	type GitOid,
	type GitStoreProfile,
} from "../project/git-store-profile.ts";
import {
	changeTracePath,
	parseChangeTrace,
	type ChangeTraceOperation,
} from "./trace/semantic-kernel.ts";
import {
	createGitCommandRunner,
	type GitCommandRunner,
} from "./trace/git-command.ts";

export interface ProposalCommitValidationInput {
	readonly repoRoot: string;
	readonly profile: GitStoreProfile;
	readonly changeId: string;
	readonly proposalCommit: GitOid;
	readonly expectedCanonical: GitOid;
	readonly expectedPriorProposal?: GitOid;
	readonly runner?: GitCommandRunner;
}

export interface DerivedWikiChange {
	readonly changedItemIds: readonly string[];
	readonly retiredItemIds: readonly string[];
}

export interface ProposalCommitValidation {
	readonly proposalCommit: GitOid;
	readonly changedPaths: readonly string[];
	readonly changedWikiPaths: readonly string[];
	readonly changedItemIds: readonly string[];
	readonly retiredItemIds: readonly string[];
	readonly tracePath: string;
	readonly operation: ChangeTraceOperation;
}

export type ChangeDisposition = "accepted" | "rejected" | "deferred" | "withdrawn";

export interface DispositionCommitValidationInput {
	readonly repoRoot: string;
	readonly profile: GitStoreProfile;
	readonly changeId: string;
	readonly disposition: ChangeDisposition;
	readonly dispositionCommit: GitOid;
	readonly expectedCanonical: GitOid;
	readonly proposalCommit: GitOid;
	readonly expectedProposalTip: GitOid;
	readonly runner?: GitCommandRunner;
}

export function managedChangeRef(changeId: string): string {
	const encoded = sha256Base32Nfc(changeId, "changeId");
	return `refs/codewiki/changes/${encoded.slice(0, 2)}/${encoded}`;
}

export async function validateManagedChangeRef(input: {
	readonly repoRoot: string;
	readonly profile: GitStoreProfile;
	readonly changeId: string;
	readonly expectedTip: GitOid;
	readonly runner?: GitCommandRunner;
}): Promise<void> {
	assertGitStoreProfile(input.profile);
	assertGitOid(input.expectedTip, "expectedTip", input.profile.objectFormat);
	const runner = input.runner ?? createGitCommandRunner();
	await assertRepositoryFormat(input.repoRoot, input.profile, runner);
	const ref = managedChangeRef(input.changeId);
	const actual = await git(input.repoRoot, runner, ["rev-parse", "--verify", ref]);
	if (actual.trim() !== input.expectedTip.hex) {
		throw new Error("Managed Change ref does not match expected proposal tip.");
	}
}

export async function updateManagedChangeRefCas(input: {
	readonly repoRoot: string;
	readonly profile: GitStoreProfile;
	readonly changeId: string;
	readonly expectedTip: GitOid | null;
	readonly newTip: GitOid;
	readonly runner?: GitCommandRunner;
}): Promise<void> {
	assertGitStoreProfile(input.profile);
	assertGitOid(input.newTip, "newTip", input.profile.objectFormat);
	if (input.expectedTip !== null) {
		assertGitOid(input.expectedTip, "expectedTip", input.profile.objectFormat);
	}
	const runner = input.runner ?? createGitCommandRunner();
	await assertRepositoryFormat(input.repoRoot, input.profile, runner);
	await assertObjectType(input.repoRoot, runner, input.newTip.hex, "commit");
	const expected = input.expectedTip?.hex ?? "0".repeat(
		input.profile.objectFormat === "sha1" ? 40 : 64,
	);
	const ref = managedChangeRef(input.changeId);
	const result = await runGit(input.repoRoot, runner, [
		"update-ref",
		"--no-deref",
		ref,
		input.newTip.hex,
		expected,
	]);
	if (result.exitCode !== 0) {
		throw new Error(`Managed Change ref CAS failed: ${result.stderr.trim()}`);
	}
}

export async function admitDispositionRefsCas(
	input: DispositionCommitValidationInput,
): Promise<void> {
	await validateDispositionCommit(input);
	const runner = input.runner ?? createGitCommandRunner();
	const managedRef = managedChangeRef(input.changeId);
	const transaction = [
		"start",
		`update ${input.profile.canonicalRef} ${input.dispositionCommit.hex} ${input.expectedCanonical.hex}`,
		`delete ${managedRef} ${input.expectedProposalTip.hex}`,
		"prepare",
		"commit",
		"",
	].join("\n");
	const result = await runGit(
		input.repoRoot,
		runner,
		["update-ref", "--stdin"],
		"utf8",
		transaction,
	);
	if (result.exitCode !== 0) {
		throw new Error(`Disposition ref transaction CAS failed: ${result.stderr.trim()}`);
	}
}

export async function validateProposalCommit(
	input: ProposalCommitValidationInput,
): Promise<ProposalCommitValidation> {
	assertGitStoreProfile(input.profile);
	assertGitOid(input.proposalCommit, "proposalCommit", input.profile.objectFormat);
	assertGitOid(input.expectedCanonical, "expectedCanonical", input.profile.objectFormat);
	if (input.expectedPriorProposal !== undefined) {
		assertGitOid(
			input.expectedPriorProposal,
			"expectedPriorProposal",
			input.profile.objectFormat,
		);
	}
	const runner = input.runner ?? createGitCommandRunner();
	await assertRepositoryFormat(input.repoRoot, input.profile, runner);
	await assertRefEquals(
		input.repoRoot,
		runner,
		input.profile.canonicalRef,
		input.expectedCanonical.hex,
		"Canonical ref",
	);
	await assertObjectType(input.repoRoot, runner, input.proposalCommit.hex, "commit");
	const parents = await commitParents(input.repoRoot, runner, input.proposalCommit.hex);
	const expectedParents = [
		input.expectedCanonical.hex,
		...(input.expectedPriorProposal === undefined
			? []
			: [input.expectedPriorProposal.hex]),
	];
	assertSameList(parents, expectedParents, "Proposal commit parents");
	const paths = await listChangedPaths(
		input.repoRoot,
		runner,
		input.expectedCanonical.hex,
		input.proposalCommit.hex,
	);
	const tracePath = changeTracePath(input.changeId);
	assertProposalPaths(paths, tracePath);
	const traceBytes = await readPath(input.repoRoot, runner, input.proposalCommit.hex, tracePath);
	const trace = parseChangeTrace(traceBytes);
	if (trace.header.changeId !== input.changeId) {
		throw new Error("Proposal trace header does not match managed Change.");
	}
	if (trace.header.repositoryId !== input.profile.repositoryId) {
		throw new Error("Proposal trace repository does not match Git store profile.");
	}
	const operation = trace.operations.at(-1);
	if (operation?.kind !== "change.proposed") {
		throw new Error("Proposal commit must append change.proposed.");
	}
	const predecessorCommit = input.expectedPriorProposal?.hex ?? input.expectedCanonical.hex;
	const predecessorOid = await pathOidOrNull(
		input.repoRoot,
		runner,
		predecessorCommit,
		tracePath,
	);
	if (input.expectedPriorProposal !== undefined && predecessorOid === null) {
		throw new Error("Prior proposal is missing its Change Trace.");
	}
	if (predecessorOid !== null) {
		const predecessor = await readPath(input.repoRoot, runner, predecessorCommit, tracePath);
		if (!traceBytes.startsWith(predecessor) || traceBytes === predecessor) {
			throw new Error(input.expectedPriorProposal === undefined
				? "Proposal must append the exact canonical Trace prefix."
				: "Later proposal must append the exact prior Trace prefix.");
		}
	}
	const wikiPaths = paths.filter(isWikiItemPath);
	const canonicalWiki = await readWikiTree(
		input.repoRoot,
		runner,
		input.expectedCanonical.hex,
	);
	const proposalWiki = await readWikiTree(
		input.repoRoot,
		runner,
		input.proposalCommit.hex,
	);
	const wikiChange = deriveWikiChange(canonicalWiki, proposalWiki);
	const requirements = operation.payload.completionRequirements;
	if (!Array.isArray(requirements)) {
		throw new Error("Proposal must declare completionRequirements.");
	}
	if (wikiPaths.length === 0 && requirements.length === 0) {
		throw new Error("Empty Wiki diff and empty Completion Requirements is an invalid no-op.");
	}
	if (wikiPaths.length === 0) {
		const targets = operation.payload.targetRefs;
		if (!Array.isArray(targets) || targets.length === 0) {
			throw new Error("Conformance repair requires Item targetRefs.");
		}
	}
	return Object.freeze({
		proposalCommit: Object.freeze({...input.proposalCommit}),
		changedPaths: Object.freeze(paths),
		changedWikiPaths: Object.freeze(wikiPaths),
		changedItemIds: Object.freeze(wikiChange.changedItemIds),
		retiredItemIds: Object.freeze(wikiChange.retiredItemIds),
		tracePath,
		operation,
	});
}

export async function validateDispositionCommit(
	input: DispositionCommitValidationInput,
): Promise<void> {
	assertGitStoreProfile(input.profile);
	for (const [field, oid] of [
		["dispositionCommit", input.dispositionCommit],
		["expectedCanonical", input.expectedCanonical],
		["proposalCommit", input.proposalCommit],
		["expectedProposalTip", input.expectedProposalTip],
	] as const) {
		assertGitOid(oid, field, input.profile.objectFormat);
	}
	const runner = input.runner ?? createGitCommandRunner();
	await assertRepositoryFormat(input.repoRoot, input.profile, runner);
	await assertRefEquals(
		input.repoRoot,
		runner,
		input.profile.canonicalRef,
		input.expectedCanonical.hex,
		"Canonical ref",
	);
	await assertObjectType(input.repoRoot, runner, input.dispositionCommit.hex, "commit");
	const parents = await commitParents(input.repoRoot, runner, input.dispositionCommit.hex);
	assertSameList(
		parents,
		[input.expectedCanonical.hex, input.expectedProposalTip.hex],
		"Disposition commit parents",
	);
	const ancestor = await runGit(input.repoRoot, runner, [
		"merge-base",
		"--is-ancestor",
		input.proposalCommit.hex,
		input.expectedProposalTip.hex,
	]);
	if (ancestor.exitCode !== 0) {
		throw new Error("Exact proposal commit must be retained by proposal-tip ancestry.");
	}
	const tracePath = changeTracePath(input.changeId);
	const changed = await listChangedPaths(
		input.repoRoot,
		runner,
		input.expectedCanonical.hex,
		input.dispositionCommit.hex,
	);
	assertProposalPaths(changed, tracePath);
	const predecessor = await readPath(
		input.repoRoot,
		runner,
		input.expectedProposalTip.hex,
		tracePath,
	);
	const traceBytes = await readPath(
		input.repoRoot,
		runner,
		input.dispositionCommit.hex,
		tracePath,
	);
	if (!traceBytes.startsWith(predecessor) || traceBytes === predecessor) {
		throw new Error("Disposition must append the exact proposal-tip Trace prefix.");
	}
	const trace = parseChangeTrace(traceBytes);
	if (trace.header.changeId !== input.changeId) {
		throw new Error("Disposition trace header does not match managed Change.");
	}
	if (trace.header.repositoryId !== input.profile.repositoryId) {
		throw new Error("Disposition trace repository does not match Git store profile.");
	}
	const terminal = trace.operations.at(-1);
	if (terminal?.kind !== `change.${input.disposition}`) {
		throw new Error("Disposition Trace operation does not match requested disposition.");
	}
	assertBoundOid(
		terminal.payload.expectedCanonical,
		input.expectedCanonical,
		"terminal expectedCanonical",
		input.profile,
	);
	assertBoundOid(
		terminal.payload.proposalCommit,
		input.proposalCommit,
		"terminal proposalCommit",
		input.profile,
	);
	assertBoundOid(
		terminal.payload.proposalTip,
		input.expectedProposalTip,
		"terminal proposalTip",
		input.profile,
	);
	const expectedWikiSource =
		input.disposition === "accepted"
			? input.proposalCommit.hex
			: input.expectedCanonical.hex;
	const expectedWikiTree = await pathOidOrNull(
		input.repoRoot,
		runner,
		expectedWikiSource,
		".codewiki/wiki/items",
	);
	const actualWikiTree = await pathOidOrNull(
		input.repoRoot,
		runner,
		input.dispositionCommit.hex,
		".codewiki/wiki/items",
	);
	if (actualWikiTree !== expectedWikiTree) {
		throw new Error("Disposition commit contains the wrong Wiki tree.");
	}
	const canonicalWiki = await readWikiTree(
		input.repoRoot,
		runner,
		input.expectedCanonical.hex,
	);
	const proposalWiki = await readWikiTree(
		input.repoRoot,
		runner,
		input.proposalCommit.hex,
	);
	await readWikiTree(input.repoRoot, runner, input.dispositionCommit.hex);
	if (input.disposition === "accepted") {
		const wikiChange = deriveWikiChange(canonicalWiki, proposalWiki);
		assertSameList(
			stringArray(terminal.payload.acceptedItemIds, "acceptedItemIds"),
			wikiChange.changedItemIds,
			"Accepted Item IDs",
		);
		assertSameList(
			stringArray(terminal.payload.retiredItemIds, "retiredItemIds"),
			wikiChange.retiredItemIds,
			"Retired Item IDs",
		);
	}
}

async function readWikiTree(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
): Promise<ValidatedWikiTree> {
	const result = await runGit(
		repoRoot,
		runner,
		[
			"ls-tree",
			"-r",
			"-z",
			"--full-tree",
			commit,
			"--",
			".codewiki/wiki/items",
		],
		"base64",
	);
	if (result.exitCode !== 0) {
		throw new Error(`Cannot read Wiki tree: ${result.stderr.trim()}`);
	}
	let listing: string;
	try {
		listing = new TextDecoder("utf-8", {fatal: true}).decode(
			Buffer.from(result.stdout, "base64"),
		);
	} catch {
		throw new Error("Wiki tree contains a non-UTF-8 path.");
	}
	const entries: Array<{path: string; bytes: string}> = [];
	for (const record of listing.split("\0").filter(Boolean)) {
		const match = /^([0-7]{6}) ([a-z]+) ([0-9a-f]+)\t(.+)$/u.exec(record);
		if (match === null) throw new Error("Git returned a malformed Wiki tree entry.");
		const [, mode, type, , path] = match;
		if (mode !== "100644" || type !== "blob" || path === undefined) {
			throw new Error("Wiki Items must be ordinary non-executable Git blobs.");
		}
		entries.push({path, bytes: await readPath(repoRoot, runner, commit, path)});
	}
	return validateWikiTree(entries);
}

export function deriveWikiChange(
	before: ValidatedWikiTree,
	after: ValidatedWikiTree,
): DerivedWikiChange {
	const beforeEntries = new Map(before.entries.map((entry) => [entry.item.itemId, entry]));
	const afterIds = new Set(after.entries.map((entry) => entry.item.itemId));
	const changedItemIds: string[] = [];
	for (const entry of after.entries) {
		const previous = beforeEntries.get(entry.item.itemId);
		if (
			previous === undefined ||
			previous.path !== entry.path ||
			previous.bytes !== entry.bytes
		) {
			changedItemIds.push(entry.item.itemId);
		}
	}
	const retiredItemIds = before.entries
		.map((entry) => entry.item.itemId)
		.filter((itemId) => !afterIds.has(itemId));
	changedItemIds.sort(compareText);
	retiredItemIds.sort(compareText);
	return {changedItemIds, retiredItemIds};
}

function stringArray(value: unknown, field: string): readonly string[] {
	if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
	const result: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string") throw new Error(`${field} must contain strings.`);
		result.push(entry);
	}
	return result;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

async function assertRepositoryFormat(
	repoRoot: string,
	profile: GitStoreProfile,
	runner: GitCommandRunner,
): Promise<void> {
	const format = (await git(repoRoot, runner, ["rev-parse", "--show-object-format"])).trim();
	if (format !== profile.objectFormat) {
		throw new Error("Repository object format differs from frozen Git store profile.");
	}
}

async function assertRefEquals(
	repoRoot: string,
	runner: GitCommandRunner,
	ref: string,
	expected: string,
	field: string,
): Promise<void> {
	const actual = (await git(repoRoot, runner, ["rev-parse", "--verify", ref])).trim();
	if (actual !== expected) throw new Error(`${field} does not match expected head.`);
}

async function assertObjectType(
	repoRoot: string,
	runner: GitCommandRunner,
	oid: string,
	expected: string,
): Promise<void> {
	const actual = (await git(repoRoot, runner, ["cat-file", "-t", oid])).trim();
	if (actual !== expected) throw new Error(`Git object ${oid} must be ${expected}.`);
}

async function commitParents(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
): Promise<readonly string[]> {
	const line = (await git(repoRoot, runner, ["rev-list", "--parents", "-n", "1", commit])).trim();
	const [actual, ...parents] = line.split(" ");
	if (actual !== commit) throw new Error("Git returned an unexpected commit identity.");
	return parents;
}

async function listChangedPaths(
	repoRoot: string,
	runner: GitCommandRunner,
	parent: string,
	commit: string,
): Promise<readonly string[]> {
	const output = await git(repoRoot, runner, [
		"diff-tree",
		"--no-commit-id",
		"--name-only",
		"--no-renames",
		"-r",
		"-z",
		parent,
		commit,
	]);
	return output.split("\0").filter(Boolean);
}

async function readPath(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
	path: string,
): Promise<string> {
	const oid = (await git(repoRoot, runner, ["rev-parse", "--verify", `${commit}:${path}`])).trim();
	await assertObjectType(repoRoot, runner, oid, "blob");
	const result = await runGit(repoRoot, runner, ["cat-file", "blob", oid], "base64");
	if (result.exitCode !== 0) throw new Error(`Cannot read ${path}: ${result.stderr.trim()}`);
	return Buffer.from(result.stdout, "base64").toString("utf8");
}

async function pathOidOrNull(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
	path: string,
): Promise<string | null> {
	const result = await runGit(repoRoot, runner, ["rev-parse", "--verify", `${commit}:${path}`]);
	return result.exitCode === 0 ? result.stdout.trim() : null;
}

function assertProposalPaths(paths: readonly string[], tracePath: string): void {
	if (!paths.includes(tracePath)) {
		throw new Error("Commit must change its one fixed Change Trace path.");
	}
	for (const path of paths) {
		if (path !== tracePath && !isWikiItemPath(path)) {
			throw new Error(`Commit changed forbidden path ${path}.`);
		}
	}
}

function isWikiItemPath(path: string): boolean {
	return path.startsWith(".codewiki/wiki/items/");
}

function assertBoundOid(
	value: unknown,
	expected: GitOid,
	field: string,
	profile: GitStoreProfile,
): void {
	assertGitOid(value, field, profile.objectFormat);
	if (value.hex !== expected.hex) {
		throw new Error(`${field} does not match disposition ancestry.`);
	}
}

function assertSameList(
	actual: readonly string[],
	expected: readonly string[],
	field: string,
): void {
	if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
		throw new Error(`${field} do not match expected ancestry.`);
	}
}

async function git(
	repoRoot: string,
	runner: GitCommandRunner,
	args: readonly string[],
): Promise<string> {
	const result = await runGit(repoRoot, runner, args);
	if (result.exitCode !== 0) {
		throw new Error(`Git ${args[0] ?? "command"} failed: ${result.stderr.trim()}`);
	}
	return result.stdout;
}

function runGit(
	repoRoot: string,
	runner: GitCommandRunner,
	args: readonly string[],
	stdoutEncoding: "utf8" | "base64" = "utf8",
	input?: string,
) {
	return runner({
		repoRoot,
		args: ["--no-pager", ...args],
		input,
		stdoutEncoding,
		environment: {
			GIT_ATTR_NOSYSTEM: "1",
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_NO_REPLACE_OBJECTS: "1",
			GIT_OPTIONAL_LOCKS: "0",
			GIT_TERMINAL_PROMPT: "0",
		},
	});
}
