import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {
	changeTracePath,
	appendChangeTraceOperation,
	createChangeTraceOperation,
	parseChangeTrace,
	reduceChangeTrace,
	type ChangeTraceHeader,
} from "../../changes/trace/semantic-kernel.ts";
import {
	createGitCommandRunner,
	type GitCommandRunner,
} from "../../changes/trace/git-command.ts";
import {knowledgeEffectId} from "../../knowledge/materialization.ts";
import {
	createKbToWikiLegacyEquivalenceProof,
	createKbToWikiMigrationPlan,
	type CreateKbToWikiMigrationPlanInput,
	type KbToWikiMigrationPlan,
	type LegacyFacetInput,
	type LegacyRelationshipInput,
	type LegacyRetirementInput,
	type LegacySubjectInput,
	type RetentionStubHydration,
} from "../../knowledge/kb-to-wiki-migration.ts";
import {
	assertKbToWikiMigrationReceipt,
	createKbToWikiActiveProposalOperation,
	createKbToWikiMigrationReceipt,
	type KbToWikiMigrationReceipt,
	type MigrationActiveChangePlan,
	type MigrationProposalCommitPlan,
} from "../../knowledge/kb-to-wiki-receipt.ts";
import {
	validateKbToWikiMigrationCommit,
	type KbToWikiMigrationCommitValidation,
	type MigrationManagedRefTarget,
} from "../../knowledge/kb-to-wiki-git.ts";
import {
	resolveKnowledgeProjection,
	knowledgeTargetKey,
	type KnowledgeCheckpoint,
	type KnowledgeProjectionFile,
	type ResolvedKnowledgeCell,
} from "../../knowledge/state.ts";
import {
	assertGitOid,
	assertStableId,
	type GitOid,
	type GitObjectFormat,
} from "../../project/git-store-profile.ts";
import {sha256Base32Nfc} from "../../utils/base32.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	assertNfcString,
	semanticDigest,
} from "../../utils/semantic-digest.ts";
import {
	KB_TO_WIKI_TARGET_CONFIG_PATH as WIKI_CONFIG_PATH,
	KB_TO_WIKI_TARGET_CONFIG_PROTOCOL as SEMANTIC_KERNEL_WIKI_CONFIG_PROTOCOL,
	assertKbToWikiTargetBuild,
	bindKbToWikiMigrationStagingEvidence,
	stageKbToWikiConfiguration,
	type BindKbToWikiMigrationStagingEvidenceInput,
	type KbToWikiConfigurationMigration as ConfigurationMigration,
	type KbToWikiMigrationStagingEvidence,
	type KbToWikiStagedFile as StagedFile,
	type KbToWikiTargetBackendBuild as SemanticKernelBackendBuildBinding,
} from "./kb-to-wiki-staging-evidence.ts";

export const KB_TO_WIKI_MIGRATION_STAGE_PROTOCOL = Object.freeze({
	id: "codewiki.kb-to-wiki-migration-stage",
	version: "2.0.0",
} as const);

export const KB_TO_WIKI_MIGRATION_STAGE_IMPLEMENTATION_DIGEST = semanticDigest(
	"codewiki.kb-to-wiki-migration-stage-implementation@2.0.0",
	{operation: "stage-kb-to-wiki-migration"},
);

export interface KbToWikiConvertedTraceInput {
	readonly sourceTracePath: string;
	readonly targetBytes: string;
}

export interface StageKbToWikiMigrationInput
	extends BindKbToWikiMigrationStagingEvidenceInput {
	readonly migrationId: string;
	readonly projectId: string;
	readonly convertedTraces: readonly KbToWikiConvertedTraceInput[];
	readonly activeChangePlans: readonly MigrationActiveChangePlan[];
	readonly migrationCommit: MigrationProposalCommitPlan;
	readonly targetBackendBuild: SemanticKernelBackendBuildBinding;
}

export interface StagedKbToWikiMigration {
	readonly protocol: typeof KB_TO_WIKI_MIGRATION_STAGE_PROTOCOL;
	readonly evidence: KbToWikiMigrationStagingEvidence;
	readonly legacySource: CreateKbToWikiMigrationPlanInput;
	readonly plan: KbToWikiMigrationPlan;
	readonly receipt: KbToWikiMigrationReceipt;
	readonly targetBackendBuild: SemanticKernelBackendBuildBinding;
	readonly backupRef: string;
	readonly migrationCommit: GitOid;
	readonly activeManagedRefs: readonly MigrationManagedRefTarget[];
	readonly validation: KbToWikiMigrationCommitValidation;
	readonly stageDigest: Sha256Digest;
}

interface ConvertedTrace {
	readonly sourceTracePath: string;
	readonly targetPath: string;
	readonly targetBytes: string;
	readonly header: ChangeTraceHeader;
}

type CanonicalJsonRecord = {readonly [key: string]: CanonicalJsonValue};

interface PreparedMigration {
	readonly legacySource: CreateKbToWikiMigrationPlanInput;
	readonly plan: KbToWikiMigrationPlan;
	readonly converted: readonly ConvertedTrace[];
}

interface ReceiptClosure {
	readonly itemFiles: readonly StagedFile[];
	readonly convertedFiles: readonly StagedFile[];
	readonly configuration: ConfigurationMigration;
	readonly migrationPath: string;
	readonly migrationPredecessor: StagedFile;
	readonly receipt: KbToWikiMigrationReceipt;
}

