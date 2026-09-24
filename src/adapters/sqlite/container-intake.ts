import {DatabaseSync} from "node:sqlite";
import {decodeIntake, intakeIdentity, intakeIssue, intakeReceipt, type ContainerIdentity, type IntakeOutcome, type IntakeReceipt, type ProposedIntake} from "../../kernel/containers/intake.ts";
import {failure, success} from "../../kernel/data-contracts/outcome.ts";
import type {Sha256Digest} from "../../kernel/identity/sha256.ts";
import type {ContainerIntakeStore} from "../../ports/container-intake-store.ts";

export interface LocalContainerIntakeStore extends ContainerIntakeStore {
	close(): void;
}

/** Opens an application-chosen persistent file. Caller owns its location, access controls and backups. */
export function openSqliteContainerIntake(path: string): LocalContainerIntakeStore {
	if (!path || path === ":memory:" || path.startsWith("file:")) throw new Error("A persistent application-supplied SQLite file path is required.");
	const db = new DatabaseSync(path, {timeout: 5_000});
	try {
		db.exec("PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL; BEGIN IMMEDIATE");
		try {
			db.exec(`
				CREATE TABLE IF NOT EXISTS ck_intake_schema (id INTEGER PRIMARY KEY CHECK(id = 1), version TEXT NOT NULL) STRICT;
				CREATE TABLE IF NOT EXISTS ck_intake_containers (
					container_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL
				) STRICT;
				CREATE TABLE IF NOT EXISTS ck_intake_changes (
					container_id TEXT NOT NULL REFERENCES ck_intake_containers(container_id),
					change_id TEXT NOT NULL, owner_id TEXT NOT NULL, request_id TEXT NOT NULL,
					input_digest TEXT NOT NULL, what_text TEXT NOT NULL, why_text TEXT NOT NULL,
					PRIMARY KEY(container_id, change_id), UNIQUE(container_id, owner_id, request_id)
				) STRICT;
			`);
			db.prepare("INSERT OR IGNORE INTO ck_intake_schema(id, version) VALUES (1, ?)").run("changekernel.container-intake-store@1.0.0");
			const marker = db.prepare("SELECT version FROM ck_intake_schema WHERE id = 1").get() as {version?: unknown} | undefined;
			if (marker?.version !== "changekernel.container-intake-store@1.0.0") throw new Error("Unsupported container intake schema; no migration was performed.");
			db.exec("COMMIT");
		} catch (error) { db.exec("ROLLBACK"); throw error; }
	} catch (error) { db.close(); throw error; }

	function guarded<T>(action: () => IntakeOutcome<T>): IntakeOutcome<T> {
		try { return action(); }
		catch { return failure(intakeIssue("unavailable", "Intake store outcome is unresolved; inspect storage before retrying.")); }
	}
	function transaction<T>(action: () => IntakeOutcome<T>): IntakeOutcome<T> {
		return guarded(() => {
			db.exec("BEGIN IMMEDIATE");
			try {
				const result = action();
				db.exec("COMMIT");
				return result;
			} catch (error) { db.exec("ROLLBACK"); throw error; }
		});
	}
	function authorized(input: ContainerIdentity, actor: string): boolean {
		return Boolean(db.prepare("SELECT 1 FROM ck_intake_containers WHERE container_id = ? AND owner_id = ?").get(input.containerId, actor));
	}
	function retained(input: ContainerIdentity, changeId: Sha256Digest, actor: string): IntakeOutcome<IntakeReceipt> {
		const row = db.prepare(`SELECT request_id, input_digest, what_text, why_text FROM ck_intake_changes
			WHERE container_id = ? AND change_id = ? AND owner_id = ?`).get(input.containerId, changeId, actor) as
			{request_id: unknown; input_digest: unknown; what_text: unknown; why_text: unknown} | undefined;
		if (!row) return failure(intakeIssue("denied", "Container or Change is unavailable to this actor."));
		const decoded = decodeIntake({containerId: input.containerId, requestId: row.request_id, what: row.what_text, why: row.why_text});
		if (!decoded.ok) return failure(intakeIssue("unavailable", "Retained intake is invalid; investigation is required."));
		const identity = intakeIdentity(actor, decoded.value);
		if (identity.changeId !== changeId || identity.inputDigest !== row.input_digest) {
			return failure(intakeIssue("unavailable", "Retained intake identity differs; investigation is required."));
		}
		return success(intakeReceipt(decoded.value, identity));
	}
	return Object.freeze({
		protocol: "changekernel.container-intake-store@1.0.0" as const,
		create(input: ContainerIdentity, actor: string): IntakeOutcome<ContainerIdentity> {
			return transaction(() => {
				db.prepare("INSERT OR IGNORE INTO ck_intake_containers(container_id, owner_id) VALUES (?, ?)").run(input.containerId, actor);
				return authorized(input, actor) ? success(input) : failure(intakeIssue("denied", "Container is unavailable to this actor."));
			});
		},
		open(input: ContainerIdentity, actor: string): IntakeOutcome<ContainerIdentity> {
			return guarded(() => authorized(input, actor) ? success(input) : failure(intakeIssue("denied", "Container is unavailable to this actor.")));
		},
		propose(input: ProposedIntake, actor: string): IntakeOutcome<IntakeReceipt> {
			return transaction(() => {
				if (!authorized(input, actor)) return failure(intakeIssue("denied", "Container is unavailable to this actor."));
				const identity = intakeIdentity(actor, input);
				const existing = db.prepare("SELECT change_id, input_digest FROM ck_intake_changes WHERE container_id = ? AND owner_id = ? AND request_id = ?")
					.get(input.containerId, actor, input.requestId) as {change_id: unknown; input_digest: unknown} | undefined;
				if (existing) {
					if (existing.change_id !== identity.changeId || existing.input_digest !== identity.inputDigest) {
						return failure(intakeIssue("conflict", "Request identity is already bound to different input."));
					}
					return retained(input, identity.changeId, actor);
				}
				db.prepare(`INSERT INTO ck_intake_changes
					(container_id, change_id, owner_id, request_id, input_digest, what_text, why_text)
					VALUES (?, ?, ?, ?, ?, ?, ?)`).run(input.containerId, identity.changeId, actor, input.requestId,
					identity.inputDigest, input.what, input.why);
				return retained(input, identity.changeId, actor);
			});
		},
		read(input: ContainerIdentity, changeId: Sha256Digest, actor: string): IntakeOutcome<IntakeReceipt> {
			return guarded(() => authorized(input, actor) ? retained(input, changeId, actor)
				: failure(intakeIssue("denied", "Container or Change is unavailable to this actor.")));
		},
		close(): void { db.close(); },
	});
}
