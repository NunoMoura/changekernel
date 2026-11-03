//! Private ports over the owned P31 coordinator. No caller-supplied record/Ports injection.
use super::backend::Backend;
use super::control::Mutation;
use super::local::{CustodyUse, LocalGuard, RetainedSource, TrustedLocal};
use super::prepared_operation_request::PreparedOperationRequest;
use super::records::{self, Catalog};
use crate::application::operation_request::OperationRequest;
use crate::application::ports::{
    Acceptance, Checks, ContentObservation, Context, IntakeRequest, Ports,
};
use crate::application::records::StoredOperation;
use crate::kernel::change::{
    ActionRequest, Adaptation, ContentKey, Error, GroundId, GroundVersion, IntakeCase,
    NativeConditions, Operation, Result, ScopeJudgment,
};

pub(super) struct StorePorts<'a, B: TrustedLocal> {
    pub store: &'a mut Backend,
    pub boundary: &'a mut B,
    pub catalog: &'a Catalog,
    pub records: &'a [StoredOperation],
    pub prepared: Option<&'a PreparedOperationRequest>,
    pub readonly: bool,
    pub resolving: Option<&'a OperationRequest>,
    pub committed: Option<(StoredOperation, Catalog)>,
}
fn retained<'a>(catalog: &'a Catalog, key: &ContentKey) -> Option<RetainedSource<'a>> {
    catalog.get(key).map(|r| RetainedSource {
        bytes: &r.bytes,
        establishment: &r.establishment,
        fresh: r.fresh.as_ref(),
    })
}
fn revalidate(
    guard: &mut impl LocalGuard,
    checks: &Checks,
    operation: Option<&Operation>,
    catalog: &Catalog,
) -> Result<()> {
    if guard.context()? != checks.context {
        return Err(Error::Stale);
    }
    for (key, bytes) in &checks.content_items {
        let snapshot = checks.intakes.get(key).ok_or(Error::Invalid)?;
        let request = match snapshot.case {
            IntakeCase::Fresh => IntakeRequest::Fresh(
                operation
                    .and_then(|op| op.fresh.iter().find(|p| &p.key == key))
                    .ok_or(Error::Invalid)?
                    .clone(),
            ),
            IntakeCase::FirstRetention => {
                if !operation.is_some_and(|op| op.first_retention.contains(key)) {
                    return Err(Error::Invalid);
                }
                IntakeRequest::FirstRetention(key.clone())
            }
            IntakeCase::KnownReuse => IntakeRequest::KnownReuse(key.clone()),
        };
        let actual = guard.resolve_content(checks, &request, retained(catalog, key))?;
        if &actual.bytes != bytes || actual.source_claim != snapshot.source_claim {
            return Err(Error::Conflict);
        }
    }
    for (id, version) in &checks.grounds {
        if guard.ground(id)? != *version {
            return Err(Error::Stale);
        }
    }
    if let Some((adaptation, judgment)) = &checks.adaptation {
        if guard.discretion(adaptation)? != *judgment {
            return Err(Error::Stale);
        }
    }
    if let Some((request, conditions)) = &checks.native {
        if guard.native_conditions(request)? != *conditions {
            return Err(Error::Stale);
        }
    }
    if let Some(operation) = operation {
        guard.authorize_intake(checks, operation)?;
    }
    guard.disclose(checks)?;
    if guard.context()? != checks.context {
        return Err(Error::Stale);
    }
    Ok(())
}
/// One final guard owns source/disclosure/Resolve authorization AND exact native-cut checks.
/// Recheck after callbacks even on refusal so observed physical damage permanently fences.
pub(super) fn disclose_checked(
    store: &mut Backend,
    guard: &mut impl LocalGuard,
    checks: &Checks,
    catalog: &Catalog,
    resolving: Option<&OperationRequest>,
) -> Result<()> {
    store.live().map_err(|_| Error::Unavailable)?;
    let permission = match resolving {
        Some(request) => guard.authorize_custody(
            &store.witness.subject.ledger,
            CustodyUse::Resolve(&checks.identity, request),
        ),
        None => Ok(()),
    };
    if let Err(error) = permission {
        let _ = store.live();
        return Err(error);
    }
    let result = revalidate(guard, checks, None, catalog);
    let permission = match resolving {
        Some(request) => guard.authorize_custody(
            &store.witness.subject.ledger,
            CustodyUse::Resolve(&checks.identity, request),
        ),
        None => Ok(()),
    };
    let context = guard.context();
    store.live().map_err(|_| Error::Unavailable)?;
    result?;
    permission?;
    if context? != checks.context {
        return Err(Error::Stale);
    }
    Ok(())
}
impl<B: TrustedLocal> Ports for StorePorts<'_, B> {
    fn context(&mut self) -> Result<Context> {
        self.boundary.lock()?.context()
    }
    fn resolve_content(
        &mut self,
        checks: &Checks,
        request: &IntakeRequest,
    ) -> Result<ContentObservation> {
        self.boundary.lock()?.resolve_content(
            checks,
            request,
            retained(self.catalog, request.key()),
        )
    }
    fn authorize_intake(&mut self, checks: &Checks, operation: &Operation) -> Result<()> {
        self.boundary.lock()?.authorize_intake(checks, operation)
    }
    fn ground(&mut self, id: &GroundId) -> Result<GroundVersion> {
        self.boundary.lock()?.ground(id)
    }
    fn discretion(&mut self, adaptation: &Adaptation) -> Result<ScopeJudgment> {
        self.boundary.lock()?.discretion(adaptation)
    }
    fn native_conditions(&mut self, request: &ActionRequest) -> Result<NativeConditions> {
        self.boundary.lock()?.native_conditions(request)
    }
    fn accept(&mut self, record: &StoredOperation) -> Acceptance {
        if self.readonly || self.resolving.is_some() {
            return Acceptance::Refused(Error::Denied);
        }
        let Some(request) = self.prepared else {
            return Acceptance::Refused(Error::Invalid);
        };
        if record.operation_request().as_ref() != Ok(&request.typed)
            || self.store.witness.subject.identity.as_ref() != Some(&record.checks.identity)
            || record.checks.expected_operation != self.store.witness.cut.last
            || self.store.witness.cut.count.checked_add(1) != Some(record.sequence)
        {
            return Acceptance::Refused(Error::Conflict);
        }
        // Pure candidate semantics were supplied by the owned P31 Change. Prefix and context
        // are kept exact under the guard; never hand-reimplement kernel grant/admission rules.
        let prepared = match records::prepare(record, &request.raw, self.records) {
            Ok(v) => v,
            Err(_) => return Acceptance::Refused(Error::Invalid),
        };
        let mut after = match self.store.witness.cut.advance() {
            Ok(v) => v,
            Err(_) => return Acceptance::Refused(Error::Invalid),
        };
        after.count = record.sequence;
        after.last = Some(record.operation.id.clone());
        let mut guard = match self.boundary.lock() {
            Ok(g) => g,
            Err(e) => return Acceptance::Refused(e),
        };
        if let Err(e) = revalidate(
            &mut guard,
            &record.checks,
            Some(&record.operation),
            self.catalog,
        ) {
            return Acceptance::Refused(e);
        }
        match self
            .store
            .mutate(Mutation::Append, &request.raw, after, &mut guard, |c| {
                records::append(c, &prepared)
            }) {
            Ok(()) => {
                self.committed = Some((record.clone(), prepared.into_catalog()));
                Acceptance::Accepted
            }
            Err(_) => Acceptance::Indeterminate,
        }
    }
    fn disclose(&mut self, checks: &Checks) -> Result<()> {
        let mut guard = self.boundary.lock()?;
        disclose_checked(self.store, &mut guard, checks, self.catalog, self.resolving)
    }
}