/**
 * Write the exact migration object closure and backup ref without advancing the
 * canonical ref or any managed Change ref. The private backup must already exist.
 */
export async function stageKbToWikiMigration(
	input: StageKbToWikiMigrationInput,
): Promise<StagedKbToWikiMigration> {
	assertStableId(input.migrationId, "migrationId");
	assertStableId(input.projectId, "projectId");
	assertCommitPlan(input.migrationCommit, "Migration commit");
	assertKbToWikiTargetBuild(input.targetBackendBuild);
	const runner = input.runner ?? createGitCommandRunner();
	const evidenceBefore = await bindKbToWikiMigrationStagingEvidence({...input, runner});
	if (
		input.targetBackendBuild.backendBuildDigest ===
		evidenceBefore.sourceSnapshot.readiness.backendBuildDigest
	) {
		throw new Error("Migration target Backend Build did not change.");
	}
	const prepared = prepareMigration(input, evidenceBefore);
	const receiptClosure = await stageReceiptClosure(input, runner, evidenceBefore, prepared);
	const candidateCommit = await stageMigrationCandidate({
		input,
		runner,
		evidence: evidenceBefore,
		plan: prepared.plan,
		closure: receiptClosure,
	});
	const activeManagedRefs = await stageActiveProposals({
		repoRoot: input.repoRoot,
		runner,
		plan: prepared.plan,
		candidateCommit,
		converted: prepared.converted,
		activePlans: input.activeChangePlans,
	});
	const evidenceAfter = await bindKbToWikiMigrationStagingEvidence({...input, runner});
	if (evidenceAfter.evidenceDigest !== evidenceBefore.evidenceDigest) {
		throw new Error("Migration evidence changed while Git objects were staged.");
	}
	await createBackupRefCas({
		repoRoot: input.repoRoot,
		runner,
		canonicalRef: evidenceAfter.sourceSnapshot.readiness.profile.canonicalRef,
		backupRef: prepared.plan.source.backupRef,
		sourceCommit: prepared.plan.source.sourceCommit,
		managedRefs: input.activeChangePlans.map(({expectedManagedRef}) => expectedManagedRef),
	});
	const validation = await validateStagedClosure({
		input,
		runner,
		evidence: evidenceAfter,
		prepared,
		receipt: receiptClosure.receipt,
		candidateCommit,
		activeManagedRefs,
	});
	return stagedResult({
		evidence: evidenceAfter,
		prepared,
		receipt: receiptClosure.receipt,
		targetBackendBuild: input.targetBackendBuild,
		candidateCommit,
		activeManagedRefs,
		validation,
	});
}

export function assertStagedKbToWikiMigration(
	value: StagedKbToWikiMigration,
): void {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Staged KB-to-Wiki migration is invalid.");
	}
	const staged = value as StagedKbToWikiMigration;
	if (canonicalJson(staged.protocol) !== canonicalJson(KB_TO_WIKI_MIGRATION_STAGE_PROTOCOL)) {
		throw new Error("Staged KB-to-Wiki migration protocol is invalid.");
	}
	assertKbToWikiMigrationReceipt(staged.receipt);
	assertKbToWikiTargetBuild(staged.targetBackendBuild);
	if (
		staged.targetBackendBuild.backendBuildDigest !==
			staged.receipt.privateStatePlan.targetBackendBuildDigest
	) {
		throw new Error("Staged KB-to-Wiki target Backend Build binding is invalid.");
	}
	assertGitOid(
		staged.migrationCommit,
		"Staged migration commit",
		staged.plan.source.objectFormat,
	);
	const expectedDigest = migrationStageDigest({
		evidence: staged.evidence,
		plan: staged.plan,
		receipt: staged.receipt,
		candidateCommit: staged.migrationCommit,
		activeManagedRefs: staged.activeManagedRefs,
		validation: staged.validation,
	});
	if (staged.stageDigest !== expectedDigest) {
		throw new Error("Staged KB-to-Wiki migration digest does not replay.");
	}
}

function prepareMigration(
	input: StageKbToWikiMigrationInput,
	evidence: KbToWikiMigrationStagingEvidence,
): PreparedMigration {
	const legacySource = compileLegacySource(evidence, input.migrationId, input.projectId);
	const plan = createKbToWikiMigrationPlan(legacySource);
	const converted = validateConvertedTraces(evidence, plan, input.convertedTraces);
	assertActivePlans(evidence, plan, input.activeChangePlans, converted);
	return {legacySource, plan, converted};
}

