import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {representativeProjectContextBenchmark} from "../../benchmarks/project-context-access.ts";

describe("Project Context repository-access benchmark", () => {
	it("selects derived index plus bounded files over full repository mount", () => {
		const report = representativeProjectContextBenchmark();
		const full = report.measurements.find((entry) => entry.strategy === "full_repository_mount");
		const derived = report.measurements.find(
			(entry) => entry.strategy === "derived_index_with_bounded_files",
		);
		assert.equal(report.decision, "derived_index_with_bounded_files");
		assert.equal(full.resultDigest, derived.resultDigest);
		assert.equal(derived.indexedFiles, 160);
		assert.equal(derived.materializedFiles, 2);
		assert.ok(derived.mountedBytes < full.mountedBytes / 4);
	});
});
