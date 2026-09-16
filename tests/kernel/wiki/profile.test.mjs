import assert from "node:assert/strict";
import test from "node:test";
import {
	bindWikiTypes,
	decodeWikiMetadata,
	resolveChangeReference,
	resolveKernelWikiContract,
	KERNEL_WIKI_CONTRACT,
	WIKI_CORE_TYPES,
	WIKI_PROFILE_ID,
	WIKI_PROFILE_LIMITS,
} from "../../../src/kernel/wiki/profile.ts";

import {CHANGEKERNEL_VERSION} from "../../../src/kernel/identity/version.ts";

const UTF8 = new TextEncoder();

function oid(number, algorithm = "sha1") {
	const width = algorithm === "sha1" ? 40 : 64;
	return {algorithm, hex: Number(number).toString(16).padStart(width, "0")};
}

function fields(type, title, extra = {}) {
	return {
		type,
		title,
		"codewiki-origin": ["../../changes/establish-profile"],
		"codewiki-revision": "../../changes/establish-profile",
		...extra,
	};
}

function metadata(path, type, title, extra = {}) {
	const decoded = decodeWikiMetadata(path, fields(type, title, extra));
	assert.equal(decoded.ok, true, decoded.ok ? "" : decoded.error.message);
	return decoded.value;
}

function profileFile(path, type, title, blob, extra = {}) {
	const itemMetadata = metadata(path, type, title, extra);
	const body = `# ${title}\n\nMeaning for ${title}.\n`;
	const text = `---\n${JSON.stringify(itemMetadata.fields)}\n---\n${body}`;
	return Object.freeze({
		profile: WIKI_PROFILE_ID,
		path,
		blob,
		byteLength: UTF8.encode(text).byteLength,
		text,
		body,
		metadata: itemMetadata,
	});
}

function coreFiles() {
	return WIKI_CORE_TYPES.map((name, index) => profileFile(`.changekernel/wiki/types/${name}.md`, "TypeDefinition", name, oid(index + 1)));
}

test("current document bounds and core types are immutable", () => {
	assert.equal(Object.isFrozen(WIKI_PROFILE_LIMITS), true);
	assert.equal(Object.isFrozen(WIKI_CORE_TYPES), true);
	assert.deepEqual([...WIKI_CORE_TYPES], ["Definition", "Entity", "Contract", "Procedure", "Claim", "TypeDefinition"]);
});

test("one Kernel release owns the current document contract without independent profile version selection", () => {
	assert.deepEqual(resolveKernelWikiContract(CHANGEKERNEL_VERSION), {ok: true, value: KERNEL_WIKI_CONTRACT});
	assert.deepEqual(KERNEL_WIKI_CONTRACT, {kernelVersion: CHANGEKERNEL_VERSION, format: WIKI_PROFILE_ID, limits: WIKI_PROFILE_LIMITS});
	assert.equal(Object.isFrozen(KERNEL_WIKI_CONTRACT), true);
	let coerced = 0;
	const hostile = {[Symbol.toPrimitive]() {coerced++; throw new Error("must not execute");}};
	for (const unsupported of [undefined, null, {}, hostile, "latest", "1.0.0", `^${CHANGEKERNEL_VERSION}`, WIKI_PROFILE_ID]) {
		const result = resolveKernelWikiContract(unsupported);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "unsupported_kernel_version");
		assert.equal(result.error.message, "An exact supported ChangeKernel version is required.");
	}
	assert.equal(coerced, 0);
});

test("metadata preserves exact text, unknown inert data, and prototype-looking keys", () => {
	const dangerous = Object.create(null);
	Object.defineProperty(dangerous, "__proto__", {configurable: true, enumerable: true, value: {polluted: true}, writable: true});
	Object.defineProperty(dangerous, "constructor", {configurable: true, enumerable: true, value: "data", writable: true});
	const decomposed = "Cafe\u0301";
	const decoded = decodeWikiMetadata(".changekernel/wiki/research/observation.md", fields("Claim", decomposed, {
		description: decomposed,
		aliases: ["one", "two"],
		tags: ["field"],
		sources: [dangerous],
		approved: true,
	}));
	assert.equal(decoded.ok, true, decoded.ok ? "" : decoded.error.message);
	assert.equal(decoded.value.title, decomposed);
	assert.equal(decoded.value.fields.description, decomposed);
	assert.equal(decoded.value.fields.sources[0].__proto__.polluted, true);
	assert.equal(Object.prototype.polluted, undefined);
	assert.equal(Object.getPrototypeOf(decoded.value.fields), null);
	assert.equal(Object.isFrozen(decoded.value.fields), true);
	assert.equal(Object.isFrozen(decoded.value.fields.sources), true);
	assert.equal(Object.isFrozen(decoded.value.fields.sources[0]), true);
	assert.equal(Object.isFrozen(decoded.value), true);
});

