import {
	createGitCommandRunner,
	type GitCommandResult,
	type GitCommandRunner,
} from "../../changes/trace/git-command.ts";
import {parseTraceText} from "../../changes/trace/reader.ts";
import {replayTrace} from "../../changes/trace/replay.ts";
import {
	buildTraceHydrationPlan,
	buildTraceRetentionStub,
	type TraceRetentionStub,
} from "../../changes/trace/retention.ts";
import {isTraceId} from "../../changes/trace/schema.ts";
import type {TraceRecord} from "../../changes/trace/types.ts";
import {
	createKnowledgeCheckpoint,
	DEFAULT_KNOWLEDGE_COMPILER,
	type KnowledgeCheckpoint,
	type KnowledgeProjectionFile,
} from "../../knowledge/state.ts";
import {
	assertCanonicalRef,
	assertGitOid,
	type GitOid,
} from "../../project/git-store-profile.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	sha256Digest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {buildWorkState} from "../../work-state/projector.ts";
import type {WorkState} from "../../work-state/types.ts";
import {readBackendStateManifest} from "./state.ts";
import {
	assertKbToWikiMigrationReadiness,
	type KbToWikiMigrationReadiness,
	type KbToWikiMigrationReadinessInput,
} from "./kb-to-wiki-readiness.ts";

export const KB_TO_WIKI_LEGACY_SOURCE_SNAPSHOT_PROTOCOL = Object.freeze({
	id: "codewiki.kb-to-wiki-legacy-source-snapshot",
	version: "1.0.0",
} as const);

interface GitTreeEntry {
	readonly mode: string;
	readonly type: string;
	readonly oid: string;
	readonly path: string;
}

export interface KbToWikiLegacyKnowledgeFile {
	readonly path: string;
	readonly mode: string;
	readonly blobOid: GitOid;
	readonly byteDigest: Sha256Digest;
}

export interface KbToWikiLegacyTraceSnapshot {
	readonly path: string;
	readonly canonicalBlobOid: GitOid;
	readonly canonicalByteDigest: Sha256Digest;
	readonly canonicalBytes: string;
	readonly restoreRef: string | null;
	readonly restoreCommit: GitOid | null;
	readonly restoreBlobOid: GitOid | null;
	readonly restoredByteDigest: Sha256Digest | null;
	readonly restoredBytes: string | null;
	readonly retentionStub: TraceRetentionStub | null;
	readonly records: readonly TraceRecord[];
	readonly recordsDigest: Sha256Digest;
}

export interface KbToWikiLegacySourceSnapshot {
	readonly protocol: typeof KB_TO_WIKI_LEGACY_SOURCE_SNAPSHOT_PROTOCOL;
	readonly readiness: KbToWikiMigrationReadiness;
	readonly knowledgeCheckpoint: KnowledgeCheckpoint;
	readonly knowledgeFiles: readonly KbToWikiLegacyKnowledgeFile[];
	readonly traces: readonly KbToWikiLegacyTraceSnapshot[];
	readonly sourceTraceHeadDigest: Sha256Digest;
	readonly workState: WorkState;
	readonly activeChangeIds: readonly string[];
	readonly quiescenceReceiptDigest: Sha256Digest;
	readonly snapshotDigest: Sha256Digest;
}

export type BuildKbToWikiLegacySourceSnapshotInput = KbToWikiMigrationReadinessInput;

/**
 * Compile the exact stopped Backend-v1 KB and Trace closure from one canonical commit.
 * This operation reads Git and private state but creates no objects, refs, files, or backups.
 */
