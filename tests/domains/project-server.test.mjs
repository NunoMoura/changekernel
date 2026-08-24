import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
	createDomainProjectServerContribution,
	pathMatchesPattern,
	projectServerContributionForDomain,
	SOFTWARE_DEVELOPMENT_PROJECT_SERVER_CONTRIBUTION,
} from "../../src/domains/project-server.ts";
import {DEFAULT_DOMAIN_PLUGIN_IDENTITY} from "../../src/domains/defaults.ts";

const sourceRealization =
	SOFTWARE_DEVELOPMENT_PROJECT_SERVER_CONTRIBUTION.sourceRealization;

describe("Domain Project Server contribution", () => {
	it("binds software source meaning behind exact admitted Domain identity", () => {
		const contribution = projectServerContributionForDomain(
			DEFAULT_DOMAIN_PLUGIN_IDENTITY,
		);
		assert.equal(
			contribution.domainPlugin.identityDigest,
			DEFAULT_DOMAIN_PLUGIN_IDENTITY.identityDigest,
		);
		assert.equal(pathMatchesPattern("src/a.ts", "src/**"), true);
		assert.equal(Object.isFrozen(contribution), true);
		assert.equal(Object.isFrozen(contribution.sourceRealization), true);
	});

	it("rejects unbound contributions and foreign Domain identities", () => {
		assert.throws(
			() => createDomainProjectServerContribution({
				domainPlugin: DEFAULT_DOMAIN_PLUGIN_IDENTITY,
				sourceRealization: {...sourceRealization, pathMatchesPattern: null},
			}),
			/pathMatchesPattern is missing/,
		);
		const foreign = {
			...DEFAULT_DOMAIN_PLUGIN_IDENTITY,
			pluginId: "codewiki.domain.foreign",
		};
		assert.throws(
			() => projectServerContributionForDomain(foreign),
			/identity digest or shape is invalid/,
		);
	});
});
