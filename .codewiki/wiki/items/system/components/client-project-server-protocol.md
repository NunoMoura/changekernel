---
{"aliases":["Client SDK","Kernel API","Protocol"],"attributes":{"codewiki.component:ownership":{"sourcePatterns":["src/api/contracts/**","src/api/transport/**"],"testPatterns":["tests/api/contracts/**","tests/api/transport/**"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:protocol","codewiki_id":"cw:component:protocol","codewiki_relationships":[{"rationale":"Protocol supplies bounded exact-input project queries.","target":"cw:story:agent.retrieve-bounded-context","type":"realizes"},{"rationale":"Protocol supplies typed idempotent access to authoritative Project Server operations.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}],"codewiki_source_patterns":["src/protocol/**"],"codewiki_test_patterns":["tests/protocol/**"],"description":"Defines current Client protocol and target Kernel API commands, queries, events, canonical transport bindings, bounds, and normalization.","status":"stable","tags":["system","component"],"title":"Client-Project Server Protocol","type":"System Component"},"codewiki.legacy:source-path":"system/components/protocol.md"},"itemId":"cw:component:protocol","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:8c16341a02f91746ace20701c677c0fb10f824b628c30139bee34c974435eca7","codewiki.legacy:source-path":"system/components/protocol.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:protocol"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Protocol supplies bounded exact-input project queries.","target":"cw:story:agent.retrieve-bounded-context","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:agent.retrieve-bounded-context"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Protocol supplies typed idempotent access to authoritative Project Server operations.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.automate-safe-work"}],"title":"Client-Project Server Protocol"}
---
# Client-Project Server Protocol

CodeWiki exposes one version-neutral semantic Product UAPI, historically named Kernel API, for authenticated commands, exact-snapshot queries, capabilities, events, errors, and operation handles. Project Server serves that API; Clients never invoke pure-Kernel modules, ports, adapters, or stores directly. Persisted envelopes, adapters, transport profiles, and fixtures carry explicit versions. Local socket, HTTP, CLI, App, MCP, and Client SDK bindings add no operation, authority, hidden state, or direct storage access.

Every request binds repository identity, Client identity, authenticated Actor proof where required, requested capability, Actor-scoped semantic idempotency key for commands, expiry, bounds, and an exact source or expected project/Change head. Project Server maps identity to current project AuthZ. Client type, model identity, Git credentials, route, UI state, and possession of repository bytes grant nothing.

## State and Change

State and Change describe public inspection and accountable transitions over Git, Wiki, Trace, Work, Gates, Results, Evidence, and derived Views. They introduce no replacement State store, lifecycle entity, or semantic owner. Accepted intent, observed reality, passing Results, and transition authority remain distinct facts.

## Commands

Command payloads contain requested semantics only. They cannot assert authenticated identity, Project Server time, Gate outcome, Check Result, lifecycle state, DSH receipt, Plugin receipt, accepted Wiki state, completion, or provider success.

`proposeChanges` is the primary proposal command. It binds one expected project head and a bounded set of unique request-local keys. Project Server either assigns all Change IDs and creates all independent full-snapshot managed refs/Traces or creates none. A singular proposal wraps one entry. Revision commands bind one stable Change ID and exact expected managed tip; stale input returns explicit reconciliation facts.

Decision commands bind one unchanged Proposed Change tip and current Gate. Authenticated operations are `commitChange`, `rejectChange`, `deferChange`, `resumeChange`, and `withdrawChange` according to current state and authority. `commitChange` binds current project head, Change tip, Actor, Gate, active Checks/Results, Change type, realization route, and active-Change compatibility. It never accepts client-authored lifecycle or Git outcome fields.

Planning, Work integration, reconciliation, Review, completion, Preview, cancellation, and protected-effect commands similarly bind exact stage subjects, current Gates, expected heads/tips, authority, capabilities, and idempotency. Before Review, Project Server derives one exact reconciled prospective Completion project-artifact tree. Completion preserves those reviewed project-artifact bytes and adds only the bounded containing-commit Trace operation. A changed subject, dependency, classification, policy, capability, or head requires fresh affected evaluation.

