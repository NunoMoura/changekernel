import {
	createKnowledgeCompilerIdentity,
	type KnowledgeCheckpoint,
	type KnowledgeCompilerIdentity,
} from "../knowledge/state.ts";
import {
	assertDomainPluginIdentity,
	domainPluginIdentity,
	type DomainPluginAdmission,
	type DomainPluginIdentity,
} from "./contracts.ts";
import {
	SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY,
	SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
} from "./software-development/plugin.ts";

const DOMAIN_COMPILER_RENDERERS = Object.freeze({
	markdownRenderer: "codewiki.markdown-splice/1.0.0",
	yamlRenderer: "codewiki.yaml-splice/1.0.0",
});

/** Derives exact deterministic Knowledge compiler identity for one admission. */
export function domainCompilerIdentity(
	admission: DomainPluginAdmission,
): KnowledgeCompilerIdentity {
	return createKnowledgeCompilerIdentity({
		compilerId: admission.manifest.compilerId,
		compilerVersion: admission.manifest.pluginVersion,
		domainPlugin: domainPluginIdentity(admission),
		...DOMAIN_COMPILER_RENDERERS,
	});
}

/** Fails closed unless checkpoint carries exact admitted Domain identity. */
export function assertCheckpointBoundToDomain(
	checkpoint: KnowledgeCheckpoint,
	admission: DomainPluginAdmission,
): void {
	const expected = domainPluginIdentity(admission);
	const actual = checkpoint.projection.compiler.domainPlugin;
	assertDomainPluginIdentity(actual);
	if (actual.identityDigest !== expected.identityDigest) {
		throw new Error(
			`Knowledge checkpoint Domain Plugin ${actual.identityDigest} does not match admitted Domain Plugin ${admission.manifest.pluginId}.`,
		);
	}
	const expectedCompiler = domainCompilerIdentity(admission);
	if (checkpoint.projection.compiler.digest !== expectedCompiler.digest) {
		throw new Error(
			`Knowledge checkpoint compiler ${checkpoint.projection.compiler.digest} does not match admitted Domain Plugin ${admission.manifest.pluginId}.`,
		);
	}
}

export const SOFTWARE_DEVELOPMENT_COMPILER_IDENTITY =
	createKnowledgeCompilerIdentity({
		compilerId: SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest.compilerId,
		compilerVersion: SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest.pluginVersion,
		domainPlugin: SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY,
		...DOMAIN_COMPILER_RENDERERS,
	});

export function domainPluginIdentityFromCheckpoint(
	value: unknown,
): DomainPluginIdentity {
	if (!value || typeof value !== "object") {
		throw new Error("Knowledge checkpoint Domain Plugin binding is missing.");
	}
	const projection = (value as {readonly projection?: unknown}).projection;
	if (!projection || typeof projection !== "object") {
		throw new Error("Knowledge checkpoint Domain Plugin binding is missing.");
	}
	const compiler = (projection as {readonly compiler?: unknown}).compiler;
	if (!compiler || typeof compiler !== "object") {
		throw new Error("Knowledge checkpoint Domain Plugin binding is missing.");
	}
	const identity = (compiler as {readonly domainPlugin?: unknown}).domainPlugin;
	assertDomainPluginIdentity(identity as DomainPluginIdentity);
	return identity as DomainPluginIdentity;
}

export function sameDomainPluginIdentity(
	left: DomainPluginIdentity,
	right: DomainPluginIdentity,
): boolean {
	assertDomainPluginIdentity(left);
	assertDomainPluginIdentity(right);
	return left.identityDigest === right.identityDigest;
}
