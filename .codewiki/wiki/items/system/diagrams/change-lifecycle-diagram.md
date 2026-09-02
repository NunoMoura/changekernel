---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"application/yaml","codewiki.legacy:metadata":{},"codewiki.legacy:source-path":"system/diagrams/lifecycle.yaml"},"itemId":"cw:diagram:lifecycle","itemType":"codewiki.legacy:knowledge","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:6b58e2834ba1e678ce882b6e16963a487c385de43e0c1a948a309df07ec2a63f","codewiki.legacy:source-path":"system/diagrams/lifecycle.yaml"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:diagram:lifecycle"}],"relationships":[],"title":"Change Lifecycle Diagram"}
---
{
  "codewiki_id": "cw:diagram:lifecycle",
  "id": "lifecycle",
  "purpose": "Show one Change from proposal through semantic Change Commit, optional planned realization, reviewed Completion Commit, and separate Delivery.",
  "components": [
    {
      "id": "clients",
      "concept": "cw:component:clients",
      "label": "Authenticated Client / Actor",
      "zone": "client"
    },
    {
      "id": "project-server",
      "concept": "cw:component:project-server",
      "label": "Project Server",
      "zone": "core"
    },
    {
      "id": "intake",
      "concept": "cw:component:change-intake",
      "label": "Change Intake",
      "zone": "core"
    },
    {
      "id": "decision",
      "concept": "cw:component:decision",
      "label": "Decision",
      "zone": "core"
    },
    {
      "id": "planning",
      "concept": "cw:component:planning",
      "label": "Planning",
      "zone": "core"
    },
    {
      "id": "implementation",
      "concept": "cw:component:implementation",
      "label": "Implementation",
      "zone": "core"
    },
    {
      "id": "review",
      "concept": "cw:component:review",
      "label": "Review",
      "zone": "core"
    },
    {
      "id": "checks",
      "concept": "cw:component:checks",
      "label": "Type-conditioned Gates",
      "zone": "core"
    },
    {
      "id": "runtime",
      "concept": "cw:component:runtime",
      "label": "Agent Runtime port / DSH adapter",
      "zone": "execution"
    },
    {
      "id": "project",
      "concept": "cw:component:project",
      "label": "Full-snapshot Git Project Store",
      "zone": "repository"
    },
    {
      "id": "knowledge",
      "concept": "cw:component:knowledge",
      "label": "Wiki Items",
      "zone": "repository"
    },
    {
      "id": "change-trace",
      "concept": "cw:component:change-trace",
      "label": "Append-only Change Trace",
      "zone": "repository"
    },
    {
      "id": "work-state",
      "concept": "cw:component:work-state",
      "label": "Derived WorkState",
      "zone": "core"
    },
    {
      "id": "plugins",
      "concept": "cw:component:provider-boundary",
      "label": "Admitted Delivery Plugin",
      "zone": "execution"
    }
  ],
  "connections": [
    {
      "id": "l-client-server",
      "from": "clients",
      "to": "project-server",
      "type": "invokes",
      "label": "submits authenticated proposal or lifecycle command",
      "boundary": {
        "type": "trust",
        "failure": "Reject invalid proof, authority, bounds, idempotency, or head."
      }
    },
    {
      "id": "l-server-intake",
      "from": "project-server",
      "to": "intake",
      "type": "invokes",
      "label": "validates proposal intake and assigns Change identity"
    },
    {
      "id": "l-intake-decision",
      "from": "intake",
      "to": "decision",
      "type": "produces",
      "label": "produces exact Proposed Change tip"
    },
    {
      "id": "l-decision-server",
      "from": "decision",
      "to": "project-server",
      "type": "returns",
      "label": "returns exact Decision eligibility facts"
    },
    {
      "id": "l-checks-server",
      "from": "checks",
      "to": "project-server",
      "type": "returns",
      "label": "returns exact current Gate outcome"
    },
    {
      "id": "l-server-project",
      "from": "project-server",
      "to": "project",
      "type": "writes",
      "label": "creates proposal, Change, reconciliation, Work, or Completion commit",
      "boundary": {
        "type": "persistence",
        "failure": "Preserve refs unless object, Trace, Gate, authority, and CAS close."
      }
    },
    {
      "id": "l-project-knowledge",
      "from": "project",
      "to": "knowledge",
      "type": "produces",
      "label": "supplies accepted Wiki meaning"
    },
    {
      "id": "l-project-trace",
      "from": "project",
      "to": "change-trace",
      "type": "produces",
      "label": "supplies exact OIDs and containing-commit Trace facts"
    },
    {
      "id": "l-project-server",
      "from": "project",
      "to": "project-server",
      "type": "returns",
      "label": "returns exact committed or reconciled Project state",
      "boundary": {
        "type": "persistence",
        "failure": "Stop on missing objects, invalid ancestry, or stale refs."
      }
    },
    {
      "id": "l-server-planning",
      "from": "project-server",
      "to": "planning",
      "type": "invokes",
      "label": "starts Planning for project realization"
    },
    {
      "id": "l-planning-server",
      "from": "planning",
      "to": "project-server",
      "type": "returns",
      "label": "returns proposed Work Unit and dependency facts"
    },
    {
      "id": "l-server-implementation",
      "from": "project-server",
      "to": "implementation",
      "type": "invokes",
      "label": "claims and assigns ready Work Unit"
    },
    {
      "id": "l-server-runtime",
      "from": "project-server",
      "to": "runtime",
      "type": "authorizes",
      "label": "authorizes exact role-bound DSH Run",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale Assignment, context, route, capability, or scope."
      }
    },
    {
      "id": "l-runtime-server",
      "from": "runtime",
      "to": "project-server",
      "type": "returns",
      "label": "returns untrusted Run output and closure for validation",
      "boundary": {
        "type": "authority",
        "failure": "Reject incomplete custody or changed subject bytes."
      }
    },
    {
      "id": "l-implementation-server",
      "from": "implementation",
      "to": "project-server",
      "type": "returns",
      "label": "returns exact ready Work assignment facts"
    },
    {
      "id": "l-server-review",
      "from": "project-server",
      "to": "review",
      "type": "invokes",
      "label": "starts Review over prospective project-artifact tree"
    },
    {
      "id": "l-review-server",
      "from": "review",
      "to": "project-server",
      "type": "returns",
      "label": "returns Review eligibility for exact project-artifact tree"
    },
    {
      "id": "l-server-plugins",
      "from": "project-server",
      "to": "plugins",
      "type": "authorizes",
      "label": "authorizes separate post-completion Delivery",
      "boundary": {
        "type": "authority",
        "failure": "Preserve local completion on effect failure or unknown."
      }
    },
    {
      "id": "l-plugins-server",
      "from": "plugins",
      "to": "project-server",
      "type": "returns",
      "label": "returns bounded Delivery receipt",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale or incomplete receipt; do not replay speculatively."
      }
    },
    {
      "id": "l-trace-workstate",
      "from": "change-trace",
      "to": "work-state",
      "type": "produces",
      "label": "supplies Work Unit and lifecycle projection facts",
      "boundary": {
        "type": "persistence",
        "failure": "Stop projection on invalid Trace prefix or source OID."
      }
    },
    {
      "id": "l-workstate-server",
      "from": "work-state",
      "to": "project-server",
      "type": "returns",
      "label": "returns derived readiness and blockers"
    },
    {
      "id": "l-server-checks",
      "from": "project-server",
      "to": "checks",
      "type": "invokes",
      "label": "freezes exact stage subject and dispatches active Checks"
    }
  ],
  "flows": [
    {
      "concept": "cw:flow:change-lifecycle",
      "paths": [
        {
          "connections": [
            "l-client-server",
            "l-server-intake",
            "l-intake-decision",
            "l-decision-server",
            "l-server-checks",
            "l-checks-server",
            "l-server-project",
            "l-project-knowledge"
          ]
        },
        {
          "connections": [
            "l-project-server",
            "l-server-planning",
            "l-planning-server",
            "l-server-checks",
            "l-checks-server",
            "l-server-implementation",
            "l-implementation-server",
            "l-server-runtime",
            "l-runtime-server",
            "l-server-checks",
            "l-checks-server",
            "l-server-project",
            "l-project-server",
            "l-server-review",
            "l-review-server",
            "l-server-checks",
            "l-checks-server",
            "l-server-project",
            "l-project-trace"
          ]
        },
        {
          "connections": [
            "l-server-plugins",
            "l-plugins-server",
            "l-server-project",
            "l-project-trace"
          ]
        },
        {
          "connections": [
            "l-project-trace",
            "l-trace-workstate",
            "l-workstate-server"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:decision-to-planning",
      "paths": [
        {
          "connections": [
            "l-decision-server",
            "l-server-checks",
            "l-checks-server",
            "l-server-project",
            "l-project-server",
            "l-server-planning"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:planning-to-implementation",
      "paths": [
        {
          "connections": [
            "l-planning-server",
            "l-server-checks",
            "l-checks-server",
            "l-server-implementation"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:implementation-to-review",
      "paths": [
        {
          "connections": [
            "l-implementation-server",
            "l-server-runtime",
            "l-runtime-server",
            "l-server-checks",
            "l-checks-server",
            "l-server-review"
          ]
        }
      ]
    }
  ]
}
