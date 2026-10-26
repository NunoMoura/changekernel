//! Refuse ambient SQLite even when Cargo is invoked without the preparation helper.
use std::{env, fs, path::PathBuf, process::Command};

fn main() {
    for key in [
        "CHANGEKERNEL_SQLITE_STAGE",
        "SQLITE3_LIB_DIR",
        "SQLITE3_INCLUDE_DIR",
        "SQLITE3_STATIC",
        "SQLITE3_NO_PKG_CONFIG",
        "LIBSQLITE3_SYS_USE_PKG_CONFIG",
        "CARGO_NET_OFFLINE",
        "RUSTFLAGS",
        "CARGO_ENCODED_RUSTFLAGS",
        "LIBRARY_PATH",
        "LD_LIBRARY_PATH",
        "LD_PRELOAD",
        "CPATH",
        "C_INCLUDE_PATH",
        "CPLUS_INCLUDE_PATH",
        "CFLAGS",
        "CPPFLAGS",
        "LDFLAGS",
        "LIBSQLITE3_FLAGS",
        "CC",
        "AR",
        "GCC_EXEC_PREFIX",
        "COMPILER_PATH",
        "DEPENDENCIES_OUTPUT",
        "CARGO_HOME",
        "CARGO_TARGET_DIR",
    ] {
        println!("cargo:rerun-if-env-changed={key}");
    }
    for file in [
        "scripts/native_sqlite.py",
        "Cargo.toml",
        "Cargo.lock",
        "rust-toolchain.toml",
        "/usr/bin/cc",
        "/usr/bin/ar",
    ] {
        println!("cargo:rerun-if-changed={file}");
    }
    let stage = PathBuf::from(env::var_os("CHANGEKERNEL_SQLITE_STAGE").expect(
        "controlled SQLite profile missing; use scripts/native_sqlite.py (no ambient fallback)",
    ));
    for file in [
        "sqlite-amalgamation-3540100.zip",
        "source/sqlite3.c",
        "source/sqlite3.h",
        "source/sqlite3ext.h",
        "controlled/libsqlite3.a",
        "controlled/verification.json",
    ] {
        println!("cargo:rerun-if-changed={}", stage.join(file).display());
    }
    let rustc = Command::new(env::var_os("RUSTC").expect("Cargo must supply RUSTC"))
        .arg("--version")
        .output()
        .expect("cannot verify Rust compiler");
    assert!(
        rustc.status.success()
            && String::from_utf8_lossy(&rustc.stdout).starts_with("rustc 1.99.1 "),
        "Rust 1.99.1 is required"
    );
    let output = Command::new("/usr/bin/python3")
        .arg("scripts/native_sqlite.py")
        .arg("guard")
        .arg(&stage)
        // Cargo injects a dynamic search path for its tools. Do not pass it to the
        // native verifier; its SQLite input is the absolute verified static archive.
        .env_remove("LD_LIBRARY_PATH")
        .output()
        .expect("cannot execute controlled native verification");
    assert!(
        output.status.success(),
        "controlled SQLite profile refused:\n{}",
        String::from_utf8_lossy(&output.stderr)
    );
    fs::write(
        PathBuf::from(env::var_os("OUT_DIR").expect("Cargo must supply OUT_DIR"))
            .join("native_expected.rs"),
        output.stdout,
    )
    .expect("cannot retain verified native profile");
    // sys emits static=sqlite3 with the checked explicit search path. SQLite also needs libm.
    println!("cargo:rustc-link-lib=m");
}
