# ChangeKernel

## Workflow

- **Intent → approved docs → code review → implementation/tests → qualification.** Proposals are not approval; design approval does not authorize implementation, experiments or deployment. Proceed within approved scope.
- Use [System](CHANGEKERNEL_SYSTEM.md) for design and [Status](CHANGEKERNEL_STATUS.md) for gaps, next steps and handoffs across sessions. No parallel roadmap; code does not override design.
- Use Pi-native tools. Never run this checkout as its controller, install/link ChangeKernel into its `.pi/`, or use `wiki_*`/`/wiki-*`. Controller authority requires a qualified immutable external release, activation and explicit handoff.

## Documentation

- Reconcile newly accepted decisions as they change: replace superseded text and keep System/Status as current truth—not accumulated history. Revise before reaching a cap.
- Hard ceilings: System **11,000 tokens**; Status **3,000**. Count complete UTF-8 files with `o200k_base` ordinary-text encoding before each documentation handoff. Ceilings are not targets; use only the space needed.
- Retain essential constraints, decisions and open questions; remove semantic duplication and stale detail. Reference history/evidence rather than copying it.
- Never evade limits through formatting, omissions or overflow specifications. If essential content will not fit, obtain user approval to change limits or structure.

## Communication

Present every approval request and user-relevant update directly in the TUI; do not require document reading. Use plain language and short sentences. Lead with the result or decision; include relevant paths, checks, risks and a recommendation when asking for approval. Omit jargon, ceremony and routine tool narration.

## Shared work

- Canonical checkout: `changekernel/`, `main`. Launch worker sessions in separate worktrees; `git -C` does not relocate sessions.
- Managers use Herdr CLI; assign scope, paths, base commit and checks. Maximum **10 workers**, including parked sessions. Workers report in Status.
- Delegate implementation; the manager retains substantive review, acceptance and integration into `main`. A separate substantive reviewer requires a fresh session and user-confirmed model selection.
- Preserve uncommitted work and archival refs. Removing records does not close or migrate their Changes.

## Checks

- Rust: `cargo fmt --check`; `cargo clippy --locked --all-targets -- -D warnings`; `cargo test --locked`. Build separately for artifact claims.
- Future TypeScript/integration work requires a defined external staging profile, pinned lockfile and isolated Pi/HOME/settings. Install dependencies only there. The retired ordinary-Pi adapter's checks are historical evidence, not a current suite.
- Test behavior and failure boundaries, not inventories or doc wording. Tests do not replace human smoke or release qualification.
