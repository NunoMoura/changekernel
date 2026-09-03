import {isCanonicalObject, type CanonicalValue} from "../canonical/json.ts";
import {failure, success, type Outcome} from "../canonical/outcome.ts";
import {partitionWikiAttributes, type WikiAttributeIssue} from "./attributes.ts";

export const COMPONENT_OWNERSHIP_ATTRIBUTE = "codewiki.component:ownership";

export type OwnershipIssueCode =
	| "invalid_component_id"
	| "invalid_ownership"
	| "invalid_path"
	| "invalid_pattern"
	| "invalid_wiki_attributes";

export interface OwnershipIssue {
	readonly code: OwnershipIssueCode;
	readonly path: string;
	readonly message: string;
	readonly cause?: WikiAttributeIssue;
}

export type ComponentSemanticRole =
	| "decision"
	| "model-check"
	| "planning"
	| "review"
	| "worker";

export interface ComponentOwnership {
	readonly componentId: string;
	readonly sourcePatterns: readonly string[];
	readonly testPatterns: readonly string[];
	readonly roles: readonly ComponentSemanticRole[];
	readonly generatedViews: readonly string[];
	readonly testPolicy: "external" | null;
	readonly testRationale: string | null;
}

const OWNERSHIP_FIELDS = Object.freeze([
	"generatedViews",
	"roles",
	"sourcePatterns",
	"testPatterns",
	"testPolicy",
	"testRationale",
] as const);

export function decodeComponentOwnership(
	componentId: string,
	attributes: unknown,
): Outcome<ComponentOwnership | null, OwnershipIssue> {
	if (!isComponentId(componentId)) {
		return failure(ownershipIssue(
			"invalid_component_id",
			"itemId",
			"Component ID must be canonical cw:* identity text.",
		));
	}
	const partitioned = partitionWikiAttributes(attributes);
	if (!partitioned.ok) {
		return failure(ownershipIssue(
			"invalid_wiki_attributes",
			"attributes",
			"Component attributes are invalid.",
			partitioned.error,
		));
	}
	const raw = partitioned.value.semantic[COMPONENT_OWNERSHIP_ATTRIBUTE];
	if (raw === undefined) return success(null);
	if (!isCanonicalObject(raw)) {
		return failure(ownershipIssue(
			"invalid_ownership",
			COMPONENT_OWNERSHIP_ATTRIBUTE,
			"Component ownership must be an object.",
		));
	}
	const keys = Object.keys(raw);
	if (
		!keys.includes("sourcePatterns") ||
		!keys.includes("testPatterns") ||
		keys.some((key) => !(OWNERSHIP_FIELDS as readonly string[]).includes(key))
	) {
		return failure(ownershipIssue(
			"invalid_ownership",
			COMPONENT_OWNERSHIP_ATTRIBUTE,
			"Component ownership contains missing or unknown semantic fields.",
		));
	}
	const sourcePatterns = decodePatterns(raw.sourcePatterns, "sourcePatterns");
	if (!sourcePatterns.ok) return sourcePatterns;
	const testPatterns = decodePatterns(raw.testPatterns, "testPatterns");
	if (!testPatterns.ok) return testPatterns;
	const roles = decodeRoles(raw.roles);
	if (!roles.ok) return roles;
	const generatedViews = decodeGeneratedViews(raw.generatedViews);
	if (!generatedViews.ok) return generatedViews;
	const testPolicy = raw.testPolicy;
	if (testPolicy !== undefined && testPolicy !== "external") {
		return failure(ownershipIssue(
			"invalid_ownership",
			`${COMPONENT_OWNERSHIP_ATTRIBUTE}.testPolicy`,
			"External-only components must use testPolicy external.",
		));
	}
	const testRationale = raw.testRationale;
	if (
		testRationale !== undefined &&
		(typeof testRationale !== "string" || testRationale.length < 1 || testRationale.length > 2_048)
	) {
		return failure(ownershipIssue(
			"invalid_ownership",
			`${COMPONENT_OWNERSHIP_ATTRIBUTE}.testRationale`,
			"External test rationale must be bounded non-empty text.",
		));
	}
	if ((testPolicy === "external") !== (typeof testRationale === "string")) {
		return failure(ownershipIssue(
			"invalid_ownership",
			COMPONENT_OWNERSHIP_ATTRIBUTE,
			"External test policy and rationale must appear together.",
		));
	}
	return success(Object.freeze({
		componentId,
		sourcePatterns: sourcePatterns.value,
		testPatterns: testPatterns.value,
		roles: roles.value,
		generatedViews: generatedViews.value,
		testPolicy: testPolicy === "external" ? testPolicy : null,
		testRationale: typeof testRationale === "string" ? testRationale : null,
	}));
}