## Queries and Views

Every canonical semantic query selects one exact canonical commit or managed Change tip; noncanonical workspace observations follow the bounded contract below. Moving selectors such as `head` resolve once and the response returns the explicit OID. Responses bind operation semantics, repository, source OID, authorization/redaction, derivation identity, coverage, ordering, cursor/bounds, truncation, freshness, unknowns, citations, and response digest.

Minimum read operations cover Project discovery/capabilities, operational status, Wiki Item get/list/search, links/backlinks, Definition resolution/usages, Item history/attribution, semantic diff, Proposed Changes, pending Decisions, Gates, active Checks, Results, Work, Review, and exact proposed-tip View receipts. Exact ID queries fall back to Git when private indexes are absent. Approximate retrieval is labeled and cannot answer identity or absence questions.

Project Server owns semantic query contracts and authorized execution. Harnesses choose requests and prompt packing, not source interpretation or required-context policy. A bounded task-context View composes existing owners with explicit source, derivation, coverage, and required target references. Missing required context is an explicit incomplete/stopped outcome, never silently truncated success or another persistent memory object.

Clients never receive a canonical Git writer, private-state path, raw credential, opaque DSH Session, hidden Agent context, or mutable View handle. External Agents receive the same bounded API under explicit capabilities. Read-only Clients cannot submit proposals or confirm protected operations.

## Native CLI and Git compatibility

Native CodeWiki CLI, SDK, UI, and supported Git-compatible requests bind the same authenticated UAPI operations. No binding gets internal modules, an additional writer, or lifecycle shortcuts. Exact reads remain provider-independent. Explicit project selection, unauthorized-project non-disclosure, exact source propagation, bounded output, strict parsing, and noninteractive behavior are conformance requirements.

Native automation uses stable JSON responses or bounded NDJSON streams, documented exit codes, structured stdin where declared, and sanitized diagnostics on stderr. Git compatibility instead preserves its declared stdout/stderr bytes, framing, machine formats, and exit behavior. Semantic receipts remain available through native operations. Equivalent requests preserve semantic outcomes separately from transport-format parity.

Capability discovery declares supported command/flag combinations, Git versions/object formats, and execution restrictions. Inspection, scoped checkpoint mutation, protected transition, and publication are separate capabilities. An ordinary Git commit is not `commitChange`, Work admission, completion, or activation. Protected transitions retain current authority, exact Gates, canonical reconciliation, reviewed-byte preservation, and expected-head/tip CAS; external effects require separate authorization.

Working-tree/index inspection binds an authorized workspace, exact base, and bounded observation fingerprint explicitly labelled noncanonical. Mutable bytes do not acquire invented commit OIDs or accepted-state receipts. Local mutations validate exact workspace preconditions. This adds no new State store or privileged path around Work/external-artifact admission.

Unknown commands, flags, aliases, configuration/environment overrides, or hooks/helpers outside the admitted profile stop explicitly, never unrestricted passthrough. Managed storage/credential boundaries must withstand alternate Git/library/direct-write access independently of command routing. Unrestricted workspaces retain actual provenance. System Git and independent native recovery remain outside global interception.

Long operations expose durable handles; cancelling a wait does not prove execution stopped. Retry and recovery reconcile exact authorization and operation identity before starting another effect.

## Events, errors, and recovery

Events are notifications over persisted state, ordered by stable cursor and generation. A gap, restart, authorization change, or generation change forces commit-consistent refresh; Clients never infer transitions from missing events or process activity.

Errors use stable codes and bounded structured facts for stale head/tip, authorization, missing source, unsupported capability, invalid object/tree/Trace, incomplete Gate, conflict, stop, and recovery. They exclude secrets and hidden model reasoning. Retry safety follows operation idempotency and exact current state, never a generic transport retry.

Every supported transport or persisted-envelope version boundary is explicit in the release support matrix. Unsupported envelopes stop without inferred translation. Obsolete pre-stable envelopes remain in Git and release evidence, not as normal Product inputs, and no adapter dual-writes semantic owners.
