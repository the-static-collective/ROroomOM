"""Opt-in same-origin ROroomOM 006 bridge: fixed verified joint, exact human cut.

The client supplies neither seed paths/pins nor an actor identity. This is a
local prototype: browser confirmation is NOT authenticated two-person consent.
"""
from __future__ import annotations

import argparse
import json
import secrets
import sys
import threading
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

HERE = Path(__file__).resolve().parent
ROOM = HERE.parents[1]
sys.path.insert(0, str(ROOM))
sys.path.insert(0, str(HERE))

from bridge_core import BridgeError, WorkbenchReadAdapter
from bridge_server import make_handler as make_room005_handler
from capability_core import CapabilityEngine
from engine import RejoiningRoom, Refusal
from worldseed004_adapter import load_verified_anchor

_REQUIRED = {"home", "root_seal", "a_seal", "b_seal", "joint_seal", "root_state_id"}


# Frozen against the exact portable WORLDSEED-004 BAT sources used for this slice.
# This checks code bytes, not publisher identity; only install a trusted package.
EXPECTED_WORLDSEED_SHA256 = {
    "worldseed_003.py": "662700890d54a3f5e8f954e6cf43f36a38cbbbed93d2ecab35d804f653271b7b",
    "worldseed_rejoin_004.py": "b2f251fee7a958789fd2bea14d9460c74a411889758fd0a89c6c7d11a606a7eb",
    "relational_004.py": "cb495ed86e1b9fae20f3cbdab5d16bd86fb3f7dd00beb3f85e7f8df27bd80d21",
    "holographic_kernel_001.py": "68ea573eb8c0421c702deb9d8f1fcfd4dee8afb3064a680b048f368488d62f05",
    "holographic_field_001.py": "2ad6c14fa6002cf786d8039b94b778a90ef5129b4e8443f2c9f20e4271f6d0ab",
    "holographic_extinction_002.py": "f7fdf33087458a2f3b3ccff6ce0c3601f8ede22432979a20052d29d0cba5747d",
}


def require_pinned_worldseed_library(root: Path) -> Path:
    from hashlib import sha256
    root = Path(root).expanduser().resolve(strict=True)
    parent = root / "static_workbench" / "experimental"
    if not parent.is_dir():
        raise Refusal("WORLDSEED-004 source package not found in configured library")
    for filename, expected in EXPECTED_WORLDSEED_SHA256.items():
        path = parent / filename
        if path.is_symlink() or not path.is_file() or sha256(path.read_bytes()).hexdigest() != expected:
            raise Refusal(f"WORLDSEED-004 code pin mismatch: {filename}")
    return root


