import {
	KNOWLEDGE_FACET_ID_PATTERN,
	isKnowledgeSubjectId,
	normalizeOkfPath,
} from "../../knowledge/okf.ts";
import type { OkfDocument, OkfFrontmatterValue } from "../../knowledge/okf-frontmatter.ts";

export const CODEWIKI_KB_DOCUMENT_TYPES = Object.freeze([
	"Lexicon",
	"User",
	"User Story",
	"Design System",
	"System Component",
	"System Flow",
] as const);

export type CodeWikiKbDocumentType =
	(typeof CODEWIKI_KB_DOCUMENT_TYPES)[number];

export const CODEWIKI_KB_BODY_CHARACTER_LIMITS = Object.freeze({
	Lexicon: 20_000,
	User: 4_000,
	"User Story": 5_000,
	"Design System": 32_000,
	"System Component": 10_000,
	"System Flow": 8_000,
} as const satisfies Record<CodeWikiKbDocumentType, number>);

export interface CodeWikiKbProfileIssue {
	readonly code:
		| "invalid_document_path"
		| "invalid_document_type"
		| "missing_knowledge_id"
		| "invalid_knowledge_id"
		| "duplicate_knowledge_id"
		| "invalid_knowledge_facets"
		| "invalid_knowledge_aliases"
		| "missing_status"
		| "invalid_story_owner"
		| "unexpected_story_owner"
		| "invalid_component_identity"
		| "invalid_relationship_target"
		| "realization_not_component_owned"
		| "frontmatter_too_large"
		| "document_body_too_large"
		| "invalid_lexicon_row"
		| "duplicate_lexicon_term"
		| "invalid_lexicon_definition"
		| "invalid_lexicon_owner";
	readonly path: string;
	readonly message: string;
}

const ROOT_LEXICON_PATH = "lexicon.md";
const DESIGN_PATH = "product/DESIGN.md";
const USER_PATH = /^product\/users\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const STORY_PATH = /^product\/stories\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const COMPONENT_PATH = /^system\/components\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const FLOW_PATH = /^system\/flows\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const REALIZATION_FIELDS = [
	"codewiki_component",
	"codewiki_components",
	"codewiki_source_patterns",
	"codewiki_test_patterns",
	"codewiki_trace_events",
	"codewiki_generated_views",
	"codewiki_role",
	"codewiki_roles",
	"codewiki_test_policy",
	"codewiki_test_rationale",
	"codewiki_source_map",
] as const;

