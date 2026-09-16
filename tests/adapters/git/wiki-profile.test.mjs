import assert from "node:assert/strict";
import test from "node:test";
import {decodeKernelWikiFile} from "../../../src/adapters/git/wiki-profile.ts";
import {CHANGEKERNEL_VERSION} from "../../../src/kernel/identity/version.ts";
import {bindWikiTypes, WIKI_CORE_TYPES, WIKI_PROFILE_ID, WIKI_PROFILE_LIMITS} from "../../../src/kernel/wiki/profile.ts";

const UTF8 = new TextEncoder();
const decoder = new TextDecoder();

function oid(number, algorithm = "sha1") {
	const width = algorithm === "sha1" ? 40 : 64;
	return {algorithm, hex: Number(number).toString(16).padStart(width, "0")};
}

function header(extra = {}) {
	return {
		type: "Claim",
		title: "Title",
		"codewiki-origin": ["../../changes/establish-profile"],
		"codewiki-revision": "../../changes/establish-profile",
		...extra,
	};
}

function yamlValue(value) {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
	return String(value);
}

function yamlHeader(values = header()) {
	return Object.entries(values).map(([key, value]) => {
		if (Array.isArray(value)) return `${key}: ${yamlValue(value)}`;
		return `${key}: ${yamlValue(value)}`;
	}).join("\n");
}

function file({headerText = yamlHeader(), body = "# Title\n\nMeaning.\n", path = ".changekernel/wiki/items/title.md", blob = oid(1), mode = "100644", bytes} = {}) {
	return {
		path,
		mode,
		blob,
		bytes: bytes ?? UTF8.encode(`---\n${headerText}\n---\n${body}`),
	};
}

function decode(options = {}) {
	return decodeKernelWikiFile(CHANGEKERNEL_VERSION, file(options));
}

function assertRejected(result, code) {
	assert.equal(result.ok, false, result.ok ? "expected rejection" : result.error.message);
	if (code) assert.equal(result.error.code, code);
}

test("only the current Kernel version selects document decoding, before input access", () => {
	assert.equal(decodeKernelWikiFile(CHANGEKERNEL_VERSION, file()).ok, true);
	assertRejected(decodeKernelWikiFile(CHANGEKERNEL_VERSION, file({headerText: "{}"})), "invalid_metadata");
	let reads = 0;
	const hostile = Object.defineProperty({}, "path", {get() {reads++; throw new Error("must not read");}});
	for (const unsupported of [undefined, null, "latest", "999.0.0", WIKI_PROFILE_ID]) {
		assertRejected(decodeKernelWikiFile(unsupported, hostile), "unsupported_kernel_version");
	}
	assert.equal(reads, 0);
});

test("accepts block/flow YAML, optional unknown data, and exact non-NFC Markdown", () => {
	const decomposed = "Cafe\u0301";
	const result = decode({
		headerText: [
			"type: Claim",
			`title: ${decomposed}`,
			"codewiki-origin:",
			"  - ../../changes/establish-profile",
			"codewiki-revision: ../../changes/establish-profile",
			"description: |",
			"  exact support",
			"aliases: [one, two]",
			"tags:",
			"  - field",
			"sources: {__proto__: inert, approved: true}",
		].join("\n"),
		body: `# ${decomposed}\n\nMeaning remains exact ${decomposed}.\n`,
	});
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.equal(result.value.text.includes(decomposed), true);
	assert.equal(result.value.body, `# ${decomposed}\n\nMeaning remains exact ${decomposed}.\n`);
	assert.equal(result.value.metadata.title, decomposed);
	assert.equal(result.value.metadata.fields.sources.__proto__, "inert");
	assert.equal(Object.getPrototypeOf(result.value.metadata.fields), null);
	assert.equal(Object.isFrozen(result.value), true);
	assert.equal(Object.isFrozen(result.value.metadata), true);
	assert.equal(Object.isFrozen(result.value.blob), true);
});

test("accepts ATX and Setext first H1s and requires nonempty primary content", () => {
	for (const body of ["# Title\n\nA primary paragraph.\n", "Title\n=====\n\nA primary paragraph.\n"]) {
		const result = decode({body});
		assert.equal(result.ok, true, body);
	}
	for (const body of ["# Title\n", "# Title\n\n## Only a heading\n", "# Title\n\n***\n", "# Title\n\n[ref]: https://example.invalid\n"]) {
		assertRejected(decode({body}), "invalid_heading");
	}
});

