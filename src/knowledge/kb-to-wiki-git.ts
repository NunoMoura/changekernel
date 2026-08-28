import {Buffer} from "node:buffer";
import {canonicalSemanticJson} from "../utils/semantic-digest.ts";
import {canonicalJson, canonicalJsonDigest} from "../utils/canonical-json.ts";
import {
	createGitCommandRunner,
	type GitCommandResult,
	type GitCommandRunner,
} from "../changes/trace/git-command.ts";
import {
	changeTracePath,
	parseChangeTrace,
	reduceChangeTrace,
	serializeChangeTrace,
} from "../changes/trace/semantic-kernel.ts";
import {
	assertGitOid,
	assertGitStoreProfile,
	type GitOid,
	type GitStoreProfile,
} from "../project/git-store-profile.ts";
import {validateWikiTree, type ValidatedWikiTree} from "./wiki-tree.ts";
import {
	createKbToWikiLegacyEquivalenceProof,
	verifyKbToWikiMigrationPlan,
	type CreateKbToWikiMigrationPlanInput,
	type KbToWikiMigrationPlan,
} from "./kb-to-wiki-migration.ts";
import {
	assertKbToWikiMigrationReceipt,
	createKbToWikiActiveProposalOperation,
	type KbToWikiMigrationReceipt,
	type MigrationActiveChangePlan,
} from "./kb-to-wiki-receipt.ts";

export interface MigrationManagedRefTarget {
	readonly changeId: string;
	readonly proposalCommit: GitOid;
}

export interface KbToWikiMigrationCommitInput {
	readonly repoRoot: string;
	readonly profile: GitStoreProfile;
	readonly plan: KbToWikiMigrationPlan;
	readonly legacySource: CreateKbToWikiMigrationPlanInput;
	readonly candidateCommit: GitOid;
	readonly receipt: KbToWikiMigrationReceipt;
	readonly activeManagedRefs: readonly MigrationManagedRefTarget[];
	readonly runner?: GitCommandRunner;
}

export interface KbToWikiMigrationCommitValidation {
	readonly sourceCommit: GitOid;
	readonly candidateCommit: GitOid;
	readonly wiki: ValidatedWikiTree;
	readonly wikiItemsTreeOid: GitOid | null;
	readonly itemBlobOids: Readonly<Record<string, GitOid>>;
	readonly changeTraceBlobOids: Readonly<Record<string, GitOid>>;
	readonly convertedTraceBlobOids: Readonly<Record<string, GitOid>>;
	readonly migrationTracePreOperationBlobOid: GitOid;
	readonly configurationBlobOid: GitOid;
}

export type KbToWikiMigrationActivationState = "not_activated" | "activated";

interface TreeEntry {
	readonly mode: string;
	readonly type: string;
	readonly oid: string;
	readonly path: string;
}

export async function validateKbToWikiMigrationCommit(
	input: KbToWikiMigrationCommitInput,
): Promise<KbToWikiMigrationCommitValidation> {
	assertCommitInput(input);
	verifyKbToWikiMigrationPlan(input.plan);
	const runner = input.runner ?? createGitCommandRunner();
	const {targetEntries, configurationBlobOid} =
		await validateMigrationCommitEnvelope(input, runner);
	const wikiClosure = await validateMigrationWikiClosure(input, runner, targetEntries);
	const traceClosure = await validateMigrationTraceClosure(input, runner, targetEntries);
	assertReceiptCandidateBindings(input.receipt, {
		wikiItemsTreeOid: wikiClosure.wikiItemsTreeOid,
		itemBlobOids: wikiClosure.itemBlobOids,
		convertedTraceBlobOids: traceClosure.convertedTraceBlobOids,
		migrationTracePreOperationBlobOid: traceClosure.migrationTracePreOperationBlobOid,
	});
	await validateManagedTargets(input, runner);
	return Object.freeze({
		sourceCommit: input.plan.source.sourceCommit,
		candidateCommit: input.candidateCommit,
		wiki: wikiClosure.wiki,
		wikiItemsTreeOid: wikiClosure.wikiItemsTreeOid,
		itemBlobOids: Object.freeze(wikiClosure.itemBlobOids),
		changeTraceBlobOids: Object.freeze(traceClosure.changeTraceBlobOids),
		convertedTraceBlobOids: Object.freeze(traceClosure.convertedTraceBlobOids),
		migrationTracePreOperationBlobOid: traceClosure.migrationTracePreOperationBlobOid,
		configurationBlobOid,
	});
}

