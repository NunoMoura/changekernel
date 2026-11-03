//! Nonmutating P34 entry: exclusive source lease, bounded private evidence copy, fresh native
//! verification and exact final physical comparison. Never opens a source writer/SQLite handle.
use super::control::{Kind, Mutation, Phase, Stage, Witness};
use super::custody::WriterCustody;
use super::local::{CustodyUse, TrustedLocal};
use super::native_read_budget::{self, NativeReadBudget};
use super::native_read_shape;
use super::original::OriginalReference;
use super::preflight::{self, Inspection, Proof, ReadCopy};
use super::read::{self, ReadContext, ReadDisclosure};
use super::records;
use super::register;
use super::schema;
use super::store_error::{StoreError, StoreResult};
use crate::adapters::{codec, native_profile};
use crate::application::operation_request::CURRENT_PROFILE;
use crate::application::read::{
    self as elementary, ReadLimits, ReadRefusal, ReadReply, ReadSource,
};
use crate::application::read_budget::{ReadBudget, ReadWorkLimits};
use crate::application::read_call::{ReadCall, ReadValue};
use rusqlite::{Connection, OpenFlags};
use std::path::Path;

// Prepay fixed guard work and up to two reason-only encodings before optional decode/work.
// One refusal may be packed in execute; final revalidation can replace it with another.
// Keeping this non-cloneable token outside execute leaves that capacity available even when
// the execution budget is exhausted. No reservation means codec failure, not an unpaid frame.
struct RefusalPacking {
    remaining: u8,
}
impl RefusalPacking {
    fn reserve(budget: &mut ReadBudget) -> Result<Self, ReadRefusal> {
        budget.allocate(65536)?;
        budget.work(65536)?;
        Ok(Self { remaining: 2 })
    }
    fn encode(
        &mut self,
        reason: ReadRefusal,
        maximum: usize,
    ) -> Result<Vec<u8>, codec::CodecError> {
        self.remaining = self
            .remaining
            .checked_sub(1)
            .ok_or(codec::CodecError::Limit)?;
        codec::encode_read_reply(&ReadReply::Refused(reason), maximum)
    }
}
fn limits(call: &ReadCall) -> ReadLimits {
    match call {
        ReadCall::Resolve { limits, .. } | ReadCall::Content { limits, .. } => *limits,
        ReadCall::Change(r) => r.limits,
    }
}
fn role(context: &ReadContext, reference: &OriginalReference) -> Result<(), ReadRefusal> {
    let a = &context.authority;
    let id = reference.identity();
    if a.owner_control.as_ref() != Some(id)
        || a.actor != id.owner_actor
        || a.represented_owner != id.owner
    {
        return Err(ReadRefusal::Denied);
    }
    Ok(())
}
fn authorize(
    guard: &mut impl ReadDisclosure,
    reference: &OriginalReference,
    call: &ReadCall,
    budget: &mut ReadBudget,
) -> Result<(), ReadRefusal> {
    if let ReadCall::Content { membership, .. } = call {
        if membership.identity != *reference.identity() {
            return Err(ReadRefusal::Denied);
        }
    }
    budget.callback()?;
    match call {
        ReadCall::Resolve { .. } | ReadCall::Change(_) => {
            guard.disclose_history(reference.identity())
        }
        ReadCall::Content { membership, .. } => guard.authorize_content(membership),
    }
    .map_err(|_| ReadRefusal::Denied)
}
fn custody_permission(
    guard: &mut impl ReadDisclosure,
    reference: &OriginalReference,
    root: &Path,
    budget: &mut ReadBudget,
) -> Result<(), ReadRefusal> {
    // Bound path cloning/component walks and native CString copies before supplied callbacks.
    // These are caller-supplied selectors, not protected source measurements.
    for path in [reference.location(), root] {
        if path.as_os_str().len() > 4096 || path.ancestors().count() > 64 {
            return Err(ReadRefusal::Limit);
        }
    }
    let subject = reference.subject();
    budget.callback()?;
    guard
        .authorize_custody(
            &subject.ledger,
            CustodyUse::OpenOriginal(reference.identity(), reference.location()),
        )
        .map_err(|_| ReadRefusal::Denied)?;
    budget.callback()?;
    guard
        .authorize_custody(&subject.ledger, CustodyUse::Verify(root))
        .map_err(|_| ReadRefusal::Denied)
}
fn read_inspection(
    reference: &OriginalReference,
    copy: &mut ReadCopy,
    custody: &WriterCustody,
    witness: &Witness,
    budget: &mut ReadBudget,
) -> StoreResult<Inspection> {
    let (main, wal) = copy.images(budget)?;
    native_read_shape::admit(&main, wal.as_deref(), budget)?;
    drop((main, wal));
    copy.check(custody)?;
    let c = Connection::open_with_flags(
        copy.directory().join("ledger.sqlite"),
        OpenFlags::SQLITE_OPEN_READ_ONLY
            | OpenFlags::SQLITE_OPEN_FULL_MUTEX
            | OpenFlags::SQLITE_OPEN_NOFOLLOW,
    )?;
    let native = NativeReadBudget::for_call(&c, budget)?;
    let result = (|| {
        preflight::configure(&c, true)?;
        native.reapply()?;
        let cut = schema::validate_for_read(&c, &witness.subject)?;
        let id = witness
            .subject
            .identity
            .as_ref()
            .ok_or(StoreError::Corrupt)?;
        let history = records::load_bounded(&c, id, &cut, budget)?;
        let activation = preflight::activation(&c)?
            .ok_or(StoreError::Refused(crate::kernel::change::Error::Denied))?;
        budget.work(activation.len() as u64 * 4)?;
        register::verify_read_receipt(&activation, reference, &witness.subject, &history)?;
        Ok(Inspection {
            cut,
            history: Some(history),
            activation: Some(activation),
            entries: None,
        })
    })();
    let result = native_read_budget::classify(&native, result);
    drop(native);
    c.close().map_err(|(_, e)| StoreError::Database(e))?;
    copy.verify_source(custody, witness, budget)?;
    result
}
fn current_cut(
    reference: &OriginalReference,
    custody: &WriterCustody,
    witness: &Witness,
    inspection: &Inspection,
    budget: &mut ReadBudget,
) -> StoreResult<()> {
    let receipt = inspection
        .activation
        .as_ref()
        .ok_or(StoreError::Refused(crate::kernel::change::Error::Denied))?;
    let history = inspection.history.as_ref().ok_or(StoreError::Corrupt)?;
    budget.work(receipt.len() as u64 * 4)?;
    register::verify_read_receipt(receipt, reference, &witness.subject, history)?;
    match &witness.pending {
        None if inspection.cut == witness.cut => Ok(()),
        None => Err(StoreError::Corrupt),
        Some(p) => {
            if !matches!(p.mutation, Mutation::Append | Mutation::Activate) {
                return Err(StoreError::Corrupt);
            }
            if p.stage == Stage::CommitPossible && inspection.cut == witness.cut {
                return Err(StoreError::Indeterminate);
            }
            match p.mutation {
                Mutation::Append => {
                    crate::adapters::codec::request_read_cost(&p.request, budget).map_err(|e| {
                        if e == codec::CodecError::Limit {
                            StoreError::Limit
                        } else {
                            StoreError::Corrupt
                        }
                    })?;
                    register::validate_pending(witness, inspection, custody.directory())?;
                }
                Mutation::Activate => {
                    if p.after.count != witness.cut.count
                        || p.after.last != witness.cut.last
                        || p.after.included != 0
                        || inspection.cut != p.after
                        || receipt != &p.request
                    {
                        return Err(StoreError::Corrupt);
                    }
                }
                _ => return Err(StoreError::Corrupt),
            }
            match p.stage {
                Stage::Prepared if inspection.cut == witness.cut => Ok(()),
                Stage::Prepared => Err(StoreError::Corrupt),
                Stage::CommitPossible if inspection.cut == witness.cut => {
                    Err(StoreError::Indeterminate)
                }
                Stage::CommitPossible if inspection.cut == p.after => Ok(()),
                Stage::CommitPossible => Err(StoreError::Corrupt),
            }
        }
    }
}
struct PhysicalRead {
    // Rust drops fields in declaration order: every source/copy descriptor must close before
    // the lifetime lease is released. Otherwise a new same-process writer could lose locks.
    copy: ReadCopy,
    inspection: Inspection,
    witness: Witness,
    custody: WriterCustody,
}
impl PhysicalRead {
    fn prepare(
        reference: &OriginalReference,
        root: &Path,
        budget: &mut ReadBudget,
    ) -> StoreResult<Self> {
        budget.work(64 * 64 * 16)?;
        budget.allocate(512 * 1024)?;
        native_profile::verify_runtime().map_err(StoreError::Native)?;
        let custody = WriterCustody::open(reference.location())?;
        let witness = Witness::read_bounded(&custody, budget)?;
        if witness.subject != reference.subject()
            || witness.subject.kind != Kind::Original
            || witness.phase == Phase::Preparing
        {
            return Err(StoreError::Custody);
        }
        let before = custody.journal_objects()?;
        let main = match witness.phase {
            Phase::Clean | Phase::Closing => before[0].is_none(),
            Phase::PreparingOpen => witness.journals[0].is_none(),
            _ => false,
        };
        // No closing/opening/clean publication, checkpoint, recovery write or register access.
        let mut copy = ReadCopy::capture(
            &custody,
            &witness,
            root,
            if main { Proof::Main } else { Proof::Journals },
            budget,
        )?;
        let inspection = read_inspection(reference, &mut copy, &custody, &witness, budget)?;
        current_cut(reference, &custody, &witness, &inspection, budget)?;
        Ok(Self {
            custody,
            witness,
            copy,
            inspection,
        })
    }
}

