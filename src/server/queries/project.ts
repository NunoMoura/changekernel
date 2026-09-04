import type {
	AlignmentReadInput,
	AuditReadInput,
	ChangesReadInput,
	ChecksReadInput,
	PageInput,
	ProjectSourceSelector,
	ReviewReadInput,
	WorkReadInput,
} from "../../api/contracts/read.ts";
import {productError, type ProductError} from "../../api/transport/envelope.ts";
import type {CanonicalRecord} from "../../kernel/canonical/contract.ts";
import type {CanonicalValue} from "../../kernel/canonical/json.ts";
import {failure, success, type Outcome} from "../../kernel/canonical/outcome.ts";
import type {ChangeEvent} from "../../kernel/changes/events.ts";
import type {ChangeLifecycleState, ReducedChange, ReducedGateFact} from "../../kernel/changes/reducer.ts";
import {sha256Digest} from "../../kernel/identity/sha256.ts";
import {inspectExactWikiProvenance} from "../../kernel/wiki/views.ts";
import type {ProjectStorePort} from "../../ports/project-store.ts";
import type {AuthorizedProjectActor} from "../authorization/policy.ts";
import {wikiAuthorization} from "./wiki.ts";
import {
	loadProjectSource,
	loadWikiSource,
	type LoadedChange,
	type LoadedProjectSource,
	type ProjectReadConfiguration,
	type ProjectSourceIssue,
} from "./source.ts";

export function discoverProject(configuration: ProjectReadConfiguration): CanonicalValue {
	return Object.freeze({
		project: configuration.projectName,
		status: "available",
		nextAction: "Choose Project status, Changes, Work, Checks, Decisions, Wiki, Review, or Alignment.",
	});
}

export function readProjectCapabilities(actor: AuthorizedProjectActor): CanonicalValue {
	const labels: Readonly<Record<string, string>> = Object.freeze({
		"project.discover": "Project discovery",
		"project.capabilities": "Capabilities",
		"project.status": "Project status",
		"wiki.read": "Wiki",
		"changes.read": "Changes and Decisions",
		"checks.read": "Checks",
		"work.read": "Work",
		"review.read": "Review",
		"alignment.read": "Alignment",
		"audit.read": "Audit details",
	});
	return Object.freeze({
		available: Object.freeze(actor.capabilities.map((capability) => labels[capability] ?? capability)),
		unavailable: Object.freeze([
			Object.freeze({capability: "Agent Work", reason: "Agent Work is not available yet."}),
			Object.freeze({capability: "Preview", reason: "Preview is not available yet."}),
		]),
	});
}

export async function readProjectStatus(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	source: ProjectSourceSelector,
): Promise<Outcome<unknown, ProductError>> {
	const loaded = await authorizedProject(store, configuration, actor, source);
	if (!loaded.ok) return loaded;
	const changes = loaded.value.changes;
	const states: Record<ChangeLifecycleState, number> = {
		committed: 0,
		completed: 0,
		deferred: 0,
		proposed: 0,
		rejected: 0,
		superseded: 0,
		withdrawn: 0,
	};
	let passedChecks = 0;
	let failedChecks = 0;
	let stoppedChecks = 0;
	for (const entry of changes) {
		states[entry.reduced.state] += 1;
		for (const gate of activeGates(entry.reduced)) {
			if (gate.status === "passed") passedChecks += 1;
			else if (gate.status === "failed") failedChecks += 1;
			else stoppedChecks += 1;
		}
	}
	const active = changes.filter((entry) => ["proposed", "deferred", "committed"].includes(entry.reduced.state));
	let status = "ready";
	if (failedChecks > 0 || stoppedChecks > 0 || active.some((entry) => userActionRequired(entry.reduced.state))) {
		status = "attention_needed";
	} else if (active.length > 0) status = "in_progress";
	return success(Object.freeze({
		project: configuration.projectName,
		status,
		changes: Object.freeze({total: changes.length, states: Object.freeze(states)}),
		work: Object.freeze({
			total: changes.reduce((count, entry) => count + entry.reduced.work.length, 0),
			ready: changes.reduce((count, entry) => count + entry.reduced.work.filter((work) => work.status === "planned").length, 0),
		}),
		checks: Object.freeze({passed: passedChecks, failed: failedChecks, stopped: stoppedChecks}),
		nextActions: Object.freeze(active.slice(0, 10).map((entry) => Object.freeze({
			changeId: entry.reduced.change.changeId,
			action: nextAction(entry.reduced),
			userActionRequired: userActionRequired(entry.reduced.state) || activeGates(entry.reduced).some((gate) => gate.status !== "passed"),
		}))),
	}));
}