async function stageReceiptClosure(
	input: StageKbToWikiMigrationInput,
	runner: GitCommandRunner,
	evidence: KbToWikiMigrationStagingEvidence,
	prepared: PreparedMigration,
): Promise<ReceiptClosure> {
	const {plan, converted, legacySource} = prepared;
	const configuration = await stageKbToWikiConfiguration({
		repoRoot: input.repoRoot,
		runner,
		readiness: evidence.sourceSnapshot.readiness,
	});
	const itemFiles = await hashFiles(
		input.repoRoot,
		runner,
		plan.items.map(({path, bytes}) => ({path, bytes})),
		plan.source.objectFormat,
	);
	const convertedFiles = await hashFiles(
		input.repoRoot,
		runner,
		converted.map(({targetPath: path, targetBytes: bytes}) => ({path, bytes})),
		plan.source.objectFormat,
	);
	const migrationPath = changeTracePath(plan.migrationChangeId);
	const migrationPredecessor = requiredFile(convertedFiles, migrationPath);
	const preTree = await buildTree({
		repoRoot: input.repoRoot,
		runner,
		base: plan.source.sourceCommit.hex,
		removePaths: legacyPaths(evidence),
		files: [...itemFiles, ...convertedFiles, configuration.target],
	});
	const wikiItemsTreeOid = plan.items.length === 0
		? null
		: gitOid(
			plan.source.objectFormat,
			await git(input.repoRoot, runner, ["rev-parse", `${preTree}:.codewiki/wiki/items`]),
		);
	const convertedTraceBlobOids = Object.fromEntries(
		convertedFiles.flatMap(({path, oid}) =>
			path === migrationPath ? [] : [[path, oid] as const]
		),
	);
	const receipt = createKbToWikiMigrationReceipt({
		plan,
		legacyEquivalence: createKbToWikiLegacyEquivalenceProof({plan, source: legacySource}),
		kernelBuildDigest: plan.source.sourceBuildDigest,
		migrationImplementationDigest: plan.source.implementationDigest,
		configurationPlan: {
			path: WIKI_CONFIG_PATH,
			sourceBlobOid: configuration.source.oid,
			sourceDigest: configuration.sourceDigest,
			targetBlobOid: configuration.target.oid,
			targetDigest: configuration.targetDigest,
			targetProtocol: SEMANTIC_KERNEL_WIKI_CONFIG_PROTOCOL,
		},
		privateStatePlan: {
			backupId: evidence.privateBackup.backupId,
			sourceGeneration: evidence.privateBackup.sourceStateGeneration,
			sourceStateDigest: evidence.privateBackup.sourceStateDigest,
			sourceBackendBuildDigest: evidence.privateBackup.sourceBackendBuildDigest,
			targetGeneration: evidence.privateBackup.sourceStateGeneration + 1,
			targetBackendBuildDigest: input.targetBackendBuild.backendBuildDigest,
		},
		wikiItemsTreeOid,
		itemBlobOids: oidMap(itemFiles),
		convertedTraceBlobOids,
		migrationTracePreOperationBlobOid: migrationPredecessor.oid,
		activeChangePlans: input.activeChangePlans,
	});
	return {
		itemFiles,
		convertedFiles,
		configuration,
		migrationPath,
		migrationPredecessor,
		receipt,
	};
}

async function stageMigrationCandidate(stage: {
	readonly input: StageKbToWikiMigrationInput;
	readonly runner: GitCommandRunner;
	readonly evidence: KbToWikiMigrationStagingEvidence;
	readonly plan: KbToWikiMigrationPlan;
	readonly closure: ReceiptClosure;
}): Promise<GitOid> {
	const {input, runner, evidence, plan, closure} = stage;
	const applied = createChangeTraceOperation({
		operationId: migrationOperationId(input.projectId, input.migrationId),
		kind: "migration.applied",
		authorityBearing: true,
		actorId: evidence.authority.actorId,
		authorityId: evidence.authority.authorityId,
		occurredAt: evidence.authority.approvedAt,
		payload: {
			migrationId: plan.migrationId,
			migrationIntentDigest: plan.migrationIntentDigest,
			receiptDigest: closure.receipt.receiptDigest,
		},
	});
	const migrationBytes = appendChangeTraceOperation(closure.migrationPredecessor.bytes, applied);
	const migrationBlobOid = await hashBlob(
		input.repoRoot,
		runner,
		migrationBytes,
		plan.source.objectFormat,
	);
	const traceFiles = closure.convertedFiles.map((file) =>
		file.path === closure.migrationPath
			? {...file, bytes: migrationBytes, oid: migrationBlobOid}
			: file
	);
	const candidateTree = await buildTree({
		repoRoot: input.repoRoot,
		runner,
		base: plan.source.sourceCommit.hex,
		removePaths: legacyPaths(evidence),
		files: [...traceFiles, ...closure.itemFiles, closure.configuration.target],
	});
	return writeCommit({
		repoRoot: input.repoRoot,
		runner,
		objectFormat: plan.source.objectFormat,
		tree: candidateTree,
		parent: plan.source.sourceCommit.hex,
		plan: input.migrationCommit,
	});
}

async function validateStagedClosure(input: {
	readonly input: StageKbToWikiMigrationInput;
	readonly runner: GitCommandRunner;
	readonly evidence: KbToWikiMigrationStagingEvidence;
	readonly prepared: PreparedMigration;
	readonly receipt: KbToWikiMigrationReceipt;
	readonly candidateCommit: GitOid;
	readonly activeManagedRefs: readonly MigrationManagedRefTarget[];
}): Promise<KbToWikiMigrationCommitValidation> {
	const {plan, legacySource} = input.prepared;
	try {
		await assertAuthoritativeRefsUnchanged(
			input.input.repoRoot,
			input.runner,
			input.evidence,
			input.input.activeChangePlans,
		);
		return await validateKbToWikiMigrationCommit({
			repoRoot: input.input.repoRoot,
			profile: input.evidence.sourceSnapshot.readiness.profile,
			plan,
			legacySource,
			candidateCommit: input.candidateCommit,
			receipt: input.receipt,
			activeManagedRefs: input.activeManagedRefs,
			runner: input.runner,
		});
	} catch (error) {
		await deleteBackupRefCas(
			input.input.repoRoot,
			input.runner,
			plan.source.backupRef,
			plan.source.sourceCommit,
		);
		throw error;
	}
}

