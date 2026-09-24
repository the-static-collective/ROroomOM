"""STATIC ROOM 004: read-only, version-gated proxy to existing Workbench GET APIs.

No filesystem traversal, arbitrary URLs, project commands, Workbench session token
relay, or Workbench mutation endpoints. Source reads require an explicit prepare/
inspect sequence with per-inspection worktree and content equality checks.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
import secrets
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PROTOCOL = 'static-room.workbench-read-v1'
EXPECTED_WORKBENCH_VERSION = '0.2.0'
MAX_BYTES = 65536
ALLOWED_TYPES = frozenset({'.md', '.markdown', '.txt'})
DENIED_PARTS = ('secret', 'credential', 'password', 'token', 'private', '.env', 'id_rsa', 'key')


class BridgeError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


def checked_path(value: str) -> str:
    if not isinstance(value, str) or not (1 <= len(value) <= 240):
        raise BridgeError(400, 'Provide a short repository-relative text path.')
    if value.startswith('/') or '\\' in value or '\x00' in value or ':' in value:
        raise BridgeError(400, 'Only repository-relative text paths are accepted.')
    parts = value.split('/')
    if any(not p or p in ('.', '..') or p.startswith('.') or any(t in p.lower() for t in DENIED_PARTS) for p in parts):
        raise BridgeError(400, 'Hidden, sensitive-looking, and traversing paths are refused.')
    if not any(value.lower().endswith(ext) for ext in ALLOWED_TYPES):
        raise BridgeError(400, 'Only Markdown and plain text sources are supported.')
    return value


@dataclass
class Pending:
    root_id: str
    repo_path: str
    source_path: str
    head: str
    digest: str
    deadline: float
    workbench_version: str


class WorkbenchReadAdapter:
    def __init__(self, port: int = 13700, expected_version: str = EXPECTED_WORKBENCH_VERSION):
        if not 1 <= port <= 65535:
            raise ValueError('Workbench port out of range')
        self.base = f'http://127.0.0.1:{port}'
        self.expected_version = expected_version
        self.pending: dict[str, Pending] = {}

    def _read(self, path: str, args: dict | None = None) -> dict:
        url = self.base + path + (('?' + urlencode(args)) if args else '')
        try:
            # Fixed loopback target + fixed read-only route, no user-controlled URL or headers.
            req = Request(url, method='GET', headers={'Accept': 'application/json'})
            with urlopen(req, timeout=4) as response:
                if response.status != 200:
                    raise BridgeError(502, 'Workbench returned a non-success status.')
                raw = response.read(320_000 + 1)
            if len(raw) > 320_000:
                raise BridgeError(413, 'Workbench response exceeds read boundary.')
            value = json.loads(raw)
            if not isinstance(value, dict):
                raise ValueError('not a JSON object')
            return value
        except BridgeError:
            raise
        except HTTPError as exc:
            raise BridgeError(404 if exc.code == 404 else 502,
                              'Workbench source not found.' if exc.code == 404 else 'Workbench rejected the read-only request.') from exc
        except (URLError, OSError, TimeoutError) as exc:
            raise BridgeError(503, 'Workbench is unavailable on the configured loopback port.') from exc
        except (ValueError, json.JSONDecodeError) as exc:
            raise BridgeError(502, 'Workbench did not return the expected read-only response.') from exc

    def identity(self) -> dict:
        try:
            boot = self._read('/api/bootstrap')
        except BridgeError as exc:
            return {'protocol': PROTOCOL, 'connected': False, 'expectedWorkbenchVersion': self.expected_version, 'reason': exc.detail}
        version = str(boot.get('version', ''))
        # Deliberately do NOT return bootstrap roots (absolute paths) or session_token.
        return {'protocol': PROTOCOL, 'connected': version == self.expected_version,
                'workbenchVersion': version, 'expectedWorkbenchVersion': self.expected_version,
                'reason': None if version == self.expected_version else 'Workbench version differs from pinned adapter contract.'}

    def _assert_identity(self):
        boot = self._read('/api/bootstrap')
        if boot.get('version') != self.expected_version:
            raise BridgeError(409, 'Workbench version mismatch; no source inspection was performed.')

    def repos(self) -> list[dict]:
        self._assert_identity()
        response = self._read('/api/repos')
        result = []
        for item in response.get('repos', []):
            if not isinstance(item, dict):
                continue
            root, rel = item.get('root_id'), item.get('relative_path')
            head = item.get('head')
            if not all(isinstance(x, str) and x for x in (root, rel, head)):
                continue
            result.append({'root_id': root, 'repo_path': rel, 'name': item.get('name') or rel,
                           'head': head, 'dirty': item.get('dirty') is True,
                           'detached': item.get('detached') is True})
        return result

    def _repo(self, root: str, repo_path: str) -> dict:
        matching = [r for r in self.repos() if r['root_id'] == root and r['repo_path'] == repo_path]
        if not matching:
            raise BridgeError(404, 'That checkout is not in the Workbench-discovered repository list.')
        repo = matching[0]
        if repo['dirty'] or repo['detached']:
            raise BridgeError(409, 'The checkout is dirty or detached. Clean/select a branch before requesting a pinned witness.')
        if not re.fullmatch(r'[a-f0-9]{7,40}', repo['head']):
            raise BridgeError(409, 'Workbench did not provide a recognizable Git HEAD.')
        return repo

    def _source(self, repo: dict, source_path: str) -> tuple[str, str]:
        # Workbench itself owns the root/path boundary, symlink resolution, and preview.
        obj = self._read('/api/objects/inspect', {
            'root_id': repo['root_id'], 'path': repo['repo_path'] + '/' + source_path})
        content = obj.get('preview')
        if (obj.get('kind') != 'file' or obj.get('preview_truncated') is not False
                or not isinstance(content, str) or not content.strip()
                or obj.get('size', MAX_BYTES + 1) > MAX_BYTES
                or len(content.encode('utf-8')) > MAX_BYTES or '\x00' in content):
            raise BridgeError(409, 'Source is absent, binary, truncated, empty, or above 64 KiB.')
        return content, hashlib.sha256(content.encode('utf-8')).hexdigest()

    def prepare(self, root_id: str, repo_path: str, source_path: str) -> dict:
        checked_path(source_path)
        repo = self._repo(root_id, repo_path)
        body, digest = self._source(repo, source_path)
        ticket = secrets.token_urlsafe(24)
        self.pending[ticket] = Pending(root_id, repo_path, source_path, repo['head'], digest,
                                        time.monotonic() + 180, self.expected_version)
        if len(self.pending) > 100:
            now = time.monotonic()
            self.pending = {k: v for k, v in list(self.pending.items())[-80:] if v.deadline > now}
        return {'prepared': True, 'ticket': ticket, 'root_id': root_id, 'repo_path': repo_path,
                'source_path': source_path, 'head': repo['head'], 'headType': 'workbench-short-head',
                'contentSha256': digest, 'bytes': len(body.encode('utf-8')),
                'preview': body[:400], 'expiresSeconds': 180,
                'status': 'awaiting-explicit-inspect', 'sourceKind': 'local-worktree-not-immutable-git-blob'}

    def inspect(self, ticket: str) -> dict:
        pending = self.pending.pop(ticket, None)  # One use, including failure; no auto-retry.
        if pending is None or time.monotonic() > pending.deadline:
            raise BridgeError(410, 'Prepare receipt absent or expired; prepare again.')
        repo = self._repo(pending.root_id, pending.repo_path)
        if repo['head'] != pending.head:
            raise BridgeError(409, 'Repository HEAD changed after preparation; inspection refused.')
        body, digest = self._source(repo, pending.source_path)
        if digest != pending.digest:
            raise BridgeError(409, 'Source contents changed after preparation; inspection refused.')
        return {'schema': PROTOCOL, 'tier': 'workbench-local-inspected-once',
                'root_id': pending.root_id, 'repo_path': pending.repo_path,
                'source_path': pending.source_path, 'head': repo['head'],
                'headType': 'workbench-short-head', 'dirty': False,
                'contentSha256': digest, 'workbenchVersion': self.expected_version,
                'excerpt': body[:12000], 'contentTruncated': len(body) > 12000,
                'contentBytes': len(body.encode('utf-8')),
                'checkedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'boundary': 'One read-only local worktree inspection; not a pinned remote blob, authorization, or live sync.'}
