import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile, readFile, rm} from "node:fs/promises";
import {join, dirname} from "node:path";
import {tmpdir} from "node:os";
import {execFileSync} from "node:child_process";
import test from "node:test";
import {createGitProjectStore} from "../../../src/adapters/git/project-store.ts";
import {createProjectServer} from "../../../src/server/index.ts";
import {readProfileChange} from "../../../src/server/queries/profile-change.ts";
import {createProfileChange} from "../../../src/kernel/changes/contracts.ts";
import {createProfileChangeEvent} from "../../../src/kernel/changes/events.ts";
import {decodeProfileChangeTrace, createEmptyProfileChangeTrace, appendProfileChangeEvent, encodeProfileChangeTrace} from "../../../src/kernel/changes/trace.ts";
import {createMemoryProjectServerFacts} from "../../../src/server/recovery/facts.ts";
import {createProjectAccessPolicy, projectAccessProofDigest} from "../../../src/server/authorization/policy.ts";
import {PRODUCT_OPERATIONS, createProductTransportRequest, decodeProductTransportResponse} from "../../../src/api/transport/envelope.ts";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "../../../src/ports/agent-runtime.ts";
import {CHECK_RUNNER_PORT_PROTOCOL} from "../../../src/ports/check-runner.ts";
import {WIKI_PROFILE_ID} from "../../../src/kernel/wiki/profile.ts";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {createProfiledWikiReference} from "../../../src/kernel/wiki/profile-reference.ts";
import {validateProfiledWikiTransaction} from "../../../src/kernel/wiki/profile-transaction.ts";
import {admitted, gitOid, PROFILE_BUILD, PROFILE_CHANGE_ID, PROFILE_CHANGE_PATH, PROFILE_PATH, PROFILE_PROPOSAL, PROFILE_REPOSITORY, profileFixture} from "../../kernel/wiki/profile-fixtures.mjs";

const NOW = "2026-09-11T00:00:00Z";
const EXPIRY = "2030-01-01T00:00:00Z";
const PROOF = "profile-fixture-proof";
const REF = `refs/codewiki/changes/${PROFILE_CHANGE_ID}`;
const EFFECTS = new Set(["writeBlob", "writeTree", "createCommit", "compareAndSwapRefs"]);
const ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
Object.assign(ENV, {GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null"});

function gitBytes(root, args) {
	return execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "gc.auto=0", ...args], {cwd: root, env: ENV});
}
function git(root, args) {return gitBytes(root, args).toString("utf8").trimEnd();}
async function save(root, path, content) {
	await mkdir(dirname(join(root, path)), {recursive: true});
	await writeFile(join(root, path), content);
}
async function fixture(algorithm = "sha1", extraBefore = {}, extraAfter = {}) {
	const root = await mkdtemp(join(tmpdir(), "codewiki-profile-lifecycle-"));
	git(root, ["init", "-q", "-b", "main", `--object-format=${algorithm}`]);
	git(root, ["config", "user.name", "Profile Fixture"]);
	git(root, ["config", "user.email", "profile@example.invalid"]);
	const raw = profileFixture(algorithm);
	for (const file of raw.before.files) await save(root, file.path, file.text);
	for (const [path, content] of Object.entries(extraBefore)) await save(root, path, content);
	git(root, ["add", "--all"]); git(root, ["commit", "-q", "-m", "profile baseline"]);
	const beforeCommit = gitOid(git(root, ["rev-parse", "HEAD"]), algorithm);
	git(root, ["checkout", "-q", "-b", "candidate"]);
	for (const file of raw.after.files) await save(root, file.path, file.text);
	for (const [path, content] of Object.entries(extraAfter)) await save(root, path, content);
	git(root, ["add", "--all"]); git(root, ["commit", "-q", "-m", "exact candidate"]);
	const afterCommit = gitOid(git(root, ["rev-parse", "HEAD"]), algorithm);
	git(root, ["checkout", "-q", "main"]);
	const store = admitted(createGitProjectStore({repositoryRoot: root, repositoryId: PROFILE_REPOSITORY}));
	const request = {repositoryId: PROFILE_REPOSITORY, objectFormat: algorithm};
	const before = {snapshot: admitted(await store.readSnapshot({...request, selector: {kind: "oid", oid: beforeCommit}})), files: raw.before.files};
	const after = {snapshot: admitted(await store.readSnapshot({...request, selector: {kind: "oid", oid: afterCommit}})), files: raw.after.files};
	const transaction = admitted(validateProfiledWikiTransaction({profile: WIKI_PROFILE_ID, kernelBuildDigest: PROFILE_BUILD, responsibleChangePath: PROFILE_CHANGE_PATH, before, after, mappings: raw.mappings}));
	const reference = admitted(createProfiledWikiReference(transaction));
	const input = {commandId: "cw:command:profile-propose", changeId: PROFILE_CHANGE_ID, expectedProjectHead: beforeCommit, profile: WIKI_PROFILE_ID, kernelBuildDigest: PROFILE_BUILD, afterCommit, proposal: PROFILE_PROPOSAL, mappings: reference.mappings};
	return {root, algorithm, store, beforeCommit, afterCommit, input, reference};
}