export async function buildKbToWikiLegacySourceSnapshot(
	input: BuildKbToWikiLegacySourceSnapshotInput,
): Promise<KbToWikiLegacySourceSnapshot> {
	const initialReadiness = await assertKbToWikiMigrationReadiness(input);
	const runner = input.runner ?? createGitCommandRunner();
	await assertBackendStateBinding(input, initialReadiness);
	const entries = await listSourceTree(input.repoRoot, runner, initialReadiness.sourceCommit);
	const {checkpoint, files} = await compileKnowledgeSnapshot(
		input.repoRoot,
		runner,
		initialReadiness,
		entries,
	);
	const traces = await compileTraceSnapshots(
		input.repoRoot,
		runner,
		initialReadiness,
		entries,
	);
	const records = completeTraceRecords(traces);
	const workState = canonicalWorkState(buildWorkState({records}));
	assertCompleteChangeReduction(traces, workState);
	const activeChangeIds = workState.changes.flatMap((change) =>
		change.approval.status === "approved" && change.nextAction !== undefined
			? [change.id]
			: [],
	);
	const sourceTraceHeadDigest = traceHeadDigest(traces);
	const finalReadiness = await assertKbToWikiMigrationReadiness({...input, runner});
	if (canonicalJson(initialReadiness) !== canonicalJson(finalReadiness)) {
		throw new Error("KB-to-Wiki source changed while its legacy snapshot was compiled.");
	}
	const quiescenceReceiptDigest = canonicalJsonDigest({
		operation: "kb-to-wiki-source-snapshot",
		readiness: finalReadiness,
	});
	const body = {
		protocol: KB_TO_WIKI_LEGACY_SOURCE_SNAPSHOT_PROTOCOL,
		readiness: finalReadiness,
		knowledgeCheckpoint: checkpoint,
		knowledgeFiles: files,
		traces,
		sourceTraceHeadDigest,
		workState,
		activeChangeIds,
		quiescenceReceiptDigest,
	};
	// SAFETY: canonicalization preserves this exact validated body while recursively freezing JSON values.
	return toCanonicalJsonValue({
		...body,
		snapshotDigest: canonicalJsonDigest(body),
	}) as unknown as KbToWikiLegacySourceSnapshot;
}

async function assertBackendStateBinding(
	input: BuildKbToWikiLegacySourceSnapshotInput,
	readiness: KbToWikiMigrationReadiness,
): Promise<void> {
	const state = await readBackendStateManifest({
		repoRoot: input.repoRoot,
		stateRoot: input.stateRoot,
	});
	if (!state) throw new Error("KB-to-Wiki source snapshot requires bootstrapped Backend state.");
	if (
		state.repositoryIdentity !== readiness.repositoryIdentity ||
		state.generation !== readiness.stateGeneration ||
		state.stateDigest !== readiness.stateDigest ||
		state.activeBuild.backendBuildDigest !== readiness.backendBuildDigest
	) {
		throw new Error("Backend state changed after KB-to-Wiki migration readiness.");
	}
	if (
		!state.activeBuild.domainPlugins.some(
			(plugin) => plugin.identityDigest === DEFAULT_KNOWLEDGE_COMPILER.domainPlugin.identityDigest,
		)
	) {
		throw new Error("Source Backend Build does not bind the active Knowledge compiler Domain Plugin.");
	}
}

async function compileKnowledgeSnapshot(
	repoRoot: string,
	runner: GitCommandRunner,
	readiness: KbToWikiMigrationReadiness,
	entries: readonly GitTreeEntry[],
): Promise<{
	readonly checkpoint: KnowledgeCheckpoint;
	readonly files: readonly KbToWikiLegacyKnowledgeFile[];
}> {
	const knowledgeEntries = entries.filter(({path}) => path.startsWith(".codewiki/kb/"));
	if (knowledgeEntries.length === 0) {
		throw new Error("KB-to-Wiki source snapshot requires a non-empty legacy KB tree.");
	}
	if (knowledgeEntries.length > 100_000) {
		throw new Error("KB-to-Wiki source Knowledge file limit exceeded.");
	}
	const loaded = await Promise.all(
		knowledgeEntries.map(async (entry) => {
			assertRegularBlob(entry, "Knowledge");
			const path = entry.path.slice(".codewiki/kb/".length);
			const mediaType = knowledgeMediaType(path);
			const bytes = await readBlobUtf8(repoRoot, runner, entry.oid, entry.path);
			return {
				projection: {path, mediaType, bytes},
				file: {
					path,
					mode: entry.mode,
					blobOid: gitOid(readiness, entry.oid, "Knowledge blob"),
					byteDigest: sha256Digest(bytes),
				},
			};
		}),
	);
	return {
		checkpoint: createKnowledgeCheckpoint({
			files: loaded.map(({projection}) => projection),
			compiler: DEFAULT_KNOWLEDGE_COMPILER,
		}),
		files: loaded.map(({file}) => file),
	};
}

