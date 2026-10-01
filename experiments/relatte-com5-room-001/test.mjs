import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  acceptMediaResolution,
  actEncounter,
  enterDoor,
  exportEncounterReceipt,
  makeNavigationRequest,
  openNavigator,
  prepareMediaResolution,
  useInstrument,
} from './room.mjs';

const fixture=JSON.parse(
  readFileSync(new URL('./fixture-enterable-song.json',import.meta.url),'utf8')
);

test('one source particular opens as one navigator with five doors',()=>{
  const nav=openNavigator(fixture);
  assert.equal(nav.ok,true);
  assert.equal(nav.sourceSubject,fixture.subject);
  assert.deepEqual(nav.doors.map(door=>door.role),[
    'COMPOST','COMPOSE','COMPUTE','COMMUTE','COMMUNE'
  ]);
  assert.equal(nav.sourceMutated,false);
});

test('COMPOSE creates a fresh local room with media Magic Lego',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:test-compose');

  assert.equal(room.ok,true);
  assert.notEqual(room.encounterId,room.sourceSubject);
  assert.equal(room.sourceDoor,'COMPOSE');
  assert.deepEqual(room.instrumentDeck.map(item=>item.kind),[
    'relation-board','audio-player','text-sheet','video-player','image-viewer'
  ]);
  assert.equal(room.sourceAuthority,'none');
  assert.equal(room.sourceMutated,false);
});

test('different doors render different rooms over the same subject',()=>{
  const nav=openNavigator(fixture);
  const compose=enterDoor(nav,'COMPOSE',true,'room-encounter:compose');
  const commute=enterDoor(nav,'COMMUTE',true,'room-encounter:commute');

  assert.equal(compose.sourceSubject,commute.sourceSubject);
  assert.notEqual(compose.encounterId,commute.encounterId);
  assert.deepEqual(compose.instrumentDeck.map(item=>item.kind),[
    'relation-board','audio-player','text-sheet','video-player','image-viewer'
  ]);
  assert.deepEqual(commute.instrumentDeck.map(item=>item.kind),['road-map']);
});

test('door entry requires explicit local acceptance',()=>{
  const nav=openNavigator(fixture);
  const refused=enterDoor(nav,'COMPOSE',false,'room-encounter:nope');
  assert.equal(refused.ok,false);
  assert.equal(refused.code,'acceptance-required');
});

test('instrument use remains a local encounter event',()=>{
  const nav=openNavigator(fixture);
  let room=enterDoor(nav,'COMPOSE',true,'room-encounter:use');
  room=useInstrument(room,'lego:2:audio-player');

  assert.equal(room.ok,true);
  assert.equal(room.localHistory.at(-1)?.type,'USE_INSTRUMENT');
  assert.equal(room.localHistory.at(-1)?.kind,'audio-player');
  assert.equal(room.sourceMutated,false);
  assert.equal(room.sharedWorldChanged,false);
});

test('leave and return preserve the encounter identity',()=>{
  const nav=openNavigator(fixture);
  let room=enterDoor(nav,'COMMUTE',true,'room-encounter:return');
  room=actEncounter(room,'LEAVE');
  room=actEncounter(room,'RETURN');

  assert.equal(room.encounterId,'room-encounter:return');
  assert.equal(room.phase,'returned');
  assert.deepEqual(room.localHistory.map(item=>item.type),['ENTER_DOOR','LEAVE','RETURN']);
});

test('local export does not masquerade as a reLATTE receipt',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPUTE',true,'room-encounter:receipt');
  const receipt=exportEncounterReceipt(room);

  assert.equal(receipt.format,'roroomom.relatte-com5-local-encounter');
  assert.equal(receipt.sourceSubject,fixture.subject);
  assert.equal(receipt.sourceDoor,'COMPUTE');
  assert.equal(receipt.sourceAuthority,'none');
  assert.equal(receipt.sourceMutated,false);
  assert.ok(receipt.boundary.includes('ROOM RECEIPT != reLATTE RECEIPT'));
});

test('authority inflation is refused',()=>{
  const tampered=structuredClone(fixture);
  tampered.authority='source-grant';
  const nav=openNavigator(tampered);
  assert.equal(nav.ok,false);
  assert.equal(nav.code,'authority-overclaim');
});


test('Room can ask reLATTE to reverify one projected neighbor',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:return-request');
  const request=makeNavigationRequest(room,'particular:listener');

  assert.equal(request.format,'roroomom.relatte-navigation-request/v0');
  assert.equal(request.source_subject,fixture.subject);
  assert.equal(request.requested_subject,'particular:listener');
  assert.equal(request.authority,'none');
  assert.ok(request.boundary.includes('reLATTE MUST REVERIFY NEIGHBOR'));
});

test('Room refuses to request a destination absent from the source projection',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:return-request-refuse');
  const request=makeNavigationRequest(room,'particular:invented');

  assert.equal(request.ok,false);
  assert.equal(request.code,'not-source-neighbor');
});


test('audio resolution request preserves exact Lego address',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:audio-resolve');
  const request=prepareMediaResolution(room,'lego:2:audio-player');

  assert.equal(request.schema,'roroomom.media-resolution-request/v0');
  assert.equal(request.address,'sha256:'+'1'.repeat(64));
  assert.equal(request.authority,'none');
});

test('matching Vault resolution upgrades the local audio instrument only',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:audio-accept');
  const digest='1'.repeat(64);

  const next=acceptMediaResolution(room,'lego:2:audio-player',{
    organ:'autodiscography-vault.audio-resolver-v0',
    status:'resolved-verified',
    address:'sha256:'+digest,
    sha256:digest,
    mediaType:'audio/wav',
    byteLength:4096,
    playbackUrl:'http://127.0.0.1:13703/v0/media/'+digest,
    authority:'none',
  });

  assert.equal(next.ok,true);
  assert.equal(next.resolvedMedia['lego:2:audio-player'].sha256,digest);
  assert.equal(next.localHistory.at(-1)?.type,'MEDIA_RESOLVED');
  assert.equal(next.sourceMutated,false);
});

test('Vault resolver cannot substitute another audio address',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:audio-substitution');

  const refused=acceptMediaResolution(room,'lego:2:audio-player',{
    organ:'autodiscography-vault.audio-resolver-v0',
    status:'resolved-verified',
    address:'sha256:'+'2'.repeat(64),
    sha256:'2'.repeat(64),
    mediaType:'audio/wav',
    byteLength:4096,
    playbackUrl:'http://127.0.0.1:13703/v0/media/'+'2'.repeat(64),
    authority:'none',
  });

  assert.equal(refused.ok,false);
  assert.equal(refused.code,'media-resolution-mismatch');
});

test('non-audio Lego block cannot use first Vault audio resolver',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:not-audio');
  const request=prepareMediaResolution(room,'lego:3:text-sheet');

  assert.equal(request.ok,false);
  assert.equal(request.code,'not-audio-instrument');
});
