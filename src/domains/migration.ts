import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../utils/canonical-json.ts";
import {
	createKnowledgeCheckpoint,
	type KnowledgeCheckpoint,
} from "../knowledge/state.ts";
import {
	assertCheckpointBoundToDomain,
	domainCompilerIdentity,
} from "./binding.ts";
import {
	assertDomainPluginIdentity,
	domainPluginIdentity,
	type DomainPluginAdmission,
	type DomainPluginIdentity,
} from "./contracts.ts";

export const LEGACY_DOMAIN_CHECKPOINT_MIGRATION_PROTOCOL = Object.freeze({
	id: "codewiki.legacy-domain-checkpoint-migration",
	version: "1.0.0",
} as const);

export const DOMAIN_PLUGIN_MIGRATION_PROTOCOL = Object.freeze({
	id: "codewiki.domain-plugin-migration",
	version: "1.0.0",
} as const);

export type ActiveDomainBoundArtifactKind =
	| "candidate"
	| "gate-evaluation-package"
	| "run"
	| "session";

export interface ActiveDomainBoundArtifact {
	readonly kind: ActiveDomainBoundArtifactKind;
	readonly id: string;
	readonly domainPlugin: DomainPluginIdentity;
}

export interface LegacyDomainCheckpointMigration {
	readonly protocol: typeof LEGACY_DOMAIN_CHECKPOINT_MIGRATION_PROTOCOL;
	readonly domainPlugin: DomainPluginIdentity;
	readonly sourceCheckpointDigest: Sha256Digest;
	readonly targetCheckpoint: KnowledgeCheckpoint;
	readonly semanticStatePreserved: true;
	readonly migrationDigest: Sha256Digest;
}

export interface DomainPluginMigration {
	readonly protocol: typeof DOMAIN_PLUGIN_MIGRATION_PROTOCOL;
	readonly sourceDomainPlugin: DomainPluginIdentity;
	readonly targetDomainPlugin: DomainPluginIdentity;
	readonly sourceCheckpointDigest: Sha256Digest;
	readonly sourceProjectionDigest: Sha256Digest;
	readonly targetProjectionDigest: Sha256Digest;
	readonly sourceCompilerDigest: Sha256Digest;
	readonly targetCompilerDigest: Sha256Digest;
	readonly targetCheckpoint: KnowledgeCheckpoint;
	readonly semanticStatePreserved: true;
	readonly migrationDigest: Sha256Digest;
}

/**
 * Explicitly migrates historical Knowledge Checkpoint/Projection/Compiler 1.0.0
 * bytes into exact Domain-bound 2.0.0 contracts. Legacy bytes never gain an
 * implicit identity: caller must supply and authorize their source admission.
 */
export function migrateLegacyKnowledgeCheckpointToDomain(input: {
	readonly legacyCheckpoint: unknown;
	readonly admission: DomainPluginAdmission;
}): LegacyDomainCheckpointMigration {
	const checkpoint = record(input.legacyCheckpoint, "Legacy Knowledge checkpoint");
	assertProtocol(checkpoint.protocol, "codewiki.knowledge-checkpoint", "1.0.0");
	const projection = record(checkpoint.projection, "Legacy Knowledge projection");
	assertProtocol(projection.protocol, "codewiki.knowledge-projection", "1.0.0");
	const compiler = record(projection.compiler, "Legacy Knowledge compiler");
	assertProtocol(compiler.protocol, "codewiki.knowledge-compiler", "1.0.0");
	const expectedCompiler = domainCompilerIdentity(input.admission);
	for (const field of [
		"compilerId",
		"compilerVersion",
		"markdownRenderer",
		"yamlRenderer",
	] as const) {
		if (compiler[field] !== expectedCompiler[field]) {
			throw new Error(`Legacy Knowledge compiler ${field} does not match admitted Domain Plugin.`);
		}
	}
	assertCanonicalDigest(compiler, "digest", "Legacy Knowledge compiler");
	assertCanonicalDigest(projection, "projectionDigest", "Legacy Knowledge projection");
	assertCanonicalDigest(checkpoint, "checkpointDigest", "Legacy Knowledge checkpoint");
	if (!Array.isArray(projection.files)) {
		throw new Error("Legacy Knowledge projection files are invalid.");
	}
	const state = record(checkpoint.state, "Legacy Knowledge State");
	assertProtocol(state.protocol, "codewiki.knowledge-state", "1.0.0");
	assertCanonicalDigest(state, "stateDigest", "Legacy Knowledge State");
	const files = projection.files.map((value) => {
		const file = record(value, "Legacy Knowledge projection file");
		return {
			path: String(file.path),
			mediaType: file.mediaType as "text/markdown" | "application/yaml" | "application/json",
			bytes: String(file.bytes),
		};
	});
	if (!Array.isArray(state.tombstones)) {
		throw new Error("Legacy Knowledge tombstones are invalid.");
	}
	const targetCheckpoint = createKnowledgeCheckpoint({
		files,
		// SAFETY: createKnowledgeCheckpoint performs complete tombstone validation and canonicalization.
		tombstones: state.tombstones as KnowledgeCheckpoint["state"]["tombstones"],
		compiler: expectedCompiler,
	});
	if (targetCheckpoint.state.stateDigest !== state.stateDigest) {
		throw new Error("Legacy Knowledge checkpoint semantic State is incompatible with admitted Domain Plugin.");
	}
	const body = {
		protocol: LEGACY_DOMAIN_CHECKPOINT_MIGRATION_PROTOCOL,
		domainPlugin: domainPluginIdentity(input.admission),
		sourceCheckpointDigest: String(checkpoint.checkpointDigest) as Sha256Digest,
		targetCheckpoint,
		semanticStatePreserved: true as const,
	};
	// SAFETY: legacy canonical digests and target checkpoint were validated above.
	return toCanonicalJsonValue({
		...body,
		migrationDigest: canonicalJsonDigest(body),
	}) as unknown as LegacyDomainCheckpointMigration;
}

