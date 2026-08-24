import {isAbsolute, resolve} from "node:path";

import {
	assertRuntimeProductionQualification,
	type RuntimeOperationsInspectionPort,
	type RuntimeProductionQualification,
} from "../protocol/backend-production.ts";
import {readStoredRuntimeBuildRegistry} from "./builds/store.ts";
import {readStoredRunReceipt} from "./receipts/store.ts";

export function createStoredRuntimeOperationsInspectionPort(input: {
	readonly stateRoot: string;
	readonly evidenceStateRoot: string;
	readonly productionQualification?: RuntimeProductionQualification | null;
}): RuntimeOperationsInspectionPort {
	const stateRoot = absoluteRoot(input.stateRoot, "Runtime operations state root");
	const evidenceStateRoot = absoluteRoot(
		input.evidenceStateRoot,
		"Runtime operations evidence state root",
	);
	const productionQualification = input.productionQualification ?? null;
	if (productionQualification) {
		assertRuntimeProductionQualification(productionQualification);
	}
	return Object.freeze({
		readBuildRegistry: () => readStoredRuntimeBuildRegistry({stateRoot}),
		readProductionQualification: async () => productionQualification,
		readReceipt: (
			query: Parameters<RuntimeOperationsInspectionPort["readReceipt"]>[0],
		) => readStoredRunReceipt({
			stateRoot: evidenceStateRoot,
			runId: query.runId,
			requestDigest: query.requestDigest,
		}),
	});
}

function absoluteRoot(value: string, field: string): string {
	if (typeof value !== "string" || !isAbsolute(value) || resolve(value) !== value) {
		throw new Error(`${field} must be normalized and absolute.`);
	}
	return value;
}
