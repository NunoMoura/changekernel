import assert from "node:assert/strict";
import test from "node:test";

import {DEFAULT_BACKEND_BUILD} from "../../../src/project-server/operations/build.ts";
import {
	BACKEND_V1_RELEASE_EVIDENCE_NAMES,
	BACKEND_V1_RELEASE_MANIFEST_PROTOCOL,
	assertBackendV1ReleaseManifest,
	backendV1ContractFreezeDigest,
	createBackendV1ReleaseManifest,
} from "../../../src/project-server/operations/release.ts";
import {canonicalJson, sha256Digest} from "../../../src/utils/canonical-json.ts";

const SOURCE_REVISION = "a".repeat(40);
const CONTROLLER_REVISION = "b".repeat(40);

function releaseInput() {
	return {
		packageVersion: DEFAULT_BACKEND_BUILD.packageVersion,
		packageArtifactDigest: sha256Digest("candidate-package"),
		sourceRevision: SOURCE_REVISION,
		sourceTreeDigest: sha256Digest("candidate-tree"),
		backendBuild: DEFAULT_BACKEND_BUILD,
		runtimeProductionQualificationDigest: sha256Digest("runtime-production"),
		controller: {
			packageVersion: "0.3.0",
			packageArtifactDigest: sha256Digest("controller-package"),
			backendBuildDigest: sha256Digest("controller-build"),
			sourceRevision: CONTROLLER_REVISION,
		},
		dogfood: {
			subjectCandidateDigest: sha256Digest("subject-candidate"),
			protectedSourceHead: CONTROLLER_REVISION,
			checkPacks: [
				{stage: "review", checkPackDigest: sha256Digest("review-pack")},
				{stage: "decision", checkPackDigest: sha256Digest("decision-pack")},
				{stage: "implementation", checkPackDigest: sha256Digest("implementation-pack")},
				{stage: "planning", checkPackDigest: sha256Digest("planning-pack")},
			],
		},
		evidence: Object.fromEntries(
			BACKEND_V1_RELEASE_EVIDENCE_NAMES.map((name) => [name, sha256Digest(name)]),
		),
		qualifiedAt: "2026-09-01T12:00:00.000Z",
	};
}

test("Backend v1 Release Manifest freezes package, contracts, controller, policy, and evidence", () => {
	const manifest = createBackendV1ReleaseManifest(releaseInput());
	assert.deepEqual(manifest.protocol, BACKEND_V1_RELEASE_MANIFEST_PROTOCOL);
	assert.equal(manifest.channel, "release-candidate");
	assert.equal(
		manifest.contractFreezeDigest,
		backendV1ContractFreezeDigest(DEFAULT_BACKEND_BUILD),
	);
	assert.deepEqual(
		manifest.dogfood.checkPacks.map(({stage}) => stage),
		["decision", "implementation", "planning", "review"],
	);
	assertBackendV1ReleaseManifest(manifest);
	assert.doesNotMatch(canonicalJson(manifest), /Bearer\s|api[_-]?key|secret/i);
});

test("Backend v1 Release Manifest rejects package, contract, policy, and evidence drift", () => {
	const manifest = createBackendV1ReleaseManifest(releaseInput());
	assert.throws(
		() => createBackendV1ReleaseManifest({...releaseInput(), packageVersion: "0.3.1"}),
		/package version does not match Backend Build/,
	);
	assert.throws(
		() => assertBackendV1ReleaseManifest({...manifest, contractFreezeDigest: sha256Digest("drift")}),
		/digest or shape is invalid/,
	);
	assert.throws(
		() => createBackendV1ReleaseManifest({
			...releaseInput(),
			dogfood: {...releaseInput().dogfood, checkPacks: releaseInput().dogfood.checkPacks.slice(1)},
		}),
		/Check Pack bindings are incomplete/,
	);
	const {cleanup: _cleanup, ...incompleteEvidence} = releaseInput().evidence;
	assert.throws(
		() => createBackendV1ReleaseManifest({...releaseInput(), evidence: incompleteEvidence}),
		/qualification evidence is incomplete/,
	);
});
