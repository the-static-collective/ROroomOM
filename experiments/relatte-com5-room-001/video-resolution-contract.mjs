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
  throw new Error('usage: node video-resolution-contract.mjs sha256:<digest> descriptor.json');
}

const packet = JSON.parse(
  readFileSync(new URL('./fixture-enterable-song.json', import.meta.url), 'utf8'),
);
const descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'));

const compose = packet.doors.find(door => door.role === 'COMPOSE');
const video = compose?.instruments.find(instrument => instrument.kind === 'video-player');
if (!video) throw new Error('fixture video-player missing');

video.ref = address;
for (const media of packet.media_refs ?? []) {
  if (media.role === 'video' && media.media_type === 'video/mp4') {
    media.address = address;
  }
}

const nav = openNavigator(packet);
assert.equal(nav.ok, true);

const room = enterDoor(nav, 'COMPOSE', true, 'room-encounter:video-integration');
assert.equal(room.ok, true);

const request = prepareMediaResolution(room, 'lego:4:video-player');
assert.equal(request.address, address);
assert.equal(request.expectedOrgan, 'haunted-blender.accepted-video-resolver-v0');

const accepted = acceptMediaResolution(
  room,
  'lego:4:video-player',
  descriptor,
);

assert.equal(accepted.ok, true);
assert.equal(accepted.resolvedMedia['lego:4:video-player'].address, address);
assert.equal(
  accepted.resolvedMedia['lego:4:video-player'].playbackUrl,
  descriptor.playbackUrl,
);
assert.equal(
  accepted.resolvedMedia['lego:4:video-player'].distributionAuthorized,
  false,
);
assert.equal(accepted.sourceMutated, false);
assert.equal(accepted.sharedWorldChanged, false);

console.log('Haunted Blender accepted video → ROroomOM Video Window contract passed.');
