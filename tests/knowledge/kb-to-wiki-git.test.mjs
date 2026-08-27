import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdtemp, mkdir, readFile, rm, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";
import {after, describe, it} from "node:test";
import {
	activateKbToWikiMigrationRefsCas,
	inspectKbToWikiMigrationActivation,
	restoreKbToWikiMigrationSourceCas,
	validateKbToWikiMigrationCommit,
} from "../../src/knowledge/kb-to-wiki-git.ts";
import {
	createKbToWikiLegacyEquivalenceProof,
	createKbToWikiMigrationPlan,
} from "../../src/knowledge/kb-to-wiki-migration.ts";
import {createKbToWikiMigrationReceipt} from "../../src/knowledge/kb-to-wiki-receipt.ts";
import {createGitStoreProfile} from "../../src/project/git-store-profile.ts";
import {createGitCommandRunner} from "../../src/changes/trace/git-command.ts";
import {
	changeTracePath,
	createChangeTraceHeader,
	createChangeTraceOperation,
	serializeChangeTrace,
} from "../../src/changes/trace/semantic-kernel.ts";

const execFileAsync = promisify(execFile);
const roots = [];
const activeChangeId = "CHG-active-migration";
const sourceFixtureUrl = new URL(
	"../fixtures/semantic-kernel/migration/source.json",
	import.meta.url,
);

after(async () => {
	await Promise.all(roots.map((root) => rm(root, {recursive: true, force: true})));
});

function oid(hex, algorithm = "sha1") {
	return {algorithm, hex};
}

async function git(root, ...args) {
	const {stdout} = await execFileAsync("git", args, {
		cwd: root,
		env: {
			...process.env,
			GIT_AUTHOR_DATE: "@1787846404 +0000",
			GIT_AUTHOR_EMAIL: "migration@example.test",
			GIT_AUTHOR_NAME: "CodeWiki Migration",
			GIT_COMMITTER_DATE: "@1787846404 +0000",
			GIT_COMMITTER_EMAIL: "migration@example.test",
			GIT_COMMITTER_NAME: "CodeWiki Migration",
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_TERMINAL_PROMPT: "0",
		},
		encoding: "utf8",
	});
	return stdout.trim();
}

async function write(root, path, bytes) {
	await mkdir(join(root, path, ".."), {recursive: true});
	await writeFile(join(root, path), bytes);
}

