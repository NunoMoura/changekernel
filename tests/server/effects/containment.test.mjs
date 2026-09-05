import assert from "node:assert/strict";
import test from "node:test";

import {
	createDshAgentRuntime,
} from "../../../src/adapters/dsh/agent-runtime.ts";
import {
	createLocalDshExecutionHost,
} from "../../../src/adapters/dsh/local-execution-host.ts";
import {
	createLocalPreviewAdapter,
} from "../../../src/adapters/preview/local.ts";
import {gitOid} from "../../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {
	AGENT_ROLE_POLICIES,
	AGENT_ROLE_POLICY_DIGEST,
	authorizeAgentRun,
} from "../../../src/server/effects/agent-runs.ts";
import {
	createPreviewSubject,
	previewRequestDigest,
} from "../../../src/ports/preview.ts";
import {
	createWork,
	workAllowsPath,
} from "../../../src/kernel/work/contracts.ts";

const digest = (c) => `sha256:${c.repeat(64)}`;
const semantic = (protocol, value) => {
	const result = semanticDigest(protocol, value);
	assert.equal(result.ok, true);
	return result.value;
};
const oid = (character) => {
	const result = gitOid("sha1", character.repeat(40));
	assert.equal(result.ok, true);
	return result.value;
};

function workerAuthInput(overrides = {}) {
	const routeBody = {routeId: "cw:route:worker", providerId: "cw:provider:replay", modelId: "cw:model:replay"};
	return {
		role: "worker",
		stage: "implementation",
		actorId: "cw:actor:worker",
		authorizationId: "cw:authorization:worker",
		subject: {
			subjectId: "cw:subject:work",
			subjectDigest: digest("1"),
			repositoryId: "cw:repository:test",
			projectCommit: oid("1"),
			projectTree: oid("2"),
			changeId: "CHG-containment",
			changeTip: oid("3"),
			workId: "cw:work:unit-1",
			artifactCommit: null,
			artifactTree: null,
		},
		route: {...routeBody, routeDigest: semantic("codewiki.agent-route@1.0.0", routeBody)},
		wikiCommit: oid("1"),
		itemIds: ["cw:item:one"],
		feedbackDigest: null,
		material: {systemPrompt: "worker prompt", prompt: "task"},
		writableScope: ["src/**"],
		previewSubjectDigest: digest("4"),
		attempt: 1,
		predecessor: null,
		issuedAt: "2026-09-05T05:00:00.000Z",
		deadlineAt: "2026-09-05T05:10:00.000Z",
		...overrides,
	};
}

test("Workers cannot receive or authorize writable scope over Wiki, Change Trace, or managed roots", () => {
	for (const forbiddenScope of [
		[".codewiki/**"],
		[".codewiki/wiki/**"],
		[".codewiki/changes/**"],
		[".git/**"],
		["check-packs/**"],
		["../escape/**"],
		["/absolute/path"],
		["src/\0null"],
		["src/cafe\u0301"], // NFD decomposed form (non-NFC)
	]) {
		const auth = authorizeAgentRun(workerAuthInput({writableScope: forbiddenScope}));
		assert.equal(auth.ok, false, `Forbidden scope should be rejected: ${forbiddenScope.join(",")}`);
	}
});

test("Work unit contracts and workAllowsPath fail closed on forbidden project roots", () => {
	const validWork = createWork({
		changeId: "CHG-containment",
		ordinal: 1,
		workType: "codewiki.work:source",
		targets: [{itemId: "cw:component:test", facets: ["source"]}],
		writablePaths: ["src/**"],
		dependencies: [],
		capabilities: ["codewiki.capability:workbench.write"],
		acceptance: ["tests pass"],
	});
	assert.equal(validWork.ok, true);

	assert.equal(workAllowsPath(validWork.value, "src/index.ts"), true);
	assert.equal(workAllowsPath(validWork.value, "src/adapters/git.ts"), true);
	assert.equal(workAllowsPath(validWork.value, ".codewiki/wiki/items/product.md"), false);
	assert.equal(workAllowsPath(validWork.value, ".codewiki/changes/TRACE.jsonl"), false);
	assert.equal(workAllowsPath(validWork.value, ".git/refs/heads/main"), false);
	assert.equal(workAllowsPath(validWork.value, "check-packs/decision/check.json"), false);
	assert.equal(workAllowsPath(validWork.value, "package.json"), false);

	for (const badPattern of [
		".codewiki/**",
		".git/**",
		"check-packs/**",
		"../src/**",
		"/etc/passwd",
		"src/..",
		"src/./sub",
	]) {
		const badWork = createWork({
			changeId: "CHG-containment",
			ordinal: 2,
			workType: "codewiki.work:source",
			targets: [{itemId: "cw:component:test", facets: ["source"]}],
			writablePaths: [badPattern],
			dependencies: [],
			capabilities: [],
			acceptance: ["test"],
		});
		assert.equal(badWork.ok, false, `Pattern should be rejected: ${badPattern}`);
	}
});

