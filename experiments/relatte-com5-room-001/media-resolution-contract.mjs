import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  acceptMediaResolution,
  enterDoor,
  openNavigator,
  prepareMediaResolution,
} from './room.mjs';

const [address, descriptorPath] = process.argv.slice(2);
if (!address || !descriptorPath) {
  throw new Error('usage: node media-resolution-contract.mjs sha256:<digest> descriptor.json');
}

const packet = JSON.parse(
  readFileSync(new URL('./fixture-enterable-song.json', import.meta.url), 'utf8'),
);
const descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'));

const compose = packet.doors.find(door => door.role === 'COMPOSE');
const audio = compose?.instruments.find(instrument => instrument.kind === 'audio-player');
if (!audio) throw new Error('fixture audio-player missing');

audio.ref = address;
for (const media of packet.media_refs ?? []) {
  if (media.role === 'song' && media.media_type?.startsWith('audio/')) {
    media.address = address;
  }
}

const nav = openNavigator(packet);
assert.equal(nav.ok, true);

const room = enterDoor(nav, 'COMPOSE', true, 'room-encounter:vault-integration');
assert.equal(room.ok, true);

const request = prepareMediaResolution(room, 'lego:2:audio-player');
assert.equal(request.address, address);

const accepted = acceptMediaResolution(
  room,
  'lego:2:audio-player',
  descriptor,
);

assert.equal(accepted.ok, true);
assert.equal(accepted.resolvedMedia['lego:2:audio-player'].address, address);
assert.equal(
  accepted.resolvedMedia['lego:2:audio-player'].playbackUrl,
  descriptor.playbackUrl,
);
assert.equal(accepted.sourceMutated, false);
assert.equal(accepted.sharedWorldChanged, false);

console.log('Vault verified audio → ROroomOM audio Lego contract passed.');
