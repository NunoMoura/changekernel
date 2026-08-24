import {
	assertDomainPluginIdentity,
	type DomainPluginIdentity,
} from "./contracts.ts";
import {SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY} from "./software-development/plugin.ts";
import {
	componentKbRefs as softwareComponentKbRefs,
	componentsForRefs as softwareComponentsForRefs,
	componentSupportsSourcePath as softwareComponentSupportsSourcePath,
	componentSupportsTestPath as softwareComponentSupportsTestPath,
	pathMatchesPattern as softwarePathMatchesPattern,
	sourceMapComponentById as softwareSourceMapComponentById,
	sourceMapComponentsForPath as softwareSourceMapComponentsForPath,
	sourceMapOwnerForPath as softwareSourceMapOwnerForPath,
	unknownComponentRefs as softwareUnknownComponentRefs,
	type SourceMapComponent,
	type SourceMapContract,
	type SourceMapDefaults,
	type SourceMapMarkdownEntry,
	type SourceMapValidationInput,
	type SourceMapValidationIssue,
	type SourceMapValidationIssueCode,
} from "./software-development/source-map.ts";
import {
	okfSourceOwnershipExtensionsFromBundle as softwareOkfSourceOwnershipExtensionsFromBundle,
	sourceOwnershipMapFromOkfBundle as softwareSourceOwnershipMapFromOkfBundle,
} from "./software-development/source-ownership.ts";

export type {
	SourceMapComponent,
	SourceMapContract,
	SourceMapDefaults,
	SourceMapMarkdownEntry,
	SourceMapValidationInput,
	SourceMapValidationIssue,
	SourceMapValidationIssueCode,
};

export interface DomainProjectServerContribution {
	readonly domainPlugin: DomainPluginIdentity;
	readonly sourceRealization: Readonly<{
		componentKbRefs: typeof softwareComponentKbRefs;
		componentsForRefs: typeof softwareComponentsForRefs;
		componentSupportsSourcePath: typeof softwareComponentSupportsSourcePath;
		componentSupportsTestPath: typeof softwareComponentSupportsTestPath;
		pathMatchesPattern: typeof softwarePathMatchesPattern;
		sourceMapComponentById: typeof softwareSourceMapComponentById;
		sourceMapComponentsForPath: typeof softwareSourceMapComponentsForPath;
		sourceMapOwnerForPath: typeof softwareSourceMapOwnerForPath;
		unknownComponentRefs: typeof softwareUnknownComponentRefs;
		sourceOwnershipExtensionsFromBundle:
			typeof softwareOkfSourceOwnershipExtensionsFromBundle;
		sourceOwnershipMapFromOkfBundle:
			typeof softwareSourceOwnershipMapFromOkfBundle;
	}>;
}

export function createDomainProjectServerContribution(input: {
	readonly domainPlugin: DomainPluginIdentity;
	readonly sourceRealization: DomainProjectServerContribution["sourceRealization"];
}): DomainProjectServerContribution {
	assertDomainPluginIdentity(input.domainPlugin);
	const required = [
		"componentKbRefs",
		"componentsForRefs",
		"componentSupportsSourcePath",
		"componentSupportsTestPath",
		"pathMatchesPattern",
		"sourceMapComponentById",
		"sourceMapComponentsForPath",
		"sourceMapOwnerForPath",
		"unknownComponentRefs",
		"sourceOwnershipExtensionsFromBundle",
		"sourceOwnershipMapFromOkfBundle",
	] as const;
	for (const name of required) {
		if (typeof input.sourceRealization[name] !== "function") {
			throw new Error(`Domain Project Server contribution ${name} is missing.`);
		}
	}
	return Object.freeze({
		domainPlugin: input.domainPlugin,
		sourceRealization: Object.freeze({...input.sourceRealization}),
	});
}

export const SOFTWARE_DEVELOPMENT_PROJECT_SERVER_CONTRIBUTION =
	createDomainProjectServerContribution({
		domainPlugin: SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY,
		sourceRealization: {
			componentKbRefs: softwareComponentKbRefs,
			componentsForRefs: softwareComponentsForRefs,
			componentSupportsSourcePath: softwareComponentSupportsSourcePath,
			componentSupportsTestPath: softwareComponentSupportsTestPath,
			pathMatchesPattern: softwarePathMatchesPattern,
			sourceMapComponentById: softwareSourceMapComponentById,
			sourceMapComponentsForPath: softwareSourceMapComponentsForPath,
			sourceMapOwnerForPath: softwareSourceMapOwnerForPath,
			unknownComponentRefs: softwareUnknownComponentRefs,
			sourceOwnershipExtensionsFromBundle:
				softwareOkfSourceOwnershipExtensionsFromBundle,
			sourceOwnershipMapFromOkfBundle: softwareSourceOwnershipMapFromOkfBundle,
		},
	});

export function projectServerContributionForDomain(
	identity: DomainPluginIdentity,
): DomainProjectServerContribution {
	assertDomainPluginIdentity(identity);
	if (
		identity.identityDigest !==
		SOFTWARE_DEVELOPMENT_PROJECT_SERVER_CONTRIBUTION.domainPlugin.identityDigest
	) {
		throw new Error(`Domain Plugin ${identity.pluginId} has no admitted Project Server contribution.`);
	}
	return SOFTWARE_DEVELOPMENT_PROJECT_SERVER_CONTRIBUTION;
}

const sourceRealization =
	SOFTWARE_DEVELOPMENT_PROJECT_SERVER_CONTRIBUTION.sourceRealization;

export const componentKbRefs = sourceRealization.componentKbRefs;
export const componentsForRefs = sourceRealization.componentsForRefs;
export const componentSupportsSourcePath = sourceRealization.componentSupportsSourcePath;
export const componentSupportsTestPath = sourceRealization.componentSupportsTestPath;
export const pathMatchesPattern = sourceRealization.pathMatchesPattern;
export const sourceMapComponentById = sourceRealization.sourceMapComponentById;
export const sourceMapComponentsForPath = sourceRealization.sourceMapComponentsForPath;
export const sourceMapOwnerForPath = sourceRealization.sourceMapOwnerForPath;
export const unknownComponentRefs = sourceRealization.unknownComponentRefs;
export const okfSourceOwnershipExtensionsFromBundle =
	sourceRealization.sourceOwnershipExtensionsFromBundle;
export const sourceOwnershipMapFromOkfBundle =
	sourceRealization.sourceOwnershipMapFromOkfBundle;
