import {rm} from "node:fs/promises";
import {join} from "node:path";

import {
	createRunRawLogReference,
	type RunRawLogReference,
} from "../contracts.ts";
import {
	appendExecutionLedgerEntry,
	assertExecutionLedger,
	createExecutionLedger,
	type ExecutionLedger,
	type ExecutionLedgerEntryInput,
	type ExecutionLedgerHeader,
} from "./execution-ledger.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	sha256Digest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	normalizeRuntimeStateRoot,
	parseStoredJson,
	readRegularFileIfPresent,
	regularFileNames,
	withFileLock,
	writeFileAtomic,
} from "../persistence/files.ts";

const STORE_DIRECTORY = "runtime-evidence-v1";
const RAW_LOG_APPEND_SCHEMA_VERSION = "1.0.0" as const;

export interface StoredRawLogAppend {
	readonly reference: RunRawLogReference;
	readonly nextOffset: number;
	readonly complete: boolean;
}

interface RawLogAppendRecord {
	readonly schemaVersion: typeof RAW_LOG_APPEND_SCHEMA_VERSION;
	readonly reference: RunRawLogReference;
	readonly contentBase64: string;
}

export interface RuntimeEvidenceStoreOptions {
	readonly stateRoot: string;
}

export async function openStoredExecutionLedger(input: {
	readonly stateRoot: string;
	readonly header: ExecutionLedgerHeader;
}): Promise<Readonly<ExecutionLedger>> {
	const root = evidenceRoot(input.stateRoot);
	const key = ledgerKey(input.header.runId, input.header.requestDigest);
	return withFileLock(lockPath(root, `ledger-${key}`), async () => {
		const path = ledgerPath(root, key);
		const existing = await readLedgerFile(path);
		if (existing) {
			if (existing.header.headerDigest !== input.header.headerDigest) {
				throw new Error("Stored Execution Ledger header does not match the Run.");
			}
			return existing;
		}
		const ledger = createExecutionLedger(input.header);
		await persistLedger(root, path, ledger);
		return ledger;
	});
}

export async function appendStoredExecutionLedger(input: {
	readonly stateRoot: string;
	readonly runId: string;
	readonly requestDigest: Sha256Digest;
	readonly expectedLedgerDigest: Sha256Digest;
	readonly entry: ExecutionLedgerEntryInput;
}): Promise<Readonly<ExecutionLedger>> {
	const root = evidenceRoot(input.stateRoot);
	const key = ledgerKey(input.runId, input.requestDigest);
	return withFileLock(lockPath(root, `ledger-${key}`), async () => {
		const path = ledgerPath(root, key);
		const ledger = await requiredLedger(path);
		assertLedgerIdentity(ledger, input.runId, input.requestDigest);
		if (ledger.ledgerDigest !== input.expectedLedgerDigest) {
			throw new Error("Execution Ledger expected-head compare-and-swap failed.");
		}
		const next = appendExecutionLedgerEntry(ledger, input.entry);
		await persistLedger(root, path, next);
		return next;
	});
}

export async function readStoredExecutionLedger(input: {
	readonly stateRoot: string;
	readonly runId: string;
	readonly requestDigest: Sha256Digest;
}): Promise<Readonly<ExecutionLedger> | null> {
	const root = evidenceRoot(input.stateRoot);
	const ledger = await readLedgerFile(
		ledgerPath(root, ledgerKey(input.runId, input.requestDigest)),
	);
	if (ledger) assertLedgerIdentity(ledger, input.runId, input.requestDigest);
	return ledger;
}

export async function readStoredExecutionLedgerVersion(input: {
	readonly stateRoot: string;
	readonly runId: string;
	readonly requestDigest: Sha256Digest;
	readonly ledgerDigest: Sha256Digest;
}): Promise<Readonly<ExecutionLedger> | null> {
	const ledger = await readLedgerFile(
		ledgerVersionPath(evidenceRoot(input.stateRoot), input.ledgerDigest),
	);
	if (!ledger) return null;
	assertLedgerIdentity(ledger, input.runId, input.requestDigest);
	if (ledger.ledgerDigest !== input.ledgerDigest) {
		throw new Error("Stored Execution Ledger version digest is invalid.");
	}
	return ledger;
}

