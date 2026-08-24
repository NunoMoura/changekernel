import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const DSH_CLIENT_SLOT_QUALIFICATION_PROTOCOL = Object.freeze({
	id: "codewiki.dsh-client-slot-qualification",
	version: "1.0.0",
} as const);

export interface DshClientPackageQualification {
	readonly name: string;
	readonly version: "0.1.1-rc.2";
	readonly integrity: `sha512-${string}`;
}

export interface DshClientSlotQualification {
	readonly protocol: typeof DSH_CLIENT_SLOT_QUALIFICATION_PROTOCOL;
	readonly upstream: {
		readonly release: "0.1.1-rc.2";
		readonly tag: "dsh-v0.1.1-rc.2";
		readonly sourceCommit: "b150a551b8d465e31e418e1b2eaf5e79bbb7d28e";
		readonly sourceEquivalence: "unattested";
	};
	readonly packages: readonly DshClientPackageQualification[];
	readonly evidence: {
		readonly externalPackageLockDigest: Sha256Digest;
		readonly vulnerabilities: 0;
		readonly slotLifecycle: "passed";
		readonly undeclaredSlotRejection: "passed";
		readonly rawStorageHandleExposure: "absent";
	};
	readonly decisions: {
		readonly slotRegistry: "qualified";
		readonly layoutAndPrimitives: "qualified-for-client-composition";
		readonly stockWebProfile: "rejected-for-frontend-v1";
		readonly stockConnection: "rejected-no-authentication-layer";
		readonly stockProviderSettings: "rejected-wrong-authority-plane";
		readonly stockAuthorizationInteraction: "rejected-wrong-credential-authority";
	};
	readonly frontendSubstrate: {
		readonly host: "codewiki-authenticated-app-server";
		readonly reusableDshSurface: "client-slots-layout-primitives";
		readonly requiredBridge: "codewiki-frontend-api-client-plugin";
		readonly productImplementationAuthorized: false;
	};
	readonly qualificationDigest: Sha256Digest;
}

const PACKAGES = [
	["@deepseek-ai/dsh-authorization", "sha512-+ye7d4XzenQ4kpfY2nMIlUhoIbcprotL9fmkTBahafIPDhyyph0JzmUVhz1AGnkIqZc8TltjGzX2ssald+f+3A=="],
	["@deepseek-ai/dsh-client-connection", "sha512-YX2WLA/aZdDQsien4Zo7IHTEfYVJ+4QhRXbgA6BrRUM23NSP/+V3K00dQYyQVsF3ZwocE5uyvlZvbYeg1Iz4ug=="],
	["@deepseek-ai/dsh-client-modules", "sha512-D0vRgJJpMeTB4ExJTGHk9ay01kLxfK5zvp6bgFjYGlk9sBJgCE3qsOGBFNqD369ylJx4W2oyExAH9lOZGNk3Rw=="],
	["@deepseek-ai/dsh-client-runtime", "sha512-o1FH7Rlns0Xaxh4SBOWZ1wpa0ViGw6DXWNm5NFpsBTGYD94RGdIrud3QxgrfzmQKLzu33gvS8JL/IjqbzWyYsg=="],
	["@deepseek-ai/dsh-client-ui-layout", "sha512-y7xSQyQYGuahLyJcSXpB+JbH1F5lGEc3L9K8cjLy5vd/L9N6gLFLWyeGdlGxxM4jxRt1+rAHDDZ/zl7b8GC5zQ=="],
	["@deepseek-ai/dsh-client-ui-model-selection", "sha512-CEFpGeEL6gtz0jTRWEpHcEH1cBIwzY9023vWmgyjjcFDOcaKv3G324n+IXweHDttbWGSKdtxfpi4FMOu14W3Og=="],
	["@deepseek-ai/dsh-client-ui-primitives", "sha512-vCWEha1yhY//26j/LppHC/xZrU6MOuw6lcI4bJr5L7ppbY8h7GAR24ozBr+4ESMtQ5OmsvqGnsa/Kj5ZjSLfEQ=="],
	["@deepseek-ai/dsh-client-ui-settings", "sha512-WqEQkyjW467leTJoA31BgqM+nALI3JnrvN1IXDhJuKd8E9nXhTLJcRgDrovEUkh2cjbHF8g8gQJ5Qafg9PzJiQ=="],
	["@deepseek-ai/dsh-client-ui-settings-models", "sha512-LfGTsbJpCNG0nhT9nBzUucVxnJ5tlY78i5JmlUEb3fwEFUM2cq9pmhv5sXWFdn3LOAnGr0QcyTm+08iBubc6zQ=="],
	["@deepseek-ai/dsh-client-ui-settings-plugins", "sha512-NspsecIb4YdvE54jmaGBW/MjFyuu/MwUjQeM/I9iAgMOpLO+jOsoCOT4M8Su1Nfy1bxokgks9XcBJOcNGjN4Vg=="],
	["@deepseek-ai/dsh-client-ui-slots", "sha512-6uBi+Wq+dH1Q8RaJpbK66TjzPlkcSNDWvNZgQXw45RRQCi1gnm/gxFOyJcSQvgqk4pvm2/h/aIvaM/Pa5PRFCA=="],
	["@deepseek-ai/dsh-client-web", "sha512-sFHacLKrGLN7f05rwfaa1pa5vt1udQoudXT45iN/jukejNMFh9P41m+4NryDlut9AploSEiAror/YhlaANNDfA=="],
	["@deepseek-ai/dsh-web-frontend", "sha512-1cjf39g6RW7cgtvwhIF6MSnp5sk3KYRkmRhZM4GETWLXCrTfMD0WCJr3yME1uvJsYPTk28XmKXwwMUPrO3kksQ=="],
] as const;

