# ChangeKernel source-development handoff

Role: project manager in `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. The user owns product intent. [AGENTS.md](AGENTS.md) owns procedure; [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design. Use native source-development tools; never load this checkout as controller.

## Worker checkpoints remain unchanged

Common R8 base: `18e6397e3694243c3b35b3291f0c8b624cc805ac`. A/B/C dispatch: `f20740ef5112f45854058050c665b9267f5c6cac`; D dispatch: `2cd61b1ce00833c80ae1cad805c3dfaa4f98dc9a`. Full combined review: `4d60b4358a804b41aee83b23d2890a00d352659e:CHANGEKERNEL_STATUS.md`.

| Lane | Reviewed submission → verdict | Current instruction |
| --- | --- | --- |
| A | `ca215f57886f4571796548278a7cd0fe46be754c` → `3ee00dbbabcb1b5c60db2f0fcbeb80ccb2af1e4a` | **Changes requested:** A1 native group-context permission broadening; A2 complete control inventory. [Review/repair](../restart-host-contract/CHANGEKERNEL_STATUS.md#manager-review--changes-requested), `work/restart-host-contract`, `/home/canina7/Projects/changekernel-workers/restart-host-contract`. |
| B | `0f54e339286a7c35f4635ef680c501de53ff08f1` → `9aa6d02a8c436a9ae130c478ea3b086d19f9e285` | **Phase 1 blocker analysis accepted; operational profile blocked.** [Review](../restart-trace-contract/CHANGEKERNEL_STATUS.md#manager-review--blocked), `work/restart-trace-contract`, `/home/canina7/Projects/changekernel-workers/restart-trace-contract`. Remain stopped; Phase 2 unreleased. |
| C | `3902759a23f72cc31da32b27bb5e3ca8d0c1609f` → `fd9cae5faf6000cec1685f58ce44e98aa514cf21` | **Bounded logical read view accepted; finished.** [Review](../history-view-contract/CHANGEKERNEL_STATUS.md#manager-review--accepted-logical-proposal), `work/history-view-contract`, `/home/canina7/Projects/changekernel-workers/history-view-contract`. Remain stopped. |
| D | `655b119fc28914c9c43fd64b1a14cb35b0baa46c` → `c03330c82d7ea21a933b067e4059e86b3b41b54e` | **Changes requested:** D1 issuance/expiry boundary; D2 consumed budgets versus reusable occupancy. [Review/repair](../attempt-supervision-contract/CHANGEKERNEL_STATUS.md#manager-review--changes-requested), `work/attempt-supervision-contract`, `/home/canina7/Projects/changekernel-workers/attempt-supervision-contract`. |

A/D retain only their previously released handoff repairs, then commit/report actual checks and stop. These foundational fixes remain necessary regardless of runtime choice. No new submissions or worker activity are inferred. Four lanes remain a target for ready independent work, not a reason to dispatch blocked code.

## Confirmed product direction

The user approved owned-core composition and refined the runtime disposition. Durable design now belongs in the Wiki: [orchestration and interaction ownership](.changekernel/wiki/items/product/changekernel.md), [query-versus-Change interpretation](.changekernel/wiki/items/product/changekernel.md#intent-and-lifecycle), [reference and selective-reuse boundaries](.changekernel/wiki/items/system/components/agent-execution.md#runtime-selection-and-research-basis), [owned operator UX](.changekernel/wiki/items/product/changekernel.md#operator-console-for-development), and [qualification](.changekernel/wiki/items/system/components/package.md#runtime-comparison-and-adoption).

**Disposition:** the earlier KISS/Rig component shortlist is superseded as an adoption recommendation. This is desired-design adoption only, not implementation acceptance, API/schema freeze, a dependency/fork selection or permission to run a prototype. Existing Rust and TypeScript contracts, source acceptance and controller boundaries remain unchanged. One transcribed sentence in the latest instruction is unclear; no additional project disposition was inferred from it.

Completed research remains in Git rather than a parallel design roadmap: Rust candidates at `fd853e4dccee2370172b15f68556ec424da20fe0:CHANGEKERNEL_STATUS.md`, unattended operations at `d9b59946556c9afae3220cd4b0849daf2491b8e0:CHANGEKERNEL_STATUS.md`, and restart-witness analysis at `22e5a93ec8edaca56c2ffc5083e263b4e35ac276:CHANGEKERNEL_STATUS.md`. Their source pins, evidence paths, checks and limitations remain historical evidence; they were not rerun in this documentation turn.

## Pending decisions and unchanged gates

- Clarify the ambiguous transcribed reference. Owning the interaction boundary does not settle whether every worker loop must be Rust, which external workers are eligible, or whether an owned inner loop is needed for the first path. No new model questions, label vocabulary or public invocation schema are frozen.
- Review exact A/D repair submissions when received. A/D have only their existing handoff repairs; B Phase 2 remains unreleased pending repaired/reviewed A, an agreed evidence mechanism and explicit release; C remains finished. No worker worktree was edited, new lane dispatched, or worker activity inferred.
- Compose the remaining operating/failure contracts before implementation release. Native protection, aggregate budgets, qualified cancellation and [accepted-prefix/restart authority](.changekernel/wiki/items/system/components/state.md#protected-accepted-prefix-and-recovery-boundary) remain unresolved gates. Neither inspiration nor a Rust rewrite supplies missing evidence. No etcd/TPM deployment, reset, restore, new-ID escape or weaker safety guarantee is selected.
- R7-C remains accepted (`67be34af6c40fa5b79e801b004dda094a1023dbb` preserves its combined review). Latest executable integration remains `0b1b434ab`; R5-B is accepted, R5-A remains unintegrated/frozen with no resubmission owed. Release qualification, immutable activation and explicit controller handoff remain separate from source acceptance.

## Documentation checks

Scope is three Wiki documents and this manager handoff. The worker-checkpoint section is preserved byte-for-byte. No source, tests, manifests, lockfiles, dependencies, OS/account/service setup or controller state changed. No candidate runtime, build, test, benchmark or model was executed. Cargo/npm checks are not applicable to these documentation-only changes. Checks passed: four changed Markdown paths have zero active diagnostics; 54 local links/anchors, including four worker anchors checked at exact verdict commits, and 17 project commit references resolve. All three Wiki frontmatter/provenance blocks, historical contract tails and the worker-checkpoint prefix are unchanged. Branch/base, four-file scope and whitespace checks passed. The validation script and output are retained outside project Git at `/home/canina7/.local/state/ck-owned-core-doc-check.UjEMLP/`; it has separate worktree and post-commit modes.