export async function activateKbToWikiMigrationRefsCas(
	input: KbToWikiMigrationCommitInput,
): Promise<void> {
	await validateKbToWikiMigrationCommit(input);
	const runner = input.runner ?? createGitCommandRunner();
	await assertRefEquals(
		input.repoRoot,
		runner,
		input.profile.canonicalRef,
		input.plan.source.sourceCommit.hex,
		"canonical ref",
	);
	for (const target of input.activeManagedRefs) {
		await assertRefAbsent(input.repoRoot, runner, managedRef(target.changeId));
	}
	const commands = [
		"start",
		`update ${input.profile.canonicalRef} ${input.candidateCommit.hex} ${input.plan.source.sourceCommit.hex}`,
		...input.activeManagedRefs.map(
			(target) => `create ${managedRef(target.changeId)} ${target.proposalCommit.hex}`,
		),
		"prepare",
		"commit",
		"",
	].join("\n");
	const result = await runGit(
		input.repoRoot,
		runner,
		["update-ref", "--stdin"],
		"utf8",
		commands,
	);
	if (result.exitCode !== 0) {
		throw new Error(`Migration ref transaction CAS failed: ${result.stderr.trim()}`);
	}
}

export async function inspectKbToWikiMigrationActivation(
	input: KbToWikiMigrationCommitInput,
): Promise<KbToWikiMigrationActivationState> {
	assertCommitInput(input);
	const runner = input.runner ?? createGitCommandRunner();
	const canonical = await readRef(input.repoRoot, runner, input.profile.canonicalRef);
	const refs = await Promise.all(
		input.activeManagedRefs.map(async (target) => ({
			expected: target.proposalCommit.hex,
			actual: await readRef(input.repoRoot, runner, managedRef(target.changeId)),
		})),
	);
	const allAbsent = refs.every(({actual}) => actual === null);
	const allExpected = refs.every(({actual, expected}) => actual === expected);
	if (canonical === input.plan.source.sourceCommit.hex && allAbsent) return "not_activated";
	if (canonical === input.candidateCommit.hex && allExpected) return "activated";
	throw new Error("Migration activation refs are inconsistent or partially applied.");
}

export async function restoreKbToWikiMigrationSourceCas(
	input: KbToWikiMigrationCommitInput & {
		readonly targetOnlyCanonicalOperationObserved: boolean;
	},
): Promise<void> {
	if (input.targetOnlyCanonicalOperationObserved) {
		throw new Error("Source restore is forbidden after target-only canonical history.");
	}
	await validateKbToWikiMigrationCommit(input);
	if (await inspectKbToWikiMigrationActivation(input) !== "activated") {
		throw new Error("Migration is not activated.");
	}
	const runner = input.runner ?? createGitCommandRunner();
	const commands = [
		"start",
		`update ${input.profile.canonicalRef} ${input.plan.source.sourceCommit.hex} ${input.candidateCommit.hex}`,
		...input.activeManagedRefs.map(
			(target) => `delete ${managedRef(target.changeId)} ${target.proposalCommit.hex}`,
		),
		"prepare",
		"commit",
		"",
	].join("\n");
	const result = await runGit(
		input.repoRoot,
		runner,
		["update-ref", "--stdin"],
		"utf8",
		commands,
	);
	if (result.exitCode !== 0) {
		throw new Error(`Migration source-restore CAS failed: ${result.stderr.trim()}`);
	}
}

async function validateMigrationWikiClosure(
	input: KbToWikiMigrationCommitInput,
	runner: GitCommandRunner,
	targetEntries: readonly TreeEntry[],
): Promise<{
	readonly wiki: ReturnType<typeof validateWikiTree>;
	readonly wikiItemsTreeOid: GitOid | null;
	readonly itemBlobOids: Readonly<Record<string, GitOid>>;
}> {
	const targetWikiEntries = targetEntries.filter(({path}) => isWikiItemPath(path));
	const wikiFiles = await Promise.all(targetWikiEntries.map(async ({path}) => ({
		path,
		bytes: await readPath(input.repoRoot, runner, input.candidateCommit.hex, path),
	})));
	const wiki = validateWikiTree(wikiFiles);
	assertPlannedWiki(input.plan, wikiFiles);
	return {
		wiki,
		wikiItemsTreeOid: await pathOidOrNull(
			input.repoRoot,
			runner,
			input.candidateCommit.hex,
			".codewiki/wiki/items",
			input.profile,
			"tree",
		),
		itemBlobOids: objectOidMap(targetWikiEntries, input.profile),
	};
}

