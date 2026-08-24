import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOkfDocument } from "../../src/knowledge/okf-frontmatter.ts";
import {
	CODEWIKI_KB_BODY_CHARACTER_LIMITS,
	validateCodeWikiKbBundle,
	validateCodeWikiKbDocument,
} from "../../src/domains/software-development/codewiki-kb-profile.ts";

function document(path, frontmatter, body = "# Concept\n") {
	return parseOkfDocument(
		path,
		`---\n${frontmatter}\n---\n${body}`,
	);
}

describe("CodeWiki native Knowledge profile", () => {
	it("accepts canonical desired-state document locations", () => {
		const documents = [
			document("lexicon.md", "type: Lexicon\ncodewiki_id: cw:lexicon:project\nstatus: stable"),
			document("product/DESIGN.md", "type: Design System\ncodewiki_id: cw:design:product\nstatus: stable"),
			document("product/users/maintainer.md", "type: User\ncodewiki_id: cw:user:maintainer\nstatus: stable"),
			document(
				"product/stories/maintainer/authorize-release.md",
				'type: User Story\ncodewiki_id: cw:story:maintainer.authorize-release\nstatus: stable\ncodewiki_user: cw:user:maintainer',
			),
			document(
				"system/components/runtime.md",
				"type: System Component\ncodewiki_id: cw:component:runtime\nstatus: stable\ncodewiki_source_patterns: [src/project-server/**]",
			),
			document("system/flows/change-lifecycle.md", "type: System Flow\ncodewiki_id: cw:flow:change-lifecycle\nstatus: stable"),
		];

		for (const entry of documents) {
			assert.deepEqual(validateCodeWikiKbDocument(entry), []);
		}
	});

	it("rejects legacy paths, generic types, and missing lifecycle", () => {
		const issues = validateCodeWikiKbDocument(
			document("product/stories/intent.md", "type: Concept"),
		);

		assert.deepEqual(
			issues.map((entry) => entry.code),
			["invalid_document_type"],
		);
	});

	it("requires a Story path and owner to agree", () => {
		const issues = validateCodeWikiKbDocument(
			document(
				"product/stories/maintainer/authorize-release.md",
				'type: User Story\ncodewiki_id: cw:story:maintainer.authorize-release\nstatus: stable\ncodewiki_user: cw:user:agent',
			),
		);

		assert.equal(issues[0].code, "invalid_story_owner");
	});

	it("keeps realization metadata on System Components only", () => {
		const issues = validateCodeWikiKbDocument(
			document(
				"system/flows/change-lifecycle.md",
				"type: System Flow\ncodewiki_id: cw:flow:change-lifecycle\nstatus: stable\ncodewiki_source_patterns: [src/project-server/**]",
			),
		);

		assert.equal(issues[0].code, "realization_not_component_owned");
	});

	it("validates stable non-overlapping facet locators and bundle identity uniqueness", () => {
		const valid = document(
			"system/components/runtime.md",
			"type: System Component\ncodewiki_id: cw:component:runtime\nstatus: stable\npolicy: strict\ncodewiki_facets:\n  contract: {kind: heading, path: [Runtime, Contract]}\n  policy: {kind: frontmatter, pointer: /policy}",
			"# Runtime\n\n## Contract\n",
		);
		assert.deepEqual(validateCodeWikiKbDocument(valid), []);
		const overlapping = document(
			"system/components/runtime.md",
			"type: System Component\ncodewiki_id: cw:component:runtime\nstatus: stable\ncodewiki_facets:\n  contract: {kind: heading, path: [Runtime, Contract]}\n  nested: {kind: heading, path: [Runtime, Contract, Rules]}",
			"# Runtime\n\n## Contract\n\n### Rules\n",
		);
		assert.equal(
			validateCodeWikiKbDocument(overlapping).some(
				(issue) => issue.code === "invalid_knowledge_facets",
			),
			true,
		);
		const duplicate = document(
			"system/components/checks.md",
			"type: System Component\ncodewiki_id: cw:component:runtime\nstatus: stable",
		);
		assert.equal(
			validateCodeWikiKbBundle([valid, duplicate]).some(
				(issue) => issue.code === "duplicate_knowledge_id",
			),
			true,
		);
	});

	it("enforces deterministic per-type body limits", () => {
		const issues = validateCodeWikiKbDocument(
			document(
				"product/users/maintainer.md",
				"type: User\ncodewiki_id: cw:user:maintainer\nstatus: stable",
				"x".repeat(CODEWIKI_KB_BODY_CHARACTER_LIMITS.User + 1),
			),
		);

		assert.equal(issues[0].code, "document_body_too_large");
	});
});
