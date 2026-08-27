import type {CanonicalJsonValue, Sha256Digest} from "../utils/canonical-json.ts";
import {sha256Base32Nfc} from "../utils/base32.ts";
import {assertRequiredExactKeys as assertExactKeys} from "../utils/json.ts";
import {
	assertNfcString,
	canonicalSemanticJson,
	semanticDigest,
} from "../utils/semantic-digest.ts";
import {
	assertCanonicalRef,
	assertGitOid,
	assertStableId,
	type GitObjectFormat,
	type GitOid,
} from "../project/git-store-profile.ts";
import {
	createWikiItem,
	generatedWikiItemPath,
	serializeWikiItemFile,
	type WikiItem,
	type WikiProvenanceRef,
} from "./wiki-item.ts";
import {validateWikiTree} from "./wiki-tree.ts";

export const KB_TO_WIKI_MIGRATION_PROTOCOL =
	"codewiki.kb-to-wiki-migration@1.0.0" as const;
export const KB_TO_WIKI_MIGRATION_INTENT_PROTOCOL =
	"codewiki.kb-to-wiki-migration-intent@1.0.0" as const;
export const KB_TO_WIKI_LEGACY_EQUIVALENCE_PROTOCOL =
	"codewiki.kb-to-wiki-legacy-equivalence@1.0.0" as const;

export interface KbToWikiSourceBinding {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly sourceCommit: GitOid;
	readonly sourceBuildDigest: Sha256Digest;
	readonly sourceCheckpointDigest: Sha256Digest;
	readonly sourceStateDigest: Sha256Digest;
	readonly sourceProjectionDigest: Sha256Digest;
	readonly sourceTraceHeadDigest: Sha256Digest;
	readonly authorityDigest: Sha256Digest;
	readonly implementationDigest: Sha256Digest;
	readonly quiescenceReceiptDigest: Sha256Digest;
	readonly privateBackupDigest: Sha256Digest;
	readonly backupRef: string;
}

export interface LegacyRelationshipInput {
	readonly predicate: string;
	readonly targetSourceId: string;
	readonly attributes?: Readonly<Record<string, CanonicalJsonValue>>;
}

export interface LegacyFacetInput {
	readonly key: string;
	readonly itemType: string;
	readonly title: string;
	readonly body: string;
	readonly aliases?: readonly string[];
	readonly attributes?: Readonly<Record<string, CanonicalJsonValue>>;
	readonly provenance?: readonly WikiProvenanceRef[];
	readonly legacyRecordIds: readonly string[];
}

export interface LegacySubjectInput {
	readonly sourceId: string;
	readonly codewikiId: string | null;
	readonly itemType: string;
	readonly title: string;
	readonly body: string;
	readonly aliases?: readonly string[];
	readonly attributes?: Readonly<Record<string, CanonicalJsonValue>>;
	readonly relationships?: readonly LegacyRelationshipInput[];
	readonly provenance?: readonly WikiProvenanceRef[];
	readonly facets?: readonly LegacyFacetInput[];
	readonly legacyRecordIds: readonly string[];
	readonly sourceDigest: Sha256Digest;
}

export interface LegacyLexiconTermInput {
	readonly term: string;
	readonly definition: string;
	readonly aliases: readonly string[];
	readonly ownerSourceId: string | null;
	readonly legacyRecordId: string;
}

export interface LegacyLexiconInput {
	readonly sourceId: string;
	readonly sourceDigest: Sha256Digest;
	readonly terms: readonly LegacyLexiconTermInput[];
}

export interface LegacyRetirementInput {
	readonly sourceId: string;
	readonly codewikiId: string | null;
	readonly retiredByChangeId: string;
	readonly provenance?: readonly WikiProvenanceRef[];
	readonly legacyRecordIds: readonly string[];
	readonly sourceDigest: Sha256Digest;
}

export interface RetentionStubHydration {
	readonly stubId: string;
	readonly restoreRef: string;
	readonly expectedDigest: Sha256Digest;
	readonly restoredDigest: Sha256Digest;
	readonly complete: boolean;
}

