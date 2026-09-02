---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"application/yaml","codewiki.legacy:metadata":{},"codewiki.legacy:source-path":"system/diagrams/synchronization.yaml"},"itemId":"cw:diagram:synchronization","itemType":"codewiki.legacy:knowledge","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:2b2c32456c6101fce535007dbd4ff3c0876594a7e3918f48ab9ba243b95c65ac","codewiki.legacy:source-path":"system/diagrams/synchronization.yaml"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:diagram:synchronization"}],"relationships":[],"title":"Remote Synchronization Diagram"}
---
{
  "codewiki_id": "cw:diagram:synchronization",
  "id": "synchronization",
  "purpose": "Show local Git authority while remote observation, external-work intake, publication, and remote/shareable Preview remain separately authorized Plugin mechanics.",
  "components": [
    {
      "id": "project-server",
      "concept": "cw:component:project-server",
      "label": "Project Server",
      "zone": "core"
    },
    {
      "id": "project",
      "concept": "cw:component:project",
      "label": "Local Git Project Store",
      "zone": "repository"
    },
    {
      "id": "plugins",
      "concept": "cw:component:provider-boundary",
      "label": "Admitted Remote / Delivery / Preview Plugin",
      "zone": "execution"
    },
    {
      "id": "provider",
      "concept": "cw:component:provider-boundary",
      "label": "Git / Delivery / Preview Provider",
      "zone": "provider"
    },
    {
      "id": "intake",
      "concept": "cw:component:change-intake",
      "label": "Change Intake",
      "zone": "core"
    },
    {
      "id": "change-trace",
      "concept": "cw:component:change-trace",
      "label": "Change Trace / effect receipts",
      "zone": "repository"
    },
    {
      "id": "knowledge",
      "concept": "cw:component:knowledge",
      "label": "Wiki Items",
      "zone": "repository"
    },
    {
      "id": "alignment",
      "concept": "cw:component:alignment",
      "label": "Derived remote Alignment",
      "zone": "core"
    }
  ],
  "connections": [
    {
      "id": "s-server-plugin-observe",
      "from": "project-server",
      "to": "plugins",
      "type": "authorizes",
      "label": "requests bounded remote observation",
      "boundary": {
        "type": "authority",
        "failure": "Reject unadmitted Plugin, stale subject, or excess capability."
      }
    },
    {
      "id": "s-plugin-provider-observe",
      "from": "plugins",
      "to": "provider",
      "type": "observes",
      "label": "reads authenticated provider refs and object facts",
      "boundary": {
        "type": "network",
        "failure": "Return operational stop and preserve local refs."
      }
    },
    {
      "id": "s-provider-plugin-observe",
      "from": "provider",
      "to": "plugins",
      "type": "returns",
      "label": "returns provider refs and authentication facts",
      "boundary": {
        "type": "network",
        "failure": "Reject incomplete, stale, or contradictory observation."
      }
    },
    {
      "id": "s-plugin-server-observe",
      "from": "plugins",
      "to": "project-server",
      "type": "returns",
      "label": "returns immutable observation receipt",
      "boundary": {
        "type": "trust",
        "failure": "Reject mismatched receipt; grant no lifecycle authority."
      }
    },
    {
      "id": "s-server-intake",
      "from": "project-server",
      "to": "intake",
      "type": "invokes",
      "label": "routes unmatched external work to intake"
    },
    {
      "id": "s-intake-server",
      "from": "intake",
      "to": "project-server",
      "type": "returns",
      "label": "returns controlled Work match or proposal input"
    },
    {
      "id": "s-server-project",
      "from": "project-server",
      "to": "project",
      "type": "writes",
      "label": "advances local refs or records receipt through validated CAS",
      "boundary": {
        "type": "persistence",
        "failure": "Preserve local refs on object, authority, Gate, or CAS failure."
      }
    },
    {
      "id": "s-project-knowledge",
      "from": "project",
      "to": "knowledge",
      "type": "produces",
      "label": "supplies exact accepted Wiki tree"
    },
    {
      "id": "s-knowledge-alignment",
      "from": "knowledge",
      "to": "alignment",
      "type": "produces",
      "label": "supplies stable accepted intent",
      "boundary": {
        "type": "persistence",
        "failure": "Report unknown when exact Wiki source cannot be resolved."
      }
    },
    {
      "id": "s-alignment-server",
      "from": "alignment",
      "to": "project-server",
      "type": "returns",
      "label": "returns local and remote state with unknowns"
    },
    {
      "id": "s-server-plugin-publish",
      "from": "project-server",
      "to": "plugins",
      "type": "authorizes",
      "label": "authorizes exact publication or remote Preview effect",
      "boundary": {
        "type": "authority",
        "failure": "Preserve local completion and require effect reconciliation."
      }
    },
    {
      "id": "s-plugin-provider-publish",
      "from": "plugins",
      "to": "provider",
      "type": "synchronizes",
      "label": "applies bounded publication or remote Preview effect",
      "boundary": {
        "type": "network",
        "failure": "Return stopped or unknown without claiming acceptance."
      }
    },
    {
      "id": "s-provider-plugin-publish",
      "from": "provider",
      "to": "plugins",
      "type": "returns",
      "label": "returns authenticated resulting provider state",
      "boundary": {
        "type": "network",
        "failure": "Reject incomplete or mismatched effect result."
      }
    },
    {
      "id": "s-plugin-server-publish",
      "from": "plugins",
      "to": "project-server",
      "type": "returns",
      "label": "returns exact effect receipt",
      "boundary": {
        "type": "trust",
        "failure": "Reject stale receipt and reconcile before retry."
      }
    },
    {
      "id": "s-trace-alignment",
      "from": "change-trace",
      "to": "alignment",
      "type": "produces",
      "label": "supplies local completion and remote observations",
      "boundary": {
        "type": "persistence",
        "failure": "Report unknown on invalid Trace or stale receipt."
      }
    },
    {
      "id": "s-project-trace",
      "from": "project",
      "to": "change-trace",
      "type": "produces",
      "label": "supplies exact protected-effect receipt reference"
    }
  ],
  "flows": [
    {
      "concept": "cw:flow:remote-state-synchronization",
      "paths": [
        {
          "connections": [
            "s-server-plugin-observe",
            "s-plugin-provider-observe",
            "s-provider-plugin-observe",
            "s-plugin-server-observe",
            "s-server-intake"
          ]
        },
        {
          "connections": [
            "s-server-plugin-publish",
            "s-plugin-provider-publish",
            "s-provider-plugin-publish",
            "s-plugin-server-publish",
            "s-server-project",
            "s-project-trace",
            "s-trace-alignment",
            "s-alignment-server"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:external-candidate-admission",
      "paths": [
        {
          "connections": [
            "s-provider-plugin-observe",
            "s-plugin-server-observe",
            "s-server-intake",
            "s-intake-server",
            "s-server-project",
            "s-project-knowledge"
          ]
        }
      ]
    },
    {
      "concept": "cw:flow:change-lifecycle",
      "paths": [
        {
          "connections": [
            "s-server-project",
            "s-project-knowledge",
            "s-knowledge-alignment",
            "s-alignment-server"
          ]
        }
      ]
    }
  ]
}
