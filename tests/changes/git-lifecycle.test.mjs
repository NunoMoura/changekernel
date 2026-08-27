import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir, mkdtemp, rm, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";
import {afterEach, describe, it} from "node:test";
import {
	admitDispositionRefsCas,
	deriveWikiChange,
	managedChangeRef,
	updateManagedChangeRefCas,
	validateDispositionCommit,
	validateManagedChangeRef,
	validateProposalCommit,
} from "../../src/changes/git-lifecycle.ts";
import {
	appendChangeTraceOperation,
	createChangeTraceHeader,
	createChangeTraceOperation,
	serializeChangeTrace,
} from "../../src/changes/trace/semantic-kernel.ts";
import {createGitStoreProfile} from "../../src/project/git-store-profile.ts";
import {
	createWikiItem,
	serializeWikiItemFile,
} from "../../src/knowledge/wiki-item.ts";
import {validateWikiTree} from "../../src/knowledge/wiki-tree.ts";

const execute = promisify(execFile);
const roots = [];
const changeId = "CHG-git-lifecycle";
const tracePath = `.codewiki/changes/TRACE-${changeId}.jsonl`;
const wikiPath = ".codewiki/wiki/items/aa/item-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.md";

function oid(hex) {
	return {algorithm: "sha1", hex};
}

function timestamp(index) {
	return `2026-08-27T13:00:${String(index).padStart(2, "0")}.000Z`;
}

function operation(index, kind, payload = {}) {
	return createChangeTraceOperation({
		operationId: `op:git:${index}`,
		kind,
		authorityBearing: true,
		actorId: "actor:maintainer",
		authorityId: "authority:project-owner",
		occurredAt: timestamp(index),
		payload,
	});
}

async function git(root, ...args) {
	const result = await execute("git", args, {
		cwd: root,
		env: {
			...process.env,
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_TERMINAL_PROMPT: "0",
		},
	});
	return result.stdout.trim();
}

async function fixture({
	wiki = true,
	requirements = [],
	targetRefs = [],
	canonicalTraceMismatch = false,
} = {}) {
	const root = await mkdtemp(join(tmpdir(), "codewiki-kernel-git-"));
	roots.push(root);
	await git(root, "init", "-q", "-b", "main");
	await git(root, "config", "user.name", "CodeWiki Contract Test");
	await git(root, "config", "user.email", "codewiki@example.test");
	const profile = createGitStoreProfile({
		repositoryId: "cw:repository:git-lifecycle",
		objectFormat: "sha1",
		canonicalRef: "refs/heads/main",
	});
	const header = createChangeTraceHeader({
		changeId,
		projectId: "git-lifecycle",
		repositoryId: profile.repositoryId,
		objectFormat: "sha1",
		createdAt: timestamp(0),
		createdBy: "actor:maintainer",
	});
	await writeFile(join(root, "README.md"), "canonical\n");
	if (canonicalTraceMismatch) {
		await mkdir(join(root, tracePath, ".."), {recursive: true});
		const differentHeader = createChangeTraceHeader({
			...header,
			createdAt: timestamp(9),
		});
		await writeFile(join(root, tracePath), serializeChangeTrace(differentHeader, []));
	}
	await git(root, "add", ".");
	await git(root, "commit", "-q", "--no-gpg-sign", "-m", "canonical");
	const base = await git(root, "rev-parse", "HEAD");
	const proposed = operation(1, "change.proposed", {
		expectedCanonical: oid(base),
		intent: "Exercise universal Git lifecycle contracts.",
		rationale: "Native ancestry must carry proposal authority.",
		desiredOutcomes: ["Git lifecycle fixture validates."],
		authorityIntent: ["project.change.accept"],
		relatedChangeIds: [],
		compensatesChangeIds: [],
		supersedesChangeIds: [],
		targetRefs,
		completionRequirements: requirements,
		completionRationale:
			requirements.length === 0
				? "Meaning-only acceptance completes immediately."
				: "Frozen outcomes remain after acceptance.",
	});
	const proposalTrace = serializeChangeTrace(header, [proposed]);
	await mkdir(join(root, ".codewiki/changes"), {recursive: true});
	await writeFile(join(root, tracePath), proposalTrace);
	if (wiki) {
		await mkdir(join(root, wikiPath, ".."), {recursive: true});
		const wikiItem = createWikiItem({
			itemId: "cw:item:policy",
			itemType: "codewiki.policy",
			title: "Policy",
			body: "Policy.",
		});
		await writeFile(join(root, wikiPath), serializeWikiItemFile(wikiItem, "markdown"));
	}
	await git(root, "add", ".codewiki");
	await git(root, "commit", "-q", "--no-gpg-sign", "-m", "proposal");
	const proposal = await git(root, "rev-parse", "HEAD");
	await git(root, "checkout", "-q", "--detach", proposal);
	await git(root, "update-ref", "refs/heads/main", base, proposal);
	await git(root, "update-ref", managedChangeRef(changeId), proposal);
	return {root, base, profile, header, proposal, proposalTrace, proposed};
}

