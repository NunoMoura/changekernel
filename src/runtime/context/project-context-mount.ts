import {lstat, readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {
	PROJECT_CONTEXT_AUTHORIZATION_PROTOCOL,
	PROJECT_CONTEXT_MOUNT_PROTOCOL,
	PROJECT_CONTEXT_OBSERVATION_PROTOCOL,
	PROJECT_CONTEXT_SNAPSHOT_PROTOCOL,
	type ProjectContextAuthorization,
	type ProjectContextMountBinding,
	type ProjectContextSnapshot,
} from "../contracts.ts";
import {
	assertSha256Digest,
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export function assertProjectContextMountBinding(
	value: unknown,
): Readonly<ProjectContextMountBinding> {
	if (!isRecord(value)) throw new Error("Project Context mount binding is invalid.");
	// SAFETY: protocol, digest, path, and read-only fields are validated below.
	const binding = value as unknown as ProjectContextMountBinding;
	if (
		canonicalJson(binding.protocol) !== canonicalJson(PROJECT_CONTEXT_MOUNT_PROTOCOL) ||
		binding.readOnly !== true
	) {
		throw new Error("Project Context mount binding is invalid.");
	}
	assertSha256Digest(binding.snapshotDigest, "Project Context mount snapshot digest");
	assertSha256Digest(binding.semanticContextDigest, "Project Context mount semantic digest");
	const snapshotPath = resolve(binding.snapshotPath);
	if (snapshotPath !== binding.snapshotPath) {
		throw new Error("Project Context snapshot path must be absolute and normalized.");
	}
	return Object.freeze({...binding, snapshotPath});
}

export function assertProjectContextAuthorization(
	value: unknown,
	snapshot: ProjectContextSnapshot,
	expected: {
		readonly runId: string;
		readonly stage: ProjectContextSnapshot["manifest"]["stage"];
		readonly subjectDigest: ProjectContextSnapshot["manifest"]["subject"]["digest"];
		readonly observedAt: string;
	},
): Readonly<ProjectContextAuthorization> {
	if (!isRecord(value)) throw new Error("Project Context authorization is invalid.");
	// SAFETY: all authority and digest fields are validated below before return.
	const authorization = value as unknown as ProjectContextAuthorization;
	const {authorizationDigest: _authorizationDigest, ...body} = authorization;
	if (
		canonicalJson(authorization.protocol) !== canonicalJson(PROJECT_CONTEXT_AUTHORIZATION_PROTOCOL) ||
		canonicalJsonDigest(body) !== authorization.authorizationDigest ||
		authorization.snapshotDigest !== snapshot.snapshotDigest ||
		authorization.semanticContextDigest !== snapshot.manifest.semanticContextDigest ||
		authorization.runId !== expected.runId ||
		authorization.stage !== expected.stage ||
		authorization.subjectDigest !== expected.subjectDigest ||
		snapshot.observation.stale ||
		Date.parse(expected.observedAt) < Date.parse(authorization.authorizedAt) ||
		Date.parse(expected.observedAt) >= Date.parse(authorization.expiresAt)
	) {
		throw new Error("Project Context authorization is invalid, expired, or mismatched.");
	}
	assertSha256Digest(authorization.actorDigest, "Project Context authorization actor digest");
	return Object.freeze(authorization);
}

export async function mountProjectContextSnapshot(
	bindingValue: ProjectContextMountBinding,
): Promise<Readonly<ProjectContextSnapshot>> {
	const binding = assertProjectContextMountBinding(bindingValue);
	const snapshotPath = binding.snapshotPath;
	const metadata = await lstat(snapshotPath);
	if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o222) !== 0) {
		throw new Error("Project Context snapshot mount must be a read-only regular file.");
	}
	let value: unknown;
	try {
		value = JSON.parse(await readFile(snapshotPath, "utf8")) as unknown;
	} catch {
		throw new Error("Project Context snapshot mount does not contain valid JSON.");
	}
	const snapshot = assertProjectContextSnapshot(value);
	if (
		snapshot.snapshotDigest !== binding.snapshotDigest ||
		snapshot.manifest.semanticContextDigest !== binding.semanticContextDigest
	) {
		throw new Error("Project Context snapshot mount does not match its binding.");
	}
	return snapshot;
}

