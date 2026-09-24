"""ROroomOM 005: two bounded, versioned capability crossings.

Workbench owns its project-native search. ROroomOM owns its local export outbox.
No endpoint runs arbitrary code, edits source repositories, or acquires authority by
seeing a descriptor. Receipts describe observed outcomes, not projected intent.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import time
from typing import Any

from bridge_core import BridgeError, WorkbenchReadAdapter, PROTOCOL

CAPABILITY_PROTOCOL = 'roroomom.capability-v1'
SEARCH_ID = 'static-workbench.creator.search-v1'
EXPORT_ID = 'roroomom.outbox.materialize-v1'
MAX_DOCUMENT = 8192


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def utc() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


@dataclass
class Pending:
    operation_id: str
    inputs: dict
    fingerprint: str
    result_fingerprint: str | None
    expected_head: str | None
    preview: dict
    expires: float


class CapabilityEngine:
    """One process, fixed allowlist, one-use 120s tickets and local append-only receipts."""
    def __init__(self, adapter: WorkbenchReadAdapter, state_dir: Path):
        self.adapter = adapter
        self.state_dir = Path(state_dir).expanduser().resolve()
        self.outbox = self.state_dir / 'outbox'
        self.receipt_dir = self.state_dir / 'receipts'
        self.pending: dict[str, Pending] = {}

    def descriptors(self) -> dict:
        return {'schema': CAPABILITY_PROTOCOL, 'capabilities': [
            {'id': SEARCH_ID, 'owner': 'the-static-collective/static-workbench',
             'adapterVersion': '1', 'requiresWorkbenchVersion': self.adapter.expected_version,
             'effects': ['read bounded local worktree text through Workbench Creator Desk'],
             'authority': 'none', 'scope': 'one explicitly chosen discovered checkout and search term',
             'approval': 'separate human confirmation after preview', 'cancel': 'discard unexecuted ticket',
             'retry': 'new preparation only', 'status': 'available-if-workbench-connected'},
            {'id': EXPORT_ID, 'owner': 'the-static-collective/ROroomOM',
             'adapterVersion': '1', 'requiresWorkbenchVersion': None,
             'effects': ['create one new Markdown file in the Room-owned local outbox',
                         'append one local execution receipt'],
             'authority': 'room-local-only', 'scope': 'up to 8192 UTF-8 characters; generated filename',
             'approval': 'separate human confirmation after exact-content preview',
             'cancel': 'discard unexecuted ticket', 'retry': 'new preparation only', 'status': 'local'}]}

    def _read_search(self, inputs: dict) -> tuple[dict, str]:
        root, repo_path, query = (inputs.get(k) for k in ('root_id', 'repo_path', 'query'))
        if not all(isinstance(s, str) for s in (root, repo_path, query)):
            raise BridgeError(400, 'Select a discovered checkout and a query.')
        if not 2 <= len(query.strip()) <= 100 or any(ord(c) < 32 for c in query):
            raise BridgeError(400, 'Search query must be 2–100 printable characters.')
        self.adapter._assert_identity()
        repo = self.adapter._repo(root, repo_path)
        raw = self.adapter._read('/api/creator/sources', {
            'root_id': root, 'repo_path': repo_path, 'query': query.strip()})
        if raw.get('root_id') != root or raw.get('repo_path') != repo_path or not isinstance(raw.get('hits'), list):
            raise BridgeError(502, 'Workbench returned incompatible Creator Desk evidence.')
        hits = []
        for h in raw['hits'][:20]:
            if not isinstance(h, dict) or h.get('root_id') != root or h.get('repo_path') != repo_path:
                raise BridgeError(502, 'Workbench returned incompatible source coordinates.')
            if not (isinstance(h.get('line'), int) and isinstance(h.get('snippet'), str)
                    and isinstance(h.get('source_path'), str) and isinstance(h.get('file_sha256'), str)
                    and isinstance(h.get('head'), str) and isinstance(h.get('dirty'), bool)):
                raise BridgeError(502, 'Workbench returned incomplete source-hit fields.')
            if h['head'] != repo['head'] or h['dirty'] or len(h['snippet']) > 240:
                raise BridgeError(409, 'Source hit state disagrees with the prepared checkout.')
            hits.append({k: h[k] for k in ('source_path', 'line', 'snippet', 'file_sha256', 'head', 'dirty')})
        result = {'schema': CAPABILITY_PROTOCOL, 'sourceKind': 'workbench-local-worktree-search',
                  'root_id': root, 'repo_path': repo_path, 'head': repo['head'],
                  'query': query.strip(), 'hits': hits, 'files_examined': raw.get('files_examined'),
                  'truncated': bool(raw.get('truncated')), 'authority': 'none',
                  'boundary': 'Workbench-owned read-only Creator Desk search; hits are not claims of canon.'}
        return result, repo['head']

    def prepare(self, operation_id: str, inputs: dict) -> dict:
        if operation_id not in (SEARCH_ID, EXPORT_ID) or not isinstance(inputs, dict):
            raise BridgeError(400, 'Capability or input shape is not admitted.')
        if operation_id == SEARCH_ID:
            clean_inputs = {k: inputs.get(k) for k in ('root_id', 'repo_path', 'query')}
            result, head = self._read_search(clean_inputs)
            result_hash = digest(result)
            preview = {'resultSha256': result_hash, 'head': head, 'hitCount': len(result['hits']),
                       'hits': result['hits'], 'sourceKind': result['sourceKind'],
                       'truncated': result['truncated'], 'noProjectMutation': True}
        else:
            title, content = inputs.get('title'), inputs.get('content')
            if not isinstance(title, str) or not 1 <= len(title.strip()) <= 100 or '\x00' in title:
                raise BridgeError(400, 'A title of 1–100 characters is required.')
            if not isinstance(content, str) or not 1 <= len(content.strip()) or len(content.encode('utf-8')) > MAX_DOCUMENT:
                raise BridgeError(400, 'Content must be nonempty and no more than 8192 UTF-8 bytes.')
            source = inputs.get('source', '')
            if not isinstance(source, str) or len(source) > 1000 or '\x00' in source:
                raise BridgeError(400, 'Source coordinate exceeds the 1000-character boundary.')
            clean_inputs = {'title': title.strip(), 'content': content, 'source': source}
            result_hash, head = None, None
            preview = {'title': clean_inputs['title'], 'content': content, 'source': source,
                       'bytes': len(content.encode('utf-8')), 'contentSha256': hashlib.sha256(content.encode()).hexdigest(),
                       'destination': 'ROroomOM local outbox / generated filename', 'noRepositoryWrite': True}
        ticket = secrets.token_urlsafe(24)
        self.pending[ticket] = Pending(operation_id, clean_inputs, digest(clean_inputs), result_hash,
                                       head, preview, time.monotonic() + 120)
        if len(self.pending) > 100:
            now = time.monotonic()
            self.pending = {k: v for k, v in list(self.pending.items())[-80:] if v.expires > now}
        return {'schema': CAPABILITY_PROTOCOL, 'ticket': ticket, 'operationId': operation_id,
                'status': 'prepared-not-executed', 'inputSha256': digest(clean_inputs),
                'preview': preview, 'expiresSeconds': 120,
                'approval': 'One explicit human action is required for this exact preview.'}

    def _save_receipt(self, receipt: dict) -> dict:
        self.receipt_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        filename = self.receipt_dir / (receipt['receiptId'] + '.json')
        body = canonical(receipt) + b'\n'
        fd = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
        with os.fdopen(fd, 'wb') as handle:
            handle.write(body)
            handle.flush()
            os.fsync(handle.fileno())
        return receipt

    def execute(self, ticket: str, approved_input_sha256: str, approval: str) -> dict:
        # Consumed before action, even if it fails. No automatic retries.
        p = self.pending.pop(ticket, None)
        if p is None or time.monotonic() > p.expires:
            raise BridgeError(410, 'Prepare ticket missing or expired; prepare a fresh operation.')
        if approved_input_sha256 != p.fingerprint or approval != 'I approve this exact operation':
            raise BridgeError(403, 'The prepared input fingerprint and explicit approval must match.')
        receipt_id = secrets.token_hex(16)
        base = {'schema': CAPABILITY_PROTOCOL, 'receiptId': receipt_id,
                'operationId': p.operation_id, 'inputSha256': p.fingerprint,
                'preparedResultSha256': p.result_fingerprint, 'acceptedAt': utc(),
                'owner': 'the-static-collective/static-workbench' if p.operation_id == SEARCH_ID
                         else 'the-static-collective/ROroomOM', 'authority': 'none',
                'approval': 'explicit-confirmation-of-prepared-fingerprint'}
        try:
            if p.operation_id == SEARCH_ID:
                result, head = self._read_search(p.inputs)
                if head != p.expected_head or digest(result) != p.result_fingerprint:
                    raise BridgeError(409, 'Workbench search result or HEAD changed since preparation; execution refused.')
                outcome = {'disposition': 'completed', 'result': result, 'resultSha256': digest(result),
                           'effectsObserved': ['Workbench Creator Desk read completed; no repository mutation requested']}
            else:
                self.outbox.mkdir(mode=0o700, parents=True, exist_ok=True)
                slug = re.sub(r'[^a-z0-9-]+', '-', p.inputs['title'].lower()).strip('-')[:36] or 'artifact'
                path = self.outbox / f'{receipt_id}-{slug}.md'
                doc = f"# {p.inputs['title']}\n\nSource reference (user supplied, unverified): {p.inputs['source'] or 'none'}\n\n{p.inputs['content']}\n"
                data = doc.encode('utf-8')
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
                with os.fdopen(fd, 'wb') as handle:
                    handle.write(data)
                    handle.flush()
                    os.fsync(handle.fileno())
                outcome = {'disposition': 'completed', 'artifact': {'filename': path.name,
                           'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
                           'location': 'Room-owned local outbox'},
                           'effectsObserved': ['Created one new Room-owned Markdown file; source repository untouched']}
        except BridgeError as exc:
            outcome = {'disposition': 'refused', 'reason': exc.detail, 'effectsObserved': []}
        except (OSError, ValueError) as exc:
            # An interrupted filesystem operation may have created the outbox object.
            outcome = {'disposition': 'indeterminate', 'reason': type(exc).__name__,
                       'effectsObserved': [], 'reconciliation': 'Inspect local outbox and receipt by operation ID before preparing any retry.'}
        receipt = {**base, 'finishedAt': utc(), **outcome}
        try:
            return self._save_receipt(receipt)
        except OSError as exc:
            raise BridgeError(503, f'Receipt storage failed ({type(exc).__name__}); outcome indeterminate. Inspect Room outbox before retry.') from exc

    def receipt(self, receipt_id: str) -> dict:
        if not isinstance(receipt_id, str) or not re.fullmatch(r'[a-f0-9]{32}', receipt_id):
            raise BridgeError(400, 'Invalid receipt identifier.')
        path = self.receipt_dir / (receipt_id + '.json')
        try:
            if path.is_symlink():
                raise BridgeError(403, 'Symlink receipt refused.')
            data = path.read_bytes()
            if len(data) > 32_000:
                raise BridgeError(413, 'Receipt exceeds boundary.')
            return json.loads(data)
        except FileNotFoundError as exc:
            raise BridgeError(404, 'Receipt not found.') from exc