test("uses actual top-level Markdown H1s rather than regex-like examples", () => {
	for (const body of [
		"> # Title\n\nMeaning.\n",
		"```markdown\n# Title\n```\n\nMeaning.\n",
		"    # Title\n\nMeaning.\n",
		"<h1>Title</h1>\n\nMeaning.\n",
		"# Other\n\nMeaning.\n",
		"Paragraph mentioning # Title\n\nMeaning.\n",
	]) {
		assertRejected(decode({body}), "invalid_heading");
	}
	const formatted = decode({body: "# **Title**\n\nMeaning.\n"});
	assert.equal(formatted.ok, true, formatted.ok ? "" : formatted.error.message);
});

test("comment-only primary content is empty but literal HTML remains data", () => {
	for (const html of ["<!-- empty -->", "<!-- first -->\n<!-- second -->", "<!-- unclosed"]) {
		assertRejected(decode({body: `# Title\n\n${html}\n`}), "invalid_heading");
	}
	assert.equal(decode({body: "# Title\n\n<section>Primary description.</section>\n"}).ok, true);
});

test("requires an exact opening frontmatter delimiter", () => {
	const text = decoder.decode(file().bytes);
	for (const opening of ["oops", "xxx\n", "--- ", "...\n"]) {
		assertRejected(decode({bytes: UTF8.encode(opening + text.slice(4))}), "invalid_yaml");
	}
});

test("snapshots native bytes without shadow getters, iterators or species", () => {
	let invoked = 0;
	const input = file();
	for (const key of ["byteLength", "byteOffset", "buffer", Symbol.iterator]) {
		Object.defineProperty(input.bytes, key, {get() { invoked += 1; throw new Error("must not run"); }});
	}
	const result = decodeKernelWikiFile(CHANGEKERNEL_VERSION, input);
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.equal(result.value.byteLength, file().bytes.byteLength);
	assert.equal(invoked, 0);
	input.bytes.fill(0);
	assert.equal(result.value.text.includes("Meaning."), true);
	const huge = new Uint8Array(WIKI_PROFILE_LIMITS.fileBytes + 1);
	Object.defineProperty(huge, "byteLength", {value: 1});
	assertRejected(decode({bytes: huge}), "limit_exceeded");
	const shared = new Uint8Array(new SharedArrayBuffer(file().bytes.byteLength));
	shared.set(file().bytes);
	assertRejected(decode({bytes: shared}), "invalid_file");
	const subarray = new Uint8Array(file().bytes.byteLength + 4);
	subarray.set(file().bytes, 2);
	assert.equal(decode({bytes: subarray.subarray(2, -2)}).ok, true);
	assert.equal(decode({bytes: Buffer.from(file().bytes)}).ok, true);
});

test("accepts exact byte/header limits and rejects one-byte overruns", () => {
	const input = file();
	const padding = WIKI_PROFILE_LIMITS.fileBytes - input.bytes.byteLength;
	assert.equal(decode({body: `# Title\n\nMeaning.\n${"x".repeat(padding)}`}).ok, true);
	assertRejected(decode({body: `# Title\n\nMeaning.\n${"x".repeat(padding + 1)}`}), "limit_exceeded");
	const prefix = yamlHeader() + "\n# ";
	const remaining = WIKI_PROFILE_LIMITS.headerBytes - UTF8.encode(prefix).length;
	const atLimit = prefix + "é".repeat(Math.floor(remaining / 2)) + (remaining % 2 ? "x" : "");
	assert.equal(decode({headerText: atLimit}).ok, true);
	assertRejected(decode({headerText: atLimit + "x"}), "limit_exceeded");
});

