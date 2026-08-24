import type {Plugin} from "@deepseek-ai/cordis";
import AuthorizationService from "@deepseek-ai/dsh-authorization";
import LocalCredentialProvider from "@deepseek-ai/dsh-credentials-local";
import PluginInventoryGateway from "@deepseek-ai/dsh-host-plugin-inventory";
import LlmRuntime from "@deepseek-ai/dsh-llm";
import * as PiAiPlugin from "@deepseek-ai/dsh-llm-pi-ai";
import type {Config as PiAiConfig} from "@deepseek-ai/dsh-llm-pi-ai";

import type {ExecutablePluginAdmission} from "../../plugins/executable.ts";
import type {ManagedDshPluginDefinition} from "./managed-loader.ts";

export const DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS = Object.freeze([
	brokerHostAdmission("codewiki:broker-host", "infrastructure-provider", [
		"provider-route-enforcement",
		"provider-network-egress",
		"provider-receipt-authentication",
	]),
	brokerHostAdmission("dsh:broker-host:credentials-local", "dsh-plugin", [
		"credential-custody",
		"credential-reference-resolution",
		"credential-record-mutation",
	]),
	brokerHostAdmission("dsh:broker-host:authorization", "dsh-plugin", [
		"provider-authorization-flow",
	]),
	brokerHostAdmission("dsh:broker-host:llm", "dsh-plugin", [
		"provider-request-dispatch",
	]),
	brokerHostAdmission("dsh:broker-host:llm-pi-ai", "dsh-plugin", [
		"provider-wire-protocol",
		"provider-model-catalog",
	]),
	brokerHostAdmission("dsh:broker-host:plugin-inventory", "dsh-plugin", [
		"loader-state-observation",
	]),
] satisfies readonly ExecutablePluginAdmission[]);

export function createDshBrokerHostPluginDefinitions(input: {
	readonly credentialPath: string;
	readonly providers: PiAiConfig["providers"];
}): readonly ManagedDshPluginDefinition[] {
	return [
		definition(
			"broker-credentials",
			"@deepseek-ai/dsh-credentials-local",
			"dsh:broker-host:credentials-local",
			LocalCredentialProvider,
			{path: input.credentialPath, watch: false},
		),
		definition(
			"broker-authorization",
			"@deepseek-ai/dsh-authorization",
			"dsh:broker-host:authorization",
			AuthorizationService,
		),
		definition(
			"broker-llm",
			"@deepseek-ai/dsh-llm",
			"dsh:broker-host:llm",
			LlmRuntime,
		),
		definition(
			"broker-llm-pi-ai",
			"@deepseek-ai/dsh-llm-pi-ai",
			"dsh:broker-host:llm-pi-ai",
			PiAiPlugin,
			{providers: input.providers ?? {}},
		),
		definition(
			"broker-plugin-inventory",
			"@deepseek-ai/dsh-host-plugin-inventory",
			"dsh:broker-host:plugin-inventory",
			PluginInventoryGateway,
		),
	];
}

function definition(
	entryId: string,
	moduleName: string,
	admissionId: string,
	plugin: Plugin,
	config?: unknown,
): ManagedDshPluginDefinition {
	return {
		entryId,
		moduleName,
		admissionId,
		plugin,
		...(config === undefined ? {} : {config}),
	};
}

function brokerHostAdmission(
	pluginId: string,
	kind: ExecutablePluginAdmission["kind"],
	capabilities: readonly string[],
): Readonly<ExecutablePluginAdmission> {
	return Object.freeze({
		pluginId,
		kind,
		trustPlane: "broker-host",
		capabilities: Object.freeze([...capabilities]),
	});
}
