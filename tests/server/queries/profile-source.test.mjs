import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {promisify} from "node:util";
import test from "node:test";

import {createGitProjectStore} from "../../../src/adapters/git/project-store.ts";
import {decodeGitOid, decodeGitRef} from "../../../src/kernel/identity/git.ts";
import {createProjectSnapshot} from "../../../src/kernel/changes/snapshot.ts";
import {failure, success} from "../../../src/kernel/data-contracts/outcome.ts";
import {WIKI_CORE_TYPES, WIKI_PROFILE_ID, WIKI_PROFILE_LIMITS} from "../../../src/kernel/wiki/profile.ts";
import {validateProfiledWikiTransaction} from "../../../src/kernel/wiki/profile-transaction.ts";
import {loadProfiledWikiSource} from "../../../src/server/queries/profile-source.ts";

const execFileAsync = promisify(execFile);
const UTF8 = new TextEncoder();
const REPOSITORY_ID = "cw:repository:profile-source-test";
const BUILD_DIGEST = `sha256:${"a".repeat(64)}`;
const CHANGE = "CHG-profile";

function config(objectFormat) {
	const ref = decodeGitRef("refs/heads/main");
	assert.equal(ref.ok, true, ref.ok ? "" : ref.error.message);
	return Object.freeze({
		projectName: "Profile Source Test",
		repositoryId: REPOSITORY_ID,
		objectFormat,
		canonicalRef: ref.value,
		kernelBuildDigest: BUILD_DIGEST,
		retiredWikiItemIds: Object.freeze([]),
		limits: Object.freeze({
			maximumWikiItems: 64,
			maximumWikiFileBytes: 2 * 1024 * 1024,
			maximumWikiTotalBytes: 16 * 1024 * 1024,
			maximumChangeTraces: 64,
			maximumTraceBytes: 64 * 1024,
			maximumHistoryCommits: 16,
			maximumHistoryBytes: 512 * 1024,
		}),
	});
}

function materialLimits(overrides = {}) {
	return Object.freeze({
		maximumEntries: 1024,
		maximumPathBytes: 16 * 1024,
		maximumDocuments: 1024,
		maximumDocumentBytes: 2 * 1024 * 1024,
		maximumTotalBytes: 16 * 1024 * 1024,
		...overrides,
	});
}

function oid(number, algorithm = "sha1") {
	const width = algorithm === "sha1" ? 40 : 64;
	const result = decodeGitOid({algorithm, hex: Number(number).toString(16).padStart(width, "0")});
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	return result.value;
}

function oidHex(algorithm, hex) {
	const result = decodeGitOid({algorithm, hex});
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	return result.value;
}

function profileText({type, title, base, body = `Meaning for ${title}.`, change = CHANGE, reference = "../../changes"}) {
	const baseLine = base === undefined ? "" : `codewiki-base: ${base}\n`;
	return `---\ntype: ${type}\ntitle: ${title}\ncodewiki-origin:\n  - ${reference}/${change}\ncodewiki-revision: ${reference}/${change}\n${baseLine}---\n# ${title}\n\n${body}\n`;
}

function profileDocument(path, type, title, number, options = {}) {
	const text = profileText({type, title, ...options});
	return Object.freeze({
		path,
		mode: options.mode ?? "100644",
		oid: options.oid ?? oid(number, options.algorithm ?? "sha1"),
		bytes: UTF8.encode(text),
	});
}

function coreDocuments(algorithm = "sha1") {
	const documents = WIKI_CORE_TYPES.map((title, index) => profileDocument(
		`.codewiki/wiki/types/${title}.md`,
		"TypeDefinition",
		title,
		index + 10,
		{algorithm},
	));
	documents.push(profileDocument(
		".codewiki/wiki/types/FieldObservation.md",
		"TypeDefinition",
		"FieldObservation",
		20,
		{algorithm, base: "Claim", body: "A specialized field observation."},
	));
	documents.push(profileDocument(
		".codewiki/wiki/fieldwork/cafe.md",
		"FieldObservation",
		"Cafe\u0301",
		21,
		{algorithm, body: "Exact decomposed Cafe\u0301 body."},
	));
	return documents;
}

