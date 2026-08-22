import {isMap, parse as parseYaml, parseDocument, stringify as stringifyYaml} from "yaml";
import type {
	KnowledgeEffect,
	KnowledgePostStateContent,
	KnowledgeTargetRef,
	KnowledgeTransition,
} from "../changes/trace/contracts.ts";
import {createKnowledgePostStateArtifact} from "../changes/trace/identity.ts";
import {
	canonicalJsonDigest,
	sha256Digest,
	type Sha256Digest,
} from "../utils/canonical-json.ts";
import {
	assertKnowledgeCheckpoint,
	compareKnowledgeTargets,
	createKnowledgeCheckpoint,
	DEFAULT_KNOWLEDGE_COMPILER,
	knowledgeCellByTarget,
	knowledgeTargetKey,
	markdownHeadingSpan,
	resolveKnowledgeProjection,
	canonicalKnowledgeValue as canonicalValue,
	compareKnowledgeText as compareText,
	type KnowledgeCheckpoint,
	type KnowledgeCompilerIdentity,
	type KnowledgeProjectionFile,
	type KnowledgeTombstone,
	type ResolvedKnowledgeCell,
} from "./state.ts";

export const KNOWLEDGE_APPLICATION_PLAN_PROTOCOL = Object.freeze({
	id: "codewiki.knowledge-application-plan",
	version: "1.0.0",
} as const);
export const KNOWLEDGE_CANDIDATE_CHECKPOINT_PROTOCOL = Object.freeze({
	id: "codewiki.knowledge-candidate-checkpoint",
	version: "1.0.0",
} as const);
const KNOWLEDGE_TRANSITION_MAX_EFFECTS = 128;
const KNOWLEDGE_TRANSITION_MAX_POST_STATE_BYTES = 2 * 1024 * 1024;

export interface KnowledgeApplicationSpan {
	readonly effectId: string;
	readonly target: KnowledgeTargetRef;
	readonly startByte: number;
	readonly endByte: number;
	readonly replacement: string;
	readonly replacementDigest: Sha256Digest;
}

export type KnowledgeApplicationOperation =
	| Readonly<{
			readonly kind: "create";
			readonly path: string;
			readonly expected: "absent";
			readonly mediaType: KnowledgeProjectionFile["mediaType"];
			readonly bytes: string;
			readonly byteDigest: Sha256Digest;
	  }>
	| Readonly<{
			readonly kind: "delete";
			readonly path: string;
			readonly expectedByteDigest: Sha256Digest;
	  }>
	| Readonly<{
			readonly kind: "splice";
			readonly path: string;
			readonly expectedByteDigest: Sha256Digest;
			readonly spans: readonly KnowledgeApplicationSpan[];
			readonly resultByteDigest: Sha256Digest;
	  }>;

export interface KnowledgeApplicationPlan {
	readonly protocol: typeof KNOWLEDGE_APPLICATION_PLAN_PROTOCOL;
	readonly baseStateDigest: Sha256Digest;
	readonly baseProjectionDigest: Sha256Digest;
	readonly compilerDigest: Sha256Digest;
	readonly effectIds: readonly string[];
	readonly operations: readonly KnowledgeApplicationOperation[];
	readonly affectedProjectionClosure: readonly string[];
	readonly resultingStateDigest: Sha256Digest;
	readonly resultingProjectionDigest: Sha256Digest;
	readonly planDigest: Sha256Digest;
}

export interface KnowledgeProjectionDiffFile {
	readonly path: string;
	readonly status: "created" | "deleted" | "modified";
	readonly currentByteDigest: Sha256Digest | null;
	readonly projectedByteDigest: Sha256Digest | null;
	readonly spans: readonly KnowledgeApplicationSpan[];
}

export interface KnowledgeProjectionViewRef {
	readonly checkpointDigest: Sha256Digest;
	readonly stateDigest: Sha256Digest;
	readonly projectionDigest: Sha256Digest;
}

export interface KnowledgeProjectionView {
	readonly current: KnowledgeProjectionViewRef;
	readonly desired: KnowledgeProjectionViewRef;
	readonly diff: readonly KnowledgeProjectionDiffFile[];
}

