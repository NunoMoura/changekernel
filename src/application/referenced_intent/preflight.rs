use super::*;
// Exact prospective bytes are checked before review and again before reservation.
pub(super) fn preflight(
    store: &Store,
    s: &Snapshot,
    r: &Request,
    presentation: &str,
    pending: Option<&Pending>,
) -> Result<()> {
    let review_ref = Material::of(presentation.as_bytes());
    let receipt = Receipt {
        format: "ck-local-approval".into(),
        principal: "person-1".into(),
        subject_sha256: hash(&emit(r)?),
        presentation: review_ref.clone(),
        decision: "adopt".into(),
        ui: "local-tui-exact".into(),
    };
    let receipt_text = String::from_utf8(emit(&receipt)?).map_err(|_| Error::Unavailable)?;
    let approval = Material::of(receipt_text.as_bytes());
    if pending.is_none() {
        store.preflight_materials(&[presentation, &receipt_text])?;
    }
    for (material, text) in [
        (review_ref, presentation),
        (approval.clone(), receipt_text.as_str()),
    ] {
        reply(
            1_000_000,
            &Resolved {
                version: V.into(),
                kind: "resolved".into(),
                material,
                text: text.into(),
            },
        )?;
    }
    let seq = s.prefix.generation + 1;
    let record = Record {
        version: V.into(),
        custody: "custody-1".into(),
        seq,
        prev: s.tip(),
        input: r.clone(),
        approval: pending.map_or(approval, |p| p.approval.clone()),
    };
    let record_bytes = emit(&record)?;
    if s.prefix.end + record_bytes.len() as u64 > 4_194_304 {
        return Err(Error::Unsupported);
    }
    let p = Pending {
        input: r.clone(),
        approval: record.approval.clone(),
    };
    emit(&Prefix {
        pending: Some(p),
        ..s.prefix.clone()
    })?;
    accepted(1_000_000, &record)?;
    reply(
        1_000_000,
        &HistoryReply {
            version: V.into(),
            kind: "history".into(),
            tip: Some(Fact::at(seq)),
            through: Some(Fact::at(seq)),
            records: vec![record],
            coverage: HistoryCoverage {
                first: seq,
                last: seq,
            },
            next_after: None,
            readiness: vec![],
        },
    )?;
    Ok(())
}
