use super::*;
// First pass selects version before typed dependent decoding, independent of field order.
pub(crate) struct VersionScan;
impl<'de> Deserialize<'de> for VersionScan {
    fn deserialize<D: Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
        struct Scan;
        impl<'de> Visitor<'de> for Scan {
            type Value = VersionScan;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("bounded versioned JSON")
            }
            fn visit_map<M: MapAccess<'de>>(
                self,
                mut m: M,
            ) -> std::result::Result<VersionScan, M::Error> {
                while let Some(k) = m.next_key::<String>()? {
                    if k == "version" {
                        if m.next_value::<String>()? != V {
                            return Err(de::Error::custom("unsupported version"));
                        }
                    } else {
                        m.next_value::<VersionScan>()?;
                    }
                }
                Ok(VersionScan)
            }
            fn visit_seq<A: de::SeqAccess<'de>>(
                self,
                mut a: A,
            ) -> std::result::Result<VersionScan, A::Error> {
                while a.next_element::<VersionScan>()?.is_some() {}
                Ok(VersionScan)
            }
            fn visit_str<E: de::Error>(self, _: &str) -> std::result::Result<VersionScan, E> {
                Ok(VersionScan)
            }
            fn visit_bool<E: de::Error>(self, _: bool) -> std::result::Result<VersionScan, E> {
                Ok(VersionScan)
            }
            fn visit_u64<E: de::Error>(self, _: u64) -> std::result::Result<VersionScan, E> {
                Ok(VersionScan)
            }
            fn visit_i64<E: de::Error>(self, _: i64) -> std::result::Result<VersionScan, E> {
                Ok(VersionScan)
            }
            fn visit_f64<E: de::Error>(self, _: f64) -> std::result::Result<VersionScan, E> {
                Ok(VersionScan)
            }
            fn visit_unit<E: de::Error>(self) -> std::result::Result<VersionScan, E> {
                Ok(VersionScan)
            }
        }
        d.deserialize_any(Scan)
    }
}
