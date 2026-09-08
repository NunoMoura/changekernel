import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {after, before, test} from "node:test";

import {createGitProjectStore} from "../../../src/adapters/git/project-store.ts";
import {readExactWiki} from "../../../src/adapters/git/wiki.ts";
import {PRODUCT_READ_OPERATIONS} from "../../../src/api/contracts/read.ts";
import {createCodewikiClient} from "../../../src/api/client/index.ts";
import {createProductTransportRequest, decodeProductTransportResponse} from "../../../src/api/transport/envelope.ts";
import {createChange} from "../../../src/kernel/changes/contracts.ts";
import {CHANGE_EVENT_KINDS, createChangeEvent} from "../../../src/kernel/changes/events.ts";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {appendChangeEvent} from "../../../src/kernel/changes/trace.ts";
import {createChangeTraceHeader, createEmptyChangeTrace, encodeChangeTrace} from "../../../src/kernel/changes/trace.ts";
import {decodeGitOid} from "../../../src/kernel/identity/git.ts";
import {buildSemanticEventOwnership, decodeComponentOwnership} from "../../../src/kernel/wiki/ownership.ts";
import {createWork, workPlanDigest} from "../../../src/kernel/work/contracts.ts";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "../../../src/ports/agent-runtime.ts";
import {CHECK_RUNNER_PORT_PROTOCOL} from "../../../src/ports/check-runner.ts";
import {createProjectAccessPolicy, projectAccessProofDigest} from "../../../src/server/authorization/policy.ts";
import {createProjectServer} from "../../../src/server/index.ts";
import {createMemoryProjectServerFacts} from "../../../src/server/recovery/facts.ts";

const REPOSITORY_ID = "cw:repository:server-api-test";
const CHANGE_ID = "CHG-server-api-test";
const BUILD_DIGEST = `sha256:${"f".repeat(64)}`;
const PROOF = "server api integration proof";

let root;
let store;
let server;
let client;
let snapshotReads = 0;
let requestOrdinal = 0;
const facts = createMemoryProjectServerFacts().value;
const unavailableAgentRuntime = async () => { throw new Error("Agent Runtime is not invoked by read fixtures."); };
const agentRuntime = {protocol: AGENT_RUNTIME_PORT_PROTOCOL, start: unavailableAgentRuntime, inspect: unavailableAgentRuntime, cancel: unavailableAgentRuntime};