const QUALIFICATION_WITHOUT_DIGEST = {
	protocol: DSH_CLIENT_SLOT_QUALIFICATION_PROTOCOL,
	upstream: {
		release: "0.1.1-rc.2",
		tag: "dsh-v0.1.1-rc.2",
		sourceCommit: "b150a551b8d465e31e418e1b2eaf5e79bbb7d28e",
		sourceEquivalence: "unattested",
	},
	packages: PACKAGES.map(([name, integrity]) => ({
		name,
		version: "0.1.1-rc.2" as const,
		integrity,
	})),
	evidence: {
		externalPackageLockDigest:
			"sha256:418b3994695a0d0d4a2012362c7f68dc812c7cdabe989d24fcee57b8e46c4f06" as const,
		vulnerabilities: 0,
		slotLifecycle: "passed",
		undeclaredSlotRejection: "passed",
		rawStorageHandleExposure: "absent",
	},
	decisions: {
		slotRegistry: "qualified",
		layoutAndPrimitives: "qualified-for-client-composition",
		stockWebProfile: "rejected-for-frontend-v1",
		stockConnection: "rejected-no-authentication-layer",
		stockProviderSettings: "rejected-wrong-authority-plane",
		stockAuthorizationInteraction: "rejected-wrong-credential-authority",
	},
	frontendSubstrate: {
		host: "codewiki-authenticated-app-server",
		reusableDshSurface: "client-slots-layout-primitives",
		requiredBridge: "codewiki-frontend-api-client-plugin",
		productImplementationAuthorized: false,
	},
} as const;

export const DSH_CLIENT_SLOT_QUALIFICATION = deepFreeze({
	...QUALIFICATION_WITHOUT_DIGEST,
	qualificationDigest: canonicalJsonDigest(QUALIFICATION_WITHOUT_DIGEST),
}) as DshClientSlotQualification;

export function assertDshClientSlotQualification(
	value: unknown,
): DshClientSlotQualification {
	const normalized = toCanonicalJsonValue(value);
	if (
		JSON.stringify(normalized) !==
		JSON.stringify(toCanonicalJsonValue(DSH_CLIENT_SLOT_QUALIFICATION))
	) {
		throw new Error("DSH client-slot qualification is invalid or drifted.");
	}
	return DSH_CLIENT_SLOT_QUALIFICATION;
}

function deepFreeze<T>(value: T): T {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}
