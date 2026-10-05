use super::work::{self, Boundary as B, Heap, Owned};
use crate::kernel::changes::ledger::{Created, Cursor, LedgerPair, Origin, Request, C};
use serde_core::{
    de::{self, MapAccess, SeqAccess, Visitor},
    ser::SerializeStruct,
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::fmt;
macro_rules! role {
    (Origin,$s:ident) => {
        work::Role::Record
    };
    (Inspection,$s:ident) => {
        work::Role::Record
    };
    (Creations,$s:ident) => {
        work::Role::Accepted($s.entries.0.len())
    };
    ($ty:ident,$s:ident) => {
        work::Role::Plain
    };
}
macro_rules! vector_role {
    (Metadata,$n:ident) => {
        work::Role::Metadata($n)
    };
    (Association,$n:ident) => {
        work::Role::Accepted($n)
    };
    ($ty:ident,$n:ident) => {
        work::Role::Plain
    };
}
// A closed discriminator compares one key with fixed candidate literals. The
// conservative group covers the largest available candidate and every schema
// alternative; empty/short keys do not erase the RHS or its words.
fn field_key(key: &str, names: &[&str]) {
    work::attempt(
        B::Fields,
        key.len()
            .max(names.iter().map(|n| n.len()).max().unwrap_or(0)),
        names.len(),
    );
}
fn required<T, E: de::Error>(value: Option<T>, name: &'static str) -> Result<T, E> {
    work::test(B::Fields, 0, 1, || value.is_some());
    value.ok_or_else(|| E::missing_field(name))
}
macro_rules! shape {
    ($ty:ident { $($field:ident : $ft:ty),+ $(,)? }) => {
        impl<'de> Deserialize<'de> for $ty {
            fn deserialize<D:Deserializer<'de>>(d:D)->Result<Self,D::Error> {
                struct Fixed;
                impl<'de> Visitor<'de> for Fixed {
                    type Value=$ty;
                    fn expecting(&self,f:&mut fmt::Formatter)->fmt::Result {f.write_str(stringify!($ty))}
                    fn visit_map<M:MapAccess<'de>>(self,mut m:M)->Result<$ty,M::Error> {
                        let _header=work::Fixed::new(std::mem::size_of::<$ty>());
                        $(let mut $field:Option<Owned<$ft>>=None;)+
                        while let Some(k)=m.next_key::<String>()? {
                            let k=Owned::new(k);
                            field_key(&k,&[$(stringify!($field)),+]);
                            match k.as_str() {
                                $(stringify!($field)=> {
                                    work::complete(B::Fields,true);
                                    if !work::test(B::Fields,0,1,||$field.is_none()) {
                                        return Err(de::Error::custom("duplicate field"));
                                    }
                                    $field=Some(Owned::new(m.next_value()?));
                                },)+
                                _=> {work::complete(B::Fields,false); return Err(de::Error::custom("unknown field"));}
                            }
                        }
                        let value=Owned::new($ty { $($field:required($field,stringify!($field))?.into_inner()),+ });
                        Ok(value.into_inner())
                    }
                }
                d.deserialize_struct(stringify!($ty),&[$(stringify!($field)),+],Fixed)
            }
        }
        impl Serialize for $ty {
            fn serialize<S:Serializer>(&self,s:S)->Result<S::Ok,S::Error> {
                let mut o=s.serialize_struct(stringify!($ty),[$(stringify!($field)),+].len())?;
                $(o.serialize_field(stringify!($field),&self.$field)?;)+ o.end()
            }
        }
        impl Heap for $ty {fn role(&self)->work::Role{role!($ty,self)}fn vector_role(n:usize)->work::Role{let _=n;vector_role!($ty,n)}fn heap(&self)->usize {0 $(+self.$field.heap())+}fn logical(&self)->usize {0 $(+self.$field.logical())+}}
    };
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Items<T>(pub Vec<T>);
impl<T: Heap> Heap for Items<T> {
    fn role(&self) -> work::Role {
        self.0.role()
    }
    fn logical(&self) -> usize {
        self.0.logical()
    }
    fn heap(&self) -> usize {
        self.0.heap()
    }
}
impl<T: Serialize> Serialize for Items<T> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        self.0.serialize(s)
    }
}
impl<'de, T: Deserialize<'de> + Heap> Deserialize<'de> for Items<T> {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Bounded<T>(std::marker::PhantomData<T>);
        impl<'de, T: Deserialize<'de> + Heap> Visitor<'de> for Bounded<T> {
            type Value = Items<T>;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("at most 16 entries")
            }
            fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<Self::Value, A::Error> {
                let mut items = Owned::new(Vec::with_capacity(16));
                for _ in 0..16 {
                    match a.next_element()? {
                        Some(v) => {
                            items.push(v);
                            items.refresh();
                        }
                        None => return Ok(Items(items.into_inner())),
                    }
                }
                struct Extra;
                impl<'de> Deserialize<'de> for Extra {
                    fn deserialize<D: Deserializer<'de>>(_: D) -> Result<Self, D::Error> {
                        work::test(B::Fields, 0, 1, || false);
                        Err(de::Error::custom("seventeenth entry"))
                    }
                }
                if a.next_element::<Extra>()?.is_some() {
                    return Err(de::Error::custom("seventeenth entry"));
                }
                Ok(Items(items.into_inner()))
            }
        }
        d.deserialize_seq(Bounded(std::marker::PhantomData))
    }
}
shape!(LedgerPair {
    change: String,
    custody: String
});
shape!(Cursor {
    v: u64,
    ledger: String,
    workspace_id: String,
    after: String,
    limit: u64
});
shape!(Created {
    v: u64,
    kind: String,
    ledger: String,
    workspace_id: String,
    change: String,
    key: String,
    actor: String,
    result: String,
    seq: u64
});
shape!(Origin { v: u64, custody: String, ledger: String, workspace_id: String, binding: String, change: String, seq: u64, prev: Option<String>, kind: String, input: Request, result: Created });
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Physical {
    pub directory_device: u64,
    pub directory_inode: u64,
    pub lock_device: u64,
    pub lock_inode: u64,
}
shape!(Physical {
    directory_device: u64,
    directory_inode: u64,
    lock_device: u64,
    lock_inode: u64
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Anchor {
    pub format: String,
    pub ledger: String,
    pub custody: String,
    pub workspace_id: String,
    pub binding: String,
    pub owner: String,
    pub directory: String,
    pub directory_device: u64,
    pub directory_inode: u64,
    pub lock_device: u64,
    pub lock_inode: u64,
    pub members_device: u64,
    pub members_inode: u64,
    pub stage: String,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct MemberAnchor {
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
}
shape!(MemberAnchor {
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
    stage: String
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Association {
    pub slot: u64,
    pub key: String,
    pub change: String,
    pub custody: String,
    pub actor: String,
    pub input_sha256: String,
    pub origin_end: u64,
    pub origin_sha256: String,
    pub physical: Physical,
}
shape!(Association {
    slot: u64,
    key: String,
    change: String,
    custody: String,
    actor: String,
    input_sha256: String,
    origin_end: u64,
    origin_sha256: String,
    physical: Physical
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Reservation {
    pub slot: u64,
    pub input: Request,
    pub actor: String,
    pub phase: String,
    pub physical: Option<Physical>,
}
shape!(Reservation { slot: u64, input: Request, actor: String, phase: String, physical: Option<Physical> });
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Creations {
    pub format: String,
    pub custody: String,
    pub ledger: String,
    pub generation: u64,
    pub entries: Items<Association>,
    pub pending: Option<Reservation>,
}
shape!(Creations { format: String, custody: String, ledger: String, generation: u64, entries: Items<Association>, pending: Option<Reservation> });
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Pending {
    pub input: Request,
    pub actor: String,
}
shape!(Pending {
    input: Request,
    actor: String
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Prefix {
    pub format: String,
    pub custody: String,
    pub change: String,
    pub generation: u64,
    pub end: u64,
    pub sha256: Option<String>,
    pub pending: Option<Pending>,
}
shape!(Prefix { format: String, custody: String, change: String, generation: u64, end: u64, sha256: Option<String>, pending: Option<Pending> });
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Accepted {
    pub first: u64,
    pub last: u64,
    pub sha256: String,
}
shape!(Accepted {
    first: u64,
    last: u64,
    sha256: String
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Metadata {
    pub change: String,
    pub origin: String,
    pub actor: String,
    pub accepted: Accepted,
    pub progress: String,
}
shape!(Metadata {
    change: String,
    origin: String,
    actor: String,
    accepted: Accepted,
    progress: String
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Selection {
    pub v: u64,
    pub kind: String,
    pub ledger: String,
    pub workspace_id: String,
    pub member: Metadata,
}
shape!(Selection {
    v: u64,
    kind: String,
    ledger: String,
    workspace_id: String,
    member: Metadata
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Coverage {
    pub first: u64,
    pub last: u64,
    pub sha256: String,
    pub selected: u64,
    pub returned: u64,
    pub complete: bool,
}
shape!(Coverage {
    first: u64,
    last: u64,
    sha256: String,
    selected: u64,
    returned: u64,
    complete: bool
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Inspection {
    pub v: u64,
    pub kind: String,
    pub ledger: String,
    pub workspace_id: String,
    pub change: String,
    pub projection: String,
    pub purpose: String,
    pub origin: String,
    pub tip: String,
    pub current_intent: String,
    pub record: Origin,
    pub coverage: Coverage,
    pub progress: String,
}
shape!(Inspection {
    v: u64,
    kind: String,
    ledger: String,
    workspace_id: String,
    change: String,
    projection: String,
    purpose: String,
    origin: String,
    tip: String,
    current_intent: String,
    record: Origin,
    coverage: Coverage,
    progress: String
});

impl Heap for Request {
    fn logical(&self) -> usize {
        self.payload()
    }
    fn heap(&self) -> usize {
        self.op.heap()
            + self.ledger.heap()
            + self.workspace_id.heap()
            + self.key.heap()
            + self.what.heap()
            + self.why.heap()
            + self.limit.heap()
            + self.cursor.heap()
            + self.change.heap()
    }
}
impl<'de> Deserialize<'de> for Request {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Union;
        impl<'de> Visitor<'de> for Union {
            type Value = Request;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("closed v4 request")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Request, M::Error> {
                let mut v: Option<Owned<u64>> = None;
                let mut op: Option<Owned<String>> = None;
                let mut ledger: Option<Owned<String>> = None;
                let mut workspace_id: Option<Owned<String>> = None;
                let mut key: Option<Owned<String>> = None;
                let mut what: Option<Owned<String>> = None;
                let mut why: Option<Owned<Option<String>>> = None;
                let mut limit: Option<Owned<u64>> = None;
                let mut cursor: Option<Owned<Option<Cursor>>> = None;
                let mut change: Option<Owned<String>> = None;
                let _mask = work::Fixed::new(std::mem::size_of::<u16>());
                let mut mask = 0u16;
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
                            "limit",
                            "cursor",
                            "change",
                        ],
                    );
                    let bit = match k.as_str() {
                        "v" => 1,
                        "op" => 2,
                        "ledger" => 4,
                        "workspace_id" => 8,
                        "key" => 16,
                        "what" => 32,
                        "why" => 64,
                        "limit" => 128,
                        "cursor" => 256,
                        "change" => 512,
                        _ => {
                            work::complete(B::Fields, false);
                            return Err(de::Error::custom("unknown field"));
                        }
                    };
                    work::complete(B::Fields, true);
                    if !work::test(B::Fields, 0, 1, || mask & bit == 0) {
                        return Err(de::Error::custom("duplicate field"));
                    }
                    mask |= bit;
                    match bit {
                        1 => v = Some(Owned::new(m.next_value()?)),
                        2 => op = Some(Owned::new(m.next_value()?)),
                        4 => ledger = Some(Owned::new(m.next_value()?)),
                        8 => workspace_id = Some(Owned::new(m.next_value()?)),
                        16 => key = Some(Owned::new(m.next_value()?)),
                        32 => what = Some(Owned::new(m.next_value()?)),
                        64 => why = Some(Owned::new(m.next_value()?)),
                        128 => limit = Some(Owned::new(m.next_value()?)),
                        256 => cursor = Some(Owned::new(m.next_value()?)),
                        512 => change = Some(Owned::new(m.next_value()?)),
                        _ => unreachable!(),
                    }
                }
                let r = Owned::new(Request {
                    v: required(v, "v")?.into_inner(),
                    op: required(op, "op")?.into_inner(),
                    ledger: required(ledger, "ledger")?.into_inner(),
                    workspace_id: required(workspace_id, "workspace_id")?.into_inner(),
                    key: key.map(Owned::into_inner),
                    what: what.map(Owned::into_inner),
                    why: why.map(Owned::into_inner),
                    limit: limit.map(Owned::into_inner),
                    cursor: cursor.map(Owned::into_inner),
                    change: change.map(Owned::into_inner),
                });
                if !r.valid(|bytes, words, result| match result {
                    None => work::attempt(B::Fields, bytes, words),
                    Some(ok) => work::complete(B::Fields, ok),
                }) {
                    return Err(de::Error::custom("request shape"));
                }
                Ok(r.into_inner())
            }
        }
        d.deserialize_struct(
            "request",
            &[
                "v",
                "op",
                "ledger",
                "workspace_id",
                "key",
                "what",
                "why",
                "limit",
                "cursor",
                "change",
            ],
            Union,
        )
    }
}
impl Serialize for Request {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct("request", 10)?;
        o.serialize_field("v", &self.v)?;
        o.serialize_field("op", &self.op)?;
        o.serialize_field("ledger", &self.ledger)?;
        o.serialize_field("workspace_id", &self.workspace_id)?;
        if let Some(v) = &self.key {
            o.serialize_field("key", v)?;
        }
        if let Some(v) = &self.what {
            o.serialize_field("what", v)?;
        }
        if let Some(v) = &self.why {
            o.serialize_field("why", v)?;
        }
        if let Some(v) = &self.limit {
            o.serialize_field("limit", v)?;
        }
        if let Some(v) = &self.cursor {
            o.serialize_field("cursor", v)?;
        }
        if let Some(v) = &self.change {
            o.serialize_field("change", v)?;
        }
        o.end()
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Incident {
    pub format: String,
    pub custody: String,
    pub state: String,
    pub phase: Option<String>,
    pub issue: Option<String>,
}
impl Heap for Incident {
    fn logical(&self) -> usize {
        self.format.logical()
            + self.custody.logical()
            + self.state.logical()
            + self.phase.logical()
            + self.issue.logical()
    }
    fn heap(&self) -> usize {
        self.format.heap()
            + self.custody.heap()
            + self.state.heap()
            + self.phase.heap()
            + self.issue.heap()
    }
}
impl<'de> Deserialize<'de> for Incident {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Fixed;
        impl<'de> Visitor<'de> for Fixed {
            type Value = Incident;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("incident")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Incident, M::Error> {
                let (mut format, mut custody, mut state, mut phase, mut issue) =
                    (None, None, None, None, None);
                while let Some(k) = m.next_key::<String>()? {
                    let k = Owned::new(k);
                    field_key(&k, &["format", "custody", "state", "phase", "issue"]);
                    let slot = match k.as_str() {
                        "format" => &mut format,
                        "custody" => &mut custody,
                        "state" => &mut state,
                        "phase" => &mut phase,
                        "issue" => &mut issue,
                        _ => {
                            work::complete(B::Fields, false);
                            return Err(de::Error::custom("unknown field"));
                        }
                    };
                    work::complete(B::Fields, true);
                    if !work::test(B::Fields, 0, 1, || slot.is_none()) {
                        return Err(de::Error::custom("duplicate field"));
                    }
                    *slot = Some(Owned::new(m.next_value::<String>()?));
                }
                let state = required(state, "state")?;
                if !work::test(B::Fields, 0, 1, || state.len() <= 7)
                    || !work::test(B::Fields, state.len().max("blocked".len()), 5, || {
                        matches!(
                            (state.as_str(), phase.is_some(), issue.is_some()),
                            ("clear", false, false) | ("blocked", true, true)
                        )
                    })
                {
                    return Err(de::Error::custom("incident shape"));
                }
                Ok(Incident {
                    format: required(format, "format")?.into_inner(),
                    custody: required(custody, "custody")?.into_inner(),
                    state: state.into_inner(),
                    phase: phase.map(Owned::into_inner),
                    issue: issue.map(Owned::into_inner),
                })
            }
        }
        d.deserialize_struct(
            "incident",
            &["format", "custody", "state", "phase", "issue"],
            Fixed,
        )
    }
}
impl Serialize for Incident {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct("incident", 5)?;
        o.serialize_field("format", &self.format)?;
        o.serialize_field("custody", &self.custody)?;
        o.serialize_field("state", &self.state)?;
        if let Some(v) = &self.phase {
            o.serialize_field("phase", v)?;
        }
        if let Some(v) = &self.issue {
            o.serialize_field("issue", v)?;
        }
        o.end()
    }
}
pub(super) fn decode<T: for<'de> Deserialize<'de> + Heap>(
    bytes: &[u8],
    b: B,
) -> Result<Owned<T>, ()> {
    work::attempt(b, bytes.len(), 32);
    work::attempt(B::Constructions, bytes.len(), 1);
    if bytes.len() > C {
        return Err(());
    }
    let _parser_header = work::Fixed::new(std::mem::size_of::<super::parser::Parser<'_>>());
    let mut d = super::parser::Parser::new(bytes);
    let v = Owned::new(T::deserialize(&mut d).map_err(|_| ())?);
    d.end().map_err(|_| ())?;
    work::complete(b, true);
    work::complete(B::Constructions, true);
    Ok(v)
}
pub(super) fn emit<T: Serialize + Heap>(v: &T, limit: usize) -> Result<Owned<Vec<u8>>, ()> {
    emit_mode(v, limit, false, B::ControlEmissions)
}
pub(super) fn emit_input(v: &Request) -> Result<Owned<Vec<u8>>, ()> {
    emit_mode(v, C, false, B::InputEmissions)
}
pub(super) fn emit_reply<T: Serialize + Heap>(v: &T, limit: usize) -> Result<Owned<Vec<u8>>, ()> {
    emit_mode(v, limit, false, B::ReplyEmissions)
}
fn emit_mode<T: Serialize + Heap>(
    v: &T,
    limit: usize,
    trace: bool,
    category: B,
) -> Result<Owned<Vec<u8>>, ()> {
    work::attempt(B::Emissions, 0, 1);
    work::attempt(category, v.logical(), 32);
    let allocation = work::Allocation::new(trace);
    let bytes = crate::adapters::jsonl::opening::codec::emit_observed(
        v,
        limit,
        Some(&|cap| allocation.resize(cap)),
    )?;
    work::complete(B::Emissions, true);
    work::complete(category, true);
    Ok(allocation.adopt(bytes))
}
pub(super) fn retained<T: for<'de> Deserialize<'de> + Serialize + Heap>(
    bytes: &[u8],
    b: B,
) -> Result<Owned<T>, ()> {
    let value = decode(bytes, b)?;
    let emitted = emit(&*value, C)?;
    if !work::test(B::Canonical, bytes.len().max(emitted.len()), 1, || {
        *emitted == bytes
    }) {
        return Err(());
    }
    Ok(value)
}

// Decode temporary entries sequentially against installed entries. Never own a
// second accepted-association vector. The possible final successor is one value.
pub(super) struct Temporary {
    pub generation: u64,
    pub pending: Option<Reservation>,
    pub last: Option<Association>,
}
impl Heap for Temporary {
    fn logical(&self) -> usize {
        self.pending.logical() + self.last.logical()
    }
    fn heap(&self) -> usize {
        self.pending.heap() + self.last.heap()
    }
}
pub(super) fn temporary(bytes: &[u8], installed: &Creations) -> Result<Owned<Temporary>, ()> {
    use serde_core::de::DeserializeSeed;
    struct Entries<'a>(&'a [Association]);
    impl<'de> DeserializeSeed<'de> for Entries<'_> {
        type Value = Option<Owned<Association>>;
        fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<Self::Value, D::Error> {
            d.deserialize_seq(self)
        }
    }
    impl<'de> Visitor<'de> for Entries<'_> {
        type Value = Option<Owned<Association>>;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("unchanged accepted entries and at most one successor")
        }
        fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<Self::Value, A::Error> {
            for expected in self.0 {
                let entry = Owned::new(required(a.next_element::<Association>()?, "entry")?);
                if !work::test(
                    B::Relationships,
                    entry.logical().max(expected.logical()),
                    32,
                    || *entry == *expected,
                ) {
                    return Err(de::Error::custom("changed entry"));
                }
            }
            struct Extra;
            impl<'de> Deserialize<'de> for Extra {
                fn deserialize<D: Deserializer<'de>>(_: D) -> Result<Self, D::Error> {
                    work::test(B::Fields, 0, 1, || false);
                    Err(de::Error::custom("extra entry"))
                }
            }
            let last = if self.0.len() == 16 {
                if a.next_element::<Extra>()?.is_some() {
                    return Err(de::Error::custom("extra entry"));
                }
                None
            } else {
                a.next_element::<Association>()?.map(Owned::new)
            };
            if last.is_some() && a.next_element::<Extra>()?.is_some() {
                return Err(de::Error::custom("extra entry"));
            }
            Ok(last)
        }
    }
    struct Control<'a>(&'a Creations);
    impl<'de> DeserializeSeed<'de> for Control<'_> {
        type Value = Temporary;
        fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<Self::Value, D::Error> {
            d.deserialize_struct(
                "creations",
                &[
                    "format",
                    "custody",
                    "ledger",
                    "generation",
                    "entries",
                    "pending",
                ],
                self,
            )
        }
    }
    impl<'de> Visitor<'de> for Control<'_> {
        type Value = Temporary;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("creation temporary")
        }
        fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Self::Value, M::Error> {
            let (mut format, mut custody, mut ledger, mut generation, mut entries, mut pending) =
                (None, None, None, None, None, None);
            let mut mask = 0u8;
            while let Some(k) = m.next_key::<String>()? {
                let k = Owned::new(k);
                field_key(
                    &k,
                    &[
                        "format",
                        "custody",
                        "ledger",
                        "generation",
                        "entries",
                        "pending",
                    ],
                );
                let bit = match k.as_str() {
                    "format" => 1,
                    "custody" => 2,
                    "ledger" => 4,
                    "generation" => 8,
                    "entries" => 16,
                    "pending" => 32,
                    _ => {
                        work::complete(B::Fields, false);
                        return Err(de::Error::custom("unknown field"));
                    }
                };
                work::complete(B::Fields, true);
                if !work::test(B::Fields, 0, 1, || mask & bit == 0) {
                    return Err(de::Error::custom("duplicate field"));
                }
                mask |= bit;
                match bit {
                    1 => format = Some(Owned::new(m.next_value::<String>()?)),
                    2 => custody = Some(Owned::new(m.next_value::<String>()?)),
                    4 => ledger = Some(Owned::new(m.next_value::<String>()?)),
                    8 => generation = Some(Owned::new(m.next_value::<u64>()?)),
                    16 => entries = Some(m.next_value_seed(Entries(&self.0.entries.0))?),
                    32 => pending = Some(Owned::new(m.next_value::<Option<Reservation>>()?)),
                    _ => unreachable!(),
                }
            }
            if !work::test(B::Fields, 0, 6, || mask == 63) {
                return Err(de::Error::custom("control association"));
            }
            if !work::test(
                B::Relationships,
                (format.logical() + custody.logical() + ledger.logical())
                    .max(self.0.format.len() + self.0.custody.len() + self.0.ledger.len()),
                6,
                || {
                    format.as_deref() == Some(&self.0.format)
                        && custody.as_deref() == Some(&self.0.custody)
                        && ledger.as_deref() == Some(&self.0.ledger)
                },
            ) {
                return Err(de::Error::custom("control association"));
            }
            Ok(Temporary {
                generation: generation.unwrap().into_inner(),
                pending: pending.unwrap().into_inner(),
                last: entries.unwrap().map(Owned::into_inner),
            })
        }
    }
    work::attempt(B::Controls, bytes.len(), 32);
    work::attempt(B::Constructions, bytes.len(), 1);
    if bytes.len() > C {
        return Err(());
    }
    let _parser_header = work::Fixed::new(std::mem::size_of::<super::parser::Parser<'_>>());
    let mut d = super::parser::Parser::new(bytes);
    let candidate = Owned::new(Control(installed).deserialize(&mut d).map_err(|_| ())?);
    d.end().map_err(|_| ())?;
    work::complete(B::Controls, true);
    work::complete(B::Constructions, true);
    struct Ref<'a> {
        installed: &'a Creations,
        temp: &'a Temporary,
    }
    impl Heap for Ref<'_> {
        fn heap(&self) -> usize {
            0
        }
        fn logical(&self) -> usize {
            self.installed.format.len()
                + self.installed.custody.len()
                + self.installed.ledger.len()
                + self.installed.entries.logical()
                + self.temp.last.logical()
                + self.temp.pending.logical()
        }
    }
    impl Serialize for Ref<'_> {
        fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
            struct Entries<'a>(&'a [Association], Option<&'a Association>);
            impl Serialize for Entries<'_> {
                fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                    use serde_core::ser::SerializeSeq;
                    let mut o =
                        s.serialize_seq(Some(self.0.len() + usize::from(self.1.is_some())))?;
                    for e in self.0 {
                        o.serialize_element(e)?;
                    }
                    if let Some(e) = self.1 {
                        o.serialize_element(e)?;
                    }
                    o.end()
                }
            }
            let mut o = s.serialize_struct("creations", 6)?;
            o.serialize_field("format", &self.installed.format)?;
            o.serialize_field("custody", &self.installed.custody)?;
            o.serialize_field("ledger", &self.installed.ledger)?;
            o.serialize_field("generation", &self.temp.generation)?;
            o.serialize_field(
                "entries",
                &Entries(&self.installed.entries.0, self.temp.last.as_ref()),
            )?;
            o.serialize_field("pending", &self.temp.pending)?;
            o.end()
        }
    }
    let canonical = emit(
        &Ref {
            installed,
            temp: &candidate,
        },
        C,
    )?;
    if !work::test(B::Canonical, bytes.len().max(canonical.len()), 1, || {
        *canonical == bytes
    }) {
        return Err(());
    }
    Ok(candidate)
}

