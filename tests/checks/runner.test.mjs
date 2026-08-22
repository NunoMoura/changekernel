import test from "node:test";
import assert from "node:assert/strict";
import {createCheckInputSelection} from "../../src/checks/protocol.ts";
import {createGateRunner} from "../../src/checks/runner.ts";
import {
	checkExecutor,
	checkOutput,
	checkSnapshot,
	checkSubject,
	digest,
	executionIdentity,
	gatePackageContext,
	packagedCheck,
} from "../helpers/checks.mjs";

test("Gate runs Code Checks before Model Checks and fail-fast skips Model", async () => {
	const code = packagedCheck({definition: {id: "code-fails"}});
	const model = packagedCheck({
		definition: {
			id: "model-skipped",
			implementation: {
				kind: "model",
				route: "model-route",
				profile: "model-profile",
				maximumTokens: 1000,
			},
		},
	});
	let modelCalls = 0;
	const runner = createGateRunner({
		executors: [
			checkExecutor({
				execute: (context) =>
					checkOutput(context.invocation, {
						measurement: {kind: "binary", value: false},
						summary: "Code requirement failed.",
					}),
			}),
			checkExecutor({
				identity: executionIdentity({
					kind: "model",
					profile: "model-profile",
					route: "model-route",
				}),
				execute: (context) => {
					modelCalls += 1;
					return checkOutput(context.invocation);
				},
			}),
		],
	});
	const report = await runner.run({
		subject: checkSubject(),
		snapshot: checkSnapshot([code, model]),
		...gatePackageContext(),
	});
	assert.equal(report.status, "failed");
	assert.deepEqual(report.results.map((result) => result.checkId), ["code-fails"]);
	assert.equal(report.results[0].gatePackageDigest, report.gatePackageDigest);
	assert.equal(modelCalls, 0);
});

test("invalid output retries within Check limit then stops without Result", async () => {
	const check = packagedCheck({
		definition: {
			id: "invalid-output",
			limits: {
				timeoutMs: 1000,
				maximumAttempts: 2,
				maximumInputBytes: 131072,
				maximumOutputBytes: 65536,
			},
		},
	});
	let calls = 0;
	const runner = createGateRunner({
		executors: [
			checkExecutor({
				execute() {
					calls += 1;
					return {not: "protocol output"};
				},
			}),
		],
	});
	const report = await runner.run({
		subject: checkSubject(),
		snapshot: checkSnapshot([check]),
		...gatePackageContext(),
	});
	assert.equal(report.status, "stopped");
	assert.equal(report.results.length, 0);
	assert.equal(report.executions[0].attempts, 2);
	assert.equal(report.stoppedReason.code, "invalid_output");
	assert.equal(calls, 2);
});

test("timeout retry uses a fresh cancellation boundary", async () => {
	const check = packagedCheck({
		definition: {
			id: "retry-timeout",
			limits: {
				timeoutMs: 20,
				maximumAttempts: 2,
				maximumInputBytes: 131072,
				maximumOutputBytes: 65536,
			},
		},
	});
	let calls = 0;
	const executor = checkExecutor({
		execute(context) {
			calls += 1;
			return calls === 1
				? new Promise(() => {})
				: checkOutput(context.invocation);
		},
	});
	const report = await createGateRunner({executors: [executor]}).run({
		subject: checkSubject(),
		snapshot: checkSnapshot([check]),
		...gatePackageContext(),
	});
	assert.equal(report.status, "passed");
	assert.equal(report.executions[0].attempts, 2);
	assert.equal(calls, 2);
});

test("input resolver failures stop Gate instead of escaping process boundary", async () => {
	const check = packagedCheck({
		definition: {
			id: "input-failure",
			inputs: [
				{source: "subject", refs: [], required: true, maximumBytes: 65536},
				{source: "evidence", refs: [], required: true, maximumBytes: 65536},
			],
		},
	});
	const report = await createGateRunner({
		executors: [checkExecutor()],
		inputResolver: {
			resolve() {
				throw new Error("collector unavailable");
			},
		},
	}).run({
		subject: checkSubject(),
		snapshot: checkSnapshot([check]),
		...gatePackageContext(),
	});
	assert.equal(report.status, "stopped");
	assert.equal(report.stoppedReason.code, "missing_inputs");
	assert.match(report.stoppedReason.message, /collector unavailable/);
	assert.deepEqual(report.results, []);
});

