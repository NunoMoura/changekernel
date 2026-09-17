---
title: Change Lifecycle Diagram
aliases: []
source-id: cw:diagram:lifecycle
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:6b58e2834ba1e678ce882b6e16963a487c385de43e0c1a948a309df07ec2a63f
        codewiki.legacy:source-path: system/diagrams/lifecycle.yaml
      kind: codewiki.legacy:knowledge
      subjectId: cw:diagram:lifecycle
  relationships: []
---
{
  "codewiki_id": "cw:diagram:lifecycle",
  "id": "lifecycle",
  "purpose": "Show four gated stages, agent–gate feedback loops and accepted scoped adoption, revision, retirement and re-adoption; Git preserves exact outcomes and native cold history while reads do not change authority.",
  "components": [
    {
      "id": "agent",
      "concept": "cw:component:agent-execution",
      "label": "Agent prepares and revises stage work",
      "zone": "execution"
    },
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
      "label": "Backend validation and adopted domain Checks with exact inputs, results and Evidence",
      "zone": "execution"
    },
    {
      "id": "service",
      "concept": "cw:component:project-server",
      "label": "Stage gates, scoped authority and acceptance",
      "zone": "core"
    },
    {
      "id": "git",
      "concept": "cw:component:project",
      "label": "Native Git: current Wiki, Change outcomes and cold history",
      "zone": "repository"
    }
  ],
  "connections": [
    {
      "id": "l-submit",
      "from": "agent",
      "to": "service",
      "type": "invokes",
      "label": "Submits exact stage work for gate assessment; submission grants no authority"
    },
    {
      "id": "l-feedback",
      "from": "service",
      "to": "agent",
      "type": "returns",
      "label": "Returns assessment feedback and permitted next action; route repair to its cause and stop on unresolved custody"
    },
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
      "label": "After the Decision gate and required approval, supplies accepted report, Evidence, scope and gaps to fresh Planning session"
    },
    {
      "id": "l-attempt",
      "from": "planning",
      "to": "implementation",
      "type": "produces",
      "label": "After the Planning gate and required authority, binds dependencies, shared obligations and permitted effects",
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
      "label": "After the Implementation gate, supplies actual combined outcome, observations and gaps"
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
      "id": "l-check-result",
      "from": "validation",
      "to": "service",
      "type": "returns",
      "label": "Returns Boolean results and feedback distinguishing contradiction, insufficient support and inability"
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
      "label": "Persists exact checkpoints and accepted scoped knowledge transitions; mere checkpointing is not acceptance",
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
            "l-submit",
            "l-feedback"
          ]
        },
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
            "l-check-result"
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
