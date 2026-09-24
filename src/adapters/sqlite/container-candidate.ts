import {DatabaseSync, type SQLOutputValue} from "node:sqlite";
import {CANDIDATE_LIMITS, GENERIC_ENTITY_SOURCE, candidateIdentity, candidateIssue, candidateJson, candidateTargets, decodeCandidateGrounds, decodeCandidateRequest, decodeEntityObservation, decodeRecordDefinition, definitionIdentity, groundsIdentity, matchingGrounds, validEntityValue, type CandidateGround, type CandidateOutcome, type CandidateRequest, type ChangeCandidate, type ContainerDescription, type DefinitionRequest, type EntityRef, type RecordDefinition} from "../../kernel/containers/candidate.ts";
import {decodeIntake, intakeIdentity, type ContainerIdentity} from "../../kernel/containers/intake.ts";
import {parseCanonicalJson, type CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success} from "../../kernel/data-contracts/outcome.ts";
import {isNamespacedIdentifier} from "../../kernel/data-contracts/validation.ts";
import {decodeSha256Digest, sha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import type {CandidateObservationSource, ContainerCandidateStore} from "../../ports/container-candidate-store.ts";

export interface LocalContainerCandidateStore extends ContainerCandidateStore { close(): void }
const VERSION = "changekernel.container-candidate-batch-store@1.0.0";
const GENERIC_BINDING = sha256Digest(VERSION + ":generic-entities-v1");

/** Additive draft capability. Requires intake v1; no legacy schema upgrades or effect execution. */
export function openSqliteContainerCandidates(path: string, sources: readonly CandidateObservationSource[] = []): LocalContainerCandidateStore {
	if (typeof path !== "string" || !path || path === ":memory:" || path.startsWith("file:")) throw new Error("A persistent application-supplied SQLite file path is required.");
	const bindings = new Map<string, CandidateObservationSource>();
	if (sources.length > 32) throw new Error("Too many observation bindings.");
	for (const source of sources) {
		if (!isNamespacedIdentifier(source.sourceId) || source.sourceId === GENERIC_ENTITY_SOURCE || bindings.has(source.sourceId) || !decodeSha256Digest(source.bindingDigest).ok || typeof source.observe !== "function") throw new Error("Invalid or duplicate observation binding.");
		bindings.set(source.sourceId, Object.freeze({sourceId: source.sourceId, bindingDigest: source.bindingDigest, observe: source.observe.bind(source)}));
	}
	const db = new DatabaseSync(path);
	try {
		db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL; BEGIN IMMEDIATE");
		try {
			const intake = db.prepare("SELECT version FROM ck_intake_schema WHERE id = 1").get();
			if (intake?.version !== "changekernel.container-intake-store@1.0.0") throw new Error("Compatible intake store is required; no migration was performed.");
			const markerExists = db.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'ck_candidate_schema'").get();
			if (markerExists && db.prepare("SELECT version FROM ck_candidate_schema WHERE id = 1").get()?.version !== VERSION) throw new Error("Unsupported candidate schema; no migration was performed.");
			const tables = ["ck_candidate_definitions", "ck_generic_entities", "ck_candidate_batches"];
			for (const name of tables) {
				const exists = Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE name = ?").get(name));
				if (exists !== Boolean(markerExists)) throw new Error("Incomplete or unversioned candidate storage; investigation is required.");
			}
			if (!markerExists) {
				db.exec(`
					CREATE TABLE ck_candidate_schema (id INTEGER PRIMARY KEY CHECK(id = 1), version TEXT NOT NULL) STRICT;
					CREATE TABLE ck_candidate_definitions (
						container_id TEXT NOT NULL REFERENCES ck_intake_containers(container_id),
						revision INTEGER NOT NULL, digest TEXT NOT NULL, expected_digest TEXT, definition_json TEXT NOT NULL,
						PRIMARY KEY(container_id, revision), UNIQUE(container_id, digest)
					) STRICT;
					CREATE TABLE ck_generic_entities (
						container_id TEXT NOT NULL REFERENCES ck_intake_containers(container_id),
						entity_id TEXT NOT NULL, observation_json TEXT NOT NULL,
						PRIMARY KEY(container_id, entity_id)
					) STRICT;
					CREATE TABLE ck_candidate_batches (
						container_id TEXT NOT NULL, change_id TEXT NOT NULL, actor_id TEXT NOT NULL,
						candidate_id TEXT NOT NULL, request_id TEXT NOT NULL, input_digest TEXT NOT NULL,
						request_json TEXT NOT NULL, grounds_json TEXT NOT NULL, grounds_digest TEXT NOT NULL,
						PRIMARY KEY(container_id, candidate_id), UNIQUE(container_id, actor_id, request_id),
						FOREIGN KEY(container_id, change_id) REFERENCES ck_intake_changes(container_id, change_id)
					) STRICT;
				`);
				db.prepare("INSERT INTO ck_candidate_schema(id, version) VALUES (1, ?)").run(VERSION);
			}
			db.exec("COMMIT");
		} catch (error) { db.exec("ROLLBACK"); throw error; }
	} catch (error) { db.close(); throw error; }

	function transaction<T>(operation: () => CandidateOutcome<T>): CandidateOutcome<T> {
		try {
			db.exec("BEGIN IMMEDIATE");
			try {
				const result = operation();
				db.exec(result.ok ? "COMMIT" : "ROLLBACK");
				return result;
			} catch (error) { db.exec("ROLLBACK"); throw error; }
		} catch { return failure(candidateIssue("unavailable", "Candidate storage or observation is unavailable; no completion is established.")); }
	}
	function authorized(containerId: string, actor: string): boolean {
		return Boolean(db.prepare("SELECT 1 FROM ck_intake_containers WHERE container_id = ? AND owner_id = ?").get(containerId, actor));
	}
	function readDefinition(row: Record<string, SQLOutputValue> | undefined, containerId: string): RecordDefinition {
		if (!row) throw new Error("Missing definition.");
		const definition = decodeRecordDefinition(parse(row.definition_json));
		if (!definition.ok || definition.value.containerId !== containerId || definition.value.digest !== row.digest || definition.value.revision !== row.revision) throw new Error("Invalid retained definition identity.");
		return definition.value;
	}
	function current(containerId: string): RecordDefinition | null {
		const row = db.prepare("SELECT revision, digest, definition_json FROM ck_candidate_definitions WHERE container_id = ? ORDER BY revision DESC LIMIT 1").get(containerId);
		return row ? readDefinition(row, containerId) : null;
	}
	function definitionByDigest(containerId: string, digest: Sha256Digest): RecordDefinition {
		return readDefinition(db.prepare("SELECT revision, digest, definition_json FROM ck_candidate_definitions WHERE container_id = ? AND digest = ?").get(containerId, digest), containerId);
	}
	function linkedChange(containerId: string, changeId: Sha256Digest, actor: string): boolean {
		const row = db.prepare("SELECT owner_id, request_id, what_text, why_text, input_digest FROM ck_intake_changes WHERE container_id = ? AND change_id = ?").get(containerId, changeId);
		if (!row || row.owner_id !== actor) return false;
		const decoded = decodeIntake({containerId, requestId: row.request_id, what: row.what_text, why: row.why_text});
		if (!decoded.ok) throw new Error("Invalid retained Change.");
		const identity = intakeIdentity(actor, decoded.value);
		if (identity.changeId !== changeId || identity.inputDigest !== row.input_digest) throw new Error("Change identity differs.");
		return true;
	}
	function observe(containerId: string, actor: string, targets: readonly EntityRef[]): CandidateOutcome<readonly CandidateGround[]> {
		const grounds: CandidateGround[] = [];
		for (const target of targets) {
			let bindingDigest = GENERIC_BINDING;
			let raw: unknown;
			let localEntityExists = false;
			if (target.sourceId === GENERIC_ENTITY_SOURCE) {
				const row = db.prepare("SELECT observation_json FROM ck_generic_entities WHERE container_id = ? AND entity_id = ?").get(containerId, target.entityId);
				localEntityExists = Boolean(row);
				raw = row ? parse(row.observation_json) : {status: "absent"};
			} else {
				const source = bindings.get(target.sourceId);
				if (!source) return failure(candidateIssue("denied", "A required observation source is not authorized by this host."));
				bindingDigest = source.bindingDigest;
				raw = source.observe(Object.freeze({containerId, actor, entityId: target.entityId}));
			}
			const decoded = decodeEntityObservation(raw);
			if (!decoded.ok || (localEntityExists && decoded.value.status !== "present")) throw new Error("Source returned invalid bounded observation.");
			if (decoded.value.status === "denied") return failure(candidateIssue("denied", "Source access is denied; candidate delivery is blocked."));
			grounds.push(Object.freeze({target, bindingDigest, observation: decoded.value}));
		}
		// Enforce the total bound, not only each source response's bound.
		const decoded = decodeCandidateGrounds({grounds});
		if (!decoded.ok) throw new Error("Observation set exceeds candidate bounds.");
		return success(decoded.value);
	}
	function retained(input: ContainerIdentity, candidateId: Sha256Digest, actor: string): CandidateOutcome<ChangeCandidate> {
		const row = db.prepare("SELECT * FROM ck_candidate_batches WHERE container_id = ? AND candidate_id = ? AND actor_id = ?").get(input.containerId, candidateId, actor);
		if (!row) return failure(candidateIssue("denied", "Candidate is unavailable to this actor."));
		const decoded = decodeCandidateRequest(parse(row.request_json));
		if (!decoded.ok) throw new Error("Invalid candidate batch.");
		const request = decoded.value;
		if (request.containerId !== input.containerId || request.changeId !== row.change_id || request.requestId !== row.request_id) throw new Error("Candidate scope differs.");
		if (!linkedChange(input.containerId, request.changeId, actor)) return failure(candidateIssue("denied", "Change is unavailable to this actor."));
		const definition = definitionByDigest(input.containerId, request.definitionDigest);
		if (!validEffects(definition, request)) throw new Error("Candidate differs from pinned definition.");
		const identity = candidateIdentity(actor, request), grounds = decodeCandidateGrounds(parse(row.grounds_json));
		if (identity.candidateId !== candidateId || identity.inputDigest !== row.input_digest || !grounds.ok || !matchingGrounds(request, grounds.value)) throw new Error("Candidate or grounds identity differs.");
		const groundsDigest = groundsIdentity(identity.inputDigest, grounds.value);
		if (groundsDigest !== row.grounds_digest) throw new Error("Retained grounds changed.");
		const now = observe(input.containerId, actor, candidateTargets(request).map(item => item.target));
		if (!now.ok) return now;
		const definitionChanged = current(input.containerId)?.digest !== definition.digest;
		const changed = now.value.some((ground, i) => {
			const previous = grounds.value[i];
			return !previous || ground.bindingDigest !== previous.bindingDigest ||
				(ground.observation.status !== "unknown" && candidateJson(ground) !== candidateJson(previous));
		});
		let freshness: ChangeCandidate["freshness"] = "current";
		if (now.value.some(ground => ground.observation.status === "unknown")) freshness = "unknown";
		if (definitionChanged || changed) freshness = "stale";
		return success(Object.freeze({...request, ...identity, groundsDigest, grounds: grounds.value, status: "prepared-only", freshness}));
	}
	return Object.freeze({
		protocol: VERSION,
		install(input: DefinitionRequest, actor: string): CandidateOutcome<RecordDefinition> {
			return transaction(() => {
				if (!authorized(input.containerId, actor)) return denied();
				const previous = current(input.containerId);
				if (previous && input.expectedDigest !== previous.digest) {
					const last = db.prepare("SELECT expected_digest FROM ck_candidate_definitions WHERE container_id = ? AND revision = ?").get(input.containerId, previous.revision);
					return last?.expected_digest === input.expectedDigest && definitionIdentity(input, previous.revision).digest === previous.digest ? success(previous)
						: failure(candidateIssue("stale", "Definition changed; inspect current definition."));
				}
				if (!previous && input.expectedDigest !== null) return failure(candidateIssue("stale", "No current definition matches expected identity."));
				if (previous && definitionIdentity(input, previous.revision).digest === previous.digest) return success(previous);
				const definition = definitionIdentity(input, (previous?.revision ?? 0) + 1);
				db.prepare("INSERT INTO ck_candidate_definitions(container_id, revision, digest, expected_digest, definition_json) VALUES (?, ?, ?, ?, ?)")
					.run(input.containerId, definition.revision, definition.digest, input.expectedDigest, candidateJson(definition));
				return success(definition);
			});
		},
		describe(input: ContainerIdentity, actor: string): CandidateOutcome<ContainerDescription> {
			return transaction<ContainerDescription>(() => {
				if (!authorized(input.containerId, actor)) return denied();
				const definition = current(input.containerId);
				const exists = db.prepare("SELECT 1 FROM ck_generic_entities WHERE container_id = ? LIMIT 1").get(input.containerId);
				let genericState: ContainerDescription["genericState"] = "unknown";
				if (definition !== null) genericState = exists ? "present" : "empty";
				return success(Object.freeze({definition, genericState,
					capabilities: Object.freeze({prepare: definition !== null, publish: false, checks: false})}));
			});
		},
		prepare(input: CandidateRequest, actor: string): CandidateOutcome<ChangeCandidate> {
			return transaction(() => {
				if (!authorized(input.containerId, actor)) return denied();
				const identity = candidateIdentity(actor, input);
				const existing = db.prepare("SELECT candidate_id, input_digest FROM ck_candidate_batches WHERE container_id = ? AND actor_id = ? AND request_id = ?")
					.get(input.containerId, actor, input.requestId);
				if (existing) return existing.candidate_id === identity.candidateId && existing.input_digest === identity.inputDigest ? retained(input, identity.candidateId, actor)
					: failure(candidateIssue("conflict", "Request identity is bound to a different candidate batch."));
				if (!linkedChange(input.containerId, input.changeId, actor)) return denied();
				const definition = current(input.containerId);
				if (!definition || input.definitionDigest !== definition.digest) return failure(candidateIssue("stale", "Definition is missing or has changed."));
				if (!validEffects(definition, input)) return failure(candidateIssue("invalid_input", "An entity differs from the installed definition."));
				const grounds = observe(input.containerId, actor, candidateTargets(input).map(item => item.target));
				if (!grounds.ok) return grounds;
				if (grounds.value.some(ground => ground.observation.status === "unknown")) return failure(candidateIssue("unavailable", "Observation coverage is unknown; no candidate was prepared."));
				if (!matchingGrounds(input, grounds.value)) return failure(candidateIssue("stale", "An expected entity version or absence differs from its source."));
				const groundsDigest = groundsIdentity(identity.inputDigest, grounds.value);
				db.prepare(`INSERT INTO ck_candidate_batches(container_id, change_id, actor_id, candidate_id, request_id, input_digest, request_json, grounds_json, grounds_digest)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.containerId, input.changeId, actor, identity.candidateId, input.requestId,
					identity.inputDigest, candidateJson(input), candidateJson({grounds: grounds.value}), groundsDigest);
				// Re-observe before delivery; do not re-execute preparation on replay.
				return retained(input, identity.candidateId, actor);
			});
		},
		read(input: ContainerIdentity, candidateId: Sha256Digest, actor: string): CandidateOutcome<ChangeCandidate> {
			return transaction(() => authorized(input.containerId, actor) ? retained(input, candidateId, actor) : denied());
		},
		close(): void { db.close(); },
	});
}
function parse(text: unknown): CanonicalValue {
	if (typeof text !== "string") throw new Error("Missing retained bytes.");
	const decoded = parseCanonicalJson(text, {requireCanonicalBytes: true, limits: CANDIDATE_LIMITS});
	if (!decoded.ok) throw new Error("Invalid retained bytes.");
	return decoded.value;
}
function validEffects(definition: RecordDefinition, input: CandidateRequest): boolean {
	return input.effects.every(effect => effect.after === null || validEntityValue(definition, effect.after));
}
function denied(): CandidateOutcome<never> { return failure(candidateIssue("denied", "Container or Change is unavailable to this actor.")); }
