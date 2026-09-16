import type {CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import type {CheckInput, CheckResult} from "../../kernel/gates/checks.ts";

export const CHECK_WORKER_PROTOCOL = "changekernel.check-worker@1.0.0";
export type CheckAnswer = Pick<CheckResult, "failureKind" | "feedback" | "evidenceDigests" | "limitations"> & Readonly<{passed: boolean}>;
export interface CheckLibrary {
	model(prompt: string, shape: Readonly<Record<string, "string" | "boolean" | "number">>): Promise<Readonly<Record<string, string | boolean | number>>>;
}
/** Compile TypeScript ahead of execution into one self-contained JavaScript module. */
export type CheckImplementation = (material: Readonly<{input: CheckInput; parameters: CanonicalValue}>, library: CheckLibrary) => CheckAnswer | Promise<CheckAnswer>;

/** Executed only as a file in the isolated process, never loaded into the server. */
export const CHECK_WORKER_SOURCE = String.raw`
import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
const canonical = value => value && typeof value === 'object' ? (Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))) : value;
const send = value => process.stdout.write(JSON.stringify(canonical({protocol:'changekernel.check-worker@1.0.0', ...value})) + '\n');
const lines = createInterface({input: process.stdin});
const pending = new Map();
let sequence = 0;
lines.on('line', line => {
  const reply = JSON.parse(line);
  if (reply.protocol !== 'changekernel.check-worker@1.0.0') throw Error('Wrong reply protocol');
  const request = pending.get(reply.id);
  if (!request) throw Error('Unexpected model response');
  pending.delete(reply.id);
  request(reply.value);
});
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const input = freeze(JSON.parse(readFileSync('/app/input.json', 'utf8')));
const api = Object.freeze({model(prompt, shape) {
  const id = ++sequence;
  return new Promise(resolve => {
    pending.set(id, resolve);
    send({type: 'model', id, prompt, shape});
  });
}});
try {
  const admitted = new Promise(resolve => pending.set(0, resolve));
  send({type: 'ready'});
  if (await admitted !== true) throw Error('Containment was not admitted');
  const {default: check} = await import('/app/check.mjs');
  const result = await check(input, api);
  if (pending.size) throw Error('Outstanding model requests');
  send({type: 'result', value: result});
  lines.close();
  process.stdin.destroy();
} catch {
  process.exitCode = 1;
  lines.close();
  process.stdin.destroy();
}
`;
