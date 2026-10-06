//! Concrete v5 shapes on the shared bounded parser and canonical formatter.
use super::super::{
    codec::{field_key, required},
    work::{self, Boundary as B, Heap, Owned},
};

use crate::kernel::changes::ledger::{Created as BaseResult, Cursor, Request as BaseRequest};
use serde_core::{
    de::{self, MapAccess, Visitor},
    ser::SerializeStruct,
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::{fmt, ops::Deref};
const L: usize = 65_536;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct HistoryRequest {
    pub base: BaseRequest,
    pub expected_intent: Option<String>,
    pub check: Option<String>,
    pub at: Option<Option<String>>,
    pub from: Option<Option<String>>,
    pub purpose: Option<String>,
}
impl Heap for HistoryRequest {
    fn heap(&self) -> usize {
        self.v.heap()
            + self.op.heap()
            + self.ledger.heap()
            + self.workspace_id.heap()
            + self.key.heap()
            + self.what.heap()
            + self.why.heap()
            + self.cursor.heap()
            + self.limit.heap()
            + self.change.heap()
            + self.expected_intent.heap()
            + self.check.heap()
            + self.at.heap()
            + self.from.heap()
            + self.purpose.heap()
    }
    fn logical(&self) -> usize {
        self.v.logical()
            + self.op.logical()
            + self.ledger.logical()
            + self.workspace_id.logical()
            + self.key.logical()
            + self.what.logical()
            + self.why.logical()
            + self.cursor.logical()
            + self.limit.logical()
            + self.change.logical()
            + self.expected_intent.logical()
            + self.check.logical()
            + self.at.logical()
            + self.from.logical()
            + self.purpose.logical()
    }
}
impl Serialize for HistoryRequest {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct("request", 15)?;
        o.serialize_field("v", &self.v)?;
        o.serialize_field("op", &self.op)?;
        o.serialize_field("ledger", &self.ledger)?;
        o.serialize_field("workspace_id", &self.workspace_id)?;
        if let Some(v) = &self.change {
            o.serialize_field("change", v)?;
        }
        if let Some(v) = &self.key {
            o.serialize_field("key", v)?;
        }
        if let Some(v) = &self.expected_intent {
            o.serialize_field("expected_intent", v)?;
        }
        if let Some(v) = &self.what {
            o.serialize_field("what", v)?;
        }
        if let Some(v) = &self.why {
            o.serialize_field("why", v)?;
        }
        if let Some(v) = &self.check {
            o.serialize_field("check", v)?;
        }
        if let Some(v) = &self.cursor {
            o.serialize_field("cursor", v)?;
        }
        if let Some(v) = &self.at {
            o.serialize_field("at", v)?;
        }
        if let Some(v) = &self.from {
            o.serialize_field("from", v)?;
        }
        if let Some(v) = &self.limit {
            o.serialize_field("limit", v)?;
        }
        if let Some(v) = &self.purpose {
            o.serialize_field("purpose", v)?;
        }
        o.end()
    }
}
impl<'de> Deserialize<'de> for HistoryRequest {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Union;
        impl<'de> Visitor<'de> for Union {
            type Value = HistoryRequest;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("closed HistoryRequest")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Self::Value, M::Error> {
                let _header = work::Fixed::new(std::mem::size_of::<HistoryRequest>());
                let mut v: Option<Owned<u64>> = None;
                let mut op: Option<Owned<String>> = None;
                let mut ledger: Option<Owned<String>> = None;
                let mut workspace_id: Option<Owned<String>> = None;
                let mut key: Option<Owned<String>> = None;
                let mut what: Option<Owned<String>> = None;
                let mut why: Option<Owned<Option<String>>> = None;
                let mut cursor: Option<Owned<Option<Cursor>>> = None;
                let mut limit: Option<Owned<u64>> = None;
                let mut change: Option<Owned<String>> = None;
                let mut expected_intent: Option<Owned<String>> = None;
                let mut check: Option<Owned<String>> = None;
                let mut at: Option<Owned<Option<String>>> = None;
                let mut from: Option<Owned<Option<String>>> = None;
                let mut purpose: Option<Owned<String>> = None;
                while let Some(k) = m.next_key::<String>()? {
                    let k = Owned::new(k);
                    field_key(
                        &k,
                        &[
                            "v",
                            "op",
                            "ledger",
                            "workspace_id",
                            "key",
                            "what",
                            "why",
                            "cursor",
                            "limit",
                            "change",
                            "expected_intent",
                            "check",
                            "at",
                            "from",
                            "purpose",
                        ],
                    );
                    match k.as_str() {
                        "v" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || v.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            v = Some(Owned::new(m.next_value::<u64>()?));
                        }
                        "op" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || op.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            op = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "ledger" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || ledger.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            ledger = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "workspace_id" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || workspace_id.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            workspace_id = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "key" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || key.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            key = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "what" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || what.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            what = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "why" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || why.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            why = Some(Owned::new(m.next_value::<Option<String>>()?));
                        }
                        "cursor" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || cursor.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            cursor = Some(Owned::new(m.next_value::<Option<Cursor>>()?));
                        }
                        "limit" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || limit.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            limit = Some(Owned::new(m.next_value::<u64>()?));
                        }
                        "change" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || change.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            change = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "expected_intent" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || expected_intent.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            expected_intent = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "check" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || check.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            check = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "at" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || at.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            at = Some(Owned::new(m.next_value::<Option<String>>()?));
                        }
                        "from" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || from.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            from = Some(Owned::new(m.next_value::<Option<String>>()?));
                        }
                        "purpose" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || purpose.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            purpose = Some(Owned::new(m.next_value::<String>()?));
                        }
                        _ => {
                            work::complete(B::Fields, false);
                            return Err(de::Error::custom("unknown field"));
                        }
                    }
                }
                let r = Owned::new(HistoryRequest {
                    base: BaseRequest {
                        v: required(v, "v")?.into_inner(),
                        op: required(op, "op")?.into_inner(),
                        ledger: required(ledger, "ledger")?.into_inner(),
                        workspace_id: required(workspace_id, "workspace_id")?.into_inner(),
                        key: key.map(Owned::into_inner),
                        what: what.map(Owned::into_inner),
                        why: why.map(Owned::into_inner),
                        cursor: cursor.map(Owned::into_inner),
                        limit: limit.map(Owned::into_inner),
                        change: change.map(Owned::into_inner),
                    },
                    expected_intent: expected_intent.map(Owned::into_inner),
                    check: check.map(Owned::into_inner),
                    at: at.map(Owned::into_inner),
                    from: from.map(Owned::into_inner),
                    purpose: purpose.map(Owned::into_inner),
                });
                if !r.valid() {
                    return Err(de::Error::custom("HistoryRequest shape"));
                }
                Ok(r.into_inner())
            }
        }
        d.deserialize_map(Union)
    }
}

