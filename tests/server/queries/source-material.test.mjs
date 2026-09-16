import assert from "node:assert/strict";
import test from "node:test";

import {failure, success} from "../../../src/kernel/data-contracts/outcome.ts";
import {decodeGitOid} from "../../../src/kernel/identity/git.ts";
import {CHANGEKERNEL_VERSION} from "../../../src/kernel/identity/version.ts";
import {createProjectSnapshot} from "../../../src/kernel/changes/snapshot.ts";
import {loadMarkdownMaterialSource} from "../../../src/server/queries/material-source.ts";
import {resolveProjectSource} from "../../../src/server/queries/source.ts";

const REPOSITORY_ID = "cw:repository:material-source-test";
const COMMIT = oid("a".repeat(40));
const TREE = oid("b".repeat(40));
const README = oid("c".repeat(40));
const NOTE = oid("d".repeat(40));
const IMAGE = oid("e".repeat(40));
const LINK = oid("f".repeat(40));
const BUILD_DIGEST = `sha256:${"1".repeat(64)}`;
const textEncoder = new TextEncoder();

const configuration = Object.freeze({
	projectName: "Material Source Test",
	repositoryId: REPOSITORY_ID,
	objectFormat: "sha1",
	canonicalRef: "refs/heads/main",
	kernelBuildDigest: BUILD_DIGEST,
	kernelVersion: CHANGEKERNEL_VERSION,
	limits: Object.freeze({
		maximumWikiItems: 64,
		maximumWikiFileBytes: 64 * 1024,
		maximumWikiTotalBytes: 512 * 1024,
		maximumChangeTraces: 64,
		maximumTraceBytes: 64 * 1024,
		maximumHistoryCommits: 16,
		maximumHistoryBytes: 512 * 1024,
	}),
});

function limits(overrides = {}) {
	return Object.freeze({
		maximumEntries: 32,
		maximumPathBytes: 1024,
		maximumDocuments: 8,
		maximumDocumentBytes: 128,
		maximumTotalBytes: 256,
		...overrides,
	});
}

test("native material read resolves exact source and reads only regular Markdown blobs", async () => {
	const store = fakeStore({
		entries: [
			entry("README.md", "100644", "blob", README),
			entry("assets/logo.png", "100644", "blob", IMAGE),
			entry("docs/note.markdown", "100755", "blob", NOTE),
		],
		blobs: new Map([
			["README.md", bytes("\uFEFFTitle\r\n")],
			["docs/note.markdown", bytes("Cafe\u0301\n")],
		]),
	});
	const result = await loadMarkdownMaterialSource(store, configuration, {kind: "canonical"}, limits());
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.deepEqual(store.snapshotSelectors, [{kind: "ref", ref: "refs/heads/main"}]);
	assert.deepEqual(store.blobReads.map((read) => read.path), ["README.md", "docs/note.markdown"]);
	assert.deepEqual(result.value.snapshot.commit, COMMIT);
	assert.deepEqual(result.value.corpus.snapshot, COMMIT);
	assert.deepEqual(result.value.corpus.documents.map((document) => ({path: document.path, text: document.text})), [
		{path: "README.md", text: "\uFEFFTitle\r\n"},
		{path: "docs/note.markdown", text: "Cafe\u0301\n"},
	]);
	assert.deepEqual(result.value.corpus.exclusions.map((exclusion) => exclusion.path), ["assets/logo.png"]);
	assert.equal(JSON.stringify(result.value.corpus).includes("accepted"), false);
	assert.equal(JSON.stringify(result.value.corpus).includes("adopted"), false);
});

test("change and exact commit selectors use existing source resolution", async () => {
	const commitStore = fakeStore({entries: [], blobs: new Map()});
	assert.equal((await loadMarkdownMaterialSource(commitStore, configuration, {kind: "commit", commit: COMMIT}, limits())).ok, true);
	assert.deepEqual(commitStore.snapshotSelectors, [{kind: "oid", oid: COMMIT}]);

	const changeStore = fakeStore({entries: [], blobs: new Map()});
	assert.equal((await loadMarkdownMaterialSource(changeStore, configuration, {kind: "change", changeId: "CHG-material"}, limits())).ok, true);
	assert.deepEqual(changeStore.snapshotSelectors, [{kind: "ref", ref: "refs/codewiki/changes/CHG-material"}]);
});

