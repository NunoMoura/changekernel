import assert from "node:assert/strict";
import test from "node:test";

import {createProjectSnapshot} from "../../../src/kernel/changes/snapshot.ts";
import {decodeWikiMetadata, WIKI_CORE_TYPES, WIKI_PROFILE_ID, WIKI_PROFILE_LIMITS} from "../../../src/kernel/wiki/profile.ts";
import {
	PROFILED_WIKI_MAPPING_KINDS,
	PROFILED_WIKI_TRANSACTION_LIMITS,
	validateProfiledWikiTransaction,
} from "../../../src/kernel/wiki/profile-transaction.ts";

const UTF8 = new TextEncoder();
const CHANGE_PATH = ".codewiki/changes/CHG-profile";
const BUILD_DIGEST = `sha256:${"a".repeat(64)}`;

function oid(number, algorithm = "sha1") {
	const width = algorithm === "sha1" ? 40 : 64;
	return {algorithm, hex: Number(number).toString(16).padStart(width, "0")};
}

function snapshot(commit, tree, algorithm = "sha1") {
	const result = createProjectSnapshot({
		repositoryId: "cw:repository:profile-transaction-test",
		objectFormat: algorithm,
		commit: oid(commit, algorithm),
		tree: oid(tree, algorithm),
		parents: [],
		complete: true,
	});
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	return result.value;
}

function metadata(path, type, title, {origin = "../../changes/CHG-profile", revision = origin, base} = {}) {
	const fields = {
		type,
		title,
		"codewiki-origin": [origin],
		"codewiki-revision": revision,
	};
	if (base !== undefined) fields["codewiki-base"] = base;
	const result = decodeWikiMetadata(path, fields);
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	return result.value;
}

function profileFile(path, type, title, number, options = {}) {
	const itemMetadata = metadata(path, type, title, options);
	const body = options.body ?? `# ${title}\n\nMeaning for ${title}.\n`;
	const text = options.text ?? `---\n${JSON.stringify(itemMetadata.fields)}\n---\n${body}`;
	return Object.freeze({
		profile: WIKI_PROFILE_ID,
		path,
		blob: oid(number, options.algorithm ?? "sha1"),
		byteLength: UTF8.encode(text).byteLength,
		text,
		body,
		metadata: itemMetadata,
	});
}

function coreFiles(algorithm = "sha1") {
	return WIKI_CORE_TYPES.map((name, index) => profileFile(`.codewiki/wiki/types/${name}.md`, "TypeDefinition", name, index + 1, {algorithm}));
}

function source(files, commit, tree, algorithm = "sha1", extra = {}) {
	return {
		snapshot: snapshot(commit, tree, algorithm),
		files,
		...extra,
	};
}

function request(before, after, mappings, extra = {}) {
	return {
		profile: WIKI_PROFILE_ID,
		kernelBuildDigest: BUILD_DIGEST,
		responsibleChangePath: CHANGE_PATH,
		before,
		after,
		mappings,
		...extra,
	};
}

function endpoint(file) {
	return {path: file.path, blob: file.blob};
}

function mapping(kind, before, after) {
	return {kind, before: before.map(endpoint), after: after.map(endpoint)};
}

function revise(beforeFile, afterFile) {
	return mapping("revise", [beforeFile], [afterFile]);
}

function validRevision(path, type, title, number, options = {}) {
	return profileFile(path, type, title, number, {revision: "../../changes/CHG-profile", ...options});
}

function baseRevisionFixture({algorithm = "sha1", beforeFiles = coreFiles(algorithm), changed = true} = {}) {
	const afterFiles = [...beforeFiles];
	const beforeDefinition = beforeFiles[0];
	const afterDefinition = changed
		? validRevision(beforeDefinition.path, "TypeDefinition", "Definition", 101, {algorithm, body: "# Definition\n\nRevised meaning.\n"})
		: beforeDefinition;
	afterFiles[0] = afterDefinition;
	return {
		before: source(beforeFiles, 1, 2, algorithm),
		after: source(afterFiles, 3, 4, algorithm),
		beforeDefinition,
		afterDefinition,
	};
}