pub(super) struct PageRef<'a> {
    pub ledger: &'a str,
    pub workspace: &'a str,
    pub entries: &'a [Metadata],
    pub after: Option<&'a str>,
    pub limit: u64,
}
impl Heap for PageRef<'_> {
    fn heap(&self) -> usize {
        0
    }
    fn logical(&self) -> usize {
        self.ledger.len()
            + self.workspace.len()
            + "changes".len()
            + self.entries.iter().map(Heap::logical).sum::<usize>()
            + self.after.map_or(0, |after| {
                self.ledger.len() + self.workspace.len() + after.len()
            })
            + "ck-ledger-page@1".len()
            + "currently_permitted_after_cursor".len()
    }
}
impl Serialize for PageRef<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        struct CursorRef<'a>(&'a PageRef<'a>);
        impl Serialize for CursorRef<'_> {
            fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                let p = self.0;
                let mut o = s.serialize_struct("cursor", 5)?;
                o.serialize_field("v", &4)?;
                o.serialize_field("ledger", p.ledger)?;
                o.serialize_field("workspace_id", p.workspace)?;
                o.serialize_field("after", &p.after)?;
                o.serialize_field("limit", &p.limit)?;
                o.end()
            }
        }
        let mut o = s.serialize_struct("page", 7)?;
        o.serialize_field("v", &4)?;
        o.serialize_field("kind", "changes")?;
        o.serialize_field("ledger", self.ledger)?;
        o.serialize_field("workspace_id", self.workspace)?;
        o.serialize_field("members", self.entries)?;
        if self.after.is_some() {
            o.serialize_field("next", &CursorRef(self))?;
        } else {
            o.serialize_field("next", &Option::<u8>::None)?;
        }
        struct CoverageRef;
        impl Serialize for CoverageRef {
            fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                let mut o = s.serialize_struct("coverage", 3)?;
                o.serialize_field("interpretation", "ck-ledger-page@1")?;
                o.serialize_field("scope", "currently_permitted_after_cursor")?;
                o.serialize_field("complete", &true)?;
                o.end()
            }
        }
        o.serialize_field("coverage", &CoverageRef)?;
        o.end()
    }
}

