//! V custody. Descriptor-relative operations; inspection never writes or cleans.
use super::{ledger::held_identity, opening::storage as raw};
use crate::kernel::changes::referenced_intent::*;
use serde_core::{
    de::{self, MapAccess, Visitor},
    ser::SerializeStruct,
    Deserialize, Deserializer, Serialize, Serializer,
};
mod generated;
mod io;
use io::Io;
pub use io::{ReferencedIntentIoEvent, ReferencedIntentIoFault, ReferencedIntentIoHook};
use std::{
    ffi::{CStr, CString},
    fmt,
    fs::File,
    os::fd::{AsRawFd, FromRawFd},
    path::Path,
};
closed!(Identity {
    mechanism: String,
    fsid: String,
    handle_type: u64,
    handle_bytes: u64,
    handle: String
});
closed!(Anchor {
    format: String,
    version: String,
    custody: String,
    ledger: String,
    change: String,
    owner: String,
    policy: Material,
    coverage: String,
    directory: String,
    root: Identity,
    lock: Identity,
    materials: Identity,
    stage: String
});
fn identity(f: &File, io: &Io) -> Result<Identity> {
    let i = io.raw(held_identity(f))?;
    Ok(Identity {
        mechanism: "btrfs-fsid-fh".into(),
        fsid: i.fsid.iter().map(|b| format!("{b:02x}")).collect(),
        handle_type: 77,
        handle_bytes: 20,
        handle: i.handle.iter().map(|b| format!("{b:02x}")).collect(),
    })
}
fn valid_path(s: &str) -> bool {
    s.starts_with('/')
        && s.len() <= 4096
        && !s.chars().any(char::is_control)
        && !s
            .split('/')
            .skip(1)
            .any(|s| s.is_empty() || s == "." || s == "..")
}
fn map<T>(r: std::result::Result<T, raw::Failure>) -> Result<T> {
    r.map_err(|_| Error::Unavailable)
}