function entry(document) {
	return Object.freeze({path: document.path, mode: document.mode, kind: "blob", oid: document.oid});
}

function textBytes(text) {
	return UTF8.encode(text);
}

function expectFailure(result, code) {
	assert.equal(result.ok, false, result.ok ? "expected failure" : result.error.message);
	if (code !== undefined) assert.equal(result.error.code, code, result.error.message);
	assert.equal("value" in result, false, "failed profile read must not expose partial output");
	return result.error;
}

function assertReadOnly(state) {
	assert.deepEqual(state.effects, []);
}

function fakeStore({
	documents = coreDocuments(),
	algorithm = "sha1",
	snapshotFailure = null,
	treeFailure = null,
	blobFailure = null,
	snapshotChanges = {},
	treeCommit = null,
	blobOid = null,
	ignoreCaps = false,
} = {}) {
	const commit = oid(1, algorithm);
	const tree = oid(2, algorithm);
	const created = createProjectSnapshot({
		repositoryId: REPOSITORY_ID,
		objectFormat: algorithm,
		commit,
		tree,
		parents: [],
		complete: true,
	});
	assert.equal(created.ok, true, created.ok ? "" : created.error.message);
	const state = {
		protocol: "codewiki.project-store/1.0.0",
		snapshotReads: [],
		treeReads: [],
		blobReads: [],
		effects: [],
		async readSnapshot(request) {
			state.snapshotReads.push(request);
			if (snapshotFailure) return failure(snapshotFailure);
			return success(Object.freeze({...created.value, ...snapshotChanges}));
		},
		async readTree(request) {
			state.treeReads.push(request);
			if (treeFailure) return failure(treeFailure);
			return success(Object.freeze({commit: treeCommit ?? request.commit, entries: Object.freeze(documents.map(entry))}));
		},
		async readBlob(request) {
			state.blobReads.push(request);
			if (blobFailure) return failure(blobFailure);
			const document = documents.find((value) => value.path === request.path);
			if (!document) return failure(issue("not_found", "read_blob", "missing fixture blob"));
			if (!ignoreCaps && document.bytes.byteLength > request.maximumBytes) {
				return failure(issue("limit_exceeded", "read_blob", "fixture blob exceeds requested cap"));
			}
			return success(Object.freeze({
				oid: blobOid ?? document.oid,
				bytes: document.bytes,
			}));
		},
		async writeBlob() {
			state.effects.push("writeBlob");
			throw new Error("writeBlob must not be called by profile source query");
		},
		async writeTree() {
			state.effects.push("writeTree");
			throw new Error("writeTree must not be called by profile source query");
		},
		async createCommit() {
			state.effects.push("createCommit");
			throw new Error("createCommit must not be called by profile source query");
		},
		async compareAndSwapRefs() {
			state.effects.push("compareAndSwapRefs");
			throw new Error("compareAndSwapRefs must not be called by profile source query");
		},
	};
	return state;
}

function issue(code, operation, message) {
	return Object.freeze({code, operation, message});
}

async function fixtureGit(root, args) {
	const env = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined && !key.startsWith("GIT_")) env[key] = value;
	}
	env.GIT_CONFIG_GLOBAL = "/dev/null";
	env.GIT_CONFIG_SYSTEM = "/dev/null";
	const {stdout} = await execFileAsync("git", [
		"-c", "core.hooksPath=/dev/null",
		"-c", "commit.gpgsign=false",
		"-c", "gc.auto=0",
		...args,
	], {cwd: root, env});
	return stdout.trim();
}

