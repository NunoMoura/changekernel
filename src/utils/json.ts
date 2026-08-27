import type { TSchema } from "typebox";
import { Errors } from "typebox/value";

export function parseJsonObject<T>(text: string, label = "JSON input"): T {
	try {
		return JSON.parse(text) as T;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(`Invalid ${label}: ${reason}`);
	}
}

export function plainRecord(value: unknown, label: string): Record<string, unknown> {
	if (
		value === null ||
		Array.isArray(value) ||
		(typeof value !== "object") ||
		!([Object.prototype, null] as unknown[]).includes(Object.getPrototypeOf(value))
	) {
		throw new Error(`${label} must be a plain object.`);
	}
	return value as Record<string, unknown>;
}

export function assertExactKeys(
	value: unknown,
	allowed: readonly string[],
	label: string,
): void {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${label} must be an object.`);
	}
	const allowedKeys = new Set(allowed);
	const unsupported = Reflect.ownKeys(value).find(
		(key) => typeof key !== "string" || !allowedKeys.has(key),
	);
	if (unsupported !== undefined) {
		throw new Error(`${label} received unsupported field ${String(unsupported)}.`);
	}
}

export function assertRequiredExactKeys(
	value: unknown,
	required: readonly string[],
	label = "Value",
): void {
	if (typeof value !== "object" || value === null) {
		throw new Error(`${label} must be an object.`);
	}
	const keys = Reflect.ownKeys(value);
	if (
		keys.length !== required.length ||
		keys.some((key) => typeof key !== "string" || !required.includes(key))
	) {
		throw new Error(`Unexpected fields: ${Object.keys(value).join(", ")}.`);
	}
}

export function assertTypeboxSchema(
	schema: TSchema,
	value: unknown,
	label: string,
): void {
	const [error] = Errors(schema, value);
	if (!error) return;
	if (error.keyword === "additionalProperties") {
		const field = (error.params.additionalProperties as string[])[0];
		const location = error.instancePath || "/";
		throw new Error(
			`${label} received unsupported field ${field} at ${location}.`,
		);
	}
	const location = error.instancePath || "/";
	throw new Error(`${label} is invalid at ${location}: ${error.message}.`);
}