async function disposition(fixtureValue, kind, {wikiFromProposal = true, parents} = {}) {
	const bindings = {
		expectedCanonical: oid(fixtureValue.base),
		proposalCommit: oid(fixtureValue.proposal),
		proposalTip: oid(fixtureValue.proposal),
		decisionId: "decision:git-lifecycle",
		gateId: "gate:git-lifecycle",
		confirmationId: "confirmation:git-lifecycle",
	};
	const terminalPayload = kind === "accepted"
		? {
			...bindings,
			acceptedItemIds: ["cw:item:policy"],
			retiredItemIds: [],
			completionRequirements: [],
			completionState: "completed",
		}
		: {...bindings, reason: "Proposal not accepted."};
	const terminalOperations = [
		operation(2, "decision.running"),
		operation(3, "decision.passed"),
		operation(4, "confirmation.recorded"),
		operation(5, `change.${kind}`, terminalPayload),
	];
	const terminalTrace = serializeChangeTrace(fixtureValue.header, [
		operation(1, "change.proposed", {
			expectedCanonical: oid(fixtureValue.base),
			intent: "Exercise universal Git lifecycle contracts.",
			rationale: "Native ancestry must carry proposal authority.",
			desiredOutcomes: ["Git lifecycle fixture validates."],
			authorityIntent: ["project.change.accept"],
			relatedChangeIds: [],
			compensatesChangeIds: [],
			supersedesChangeIds: [],
			targetRefs: [],
			completionRequirements: [],
			completionRationale: "Meaning-only acceptance completes immediately.",
		}),
		...terminalOperations,
	]);
	if (!wikiFromProposal) await git(fixtureValue.root, "read-tree", fixtureValue.base);
	await writeFile(join(fixtureValue.root, tracePath), terminalTrace);
	await git(fixtureValue.root, "add", "--", tracePath);
	const tree = await git(fixtureValue.root, "write-tree");
	const orderedParents = parents ?? [fixtureValue.base, fixtureValue.proposal];
	return git(
		fixtureValue.root,
		"commit-tree",
		tree,
		"-p",
		orderedParents[0],
		"-p",
		orderedParents[1],
		"-m",
		kind,
	);
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

describe("native Change Git lifecycle", () => {
	it("validates proposal ancestry, managed ref, bounded paths, and accepted Wiki tree", async () => {
		const value = await fixture();
		const validation = await validateProposalCommit({
			repoRoot: value.root,
			profile: value.profile,
			changeId,
			proposalCommit: oid(value.proposal),
			expectedCanonical: oid(value.base),
		});
		assert.deepEqual(validation.changedWikiPaths, [wikiPath]);
		await validateManagedChangeRef({
			repoRoot: value.root,
			profile: value.profile,
			changeId,
			expectedTip: oid(value.proposal),
		});
		const accepted = await disposition(value, "accepted");
		await validateDispositionCommit({
			repoRoot: value.root,
			profile: value.profile,
			changeId,
			disposition: "accepted",
			dispositionCommit: oid(accepted),
			expectedCanonical: oid(value.base),
			proposalCommit: oid(value.proposal),
			expectedProposalTip: oid(value.proposal),
		});
	});

	it("rejects no-op proposals and reversed disposition ancestry", async () => {
		const noOp = await fixture({wiki: false});
		await assert.rejects(
			validateProposalCommit({
				repoRoot: noOp.root,
				profile: noOp.profile,
				changeId,
				proposalCommit: oid(noOp.proposal),
				expectedCanonical: oid(noOp.base),
			}),
			/invalid no-op/u,
		);
		const value = await fixture();
		const reversed = await disposition(value, "accepted", {
			parents: [value.proposal, value.base],
		});
		await assert.rejects(
			validateDispositionCommit({
				repoRoot: value.root,
				profile: value.profile,
				changeId,
				disposition: "accepted",
				dispositionCommit: oid(reversed),
				expectedCanonical: oid(value.base),
				proposalCommit: oid(value.proposal),
				expectedProposalTip: oid(value.proposal),
			}),
			/parents do not match/u,
		);
	});

	it("rejects schema-valid Traces with invalid authority lifecycle order", async () => {
		const value = await fixture();
		const malformedProposalTrace = serializeChangeTrace(value.header, [
			operation(0, "decision.running"),
			value.proposed,
		]);
		await writeFile(join(value.root, tracePath), malformedProposalTrace);
		await git(value.root, "add", "--", tracePath);
		await git(value.root, "commit", "-q", "--amend", "--no-gpg-sign", "-m", "malformed proposal");
		const malformedProposal = await git(value.root, "rev-parse", "HEAD");
		await assert.rejects(
			validateProposalCommit({
				repoRoot: value.root,
				profile: value.profile,
				changeId,
				proposalCommit: oid(malformedProposal),
				expectedCanonical: oid(value.base),
			}),
			/invalid while Change is empty/u,
		);

		const terminal = operation(2, "change.accepted", {
			expectedCanonical: oid(value.base),
			proposalCommit: oid(value.proposal),
			proposalTip: oid(value.proposal),
			decisionId: "decision:git-lifecycle",
			gateId: "gate:git-lifecycle",
			confirmationId: "confirmation:git-lifecycle",
			acceptedItemIds: ["cw:item:policy"],
			retiredItemIds: [],
			completionRequirements: [],
			completionState: "completed",
		});
		await writeFile(
			join(value.root, tracePath),
			serializeChangeTrace(value.header, [value.proposed, terminal]),
		);
		await git(value.root, "add", "--", tracePath);
		const tree = await git(value.root, "write-tree");
		const malformedDisposition = await git(
			value.root,
			"commit-tree",
			tree,
			"-p",
			value.base,
			"-p",
			value.proposal,
			"-m",
			"malformed disposition",
		);
		await assert.rejects(
			validateDispositionCommit({
				repoRoot: value.root,
				profile: value.profile,
				changeId,
				disposition: "accepted",
				dispositionCommit: oid(malformedDisposition),
				expectedCanonical: oid(value.base),
				proposalCommit: oid(value.proposal),
				expectedProposalTip: oid(value.proposal),
			}),
			/invalid while Change is proposed/u,
		);
	});

	it("preserves an existing canonical Trace prefix in the first proposal", async () => {
		const rewritten = await fixture({canonicalTraceMismatch: true});
		await assert.rejects(
			validateProposalCommit({
				repoRoot: rewritten.root,
				profile: rewritten.profile,
				changeId,
				proposalCommit: oid(rewritten.proposal),
				expectedCanonical: oid(rewritten.base),
			}),
			/exact canonical Trace prefix/u,
		);
	});

	it("rejects accepted dispositions that omit proposed Wiki bytes", async () => {
		const value = await fixture();
		const wrongTree = await disposition(value, "accepted", {wikiFromProposal: false});
		await assert.rejects(
			validateDispositionCommit({
				repoRoot: value.root,
				profile: value.profile,
				changeId,
				disposition: "accepted",
				dispositionCommit: oid(wrongTree),
				expectedCanonical: oid(value.base),
				proposalCommit: oid(value.proposal),
				expectedProposalTip: oid(value.proposal),
			}),
			/wrong Wiki tree/u,
		);
	});

	it("derives a path move from stable Item identity without retirement", () => {
		const wikiItem = createWikiItem({
			itemId: "cw:item:moved-policy",
			itemType: "codewiki.policy",
			title: "Moved policy",
			body: "Identity survives path movement.",
		});
		const bytes = serializeWikiItemFile(wikiItem, "markdown");
		const before = validateWikiTree([{
			path: ".codewiki/wiki/items/old/policy.md",
			bytes,
		}]);
		const after = validateWikiTree([{
			path: ".codewiki/wiki/items/new/policy.md",
			bytes,
		}]);
		assert.deepEqual(deriveWikiChange(before, after), {
			changedItemIds: [wikiItem.itemId],
			retiredItemIds: [],
		});
	});

	it("validates later proposal ancestry and exact prior Trace prefix", async () => {
		const value = await fixture();
		const laterOperation = operation(6, "change.proposed", value.proposed.payload);
		const commitLater = async (trace, message) => {
			await writeFile(join(value.root, tracePath), trace);
			await git(value.root, "add", "--", tracePath);
			const tree = await git(value.root, "write-tree");
			return git(
				value.root,
				"commit-tree",
				tree,
				"-p",
				value.base,
				"-p",
				value.proposal,
				"-m",
				message,
			);
		};
		const validTrace = appendChangeTraceOperation(
			value.proposalTrace,
			laterOperation,
		);
		const validCommit = await commitLater(validTrace, "later proposal");
		await validateProposalCommit({
			repoRoot: value.root,
			profile: value.profile,
			changeId,
			proposalCommit: oid(validCommit),
			expectedCanonical: oid(value.base),
			expectedPriorProposal: oid(value.proposal),
		});
		const rewrittenTrace = serializeChangeTrace(value.header, [laterOperation]);
		const rewrittenCommit = await commitLater(rewrittenTrace, "rewritten proposal");
		await assert.rejects(
			validateProposalCommit({
				repoRoot: value.root,
				profile: value.profile,
				changeId,
				proposalCommit: oid(rewrittenCommit),
				expectedCanonical: oid(value.base),
				expectedPriorProposal: oid(value.proposal),
			}),
			/exact prior Trace prefix/u,
		);
	});

	it("creates managed refs by CAS and rejects stale expected tips", async () => {
		const value = await fixture();
		const ref = managedChangeRef(changeId);
		await git(value.root, "update-ref", "-d", ref, value.proposal);
		await updateManagedChangeRefCas({
			repoRoot: value.root,
			profile: value.profile,
			changeId,
			expectedTip: null,
			newTip: oid(value.proposal),
		});
		await assert.rejects(
			updateManagedChangeRefCas({
				repoRoot: value.root,
				profile: value.profile,
				changeId,
				expectedTip: oid(value.base),
				newTip: oid(value.base),
			}),
			/CAS failed/u,
		);
		assert.equal(await git(value.root, "rev-parse", "--verify", ref), value.proposal);
	});

	it("atomically advances canonical and retires managed ref by expected-old CAS", async () => {
		const value = await fixture();
		const accepted = await disposition(value, "accepted");
		const input = {
			repoRoot: value.root,
			profile: value.profile,
			changeId,
			disposition: "accepted",
			dispositionCommit: oid(accepted),
			expectedCanonical: oid(value.base),
			proposalCommit: oid(value.proposal),
			expectedProposalTip: oid(value.proposal),
		};
		await admitDispositionRefsCas(input);
		assert.equal(await git(value.root, "rev-parse", "refs/heads/main"), accepted);
		await assert.rejects(
			git(value.root, "rev-parse", "--verify", managedChangeRef(changeId)),
		);
		await assert.rejects(admitDispositionRefsCas(input), /Canonical ref does not match/u);
		assert.equal(await git(value.root, "rev-parse", "refs/heads/main"), accepted);
	});

	it("rejects stale canonical heads before proposal admission", async () => {
		const value = await fixture();
		await git(
			value.root,
			"update-ref",
			"refs/heads/main",
			value.proposal,
			value.base,
		);
		await assert.rejects(
			validateProposalCommit({
				repoRoot: value.root,
				profile: value.profile,
				changeId,
				proposalCommit: oid(value.proposal),
				expectedCanonical: oid(value.base),
			}),
			/Canonical ref does not match/u,
		);
	});

	it("rejects hostile symbolic Wiki entries before semantic parsing", async () => {
		const value = await fixture();
		await rm(join(value.root, wikiPath));
		await symlink("../../../../../README.md", join(value.root, wikiPath));
		await git(value.root, "add", "--", wikiPath);
		await git(value.root, "commit", "-q", "--amend", "--no-gpg-sign", "-m", "symbolic proposal");
		const symbolicProposal = await git(value.root, "rev-parse", "HEAD");
		await assert.rejects(
			validateProposalCommit({
				repoRoot: value.root,
				profile: value.profile,
				changeId,
				proposalCommit: oid(symbolicProposal),
				expectedCanonical: oid(value.base),
			}),
			/ordinary non-executable Git blobs/u,
		);
	});
});
