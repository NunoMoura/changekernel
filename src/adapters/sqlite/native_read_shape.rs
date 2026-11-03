//! Before-SQLite structural admission of the private physical read copy.
//! This does not replace native integrity checks or P33 semantic verification. It bounds their
//! inputs: WAL-derived size, page/cell/overflow ownership, record headers, fixed schema and keys.
use super::control::{Kind, FRAME};
use super::schema;
use super::store_error::{StoreError, StoreResult};
use crate::application::read_budget::ReadBudget;
use std::collections::{BTreeMap, BTreeSet};
use std::mem;

const SOURCE_MAX: usize = 64 * 1024 * 1024;
const MAX_SCHEMA: usize = 30;
const MAX_ROWS: usize = 16384;
const MAX_DEPTH: u8 = 20;

fn be16(b: &[u8], at: usize) -> StoreResult<usize> {
    Ok(u16::from_be_bytes(
        b.get(at..at + 2)
            .ok_or(StoreError::Corrupt)?
            .try_into()
            .map_err(|_| StoreError::Corrupt)?,
    ) as usize)
}
fn be32(b: &[u8], at: usize) -> StoreResult<u32> {
    Ok(u32::from_be_bytes(
        b.get(at..at + 4)
            .ok_or(StoreError::Corrupt)?
            .try_into()
            .map_err(|_| StoreError::Corrupt)?,
    ))
}
fn varint(b: &[u8], at: &mut usize) -> StoreResult<u64> {
    let mut value = 0u64;
    for i in 0..9 {
        let byte = *b.get(*at).ok_or(StoreError::Corrupt)?;
        *at += 1;
        if i == 8 {
            return Ok((value << 8) | u64::from(byte));
        }
        value = (value << 7) | u64::from(byte & 127);
        if byte & 128 == 0 {
            return Ok(value);
        }
    }
    Err(StoreError::Corrupt)
}
fn checksum(bytes: &[u8], little: bool, mut value: [u32; 2]) -> [u32; 2] {
    for words in bytes.as_chunks::<8>().0 {
        let a: [u8; 4] = words[..4].try_into().expect("fixed width");
        let b: [u8; 4] = words[4..].try_into().expect("fixed width");
        let a = if little {
            u32::from_le_bytes(a)
        } else {
            u32::from_be_bytes(a)
        };
        let b = if little {
            u32::from_le_bytes(b)
        } else {
            u32::from_be_bytes(b)
        };
        value[0] = value[0].wrapping_add(a).wrapping_add(value[1]);
        value[1] = value[1].wrapping_add(b).wrapping_add(value[0]);
    }
    value
}
fn header(bytes: &[u8]) -> StoreResult<(usize, usize)> {
    if bytes.len() < 100 || &bytes[..16] != b"SQLite format 3\0" {
        return Err(StoreError::Corrupt);
    }
    let page = be16(bytes, 16)?;
    let page = if page == 1 { 65536 } else { page };
    if !(512..=65536).contains(&page)
        || !page.is_power_of_two()
        || page - usize::from(bytes[20]) < 480
        || bytes[18..20] != [2, 2]
        || bytes[21..24] != [64, 32, 32]
        || be32(bytes, 56)? > 1
    {
        return Err(StoreError::UnsupportedProfile);
    }
    Ok((page, page - usize::from(bytes[20])))
}
struct Image<'bytes> {
    pages: Vec<Option<&'bytes [u8]>>,
    page: usize,
    usable: usize,
}
impl<'bytes> Image<'bytes> {
    fn new(
        main: &'bytes [u8],
        wal: Option<&'bytes [u8]>,
        budget: &mut ReadBudget,
    ) -> StoreResult<Self> {
        if main
            .len()
            .checked_add(wal.map_or(0, |w| w.len()))
            .ok_or(StoreError::Limit)?
            > SOURCE_MAX
        {
            return Err(StoreError::Limit);
        }
        let (page, usable) = header(main)?;
        if !main.len().is_multiple_of(page) {
            return Err(StoreError::Corrupt);
        }
        let maximum = SOURCE_MAX / page;
        let main_pages = main.len() / page;
        if be32(main, 28)? as usize > maximum {
            return Err(StoreError::Limit);
        }
        budget.allocate(((maximum + 1) * mem::size_of::<Option<&[u8]>>()) as u64)?;
        budget.work((SOURCE_MAX / page + main.len()) as u64)?;
        let mut pages = vec![None; maximum + 1];
        for (index, bytes) in main.chunks_exact(page).enumerate() {
            pages[index + 1] = Some(bytes);
        }
        let mut logical = main_pages;
        if let Some(wal) = wal.filter(|w| !w.is_empty()) {
            if wal.len() < 32 {
                return Err(StoreError::Corrupt);
            }
            let magic = be32(wal, 0)?;
            if ![0x377f0682, 0x377f0683].contains(&magic)
                || be32(wal, 4)? != 3007000
                || be32(wal, 8)? as usize != page
            {
                return Err(StoreError::UnsupportedProfile);
            }
            let little = magic == 0x377f0682;
            let mut sum = checksum(&wal[..24], little, [0, 0]);
            if sum != [be32(wal, 24)?, be32(wal, 28)?] {
                return Err(StoreError::Corrupt);
            }
            let frames = (wal.len() - 32) / (page + 24);
            budget.work(wal.len() as u64)?;
            let mut committed = 0usize;
            for i in 0..frames {
                let at = 32 + i * (page + 24);
                let f = &wal[at..at + page + 24];
                if f[8..16] != wal[16..24] {
                    break;
                }
                let pg = be32(f, 0)? as usize;
                let size = be32(f, 4)? as usize;
                if pg == 0 || pg > maximum || size > maximum {
                    return Err(StoreError::Limit);
                }
                let next = checksum(&f[24..], little, checksum(&f[..8], little, sum));
                if next != [be32(f, 16)?, be32(f, 20)?] {
                    break;
                }
                sum = next;
                if pg == 1
                    && (header(&f[24..])? != (page, usable)
                        || be32(&f[24..], 28)? as usize > maximum)
                {
                    return Err(StoreError::Limit);
                }
                if size != 0 {
                    committed = i + 1;
                    logical = size;
                }
            }
            // Exactly the native last valid commit, never an application-selected older cut.
            // P33's independent witness/cut still has to match the subsequent native result.
            for i in 0..committed {
                let at = 32 + i * (page + 24);
                let pg = be32(wal, at)? as usize;
                pages[pg] = Some(&wal[at + 24..at + 24 + page]);
            }
        }
        if logical == 0 || logical > maximum {
            return Err(StoreError::Limit);
        }
        pages.truncate(logical + 1);
        if pages[1..].iter().any(Option::is_none) {
            return Err(StoreError::Corrupt);
        }
        let current = pages[1].ok_or(StoreError::Corrupt)?;
        if be32(current, 56)? != 1 {
            return Err(StoreError::UnsupportedProfile);
        }
        let n = be32(current, 28)? as usize;
        if n != 0 && current[24..28] == current[92..96] && n != logical {
            return Err(StoreError::Corrupt);
        }
        Ok(Self {
            pages,
            page,
            usable,
        })
    }
    fn get(&self, n: u32) -> StoreResult<&'bytes [u8]> {
        self.pages
            .get(n as usize)
            .and_then(|p| *p)
            .ok_or(StoreError::Corrupt)
    }
}
#[derive(Clone, Copy)]
enum Column {
    Integer,
    Blob(usize),
    NullableBlob(usize),
}
const ID: Column = Column::Blob(16);
const KEY: Column = Column::Blob(64);
const INT: Column = Column::Integer;
const FRAME_COLUMN: Column = Column::Blob(FRAME);
const RECEIPT: Column = Column::Blob(FRAME + 8192);
fn columns(table: &str) -> StoreResult<&'static [Column]> {
    Ok(match table {
        "header" => &[INT, INT, INT, INT, INT, INT, Column::Blob(8192)],
        "head" => &[INT, INT, INT, INT, Column::NullableBlob(16)],
        "records" => &[ID, INT, Column::NullableBlob(16), FRAME_COLUMN],
        "record_integrity" | "requests" | "request_integrity" => &[ID, FRAME_COLUMN],
        "creations" => &[INT, ID, ID],
        "materials" => &[KEY, Column::Blob(1024 * 1024)],
        "establishments" => &[KEY, ID, INT, ID],
        "memberships" => &[ID, KEY, INT],
        "grounds" => &[ID, ID],
        "record_grounds" => &[ID, ID, ID],
        "results" => &[ID, ID, ID, Column::Blob(64), ID, Column::NullableBlob(24)],
        "grant_events" => &[ID, ID, INT, INT],
        "activation" | "activation_integrity" => &[INT, RECEIPT],
        _ => return Err(StoreError::UnsupportedProfile),
    })
}
fn index_columns(table: &str, n: usize) -> StoreResult<&'static [Column]> {
    Ok(match (table, n) {
        ("records", 2) => &[INT, INT],
        ("grant_events", 2) => &[ID, INT, INT],
        ("creations", 1) => &[INT, ID, INT],
        ("memberships", 1) => &[ID, KEY, INT],
        ("grounds" | "record_grounds", 1) => &[ID, ID, INT],
        ("materials" | "establishments", 1) => &[KEY, INT],
        (
            "records" | "record_integrity" | "requests" | "request_integrity" | "results"
            | "grant_events",
            1,
        ) => &[ID, INT],
        _ => return Err(StoreError::UnsupportedProfile),
    })
}
fn autoindices(table: &str) -> usize {
    match table {
        "records" | "grant_events" => 2,
        "header" | "head" | "activation" | "activation_integrity" => 0,
        _ => 1,
    }
}
#[derive(Clone, Copy, Default)]
struct Value {
    serial: u64,
    offset: usize,
    length: usize,
}
fn record_header(prefix: &[u8], length: usize, expected: usize) -> StoreResult<[Value; 8]> {
    if expected > 8 {
        return Err(StoreError::Corrupt);
    }
    let mut at = 0;
    let end = usize::try_from(varint(prefix, &mut at)?).map_err(|_| StoreError::Limit)?;
    if end > prefix.len() || end > 128 || end > length {
        return Err(StoreError::Corrupt);
    }
    let mut values = [Value::default(); 8];
    let mut body = end;
    for value in &mut values[..expected] {
        if at >= end {
            return Err(StoreError::Corrupt);
        }
        let serial = varint(prefix, &mut at)?;
        let size = match serial {
            0 | 8 | 9 => 0,
            1 => 1,
            2 => 2,
            3 => 3,
            4 => 4,
            5 => 6,
            6 | 7 => 8,
            10 | 11 => return Err(StoreError::Corrupt),
            n => usize::try_from((n - 12) / 2).map_err(|_| StoreError::Limit)?,
        };
        *value = Value {
            serial,
            offset: body,
            length: size,
        };
        body = body.checked_add(size).ok_or(StoreError::Limit)?;
    }
    if at != end || body != length {
        return Err(StoreError::Corrupt);
    }
    Ok(values)
}
fn check_columns(values: &[Value], cols: &[Column]) -> StoreResult<()> {
    for (v, c) in values.iter().zip(cols) {
        match c {
            Column::Integer if matches!(v.serial, 0..=6 | 8 | 9) => {} // INTEGER PRIMARY KEY is encoded NULL in rowid records.
            Column::Blob(max) | Column::NullableBlob(max)
                if v.serial >= 12 && v.serial.is_multiple_of(2) && v.length <= *max => {}
            Column::NullableBlob(_) if v.serial == 0 => {}
            _ => return Err(StoreError::Corrupt),
        }
    }
    Ok(())
}
struct SchemaEntry {
    name: String,
    table: String,
    root: u32,
    sql: Option<String>,
    index: bool,
}
#[derive(Clone, Copy)]
struct Task {
    page: u32,
    parent: u32,
    depth: u8,
}
#[derive(Clone, Copy)]
enum Tree<'columns> {
    Schema,
    Table(&'columns [Column]),
    Index(&'columns [Column]),
}
struct Walker<'image, 'bytes> {
    image: &'image Image<'bytes>,
    // role 1 root, 2 free, 3 first overflow, 4 later overflow, 5 nonroot btree, 6 ptrmap.
    roles: Vec<u8>,
    parents: Vec<u32>,
    stack: Vec<Task>,
    used: Vec<u8>,
    cells: u64,
    payload: u64,
    rows: usize,
    max_depth: u8,
    max_fanout: usize,
    max_key: usize,
}
impl<'image, 'bytes> Walker<'image, 'bytes> {
    fn new(image: &'image Image<'bytes>, budget: &mut ReadBudget) -> StoreResult<Self> {
        let n = image.pages.len();
        budget.allocate((n * (1 + 4 + mem::size_of::<Task>()) + image.page) as u64)?;
        budget.work((n * 8 + SOURCE_MAX) as u64)?;
        let mut out = Self {
            image,
            roles: vec![0; n],
            parents: vec![0; n],
            stack: Vec::with_capacity(n),
            used: vec![0; image.page],
            cells: 0,
            payload: 0,
            rows: 0,
            max_depth: 0,
            max_fanout: 0,
            max_key: 64,
        };
        if be32(image.get(1)?, 52)? != 0 {
            let interval = image.usable / 5 + 1;
            for p in (2..n).step_by(interval) {
                out.roles[p] = 6;
            }
        }
        Ok(out)
    }
    fn mark(&mut self, page: u32, role: u8, parent: u32) -> StoreResult<()> {
        let p = page as usize;
        if p == 0 || p >= self.roles.len() || self.roles[p] != 0 {
            return Err(StoreError::Corrupt);
        }
        self.roles[p] = role;
        self.parents[p] = parent;
        Ok(())
    }
    fn span(&mut self, start: usize, length: usize) -> StoreResult<()> {
        let end = start.checked_add(length).ok_or(StoreError::Corrupt)?;
        if end > self.image.usable {
            return Err(StoreError::Corrupt);
        }
        let bytes = self.used.get_mut(start..end).ok_or(StoreError::Corrupt)?;
        if bytes.iter().any(|b| *b != 0) {
            return Err(StoreError::Corrupt);
        }
        bytes.fill(1);
        Ok(())
    }
    fn payload_prefix(
        &mut self,
        page: u32,
        bytes: &[u8],
        start: usize,
        length: usize,
        table: bool,
        schema: bool,
    ) -> StoreResult<(Vec<u8>, usize)> {
        if length > FRAME + 8192 + 512 || (!table && length > 512) || (schema && length > 16384) {
            return Err(StoreError::Limit);
        }
        let usable = self.image.usable;
        let max = if table {
            usable - 35
        } else {
            (usable - 12) * 64 / 255 - 23
        };
        let min = (usable - 12) * 32 / 255 - 23;
        let local = if length <= max {
            length
        } else {
            let x = min + (length - min) % (usable - 4);
            if x > max {
                min
            } else {
                x
            }
        };
        let prefix_length = if schema { length } else { length.min(128) };
        let mut prefix = Vec::with_capacity(prefix_length);
        let part = bytes.get(start..start + local).ok_or(StoreError::Corrupt)?;
        prefix.extend_from_slice(&part[..part.len().min(prefix_length)]);
        let mut left = length - local;
        let mut previous = page;
        if left != 0 {
            let mut next = be32(bytes, start + local)?;
            while left != 0 {
                self.mark(next, if previous == page { 3 } else { 4 }, previous)?;
                let overflow = self.image.get(next)?;
                let take = left.min(usable - 4);
                if prefix.len() < prefix_length {
                    prefix.extend_from_slice(
                        &overflow[4..4 + take.min(prefix_length - prefix.len())],
                    );
                }
                left -= take;
                previous = next;
                next = be32(overflow, 0)?;
                if left == 0 && next != 0 {
                    return Err(StoreError::Corrupt);
                }
            }
        }
        self.payload = self
            .payload
            .checked_add(length as u64)
            .ok_or(StoreError::Limit)?;
        Ok((prefix, local + if length > local { 4 } else { 0 }))
    }
    fn tree(
        &mut self,
        root: u32,
        tree: Tree<'_>,
        budget: &mut ReadBudget,
    ) -> StoreResult<Vec<SchemaEntry>> {
        let schema_tree = matches!(tree, Tree::Schema);
        let cols = match tree {
            Tree::Schema => None,
            Tree::Table(cols) | Tree::Index(cols) => Some(cols),
        };
        self.stack.push(Task {
            page: root,
            parent: 0,
            depth: 1,
        });
        let mut entries = Vec::new();
        let mut rows = 0usize;
        while let Some(task) = self.stack.pop() {
            if task.depth > MAX_DEPTH {
                return Err(StoreError::Limit);
            }
            self.max_depth = self.max_depth.max(task.depth);
            self.mark(task.page, if task.parent == 0 { 1 } else { 5 }, task.parent)?;
            let b = self.image.get(task.page)?;
            let h = if task.page == 1 { 100 } else { 0 };
            let kind = *b.get(h).ok_or(StoreError::Corrupt)?;
            let table = matches!(kind, 5 | 13);
            let leaf = matches!(kind, 10 | 13);
            if ![2, 5, 10, 13].contains(&kind) || (table == matches!(tree, Tree::Index(_))) {
                return Err(StoreError::Corrupt);
            }
            let nc = be16(b, h + 3)?;
            self.max_fanout = self.max_fanout.max(nc);
            let base = h + if leaf { 8 } else { 12 };
            let end = base.checked_add(nc * 2).ok_or(StoreError::Limit)?;
            if end > self.image.usable || b[h + 7] > 60 {
                return Err(StoreError::Corrupt);
            }
            self.used.fill(0);
            self.span(0, end)?;
            self.cells = self.cells.checked_add(nc as u64).ok_or(StoreError::Limit)?;
            if self.cells > 65536 {
                return Err(StoreError::Limit);
            }
            budget.work((nc * 128 + self.image.page) as u64)?;
            if !leaf {
                if self.stack.len() == self.roles.len() {
                    return Err(StoreError::Limit);
                }
                self.stack.push(Task {
                    page: be32(b, h + 8)?,
                    parent: task.page,
                    depth: task.depth + 1,
                });
            }
            for i in 0..nc {
                let offset = be16(b, base + i * 2)?;
                if offset < end || offset >= self.image.usable {
                    return Err(StoreError::Corrupt);
                }
                let mut at = offset;
                if !leaf {
                    if self.stack.len() == self.roles.len() {
                        return Err(StoreError::Limit);
                    }
                    self.stack.push(Task {
                        page: be32(b, at)?,
                        parent: task.page,
                        depth: task.depth + 1,
                    });
                    at += 4;
                }
                if table && !leaf {
                    varint(b, &mut at)?;
                } else {
                    let length =
                        usize::try_from(varint(b, &mut at)?).map_err(|_| StoreError::Limit)?;
                    if table {
                        varint(b, &mut at)?;
                    } else {
                        self.max_key = self.max_key.max(length);
                    }
                    budget.allocate(if schema_tree { length as u64 } else { 128 })?;
                    let (prefix, span) =
                        self.payload_prefix(task.page, b, at, length, table, schema_tree)?;
                    let count = if schema_tree {
                        5
                    } else {
                        cols.ok_or(StoreError::Corrupt)?.len()
                    };
                    let values = record_header(&prefix, length, count)?;
                    if schema_tree {
                        if rows >= MAX_SCHEMA {
                            return Err(StoreError::Limit);
                        }
                        budget.allocate(32768)?;
                        entries.push(schema_entry(&prefix, &values)?);
                    } else {
                        check_columns(&values[..count], cols.ok_or(StoreError::Corrupt)?)?;
                    }
                    at += span;
                    rows += 1;
                    if rows > MAX_ROWS {
                        return Err(StoreError::Limit);
                    }
                }
                self.span(offset, at - offset)?;
            }
            let mut free = be16(b, h + 1)?;
            while free != 0 {
                let next = be16(b, free)?;
                let size = be16(b, free + 2)?;
                if size < 4 || (next != 0 && next < free + size) {
                    return Err(StoreError::Corrupt);
                }
                self.span(free, size)?;
                free = next;
            }
        }
        self.rows = self.rows.checked_add(rows).ok_or(StoreError::Limit)?;
        if self.rows > 65536 {
            return Err(StoreError::Limit);
        }
        Ok(entries)
    }
    fn freelist(&mut self) -> StoreResult<()> {
        let header = self.image.get(1)?;
        let expected = be32(header, 36)? as usize;
        if expected >= self.roles.len() {
            return Err(StoreError::Corrupt);
        }
        let mut next = be32(header, 32)?;
        let mut count = 0usize;
        while next != 0 {
            self.mark(next, 2, 0)?;
            count += 1;
            let page = self.image.get(next)?;
            let n = be32(page, 4)? as usize;
            if n > (self.image.usable - 8) / 4 {
                return Err(StoreError::Corrupt);
            }
            for i in 0..n {
                self.mark(be32(page, 8 + 4 * i)?, 2, 0)?;
                count += 1;
            }
            if count > expected {
                return Err(StoreError::Corrupt);
            }
            next = be32(page, 0)?;
        }
        if count != expected || self.roles[1..].contains(&0) {
            return Err(StoreError::Corrupt);
        }
        let interval = self.image.usable / 5 + 1;
        for p in 2..self.roles.len() {
            if self.roles[p] == 6 {
                continue;
            }
            let map = (p - 2) / interval * interval + 2;
            if self.roles.get(map) != Some(&6) {
                continue;
            }
            let at = (p - map - 1) * 5;
            let bytes = self.image.get(map as u32)?;
            if bytes[at] != self.roles[p] || be32(bytes, at + 1)? != self.parents[p] {
                return Err(StoreError::Corrupt);
            }
        }
        Ok(())
    }
}
fn schema_entry(payload: &[u8], values: &[Value; 8]) -> StoreResult<SchemaEntry> {
    let text = |v: Value, max: usize| -> StoreResult<String> {
        if v.serial < 13 || v.serial.is_multiple_of(2) || v.length > max {
            return Err(StoreError::Corrupt);
        }
        let bytes = payload
            .get(v.offset..v.offset + v.length)
            .ok_or(StoreError::Corrupt)?;
        Ok(std::str::from_utf8(bytes)
            .map_err(|_| StoreError::Corrupt)?
            .to_owned())
    };
    let kind = text(values[0], 8)?;
    if !["table", "index"].contains(&kind.as_str()) {
        return Err(StoreError::UnsupportedProfile);
    }
    let root = values[3];
    let number = match root.serial {
        1..=4 => {
            let bytes = payload
                .get(root.offset..root.offset + root.length)
                .ok_or(StoreError::Corrupt)?;
            // SQLite INTEGER serials are signed two's-complement, not unsigned page IDs.
            // Reject negatives before folding so admission and SQLite see the same root.
            if bytes.first().is_none_or(|b| *b & 0x80 != 0) {
                return Err(StoreError::Corrupt);
            }
            bytes.iter().fold(0u32, |n, b| (n << 8) | u32::from(*b))
        }
        8 => 0,
        9 => 1,
        _ => return Err(StoreError::Corrupt),
    };
    Ok(SchemaEntry {
        name: text(values[1], 64)?,
        table: text(values[2], 64)?,
        root: number,
        sql: if values[4].serial == 0 {
            None
        } else {
            Some(text(values[4], 16384)?)
        },
        index: kind == "index",
    })
}

#[cfg(test)]
pub(super) fn fault_table_byte(
    main: &mut [u8],
    mut wal: Option<&mut [u8]>,
    table: &str,
    needle: &[u8],
) -> StoreResult<()> {
    use crate::application::read_budget::ReadWorkLimits;
    let mut budget = ReadBudget::try_new(ReadWorkLimits::default())?;
    let image = Image::new(main, wal.as_deref(), &mut budget)?;
    let mut walker = Walker::new(&image, &mut budget)?;
    let entries = walker.tree(1, Tree::Schema, &mut budget)?;
    let root = entries
        .iter()
        .find(|e| e.name == table)
        .ok_or(StoreError::Corrupt)?
        .root;
    let head = entries
        .iter()
        .find(|e| e.name == "head")
        .ok_or(StoreError::Corrupt)?
        .root;
    let prior_head = image.get(head)?.to_vec();
    let position = image
        .get(root)?
        .windows(needle.len())
        .position(|bytes| bytes == needle)
        .ok_or(StoreError::Corrupt)?;
    let page = image.page;
    drop(walker);
    drop(image);
    let at = (root as usize - 1) * page + position;
    if main.get(at..at + needle.len()) == Some(needle) {
        main[at] ^= 1;
    }
    if let Some(wal) = wal.as_deref_mut().filter(|w| !w.is_empty()) {
        let little = be32(wal, 0)? == 0x377f0682;
        let mut sum = checksum(&wal[..24], little, [0, 0]);
        for i in 0..(wal.len() - 32) / (page + 24) {
            let at = 32 + i * (page + 24);
            if wal[at + 8..at + 16] != wal[16..24] {
                break;
            }
            if be32(wal, at)? == root
                && wal.get(at + 24 + position..at + 24 + position + needle.len()) == Some(needle)
            {
                wal[at + 24 + position] ^= 1;
            }
            sum = checksum(
                &wal[at + 24..at + 24 + page],
                little,
                checksum(&wal[at..at + 8], little, sum),
            );
            wal[at + 16..at + 20].copy_from_slice(&sum[0].to_be_bytes());
            wal[at + 20..at + 24].copy_from_slice(&sum[1].to_be_bytes());
        }
    }
    let image = Image::new(main, wal.as_deref(), &mut budget)?;
    if image.get(head)? != prior_head {
        return Err(StoreError::Corrupt);
    }
    Ok(())
}

/// The returned native reservation is derived from the admitted page/cell/record structure.
/// Full SQLite integrity, exact schema, raw pairs, controls and replay are still mandatory.
pub(super) fn admit(main: &[u8], wal: Option<&[u8]>, budget: &mut ReadBudget) -> StoreResult<()> {
    let image = Image::new(main, wal, budget)?;
    let mut walker = Walker::new(&image, budget)?;
    let entries = walker.tree(1, Tree::Schema, budget)?;
    budget.allocate(128 * 1024)?;
    let definitions = schema::definitions(Kind::Original);
    let mut roots = BTreeSet::from([1u32]);
    let mut tables = BTreeMap::new();
    let mut indices = BTreeSet::new();
    for e in &entries {
        if e.root == 0 || !roots.insert(e.root) {
            return Err(StoreError::Corrupt);
        }
        if e.index {
            let prefix = format!("sqlite_autoindex_{}_", e.table);
            let n = e
                .name
                .strip_prefix(&prefix)
                .ok_or(StoreError::UnsupportedProfile)?
                .parse::<usize>()
                .map_err(|_| StoreError::UnsupportedProfile)?;
            if e.sql.is_some()
                || n == 0
                || n > autoindices(&e.table)
                || !definitions.contains_key(&e.table)
                || !indices.insert((e.table.clone(), n))
            {
                return Err(StoreError::UnsupportedProfile);
            }
        } else if e.table != e.name
            || e.sql.as_ref() != definitions.get(&e.name)
            || tables.insert(e.name.clone(), e.root).is_some()
        {
            return Err(StoreError::UnsupportedProfile);
        }
    }
    if tables.len() != definitions.len() {
        return Err(StoreError::UnsupportedProfile);
    }
    for table in definitions.keys() {
        for i in 1..=autoindices(table) {
            if !indices.contains(&(table.clone(), i)) {
                return Err(StoreError::Corrupt);
            }
        }
    }
    for e in &entries {
        if e.index {
            let prefix = format!("sqlite_autoindex_{}_", e.table);
            let n = e
                .name
                .strip_prefix(&prefix)
                .ok_or(StoreError::Corrupt)?
                .parse::<usize>()
                .map_err(|_| StoreError::Corrupt)?;
            walker.tree(e.root, Tree::Index(index_columns(&e.table, n)?), budget)?;
        } else {
            let before = walker.rows;
            walker.tree(e.root, Tree::Table(columns(&e.name)?), budget)?;
            let n = walker.rows - before;
            let cap = if ["header", "head", "activation", "activation_integrity"]
                .contains(&e.name.as_str())
            {
                1
            } else if [
                "records",
                "record_integrity",
                "requests",
                "request_integrity",
            ]
            .contains(&e.name.as_str())
            {
                256
            } else {
                MAX_ROWS
            };
            if n > cap {
                return Err(StoreError::Limit);
            }
        }
    }
    walker.freelist()?;
    // Only fixed DDL/queries reach SQLite; BINARY keys <=512 bytes and tree depth <=20.
    // Do not assume cache hits or O(1) page/WAL hash lookups. Bound all possible page fetches,
    // their allocation churn, WAL recovery and collision chains before opening SQLite.
    let pages = (image.pages.len() - 1) as u64;
    let ddl_bytes = definitions
        .values()
        .map(|sql| sql.len() as u64)
        .sum::<u64>();
    // Parser-node arena: fixed known DDL plus <=4096-byte fixed queries, <=8 AST objects
    // per input byte, <=512 bytes per object; statement ops/register/cursor arena separately.
    let parser = (ddl_bytes + 4096) * 8 * 512 + 65536 * 1024 + 128 * 1024;
    let levels = u64::from(walker.max_depth) + 1;
    let probes = u64::from((walker.max_fanout + 1).max(2).ilog2()) + 2;
    // Per cell: <=two indices, three foreign keys, four pair reads and three other scans;
    // sixteen seeks is conservative even if these maxima coincide. Sixteen full page/byte
    // passes cover integrity rows, overflow, cell-span sorting, freelists and control reads.
    let fetches = walker
        .cells
        .checked_mul(levels * 16)
        .and_then(|n| n.checked_add(pages * 16))
        .ok_or(StoreError::Limit)?;
    let wal_bytes = wal.map_or(0, |w| w.len() as u64);
    let wal_frames = wal_bytes.saturating_sub(32) / (image.page as u64 + 24);
    let native_io = fetches
        .checked_mul(image.page as u64)
        .and_then(|n| n.checked_add(2 * wal_bytes))
        .ok_or(StoreError::Limit)?;
    // Cumulative allocations, not merely peak cache residence: pessimistically allocate a
    // fresh page and 4 KiB metadata on EVERY possible fetch. WAL index/temporary arrays are
    // smaller than twice the WAL bytes. The integrity bitmap and two-page heap are separate.
    // Fixed simple SELECTs have <=64 AST nodes, 256 ops, 64 registers and eight cursors;
    // 64 KiB per invocation includes parser/SQL/names/allocator slack. There are <=4N pair
    // statements and <64 other statements; 6*256+64 also covers repeated schema checks.
    let native_bytes = fetches
        .checked_mul((image.page + 4096) as u64)
        .and_then(|n| {
            n.checked_add(
                pages / 8
                    + 1
                    + 2 * image.page as u64
                    + 4 * (FRAME as u64 + 8192)
                    + parser
                    + 2 * wal_bytes
                    + (6 * 256 + 64) * 65536,
            )
        })
        .ok_or(StoreError::Limit)?;
    let native_work = walker
        .cells
        .checked_mul(walker.max_key as u64 * levels * probes * 16)
        .and_then(|n| n.checked_add(pages * image.usable as u64 * 16))
        // A page-cache chain cannot exceed all logical pages; a WAL lookup may scan every
        // admitted frame. Recovery insertion probes <=4096 slots, with two table passes.
        .and_then(|n| n.checked_add(fetches.checked_mul(2 * (pages + wal_frames + 1))?))
        .and_then(|n| n.checked_add(wal_frames * (8192 + 4 * image.page as u64)))
        // Fixed parser/name-resolution and query construction (distinct from VM dispatch).
        .and_then(|n| n.checked_add((ddl_bytes + 4096) * 64 + (6 * 256 + 64) * 65536))
        .ok_or(StoreError::Limit)?;
    budget.allocate(native_bytes)?;
    // Reserve complete native-row copies, Rust paired blobs and actual control collections.
    // Sixteen slots include the first underfull 11-slot B-tree node and Vec growth/slack.
    budget.allocate(
        walker
            .payload
            .checked_mul(16)
            .and_then(|n| n.checked_add(walker.cells * 16 * 64))
            .ok_or(StoreError::Limit)?,
    )?;
    budget.allocate(512 * 1024)?; // fixed DDL strings, subject/receipt envelopes and path pins
    budget.work(native_work)?;
    budget.io(native_io)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn schema_record(serial: u8, root: &[u8]) -> Vec<u8> {
        // A complete SQLite sqlite_schema row: type, name, table, rootpage and SQL.
        let sql = b"CREATE TABLE t(a)";
        let mut record = vec![6, 23, 15, 15, serial, (13 + 2 * sql.len()) as u8];
        record.extend_from_slice(b"tablett");
        record.extend_from_slice(root);
        record.extend_from_slice(sql);
        record
    }
    #[test]
    fn malformed_signed_schema_roots_never_alias_unsigned_pages() {
        for (serial, negative) in [
            (1, &b"\xff"[..]),
            (1, &b"\x80"[..]),
            (2, &b"\xff\xff"[..]),
            (2, &b"\x80\0"[..]),
            (3, &b"\xff\xff\xff"[..]),
            (3, &b"\x80\0\0"[..]),
            (4, &b"\xff\xff\xff\xff"[..]),
            (4, &b"\x80\0\0\0"[..]),
        ] {
            let record = schema_record(serial, negative);
            let values = record_header(&record, record.len(), 5).expect("valid record structure");
            assert!(
                matches!(schema_entry(&record, &values), Err(StoreError::Corrupt)),
                "signed negative serial {serial} must not become an unsigned root"
            );
        }
        for (serial, bytes, expected) in [
            (1, &b"\x7f"[..], 127),
            (2, &b"\0\x80"[..], 128),
            (2, &b"\0\xff"[..], 255),
            (3, &b"\x7f\xff\xff"[..], 8_388_607),
            (4, &b"\x7f\xff\xff\xff"[..], 2_147_483_647),
        ] {
            let record = schema_record(serial, bytes);
            let values = record_header(&record, record.len(), 5).expect("valid record structure");
            assert_eq!(
                schema_entry(&record, &values).expect("positive root").root,
                expected
            );
        }
    }
}
