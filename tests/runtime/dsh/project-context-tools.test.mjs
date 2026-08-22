import assert from "node:assert/strict";
import {test} from "node:test";
import {Context} from "@deepseek-ai/cordis";
import {CallId} from "@deepseek-ai/dsh-llm";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";
import {createTestProjectContextSnapshot} from "../../helpers/project-context.mjs";
import {
	DSH_PROJECT_CONTEXT_BATCH_QUERY_TOOL,
	DSH_PROJECT_CONTEXT_TOOL_SET_DIGEST,
	registerDshProjectContextTools,
} from "../../../src/runtime/dsh/project-context-tools.ts";

async function harness(maxToolCalls = 2) {
	const context = new Context();
	const promptFiber = await context.plugin(SystemPrompt, {persona: "test"});
	const toolFiber = await context.plugin(ToolRuntime);
	const entries = [];
	const registration = registerDshProjectContextTools({
		context,
		snapshot: createTestProjectContextSnapshot(),
		maxToolCalls,
		record: (entry) => entries.push(entry),
		now: () => "2026-08-18T13:00:01.000Z",
	});
	return {
		context,
		entries,
		registration,
		dispose: async () => {
			registration.dispose();
			await toolFiber.dispose();
			await promptFiber.dispose();
		},
	};
}

async function execute(context, callId, name, argumentsValue) {
	return context.tools.execute({
		callId: CallId(callId),
		name,
		arguments: argumentsValue,
		signal: new AbortController().signal,
	});
}

test("DSH Project Context exposes typed local service tools", async () => {
	const value = await harness();
	try {
		assert.match(DSH_PROJECT_CONTEXT_TOOL_SET_DIGEST, /^sha256:[0-9a-f]{64}$/u);
		assert.equal(value.registration.toolSetDigest, DSH_PROJECT_CONTEXT_TOOL_SET_DIGEST);
		assert.deepEqual(value.context.tools.schemas().map(({name}) => name).sort(), [
			"discover_change_delta",
			"query_project_alignment",
			"query_project_context_batch",
			"query_project_evidence",
			"query_project_knowledge",
			"query_project_repository",
			"query_project_results",
			"query_project_state",
		]);
	} finally {
		await value.dispose();
	}
});

test("DSH Project Context direct and batch queries capture exact inner results", async () => {
	const value = await harness();
	try {
		const direct = await execute(value.context, "direct", "query_project_knowledge", {
			operation: "subject",
			arguments: {subjectId: "cw:component:runtime"},
			limit: 10,
		});
		assert.equal(direct.isError, false);
		assert.equal(direct.isError ? null : direct.value.items[0].id, "runtime");
		const batch = await execute(value.context, "batch", DSH_PROJECT_CONTEXT_BATCH_QUERY_TOOL, {
			queries: [{
				service: "knowledge",
				operation: "subject",
				arguments: {subjectId: "cw:component:runtime"},
				limit: 10,
			}],
		});
		assert.equal(batch.isError, false);
		assert.equal(batch.isError ? null : batch.value.results[0].items[0].id, "runtime");
		assert.deepEqual(value.entries.map(({kind}) => kind), [
			"tool-call", "project-context-query", "tool-result",
			"tool-call", "project-context-query", "tool-result",
		]);
		assert.equal(value.entries[1].payload.snapshotDigest, value.registration.facade.snapshotDigest);
		assert.equal(value.entries[4].payload.results[0].items[0].id, "runtime");
	} finally {
		await value.dispose();
	}
});

test("DSH Project Context rejects foreign operations and exhausted budgets", async () => {
	const value = await harness(1);
	try {
		const invalid = await execute(value.context, "invalid", "query_project_knowledge", {
			operation: "tree",
			arguments: {},
			limit: 1,
		});
		assert.equal(invalid.isError, true);
		const first = await execute(value.context, "first", "query_project_knowledge", {
			operation: "subject",
			arguments: {subjectId: "cw:component:runtime"},
			limit: 1,
		});
		assert.equal(first.isError, false);
		const denied = await execute(value.context, "second", "query_project_knowledge", {
			operation: "subject",
			arguments: {subjectId: "cw:component:runtime"},
			limit: 1,
		});
		assert.equal(denied.isError, true);
		assert.match(denied.isError ? denied.error.message : "", /budget is exhausted/u);
	} finally {
		await value.dispose();
	}
});