export interface KnowledgeCandidateCheckpoint {
	readonly protocol: typeof KNOWLEDGE_CANDIDATE_CHECKPOINT_PROTOCOL;
	readonly base: KnowledgeCheckpoint;
	readonly baseCheckpointDigest: Sha256Digest;
	readonly transitionDigest: Sha256Digest;
	readonly compiler: KnowledgeCompilerIdentity;
	readonly applicationPlan: KnowledgeApplicationPlan;
	readonly projected: KnowledgeCheckpoint;
	readonly view: KnowledgeProjectionView;
	readonly checkpointDigest: Sha256Digest;
}

interface PendingSpan {
	readonly path: string;
	readonly effectId: string;
	readonly target: KnowledgeTargetRef;
	readonly characterStart: number;
	readonly characterEnd: number;
	readonly replacement: string;
}

export function compileKnowledgeTransition(input: {
	readonly base: KnowledgeCheckpoint;
	readonly transition: KnowledgeTransition;
	readonly compiler?: KnowledgeCompilerIdentity;
}): KnowledgeCandidateCheckpoint {
	assertKnowledgeCheckpoint(input.base);
	const compiler = input.compiler ?? DEFAULT_KNOWLEDGE_COMPILER;
	if (compiler.digest !== input.base.projection.compiler.digest) {
		throw new Error("Knowledge compiler identity changed; Candidate must be rebuilt from a matching base projection.");
	}
	const transitionDigest = canonicalJsonDigest(input.transition);
	if (input.transition.kind === "unchanged") {
		for (const ref of input.transition.refs) {
			if (!knowledgeCellByTarget(input.base, ref)) {
				throw new Error(`Unchanged Knowledge reference ${knowledgeTargetKey(ref)} is absent.`);
			}
		}
		return unchangedCheckpoint(input.base, compiler, transitionDigest);
	}
	const effects = validatedEffects(input.transition.effects);
	const {operations, effectIds, nextTombstones} = compileEffectOperations(
		input.base,
		effects,
	);
	const projectedFiles = applyKnowledgeApplicationPlan(input.base.projection.files, operations);
	const projected = createKnowledgeCheckpoint({
		files: projectedFiles.map(({byteDigest: _digest, ...file}) => file),
		tombstones: nextTombstones,
		compiler,
	});
	assertEffectPostState(effects, input.base, projected);
	assertNoUntargetedFacetChanges({effects, base: input.base, projected});
	const affectedProjectionClosure = projectionClosure({
		base: input.base.projection.files,
		projected: projected.projection.files,
		effects,
		operations,
	});
	const planBody = {
		protocol: KNOWLEDGE_APPLICATION_PLAN_PROTOCOL,
		baseStateDigest: input.base.state.stateDigest,
		baseProjectionDigest: input.base.projection.projectionDigest,
		compilerDigest: compiler.digest,
		effectIds,
		operations,
		affectedProjectionClosure,
		resultingStateDigest: projected.state.stateDigest,
		resultingProjectionDigest: projected.projection.projectionDigest,
	};
	const applicationPlan = canonicalValue({
		...planBody,
		planDigest: canonicalJsonDigest(planBody),
	});
	const view = projectionView(input.base, projected, operations);
	const checkpointBody = {
		protocol: KNOWLEDGE_CANDIDATE_CHECKPOINT_PROTOCOL,
		base: input.base,
		baseCheckpointDigest: input.base.checkpointDigest,
		transitionDigest,
		compiler,
		applicationPlan,
		projected,
		view,
	};
	return canonicalValue({
		...checkpointBody,
		checkpointDigest: canonicalJsonDigest(checkpointBody),
	});
}

export function assertKnowledgeCandidateCheckpoint(
	checkpoint: KnowledgeCandidateCheckpoint,
	transition: KnowledgeTransition,
): void {
	const rebuilt = compileKnowledgeTransition({
		base: checkpoint.base,
		transition,
		compiler: checkpoint.compiler,
	});
	if (rebuilt.checkpointDigest !== checkpoint.checkpointDigest) {
		throw new Error("Knowledge Candidate checkpoint identity is invalid.");
	}
}

