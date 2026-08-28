import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createCodewikiConfigError } from "./config-errors.ts";
import {
	createGitCommandRunner,
	type GitCommandRunner,
} from "../changes/trace/git-command.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../utils/canonical-json.ts";
import {
	DEFAULT_WIKI_CONFIG,
	runWikiConfig,
	resolveWikiConfig,
	type PartialWikiConfig,
	type RunWikiConfigInput,
	type RunWikiConfigResult,
	type WikiConfig,
} from "./config.ts";

export const WIKI_CONFIG_PATH = ".codewiki/config.json";

export const SEMANTIC_KERNEL_WIKI_CONFIG_PROTOCOL = Object.freeze({
	id: "codewiki.project-config",
	version: "2.0.0",
} as const);

export type SemanticKernelWikiConfig = Omit<WikiConfig, "domain"> & {
	readonly protocol: typeof SEMANTIC_KERNEL_WIKI_CONFIG_PROTOCOL;
};

interface WikiConfigFileObject {
	readonly protocol?: Readonly<{
		readonly id: string;
		readonly version: string;
	}>;
	readonly domain?: WikiConfig["domain"];
	readonly project?: string;
}

export type WikiConfigFileFormat = "legacy-domain" | "semantic-kernel";

export interface LoadedWikiConfigFile {
	readonly config: WikiConfig;
	readonly format: WikiConfigFileFormat;
	readonly digest: Sha256Digest;
}

export interface WikiConfigFileResult extends RunWikiConfigResult {
	path: string;
	written: boolean;
}

export async function loadWikiConfigFile(
	repoRoot: string,
): Promise<WikiConfig> {
	const raw = await readOptionalJson(configPath(repoRoot));
	return (
		raw === null
			? loadedConfig(resolveWikiConfig(), "legacy-domain")
			: configFileToRuntimeResult(raw)
	).config;
}

export async function loadWikiConfigFileResult(
	repoRoot: string,
): Promise<LoadedWikiConfigFile> {
	const raw = await readOptionalJson(configPath(repoRoot));
	return raw === null
		? loadedConfig(resolveWikiConfig(), "legacy-domain")
		: configFileToRuntimeResult(raw);
}

export async function loadProtectedWikiConfigFileResult(input: {
	readonly repoRoot: string;
	readonly protectedSourceHead: string;
	readonly runner?: GitCommandRunner;
	readonly signal?: AbortSignal;
}): Promise<LoadedWikiConfigFile> {
	if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(input.protectedSourceHead)) {
		throw new Error("Protected source head must be a Git object id.");
	}
	const runner = input.runner ?? createGitCommandRunner();
	const result = await runner({
		repoRoot: input.repoRoot,
		args: ["show", `${input.protectedSourceHead}:${WIKI_CONFIG_PATH}`],
		...(input.signal ? {signal: input.signal} : {}),
	});
	if (result.exitCode !== 0) {
		throw new Error(
			`Unable to read protected project configuration: ${result.stderr.trim() || "Git failed"}`,
		);
	}
	let value: WikiConfigFileObject;
	try {
		value = JSON.parse(result.stdout) as WikiConfigFileObject;
	} catch {
		throw new Error("Protected project configuration must contain valid JSON.");
	}
	return configFileToRuntimeResult(value);
}

export async function resolveWikiConfigFile(
	repoRoot: string,
	input: RunWikiConfigInput = {},
): Promise<WikiConfigFileResult> {
	const current = input.current
		? resolveWikiConfig(input.current)
		: await loadWikiConfigFile(repoRoot);
	const result = runWikiConfig({ current, patch: input.patch });
	return { ...result, path: WIKI_CONFIG_PATH, written: false };
}

export function serializeWikiConfigFile(config: WikiConfig): string {
	return `${JSON.stringify(resolveWikiConfig(config), null, "\t")}\n`;
}

export function wikiConfigDigest(config: WikiConfig): Sha256Digest {
	return canonicalJsonDigest(resolveWikiConfig(config));
}

