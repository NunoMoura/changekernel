import {isCanonicalObject, type CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";

/**
 * Lifecycle console projections over public read responses.
 * Stage progression renders two kernel entity fields only — `state.state`
 * (ChangeLifecycleState) and `gates[].stage/status` (CHECK_STAGES) — never a
 * console-invented state machine. All server text passes terminal sanitization.
 */

const GATE_ORDER = ["decision", "planning", "implementation", "review"] as const;

/** Terminal position per ChangeLifecycleState, in lifecycle order. */
const STATE_LABELS: Readonly<Record<string, string>> = Object.freeze({
	proposed: "decision",
	committed: "", // stage comes from gate progression
	deferred: "deferred",
	rejected: "rejected",
	withdrawn: "withdrawn",
	superseded: "superseded",
	completed: "completed",
});

/**
 * Sanitizes terminal output by removing ANSI escape sequences and non-printable
 * control characters. Guarantees safe rendering in any terminal.
 */
export function sanitizeTerminalText(input: string): string {
	// Strip OSC (Operating System Command) sequences: ESC ] ... BEL or ESC \
	let stripped = input.replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/gu, "");
	// Strip CSI (Control Sequence Introducer) sequences: ESC [ ... [command char]
	stripped = stripped.replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, "");
	// Strip other 2-character escape sequences
	stripped = stripped.replace(/\x1B[ -/]*[@-~]/gu, "");
	// Replace non-printable control characters (except newline \n and tab \t)
	return stripped.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/gu, "");
}

function safeString(value: unknown, fallback = ""): string {
	if (typeof value === "string") return sanitizeTerminalText(value);
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeBoolean(value: unknown, fallback = false): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return isCanonicalObject(value as CanonicalValue) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): readonly unknown[] {
	return Array.isArray(value) ? value : [];
}

interface StageProgression {
	readonly label: string;
	readonly gateSummary: string;
	readonly attention: boolean;
}

/**
 * Stage progression from kernel facts only: `state.state` plus per-stage gate
 * facts. `proposed` Change sits at the decision stage gate; `committed` Change
 * advances through planning/implementation/review gate facts; terminal states
 * are terminal. No fifth stage is invented.
 */
export function renderStageProgression(change: unknown): StageProgression {
	const rec = asRecord(change);
	if (!rec) return {label: "unknown", gateSummary: "", attention: false};
	const state = safeString(rec.status, "unknown");
	const gates = asArray(rec.gates)
		.map((gate) => {
			const g = asRecord(gate);
			return g ? {stage: safeString(g.stage), status: safeString(g.status)} : null;
		})
		.filter((g): g is {stage: string; status: string} => g !== null);

	const gateSummary = GATE_ORDER.map((stage) => {
		const gate = gates.filter((g) => g.stage === stage).at(-1);
		if (!gate) return `${stage}:—`;
		const mark = gate.status === "passed" ? "✓" : gate.status === "failed" ? "✗" : "…";
		return `${stage}:${mark}`;
	}).join(" ");

	if (state === "proposed") {
		const decision = gates.filter((g) => g.stage === "decision").at(-1);
		const attention = (!decision || decision.status !== "passed") || safeBoolean(rec.userActionRequired);
		return {label: "decision", gateSummary, attention};
	}
	if (state === "deferred") return {label: "deferred", gateSummary, attention: safeBoolean(rec.userActionRequired)};
	if (state === "committed") {
		const stage = gates.filter((g) => g.status === "passed").map((g) => g.stage).at(-1);
		let label = "committed";
		if (stage === "decision") label = "planning";
		else if (stage === "planning") label = "implementation";
		else if (stage === "implementation") label = "review";
		else if (stage === "review") label = "completion";
		return {label, gateSummary, attention: safeBoolean(rec.userActionRequired)};
	}
	const label = STATE_LABELS[state] ?? state;
	return {label, gateSummary, attention: false};
}

function attentionMark(progression: StageProgression): string {
	if (!progression.attention) return "—";
	return "needs you";
}

