import {
	chmod,
	link,
	mkdir,
	open,
	readdir,
	readFile,
	rm,
	stat,
} from "node:fs/promises";
import {basename, join, resolve} from "node:path";
import {
	PROJECT_CONTEXT_MOUNT_PROTOCOL,
	type ProjectContextMountBinding,
	type ProjectContextSnapshot,
} from "../../runtime/contracts.ts";
import {canonicalJson, canonicalJsonDigest, type Sha256Digest} from "../../utils/canonical-json.ts";

export const PROJECT_CONTEXT_STORE_PROTOCOL = Object.freeze({
	id: "codewiki.project-context-store",
	version: "1.0.0",
} as const);
export const PROJECT_CONTEXT_MAX_RETENTION_REFS = 4_096;

export interface ProjectContextRetentionRef {
	readonly refId: string;
	readonly ownerKind: "run" | "session" | "candidate" | "review";
	readonly ownerId: string;
	readonly snapshotDigest: Sha256Digest;
	readonly retainedAt: string;
}

export interface ProjectContextStore {
	readonly protocol: typeof PROJECT_CONTEXT_STORE_PROTOCOL;
	readonly root: string;
	readonly put: (snapshot: ProjectContextSnapshot) => Promise<string>;
	readonly mountBinding: (snapshot: ProjectContextSnapshot) => Promise<ProjectContextMountBinding>;
	readonly retain: (ref: ProjectContextRetentionRef) => Promise<void>;
	readonly release: (refId: string) => Promise<void>;
	readonly retainedSnapshotDigests: () => Promise<readonly Sha256Digest[]>;
	readonly pruneUnreferenced: (keepNewest: number) => Promise<readonly Sha256Digest[]>;
}

export async function createProjectContextStore(rootValue: string): Promise<ProjectContextStore> {
	const root = resolve(rootValue);
	if (root !== rootValue) throw new Error("Project Context store root must be absolute and normalized.");
	const snapshotsRoot = join(root, "snapshots");
	const chunksRoot = join(root, "chunks");
	const refsRoot = join(root, "refs");
	await Promise.all([
		mkdir(snapshotsRoot, {recursive: true}),
		mkdir(chunksRoot, {recursive: true}),
		mkdir(refsRoot, {recursive: true}),
	]);
	const put = async (snapshot: ProjectContextSnapshot): Promise<string> => {
		for (const chunk of snapshot.chunks) {
			await writeContentAddressed(
				join(chunksRoot, `${digestHex(chunk.chunkDigest)}.json`),
				canonicalJson(chunk),
			);
		}
		const path = join(snapshotsRoot, `${digestHex(snapshot.snapshotDigest)}.json`);
		await writeContentAddressed(path, canonicalJson(snapshot));
		return path;
	};
	return Object.freeze({
		protocol: PROJECT_CONTEXT_STORE_PROTOCOL,
		root,
		put,
		mountBinding: async (snapshot: ProjectContextSnapshot) => {
			const snapshotPath = await put(snapshot);
			return Object.freeze({
				protocol: PROJECT_CONTEXT_MOUNT_PROTOCOL,
				snapshotDigest: snapshot.snapshotDigest,
				semanticContextDigest: snapshot.manifest.semanticContextDigest,
				snapshotPath,
				readOnly: true,
			});
		},
		retain: async (ref: ProjectContextRetentionRef) => {
			assertRetentionRef(ref);
			const currentRefs = await readdir(refsRoot);
			if (currentRefs.length >= PROJECT_CONTEXT_MAX_RETENTION_REFS) {
				throw new Error("Project Context retention reference limit is exhausted.");
			}
			await writeContentAddressed(
				join(refsRoot, `${canonicalJsonDigest(ref).slice(7)}.json`),
				canonicalJson(ref),
			);
		},
		release: async (refId: string) => {
			assertIdentifier(refId, "retention ref id");
			for (const name of await readdir(refsRoot)) {
				const path = join(refsRoot, name);
				const ref = await readRetentionRef(path);
				if (ref.refId === refId) await rm(path, {force: true});
			}
		},
		retainedSnapshotDigests: async () => {
			const digests = await Promise.all((await readdir(refsRoot)).map(async (name) =>
				(await readRetentionRef(join(refsRoot, name))).snapshotDigest
			));
			return Object.freeze([...new Set(digests)].sort(compareText));
		},
		pruneUnreferenced: async (keepNewest: number) => {
			if (!Number.isInteger(keepNewest) || keepNewest < 0 || keepNewest > 1_024) {
				throw new Error("Project Context retention keep count is invalid.");
			}
			const retained = new Set(await retainedSnapshotDigestsFrom(refsRoot));
			const entries = await Promise.all((await readdir(snapshotsRoot))
				.filter((name) => /^[0-9a-f]{64}\.json$/u.test(name))
				.map(async (name) => ({name, metadata: await stat(join(snapshotsRoot, name))})));
			entries.sort((left, right) => right.metadata.mtimeMs - left.metadata.mtimeMs || compareText(left.name, right.name));
			const preservedNewest = new Set(entries.slice(0, keepNewest).map((entry) => entry.name));
			const removed: Sha256Digest[] = [];
			for (const entry of entries) {
				const digest = `sha256:${basename(entry.name, ".json")}` as Sha256Digest;
				if (retained.has(digest) || preservedNewest.has(entry.name)) continue;
				await rm(join(snapshotsRoot, entry.name), {force: true});
				removed.push(digest);
			}
			const retainedChunks = new Set<Sha256Digest>();
			for (const name of await readdir(snapshotsRoot)) {
				for (const digest of await readStoredSnapshotChunkDigests(join(snapshotsRoot, name))) {
					retainedChunks.add(digest);
				}
			}
			for (const name of await readdir(chunksRoot)) {
				if (!/^[0-9a-f]{64}\.json$/u.test(name)) continue;
				const digest = `sha256:${basename(name, ".json")}` as Sha256Digest;
				if (!retainedChunks.has(digest)) await rm(join(chunksRoot, name), {force: true});
			}
			return Object.freeze(removed.sort(compareText));
		},
	});
}