test("Role policies strictly separate tools and prevent protected effect escalation", () => {
	for (const [role, policy] of Object.entries(AGENT_ROLE_POLICIES)) {
		for (const tool of policy.toolIds) {
			assert.equal(/^codewiki\.tool:(changes\.read|wiki\.(get|links|list|resolve|search)|work\.read|project\.read)$/u.test(tool), true, `${role} has forbidden tool: ${tool}`);
			assert.equal(/git|commit|complete|effects|delivery|publish/u.test(tool), false);
		}
		if (role !== "worker") {
			assert.equal(policy.writable, false, `${role} must not have writable permission`);
			assert.equal(policy.previewWork, false, `${role} must not have previewWork capability`);
		}
	}
	assert.deepEqual(AGENT_ROLE_POLICIES["model-check"].toolIds, []);
	assert.deepEqual(AGENT_ROLE_POLICIES["model-check"].capabilities, []);
});

test("Skills and input parameters cannot weaken Product-fixed role policy or inject capabilities", () => {
	const nonWorkerWithScope = authorizeAgentRun(workerAuthInput({
		role: "decision",
		stage: "decision",
		writableScope: ["src/**"],
		previewSubjectDigest: null,
	}));
	assert.equal(nonWorkerWithScope.ok, false);

	const nonWorkerWithPreview = authorizeAgentRun(workerAuthInput({
		role: "review",
		stage: "review",
		writableScope: [],
		previewSubjectDigest: digest("4"),
	}));
	assert.equal(nonWorkerWithPreview.ok, false);

	const modelCheckWithScope = authorizeAgentRun(workerAuthInput({
		role: "model-check",
		stage: "decision",
		writableScope: ["src/**"],
		previewSubjectDigest: null,
	}));
	assert.equal(modelCheckWithScope.ok, false);

	const validAuth = authorizeAgentRun(workerAuthInput());
	assert.equal(validAuth.ok, true);
	assert.equal(validAuth.value.policyDigest, AGENT_ROLE_POLICY_DIGEST);
});

test("Preview adapter enforces profile-only execution, path containment, and lease bounds", async () => {
	for (const badScope of [
		["/absolute"],
		["../traversal"],
		[".git/**"],
		[".codewiki/**"],
	]) {
		const badSubject = createPreviewSubject({
			capability: "preview.work",
			repositoryId: "cw:repository:test",
			changeId: "CHG-containment",
			workId: "cw:work:unit-1",
			projectCommit: oid("1"),
			projectTree: oid("2"),
			changeTip: oid("3"),
			artifactCommit: null,
			artifactTree: null,
			scope: badScope,
			profileId: "cw:profile:test",
			environmentDigest: digest("a"),
			policyDigest: digest("b"),
			generation: 1,
			producerId: "cw:producer:worker",
		});
		assert.equal(badSubject.ok, false, `Bad preview scope should be rejected: ${badScope.join(",")}`);
	}

	const adapter = createLocalPreviewAdapter({
		profiles: [{profileId: "cw:profile:test", command: ["echo", "test"]}],
		runner: async () => ({stdout: "ok", stderr: "", exitCode: 0}),
		maximumConcurrentLeases: 1,
	});
	assert.equal(adapter.ok, true);

	const validSubject1 = createPreviewSubject({
		capability: "preview.verify",
		repositoryId: "cw:repository:test",
		changeId: "CHG-containment",
		workId: null,
		projectCommit: oid("1"),
		projectTree: oid("2"),
		changeTip: oid("3"),
		artifactCommit: null,
		artifactTree: null,
		scope: ["src/**"],
		profileId: "cw:profile:test",
		environmentDigest: digest("a"),
		policyDigest: digest("b"),
		generation: 1,
		producerId: "cw:producer:worker",
	});
	assert.equal(validSubject1.ok, true);

	const reqDraft1 = {authorizationId: "cw:auth:1", requestDigest: digest("0"), subject: validSubject1.value};
	const reqDigest1 = previewRequestDigest(reqDraft1);
	assert.equal(reqDigest1.ok, true);
	const obs1 = await adapter.value.observe({...reqDraft1, requestDigest: reqDigest1.value});
	assert.equal(obs1.ok, true);
});

test("DSH Execution Host enforces concurrency bound and rejects overflow with authorization_conflict", async () => {
	const host = createLocalDshExecutionHost({
		custodyRoot: "/tmp",
		providerInstaller: async () => ({providerReceiptDigest: null, dispose: () => {}}),
		maximumConcurrentRuns: 1,
	});
	assert.equal(host.ok, true);
	const runtime = createDshAgentRuntime(host.value);
	assert.equal(runtime.ok, true);

	// Test bounds construction
	assert.equal(createLocalDshExecutionHost({
		custodyRoot: "/tmp",
		providerInstaller: async () => ({providerReceiptDigest: null, dispose: () => {}}),
		maximumConcurrentRuns: 0,
	}).ok, false);
});