export interface MigrationIdentityMapEntry {
	readonly sourceKind: "subject" | "facet" | "lexicon_term";
	readonly sourceId: string;
	readonly targetItemId: string;
}

export interface MigrationPathMapEntry {
	readonly itemId: string;
	readonly path: string;
}

export interface LegacyRecordMapEntry {
	readonly sourceRecordId: string;
	readonly targetItemId: string;
	readonly sourceOrder: number;
}

export interface MigrationProvenanceMapEntry {
	readonly sourceId: string;
	readonly targetItemId: string;
	readonly provenance: readonly WikiProvenanceRef[];
}

export interface MigrationRetirementMapEntry {
	readonly sourceId: string;
	readonly targetItemId: string;
	readonly retiredByChangeId: string;
	readonly sourceDigest: Sha256Digest;
	readonly provenance: readonly WikiProvenanceRef[];
}

export interface PlannedMigrationItem {
	readonly sourceId: string;
	readonly sourceDigest: Sha256Digest;
	readonly item: WikiItem;
	readonly path: string;
	readonly bytes: string;
}

export interface KbToWikiMigrationPlan {
	readonly protocol: typeof KB_TO_WIKI_MIGRATION_PROTOCOL;
	readonly migrationId: string;
	readonly migrationChangeId: string;
	readonly projectId: string;
	readonly dryRun: true;
	readonly source: KbToWikiSourceBinding;
	readonly retentionStubs: readonly RetentionStubHydration[];
	readonly itemIdentityMap: readonly MigrationIdentityMapEntry[];
	readonly pathMap: readonly MigrationPathMapEntry[];
	readonly provenanceMap: readonly MigrationProvenanceMapEntry[];
	readonly retirementMap: readonly MigrationRetirementMapEntry[];
	readonly legacyRecordMap: readonly LegacyRecordMapEntry[];
	readonly items: readonly PlannedMigrationItem[];
	readonly omittedLexiconSourceIds: readonly string[];
	readonly migrationIntentDigest: Sha256Digest;
}

export interface CreateKbToWikiMigrationPlanInput {
	readonly migrationId: string;
	readonly migrationChangeId: string;
	readonly projectId: string;
	readonly source: KbToWikiSourceBinding;
	readonly subjects: readonly LegacySubjectInput[];
	readonly lexicons?: readonly LegacyLexiconInput[];
	readonly retirements?: readonly LegacyRetirementInput[];
	readonly retentionStubs?: readonly RetentionStubHydration[];
}

export interface KbToWikiLegacyEquivalenceProof {
	readonly protocol: typeof KB_TO_WIKI_LEGACY_EQUIVALENCE_PROTOCOL;
	readonly migrationId: string;
	readonly sourceSemanticDigest: Sha256Digest;
	readonly migrationPlanDigest: Sha256Digest;
	readonly subjectCount: number;
	readonly facetCount: number;
	readonly relationshipCount: number;
	readonly lexiconTermCount: number;
	readonly retirementCount: number;
	readonly legacyRecordCount: number;
	readonly targetItemCount: number;
	readonly proofDigest: Sha256Digest;
}

export function assertSemanticRootState(input: {
	readonly hasKbRoot: boolean;
	readonly hasWikiRoot: boolean;
	readonly activeReader: "legacy" | "kernel";
}): "empty" | "legacy" | "kernel" {
	if (input.hasKbRoot && input.hasWikiRoot) {
		throw new Error("Legacy KB and target Wiki roots cannot coexist.");
	}
	if (input.activeReader === "legacy" && input.hasWikiRoot) {
		throw new Error("Legacy reader must refuse target Wiki protocols.");
	}
	if (input.activeReader === "kernel" && input.hasKbRoot) {
		throw new Error("Kernel reader must refuse active legacy KB authority.");
	}
	if (input.hasKbRoot) return "legacy";
	if (input.hasWikiRoot) return "kernel";
	return "empty";
}