test("metadata rejects reserved unknown fields and malformed optional fields", () => {
	for (const extra of [
		{"codewiki-unknown": true},
		{description: 1},
		{aliases: ["same", "same"]},
		{tags: ["ok", 2]},
		{"codewiki-origin": []},
		{type: "not-Pascal"},
		{title: "   "},
	]) {
		const input = fields("Claim", "Title", extra);
		const result = decodeWikiMetadata(".changekernel/wiki/item.md", input);
		assert.equal(result.ok, false, JSON.stringify(extra));
	}
});

test("metadata copying applies cumulative UTF-8, node, depth, and collection budgets", () => {
	const tooMuchText = decodeWikiMetadata(".changekernel/wiki/item.md", fields("Claim", "Title", {
		unknown: "x".repeat(WIKI_PROFILE_LIMITS.headerBytes),
	}));
	assert.equal(tooMuchText.ok, false);
	assert.equal(tooMuchText.error.code, "limit_exceeded");

	const tooManyEntries = Array.from({length: WIKI_PROFILE_LIMITS.collectionEntries + 1}, (_, index) => index);
	const many = decodeWikiMetadata(".changekernel/wiki/item.md", fields("Claim", "Title", {unknown: tooManyEntries}));
	assert.equal(many.ok, false);
	assert.equal(many.error.code, "limit_exceeded");

	let nested = "value";
	for (let index = 0; index <= WIKI_PROFILE_LIMITS.depth; index += 1) nested = {nested};
	const tooDeep = decodeWikiMetadata(".changekernel/wiki/item.md", fields("Claim", "Title", {unknown: nested}));
	assert.equal(tooDeep.ok, false);
	assert.equal(tooDeep.error.code, "limit_exceeded");
});

test("Change references resolve lexically and retain original spelling", () => {
	const original = "./../../changes/cafe\u0301";
	const result = resolveChangeReference(".changekernel/wiki/research/item.md", original);
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.equal(result.value.reference, original);
	assert.equal(result.value.path, ".changekernel/changes/cafe\u0301");

	for (const reference of [
		"../../../changes/escape",
		"https://example.invalid/change",
		"../../changes//empty",
		"../../changes/" + "x".repeat(WIKI_PROFILE_LIMITS.pathBytes),
	]) {
		const invalid = resolveChangeReference(".changekernel/wiki/item.md", reference);
		assert.equal(invalid.ok, false, reference);
	}

	const equivalent = decodeWikiMetadata(".changekernel/wiki/research/item.md", fields("Claim", "Title", {
		"codewiki-origin": ["../../changes/one", "./../../changes/one"],
	}));
	assert.equal(equivalent.ok, false);
});

test("custom TypeDefinitions require one direct non-meta core base", () => {
	for (const base of ["Definition", "Entity", "Contract", "Procedure", "Claim"]) {
		const valid = decodeWikiMetadata(".changekernel/wiki/types/FieldObservation.md", fields("TypeDefinition", "FieldObservation", {
			"codewiki-base": base,
		}));
		assert.equal(valid.ok, true, base);
		assert.equal(valid.value.base, base);
	}
	for (const [path, title, extra] of [
		[".changekernel/wiki/types/FieldObservation.md", "FieldObservation", {}],
		[".changekernel/wiki/types/FieldObservation.md", "FieldObservation", {"codewiki-base": "TypeDefinition"}],
		[".changekernel/wiki/types/FieldObservation.md", "FieldObservation", {"codewiki-base": ["Claim"]}],
		[".changekernel/wiki/types/FieldObservation.md", "fieldObservation", {"codewiki-base": "Claim"}],
		[".changekernel/wiki/other/FieldObservation.md", "FieldObservation", {"codewiki-base": "Claim"}],
	]) {
		const invalid = decodeWikiMetadata(path, fields("TypeDefinition", title, extra));
		assert.equal(invalid.ok, false, `${path} ${title}`);
	}
});

