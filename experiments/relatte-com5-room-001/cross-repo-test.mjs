import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { enterDoor, openNavigator } from './room.mjs';

const path=process.argv[2];
if(!path) throw new Error('Usage: node cross-repo-test.mjs /path/to/enterable.json');

const packet=JSON.parse(readFileSync(path,'utf8'));
const nav=openNavigator(packet);

assert.equal(nav.ok,true,'ROroomOM must accept the real reLATTE enterable packet');
assert.equal(nav.sourceSubject,packet.subject);

const compose=enterDoor(nav,'COMPOSE',true,'room-encounter:cross-repo');
assert.equal(compose.ok,true);

const kinds=compose.instrumentDeck.map(item=>item.kind);
assert.deepEqual(kinds,[
  'relation-board',
  'audio-player',
  'text-sheet',
  'video-player',
]);

assert.equal(compose.sourceSubject,packet.subject);
assert.equal(compose.sourceAuthority,'none');
assert.equal(compose.sourceMutated,false);
assert.equal(compose.sharedWorldChanged,false);

console.log('reLATTE → COM⁵ → ROroomOM producer/consumer contract passed.');