async function validateMigrationTraceClosure(
	input: KbToWikiMigrationCommitInput,
	runner: GitCommandRunner,
	targetEntries: readonly TreeEntry[],
): Promise<{
	readonly changeTraceBlobOids: Readonly<Record<string, GitOid>>;
	readonly convertedTraceBlobOids: Readonly<Record<string, GitOid>>;
	readonly migrationTracePreOperationBlobOid: GitOid;
}> {
	const changeEntries = targetEntries.filter(({path}) => isChangeTracePath(path));
	if (changeEntries.length === 0) {
		throw new Error("Migration candidate must contain target Change traces.");
	}
	const changeTraceBlobOids = objectOidMap(changeEntries, input.profile);
	const migrationPath = changeTracePath(input.plan.migrationChangeId);
	if (!changeEntries.some(({path}) => path === migrationPath)) {
		throw new Error("Migration candidate is missing dedicated migration Change trace.");
	}
	let predecessor: GitOid | null = null;
	const retiredItemsByChange = new Map<string, Set<string>>();
	for (const entry of changeEntries) {
		const bytes = await readPath(input.repoRoot, runner, input.candidateCommit.hex, entry.path);
		const parsed = parseChangeTrace(bytes);
		assertConvertedTraceHeader(entry.path, parsed.header, input.plan);
		reduceChangeTrace(parsed);
		recordTraceRetirements(parsed, retiredItemsByChange);
		if (entry.path === migrationPath) {
			assertMigrationApplied(input, parsed.operations.at(-1));
			const preOperationBytes = serializeChangeTrace(
				parsed.header,
				parsed.operations.slice(0, -1),
			);
			if (!bytes.startsWith(preOperationBytes)) {
				throw new Error("Migration Trace final operation does not preserve exact predecessor bytes.");
			}
			predecessor = await existingBlobOid(
				input.repoRoot,
				runner,
				preOperationBytes,
				input.profile,
			);
		}
	}
	if (predecessor === null) throw new Error("Migration Trace predecessor blob is missing.");
	const convertedTraceBlobOids = Object.fromEntries(
		Object.entries(changeTraceBlobOids).filter(([path]) => path !== migrationPath),
	);
	assertRetirementTraceBindings(input.plan, retiredItemsByChange);
	return {
		changeTraceBlobOids,
		convertedTraceBlobOids,
		migrationTracePreOperationBlobOid: predecessor,
	};
}

function assertCommitInput(input: KbToWikiMigrationCommitInput): void {
	assertGitStoreProfile(input.profile);
	assertKbToWikiMigrationReceipt(input.receipt);
	if (canonicalSemanticJson(input.plan) !== canonicalSemanticJson(input.receipt.plan)) {
		throw new Error("Migration input plan does not match its canonical Receipt.");
	}
	const replayedEquivalence = createKbToWikiLegacyEquivalenceProof({
		plan: input.plan,
		source: input.legacySource,
	});
	if (
		canonicalSemanticJson(replayedEquivalence) !==
		canonicalSemanticJson(input.receipt.legacyEquivalence)
	) {
		throw new Error("Migration Receipt legacy-equivalence proof does not replay source semantics.");
	}
	assertGitOid(input.candidateCommit, "candidateCommit", input.profile.objectFormat);
	assertGitOid(
		input.plan.source.sourceCommit,
		"sourceCommit",
		input.profile.objectFormat,
	);
	if (input.plan.source.repositoryId !== input.profile.repositoryId) {
		throw new Error("Migration repository identity does not match Git store profile.");
	}
	if (input.plan.source.objectFormat !== input.profile.objectFormat) {
		throw new Error("Migration object format does not match Git store profile.");
	}
	const changeIds = new Set<string>();
	for (const target of input.activeManagedRefs) {
		const ref = managedRef(target.changeId);
		if (changeIds.has(ref)) throw new Error("Active managed Change refs must be unique.");
		changeIds.add(ref);
		assertGitOid(target.proposalCommit, "proposalCommit", input.profile.objectFormat);
	}
	const plannedChangeIds = input.receipt.activeChangePlans.map(({changeId}) => changeId);
	if (
		plannedChangeIds.length !== changeIds.size ||
		plannedChangeIds.some((changeId) => !changeIds.has(managedRef(changeId)))
	) {
		throw new Error("Resulting active managed refs do not match Receipt plans.");
	}
}

function assertConvertedTraceHeader(
	path: string,
	header: ReturnType<typeof parseChangeTrace>["header"],
	plan: KbToWikiMigrationPlan,
): void {
	if (path !== changeTracePath(header.changeId)) {
		throw new Error("Converted Trace path and header Change identity disagree.");
	}
	if (
		header.projectId !== plan.projectId ||
		header.repositoryId !== plan.source.repositoryId ||
		header.objectFormat !== plan.source.objectFormat
	) {
		throw new Error("Converted Trace header does not match migration source authority.");
	}
}