function assertFailure(result, code) {
	assert.equal(result.ok, false, result.ok ? "expected transaction rejection" : result.error.message);
	if (code !== undefined) assert.equal(result.error.code, code, result.error.message);
	assert.equal("value" in result, false);
	return result.error;
}

test("admits explicit revise transaction and returns detached immutable source/context data", () => {
	const fixture = baseRevisionFixture();
	const result = validateProfiledWikiTransaction(request(fixture.before, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)]));
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.equal(result.value.profile, WIKI_PROFILE_ID);
	assert.equal(result.value.before.snapshot.commit.hex, oid(1).hex);
	assert.equal(result.value.after.snapshot.commit.hex, oid(3).hex);
	assert.equal(result.value.mappings.length, 1);
	assert.equal(result.value.mappings[0].kind, "revise");
	assert.equal(result.value.potentialTypeImpacts.some((impact) => impact.item.path.endsWith("/Definition.md")), false);
	assert.equal(result.value.potentialTypeImpacts.length, WIKI_CORE_TYPES.length - 1);
	assert.equal(Object.isFrozen(result.value), true);
	assert.equal(Object.isFrozen(result.value.before), true);
	assert.equal(Object.isFrozen(result.value.before.files), true);
	assert.equal(Object.isFrozen(result.value.before.files[0]), true);
	assert.equal(Object.isFrozen(result.value.before.typeContext), true);
	assert.notStrictEqual(result.value.before.files, fixture.before.files);
	assert.notStrictEqual(result.value.before.files[0], fixture.before.files[0]);
	assert.notStrictEqual(result.value.before.snapshot, fixture.before.snapshot);
	assert.notStrictEqual(result.value.before.snapshot.commit, fixture.before.snapshot.commit);
	assert.equal(result.value.before.files.find((file) => file.path === fixture.before.files[0].path).path, fixture.before.files[0].path);
	assert.equal(result.value.before.snapshot.commit.hex, oid(1).hex);
	assert.notEqual(result.value.transactionDigest, BUILD_DIGEST);
});

test("accepts every explicit mapping shape and requires exact changed endpoint coverage", () => {
	const core = coreFiles();
	const addFile = validRevision(".codewiki/wiki/items/added.md", "Claim", "Added", 100);
	const addResult = validateProfiledWikiTransaction(request(
		source(core, 1, 2), source([...core, addFile], 3, 4), [mapping("add", [], [addFile])],
	));
	assert.equal(addResult.ok, true, addResult.ok ? "" : addResult.error.message);

	const retireFile = validRevision(".codewiki/wiki/items/retired.md", "Claim", "Retired", 101);
	const retireResult = validateProfiledWikiTransaction(request(
		source([...core, retireFile], 1, 2), source(core, 3, 4), [mapping("retire", [retireFile], [])],
	));
	assert.equal(retireResult.ok, true, retireResult.ok ? "" : retireResult.error.message);

	const oldRename = validRevision(".codewiki/wiki/items/old-name.md", "Claim", "OldName", 102);
	const newRename = validRevision(".codewiki/wiki/items/new-name.md", "Claim", "OldName", 102);
	const renameResult = validateProfiledWikiTransaction(request(
		source([...core, oldRename], 1, 2), source([...core, newRename], 3, 4), [mapping("rename", [oldRename], [newRename])],
	));
	assert.equal(renameResult.ok, true, renameResult.ok ? "" : renameResult.error.message);

	const oldSplit = validRevision(".codewiki/wiki/items/split.md", "Claim", "Split", 103);
	const splitLeft = validRevision(".codewiki/wiki/items/split-left.md", "Claim", "SplitLeft", 104);
	const splitRight = validRevision(".codewiki/wiki/items/split-right.md", "Claim", "SplitRight", 105);
	const splitResult = validateProfiledWikiTransaction(request(
		source([...core, oldSplit], 1, 2), source([...core, splitLeft, splitRight], 3, 4), [mapping("split", [oldSplit], [splitLeft, splitRight])],
	));
	assert.equal(splitResult.ok, true, splitResult.ok ? "" : splitResult.error.message);

	const mergeLeft = validRevision(".codewiki/wiki/items/merge-left.md", "Claim", "MergeLeft", 106);
	const mergeRight = validRevision(".codewiki/wiki/items/merge-right.md", "Claim", "MergeRight", 107);
	const merged = validRevision(".codewiki/wiki/items/merged.md", "Claim", "Merged", 108);
	const mergeResult = validateProfiledWikiTransaction(request(
		source([...core, mergeLeft, mergeRight], 1, 2), source([...core, merged], 3, 4), [mapping("merge", [mergeLeft, mergeRight], [merged])],
	));
	assert.equal(mergeResult.ok, true, mergeResult.ok ? "" : mergeResult.error.message);

	const incomplete = validateProfiledWikiTransaction(request(source(core, 1, 2), source([...core, addFile], 3, 4), []));
	assertFailure(incomplete, "incomplete_coverage");
});