test("decodes a complete SHA-256 type context from exact profile bytes", () => {
	const sources = WIKI_CORE_TYPES.map((title, index) => file({
		path: `.changekernel/wiki/types/${title}.md`, blob: oid(index + 1, "sha256"),
		headerText: yamlHeader(header({type: "TypeDefinition", title})), body: `# ${title}\n\nCategory meaning.\n`,
	}));
	sources.push(file({path: ".changekernel/wiki/types/FieldObservation.md", blob: oid(10, "sha256"),
		headerText: yamlHeader(header({type: "TypeDefinition", title: "FieldObservation", "codewiki-base": "Claim"})),
		body: "# FieldObservation\n\nSpecialized claim.\n",
	}));
	sources.push(file({blob: oid(11, "sha256"), headerText: yamlHeader(header({type: "FieldObservation"}))}));
	const parsed = sources.map((source) => {
		const decoded = decodeKernelWikiFile(CHANGEKERNEL_VERSION, source);
		assert.equal(decoded.ok, true, decoded.ok ? "" : decoded.error.message);
		assert.equal(decoded.value.text, decoder.decode(source.bytes));
		return decoded.value;
	});
	const context = bindWikiTypes(oid(90, "sha256"), parsed);
	assert.equal(context.ok, true, context.ok ? "" : context.error.message);
	const binding = context.value.bindings.find((item) => item.item.path === sources.at(-1).path);
	assert.equal(binding.base, "Claim");
	assert.deepEqual(binding.definition.blob, sources.at(-2).blob);
	assert.deepEqual(context.value.snapshot, oid(90, "sha256"));
});

test("requires explicit profile selection and does not fall back to legacy envelopes", () => {
	const input = file();
	assertRejected(decodeKernelWikiFile(undefined, input), "unsupported_kernel_version");
	assertRejected(decodeKernelWikiFile("codewiki.wiki-item@1.0.0", input), "unsupported_kernel_version");
	const legacy = file({headerText: JSON.stringify({
		protocol: "codewiki.wiki-item@1.0.0",
		itemId: "cw:item:legacy",
		itemType: "codewiki.legacy:claim",
		title: "Title",
		aliases: [],
		attributes: {},
		relationships: [],
		provenance: [],
	})});
	assertRejected(decodeKernelWikiFile(CHANGEKERNEL_VERSION, legacy), "invalid_metadata");
});

test("rejects malformed file descriptors, encoding, line endings, paths, and modes", () => {
	assertRejected(decode({bytes: Uint8Array.from([0xc3, 0x28])}), "invalid_file");
	assertRejected(decode({bytes: UTF8.encode("\uFEFF---\ntype: Claim\n---\n# Title\n\nMeaning")}), "invalid_file");
	assertRejected(decode({bytes: UTF8.encode(`---\r\ntype: Claim\r\n---\r\n# Title\r\n\r\nMeaning`) }), "invalid_file");
	assertRejected(decode({bytes: UTF8.encode(`---\ntype: Claim\ntitle: Title\ncodewiki-origin: [../../changes/x]\ncodewiki-revision: ../../changes/x\n---\n# Title\n\n\0`) }), "invalid_file");
	assertRejected(decode({path: ".changekernel/wiki/items/../title.md"}), "invalid_file");
	assertRejected(decode({path: ".changekernel/wiki/items/title.md", mode: "100755"}), "invalid_file");
	assertRejected(decode({blob: {algorithm: "sha1", hex: "0".repeat(40)}}), "invalid_file");
	assertRejected(decode({path: ".changekernel/wiki/items/title.md", bytes: "not bytes"}), "invalid_file");
});

test("rejects unsupported YAML constructs and extra documents before composition", () => {
	for (const yaml of [
		"---\ntype: Claim\ntitle: Title\ncodewiki-origin: [../../changes/x]\ncodewiki-revision: ../../changes/x\n---\n",
		"type: Claim\ntitle: Title\ncodewiki-origin: [../../changes/x]\ncodewiki-revision: ../../changes/x\n...\nextra: value",
		"%YAML 1.2\ntype: Claim\ntitle: Title\ncodewiki-origin: [../../changes/x]\ncodewiki-revision: ../../changes/x",
		"type: !!str Claim\ntitle: Title\ncodewiki-origin: [../../changes/x]\ncodewiki-revision: ../../changes/x",
		"type: Claim\ntitle: Title\ncodewiki-origin: [../../changes/x]\ncodewiki-revision: ../../changes/x\nvalue: &same value",
		"type: Claim\ntitle: Title\ncodewiki-origin: [../../changes/x]\ncodewiki-revision: ../../changes/x\nvalue: *same",
		"type: Claim\ntitle: Title\ncodewiki-origin: [../../changes/x]\ncodewiki-revision: ../../changes/x\nvalue: {<<: {other: value}}",
	]) {
		assertRejected(decode({headerText: yaml}));
	}
	assertRejected(decode({headerText: "type: Claim\ntitle: Title\ncodewiki-origin: [../../changes/x]\ncodewiki-revision: ../../changes/x\na: one\na: two"}));
});

