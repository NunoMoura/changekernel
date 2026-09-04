import {
	arrayField,
	assertDigestMatch,
	decodeContract,
	exactRecord,
	integerField,
	isNamespacedIdentifier,
	protocolField,
	protocolIdentity,
	rejectContract,
	requiredField,
	sortedUniqueTextArray,
	textField,
	type ContractIssue,
} from "../canonical/contract.ts";
import type {CanonicalValue} from "../canonical/json.ts";
import {failure, success, type Outcome} from "../canonical/outcome.ts";
import {semanticDigest, semanticId, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";

export const WORK_PROTOCOL = protocolIdentity("codewiki.work", "1.0.0");

export interface WorkTarget {
	readonly itemId: string;
	readonly facets: readonly string[];
}

export interface WorkBody {
	readonly protocol: typeof WORK_PROTOCOL;
	readonly workId: string;
	readonly changeId: string;
	readonly ordinal: number;
	readonly workType: string;
	readonly targets: readonly WorkTarget[];
	readonly writablePaths: readonly string[];
	readonly dependencies: readonly string[];
	readonly capabilities: readonly string[];
	readonly acceptance: readonly string[];
}

export interface Work extends WorkBody {
	readonly workDigest: Sha256Digest;
}

export type WorkIssue = ContractIssue | SemanticIdentityIssue | Readonly<{
	code: "invalid_work_plan";
	path: string;
	message: string;
}>;

export function workIdentity(changeId: string, ordinal: number): Outcome<string, SemanticIdentityIssue> {
	return semanticId("cw:work", protocolLabel(WORK_PROTOCOL), {changeId, ordinal});
}

export function workPlanDigest(work: readonly Work[]): Outcome<Sha256Digest, WorkIssue> {
	const plan = validateWorkPlan(work[0]?.changeId ?? "", work);
	if (!plan.ok) return plan;
	return semanticDigest(protocolLabel(WORK_PROTOCOL), {kind: "plan", work: plan.value});
}

export function createWork(
	body: Omit<WorkBody, "protocol" | "workId">,
): Outcome<Work, WorkIssue> {
	const identity = workIdentity(body.changeId, body.ordinal);
	if (!identity.ok) return failure(identity.error);
	const value = {...body, protocol: WORK_PROTOCOL, workId: identity.value};
	const digest = semanticDigest(protocolLabel(WORK_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodeWork({...value, workDigest: digest.value});
}

export function decodeWork(input: unknown): Outcome<Work, ContractIssue> {
	return decodeContract("Work", input, (value) => decodeWorkValue(value));
}

export function decodeWorkValue(value: CanonicalValue, path = "$"): Work {
	const record = exactRecord("Work", value, path, [
		"acceptance",
		"capabilities",
		"changeId",
		"dependencies",
		"ordinal",
		"protocol",
		"targets",
		"workDigest",
		"workId",
		"workType",
		"writablePaths",
	]);
	protocolField("Work", record, path, WORK_PROTOCOL);
	const changeId = textField("Work", record, "changeId", path, {
		maximumBytes: 200,
		pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u,
	});
	const ordinal = integerField("Work", record, "ordinal", path, 1, 1_024);
	const workId = namespacedField(record, "workId", path);
	const expectedId = workIdentity(changeId, ordinal);
	if (!expectedId.ok || expectedId.value !== workId) rejectContract("invalid_field", "Work", `${path}.workId`, "Work identity does not match Change and ordinal.");
	const targets = decodeTargets(arrayField("Work", record, "targets", path, 1_024), path);
	if (targets.length === 0) rejectContract("missing_field", "Work", `${path}.targets`, "Work requires at least one stable target.");
	const writablePaths = sortedUniqueTextArray("Work", requiredField("Work", record, "writablePaths", path), `${path}.writablePaths`, {
		maximumEntries: 1_024,
		maximumBytes: 512,
	});
	for (let index = 0; index < writablePaths.length; index += 1) {
		if (!isWritableProjectPattern(writablePaths[index] ?? "")) {
			rejectContract("invalid_field", "Work", `${path}.writablePaths[${index}]`, "Writable scope must be a canonical project-artifact path pattern.");
		}
	}
	const capabilities = sortedUniqueTextArray("Work", requiredField("Work", record, "capabilities", path), `${path}.capabilities`, {
		maximumEntries: 128,
		maximumBytes: 256,
	});
	if (capabilities.some((value) => !isNamespacedIdentifier(value))) {
		rejectContract("invalid_field", "Work", `${path}.capabilities`, "Capabilities must use canonical namespaced identities.");
	}
	const dependencies = sortedUniqueTextArray("Work", requiredField("Work", record, "dependencies", path), `${path}.dependencies`, {
		maximumEntries: 1_023,
		maximumBytes: 256,
	});
	if (dependencies.some((value) => !isNamespacedIdentifier(value))) {
		rejectContract("invalid_field", "Work", `${path}.dependencies`, "Dependencies must use canonical Work identities.");
	}
	const acceptance = sortedUniqueTextArray("Work", requiredField("Work", record, "acceptance", path), `${path}.acceptance`, {
		maximumEntries: 256,
		maximumBytes: 4_096,
	});
	if (acceptance.length === 0) rejectContract("missing_field", "Work", `${path}.acceptance`, "Work requires judgeable acceptance statements.");
	const workType = namespacedField(record, "workType", path);
	const workDigest = digestField(record, "workDigest", path);
	const result = Object.freeze({
		protocol: WORK_PROTOCOL,
		workId,
		changeId,
		ordinal,
		workType,
		targets,
		writablePaths,
		dependencies,
		capabilities,
		acceptance,
		workDigest,
	});
	const {workDigest: _workDigest, ...body} = result;
	const expectedDigest = semanticDigest(protocolLabel(WORK_PROTOCOL), body);
	if (!expectedDigest.ok) rejectContract("invalid_field", "Work", `${path}.workDigest`, expectedDigest.error.message);
	assertDigestMatch("Work", `${path}.workDigest`, workDigest, expectedDigest.value);
	return result;
}

export function validateWorkPlan(changeId: string, work: readonly Work[]): Outcome<readonly Work[], WorkIssue> {
	if (!/^CHG-[A-Za-z0-9][A-Za-z0-9._-]{0,195}$/u.test(changeId) || work.length > 1_024) {
		return failure(workPlanIssue("$", "Work plan identity or size is invalid."));
	}
	const byId = new Map<string, Work>();
	const ordinals = new Set<number>();
	for (let index = 0; index < work.length; index += 1) {
		const entry = work[index];
		if (!entry || entry.changeId !== changeId || byId.has(entry.workId) || ordinals.has(entry.ordinal)) {
			return failure(workPlanIssue(`$[${index}]`, "Work plan has foreign, duplicate, or missing identity."));
		}
		byId.set(entry.workId, entry);
		ordinals.add(entry.ordinal);
	}
	for (const entry of work) {
		for (const dependency of entry.dependencies) {
			if (dependency === entry.workId || !byId.has(dependency)) {
				return failure(workPlanIssue(entry.workId, "Work dependency is self-referential or absent from this Change."));
			}
		}
	}
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const visit = (workId: string): boolean => {
		if (visiting.has(workId)) return false;
		if (visited.has(workId)) return true;
		visiting.add(workId);
		const entry = byId.get(workId);
		if (!entry || entry.dependencies.some((dependency) => !visit(dependency))) return false;
		visiting.delete(workId);
		visited.add(workId);
		return true;
	};
	for (const workId of byId.keys()) {
		if (!visit(workId)) return failure(workPlanIssue(workId, "Work dependencies must form an acyclic graph."));
	}
	const ordered = [...work].sort((left, right) => left.ordinal - right.ordinal || compareText(left.workId, right.workId));
	return success(Object.freeze(ordered));
}

export function workScopesConflict(left: Work, right: Work): boolean {
	return left.writablePaths.some((leftPath) => right.writablePaths.some((rightPath) => patternsOverlap(leftPath, rightPath)));
}

function decodeTargets(input: readonly CanonicalValue[], parentPath: string): readonly WorkTarget[] {
	const output = input.map((value, index) => {
		const path = `${parentPath}.targets[${index}]`;
		const record = exactRecord("Work", value, path, ["facets", "itemId"]);
		const itemId = namespacedField(record, "itemId", path);
		const facets = sortedUniqueTextArray("Work", requiredField("Work", record, "facets", path), `${path}.facets`, {
			maximumEntries: 128,
			maximumBytes: 256,
			pattern: /^[A-Za-z][A-Za-z0-9._:@/-]*$/u,
		});
		if (facets.length === 0) rejectContract("missing_field", "Work", `${path}.facets`, "Work target requires at least one facet.");
		return Object.freeze({itemId, facets});
	});
	output.sort((left, right) => compareText(left.itemId, right.itemId));
	for (let index = 1; index < output.length; index += 1) {
		if (output[index - 1]?.itemId === output[index]?.itemId) rejectContract("invalid_field", "Work", `${parentPath}.targets`, "Work targets must be unique.");
	}
	return Object.freeze(output);
}

function namespacedField(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): string {
	const value = textField("Work", record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", "Work", `${path}.${field}`, "Identity must be canonical namespaced text.");
	return value;
}

function digestField(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", "Work", `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function isWritableProjectPattern(value: string): boolean {
	if (
		value.length === 0 ||
		value.length > 512 ||
		value.normalize("NFC") !== value ||
		value.startsWith("/") ||
		value.includes("\\") ||
		value.includes("\0") ||
		!/^[-A-Za-z0-9._@/*?{}]+$/u.test(value)
	) return false;
	const segments = value.split("/");
	const first = segments[0] ?? "";
	if (first.includes("*") || first.includes("?") || first === ".codewiki" || first === ".git" || first === "check-packs") return false;
	return segments.every((segment) => segment !== "." && segment !== ".." && segment.length > 0);
}

function patternsOverlap(left: string, right: string): boolean {
	const leftPrefix = left.split("*", 1)[0] ?? left;
	const rightPrefix = right.split("*", 1)[0] ?? right;
	return leftPrefix.startsWith(rightPrefix) || rightPrefix.startsWith(leftPrefix);
}

function workPlanIssue(path: string, message: string): Extract<WorkIssue, {code: "invalid_work_plan"}> {
	return Object.freeze({code: "invalid_work_plan", path, message});
}

function protocolLabel(protocol: typeof WORK_PROTOCOL): string {
	return `${protocol.id}@${protocol.version}`;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
