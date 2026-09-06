import assert from "node:assert/strict";
import test from "node:test";

import {
	renderChangeDetailConsole,
	renderChangesConsole,
	renderChecksConsole,
	renderConsole,
	renderProjectStatusConsole,
	renderStageProgression,
	renderTraceConsole,
	sanitizeTerminalText,
} from "../../../src/api/client/console.ts";

test("sanitizeTerminalText removes ANSI escape codes and dangerous control characters", () => {
	assert.equal(sanitizeTerminalText("\x1B[31mRed\x1B[0m\x1B[2J\x1B[HOnline"), "RedOnline");
	assert.equal(sanitizeTerminalText("\x1B]0;Fake\x07Hello"), "Hello");
	assert.equal(sanitizeTerminalText("A\x00\x07\x08B\nC\tD"), "AB\nC\tD");
});

test("renderStageProgression derives stage from kernel facts only", () => {
	// proposed -> decision stage
	const proposed = renderStageProgression({
		status: "proposed",
		gates: [],
		userActionRequired: true,
	});
	assert.equal(proposed.label, "decision");
	assert.equal(proposed.attention, true);
	assert.match(proposed.gateSummary, /decision:/u);

	// committed with only decision gate passed -> planning stage
	const planning = renderStageProgression({
		status: "committed",
		gates: [{stage: "decision", status: "passed"}],
		userActionRequired: false,
	});
	assert.equal(planning.label, "planning");
	assert.equal(planning.attention, false);

	// committed with planning passed -> implementation
	const implementation = renderStageProgression({
		status: "committed",
		gates: [
			{stage: "decision", status: "passed"},
			{stage: "planning", status: "passed"},
			{stage: "implementation", status: "failed"},
		],
		userActionRequired: true,
	});
	assert.equal(implementation.label, "implementation");
	assert.equal(implementation.attention, true);
	assert.match(implementation.gateSummary, /implementation:✗/u);

	// committed with review passed -> completion
	const completion = renderStageProgression({
		status: "committed",
		gates: [
			{stage: "decision", status: "passed"},
			{stage: "planning", status: "passed"},
			{stage: "implementation", status: "passed"},
			{stage: "review", status: "passed"},
		],
		userActionRequired: false,
	});
	assert.equal(completion.label, "completion");

	// terminal states are terminal
	assert.equal(renderStageProgression({status: "completed", gates: [], userActionRequired: false}).label, "completed");
	assert.equal(renderStageProgression({status: "deferred", gates: [], userActionRequired: false}).label, "deferred");
	assert.equal(renderStageProgression({status: "rejected", gates: [], userActionRequired: false}).label, "rejected");
});

test("renderChangesConsole renders the process table over Changes", () => {
	const data = {
		items: [
			{
				changeId: "CHG-a92f8b7c6d5e",
				status: "proposed",
				gates: [],
				work: {total: 0, integrated: 0},
				checks: {passed: 0, failed: 0, stopped: 0},
				userActionRequired: true,
			},
			{
				changeId: "CHG-b7c1",
				status: "committed",
				gates: [{stage: "decision", status: "passed"}, {stage: "planning", status: "failed"}],
				work: {total: 4, integrated: 1},
				checks: {passed: 2, failed: 1, stopped: 0},
				userActionRequired: true,
			},
			{
				changeId: "CHG-c3d9",
				status: "completed",
				gates: [],
				work: {total: 4, integrated: 4},
				checks: {passed: 6, failed: 0, stopped: 0},
				userActionRequired: false,
			},
		],
	};

	const out = renderChangesConsole(data);
	assert.match(out, /ID\s+STAGE\s+WORK\s+CHECKS\s+ATTENTION/u);
	assert.match(out, /CHG-a92f8b7c…\s+decision\s+—\s+—\s+needs you/u);
	assert.match(out, /CHG-b7c1\s+planning\s+1\/4\s+2\/3\s+needs you/u);
	assert.match(out, /CHG-c3d9\s+completed\s+4\/4\s+6\/6\s+—/u);
	assert.match(out, /Detail: codewiki change <id>/u);

	assert.equal(renderChangesConsole({items: []}), "No Changes in this project.\nPropose one through the Project Server to begin.\n");
});