class RejoinController:
    def __init__(self, state_dir: Path, pins_file: Path):
        self.state_dir = Path(state_dir).expanduser().resolve() / "rejoining_room_006"
        self.pins_file = Path(pins_file).expanduser().resolve()
        self.lock = threading.RLock()
        self.pending: dict[str, tuple[dict, float, str]] = {}
        # A separately configured file is a trust decision by the operator.
        # Never obtain independent pins by reading the untrusted seed itself.
        self.anchor = self._anchor()

    def _config(self):
        cfg = json.loads(self.pins_file.read_text(encoding="utf-8"))
        if not isinstance(cfg, dict) or set(cfg) != _REQUIRED:
            raise Refusal("pin configuration has missing or unexpected fields")
        if not Path(cfg["home"]).is_absolute():
            raise Refusal("seed home must be a configured absolute local path")
        seed_home = Path(cfg["home"]).expanduser().resolve()
        if self.pins_file == seed_home or seed_home in self.pins_file.parents:
            raise Refusal("independent pin file must live outside the imported seed home")
        if self.pins_file == self.state_dir or self.state_dir in self.pins_file.parents:
            raise Refusal("independent pin file must live outside the Room effect state")
        for key in ("root_seal", "a_seal", "b_seal", "joint_seal"):
            seal = cfg[key]
            if not isinstance(seal, str) or len(seal) != 64 or any(c not in "0123456789abcdef" for c in seal):
                raise Refusal("untrusted or malformed independent seal")
        if not isinstance(cfg["root_state_id"], str) or len(cfg["root_state_id"]) < 4:
            raise Refusal("missing trusted root identity")
        return cfg

    def _anchor(self):
        return load_verified_anchor(**self._config())

    def _reverify(self):
        current = self._anchor()
        if current != self.anchor:
            raise Refusal("pinned source changed; refuse crossing")
        return current

    def status(self):
        with self.lock:
            anchor = self._reverify()
            return {"schema": "roroomom.rejoin-bridge-006/v1",
                    "status": "source-verified-locally-not-authorized",
                    "joint": anchor.joint_id, "joint_pin": anchor.joint_pin,
                    "parents": list(anchor.parent_states), "parent_seals": list(anchor.parent_seals),
                    "tension": anchor.tension, "unresolved": list(anchor.unresolved),
                    "effect": "create one Room-owned local Markdown artifact",
                    "authority": "not imported from either WORLDSEED parent",
                    "human_decision": "local confirmation only; no authenticated co-signers"}

    def prepare(self, content: object):
        with self.lock:
            self._reverify()
            room = RejoiningRoom(self.state_dir, self.anchor)
            try:
                preview = room.prepare(content)
            finally:
                room.close()
            ticket = secrets.token_urlsafe(24)
            self.pending[ticket] = (preview, time.monotonic() + 120, self.anchor.joint_pin)
            if len(self.pending) > 100:
                now = time.monotonic()
                self.pending = {k: v for k, v in list(self.pending.items())[-80:] if v[1] > now}
            return {"status": "prepared-not-executed", "ticket": ticket,
                    "candidate_id": preview["candidate_id"], "preview": preview["candidate"],
                    "predicted_effect": preview["predicted_effect"], "expires_seconds": 120}

    def execute(self, ticket, candidate_id, approval):
        with self.lock:
            item = self.pending.pop(ticket, None)
            if item is None or time.monotonic() > item[1]:
                raise BridgeError(410, "one-use preview ticket absent or expired")
            if (candidate_id != item[0]["candidate_id"]
                    or approval != "I approve this exact Room-owned rejoining effect"):
                raise BridgeError(403, "explicit confirmation differs from exact preview")
            current = self._reverify()
            if current.joint_pin != item[2]:
                raise Refusal("source seal changed after preview")
            room = RejoiningRoom(self.state_dir, self.anchor)
            try:
                return room.commit(item[0], approved_candidate_id=candidate_id,
                                   local_actor="local-room-operator")
            finally:
                room.close()

    def inspect(self, crossing_id):
        with self.lock:
            if not isinstance(crossing_id, str) or not crossing_id.startswith("roomx_") or len(crossing_id) != 70:
                raise Refusal("invalid crossing address")
            room = RejoiningRoom(self.state_dir, self.anchor)
            try:
                result = room.inspect(crossing_id)
                if result["status"] == "accepted-needs-explicit-reconcile":
                    row = room.db.execute(
                        "SELECT effect,effect_sha FROM crossings WHERE id=?",
                        (crossing_id,),
                    ).fetchone()
                    if row is None:
                        raise Refusal("no durable effect available for reconciliation")
                    return {**result, "effect_sha256": row[1],
                            "exact_pending_effect": row[0].decode("utf-8")}
                return result
            finally:
                room.close()

    def reconcile(self, crossing_id, approved_effect_sha, approval):
        with self.lock:
            # A new explicit confirmation is required to publish an accepted
            # intent whose artifact is missing. Never silently retry it.
            if approval != "I approve reconciliation of this exact durable intent":
                raise BridgeError(403, "explicit reconcile approval required")
            self._reverify()
            room = RejoiningRoom(self.state_dir, self.anchor)
            try:
                observed = room.inspect(crossing_id)
                if observed["status"] == "completed":
                    return observed
                row = room.db.execute("SELECT effect_sha FROM crossings WHERE id=?", (crossing_id,)).fetchone()
                if row is None or row[0] != approved_effect_sha:
                    raise Refusal("reconciliation effect does not match durable intent")
                return room.reconcile(crossing_id, publish=True)
            finally:
                room.close()


