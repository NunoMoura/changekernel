//! Test-only orchestration: writes open a writer explicitly; reads drop it and start at the
//! Included reference. Expected records are fixture assertions, never a product read fallback.
use super::super::cold_read;
use super::super::original::{Original, OriginalReference};
use super::super::prepared_operation_request::PreparedOperationRequest;
use super::super::tests::{self, support};
use crate::application::change::OperationRequestError;
use crate::application::read::{
    ChangeAnchor, ChangePage, ChangePosition, ReadChangeRequest, ReadLimits, ReadReply,
};
use crate::application::read_budget::ReadWorkLimits;
use crate::application::read_call::{ReadCall, ReadValue};
use crate::application::records::StoredOperation;
use crate::kernel::change::{Accepted, ChangeKey, ContentReference, Identity};
use std::path::PathBuf;

pub(super) struct ReadFixture {
    original: Option<Original<support::Local>>,
    pub records: Vec<StoredOperation>,
    reference: OriginalReference,
    local: support::Local,
    root: PathBuf,
}
impl ReadFixture {
    pub fn writer(&mut self) -> &mut Original<support::Local> {
        if self.original.is_none() {
            self.original = Some(
                Original::open(&self.reference, self.local.clone(), &self.root)
                    .expect("explicit fixture writer opening"),
            );
        }
        self.original.as_mut().expect("fixture writer")
    }
    pub fn submit(
        &mut self,
        request: &PreparedOperationRequest,
    ) -> Result<Accepted, OperationRequestError> {
        let result = self.writer().submit(request);
        self.records = self.writer().records.clone();
        result
    }
    fn call(&mut self, call: &ReadCall) -> ReadReply<ReadValue> {
        drop(self.original.take());
        cold_read::read_local(
            &self.reference,
            &mut self.local,
            &self.root,
            call,
            ReadWorkLimits::default(),
        )
    }
    pub fn resolve_change_cursor(
        &mut self,
        change: &ChangeKey,
        anchor: &ChangeAnchor,
        limits: ReadLimits,
    ) -> ReadReply<ChangePosition> {
        match self.call(&ReadCall::Resolve {
            change: change.clone(),
            anchor: anchor.clone(),
            limits,
        }) {
            ReadReply::Returned(ReadValue::Position(p)) => ReadReply::Returned(p),
            ReadReply::Refused(r) => ReadReply::Refused(r),
            r => panic!("wrong family {r:?}"),
        }
    }
    pub fn read_change(&mut self, request: &ReadChangeRequest) -> ReadReply<ChangePage> {
        match self.call(&ReadCall::Change(Box::new(request.clone()))) {
            ReadReply::Returned(ReadValue::Change(p)) => ReadReply::Returned(*p),
            ReadReply::Refused(r) => ReadReply::Refused(r),
            r => panic!("wrong family {r:?}"),
        }
    }
    pub fn read_content(
        &mut self,
        membership: &ContentReference,
        limits: ReadLimits,
    ) -> ReadReply<Vec<u8>> {
        match self.call(&ReadCall::Content {
            membership: membership.clone(),
            limits,
        }) {
            ReadReply::Returned(ReadValue::Content(bytes)) => ReadReply::Returned(bytes),
            ReadReply::Refused(r) => ReadReply::Refused(r),
            r => panic!("wrong family {r:?}"),
        }
    }
    pub fn read_framed(
        &mut self,
        bytes: &[u8],
    ) -> Result<Vec<u8>, crate::adapters::codec::CodecError> {
        drop(self.original.take());
        cold_read::read_local_framed(
            &self.reference,
            &mut self.local,
            &self.root,
            bytes,
            ReadWorkLimits::default(),
        )
    }
}
pub(super) fn provision() -> (
    ReadFixture,
    Identity,
    PathBuf,
    OriginalReference,
    support::Local,
    PathBuf,
) {
    let (original, id, path, reference, local, root) = tests::provision();
    let fixture = ReadFixture {
        records: original.records.clone(),
        original: Some(original),
        reference: reference.clone(),
        local: local.clone(),
        root: root.clone(),
    };
    (fixture, id, path, reference, local, root)
}
