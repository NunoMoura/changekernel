import {decodeProfiledWikiFile} from "../../adapters/git/wiki-profile.ts";
import type {ProjectSourceSelector} from "../../api/contracts/read.ts";
import type {ProjectSnapshot} from "../../kernel/changes/snapshot.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {
	bindWikiTypes,
	wikiIssue,
	WIKI_PROFILE_ID,
	WIKI_PROFILE_LIMITS,
	type ProfiledWikiFile,
	type WikiIssue,
	type WikiTypeContext,
} from "../../kernel/wiki/profile.ts";
import type {MarkdownCorpus, MarkdownCorpusLimits} from "../../kernel/wiki/corpus.ts";
import type {ProjectStorePort} from "../../ports/project-store.ts";
import {
	loadMarkdownMaterialSource,
	type LoadedMarkdownMaterialSource,
	type MarkdownMaterialSourceIssue,
} from "./material-source.ts";
import type {ProjectReadConfiguration} from "./source.ts";

export interface LoadedProfiledWikiSource {
	readonly snapshot: ProjectSnapshot;
	readonly corpus: MarkdownCorpus;
	readonly managedFiles: readonly ProfiledWikiFile[];
	readonly typeContext: WikiTypeContext;
}

export type ProfiledWikiSourceBudget = "files" | "file_bytes" | "context_bytes";

export type ProfiledWikiSourceCause =
	| Readonly<{kind: "material"; material: MarkdownMaterialSourceIssue}>
	| Readonly<{kind: "profile"; profile: WikiIssue}>
	| Readonly<{kind: "budget"; budget: ProfiledWikiSourceBudget}>
	| Readonly<{kind: "binding"; binding: WikiIssue}>;

export interface ProfiledWikiSourceIssue {
	readonly code: MarkdownMaterialSourceIssue["code"] | WikiIssue["code"];
	readonly operation: "admit_profile" | "admit_limits" | "resolve_source" | "read_profile";
	readonly message: string;
	readonly cause: ProfiledWikiSourceCause;
}

const UTF8 = new TextEncoder();

/**
 * Loads one exact passive source, then admits its explicitly selected Wiki
 * profile. This is a private interpretation seam: it does not read or write
 * lifecycle state, infer Item continuity, or construct legacy Item IDs.
 */
export async function loadProfiledWikiSource(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	source: ProjectSourceSelector,
	profile: unknown,
	limits: MarkdownCorpusLimits,
): Promise<Outcome<LoadedProfiledWikiSource, ProfiledWikiSourceIssue>> {
	if (profile !== WIKI_PROFILE_ID) {
		const unsupported = wikiIssue("unsupported_profile", "$", "An explicit supported profile is required.");
		return failure(profileIssue(unsupported, "admit_profile"));
	}

	const material = await loadMarkdownMaterialSource(store, configuration, source, limits);
	if (!material.ok) return failure(materialIssue(material.error));

	const pending = admittedManagedInputs(material.value);
	if (!pending.ok) return pending;

	const managedFiles: ProfiledWikiFile[] = [];
	for (const input of pending.value) {
		const decoded = decodeProfiledWikiFile(profile, input);
		if (!decoded.ok) return failure(profileIssue(decoded.error, "read_profile"));
		managedFiles.push(decoded.value);
	}

	const typeContext = bindWikiTypes(material.value.snapshot.commit, managedFiles);
	if (!typeContext.ok) return failure(bindingIssue(typeContext.error));

	return success(Object.freeze({
		snapshot: material.value.snapshot,
		corpus: material.value.corpus,
		managedFiles: Object.freeze(managedFiles),
		typeContext: typeContext.value,
	}));
}

interface ProfiledWikiFileInput {
	readonly path: string;
	readonly mode: "100644" | "100755";
	readonly blob: ProfiledWikiFile["blob"];
	readonly bytes: Uint8Array;
}

function admittedManagedInputs(
	material: LoadedMarkdownMaterialSource,
): Outcome<readonly ProfiledWikiFileInput[], ProfiledWikiSourceIssue> {
	const managedDocuments = material.corpus.documents.filter((document) => document.path.startsWith(".codewiki/wiki/"));
	if (managedDocuments.length > WIKI_PROFILE_LIMITS.files) {
		return failure(budgetIssue("files", `Managed Wiki file count exceeds ${WIKI_PROFILE_LIMITS.files}.`));
	}

	const pending: ProfiledWikiFileInput[] = [];
	let contextBytes = 0;
	for (const document of managedDocuments) {
		// Count actual UTF-8 before allocating an encoded copy; supplied lengths
		// cannot grant either a larger file or aggregate encoding budget.
		const measured = managedByteLength(document.text, WIKI_PROFILE_LIMITS.contextBytes - contextBytes);
		if (typeof measured !== "number") {
			return failure(budgetIssue(measured, `Managed Wiki file ${document.path} exceeds the ${measured} budget.`));
		}
		// Lossless corpus text round-trips exactly, without Unicode normalization.
		const bytes = UTF8.encode(document.text);
		if (bytes.byteLength !== document.byteLength) {
			const mismatch = wikiIssue("invalid_file", document.path, "Material text and its supplied byte length disagree.");
			return failure(bindingIssue(mismatch));
		}
		contextBytes += measured;
		pending.push(Object.freeze({
			path: document.path,
			mode: document.mode,
			blob: document.oid,
			bytes,
		}));
	}
	return success(Object.freeze(pending));
}

/** Corpus text is already lossless UTF-8; stop counting at the first exceeded budget. */
function managedByteLength(text: string, remaining: number): number | "file_bytes" | "context_bytes" {
	if (text.length > WIKI_PROFILE_LIMITS.fileBytes) return "file_bytes";
	if (text.length > remaining) return "context_bytes";
	let bytes = 0;
	for (const character of text) {
		const unit = character.charCodeAt(0);
		if (character.length === 2) bytes += 4;
		else if (unit <= 0x7f) bytes += 1;
		else if (unit <= 0x7ff) bytes += 2;
		else bytes += 3;
		if (bytes > WIKI_PROFILE_LIMITS.fileBytes) return "file_bytes";
		if (bytes > remaining) return "context_bytes";
	}
	return bytes;
}

function materialIssue(value: MarkdownMaterialSourceIssue): ProfiledWikiSourceIssue {
	return Object.freeze({
		code: value.code,
		operation: materialOperation(value),
		message: value.message,
		cause: Object.freeze({kind: "material", material: value}),
	});
}

function materialOperation(value: MarkdownMaterialSourceIssue): ProfiledWikiSourceIssue["operation"] {
	if (value.operation === "resolve_source") return "resolve_source";
	if (value.operation === "admit_limits") return "admit_limits";
	return "read_profile";
}

function profileIssue(value: WikiIssue, operation: ProfiledWikiSourceIssue["operation"]): ProfiledWikiSourceIssue {
	return Object.freeze({
		code: value.code,
		operation,
		message: value.message,
		cause: Object.freeze({kind: "profile", profile: value}),
	});
}

function budgetIssue(budget: ProfiledWikiSourceBudget, message: string): ProfiledWikiSourceIssue {
	return Object.freeze({
		code: "limit_exceeded",
		operation: "read_profile",
		message,
		cause: Object.freeze({kind: "budget", budget}),
	});
}

function bindingIssue(value: WikiIssue): ProfiledWikiSourceIssue {
	return Object.freeze({
		code: value.code,
		operation: "read_profile",
		message: value.message,
		cause: Object.freeze({kind: "binding", binding: value}),
	});
}
