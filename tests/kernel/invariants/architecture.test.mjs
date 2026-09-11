import assert from "node:assert/strict";
import {readFile, readdir, stat} from "node:fs/promises";
import {dirname, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import ts from "typescript";
import "../changes/contracts.test.mjs";
import "../changes/events.test.mjs";
import "../changes/reducer.test.mjs";
import "../changes/snapshot.test.mjs";
import "../changes/trace.test.mjs";
import "../evidence/reference.test.mjs";
import "../gates/check-definition.test.mjs";
import "../gates/contracts.test.mjs";
import "../gates/reducer.test.mjs";
import "../gates/selection.test.mjs";
import "../work/contracts.test.mjs";
import "../work/state.test.mjs";
import {partitionWikiAttributes} from "../../../src/kernel/wiki/attributes.ts";
import {
	decodeComponentOwnership,
	ownersForPath,
} from "../../../src/kernel/wiki/ownership.ts";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const SOURCE_ALLOWLIST = [
	"src/adapters/dsh/agent-runtime.ts",
	"src/adapters/dsh/local-execution-host.ts",
	"src/adapters/dsh/session-runner.ts",
	"src/adapters/git/bootstrap.ts",
	"src/adapters/git/local-server.ts",
	"src/adapters/git/project-config.ts",
	"src/adapters/git/project-store.ts",
	"src/adapters/git/wiki-profile.ts",
	"src/adapters/git/wiki.ts",
	"src/adapters/preview/local.ts",
	"src/api/client/console.ts",
	"src/api/client/index.ts",
	"src/api/contracts/command.ts",
	"src/api/contracts/read.ts",
	"src/api/transport/envelope.ts",
	"src/index.ts",
	"src/kernel/changes/contracts.ts",
	"src/kernel/changes/events.ts",
	"src/kernel/changes/reducer.ts",
	"src/kernel/changes/snapshot.ts",
	"src/kernel/changes/trace.ts",
	"src/kernel/data-contracts/canonical-json.ts",
	"src/kernel/data-contracts/outcome.ts",
	"src/kernel/data-contracts/validation.ts",
	"src/kernel/evidence/reference.ts",
	"src/kernel/gates/check-definition.ts",
	"src/kernel/gates/contracts.ts",
	"src/kernel/gates/reducer.ts",
	"src/kernel/gates/selection.ts",
	"src/kernel/identity/base32.ts",
	"src/kernel/identity/build.ts",
	"src/kernel/identity/git.ts",
	"src/kernel/identity/semantic-digest.ts",
	"src/kernel/identity/sha256.ts",
	"src/kernel/index.ts",
	"src/kernel/wiki/attributes.ts",
	"src/kernel/wiki/corpus.ts",
	"src/kernel/wiki/file.ts",
	"src/kernel/wiki/item.ts",
	"src/kernel/wiki/links.ts",
	"src/kernel/wiki/ownership.ts",
	"src/kernel/wiki/profile.ts",
	"src/kernel/wiki/transaction.ts",
	"src/kernel/wiki/tree.ts",
	"src/kernel/wiki/views.ts",
	"src/kernel/work/contracts.ts",
	"src/kernel/work/state.ts",
	"src/ports/agent-runtime.ts",
	"src/ports/check-runner.ts",
	"src/ports/preview.ts",
	"src/ports/project-store.ts",
	"src/product.ts",
	"src/server/authorization/policy.ts",
	"src/server/commands/gates.ts",
	"src/server/commands/lifecycle.ts",
	"src/server/commands/repository.ts",
	"src/server/effects/agent-runs.ts",
	"src/server/index.ts",
	"src/server/queries/material-source.ts",
	"src/server/queries/profile-source.ts",
	"src/server/queries/project.ts",
	"src/server/queries/source.ts",
	"src/server/queries/wiki.ts",
	"src/server/recovery/facts.ts",
];
const BIN_ALLOWLIST = ["bin/codewiki.mjs"];
const TEST_ALLOWLIST = [
	"tests/adapters/dsh/agent-runtime.test.mjs",
	"tests/adapters/dsh/fixtures/replay-session.jsonl",
	"tests/adapters/dsh/local-execution-host.test.mjs",
	"tests/adapters/dsh/session-runner.test.mjs",
	"tests/adapters/git/bootstrap.test.mjs",
	"tests/adapters/git/codewiki-bin.test.mjs",
	"tests/adapters/git/local-read-purity.test.mjs",
	"tests/adapters/git/local-server.test.mjs",
	"tests/adapters/git/project-config.test.mjs",
	"tests/adapters/git/project-store.test.mjs",
	"tests/adapters/git/wiki-profile.test.mjs",
	"tests/adapters/git/wiki.test.mjs",
	"tests/adapters/preview/local.test.mjs",
	"tests/api/client/cli-command.test.mjs",
	"tests/api/client/console.test.mjs",
	"tests/api/client/index.test.mjs",
	"tests/api/contracts/read.test.mjs",
	"tests/api/transport/envelope.test.mjs",
	"tests/kernel/changes/contracts.test.mjs",
	"tests/kernel/changes/events.test.mjs",
	"tests/kernel/changes/reducer.test.mjs",
	"tests/kernel/changes/snapshot.test.mjs",
	"tests/kernel/changes/trace.test.mjs",
	"tests/kernel/data-contracts/canonical-json.test.mjs",
	"tests/kernel/data-contracts/outcome.test.mjs",
	"tests/kernel/data-contracts/validation.test.mjs",
	"tests/kernel/evidence/reference.test.mjs",
	"tests/kernel/gates/check-definition.test.mjs",
	"tests/kernel/gates/contracts.test.mjs",
	"tests/kernel/gates/reducer.test.mjs",
	"tests/kernel/gates/selection.test.mjs",
	"tests/kernel/identity/build.test.mjs",
	"tests/kernel/identity/git.test.mjs",
	"tests/kernel/identity/semantic-digest.test.mjs",
	"tests/kernel/identity/sha256.test.mjs",
	"tests/kernel/invariants/architecture.test.mjs",
	"tests/kernel/invariants/determinism.test.mjs",
	"tests/kernel/wiki/attributes.test.mjs",
	"tests/kernel/wiki/corpus.test.mjs",
	"tests/kernel/wiki/fixtures.mjs",
	"tests/kernel/wiki/item.test.mjs",
	"tests/kernel/wiki/ownership.test.mjs",
	"tests/kernel/wiki/profile.test.mjs",
	"tests/kernel/wiki/properties.test.mjs",
	"tests/kernel/wiki/transaction.test.mjs",
	"tests/kernel/wiki/tree.test.mjs",
	"tests/kernel/wiki/views.test.mjs",
	"tests/kernel/work/contracts.test.mjs",
	"tests/kernel/work/state.test.mjs",
	"tests/package/composition.test.mjs",
	"tests/ports/agent-runtime.test.mjs",
	"tests/ports/check-runner.test.mjs",
	"tests/ports/preview.test.mjs",
	"tests/ports/project-store.test.mjs",
	"tests/server/authorization/policy.test.mjs",
	"tests/server/commands/lifecycle.test.mjs",
	"tests/server/effects/agent-runs.test.mjs",
	"tests/server/effects/containment.test.mjs",
	"tests/server/index.test.mjs",
	"tests/server/queries/profile-source.test.mjs",
	"tests/server/queries/read-api.test.mjs",
	"tests/server/queries/source-material.test.mjs",
];
const DELETED_ROOTS = [
	"benchmarks",
	"diagnostics",
	"rules",
	"scripts",
	".tmp-worktrees",
];
const FORBIDDEN_SOURCE_FRAGMENTS = [
	"/domains/",
	"/knowledge/kb",
	"backend-v1",
	"runtime/builds",
	"pi-extension",
];

async function walk(root) {
	const output = [];
	for (const name of (await readdir(root)).sort()) {
		const path = join(root, name);
		const details = await stat(path);
		if (details.isDirectory()) output.push(...await walk(path));
		else output.push(relative(repoRoot, path).split("\\").join("/"));
	}
	return output;
}

function parseImports(path, text) {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
	const imports = [];
	const dynamicImports = [];
	const forbiddenCalls = [];
	const visit = (node) => {
		if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
			imports.push(node.moduleSpecifier.text);
		}
		if (ts.isCallExpression(node)) {
			if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
				forbiddenCalls.push("dynamic import");
				const specifier = node.arguments[0];
				dynamicImports.push(node.arguments.length === 1 && specifier && ts.isStringLiteral(specifier) ? specifier.text : null);
			}
			if (ts.isIdentifier(node.expression) && ["require", "eval"].includes(node.expression.text)) forbiddenCalls.push(node.expression.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return {imports, dynamicImports, forbiddenCalls};
}

function relativeTarget(from, specifier) {
	if (!specifier.startsWith(".")) return null;
	return relative(repoRoot, resolve(dirname(join(repoRoot, from)), specifier)).split("\\").join("/");
}

async function sourceGraph() {
	const graph = new Map();
	const external = new Map();
	const calls = new Map();
	for (const path of SOURCE_ALLOWLIST) {
		const text = await readFile(join(repoRoot, path), "utf8");
		const parsed = parseImports(path, text);
		const internal = [];
		for (const specifier of parsed.imports) {
			const target = relativeTarget(path, specifier);
			if (target === null) {
				if (!external.has(path)) external.set(path, []);
				external.get(path).push(specifier);
			} else internal.push(target);
		}
		graph.set(path, internal.sort());
		if (parsed.forbiddenCalls.length > 0) calls.set(path, parsed.forbiddenCalls);
	}
	return {graph, external, calls};
}

function cycles(graph) {
	const found = [];
	const visiting = [];
	const active = new Set();
	const complete = new Set();
	const visit = (path) => {
		if (complete.has(path)) return;
		if (active.has(path)) {
			found.push([...visiting.slice(visiting.indexOf(path)), path]);
			return;
		}
		active.add(path);
		visiting.push(path);
		for (const target of graph.get(path) ?? []) visit(target);
		visiting.pop();
		active.delete(path);
		complete.add(path);
	};
	for (const path of [...graph.keys()].sort()) visit(path);
	return found;
}

function reachable(graph, root) {
	const found = new Set();
	const queue = [root];
	while (queue.length > 0) {
		const current = queue.pop();
		if (!current || found.has(current)) continue;
		found.add(current);
		queue.push(...(graph.get(current) ?? []));
	}
	return [...found].sort();
}

async function wikiOwnership() {
	const ownership = [];
	for (const path of await walk(join(repoRoot, ".codewiki", "wiki", "items"))) {
		const text = await readFile(join(repoRoot, path), "utf8");
		if (!text.startsWith("---\n")) continue;
		const end = text.indexOf("\n---\n", 4);
		assert.notEqual(end, -1, path);
		const header = JSON.parse(text.slice(4, end));
		const partitioned = partitionWikiAttributes(header.attributes ?? {});
		assert.equal(partitioned.ok, true, path);
		assert.ok(Object.keys(partitioned.value.semantic).every((key) => !key.startsWith("codewiki.legacy:")), path);
		assert.ok(Object.keys(partitioned.value.provenance).every((key) => key.startsWith("codewiki.legacy:")), path);
		const decoded = decodeComponentOwnership(header.itemId, header.attributes ?? {});
		assert.equal(decoded.ok, true, `${path}: ${decoded.error?.message ?? "invalid ownership"}`);
		if (decoded.value !== null) ownership.push(decoded.value);
	}
	return ownership;
}

async function productionOwnershipPaths() {
	const paths = [...SOURCE_ALLOWLIST, ...BIN_ALLOWLIST, "package.json", "package-lock.json", "tsconfig.json", "tsconfig.build.json", ".codewiki/config.json", ".codewiki/check-packs.lock.json"];
	// Project policy is optional; adopted files still require native ownership.
	const checkPacks = await stat(join(repoRoot, ".codewiki/check-packs")).catch(error => {
		if (error.code === "ENOENT") return null;
		throw error;
	});
	if (checkPacks !== null) paths.push(...await walk(join(repoRoot, ".codewiki/check-packs")));
	return [...new Set(paths)].sort();
}

test("active source and tests equal the frozen allowlist", async () => {
	assert.deepEqual((await walk(join(repoRoot, "src"))).sort(), SOURCE_ALLOWLIST);
	assert.deepEqual((await walk(join(repoRoot, "tests"))).sort(), TEST_ALLOWLIST);
	assert.deepEqual((await walk(join(repoRoot, "bin"))).sort(), BIN_ALLOWLIST);
	for (const root of DELETED_ROOTS) {
		await assert.rejects(stat(join(repoRoot, root)), {code: "ENOENT"});
	}
});

test("shipped executables bind only Node utilities and the curated runtime entrypoint", async () => {
	const pkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
	assert.deepEqual(Object.values(pkg.bin).map(path => path.replace(/^\.\//u, "")).sort(), BIN_ALLOWLIST);
	for (const path of BIN_ALLOWLIST) {
		const parsed = parseImports(path, await readFile(join(repoRoot, path), "utf8"));
		assert.deepEqual(parsed.imports.sort(), ["node:path", "node:process"], path);
		assert.deepEqual(parsed.dynamicImports, ["../dist/index.js"], path);
		assert.deepEqual(parsed.forbiddenCalls, ["dynamic import"], path);
	}
});

test("source graph is closed, acyclic, and contains no dynamic loader", async () => {
	const {graph, external, calls} = await sourceGraph();
	for (const [from, targets] of graph) {
		for (const target of targets) assert.ok(graph.has(target), `${from} -> missing ${target}`);
	}
	assert.deepEqual(cycles(graph), []);
	assert.deepEqual([...calls], []);
	for (const [path, specifiers] of external) {
		const allowed = path === "src/adapters/git/wiki-profile.ts" ? [
			"mdast-util-from-markdown",
			"yaml",
		] : path.startsWith("src/adapters/git/") ? [
			"node:child_process",
			"node:crypto",
			"node:fs/promises",
			"node:path",
			"node:url",
			"node:util",
		] : path.startsWith("src/adapters/dsh/") ? [
			"@deepseek-ai/cordis",
			"@deepseek-ai/dsh-agent",
			"@deepseek-ai/dsh-agent-loop",
			"@deepseek-ai/dsh-agent-loop/invariant",
			"@deepseek-ai/dsh-agent/invariant",
			"@deepseek-ai/dsh-invariants",
			"@deepseek-ai/dsh-llm",
			"@deepseek-ai/dsh-session",
			"@deepseek-ai/dsh-session/invariant",
			"@deepseek-ai/dsh-session-persistence-jsonl",
			"@deepseek-ai/dsh-system-prompt",
			"@deepseek-ai/dsh-tools",
			"node:path",
		] : [];
		if (path === "src/adapters/git/project-store.ts") allowed.push("node:fs");
		assert.ok(allowed.length > 0 && specifiers.every((specifier) => allowed.includes(specifier)), `${path}: ${specifiers.join(", ")}`);
	}
});

test("Store filesystem allowance is limited to the reviewed root-observation imports", async () => {
	const path = "src/adapters/git/project-store.ts";
	const source = ts.createSourceFile(path, await readFile(join(repoRoot, path), "utf8"), ts.ScriptTarget.Latest, true);
	const declarations = source.statements.filter(statement =>
		(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
		statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "node:fs",
	);
	assert.equal(declarations.length, 1, "No extra fs imports or re-exports");
	const declaration = declarations[0];
	assert.ok(ts.isImportDeclaration(declaration));
	const clause = declaration.importClause;
	assert.ok(clause && !clause.name && !clause.isTypeOnly, "Only named runtime imports are admitted");
	assert.ok(clause.namedBindings && ts.isNamedImports(clause.namedBindings), "No namespace import");
	assert.deepEqual(clause.namedBindings.elements.map(element => (element.propertyName ?? element.name).text).sort(), ["lstatSync", "realpathSync"]);
});

test("Kernel imports only Kernel modules and has no ambient effects", async () => {
	const {graph, external} = await sourceGraph();
	for (const [path, targets] of graph) {
		if (!path.startsWith("src/kernel/")) continue;
		assert.equal(external.has(path), false, path);
		assert.ok(targets.every((target) => target.startsWith("src/kernel/")), `${path}: ${targets.join(", ")}`);
		const text = await readFile(join(repoRoot, path), "utf8");
		for (const token of ["process.", "Date.now", "Math.random", "fetch(", "WebSocket", "randomUUID", "node:"]) {
			assert.equal(text.includes(token), false, `${path}: ${token}`);
		}
	}
});

test("corpus remains internal with a bounded data/identity import closure", async () => {
	const {graph} = await sourceGraph();
	const corpus = "src/kernel/wiki/corpus.ts";
	assert.deepEqual(reachable(graph, corpus), [
		"src/kernel/data-contracts/canonical-json.ts",
		"src/kernel/data-contracts/outcome.ts",
		"src/kernel/data-contracts/validation.ts",
		"src/kernel/identity/git.ts",
		corpus,
	]);
	for (const entrypoint of ["src/index.ts", "src/kernel/index.ts"]) {
		assert.equal(reachable(graph, entrypoint).includes(corpus), false, entrypoint);
	}
});

test("material loading stays internal and only composes source, Store and passive corpus contracts", async () => {
	const {graph, external} = await sourceGraph();
	const material = "src/server/queries/material-source.ts";
	assert.deepEqual(graph.get(material), [
		"src/api/contracts/read.ts",
		"src/kernel/changes/snapshot.ts",
		"src/kernel/data-contracts/outcome.ts",
		"src/kernel/identity/git.ts",
		"src/kernel/wiki/corpus.ts",
		"src/ports/project-store.ts",
		"src/server/queries/source.ts",
	]);
	assert.equal(external.has(material), false, "No parser, filesystem, runtime or model dependency");
	for (const entrypoint of ["src/index.ts", "src/kernel/index.ts"]) {
		assert.equal(reachable(graph, entrypoint).includes(material), false, "No public material/adoption API in this repair");
	}
	assert.deepEqual([...graph].filter(([, targets]) => targets.includes(material)).map(([path]) => path), ["src/server/queries/profile-source.ts"]);
});

test("profiled material loading stays private and keeps parser ownership at the adapter boundary", async () => {
	const {graph, external} = await sourceGraph();
	const profiled = "src/server/queries/profile-source.ts";
	assert.deepEqual(graph.get(profiled), [
		"src/adapters/git/wiki-profile.ts",
		"src/api/contracts/read.ts",
		"src/kernel/changes/snapshot.ts",
		"src/kernel/data-contracts/outcome.ts",
		"src/kernel/wiki/corpus.ts",
		"src/kernel/wiki/profile.ts",
		"src/ports/project-store.ts",
		"src/server/queries/material-source.ts",
		"src/server/queries/source.ts",
	]);
	assert.equal(external.has(profiled), false);
	for (const entrypoint of ["src/index.ts", "src/kernel/index.ts"]) {
		assert.equal(reachable(graph, entrypoint).includes(profiled), false, entrypoint);
	}
	assert.deepEqual([...graph].filter(([, targets]) => targets.includes(profiled)).map(([path]) => path), []);
	assert.deepEqual([...graph].filter(([, targets]) => targets.includes("src/adapters/git/wiki-profile.ts")).map(([path]) => path), [
		"src/server/queries/profile-source.ts",
	]);
});

test("Client and transport APIs cannot import adapters, ports, Product policy, or Project Server internals", async () => {
	const {graph, external} = await sourceGraph();
	for (const [path, targets] of graph) {
		if (!path.startsWith("src/api/")) continue;
		assert.equal(external.has(path), false, path);
		assert.ok(targets.every((target) => target.startsWith("src/api/") || target.startsWith("src/kernel/")), `${path}: ${targets.join(", ")}`);
	}
});

test("public reachability contains only target foundation paths", async () => {
	const {graph} = await sourceGraph();
	const paths = reachable(graph, "src/index.ts");
	assert.ok(paths.includes("src/product.ts"));
	assert.ok(paths.includes("src/adapters/git/bootstrap.ts"));
	for (const path of paths) {
		for (const fragment of FORBIDDEN_SOURCE_FRAGMENTS) {
			assert.equal(path.includes(fragment), false, `${path}: ${fragment}`);
		}
	}
	const pkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
	assert.deepEqual(Object.keys(pkg.exports), [".", "./package.json"]);
	assert.deepEqual(pkg.dependencies, {
		"@deepseek-ai/cordis": "4.0.1",
		"@deepseek-ai/dsh-agent": "0.1.1-rc.2",
		"@deepseek-ai/dsh-agent-loop": "0.1.1-rc.2",
		"@deepseek-ai/dsh-invariants": "0.1.1-rc.2",
		"@deepseek-ai/dsh-llm": "0.1.1-rc.2",
		"@deepseek-ai/dsh-session": "0.1.1-rc.2",
		"@deepseek-ai/dsh-session-persistence-jsonl": "0.1.1-rc.2",
		"@deepseek-ai/dsh-system-prompt": "0.1.1-rc.2",
		"@deepseek-ai/dsh-tools": "0.1.1-rc.2",
		"mdast-util-from-markdown": "2.0.3",
		"yaml": "2.9.0",
	});
	assert.equal(pkg.peerDependencies, undefined);
	assert.equal(pkg.pi, undefined);
});

test("profile reader is private and keeps parsing at the adapter boundary", async () => {
	const {graph, external} = await sourceGraph();
	const kernelProfile = "src/kernel/wiki/profile.ts";
	const adapterProfile = "src/adapters/git/wiki-profile.ts";
	assert.deepEqual(graph.get(kernelProfile), [
		"src/kernel/data-contracts/outcome.ts",
		"src/kernel/identity/git.ts",
	]);
	assert.deepEqual(graph.get(adapterProfile), [
		"src/kernel/data-contracts/outcome.ts",
		"src/kernel/identity/git.ts",
		"src/kernel/wiki/file.ts",
		kernelProfile,
	]);
	assert.deepEqual(external.get(kernelProfile), undefined);
	assert.deepEqual(external.get(adapterProfile), ["mdast-util-from-markdown", "yaml"]);
	assert.equal(reachable(graph, "src/index.ts").includes(kernelProfile), false);
	assert.equal(reachable(graph, "src/index.ts").includes(adapterProfile), false);
	assert.deepEqual([...graph].filter(([, targets]) => targets.includes(kernelProfile)).map(([path]) => path), [adapterProfile, "src/server/queries/profile-source.ts"]);
});

test("native Wiki ownership assigns every production and test path exactly once", async () => {
	const ownership = await wikiOwnership();
	assert.equal(ownership.length, 21);
	const roles = Object.fromEntries(ownership
		.filter((entry) => entry.roles.length > 0)
		.map((entry) => [entry.componentId, entry.roles]));
	assert.deepEqual(roles, {
		"cw:component:checks": ["model-check"],
		"cw:component:decision": ["decision"],
		"cw:component:implementation": ["worker"],
		"cw:component:planning": ["planning"],
		"cw:component:review": ["review"],
	});
	for (const path of await productionOwnershipPaths()) {
		const owners = ownersForPath(ownership, "source", path);
		assert.equal(owners.ok, true, path);
		assert.equal(owners.value.length, 1, `${path}: ${owners.value.join(", ")}`);
	}
	for (const path of TEST_ALLOWLIST) {
		const owners = ownersForPath(ownership, "test", path);
		assert.equal(owners.ok, true, path);
		assert.equal(owners.value.length, 1, `${path}: ${owners.value.join(", ")}`);
	}
});

test("native Wiki ownership assigns the current semantic event catalog exactly once", async () => {
	const traced = Object.fromEntries((await wikiOwnership())
		.filter((entry) => entry.traceEvents.length > 0)
		.map((entry) => [entry.componentId, entry.traceEvents]));
	assert.deepEqual(traced, {
		"cw:component:change-intake": ["change.proposed", "change.revised"],
		"cw:component:checks": ["gate.recorded"],
		"cw:component:decision": ["change.committed", "change.deferred", "change.rejected", "change.resumed", "change.withdrawn"],
		"cw:component:implementation": ["work.assigned", "work.attempt.recorded", "work.claimed", "work.integrated"],
		"cw:component:planning": ["change.planned"],
		"cw:component:project-server": ["change.completed", "change.superseded", "effect.recorded"],
		"cw:component:review": ["review.reconciled"],
	});
	const config = JSON.parse(await readFile(join(repoRoot, ".codewiki", "config.json"), "utf8"));
	assert.equal("domain" in config, false);
	assert.equal(config.protocol.id, "codewiki.project-config");
});
