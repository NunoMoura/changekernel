import {
	assertCodeWikiStatePath,
	ensureCodeWikiStateDirectory,
	projectServerStatePaths,
} from "../operations/paths.ts";
import type {Sha256Digest} from "../../utils/canonical-json.ts";
import type {RuntimeBuildBinding} from "../../runtime/contracts.ts";
import type {SessionContinuityRecord} from "./continuity.ts";
import {readBackendStateManifest} from "../operations/state.ts";
import {
	appendStoredSessionContinuity,
	createStoredSessionContinuity,
	readStoredSessionContinuity,
} from "./continuity-store.ts";

export async function createProjectSessionContinuity(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly continuityKey: string;
	readonly sessionId: string;
	readonly runtimeBuild: RuntimeBuildBinding;
	readonly createdAt: string;
}): Promise<SessionContinuityRecord> {
	const continuityRoot = await admittedContinuityRoot(input);
	return createStoredSessionContinuity({...input, stateRoot: continuityRoot});
}

export async function readProjectSessionContinuity(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly continuityKey: string;
}): Promise<SessionContinuityRecord | null> {
	const continuityRoot = await admittedContinuityRoot(input);
	return readStoredSessionContinuity({...input, stateRoot: continuityRoot});
}

export async function appendProjectSessionContinuity(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly continuityKey: string;
	readonly expectedRecordDigest: Sha256Digest;
	readonly record: SessionContinuityRecord;
}): Promise<SessionContinuityRecord> {
	const continuityRoot = await admittedContinuityRoot(input);
	return appendStoredSessionContinuity({...input, stateRoot: continuityRoot});
}

async function admittedContinuityRoot(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
}): Promise<string> {
	const paths = projectServerStatePaths(input);
	if (!(await readBackendStateManifest(input))) {
		throw new Error("Session Continuity requires bootstrapped Backend state.");
	}
	await ensureCodeWikiStateDirectory(paths, paths.continuityRoot);
	await assertCodeWikiStatePath(paths, paths.continuityRoot);
	return paths.continuityRoot;
}
