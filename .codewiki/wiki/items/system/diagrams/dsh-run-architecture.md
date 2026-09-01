---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"application/yaml","codewiki.legacy:metadata":{},"codewiki.legacy:source-path":"system/diagrams/runtime.yaml"},"itemId":"cw:diagram:runtime","itemType":"codewiki.legacy:knowledge","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:058ed18a486d38495dcae892347ea55e3655009e38d7e8611bfb7de146d59db8","codewiki.legacy:source-path":"system/diagrams/runtime.yaml"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:diagram:runtime"}],"relationships":[],"title":"DSH Run Architecture"}
---
{
  "codewiki_id": "cw:diagram:runtime",
  "id": "runtime",
  "purpose": "Show CodeWiki authorization around DSH execution, exact Wiki context, role scope, separate Code Check sandboxes, provider calls, receipts, and recovery.",
  "components": [
    {
      "id": "project-server",
      "concept": "cw:component:project-server",
      "label": "Project Server",
      "zone": "core"
    },
    {
      "id": "runtime",
      "concept": "cw:component:runtime",
      "label": "DSH Run",
      "zone": "execution"
    },
    {
      "id": "execution-host",
      "concept": "cw:component:runtime",
      "label": "Execution Host",
      "zone": "execution"
    },
    {
      "id": "code-sandbox",
      "concept": "cw:component:checks",
      "label": "Code Check sandbox",
      "zone": "execution"
    },
    {
      "id": "provider",
      "concept": "cw:component:provider-boundary",
      "label": "AI Provider",
      "zone": "provider"
    },
    {
      "id": "project",
      "concept": "cw:component:project",
      "label": "Git snapshot / isolated worktree",
      "zone": "repository"
    },
    {
      "id": "knowledge",
      "concept": "cw:component:knowledge",
      "label": "Wiki Items / Dictionary View",
      "zone": "repository"
    },
    {
      "id": "change-trace",
      "concept": "cw:component:change-trace",
      "label": "Change Trace",
      "zone": "repository"
    },
    {
      "id": "checks",
      "concept": "cw:component:checks",
      "label": "Gate / Check Runs",
      "zone": "core"
    },
    {
      "id": "work-state",
      "concept": "cw:component:work-state",
      "label": "Derived WorkState",
      "zone": "core"
    },
    {
      "id": "alignment",
      "concept": "cw:component:alignment",
      "label": "Derived Alignment",
      "zone": "core"
    },
    {
      "id": "evidence",
      "concept": "cw:component:evidence",
      "label": "Evidence",
      "zone": "core"
    }
  ],
  "connections": [
    {
      "id": "r-server-host",
      "from": "project-server",
      "to": "execution-host",
      "type": "authorizes",
      "label": "authorizes exact role, context, tools, route, scope, and budget",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, authority, route, context, or host profile."
      }
    },
    {
      "id": "r-host-dsh",
      "from": "execution-host",
      "to": "runtime",
      "type": "executes",
      "label": "launches contained DSH Agent execution"
    },
    {
      "id": "r-dsh-provider",
      "from": "runtime",
      "to": "provider",
      "type": "invokes",
      "label": "uses exact DSH-owned model route",
      "boundary": {
        "type": "network",
        "failure": "Stop on unavailable route, cancellation, or receipt failure."
      }
    },
    {
      "id": "r-provider-dsh",
      "from": "provider",
      "to": "runtime",
      "type": "returns",
      "label": "returns normalized model output and provider facts",
      "boundary": {
        "type": "network",
        "failure": "Reject unauthenticated, malformed, or mismatched response."
      }
    },
    {
      "id": "r-dsh-host",
      "from": "runtime",
      "to": "execution-host",
      "type": "returns",
      "label": "returns bounded output and internal execution closure"
    },
    {
      "id": "r-host-server",
      "from": "execution-host",
      "to": "project-server",
      "type": "returns",
      "label": "returns DSH Run result and receipt or operational stop",
      "boundary": {
        "type": "authority",
        "failure": "Fabricate no proposal, Result, integration, or transition."
      }
    },
    {
      "id": "r-server-checks",
      "from": "project-server",
      "to": "checks",
      "type": "invokes",
      "label": "freezes Gate and dispatches active Check Runs"
    },
    {
      "id": "r-checks-sandbox",
      "from": "checks",
      "to": "code-sandbox",
      "type": "executes",
      "label": "runs deterministic Code Check",
      "boundary": {
        "type": "authority",
        "failure": "Produce no Result on sandbox, input, limit, or output failure."
      }
    },
    {
      "id": "r-sandbox-checks",
      "from": "code-sandbox",
      "to": "checks",
      "type": "returns",
      "label": "returns bounded Check output or stop",
      "boundary": {
        "type": "authority",
        "failure": "Reject malformed, stale, or excess output."
      }
    },
    {
      "id": "r-checks-server",
      "from": "checks",
      "to": "project-server",
      "type": "returns",
      "label": "returns passed, failed, or stopped Gate outcome"
    },
    {
      "id": "r-server-trace",
      "from": "project-server",
      "to": "change-trace",
      "type": "writes",
      "label": "appends durable semantic receipt references",
      "boundary": {
        "type": "persistence",
        "failure": "Preserve prior ref when Trace, OIDs, receipts, or CAS fail."
      }
    },
    {
      "id": "r-server-project",
      "from": "project-server",
      "to": "project",
      "type": "reads",
      "label": "resolves exact Project subject and writable scope",
      "boundary": {
        "type": "persistence",
        "failure": "Stop on missing objects, stale head, or invalid scope."
      }
    },
    {
      "id": "r-project-knowledge",
      "from": "project",
      "to": "knowledge",
      "type": "produces",
      "label": "supplies exact Wiki tree and target Item blobs"
    },
    {
      "id": "r-knowledge-dsh",
      "from": "knowledge",
      "to": "runtime",
      "type": "queries",
      "label": "serves bounded snapshot-fixed Wiki tools",
      "boundary": {
        "type": "authority",
        "failure": "Return explicit unknown on source, AuthZ, or coverage failure."
      }
    },
    {
      "id": "r-trace-server",
      "from": "change-trace",
      "to": "project-server",
      "type": "returns",
      "label": "reloads exact semantic history",
      "boundary": {
        "type": "persistence",
        "failure": "Stop on invalid prefix, object, or receipt reference."
      }
    },
    {
      "id": "r-project-workstate",
      "from": "project",
      "to": "work-state",
      "type": "produces",
      "label": "supplies projection source identities",
      "boundary": {
        "type": "persistence",
        "failure": "Stop on missing or contradictory source identity."
      }
    },
    {
      "id": "r-workstate-alignment",
      "from": "work-state",
      "to": "alignment",
      "type": "produces",
      "label": "supplies current work and blocker facts"
    }
  ],
  "flows": [
    {
      "concept": "cw:flow:work-unit-execution",
      "paths": [
        {
          "connections": [
            "r-server-host",
            "r-host-dsh",
            "r-dsh-provider",
            "r-provider-dsh",
            "r-dsh-host",
            "r-host-server",
            "r-server-checks",
            "r-checks-sandbox",
            "r-sandbox-checks",
            "r-checks-server",
            "r-server-trace"
          ]
        },
        {
          "connections": [
            "r-server-project",
            "r-project-knowledge",
            "r-knowledge-dsh",
            "r-dsh-host",
            "r-host-server"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:recovery",
      "paths": [
        {
          "connections": [
            "r-trace-server",
            "r-server-project",
            "r-project-workstate",
            "r-workstate-alignment"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:change-lifecycle",
      "paths": [
        {
          "connections": [
            "r-knowledge-dsh",
            "r-dsh-host",
            "r-host-server"
          ]
        }
      ]
    }
  ]
}