async function compileTraceSnapshots(
	repoRoot: string,
	runner: GitCommandRunner,
	readiness: KbToWikiMigrationReadiness,
	entries: readonly GitTreeEntry[],
): Promise<readonly KbToWikiLegacyTraceSnapshot[]> {
	const traceEntries = entries.filter(({path}) => path.startsWith(".codewiki/traces/"));
	if (traceEntries.length > 100_000) {
		throw new Error("KB-to-Wiki source Trace file limit exceeded.");
	}
	return Promise.all(
		traceEntries.map((entry) => compileTraceSnapshot(repoRoot, runner, readiness, entry)),
	);
}

async function compileTraceSnapshot(
	repoRoot: string,
	runner: GitCommandRunner,
	readiness: KbToWikiMigrationReadiness,
	entry: GitTreeEntry,
): Promise<KbToWikiLegacyTraceSnapshot> {
	assertRegularBlob(entry, "Trace");
	const name = entry.path.slice(".codewiki/traces/".length);
	if (name.includes("/") || !name.endsWith(".jsonl")) {
		throw new Error(`Legacy Trace tree contains unsupported path ${entry.path}.`);
	}
	const traceId = name.slice(0, -".jsonl".length);
	if (!isTraceId(traceId)) throw new Error(`Legacy Trace path has invalid identity ${entry.path}.`);
	const canonicalBytes = await readBlobUtf8(repoRoot, runner, entry.oid, entry.path);
	const canonicalRecords = parseTraceText(canonicalBytes);
	const canonicalState = replayTrace(canonicalRecords);
	if (canonicalState.head.traceId !== traceId) {
		throw new Error(`Legacy Trace path ${entry.path} does not match its Trace identity.`);
	}
	const stub = archiveRetentionStub(canonicalRecords);
	const hydration = stub
		? await hydrateArchivedTrace({
				repoRoot,
				runner,
				readiness,
				path: entry.path,
				stub,
			})
		: null;
	const records = hydration?.records ?? canonicalRecords;
	replayTrace([...records]);
	return {
		path: entry.path,
		canonicalBlobOid: gitOid(readiness, entry.oid, "Trace blob"),
		canonicalByteDigest: sha256Digest(canonicalBytes),
		canonicalBytes,
		restoreRef: stub?.gitRestoreRef ?? null,
		restoreCommit: hydration?.restoreCommit ?? null,
		restoreBlobOid: hydration?.restoreBlobOid ?? null,
		restoredByteDigest: hydration?.restoredByteDigest ?? null,
		restoredBytes: hydration?.restoredBytes ?? null,
		retentionStub: stub,
		records,
		recordsDigest: canonicalJsonDigest(records),
	};
}

function archiveRetentionStub(records: readonly TraceRecord[]): TraceRetentionStub | null {
	const checkpoint = records[1];
	const close = records[2];
	if (
		records.length !== 3 ||
		checkpoint?.type !== "tail_checkpoint" ||
		close?.type !== "trace_close" ||
		checkpoint.parentId !== null ||
		checkpoint.firstKeptRecordId !== close.id ||
		close.parentId !== checkpoint.id
	) {
		return null;
	}
	assertCanonicalRef(close.gitRestoreRef);
	return buildTraceRetentionStub({
		records: [...records],
		gitRestoreRef: close.gitRestoreRef,
		headRef: close.headRef,
	});
}

