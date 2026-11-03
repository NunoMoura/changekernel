#!/usr/bin/python3
"""Controlled Linux native preparation/checks. No downloads, pkg-config or OS installs."""
import argparse
import hashlib
import json
import os
import platform
import subprocess
import sys
import tempfile
import tomllib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = "sqlite-amalgamation-3540100.zip"
SIZE = 2990966
SHA3 = "92281c86e2957f9b9305890f9ac04204caa7b677cc868dc326d942689df28e30"
SOURCE_ID = "2026-10-16 14:45:20 555e07ef33f69a0957d24d8e555b702464a131d6f1607f4c3c1e4551e8e6ca76"
# Exact reviewed dependency closure, not a license approval for later lock changes.
LOCK_SHA256 = "5838182c6bd96d83e01657af06af6499f22103b1c101ac2dfdb320f3ba12b53e"
FLAGS = ["-O2", "-fPIC", "-std=c11", "-D_POSIX_C_SOURCE=200809L",
         "-DSQLITE_THREADSAFE=1", "-DSQLITE_OMIT_LOAD_EXTENSION", "-DSQLITE_DQS=0"]
OVERRIDES = ["RUSTFLAGS", "CARGO_ENCODED_RUSTFLAGS", "LIBRARY_PATH", "LD_LIBRARY_PATH",
             "LD_PRELOAD", "CPATH", "C_INCLUDE_PATH", "CPLUS_INCLUDE_PATH", "CFLAGS",
             "CPPFLAGS", "LDFLAGS", "LIBSQLITE3_FLAGS", "CC", "AR"]