export function assertProjectContextSnapshot(value: unknown): Readonly<ProjectContextSnapshot> {
	if (!isRecord(value)) throw new Error("Project Context Snapshot must be an object.");
	// SAFETY: all identity-bearing nested fields are checked below before return.
	const snapshot = value as unknown as ProjectContextSnapshot;
	if (
		snapshot.schemaVersion !== "1.0.0" ||
		canonicalJson(snapshot.manifest?.protocol) !== canonicalJson(PROJECT_CONTEXT_SNAPSHOT_PROTOCOL) ||
		canonicalJson(snapshot.observation?.protocol) !== canonicalJson(PROJECT_CONTEXT_OBSERVATION_PROTOCOL)
	) {
		throw new Error("Project Context Snapshot protocol is unsupported.");
	}
	assertSha256Digest(snapshot.snapshotDigest, "Project Context snapshot digest");
	assertSha256Digest(snapshot.manifest.semanticContextDigest, "Project Context semantic digest");
	assertSha256Digest(snapshot.observation.observationDigest, "Project Context observation digest");
	if (snapshot.observation.semanticContextDigest !== snapshot.manifest.semanticContextDigest) {
		throw new Error("Project Context observation belongs to another semantic context.");
	}
	const {semanticContextDigest: _semanticContextDigest, ...manifestBody} = snapshot.manifest;
	if (canonicalJsonDigest(manifestBody) !== snapshot.manifest.semanticContextDigest) {
		throw new Error("Project Context semantic digest is invalid.");
	}
	const {observationDigest: _observationDigest, ...observationBody} = snapshot.observation;
	if (canonicalJsonDigest(observationBody) !== snapshot.observation.observationDigest) {
		throw new Error("Project Context observation digest is invalid.");
	}
	if (
		canonicalJsonDigest({
			semanticContextDigest: snapshot.manifest.semanticContextDigest,
			observationDigest: snapshot.observation.observationDigest,
		}) !== snapshot.snapshotDigest
	) {
		throw new Error("Project Context snapshot digest is invalid.");
	}
	if (!Array.isArray(snapshot.chunks) || !Array.isArray(snapshot.manifest.routes) || !Array.isArray(snapshot.handles)) {
		throw new Error("Project Context Snapshot collections are invalid.");
	}
	const chunks = new Map(snapshot.chunks.map((chunk) => {
		const digest = canonicalJsonDigest({items: chunk.items});
		if (
			digest !== chunk.chunkDigest ||
			Buffer.byteLength(canonicalJson({items: chunk.items})) !== chunk.byteLength
		) {
			throw new Error("Project Context chunk identity is invalid.");
		}
		return [chunk.chunkDigest, chunk] as const;
	}));
	if (
		chunks.size !== snapshot.chunks.length ||
		canonicalJson([...chunks.keys()].sort(compareText)) !==
			canonicalJson([...snapshot.manifest.chunkDigests].sort(compareText))
	) {
		throw new Error("Project Context chunk coverage is incomplete.");
	}
	for (const route of snapshot.manifest.routes) {
		if (canonicalJsonDigest(route.request) !== route.requestDigest) {
			throw new Error("Project Context route identity is invalid.");
		}
		const itemCount = route.chunkDigests.reduce((count: number, digest: Sha256Digest) => {
			const chunk = chunks.get(digest);
			if (!chunk) throw new Error("Project Context route chunk is unavailable.");
			return count + chunk.items.length;
		}, 0);
		if (itemCount !== route.itemCount) throw new Error("Project Context route item count is invalid.");
	}
	for (const handle of snapshot.handles) {
		const chunk = chunks.get(handle.chunkDigest);
		const suffix = canonicalJsonDigest({
			snapshotDigest: handle.snapshotDigest,
			targetKey: handle.targetKey,
			requestDigest: handle.requestDigest,
			chunkDigest: handle.chunkDigest,
			itemIndex: handle.itemIndex,
		}).slice(7, 19);
		if (
			handle.snapshotDigest !== snapshot.snapshotDigest ||
			handle.handle !== `pch:${snapshot.snapshotDigest.slice(7, 19)}:${suffix}` ||
			!snapshot.manifest.routes.some((route) =>
				route.requestDigest === handle.requestDigest && route.chunkDigests.includes(handle.chunkDigest)
			) ||
			!chunk ||
			!Number.isInteger(handle.itemIndex) ||
			handle.itemIndex < 0 ||
			handle.itemIndex >= chunk.items.length
		) {
			throw new Error("Project Context handle identity is invalid.");
		}
	}
	return Object.freeze(snapshot);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