export function applyKnowledgeApplicationPlan(
	baseFiles: readonly KnowledgeProjectionFile[],
	operations: readonly KnowledgeApplicationOperation[],
): readonly KnowledgeProjectionFile[] {
	const files = new Map(baseFiles.map((file) => [file.path, file]));
	for (const operation of operations) {
		const current = files.get(operation.path);
		switch (operation.kind) {
			case "create":
				if (current) throw new Error(`Knowledge create path ${operation.path} already exists.`);
				if (sha256Digest(operation.bytes) !== operation.byteDigest) {
					throw new Error(`Knowledge create bytes for ${operation.path} are invalid.`);
				}
				files.set(operation.path, {
					path: operation.path,
					mediaType: operation.mediaType,
					bytes: operation.bytes,
					byteDigest: operation.byteDigest,
				});
				break;
			case "delete":
				assertExpectedFile(current, operation.path, operation.expectedByteDigest);
				files.delete(operation.path);
				break;
			case "splice": {
				const existing = assertExpectedFile(current, operation.path, operation.expectedByteDigest);
				const bytes = applySpans(existing.bytes, operation.spans);
				if (sha256Digest(bytes) !== operation.resultByteDigest) {
					throw new Error(`Knowledge splice result for ${operation.path} is invalid.`);
				}
				files.set(operation.path, {
					...existing,
					bytes,
					byteDigest: operation.resultByteDigest,
				});
				break;
			}
			default:
				assertNever(operation);
		}
	}
	return canonicalValue([...files.values()].sort((left, right) => compareText(left.path, right.path)));
}

function validatedEffects(
	values: readonly KnowledgeEffect[],
): readonly KnowledgeEffect[] {
	if (values.length > KNOWLEDGE_TRANSITION_MAX_EFFECTS) {
		throw new Error(`Knowledge transition exceeds ${KNOWLEDGE_TRANSITION_MAX_EFFECTS} Effects.`);
	}
	const effects = [...values].sort((left, right) =>
		compareKnowledgeTargets(left.target, right.target),
	);
	assertUniqueEffectTargets(effects);
	let totalPostStateBytes = 0;
	for (const effect of effects) {
		if (effect.action !== "set") continue;
		totalPostStateBytes += Buffer.byteLength(postStateContent(effect).content, "utf8");
	}
	if (totalPostStateBytes > KNOWLEDGE_TRANSITION_MAX_POST_STATE_BYTES) {
		throw new Error(
			`Knowledge transition exceeds ${KNOWLEDGE_TRANSITION_MAX_POST_STATE_BYTES} post-state bytes.`,
		);
	}
	return effects;
}

function compileEffectOperations(
	base: KnowledgeCheckpoint,
	effects: readonly KnowledgeEffect[],
): {
	readonly operations: readonly KnowledgeApplicationOperation[];
	readonly effectIds: readonly string[];
	readonly nextTombstones: readonly KnowledgeTombstone[];
} {
	const baseFiles = new Map(base.projection.files.map((file) => [file.path, file]));
	const baseResolved = resolveKnowledgeProjection(base.projection.files);
	const resolvedByTarget = new Map(
		baseResolved.map((cell) => [knowledgeTargetKey(cell.target), cell]),
	);
	const tombstoneKeys = new Set(
		base.state.tombstones.map((entry) => knowledgeTargetKey(entry.target)),
	);
	const pendingSpans: PendingSpan[] = [];
	const createOperations: KnowledgeApplicationOperation[] = [];
	const deletePaths = new Map<string, KnowledgeEffect>();
	const effectIds: string[] = [];
	const nextTombstones: KnowledgeTombstone[] = [...base.state.tombstones];
	for (const effect of effects) {
		const effectId = knowledgeEffectId(effect);
		effectIds.push(effectId);
		const key = knowledgeTargetKey(effect.target);
		const current = resolvedByTarget.get(key);
		const currentDigest = current?.digest ?? "absent";
		if (effect.expected !== currentDigest) {
			throw new Error(
				`Knowledge Effect ${key} expected ${effect.expected} but current state is ${currentDigest}.`,
			);
		}
		if (effect.action === "set") {
			if (!current && tombstoneKeys.has(key)) {
				throw new Error(`Retired Knowledge identity ${key} cannot be reused.`);
			}
			compileSetEffect({
				effect,
				effectId,
				current,
				baseFiles,
				pendingSpans,
				createOperations,
			});
			continue;
		}
		if (!current) throw new Error(`Knowledge retire target ${key} is absent.`);
		compileRetireEffect({
			effect,
			effectId,
			current,
			baseFiles,
			baseResolved,
			pendingSpans,
			deletePaths,
			nextTombstones,
		});
	}
	assertNonOverlappingSpans(pendingSpans);
	return {
		operations: materializeOperations({
			baseFiles,
			pendingSpans,
			createOperations,
			deletePaths,
		}),
		effectIds,
		nextTombstones,
	};
}