test("renderChangeDetailConsole renders per-stage sections with verification strip", () => {
	const out = renderChangeDetailConsole({
		changeId: "CHG-b7c1",
		intent: "Add export pipeline",
		rationale: "reduce packaging drift",
		status: "committed",
		gates: [{stage: "decision", status: "passed"}, {stage: "planning", status: "failed"}],
		work: {total: 4, integrated: 1},
		checks: {passed: 2, failed: 1, stopped: 0},
		acceptance: ["Pipeline is deterministic", "No residual state"],
		nextAction: "Resolve the planning Check outcome before continuing.",
		userActionRequired: true,
	});
	assert.match(out, /CHG-b7c1 — planning — "Add export pipeline"/u);
	assert.match(out, /Why: reduce packaging drift/u);
	assert.match(out, /decision:✓ planning:✗/u);
	assert.match(out, /Work:\s+1\/4 integrated/u);
	assert.match(out, /Acceptance:/u);
	assert.match(out, /Next: Resolve the planning Check/u);
	assert.match(out, /User action: yes/u);
});

test("renderChecksConsole renders the verification table", () => {
	const out = renderChecksConsole({
		items: [
			{changeId: "CHG-b7c1", stage: "planning", status: "failed", userActionRequired: true},
			{changeId: "CHG-c3d9", stage: "review", status: "passed", userActionRequired: false},
		],
	});
	assert.match(out, /CHANGE\s+STAGE\s+STATUS/u);
	assert.match(out, /planning\s+failed — needs you/u);
	assert.match(out, /review\s+passed/u);
	assert.equal(renderChecksConsole({items: []}), "No active Gates or Checks.\n");
});

test("renderProjectStatusConsole answers the five questions in three lines", () => {
	const out = renderProjectStatusConsole({
		project: "demo",
		status: "attention_needed",
		changes: {total: 3},
		work: {total: 8},
		checks: {passed: 5, failed: 1, stopped: 0},
		nextActions: [{changeId: "CHG-a92f", userActionRequired: true}],
	});
	assert.match(out, /demo — Attention needed/u);
	assert.match(out, /Changes: 3\s+Work: 8/u);
	assert.match(out, /Needs you: 1 decision — run: codewiki changes/u);

	const clear = renderProjectStatusConsole({
		project: "demo",
		status: "ready",
		changes: {total: 0},
		work: {total: 0},
		checks: {passed: 0, failed: 0, stopped: 0},
		nextActions: [],
	});
	assert.match(clear, /Needs you: nothing — all clear/u);
});

test("renderTraceConsole keeps technical identities in the audit view", () => {
	const out = renderTraceConsole({
		changeId: "CHG-c3d9",
		state: "completed",
		latestEventDigest: "sha256:" + "a".repeat(64),
		traceDigest: "sha256:" + "b".repeat(64),
	});
	assert.match(out, /Change Trace: CHG-c3d9/u);
	assert.match(out, /Lifecycle:\s+completed/u);
	assert.match(out, /Latest event: sha256:aaaa/u);
});

test("renderConsole dispatches all views and falls back for unsupported ones", () => {
	assert.match(renderConsole("status", {project: "p", status: "ready", nextActions: []}), /p — Ready/u);
	assert.match(renderConsole("changes", {items: []}), /No Changes/u);
	assert.match(renderConsole("change", {changeId: "CHG-x"}), /CHG-x/u);
	assert.match(renderConsole("checks", {items: []}), /No active Gates/u);
	assert.match(renderConsole("trace", {changeId: "CHG-y"}), /Change Trace: CHG-y/u);
	assert.equal(renderConsole("unknown", {}), "Unsupported console view.\n");
});