export function createKbToWikiMigrationPlan(
	input: CreateKbToWikiMigrationPlanInput,
): KbToWikiMigrationPlan {
	assertStableId(input.migrationId, "migrationId");
	assertMigrationChangeId(input.migrationChangeId);
	assertStableId(input.projectId, "projectId");
	assertSourceBinding(input.source);
	assertRetentionStubsHydrated(input.retentionStubs ?? []);
	if (input.subjects.length > 100_000) throw new Error("Migration subject limit exceeded.");
	const sourceIds = new Set<string>();
	for (const subject of input.subjects) {
		assertSourceId(subject.sourceId, "subject sourceId");
		if (sourceIds.has(subject.sourceId)) throw new Error("Legacy semantic source IDs must be unique.");
		sourceIds.add(subject.sourceId);
	}
	for (const retirement of input.retirements ?? []) {
		assertSourceId(retirement.sourceId, "retirement sourceId");
		if (sourceIds.has(retirement.sourceId)) throw new Error("Legacy semantic source IDs must be unique.");
		sourceIds.add(retirement.sourceId);
	}
	for (const lexicon of input.lexicons ?? []) {
		assertSourceId(lexicon.sourceId, "lexicon sourceId");
		if (sourceIds.has(lexicon.sourceId)) throw new Error("Legacy semantic source IDs must be unique.");
		sourceIds.add(lexicon.sourceId);
	}
	const identityMap: MigrationIdentityMapEntry[] = [];
	const subjectItemIds = new Map<string, string>();
	const usedItemIds = new Set<string>();
	for (const subject of input.subjects) {
		const itemId = legacySubjectItemId(input.projectId, subject);
		claimItemId(usedItemIds, itemId);
		subjectItemIds.set(subject.sourceId, itemId);
		identityMap.push({sourceKind: "subject", sourceId: subject.sourceId, targetItemId: itemId});
	}
	const retirementMap: MigrationRetirementMapEntry[] = [];
	for (const retirement of input.retirements ?? []) {
		assertDigest(retirement.sourceDigest, "retirement sourceDigest");
		assertChangeId(retirement.retiredByChangeId, "retiredByChangeId");
		const targetItemId = legacyItemId(
			input.projectId,
			retirement.sourceId,
			retirement.codewikiId,
		);
		claimItemId(usedItemIds, targetItemId);
		const provenance = Object.freeze([...(retirement.provenance ?? [])]);
		assertProvenance(targetItemId, provenance);
		retirementMap.push(Object.freeze({
			sourceId: retirement.sourceId,
			targetItemId,
			retiredByChangeId: retirement.retiredByChangeId,
			sourceDigest: retirement.sourceDigest,
			provenance,
		}));
	}
	const lexiconTermsByOwner = new Map<string, LegacyLexiconTermInput[]>();
	const unownedTerms: Array<{lexicon: LegacyLexiconInput; term: LegacyLexiconTermInput}> = [];
	const omittedLexiconSourceIds: string[] = [];
	for (const lexicon of input.lexicons ?? []) {
		assertSourceId(lexicon.sourceId, "lexicon sourceId");
		assertDigest(lexicon.sourceDigest, "lexicon sourceDigest");
		omittedLexiconSourceIds.push(lexicon.sourceId);
		for (const term of lexicon.terms) {
			assertNfcString(term.term, "lexicon term", 1, 1024);
			assertNfcString(term.definition, "lexicon definition", 1, 16_384);
			if (term.ownerSourceId === null) {
				unownedTerms.push({lexicon, term});
				continue;
			}
			if (!subjectItemIds.has(term.ownerSourceId)) {
				throw new Error(`Lexicon owner ${term.ownerSourceId} does not resolve uniquely.`);
			}
			const existing = lexiconTermsByOwner.get(term.ownerSourceId) ?? [];
			existing.push(term);
			lexiconTermsByOwner.set(term.ownerSourceId, existing);
		}
	}
	const planned: PlannedMigrationItem[] = [];
	const provenanceMap: MigrationProvenanceMapEntry[] = [];
	const legacyRecordMap: LegacyRecordMapEntry[] = [];
	let sourceOrder = 0;
	for (const subject of input.subjects) {
		assertDigest(subject.sourceDigest, "subject sourceDigest");
		const itemId = requiredMapValue(subjectItemIds, subject.sourceId);
		const ownerTerms = lexiconTermsByOwner.get(subject.sourceId) ?? [];
		const attributes = {...(subject.attributes ?? {})};
		if (ownerTerms.length > 0) {
			attributes["codewiki.legacy:terms"] = ownerTerms.map((term) => ({
				term: term.term,
				definition: term.definition,
				aliases: [...term.aliases],
			}));
		}
		const aliases = sortedUnique([
			...(subject.aliases ?? []),
			...ownerTerms.flatMap((term) => [term.term, ...term.aliases]),
		]);
		const relationships = (subject.relationships ?? []).map((relationship) => ({
			predicate: relationship.predicate,
			targetItemId: requiredMapValue(subjectItemIds, relationship.targetSourceId),
			attributes: relationship.attributes ?? {},
		}));
		const item = createWikiItem({
			itemId,
			itemType: subject.itemType,
			title: subject.title,
			body: subject.body,
			aliases,
			attributes,
			relationships,
			provenance: subject.provenance ?? [],
		});
		planned.push(planItem(subject.sourceId, subject.sourceDigest, item));
		provenanceMap.push(provenanceMapEntry(subject.sourceId, item));
		for (const recordId of subject.legacyRecordIds) {
			legacyRecordMap.push(recordMap(recordId, itemId, sourceOrder++));
		}
		for (const facet of subject.facets ?? []) {
			assertSourceId(facet.key, "facet key");
			const facetSourceId = `${subject.sourceId}\0${facet.key}`;
			const facetItemId = `cw:${input.projectId}:item:${sha256Base32Nfc(facetSourceId, "facet identity")}`;
			claimItemId(usedItemIds, facetItemId);
			identityMap.push({sourceKind: "facet", sourceId: facetSourceId, targetItemId: facetItemId});
			const facetItem = createWikiItem({
				itemId: facetItemId,
				itemType: facet.itemType,
				title: facet.title,
				body: facet.body,
				aliases: sortedUnique(facet.aliases ?? []),
				attributes: facet.attributes ?? {},
				relationships: [{
					predicate: "codewiki.legacy:facet-of",
					targetItemId: itemId,
					attributes: {},
				}],
				provenance: facet.provenance ?? [],
			});
			planned.push(planItem(facetSourceId, subject.sourceDigest, facetItem));
			provenanceMap.push(provenanceMapEntry(facetSourceId, facetItem));
			for (const recordId of facet.legacyRecordIds) {
				legacyRecordMap.push(recordMap(recordId, facetItemId, sourceOrder++));
			}
		}
	}
	for (const {lexicon, term} of unownedTerms) {
		const sourceId = `${lexicon.sourceId}\0${term.term}`;
		const itemId = `cw:${input.projectId}:item:${sha256Base32Nfc(sourceId, "lexicon term identity")}`;
		claimItemId(usedItemIds, itemId);
		identityMap.push({sourceKind: "lexicon_term", sourceId, targetItemId: itemId});
		const item = createWikiItem({
			itemId,
			itemType: "codewiki.term",
			title: term.term,
			body: term.definition,
			aliases: sortedUnique(term.aliases),
		});
		planned.push(planItem(sourceId, lexicon.sourceDigest, item));
		provenanceMap.push(provenanceMapEntry(sourceId, item));
	}
	for (const lexicon of input.lexicons ?? []) {
		for (const term of lexicon.terms) {
			const targetItemId = term.ownerSourceId === null
				? identityMap.find(
					(entry) => entry.sourceId === `${lexicon.sourceId}\0${term.term}`,
				)?.targetItemId
				: subjectItemIds.get(term.ownerSourceId);
			if (targetItemId === undefined) {
				throw new Error(`Lexicon term ${term.term} has no mapped target Item.`);
			}
			legacyRecordMap.push(recordMap(term.legacyRecordId, targetItemId, sourceOrder++));
		}
	}
	for (const retirement of input.retirements ?? []) {
		const targetItemId = retirementMap.find(
			(entry) => entry.sourceId === retirement.sourceId,
		)?.targetItemId;
		if (targetItemId === undefined) {
			throw new Error(`Retirement ${retirement.sourceId} has no mapped target Item ID.`);
		}
		for (const recordId of retirement.legacyRecordIds) {
			legacyRecordMap.push(recordMap(recordId, targetItemId, sourceOrder++));
		}
	}
	validateWikiTree(
		planned.map(({path, bytes}) => ({path, bytes})),
		{retiredItemIds: retirementMap.map(({targetItemId}) => targetItemId)},
	);
	const pathMap = planned.map(({item, path}) => ({itemId: item.itemId, path}));
	const intent = migrationIntent(input.source, identityMap, pathMap);
	const plan = Object.freeze({
		protocol: KB_TO_WIKI_MIGRATION_PROTOCOL,
		migrationId: input.migrationId,
		migrationChangeId: input.migrationChangeId,
		projectId: input.projectId,
		dryRun: true,
		source: Object.freeze({...input.source}),
		retentionStubs: Object.freeze([...(input.retentionStubs ?? [])]),
		itemIdentityMap: Object.freeze(identityMap),
		pathMap: Object.freeze(pathMap),
		provenanceMap: Object.freeze(provenanceMap),
		retirementMap: Object.freeze(retirementMap),
		legacyRecordMap: Object.freeze(legacyRecordMap),
		items: Object.freeze(planned),
		omittedLexiconSourceIds: Object.freeze(omittedLexiconSourceIds),
		migrationIntentDigest: semanticDigest(KB_TO_WIKI_MIGRATION_INTENT_PROTOCOL, intent),
	});
	verifyKbToWikiMigrationPlan(plan);
	return plan;
}