pub(super) fn emit_origin(v: &Origin) -> Result<Owned<Vec<u8>>, ()> {
    emit_mode(v, C, true, B::CandidateEmissions)
}
pub(super) struct CanonicalInput<'a>(&'a [u8]);
impl CanonicalInput<'_> {
    pub fn digest(&self) -> String {
        super::hash_input(self.0)
    }
}
pub(super) fn retained_origin(bytes: &[u8]) -> Result<(Owned<Origin>, CanonicalInput<'_>), ()> {
    let record = decode(bytes, B::Origins)?;
    let emitted = emit_mode(&*record, C, true, B::OriginEmissions)?;
    if !work::test(B::Canonical, bytes.len().max(emitted.len()), 1, || {
        *emitted == bytes
    }) {
        return Err(());
    }
    // Only after whole-record typed re-emission matched do these bytes witness
    // canonical Request serialization. Borrow that existing input object;
    // hashing appends its canonical terminal LF, without another emission.
    let marker = b"\"input\":";
    let start = bytes
        .windows(marker.len())
        .position(|w| w == marker)
        .ok_or(())?
        + marker.len();
    if bytes.get(start) != Some(&b'{') {
        return Err(());
    }
    let mut depth = 0usize;
    let mut quoted = false;
    let mut escaped = false;
    let mut end = None;
    for (i, &byte) in bytes[start..].iter().enumerate() {
        if quoted {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == b'"' {
                quoted = false;
            }
            continue;
        }
        match byte {
            b'"' => quoted = true,
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    end = Some(start + i + 1);
                    break;
                }
            }
            _ => {}
        }
    }
    let end = end.ok_or(())?;
    Ok((record, CanonicalInput(&bytes[start..end])))
}