function unchangedCheckpoint(
	base: KnowledgeCheckpoint,
	compiler: KnowledgeCompilerIdentity,
	transitionDigest: Sha256Digest,
): KnowledgeCandidateCheckpoint {
	const planBody = {
		protocol: KNOWLEDGE_APPLICATION_PLAN_PROTOCOL,
		baseStateDigest: base.state.stateDigest,
		baseProjectionDigest: base.projection.projectionDigest,
		compilerDigest: compiler.digest,
		effectIds: [],
		operations: [],
		affectedProjectionClosure: [],
		resultingStateDigest: base.state.stateDigest,
		resultingProjectionDigest: base.projection.projectionDigest,
	};
	const applicationPlan = canonicalValue({...planBody, planDigest: canonicalJsonDigest(planBody)});
	const view = canonicalValue({
		current: projectionViewRef(base),
		desired: projectionViewRef(base),
		diff: [],
	});
	const body = {
		protocol: KNOWLEDGE_CANDIDATE_CHECKPOINT_PROTOCOL,
		base,
		baseCheckpointDigest: base.checkpointDigest,
		transitionDigest,
		compiler,
		applicationPlan,
		projected: base,
		view,
	};
	return canonicalValue({...body, checkpointDigest: canonicalJsonDigest(body)});
}

function compileSetEffect(input: {
	readonly effect: Extract<KnowledgeEffect, {readonly action: "set"}>;
	readonly effectId: string;
	readonly current: ResolvedKnowledgeCell | undefined;
	readonly baseFiles: ReadonlyMap<string, KnowledgeProjectionFile>;
	readonly pendingSpans: PendingSpan[];
	readonly createOperations: KnowledgeApplicationOperation[];
}): void {
	const content = postStateContent(input.effect);
	if (!input.current) {
		if (input.effect.target.facetId) {
			throw new Error("Creating an absent Knowledge facet requires an existing declared locator.");
		}
		const path = pathForNewSubject(input.effect.target.subjectId, content.mediaType);
		if (input.baseFiles.has(path)) {
			throw new Error(`Derived Knowledge path ${path} already exists.`);
		}
		input.createOperations.push({
			kind: "create",
			path,
			expected: "absent",
			mediaType: content.mediaType,
			bytes: content.content,
			byteDigest: sha256Digest(content.content),
		});
		return;
	}
	if (content.mediaType !== input.current.mediaType) {
		throw new Error(`Knowledge post-state media type changed for ${knowledgeTargetKey(input.effect.target)}.`);
	}
	let replacement = content.content;
	if (input.current.target.facetId && input.current.locator?.kind === "heading_path") {
		const span = markdownHeadingSpan(replacement, input.current.locator.path.slice(-1));
		if (span.start !== 0 || span.end !== replacement.length) {
			throw new Error("Markdown facet post-state must contain exactly its declared heading section.");
		}
	}
	if (input.current.target.facetId && input.current.locator?.kind === "yaml") {
		replacement = yamlReplacement(
			(input.baseFiles.get(input.current.path) as KnowledgeProjectionFile).bytes,
			input.current.locator.pointer,
			content.content,
		).replacement;
	}
	const range = input.current.target.facetId
		? structuralFacetRange(input.current, input.baseFiles)
		: {start: 0, end: (input.baseFiles.get(input.current.path) as KnowledgeProjectionFile).bytes.length};
	input.pendingSpans.push({
		path: input.current.path,
		effectId: input.effectId,
		target: input.effect.target,
		characterStart: range.start,
		characterEnd: range.end,
		replacement,
	});
}

