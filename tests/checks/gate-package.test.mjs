import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
	assertGateEvaluationPackage,
	createGateEvaluationPackage,
} from "../../src/checks/gate-package.ts";
import {createCheckInputSelection, subjectInputSelection} from "../../src/checks/protocol.ts";
import {
	checkSnapshot,
	checkSubject,
	digest,
	executionIdentity,
	packagedCheck,
} from "../helpers/checks.mjs";

function packageInput(overrides = {}) {
	const check = packagedCheck();
	const snapshot = checkSnapshot([check]);
	const subject = checkSubject({
		content: overrides.subjectContent ?? {candidate: "decision"},
	});
	const selection = overrides.selection ?? subjectInputSelection(
		subject,
		check.definition.inputs[0],
	);
	return {
		subject,
		checkPackSnapshot: snapshot,
		sources: {
			workStateDigest: digest("work-state"),
			knowledgeStateDigest: digest("knowledge-state"),
			knowledgeProjectionDigest: digest("knowledge-projection"),
			alignmentDigest: digest("alignment"),
			repositoryTreeDigest: digest("repository-tree"),
			repositoryBase: "refs/heads/main",
			evidenceDigest: digest("evidence"),
			resultsDigest: digest("results"),
			configurationDigest: digest("configuration"),
			routesDigest: digest("routes"),
		},
		stageBindings: {
			stage: "decision",
			changeRevisionDigest: digest("revision"),
			knowledgeTransitionDigest: digest("transition"),
			compilerDigest: digest("compiler"),
			applicationPlanDigest: digest("plan"),
			projectedKnowledgeStateDigest: digest("projected-state"),
			projectedKnowledgeProjectionDigest: digest("projected-projection"),
			semanticViewDigest: digest("semantic-view"),
			acceptedActiveChangesDigest: digest("active-changes"),
		},
		checks: [{
			packId: check.packId,
			checkId: check.checkId,
			checkDigest: check.checkDigest,
			execution: executionIdentity(),
			inputs: [selection],
		}],
	};
}

describe("Gate Evaluation Package", () => {
	it("freezes complete Candidate, Check, source, execution, and stage bindings", () => {
		const value = createGateEvaluationPackage(packageInput());
		assert.equal(value.protocol.id, "codewiki.gate-evaluation-package");
		assert.equal(value.coverage, "complete");
		assert.equal(value.checks.length, 1);
		assert.equal(Object.isFrozen(value.subject.content), true);
		assert.equal(Object.isFrozen(value.checkPackSnapshot.packs), true);
		assertGateEvaluationPackage(value);
	});

	it("binds compiler and accepted-target drift into package identity", () => {
		const input = packageInput();
		const baseline = createGateEvaluationPackage(input);
		const compilerDrift = createGateEvaluationPackage({
			...input,
			stageBindings: {
				...input.stageBindings,
				compilerDigest: digest("compiler-drift"),
			},
		});
		const targetDrift = createGateEvaluationPackage({
			...input,
			stageBindings: {
				...input.stageBindings,
				acceptedActiveChangesDigest: digest("accepted-target-drift"),
			},
		});
		assert.notEqual(baseline.packageDigest, compilerDrift.packageDigest);
		assert.notEqual(baseline.packageDigest, targetDrift.packageDigest);
	});

	it("rejects tamper, Check omission, stale input, unknown coverage, and producer handles", () => {
		const value = createGateEvaluationPackage(packageInput());
		assert.throws(
			() => assertGateEvaluationPackage({...value, packageDigest: digest("tampered")}),
			/digest or binding is invalid/u,
		);
		assert.throws(
			() => createGateEvaluationPackage({...packageInput(), checks: []}),
			/omits one or more declared Checks/u,
		);
		const unknown = packageInput();
		assert.throws(
			() => createGateEvaluationPackage({
				...unknown,
				checks: [{...unknown.checks[0], checkId: "unknown-check"}],
			}),
			/stale or unknown/u,
		);
		const base = packageInput();
		const stale = createCheckInputSelection({
			selector: base.checks[0].inputs[0].selector,
			status: "ready",
			items: base.checks[0].inputs[0].items,
			truncated: false,
			stale: true,
		});
		assert.throws(
			() => createGateEvaluationPackage(packageInput({selection: stale})),
			/incomplete or stale/u,
		);
		assert.throws(
			() => createGateEvaluationPackage(packageInput({subjectContent: {handle: "pch:foreign"}})),
			/cannot contain Project Context handles/u,
		);
	});
});
