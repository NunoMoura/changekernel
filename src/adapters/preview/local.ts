import {createEvidenceReference, type EvidenceAuthority} from "../../kernel/evidence/reference.ts";
import {failure, success, type Outcome} from "../../kernel/canonical/outcome.ts";
import {semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import {sha256Digest} from "../../kernel/identity/sha256.ts";
import type {GitOid} from "../../kernel/identity/git.ts";
import {
	createPreviewObservation,
	decodePreviewSubject,
	PREVIEW_PORT,
	previewRequestDigest,
	type PreviewIssue,
	type PreviewObservation,
	type PreviewPort,
	type PreviewRequest,
	type PreviewSubject,
} from "../../ports/preview.ts";

export const LOCAL_PREVIEW_ADAPTER_PROTOCOL = Object.freeze({
	id: "codewiki.adapter.preview.local",
	version: "1.0.0",
} as const);

export interface PreviewProfileDefinition {
	readonly profileId: string;
	readonly command: readonly string[];
	readonly timeoutMs?: number;
	readonly maximumOutputBytes?: number;
}

export type PreviewProcessRunner = (
	command: readonly string[],
	options: Readonly<{
		timeoutMs: number;
		maximumOutputBytes: number;
		signal?: AbortSignal;
	}>,
) => Promise<Readonly<{stdout: string; stderr: string; exitCode: number}>>;

export interface LocalPreviewAdapterOptions {
	readonly profiles: readonly PreviewProfileDefinition[];
	readonly runner?: PreviewProcessRunner;
	readonly observerProducerId?: string;
	readonly maximumConcurrentLeases?: number;
	readonly defaultLeaseTtlMs?: number;
	readonly clock?: () => string;
}

export interface LocalPreviewAdapterIssue {
	readonly code: "invalid_options";
	readonly message: string;
}

export interface LocalPreviewAdapter extends PreviewPort {
	readonly adapterProtocol: typeof LOCAL_PREVIEW_ADAPTER_PROTOCOL;
}

interface ActiveLease {
	readonly previewId: string;
	readonly capability: string;
	readonly generation: number;
	readonly expiresAtMs: number;
}

/**
 * Bounded local Preview adapter implementing PreviewPort.
 * Enforces profile-only execution, generation ordering, lease limits, and process custody.
 */
export function createLocalPreviewAdapter(
	options: LocalPreviewAdapterOptions,
): Outcome<LocalPreviewAdapter, LocalPreviewAdapterIssue> {
	if (typeof options !== "object" || options === null || !Array.isArray(options.profiles)) {
		return failure(adapterIssue("invalid_options", "Local Preview adapter options are malformed."));
	}
	const profileMap = new Map<string, PreviewProfileDefinition>();
	for (const profile of options.profiles) {
		if (typeof profile.profileId !== "string" || !Array.isArray(profile.command) || profile.command.length === 0) {
			return failure(adapterIssue("invalid_options", "Preview profile definition is invalid."));
		}
		profileMap.set(profile.profileId, profile);
	}
	const maxConcurrent = options.maximumConcurrentLeases ?? 4;
	const leaseTtlMs = options.defaultLeaseTtlMs ?? 30_000;
	const observerProducerId = options.observerProducerId ?? "cw:producer:preview-verifier";
	const clock = options.clock ?? systemTimestamp;
	const runner = options.runner ?? defaultProcessRunner;
	const leases = new Map<string, ActiveLease>();

	return success(Object.freeze({
		protocol: PREVIEW_PORT,
		adapterProtocol: LOCAL_PREVIEW_ADAPTER_PROTOCOL,
		async observe(request: PreviewRequest): Promise<Outcome<PreviewObservation, PreviewIssue>> {
			const expectedDigest = previewRequestDigest(request);
			if (!expectedDigest.ok || request.requestDigest !== expectedDigest.value) {
				return failure(previewIssue("invalid_subject", "Preview request digest mismatch."));
			}
			const decodedSubject = decodePreviewSubject(request.subject);
			if (!decodedSubject.ok) {
				return failure(previewIssue("invalid_subject", "Preview subject is malformed."));
			}
			const subject = decodedSubject.value;
			const profile = profileMap.get(subject.profileId);
			if (!profile) {
				return failure(previewIssue("environment_unavailable", `Preview profile ${subject.profileId} is not available.`));
			}

			const leaseKey = `${subject.previewId}:${subject.capability}`;
			const nowMs = Date.parse(clock());
			cleanExpiredLeases(leases, nowMs);

			const existingLease = leases.get(leaseKey);
			if (existingLease && existingLease.expiresAtMs > nowMs) {
				if (subject.generation < existingLease.generation) {
					return failure(previewIssue("stale_subject", "Preview request generation is stale."));
				}
			}

			if (leases.size >= maxConcurrent && !leases.has(leaseKey)) {
				return failure(previewIssue("environment_unavailable", "Preview lease capacity exceeded."));
			}

			leases.set(leaseKey, {
				previewId: subject.previewId,
				capability: subject.capability,
				generation: subject.generation,
				expiresAtMs: nowMs + leaseTtlMs,
			});

			const timeoutMs = profile.timeoutMs ?? 15_000;
			const maxBytes = profile.maximumOutputBytes ?? 1_048_576;
			const producerId = subject.capability === "preview.verify" ? observerProducerId : subject.producerId;

			try {
				const runResult = await runner(profile.command, {
					timeoutMs,
					maximumOutputBytes: maxBytes,
				});
				const status: "failed" | "passed" | "stopped" = runResult.exitCode === 0 ? "passed" : "failed";
				const rawOutput = `${runResult.stdout}\n${runResult.stderr}`;
				const outputDigest = sha256Digest(rawOutput);

				const receiptDigestResult = semanticDigest("codewiki.preview.receipt@1.0.0", {
					profileId: subject.profileId,
					previewSubjectDigest: subject.subjectDigest,
					exitCode: runResult.exitCode,
					outputDigest,
				});
				if (!receiptDigestResult.ok) {
					return failure(previewIssue("invalid_observation", receiptDigestResult.error.message));
				}
				const receiptDigest = receiptDigestResult.value;

				const authority: EvidenceAuthority = subject.capability === "preview.verify" ? "verified" : "observed";
				const evidence = createEvidenceReference({
					evidenceId: `cw:evidence:preview:${subject.previewId.replace(/^cw:preview:/u, "")}`,
					evidenceDigest: outputDigest,
					schema: {id: "codewiki.preview-evidence", version: "1.0.0"},
					mediaType: "text/plain",
					subjectDigest: subject.subjectDigest,
					subjectOids: subjectOids(subject),
					materialDigests: [subject.environmentDigest, subject.policyDigest],
					producerId,
					method: `preview.profile:${subject.profileId}`,
					receiptDigest,
					authority,
					coverage: "complete",
					freshness: "current",
					capturePolicy: "full_revision",
					retentionPolicy: "ttl",
					limitations: [],
				});
				if (!evidence.ok) {
					return failure(previewIssue("invalid_observation", evidence.error.message));
				}

				const observation = createPreviewObservation({
					previewSubjectDigest: subject.subjectDigest,
					capability: subject.capability,
					producerId,
					outputDigest,
					evidence: evidence.value,
					receiptDigest,
					status,
				});
				if (!observation.ok) {
					return failure(previewIssue("invalid_observation", observation.error.message));
				}
				return success(observation.value);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Preview process execution failed.";
				return failure(previewIssue("stopped", message));
			} finally {
				leases.delete(leaseKey);
			}
		},
	}));
}

function cleanExpiredLeases(leases: Map<string, ActiveLease>, nowMs: number): void {
	for (const [key, lease] of leases) {
		if (lease.expiresAtMs <= nowMs) leases.delete(key);
	}
}

function subjectOids(subject: PreviewSubject): readonly GitOid[] {
	return [subject.projectCommit, subject.projectTree, subject.changeTip, subject.artifactCommit, subject.artifactTree]
		.flatMap((entry) => entry === null ? [] : [entry])
		.sort(compareOid);
}

function compareOid(left: GitOid, right: GitOid): number {
	if (left.hex < right.hex) return -1;
	if (left.hex > right.hex) return 1;
	return 0;
}

const defaultProcessRunner: PreviewProcessRunner = async () => {
	throw new Error("Default process runner requires an explicit runner injection.");
};

function adapterIssue(code: LocalPreviewAdapterIssue["code"], message: string): LocalPreviewAdapterIssue {
	return Object.freeze({code, message});
}

function previewIssue(code: PreviewIssue["code"], message: string): PreviewIssue {
	return Object.freeze({code, message});
}

function systemTimestamp(): string {
	return new Date().toISOString();
}
