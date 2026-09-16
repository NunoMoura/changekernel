import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile, readFile} from "node:fs/promises";
import {join, dirname} from "node:path";
import {tmpdir} from "node:os";
import {execFileSync} from "node:child_process";

import {createGitProjectStore} from "../../../src/adapters/git/project-store.ts";
import {createProjectServer} from "../../../src/server/index.ts";

import {createProjectAccessPolicy, projectAccessProofDigest} from "../../../src/server/authorization/policy.ts";
import {PRODUCT_OPERATIONS, createProductTransportRequest, decodeProductTransportResponse} from "../../../src/api/transport/envelope.ts";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "../../../src/ports/agent-runtime.ts";

import {WIKI_PROFILE_ID} from "../../../src/kernel/wiki/profile.ts";
import {CHANGEKERNEL_VERSION} from "../../../src/kernel/identity/version.ts";

import {createProfiledWikiReference} from "../../../src/kernel/wiki/profile-reference.ts";
import {validateProfiledWikiTransaction} from "../../../src/kernel/wiki/profile-transaction.ts";
import {admitted, gitOid, PROFILE_BUILD, PROFILE_CHANGE_ID, PROFILE_CHANGE_PATH, PROFILE_PROPOSAL, PROFILE_REPOSITORY, profileFixture} from "../../kernel/wiki/profile-fixtures.mjs";

export const NOW = "2026-09-11T00:00:00Z";

export const EXPIRY = "2030-01-01T00:00:00Z";

export const PROOF = "profile-fixture-proof";

export const REF = `refs/codewiki/changes/${PROFILE_CHANGE_ID}`;

export const EFFECTS = new Set(["writeBlob", "writeTree", "createCommit", "compareAndSwapRefs"]);

export const ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

Object.assign(ENV, {GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null"});

export function gitBytes(root, args) {
	return execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "gc.auto=0", ...args], {cwd: root, env: ENV});
}

export function git(root, args) {return gitBytes(root, args).toString("utf8").trimEnd();}

export async function save(root, path, content) {
	await mkdir(dirname(join(root, path)), {recursive: true});
	await writeFile(join(root, path), content);
}

export async function fixture(algorithm = "sha1", extraBefore = {}, extraAfter = {}) {
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

export function server(subject, {capabilities = PRODUCT_OPERATIONS, wikiItemIds = null, changeIds = null, build = PROFILE_BUILD, intercept, actorPatch, limits, kernelVersion} = {}) {
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
	const unavailable = async () => {throw new Error("Profile proposal/read must not execute Checks or agents.");};
	const configuration = {projectName: "Profile fixture", repositoryId: PROFILE_REPOSITORY, objectFormat: subject.algorithm, canonicalRef: "refs/heads/main", kernelBuildDigest: build, kernelVersion: kernelVersion ?? CHANGEKERNEL_VERSION};
	const project = {...configuration};
	if (kernelVersion === undefined) delete project.kernelVersion;
	const instance = admitted(createProjectServer({
		ports: {projectStore: counted, agentRuntime: {protocol: AGENT_RUNTIME_PORT_PROTOCOL, start: unavailable, inspect: unavailable, cancel: unavailable}},
		accessPolicy, project, limits, clock: () => NOW,
	}));
	let ordinal = 0;
	const request = (operation, input, requestId = `cw:request:profile-${++ordinal}`) => admitted(createProductTransportRequest({requestId, repositoryId: PROFILE_REPOSITORY, client: {kind: "sdk", instanceId: "cw:client:profile-fixture"}, authentication: {identityRef: actor.identityRef, proof: PROOF}, expiresAt: EXPIRY, operation, input}));
	const handle = async (value) => admitted(decodeProductTransportResponse(await instance.handle(value)));
	return {calls, actor, configuration, store: counted, request, handle, call: (operation, input) => handle(request(operation, input))};
}

export function writes(instance) {return instance.calls.filter((call) => EFFECTS.has(call.method));}

export function readInput(source = {kind: "change", changeId: PROFILE_CHANGE_ID}) {return {view: "get", changeId: PROFILE_CHANGE_ID, source};}

export async function stableState(root) {
	return {refs: git(root, ["show-ref"]), objects: git(root, ["count-objects", "-v"]), config: await readFile(join(root, ".git/config")), index: await readFile(join(root, ".git/index"))};
}

export function accepted(response) {assert.equal(response.status, "ok", JSON.stringify(response.error)); return response.data;}

export function decisionConfiguration(instance, patch = {}) {
	return {...instance.configuration, limits: {
		maximumWikiItems: 4096, maximumWikiFileBytes: 256 * 1024, maximumWikiTotalBytes: 4 * 1024 * 1024,
		maximumChangeTraces: 4096, maximumTraceBytes: 1024 * 1024, maximumHistoryCommits: 128, maximumHistoryBytes: 4 * 1024 * 1024,
	}, ...patch};
}

export function decisionInput(subject) {
	return {changeId: PROFILE_CHANGE_ID, expectedProjectHead: subject.beforeCommit,
		expectedChangeTip: gitOid(git(subject.root, ["rev-parse", REF]), subject.algorithm)};
}
