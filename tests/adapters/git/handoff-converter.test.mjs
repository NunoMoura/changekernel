import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {
	convertPredecessorState,
	HANDOFF_CONVERSION_REPORT_PROTOCOL,
	PREDECESSOR_CONTROLLER,
} from "../../../src/adapters/git/handoff-converter.ts";
import {CODEWIKI_PRODUCT} from "../../../src/product.ts";

async function createPredecessorFixture(root) {
	const codewikiDir = join(root, ".codewiki");
	const changesDir = join(codewikiDir, "changes");
	await mkdir(changesDir, {recursive: true});

	const config = {
		protocol: {id: "codewiki.project-config", version: "2.0.0"},
		project: "test-predecessor",
		hosts: {mcp: {enabled: false}, pi: {enabled: true}},
		preview: {profiles: [], uiPreviewTargets: []},
		quality: {judge: {enabled: false}, review: {enabled: true}},
		retention: {enabled: true},
		runtime: {agency: "delegate"},
		triagePreferences: [],
		userStandards: [],
	};
	await writeFile(join(codewikiDir, "config.json"), JSON.stringify(config, null, 2), "utf8");

	const lock = {
		protocolId: "codewiki.check-pack-lock",
		protocolVersion: "1.0.0",
		packages: {
			"@nunomoura/codewiki": {
				packageVersion: "0.3.0",
				planDigest: "sha256:8601e2a0b24a8ad6aa63f409f6393aa2dbd681dc5b9c80adce9ca4485f68ed3c",
				source: {kind: "domain", locator: "codewiki.domain.software-development"},
			},
		},
	};
	await writeFile(join(codewikiDir, "check-packs.lock.json"), JSON.stringify(lock, null, 2), "utf8");

	const traceContent = '{"protocol":"codewiki.change-trace","version":"13.0.0","changeId":"CHG-sk3a-exact-design-roadmap"}\n';
	await writeFile(join(changesDir, "TRACE-CHG-sk3a-exact-design-roadmap.jsonl"), traceContent, "utf8");
	await writeFile(join(changesDir, "TRACE-CHG-sk3a-exact-design-roadmap.jsonl.idx"), "legacy index", "utf8");
	await writeFile(join(changesDir, "TRACE-CHG-sk3a-exact-design-roadmap.jsonl.workstate"), "legacy workstate", "utf8");
}

test("handoff converter produces valid dry-run report without mutating disk", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-handoff-dry-"));
	try {
		await createPredecessorFixture(root);
		const result = await convertPredecessorState({projectRoot: root, dryRun: true});
		assert.equal(result.ok, true);

		const report = result.value;
		assert.equal(report.protocol.id, HANDOFF_CONVERSION_REPORT_PROTOCOL.id);
		assert.equal(report.project, "test-predecessor");
		assert.deepEqual(report.predecessorController, PREDECESSOR_CONTROLLER);
		assert.equal(report.targetController.packageName, CODEWIKI_PRODUCT.package.name);
		assert.equal(report.targetController.packageVersion, CODEWIKI_PRODUCT.package.version);
		assert.equal(report.genesisMapping.historicalChangeId, "CHG-sk3a-exact-design-roadmap");
		assert.ok(report.reportDigest.startsWith("sha256:"));

		// In dryRun, .idx and .workstate files must still exist
		const idxContent = await readFile(join(root, ".codewiki/changes/TRACE-CHG-sk3a-exact-design-roadmap.jsonl.idx"), "utf8");
		assert.equal(idxContent, "legacy index");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("handoff converter applies atomic state updates and removes legacy index residue", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-handoff-apply-"));
	try {
		await createPredecessorFixture(root);
		const result = await convertPredecessorState({projectRoot: root, dryRun: false});
		assert.equal(result.ok, true);

		// Verified updated check-packs.lock.json references target product
		const updatedLock = JSON.parse(await readFile(join(root, ".codewiki/check-packs.lock.json"), "utf8"));
		assert.equal(updatedLock.packages[CODEWIKI_PRODUCT.package.name].packageVersion, CODEWIKI_PRODUCT.package.version);
		assert.equal(updatedLock.packages[CODEWIKI_PRODUCT.package.name].source.kind, "npm");

		// Verified legacy residue removed
		await assert.rejects(() => readFile(join(root, ".codewiki/changes/TRACE-CHG-sk3a-exact-design-roadmap.jsonl.idx")), /ENOENT/u);
		await assert.rejects(() => readFile(join(root, ".codewiki/changes/TRACE-CHG-sk3a-exact-design-roadmap.jsonl.workstate")), /ENOENT/u);

		// Verified historical trace bytes preserved
		const trace = await readFile(join(root, ".codewiki/changes/TRACE-CHG-sk3a-exact-design-roadmap.jsonl"), "utf8");
		assert.ok(trace.includes("codewiki.change-trace"));
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("handoff converter fails closed on invalid project root or missing predecessor state", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-handoff-invalid-"));
	try {
		// Empty root without .codewiki
		const emptyResult = await convertPredecessorState({projectRoot: root});
		assert.equal(emptyResult.ok, false);
		assert.equal(emptyResult.error.code, "invalid_project_root");

		// Root with empty .codewiki
		await mkdir(join(root, ".codewiki"));
		const missingConfig = await convertPredecessorState({projectRoot: root});
		assert.equal(missingConfig.ok, false);
		assert.equal(missingConfig.error.code, "invalid_predecessor_state");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});
