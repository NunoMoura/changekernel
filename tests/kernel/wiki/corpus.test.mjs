import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import {readMarkdownCorpus} from "../../../src/kernel/wiki/corpus.ts";
import {markdownEntry, oid} from "./fixtures.mjs";

const UTF8 = new TextEncoder();
const LIMITS = Object.freeze({
	maximumEntries: 64,
	maximumPathBytes: 4096,
	maximumDocuments: 32,
	maximumDocumentBytes: 8192,
	maximumTotalBytes: 32768,
});

function entry(path = "README.md", text = "# Plain Markdown\n", overrides = {}) {
	const bytes = overrides.bytes ?? UTF8.encode(text);
	// Distinct fixture identities, deliberately not authenticated Git blob hashes.
	const object = {algorithm: "sha1", hex: createHash("sha1").update(bytes).digest("hex")};
	return {path, mode: "100644", oid: object, bytes, ...overrides};
}

function request(entries = [], limits = {}, extra = {}) {
	return {snapshot: {...oid(1)}, entries, limits: {...LIMITS, ...limits}, ...extra};
}

function value(input) {
	const result = readMarkdownCorpus(input);
	assert.equal(result.ok, true, JSON.stringify(result));
	return result.value;
}

function rejected(input, code, path) {
	const result = readMarkdownCorpus(input);
	assert.equal(result.ok, false, `Expected ${code}`);
	assert.equal(result.error.code, code);
	if (path !== undefined) assert.equal(result.error.path, path);
	assert.equal("value" in result, false, "A failure cannot expose a partial corpus");
	assert.ok(Object.isFrozen(result.error));
	return result.error;
}

test("ordinary Markdown is material at any supplied relative path, not adopted knowledge", () => {
	const input = request([
		entry("README.md"),
		entry("Notes/Trial.MARKDOWN", "---\ntitle: [deliberately unclosed\n---\n[[Other#Heading]] ![[private.pdf]]\n"),
		entry("archive/obsolete.Md", "Run a command; this is source text, not execution authority."),
		entry(".hidden/.md", ""),
	], {}, {accepted: true, disposition: "adopted"});
	const result = value(input);
	assert.deepEqual(Object.keys(result), ["snapshot", "documents", "exclusions"]);
	assert.deepEqual(result.documents.map(item => item.path), input.entries.map(item => item.path));
	assert.deepEqual(result.exclusions, []);
	for (let index = 0; index < result.documents.length; index += 1) {
		const item = result.documents[index];
		assert.deepEqual(Object.keys(item), ["path", "mode", "oid", "byteLength", "text"]);
		assert.deepEqual(UTF8.encode(item.text), input.entries[index].bytes);
		assert.equal(item.byteLength, input.entries[index].bytes.byteLength);
	}
	assert.equal(input.disposition, "adopted", "Reading material does not rewrite existing caller state");
});

test("valid UTF-8 round-trips without BOM, newline, normalization or control-data rewriting", () => {
	const text = "\uFEFF# Cafe\u0301\r\n\uFEFF\u0000\u007F\u0080\u07FF\u0800\uFFFF\u{10000}\u{10FFFF}\rno final newline";
	const document = value(request([entry("cafe\u0301/📝.md", text)])).documents[0];
	assert.equal(document.text, text);
	assert.deepEqual(UTF8.encode(document.text), UTF8.encode(text));
	assert.equal(document.byteLength, UTF8.encode(text).length);
	assert.equal(document.path, "cafe\u0301/📝.md");
});

test("existing canonical envelope fixtures remain exact opaque text", () => {
	const legacy = markdownEntry({path: ".codewiki/wiki/items/example.md", itemId: "cw:claim:example", title: "Example", body: "Original body\n"});
	const result = value(request([{path: legacy.path, mode: legacy.mode, oid: legacy.blob, bytes: legacy.bytes}]));
	assert.deepEqual(UTF8.encode(result.documents[0].text), legacy.bytes);
	assert.equal("item" in result.documents[0], false);
	assert.equal("accepted" in result.documents[0], false);
});