before(async () => {
	root = await mkdtemp(join(tmpdir(), "codewiki-sk3e-server-"));
	git(["init", "-q", "-b", "main"]);
	git(["config", "user.name", "CodeWiki Test"]);
	git(["config", "user.email", "test@codewiki.invalid"]);
	await mkdir(join(root, ".codewiki"), {recursive: true});
	await cp(join(process.cwd(), ".codewiki/wiki"), join(root, ".codewiki/wiki"), {recursive: true});
	await addSemanticFixtureLink();
	const baseCommit = commit("seed exact Wiki");
	const created = createGitProjectStore({repositoryRoot: root, repositoryId: REPOSITORY_ID});
	assert.equal(created.ok, true, created.ok ? "" : created.error.message);
	store = created.value;
	const exactWiki = await readExactWiki(store, {
		repositoryId: REPOSITORY_ID,
		objectFormat: "sha1",
		selector: {kind: "oid", oid: oid(baseCommit)},
		kernelBuildDigest: BUILD_DIGEST,
		retiredItemIds: [],
	});
	assert.equal(exactWiki.ok, true, exactWiki.ok ? "" : exactWiki.error.message);
	const ownership = [];
	for (const file of exactWiki.value.wiki.items) {
		const decoded = decodeComponentOwnership(file.item.itemId, file.item.attributes);
		assert.equal(decoded.ok, true);
		if (decoded.value !== null) ownership.push(decoded.value);
	}
	const eventOwners = buildSemanticEventOwnership(ownership, CHANGE_EVENT_KINDS);
	assert.equal(eventOwners.ok, true, eventOwners.ok ? "" : eventOwners.error.message);
	const trace = buildTrace(baseCommit, exactWiki.value.wiki.source.snapshot.tree, eventOwners.value);
	const encoded = encodeChangeTrace(trace, eventOwners.value);
	assert.equal(encoded.ok, true, encoded.ok ? "" : encoded.error.message);
	await mkdir(join(root, ".codewiki/changes"), {recursive: true});
	await writeFile(join(root, `.codewiki/changes/TRACE-${CHANGE_ID}.jsonl`), encoded.value);
	commit("add current Change Trace");

	const countedStore = new Proxy(store, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver);
			if (property === "readSnapshot") return async (...args) => {
				snapshotReads += 1;
				return target.readSnapshot(...args);
			};
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	const policy = accessPolicy({changeIds: null, wikiItemIds: null});
	const createdServer = createProjectServer({
		ports: {projectStore: countedStore, checkRunner: checkRunner(), facts, agentRuntime},
		accessPolicy: policy,
		project: {
			projectName: "Server API Test",
			repositoryId: REPOSITORY_ID,
			objectFormat: "sha1",
			canonicalRef: "refs/heads/main",
			kernelBuildDigest: BUILD_DIGEST,
			retiredWikiItemIds: [],
		},
	});
	assert.equal(createdServer.ok, true, createdServer.ok ? "" : createdServer.error.message);
	server = createdServer.value;
	client = createCodewikiClient({
		repositoryId: REPOSITORY_ID,
		transport: {send: (request) => server.handle(request)},
		client: {kind: "cli", instanceId: "cw:client:integration"},
		authentication: {identityRef: "cw:identity:integration", proof: PROOF},
	}).value;
});

after(async () => {
	if (root) await rm(root, {recursive: true, force: true});
});

test("Project discovery and capabilities expose semantic reads and typed unavailable Work surfaces", async () => {
	const discovery = await client.discover(options("discover"));
	assert.equal(discovery.ok, true);
	assert.equal(discovery.value.project, "Server API Test");
	assert.match(discovery.value.nextAction, /Changes/u);
	const capabilities = await client.capabilities(options("capabilities"));
	assert.equal(capabilities.ok, true);
	assert.match(JSON.stringify(capabilities.value.available), /Changes and Decisions/u);
	assert.deepEqual(capabilities.value.unavailable.map((entry) => entry.capability), ["Agent Work", "Preview"]);
	assert.doesNotMatch(JSON.stringify(capabilities.value), /adapter|protocol|digest|ref/u);
	const wrongProject = createCodewikiClient({
		repositoryId: "cw:repository:other",
		transport: {send: (request) => server.handle(request)},
		client: {kind: "cli", instanceId: "cw:client:wrong-project"},
		authentication: {identityRef: "cw:identity:integration", proof: PROOF},
	}).value;
	assert.equal((await wrongProject.discover(options("wrong-project"))).error.code, "source_not_found");
});

