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
	"src/adapters/git/handoff-converter.ts",
	"src/adapters/git/project-config.ts",
	"src/adapters/git/project-store.ts",
	"src/adapters/git/wiki.ts",
	"src/adapters/preview/local.ts",
	"src/api/client/index.ts",
	"src/api/contracts/command.ts",
	"src/api/contracts/read.ts",
	"src/api/transport/envelope.ts",
	"src/index.ts",
	"src/kernel/canonical/contract.ts",
	"src/kernel/canonical/json.ts",
	"src/kernel/canonical/outcome.ts",
	"src/kernel/changes/contracts.ts",
	"src/kernel/changes/events.ts",
	"src/kernel/changes/reducer.ts",
	"src/kernel/changes/snapshot.ts",
	"src/kernel/changes/trace.ts",
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
	"src/kernel/wiki/file.ts",
	"src/kernel/wiki/item.ts",
	"src/kernel/wiki/links.ts",
	"src/kernel/wiki/ownership.ts",
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
	"src/server/queries/project.ts",
	"src/server/queries/source.ts",
	"src/server/queries/wiki.ts",
	"src/server/recovery/facts.ts",
];
const TEST_ALLOWLIST = [
	"tests/adapters/dsh/agent-runtime.test.mjs",
	"tests/adapters/dsh/fixtures/replay-session.jsonl",
	"tests/adapters/dsh/local-execution-host.test.mjs",
	"tests/adapters/dsh/session-runner.test.mjs",
	"tests/adapters/git/bootstrap.test.mjs",
	"tests/adapters/git/handoff-converter.test.mjs",
	"tests/adapters/git/project-config.test.mjs",
	"tests/adapters/git/project-store.test.mjs",
	"tests/adapters/git/wiki.test.mjs",
	"tests/adapters/preview/local.test.mjs",
	"tests/api/client/index.test.mjs",
	"tests/api/contracts/read.test.mjs",
	"tests/api/transport/envelope.test.mjs",
	"tests/kernel/canonical/canonical-json.test.mjs",
	"tests/kernel/canonical/contract.test.mjs",
	"tests/kernel/canonical/outcome.test.mjs",
	"tests/kernel/changes/contracts.test.mjs",
	"tests/kernel/changes/events.test.mjs",
	"tests/kernel/changes/reducer.test.mjs",
	"tests/kernel/changes/snapshot.test.mjs",
	"tests/kernel/changes/trace.test.mjs",
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
	"tests/kernel/wiki/fixtures.mjs",
	"tests/kernel/wiki/item.test.mjs",
	"tests/kernel/wiki/ownership.test.mjs",
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
	"tests/server/queries/read-api.test.mjs",
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
	const forbiddenCalls = [];
	const visit = (node) => {
		if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
			imports.push(node.moduleSpecifier.text);
		}
		if (ts.isCallExpression(node)) {
			if (node.expression.kind === ts.SyntaxKind.ImportKeyword) forbiddenCalls.push("dynamic import");
			if (ts.isIdentifier(node.expression) && ["require", "eval"].includes(node.expression.text)) forbiddenCalls.push(node.expression.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return {imports, forbiddenCalls};
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
	const paths = [...SOURCE_ALLOWLIST, "package.json", "package-lock.json", "tsconfig.json", "tsconfig.build.json", ".codewiki/config.json", ".codewiki/check-packs.lock.json"];
	for (const root of ["check-packs", ".codewiki/check-packs"]) {
		paths.push(...await walk(join(repoRoot, root)));
	}
	return [...new Set(paths)].sort();
}

test("active source and tests equal the frozen allowlist", async () => {
	assert.deepEqual((await walk(join(repoRoot, "src"))).sort(), SOURCE_ALLOWLIST);
	assert.deepEqual((await walk(join(repoRoot, "tests"))).sort(), TEST_ALLOWLIST);
	for (const root of DELETED_ROOTS) {
		await assert.rejects(stat(join(repoRoot, root)), {code: "ENOENT"});
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
		const allowed = path.startsWith("src/adapters/git/") ? [
			"node:child_process",
			"node:crypto",
			"node:fs/promises",
			"node:path",
			"node:url",
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
		assert.ok(allowed.length > 0 && specifiers.every((specifier) => allowed.includes(specifier)), `${path}: ${specifiers.join(", ")}`);
	}
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
	});
	assert.equal(pkg.peerDependencies, undefined);
	assert.equal(pkg.pi, undefined);
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
