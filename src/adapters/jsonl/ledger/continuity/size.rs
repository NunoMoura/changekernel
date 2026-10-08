//! Arithmetic-only pre-reservation bounds, using the already observed origin
//! emission. No text traversal, formatter, path construction or future identity.
use super::super::*;

// Every non-path string below is an admitted identifier or a closed tag/value:
// <=64 ASCII bytes, with quotes. Decimal u64 values need <=20 bytes. The native
// encoding has exact 160-byte identity and 342-byte physical-pair extents.
const STRING: usize = 66;
const DECIMAL: usize = 20;
const IDENTITY: usize = 160;
const PHYSICAL: usize = 342;

// Evaluated only for the closed schemas below, at compile time. Values supplied
// as zero are inserted arithmetically later, not serialized or visited twice.
const fn object(fields: &[(&str, usize)]) -> usize {
    let mut extent = 2 + fields.len().saturating_sub(1);
    let mut i = 0;
    while i < fields.len() {
        extent += fields[i].0.len() + 3 + fields[i].1;
        i += 1;
    }
    extent
}
const ENTRY: usize = object(&[
    ("slot", DECIMAL),
    ("key", STRING),
    ("change", STRING),
    ("custody", STRING),
    ("actor", STRING),
    ("input_sha256", 66),
    ("origin_end", DECIMAL),
    ("origin_sha256", 66),
    ("physical", PHYSICAL),
]);
const READY: usize = object(&[
    ("slot", DECIMAL),
    ("input", 0),
    ("actor", STRING),
    ("phase", 7), // "ready"
    ("physical", PHYSICAL),
]);
const CONTROL: usize = object(&[
    ("format", STRING),
    ("custody", STRING),
    ("ledger", STRING),
    ("generation", DECIMAL),
    ("entries", 0),
    ("pending", 0),
]) + 1; // LF
const ANCHOR: usize = object(&[
    ("format", STRING),
    ("custody", STRING),
    ("ledger", STRING),
    ("workspace_id", STRING),
    ("binding", STRING),
    ("change", STRING),
    ("owner", STRING),
    ("key", STRING),
    ("directory", 0),
    ("directory_identity", IDENTITY),
    ("lock_identity", IDENTITY),
    ("stage", 11), // "installed"
    ("policy", STRING),
    ("check", STRING),
    ("evaluator", STRING),
    ("adopter", STRING),
]) + 1; // LF

struct Inputs {
    origin_bytes: usize,
    entries: usize,
    directory_bytes: usize,
}
struct Extents {
    ready: usize,
    accepted: usize,
    anchor: usize,
}
impl Inputs {
    fn extents(&self) -> Extents {
        // The complete canonical origin, including LF, contains the whole
        // canonical input: using its measured length is an upper bound, not a
        // second serialization. The caller has already bounded it by C and
        // validated <=15 installed entries and the <=4083-byte grant directory.
        let entries = 2 + self.entries * ENTRY + self.entries.saturating_sub(1);
        Extents {
            ready: CONTROL + entries + READY + self.origin_bytes,
            accepted: CONTROL + 2 + (self.entries + 1) * ENTRY + self.entries + 4,
            // Admitted paths contain no control characters; only quote and
            // backslash can expand. Reserve includes /members/m-16 (13 bytes).
            anchor: ANCHOR + 2 * (self.directory_bytes + 13) + 2,
        }
    }
}
impl Extents {
    fn fits(&self) -> bool {
        work::test(B::Fields, 0, 3, || {
            self.ready <= C && self.accepted <= C && self.anchor <= C
        })
    }
}
pub(crate) fn fits<P: Layout>(s: &Custody<P>, c: &Creations<P>, origin_bytes: usize) -> bool {
    let _headers = work::Fixed::new(
        std::mem::size_of::<Inputs>()
            + std::mem::size_of::<Extents>()
            + std::mem::size_of::<(&Custody<P>, &Creations<P>, usize)>()
            + std::mem::size_of::<(usize, &Inputs, &Extents)>(),
    );
    let inputs = Inputs {
        origin_bytes,
        entries: c.entries.0.len(),
        directory_bytes: s.grant.directory.as_os_str().len(),
    };
    inputs.extents().fits()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::LedgerContinuityCall;

    #[test]
    fn extent_limit_refusal_is_scalar_work_without_formatter_or_payload() {
        work::continuity_begin(LedgerContinuityCall::CreateChange, 0);
        let extents = Extents {
            ready: C,
            accepted: C,
            anchor: C,
        };
        assert!(extents.fits());
        let extents = Extents {
            ready: C + 1,
            ..extents
        };
        assert!(!extents.fits());
        // An origin at C is not alone sufficient: a populated future ready
        // control must also fit, without emitting it or allocating an owner.
        let inputs = Inputs {
            origin_bytes: C,
            entries: 15,
            directory_bytes: 4083,
        };
        assert!(!inputs.extents().fits());
        let w = work::continuity_seal();
        assert_eq!(w.fields.attempts, 3);
        assert_eq!(w.fields.schema_words, 9);
        assert_eq!(w.fields.matches, 1);
        assert_eq!(w.fields.no_matches, 2);
        assert_eq!(w.emissions.attempts, 0);
        assert_eq!(w.input_emissions.attempts, 0);
        assert_eq!(w.control_emissions.attempts, 0);
        assert_eq!(w.constructions.attempts, 0);
        assert_eq!(w.named_payload_peak, 0);
    }
}
