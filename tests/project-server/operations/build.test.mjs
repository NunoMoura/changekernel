import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
	assertBackendBuildBinding,
	BACKEND_BUILD_PROTOCOL,
	createBackendBuildBinding,
	DEFAULT_BACKEND_BUILD,
	DSH_BROKER_HOST_PROFILE_CLOSURE_DIGEST,
	DSH_MANAGED_PROFILE_CLOSURE_DIGEST,
} from "../../../src/project-server/operations/build.ts";
import {DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS} from "../../../src/runtime/dsh/broker-plugins.ts";
import {DSH_MANAGED_EXECUTABLE_ADMISSIONS} from "../../../src/runtime/dsh/managed-loader.ts";
import {canonicalJsonDigest} from "../../../src/utils/canonical-json.ts";

const DIGEST = `sha256:${"a".repeat(64)}`;

test("default Backend Build binds package, DSH profiles, Domain closure, schemas, and protocols", async () => {
	assert.equal(DEFAULT_BACKEND_BUILD.protocol.id, BACKEND_BUILD_PROTOCOL.id);
	assert.equal(DEFAULT_BACKEND_BUILD.packageName, "@nunomoura/codewiki");
	assert.equal(
		DEFAULT_BACKEND_BUILD.packageLockDigest,
		`sha256:${createHash("sha256").update(await readFile("package-lock.json")).digest("hex")}`,
	);
	assert.deepEqual(
		DEFAULT_BACKEND_BUILD.dshProfiles.map(({id}) => id),
		["codewiki.dsh.broker-host", "codewiki.dsh.managed-run"],
	);
	assert.deepEqual(
		DEFAULT_BACKEND_BUILD.domainPlugins.map(({pluginId}) => pluginId),
		["codewiki.domain.software-development"],
	);
	assert.equal(
		DEFAULT_BACKEND_BUILD.fileSchemas.some(
			({id, version}) => id === "codewiki.backend-state" && version === "1.0.0",
		),
		true,
	);
	assert.equal(
		canonicalJsonDigest(DSH_MANAGED_EXECUTABLE_ADMISSIONS),
		DSH_MANAGED_PROFILE_CLOSURE_DIGEST,
	);
	assert.equal(
		canonicalJsonDigest(DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS),
		DSH_BROKER_HOST_PROFILE_CLOSURE_DIGEST,
	);
	assertBackendBuildBinding(DEFAULT_BACKEND_BUILD);
});

test("Backend Build identity is canonical and rejects tampering", () => {
	const input = {
		packageVersion: "9.0.0",
		packageLockDigest: DIGEST,
		dshProfiles: [{id: "profile.z", version: "1.0.0", closureDigest: DIGEST}],
		domainPlugins: [{
			pluginId: "domain.z",
			pluginVersion: "1.0.0",
			admissionDigest: DIGEST,
			identityDigest: DIGEST,
		}],
		fileSchemas: [{id: "schema.z", version: "1.0.0"}],
		protocols: [{id: "protocol.z", version: "1.0.0"}],
	};
	const first = createBackendBuildBinding(input);
	const second = createBackendBuildBinding(input);
	assert.equal(first.backendBuildDigest, second.backendBuildDigest);
	assert.throws(
		() => assertBackendBuildBinding({...first, packageVersion: "9.0.1"}),
		/Backend Build binding digest or shape is invalid/,
	);
	assert.throws(
		() => createBackendBuildBinding({...input, protocols: [...input.protocols, input.protocols[0]]}),
		/Backend protocol id must be unique/,
	);
});
