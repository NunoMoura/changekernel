import {
	createCheckInputSelection,
	type CreateCheckInputSelectionInput,
} from "../../checks/protocol.ts";
import type {
	CheckInputItem,
	CheckInputSelection,
} from "../../checks/contracts.ts";
import type {
	CheckInputResolver,
	CheckInputResolverContext,
} from "../../checks/runner.ts";
import type {EvidenceRecord} from "../../evidence/contracts.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
} from "../../utils/canonical-json.ts";

export function evidenceInputResolver(input: {
	readonly evidenceRecords: readonly EvidenceRecord[];
	readonly fallback?: CheckInputResolver;
}): CheckInputResolver {
	return Object.freeze({
		async resolve(
			context: CheckInputResolverContext,
		): Promise<CheckInputSelection | CreateCheckInputSelectionInput> {
			const source = context.selector.source;
			if (source !== "evidence" && source !== "provider_receipts") {
				if (input.fallback) return input.fallback.resolve(context);
				return createCheckInputSelection({
					selector: context.selector,
					status: "unavailable",
				});
			}
			const records = input.evidenceRecords.filter((record) =>
				evidenceMatchesSelector(record, source, context.selector.refs),
			);
			const items: CheckInputItem[] = records.map((record) => ({
				source,
				ref: record.evidenceId,
				digest: canonicalJsonDigest(record),
				content: toCanonicalJsonValue(record),
			}));
			return createCheckInputSelection({
				selector: context.selector,
				status: items.length > 0 || !context.selector.required ? "ready" : "unavailable",
				items,
			});
		},
	});
}

function evidenceMatchesSelector(
	record: EvidenceRecord,
	source: "evidence" | "provider_receipts",
	refs: readonly string[],
): boolean {
	if (
		source === "provider_receipts" &&
		!record.evidenceId.includes("provider_check_receipt")
	) {
		return false;
	}
	if (refs.length === 0) return true;
	return refs.some((ref) =>
		ref.endsWith("/**")
			? record.evidenceId.startsWith(ref.slice(0, -2))
			: record.evidenceId === ref,
	);
}