test("path and document budgets reject before any blob load", async () => {
	const pathStore = fakeStore({entries: [entry("very-long-name.md", "100644", "blob", README)], blobs: new Map()});
	const pathResult = await loadMarkdownMaterialSource(pathStore, configuration, {kind: "canonical"}, limits({maximumPathBytes: 4}));
	assert.equal(pathResult.error.code, "limit_exceeded");
	assert.deepEqual(pathStore.blobReads, []);

	const documentStore = fakeStore({
		entries: [entry("one.md", "100644", "blob", README), entry("two.md", "100644", "blob", NOTE)],
		blobs: new Map(),
	});
	const documentResult = await loadMarkdownMaterialSource(documentStore, configuration, {kind: "canonical"}, limits({maximumDocuments: 1}));
	assert.equal(documentResult.error.code, "limit_exceeded");
	assert.deepEqual(documentStore.blobReads, []);
});

test("per-document and total byte limits bound blob requests", async () => {
	const perDocument = fakeStore({entries: [entry("README.md", "100644", "blob", README)], blobs: new Map([["README.md", bytes("12345")]])});
	const perDocumentResult = await loadMarkdownMaterialSource(perDocument, configuration, {kind: "canonical"}, limits({maximumDocumentBytes: 4}));
	assert.equal(perDocumentResult.error.code, "limit_exceeded");
	assert.deepEqual(perDocument.blobReads.map((read) => read.maximumBytes), [4]);

	const total = fakeStore({
		entries: [entry("one.md", "100644", "blob", README), entry("two.md", "100644", "blob", NOTE)],
		blobs: new Map([["one.md", bytes("1234")], ["two.md", bytes("5678")]]),
	});
	const totalResult = await loadMarkdownMaterialSource(total, configuration, {kind: "canonical"}, limits({maximumDocumentBytes: 4, maximumTotalBytes: 5}));
	assert.equal(totalResult.error.code, "limit_exceeded");
	assert.deepEqual(total.blobReads.map((read) => read.maximumBytes), [4, 1]);
});

test("blob failures and source drift remain material read failures", async () => {
	const failed = fakeStore({entries: [entry("README.md", "100644", "blob", README)], blobs: new Map(), blobFailure: issue("command_failed", "read_blob", "blob unavailable")});
	const failedResult = await loadMarkdownMaterialSource(failed, configuration, {kind: "canonical"}, limits());
	assert.equal(failedResult.error.code, "invalid_project_state");
	assert.equal(failedResult.error.operation, "read_material");

	const drifted = fakeStore({entries: [entry("README.md", "100644", "blob", README)], blobs: new Map([["README.md", bytes("ok")]]), blobOid: NOTE});
	const driftResult = await loadMarkdownMaterialSource(drifted, configuration, {kind: "canonical"}, limits());
	assert.equal(driftResult.error.code, "source_stale");
});

test("symlink Markdown and path collisions are rejected by corpus boundary", async () => {
	const symlink = fakeStore({entries: [entry("linked.md", "120000", "blob", LINK)], blobs: new Map()});
	const symlinkResult = await loadMarkdownMaterialSource(symlink, configuration, {kind: "canonical"}, limits());
	assert.equal(symlinkResult.error.code, "invalid_project_state");
	assert.deepEqual(symlink.blobReads, []);

	const collision = fakeStore({
		entries: [entry("docs", "100644", "blob", IMAGE), entry("docs/readme.md", "100644", "blob", README)],
		blobs: new Map([["docs/readme.md", bytes("nested")]]),
	});
	const collisionResult = await loadMarkdownMaterialSource(collision, configuration, {kind: "canonical"}, limits());
	assert.equal(collisionResult.error.code, "invalid_project_state");
});

