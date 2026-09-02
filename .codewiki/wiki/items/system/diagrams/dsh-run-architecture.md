---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"application/yaml","codewiki.legacy:metadata":{},"codewiki.legacy:source-path":"system/diagrams/runtime.yaml"},"itemId":"cw:diagram:runtime","itemType":"codewiki.legacy:knowledge","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:058ed18a486d38495dcae892347ea55e3655009e38d7e8611bfb7de146d59db8","codewiki.legacy:source-path":"system/diagrams/runtime.yaml"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:diagram:runtime"}],"relationships":[],"title":"DSH Run Architecture"}
---
{
  "codewiki_id": "cw:diagram:runtime",
  "id": "runtime",
  "purpose": "Show exact Project Server authorization through separate Agent, Check, Project Store, and Preview ports; DSH and execution adapters; role-scoped Git/Wiki capabilities; AI/model calls; untrusted receipts; Evidence; and recovery.",
  "components": [
    {
      "id": "project-server",
      "concept": "cw:component:project-server",
      "label": "Project Server",
      "zone": "core"
    },
    {
      "id": "agent-runtime-port",
      "concept": "cw:component:runtime",
      "label": "Agent Runtime port",
      "zone": "core"
    },
    {
      "id": "dsh-adapter",
      "concept": "cw:component:runtime",
      "label": "DSH adapter",
      "zone": "execution"
    },
    {
      "id": "execution-host",
      "concept": "cw:component:runtime",
      "label": "Execution Host",
      "zone": "execution"
    },
    {
      "id": "runtime",
      "concept": "cw:component:runtime",
      "label": "DSH Agent Run",
      "zone": "execution"
    },
    {
      "id": "provider",
      "concept": "cw:component:provider-boundary",
      "label": "AI / model provider",
      "zone": "provider"
    },
    {
      "id": "project-store-port",
      "concept": "cw:component:project",
      "label": "Project Store port",
      "zone": "core"
    },
    {
      "id": "git-adapter",
      "concept": "cw:component:project",
      "label": "Git adapter / repository",
      "zone": "repository"
    },
    {
      "id": "worktree",
      "concept": "cw:component:project",
      "label": "Role-scoped isolated worktree",
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
      "label": "Gate / Result mechanisms",
      "zone": "core"
    },
    {
      "id": "check-runner-port",
      "concept": "cw:component:checks",
      "label": "Check Runner port",
      "zone": "core"
    },
    {
      "id": "code-sandbox",
      "concept": "cw:component:checks",
      "label": "Code Check sandbox",
      "zone": "execution"
    },
    {
      "id": "preview-port",
      "concept": "cw:component:preview",
      "label": "Preview capability / port",
      "zone": "core"
    },
    {
      "id": "preview-adapter",
      "concept": "cw:component:preview",
      "label": "Preview adapter / host",
      "zone": "execution"
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
      "id": "r-server-port",
      "from": "project-server",
      "to": "agent-runtime-port",
      "type": "authorizes",
      "label": "authorizes exact role, context, tools, route, scope, and budget"
    },
    {
      "id": "r-port-adapter",
      "from": "agent-runtime-port",
      "to": "dsh-adapter",
      "type": "invokes",
      "label": "dispatches one typed authorized Run",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, route, context, capability, or scope."
      }
    },
    {
      "id": "r-adapter-host",
      "from": "dsh-adapter",
      "to": "execution-host",
      "type": "invokes",
      "label": "maps authorization to qualified DSH and host closure"
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
      "label": "uses exact DSH-owned AI/model route",
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
      "id": "r-host-adapter",
      "from": "execution-host",
      "to": "dsh-adapter",
      "type": "returns",
      "label": "returns bounded output and host custody closure"
    },
    {
      "id": "r-adapter-port",
      "from": "dsh-adapter",
      "to": "agent-runtime-port",
      "type": "returns",
      "label": "maps DSH closure to untrusted typed output",
      "boundary": {
        "type": "authority",
        "failure": "Reject incomplete or mismatched output; grant no semantic authority."
      }
    },
    {
      "id": "r-port-server",
      "from": "agent-runtime-port",
      "to": "project-server",
      "type": "returns",
      "label": "returns Run output/receipt for validation or operational stop"
    },
    {
      "id": "r-server-store",
      "from": "project-server",
      "to": "project-store-port",
      "type": "invokes",
      "label": "requests exact reads or expected-state writes"
    },
    {
      "id": "r-store-git",
      "from": "project-store-port",
      "to": "git-adapter",
      "type": "invokes",
      "label": "executes bounded Git operation",
      "boundary": {
        "type": "persistence",
        "failure": "Preserve prior refs on invalid object, authority, Gate, or CAS."
      }
    },
    {
      "id": "r-git-store",
      "from": "git-adapter",
      "to": "project-store-port",
      "type": "returns",
      "label": "returns exact objects, refs, and Git receipt",
      "boundary": {
        "type": "persistence",
        "failure": "Stop on missing, stale, or contradictory source identity."
      }
    },
    {
      "id": "r-store-server",
      "from": "project-store-port",
      "to": "project-server",
      "type": "returns",
      "label": "returns exact Project Store result"
    },
    {
      "id": "r-git-worktree",
      "from": "git-adapter",
      "to": "worktree",
      "type": "produces",
      "label": "creates exact Assignment-scoped worktree"
    },
    {
      "id": "r-dsh-worktree",
      "from": "runtime",
      "to": "worktree",
      "type": "reads",
      "label": "uses only authorized project-artifact scope",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, route, context, capability, or scope."
      }
    },
    {
      "id": "r-worktree-dsh",
      "from": "worktree",
      "to": "runtime",
      "type": "returns",
      "label": "returns scoped files and custody facts",
      "boundary": {
        "type": "authority",
        "failure": "Reject incomplete or mismatched output; grant no semantic authority."
      }
    },
    {
      "id": "r-dsh-query-port",
      "from": "runtime",
      "to": "agent-runtime-port",
      "type": "queries",
      "label": "uses bounded Wiki/Project query capability",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, route, context, capability, or scope."
      }
    },
    {
      "id": "r-query-port-server",
      "from": "agent-runtime-port",
      "to": "project-server",
      "type": "queries",
      "label": "forwards exact authorized snapshot query"
    },
    {
      "id": "r-git-knowledge",
      "from": "git-adapter",
      "to": "knowledge",
      "type": "produces",
      "label": "supplies exact Wiki tree and target Items"
    },
    {
      "id": "r-dsh-preview",
      "from": "runtime",
      "to": "preview-port",
      "type": "invokes",
      "label": "uses scoped preview.work handle",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, route, context, capability, or scope."
      }
    },
    {
      "id": "r-preview-port-adapter",
      "from": "preview-port",
      "to": "preview-adapter",
      "type": "invokes",
      "label": "dispatches authorized bounded Preview",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, route, context, capability, or scope."
      }
    },
    {
      "id": "r-preview-adapter-port",
      "from": "preview-adapter",
      "to": "preview-port",
      "type": "returns",
      "label": "returns untrusted observation and closure",
      "boundary": {
        "type": "authority",
        "failure": "Reject incomplete or mismatched output; grant no semantic authority."
      }
    },
    {
      "id": "r-preview-port-dsh",
      "from": "preview-port",
      "to": "runtime",
      "type": "returns",
      "label": "relays bounded producer observation",
      "boundary": {
        "type": "authority",
        "failure": "Reject incomplete or mismatched output; grant no semantic authority."
      }
    },
    {
      "id": "r-server-checks",
      "from": "project-server",
      "to": "checks",
      "type": "invokes",
      "label": "constructs or reduces exact Gate"
    },
    {
      "id": "r-checks-server",
      "from": "checks",
      "to": "project-server",
      "type": "returns",
      "label": "returns typed selection or Gate outcome"
    },
    {
      "id": "r-server-check-runner",
      "from": "project-server",
      "to": "check-runner-port",
      "type": "authorizes",
      "label": "authorizes exact active Check Run"
    },
    {
      "id": "r-runner-sandbox",
      "from": "check-runner-port",
      "to": "code-sandbox",
      "type": "invokes",
      "label": "runs deterministic Code Check",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, route, context, capability, or scope."
      }
    },
    {
      "id": "r-sandbox-runner",
      "from": "code-sandbox",
      "to": "check-runner-port",
      "type": "returns",
      "label": "returns bounded Check output or stop",
      "boundary": {
        "type": "authority",
        "failure": "Reject incomplete or mismatched output; grant no semantic authority."
      }
    },
    {
      "id": "r-runner-server",
      "from": "check-runner-port",
      "to": "project-server",
      "type": "returns",
      "label": "returns untrusted Check/Preview output for validation"
    },
    {
      "id": "r-runner-preview",
      "from": "check-runner-port",
      "to": "preview-port",
      "type": "invokes",
      "label": "uses exact preview.verify capability"
    },
    {
      "id": "r-preview-runner",
      "from": "preview-port",
      "to": "check-runner-port",
      "type": "returns",
      "label": "returns exact observation and quiescence receipt"
    },
    {
      "id": "r-server-evidence",
      "from": "project-server",
      "to": "evidence",
      "type": "produces",
      "label": "admits exact validated observation Evidence"
    },
    {
      "id": "r-checks-evidence",
      "from": "checks",
      "to": "evidence",
      "type": "consumes",
      "label": "consumes only Gate-declared Evidence"
    },
    {
      "id": "r-git-trace",
      "from": "git-adapter",
      "to": "change-trace",
      "type": "produces",
      "label": "persists or reloads exact Trace through Project Store"
    },
    {
      "id": "r-git-workstate",
      "from": "git-adapter",
      "to": "work-state",
      "type": "produces",
      "label": "supplies exact projection sources",
      "boundary": {
        "type": "persistence",
        "failure": "Stop on missing, stale, or contradictory source identity."
      }
    },
    {
      "id": "r-workstate-alignment",
      "from": "work-state",
      "to": "alignment",
      "type": "produces",
      "label": "supplies current work and blocker facts"
    },
    {
      "id": "r-alignment-server",
      "from": "alignment",
      "to": "project-server",
      "type": "returns",
      "label": "returns derived owned gaps and support facts"
    }
  ],
  "flows": [
    {
      "concept": "cw:flow:work-unit-execution",
      "paths": [
        {
          "connections": [
            "r-server-port",
            "r-port-adapter",
            "r-adapter-host",
            "r-host-dsh",
            "r-dsh-provider",
            "r-provider-dsh",
            "r-dsh-host",
            "r-host-adapter",
            "r-adapter-port",
            "r-port-server",
            "r-server-checks",
            "r-checks-server"
          ]
        },
        {
          "connections": [
            "r-dsh-worktree",
            "r-worktree-dsh",
            "r-dsh-host",
            "r-host-adapter",
            "r-adapter-port",
            "r-port-server"
          ]
        },
        {
          "connections": [
            "r-dsh-query-port",
            "r-query-port-server",
            "r-server-store",
            "r-store-git",
            "r-git-knowledge"
          ]
        },
        {
          "connections": [
            "r-dsh-preview",
            "r-preview-port-adapter",
            "r-preview-adapter-port",
            "r-preview-port-dsh",
            "r-dsh-host"
          ]
        },
        {
          "connections": [
            "r-server-check-runner",
            "r-runner-sandbox",
            "r-sandbox-runner",
            "r-runner-server",
            "r-server-evidence"
          ]
        },
        {
          "connections": [
            "r-server-check-runner",
            "r-runner-preview",
            "r-preview-port-adapter",
            "r-preview-adapter-port",
            "r-preview-runner",
            "r-runner-server",
            "r-server-evidence"
          ]
        },
        {
          "connections": [
            "r-server-store",
            "r-store-git",
            "r-git-trace"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:recovery",
      "paths": [
        {
          "connections": [
            "r-git-store",
            "r-store-server",
            "r-server-store",
            "r-store-git",
            "r-git-workstate",
            "r-workstate-alignment",
            "r-alignment-server"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:change-lifecycle",
      "paths": [
        {
          "connections": [
            "r-dsh-query-port",
            "r-query-port-server",
            "r-server-store",
            "r-store-git",
            "r-git-knowledge"
          ]
        }
      ]
    }
  ]
}