export function assertRetentionStubsHydrated(
	stubs: readonly RetentionStubHydration[],
): void {
	const ids = new Set<string>();
	for (const stub of stubs) {
		assertStableId(stub.stubId, "retention stub ID");
		if (ids.has(stub.stubId)) throw new Error("Retention stub IDs must be unique.");
		ids.add(stub.stubId);
		assertCanonicalRef(stub.restoreRef);
		assertDigest(stub.expectedDigest, "retention stub expectedDigest");
		assertDigest(stub.restoredDigest, "retention stub restoredDigest");
		if (!stub.complete || stub.restoredDigest !== stub.expectedDigest) {
			throw new Error(`Retention stub ${stub.stubId} is not completely hydrated.`);
		}
	}
}

export function verifyKbToWikiMigrationPlan(
	plan: KbToWikiMigrationPlan,
): ReturnType<typeof validateWikiTree> {
	if (plan.protocol !== KB_TO_WIKI_MIGRATION_PROTOCOL || plan.dryRun !== true) {
		throw new Error("Migration plan protocol or dry-run marker is invalid.");
	}
	assertStableId(plan.migrationId, "migrationId");
	assertMigrationChangeId(plan.migrationChangeId);
	assertStableId(plan.projectId, "projectId");
	assertSourceBinding(plan.source);
	assertRetentionStubsHydrated(plan.retentionStubs);
	const retiredIds = new Set<string>();
	const retirementSourceIds = new Set<string>();
	for (const entry of plan.retirementMap) {
		assertSourceId(entry.sourceId, "retirement-map sourceId");
		assertStableId(entry.targetItemId, "retirement-map targetItemId");
		assertChangeId(entry.retiredByChangeId, "retirement-map retiredByChangeId");
		assertDigest(entry.sourceDigest, "retirement-map sourceDigest");
		assertProvenance(entry.targetItemId, entry.provenance);
		if (retiredIds.has(entry.targetItemId) || retirementSourceIds.has(entry.sourceId)) {
			throw new Error("Migration retirement map IDs must be unique.");
		}
		retiredIds.add(entry.targetItemId);
		retirementSourceIds.add(entry.sourceId);
	}
	const wiki = validateWikiTree(
		plan.items.map(({path, bytes}) => ({path, bytes})),
		{retiredItemIds: [...retiredIds]},
	);
	const targetIds = new Set(wiki.itemById.keys());
	for (const planned of plan.items) {
		assertSourceId(planned.sourceId, "planned sourceId");
		assertDigest(planned.sourceDigest, "planned sourceDigest");
		if (planned.path !== generatedWikiItemPath(planned.item.itemId)) {
			throw new Error("Migration Item path does not match stable Item identity.");
		}
		if (planned.bytes !== serializeWikiItemFile(planned.item, "markdown")) {
			throw new Error("Migration Item bytes do not replay exactly.");
		}
	}
	const mappedIds = new Set<string>();
	for (const entry of plan.itemIdentityMap) {
		assertSourceId(entry.sourceId, "identity-map sourceId");
		assertStableId(entry.targetItemId, "identity-map targetItemId");
		if (!targetIds.has(entry.targetItemId)) {
			throw new Error("Migration identity map references a missing target Item.");
		}
		if (mappedIds.has(entry.targetItemId)) {
			throw new Error("Migration identity map target IDs must be unique.");
		}
		mappedIds.add(entry.targetItemId);
	}
	if (mappedIds.size !== targetIds.size) {
		throw new Error("Migration identity map must cover every emitted Item.");
	}
	const expectedPathMap = plan.items.map(({item, path}) => ({itemId: item.itemId, path}));
	if (canonicalSemanticJson(plan.pathMap) !== canonicalSemanticJson(expectedPathMap)) {
		throw new Error("Migration path map does not replay emitted Item paths.");
	}
	const expectedProvenanceMap = plan.items.map(({sourceId, item}) =>
		provenanceMapEntry(sourceId, item));
	if (canonicalSemanticJson(plan.provenanceMap) !== canonicalSemanticJson(expectedProvenanceMap)) {
		throw new Error("Migration provenance map does not replay emitted Item provenance.");
	}
	const recordIds = new Set<string>();
	const recordTargets = new Set([...targetIds, ...retiredIds]);
	for (const [index, entry] of plan.legacyRecordMap.entries()) {
		assertStableId(entry.sourceRecordId, "legacy record ID");
		if (
			recordIds.has(entry.sourceRecordId) ||
			!recordTargets.has(entry.targetItemId) ||
			entry.sourceOrder !== index
		) {
			throw new Error("Legacy record map is incomplete, duplicated, fabricated, or out of source order.");
		}
		recordIds.add(entry.sourceRecordId);
	}
	const expectedIntentDigest = semanticDigest(
		KB_TO_WIKI_MIGRATION_INTENT_PROTOCOL,
		migrationIntent(plan.source, plan.itemIdentityMap, plan.pathMap),
	);
	if (plan.migrationIntentDigest !== expectedIntentDigest) {
		throw new Error("Migration intent digest does not replay.");
	}
	return wiki;
}