async function fixture(options = {}) {
	const objectFormat = options.objectFormat ?? "sha1";
	const root = await mkdtemp(join(tmpdir(), "codewiki-migration-git-"));
	roots.push(root);
	await git(
		root,
		"init",
		"-q",
		"-b",
		"main",
		...(objectFormat === "sha256" ? ["--object-format=sha256"] : []),
	);
	await git(root, "config", "user.name", "CodeWiki Migration Test");
	await git(root, "config", "user.email", "migration@example.test");
	await write(root, "README.md", "source project\n");
	await write(root, ".codewiki/kb/policy.md", "legacy knowledge\n");
	await write(root, ".codewiki/traces/TRACE-CHG-old.jsonl", "legacy trace\n");
	await git(root, "add", ".");
	await git(root, "commit", "-q", "--no-gpg-sign", "-m", "source");
	const source = await git(root, "rev-parse", "HEAD");
	const sourceInput = JSON.parse(await readFile(sourceFixtureUrl, "utf8"));
	sourceInput.source.objectFormat = objectFormat;
	sourceInput.source.sourceCommit = oid(source, objectFormat);
	const plan = createKbToWikiMigrationPlan(sourceInput);
	const profile = createGitStoreProfile({
		repositoryId: plan.source.repositoryId,
		objectFormat,
		canonicalRef: "refs/heads/main",
	});
	await git(root, "update-ref", plan.source.backupRef, source);
	if (!options.keepLegacy) {
		await rm(join(root, ".codewiki/kb"), {recursive: true});
		await rm(join(root, ".codewiki/traces"), {recursive: true});
	}
	for (const [index, item] of plan.items.entries()) {
		if (options.symbolicWiki && index === 0) {
			await mkdir(join(root, item.path, ".."), {recursive: true});
			await symlink("../../../../README.md", join(root, item.path));
			continue;
		}
		const bytes = options.tamperWiki && index === 0
			? item.bytes.replace("Accepted", "Tampered")
			: item.bytes;
		await write(root, item.path, bytes);
	}
	const convertedHeader = createChangeTraceHeader({
		changeId: options.wrongConvertedHeader ? "CHG-wrong-path" : "CHG-old",
		projectId: plan.projectId,
		repositoryId: profile.repositoryId,
		objectFormat,
		createdAt: "2026-08-27T16:00:00.000Z",
		createdBy: "actor:migration:owner",
	});
	const historicalOid = oid("1".repeat(objectFormat === "sha1" ? 40 : 64), objectFormat);
	const retirementOperations = options.omitRetirementTrace
		? []
		: [
			createChangeTraceOperation({
				operationId: "op:retirement:proposed",
				kind: "change.proposed",
				authorityBearing: true,
				actorId: "actor:migration:owner",
				authorityId: "authority:migration:owner",
				occurredAt: "2026-08-27T16:00:00.100Z",
				payload: {
					expectedCanonical: historicalOid,
					intent: "Preserve accepted legacy retirement.",
					rationale: "Retired identity must remain reserved.",
					desiredOutcomes: ["Legacy retirement remains replayable."],
					authorityIntent: ["project.change.accept"],
					relatedChangeIds: [],
					compensatesChangeIds: [],
					supersedesChangeIds: [],
					targetRefs: ["cw:demo:item:retired-policy"],
					completionRequirements: [],
					completionRationale: "Accepted retirement needs no realization work.",
				},
			}),
			...[
				["op:retirement:running", "decision.running", "2026-08-27T16:00:00.200Z"],
				["op:retirement:passed", "decision.passed", "2026-08-27T16:00:00.300Z"],
				["op:retirement:confirmed", "confirmation.recorded", "2026-08-27T16:00:00.400Z"],
			].map(([operationId, kind, occurredAt]) => createChangeTraceOperation({
				operationId,
				kind,
				authorityBearing: true,
				actorId: "actor:migration:owner",
				authorityId: "authority:migration:owner",
				occurredAt,
				payload: {},
			})),
			createChangeTraceOperation({
				operationId: "op:retirement:accepted",
				kind: "change.accepted",
				authorityBearing: true,
				actorId: "actor:migration:owner",
				authorityId: "authority:migration:owner",
				occurredAt: "2026-08-27T16:00:00.500Z",
				payload: {
					expectedCanonical: historicalOid,
					proposalCommit: historicalOid,
					proposalTip: historicalOid,
					decisionId: "decision:legacy-retirement",
					gateId: "gate:legacy-retirement",
					confirmationId: "confirmation:legacy-retirement",
					acceptedItemIds: [],
					retiredItemIds: ["cw:demo:item:retired-policy"],
					completionRequirements: [],
					completionState: "completed",
				},
			}),
		];
	await write(
		root,
		changeTracePath("CHG-old"),
		serializeChangeTrace(convertedHeader, retirementOperations),
	);
	const migrationHeader = createChangeTraceHeader({
		changeId: plan.migrationChangeId,
		projectId: plan.projectId,
		repositoryId: profile.repositoryId,
		objectFormat,
		createdAt: "2026-08-27T16:00:01.000Z",
		createdBy: "actor:migration:owner",
	});
	const migrationTracePath = changeTracePath(plan.migrationChangeId);
	await write(root, migrationTracePath, serializeChangeTrace(migrationHeader, []));
	const convertedActiveHeader = createChangeTraceHeader({
		changeId: activeChangeId,
		projectId: plan.projectId,
		repositoryId: profile.repositoryId,
		objectFormat,
		createdAt: "2026-08-27T16:00:03.000Z",
		createdBy: "actor:migration:owner",
	});
	await write(
		root,
		changeTracePath(activeChangeId),
		serializeChangeTrace(convertedActiveHeader, []),
	);
	if (options.outOfScope) await write(root, "README.md", "target project\n");
	await git(root, "add", "-A");
	const stagedRootTree = await git(root, "write-tree");
	const wikiItemsTreeOid = plan.items.length === 0
		? null
		: oid(
			await git(root, "rev-parse", `${stagedRootTree}:.codewiki/wiki/items`),
			objectFormat,
		);
	const itemBlobOids = Object.fromEntries(await Promise.all(plan.items.map(async ({path}) => [
		path,
		oid(await git(root, "rev-parse", `:${path}`), objectFormat),
	])));
	const receiptItemBlobOids = structuredClone(itemBlobOids);
	if (options.wrongObjectReceipt) {
		receiptItemBlobOids[plan.items[0].path] = oid(
			"0".repeat(objectFormat === "sha1" ? 40 : 64),
			objectFormat,
		);
	}
	const convertedTraceBlobOids = Object.fromEntries(await Promise.all([
		changeTracePath("CHG-old"),
		changeTracePath(activeChangeId),
	].map(async (path) => [path, oid(await git(root, "rev-parse", `:${path}`), objectFormat)])));
	const migrationTracePreOperationBlobOid = oid(
		await git(root, "rev-parse", `:${migrationTracePath}`),
		objectFormat,
	);
	const proposalPayload = {
		intent: "Preserve active legacy Change through migration.",
		rationale: "Active intent must remain represented.",
		desiredOutcomes: ["Active Change remains available."],
		authorityIntent: ["project.change.propose"],
		relatedChangeIds: [],
		compensatesChangeIds: [],
		supersedesChangeIds: [],
		targetRefs: ["cw:demo:item:architecture"],
		completionRequirements: [],
		completionRationale: "Legacy unresolved intent remains explicit.",
	};
	const activeRetirementPath = options.activeRetirement
		? plan.items.find(({sourceId}) => sourceId === "product/policy.md")?.path
		: undefined;
	if (options.activeRetirement && activeRetirementPath === undefined) {
		throw new Error("Active retirement fixture target is missing.");
	}
	const activeChangePlan = {
		changeId: activeChangeId,
		expectedManagedRef: `refs/codewiki/changes/${activeChangeId}`,
		proposalOperation: {
			operationId: "op:active:proposed",
			actorId: "actor:migration:owner",
			authorityId: "authority:migration:owner",
			occurredAt: "2026-08-27T16:00:04.000Z",
			payload: proposalPayload,
		},
		proposedWiki: activeRetirementPath === undefined
			? []
			: [{path: activeRetirementPath, bytes: null}],
		commit: {
			author: "CodeWiki Migration <migration@example.test> 1787846404 +0000",
			committer: "CodeWiki Migration <migration@example.test> 1787846404 +0000",
			message: options.wrongCommitPlan ? "different proposal\n" : "active proposal\n",
		},
	};
	const legacyEquivalence = createKbToWikiLegacyEquivalenceProof({plan, source: sourceInput});
	const receipt = createKbToWikiMigrationReceipt({
		plan,
		legacyEquivalence,
		kernelBuildDigest: plan.source.sourceBuildDigest,
		migrationImplementationDigest: plan.source.implementationDigest,
		wikiItemsTreeOid,
		itemBlobOids: receiptItemBlobOids,
		convertedTraceBlobOids,
		migrationTracePreOperationBlobOid,
		activeChangePlans: [activeChangePlan],
	});
	const applied = createChangeTraceOperation({
		operationId: "op:migration:applied",
		kind: "migration.applied",
		authorityBearing: true,
		actorId: "actor:migration:owner",
		authorityId: "authority:migration:owner",
		occurredAt: "2026-08-27T16:00:02.000Z",
		payload: {
			migrationId: plan.migrationId,
			migrationIntentDigest: plan.migrationIntentDigest,
			receiptDigest: options.wrongReceipt
				? `sha256:${"e".repeat(64)}`
				: receipt.receiptDigest,
		},
	});
	await write(
		root,
		migrationTracePath,
		serializeChangeTrace(migrationHeader, [applied]),
	);
	await git(root, "add", migrationTracePath);
	await git(root, "commit", "-q", "--no-gpg-sign", "-m", "migration candidate");
	const candidate = await git(root, "rev-parse", "HEAD");
	await git(root, "checkout", "-q", "--detach", candidate);
	await git(root, "update-ref", "refs/heads/main", source, candidate);
	if (activeRetirementPath !== undefined) {
		await rm(join(root, activeRetirementPath));
	}
	const activeHeader = createChangeTraceHeader({
		changeId: activeChangeId,
		projectId: plan.projectId,
		repositoryId: profile.repositoryId,
		objectFormat,
		createdAt: options.rewriteActivePrefix
			? "2026-08-27T16:00:05.000Z"
			: "2026-08-27T16:00:03.000Z",
		createdBy: "actor:migration:owner",
	});
	const proposed = createChangeTraceOperation({
		operationId: "op:active:proposed",
		kind: "change.proposed",
		authorityBearing: true,
		actorId: "actor:migration:owner",
		authorityId: "authority:migration:owner",
		occurredAt: "2026-08-27T16:00:04.000Z",
		payload: {
			...proposalPayload,
			expectedCanonical: oid(
				options.wrongActiveBase ? source : candidate,
				objectFormat,
			),
		},
	});
	await write(
		root,
		changeTracePath(activeChangeId),
		serializeChangeTrace(activeHeader, [proposed]),
	);
	await git(root, "add", "-A");
	await git(root, "commit", "-q", "--no-gpg-sign", "-m", "active proposal");
	const proposal = await git(root, "rev-parse", "HEAD");
	const input = {
		repoRoot: root,
		profile,
		plan,
		legacySource: sourceInput,
		candidateCommit: oid(candidate, objectFormat),
		receipt,
		activeManagedRefs: [{
			changeId: activeChangeId,
			proposalCommit: oid(proposal, objectFormat),
		}],
	};
	return {root, source, candidate, proposal, input};
}

