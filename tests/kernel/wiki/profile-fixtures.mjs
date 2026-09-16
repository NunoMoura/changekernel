import {CHANGEKERNEL_VERSION} from "../../../src/kernel/identity/version.ts";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {decodeKernelWikiFile} from "../../../src/adapters/git/wiki-profile.ts";
import {createProjectSnapshot} from "../../../src/kernel/changes/snapshot.ts";
import {WIKI_CORE_TYPES, WIKI_PROFILE_ID} from "../../../src/kernel/wiki/profile.ts";
import {validateProfiledWikiTransaction} from "../../../src/kernel/wiki/profile-transaction.ts";
import {createProfiledWikiReference} from "../../../src/kernel/wiki/profile-reference.ts";
import {createProfileChange} from "../../../src/kernel/changes/contracts.ts";
import {createProfileChangeEvent} from "../../../src/kernel/changes/events.ts";
import {createProfileChangeTraceHeader, createEmptyProfileChangeTrace, appendProfileChangeEvent} from "../../../src/kernel/changes/trace.ts";

export const PROFILE_CHANGE_ID = "CHG-profile-test";
export const PROFILE_CHANGE_PATH = `.changekernel/changes/TRACE-${PROFILE_CHANGE_ID}.jsonl`;
export const PROFILE_BUILD = `sha256:${"b".repeat(64)}`;
export const PROFILE_REPOSITORY = "cw:repository:profile-lifecycle";
export const PROFILE_PATH = ".changekernel/wiki/items/Cafe\u0301.md";
export const PROFILE_PROPOSAL = Object.freeze({
	changeType: "correction", realization: "wiki-only", intent: "Clarify the shared claim.",
	rationale: "Exact source grounds are available.", acceptance: ["Claim has explicit grounds."],
	relationships: [], contributorRefs: ["cw:actor:maintainer"], producerRunRefs: [],
});

export function admitted(result) {
	assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.error));
	return result.value;
}

export function profileText(title, type = "Claim", revision = "bootstrap", body = "Meaning with explicit grounds.") {
	return `---\ntype: ${type}\ntitle: ${title}\ncodewiki-origin: [../../changes/bootstrap]\ncodewiki-revision: ../../changes/${revision}\n---\n# ${title}\n\n${body}\n`;
}

export function gitOid(hex, algorithm = "sha1") {
	return {algorithm, hex: hex.padStart(algorithm === "sha1" ? 40 : 64, "0")};
}

export function profileFile(path, text, algorithm = "sha1") {
	const bytes = new TextEncoder().encode(text);
	const hex = createHash(algorithm).update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
	return admitted(decodeKernelWikiFile(CHANGEKERNEL_VERSION, {bytes, path, mode: "100644", blob: gitOid(hex, algorithm)}));
}

export function profileFixture(algorithm = "sha1") {
	const core = WIKI_CORE_TYPES.map((name) => profileFile(`.changekernel/wiki/types/${name}.md`, profileText(name, "TypeDefinition"), algorithm));
	const beforeFile = profileFile(PROFILE_PATH, profileText("Claim"), algorithm);
	const afterFile = profileFile(PROFILE_PATH, profileText("Claim", "Claim", `TRACE-${PROFILE_CHANGE_ID}.jsonl`, "Revised meaning with explicit grounds."), algorithm);
	const snapshot = (commit, tree, parents = []) => admitted(createProjectSnapshot({
		repositoryId: PROFILE_REPOSITORY, objectFormat: algorithm,
		commit: gitOid(commit, algorithm), tree: gitOid(tree, algorithm), parents, complete: true,
	}));
	const before = {snapshot: snapshot("1", "2"), files: [...core, beforeFile]};
	const after = {snapshot: snapshot("3", "4", [before.snapshot.commit]), files: [...core, afterFile]};
	const mappings = [{kind: "revise", before: [{path: beforeFile.path, blob: beforeFile.blob}], after: [{path: afterFile.path, blob: afterFile.blob}]}];
	const transaction = admitted(validateProfiledWikiTransaction({
		profile: WIKI_PROFILE_ID, kernelBuildDigest: PROFILE_BUILD, responsibleChangePath: PROFILE_CHANGE_PATH,
		before, after, mappings,
	}));
	return {before, after, mappings, transaction};
}

export function profileRecord(algorithm = "sha1") {
	const fixture = profileFixture(algorithm);
	const reference = admitted(createProfiledWikiReference(fixture.transaction));
	const targets = reference.mappings.flatMap((mapping) => [
		...mapping.after.map((endpoint) => ({kind: "profile", transactionDigest: reference.transactionDigest, side: "after", ...endpoint})),
		...mapping.before.map((endpoint) => ({kind: "profile", transactionDigest: reference.transactionDigest, side: "before", ...endpoint})),
	]);
	const change = admitted(createProfileChange({changeId: PROFILE_CHANGE_ID, repositoryId: PROFILE_REPOSITORY, revision: 1, ...PROFILE_PROPOSAL, reference, targets}));
	const event = admitted(createProfileChangeEvent({
		kind: "change.proposed", ownerBinding: {kind: "kernel", profile: reference.profile, kernelBuildDigest: reference.kernelBuildDigest, transactionDigest: reference.transactionDigest},
		actorId: "cw:actor:maintainer", authorityId: "cw:authorization:fixture", commandId: "cw:command:profile-fixture", commandDigest: PROFILE_BUILD,
		occurredAt: "2026-09-11T00:00:00Z", expectedProjectHead: fixture.before.snapshot.commit, expectedChangeTip: null, predecessorEventDigest: null, payload: {change},
	}));
	const header = admitted(createProfileChangeTraceHeader({repositoryId: PROFILE_REPOSITORY, changeId: PROFILE_CHANGE_ID, objectFormat: algorithm, createdBy: event.actorId, createdAt: event.occurredAt}));
	const trace = admitted(appendProfileChangeEvent(admitted(createEmptyProfileChangeTrace(header)), event));
	return {...fixture, reference, change, event, trace};
}