fn scalar(ok: bool, words: usize) -> bool {
    work::test(B::Fields, 0, words, || ok)
}
fn word(s: &str, target: &str) -> bool {
    work::test(B::Fields, s.len().max(target.len()), 1, || s == target)
}
fn identifier(s: &str) -> bool {
    crate::kernel::changes::ledger_history::id(s)
}
pub(crate) fn reference(s: &str) -> Option<(&str, u64)> {
    if !scalar(s.len() <= 71, 1) {
        return None;
    }
    work::attempt(B::Fields, s.len(), 1);
    let split = s.split_once(':');
    work::complete(B::Fields, split.is_some());
    let (change, rest) = split?;
    if !identifier(change) {
        return None;
    }
    if word(rest, "origin") {
        return Some((change, 1));
    }
    work::attempt(B::Fields, rest.len().max(3), 1);
    let decimal = rest.strip_prefix("op:");
    work::complete(B::Fields, decimal.is_some());
    let decimal = decimal?;
    if !scalar((1..=3).contains(&decimal.len()), 2)
        || !work::test(B::Fields, decimal.len(), 2, || {
            decimal.as_bytes()[0] != b'0' && decimal.bytes().all(|b| b.is_ascii_digit())
        })
    {
        return None;
    }
    work::attempt(B::Fields, decimal.len(), 1);
    let number = decimal.parse::<u64>();
    work::complete(B::Fields, number.is_ok());
    let number = number.ok()?;
    scalar((2..=128).contains(&number), 2).then_some((change, number))
}

