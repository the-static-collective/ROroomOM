"""ROroomOM-006: bounded effectful continuation of an externally VERIFIED joint.

Experimental local-only file effect; not a WORLDSEED verifier, remote authorization,
real human authentication, or a replacement for project-native receipts.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
import json
import os
from pathlib import Path
import sqlite3


class Refusal(RuntimeError):
    pass


def canonical(obj: object) -> bytes:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()


def digest(obj: object) -> str:
    return sha256(canonical(obj)).hexdigest()


@dataclass(frozen=True)
class JointAnchor:
    """Local caller must first verify WORLDSEED-004 and independently pin sources."""
    joint_id: str
    joint_pin: str
    root_id: str
    parent_states: tuple[str, str]
    parent_seals: tuple[str, str]
    tension: str
    unresolved: tuple[str, ...]

    def validate(self) -> None:
        if (not self.joint_id.startswith('join_') or len(self.joint_pin) != 64
                or any(c not in '0123456789abcdef' for c in self.joint_pin)
                or not self.root_id or len(self.parent_states) != 2
                or len(set(self.parent_states)) != 2
                or len(self.parent_seals) != 2 or len(set(self.parent_seals)) != 2
                or not all(self.parent_states) or not all(self.parent_seals)
                or not self.tension.strip() or not self.unresolved):
            raise Refusal('invalid or collapsed two-parent anchor')


def anchor_from_verified_joint(node: object, joint_pin: str) -> JointAnchor:
    """Adapter for a JointNode returned by WORLDSEED-004 verify_joint().

    A bare JointNode or attacker-provided pin is NOT proof of verified provenance;
    the owning caller must run verify_joint against three pinned seed bundles.
    """
    anchor = JointAnchor(
        joint_id=node.node_id, joint_pin=joint_pin,
        root_id=node.common_root,
        parent_states=tuple(p.head_state_id for p in node.parents),
        parent_seals=tuple(p.seed_seal for p in node.parents),
        tension=node.tension, unresolved=tuple(node.unresolved),
    )
    anchor.validate()
    return anchor


class RejoiningRoom:
    """Single-local-writer SQLite intent + create-only Room-owned outbox.

    sqlite transaction freezes the exact effect before filesystem publication.
    A known interrupted intent is reconciled explicitly, never blindly retried.
    """
    def __init__(self, root: Path, joint: JointAnchor):
        joint.validate()
        self.root = Path(root)
        self.joint = joint
        self.root.mkdir(parents=True, exist_ok=True)
        self.outbox = self.root / 'outbox'
        self.outbox.mkdir(exist_ok=True)
        self.db = sqlite3.connect(self.root / 'room006.sqlite3', isolation_level=None, timeout=3)
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('CREATE TABLE IF NOT EXISTS anchor (id INTEGER PRIMARY KEY CHECK(id=1), body BLOB NOT NULL)')
        self.db.execute('''CREATE TABLE IF NOT EXISTS crossings (
            id TEXT PRIMARY KEY, anchor_pin TEXT NOT NULL, effect BLOB NOT NULL,
            effect_sha TEXT NOT NULL, state TEXT NOT NULL, receipt BLOB)''')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            existing = self.db.execute('SELECT body FROM anchor WHERE id=1').fetchone()
            sealed = canonical(asdict(joint))
            if existing is None:
                self.db.execute('INSERT INTO anchor VALUES(1, ?)', (sealed,))
            elif existing[0] != sealed:
                raise Refusal('the Room belongs to another joint; refuse silent relinking')
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK')
            raise

    def close(self) -> None:
        self.db.close()

    def prepare(self, content: str) -> dict:
        if not isinstance(content, str) or not content.strip() or len(content.encode()) > 8192:
            raise Refusal('effect must be nonempty UTF-8 text of at most 8192 bytes')
        candidate = {
            'schema': 'roroomom.rejoining-room-006/v1', 'joint': self.joint.joint_id,
            'joint_pin': self.joint.joint_pin, 'parent_states': self.joint.parent_states,
            'parent_seals': self.joint.parent_seals,
            'operation': 'roroomom.outbox.create-one-markdown-v1',
            'content': content, 'tension': self.joint.tension,
            'unresolved': self.joint.unresolved,
            'scope': 'Room-owned outbox; no parent mutation or project adapter',
        }
        return {'candidate': candidate, 'candidate_id': 'roomprev_' + digest(candidate),
                'predicted_effect': 'one create-only Markdown file; independent Room receipt'}

    def _path(self, crossing_id: str) -> Path:
        return self.outbox / (crossing_id + '.md')

    def commit(self, preview: dict, *, approved_candidate_id: str, local_actor: str,
               crash_at: str | None = None) -> dict:
        """crash_at exists solely for deterministic BAT fault injection."""
        if not isinstance(preview, dict) or not isinstance(preview.get('candidate'), dict):
            raise Refusal('missing exact preview')
        c = preview['candidate']
        if set(preview) != {'candidate', 'candidate_id', 'predicted_effect'}:
            raise Refusal('unexpected preview fields')
        expected = self.prepare(c.get('content'))
        if preview != expected or approved_candidate_id != expected['candidate_id']:
            raise Refusal('tampered or unapproved preview')
        if not isinstance(local_actor, str) or not local_actor.strip():
            raise Refusal('explicit local test actor label required')
        crossing_id = 'roomx_' + digest({'candidate_id': approved_candidate_id,
                                        'local_actor': local_actor})
        effect = ('# Rejoining Room consequence\n\n'
                  + c['content'] + '\n\n---\n'
                  + 'Both parent histories remain separate.\n'
                  + 'Preserved tension: ' + self.joint.tension + '\n').encode()
        # Persist exact effect and intent before touching the Room-owned outbox.
        self.db.execute('BEGIN IMMEDIATE')
        try:
            row = self.db.execute('SELECT effect, effect_sha, state, receipt FROM crossings WHERE id=?',
                                  (crossing_id,)).fetchone()
            if row is not None:
                if row[0] != effect or row[1] != sha256(effect).hexdigest():
                    raise Refusal('crossing-id collision with different effect')
                self.db.execute('COMMIT')
            else:
                self.db.execute('INSERT INTO crossings VALUES(?,?,?,?,?,NULL)',
                            (crossing_id, self.joint.joint_pin, effect,
                             sha256(effect).hexdigest(), 'accepted'))
                self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK')
            raise
        if row is not None:
            return self.reconcile(crossing_id)
        if crash_at == 'after_intent':
            os._exit(71)
        return self.reconcile(crossing_id, publish=True, crash_at=crash_at)

    def reconcile(self, crossing_id: str, *, publish: bool = False,
                  crash_at: str | None = None) -> dict:
        row = self.db.execute('SELECT anchor_pin,effect,effect_sha,state,receipt FROM crossings WHERE id=?',
                              (crossing_id,)).fetchone()
        if row is None or row[0] != self.joint.joint_pin:
            raise Refusal('unknown crossing or different joint')
        _, effect, effect_sha, state, receipt = row
        path = self._path(crossing_id)
        if path.is_symlink():
            raise Refusal('symlinked artifact refused')
        if path.exists():
            if not path.is_file() or sha256(path.read_bytes()).hexdigest() != effect_sha:
                raise Refusal('existing artifact conflicts with durable intent')
        elif state == 'completed':
            raise Refusal('completed receipt points to missing artifact')
        elif publish and state == 'accepted':
            # Atomic create-only publication. A crash after link but before receipt
            # leaves an existing complete artifact which can be reconciled.
            temp = self.outbox / (crossing_id + '.tmp.' + str(os.getpid()))
            fd = os.open(temp, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, 'wb') as f:
                f.write(effect)
                f.flush()
                os.fsync(f.fileno())
            try:
                os.link(temp, path, follow_symlinks=False)
            except FileExistsError:
                if path.is_symlink() or sha256(path.read_bytes()).hexdigest() != effect_sha:
                    raise Refusal('outbox collision; cannot overwrite')
            finally:
                temp.unlink(missing_ok=True)
            dfd = os.open(self.outbox, os.O_RDONLY)
            try: os.fsync(dfd)
            finally: os.close(dfd)
        else:
            return {'status': 'accepted-needs-explicit-reconcile', 'crossing_id': crossing_id}
        if crash_at == 'after_artifact':
            os._exit(72)
        expected_receipt = {
            'schema': 'roroomom.rejoining-room-006-receipt/v1',
            'crossing_id': crossing_id, 'joint': self.joint.joint_id,
            'joint_pin': self.joint.joint_pin, 'parents': self.joint.parent_states,
            'parent_seals': self.joint.parent_seals,
            'descendant_id': 'roomstate_' + digest({'crossing': crossing_id, 'artifact': effect_sha}),
            'effect_sha256': effect_sha, 'status': 'completed',
            'tension': self.joint.tension, 'unresolved': self.joint.unresolved,
            'return_addresses': (('A', self.joint.parent_seals[0]),
                                 ('B', self.joint.parent_seals[1]),
                                 ('joint', self.joint.joint_id)),
            'scope': 'Room-owned local artifact; no project-native execution authority',
        }
        sealed = canonical(expected_receipt)
        if receipt is not None and receipt != sealed:
            raise Refusal('durable receipt differs from reconstructed outcome')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            current = self.db.execute('SELECT state,receipt FROM crossings WHERE id=?',
                                      (crossing_id,)).fetchone()
            if current[1] is not None and current[1] != sealed:
                raise Refusal('concurrent or forged receipt')
            self.db.execute('UPDATE crossings SET state=?,receipt=? WHERE id=?',
                            ('completed', sealed, crossing_id))
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK')
            raise
        if crash_at == 'after_receipt':
            os._exit(73)
        return {'status': 'completed', 'receipt': expected_receipt, 'artifact': str(path)}

    def inspect(self, crossing_id: str) -> dict:
        return self.reconcile(crossing_id)