test("type context binds six core types and custom instances deterministically", () => {
	const definitions = coreFiles();
	const customDefinition = profileFile(".changekernel/wiki/types/FieldObservation.md", "TypeDefinition", "FieldObservation", oid(20), {
		"codewiki-base": "Claim",
	});
	const instance = profileFile(".changekernel/wiki/fieldwork/marsh.md", "FieldObservation", "Marsh survey", oid(21));
	const context = bindWikiTypes(oid(99), [instance, customDefinition, ...definitions].reverse());
	assert.equal(context.ok, true, context.ok ? "" : context.error.message);
	assert.equal(context.value.snapshot.algorithm, "sha1");
	assert.deepEqual(context.value.bindings.map((binding) => binding.item.path), [
		...definitions.map((file) => file.path),
		customDefinition.path,
		instance.path,
	].sort());
	const customBinding = context.value.bindings.find((binding) => binding.item.path === instance.path);
	assert.ok(customBinding);
	assert.equal(customBinding.base, "Claim");
	assert.equal(customBinding.definition.path, customDefinition.path);
	assert.equal(Object.isFrozen(context.value), true);
	assert.equal(Object.isFrozen(context.value.bindings), true);
	assert.equal(Object.isFrozen(customBinding), true);
});

test("type context re-admits metadata and does not reuse caller-owned identities", () => {
	const callerSnapshot = oid(300);
	const callerBlob = oid(301);
	const files = coreFiles();
	files[0] = profileFile(files[0].path, files[0].metadata.type, files[0].metadata.title, callerBlob);
	const context = bindWikiTypes(callerSnapshot, files);
	assert.equal(context.ok, true, context.ok ? "" : context.error.message);
	assert.notStrictEqual(context.value.snapshot, callerSnapshot);
	const changedBinding = context.value.bindings.find((binding) => binding.item.path === files[0].path);
	assert.ok(changedBinding);
	assert.notStrictEqual(changedBinding.item.blob, callerBlob);
	callerSnapshot.hex = "f".repeat(40);
	callerBlob.hex = "e".repeat(40);
	assert.equal(context.value.snapshot.hex, oid(300).hex);
	assert.equal(changedBinding.item.blob.hex, oid(301).hex);

	const stale = {...files[0], metadata: {...files[0].metadata, type: "UnknownType"}};
	const rejected = bindWikiTypes(callerSnapshot, [stale, ...files.slice(1)]);
	assert.equal(rejected.ok, false);
});

test("type context enforces file-count and context-byte limits", () => {
	const definitions = coreFiles();
	assert.equal(bindWikiTypes(oid(1), Array.from({length: WIKI_PROFILE_LIMITS.files + 1}, () => definitions[0])).ok, false);
	const large = Array.from({length: 9}, (_, index) => {
		const path = `.changekernel/wiki/items/large-${index}.md`;
		const item = profileFile(path, "Claim", `Large${index}`, oid(500 + index));
		const padding = "x".repeat(WIKI_PROFILE_LIMITS.fileBytes - item.byteLength);
		const body = item.body + padding;
		const text = item.text + padding;
		return Object.freeze({...item, text, body, byteLength: UTF8.encode(text).byteLength});
	});
	const overContext = bindWikiTypes(oid(1), [...definitions, ...large]);
	assert.equal(overContext.ok, false);
	assert.equal(overContext.error.code, "limit_exceeded");
});

test("type context rejects missing/duplicate/unknown declarations, aliases, collisions, and bad snapshots", () => {
	const definitions = coreFiles();
	assert.equal(bindWikiTypes(oid(1), definitions.slice(1)).ok, false);
	const duplicate = [...definitions, profileFile(definitions[0].path.replace("Definition", "Definition-copy"), "TypeDefinition", "Definition", oid(40))];
	assert.equal(bindWikiTypes(oid(1), duplicate).ok, false);
	const unknown = [...definitions, profileFile(".changekernel/wiki/items/item.md", "MissingType", "Item", oid(41))];
	assert.equal(bindWikiTypes(oid(1), unknown).ok, false);
	const aliasedDefinitions = definitions.map((file) => file.metadata.title === "Claim"
		? profileFile(file.path, "TypeDefinition", "Claim", file.blob, {aliases: ["ClaimAlias"]}) : file);
	const aliasOnly = [...aliasedDefinitions, profileFile(".changekernel/wiki/items/item.md", "ClaimAlias", "Item", oid(42))];
	assert.equal(bindWikiTypes(oid(1), aliasOnly).ok, false);
	const collision = [...definitions, profileFile(".changekernel/wiki/items/item.md", "Claim", "Item", oid(43)), profileFile(".changekernel/wiki/items/item.md/nested.md", "Claim", "Nested", oid(44), {
		"codewiki-origin": ["../../../changes/establish-profile"],
		"codewiki-revision": "../../../changes/establish-profile",
	})];
	assert.equal(bindWikiTypes(oid(1), collision).ok, false);
	assert.equal(bindWikiTypes({algorithm: "sha1", hex: "0".repeat(40)}, definitions).ok, false);
	assert.equal(bindWikiTypes(oid(1, "sha256"), definitions).ok, false);
});