export function createKbToWikiLegacyEquivalenceProof(input: {
	readonly plan: KbToWikiMigrationPlan;
	readonly source: CreateKbToWikiMigrationPlanInput;
}): KbToWikiLegacyEquivalenceProof {
	const expected = createKbToWikiMigrationPlan(input.source);
	if (canonicalSemanticJson(input.plan) !== canonicalSemanticJson(expected)) {
		throw new Error("Migration plan does not exactly replay canonical legacy semantics.");
	}
	const body = {
		protocol: KB_TO_WIKI_LEGACY_EQUIVALENCE_PROTOCOL,
		migrationId: input.plan.migrationId,
		sourceSemanticDigest: semanticDigest(
			KB_TO_WIKI_LEGACY_EQUIVALENCE_PROTOCOL,
			legacySemanticSource(input.source),
		),
		migrationPlanDigest: semanticDigest(KB_TO_WIKI_MIGRATION_PROTOCOL, input.plan),
		subjectCount: input.source.subjects.length,
		facetCount: input.source.subjects.reduce(
			(count, subject) => count + (subject.facets?.length ?? 0),
			0,
		),
		relationshipCount: input.source.subjects.reduce(
			(count, subject) => count + (subject.relationships?.length ?? 0),
			0,
		),
		lexiconTermCount: (input.source.lexicons ?? []).reduce(
			(count, lexicon) => count + lexicon.terms.length,
			0,
		),
		retirementCount: input.source.retirements?.length ?? 0,
		legacyRecordCount: input.plan.legacyRecordMap.length,
		targetItemCount: input.plan.items.length,
	};
	return Object.freeze({
		...body,
		proofDigest: semanticDigest(KB_TO_WIKI_LEGACY_EQUIVALENCE_PROTOCOL, body),
	});
}