function stagedResult(input: {
	readonly evidence: KbToWikiMigrationStagingEvidence;
	readonly prepared: PreparedMigration;
	readonly receipt: KbToWikiMigrationReceipt;
	readonly targetBackendBuild: SemanticKernelBackendBuildBinding;
	readonly candidateCommit: GitOid;
	readonly activeManagedRefs: readonly MigrationManagedRefTarget[];
	readonly validation: KbToWikiMigrationCommitValidation;
}): StagedKbToWikiMigration {
	const {plan, legacySource} = input.prepared;
	const stageDigest = migrationStageDigest({
		evidence: input.evidence,
		plan,
		receipt: input.receipt,
		candidateCommit: input.candidateCommit,
		activeManagedRefs: input.activeManagedRefs,
		validation: input.validation,
	});
	return Object.freeze({
		protocol: KB_TO_WIKI_MIGRATION_STAGE_PROTOCOL,
		evidence: input.evidence,
		legacySource,
		plan,
		receipt: input.receipt,
		targetBackendBuild: input.targetBackendBuild,
		backupRef: plan.source.backupRef,
		migrationCommit: input.candidateCommit,
		activeManagedRefs: input.activeManagedRefs,
		validation: input.validation,
		stageDigest,
	});
}

function migrationStageDigest(input: {
	readonly evidence: KbToWikiMigrationStagingEvidence;
	readonly plan: KbToWikiMigrationPlan;
	readonly receipt: KbToWikiMigrationReceipt;
	readonly candidateCommit: GitOid;
	readonly activeManagedRefs: readonly MigrationManagedRefTarget[];
	readonly validation: KbToWikiMigrationCommitValidation;
}): Sha256Digest {
	return canonicalJsonDigest({
		protocol: KB_TO_WIKI_MIGRATION_STAGE_PROTOCOL,
		evidenceDigest: input.evidence.evidenceDigest,
		migrationIntentDigest: input.plan.migrationIntentDigest,
		receiptDigest: input.receipt.receiptDigest,
		backupRef: input.plan.source.backupRef,
		migrationCommit: input.candidateCommit,
		activeManagedRefs: input.activeManagedRefs,
		validation: {
			sourceCommit: input.validation.sourceCommit,
			candidateCommit: input.validation.candidateCommit,
			wikiItemsTreeOid: input.validation.wikiItemsTreeOid,
			itemBlobOids: input.validation.itemBlobOids,
			changeTraceBlobOids: input.validation.changeTraceBlobOids,
			migrationTracePreOperationBlobOid:
				input.validation.migrationTracePreOperationBlobOid,
			configurationBlobOid: input.validation.configurationBlobOid,
		},
		targetBackendBuildDigest: input.receipt.privateStatePlan.targetBackendBuildDigest,
	});
}

function compileLegacySource(
	evidence: KbToWikiMigrationStagingEvidence,
	migrationId: string,
	projectId: string,
): CreateKbToWikiMigrationPlanInput {
	const {sourceSnapshot} = evidence;
	const subjects = compileSubjects(sourceSnapshot.knowledgeCheckpoint, projectId);
	const retirements = compileRetirements(evidence, projectId);
	const retentionStubs = compileRetentionStubs(evidence);
	const readiness = sourceSnapshot.readiness;
	return {
		migrationId,
		migrationChangeId: evidence.authority.migrationChangeId,
		projectId,
		source: {
			repositoryId: readiness.profile.repositoryId,
			objectFormat: readiness.profile.objectFormat,
			sourceCommit: readiness.sourceCommit,
			sourceBuildDigest: readiness.backendBuildDigest,
			sourceCheckpointDigest: sourceSnapshot.knowledgeCheckpoint.checkpointDigest,
			sourceStateDigest: sourceSnapshot.knowledgeCheckpoint.state.stateDigest,
			sourceProjectionDigest: sourceSnapshot.knowledgeCheckpoint.projection.projectionDigest,
			sourceTraceHeadDigest: sourceSnapshot.sourceTraceHeadDigest,
			authorityDigest: evidence.authority.authorityDigest,
			implementationDigest: KB_TO_WIKI_MIGRATION_STAGE_IMPLEMENTATION_DIGEST,
			quiescenceReceiptDigest: sourceSnapshot.quiescenceReceiptDigest,
			privateBackupDigest: evidence.privateBackup.backupId,
			backupRef: readiness.backupRef,
		},
		subjects,
		lexicons: [],
		retirements,
		retentionStubs,
	};
}

function compileSubjects(
	checkpoint: KnowledgeCheckpoint,
	projectId: string,
): readonly LegacySubjectInput[] {
	const resolved = resolveKnowledgeProjection(checkpoint.projection.files);
	const subjectCells = new Map(
		resolved.flatMap((cell) =>
			cell.target.facetId === undefined ? [[cell.target.subjectId, cell] as const] : []
		),
	);
	const pathBySubject = new Map(
		[...subjectCells].map(([subjectId, cell]) => [subjectId, cell.path]),
	);
	return checkpoint.projection.files.map((file) =>
		compileSubject({file, resolved, pathBySubject, projectId})
	).sort((left, right) => compareText(left.sourceId, right.sourceId));
}

