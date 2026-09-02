import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {parseChangeTrace} from "../../src/changes/trace/semantic-kernel.ts";

const criterionEvidence = {
	"WU-reconcile-completed-foundations-v1": {
		criteria: ["foundation-evidence", "obsolete-meaning", "remaining-gaps"],
		source: [
			"src/changes/types.ts",
			"src/changes/trace/change-record.ts",
			"src/changes/trace/store.ts",
			"src/work-state/projector.ts",
			"src/loops/decision/change-quality.ts",
			"src/changes/command.ts",
			"src/loops/decision/command.ts",
			"src/project-server/workers/execution-policy.ts",
		],
		tests: [
			"tests/changes/change-domain.test.mjs",
			"tests/changes/trace/change-trace-store.test.mjs",
			"tests/work-state/work-state.test.mjs",
			"tests/loops/decision/command.test.mjs",
			"tests/project-server/execution-policy.test.mjs",
		],
	},
	"WU-change-validation-cards-v1": {
		criteria: ["semantic-sections", "exact-identity", "safe-rendering"],
		source: [
			"src/changes/validation-view.ts",
			"src/clients/pi/rendering/change-validation-card.ts",
		],
		tests: [
			"tests/changes/change-validation-view.test.mjs",
			"tests/clients/pi/change-validation-card.test.mjs",
		],
	},
	"WU-changes-backlog-dashboard-v1": {
		criteria: ["backlog-view", "guarded-mutations", "authority-ceiling"],
		source: [
			"src/project-server/queries/changes.ts",
			"src/project-server/app/server.ts",
		],
		tests: [
			"tests/project-server/queries/changes.test.mjs",
			"tests/clients/app/shell.test.mjs",
		],
	},
	"WU-dashboard-execution-configuration-v1": {
		criteria: ["config-projection", "safe-patch", "authority-invariants"],
		source: [
			"src/project-server/queries/configuration.ts",
			"src/project/config-file.ts",
		],
		tests: [
			"tests/project-server/queries/configuration.test.mjs",
			"tests/project-server/wiki-config.test.mjs",
		],
	},
	"WU-change-intake-contract-v1": {
		criteria: [
			"closed-source-union",
			"authenticated-admission",
			"deduplicated-routing",
			"qualified-defect-profile",
			"closed-source-producers",
			"snapshot-bound-triage-projection",
			"bounded-shared-triage-query",
			"privacy-boundary",
			"git-cas",
		],
		source: [
			"src/changes/defect-profile.ts",
			"src/changes/intake/contracts.ts",
			"src/changes/intake/normalize.ts",
			"src/changes/intake/producers.ts",
			"src/changes/intake/deduplicate.ts",
			"src/changes/intake/route.ts",
			"src/project-server/admission/change.ts",
			"src/project-server/workers/implementation-adapter.ts",
			"src/project-server/workers/reports.ts",
			"src/changes/triage/contracts.ts",
			"src/changes/triage/estimates.ts",
			"src/changes/triage/ordering.ts",
			"src/changes/triage/projection.ts",
			"src/changes/triage/query.ts",
		],
		tests: [
			"tests/changes/change-intake.test.mjs",
			"tests/project-server/admission/change.test.mjs",
			"tests/changes/change-intake-producers.test.mjs",
			"tests/changes/defect-profile.test.mjs",
			"tests/changes/backlog-triage.test.mjs",
		],
	},
	"WU-worker-execution-policy-integration-v1": {
		criteria: ["policy-dispatch", "explicit-propagation", "fail-closed"],
		source: [
			"src/project-server/workers/dispatch.ts",
			"src/project-server/workers/prompt.ts",
			"src/project-server/workers/execution-policy.ts",
			"src/project-server/workers/implementation-run.ts",
			"src/runtime/processes/dsh-run-process.ts",
			"src/project-server/workers/observation.ts",
		],
		tests: [
			"tests/project-server/workers/dispatch.test.mjs",
			"tests/project-server/workers/prompt.test.mjs",
			"tests/runtime/dsh/vertical-process.test.mjs",
			"tests/project-server/worker-observation.test.mjs",
		],
	},
	"WU-control-center-integration-proof-v1": {
		criteria: ["regression-proof", "clean-vocabulary", "aggregate-evidence"],
		source: [
			"README.md",
			".codewiki/wiki/items/system/components/decision.md",
			".codewiki/wiki/items/system/components/client-project-server-protocol.md",
			".codewiki/wiki/items/system/components/dsh-run-execution.md",
		],
		tests: [
			"tests/integration/control-center-reconciliation.test.mjs",
			"tests/project-server/readiness-checklist.test.mjs",
			"tests/project-server/package-install-smoke.mjs",
		],
	},
};

