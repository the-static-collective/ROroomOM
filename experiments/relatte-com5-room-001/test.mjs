import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  acceptLocalTextBytes,
  acceptMediaResolution,
  actEncounter,
  compileRoomScore,
  enterDoor,
  exportEncounterReceipt,
  makeNavigationRequest,
  openNavigator,
  prepareMediaResolution,
  prepareTextResolution,
  roomScoreFrame,
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

test('unsupported Lego block has no media resolver',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:not-audio');
  const request=prepareMediaResolution(room,'lego:3:text-sheet');

  assert.equal(request.ok,false);
  assert.equal(request.code,'no-media-resolver');
});


test('video resolution request selects the Haunted Blender organ',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:video-resolve');
  const request=prepareMediaResolution(room,'lego:4:video-player');

  assert.equal(request.schema,'roroomom.media-resolution-request/v0');
  assert.equal(request.instrumentKind,'video-player');
  assert.equal(request.address,'sha256:'+'3'.repeat(64));
  assert.equal(request.expectedOrgan,'haunted-blender.accepted-video-resolver-v0');
  assert.deepEqual(request.expectedStatuses,['resolved-filmmaker-accepted-private-take']);
  assert.deepEqual(request.expectedMediaTypes,['video/mp4']);
});

test('matching Haunted Blender acceptance upgrades only the local Video Window',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:video-accept');
  const digest='3'.repeat(64);

  const next=acceptMediaResolution(room,'lego:4:video-player',{
    organ:'haunted-blender.accepted-video-resolver-v0',
    status:'resolved-filmmaker-accepted-private-take',
    address:'sha256:'+digest,
    sha256:digest,
    mediaType:'video/mp4',
    byteLength:8192,
    playbackUrl:'http://127.0.0.1:13704/v0/media/'+digest,
    distributionAuthorized:false,
    authority:'none',
  });

  assert.equal(next.ok,true);
  assert.equal(next.resolvedMedia['lego:4:video-player'].sha256,digest);
  assert.equal(next.resolvedMedia['lego:4:video-player'].distributionAuthorized,false);
  assert.equal(next.sourceMutated,false);
  assert.equal(next.sharedWorldChanged,false);
});

test('candidate status cannot masquerade as accepted Video Window media',()=>{
  const nav=openNavigator(fixture);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:video-candidate');
  const digest='3'.repeat(64);

  const refused=acceptMediaResolution(room,'lego:4:video-player',{
    organ:'haunted-blender.accepted-video-resolver-v0',
    status:'candidate_admitted_not_filmmaker_accepted',
    address:'sha256:'+digest,
    sha256:digest,
    mediaType:'video/mp4',
    byteLength:8192,
    playbackUrl:'http://127.0.0.1:13704/v0/media/'+digest,
    distributionAuthorized:false,
    authority:'none',
  });

  assert.equal(refused.ok,false);
  assert.equal(refused.code,'media-resolution-mismatch');
});


function scoredFixture(lyrics){
  const value=structuredClone(fixture);
  const digest=createHash('sha256').update(Buffer.from(lyrics,'utf8')).digest('hex');
  const compose=value.doors.find(door=>door.role==='COMPOSE');
  const sheet=compose.instruments.find(item=>item.kind==='text-sheet');
  const media=value.media_refs.find(item=>item.role==='lyrics');
  sheet.ref='sha256:'+digest;
  media.address='sha256:'+digest;
  return {value,digest};
}

async function resolvedScoreRoom(lyrics='Line one\nLine two\nLine three\nLine four'){
  const {value,digest}=scoredFixture(lyrics);
  const nav=openNavigator(value);
  let room=enterDoor(nav,'COMPOSE',true,'room-encounter:room-score');

  room=acceptMediaResolution(room,'lego:2:audio-player',{
    organ:'autodiscography-vault.audio-resolver-v0',
    status:'resolved-verified',
    address:'sha256:'+'1'.repeat(64),
    sha256:'1'.repeat(64),
    mediaType:'audio/wav',
    byteLength:4096,
    playbackUrl:'http://127.0.0.1:13703/v0/media/'+'1'.repeat(64),
    authority:'none',
  });

  room=acceptMediaResolution(room,'lego:4:video-player',{
    organ:'haunted-blender.accepted-video-resolver-v0',
    status:'resolved-filmmaker-accepted-private-take',
    address:'sha256:'+'3'.repeat(64),
    sha256:'3'.repeat(64),
    mediaType:'video/mp4',
    byteLength:8192,
    playbackUrl:'http://127.0.0.1:13704/v0/media/'+'3'.repeat(64),
    distributionAuthorized:false,
    authority:'none',
  });

  room=await acceptLocalTextBytes(room,'lego:3:text-sheet',Buffer.from(lyrics,'utf8'));
  return {room,digest,lyrics};
}

