---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"application/yaml","codewiki.legacy:metadata":{},"codewiki.legacy:source-path":"system/diagrams/architecture.yaml"},"itemId":"cw:diagram:architecture","itemType":"codewiki.legacy:knowledge","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:dcdf7b7ed4fddb54270e4d0e254de3c0224f21e0f67db39e0565daf428f8e82c","codewiki.legacy:source-path":"system/diagrams/architecture.yaml"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:diagram:architecture"}],"relationships":[],"title":"System Architecture"}
---
{
  "codewiki_id": "cw:diagram:architecture",
  "id": "architecture",
  "purpose": "Show Product UAPI, Semantic Kernel, Project Server, four ports, selected adapters, Git/Wiki/Trace, lifecycle, Checks, Preview, DSH, Evidence, derived Views, AI provider mechanics, and Product qualification.",
  "components": [
    {
      "id": "clients",
      "concept": "cw:component:clients",
      "label": "Clients",
      "zone": "client"
    },
    {
      "id": "protocol",
      "concept": "cw:component:protocol",
      "label": "Product UAPI (Kernel API) / Client SDK",
      "zone": "core"
    },
    {
      "id": "semantic-kernel",
      "concept": "cw:component:semantic-kernel",
      "label": "Semantic Kernel mechanisms",
      "zone": "core"
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
      "label": "Gate and Result mechanisms",
      "zone": "core"
    },
    {
      "id": "check-runner-port",
      "concept": "cw:component:checks",
      "label": "Check Runner port",
      "zone": "core"
    },
    {
      "id": "check-adapter",
      "concept": "cw:component:checks",
      "label": "Check adapter / qualified host",
      "zone": "execution"
    },
    {
      "id": "work-state",
      "concept": "cw:component:work-state",
      "label": "Derived WorkState / Work View",
      "zone": "core"
    },
    {
      "id": "alignment",
      "concept": "cw:component:alignment",
      "label": "Derived Alignment",
      "zone": "core"
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
      "id": "knowledge",
      "concept": "cw:component:knowledge",
      "label": "Wiki Items",
      "zone": "repository"
    },
    {
      "id": "change-trace",
      "concept": "cw:component:change-trace",
      "label": "Change Traces / managed refs",
      "zone": "repository"
    },
    {
      "id": "evidence",
      "concept": "cw:component:evidence",
      "label": "Evidence",
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
      "label": "DSH adapter / Execution Host",
      "zone": "execution"
    },
    {
      "id": "preview",
      "concept": "cw:component:preview",
      "label": "Preview capability / port",
      "zone": "core"
    },
    {
      "id": "provider",
      "concept": "cw:component:provider-boundary",
      "label": "AI / model provider",
      "zone": "provider"
    },
    {
      "id": "package",
      "concept": "cw:component:package",
      "label": "Immutable Product composition",
      "zone": "execution"
    },
    {
      "id": "benchmarks",
      "concept": "cw:component:benchmarks",
      "label": "Qualification / Benchmarks",
      "zone": "client"
    }
  ],
  "connections": [
    {
      "id": "a-clients-protocol",
      "from": "clients",
      "to": "protocol",
      "type": "invokes",
      "label": "sends authenticated commands and exact-snapshot queries",
      "boundary": {
        "type": "trust",
        "failure": "Reject invalid identity, authority, bounds, or source."
      }
    },
    {
      "id": "a-protocol-server",
      "from": "protocol",
      "to": "project-server",
      "type": "invokes",
      "label": "supplies normalized request and Actor proof"
    },
    {
      "id": "a-server-kernel",
      "from": "project-server",
      "to": "semantic-kernel",
      "type": "invokes",
      "label": "submits canonical values and transition input"
    },
    {
      "id": "a-kernel-server",
      "from": "semantic-kernel",
      "to": "project-server",
      "type": "returns",
      "label": "returns deterministic typed outcome and effect preconditions"
    },
    {
      "id": "a-server-intake",
      "from": "project-server",
      "to": "intake",
      "type": "invokes",
      "label": "admits independently decidable proposal input"
    },
    {
      "id": "a-intake-decision",
      "from": "intake",
      "to": "decision",
      "type": "produces",
      "label": "produces exact Proposed Change subject"
    },
    {
      "id": "a-decision-server",
      "from": "decision",
      "to": "project-server",
      "type": "returns",
      "label": "returns exact Decision eligibility facts"
    },
    {
      "id": "a-server-planning",
      "from": "project-server",
      "to": "planning",
      "type": "invokes",
      "label": "starts authorized Planning for Committed Change"
    },
    {
      "id": "a-planning-server",
      "from": "planning",
      "to": "project-server",
      "type": "returns",
      "label": "returns gated Work Unit and dependency facts"
    },
    {
      "id": "a-server-implementation",
      "from": "project-server",
      "to": "implementation",
      "type": "invokes",
      "label": "claims and assigns ready Work Unit"
    },
    {
      "id": "a-implementation-server",
      "from": "implementation",
      "to": "project-server",
      "type": "returns",
      "label": "returns admitted integration and reconciliation facts"
    },
    {
      "id": "a-server-review",
      "from": "project-server",
      "to": "review",
      "type": "invokes",
      "label": "starts Review over prospective project-artifact tree"
    },
    {
      "id": "a-review-server",
      "from": "review",
      "to": "project-server",
      "type": "returns",
      "label": "returns exact Review Gate eligibility"
    },
    {
      "id": "a-server-checks",
      "from": "project-server",
      "to": "checks",
      "type": "invokes",
      "label": "constructs or reduces exact Gates through Kernel mechanisms"
    },
    {
      "id": "a-checks-server",
      "from": "checks",
      "to": "project-server",
      "type": "returns",
      "label": "returns typed selection or Gate outcome"
    },
    {
      "id": "a-server-check-runner",
      "from": "project-server",
      "to": "check-runner-port",
      "type": "authorizes",
      "label": "authorizes exact active Check Runs"
    },
    {
      "id": "a-check-runner-adapter",
      "from": "check-runner-port",
      "to": "check-adapter",
      "type": "invokes",
      "label": "dispatches bounded Check execution",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, route, context, capability, or scope."
      }
    },
    {
      "id": "a-check-adapter-runner",
      "from": "check-adapter",
      "to": "check-runner-port",
      "type": "returns",
      "label": "returns untrusted Check output and closure",
      "boundary": {
        "type": "authority",
        "failure": "Reject incomplete or mismatched output; grant no semantic authority."
      }
    },
    {
      "id": "a-check-runner-server",
      "from": "check-runner-port",
      "to": "project-server",
      "type": "returns",
      "label": "returns typed output or operational stop"
    },
    {
      "id": "a-server-agent-runtime",
      "from": "project-server",
      "to": "agent-runtime-port",
      "type": "authorizes",
      "label": "authorizes exact role-bound Agent Run"
    },
    {
      "id": "a-agent-runtime-dsh",
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
      "id": "a-dsh-agent-runtime",
      "from": "dsh-adapter",
      "to": "agent-runtime-port",
      "type": "returns",
      "label": "returns untrusted DSH output and custody closure",
      "boundary": {
        "type": "authority",
        "failure": "Reject incomplete or mismatched output; grant no semantic authority."
      }
    },
    {
      "id": "a-agent-runtime-server",
      "from": "agent-runtime-port",
      "to": "project-server",
      "type": "returns",
      "label": "returns typed Run output or operational stop"
    },
    {
      "id": "a-dsh-provider",
      "from": "dsh-adapter",
      "to": "provider",
      "type": "invokes",
      "label": "uses exact DSH-owned AI/model route",
      "boundary": {
        "type": "network",
        "failure": "Stop on unavailable route, cancellation, or receipt failure."
      }
    },
    {
      "id": "a-provider-dsh",
      "from": "provider",
      "to": "dsh-adapter",
      "type": "returns",
      "label": "returns provider output and receipt facts",
      "boundary": {
        "type": "network",
        "failure": "Reject unauthenticated, malformed, or mismatched response."
      }
    },
    {
      "id": "a-dsh-preview",
      "from": "dsh-adapter",
      "to": "preview",
      "type": "invokes",
      "label": "uses only an authorized preview.work handle",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, route, context, capability, or scope."
      }
    },
    {
      "id": "a-check-adapter-preview",
      "from": "check-adapter",
      "to": "preview",
      "type": "invokes",
      "label": "uses only an authorized preview.verify handle",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, route, context, capability, or scope."
      }
    },
    {
      "id": "a-preview-server",
      "from": "preview",
      "to": "project-server",
      "type": "returns",
      "label": "returns untrusted observation for validation or relay"
    },
    {
      "id": "a-server-evidence",
      "from": "project-server",
      "to": "evidence",
      "type": "produces",
      "label": "admits exact validated observation Evidence"
    },
    {
      "id": "a-checks-evidence",
      "from": "checks",
      "to": "evidence",
      "type": "consumes",
      "label": "consumes only Gate-declared exact Evidence"
    },
    {
      "id": "a-server-project-store",
      "from": "project-server",
      "to": "project-store-port",
      "type": "writes",
      "label": "requests exact object and expected-state transaction"
    },
    {
      "id": "a-project-store-git",
      "from": "project-store-port",
      "to": "git-adapter",
      "type": "invokes",
      "label": "executes bounded Git read or compare-and-swap",
      "boundary": {
        "type": "persistence",
        "failure": "Preserve prior refs on invalid object, authority, Gate, or CAS."
      }
    },
    {
      "id": "a-git-knowledge",
      "from": "git-adapter",
      "to": "knowledge",
      "type": "produces",
      "label": "supplies exact Wiki tree and Item blobs"
    },
    {
      "id": "a-git-trace",
      "from": "git-adapter",
      "to": "change-trace",
      "type": "produces",
      "label": "supplies exact Trace blobs and managed ancestry"
    },
    {
      "id": "a-git-workstate",
      "from": "git-adapter",
      "to": "work-state",
      "type": "produces",
      "label": "supplies exact Git and Trace projection sources",
      "boundary": {
        "type": "persistence",
        "failure": "Stop on missing, stale, or contradictory source identity."
      }
    },
    {
      "id": "a-workstate-server",
      "from": "work-state",
      "to": "project-server",
      "type": "returns",
      "label": "returns derived readiness and current-stage facts"
    },
    {
      "id": "a-knowledge-alignment",
      "from": "knowledge",
      "to": "alignment",
      "type": "produces",
      "label": "supplies committed semantic targets",
      "boundary": {
        "type": "persistence",
        "failure": "Stop on missing, stale, or contradictory source identity."
      }
    },
    {
      "id": "a-alignment-server",
      "from": "alignment",
      "to": "project-server",
      "type": "returns",
      "label": "returns owned gaps and exact support facts"
    },
    {
      "id": "a-bench-package",
      "from": "benchmarks",
      "to": "package",
      "type": "reads",
      "label": "qualifies exact packed Product bytes",
      "boundary": {
        "type": "trust",
        "failure": "Reject unbound subject, policy, fixture, or evidence."
      }
    },
    {
      "id": "a-package-server",
      "from": "package",
      "to": "project-server",
      "type": "produces",
      "label": "supplies qualified Product and Kernel Build identities",
      "boundary": {
        "type": "trust",
        "failure": "Reject mutable, drifted, unsupported, or unqualified identity."
      }
    }
  ],
  "flows": [
    {
      "concept": "cw:flow:change-lifecycle",
      "paths": [
        {
          "connections": [
            "a-clients-protocol",
            "a-protocol-server",
            "a-server-kernel",
            "a-kernel-server",
            "a-server-intake",
            "a-intake-decision",
            "a-decision-server",
            "a-server-checks",
            "a-checks-server",
            "a-server-project-store",
            "a-project-store-git",
            "a-git-knowledge"
          ]
        },
        {
          "connections": [
            "a-server-planning",
            "a-planning-server",
            "a-server-implementation",
            "a-implementation-server",
            "a-server-review",
            "a-review-server",
            "a-server-project-store",
            "a-project-store-git",
            "a-git-trace"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:work-unit-execution",
      "paths": [
        {
          "connections": [
            "a-server-agent-runtime",
            "a-agent-runtime-dsh",
            "a-dsh-provider",
            "a-provider-dsh",
            "a-dsh-agent-runtime",
            "a-agent-runtime-server",
            "a-server-check-runner",
            "a-check-runner-adapter",
            "a-check-adapter-runner",
            "a-check-runner-server"
          ]
        },
        {
          "connections": [
            "a-dsh-preview",
            "a-preview-server",
            "a-server-agent-runtime",
            "a-agent-runtime-dsh"
          ]
        },
        {
          "connections": [
            "a-check-adapter-preview",
            "a-preview-server",
            "a-server-evidence"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:recovery",
      "paths": [
        {
          "connections": [
            "a-git-workstate",
            "a-workstate-server",
            "a-server-project-store",
            "a-project-store-git"
          ]
        },
        {
          "connections": [
            "a-knowledge-alignment",
            "a-alignment-server",
            "a-server-project-store",
            "a-project-store-git"
          ]
        },
        {
          "connections": [
            "a-bench-package",
            "a-package-server",
            "a-server-kernel"
          ]
        }
      ]
    }
  ]
}