function recordTraceRetirements(
	trace: ReturnType<typeof parseChangeTrace>,
	retiredItemsByChange: Map<string, Set<string>>,
): void {
	for (const operation of trace.operations) {
		if (operation.kind !== "change.accepted") continue;
		const retiredItemIds = operation.payload.retiredItemIds;
		if (!Array.isArray(retiredItemIds) || retiredItemIds.some((itemId) => typeof itemId !== "string")) {
			throw new Error("Accepted migration Trace retirement payload is invalid.");
		}
		const existing = retiredItemsByChange.get(trace.header.changeId) ?? new Set<string>();
		for (const itemId of retiredItemIds) existing.add(itemId as string);
		retiredItemsByChange.set(trace.header.changeId, existing);
	}
}

function assertRetirementTraceBindings(
	plan: KbToWikiMigrationPlan,
	actual: ReadonlyMap<string, Set<string>>,
): void {
	const expected = new Map<string, Set<string>>();
	for (const retirement of plan.retirementMap) {
		const existing = expected.get(retirement.retiredByChangeId) ?? new Set<string>();
		existing.add(retirement.targetItemId);
		expected.set(retirement.retiredByChangeId, existing);
	}
	const normalized = (value: ReadonlyMap<string, Set<string>>) => [...value.entries()]
		.map(([changeId, itemIds]) => [changeId, [...itemIds].sort(compareText)] as const)
		.filter(([, itemIds]) => itemIds.length > 0)
		.sort(([left], [right]) => compareText(left, right));
	if (canonicalSemanticJson(normalized(actual)) !== canonicalSemanticJson(normalized(expected))) {
		throw new Error("Migration retirement map does not match converted terminal Trace evidence.");
	}
}

async function validateMigrationCommitEnvelope(
	input: KbToWikiMigrationCommitInput,
	runner: GitCommandRunner,
): Promise<{
	readonly targetEntries: readonly TreeEntry[];
	readonly configurationBlobOid: GitOid;
}> {
	await assertMigrationCandidateIdentity(input, runner);
	return validateMigrationTreeClosure(input, runner);
}

async function assertMigrationCandidateIdentity(
	input: KbToWikiMigrationCommitInput,
	runner: GitCommandRunner,
): Promise<void> {
	await assertRepositoryFormat(input.repoRoot, input.profile, runner);
	await assertObjectType(
		input.repoRoot,
		runner,
		input.plan.source.sourceCommit.hex,
		"commit",
	);
	await assertObjectType(input.repoRoot, runner, input.candidateCommit.hex, "commit");
	await assertRefEquals(
		input.repoRoot,
		runner,
		input.plan.source.backupRef,
		input.plan.source.sourceCommit.hex,
		"migration backup ref",
	);
	const parents = await commitParents(input.repoRoot, runner, input.candidateCommit.hex);
	if (parents.length !== 1 || parents[0] !== input.plan.source.sourceCommit.hex) {
		throw new Error("Migration candidate must have exactly the source commit as parent.");
	}
}

async function validateMigrationTreeClosure(
	input: KbToWikiMigrationCommitInput,
	runner: GitCommandRunner,
): Promise<{
	readonly targetEntries: readonly TreeEntry[];
	readonly configurationBlobOid: GitOid;
}> {
	const changedPaths = await listChangedPaths(
		input.repoRoot,
		runner,
		input.plan.source.sourceCommit.hex,
		input.candidateCommit.hex,
	);
	for (const path of changedPaths) {
		if (!isMigrationPath(path)) {
			throw new Error(`Migration candidate changed out-of-scope path ${path}.`);
		}
	}
	const sourceEntries = await listTree(
		input.repoRoot,
		runner,
		input.plan.source.sourceCommit.hex,
	);
	const targetEntries = await listTree(
		input.repoRoot,
		runner,
		input.candidateCommit.hex,
	);
	assertRootState(sourceEntries, targetEntries);
	const configurationBlobOid = await validateConfigurationClosure({
		input,
		runner,
		sourceEntries,
		targetEntries,
	});
	return {targetEntries, configurationBlobOid};
}

async function validateConfigurationClosure(input: {
	readonly input: KbToWikiMigrationCommitInput;
	readonly runner: GitCommandRunner;
	readonly sourceEntries: readonly TreeEntry[];
	readonly targetEntries: readonly TreeEntry[];
}): Promise<GitOid> {
	const path = input.input.receipt.configurationPlan.path;
	const sourceEntry = requiredTreeEntry(
		input.sourceEntries,
		path,
		"source configuration",
	);
	const targetEntry = requiredTreeEntry(
		input.targetEntries,
		path,
		"target configuration",
	);
	const [sourceBytes, targetBytes] = await Promise.all([
		readPath(
			input.input.repoRoot,
			input.runner,
			input.input.plan.source.sourceCommit.hex,
			path,
		),
		readPath(
			input.input.repoRoot,
			input.runner,
			input.input.candidateCommit.hex,
			path,
		),
	]);
	assertConfigurationMigration(input.input, {
		sourceEntry,
		sourceBytes,
		targetEntry,
		targetBytes,
	});
	return Object.freeze({
		algorithm: input.input.profile.objectFormat,
		hex: targetEntry.oid,
	});
}