export function verifyKbToWikiLegacyEquivalenceProof(
	proof: KbToWikiLegacyEquivalenceProof,
	plan: KbToWikiMigrationPlan,
): void {
	assertExactKeys(proof, [
		"facetCount",
		"legacyRecordCount",
		"lexiconTermCount",
		"migrationId",
		"migrationPlanDigest",
		"proofDigest",
		"protocol",
		"relationshipCount",
		"retirementCount",
		"sourceSemanticDigest",
		"subjectCount",
		"targetItemCount",
	]);
	if (
		proof.protocol !== KB_TO_WIKI_LEGACY_EQUIVALENCE_PROTOCOL ||
		proof.migrationId !== plan.migrationId
	) {
		throw new Error("Legacy-equivalence proof protocol or migration identity is invalid.");
	}
	for (const field of [
		"subjectCount",
		"facetCount",
		"relationshipCount",
		"lexiconTermCount",
		"retirementCount",
		"legacyRecordCount",
		"targetItemCount",
	] as const) assertCount(proof[field], `legacy-equivalence ${field}`);
	assertDigest(proof.sourceSemanticDigest, "legacy-equivalence sourceSemanticDigest");
	assertDigest(proof.migrationPlanDigest, "legacy-equivalence migrationPlanDigest");
	assertDigest(proof.proofDigest, "legacy-equivalence proofDigest");
	if (
		proof.migrationPlanDigest !== semanticDigest(KB_TO_WIKI_MIGRATION_PROTOCOL, plan) ||
		proof.retirementCount !== plan.retirementMap.length ||
		proof.legacyRecordCount !== plan.legacyRecordMap.length ||
		proof.targetItemCount !== plan.items.length
	) {
		throw new Error("Legacy-equivalence proof does not bind the exact migration plan.");
	}
	const {proofDigest: _proofDigest, ...body} = proof;
	if (proof.proofDigest !== semanticDigest(KB_TO_WIKI_LEGACY_EQUIVALENCE_PROTOCOL, body)) {
		throw new Error("Legacy-equivalence proof digest does not replay.");
	}
}