async function writeFixtureFiles(root, documents, extras = {}) {
	for (const [path, text] of Object.entries(extras)) {
		await mkdir(dirname(join(root, path)), {recursive: true});
		await writeFile(join(root, path), text);
	}
	for (const document of documents) {
		await mkdir(dirname(join(root, document.path)), {recursive: true});
		await writeFile(join(root, document.path), document.bytes);
	}
}

async function commitFixture(root, documents, extras, message) {
	await writeFixtureFiles(root, documents, extras);
	await fixtureGit(root, ["add", "--all"]);
	await fixtureGit(root, ["commit", "-q", "--no-verify", "-m", message]);
	return fixtureGit(root, ["rev-parse", "HEAD"]);
}

async function nativeRepository(algorithm) {
	const root = await mkdtemp(join(tmpdir(), "codewiki-profile-source-"));
	await mkdir(root, {recursive: true});
	await fixtureGit(root, ["init", "-q", "-b", "main", `--object-format=${algorithm}`]);
	await fixtureGit(root, ["config", "user.name", "Profile Fixture"]);
	await fixtureGit(root, ["config", "user.email", "profile@example.invalid"]);
	const initial = coreDocuments(algorithm);
	const oldCommitHex = await commitFixture(root, initial, {
		"docs/raw.md": "This is deliberately not a managed profile.\n",
		"README.md": "\uFEFFraw\r\n",
	}, "profile baseline");
	const newDefinition = profileDocument(
		".codewiki/wiki/types/Definition.md",
		"TypeDefinition",
		"Definition",
		10,
		{algorithm, body: "Updated exact Definition meaning."},
	);
	const newCustomDefinition = profileDocument(
		".codewiki/wiki/types/FieldObservation.md", "TypeDefinition", "FieldObservation", 20,
		{algorithm, base: "Entity", body: "Revised field observation classification."},
	);
	const newCommitHex = await commitFixture(root, [newDefinition, newCustomDefinition], {}, "profile revision");
	await fixtureGit(root, ["update-ref", `refs/codewiki/changes/${CHANGE}`, oldCommitHex]);
	await fixtureGit(root, ["update-ref", "refs/codewiki/changes/CHG-profile-new", newCommitHex]);
	const made = createGitProjectStore({repositoryRoot: root, repositoryId: REPOSITORY_ID});
	assert.equal(made.ok, true, made.ok ? "" : made.error.message);
	return {
		root,
		store: made.value,
		oldCommit: oidHex(algorithm, oldCommitHex),
		newCommit: oidHex(algorithm, newCommitHex),
	};
}

async function runProfile(store, source, objectFormat = "sha1", limits = materialLimits(), profile = WIKI_PROFILE_ID) {
	return loadProfiledWikiSource(store, config(objectFormat), source, profile, limits);
}

test("explicit profile gate performs zero Store I/O and query remains read-only", async () => {
	const store = fakeStore();
	const rejected = expectFailure(await runProfile(store, {kind: "canonical"}, "sha1", materialLimits(), "codewiki.legacy@1.0.0"), "unsupported_profile");
	assert.equal(rejected.operation, "admit_profile");
	assert.equal(rejected.cause.kind, "profile");
	assert.equal(rejected.cause.profile.code, "unsupported_profile");
	assert.deepEqual(store.snapshotReads, []);
	assert.deepEqual(store.treeReads, []);
	assert.deepEqual(store.blobReads, []);
	assertReadOnly(store);
});