test("executable Markdown is read only as data", () => {
	const item = entry("script.md", "#!/bin/sh\nexit 99\n", {mode: "100755"});
	const result = value(request([item]));
	assert.equal(result.documents[0].mode, "100755");
	assert.equal(result.documents[0].text, "#!/bin/sh\nexit 99\n");
});

test("non-Markdown exclusions retain identity and need no bytes or link traversal", () => {
	const result = value(request([
		{path: "image.png", mode: "100644", oid: oid(2)},
		{path: "external", mode: "120000", oid: oid(3)},
		{path: "submodule", mode: "160000", oid: oid(4)},
		entry("component.mdx", "import '../private';"),
		entry("data.bin", "", {bytes: Uint8Array.of(0xFF)}),
		entry("not.marKdown", "Unicode folding must not broaden the ASCII suffix"),
		entry("README.md.bak"),
	]));
	assert.deepEqual(result.documents, []);
	assert.equal(result.exclusions.length, 7);
	assert.deepEqual(result.exclusions[0], {path: "image.png", mode: "100644", oid: oid(2), reason: "non_markdown"});
	assert.ok(result.exclusions.every(item => item.reason === "non_markdown" && !("bytes" in item)));
});

test("non-regular Markdown modes are rejected, not dereferenced or silently excluded", () => {
	for (const mode of ["120000", "160000", "040000", "100664", 100644, undefined]) {
		rejected(request([{path: "linked.md", mode, oid: oid(2)}]), "invalid_mode");
	}
	rejected(request([{path: "folder", mode: "040000", oid: oid(2)}]), "invalid_mode");
});

test("unsafe and lossy paths are rejected without normalization", () => {
	for (const path of ["", null, undefined, 42, [], {}, "/README.md", "//server/a.md", "../a.md", "./a.md",
		"a/../b.md", "a/./b.md", "a//b.md", "a/", "a\0b.md", "C:a.md", "C:/a.md", "C:\\a.md", "a\\b.md", "\uD800.md", "\uDC00.md"]) {
		rejected(request([{...entry(), path}]), "invalid_path", "$.entries[0].path");
	}
});

test("exact duplicates fail even outside Markdown; case and normalization variants stay distinct", () => {
	for (const path of ["a.md", "a.bin"]) rejected(request([entry(path), entry(path)]), "duplicate_path");
	const paths = ["A.md", "a.md", "caf\u00E9.md", "cafe\u0301.md"];
	assert.deepEqual(value(request(paths.map(path => entry(path)))).documents.map(item => item.path), paths);
});

test("file/descendant collisions fail in either order, including excluded links and submodules", () => {
	for (const mode of ["100644", "100755", "120000", "160000"]) {
		const parent = {path: "external", mode, oid: oid(2)};
		const child = entry("external/note.md");
		for (const entries of [[parent, child], [child, parent]]) rejected(request(entries), "conflicting_path");
	}
	rejected(request([entry("a.md"), entry("a.md/b.md")]), "conflicting_path");
	const siblings = ["shared/a.md", "shared/b.md", "shared/deep/c.md", "shared-prefix.md"];
	assert.equal(value(request(siblings.map(path => entry(path)))).documents.length, 4);
});

