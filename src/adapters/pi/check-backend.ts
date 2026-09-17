import {createLinuxCheckHost, type LinuxCheckHostOptions} from "../checks/linux-host.ts";
import {failure, success} from "../../kernel/data-contracts/outcome.ts";
import {semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {createPiCheckModel} from "./check-model.ts";
import {createPiOpenAIProvider, type PiOpenAIConfiguration} from "./provider.ts";

export interface PiCheckBackendOptions extends Omit<LinuxCheckHostOptions, "model"> {
	/** Verified immutable backend build/dependency identity, supplied by the trusted host. */
	readonly backendIdentityDigest: Sha256Digest;
	/** Opaque backend-owned credential version; never the key or a public hash of it. */
	readonly credentialBindingDigest: Sha256Digest;
	readonly provider: Omit<PiOpenAIConfiguration, "maximumRequests">;
}

/**
 * Private composition for one literal-loopback OpenAI-compatible Check route.
 * This does not verify a release, adopt policy, authorize calls or prove that the
 * loopback service itself processes data locally. Those remain host obligations.
 * Producer execution and recovery of unresolved attempts are not supplied here.
 */
export async function createPiCheckBackend(input: PiCheckBackendOptions) {
	const options = Object.freeze({...input});
	let provider: PiOpenAIConfiguration;
	let providerConfigurationDigest: Sha256Digest;
	try {
		if (!decodeSha256Digest(options.backendIdentityDigest).ok || !decodeSha256Digest(options.credentialBindingDigest).ok) throw new Error("Missing backend identity.");
		const endpoint = new URL(options.provider.baseUrl);
		if (!["127.0.0.1", "[::1]"].includes(endpoint.hostname)) throw new Error("Unsupported model destination.");
		provider = Object.freeze({...options.provider, baseUrl: endpoint.href.replace(/\/$/u, ""), maximumRequests: 1});
		// Validate without inference. Every admitted model call gets a fresh lease.
		const probe = createPiOpenAIProvider(provider);
		await probe.dispose();
		const identity = semanticDigest("changekernel.pi-check-backend@1.0.0", {
			backendIdentityDigest: options.backendIdentityDigest,
			credentialBindingDigest: options.credentialBindingDigest,
			providerId: provider.providerId, modelId: provider.modelId, baseUrl: provider.baseUrl,
			maximumRequests: provider.maximumRequests, maximumResponseBytes: provider.maximumResponseBytes,
			maximumOutputTokens: provider.maximumOutputTokens, contextWindow: provider.contextWindow,
			timeoutMs: provider.timeoutMs, temperature: provider.temperature,
		});
		if (!identity.ok) throw new Error("Invalid backend configuration.");
		providerConfigurationDigest = identity.value;
	} catch {
		return failure(Object.freeze({code: "invalid-options" as const, message: "An explicit bounded loopback provider and backend/credential identities are required."}));
	}
	const model = createPiCheckModel({providerId: provider.providerId, modelId: provider.modelId, locality: "local",
		providerConfigurationDigest, temperature: provider.temperature, reasoningEffort: null}, binding =>
		Object.freeze({...createPiOpenAIProvider(provider), routeDigest: binding.routeDigest, settingsDigest: binding.settingsDigest}));
	if (!model.ok) return model;
	const host = await createLinuxCheckHost({custodyRoot: options.custodyRoot, stateIdentity: options.stateIdentity, authorize: options.authorize, model: model.value, kernelBuildDigest: options.kernelBuildDigest});
	if (!host.ok) return host;
	return success(Object.freeze({...host.value, modelBinding: Object.freeze({routeDigest: model.value.routeDigest, settingsDigest: model.value.settingsDigest})}));
}
