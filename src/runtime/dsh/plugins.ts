import type {Context, Fiber} from "@deepseek-ai/cordis";
import PluginInventoryGateway from "@deepseek-ai/dsh-host-plugin-inventory";

import type {RunContinuationBinding} from "../continuation.ts";
import {
	createCoreDshPluginDefinitions,
	type DshCodeModeConfig,
} from "./core-plugins.ts";
import {createDshContinuityPluginDefinitions} from "./execution-context.ts";
import {
	mountReleaseManagedDshPlugins,
	type ManagedDshPluginDefinition,
} from "./managed-loader.ts";
import {normalizeSecureCodeRuntimeConfig} from "./secure-code-runtime.ts";

export type {DshCodeModeConfig} from "./core-plugins.ts";

export function normalizeDshCodeModeConfig(
	value: unknown,
): Readonly<DshCodeModeConfig> {
	if (!isRecord(value) || !hasExactKeys(value, ["runtime", "maxParallelSubCalls"])) {
		throw new Error("DSH Code Mode config shape is invalid.");
	}
	if (
		!Number.isSafeInteger(value.maxParallelSubCalls) ||
		(value.maxParallelSubCalls as number) < 1 ||
		(value.maxParallelSubCalls as number) > 64
	) {
		throw new Error("DSH Code Mode maxParallelSubCalls is invalid.");
	}
	return Object.freeze({
		runtime: normalizeSecureCodeRuntimeConfig(value.runtime),
		maxParallelSubCalls: value.maxParallelSubCalls as number,
	});
}

export async function mountDshExecutionPlugins(input: {
	readonly context: Context;
	readonly systemPrompt: string;
	readonly sessionRoot: string;
	readonly continuation: RunContinuationBinding;
	readonly codeMode: DshCodeModeConfig | null;
}): Promise<readonly Fiber[]> {
	const definitions: ManagedDshPluginDefinition[] = [
		...createCoreDshPluginDefinitions(input),
		...createDshContinuityPluginDefinitions(input.continuation),
		{
			entryId: "plugin-inventory",
			moduleName: "@deepseek-ai/dsh-host-plugin-inventory",
			plugin: PluginInventoryGateway,
		},
	];
	const loaderFiber = await mountReleaseManagedDshPlugins(
		input.context,
		definitions,
	);
	return Object.freeze([loaderFiber]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
	const wanted = [...expected].sort((left, right) => left.localeCompare(right));
	return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}