export function wikiConfigDigestForFormat(
	config: WikiConfig,
	format: WikiConfigFileFormat,
): Sha256Digest {
	return format === "semantic-kernel"
		? canonicalJsonDigest(migrateWikiConfigToSemanticKernel(config))
		: wikiConfigDigest(config);
}

export function migrateWikiConfigToSemanticKernel(
	value: WikiConfigFileObject,
): SemanticKernelWikiConfig {
	const current = resolveWikiConfig(configFileToPartialWikiConfig(value));
	const {domain: _legacyDomainEvidence, ...target} = current;
	return Object.freeze({
		protocol: SEMANTIC_KERNEL_WIKI_CONFIG_PROTOCOL,
		...target,
	});
}

export function assertSemanticKernelWikiConfig(
	value: WikiConfigFileObject,
): asserts value is SemanticKernelWikiConfig {
	const record = requiredObjectRecord(value, WIKI_CONFIG_PATH);
	assertKnownKeys(record, WIKI_CONFIG_PATH, [
		"protocol",
		"project",
		"preview",
		"runtime",
		"retention",
		"hosts",
		"quality",
		"userStandards",
		"triagePreferences",
	]);
	if (canonicalJson(record.protocol) !== canonicalJson(SEMANTIC_KERNEL_WIKI_CONFIG_PROTOCOL)) {
		throw createCodewikiConfigError({
			path: `${WIKI_CONFIG_PATH}.protocol`,
			code: "invalid_value",
			message: "Semantic Kernel project configuration protocol is invalid.",
		});
	}
	// SAFETY: exact top-level keys, protocol identity, and normalized config replay are checked here.
	const {protocol: _protocol, ...legacyCompatible} =
		record as unknown as SemanticKernelWikiConfig;
	const runtime = resolveWikiConfig({
		...legacyCompatible,
		domain: DEFAULT_WIKI_CONFIG.domain,
	});
	const normalized = migrateWikiConfigToSemanticKernel({
		...runtime,
		domain: DEFAULT_WIKI_CONFIG.domain,
	});
	if (canonicalJson(record) !== canonicalJson(normalized)) {
		throw createCodewikiConfigError({
			path: WIKI_CONFIG_PATH,
			code: "invalid_value",
			message: "Semantic Kernel project configuration is not canonical.",
		});
	}
}

function serializeSemanticKernelWikiConfigFile(config: WikiConfig): string {
	return `${JSON.stringify(migrateWikiConfigToSemanticKernel(config), null, "\t")}\n`;
}

export async function writeWikiConfigFile(
	repoRoot: string,
	config: WikiConfig,
): Promise<void> {
	const path = configPath(repoRoot);
	const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
	await mkdir(dirname(path), { recursive: true });
	try {
		await writeFile(temporaryPath, serializeWikiConfigFile(config), {
			encoding: "utf8",
			mode: 0o600,
		});
		await rename(temporaryPath, path);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}

export async function updateWikiConfigFile(
	repoRoot: string,
	input: RunWikiConfigInput = {},
): Promise<WikiConfigFileResult> {
	const raw = await readOptionalJson(configPath(repoRoot));
	const result = await resolveWikiConfigFile(repoRoot, input);
	if (raw !== null && isSemanticKernelWikiConfig(raw)) {
		await writeWikiConfigBytes(
			repoRoot,
			serializeSemanticKernelWikiConfigFile(result.config),
		);
	} else {
		await writeWikiConfigFile(repoRoot, result.config);
	}
	return { ...result, written: true };
}

export function migrateLegacyWikiConfigDomainSelection(
	value: unknown,
): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw createCodewikiConfigError({
			path: WIKI_CONFIG_PATH,
			code: "invalid_type",
			message: `${WIKI_CONFIG_PATH} must contain a JSON object.`,
		});
	}
	const record = structuredClone(value) as Record<string, unknown>;
	const existing = objectRecord(record.domain);
	for (const [field, expected] of Object.entries(DEFAULT_WIKI_CONFIG.domain)) {
		const current = existing[field];
		if (current !== undefined && current !== null && current !== expected) {
			throw createCodewikiConfigError({
				path: `${WIKI_CONFIG_PATH}.domain.${field}`,
				code: "invalid_value",
				message: "Legacy Domain migration cannot replace an explicit foreign or drifted selection.",
			});
		}
	}
	record.domain = {...DEFAULT_WIKI_CONFIG.domain};
	return record;
}

