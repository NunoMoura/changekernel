import {REF, gitBytes, git, save, fixture, server, writes, readInput, stableState, accepted, decisionConfiguration, decisionInput} from "./profile-fixtures.mjs";
import assert from "node:assert/strict";
import {writeFile, readFile, rm} from "node:fs/promises";
import {join} from "node:path";

import test from "node:test";

import {readProfileChange, loadProfileDecisionGrounds, readProfileDecisionSourceSlices} from "../../../src/server/queries/profile-change.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {sha256Digest} from "../../../src/kernel/identity/sha256.ts";
import {createProfileChange} from "../../../src/kernel/changes/contracts.ts";
import {createProfileChangeEvent} from "../../../src/kernel/changes/events.ts";
import {decodeProfileChangeTrace, createEmptyProfileChangeTrace, appendProfileChangeEvent, encodeProfileChangeTrace} from "../../../src/kernel/changes/trace.ts";

import {createAgentRunQuiescence, createAgentRunReceipt} from "../../../src/ports/agent-runtime.ts";
import {AGENT_RUN_OUTPUT_PORT_PROTOCOL, AGENT_RUN_OUTPUT_PROTOCOL} from "../../../src/ports/agent-output.ts";
import {authorizeDecisionModelCheckRun} from "../../../src/server/effects/agent-runs.ts";
import {readDecisionModelCheckSources, readDecisionModelCheckMaterial, runDecisionProfileTransitionCheck, DECISION_PROFILE_TRANSITION_CHECK} from "../../../src/server/effects/decision-checks.ts";
import {DECISION_CHECK_OUTPUT_PROTOCOL, verifySemanticGateOutcome, reduceSemanticGate, createSemanticGate} from "../../../src/kernel/gates/semantic.ts";
import {WIKI_PROFILE_ID} from "../../../src/kernel/wiki/profile.ts";
import {CHANGEKERNEL_VERSION} from "../../../src/kernel/identity/version.ts";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";

import {admitted, gitOid, PROFILE_BUILD, PROFILE_CHANGE_ID, PROFILE_CHANGE_PATH, PROFILE_PATH, PROFILE_REPOSITORY, profileFixture} from "../../kernel/wiki/profile-fixtures.mjs";

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
		assert.equal(git(subject.root, ["show", "-s", "--format=%s", tip.hex]), `changekernel: propose profile Change ${PROFILE_CHANGE_ID}`);
		const cas = writes(first).find((call) => call.method === "compareAndSwapRefs").request;
		assert.equal(cas.reflogMessage, "changekernel: propose Change with unchanged Project head");
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