function compileSubject(input: {
	readonly file: KnowledgeProjectionFile;
	readonly resolved: readonly ResolvedKnowledgeCell[];
	readonly pathBySubject: ReadonlyMap<string, string>;
	readonly projectId: string;
}): LegacySubjectInput {
	const subjectCell = input.resolved.find(
		(cell) => cell.path === input.file.path && cell.target.facetId === undefined,
	);
	if (subjectCell === undefined) {
		throw new Error(`Legacy Knowledge subject is missing for ${input.file.path}.`);
	}
	const root = semanticRoot(subjectCell.semanticValue, input.file.mediaType);
	const subjectId = subjectCell.target.subjectId;
	const title = stringField(root, "title") ?? subjectId;
	const type = stringField(root, "type") ?? "knowledge";
	const facets = input.resolved.flatMap((cell) =>
		cell.path === input.file.path && cell.target.facetId !== undefined
			? [legacyFacet(input.projectId, subjectId, title, cell)]
			: []
	);
	return {
		sourceId: input.file.path,
		codewikiId: subjectId,
		itemType: legacyNamespacedValue(type),
		title,
		body: wikiBody(
			input.file.mediaType === "text/markdown"
				? stringField(root, "body") ?? ""
				: input.file.bytes,
		),
		aliases: stringList(root.aliases),
		attributes: {
			"codewiki.legacy:source-path": input.file.path,
			"codewiki.legacy:media-type": input.file.mediaType,
			"codewiki.legacy:metadata": toCanonicalJsonValue(
				input.file.mediaType === "text/markdown"
					? recordField(root, "frontmatter") ?? {}
					: {},
			),
		},
		relationships: legacyRelationships(root, input.pathBySubject),
		provenance: [legacyProvenance(subjectId, input.file.path, subjectCell.digest)],
		facets,
		legacyRecordIds: [legacyRecordId(input.projectId, knowledgeTargetKey(subjectCell.target))],
		sourceDigest: subjectCell.digest,
	};
}

function legacyFacet(
	projectId: string,
	subjectId: string,
	title: string,
	cell: ReturnType<typeof resolveKnowledgeProjection>[number],
): LegacyFacetInput {
	const facetId = cell.target.facetId;
	if (facetId === undefined) throw new Error("Legacy facet identity is missing.");
	const semanticText = canonicalString(cell.semanticValue);
	return {
		key: facetId,
		itemType: "codewiki.legacy:facet",
		title: `${title} — ${facetId}`,
		body: wikiBody(semanticText ?? canonicalJson(cell.semanticValue)),
		attributes: {
			"codewiki.legacy:subject-id": subjectId,
			"codewiki.legacy:facet-id": facetId,
		},
		provenance: [legacyProvenance(subjectId, cell.path, cell.digest)],
		legacyRecordIds: [legacyRecordId(projectId, knowledgeTargetKey(cell.target))],
	};
}

function compileRetirements(
	evidence: KbToWikiMigrationStagingEvidence,
	projectId: string,
): readonly LegacyRetirementInput[] {
	const changesByEffect = new Map<string, string>();
	for (const change of evidence.sourceSnapshot.workState.changes) {
		if (change.record.change.knowledge.kind !== "effects") continue;
		for (const effect of change.record.change.knowledge.effects) {
			const effectId = knowledgeEffectId(effect);
			if (changesByEffect.has(effectId)) {
				throw new Error("Legacy Knowledge Effect maps to multiple Changes.");
			}
			changesByEffect.set(effectId, change.id);
		}
	}
	return evidence.sourceSnapshot.knowledgeCheckpoint.state.tombstones.map((tombstone) => {
		const targetKey = knowledgeTargetKey(tombstone.target);
		const retiredByChangeId = changesByEffect.get(tombstone.retiredByEffectId);
		if (retiredByChangeId === undefined) {
			throw new Error(`Legacy tombstone ${targetKey} lacks an owning Change.`);
		}
		const sourceDigest = canonicalJsonDigest(tombstone);
		return {
			sourceId: `retired/${targetKey}`,
			codewikiId: tombstone.target.facetId === undefined ? tombstone.target.subjectId : null,
			retiredByChangeId,
			sourceDigest,
			provenance: [legacyProvenance(tombstone.target.subjectId, targetKey, sourceDigest)],
			legacyRecordIds: [legacyRecordId(projectId, `retired:${targetKey}`)],
		};
	}).sort((left, right) => compareText(left.sourceId, right.sourceId));
}

function compileRetentionStubs(
	evidence: KbToWikiMigrationStagingEvidence,
): readonly RetentionStubHydration[] {
	return evidence.sourceSnapshot.traces.flatMap((trace) => {
		if (
			trace.retentionStub === null ||
			trace.restoreRef === null ||
			trace.restoredByteDigest === null
		) return [];
		return [{
			stubId: trace.retentionStub.traceId,
			restoreRef: trace.restoreRef,
			expectedDigest: trace.restoredByteDigest,
			restoredDigest: trace.restoredByteDigest,
			complete: trace.restoredBytes !== null,
		}];
	});
}

