import {canonicalJson, parseCanonicalJson} from "../kernel/data-contracts/canonical-json.ts";
import {decodeContract, exactRecord, integerField, requiredField, textField} from "../kernel/data-contracts/validation.ts";
import type {Sha256Digest} from "../kernel/identity/sha256.ts";

/** A rejected call is not proof of provider closure. Hosts must retain this distinction. */
export class UncertainCheckModelCustody extends Error {}

export const CHECK_MODEL_PORT_PROTOCOL = "changekernel.check-model@1.0.0";
export type CheckModelStructure = Readonly<Record<string, "string" | "boolean" | "number">>;
export interface CheckModelRequest {
	readonly prompt: string;
	readonly shape: CheckModelStructure;
	readonly maximumInputTokens: number;
	readonly maximumOutputTokens: number;
	readonly maximumResponseBytes: number;
}
/** Backend-only capability. A descriptor alone does not establish permission or locality. */
export interface CheckModelPort {
	readonly protocol: typeof CHECK_MODEL_PORT_PROTOCOL;
	readonly routeDigest: Sha256Digest;
	readonly settingsDigest: Sha256Digest;
	readonly locality: "local" | "private";
	call(request: CheckModelRequest, signal: AbortSignal): Promise<Readonly<{value: unknown; inputTokens: number; outputTokens: number}>>;
}
export function decodeCheckModelStructure(input: unknown) {
	return decodeContract("Check model structure", input, value => {
		if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("Expected a flat structure.");
		const entries = Object.entries(value);
		if (!entries.length || entries.length > 16 || entries.some(([key, type]) => !/^[a-z][a-zA-Z0-9]{0,63}$/u.test(key) || typeof type !== "string" || !["string", "boolean", "number"].includes(type))) throw new Error("Unsupported model structure.");
		return value as CheckModelStructure;
	});
}
export function decodeCheckModelRequest(input: unknown) {
	return decodeContract("Check model request", input, value => {
		const r = exactRecord("Check model request", value, "$", ["prompt", "shape", "maximumInputTokens", "maximumOutputTokens", "maximumResponseBytes"]);
		const shape = decodeCheckModelStructure(requiredField("Check model request", r, "shape"));
		const prompt = textField("Check model request", r, "prompt", "$", {maximumBytes: 262144});
		if (!shape.ok || !prompt.trim()) throw new Error("Invalid model request.");
		return Object.freeze({prompt, shape: shape.value,
			maximumInputTokens: integerField("Check model request", r, "maximumInputTokens", "$", 1, 1048576),
			maximumOutputTokens: integerField("Check model request", r, "maximumOutputTokens", "$", 1, 1048576),
			maximumResponseBytes: integerField("Check model request", r, "maximumResponseBytes", "$", 1, 65536)});
	}, {maximumDepth: 8, maximumEntriesPerContainer: 32, maximumNodes: 128, maximumTextBytes: 512 * 1024});
}
export function decodeCheckModelValue(input: unknown, structure: CheckModelStructure) {
	return decodeContract("Check model value", input, value => {
		const r = exactRecord("Check model value", value, "$", Object.keys(structure));
		for (const [key, type] of Object.entries(structure)) if (typeof r[key] !== type) throw new Error("Model output differs from its declared structure.");
		return r;
	}, {maximumDepth: 4, maximumEntriesPerContainer: 32, maximumNodes: 64, maximumTextBytes: 65536});
}
export function parseCheckModelValue(text: string, request: CheckModelRequest) {
	if (new TextEncoder().encode(text).length > request.maximumResponseBytes) throw new Error("Model output exceeds its byte budget.");
	const parsed = parseCanonicalJson(text, {requireCanonicalBytes: true});
	if (!parsed.ok) throw new Error("Model output is not canonical JSON; no repair or retry was attempted.");
	const value = decodeCheckModelValue(parsed.value, request.shape);
	if (!value.ok) throw new Error("Model output violates the declared structure.");
	return value.value;
}
export function checkModelJson(value: unknown): string {
	const encoded = canonicalJson(value);
	if (!encoded.ok) throw new Error("Invalid model boundary data.");
	return encoded.value;
}