export function configFileToPartialWikiConfig(
	value: unknown,
): PartialWikiConfig {
	const record = validateConfigFileKeys(value);
	const runtime = objectRecord(record.runtime);
	const codewiki = objectRecord(record.codewiki);
	const agency = objectRecord(codewiki.agency);
	const parallelism = objectRecord(agency.parallelism);
	const approvalCadence = text(agency.approval_cadence);
	const stopConditions = stringList(agency.stop_gates);
	return {
		domain: objectRecord(record.domain),
		project: text(record.project) || text(record.project_name) || undefined,
		preview: objectRecord(record.preview),
		runtime: {
			...runtime,
			...(number(parallelism.max_sessions) !== undefined &&
			runtime.maxWorkers === undefined
				? { maxWorkers: number(parallelism.max_sessions) }
				: {}),
			...(approvalCadence &&
			objectRecord(runtime.approval).cadence === undefined
				? { approval: { cadence: cadenceFromLegacy(approvalCadence) } }
				: {}),
			...(stopConditions.length > 0 && runtime.stopConditions === undefined
				? { stopConditions }
				: {}),
		},
		retention: objectRecord(record.retention),
		hosts: objectRecord(record.hosts),
		quality: objectRecord(record.quality),
		userStandards: record.userStandards as PartialWikiConfig["userStandards"],
		triagePreferences:
			record.triagePreferences as PartialWikiConfig["triagePreferences"],
	};
}

function configFileToRuntimeResult(
	value: WikiConfigFileObject,
): LoadedWikiConfigFile {
	if (isSemanticKernelWikiConfig(value)) {
		assertSemanticKernelWikiConfig(value);
		const {protocol: _protocol, ...config} = value;
		return loadedConfig(
			resolveWikiConfig({...config, domain: DEFAULT_WIKI_CONFIG.domain}),
			"semantic-kernel",
		);
	}
	return loadedConfig(
		resolveWikiConfig(configFileToPartialWikiConfig(value)),
		"legacy-domain",
	);
}

function loadedConfig(
	config: WikiConfig,
	format: WikiConfigFileFormat,
): LoadedWikiConfigFile {
	return Object.freeze({
		config,
		format,
		digest: wikiConfigDigestForFormat(config, format),
	});
}

function isSemanticKernelWikiConfig(
	value: WikiConfigFileObject,
): value is SemanticKernelWikiConfig {
	if (Array.isArray(value)) return false;
	const protocol = (value as {readonly protocol?: object}).protocol;
	return protocol !== undefined &&
		canonicalJson(protocol) === canonicalJson(SEMANTIC_KERNEL_WIKI_CONFIG_PROTOCOL);
}

async function writeWikiConfigBytes(repoRoot: string, bytes: string): Promise<void> {
	const path = configPath(repoRoot);
	const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
	await mkdir(dirname(path), {recursive: true});
	try {
		await writeFile(temporaryPath, bytes, {encoding: "utf8", mode: 0o600});
		await rename(temporaryPath, path);
	} finally {
		await rm(temporaryPath, {force: true});
	}
}