test("profile source admits all core/custom files, preserves passive corpus and exact Unicode", async () => {
	const documents = coreDocuments();
	documents.push(Object.freeze({path: "docs/raw.md", mode: "100644", oid: oid(90), bytes: textBytes("not a profile\r\n\uFEFF") }));
	documents.push(Object.freeze({path: "README.md", mode: "100644", oid: oid(91), bytes: textBytes("\uFEFFraw\r\n") }));
	const store = fakeStore({documents});
	const result = await runProfile(store, {kind: "canonical"});
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.equal(result.value.managedFiles.length, 8);
	assert.equal(result.value.typeContext.bindings.length, 8);
	assert.equal(Object.isFrozen(result.value), true);
	assert.equal(Object.isFrozen(result.value.managedFiles), true);
	assert.equal(Object.isFrozen(result.value.typeContext), true);
	assert.deepEqual(result.value.corpus.documents.filter((item) => item.path === "docs/raw.md").map((item) => item.text), ["not a profile\r\n\uFEFF"]);
	const item = result.value.managedFiles.find((file) => file.path.endsWith("/cafe.md"));
	assert.ok(item);
	assert.equal(item.metadata.title, "Cafe\u0301");
	assert.equal(item.body, "# Cafe\u0301\n\nExact decomposed Cafe\u0301 body.\n");
	assert.equal(item.text.includes("Cafe\u0301"), true);
	assert.equal(item.metadata.origins[0].reference, "../../changes/CHG-profile");
	assert.equal(item.metadata.revision.reference, "../../changes/CHG-profile");
	const binding = result.value.typeContext.bindings.find((value) => value.item.path.endsWith("/cafe.md"));
	assert.ok(binding);
	assert.deepEqual(binding.item.blob, item.blob);
	assert.equal(binding.definition.path, ".codewiki/wiki/types/FieldObservation.md");
	assert.equal(result.value.snapshot.commit.hex, `${"0".repeat(39)}1`);
	assert.equal(result.value.typeContext.snapshot.hex, result.value.snapshot.commit.hex);
	assert.equal(store.snapshotReads.length, 1);
	assert.equal(store.treeReads.length, 1);
	assert.equal(store.treeReads[0].pathPrefix, "");
	assert.equal(store.blobReads.length, documents.length);
	for (const request of [...store.treeReads, ...store.blobReads]) assert.deepEqual(request.commit, result.value.snapshot.commit);
	assertReadOnly(store);
});

test("material failures retain exact causes and source is resolved once", async () => {
	const cases = [
		["snapshotFailure", "read_snapshot", "command_failed"],
		["treeFailure", "read_tree", "timeout"],
		["blobFailure", "read_blob", "not_found"],
	];
	for (const [option, operation, code] of cases) {
		const cause = issue(code, operation, "opaque fixture failure");
		const store = fakeStore({[option]: cause});
		const error = expectFailure(await runProfile(store, {kind: "canonical"}), code === "not_found" ? "source_not_found" : "invalid_project_state");
		assert.equal(error.cause.kind, "material");
		assert.strictEqual(error.cause.material.cause.kind, operation === "read_snapshot" ? "source_resolution" : "store_failure");
		const retained = operation === "read_snapshot" ? error.cause.material.cause.failure.store : error.cause.material.cause.store;
		assert.strictEqual(retained, cause);
		assert.equal(store.snapshotReads.length, 1);
		assert.equal(store.treeReads.length, operation === "read_snapshot" ? 0 : 1);
		assert.equal(store.blobReads.length, operation === "read_blob" ? 1 : 0);
		assertReadOnly(store);
	}
});