function validateConvertedTraces(
	evidence: KbToWikiMigrationStagingEvidence,
	plan: KbToWikiMigrationPlan,
	inputs: readonly KbToWikiConvertedTraceInput[],
): readonly ConvertedTrace[] {
	const sourcePaths = evidence.sourceSnapshot.traces.map(({path}) => path).sort(compareText);
	const actualPaths = inputs.map(({sourceTracePath}) => sourceTracePath).sort(compareText);
	if (canonicalJson(sourcePaths) !== canonicalJson(actualPaths)) {
		throw new Error("Converted Traces must cover every exact legacy Trace once.");
	}
	const seenSources = new Set<string>();
	const seenTargets = new Set<string>();
	const converted = inputs.map((input) => {
		if (seenSources.has(input.sourceTracePath)) {
			throw new Error("Converted legacy Trace paths must be unique.");
		}
		seenSources.add(input.sourceTracePath);
		const source = evidence.sourceSnapshot.traces.find(({path}) => path === input.sourceTracePath);
		if (source === undefined) throw new Error("Converted Trace references unknown legacy source.");
		assertNfcString(input.targetBytes, "Converted Trace bytes", 1, 16 * 1024 * 1024);
		const trace = parseChangeTrace(input.targetBytes);
		reduceChangeTrace(trace);
		const workStateChange = evidence.sourceSnapshot.workState.changes.find(
			(change) => change.traceId === source.records[0]?.traceId,
		);
		if (workStateChange === undefined || trace.header.changeId !== workStateChange.id) {
			throw new Error("Converted Trace identity does not match its legacy Change.");
		}
		if (
			trace.header.projectId !== plan.projectId ||
			trace.header.repositoryId !== plan.source.repositoryId ||
			trace.header.objectFormat !== plan.source.objectFormat
		) {
			throw new Error("Converted Trace header does not match migration source.");
		}
		const targetPath = changeTracePath(trace.header.changeId);
		if (seenTargets.has(targetPath)) throw new Error("Converted target Trace paths must be unique.");
		seenTargets.add(targetPath);
		return {sourceTracePath: input.sourceTracePath, targetPath, targetBytes: input.targetBytes, header: trace.header};
	}).sort((left, right) => compareText(left.targetPath, right.targetPath));
	if (!converted.some(({targetPath}) => targetPath === changeTracePath(plan.migrationChangeId))) {
		throw new Error("Migration authority requires one converted target Trace.");
	}
	return converted;
}

function assertActivePlans(
	evidence: KbToWikiMigrationStagingEvidence,
	plan: KbToWikiMigrationPlan,
	activePlans: readonly MigrationActiveChangePlan[],
	converted: readonly ConvertedTrace[],
): void {
	const expected = [...evidence.sourceSnapshot.activeChangeIds].sort(compareText);
	const actual = activePlans.map(({changeId}) => changeId);
	if (canonicalJson(actual) !== canonicalJson(expected)) {
		throw new Error("Active Change plans must exactly cover sorted legacy active Changes.");
	}
	const placeholder = gitOid(
		plan.source.objectFormat,
		"0".repeat(plan.source.objectFormat === "sha1" ? 40 : 64),
	);
	for (const activePlan of activePlans) {
		const source = converted.find(({header}) => header.changeId === activePlan.changeId);
		if (source === undefined) throw new Error("Active Change plan lacks a converted Trace.");
		const operation = createKbToWikiActiveProposalOperation({
			plan: activePlan,
			migrationPlan: plan,
			candidateCommit: placeholder,
			traceHeader: source.header,
		});
		reduceChangeTrace(parseChangeTrace(appendChangeTraceOperation(source.targetBytes, operation)));
	}
}

async function stageActiveProposals(input: {
	readonly repoRoot: string;
	readonly runner: GitCommandRunner;
	readonly plan: KbToWikiMigrationPlan;
	readonly candidateCommit: GitOid;
	readonly converted: readonly ConvertedTrace[];
	readonly activePlans: readonly MigrationActiveChangePlan[];
}): Promise<readonly MigrationManagedRefTarget[]> {
	const targets: MigrationManagedRefTarget[] = [];
	for (const activePlan of input.activePlans) {
		const converted = input.converted.find(({header}) => header.changeId === activePlan.changeId);
		if (converted === undefined) throw new Error("Active Change converted Trace is missing.");
		const operation = createKbToWikiActiveProposalOperation({
			plan: activePlan,
			migrationPlan: input.plan,
			candidateCommit: input.candidateCommit,
			traceHeader: converted.header,
		});
		const candidateTrace = await git(
			input.repoRoot,
			input.runner,
			["show", `${input.candidateCommit.hex}:${converted.targetPath}`],
			{trim: false},
		);
		const traceBytes = appendChangeTraceOperation(candidateTrace, operation);
		const proposalFiles = await hashFiles(
			input.repoRoot,
			input.runner,
			[
				{path: converted.targetPath, bytes: traceBytes},
				...activePlan.proposedWiki.flatMap((file) =>
					file.bytes === null ? [] : [{path: file.path, bytes: file.bytes}],
				),
			],
			input.plan.source.objectFormat,
		);
		const tree = await buildTree({
			repoRoot: input.repoRoot,
			runner: input.runner,
			base: input.candidateCommit.hex,
			removePaths: activePlan.proposedWiki.flatMap((file) => file.bytes === null ? [file.path] : []),
			files: proposalFiles,
		});
		const proposalCommit = await writeCommit({
			repoRoot: input.repoRoot,
			runner: input.runner,
			objectFormat: input.plan.source.objectFormat,
			tree,
			parent: input.candidateCommit.hex,
			plan: activePlan.commit,
		});
		targets.push({changeId: activePlan.changeId, proposalCommit});
	}
	return Object.freeze(targets);
}