export async function readChanges(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: ChangesReadInput,
): Promise<Outcome<unknown, ProductError>> {
	const loaded = await authorizedProject(store, configuration, actor, input.source);
	if (!loaded.ok) return loaded;
	if (input.view === "get") {
		const found = loaded.value.changes.find((entry) => entry.reduced.change.changeId === input.changeId);
		if (!found) return failure(notFound("Change"));
		return success(changeDetail(found, actor));
	}
	if (input.view === "decisions") {
		const decisions = matchingChanges(loaded.value.changes, input.changeId).flatMap(decisionRows);
		const selected = page(decisions, input, (entry) => entry.key, pageScope("decisions", loaded.value, actor, input.changeId));
		if (!selected.ok) return selected;
		return success(pageResponse("decisions", selected.value, (entry) => entry.value));
	}
	const selected = page(loaded.value.changes, input, (entry) => entry.reduced.change.changeId, pageScope("changes", loaded.value, actor, null));
	if (!selected.ok) return selected;
	return success(pageResponse("changes", selected.value, (entry) => changeSummary(entry.reduced)));
}

export async function readChecks(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: ChecksReadInput,
): Promise<Outcome<unknown, ProductError>> {
	const loaded = await authorizedProject(store, configuration, actor, input.source);
	if (!loaded.ok) return loaded;
	const rows = matchingChanges(loaded.value.changes, input.changeId)
		.flatMap((entry) => activeGates(entry.reduced).map((gate) => Object.freeze({
			key: `${entry.reduced.change.changeId}:check:${gate.stage}:${gate.workId ?? "change"}`,
			changeId: entry.reduced.change.changeId,
			stage: gate.stage,
			status: gate.status,
			workId: gate.workId,
			runs: gate.runDigests.length,
			results: gate.resultDigests.length,
			evidence: gate.evidenceDigests.length,
		})));
	const selected = page(rows, input, (entry) => entry.key, pageScope(`checks:${input.view}`, loaded.value, actor, input.changeId));
	if (!selected.ok) return selected;
	return success(pageResponse(input.view, selected.value, (entry) => checkProjection(input.view, entry)));
}

export async function readWork(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: WorkReadInput,
): Promise<Outcome<unknown, ProductError>> {
	const loaded = await authorizedProject(store, configuration, actor, input.source);
	if (!loaded.ok) return loaded;
	const rows = matchingChanges(loaded.value.changes, input.changeId)
		.flatMap((entry) => entry.reduced.work.map((work) => Object.freeze({entry, work})));
	const selected = page(rows, input, (row) => `${row.entry.reduced.change.changeId}:${row.work.work.workId}`, pageScope("work", loaded.value, actor, input.changeId));
	if (!selected.ok) return selected;
	return success(pageResponse("work", selected.value, ({entry, work}) => Object.freeze({
		changeId: entry.reduced.change.changeId,
		workId: work.work.workId,
		type: safeText(work.work.workType),
		status: work.status,
		dependencies: work.work.dependencies,
		targets: Object.freeze(work.work.targets.flatMap((target) =>
			wikiIdVisible(actor, target.itemId) ? [Object.freeze({itemId: target.itemId, facets: target.facets})] : [])),
		acceptance: Object.freeze(work.work.acceptance.map(safeText)),
		nextAction: workNextAction(work.status),
		userActionRequired: false,
	})));
}

