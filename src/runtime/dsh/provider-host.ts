import {existsSync, realpathSync} from "node:fs";
import {dirname, isAbsolute, relative, resolve, sep} from "node:path";

import {Context, type Fiber} from "@deepseek-ai/cordis";
import {credentialRef} from "@deepseek-ai/dsh-credentials";
import type PluginInventoryGateway from "@deepseek-ai/dsh-host-plugin-inventory";
import type {PluginInventorySnapshot} from "@deepseek-ai/dsh-host-plugin-inventory";
import {assertUsableApiKey, type GenerateOptions} from "@deepseek-ai/dsh-llm";
import type {
	PiAiProviderProfile,
	Config as PiAiConfig,
} from "@deepseek-ai/dsh-llm-pi-ai";

import type {ExecutablePluginAdmissionClosure} from "../../plugins/executable.ts";
import {
	canonicalJsonDigest,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import type {
	PrivateProviderTransportPort,
	PrivateProviderTransportResult,
} from "../providers/broker-server.ts";
import {PrivateProviderTransportError} from "../providers/broker-server.ts";
import type {ProviderBrokerRequest} from "../providers/contracts.ts";
import {
	createDshBrokerHostPluginDefinitions,
	DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS,
} from "./broker-plugins.ts";
import {mountReleaseManagedDshPlugins} from "./managed-loader.ts";

export type DshProviderFamily =
	| "openai"
	| "anthropic"
	| "deepseek"
	| "openai-compatible";

export interface DshBrokerHostRoute {
	readonly routeId: string;
	readonly provider: string;
	readonly family: DshProviderFamily;
	readonly accountId: string;
	readonly credentialRef: string;
	readonly model: string;
}

export interface DshProviderHostOptions {
	readonly deploymentClass: "isolated-single-user";
	readonly credentialPath: string;
	readonly forbiddenCredentialRoots: readonly string[];
	readonly providers: NonNullable<PiAiConfig["providers"]>;
	readonly routes: readonly DshBrokerHostRoute[];
	readonly admissionClosure: ExecutablePluginAdmissionClosure;
}

export interface DshProviderCredentialStatus {
	readonly accountId: string;
	readonly credentialRef: string;
	readonly configured: boolean;
	readonly source: string | null;
	readonly writable: boolean;
}

export interface DshProviderHost {
	readonly configurationDigest: Sha256Digest;
	readonly transport: PrivateProviderTransportPort;
	readonly inventory: () => PluginInventorySnapshot;
	readonly credentialStatus: (accountId: string) => Promise<DshProviderCredentialStatus>;
	readonly setApiKey: (accountId: string, value: string) => Promise<void>;
	readonly forgetApiKey: (accountId: string) => Promise<void>;
	readonly close: () => Promise<void>;
}

interface AdmittedProviderHostConfig {
	readonly credentialPath: string;
	readonly providers: NonNullable<PiAiConfig["providers"]>;
	readonly routes: readonly DshBrokerHostRoute[];
	readonly configurationDigest: Sha256Digest;
}

export async function createDshProviderHost(
	options: DshProviderHostOptions,
): Promise<DshProviderHost> {
	const admitted = admitProviderHostConfig(options);
	const context = new Context();
	let fiber: Fiber | undefined;
	try {
		fiber = await mountReleaseManagedDshPlugins(
			context,
			createDshBrokerHostPluginDefinitions(admitted),
			DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS,
		);
		await assertConfiguredModels(context, admitted.routes);
		const accounts = accountBindings(admitted.routes);
		return Object.freeze({
			configurationDigest: admitted.configurationDigest,
			transport: providerTransport(context, admitted.routes),
			inventory: () => providerInventory(context),
			credentialStatus: async (accountId: string) => {
				const account = requiredAccount(accounts, accountId);
				const info = await context.credentials.describe(credentialRef(account.credentialRef));
				return Object.freeze({
					accountId: account.accountId,
					credentialRef: account.credentialRef,
					configured: info.configured,
					source: info.source ?? null,
					writable: info.writable,
				});
			},
			setApiKey: async (accountId: string, value: string) => {
				const account = requiredAccount(accounts, accountId);
				const ref = credentialRef(account.credentialRef);
				await context.credentials.set(
					ref,
					assertUsableApiKey(value, "CodeWiki Broker Host", account.credentialRef),
				);
			},
			forgetApiKey: async (accountId: string) => {
				const account = requiredAccount(accounts, accountId);
				await context.credentials.unset(credentialRef(account.credentialRef));
			},
			close: async () => {
				await fiber?.dispose();
				await context.fiber.dispose();
			},
		});
	} catch (error) {
		await fiber?.dispose();
		await context.fiber.dispose();
		throw error;
	}
}

function admitProviderHostConfig(
	options: DshProviderHostOptions,
): AdmittedProviderHostConfig {
	if (options.deploymentClass !== "isolated-single-user") {
		throw new Error("DSH local credentials require isolated single-user deployment.");
	}
	assertBrokerHostAdmissions(options.admissionClosure);
	const credentialPath = admittedCredentialPath(
		options.credentialPath,
		options.forbiddenCredentialRoots,
	);
	const providers = structuredClone(options.providers);
	const routes = Object.freeze(options.routes.map((route) => admitRoute(route, providers)));
	if (routes.length < 1 || routes.length > 64) {
		throw new Error("DSH Broker Host requires one through 64 exact routes.");
	}
	assertUnique(routes.map(({routeId}) => routeId), "DSH Broker Host route ids");
	assertExactProviderSet(providers, routes);
	assertAccountConsistency(routes);
	for (const reference of new Set(routes.map((route) => route.credentialRef))) {
		if (process.env[reference]) {
			throw new Error("DSH Broker Host ambient credential sources are unsupported.");
		}
	}
	const composition = createDshBrokerHostPluginDefinitions({credentialPath, providers});
	const body = {
		schemaVersion: "1.0.0",
		deploymentClass: options.deploymentClass,
		credentialPath,
		providers,
		routes,
		composition: composition.map(({entryId, moduleName, admissionId}) => ({
			entryId,
			moduleName,
			admissionId: admissionId ?? moduleName,
		})),
		admissionClosureDigest: options.admissionClosure.closureDigest,
	};
	return Object.freeze({
		credentialPath,
		providers,
		routes,
		configurationDigest: canonicalJsonDigest(body),
	});
}

function admitRoute(
	route: DshBrokerHostRoute,
	providers: NonNullable<PiAiConfig["providers"]>,
): DshBrokerHostRoute {
	const admitted = Object.freeze({
		routeId: identifier(route.routeId, "DSH Broker Host route id"),
		provider: identifier(route.provider, "DSH Broker Host provider"),
		family: providerFamily(route.family),
		accountId: identifier(route.accountId, "DSH Broker Host account id"),
		credentialRef: String(credentialRef(route.credentialRef)),
		model: modelId(route.model),
	});
	const profile = providers[admitted.provider];
	if (!profile) throw new Error("DSH Broker Host route has no provider profile.");
	assertApiKeyProfile(admitted, profile);
	return admitted;
}

function assertApiKeyProfile(
	route: DshBrokerHostRoute,
	profile: PiAiProviderProfile,
): void {
	if (profile.apiKeyEnv !== route.credentialRef) {
		throw new Error("DSH Broker Host route credential reference does not match its provider profile.");
	}
	if (profile.headers !== undefined) {
		throw new Error("DSH Broker Host provider headers are unsupported; use credential references.");
	}
	const allowedApis: Readonly<Record<DshProviderFamily, readonly (string | undefined)[]>> = {
		openai: [undefined, "openai-completions", "openai-responses"],
		anthropic: [undefined, "anthropic-messages"],
		deepseek: [undefined, "openai-completions"],
		"openai-compatible": ["openai-completions", "openai-responses"],
	};
	if (!allowedApis[route.family].includes(profile.api)) {
		throw new Error("DSH Broker Host provider protocol is unsupported for its family.");
	}
	if (route.family === "openai-compatible") {
		if (!profile.baseURL || !profile.models?.length) {
			throw new Error("Custom OpenAI-compatible routes require an endpoint and exact models.");
		}
	}
	if (profile.baseURL !== undefined) assertProviderEndpoint(profile.baseURL);
	if (profile.models?.length && !profile.models.some(({id}) => id === route.model)) {
		throw new Error("DSH Broker Host route model is absent from its provider profile.");
	}
}

function providerTransport(
	context: Context,
	routes: readonly DshBrokerHostRoute[],
): PrivateProviderTransportPort {
	const byId = new Map(routes.map((route) => [route.routeId, route]));
	return Object.freeze({
		open: async (
			request: ProviderBrokerRequest,
			signal: AbortSignal,
		): Promise<PrivateProviderTransportResult> => {
			const route = byId.get(request.route.routeId);
			if (
				!route ||
				route.provider !== request.route.provider ||
				route.accountId !== request.route.accountId ||
				route.credentialRef !== request.route.credentialRef ||
				route.model !== request.route.model
			) {
				throw new PrivateProviderTransportError(
					"authentication",
					"DSH Broker Host rejected an unauthorized route or account.",
				);
			}
			const info = await context.credentials.describe(credentialRef(route.credentialRef));
			if (!info.configured || info.source !== "file") {
				throw new PrivateProviderTransportError(
					"authentication",
					"DSH Broker Host route credential is unavailable from admitted storage.",
				);
			}
			return Object.freeze({
				selectedProvider: route.provider,
				selectedAccountId: route.accountId,
				selectedModel: route.model,
				providerRequestId: null,
				chunks: context.llm.stream(providerOptions(request.payload, route, signal)),
			});
		},
	});
}

function providerOptions(
	payload: CanonicalJsonValue,
	route: DshBrokerHostRoute,
	signal: AbortSignal,
): GenerateOptions {
	if (!payload || Array.isArray(payload) || typeof payload !== "object") {
		throw new PrivateProviderTransportError("malformed-response", "Provider payload is invalid.");
	}
	const value = payload as Record<string, CanonicalJsonValue>;
	const allowed = new Set([
		"provider",
		"model",
		"reasoningEffort",
		"messages",
		"system",
		"tools",
		"temperature",
		"maxTokens",
		"stop",
		"sessionId",
		"purpose",
	]);
	if (
		Object.keys(value).some((key) => !allowed.has(key)) ||
		value.provider !== route.provider ||
		value.model !== route.model ||
		!Array.isArray(value.messages)
	) {
		throw new PrivateProviderTransportError("authentication", "Provider payload exceeds its route capability.");
	}
	const cloned = structuredClone(value);
	// SAFETY: closed keys and exact provider/model/messages were checked above; DSH validates nested request vocabulary.
	return {...cloned, signal} as unknown as GenerateOptions;
}

async function assertConfiguredModels(
	context: Context,
	routes: readonly DshBrokerHostRoute[],
): Promise<void> {
	for (const route of routes) {
		const model = await context.llm.resolveModelInfo(route.provider, route.model);
		if (model.provider !== route.provider || model.id !== route.model) {
			throw new Error("DSH Broker Host model resolution drifted from exact route identity.");
		}
	}
}

function providerInventory(context: Context): PluginInventorySnapshot {
	const inventory = context.get("pluginInventory") as PluginInventoryGateway | undefined;
	if (!inventory) throw new Error("DSH Broker Host Plugin inventory is unavailable.");
	return inventory.list();
}

function accountBindings(
	routes: readonly DshBrokerHostRoute[],
): ReadonlyMap<string, DshBrokerHostRoute> {
	return new Map(routes.map((route) => [route.accountId, route]));
}

function requiredAccount(
	accounts: ReadonlyMap<string, DshBrokerHostRoute>,
	accountId: string,
): DshBrokerHostRoute {
	const account = accounts.get(identifier(accountId, "DSH Broker Host account id"));
	if (!account) throw new Error("DSH Broker Host account is not admitted.");
	return account;
}

function assertBrokerHostAdmissions(closure: ExecutablePluginAdmissionClosure): void {
	const admitted = new Map(closure.admissions.map((entry) => [entry.pluginId, entry]));
	for (const expected of DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS) {
		const observed = admitted.get(expected.pluginId);
		if (
			!observed ||
			observed.kind !== expected.kind ||
			observed.trustPlane !== expected.trustPlane ||
			canonicalJsonDigest(observed.capabilities) !==
				canonicalJsonDigest([...expected.capabilities].sort(compareText))
		) {
			throw new Error("DSH Broker Host executable Plugin admission is incomplete.");
		}
	}
}

function assertExactProviderSet(
	providers: NonNullable<PiAiConfig["providers"]>,
	routes: readonly DshBrokerHostRoute[],
): void {
	const configured = Object.keys(providers).sort(compareText);
	const authorized = [...new Set(routes.map(({provider}) => provider))].sort(compareText);
	if (
		configured.length !== authorized.length ||
		configured.some((provider, index) => provider !== authorized[index])
	) {
		throw new Error("DSH Broker Host provider profiles must exactly match authorized routes.");
	}
}

function assertAccountConsistency(routes: readonly DshBrokerHostRoute[]): void {
	const accounts = new Map<string, string>();
	for (const route of routes) {
		const identity = `${route.provider}\0${route.credentialRef}`;
		const existing = accounts.get(route.accountId);
		if (existing !== undefined && existing !== identity) {
			throw new Error("DSH Broker Host account maps to conflicting provider credentials.");
		}
		accounts.set(route.accountId, identity);
	}
}

function admittedCredentialPath(path: string, forbiddenRoots: readonly string[]): string {
	if (!isAbsolute(path) || forbiddenRoots.length < 1) {
		throw new Error("DSH Broker Host credential path and exclusion roots must be absolute.");
	}
	const candidate = futureRealpath(path);
	for (const root of forbiddenRoots.map(futureRealpath)) {
		if (within(root, candidate)) {
			throw new Error("DSH Broker Host credential storage overlaps a forbidden Run root.");
		}
	}
	return candidate;
}

function futureRealpath(path: string): string {
	let cursor = resolve(path);
	const suffix: string[] = [];
	while (!existsSync(cursor)) {
		const parent = dirname(cursor);
		if (parent === cursor) break;
		suffix.unshift(cursor.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
		cursor = parent;
	}
	const base = existsSync(cursor) ? realpathSync.native(cursor) : cursor;
	return resolve(base, ...suffix);
}

function within(parent: string, candidate: string): boolean {
	const child = relative(parent, candidate);
	return child === "" || (!child.startsWith(`..${sep}`) && child !== "..");
}

function assertProviderEndpoint(value: string): void {
	let endpoint: URL;
	try {
		endpoint = new URL(value);
	} catch {
		throw new Error("DSH Broker Host provider endpoint is invalid.");
	}
	const loopback = ["127.0.0.1", "[::1]", "::1", "localhost"].includes(endpoint.hostname);
	if (
		(endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && loopback)) ||
		endpoint.username ||
		endpoint.password ||
		endpoint.search ||
		endpoint.hash
	) {
		throw new Error("DSH Broker Host provider endpoint is unsupported.");
	}
}

function providerFamily(value: unknown): DshProviderFamily {
	if (!["openai", "anthropic", "deepseek", "openai-compatible"].includes(String(value))) {
		throw new Error("DSH Broker Host provider family is unsupported.");
	}
	return value as DshProviderFamily;
}

function identifier(value: unknown, field: string): string {
	if (
		typeof value !== "string" ||
		!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)
	) throw new Error(`${field} is invalid.`);
	return value;
}

function modelId(value: unknown): string {
	if (
		typeof value !== "string" ||
		value.length < 1 ||
		value.length > 256 ||
		/[\u0000-\u001f\u007f]/.test(value)
	) throw new Error("DSH Broker Host model id is invalid.");
	return value;
}

function assertUnique(values: readonly string[], field: string): void {
	if (new Set(values).size !== values.length) throw new Error(`${field} are duplicated.`);
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

