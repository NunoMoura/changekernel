import assert from "node:assert/strict";
import {mkdtemp, mkdir, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, describe, it} from "node:test";

import {Context} from "@deepseek-ai/cordis";
import PluginInventoryGateway from "@deepseek-ai/dsh-host-plugin-inventory";

import {createExecutablePluginAdmissionClosure} from "../../../src/plugins/executable.ts";
import {createStageRunContinuationBinding} from "../../../src/runtime/continuation.ts";
import {
	DSH_MANAGED_EXECUTABLE_ADMISSIONS,
	mountReleaseManagedDshPlugins,
} from "../../../src/runtime/dsh/managed-loader.ts";
import {mountDshExecutionPlugins} from "../../../src/runtime/dsh/plugins.ts";
import {canonicalJsonDigest} from "../../../src/utils/canonical-json.ts";

const roots = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

describe("release-managed DSH Loader composition", () => {
	it("binds every possible Plugin identity to CodeWiki admission policy", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-dsh-admission-"));
		roots.push(root);
		const projectRoot = join(root, "project");
		const releaseRoot = join(root, "release");
		await Promise.all([mkdir(projectRoot), mkdir(releaseRoot)]);

		const closure = createExecutablePluginAdmissionClosure({
			projectRoot,
			sourceRoots: [releaseRoot],
			admissions: DSH_MANAGED_EXECUTABLE_ADMISSIONS,
		});

		assert.equal(closure.admissions.length, 19);
		assert.match(closure.closureDigest, /^sha256:[0-9a-f]{64}$/);
		assert.equal(
			closure.admissions.find(({pluginId}) =>
				pluginId === "@deepseek-ai/dsh-host-plugin-inventory"
			)?.capabilities[0],
			"loader-state-observation",
		);
	});

	it("uses DSH Loader state as the exact live composition observation", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-dsh-profile-"));
		roots.push(root);
		const sessionRoot = join(root, "sessions");
		await mkdir(sessionRoot);
		const context = new Context();
		const fibers = await mountDshExecutionPlugins({
			context,
			systemPrompt: "Managed profile qualification.",
			sessionRoot,
			continuation: continuation(),
			codeMode: null,
		});
		try {
			const inventory = context.get("pluginInventory");
			const snapshot = inventory.list();
			assert.equal(snapshot.entries.length, 18);
			assert.deepEqual(
				snapshot.entries.map(({entryId, moduleName, enabled, fiberPhase}) => ({
					entryId,
					moduleName,
					enabled,
					fiberPhase,
				})),
				expectedActiveProfile(),
			);
		} finally {
			await Promise.all(fibers.map((fiber) => fiber.dispose()));
		}
	});

	it("rejects a module outside the admitted release composition before loading", async () => {
		const context = new Context();
		await assert.rejects(
			mountReleaseManagedDshPlugins(context, [
				{
					entryId: "foreign",
					moduleName: "foreign-plugin",
					plugin: () => undefined,
				},
			]),
			/DSH managed Run composition contains an unadmitted Plugin/,
		);
		await context.fiber.dispose();
	});

	it("disposes Loader state when one admitted Plugin fails to load", async () => {
		const context = new Context();
		await assert.rejects(
			mountReleaseManagedDshPlugins(context, [
				{
					entryId: "invariants",
					moduleName: "@deepseek-ai/dsh-invariants",
					plugin: () => {
						throw new Error("fixture Plugin failed");
					},
				},
				{
					entryId: "plugin-inventory",
					moduleName: "@deepseek-ai/dsh-host-plugin-inventory",
					plugin: PluginInventoryGateway,
				},
			]),
			/fixture Plugin failed/,
		);
		assert.equal(context.get("loader"), undefined);
		await context.fiber.dispose();
	});
});

function continuation() {
	return createStageRunContinuationBinding({
		stage: "decision",
		objectiveDigest: digest("objective"),
		maxRounds: 3,
		semanticStateDigest: digest("semantic-state"),
		authorityPromotionDigest: digest("authority-promotion"),
		unresolvedObligationsDigest: digest("obligations"),
		feedbackDigest: null,
		contextWindowTokens: 4_096,
		pressureThresholdTokens: 3_500,
		expectedNextRunInputTokens: 1_024,
		toolResultReserveTokens: 256,
		candidateOutputReserveTokens: 64,
		retainRecentTokens: 64,
		maxSummaryCharacters: 2_000,
	});
}

function expectedActiveProfile() {
	const entries = [
		["invariants", "@deepseek-ai/dsh-invariants"],
		["llm", "@deepseek-ai/dsh-llm"],
		["session", "@deepseek-ai/dsh-session"],
		["system-prompt", "@deepseek-ai/dsh-system-prompt"],
		["tools", "@deepseek-ai/dsh-tools"],
		["agent", "@deepseek-ai/dsh-agent"],
		["session-persistence", "@deepseek-ai/dsh-session-persistence-jsonl"],
		["agent-loop", "@deepseek-ai/dsh-agent-loop"],
		["session-invariant", "@deepseek-ai/dsh-session/invariant"],
		["agent-invariant", "@deepseek-ai/dsh-agent/invariant"],
		["agent-loop-invariant", "@deepseek-ai/dsh-agent-loop/invariant"],
		["session-projection", "@deepseek-ai/dsh-session-projection"],
		["goal", "@deepseek-ai/dsh-goal"],
		["goal-invariant", "@deepseek-ai/dsh-goal/invariant"],
		["token-meter", "@deepseek-ai/dsh-token-meter"],
		["tool-result-pruner", "@deepseek-ai/dsh-compaction-tool-result-pruner"],
		["stage-compaction", "@nunomoura/codewiki/stage-compaction"],
		["plugin-inventory", "@deepseek-ai/dsh-host-plugin-inventory"],
	];
	return entries.map(([entryId, moduleName]) => ({
		entryId,
		moduleName,
		enabled: true,
		fiberPhase: "active",
	}));
}

function digest(value) {
	return canonicalJsonDigest(value);
}