export async function readReview(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: ReviewReadInput,
): Promise<Outcome<unknown, ProductError>> {
	const loaded = await authorizedProject(store, configuration, actor, input.source);
	if (!loaded.ok) return loaded;
	const found = loaded.value.changes.find((entry) => entry.reduced.change.changeId === input.changeId);
	if (!found) return failure(notFound("Review"));
	return success(reviewProjection(input.changeId, found.reduced));
}

export async function readAlignment(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: AlignmentReadInput,
): Promise<Outcome<unknown, ProductError>> {
	const loaded = await authorizedProject(store, configuration, actor, input.source);
	if (!loaded.ok) return loaded;
	const rows = matchingChanges(loaded.value.changes, input.changeId)
		.flatMap((entry) => entry.reduced.change.targets.flatMap((target) =>
			wikiIdVisible(actor, target.itemId) ? [Object.freeze({entry, target})] : []));
	const selected = page(rows, input, (row) => `${row.entry.reduced.change.changeId}:${row.target.itemId}`, pageScope("alignment", loaded.value, actor, input.changeId));
	if (!selected.ok) return selected;
	return success(pageResponse("alignment", selected.value, ({entry, target}) => Object.freeze({
		changeId: entry.reduced.change.changeId,
		itemId: target.itemId,
		facets: target.facets,
		status: alignmentStatus(entry.reduced.state),
		nextAction: alignmentAction(entry.reduced.state),
		userActionRequired: userActionRequired(entry.reduced.state) || activeGates(entry.reduced).some((gate) => gate.status !== "passed"),
	})));
}

export async function readAudit(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: AuditReadInput,
): Promise<Outcome<unknown, ProductError>> {
	if (input.view === "wiki-provenance") {
		const loaded = await loadWikiSource(store, configuration, input.source);
		if (!loaded.ok) return failure(sourceError(loaded.error));
		const authorization = wikiAuthorization(loaded.value.wiki, actor);
		if (!authorization.ok) return authorization;
		const view = inspectExactWikiProvenance(loaded.value.wiki, {authorization: authorization.value, itemId: input.itemId});
		if (!view.ok) return failure(notFound("Wiki Item"));
		return success(Object.freeze({source: loaded.value.snapshot, view: view.value}));
	}
	if (input.view === "source") {
		const loaded = await loadWikiSource(store, configuration, input.source);
		if (!loaded.ok) return failure(sourceError(loaded.error));
		const authorization = wikiAuthorization(loaded.value.wiki, actor);
		if (!authorization.ok) return authorization;
		return success(Object.freeze({
			repositoryId: configuration.repositoryId,
			snapshot: loaded.value.snapshot,
			kernelBuildDigest: configuration.kernelBuildDigest,
			wikiItemCount: authorization.value.visibility === "all"
				? loaded.value.wiki.items.length
				: authorization.value.itemIds.length,
		}));
	}
	const loaded = await authorizedProject(store, configuration, actor, input.source);
	if (!loaded.ok) return loaded;
	if (actor.wikiItemIds !== null) return failure(productError(
		"authorization_denied",
		"Full Change audit requires access to every referenced Wiki Item.",
		"Ask a maintainer for full audit access.",
		true,
	));
	const found = loaded.value.changes.find((entry) => entry.reduced.change.changeId === input.changeId);
	if (!found) return failure(notFound("Change"));
	return success(Object.freeze({
		source: loaded.value.snapshot,
		path: found.path,
		blob: found.blob,
		trace: found.trace,
		reduced: found.reduced,
	}));
}

