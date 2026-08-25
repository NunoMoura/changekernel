import {createHash} from "node:crypto";
import {mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, relative, resolve} from "node:path";
import {spawnSync} from "node:child_process";
import process from "node:process";

const PI_LENS_SCANNER_URL = new URL(
	"../node_modules/pi-lens/dist/clients/project-diagnostics/scanner.js",
	import.meta.url,
);

const ROOT = resolve(import.meta.dirname, "..");
const BASELINE_PATH = join(ROOT, "diagnostics", "baseline.json");
const SCAN_PATHS = ["src", "tests", "scripts", "benchmarks"];

function run(command, args, acceptedStatuses = [0]) {
	const result = spawnSync(command, args, {
		cwd: ROOT,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	if (!acceptedStatuses.includes(result.status ?? -1)) {
		throw new Error(
			`${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr || result.stdout}`,
		);
	}
	return result.stdout;
}

function parseJson(value, label) {
	try {
		return JSON.parse(value);
	} catch (error) {
		throw new Error(`${label} is not valid JSON.`, {cause: error});
	}
}

function digest(value) {
	const hex = createHash("sha256").update(value).digest("hex");
	return Array.from({length: 8}, (_, index) =>
		hex.slice(index * 8, (index + 1) * 8),
	).join(" ");
}

function findingKey(file, identity) {
	return `${file}:${digest(identity)}`;
}

function addFinding(target, key) {
	target[key] = (target[key] ?? 0) + 1;
}

function issueIdentity(value) {
	if (Array.isArray(value)) return value.map(issueIdentity);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([key]) => !["line", "col", "pos"].includes(key))
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, issueIdentity(entry)]),
		);
	}
	return value;
}

async function packageVersion(name) {
	const value = parseJson(
		await readFile(join(ROOT, "node_modules", name, "package.json"), "utf8"),
		`${name} package metadata`,
	);
	return value.version;
}

async function astGrepObservation() {
	const builtInRoot = join(
		ROOT,
		"node_modules",
		"pi-lens",
		"rules",
		"ast-grep-rules",
		"rules",
	);
	const overrideRoot = join(ROOT, "rules", "ast-grep-rules", "rules");
	const builtInFiles = (await readdir(builtInRoot)).filter((file) =>
		file.endsWith(".yml"),
	);
	const overrideFiles = await readdir(overrideRoot).catch(() => []);
	const ruleFiles = [...new Set([...builtInFiles, ...overrideFiles])].sort((a, b) =>
		a.localeCompare(b),
	);
	const rules = {};
	for (const file of ruleFiles) {
		const override = overrideFiles.includes(file);
		const rulePath = join(override ? overrideRoot : builtInRoot, file);
		const output = run(
			join(ROOT, "node_modules", ".bin", "ast-grep"),
			["scan", "--rule", rulePath, "--json=compact", ...SCAN_PATHS],
			[0, 1],
		).trim();
		for (const finding of output
			? parseJson(output, `${file} ast-grep report`)
			: []) {
			const entry = (rules[finding.ruleId] ??= {
				severity: finding.severity,
				count: 0,
				findings: {},
			});
			entry.count += 1;
			addFinding(
				entry.findings,
				findingKey(
					finding.file,
					`${finding.ruleId}\0${String(finding.text).trim()}`,
				),
			);
		}
	}
	return {rules};
}

async function piLensObservation() {
	const scannerModule = await import(PI_LENS_SCANNER_URL.href);
	const repositoryFiles = run("git", [
		"ls-files",
		"--cached",
		"--others",
		"--exclude-standard",
		"-z",
	])
		.split("\0")
		.filter(Boolean)
		.map((file) => join(ROOT, file));
	const snapshot = await scannerModule.scanProjectDiagnostics({
		cwd: ROOT,
		tier: "cheap",
		files: repositoryFiles,
		maxFiles: repositoryFiles.length,
	});
	if (snapshot.scanTruncated || snapshot.filesScanned !== repositoryFiles.length) {
		throw new Error(
			`Pi-Lens project scan was incomplete (${snapshot.filesScanned}/${repositoryFiles.length}).`,
		);
	}
	const sourceLines = new Map();
	const rules = {};
	for (const diagnostic of snapshot.diagnostics) {
		const file = relative(ROOT, diagnostic.filePath).replaceAll("\\", "/");
		let lines = sourceLines.get(file);
		if (!lines) {
			const source = await readFile(diagnostic.filePath, "utf8");
			lines = source.split(/\r?\n/u);
			sourceLines.set(file, lines);
		}
		const lineText = lines[diagnostic.line - 1]?.trim() ?? "";
		const entry = (rules[diagnostic.rule] ??= {count: 0, findings: {}});
		entry.count += 1;
		addFinding(
			entry.findings,
			findingKey(
				file,
				JSON.stringify({
					lineText,
					message: diagnostic.message,
					rule: diagnostic.rule,
					runner: diagnostic.runner,
					semantic: diagnostic.semantic,
					severity: diagnostic.severity,
					tool: diagnostic.tool,
				}),
			),
		);
	}
	return {filesScanned: snapshot.filesScanned, rules};
}