async function hashFiles(
	repoRoot: string,
	runner: GitCommandRunner,
	files: readonly {readonly path: string; readonly bytes: string}[],
	objectFormat: GitObjectFormat,
): Promise<readonly StagedFile[]> {
	const result: StagedFile[] = [];
	const seen = new Set<string>();
	for (const file of files) {
		if (seen.has(file.path)) throw new Error(`Staged path ${file.path} is duplicated.`);
		seen.add(file.path);
		result.push({
			...file,
			oid: await hashBlob(repoRoot, runner, file.bytes, objectFormat),
		});
	}
	return result.sort((left, right) => compareText(left.path, right.path));
}

async function hashBlob(
	repoRoot: string,
	runner: GitCommandRunner,
	bytes: string,
	objectFormat: GitObjectFormat,
): Promise<GitOid> {
	return gitOid(
		objectFormat,
		await git(repoRoot, runner, ["hash-object", "-w", "--stdin"], {input: bytes}),
	);
}

async function buildTree(input: {
	readonly repoRoot: string;
	readonly runner: GitCommandRunner;
	readonly base: string;
	readonly removePaths: readonly string[];
	readonly files: readonly StagedFile[];
}): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "codewiki-kb-to-wiki-index-"));
	const indexPath = join(directory, "index");
	const environment = {GIT_INDEX_FILE: indexPath};
	try {
		await git(input.repoRoot, input.runner, ["read-tree", input.base], {environment});
		for (const path of [...new Set(input.removePaths)].sort(compareText)) {
			await git(
				input.repoRoot,
				input.runner,
				["update-index", "--force-remove", "--", path],
				{environment},
			);
		}
		for (const file of input.files) {
			await git(
				input.repoRoot,
				input.runner,
				["update-index", "--add", "--cacheinfo", `100644,${file.oid.hex},${file.path}`],
				{environment},
			);
		}
		return await git(input.repoRoot, input.runner, ["write-tree"], {environment});
	} finally {
		await rm(directory, {recursive: true, force: true});
	}
}

async function writeCommit(input: {
	readonly repoRoot: string;
	readonly runner: GitCommandRunner;
	readonly objectFormat: GitObjectFormat;
	readonly tree: string;
	readonly parent: string;
	readonly plan: MigrationProposalCommitPlan;
}): Promise<GitOid> {
	assertCommitPlan(input.plan, "Staged commit");
	const bytes = `tree ${input.tree}\nparent ${input.parent}\nauthor ${input.plan.author}\ncommitter ${input.plan.committer}\n\n${input.plan.message}`;
	return gitOid(
		input.objectFormat,
		await git(
			input.repoRoot,
			input.runner,
			["hash-object", "-t", "commit", "-w", "--stdin"],
			{input: bytes},
		),
	);
}

async function createBackupRefCas(input: {
	readonly repoRoot: string;
	readonly runner: GitCommandRunner;
	readonly canonicalRef: string;
	readonly backupRef: string;
	readonly sourceCommit: GitOid;
	readonly managedRefs: readonly string[];
}): Promise<void> {
	if (input.canonicalRef.length === 0) throw new Error("Migration backup ref disagrees with readiness.");
	const zero = "0".repeat(input.sourceCommit.algorithm === "sha1" ? 40 : 64);
	const commands = [
		"start",
		`verify ${input.canonicalRef} ${input.sourceCommit.hex}`,
		...input.managedRefs.map((ref) => `verify ${ref} ${zero}`),
		`create ${input.backupRef} ${input.sourceCommit.hex}`,
		"prepare",
		"commit",
		"",
	].join("\n");
	await git(input.repoRoot, input.runner, ["update-ref", "--stdin"], {input: commands});
}

async function deleteBackupRefCas(
	repoRoot: string,
	runner: GitCommandRunner,
	backupRef: string,
	sourceCommit: GitOid,
): Promise<void> {
	await git(repoRoot, runner, ["update-ref", "-d", backupRef, sourceCommit.hex]);
}

async function assertAuthoritativeRefsUnchanged(
	repoRoot: string,
	runner: GitCommandRunner,
	evidence: KbToWikiMigrationStagingEvidence,
	activePlans: readonly MigrationActiveChangePlan[],
): Promise<void> {
	const readiness = evidence.sourceSnapshot.readiness;
	const canonical = await git(repoRoot, runner, ["rev-parse", "--verify", readiness.profile.canonicalRef]);
	if (canonical !== readiness.sourceCommit.hex) {
		throw new Error("Canonical ref changed while migration objects were staged.");
	}
	const managed = await git(repoRoot, runner, ["for-each-ref", "--format=%(refname)", "refs/codewiki/changes"]);
	if (managed.length > 0 || activePlans.some(({expectedManagedRef}) => managed.includes(expectedManagedRef))) {
		throw new Error("Managed Change refs advanced while migration objects were staged.");
	}
}

