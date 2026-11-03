"""Dependency-only guard failure tests. No Cargo, compiler, native call or filesystem writes.

Run only in a manager-authorized check environment: python3 -B tests/native_dependency_guard.py.
"""
import importlib.util
import json
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("native_dependency_guard", ROOT / "scripts/native_sqlite.py")
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("native dependency guard module requires a spec and loader")
GUARD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GUARD)


class Blob:
    def __init__(self, data):
        self.data = data

    def read_bytes(self):
        return self.data

    def read_text(self):
        return self.data.decode("utf-8")


class MemoryRoot:
    def __init__(self, manifest, lock):
        self.files = {"Cargo.toml": Blob(manifest), "Cargo.lock": Blob(lock)}

    def __truediv__(self, name):
        return self.files[name]


class DependencyGuardTests(unittest.TestCase):
    def setUp(self):
        self.manifest = (ROOT / "Cargo.toml").read_bytes()
        self.lock = (ROOT / "Cargo.lock").read_bytes()
        self.root = MemoryRoot(self.manifest, self.lock)
        self.root_patch = mock.patch.object(GUARD, "ROOT", self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)

    def metadata(self):
        packages = []
        nodes = []
        for name, features in GUARD.FEATURES.items():
            identifier = f"registry#{name}@fixture"
            packages.append({"id": identifier, "name": name, "version": "fixture",
                             "source": "registry+https://github.com/rust-lang/crates.io-index",
                             "license": "MIT OR Apache-2.0"})
            nodes.append({"id": identifier, "features": features.copy()})
        for name, version, license_name in [("memchr", "2.8.3", "Unlicense OR MIT"),
                                             ("syn", "2.0.119", "MIT OR Apache-2.0"),
                                             ("syn", "3.0.9", "MIT OR Apache-2.0")]:
            identifier = f"registry#{name}@{version}"
            packages.append({"id": identifier, "name": name, "version": version,
                             "source": "registry+https://github.com/rust-lang/crates.io-index",
                             "license": license_name})
            nodes.append({"id": identifier, "features": []})
        return {"packages": packages, "resolve": {"nodes": nodes}}

    def audit(self, metadata):
        with mock.patch.object(GUARD, "run", return_value=json.dumps(metadata)) as command:
            result = GUARD.audit_dependencies({})
            self.assertEqual(command.call_count, 1)
            self.assertIn("--frozen", command.call_args.args[0])
            return result

    def test_reviewed_manifest_lock_and_exact_license_exception_pass(self):
        GUARD.check_lock()
        metadata = self.metadata()
        self.assertEqual(self.audit(metadata), metadata)

    def test_lock_mutation_refuses_before_any_metadata_command(self):
        self.root.files["Cargo.lock"] = Blob(self.lock + b"\n")
        with mock.patch.object(GUARD, "run", side_effect=AssertionError("must not invoke Cargo")) as command:
            with self.assertRaisesRegex(ValueError, "dependency lock changed"):
                GUARD.audit_dependencies({})
            command.assert_not_called()

    def test_manifest_changes_cannot_enable_unreviewed_features_defaults_or_versions(self):
        for before, after in [
            (b'features = ["std", "derive"]', b'features = ["std", "derive", "rc"]'),
            (b'version = "=1.0.154", default-features = false', b'version = "=1.0.154", default-features = true'),
            (b'version = "=1.0.229"', b'version = "=1.0.230"'),
            (b'features = ["backup", "limits"]', b'features = ["backup", "limits", "bundled"]'),
        ]:
            with self.subTest(after=after):
                self.assertIn(before, self.manifest)
                self.root.files["Cargo.toml"] = Blob(self.manifest.replace(before, after))
                with self.assertRaisesRegex(ValueError, "unreviewed direct dependencies/features"):
                    GUARD.check_lock()

    def test_resolved_features_cannot_expand_even_if_direct_manifest_matches(self):
        for name, feature in [("serde", "rc"), ("serde_json", "arbitrary_precision"),
                              ("rusqlite", "bundled"), ("libsqlite3-sys", "bundled"), ("prost", "default")]:
            with self.subTest(name=name):
                metadata = self.metadata()
                next(n for n in metadata["resolve"]["nodes"] if n["id"] == f"registry#{name}@fixture")["features"].append(feature)
                with self.assertRaisesRegex(ValueError, "unapproved direct dependency features"):
                    self.audit(metadata)

    def test_license_exception_does_not_approve_other_versions_crates_or_expressions(self):
        for key, value in [("name", "other"), ("version", "2.8.4"), ("license", "Unlicense")]:
            metadata = self.metadata()
            package = next(p for p in metadata["packages"] if p["name"] == "memchr")
            package[key] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "unreviewed license"):
                self.audit(metadata)
        metadata = self.metadata()
        metadata["packages"][0]["source"] = "git+https://example.invalid/unreviewed"
        with self.assertRaisesRegex(ValueError, "non-registry dependency"):
            self.audit(metadata)


if __name__ == "__main__":
    unittest.main()
