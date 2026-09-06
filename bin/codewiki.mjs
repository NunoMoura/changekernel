#!/usr/bin/env node
// codewiki(1) — lifecycle verbs over the bounded local Project Server.
// Deterministic plain-language output by default; technical identities only via
// explicit audit reads. Exit codes: 0 found/ok, 1 none/attention, 2 error.
import process from "node:process";

const USAGE = `codewiki — Semantic Kernel lifecycle console

Usage:
  codewiki status   [projectRoot]   Project readiness, attention, next actions
  codewiki changes  [projectRoot]   Change list in plain language
  codewiki change   <changeId> [root]  One Change in plain language
  codewiki checks   [projectRoot]   Gates and Checks in plain language
  codewiki trace    <changeId> [root]  Change Trace summary (bounded audit view)
  codewiki trace --json <changeId> [root]  Bounded trace audit as JSON

Exit codes: 0 ok, 1 none found, 2 error.
`;

const READ_ONLY_NOTICE = "Local console is read-only; lifecycle authority stays with the Project Server.";

async function main(argv) {
	const verb = argv[0];
	if (!verb || verb === "--help" || verb === "-h") {
		process.stdout.write(USAGE);
		return 0;
	}

	const {createCodewikiClient, createLocalProjectServer, renderConsole, sanitizeTerminalText} = await import(
		"../dist/index.js"
	);

	let root = null;
	let positional = [];
	for (const arg of argv.slice(1)) {
		if (arg === "--json") continue;
		if (root === null && (arg.includes("/") || arg === ".")) root = arg;
		else positional.push(arg);
	}
	root ??= process.cwd();

	const composed = await createLocalProjectServer({projectRoot: root, projectName: root.split("/").pop()});
	if (!composed.ok) {
		process.stderr.write(`codewiki: ${sanitizeTerminalText(composed.error.message)}\n`);
		return 2;
	}

	const {repositoryId, server, projectName} = composed.value;
	const clientResult = createCodewikiClient({
		repositoryId,
		transport: {send: (request) => server.handle(request)},
		client: {kind: "cli", instanceId: "cw:client:codewiki-cli"},
		authentication: {identityRef: "cw:identity:local-console", proof: `local-console:${repositoryId}`},
	});
	if (!clientResult.ok) {
		process.stderr.write("codewiki: the local Console client could not be initialized.\n");
		return 2;
	}
	const client = clientResult.value;

	const expiresAt = new Date(Math.floor((Date.now() + 60_000) / 1000) * 1000).toISOString().replace(".000Z", "Z");
	const requestId = `cw:request:cli-${process.pid}-${Date.now()}`;
	const options = {requestId, expiresAt};
	const source = {kind: "canonical"};

		const fail = (label, outcome) => {
		if (!outcome.ok && outcome.error.code === "invalid_project_state") {
			process.stderr.write(`codewiki: ${label}: this project's semantic state predates the current kernel generation, so normal reads stop fail-closed.\n`);
			process.stderr.write("Safe next steps: restore the verified backup, or re-bootstrap the project under the current kernel generation.\n");
			return 2;
		}
		const hint = outcome.ok ? "" : sanitizeTerminalText(outcome.error.hint ?? outcome.error.message);
		process.stderr.write(`codewiki: ${label}: ${hint}\n`);
		return 2;
	};

	if (verb === "status") {
		const res = await client.status({...options, source});
		if (!res.ok) return fail("status", res);
		process.stdout.write(renderConsole("status", res.value));
		process.stdout.write(`\n${READ_ONLY_NOTICE}\n`);
		return res.value.status === "attention_needed" ? 1 : 0;
	}

	if (verb === "changes") {
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

	if (verb === "change") {
		const [changeId] = positional;
		if (!changeId) {
			process.stderr.write("codewiki: change requires a Change ID.\n");
			return 2;
		}
		const res = await client.changes({...options, source, view: "get", changeId});
		if (!res.ok) return fail("change", res);
		process.stdout.write(renderConsole("change", res.value));
		return res.value.userActionRequired ? 1 : 0;
	}

	if (verb === "checks") {
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

	if (verb === "trace") {
		const json = argv.includes("--json");
		const [changeId] = positional;
		if (!changeId) {
			process.stderr.write("codewiki: trace requires a Change ID.\n");
			return 2;
		}
		const res = await client.audit({...options, source, view: "change", changeId});
		if (!res.ok) return fail("trace", res);
		const {reduced, path} = res.value;
		if (json) {
			process.stdout.write(`${JSON.stringify({changeId, state: reduced.state, latestEventDigest: reduced.latestEventDigest, traceDigest: reduced.traceDigest, tracePath: path}, null, 2)}\n`);
			return 0;
		}
		process.stdout.write(renderConsole("trace", {
			changeId,
			state: reduced.state,
			latestEventDigest: reduced.latestEventDigest,
			traceDigest: reduced.traceDigest,
			tracePath: path,
		}));
		return 0;
	}

	process.stderr.write(`codewiki: unknown verb '${verb}'.\n${USAGE}`);
	return 2;
}

process.exitCode = await main(process.argv.slice(2));
