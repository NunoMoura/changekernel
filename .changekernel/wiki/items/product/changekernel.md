---
title: ChangeKernel
aliases:
  - ChangeKernel Hub
  - ChangeKernel Console
source-id: cw:design:product
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:dde8b062975e50edb38aa1962c5aede69723cfbfb757c30792f62c790eeb0c35
        codewiki.legacy:source-path: product/DESIGN.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:design:product
  relationships: []
---
# ChangeKernel

ChangeKernel is the semantic foundation for project change: a shared project layer for people, agents, harnesses and applications, not an agent, a harness or an operating-system kernel. Change is the organizing primitive. The local product combines a pure semantic core, Project Server runtime, Wiki, semantic Git management and the Decision, Planning, Implementation and Review lifecycle.

The optional **Hub** adds shared hosting, team access and collaboration around Changes and Wiki. The local product works without the Hub; the Hub uses the same semantic foundation rather than owning a different acceptance model. Software, operations, research and other work share this core; their methods and evidence differ. A GitHub alternative is a longer-term collaboration ambition, not a claim that the initial product replaces its hosting, review and ecosystem features.

Establish the usable local ChangeKernel product first. These are product and authority boundaries, not a requirement for separate repositories, packages or services before there is a demonstrated need. The [first dogfood contract](../system/components/package.md#minimum-local-dogfood) does not require a Hub.

## Change and Wiki

**Change is the primary mechanism of evolution.** It carries intent, motivation, assumptions, alternatives, deliberation, plans, attempts and outcomes. **Wiki is current accepted project knowledge**, expressed in tracked Markdown wherever it lives, not a special authoring folder or an independently maintained intent object.

Only an authorized, accepted scoped transition carried by a Change promotes information into knowledge, revises it, retires it or adopts it again. A proposal, retrieved answer or ordinary checkpoint does not accomplish that by itself. Wiki retains current commitments, concise grounds and uncertainty; Change preserves the reasons for their evolution.

## Native history and optional information

Git is foundational: it preserves intent-bearing Change records, exact Wiki outcomes, snapshots, ancestry and transport. Retired knowledge remains accessible on demand through native history, alongside information supplied by optional external data connectors. No separate Archive or Sources knowledge system, archive database or optional Git connector is required. GitHub is an optional hosting integration and competing collaboration product, not acceptance authority.

Hot knowledge is the current validation basis, not everything stuffed into every prompt. Cold information may be unexamined material or previously accepted knowledge; retrieval does not make it current again. The information pool is an access concept, not another authoring primitive. Users need not understand Git to work with it.

## Inquiry and continuity

Decision evaluates justified intent and credible feasibility. Planning develops paths, dependencies and shared obligations. Implementation attempts authorized work and records discoveries. Review evaluates the actual recomposed outcome. Feedback returns to its cause; material intent revision revisits Decision.

The simple model is: **Wiki holds what we agree; agents propose and produce changes; adopted Checks evaluate them using Evidence; ChangeKernel controls acceptance and remembers why.** Raw data supplies information, artifacts embody work, and [Alignment](../system/components/alignment.md) derives what is wanted, observed and being done about the gap. An observation is one way of obtaining Evidence, not another product object.

All semantic Checks and Packs are custom, including first-party offerings. Checks are read-only functions that may combine code and bounded model inference through one library; TypeScript/JavaScript comes first, Python later. Wiki defines adopted meaning and exact evaluation policy; Packs distribute methods without silently adopting competing rules. The [Kernel](../system/components/changekernel.md) enforces record, authority and execution guarantees, not a hidden business-value judge. Reports claim only what the selected [Checks](../system/components/checks.md) established. Host instructions and Skills guide work but cannot replace enforcement. Public marketplace distribution is a later option, not a minimum-release dependency.

A fresh participant can recover current knowledge, why it applies, relevant historical grounds, unresolved assumptions, in-flight work and next permitted action. Preserving exact outcomes is not rerunning reasoning or effects. Committing a procedure does not prove adoption; acceptance does not grant publication or deployment.

See [Wiki](../system/components/wiki.md), [Change](../system/components/change-trace.md), [information and evidence](../system/components/evidence.md), and [lifecycle](../system/flows/change-lifecycle.md).
