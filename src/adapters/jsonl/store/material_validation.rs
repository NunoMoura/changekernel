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
        approval_principal(&receipt)?;
        approval_decision(&receipt)?;
        if !hex(&receipt.subject_sha256, 64) || !receipt.presentation.valid() {
            return Err(Error::Unavailable);
        }
        let review: Review = versioned_canonical(self.resolve(&receipt.presentation)?.as_bytes())
            .map_err(|_| Error::Unavailable)?;
        self.validate_review(&review, s)?;
        approval_subject(&receipt, &hash(&emit(&review.input)?))
    }
    fn validate_review(&self, review: &Review, s: &Snapshot) -> Result<()> {
        let r = &review.input;
        let fact = historical_review_subject(r, review.previous.as_ref().map(|p| &p.fact))?;
        let previous = fact
            .as_ref()
            .map(|expected| {
                s.records
                    .get(expected.seq as usize - 1)
                    .ok_or(Error::Unavailable)
            })
            .transpose()?;
        let expected =
            review::review(self, &LegacyCodec, r, previous).map_err(|_| Error::Unavailable)?;
        if *review != expected {
            return Err(Error::Unavailable);
        }
        Ok(())
    }
}
