//! B0 native profile checks; not storage, host or power-loss qualification.
use changekernel::adapters::native_profile::{self, NativeProfileError};

#[test]
fn selected_runtime_is_exact_and_rejects_modified_profile_evidence() {
    let profile = native_profile::verify_runtime().unwrap();
    profile.validate().unwrap();
    let mut wrong = profile.clone();
    wrong.version_number -= 1;
    assert_eq!(wrong.validate(), Err(NativeProfileError::Version));
    let mut wrong = profile.clone();
    wrong.version.push('x');
    assert_eq!(wrong.validate(), Err(NativeProfileError::Version));
    let mut wrong = profile.clone();
    wrong.source_id.push('x');
    assert_eq!(wrong.validate(), Err(NativeProfileError::Source));
    let mut wrong = profile.clone();
    wrong.threadsafe = 0;
    assert_eq!(wrong.validate(), Err(NativeProfileError::ThreadSafety));
    for option in ["DQS=0", "OMIT_LOAD_EXTENSION", "THREADSAFE=1"] {
        let mut wrong = profile.clone();
        wrong.compile_options.remove(option);
        assert_eq!(wrong.validate(), Err(NativeProfileError::CompileOptions));
    }
    let mut wrong = profile;
    wrong.compile_options.insert("ENABLE_LOAD_EXTENSION".into());
    assert_eq!(wrong.validate(), Err(NativeProfileError::CompileOptions));
}

#[test]
fn double_quoted_literals_and_extension_loading_are_actually_disabled() {
    native_profile::verify_runtime().unwrap();
    let connection = rusqlite::Connection::open_in_memory().unwrap();
    let error = connection
        .query_row("SELECT \"not_a_column\"", [], |row| row.get::<_, String>(0))
        .unwrap_err();
    assert!(error.to_string().contains("no such column"), "{error}");
    let error = connection
        .query_row("SELECT load_extension('does_not_exist')", [], |_| Ok(()))
        .unwrap_err();
    assert!(error.to_string().contains("no such function"), "{error}");
    assert_eq!(
        connection
            .query_row("SELECT 'literal'", [], |row| row.get::<_, String>(0))
            .unwrap(),
        "literal"
    );
}

#[test]
fn selected_backup_and_limits_apis_work_against_the_linked_engine() {
    use rusqlite::backup::Backup;
    use rusqlite::limits::Limit;
    use rusqlite::Connection;
    native_profile::verify_runtime().unwrap();
    let source = Connection::open_in_memory().unwrap();
    source
        .execute_batch("CREATE TABLE subject(value TEXT); INSERT INTO subject VALUES ('original')")
        .unwrap();
    let mut destination = Connection::open_in_memory().unwrap();
    {
        let backup = Backup::new(&source, &mut destination).unwrap();
        backup
            .run_to_completion(8, std::time::Duration::ZERO, None)
            .unwrap();
    }
    assert_eq!(
        destination
            .query_row("SELECT value FROM subject", [], |row| row
                .get::<_, String>(0))
            .unwrap(),
        "original"
    );
    destination
        .set_limit(Limit::SQLITE_LIMIT_LENGTH, 1024)
        .unwrap();
    assert_eq!(destination.limit(Limit::SQLITE_LIMIT_LENGTH).unwrap(), 1024);
    assert!(destination
        .query_row("SELECT zeroblob(1025)", [], |row| row.get::<_, Vec<u8>>(0))
        .is_err());
}

