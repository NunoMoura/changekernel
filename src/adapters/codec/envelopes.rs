use super::*;
closed!(WireConnect {
    bridge: String,
    id: u64,
    kind: String,
    mode: String,
    grant: Grant,
    authorization: Lease
});
closed!(Call {
    bridge: String,
    id: u64,
    kind: String,
    authorization: Lease,
    request: Request
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Confirmed;
impl Serialize for Confirmed {
    fn serialize<S: Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_bool(true)
    }
}
impl<'de> Deserialize<'de> for Confirmed {
    fn deserialize<D: Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
        struct True;
        impl<'de> Visitor<'de> for True {
            type Value = Confirmed;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("literal true")
            }
            fn visit_bool<E: de::Error>(self, b: bool) -> std::result::Result<Confirmed, E> {
                if b {
                    Ok(Confirmed)
                } else {
                    Err(E::custom("literal true required"))
                }
            }
        }
        d.deserialize_bool(True)
    }
}
closed!(Confirm {
    bridge: String,
    id: u64,
    kind: String,
    authorization: Lease,
    input: Request,
    confirmed: Confirmed
});
closed!(Control {
    bridge: String,
    id: u64,
    kind: String
});
closed!(Connected {
    bridge: String,
    id: u64,
    kind: String,
    version: String
});
closed!(Closed {
    bridge: String,
    id: u64,
    kind: String
});
closed!(Prepared {
    bridge: String,
    id: u64,
    kind: String,
    input: Request,
    presentation: String
});
closed!(Accepted {
    version: String,
    kind: String,
    result: Outcome
});
closed!(Operation { version:String,kind:String,key:String,status:String,result:Option<Outcome>,tip:Option<Fact>,readiness:Vec<String> });
closed!(ErrorReply {
    version: String,
    kind: String,
    code: String,
    acceptance: String
});
closed!(Retained {
    version: String,
    kind: String,
    material: Material
});
closed!(Resolved {
    version: String,
    kind: String,
    material: Material,
    text: String
});
closed!(WireContextCoverage { first:u64,last:u64,through:Option<Fact> });
closed!(WireHistoryCoverage {
    first: u64,
    last: u64
});
closed!(ContextReply { version:String,kind:String,tip:Option<Fact>,at:Option<Fact>,intent:Option<Intent>,approval:Option<Material>,policy:Material,coverage:WireContextCoverage,readiness:Vec<String> });
closed!(HistoryReply { version:String,kind:String,tip:Option<Fact>,through:Option<Fact>,records:Vec<Record>,coverage:WireHistoryCoverage,next_after:Option<u64>,readiness:Vec<String> });
closed!(Discarded {
    version: String,
    kind: String
});
struct Reply<'a, T> {
    id: u64,
    value: &'a T,
}
impl<T: Serialize> Serialize for Reply<'_, T> {
    fn serialize<S: Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct("reply", 4)?;
        o.serialize_field("bridge", "ck-intent-bridge")?;
        o.serialize_field("id", &self.id)?;
        o.serialize_field("kind", "reply")?;
        o.serialize_field("value", self.value)?;
        o.end()
    }
}
pub(super) fn reply<T: Serialize>(id: u64, value: &T) -> Result<Vec<u8>> {
    emit(&Reply { id, value })
}
pub(crate) fn failure(id: u64, e: Error) -> Vec<u8> {
    reply(
        id,
        &ErrorReply {
            version: V.into(),
            kind: "error".into(),
            code: e.code().into(),
            acceptance: "not_established".into(),
        },
    )
    .expect("fixed bounded error")
}

pub(crate) struct Header {
    pub id: u64,
    pub kind: String,
}
impl<'de> Deserialize<'de> for Header {
    fn deserialize<D: Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
        struct H;
        impl<'de> Visitor<'de> for H {
            type Value = Header;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("bridge header")
            }
            fn visit_map<M: MapAccess<'de>>(
                self,
                mut m: M,
            ) -> std::result::Result<Header, M::Error> {
                let (mut id, mut kind, mut bridge) = (None, None, None);
                while let Some(k) = m.next_key::<String>()? {
                    match k.as_str() {
                        "id" => {
                            if id.is_some() {
                                return Err(de::Error::custom("duplicate id"));
                            }
                            id = Some(m.next_value::<u64>()?);
                        }
                        "kind" => {
                            if kind.is_some() {
                                return Err(de::Error::custom("duplicate kind"));
                            }
                            kind = Some(m.next_value::<String>()?);
                        }
                        "bridge" => {
                            if bridge.is_some() {
                                return Err(de::Error::custom("duplicate bridge"));
                            }
                            bridge = Some(m.next_value::<String>()?);
                        }
                        _ => {
                            m.next_value::<de::IgnoredAny>()?;
                        }
                    }
                }
                if bridge.as_deref() != Some("ck-intent-bridge") {
                    return Err(de::Error::custom("bridge"));
                }
                Ok(Header {
                    id: id.ok_or_else(|| de::Error::missing_field("id"))?,
                    kind: kind.ok_or_else(|| de::Error::missing_field("kind"))?,
                })
            }
        }
        d.deserialize_map(H)
    }
}
pub(crate) enum Envelope {
    Connect(WireConnect),
    Call(Call),
    Confirm(Confirm),
    Control(Control),
}