test("rejects missing, duplicate, conflicting, no-op and malformed mappings", () => {
	const fixture = baseRevisionFixture();
	const valid = revise(fixture.beforeDefinition, fixture.afterDefinition);
	const missing = {...valid, before: [{path: fixture.beforeDefinition.path, blob: oid(999)}]};
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after, [missing])), "identity_mismatch");
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after, [valid, valid])), "duplicate_endpoint");
	const conflicting = {...valid, before: [{path: fixture.beforeDefinition.path, blob: oid(999)}]};
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after, [conflicting])), "identity_mismatch");
	const noop = mapping("revise", [fixture.before.files[1]], [fixture.after.files[1]]);
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after, [noop, valid])), "no_op_mapping");
	for (const kind of PROFILED_WIKI_MAPPING_KINDS) {
		const malformed = mapping(kind, [fixture.beforeDefinition], [fixture.afterDefinition]);
		if (kind === "revise") continue;
		assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after, [malformed])), "mapping_cardinality");
	}
	const sparse = [];
	sparse.length = 1;
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after, sparse)), "invalid_mapping");
});

test("rejects scope, identity, incomplete snapshot, profile and build failures before admission", () => {
	const fixture = baseRevisionFixture();
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)], {
		profile: "codewiki.other-profile",
	})), "invalid_profile");
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)], {
		kernelBuildDigest: "sha1:bad",
	})), "invalid_kernel_build");
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)], {
		responsibleChangePath: "../changes/CHG-profile",
	})), "invalid_input");
	const incomplete = {...fixture.before.snapshot, complete: false};
	assertFailure(validateProfiledWikiTransaction(request(source(fixture.before.files, 1, 2), fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)], {
		before: {snapshot: incomplete, files: fixture.before.files},
	})), "invalid_snapshot");
	const otherRepository = createProjectSnapshot({
		repositoryId: "cw:repository:other",
		objectFormat: "sha1",
		commit: oid(10), tree: oid(11), parents: [], complete: true,
	});
	assert.equal(otherRepository.ok, true);
	assertFailure(validateProfiledWikiTransaction(request(
		{snapshot: otherRepository.value, files: fixture.before.files}, fixture.after,
		[revise(fixture.beforeDefinition, fixture.afterDefinition)],
	)), "incompatible_snapshot");
});