export function validateCodeWikiKbDocument(
	document: OkfDocument,
): CodeWikiKbProfileIssue[] {
	const path = normalizeOkfPath(document.path);
	const frontmatter = document.frontmatter;
	if (!frontmatter) {
		return [
			issue(
				"invalid_document_type",
				path,
				"CodeWiki Knowledge documents require YAML frontmatter with a supported semantic type.",
			),
		];
	}
	const issues: CodeWikiKbProfileIssue[] = [];
	const type = documentType(frontmatter);
	if (!type) {
		return [
			issue(
				"invalid_document_type",
				path,
				"CodeWiki Knowledge documents require a supported semantic type.",
			),
		];
	}
	const knowledgeId = frontmatter.codewiki_id;
	if (knowledgeId === undefined) {
		issues.push(
			issue(
				"missing_knowledge_id",
				path,
				"CodeWiki Knowledge documents require immutable codewiki_id identity.",
			),
		);
	} else if (
		!isKnowledgeSubjectId(knowledgeId) ||
		!knowledgeId.startsWith(`cw:${knowledgeKind(type)}:`)
	) {
		issues.push(
			issue(
				"invalid_knowledge_id",
				path,
				`${type} codewiki_id must use cw:${knowledgeKind(type)}:<stable-key>.`,
			),
		);
	}
	issues.push(...validateKnowledgeFacets(frontmatter.codewiki_facets, document));
	issues.push(...validateKnowledgeAliases(frontmatter.codewiki_aliases, path));
	issues.push(...validateRelationshipTargets(frontmatter.codewiki_relationships, path));
	if (!pathMatchesType(path, type)) {
		issues.push(
			issue(
				"invalid_document_path",
				path,
				`${type} must use its canonical CodeWiki Knowledge path.`,
			),
		);
	}
	if (frontmatter.status !== "draft" && frontmatter.status !== "stable") {
		issues.push(
			issue(
				"missing_status",
				path,
				"CodeWiki Knowledge documents require status: draft or status: stable.",
			),
		);
	}
	const expectedOwner = storyOwnerFromPath(path);
	if (type === "User Story") {
		if (frontmatter.codewiki_user !== `cw:user:${expectedOwner}`) {
			issues.push(
				issue(
					"invalid_story_owner",
					path,
					"User Story codewiki_user must name its owning User concept.",
				),
			);
		}
	} else if (frontmatter.codewiki_user !== undefined) {
		issues.push(
			issue(
				"unexpected_story_owner",
				path,
				"Only User Story documents may declare codewiki_user.",
			),
		);
	}
	if (
		type === "System Component" &&
		frontmatter.codewiki_component !== undefined &&
		frontmatter.codewiki_component !== knowledgeId
	) {
		issues.push(
			issue(
				"invalid_component_identity",
				path,
				"System Component codewiki_component must equal its stable codewiki_id.",
			),
		);
	}
	if (type !== "System Component" && hasRealizationMetadata(frontmatter)) {
		issues.push(
			issue(
				"realization_not_component_owned",
				path,
				"Only System Component documents may declare realization metadata.",
			),
		);
	}
	if (
		type !== "Design System" &&
		(document.frontmatterText?.length ?? 0) > 1_500
	) {
		issues.push(
			issue(
				"frontmatter_too_large",
				path,
				"Knowledge document frontmatter exceeds its 1500 character limit.",
			),
		);
	}
	if (type === "Lexicon") {
		issues.push(...validateLexiconRows(document));
	}
	if (document.body.length > CODEWIKI_KB_BODY_CHARACTER_LIMITS[type]) {
		issues.push(
			issue(
				"document_body_too_large",
				path,
				`${type} body exceeds its ${CODEWIKI_KB_BODY_CHARACTER_LIMITS[type]} character limit.`,
			),
		);
	}
	return issues;
}

export function validateCodeWikiKbBundle(
	documents: readonly OkfDocument[],
): CodeWikiKbProfileIssue[] {
	const issues = documents.flatMap(validateCodeWikiKbDocument);
	const seen = new Map<string, string>();
	for (const document of documents) {
		const id = document.frontmatter?.codewiki_id;
		if (!isKnowledgeSubjectId(id)) continue;
		const previous = seen.get(id);
		if (previous) {
			issues.push(
				issue(
					"duplicate_knowledge_id",
					document.path,
					`codewiki_id ${id} is already owned by ${previous}.`,
				),
			);
		} else {
			seen.set(id, document.path);
		}
	}
	return issues;
}

function knowledgeKind(type: CodeWikiKbDocumentType): string {
	return {
		Lexicon: "lexicon",
		User: "user",
		"User Story": "story",
		"Design System": "design",
		"System Component": "component",
		"System Flow": "flow",
	}[type];
}

function validateKnowledgeAliases(
	value: unknown,
	path: string,
): CodeWikiKbProfileIssue[] {
	if (value === undefined) return [];
	if (
		!Array.isArray(value) ||
		value.length > 32 ||
		value.some(
			(alias) =>
				typeof alias !== "string" ||
				alias.trim() !== alias ||
				alias.length === 0 ||
				alias.length > 128,
		) ||
		new Set(value).size !== value.length
	) {
		return [
			issue(
				"invalid_knowledge_aliases",
				path,
				"codewiki_aliases must be a unique bounded list of presentation aliases.",
			),
		];
	}
	return [];
}

