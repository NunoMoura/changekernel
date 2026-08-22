import {performance} from "node:perf_hooks";
import {canonicalJson, canonicalJsonDigest, type Sha256Digest} from "../src/utils/canonical-json.ts";

export const PROJECT_CONTEXT_ACCESS_BENCHMARK_PROTOCOL = Object.freeze({
	id: "codewiki.project-context-access-benchmark",
	version: "1.0.0",
} as const);

export interface ProjectContextBenchmarkFile {
	readonly path: string;
	readonly content: string;
}

export interface ProjectContextAccessMeasurement {
	readonly strategy: "full_repository_mount" | "derived_index_with_bounded_files";
	readonly mountedBytes: number;
	readonly indexedFiles: number;
	readonly materializedFiles: number;
	readonly queryDurationMs: number;
	readonly resultDigest: Sha256Digest;
}

export interface ProjectContextAccessBenchmarkReport {
	readonly protocol: typeof PROJECT_CONTEXT_ACCESS_BENCHMARK_PROTOCOL;
	readonly repositoryDigest: Sha256Digest;
	readonly selectedPaths: readonly string[];
	readonly measurements: readonly ProjectContextAccessMeasurement[];
	readonly decision: "derived_index_with_bounded_files";
	readonly rationale: string;
	readonly reportDigest: Sha256Digest;
}

export function runProjectContextAccessBenchmark(input: {
	readonly files: readonly ProjectContextBenchmarkFile[];
	readonly selectedPaths: readonly string[];
}): ProjectContextAccessBenchmarkReport {
	const files = [...input.files].sort((left, right) => compareText(left.path, right.path));
	if (files.length === 0 || new Set(files.map((file) => file.path)).size !== files.length) {
		throw new Error("Project Context benchmark files must be non-empty and path-unique.");
	}
	const selectedPaths = Object.freeze([...new Set(input.selectedPaths)].sort(compareText));
	const repositoryDigest = canonicalJsonDigest(files);
	const fullStart = performance.now();
	const fullResults = selectedPaths.map((path) => files.find((file) => file.path === path) ?? null);
	const fullDuration = performance.now() - fullStart;
	const index = files.map((file) => ({
		path: file.path,
		byteLength: Buffer.byteLength(file.content),
		blobDigest: canonicalJsonDigest(file.content),
	}));
	const selectedFiles = files.filter((file) => selectedPaths.includes(file.path));
	const indexedStart = performance.now();
	const indexedResults = selectedPaths.map((path) => selectedFiles.find((file) => file.path === path) ?? null);
	const indexedDuration = performance.now() - indexedStart;
	if (canonicalJson(fullResults) !== canonicalJson(indexedResults)) {
		throw new Error("Project Context benchmark strategies returned different selected content.");
	}
	const measurements: readonly ProjectContextAccessMeasurement[] = Object.freeze([
		Object.freeze({
			strategy: "full_repository_mount",
			mountedBytes: Buffer.byteLength(canonicalJson(files)),
			indexedFiles: 0,
			materializedFiles: files.length,
			queryDurationMs: fullDuration,
			resultDigest: canonicalJsonDigest(fullResults),
		}),
		Object.freeze({
			strategy: "derived_index_with_bounded_files",
			mountedBytes: Buffer.byteLength(canonicalJson({index, files: selectedFiles})),
			indexedFiles: index.length,
			materializedFiles: selectedFiles.length,
			queryDurationMs: indexedDuration,
			resultDigest: canonicalJsonDigest(indexedResults),
		}),
	]);
	const body = {
		protocol: PROJECT_CONTEXT_ACCESS_BENCHMARK_PROTOCOL,
		repositoryDigest,
		selectedPaths,
		measurements,
		decision: "derived_index_with_bounded_files" as const,
		rationale: "Derived metadata plus explicitly selected bounded files preserves exact query results without mounting unrelated repository bytes.",
	};
	return Object.freeze({...body, reportDigest: canonicalJsonDigest(body)});
}

export function representativeProjectContextBenchmark(): ProjectContextAccessBenchmarkReport {
	const files = Array.from({length: 160}, (_, index) => ({
		path: `src/module-${String(index).padStart(3, "0")}.ts`,
		content: `${"export const stable = true;\n".repeat(48)}export const moduleId = ${index};\n`,
	}));
	return runProjectContextAccessBenchmark({
		files,
		selectedPaths: ["src/module-004.ts", "src/module-091.ts"],
	});
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