export async function recoverStoredExecutionLedgers(
	options: RuntimeEvidenceStoreOptions,
): Promise<readonly Readonly<ExecutionLedger>[]> {
	const root = evidenceRoot(options.stateRoot);
	const directory = join(root, "ledgers");
	const names = await regularFileNames(directory);
	const ledgers: Readonly<ExecutionLedger>[] = [];
	for (const name of names) {
		if (!/^[0-9a-f]{64}\.json$/.test(name)) continue;
		const ledger = await requiredLedger(join(directory, name));
		const expectedName = `${ledgerKey(
			ledger.header.runId,
			ledger.header.requestDigest,
		)}.json`;
		if (name !== expectedName) {
			throw new Error("Stored Execution Ledger path does not match its identity.");
		}
		ledgers.push(ledger);
	}
	ledgers.sort((left, right) => compareText(
		`${left.header.runId}\0${left.header.requestDigest}`,
		`${right.header.runId}\0${right.header.requestDigest}`,
	));
	return Object.freeze(ledgers);
}

export async function appendStoredRunRawLogChunk(input: {
	readonly stateRoot: string;
	readonly reference: RunRawLogReference;
	readonly offset: number;
	readonly content: Uint8Array;
}): Promise<Readonly<StoredRawLogAppend>> {
	const reference = createRunRawLogReference(input.reference);
	const chunk = Buffer.from(input.content);
	if (!Number.isInteger(input.offset) || input.offset < 0 || chunk.byteLength === 0) {
		throw new Error("Run raw-log append range is invalid.");
	}
	const root = evidenceRoot(input.stateRoot);
	const key = reference.digest.slice("sha256:".length);
	return withFileLock(
		lockPath(root, `raw-${key}`),
		() => appendRunRawLogChunkLocked(root, reference, input.offset, chunk),
	);
}

async function appendRunRawLogChunkLocked(
	root: string,
	reference: RunRawLogReference,
	offset: number,
	chunk: Buffer,
): Promise<Readonly<StoredRawLogAppend>> {
	const finalPath = rawLogPath(root, reference.digest);
	const stagingPath = rawLogAppendPath(root, reference.digest);
	const completed = await readCompletedRawLogAppend({
		finalPath,
		stagingPath,
		reference,
		offset,
		chunk,
	});
	if (completed) return completed;
	return appendIncompleteRawLogChunk({
		finalPath,
		stagingPath,
		reference,
		offset,
		chunk,
	});
}

async function readCompletedRawLogAppend(input: {
	readonly finalPath: string;
	readonly stagingPath: string;
	readonly reference: RunRawLogReference;
	readonly offset: number;
	readonly chunk: Buffer;
}): Promise<Readonly<StoredRawLogAppend> | null> {
	const retained = await readRegularFileIfPresent(input.finalPath);
	if (!retained) return null;
	assertRawLogBytes(input.reference, retained);
	assertExistingRawLogChunk(retained, input.offset, input.chunk);
	await rm(input.stagingPath, {force: true});
	return rawLogAppendResult(input.reference, retained.byteLength, true);
}

async function appendIncompleteRawLogChunk(input: {
	readonly finalPath: string;
	readonly stagingPath: string;
	readonly reference: RunRawLogReference;
	readonly offset: number;
	readonly chunk: Buffer;
}): Promise<Readonly<StoredRawLogAppend>> {
	const staged = await readRawLogAppend(input.stagingPath);
	if (staged && canonicalJson(staged.reference) !== canonicalJson(input.reference)) {
		throw new Error("Run raw-log append reference conflicts with retained staging.");
	}
	const existing = staged
		? Buffer.from(staged.contentBase64, "base64")
		: Buffer.alloc(0);
	if (input.offset < existing.byteLength) {
		assertExistingRawLogChunk(existing, input.offset, input.chunk);
		return rawLogAppendResult(input.reference, existing.byteLength, false);
	}
	if (input.offset !== existing.byteLength) {
		throw new Error("Run raw-log append offset is stale or noncontiguous.");
	}
	return persistRawLogAppendContent(input, Buffer.concat([existing, input.chunk]));
}

