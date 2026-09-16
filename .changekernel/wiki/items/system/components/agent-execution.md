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

Agents perform exploratory tool use, synthesis, authorized artifact changes and Evidence collection. Custom Checks are separate bounded functions: they receive prepared inputs, compute and optionally call the authorized model primitive. They cannot write Project artifacts, Wiki, sources, policy, lifecycle records or Project Server code. Models invoked by Checks have no tools or inherited producer conversation.

The first Check runner supports TypeScript/JavaScript outside the Project Server process, with host-enforced input/read scopes, network and credential restrictions, memory/time/output/model-call limits and observable termination. A library declaration is not a sandbox. Local-only policy also constrains supporting services and forbids remote fallback. Python and other runners share the versioned message contract only after separate support and qualification. These are desired execution boundaries; cooperative session and custody helpers alone do not establish them.

`pi-ai` owns model request serialization, provider protocols and stream assembly. Checks use it directly, without a producer session, tools, inherited conversation, discovery, automatic retry or fallback. Producer agents use `pi-coding-agent` sessions rather than a ChangeKernel-written agent loop. The execution host supplies operating-system containment and forwards only the exact authorized request through the shared model port.

Backend installation binds provider configuration, credentials, locality, model and settings; a consistent receipt does not prove that boundary. The initial supported integration is an explicitly configured OpenAI-compatible HTTP route. Pi's public per-request `fetch` hook enforces the [provider transport boundary](provider-boundary.md#effects-and-host-trust): reject redirects and bound decoded response and error bodies before model parsing, including framing omitted from translated chunks. This hook is not a replacement provider client, a raw socket-byte limit or hard memory containment; transport buffers and decompression remain execution-host concerns. Other Pi providers and transports require separate support and qualification.

The model bridge requests canonical structured JSON and validates it without repair or another inference attempt; this is not provider-constrained decoding. Explicit completion, bounded output and usable token usage are required. Pi reports cached input separately; its output count already includes reasoning, so reasoning is not charged twice. Missing or inconsistent usage is an operational failure, not zero-cost execution. Cancellation covers setup, dispatch and cleanup. Cleanup failure remains uncertain custody and blocks reuse.

Producer sessions receive explicit models, in-memory credentials/settings and an explicit resource loader. Project or user settings, extensions, skills, prompt templates and context files are not discovered implicitly. Tools are allowlisted by admitted names; unimplemented tool bindings are unavailable. Automatic retry and compaction are disabled until explicitly supported and bound to the run's authority. A resolved prompt promise or an idle agent is not success: inspect terminal state, usage and receipt-bound output.

Private session logs use the pinned Pi format, outside Project Git, with bounded reads/writes and exact identity checks on resume. Session identifiers, formats and receipt domains remain runtime-specific. Never relabel an older runtime's log or receipt as a Pi result, and never reconstruct a lost result by inference. Resume support does not itself authorize continued work or restore durable accepted Evidence.

## Time bounds and uncertain execution

The local host checks the execution window before admitting a new run: issuance is inclusive and the deadline is exclusive. Returning an already tracked handle is observation, not a new execution, so idempotent inspection remains available after expiry. New work is rejected at the active or tracked-run bound; terminal identities are not discarded to make the same authorization executable again.

A host timer requests cancellation at the earlier of the authorization deadline and the admitted execution-time budget. This covers harness setup, provider setup, model execution and cleanup. The deadline cancellation intent binds that scheduled cutoff; the first explicit cancellation binding is preserved. The session runner checks cancellation before provider installation and again before model execution. The host also checks wall-clock and elapsed monotonic time after execution returns, so a delayed timer cannot turn late completion into success.

Cancellation is a request, not proof of termination. While cleanup is pending, the handle stays nonterminal without a receipt or quiescence claim. A cancellation during cleanup invalidates completed output. Closure is timestamped after cleanup returns, never backdated to model completion. If execution or cleanup throws, the host retains uncertain custody, requests cancellation and prevents re-execution under that authorization. These cooperative safeguards do not supply hard process containment or complete token, request, network and resource enforcement; unsupported execution requirements remain unavailable.

## Receipt-bound output custody

Agent Runtime handles remain metadata, not embedded output or accepted Check results. An optional `codewiki.port.agent-run-output@1.0.0` capability retrieves bounded output through a separate `codewiki.pi-execution-output-host@1.0.0` host capability. Neither capability widens Agent Runtime 1.1.0 or the execution-host 1.0.0 message grammar. Only backend wiring supplies the reader; a user-supplied run identifier or digest is not an authority grant.

Every lookup binds the run, authorization and exact terminal receipt. The host rejects mismatched authorization before disclosing a handle, returning output or cancelling work. The backend snapshots the completed binding before awaiting output, checks the receipt and quiescence identities and execution window, re-admits the response as bounded own data, and verifies the text digest and authorized byte budget. Recomputed hashes alone establish consistency, not provider honesty, containment or present-day Project authority. The existing `codewiki.agent-output@1.0.0` digest requires canonical text; noncanonical text is rejected rather than normalized.

The local host retains at most one mebibyte per output, also bounded by the authorized output budget and an aggregate custody limit. Oversized or evicted bytes are unavailable, not truncated. Eviction leaves retained receipts unchanged and never triggers another provider call. This custody is transient: a fresh host does not reconstruct accepted output from private session logs. Durable evidence capture and restart reconciliation remain separate requirements before a Gate can depend on the output. The output reader does not admit a semantic Check result, prove context coverage, enforce all runtime budgets or enable lifecycle evaluation.

The harness owns model transport, tool-loop mechanics and context packing. ChangeKernel owns semantic scope, authority, accepted output and continuation. See [evidence](evidence.md), [work execution](../flows/work-unit-execution.md), and [recovery](../flows/recovery.md).
