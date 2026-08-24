import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, describe, it} from "node:test";

import {createExecutablePluginAdmissionClosure} from "../../../src/plugins/executable.ts";
import {createRunModelRouteBinding} from "../../../src/runtime/contracts.ts";
import {
	DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS,
} from "../../../src/runtime/dsh/broker-plugins.ts";
import {createDshProviderHost} from "../../../src/runtime/dsh/provider-host.ts";
import {createProviderBrokerRequest} from "../../../src/runtime/providers/contracts.ts";
import {canonicalJson, sha256Digest} from "../../../src/utils/canonical-json.ts";

const roots = [];
const servers = [];

const apiKey = `fixture-${sha256Digest("provider-host-key-fixture").slice(7, 31)}`;

const routes = Object.freeze([
	brokerRoute("openai-route", "openai", "openai", "openai-account", "OPENAI_B4_KEY", "cw-openai"),
	brokerRoute(
		"anthropic-route",
		"anthropic",
		"anthropic",
		"anthropic-account",
		"ANTHROPIC_B4_KEY",
		"cw-anthropic",
	),
	brokerRoute(
		"deepseek-route",
		"deepseek",
		"deepseek",
		"deepseek-account",
		"DEEPSEEK_B4_KEY",
		"cw-deepseek",
	),
	brokerRoute(
		"gateway-route",
		"qualification-gateway",
		"openai-compatible",
		"gateway-account",
		"GATEWAY_B4_KEY",
		"cw-gateway",
	),
]);

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => closeServer(server)));
	await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

describe("DSH provider Broker Host", () => {
	it("loads exact official seams and keeps API-key custody outside forbidden Run roots", async () => {
		const fixture = await hostFixture();
		const host = await createDshProviderHost(fixture.options);
		try {
			assert.deepEqual(
				host.inventory().entries.map(({entryId, moduleName, enabled, fiberPhase}) => ({
					entryId,
					moduleName,
					enabled,
					fiberPhase,
				})),
				expectedInventory(),
			);
			assert.equal((await host.credentialStatus("openai-account")).configured, false);
			await host.setApiKey("openai-account", apiKey);
			assert.deepEqual(await host.credentialStatus("openai-account"), {
				accountId: "openai-account",
				credentialRef: "OPENAI_B4_KEY",
				configured: true,
				source: "file",
				writable: true,
			});
			assert.equal((await stat(fixture.credentialDirectory)).mode & 0o777, 0o700);
			assert.equal((await stat(fixture.credentialPath)).mode & 0o777, 0o600);
			assert.match(await readFile(fixture.credentialPath, "utf8"), /OPENAI_B4_KEY/);
			await host.forgetApiKey("openai-account");
			assert.equal((await host.credentialStatus("openai-account")).configured, false);
		} finally {
			await host.close();
		}
	});

	it("qualifies OpenAI, Anthropic, DeepSeek, and custom OpenAI-compatible API-key routes", async () => {
		const provider = await providerServer();
		const fixture = await hostFixture(provider.url);
		const host = await createDshProviderHost(fixture.options);
		try {
			for (const route of routes) await host.setApiKey(route.accountId, apiKey);
			for (const route of routes) {
				const request = brokerRequest(route);
				const opened = await host.transport.open(request, new AbortController().signal);
				const chunks = [];
				for await (const chunk of opened.chunks) chunks.push(chunk);
				assert.equal(opened.selectedProvider, route.provider);
				assert.equal(opened.selectedAccountId, route.accountId);
				assert.equal(opened.selectedModel, route.model);
				assert.equal(chunks.some(({type}) => type === "text-delta"), true);
				assert.equal(chunks.at(-1).type, "finish");
			}
			assert.equal(provider.requests.length, 4);
			for (const request of provider.requests) {
				const authorization = request.headers.authorization;
				const xApiKey = request.headers["x-api-key"];
				assert.equal(
					authorization === `Bearer ${apiKey}` || xApiKey === apiKey,
					true,
				);
				assert.equal(String(authorization).includes(provider.url), false);
				assert.equal(String(xApiKey).includes(provider.url), false);
			}
			assert.equal(canonicalJson(host.inventory()).includes(apiKey), false);
			assert.equal(host.configurationDigest.includes(apiKey), false);
		} finally {
			await host.close();
		}
	});

	it("fails closed on ambient, OAuth, account, secret-header, and mount-boundary drift", async () => {
		const fixture = await hostFixture();
		await assert.rejects(
			createDshProviderHost({
				...fixture.options,
				credentialPath: join(fixture.projectRoot, ".credentials.yaml"),
			}),
			/overlaps a forbidden Run root/,
		);
		await assert.rejects(
			createDshProviderHost({
				...fixture.options,
				providers: {
					...fixture.options.providers,
					openai: {...fixture.options.providers.openai, apiKeyEnv: undefined},
				},
			}),
			/credential reference does not match/,
		);
		process.env.OPENAI_B4_KEY = apiKey;
		try {
			await assert.rejects(
				createDshProviderHost(fixture.options),
				/ambient credential sources are unsupported/,
			);
		} finally {
			delete process.env.OPENAI_B4_KEY;
		}
		await assert.rejects(
			createDshProviderHost({
				...fixture.options,
				providers: {
					...fixture.options.providers,
					openai: {
						...fixture.options.providers.openai,
						headers: {Authorization: `Bearer ${apiKey}`},
					},
				},
			}),
			/provider headers are unsupported/,
		);
		const host = await createDshProviderHost(fixture.options);
		try {
			await host.setApiKey("openai-account", apiKey);
			const request = brokerRequest({...routes[0], accountId: "other-account"});
			await assert.rejects(
				host.transport.open(request, new AbortController().signal),
				/unauthorized route or account/,
			);
		} finally {
			await host.close();
		}
	});
});