export function ownershipMatchesPath(
	ownership: ComponentOwnership,
	kind: "source" | "test",
	path: string,
): Outcome<boolean, OwnershipIssue> {
	if (!isPortablePath(path)) {
		return failure(ownershipIssue("invalid_path", "path", "Path must be canonical and repository-relative."));
	}
	const patterns = kind === "source" ? ownership.sourcePatterns : ownership.testPatterns;
	return success(patterns.some((pattern) => globMatches(pattern, path)));
}

export function ownersForPath(
	ownership: readonly ComponentOwnership[],
	kind: "source" | "test",
	path: string,
): Outcome<readonly string[], OwnershipIssue> {
	if (!isPortablePath(path)) {
		return failure(ownershipIssue("invalid_path", "path", "Path must be canonical and repository-relative."));
	}
	const owners: string[] = [];
	for (const entry of ownership) {
		const patterns = kind === "source" ? entry.sourcePatterns : entry.testPatterns;
		if (patterns.some((pattern) => globMatches(pattern, path))) {
			owners.push(entry.componentId);
		}
	}
	owners.sort(compareText);
	return success(Object.freeze(owners));
}

function decodeRoles(
	input: CanonicalValue | undefined,
): Outcome<readonly ComponentSemanticRole[], OwnershipIssue> {
	if (input === undefined) return success(Object.freeze([]));
	if (!Array.isArray(input) || input.length > 5) {
		return failure(ownershipIssue(
			"invalid_ownership",
			`${COMPONENT_OWNERSHIP_ATTRIBUTE}.roles`,
			"Semantic roles must be a bounded array.",
		));
	}
	const allowed = new Set<ComponentSemanticRole>([
		"decision",
		"model-check",
		"planning",
		"review",
		"worker",
	]);
	const roles: ComponentSemanticRole[] = [];
	for (const value of input) {
		if (typeof value !== "string" || !allowed.has(value as ComponentSemanticRole)) {
			return failure(ownershipIssue(
				"invalid_ownership",
				`${COMPONENT_OWNERSHIP_ATTRIBUTE}.roles`,
				"Semantic role is not Product-defined.",
			));
		}
		roles.push(value as ComponentSemanticRole);
	}
	roles.sort(compareText);
	if (new Set(roles).size !== roles.length) {
		return failure(ownershipIssue(
			"invalid_ownership",
			`${COMPONENT_OWNERSHIP_ATTRIBUTE}.roles`,
			"Semantic roles must be unique.",
		));
	}
	return success(Object.freeze(roles));
}

function decodeGeneratedViews(
	input: CanonicalValue | undefined,
): Outcome<readonly string[], OwnershipIssue> {
	if (input === undefined) return success(Object.freeze([]));
	if (!Array.isArray(input) || input.length > 64) {
		return failure(ownershipIssue(
			"invalid_ownership",
			`${COMPONENT_OWNERSHIP_ATTRIBUTE}.generatedViews`,
			"Generated Views must be a bounded array.",
		));
	}
	const views: string[] = [];
	for (const value of input) {
		if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,127}$/.test(value)) {
			return failure(ownershipIssue(
				"invalid_ownership",
				`${COMPONENT_OWNERSHIP_ATTRIBUTE}.generatedViews`,
				"Generated View identity is not canonical.",
			));
		}
		views.push(value);
	}
	views.sort(compareText);
	if (new Set(views).size !== views.length) {
		return failure(ownershipIssue(
			"invalid_ownership",
			`${COMPONENT_OWNERSHIP_ATTRIBUTE}.generatedViews`,
			"Generated View identities must be unique.",
		));
	}
	return success(Object.freeze(views));
}

