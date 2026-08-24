import assert from "node:assert/strict";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {describe, it} from "node:test";

import {
	RUN_PROTOCOL,
	createRunModelRouteBinding,
	createRunRequest,
	createRunSessionLeaseBinding,
} from "../../../src/runtime/contracts.ts";
import {createStageRunContinuationBinding} from "../../../src/runtime/continuation.ts";
import {runDshAgent} from "../../../src/runtime/dsh/adapter.ts";
import {createDshPrivateProviderBrokerInstaller} from "../../../src/runtime/dsh/private-provider-broker.ts";
import {
	createPrivateProviderBrokerBinding,
	createProviderBrokerRequest,
} from "../../../src/runtime/providers/contracts.ts";
import {
	PrivateProviderTransportError,
	startPrivateProviderBrokerServer,
} from "../../../src/runtime/providers/broker-server.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	sha256Digest,
} from "../../../src/utils/canonical-json.ts";

const chunks = Object.freeze([
	{type: "block-start", index: 0, blockType: "text"},
	{type: "text-delta", index: 0, text: "broker qualification"},
	{type: "block-end", index: 0, block: {type: "text", text: "broker qualification"}},
	{type: "usage", usage: {inputTokens: 11, outputTokens: 2}},
	{type: "finish", reason: {kind: "stop"}},
]);

function binding(overrides = {}) {
	return createPrivateProviderBrokerBinding({
		brokerId: "qualification-broker",
		implementationId: "codewiki-mock-provider",
		implementationVersion: "1.0.0",
		implementationDigest: sha256Digest("mock-provider-implementation"),
		configurationDigest: sha256Digest("mock-provider-configuration"),
		maxRetries: 0,
		...overrides,
	});
}

function route() {
	return createRunModelRouteBinding({
		routeId: "mock-live",
		provider: "mock-provider",
		model: "mock-model",
		reasoningEffort: null,
		contextWindowTokens: 128_000,
		timeoutMs: 30_000,
		policyDigest: sha256Digest("mock-policy"),
		policyAttempt: 0,
		modelAssignmentDigest: sha256Digest("mock-model-assignment"),
		optionsDigest: sha256Digest("mock-route-options"),
	});
}

function request(runId, modelRoute, systemPrompt, prompt) {
	const createdAt = new Date(Date.now() - 1_000).toISOString();
	const deadlineAt = new Date(Date.now() + 30_000).toISOString();
	return createRunRequest({
		runId,
		operationId: `operation-${runId}`,
		custody: "backend-owned",
		role: "decision-producer",
		stage: "decision",
		subject: {id: `subject-${runId}`, digest: sha256Digest("subject")},
		runtimeBuild: {
			buildDigest: sha256Digest("runtime-build"),
			runProtocolVersion: RUN_PROTOCOL.version,
		},
		session: {
			mode: "create",
			continuityKey: `decision:${runId}`,
			sessionId: `session-${runId}`,
			expectedHead: "absent",
			lease: createRunSessionLeaseBinding({
				leaseId: `lease-${runId}`,
				generation: 1,
				runId,
				acquiredAt: createdAt,
				expiresAt: new Date(Date.parse(deadlineAt) + 1_000).toISOString(),
			}),
			resumeLog: null,
		},
		inputs: {
			projectContextSnapshotDigest: sha256Digest("context"),
			materialDigest: sha256Digest("material"),
			feedbackDigest: null,
			systemPromptDigest: canonicalJsonDigest(systemPrompt),
			promptDigest: canonicalJsonDigest(prompt),
			producerSkillSetDigest: null,
			toolMode: "none",
			toolSetDigest: sha256Digest("no-tools"),
			modelRoute,
		},
		continuation: createStageRunContinuationBinding({
			stage: "decision",
			objectiveDigest: canonicalJsonDigest(prompt),
			maxRounds: 1,
			semanticStateDigest: sha256Digest("material"),
			authorityPromotionDigest: sha256Digest("authority"),
			unresolvedObligationsDigest: sha256Digest("obligations"),
			feedbackDigest: null,
			contextWindowTokens: 16_384,
			pressureThresholdTokens: 12_000,
			expectedNextRunInputTokens: 2_048,
			toolResultReserveTokens: 256,
			candidateOutputReserveTokens: 256,
			retainRecentTokens: 2_048,
			maxSummaryCharacters: 2_000,
		}),
		workspace: {
			kind: "immutable",
			repositorySnapshotDigest: sha256Digest("repository"),
		},
		budget: {
			timeoutMs: 30_000,
			maxModelRequests: 1,
			maxToolCalls: 0,
			maxInputTokens: 2_048,
			maxOutputTokens: 256,
		},
		createdAt,
		deadlineAt,
	});
}