fn names(dir: &File, max: usize, io: &Io) -> Result<Vec<String>> {
    // dup shares directory position, so open a fresh descriptor for enumeration.
    let f = io.raw(raw::at(dir, b".", libc::O_RDONLY | libc::O_DIRECTORY, 0))?;
    use std::os::fd::IntoRawFd;
    let fd = f.into_raw_fd();
    // SAFETY: fd ownership transfers to DIR on success.
    let d = unsafe { libc::fdopendir(fd) };
    if d.is_null() {
        unsafe { drop(File::from_raw_fd(fd)) };
        return Err(io.fail("io"));
    }
    struct Dir(*mut libc::DIR);
    impl Drop for Dir {
        fn drop(&mut self) {
            unsafe {
                libc::closedir(self.0);
            }
        }
    }
    let _guard = Dir(d);
    let mut out = Vec::new();
    loop {
        unsafe {
            *libc::__errno_location() = 0;
        }
        let e = unsafe { libc::readdir(d) };
        if e.is_null() {
            if std::io::Error::last_os_error().raw_os_error() != Some(0) {
                return Err(io.fail("io"));
            }
            break;
        }
        let n = unsafe { CStr::from_ptr((*e).d_name.as_ptr()) }
            .to_str()
            .map_err(|_| Error::Unavailable)?;
        if n == "." || n == ".." {
            continue;
        }
        if out.len() == max {
            return Err(Error::Unavailable);
        }
        out.push(n.into());
    }
    Ok(out)
}
fn mkdir(dir: &File, name: &str) -> Result<()> {
    let n = CString::new(name).map_err(|_| Error::Invalid)?;
    if unsafe { libc::mkdirat(dir.as_raw_fd(), n.as_ptr(), 0o700) } != 0 {
        return Err(Error::Unavailable);
    }
    Ok(())
}
fn clear_incident() -> &'static [u8] {
    b"{\"format\":\"ck-ref-incident\",\"custody\":\"custody-1\",\"state\":\"clear\"}\n"
}
pub(crate) struct Store {
    grant: Grant,
    anchor: Anchor,
    root: File,
    lock: File,
    materials: File,
    parent: File,
    slot_parent: File,
    anchor_name: String,
    anchor_temp: String,
    pub latched: bool,
    io: Io,
}
#[derive(Clone)]
pub(crate) struct Snapshot {
    pub prefix: Prefix,
    pub records: Vec<Record>,
    pub trace: Vec<u8>,
    pub temp: Option<Prefix>,
    pub readiness: Vec<String>,
}
impl Snapshot {
    pub fn tip(&self) -> Option<Fact> {
        (self.prefix.generation > 0).then(|| Fact::at(self.prefix.generation))
    }
    pub fn accepted(&self, key: &str) -> Option<&Record> {
        self.records.iter().find(|r| r.input.key() == key)
    }
}
impl Store {
    pub fn connect(grant: Grant, mode: &str, hook: Option<ReferencedIntentIoHook>) -> Result<Self> {
        let io = Io::new(hook);
        grant.validate()?;
        if !valid_path(&grant.directory) || !valid_path(&grant.anchor) {
            return Err(Error::Invalid);
        }
        let path = Path::new(&grant.directory);
        let anchor_path = Path::new(&grant.anchor);
        let slot_parent = map(raw::directory(path.parent().ok_or(Error::Invalid)?))?;
        let parent = map(raw::directory(anchor_path.parent().ok_or(Error::Invalid)?))?;
        let anchor_name = anchor_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or(Error::Invalid)?
            .to_owned();
        // The temporary has the fixed inventory role; the grant independently pins
        // the absolute anchor target without a filename-extension schema rule.
        let anchor_temp = "slot-anchor.tmp".to_owned();
        if anchor_name == anchor_temp {
            return Err(Error::Invalid);
        }
        if mode == "fresh_provision" {
            if io.exists(&parent, &anchor_name)? || io.exists(&parent, &anchor_temp)? {
                return Err(Error::Unavailable);
            }
            mkdir(
                &slot_parent,
                path.file_name()
                    .and_then(|n| n.to_str())
                    .ok_or(Error::Invalid)?,
            )?;
        } else if !matches!(mode, "reopen" | "resume_provision") {
            return Err(Error::Invalid);
        }
        let root = map(raw::directory(path))?;
        let lock = io.regular(
            &root,
            "writer.lock",
            if mode == "fresh_provision" {
                libc::O_RDWR | libc::O_CREAT | libc::O_EXCL
            } else {
                libc::O_RDWR
            },
        )?;
        if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
            return Err(Error::Unavailable);
        }
        if mode == "fresh_provision" {
            mkdir(&root, "materials")?;
        }
        let materials = map(raw::at(
            &root,
            b"materials",
            libc::O_RDONLY | libc::O_DIRECTORY,
            0,
        ))?;
        let root_id = identity(&root, &io)?;
        let lock_id = identity(&lock, &io)?;
        let material_id = identity(&materials, &io)?;
        if root_id.fsid != lock_id.fsid || root_id.fsid != material_id.fsid {
            return Err(Error::Unavailable);
        }
        let initial = Anchor {
            format: "ck-ref-anchor".into(),
            version: V.into(),
            custody: grant.custody.clone(),
            ledger: grant.ledger.clone(),
            change: grant.change.clone(),
            owner: grant.owner.clone(),
            policy: grant.policy.clone(),
            coverage: grant.coverage.clone(),
            directory: grant.directory.clone(),
            root: root_id,
            lock: lock_id,
            materials: material_id,
            stage: "preparing".into(),
        };
        let anchor = if mode == "fresh_provision" {
            initial.clone()
        } else {
            let b = io.read(&parent, &anchor_name, LIMIT)?;
            let a: Anchor = versioned_canonical(&b)?;
            if a.version != V {
                return Err(Error::Unsupported);
            }
            let mut expected = initial.clone();
            expected.stage = a.stage.clone();
            if a != expected || !matches!(a.stage.as_str(), "preparing" | "installed") {
                return Err(Error::Unavailable);
            }
            a
        };
        let mut s = Self {
            grant,
            anchor,
            root,
            lock,
            materials,
            parent,
            slot_parent,
            anchor_name,
            anchor_temp,
            latched: false,
            io,
        };
        let result = (|| {
            if mode == "fresh_provision" {
                s.barriers()?;
                s.create(&s.parent, &s.anchor_name, &emit(&s.anchor)?)?;
                s.sync(&s.parent)?;
            }
            if mode == "reopen" {
                if s.anchor.stage != "installed" || s.io.exists(&s.parent, &s.anchor_temp)? {
                    return Err(Error::Unavailable);
                }
            } else {
                s.provision()?;
            }
            s.snapshot()?;
            Ok(())
        })();
        if let Err(e) = result {
            if mode == "reopen" {
                s.quarantine()
            } else {
                s.finish_failure()
            }
            return Err(e);
        }
        Ok(s)
    }
    fn sync(&self, f: &File) -> Result<()> {
        self.io.sync(f, "directory")
    }
    fn barriers(&self) -> Result<()> {
        for (name, f) in [
            ("writer.lock", &self.lock),
            ("materials", &self.materials),
            ("slot", &self.root),
            ("slot_parent", &self.slot_parent),
            ("anchor_parent", &self.parent),
        ] {
            self.io.sync(f, name)?;
        }
        Ok(())
    }
    fn create(&self, dir: &File, name: &str, b: &[u8]) -> Result<()> {
        self.io.create(dir, name, b)
    }
    fn replace(&self, dir: &File, target: &str, temp: &str, b: &[u8]) -> Result<()> {
        self.io.replace(dir, target, temp, b)
    }
    fn remove(&self, dir: &File, name: &str) -> Result<()> {
        self.io.remove(dir, name)
    }
    fn initial(&self) -> Result<()> {
        let allowed = [
            "writer.lock",
            "materials",
            "trace.jsonl",
            "checkpoint.json",
            "incident.json",
        ];
        if names(&self.root, 7, &self.io)?
            .iter()
            .any(|n| !allowed.contains(&n.as_str()))
        {
            return Err(Error::Unavailable);
        }
        for (n, b) in [
            ("trace.jsonl", vec![]),
            ("checkpoint.json", emit(&Prefix::empty())?),
            ("incident.json", clear_incident().to_vec()),
        ] {
            if self.io.read(&self.root, n, LIMIT)? != b {
                return Err(Error::Unavailable);
            }
        }
        let ns = names(&self.materials, 1, &self.io)?;
        if ns != vec![format!("{}.txt", self.grant.policy.sha256)] {
            return Err(Error::Unavailable);
        }
        self.resolve(&self.grant.policy)?;
        Ok(())
    }
    fn provision(&mut self) -> Result<()> {
        if self.anchor.stage == "preparing" {
            let allowed = [
                "writer.lock",
                "materials",
                "trace.jsonl",
                "checkpoint.json",
                "incident.json",
            ];
            if names(&self.root, 7, &self.io)?
                .iter()
                .any(|n| !allowed.contains(&n.as_str()))
            {
                return Err(Error::Unavailable);
            }
            for (n, b) in [
                ("trace.jsonl", vec![]),
                ("checkpoint.json", emit(&Prefix::empty())?),
                ("incident.json", clear_incident().to_vec()),
            ] {
                if self.io.exists(&self.root, n)? {
                    if self.io.read(&self.root, n, LIMIT)? != b {
                        return Err(Error::Unavailable);
                    }
                } else {
                    self.create(&self.root, n, &b)?;
                    self.sync(&self.root)?
                }
            }
            let n = format!("{}.txt", self.grant.policy.sha256);
            if names(&self.materials, 1, &self.io)?.iter().any(|v| v != &n) {
                return Err(Error::Unavailable);
            }
            if !self.io.exists(&self.materials, &n)? {
                self.create(&self.materials, &n, POLICY.as_bytes())?;
                self.sync(&self.materials)?;
            }
        }
        self.initial()?;
        if self.io.exists(&self.parent, &self.anchor_temp)? {
            let t: Anchor =
                versioned_canonical(&self.io.read(&self.parent, &self.anchor_temp, LIMIT)?)?;
            let mut installed = self.anchor.clone();
            installed.stage = "installed".into();
            if t != self.anchor && !(self.anchor.stage == "preparing" && t == installed) {
                return Err(Error::Unavailable);
            }
            self.remove(&self.parent, &self.anchor_temp)?;
        }
        self.sync(&self.parent)?;
        if self.anchor.stage == "preparing" {
            let mut a = self.anchor.clone();
            a.stage = "installed".into();
            self.replace(
                &self.parent,
                &self.anchor_name,
                &self.anchor_temp,
                &emit(&a)?,
            )?;
            self.anchor = a;
        }
        self.binding()?;
        self.initial()
    }
    fn binding(&self) -> Result<()> {
        if self.latched {
            return Err(Error::Unavailable);
        }
        let root = self
            .io
            .raw(raw::directory(Path::new(&self.grant.directory)))?;
        let lock = self.io.regular(&root, "writer.lock", libc::O_RDONLY)?;
        let materials = self.io.raw(raw::at(
            &root,
            b"materials",
            libc::O_RDONLY | libc::O_DIRECTORY,
            0,
        ))?;
        if identity(&root, &self.io)? != self.anchor.root
            || identity(&lock, &self.io)? != self.anchor.lock
            || identity(&materials, &self.io)? != self.anchor.materials
            || identity(&self.root, &self.io)? != self.anchor.root
            || identity(&self.lock, &self.io)? != self.anchor.lock
            || identity(&self.materials, &self.io)? != self.anchor.materials
        {
            return Err(Error::Unavailable);
        }
        let p = self.io.raw(raw::directory(
            Path::new(&self.grant.anchor)
                .parent()
                .ok_or(Error::Invalid)?,
        ))?;
        let a: Anchor = versioned_canonical(&self.io.read(&p, &self.anchor_name, LIMIT)?)?;
        if a != self.anchor {
            return Err(Error::Unavailable);
        }
        self.barriers()
    }
    fn inventory(&self) -> Result<(usize, u64, bool)> {
        let allowed = [
            "writer.lock",
            "materials",
            "trace.jsonl",
            "checkpoint.json",
            "incident.json",
            "checkpoint.tmp",
            "incident.tmp",
        ];
        if names(&self.root, 7, &self.io)?
            .iter()
            .any(|n| !allowed.contains(&n.as_str()))
        {
            return Err(Error::Unavailable);
        }
        let ns = names(&self.materials, 769, &self.io)?;
        let mut total = 0u64;
        let mut temp = false;
        for n in &ns {
            if n == "material.tmp" {
                temp = true
            } else if !n.strip_suffix(".txt").is_some_and(|h| hex(h, 64)) {
                return Err(Error::Unavailable);
            }
            let f = self.io.regular(&self.materials, n, libc::O_RDONLY)?;
            let bytes = self.io.syscall(f.metadata())?.len();
            if bytes > 65_536 {
                return Err(Error::Unavailable);
            }
            total += bytes;
        }
        if ns.len() > 768 || total > 16_777_216 {
            return Err(Error::Unavailable);
        }
        Ok((ns.len(), total, temp))
    }
    pub fn resolve(&self, r: &Material) -> Result<String> {
        if !r.valid() {
            return Err(Error::Invalid);
        }
        let b = self
            .io
            .read(&self.materials, &format!("{}.txt", r.sha256), 65_536)?;
        if Material::of(&b) != *r {
            return Err(Error::Unavailable);
        }
        let s = String::from_utf8(b).map_err(|_| Error::Unavailable)?;
        self.sync(&self.materials)?;
        Ok(s)
    }
    fn source(&self, r: &Material) -> Result<String> {
        if r.bytes > 4096 {
            return Err(Error::Unsupported);
        }
        self.resolve(r)
    }
    pub fn review(&self, r: &Request, previous: Option<&Record>) -> Result<Review> {
        if !r.mutation() {
            return Err(Error::Invalid);
        }
        let instruction_text = self.source(r.instruction.as_ref().ok_or(Error::Invalid)?)?;
        let i = r.replacement.as_ref().ok_or(Error::Invalid)?;
        let what_text = self.source(&i.what)?;
        let why_text = i.why.as_ref().map(|r| self.source(r)).transpose()?;
        if instruction_text.is_empty()
            || !what_text
                .chars()
                .any(|c| !matches!(c, ' ' | '\t' | '\r' | '\n'))
        {
            return Err(Error::Invalid);
        }
        let previous = previous
            .map(|p| {
                let i = p.input.replacement.as_ref().ok_or(Error::Unavailable)?;
                Ok(Previous {
                    fact: Fact::at(p.seq),
                    what_text: self.source(&i.what)?,
                    why_text: i.why.as_ref().map(|r| self.source(r)).transpose()?,
                })
            })
            .transpose()?;
        let v = Review {
            format: "ck-intent-review".into(),
            input: r.clone(),
            policy_text: self.resolve(&self.grant.policy)?,
            previous,
            instruction_text,
            what_text,
            why_text,
        };
        if v.policy_text != POLICY || emit(&v)?.len() > 65_536 {
            return Err(Error::Unsupported);
        }
        Ok(v)
    }
    fn grounds(&self, r: &Request, approval: &Material, previous: Option<&Record>) -> Result<()> {
        let receipt: Receipt = canonical(self.resolve(approval)?.as_bytes())?;
        let review = self.review(r, previous)?;
        if receipt.format != "ck-local-approval"
            || receipt.principal != "person-1"
            || receipt.subject_sha256 != hash(&emit(r)?)
            || receipt.decision != "adopt"
            || receipt.ui != "local-tui-exact"
            || self.resolve(&receipt.presentation)?.as_bytes() != emit(&review)?
        {
            return Err(Error::Unavailable);
        }
        Ok(())
    }
    fn prospective(&self, p: &Pending, records: &[Record]) -> Result<Record> {
        let n = records.len() as u64 + 1;
        if n > 128
            || !p.input.mutation()
            || (n == 1 && p.input.op != "open_intent")
            || (n > 1
                && (p.input.op != "revise_intent" || p.input.expected != Some(Fact::at(n - 1))))
            || records.iter().any(|r| r.input.key() == p.input.key())
        {
            return Err(Error::Unavailable);
        }
        self.grounds(&p.input, &p.approval, records.last())?;
        Ok(Record {
            version: V.into(),
            custody: "custody-1".into(),
            seq: n,
            prev: (n > 1).then(|| Fact::at(n - 1)),
            input: p.input.clone(),
            approval: p.approval.clone(),
        })
    }
    pub fn snapshot(&self) -> Result<Snapshot> {
        self.binding()?;
        let (_, _, material_temp) = self.inventory()?;
        if self.io.exists(&self.root, "incident.tmp")?
            || self.io.read(&self.root, "incident.json", LIMIT)? != clear_incident()
        {
            return Err(Error::Unavailable);
        }
        let prefix: Prefix = canonical(&self.io.read(&self.root, "checkpoint.json", LIMIT)?)?;
        let trace = self.io.read(&self.root, "trace.jsonl", 4_456_448)?;
        let g = prefix.generation;
        let e = prefix.end as usize;
        if prefix.format != "ck-ref-prefix"
            || prefix.custody != "custody-1"
            || g > 128
            || e > 4_194_304
            || e > trace.len()
            || (g == 0 && (e != 0 || prefix.sha256.is_some()))
            || (g > 0 && (e == 0 || prefix.sha256 != Some(hash(&trace[..e]))))
        {
            return Err(Error::Unavailable);
        }
        let mut records = Vec::new();
        let mut pos = 0;
        for line in trace[..e].split_inclusive(|b| *b == b'\n') {
            if records.len() == 128 {
                return Err(Error::Unavailable);
            }
            let r: Record = versioned_canonical(line)?;
            if r.version != V {
                return Err(Error::Unsupported);
            }
            let expected = self.prospective(
                &Pending {
                    input: r.input.clone(),
                    approval: r.approval.clone(),
                },
                &records,
            )?;
            if r != expected {
                return Err(Error::Unavailable);
            }
            pos += line.len();
            records.push(r);
        }
        if records.len() != g as usize || pos != e {
            return Err(Error::Unavailable);
        }
        self.resolve(&self.grant.policy)?;
        let mut readiness = Vec::new();
        let prospective = prefix
            .pending
            .as_ref()
            .map(|p| self.prospective(p, &records).and_then(|r| emit(&r)))
            .transpose()?;
        if let Some(b) = &prospective {
            if !b.starts_with(&trace[e..]) {
                return Err(Error::Unavailable);
            }
            readiness.push("blocked_pending".into());
        }
        let temp = if self.io.exists(&self.root, "checkpoint.tmp")? {
            let t: Prefix = canonical(&self.io.read(&self.root, "checkpoint.tmp", LIMIT)?)?;
            let mut known = t == prefix;
            if !known
                && prefix.pending.is_none()
                && e == trace.len()
                && t.generation == g
                && t.end == prefix.end
                && t.sha256 == prefix.sha256
                && t.format == prefix.format
                && t.custody == prefix.custody
            {
                if let Some(p) = &t.pending {
                    self.prospective(p, &records)?;
                    known = true;
                }
            }
            if !known {
                if let Some(b) = &prospective {
                    if trace[e..] == b[..] {
                        let expected = Prefix {
                            generation: g + 1,
                            end: trace.len() as u64,
                            sha256: Some(hash(&trace)),
                            pending: None,
                            ..prefix.clone()
                        };
                        known = t == expected;
                    }
                }
            }
            if !known {
                return Err(Error::Unavailable);
            }
            readiness.push("blocked_control_temp".into());
            Some(t)
        } else {
            None
        };
        if material_temp {
            readiness.push("blocked_material_temp".into());
        }
        if prefix.pending.is_none() && trace.len() > e {
            readiness.push("blocked_unaccepted_tail".into());
        }
        if self.io.exists(&self.parent, &self.anchor_temp)? {
            return Err(Error::Unavailable);
        }
        self.barriers()?;
        Ok(Snapshot {
            prefix,
            records,
            trace,
            temp,
            readiness,
        })
    }
    pub fn retain_agent(&mut self, text: &str, snapshot: &Snapshot) -> Result<Material> {
        self.io.phase.set("material");
        if text.len() > 4096 {
            self.validate_generated(text, snapshot)?;
            let r = Material::of(text.as_bytes());
            let (_, _, temp) = self.inventory()?;
            let present = self
                .io
                .exists(&self.materials, &format!("{}.txt", r.sha256))?;
            if temp {
                if self.io.read(&self.materials, "material.tmp", 65_536)? != text.as_bytes() {
                    return Err(Error::Unavailable);
                }
            } else if !present {
                return Err(Error::Unsupported);
            }
            if present && self.resolve(&r)?.as_bytes() != text.as_bytes() {
                return Err(Error::Unavailable);
            }
        }
        self.retain(text)
    }
    // Internal generation is not constrained by the external existing-material exception.
    pub fn retain(&mut self, text: &str) -> Result<Material> {
        self.io.phase.set("material");
        let r = Material::of(text.as_bytes());
        if text.len() > 65_536 {
            return Err(Error::Unsupported);
        }
        let (n, total, temp) = self.inventory()?;
        let name = format!("{}.txt", r.sha256);
        let present = self.io.exists(&self.materials, &name)?;
        if temp {
            let b = self.io.read(&self.materials, "material.tmp", 65_536)?;
            if b != text.as_bytes() {
                return Err(Error::Unavailable);
            }
            if present {
                if self.resolve(&r)?.as_bytes() != b {
                    return Err(Error::Unavailable);
                }
                self.remove(&self.materials, "material.tmp")?;
            } else {
                self.io.rename(&self.materials, "material.tmp", &name)?;
                self.sync(&self.materials)?;
            }
        } else if !present {
            if n == 768 || total + text.len() as u64 > 16_777_216 {
                return Err(Error::Unsupported);
            }
            self.create(&self.materials, "material.tmp", text.as_bytes())?;
            self.io.rename(&self.materials, "material.tmp", &name)?;
            self.sync(&self.materials)?;
        }
        self.resolve(&r)?;
        Ok(r)
    }
    pub fn reserve_commit(&mut self, s: &Snapshot, p: Pending, lease: &Lease) -> Result<Record> {
        let prospective = self.prospective(&p, &s.records)?;
        let bytes = emit(&prospective)?;
        if s.prefix.end + bytes.len() as u64 > 4_194_304 {
            return Err(Error::Unsupported);
        }
        if let Some(t) = &s.temp {
            if s.prefix.pending.is_none() && t.pending.as_ref() != Some(&p) {
                return Err(Error::Unavailable);
            }
            self.io.phase.set("recover");
            self.remove(&self.root, "checkpoint.tmp")?;
        }
        if s.prefix.pending.is_none() {
            self.io.phase.set("reserve");
            let pending = Prefix {
                pending: Some(p.clone()),
                ..s.prefix.clone()
            };
            self.replace(
                &self.root,
                "checkpoint.json",
                "checkpoint.tmp",
                &emit(&pending)?,
            )?;
        }
        let reserved = self.snapshot()?;
        if reserved.prefix.pending.as_ref() != Some(&p) {
            return Err(Error::Unavailable);
        }
        self.io.phase.set("append");
        let start = reserved.trace.len() - reserved.prefix.end as usize;
        if !bytes.starts_with(&reserved.trace[reserved.prefix.end as usize..]) {
            return Err(Error::Unavailable);
        }
        let mut f = self
            .io
            .regular(&self.root, "trace.jsonl", libc::O_WRONLY | libc::O_APPEND)?;
        let rest = &bytes[start..];
        if !rest.is_empty() {
            self.io.write(&mut f, "trace.jsonl", rest)?;
        }
        self.io.sync(&f, "trace.jsonl")?;
        self.sync(&self.root)?;
        let now = self.snapshot()?;
        let mut complete = s.trace[..s.prefix.end as usize].to_vec();
        complete.extend_from_slice(&bytes);
        if now.trace != complete || now.prefix.pending.as_ref() != Some(&p) {
            return Err(Error::Unavailable);
        }
        lease.check(true)?;
        self.grounds(&p.input, &p.approval, s.records.last())?;
        self.io.phase.set("checkpoint");
        let accepted = Prefix {
            generation: prospective.seq,
            end: complete.len() as u64,
            sha256: Some(hash(&complete)),
            pending: None,
            ..s.prefix.clone()
        };
        self.replace(
            &self.root,
            "checkpoint.json",
            "checkpoint.tmp",
            &emit(&accepted)?,
        )?;
        let final_state = self.snapshot()?;
        if final_state.prefix != accepted {
            return Err(Error::Unavailable);
        }
        Ok(prospective)
    }
    pub fn phase(&self, phase: &'static str) {
        self.io.phase.set(phase)
    }
    pub fn io_failed(&self) -> bool {
        self.io.observed.get()
    }
    pub fn quarantine(&mut self) {
        self.latched = true;
        self.io.observed.set(false);
    }
    pub fn finish_failure(&mut self) {
        self.latched = true;
        if !self.io.observed.replace(false) {
            return;
        }
        if self.io.exists(&self.root, "incident.tmp").unwrap_or(true) {
            return;
        }
        if self.io.exists(&self.root, "incident.json").unwrap_or(true)
            && self
                .io
                .read(&self.root, "incident.json", LIMIT)
                .ok()
                .as_deref()
                != Some(clear_incident())
        {
            return;
        }
        let phase = self.io.phase.get();
        let issue = self.io.issue.get();
        let b=format!("{{\"format\":\"ck-ref-incident\",\"custody\":\"custody-1\",\"state\":\"blocked\",\"phase\":\"{phase}\",\"issue\":\"{issue}\"}}\n");
        let _ = self.replace(&self.root, "incident.json", "incident.tmp", b.as_bytes());
    }
    pub fn preflight_materials(&self, texts: &[&str]) -> Result<()> {
        let (mut count, mut bytes, temp) = self.inventory()?;
        if temp {
            return Err(Error::Unavailable);
        }
        let mut unique = std::collections::BTreeSet::new();
        for text in texts {
            if text.len() > 65_536 {
                return Err(Error::Unsupported);
            }
            let r = Material::of(text.as_bytes());
            if unique.insert(r.sha256.clone())
                && !self
                    .io
                    .exists(&self.materials, &format!("{}.txt", r.sha256))?
            {
                count += 1;
                bytes += r.bytes;
            }
        }
        if count > 768 || bytes > 16_777_216 {
            return Err(Error::Unsupported);
        }
        Ok(())
    }
    pub fn policy(&self) -> Material {
        self.grant.policy.clone()
    }
    pub fn original_presentation(&self, p: &Pending) -> Result<String> {
        let receipt: Receipt = canonical(self.resolve(&p.approval)?.as_bytes())?;
        self.resolve(&receipt.presentation)
    }
}
