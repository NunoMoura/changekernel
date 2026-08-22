import { createHash } from "node:crypto";
import {readdir, readFile} from "node:fs/promises";
import {join, relative, resolve} from "node:path";
import {parseOkfDocument} from "./okf-frontmatter.ts";
import {isKnowledgeSubjectId} from "./okf.ts";
import type { TraceRecord } from "../changes/trace/types.ts";

export type KnowledgeAlignmentState =
	| "aligned"
	| "review_needed"
	| "misaligned"
	| "unknown";

export interface KnowledgeSubjectBaselineEntry {
	ref: string;
	digest: string;
}

export interface KnowledgeAlignmentBaseline {
	capturedAt: string;
	subjects: KnowledgeSubjectBaselineEntry[];
}

export interface KnowledgeAlignmentFinding {
	affectedLayer: string;
	sourceRefs: string[];
	rationale: string;
	recommendedNextLoop: "decision" | "planning" | "implementation";
}

export interface KnowledgeAlignmentProjection {
	state: KnowledgeAlignmentState;
	label: "Aligned" | "Review Needed" | "Misaligned" | "Unknown";
	rationale: string;
	subjectIds: string[];
	findings: KnowledgeAlignmentFinding[];
}

export async function captureKnowledgeSubjectAlignmentBaseline(
	repoRoot: string,
	refs: string[],
	capturedAt: string,
): Promise<KnowledgeAlignmentBaseline> {
	const subjects = await readKnowledgeSubjectDigests(repoRoot, refs);
	return {
		capturedAt,
		subjects: [...subjects.entries()].map(([ref, digest]) => ({ ref, digest })),
	};
}

export async function readKnowledgeSubjectDigests(
	repoRoot: string,
	refs: string[],
): Promise<Map<string, string>> {
	const paths = await knowledgeSubjectPaths(repoRoot);
	const entries = await Promise.all(
		unique(refs).map(async (ref) => {
			const path = paths.get(ref);
			if (!path) return undefined;
			try {
				return [ref, digest(await readFile(path))] as const;
			} catch {
				return undefined;
			}
		}),
	);
	return new Map(
		entries.filter(
			(entry): entry is readonly [string, string] => entry !== undefined,
		),
	);
}

export function knowledgeSubjectIdsFromRecords(
	records: TraceRecord[],
): string[] {
	return unique(
		records.flatMap((record) => {
			if (record.type !== "trace_event" || record.loop !== "decision")
				return [];
			const output = objectRecord(record.data?.output);
			const changeRecord = objectRecord(output?.changeRecord);
			const change = objectRecord(changeRecord?.change);
			const knowledge = objectRecord(change?.knowledge);
			const values =
				knowledge?.kind === "effects"
					? objectList(knowledge.effects).map(
							(effect) => objectRecord(effect.target)?.subjectId,
						)
					: objectList(knowledge?.refs).map((ref) => ref.subjectId);
			return values
				.filter((value): value is string => typeof value === "string")
				.filter(isKnowledgeSubjectRef);
		}),
	);
}

export function projectKnowledgeAlignment(input: {
	records: TraceRecord[];
	subjectIds: string[];
	noKnowledgeImpactReason?: string;
	currentDigests?: ReadonlyMap<string, string>;
}): KnowledgeAlignmentProjection {
	const subjectIds = unique(input.subjectIds).filter(isKnowledgeSubjectRef);
	const findings = groundedFindings(input.records);
	if (findings.length > 0) {
		return {
			state: "misaligned",
			label: "Misaligned",
			rationale:
				findings[findings.length - 1]?.rationale ||
				"Grounded contradiction recorded.",
			subjectIds,
			findings,
		};
	}
	if (subjectIds.length === 0 && input.noKnowledgeImpactReason?.trim()) {
		return {
			state: "aligned",
			label: "Aligned",
			rationale: input.noKnowledgeImpactReason.trim(),
			subjectIds,
			findings: [],
		};
	}
	const baseline = latestBaseline(input.records);
	if (!baseline || !input.currentDigests || subjectIds.length === 0) {
		return {
			state: "unknown",
			label: "Unknown",
			rationale:
				"Subject scope or validated baseline is insufficient for an alignment claim.",
			subjectIds,
			findings: [],
		};
	}
	const baselineByRef = new Map(
		baseline.subjects.map((subject) => [subject.ref, subject.digest]),
	);
	if (
		subjectIds.some(
			(ref) => !baselineByRef.has(ref) || !input.currentDigests?.has(ref),
		)
	) {
		return {
			state: "unknown",
			label: "Unknown",
			rationale:
				"At least one declared Knowledge subject lacks baseline or current digest evidence.",
			subjectIds,
			findings: [],
		};
	}
	const changed = subjectIds.filter(
		(ref) => baselineByRef.get(ref) !== input.currentDigests?.get(ref),
	);
	if (changed.length > 0) {
		return {
			state: "review_needed",
			label: "Review Needed",
			rationale: `${changed.length} declared Knowledge subject${changed.length === 1 ? " has" : "s have"} changed since the validated baseline.`,
			subjectIds,
			findings: [],
		};
	}
	return {
		state: "aligned",
		label: "Aligned",
		rationale: "Declared Knowledge subjects match the validated scoped baseline.",
		subjectIds,
		findings: [],
	};
}

