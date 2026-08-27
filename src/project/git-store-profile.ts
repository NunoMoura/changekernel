import {assertNfcString} from "../utils/semantic-digest.ts";
import {
	assertRequiredExactKeys as assertExactKeys,
	plainRecord as record,
} from "../utils/json.ts";

export const GIT_STORE_PROFILE_PROTOCOL =
	"codewiki.git-store-profile@1.0.0" as const;

export type GitObjectFormat = "sha1" | "sha256";

export interface GitOid {
	readonly algorithm: GitObjectFormat;
	readonly hex: string;
}

export interface GitStoreProfile {
	readonly protocol: typeof GIT_STORE_PROFILE_PROTOCOL;
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly canonicalRef: string;
}

export interface GitBoundWikiIdentity {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly commit: GitOid;
	readonly kernelBuildId?: string;
}

export function createGitStoreProfile(input: {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly canonicalRef: string;
}): GitStoreProfile {
	const profile: GitStoreProfile = {
		protocol: GIT_STORE_PROFILE_PROTOCOL,
		repositoryId: input.repositoryId,
		objectFormat: input.objectFormat,
		canonicalRef: input.canonicalRef,
	};
	assertGitStoreProfile(profile);
	return Object.freeze(profile);
}

export function assertGitStoreProfile(
	value: unknown,
): asserts value is GitStoreProfile {
	const profile = record(value, "Git store profile");
	assertExactKeys(profile, [
		"canonicalRef",
		"objectFormat",
		"protocol",
		"repositoryId",
	]);
	if (profile.protocol !== GIT_STORE_PROFILE_PROTOCOL) {
		throw new Error(
			`Git store profile protocol must be ${GIT_STORE_PROFILE_PROTOCOL}.`,
		);
	}
	assertStableId(profile.repositoryId, "repositoryId");
	assertGitObjectFormat(profile.objectFormat);
	assertCanonicalRef(profile.canonicalRef);
}

export function assertGitObjectFormat(
	value: unknown,
): asserts value is GitObjectFormat {
	if (value !== "sha1" && value !== "sha256") {
		throw new Error("Git object format must be sha1 or sha256.");
	}
}

export function assertGitOid(
	value: unknown,
	field = "Git OID",
	expectedFormat?: GitObjectFormat,
): asserts value is GitOid {
	const oid = record(value, field);
	assertExactKeys(oid, ["algorithm", "hex"]);
	assertGitObjectFormat(oid.algorithm);
	if (expectedFormat !== undefined && oid.algorithm !== expectedFormat) {
		throw new Error(`${field} must use ${expectedFormat}.`);
	}
	const valid = oid.algorithm === "sha1"
		? typeof oid.hex === "string" && /^[0-9a-f]{40}$/u.test(oid.hex)
		: typeof oid.hex === "string" && /^[0-9a-f]{64}$/u.test(oid.hex);
	if (!valid) {
		const length = oid.algorithm === "sha1" ? 40 : 64;
		throw new Error(`${field}.hex must contain ${length} lowercase hex characters.`);
	}
}

export function createGitBoundWikiIdentity(input: {
	readonly profile: GitStoreProfile;
	readonly commit: GitOid;
	readonly kernelBuildId?: string;
}): GitBoundWikiIdentity {
	assertGitStoreProfile(input.profile);
	assertGitOid(input.commit, "commit", input.profile.objectFormat);
	const identity = {
		repositoryId: input.profile.repositoryId,
		objectFormat: input.profile.objectFormat,
		commit: Object.freeze({...input.commit}),
	};
	if (input.kernelBuildId === undefined) return Object.freeze(identity);
	assertStableId(input.kernelBuildId, "kernelBuildId");
	return Object.freeze({...identity, kernelBuildId: input.kernelBuildId});
}

export function assertCanonicalRef(value: unknown): asserts value is string {
	assertNfcString(value, "canonicalRef", 6, 1024);
	if (
		!value.startsWith("refs/") ||
		value.endsWith("/") ||
		value.endsWith(".") ||
		value.includes("//") ||
		value.includes("..") ||
		value.includes("@{") ||
		value === "@" ||
		/[\u0000-\u0020\u007f~^:?*[\\]/u.test(value)
	) {
		throw new Error("canonicalRef must be a valid full Git ref name.");
	}
	for (const component of value.split("/")) {
		if (
			component.length === 0 ||
			component.startsWith(".") ||
			component.endsWith(".lock")
		) {
			throw new Error("canonicalRef must be a valid full Git ref name.");
		}
	}
}

export function assertStableId(value: unknown, field: string): asserts value is string {
	assertNfcString(value, field, 1, 256);
	if (/\s|[\u0000-\u001f\u007f]/u.test(value)) {
		throw new Error(`${field} must not contain whitespace or controls.`);
	}
}
