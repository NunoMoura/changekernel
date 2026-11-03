//! Supplied P34 read permissions and projection over the freshly verified physical history.
//! Public entry is cold_read: no writer/page-cache read shortcut is exposed here.
use super::local::{LocalGuard, RetainedSource};
use super::records::History;
use super::store_error::StoreError;
use crate::application::read::{
    self, ChangeAnchor, ChangePage, ChangePageCursor, ChangeProgress, ChangeRange, PublicRecord,
    ReadChangeRequest, ReadRefusal, ReadSource,
};
use crate::kernel::change::{
    ActorId, Authority, ContentReference, ContextVersion, Error, Identity, Result,
};

/// Fixed-size supplied current owner-role observation. It grants no history/Content access;
/// the separate disclosure callbacks are mandatory. The version is private and never encoded.
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub struct ReadContext {
    /// Supplied current role/actor observation; not independently authenticated by this reader.
    pub authority: Authority,
    /// Private revalidation token; never serialized into a public record or bookmark.
    pub version: ContextVersion,
}
impl ReadContext {
    /// Creates a fixed-size supplied observation, not disclosure permission or source evidence.
    #[must_use]
    pub fn new(authority: Authority, version: ContextVersion) -> Self {
        Self { authority, version }
    }
}
/// Supplied-trust P34 permissions, serialized with the relevant LocalGuard.
/// Implementations must bound these fixed local checks and cannot fetch native/replacement
/// payloads or wait for a human, model or tool. Owner-role trust is supplied, not authenticated
/// by this trait. History, exact Content/source permission and custody remain separate.
pub trait ReadDisclosure: LocalGuard {
    /// Returns the fixed current role/version, not a clone of an unbounded policy/ACL collection.
    ///
    /// # Errors
    ///
    /// Return an error if the current observation cannot be established. The read entry maps
    /// it to reason-free denial, not proof of source unavailability or absence.
    fn read_context(&mut self) -> Result<ReadContext>;
    /// Checks current whole-history disclosure for this Identity, independently of Content.
    ///
    /// # Errors
    ///
    /// Return an error when current history permission is denied or cannot be established.
    /// The caller receives denial, never empty history or partial coverage.
    fn disclose_history(&mut self, identity: &Identity) -> Result<()>;
    /// Current Content/source permission before existence/size/availability distinctions.
    /// Caller fields are not accepted membership evidence; membership is checked separately.
    ///
    /// # Errors
    ///
    /// Return an error if current Content/source permission is denied or cannot be established,
    /// without fetching bytes or disclosing whether the caller's membership exists.
    fn authorize_content(&mut self, membership: &ContentReference) -> Result<()>;
    /// Rechecks source/disclosure authority against accepted retention facts, without fetching.
    ///
    /// # Errors
    ///
    /// Return an error if current permission does not cover these accepted facts or cannot be
    /// established. The whole call is denied; retained bytes are not released or replaced.
    fn disclose_retained_content(
        &mut self,
        membership: &ContentReference,
        source: RetainedSource<'_>,
    ) -> Result<()>;
}
pub(super) fn refusal(error: StoreError) -> ReadRefusal {
    match error {
        StoreError::Refused(Error::Denied) => ReadRefusal::Denied,
        StoreError::Refused(Error::Stale | Error::Conflict) => ReadRefusal::Changed,
        StoreError::Limit => ReadRefusal::Limit,
        StoreError::UnsupportedProfile => ReadRefusal::Unsupported,
        _ => ReadRefusal::Unavailable,
    }
}
pub(super) fn page(
    source: &ReadSource,
    reader: &ActorId,
    history: &History,
    request: &ReadChangeRequest,
) -> std::result::Result<ChangePage, ReadRefusal> {
    let records = &history.records;
    let (selected, start, last) = read::scan(source, records, reader, request, |selected, _| {
        // Weight the public semantic/provenance spans, never undisclosed payload size.
        // Fixed allowance covers qualified position/membership wrappers and a maximal cursor.
        let mut reserved = 65536usize;
        for index in selected {
            let size = history
                .public_sizes
                .get(&records[*index].operation.id)
                .ok_or(ReadRefusal::Unavailable)?;
            reserved = reserved
                .checked_add(size.checked_mul(4).ok_or(ReadRefusal::Limit)?)
                .and_then(|n| n.checked_add(8192))
                .ok_or(ReadRefusal::Limit)?;
        }
        Ok(reserved <= request.limits.reply_bytes)
    })?;
    let after = read::resolve(source, records, &ChangeAnchor::Sequence(start as u64))?;
    let through = read::resolve(source, records, &ChangeAnchor::Sequence(last as u64))?;
    let observed_head = read::resolve(source, records, &ChangeAnchor::Current)?;
    let progress = if last as u64 == request.range.through.sequence {
        ChangeProgress::EndOfRange
    } else {
        ChangeProgress::More {
            next_page_cursor: Box::new(ChangePageCursor {
                range: request.range.clone(),
                selection: request.selection.clone(),
                reader: reader.clone(),
                permission_scope: source.identity.change_key(),
                last_scanned: through.clone(),
            }),
        }
    };
    let records = selected
        .into_iter()
        .map(|i| PublicRecord::from_stored(source, &records[i]))
        .collect();
    Ok(ChangePage {
        records,
        scanned: ChangeRange { after, through },
        observed_head,
        progress,
    })
}
pub(super) fn retained<'history>(
    history: &'history History,
    membership: &ContentReference,
) -> std::result::Result<RetainedSource<'history>, ReadRefusal> {
    let record = history
        .records
        .iter()
        .find(|r| r.operation.id == membership.operation)
        .ok_or(ReadRefusal::Denied)?;
    if record.checks.identity != membership.identity {
        return Err(ReadRefusal::Denied);
    }
    let bytes = record
        .checks
        .content_items
        .get(&membership.content)
        .ok_or(ReadRefusal::Denied)?;
    let retained = history
        .catalog
        .get(&membership.content)
        .ok_or(ReadRefusal::Unavailable)?;
    Ok(RetainedSource {
        bytes,
        establishment: &retained.establishment,
        fresh: retained.fresh.as_ref(),
    })
}