async function authorizedProject(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	source: ProjectSourceSelector,
): Promise<Outcome<LoadedProjectSource, ProductError>> {
	const loaded = await loadProjectSource(store, configuration, source, actor.changeIds);
	if (!loaded.ok) return failure(sourceError(loaded.error));
	const wikiAccess = wikiAuthorization(loaded.value.wiki, actor);
	if (!wikiAccess.ok) return wikiAccess;
	const visibleWikiIds = wikiAccess.value.visibility === "all" ? null : new Set(wikiAccess.value.itemIds);
	let changes = loaded.value.changes.filter((entry) =>
		changeVisible(actor, entry.reduced.change.changeId) &&
		(visibleWikiIds === null || entry.reduced.change.targets.every((target) => visibleWikiIds.has(target.itemId))));
	if (actor.changeIds !== null) {
		let changed = true;
		while (changed) {
			const visibleChangeIds = new Set(changes.map((entry) => entry.reduced.change.changeId));
			const filtered = changes.filter((entry) => entry.reduced.change.relationships.every((relation) => visibleChangeIds.has(relation.changeId)));
			changed = filtered.length !== changes.length;
			changes = filtered;
		}
	}
	return success(Object.freeze({...loaded.value, changes: Object.freeze(changes)}));
}

function activeGates(change: ReducedChange): readonly ReducedGateFact[] {
	const latest = new Map<string, ReducedGateFact>();
	for (const gate of change.gates) latest.set(`${gate.stage}\0${gate.workId ?? ""}`, gate);
	return Object.freeze([...latest.values()]);
}

interface CheckProjectionRow {
	readonly changeId: string;
	readonly stage: string;
	readonly status: string;
	readonly workId: string | null;
	readonly runs: number;
	readonly results: number;
	readonly evidence: number;
}

function checkProjection(view: ChecksReadInput["view"], entry: CheckProjectionRow): CanonicalValue {
	const nextAction = entry.status === "passed"
		? "Continue with the next Change stage."
		: "Resolve the Check outcome before continuing.";
	const required = entry.status !== "passed";
	if (view === "gates") return Object.freeze({
		changeId: entry.changeId,
		stage: entry.stage,
		status: entry.status,
		workId: entry.workId,
		nextAction,
		userActionRequired: required,
	});
	return Object.freeze({
		changeId: entry.changeId,
		stage: entry.stage,
		status: entry.status,
		runs: entry.runs,
		results: entry.results,
		evidence: entry.evidence,
		nextAction,
		userActionRequired: required,
	});
}

function reviewProjection(changeId: string, change: ReducedChange): CanonicalValue {
	const review = change.review;
	if (review === null) return Object.freeze({
		changeId,
		status: "not_started",
		integratedWorkIds: Object.freeze([]),
		nextAction: "Finish and integrate the planned Work before Review.",
		userActionRequired: false,
	});
	const passed = review.gate?.status === "passed";
	return Object.freeze({
		changeId,
		status: review.gate?.status ?? "checks_pending",
		integratedWorkIds: review.reconciliation.integratedWorkIds,
		nextAction: passed
			? "Complete the Change when the reviewed Project state is still current."
			: "Resolve Review feedback and run the required Checks again.",
		userActionRequired: review.gate !== null && review.gate.status !== "passed",
	});
}

function matchingChanges(changes: readonly LoadedChange[], changeId: string | null): readonly LoadedChange[] {
	return changeId === null ? changes : changes.filter((entry) => entry.reduced.change.changeId === changeId);
}

function changeSummary(change: ReducedChange): CanonicalRecord {
	const gates = activeGates(change);
	return Object.freeze({
		changeId: change.change.changeId,
		intent: safeText(change.change.intent),
		type: change.change.changeType,
		realization: change.change.realization,
		status: change.state,
		work: Object.freeze({total: change.work.length, integrated: change.work.filter((entry) => entry.status === "integrated").length}),
		checks: Object.freeze({
			passed: gates.filter((entry) => entry.status === "passed").length,
			failed: gates.filter((entry) => entry.status === "failed").length,
			stopped: gates.filter((entry) => entry.status === "stopped").length,
		}),
		nextAction: nextAction(change),
		userActionRequired: userActionRequired(change.state) || gates.some((gate) => gate.status !== "passed"),
	});
}

