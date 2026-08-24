import {join} from "node:path";
import {
	ensureCodeWikiStateDirectory,
	projectServerStatePaths,
	projectStateRef,
} from "./paths.ts";
import {
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {readBackendStateManifest} from "./state.ts";

export const DSH_AGENT_SESSION_CUSTODY_PROTOCOL = Object.freeze({
	id: "codewiki.dsh-agent-session-custody",
	version: "1.0.0",
} as const);

export interface DshAgentSessionCustodyBinding {
	readonly protocol: typeof DSH_AGENT_SESSION_CUSTODY_PROTOCOL;
	readonly repositoryIdentity: Sha256Digest;
	readonly sessionId: string;
	readonly sessionRoot: string;
	readonly sessionRootRef: string;
	readonly custodyDigest: Sha256Digest;
}

export async function authorizeDshAgentSessionCustody(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly sessionId: string;
}): Promise<DshAgentSessionCustodyBinding> {
	if (
		typeof input.sessionId !== "string" ||
		input.sessionId.length < 1 ||
		input.sessionId.length > 256 ||
		[...input.sessionId].some((character) => {
			const code = character.codePointAt(0) ?? 0;
			return code < 32 || code === 127;
		})
	) {
		throw new Error("DSH Agent Session custody sessionId is invalid.");
	}
	const paths = projectServerStatePaths(input);
	if (!(await readBackendStateManifest(input))) {
		throw new Error("DSH Agent Session custody requires bootstrapped Backend state.");
	}
	const storageKey = canonicalJsonDigest({sessionId: input.sessionId}).slice(7);
	const sessionRoot = join(paths.dshSessionsRoot, storageKey);
	await ensureCodeWikiStateDirectory(paths, sessionRoot);
	const identity = {
		protocol: DSH_AGENT_SESSION_CUSTODY_PROTOCOL,
		repositoryIdentity: paths.repositoryIdentity,
		sessionId: input.sessionId,
		sessionRootRef: projectStateRef(paths, sessionRoot),
	};
	return Object.freeze({
		...identity,
		sessionRoot,
		custodyDigest: canonicalJsonDigest(identity),
	});
}