impl HistoryRequest {
    fn valid(&self) -> bool {
        if !scalar(self.v == 5, 1)
            || !identifier(&self.ledger)
            || !identifier(&self.workspace_id)
            || !scalar(self.op.len() <= 15, 1)
        {
            return false;
        }
        let present = [
            self.key.is_some(),
            self.what.is_some(),
            self.why.is_some(),
            self.cursor.is_some(),
            self.limit.is_some(),
            self.change.is_some(),
            self.expected_intent.is_some(),
            self.check.is_some(),
            self.at.is_some(),
            self.from.is_some(),
            self.purpose.is_some(),
        ];
        let mask = present
            .iter()
            .enumerate()
            .fold(0u16, |m, (i, p)| m | if *p { 1 << i } else { 0 });
        work::attempt(B::Fields, self.op.len().max(15), 7);
        let expected = match self.op.as_str() {
            "create_change" => 7,
            "list_changes" => 24,
            "select_change" => 32,
            "revise_intent" => 103,
            "run_check" => 225,
            "inspect_history" => 816,
            "inspect_context" => 1312,
            _ => {
                work::complete(B::Fields, false);
                return false;
            }
        };
        work::complete(B::Fields, true);
        if !scalar(mask == expected, 11) {
            return false;
        }
        if self.key.as_ref().is_some_and(|s| !identifier(s))
            || self.change.as_ref().is_some_and(|s| !identifier(s))
        {
            return false;
        }
        if self
            .what
            .as_ref()
            .is_some_and(|s| !scalar(s.len() <= L, 1) || !scalar(!s.trim().is_empty(), 1))
            || self
                .why
                .as_ref()
                .and_then(Option::as_ref)
                .is_some_and(|s| !scalar(s.len() <= L, 1))
        {
            return false;
        }
        if self.limit.is_some_and(|n| !scalar((1..=4).contains(&n), 2)) {
            return false;
        }
        if self
            .expected_intent
            .as_ref()
            .is_some_and(|s| reference(s).is_none())
            || self
                .at
                .as_ref()
                .and_then(Option::as_ref)
                .is_some_and(|s| reference(s).is_none())
            || self
                .from
                .as_ref()
                .and_then(Option::as_ref)
                .is_some_and(|s| reference(s).is_none())
        {
            return false;
        }
        if let Some(c) = self.cursor.as_ref().and_then(Option::as_ref) {
            if !(scalar(c.v == 5, 1)
                && identifier(&c.ledger)
                && identifier(&c.workspace_id)
                && identifier(&c.after)
                && scalar((1..=4).contains(&c.limit), 2))
            {
                return false;
            }
        }
        if self
            .purpose
            .as_ref()
            .is_some_and(|s| !word(s, "understanding"))
        {
            return false;
        }
        if let Some(c) = &self.check {
            if !(scalar(!c.is_empty() && c.len() <= 64, 2)
                && work::test(B::Fields, c.len(), 1, || {
                    c.bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"_@-".contains(&b))
                }))
            {
                return false;
            }
        }
        true
    }
    pub fn mutation(&self) -> bool {
        matches!(
            self.op.as_str(),
            "create_change" | "revise_intent" | "run_check"
        )
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(in crate::adapters::jsonl::ledger) struct Evidence {
    pub intent: String,
    pub field: String,
    pub utf8_bytes: u64,
    pub limit: u64,
}
shape!(Evidence {
    intent: String,
    field: String,
    utf8_bytes: u64,
    limit: u64
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(in crate::adapters::jsonl::ledger) struct HistoryResult {
    pub base: BaseResult,
    pub intent: Option<String>,
    pub previous_intent: Option<String>,
    pub adoption: Option<String>,
    pub policy: Option<String>,
    pub check: Option<String>,
    pub evaluator: Option<String>,
    pub passed: Option<bool>,
    pub feedback: Option<String>,
    pub evidence: Option<Evidence>,
}
impl Heap for HistoryResult {
    fn heap(&self) -> usize {
        self.v.heap()
            + self.kind.heap()
            + self.ledger.heap()
            + self.workspace_id.heap()
            + self.change.heap()
            + self.key.heap()
            + self.actor.heap()
            + self.result.heap()
            + self.seq.heap()
            + self.intent.heap()
            + self.previous_intent.heap()
            + self.adoption.heap()
            + self.policy.heap()
            + self.check.heap()
            + self.evaluator.heap()
            + self.passed.heap()
            + self.feedback.heap()
            + self.evidence.heap()
    }
    fn logical(&self) -> usize {
        self.v.logical()
            + self.kind.logical()
            + self.ledger.logical()
            + self.workspace_id.logical()
            + self.change.logical()
            + self.key.logical()
            + self.actor.logical()
            + self.result.logical()
            + self.seq.logical()
            + self.intent.logical()
            + self.previous_intent.logical()
            + self.adoption.logical()
            + self.policy.logical()
            + self.check.logical()
            + self.evaluator.logical()
            + self.passed.logical()
            + self.feedback.logical()
            + self.evidence.logical()
    }
}
impl Serialize for HistoryResult {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct("HistoryResult", 18)?;
        o.serialize_field("v", &self.v)?;
        o.serialize_field("kind", &self.kind)?;
        o.serialize_field("ledger", &self.ledger)?;
        o.serialize_field("workspace_id", &self.workspace_id)?;
        o.serialize_field("change", &self.change)?;
        o.serialize_field("key", &self.key)?;
        o.serialize_field("actor", &self.actor)?;
        o.serialize_field("result", &self.result)?;
        o.serialize_field("seq", &self.seq)?;
        if let Some(v) = &self.intent {
            o.serialize_field("intent", v)?;
        }
        if let Some(v) = &self.previous_intent {
            o.serialize_field("previous_intent", v)?;
        }
        if let Some(v) = &self.adoption {
            o.serialize_field("adoption", v)?;
        }
        if let Some(v) = &self.policy {
            o.serialize_field("policy", v)?;
        }
        if let Some(v) = &self.check {
            o.serialize_field("check", v)?;
        }
        if let Some(v) = &self.evaluator {
            o.serialize_field("evaluator", v)?;
        }
        if let Some(v) = &self.passed {
            o.serialize_field("passed", v)?;
        }
        if let Some(v) = &self.feedback {
            o.serialize_field("feedback", v)?;
        }
        if let Some(v) = &self.evidence {
            o.serialize_field("evidence", v)?;
        }
        o.end()
    }
}
impl<'de> Deserialize<'de> for HistoryResult {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Union;
        impl<'de> Visitor<'de> for Union {
            type Value = HistoryResult;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("closed HistoryResult")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Self::Value, M::Error> {
                let _header = work::Fixed::new(std::mem::size_of::<HistoryResult>());
                let mut v: Option<Owned<u64>> = None;
                let mut kind: Option<Owned<String>> = None;
                let mut ledger: Option<Owned<String>> = None;
                let mut workspace_id: Option<Owned<String>> = None;
                let mut change: Option<Owned<String>> = None;
                let mut key: Option<Owned<String>> = None;
                let mut actor: Option<Owned<String>> = None;
                let mut result: Option<Owned<String>> = None;
                let mut seq: Option<Owned<u64>> = None;
                let mut intent: Option<Owned<String>> = None;
                let mut previous_intent: Option<Owned<String>> = None;
                let mut adoption: Option<Owned<String>> = None;
                let mut policy: Option<Owned<String>> = None;
                let mut check: Option<Owned<String>> = None;
                let mut evaluator: Option<Owned<String>> = None;
                let mut passed: Option<Owned<bool>> = None;
                let mut feedback: Option<Owned<String>> = None;
                let mut evidence: Option<Owned<Evidence>> = None;
                while let Some(k) = m.next_key::<String>()? {
                    let k = Owned::new(k);
                    field_key(
                        &k,
                        &[
                            "v",
                            "kind",
                            "ledger",
                            "workspace_id",
                            "change",
                            "key",
                            "actor",
                            "result",
                            "seq",
                            "intent",
                            "previous_intent",
                            "adoption",
                            "policy",
                            "check",
                            "evaluator",
                            "passed",
                            "feedback",
                            "evidence",
                        ],
                    );
                    match k.as_str() {
                        "v" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || v.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            v = Some(Owned::new(m.next_value::<u64>()?));
                        }
                        "kind" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || kind.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            kind = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "ledger" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || ledger.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            ledger = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "workspace_id" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || workspace_id.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            workspace_id = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "change" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || change.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            change = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "key" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || key.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            key = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "actor" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || actor.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            actor = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "result" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || result.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            result = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "seq" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || seq.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            seq = Some(Owned::new(m.next_value::<u64>()?));
                        }
                        "intent" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || intent.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            intent = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "previous_intent" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || previous_intent.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            previous_intent = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "adoption" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || adoption.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            adoption = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "policy" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || policy.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            policy = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "check" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || check.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            check = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "evaluator" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || evaluator.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            evaluator = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "passed" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || passed.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            passed = Some(Owned::new(m.next_value::<bool>()?));
                        }
                        "feedback" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || feedback.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            feedback = Some(Owned::new(m.next_value::<String>()?));
                        }
                        "evidence" => {
                            work::complete(B::Fields, true);
                            if !work::test(B::Fields, 0, 1, || evidence.is_none()) {
                                return Err(de::Error::custom("duplicate field"));
                            }
                            evidence = Some(Owned::new(m.next_value::<Evidence>()?));
                        }
                        _ => {
                            work::complete(B::Fields, false);
                            return Err(de::Error::custom("unknown field"));
                        }
                    }
                }
                let r = Owned::new(HistoryResult {
                    base: BaseResult {
                        v: required(v, "v")?.into_inner(),
                        kind: required(kind, "kind")?.into_inner(),
                        ledger: required(ledger, "ledger")?.into_inner(),
                        workspace_id: required(workspace_id, "workspace_id")?.into_inner(),
                        change: required(change, "change")?.into_inner(),
                        key: required(key, "key")?.into_inner(),
                        actor: required(actor, "actor")?.into_inner(),
                        result: required(result, "result")?.into_inner(),
                        seq: required(seq, "seq")?.into_inner(),
                    },
                    intent: intent.map(Owned::into_inner),
                    previous_intent: previous_intent.map(Owned::into_inner),
                    adoption: adoption.map(Owned::into_inner),
                    policy: policy.map(Owned::into_inner),
                    check: check.map(Owned::into_inner),
                    evaluator: evaluator.map(Owned::into_inner),
                    passed: passed.map(Owned::into_inner),
                    feedback: feedback.map(Owned::into_inner),
                    evidence: evidence.map(Owned::into_inner),
                });
                if !r.shape_valid() {
                    return Err(de::Error::custom("HistoryResult shape"));
                }
                Ok(r.into_inner())
            }
        }
        d.deserialize_map(Union)
    }
}
impl HistoryResult {
    fn shape_valid(&self) -> bool {
        let mask = [
            self.intent.is_some(),
            self.previous_intent.is_some(),
            self.adoption.is_some(),
            self.policy.is_some(),
            self.check.is_some(),
            self.evaluator.is_some(),
            self.passed.is_some(),
            self.feedback.is_some(),
            self.evidence.is_some(),
        ]
        .iter()
        .enumerate()
        .fold(0u16, |m, (i, p)| m | if *p { 1 << i } else { 0 });
        work::test(B::Fields, self.kind.len().max(15), 12, || {
            self.v == 5
                && match self.kind.as_str() {
                    "created" => mask == 4,
                    "intent_revised" => mask == 7,
                    "intent_assessed" => mask == 505,
                    _ => false,
                }
        })
    }
}
impl Deref for HistoryRequest {
    type Target = BaseRequest;
    fn deref(&self) -> &BaseRequest {
        &self.base
    }
}