async function hydrateArchivedTrace(input: {
	readonly repoRoot: string;
	readonly runner: GitCommandRunner;
	readonly readiness: KbToWikiMigrationReadiness;
	readonly path: string;
	readonly stub: TraceRetentionStub;
}): Promise<{
	readonly restoreCommit: GitOid;
	readonly restoreBlobOid: GitOid;
	readonly restoredByteDigest: Sha256Digest;
	readonly restoredBytes: string;
	readonly records: readonly TraceRecord[];
}> {
	const restoreCommit = await resolveCommit(
		input.repoRoot,
		input.runner,
		input.readiness,
		input.stub.gitRestoreRef,
	);
	const entry = await readExactTreeEntry(
		input.repoRoot,
		input.runner,
		restoreCommit.hex,
		input.path,
	);
	assertRegularBlob(entry, "restored Trace");
	const restoredBytes = await readBlobUtf8(
		input.repoRoot,
		input.runner,
		entry.oid,
		input.path,
	);
	const archivedRecords = parseTraceText(restoredBytes);
	const hydration = buildTraceHydrationPlan({stub: input.stub, archivedRecords});
	return {
		restoreCommit,
		restoreBlobOid: gitOid(input.readiness, entry.oid, "restored Trace blob"),
		restoredByteDigest: sha256Digest(restoredBytes),
		restoredBytes,
		records: hydration.records,
	};
}

function assertCompleteChangeReduction(
	traces: readonly KbToWikiLegacyTraceSnapshot[],
	workState: WorkState,
): void {
	const expected = traces
		.flatMap((trace) => {
			const changeId = replayTrace([...trace.records]).head.changeId;
			return changeId ? [changeId] : [];
		})
		.sort(compareText);
	if (canonicalJson(expected) !== canonicalJson(workState.changeIds)) {
		throw new Error("Legacy Change Traces did not produce a complete WorkState reduction.");
	}
}

function canonicalWorkState(workState: WorkState): WorkState {
	let serialized: string | undefined;
	try {
		serialized = JSON.stringify(workState);
	} catch (error) {
		throw new Error("Reduced legacy WorkState cannot be serialized.", {cause: error});
	}
	if (!serialized) throw new Error("Reduced legacy WorkState serialization is empty.");
	let parsed: unknown;
	try {
		parsed = JSON.parse(serialized);
	} catch (error) {
		throw new Error("Reduced legacy WorkState cannot be decoded.", {cause: error});
	}
	// SAFETY: WorkState is locally reduced; serialization only omits its declared optional undefined fields.
	return toCanonicalJsonValue(parsed) as unknown as WorkState;
}