test("preserves exact UTF-8/reference spelling while ordinary lineage compares normalized targets", () => {
	const before = coreFiles();
	const oldFile = profileFile(".codewiki/wiki/items/cafe.md", "Claim", "Cafe\u0301", 200, {
		origin: "./../../changes/lineage",
		revision: "../../changes/CHG-profile",
		body: "# Cafe\u0301\n\nExact old text.\n",
	});
	const newFile = profileFile(".codewiki/wiki/items/cafe.md", "Claim", "Cafe\u0301", 201, {
		origin: "../../changes/lineage",
		revision: "./../../changes/CHG-profile",
		body: "# Cafe\u0301\n\nExact new text.\n",
	});
	const result = validateProfiledWikiTransaction(request(
		source([...before, oldFile], 1, 2), source([...before, newFile], 3, 4), [revise(oldFile, newFile)],
	));
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	const admitted = result.value.after.files.find((file) => file.path.endsWith("/cafe.md"));
	assert.ok(admitted);
	assert.equal(admitted.metadata.title, "Cafe\u0301");
	assert.equal(admitted.metadata.origins[0].reference, "../../changes/lineage");
	assert.equal(admitted.metadata.revision.reference, "./../../changes/CHG-profile");
	assert.equal(admitted.body, "# Cafe\u0301\n\nExact new text.\n");
	const conflictingText = profileFile(".codewiki/wiki/items/other.md", "Claim", "Other", 200, {
		origin: "./../../changes/lineage",
		revision: "../../changes/CHG-profile",
		body: "# Other\n\nDifferent bytes with same claimed blob.\n",
	});
	const conflict = validateProfiledWikiTransaction(request(
		source([...before, oldFile], 1, 2), source([...before, conflictingText], 3, 4), [mapping("rename", [oldFile], [conflictingText])],
	));
	assertFailure(conflict, "identity_mismatch");
});

test("rejects hostile accessors, custom iteration and sparse source collections without invocation", () => {
	const fixture = baseRevisionFixture();
	let invoked = 0;
	const accessorSource = {snapshot: fixture.before.snapshot, files: fixture.before.files};
	Object.defineProperty(accessorSource, "files", {enumerable: true, get() { invoked += 1; return fixture.before.files; }});
	assertFailure(validateProfiledWikiTransaction(request(accessorSource, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)])), "invalid_input");
	const iterableFiles = [...fixture.before.files];
	iterableFiles[Symbol.iterator] = function* () { invoked += 1; yield* fixture.before.files; };
	assertFailure(validateProfiledWikiTransaction(request({snapshot: fixture.before.snapshot, files: iterableFiles}, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)])), "invalid_files");
	const sparseFiles = [...fixture.before.files];
	delete sparseFiles[0];
	assertFailure(validateProfiledWikiTransaction(request({snapshot: fixture.before.snapshot, files: sparseFiles}, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)])), "invalid_files");
	assert.equal(invoked, 0);
});

test("recomputes type contexts and labels conservative type-catalogue impacts", () => {
	const core = coreFiles();
	const customBefore = profileFile(".codewiki/wiki/types/FieldObservation.md", "TypeDefinition", "FieldObservation", 300, {base: "Claim"});
	const customAfter = profileFile(".codewiki/wiki/types/FieldObservation.md", "TypeDefinition", "FieldObservation", 301, {base: "Entity"});
	const instance = profileFile(".codewiki/wiki/items/observation.md", "FieldObservation", "Observation", 302);
	const result = validateProfiledWikiTransaction(request(
		source([...core, customBefore, instance], 1, 2), source([...core, customAfter, instance], 3, 4), [revise(customBefore, customAfter)],
	));
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	const impact = result.value.potentialTypeImpacts.find((entry) => entry.item.path === instance.path);
	assert.ok(impact);
	assert.equal(impact.kind, "potential_type_impact");
	assert.equal(impact.type, "FieldObservation");
	assert.equal(impact.definitionBefore.blob.hex, customBefore.blob.hex);
	assert.equal(impact.definitionAfter.blob.hex, customAfter.blob.hex);
	const forged = request(
		source([...core, customBefore, instance], 1, 2, "sha1", {typeContext: {profile: "forged"}}),
		source([...core, customAfter, instance], 3, 4, "sha1", {typeContext: {profile: "forged"}}),
		[revise(customBefore, customAfter)],
	);
	const recomputed = validateProfiledWikiTransaction(forged);
	assert.equal(recomputed.ok, true, recomputed.ok ? "" : recomputed.error.message);
	assert.deepEqual(recomputed.value.after.typeContext, result.value.after.typeContext);
});

