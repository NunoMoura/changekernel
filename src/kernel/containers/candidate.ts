import {canonicalJson, isCanonicalObject, type CanonicalLimits, type CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, type Outcome} from "../data-contracts/outcome.ts";
import {arrayField, decodeContract, exactRecord, integerField, literalField, rejectContract, requiredField, textField, type CanonicalRecord, type ContractIssue} from "../data-contracts/validation.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {decodeContainerIdentity, type ContainerIdentity, type IntakeIssue} from "./intake.ts";

export const CONTAINER_CANDIDATE_PROTOCOL = "changekernel.container-candidate-batch@1.0.0";
export const GENERIC_ENTITY_SOURCE = "changekernel:generic";
export const CANDIDATE_LIMITS: CanonicalLimits = Object.freeze({maximumDepth: 24, maximumEntriesPerContainer: 128, maximumNodes: 32_768, maximumTextBytes: 1_048_576});
const CONTRACT = "Container candidate batch";
const IDENTIFIER = /^[a-z][a-z0-9.-]*:[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u;
const FIELD_TYPES = ["string", "number", "boolean", "object", "array", "null"] as const;
export type CandidateIssue = IntakeIssue | Readonly<{code: "stale"; message: string}>;
export type CandidateOutcome<T> = Outcome<T, CandidateIssue>;
export interface EntityRef {readonly sourceId: string; readonly entityId: string}
export interface EntityLink {readonly role: string; readonly target: EntityRef}
export interface EntityValue {
	readonly typeId: string;
	readonly data: Readonly<{[key: string]: CanonicalValue}>;
	readonly links: readonly EntityLink[];
}
export interface EntityType {
	readonly typeId: string;
	readonly fields: readonly Readonly<{name: string; type: typeof FIELD_TYPES[number]}>[];
}
export interface RecordDefinition extends ContainerIdentity {
	readonly revision: number;
	readonly types: readonly EntityType[];
	readonly digest: Sha256Digest;
}
export interface DefinitionRequest extends ContainerIdentity {
	readonly expectedDigest: Sha256Digest | null;
	readonly types: readonly EntityType[];
}
/** Null version means required absence; null after means deletion. Both null is invalid. */
export interface EntityEffect {readonly target: EntityRef; readonly expectedVersion: string | null; readonly after: EntityValue | null}
export interface EntityDependency {readonly target: EntityRef; readonly expectedVersion: string}
export interface CandidateRequest extends ContainerIdentity {
	readonly changeId: Sha256Digest;
	readonly requestId: string;
	readonly definitionDigest: Sha256Digest;
	readonly effects: readonly EntityEffect[];
	readonly dependencies: readonly EntityDependency[];
}
export type EntityObservation =
	| Readonly<{status: "present"; version: string; value: EntityValue}>
	| Readonly<{status: "absent" | "unknown" | "denied"}>;
export interface CandidateGround {
	readonly target: EntityRef;
	readonly bindingDigest: Sha256Digest;
	readonly observation: EntityObservation;
}
export interface ChangeCandidate extends CandidateRequest {
	readonly candidateId: Sha256Digest;
	readonly inputDigest: Sha256Digest;
	readonly groundsDigest: Sha256Digest;
	readonly grounds: readonly CandidateGround[];
	readonly status: "prepared-only";
	readonly freshness: "current" | "stale" | "unknown";
}
export interface ContainerDescription {
	readonly definition: RecordDefinition | null;
	readonly genericState: "unknown" | "empty" | "present";
	readonly capabilities: Readonly<{prepare: boolean; publish: false; checks: false}>;
}

function reject(path: string, message: string): never { return rejectContract("invalid_field", CONTRACT, path, message); }
function digest(value: CanonicalValue, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(value);
	if (!decoded.ok) reject(path, decoded.error.message);
	return decoded.value;
}
function identifier(record: CanonicalRecord, field: string, path = "$"): string {
	return textField(CONTRACT, record, field, path, {maximumBytes: 256, pattern: IDENTIFIER});
}
function container(record: CanonicalRecord): string {
	const decoded = decodeContainerIdentity({containerId: record.containerId});
	if (!decoded.ok) reject("$.containerId", decoded.error.message);
	return decoded.value.containerId;
}
function ref(value: CanonicalValue, path: string): EntityRef {
	const r = exactRecord(CONTRACT, value, path, ["sourceId", "entityId"]);
	return Object.freeze({sourceId: identifier(r, "sourceId", path), entityId: identifier(r, "entityId", path)});
}
export function entityKey(target: EntityRef): string { return `${target.sourceId}\0${target.entityId}`; }
function ordered(keys: readonly string[], path: string): void {
	let previous: string | undefined;
	for (const key of keys) {
		if (previous !== undefined && previous >= key) reject(path, "Entries must be sorted and unique.");
		previous = key;
	}
}
function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
function entityValue(value: CanonicalValue, path: string): EntityValue {
	const r = exactRecord(CONTRACT, value, path, ["typeId", "data", "links"]);
	const data = requiredField(CONTRACT, r, "data", path);
	if (!isCanonicalObject(data)) reject(path + ".data", "Entity data must be an object.");
	const links = arrayField(CONTRACT, r, "links", path, 32).map((item, i) => {
		const p = `${path}.links[${i}]`, link = exactRecord(CONTRACT, item, p, ["role", "target"]);
		return Object.freeze({role: identifier(link, "role", p), target: ref(requiredField(CONTRACT, link, "target", p), p + ".target")});
	});
	ordered(links.map(link => link.role + "\0" + entityKey(link.target)), path + ".links");
	return Object.freeze({typeId: identifier(r, "typeId", path), data, links: Object.freeze(links)});
}
function types(record: CanonicalRecord): readonly EntityType[] {
	const parsed = arrayField(CONTRACT, record, "types", "$", 32).map((value, index) => {
		const path = `$.types[${index}]`, r = exactRecord(CONTRACT, value, path, ["typeId", "fields"]);
		const fields = arrayField(CONTRACT, r, "fields", path, 32).map((item, i) => {
			const p = `${path}.fields[${i}]`, f = exactRecord(CONTRACT, item, p, ["name", "type"]);
			return Object.freeze({name: textField(CONTRACT, f, "name", p, {maximumBytes: 64, pattern: /^[a-z][a-zA-Z0-9]*$/u}), type: literalField(CONTRACT, f, "type", FIELD_TYPES, p)});
		});
		ordered(fields.map(field => field.name), path + ".fields");
		return Object.freeze({typeId: identifier(r, "typeId", path), fields: Object.freeze(fields)});
	});
	if (!parsed.length) reject("$.types", "At least one entity type is required.");
	ordered(parsed.map(type => type.typeId), "$.types");
	return Object.freeze(parsed);
}
export function decodeDefinitionRequest(value: unknown): Outcome<DefinitionRequest, ContractIssue> {
	return decodeContract(CONTRACT, value, input => {
		const r = exactRecord(CONTRACT, input, "$", ["containerId", "expectedDigest", "types"]);
		const expected = requiredField(CONTRACT, r, "expectedDigest");
		return Object.freeze({containerId: container(r), expectedDigest: expected === null ? null : digest(expected, "$.expectedDigest"), types: types(r)});
	}, CANDIDATE_LIMITS);
}
export function definitionIdentity(input: DefinitionRequest, revision: number): RecordDefinition {
	if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Definition revision exceeds supported range.");
	const identity = semanticDigest(CONTAINER_CANDIDATE_PROTOCOL + ":definition", {containerId: input.containerId, revision, types: input.types});
	if (!identity.ok) throw new Error("Validated definition failed identity derivation.");
	return Object.freeze({containerId: input.containerId, revision, types: input.types, digest: identity.value});
}
export function decodeRecordDefinition(value: unknown): Outcome<RecordDefinition, ContractIssue> {
	return decodeContract(CONTRACT, value, input => {
		const r = exactRecord(CONTRACT, input, "$", ["containerId", "revision", "types", "digest"]);
		const definition = definitionIdentity({containerId: container(r), expectedDigest: null, types: types(r)}, integerField(CONTRACT, r, "revision", "$", 1));
		if (definition.digest !== digest(requiredField(CONTRACT, r, "digest"), "$.digest")) reject("$.digest", "Definition identity differs.");
		return definition;
	}, CANDIDATE_LIMITS);
}
export function decodeCandidateRequest(value: unknown): Outcome<CandidateRequest, ContractIssue> {
	return decodeContract(CONTRACT, value, input => {
		const r = exactRecord(CONTRACT, input, "$", ["containerId", "changeId", "requestId", "definitionDigest", "effects", "dependencies"]);
		const effects = arrayField(CONTRACT, r, "effects", "$", 64).map((item, i) => {
			const path = `$.effects[${i}]`, e = exactRecord(CONTRACT, item, path, ["target", "expectedVersion", "after"]);
			const after = requiredField(CONTRACT, e, "after", path), version = requiredField(CONTRACT, e, "expectedVersion", path);
			if (after === null && version === null) reject(path, "Deleting an absent entity is not an effect.");
			return Object.freeze({target: ref(requiredField(CONTRACT, e, "target", path), path + ".target"),
				expectedVersion: version === null ? null : textField(CONTRACT, e, "expectedVersion", path, {maximumBytes: 256}),
				after: after === null ? null : entityValue(after, path + ".after")});
		});
		if (!effects.length) reject("$.effects", "At least one effect is required.");
		const dependencies = arrayField(CONTRACT, r, "dependencies", "$", 64).map((item, i) => {
			const path = `$.dependencies[${i}]`, d = exactRecord(CONTRACT, item, path, ["target", "expectedVersion"]);
			return Object.freeze({target: ref(requiredField(CONTRACT, d, "target", path), path + ".target"), expectedVersion: textField(CONTRACT, d, "expectedVersion", path, {maximumBytes: 256})});
		});
		ordered(effects.map(effect => entityKey(effect.target)), "$.effects");
		ordered(dependencies.map(item => entityKey(item.target)), "$.dependencies");
		const affected = new Map(effects.map(effect => [entityKey(effect.target), effect]));
		const required = new Set(dependencies.map(item => entityKey(item.target)));
		if (dependencies.some(item => affected.has(entityKey(item.target)))) reject("$.dependencies", "An affected entity cannot also be a read-only dependency.");
		for (const effect of effects) for (const link of effect.after?.links ?? []) {
			const target = affected.get(entityKey(link.target));
			if (target?.after === null || (!target && !required.has(entityKey(link.target)))) reject("$.effects", "Every link must target a surviving candidate entity or an explicit versioned dependency.");
		}
		return Object.freeze({containerId: container(r), changeId: digest(requiredField(CONTRACT, r, "changeId"), "$.changeId"),
			requestId: identifier(r, "requestId"), definitionDigest: digest(requiredField(CONTRACT, r, "definitionDigest"), "$.definitionDigest"),
			effects: Object.freeze(effects), dependencies: Object.freeze(dependencies)});
	}, CANDIDATE_LIMITS);
}
export function validEntityValue(definition: RecordDefinition, value: EntityValue): boolean {
	const type = definition.types.find(item => item.typeId === value.typeId), keys = Object.keys(value.data).sort(compareText);
	return type !== undefined && keys.length === type.fields.length && type.fields.every((field, index) => {
		const entry = value.data[field.name];
		let actual: string = typeof entry;
		if (entry === null) actual = "null";
		else if (Array.isArray(entry)) actual = "array";
		return keys[index] === field.name && actual === field.type;
	});
}
function observation(value: CanonicalValue): EntityObservation {
	if (!isCanonicalObject(value)) reject("$", "Observation must be an object.");
	const status = literalField(CONTRACT, value, "status", ["present", "absent", "unknown", "denied"]);
	const r = exactRecord(CONTRACT, value, "$", status === "present" ? ["status", "version", "value"] : ["status"]);
	return status === "present" ? Object.freeze({status, version: textField(CONTRACT, r, "version", "$", {maximumBytes: 256}), value: entityValue(requiredField(CONTRACT, r, "value"), "$.value")}) : Object.freeze({status});
}
export function decodeEntityObservation(value: unknown): Outcome<EntityObservation, ContractIssue> {
	return decodeContract(CONTRACT, value, observation, CANDIDATE_LIMITS);
}
export function decodeCandidateGrounds(value: unknown): Outcome<readonly CandidateGround[], ContractIssue> {
	return decodeContract(CONTRACT, value, input => {
		const r = exactRecord(CONTRACT, input, "$", ["grounds"]);
		const grounds = arrayField(CONTRACT, r, "grounds", "$", 128).map(item => {
			const g = exactRecord(CONTRACT, item, "$", ["target", "bindingDigest", "observation"]);
			return Object.freeze({target: ref(requiredField(CONTRACT, g, "target"), "$.target"), bindingDigest: digest(requiredField(CONTRACT, g, "bindingDigest"), "$.bindingDigest"), observation: observation(requiredField(CONTRACT, g, "observation"))});
		});
		ordered(grounds.map(ground => entityKey(ground.target)), "$.grounds");
		return Object.freeze(grounds);
	}, CANDIDATE_LIMITS);
}
export function candidateTargets(input: CandidateRequest): readonly Readonly<{target: EntityRef; expectedVersion: string | null}>[] {
	return Object.freeze([...input.effects, ...input.dependencies].map(item => Object.freeze({target: item.target, expectedVersion: item.expectedVersion}))
		.sort((a, b) => compareText(entityKey(a.target), entityKey(b.target))));
}
export function matchingGrounds(input: CandidateRequest, grounds: readonly CandidateGround[]): boolean {
	const targets = candidateTargets(input);
	return targets.length === grounds.length && targets.every((item, i) => {
		const ground = grounds[i];
		if (!ground) return false;
		return entityKey(ground.target) === entityKey(item.target) && (item.expectedVersion === null ? ground.observation.status === "absent"
			: ground.observation.status === "present" && item.expectedVersion === ground.observation.version);
	});
}
export function candidateIdentity(actor: string, input: CandidateRequest): Readonly<{candidateId: Sha256Digest; inputDigest: Sha256Digest}> {
	const candidate = semanticDigest(CONTAINER_CANDIDATE_PROTOCOL + ":identity", {containerId: input.containerId, actor, requestId: input.requestId});
	const content = semanticDigest(CONTAINER_CANDIDATE_PROTOCOL + ":input", input);
	if (!candidate.ok || !content.ok) throw new Error("Validated candidate failed identity derivation.");
	return Object.freeze({candidateId: candidate.value, inputDigest: content.value});
}
export function candidateJson(value: unknown): string {
	const encoded = canonicalJson(value, CANDIDATE_LIMITS);
	if (!encoded.ok) throw new Error("Candidate material exceeds its canonical data contract.");
	return encoded.value;
}
export function groundsIdentity(inputDigest: Sha256Digest, grounds: readonly CandidateGround[]): Sha256Digest {
	const identity = semanticDigest(CONTAINER_CANDIDATE_PROTOCOL + ":grounds", {inputDigest, grounds});
	if (!identity.ok) throw new Error("Invalid candidate grounds.");
	return identity.value;
}
export function candidateIssue(code: CandidateIssue["code"], message: string): CandidateIssue { return Object.freeze({code, message}); }
export function candidateInvalid(issue: ContractIssue): CandidateOutcome<never> { return failure(candidateIssue("invalid_input", `${issue.path}: ${issue.message}`)); }