test("status, Changes, Decisions, Checks, Work, Review, and Alignment use plain-language projections", async () => {
	const source = {kind: "canonical"};
	const status = await client.status({...options("status"), source});
	assert.equal(status.ok, true);
	assert.equal(status.value.status, "in_progress");
	assert.equal(status.value.changes.states.committed, 1);
	assert.equal(status.value.work.total, 1);
	assert.deepEqual({...status.value.checks}, {failed: 0, passed: 2, stopped: 0});

	const changes = await client.changes({...options("changes"), source, view: "list", limit: 10, cursor: null});
	assert.equal(changes.value.items[0].changeId, CHANGE_ID);
	assert.equal(changes.value.items[0].nextAction, "Complete the next ready Work unit and its Checks.");
	assert.deepEqual({...changes.value.items[0].checks}, {failed: 0, passed: 2, stopped: 0});
	const change = await client.changes({...options("change"), source, view: "get", changeId: CHANGE_ID});
	assert.equal(change.value.intent, "Exercise authenticated Project reads.");
	assert.equal(change.value.targets[0].itemId, "cw:component:project-server");
	assert.doesNotMatch(change.value.rationale, /[\r\u001b\u202e]/u);

	const decisions = await client.changes({...options("decisions"), source, view: "decisions", changeId: CHANGE_ID, limit: 10, cursor: null});
	assert.deepEqual(decisions.value.items.map((entry) => entry.decision), ["accepted"]);
	const gates = await client.checks({...options("gates"), source, view: "gates", changeId: CHANGE_ID, limit: 10, cursor: null});
	assert.deepEqual(gates.value.items.map((entry) => entry.stage), ["decision", "planning"]);
	assert.equal(gates.value.items.every((entry) => entry.status === "passed"), true);
	const firstGate = await client.checks({...options("gates-page-one"), source, view: "gates", changeId: CHANGE_ID, limit: 1, cursor: null});
	assert.match(firstGate.value.nextCursor, /^cw:cursor:[0-9a-f]{64}$/u);
	assert.deepEqual(firstGate.value.unknowns, ["More authorized information exists beyond this page."]);
	const secondGate = await client.checks({...options("gates-page-two"), source, view: "gates", changeId: CHANGE_ID, limit: 1, cursor: firstGate.value.nextCursor});
	assert.equal(secondGate.value.items[0].stage, "planning");
	const crossReadCursor = await client.work({...options("cross-read-cursor"), source, changeId: CHANGE_ID, limit: 1, cursor: firstGate.value.nextCursor});
	assert.equal(crossReadCursor.error.code, "invalid_request");
	const results = await client.checks({...options("results"), source, view: "results", changeId: CHANGE_ID, limit: 10, cursor: null});
	assert.equal(results.value.items.every((entry) => entry.results === 1), true);
	const work = await client.work({...options("work"), source, changeId: CHANGE_ID, limit: 10, cursor: null});
	assert.equal(work.value.items[0].status, "planned");
	const review = await client.review({...options("review"), source, changeId: CHANGE_ID});
	assert.equal(review.value.status, "not_started");
	const alignment = await client.alignment({...options("alignment"), source, changeId: CHANGE_ID, limit: 10, cursor: null});
	assert.equal(alignment.value.items[0].status, "gap");

	const normal = JSON.stringify({status: status.value, changes: changes.value, decisions: decisions.value, gates: gates.value, results: results.value, work: work.value, review: review.value, alignment: alignment.value});
	assert.doesNotMatch(normal, /sha1|sha256|refs\/|requestDigest|responseDigest|kernelBuild|projectStore/u);
});

test("versioned transport binds exact source and authorization while the Client SDK hides that evidence", async () => {
	const request = createProductTransportRequest({
		requestId: "cw:request:raw-binding",
		repositoryId: REPOSITORY_ID,
		client: {kind: "cli", instanceId: "cw:client:raw-binding"},
		authentication: {identityRef: "cw:identity:integration", proof: PROOF},
		expiresAt: "2026-09-05T12:00:00Z",
		operation: "changes.read",
		input: {source: {kind: "canonical"}, view: "list", limit: 1, cursor: null},
	});
	assert.equal(request.ok, true);
	const raw = decodeProductTransportResponse(await server.handle(request.value));
	assert.equal(raw.ok, true);
	assert.equal(raw.value.requestDigest, request.value.requestDigest);
	assert.equal(raw.value.binding.source.commit.algorithm, "sha1");
	assert.equal(raw.value.binding.authorization.authorizationId, "cw:authorization:integration");
	assert.equal(raw.value.binding.coverage.returned, 1);
	assert.equal(raw.value.binding.ordering, "change-id-ascending");
	assert.equal(raw.value.binding.interpretation.changeTrace.version, "14.0.0");
	assert.equal(raw.value.binding.bounds.operation.limit, 1);
	assert.equal(raw.value.binding.citations[0].kind, "project-source");
	assert.deepEqual(raw.value.binding.unknowns, []);
	assert.doesNotMatch(JSON.stringify(raw.value), new RegExp(PROOF, "u"));
	const semantic = await client.changes({...options("semantic-binding"), source: {kind: "canonical"}, view: "list", limit: 1, cursor: null});
	assert.equal(semantic.ok, true);
	assert.equal("binding" in semantic.value, false);
});