function compileRetireEffect(input: {
	readonly effect: Extract<KnowledgeEffect, {readonly action: "retire"}>;
	readonly effectId: string;
	readonly current: ResolvedKnowledgeCell;
	readonly baseFiles: ReadonlyMap<string, KnowledgeProjectionFile>;
	readonly baseResolved: readonly ResolvedKnowledgeCell[];
	readonly pendingSpans: PendingSpan[];
	readonly deletePaths: Map<string, KnowledgeEffect>;
	readonly nextTombstones: KnowledgeTombstone[];
}): void {
	if (!input.current.target.facetId) {
		input.deletePaths.set(input.current.path, input.effect);
		for (const cell of input.baseResolved.filter((cell) => cell.path === input.current.path)) {
			input.nextTombstones.push({target: cell.target, retiredByEffectId: input.effectId});
		}
		return;
	}
	const file = input.baseFiles.get(input.current.path) as KnowledgeProjectionFile;
	const contentRange = structuralFacetRange(input.current, input.baseFiles);
	input.pendingSpans.push({
		path: input.current.path,
		effectId: input.effectId,
		target: input.effect.target,
		characterStart: contentRange.start,
		characterEnd: contentRange.end,
		replacement: "",
	});
	const declaration = facetDeclarationRange(file.bytes, input.current.target.facetId);
	input.pendingSpans.push({
		path: input.current.path,
		effectId: input.effectId,
		target: input.effect.target,
		characterStart: declaration.start,
		characterEnd: declaration.end,
		replacement: "",
	});
	input.nextTombstones.push({target: input.current.target, retiredByEffectId: input.effectId});
}

function materializeOperations(input: {
	readonly baseFiles: ReadonlyMap<string, KnowledgeProjectionFile>;
	readonly pendingSpans: readonly PendingSpan[];
	readonly createOperations: readonly KnowledgeApplicationOperation[];
	readonly deletePaths: ReadonlyMap<string, KnowledgeEffect>;
}): readonly KnowledgeApplicationOperation[] {
	const operations: KnowledgeApplicationOperation[] = [...input.createOperations];
	for (const [path, effect] of input.deletePaths) {
		const file = input.baseFiles.get(path) as KnowledgeProjectionFile;
		operations.push({kind: "delete", path, expectedByteDigest: file.byteDigest});
		if (input.pendingSpans.some((span) => span.path === path)) {
			throw new Error(`Knowledge subject retirement overlaps another Effect in ${path}.`);
		}
		void effect;
	}
	const paths = [...new Set(input.pendingSpans.map((span) => span.path))].sort(compareText);
	for (const path of paths) {
		const file = input.baseFiles.get(path) as KnowledgeProjectionFile;
		const spans: KnowledgeApplicationSpan[] = [];
		for (const span of input.pendingSpans) {
			if (span.path === path) spans.push(applicationSpan(file.bytes, span));
		}
		spans.sort((left, right) => left.startByte - right.startByte);
		const result = applySpans(file.bytes, spans);
		operations.push({
			kind: "splice",
			path,
			expectedByteDigest: file.byteDigest,
			spans,
			resultByteDigest: sha256Digest(result),
		});
	}
	return canonicalValue(operations.sort((left, right) => compareText(left.path, right.path)));
}

function structuralFacetRange(
	cell: ResolvedKnowledgeCell,
	files: ReadonlyMap<string, KnowledgeProjectionFile>,
): {readonly start: number; readonly end: number} {
	if (cell.locator?.kind === "heading_path") {
		return {start: cell.characterStart, end: cell.characterEnd};
	}
	if (cell.locator?.kind === "yaml") {
		const file = files.get(cell.path) as KnowledgeProjectionFile;
		const {start, end} = yamlReplacement(file.bytes, cell.locator.pointer, "null");
		return {start, end};
	}
	throw new Error(`Knowledge facet ${knowledgeTargetKey(cell.target)} has no structural locator.`);
}

