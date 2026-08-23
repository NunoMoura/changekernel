---
type: User Story
codewiki_id: cw:story:maintainer.contain-model-code
title: Contain Model-Authored Code
description: A maintainer wants programmatic model queries without granting model-written code ambient host or project authority.
status: stable
codewiki_user: cw:user:maintainer
tags: [product, story, runtime, security]
---
# Contain Model-Authored Code

As a maintainer, I want model-authored programs to run through qualified disposable containment so they can compose bounded typed queries without reaching DSH internals, credentials, host resources, canonical state, or protected effects.

## Threat model

Model-authored source, stdout and stderr, completion values, binding arguments, log volume, scheduling, and resource demand are hostile. Protected assets include the trusted Runtime Bridge and DSH Agent Session, authenticated outer Run Process protocol descriptors, provider capability, credentials, host files, canonical repository and project state, evidence chain, and descendant-process lifecycle.

The trusted computing base is the host operating system and kernel; exact qualified Bubblewrap, `prlimit`, and Node executables; the CodeWiki launch and worker bootstrap code; and every explicitly admitted host binding. Typed bindings are capabilities, not a sanitization boundary. Their host implementations retain ordinary authorization, snapshot, budget, and ledger checks.

Qualification does not claim protection from a compromised host or kernel, privileged host administration, hardware side channels, or a malicious explicitly admitted binding. Those risks require a stronger separately qualified substrate or removal of the binding.

## Acceptance signals

- Production DSH execution uses two separately qualified operating-system boundaries: an outer sandbox around the whole authenticated Run Process and a fresh inner sandbox for each model-authored Code Mode invocation.
- The outer sandbox mounts only the exact read-only Runtime Build, input manifest, replay fixture, Project Context Snapshot, and host-local provider-broker Unix socket; writable mounts are limited to explicit Session evidence and an Implementation-only Workbench.
- The inner sandbox receives only lossless-JSON typed async bindings selected by the host. It has no filesystem, network, ambient environment, credentials, child-process authority, inherited private descriptor, persistence, DSH Session, provider route, Project Server handle, canonical-storage handle, recursive model route, lifecycle operation, or protected effect.
- Both boundaries isolate user, PID, network, IPC, and UTS namespaces, drop capabilities, expose only explicit read-only system mounts and private temporary state, close undeclared descriptors, and enforce CPU, address-space, file-size, open-file, and process ceilings.
- Node's Permission Model is defense in depth for the inner worker and never substitutes for operating-system containment. A worker thread or ordinary child process is not a qualified security boundary.
- Admission binds and revalidates real paths, versions, and SHA-256 digests for Bubblewrap, `prlimit`, and Node before every launch. Missing, unsupported, malformed, or drifted identity fails closed.
- Each Code Mode call binds program, frame, output, binding-call, binding-byte, wall-time, and V8 heap limits. Timeout, cancellation, malformed protocol traffic, oversized output, substrate death, or resource exhaustion hard-terminates the complete process group.
- Nested user namespaces are denied by default. They are enabled only for the already-contained outer DSH process when it must create the separately qualified inner sandbox.
- Provider credentials and unrestricted egress remain outside the outer network namespace. A contained live Run reaches only one authenticated host-side broker through an explicitly mounted absolute Unix-domain socket.
- Authenticated Run Process material and Execution Ledger evidence bind the normalized Code Mode configuration, sandbox profile, Node identity, static input, nested binding calls, terminal output, and failure behavior.
- Adversarial qualification covers filesystem reads and writes, symlinks, network, environment and credentials, child processes and workers, native and internal APIs, inherited descriptors, nested namespaces, output and binding amplification, CPU, memory, process count, timeout, cancellation, malformed worker traffic, identity drift, orphan cleanup, and live broker transport through the outer boundary.
- Native direct, native batch, and secure Code Mode remain workload-specific choices. Code Mode is eligible only when measured composition savings preserve the configured Candidate-quality floor.
