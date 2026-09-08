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
} from "../data-contracts/validation.ts";
import type {CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
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
	for (let leftIndex = 0; leftIndex < work.length; leftIndex += 1) {
		for (let rightIndex = leftIndex + 1; rightIndex < work.length; rightIndex += 1) {
			const left = work[leftIndex] as Work;
			const right = work[rightIndex] as Work;
			if (workScopesConflict(left, right) && !dependsTransitively(left.workId, right.workId, byId) && !dependsTransitively(right.workId, left.workId, byId)) {
				return failure(workPlanIssue(`${left.workId}:${right.workId}`, "Overlapping writable Work scopes require an explicit dependency order."));
			}
		}
	}
	const ordered = [...work].sort((left, right) => left.ordinal - right.ordinal || compareText(left.workId, right.workId));
	return success(Object.freeze(ordered));
}

export function workScopesConflict(left: Work, right: Work): boolean {
	return left.writablePaths.some((leftPath) => right.writablePaths.some((rightPath) => patternsOverlap(leftPath, rightPath)));
}

export function workAllowsPath(work: Work, path: string): boolean {
	return isPortableProjectPath(path) && work.writablePaths.some((pattern) => patternMatchesPath(pattern, path));
}

function dependsTransitively(workId: string, dependencyId: string, byId: ReadonlyMap<string, Work>): boolean {
	const pending = [...(byId.get(workId)?.dependencies ?? [])];
	const visited = new Set<string>();
	while (pending.length > 0) {
		const current = pending.pop() as string;
		if (current === dependencyId) return true;
		if (visited.has(current)) continue;
		visited.add(current);
		pending.push(...(byId.get(current)?.dependencies ?? []));
	}
	return false;
}

type PathPatternToken =
	| Readonly<{kind: "literal"; value: string}>
	| Readonly<{kind: "alternatives"; values: readonly string[]}>
	| Readonly<{kind: "globstar" | "question" | "star"}>;

function patternMatchesPath(pattern: string, path: string): boolean {
	const tokens = tokenizePathPattern(pattern);
	if (tokens === null) return false;
	const memo = new Map<string, boolean>();
	const match = (tokenIndex: number, pathIndex: number): boolean => {
		const key = `${tokenIndex}:${pathIndex}`;
		const known = memo.get(key);
		if (known !== undefined) return known;
		const token = tokens[tokenIndex];
		let matched = token === undefined ? pathIndex === path.length : false;
		if (token?.kind === "literal") matched = path.startsWith(token.value, pathIndex) && match(tokenIndex + 1, pathIndex + token.value.length);
		else if (token?.kind === "question") matched = pathIndex < path.length && path[pathIndex] !== "/" && match(tokenIndex + 1, pathIndex + 1);
		else if (token?.kind === "alternatives") matched = token.values.some((value) => path.startsWith(value, pathIndex) && match(tokenIndex + 1, pathIndex + value.length));
		else if (token?.kind === "star" || token?.kind === "globstar") {
			const maximum = token.kind === "globstar" ? path.length : nextSeparator(path, pathIndex);
			for (let candidate = pathIndex; candidate <= maximum && !matched; candidate += 1) matched = match(tokenIndex + 1, candidate);
		}
		memo.set(key, matched);
		return matched;
	};
	return match(0, 0);
}

function tokenizePathPattern(pattern: string): readonly PathPatternToken[] | null {
	const tokens: PathPatternToken[] = [];
	let literal = "";
	const flushLiteral = (): void => {
		if (literal.length > 0) tokens.push(Object.freeze({kind: "literal", value: literal}));
		literal = "";
	};
	for (let index = 0; index < pattern.length; index += 1) {
		const character = pattern[index] as string;
		if (character === "*" || character === "?" || character === "{") flushLiteral();
		if (character === "*" && pattern[index + 1] === "*") {
			tokens.push(Object.freeze({kind: "globstar"}));
			index += 1;
		} else if (character === "*") tokens.push(Object.freeze({kind: "star"}));
		else if (character === "?") tokens.push(Object.freeze({kind: "question"}));
		else if (character === "{") {
			const close = pattern.indexOf("}", index + 1);
			if (close < 0) return null;
			const values = pattern.slice(index + 1, close).split(",");
			if (values.some((value) => value.length === 0)) return null;
			tokens.push(Object.freeze({kind: "alternatives", values: Object.freeze(values)}));
			index = close;
		} else literal += character;
	}
	flushLiteral();
	return Object.freeze(tokens);
}

function nextSeparator(path: string, start: number): number {
	const separator = path.indexOf("/", start);
	return separator < 0 ? path.length : separator;
}

function isPortableProjectPath(path: string): boolean {
	return typeof path === "string" && path.length > 0 && path.length <= 4_096 && path.normalize("NFC") === path &&
		!path.startsWith("/") && !path.endsWith("/") && !/[\\\0\r\n]/u.test(path) &&
		path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".." && segment !== ".git");
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
