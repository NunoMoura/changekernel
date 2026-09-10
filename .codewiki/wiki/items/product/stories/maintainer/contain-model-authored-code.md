---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:maintainer.contain-model-code","codewiki_user":"cw:user:maintainer","description":"A maintainer wants programmatic model queries without granting model-written code ambient host or project authority.","status":"stable","tags":["product","story","runtime","security"],"title":"Contain Model-Authored Code","type":"User Story"},"codewiki.legacy:source-path":"product/stories/maintainer/contain-model-code.md"},"itemId":"cw:story:maintainer.contain-model-code","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:e946b16c294e2692ed3f3bd5edaf616156d23e8993c56427866678ca0a7c5091","codewiki.legacy:source-path":"product/stories/maintainer/contain-model-code.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:maintainer.contain-model-code"}],"relationships":[],"title":"Contain Execution"}
---
# Contain Execution

A Maintainer can distinguish semantic approval from permission to run tools or perform protected effects. An executor must enforce declared filesystem, credential, network, descendant-process, resource and output scope and observe cancellation/quiescence where required.

Worktrees organize working directories and indexes; they are not adversarial sandboxes. Input documents, model outputs and producer receipts do not grant authority. An ordinary process, Worker thread, or typed binding is not by itself a security boundary. Unavailable enforcement must disable the capability rather than simulate successful custody.

## Threat model and qualification

Treat model-authored source, arguments, calls, outputs, scheduling and resource demand as untrusted. The declared trusted computing base includes the qualified host OS/kernel, containment and execution binaries, launch code and explicitly admitted bindings. A compromised kernel, privileged host administrator, side channel or malicious admitted binding is not implicitly contained by this claim.

Qualification must challenge file/symlink escape, environment and credential exposure, network, descriptors, child processes, amplification, resource exhaustion, malformed protocols, subject substitution, cancellation, timeout and orphan cleanup. Execution profiles state what they enforce and exclude; a receipt cannot replace physical observation. Optional code-composition techniques must earn measured value without requiring a particular inner interpreter or harness throughout the product.

Unknown effects stop blind replay. Private live-operation tracking remains separate from accepted knowledge and must be reconciled across restart. A safe final artifact cannot excuse forbidden intermediate execution.
