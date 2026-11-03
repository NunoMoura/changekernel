# ChangeKernel

## Workflow

- **Intent → approved docs → code review → implementation/tests → qualification.** Proposals are not approval; design approval does not authorize implementation, experiments or deployment. Proceed within approved scope.
- An explicitly authorized bounded implementation cycle may settle routine representations and numeric limits through code, measurement and review under fixed approved behavior. Before integration, require enforced and justified bounds, behavioral/failure tests, manager review and reconciled documentation. Return for approval if product contracts, trust boundaries, dependencies, storage formats or agreed scope must change; routine choices within that scope need no separate approval.
- Use [System](CHANGEKERNEL_SYSTEM.md) for design and [Status](CHANGEKERNEL_STATUS.md) for gaps, next steps and handoffs across sessions. No parallel roadmap; code does not override design.
- Use Pi-native tools. Never run this checkout as its controller, install/link ChangeKernel into its `.pi/`, or use `wiki_*`/`/wiki-*`. Controller authority requires a qualified immutable external release, activation and explicit handoff.

## Documentation

- Give each contract and term one authoritative home; reference it elsewhere. On every update, review each changed document in full and reconcile linked documents. Replace superseded ideas and vocabulary; check contradictions and duplication. Account for removed passages as redundant, superseded or retained at a named canonical location. Preserve essential constraints, decisions and open questions; distinguish adopted design, proposals and implementation. Link history/evidence rather than accumulating it.
- **System:** use the space needed to preserve the design clearly, up to **20,000 counted tokens**. There is no preferred length below that limit.
- **Status:** aim for roughly **1,500–2,000 total tokens**, allowing up to **3,000** when necessary.
- Keep README an entrypoint and AGENTS procedural. Prefer clear prose to shorthand; documentation limits never justify lost constraints.
- **Only exemption:** System's `## Philosophical foundations` section, including its heading but excluding the next level-two heading. Keep it brief: research summaries, citations and connections to existing concepts—not product contracts, proposals, mechanisms, implementation details or execution state.
- Before handoff, count complete UTF-8 files using `o200k_base` ordinary-text encoding. Report System's total, exempt section and directly encoded remainder (not token subtraction), plus Status's full total.
- Revise before reaching caps. Never evade limits through formatting, omissions or overflow specifications. If essential content cannot fit, obtain user approval to change limits or structure.

## Communication

Present every approval request and user-relevant update directly in the TUI; do not require document reading. Use plain language and short sentences. Lead with the result or decision; include relevant paths, checks, risks and a recommendation when asking for approval. Omit jargon, ceremony and routine tool narration.

## Shared work

- Canonical checkout: `changekernel/`, `main`. Launch worker sessions in separate worktrees; `git -C` does not relocate sessions.
- Managers use Herdr CLI; assign scope, paths, base commit and checks. Maximum **10 workers**, including parked sessions. Workers report in Status.
- Delegate implementation; the manager retains substantive review, acceptance and integration into `main`. A separate substantive reviewer requires a fresh session and user-confirmed model selection.
- Preserve uncommitted work and archival refs. Removing records does not close or migrate their Changes.

## Rust style

- Follow the [Google Rust Style Guide](https://google.github.io/styleguide/rustguide.html), including the public Rust style/API guidance it incorporates and its stated exceptions. Chromium/Fuchsia-specific rules do not apply to this Cargo library.
- The approved narrow P34 Serde deferral is in [System](CHANGEKERNEL_SYSTEM.md#p34-first-delivery-boundary); all other Rust/API guidance remains applicable.
- Apply library/API guidance by intended use, not directory name; `application/` is not a blanket exemption. Review applicable design, safety, documentation and organization rules, not formatting alone.
- Use the pinned stable toolchain's rustfmt. Review rules the formatter cannot enforce; do not change toolchains or enable nightly merely for formatting options.
- Adoption proves no existing conformance and authorizes no refactor. Surface conflicts and required scope changes through the workflow; never silently waive style or product contracts.

## Checks

- Rust: `cargo fmt --check`; `cargo clippy --locked --all-targets -- -D warnings`; `cargo test --locked`. Build separately for artifact claims.
- Future TypeScript/integration work requires a defined external staging profile, pinned lockfile and isolated Pi/HOME/settings. Install dependencies only there. The retired ordinary-Pi adapter's checks are historical evidence, not a current suite.
- Test behavior and failure boundaries, not inventories or doc wording. Tests do not replace human smoke or release qualification.
