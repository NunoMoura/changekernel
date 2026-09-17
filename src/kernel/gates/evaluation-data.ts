import type {CanonicalValue} from "../data-contracts/canonical-json.ts";
import type {Outcome} from "../data-contracts/outcome.ts";
import {
	arrayField, booleanField, decodeContract, exactRecord, integerField, isNamespacedIdentifier,
	literalField, rejectContract, requiredField, textField, type CanonicalRecord, type ContractIssue,
} from "../data-contracts/validation.ts";
import {decodeGitOidValue} from "../identity/git.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";

export const CONTRACT = "Unified Check";
export const LIMITS = Object.freeze({maximumDepth: 32, maximumNodes: 32768, maximumEntriesPerContainer: 256, maximumTextBytes: 512 * 1024});

export function fail(message: string): never {return rejectContract("invalid_field", CONTRACT, "$", message);}
export function admit<T>(result: Outcome<T, ContractIssue>): T {
	if (!result.ok) rejectContract(result.error.code, CONTRACT, result.error.path, result.error.message);
	return result.value;
}
export function hash(domain: string, value: unknown): Sha256Digest {
	const result = semanticDigest(domain, value);
	if (!result.ok) fail(result.error.message);
	return result.value;
}
export function digest(r: CanonicalRecord, key: string): Sha256Digest {
	const result = decodeSha256Digest(requiredField(CONTRACT, r, key));
	if (!result.ok) fail(`Invalid ${key} digest.`);
	return result.value;
}
export function text(r: CanonicalRecord, key: string, maximumBytes = 4096): string {
	const value = textField(CONTRACT, r, key, "$", {maximumBytes});
	if (!value.trim() || /[\uD800-\uDFFF]/u.test(value)) fail(`Invalid ${key} text.`);
	return value;
}
export function id(r: CanonicalRecord, key: string): string {
	const value = text(r, key, 256);
	if (!isNamespacedIdentifier(value)) fail(`Expected namespaced ${key}.`);
	return value;
}
export function compare(a: string, b: string): number {
	if (a === b) return 0;
	return a < b ? -1 : 1;
}
export function ordered(values: readonly string[]): void {
	if (values.some((value, i) => i > 0 && (values[i - 1] ?? "") >= value)) fail("Entries must be sorted and unique.");
}
export function list<T>(r: CanonicalRecord, key: string, parse: (value: CanonicalValue) => T, maximum = 64): readonly T[] {
	return Object.freeze(arrayField(CONTRACT, r, key, "$", maximum).map(parse));
}
export function texts(r: CanonicalRecord, key: string): readonly string[] {
	return list(r, key, value => text({value}, "value"));
}
export function digests(r: CanonicalRecord, key: string): readonly Sha256Digest[] {
	const values = list(r, key, value => digest({value}, "value")); ordered(values); return values;
}
export function record(value: CanonicalValue, keys: readonly string[]): CanonicalRecord {return exactRecord(CONTRACT, value, "$", keys);}

/** The protocol domain is new; no old Gate or Finding bytes are reinterpreted. */
export function codec<T>(protocol: string, fields: readonly string[], parse: (r: CanonicalRecord) => T) {
	const decode = (input: unknown) => decodeContract(CONTRACT, input, value => {
		const r = record(value, ["protocol", "digest", ...fields]);
		if (r.protocol !== protocol) rejectContract("invalid_protocol", CONTRACT, "$.protocol", `Expected ${protocol}.`);
		const body = Object.freeze({protocol, ...parse(r)});
		const identity = digest(r, "digest");
		if (identity !== hash(protocol, body)) fail("Record digest differs from its exact content.");
		return Object.freeze({...body, digest: identity});
	}, LIMITS);
	const create = (input: unknown) => decodeContract(CONTRACT, input, value => {
		const r = record(value, fields);
		const body = {protocol, ...parse(r)};
		return admit(decode({...body, digest: hash(protocol, body)}));
	}, LIMITS);
	return {create, decode};
}

