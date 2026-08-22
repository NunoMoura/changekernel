import {mkdir, open, readFile, rm} from "node:fs/promises";
import {dirname, isAbsolute, join, resolve} from "node:path";

import {
	assertSessionContinuityRecord,
	createSessionContinuity,
	type SessionContinuityRecord,
} from "./continuity.ts";
import {
	assertSha256Digest,
	canonicalJson,
	sha256Digest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import type {RuntimeBuildBinding} from "../../runtime/contracts.ts";

const JOURNAL_DIRECTORY = "session-continuity";
const MAX_JOURNAL_BYTES = 16 * 1024 * 1024;

export async function createStoredSessionContinuity(input: {
	readonly stateRoot: string;
	readonly continuityKey: string;
	readonly sessionId: string;
	readonly runtimeBuild: RuntimeBuildBinding;
	readonly createdAt: string;
}): Promise<SessionContinuityRecord> {
	const record = createSessionContinuity(input);
	return withContinuityLock(input.stateRoot, input.continuityKey, async (path) => {
		if (await readJournal(path, input.continuityKey)) {
			throw new Error("Session continuity already exists.");
		}
		await appendRecord(path, record, "wx");
		return record;
	});
}

export async function readStoredSessionContinuity(input: {
	readonly stateRoot: string;
	readonly continuityKey: string;
}): Promise<SessionContinuityRecord | null> {
	return readJournal(
		journalPath(input.stateRoot, input.continuityKey),
		input.continuityKey,
	);
}

export async function appendStoredSessionContinuity(input: {
	readonly stateRoot: string;
	readonly continuityKey: string;
	readonly expectedRecordDigest: Sha256Digest;
	readonly record: SessionContinuityRecord;
}): Promise<SessionContinuityRecord> {
	const expectedRecordDigest = assertSha256Digest(
		input.expectedRecordDigest,
		"Expected stored Session continuity digest",
	);
	const next = assertSessionContinuityRecord(input.record);
	return withContinuityLock(input.stateRoot, input.continuityKey, async (path) => {
		const current = await readJournal(path, input.continuityKey);
		if (!current) throw new Error("Stored Session continuity is unavailable.");
		if (current.recordDigest !== expectedRecordDigest) {
			throw new Error("Stored Session continuity expected head is stale.");
		}
		assertNextRecord(current, next, input.continuityKey);
		await appendRecord(path, next, "a");
		return next;
	});
}

async function readJournal(
	path: string,
	continuityKey: string,
): Promise<SessionContinuityRecord | null> {
	let bytes: string;
	try {
		bytes = await readFile(path, "utf8");
	} catch (error) {
		if (isNotFound(error)) return null;
		throw error;
	}
	if (Buffer.byteLength(bytes) > MAX_JOURNAL_BYTES) {
		throw new Error("Session continuity journal exceeds its byte limit.");
	}
	const lines = bytes.split("\n");
	if (lines.at(-1) !== "") {
		throw new Error("Session continuity journal has an incomplete trailing record.");
	}
	lines.pop();
	if (lines.length === 0) {
		throw new Error("Session continuity journal is empty.");
	}
	let previous: SessionContinuityRecord | null = null;
	for (const line of lines) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			throw new Error("Session continuity journal contains invalid JSON.");
		}
		const record = assertSessionContinuityRecord(parsed);
		if (record.continuityKey !== continuityKey) {
			throw new Error("Session continuity journal key is invalid.");
		}
		if (previous === null) {
			if (record.generation !== 0 || record.previousRecordDigest !== null) {
				throw new Error("Session continuity journal does not begin at generation zero.");
			}
		} else {
			assertNextRecord(previous, record, continuityKey);
		}
		previous = record;
	}
	return previous;
}

function assertNextRecord(
	current: SessionContinuityRecord,
	next: SessionContinuityRecord,
	continuityKey: string,
): void {
	if (
		next.continuityKey !== continuityKey ||
		next.continuityKey !== current.continuityKey ||
		next.generation !== current.generation + 1 ||
		next.previousRecordDigest !== current.recordDigest ||
		next.createdAt !== current.createdAt
	) {
		throw new Error("Session continuity journal transition is invalid.");
	}
}

async function appendRecord(
	path: string,
	record: SessionContinuityRecord,
	flag: "wx" | "a",
): Promise<void> {
	const handle = await open(path, flag, 0o600);
	try {
		await handle.writeFile(`${canonicalJson(record)}\n`, "utf8");
		await handle.datasync();
	} finally {
		await handle.close();
	}
	if (flag === "wx") await syncDirectory(dirname(path));
}

async function withContinuityLock<T>(
	stateRoot: string,
	continuityKey: string,
	run: (journalPath: string) => Promise<T>,
): Promise<T> {
	const root = continuityRoot(stateRoot);
	await mkdir(root, {recursive: true, mode: 0o700});
	const key = storageKey(continuityKey);
	const lockPath = join(root, `${key}.lock`);
	let handle;
	try {
		handle = await open(lockPath, "wx", 0o600);
	} catch (error) {
		if (isAlreadyExists(error)) {
			throw new Error("Another Session continuity write is in progress.");
		}
		throw error;
	}
	try {
		return await run(join(root, `${key}.jsonl`));
	} finally {
		await handle.close();
		await rm(lockPath, {force: true});
	}
}

function journalPath(stateRoot: string, continuityKey: string): string {
	return join(continuityRoot(stateRoot), `${storageKey(continuityKey)}.jsonl`);
}

function continuityRoot(stateRoot: string): string {
	if (typeof stateRoot !== "string" || !isAbsolute(stateRoot)) {
		throw new Error("Session continuity state root must be absolute.");
	}
	return join(resolve(stateRoot), JOURNAL_DIRECTORY);
}

function storageKey(continuityKey: string): string {
	if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(continuityKey)) {
		throw new Error("Session continuity key is invalid.");
	}
	return sha256Digest(continuityKey).slice("sha256:".length);
}

async function syncDirectory(path: string): Promise<void> {
	const handle = await open(path, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

function isNotFound(error: unknown): boolean {
	return isNodeError(error) && error.code === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
	return isNodeError(error) && error.code === "EEXIST";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}
