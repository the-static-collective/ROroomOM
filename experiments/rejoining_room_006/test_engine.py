"""ROroomOM-006 local-only BATs. No user authentication or external writes."""
from dataclasses import replace
from pathlib import Path
import json
import subprocess
import sys
import tempfile
import unittest

from engine import JointAnchor, RejoiningRoom, Refusal, digest


JOINT = JointAnchor(
    joint_id='join_' + 'a'*64, joint_pin='a'*64, root_id='root-A',
    parent_states=('state-A', 'state-B'), parent_seals=('a'*64, 'b'*64),
    tension='invitation versus warning', unresolved=('Who rang the bell?',),
)


class Bats(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.room = RejoiningRoom(self.root, JOINT)
        self.before = self.room.prepare('The bell sounded.')

    def tearDown(self):
        self.room.close()
        self.temp.cleanup()

    def approve(self, preview=None, **kw):
        p = preview or self.before
        return self.room.commit(p, approved_candidate_id=p['candidate_id'],
                                local_actor='local-human-test-label', **kw)

    def test_01_exact_preview_then_one_room_owned_effect(self):
        self.assertFalse(list(self.room.outbox.iterdir()))
        r = self.approve()
        self.assertEqual(r['status'], 'completed')
        self.assertEqual(len(list(self.room.outbox.glob('*.md'))), 1)
        self.assertEqual(r['receipt']['parents'], JOINT.parent_states)
        self.assertEqual(len(r['receipt']['return_addresses']), 3)

    def test_02_duplicate_commit_does_not_repeat_effect(self):
        original = self.approve()
        again = self.approve()
        self.assertEqual(original, again)
        self.assertEqual(len(list(self.room.outbox.glob('*.md'))), 1)

    def test_03_tampered_preview_refused(self):
        fake = dict(self.before)
        fake['candidate'] = {**fake['candidate'], 'parent_states': ('state-A', 'state-A')}
        with self.assertRaises(Refusal): self.approve(fake)
        self.assertFalse(list(self.room.outbox.iterdir()))

    def test_04_wrong_or_missing_cut_refused(self):
        with self.assertRaises(Refusal): self.room.commit(self.before, approved_candidate_id='wrong', local_actor='human')
        with self.assertRaises(Refusal): self.room.commit(self.before, approved_candidate_id=self.before['candidate_id'], local_actor='')
        self.assertFalse(list(self.room.outbox.iterdir()))

    def test_05_collapsed_parent_refused(self):
        with self.assertRaises(Refusal): RejoiningRoom(self.root / 'other', replace(JOINT, parent_states=('x', 'x')))

    def test_06_joint_substitution_refused_after_restart(self):
        with self.assertRaises(Refusal): RejoiningRoom(self.root, replace(JOINT, joint_id='join_' + 'b'*64))

    def test_07_missing_completed_artifact_refused(self):
        r = self.approve()
        Path(r['artifact']).unlink()
        with self.assertRaises(Refusal): self.room.inspect(r['receipt']['crossing_id'])
        self.assertFalse(list(self.room.outbox.glob('*.md')))

    def test_08_modified_artifact_refused(self):
        r = self.approve()
        Path(r['artifact']).write_text('counterfeit')
        with self.assertRaises(Refusal): self.room.inspect(r['receipt']['crossing_id'])

    def test_09_parent_states_and_input_unmodified(self):
        initial = JOINT
        self.approve()
        self.assertEqual(self.room.joint, initial)
        self.assertEqual(self.room.db.execute('SELECT count(*) FROM crossings').fetchone()[0], 1)

    def test_10_distinct_effects_make_distinct_descendants(self):
        a = self.approve()
        b = self.approve(self.room.prepare('Second shared creation'))
        self.assertNotEqual(a['receipt']['descendant_id'], b['receipt']['descendant_id'])
        self.assertEqual(len(list(self.room.outbox.glob('*.md'))), 2)

    def test_11_unknown_crossing_refused(self):
        with self.assertRaises(Refusal): self.room.inspect('roomx_unknown')

    def test_12_after_intent_crash_requires_explicit_reconciliation(self):
        p=self.before
        cid='roomx_'+digest({'candidate_id':p['candidate_id'],'local_actor':'local-human-test-label'})
        self._child_crash('after_intent', 71)
        self.assertEqual(self.room.inspect(cid)['status'], 'accepted-needs-explicit-reconcile')
        self.assertFalse(list(self.room.outbox.glob('*.md')))
        resolved=self.room.reconcile(cid,publish=True)
        self.assertEqual(resolved['status'],'completed')
        self.assertEqual(len(list(self.room.outbox.glob('*.md'))),1)

    def test_13_after_artifact_crash_recovers_receipt_without_reexecution(self):
        p=self.before
        cid='roomx_'+digest({'candidate_id':p['candidate_id'],'local_actor':'local-human-test-label'})
        self._child_crash('after_artifact',72)
        self.assertEqual(len(list(self.room.outbox.glob('*.md'))),1)
        mtime = next(self.room.outbox.glob('*.md')).stat().st_mtime_ns
        recovered = self.room.inspect(cid)
        self.assertEqual(recovered['status'],'completed')
        self.assertEqual(next(self.room.outbox.glob('*.md')).stat().st_mtime_ns,mtime)

    def test_14_after_receipt_crash_replays_same_completed_receipt(self):
        p=self.before
        cid='roomx_'+digest({'candidate_id':p['candidate_id'],'local_actor':'local-human-test-label'})
        self._child_crash('after_receipt',73)
        recovered=self.room.inspect(cid)
        self.assertEqual(recovered['status'],'completed')
        self.assertEqual(len(list(self.room.outbox.glob('*.md'))),1)

    def test_15_cross_process_open_and_inspect_existing_effect(self):
        r=self.approve()
        code='''import json,sys; from pathlib import Path; from engine import JointAnchor, RejoiningRoom
joint=JointAnchor(**json.loads(sys.argv[2])); room=RejoiningRoom(Path(sys.argv[1]),joint)
print(json.dumps(room.inspect(sys.argv[3])));room.close()'''
        child=subprocess.run([sys.executable,'-c',code,str(self.root),json.dumps(JOINT.__dict__),r['receipt']['crossing_id']],capture_output=True,text=True,check=True,cwd=Path(__file__).parent)
        self.assertEqual(json.loads(child.stdout)['receipt']['descendant_id'],r['receipt']['descendant_id'])

    def _child_crash(self, point, expected):
        code='''import sys,json;from pathlib import Path;from engine import JointAnchor,RejoiningRoom
j=JointAnchor(**json.loads(sys.argv[2]));r=RejoiningRoom(Path(sys.argv[1]),j)
p=r.prepare("The bell sounded.");r.commit(p,approved_candidate_id=p["candidate_id"],local_actor="local-human-test-label",crash_at=sys.argv[3])'''
        result=subprocess.run([sys.executable,'-c',code,str(self.root),json.dumps(JOINT.__dict__),point],cwd=Path(__file__).parent, capture_output=True)
        self.assertEqual(result.returncode,expected, result.stderr.decode())


if __name__=='__main__': unittest.main()
