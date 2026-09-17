import {constants} from "node:fs";
import {createHash, randomBytes, randomUUID} from "node:crypto";
import {link, lstat, mkdir, open, readdir, realpath, unlink} from "node:fs/promises";
import {isAbsolute, join, relative, sep} from "node:path";
import {canonicalJson, parseCanonicalJson} from "../../kernel/data-contracts/canonical-json.ts";
import {decodeContract, exactRecord} from "../../kernel/data-contracts/validation.ts";
import {decodeCheckResult, type CheckResult} from "../../kernel/gates/checks.ts";
import {decodeDecisionValidationResult, type DecisionValidationResult} from "../../kernel/gates/decision-validation.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";

const PROTOCOL = "changekernel.check-journal@1.0.0";
const DIRECTORY = "check-state-v1";
const MAXIMUM_ATTEMPTS = 256;
export interface CheckAttemptBinding {
	readonly selectionDigest: Sha256Digest;
	readonly inputDigest: Sha256Digest;
	readonly executionDigest: Sha256Digest;
	readonly permissionDigest: Sha256Digest;
}
export interface RetainedCheckValue {readonly result: CheckResult | DecisionValidationResult; readonly dependenciesDigest: Sha256Digest; readonly modelCalls: number;}
function encoded(value: unknown) {const result = canonicalJson(value); if (!result.ok) throw new Error("Invalid Check journal data."); return result.value;}
function sha(value: unknown) {const result = decodeSha256Digest(value); if (!result.ok) throw new Error("Invalid journal identity."); return result.value;}
function binding(value: unknown): CheckAttemptBinding {
	const decoded = decodeContract("Check attempt", value, value => exactRecord("Check attempt", value, "$", ["selectionDigest", "inputDigest", "executionDigest", "permissionDigest"]));
	if (!decoded.ok) throw new Error("Invalid Check attempt.");
	const r = decoded.value;
	return Object.freeze({selectionDigest: sha(r.selectionDigest), inputDigest: sha(r.inputDigest), executionDigest: sha(r.executionDigest), permissionDigest: sha(r.permissionDigest)});
}
function retained(value: unknown): RetainedCheckValue | null {
	if (value === null) return null; // Known stopped failure, never a Boolean verdict.
	const decoded = decodeContract("Retained Check", value, value => exactRecord("Retained Check", value, "$", ["result", "dependenciesDigest", "modelCalls"]));
	if (!decoded.ok) throw new Error("Invalid retained Check.");
	const r = decoded.value, domain = decodeCheckResult(r.result);
	const result = domain.ok ? domain : decodeDecisionValidationResult(r.result);
	if (!result.ok || result.value.status !== "completed" || typeof r.modelCalls !== "number" || !Number.isSafeInteger(r.modelCalls) || r.modelCalls < 0 || r.modelCalls > 32) throw new Error("Invalid retained Check.");
	return Object.freeze({result: result.value, dependenciesDigest: sha(r.dependenciesDigest), modelCalls: r.modelCalls});
}
async function privateDirectory(path: string) {
	const stat = await lstat(path);
	if (!stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) throw new Error("Check state must be an owner-private directory.");
}
async function syncDirectory(path: string) {const file = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW); try {await file.sync();} finally {await file.close();}}
async function read(path: string) {
	const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const stat = await file.stat();
		if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0 || stat.nlink !== 1 || stat.size > 131072) throw new Error("Invalid Check state file.");
		const buffer = Buffer.alloc(131073), {bytesRead} = await file.read(buffer, 0, buffer.length, 0);
		if (bytesRead !== stat.size || bytesRead > 131072) throw new Error("Incomplete or oversized Check state.");
		const text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(buffer.subarray(0, bytesRead)), decoded = parseCanonicalJson(text);
		if (!decoded.ok || encoded(decoded.value) !== text) throw new Error("Non-canonical Check state.");
		return decoded.value;
	} finally {await file.close();}
}
async function publish(directory: string, name: string, value: unknown) {
	const text = encoded(value);
	if (Buffer.byteLength(text) > 131072) throw new Error("Check state exceeds its bound.");
	const temporary = join(directory, `.pending-${randomUUID()}`), file = await open(temporary, "wx", 0o600);
	try {await file.writeFile(text); await file.sync();} finally {await file.close();}
	// No replacement, including when completion is accidentally requested twice.
	await link(temporary, join(directory, name)); await unlink(temporary); await syncDirectory(directory);
}
async function rootDirectory(root: string) {
	if (!isAbsolute(root)) throw new Error("Check state requires an absolute external root.");
	const directory = await realpath(root), location = relative(await realpath(process.cwd()), directory);
	if (!location || (!location.startsWith(`..${sep}`) && location !== ".." && !isAbsolute(location))) throw new Error("Check state must be outside the checkout.");
	await privateDirectory(directory); return directory;
}