/**
 * Process-table over Changes: one row per Change with stage, Work, Checks, and
 * attention. The Change is the tracked primitive; the table is `ps` for them.
 */
export function renderChangesConsole(data: unknown): string {
	const record = asRecord(data);
	if (!record) return "No changes data available.";

	const items = asArray(record.items);
	if (items.length === 0) {
		return "No Changes in this project.\nPropose one through the Project Server to begin.\n";
	}

	const header = `${"ID".padEnd(14)}${"STAGE".padEnd(15)}${"WORK".padEnd(9)}${"CHECKS".padEnd(9)}ATTENTION`;
	const lines: string[] = [header, "-".repeat(header.length)];

	for (const item of items) {
		const rec = asRecord(item);
		if (!rec) continue;
		const changeId = safeString(rec.changeId, "unknown");
		const displayId = changeId.length > 12 ? `${changeId.slice(0, 12)}…` : changeId;
		const progression = renderStageProgression(rec);
		const workRec = asRecord(rec.work);
		const workTotal = safeNumber(workRec?.total);
		const workIntegrated = safeNumber(workRec?.integrated);
		const checksRec = asRecord(rec.checks);
		const checksPassed = safeNumber(checksRec?.passed);
		const checksFailed = safeNumber(checksRec?.failed);
		const totalChecks = checksPassed + checksFailed;
		const workCell = workTotal === 0 ? "—" : `${workIntegrated}/${workTotal}`;
		const checksCell = totalChecks === 0 ? "—" : `${checksPassed}/${totalChecks}`;

		lines.push(
			displayId.padEnd(14) +
			progression.label.padEnd(15) +
			workCell.padEnd(9) +
			checksCell.padEnd(9) +
			attentionMark(progression),
		);
	}

	lines.push("", "Detail: codewiki change <id>   Verification: codewiki checks   Audit: codewiki trace <id>");
	return `${lines.join("\n")}\n`;
}

/**
 * Per-stage detail for one Change. Sections render only what exists at the
 * current stage; the verification strip (gates) is always visible.
 */
export function renderChangeDetailConsole(data: unknown): string {
	const rec = asRecord(data);
	if (!rec) return "No change details available.";

	const changeId = safeString(rec.changeId, "unknown");
	const intent = safeString(rec.intent, "No intent stated.");
	const rationale = safeString(rec.rationale, "");
	const progression = renderStageProgression(rec);

	const lines: string[] = [
		`${changeId} — ${progression.label} — "${intent}"`,
	];
	if (rationale) lines.push(`Why: ${rationale}`);
	lines.push("", `  Gates:  ${progression.gateSummary}`);

	const workRec = asRecord(rec.work);
	const workTotal = safeNumber(workRec?.total);
	const workIntegrated = safeNumber(workRec?.integrated);
	if (workTotal > 0) lines.push(`  Work:   ${workIntegrated}/${workTotal} integrated`);

	const checksRec = asRecord(rec.checks);
	const checksPassed = safeNumber(checksRec?.passed);
	const checksFailed = safeNumber(checksRec?.failed);
	const checksStopped = safeNumber(checksRec?.stopped);
	if (checksPassed + checksFailed + checksStopped > 0) {
		lines.push(`  Checks: ${checksPassed} passed, ${checksFailed} failed, ${checksStopped} stopped`);
	}

	const acceptance = asArray(rec.acceptance).map((entry) => safeString(entry)).filter((entry) => entry.length > 0);
	if (acceptance.length > 0) {
		lines.push("", "  Acceptance:");
		for (const criterion of acceptance) lines.push(`  - ${criterion}`);
	}

	const nextAction = safeString(rec.nextAction, "");
	if (nextAction) lines.push("", `Next: ${nextAction}`);
	lines.push(`User action: ${progression.attention ? "yes — your decision or intervention is required" : "none at this time"}`);

	return `${lines.join("\n")}\n`;
}

/**
 * Gates across Changes: the verification-focused view. One row per active gate.
 */
