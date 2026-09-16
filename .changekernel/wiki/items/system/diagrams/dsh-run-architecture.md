---
title: DSH Run Architecture
aliases: []
source-id: cw:diagram:runtime
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:058ed18a486d38495dcae892347ea55e3655009e38d7e8611bfb7de146d59db8
        codewiki.legacy:source-path: system/diagrams/runtime.yaml
      kind: codewiki.legacy:knowledge
      subjectId: cw:diagram:runtime
  relationships: []
---
{
  "codewiki_id": "cw:diagram:runtime",
  "id": "runtime",
  "purpose": "Show replaceable Agent execution (including a possible DSH adapter), bounded tools/model observations, real custody, exact evidence and fresh-process reconciliation without treating a worktree as a sandbox.",
  "components": [
    {
      "id": "service",
      "concept": "cw:component:project-server",
      "label": "Authorized collaboration service",
      "zone": "core"
    },
    {
      "id": "runtime",
      "concept": "cw:component:runtime",
      "label": "Agent Runtime / selected harness adapter",
      "zone": "execution"
    },
    {
      "id": "tools",
      "concept": "cw:component:provider-boundary",
      "label": "Bounded models, tools and integrations",
      "zone": "provider"
    },
    {
      "id": "workspace",
      "concept": "cw:component:project",
      "label": "Exact workspace / Git subjects (not a sandbox)",
      "zone": "repository"
    },
    {
      "id": "evidence",
      "concept": "cw:component:evidence",
      "label": "Scoped observations and retained judgments",
      "zone": "core"
    },
    {
      "id": "work",
      "concept": "cw:component:work-state",
      "label": "Derived work and unknown effects",
      "zone": "core"
    },
    {
      "id": "preview",
      "concept": "cw:component:preview",
      "label": "Optional qualified Preview",
      "zone": "execution"
    }
  ],
  "connections": [
    {
      "id": "r-authorize",
      "from": "service",
      "to": "runtime",
      "type": "authorizes",
      "label": "Binds context, role, tools, effect scope and budgets",
      "boundary": {
        "type": "authority",
        "failure": "Required unavailable enforcement stops execution."
      }
    },
    {
      "id": "r-tools",
      "from": "runtime",
      "to": "tools",
      "type": "invokes",
      "label": "Uses only authorized tool/model routes",
      "boundary": {
        "type": "network",
        "failure": "No undeclared credential, paid, network or protected effect."
      }
    },
    {
      "id": "r-output",
      "from": "tools",
      "to": "runtime",
      "type": "returns",
      "label": "Returns bounded observations or operational stop",
      "boundary": {
        "type": "trust",
        "failure": "Model output is not proof or authority."
      }
    },
    {
      "id": "r-workspace",
      "from": "runtime",
      "to": "workspace",
      "type": "reads",
      "label": "Uses exact scoped bytes under separately enforced custody",
      "boundary": {
        "type": "authority",
        "failure": "Worktree separation does not establish process or credential isolation."
      }
    },
    {
      "id": "r-receipt",
      "from": "runtime",
      "to": "service",
      "type": "returns",
      "label": "Reports truthful partial output and observed custody",
      "boundary": {
        "type": "trust",
        "failure": "Missing or contradictory custody blocks unsafe retry."
      }
    },
    {
      "id": "r-evidence",
      "from": "service",
      "to": "evidence",
      "type": "produces",
      "label": "Preserves exact accepted grounds and limitations"
    },
    {
      "id": "r-work",
      "from": "evidence",
      "to": "work",
      "type": "produces",
      "label": "Supplies exact outcomes; no reconstructed model judgments"
    },
    {
      "id": "r-recover",
      "from": "work",
      "to": "service",
      "type": "returns",
      "label": "Reports in-flight, stopped and unknown state for reconciliation"
    },
    {
      "id": "r-preview",
      "from": "runtime",
      "to": "preview",
      "type": "invokes",
      "label": "Uses optional subject/generation-bound observation",
      "boundary": {
        "type": "authority",
        "failure": "Unavailable or unqualified Preview is not simulated success."
      }
    }
  ],
  "flows": [
    {
      "concept": "cw:flow:work-unit-execution",
      "paths": [
        {
          "connections": [
            "r-authorize",
            "r-tools",
            "r-output",
            "r-receipt",
            "r-evidence"
          ]
        },
        {
          "connections": [
            "r-workspace"
          ]
        },
        {
          "connections": [
            "r-preview"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:recovery",
      "paths": [
        {
          "connections": [
            "r-work",
            "r-recover"
          ]
        }
      ]
    }
  ]
}