function yamlReplacement(
	source: string,
	pointer: string,
	postState: string,
): {readonly start: number; readonly end: number; readonly replacement: string} {
	const document = parseDocument(source, {keepSourceTokens: true});
	if (document.errors.length > 0) throw new Error("Knowledge YAML base is invalid.");
	let node: YamlSourceNode | undefined = yamlSourceNode(document.contents);
	for (const encoded of pointer.slice(1).split("/")) {
		const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
		node = yamlChild(
			node,
			/^(?:0|[1-9][0-9]*)$/u.test(key) ? Number(key) : key,
			pointer,
		);
	}
	const range = node?.range;
	if (!range || range.length < 2) throw new Error(`YAML pointer ${pointer} has no source range.`);
	let value: unknown;
	try {
		value = parseYaml(postState);
	} catch (error) {
		throw new Error(`Knowledge YAML post-state is invalid: ${error instanceof Error ? error.message : String(error)}`);
	}
	const rendered = stringifyYaml(value, {lineWidth: 0}).trimEnd();
	const lineStart = source.lastIndexOf("\n", range[0] - 1) + 1;
	const column = range[0] - lineStart;
	const replacement = rendered.replace(/\n/g, `\n${" ".repeat(column)}`);
	return {start: range[0], end: range[1], replacement};
}

function facetDeclarationRange(
	source: string,
	facetId: string,
): {readonly start: number; readonly end: number} {
	const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
	const yamlSource = frontmatter?.[1] ?? source;
	const offset = frontmatter ? (frontmatter[0].indexOf(yamlSource)) : 0;
	const document = parseDocument(yamlSource, {keepSourceTokens: true});
	const facets = document.get("codewiki_facets", true);
	if (!isMap(facets)) throw new Error(`Knowledge facet declaration ${facetId} is absent.`);
	const facetPair = facets.items.find((pair) => String(pair.key) === facetId);
	if (!nodeRange(facetPair?.key)) {
		throw new Error(`Knowledge facet declaration ${facetId} is absent.`);
	}
	let pair = facetPair;
	if (facets.items.length === 1 && document.contents && isMap(document.contents)) {
		pair = document.contents.items.find(
			(entry) => String(entry.key) === "codewiki_facets",
		);
	}
	const keyRange = nodeRange(pair?.key);
	if (!keyRange) {
		throw new Error(`Knowledge facet declaration ${facetId} has no source range.`);
	}
	const startInYaml = yamlSource.lastIndexOf("\n", keyRange[0] - 1) + 1;
	const valueRange = nodeRange(pair?.value);
	const valueEnd = valueRange?.[2] ?? valueRange?.[1] ?? keyRange[2] ?? keyRange[1];
	let endInYaml = yamlSource.indexOf("\n", valueEnd);
	if (endInYaml < 0) endInYaml = yamlSource.length;
	else endInYaml += 1;
	return {start: offset + startInYaml, end: offset + endInYaml};
}

function postStateContent(
	effect: Extract<KnowledgeEffect, {readonly action: "set"}>,
): KnowledgePostStateContent {
	// SAFETY: revision admission validates embedded post-state shape before compilation; identity is rechecked below.
	const artifact = effect.postState.artifact as unknown as KnowledgePostStateContent;
	const recreated = createKnowledgePostStateArtifact({
		mediaType: artifact.mediaType,
		content: artifact.content,
	});
	if (
		recreated.id !== effect.postState.id ||
		recreated.digest !== effect.postState.digest ||
		recreated.schemaVersion !== effect.postState.schemaVersion
	) {
		throw new Error(`Knowledge post-state identity is invalid for ${knowledgeTargetKey(effect.target)}.`);
	}
	return artifact;
}

type YamlSourceValue =
	| YamlSourceNode
	| string
	| number
	| boolean
	| null
	| undefined;

interface YamlSourceNode {
	readonly range?: readonly number[];
	readonly get?: (key: string | number, keepScalar: true) => YamlSourceValue;
}

function yamlSourceNode(value: YamlSourceValue | object): YamlSourceNode | undefined {
	if (!value || typeof value !== "object") return undefined;
	// SAFETY: YAML nodes are decoded to bounded source-node operations before use.
	return value as YamlSourceNode;
}

function yamlChild(
	parent: YamlSourceNode | undefined,
	key: string | number,
	pointer: string,
): YamlSourceNode {
	const child = parent?.get ? yamlSourceNode(parent.get(key, true)) : undefined;
	if (!child) throw new Error(`YAML pointer ${pointer} is unresolved.`);
	return child;
}

