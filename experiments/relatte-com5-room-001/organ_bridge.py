"""Loopback-only server for the COM5 Room 002 Workbench organ dock."""
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
from workbench_organ import WorkbenchSourceOrgan  # noqa: E402


def make_handler(organ: WorkbenchSourceOrgan):
    class Handler(SimpleHTTPRequestHandler):
        server_version = "ROroomOM-COM5-Organ/002"

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

        def _guard(self, explicit: bool = False):
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
            if explicit and self.headers.get("X-Room-Action") != "explicit-user-inspect":
                raise BridgeError(403, "Explicit local inspection action is required.")

        def do_GET(self):
            try:
                self._guard()
                path = urlsplit(self.path).path
                if path == "/api/organs/workbench/status":
                    self._json(200, organ.status())
                    return
                if path == "/api/organs/workbench/repos":
                    self._json(200, organ.catalog())
                    return
            except BridgeError as exc:
                self._json(exc.status, {"detail": exc.detail})
                return
            super().do_GET()

        def do_POST(self):
            try:
                self._guard(explicit=True)
                path = urlsplit(self.path).path
                if path not in {
                    "/api/organs/workbench/prepare-source",
                    "/api/organs/workbench/inspect-source",
                }:
                    raise BridgeError(405, "No such organ endpoint.")
                size = int(self.headers.get("Content-Length", "0"))
                if not 1 <= size <= 8192:
                    raise BridgeError(413, "Organ request exceeds 8 KiB.")
                payload = json.loads(self.rfile.read(size))
                if not isinstance(payload, dict):
                    raise BridgeError(400, "Expected a JSON object.")

                if path.endswith("prepare-source"):
                    result = organ.prepare(payload.get("repo_name"), payload.get("source_path"))
                else:
                    result = organ.inspect(payload.get("ticket"))
                self._json(200, result)
            except BridgeError as exc:
                self._json(exc.status, {"detail": exc.detail})
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
                self._json(400, {"detail": "Invalid bounded JSON request."})

        def do_PUT(self):
            self._json(405, {"detail": "No PUT endpoints."})

        do_PATCH = do_PUT
        do_DELETE = do_PUT

    return Handler


def main():
    parser = argparse.ArgumentParser(description="ROroomOM COM5 Workbench Source Inspector")
    parser.add_argument("--port", type=int, default=13702)
    parser.add_argument("--workbench-port", type=int, default=13700)
    args = parser.parse_args()

    if not 1 <= args.port <= 65535 or args.port == args.workbench_port:
        parser.error("Choose distinct valid Room and Workbench ports.")

    adapter = WorkbenchReadAdapter(args.workbench_port)
    organ = WorkbenchSourceOrgan(adapter)

    with ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(organ)) as server:
        print(
            f"ROroomOM COM5 organ room: http://127.0.0.1:{args.port}/ "
            f"(Workbench expected on 127.0.0.1:{args.workbench_port})",
            flush=True,
        )
        server.serve_forever()


if __name__ == "__main__":
    main()