function server(subject, {capabilities = PRODUCT_OPERATIONS, wikiItemIds = null, changeIds = null, build = PROFILE_BUILD, intercept, actorPatch, limits} = {}) {
	const calls = [];
	const store = admitted(createGitProjectStore({repositoryRoot: subject.root, repositoryId: PROFILE_REPOSITORY}));
	const counted = new Proxy(store, {get(target, key) {
		const value = target[key];
		if (typeof value !== "function") return value;
		return (...args) => {
			const call = {method: key, request: args[0]};
			calls.push(call);
			const result = intercept ? intercept(key, args[0], () => value.apply(target, args)) : value.apply(target, args);
			return Promise.resolve(result).then((outcome) => {if (!outcome.ok) call.error = outcome.error; return outcome;});
		};
	}});
	const actor = {authorizationId: "cw:authorization:profile-fixture", identityRef: "cw:identity:profile-fixture", actorId: "cw:actor:maintainer", capabilities, wikiItemIds, changeIds};
	const policy = admitted(createProjectAccessPolicy({grants: [{...actor, proofDigest: admitted(projectAccessProofDigest(PROOF)), expiresAt: EXPIRY}], now: () => NOW}));
	const accessPolicy = actorPatch ? {protocol: policy.protocol, authorize(request) {
		const authorized = policy.authorize(request);
		return authorized.ok ? {ok: true, value: {...authorized.value, ...actorPatch()}} : authorized;
	}} : policy;
	const facts = admitted(createMemoryProjectServerFacts());
	const observedFacts = Object.fromEntries(Object.entries(facts).map(([key, value]) => [key, typeof value === "function" ? (...args) => {calls.push({method: `facts.${key}`, request: args[0]}); return value.apply(facts, args);} : value]));
	const unavailable = async () => {throw new Error("Profile proposal/read must not execute Checks or agents.");};
	const configuration = {projectName: "Profile fixture", repositoryId: PROFILE_REPOSITORY, objectFormat: subject.algorithm, canonicalRef: "refs/heads/main", kernelBuildDigest: build, retiredWikiItemIds: [], wikiProfile: WIKI_PROFILE_ID};
	const instance = admitted(createProjectServer({
		ports: {projectStore: counted, facts: observedFacts, checkRunner: {protocol: CHECK_RUNNER_PORT_PROTOCOL, run: unavailable}, agentRuntime: {protocol: AGENT_RUNTIME_PORT_PROTOCOL, start: unavailable, inspect: unavailable, cancel: unavailable}},
		accessPolicy, project: configuration, limits, clock: () => NOW,
	}));
	let ordinal = 0;
	const request = (operation, input, requestId = `cw:request:profile-${++ordinal}`) => admitted(createProductTransportRequest({requestId, repositoryId: PROFILE_REPOSITORY, client: {kind: "sdk", instanceId: "cw:client:profile-fixture"}, authentication: {identityRef: actor.identityRef, proof: PROOF}, expiresAt: EXPIRY, operation, input}));
	const handle = async (value) => admitted(decodeProductTransportResponse(await instance.handle(value)));
	return {calls, actor, configuration, store: counted, request, handle, call: (operation, input) => handle(request(operation, input))};
}
function writes(instance) {return instance.calls.filter((call) => EFFECTS.has(call.method));}
function readInput(source = {kind: "change", changeId: PROFILE_CHANGE_ID}) {return {view: "get", changeId: PROFILE_CHANGE_ID, source};}
async function stableState(root) {
	return {refs: git(root, ["show-ref"]), objects: git(root, ["count-objects", "-v"]), config: await readFile(join(root, ".git/config")), index: await readFile(join(root, ".git/index"))};
}
function accepted(response) {assert.equal(response.status, "ok", JSON.stringify(response.error)); return response.data;}