def make_handler(adapter, engine, controller, room_path=ROOM / "static-room.html"):
    Base = make_room005_handler(adapter, engine, room_path)
    page = (HERE / "rejoin-room.html").read_bytes()
    nav = (b'<a href="/rejoin" style="position:fixed;right:12px;bottom:12px;z-index:9999;'
           b'background:#18263d;color:#fff;padding:10px 14px;border:1px solid #9bc2e8;'
           b'border-radius:9px;font:14px system-ui;text-decoration:none">Rejoining Room &rarr;</a>')

    class Handler(Base):
        server_version = "ROroomOM/006-experimental"

        def do_GET(self):
            path = urlsplit(self.path).path
            if path in ("/", "/rejoin", "/api/room/rejoin/status", "/api/room/rejoin/receipt"):
                try:
                    self._guard()
                    if path == "/":
                        source = room_path.read_bytes()
                        if b"</body>" not in source:
                            raise BridgeError(500, "Room page has no body insertion boundary")
                        self.respond(200, source.replace(b"</body>", nav+b"</body>", 1),
                                     "text/html; charset=utf-8")
                    elif path == "/rejoin":
                        self.respond(200, page, "text/html; charset=utf-8")
                    elif path == "/api/room/rejoin/status":
                        self.json_response(200, controller.status())
                    else:
                        crossing_id = (parse_qs(urlsplit(self.path).query).get("id") or [""])[0]
                        self.json_response(200, controller.inspect(crossing_id))
                except (Refusal, OSError, ValueError, ImportError) as exc:
                    self.json_response(409, {"detail": str(exc)})
                except BridgeError as exc:
                    self.json_response(exc.status, {"detail": exc.detail})
                return
            return super().do_GET()

        def do_POST(self):
            path = urlsplit(self.path).path
            if path not in ("/api/room/rejoin/prepare", "/api/room/rejoin/execute",
                            "/api/room/rejoin/reconcile"):
                return super().do_POST()
            try:
                self._guard(write=True)
                n = int(self.headers.get("Content-Length", "0"))
                if n < 2 or n > 12000:
                    raise BridgeError(413, "rejoining request outside bounded size")
                obj = json.loads(self.rfile.read(n))
                if not isinstance(obj, dict):
                    raise BridgeError(400, "expected JSON object")
                if path.endswith("/prepare"):
                    if set(obj) != {"content"}:
                        raise BridgeError(400, "prepare accepts only content; no client-provided pins")
                    output = controller.prepare(obj["content"])
                elif path.endswith("/execute"):
                    if set(obj) != {"ticket", "candidate_id", "approval"}:
                        raise BridgeError(400, "exact execution form required")
                    output = controller.execute(obj["ticket"], obj["candidate_id"], obj["approval"])
                else:
                    if set(obj) != {"crossing_id", "effect_sha256", "approval"}:
                        raise BridgeError(400, "exact reconciliation form required")
                    output = controller.reconcile(obj["crossing_id"], obj["effect_sha256"], obj["approval"])
                self.json_response(200, output)
            except BridgeError as exc:
                self.json_response(exc.status, {"detail": exc.detail})
            except (Refusal, OSError, ValueError, TypeError, ImportError) as exc:
                self.json_response(409, {"detail": str(exc)})

    return Handler


def main():
    p = argparse.ArgumentParser(description="Opt-in ROroomOM-006 verified rejoining bridge")
    p.add_argument("--pins-file", type=Path, required=True,
                   help="independently operator-pinned WORLDSEED-004 root/A/B/joint configuration")
    p.add_argument("--worldseed-lib", type=Path, required=True,
                   help="trusted local directory containing static_workbench.experimental WORLDSEED-004")
    p.add_argument("--state-dir", type=Path, default=Path.home()/".local/state/roroomom")
    p.add_argument("--port", type=int, default=13701)
    p.add_argument("--workbench-port", type=int, default=13700)
    args = p.parse_args()
    if not (1 <= args.port <= 65535) or args.port == args.workbench_port:
        p.error("distinct valid Room and Workbench ports required")
    sys.path.insert(0, str(require_pinned_worldseed_library(args.worldseed_lib)))
    controller = RejoinController(args.state_dir, args.pins_file)
    from http.server import ThreadingHTTPServer
    adapter = WorkbenchReadAdapter(args.workbench_port)
    engine = CapabilityEngine(adapter, args.state_dir)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(adapter, engine, controller))
    try:
        print(f"ROroomOM 006: http://127.0.0.1:{args.port}/rejoin (local, opt-in)", flush=True)
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