test("snapshot, tree, blob and mixed-object identities fail closed", async () => {
	const snapshotVariants = [
		{repositoryId: "cw:repository:other"},
		{objectFormat: "sha256"},
		{complete: false},
		{commit: oid(9)},
	];
	for (const changes of snapshotVariants) {
		const store = fakeStore({snapshotChanges: changes});
		const error = expectFailure(await runProfile(store, {kind: "commit", commit: oid(1)}), "source_stale");
		assert.equal(error.cause.kind, "material");
		assert.equal(store.treeReads.length, 0);
	}
	const changedTree = fakeStore({snapshotChanges: {tree: oid(8)}});
	const changedTreeResult = await runProfile(changedTree, {kind: "commit", commit: oid(1)});
	assert.equal(changedTreeResult.ok, true, changedTreeResult.ok ? "" : changedTreeResult.error.message);
	assert.equal(changedTreeResult.value.snapshot.tree.hex, oid(8).hex);
	const treeStore = fakeStore({treeCommit: oid(4)});
	const treeError = expectFailure(await runProfile(treeStore, {kind: "canonical"}), "source_stale");
	assert.deepEqual(treeError.cause.material.cause, {kind: "material_binding", check: "tree_commit"});
	assert.equal(treeStore.blobReads.length, 0);
	const blobStore = fakeStore({blobOid: oid(5)});
	const blobError = expectFailure(await runProfile(blobStore, {kind: "canonical"}), "source_stale");
	assert.equal(blobError.cause.material.cause.kind, "material_binding");
	assert.equal(blobError.cause.material.cause.check, "blob_oid");
	const mixed = coreDocuments();
	mixed[0] = profileDocument(mixed[0].path, "TypeDefinition", "Definition", 10, {algorithm: "sha256"});
	const mixedStore = fakeStore({documents: mixed});
	const mixedError = expectFailure(await runProfile(mixedStore, {kind: "canonical"}), "invalid_project_state");
	assert.equal(mixedError.cause.kind, "material");
	assert.equal(mixedError.cause.material.cause.kind, "corpus_failure");
	assert.equal(mixedError.cause.material.cause.corpus.code, "invalid_oid");
});

test("profile decoder and type binding reject malformed, missing, duplicate and unknown definitions", async () => {
	const malformed = coreDocuments();
	malformed[0] = Object.freeze({...malformed[0], bytes: textBytes("not frontmatter\n")});
	const malformedError = expectFailure(await runProfile(fakeStore({documents: malformed}), {kind: "canonical"}), "invalid_yaml");
	assert.equal(malformedError.cause.kind, "profile");
	assert.equal(malformedError.cause.profile.path, malformed[0].path);

	const missing = coreDocuments().filter((document) => !document.path.endsWith("/Entity.md"));
	const missingError = expectFailure(await runProfile(fakeStore({documents: missing}), {kind: "canonical"}), "unresolved_type");
	assert.equal(missingError.cause.kind, "binding");
	assert.equal(missingError.cause.binding.code, "unresolved_type");

	const duplicate = coreDocuments();
	duplicate.push(profileDocument(".codewiki/wiki/types/Definition-copy.md", "TypeDefinition", "Definition", 60));
	const duplicateError = expectFailure(await runProfile(fakeStore({documents: duplicate}), {kind: "canonical"}), "invalid_type");
	assert.equal(duplicateError.cause.kind, "binding");

	const duplicateCustom = coreDocuments();
	duplicateCustom.push(profileDocument(".codewiki/wiki/types/FieldObservation-copy.md", "TypeDefinition", "FieldObservation", 62, {base: "Claim"}));
	const duplicateCustomError = expectFailure(await runProfile(fakeStore({documents: duplicateCustom}), {kind: "canonical"}), "invalid_type");
	assert.equal(duplicateCustomError.cause.kind, "binding");

	const unknown = coreDocuments();
	unknown.push(profileDocument(".codewiki/wiki/unknown/unknown.md", "UnknownType", "Unknown", 61));
	const unknownError = expectFailure(await runProfile(fakeStore({documents: unknown}), {kind: "canonical"}), "unresolved_type");
	assert.equal(unknownError.cause.kind, "binding");

	const executable = coreDocuments();
	executable[0] = Object.freeze({...executable[0], mode: "100755"});
	const executableStore = fakeStore({documents: executable});
	const executableError = expectFailure(await runProfile(executableStore, {kind: "canonical"}), "invalid_file");
	assert.equal(executableError.cause.kind, "profile");
	assertReadOnly(executableStore);
});