function fakeStore({entries, blobs = new Map(), blobFailure = null, blobOid = null,
	snapshotFailure = null, treeFailure = null, treeCommit = COMMIT, snapshotChanges = {},
	ignoreCaps = false, onSnapshot = null}) {
	const snapshot = createProjectSnapshot({
		repositoryId: REPOSITORY_ID,
		objectFormat: "sha1",
		commit: COMMIT,
		tree: TREE,
		parents: [],
		complete: true,
	});
	assert.equal(snapshot.ok, true, snapshot.ok ? "" : snapshot.error.message);
	const state = {
		protocol: "codewiki.project-store/1.0.0",
		snapshotSelectors: [],
		snapshotReads: [],
		treeReads: [],
		blobReads: [],
		async readSnapshot(request) {
			state.snapshotSelectors.push(request.selector);
			state.snapshotReads.push(request);
			if (onSnapshot) await onSnapshot(request);
			if (snapshotFailure) return failure(snapshotFailure);
			return success(Object.freeze({...snapshot.value, ...snapshotChanges}));
		},
		async readTree(request) {
			state.treeReads.push(request);
			if (treeFailure) return failure(treeFailure);
			assert.equal(request.repositoryId, REPOSITORY_ID);
			assert.deepEqual(request.commit, COMMIT);
			assert.equal(request.pathPrefix, "");
			assert.equal(request.objectFormat, "sha1");
			return success(Object.freeze({commit: treeCommit, entries: Object.freeze(entries)}));
		},
		async readBlob(request) {
			state.blobReads.push(request);
			if (blobFailure) return failure(blobFailure);
			const content = blobs.get(request.path);
			assert.equal(request.repositoryId, REPOSITORY_ID);
			assert.equal(request.objectFormat, "sha1");
			assert.deepEqual(request.commit, COMMIT);
			if (content === undefined) return failure(issue("not_found", "read_blob", "missing blob"));
			if (!ignoreCaps && content.byteLength > request.maximumBytes) return failure(issue("limit_exceeded", "read_blob", "blob too large"));
			return success(Object.freeze({oid: blobOid ?? entries.find((item) => item.path === request.path).oid, bytes: content}));
		},
		async writeBlob() { throw new Error("writeBlob not expected"); },
		async writeTree() { throw new Error("writeTree not expected"); },
		async createCommit() { throw new Error("createCommit not expected"); },
		async compareAndSwapRefs() { throw new Error("compareAndSwapRefs not expected"); },
	};
	return state;
}

function entry(path, mode, kind, oidValue) {
	return Object.freeze({path, mode, kind, oid: oidValue});
}

function bytes(value) {
	return textEncoder.encode(value);
}

function oid(hex) {
	const decoded = decodeGitOid({algorithm: "sha1", hex});
	assert.equal(decoded.ok, true, decoded.ok ? "" : decoded.error.message);
	return decoded.value;
}

function issue(code, operation, message) {
	return Object.freeze({code, operation, message});
}

function contentStore(texts, options = {}) {
	return fakeStore({
		entries: texts.map((_, index) => entry(`${index}.md`, "100644", "blob", oid((index + 1).toString(16).padStart(40, "0")))),
		blobs: new Map(texts.map((text, index) => [`${index}.md`, bytes(text)])),
		...options,
	});
}

function expectFailure(result, code) {
	assert.equal(result.ok, false);
	assert.equal(result.error.code, code, result.error.message);
	assert.equal("value" in result, false, "a failed read must not expose partial material");
	return result.error;
}

const canonical = Object.freeze({kind: "canonical"});

