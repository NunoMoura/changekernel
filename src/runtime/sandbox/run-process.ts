import {realpathSync, statSync} from "node:fs";
import {isAbsolute, relative} from "node:path";

import type {
	NodeRunProcessArtifact,
	NodeRunProcessSandbox,
} from "../processes/node-process-manager.ts";
import {
	createBubblewrapLaunchCommand,
	verifyBubblewrapSandboxProfile,
	type BubblewrapMount,
	type BubblewrapSandboxProfile,
} from "./bubblewrap.ts";

export interface BubblewrapRunProcessSandboxOptions {
	readonly profile: BubblewrapSandboxProfile;
	readonly readOnlyPaths: readonly string[];
	readonly writablePaths: readonly string[];
	readonly allowNestedUserNamespaces: boolean;
}

export function createBubblewrapRunProcessSandbox(
	options: BubblewrapRunProcessSandboxOptions,
): NodeRunProcessSandbox {
	assertPathList(options.readOnlyPaths, "readOnlyPaths");
	assertPathList(options.writablePaths, "writablePaths");
	assertDisjointMounts(options.readOnlyPaths, options.writablePaths);
	const profileDigest = verifyBubblewrapSandboxProfile(options.profile);
	return Object.freeze({
		profileDigest,
		async prepare(artifact: NodeRunProcessArtifact): Promise<NodeRunProcessArtifact> {
			const mounts = runProcessMounts(options, artifact);
			assertArtifactPathsCovered(
				artifact,
				mounts,
				options.profile.systemReadOnlyPaths,
			);
			const command = createBubblewrapLaunchCommand(options.profile, {
				executable: artifact.executable,
				args: artifact.args,
				cwd: artifact.cwd,
				mounts,
				disableNestedUserNamespaces: !options.allowNestedUserNamespaces,
			});
			if (command.profileDigest !== profileDigest) {
				throw new Error("Run Process sandbox profile changed after admission.");
			}
			return Object.freeze({
				runtimeBuildDigest: artifact.runtimeBuildDigest,
				runProtocolVersion: artifact.runProtocolVersion,
				executable: command.executable,
				args: command.args,
				cwd: command.cwd,
			});
		},
	});
}

function runProcessMounts(
	options: BubblewrapRunProcessSandboxOptions,
	artifact: NodeRunProcessArtifact,
): BubblewrapMount[] {
	const mounts: BubblewrapMount[] = [];
	for (const path of options.readOnlyPaths) {
		mounts.push({source: path, destination: path, access: "read-only"});
	}
	for (const path of options.writablePaths) {
		mounts.push({source: path, destination: path, access: "read-write"});
	}
	if (!covered(artifact.executable, mounts, options.profile.systemReadOnlyPaths)) {
		mounts.push({
			source: artifact.executable,
			destination: artifact.executable,
			access: "read-only",
		});
	}
	if (!covered(artifact.cwd, mounts, options.profile.systemReadOnlyPaths)) {
		mounts.push({source: artifact.cwd, destination: artifact.cwd, access: "read-only"});
	}
	return mounts;
}

function assertArtifactPathsCovered(
	artifact: NodeRunProcessArtifact,
	mounts: readonly BubblewrapMount[],
	systemPaths: readonly string[],
): void {
	const roots = [...systemPaths, ...mounts.map((mount) => mount.destination)];
	if (!roots.some((root) => pathWithin(artifact.executable, root))) {
		throw new Error("Run Process executable is outside admitted sandbox mounts.");
	}
	if (!roots.some((root) => pathWithin(artifact.cwd, root))) {
		throw new Error("Run Process cwd is outside admitted sandbox mounts.");
	}
	for (const argument of artifact.args) {
		if (!isAbsolute(argument)) continue;
		if (!roots.some((root) => pathWithin(argument, root))) {
			throw new Error("Run Process absolute argument is outside admitted sandbox mounts.");
		}
	}
}

function covered(
	path: string,
	mounts: readonly BubblewrapMount[],
	systemPaths: readonly string[],
): boolean {
	return [...systemPaths, ...mounts.map((mount) => mount.destination)]
		.some((root) => pathWithin(path, root));
}

function assertPathList(values: readonly string[], field: string): void {
	if (!Array.isArray(values) || values.length > 32) {
		throw new Error(`Run Process sandbox ${field} is invalid.`);
	}
	for (const value of values) {
		if (!isAbsolute(value) || realpathSync(value) !== value || !statSync(value)) {
			throw new Error(`Run Process sandbox ${field} must contain exact existing absolute paths.`);
		}
	}
}

function assertDisjointMounts(
	readOnlyPaths: readonly string[],
	writablePaths: readonly string[],
): void {
	for (const writable of writablePaths) {
		if (readOnlyPaths.some((readOnly) => pathWithin(writable, readOnly) || pathWithin(readOnly, writable))) {
			throw new Error("Run Process sandbox read-only and writable mounts overlap.");
		}
	}
}

function pathWithin(path: string, root: string): boolean {
	const child = relative(root, path);
	return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}
