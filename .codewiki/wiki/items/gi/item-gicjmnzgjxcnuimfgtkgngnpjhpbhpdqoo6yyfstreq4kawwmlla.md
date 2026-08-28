---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:maintainer.enforce-project-standards","codewiki_user":"cw:user:maintainer","description":"A maintainer wants open project-owned Checks to gate each development stage with exact outcomes and actionable feedback.","status":"stable","tags":["product","story","checks"],"title":"Enforce Project Standards","type":"User Story"},"codewiki.legacy:source-path":"product/stories/maintainer/enforce-project-standards.md"},"itemId":"cw:story:maintainer.enforce-project-standards","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:b2f66b6e893b76455777eab2cb1231c7839ea4ac8580e7122cadb173c89a8bc5","codewiki.legacy:source-path":"product/stories/maintainer/enforce-project-standards.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:maintainer.enforce-project-standards"}],"relationships":[],"title":"Enforce Project Standards"}
---
# Enforce Project Standards

As a maintainer, I want CodeWiki to apply project expectations as bounded Checks so code, policy, design, review, and delivery requirements remain inspectable and editable rather than hidden in agent prompts or product code.

## Acceptance signals

- The selected Domain Plugin supplies one versioned default Pack template for Decision, Planning, Implementation, and Review; bootstrap validates and copies those bytes once, existing projects adopt them explicitly, and users may edit or delete every adopted default without CodeWiki restoring it.
- Every local or marketplace-installed Pack uses direct `<check-id>/` directories with `check.json` and exactly one `CHECK.md` or `CHECK.mjs`, and may contain one optional standard Agent Skill under `skill/<skill-name>/`.
- Pack Skills guide only work-producing Agents; Code and Model Checks independently judge exact outputs and never inherit producer Skills, resources, memory, material queries, or tools.
- Project Server resolves one stage-wide Implementation Check Pack policy and applies it to every Work Unit Candidate; Work Units and workers cannot select bespoke Packs, while immutable evaluation inputs remain unit-specific.
- CodeWiki never autonomously authors or restores project Packs after explicit seed or adoption; manual edits, user-controlled Agents, and authenticated App forms operate on the same documented files.
- Every Check defines one pass/fail boundary, one stable failure code, and one feedback contract; binary and thresholded quantitative measurements both reduce to pass or fail.
- Every top-level Model Check invocation uses its own fresh isolated tool-free session and may run in bounded parallel with independent Checks; Code Checks run only in admitted sandboxes.
- Completed Checks produce pass or fail Results. Operational inability stops the Gate attempt with an exact recovery reason, produces no Result, and does not crash the system.
- Checks run with exact caching, bounded parallelism, and code-before-model fail-fast execution.
- A stage with no Checks passes with a visible `no_checks_configured` warning; malformed content stops only the affected Gate.
- Review may use automated Model or Code Checks, provider Evidence, optional human Review Evidence, or any user-chosen combination.
- Npm packages use a simple discoverable Check Pack manifest or conventional `check-packs/` tree, install without lifecycle scripts, and materialize only editable Skill and runtime Check files through the App; `package.json` remains transport metadata and never replaces `check.json`.
- Check Packs cannot install Domain, DSH, Client, or Cordis Plugins, Infrastructure Providers, Run Process settings, credentials, or lifecycle behavior.
- A project-specific Pack remains separate from Domain defaults and controller implementation. Independent controller N loads the accepted protected-head Pack snapshot to judge subject N+1, so one Candidate cannot author or activate the policy that judges itself.