export function renderChecksConsole(data: unknown): string {
	const record = asRecord(data);
	if (!record) return "No checks data available.";

	const items = asArray(record.items);
	if (items.length === 0) {
		return "No active Gates or Checks.\n";
	}

	const header = `${"CHANGE".padEnd(14)}${"STAGE".padEnd(16)}STATUS`;
	const lines: string[] = [header, "-".repeat(header.length)];

	for (const item of items) {
		const rec = asRecord(item);
		if (!rec) continue;
		const changeId = safeString(rec.changeId, "unknown");
		const displayId = changeId.length > 12 ? `${changeId.slice(0, 12)}…` : changeId;
		const stage = safeString(rec.stage, "unknown");
		const status = safeString(rec.status, "unknown");
		const userRequired = safeBoolean(rec.userActionRequired);
		lines.push(
			displayId.padEnd(14) +
			stage.padEnd(16) +
			(status + (userRequired ? " — needs you" : "")),
		);
	}

	return `${lines.join("\n")}\n`;
}

/**
 * Project header: readiness, counts, and what needs the user. Answers the five
 * questions in three lines; detail lives in the per-verb views.
 */
export function renderProjectStatusConsole(data: unknown): string {
	const record = asRecord(data);
	if (!record) return "No project status available.";

	const project = safeString(record.project, "Unknown Project");
	const rawStatus = safeString(record.status, "unknown");
	const statusLabel = formatStatusLabel(rawStatus);
	const changesRec = asRecord(record.changes);
	const totalChanges = safeNumber(changesRec?.total);
	const workRec = asRecord(record.work);
	const totalWork = safeNumber(workRec?.total);
	const checksRec = asRecord(record.checks);
	const failedChecks = safeNumber(checksRec?.failed);
	const stoppedChecks = safeNumber(checksRec?.stopped);
	const nextActions = asArray(record.nextActions);
	const attentionCount = nextActions.filter((item) => safeBoolean(asRecord(item)?.userActionRequired)).length;

	const lines = [
		`${project} — ${statusLabel}`,
		`Changes: ${totalChanges}   Work: ${totalWork}   Checks failing/stopped: ${failedChecks + stoppedChecks}`,
		attentionCount > 0
			? `Needs you: ${attentionCount} decision${attentionCount === 1 ? "" : "s"} — run: codewiki changes`
			: "Needs you: nothing — all clear",
	];
	return `${lines.join("\n")}\n`;
}

function formatStatusLabel(rawStatus: string): string {
	if (rawStatus === "ready") return "Ready";
	if (rawStatus === "in_progress") return "In progress";
	if (rawStatus === "attention_needed") return "Attention needed";
	return rawStatus;
}
/**
 * Bounded audit view for one Change Trace. Technical identities stay in audit
 * views only; plain views never show digests.
 */
export function renderTraceConsole(data: unknown): string {
	const rec = asRecord(data);
	if (!rec) return "No trace data available.";

	const changeId = safeString(rec.changeId, "unknown");
	const state = safeString(rec.state, "unknown");
	const lines = [
		`Change Trace: ${changeId}`,
		`Lifecycle:    ${state}`,
	];
	const latestEventDigest = safeString(rec.latestEventDigest, "");
	const traceDigest = safeString(rec.traceDigest, "");
	if (latestEventDigest) lines.push(`Latest event: ${latestEventDigest}`);
	if (traceDigest) lines.push(`Trace digest: ${traceDigest}`);
	lines.push("Full append-only event history lives in the managed Git ref.");
	return `${lines.join("\n")}\n`;
}

/**
 * Universal console dispatcher over supported views.
 */
export function renderConsole(
	view: "status" | "changes" | "change" | "checks" | "trace",
	data: unknown,
): string {
	switch (view) {
		case "status": return renderProjectStatusConsole(data);
		case "changes": return renderChangesConsole(data);
		case "change": return renderChangeDetailConsole(data);
		case "checks": return renderChecksConsole(data);
		case "trace": return renderTraceConsole(data);
		default: return "Unsupported console view.\n";
	}
}