function validateConfigFileKeys(value: unknown): Record<string, unknown> {
	const record = requiredObjectRecord(value, WIKI_CONFIG_PATH);
	assertKnownKeys(record, WIKI_CONFIG_PATH, [
		"domain",
		"project",
		"preview",
		"runtime",
		"retention",
		"hosts",
		"quality",
		"userStandards",
		"triagePreferences",
		"project_name",
		"codewiki",
	]);
	const domain = optionalObjectRecord(
		record.domain,
		`${WIKI_CONFIG_PATH}.domain`,
	);
	if (!domain) {
		throw exactDomainSelectionRequired();
	}
	assertKnownKeys(domain, `${WIKI_CONFIG_PATH}.domain`, [
		"pluginId",
		"pluginVersion",
		"admissionDigest",
	]);
	if (
		!text(domain.pluginId) ||
		!text(domain.pluginVersion) ||
		!text(domain.admissionDigest)
	) {
		throw exactDomainSelectionRequired();
	}
	const codewiki = optionalObjectRecord(
		record.codewiki,
		`${WIKI_CONFIG_PATH}.codewiki`,
	);
	if (codewiki) {
		assertKnownKeys(codewiki, `${WIKI_CONFIG_PATH}.codewiki`, ["agency"]);
		const agency = optionalObjectRecord(
			codewiki.agency,
			`${WIKI_CONFIG_PATH}.codewiki.agency`,
		);
		if (agency) {
			assertKnownKeys(agency, `${WIKI_CONFIG_PATH}.codewiki.agency`, [
				"parallelism",
				"approval_cadence",
				"stop_gates",
			]);
			const parallelism = optionalObjectRecord(
				agency.parallelism,
				`${WIKI_CONFIG_PATH}.codewiki.agency.parallelism`,
			);
			if (parallelism) {
				assertKnownKeys(
					parallelism,
					`${WIKI_CONFIG_PATH}.codewiki.agency.parallelism`,
					["max_sessions"],
				);
			}
		}
	}
	return record;
}

function optionalObjectRecord(
	value: unknown,
	path: string,
): Record<string, unknown> | undefined {
	return value === undefined ? undefined : requiredObjectRecord(value, path);
}

function requiredObjectRecord(
	value: unknown,
	path: string,
): Record<string, unknown> {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	throw createCodewikiConfigError({
		path,
		code: "invalid_type",
		message: `${path} must be a JSON object.`,
		value,
	});
}

function assertKnownKeys(
	record: Record<string, unknown>,
	path: string,
	allowed: readonly string[],
): void {
	for (const key of Object.keys(record)) {
		if (allowed.includes(key)) continue;
		const keyPath = `${path}.${key}`;
		throw createCodewikiConfigError({
			path: keyPath,
			code: "unknown_key",
			message: `${keyPath} is an unknown config key.`,
			value: record[key],
		});
	}
}

function exactDomainSelectionRequired(): Error {
	return createCodewikiConfigError({
		path: `${WIKI_CONFIG_PATH}.domain`,
		code: "invalid_value",
		message:
			"Persisted wiki_config requires exact Domain Plugin ID, version, and admission digest; migrate configuration explicitly.",
	});
}

function configPath(repoRoot: string): string {
	return join(repoRoot, WIKI_CONFIG_PATH);
}

async function readOptionalJson(path: string): Promise<WikiConfigFileObject | null> {
	try {
		return JSON.parse(await readFile(path, "utf8")) as WikiConfigFileObject;
	} catch (error) {
		if (isNotFound(error)) return null;
		throw createCodewikiConfigError({
			path,
			message: `wiki_config file ${path} must contain valid JSON.`,
			cause: error,
		});
	}
}

function cadenceFromLegacy(
	value: string,
): "always" | "per_iteration" | "on_risk" | "never" {
	if (value === "never") return "never";
	if (value === "risk" || value === "on_risk") return "on_risk";
	return "per_iteration";
}

function objectRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function stringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.map((item) => text(item)).filter(Boolean)
		: [];
}

function text(value: unknown): string {
	return String(value || "").trim();
}

function number(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	return value;
}

function isNotFound(error: unknown): boolean {
	return Boolean(
		error &&
			typeof error === "object" &&
			"code" in error &&
			(error as { code?: unknown }).code === "ENOENT",
	);
}