function changeDetail(entry: LoadedChange, actor: AuthorizedProjectActor): CanonicalValue {
	const change = entry.reduced.change;
	return Object.freeze({
		...changeSummary(entry.reduced),
		rationale: safeText(change.rationale),
		acceptance: Object.freeze(change.acceptance.map(safeText)),
		targets: Object.freeze(change.targets.flatMap((target) =>
			wikiIdVisible(actor, target.itemId) ? [Object.freeze({itemId: target.itemId, facets: target.facets})] : [])),
		relationships: Object.freeze(change.relationships.flatMap((relation) =>
			changeVisible(actor, relation.changeId) ? [Object.freeze({kind: relation.kind, changeId: relation.changeId})] : [])),
	});
}

function decisionRows(entry: LoadedChange): readonly Readonly<{key: string; value: CanonicalValue}>[] {
	const output: Readonly<{key: string; value: CanonicalValue}>[] = [];
	entry.trace.events.forEach((event, index) => {
		const value = decisionValue(entry.reduced.change.changeId, event);
		if (value !== null) output.push(Object.freeze({key: `${entry.reduced.change.changeId}:decision:${String(index).padStart(8, "0")}`, value}));
	});
	return Object.freeze(output);
}

function decisionValue(changeId: string, event: ChangeEvent): CanonicalValue | null {
	if (!(event.kind === "change.committed" || event.kind === "change.deferred" || event.kind === "change.rejected" ||
		event.kind === "change.resumed" || event.kind === "change.withdrawn")) return null;
	let decision: string;
	let reason = "The Change was accepted for governed realization.";
	if (event.kind === "change.committed") decision = "accepted";
	else if (event.kind === "change.resumed") {
		decision = "resumed";
		reason = eventReason(event);
	} else {
		decision = event.kind.slice("change.".length);
		reason = eventReason(event);
	}
	return Object.freeze({
		changeId,
		decision,
		reason,
		occurredAt: event.occurredAt,
		nextAction: decision === "accepted" ? "Continue to Work planning." : "Review the Decision before taking another action.",
		userActionRequired: decision === "deferred",
	});
}

function eventReason(event: ChangeEvent): string {
	if (!("reason" in event.payload) || typeof event.payload.reason !== "string") return "No reason was recorded.";
	return safeText(event.payload.reason);
}

interface PageResult<Row> {
	readonly rows: readonly Row[];
	readonly total: number;
	readonly nextCursor: string | null;
	readonly more: boolean;
}

function page<Row>(
	rows: readonly Row[],
	input: PageInput,
	key: (row: Row) => string,
	scope: string,
): Outcome<PageResult<Row>, ProductError> {
	const ordered = [...rows].sort((left, right) => compareText(key(left), key(right)));
	const cursors = ordered.map((row) => pageCursor(scope, key(row)));
	let start = 0;
	if (input.cursor !== null) {
		const index = cursors.findIndex((cursor) => cursor === input.cursor);
		if (index < 0) return failure(productError(
			"invalid_request",
			"The result cursor is no longer valid for this read.",
			"Refresh the result and continue from the new page.",
			false,
		));
		start = index + 1;
	}
	const selected = ordered.slice(start, start + input.limit);
	const more = start + selected.length < ordered.length;
	return success(Object.freeze({
		rows: Object.freeze(selected),
		total: ordered.length,
		nextCursor: more && selected.length > 0 ? cursors[start + selected.length - 1] ?? null : null,
		more,
	}));
}