async function* streamChunks() {
	for (const chunk of chunks) yield chunk;
}

describe("private provider broker", () => {
	it("streams an exact live route and records matching host and DSH evidence without credentials", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-private-broker-"));
		const modelRoute = route();
		const runId = "run-private-broker";
		const capabilityToken = "c".repeat(64);
		const seenRequests = [];
		const broker = await startPrivateProviderBrokerServer({
			binding: binding(),
			capabilityId: "capability-private-broker",
			capabilityToken,
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
			runId,
			routeDigest: modelRoute.routeDigest,
			transport: {
				open: async (brokerRequest) => {
					seenRequests.push(brokerRequest);
					return {
						selectedProvider: "mock-provider",
						selectedModel: "mock-model",
						providerRequestId: "provider-request-1",
						chunks: streamChunks(),
					};
				},
			},
		});
		try {
			const systemPrompt = "Private broker qualification system prompt";
			const prompt = "Return broker qualification text.";
			const result = await runDshAgent({
				request: request(runId, modelRoute, systemPrompt, prompt),
				artifacts: {
					systemPrompt,
					prompt,
					workspacePath: root,
					sessionRoot: join(root, "sessions"),
				},
				installModelAdapter: createDshPrivateProviderBrokerInstaller({
					access: broker.access,
				}),
			});
			assert.equal(result.outcome, "completed");
			assert.equal(result.output, "broker qualification");
			assert.equal(seenRequests.length, 1);
			assert.equal(seenRequests[0].route.routeDigest, modelRoute.routeDigest);
			assert.equal(canonicalJson(seenRequests[0]).includes(capabilityToken), false);
			const [hostReceipt] = broker.receipts();
			assert.equal(hostReceipt.providerRequestId, "provider-request-1");
			assert.equal(hostReceipt.selectedProvider, "mock-provider");
			assert.equal(hostReceipt.selectedModel, "mock-model");
			assert.equal(hostReceipt.transportAttempts, 1);
			const providerEntry = result.executionLedger.entries.find(
				(entry) => entry.kind === "provider-call",
			);
			assert.equal(canonicalJson(providerEntry.payload), canonicalJson(hostReceipt));
			assert.equal(canonicalJson(result.executionLedger).includes(capabilityToken), false);
			assert.equal((await readFile(result.rawLogPath, "utf8")).includes(capabilityToken), false);
		} finally {
			await broker.close();
			await rm(root, {recursive: true, force: true});
		}
	});

	it("records broker-side cancellation without exposing provider credentials", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-private-broker-cancel-"));
		const modelRoute = route();
		const runId = "run-private-broker-cancel";
		const controller = new AbortController();
		let transportStarted;
		const started = new Promise((resolve) => {
			transportStarted = resolve;
		});
		const broker = await startPrivateProviderBrokerServer({
			binding: binding(),
			capabilityId: "capability-private-broker-cancel",
			capabilityToken: "x".repeat(64),
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
			runId,
			routeDigest: modelRoute.routeDigest,
			transport: {
				open: async (_brokerRequest, signal) => {
					transportStarted();
					return {
						selectedProvider: "mock-provider",
						selectedModel: "mock-model",
						providerRequestId: "provider-request-cancel",
						chunks: (async function* cancelledStream() {
							await new Promise((resolve) => signal.addEventListener("abort", resolve, {once: true}));
							throw new PrivateProviderTransportError(
								"cancelled",
								"cancelled by caller",
								"provider-request-cancel",
							);
						})(),
					};
				},
			},
		});
		try {
			const systemPrompt = "Private broker cancellation system prompt";
			const prompt = "Wait for cancellation.";
			const running = runDshAgent({
				request: request(runId, modelRoute, systemPrompt, prompt),
				artifacts: {
					systemPrompt,
					prompt,
					workspacePath: root,
					sessionRoot: join(root, "sessions"),
				},
				installModelAdapter: createDshPrivateProviderBrokerInstaller({access: broker.access}),
				signal: controller.signal,
			});
			await started;
			controller.abort("test-cancel");
			const result = await running;
			assert.equal(result.outcome, "cancelled");
			assert.equal(broker.receipts()[0].outcome, "cancelled");
			assert.equal(broker.receipts()[0].failureKind, "cancelled");
			assert.equal(broker.receipts()[0].providerRequestId, "provider-request-cancel");
			assert.equal(
				result.executionLedger.entries.some((entry) =>
					entry.kind === "provider-call" && entry.payload.outcome === "cancelled"
				),
				true,
			);
		} finally {
			await broker.close();
			await rm(root, {recursive: true, force: true});
		}
	});

	it("rejects authenticated broker evidence when selected target differs from the Run", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-private-broker-route-"));
		const modelRoute = route();
		const runId = "run-private-broker-route-mismatch";
		const broker = await startPrivateProviderBrokerServer({
			binding: binding(),
			capabilityId: "capability-private-broker-route-mismatch",
			capabilityToken: "m".repeat(64),
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
			runId,
			routeDigest: modelRoute.routeDigest,
			transport: {
				open: async () => ({
					selectedProvider: "mock-provider",
					selectedModel: "unauthorized-model",
					providerRequestId: "provider-request-route-mismatch",
					chunks: streamChunks(),
				}),
			},
		});
		try {
			const systemPrompt = "Private broker route qualification system prompt";
			const prompt = "Reject route drift.";
			await assert.rejects(
				runDshAgent({
					request: request(runId, modelRoute, systemPrompt, prompt),
					artifacts: {
						systemPrompt,
						prompt,
						workspacePath: root,
						sessionRoot: join(root, "sessions"),
					},
					installModelAdapter: createDshPrivateProviderBrokerInstaller({access: broker.access}),
				}),
				/no authenticated receipt|does not match its exact Run route/,
			);
			assert.equal(broker.receipts()[0].selectedModel, "unauthorized-model");
			assert.equal(broker.receipts()[0].failureKind, "malformed-response");
		} finally {
			await broker.close();
			await rm(root, {recursive: true, force: true});
		}
	});

	it("owns bounded transport retry", async () => {
		const modelRoute = route();
		let attempts = 0;
		const retrying = await startPrivateProviderBrokerServer({
			binding: binding({maxRetries: 1}),
			capabilityId: "capability-retry",
			capabilityToken: "r".repeat(64),
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
			runId: "run-retry",
			routeDigest: modelRoute.routeDigest,
			transport: {
				open: async () => {
					attempts += 1;
					if (attempts === 1) {
						throw new PrivateProviderTransportError("unavailable", "temporary outage");
					}
					return {
						selectedProvider: "mock-provider",
						selectedModel: "mock-model",
						providerRequestId: "provider-request-retry",
						chunks: streamChunks(),
					};
				},
			},
		});
		const payload = {provider: "mock-provider", model: "mock-model", messages: []};
		try {
			const response = await fetch(`${retrying.access.endpoint}/v1/model-calls`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-codewiki-capability-id": retrying.access.capabilityId,
					"x-codewiki-capability-token": retrying.access.capabilityToken,
				},
				body: canonicalJson(createProviderBrokerRequest({
					runId: "run-retry",
					callIndex: 0,
					route: modelRoute,
					deadlineAt: new Date(Date.now() + 30_000).toISOString(),
					payload,
				})),
			});
			assert.equal(response.status, 200);
			await response.text();
			assert.equal(retrying.receipts()[0].outcome, "completed");
			assert.equal(retrying.receipts()[0].transportAttempts, 2);
		} finally {
			await retrying.close();
		}
	});

	it("binds one provider implementation without a backend selector", () => {
		const brokerBinding = binding();
		assert.deepEqual(brokerBinding.protocol, {
			id: "codewiki.private-provider-broker",
			version: "2.0.0",
		});
		assert.equal("mode" in brokerBinding, false);
		assert.throws(() => binding({mode: "direct"}), /mode is unsupported/);
	});
});
