from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

spec = importlib.util.spec_from_file_location("workbench_organ", HERE / "workbench_organ.py")
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

WorkbenchSourceOrgan = module.WorkbenchSourceOrgan
BridgeError = module.BridgeError


class FakeAdapter:
    def __init__(self):
        self.prepared = []
        self.inspected = []

    def identity(self):
        return {"connected": True, "workbenchVersion": "0.2.0"}

    def repos(self):
        return [
            {
                "root_id": "root:static",
                "repo_path": "reLATTE",
                "name": "reLATTE",
                "head": "abcdef1",
                "dirty": False,
                "detached": False,
            },
            {
                "root_id": "root:static",
                "repo_path": "ROroomOM",
                "name": "ROroomOM",
                "head": "bcdefa2",
                "dirty": False,
                "detached": False,
            },
        ]

    def prepare(self, root_id, repo_path, source_path):
        self.prepared.append((root_id, repo_path, source_path))
        return {
            "ticket": "ticket-12345678",
            "source_path": source_path,
            "head": "abcdef1",
            "contentSha256": "1" * 64,
            "bytes": 321,
            "preview": "# reLATTE",
            "expiresSeconds": 180,
        }

    def inspect(self, ticket):
        self.inspected.append(ticket)
        return {
            "repo_path": "reLATTE",
            "source_path": "README.md",
            "head": "abcdef1",
            "contentSha256": "1" * 64,
            "excerpt": "# reLATTE\n\nThe relation is the block.",
            "contentTruncated": False,
            "contentBytes": 321,
            "checkedAt": "2026-10-01T19:30:00Z",
            "boundary": "read-only local worktree inspection",
        }


class SourceOrganTests(unittest.TestCase):
    def setUp(self):
        self.adapter = FakeAdapter()
        self.organ = WorkbenchSourceOrgan(self.adapter)

    def test_catalog_does_not_expose_root_id(self):
        catalog = self.organ.catalog()
        self.assertEqual(catalog["authority"], "none")
        self.assertNotIn("root_id", catalog["repositories"][0])

    def test_prepare_resolves_discovered_repo_and_delegates_exact_read(self):
        prepared = self.organ.prepare("reLATTE", "README.md")
        self.assertEqual(self.adapter.prepared, [("root:static", "reLATTE", "README.md")])
        self.assertEqual(prepared["status"], "prepared-not-inspected")
        self.assertEqual(prepared["authority"], "none")

    def test_inspect_is_one_separate_step(self):
        inspected = self.organ.inspect("ticket-12345678")
        self.assertEqual(self.adapter.inspected, ["ticket-12345678"])
        self.assertEqual(inspected["status"], "inspected-once")
        self.assertIn("The relation is the block", inspected["excerpt"])
        self.assertEqual(inspected["authority"], "none")

    def test_unknown_repo_is_refused(self):
        with self.assertRaises(BridgeError) as caught:
            self.organ.prepare("not-a-repo", "README.md")
        self.assertEqual(caught.exception.status, 404)


if __name__ == "__main__":
    unittest.main()