function pageResponse<Row>(
	kind: string,
	pageValue: PageResult<Row>,
	project: (row: Row) => CanonicalValue,
): CanonicalValue {
	return Object.freeze({
		kind,
		items: Object.freeze(pageValue.rows.map(project)),
		coverage: Object.freeze({returned: pageValue.rows.length, complete: !pageValue.more}),
		nextCursor: pageValue.nextCursor,
		more: pageValue.more,
		unknowns: pageValue.more
			? Object.freeze(["More authorized information exists beyond this page."])
			: Object.freeze([]),
	});
}

function pageCursor(scope: string, key: string): string {
	return `cw:cursor:${sha256Digest(`${scope}\0${key}`).slice("sha256:".length)}`;
}

function pageScope(
	kind: string,
	project: LoadedProjectSource,
	actor: AuthorizedProjectActor,
	filter: string | null,
): string {
	return sha256Digest(JSON.stringify([
		kind,
		project.snapshot.repositoryId,
		project.snapshot.commit.algorithm,
		project.snapshot.commit.hex,
		actor.authorizationId,
		actor.wikiItemIds,
		actor.changeIds,
		filter,
	]));
}

function workNextAction(status: ReducedChange["work"][number]["status"]): string {
	if (status === "planned") return "Start this Work when its dependencies are ready.";
	if (status === "assigned" || status === "claimed") return "Complete this Work and run its required Checks.";
	if (status === "result_recorded") return "Integrate the checked Work result.";
	return "Continue to Review when all Work is integrated.";
}

function nextAction(change: ReducedChange): string {
	if (change.state === "proposed") return "Review the Change and record a Decision.";
	if (change.state === "deferred") return "Resume the Change when its blocking concern is resolved.";
	if (change.state === "committed" && change.work.length === 0) return "Plan the Work required to realize this Change.";
	if (change.state === "committed" && change.work.some((entry) => entry.status !== "integrated")) return "Complete the next ready Work unit and its Checks.";
	if (change.state === "committed" && change.review?.gate?.status !== "passed") return "Review the integrated Change and resolve any failed Checks.";
	if (change.state === "committed") return "Complete the reviewed Change.";
	return "No action is required for this Change.";
}

function userActionRequired(state: ChangeLifecycleState): boolean {
	return state === "proposed" || state === "deferred";
}

function alignmentStatus(state: ChangeLifecycleState): "aligned" | "gap" | "proposed" | "inactive" {
	if (state === "completed") return "aligned";
	if (state === "committed") return "gap";
	if (state === "proposed" || state === "deferred") return "proposed";
	return "inactive";
}

function alignmentAction(state: ChangeLifecycleState): string {
	if (state === "completed") return "No action is required.";
	if (state === "committed") return "Complete the Change-owned Work and Review.";
	if (state === "proposed" || state === "deferred") return "Resolve the pending Decision before realization begins.";
	return "Create a new Change if this outcome is still desired.";
}

function safeText(value: string): string {
	return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, "�");
}

function changeVisible(actor: AuthorizedProjectActor, changeId: string): boolean {
	return actor.changeIds === null || actor.changeIds.includes(changeId);
}

function wikiIdVisible(actor: AuthorizedProjectActor, itemId: string): boolean {
	return actor.wikiItemIds === null || actor.wikiItemIds.includes(itemId);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function sourceError(value: ProjectSourceIssue): ProductError {
	if (value.code === "source_not_found") return productError("source_not_found", "The requested Project source does not exist.", "Choose the current Project or another available Change.", false);
	if (value.code === "source_stale") return productError("source_stale", "The Project changed before this read completed.", "Refresh and retry from the current Project state.", false);
	if (value.code === "limit_exceeded") return productError("limit_exceeded", "The requested Project information exceeds the safe read bounds.", "Narrow the request and retry.", false);
	return productError("invalid_project_state", "The selected Project state could not be validated.", "Ask a maintainer to inspect the Project state.", true);
}

function notFound(kind: string): ProductError {
	return productError("not_found", `${kind} was not found.`, `Choose another ${kind} and retry.`, false);
}
