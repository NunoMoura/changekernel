import {
	assertSha256Digest,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const EXTERNAL_CANDIDATE_CAPTURE_PROTOCOL = Object.freeze({
	id: "codewiki.external-candidate-capture",
	version: "1.0.0",
	maxChangedPaths: 256,
} as const);

export interface ExternalCandidateCapture {
	readonly protocolId: typeof EXTERNAL_CANDIDATE_CAPTURE_PROTOCOL.id;
	readonly protocolVersion: typeof EXTERNAL_CANDIDATE_CAPTURE_PROTOCOL.version;
	readonly captureId: string;
	readonly actorId: string;
	readonly clientInstanceId: string;
	readonly authenticationRef: string;
	readonly repositoryIdentity: Sha256Digest;
	readonly sourceCommit: string;
	readonly sourceTree: string;
	readonly baseTree: string;
	readonly changedPaths: readonly string[];
	readonly capturedAt: string;
	readonly captureDigest: Sha256Digest;
}

export interface ExternalCandidateIntentBinding {
	readonly changeRevisionId: Sha256Digest;
	readonly workGraphDeltaId: Sha256Digest;
	readonly workUnitId: string;
	readonly workUnitDigest: Sha256Digest;
	readonly expectedBaseTree: string;
	readonly allowedScopes: readonly string[];
	readonly expectedWorkStateDigest: Sha256Digest;
}

export interface ExternalCandidateAdmission {
	readonly captureDigest: Sha256Digest;
	readonly disposition: "candidate_admission" | "change_intake";
	readonly reasons: readonly string[];
	readonly intentBinding?: ExternalCandidateIntentBinding;
	readonly admissionDigest: Sha256Digest;
}

/** Capture observed Git bytes without upgrading external-client provenance. */
export function createExternalCandidateCapture(input: Omit<ExternalCandidateCapture,
	"protocolId" | "protocolVersion" | "captureDigest"
>): ExternalCandidateCapture {
	const changedPaths = normalizedPaths(input.changedPaths);
	if (changedPaths.length > EXTERNAL_CANDIDATE_CAPTURE_PROTOCOL.maxChangedPaths) {
		throw new Error("External Candidate Capture exceeds changed-path limit.");
	}
	assertSha256Digest(input.repositoryIdentity, "External Candidate repository identity");
	const body = {
		protocolId: EXTERNAL_CANDIDATE_CAPTURE_PROTOCOL.id,
		protocolVersion: EXTERNAL_CANDIDATE_CAPTURE_PROTOCOL.version,
		captureId: identifier(input.captureId, "External Candidate capture ID"),
		actorId: identifier(input.actorId, "External Candidate actor ID"),
		clientInstanceId: identifier(input.clientInstanceId, "External Candidate Client instance ID"),
		authenticationRef: identifier(input.authenticationRef, "External Candidate authentication ref"),
		repositoryIdentity: input.repositoryIdentity,
		sourceCommit: gitObject(input.sourceCommit, "External Candidate source commit"),
		sourceTree: gitObject(input.sourceTree, "External Candidate source tree"),
		baseTree: gitObject(input.baseTree, "External Candidate base tree"),
		changedPaths: Object.freeze(changedPaths),
		capturedAt: timestamp(input.capturedAt, "External Candidate capture time"),
	};
	return Object.freeze({...body, captureDigest: canonicalJsonDigest(body)});
}

/** Route exact in-scope captures to Candidate admission; all others to Intake. */
export function admitExternalCandidateCapture(input: {
	readonly capture: ExternalCandidateCapture;
	readonly intent?: ExternalCandidateIntentBinding;
}): ExternalCandidateAdmission {
	assertExternalCandidateCapture(input.capture);
	const reasons: string[] = [];
	const intent = input.intent ? normalizeIntent(input.intent) : undefined;
	if (intent) {
		if (input.capture.baseTree !== intent.expectedBaseTree) reasons.push("base_tree_mismatch");
		for (const path of input.capture.changedPaths) {
			if (!intent.allowedScopes.some((scope) => pathMatchesScope(path, scope))) {
				reasons.push(`path_out_of_scope:${path}`);
			}
		}
	} else reasons.push("accepted_intent_missing");
	const disposition = reasons.length === 0 ? "candidate_admission" : "change_intake";
	const body = {
		captureDigest: input.capture.captureDigest,
		disposition,
		reasons: Object.freeze([...new Set(reasons)].sort(compareText)),
		...(disposition === "candidate_admission" && intent ? {intentBinding: intent} : {}),
	} as const;
	return Object.freeze({...body, admissionDigest: canonicalJsonDigest(body)});
}

export function assertExternalCandidateCapture(value: ExternalCandidateCapture): void {
	if (value.protocolId !== EXTERNAL_CANDIDATE_CAPTURE_PROTOCOL.id ||
		value.protocolVersion !== EXTERNAL_CANDIDATE_CAPTURE_PROTOCOL.version) {
		throw new Error("External Candidate Capture protocol binding is invalid.");
	}
	const {captureDigest, ...body} = value;
	assertSha256Digest(captureDigest, "External Candidate Capture digest");
	if (canonicalJsonDigest(body) !== captureDigest) {
		throw new Error("External Candidate Capture digest is invalid.");
	}
	createExternalCandidateCapture(body);
}

function normalizeIntent(value: ExternalCandidateIntentBinding): ExternalCandidateIntentBinding {
	for (const [field, digest] of [
		["Change revision", value.changeRevisionId],
		["Work Graph delta", value.workGraphDeltaId],
		["Work Unit", value.workUnitDigest],
		["WorkState", value.expectedWorkStateDigest],
	] as const) assertSha256Digest(digest, `External Candidate ${field} digest`);
	const allowedScopes = normalizedPaths(value.allowedScopes);
	if (allowedScopes.length === 0) throw new Error("External Candidate intent requires an allowed scope.");
	return Object.freeze({
		changeRevisionId: value.changeRevisionId,
		workGraphDeltaId: value.workGraphDeltaId,
		workUnitId: identifier(value.workUnitId, "External Candidate Work Unit ID"),
		workUnitDigest: value.workUnitDigest,
		expectedBaseTree: gitObject(value.expectedBaseTree, "External Candidate expected base tree"),
		allowedScopes: Object.freeze(allowedScopes),
		expectedWorkStateDigest: value.expectedWorkStateDigest,
	});
}

function normalizedPaths(values: readonly string[]): string[] {
	if (!Array.isArray(values)) throw new Error("External Candidate paths are invalid.");
	return [...new Set(values.map((value) => {
		if (typeof value !== "string" || value.length === 0 || value.length > 512 ||
			value.startsWith("/") || value.includes("\\") || value.split("/").some((part) => part === "" || part === "." || part === "..")) {
			throw new Error("External Candidate path is invalid.");
		}
		return value;
	}))].sort(compareText);
}

function pathMatchesScope(path: string, scope: string): boolean {
	return path === scope || path.startsWith(scope.endsWith("/") ? scope : `${scope}/`);
}

function identifier(value: unknown, field: string): string {
	if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function gitObject(value: unknown, field: string): string {
	if (typeof value !== "string" || !/^[a-f0-9]{40,64}$/u.test(value)) throw new Error(`${field} is invalid.`);
	return value;
}

function compareText(left: string, right: string): number {
	return left.localeCompare(right);
}

function timestamp(value: unknown, field: string): string {
	if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}