async function persistRawLogAppendContent(
	input: {
		readonly finalPath: string;
		readonly stagingPath: string;
		readonly reference: RunRawLogReference;
	},
	content: Buffer,
): Promise<Readonly<StoredRawLogAppend>> {
	if (content.byteLength > input.reference.byteLength) {
		throw new Error("Run raw-log append exceeds its declared artifact.");
	}
	if (content.byteLength === input.reference.byteLength) {
		assertRawLogBytes(input.reference, content);
		await writeFileAtomic(input.finalPath, content);
		await rm(input.stagingPath, {force: true});
		return rawLogAppendResult(input.reference, content.byteLength, true);
	}
	const record = Object.freeze({
		schemaVersion: RAW_LOG_APPEND_SCHEMA_VERSION,
		reference: input.reference,
		contentBase64: content.toString("base64"),
	});
	await writeFileAtomic(input.stagingPath, `${canonicalJson(record)}\n`);
	return rawLogAppendResult(input.reference, content.byteLength, false);
}

export async function recoverStoredRawLogAppends(
	options: RuntimeEvidenceStoreOptions,
): Promise<readonly Readonly<StoredRawLogAppend>[]> {
	const root = evidenceRoot(options.stateRoot);
	const names = await regularFileNames(join(root, "raw-log-appends"));
	const appends: Readonly<StoredRawLogAppend>[] = [];
	for (const name of names) {
		if (!/^[0-9a-f]{64}\.json$/.test(name)) continue;
		const record = await readRawLogAppend(join(root, "raw-log-appends", name));
		if (!record) continue;
		if (name !== `${record.reference.digest.slice("sha256:".length)}.json`) {
			throw new Error("Run raw-log append path does not match its digest.");
		}
		const content = Buffer.from(record.contentBase64, "base64");
		if (content.byteLength >= record.reference.byteLength) {
			throw new Error("Run raw-log append staging is not incomplete.");
		}
		const retained = await readRegularFileIfPresent(
			rawLogPath(root, record.reference.digest),
		);
		if (retained) {
			assertRawLogBytes(record.reference, retained);
			await rm(join(root, "raw-log-appends", name), {force: true});
			continue;
		}
		appends.push(rawLogAppendResult(record.reference, content.byteLength, false));
	}
	appends.sort((left, right) => compareText(left.reference.digest, right.reference.digest));
	return Object.freeze(appends);
}

export async function retainRunRawLog(input: {
	readonly stateRoot: string;
	readonly reference: RunRawLogReference;
	readonly content: Uint8Array;
}): Promise<Readonly<RunRawLogReference>> {
	const reference = createRunRawLogReference(input.reference);
	const bytes = Buffer.from(input.content);
	assertRawLogBytes(reference, bytes);
	const root = evidenceRoot(input.stateRoot);
	const key = reference.digest.slice("sha256:".length);
	return withFileLock(lockPath(root, `raw-${key}`), async () => {
		const path = rawLogPath(root, reference.digest);
		const existing = await readRegularFileIfPresent(path);
		if (existing) {
			assertRawLogBytes(reference, existing);
			return reference;
		}
		await writeFileAtomic(path, bytes);
		return reference;
	});
}

export async function readRetainedRunRawLog(input: {
	readonly stateRoot: string;
	readonly reference: RunRawLogReference;
}): Promise<Buffer | null> {
	const reference = createRunRawLogReference(input.reference);
	const bytes = await readRegularFileIfPresent(
		rawLogPath(evidenceRoot(input.stateRoot), reference.digest),
	);
	if (bytes) assertRawLogBytes(reference, bytes);
	return bytes;
}

export async function assertRetainedRunRawLog(input: {
	readonly stateRoot: string;
	readonly reference: RunRawLogReference;
}): Promise<void> {
	const bytes = await readRetainedRunRawLog(input);
	if (!bytes) throw new Error("Run raw log is not retained.");
}

function evidenceRoot(stateRoot: string): string {
	return join(normalizeRuntimeStateRoot(stateRoot), STORE_DIRECTORY);
}

function ledgerKey(runId: string, requestDigest: Sha256Digest): string {
	if (typeof runId !== "string" || runId.length === 0) {
		throw new Error("Stored Execution Ledger Run id is invalid.");
	}
	return canonicalJsonDigest({runId, requestDigest}).slice("sha256:".length);
}

function ledgerPath(root: string, key: string): string {
	return join(root, "ledgers", `${key}.json`);
}

function ledgerVersionPath(root: string, digest: Sha256Digest): string {
	return join(root, "ledger-versions", `${digest.slice("sha256:".length)}.json`);
}