function assertConfigurationMigration(
	input: KbToWikiMigrationCommitInput,
	actual: {
		readonly sourceEntry: TreeEntry;
		readonly sourceBytes: string;
		readonly targetEntry: TreeEntry;
		readonly targetBytes: string;
	},
): void {
	const plan = input.receipt.configurationPlan;
	assertConfigurationBlobIdentity(plan, actual);
	const source = parseConfiguration(actual.sourceBytes, "source");
	const target = parseConfiguration(actual.targetBytes, "target");
	if (
		canonicalJsonDigest(source) !== plan.sourceDigest ||
		canonicalJsonDigest(target) !== plan.targetDigest
	) {
		throw new Error("Migration configuration semantic digest does not match Receipt.");
	}
	if (canonicalJson(target.protocol) !== canonicalJson(plan.targetProtocol)) {
		throw new Error("Migration target configuration protocol does not match Receipt.");
	}
	if (Object.hasOwn(target, "domain")) {
		throw new Error("Migration target configuration retains legacy Domain selection.");
	}
}

function assertConfigurationBlobIdentity(
	plan: KbToWikiMigrationReceipt["configurationPlan"],
	actual: {
		readonly sourceEntry: TreeEntry;
		readonly targetEntry: TreeEntry;
	},
): void {
	if (
		actual.sourceEntry.type !== "blob" ||
		actual.targetEntry.type !== "blob" ||
		actual.sourceEntry.oid !== plan.sourceBlobOid.hex ||
		actual.targetEntry.oid !== plan.targetBlobOid.hex
	) {
		throw new Error("Migration configuration blob identity does not match Receipt.");
	}
}

interface MigrationConfigurationJson {
	readonly protocol?: Readonly<{readonly id: string; readonly version: string}>;
}

function parseConfiguration(
	bytes: string,
	label: string,
): MigrationConfigurationJson {
	try {
		return JSON.parse(bytes) as MigrationConfigurationJson;
	} catch {
		throw new Error(`Migration ${label} configuration must contain valid JSON.`);
	}
}

function requiredTreeEntry(
	entries: readonly TreeEntry[],
	path: string,
	label: string,
): TreeEntry {
	const entry = entries.find((candidate) => candidate.path === path);
	if (!entry) throw new Error(`Migration candidate is missing ${label}.`);
	return entry;
}

function assertReceiptCandidateBindings(
	receipt: KbToWikiMigrationReceipt,
	actual: {
		readonly wikiItemsTreeOid: GitOid | null;
		readonly itemBlobOids: Readonly<Record<string, GitOid>>;
		readonly convertedTraceBlobOids: Readonly<Record<string, GitOid>>;
		readonly migrationTracePreOperationBlobOid: GitOid;
	},
): void {
	if (
		canonicalSemanticJson(receipt.wikiItemsTreeOid) !==
			canonicalSemanticJson(actual.wikiItemsTreeOid) ||
		canonicalSemanticJson(receipt.itemBlobOids) !==
			canonicalSemanticJson(actual.itemBlobOids) ||
		canonicalSemanticJson(receipt.convertedTraceBlobOids) !==
			canonicalSemanticJson(actual.convertedTraceBlobOids) ||
		canonicalSemanticJson(receipt.migrationTracePreOperationBlobOid) !==
			canonicalSemanticJson(actual.migrationTracePreOperationBlobOid)
	) {
		throw new Error("Migration candidate Git objects do not match canonical Receipt bindings.");
	}
}

