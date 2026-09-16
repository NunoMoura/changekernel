export {bootstrapChangeKernelProject} from "./adapters/git/bootstrap.ts";
export {createLocalProjectServer, LOCAL_PROJECT_SERVER_PROTOCOL} from "./adapters/git/local-server.ts";
export type {LocalProjectServer, LocalProjectServerIssue} from "./adapters/git/local-server.ts";
export {createChangeKernelClient} from "./api/client/index.ts";
export {
	renderChangeDetailConsole,
	renderChangesConsole,
	renderChecksConsole,
	renderConsole,
	renderProjectStatusConsole,
	sanitizeTerminalText,
} from "./api/client/console.ts";
export {
	PRODUCT_TRANSPORT_REQUEST_PROTOCOL,
	PRODUCT_TRANSPORT_RESPONSE_PROTOCOL,
	createProductTransportRequest,
	createProductTransportResponse,
	decodeProductTransportResponse,
} from "./api/transport/envelope.ts";
export {CHANGEKERNEL_PRODUCT, CHANGEKERNEL_PRODUCT_POLICY_DIGEST} from "./product.ts";
export {CHANGEKERNEL_VERSION} from "./kernel/identity/version.ts";
export type {BootstrapFailure, BootstrapReceipt, BootstrapRequest, BootstrapResult} from "./adapters/git/bootstrap.ts";
export type {ChangeKernelProductPolicy} from "./product.ts";
export {createProjectAccessPolicy, projectAccessProofDigest} from "./server/authorization/policy.ts";
export {createProjectServer, PROJECT_SERVER_PROTOCOL} from "./server/index.ts";

export type {
	AlignmentReadCall,
	AuditReadCall,
	ChangesReadCall,
	ChecksReadCall,
	ChangeCommandCall,
	ChangeKernelClient,
	PlanningCommandCall,
	ProductCallOptions,
	ProductClientInput,
	ProductTransport,
	ProjectStatusCall,
	ProposeChangesCall,
	ProtectedEffectCall,
	ReasonedChangeCommandCall,
	ReviewReadCall,
	ReviseChangeCall,
	SupersedeChangeCall,
	WikiReadCall,
	WorkCandidateCall,
	WorkCommandCall,
	WorkReadCall,
} from "./api/client/index.ts";
export type {
	ChangeCommandInput,
	PlanWorkInput,
	PlanningCommandInput,
	ProductCommandInput,
	ProductCommandOperation,
	ProposalInput,
	ProposeChangesInput,
	ProtectedEffectInput,
	ReasonedChangeCommandInput,
	ReviseChangeInput,
	SupersedeChangeInput,
	WikiPatchInput,
	WorkCandidateInput,
	WorkCommandInput,
} from "./api/contracts/command.ts";
export type {
	AlignmentReadInput,
	AuditReadInput,
	ChangesReadInput,
	ChecksReadInput,
	ProductReadInput,
	ProductReadOperation,
	ProjectSourceSelector,
	ReviewReadInput,
	WikiReadInput,
	WorkReadInput,
} from "./api/contracts/read.ts";
export type {
	ProductError,
	ProductInput,
	ProductOperation,
	ProductTransportRequest,
	ProductTransportResponse,
} from "./api/transport/envelope.ts";
export type {
	ProjectAccessGrant,
	ProjectAccessPolicy,
	ProjectAccessPolicyInput,
} from "./server/authorization/policy.ts";
export type {
	ProjectServer,
	ProjectServerInput,
	ProjectServerProject,
} from "./server/index.ts";
