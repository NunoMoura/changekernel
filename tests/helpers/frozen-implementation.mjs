import {
	createImplementationAggregateFreeze,
	createPrivateIntegrationAdmission,
} from "../../src/project-server/integration/private-lineage.ts";
import {sha256Digest} from "../../src/utils/canonical-json.ts";
import {baseSnapshotFor, reduceBatch} from "./change-trace-replay-v1.mjs";
import {authorityBinding, gitObject} from "./change-trace-v1.mjs";
import {acceptedImplementationCandidateContext} from "./canonical-implementation.mjs";

export async function frozenImplementationContext(options = {}) {
	const context = await acceptedImplementationCandidateContext(options);
	const observation = {
		expectedLineageDigest: "absent",
		workGraphDigest: context.state.workGraph.graphDigest,
		candidateTreeDigest: context.candidate.content.resultTreeDigest,
		changedPaths: context.candidate.content.changedPaths,
		workbenchDigest: context.candidate.content.workbenchDigest,
		custodyReceiptDigests: context.candidate.content.runAttempts.map(
			(entry) => entry.receiptDigest,
		),
		baseCommit: context.candidate.content.sourceBase,
		status: "integrated",
		resultCommit: options.resultCommit ?? gitObject("7"),
		resultTreeDigest:
			options.resultTreeDigest ?? sha256Digest("private-integrated-tree"),
		conflictRefs: [],
		recordedAt: "2026-08-10T10:05:00.000Z",
	};
	const admission = createPrivateIntegrationAdmission({
		state: context.state,
		candidate: context.candidate,
		gateReport: context.gate.report,
		observation,
		baseSnapshot: baseSnapshotFor(context.state),
		authorityBinding: authorityBinding(),
	});
	const integrated = reduceBatch(
		context.state,
		[admission.operation],
		gitObject("8"),
	);
	const freeze = createImplementationAggregateFreeze({
		state: integrated,
		changeId: context.changeId,
		expectedLineageDigest: admission.lineage.lineageDigest,
		frozenAt: "2026-08-10T10:06:00.000Z",
		baseSnapshot: baseSnapshotFor(integrated),
		authorityBinding: authorityBinding(),
	});
	const state = reduceBatch(integrated, [freeze.operation], gitObject("9"));
	return {...context, admission, freeze, state};
}