function latestBaseline(
	records: TraceRecord[],
): KnowledgeAlignmentBaseline | undefined {
	for (let index = records.length - 1; index >= 0; index -= 1) {
		const record = records[index];
		if (record?.type !== "trace_event" || record.loop !== "decision") continue;
		const output = objectRecord(record.data?.output);
		const value = objectRecord(output?.knowledgeAlignmentBaseline);
		const capturedAt = stringValue(value?.capturedAt);
		const subjects = arrayValue(value?.subjects).flatMap((item) => {
			const topic = objectRecord(item);
			const ref = stringValue(topic?.ref);
			const subjectDigest = stringValue(topic?.digest);
			return isKnowledgeSubjectRef(ref) &&
				/^sha256:[a-f0-9]{64}$/.test(subjectDigest)
				? [{ ref, digest: subjectDigest }]
				: [];
		});
		if (capturedAt && subjects.length > 0) return { capturedAt, subjects };
	}
	return undefined;
}

function groundedFindings(records: TraceRecord[]): KnowledgeAlignmentFinding[] {
	return records.flatMap((record) => {
		if (record.type !== "trace_event") return [];
		const data = objectRecord(record.data) || {};
		const values = [
			...arrayValue(data.knowledgeAlignmentFindings),
			...(data.knowledgeAlignmentFinding
				? [data.knowledgeAlignmentFinding]
				: []),
		];
		return values.flatMap((value) => {
			const finding = objectRecord(value);
			const affectedLayer = stringValue(finding?.affectedLayer);
			const sourceRefs = stringList(finding?.sourceRefs);
			const rationale = stringValue(finding?.rationale);
			const recommendedNextLoop = stringValue(finding?.recommendedNextLoop);
			if (
				!affectedLayer ||
				sourceRefs.length === 0 ||
				!rationale ||
				!["decision", "planning", "implementation"].includes(
					recommendedNextLoop,
				)
			) {
				return [];
			}
			return [
				{
					affectedLayer,
					sourceRefs,
					rationale,
					recommendedNextLoop:
						recommendedNextLoop as KnowledgeAlignmentFinding["recommendedNextLoop"],
				},
			];
		});
	});
}

async function knowledgeSubjectPaths(repoRoot: string): Promise<Map<string, string>> {
	const root = resolve(repoRoot, ".codewiki", "kb");
	const files = await markdownFiles(root);
	const entries = await Promise.all(
		files.map(async (path) => {
			const source = await readFile(path, "utf8");
			const document = parseOkfDocument(relative(root, path), source);
			return document.conceptId ? ([document.conceptId, path] as const) : undefined;
		}),
	);
	return new Map(
		entries.filter(
			(entry): entry is readonly [string, string] => entry !== undefined,
		),
	);
}

async function markdownFiles(directory: string): Promise<string[]> {
	let entries;
	try {
		entries = await readdir(directory, {withFileTypes: true});
	} catch {
		return [];
	}
	const nested = await Promise.all(
		entries.map((entry) => {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) return markdownFiles(path);
			return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
		}),
	);
	return nested.flat();
}

function isKnowledgeSubjectRef(value: string): boolean {
	return isKnowledgeSubjectId(value);
}

function digest(value: Buffer): string {
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function arrayValue(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function objectList(value: unknown): Record<string, unknown>[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		const record = objectRecord(item);
		return record ? [record] : [];
	});
}

function stringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}
