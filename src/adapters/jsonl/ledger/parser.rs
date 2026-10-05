//! Closed JSON subset parser with explicit string ownership; no opaque serde scratch.
use super::work::{self, Owned};
use serde_core::de::{self, DeserializeSeed, MapAccess, SeqAccess, Visitor};
use std::fmt;
#[derive(Debug)]
pub(super) struct Error;
impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("closed JSON")
    }
}
impl std::error::Error for Error {}
impl de::Error for Error {
    fn custom<T: fmt::Display>(_: T) -> Self {
        Self
    }
}
pub(super) struct Parser<'a> {
    bytes: &'a [u8],
    pos: usize,
    depth: usize,
    key: bool,
}
impl<'a> Parser<'a> {
    pub fn new(bytes: &'a [u8]) -> Self {
        Self {
            bytes,
            pos: 0,
            depth: 0,
            key: false,
        }
    }
    fn ws(&mut self) {
        while self
            .bytes
            .get(self.pos)
            .is_some_and(|b| matches!(b, b' ' | b'\t' | b'\r' | b'\n'))
        {
            self.pos += 1;
        }
    }
    fn take(&mut self, b: u8) -> Result<(), Error> {
        self.ws();
        if self.bytes.get(self.pos) != Some(&b) {
            return Err(Error);
        }
        self.pos += 1;
        Ok(())
    }
    pub fn end(&mut self) -> Result<(), Error> {
        self.ws();
        if self.pos == self.bytes.len() {
            Ok(())
        } else {
            Err(Error)
        }
    }
    fn word(&mut self, w: &[u8]) -> Result<(), Error> {
        if !self.bytes[self.pos..].starts_with(w) {
            return Err(Error);
        }
        self.pos += w.len();
        Ok(())
    }
    fn string(&mut self) -> Result<Owned<String>, Error> {
        self.take(b'"')?;
        let start = self.pos;
        let mut end = start;
        // Token extent is needed for a bounded exact reserve, not for observation.
        loop {
            match self.bytes.get(end) {
                Some(b'"') => break,
                Some(b'\\') => {
                    end += 2;
                    if end > self.bytes.len() {
                        return Err(Error);
                    }
                }
                Some(_) => end += 1,
                None => return Err(Error),
            }
        }
        // All declared names are at most 16 ASCII bytes; even fully escaped
        // spellings fit 96 bytes. Refuse impossible names before allocating.
        if self.key && !work::test(work::Boundary::Fields, 0, 1, || end - start <= 96) {
            return Err(Error);
        }
        let mut out = Owned::new(String::with_capacity(end - start));
        while self.pos < end {
            if self.bytes[self.pos] == b'\\' {
                self.pos += 1;
                let b = self.bytes[self.pos];
                self.pos += 1;
                match b {
                    b'"' => out.push('"'),
                    b'\\' => out.push('\\'),
                    b'/' => out.push('/'),
                    b'b' => out.push('\x08'),
                    b'f' => out.push('\x0c'),
                    b'n' => out.push('\n'),
                    b'r' => out.push('\r'),
                    b't' => out.push('\t'),
                    b'u' => {
                        let mut n = self.hex4(end)? as u32;
                        if (0xd800..=0xdbff).contains(&n) {
                            if self.bytes.get(self.pos..self.pos + 2) != Some(b"\\u") {
                                return Err(Error);
                            }
                            self.pos += 2;
                            let low = self.hex4(end)? as u32;
                            if !(0xdc00..=0xdfff).contains(&low) {
                                return Err(Error);
                            }
                            n = 0x10000 + ((n - 0xd800) << 10) + low - 0xdc00;
                        }
                        out.push(char::from_u32(n).ok_or(Error)?);
                    }
                    _ => return Err(Error),
                }
            } else {
                let from = self.pos;
                while self.pos < end && self.bytes[self.pos] != b'\\' {
                    if self.bytes[self.pos] < 0x20 {
                        return Err(Error);
                    }
                    self.pos += 1;
                }
                out.push_str(std::str::from_utf8(&self.bytes[from..self.pos]).map_err(|_| Error)?);
            }
        }
        self.pos = end + 1;
        Ok(out)
    }
    fn hex4(&mut self, end: usize) -> Result<u16, Error> {
        if self.pos + 4 > end {
            return Err(Error);
        }
        let mut n = 0;
        for _ in 0..4 {
            let b = self.bytes[self.pos];
            self.pos += 1;
            let x = match b {
                b'0'..=b'9' => b - b'0',
                b'a'..=b'f' => b - b'a' + 10,
                b'A'..=b'F' => b - b'A' + 10,
                _ => return Err(Error),
            };
            n = (n << 4) | u16::from(x);
        }
        Ok(n)
    }
    fn number(&mut self) -> Result<u64, Error> {
        self.ws();
        let first = *self.bytes.get(self.pos).ok_or(Error)?;
        if !first.is_ascii_digit() {
            return Err(Error);
        }
        self.pos += 1;
        let mut n = u64::from(first - b'0');
        while let Some(b) = self.bytes.get(self.pos).filter(|b| b.is_ascii_digit()) {
            if first == b'0' {
                return Err(Error);
            }
            n = n
                .checked_mul(10)
                .and_then(|n| n.checked_add(u64::from(*b - b'0')))
                .ok_or(Error)?;
            self.pos += 1;
        }
        if self
            .bytes
            .get(self.pos)
            .is_some_and(|b| matches!(b, b'.' | b'e' | b'E' | b'+' | b'-'))
        {
            return Err(Error);
        }
        Ok(n)
    }
    fn container<'de, V: Visitor<'de>>(&mut self, v: V, map: bool) -> Result<V::Value, Error> {
        if self.depth >= 16 {
            return Err(Error);
        }
        self.depth += 1;
        self.take(if map { b'{' } else { b'[' })?;
        let _frame = work::Fixed::new(std::mem::size_of::<Access<'_, 'a>>());
        let mut a = Access {
            p: self,
            first: true,
            map,
            value: false,
        };
        let result = if map {
            v.visit_map(&mut a)
        } else {
            v.visit_seq(&mut a)
        };
        let value = result?;
        a.p.take(if map { b'}' } else { b']' })?;
        a.p.depth -= 1;
        Ok(value)
    }
}
struct Access<'p, 'a> {
    p: &'p mut Parser<'a>,
    first: bool,
    map: bool,
    value: bool,
}
impl Access<'_, '_> {
    fn next(&mut self) -> Result<bool, Error> {
        self.p.ws();
        let closing = if self.map { b'}' } else { b']' };
        if self.p.bytes.get(self.p.pos) == Some(&closing) {
            return Ok(false);
        }
        if !self.first {
            self.p.take(b',')?;
        }
        self.first = false;
        Ok(true)
    }
}
impl<'de> MapAccess<'de> for &mut Access<'_, '_> {
    type Error = Error;
    fn next_key_seed<K: DeserializeSeed<'de>>(&mut self, k: K) -> Result<Option<K::Value>, Error> {
        if self.value {
            return Err(Error);
        }
        if !self.next()? {
            return Ok(None);
        }
        self.p.key = true;
        let value = k.deserialize(&mut *self.p);
        self.p.key = false;
        let value = value?;
        self.p.take(b':')?;
        self.value = true;
        Ok(Some(value))
    }
    fn next_value_seed<V: DeserializeSeed<'de>>(&mut self, v: V) -> Result<V::Value, Error> {
        if !self.value {
            return Err(Error);
        }
        self.value = false;
        v.deserialize(&mut *self.p)
    }
}
impl<'de> SeqAccess<'de> for &mut Access<'_, '_> {
    type Error = Error;
    fn next_element_seed<T: DeserializeSeed<'de>>(
        &mut self,
        t: T,
    ) -> Result<Option<T::Value>, Error> {
        if !self.next()? {
            return Ok(None);
        }
        t.deserialize(&mut *self.p).map(Some)
    }
}
impl<'de> de::Deserializer<'de> for &mut Parser<'_> {
    type Error = Error;
    fn deserialize_any<V: Visitor<'de>>(self, v: V) -> Result<V::Value, Error> {
        self.ws();
        match self.bytes.get(self.pos) {
            Some(b'"') => self.deserialize_string(v),
            Some(b'{') => self.container(v, true),
            Some(b'[') => self.container(v, false),
            Some(b'n') => {
                self.word(b"null")?;
                v.visit_unit()
            }
            Some(b't') => {
                self.word(b"true")?;
                v.visit_bool(true)
            }
            Some(b'f') => {
                self.word(b"false")?;
                v.visit_bool(false)
            }
            Some(b'0'..=b'9') => v.visit_u64(self.number()?),
            _ => Err(Error),
        }
    }
    fn deserialize_string<V: Visitor<'de>>(self, v: V) -> Result<V::Value, Error> {
        let s = self.string()?;
        v.visit_string(s.into_inner())
    }
    fn deserialize_str<V: Visitor<'de>>(self, v: V) -> Result<V::Value, Error> {
        self.deserialize_string(v)
    }
    fn deserialize_u64<V: Visitor<'de>>(self, v: V) -> Result<V::Value, Error> {
        v.visit_u64(self.number()?)
    }
    fn deserialize_bool<V: Visitor<'de>>(self, v: V) -> Result<V::Value, Error> {
        self.ws();
        if self.bytes[self.pos..].starts_with(b"true") {
            self.word(b"true")?;
            v.visit_bool(true)
        } else {
            self.word(b"false")?;
            v.visit_bool(false)
        }
    }
    fn deserialize_option<V: Visitor<'de>>(self, v: V) -> Result<V::Value, Error> {
        self.ws();
        if self.bytes[self.pos..].starts_with(b"null") {
            self.word(b"null")?;
            v.visit_none()
        } else {
            v.visit_some(self)
        }
    }
    fn deserialize_seq<V: Visitor<'de>>(self, v: V) -> Result<V::Value, Error> {
        self.container(v, false)
    }
    fn deserialize_tuple<V: Visitor<'de>>(self, _: usize, v: V) -> Result<V::Value, Error> {
        self.container(v, false)
    }
    fn deserialize_map<V: Visitor<'de>>(self, v: V) -> Result<V::Value, Error> {
        self.container(v, true)
    }
    fn deserialize_struct<V: Visitor<'de>>(
        self,
        _: &'static str,
        _: &'static [&'static str],
        v: V,
    ) -> Result<V::Value, Error> {
        self.container(v, true)
    }
    serde_core::forward_to_deserialize_any! {i8 i16 i32 i64 u8 u16 u32 f32 f64 char bytes byte_buf unit unit_struct newtype_struct tuple_struct enum identifier ignored_any}
}