describe("KB-to-Wiki Git migration", () => {
	it("validates exact candidate ancestry, roots, Items, traces, Receipt, and active proposals", async () => {
		const value = await fixture();
		const validation = await validateKbToWikiMigrationCommit(value.input);
		assert.equal(validation.sourceCommit.hex, value.source);
		assert.equal(validation.candidateCommit.hex, value.candidate);
		assert.equal(validation.wiki.entries.length, value.input.plan.items.length);
		assert.equal(Object.keys(validation.itemBlobOids).length, value.input.plan.items.length);
		assert.equal(Object.keys(validation.changeTraceBlobOids).length, 3);
		assert.equal(await inspectKbToWikiMigrationActivation(value.input), "not_activated");
	});

	it("preserves frozen SHA-256 repository object identity through activation", async () => {
		const value = await fixture({objectFormat: "sha256"});
		const validation = await validateKbToWikiMigrationCommit(value.input);
		assert.equal(validation.candidateCommit.algorithm, "sha256");
		assert.equal(validation.candidateCommit.hex.length, 64);
		assert.ok(
			Object.values(validation.itemBlobOids).every(
				(itemOid) => itemOid.algorithm === "sha256" && itemOid.hex.length === 64,
			),
		);
		await activateKbToWikiMigrationRefsCas(value.input);
		assert.equal(await inspectKbToWikiMigrationActivation(value.input), "activated");
	});

	it("replays canonical legacy source before admitting Receipt evidence", async () => {
		const value = await fixture();
		const legacySource = structuredClone(value.input.legacySource);
		legacySource.subjects[0].body = "Fabricated source semantics.";
		await assert.rejects(
			() => validateKbToWikiMigrationCommit({...value.input, legacySource}),
			/does not exactly replay canonical legacy semantics/u,
		);
	});

	it("proves retirement mappings from converted terminal Trace evidence", async () => {
		const value = await fixture();
		await assert.doesNotReject(() => validateKbToWikiMigrationCommit(value.input));
		const activeRetirement = await fixture({activeRetirement: true});
		await assert.doesNotReject(() => validateKbToWikiMigrationCommit(activeRetirement.input));
		const missing = await fixture({omitRetirementTrace: true});
		await assert.rejects(
			() => validateKbToWikiMigrationCommit(missing.input),
			/retirement map does not match/u,
		);
	});

	it("atomically activates canonical and managed refs, then restores exact source", async () => {
		const value = await fixture();
		await activateKbToWikiMigrationRefsCas(value.input);
		assert.equal(await inspectKbToWikiMigrationActivation(value.input), "activated");
		assert.equal(await git(value.root, "rev-parse", "refs/heads/main"), value.candidate);
		assert.equal(
			await git(value.root, "rev-parse", `refs/codewiki/changes/${activeChangeId}`),
			value.proposal,
		);
		await assert.rejects(
			() => restoreKbToWikiMigrationSourceCas({
				...value.input,
				targetOnlyCanonicalOperationObserved: true,
			}),
			/forbidden after target-only/u,
		);
		await restoreKbToWikiMigrationSourceCas({
			...value.input,
			targetOnlyCanonicalOperationObserved: false,
		});
		assert.equal(await inspectKbToWikiMigrationActivation(value.input), "not_activated");
		assert.equal(await git(value.root, "rev-parse", "refs/heads/main"), value.source);
		assert.equal(await git(value.root, "rev-parse", value.input.plan.source.backupRef), value.source);
	});

	it("leaves canonical source authoritative when a ref race aborts transaction", async () => {
		const value = await fixture();
		const baseRunner = createGitCommandRunner();
		let injected = false;
		const runner = async (request) => {
			if (!injected && request.args.includes("update-ref") && request.args.includes("--stdin")) {
				injected = true;
				await git(
					value.root,
					"update-ref",
					`refs/codewiki/changes/${activeChangeId}`,
					value.source,
				);
			}
			return baseRunner(request);
		};
		await assert.rejects(
			() => activateKbToWikiMigrationRefsCas({...value.input, runner}),
			/ref transaction CAS failed/u,
		);
		assert.equal(await git(value.root, "rev-parse", "refs/heads/main"), value.source);
		assert.equal(
			await git(value.root, "rev-parse", `refs/codewiki/changes/${activeChangeId}`),
			value.source,
		);
	});

	it("rejects stale canonical state and detects manually inconsistent recovery refs", async () => {
		const stale = await fixture();
		await git(stale.root, "update-ref", "refs/heads/main", stale.proposal, stale.source);
		await assert.rejects(
			() => activateKbToWikiMigrationRefsCas(stale.input),
			/canonical ref does not equal expected commit/u,
		);
		const inconsistent = await fixture();
		await git(
			inconsistent.root,
			"update-ref",
			"refs/heads/main",
			inconsistent.candidate,
			inconsistent.source,
		);
		await assert.rejects(
			() => inspectKbToWikiMigrationActivation(inconsistent.input),
			/inconsistent or partially applied/u,
		);
	});

	it("fails closed for dual roots, altered Items, wrong Receipts, symbolic Items, and unrelated edits", async () => {
		for (const [options, pattern] of [
			[{keepLegacy: true}, /retains active legacy/u],
			[{tamperWiki: true}, /does not match dry-run plan/u],
			[{wrongReceipt: true}, /does not bind exact migration intent and Receipt/u],
			[{wrongObjectReceipt: true}, /Git objects do not match canonical Receipt/u],
			[{symbolicWiki: true}, /ordinary Git blobs/u],
			[{outOfScope: true}, /out-of-scope path README\.md/u],
			[{rewriteActivePrefix: true}, /append exact converted Trace bytes/u],
			[{wrongActiveBase: true}, /semantics do not match/u],
			[{wrongCommitPlan: true}, /commit inputs do not match/u],
			[{wrongConvertedHeader: true}, /path and header Change identity disagree/u],
		]) {
			const value = await fixture(options);
			await assert.rejects(() => validateKbToWikiMigrationCommit(value.input), pattern);
		}
	});
});