function nodeRange(value: unknown): readonly number[] | undefined {
	if (!value || typeof value !== "object" || !("range" in value)) return undefined;
	const range = (value as {readonly range?: unknown}).range;
	return Array.isArray(range) && range.every((entry) => Number.isInteger(entry))
		? range
		: undefined;
}

export function knowledgeEffectId(effect: KnowledgeEffect): string {
	return `knowledge-effect:${canonicalJsonDigest(effect).slice("sha256:".length)}`;
}

function assertUniqueEffectTargets(effects: readonly KnowledgeEffect[]): void {
	const keys = new Set<string>();
	for (const effect of effects) {
		const key = knowledgeTargetKey(effect.target);
		if (keys.has(key)) throw new Error(`Duplicate Knowledge Effect target ${key}.`);
		keys.add(key);
	}
}

function assertNonOverlappingSpans(spans: readonly PendingSpan[]): void {
	for (const path of new Set(spans.map((span) => span.path))) {
		const ordered = spans
			.filter((span) => span.path === path)
			.sort((left, right) => left.characterStart - right.characterStart);
		for (let index = 1; index < ordered.length; index += 1) {
			const previous = ordered[index - 1] as PendingSpan;
			const current = ordered[index] as PendingSpan;
			if (current.characterStart < previous.characterEnd) {
				throw new Error(`Knowledge structural edits overlap in ${path}; ordered transforms are forbidden.`);
			}
		}
	}
}

function assertEffectPostState(
	effects: readonly KnowledgeEffect[],
	base: KnowledgeCheckpoint,
	projected: KnowledgeCheckpoint,
): void {
	for (const effect of effects) {
		const before = knowledgeCellByTarget(base, effect.target);
		const after = knowledgeCellByTarget(projected, effect.target);
		if (effect.action === "retire") {
			if (after) throw new Error(`Retired Knowledge target ${knowledgeTargetKey(effect.target)} remains active.`);
			continue;
		}
		if (!after) throw new Error(`Set Knowledge target ${knowledgeTargetKey(effect.target)} is absent after compilation.`);
		if (before?.digest === after.digest) {
			throw new Error(`Knowledge Effect ${knowledgeTargetKey(effect.target)} is a semantic no-op.`);
		}
	}
}

function assertNoUntargetedFacetChanges(input: {
	readonly effects: readonly KnowledgeEffect[];
	readonly base: KnowledgeCheckpoint;
	readonly projected: KnowledgeCheckpoint;
}): void {
	const targetKeys = new Set(input.effects.map((effect) => knowledgeTargetKey(effect.target)));
	const baseFacets = input.base.state.cells.filter((cell) => cell.target.facetId);
	const projectedByKey = new Map(
		input.projected.state.cells.map((cell) => [knowledgeTargetKey(cell.target), cell]),
	);
	for (const facet of baseFacets) {
		const key = knowledgeTargetKey(facet.target);
		const projected = projectedByKey.get(key);
		if (!targetKeys.has(key) && projected?.digest !== facet.digest) {
			throw new Error(`Knowledge Effect changed untargeted facet ${key}.`);
		}
	}
}

function projectionClosure(input: {
	readonly base: readonly KnowledgeProjectionFile[];
	readonly projected: readonly KnowledgeProjectionFile[];
	readonly effects: readonly KnowledgeEffect[];
	readonly operations: readonly KnowledgeApplicationOperation[];
}): readonly string[] {
	const targetIds = input.effects.map((effect) => effect.target.subjectId);
	const changed = new Set(input.operations.map((operation) => operation.path));
	for (const file of [...input.base, ...input.projected]) {
		if (targetIds.some((id) => file.bytes.includes(id))) changed.add(file.path);
	}
	return [...changed].sort(compareText);
}

