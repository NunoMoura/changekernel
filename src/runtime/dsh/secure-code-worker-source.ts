export const SECURE_CODE_WORKER_SOURCE = String.raw`
"use strict";
const {stripTypeScriptTypes} = require("node:module");
const readline = require("node:readline");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const PREFIX = "async function __codewiki_program__() {\n";
const SUFFIX = "\n}";
let boot = null;
let nextCallId = 0;
const pending = new Map();
const input = readline.createInterface({input: process.stdin, crlfDelay: Infinity});

function send(value) {
	process.stdout.write(JSON.stringify(value) + "\n");
}

function text(value) {
	if (typeof value === "string") return value;
	try {
		const encoded = JSON.stringify(value);
		return encoded === undefined ? String(value) : encoded;
	} catch {
		return String(value);
	}
}

function call(globalName, name, args, ErrorClass) {
	return new Promise((resolve, reject) => {
		const id = ++nextCallId;
		pending.set(id, {
			resolve,
			reject: (error) => reject(new ErrorClass(name, error instanceof Error ? error.message : String(error))),
		});
		send({type: "call", id, global: globalName, name, args});
	});
}

function acceptReply(value) {
	if (!value || value.type !== "reply" || !Number.isSafeInteger(value.id)) return;
	const waiter = pending.get(value.id);
	if (!waiter) return;
	pending.delete(value.id);
	if (value.ok === true) waiter.resolve(value.value);
	else waiter.reject(new Error(typeof value.message === "string" ? value.message : "Binding call failed."));
}

function namespaces() {
	const names = [];
	const values = [];
	for (const namespace of boot.namespaces) {
		const target = Object.create(null);
		const descriptor = namespace.errorClass;
		const BindingError = descriptor ? class extends Error {
			constructor(name, message) {
				super(message);
				this.name = descriptor.name;
				Object.defineProperty(this, descriptor.memberNameProperty, {value: name, enumerable: true});
			}
		} : Error;
		if (descriptor) Object.defineProperty(globalThis, descriptor.name, {value: BindingError});
		for (const name of namespace.names) {
			Object.defineProperty(target, name, {
				enumerable: true,
				value: (args) => call(namespace.global, name, args, BindingError),
			});
		}
		names.push(namespace.global);
		values.push(target);
	}
	return {names, values};
}

async function execute() {
	const consoleCapture = Object.freeze({
		log: (...args) => send({type: "log", text: args.map(text).join(" ")}),
		info: (...args) => send({type: "log", text: args.map(text).join(" ")}),
		warn: (...args) => send({type: "log", text: args.map(text).join(" ")}),
		error: (...args) => send({type: "log", text: args.map(text).join(" ")}),
		debug: (...args) => send({type: "log", text: args.map(text).join(" ")}),
	});
	const wrapped = PREFIX + boot.program + SUFFIX;
	const stripped = stripTypeScriptTypes(wrapped, {mode: "strip"});
	const program = stripped.slice(PREFIX.length, -SUFFIX.length);
	const bindings = namespaces();
	const operation = new AsyncFunction("console", ...bindings.names, '"use strict";\n' + program);
	const value = await operation(consoleCapture, ...bindings.values);
	if (value === undefined) {
		send({type: "done"});
		return;
	}
	try { send({type: "done", value}); }
	catch { send({type: "done", error: {kind: "invalid-output", message: "Program completion is not lossless JSON."}}); }
}

input.on("line", (line) => {
	let value;
	try { value = JSON.parse(line); }
	catch { process.exit(65); }
	if (!boot) {
		boot = value;
		input.pause();
		execute().catch((error) => {
			send({type: "done", error: {kind: "exception", message: error instanceof Error ? error.message : String(error)}});
		}).finally(() => process.exit(0));
		input.resume();
		return;
	}
	acceptReply(value);
});

input.on("close", () => {
	if (!boot) process.exit(66);
});
`;
