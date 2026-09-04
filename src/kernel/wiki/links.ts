import {isNamespacedIdentifier} from "../canonical/contract.ts";
import {failure, success, type Outcome} from "../canonical/outcome.ts";

export const WIKI_INLINE_LINK_PREFIX = "codewiki://item/";
export const WIKI_INLINE_LINK_PREDICATE = "codewiki.wiki:inline-link";
export const MAXIMUM_WIKI_INLINE_LINKS = 4_096;

export interface WikiInlineLinkIssue {
	readonly code: "invalid_inline_link" | "limit_exceeded";
	readonly path: string;
	readonly message: string;
}

export function decodeWikiInlineLinks(body: string): Outcome<readonly string[], WikiInlineLinkIssue> {
	if (typeof body !== "string") {
		return failure(linkIssue("invalid_inline_link", "$", "Wiki Item body must be text."));
	}
	const targets: string[] = [];
	let fence: Readonly<{character: "`" | "~"; length: number}> | null = null;
	const lines = body.split("\n");
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex] as string;
		const marker = fenceMarker(line);
		if (fence !== null) {
			if (isFenceClose(line, fence)) fence = null;
			continue;
		}
		if (marker !== null) {
			fence = marker;
			continue;
		}
		const scanned = scanInlineLine(line, lineIndex + 1, targets);
		if (!scanned.ok) return scanned;
		if (targets.length > MAXIMUM_WIKI_INLINE_LINKS) {
			return failure(linkIssue("limit_exceeded", "$", `Wiki Item exceeds ${MAXIMUM_WIKI_INLINE_LINKS} inline links.`));
		}
	}
	return success(Object.freeze([...new Set(targets)].sort(compareText)));
}

function scanInlineLine(
	line: string,
	lineNumber: number,
	targets: string[],
): Outcome<null, WikiInlineLinkIssue> {
	for (let offset = 0; offset < line.length;) {
		if (line[offset] === "\\") {
			offset += 2;
			continue;
		}
		if (line[offset] === "`") {
			const length = runLength(line, offset, "`");
			const end = line.indexOf("`".repeat(length), offset + length);
			offset = end < 0 ? line.length : end + length;
			continue;
		}
		const marker = `](${WIKI_INLINE_LINK_PREFIX}`;
		if (!line.startsWith(marker, offset)) {
			offset += 1;
			continue;
		}
		if (!hasUnescapedOpeningBracket(line, offset)) {
			offset += marker.length;
			continue;
		}
		const targetStart = offset + marker.length;
		const targetEnd = line.indexOf(")", targetStart);
		if (targetEnd < 0) return failure(linkIssue("invalid_inline_link", `$.body:${lineNumber}`, "Inline Wiki link is not terminated."));
		const encoded = line.slice(targetStart, targetEnd);
		const target = decodeTarget(encoded, lineNumber);
		if (!target.ok) return target;
		targets.push(target.value);
		offset = targetEnd + 1;
	}
	return success(null);
}

function decodeTarget(encoded: string, lineNumber: number): Outcome<string, WikiInlineLinkIssue> {
	let decoded: string;
	try {
		decoded = decodeURIComponent(encoded);
	} catch {
		return failure(linkIssue("invalid_inline_link", `$.body:${lineNumber}`, "Inline Wiki link has invalid percent encoding."));
	}
	if (!isNamespacedIdentifier(decoded) || encodeURIComponent(decoded) !== encoded) {
		return failure(linkIssue(
			"invalid_inline_link",
			`$.body:${lineNumber}`,
			"Inline Wiki link target must be one canonically percent-encoded stable Item ID.",
		));
	}
	return success(decoded);
}

function fenceMarker(line: string): Readonly<{character: "`" | "~"; length: number}> | null {
	const match = /^(?: {0,3})(`{3,}|~{3,})/u.exec(line);
	if (!match) return null;
	const marker = match[1] as string;
	return Object.freeze({character: marker[0] as "`" | "~", length: marker.length});
}

function isFenceClose(line: string, fence: Readonly<{character: "`" | "~"; length: number}>): boolean {
	const match = /^(?: {0,3})(`{3,}|~{3,})[ \t]*$/u.exec(line);
	return match !== null && (match[1] as string)[0] === fence.character && (match[1] as string).length >= fence.length;
}

function hasUnescapedOpeningBracket(line: string, closeOffset: number): boolean {
	for (let index = closeOffset - 1; index >= 0; index -= 1) {
		if (line[index] === "]") return false;
		if (line[index] !== "[") continue;
		let slashes = 0;
		for (let before = index - 1; before >= 0 && line[before] === "\\"; before -= 1) slashes += 1;
		return slashes % 2 === 0;
	}
	return false;
}

function runLength(input: string, offset: number, character: string): number {
	let length = 0;
	while (input[offset + length] === character) length += 1;
	return length;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function linkIssue(code: WikiInlineLinkIssue["code"], path: string, message: string): WikiInlineLinkIssue {
	return Object.freeze({code, path, message});
}
