//! Request construction from explicit cached fixture inputs, never a forwarding repair.
use changekernel::unqualified_change::{
    Command, ContentKey, Evidence, OriginSelector, ScopeJudgment,
};
use std::collections::BTreeSet;
fn evidence(items: &[Evidence], keys: &mut BTreeSet<ContentKey>) {
    for item in items {
        keys.extend([item.content.clone(), item.limitations.clone()]);
    }
}
pub fn requirements(
    command: &Command,
    judgment: &ScopeJudgment,
    native: &[Evidence],
) -> BTreeSet<ContentKey> {
    let mut keys = BTreeSet::new();
    // Inherited proposal/agreement requirements are already accepted in this fixture.
    match command {
        Command::Initiate { wish, .. } => {
            keys.insert(wish.clone());
        }
        Command::Propose { proposal, .. } => {
            let t = &proposal.terms;
            for b in &t.binding {
                keys.insert(b.statement.content.clone());
                keys.extend(b.context.iter().map(|r| r.content.clone()));
            }
            keys.extend(t.context.iter().map(|r| r.content.clone()));
            for c in &t.criteria {
                keys.insert(c.definition.content.clone());
                keys.extend(c.terms.iter().map(|r| r.content.clone()));
            }
            for u in &t.unknowns {
                keys.extend([u.question.clone(), u.bounded_by.clone()]);
                keys.extend(u.affected.iter().map(|r| r.content.clone()));
            }
        }
        Command::Assess { assessment: a, .. } => {
            keys.extend([
                a.feasibility.clone(),
                a.capabilities.clone(),
                a.resources.clone(),
                a.commitments.clone(),
                a.coverage.clone(),
                a.limitations.clone(),
            ]);
            keys.extend(a.blockers.iter().cloned());
        }
        Command::SetGrant { spec, .. } => {
            keys.extend(spec.content_items.iter().chain(&spec.disclosure).cloned());
            for s in spec.content_origins.iter().chain(&spec.disclosure_origins) {
                if let OriginSelector::Historical(o) = s {
                    keys.insert(o.binding.content.clone());
                }
            }
        }
        Command::Admit(a) => {
            keys.extend(a.conditions.iter().cloned());
            evidence(native, &mut keys);
        }
        Command::Dispatch { .. } => evidence(native, &mut keys),
        Command::Finding { finding, .. } => {
            keys.insert(finding.claim.clone());
            evidence(&finding.evidence, &mut keys);
        }
        Command::Adapt { adaptation: a, .. } => {
            keys.extend([a.previous_approach.clone(), a.changed_approach.clone()]);
            evidence(&a.grounds, &mut keys);
            if let ScopeJudgment::WithinDiscretion(e) = judgment {
                evidence(std::slice::from_ref(e), &mut keys);
            }
        }
        Command::Progress { progress: p, .. } => {
            keys.extend([
                p.understanding.assessment.clone(),
                p.outcome.assessment.clone(),
            ]);
            evidence(&p.evidence, &mut keys);
        }
        Command::Fulfill(f) => {
            keys.insert(f.acceptance.clone());
            for c in &f.criteria {
                evidence(&c.evidence, &mut keys);
            }
            for r in &f.resolutions {
                keys.insert(r.blocker.clone());
                evidence(&r.evidence, &mut keys);
            }
        }
        Command::Withdraw { reason } => {
            keys.insert(reason.clone());
        }
        Command::Reconcile { evidence: e, .. } => evidence(e, &mut keys),
        _ => {}
    }
    keys
}