test("managed budgets preflight count, actual file bytes and aggregate context before parsing", async () => {
	const tooMany = Array.from({length: WIKI_PROFILE_LIMITS.files + 1}, (_, index) => Object.freeze({
		path: `.codewiki/wiki/items/${index}.md`,
		mode: "100644",
		oid: oid(index + 100),
		bytes: new Uint8Array(),
	}));
	const countStore = fakeStore({documents: tooMany});
	const countError = expectFailure(await runProfile(countStore, {kind: "canonical"}), "limit_exceeded");
	assert.equal(countError.cause.kind, "budget");
	assert.equal(countError.cause.budget, "files");
	assert.equal(countStore.blobReads.length, tooMany.length);

	const large = [Object.freeze({
		path: ".codewiki/wiki/items/large.md",
		mode: "100644",
		oid: oid(200),
		bytes: textBytes("x".repeat(WIKI_PROFILE_LIMITS.fileBytes + 1)),
	})];
	const fileStore = fakeStore({documents: large});
	const fileError = expectFailure(await runProfile(fileStore, {kind: "canonical"}), "limit_exceeded");
	assert.equal(fileError.cause.kind, "budget");
	assert.equal(fileError.cause.budget, "file_bytes");

	const aggregate = Array.from({length: 9}, (_, index) => Object.freeze({
		path: `.codewiki/wiki/items/aggregate-${index}.md`,
		mode: "100644",
		oid: oid(index + 300),
		bytes: textBytes("x".repeat(950_000)),
	}));
	const aggregateStore = fakeStore({documents: aggregate});
	const aggregateError = expectFailure(await runProfile(aggregateStore, {kind: "canonical"}), "limit_exceeded");
	assert.equal(aggregateError.cause.kind, "budget");
	assert.equal(aggregateError.cause.budget, "context_bytes");
	for (const store of [countStore, fileStore, aggregateStore]) assertReadOnly(store);
});

test("managed preflight rejects UTF-8 overflow before encoding the offending text", async (t) => {
	const texts = ["x".repeat(WIKI_PROFILE_LIMITS.fileBytes + 1), "é".repeat(WIKI_PROFILE_LIMITS.fileBytes / 2 + 1),
		"😀".repeat(WIKI_PROFILE_LIMITS.fileBytes / 4 + 1)];
	const documents = texts.map((text, index) => Object.freeze({path: `.codewiki/wiki/items/large-${index}.md`,
		mode: "100644", oid: oid(600 + index), bytes: textBytes(text)}));
	const encode = TextEncoder.prototype.encode;
	let offendingEncodes = 0;
	t.mock.method(TextEncoder.prototype, "encode", function (text) {
		if (texts.includes(text)) offendingEncodes += 1;
		return encode.call(this, text);
	});
	for (const document of documents) {
		const error = expectFailure(await runProfile(fakeStore({documents: [document]}), {kind: "canonical"}), "limit_exceeded");
		assert.equal(error.cause.budget, "file_bytes");
	}
	assert.equal(offendingEncodes, 0);
});

test("managed exact aggregate limit is inclusive and a later byte fails preflight", async () => {
	const documents = coreDocuments().map((document) => {
		const bytes = new Uint8Array(WIKI_PROFILE_LIMITS.fileBytes);
		bytes.fill(0x78);
		bytes.set(document.bytes);
		return {...document, bytes};
	});
	assert.equal(documents.reduce((sum, document) => sum + document.bytes.byteLength, 0), WIKI_PROFILE_LIMITS.contextBytes);
	const result = await runProfile(fakeStore({documents}), {kind: "canonical"});
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	documents.push({path: ".codewiki/wiki/items/overflow.md", mode: "100644", oid: oid(700), bytes: textBytes("x")});
	const error = expectFailure(await runProfile(fakeStore({documents}), {kind: "canonical"}), "limit_exceeded");
	assert.equal(error.cause.budget, "context_bytes");
});

test("dishonest material byte lengths fail binding and do not normalize exact text", async () => {
	class DishonestBytes extends Uint8Array {
		get byteLength() {
			return 1;
		}
	}
	const documents = coreDocuments();
	documents[0] = Object.freeze({...documents[0], bytes: new DishonestBytes(documents[0].bytes)});
	const store = fakeStore({documents});
	const error = expectFailure(await runProfile(store, {kind: "canonical"}), "invalid_file");
	assert.equal(error.cause.kind, "binding");
	assert.equal(error.cause.binding.path, documents[0].path);
	assert.equal(store.snapshotReads.length, 1);
	assertReadOnly(store);
});

