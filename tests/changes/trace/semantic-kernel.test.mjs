import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
	appendChangeTraceOperation,
	changeTracePath,
	createChangeTraceHeader,
	createChangeTraceOperation,
	parseChangeTrace,
	reduceChangeTrace,
	serializeChangeTrace,
} from "../../../src/changes/trace/semantic-kernel.ts";
import {
	assertCompletionRequirement,
	createCompletionRequirement,
} from "../../../src/changes/completion-requirement.ts";

const sha1 = (hex) => ({algorithm: "sha1", hex});
const timestamp = (second) => `2026-08-27T12:00:${String(second).padStart(2, "0")}.000Z`;

function header(changeId = "CHG-demo") {
	return createChangeTraceHeader({
		changeId,
		projectId: "demo",
		repositoryId: "cw:repository:demo",
		objectFormat: "sha1",
		createdAt: timestamp(0),
		createdBy: "actor:maintainer",
	});
}

function operation(index, kind, payload = {}, authorityBearing = true) {
	return createChangeTraceOperation({
		operationId: `op:${String(index).padStart(2, "0")}`,
		kind,
		authorityBearing,
		actorId: "actor:maintainer",
		authorityId: "authority:project-owner",
		occurredAt: timestamp(index),
		payload,
	});
}

function proposed(index, requirements, overrides = {}) {
	return operation(index, "change.proposed", {
		expectedCanonical: sha1("1".repeat(40)),
		intent: "Adopt exact semantic contracts.",
		rationale: "One contract must serve every governed scenario.",
		desiredOutcomes: ["Canonical replay passes."],
		authorityIntent: ["project.change.accept"],
		relatedChangeIds: [],
		compensatesChangeIds: [],
		supersedesChangeIds: [],
		targetRefs: [],
		completionRequirements: requirements,
		completionRationale:
			requirements.length === 0
				? "Accepted meaning needs no realization work."
				: "Completion waits for frozen outcomes.",
		...overrides,
	});
}

function acceptance(index, requirements = []) {
	return operation(index, "change.accepted", {
		expectedCanonical: sha1("1".repeat(40)),
		proposalCommit: sha1("2".repeat(40)),
		proposalTip: sha1("2".repeat(40)),
		decisionId: "decision:demo",
		gateId: "gate:demo",
		confirmationId: "confirmation:demo",
		acceptedItemIds: [],
		retiredItemIds: [],
		completionRequirements: requirements,
		completionState: requirements.length === 0 ? "completed" : "accepted_incomplete",
	});
}

describe("Completion Requirement 1.0.0", () => {
	it("derives stable IDs and domain-separated digests", () => {
		const requirement = createCompletionRequirement({
			projectId: "demo",
			changeId: "CHG-demo",
			ordinal: 0,
			kind: "artifact",
			requiredOutcome: "A reviewed artifact realizes the accepted Item.",
			targetRefs: ["cw:demo:item:policy"],
			accountableActorId: "actor:maintainer",
		});
		assert.equal(
			requirement.requirementId,
			"cw:demo:requirement:z5s2e675hp2y5f7lktdfcq4eqcjvv2zvfaci5xla62ba6njz2r6q",
		);
		assert.match(requirement.requirementDigest, /^sha256:[0-9a-f]{64}$/u);
		assert.doesNotThrow(() =>
			assertCompletionRequirement(requirement, {
				projectId: "demo",
				changeId: "CHG-demo",
			}),
		);
		const tampered = structuredClone(requirement);
		tampered.requiredOutcome = "Different outcome.";
		assert.throws(
			() =>
				assertCompletionRequirement(tampered, {
					projectId: "demo",
					changeId: "CHG-demo",
				}),
			/digest mismatch/u,
		);
	});

	it("rejects provider-shaped and non-canonical requirement sets", () => {
		assert.throws(
			() =>
				createCompletionRequirement({
					projectId: "demo",
					changeId: "CHG-demo",
					ordinal: 0,
					kind: "delivery",
					requiredOutcome: "Provider returned success.",
					targetRefs: ["z", "a"],
					pluginCapability: "github.deploy",
					accountableActorId: "actor:maintainer",
				}),
			/sorted|deliveryRequired/u,
		);
	});
});

