//! Map-only Serde entry for the finite set of named request DTOs.
//!
//! `remote = "Self"` keeps Serde's derived field handling as inherent methods.
//! The trait entry below admits only a map, then hands its live access to that
//! derive. No JSON tree, second parse, field copying or custom parser is involved.
//! A macro is needed only to connect each concrete DTO's inherent derive methods
//! to its Serde traits; it defines no fields or alternate schema.

macro_rules! impl_object_record {
    ($record:ident) => {
        impl serde::Serialize for $record {
            fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
            where
                S: serde::Serializer,
            {
                // This is the inherent remote derive, not this trait method.
                $record::serialize(self, serializer)
            }
        }

        impl<'de> serde::Deserialize<'de> for $record {
            fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct ObjectVisitor;

                impl<'de> serde::de::Visitor<'de> for ObjectVisitor {
                    type Value = $record;

                    fn expecting(
                        &self,
                        formatter: &mut std::fmt::Formatter<'_>,
                    ) -> std::fmt::Result {
                        formatter.write_str("a JSON object")
                    }

                    fn visit_map<A>(self, map: A) -> Result<Self::Value, A::Error>
                    where
                        A: serde::de::MapAccess<'de>,
                    {
                        // MapAccessDeserializer enters only the derived visit_map:
                        // duplicate/unknown/missing-field checks remain in Serde.
                        $record::deserialize(serde::de::value::MapAccessDeserializer::new(map))
                    }
                }

                deserializer.deserialize_map(ObjectVisitor)
            }
        }
    };
}

pub(super) use impl_object_record;
