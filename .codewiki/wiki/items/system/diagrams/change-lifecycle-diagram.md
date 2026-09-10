---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"application/yaml","codewiki.legacy:metadata":{},"codewiki.legacy:source-path":"system/diagrams/lifecycle.yaml"},"itemId":"cw:diagram:lifecycle","itemType":"codewiki.legacy:knowledge","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:6b58e2834ba1e678ce882b6e16963a487c385de43e0c1a948a309df07ec2a63f","codewiki.legacy:source-path":"system/diagrams/lifecycle.yaml"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:diagram:lifecycle"}],"relationships":[],"title":"Change Lifecycle Diagram"}
---
{
  "codewiki_id": "cw:diagram:lifecycle",
  "id": "lifecycle",
  "purpose": "Show four retained inquiry loops sharing semantic validation, feedback to its cause, exact Git checkpoints, and acceptance distinct from realization or external effects.",
  "components": [
    {
      "id": "intake",
      "concept": "cw:component:change-intake",
      "label": "Intent-bearing proposal",
      "zone": "core"
    },
    {
      "id": "decision",
      "concept": "cw:component:decision",
      "label": "Decision: justified transition hypothesis",
      "zone": "core"
    },
    {
      "id": "planning",
      "concept": "cw:component:planning",
      "label": "Planning: paths, shared obligations and dependencies",
      "zone": "core"
    },
    {
      "id": "implementation",
      "concept": "cw:component:implementation",
      "label": "Implementation: authorized attempts and discoveries",
      "zone": "execution"
    },
    {
      "id": "review",
      "concept": "cw:component:review",
      "label": "Review: actual recomposition and remaining obligations",
      "zone": "core"
    },
    {
      "id": "validation",
      "concept": "cw:component:checks",
      "label": "Shared contextual semantic validation",
      "zone": "core"
    },
    {
      "id": "service",
      "concept": "cw:component:project-server",
      "label": "Scoped authority and acceptance",
      "zone": "core"
    },
    {
      "id": "git",
      "concept": "cw:component:project",
      "label": "Exact Git checkpoints, Wiki and Change records",
      "zone": "repository"
    }
  ],
  "connections": [
    {
      "id": "l-propose",
      "from": "intake",
      "to": "decision",
      "type": "produces",
      "label": "Preserves original intent and uncertainty"
    },
    {
      "id": "l-plan",
      "from": "decision",
      "to": "planning",
      "type": "produces",
      "label": "Carries justified pursuit, scope and unresolved assumptions"
    },
    {
      "id": "l-attempt",
      "from": "planning",
      "to": "implementation",
      "type": "produces",
      "label": "Binds dependencies, shared obligations and permitted effects",
      "boundary": {
        "type": "authority",
        "failure": "Stop when required scope, context or custody is unavailable."
      }
    },
    {
      "id": "l-join",
      "from": "implementation",
      "to": "review",
      "type": "produces",
      "label": "Supplies actual combined candidate, observations and gaps"
    },
    {
      "id": "l-defect",
      "from": "review",
      "to": "implementation",
      "type": "returns",
      "label": "Routes artifact defects to implementation"
    },
    {
      "id": "l-conflict",
      "from": "review",
      "to": "planning",
      "type": "returns",
      "label": "Routes path or dependency conflicts to planning"
    },
    {
      "id": "l-intent",
      "from": "review",
      "to": "decision",
      "type": "returns",
      "label": "Routes material intent revision to explicit reconsideration"
    },
    {
      "id": "l-context",
      "from": "service",
      "to": "validation",
      "type": "invokes",
      "label": "Assesses each stage in exact current context"
    },
    {
      "id": "l-finding",
      "from": "validation",
      "to": "service",
      "type": "returns",
      "label": "Returns scoped supported, contradicted or unresolved findings"
    },
    {
      "id": "l-review",
      "from": "review",
      "to": "service",
      "type": "returns",
      "label": "Supplies whole-outcome assessment, not publication authority"
    },
    {
      "id": "l-save",
      "from": "service",
      "to": "git",
      "type": "writes",
      "label": "Retains authorized checkpoints and outcomes; checkpointed is not accepted",
      "boundary": {
        "type": "persistence",
        "failure": "Reject stale subjects and do not claim realization without evidence."
      }
    }
  ],
  "flows": [
    {
      "concept": "cw:flow:change-lifecycle",
      "paths": [
        {
          "connections": [
            "l-propose",
            "l-plan",
            "l-attempt",
            "l-join",
            "l-review",
            "l-save"
          ]
        },
        {
          "connections": [
            "l-context",
            "l-finding"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:decision-to-planning",
      "paths": [
        {
          "connections": [
            "l-plan"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:planning-to-implementation",
      "paths": [
        {
          "connections": [
            "l-attempt"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:implementation-to-review",
      "paths": [
        {
          "connections": [
            "l-join"
          ]
        },
        {
          "connections": [
            "l-defect"
          ]
        },
        {
          "connections": [
            "l-conflict"
          ]
        },
        {
          "connections": [
            "l-intent"
          ]
        }
      ]
    }
  ]
}
