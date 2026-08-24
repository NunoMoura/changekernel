import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {spawnSync} from "node:child_process";
import {
	DSH_CLIENT_SLOT_QUALIFICATION,
	assertDshClientSlotQualification,
} from "../src/clients/dsh/client-slot-qualification.ts";

const root = await mkdtemp(join(tmpdir(), "codewiki-b6-dsh-client-spike-"));
let outcome;
try {
	await writeFile(
		join(root, "package.json"),
		JSON.stringify({
			name: "codewiki-b6-dsh-client-spike",
			version: "1.0.0",
			private: true,
			type: "module",
		}),
	);
	const specs = DSH_CLIENT_SLOT_QUALIFICATION.packages.map(
		(entry) => `${entry.name}@${entry.version}`,
	);
	run("npm", ["install", "--ignore-scripts", "--save-exact", ...specs], root);
	const lockText = await readFile(join(root, "package-lock.json"), "utf8");
	const lock = JSON.parse(lockText);
	for (const expected of DSH_CLIENT_SLOT_QUALIFICATION.packages) {
		const actual = lock.packages[`node_modules/${expected.name}`];
		assert.equal(actual?.version, expected.version, `${expected.name} version drifted`);
		assert.equal(actual?.integrity, expected.integrity, `${expected.name} integrity drifted`);
	}
	assert.equal(
		digest(lockText),
		DSH_CLIENT_SLOT_QUALIFICATION.evidence.externalPackageLockDigest,
		"external package-lock drifted",
	);

	const audit = JSON.parse(run("npm", ["audit", "--omit=dev", "--json"], root));
	assert.equal(audit.metadata.vulnerabilities.total, 0);
	const slotsPath = join(
		root,
		"node_modules/@deepseek-ai/dsh-client-ui-slots/lib/index.js",
	);
	const {SlotCore} = await import(pathToFileURL(slotsPath).href);
	const layoutModule = await import(
		pathToFileURL(
			join(root, "node_modules/@deepseek-ai/dsh-client-ui-layout/lib/index.js"),
		).href,
	);
	const core = new SlotCore();
	const disposeShell = core.register(
		{
			name: "root",
			registrant: "codewiki.spike.shell",
			children: {
				"codewiki.change.navigation": {kind: "list", scope: "root"},
				"codewiki.stage.view": {kind: "keyed", scope: "root"},
				"codewiki.provider.settings": {kind: "single", scope: "root"},
			},
		},
		() => null,
	);
	const disposers = [
		core.register(
			{
				name: "codewiki.change.navigation",
				id: "changes",
				order: 10,
				registrant: "codewiki.spike.changes",
			},
			() => null,
		),
		core.register(
			{
				name: "codewiki.stage.view",
				key: "decision",
				registrant: "codewiki.spike.decision",
			},
			() => null,
		),
		core.register(
			{
				name: "codewiki.provider.settings",
				registrant: "codewiki.spike.provider-settings",
			},
			() => null,
		),
	];
	assert.equal(core.entriesOfSlot("codewiki.change.navigation").length, 1);
	assert.equal(core.entriesOfSlot("codewiki.stage.view").length, 1);
	assert.throws(
		() =>
			core.register(
				{name: "codewiki.raw-storage", id: "forbidden"},
				() => null,
			),
		/not declared/,
	);
	disposeShell();
	assert.equal(core.entriesOfSlot("codewiki.change.navigation").length, 0);
	assert.equal(core.specDynamic("codewiki.change.navigation"), undefined);
	for (const dispose of disposers) dispose();

	assert.equal(typeof layoutModule.apply, "function");
	assert.equal(layoutModule.apply(), undefined);
	const layoutClientSource = await readFile(
		join(
			root,
			"node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js",
		),
		"utf8",
	);
	assert.match(layoutClientSource, /ctx\.slots\.register\(\{/);
	assert.match(layoutClientSource, /name: "root"/);
	assert.match(layoutClientSource, /ctx\.reflect\.provide\("layout", layout\)/);

	await writeFile(
		join(root, "css-loader.mjs"),
		`export async function load(url, context, nextLoad) {
	if (url.endsWith(".css")) {
		return {
			format: "module",
			source: "export default new Proxy({}, {get: (_, key) => String(key)});",
			shortCircuit: true,
		};
	}
	return nextLoad(url, context);
}
`,
	);
	await writeFile(
		join(root, "primitive-probe.mjs"),
		`import assert from "node:assert/strict";
import {StateDot} from "@deepseek-ai/dsh-client-ui-primitives";
assert.equal(typeof StateDot, "function");
const stateDot = StateDot({state: "done"});
assert.equal(stateDot.type, "span");
assert.equal(stateDot.props["data-state"], "done");
assert.equal(stateDot.props["aria-hidden"], "true");
console.log("passed");
`,
	);
	assert.equal(
		run(
			process.execPath,
			["--experimental-loader", "./css-loader.mjs", "./primitive-probe.mjs"],
			root,
		).trim(),
		"passed",
	);

	const connectionSource = await readFile(
		join(root, "node_modules/@deepseek-ai/dsh-client-connection/lib/index.js"),
		"utf8",
	);
	assert.match(connectionSource, /authentication stay out of scope/);
	const providerSettingsSource = await readFile(
		join(
			root,
			"node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js",
		),
		"utf8",
	);
	assert.match(providerSettingsSource, /api\.settings\.mutate/);
	assert.match(providerSettingsSource, /api\.credentials\.set/);
	const authorizationSource = await readFile(
		join(root, "node_modules/@deepseek-ai/dsh-authorization/lib/index.js"),
		"utf8",
	);
	assert.match(authorizationSource, /static inject = \["credentials"\]/);
	assert.match(authorizationSource, /registerFlow\(flow\)/);
	const authorizationTypes = await readFile(
		join(
			root,
			"node_modules/@deepseek-ai/dsh-authorization/lib/types/types.d.ts",
		),
		"utf8",
	);
	assert.match(authorizationTypes, /kind: 'secret'/);
	const authorizationContract = await readFile(
		join(root, "node_modules/@deepseek-ai/dsh-authorization/lib/types/index.d.ts"),
		"utf8",
	);
	assert.match(authorizationContract, /interface AuthorizationInteraction/);
	assertDshClientSlotQualification(DSH_CLIENT_SLOT_QUALIFICATION);
	outcome = {
		protocol: DSH_CLIENT_SLOT_QUALIFICATION.protocol,
		qualificationDigest: DSH_CLIENT_SLOT_QUALIFICATION.qualificationDigest,
		packageLockDigest: digest(lockText),
		packageCount: DSH_CLIENT_SLOT_QUALIFICATION.packages.length,
		vulnerabilities: 0,
		slotLifecycle: "passed",
		undeclaredSlotRejection: "passed",
		stockConnection: DSH_CLIENT_SLOT_QUALIFICATION.decisions.stockConnection,
		stockProviderSettings:
			DSH_CLIENT_SLOT_QUALIFICATION.decisions.stockProviderSettings,
	};
} finally {
	if (process.env.CODEWIKI_KEEP_DSH_CLIENT_SPIKE !== "1") {
		await rm(root, {recursive: true, force: true});
	}
}
process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);

function run(command, args, cwd) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		env: process.env,
		maxBuffer: 32 * 1024 * 1024,
	});
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`,
		);
	}
	return result.stdout;
}

function digest(value) {
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