async function validateManagedTargets(
	input: KbToWikiMigrationCommitInput,
	runner: GitCommandRunner,
): Promise<void> {
	for (const target of input.activeManagedRefs) {
		const activePlan = input.receipt.activeChangePlans.find(
			(plan) => plan.changeId === target.changeId,
		);
		if (activePlan === undefined) {
			throw new Error("Resulting active proposal lacks a Receipt conversion plan.");
		}
		await assertObjectType(input.repoRoot, runner, target.proposalCommit.hex, "commit");
		const parents = await commitParents(input.repoRoot, runner, target.proposalCommit.hex);
		if (parents.length !== 1 || parents[0] !== input.candidateCommit.hex) {
			throw new Error("Migration-authored active proposal must directly parent the candidate commit.");
		}
		const path = changeTracePath(target.changeId);
		const changedPaths = (await listChangedPaths(
			input.repoRoot,
			runner,
			input.candidateCommit.hex,
			target.proposalCommit.hex,
		)).sort(compareText);
		const expectedChangedPaths = [
			path,
			...activePlan.proposedWiki.map(({path: wikiPath}) => wikiPath),
		].sort(compareText);
		if (canonicalSemanticJson(changedPaths) !== canonicalSemanticJson(expectedChangedPaths)) {
			throw new Error("Migration-authored active proposal changed paths outside its Receipt plan.");
		}
		const proposalEntries = await listTree(input.repoRoot, runner, target.proposalCommit.hex);
		for (const file of activePlan.proposedWiki) {
			const entry = proposalEntries.find(({path: entryPath}) => entryPath === file.path);
			if (file.bytes === null) {
				if (entry !== undefined) {
					throw new Error("Migration-authored active proposal retained a planned Wiki deletion.");
				}
				continue;
			}
			if (entry?.mode !== "100644" || entry.type !== "blob") {
				throw new Error("Migration-authored active proposal Wiki files must be ordinary blobs.");
			}
			const bytes = await readPath(input.repoRoot, runner, target.proposalCommit.hex, file.path);
			if (bytes !== file.bytes) {
				throw new Error("Migration-authored active proposal Wiki bytes do not match its Receipt plan.");
			}
		}
		const traceEntry = proposalEntries.find((entry) => entry.path === path);
		if (traceEntry?.mode !== "100644" || traceEntry.type !== "blob") {
			throw new Error("Migration-authored active proposal Trace must be an ordinary Git blob.");
		}
		const candidateBytes = await readPath(input.repoRoot, runner, input.candidateCommit.hex, path);
		const proposalBytes = await readPath(input.repoRoot, runner, target.proposalCommit.hex, path);
		if (!proposalBytes.startsWith(candidateBytes)) {
			throw new Error("Migration-authored active proposal must append exact converted Trace bytes.");
		}
		const candidateTrace = parseChangeTrace(candidateBytes);
		reduceChangeTrace(candidateTrace);
		const trace = parseChangeTrace(proposalBytes);
		if (trace.header.changeId !== target.changeId) {
			throw new Error("Managed proposal ref and Change Trace identity disagree.");
		}
		const state = reduceChangeTrace(trace);
		const proposals = trace.operations.filter(({kind}) => kind === "change.proposed");
		if (
			proposals.length !== 1 ||
			state.status !== "proposed" ||
			trace.operations.length !== candidateTrace.operations.length + 1 ||
			trace.operations.at(-1)?.kind !== "change.proposed"
		) {
			throw new Error("Migration-authored active proposal must contain one complete appended proposal.");
		}
		const expectedOperation = createKbToWikiActiveProposalOperation({
			plan: activePlan,
			migrationPlan: input.plan,
			candidateCommit: input.candidateCommit,
			traceHeader: trace.header,
		});
		if (
			canonicalSemanticJson(proposals[0]) !==
			canonicalSemanticJson(expectedOperation)
		) {
			throw new Error("Migration-authored active proposal semantics do not match its Receipt plan.");
		}
		await assertProposalCommitPlan(
			input.repoRoot,
			runner,
			target.proposalCommit.hex,
			input.candidateCommit.hex,
			activePlan,
		);
	}
}

function assertRootState(
	sourceEntries: readonly TreeEntry[],
	targetEntries: readonly TreeEntry[],
): void {
	if (sourceEntries.some(({path}) => isWikiRootPath(path))) {
		throw new Error("Migration source already contains target Wiki authority.");
	}
	if (targetEntries.some(({path}) => isLegacyRootPath(path))) {
		throw new Error("Migration candidate retains active legacy KB or Trace authority.");
	}
	if (targetEntries.some(({path}) =>
		(isWikiRootPath(path) && !isWikiItemPath(path)) ||
		(isChangeRootPath(path) && !isChangeTracePath(path)))) {
		throw new Error("Migration candidate contains an unknown target authority path.");
	}
	for (const entry of targetEntries) {
		if ((isWikiItemPath(entry.path) || isChangeTracePath(entry.path)) &&
			(entry.mode !== "100644" || entry.type !== "blob")) {
			throw new Error("Target Wiki Items and Change traces must be ordinary Git blobs.");
		}
	}
}

function assertPlannedWiki(
	plan: KbToWikiMigrationPlan,
	actual: readonly {readonly path: string; readonly bytes: string}[],
): void {
	const expected = [...plan.items]
		.map(({path, bytes}) => ({path, bytes}))
		.sort((left, right) => compareText(left.path, right.path));
	const sortedActual = [...actual].sort((left, right) => compareText(left.path, right.path));
	if (expected.length !== sortedActual.length) {
		throw new Error("Migration candidate Wiki tree does not match dry-run plan.");
	}
	for (let index = 0; index < expected.length; index += 1) {
		if (
			expected[index]?.path !== sortedActual[index]?.path ||
			expected[index]?.bytes !== sortedActual[index]?.bytes
		) {
			throw new Error("Migration candidate Wiki tree does not match dry-run plan.");
		}
	}
}

