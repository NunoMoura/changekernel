import type {Context, Fiber, Plugin} from "@deepseek-ai/cordis";
import Loader, {
	type EntryOptions,
} from "@deepseek-ai/cordis-plugin-loader";
import type PluginInventoryGateway from "@deepseek-ai/dsh-host-plugin-inventory";
import type {
	PluginInventorySnapshot,
} from "@deepseek-ai/dsh-host-plugin-inventory";

import type {ExecutablePluginAdmission} from "../../plugins/executable.ts";

export interface ManagedDshPluginDefinition {
	readonly entryId: string;
	readonly moduleName: string;
	readonly plugin: Plugin;
	readonly config?: unknown;
}

interface ReleaseManagedLoaderConfig extends Loader.Config {
	readonly releaseModules: ReadonlyMap<string, Plugin>;
}

class ReleaseManagedLoader extends Loader {
	override import(name: string): Plugin {
		const config = this.config as ReleaseManagedLoaderConfig;
		return releaseModule(config.releaseModules, name);
	}
}

function releaseModule(modules: ReadonlyMap<string, Plugin>, name: string): Plugin {
	const plugin = modules.get(name);
	if (!plugin) throw new Error("DSH Loader imported an undeclared Plugin.");
	return plugin;
}

export const DSH_MANAGED_EXECUTABLE_ADMISSIONS = Object.freeze([
	dshAdmission("@deepseek-ai/dsh-invariants", ["runtime-invariant-registry"]),
	dshAdmission("@deepseek-ai/dsh-llm", ["model-request-assembly"]),
	dshAdmission("@deepseek-ai/dsh-session", ["session-event-state"]),
	dshAdmission("@deepseek-ai/dsh-system-prompt", ["model-visible-prompt"]),
	runtimeBridgeAdmission("@nunomoura/codewiki/secure-code-runtime", [
		"sandboxed-code-execution",
	]),
	dshAdmission("@deepseek-ai/dsh-tools", ["tool-dispatch"]),
	dshAdmission("@deepseek-ai/dsh-agent", ["agent-registry"]),
	dshAdmission("@deepseek-ai/dsh-session-persistence-jsonl", [
		"session-root-write",
	]),
	dshAdmission("@deepseek-ai/dsh-agent-loop", ["agent-loop"]),
	dshAdmission("@deepseek-ai/dsh-session/invariant", [
		"runtime-invariant-check",
	]),
	dshAdmission("@deepseek-ai/dsh-agent/invariant", [
		"runtime-invariant-check",
	]),
	dshAdmission("@deepseek-ai/dsh-agent-loop/invariant", [
		"runtime-invariant-check",
	]),
	dshAdmission("@deepseek-ai/dsh-session-projection", [
		"session-event-projection",
	]),
	dshAdmission("@deepseek-ai/dsh-goal", ["controlled-goal-state"]),
	dshAdmission("@deepseek-ai/dsh-goal/invariant", [
		"runtime-invariant-check",
	]),
	dshAdmission("@deepseek-ai/dsh-token-meter", ["token-usage-observation"]),
	dshAdmission("@deepseek-ai/dsh-compaction-tool-result-pruner", [
		"tool-result-compaction",
	]),
	runtimeBridgeAdmission("@nunomoura/codewiki/stage-compaction", [
		"session-history-compaction",
	]),
	dshAdmission("@deepseek-ai/dsh-host-plugin-inventory", [
		"loader-state-observation",
	]),
] satisfies readonly ExecutablePluginAdmission[]);

/** Mount exact release-managed modules through DSH's Loader lifecycle authority. */
export async function mountReleaseManagedDshPlugins(
	context: Context,
	definitions: readonly ManagedDshPluginDefinition[],
): Promise<Fiber> {
	assertManagedDefinitions(definitions);
	const releaseModules = new Map(
		definitions.map((definition) => [definition.moduleName, definition.plugin]),
	);
	const loaderConfig = {releaseModules} as ReleaseManagedLoaderConfig;
	const fiber = await context.plugin(ReleaseManagedLoader, loaderConfig);
	try {
		await loadManagedDefinitions(context, definitions);
		return fiber;
	} catch (error) {
		await fiber.dispose();
		throw error;
	}
}

function assertManagedDefinitions(
	definitions: readonly ManagedDshPluginDefinition[],
): void {
	if (definitions.length < 1) {
		throw new Error("DSH managed Run composition has no Plugin entries.");
	}
	const admissionIds = new Set(
		DSH_MANAGED_EXECUTABLE_ADMISSIONS.map(({pluginId}) => pluginId),
	);
	const entryIds = new Set<string>();
	const moduleNames = new Set<string>();
	for (const definition of definitions) {
		if (entryIds.has(definition.entryId) || moduleNames.has(definition.moduleName)) {
			throw new Error("DSH managed Run Plugin identities are duplicated.");
		}
		if (!admissionIds.has(definition.moduleName)) {
			throw new Error("DSH managed Run composition contains an unadmitted Plugin.");
		}
		entryIds.add(definition.entryId);
		moduleNames.add(definition.moduleName);
	}
	if (
		definitions.at(-1)?.moduleName !==
		"@deepseek-ai/dsh-host-plugin-inventory"
	) {
		throw new Error("DSH managed Run composition must end with the live inventory Plugin.");
	}
}

async function loadManagedDefinitions(
	context: Context,
	definitions: readonly ManagedDshPluginDefinition[],
): Promise<void> {
	for (const definition of definitions) {
		const options: EntryOptions = {
			id: definition.entryId,
			name: definition.moduleName,
		};
		if (definition.config !== undefined) options.config = definition.config;
		await context.loader.create(options);
	}
	await context.loader.await();
	const inventory = context.get("pluginInventory") as
		| PluginInventoryGateway
		| undefined;
	if (!inventory) {
		throw new Error("DSH live Plugin inventory is unavailable.");
	}
	assertLiveInventory(inventory.list(), definitions);
}

function assertLiveInventory(
	snapshot: PluginInventorySnapshot,
	definitions: readonly ManagedDshPluginDefinition[],
): void {
	if (snapshot.entries.length !== definitions.length) {
		throw new Error("DSH live Plugin inventory does not match managed Run composition.");
	}
	for (const [index, definition] of definitions.entries()) {
		const observed = snapshot.entries[index];
		if (
			observed?.entryId !== definition.entryId ||
			observed.moduleName !== definition.moduleName ||
			!observed.enabled ||
			observed.fiberPhase !== "active"
		) {
			throw new Error("DSH live Plugin inventory does not match managed Run composition.");
		}
	}
}

function dshAdmission(
	pluginId: string,
	capabilities: readonly string[],
): Readonly<ExecutablePluginAdmission> {
	return Object.freeze({
		pluginId,
		kind: "dsh-plugin",
		trustPlane: "run-process",
		capabilities: Object.freeze([...capabilities]),
	});
}

function runtimeBridgeAdmission(
	pluginId: string,
	capabilities: readonly string[],
): Readonly<ExecutablePluginAdmission> {
	return Object.freeze({
		pluginId,
		kind: "runtime-bridge",
		trustPlane: "run-process",
		capabilities: Object.freeze([...capabilities]),
	});
}
