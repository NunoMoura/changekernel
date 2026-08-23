import {
	CHECK_OUTPUT_PROTOCOL_ID,
	CHECK_OUTPUT_PROTOCOL_VERSION,
	type CheckInputItem,
	type CheckInputSelection,
	type CheckInputSource,
	type CheckInvocation,
	type CheckMeasurement,
	type CheckOutput,
	type CheckOutputDetail,
} from "./contracts.ts";
import {assertCheckInvocation} from "./protocol.ts";

export interface CheckSdkQuery {
	readonly source: CheckInputSource;
	readonly ref?: string;
	readonly requireComplete?: boolean;
}

export interface CheckSdk {
	readonly invocationDigest: CheckInvocation["invocationDigest"];
	selection(query: CheckSdkQuery): CheckInputSelection;
	items(query: CheckSdkQuery): readonly CheckInputItem[];
	output(input: {
		readonly measurement: CheckMeasurement;
		readonly summary: string;
		readonly details?: readonly CheckOutputDetail[];
	}): CheckOutput;
}

/** Read-only SDK exposed to self-contained Code Checks. */
export function createCheckSdk(invocation: CheckInvocation): CheckSdk {
	assertCheckInvocation(invocation);
	const selections = new Map<string, CheckInputSelection>();
	for (const selection of invocation.inputs) {
		for (const ref of selection.selector.refs.length ? selection.selector.refs : [""]) {
			const key = selectionKey(selection.selector.source, ref);
			if (selections.has(key)) throw new Error("Check SDK input selector is ambiguous.");
			selections.set(key, selection);
		}
	}
	return Object.freeze({
		invocationDigest: invocation.invocationDigest,
		selection(query: CheckSdkQuery): CheckInputSelection {
			const source = query.source;
			const ref = queryRef(query.ref);
			const selection = selections.get(selectionKey(source, ref));
			if (!selection) throw new Error("Check SDK query was not declared by this Check.");
			if (query.requireComplete !== false) assertCompleteSelection(selection);
			return selection;
		},
		items(query: CheckSdkQuery): readonly CheckInputItem[] {
			return this.selection(query).items;
		},
		output(input: {
			readonly measurement: CheckMeasurement;
			readonly summary: string;
			readonly details?: readonly CheckOutputDetail[];
		}): CheckOutput {
			const summary = requiredText(input.summary, "Check Output summary", 2_048);
			const details = Object.freeze((input.details ?? []).map(normalizeDetail));
			return Object.freeze({
				protocolId: CHECK_OUTPUT_PROTOCOL_ID,
				protocolVersion: CHECK_OUTPUT_PROTOCOL_VERSION,
				invocationDigest: invocation.invocationDigest,
				measurement: normalizeMeasurement(input.measurement),
				summary,
				details,
			});
		},
	});
}

function assertCompleteSelection(selection: CheckInputSelection): void {
	if (selection.status !== "ready") {
		throw new Error(`Check SDK input ${selection.selector.refs.join(",")} is ${selection.status}.`);
	}
	if (selection.truncated) {
		throw new Error(`Check SDK input ${selection.selector.refs.join(",")} is truncated.`);
	}
	if (selection.stale) {
		throw new Error(`Check SDK input ${selection.selector.refs.join(",")} is stale.`);
	}
}

function normalizeMeasurement(value: CheckMeasurement): CheckMeasurement {
	if (!value || typeof value !== "object") throw new Error("Check SDK measurement is invalid.");
	if (value.kind === "binary" && typeof value.value === "boolean") {
		return Object.freeze({kind: "binary", value: value.value});
	}
	if (value.kind === "quantitative" && typeof value.value === "number" && Number.isFinite(value.value)) {
		return Object.freeze({kind: "quantitative", value: value.value});
	}
	throw new Error("Check SDK measurement is invalid.");
}

function normalizeDetail(value: CheckOutputDetail): CheckOutputDetail {
	if (!value || typeof value !== "object") throw new Error("Check SDK output detail is invalid.");
	if (value.startLine !== undefined && (!Number.isSafeInteger(value.startLine) || value.startLine < 1)) {
		throw new Error("Check Output detail start line is invalid.");
	}
	if (value.endLine !== undefined && (!Number.isSafeInteger(value.endLine) || value.endLine < (value.startLine ?? 1))) {
		throw new Error("Check Output detail end line is invalid.");
	}
	return Object.freeze({
		message: requiredText(value.message, "Check Output detail message", 2_048),
		...(value.ref ? {ref: requiredText(value.ref, "Check Output detail ref", 512)} : {}),
		...(value.startLine !== undefined ? {startLine: value.startLine} : {}),
		...(value.endLine !== undefined ? {endLine: value.endLine} : {}),
	});
}

function selectionKey(source: CheckInputSource, ref: string): string {
	return `${source}\0${ref}`;
}

function queryRef(value: unknown): string {
	if (value === undefined) return "";
	if (typeof value !== "string" || value.length > 512 || value.trim() !== value) {
		throw new Error("Check SDK query ref is invalid.");
	}
	return value;
}

function requiredText(value: unknown, field: string, maximum: number): string {
	if (typeof value !== "string" || value.length === 0 || value.length > maximum || value.trim() !== value) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}
