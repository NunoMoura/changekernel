use super::*;
// Exact prospective bytes are checked before review and again before reservation.
pub(super) fn preflight<P: Persistence, C: Encoding>(
    codec: &C,
    store: &P,
    s: &P::State,
    r: &Request,
    presentation: &str,
    pending: Option<&Pending>,
) -> Result<()> {
    let review_ref = Material::of(presentation.as_bytes());
    let receipt = Receipt {
        format: "ck-local-approval".into(),
        principal: "person-1".into(),
        subject_sha256: codec.subject(r)?,
        presentation: review_ref.clone(),
        decision: "adopt".into(),
        ui: "local-tui-exact".into(),
    };
    let receipt_text = codec.receipt(&receipt)?;
    let approval = Material::of(receipt_text.as_bytes());
    if pending.is_none() {
        store.preflight_materials(&[presentation, &receipt_text])?;
    }
    for (material, text) in [
        (review_ref, presentation),
        (approval.clone(), receipt_text.as_str()),
    ] {
        codec.response(
            1_000_000,
            &Response::Resolved {
                material,
                text: text.into(),
            },
        )?;
    }
    let seq = s.generation() + 1;
    let record = Record {
        version: V.into(),
        custody: "custody-1".into(),
        seq,
        prev: s.tip(),
        input: r.clone(),
        approval: pending.map_or(approval, |p| p.approval.clone()),
    };
    store.preflight_record(s, &record)?;
    codec.response(1_000_000, &Response::Accepted(record.outcome()))?;
    codec.response(
        1_000_000,
        &Response::History(History {
            tip: Some(Fact::at(seq)),
            through: Some(Fact::at(seq)),
            records: vec![record],
            coverage: HistoryCoverage {
                first: seq,
                last: seq,
            },
            next_after: None,
            readiness: vec![],
        }),
    )?;
    Ok(())
}