function knipObservation() {
	const output = run(
		join(ROOT, "node_modules", ".bin", "knip"),
		["--reporter", "json"],
		[0, 1],
	).trim();
	const report = output ? parseJson(output, "Knip report") : {issues: []};
	const categories = {};
	for (const issue of report.issues ?? []) {
		for (const [category, values] of Object.entries(issue)) {
			if (!Array.isArray(values) || values.length === 0) continue;
			const entry = (categories[category] ??= {count: 0, findings: {}});
			for (const value of values) {
				entry.count += 1;
				addFinding(
					entry.findings,
					findingKey(
						issue.file,
						`${category}\0${JSON.stringify(issueIdentity(value))}`,
					),
				);
			}
		}
	}
	return {categories};
}

function sortedCycles(value) {
	return value
		.map((cycle) => [...cycle])
		.sort((left, right) => left.join("\0").localeCompare(right.join("\0")));
}

function madgeObservation() {
	const madge = join(ROOT, "node_modules", ".bin", "madge");
	const source = parseJson(
		run(madge, ["--circular", "--json", "--extensions", "ts", "src"], [0, 1]),
		"Madge source report",
	);
	const runtime = parseJson(
		run(madge, ["--circular", "--json", "--extensions", "js", "dist"], [0, 1]),
		"Madge Runtime report",
	);
	return {sourceCycles: sortedCycles(source), runtimeCycles: sortedCycles(runtime)};
}

async function jscpdObservation() {
	const outputRoot = await mkdtemp(join(tmpdir(), "codewiki-diagnostics-"));
	try {
		run(join(ROOT, "node_modules", ".bin", "jscpd"), [
			"src",
			"scripts",
			"benchmarks",
			"--gitignore",
			"--min-lines",
			"10",
			"--min-tokens",
			"80",
			"--reporters",
			"json",
			"--output",
			outputRoot,
			"--silent",
			"--exitCode",
			"0",
		]);
		const report = parseJson(
			await readFile(join(outputRoot, "jscpd-report.json"), "utf8"),
			"jscpd report",
		);
		const findings = {};
		for (const duplicate of report.duplicates) {
			const files = [duplicate.firstFile.name, duplicate.secondFile.name].sort(
				(left, right) => left.localeCompare(right),
			);
			addFinding(
				findings,
				findingKey(files.join("="), String(duplicate.fragment).trim()),
			);
		}
		const total = report.statistics.total;
		return {
			metrics: {
				clones: total.clones,
				duplicatedLines: total.duplicatedLines,
				percentage: total.percentage,
			},
			findings,
		};
	} finally {
		await rm(outputRoot, {recursive: true, force: true});
	}
}

async function observe() {
	return {
		schema: "codewiki.diagnostics-observation@1.1.0",
		tools: {
			astGrep: await packageVersion("@ast-grep/cli"),
			piLens: await packageVersion("pi-lens"),
			piTui: await packageVersion("@earendil-works/pi-tui"),
			knip: await packageVersion("knip"),
			madge: await packageVersion("madge"),
			jscpd: await packageVersion("jscpd"),
		},
		astGrep: await astGrepObservation(),
		piLens: await piLensObservation(),
		knip: knipObservation(),
		madge: madgeObservation(),
		jscpd: await jscpdObservation(),
	};
}

function compareFindings(label, actual, allowed, failures) {
	for (const [key, count] of Object.entries(actual)) {
		if (!(key in allowed)) failures.push(`${label} introduced ${key}.`);
		else if (count > allowed[key]) {
			failures.push(`${label} increased ${key}: ${allowed[key]} -> ${count}.`);
		}
	}
}

function requireDisposition(label, entry, failures) {
	for (const field of ["category", "disposition", "owner", "rationale"]) {
		if (typeof entry[field] !== "string" || !entry[field].trim()) {
			failures.push(`${label} lacks ${field}.`);
		}
	}
}

