use super::*;
pub(crate) fn source<M: Materials>(store: &M, r: &Material) -> Result<String> {
    if r.bytes > 4096 {
        return Err(Error::Unsupported);
    }
    store.resolve(r)
}
pub(crate) fn review<M: Materials, C: Encoding>(
    store: &M,
    codec: &C,
    r: &Request,
    previous: Option<&Record>,
) -> Result<Review> {
    if !r.mutation() {
        return Err(Error::Invalid);
    }
    let instruction_text = source(store, r.instruction.as_ref().ok_or(Error::Invalid)?)?;
    let i = r.replacement.as_ref().ok_or(Error::Invalid)?;
    let what_text = source(store, &i.what)?;
    let why_text = i.why.as_ref().map(|r| source(store, r)).transpose()?;
    review_sources(&instruction_text, &what_text)?;
    let previous = previous
        .map(|p| {
            let i = p.input.replacement.as_ref().ok_or(Error::Unavailable)?;
            Ok(Previous {
                fact: Fact::at(p.seq),
                what_text: source(store, &i.what)?,
                why_text: i.why.as_ref().map(|r| source(store, r)).transpose()?,
            })
        })
        .transpose()?;
    let v = Review {
        format: "ck-intent-review".into(),
        input: r.clone(),
        policy_text: store.resolve(&store.policy())?,
        previous,
        instruction_text,
        what_text,
        why_text,
    };
    if v.policy_text != POLICY || codec.review(&v)?.len() > 65_536 {
        return Err(Error::Unsupported);
    }
    Ok(v)
}
pub(crate) fn grounds<M: Materials, C: Encoding>(
    store: &M,
    codec: &C,
    r: &Request,
    approval: &Material,
    previous: Option<&Record>,
) -> Result<()> {
    let receipt = codec.approval(&store.resolve(approval)?)?;
    let review = review(store, codec, r, previous)?;
    approval_principal(&receipt)?;
    approval_subject(&receipt, &codec.subject(r)?)?;
    let presentation = store.resolve(&receipt.presentation)?;
    exact_presentation(&codec.review(&review)?, &presentation)
}
