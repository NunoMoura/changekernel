import {spawn} from "node:child_process";
import {realpathSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {
	createShellWorktreeCommandRunner,
	type WorktreeCommandExecFile,
} from "../../git/worktree-shell-runner.ts";
import type {WorktreeCommandRunner} from "../../git/worktrees.ts";
import {
	startProjectCoordinatorDaemon,
	type ProjectCoordinatorDaemonHandle,
} from "./daemon.ts";
import {createCodeWikiLoopExecutionPorts} from "./executor.ts";
import type {ProjectCoordinatorServiceOptions} from "./service.ts";
import {CODEWIKI_STATE_ROOT_ENV} from "../operations/paths.ts";

export interface ProjectCoordinatorDaemonProcessOptions {
	readonly service?: ProjectCoordinatorServiceOptions;
	readonly worktreeExecFile?: WorktreeCommandExecFile;
}

/** Spawn the standalone Project Server daemon without selecting an execution engine. */
export function spawnProjectCoordinatorDaemon(
	repoRoot: string,
	options: {readonly stateRoot?: string} = {},
): void {
	const child = spawn(
		process.execPath,
		[projectCoordinatorDaemonScriptPath(), repoRoot],
		{
			cwd: repoRoot,
			detached: true,
			stdio: "ignore",
			windowsHide: true,
			env: options.stateRoot
				? {...process.env, [CODEWIKI_STATE_ROOT_ENV]: options.stateRoot}
				: process.env,
		},
	);
	child.on("error", () => undefined);
	child.unref();
}

/**
 * Start Project Server-owned daemon infrastructure.
 *
 * DSH or delegated execution capabilities must be injected explicitly. Missing
 * semantic or Worker adapters remain unavailable rather than falling back.
 */
export async function startProjectCoordinatorDaemonProcess(
	repoRoot: string,
	options: ProjectCoordinatorDaemonProcessOptions = {},
): Promise<ProjectCoordinatorDaemonHandle> {
	const canonicalRoot = realpathSync(repoRoot);
	return startProjectCoordinatorDaemon(canonicalRoot, {
		...options.service,
		loopExecutionPorts:
			options.service?.loopExecutionPorts || createCodeWikiLoopExecutionPorts(),
		workerWorktreeRunner:
			options.service?.workerWorktreeRunner ||
			defaultWorktreeRunner(canonicalRoot, options.worktreeExecFile),
	});
}

function defaultWorktreeRunner(
	canonicalRoot: string,
	execFile: WorktreeCommandExecFile | undefined,
): WorktreeCommandRunner {
	const base = {
		cwd: canonicalRoot,
		timeoutMs: 60_000,
		maxBufferBytes: 8 * 1024 * 1024,
	};
	if (execFile) return createShellWorktreeCommandRunner({...base, execFile});
	return createShellWorktreeCommandRunner(base);
}

function projectCoordinatorDaemonScriptPath(): string {
	return fileURLToPath(new URL("./daemon-process.js", import.meta.url));
}

async function run(): Promise<void> {
	const repoRoot = process.argv[2];
	if (!repoRoot) {
		throw new Error(
			"CodeWiki Project Server daemon requires a repo root argument.",
		);
	}
	const daemon = await startProjectCoordinatorDaemonProcess(repoRoot);
	let closing = false;
	const shutdown = async (): Promise<void> => {
		if (closing) return;
		closing = true;
		try {
			await daemon.close();
		} catch {
			// Process shutdown remains best-effort after signal delivery.
		}
	};
	for (const signal of ["SIGINT", "SIGTERM"] as const) {
		process.once(signal, async () => {
			await shutdown();
			process.exit(0);
		});
	}
}

const scriptPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === scriptPath) await run();
