import assert from "node:assert/strict";
import {readFile, readdir, stat} from "node:fs/promises";
import {dirname, join, matchesGlob, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import ts from "typescript";
import {parse} from "yaml";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const SOURCE_FILES = (await walk(join(repoRoot, "src"))).sort();
const TEST_FILES = (await walk(join(repoRoot, "tests"))).sort();
const BIN_FILES = (await walk(join(repoRoot, "bin"))).sort();

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

const sourceAnalysis = analyzeSource();
function sourceGraph() { return sourceAnalysis; }

async function analyzeSource() {
	const graph = new Map();
	const external = new Map();
	const calls = new Map();
	for (const path of SOURCE_FILES) {
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
	for (const path of await walk(join(repoRoot, ".changekernel", "wiki"))) {
		if (!path.endsWith(".md")) continue;
		const text = await readFile(join(repoRoot, path), "utf8");
		assert.ok(text.startsWith("---\n"), path);
		const end = text.indexOf("\n---\n", 4);
		assert.notEqual(end, -1, path);
		const header = parse(text.slice(4, end));
		assert.equal(typeof header.title, "string", path);
		assert.equal(typeof header["source-id"], "string", path);
		assert.equal("protocol" in header, false, "Source design is not a legacy Item envelope");
		assert.equal("codewiki-origin" in header, false, "Conversion must not invent adoption");
		if (header.ownership) {
			for (const field of ["sourcePatterns", "testPatterns"]) {
				assert.ok(Array.isArray(header.ownership[field]), path + ": " + field);
				assert.ok(header.ownership[field].every(pattern => typeof pattern === "string" && pattern.length > 0), path);
			}
			ownership.push({componentId: header["source-id"], ...header.ownership});
		}
	}
	return ownership;
}

async function productionOwnershipPaths() {
	return [...SOURCE_FILES, ...BIN_FILES, "package.json", "package-lock.json", "tsconfig.json", "tsconfig.build.json"].sort();
}

test("shipped executables bind only Node utilities and the curated runtime entrypoint", async () => {
	const pkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
	assert.deepEqual(Object.values(pkg.bin).map(path => path.replace(/^\.\//u, "")).sort(), BIN_FILES);
	for (const path of BIN_FILES) {
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
		] : path === "src/adapters/checks/journal.ts" ? [
			"node:fs", "node:crypto", "node:fs/promises", "node:path",
		] : path === "src/adapters/checks/linux-host.ts" ? [
			"node:child_process", "node:crypto", "node:fs/promises", "node:path", "node:util",
		] : path.startsWith("src/adapters/pi/") ? [
			"@earendil-works/pi-ai",
			"@earendil-works/pi-ai/api/openai-completions.lazy",
			"@earendil-works/pi-coding-agent",
			"node:fs/promises", "node:path",
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
	assert.equal(reachable(graph, "src/index.ts").includes(corpus), true);
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
	assert.equal(reachable(graph, "src/index.ts").includes(material), true, "Composed through profile lifecycle, not a new package export");
	assert.deepEqual([...graph].filter(([, targets]) => targets.includes(material)).map(([path]) => path), ["src/server/queries/profile-source.ts"]);
});

test("profiled material loading composes only through lifecycle and retains adapter parser ownership", async () => {
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
	assert.equal(reachable(graph, "src/index.ts").includes(profiled), true);
	assert.deepEqual([...graph].filter(([, targets]) => targets.includes(profiled)).map(([path]) => path), ["src/server/commands/lifecycle.ts", "src/server/queries/profile-change.ts"]);
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

	const pkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
	assert.deepEqual(Object.keys(pkg.exports), [".", "./package.json"]);
	for (const [name, version] of Object.entries(pkg.dependencies)) {
		assert.match(version, /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/u, name + ": runtime dependencies must be pinned");
	}
	assert.equal(pkg.peerDependencies, undefined);
	assert.equal(pkg.pi, undefined);
});

test("profile interpretation is composed without moving parsing into the Kernel", async () => {
	const {graph, external} = await sourceGraph();
	const kernelProfile = "src/kernel/wiki/profile.ts";
	const adapterProfile = "src/adapters/git/wiki-profile.ts";
	assert.deepEqual(graph.get(kernelProfile), [
		"src/kernel/data-contracts/outcome.ts",
		"src/kernel/identity/git.ts",
		"src/kernel/identity/version.ts",
	]);
	assert.deepEqual(graph.get("src/kernel/identity/version.ts"), []);
	assert.equal(external.has("src/kernel/identity/version.ts"), false);
	assert.deepEqual(graph.get(adapterProfile), [
		"src/kernel/data-contracts/outcome.ts",
		"src/kernel/identity/git.ts",
		kernelProfile,
	]);
	assert.deepEqual(external.get(kernelProfile), undefined);
	assert.deepEqual(external.get(adapterProfile), ["mdast-util-from-markdown", "yaml"]);
	assert.equal(reachable(graph, "src/index.ts").includes(kernelProfile), true);
	assert.equal(reachable(graph, "src/index.ts").includes(adapterProfile), true);
	assert.deepEqual([...graph].filter(([, targets]) => targets.includes(kernelProfile)).map(([path]) => path), [
		adapterProfile, "src/api/contracts/command.ts", "src/kernel/changes/events.ts", "src/kernel/changes/inquiry.ts", "src/kernel/wiki/profile-reference.ts",
		"src/kernel/wiki/profile-transaction.ts", "src/server/commands/lifecycle.ts", "src/server/index.ts",
		"src/server/queries/profile-change.ts", "src/server/queries/profile-source.ts",
	]);
});

test("profile transaction admission remains pure under exact authorized lifecycle import edges", async () => {
	const {graph, external} = await sourceGraph();
	const transaction = "src/kernel/wiki/profile-transaction.ts";
	assert.deepEqual(graph.get(transaction), [
		"src/kernel/changes/snapshot.ts",
		"src/kernel/data-contracts/outcome.ts",
		"src/kernel/identity/git.ts",
		"src/kernel/identity/semantic-digest.ts",
		"src/kernel/identity/sha256.ts",
		"src/kernel/wiki/profile.ts",
	]);
	assert.deepEqual(external.get(transaction), undefined);
	assert.equal(reachable(graph, "src/index.ts").includes(transaction), true);
	assert.deepEqual([...graph].filter(([, targets]) => targets.includes(transaction)).map(([path]) => path), [
		"src/api/contracts/command.ts", "src/kernel/wiki/profile-reference.ts", "src/server/commands/lifecycle.ts", "src/server/queries/profile-change.ts",
	]);
	for (const [path, forbidden] of [["src/kernel/changes/reducer.ts", "reduceProfileChangeTrace"], ["src/server/commands/repository.ts", "appendProfileTraceCommit"]]) {
		assert.equal((await readFile(join(repoRoot, path), "utf8")).includes(forbidden), false, "No parallel lifecycle implementation");
	}
});

test("inquiry contracts stay internal with only common event/reducer consumers and no alternate lifecycle", async () => {
	const {graph, external} = await sourceGraph();
	const inquiry = "src/kernel/changes/inquiry.ts";
	assert.deepEqual(graph.get(inquiry), [
		"src/kernel/changes/contracts.ts", "src/kernel/changes/snapshot.ts",
		"src/kernel/data-contracts/canonical-json.ts", "src/kernel/data-contracts/outcome.ts", "src/kernel/data-contracts/validation.ts",
		"src/kernel/identity/git.ts", "src/kernel/identity/semantic-digest.ts", "src/kernel/identity/sha256.ts",
		"src/kernel/wiki/profile-reference.ts", "src/kernel/wiki/profile.ts",
	]);
	assert.equal(external.has(inquiry), false);
	assert.deepEqual([...graph].filter(([, targets]) => targets.includes(inquiry)).map(([path]) => path), [
		"src/kernel/changes/events.ts", "src/kernel/changes/reducer.ts",
	]);
	assert.equal((await readFile(join(repoRoot, "src/kernel/changes/reducer.ts"), "utf8")).includes("reduceInquiryChangeTrace"), false);
	assert.equal((await readFile(join(repoRoot, "src/kernel/changes/contracts.ts"), "utf8")).includes("./inquiry.ts"), false, "No cyclic contract re-export");
});

test("optional output retrieval stays below lifecycle policy and outside the Kernel", async () => {
	const {graph, external} = await sourceGraph();
	const output = "src/ports/agent-output.ts", effect = "src/server/effects/agent-output.ts";
	assert.ok(graph.get(output).every(path => path.startsWith("src/kernel/") || path === "src/ports/agent-runtime.ts"));
	assert.deepEqual(graph.get(effect), ["src/kernel/data-contracts/outcome.ts", "src/kernel/gates/decision-output.ts", output, "src/ports/agent-runtime.ts", "src/server/effects/agent-runs.ts"]);
	assert.equal(external.has(output), false);
	assert.equal(external.has(effect), false);
	assert.equal(reachable(graph, "src/server/commands/lifecycle.ts").includes(effect), false, "Output custody alone must not enable lifecycle evaluation");
	assert.equal(reachable(graph, "src/server/commands/lifecycle.ts").includes("src/server/effects/decision-checks.ts"), false, "Source verification alone must not enable lifecycle evaluation");
});

test("project check settings remain outside read-only composition and storage parsing", async () => {
	const {graph, external} = await sourceGraph();
	const bridge = "src/adapters/git/check-model.ts";
	assert.deepEqual(graph.get(bridge), [
		"src/adapters/git/project-config.ts", "src/kernel/data-contracts/canonical-json.ts",
		"src/kernel/data-contracts/outcome.ts", "src/server/effects/agent-runs.ts",
	]);
	assert.equal(external.has(bridge), false);
	for (const entrypoint of ["src/adapters/git/local-server.ts", "src/adapters/git/project-store.ts", "src/server/commands/lifecycle.ts"]) {
		assert.equal(reachable(graph, entrypoint).includes(bridge), false, entrypoint);
	}
});

test("native Wiki ownership assigns every production and test path exactly once", async () => {
	const ownership = await wikiOwnership();
	for (const path of await productionOwnershipPaths()) {
		const owners = ownership.filter(entry => entry.sourcePatterns.some(pattern => matchesGlob(path, pattern)));
		assert.equal(owners.length, 1, `${path}: ${owners.map(entry => entry.componentId).join(", ")}`);
	}
	for (const path of TEST_FILES) {
		const owners = ownership.filter(entry => entry.testPatterns.some(pattern => matchesGlob(path, pattern)));
		assert.equal(owners.length, 1, `${path}: ${owners.map(entry => entry.componentId).join(", ")}`);
	}
});

test("unified Check contracts remain pure and do not activate lifecycle or read-only entrypoints", async () => {
	const {graph, external} = await sourceGraph(), check = "src/kernel/gates/checks.ts";
	assert.equal(graph.has("src/server/effects/decision-intent-fit.ts"), false, "The superseded optional judge must not return outside release-owned Decision validation");
	assert.equal(graph.has("src/kernel/gates/semantic.ts"), false, "Superseded Gate scaffolding must not return");
	assert.equal(external.has(check), false);
	assert.ok(graph.get(check).every(path => path.startsWith("src/kernel/")));
	for (const entrypoint of ["src/index.ts", "src/server/commands/lifecycle.ts", "src/adapters/git/local-server.ts", "src/adapters/git/project-store.ts"]) {
		assert.equal(reachable(graph, entrypoint).includes(check), false, entrypoint);
	}
});

test("release-owned Decision contracts stay pure and private until lifecycle admission is integrated", async () => {
	const {graph, external} = await sourceGraph();
	for (const module of ["src/kernel/gates/decision-validation.ts", "src/kernel/gates/decision-validators.ts", "src/kernel/gates/evaluation-data.ts"]) {
		assert.equal(external.has(module), false);
		assert.ok(graph.get(module).every(path => path.startsWith("src/kernel/")));
		for (const entrypoint of ["src/index.ts", "src/server/commands/lifecycle.ts", "src/adapters/git/local-server.ts", "src/adapters/git/project-store.ts"]) {
			assert.equal(reachable(graph, entrypoint).includes(module), false, entrypoint);
		}
	}
	assert.ok(graph.get("src/adapters/checks/linux-host.ts").includes("src/kernel/gates/decision-validation.ts"));
	assert.ok(graph.get("src/adapters/checks/linux-host.ts").includes("src/adapters/checks/worker-source.ts"));
});

test("isolated Check execution stays private and loads custom code only in the disposable worker", async () => {
	const {graph, external} = await sourceGraph();
	const host = "src/adapters/checks/linux-host.ts", worker = "src/adapters/checks/worker-source.ts", journal = "src/adapters/checks/journal.ts";
	assert.ok(graph.get(host).every(path => path.startsWith("src/kernel/") || path === worker || path === journal || path === "src/ports/check-model.ts"));
	assert.ok(graph.get(journal).every(path => path.startsWith("src/kernel/")));
	assert.ok(external.get(journal).every(path => ["node:fs", "node:crypto", "node:fs/promises", "node:path"].includes(path)));
	assert.ok(graph.get(worker).every(path => path.startsWith("src/kernel/")));
	assert.equal(external.has(worker), false, "The authoring library exports worker bytes, not a host-side runtime");
	for (const entrypoint of ["src/index.ts", "src/server/commands/lifecycle.ts", "src/adapters/git/local-server.ts", "src/adapters/git/project-store.ts"]) {
		assert.equal(reachable(graph, entrypoint).includes(host), false, entrypoint);
		assert.equal(reachable(graph, entrypoint).includes(journal), false, entrypoint);
	}
});

test("Check inference uses Pi without a parallel provider client or agent loop", async () => {
	const {graph, external} = await sourceGraph();
	const bridge = "src/adapters/pi/check-model.ts", port = "src/ports/check-model.ts";
	assert.deepEqual(external.get(bridge), ["@earendil-works/pi-ai"]);
	assert.ok(graph.get(bridge).every(path => path.startsWith("src/kernel/") || path === port || path === "src/adapters/pi/model.ts"));
	assert.ok(graph.get(port).every(path => path.startsWith("src/kernel/")));
	assert.equal(external.has(port), false);
	const source = ts.createSourceFile(bridge, await readFile(join(repoRoot, bridge), "utf8"), ts.ScriptTarget.Latest, true);
	const inspect = node => {
		if (ts.isIdentifier(node)) assert.notEqual(node.text, "fetch", "Pi owns model serialization and parsing; the Check bridge must not become a client");
		ts.forEachChild(node, inspect);
	};
	inspect(source);
	for (const entrypoint of ["src/index.ts", "src/server/commands/lifecycle.ts", "src/adapters/git/local-server.ts"]) {
		assert.equal(reachable(graph, entrypoint).includes(bridge), false, entrypoint);
	}
});

test("suites use shared fixtures instead of registering other suites", async () => {
	for (const path of TEST_FILES.filter(path => path.endsWith(".mjs"))) {
		const imports = parseImports(path, await readFile(join(repoRoot, path), "utf8"));
		assert.ok([...imports.imports, ...imports.dynamicImports].every(target => target === null || !target.endsWith(".test.mjs")), path + ": use a fixture module, not test registration");
	}
});