/** One-time trusted provisioning. Never called implicitly by execution or reopening. */
export async function initializeCheckJournal(root: string): Promise<Sha256Digest> {
	const parent = await rootDirectory(root), directory = join(parent, DIRECTORY);
	await mkdir(directory, {mode: 0o700});
	const identity = `sha256:${createHash("sha256").update(randomBytes(32)).digest("hex")}` as Sha256Digest;
	await publish(directory, "identity.json", {protocol: PROTOCOL, identity}); await syncDirectory(parent);
	return identity;
}

/** Bounded append-only custody, not an authority source or a general result cache. */
export async function openCheckJournal(root: string, identity: Sha256Digest) {
	const directory = join(await rootDirectory(root), DIRECTORY);
	async function verify() {
		await privateDirectory(directory);
		if (encoded(await read(join(directory, "identity.json"))) !== encoded({protocol: PROTOCOL, identity: sha(identity)})) throw new Error("Check state identity differs from the configured identity.");
	}
	await verify();
	return Object.freeze({async begin(input: CheckAttemptBinding) {
		await verify(); const requested = binding(input);
		const names = (await readdir(directory)).filter(name => name !== "identity.json").sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
		if (names.length > MAXIMUM_ATTEMPTS || names.some((name, i) => name !== String(i).padStart(3, "0"))) throw new Error("Check state has gaps or unexpected entries.");
		let previous: RetainedCheckValue | null | undefined;
		const seen = new Set<Sha256Digest>();
		for (const name of names) {
			const path = join(directory, name); await privateDirectory(path);
			const files = (await readdir(path)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
			if (encoded(files) !== encoded(["claim.json", "terminal.json"])) throw new Error("Check execution custody is unresolved; investigation is required.");
			const claim = binding(await read(join(path, "claim.json"))), terminal = retained(await read(join(path, "terminal.json")));
			if (seen.has(claim.inputDigest)) throw new Error("Duplicate Check attempts.");
			seen.add(claim.inputDigest);
			if (terminal && (terminal.result.inputDigest !== claim.inputDigest || terminal.result.executionDigest !== claim.executionDigest)) throw new Error("Retained Check does not match its claim.");
			// A completion observed between publication and its writer's sync must
			// be durable before another process can admit a subsequent attempt.
			await syncDirectory(path);
			if (claim.inputDigest === requested.inputDigest) {
				// Selection is authorization provenance, not an extra evaluator input.
				// The host must authorize the current selection again before delivery.
				if (previous !== undefined || claim.executionDigest !== requested.executionDigest || claim.permissionDigest !== requested.permissionDigest) throw new Error("Conflicting Check attempt bindings.");
				previous = terminal;
			}
		}
		if (previous !== undefined) return Object.freeze({kind: "retained" as const, value: previous});
		if (names.length === MAXIMUM_ATTEMPTS) throw new Error("Check custody is full; explicit archival is required.");
		const path = join(directory, String(names.length).padStart(3, "0"));
		// Exclusive creation serializes competing processes. Never skip a slot
		// or steal an incomplete reservation based on elapsed time or a dead PID.
		await mkdir(path, {mode: 0o700}); await syncDirectory(directory);
		await publish(path, "claim.json", requested);
		let finished = false;
		return Object.freeze({kind: "claimed" as const, async finish(value: RetainedCheckValue | null) {
			if (finished) throw new Error("Check attempt already finalized.");
			finished = true; const checked = retained(value);
			if (checked && (checked.result.inputDigest !== requested.inputDigest || checked.result.executionDigest !== requested.executionDigest)) throw new Error("Check completion differs from its claim.");
			await publish(path, "terminal.json", checked);
		}});
	}});
}
