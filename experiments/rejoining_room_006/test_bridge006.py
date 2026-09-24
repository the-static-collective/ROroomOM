"""ROroomOM-006 bridge BATs: real HTTP against fixed local source identity.

Synthetic anchor is injected only inside these tests. Production startup
uses WORLDSEED-004 verification and code pins; see source package smoke below.
"""
from __future__ import annotations

from dataclasses import replace
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from bridge006 import RejoinController, make_handler, require_pinned_worldseed_library
from bridge_core import WorkbenchReadAdapter
from capability_core import CapabilityEngine
from engine import JointAnchor, Refusal

ANCHOR = JointAnchor(
    joint_id="join_"+"a"*64, joint_pin="a"*64, root_id="root-A",
    parent_states=("state-A", "state-B"),
    parent_seals=("a"*64, "b"*64),
    tension="invitation vs warning", unresolved=("Who rang the bell?",),
)


class BridgeBats(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        cls.page = cls.root/"room.html"
        cls.page.write_text("<html><body><p>Original Room 005</p></body></html>")
        cls.adapter = WorkbenchReadAdapter(13700)
        cls.engine = CapabilityEngine(cls.adapter, cls.root/"room5")
        with patch.object(RejoinController, "_anchor", return_value=ANCHOR):
            cls.controller = RejoinController(cls.root/"roomstate", cls.root/"separately-pinned.json")
        cls.server = ThreadingHTTPServer(
            ("127.0.0.1", 0), make_handler(cls.adapter, cls.engine, cls.controller, cls.page))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.tmp.cleanup()

    def setUp(self):
        self.controller._anchor = lambda: ANCHOR
        self.controller.pending.clear()

    def req(self, path, data=None, *, headers=None):
        hs = {} if headers is None else dict(headers)
        if data is None:
            request = Request(self.url+path, headers=hs)
        else:
            hs.setdefault("Content-Type", "application/json")
            hs.setdefault("X-Room-Action", "explicit-user-confirm")
            request = Request(self.url+path, data=json.dumps(data).encode(),
                              headers=hs, method="POST")
        with urlopen(request, timeout=4) as response:
            if "text/html" in response.headers.get("Content-Type",""):
                return response.read().decode()
            return json.load(response)

    def prep(self, content="The bell sounded; both readings remain."):
        return self.req("/api/room/rejoin/prepare", {"content": content})

    def approve(self, preview):
        return self.req("/api/room/rejoin/execute",
                        {"ticket": preview["ticket"],
                         "candidate_id": preview["candidate_id"],
                         "approval": "I approve this exact Room-owned rejoining effect"})

    def assertHTTP(self, status, call):
        with self.assertRaises(HTTPError) as e:
            call()
        self.assertEqual(e.exception.code, status)

    def test_01_existing_room_stays_present_with_opt_in_link(self):
        page = self.req("/")
        self.assertIn("Original Room 005", page)
        self.assertIn('href="/rejoin"', page)
        ui = self.req("/rejoin")
        self.assertIn("The Rejoining Room", ui)
        self.assertIn("I inspected the exact preview", ui)

    def test_02_verified_status_has_two_parents_but_no_imported_authority(self):
        status = self.req("/api/room/rejoin/status")
        self.assertEqual(status["parents"], list(ANCHOR.parent_states))
        self.assertEqual(status["joint_pin"], ANCHOR.joint_pin)
        self.assertEqual(status["status"], "source-verified-locally-not-authorized")
        self.assertNotIn("authority-granted", str(status))

    def test_03_prepare_creates_no_artifact_and_returns_exact_preview(self):
        before = list(self.controller.state_dir.rglob("*.md"))
        p = self.prep()
        self.assertEqual(p["status"], "prepared-not-executed")
        self.assertEqual(before, list(self.controller.state_dir.rglob("*.md")))
        self.assertEqual(p["preview"]["parent_states"], list(ANCHOR.parent_states))
        self.assertEqual(p["preview"]["joint_pin"], ANCHOR.joint_pin)

    def test_04_effect_needs_exact_cut_and_returns_both_parents(self):
        p = self.prep("one new joint consequence")
        r = self.approve(p)
        self.assertEqual(r["status"], "completed")
        self.assertEqual(r["receipt"]["parents"], list(ANCHOR.parent_states))
        self.assertEqual(len(r["receipt"]["return_addresses"]), 3)
        self.assertEqual(Path(r["artifact"]).read_text().count("one new joint consequence"), 1)

    def test_05_ticket_is_single_use(self):
        p = self.prep("unique ticket replay")
        self.approve(p)
        self.assertHTTP(410, lambda: self.approve(p))

    def test_06_wrong_candidate_consumes_ticket_and_cannot_execute(self):
        p = self.prep("tampered ticket test")
        self.assertHTTP(403, lambda: self.req("/api/room/rejoin/execute",
                         {"ticket": p["ticket"], "candidate_id": "not-the-preview",
                          "approval": "I approve this exact Room-owned rejoining effect"}))
        self.assertHTTP(410, lambda: self.approve(p))

    def test_07_browser_cannot_supply_parent_history_or_pins(self):
        self.assertHTTP(400, lambda: self.req("/api/room/rejoin/prepare",
                        {"content": "x", "joint_pin": "forged"}))
        self.assertHTTP(400, lambda: self.req("/api/room/rejoin/execute",
                        {"ticket": "fake", "candidate_id": "fake",
                         "approval": "I approve this exact Room-owned rejoining effect",
                         "parent_states": ["fake", "fake"]}))

    def test_08_refuses_changed_source_between_prepare_and_cut(self):
        p = self.prep("source drift test")
        other = replace(ANCHOR, joint_pin="b"*64)
        self.controller._anchor = lambda: other
        self.assertHTTP(409, lambda: self.approve(p))
        self.controller._anchor = lambda: ANCHOR
        self.assertHTTP(410, lambda: self.approve(p))

    def test_09_status_refuses_unverifiable_source(self):
        self.controller._anchor = lambda: (_ for _ in ()).throw(Refusal("source absent"))
        self.assertHTTP(409, lambda: self.req("/api/room/rejoin/status"))
        self.assertHTTP(409, lambda: self.prep("should not proceed"))

    def test_10_origin_and_action_header_refuse_foreign_calls(self):
        self.assertHTTP(403, lambda: self.req("/api/room/rejoin/status",
                        headers={"Origin": "https://attacker.invalid"}))
        self.assertHTTP(403, lambda: self.req("/api/room/rejoin/prepare",
                        {"content": "x"}, headers={"X-Room-Action": "fake"}))

    def test_11_receipt_recovery_does_not_repeat_existing_effect(self):
        p = self.prep("recover inspection test")
        result = self.approve(p)
        cid = result["receipt"]["crossing_id"]
        old = Path(result["artifact"]).stat().st_mtime_ns
        inspected = self.req("/api/room/rejoin/receipt?"+urlencode({"id": cid}))
        self.assertEqual(inspected["receipt"]["crossing_id"], cid)
        self.assertEqual(Path(result["artifact"]).stat().st_mtime_ns, old)

    def test_12_invalid_crossing_refuses_instead_of_guessing(self):
        self.assertHTTP(409, lambda: self.req("/api/room/rejoin/receipt?id=bogus"))

    def test_13_reconciliation_without_explicit_approval_refuses(self):
        self.assertHTTP(403, lambda: self.req("/api/room/rejoin/reconcile",
                        {"crossing_id": "roomx_"+"a"*64, "effect_sha256": "x"*64, "approval": "no"}))

    def test_14_no_arbitrary_rejoining_http_methods(self):
        request = Request(self.url+"/api/room/rejoin/execute", data=b"{}",
                          method="PUT", headers={"Content-Type": "application/json"})
        self.assertHTTP(405, lambda: urlopen(request, timeout=4))

    def test_15_missing_or_altered_worldseed_code_refuses_admission(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(Refusal):
                require_pinned_worldseed_library(Path(folder))

    def test_16_conflicting_real_joint_at_same_room_location_refuses(self):
        p = self.prep("rejoin unique")
        self.approve(p)
        original = self.controller.anchor
        self.controller.anchor = replace(ANCHOR, joint_id="join_"+"b"*64)
        try:
            self.assertHTTP(409, lambda: self.prep("different joint"))
        finally:
            self.controller.anchor = original


if __name__ == "__main__":
    unittest.main()
