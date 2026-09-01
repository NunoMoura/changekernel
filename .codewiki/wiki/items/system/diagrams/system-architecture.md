---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"application/yaml","codewiki.legacy:metadata":{},"codewiki.legacy:source-path":"system/diagrams/architecture.yaml"},"itemId":"cw:diagram:architecture","itemType":"codewiki.legacy:knowledge","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:dcdf7b7ed4fddb54270e4d0e254de3c0224f21e0f67db39e0565daf428f8e82c","codewiki.legacy:source-path":"system/diagrams/architecture.yaml"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:diagram:architecture"}],"relationships":[],"title":"System Architecture"}
---
{
  "codewiki_id": "cw:diagram:architecture",
  "id": "architecture",
  "purpose": "Show target ownership among Clients, Project Server, Git/Wiki/Trace, four stages, Checks, DSH Runs, derived Views, Providers, release qualification, and legacy compatibility.",
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
      "label": "Kernel API / Client SDK",
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
      "label": "Gates / Check Runs / Results",
      "zone": "core"
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
      "id": "runtime",
      "concept": "cw:component:runtime",
      "label": "DSH Run Execution",
      "zone": "execution"
    },
    {
      "id": "preview",
      "concept": "cw:component:preview",
      "label": "Preview / bounded observation",
      "zone": "execution"
    },
    {
      "id": "provider",
      "concept": "cw:component:provider-boundary",
      "label": "AI / Git / Delivery Providers",
      "zone": "provider"
    },
    {
      "id": "package",
      "concept": "cw:component:package",
      "label": "Immutable package / admitted Plugins",
      "zone": "execution"
    },
    {
      "id": "benchmarks",
      "concept": "cw:component:benchmarks",
      "label": "Qualification / Benchmarks",
      "zone": "client"
    },
    {
      "id": "domains",
      "concept": "cw:component:domains",
      "label": "Legacy Domain compatibility",
      "zone": "core"
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
      "id": "a-decision-planning",
      "from": "decision",
      "to": "planning",
      "type": "authorizes",
      "label": "routes Committed Change requiring project realization"
    },
    {
      "id": "a-planning-implementation",
      "from": "planning",
      "to": "implementation",
      "type": "authorizes",
      "label": "supplies accepted Work Units and dependencies"
    },
    {
      "id": "a-implementation-review",
      "from": "implementation",
      "to": "review",
      "type": "produces",
      "label": "supplies exact integrated Change tip"
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
      "label": "constructs exact Gate and active Check set"
    },
    {
      "id": "a-checks-server",
      "from": "checks",
      "to": "project-server",
      "type": "returns",
      "label": "returns passed, failed, or stopped outcome"
    },
    {
      "id": "a-server-runtime",
      "from": "project-server",
      "to": "runtime",
      "type": "authorizes",
      "label": "authorizes exact role-bound DSH Run",
      "boundary": {
        "type": "authority",
        "failure": "Reject stale subject, route, context, capability, or scope."
      }
    },
    {
      "id": "a-runtime-server",
      "from": "runtime",
      "to": "project-server",
      "type": "returns",
      "label": "returns bounded output and DSH Run receipt",
      "boundary": {
        "type": "authority",
        "failure": "Reject incomplete receipt; fabricate no transition or Result."
      }
    },
    {
      "id": "a-runtime-provider",
      "from": "runtime",
      "to": "provider",
      "type": "invokes",
      "label": "uses exact DSH-owned provider route",
      "boundary": {
        "type": "network",
        "failure": "Stop on unavailable route, cancellation, or receipt failure."
      }
    },
    {
      "id": "a-provider-runtime",
      "from": "provider",
      "to": "runtime",
      "type": "returns",
      "label": "returns provider output and receipt facts",
      "boundary": {
        "type": "network",
        "failure": "Reject unauthenticated, malformed, or mismatched response."
      }
    },
    {
      "id": "a-runtime-preview",
      "from": "runtime",
      "to": "preview",
      "type": "invokes",
      "label": "requests bounded subject observation"
    },
    {
      "id": "a-preview-evidence",
      "from": "preview",
      "to": "evidence",
      "type": "produces",
      "label": "returns provenance-bound observation metadata",
      "boundary": {
        "type": "trust",
        "failure": "Record unavailable or unknown; invent no Evidence."
      }
    },
    {
      "id": "a-evidence-checks",
      "from": "evidence",
      "to": "checks",
      "type": "consumes",
      "label": "supplies only Gate-declared exact Evidence"
    },
    {
      "id": "a-server-project",
      "from": "project-server",
      "to": "project",
      "type": "writes",
      "label": "advances refs through expected-old-OID compare-and-swap",
      "boundary": {
        "type": "persistence",
        "failure": "Preserve previous refs on object, authority, Gate, or CAS failure."
      }
    },
    {
      "id": "a-project-knowledge",
      "from": "project",
      "to": "knowledge",
      "type": "produces",
      "label": "supplies exact Wiki tree and Item blobs"
    },
    {
      "id": "a-project-trace",
      "from": "project",
      "to": "change-trace",
      "type": "produces",
      "label": "supplies exact Trace blobs and managed ancestry"
    },
    {
      "id": "a-project-workstate",
      "from": "project",
      "to": "work-state",
      "type": "produces",
      "label": "supplies Git and Trace projection sources",
      "boundary": {
        "type": "persistence",
        "failure": "Stop projection on missing or contradictory source identity."
      }
    },
    {
      "id": "a-workstate-server",
      "from": "work-state",
      "to": "project-server",
      "type": "returns",
      "label": "returns derived readiness and current stage facts"
    },
    {
      "id": "a-knowledge-alignment",
      "from": "knowledge",
      "to": "alignment",
      "type": "produces",
      "label": "supplies committed semantic targets",
      "boundary": {
        "type": "persistence",
        "failure": "Report unknown when exact Wiki source cannot be resolved."
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
      "label": "qualifies exact packed release bytes",
      "boundary": {
        "type": "trust",
        "failure": "Reject unbound subject, policy, fixture, or evidence."
      }
    },
    {
      "id": "a-package-server",
      "from": "package",
      "to": "project-server",
      "type": "authorizes",
      "label": "supplies immutable Kernel Build and admitted code",
      "boundary": {
        "type": "authority",
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
            "a-server-intake",
            "a-intake-decision",
            "a-decision-planning",
            "a-planning-implementation",
            "a-implementation-review",
            "a-review-server",
            "a-server-project",
            "a-project-knowledge"
          ]
        },
        {
          "connections": [
            "a-server-checks",
            "a-checks-server",
            "a-server-project",
            "a-project-trace"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:work-unit-execution",
      "paths": [
        {
          "connections": [
            "a-server-runtime",
            "a-runtime-provider",
            "a-provider-runtime",
            "a-runtime-server",
            "a-server-checks"
          ]
        },
        {
          "connections": [
            "a-runtime-preview",
            "a-preview-evidence",
            "a-evidence-checks",
            "a-checks-server"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:recovery",
      "paths": [
        {
          "connections": [
            "a-project-workstate",
            "a-workstate-server",
            "a-server-project"
          ]
        },
        {
          "connections": [
            "a-knowledge-alignment",
            "a-alignment-server",
            "a-server-project"
          ]
        },
        {
          "connections": [
            "a-bench-package",
            "a-package-server",
            "a-server-project"
          ]
        }
      ]
    }
  ]
}