function assertMigrationApplied(
	input: KbToWikiMigrationCommitInput,
	operation: {readonly kind: string; readonly payload: Readonly<Record<string, unknown>>} | undefined,
): void {
	if (operation?.kind !== "migration.applied") {
		throw new Error("migration.applied must be final migration Trace operation.");
	}
	if (
		operation.payload.migrationId !== input.plan.migrationId ||
		operation.payload.migrationIntentDigest !== input.plan.migrationIntentDigest ||
		operation.payload.receiptDigest !== input.receipt.receiptDigest
	) {
		throw new Error("migration.applied does not bind exact migration intent and Receipt.");
	}
}

function objectOidMap(
	entries: readonly TreeEntry[],
	profile: GitStoreProfile,
): Record<string, GitOid> {
	const result: Record<string, GitOid> = Object.create(null);
	for (const entry of entries) {
		const oid = {algorithm: profile.objectFormat, hex: entry.oid};
		assertGitOid(oid, `blob OID for ${entry.path}`, profile.objectFormat);
		result[entry.path] = Object.freeze(oid);
	}
	return result;
}

async function existingBlobOid(
	repoRoot: string,
	runner: GitCommandRunner,
	bytes: string,
	profile: GitStoreProfile,
): Promise<GitOid> {
	const result = await runGit(
		repoRoot,
		runner,
		["hash-object", "--stdin"],
		"utf8",
		bytes,
	);
	if (result.exitCode !== 0) {
		throw new Error(`Cannot derive migration predecessor blob: ${result.stderr.trim()}`);
	}
	const oid = {algorithm: profile.objectFormat, hex: result.stdout.trim()};
	assertGitOid(oid, "migration predecessor blob OID", profile.objectFormat);
	await assertObjectType(repoRoot, runner, oid.hex, "blob");
	return Object.freeze(oid);
}

async function pathOidOrNull(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
	path: string,
	profile: GitStoreProfile,
	expectedType: "tree" | "blob",
): Promise<GitOid | null> {
	const result = await runGit(repoRoot, runner, ["rev-parse", `${commit}:${path}`]);
	if (result.exitCode !== 0) return null;
	const oid = {algorithm: profile.objectFormat, hex: result.stdout.trim()};
	assertGitOid(oid, `${path} OID`, profile.objectFormat);
	await assertObjectType(repoRoot, runner, oid.hex, expectedType);
	return Object.freeze(oid);
}

async function listTree(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
): Promise<TreeEntry[]> {
	const result = await runGit(
		repoRoot,
		runner,
		["ls-tree", "-r", "-z", "--full-tree", commit],
		"base64",
	);
	if (result.exitCode !== 0) throw new Error(`Cannot read migration tree: ${result.stderr.trim()}`);
	let listing: string;
	try {
		listing = new TextDecoder("utf-8", {fatal: true}).decode(
			Buffer.from(result.stdout, "base64"),
		);
	} catch {
		throw new Error("Migration tree contains a non-UTF-8 path.");
	}
	return listing.split("\0").flatMap((record) => {
		if (record === "") return [];
		const match = /^([0-7]{6}) ([a-z]+) ([0-9a-f]+)\t(.+)$/u.exec(record);
		if (match === null) throw new Error("Git returned malformed migration tree entry.");
		const [, mode, type, oid, path] = match;
		if (mode === undefined || type === undefined || oid === undefined || path === undefined) {
			throw new Error("Git returned incomplete migration tree entry.");
		}
		return [{mode, type, oid, path}];
	});
}

async function listChangedPaths(
	repoRoot: string,
	runner: GitCommandRunner,
	parent: string,
	commit: string,
): Promise<string[]> {
	const result = await runGit(
		repoRoot,
		runner,
		["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", parent, commit],
		"base64",
	);
	if (result.exitCode !== 0) throw new Error(`Cannot inspect migration diff: ${result.stderr.trim()}`);
	let paths: string;
	try {
		paths = new TextDecoder("utf-8", {fatal: true}).decode(Buffer.from(result.stdout, "base64"));
	} catch {
		throw new Error("Migration diff contains a non-UTF-8 path.");
	}
	return paths.split("\0").filter(Boolean);
}

async function readPath(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
	path: string,
): Promise<string> {
	const result = await runGit(repoRoot, runner, ["show", `${commit}:${path}`], "base64");
	if (result.exitCode !== 0) throw new Error(`Cannot read migration path ${path}: ${result.stderr.trim()}`);
	try {
		return new TextDecoder("utf-8", {fatal: true}).decode(Buffer.from(result.stdout, "base64"));
	} catch {
		throw new Error(`Migration path ${path} is not valid UTF-8.`);
	}
}