test("metadata rejects accessors, sparse arrays, cycles and non-inert values without mutation", () => {
	let invoked = 0;
	const accessor = fields("Claim", "Title");
	Object.defineProperty(accessor, "extra", {enumerable: true, get() { invoked += 1; return "bad"; }});
	const cyclic = {}; cyclic.self = cyclic;
	for (const input of [accessor, fields("Claim", "Title", {extra: cyclic}),
		fields("Claim", "Title", {extra: new Array(2)}), fields("Claim", "Title", {extra: new Date()}),
		fields("Claim", "Title", {extra: undefined}), fields("Claim", "Title", {extra: "\ud800"}),
		fields("Claim", "Title", {extra: Infinity}), fields("Claim", "Title", {extra: Symbol("data")})]) {
		assert.equal(decodeWikiMetadata(".changekernel/wiki/item.md", input).ok, false);
	}
	assert.equal(invoked, 0);
});

test("metadata budgets count UTF-8 keys, values and nodes at exact boundaries", () => {
	const input = fields("Claim", "Title", {extra: ""});
	const used = Object.entries(input).reduce((sum, [key, value]) =>
		sum + UTF8.encode(key).length + UTF8.encode(Array.isArray(value) ? value.join("") : value).length, 0);
	const remaining = WIKI_PROFILE_LIMITS.headerBytes - used;
	input.extra = "é".repeat(Math.floor(remaining / 2)) + (remaining % 2 ? "x" : "");
	const atLimit = decodeWikiMetadata(".changekernel/wiki/items/item.md", input);
	assert.equal(atLimit.ok, true, atLimit.ok ? "" : atLimit.error.message);
	input.extra += "x";
	assert.equal(decodeWikiMetadata(".changekernel/wiki/items/item.md", input).error.code, "limit_exceeded");
	const nodes = Array.from({length: 9}, () => Array(1000).fill(null));
	assert.equal(decodeWikiMetadata(".changekernel/wiki/item.md", fields("Claim", "Title", {nodes})).error.code, "limit_exceeded");
});

test("context list admission never invokes accessors or custom iteration", () => {
	let invoked = 0;
	const accessor = coreFiles();
	Object.defineProperty(accessor, "0", {enumerable: true, get() { invoked += 1; return coreFiles()[0]; }});
	const iterable = coreFiles();
	iterable[Symbol.iterator] = function* () { invoked += 1; yield* coreFiles(); };
	const sparse = coreFiles(); delete sparse[0];
	for (const files of [accessor, iterable, sparse]) assert.equal(bindWikiTypes(oid(1), files).ok, false);
	assert.equal(invoked, 0);
});

test("context rejects inconsistent body slices and dishonest text lengths", () => {
	const files = coreFiles();
	for (const altered of [
		{...files[0], body: ""},
		{...files[0], body: files[0].body.slice(2)},
		{...files[0], byteLength: 1},
		{...files[0], text: files[0].text + "é"},
	]) assert.equal(bindWikiTypes(oid(1), [altered, ...files.slice(1)]).ok, false);
});

test("SHA-256 context binds all core categories and rejects indirect custom bases", () => {
	const definitions = coreFiles().map((file, index) => ({...file, blob: oid(index + 1, "sha256")}));
	const instances = WIKI_CORE_TYPES.filter((type) => type !== "TypeDefinition").map((type, index) =>
		profileFile(`.changekernel/wiki/${type}.md`, type, type, oid(50 + index, "sha256"), {
			"codewiki-origin": ["../changes/establish-profile"], "codewiki-revision": "../changes/establish-profile",
		}));
	const result = bindWikiTypes(oid(99, "sha256"), [...definitions, ...instances]);
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.deepEqual(new Set(result.value.bindings.map((binding) => binding.base)), new Set(WIKI_CORE_TYPES));
	const bad = decodeWikiMetadata(".changekernel/wiki/types/Special.md", fields("TypeDefinition", "Special", {"codewiki-base": "FieldObservation"}));
	assert.equal(bad.ok, false);
});

// Keep a direct legacy fixture in this suite: the successor reader is never a fallback decoder.
test("legacy envelope data remains rejected by the profiled metadata contract", () => {
	const legacy = decodeWikiMetadata(".changekernel/wiki/item.md", {
		protocol: "codewiki.wiki-item@1.0.0",
		itemId: "cw:item:legacy",
		title: "Legacy",
		itemType: "codewiki.legacy:claim",
		attributes: {},
	});
	assert.equal(legacy.ok, false);
});
