---
title: System Architecture
aliases: []
source-id: cw:diagram:architecture
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:dcdf7b7ed4fddb54270e4d0e254de3c0224f21e0f67db39e0565daf428f8e82c
        codewiki.legacy:source-path: system/diagrams/architecture.yaml
      kind: codewiki.legacy:knowledge
      subjectId: cw:diagram:architecture
  relationships: []
---
{
  "codewiki_id": "cw:diagram:architecture",
  "id": "architecture",
  "purpose": "Show the standalone local ChangeKernel product: pure semantics, runtime, native Git and agent interfaces. The Hub adds optional shared hosting and team collaboration over the same contracts, not a prerequisite for local operation.",
  "components": [
    {
      "id": "people",
      "concept": "cw:component:clients",
      "label": "Humans and Agents / local interfaces or optional Hub clients",
      "zone": "client"
    },
    {
      "id": "service",
      "concept": "cw:component:project-server",
      "label": "Authorized runtime: transversal stage validation and domain Check orchestration",
      "zone": "core"
    },
    {
      "id": "kernel",
      "concept": "cw:component:semantic-kernel",
      "label": "Pure record, identity and release-owned stage-transition contracts",
      "zone": "core"
    },
    {
      "id": "wiki",
      "concept": "cw:component:knowledge",
      "label": "Wiki: accepted understanding, desired outcomes and adopted policy",
      "zone": "repository"
    },
    {
      "id": "change",
      "concept": "cw:component:change-trace",
      "label": "Change: intent, inquiry and outcomes",
      "zone": "repository"
    },
    {
      "id": "git",
      "concept": "cw:component:project",
      "label": "Native Git foundation: exact state, Change records and history",
      "zone": "repository"
    },
    {
      "id": "validation",
      "concept": "cw:component:checks",
      "label": "Shared bounded execution: backend validators and adopted stage-specific domain Checks",
      "zone": "execution"
    },
    {
      "id": "tools",
      "concept": "cw:component:provider-boundary",
      "label": "External data connectors / execution integrations",
      "zone": "execution"
    },
    {
      "id": "information",
      "concept": "cw:component:evidence",
      "label": "On-demand information view, not another knowledge store",
      "zone": "core"
    }
  ],
  "connections": [
    {
      "id": "a-request",
      "from": "people",
      "to": "service",
      "type": "invokes",
      "label": "Proposes intent, queries grounds and requests scoped actions",
      "boundary": {
        "type": "trust",
        "failure": "Reject unauthorized scope or mismatched subjects."
      }
    },
    {
      "id": "a-evaluate",
      "from": "service",
      "to": "kernel",
      "type": "invokes",
      "label": "Validates exact contracts, subjects and recorded transition conditions"
    },
    {
      "id": "a-contract-result",
      "from": "kernel",
      "to": "service",
      "type": "returns",
      "label": "Returns deterministic contract outcomes without performing execution"
    },
    {
      "id": "a-validation",
      "from": "service",
      "to": "validation",
      "type": "invokes",
      "label": "Runs release-owned validators and adopted domain definitions with stage-bound inputs and limits"
    },
    {
      "id": "a-judgment",
      "from": "validation",
      "to": "service",
      "type": "returns",
      "label": "Returns owner- and stage-bound results, feedback and Evidence; grants no authority"
    },
    {
      "id": "a-store",
      "from": "service",
      "to": "git",
      "type": "writes",
      "label": "Persists exact scoped Change outcomes, including adoption and retirement",
      "boundary": {
        "type": "persistence",
        "failure": "Reconcile unknown writes; do not infer acceptance from objects alone."
      }
    },
    {
      "id": "a-wiki",
      "from": "git",
      "to": "wiki",
      "type": "produces",
      "label": "Retains knowledge bytes and adopted grounds"
    },
    {
      "id": "a-change",
      "from": "git",
      "to": "change",
      "type": "produces",
      "label": "Retains intent, reasons, judgments and exact subjects"
    },
    {
      "id": "a-tools",
      "from": "service",
      "to": "tools",
      "type": "authorizes",
      "label": "Authorizes optional external inputs or supported execution; not native Git access",
      "boundary": {
        "type": "authority",
        "failure": "No candidate self-authorization or execution of untrusted corpus instructions."
      }
    },
    {
      "id": "a-observe",
      "from": "tools",
      "to": "service",
      "type": "returns",
      "label": "Returns scoped evidence or operational stop; no acceptance authority",
      "boundary": {
        "type": "trust",
        "failure": "Reject substitution and reconcile unknown effects before retry."
      }
    },
    {
      "id": "a-native-history",
      "from": "service",
      "to": "git",
      "type": "reads",
      "label": "Reads retained history natively; no external connector required"
    },
    {
      "id": "a-historical-information",
      "from": "git",
      "to": "information",
      "type": "returns",
      "label": "Returns exact prior material and historical disposition"
    },
    {
      "id": "a-use-information",
      "from": "information",
      "to": "validation",
      "type": "produces",
      "label": "Supplies scoped evidence for inquiry; retrieval is not re-adoption"
    }
  ],
  "flows": [
    {
      "concept": "cw:flow:change-lifecycle",
      "paths": [
        {
          "connections": [
            "a-request",
            "a-evaluate",
            "a-contract-result",
            "a-validation",
            "a-judgment",
            "a-evaluate",
            "a-contract-result",
            "a-store",
            "a-wiki"
          ]
        },
        {
          "connections": [
            "a-store",
            "a-change"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:work-unit-execution",
      "paths": [
        {
          "connections": [
            "a-tools",
            "a-observe"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:recovery",
      "paths": [
        {
          "connections": [
            "a-native-history",
            "a-historical-information",
            "a-use-information",
            "a-judgment"
          ]
        }
      ]
    }
  ]
}