test("Wiki reads are exact and normal Client results omit source identities", async () => {
	const source = {kind: "canonical"};
	const listed = await client.wiki({...options("wiki-list"), source, view: "list", limit: 5, cursor: null});
	assert.equal(listed.ok, true);
	assert.equal(listed.value.data.items.length, 5);
	assert.equal(listed.value.more, true);
	assert.equal("semanticDigest" in listed.value.data.items[0], false);
	const itemId = listed.value.data.items[0].itemId;
	const fetched = await client.wiki({...options("wiki-get"), source, view: "get", itemId});
	assert.equal(fetched.ok, true);
	assert.equal(fetched.value.data.item.itemId, itemId);
	assert.equal("protocol" in fetched.value.data.item, false);
	assert.doesNotMatch(JSON.stringify(fetched.value), /sha1|sha256|refs\/|authorizationId|derivation/u);
});

test("audit is the explicit source for commits, digests, refs, provenance, and raw Change facts", async () => {
	const source = {kind: "canonical"};
	const audit = await client.audit({...options("audit-source"), source, view: "source"});
	assert.equal(audit.ok, true);
	assert.equal(audit.value.snapshot.commit.algorithm, "sha1");
	assert.equal(audit.value.kernelBuildDigest, BUILD_DIGEST);
	const change = await client.audit({...options("audit-change"), source, view: "change", changeId: CHANGE_ID});
	assert.equal(change.ok, true);
	assert.equal(change.value.trace.header.changeId, CHANGE_ID);
	assert.match(JSON.stringify(change.value), /sha256:/u);
});

test("authorization hides Change existence and transitively unsafe Wiki Items", async () => {
	const limitedServer = createProjectServer({
		ports: {projectStore: store, checkRunner: checkRunner(), facts, agentRuntime},
		accessPolicy: accessPolicy({changeIds: [CHANGE_ID], wikiItemIds: ["cw:component:project-server"]}),
		project: {
			projectName: "Server API Test",
			repositoryId: REPOSITORY_ID,
			objectFormat: "sha1",
			canonicalRef: "refs/heads/main",
			kernelBuildDigest: BUILD_DIGEST,
			retiredWikiItemIds: [],
		},
	}).value;
	const limited = createCodewikiClient({
		repositoryId: REPOSITORY_ID,
		transport: {send: (request) => limitedServer.handle(request)},
		client: {kind: "agent", instanceId: "cw:client:limited"},
		authentication: {identityRef: "cw:identity:integration", proof: PROOF},
	}).value;
	const status = await limited.status({...options("limited-status"), source: {kind: "canonical"}});
	assert.equal(status.value.changes.total, 0);
	const hiddenChange = await limited.changes({...options("limited-change"), source: {kind: "canonical"}, view: "get", changeId: CHANGE_ID});
	assert.equal(hiddenChange.error.code, "not_found");
	const hiddenWiki = await limited.wiki({...options("limited-wiki"), source: {kind: "canonical"}, view: "get", itemId: "cw:component:project-server"});
	assert.equal(hiddenWiki.error.code, "not_found");
	const audit = await limited.audit({...options("limited-audit"), source: {kind: "canonical"}, view: "change", changeId: CHANGE_ID});
	assert.equal(audit.error.code, "authorization_denied");
});