/**
 * Recomputes one checkpoint under an explicitly selected target admission.
 * No accepted state changes here: authority may admit resulting differences only
 * through normal Candidate and Decision protocols.
 */
export function createDomainPluginMigration(input: {
	readonly sourceAdmission: DomainPluginAdmission;
	readonly targetAdmission: DomainPluginAdmission;
	readonly sourceCheckpoint: KnowledgeCheckpoint;
	readonly activeArtifacts?: readonly ActiveDomainBoundArtifact[];
}): DomainPluginMigration {
	assertCheckpointBoundToDomain(input.sourceCheckpoint, input.sourceAdmission);
	const sourceDomainPlugin = domainPluginIdentity(input.sourceAdmission);
	const targetDomainPlugin = domainPluginIdentity(input.targetAdmission);
	if (sourceDomainPlugin.identityDigest === targetDomainPlugin.identityDigest) {
		throw new Error("Domain Plugin migration requires different source and target admissions.");
	}
	if (sourceDomainPlugin.pluginId !== targetDomainPlugin.pluginId) {
		throw new Error("Domain Plugin migration cannot change the project Domain Plugin ID.");
	}
	assertDomainPluginUpgradeQuiescent(
		sourceDomainPlugin,
		input.activeArtifacts ?? [],
	);
	const targetCheckpoint = createKnowledgeCheckpoint({
		files: input.sourceCheckpoint.projection.files.map((file) => ({
			path: file.path,
			mediaType: file.mediaType,
			bytes: file.bytes,
		})),
		tombstones: input.sourceCheckpoint.state.tombstones,
		compiler: domainCompilerIdentity(input.targetAdmission),
	});
	if (targetCheckpoint.state.stateDigest !== input.sourceCheckpoint.state.stateDigest) {
		throw new Error("Domain Plugin migration changed semantic Knowledge State without authority.");
	}
	assertCheckpointBoundToDomain(targetCheckpoint, input.targetAdmission);
	const body = {
		protocol: DOMAIN_PLUGIN_MIGRATION_PROTOCOL,
		sourceDomainPlugin,
		targetDomainPlugin,
		sourceCheckpointDigest: input.sourceCheckpoint.checkpointDigest,
		sourceProjectionDigest: input.sourceCheckpoint.projection.projectionDigest,
		targetProjectionDigest: targetCheckpoint.projection.projectionDigest,
		sourceCompilerDigest: input.sourceCheckpoint.projection.compiler.digest,
		targetCompilerDigest: targetCheckpoint.projection.compiler.digest,
		targetCheckpoint,
		semanticStatePreserved: true as const,
	};
	// SAFETY: source/target admissions and both checkpoints are exact validated canonical contracts.
	return toCanonicalJsonValue({
		...body,
		migrationDigest: canonicalJsonDigest(body),
	}) as unknown as DomainPluginMigration;
}

/** Rejects compiler hot mutation while any source-bound authority is active. */
export function assertDomainPluginUpgradeQuiescent(
	source: DomainPluginIdentity,
	activeArtifacts: readonly ActiveDomainBoundArtifact[],
): void {
	assertDomainPluginIdentity(source);
	if (!Array.isArray(activeArtifacts)) {
		throw new Error("Active Domain-bound artifacts must be an array.");
	}
	for (const artifact of activeArtifacts) {
		assertDomainPluginIdentity(artifact.domainPlugin);
		if (!artifact.id?.trim() || !ACTIVE_ARTIFACT_KINDS.has(artifact.kind)) {
			throw new Error("Active Domain-bound artifact is invalid.");
		}
	}
	const blocker = activeArtifacts.find(
		(artifact) => artifact.domainPlugin.identityDigest === source.identityDigest,
	);
	if (blocker) {
		throw new Error(
			`Domain Plugin upgrade cannot hot-swap active ${blocker.kind} ${blocker.id}.`,
		);
	}
}

const ACTIVE_ARTIFACT_KINDS: ReadonlySet<string> = new Set([
	"candidate",
	"gate-evaluation-package",
	"run",
	"session",
]);

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} is invalid.`);
	}
	return value as Record<string, unknown>;
}

function assertProtocol(
	value: unknown,
	id: string,
	version: string,
): void {
	const protocol = record(value, `${id} protocol`);
	if (
		Reflect.ownKeys(protocol).length !== 2 ||
		protocol.id !== id ||
		protocol.version !== version
	) {
		throw new Error(`${id} protocol is invalid.`);
	}
}

function assertCanonicalDigest(
	value: Record<string, unknown>,
	field: string,
	label: string,
): void {
	const digest = value[field];
	const body = {...value};
	delete body[field];
	if (digest !== canonicalJsonDigest(body)) {
		throw new Error(`${label} digest is invalid.`);
	}
}