impl Envelope {
    pub fn command(self) -> Command {
        match self {
            Self::Connect(c) => Command::Connect {
                mode: c.mode,
                grant: c.grant,
                authorization: c.authorization,
            },
            Self::Call(c) => Command::Call {
                prepare: c.kind == "prepare",
                authorization: c.authorization,
                request: c.request,
            },
            Self::Confirm(c) => Command::Confirm {
                authorization: c.authorization,
                input: c.input,
            },
            Self::Control(c) if c.kind == "close" => Command::Close,
            Self::Control(_) => Command::Discard,
        }
    }
}
pub(crate) fn decode(kind: &str, bytes: &[u8]) -> Result<Envelope> {
    match kind {
        "connect" => parse::<WireConnect>(bytes).map(Envelope::Connect),
        "call" | "prepare" => parse::<Call>(bytes).map(Envelope::Call),
        "confirm" => parse::<Confirm>(bytes).map(Envelope::Confirm),
        "discard" | "close" => parse::<Control>(bytes).map(Envelope::Control),
        _ => Err(Error::Invalid),
    }
}

impl Encoding for LegacyCodec {
    fn response(&self, id: u64, response: &Response) -> Result<Vec<u8>> {
        match response {
            Response::Connected => emit(&Connected {
                bridge: "ck-intent-bridge".into(),
                id,
                kind: "connected".into(),
                version: V.into(),
            }),
            Response::Closed => emit(&Closed {
                bridge: "ck-intent-bridge".into(),
                id,
                kind: "closed".into(),
            }),
            Response::Discarded => reply(
                id,
                &Discarded {
                    version: V.into(),
                    kind: "discarded".into(),
                },
            ),
            Response::Prepared {
                input,
                presentation,
            } => emit(&Prepared {
                bridge: "ck-intent-bridge".into(),
                id,
                kind: "prepared".into(),
                input: input.clone(),
                presentation: presentation.clone(),
            }),
            Response::Accepted(result) => reply(
                id,
                &Accepted {
                    version: V.into(),
                    kind: "accepted".into(),
                    result: result.clone(),
                },
            ),
            Response::Operation {
                key,
                status,
                result,
                tip,
                readiness,
            } => reply(
                id,
                &Operation {
                    version: V.into(),
                    kind: "operation".into(),
                    key: key.clone(),
                    status: status.clone(),
                    result: result.clone(),
                    tip: tip.clone(),
                    readiness: readiness.clone(),
                },
            ),
            Response::Retained(material) => reply(
                id,
                &Retained {
                    version: V.into(),
                    kind: "retained".into(),
                    material: material.clone(),
                },
            ),
            Response::Resolved { material, text } => reply(
                id,
                &Resolved {
                    version: V.into(),
                    kind: "resolved".into(),
                    material: material.clone(),
                    text: text.clone(),
                },
            ),
            Response::Context(c) => reply(
                id,
                &ContextReply {
                    version: V.into(),
                    kind: "context".into(),
                    tip: c.tip.clone(),
                    at: c.at.clone(),
                    intent: c.intent.clone(),
                    approval: c.approval.clone(),
                    policy: c.policy.clone(),
                    coverage: WireContextCoverage {
                        first: c.coverage.first,
                        last: c.coverage.last,
                        through: c.coverage.through.clone(),
                    },
                    readiness: c.readiness.clone(),
                },
            ),
            Response::History(h) => reply(
                id,
                &HistoryReply {
                    version: V.into(),
                    kind: "history".into(),
                    tip: h.tip.clone(),
                    through: h.through.clone(),
                    records: h.records.clone(),
                    coverage: WireHistoryCoverage {
                        first: h.coverage.first,
                        last: h.coverage.last,
                    },
                    next_after: h.next_after,
                    readiness: h.readiness.clone(),
                },
            ),
        }
    }
    fn review(&self, review: &Review) -> Result<String> {
        String::from_utf8(emit(review)?).map_err(|_| Error::Unavailable)
    }
    fn approval(&self, text: &str) -> Result<Receipt> {
        canonical(text.as_bytes())
    }
    fn receipt(&self, receipt: &Receipt) -> Result<String> {
        String::from_utf8(emit(receipt)?).map_err(|_| Error::Unavailable)
    }
    fn subject(&self, request: &Request) -> Result<String> {
        Ok(hash(&emit(request)?))
    }
}