export function snapshot(value: CanonicalValue) {
	const r = record(value, ["repositoryId", "commit", "tree"]);
	const commit = decodeGitOidValue(requiredField(CONTRACT, r, "commit"));
	const tree = decodeGitOidValue(requiredField(CONTRACT, r, "tree"));
	if (commit.algorithm !== tree.algorithm) fail("Snapshot object formats differ.");
	return Object.freeze({repositoryId: id(r, "repositoryId"), commit, tree});
}
export function source(value: CanonicalValue) {
	const r = record(value, ["snapshot", "path", "blob"]);
	const bound = snapshot(requiredField(CONTRACT, r, "snapshot"));
	const path = text(r, "path", 8192);
	if (path.startsWith("/") || path.includes("\\") || /[\u0000-\u001f]/u.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) fail("Source path must be project-relative.");
	const blob = decodeGitOidValue(requiredField(CONTRACT, r, "blob"));
	if (blob.algorithm !== bound.commit.algorithm) fail("Source object formats differ.");
	return Object.freeze({snapshot: bound, path, blob});
}
export function equal(left: unknown, right: unknown): boolean {return hash("changekernel.check-comparison@1.0.0", left) === hash("changekernel.check-comparison@1.0.0", right);}
export function bounds(value: CanonicalValue) {
	const r = record(value, ["milliseconds", "memoryBytes", "inputBytes", "outputBytes", "modelCalls", "modelInputTokens", "modelOutputTokens"]);
	const number = (key: string, min: number, max: number) => integerField(CONTRACT, r, key, "$", min, max);
	const result = Object.freeze({milliseconds: number("milliseconds", 1, 3600000), memoryBytes: number("memoryBytes", 1, 2147483648),
		inputBytes: number("inputBytes", 1, 262144), outputBytes: number("outputBytes", 1, 65536), modelCalls: number("modelCalls", 0, 32),
		modelInputTokens: number("modelInputTokens", 0, 1048576), modelOutputTokens: number("modelOutputTokens", 0, 1048576)});
	if (result.modelCalls === 0 ? result.modelInputTokens !== 0 || result.modelOutputTokens !== 0 : result.modelInputTokens === 0 || result.modelOutputTokens === 0) fail("Model token budgets must agree with the call budget.");
	return result;
}
export function subject(value: CanonicalValue) {
	const r = record(value, ["baseline", "candidate", "subjectDigest"]);
	const baseline = snapshot(requiredField(CONTRACT, r, "baseline")), candidate = snapshot(requiredField(CONTRACT, r, "candidate"));
	if (baseline.repositoryId !== candidate.repositoryId || baseline.commit.algorithm !== candidate.commit.algorithm) fail("Subject snapshots must share Project and object format.");
	return Object.freeze({baseline, candidate, subjectDigest: digest(r, "subjectDigest")});
}
export function effectKinds(r: CanonicalRecord) {
	const effects = list(r, "effects", value => id({value}, "value")); ordered(effects); return effects;
}

export function inputSlots(r: CanonicalRecord) {
	const slots = list(r, "slots", value => {
		const slot = record(value, ["name", "status", "value", "sources", "evidenceDigests", "omissions"]);
		const status = literalField(CONTRACT, slot, "status", ["available", "missing", "stale", "denied"] as const);
		const data = requiredField(CONTRACT, slot, "value"), omissions = texts(slot, "omissions");
		if (status !== "available" && (data !== null || omissions.length === 0)) fail("Unavailable input needs explicit omissions, not fabricated data.");
		const sources = list(slot, "sources", source); ordered(sources.map(value => hash("changekernel.check-source@1.0.0", value)));
		return Object.freeze({name: id(slot, "name"), status, value: data, sources, evidenceDigests: digests(slot, "evidenceDigests"), omissions});
	});
	ordered(slots.map(slot => slot.name));
	return slots;
}
export const RESULT_FIELDS = Object.freeze(["checkId", "inputDigest", "executionDigest", "producerId", "status", "passed", "failureKind", "feedback", "evidenceDigests", "limitations"]);
export function resultFields(r: CanonicalRecord) {
	const status = literalField(CONTRACT, r, "status", ["completed", "operational-error"] as const);
	const passed = r.passed === null ? null : booleanField(CONTRACT, r, "passed");
	const failureKind = r.failureKind === null ? null : literalField(CONTRACT, r, "failureKind", ["contradiction", "insufficient-support"] as const);
	if (status === "completed") {
		if (passed === null || (passed && failureKind !== null) || (!passed && failureKind === null)) fail("A completed Check needs a Boolean result and failure classification exactly when false.");
	} else if (passed !== null || failureKind !== null) fail("Operational errors cannot fabricate semantic results.");
	const feedbackRecord = record(requiredField(CONTRACT, r, "feedback"), ["summary", "where", "reason", "resolution", "preserve"]);
	const feedback = Object.freeze({summary: text(feedbackRecord, "summary"), where: text(feedbackRecord, "where"), reason: text(feedbackRecord, "reason"),
		resolution: feedbackRecord.resolution === null ? null : text(feedbackRecord, "resolution"), preserve: texts(feedbackRecord, "preserve")});
	const evidenceDigests = digests(r, "evidenceDigests");
	if (status === "completed" && evidenceDigests.length === 0) fail("Completed results require Evidence references; a digest is not proof of custody.");
	return {checkId: id(r, "checkId"), inputDigest: digest(r, "inputDigest"), executionDigest: digest(r, "executionDigest"), producerId: id(r, "producerId"), status, passed, failureKind,
		feedback, evidenceDigests, limitations: texts(r, "limitations")};
}
