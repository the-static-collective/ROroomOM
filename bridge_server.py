"""ROroomOM 005 opt-in loopback-only UI and narrowly admitted capability bridge."""
from __future__ import annotations

import argparse
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from bridge_core import BridgeError, WorkbenchReadAdapter
from capability_core import CapabilityEngine
from room004_server import make_handler as make_read_handler

HERE = Path(__file__).resolve().parent


def make_handler(adapter: WorkbenchReadAdapter, engine: CapabilityEngine,
                 room_path: Path = HERE / 'static-room.html'):
    Base = make_read_handler(adapter, room_path)

    class Handler(Base):
        server_version = 'ROroomOM/005'

        def _guard(self, write=False):
            host = self.headers.get('Host', '')
            expected = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
            if host not in expected or self.headers.get('Sec-Fetch-Site', 'same-origin') not in ('none', 'same-origin'):
                raise BridgeError(403, 'Only direct same-origin local Room access is supported.')
            origin = self.headers.get('Origin')
            if origin is not None and origin not in {f'http://{h}' for h in expected}:
                raise BridgeError(403, 'Cross-origin capability requests are refused.')
            if write and (self.headers.get('X-Room-Action') != 'explicit-user-confirm'
                          or self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json'):
                raise BridgeError(403, 'A same-origin JSON capability request with the explicit-action header is required.')

        def do_GET(self):
            try:
                self._guard()
                url = urlsplit(self.path)
                if url.path == '/api/room/capabilities':
                    self.json_response(200, engine.descriptors()); return
                if url.path == '/api/room/capabilities/receipt':
                    receipt_id = (parse_qs(url.query).get('id') or [''])[0]
                    self.json_response(200, engine.receipt(receipt_id)); return
            except BridgeError as exc:
                self.json_response(exc.status, {'detail': exc.detail}); return
            super().do_GET()

        def do_POST(self):
            try:
                self._guard(write=True)
                path = urlsplit(self.path).path
                if path not in ('/api/room/capabilities/prepare', '/api/room/capabilities/execute'):
                    raise BridgeError(405, 'No such effectful capability endpoint.')
                n = int(self.headers.get('Content-Length', '0'))
                if not 1 <= n <= 16_000:
                    raise BridgeError(413, 'Capability request exceeds the 16 KiB boundary.')
                payload = json.loads(self.rfile.read(n))
                if not isinstance(payload, dict):
                    raise BridgeError(400, 'Expected JSON object.')
                if path.endswith('/prepare'):
                    result = engine.prepare(payload.get('operationId'), payload.get('inputs'))
                else:
                    result = engine.execute(payload.get('ticket'),
                                            payload.get('approvedInputSha256'), payload.get('approval'))
                self.json_response(200, result)
            except BridgeError as exc:
                self.json_response(exc.status, {'detail': exc.detail})
            except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
                self.json_response(400, {'detail': 'Invalid bounded JSON request.'})
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_PUT(self): self.json_response(405, {'detail': 'No PUT endpoints.'})
        def do_PATCH(self): self.do_PUT()
        def do_DELETE(self): self.do_PUT()
    return Handler


def main():
    ap = argparse.ArgumentParser(description='ROroomOM 005 local capability room')
    ap.add_argument('--port', type=int, default=13701)
    ap.add_argument('--workbench-port', type=int, default=13700)
    ap.add_argument('--state-dir', type=Path, default=Path.home()/'.local/state/roroomom')
    args = ap.parse_args()
    if not 1 <= args.port <= 65535 or args.port == args.workbench_port:
        ap.error('Choose two distinct valid TCP ports.')
    adapter = WorkbenchReadAdapter(args.workbench_port)
    engine = CapabilityEngine(adapter, args.state_dir)
    with ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(adapter, engine)) as server:
        print(f'ROroomOM 005: http://127.0.0.1:{args.port}/ (local capability room)', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