for (const algorithm of ["sha1", "sha256"]) test(`Decision ${algorithm}: backend grounds preserve exact material and exclusions without semantic coverage claims`, async () => {
	const rawPath = "notes/e\u0301.markdown", rawText = "\ufeff# Unnormalized e\u0301\r\n";
	const subject = await fixture(algorithm, {[rawPath]: rawText, "asset.bin": "Uninterpreted material"});
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const baseline = await stableState(subject.root);
		const instance = server(subject, {capabilities: ["decision.evaluate"], changeIds: [PROFILE_CHANGE_ID]});
		const input = decisionInput(subject), configuration = decisionConfiguration(instance);
		const grounds = admitted(await loadProfileDecisionGrounds(instance.store, configuration, instance.actor, input));
		assert.deepEqual(grounds.containing.commit, input.expectedChangeTip);
		assert.deepEqual(grounds.project.commit, subject.beforeCommit);
		assert.deepEqual(grounds.before.snapshot.commit, subject.beforeCommit);
		assert.deepEqual(grounds.after.snapshot.commit, subject.afterCommit);
		assert.equal(grounds.before.corpus.documents.find(doc => doc.path === rawPath).text, rawText);
		assert.equal(grounds.manifest.before.documents.find(doc => Buffer.from(doc.pathUtf8Hex, "hex").toString() === rawPath).contentDigest, sha256Digest(rawText));
		assert.ok(grounds.manifest.before.exclusions.some(entry => Buffer.from(entry.pathUtf8Hex, "hex").toString() === "asset.bin" && entry.reason === "non_markdown"));
		assert.equal(grounds.contextDigest, admitted(semanticDigest("codewiki.profile-decision-grounds@1.0.0", grounds.manifest)));
		assert.equal(grounds.manifest.configurationDigest, grounds.configurationDigest);
		assert.equal(grounds.manifest.changeDigest, grounds.reduced.change.changeDigest);
		assert.equal(grounds.manifest.traceDigest, grounds.trace.traceDigest);
		assert.equal("contextComplete" in grounds, false);
		assert.equal("contextComplete" in grounds.manifest, false);
		assert.ok(Object.isFrozen(grounds) && Object.isFrozen(grounds.manifest.before.documents[0]));
		for (const ref of [REF, "refs/heads/main"]) {
			assert.equal(instance.calls.filter(call => call.method === "readSnapshot" && call.request.selector.kind === "ref" && call.request.selector.ref === ref).length, 1);
		}
		assert.deepEqual(writes(instance), []);
		assert.deepEqual(await stableState(subject.root), baseline);
		const reordered = server(subject, {intercept: async (method, _request, original) => {
			const result = await original();
			return method === "readTree" && result.ok ? {ok: true, value: {...result.value, entries: [...result.value.entries].reverse()}} : result;
		}});
		const again = admitted(await loadProfileDecisionGrounds(reordered.store, decisionConfiguration(reordered), reordered.actor, input));
		assert.deepEqual(again.manifest, grounds.manifest, "Store enumeration order is not interpretation context");
		assert.equal(again.contextDigest, grounds.contextDigest);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("Decision grounds reject missing authority, unsupported configuration and malformed input before reads", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const input = decisionInput(subject);
		for (const options of [{capabilities: ["changes.read"]}, {wikiItemIds: []}, {changeIds: []}]) {
			const instance = server(subject, options);
			const result = await loadProfileDecisionGrounds(instance.store, decisionConfiguration(instance), instance.actor, input);
			assert.equal(result.error.code, "authorization_denied");
			assert.deepEqual(instance.calls, []);
		}
		for (const patch of [{kernelVersion: undefined}, {kernelVersion: "999.0.0"}]) {
			const instance = server(subject);
			assert.equal((await loadProfileDecisionGrounds(instance.store, decisionConfiguration(instance, patch), instance.actor, input)).error.code, "unavailable");
			assert.deepEqual(instance.calls, []);
		}
		const instance = server(subject); let accessed = 0;
		const accessor = {...input}; Object.defineProperty(accessor, "changeId", {get() {accessed++; throw new Error("must not run");}});
		for (const invalid of [null, {...input, changeId: "../../other"}, {...input, contextComplete: true}, accessor,
			{...input, expectedChangeTip: gitOid("1".repeat(64), "sha256")}]) {
			assert.equal((await loadProfileDecisionGrounds(instance.store, decisionConfiguration(instance), instance.actor, invalid)).error.code, "invalid_request");
		}
		assert.equal(accessed, 0);
		assert.deepEqual(instance.calls, []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("Decision grounds require current heads and build while historical proposal reads stay compatible", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const input = decisionInput(subject);
		for (const field of ["expectedProjectHead", "expectedChangeTip"]) {
			const instance = server(subject);
			assert.equal((await loadProfileDecisionGrounds(instance.store, decisionConfiguration(instance), instance.actor, {...input, [field]: gitOid("1".repeat(40))})).error.code, "source_stale");
			assert.deepEqual(writes(instance), []);
		}
		const changedBuild = server(subject, {build: `sha256:${"c".repeat(64)}`});
		assert.equal((await loadProfileDecisionGrounds(changedBuild.store, decisionConfiguration(changedBuild), changedBuild.actor, input)).error.code, "unavailable");
		accepted(await changedBuild.call("changes.read", readInput()));
		assert.deepEqual(writes(changedBuild), []);
		git(subject.root, ["update-ref", "refs/heads/main", subject.afterCommit.hex]);
		const moved = server(subject);
		assert.equal((await loadProfileDecisionGrounds(moved.store, decisionConfiguration(moved), moved.actor, {...input, expectedProjectHead: subject.afterCommit})).error.code, "source_stale", "A new expected head cannot silently rebase the retained proposal");
		assert.deepEqual(writes(moved), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("Decision grounds bind configuration and preserve observation failure as failure, not staleness", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), input = decisionInput(subject), configuration = decisionConfiguration(instance);
		const first = admitted(await loadProfileDecisionGrounds(instance.store, configuration, instance.actor, input));
		const changed = {...configuration, limits: {...configuration.limits, maximumWikiItems: configuration.limits.maximumWikiItems + 1}};
		const second = admitted(await loadProfileDecisionGrounds(instance.store, changed, instance.actor, input));
		assert.notEqual(first.configurationDigest, second.configurationDigest);
		assert.notEqual(first.contextDigest, second.contextDigest);
		const broken = server(subject, {intercept: (method, request, original) => method === "readSnapshot" && request.selector.kind === "ref" && request.selector.ref === "refs/heads/main"
			? {ok: false, error: {code: "not_found", operation: "read_snapshot", message: "Unavailable snapshot"}} : original()});
		assert.equal((await loadProfileDecisionGrounds(broken.store, decisionConfiguration(broken), broken.actor, input)).error.code, "invalid_project_state");
		assert.equal(broken.calls.length, 1);
		assert.deepEqual(writes(instance), []);
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
		for (const [operation, input] of [["decision.evaluate", base], ["decision.commit", base], ["planning.admit", {...base, work}], ["work.integrate", {...base, workId: "cw:work:fixture"}], ["changes.complete", base], ["effects.request", {...base, capability: "codewiki.effect:fixture", expectedEffectHead: null}]]) {
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
	for (const [before, after] of [[{}, {"README.md": "unclaimed artifact\n"}], [{[PROFILE_CHANGE_PATH]: "retained history\n"}, {}], [{}, {".changekernel/wiki/unchecked.bin": "not Markdown\n"}]]) {
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
		git(subject.root, ["update-ref", REF, commit.hex]);
		const retained = await stableState(subject.root);
		const grounds = await loadProfileDecisionGrounds(reader.store, decisionConfiguration(reader), reader.actor, decisionInput(subject));
		assert.equal(grounds.error.code, "invalid_project_state");
		assert.match(grounds.error.message, /transaction digest/u);
		assert.deepEqual(writes(reader), []);
		assert.deepEqual(await stableState(subject.root), retained);
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

function sourceCitation(path, text, side = "before", startByte = 0, endByte = Buffer.byteLength(text)) {
	return {side, pathUtf8Hex: Buffer.from(path).toString("hex"), sourceDigest: sha256Digest(text), startByte, endByte};
}
async function sourceSlices(instance, subject, citations, configuration = decisionConfiguration(instance)) {
	return readProfileDecisionSourceSlices(instance.store, configuration, instance.actor, {...decisionInput(subject), citations});
}
for (const algorithm of ["sha1", "sha256"]) test(`Decision ${algorithm}: source citations bind exact raw slices, side and current grounds`, async () => {
	const path = "notes/e\u0301.md", text = "\ufeff# e\u0301\r\nExact source.\n";
	const subject = await fixture(algorithm, {[path]: text, "notes/copy.md": text});
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const baseline = await stableState(subject.root), instance = server(subject);
		const requested = [sourceCitation(path, text), sourceCitation(path, text, "after"), sourceCitation("notes/copy.md", text)];
		const result = admitted(await sourceSlices(instance, subject, requested));
		assert.equal(result.slices.length, 3);
		assert.equal(new Set(result.slices.map(slice => slice.citation.citationDigest)).size, 3, "Identical prose on different sides or paths is not identical provenance");
		for (const slice of result.slices) {
			assert.equal(slice.text, text, "BOM, decomposed characters and CRLF remain exact");
			assert.equal(slice.citation.contextDigest, result.contextDigest);
			assert.equal(slice.citation.sliceDigest, sha256Digest(text));
			assert.equal(slice.citation.blob.algorithm, algorithm);
			const {citationDigest, ...body} = slice.citation;
			assert.equal(citationDigest, admitted(semanticDigest(body.protocol, body)));
			assert.ok(Object.isFrozen(slice) && Object.isFrozen(slice.citation));
			assert.equal("coverage" in slice.citation, false);
		}
		assert.equal("contextComplete" in result, false);
		assert.ok(Object.isFrozen(result.slices));
		assert.equal(instance.calls.filter(call => call.method === "readSnapshot" && call.request.selector.kind === "ref" && call.request.selector.ref === REF).length, 1);
		assert.deepEqual(admitted(await sourceSlices(instance, subject, [...requested].reverse())), result);
		const configuration = decisionConfiguration(instance);
		const changed = admitted(await sourceSlices(instance, subject, requested, {...configuration, limits: {...configuration.limits, maximumWikiItems: configuration.limits.maximumWikiItems + 1}}));
		assert.notEqual(changed.contextDigest, result.contextDigest);
		assert.notEqual(changed.slices[0].citation.citationDigest, result.slices[0].citation.citationDigest);
		assert.deepEqual(writes(instance), []);
		assert.deepEqual(await stableState(subject.root), baseline);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("Decision source lookup rejects forged hashes, wrong sides, excluded material and split characters without partial results", async () => {
	const path = "notes/raw.md", text = "\ufefféX";
	const subject = await fixture("sha1", {[path]: text, "asset.bin": "Not admitted Markdown"});
	const afterText = profileFixture("sha1").after.files.find(file => file.path === PROFILE_PATH).text;
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), valid = sourceCitation(path, text);
		for (const [citation, code] of [
			[{...valid, sourceDigest: `sha256:${"f".repeat(64)}`}, "source_stale"],
			[{...valid, endByte: Buffer.byteLength(text) + 1}, "invalid_request"],
			[{...valid, startByte: 3, endByte: 4}, "invalid_request"],
			[{...valid, startByte: 4, endByte: 5}, "invalid_request"],
			[{...valid, endByte: 1}, "invalid_request"],
			[sourceCitation("notes/new.md", "New source", "before"), "unavailable"],
			[sourceCitation(PROFILE_PATH, afterText, "before"), "source_stale"],
			[sourceCitation("asset.bin", "Not admitted Markdown"), "unavailable"],
			[sourceCitation("../outside.md", text), "unavailable"],
		]) {
			const result = await sourceSlices(instance, subject, [sourceCitation(path, text, "after"), citation]);
			assert.equal(result.error.code, code);
			assert.equal("value" in result, false, "One invalid citation invalidates the whole response");
		}
		assert.equal(admitted(await sourceSlices(instance, subject, [sourceCitation(path, text, "before", 3, 5)])).slices[0].text, "é");
		assert.equal(admitted(await sourceSlices(instance, subject, [sourceCitation(PROFILE_PATH, afterText, "after")])).slices[0].text, afterText);
		assert.deepEqual(writes(instance), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("Decision citation shape, authority and count bounds fail before source reads", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const citation = sourceCitation("notes/source.md", "source"), input = {...decisionInput(subject), citations: [citation]};
		for (const options of [{capabilities: ["changes.read"]}, {wikiItemIds: []}, {changeIds: []}]) {
			const instance = server(subject, options);
			assert.equal((await readProfileDecisionSourceSlices(instance.store, decisionConfiguration(instance), instance.actor, input)).error.code, "authorization_denied");
			assert.deepEqual(instance.calls, []);
		}
		const instance = server(subject); let accessed = 0;
		const accessor = Object.defineProperty({}, "side", {enumerable: true, get() {accessed++; throw new Error("must not run");}});
		for (const invalid of [null, {...input, verdict: "passed"}, {...input, contextComplete: true}, {...input, citations: []},
			...[accessor, {...citation, startByte: -1}, {...citation, startByte: 1.5}, {...citation, endByte: 0}, {...citation, pathUtf8Hex: "a"}, {...citation, side: "canonical"}].map(value => ({...input, citations: [value]})),
			{...input, citations: [citation, citation]}, {...input, citations: Array.from({length: 65}, (_, i) => ({...citation, startByte: i, endByte: i + 1}))}]) {
			assert.equal((await readProfileDecisionSourceSlices(instance.store, decisionConfiguration(instance), instance.actor, invalid)).error.code, "invalid_request");
		}
		assert.equal(accessed, 0);
		assert.deepEqual(instance.calls, []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("Decision citations enforce an aggregate byte bound without truncating admitted ranges", async () => {
	const text = "x".repeat(128 * 1024 + 1), path = "notes/large.md";
	const subject = await fixture("sha1", {[path]: text});
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject);
		const overflow = await sourceSlices(instance, subject, [sourceCitation(path, text), sourceCitation(path, text, "after")]);
		assert.equal(overflow.error.code, "invalid_request");
		assert.deepEqual(instance.calls, []);
		const slices = admitted(await sourceSlices(instance, subject, [sourceCitation(path, text, "before", 0, 128 * 1024), sourceCitation(path, text, "after", 0, 128 * 1024)]));
		assert.equal(slices.slices.reduce((bytes, slice) => bytes + Buffer.byteLength(slice.text), 0), 256 * 1024);
		assert.ok(slices.slices.every(slice => slice.text.length === slice.citation.endByte - slice.citation.startByte));
		assert.deepEqual(writes(instance), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

test("Decision citations do not survive a changed Project head merely because quoted bytes still match", async () => {
	const path = "notes/unchanged.md", text = "Same text";
	const subject = await fixture("sha1", {[path]: text});
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), input = {...decisionInput(subject), citations: [sourceCitation(path, text)]};
		assert.equal((await readProfileDecisionSourceSlices(instance.store, decisionConfiguration(instance), instance.actor, input)).ok, true);
		git(subject.root, ["update-ref", "refs/heads/main", subject.afterCommit.hex]);
		const result = await readProfileDecisionSourceSlices(instance.store, decisionConfiguration(instance), instance.actor, input);
		assert.equal(result.error.code, "source_stale");
		assert.deepEqual(writes(instance), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

async function completedModelCheck(instance, subject, citations, {subjectPatch = {}, runPatch = {}, outputPatch = {}} = {}) {
	const grounds = admitted(await loadProfileDecisionGrounds(instance.store, decisionConfiguration(instance), instance.actor, decisionInput(subject)));
	const digest = grounds.contextDigest;
	const route = {routeId: "cw:route:fixture", providerId: "cw:provider:fixture", modelId: "cw:model:fixture"};
	const material = runPatch.material ?? {systemPrompt: "Fixture only; source verification does not prove what a model saw.", prompt: "Return bounded Check output."};
	const authorization = admitted(authorizeDecisionModelCheckRun({actorId: instance.actor.actorId, authorizationId: instance.actor.authorizationId,
		subject: {subjectId: "cw:subject:decision-check", subjectDigest: grounds.reduced.change.changeDigest, repositoryId: PROFILE_REPOSITORY,
			projectCommit: grounds.project.commit, projectTree: grounds.project.tree, changeId: PROFILE_CHANGE_ID, changeTip: grounds.containing.commit,
			workId: null, artifactCommit: null, artifactTree: null, ...subjectPatch},
		route: {...route, routeDigest: admitted(semanticDigest("codewiki.agent-route@1.0.0", route))}, wikiCommit: grounds.project.commit, itemIds: [], feedbackDigest: null,
		material,
		writableScope: [], previewSubjectDigest: null, attempt: 1, predecessor: null,
		issuedAt: "2026-09-11T00:00:00.000Z", deadlineAt: "2026-09-11T00:01:00.000Z", ...runPatch}));
	const text = admitted(canonicalJson({protocol: DECISION_CHECK_OUTPUT_PROTOCOL, status: citations.length ? "supported" : "unresolved", reason: "Fixture interpretation, not admitted evidence.", assumptions: [], citations, ...outputPatch}));
	const outputDigest = admitted(semanticDigest("codewiki.agent-output@1.0.0", {text}));
	const quiescence = admitted(createAgentRunQuiescence({runId: authorization.runId, authorizationDigest: authorization.authorizationDigest,
		observedAt: "2026-09-11T00:00:03.000Z", processTreeTerminated: true, providerRequestsClosed: true, previewClosed: true, temporaryStateClosed: true}));
	const receipt = admitted(createAgentRunReceipt({runId: authorization.runId, authorizationDigest: authorization.authorizationDigest, outcome: "completed",
		startedAt: "2026-09-11T00:00:01.000Z", finishedAt: "2026-09-11T00:00:02.000Z", outputDigest,
		usageDigest: digest, providerReceiptDigest: digest, sessionReceiptDigest: digest, queryReceiptDigests: [], cancellationDigest: null,
		custody: {processTreeTerminated: true, providerRequestsClosed: true, previewClosed: true, temporaryStateClosed: true, quiescenceDigest: quiescence.quiescenceDigest}, operationalGaps: []}));
	const handle = {runId: authorization.runId, authorizationDigest: authorization.authorizationDigest, status: "terminal", receipt, quiescence};
	const output = {protocol: AGENT_RUN_OUTPUT_PROTOCOL, runId: authorization.runId, authorizationDigest: authorization.authorizationDigest, receiptDigest: receipt.receiptDigest, outputDigest, text};
	return {input: {authorization, handle, expectedContextDigest: digest}, output, material};
}
function modelSources(instance, value, onRead = () => {}) {
	return readDecisionModelCheckSources(instance.store, decisionConfiguration(instance), instance.actor,
		{protocol: AGENT_RUN_OUTPUT_PORT_PROTOCOL, async read() {await onRead(); return {ok: true, value: value.output};}}, value.input);
}
for (const algorithm of ["sha1", "sha256"]) test(`Decision ${algorithm}: completed model check output resolves exact backend source quotations without admitting findings`, async () => {
	const path = "notes/model-source.md", text = "\ufeff# e\u0301\r\nOriginal bytes.\n", subject = await fixture(algorithm, {[path]: text});
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), baseline = await stableState(subject.root);
		const value = await completedModelCheck(instance, subject, [sourceCitation(path, text), sourceCitation(path, text, "after")]);
		let reads = 0;
		const result = admitted(await modelSources(instance, value, () => {reads++;}));
		assert.equal(reads, 1); assert.equal(result.slices.length, 2);
		assert.equal(result.contextDigest, value.input.expectedContextDigest);
		assert.equal(result.output.receiptDigest, value.input.handle.receipt.receiptDigest);
		for (const slice of result.slices) {assert.equal(slice.text, text); assert.equal(slice.citation.contextDigest, result.contextDigest);}
		assert.equal("findingDigest" in result, false); assert.equal("contextComplete" in result, false);
		assert.ok(Object.isFrozen(result));
		assert.deepEqual(admitted(await modelSources(instance, value)), result);
		assert.deepEqual(writes(instance), []); assert.deepEqual(await stableState(subject.root), baseline);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});
test("model check source authority and hostile request failures precede all reads", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), value = await completedModelCheck(instance, subject, []);
		let reads = 0;
		for (const options of [{capabilities: ["changes.read"]}, {wikiItemIds: []}, {changeIds: []}]) {
			const denied = server(subject, options);
			assert.equal((await modelSources(denied, value, () => {reads++;})).error.code, "authorization_denied");
			assert.deepEqual(denied.calls, []);
		}
		for (const field of ["actorId", "authorizationId"]) {
			const denied = server(subject); denied.actor[field] = "cw:identity:other";
			assert.equal((await modelSources(denied, value, () => {reads++;})).error.code, "authorization_denied");
			assert.deepEqual(denied.calls, []);
		}
		instance.calls.length = 0; let accessed = 0;
		const hostile = Object.defineProperty({}, "authorization", {enumerable: true, get() {accessed++; throw Error("must not run");}});
		for (const input of [hostile, {...value.input, finding: "supported"}, {...value.input, expectedContextDigest: "claimed"}]) {
			assert.equal((await modelSources(instance, {...value, input}, () => {reads++;})).error.code, "invalid_request");
		}
		assert.equal(reads, 0); assert.equal(accessed, 0); assert.deepEqual(instance.calls, []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});
test("model check source context and subject mismatches fail before output retrieval", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), value = await completedModelCheck(instance, subject, []);
		let reads = 0;
		const changed = {...value, input: {...value.input, expectedContextDigest: `sha256:${"f".repeat(64)}`}};
		assert.equal((await modelSources(instance, changed, () => {reads++;})).error.code, "source_stale");
		for (const options of [{subjectPatch: {projectTree: subject.reference.after.tree}}, {runPatch: {wikiCommit: value.input.authorization.subject.changeTip}}]) {
			const wrong = await completedModelCheck(instance, subject, [], options);
			assert.equal((await modelSources(instance, wrong, () => {reads++;})).error.code, "source_stale");
		}
		assert.equal(reads, 0); assert.deepEqual(writes(instance), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});
test("model check source verification rejects invented citations and malformed output atomically", async () => {
	const path = "notes/quoted.md", text = "Source bytes", subject = await fixture("sha1", {[path]: text});
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), valid = sourceCitation(path, text);
		for (const [citations, outputPatch, code] of [
			[[valid, {...valid, side: "after", sourceDigest: `sha256:${"f".repeat(64)}`}], {}, "source_stale"],
			[[sourceCitation("notes/missing.md", text)], {}, "unavailable"],
			[[valid], {status: "passed"}, "invalid_receipt"],
		]) {
			const value = await completedModelCheck(instance, subject, citations, {outputPatch});
			const result = await modelSources(instance, value);
			assert.equal(result.error.code, code); assert.equal("value" in result, false);
		}
		assert.deepEqual(writes(instance), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});
test("model check source verification rechecks heads after output reads, even without citations", async () => {
	const path = "notes/quoted.md", text = "Same text", subject = await fixture("sha1", {[path]: text});
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject);
		for (const citations of [[], [sourceCitation(path, text)]]) {
			const value = await completedModelCheck(instance, subject, citations);
			assert.equal((await modelSources(instance, value)).ok, true);
			const result = await modelSources(instance, value, () => git(subject.root, ["update-ref", "refs/heads/main", subject.afterCommit.hex]));
			assert.equal(result.error.code, "source_stale"); assert.equal("value" in result, false);
			git(subject.root, ["update-ref", "refs/heads/main", subject.beforeCommit.hex]);
		}
		assert.deepEqual(writes(instance), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

function modelMaterial(instance, value, material = value.material, onRead = () => {}) {
	return readDecisionModelCheckMaterial(instance.store, decisionConfiguration(instance), instance.actor,
		{protocol: AGENT_RUN_OUTPUT_PORT_PROTOCOL, async read() {await onRead(); return {ok: true, value: value.output};}}, {...value.input, material});
}
test("model check retained input binds exact prompts and remains frozen across asynchronous reads", async () => {
	const path = "notes/input.md", text = "Exact source", subject = await fixture("sha1", {[path]: text});
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), material = {systemPrompt: "", prompt: "Exact prompt\r\n"};
		const value = await completedModelCheck(instance, subject, [sourceCitation(path, text)], {runPatch: {material}});
		const result = admitted(await modelMaterial(instance, value, material, () => {material.prompt = "Changed while awaiting output";}));
		assert.deepEqual(result.material, {systemPrompt: "", prompt: "Exact prompt\r\n"});
		assert.ok(Object.isFrozen(result.material) && Object.isFrozen(result));
		assert.equal(result.slices[0].text, text);
		assert.equal(result.output.authorizationDigest, value.input.authorization.authorizationDigest);
		assert.equal("findingDigest" in result, false); assert.equal("contextComplete" in result, false);
		assert.deepEqual(writes(instance), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});
test("model check retained input rejects tampering, hostile data and overflow before all reads", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), value = await completedModelCheck(instance, subject, []);
		instance.calls.length = 0; let reads = 0, accessed = 0;
		const hostile = Object.defineProperty({}, "prompt", {enumerable: true, get() {accessed++; throw Error("must not run");}});
		for (const material of [null, hostile, {...value.material, prompt: value.material.prompt + "\n"}, {...value.material, systemPrompt: "Replacement"},
			{...value.material, checkId: "cw:check:claimed"}, {...value.material, prompt: "e\u0301"}, {...value.material, prompt: "x".repeat(256 * 1024 + 1)}]) {
			const result = await modelMaterial(instance, value, material, () => {reads++;});
			assert.equal(result.error.code, "invalid_request"); assert.equal("value" in result, false);
		}
		assert.equal(accessed, 0); assert.equal(reads, 0); assert.deepEqual(instance.calls, []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});
test("matching model input does not bypass authorization, output identity or source freshness", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), value = await completedModelCheck(instance, subject, []);
		const denied = server(subject, {capabilities: ["changes.read"]}); let reads = 0;
		assert.equal((await modelMaterial(denied, value, value.material, () => {reads++;})).error.code, "authorization_denied");
		assert.equal(reads, 0); assert.deepEqual(denied.calls, []);
		const swapped = {...value, output: {...value.output, text: "Different output"}};
		assert.equal((await modelMaterial(instance, swapped)).error.code, "invalid_receipt");
		const raced = await modelMaterial(instance, value, value.material, () => git(subject.root, ["update-ref", "refs/heads/main", subject.afterCommit.hex]));
		assert.equal(raced.error.code, "source_stale"); assert.equal("value" in raced, false);
		assert.deepEqual(writes(instance), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

function transitionCheck(instance, subject, input = decisionInput(subject), configuration = decisionConfiguration(instance)) {
	return runDecisionProfileTransitionCheck(instance.store, configuration, instance.actor, input);
}
for (const algorithm of ["sha1", "sha256"]) test(`Decision ${algorithm}: profile transition code Check produces an exact scoped finding, never stage approval`, async () => {
	const subject = await fixture(algorithm);
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), baseline = await stableState(subject.root);
		const result = admitted(await transitionCheck(instance, subject));
		assert.equal(result.gate.stage, "decision");
		assert.equal(result.gate.checks.length, 1);
		assert.equal(result.gate.checks[0].checkId, DECISION_PROFILE_TRANSITION_CHECK.checkId);
		assert.equal(result.finding.status, "supported");
		assert.equal(result.finding.checkId, result.gate.checks[0].checkId);
		assert.equal(result.finding.executionDigest, result.gate.checks[0].executionDigest);
		assert.equal(result.finding.gateDigest, result.gate.gateDigest);
		assert.equal(result.gate.contextDigest, admitted(semanticDigest("codewiki.profile-decision-grounds@1.0.0", result.grounds)));
		assert.equal(result.gate.subject.changeId, PROFILE_CHANGE_ID);
		assert.deepEqual(result.gate.subject.projectCommit, subject.beforeCommit);
		assert.deepEqual(result.gate.subject.changeTip, decisionInput(subject).expectedChangeTip);
		assert.equal(result.gate.contextComplete, false);
		assert.deepEqual(result.finding.evidenceDigests, [], "Do not relabel transaction hashes as admitted evidence");
		assert.equal(result.outcome.status, "stopped");
		assert.deepEqual(result.outcome.stopReasons, ["incomplete_context", `missing_evidence:${DECISION_PROFILE_TRANSITION_CHECK.checkId}`]);
		assert.deepEqual(admitted(verifySemanticGateOutcome({gate: result.gate, currentGate: result.gate, findings: [result.finding], outcome: result.outcome})), result.outcome);
		assert.deepEqual(admitted(await transitionCheck(instance, subject)), result);
		assert.ok(Object.isFrozen(result) && Object.isFrozen(result.finding) && Object.isFrozen(DECISION_PROFILE_TRANSITION_CHECK));
		assert.deepEqual(writes(instance), []); assert.deepEqual(await stableState(subject.root), baseline);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});
test("profile transition code Check rejects caller selection, verdicts and unauthorized reads", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		for (const options of [{capabilities: ["changes.read"]}, {wikiItemIds: []}, {changeIds: []}]) {
			const denied = server(subject, options);
			assert.equal((await transitionCheck(denied, subject)).error.code, "authorization_denied");
			assert.deepEqual(denied.calls, []);
		}
		const instance = server(subject);
		for (const patch of [{checks: []}, {contextComplete: true}, {finding: "supported"}]) {
			const result = await transitionCheck(instance, subject, {...decisionInput(subject), ...patch});
			assert.equal(result.error.code, "invalid_request"); assert.equal("value" in result, false);
		}
		assert.deepEqual(instance.calls, []);
		git(subject.root, ["update-ref", "refs/heads/main", subject.afterCommit.hex]);
		const stale = await transitionCheck(instance, subject);
		assert.equal(stale.error.code, "source_stale"); assert.equal("value" in stale, false, "Reconstruction failure is not a semantic contradiction");
		assert.deepEqual(writes(instance), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});
test("profile transition code Check execution binds configuration and findings cannot move to another Gate", async () => {
	const subject = await fixture();
	try {
		accepted(await server(subject).call("changes.propose-profile", subject.input));
		const instance = server(subject), original = admitted(await transitionCheck(instance, subject));
		const configuration = decisionConfiguration(instance);
		const changed = admitted(await transitionCheck(instance, subject, decisionInput(subject), {...configuration, limits: {...configuration.limits, maximumWikiItems: configuration.limits.maximumWikiItems + 1}}));
		assert.notEqual(changed.gate.checks[0].executionDigest, original.gate.checks[0].executionDigest);
		assert.notEqual(changed.gate.gateDigest, original.gate.gateDigest);
		assert.equal(admitted(reduceSemanticGate({gate: original.gate, currentGate: changed.gate, findings: [original.finding]})).status, "stopped");
		assert.equal(reduceSemanticGate({gate: changed.gate, currentGate: changed.gate, findings: [original.finding]}).ok, false);
		const {protocol, gateDigest, ...body} = original.gate;
		void protocol; void gateDigest;
		const forgedComplete = admitted(createSemanticGate({...body, contextComplete: true}));
		assert.equal(reduceSemanticGate({gate: forgedComplete, currentGate: forgedComplete, findings: [original.finding]}).ok, false);
		assert.deepEqual(writes(instance), []);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});

for (const algorithm of ["sha1", "sha256"]) test(`Kernel version ${algorithm}: proposal and historical recovery retain format identities and lifecycle guards`, async () => {
	const subject = await fixture(algorithm);
	try {
		const current = server(subject, {kernelVersion: CHANGEKERNEL_VERSION});
		accepted(await current.call("changes.propose-profile", subject.input));
		const baseline = await stableState(subject.root);
		const historical = server(subject);
		const expected = accepted(await historical.call("changes.read", readInput()));
		const reopened = server(subject, {kernelVersion: CHANGEKERNEL_VERSION, build: `sha256:${"c".repeat(64)}`});
		assert.deepEqual(accepted(await reopened.call("changes.read", readInput())), expected);
		assert.equal(expected.change.reference.profile, WIKI_PROFILE_ID);
		assert.equal(expected.change.reference.kernelBuildDigest, PROFILE_BUILD);
		accepted(await reopened.call("changes.propose-profile", subject.input));
		assert.deepEqual(writes(reopened), []);
		const blocked = server(subject, {kernelVersion: CHANGEKERNEL_VERSION});
		assert.equal((await blocked.call("decision.evaluate", {...decisionInput(subject), commandId: "cw:command:blocked-decision"})).error.code, "unavailable");
		assert.deepEqual(blocked.calls, []);
		const denied = server(subject, {kernelVersion: CHANGEKERNEL_VERSION, changeIds: []});
		assert.equal((await denied.call("changes.read", readInput())).status, "error");
		assert.deepEqual(denied.calls, []);
		assert.deepEqual(await stableState(subject.root), baseline);
	} finally {await rm(subject.root, {recursive: true, force: true});}
});