describe("append-only Change Trace 13.0.0", () => {
	it("round-trips exact canonical JSONL and preserves byte prefixes", () => {
		const initial = serializeChangeTrace(header(), [proposed(1, [])]);
		const running = appendChangeTraceOperation(
			initial,
			operation(2, "decision.running"),
		);
		assert.equal(running.startsWith(initial), true);
		const complete = [
			operation(3, "decision.passed"),
			operation(4, "confirmation.recorded"),
			acceptance(5),
		].reduce(appendChangeTraceOperation, running);
		const parsed = parseChangeTrace(complete);
		assert.equal(reduceChangeTrace(parsed).status, "completed");
		assert.equal(parsed.operations.length, 5);
		assert.equal(changeTracePath("CHG-demo"), ".codewiki/changes/TRACE-CHG-demo.jsonl");
	});

	it("reduces frozen requirements only after dependency-safe transitions", () => {
		const first = createCompletionRequirement({
			projectId: "demo",
			changeId: "CHG-demo",
			ordinal: 0,
			kind: "artifact",
			requiredOutcome: "Artifact exists at the accepted source head.",
			targetRefs: ["cw:demo:item:policy"],
			accountableActorId: "actor:maintainer",
		});
		const second = createCompletionRequirement({
			projectId: "demo",
			changeId: "CHG-demo",
			ordinal: 1,
			kind: "check",
			requiredOutcome: "Verification passes for the exact artifact.",
			targetRefs: ["cw:demo:item:policy"],
			requiredCheckRefs: ["check:replay"],
			dependencyIds: [first.requirementId],
			accountableActorId: "actor:maintainer",
		});
		const prefix = [
			proposed(1, [first, second]),
			operation(2, "decision.running"),
			operation(3, "decision.passed"),
			operation(4, "confirmation.recorded"),
			acceptance(5, [first, second]),
		];
		assert.throws(
			() =>
				reduceChangeTrace({
					header: header(),
					operations: [
						...prefix,
						operation(6, "requirement.ready", {
							requirementId: second.requirementId,
						}),
					],
				}),
			/dependencies close/u,
		);
		const operations = [
			...prefix,
			operation(6, "requirement.ready", {requirementId: first.requirementId}),
			operation(7, "requirement.running", {requirementId: first.requirementId}),
			operation(8, "requirement.satisfied", {requirementId: first.requirementId}),
			operation(9, "requirement.ready", {requirementId: second.requirementId}),
			operation(10, "requirement.running", {requirementId: second.requirementId}),
			operation(11, "requirement.satisfied", {requirementId: second.requirementId}),
			operation(12, "change.completed"),
		];
		const state = reduceChangeTrace({header: header(), operations});
		assert.equal(state.status, "completed");
		assert.deepEqual(Object.values(state.requirementStates), ["satisfied", "satisfied"]);
	});

	it("represents compensation and supersession only as explicit new-Change intent", () => {
		const compensating = proposed(1, [], {
			compensatesChangeIds: ["CHG-prior"],
			relatedChangeIds: ["CHG-prior"],
		});
		assert.equal(
			reduceChangeTrace({header: header(), operations: [compensating]}).status,
			"proposed",
		);
		assert.throws(
			() => serializeChangeTrace(header(), [
				proposed(1, [], {compensatesChangeIds: ["CHG-demo"]}),
			]),
			/cannot compensate or supersede itself/u,
		);
		assert.throws(
			() => serializeChangeTrace(header(), [
				proposed(1, [], {
					compensatesChangeIds: ["CHG-prior"],
					supersedesChangeIds: ["CHG-prior"],
				}),
			]),
			/cannot be both compensated and superseded/u,
		);
	});

	it("fails closed for unknown authority and malformed lifecycle order", () => {
		assert.throws(
			() => operation(1, "extension.unknown", {}, true),
			/unknown authority/u,
		);
		assert.doesNotThrow(() => operation(1, "extension.observed", {}, false));
		assert.throws(
			() =>
				reduceChangeTrace({
					header: header(),
					operations: [proposed(1, []), acceptance(2)],
				}),
			/invalid while Change is proposed/u,
		);
	});

	it("rejects duplicate IDs, non-canonical lines, truncation, and byte rewrites", () => {
		const duplicate = serializeChangeTrace(header(), [proposed(1, [])]);
		assert.throws(
			() => appendChangeTraceOperation(duplicate, proposed(1, [])),
			/operationId must be unique/u,
		);
		assert.throws(() => parseChangeTrace(duplicate.slice(0, -1)), /end with LF/u);
		assert.throws(
			() => parseChangeTrace(duplicate.replace('{"changeId"', '{ "changeId"')),
			/does not conform/u,
		);
	});
});