test('Text Sheet accepts only exact local UTF-8 bytes for its address',async()=>{
  const lyrics='First line\nSecond line\nThird line';
  const {value,digest}=scoredFixture(lyrics);
  const nav=openNavigator(value);
  const room=enterDoor(nav,'COMPOSE',true,'room-encounter:text-exact');

  const request=prepareTextResolution(room,'lego:3:text-sheet');
  assert.equal(request.address,'sha256:'+digest);

  const accepted=await acceptLocalTextBytes(room,'lego:3:text-sheet',Buffer.from(lyrics,'utf8'));
  assert.equal(accepted.ok,true);
  assert.equal(accepted.resolvedText['lego:3:text-sheet'].sha256,digest);
  assert.equal(accepted.resolvedText['lego:3:text-sheet'].lineCount,3);
  assert.equal(accepted.sourceMutated,false);

  const refused=await acceptLocalTextBytes(room,'lego:3:text-sheet',Buffer.from(lyrics+'!','utf8'));
  assert.equal(refused.ok,false);
  assert.equal(refused.code,'text-address-mismatch');
});

test('Room Score compiles already-resolved Lego without merging source identities',async()=>{
  const {room,digest}=await resolvedScoreRoom();
  const scored=compileRoomScore(room,{
    schema:'roroomom.room-score/v0',
    title:'First local score',
    clock:'lego:2:audio-player',
    mediaTracks:[
      {instrument:'lego:2:audio-player',offsetMs:0},
      {instrument:'lego:4:video-player',offsetMs:250},
    ],
    lyricTrack:{
      instrument:'lego:3:text-sheet',
      cues:[
        {atMs:0,fromLine:1,toLine:2},
        {atMs:1000,fromLine:3,toLine:4},
      ],
    },
  });

  assert.equal(scored.ok,true);
  assert.equal(scored.roomScore.status,'compiled-local-arrangement');
  assert.equal(scored.roomScore.mediaTracks[0].sourceRef,'sha256:'+'1'.repeat(64));
  assert.equal(scored.roomScore.mediaTracks[1].sourceRef,'sha256:'+'3'.repeat(64));
  assert.equal(scored.roomScore.lyricTrack.sourceRef,'sha256:'+digest);
  assert.ok(scored.roomScore.boundary.includes('SYNC != MERGER'));
  assert.equal(scored.sourceMutated,false);
  assert.equal(scored.sharedWorldChanged,false);
});

test('Room Score frame conducts media offsets and lyric cues from one local clock',async()=>{
  const {room}=await resolvedScoreRoom();
  const scored=compileRoomScore(room,{
    schema:'roroomom.room-score/v0',
    title:'Conducted room',
    clock:'lego:2:audio-player',
    mediaTracks:[
      {instrument:'lego:2:audio-player',offsetMs:0},
      {instrument:'lego:4:video-player',offsetMs:250},
    ],
    lyricTrack:{
      instrument:'lego:3:text-sheet',
      cues:[
        {atMs:0,fromLine:1,toLine:2},
        {atMs:1000,fromLine:3,toLine:4},
      ],
    },
  });

  const early=roomScoreFrame(scored,500);
  assert.equal(early.ok,true);
  assert.equal(early.media[0].desiredTimeSeconds,0.5);
  assert.equal(early.media[1].desiredTimeSeconds,0.75);
  assert.equal(early.lyric.text,'Line one\nLine two');

  const later=roomScoreFrame(scored,1250);
  assert.equal(later.lyric.text,'Line three\nLine four');
});

test('Room Score refuses unresolved tracks and encounter receipt omits lyric plaintext',async()=>{
  const {value}=scoredFixture('private lyric\nsecond line');
  const nav=openNavigator(value);
  const bare=enterDoor(nav,'COMPOSE',true,'room-encounter:score-refuse');

  const refused=compileRoomScore(bare,{
    schema:'roroomom.room-score/v0',
    title:'Too early',
    clock:'lego:2:audio-player',
    mediaTracks:[{instrument:'lego:2:audio-player',offsetMs:0}],
    lyricTrack:{
      instrument:'lego:3:text-sheet',
      cues:[{atMs:0,fromLine:1,toLine:1}],
    },
  });
  assert.equal(refused.ok,false);
  assert.equal(refused.code,'unresolved-score-clock');

  const {room}=await resolvedScoreRoom('private lyric\nsecond line');
  const receipt=exportEncounterReceipt(room);
  assert.equal(receipt.resolvedText['lego:3:text-sheet'].lineCount,2);
  assert.equal('text' in receipt.resolvedText['lego:3:text-sheet'],false);
  assert.equal(JSON.stringify(receipt).includes('private lyric'),false);
});