impl Heap for Anchor {
    fn heap(&self) -> usize {
        self.format.heap()
            + self.ledger.heap()
            + self.custody.heap()
            + self.workspace_id.heap()
            + self.binding.heap()
            + self.owner.heap()
            + self.directory.heap()
            + self.directory_device.heap()
            + self.directory_inode.heap()
            + self.lock_device.heap()
            + self.lock_inode.heap()
            + self.members_device.heap()
            + self.members_inode.heap()
            + self.stage.heap()
    }
    fn logical(&self) -> usize {
        self.format.logical()
            + self.ledger.logical()
            + self.custody.logical()
            + self.workspace_id.logical()
            + self.binding.logical()
            + self.owner.logical()
            + self.directory.logical()
            + self.directory_device.logical()
            + self.directory_inode.logical()
            + self.lock_device.logical()
            + self.lock_inode.logical()
            + self.members_device.logical()
            + self.members_inode.logical()
            + self.stage.logical()
    }
}

// The independent grant is the sole 16-pair owning vector. Anchor grants are
// compared sequentially at decode, then canonical re-emission borrows that grant.
pub(super) struct AnchorWire<'a>(pub &'a Anchor, pub &'a [LedgerPair; 16]);
impl Heap for AnchorWire<'_> {
    fn heap(&self) -> usize {
        0
    }
    fn logical(&self) -> usize {
        self.0.logical() + self.1.logical()
    }
}
impl Serialize for AnchorWire<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct("anchor", 15)?;
        o.serialize_field("format", &self.0.format)?;
        o.serialize_field("ledger", &self.0.ledger)?;
        o.serialize_field("custody", &self.0.custody)?;
        o.serialize_field("workspace_id", &self.0.workspace_id)?;
        o.serialize_field("binding", &self.0.binding)?;
        o.serialize_field("owner", &self.0.owner)?;
        o.serialize_field("directory", &self.0.directory)?;
        o.serialize_field("directory_device", &self.0.directory_device)?;
        o.serialize_field("directory_inode", &self.0.directory_inode)?;
        o.serialize_field("lock_device", &self.0.lock_device)?;
        o.serialize_field("lock_inode", &self.0.lock_inode)?;
        o.serialize_field("members_device", &self.0.members_device)?;
        o.serialize_field("members_inode", &self.0.members_inode)?;
        o.serialize_field("grants", self.1)?;
        o.serialize_field("stage", &self.0.stage)?;
        o.end()
    }
}
pub(super) fn anchor(bytes: &[u8], grants: &[LedgerPair; 16]) -> Result<Owned<Anchor>, ()> {
    use serde_core::de::DeserializeSeed;
    struct Grants<'a>(&'a [LedgerPair; 16]);
    impl<'de> DeserializeSeed<'de> for Grants<'_> {
        type Value = ();
        fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
            d.deserialize_seq(self)
        }
    }
    impl<'de> Visitor<'de> for Grants<'_> {
        type Value = ();
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("exact independent grants")
        }
        fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<(), A::Error> {
            for expected in self.0 {
                let p = Owned::new(required(a.next_element::<LedgerPair>()?, "grant")?);
                if !work::test(
                    B::Relationships,
                    p.logical().max(expected.logical()),
                    2,
                    || *p == *expected,
                ) {
                    return Err(de::Error::custom("grant mismatch"));
                }
            }
            struct Extra;
            impl<'de> Deserialize<'de> for Extra {
                fn deserialize<D: Deserializer<'de>>(_: D) -> Result<Self, D::Error> {
                    work::test(B::Fields, 0, 1, || false);
                    Err(de::Error::custom("seventeenth grant"))
                }
            }
            if a.next_element::<Extra>()?.is_some() {
                return Err(de::Error::custom("extra grant"));
            }
            Ok(())
        }
    }
    struct Header<'a>(&'a [LedgerPair; 16]);
    impl<'de> DeserializeSeed<'de> for Header<'_> {
        type Value = Anchor;
        fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<Anchor, D::Error> {
            d.deserialize_map(self)
        }
    }
    impl<'de> Visitor<'de> for Header<'_> {
        type Value = Anchor;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("ledger anchor")
        }
        fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Anchor, M::Error> {
            let mut format: Option<Owned<String>> = None;
            let mut ledger: Option<Owned<String>> = None;
            let mut custody: Option<Owned<String>> = None;
            let mut workspace_id: Option<Owned<String>> = None;
            let mut binding: Option<Owned<String>> = None;
            let mut owner: Option<Owned<String>> = None;
            let mut directory: Option<Owned<String>> = None;
            let mut directory_device: Option<Owned<u64>> = None;
            let mut directory_inode: Option<Owned<u64>> = None;
            let mut lock_device: Option<Owned<u64>> = None;
            let mut lock_inode: Option<Owned<u64>> = None;
            let mut members_device: Option<Owned<u64>> = None;
            let mut members_inode: Option<Owned<u64>> = None;
            let mut stage: Option<Owned<String>> = None;
            let mut mask = 0u16;
            while let Some(k) = m.next_key::<String>()? {
                let k = Owned::new(k);
                field_key(
                    &k,
                    &[
                        "format",
                        "ledger",
                        "custody",
                        "workspace_id",
                        "binding",
                        "owner",
                        "directory",
                        "directory_device",
                        "directory_inode",
                        "lock_device",
                        "lock_inode",
                        "members_device",
                        "members_inode",
                        "stage",
                        "grants",
                    ],
                );
                let bit = match k.as_str() {
                    "format" => 1,
                    "ledger" => 2,
                    "custody" => 4,
                    "workspace_id" => 8,
                    "binding" => 16,
                    "owner" => 32,
                    "directory" => 64,
                    "directory_device" => 128,
                    "directory_inode" => 256,
                    "lock_device" => 512,
                    "lock_inode" => 1024,
                    "members_device" => 2048,
                    "members_inode" => 4096,
                    "stage" => 8192,
                    "grants" => 16384,
                    _ => {
                        work::complete(B::Fields, false);
                        return Err(de::Error::custom("unknown field"));
                    }
                };
                work::complete(B::Fields, true);
                if !work::test(B::Fields, 0, 1, || mask & bit == 0) {
                    return Err(de::Error::custom("duplicate field"));
                }
                mask |= bit;
                match bit {
                    1 => format = Some(Owned::new(m.next_value()?)),
                    2 => ledger = Some(Owned::new(m.next_value()?)),
                    4 => custody = Some(Owned::new(m.next_value()?)),
                    8 => workspace_id = Some(Owned::new(m.next_value()?)),
                    16 => binding = Some(Owned::new(m.next_value()?)),
                    32 => owner = Some(Owned::new(m.next_value()?)),
                    64 => directory = Some(Owned::new(m.next_value()?)),
                    128 => directory_device = Some(Owned::new(m.next_value()?)),
                    256 => directory_inode = Some(Owned::new(m.next_value()?)),
                    512 => lock_device = Some(Owned::new(m.next_value()?)),
                    1024 => lock_inode = Some(Owned::new(m.next_value()?)),
                    2048 => members_device = Some(Owned::new(m.next_value()?)),
                    4096 => members_inode = Some(Owned::new(m.next_value()?)),
                    8192 => stage = Some(Owned::new(m.next_value()?)),
                    16384 => {
                        m.next_value_seed(Grants(self.0))?;
                    }
                    _ => unreachable!(),
                }
            }
            if !work::test(B::Fields, 0, 1, || mask == 32767) {
                return Err(de::Error::custom("missing field"));
            }
            Ok(Anchor {
                format: format.unwrap().into_inner(),
                ledger: ledger.unwrap().into_inner(),
                custody: custody.unwrap().into_inner(),
                workspace_id: workspace_id.unwrap().into_inner(),
                binding: binding.unwrap().into_inner(),
                owner: owner.unwrap().into_inner(),
                directory: directory.unwrap().into_inner(),
                directory_device: directory_device.unwrap().into_inner(),
                directory_inode: directory_inode.unwrap().into_inner(),
                lock_device: lock_device.unwrap().into_inner(),
                lock_inode: lock_inode.unwrap().into_inner(),
                members_device: members_device.unwrap().into_inner(),
                members_inode: members_inode.unwrap().into_inner(),
                stage: stage.unwrap().into_inner(),
            })
        }
    }
    work::attempt(B::Controls, bytes.len(), 32);
    work::attempt(B::Constructions, bytes.len(), 1);
    if bytes.len() > C {
        return Err(());
    }
    let _parser_header = work::Fixed::new(std::mem::size_of::<super::parser::Parser<'_>>());
    let mut d = super::parser::Parser::new(bytes);
    let v = Owned::new(Header(grants).deserialize(&mut d).map_err(|_| ())?);
    d.end().map_err(|_| ())?;
    work::complete(B::Controls, true);
    work::complete(B::Constructions, true);
    let emitted = emit(&AnchorWire(&v, grants), C)?;
    if !work::test(B::Canonical, bytes.len().max(emitted.len()), 1, || {
        *emitted == bytes
    }) {
        return Err(());
    }
    Ok(v)
}