function legacySemanticSource(input: CreateKbToWikiMigrationPlanInput) {
	return {
		migrationId: input.migrationId,
		migrationChangeId: input.migrationChangeId,
		projectId: input.projectId,
		source: input.source,
		subjects: input.subjects,
		lexicons: input.lexicons ?? [],
		retirements: input.retirements ?? [],
		retentionStubs: input.retentionStubs ?? [],
	};
}

function migrationIntent(
	source: KbToWikiSourceBinding,
	itemIdentityMap: readonly MigrationIdentityMapEntry[],
	pathMap: readonly MigrationPathMapEntry[],
) {
	return {
		repositoryId: source.repositoryId,
		objectFormat: source.objectFormat,
		sourceCommit: source.sourceCommit,
		sourceBuild: source.sourceBuildDigest,
		sourceCheckpoint: source.sourceCheckpointDigest,
		sourceState: source.sourceStateDigest,
		sourceProjection: source.sourceProjectionDigest,
		sourceTraceHead: source.sourceTraceHeadDigest,
		itemIdentityMap,
		pathMap,
		authority: source.authorityDigest,
		implementation: source.implementationDigest,
	};
}

function assertSourceBinding(source: KbToWikiSourceBinding): void {
	assertStableId(source.repositoryId, "repositoryId");
	assertGitOid(source.sourceCommit, "sourceCommit", source.objectFormat);
	for (const field of [
		"sourceBuildDigest",
		"sourceCheckpointDigest",
		"sourceStateDigest",
		"sourceProjectionDigest",
		"sourceTraceHeadDigest",
		"authorityDigest",
		"implementationDigest",
		"quiescenceReceiptDigest",
		"privateBackupDigest",
	] as const) assertDigest(source[field], field);
	assertCanonicalRef(source.backupRef);
	if (!source.backupRef.startsWith("refs/codewiki/backups/migrations/")) {
		throw new Error("Migration backup ref must use reserved immutable namespace.");
	}
}

