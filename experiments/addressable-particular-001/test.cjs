'use strict';
const assert = require('node:assert/strict');
const { AddressableField } = require('./kernel.js');

const w = label => ({ kind: 'synthetic-test-witness', label });
const root = (field, id, kind = 'artifact', returnAddress = 'room:return') => field.addParticular({
  id, kind, localWitness: w('local:' + id), sourceWitness: w('source:' + id),
  unresolvedResidue: ['still-open:' + id], returnAddress, payload: { native: kind }
});

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log('ok ' + passed + ' - ' + name);
};

test('phase crossing conserves a tiny witness capsule while every medium gets fresh identity and native payload', () => {
  const f = new AddressableField();
  root(f, 'cup-act', 'performed-event', 'room:blue-cup');
  f.addParticular({ id: 'human-lu', kind: 'actor', localWitness: w('actor'), returnAddress: 'room:porch' });
  f.grantAuthority({ id: 'auth:cup', grantor: 'human-lu', subject: 'cup-act', scope: 'source-edit', witness: w('explicit grant') });

  const print = f.cross({ id: 'print-mark', sourceId: 'cup-act', kind: 'print-mark', localWitness: w('press'), payload: { ink: 'lemon' } });
  const receipt = f.cross({ id: 'receipt', sourceId: 'print-mark', kind: 'receipt', localWitness: w('receipt'), payload: { json: true } });
  const door = f.cross({ id: 'door', sourceId: 'receipt', kind: 'door-packet', localWitness: w('loom'), payload: { consent: 'required' } });
  const score = f.cross({ id: 'room-score', sourceId: 'door', kind: 'room-score', localWitness: w('room'), payload: { cards: 2 } });
  const film = f.cross({ id: 'film-cue', sourceId: 'room-score', kind: 'film-cue', localWitness: w('blender'), payload: { frame: 144 } });
  const song = f.cross({ id: 'song-motif', sourceId: 'film-cue', kind: 'song-motif', localWitness: w('toaster'), payload: { motif: 'E022100' } });

  assert.equal(f.sameParticular('cup-act', 'song-motif'), false);
  assert.deepEqual(song.conserved.sourceWitness, f.particular('cup-act').conserved.sourceWitness);
  assert.deepEqual(song.conserved.ancestry, ['cup-act', 'print-mark', 'receipt', 'door', 'room-score', 'film-cue']);
  assert.equal(song.conserved.returnAddress, 'room:blue-cup');
  assert.equal(song.payload.motif, 'E022100');
  assert.equal(f.authorityClaims('song-motif').length, 0, 'authority must not ride the phase crossing');
  assert.equal(f.authorityClaims('cup-act').length, 1);
  assert.equal(f.compareOrder('cup-act', 'song-motif', 'publication'), 'unknown');

  f.removeParticular('film-cue');
  assert.equal(f.particular('cup-act').id, 'cup-act', 'removing a descendant must not damage its ancestor');
  assert.equal(f.particular('song-motif').conserved.ancestry.includes('film-cue'), true, 'history may retain an address to a removed descendant');
});

