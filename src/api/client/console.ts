import {isCanonicalObject, type CanonicalValue} from "../../kernel/canonical/json.ts";

/**
 * Sanitizes terminal output by removing ANSI escape sequences and non-printable control characters.
 * Guarantees safe rendering in any terminal without terminal injection or escape sequence risks.
 */
export function sanitizeTerminalText(input: string): string {
	// Strip OSC (Operating System Command) sequences: ESC ] ... BEL or ESC \
	let stripped = input.replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/gu, "");
	// Strip CSI (Control Sequence Introducer) sequences: ESC [ ... [command char]
	stripped = stripped.replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, "");
	// Strip other 2-character escape sequences: ESC followed by ASCII control/command
	stripped = stripped.replace(/\x1B[ -/]*[@-~]/gu, "");
	// Replace non-printable control characters (except newline \n and tab \t)
	return stripped.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/gu, "");
}

function formatStatusLabel(rawStatus: string): string {
	if (rawStatus === "ready") {
		return "Ready (All active requirements and checks satisfied)";
	}
	if (rawStatus === "in_progress") {
		return "In Progress (Active changes and work underway)";
	}
	if (rawStatus === "attention_needed") {
		return "Attention Needed (Checks failed, stopped, or user action required)";
	}
	return rawStatus;
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

/**
 * Renders the primary Project Status dashboard in plain user language.
 * Answers:
 * 1. Which Changes need attention?
 * 2. What changed and why does it matter?
 * 3. What Work and Checks are complete, blocked, or still needed?
 * 4. What happens next?
 * 5. Does the user need to decide or act?
 */
export function renderProjectStatusConsole(data: unknown): string {
	const record = asRecord(data);
	if (!record) return "No project status available.";

	const project = safeString(record.project, "Unknown Project");
	const rawStatus = safeString(record.status, "unknown");
	const statusLabel = formatStatusLabel(rawStatus);

	const changesRec = asRecord(record.changes);
	const totalChanges = safeNumber(changesRec?.total);
	const statesRec = asRecord(changesRec?.states);
	const committedChanges = safeNumber(statesRec?.committed);
	const proposedChanges = safeNumber(statesRec?.proposed);
	const deferredChanges = safeNumber(statesRec?.deferred);

	const workRec = asRecord(record.work);
	const totalWork = safeNumber(workRec?.total);
	const readyWork = safeNumber(workRec?.ready);

	const checksRec = asRecord(record.checks);
	const passedChecks = safeNumber(checksRec?.passed);
	const failedChecks = safeNumber(checksRec?.failed);
	const stoppedChecks = safeNumber(checksRec?.stopped);

	const nextActions = asArray(record.nextActions).map((item) => {
		const rec = asRecord(item);
		return {
			changeId: safeString(rec?.changeId, "unknown"),
			action: safeString(rec?.action, "No next action specified."),
			userActionRequired: safeBoolean(rec?.userActionRequired),
		};
	});

	const attentionCount = nextActions.filter((a) => a.userActionRequired).length;

	const lines: string[] = [
		"================================================================================",
		`CodeWiki Project:  ${project}`,
		`Overall Status:    ${statusLabel}`,
		`Active Changes:    ${totalChanges} total (${proposedChanges} proposed, ${committedChanges} committed, ${deferredChanges} deferred)`,
		`Checks Status:     ${passedChecks} passed, ${failedChecks} failed, ${stoppedChecks} stopped`,
		`Work Progress:     ${totalWork} total units (${readyWork} ready for execution)`,
		`Attention Needed:  ${attentionCount > 0 ? `${attentionCount} item(s) require human attention` : "None"}`,
		"================================================================================",
	];

	if (nextActions.length > 0) {
		lines.push("", "Next Actions & Required Decisions:");
		for (const item of nextActions) {
			const badge = item.userActionRequired ? " [ACTION REQUIRED]" : " [IN PROGRESS]";
			lines.push(`  - Change ${item.changeId}:${badge}`);
			lines.push(`    ${item.action}`);
		}
	} else {
		lines.push("", "Next Actions: No active changes requiring attention.");
	}

	return `${lines.join("\n")}\n`;
}

/**
 * Renders the Changes summary view in plain user language.
 */
export function renderChangesConsole(data: unknown): string {
	const record = asRecord(data);
	if (!record) return "No changes data available.";

	const items = asArray(record.items);
	if (items.length === 0) {
		return "No changes recorded in this project.\n";
	}

	const lines: string[] = [
		"================================================================================",
		`Changes (${items.length} total):`,
		"================================================================================",
	];

	for (const item of items) {
		const rec = asRecord(item);
		if (!rec) continue;

		const changeId = safeString(rec.changeId, "unknown");
		const intent = safeString(rec.intent, "No intent stated.");
		const status = safeString(rec.status, "unknown");
		const realization = safeString(rec.realization, "unknown");
		const nextAction = safeString(rec.nextAction, "None.");
		const userRequired = safeBoolean(rec.userActionRequired);

		const workRec = asRecord(rec.work);
		const workTotal = safeNumber(workRec?.total);
		const workIntegrated = safeNumber(workRec?.integrated);

		const checksRec = asRecord(rec.checks);
		const checksPassed = safeNumber(checksRec?.passed);
		const checksFailed = safeNumber(checksRec?.failed);

		lines.push(
			`Change:       ${changeId}`,
			`Status:       ${status.toUpperCase()}${userRequired ? " (ACTION REQUIRED)" : ""}`,
			`Intent:       ${intent}`,
			`Realization:  ${realization}`,
			`Work Units:   ${workIntegrated}/${workTotal} integrated`,
			`Checks:       ${checksPassed} passed, ${checksFailed} failed`,
			`Next Action:  ${nextAction}`,
			"--------------------------------------------------------------------------------",
		);
	}

	return `${lines.join("\n")}\n`;
}

/**
 * Renders detailed view for a single Change in plain user language.
 */
export function renderChangeDetailConsole(data: unknown): string {
	const rec = asRecord(data);
	if (!rec) return "No change details available.";

	const changeId = safeString(rec.changeId, "unknown");
	const intent = safeString(rec.intent, "No intent stated.");
	const rationale = safeString(rec.rationale, "No rationale provided.");
	const status = safeString(rec.status, "unknown");
	const realization = safeString(rec.realization, "unknown");
	const nextAction = safeString(rec.nextAction, "None.");
	const userRequired = safeBoolean(rec.userActionRequired);

	const acceptance = asArray(rec.acceptance).map((a) => safeString(a)).filter((a) => a.length > 0);

	const lines: string[] = [
		"================================================================================",
		`Change:       ${changeId}`,
		`Status:       ${status.toUpperCase()}${userRequired ? " (HUMAN DECISION REQUIRED)" : ""}`,
		"================================================================================",
		`What Changed: ${intent}`,
		`Why Matters:  ${rationale}`,
		`Realization:  ${realization}`,
		"",
		"Acceptance Criteria:",
	];

	if (acceptance.length > 0) {
		for (const crit of acceptance) {
			lines.push(`  - ${crit}`);
		}
	} else {
		lines.push("  (None recorded)");
	}

	const workRec = asRecord(rec.work);
	const workTotal = safeNumber(workRec?.total);
	const workIntegrated = safeNumber(workRec?.integrated);

	const checksRec = asRecord(rec.checks);
	const checksPassed = safeNumber(checksRec?.passed);
	const checksFailed = safeNumber(checksRec?.failed);
	const checksStopped = safeNumber(checksRec?.stopped);

	lines.push(
		"",
		"Execution Progress:",
		`  Work:   ${workIntegrated}/${workTotal} integrated`,
		`  Checks: ${checksPassed} passed, ${checksFailed} failed, ${checksStopped} stopped`,
		"",
		`What Happens Next:`,
		`  ${nextAction}`,
		"",
		`User Action: ${userRequired ? "YES - Human decision or intervention needed" : "No user action required at this time"}`,
		"================================================================================",
	);

	return `${lines.join("\n")}\n`;
}

/**
 * Renders Checks status in plain user language.
 */
export function renderChecksConsole(data: unknown): string {
	const record = asRecord(data);
	if (!record) return "No checks data available.";

	const items = asArray(record.items);
	if (items.length === 0) {
		return "No checks recorded.\n";
	}

	const lines: string[] = [
		"================================================================================",
		`Checks (${items.length} items):`,
		"================================================================================",
	];

	for (const item of items) {
		const rec = asRecord(item);
		if (!rec) continue;

		const changeId = safeString(rec.changeId, "unknown");
		const stage = safeString(rec.stage, "unknown");
		const status = safeString(rec.status, "unknown");
		const runs = safeNumber(rec.runs);
		const results = safeNumber(rec.results);
		const evidence = safeNumber(rec.evidence);
		const nextAction = safeString(rec.nextAction, "None.");
		const userRequired = safeBoolean(rec.userActionRequired);

		lines.push(
			`Change:       ${changeId}`,
			`Stage:        ${stage} -> ${status.toUpperCase()}${userRequired ? " [ATTENTION NEEDED]" : ""}`,
			`Audit Counts: ${runs} runs, ${results} results, ${evidence} evidence items`,
			`Next Action:  ${nextAction}`,
			"--------------------------------------------------------------------------------",
		);
	}

	return `${lines.join("\n")}\n`;
}

/**
 * Universal console dispatcher rendering any supported public read response in terminal plain language.
 */
export function renderConsole(
	view: "status" | "changes" | "change" | "checks",
	data: unknown,
): string {
	switch (view) {
		case "status":
			return renderProjectStatusConsole(data);
		case "changes":
			return renderChangesConsole(data);
		case "change":
			return renderChangeDetailConsole(data);
		case "checks":
			return renderChecksConsole(data);
		default:
			return "Unsupported console view.\n";
	}
}
