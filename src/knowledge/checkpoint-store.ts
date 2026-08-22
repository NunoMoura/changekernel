import {
	lstat,
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import {dirname, join, relative, resolve, sep} from "node:path";
import {randomUUID} from "node:crypto";
import {
	assertKnowledgeCandidateCheckpoint,
	applyKnowledgeApplicationPlan,
	type KnowledgeCandidateCheckpoint,
} from "./materialization.ts";
import {
	createKnowledgeCheckpoint,
	DEFAULT_KNOWLEDGE_COMPILER,
	type KnowledgeCheckpoint,
	type KnowledgeCompilerIdentity,
	type KnowledgeProjectionFile,
	type KnowledgeTombstone,
} from "./state.ts";

interface LoadKnowledgeCheckpointInput {
	readonly repoRoot: string;
	readonly compiler?: KnowledgeCompilerIdentity;
	readonly tombstones?: readonly KnowledgeTombstone[];
}

interface ApplyKnowledgeCandidateCheckpointInput {
	readonly repoRoot: string;
	readonly checkpoint: KnowledgeCandidateCheckpoint;
	readonly transition: Parameters<typeof assertKnowledgeCandidateCheckpoint>[1];
}

export async function loadKnowledgeCheckpoint(
	input: LoadKnowledgeCheckpointInput,
): Promise<KnowledgeCheckpoint> {
	const root = resolve(input.repoRoot, ".codewiki/kb");
	const files = await readKnowledgeFiles(root);
	return createKnowledgeCheckpoint({
		files,
		tombstones: input.tombstones,
		compiler: input.compiler ?? DEFAULT_KNOWLEDGE_COMPILER,
	});
}

export async function applyKnowledgeCandidateCheckpoint(
	input: ApplyKnowledgeCandidateCheckpointInput,
): Promise<KnowledgeCheckpoint> {
	assertKnowledgeCandidateCheckpoint(input.checkpoint, input.transition);
	const lockPath = resolve(input.repoRoot, ".codewiki/runtime/knowledge-apply.lock");
	await mkdir(dirname(lockPath), {recursive: true});
	try {
		await mkdir(lockPath);
	} catch (error) {
		if (isAlreadyExists(error)) {
			throw new Error("Knowledge application is already in progress.");
		}
		throw error;
	}
	try {
		const current = await loadKnowledgeCheckpoint({
			repoRoot: input.repoRoot,
			compiler: input.checkpoint.compiler,
			tombstones: input.checkpoint.base.state.tombstones,
		});
		if (current.checkpointDigest !== input.checkpoint.baseCheckpointDigest) {
			throw new Error("Knowledge application base is stale; Candidate must be rebuilt.");
		}
		const projectedFiles = applyKnowledgeApplicationPlan(
			current.projection.files,
			input.checkpoint.applicationPlan.operations,
		);
		if (
			projectedFiles.length !== input.checkpoint.projected.projection.files.length ||
			projectedFiles.some(
				(file, index) =>
					file.byteDigest !== input.checkpoint.projected.projection.files[index]?.byteDigest ||
					file.path !== input.checkpoint.projected.projection.files[index]?.path,
			)
		) {
			throw new Error("Knowledge application plan does not produce approved projection bytes.");
		}
		if (input.checkpoint.applicationPlan.operations.length === 0) return current;
		await replaceKnowledgeDirectory({
			repoRoot: input.repoRoot,
			files: input.checkpoint.projected.projection.files,
		});
		const verified = await loadKnowledgeCheckpoint({
			repoRoot: input.repoRoot,
			compiler: input.checkpoint.compiler,
			tombstones: input.checkpoint.projected.state.tombstones,
		});
		if (verified.checkpointDigest !== input.checkpoint.projected.checkpointDigest) {
			throw new Error("Applied Knowledge projection could not be verified.");
		}
		return verified;
	} finally {
		await rm(lockPath, {recursive: true, force: true});
	}
}

async function replaceKnowledgeDirectory(input: {
	readonly repoRoot: string;
	readonly files: readonly KnowledgeProjectionFile[];
}): Promise<void> {
	const codewikiRoot = resolve(input.repoRoot, ".codewiki");
	const knowledgeRoot = join(codewikiRoot, "kb");
	const nonce = randomUUID();
	const stagingRoot = join(codewikiRoot, `.kb-apply-${nonce}`);
	const backupRoot = join(codewikiRoot, `.kb-backup-${nonce}`);
	await mkdir(stagingRoot, {recursive: false});
	try {
		for (const file of input.files) {
			const destination = safeChild(stagingRoot, file.path);
			await mkdir(dirname(destination), {recursive: true});
			await writeFile(destination, file.bytes, {encoding: "utf8", flag: "wx"});
		}
		await rename(knowledgeRoot, backupRoot);
		try {
			await rename(stagingRoot, knowledgeRoot);
		} catch (error) {
			await rename(backupRoot, knowledgeRoot);
			throw error;
		}
		await rm(backupRoot, {recursive: true, force: true});
	} finally {
		await rm(stagingRoot, {recursive: true, force: true});
	}
}

async function readKnowledgeFiles(
	root: string,
): Promise<readonly Omit<KnowledgeProjectionFile, "byteDigest">[]> {
	const rootStat = await lstat(root);
	if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
		throw new Error("Canonical Knowledge root must be a real directory.");
	}
	const paths: string[] = [];
	await walkRealDirectory(root, root, paths);
	return Promise.all(
		paths.sort(compareText).map(async (path) => ({
			path,
			mediaType: mediaTypeForPath(path),
			bytes: await readFile(safeChild(root, path), "utf8"),
		})),
	);
}

async function walkRealDirectory(
	root: string,
	directory: string,
	paths: string[],
): Promise<void> {
	let entries;
	try {
		entries = await readdir(directory, {withFileTypes: true});
	} catch (error) {
		throw new Error(
			`Canonical Knowledge directory ${relative(root, directory) || "."} cannot be read.`,
			{cause: error},
		);
	}
	for (const entry of entries) {
		const absolute = join(directory, entry.name);
		const stat = await lstat(absolute);
		if (stat.isSymbolicLink()) {
			throw new Error(`Canonical Knowledge cannot contain symlink ${relative(root, absolute)}.`);
		}
		if (stat.isDirectory()) {
			await walkRealDirectory(root, absolute, paths);
			continue;
		}
		if (!stat.isFile()) {
			throw new Error(`Canonical Knowledge contains unsupported entry ${relative(root, absolute)}.`);
		}
		const path = relative(root, absolute).split(sep).join("/");
		if (!/\.(?:md|yaml|json)$/u.test(path)) {
			throw new Error(`Canonical Knowledge contains unsupported file ${path}.`);
		}
		paths.push(path);
	}
}

function safeChild(root: string, path: string): string {
	const child = resolve(root, path);
	if (child === root || !child.startsWith(`${root}${sep}`)) {
		throw new Error(`Unsafe Knowledge storage path ${path}.`);
	}
	return child;
}

function mediaTypeForPath(
	path: string,
): KnowledgeProjectionFile["mediaType"] {
	if (path.endsWith(".md")) return "text/markdown";
	if (path.endsWith(".yaml")) return "application/yaml";
	return "application/json";
}

function isAlreadyExists(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as {readonly code?: string}).code === "EEXIST"
	);
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