function compare(actual, baseline) {
	const failures = [];
	for (const [tool, version] of Object.entries(actual.tools)) {
		if (baseline.tools[tool] !== version) {
			failures.push(`Tool ${tool} drifted: ${baseline.tools[tool]} -> ${version}.`);
		}
	}
	for (const [ruleId, actualRule] of Object.entries(actual.astGrep.rules)) {
		const expected = baseline.astGrep.rules[ruleId];
		if (!expected) {
			failures.push(`ast-grep rule ${ruleId} is unclassified.`);
			continue;
		}
		if (actualRule.severity !== expected.severity) {
			failures.push(
				`ast-grep rule ${ruleId} severity drifted: ${expected.severity} -> ${actualRule.severity}.`,
			);
		}
		if (actualRule.count > expected.maxCount) {
			failures.push(
				`ast-grep rule ${ruleId} increased: ${expected.maxCount} -> ${actualRule.count}.`,
			);
		}
		compareFindings(
			`ast-grep ${ruleId}`,
			actualRule.findings,
			expected.findings,
			failures,
		);
	}
	for (const [ruleId, expected] of Object.entries(baseline.astGrep.rules)) {
		requireDisposition(`ast-grep ${ruleId}`, expected, failures);
	}
	for (const [ruleId, actualRule] of Object.entries(actual.piLens.rules)) {
		const expected = baseline.piLens.rules[ruleId];
		if (!expected) {
			failures.push(`Pi-Lens rule ${ruleId} is unclassified.`);
			continue;
		}
		if (actualRule.count > expected.maxCount) {
			failures.push(
				`Pi-Lens rule ${ruleId} increased: ${expected.maxCount} -> ${actualRule.count}.`,
			);
		}
		compareFindings(
			`Pi-Lens ${ruleId}`,
			actualRule.findings,
			expected.findings,
			failures,
		);
	}
	for (const [ruleId, expected] of Object.entries(baseline.piLens.rules)) {
		requireDisposition(`Pi-Lens ${ruleId}`, expected, failures);
	}
	for (const [category, actualCategory] of Object.entries(actual.knip.categories)) {
		const expected = baseline.knip.categories[category];
		if (!expected) {
			failures.push(`Knip category ${category} is unclassified.`);
			continue;
		}
		if (actualCategory.count > expected.maxCount) {
			failures.push(
				`Knip ${category} increased: ${expected.maxCount} -> ${actualCategory.count}.`,
			);
		}
		compareFindings(
			`Knip ${category}`,
			actualCategory.findings,
			expected.findings,
			failures,
		);
	}
	for (const [category, expected] of Object.entries(baseline.knip.categories)) {
		requireDisposition(`Knip ${category}`, expected, failures);
	}
	const allowedCycles = new Set(
		baseline.madge.sourceCycles.map((entry) => entry.cycle.join("\0")),
	);
	for (const cycle of actual.madge.sourceCycles) {
		if (!allowedCycles.has(cycle.join("\0"))) {
			failures.push(`Madge introduced source cycle ${cycle.join(" -> ")}.`);
		}
	}
	for (const entry of baseline.madge.sourceCycles) {
		requireDisposition(`Madge ${entry.cycle.join(" -> ")}`, entry, failures);
	}
	if (actual.madge.runtimeCycles.length > 0) {
		failures.push(
			`Madge found emitted Runtime cycles: ${JSON.stringify(actual.madge.runtimeCycles)}.`,
		);
	}
	for (const metric of ["clones", "duplicatedLines", "percentage"]) {
		if (actual.jscpd.metrics[metric] > baseline.jscpd.maxima[metric]) {
			failures.push(
				`jscpd ${metric} increased: ${baseline.jscpd.maxima[metric]} -> ${actual.jscpd.metrics[metric]}.`,
			);
		}
	}
	compareFindings(
		"jscpd",
		actual.jscpd.findings,
		baseline.jscpd.findings,
		failures,
	);
	requireDisposition("jscpd", baseline.jscpd, failures);
	return failures;
}

const observation = await observe();
if (process.argv[2] === "--write-observed") {
	const destination = resolve(ROOT, process.argv[3] || "diagnostics/observed.json");
	await writeFile(destination, `${JSON.stringify(observation, null, 2)}\n`);
	process.stdout.write(`Wrote ${destination}.\n`);
	process.exit(0);
}
const baseline = parseJson(
	await readFile(BASELINE_PATH, "utf8"),
	"diagnostics baseline",
);
const failures = compare(observation, baseline);
if (failures.length > 0) {
	process.stderr.write(
		`${failures.map((failure) => `diagnostics ratchet: ${failure}`).join("\n")}\n`,
	);
	process.exit(1);
}
process.stdout.write(
	`Diagnostics ratchet passed: ${Object.keys(observation.astGrep.rules).length} ast-grep rules, ${Object.keys(observation.piLens.rules).length} Pi-Lens rules, ${Object.keys(observation.knip.categories).length} Knip categories, ${observation.madge.sourceCycles.length} qualified type-only cycles, ${observation.jscpd.metrics.clones} source clones.\n`,
);