/// Executes one elementary read without writer opening or source/lifecycle mutation.
///
/// Requires an Included reference and a supplied current owner-role. History and exact
/// retained Content/source permissions are separate. Caller ceilings only tighten this
/// implementation's bounds; encoded-reply ceilings also apply to this typed entry.
///
/// # Refusals
///
/// Returns [`ReadReply::Refused`] for invalid request limits/bindings, missing current
/// permission, changed context, unsupported or unverifiable source evidence, or exhausted
/// read resources; see [`ReadRefusal`] for the distinctions. Denial reveals neither existence
/// nor protected details. A valid but larger original can refuse under the read ceilings.
/// No refused call releases partial data, advances a cursor, retries or falls back to an older
/// prefix. Returned Content is the exact accepted membership's retained bytes, never refetched.
pub fn read_local<B: TrustedLocal>(
    reference: &OriginalReference,
    boundary: &mut B,
    verification: &Path,
    call: &ReadCall,
    work: ReadWorkLimits,
) -> ReadReply<ReadValue>
where
    for<'guard> B::Guard<'guard>: ReadDisclosure,
{
    let result = ReadBudget::try_new(work).and_then(|mut budget| {
        let mut refusals = RefusalPacking::reserve(&mut budget)?;
        execute(
            reference,
            boundary,
            verification,
            call,
            budget,
            &mut refusals,
        )
    });
    match result {
        Ok((reply, _)) => reply,
        Err(reason) => ReadReply::Refused(reason),
    }
}
/// Runs [`read_local`]'s physical read path and returns one complete read-protocol frame.
///
/// This is not a writer entry, source discovery, authentication or export authority. Request
/// decoding and both returned/refused frames are bounded; the caller's reply ceiling is never
/// widened and no partial frame or page is returned.
///
/// # Errors
///
/// Propagates [`codec::CodecError`] for unsupported/malformed call framing or invalid wire
/// fields/values, as described by [`codec::decode_read_call`]. Returns
/// [`codec::CodecError::Limit`] for invalid work ceilings, insufficient pre-decode/refusal
/// reservation, decode-budget exhaustion, or when even a refusal cannot fit the actual reply
/// ceiling. Such errors are transport/codec failures, not valid refusals or empty data.
///
/// # Refusals
///
/// An `Ok` frame can encode [`ReadReply::Refused`] for the conditions documented by
/// [`read_local`] and [`ReadRefusal`]. Inspect the decoded reply; `Ok` alone does not mean
/// data was returned. Semantic request-limit failures are encoded only if the refusal fits.
/// Source/permission failures are not automatically retried and disclose no protected details.
pub fn read_local_framed<B: TrustedLocal>(
    reference: &OriginalReference,
    boundary: &mut B,
    verification: &Path,
    bytes: &[u8],
    work: ReadWorkLimits,
) -> Result<Vec<u8>, codec::CodecError>
where
    for<'guard> B::Guard<'guard>: ReadDisclosure,
{
    codec::read_call_header(bytes)?;
    let mut budget = ReadBudget::try_new(work).map_err(|_| codec::CodecError::Limit)?;
    let mut refusals =
        RefusalPacking::reserve(&mut budget).map_err(|_| codec::CodecError::Limit)?;
    // Header failure, invalid work ceilings or reserve/decode exhaustion returns a codec
    // error without encoding anything. Only a decoded call supplies a reply ceiling.
    let call = codec::decode_read_call_bounded(bytes, &mut budget)?;
    let maximum = limits(&call).reply_bytes.min(2 * 1024 * 1024);
    match execute(
        reference,
        boundary,
        verification,
        &call,
        budget,
        &mut refusals,
    ) {
        Ok((_, frame)) => Ok(frame),
        Err(reason) => refusals.encode(reason, maximum),
    }
}
fn execute<B: TrustedLocal>(
    reference: &OriginalReference,
    boundary: &mut B,
    root: &Path,
    call: &ReadCall,
    mut budget: ReadBudget,
    refusals: &mut RefusalPacking,
) -> Result<(ReadReply<ReadValue>, Vec<u8>), ReadRefusal>
where
    for<'guard> B::Guard<'guard>: ReadDisclosure,
{
    let limits = limits(call);
    limits.validate()?;
    let mut guard = boundary.lock().map_err(|_| ReadRefusal::Denied)?;
    budget.callback()?;
    let context = guard.read_context().map_err(|_| ReadRefusal::Denied)?;
    role(&context, reference)?;
    authorize(&mut guard, reference, call, &mut budget)?;
    custody_permission(&mut guard, reference, root, &mut budget)?;
    let mut physical = PhysicalRead::prepare(reference, root, &mut budget).map_err(|error| {
        #[cfg(test)]
        eprintln!("P34 prepare {}: {error:?}", reference.location().display());
        read::refusal(error)
    });
    let value = (|| {
        let physical = physical.as_ref().map_err(|r| *r)?;
        let history = physical
            .inspection
            .history
            .as_ref()
            .ok_or(ReadRefusal::Unavailable)?;
        let source = ReadSource {
            identity: reference.identity().clone(),
            profile: CURRENT_PROFILE,
        };
        match call {
            ReadCall::Resolve { change, anchor, .. } => {
                if *change != source.identity.change_key() {
                    return Err(ReadRefusal::Invalid);
                }
                if limits.reply_bytes < 512 {
                    return Err(ReadRefusal::Limit);
                }
                Ok(ReadValue::Position(elementary::resolve(
                    &source,
                    &history.records,
                    anchor,
                )?))
            }
            ReadCall::Change(request) => {
                budget.allocate(limits.reply_bytes as u64 * 16)?;
                budget.work(limits.reply_bytes as u64 * 64)?;
                Ok(ReadValue::Change(Box::new(read::page(
                    &source,
                    &context.authority.actor,
                    history,
                    request,
                )?)))
            }
            ReadCall::Content { membership, .. } => {
                let retained = read::retained(history, membership)?;
                budget.callback()?;
                budget.work(retained.bytes.len() as u64)?;
                guard
                    .disclose_retained_content(membership, retained)
                    .map_err(|_| ReadRefusal::Denied)?;
                let bytes = read::retained(history, membership)?.bytes;
                if bytes.len().checked_add(512).ok_or(ReadRefusal::Limit)? > limits.reply_bytes {
                    return Err(ReadRefusal::Limit);
                }
                budget.allocate(bytes.len() as u64)?;
                Ok(ReadValue::Content(bytes.to_vec()))
            }
        }
    })();
    let reply = match value {
        Ok(value) => ReadReply::Returned(value),
        Err(reason) => ReadReply::Refused(reason),
    };
    // Full reply packing, including envelopes/cursors, precedes the final physical comparison.
    let maximum = limits.reply_bytes;
    let frame = (|| {
        match &reply {
            ReadReply::Returned(_) => {
                budget.allocate(maximum as u64 * 16)?;
                budget.work(maximum as u64 * 64)?;
                codec::encode_read_reply(&reply, maximum)
            }
            ReadReply::Refused(reason) => refusals.encode(*reason, maximum),
        }
        .map_err(|_| ReadRefusal::Limit)
    })();
    let permission = authorize(&mut guard, reference, call, &mut budget).and_then(|()| {
        if let (ReadCall::Content { membership, .. }, Ok(p)) = (call, &physical) {
            if let Some(history) = &p.inspection.history {
                if let Ok(retained) = read::retained(history, membership) {
                    budget.callback()?;
                    guard
                        .disclose_retained_content(membership, retained)
                        .map_err(|_| ReadRefusal::Denied)?;
                }
            }
        }
        custody_permission(&mut guard, reference, root, &mut budget)
    });
    budget.callback()?;
    let latest = guard.read_context().map_err(|_| ReadRefusal::Denied)?;
    let checked = if let Ok(physical) = &mut physical {
        physical
            .copy
            .verify_source(&physical.custody, &physical.witness, &mut budget)
            .map_err(|error| {
                #[cfg(test)]
                eprintln!(
                    "P34 final source check {}: {error:?}",
                    reference.location().display()
                );
                read::refusal(error)
            })
    } else {
        Ok(())
    };
    // Always prefer denial over source-dependent distinctions, including budget exhaustion.
    permission?;
    role(&latest, reference)?;
    if context != latest {
        return Err(ReadRefusal::Changed);
    }
    checked?;
    Ok((reply, frame?))
}
