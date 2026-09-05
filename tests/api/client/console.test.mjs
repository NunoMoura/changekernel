import assert from "node:assert/strict";
import test from "node:test";

import {
	renderChangeDetailConsole,
	renderChangesConsole,
	renderChecksConsole,
	renderConsole,
	renderProjectStatusConsole,
	sanitizeTerminalText,
} from "../../../src/api/client/console.ts";

test("sanitizeTerminalText removes ANSI escape codes and dangerous control characters", () => {
	const textWithAnsi = "\x1B[31mRed Alert!\x1B[0m\x1B[2J\x1B[HSystem Online";
	assert.equal(sanitizeTerminalText(textWithAnsi), "Red Alert!System Online");

	const textWithOsc = "\x1B]0;Fake Title\x07Hello World";
	assert.equal(sanitizeTerminalText(textWithOsc), "Hello World");

	const textWithControlChars = "Normal\x00\x07\x08Text\nLine 2\tTabbed";
	assert.equal(sanitizeTerminalText(textWithControlChars), "NormalText\nLine 2\tTabbed");
});

test("renderProjectStatusConsole produces plain-language status answering key questions", () => {
	const statusData = {
		project: "codewiki",
		status: "attention_needed",
		changes: {
			total: 3,
			states: {
				committed: 1,
				completed: 1,
				deferred: 0,
				proposed: 1,
				rejected: 0,
				superseded: 0,
				withdrawn: 0,
			},
		},
		work: {
			total: 4,
			ready: 2,
		},
		checks: {
			passed: 5,
			failed: 1,
			stopped: 0,
		},
		nextActions: [
			{
				changeId: "CHG-001",
				action: "Accept or reject the proposed change.",
				userActionRequired: true,
			},
			{
				changeId: "CHG-002",
				action: "Executing planned work units.",
				userActionRequired: false,
			},
		],
	};

	const rendered = renderProjectStatusConsole(statusData);
	assert.ok(rendered.includes("CodeWiki Project:  codewiki"));
	assert.ok(rendered.includes("Overall Status:    Attention Needed"));
	assert.ok(rendered.includes("1 item(s) require human attention"));
	assert.ok(rendered.includes("Change CHG-001: [ACTION REQUIRED]"));
	assert.ok(rendered.includes("Change CHG-002: [IN PROGRESS]"));
	assert.ok(rendered.includes("Accept or reject the proposed change."));

	// Edge case: null or empty
	assert.equal(renderProjectStatusConsole(null), "No project status available.");
});

test("renderChangesConsole formats change list clearly", () => {
	const changesData = {
		items: [
			{
				changeId: "CHG-001",
				intent: "Refactor storage subsystem for determinism",
				status: "proposed",
				realization: "wiki-and-project",
				work: {total: 2, integrated: 0},
				checks: {passed: 1, failed: 0},
				nextAction: "Review change proposal.",
				userActionRequired: true,
			},
		],
	};

	const rendered = renderChangesConsole(changesData);
	assert.ok(rendered.includes("Change:       CHG-001"));
	assert.ok(rendered.includes("Status:       PROPOSED (ACTION REQUIRED)"));
	assert.ok(rendered.includes("Intent:       Refactor storage subsystem for determinism"));
	assert.ok(rendered.includes("Work Units:   0/2 integrated"));
	assert.ok(rendered.includes("Next Action:  Review change proposal."));

	// Empty list
	assert.equal(renderChangesConsole({items: []}), "No changes recorded in this project.\n");
});

test("renderChangeDetailConsole provides thorough plain-language answers", () => {
	const detailData = {
		changeId: "CHG-001",
		intent: "Add terminal console",
		rationale: "Operators need plain-language visibility",
		status: "committed",
		realization: "project-only",
		acceptance: ["Console answers the 5 core questions", "Terminal escapes are sanitized"],
		work: {total: 3, integrated: 2},
		checks: {passed: 4, failed: 0, stopped: 0},
		nextAction: "Execute remaining work unit.",
		userActionRequired: false,
	};

	const rendered = renderChangeDetailConsole(detailData);
	assert.ok(rendered.includes("Change:       CHG-001"));
	assert.ok(rendered.includes("What Changed: Add terminal console"));
	assert.ok(rendered.includes("Why Matters:  Operators need plain-language visibility"));
	assert.ok(rendered.includes("Console answers the 5 core questions"));
	assert.ok(rendered.includes("Work:   2/3 integrated"));
	assert.ok(rendered.includes("Checks: 4 passed, 0 failed, 0 stopped"));
	assert.ok(rendered.includes("What Happens Next:"));
	assert.ok(rendered.includes("Execute remaining work unit."));
	assert.ok(rendered.includes("No user action required at this time"));
});

test("renderChecksConsole formats verification status and audit counts", () => {
	const checksData = {
		items: [
			{
				changeId: "CHG-001",
				stage: "review",
				status: "passed",
				runs: 3,
				results: 3,
				evidence: 1,
				nextAction: "Continue with change completion.",
				userActionRequired: false,
			},
			{
				changeId: "CHG-002",
				stage: "implementation",
				status: "failed",
				runs: 1,
				results: 1,
				evidence: 0,
				nextAction: "Fix failing test check.",
				userActionRequired: true,
			},
		],
	};

	const rendered = renderChecksConsole(checksData);
	assert.ok(rendered.includes("Stage:        review -> PASSED"));
	assert.ok(rendered.includes("Stage:        implementation -> FAILED [ATTENTION NEEDED]"));
	assert.ok(rendered.includes("Audit Counts: 3 runs, 3 results, 1 evidence items"));
	assert.ok(rendered.includes("Next Action:  Fix failing test check."));
});

test("renderConsole dispatches supported views and falls back on invalid input", () => {
	assert.ok(renderConsole("status", {project: "test"}).includes("test"));
	assert.ok(renderConsole("changes", {items: []}).includes("No changes"));
	assert.ok(renderConsole("change", {changeId: "CHG-99"}).includes("CHG-99"));
	assert.ok(renderConsole("checks", {items: []}).includes("No checks"));
	assert.equal(renderConsole("unknown", {}), "Unsupported console view.\n");
});