function rawLogPath(root: string, digest: Sha256Digest): string {
	return join(root, "raw-logs", `${digest.slice("sha256:".length)}.bin`);
}

function rawLogAppendPath(root: string, digest: Sha256Digest): string {
	return join(root, "raw-log-appends", `${digest.slice("sha256:".length)}.json`);
}

function lockPath(root: string, key: string): string {
	return join(root, "locks", key);
}

async function requiredLedger(path: string): Promise<Readonly<ExecutionLedger>> {
	const ledger = await readLedgerFile(path);
	if (!ledger) throw new Error("Stored Execution Ledger does not exist.");
	return ledger;
}

async function readLedgerFile(
	path: string,
): Promise<Readonly<ExecutionLedger> | null> {
	const bytes = await readRegularFileIfPresent(path);
	if (!bytes) return null;
	return assertExecutionLedger(parseStoredJson(bytes, "Stored Execution Ledger"));
}

async function persistLedger(
	root: string,
	path: string,
	ledger: ExecutionLedger,
): Promise<void> {
	const content = `${canonicalJson(ledger)}\n`;
	const versionPath = ledgerVersionPath(root, ledger.ledgerDigest);
	const existingVersion = await readLedgerFile(versionPath);
	if (existingVersion) {
		if (existingVersion.ledgerDigest !== ledger.ledgerDigest) {
			throw new Error("Stored Execution Ledger version conflicts with its digest.");
		}
	} else {
		await writeFileAtomic(versionPath, content);
	}
	await writeFileAtomic(path, content);
}

function assertLedgerIdentity(
	ledger: ExecutionLedger,
	runId: string,
	requestDigest: Sha256Digest,
): void {
	if (
		ledger.header.runId !== runId ||
		ledger.header.requestDigest !== requestDigest
	) {
		throw new Error("Stored Execution Ledger identity does not match the Run.");
	}
}

async function readRawLogAppend(path: string): Promise<Readonly<RawLogAppendRecord> | null> {
	const bytes = await readRegularFileIfPresent(path);
	if (!bytes) return null;
	const value = parseStoredJson(bytes, "Run raw-log append");
	if (
		!value || typeof value !== "object" || Array.isArray(value) ||
		(value as {schemaVersion?: unknown}).schemaVersion !== RAW_LOG_APPEND_SCHEMA_VERSION ||
		typeof (value as {contentBase64?: unknown}).contentBase64 !== "string"
	) {
		throw new Error("Run raw-log append record shape is invalid.");
	}
	const candidate = value as RawLogAppendRecord;
	const reference = createRunRawLogReference(candidate.reference);
	const content = Buffer.from(candidate.contentBase64, "base64");
	if (content.toString("base64") !== candidate.contentBase64) {
		throw new Error("Run raw-log append encoding is invalid.");
	}
	if (content.byteLength >= reference.byteLength) {
		throw new Error("Run raw-log append staging is not incomplete.");
	}
	const normalized = Object.freeze({
		schemaVersion: RAW_LOG_APPEND_SCHEMA_VERSION,
		reference,
		contentBase64: candidate.contentBase64,
	});
	if (canonicalJson(value) !== canonicalJson(normalized)) {
		throw new Error("Run raw-log append record is not canonical.");
	}
	return normalized;
}

function assertExistingRawLogChunk(
	content: Uint8Array,
	offset: number,
	chunk: Uint8Array,
): void {
	if (offset + chunk.byteLength > content.byteLength) {
		throw new Error("Run raw-log append overlaps incomplete retained bytes.");
	}
	if (!Buffer.from(content).subarray(offset, offset + chunk.byteLength).equals(Buffer.from(chunk))) {
		throw new Error("Run raw-log append conflicts with retained bytes.");
	}
}

function rawLogAppendResult(
	reference: RunRawLogReference,
	nextOffset: number,
	complete: boolean,
): Readonly<StoredRawLogAppend> {
	return Object.freeze({reference, nextOffset, complete});
}

function assertRawLogBytes(
	reference: RunRawLogReference,
	bytes: Uint8Array,
): void {
	if (bytes.byteLength !== reference.byteLength) {
		throw new Error("Run raw log byte length does not match its reference.");
	}
	if (sha256Digest(bytes) !== reference.digest) {
		throw new Error("Run raw log digest does not match its reference.");
	}
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
