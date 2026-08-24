export const CODEWIKI_EXTENSION_AVAILABLE = true as const;

export {
	CLIENT_KINDS,
	CLIENT_PROJECT_SERVER_PROTOCOL,
	serverTransportDeduplicationDigest,
	normalizeClientProjectServerCommand,
	normalizeClientProjectServerEvent,
	normalizeClientProjectServerOperation,
	normalizeClientProjectServerQuery,
	normalizeClientProjectServerQueryResult,
	runtimeSemanticIdempotencyDigest,
	type ClientProjectServerActorContext,
	type ClientProjectServerCommandEnvelope,
	type ClientProjectServerCoverage,
	type ClientProjectServerEventEnvelope,
	type ClientKind,
	type ClientProjectServerOperationEnvelope,
	type ClientProjectServerOperationStatus,
	type ClientProjectServerQueryEnvelope,
	type ClientProjectServerQueryResultEnvelope,
	type ClientProjectServerRequestContext,
	type ClientProjectServerSnapshotContext,
	type ClientProjectServerTransportContext,
} from "./protocol/client-project-server.ts";
export {
	DEFAULT_WIKI_CONFIG,
	resolveWikiConfig,
	resolveWikiStageModelRoute,
	validateWikiConfig,
	type PartialHostConfig,
	type PartialQualityConfig,
	type PartialRuntimeConfig,
	type PartialWikiConfig,
	type WikiApprovalPolicyConfig,
	type WikiConfig,
	type WikiConfigAgencyLevel,
	type WikiConfigApprovalCadence,
	type WikiConfigAutomationMode,
	type WikiConfigRiskAction,
	type WikiConfigWorktreeIsolation,
	type WikiHostConfig,
	type WikiHarnessStage,
	type WikiModelEscalationTransitionConfig,
	type WikiModelLatency,
	type WikiModelPricingConfig,
	type WikiModelQuality,
	type WikiModelRoleRoutesConfig,
	type WikiModelRouteConfig,
	type WikiModelRoutingConfig,
	type WikiModelThinking,
	type WikiQualityConfig,
	type WikiQualityJudgeConfig,
	type WikiQualityReviewConfig,
	type WikiRetentionConfig,
	type WikiRuntimeBudgetConfig,
	type WikiRuntimeConfig,
} from "./project/config.ts";
export type {
	ImplementationChange,
	ImplementationChangeInput,
	ImplementationWorkerClaim,
} from "./loops/implementation/types.ts";
export type { ImplementationWorkerReportInput } from "./loops/implementation/workers.ts";
export type {
	ImplementationWorkerProof,
	ImplementationWorkerProofConflict,
	ImplementationWorkerProofInput,
} from "./loops/implementation/worker-proof.ts";
export type {
	SourceMapComponent,
	SourceMapContract,
	SourceMapDefaults,
	SourceMapMarkdownEntry,
	SourceMapValidationInput,
	SourceMapValidationIssue,
	SourceMapValidationIssueCode,
} from "./knowledge/source-map.ts";
export type { ContentProof } from "./git/content-proof.ts";
export type {
	ApprovalReceiptPayload,
	ApprovalReceiptProvider,
	CommandExecutionPayload,
	DeliveryAttestationPayload,
	EvidenceArtifact,
	EvidenceAuthority,
	EvidenceCoverage,
	EvidenceId,
	EvidenceKind,
	EvidenceMaterial,
	EvidenceMeasurement,
	EvidencePayloadByKind,
	EvidenceProducer,
	EvidenceProducerKind,
	EvidenceRecord,
	EvidenceSensitivity,
	EvidenceSubject,
	IntegrationProofPayload,
	ModelAssessmentPayload,
	OutcomeObservationPayload,
	ResearchCitationPayload,
	SourceObservationPayload,
	UiCaptureArtifact,
	UiCapturePayload,
	WorkerReportPayload,
} from "./evidence/contracts.ts";
export type {
	Change,
	ChangeAssessment,
	ChangeClassification,
	ChangeDeliveryConstraints,
	ChangeEvidence,
	ChangeIntent,
	ChangeKnowledgeTransition,
	ChangeOutcomeContract,
	ChangeRecommendation,
	ChangeStatus,
	ChangeStatusTransition,
	ChangeValidation,
} from "./changes/types.ts";
export type { ChangeRecord } from "./changes/records.ts";
export {
	CHANGE_DEFECT_PROFILE_PROTOCOL,
	normalizeChangeDefectProfile,
	normalizeChangeSecurityProfile,
} from "./changes/defect-profile.ts";
export type {
	ChangeCvssReference,
	ChangeDefectCategory,
	ChangeDefectConfidence,
	ChangeDefectExposure,
	ChangeDefectLikelihood,
	ChangeDefectProfile,
	ChangeDefectProfileProvenance,
	ChangeDefectRegressionStatus,
	ChangeDefectReproducibility,
	ChangeDefectSeverity,
	ChangeKevReference,
	ChangeSarifReference,
	ChangeSecurityClassification,
	ChangeSecurityIdentifier,
	ChangeSecurityIdentifierScheme,
	ChangeSecurityProfile,
} from "./changes/defect-profile.ts";
export {
	CHANGE_INTAKE_MATERIAL_PROTOCOL,
	CHANGE_INTAKE_MATERIAL_TYPES,
} from "./changes/intake/contracts.ts";
export {
	normalizeChangeIntakeContent,
	normalizeChangeIntakeMaterial,
} from "./changes/intake/normalize.ts";
export * from "./changes/intake/outcome-diagnostics.ts";
export * from "./changes/triage/contracts.ts";
export {
	buildBacklogTriageProjection,
	type BuildBacklogTriageProjectionInput,
} from "./changes/triage/projection.ts";
export { queryBacklogTriage } from "./changes/triage/query.ts";
export {
	createDeliveryObservationMaterial,
	createDeliveryObservationMaterialFromEvidence,
	createKnowledgeDriftMaterial,
	createKnowledgeDriftMaterialFromIssue,
	createOutcomeFindingMaterial,
	createOutcomeFindingMaterialFromEvidence,
	createPullRequestFindingMaterial,
	createRegressionFindingMaterial,
	createSecurityScannerFindingMaterial,
	createUserSuggestionMaterial,
	createWorkerDiscoveryMaterial,
	createWorkerReportDiscoveryMaterials,
} from "./changes/intake/producers.ts";
export type {
	DeliveryEvidenceProducerInput,
	DeliveryObservationProducerInput,
	KnowledgeDriftIssueProducerInput,
	KnowledgeDriftProducerInput,
	OutcomeEvidenceProducerInput,
	OutcomeFindingProducerInput,
	PullRequestFindingProducerInput,
	RegressionFindingProducerInput,
	SecurityScannerFindingProducerInput,
	UserSuggestionProducerInput,
	WorkerDiscoveryProducerInput,
	WorkerReportDiscoveryProducerInput,
} from "./changes/intake/producers.ts";
export type {
	ChangeIntakeClaimedCategory,
	ChangeIntakeClaimedConfidence,
	ChangeIntakeClaimedSeverity,
	ChangeIntakeContent,
	ChangeIntakeMaterial,
	ChangeIntakeMaterialType,
	DeliveryObservationBinding,
	DeliveryObservationMaterial,
	KnowledgeDriftBinding,
	KnowledgeDriftMaterial,
	OutcomeFindingBinding,
	OutcomeFindingMaterial,
	PullRequestFindingBinding,
	PullRequestFindingMaterial,
	RegressionFindingBinding,
	RegressionFindingMaterial,
	SecurityScannerFindingBinding,
	SecurityScannerFindingMaterial,
	UserSuggestionBinding,
	UserSuggestionMaterial,
	WorkerDiscoveryBinding,
	WorkerDiscoveryMaterial,
} from "./changes/intake/contracts.ts";
export type {
	ChangeQuery,
	ChangeStore,
	ChangeStoreSnapshot,
} from "./changes/store.ts";
export type {
	GitStatusSnapshot,
	GitStatusSnapshotInput,
	RuntimeWorktreeGitInputs,
} from "./git/status.ts";
export type {
	ExecuteRuntimeWorktreeCommandsOptions,
	ProjectServerWorktreePlan,
	WorktreeCommand,
	WorktreeCommandExecutionRecord,
	WorktreeCommandExecutionResult,
	WorktreeCommandRunner,
	WorktreeCommandStep,
	WorktreeProcessCommand,
	WorktreeRef,
} from "./git/worktrees.ts";
export type { DecisionCandidateProposal } from "./loops/decision/candidate-proposal.ts";
export type {
	ImplementationAcceptanceEvidenceCandidate,
	ImplementationArchiveDispositionCandidate,
	ImplementationAssessmentCandidate,
	ImplementationCandidateContent,
	ImplementationCommandResultCandidate,
	ImplementationEvidenceCandidate,
	ImplementationSensitiveSurfaceCandidate,
} from "./loops/implementation/candidate-content.ts";
export {
	planningCandidateProposalSchema,
	parsePlanningCandidateProposal,
	planningContinuityKey,
	type PlanningAggregateReviewRequirement,
	type PlanningAmendment,
	type PlanningCandidateProposal,
	type PlanningDependencyEdge,
	type PlanningObligationCoverage,
	type PlanningResourceRequirements,
	type PlanningUnchangedKnowledgeCoverage,
	type PlanningWorkUnitCandidate,
} from "./loops/planning/candidate-content.ts";
export {
	PLANNING_CANDIDATE_SCHEMA_VERSION,
	assertPlanningCandidate,
	createPlanningCandidate,
	type CreatePlanningCandidateInput,
	type PlanningCandidate,
	type PlanningCandidateContent,
} from "./loops/planning/candidate.ts";
export {
	WORK_GRAPH_PROTOCOL,
	applyAcceptedPlanningDelta,
	createInitialWorkGraph,
	type AcceptedPlanningDelta,
	type CanonicalWorkGraph,
	type PlanningGraphDelta,
	type WorkGraphUnit,
	type WorkGraphUnitStatus,
} from "./loops/planning/work-graph.ts";
export {
	REVIEW_ATTEMPT_SCHEMA_VERSION,
	admitReviewEvidence,
	assertReviewEvidenceRecords,
	createReviewAttempt,
	normalizeReviewFailureOwnership,
	reviewContinuityKey,
	reviewFeedbackFromGate,
	reviewSubjectFromAttempt,
	type CreateReviewAttemptInput,
	type ReviewAttempt,
	type ReviewEvidenceSubmission,
	type ReviewFailureOwnership,
	type ReviewFeedbackItem,
	type ReviewFeedbackOwner,
	type ReviewProviderReceiptBinding,
} from "./loops/review/contracts.ts";
export type { ProjectSnapshot } from "./project/snapshot.ts";
export type { ProjectServerWorkUnitClaimPolicyDecision } from "./project-server/claims/policy.ts";
export type {
	TraceCloseReleaseNotes,
	TraceReleaseNoteChange,
	TraceReleaseNoteCheck,
} from "./changes/trace/release-notes.ts";
export type { TraceEvent, TraceRecord } from "./changes/trace/types.ts";
export { buildProjectWorkState } from "./work-state/project.ts";
export { buildWorkState } from "./work-state/projector.ts";
export type {
	WorkState,
	WorkStateAssignment,
	WorkStateBlocker,
	WorkStateChange,
	WorkStateGraphDelta,
	WorkStateWorkUnit,
} from "./work-state/types.ts";
export type {
	BlockersView,
	ConflictsView,
	TraceBoardView,
	WorkPlanView,
	WorkQueueView,
} from "./work-state/projection-types.ts";
export type {
	ResumeView,
	StatusView,
	TraceQueueView,
	TriggersView,
} from "./project-server/queries/projection-types.ts";
export * from "./changes/trace/index.ts";
export * from "./alignment/graph.ts";
export * from "./alignment/knowledge.ts";
export * from "./alignment/query.ts";
export * from "./loops/decision/accepted-effect-index.ts";
export * from "./knowledge/fact-classification.ts";
export * from "./knowledge/codewiki-kb-profile.ts";
export * from "./knowledge/system-diagrams.ts";
export * from "./runtime/contracts.ts";
export * from "./plugins/executable.ts";
export * from "./runtime/efficiency-metrics.ts";
export * from "./runtime/context/project-context-mount.ts";
export * from "./runtime/context/project-context-query.ts";
export * from "./runtime/builds/store.ts";
export * from "./project-server/project-context/snapshot.ts";
export * from "./project-server/project-context/store.ts";
export * from "./project-server/project-context/handle-expansion.ts";
export * from "./runtime/dsh/runtime-bridge.ts";
export * from "./runtime/dsh/secure-code-runtime.ts";
export * from "./runtime/dsh/project-context-tools.ts";
export * from "./runtime/sandbox/bubblewrap.ts";
export * from "./runtime/sandbox/run-process.ts";
export * from "./runtime/dsh/provenance.ts";
export * from "./runtime/processes/node-process-manager.ts";
export * from "./runtime/runtime.ts";
export * from "./protocol/client-pairing.ts";
export {
	PROJECT_SERVER_OIDC_AUTHENTICATION_PROTOCOL,
	projectServerOidcIdentity,
	verifyProjectServerOidcAuthentication,
	type ProjectServerOidcAuthenticationAdapter,
	type ProjectServerOidcClaims,
	type ProjectServerOidcIdentity,
	type VerifiedProjectServerOidcAuthentication,
} from "./project-server/authentication/oidc.ts";
export {
	normalizeProjectServerAuthenticationAssertion,
	verifyProjectServerAuthentication,
	type ProjectServerAuthenticationAdapter,
	type ProjectServerAuthenticationAssertion,
	type ProjectServerAuthenticationProof,
} from "./project-server/authentication/proof.ts";
export {
	PROJECT_SERVER_PAIRING_ENDPOINTS,
	issueAuthorizedClientPairing,
	revokeAuthorizedClientPairing,
	type AuthorizedClientPairingTransition,
	type ProjectServerPairingAuthorizationAdapter,
	type ProjectServerPairingAuthorizationCommand,
	type ProjectServerPairingAuthorizationContext,
} from "./project-server/pairing/authorization.ts";
export {
	PROJECT_SERVER_REPOSITORY_ACCESS_PROTOCOL,
	checkProjectServerProviderRepositoryAccess,
	type ProjectServerRepositoryAccess,
	type ProjectServerRepositoryAccessAdapter,
	type ProjectServerRepositoryAccessAdapterRequest,
	type ProjectServerRepositoryAccessObservation,
	type VerifiedProjectServerRepositoryAccess,
} from "./project-server/repository-access/check.ts";
export * from "./project-server/registry/enrollment.ts";
export * from "./project-server/registry/state.ts";
export * from "./project-server/sessions/contracts.ts";
export * from "./project-server/sessions/state.ts";
export * from "./checks/contracts.ts";
export * from "./checks/cache.ts";
export * from "./checks/identity.ts";
export * from "./checks/gate-package.ts";
export * from "./checks/protocol.ts";
export * from "./checks/results.ts";
export * from "./checks/runner.ts";
export * from "./checks/index.ts";
export * from "./checks/packs/index.ts";
export * from "./runtime/checks/code.ts";
export * from "./runtime/checks/model.ts";
export * from "./runtime/checks/secure-code-sandbox.ts";
export * from "./project-server/admission/external-candidate.ts";
export * from "./project-server/harness/contracts.ts";
export * from "./project-server/harness/service.ts";
export * from "./project-server/mcp/binding.ts";
export * from "./project-server/queries/operational-status.ts";
export * from "./work-state/checks.ts";
export * from "./runtime/security/collectors.ts";
export * from "./evidence/adapters/sarif.ts";
export * from "./evidence/adapters/junit.ts";
export * from "./evidence/adapters/coverage.ts";
export * from "./evidence/adapters/provider-check-receipt.ts";
export * from "./evidence/adapters/cyclonedx.ts";
export * from "./evidence/adapters/spdx.ts";
export * from "./evidence/adapters/pact.ts";
export * from "./evidence/adapters/openapi.ts";
export * from "./evidence/adapters/materialization.ts";
export {
	DECISION_RESEARCH_COLLECTION_PROTOCOL,
	collectDecisionResearchEvidence,
	type DecisionResearchCollectionReceipt,
	type DecisionResearchCollectionRequest,
	type DecisionResearchCollectionResult,
	type DecisionResearchCollector,
	type DecisionResearchCollectorBinding,
} from "./project-server/effects/research-collection.ts";
export {
	createDecisionGitAdmission,
	type DecisionGitAdmission,
	type DecisionGitAdmissionOptions,
} from "./project-server/admission/git.ts";
export {
	DECISION_CANDIDATE_PRODUCTION_PROTOCOL,
	assertNativeDecisionCandidateProductionRequest,
	createNativeDecisionAttemptExecutor,
	type NativeDecisionAttemptExecutorOptions,
	type NativeDecisionAttemptResult,
	type NativeDecisionCandidateProducer,
	type NativeDecisionCandidateProductionRequest,
	type NativeDecisionEvaluationInput,
	type NativeDecisionGateBinding,
} from "./project-server/coordinator/decision-attempt.ts";
export {
	commitNativeDecisionOperationSequence,
	commitReviewOperationSequence,
	createNativeDecisionOperationSequence,
	createReviewOperationSequence,
	type CommitNativeDecisionOperationSequenceInput,
	type CommitReviewOperationSequenceInput,
	type CreateNativeDecisionOperationsInput,
	type CreateReviewOperationsInput,
	type NativeDecisionCommitReceipt,
	type NativeDecisionOperationSequence,
	type ReviewCommitReceipt,
	type ReviewOperationSequence,
} from "./project-server/effects/gate-operations.ts";
export {
	createImplementationOperationSequence,
	type CreateImplementationOperationsInput,
	type ImplementationOperationSequence,
} from "./project-server/effects/implementation-operations.ts";
export {
	commitPlanningOperationSequence,
	createPlanningOperationSequence,
	type CommitPlanningOperationSequenceInput,
	type CreatePlanningOperationsInput,
	type PlanningCommitReceipt,
	type PlanningOperationSequence,
} from "./project-server/effects/planning-operations.ts";
export {
	WORK_UNIT_CANDIDATE_SCHEMA_VERSION,
	MAXIMUM_IMPLEMENTATION_ATTEMPTS,
	assertCurrentWorkUnitCandidate,
	assertWorkUnitCandidate,
	createWorkUnitCandidate,
	implementationContinuityKey,
	implementationWorkUnitSubjectId,
	type CreateWorkUnitCandidateInput,
	type WorkUnitAcceptanceSlice,
	type WorkUnitCandidate,
	type WorkUnitCandidateContent,
	type WorkUnitCandidateRun,
	type WorkUnitRunAttemptBinding,
} from "./loops/implementation/work-unit-candidate.ts";
export {
	IMPLEMENTATION_STAGE_POLICY_PROTOCOL,
	assertImplementationStagePolicy,
	createImplementationStagePolicy,
	type ImplementationStagePolicy,
} from "./loops/implementation/policy.ts";
export {
	deriveWorkUnitCandidateLifecycle,
	type WorkUnitCandidateLifecycle,
	type WorkUnitCandidateStatus,
} from "./loops/implementation/status.ts";
export {
	IMPLEMENTATION_AGGREGATE_SCHEMA_VERSION,
	PRIVATE_CHANGE_INTEGRATION_LINEAGE_SCHEMA_VERSION,
	PRIVATE_INTEGRATION_RECEIPT_SCHEMA_VERSION,
	applyPrivateIntegrationReceipt,
	assertFrozenImplementationAggregate,
	assertPrivateIntegrationLineage,
	assertPrivateIntegrationReceipt,
	createPrivateIntegrationReceipt,
	materializeFrozenImplementationAggregate,
	materializePrivateIntegrationLineage,
	privateChangeIntegrationRef,
	type CreatePrivateIntegrationReceiptInput,
	type ExpectedIntegrationLineage,
	type FrozenImplementationAggregate,
	type FrozenImplementationAggregateBody,
	type PrivateChangeIntegrationLineage,
	type PrivateChangeIntegrationLineageBody,
	type PrivateIntegratedWorkUnit,
	type PrivateIntegrationAcceptanceSlice,
	type PrivateIntegrationReceipt,
	type PrivateIntegrationStatus,
} from "./changes/trace/integration.ts";
export {
	commitImplementationAggregate,
	commitPrivateIntegrationAdmission,
	type CommitImplementationAggregateInput,
	type CommitPrivateIntegrationAdmissionInput,
	type ImplementationAggregateCommitReceipt,
	type PrivateIntegrationCommitReceipt,
} from "./project-server/integration/commit.ts";
export {
	createImplementationAggregateFreeze,
	createPrivateIntegrationAdmission,
	type CreateImplementationAggregateInput,
	type CreatePrivateIntegrationAdmissionInput,
	type ImplementationAggregateFreeze,
	type PrivateIntegrationAdmission,
	type PrivateIntegrationObservation,
} from "./project-server/integration/private-lineage.ts";
export {
	assertCurrentAggregateReviewAttempt,
	createAggregateReviewAttempt,
	type CreateAggregateReviewAttemptInput,
} from "./project-server/review/aggregate-review.ts";
export {
	commitGuardedDelivery,
	createDeliveryAuthority,
	createGuardedDeliveryOperation,
	type CommitGuardedDeliveryInput,
	type CreateGuardedDeliveryOperationInput,
	type DeliveryAuthority,
	type DeliveryAuthorityInput,
	type GuardedDeliveryPlan,
	type GuardedDeliveryReceipt,
} from "./project-server/delivery/guarded-delivery.ts";
export {
	createImplementationRunRequest,
	type CreateImplementationRunRequestInput,
} from "./project-server/workers/implementation-run.ts";
export {
	WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL,
	createWorkUnitModelAssignment,
	runModelRouteForAssignment,
	type CreateWorkUnitModelAssignmentInput,
	type WorkUnitModelAssignment,
} from "./project-server/workers/model-assignment.ts";
export type {
	ExecutionPolicyAttempt,
	ExecutionRisk,
	WorkerExecutionPolicySnapshot,
} from "./project-server/workers/execution-policy.ts";
export {
	executionFailureFromProviderReceipt,
	resolveExecutionRecovery,
	type ExecutionFailureKind,
	type ExecutionRecoveryAction,
	type ExecutionRecoveryDecision,
	type ExecutionRouteRequirement,
} from "./project-server/workers/execution-recovery.ts";
export {
	createImplementationStageGate,
	type CreateImplementationGateInput,
	type ImplementationGateRun,
	type ImplementationStageGate,
	type RunImplementationGateInput,
} from "./project-server/lifecycle/implementation-gate.ts";
export {
	commitProjectSchedulingPlan,
	type CommitProjectSchedulingPlanInput,
	type ProjectSchedulingCommitReceipt,
} from "./project-server/scheduling/commit.ts";
export {
	SCHEDULING_PLAN_PROTOCOL,
	createProjectSchedulingPlan,
	createSchedulingOperationSequence,
	deriveReadyWorkUnits,
	type ReadyWorkUnit,
	type SchedulingAdmission,
	type SchedulingHold,
	type SchedulingOperationSequence,
	type SchedulingPlan,
} from "./project-server/scheduling/scheduler.ts";
export {
	createPlanningGate,
	derivePlanningLifecycleTransition,
	type CreatePlanningGateInput,
	type PlanningGateRun,
	type PlanningLifecycleTransition,
	type RunPlanningGateInput,
	createReviewGate,
	deriveReviewLifecycleTransition,
	type CreateReviewGateInput,
	type ReviewGateRun,
	type ReviewLifecycleTransition,
	type RunReviewGateInput,
} from "./project-server/lifecycle/gates.ts";