function decodePatterns(
	input: CanonicalValue | undefined,
	field: "sourcePatterns" | "testPatterns",
): Outcome<readonly string[], OwnershipIssue> {
	if (!Array.isArray(input) || input.length > 256) {
		return failure(ownershipIssue(
			"invalid_ownership",
			`${COMPONENT_OWNERSHIP_ATTRIBUTE}.${field}`,
			`${field} must be an array of at most 256 patterns.`,
		));
	}
	const patterns: string[] = [];
	for (let index = 0; index < input.length; index += 1) {
		const value = input[index];
		if (typeof value !== "string" || !isOwnershipPattern(value)) {
			return failure(ownershipIssue(
				"invalid_pattern",
				`${COMPONENT_OWNERSHIP_ATTRIBUTE}.${field}[${index}]`,
				"Ownership pattern must be bounded canonical repository-relative glob text.",
			));
		}
		patterns.push(value);
	}
	patterns.sort(compareText);
	for (let index = 1; index < patterns.length; index += 1) {
		if (patterns[index] === patterns[index - 1]) {
			return failure(ownershipIssue(
				"invalid_pattern",
				`${COMPONENT_OWNERSHIP_ATTRIBUTE}.${field}`,
				"Ownership patterns must be unique.",
			));
		}
	}
	return success(Object.freeze(patterns));
}

function isOwnershipPattern(value: string): boolean {
	if (
		value.length < 1 ||
		value.length > 512 ||
		value.normalize("NFC") !== value ||
		value.startsWith("/") ||
		value.endsWith("/") ||
		value.includes("\\") ||
		value.includes("\0")
	) return false;
	const segments = value.split("/");
	return segments.every((segment) =>
		segment.length > 0 &&
		segment !== "." &&
		segment !== ".." &&
		(!segment.includes("**") || segment === "**") &&
		/^[A-Za-z0-9._*?@-]+$/.test(segment),
	);
}

function isPortablePath(value: string): boolean {
	return isOwnershipPattern(value) && !value.includes("*") && !value.includes("?");
}

function globMatches(pattern: string, path: string): boolean {
	const patternSegments = pattern.split("/");
	const pathSegments = path.split("/");
	const memo = new Map<string, boolean>();
	const match = (patternIndex: number, pathIndex: number): boolean => {
		const key = `${patternIndex}:${pathIndex}`;
		const known = memo.get(key);
		if (known !== undefined) return known;
		let result: boolean;
		if (patternIndex === patternSegments.length) result = pathIndex === pathSegments.length;
		else if (patternSegments[patternIndex] === "**") {
			result = match(patternIndex + 1, pathIndex) ||
				(pathIndex < pathSegments.length && match(patternIndex, pathIndex + 1));
		} else {
			result = pathIndex < pathSegments.length &&
				segmentMatches(patternSegments[patternIndex] ?? "", pathSegments[pathIndex] ?? "") &&
				match(patternIndex + 1, pathIndex + 1);
		}
		memo.set(key, result);
		return result;
	};
	return match(0, 0);
}

function segmentMatches(pattern: string, value: string): boolean {
	const rows = pattern.length + 1;
	const columns = value.length + 1;
	const table = Array.from({length: rows}, () => Array<boolean>(columns).fill(false));
	const first = table[0];
	if (!first) return false;
	first[0] = true;
	for (let patternIndex = 1; patternIndex < rows; patternIndex += 1) {
		const row = table[patternIndex];
		const previous = table[patternIndex - 1];
		if (!row || !previous) continue;
		const token = pattern[patternIndex - 1];
		if (token === "*") row[0] = previous[0] ?? false;
		for (let valueIndex = 1; valueIndex < columns; valueIndex += 1) {
			if (token === "*") {
				row[valueIndex] = (previous[valueIndex] ?? false) || (row[valueIndex - 1] ?? false);
			} else if (token === "?" || token === value[valueIndex - 1]) {
				row[valueIndex] = previous[valueIndex - 1] ?? false;
			}
		}
	}
	return table[pattern.length]?.[value.length] ?? false;
}

function isComponentId(value: string): boolean {
	return value.length <= 256 && value.normalize("NFC") === value && /^cw:[a-z0-9][a-z0-9:._-]*$/.test(value);
}

function ownershipIssue(
	code: OwnershipIssueCode,
	path: string,
	message: string,
	cause?: WikiAttributeIssue,
): OwnershipIssue {
	return cause === undefined
		? Object.freeze({code, path, message})
		: Object.freeze({code, path, message, cause});
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
