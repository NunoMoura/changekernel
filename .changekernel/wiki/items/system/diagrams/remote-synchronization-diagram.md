---
title: Remote Synchronization Diagram
aliases: []
source-id: cw:diagram:synchronization
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:2b2c32456c6101fce535007dbd4ff3c0876594a7e3918f48ab9ba243b95c65ac
        codewiki.legacy:source-path: system/diagrams/synchronization.yaml
      kind: codewiki.legacy:knowledge
      subjectId: cw:diagram:synchronization
  relationships: []
---
{
  "codewiki_id": "cw:diagram:synchronization",
  "id": "synchronization",
  "purpose": "Show native Git state/history with optional remote hosting/delivery, not an optional Git data connector; combined-Change acceptance and external effects remain distinct.",
  "components": [
    {
      "id": "service",
      "concept": "cw:component:project-server",
      "label": "Authorized collaboration service",
      "zone": "core"
    },
    {
      "id": "git",
      "concept": "cw:component:project",
      "label": "Required native Git objects, refs and retained history",
      "zone": "repository"
    },
    {
      "id": "integration",
      "concept": "cw:component:provider-boundary",
      "label": "Optional remote hosting / delivery integration",
      "zone": "execution"
    },
    {
      "id": "intake",
      "concept": "cw:component:change-intake",
      "label": "External work inquiry",
      "zone": "core"
    },
    {
      "id": "history",
      "concept": "cw:component:change-trace",
      "label": "Portable intent, grounds and outcome records",
      "zone": "repository"
    },
    {
      "id": "alignment",
      "concept": "cw:component:alignment",
      "label": "Observed local/remote alignment and uncertainty",
      "zone": "core"
    }
  ],
  "connections": [
    {
      "id": "s-observe",
      "from": "service",
      "to": "integration",
      "type": "authorizes",
      "label": "Requests scoped exact remote observation",
      "boundary": {
        "type": "authority",
        "failure": "Observation is not publication or acceptance authority."
      }
    },
    {
      "id": "s-receive",
      "from": "integration",
      "to": "service",
      "type": "returns",
      "label": "Returns exact Proposed Change/ref facts, not a semantic acceptance receipt",
      "boundary": {
        "type": "trust",
        "failure": "Reject mismatched subjects or untrusted privileged execution."
      }
    },
    {
      "id": "s-intake",
      "from": "service",
      "to": "intake",
      "type": "invokes",
      "label": "Routes unmatched work through intent and effect inquiry"
    },
    {
      "id": "s-candidate",
      "from": "intake",
      "to": "service",
      "type": "returns",
      "label": "Supplies exact Current Project state and combined Proposed Change for assessment"
    },
    {
      "id": "s-store",
      "from": "service",
      "to": "git",
      "type": "writes",
      "label": "Preserves authorized exact accepted states",
      "boundary": {
        "type": "persistence",
        "failure": "Do not transfer isolated-head judgments to changed joins."
      }
    },
    {
      "id": "s-history",
      "from": "git",
      "to": "history",
      "type": "produces",
      "label": "Retains portable reasons and judgments beyond host UI"
    },
    {
      "id": "s-publish",
      "from": "service",
      "to": "integration",
      "type": "authorizes",
      "label": "Separately permits publication or delivery",
      "boundary": {
        "type": "authority",
        "failure": "Require applicable effect authority before execution."
      }
    },
    {
      "id": "s-effect",
      "from": "integration",
      "to": "alignment",
      "type": "returns",
      "label": "Reports observed success, failure or unknown effect",
      "boundary": {
        "type": "network",
        "failure": "Reconcile unknown effects before retry."
      }
    },
    {
      "id": "s-status",
      "from": "alignment",
      "to": "service",
      "type": "returns",
      "label": "Distinguishes local acceptance, remote observation and realization"
    }
  ],
  "flows": [
    {
      "concept": "cw:flow:remote-state-synchronization",
      "paths": [
        {
          "connections": [
            "s-observe",
            "s-receive"
          ]
        },
        {
          "connections": [
            "s-publish",
            "s-effect",
            "s-status"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:external-candidate-admission",
      "paths": [
        {
          "connections": [
            "s-intake",
            "s-candidate",
            "s-store",
            "s-history"
          ]
        }
      ]
    }
  ]
}