test("request replay is bounded and request-ID conflicts fail without a second Project read", async () => {
	const request = {...options("replay"), source: {kind: "canonical"}};
	const before = snapshotReads;
	const first = await client.status(request);
	const afterFirst = snapshotReads;
	const second = await client.status(request);
	assert.deepEqual(second, first);
	assert.equal(afterFirst > before, true);
	assert.equal(snapshotReads, afterFirst);
	const conflict = await client.audit({...request, source: {kind: "canonical"}, view: "source"});
	assert.equal(conflict.error.code, "idempotency_conflict");
});

test("a moving canonical selector resolves once and every dependent read stays on that commit", async () => {
	const before = git(["rev-parse", "HEAD"]).trim();
	let moved = false;
	const racingStore = new Proxy(store, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver);
			if (property === "readSnapshot") return async (request) => {
				const result = await target.readSnapshot(request);
				if (!moved && request.selector.kind === "ref") {
					moved = true;
					git(["commit", "-q", "--allow-empty", "-m", "move canonical during read"]);
				}
				return result;
			};
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	const racingServer = createProjectServer({
		ports: {projectStore: racingStore, checkRunner: checkRunner(), facts, agentRuntime},
		accessPolicy: accessPolicy({changeIds: null, wikiItemIds: null}),
		project: {
			projectName: "Server API Test",
			repositoryId: REPOSITORY_ID,
			objectFormat: "sha1",
			canonicalRef: "refs/heads/main",
			kernelBuildDigest: BUILD_DIGEST,
			retiredWikiItemIds: [],
		},
	}).value;
	const racingClient = createCodewikiClient({
		repositoryId: REPOSITORY_ID,
		transport: {send: (request) => racingServer.handle(request)},
		client: {kind: "sdk", instanceId: "cw:client:racing"},
		authentication: {identityRef: "cw:identity:integration", proof: PROOF},
	}).value;
	const audit = await racingClient.audit({...options("racing-source"), source: {kind: "canonical"}, view: "source"});
	assert.equal(audit.ok, true);
	assert.equal(audit.value.snapshot.commit.hex, before);
	assert.notEqual(git(["rev-parse", "HEAD"]).trim(), before);
});

test("malformed current Change state stops normal reads while source audit remains available", async () => {
	await writeFile(join(root, ".codewiki/changes/TRACE-CHG-malformed.jsonl"), "not-json\n");
	commit("add malformed Change Trace");
	const status = await client.status({...options("malformed-status"), source: {kind: "canonical"}});
	assert.equal(status.error.code, "invalid_project_state");
	assert.doesNotMatch(JSON.stringify(status.error), /not-json|TRACE-|\.codewiki|git/u);
	const audit = await client.audit({...options("malformed-audit"), source: {kind: "canonical"}, view: "source"});
	assert.equal(audit.ok, true);
	assert.equal(audit.value.snapshot.commit.algorithm, "sha1");
	const hiddenServer = createProjectServer({
		ports: {projectStore: store, checkRunner: checkRunner(), facts, agentRuntime},
		accessPolicy: accessPolicy({changeIds: [], wikiItemIds: null}),
		project: {
			projectName: "Server API Test",
			repositoryId: REPOSITORY_ID,
			objectFormat: "sha1",
			canonicalRef: "refs/heads/main",
			kernelBuildDigest: BUILD_DIGEST,
			retiredWikiItemIds: [],
		},
	}).value;
	const hiddenClient = createCodewikiClient({
		repositoryId: REPOSITORY_ID,
		transport: {send: (request) => hiddenServer.handle(request)},
		client: {kind: "sdk", instanceId: "cw:client:hidden-malformed"},
		authentication: {identityRef: "cw:identity:integration", proof: PROOF},
	}).value;
	const hiddenStatus = await hiddenClient.status({...options("hidden-malformed-status"), source: {kind: "canonical"}});
	assert.equal(hiddenStatus.ok, true);
	assert.equal(hiddenStatus.value.changes.total, 0);
	const boundedServer = createProjectServer({
		ports: {projectStore: store, checkRunner: checkRunner(), facts, agentRuntime},
		accessPolicy: accessPolicy({changeIds: null, wikiItemIds: null}),
		project: {
			projectName: "Server API Test",
			repositoryId: REPOSITORY_ID,
			objectFormat: "sha1",
			canonicalRef: "refs/heads/main",
			kernelBuildDigest: BUILD_DIGEST,
			retiredWikiItemIds: [],
		},
		limits: {maximumChangeTraces: 1},
	}).value;
	const boundedClient = createCodewikiClient({
		repositoryId: REPOSITORY_ID,
		transport: {send: (request) => boundedServer.handle(request)},
		client: {kind: "sdk", instanceId: "cw:client:bounded"},
		authentication: {identityRef: "cw:identity:integration", proof: PROOF},
	}).value;
	const bounded = await boundedClient.status({...options("bounded-status"), source: {kind: "canonical"}});
	assert.equal(bounded.error.code, "limit_exceeded");
});