async function commitParents(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
): Promise<string[]> {
	const result = await git(repoRoot, runner, ["show", "-s", "--format=%P", commit]);
	return result.trim() === "" ? [] : result.trim().split(/\s+/u);
}

async function assertRepositoryFormat(
	repoRoot: string,
	profile: GitStoreProfile,
	runner: GitCommandRunner,
): Promise<void> {
	const actual = (await git(repoRoot, runner, ["rev-parse", "--show-object-format"])).trim();
	if (actual !== profile.objectFormat) throw new Error("Repository object format drifted from profile.");
}

async function assertObjectType(
	repoRoot: string,
	runner: GitCommandRunner,
	oid: string,
	expected: string,
): Promise<void> {
	const actual = (await git(repoRoot, runner, ["cat-file", "-t", oid])).trim();
	if (actual !== expected) throw new Error(`Git object ${oid} must be ${expected}, received ${actual}.`);
}

async function assertRefEquals(
	repoRoot: string,
	runner: GitCommandRunner,
	ref: string,
	expected: string,
	field: string,
): Promise<void> {
	const actual = await readRef(repoRoot, runner, ref);
	if (actual !== expected) throw new Error(`${field} does not equal expected commit.`);
}

async function assertRefAbsent(
	repoRoot: string,
	runner: GitCommandRunner,
	ref: string,
): Promise<void> {
	if (await readRef(repoRoot, runner, ref) !== null) {
		throw new Error(`Managed ref ${ref} already exists.`);
	}
}

async function readRef(
	repoRoot: string,
	runner: GitCommandRunner,
	ref: string,
): Promise<string | null> {
	const result = await runGit(
		repoRoot,
		runner,
		["for-each-ref", "--format=%(objectname)", "--count=1", ref],
	);
	if (result.exitCode !== 0) {
		throw new Error(`Cannot inspect Git ref ${ref}: ${result.stderr.trim()}`);
	}
	const oid = result.stdout.trim();
	return oid === "" ? null : oid;
}

function managedRef(changeId: string): string {
	if (!/^CHG-[A-Za-z0-9._-]+$/u.test(changeId)) {
		throw new Error("Managed migration Change ID must be path-safe.");
	}
	return `refs/codewiki/changes/${changeId}`;
}

function isMigrationPath(path: string): boolean {
	return path === ".codewiki/config.json" ||
		isLegacyRootPath(path) ||
		isWikiItemPath(path) ||
		isChangeTracePath(path);
}

function isLegacyRootPath(path: string): boolean {
	return path === ".codewiki/kb" || path.startsWith(".codewiki/kb/") ||
		path === ".codewiki/traces" || path.startsWith(".codewiki/traces/");
}

function isWikiRootPath(path: string): boolean {
	return path === ".codewiki/wiki" || path.startsWith(".codewiki/wiki/");
}

function isChangeRootPath(path: string): boolean {
	return path === ".codewiki/changes" || path.startsWith(".codewiki/changes/");
}

function isWikiItemPath(path: string): boolean {
	return path.startsWith(".codewiki/wiki/items/");
}

function isChangeTracePath(path: string): boolean {
	return /^\.codewiki\/changes\/TRACE-CHG-[A-Za-z0-9._-]+\.jsonl$/u.test(path);
}

async function assertProposalCommitPlan(
	repoRoot: string,
	runner: GitCommandRunner,
	proposalCommit: string,
	candidateCommit: string,
	plan: MigrationActiveChangePlan,
): Promise<void> {
	const raw = await git(repoRoot, runner, ["cat-file", "commit", proposalCommit]);
	const separator = raw.indexOf("\n\n");
	if (separator < 0) throw new Error("Migration proposal commit object is malformed.");
	const headers = raw.slice(0, separator).split("\n");
	if (
		headers.length !== 4 ||
		!/^tree [0-9a-f]+$/u.test(headers[0] ?? "") ||
		headers[1] !== `parent ${candidateCommit}` ||
		headers[2] !== `author ${plan.commit.author}` ||
		headers[3] !== `committer ${plan.commit.committer}` ||
		raw.slice(separator + 2) !== plan.commit.message
	) {
		throw new Error("Migration-authored proposal commit inputs do not match its Receipt plan.");
	}
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

async function git(
	repoRoot: string,
	runner: GitCommandRunner,
	args: readonly string[],
): Promise<string> {
	const result = await runGit(repoRoot, runner, args);
	if (result.exitCode !== 0) throw new Error(`Git command failed: ${result.stderr.trim()}`);
	return result.stdout;
}

function runGit(
	repoRoot: string,
	runner: GitCommandRunner,
	args: readonly string[],
	stdoutEncoding: "utf8" | "base64" = "utf8",
	input?: string,
): Promise<GitCommandResult> {
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