test("Gate package resolves each declared non-subject input exactly once", async () => {
	const check = packagedCheck({
		definition: {
			id: "single-resolution",
			inputs: [
				{source: "subject", refs: [], required: true, maximumBytes: 131072},
				{source: "evidence", refs: ["evidence:one"], required: true, maximumBytes: 131072},
			],
		},
	});
	let resolutions = 0;
	const report = await createGateRunner({
		executors: [checkExecutor()],
		inputResolver: {
			resolve({selector}) {
				resolutions += 1;
				return createCheckInputSelection({
					selector,
					status: "ready",
					items: [{
						source: "evidence",
						ref: "evidence:one",
						digest: digest({status: "passed"}),
						content: {status: "passed"},
					}],
					truncated: false,
					stale: false,
				});
			},
		},
	}).run({
		subject: checkSubject(),
		snapshot: checkSnapshot([check]),
		...gatePackageContext(),
	});
	assert.equal(report.status, "passed", JSON.stringify(report.stoppedReason));
	assert.equal(resolutions, 1);
});

test("missing required selected input stops only affected Gate", async () => {
	const check = packagedCheck({
		definition: {
			id: "requires-evidence",
			inputs: [
				{source: "subject", refs: [], required: true, maximumBytes: 65536},
				{source: "evidence", refs: [], required: true, maximumBytes: 65536},
			],
		},
	});
	const report = await createGateRunner({executors: [checkExecutor()]}).run({
		subject: checkSubject(),
		snapshot: checkSnapshot([check]),
		...gatePackageContext(),
	});
	assert.equal(report.status, "stopped");
	assert.equal(report.stoppedReason.code, "missing_inputs");
	assert.equal(report.results.length, 0);
});

test("parallel fail-fast reduction keeps deterministic earliest terminal prefix", async () => {
	const checks = ["a-pass", "b-fail", "c-fail", "d-cancel"].map((id) =>
		packagedCheck({definition: {id}}),
	);
	let cancellations = 0;
	const executor = checkExecutor({
		async execute(context) {
			const id = context.check.checkId;
			if (id === "a-pass") {
				await new Promise((resolve) => setTimeout(resolve, 30));
				return checkOutput(context.invocation);
			}
			if (id === "b-fail") {
				await new Promise((resolve) => setTimeout(resolve, 20));
				return checkOutput(context.invocation, {
					measurement: {kind: "binary", value: false},
				});
			}
			if (id === "c-fail") {
				return checkOutput(context.invocation, {
					measurement: {kind: "binary", value: false},
				});
			}
			return new Promise((resolve) => {
				context.signal.addEventListener(
					"abort",
					() => {
						cancellations += 1;
						resolve(checkOutput(context.invocation));
					},
					{once: true},
				);
			});
		},
	});
	const reports = [];
	for (let run = 0; run < 3; run += 1) {
		reports.push(
			await createGateRunner({
				executors: [executor],
				maximumCodeConcurrency: 4,
			}).run({
				subject: checkSubject(),
				snapshot: checkSnapshot(checks),
				...gatePackageContext(),
			}),
		);
	}
	for (const report of reports) {
		assert.equal(
			report.status,
			"failed",
			JSON.stringify(report.stoppedReason ?? report.executions),
		);
		assert.deepEqual(
			report.results.map((result) => result.checkId),
			["a-pass", "b-fail"],
		);
		assert.deepEqual(
			report.executions.map((fact) => fact.checkId),
			["a-pass", "b-fail"],
		);
	}
	assert.equal(new Set(reports.map((report) => report.reportDigest)).size, 1);
	assert.equal(cancellations, 3);
});

test("Code execution uses configured bounded concurrency", async () => {
	const checks = ["one", "two", "three", "four"].map((id) =>
		packagedCheck({definition: {id}}),
	);
	let active = 0;
	let maximum = 0;
	const executor = checkExecutor({
		async execute(context) {
			active += 1;
			maximum = Math.max(maximum, active);
			await new Promise((resolve) => setTimeout(resolve, 10));
			active -= 1;
			return checkOutput(context.invocation);
		},
	});
	const report = await createGateRunner({
		executors: [executor],
		limits: {maximumCodeConcurrency: 2, maximumModelConcurrency: 1},
	}).run({
		subject: checkSubject(),
		snapshot: checkSnapshot(checks),
		...gatePackageContext(),
	});
	assert.equal(report.status, "passed");
	assert.equal(report.results.length, 4);
	assert.equal(maximum, 2);
});