function completeTraceRecords(
	traces: readonly KbToWikiLegacyTraceSnapshot[],
): TraceRecord[] {
	const recordIds = new Set<string>();
	const changeIds = new Set<string>();
	const records: TraceRecord[] = [];
	for (const trace of traces) {
		const state = replayTrace([...trace.records]);
		const changeId = state.head.changeId;
		if (changeId && changeIds.has(changeId)) {
			throw new Error(`Legacy Trace source contains duplicate Change identity ${changeId}.`);
		}
		if (changeId) changeIds.add(changeId);
		for (const record of trace.records) {
			const recordId = record.type === "trace_head" ? record.traceId : record.id;
			if (recordIds.has(recordId)) {
				throw new Error(`Legacy Trace source contains duplicate record identity ${recordId}.`);
			}
			recordIds.add(recordId);
			records.push(record);
		}
	}
	return records;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function traceHeadDigest(
	traces: readonly KbToWikiLegacyTraceSnapshot[],
): Sha256Digest {
	return canonicalJsonDigest(
		traces.map((trace) => ({
			path: trace.path,
			canonicalBlobOid: trace.canonicalBlobOid,
			canonicalByteDigest: trace.canonicalByteDigest,
			restoreRef: trace.restoreRef,
			restoreCommit: trace.restoreCommit,
			restoreBlobOid: trace.restoreBlobOid,
			restoredByteDigest: trace.restoredByteDigest,
			recordsDigest: trace.recordsDigest,
		})),
	);
}

async function listSourceTree(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: GitOid,
): Promise<readonly GitTreeEntry[]> {
	const result = await git(repoRoot, runner, [
		"ls-tree",
		"-r",
		"-z",
		"--full-tree",
		commit.hex,
		"--",
		".codewiki/kb",
		".codewiki/traces",
	], "base64");
	if (result.exitCode !== 0) {
		throw new Error(`Cannot read legacy source tree: ${result.stderr.trim()}`);
	}
	return parseTreeListing(result.stdout, "legacy source");
}

async function readExactTreeEntry(
	repoRoot: string,
	runner: GitCommandRunner,
	commit: string,
	path: string,
): Promise<GitTreeEntry> {
	const result = await git(
		repoRoot,
		runner,
		["ls-tree", "-z", "--full-tree", commit, "--", path],
		"base64",
	);
	if (result.exitCode !== 0) {
		throw new Error(`Cannot inspect restored Trace ${path}: ${result.stderr.trim()}`);
	}
	const entries = parseTreeListing(result.stdout, "restored Trace");
	if (entries.length !== 1 || entries[0]?.path !== path) {
		throw new Error(`Restore commit does not contain exact Trace path ${path}.`);
	}
	return entries[0];
}

function parseTreeListing(encoded: string, label: string): readonly GitTreeEntry[] {
	let listing: string;
	try {
		listing = new TextDecoder("utf-8", {fatal: true}).decode(Buffer.from(encoded, "base64"));
	} catch {
		throw new Error(`Git ${label} tree contains a non-UTF-8 path.`);
	}
	return listing.split("\0").flatMap((record) => {
		if (record === "") return [];
		const match = /^([0-7]{6}) ([a-z]+) ([0-9a-f]+)\t(.+)$/u.exec(record);
		if (!match) throw new Error(`Git returned malformed ${label} tree entry.`);
		const [, mode, type, oid, path] = match;
		if (!mode || !type || !oid || !path) {
			throw new Error(`Git returned incomplete ${label} tree entry.`);
		}
		return [{mode, type, oid, path}];
	});
}

async function resolveCommit(
	repoRoot: string,
	runner: GitCommandRunner,
	readiness: KbToWikiMigrationReadiness,
	ref: string,
): Promise<GitOid> {
	assertCanonicalRef(ref);
	const result = await git(repoRoot, runner, ["rev-parse", "--verify", `${ref}^{commit}`]);
	if (result.exitCode !== 0) {
		throw new Error(`Cannot resolve legacy Trace restore ref ${ref}: ${result.stderr.trim()}`);
	}
	return gitOid(readiness, result.stdout.trim(), "Trace restore commit");
}

async function readBlobUtf8(
	repoRoot: string,
	runner: GitCommandRunner,
	oid: string,
	path: string,
): Promise<string> {
	const result = await git(repoRoot, runner, ["cat-file", "blob", oid], "base64");
	if (result.exitCode !== 0) throw new Error(`Cannot read legacy source path ${path}.`);
	try {
		return new TextDecoder("utf-8", {fatal: true}).decode(Buffer.from(result.stdout, "base64"));
	} catch {
		throw new Error(`Legacy source path ${path} is not valid UTF-8.`);
	}
}

function assertRegularBlob(entry: GitTreeEntry, label: string): void {
	if (entry.type !== "blob" || (entry.mode !== "100644" && entry.mode !== "100755")) {
		throw new Error(`${label} path ${entry.path} must be a regular Git blob.`);
	}
}

function knowledgeMediaType(path: string): KnowledgeProjectionFile["mediaType"] {
	if (path.endsWith(".md")) return "text/markdown";
	if (path.endsWith(".yaml")) return "application/yaml";
	if (path.endsWith(".json")) return "application/json";
	throw new Error(`Canonical Knowledge contains unsupported file ${path}.`);
}

function gitOid(
	readiness: KbToWikiMigrationReadiness,
	hex: string,
	field: string,
): GitOid {
	const oid = {algorithm: readiness.profile.objectFormat, hex};
	assertGitOid(oid, field, readiness.profile.objectFormat);
	return oid;
}

function git(
	repoRoot: string,
	runner: GitCommandRunner,
	args: readonly string[],
	stdoutEncoding: "utf8" | "base64" = "utf8",
): Promise<GitCommandResult> {
	return runner({
		repoRoot,
		args: ["--no-pager", ...args],
		stdoutEncoding,
		environment: GIT_ENVIRONMENT,
	});
}

const GIT_ENVIRONMENT = Object.freeze({
	GIT_ATTR_NOSYSTEM: "1",
	GIT_CONFIG_GLOBAL: "/dev/null",
	GIT_CONFIG_NOSYSTEM: "1",
	GIT_NO_REPLACE_OBJECTS: "1",
	GIT_OPTIONAL_LOCKS: "0",
	GIT_TERMINAL_PROMPT: "0",
});