async function hostFixture(providerUrl = "http://127.0.0.1:9/v1") {
	const root = await mkdtemp(join(tmpdir(), "codewiki-dsh-provider-host-"));
	roots.push(root);
	const projectRoot = join(root, "project");
	const runRoot = join(root, "runs");
	const releaseRoot = join(root, "release");
	const credentialDirectory = join(root, "credentials");
	const credentialPath = join(credentialDirectory, ".credentials.yaml");
	await Promise.all([mkdir(projectRoot), mkdir(runRoot), mkdir(releaseRoot)]);
	const admissionClosure = createExecutablePluginAdmissionClosure({
		projectRoot,
		sourceRoots: [releaseRoot],
		admissions: DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS,
	});
	return {
		projectRoot,
		runRoot,
		credentialDirectory,
		credentialPath,
		options: {
			deploymentClass: "isolated-single-user",
			credentialPath,
			forbiddenCredentialRoots: [projectRoot, runRoot],
			providers: providerProfiles(providerUrl),
			routes,
			admissionClosure,
		},
	};
}

function providerProfiles(providerUrl) {
	return {
		openai: profile("OPENAI_B4_KEY", "openai-completions", providerUrl, "cw-openai"),
		anthropic: profile(
			"ANTHROPIC_B4_KEY",
			"anthropic-messages",
			providerUrl,
			"cw-anthropic",
		),
		deepseek: profile(
			"DEEPSEEK_B4_KEY",
			"openai-completions",
			providerUrl,
			"cw-deepseek",
		),
		"qualification-gateway": profile(
			"GATEWAY_B4_KEY",
			"openai-completions",
			providerUrl,
			"cw-gateway",
		),
	};
}

function profile(apiKeyEnv, api, baseURL, model) {
	return {
		apiKeyEnv,
		api,
		baseURL,
		models: [{id: model, contextWindow: 8_192, maxTokens: 64}],
	};
}

function brokerRoute(routeId, provider, family, accountId, credentialRef, model) {
	return Object.freeze({routeId, provider, family, accountId, credentialRef, model});
}

function brokerRequest(route) {
	const modelRoute = createRunModelRouteBinding({
		routeId: route.routeId,
		provider: route.provider,
		accountId: route.accountId,
		credentialRef: route.credentialRef,
		model: route.model,
		reasoningEffort: null,
		contextWindowTokens: 8_192,
		timeoutMs: 30_000,
		policyDigest: sha256Digest("b4-policy"),
		policyAttempt: 0,
		modelAssignmentDigest: sha256Digest("b4-assignment"),
		optionsDigest: sha256Digest("b4-options"),
	});
	return createProviderBrokerRequest({
		runId: "run-b4-provider-host",
		callIndex: routes.findIndex(({routeId}) => routeId === route.routeId),
		route: modelRoute,
		deadlineAt: new Date(Date.now() + 30_000).toISOString(),
		payload: {
			provider: route.provider,
			model: route.model,
			messages: [],
			maxTokens: 16,
		},
	});
}

function expectedInventory() {
	return [
		["broker-credentials", "@deepseek-ai/dsh-credentials-local"],
		["broker-authorization", "@deepseek-ai/dsh-authorization"],
		["broker-llm", "@deepseek-ai/dsh-llm"],
		["broker-llm-pi-ai", "@deepseek-ai/dsh-llm-pi-ai"],
		["broker-plugin-inventory", "@deepseek-ai/dsh-host-plugin-inventory"],
	].map(([entryId, moduleName]) => ({
		entryId,
		moduleName,
		enabled: true,
		fiberPhase: "active",
	}));
}

async function providerServer() {
	const requests = [];
	const server = createServer((request, response) => {
		let body = "";
		request.on("data", (chunk) => { body += chunk.toString("utf8"); });
		request.on("end", () => {
			requests.push({headers: request.headers, body: JSON.parse(body)});
			if (request.url?.endsWith("/messages")) {
				writeAnthropic(response);
				return;
			}
			writeOpenAi(response);
		});
	});
	servers.push(server);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Provider fixture port unavailable.");
	return {url: `http://127.0.0.1:${address.port}/v1`, requests};
}

function writeOpenAi(response) {
	response.writeHead(200, {"content-type": "text/event-stream"});
	for (const event of [
		'{"choices":[{"delta":{"role":"assistant","content":""},"index":0,"finish_reason":null}]}',
		'{"choices":[{"delta":{"content":"qualified"},"index":0,"finish_reason":null}]}',
		'{"choices":[{"delta":{},"index":0,"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}',
		"[DONE]",
	]) response.write(`data: ${event}\n\n`);
	response.end();
}

function writeAnthropic(response) {
	response.writeHead(200, {"content-type": "text/event-stream"});
	const events = [
		["message_start", {type: "message_start", message: {
			id: "msg_b4",
			type: "message",
			role: "assistant",
			content: [],
			model: "cw-anthropic",
			stop_reason: null,
			stop_sequence: null,
			usage: {input_tokens: 3, output_tokens: 0},
		}}],
		["content_block_start", {type: "content_block_start", index: 0, content_block: {type: "text", text: ""}}],
		["content_block_delta", {type: "content_block_delta", index: 0, delta: {type: "text_delta", text: "qualified"}}],
		["content_block_stop", {type: "content_block_stop", index: 0}],
		["message_delta", {type: "message_delta", delta: {stop_reason: "end_turn", stop_sequence: null}, usage: {output_tokens: 1}}],
		["message_stop", {type: "message_stop"}],
	];
	for (const [name, value] of events) {
		response.write(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);
	}
	response.end();
}

function closeServer(server) {
	return new Promise((resolve, reject) => {
		server.close((error) => error ? reject(error) : resolve());
	});
}
