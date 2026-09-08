---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:design:product","description":"Interaction rules for minimal, truthful, terminal-first Semantic Kernel operations.","status":"stable","tags":["product","design","operations"],"title":"CodeWiki Console","type":"Design System","version":"alpha"},"codewiki.legacy:source-path":"product/DESIGN.md"},"itemId":"cw:design:product","itemType":"codewiki.legacy:design-system","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:dde8b062975e50edb38aa1962c5aede69723cfbfb757c30792f62c790eeb0c35","codewiki.legacy:source-path":"product/DESIGN.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:design:product"}],"relationships":[],"title":"CodeWiki Console"}
---
# CodeWiki Console

## Purpose

CodeWiki is Git-compatible version control for humans and Agents: a native version-control interface connecting exact artifacts with accepted intent, accountable Changes, and checked realization. The deterministic Semantic Kernel is the mechanism layer; Project Server is the sole semantic control plane; stock Git stores content, history, ancestry, and refs. This is not a Git fork, replacement object format, Git-project endorsement, or universal drop-in compatibility claim.

The primary interface is the native CodeWiki CLI, with a small terminal-first Console for exact inspection, recovery, and narrow authenticated operations. A scoped Git compatibility adapter supports an explicitly declared command subset for existing Agents and scripts. Rich Wiki authoring, Agent chat, project planning, IDE, desktop, and product experiences belong to external applications over the same public API.

Console presents accountable work in concepts users understand. Change is the primary unit; status, Work, Checks, Decisions, outcome, next action, and required user action explain its progress. Kernel builds, Git refs and object IDs, digests, receipts, protocol versions, controller generations, DSH internals, and storage mechanics never become normal interaction vocabulary. They remain available only through explicit audit or troubleshooting operations.

Console never reads `.codewiki/**` as an independent authority, calls models directly, fabricates state, or receives privileged imports unavailable to another Client.

## Product boundary

CodeWiki repository owns Kernel API/Client SDK, operator commands, optional terminal monitor, conformance fixtures, backup/recovery operations, and safe degraded inspection. External CodeWiki App, IDE, mobile, web, chat, and desktop products own their UX, releases, threat model, and identity acquisition. Project Server still validates proof and project AuthZ for every operation.

An external reference client is a separate read-only Omarchy Agent Skill and shell panel. It consumes authenticated API status, pending Decisions, Gates/Checks, Alignment, and handoff. It receives no direct project-file access or privileged mutation path.

Tools are project-first and system-accessible: installation may serve several explicitly selected independent repositories, but discovery grants no authority or cross-project access. Semantic contracts are OS/harness-neutral; execution support is qualified per exact adapter and host profile. Choosing an interactive harness does not qualify it as a managed executor.

## Intent, artifacts, and continuity

Wiki is the semantic half of version control, not a manual attached to commit history. It makes accepted descriptive, historical, and normative meaning addressable. Git records exact artifacts; Change Trace preserves decisions, rationale, and Work facts; Evidence and Results support judgments. State and Change are a public mental model over these owners, not new storage or replacement lifecycle entities.

Project continuity should survive a safe session handoff without prior conversation. Necessary task facts and unresolved questions must first be explicit in their appropriate owners; a recent-message count cannot guarantee that. Clients retrieve bounded exact context rather than maintaining another authoritative memory. The goal is fewer repeated explanations, regressions, and corrective interventions across Agents, not perfect model judgment.

## Version-control commands

Ordinary staging and commits create cheap development checkpoints, not semantic admission, passing Gates, completion, or release activation. Protected transitions require authenticated authority, exact subjects, current Gates, and expected-head/tip CAS. Publication remains a separately authorized effect. Native commands expose intent and realization alongside artifacts; Git machine-output modes preserve declared byte formats rather than mixing in native semantic envelopes.

Unsupported commands, flags, versions, aliases, configuration, or helpers stop explicitly; no unrestricted Git passthrough exists. A wrapper is not a security boundary. Managed storage access, permissions, credentials, and effect controls prevent alternate Git binaries, libraries, shared-worktree internals, or direct writes from bypassing canonical authority. Unrestricted workspaces receive assistance with truthful custody limits. Installation never replaces system Git globally, interferes with unrelated repositories, or removes independently authorized native recovery.

## Default information

Console answers:

1. Which Changes need attention?
2. What changed and why does it matter?
3. What Work and Checks are complete, blocked, or still needed?
4. What happens next?
5. Does the user need to decide or act?

A compact header shows the Project name, whether CodeWiki is ready, active Change count, attention required, and freshness in plain language. Change rows show title, intent, status, progress, blocker, next action, and whether a user decision is waiting. Internal identities never displace these answers.

## Views

### Changes and Work

Show each Change's intent, current status, completed and remaining Work, blockers, and next action. Preserve stable links behind readable labels. Do not restate accepted Wiki meaning as a mutable requirement list.

### Checks and Decisions

Explain which Checks passed, what needs attention, why progress stopped, and which user Decision is required. Never hide a required failure, expose hidden model reasoning, or make users interpret execution records.

### Activity and outcomes

Describe Agent activity as planned, working, stopped, completed, or needing attention. Describe delivery and other external outcomes separately from local Change completion. Do not expose session, process, provider, retry, or custody mechanics in ordinary status.

### Recovery

State what is affected, the last known safe state, what CodeWiki can do, and whether the user must approve it. Never retry protected actions speculatively.

### Audit and troubleshooting

An explicit technical view may expose bounded immutable identities, evidence, freshness, and recovery diagnostics needed by an authorized operator or auditor. It is separate from normal navigation, copyable rather than memorized, and never reveals secrets, hidden reasoning, or unauthorized content.

## Interaction rules

- Read-only by default; shipping Console grants no authority.
- Every normal message answers what happened, why it matters, what happens next, and whether the user must act.
- Use Change, status, Work, Checks, Decisions, outcome, and next action as the visible vocabulary.
- Ask for semantic decisions such as “Accept this Change?” or “Update CodeWiki now?” while binding the exact authorized subject internally.
- Keep selection separate from authenticated authorization.
- Translate stale or inconsistent internal state into a stable explanation and safe next action instead of leaking backend errors.
- Disable unavailable actions with one stable user-facing reason.
- Refresh after an event gap or replacement instead of guessing history.
- Never infer activity, readiness, causality, acceptance, or completion from process existence or elapsed time.
- Sanitize terminal escapes and untrusted text.
- Exclude credentials, provider headers, raw DSH data, raw model output, hidden reasoning, private worktree content, unauthorized Item existence, and backend identifiers from ordinary presentation.
- Work without color, pointer, animation, or large terminal; deterministic command output remains automation-friendly.

## Degraded operation

Console remains useful when assistants, integrations, external apps, or the live service are unavailable. It distinguishes the last verified state, observations that may be stale, safe read-only diagnosis, and actions unavailable until recovery. Normal messaging explains the consequence and next safe action; explicit troubleshooting may reveal bounded technical evidence. Offline inspection never bypasses quiescence, authentication, expected-state comparison, backup, or recovery rules.