test("canonical ordering and every digest subject are deterministic", () => {
	const fixture = baseRevisionFixture();
	const normal = validateProfiledWikiTransaction(request(fixture.before, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)]));
	const reversed = validateProfiledWikiTransaction(request(
		source([...fixture.before.files].reverse(), 1, 2),
		source([...fixture.after.files].reverse(), 3, 4),
		[{kind: "revise", before: [{blob: fixture.beforeDefinition.blob, path: fixture.beforeDefinition.path}], after: [{blob: fixture.afterDefinition.blob, path: fixture.afterDefinition.path}]}],
	));
	assert.equal(normal.ok, true);
	assert.equal(reversed.ok, true);
	assert.equal(reversed.value.transactionDigest, normal.value.transactionDigest);

	const changedBuild = validateProfiledWikiTransaction(request(fixture.before, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)], {
		kernelBuildDigest: `sha256:${"b".repeat(64)}`,
	}));
	assert.equal(changedBuild.ok, true);
	assert.notEqual(changedBuild.value.transactionDigest, normal.value.transactionDigest);

	const changedSnapshot = validateProfiledWikiTransaction(request(
		source(fixture.before.files, 7, 8), fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)],
	));
	assert.equal(changedSnapshot.ok, true);
	assert.notEqual(changedSnapshot.value.transactionDigest, normal.value.transactionDigest);
});

function resnapshot(value, overrides) {
	const {protocol, snapshotDigest, ...body} = value;
	const result = createProjectSnapshot({...body, ...overrides});
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	return result.value;
}

test("cross-checks claimed commits/trees and admits a genuine empty Wiki delta", () => {
	const fixture = baseRevisionFixture();
	const mappings = [revise(fixture.beforeDefinition, fixture.afterDefinition)];
	for (const overrides of [{commit: fixture.before.snapshot.commit}, {tree: fixture.before.snapshot.tree}]) {
		assertFailure(validateProfiledWikiTransaction(request(fixture.before,
			{...fixture.after, snapshot: resnapshot(fixture.after.snapshot, overrides)}, mappings)), "identity_mismatch");
	}
	const unchanged = {...fixture.before, snapshot: resnapshot(fixture.before.snapshot, {commit: oid(30)})};
	assert.equal(validateProfiledWikiTransaction(request(fixture.before, unchanged, [])).ok, true);
	const alteredParents = {...fixture.before, snapshot: resnapshot(fixture.before.snapshot, {parents: [oid(31)]})};
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, alteredParents, [])), "identity_mismatch");
	const incomplete = {...fixture.before, snapshot: resnapshot(fixture.before.snapshot, {complete: false})};
	assertFailure(validateProfiledWikiTransaction(request(incomplete, fixture.after, mappings)), "incomplete_snapshot");
	const sha256 = baseRevisionFixture({algorithm: "sha256"});
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, sha256.after, mappings)), "incompatible_snapshot");
});

test("admission caps aggregate endpoints before inspecting overflow endpoint data", () => {
	const fixture = baseRevisionFixture();
	let inspected = 0;
	const hostile = new Proxy({}, {getPrototypeOf() { inspected += 1; throw new Error("must not inspect"); }});
	for (const side of ["before", "after"]) {
		const other = side === "before" ? "after" : "before";
		const mappings = [
			{kind: "split", [side]: Array.from({length: PROFILED_WIKI_TRANSACTION_LIMITS.endpointsPerSide}, () => endpoint(fixture.beforeDefinition)), [other]: []},
			{kind: "split", [side]: [hostile], [other]: []},
		];
		assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after, mappings)), "invalid_mapping");
	}
	assert.equal(inspected, 0);
	assertFailure(validateProfiledWikiTransaction(request(fixture.before, fixture.after,
		new Array(PROFILED_WIKI_TRANSACTION_LIMITS.mappings + 1))), "invalid_mapping");
	assertFailure(validateProfiledWikiTransaction(request({...fixture.before, files: new Array(WIKI_PROFILE_LIMITS.files + 1)}, fixture.after, [])), "invalid_files");
	const oversized = {...fixture.before.files[0], byteLength: WIKI_PROFILE_LIMITS.fileBytes + 1};
	assertFailure(validateProfiledWikiTransaction(request({...fixture.before, files: [oversized, ...fixture.before.files.slice(1)]}, fixture.after, [])));
});