function filesUnder(root) {
	const result = [];
	for (const name of readdirSync(root).sort()) {
		const path = join(root, name);
		if (statSync(path).isDirectory()) result.push(...filesUnder(path));
		else result.push(path);
	}
	return result;
}

describe("control-center reconciliation integration", () => {
	it("maps every reconciled acceptance area to existing source and tests", () => {
		for (const [workUnitId, evidence] of Object.entries(criterionEvidence)) {
			assert.equal(
				new Set(evidence.criteria).size,
				evidence.criteria.length,
				`${workUnitId} criteria`,
			);
			assert.equal(
				evidence.source.length > 0,
				true,
				`${workUnitId} source proof`,
			);
			assert.equal(evidence.tests.length > 0, true, `${workUnitId} test proof`);
			for (const path of [...evidence.source, ...evidence.tests]) {
				assert.equal(existsSync(path), true, `${workUnitId}: ${path}`);
			}
		}
	});

	it("keeps only governed migration and roadmap-admission traces in source state", () => {
		const traceFiles = filesUnder(".codewiki/changes").filter((path) =>
			/\/TRACE-.*\.jsonl$/.test(path),
		);
		assert.deepEqual(traceFiles, [
			".codewiki/changes/TRACE-CHG-sk2-kb-to-wiki-migration-adc272d.jsonl",
			".codewiki/changes/TRACE-CHG-sk2-kb-to-wiki-migration.jsonl",
			".codewiki/changes/TRACE-CHG-sk3a-exact-design-roadmap.jsonl",
		]);
		const traces = traceFiles.map((path) =>
			parseChangeTrace(readFileSync(path, "utf8")),
		);
		assert.deepEqual(
			traces.flatMap(({operations}) => operations.map(({kind}) => kind)),
			[
				"migration.applied",
				"change.proposed",
				"decision.running",
				"decision.passed",
				"confirmation.recorded",
				"change.accepted",
			],
		);
	});

	it("documents current control-plane boundaries on canonical surfaces", () => {
		const readme = readFileSync("README.md", "utf8");
		const decision = readFileSync(
			".codewiki/wiki/items/system/components/decision.md",
			"utf8",
		);
		const protocol = readFileSync(
			".codewiki/wiki/items/system/components/client-project-server-protocol.md",
			"utf8",
		);
		const projectServer = readFileSync(
			".codewiki/wiki/items/system/components/project-server.md",
			"utf8",
		);
		assert.match(readme, /## Current posture/);
		assert.match(readme, /persisted pending Change revisions/);
		assert.match(readme, /fully (?:exit and )?restart Pi/i);
		assert.match(decision, /authenticated submission creates or revises one Change/i);
		assert.match(decision, /Gate binds the exact Proposed Change snapshot/i);
		assert.match(decision, /expected-tip and expected-head compare-and-swap/i);
		assert.match(protocol, /Command payloads contain requested semantics only/i);
		assert.match(protocol, /cannot assert authenticated identity/i);
		assert.match(projectServer, /sole authoritative semantic control plane/i);
		assert.match(projectServer, /validates identity proof/i);
		assert.match(
			projectServer,
			/one Change lifecycle with Decision, Planning, Implementation, and Review phases/i,
		);
	});

	it("keeps active shipped surfaces on canonical Change vocabulary", () => {
		const activeFiles = [
			...filesUnder("src").filter((path) => path.endsWith(".ts")),
			"README.md",
			".codewiki/wiki/items/system/components/decision.md",
			".codewiki/wiki/items/system/components/client-project-server-protocol.md",
			".codewiki/wiki/items/system/components/project-server.md",
			".codewiki/wiki/items/system/components/dsh-run-execution.md",
		];
		const activeText = activeFiles
			.map((path) => `${path}\n${readFileSync(path, "utf8")}`)
			.join("\n---\n");
		for (const forbidden of [
			"wiki_ideas",
			"refs/codewiki/ideas",
			"ProposedChange",
			"src/ideas/",
		]) {
			assert.equal(activeText.includes(forbidden), false, forbidden);
		}
		for (const path of [
			"src/ideas",
			"src/api/wiki-ideas.ts",
			"src/ideas/git-ref-store.ts",
		]) {
			assert.equal(existsSync(path), false, path);
		}
		for (const required of [
			"Changes Backlog",
			"exact validated Change",
			"Change intake material",
			"execution policy",
		]) {
			assert.match(activeText, new RegExp(required, "i"), required);
		}
	});
});