async function writeContentAddressed(path: string, bytes: string): Promise<void> {
	try {
		const existing = await readFile(path, "utf8");
		if (existing !== bytes) throw new Error("Project Context content-addressed path contains different bytes.");
		return;
	} catch (error) {
		if (!isMissing(error)) throw error;
	}
	const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
	const handle = await open(temporary, "wx", 0o600);
	try {
		await handle.writeFile(bytes, "utf8");
		await handle.sync();
	} finally {
		await handle.close();
	}
	await chmod(temporary, 0o444);
	try {
		await link(temporary, path);
	} catch (error) {
		if (!isAlreadyExists(error)) throw error;
		const existing = await readFile(path, "utf8");
		if (existing !== bytes) throw new Error("Project Context content-addressed write raced with different bytes.");
	} finally {
		await rm(temporary, {force: true});
	}
}

async function readStoredSnapshotChunkDigests(path: string): Promise<readonly Sha256Digest[]> {
	let value: unknown;
	try {
		value = JSON.parse(await readFile(path, "utf8")) as unknown;
	} catch {
		throw new Error("Stored Project Context Snapshot is invalid JSON.");
	}
	if (!isRecord(value) || !isRecord(value.manifest) || !Array.isArray(value.manifest.chunkDigests)) {
		throw new Error("Stored Project Context Snapshot chunk manifest is invalid.");
	}
	return Object.freeze(value.manifest.chunkDigests.map((digest) => {
		if (typeof digest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(digest)) {
			throw new Error("Stored Project Context Snapshot chunk digest is invalid.");
		}
		return digest as Sha256Digest;
	}));
}

async function retainedSnapshotDigestsFrom(root: string): Promise<readonly Sha256Digest[]> {
	const values = await Promise.all((await readdir(root)).map(async (name) =>
		(await readRetentionRef(join(root, name))).snapshotDigest
	));
	return Object.freeze([...new Set(values)].sort(compareText));
}

async function readRetentionRef(path: string): Promise<ProjectContextRetentionRef> {
	let value: unknown;
	try {
		value = JSON.parse(await readFile(path, "utf8")) as unknown;
	} catch {
		throw new Error("Project Context retention reference is invalid JSON.");
	}
	if (!isRecord(value)) throw new Error("Project Context retention reference is invalid.");
	// SAFETY: assertRetentionRef validates every authority-bearing field before return.
	const ref = value as unknown as ProjectContextRetentionRef;
	assertRetentionRef(ref);
	return ref;
}

function assertRetentionRef(ref: ProjectContextRetentionRef): void {
	assertIdentifier(ref.refId, "retention ref id");
	assertIdentifier(ref.ownerId, "retention owner id");
	if (!["run", "session", "candidate", "review"].includes(ref.ownerKind)) {
		throw new Error("Project Context retention owner kind is invalid.");
	}
	if (!/^sha256:[0-9a-f]{64}$/u.test(ref.snapshotDigest)) {
		throw new Error("Project Context retention snapshot digest is invalid.");
	}
	if (!Number.isFinite(Date.parse(ref.retainedAt))) {
		throw new Error("Project Context retention time is invalid.");
	}
}

function digestHex(value: Sha256Digest): string {
	if (!/^sha256:[0-9a-f]{64}$/u.test(value)) throw new Error("Project Context digest is invalid.");
	return value.slice(7);
}

function assertIdentifier(value: unknown, field: string): asserts value is string {
	if (typeof value !== "string" || value.length === 0 || value.length > 256 || value.trim() !== value) {
		throw new Error(`Project Context ${field} is invalid.`);
	}
}

function isMissing(error: unknown): boolean {
	return isRecord(error) && error.code === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
	return isRecord(error) && error.code === "EEXIST";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