test("accepts JSON-compatible scalars and rejects unsupported implicit scalar spellings", () => {
	const accepted = decode({headerText: [
		"type: Claim",
		"title: Title",
		"codewiki-origin: [../../changes/x]",
		"codewiki-revision: ../../changes/x",
		"nullValue: null",
		"trueValue: true",
		"falseValue: false",
		"integerValue: 42",
		"fractionValue: -1.25",
		"exponentValue: 1e2",
		"quotedNumber: \"01\"",
		"emptyString: \"\"",
	].join("\n")});
	assert.equal(accepted.ok, true, accepted.ok ? "" : accepted.error.message);
	assert.equal(accepted.value.metadata.fields.nullValue, null);
	assert.equal(accepted.value.metadata.fields.trueValue, true);
	assert.equal(accepted.value.metadata.fields.integerValue, 42);
	assert.equal(accepted.value.metadata.fields.quotedNumber, "01");
	for (const scalar of ["", "~", "yes", "NO", "on", "01", "+1", "1.", ".5", "1_000", "0x10", "0o10", "0b10", "1:20", "2025-01-02", ".inf", ".nan", "9007199254740992", "1e309"]) {
		const yaml = [
			"type: Claim",
			"title: Title",
			"codewiki-origin: [../../changes/x]",
			"codewiki-revision: ../../changes/x",
			`value: ${scalar}`,
		].join("\n");
		assertRejected(decode({headerText: yaml}));
	}
});

test("enforces file/header/depth/node/collection boundaries before recursive work", () => {
	assertRejected(decode({bytes: new Uint8Array(WIKI_PROFILE_LIMITS.fileBytes + 1)}), "limit_exceeded");
	const tooLargeHeader = [
		"type: Claim",
		"title: Title",
		"codewiki-origin: [../../changes/x]",
		"codewiki-revision: ../../changes/x",
		`unknown: ${"x".repeat(WIKI_PROFILE_LIMITS.headerBytes)}`,
	].join("\n");
	assertRejected(decode({headerText: tooLargeHeader}), "limit_exceeded");

	let nested = "leaf";
	for (let index = 0; index <= WIKI_PROFILE_LIMITS.depth; index += 1) nested = `x:\n  ${nested.replaceAll("\n", "\n  ")}`;
	assertRejected(decode({headerText: nested}), "limit_exceeded");

	const manyNodes = [
		"type: Claim",
		"title: Title",
		"codewiki-origin: [../../changes/x]",
		"codewiki-revision: ../../changes/x",
		...Array.from({length: 1000}, (_, index) => `unknown${index}: value`),
	].join("\n");
	assertRejected(decode({headerText: manyNodes}), "limit_exceeded");

	const tooMany = Array.from({length: WIKI_PROFILE_LIMITS.collectionEntries + 1}, () => "x").join(", ");
	const collectionHeader = [
		"type: Claim",
		"title: Title",
		"codewiki-origin: [../../changes/x]",
		"codewiki-revision: ../../changes/x",
		`items: [${tooMany}]`,
	].join("\n");
	assertRejected(decode({headerText: collectionHeader}), "limit_exceeded");
});

test("preserves caller purity and copies blob identities", () => {
	const blob = oid(7);
	const bytes = UTF8.encode("---\ntype: Claim\ntitle: Title\ncodewiki-origin: [../../changes/x]\ncodewiki-revision: ../../changes/x\n---\n# Title\n\nMeaning.\n");
	const input = file({blob, bytes});
	const result = decodeKernelWikiFile(CHANGEKERNEL_VERSION, input);
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.notStrictEqual(result.value.blob, blob);
	assert.equal(result.value.text, decoder.decode(bytes));
	const before = result.value.text;
	blob.hex = "f".repeat(40);
	bytes[bytes.length - 1] = 0x58;
	assert.equal(result.value.blob.hex, oid(7).hex);
	assert.equal(result.value.text, before);
});

test("does not invoke descriptor accessors while reading file input", () => {
	let invoked = false;
	const input = {
		get path() {
			invoked = true;
			return ".changekernel/wiki/items/title.md";
		},
		mode: "100644",
		blob: oid(1),
		bytes: UTF8.encode("bad"),
	};
	assertRejected(decodeKernelWikiFile(CHANGEKERNEL_VERSION, input), "invalid_file");
	assert.equal(invoked, false);
});
