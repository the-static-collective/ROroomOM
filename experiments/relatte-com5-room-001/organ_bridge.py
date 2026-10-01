"""Loopback-only server for COM5 Room Workbench + Vault media organ docks."""
from __future__ import annotations

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bridge_core import BridgeError, WorkbenchReadAdapter  # noqa: E402
from vault_media_organ import VaultMediaError, VaultMediaOrgan  # noqa: E402
from workbench_organ import WorkbenchSourceOrgan  # noqa: E402


def make_handler(source_organ: WorkbenchSourceOrgan, media_organ: VaultMediaOrgan):
    class Handler(SimpleHTTPRequestHandler):
        server_version = "ROroomOM-COM5-Organ/003"

        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(HERE), **kwargs)

        def _json(self, status: int, value: dict):
            body = json.dumps(value, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _guard(self, action: str | None = None):
            host = self.headers.get("Host", "")
            expected = {
                f"127.0.0.1:{self.server.server_port}",
                f"localhost:{self.server.server_port}",
            }
            if host not in expected:
                raise BridgeError(403, "Only direct loopback Room access is supported.")
            origin = self.headers.get("Origin")
            if origin is not None and origin not in {f"http://{item}" for item in expected}:
                raise BridgeError(403, "Cross-origin organ requests are refused.")
            if action is not None and self.headers.get("X-Room-Action") != action:
                raise BridgeError(403, f"Explicit local action {action!r} is required.")

        def do_GET(self):
            try:
                self._guard()
                path = urlsplit(self.path).path
                if path == "/api/organs/workbench/status":
                    self._json(200, source_organ.status())
                    return
                if path == "/api/organs/workbench/repos":
                    self._json(200, source_organ.catalog())
                    return
                if path == "/api/organs/vault/status":
                    self._json(200, media_organ.status())
                    return
            except BridgeError as exc:
                self._json(exc.status, {"detail": exc.detail})
                return
            super().do_GET()

        def _payload(self) -> dict:
            size = int(self.headers.get("Content-Length", "0"))
            if not 1 <= size <= 8192:
                raise BridgeError(413, "Organ request exceeds 8 KiB.")
            payload = json.loads(self.rfile.read(size))
            if not isinstance(payload, dict):
                raise BridgeError(400, "Expected a JSON object.")
            return payload

        def do_POST(self):
            path = urlsplit(self.path).path
            try:
                if path in {
                    "/api/organs/workbench/prepare-source",
                    "/api/organs/workbench/inspect-source",
                }:
                    self._guard(action="explicit-user-inspect")
                    payload = self._payload()
                    if path.endswith("prepare-source"):
                        result = source_organ.prepare(
                            payload.get("repo_name"),
                            payload.get("source_path"),
                        )
                    else:
                        result = source_organ.inspect(payload.get("ticket"))
                    self._json(200, result)
                    return

                if path == "/api/organs/vault/resolve":
                    self._guard(action="explicit-user-resolve")
                    payload = self._payload()
                    result = media_organ.resolve(payload.get("address"))
                    self._json(200, result)
                    return

                raise BridgeError(405, "No such organ endpoint.")
            except BridgeError as exc:
                self._json(exc.status, {"detail": exc.detail})
            except VaultMediaError as exc:
                self._json(exc.status, {"detail": exc.detail})
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
                self._json(400, {"detail": "Invalid bounded JSON request."})

        def do_PUT(self):
            self._json(405, {"detail": "No PUT endpoints."})

        do_PATCH = do_PUT
        do_DELETE = do_PUT

    return Handler


def main():
    parser = argparse.ArgumentParser(
        description="ROroomOM COM5 Workbench Source Inspector + Vault audio organ"
    )
    parser.add_argument("--port", type=int, default=13702)
    parser.add_argument("--workbench-port", type=int, default=13700)
    parser.add_argument("--vault-port", type=int, default=13703)
    args = parser.parse_args()

    ports = {args.port, args.workbench_port, args.vault_port}
    if len(ports) != 3 or any(not 1 <= port <= 65535 for port in ports):
        parser.error("Choose three distinct valid Room, Workbench, and Vault ports.")

    source_organ = WorkbenchSourceOrgan(WorkbenchReadAdapter(args.workbench_port))
    media_organ = VaultMediaOrgan(args.vault_port)

    with ThreadingHTTPServer(
        ("127.0.0.1", args.port),
        make_handler(source_organ, media_organ),
    ) as server:
        print(
            f"ROroomOM COM5 organ room: http://127.0.0.1:{args.port}/ "
            f"(Workbench :{args.workbench_port}; Vault resolver :{args.vault_port})",
            flush=True,
        )
        server.serve_forever()


if __name__ == "__main__":
    main()