function validateRelationshipTargets(
	value: unknown,
	path: string,
): CodeWikiKbProfileIssue[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		return [
			issue(
				"invalid_relationship_target",
				path,
				"codewiki_relationships must be a list with stable Knowledge targets.",
			),
		];
	}
	return value.flatMap((candidate, index) => {
		const relationship = isPlainRecord(candidate) ? candidate : undefined;
		return relationship && isKnowledgeSubjectId(relationship.target)
			? []
			: [
					issue(
						"invalid_relationship_target",
						path,
						`Relationship ${index} must target one stable Knowledge subject ID.`,
					),
				];
	});
}

function validateKnowledgeFacets(
	value: unknown,
	document: OkfDocument,
): CodeWikiKbProfileIssue[] {
	const path = document.path;
	if (value === undefined) return [];
	if (!isPlainRecord(value)) {
		return [
			issue(
				"invalid_knowledge_facets",
				path,
				"codewiki_facets must be a map from stable facet key to one structural locator.",
			),
		];
	}
	const issues: CodeWikiKbProfileIssue[] = [];
	const locations: {readonly facetId: string; readonly key: string}[] = [];
	for (const [facetId, candidate] of Object.entries(value)) {
		if (!KNOWLEDGE_FACET_ID_PATTERN.test(facetId) || !isPlainRecord(candidate)) {
			issues.push(
				issue(
					"invalid_knowledge_facets",
					path,
					`Facet ${facetId} must use a stable key and one strict locator object.`,
				),
			);
			continue;
		}
		const kind = candidate.kind;
		if (kind === "heading") {
			if (
				Object.keys(candidate).sort(compareText).join(",") !== "kind,path" ||
				!Array.isArray(candidate.path) ||
				candidate.path.length === 0 ||
				!candidate.path.every(
					(part) => typeof part === "string" && part.trim().length > 0,
				)
			) {
				issues.push(
					issue(
						"invalid_knowledge_facets",
						path,
						`Heading facet ${facetId} requires one non-empty heading path.`,
					),
				);
				continue;
			}
			const headingKey = candidate.path.join("\u0000");
			if (!markdownHeadingPaths(document.body).has(headingKey)) {
				issues.push(
					issue(
						"invalid_knowledge_facets",
						path,
						`Heading facet ${facetId} locator does not resolve in current content.`,
					),
				);
				continue;
			}
			locations.push({facetId, key: `heading:${headingKey}`});
			continue;
		}
		if (kind === "frontmatter" || kind === "yaml") {
			if (
				Object.keys(candidate).sort(compareText).join(",") !== "kind,pointer" ||
				typeof candidate.pointer !== "string" ||
				!/^\/(?:[^~/]|~[01])+(?:\/(?:[^~/]|~[01])+)*$/u.test(candidate.pointer)
			) {
				issues.push(
					issue(
						"invalid_knowledge_facets",
						path,
						`${String(kind)} facet ${facetId} requires one canonical JSON pointer.`,
					),
				);
				continue;
			}
			if (
				kind === "yaml" ||
				!jsonPointerResolves(document.frontmatter, candidate.pointer)
			) {
				issues.push(
					issue(
						"invalid_knowledge_facets",
						path,
						`${String(kind)} facet ${facetId} locator does not resolve in current Markdown content.`,
					),
				);
				continue;
			}
			locations.push({facetId, key: `${kind}:${candidate.pointer}`});
			continue;
		}
		issues.push(
			issue(
				"invalid_knowledge_facets",
				path,
				`Facet ${facetId} locator kind must be heading, frontmatter, or yaml.`,
			),
		);
	}
	for (const [index, left] of locations.entries()) {
		for (const right of locations.slice(index + 1)) {
			if (locatorOverlaps(left.key, right.key)) {
				issues.push(
					issue(
						"invalid_knowledge_facets",
						path,
						`Facets ${left.facetId} and ${right.facetId} overlap.`,
					),
				);
			}
		}
	}
	return issues;
}

