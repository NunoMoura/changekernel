use super::*;
impl Store {
    // Form/material verification only: no current-tip admission, approval creation,
    // key association, reservation or effect. Historical reviews remain exact.
    pub(super) fn validate_generated(&self, text: &str, s: &Snapshot) -> Result<()> {
        if text.len() > 65_536 {
            return Err(Error::Unsupported);
        }
        if text == POLICY {
            return Ok(());
        }
        if let Ok(review) = versioned_canonical::<Review>(text.as_bytes()) {
            return self.validate_review(&review, s);
        }
        let receipt: Receipt =
            versioned_canonical(text.as_bytes()).map_err(|_| Error::Unavailable)?;
        if receipt.format != "ck-local-approval"
            || receipt.principal != "person-1"
            || receipt.decision != "adopt"
            || receipt.ui != "local-tui-exact"
            || !hex(&receipt.subject_sha256, 64)
            || !receipt.presentation.valid()
        {
            return Err(Error::Unavailable);
        }
        let review: Review = versioned_canonical(self.resolve(&receipt.presentation)?.as_bytes())
            .map_err(|_| Error::Unavailable)?;
        self.validate_review(&review, s)?;
        if receipt.subject_sha256 != hash(&emit(&review.input)?) {
            return Err(Error::Unavailable);
        }
        Ok(())
    }
    fn validate_review(&self, review: &Review, s: &Snapshot) -> Result<()> {
        let r = &review.input;
        if !r.mutation() {
            return Err(Error::Unavailable);
        }
        let previous = match r.op.as_str() {
            "open_intent" => {
                if r.expected.is_some() || review.previous.is_some() {
                    return Err(Error::Unavailable);
                }
                None
            }
            "revise_intent" => {
                let expected = r.expected.as_ref().ok_or(Error::Unavailable)?;
                if review.previous.as_ref().map(|p| &p.fact) != Some(expected) {
                    return Err(Error::Unavailable);
                }
                Some(
                    s.records
                        .get(expected.seq as usize - 1)
                        .ok_or(Error::Unavailable)?,
                )
            }
            _ => return Err(Error::Unavailable),
        };
        let expected = self.review(r, previous).map_err(|_| Error::Unavailable)?;
        if *review != expected {
            return Err(Error::Unavailable);
        }
        Ok(())
    }
}