function projectionView(
	current: KnowledgeCheckpoint,
	desired: KnowledgeCheckpoint,
	operations: readonly KnowledgeApplicationOperation[],
): KnowledgeProjectionView {
	const currentFiles = new Map(current.projection.files.map((file) => [file.path, file]));
	const projectedFiles = new Map(desired.projection.files.map((file) => [file.path, file]));
	const diff = operations.map((operation): KnowledgeProjectionDiffFile => {
		const before = currentFiles.get(operation.path);
		const after = projectedFiles.get(operation.path);
		return {
			path: operation.path,
			status: projectionDiffStatus(before, after),
			currentByteDigest: before?.byteDigest ?? null,
			projectedByteDigest: after?.byteDigest ?? null,
			spans: operation.kind === "splice" ? operation.spans : [],
		};
	});
	return canonicalValue({
		current: projectionViewRef(current),
		desired: projectionViewRef(desired),
		diff,
	});
}

function projectionDiffStatus(
	before: KnowledgeProjectionFile | undefined,
	after: KnowledgeProjectionFile | undefined,
): KnowledgeProjectionDiffFile["status"] {
	if (!before) return "created";
	return after ? "modified" : "deleted";
}

function projectionViewRef(
	checkpoint: KnowledgeCheckpoint,
): KnowledgeProjectionViewRef {
	return {
		checkpointDigest: checkpoint.checkpointDigest,
		stateDigest: checkpoint.state.stateDigest,
		projectionDigest: checkpoint.projection.projectionDigest,
	};
}

function pathForNewSubject(
	subjectId: string,
	mediaType: KnowledgePostStateContent["mediaType"],
): string {
	const [, kind, stableKey] = subjectId.split(":");
	if (!kind || !stableKey) throw new Error(`Invalid Knowledge subject ${subjectId}.`);
	if (mediaType === "application/yaml") {
		if (kind !== "diagram") throw new Error("Only diagram subjects derive YAML paths.");
		return `system/diagrams/${stableKey}.yaml`;
	}
	if (mediaType === "application/json") return `generated/${kind}/${stableKey}.json`;
	const directory = {
		component: "system/components",
		flow: "system/flows",
		user: "product/users",
	}[kind];
	if (directory) return `${directory}/${stableKey}.md`;
	if (kind === "story") {
		const [owner, story] = stableKey.split(".");
		if (!owner || !story) {
			throw new Error("Story identity must derive owner and story path segments.");
		}
		return `product/stories/${owner}/${story}.md`;
	}
	if (kind === "design") {
		return `product/${stableKey === "product" ? "DESIGN" : stableKey}.md`;
	}
	if (kind === "lexicon") {
		return stableKey === "root" ? "lexicon.md" : `lexicon/${stableKey}.md`;
	}
	throw new Error(`No deterministic Markdown path rule exists for Knowledge kind ${kind}.`);
}

function applicationSpan(source: string, span: PendingSpan): KnowledgeApplicationSpan {
	const startByte = Buffer.byteLength(source.slice(0, span.characterStart), "utf8");
	const endByte = Buffer.byteLength(source.slice(0, span.characterEnd), "utf8");
	return {
		effectId: span.effectId,
		target: span.target,
		startByte,
		endByte,
		replacement: span.replacement,
		replacementDigest: sha256Digest(span.replacement),
	};
}

function applySpans(
	source: string,
	spans: readonly KnowledgeApplicationSpan[],
): string {
	let bytes = Buffer.from(source, "utf8");
	for (const span of [...spans].sort((left, right) => right.startByte - left.startByte)) {
		if (
			span.startByte < 0 ||
			span.endByte < span.startByte ||
			span.endByte > bytes.length ||
			sha256Digest(span.replacement) !== span.replacementDigest
		) {
			throw new Error("Knowledge application span is invalid.");
		}
		bytes = Buffer.concat([
			bytes.subarray(0, span.startByte),
			Buffer.from(span.replacement, "utf8"),
			bytes.subarray(span.endByte),
		]);
	}
	return bytes.toString("utf8");
}

function assertExpectedFile(
	file: KnowledgeProjectionFile | undefined,
	path: string,
	expected: Sha256Digest,
): KnowledgeProjectionFile {
	if (!file || file.byteDigest !== expected || sha256Digest(file.bytes) !== expected) {
		throw new Error(`Knowledge application base changed for ${path}.`);
	}
	return file;
}

function assertNever(value: never): never {
	throw new Error(`Unhandled Knowledge application operation ${JSON.stringify(value)}.`);
}

