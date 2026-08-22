import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {createKnowledgePostStateArtifact} from "../../src/changes/trace/identity.ts";
import {
	applyKnowledgeApplicationPlan,
	assertKnowledgeCandidateCheckpoint,
	compileKnowledgeTransition,
} from "../../src/knowledge/materialization.ts";
import {
	createKnowledgeCheckpoint,
	createKnowledgeCompilerIdentity,
	knowledgeCellByTarget,
} from "../../src/knowledge/state.ts";

function markdown(subjectId, body, extra = "") {
	return `---\ncodewiki_id: ${subjectId}\ntype: System Component\ntitle: Test\nstatus: stable\n${extra}---\n${body}`;
}

function file(path, mediaType, bytes) {
	return {path, mediaType, bytes};
}

function setEffect(base, target, content, mediaType = "text/markdown") {
	return {
		action: "set",
		target,
		expected: knowledgeCellByTarget(base, target)?.digest ?? "absent",
		postState: createKnowledgePostStateArtifact({mediaType, content}),
	};
}

function retireEffect(base, target) {
	const current = knowledgeCellByTarget(base, target);
	assert.ok(current);
	return {action: "retire", target, expected: current.digest};
}

describe("deterministic Knowledge transition materialization", () => {
	it("separates semantic state identity from exact renderer projection identity", () => {
		const first = createKnowledgeCheckpoint({
			files: [
				file(
					"system/components/one.md",
					"text/markdown",
					markdown("cw:component:one", "# One\nMeaning.\n"),
				),
			],
		});
		const compiler = createKnowledgeCompilerIdentity({
			compilerId: "codewiki.project-server.knowledge",
			compilerVersion: "1.0.1",
			markdownRenderer: "codewiki.markdown-splice/1.0.1",
			yamlRenderer: "codewiki.yaml-splice/1.0.0",
		});
		const reformatted = createKnowledgeCheckpoint({
			files: [
				file(
					"moved/one.md",
					"text/markdown",
					"---\nstatus: stable\ntitle: Test\ntype: System Component\ncodewiki_id: cw:component:one\n---\n# One\nMeaning.\n",
				),
			],
			compiler,
		});
		assert.equal(first.state.stateDigest, reformatted.state.stateDigest);
		assert.notEqual(
			first.projection.projectionDigest,
			reformatted.projection.projectionDigest,
		);
	});

	it("compiles one exact subject replacement and preserves unrelated bytes", () => {
		const original = markdown("cw:component:one", "# One\nOld meaning.\n");
		const unrelated = markdown("cw:component:two", "# Two\nKeep  😀 bytes.\n");
		const base = createKnowledgeCheckpoint({
			files: [
				file("system/components/one.md", "text/markdown", original),
				file("system/components/two.md", "text/markdown", unrelated),
			],
		});
		const desired = markdown("cw:component:one", "# One\nNew meaning.\n");
		const transition = {
			kind: "effects",
			effects: [setEffect(base, {subjectId: "cw:component:one"}, desired)],
		};
		const compiled = compileKnowledgeTransition({base, transition});
		assertKnowledgeCandidateCheckpoint(compiled, transition);
		assert.equal(compiled.applicationPlan.operations.length, 1);
		assert.equal(compiled.view.diff[0].status, "modified");
		assert.equal(
			compiled.projected.projection.files.find((entry) => entry.path.endsWith("two.md")).bytes,
			unrelated,
		);
		assert.deepEqual(
			applyKnowledgeApplicationPlan(base.projection.files, compiled.applicationPlan.operations),
			compiled.projected.projection.files,
		);
	});

	it("applies multiple same-file Markdown facet splices against original bytes", () => {
		const source = markdown(
			"cw:component:faceted",
			"# Faceted\nIntro 😀.\n## One\nOld one.\n## Two\nOld two.\n",
			"codewiki_facets:\n  one:\n    kind: heading_path\n    path: [Faceted, One]\n  two:\n    kind: heading_path\n    path: [Faceted, Two]\n",
		);
		const base = createKnowledgeCheckpoint({
			files: [file("system/components/faceted.md", "text/markdown", source)],
		});
		const transition = {
			kind: "effects",
			effects: [
				setEffect(
					base,
					{subjectId: "cw:component:faceted", facetId: "two"},
					"## Two\nNew two.\n",
				),
				setEffect(
					base,
					{subjectId: "cw:component:faceted", facetId: "one"},
					"## One\nNew one.\n",
				),
			],
		};
		const compiled = compileKnowledgeTransition({base, transition});
		const operation = compiled.applicationPlan.operations[0];
		assert.equal(operation.kind, "splice");
		assert.equal(operation.spans.length, 2);
		const result = compiled.projected.projection.files[0].bytes;
		assert.match(result, /Intro 😀\.\n## One\nNew one\.\n## Two\nNew two\.\n/u);
		assert.deepEqual(
			operation.spans.map((span) => span.target.facetId),
			["one", "two"],
		);
	});

	it("uses lossless YAML node splices for facet updates", () => {
		const source = [
			"codewiki_id: cw:diagram:sample",
			"codewiki_facets:",
			"  components:",
			"    kind: yaml",
			"    pointer: /components",
			"untouched:  keep-comment # exact",
			"components:",
			"  - id: old",
			"",
		].join("\n");
		const base = createKnowledgeCheckpoint({
			files: [file("system/diagrams/sample.yaml", "application/yaml", source)],
		});
		const transition = {
			kind: "effects",
			effects: [
				setEffect(
					base,
					{subjectId: "cw:diagram:sample", facetId: "components"},
					"- id: new\n  label: New",
					"application/yaml",
				),
			],
		};
		const compiled = compileKnowledgeTransition({base, transition});
		const bytes = compiled.projected.projection.files[0].bytes;
		assert.match(bytes, /untouched: {2}keep-comment # exact/u);
		assert.match(bytes, /components:\n {2}- id: new\n {4}label: New/u);
	});

	it("retires facets and subjects with permanent tombstones", () => {
		const source = markdown(
			"cw:component:retired",
			"# Retired\nIntro.\n## Removable\nDelete this.\n",
			"codewiki_facets:\n  removable:\n    kind: heading_path\n    path: [Retired, Removable]\n",
		);
		const base = createKnowledgeCheckpoint({
			files: [file("system/components/retired.md", "text/markdown", source)],
		});
		const facetTarget = {subjectId: "cw:component:retired", facetId: "removable"};
		const facetRetired = compileKnowledgeTransition({
			base,
			transition: {kind: "effects", effects: [retireEffect(base, facetTarget)]},
		});
		assert.equal(knowledgeCellByTarget(facetRetired.projected, facetTarget), undefined);
		assert.equal(facetRetired.projected.state.tombstones.length, 1);
		assert.doesNotMatch(facetRetired.projected.projection.files[0].bytes, /codewiki_facets|Removable/u);

		const subjectTarget = {subjectId: "cw:component:retired"};
		const retired = compileKnowledgeTransition({
			base: facetRetired.projected,
			transition: {
				kind: "effects",
				effects: [retireEffect(facetRetired.projected, subjectTarget)],
			},
		});
		assert.equal(retired.projected.projection.files.length, 0);
		assert.throws(
			() =>
				compileKnowledgeTransition({
					base: retired.projected,
					transition: {
						kind: "effects",
						effects: [
							setEffect(
								retired.projected,
								subjectTarget,
								markdown("cw:component:retired", "# Reused\nForbidden.\n"),
							),
						],
					},
				}),
			/cannot be reused/u,
		);
	});

	it("rejects stale bases, semantic no-ops, bad reference closure, and compiler drift", () => {
		const linked = markdown(
			"cw:component:linked",
			"# Linked\nMeaning.\n",
			"codewiki_relationships:\n  - type: depends_on\n    target: cw:component:target\n    rationale: Required.\n",
		);
		const target = markdown("cw:component:target", "# Target\nMeaning.\n");
		const base = createKnowledgeCheckpoint({
			files: [
				file("system/components/linked.md", "text/markdown", linked),
				file("system/components/target.md", "text/markdown", target),
			],
		});
		assert.throws(
			() =>
				compileKnowledgeTransition({
					base,
					transition: {
						kind: "effects",
						effects: [{...setEffect(base, {subjectId: "cw:component:target"}, target), expected: "absent"}],
					},
				}),
			/expected absent/u,
		);
		assert.throws(
			() =>
				compileKnowledgeTransition({
					base,
					transition: {
						kind: "effects",
						effects: [setEffect(base, {subjectId: "cw:component:target"}, target)],
					},
				}),
			/semantic no-op/u,
		);
		assert.throws(
			() =>
				compileKnowledgeTransition({
					base,
					transition: {
						kind: "effects",
						effects: [retireEffect(base, {subjectId: "cw:component:target"})],
					},
				}),
			/relationship closure/u,
		);
		const compiler = createKnowledgeCompilerIdentity({
			compilerId: "other",
			compilerVersion: "1.0.0",
			markdownRenderer: "other",
			yamlRenderer: "other",
		});
		assert.throws(
			() =>
				compileKnowledgeTransition({
					base,
					transition: {kind: "unchanged", refs: [], rationale: "No Knowledge change."},
					compiler,
				}),
			/compiler identity changed/u,
		);
	});
});