async function addSemanticFixtureLink() {
	const path = join(root, ".codewiki/wiki/items/system/components/project-server.md");
	const text = await readFile(path, "utf8");
	const lines = text.split("\n");
	const envelope = JSON.parse(lines[1]);
	envelope.relationships.push({
		attributes: {"codewiki.system:rationale": "Test authorization closure."},
		predicate: "codewiki.system:uses",
		targetItemId: "cw:component:protocol",
	});
	envelope.relationships.sort((left, right) => {
		const leftKey = `${left.predicate}\0${left.targetItemId}`;
		const rightKey = `${right.predicate}\0${right.targetItemId}`;
		return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
	});
	const canonical = canonicalJson(envelope);
	assert.equal(canonical.ok, true);
	lines[1] = canonical.value;
	await writeFile(path, lines.join("\n"));
}

function checkRunner() {
	return Object.freeze({
		protocol: CHECK_RUNNER_PORT_PROTOCOL,
		async run() {
			throw new Error("Check execution is not published by the read API.");
		},
	});
}

function accessPolicy(visibility) {
	const proofDigest = projectAccessProofDigest(PROOF);
	assert.equal(proofDigest.ok, true);
	const policy = createProjectAccessPolicy({
		grants: [{
			authorizationId: "cw:authorization:integration",
			identityRef: "cw:identity:integration",
			actorId: "cw:actor:integration",
			proofDigest: proofDigest.value,
			expiresAt: "2026-09-06T00:00:00Z",
			capabilities: [...PRODUCT_READ_OPERATIONS].sort(),
			wikiItemIds: visibility.wikiItemIds,
			changeIds: visibility.changeIds,
		}],
		now: () => "2026-09-05T00:00:00Z",
	});
	assert.equal(policy.ok, true, policy.ok ? "" : policy.error.message);
	return policy.value;
}

