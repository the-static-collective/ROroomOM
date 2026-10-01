import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  acceptLocalTextBytes,
  acceptMediaResolution,
  actRoomScore,
  compileRoomScore,
  createAiRoomScoreProposal,
  createPerformanceMemory,
  enterDoor,
  openNavigator,
  resolveHumanAiCrossing,
} from './room.mjs';

const [audioPath,videoPath,lyricsPath] = process.argv.slice(2);
if (!audioPath || !videoPath || !lyricsPath) {
  throw new Error('usage: node human-ai-crossing-contract.mjs audio.json video.json lyrics.txt');
}

const packet=JSON.parse(
  readFileSync(new URL('./fixture-enterable-song.json',import.meta.url),'utf8'),
);
const audio=JSON.parse(readFileSync(audioPath,'utf8'));
const video=JSON.parse(readFileSync(videoPath,'utf8'));
const lyrics=readFileSync(lyricsPath);
const lyricDigest=createHash('sha256').update(lyrics).digest('hex');
const lyricAddress='sha256:'+lyricDigest;

const compose=packet.doors.find(door=>door.role==='COMPOSE');
compose.instruments.find(item=>item.kind==='audio-player').ref=audio.address;
compose.instruments.find(item=>item.kind==='video-player').ref=video.address;
compose.instruments.find(item=>item.kind==='text-sheet').ref=lyricAddress;

for(const media of packet.media_refs){
  if(media.role==='song')media.address=audio.address;
  if(media.role==='video')media.address=video.address;
  if(media.role==='lyrics')media.address=lyricAddress;
}

const nav=openNavigator(packet);
assert.equal(nav.ok,true);

let room=enterDoor(nav,'COMPOSE',true,'room-encounter:human-ai-full');
room=acceptMediaResolution(room,'lego:2:audio-player',audio);
room=acceptMediaResolution(room,'lego:4:video-player',video);
room=await acceptLocalTextBytes(room,'lego:3:text-sheet',lyrics);

room=compileRoomScore(room,{
  schema:'roroomom.room-score/v0',
  title:'Human AI crossing score',
  clock:'lego:2:audio-player',
  mediaTracks:[
    {instrument:'lego:2:audio-player',offsetMs:0},
    {instrument:'lego:4:video-player',offsetMs:250},
  ],
  lyricTrack:{
    instrument:'lego:3:text-sheet',
    cues:[
      {atMs:0,fromLine:1,toLine:2},
      {atMs:8000,fromLine:3,toLine:4},
    ],
  },
});
room=actRoomScore(room,'CONDUCT');

const memory=await createPerformanceMemory(room,{
  verdict:'weird',
  reopenRequested:true,
});
assert.equal(memory.humanVerdict.verdict,'weird');

const proposal=await createAiRoomScoreProposal(room,[memory],{
  participant:{
    id:'ai:crossing-ci',
    label:'Crossing CI AI',
    provider:'contract-specimen',
    model:'bounded-score-proposer-v0',
  },
  rationale:'The explicit WEIRD performance memory invites a nearby mutation. Delay only the accepted video by 500 additional milliseconds.',
  patch:{
    op:'SET_MEDIA_OFFSET_MS',
    instrument:'lego:4:video-player',
    value:750,
  },
});

assert.equal(proposal.authority,'proposal-only');
assert.ok(proposal.basis.memoryRefs.includes(memory.memoryId));
assert.ok(proposal.basis.memoryInvitations.some(item=>item.kind==='MUTATE_NEARBY'));
assert.equal(
  room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
  250,
);

const sourceRefsBefore=room.roomScore.mediaTracks.map(track=>track.sourceRef);
const hashesBefore=room.roomScore.mediaTracks.map(track=>track.resolvedSha256);

const held=await resolveHumanAiCrossing(room,proposal,'HOLD');
assert.equal(held.ok,true);
assert.equal(held.crossingReceipt.changed,false);
assert.equal(held.crossingReceipt.decision,'HOLD');
assert.equal(
  held.room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
  250,
);

const accepted=await resolveHumanAiCrossing(held.room,proposal,'ACCEPT');
assert.equal(accepted.ok,true);
assert.equal(accepted.crossingReceipt.changed,true);
assert.equal(accepted.crossingReceipt.decision,'ACCEPT');
assert.notEqual(
  accepted.crossingReceipt.preScoreSha256,
  accepted.crossingReceipt.postScoreSha256,
);
assert.equal(
  accepted.room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
  750,
);
assert.deepEqual(
  accepted.room.roomScore.mediaTracks.map(track=>track.sourceRef),
  sourceRefsBefore,
);
assert.deepEqual(
  accepted.room.roomScore.mediaTracks.map(track=>track.resolvedSha256),
  hashesBefore,
);
assert.equal(accepted.room.sourceMutated,false);
assert.equal(accepted.room.sharedWorldChanged,false);

const refusedProposal=await createAiRoomScoreProposal(accepted.room,[memory],{
  participant:{id:'ai:crossing-ci-2'},
  rationale:'Offer another bounded local timing alternative without executing it.',
  patch:{
    op:'SET_MEDIA_OFFSET_MS',
    instrument:'lego:4:video-player',
    value:1000,
  },
});
const refused=await resolveHumanAiCrossing(accepted.room,refusedProposal,'REFUSE');
assert.equal(refused.ok,true);
assert.equal(refused.crossingReceipt.changed,false);
assert.equal(
  refused.room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
  750,
);

console.log('Real Play Memory -> AI bounded proposal -> human HOLD -> human ACCEPT -> exact source invariants passed.');
