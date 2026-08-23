import type {CodeBindingNamespace, CodeJsonValue} from "@deepseek-ai/dsh-code-runtime";

import type {CheckInvocation} from "../../checks/contracts.ts";
import {assertCheckInvocation} from "../../checks/protocol.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	runSecureCodeProgram,
	type SecureCodeRuntimeConfig,
} from "../dsh/secure-code-runtime.ts";
import type {
	CodeCheckSandbox,
	CodeCheckSandboxRequest,
} from "./code.ts";

export interface SecureCodeCheckSandbox {
	readonly sandbox: CodeCheckSandbox;
	readonly configurationDigest: Sha256Digest;
}

/** Execute self-contained CHECK.mjs bytes in the qualified Code Mode boundary. */
export function createSecureCodeCheckSandbox(
	config: SecureCodeRuntimeConfig,
): SecureCodeCheckSandbox {
	const configurationDigest = canonicalJsonDigest({
		kind: "secure-code-check",
		version: "1.0.0",
		config,
	});
	const sandbox: CodeCheckSandbox = Object.freeze({
		admission: Object.freeze({
			hermetic: true as const,
			network: "denied" as const,
			credentials: "none" as const,
			bounded: true as const,
		}),
		async execute(request: CodeCheckSandboxRequest): Promise<unknown> {
			assertCheckInvocation(request.invocation);
			if (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs < 1) {
				throw new Error("Code Check timeout is invalid.");
			}
			if (!Number.isSafeInteger(request.maximumOutputBytes) || request.maximumOutputBytes < 1) {
				throw new Error("Code Check output limit is invalid.");
			}
			const result = await runSecureCodeProgram(
				{
					...config,
					maxWallMs: Math.min(config.maxWallMs, request.timeoutMs),
					maxOutputBytes: Math.min(config.maxOutputBytes, request.maximumOutputBytes),
				},
				{
					program: checkProgram(request.source),
					bindings: [checkBinding(request.invocation)],
					signal: request.signal,
				},
			);
			if (result.error) {
				throw new Error(`Secure Code Check ${result.error.kind}: ${result.error.message}`);
			}
			if (result.value === undefined) {
				throw new Error("Secure Code Check returned no Check Output.");
			}
			return result.value;
		},
	});
	return Object.freeze({sandbox, configurationDigest});
}

function checkBinding(invocation: CheckInvocation): CodeBindingNamespace {
	const immutableInvocation = codeJsonValue(toCanonicalJsonValue(invocation));
	return {
		global: "codewiki",
		functions: {
			async invocation(args: unknown): Promise<CodeJsonValue> {
				if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length !== 0) {
					throw new Error("codewiki.invocation accepts one empty request object.");
				}
				return immutableInvocation;
			},
		},
		errorClass: {
			name: "CodewikiCheckBindingError",
			memberNameProperty: "operation",
		},
	};
}

function codeJsonValue(value: CanonicalJsonValue): CodeJsonValue {
	if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}
	if (Array.isArray(value)) return value.map(codeJsonValue);
	return Object.fromEntries(
		Object.entries(value).map(([key, child]) => [key, codeJsonValue(child)]),
	);
}

function checkProgram(source: string): string {
	if (typeof source !== "string" || source.length === 0) {
		throw new Error("Secure Code Check source is invalid.");
	}
	const moduleUrl = `data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`;
	return `
		const checkModule = await import(${JSON.stringify(moduleUrl)});
		const executeCheck = checkModule.check ?? checkModule.default;
		if (typeof executeCheck !== "function") {
			throw new Error("CHECK.mjs must export check or default function.");
		}
		const invocation = await codewiki.invocation({});
		const sdk = Object.freeze({
			invocationDigest: invocation.invocationDigest,
			invocation: Object.freeze(invocation),
			selection(source, ref, requireComplete = true) {
				const matches = invocation.inputs.filter((selection) =>
					selection.selector.source === source &&
					((selection.selector.refs.length === 0 && ref === "") || selection.selector.refs.includes(ref))
				);
				if (matches.length !== 1) throw new Error("Check query was not declared or is ambiguous.");
				const selection = matches[0];
				if (requireComplete && (selection.status !== "ready" || selection.truncated || selection.stale)) {
					throw new Error("Check query input is incomplete, unavailable, or stale.");
				}
				return selection;
			},
			output(measurement, summary, details = []) {
				return {
					protocolId: "codewiki.check-output",
					protocolVersion: "1.0.0",
					invocationDigest: invocation.invocationDigest,
					measurement,
					summary,
					details,
				};
			},
		});
		return await executeCheck(sdk);
	`;
}