fn external_test_dir(label: &str) -> std::path::PathBuf {
    static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let directory = std::path::Path::new(env!("CHANGEKERNEL_SQLITE_STAGE")).join(format!(
        "boundary-{label}-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    ));
    std::fs::create_dir(&directory).unwrap();
    directory
}

#[test]
fn build_guard_refuses_missing_wrong_and_fallback_profiles() {
    use std::path::Path;
    use std::process::Command;
    let directory = external_test_dir("guard");
    let executable = directory.join("guard");
    let compiled = Command::new("rustup")
        .args(["run", "1.99.1", "rustc", "--edition=2021", "build.rs", "-o"])
        .arg(&executable)
        .output()
        .unwrap();
    assert!(
        compiled.status.success(),
        "{}",
        String::from_utf8_lossy(&compiled.stderr)
    );
    let rustc = Command::new("rustup")
        .args(["which", "--toolchain", "1.99.1", "rustc"])
        .output()
        .unwrap();
    assert!(rustc.status.success());
    let rustc = String::from_utf8(rustc.stdout).unwrap();
    let stage = Path::new(env!("CHANGEKERNEL_SQLITE_STAGE"));
    let missing = Command::new(&executable)
        .env_remove("CHANGEKERNEL_SQLITE_STAGE")
        .output()
        .unwrap();
    assert!(!missing.status.success());
    assert!(String::from_utf8_lossy(&missing.stderr).contains("controlled SQLite profile missing"));
    for (key, value, expected) in [
        (
            "CHANGEKERNEL_SQLITE_STAGE",
            "/no/such/native-stage",
            "No such file",
        ),
        ("SQLITE3_LIB_DIR", "/usr/lib", "SQLITE3_LIB_DIR"),
        ("SQLITE3_INCLUDE_DIR", "/usr/include", "SQLITE3_INCLUDE_DIR"),
        ("SQLITE3_STATIC", "0", "SQLITE3_STATIC"),
        ("SQLITE3_NO_PKG_CONFIG", "0", "SQLITE3_NO_PKG_CONFIG"),
        (
            "LIBSQLITE3_SYS_USE_PKG_CONFIG",
            "1",
            "LIBSQLITE3_SYS_USE_PKG_CONFIG",
        ),
        ("CARGO_NET_OFFLINE", "false", "CARGO_NET_OFFLINE"),
        ("CFLAGS", "-DSQLITE_THREADSAFE=0", "ambient build override"),
        (
            "DEP_SQLITE3_LIB_DIR",
            "/bundled-sqlite",
            "sys linkage/bundled",
        ),
        ("TARGET", "x86_64-pc-windows-msvc", "only native Linux"),
    ] {
        let out = directory.join(key);
        std::fs::create_dir(&out).unwrap();
        let result = Command::new(&executable)
            .env("CHANGEKERNEL_SQLITE_STAGE", stage)
            .env("SQLITE3_LIB_DIR", stage.join("controlled"))
            .env("SQLITE3_INCLUDE_DIR", stage.join("source"))
            .env("SQLITE3_STATIC", "1")
            .env("SQLITE3_NO_PKG_CONFIG", "1")
            .env("LIBSQLITE3_SYS_USE_PKG_CONFIG", "0")
            .env("CARGO_NET_OFFLINE", "true")
            .env("HOST", "x86_64-unknown-linux-gnu")
            .env("TARGET", "x86_64-unknown-linux-gnu")
            .env("DEP_SQLITE3_LINK_TARGET", "sqlite3")
            .env_remove("DEP_SQLITE3_LIB_DIR")
            .env_remove("DEP_SQLITE3_INCLUDE")
            .env("RUSTC", rustc.trim())
            .env("OUT_DIR", &out)
            .env(key, value)
            .output()
            .unwrap();
        assert!(!result.status.success(), "accepted override {key}");
        assert!(
            String::from_utf8_lossy(&result.stderr).contains(expected),
            "{key}: {}",
            String::from_utf8_lossy(&result.stderr)
        );
        assert!(!out.join("native_expected.rs").exists());
    }
}

#[test]
fn altered_native_bytes_cannot_be_authorized_by_relabeling_the_checksum_report() {
    use std::fs;
    use std::path::Path;
    use std::process::Command;
    let original = Path::new(env!("CHANGEKERNEL_SQLITE_STAGE"));
    let copy = external_test_dir("tampered");
    fs::create_dir(copy.join("source")).unwrap();
    fs::create_dir(copy.join("controlled")).unwrap();
    for file in [
        "sqlite-amalgamation-3540100.zip",
        "source/sqlite3.c",
        "source/sqlite3.h",
        "source/sqlite3ext.h",
        "controlled/libsqlite3.a",
        "controlled/verification.json",
    ] {
        fs::copy(original.join(file), copy.join(file)).unwrap();
    }
    let verify = || {
        Command::new("/usr/bin/python3")
            .args(["scripts/native_sqlite.py", "verify"])
            .arg(&copy)
            .env_remove("LD_LIBRARY_PATH")
            .output()
            .unwrap()
    };
    fs::write(copy.join("source/sqlite3.h"), b"substitute header").unwrap();
    let denied = verify();
    assert!(!denied.status.success());
    assert!(String::from_utf8_lossy(&denied.stderr).contains("differs from verified archive"));
    fs::copy(
        original.join("source/sqlite3.h"),
        copy.join("source/sqlite3.h"),
    )
    .unwrap();
    // Forge both the archive and its supplied report hash; independent recompilation must
    // reject this. The original staging subject is never changed by the test.
    let substituted = Command::new("/usr/bin/python3").arg("-c").arg(
        "import pathlib,hashlib,json,sys; p=pathlib.Path(sys.argv[1]); a=p/'controlled/libsqlite3.a'; a.write_bytes(b'not the selected static archive'); r=p/'controlled/verification.json'; v=json.loads(r.read_text()); v['library_sha256']=hashlib.sha256(a.read_bytes()).hexdigest(); r.write_text(json.dumps(v))"
    ).arg(&copy).output().unwrap();
    assert!(substituted.status.success());
    let denied = verify();
    assert!(!denied.status.success());
    assert!(
        String::from_utf8_lossy(&denied.stderr).contains("does not reproduce"),
        "{}",
        String::from_utf8_lossy(&denied.stderr)
    );
}

#[test]
fn actual_test_executable_contains_sqlite_without_a_dynamic_sqlite_dependency() {
    use std::process::Command;
    native_profile::verify_runtime().unwrap();
    let executable = std::env::current_exe().unwrap();
    let dynamic = Command::new("/usr/bin/readelf")
        .arg("-d")
        .arg(&executable)
        .output()
        .unwrap();
    assert!(dynamic.status.success());
    assert!(!String::from_utf8_lossy(&dynamic.stdout)
        .to_ascii_lowercase()
        .contains("libsqlite"));
    let symbols = Command::new("/usr/bin/nm")
        .args(["-g", "--defined-only"])
        .arg(executable)
        .output()
        .unwrap();
    assert!(symbols.status.success());
    assert!(String::from_utf8_lossy(&symbols.stdout).contains(" T sqlite3_sourceid"));
}

#[test]
fn controlled_sys_build_does_not_execute_pkg_config_even_with_an_explicit_library_path() {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::path::Path;
    use std::process::Command;
    let directory = external_test_dir("pkgconfig");
    let marker = directory.join("ambient-probe-was-invoked");
    let spy = directory.join("pkg-config");
    fs::write(
        &spy,
        format!("#!/bin/sh\ntouch '{}'\nexit 1\n", marker.display()),
    )
    .unwrap();
    fs::set_permissions(&spy, fs::Permissions::from_mode(0o700)).unwrap();
    let target = Path::new(env!("CARGO_TARGET_DIR"));
    let sys_build = fs::read_dir(target.join("debug/build"))
        .unwrap()
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .find(|path| {
            path.file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("libsqlite3-sys-")
                && path.join("build-script-build").is_file()
        })
        .unwrap()
        .join("build-script-build");
    let sys_source = fs::read_dir(Path::new(env!("CARGO_HOME")).join("registry/src"))
        .unwrap()
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path().join("libsqlite3-sys-0.39.0"))
        .find(|path| path.join("build.rs").is_file())
        .unwrap();
    let stage = Path::new(env!("CHANGEKERNEL_SQLITE_STAGE"));
    let result = Command::new(sys_build)
        .current_dir(sys_source)
        .env("OUT_DIR", &directory)
        .env("SQLITE3_LIB_DIR", stage.join("controlled"))
        .env("SQLITE3_INCLUDE_DIR", stage.join("source"))
        .env("SQLITE3_STATIC", "1")
        .env("SQLITE3_NO_PKG_CONFIG", "1")
        .env("LIBSQLITE3_SYS_USE_PKG_CONFIG", "0")
        .env("PKG_CONFIG", spy)
        .env("HOST", "x86_64-unknown-linux-gnu")
        .env("TARGET", "x86_64-unknown-linux-gnu")
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(!marker.exists(), "ambient pkg-config was invoked");
    let output = String::from_utf8(result.stdout).unwrap();
    assert!(output.contains("cargo:rustc-link-lib=static=sqlite3"));
    assert!(output.contains(&format!(
        "cargo:rustc-link-search={}",
        stage.join("controlled").display()
    )));
    assert!(directory.join("bindgen.rs").is_file());
}
