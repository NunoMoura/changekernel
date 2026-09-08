import {
	lstat,
	readFile,
	readdir,
	rm,
	writeFile,
} from "node:fs/promises";
import {join, resolve} from "node:path";

import {canonicalJson} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {canonicalValueDigest} from "../../kernel/identity/semantic-digest.ts";
import {sha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {CODEWIKI_PRODUCT} from "../../product.ts";
import {parseProjectConfigJson} from "./project-config.ts";

export const HANDOFF_CONVERSION_REPORT_PROTOCOL = Object.freeze({
	id: "codewiki.handoff-conversion-report",
	version: "1.0.0",
} as const);

export const PREDECESSOR_CONTROLLER = Object.freeze({
	packageName: "@nunomoura/codewiki",
	packageVersion: "0.3.0",
	sourceCommit: "adc272d0d9b8f228fc8cedb150c8c6371c823997",
	packageSha256: "63e926d638e0f74f0e785cf8ab6222bb45ee04abfb6e848501b29de99726489d",
} as const);

export interface HandoffConversionRequest {
	readonly projectRoot: string;
	readonly dryRun?: boolean;
}

export interface HandoffConversionReport {
	readonly protocol: typeof HANDOFF_CONVERSION_REPORT_PROTOCOL;
	readonly project: string;
	readonly predecessorController: typeof PREDECESSOR_CONTROLLER;
	readonly targetController: Readonly<{
		packageName: string;
		packageVersion: string;
	}>;
	readonly convertedFiles: readonly Readonly<{
		path: string;
		action: "created" | "modified" | "preserved" | "removed";
		sha256: Sha256Digest;
	}>[];
	readonly genesisMapping: Readonly<{
		historicalChangeId: string;
		historicalRequirementId: string;
		carriedRequirementId: string;
		genesisFactDigest: Sha256Digest;
	}>;
	readonly reportDigest: Sha256Digest;
}

export interface HandoffConversionIssue {
	readonly code:
		| "invalid_predecessor_state"
		| "invalid_project_root"
		| "io_error";
	readonly message: string;
}

/**
 * Bounded offline one-shot converter executing the SK3G handoff.
 * Operates as a recovery mechanism between controllers with neither running.
 */
export async function convertPredecessorState(
	request: HandoffConversionRequest,
): Promise<Outcome<HandoffConversionReport, HandoffConversionIssue>> {
	const root = resolve(request.projectRoot);
	const codewikiDir = join(root, ".codewiki");
	const isDir = await isDirectory(codewikiDir);
	if (!isDir) {
		return failure(issue("invalid_project_root", "Project root has no .codewiki directory."));
	}

	const configPath = join(codewikiDir, "config.json");
	let configText: string;
	try {
		configText = await readFile(configPath, "utf8");
	} catch {
		return failure(issue("invalid_predecessor_state", "Missing .codewiki/config.json."));
	}
	const parsedConfig = parseProjectConfigJson(configText);
	if (!parsedConfig.ok) {
		return failure(issue("invalid_predecessor_state", `Invalid .codewiki/config.json: ${parsedConfig.error.message}`));
	}

	const lockPath = join(codewikiDir, "check-packs.lock.json");
	try {
		const lockText = await readFile(lockPath, "utf8");
		JSON.parse(lockText);
	} catch {
		return failure(issue("invalid_predecessor_state", "Missing or invalid .codewiki/check-packs.lock.json."));
	}

	const changesDir = join(codewikiDir, "changes");
	const hasChanges = await isDirectory(changesDir);
	if (!hasChanges) {
		return failure(issue("invalid_predecessor_state", "Missing .codewiki/changes directory."));
	}

	const convertedFiles: Array<{
		path: string;
		action: "created" | "modified" | "preserved" | "removed";
		sha256: Sha256Digest;
	}> = [];

	convertedFiles.push(Object.freeze({
		path: ".codewiki/config.json",
		action: "preserved" as const,
		sha256: sha256Digest(configText),
	}));

	const updatedLockObj = {
		packages: {
			[CODEWIKI_PRODUCT.package.name]: {
				installedPaths: CODEWIKI_PRODUCT.checks.resources.map((r) => `.codewiki/${r.path}`),
				localDivergence: false,
				packageVersion: CODEWIKI_PRODUCT.package.version,
				planDigest: sha256Digest(configText),
				resources: CODEWIKI_PRODUCT.checks.resources.map((r) => ({
					packId: r.packId,
					stage: r.stage,
					treeDigest: r.treeDigest,
				})),
				source: {
					kind: "npm",
					locator: CODEWIKI_PRODUCT.package.name,
					resolvedRevision: CODEWIKI_PRODUCT.package.version,
				},
			},
		},
		protocolId: "codewiki.check-pack-lock",
		protocolVersion: "1.0.0",
	};
	const updatedLockCanonical = canonicalJson(updatedLockObj);
	if (!updatedLockCanonical.ok) {
		return failure(issue("io_error", "Failed to serialize updated check-packs lock."));
	}
	const updatedLockJson = `${updatedLockCanonical.value}\n`;
	convertedFiles.push(Object.freeze({
		path: ".codewiki/check-packs.lock.json",
		action: "modified" as const,
		sha256: sha256Digest(updatedLockJson),
	}));

	const changeEntries = await readdir(changesDir);
	for (const entry of changeEntries) {
		const fullPath = join(changesDir, entry);
		if (entry.endsWith(".idx") || entry.endsWith(".workstate")) {
			if (!request.dryRun) {
				await rm(fullPath, {force: true});
			}
			convertedFiles.push(Object.freeze({
				path: `.codewiki/changes/${entry}`,
				action: "removed" as const,
				sha256: sha256Digest(entry),
			}));
		} else if (entry.endsWith(".jsonl")) {
			const traceContent = await readFile(fullPath);
			convertedFiles.push(Object.freeze({
				path: `.codewiki/changes/${entry}`,
				action: "preserved" as const,
				sha256: sha256Digest(traceContent),
			}));
		}
	}

	const genesisMappingObj = {
		historicalChangeId: "CHG-sk3a-exact-design-roadmap",
		historicalRequirementId: "cw:codewiki:requirement:kjmy5ktiltnicsnne6bzgfbkwrh4n4j5r6sqs4gkhwjsiajsiema",
		carriedRequirementId: "cw:codewiki:requirement:jzsvjec4kalxya5t3qpyvl2hgygje5a24fvi5bxv7qpo7z64kc6q",
		predecessorCommit: PREDECESSOR_CONTROLLER.sourceCommit,
		targetVersion: CODEWIKI_PRODUCT.package.version,
	};
	const genesisFactDigestResult = canonicalValueDigest(genesisMappingObj);
	if (!genesisFactDigestResult.ok) {
		return failure(issue("io_error", genesisFactDigestResult.error.message));
	}
	const genesisFactDigest = genesisFactDigestResult.value;

	convertedFiles.sort((a, b) => comparePath(a.path, b.path));

	const reportBody = {
		protocol: HANDOFF_CONVERSION_REPORT_PROTOCOL,
		project: parsedConfig.value.project,
		predecessorController: PREDECESSOR_CONTROLLER,
		targetController: Object.freeze({
			packageName: CODEWIKI_PRODUCT.package.name,
			packageVersion: CODEWIKI_PRODUCT.package.version,
		}),
		convertedFiles: Object.freeze(convertedFiles),
		genesisMapping: Object.freeze({
			...genesisMappingObj,
			genesisFactDigest,
		}),
	};

	const reportJson = canonicalJson(reportBody);
	if (!reportJson.ok) {
		return failure(issue("io_error", "Failed to serialize handoff report."));
	}
	const reportDigest = sha256Digest(reportJson.value);

	if (!request.dryRun) {
		await writeFile(lockPath, updatedLockJson, "utf8");
	}

	return success(Object.freeze({
		...reportBody,
		reportDigest,
	}));
}

async function isDirectory(path: string): Promise<boolean> {
	try {
		const stat = await lstat(path);
		return stat.isDirectory() && !stat.isSymbolicLink();
	} catch {
		return false;
	}
}

function issue(code: HandoffConversionIssue["code"], message: string): HandoffConversionIssue {
	return Object.freeze({code, message});
}

function comparePath(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