test("maximum file, mapping and aggregate endpoint counts are inclusive", () => {
	const beforeFiles = [...coreFiles(), ...Array.from({length: WIKI_PROFILE_LIMITS.files - WIKI_CORE_TYPES.length}, (_, index) =>
		profileFile(`.codewiki/wiki/items/item-${index}.md`, "Claim", `Item${index}`, 1000 + index))];
	const afterFiles = beforeFiles.map((file, index) => profileFile(file.path, file.metadata.type, file.metadata.title, 2000 + index,
		{body: `${file.body}\nRevised.\n`}));
	const mappings = [...beforeFiles.map((file) => mapping("retire", [file], [])), ...afterFiles.map((file) => mapping("add", [], [file]))];
	assert.equal(mappings.length, PROFILED_WIKI_TRANSACTION_LIMITS.mappings);
	const result = validateProfiledWikiTransaction(request(source(beforeFiles, 1, 2), source(afterFiles, 3, 4), mappings));
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.equal(result.value.mappings.length, mappings.length);
});

test("lineage failures, cross-directory rename and undeclared retirement are explicit", () => {
	const core = coreFiles();
	const oldFile = profileFile(".codewiki/wiki/items/old.md", "Claim", "Old", 500);
	const moved = profileFile(".codewiki/wiki/items/deep/new.md", "Claim", "Old", 501,
		{origin: "../../../changes/CHG-profile", revision: "./../../../changes/CHG-profile"});
	const movedResult = validateProfiledWikiTransaction(request(source([...core, oldFile], 1, 2),
		source([...core, moved], 3, 4), [mapping("rename", [oldFile], [moved])]));
	assert.equal(movedResult.ok, true, movedResult.ok ? "" : movedResult.error.message);
	assert.equal(movedResult.value.after.files.find((file) => file.path === moved.path).metadata.revision.reference, "./../../../changes/CHG-profile");
	for (const [options, code] of [[{origin: "../../changes/other", revision: "../../changes/CHG-profile"}, "lineage_mismatch"],
		[{revision: "../../changes/other"}, "revision_mismatch"]]) {
		const next = profileFile(oldFile.path, "Claim", "Old", 502, options);
		assertFailure(validateProfiledWikiTransaction(request(source([...core, oldFile], 1, 2),
			source([...core, next], 3, 4), [revise(oldFile, next)])), code);
	}
	assertFailure(validateProfiledWikiTransaction(request(source([...core, oldFile], 1, 2), source(core, 3, 4), [])), "incomplete_coverage");
	assertFailure(validateProfiledWikiTransaction(request(source([...core, oldFile], 1, 2), source([...core, moved], 3, 4), [revise(oldFile, moved)])), "mapping_cardinality");
});

test("bad subjects and nested accessors fail without invoking getters", () => {
	const fixture = baseRevisionFixture();
	const base = request(fixture.before, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)]);
	for (const path of [".codewiki/changes/bad\npath", ".codewiki/changes/\uFEFFbad", ".codewiki/changes/a/../b", ".codewiki/changes/"]) {
		assertFailure(validateProfiledWikiTransaction({...base, responsibleChangePath: path}), "invalid_input");
	}
	for (const [subject, code] of [[{path: ".codewiki/wiki/missing.md", blob: oid(1)}, "missing_endpoint"],
		[{path: "docs/raw.md", blob: oid(1)}, "invalid_endpoint"],
		[{path: fixture.beforeDefinition.path, blob: oid(1, "sha256")}, "identity_mismatch"]]) {
		const kind = subject.path === fixture.beforeDefinition.path ? "revise" : "rename";
		assertFailure(validateProfiledWikiTransaction({...base, mappings: [{...base.mappings[0], kind, before: [subject]}]}), code);
	}
	let invoked = 0;
	for (const field of ["profile", "before", "mappings"]) {
		const input = {...base};
		Object.defineProperty(input, field, {enumerable: true, get() { invoked += 1; throw new Error("getter"); }});
		assertFailure(validateProfiledWikiTransaction(input), "invalid_input");
	}
	const input = structuredClone(base);
	Object.defineProperty(input.mappings[0].after[0], "blob", {enumerable: true, get() { invoked += 1; throw new Error("getter"); }});
	assertFailure(validateProfiledWikiTransaction(input), "invalid_endpoint");
	assert.equal(invoked, 0);
});

