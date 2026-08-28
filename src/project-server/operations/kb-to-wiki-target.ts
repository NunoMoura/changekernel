import type {
	GitCommandResult,
	GitCommandRunner,
} from "../../changes/trace/git-command.ts";
import {
	WIKI_CONFIG_PATH,
	SEMANTIC_KERNEL_WIKI_CONFIG_PROTOCOL,
	assertSemanticKernelWikiConfig,
	migrateLegacyWikiConfigDomainSelection,
	migrateWikiConfigToSemanticKernel,
} from "../../project/config-file.ts";
import type {
	GitObjectFormat,
	GitOid,
} from "../../project/git-store-profile.ts";
import {
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	assertBackendBuildBinding,
	SEMANTIC_KERNEL_BACKEND_BUILD_PROTOCOL,
	type SemanticKernelBackendBuildBinding,
} from "./build.ts";
import type {KbToWikiMigrationReadiness} from "./kb-to-wiki-readiness.ts";

export const KB_TO_WIKI_TARGET_CONFIG_PATH = WIKI_CONFIG_PATH;
export const KB_TO_WIKI_TARGET_CONFIG_PROTOCOL = SEMANTIC_KERNEL_WIKI_CONFIG_PROTOCOL;

export type KbToWikiTargetBackendBuild = SemanticKernelBackendBuildBinding;

export interface KbToWikiStagedFile {
	readonly path: string;
	readonly bytes: string;
	readonly oid: GitOid;
}

export interface KbToWikiConfigurationMigration {
	readonly source: KbToWikiStagedFile;
	readonly target: KbToWikiStagedFile;
	readonly sourceDigest: Sha256Digest;
	readonly targetDigest: Sha256Digest;
}

export function assertKbToWikiTargetBuild(
	value: SemanticKernelBackendBuildBinding,
): void {
	assertBackendBuildBinding(value);
	if (value.protocol.version !== SEMANTIC_KERNEL_BACKEND_BUILD_PROTOCOL.version) {
		throw new Error("Migration target must use a Domain-free Semantic Kernel Backend Build.");
	}
}

export async function stageKbToWikiConfiguration(input: {
	readonly repoRoot: string;
	readonly runner: GitCommandRunner;
	readonly readiness: KbToWikiMigrationReadiness;
}): Promise<KbToWikiConfigurationMigration> {
	const sourceBytes = await git(
		input,
		["show", `${input.readiness.sourceCommit.hex}:${WIKI_CONFIG_PATH}`],
		{trim: false},
	);
	let sourceValue: object;
	try {
		sourceValue = JSON.parse(sourceBytes) as object;
	} catch {
		throw new Error("Legacy project configuration must contain valid JSON.");
	}
	const legacyConfig = migrateLegacyWikiConfigDomainSelection(sourceValue);
	const targetValue = migrateWikiConfigToSemanticKernel(legacyConfig);
	assertSemanticKernelWikiConfig(targetValue);
	const targetBytes = `${JSON.stringify(targetValue, null, "\t")}\n`;
	const sourceOid = gitOid(
		input.readiness.profile.objectFormat,
		await git(input, [
			"rev-parse",
			`${input.readiness.sourceCommit.hex}:${WIKI_CONFIG_PATH}`,
		]),
	);
	const targetHex = await git(
		input,
		["hash-object", "-w", "--stdin"],
		{input: targetBytes},
	);
	return Object.freeze({
		source: {path: WIKI_CONFIG_PATH, bytes: sourceBytes, oid: sourceOid},
		target: {
			path: WIKI_CONFIG_PATH,
			bytes: targetBytes,
			oid: gitOid(input.readiness.profile.objectFormat, targetHex),
		},
		sourceDigest: canonicalJsonDigest(sourceValue),
		targetDigest: canonicalJsonDigest(targetValue),
	});
}

function gitOid(objectFormat: GitObjectFormat, hex: string): GitOid {
	return Object.freeze({algorithm: objectFormat, hex});
}

async function git(
	input: {
		readonly repoRoot: string;
		readonly runner: GitCommandRunner;
	},
	args: readonly string[],
	options: {
		readonly trim?: boolean;
		readonly input?: string;
	} = {},
): Promise<string> {
	const result = await runGit(input, args, options.input);
	if (result.exitCode !== 0) {
		throw new Error(`Git ${args[0]} failed: ${result.stderr.trim()}`);
	}
	return options.trim === false ? result.stdout : result.stdout.trim();
}

async function runGit(
	input: {
		readonly repoRoot: string;
		readonly runner: GitCommandRunner;
	},
	args: readonly string[],
	stdin?: string,
): Promise<GitCommandResult> {
	return input.runner({
		repoRoot: input.repoRoot,
		args,
		input: stdin,
	});
}
