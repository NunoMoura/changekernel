---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"application/yaml","codewiki.legacy:metadata":{},"codewiki.legacy:source-path":"system/diagrams/architecture.yaml"},"itemId":"cw:diagram:architecture","itemType":"codewiki.legacy:knowledge","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:dcdf7b7ed4fddb54270e4d0e254de3c0224f21e0f67db39e0565daf428f8e82c","codewiki.legacy:source-path":"system/diagrams/architecture.yaml"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:diagram:architecture"}],"relationships":[],"title":"System Architecture"}
---
{
  "codewiki_id": "cw:diagram:architecture",
  "id": "architecture",
  "purpose": "Show Change-controlled Wiki evolution on mandatory native Git, hot current knowledge and cold information access, with optional external data and execution integrations.",
  "components": [
    {
      "id": "people",
      "concept": "cw:component:clients",
      "label": "Humans and Agents / Hub clients",
      "zone": "client"
    },
    {
      "id": "service",
      "concept": "cw:component:project-server",
      "label": "Authorized collaboration service",
      "zone": "core"
    },
    {
      "id": "kernel",
      "concept": "cw:component:semantic-kernel",
      "label": "Meaning, validation and transition consequences",
      "zone": "core"
    },
    {
      "id": "wiki",
      "concept": "cw:component:knowledge",
      "label": "Wiki: current accepted knowledge (hot, persistent)",
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
      "label": "Contextual semantic validation",
      "zone": "core"
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
      "label": "Supplies exact baseline, candidate, intent and observations"
    },
    {
      "id": "a-validation",
      "from": "kernel",
      "to": "validation",
      "type": "invokes",
      "label": "Interprets support, uncertainty and applicable obligations"
    },
    {
      "id": "a-judgment",
      "from": "validation",
      "to": "service",
      "type": "returns",
      "label": "Returns supported, contradicted or unresolved findings; grants no authority"
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
            "a-validation",
            "a-judgment",
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