test("SC-2B-R all limit fields reject invalid data before any Store call", async t => {
	for (const field of Object.keys(limits())) {
		await t.test(field, async () => {
			for (const value of [undefined, null, "1", true, 0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
				const store = fakeStore({entries: []});
				const error = expectFailure(await loadMarkdownMaterialSource(store, configuration, canonical, {...limits(), [field]: value}), "invalid_input");
				assert.equal(error.cause.field, field);
				assert.deepEqual([store.snapshotReads, store.treeReads, store.blobReads], [[], [], []]);
			}
			for (const shape of ["missing", "inherited", "accessor"]) {
				const input = {...limits()};
				delete input[field];
				if (shape === "inherited") Object.setPrototypeOf(input, {[field]: 1});
				if (shape === "accessor") Object.defineProperty(input, field, {get() { assert.fail("limit getter must not execute"); }});
				const store = fakeStore({entries: []});
				expectFailure(await loadMarkdownMaterialSource(store, configuration, canonical, input), "invalid_input");
				assert.deepEqual([store.snapshotReads, store.treeReads, store.blobReads], [[], [], []]);
			}
		});
	}
	for (const input of [null, undefined, 42, "limits", () => limits()]) {
		const store = fakeStore({entries: []});
		expectFailure(await loadMarkdownMaterialSource(store, configuration, canonical, input), "invalid_input");
		assert.deepEqual(store.snapshotReads, []);
	}
});

test("SC-2B-R admitted limits survive caller mutation across an await", async () => {
	const input = {...limits({maximumEntries: 2, maximumDocuments: 2, maximumDocumentBytes: 2, maximumTotalBytes: 2})};
	const store = contentStore(["ab", ""], {onSnapshot: async () => {
		await Promise.resolve();
		for (const field of Object.keys(input)) input[field] = 0;
	}});
	const result = await loadMarkdownMaterialSource(store, configuration, canonical, input);
	assert.equal(result.ok, true, result.error?.message);
	assert.equal(store.snapshotReads.length, 1);
	assert.equal(store.treeReads[0].maximumEntries, 2);
	assert.deepEqual(store.blobReads.map(request => request.maximumBytes), [2, 1]);
	assert.deepEqual(result.value.corpus.documents.map(document => document.text), ["ab", ""]);
});

test("SC-2B-R exhausted byte budgets admit empty files in either order", async t => {
	for (const texts of [["ab", "", ""], ["", "ab", ""], ["", "", "ab"], ["", "", ""]]) {
		await t.test(JSON.stringify(texts), async () => {
			const store = contentStore(texts);
			const result = await loadMarkdownMaterialSource(store, configuration, canonical, limits({maximumDocumentBytes: 2, maximumTotalBytes: 2}));
			assert.equal(result.ok, true, result.error?.message);
			assert.deepEqual(result.value.corpus.documents.map(document => document.text), texts);
			let remaining = 2;
			assert.deepEqual(store.blobReads.map(request => request.maximumBytes), texts.map(text => {
				const cap = remaining || 1;
				remaining -= text.length;
				return cap;
			}));
		});
	}
	for (const ignoreCaps of [false, true]) {
		const store = contentStore(["ab", "c", ""], {ignoreCaps});
		expectFailure(await loadMarkdownMaterialSource(store, configuration, canonical, limits({maximumTotalBytes: 2})), "limit_exceeded");
		assert.deepEqual(store.blobReads.map(request => request.maximumBytes), [2, 1]);
	}
});

test("SC-2B-R rechecks oversized blobs even when Store ignores requested caps", async () => {
	for (const [input, budget] of [[limits({maximumDocumentBytes: 1}), "document_bytes"], [limits({maximumTotalBytes: 1}), "total_bytes"]]) {
		const store = contentStore(["ab"], {ignoreCaps: true});
		const error = expectFailure(await loadMarkdownMaterialSource(store, configuration, canonical, input), "limit_exceeded");
		assert.deepEqual(error.cause, {kind: "material_budget", budget});
		assert.equal(store.blobReads[0].maximumBytes, 1);
	}
	const store = contentStore(["ab", "oversize"], {ignoreCaps: true});
	const error = expectFailure(await loadMarkdownMaterialSource(store, configuration, canonical, limits({maximumTotalBytes: 2})), "limit_exceeded");
	assert.deepEqual(error.cause, {kind: "material_budget", budget: "total_bytes"});
	assert.deepEqual(store.blobReads.map(request => request.maximumBytes), [2, 1]);
});

test("SC-2B-R entry, Unicode path and document budgets include excluded descriptors", async () => {
	const descriptors = [entry("\uE000.md", "100644", "blob", README), entry("Cafe\u0301.png", "100644", "blob", IMAGE)];
	const maximumPathBytes = descriptors.reduce((sum, descriptor) => sum + Buffer.byteLength(descriptor.path), 0);
	const exact = limits({maximumEntries: 2, maximumPathBytes, maximumDocuments: 1, maximumDocumentBytes: 1, maximumTotalBytes: 1});
	const make = () => fakeStore({entries: descriptors, blobs: new Map([["\uE000.md", bytes("x")]])});
	const good = await loadMarkdownMaterialSource(make(), configuration, canonical, exact);
	assert.equal(good.ok, true, good.error?.message);
	for (const overrides of [{maximumEntries: 1}, {maximumPathBytes: maximumPathBytes - 1}]) {
		const store = make();
		expectFailure(await loadMarkdownMaterialSource(store, configuration, canonical, {...exact, ...overrides}), "limit_exceeded");
		assert.deepEqual(store.blobReads, []);
	}
	const excluded = fakeStore({entries: Array.from({length: 20}, (_, i) => entry(`${i}.png`, "100644", "blob", IMAGE))});
	expectFailure(await loadMarkdownMaterialSource(excluded, configuration, canonical, limits({maximumEntries: 19})), "limit_exceeded");
	assert.deepEqual(excluded.blobReads, []);
	const huge = fakeStore({entries: [entry("a".repeat(1_000_000) + "\uD800", "100644", "blob", IMAGE)]});
	expectFailure(await loadMarkdownMaterialSource(huge, configuration, canonical, limits({maximumPathBytes: 4})), "limit_exceeded");
	assert.deepEqual(huge.blobReads, []);
});

test("SC-2B-R retains structured Store failures without altering legacy resolver responses", async t => {
	const legacyCodes = {not_found: "source_not_found", stale_ref: "source_stale", limit_exceeded: "limit_exceeded"};
	for (const code of ["timeout", "command_failed", "incomplete_object", "not_found", "limit_exceeded", "stale_ref", "invalid_object"]) {
		await t.test(code, async () => {
			for (const [option, operation] of [["snapshotFailure", "read_snapshot"], ["treeFailure", "read_tree"], ["blobFailure", "read_blob"]]) {
				const cause = issue(code, operation, "same opaque diagnostic");
				const store = contentStore(["x"], {[option]: cause});
				const error = expectFailure(await loadMarkdownMaterialSource(store, configuration, canonical, limits()), legacyCodes[code] ?? "invalid_project_state");
				const retained = operation === "read_snapshot" ? error.cause.failure.store : error.cause.store;
				assert.strictEqual(retained, cause);
				assert.equal(store.snapshotReads.length, 1);
				if (operation === "read_snapshot") {
					assert.deepEqual(store.treeReads, []);
					const legacy = await resolveProjectSource(fakeStore({entries: [], snapshotFailure: cause}), configuration, canonical);
					assert.deepEqual(legacy.error, {code: legacyCodes[code] ?? "invalid_project_state", operation: "resolve_source", message: cause.message});
				}
				if (operation !== "read_blob") assert.deepEqual(store.blobReads, []);
			}
		});
	}
});

test("SC-2B-R rejects drifted bindings and invalid selectors without extra reads", async () => {
	for (const source of [{kind: "change", changeId: "../bad"}, {kind: "commit", commit: {algorithm: "sha256", hex: "1".repeat(64)}}]) {
		const store = fakeStore({entries: []});
		const result = await loadMarkdownMaterialSource(store, configuration, source, limits());
		expectFailure(result, "invalid_source");
		assert.equal(result.error.cause.failure.kind, "invalid_source");
		assert.deepEqual(store.snapshotReads, []);
		const legacy = await resolveProjectSource(store, configuration, source);
		assert.deepEqual(legacy.error, {code: result.error.code, operation: "resolve_source", message: result.error.message});
	}
	for (const snapshotChanges of [
		{repositoryId: "cw:repository:other"}, {objectFormat: "sha256"}, {complete: false},
		{commit: {algorithm: "sha256", hex: "1".repeat(64)}}, {tree: {algorithm: "sha256", hex: "2".repeat(64)}}, {commit: NOTE},
	]) {
		const store = fakeStore({entries: [], snapshotChanges});
		expectFailure(await loadMarkdownMaterialSource(store, configuration, {kind: "commit", commit: COMMIT}, limits()), "source_stale");
		assert.deepEqual(store.treeReads, []);
	}
	const drift = contentStore(["x"], {treeCommit: NOTE});
	const error = expectFailure(await loadMarkdownMaterialSource(drift, configuration, canonical, limits()), "source_stale");
	assert.equal(error.cause.check, "tree_commit");
	assert.deepEqual(drift.blobReads, []);
});

test("SC-2B-R rejects malformed descriptors and preserves corpus failure locations", async () => {
	for (const descriptor of [null, {}, entry(42, "100644", "blob", README), entry("lone\uD800", "100644", "blob", README)]) {
		const store = fakeStore({entries: [descriptor]});
		expectFailure(await loadMarkdownMaterialSource(store, configuration, canonical, limits()), "invalid_project_state");
		assert.deepEqual(store.blobReads, []);
	}
	const malformed = fakeStore({entries: null});
	expectFailure(await loadMarkdownMaterialSource(malformed, configuration, canonical, limits()), "invalid_project_state");
	for (const descriptors of [
		[entry("note.md", "100644", "blob", README), entry("note.md", "100644", "blob", README)],
		[entry("notes", "100644", "blob", NOTE), entry("notes/item.md", "100644", "blob", README)],
		[entry("notes/item.md", "100644", "blob", README), entry("notes", "100644", "blob", NOTE)],
		[entry("../bad.png", "100644", "blob", IMAGE)],
		[entry("wrong.png", "100644", "blob", {algorithm: "sha256", hex: "1".repeat(64)})],
		[entry("link.md", "120000", "blob", LINK)], [entry("module.md", "160000", "commit", LINK)],
	]) {
		const store = fakeStore({entries: descriptors, blobs: new Map([["note.md", bytes("x")], ["notes/item.md", bytes("x")]])});
		const error = expectFailure(await loadMarkdownMaterialSource(store, configuration, canonical, limits()), "invalid_project_state");
		assert.equal(error.cause.kind, "corpus_failure");
		assert.match(error.cause.corpus.path, /^\$\.entries\[\d+\]\./);
		if (descriptors.length === 1) assert.deepEqual(store.blobReads, []);
	}
});

test("SC-2B-R preserves raw text and rejects invalid content without partial success", async () => {
	const text = "\uFEFF---\r\ntype: NotAdopted\r\n---\r\n[link](../secret)\r\nCafe\u0301\r\n";
	const store = contentStore([text]);
	const result = await loadMarkdownMaterialSource(store, configuration, canonical, limits());
	assert.equal(result.ok, true, result.error?.message);
	assert.equal(result.value.corpus.documents[0].text, text);
	assert.deepEqual(Object.keys(result.value.corpus.documents[0]), ["path", "mode", "oid", "byteLength", "text"]);
	const detached = new Uint8Array([1]);
	structuredClone(detached.buffer, {transfer: [detached.buffer]});
	for (const content of [new Uint8Array([0xff]), new Uint8Array(new SharedArrayBuffer(1)), detached, null, "not bytes"]) {
		const failed = contentStore(["ok", ""], {ignoreCaps: true, blobs: new Map([["0.md", bytes("ok")], ["1.md", content]])});
		const error = expectFailure(await loadMarkdownMaterialSource(failed, configuration, canonical, limits()), "invalid_project_state");
		assert.equal(error.cause.kind, "corpus_failure");
		assert.match(error.cause.corpus.path, /^\$\.entries\[1\]\.bytes$/);
	}
});
