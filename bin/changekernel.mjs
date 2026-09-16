#!/usr/bin/env node
// changekernel(1) — lifecycle verbs over the bounded local Project Server.
// Deterministic plain-language output by default; technical identities only via
// explicit audit reads. Exit codes: 0 found/ok, 1 none/attention, 2 error.
import process from "node:process";
import {basename, resolve} from "node:path";

const USAGE = `changekernel — ChangeKernel project change console

Usage:
  changekernel status   [projectRoot]   Project readiness, attention, next actions
  changekernel changes  [projectRoot]   Change list in plain language
  changekernel change   <changeId> [root]  One Change in plain language
  changekernel checks   [projectRoot]   Gates and Checks in plain language
  changekernel trace    <changeId> [root]  Change Trace summary (bounded audit view)
  changekernel trace --json <changeId> [root]  Bounded trace audit as JSON

Exit codes: 0 ok, 1 none found, 2 error.
`;

const READ_ONLY_NOTICE = "Local console is read-only; lifecycle authority stays with the Project Server.";

// Preflight errors use fixed category messages only — they never echo user
// input, so stderr stays far below the 2,048-UTF-8-byte bound (message + USAGE)
// without sanitizing, truncating, or executing any part of the invocation.
function usageError(message) {
	process.stderr.write(`changekernel: ${message}\n${USAGE}`);
	return 2;
}

// Strict preflight: validate the whole invocation before any runtime import or
// composition. Root selection is positional per verb, never inferred from
// slashes; ID semantics stay with the API, which only sees preflight survivors.
function preflight(argv) {
	if (argv.length === 0) return {help: true};
	const [verb, ...rest] = argv;
	if (rest.length === 0 && (verb === "--help" || verb === "-h")) return {help: true};

	const verbs = new Set(["status", "changes", "checks", "change", "trace"]);
	if (!verbs.has(verb)) return {error: "unknown verb."};

	const positional = [];
	let json = false;
	for (const arg of rest) {
		if (arg === "--json") {
			if (verb !== "trace") return {error: "--json is only supported for trace."};
			if (json) return {error: "--json may be given at most once."};
			if (positional.length > 0) return {error: "--json must precede the Change ID and project root."};
			json = true;
			continue;
		}
		if (arg.startsWith("-") && arg.length > 1) return {error: "unknown option."};
		// An explicitly empty operand is invalid whether it would be a Change ID
		// or a project root; omission (which means cwd) is handled separately.
		if (arg === "") return {error: "arguments must not be empty."};
		positional.push(arg);
	}

	if (verb === "status" || verb === "changes" || verb === "checks") {
		if (positional.length > 1) return {error: `too many arguments for ${verb}.`};
		return {verb, json: false, changeId: null, rootOperand: positional[0] ?? null};
	}

	if (positional.length === 0) return {error: `${verb} requires a Change ID.`};
	if (positional.length > 2) return {error: `too many arguments for ${verb}.`};
	return {verb, json, changeId: positional[0], rootOperand: positional[1] ?? null};
}

async function main(argv) {
	const plan = preflight(argv);
	if (plan.help) {
		process.stdout.write(USAGE);
		return 0;
	}
	if (plan.error) return usageError(plan.error);

	const root = plan.rootOperand === null ? process.cwd() : resolve(plan.rootOperand);
	const inputName = basename(root);

	// Runtime import happens only after preflight accepted the invocation; the
	// exported sanitizer covers any runtime-controlled diagnostics text.
	const {createChangeKernelClient, createLocalProjectServer, renderConsole, sanitizeTerminalText} = await import(
		"../dist/index.js"
	);

	const composed = await createLocalProjectServer({projectRoot: root, projectName: inputName});
	if (!composed.ok) {
		process.stderr.write(`changekernel: ${sanitizeTerminalText(composed.error.message)}\n`);
		return 2;
	}

	const {repositoryId, server, projectName} = composed.value;
	const clientResult = createChangeKernelClient({
		repositoryId,
		transport: {send: (request) => server.handle(request)},
		client: {kind: "cli", instanceId: "cw:client:changekernel-cli"},
		authentication: {identityRef: "cw:identity:local-console", proof: `local-console:${repositoryId}`},
	});
	if (!clientResult.ok) {
		process.stderr.write("changekernel: the local Console client could not be initialized.\n");
		return 2;
	}
	const client = clientResult.value;

	const expiresAt = new Date(Math.floor((Date.now() + 60_000) / 1000) * 1000).toISOString().replace(".000Z", "Z");
	const requestId = `cw:request:cli-${process.pid}-${Date.now()}`;
	const options = {requestId, expiresAt};
	const source = {kind: "canonical"};

	const fail = (label, outcome) => {
		if (!outcome.ok && outcome.error.code === "invalid_project_state") {
			process.stderr.write(`changekernel: ${label}: this project's semantic state could not be read and needs diagnosis.\n`);
			process.stderr.write("Recovery or conversion of existing state requires a verified procedure; this console does not modify or rewrite it.\n");
			return 2;
		}
		const hint = outcome.ok ? "" : sanitizeTerminalText(outcome.error.hint ?? outcome.error.message);
		process.stderr.write(`changekernel: ${label}: ${hint}\n`);
		return 2;
	};

	if (plan.verb === "status") {
		const res = await client.status({...options, source});
		if (!res.ok) return fail("status", res);
		process.stdout.write(renderConsole("status", res.value));
		process.stdout.write(`\n${READ_ONLY_NOTICE}\n`);
		return res.value.status === "attention_needed" ? 1 : 0;
	}

	if (plan.verb === "changes") {
		const res = await client.changes({...options, source, view: "list", limit: 50, cursor: null});
		if (!res.ok) return fail("changes", res);
		if (!res.value.items || res.value.items.length === 0) {
			process.stdout.write(`No Changes in ${projectName} yet.\nPropose one through the Project Server to begin.\n`);
			return 1;
		}
		process.stdout.write(renderConsole("changes", res.value));
		process.stdout.write(`\n${READ_ONLY_NOTICE}\n`);
		return 0;
	}

	if (plan.verb === "change") {
		const res = await client.changes({...options, source, view: "get", changeId: plan.changeId});
		if (!res.ok) return fail("change", res);
		process.stdout.write(renderConsole("change", res.value));
		return res.value.userActionRequired ? 1 : 0;
	}

	if (plan.verb === "checks") {
		const res = await client.checks({...options, source, view: "gates", changeId: null, limit: 50, cursor: null});
		if (!res.ok) return fail("checks", res);
		if (!res.value.items || res.value.items.length === 0) {
			process.stdout.write("No active Gates or Checks.\n");
			return 1;
		}
		process.stdout.write(renderConsole("checks", res.value));
		process.stdout.write(`\n${READ_ONLY_NOTICE}\n`);
		return res.value.items.some((item) => item.userActionRequired) ? 1 : 0;
	}

	const res = await client.audit({...options, source, view: "change", changeId: plan.changeId});
	if (!res.ok) return fail("trace", res);
	const {reduced, path} = res.value;
	if (plan.json) {
		process.stdout.write(`${JSON.stringify({changeId: plan.changeId, state: reduced.state, latestEventDigest: reduced.latestEventDigest, traceDigest: reduced.traceDigest, tracePath: path}, null, 2)}\n`);
		return 0;
	}
	process.stdout.write(renderConsole("trace", {
		changeId: plan.changeId,
		state: reduced.state,
		latestEventDigest: reduced.latestEventDigest,
		traceDigest: reduced.traceDigest,
		tracePath: path,
	}));
	return 0;
}

process.exitCode = await main(process.argv.slice(2));
