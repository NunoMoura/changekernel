// Reference-only process harness. Actor is a separate trusted argument, not proposal content.
import {DatabaseSync} from "node:sqlite";
import {createInterface} from "node:readline";
import {createContainerIntakeClient, openSqliteContainerIntake} from "../../../src/index.ts";

const [mode, path, actor, encodedInput] = process.argv.slice(2);
const send = message => process.stdout.write(JSON.stringify(message) + "\n");
let store;
let lock;
try {
	if (mode === "lock") {
		lock = new DatabaseSync(path);
		lock.exec("BEGIN IMMEDIATE");
	} else {
		store = openSqliteContainerIntake(path);
	}
	send({event: "ready"});
	const lines = createInterface({input: process.stdin});
	for await (const line of lines) {
		if (mode === "lock") {
			if (line !== "release") throw new Error("Unexpected lock command");
			lock.exec("ROLLBACK");
			send({event: "released"});
			break;
		}
		if (line === "go") {
			const result = createContainerIntakeClient(store).propose(JSON.parse(encodedInput), actor);
			if (mode === "lost-reply") {
				if (!result.ok) throw new Error(`Proposal did not commit: ${JSON.stringify(result)}`);
				// Proposal has returned after commit; retain reply until parent terminates process.
				send({event: "committed"});
			} else {
				send({event: "result", result});
				break;
			}
		} else if (line === "reply" && mode === "lost-reply") {
			throw new Error("Lost-reply child must be terminated before reply");
		} else throw new Error("Unexpected intake command");
	}
} catch (error) {
	console.error(error);
	process.exitCode = 1;
} finally {
	store?.close();
	lock?.close();
}