for (const algorithm of ["sha1", "sha256"]) test(`profile ${algorithm}: native proposal, retained sources, fresh-server recovery and exact replay`, async () => {
	const subject = await fixture(algorithm);
	try {
		const first = server(subject);
		const before = await stableState(subject.root);
		const proposed = await first.call("changes.propose-profile", subject.input);
		assert.equal(proposed.status, "ok", JSON.stringify({response: proposed.error, store: first.calls.filter((call) => call.error).map((call) => ({method: call.method, error: call.error}))}));
		const tip = gitOid(git(subject.root, ["rev-parse", REF]), algorithm);
		assert.equal(git(subject.root, ["rev-parse", "main"]), subject.beforeCommit.hex);
		assert.deepEqual(await readFile(join(subject.root, ".git/index")), before.index);
		assert.deepEqual(await readFile(join(subject.root, ".git/config")), before.config);
		assert.deepEqual(git(subject.root, ["show", "-s", "--format=%P", tip.hex]).split(" ").sort(), [subject.beforeCommit.hex, subject.afterCommit.hex].sort());
		assert.equal(git(subject.root, ["diff-tree", "--no-commit-id", "--name-only", "-r", subject.afterCommit.hex, tip.hex]), PROFILE_CHANGE_PATH);
		const cas = writes(first).find((call) => call.method === "compareAndSwapRefs").request;
		assert.deepEqual(cas.updates.map((entry) => entry.ref), [REF, "refs/heads/main"].sort());
		assert.deepEqual(cas.updates.find((entry) => entry.ref === "refs/heads/main").newOid, subject.beforeCommit);
		git(subject.root, ["update-ref", "-d", "refs/heads/candidate"]);
		git(subject.root, ["prune", "--expire", "now"]);
		const baseline = await stableState(subject.root);
		const reopened = server(subject, {build: `sha256:${"c".repeat(64)}`});
		const result = accepted(await reopened.call("changes.read", readInput()));
		assert.equal(result.status, "proposed");
		assert.equal(result.trace.header.protocol.version, "15.0.0");
		assert.equal(result.trace.events.length, 1);
		assert.equal(result.change.reference.kernelBuildDigest, PROFILE_BUILD);
		assert.equal(admitted(canonicalJson(result.change.reference)), admitted(canonicalJson(subject.reference)));
		assert.deepEqual(result.change.targets.map((entry) => Buffer.from(entry.pathUtf8Hex, "hex").toString()), [PROFILE_PATH, PROFILE_PATH]);
		assert.deepEqual(accepted(await reopened.call("changes.read", readInput({kind: "commit", commit: tip}))), result);
		accepted(await reopened.call("changes.propose-profile", subject.input));
		assert.deepEqual(writes(reopened), []);
		assert.deepEqual(await stableState(subject.root), baseline);
		const altered = await reopened.call("changes.propose-profile", {...subject.input, proposal: {...subject.input.proposal, intent: "Different command subject."}});
		assert.equal(altered.status, "error");
		assert.deepEqual(writes(reopened), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("profile grants and unsupported transitions fail before Store writes or Check execution", async () => {
	const subject = await fixture();
	try {
		for (const options of [{wikiItemIds: []}, {wikiItemIds: ["cw:item:legacy"]}, {changeIds: []}, {capabilities: ["changes.propose"]}]) {
			const denied = server(subject, options);
			const response = await denied.call("changes.propose-profile", subject.input);
			assert.equal(response.error.code, "authorization_denied");
			assert.deepEqual(denied.calls, []);
		}
		const good = server(subject);
		accepted(await good.call("changes.propose-profile", subject.input));
		for (const options of [{wikiItemIds: []}, {changeIds: []}, {capabilities: ["changes.propose-profile"]}]) {
			const denied = server(subject, options);
			assert.equal((await denied.call("changes.read", readInput())).error.code, "authorization_denied");
			assert.deepEqual(denied.calls, []);
		}
		const reopened = server(subject);
		const base = {commandId: "cw:command:unavailable", changeId: PROFILE_CHANGE_ID, expectedProjectHead: subject.beforeCommit, expectedChangeTip: gitOid(git(subject.root, ["rev-parse", REF]))};
		const work = [{ordinal: 1, workType: "cw:work-type:fixture", targets: [{itemId: "cw:item:legacy", facets: ["body"]}], writablePaths: ["src/feature.ts"], dependencyOrdinals: [], capabilities: [], acceptance: ["Deliver the scoped result."]}];
		for (const [operation, input] of [["decision.evaluate", base], ["decision.commit", base], ["planning.admit", {...base, work}], ["work.integrate", {...base, workId: "cw:work:fixture"}], ["changes.complete", base], ["effects.request", {...base, capability: "codewiki.effect:fixture", expectedEffectHead: null}], ["project.capabilities", {}]]) {
			assert.equal((await reopened.call(operation, input)).error.code, "unavailable");
		}
		assert.deepEqual(reopened.calls, []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("profile authorization precedes cached replay and directly callable query effects", async () => {
	const subject = await fixture();
	try {
		let restrictions = {};
		const instance = server(subject, {actorPatch: () => restrictions});
		const request = instance.request("changes.propose-profile", subject.input);
		accepted(await instance.handle(request));
		const baseline = await stableState(subject.root);
		const calls = instance.calls.length;
		restrictions = {wikiItemIds: []};
		assert.equal((await instance.handle(request)).error.code, "authorization_denied");
		assert.equal(instance.calls.length, calls);
		const direct = await readProfileChange(instance.store, instance.configuration, {...instance.actor, wikiItemIds: []}, readInput());
		assert.equal(direct.error.code, "authorization_denied");
		assert.equal(instance.calls.length, calls);
		assert.deepEqual(await stableState(subject.root), baseline);
		restrictions = {authorizationId: "cw:authorization:replacement"};
		const effects = writes(instance).length;
		assert.equal((await instance.handle(request)).status, "error", "A replacement grant cannot reuse the earlier authority's cached command outcome");
		assert.equal(writes(instance).length, effects);
		assert.deepEqual(await stableState(subject.root), baseline);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("proposal-only capability recovers its own command without granting general Change reads", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject, {capabilities: ["changes.propose-profile"]}).call("changes.propose-profile", subject.input));
		const replay = server(subject, {capabilities: ["changes.propose-profile"]});
		accepted(await replay.call("changes.propose-profile", subject.input));
		assert.deepEqual(writes(replay), []);
		assert.equal((await replay.call("changes.read", readInput())).error.code, "authorization_denied");
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("candidate files outside managed Markdown and existing Trace paths are rejected before writes", async () => {
	for (const [before, after] of [[{}, {"README.md": "unclaimed artifact\n"}], [{[PROFILE_CHANGE_PATH]: "retained history\n"}, {}], [{}, {".codewiki/wiki/unchecked.bin": "not Markdown\n"}]]) {
		const subject = await fixture("sha1", before, after);
		try {
			const instance = server(subject); const baseline = await stableState(subject.root);
			assert.equal((await instance.call("changes.propose-profile", subject.input)).status, "error");
			assert.deepEqual(writes(instance), []);
			assert.deepEqual(await stableState(subject.root), baseline);
		} finally {await rm(subject.root, {recursive: true, force: true});}
	}
});

test("profile source uses repository read budgets, not YAML collection limits", async () => {
	const assets = Object.fromEntries(Array.from({length: 1025}, (_, index) => [`assets/${index}.bin`, "Retained asset\n"]));
	const subject = await fixture("sha1", assets);
	try {
		const limited = server(subject, {limits: {maximumWikiFileBytes: 1, maximumWikiTotalBytes: 1}});
		assert.equal((await limited.call("changes.propose-profile", subject.input)).status, "error");
		assert.deepEqual(writes(limited), []);
		const ordinary = server(subject);
		accepted(await ordinary.call("changes.propose-profile", subject.input));
		accepted(await server(subject).call("changes.read", readInput()));
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("hidden empty subtrees and normalized native modes fail source admission before objects", async () => {
	for (const kind of ["empty", "mode"]) {
		const subject = await fixture("sha1", {"README.md": "Retained artifact\n"});
		try {
			const scratch = join(subject.root, ".git", "tree-fixture");
			let bytes = gitBytes(subject.root, ["cat-file", "tree", `${subject.afterCommit.hex}^{tree}`]);
			if (kind === "empty") {
				await writeFile(scratch, "");
				const empty = git(subject.root, ["hash-object", "-t", "tree", "-w", scratch]);
				bytes = Buffer.concat([bytes, Buffer.from("40000 empty\0"), Buffer.from(empty, "hex")]);
			} else {
				const mode = bytes.indexOf(Buffer.from("100644 README.md\0"));
				assert.notEqual(mode, -1);
				Buffer.from("100664").copy(bytes, mode);
			}
			await writeFile(scratch, bytes);
			const tree = git(subject.root, ["hash-object", "--literally", "-t", "tree", "-w", scratch]);
			const afterCommit = gitOid(git(subject.root, ["commit-tree", tree, "-p", subject.afterCommit.hex, "-m", "non-representable native tree"]));
			const instance = server(subject); const baseline = await stableState(subject.root);
			const response = await instance.call("changes.propose-profile", {...subject.input, afterCommit});
			assert.equal(response.status, "error"); assert.match(response.error.message, /source admission/u);
			assert.deepEqual(writes(instance), []);
			assert.deepEqual(await stableState(subject.root), baseline);
		} finally {await rm(subject.root, {recursive: true, force: true});}
	}
});

test("lost CAS acknowledgement recovers the published record without duplicate effects", async () => {
	const subject = await fixture();
	try {
		const lost = server(subject, {async intercept(key, _request, run) {
			const result = await run();
			return key === "compareAndSwapRefs" && result.ok ? {ok: false, error: {code: "command_failed", operation: "cas", message: "Fixture lost acknowledgement after actual CAS."}} : result;
		}});
		assert.equal((await lost.call("changes.propose-profile", subject.input)).status, "error");
		const tip = git(subject.root, ["rev-parse", REF]);
		const fresh = server(subject);
		accepted(await fresh.call("changes.propose-profile", subject.input));
		assert.deepEqual(writes(fresh), []);
		assert.equal(git(subject.root, ["rev-parse", REF]), tip);
		assert.equal(accepted(await fresh.call("changes.read", readInput())).trace.events.length, 1);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("reopen re-admits sources rather than trusting a self-consistent forged reference", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const original = admitted(decodeProfileChangeTrace(git(subject.root, ["show", `${REF}:${PROFILE_CHANGE_PATH}`]) + "\n"));
		const oldEvent = original.events[0];
		const {protocol: changeProtocol, changeDigest, ...changeBody} = oldEvent.payload.change;
		void changeProtocol; void changeDigest;
		const transactionDigest = `sha256:${"f".repeat(64)}`;
		const change = admitted(createProfileChange({...changeBody, reference: {...changeBody.reference, transactionDigest}, targets: changeBody.targets.map((target) => ({...target, transactionDigest}))}));
		const {protocol, eventDigest, containingCommit, ...eventBody} = oldEvent;
		void protocol; void eventDigest; void containingCommit;
		const event = admitted(createProfileChangeEvent({...eventBody, ownerBinding: {...eventBody.ownerBinding, transactionDigest}, payload: {change}}));
		const forged = admitted(appendProfileChangeEvent(admitted(createEmptyProfileChangeTrace(original.header)), event));
		git(subject.root, ["checkout", "-q", "candidate"]);
		await save(subject.root, PROFILE_CHANGE_PATH, admitted(encodeProfileChangeTrace(forged)));
		git(subject.root, ["add", PROFILE_CHANGE_PATH]);
		const tree = git(subject.root, ["write-tree"]);
		const commit = gitOid(git(subject.root, ["commit-tree", tree, "-p", subject.afterCommit.hex, "-p", subject.beforeCommit.hex, "-m", "forged reference fixture"]));
		const reader = server(subject); const baseline = await stableState(subject.root);
		const response = await reader.call("changes.read", readInput({kind: "commit", commit}));
		assert.equal(response.status, "error");
		assert.match(response.error.message, /transaction digest/u);
		assert.deepEqual(writes(reader), []);
		assert.deepEqual(await stableState(subject.root), baseline);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("stale head rejects before objects; a raced CAS may prepare objects but cannot move refs", async () => {
	const subject = await fixture();
	try {
		const stale = server(subject);
		assert.equal((await stale.call("changes.propose-profile", {...subject.input, expectedProjectHead: subject.afterCommit})).status, "error");
		assert.deepEqual(writes(stale), []);
		const raced = server(subject, {intercept(key, _request, run) {
			if (key === "compareAndSwapRefs") git(subject.root, ["update-ref", "refs/heads/main", subject.afterCommit.hex, subject.beforeCommit.hex]);
			return run();
		}});
		assert.equal((await raced.call("changes.propose-profile", subject.input)).status, "error");
		assert.ok(writes(raced).some((call) => call.method === "createCommit"));
		assert.equal(git(subject.root, ["for-each-ref", "--format=%(refname)", REF]), "");
		assert.equal(git(subject.root, ["rev-parse", "main"]), subject.afterCommit.hex);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});
