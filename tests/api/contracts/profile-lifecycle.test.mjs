import assert from "node:assert/strict";
import test from "node:test";
import {decodeProductCommandInput} from "../../../src/api/contracts/command.ts";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {WIKI_PROFILE_ID} from "../../../src/kernel/wiki/profile.ts";
import {createProfiledWikiReference} from "../../../src/kernel/wiki/profile-reference.ts";
import {admitted, profileFixture, PROFILE_BUILD, PROFILE_CHANGE_ID, PROFILE_PROPOSAL} from "../../kernel/wiki/profile-fixtures.mjs";

function input() {
	const fixture = profileFixture();
	const reference = admitted(createProfiledWikiReference(fixture.transaction));
	return {commandId: "cw:command:profile-input", changeId: PROFILE_CHANGE_ID, expectedProjectHead: fixture.before.snapshot.commit, profile: WIKI_PROFILE_ID, kernelBuildDigest: PROFILE_BUILD, afterCommit: fixture.after.snapshot.commit, proposal: PROFILE_PROPOSAL, mappings: reference.mappings};
}

test("explicit profile command preserves exact transport and does not broaden legacy proposal grammar", () => {
	const value = input();
	assert.equal(admitted(canonicalJson(admitted(decodeProductCommandInput("changes.propose-profile", value)))), admitted(canonicalJson(value)));
	assert.equal(decodeProductCommandInput("changes.propose", value).ok, false);
	for (const patch of [{profile: "unknown"}, {kernelBuildDigest: "unknown"}, {changeId: "title-as-identity"}, {proposal: {...value.proposal, targets: []}}, {mappings: [{...value.mappings[0], before: [{...value.mappings[0].before[0], pathUtf8Hex: "ff"}]}]}]) {
		assert.equal(decodeProductCommandInput("changes.propose-profile", {...value, ...patch}).ok, false);
	}
	const relationship = {kind: "depends_on", changeId: "CHG-other"};
	const related = admitted(decodeProductCommandInput("changes.propose-profile", {...value, proposal: {...value.proposal, relationships: [relationship]}}));
	assert.deepEqual(related.proposal.relationships, [relationship]);
});

test("profile command rejects hostile own-data and aggregate endpoint overflow before interpretation", () => {
	let touched = 0;
	const value = input();
	const hostile = {...value};
	Object.defineProperty(hostile, "kernelBuildDigest", {enumerable: true, get() {touched++; throw new Error("not data");}});
	assert.equal(decodeProductCommandInput("changes.propose-profile", hostile).ok, false);
	assert.equal(touched, 0);
	assert.equal(decodeProductCommandInput("changes.propose-profile", {...value, mappings: new Array(1)}).ok, false);
	const mapping = value.mappings[0];
	assert.equal(decodeProductCommandInput("changes.propose-profile", {...value, mappings: [{kind: "merge", before: Array(512).fill(mapping.before[0]), after: mapping.after}, mapping]}).ok, false);
	assert.equal(decodeProductCommandInput("changes.propose-profile", {...value, mappings: Array(1025).fill(mapping)}).ok, false);
});