function markdownHeadingPaths(body: string): ReadonlySet<string> {
	const paths = new Set<string>();
	const stack: string[] = [];
	for (const line of body.split("\n")) {
		const match = /^(#{1,6})\s+(.+?)\s*#*$/u.exec(line);
		if (!match) continue;
		const level = match[1]?.length ?? 0;
		stack.length = level - 1;
		stack[level - 1] = match[2] ?? "";
		paths.add(stack.slice(0, level).join("\u0000"));
	}
	return paths;
}

function jsonPointerResolves(value: unknown, pointer: string): boolean {
	let current = value;
	for (const token of pointer
		.slice(1)
		.split("/")
		.map((part) => part.replace(/~1/gu, "/").replace(/~0/gu, "~"))) {
		if (!isPlainRecord(current) || !Object.hasOwn(current, token)) return false;
		current = Object.getOwnPropertyDescriptor(current, token)?.value;
	}
	return true;
}

function locatorOverlaps(left: string, right: string): boolean {
	if (left === right) return true;
	const separator = left.startsWith("heading:") ? "\u0000" : "/";
	const leftKind = left.slice(0, left.indexOf(":"));
	const rightKind = right.slice(0, right.indexOf(":"));
	if (leftKind !== rightKind) return false;
	return left.startsWith(`${right}${separator}`) || right.startsWith(`${left}${separator}`);
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateLexiconRows(
	document: OkfDocument,
	conceptPaths?: ReadonlySet<string>,
): CodeWikiKbProfileIssue[] {
	const path = normalizeOkfPath(document.path);
	if (path !== ROOT_LEXICON_PATH) return [];
	const issues: CodeWikiKbProfileIssue[] = [];
	const terms = new Set<string>();
	const rows = document.body
		.split(/\r?\n/)
		.filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line))
		.slice(1);
	for (const [index, row] of rows.entries()) {
		const cells = row
			.slice(1, -1)
			.split("|")
			.map((cell) => cell.trim());
		if (cells.length !== 3 || cells.some((cell) => cell.length === 0)) {
			issues.push(issue("invalid_lexicon_row", path, `Lexicon row ${index + 1} requires Term, Definition, and Owner.`));
			continue;
		}
		const [term, definition, owner] = cells as [string, string, string];
		if (terms.has(term)) {
			issues.push(issue("duplicate_lexicon_term", path, `Lexicon term ${term} is duplicated.`));
		}
		terms.add(term);
		if (!/^[^.!?]+[.!?]$/.test(definition)) {
			issues.push(issue("invalid_lexicon_definition", path, `Lexicon term ${term} requires one sentence.`));
		}
		const ownerMatch = /^\[[^\]]+\]\(([^)]+)\)$/.exec(owner);
		const ownerPath = ownerMatch?.[1]
			? `/${normalizeOkfPath(ownerMatch[1])}`
			: undefined;
		if (!ownerPath || (conceptPaths && !conceptPaths.has(ownerPath))) {
			issues.push(issue("invalid_lexicon_owner", path, `Lexicon term ${term} requires one resolvable owning concept.`));
		}
	}
	return issues;
}

function documentType(
	frontmatter: OkfFrontmatterValue,
): CodeWikiKbDocumentType | undefined {
	return CODEWIKI_KB_DOCUMENT_TYPES.includes(
		frontmatter.type as CodeWikiKbDocumentType,
	)
		? (frontmatter.type as CodeWikiKbDocumentType)
		: undefined;
}

function pathMatchesType(path: string, type: CodeWikiKbDocumentType): boolean {
	switch (type) {
		case "Lexicon":
			return path === ROOT_LEXICON_PATH;
		case "Design System":
			return path === DESIGN_PATH;
		case "User":
			return USER_PATH.test(path);
		case "User Story":
			return STORY_PATH.test(path);
		case "System Component":
			return COMPONENT_PATH.test(path);
		case "System Flow":
			return FLOW_PATH.test(path);
		default:
			return false;
	}
}

function storyOwnerFromPath(path: string): string | undefined {
	return STORY_PATH.exec(path)?.[1];
}

function hasRealizationMetadata(frontmatter: OkfFrontmatterValue): boolean {
	return REALIZATION_FIELDS.some((field) => frontmatter[field] !== undefined);
}

function issue(
	code: CodeWikiKbProfileIssue["code"],
	path: string,
	message: string,
): CodeWikiKbProfileIssue {
	return { code, path, message };
}