test("all five resource limits are required positive safe integers with no defaults", () => {
	for (const field of Object.keys(LIMITS)) {
		for (const bad of [undefined, null, "1", 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
			rejected(request([], {[field]: bad}), "invalid_limits", "$.limits");
		}
		const input = request();
		delete input.limits[field];
		rejected(input, "invalid_limits");
	}
	rejected(request([], {}, {limits: undefined}), "invalid_limits");
	assert.deepEqual(value(request()).documents, []);
	assert.deepEqual(value(request([], Object.fromEntries(Object.keys(LIMITS).map(key => [key, Number.MAX_SAFE_INTEGER])))).documents, []);
});

test("entry limits apply before any scan, including excluded entries and sparse arrays", () => {
	const entries = [entry("a.md"), {path: "b.bin", mode: "100644", oid: oid(2)}];
	assert.equal(value(request(entries, {maximumEntries: 2})).exclusions.length, 1);
	rejected(request(entries, {maximumEntries: 1}), "limit_exceeded", "$.entries");
	const huge = new Array(1_000_000);
	Object.defineProperty(huge, "0", {get() { assert.fail("Over-budget entries must not be read"); }});
	rejected(request(huge, {maximumEntries: 1}), "limit_exceeded", "$.entries");
});

test("path limits count exact UTF-8 bytes across eligible and excluded entries", () => {
	const entries = [entry("é.md", ""), {path: "📝.bin", mode: "100644", oid: oid(2)}];
	const count = entries.reduce((sum, item) => sum + UTF8.encode(item.path).length, 0);
	assert.equal(value(request(entries, {maximumPathBytes: count})).documents.length, 1);
	rejected(request(entries, {maximumPathBytes: count - 1}), "limit_exceeded", "$.entries[1].path");
	const error = rejected(request([entry(`${"x".repeat(10000)}.md`)], {maximumPathBytes: 8}), "limit_exceeded");
	assert.ok(JSON.stringify(error).length < 256, "An oversized path is not reflected in the issue");
});

test("document limits are inclusive and do not charge excluded files as documents", () => {
	const entries = [entry("a.md", ""), entry("b.md", "")];
	assert.equal(value(request(entries, {maximumDocuments: 2})).documents.length, 2);
	rejected(request(entries, {maximumDocuments: 1}), "limit_exceeded");
	const excluded = Array.from({length: 20}, (_, index) => ({path: `${index}.bin`, mode: "100644", oid: oid(index + 2)}));
	assert.equal(value(request([...excluded, entry("only.md", "")], {maximumDocuments: 1})).exclusions.length, 20);
});

test("per-document and aggregate limits count bytes, not characters, with inclusive boundaries", () => {
	assert.equal(value(request([entry("a.md", "é")], {maximumDocumentBytes: 2})).documents[0].byteLength, 2);
	rejected(request([entry("a.md", "é")], {maximumDocumentBytes: 1}), "limit_exceeded");
	const entries = [entry("a.md", "é"), entry("b.md", "📝")];
	assert.equal(value(request(entries, {maximumTotalBytes: 6})).documents.length, 2);
	rejected(request(entries, {maximumTotalBytes: 5}), "limit_exceeded");
	const binary = entry("binary.dat", "", {bytes: new Uint8Array(100)});
	assert.equal(value(request([binary, entry("a.md", "")], {maximumDocumentBytes: 1, maximumTotalBytes: 1})).exclusions.length, 1);
	rejected(request([entry("a.md", "xx"), entry("b.md", "xx")], {maximumTotalBytes: 3}), "limit_exceeded", "$.entries[1].bytes");
});

test("the entire resource preflight precedes any UTF-8 decoding", () => {
	const invalid = entry("invalid.md", "", {bytes: Uint8Array.of(0xFF)});
	const later = entry("later.md", "ab");
	rejected(request([invalid, later], {maximumTotalBytes: 2}), "limit_exceeded", "$.entries[1].bytes");
	rejected(request([invalid, later], {maximumDocuments: 1}), "limit_exceeded", "$.entries[1]");
	rejected(request([invalid, later], {maximumPathBytes: UTF8.encode(invalid.path).length}), "limit_exceeded", "$.entries[1].path");
	rejected(request([invalid, later]), "invalid_encoding", "$.entries[0].bytes");
});

test("malformed UTF-8 fails rather than replacing bytes or returning partial success", () => {
	for (const bytes of [[0x80], [0xC2], [0xC0, 0xAF], [0xED, 0xA0, 0x80], [0xF4, 0x90, 0x80, 0x80], [0xEF, 0xBB]]) {
		rejected(request([entry("valid.md"), entry("bad.md", "", {bytes: Uint8Array.from(bytes)})]), "invalid_encoding", "$.entries[1].bytes");
	}
});

test("malformed requests, entries, OIDs and byte containers produce typed issues", () => {
	for (const input of [undefined, null, [], {}, new Date(0)]) rejected(input, "invalid_input");
	for (const entries of [null, {}, "a.md"]) rejected(request([], {}, {entries}), "invalid_input");
	for (const bad of [null, 1, [], {}, Object.create({path: "a.md", mode: "100644", oid: oid(2)})]) {
		rejected(request([bad]), "invalid_input");
	}
	rejected(request(new Array(1)), "invalid_input");
	for (const bytes of [undefined, null, [], "text", new ArrayBuffer(1), new DataView(new ArrayBuffer(1))]) {
		rejected(request([{...entry(), bytes}]), "invalid_input");
	}
	rejected(request([{path: "a.bin", mode: "100644", oid: oid(2), bytes: "not bytes"}]), "invalid_input");
	rejected(request([entry("a.md", "", {bytes: new Uint8Array(new SharedArrayBuffer(1))})]), "invalid_input");
});

test("detached and out-of-bounds views cannot masquerade as empty documents", () => {
	const detached = new Uint8Array([65, 66]);
	const detachedInput = request([entry("detached.md", "", {bytes: detached})]);
	structuredClone(detached.buffer, {transfer: [detached.buffer]});
	assert.equal(detached.byteLength, 0);
	rejected(detachedInput, "invalid_input", "$.entries[0].bytes");
	const backing = new ArrayBuffer(8, {maxByteLength: 16});
	const view = new Uint8Array(backing, 4, 4);
	const resizedInput = request([entry("resized.md", "", {bytes: view})]);
	backing.resize(2);
	assert.equal(view.byteLength, 0);
	rejected(resizedInput, "invalid_input", "$.entries[0].bytes");
	assert.equal(value(request([entry("empty.md", "")])).documents[0].byteLength, 0);
});

test("descriptor, request, array-slot, identity and limit accessors are never invoked", () => {
	const poison = {get() { assert.fail("Data accessors must not execute"); }, enumerable: true};
	const descriptor = entry();
	Object.defineProperty(descriptor, "bytes", poison);
	rejected(request([descriptor]), "invalid_input");
	const input = request();
	Object.defineProperty(input, "snapshot", poison);
	rejected(input, "invalid_input");
	const entries = [entry()];
	Object.defineProperty(entries, "0", poison);
	rejected(request(entries), "invalid_input");
	const identity = {...oid(2)};
	Object.defineProperty(identity, "hex", poison);
	rejected(request([entry("a.md", "", {oid: identity})]), "invalid_oid");
	const limits = {...LIMITS};
	Object.defineProperty(limits, "maximumEntries", poison);
	rejected(request([], {}, {limits}), "invalid_limits");
});

test("only declared data is consumed; inherited iterators and extra metadata do not execute", () => {
	const item = entry();
	Object.defineProperty(item, "policy", {get() { assert.fail("Extra metadata must not execute"); }});
	const entries = [item];
	entries[Symbol.iterator] = () => { assert.fail("Array iteration must not execute caller code"); };
	assert.equal(value(request(entries)).documents.length, 1);
});

test("Git identities require non-null exact syntax and a consistent object format", () => {
	for (const invalid of [null, {}, {algorithm: "sha1", hex: "0".repeat(40)}, {algorithm: "sha1", hex: "A".repeat(40)},
		{algorithm: "sha1", hex: "a".repeat(39)}, {algorithm: "sha256", hex: "a".repeat(40)}, {algorithm: "sha512", hex: "a".repeat(64)},
		{algorithm: "sha1", hex: "a".repeat(100000)}]) {
		rejected(request([], {}, {snapshot: invalid}), "invalid_snapshot");
		rejected(request([entry("a.md", "", {oid: invalid})]), "invalid_oid");
	}
	rejected(request([entry("a.md", "", {oid: oid(2, "sha256")})]), "invalid_oid");
	rejected(request([{path: "a.bin", mode: "100644", oid: oid(2, "sha256")}]), "invalid_oid");
	const result = value(request([entry("a.md", "", {oid: oid(2, "sha256")})], {}, {snapshot: oid(1, "sha256")}));
	assert.equal(result.snapshot.algorithm, "sha256");
	assert.equal(result.documents[0].oid.hex.length, 64);
});

test("OID shape is not hash-to-byte authenticity, tracking, acceptance or custody", () => {
	const unverified = oid(987);
	const result = value(request([entry("a.md", "These are supplied bytes", {oid: unverified})]));
	assert.deepEqual(result.documents[0].oid, unverified);
	assert.equal("authenticated" in result, false);
	assert.equal("accepted" in result, false);
});

test("one supplied object identity cannot name differing eligible content", () => {
	const same = oid(42);
	assert.equal(value(request([entry("a.md", "same", {oid: same}), entry("b.md", "same", {oid: same})])).documents.length, 2);
	rejected(request([entry("a.md", "same", {oid: same}), entry("b.md", "different", {oid: same})]), "conflicting_content");
	rejected(request([entry("a.md", "", {oid: same}), entry("b.md", "not empty", {oid: same})]), "conflicting_content");
	rejected(request([entry("a.md", "\uFEFFx", {oid: same}), entry("b.md", "x", {oid: same})]), "conflicting_content");
});

test("buffer views, input metadata and returned records share no mutable source state", () => {
	const backing = Buffer.from("before\uFEFFbody\r\nafter", "utf8");
	const bytes = backing.subarray(6, backing.length - 5);
	const original = Uint8Array.from(bytes);
	const item = entry("a.md", "", {bytes});
	const input = request([item]);
	const result = value(input);
	assert.deepEqual(Uint8Array.from(backing.subarray(6, backing.length - 5)), original, "Reading must not modify caller bytes");
	assert.deepEqual(UTF8.encode(result.documents[0].text), original);
	backing.fill(0);
	item.path = "changed.md";
	item.oid.hex = "a".repeat(40);
	input.snapshot.hex = "b".repeat(40);
	input.entries.length = 0;
	assert.deepEqual(UTF8.encode(result.documents[0].text), original);
	assert.equal(result.documents[0].path, "a.md");
	assert.deepEqual(result.snapshot, oid(1));
	assert.notEqual(result.documents[0].oid.hex, item.oid.hex);
	assert.equal("bytes" in result.documents[0], false);
	for (const object of [result, result.snapshot, result.documents, result.documents[0], result.documents[0].oid, result.exclusions]) {
		assert.ok(Object.isFrozen(object));
	}
	assert.throws(() => { result.documents[0].text = "rewrite"; }, TypeError);
	assert.throws(() => { result.documents[0].oid.hex = "f".repeat(40); }, TypeError);
});

test("repeated calls preserve input order and have no retained mutable corpus state", () => {
	const input = request([entry("z.md", "Z"), entry("a.md", "A"), {path: "b.bin", mode: "100644", oid: oid(2)}]);
	const original = structuredClone(input);
	const first = value(input);
	assert.deepEqual(first, value(input));
	assert.deepEqual(input, original);
	assert.deepEqual(first.documents.map(item => item.path), ["z.md", "a.md"]);
	assert.ok(Object.isFrozen(first.exclusions[0]));
	assert.ok(Object.isFrozen(first.exclusions[0].oid));
	assert.deepEqual(value(request()).documents, []);
	assert.equal(first.documents.length, 2);
});
