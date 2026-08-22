import type {ChangeRevisionContent} from "../../changes/trace/contracts.ts";
import type {Sha256Digest} from "../../utils/canonical-json.ts";

export interface DecisionSemanticRevision extends ChangeRevisionContent {
	readonly ordinal: number;
	readonly revisionId: Sha256Digest;
}

export interface DecisionRelationshipBinding {
	readonly operationId: Sha256Digest;
	readonly relationshipId: Sha256Digest;
	readonly type: string;
	readonly sourceRevisionId: Sha256Digest;
	readonly targetChangeId: string;
	readonly targetRevisionId: Sha256Digest;
}

export interface DecisionActiveChangeBinding {
	readonly changeId: string;
	readonly revision: DecisionSemanticRevision;
	readonly relationships: readonly DecisionRelationshipBinding[];
}
