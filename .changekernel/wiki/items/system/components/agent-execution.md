---
title: Agent Execution
aliases:
  - Agent Runtime
  - Pi Run Execution
source-id: cw:component:runtime
ownership:
  sourcePatterns:
    - src/adapters/pi/**
    - src/ports/agent-output.ts
    - src/ports/agent-runtime.ts
    - src/ports/check-model.ts
  testPatterns:
    - tests/adapters/pi/**
    - tests/ports/agent-runtime.test.mjs
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:1c7bb9922d692274966dd169a4650920846d36a320f052087a44e548082308ed
        codewiki.legacy:source-path: system/components/runtime.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:runtime
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Runtime supplies isolated accountable execution for Project Server-issued Runs.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
    - attributes:
        codewiki.legacy:relationship:
          rationale: Runtime supplies isolated Code and Model Check execution without Result authority.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
    - attributes:
        codewiki.legacy:relationship:
          rationale: Runtime supplies immutable input and sandbox boundaries for authored Code Checks.
          target: cw:story:check-author.author-composable-checks
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:check-author.author-composable-checks
    - attributes:
        codewiki.legacy:relationship:
          rationale: Runtime mounts exact Run Context Bundles and receipts local queries, Work Continuity execution, and DSH compaction.
          target: cw:story:agent.retrieve-bounded-context
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:agent.retrieve-bounded-context
    - attributes:
        codewiki.legacy:relationship:
          rationale: Runtime supplies separately qualified outer Run Process and inner model-code containment.
          target: cw:story:maintainer.contain-model-code
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.contain-model-code
---
# Agent Execution

Agent execution attempts bounded work or supplies interpretations for a Change under explicit authority. An Agent Runtime interface separates the semantic service from the execution library. Pi supplies the model and producer-session implementation; it is not a knowledge primitive or the Product's policy authority. ChangeKernel does not maintain a second harness or a permanent compatibility layer for a superseded runtime.

A run binds exact project/baseline/candidate context, role, permitted tools and effects, and resource limits. Knowledge queries remain scoped and source-bound. Context omissions, redaction, or truncation must be reported; copied prose or generated instructions do not grant authority beyond the run's capabilities.

Decision, Planning, Implementation, Review and assessment work use the same semantic foundations but can require different tool and effect scope. Models return interpretations or judgments, and tools return observations. Producer output is untrusted until its identity, scope, custody and evidence are checked; validating a receipt does not establish that its claimed containment occurred.

Worktrees and assigned paths alone are not sandboxes. Supported execution must enforce required filesystem, credential, network, descendant-process, time, resource and output limits before effects occur, with observed cancellation and quiescence. Unsupported capability is unavailable, not a simulated success.

Private run/session/custody state is distinct from portable accepted knowledge and Change records. A fresh process must reconcile launched, stopped and unknown work without reconstructing outcome by rerunning the model. Lost tracking is not permission to claim completion or retry a potentially active effect.

## Producer work and read-only Check execution

Agents perform exploratory tool use, synthesis, authorized artifact changes and Evidence collection. Backend-owned stage validators and adopted domain Checks perform separate read-only evaluation: they receive prepared inputs, compute and optionally call the authorized model primitive. Ownership follows the [transversal/domain boundary](changekernel.md#backend-validation-across-four-loops), not whether inference is used. They cannot write Project artifacts, Wiki, sources, policy, lifecycle records or Project Server code. Models invoked by Checks have no tools or inherited producer conversation.

Shared bounded execution mechanisms must retain each evaluator's authority origin, stage question and exact implementation/configuration identity. They do not create a second inference system, turn a domain result into backend validation or make a release-owned requirement depend on project Pack adoption. A backend launch derives its question, input roles and executable bytes from the running release, not project-supplied artifacts or activation rules. It requires the host's separately verified Kernel Build binding. Supporting this private execution path is not evidence that every stage contract or public lifecycle transition is implemented.

The first Check runner supports TypeScript/JavaScript outside the Project Server process, with host-enforced input/read scopes, network and credential restrictions, memory/time/output/model-call limits and observable termination. A library declaration is not a sandbox. Local-only policy also constrains supporting services and forbids remote fallback. Python and other runners share the versioned message contract only after separate support and qualification. These are desired execution boundaries; cooperative session and custody helpers alone do not establish them.

`pi-ai` owns model request serialization, provider protocols and stream assembly. Checks use it directly, without a producer session, tools, inherited conversation, discovery, automatic retry or fallback. Producer agents use `pi-coding-agent` sessions rather than a ChangeKernel-written agent loop. The execution host supplies operating-system containment and forwards only the exact authorized request through the shared model port.

Backend installation binds provider configuration, credentials, locality, model and settings; a consistent receipt does not prove that boundary. The initial supported integration is an explicitly configured OpenAI-compatible HTTP route. Pi's public per-request `fetch` hook enforces the [provider transport boundary](provider-boundary.md#effects-and-host-trust): reject redirects and bound decoded response and error bodies before model parsing, including framing omitted from translated chunks. This hook is not a replacement provider client, a raw socket-byte limit or hard memory containment; transport buffers and decompression remain execution-host concerns. Other Pi providers and transports require separate support and qualification.

The smallest backend composition connects the isolated Linux Check runner to one literal-loopback OpenAI-compatible route. Snapshot configuration before asynchronous setup; bind the endpoint, provider/model, transport bounds, sampling settings, verified backend build/dependency identity and an opaque backend-owned credential version. Do not publish credentials or a public hash of them. The trusted host verifies those identities and changes the credential binding when credentials change. Construction makes no inference call and grants no authority: domain launches require exact Check adoption; backend launches require the exact release-owned definition and verified Kernel Build. Both require readiness, bounded execution configuration and current permission. A loopback address does not prove that the service processes data locally; service behavior and surrounding host containment require separate qualification. This composition does not supply producer containment or permission to recover unresolved work.

The model bridge requests canonical structured JSON and validates it without repair or another inference attempt; this is not provider-constrained decoding. Explicit completion, bounded output and usable token usage are required. Pi reports cached input separately; its output count already includes reasoning, so reasoning is not charged twice. Missing or inconsistent usage is an operational failure, not zero-cost execution. Cancellation covers setup, dispatch and cleanup. Cleanup failure remains uncertain custody and blocks reuse.

Producer sessions receive explicit models, in-memory credentials/settings and an explicit resource loader. Project or user settings, extensions, skills, prompt templates and context files are not discovered implicitly. Tools are allowlisted by admitted names; unimplemented tool bindings are unavailable. Automatic retry and compaction are disabled until explicitly supported and bound to the run's authority. A resolved prompt promise or an idle agent is not success: inspect terminal state, usage and receipt-bound output.

Private session logs use the pinned Pi format, outside Project Git, with bounded reads/writes and exact identity checks on resume. Session identifiers, formats and receipt domains remain runtime-specific. Never relabel an older runtime's log or receipt as a Pi result, and never reconstruct a lost result by inference. Resume support does not itself authorize continued work or restore durable accepted Evidence.

## Durable Check attempts and completed results

The Check execution log is the append-only record of attempted Checks and their outcomes, not disposable diagnostic output. The Check host uses one stable, owner-private persistent custody root outside Project Git. A trusted operator provisions its execution log explicitly once and configures the returned identity. Reopening never initializes missing state or substitutes another identity. Runtime and worker scratch are disposable; the execution log is not. Changing roots, deleting history or restoring an older backup is not a retry mechanism.

The execution log retains domain and backend results under distinct record protocols. A backend result additionally binds its owner, stage, public ChangeKernel version, Kernel Build and release-owned definition. Do not relabel domain records as backend results, including records with matching input hashes. The host checks the expected origin again on retained delivery. Extending execution admission changes the runtime dependency identity; neither installation nor an identity string proves qualification.

Reserve and synchronize an exact execution binding before starting any worker or model call. Serialize reservations across processes; do not steal an incomplete reservation because its process exited or enough time elapsed. Publish a bounded immutable terminal record only after execution, provider custody and scratch cleanup settle. Synchronize the result and its directory before acknowledging completion. Partial, conflicting, missing or malformed records, uncertain cleanup and failed publication block further execution. A known stopped operational failure is retained separately, never as a Boolean judgment, and does not authorize another attempt.

Authority callbacks are repeatable checks of current rights, not consumption of a one-shot grant or reservation of another model budget. A fresh process can deliver a retained completed true or false result without another model call. Rebuild the current selection, verify implementation/runtime, input, execution, permission, result and Evidence bounds, and check present authority before both accessing and delivering it. Denial or cancellation of delivery must not erase a completed execution. Delivery reports zero new model calls; the private record retains the original call count. Retain the original selection as authorization provenance. A later selection may consume the completed evaluation only when the exact input, evaluator and permission bindings remain unchanged and current authority approves that selection; a different selection alone is not a reason to repeat inference. Unchanged stored bytes do not establish freshness of external observations or correctness of the judgment.

Assembly of an assessment uses an explicitly non-executing retained-result lookup, not a launch that happens to find a cached result. The host requires the exact ready adopted selection and artifact, checks current authority before custody access and again before delivery, and validates retained ownership and bounds as for execution reuse. Missing results remain unavailable: lookup creates no reservation, launches no worker and calls no model. Completed false results and stopped operational failures remain distinct. The whole execution log must still pass inspection, including unrelated attempts; unresolved or corrupt state blocks delivery. A full execution log can serve existing results without eviction. This authenticates custody under the trusted-host assumptions, not the supplied source material or adoption policy; source assembly must authenticate those separately.

The first execution log is bounded and stops when full; it does not silently evict attempts, prune history or supply an automatic retry/reset procedure. Its durability assumes a trusted local filesystem that honors synchronization and private storage protected from the Check. It is not proof against a privileged host rewriting or rolling back its complete history. Physical crash qualification, operator-authorized reconciliation of unresolved work, producer recovery and accepted Evidence publication remain separate obligations.

## Time bounds and uncertain execution

The local host checks the execution window before admitting a new run: issuance is inclusive and the deadline is exclusive. Returning an already tracked handle is observation, not a new execution, so idempotent inspection remains available after expiry. New work is rejected at the active or tracked-run bound; terminal identities are not discarded to make the same authorization executable again.

A host timer requests cancellation at the earlier of the authorization deadline and the admitted execution-time budget. This covers harness setup, provider setup, model execution and cleanup. The deadline cancellation intent binds that scheduled cutoff; the first explicit cancellation binding is preserved. The session runner checks cancellation before provider installation and again before model execution. The host also checks wall-clock and elapsed monotonic time after execution returns, so a delayed timer cannot turn late completion into success.

Cancellation is a request, not proof of termination. While cleanup is pending, the handle stays nonterminal without a receipt or quiescence claim. A cancellation during cleanup invalidates completed output. Closure is timestamped after cleanup returns, never backdated to model completion. If execution or cleanup throws, the host retains uncertain custody, requests cancellation and prevents re-execution under that authorization. These cooperative safeguards do not supply hard process containment or complete token, request, network and resource enforcement; unsupported execution requirements remain unavailable.

## Receipt-bound output custody

Agent Runtime handles remain metadata, not embedded output or accepted Check results. An optional `codewiki.port.agent-run-output@1.0.0` capability retrieves bounded output through a separate `codewiki.pi-execution-output-host@1.0.0` host capability. Neither capability widens Agent Runtime 1.1.0 or the execution-host 1.0.0 message grammar. Only backend wiring supplies the reader; a user-supplied run identifier or digest is not an authority grant.

Every lookup binds the run, authorization and exact terminal receipt. The host rejects mismatched authorization before disclosing a handle, returning output or cancelling work. The backend snapshots the completed binding before awaiting output, checks the receipt and quiescence identities and execution window, re-admits the response as bounded own data, and verifies the text digest and authorized byte budget. Recomputed hashes alone establish consistency, not provider honesty, containment or present-day Project authority. The existing `codewiki.agent-output@1.0.0` digest requires canonical text; noncanonical text is rejected rather than normalized.

The local host retains at most one mebibyte per output, also bounded by the authorized output budget and an aggregate custody limit. Oversized or evicted bytes are unavailable, not truncated. Eviction leaves retained receipts unchanged and never triggers another provider call. This custody is transient: a fresh host does not reconstruct accepted output from private session logs. Durable evidence capture and restart reconciliation remain separate requirements before a Gate can depend on the output. The output reader does not admit a semantic Check result, prove context coverage, enforce all runtime budgets or enable lifecycle evaluation.

The harness owns model transport, tool-loop mechanics and context packing. ChangeKernel owns semantic scope, authority, accepted output and continuation. See [evidence](evidence.md), [work execution](../flows/work-unit-execution.md), and [recovery](../flows/recovery.md).
