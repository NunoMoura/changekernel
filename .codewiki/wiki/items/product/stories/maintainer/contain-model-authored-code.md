---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:maintainer.contain-model-code","codewiki_user":"cw:user:maintainer","description":"A maintainer wants programmatic model queries without granting model-written code ambient host or project authority.","status":"stable","tags":["product","story","runtime","security"],"title":"Contain Model-Authored Code","type":"User Story"},"codewiki.legacy:source-path":"product/stories/maintainer/contain-model-code.md"},"itemId":"cw:story:maintainer.contain-model-code","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:e946b16c294e2692ed3f3bd5edaf616156d23e8993c56427866678ca0a7c5091","codewiki.legacy:source-path":"product/stories/maintainer/contain-model-code.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:maintainer.contain-model-code"}],"relationships":[],"title":"Contain Model-Authored Code"}
---
# Contain Model-Authored Code

As a maintainer, I want model-authored programs to run through qualified disposable containment so they can compose bounded typed queries without reaching DSH internals, credentials, host resources, canonical Git state, or protected effects.

## Threat model

Model-authored source, arguments, stdout/stderr, completion values, binding calls, scheduling, and resource demand are hostile. Protected assets include CodeWiki authority, exact Run inputs, DSH/provider capability, credentials, host files, Git refs, Wiki/Trace, Evidence custody, and descendant-process lifecycle.

The trusted computing base is the qualified host operating system and its kernel, exact containment and Node executables, CodeWiki/DSH launch code, and explicitly admitted host bindings. Typed bindings are capabilities, not sanitization. A compromised host operating system/kernel, privileged administrator, side channel, or malicious admitted binding is outside this boundary and requires stronger infrastructure or removal of capability.

## Acceptance signals

- CodeWiki authorizes one exact DSH Run; DSH owns Agent execution mechanics. Execution Host contains the complete Run according to a qualified profile.
- Every model-authored Code Mode program uses a separate fresh inner operating-system sandbox. A Worker thread or ordinary process is not a security boundary.
- Outer Run receives only exact read-only Build/input material, bounded Wiki/Project query handles, and role-specific worktree access. Writable mounts are explicit private execution evidence and Worker artifact scope only.
- Inner program receives only lossless typed async bindings selected by host. It has no ambient filesystem/network/environment, credentials, child-process authority, persistence, DSH internals, provider route, Project Server handle, Git-ref writer, recursive model route, lifecycle command, or protected effect.
- Host validates exact executable paths, versions, digests, sandbox profile, namespaces, capabilities, mounts, descriptors, process group, CPU, memory, file, output, call, byte, timeout, and cancellation limits before launch. Linux process-count limits are installed after entry into the fresh user namespace so unrelated host-user threads cannot consume the sandbox budget.
- Provider credentials and unrestricted network remain outside contained process. Live model access uses one authenticated DSH-owned route or broker capability bound to the Run.
- Every execution receipt binds exact authorization, program/input, bindings, calls, outputs, limits, containment identity, and terminal behavior. Operational failure creates no semantic Result or lifecycle fact.
- Adversarial qualification covers file/symlink access, network, environment/credentials, descriptors, native/internal APIs, children/workers, nested namespaces, amplification, resource exhaustion, malformed protocol, identity drift, cancellation, timeout, and orphan cleanup.
- Direct tools, batch queries, and secure Code Mode remain workload-specific choices. Code Mode is eligible only when benchmarked composition savings preserve required task quality and authority closure.

CodeWiki does not claim to sandbox arbitrary external Agents, Omarchy plugins, host administrators, or code outside explicitly qualified Execution Host boundaries.