impl Deref for HistoryResult {
    type Target = BaseResult;
    fn deref(&self) -> &BaseResult {
        &self.base
    }
}
impl HistoryResult {
    pub fn created(base: BaseResult) -> Self {
        Self {
            base,
            intent: None,
            previous_intent: None,
            adoption: Some("authenticated_direct".into()),
            policy: None,
            check: None,
            evaluator: None,
            passed: None,
            feedback: None,
            evidence: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(in crate::adapters::jsonl::ledger) struct MemberAnchorWire {
    pub format: String,
    pub custody: String,
    pub ledger: String,
    pub workspace_id: String,
    pub binding: String,
    pub change: String,
    pub owner: String,
    pub key: String,
    pub directory: String,
    pub directory_device: u64,
    pub directory_inode: u64,
    pub lock_device: u64,
    pub lock_inode: u64,
    pub stage: String,
    pub policy: String,
    pub check: String,
    pub evaluator: String,
    pub adopter: String,
}
shape!(MemberAnchorWire {
    format: String,
    custody: String,
    ledger: String,
    workspace_id: String,
    binding: String,
    change: String,
    owner: String,
    key: String,
    directory: String,
    directory_device: u64,
    directory_inode: u64,
    lock_device: u64,
    lock_inode: u64,
    stage: String,
    policy: String,
    check: String,
    evaluator: String,
    adopter: String
});
impl From<MemberAnchorWire> for super::super::codec::MemberAnchor {
    fn from(a: MemberAnchorWire) -> Self {
        Self {
            base: super::super::codec::MemberAnchorBase {
                format: a.format,
                custody: a.custody,
                ledger: a.ledger,
                workspace_id: a.workspace_id,
                binding: a.binding,
                change: a.change,
                owner: a.owner,
                key: a.key,
                directory: a.directory,
                directory_device: a.directory_device,
                directory_inode: a.directory_inode,
                lock_device: a.lock_device,
                lock_inode: a.lock_inode,
                stage: a.stage,
            },
            adoption: Some(super::super::selection::Adoption {
                policy: a.policy,
                check: a.check,
                evaluator: a.evaluator,
                adopter: a.adopter,
            }),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(in crate::adapters::jsonl::ledger) struct ErrorReply {
    pub v: u64,
    pub kind: String,
    pub code: String,
}
shape!(ErrorReply {
    v: u64,
    kind: String,
    code: String
});
