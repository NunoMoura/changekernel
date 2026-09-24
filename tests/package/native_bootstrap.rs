use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static NEXT_DIR: AtomicUsize = AtomicUsize::new(0);

struct ExternalFixture(PathBuf);

impl ExternalFixture {
    fn new() -> Self {
        let base = std::env::temp_dir();
        for _ in 0..100 {
            let unique = format!(
                "changekernel-native-bootstrap-{}-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                NEXT_DIR.fetch_add(1, Ordering::Relaxed),
            );
            let root = base.join(unique);
            match fs::create_dir(&root) {
                Ok(()) => {
                    fs::create_dir(root.join("src")).unwrap();
                    fs::create_dir(root.join(".changekernel")).unwrap();
                    fs::write(root.join("src/app.txt"), b"application source").unwrap();
                    fs::write(
                        root.join(".changekernel/storage.db"),
                        b"application storage",
                    )
                    .unwrap();
                    return Self(root);
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => panic!("cannot create external fixture: {error}"),
            }
        }
        panic!("could not reserve external fixture directory");
    }

    fn snapshot(&self) -> BTreeMap<PathBuf, Option<Vec<u8>>> {
        fn visit(root: &Path, dir: &Path, entries: &mut BTreeMap<PathBuf, Option<Vec<u8>>>) {
            for entry in fs::read_dir(dir).unwrap() {
                let entry = entry.unwrap();
                let path = entry.path();
                let relative = path.strip_prefix(root).unwrap().to_path_buf();
                if entry.file_type().unwrap().is_dir() {
                    entries.insert(relative, None);
                    visit(root, &path, entries);
                } else {
                    entries.insert(relative, Some(fs::read(path).unwrap()));
                }
            }
        }
        let mut entries = BTreeMap::new();
        visit(&self.0, &self.0, &mut entries);
        entries
    }
}

impl Drop for ExternalFixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

#[test]
fn launcher_is_bounded_and_never_mutates_application_files() {
    let fixture = ExternalFixture::new();
    let before = fixture.snapshot();
    let binary = env!("CARGO_BIN_EXE_changekernel");
    for (args, success, stdout, stderr) in [
        (vec![], true, "Usage: changekernel [--help|--version]\nUnqualified bootstrap; no host or worker is available.\n".to_owned(), ""),
        (vec!["--help"], true, "Usage: changekernel [--help|--version]\nUnqualified bootstrap; no host or worker is available.\n".to_owned(), ""),
        (vec!["--version"], true, format!("changekernel {}\n", changekernel::VERSION), ""),
        (vec!["start"], false, "".to_owned(), "Unsupported arguments; run changekernel --help for usage.\n"),
        (vec!["--help", "--version"], false, "".to_owned(), "Unsupported arguments; run changekernel --help for usage.\n"),
        (vec!["--version", "start"], false, "".to_owned(), "Unsupported arguments; run changekernel --help for usage.\n"),
        (vec!["--help", "--help"], false, "".to_owned(), "Unsupported arguments; run changekernel --help for usage.\n"),
    ] {
        let output = Command::new(binary).args(&args).current_dir(&fixture.0).output().unwrap();
        assert_eq!(output.status.success(), success, "{args:?}");
        assert_eq!(String::from_utf8(output.stdout).unwrap(), stdout, "{args:?}");
        assert_eq!(String::from_utf8(output.stderr).unwrap(), stderr, "{args:?}");
        assert_eq!(fixture.snapshot(), before, "{args:?} changed application files");
    }
}