test('one coordinate can hold rival 007 occupants without inventing order', () => {
  const f = new AddressableField();
  for (let n = 1; n <= 6; n++) {
    const id = 'volume-00' + n;
    root(f, id, 'book', 'lemon:shelf/' + String(n).padStart(3, '0'));
    f.ensureCoordinate('lemon:' + String(n).padStart(3, '0'), 'ordinal-address');
    f.occupy({ id: 'occ:' + id, coordinate: 'lemon:' + String(n).padStart(3, '0'), particular: id, witness: w('shelf ' + n) });
  }

  root(f, 'volume-007-B', 'book', 'lemon:007');
  root(f, 'volume-007-A', 'book', 'lemon:007');
  f.ensureCoordinate('lemon:007', 'contested-ordinal-address');
  // Deliberately insert B before A. Storage order is not fictional chronology.
  f.occupy({ id: 'occ:007-B', coordinate: 'lemon:007', particular: 'volume-007-B', witness: w('independent B') });
  f.occupy({ id: 'occ:007-A', coordinate: 'lemon:007', particular: 'volume-007-A', witness: w('independent A') });

  assert.deepEqual(f.occupants('lemon:007').occupants, ['volume-007-A', 'volume-007-B']);
  assert.equal(f.occupants('lemon:007').ordering, 'not-asserted');
  assert.equal(f.compareOrder('volume-007-A', 'volume-007-B', 'publication'), 'unknown');
  assert.equal(f.compareOrder('volume-007-A', 'volume-007-B', 'fictional'), 'unknown');
  assert.equal(f.compareOrder('volume-007-A', 'volume-007-B', 'reader'), 'unknown');

  const beforeSelection = f.semanticDigest();
  assert.equal(f.selectOccupant('lemon:007', 'volume-007-B').id, 'volume-007-B');
  assert.equal(f.semanticDigest(), beforeSelection, 'reader selection must not manufacture chronology');

  f.cross({ id: 'volume-008-A', sourceId: 'volume-007-A', kind: 'book', localWitness: w('A descendant') });
  f.cross({ id: 'volume-008-B', sourceId: 'volume-007-B', kind: 'book', localWitness: w('B descendant') });
  root(f, 'volume-008-AB', 'book', 'lemon:008');
  f.relate({ id: 'merge:A', from: 'volume-008-AB', to: 'volume-007-A', type: 'derived-from', witness: w('common descendant A') });
  f.relate({ id: 'merge:B', from: 'volume-008-AB', to: 'volume-007-B', type: 'derived-from', witness: w('common descendant B') });

  assert.equal(f.compareOrder('volume-007-A', 'volume-007-B', 'genealogical'), 'unknown', 'a common descendant does not order its parents');
  assert.equal(f.relationClaims('volume-007-A', 'volume-007-B').length, 0, 'shared address alone is not a relation claim');

  f.claimOrder({ id: 'explicit-reader-order', axis: 'reader', before: 'volume-007-B', after: 'volume-007-A', witness: w('a reader actually chose B first') });
  assert.equal(f.compareOrder('volume-007-A', 'volume-007-B', 'reader'), 'after');
  assert.equal(f.compareOrder('volume-007-A', 'volume-007-B', 'publication'), 'unknown', 'one order axis cannot leak into another');
});

test('calendar recurrence exposes eligibility but creates no occurrence until somebody arrives', () => {
  const f = new AddressableField();
  root(f, 'founding-2026-09-24', 'founding-witness', 'calendar:09/24');
  const foundingBefore = f.particular('founding-2026-09-24');

  f.defineRecurrence({
    id: 'static-day',
    coordinate: 'calendar:09/24',
    month: 9,
    day: 24,
    foundingParticular: 'founding-2026-09-24',
    witness: w('recurrence invitation')
  });

  const e2027 = f.eligibility('static-day', 2027);
  assert.equal(f.occupants('calendar:09/24').occupants.length, 1, 'eligibility alone must not create history');
  f.arrive({ eligibility: e2027, occurrenceId: 'static-day-2027', localWitness: w('2027 participants'), payload: { activity: 'arrived' } });

  const e2028 = f.eligibility('static-day', 2028);
  assert.equal(e2028.eligible, true);
  // Intentionally no arrive() call in 2028.
  assert.equal(f.hasCoordinate('calendar:2028-09-24'), false, 'a missed year must not manufacture a dated occurrence-address');

  const e2029 = f.eligibility('static-day', 2029);
  f.arrive({ eligibility: e2029, occurrenceId: 'static-day-2029', localWitness: w('2029 participants'), payload: { activity: 'returned' } });

  assert.deepEqual(f.occupants('calendar:09/24').occupants, ['founding-2026-09-24', 'static-day-2027', 'static-day-2029']);
  assert.equal(f.sameParticular('founding-2026-09-24', 'static-day-2027'), false);
  assert.equal(f.sameParticular('static-day-2027', 'static-day-2029'), false);
  assert.equal(f.authorityClaims('static-day-2027').length, 0);
  assert.equal(f.authorityClaims('static-day-2029').length, 0);
  assert.deepEqual(f.particular('founding-2026-09-24'), foundingBefore, 'reentry must not rewrite the founding witness');
  assert.equal(f.particular('static-day-2027').conserved.ancestry.length, 0, 'shared date address is not genealogical ancestry');
});

test('coordinate, content, relation, and authority remain independently queryable', () => {
  const f = new AddressableField();
  root(f, 'A', 'artifact', 'room:home');
  root(f, 'B', 'artifact', 'room:home');
  f.ensureCoordinate('room:home', 'room-address');
  f.occupy({ id: 'home:A', coordinate: 'room:home', particular: 'A', witness: w('A arrived') });
  f.occupy({ id: 'home:B', coordinate: 'room:home', particular: 'B', witness: w('B arrived') });

  assert.equal(f.sameParticular('A', 'B'), false);
  assert.equal(f.relationClaims('A', 'B').length, 0);
  assert.equal(f.compareOrder('A', 'B', 'anything'), 'unknown');
  assert.equal(f.authorityClaims('A').length, 0);
  assert.equal(f.occupants('room:home').occupants.length, 2);
});

console.log('\n' + passed + ' ADDRESSABLE-PARTICULAR-001 hostile tests passed.');
