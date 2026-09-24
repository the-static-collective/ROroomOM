"""Opt-in same-origin STATIC ROOM 004 viewer; binds only to 127.0.0.1.

Start the separately installed Static Workbench first, then run this server.
This server does not relay arbitrary Workbench routes or any session token.
"""
from __future__ import annotations
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from bridge_core import BridgeError, WorkbenchReadAdapter

HERE = Path(__file__).resolve().parent


def make_handler(adapter: WorkbenchReadAdapter, room_path: Path = HERE / 'static-room.html'):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'StaticRoomBridge/004'
        def respond(self, status: int, body: bytes, mimetype='application/json; charset=utf-8'):
            self.send_response(status)
            self.send_header('Content-Type', mimetype)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('X-Frame-Options', 'DENY')
            self.send_header('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'none'")
            self.end_headers()
            self.wfile.write(body)
        def json_response(self, status, obj):
            self.respond(status, json.dumps(obj, ensure_ascii=False).encode('utf-8'))
        def do_GET(self):
            host = self.headers.get('Host', '')
            allowed = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
            if host not in allowed or self.headers.get('Sec-Fetch-Site', 'same-origin') not in ('none', 'same-origin'):
                self.json_response(403, {'detail': 'Only direct same-origin local access is supported.'}); return
            url = urlsplit(self.path)
            query = parse_qs(url.query, keep_blank_values=True)
            one = lambda key: (query.get(key) or [''])[0]
            try:
                if url.path == '/':
                    self.respond(200, room_path.read_bytes(), 'text/html; charset=utf-8')
                elif url.path == '/api/room/identity':
                    self.json_response(200, adapter.identity())
                elif url.path == '/api/room/repos':
                    self.json_response(200, {'repos': adapter.repos()})
                elif url.path == '/api/room/prepare':
                    self.json_response(200, adapter.prepare(one('root_id'), one('repo_path'), one('source_path')))
                elif url.path == '/api/room/inspect':
                    self.json_response(200, adapter.inspect(one('ticket')))
                else:
                    self.json_response(404, {'detail': 'No such read-only Room operation.'})
            except BridgeError as exc:
                self.json_response(exc.status, {'detail': exc.detail})
            except (BrokenPipeError, ConnectionResetError):
                pass
        def do_POST(self):
            self.json_response(405, {'detail': 'Bridge has no write endpoints.'})
        def do_PUT(self): self.do_POST()
        def do_PATCH(self): self.do_POST()
        def do_DELETE(self): self.do_POST()
        def log_message(self, fmt, *args):
            # No query-string logging: source paths and one-use tickets are private.
            pass
    return Handler


def main():
    ap = argparse.ArgumentParser(description='STATIC ROOM 004 read-only Workbench bridge')
    ap.add_argument('--port', type=int, default=13701, help='Room local listen port (default: 13701)')
    ap.add_argument('--workbench-port', type=int, default=13700, help='Existing local Workbench port')
    args = ap.parse_args()
    if not 1 <= args.port <= 65535 or args.port == args.workbench_port:
        ap.error('Choose distinct ports between 1 and 65535')
    bridge = WorkbenchReadAdapter(args.workbench_port)
    with ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(bridge)) as server:
        print(f'STATIC ROOM 004: http://127.0.0.1:{args.port}/ (read-only Workbench bridge)', flush=True)
        server.serve_forever()

if __name__ == '__main__':
    main()