function legacyRelationships(
	root: CanonicalJsonRecord,
	pathBySubject: ReadonlyMap<string, string>,
): readonly LegacyRelationshipInput[] {
	const relationships = root.codewiki_relationships;
	if (!Array.isArray(relationships)) return [];
	return relationships.map((value) => {
		const relationship = canonicalRecord(value);
		if (relationship === null) throw new Error("Legacy Knowledge relationship must be an object.");
		const type = stringField(relationship, "type");
		const target = stringField(relationship, "target");
		if (type === null || target === null) throw new Error("Legacy Knowledge relationship is incomplete.");
		const targetSourceId = pathBySubject.get(target);
		if (targetSourceId === undefined) throw new Error(`Legacy relationship target ${target} is unresolved.`);
		return {
			predicate: legacyNamespacedValue(type),
			targetSourceId,
			attributes: {"codewiki.legacy:relationship": relationship},
		};
	});
}

function semanticRoot(
	value: CanonicalJsonValue,
	mediaType: string,
): CanonicalJsonRecord {
	const root = canonicalRecord(value);
	if (root === null) throw new Error("Legacy Knowledge semantic root must be an object.");
	if (mediaType !== "text/markdown") return root;
	const frontmatter = recordField(root, "frontmatter");
	return {...(frontmatter ?? {}), body: root.body ?? null, frontmatter: frontmatter ?? {}};
}

function canonicalRecord(value: CanonicalJsonValue): CanonicalJsonRecord | null {
	if (value === null || Array.isArray(value)) return null;
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return null;
	// SAFETY: canonical JSON permits only plain/null-prototype objects after primitive/array exclusion.
	return value as CanonicalJsonRecord;
}

function recordField(
	value: CanonicalJsonRecord,
	field: string,
): CanonicalJsonRecord | null {
	const entry = value[field];
	return entry === undefined ? null : canonicalRecord(entry);
}

function canonicalString(value: CanonicalJsonValue | undefined): string | null {
	if (value === undefined || Object.prototype.toString.call(value) !== "[object String]") {
		return null;
	}
	// SAFETY: CanonicalJsonValue excludes boxed strings; the exact tag proves primitive string.
	return value as string;
}

function stringField(value: CanonicalJsonRecord, field: string): string | null {
	return canonicalString(value[field]);
}

function stringList(value: CanonicalJsonValue | undefined): readonly string[] {
	if (!Array.isArray(value) || value.some((entry) => canonicalString(entry) === null)) return [];
	// SAFETY: every canonical array entry was proven to be a primitive string above.
	return value as readonly string[];
}

function legacyNamespacedValue(value: string): string {
	const slug = value.normalize("NFC").toLowerCase().replace(/[^a-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
	return `codewiki.legacy:${slug || "value"}`;
}

function wikiBody(value: string): string {
	return value.endsWith("\n") ? value.slice(0, -1) : value;
}

function legacyRecordId(projectId: string, source: string): string {
	return `cw:${projectId}:legacy-record:${sha256Base32Nfc(source, "legacy record identity")}`;
}

function legacyProvenance(
	subjectId: string,
	path: string,
	digest: Sha256Digest,
) {
	return {
		kind: "codewiki.legacy:knowledge",
		subjectId,
		attributes: {
			"codewiki.legacy:source-path": path,
			"codewiki.legacy:source-digest": digest,
		},
	};
}

function migrationOperationId(projectId: string, migrationId: string): string {
	return `cw:${projectId}:migration-operation:${sha256Base32Nfc(migrationId, "migration operation identity")}`;
}

function legacyPaths(evidence: KbToWikiMigrationStagingEvidence): readonly string[] {
	return [
		...evidence.sourceSnapshot.knowledgeFiles.map(({path}) => `.codewiki/kb/${path}`),
		...evidence.sourceSnapshot.traces.map(({path}) => path),
	];
}

function requiredFile(files: readonly StagedFile[], path: string): StagedFile {
	const file = files.find((candidate) => candidate.path === path);
	if (file === undefined) throw new Error(`Required staged file ${path} is missing.`);
	return file;
}

function oidMap(files: readonly StagedFile[]): Readonly<Record<string, GitOid>> {
	return Object.fromEntries(files.map(({path, oid}) => [path, oid]));
}

function gitOid(objectFormat: GitObjectFormat, hex: string): GitOid {
	const oid = {algorithm: objectFormat, hex: hex.trim()};
	assertGitOid(oid, "Staged Git OID", objectFormat);
	return Object.freeze(oid);
}

function assertCommitPlan(plan: MigrationProposalCommitPlan, field: string): void {
	for (const [name, value] of [["author", plan.author], ["committer", plan.committer]] as const) {
		if (!/^[^\r\n<>]+ <[^\r\n<>]+> [0-9]+ [+-][0-9]{4}$/u.test(value)) {
			throw new Error(`${field} ${name} is not an exact Git identity.`);
		}
	}
	assertNfcString(plan.message, `${field} message`, 1, 16_384);
	if (plan.message.includes("\r") || !plan.message.endsWith("\n")) {
		throw new Error(`${field} message must use LF and end with LF.`);
	}
}

async function git(
	repoRoot: string,
	runner: GitCommandRunner,
	args: readonly string[],
	options: {
		readonly trim?: boolean;
		readonly input?: string;
		readonly environment?: Readonly<Record<string, string>>;
	} = {},
): Promise<string> {
	const result = await runner({
		repoRoot,
		args,
		input: options.input,
		environment: options.environment,
	});
	if (result.exitCode !== 0) {
		throw new Error(`Git ${args[0] ?? "command"} failed: ${result.stderr.trim()}`);
	}
	return options.trim === false ? result.stdout : result.stdout.trim();
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
