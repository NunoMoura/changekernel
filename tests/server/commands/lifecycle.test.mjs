import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {cp, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {bootstrapCodewikiProject} from "../../../src/adapters/git/bootstrap.ts";
import {createGitProjectStore} from "../../../src/adapters/git/project-store.ts";
import {PRODUCT_OPERATIONS, createProductTransportRequest, decodeProductTransportResponse} from "../../../src/api/transport/envelope.ts";
import {failure, success} from "../../../src/kernel/data-contracts/outcome.ts";
import {createEvidenceReference} from "../../../src/kernel/evidence/reference.ts";
import {gitOid} from "../../../src/kernel/identity/git.ts";
import {createWork} from "../../../src/kernel/work/contracts.ts";
import {createProjectAccessPolicy, projectAccessProofDigest} from "../../../src/server/authorization/policy.ts";
import {createProjectServer} from "../../../src/server/index.ts";
import {createMemoryProjectServerFacts} from "../../../src/server/recovery/facts.ts";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "../../../src/ports/agent-runtime.ts";
import {CHECK_RUNNER_PORT_PROTOCOL} from "../../../src/ports/check-runner.ts";

const sourceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const repositoryId = "cw:repository:lifecycle-test";
const actorId = "cw:actor:lifecycle-test";
const authorizationId = "cw:authorization:lifecycle-test";
const proof = "lifecycle-test-proof-value";
const timestamp = "2026-09-10T00:00:00Z";
const expiry = "2026-09-11T00:00:00Z";
const kernelBuildDigest = digest("a");

async function fixture(
	checkRunner = passingCheckRunner(),
	protectedEffects = [],
	decorateProjectStore = (store) => store,
	decorateFacts = (facts) => facts,
) {
	const root = await mkdtemp(join(tmpdir(), "codewiki-lifecycle-"));
	git(root, ["init", "-q", "-b", "main"]);
	await writeFile(join(root, "README.md"), "# Lifecycle fixture\n");
	git(root, ["add", "README.md"]);
	git(root, ["commit", "-q", "-m", "base"]);
	const bootstrapped = await bootstrapCodewikiProject({projectRoot: root, project: "lifecycle-fixture"});
	assert.equal(bootstrapped.ok, true, bootstrapped.ok ? "" : bootstrapped.error.message);
	await cp(join(sourceRoot, ".codewiki", "wiki", "items"), join(root, ".codewiki", "wiki", "items"), {recursive: true});
	git(root, ["add", ".codewiki"]);
	git(root, ["commit", "-q", "-m", "bootstrap CodeWiki"]);
	const store = createGitProjectStore({repositoryRoot: root, repositoryId});
	assert.equal(store.ok, true, store.ok ? "" : store.error.message);
	const facts = createMemoryProjectServerFacts();
	assert.equal(facts.ok, true);
	const proofDigest = projectAccessProofDigest(proof);
	assert.equal(proofDigest.ok, true);
	const policy = createProjectAccessPolicy({
		grants: [{
			authorizationId,
			identityRef: "cw:identity:lifecycle-test",
			actorId,
			proofDigest: proofDigest.value,
			expiresAt: expiry,
			capabilities: [...PRODUCT_OPERATIONS],
			wikiItemIds: null,
			changeIds: null,
		}],
		now: () => timestamp,
	});
	assert.equal(policy.ok, true, policy.ok ? "" : policy.error.message);
	const unavailableAgentRuntime = async () => { throw new Error("Agent Runtime is not invoked by lifecycle command fixtures."); };
	const server = createProjectServer({
		ports: {
			projectStore: decorateProjectStore(store.value),
			checkRunner,
			facts: decorateFacts(facts.value),
			agentRuntime: {protocol: AGENT_RUNTIME_PORT_PROTOCOL, start: unavailableAgentRuntime, inspect: unavailableAgentRuntime, cancel: unavailableAgentRuntime},
		},
		accessPolicy: policy.value,
		project: {
			projectName: "Lifecycle fixture",
			repositoryId,
			objectFormat: "sha1",
			canonicalRef: "refs/heads/main",
			kernelBuildDigest,
			retiredWikiItemIds: [],
		},
		protectedEffects,
		clock: () => timestamp,
	});
	assert.equal(server.ok, true, server.ok ? "" : server.error.message);
	let ordinal = 0;
	const call = async (operation, input) => {
		ordinal += 1;
		const request = createProductTransportRequest({
			requestId: `cw:request:lifecycle-${ordinal}`,
			repositoryId,
			client: {kind: "sdk", instanceId: "cw:client:lifecycle-test"},
			authentication: {identityRef: "cw:identity:lifecycle-test", proof},
			expiresAt: expiry,
			operation,
			input,
		});
		assert.equal(request.ok, true, request.ok ? "" : request.error.message);
		const response = decodeProductTransportResponse(await server.value.handle(request.value));
		assert.equal(response.ok, true, response.ok ? "" : response.error.message);
		return response.value;
	};
	return {root, call};
}

test("Project Server runs a Wiki-only Change through Completion and records protected effects atomically", async () => {
	const capability = "codewiki.effect:test-release";
	const effectRef = "refs/codewiki/effects/test-release";
	const subject = await fixture(undefined, [{capability, ref: effectRef, actorIds: [actorId]}]);
	try {
		const projectHead = oid(git(subject.root, ["rev-parse", "HEAD"]));
		const path = ".codewiki/wiki/items/product/codewiki-console.md";
		const secondPath = ".codewiki/wiki/items/system/components/project-server.md";
		const content = await readFile(join(subject.root, path), "utf8");
		const secondContent = await readFile(join(subject.root, secondPath), "utf8");
		const proposal = await subject.call("changes.propose", {
			commandId: "cw:command:propose-wiki-only",
			expectedProjectHead: projectHead,
			proposals: [{
				proposalKey: "console-copy",
				changeType: "correction",
				realization: "wiki-only",
				intent: "Clarify one stable Console responsibility.",
				rationale: "The user-facing lifecycle wording must remain explicit.",
				acceptance: ["Console and Project Server Items contain the added stable responsibility sentences."],
				targets: [
					{itemId: "cw:component:project-server", facets: ["body"]},
					{itemId: "cw:design:product", facets: ["body"]},
				],
				relationships: [],
				contributorRefs: [actorId],
				producerRunRefs: ["cw:run:lifecycle-test"],
				wiki: {upserts: [
					{path, content: `${content.trimEnd()}\n\nThe Console keeps lifecycle next actions explicit.\n`},
					{path: secondPath, content: `${secondContent.trimEnd()}\n\nProject Server keeps local lifecycle mutation bounded.\n`},
				], deletes: []},
			}],
		});
		assert.equal(proposal.status, "ok", proposal.error?.message);
		const changeId = proposal.data.changes[0].changeId;
		const proposedTip = oid(git(subject.root, ["rev-parse", `refs/codewiki/changes/${changeId}`]));

		const gate = await subject.call("decision.evaluate", {
			commandId: "cw:command:evaluate-decision",
			changeId,
			expectedProjectHead: projectHead,
			expectedChangeTip: proposedTip,
		});
		assert.equal(gate.status, "ok", gate.error?.message);
		assert.equal(gate.data.status, "passed");
		const gatedTip = oid(git(subject.root, ["rev-parse", `refs/codewiki/changes/${changeId}`]));

		const committed = await subject.call("decision.commit", {
			commandId: "cw:command:commit-decision",
			changeId,
			expectedProjectHead: projectHead,
			expectedChangeTip: gatedTip,
		});
		assert.equal(committed.status, "ok", committed.error?.message);
		assert.equal(committed.data.status, "completed");
		assert.equal(git(subject.root, ["rev-parse", "refs/heads/main"]), git(subject.root, ["rev-parse", `refs/codewiki/changes/${changeId}`]));
		assert.match(git(subject.root, ["show", `refs/heads/main:${path}`]), /keeps lifecycle next actions explicit/u);
		assert.match(git(subject.root, ["show", `refs/heads/main:${secondPath}`]), /keeps local lifecycle mutation bounded/u);

		const completedHead = oid(git(subject.root, ["rev-parse", "refs/heads/main"]));
		const failedEffect = await subject.call("effects.request", {
			commandId: "cw:command:record-protected-effect-failure",
			changeId,
			expectedProjectHead: completedHead,
			expectedChangeTip: completedHead,
			capability,
			expectedEffectHead: oid("2".repeat(40)),
		});
		assert.equal(failedEffect.status, "error");
		assert.equal(git(subject.root, ["rev-parse", "refs/heads/main"]), completedHead.hex);
		assert.equal(git(subject.root, ["rev-parse", `refs/codewiki/changes/${changeId}`]), completedHead.hex);
		assert.equal(git(subject.root, ["for-each-ref", "--format=%(refname)", effectRef]), "");

		const effect = await subject.call("effects.request", {
			commandId: "cw:command:record-protected-effect",
			changeId,
			expectedProjectHead: completedHead,
			expectedChangeTip: completedHead,
			capability,
			expectedEffectHead: null,
		});
		assert.equal(effect.status, "ok", effect.error?.message);
		assert.equal(effect.data.status, "passed");
		assert.equal(git(subject.root, ["rev-parse", effectRef]), completedHead.hex);
		assert.notEqual(git(subject.root, ["rev-parse", "refs/heads/main"]), completedHead.hex);

		const replayed = await subject.call("decision.commit", {
			commandId: "cw:command:commit-decision",
			changeId,
			expectedProjectHead: projectHead,
			expectedChangeTip: gatedTip,
		});
		assert.equal(replayed.status, "ok");
		assert.equal(replayed.data.status, "completed");
	} finally {
		await rm(subject.root, {recursive: true, force: true});
	}
});

test("batch Proposal reconciliation recovers lost object-write and atomic-CAS responses without duplicate events", async () => {
	let loseFirstBlobResponse = true;
	let loseFirstTreeResponse = true;
	let loseFirstCommitResponse = true;
	let loseFirstCasResponse = true;
	const subject = await fixture(undefined, [], (store) => Object.freeze({
		protocol: store.protocol,
		readSnapshot: store.readSnapshot.bind(store),
		readBlob: store.readBlob.bind(store),
		readTree: store.readTree.bind(store),
		async writeBlob(request) {
			const result = await store.writeBlob(request);
			if (result.ok && loseFirstBlobResponse) {
				loseFirstBlobResponse = false;
				return failure({code: "command_failed", operation: "write_blob", message: "Simulated lost blob response."});
			}
			return result;
		},
		async writeTree(request) {
			const result = await store.writeTree(request);
			if (result.ok && loseFirstTreeResponse) {
				loseFirstTreeResponse = false;
				return failure({code: "command_failed", operation: "write_tree", message: "Simulated lost tree response."});
			}
			return result;
		},
		async createCommit(request) {
			const result = await store.createCommit(request);
			if (result.ok && loseFirstCommitResponse) {
				loseFirstCommitResponse = false;
				return failure({code: "command_failed", operation: "create_commit", message: "Simulated lost commit response."});
			}
			return result;
		},
		async compareAndSwapRefs(request) {
			const result = await store.compareAndSwapRefs(request);
			if (result.ok && loseFirstCasResponse) {
				loseFirstCasResponse = false;
				return failure({code: "command_failed", operation: "cas", message: "Simulated lost CAS response."});
			}
			return result;
		},
	}));
	try {
		const projectHead = oid(git(subject.root, ["rev-parse", "HEAD"]));
		const consolePath = ".codewiki/wiki/items/product/codewiki-console.md";
		const serverPath = ".codewiki/wiki/items/system/components/project-server.md";
		const consoleContent = await readFile(join(subject.root, consolePath), "utf8");
		const serverContent = await readFile(join(subject.root, serverPath), "utf8");
		const input = {
			commandId: "cw:command:recover-batch-proposal",
			expectedProjectHead: projectHead,
			proposals: [
				proposal("console-batch", "cw:design:product", consolePath, `${consoleContent.trimEnd()}\n\nBatch proposal A.\n`),
				proposal("server-batch", "cw:component:project-server", serverPath, `${serverContent.trimEnd()}\n\nBatch proposal B.\n`),
			],
		};
		const lostBlob = await subject.call("changes.propose", input);
		assert.equal(lostBlob.status, "error");
		const lostTree = await subject.call("changes.propose", input);
		assert.equal(lostTree.status, "error");
		const lostCommit = await subject.call("changes.propose", input);
		assert.equal(lostCommit.status, "error");
		const lostCas = await subject.call("changes.propose", input);
		assert.equal(lostCas.status, "error");
		const reconciled = await subject.call("changes.propose", input);
		assert.equal(reconciled.status, "ok", reconciled.error?.message);
		assert.equal(reconciled.data.changes.length, 2);
		for (const change of reconciled.data.changes) {
			const trace = git(subject.root, ["show", `refs/codewiki/changes/${change.changeId}:.codewiki/changes/TRACE-${change.changeId}.jsonl`]);
			assert.equal(trace.split("\n").length, 2);
		}
		assert.equal(git(subject.root, ["rev-parse", "refs/heads/main"]), projectHead.hex);

		const firstId = reconciled.data.changes[0]?.changeId;
		const secondId = reconciled.data.changes[1]?.changeId;
		assert.equal(typeof firstId, "string");
		assert.equal(typeof secondId, "string");
		let firstTip = refOid(subject.root, firstId);
		assert.equal((await subject.call("decision.evaluate", command("evaluate-first-batch", firstId, projectHead, firstTip))).status, "ok");
		firstTip = refOid(subject.root, firstId);
		assert.equal((await subject.call("decision.commit", command("complete-first-batch", firstId, projectHead, firstTip))).status, "ok");
		const advancedHead = oid(git(subject.root, ["rev-parse", "refs/heads/main"]));

		let secondTip = refOid(subject.root, secondId);
		const needsRevision = await subject.call("decision.evaluate", command("stale-second-batch", secondId, advancedHead, secondTip));
		assert.equal(needsRevision.status, "error");
		assert.equal(needsRevision.error.code, "reconciliation_required");
		const currentServerContent = git(subject.root, ["show", `refs/heads/main:${serverPath}`]);
		const {proposalKey: _proposalKey, ...revisionProposal} = proposal(
			"server-batch",
			"cw:component:project-server",
			serverPath,
			`${currentServerContent.trimEnd()}\n\nBatch proposal B.\n`,
		);
		const revised = await subject.call("changes.revise", {
			...command("revise-second-batch", secondId, advancedHead, secondTip),
			proposal: revisionProposal,
		});
		assert.equal(revised.status, "ok", revised.error?.message);
		secondTip = refOid(subject.root, secondId);
		assert.equal((await subject.call("decision.evaluate", command("evaluate-second-batch", secondId, advancedHead, secondTip))).status, "ok");
		secondTip = refOid(subject.root, secondId);
		const rejected = await subject.call("decision.reject", {
			...command("reject-second-batch", secondId, advancedHead, secondTip),
			reason: "Independent outcome exercised by fixture.",
		});
		assert.equal(rejected.status, "ok", rejected.error?.message);
		assert.equal(rejected.data.status, "rejected");
	} finally {
		await rm(subject.root, {recursive: true, force: true});
	}
});

function proposal(proposalKey, itemId, path, content) {
	return {
		proposalKey,
		changeType: "correction",
		realization: "wiki-only",
		intent: `Exercise ${proposalKey} atomic admission.`,
		rationale: "Batch admission and retry must preserve one exact semantic event.",
		acceptance: [`${proposalKey} is admitted exactly once.`],
		targets: [{itemId, facets: ["body"]}],
		relationships: [],
		contributorRefs: [actorId],
		producerRunRefs: ["cw:run:lifecycle-batch-test"],
		wiki: {upserts: [{path, content}], deletes: []},
	};
}

test("accepted superseding Change becomes sole explicit supersession authority", async () => {
	const subject = await fixture();
	try {
		let projectHead = oid(git(subject.root, ["rev-parse", "HEAD"]));
		const path = ".codewiki/wiki/items/product/codewiki-console.md";
		const content = await readFile(join(subject.root, path), "utf8");
		const oldProposal = await subject.call("changes.propose", {
			commandId: "cw:command:propose-superseded-change",
			expectedProjectHead: projectHead,
			proposals: [proposal("superseded", "cw:design:product", path, `${content.trimEnd()}\n\nSuperseded wording.\n`)],
		});
		assert.equal(oldProposal.status, "ok", oldProposal.error?.message);
		const oldId = oldProposal.data.changes[0].changeId;
		const replacementInput = {
			...proposal("superseding", "cw:design:product", path, `${content.trimEnd()}\n\nAccepted replacement wording.\n`),
			relationships: [{type: "supersedes", target: {kind: "change", changeId: oldId}, rationale: "Replacement is accepted before supersession is recorded."}],
		};
		const replacementProposal = await subject.call("changes.propose", {
			commandId: "cw:command:propose-superseding-change",
			expectedProjectHead: projectHead,
			proposals: [replacementInput],
		});
		assert.equal(replacementProposal.status, "ok", replacementProposal.error?.message);
		const replacementId = replacementProposal.data.changes[0].changeId;
		let replacementTip = refOid(subject.root, replacementId);
		assert.equal((await subject.call("decision.evaluate", command("evaluate-superseding-change", replacementId, projectHead, replacementTip))).status, "ok");
		replacementTip = refOid(subject.root, replacementId);
		assert.equal((await subject.call("decision.commit", command("complete-superseding-change", replacementId, projectHead, replacementTip))).status, "ok");
		projectHead = oid(git(subject.root, ["rev-parse", "refs/heads/main"]));
		const oldTip = refOid(subject.root, oldId);
		const superseded = await subject.call("changes.supersede", {
			...command("record-supersession", oldId, projectHead, oldTip),
			supersedingChangeId: replacementId,
		});
		assert.equal(superseded.status, "ok", superseded.error?.message);
		assert.equal(superseded.data.status, "superseded");
		assert.match(git(subject.root, ["show", `refs/heads/main:${path}`]), /Accepted replacement wording/u);
	} finally {
		await rm(subject.root, {recursive: true, force: true});
	}
});

test("Decision Gate recovery reconciles a lost immutable-facts response", async () => {
	let loseFirstFactsWriteResponse = true;
	let loseFirstFactsReadResponse = true;
	const subject = await fixture(undefined, [], (store) => store, (facts) => Object.freeze({
		protocol: facts.protocol,
		async readGateBundle(request) {
			const result = await facts.readGateBundle(request);
			if (result.ok && loseFirstFactsReadResponse) {
				loseFirstFactsReadResponse = false;
				return failure({code: "storage_failed", operation: "read_gate", message: "Simulated lost facts read response."});
			}
			return result;
		},
		async writeGateBundle(request) {
			const result = await facts.writeGateBundle(request);
			if (result.ok && loseFirstFactsWriteResponse) {
				loseFirstFactsWriteResponse = false;
				return failure({code: "storage_failed", operation: "write_gate", message: "Simulated lost facts response."});
			}
			return result;
		},
	}));
	try {
		const projectHead = oid(git(subject.root, ["rev-parse", "HEAD"]));
		const path = ".codewiki/wiki/items/product/codewiki-console.md";
		const content = await readFile(join(subject.root, path), "utf8");
		const proposed = await subject.call("changes.propose", {
			commandId: "cw:command:facts-recovery-proposal",
			expectedProjectHead: projectHead,
			proposals: [proposal("facts-recovery", "cw:design:product", path, `${content.trimEnd()}\n\nFacts recovery remains deterministic.\n`)],
		});
		assert.equal(proposed.status, "ok", proposed.error?.message);
		const changeId = proposed.data.changes[0].changeId;
		const changeTip = refOid(subject.root, changeId);
		const evaluation = command("facts-recovery-decision", changeId, projectHead, changeTip);
		const lostWrite = await subject.call("decision.evaluate", evaluation);
		assert.equal(lostWrite.status, "error");
		const lostRead = await subject.call("decision.evaluate", evaluation);
		assert.equal(lostRead.status, "error");
		const recovered = await subject.call("decision.evaluate", evaluation);
		assert.equal(recovered.status, "ok", recovered.error?.message);
		assert.equal(recovered.data.status, "passed");
		const trace = git(subject.root, ["show", `refs/codewiki/changes/${changeId}:.codewiki/changes/TRACE-${changeId}.jsonl`]);
		assert.equal(trace.split("\n").length, 3);
	} finally {
		await rm(subject.root, {recursive: true, force: true});
	}
});

test("Project Server fails closed for stale bindings, conflicting command replay, and stopped Decision Gates", async () => {
	const stoppedRunner = Object.freeze({
		protocol: CHECK_RUNNER_PORT_PROTOCOL,
		async run() {
			throw new Error("fixture runner unavailable");
		},
	});
	const subject = await fixture(stoppedRunner);
	try {
		const projectHead = oid(git(subject.root, ["rev-parse", "HEAD"]));
		const path = ".codewiki/wiki/items/product/codewiki-console.md";
		const content = await readFile(join(subject.root, path), "utf8");
		const proposalBody = {
			commandId: "cw:command:negative-proposal",
			expectedProjectHead: projectHead,
			proposals: [{
				proposalKey: "negative-flow",
				changeType: "correction",
				realization: "wiki-only",
				intent: "Verify fail-closed lifecycle outcomes.",
				rationale: "Recovery behavior requires executable evidence.",
				acceptance: ["Stale and stopped operations cannot advance authority."],
				targets: [{itemId: "cw:design:product", facets: ["body"]}],
				relationships: [],
				contributorRefs: [actorId],
				producerRunRefs: ["cw:run:lifecycle-negative-test"],
				wiki: {upserts: [{path, content: `${content.trimEnd()}\n\nLifecycle failure remains fail-closed.\n`}], deletes: []},
			}],
		};
		const stale = await subject.call("changes.propose", {...proposalBody, commandId: "cw:command:stale-proposal", expectedProjectHead: oid("1".repeat(40))});
		assert.equal(stale.status, "error");
		assert.equal(stale.error.code, "source_stale");

		const proposed = await subject.call("changes.propose", proposalBody);
		assert.equal(proposed.status, "ok", proposed.error?.message);
		const changedReplay = await subject.call("changes.propose", {
			...proposalBody,
			proposals: [{...proposalBody.proposals[0], intent: "Conflicting replay intent."}],
		});
		assert.equal(changedReplay.status, "error");
		assert.equal(changedReplay.error.code, "idempotency_conflict");

		const changeId = proposed.data.changes[0].changeId;
		let changeTip = refOid(subject.root, changeId);
		const evaluated = await subject.call("decision.evaluate", command("stopped-decision", changeId, projectHead, changeTip));
		assert.equal(evaluated.status, "ok", evaluated.error?.message);
		assert.equal(evaluated.data.status, "stopped");
		changeTip = refOid(subject.root, changeId);
		const blocked = await subject.call("decision.commit", command("blocked-decision", changeId, projectHead, changeTip));
		assert.equal(blocked.status, "error");
		assert.equal(blocked.error.code, "gate_failed");
		assert.equal(git(subject.root, ["rev-parse", "refs/heads/main"]), projectHead.hex);
	} finally {
		await rm(subject.root, {recursive: true, force: true});
	}
});

test("Project Server runs project Work through Planning, Implementation, Review, and atomic completion", async () => {
	const subject = await fixture();
	try {
		let projectHead = oid(git(subject.root, ["rev-parse", "HEAD"]));
		const path = ".codewiki/wiki/items/product/codewiki-console.md";
		const content = await readFile(join(subject.root, path), "utf8");
		const proposal = await subject.call("changes.propose", {
			commandId: "cw:command:propose-project-change",
			expectedProjectHead: projectHead,
			proposals: [{
				proposalKey: "project-work",
				changeType: "correction",
				realization: "project",
				intent: "Bind one Project artifact to the documented Console behavior.",
				rationale: "Project realization must traverse every governed stage.",
				acceptance: ["README records the lifecycle fixture result."],
				targets: [{itemId: "cw:design:product", facets: ["body"]}],
				relationships: [],
				contributorRefs: [actorId],
				producerRunRefs: ["cw:run:lifecycle-project-test"],
				wiki: {upserts: [{path, content: `${content.trimEnd()}\n\nProject realization remains Gate-bound through completion.\n`}], deletes: []},
			}],
		});
		assert.equal(proposal.status, "ok", proposal.error?.message);
		const changeId = proposal.data.changes[0].changeId;
		let changeTip = refOid(subject.root, changeId);
		assert.equal((await subject.call("decision.evaluate", command("evaluate-project-decision", changeId, projectHead, changeTip))).status, "ok");
		changeTip = refOid(subject.root, changeId);
		assert.equal((await subject.call("decision.commit", command("commit-project-decision", changeId, projectHead, changeTip))).status, "ok");
		changeTip = refOid(subject.root, changeId);
		projectHead = oid(git(subject.root, ["rev-parse", "refs/heads/main"]));

		const workInput = {
			ordinal: 1,
			workType: "codewiki.work:source",
			targets: [{itemId: "cw:design:product", facets: ["body"]}],
			writablePaths: ["README.md"],
			dependencyOrdinals: [],
			capabilities: ["codewiki.capability:project-artifact-write"],
			acceptance: ["README records the lifecycle fixture result."],
		};
		const secondWorkInput = {
			ordinal: 2,
			workType: "codewiki.work:source",
			targets: [{itemId: "cw:design:product", facets: ["body"]}],
			writablePaths: ["SECOND.md"],
			dependencyOrdinals: [],
			capabilities: ["codewiki.capability:project-artifact-write"],
			acceptance: ["SECOND.md records independently integrated Work."],
		};
		const plan = [workInput, secondWorkInput];
		const planningGate = await subject.call("planning.evaluate", {...command("evaluate-project-plan", changeId, projectHead, changeTip), work: plan});
		assert.equal(planningGate.status, "ok", planningGate.error?.message);
		changeTip = refOid(subject.root, changeId);
		assert.equal((await subject.call("planning.admit", {...command("admit-project-plan", changeId, projectHead, changeTip), work: plan})).status, "ok");
		changeTip = refOid(subject.root, changeId);
		const work = createWork({
			changeId,
			ordinal: workInput.ordinal,
			workType: workInput.workType,
			targets: workInput.targets,
			writablePaths: workInput.writablePaths,
			dependencies: [],
			capabilities: workInput.capabilities,
			acceptance: workInput.acceptance,
		});
		assert.equal(work.ok, true, work.ok ? "" : work.error.message);
		const secondWork = createWork({
			changeId,
			ordinal: secondWorkInput.ordinal,
			workType: secondWorkInput.workType,
			targets: secondWorkInput.targets,
			writablePaths: secondWorkInput.writablePaths,
			dependencies: [],
			capabilities: secondWorkInput.capabilities,
			acceptance: secondWorkInput.acceptance,
		});
		assert.equal(secondWork.ok, true, secondWork.ok ? "" : secondWork.error.message);

		git(subject.root, ["reset", "-q", "--hard", "refs/heads/main"]);
		git(subject.root, ["checkout", "-q", "-b", "lifecycle-result"]);
		await writeFile(join(subject.root, "README.md"), "# Lifecycle fixture\n\nGoverned project Work completed.\n");
		git(subject.root, ["add", "README.md"]);
		git(subject.root, ["commit", "-q", "-m", "produce Work result"]);
		const resultCommit = oid(git(subject.root, ["rev-parse", "HEAD"]));
		git(subject.root, ["checkout", "-q", "main"]);
		git(subject.root, ["reset", "-q", "--hard", "refs/heads/main"]);
		git(subject.root, ["checkout", "-q", "-b", "second-lifecycle-result"]);
		await writeFile(join(subject.root, "SECOND.md"), "# Second governed Work\n");
		git(subject.root, ["add", "SECOND.md"]);
		git(subject.root, ["commit", "-q", "-m", "produce second Work result"]);
		const secondResultCommit = oid(git(subject.root, ["rev-parse", "HEAD"]));
		git(subject.root, ["checkout", "-q", "main"]);

		const admittedWork = await subject.call("work.admit", {...command("admit-work-result", changeId, projectHead, changeTip), workId: work.value.workId, resultCommit});
		assert.equal(admittedWork.status, "ok", admittedWork.error?.message);
		changeTip = refOid(subject.root, changeId);
		assert.equal((await subject.call("work.evaluate", {...command("evaluate-work-result", changeId, projectHead, changeTip), workId: work.value.workId})).status, "ok");
		changeTip = refOid(subject.root, changeId);
		assert.equal((await subject.call("work.integrate", {...command("integrate-work-result", changeId, projectHead, changeTip), workId: work.value.workId})).status, "ok");
		changeTip = refOid(subject.root, changeId);
		const admittedSecondWork = await subject.call("work.admit", {...command("admit-second-work-result", changeId, projectHead, changeTip), workId: secondWork.value.workId, resultCommit: secondResultCommit});
		assert.equal(admittedSecondWork.status, "ok", admittedSecondWork.error?.message);
		changeTip = refOid(subject.root, changeId);
		assert.equal((await subject.call("work.evaluate", {...command("evaluate-second-work-result", changeId, projectHead, changeTip), workId: secondWork.value.workId})).status, "ok");
		changeTip = refOid(subject.root, changeId);
		assert.equal((await subject.call("work.integrate", {...command("integrate-second-work-result", changeId, projectHead, changeTip), workId: secondWork.value.workId})).status, "ok");
		changeTip = refOid(subject.root, changeId);

		await writeFile(join(subject.root, "README.md"), "# Lifecycle fixture\n\nConflicting canonical result.\n");
		git(subject.root, ["add", "README.md"]);
		const conflictingTree = git(subject.root, ["write-tree"]);
		git(subject.root, ["reset", "-q", "--hard", "refs/heads/main"]);
		const conflictingCommit = git(subject.root, ["commit-tree", conflictingTree, "-p", projectHead.hex, "-m", "conflicting canonical artifact"]);
		git(subject.root, ["update-ref", "refs/heads/main", conflictingCommit, projectHead.hex]);
		const conflict = await subject.call("review.reconcile", command("reject-overlap", changeId, oid(conflictingCommit), changeTip));
		assert.equal(conflict.status, "error");
		assert.equal(conflict.error.code, "reconciliation_required");
		git(subject.root, ["update-ref", "refs/heads/main", projectHead.hex, conflictingCommit]);

		assert.equal((await subject.call("review.reconcile", command("reconcile-review", changeId, projectHead, changeTip))).status, "ok");
		changeTip = refOid(subject.root, changeId);
		assert.equal((await subject.call("review.evaluate", command("evaluate-review", changeId, projectHead, changeTip))).status, "ok");
		changeTip = refOid(subject.root, changeId);

		const canonicalTree = git(subject.root, ["rev-parse", "refs/heads/main^{tree}"]);
		const driftCommit = git(subject.root, ["commit-tree", canonicalTree, "-p", projectHead.hex, "-m", "concurrent canonical drift"]);
		git(subject.root, ["update-ref", "refs/heads/main", driftCommit, projectHead.hex]);
		projectHead = oid(driftCommit);
		const staleReview = await subject.call("changes.complete", command("stale-review-completion", changeId, projectHead, changeTip));
		assert.equal(staleReview.status, "error");
		assert.equal(staleReview.error.code, "reconciliation_required");
		assert.equal((await subject.call("review.reconcile", command("reconcile-after-drift", changeId, projectHead, changeTip))).status, "ok");
		changeTip = refOid(subject.root, changeId);
		assert.equal((await subject.call("review.evaluate", command("evaluate-after-drift", changeId, projectHead, changeTip))).status, "ok");
		changeTip = refOid(subject.root, changeId);
		const completed = await subject.call("changes.complete", command("complete-project-change", changeId, projectHead, changeTip));
		assert.equal(completed.status, "ok", completed.error?.message);
		assert.equal(completed.data.status, "completed");
		assert.match(git(subject.root, ["show", "refs/heads/main:README.md"]), /Governed project Work completed/u);
		assert.match(git(subject.root, ["show", "refs/heads/main:SECOND.md"]), /Second governed Work/u);
		assert.match(git(subject.root, ["show", `refs/heads/main:${path}`]), /Project realization remains Gate-bound/u);
		assert.equal(git(subject.root, ["rev-list", "--parents", "-n", "1", "refs/heads/main"]).split(" ").length, 3);
	} finally {
		await rm(subject.root, {recursive: true, force: true});
	}
});

function command(key, changeId, expectedProjectHead, expectedChangeTip) {
	return {commandId: `cw:command:${key}`, changeId, expectedProjectHead, expectedChangeTip};
}

function refOid(root, changeId) {
	return oid(git(root, ["rev-parse", `refs/codewiki/changes/${changeId}`]));
}

function passingCheckRunner() {
	return Object.freeze({
		protocol: CHECK_RUNNER_PORT_PROTOCOL,
		async run(request) {
			const implementation = request.registration.definition.implementation;
			const receipt = createEvidenceReference({
				evidenceId: `cw:evidence:${request.registration.definition.id}`,
				evidenceDigest: digest("6"),
				schema: {id: "codewiki.execution-receipt", version: "1.0.0"},
				mediaType: "application/json",
				subjectDigest: request.gate.subject.subjectDigest,
				subjectOids: [],
				materialDigests: [],
				producerId: "cw:actor:test-check-runner",
				method: "codewiki.method:fixture",
				receiptDigest: digest("7"),
				authority: "observed",
				coverage: "complete",
				freshness: "current",
				capturePolicy: "metadata_only",
				retentionPolicy: "pinned",
				limitations: [],
			});
			assert.equal(receipt.ok, true, receipt.ok ? "" : receipt.error.message);
			return success(Object.freeze({
				status: "completed",
				measurement: {kind: "binary", value: true},
				summary: "The exact lifecycle subject passes the fixture Check.",
				details: [],
				failure: null,
				execution: {
					kind: implementation.kind,
					executorId: "codewiki-test-runner",
					executorVersion: "1.0.0",
					profile: implementation.profile,
					route: implementation.kind === "model" ? implementation.route : null,
					configurationDigest: request.requestDigest,
				},
				evidence: [],
				executionReceipt: receipt.value,
			}));
		},
	});
}

function git(root, args) {
	return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
		cwd: root,
		encoding: "utf8",
		env: {...process.env, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.invalid", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.invalid"},
	}).trim();
}

function oid(hex) {
	const result = gitOid("sha1", hex);
	assert.equal(result.ok, true);
	return result.value;
}

function digest(character) {
	return `sha256:${character.repeat(64)}`;
}