test("native SHA-1 and SHA-256 stores resolve canonical, managed Change and historical commits after reopen", async (t) => {
	for (const algorithm of ["sha1", "sha256"]) {
		await t.test(algorithm, async () => {
			const repository = await nativeRepository(algorithm);
			t.after(() => rm(repository.root, {recursive: true, force: true}));
			const reopened = createGitProjectStore({repositoryRoot: repository.root, repositoryId: REPOSITORY_ID});
			assert.equal(reopened.ok, true, reopened.ok ? "" : reopened.error.message);
			const store = reopened.value;
			const refsBefore = await fixtureGit(repository.root, ["show-ref"]);
			const configBefore = await readFile(join(repository.root, ".git", "config"), "utf8");
			const indexBefore = await readFile(join(repository.root, ".git", "index"));
			const oldResult = await runProfile(store, {kind: "commit", commit: repository.oldCommit}, algorithm);
			assert.equal(oldResult.ok, true, oldResult.ok ? "" : oldResult.error.message);
			assert.equal(oldResult.value.snapshot.commit.hex, repository.oldCommit.hex);
			assert.equal(oldResult.value.managedFiles.find((file) => file.path.endsWith("/Definition.md")).body, "# Definition\n\nMeaning for Definition.\n");
			const oldBinding = oldResult.value.typeContext.bindings.find((binding) => binding.type === "FieldObservation");
			assert.equal(oldBinding.base, "Claim");
			const changeResult = await runProfile(store, {kind: "change", changeId: CHANGE}, algorithm);
			assert.equal(changeResult.ok, true, changeResult.ok ? "" : changeResult.error.message);
			assert.equal(changeResult.value.snapshot.commit.hex, repository.oldCommit.hex);
			const current = await runProfile(store, {kind: "canonical"}, algorithm);
			assert.equal(current.ok, true, current.ok ? "" : current.error.message);
			assert.equal(current.value.snapshot.commit.hex, repository.newCommit.hex);
			assert.equal(current.value.managedFiles.find((file) => file.path.endsWith("/Definition.md")).body, "# Definition\n\nUpdated exact Definition meaning.\n");
			assert.equal(current.value.snapshot.commit.algorithm, algorithm);
			assert.equal(current.value.snapshot.tree.algorithm, algorithm);
			const currentBinding = current.value.typeContext.bindings.find((binding) => binding.type === "FieldObservation");
			assert.equal(currentBinding.base, "Entity");
			assert.notDeepEqual(currentBinding.definition.blob, oldBinding.definition.blob);
			assert.deepEqual(currentBinding.item.blob, oldBinding.item.blob);
			assert.deepEqual(current.value.typeContext.snapshot, repository.newCommit);
			const oldDefinition = oldResult.value.managedFiles.find((file) => file.path.endsWith("/Definition.md"));
			const newDefinition = current.value.managedFiles.find((file) => file.path.endsWith("/Definition.md"));
			const oldCustomDefinition = oldResult.value.managedFiles.find((file) => file.path.endsWith("/FieldObservation.md"));
			const newCustomDefinition = current.value.managedFiles.find((file) => file.path.endsWith("/FieldObservation.md"));
			const transaction = validateProfiledWikiTransaction({
				profile: WIKI_PROFILE_ID,
				kernelBuildDigest: BUILD_DIGEST,
				responsibleChangePath: `.codewiki/changes/${CHANGE}`,
				before: oldResult.value,
				after: current.value,
				mappings: [
					{kind: "revise", before: [{path: oldDefinition.path, blob: oldDefinition.blob}], after: [{path: newDefinition.path, blob: newDefinition.blob}]},
					{kind: "revise", before: [{path: oldCustomDefinition.path, blob: oldCustomDefinition.blob}], after: [{path: newCustomDefinition.path, blob: newCustomDefinition.blob}]},
				],
			});
			assert.equal(transaction.ok, true, transaction.ok ? "" : transaction.error.message);
			assert.equal(transaction.value.potentialTypeImpacts.some((impact) => impact.item.path.endsWith("/cafe.md")), true);
			const serializationRoot = await mkdtemp(join(tmpdir(), `codewiki-profile-transaction-${algorithm}-`));
			t.after(() => rm(serializationRoot, {recursive: true, force: true}));
			const serializedPath = join(serializationRoot, "transaction.json");
			await writeFile(serializedPath, JSON.stringify(transaction.value), "utf8");
			const serialized = JSON.parse(await readFile(serializedPath, "utf8"));
			const recovered = validateProfiledWikiTransaction({
				profile: serialized.profile,
				kernelBuildDigest: serialized.kernelBuildDigest,
				responsibleChangePath: serialized.responsibleChangePath,
				before: serialized.before,
				after: serialized.after,
				mappings: serialized.mappings,
			});
			assert.equal(recovered.ok, true, recovered.ok ? "" : recovered.error.message);
			assert.equal(recovered.value.transactionDigest, transaction.value.transactionDigest);
			assert.deepEqual(current.value.corpus.documents.find((file) => file.path === "docs/raw.md").text, "This is deliberately not a managed profile.\n");
			const currentCafe = current.value.managedFiles.find((file) => file.path.endsWith("/cafe.md"));
			assert.equal(currentCafe.metadata.origins[0].reference, "../../changes/CHG-profile");
			const expectedDefinitionBlob = await fixtureGit(repository.root, ["rev-parse", `${repository.newCommit.hex}:.codewiki/wiki/types/Definition.md`]);
			assert.equal(current.value.managedFiles.find((file) => file.path.endsWith("/Definition.md")).blob.hex, expectedDefinitionBlob);
			const expectedTree = await fixtureGit(repository.root, ["rev-parse", `${repository.newCommit.hex}^{tree}`]);
			assert.equal(current.value.snapshot.tree.hex, expectedTree);
			const reopenedAgain = createGitProjectStore({repositoryRoot: repository.root, repositoryId: REPOSITORY_ID});
			assert.equal(reopenedAgain.ok, true);
			const repeat = await runProfile(reopenedAgain.value, {kind: "commit", commit: repository.oldCommit}, algorithm);
			assert.equal(repeat.ok, true, repeat.ok ? "" : repeat.error.message);
			assert.deepEqual(repeat.value.typeContext, oldResult.value.typeContext);
			const reopenedNew = await runProfile(reopenedAgain.value, {kind: "commit", commit: repository.newCommit}, algorithm);
			assert.equal(reopenedNew.ok, true, reopenedNew.ok ? "" : reopenedNew.error.message);
			const historical = validateProfiledWikiTransaction({
				profile: WIKI_PROFILE_ID,
				kernelBuildDigest: BUILD_DIGEST,
				responsibleChangePath: `.codewiki/changes/${CHANGE}`,
				before: repeat.value,
				after: reopenedNew.value,
				mappings: transaction.value.mappings,
			});
			assert.equal(historical.ok, true, historical.ok ? "" : historical.error.message);
			assert.equal(historical.value.transactionDigest, transaction.value.transactionDigest);
			assert.deepEqual(historical.value, recovered.value);
			assert.equal(JSON.stringify(historical.value), JSON.stringify(serialized));
			assert.equal(await fixtureGit(repository.root, ["show-ref"]), refsBefore);
			assert.equal(await readFile(join(repository.root, ".git", "config"), "utf8"), configBefore);
			const indexAfter = await readFile(join(repository.root, ".git", "index"));
			assert.deepEqual(indexAfter, indexBefore);
		});
	}
});