function legacySubjectItemId(projectId: string, subject: LegacySubjectInput): string {
	return legacyItemId(projectId, subject.sourceId, subject.codewikiId);
}

function legacyItemId(
	projectId: string,
	sourceId: string,
	codewikiId: string | null,
): string {
	if (codewikiId !== null) {
		try {
			assertStableId(codewikiId, "legacy codewiki_id");
			return codewikiId;
		} catch {
			// Invalid legacy IDs map permanently instead of entering target identity.
		}
	}
	const seed = codewikiId ?? sourceId;
	return `cw:${projectId}:item:${sha256Base32Nfc(seed, "legacy Item identity")}`;
}

function provenanceMapEntry(
	sourceId: string,
	item: WikiItem,
): MigrationProvenanceMapEntry {
	return Object.freeze({
		sourceId,
		targetItemId: item.itemId,
		provenance: Object.freeze([...item.provenance]),
	});
}

function assertProvenance(
	itemId: string,
	provenance: readonly WikiProvenanceRef[],
): void {
	createWikiItem({
		itemId,
		itemType: "codewiki.retired",
		title: "Retired Item",
		body: "",
		provenance,
	});
}

function planItem(
	sourceId: string,
	sourceDigest: Sha256Digest,
	item: WikiItem,
): PlannedMigrationItem {
	return Object.freeze({
		sourceId,
		sourceDigest,
		item,
		path: generatedWikiItemPath(item.itemId),
		bytes: serializeWikiItemFile(item, "markdown"),
	});
}

function recordMap(
	sourceRecordId: string,
	targetItemId: string,
	sourceOrder: number,
): LegacyRecordMapEntry {
	assertStableId(sourceRecordId, "legacy record ID");
	return Object.freeze({sourceRecordId, targetItemId, sourceOrder});
}

function claimItemId(ids: Set<string>, itemId: string): void {
	if (ids.has(itemId)) throw new Error(`Migration Item ID collision: ${itemId}.`);
	ids.add(itemId);
}

function requiredMapValue(map: ReadonlyMap<string, string>, key: string): string {
	const value = map.get(key);
	if (value === undefined) throw new Error(`Legacy relationship target ${key} is unresolved.`);
	return value;
}

function sortedUnique(values: readonly string[]): string[] {
	const sorted = [...values].sort(compareText);
	for (let index = 1; index < sorted.length; index += 1) {
		if (sorted[index - 1] === sorted[index]) throw new Error("Migrated aliases must be duplicate-free.");
	}
	return sorted;
}

export function migrationRollbackMode(input: {
	readonly targetOnlyCanonicalOperationObserved: boolean;
}): "restore_source_backup" | "target_compatible_restore_or_forward_repair" {
	return input.targetOnlyCanonicalOperationObserved
		? "target_compatible_restore_or_forward_repair"
		: "restore_source_backup";
}

function assertMigrationChangeId(value: unknown): asserts value is string {
	assertChangeId(value, "migrationChangeId");
}

function assertChangeId(value: unknown, field: string): asserts value is string {
	assertStableId(value, field);
	if (!/^CHG-[A-Za-z0-9._-]+$/u.test(value)) {
		throw new Error(`${field} must be a path-safe Change ID.`);
	}
}

function assertSourceId(value: string, field: string): void {
	assertNfcString(value, field, 1, 16_384);
}

function assertDigest(value: unknown, field: string): asserts value is Sha256Digest {
	if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
		throw new Error(`${field} must be a lowercase SHA-256 digest.`);
	}
}

function assertCount(value: unknown, field: string): asserts value is number {
	if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 1_000_000) {
		throw new Error(`${field} must be an integer from 0 to 1000000.`);
	}
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