FEATURES = {
    "rusqlite": ["backup", "limits"],
    # rusqlite's nonoptional sys edge enables these defaults. pkg-config is disabled
    # by SQLITE3_NO_PKG_CONFIG, vcpkg cannot run on this native Linux profile.
    "libsqlite3-sys": ["default", "min_sqlite_version_3_45_3", "pkg-config", "vcpkg"],
    "prost": ["derive", "std"],
    "serde": ["derive", "serde_derive", "std"],
    "serde_json": ["std"],
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def run(args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, text=True,
                          capture_output=True, **kwargs).stdout


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean_environment():
    require(platform.system() == "Linux", "only the native Linux build profile is supported")
    for key in OVERRIDES:
        require(not os.environ.get(key), f"ambient build override refused: {key}")
    # A trusted local compiler is a prerequisite, not an authenticated toolchain claim.
    env = dict(os.environ, PATH="/usr/bin:/bin", LC_ALL="C", SOURCE_DATE_EPOCH="0")
    for key in ["GCC_EXEC_PREFIX", "COMPILER_PATH", "DEPENDENCIES_OUTPUT"]:
        require(not env.get(key), f"ambient compiler override refused: {key}")
    return env


def stage_path(value):
    stage = Path(value).resolve(strict=True)
    require(stage != ROOT and ROOT not in stage.parents, "native staging must be outside the source tree")
    return stage


def source(stage):
    archive = stage / ARCHIVE
    data = archive.read_bytes()
    require(len(data) == SIZE and hashlib.sha3_256(data).hexdigest() == SHA3,
            "official SQLite archive size/SHA3-256 mismatch")
    with zipfile.ZipFile(archive) as z:
        for name in ["sqlite3.c", "sqlite3.h", "sqlite3ext.h"]:
            expected = z.read("sqlite-amalgamation-3540100/" + name)
            require((stage / "source" / name).read_bytes() == expected,
                    f"staged source differs from verified archive: {name}")
    header = (stage / "source/sqlite3.h").read_text()
    require('#define SQLITE_VERSION        "3.54.1"' in header
            and f'#define SQLITE_SOURCE_ID      "{SOURCE_ID}"' in header,
            "wrong SQLite header identity")
    return {name: sha(stage / "source" / name)
            for name in ["sqlite3.c", "sqlite3.h", "sqlite3ext.h"]}


def compile_library(stage, destination, env):
    run(["/usr/bin/cc", *FLAGS, "-I", stage / "source", "-c",
         stage / "source/sqlite3.c", "-o", destination / "sqlite3.o"], env=env)
    run(["/usr/bin/ar", "rcsD", destination / "libsqlite3.a", destination / "sqlite3.o"], env=env)
    require(run(["/usr/bin/ar", "t", destination / "libsqlite3.a"], env=env) == "sqlite3.o\n",
            "unexpected static archive members")


def probe(stage, library, temporary, env):
    # A real executable bound to the absolute static archive, not a manifest label.
    c = temporary / "probe.c"
    c.write_text('''#include <stdio.h>
#include "sqlite3.h"
int main(void) {
  printf("%d\\n%s\\n%s\\n%d\\n", sqlite3_libversion_number(),
    sqlite3_libversion(), sqlite3_sourceid(), sqlite3_threadsafe());
  for (int i=0; sqlite3_compileoption_get(i); ++i)
    puts(sqlite3_compileoption_get(i));
  return 0;
}
''')
    executable = temporary / "probe"
    run(["/usr/bin/cc", "-I", stage / "source", c, library, "-pthread", "-lm", "-o", executable], env=env)
    dynamic = run(["/usr/bin/readelf", "-d", executable], env=env)
    require("libsqlite" not in dynamic.lower(), "dynamic SQLite dependency refused")
    lines = run([executable], env=env).splitlines()
    require(lines[:4] == ["3054001", "3.54.1", SOURCE_ID, "1"], "wrong linked runtime identity/thread safety")
    options = sorted(lines[4:])
    require({"THREADSAFE=1", "DQS=0", "OMIT_LOAD_EXTENSION"}.issubset(options)
            and "ENABLE_LOAD_EXTENSION" not in options, "wrong SQLite compile options")
    # The exact numeric strings were compared above; do not default/parse unknown output.
    return {"version_number": 3054001, "version": lines[1], "source_id": lines[2],
            "threadsafe": 1, "compile_options": options}


def build(stage):
    env = clean_environment()
    sources = source(stage)
    destination = stage / "controlled"
    destination.mkdir(exist_ok=True)
    # Rebuilding never silently repairs a previously verified subject: it is explicit.
    (destination / "libsqlite3.a").unlink(missing_ok=True)
    compile_library(stage, destination, env)
    profile = probe(stage, destination / "libsqlite3.a", destination, env)
    report = {"archive_sha3_256": SHA3, "source_sha256": sources, "flags": FLAGS,
              "cc_sha256": sha(Path("/usr/bin/cc").resolve()),
              "ar_sha256": sha(Path("/usr/bin/ar").resolve()),
              "library_sha256": sha(destination / "libsqlite3.a"), "runtime": profile}
    (destination / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def verify(stage):
    env = clean_environment()
    sources = source(stage)
    destination = stage / "controlled"
    try:
        report = json.loads((destination / "verification.json").read_text())
    except (OSError, ValueError) as error:
        raise ValueError("missing/invalid native verification report") from error
    require(report["archive_sha3_256"] == SHA3 and report["source_sha256"] == sources
            and report["flags"] == FLAGS, "native report source/flags mismatch")
    require(report["cc_sha256"] == sha(Path("/usr/bin/cc").resolve())
            and report["ar_sha256"] == sha(Path("/usr/bin/ar").resolve()), "native tools changed; explicitly rebuild")
    # Independently reproduce the archive. A caller-provided report/checksum is not proof.
    with tempfile.TemporaryDirectory(prefix="verify-", dir=stage) as temporary:
        temporary = Path(temporary)
        compile_library(stage, temporary, env)
        require(sha(temporary / "libsqlite3.a") == sha(destination / "libsqlite3.a")
                == report["library_sha256"], "static archive does not reproduce from verified source")
        require(probe(stage, destination / "libsqlite3.a", temporary, env) == report["runtime"],
                "linked runtime differs from verified native build")
    return report


def check_lock():
    require(sha(ROOT / "Cargo.lock") == LOCK_SHA256, "dependency lock changed; review lock/licenses before building")
    manifest = tomllib.loads((ROOT / "Cargo.toml").read_text())
    require(manifest["package"]["edition"] == "2021"
            and manifest["package"]["rust-version"] == "1.99.1", "unsupported Rust package profile")
    require(manifest["dependencies"] == {
        "rusqlite": {"version": "=0.41.0", "default-features": False, "features": ["backup", "limits"]},
        "libsqlite3-sys": {"version": "=0.39.0", "default-features": False},
        "prost": {"version": "=0.14.4", "default-features": False, "features": ["derive", "std"]},
        "serde": {"version": "=1.0.229", "default-features": False, "features": ["std", "derive"]},
        "serde_json": {"version": "=1.0.154", "default-features": False, "features": ["std"]},
    }, "unreviewed direct dependencies/features")


def cargo_environment(stage):
    require(os.environ.get("CARGO_HOME") and os.environ.get("CARGO_TARGET_DIR"),
            "explicit isolated CARGO_HOME and CARGO_TARGET_DIR are required")
    for key in ["CARGO_HOME", "CARGO_TARGET_DIR"]:
        path = Path(os.environ[key]).resolve()
        require(path != ROOT and ROOT not in path.parents, f"{key} must be external")
    return dict(os.environ, CHANGEKERNEL_SQLITE_STAGE=str(stage),
                SQLITE3_LIB_DIR=str(stage / "controlled"), SQLITE3_INCLUDE_DIR=str(stage / "source"),
                SQLITE3_STATIC="1", SQLITE3_NO_PKG_CONFIG="1", LIBSQLITE3_SYS_USE_PKG_CONFIG="0",
                CARGO_NET_OFFLINE="true")


def guard(stage):
    check_lock()
    expected = cargo_environment(stage)
    for key in ["CHANGEKERNEL_SQLITE_STAGE", "SQLITE3_LIB_DIR", "SQLITE3_INCLUDE_DIR",
                "SQLITE3_STATIC", "SQLITE3_NO_PKG_CONFIG", "LIBSQLITE3_SYS_USE_PKG_CONFIG", "CARGO_NET_OFFLINE"]:
        require(os.environ.get(key) == expected[key], f"missing/wrong controlled build variable: {key}")
    require(os.environ.get("HOST") == os.environ.get("TARGET")
            and "linux" in os.environ.get("TARGET", ""), "only native Linux targets are supported")
    require(os.environ.get("DEP_SQLITE3_LINK_TARGET") == "sqlite3"
            and not os.environ.get("DEP_SQLITE3_LIB_DIR")
            and not os.environ.get("DEP_SQLITE3_INCLUDE"), "unexpected sys linkage/bundled profile")
    return verify(stage)


def audit_dependencies(env):
    check_lock()
    try:
        metadata = json.loads(run(["rustup", "run", "1.99.1", "cargo", "metadata", "--frozen", "--format-version", "1"], cwd=ROOT, env=env))
    except ValueError as error:
        raise ValueError("invalid Cargo metadata") from error
    nodes = {node["id"]: node for node in metadata["resolve"]["nodes"]}
    for package in metadata["packages"]:
        if package["name"] == "changekernel":
            continue
        require(package["source"] == "registry+https://github.com/rust-lang/crates.io-index", "non-registry dependency")
        require(package["license"] in ["MIT", "Apache-2.0", "MIT OR Apache-2.0", "MIT/Apache-2.0", "(MIT OR Apache-2.0) AND Unicode-3.0"]
                or (package["name"], package["version"], package["license"])
                == ("memchr", "2.8.3", "Unlicense OR MIT"),
                f"unreviewed license: {package['name']}")
        if package["name"] in FEATURES:
            require(nodes[package["id"]]["features"] == FEATURES[package["name"]], "unapproved direct dependency features")
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["build", "verify", "guard", "cargo"])
    parser.add_argument("stage")
    parser.add_argument("cargo_args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    stage = stage_path(args.stage)
    if args.action == "build":
        print(json.dumps(build(stage), indent=2))
    elif args.action == "verify":
        check_lock()
        print(json.dumps(verify(stage), indent=2))
    elif args.action == "guard":
        report = guard(stage)
        options = ", ".join(json.dumps(s) for s in report["runtime"]["compile_options"])
        print(f"pub const VERIFIED_OPTIONS: &[&str] = &[{options}];")
        print(f'pub const VERIFIED_STATIC_ARCHIVE_SHA256: &str = "{report["library_sha256"]}";')
    else:
        # Intentionally bounded commands: no feature, target, config or linker overrides.
        allowed = [["fmt", "--check"], ["clippy", "--locked", "--all-targets", "--", "-D", "warnings"],
                   ["test", "--locked"], ["test", "--locked", "--test", "native_profile"]]
        require(args.cargo_args in allowed, "unsupported controlled Cargo command")
        clean_environment()
        env = cargo_environment(stage)
        audit_dependencies(env)
        result = subprocess.run(["rustup", "run", "1.99.1", "cargo", *args.cargo_args], check=False, cwd=ROOT, env=env)
        sys.exit(result.returncode)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        print(f"controlled SQLite profile refused: {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError):
            print(error.stderr, file=sys.stderr)
        sys.exit(1)