test("all returned levels are frozen and independent of subsequent caller mutation", () => {
	const fixture = baseRevisionFixture();
	const input = structuredClone(request(fixture.before, fixture.after, [revise(fixture.beforeDefinition, fixture.afterDefinition)]));
	const result = validateProfiledWikiTransaction(input);
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	const serialized = JSON.stringify(result.value);
	input.before.files[0].metadata.fields.title = "Changed";
	input.before.files[0].blob.hex = "0".repeat(40);
	input.after.snapshot.parents.push(oid(99));
	input.mappings[0].after[0].path = "elsewhere";
	input.after.files.length = 0;
	assert.equal(JSON.stringify(result.value), serialized);
	function checkFrozen(value) {
		if (value === null || typeof value !== "object") return;
		assert.equal(Object.isFrozen(value), true);
		for (const child of Object.values(value)) checkFrozen(child);
	}
	checkFrozen(result.value);
});

test("digest binds mapping grouping, exact path bytes, responsible Change and blob subjects", () => {
	const core = coreFiles();
	const left = profileFile(".codewiki/wiki/items/left.md", "Claim", "Left", 600);
	const right = profileFile(".codewiki/wiki/items/right.md", "Claim", "Right", 601);
	const merged = profileFile(".codewiki/wiki/items/merged.md", "Claim", "Merged", 602);
	const before = source([...core, left, right], 1, 2);
	const after = source([...core, merged], 3, 4);
	const combined = validateProfiledWikiTransaction(request(before, after, [mapping("merge", [right, left], [merged])]));
	const sorted = validateProfiledWikiTransaction(request(before, after, [mapping("merge", [left, right], [merged])]));
	const separate = validateProfiledWikiTransaction(request(before, after, [mapping("retire", [left], []), mapping("retire", [right], []), mapping("add", [], [merged])]));
	const reversed = validateProfiledWikiTransaction(request(before, after, [mapping("add", [], [merged]), mapping("retire", [right], []), mapping("retire", [left], [])]));
	for (const result of [combined, sorted, separate, reversed]) assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.deepEqual(sorted.value, combined.value);
	assert.deepEqual(reversed.value, separate.value);
	assert.notEqual(separate.value.transactionDigest, combined.value.transactionDigest);
	const digests = [];
	for (const spelling of ["café", "cafe\u0301"]) {
		const file = profileFile(`.codewiki/wiki/items/${spelling}.md`, "Claim", "Same", 610);
		const result = validateProfiledWikiTransaction(request(source([...core, file], 1, 2), source([...core, file], 3, 4), []));
		assert.equal(result.ok, true, result.ok ? "" : result.error.message);
		digests.push(result.value.transactionDigest);
	}
	assert.notEqual(digests[0], digests[1]);
	const empty = request(source(core, 1, 2), source(core, 3, 4), []);
	const original = validateProfiledWikiTransaction(empty);
	const changed = validateProfiledWikiTransaction({...empty, responsibleChangePath: ".codewiki/changes/another"});
	assert.equal(changed.ok, true);
	assert.notEqual(changed.value.transactionDigest, original.value.transactionDigest);
	const differentBlob = {...merged, blob: oid(603)};
	const altered = validateProfiledWikiTransaction(request(before, source([...core, differentBlob], 3, 4), [mapping("merge", [left, right], [differentBlob])]));
	assert.equal(altered.ok, true);
	assert.notEqual(altered.value.transactionDigest, combined.value.transactionDigest);
});

test("same claimed blob cannot carry different text bytes", () => {
	const core = coreFiles();
	const before = profileFile(".codewiki/wiki/items/item.md", "Claim", "Item", 400, {body: "# Item\n\nBefore.\n"});
	const after = profileFile(".codewiki/wiki/items/item.md", "Claim", "Item", 400, {body: "# Item\n\nAfter.\n"});
	const result = validateProfiledWikiTransaction(request(
		source([...core, before], 1, 2), source([...core, after], 3, 4), [mapping("revise", [before], [after])],
	));
	assertFailure(result, "identity_mismatch");
});