function buildTrace(baseCommit, wikiTree, owners) {
	const change = createChange({
		changeId: CHANGE_ID,
		repositoryId: REPOSITORY_ID,
		revision: 1,
		changeType: "correction",
		realization: "project",
		intent: "Exercise authenticated Project reads.",
		rationale: "Every Client should see safe semantic projections.\u001b[31m\r\u202e forged-terminal-output",
		acceptance: ["All read families are exact and bounded."],
		targets: [{itemId: "cw:component:project-server", facets: ["body"]}],
		relationships: [],
		contributorRefs: ["cw:actor:integration"],
		producerRunRefs: ["cw:run:integration"],
	});
	assert.equal(change.ok, true, change.ok ? "" : change.error.message);
	const work = createWork({
		changeId: CHANGE_ID,
		ordinal: 1,
		workType: "codewiki.work:source",
		targets: [{itemId: "cw:component:project-server", facets: ["body"]}],
		writablePaths: ["src/server/**"],
		dependencies: [],
		capabilities: ["codewiki.capability:project-artifact-write"],
		acceptance: ["Project reads pass."],
	});
	assert.equal(work.ok, true, work.ok ? "" : work.error.message);
	const planDigest = workPlanDigest([work.value]);
	assert.equal(planDigest.ok, true);
	const header = createChangeTraceHeader({
		repositoryId: REPOSITORY_ID,
		changeId: CHANGE_ID,
		objectFormat: "sha1",
		createdBy: "cw:authority:project-server",
		createdAt: "2026-09-05T00:00:00Z",
	});
	assert.equal(header.ok, true);
	let trace = createEmptyChangeTrace(header.value).value;
	trace = append(trace, owners, baseCommit, "change.proposed", {change: change.value});
	trace = append(trace, owners, baseCommit, "gate.recorded", {
		gateDigest: digest("1"), outcomeDigest: digest("2"), stage: "decision", status: "passed",
		subjectDigest: change.value.changeDigest, workId: null, runDigests: [digest("3")], resultDigests: [digest("4")], evidenceDigests: [digest("5")],
	});
	trace = append(trace, owners, baseCommit, "change.committed", {decisionGateDigest: digest("1"), wikiTree});
	trace = append(trace, owners, baseCommit, "gate.recorded", {
		gateDigest: digest("6"), outcomeDigest: digest("7"), stage: "planning", status: "passed",
		subjectDigest: planDigest.value, workId: null, runDigests: [digest("8")], resultDigests: [digest("9")], evidenceDigests: [digest("a")],
	});
	trace = append(trace, owners, baseCommit, "change.planned", {planningGateDigest: digest("6"), planDigest: planDigest.value, work: [work.value]});
	trace = append(trace, owners, baseCommit, "gate.recorded", {
		gateDigest: digest("b"), outcomeDigest: digest("c"), stage: "planning", status: "failed",
		subjectDigest: planDigest.value, workId: null, runDigests: [digest("d")], resultDigests: [digest("e")], evidenceDigests: [digest("f")],
	});
	return append(trace, owners, baseCommit, "gate.recorded", {
		gateDigest: digest("0"), outcomeDigest: digest("ab"), stage: "planning", status: "passed",
		subjectDigest: planDigest.value, workId: null, runDigests: [digest("ac")], resultDigests: [digest("ad")], evidenceDigests: [digest("ae")],
	});
}

function append(trace, owners, projectHead, kind, payload) {
	const previous = trace.events.at(-1) ?? null;
	const event = createChangeEvent({
		kind,
		ownerItemId: owners[kind],
		actorId: "cw:actor:integration",
		authorityId: "cw:authority:project-server",
		commandId: `cw:command:read-api-${trace.events.length + 1}`,
		commandDigest: digest("f"),
		occurredAt: `2026-09-05T00:00:0${trace.events.length + 1}Z`,
		expectedProjectHead: oid(projectHead),
		expectedChangeTip: previous === null ? null : oid("9".repeat(40)),
		predecessorEventDigest: previous?.eventDigest ?? null,
		payload,
	}, owners);
	assert.equal(event.ok, true, event.ok ? "" : event.error.message);
	const appended = appendChangeEvent(trace, event.value, owners);
	assert.equal(appended.ok, true, appended.ok ? "" : appended.error.message);
	return appended.value;
}

function options(label) {
	requestOrdinal += 1;
	return {requestId: `cw:request:${label}-${requestOrdinal}`, expiresAt: "2026-09-05T12:00:00Z"};
}

function digest(value) {
	return `sha256:${value.padEnd(64, value.at(-1))}`;
}

function oid(hex) {
	const decoded = decodeGitOid({algorithm: "sha1", hex: hex.length === 1 ? hex.repeat(40) : hex});
	assert.equal(decoded.ok, true);
	return decoded.value;
}

function commit(message) {
	git(["add", "-A"]);
	git(["commit", "-q", "-m", message]);
	return git(["rev-parse", "HEAD"]).trim();
}

function git(args) {
	return execFileSync("git", ["-C", root, ...args], {encoding: "utf8"});
}
