---
{"aliases":["Provider Boundary"],"attributes":{"codewiki.component:ownership":{"sourcePatterns":[],"testPatterns":[],"testPolicy":"external","testRationale":"Provider implementations remain outside Product authority and qualify through exact adapter and receipt fixtures."},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:component:provider-boundary","codewiki_relationships":[{"rationale":"Provider Boundary preserves explicit authentication and failure behavior for remote coordination and effects.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}],"description":"Represents external project, Delivery, AI Provider, package, and collaboration services outside CodeWiki authority.","status":"stable","tags":["system","component","external"],"title":"Provider Boundary","type":"System Component"},"codewiki.legacy:source-path":"system/components/provider-boundary.md"},"itemId":"cw:component:provider-boundary","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:bad7a8847790b4da060d6cafb7e6537c8e4dfaf9869a1545a0fe7737735425c5","codewiki.legacy:source-path":"system/components/provider-boundary.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:provider-boundary"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Provider Boundary preserves explicit authentication and failure behavior for remote coordination and effects.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.automate-safe-work"}],"title":"Integrations and Providers"}
---
# Integrations and Providers

External data connectors optionally expose users' databases, document systems and services as information for inquiry. They do not define Wiki, Change or acceptance. Git is foundational native storage/history, not one of these optional connectors. The core and native historical reads must work without them.

Other integrations present clients, supply model/tool execution or connect hosting/delivery systems. GitHub is optional. These effect interfaces must not become competing policy systems or the sole store of accepted reasons and outcomes.

## Bounded information access

A connector returns scoped source material with origin, version/observation context and limitations. Enforce permissions and retention/disclosure rules before retrieval; do not silently copy private company data into Git or claim immutable history from a mutable URL. Missing or unavailable material limits assurance. Indexes remain derived, and source instructions are data rather than executable authority.

Shared retrieval can combine external material with native history without erasing provenance. Returned content and generated synthesis remain information until an accepted Change adopts knowledge. See [evidence](evidence.md).

## Effects and host trust

Credentials, paid calls, remote writes and deployment require applicable authority before execution. Bind adapter identity, exact inputs, limits and observed outcomes; reconcile unknown effects before retry.

A PR merge flag, passing host check or producer receipt does not prove semantic acceptance. Assess the actual combined candidate, not an isolated old head; hooks and client-side checks alone do not prevent bypass. Never execute untrusted candidate code with privileged credentials through a hosting workflow. Preserve portable records independently of host UI state.
