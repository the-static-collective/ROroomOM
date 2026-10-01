import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  acceptLocalTextBytes,
  acceptMediaResolution,
  actRoomScore,
  compileRoomScore,
  createGuestPortPacket,
  createGuestPortResponse,
  createHumanOffer,
  createPerformanceMemory,
  enterDoor,
  importGuestPortResponse,
  openNavigator,
  projectGuestPortResponses,
  resolveHumanAiCrossing,
} from './room.mjs';

const [audioPath,videoPath,lyricsPath] = process.argv.slice(2);
if (!audioPath || !videoPath || !lyricsPath) {
  throw new Error('usage: node guest-port-contract.mjs audio.json video.json lyrics.txt');
}

const packetTemplate=JSON.parse(
  readFileSync(new URL('./fixture-enterable-song.json',import.meta.url),'utf8'),
);
const audio=JSON.parse(readFileSync(audioPath,'utf8'));
const video=JSON.parse(readFileSync(videoPath,'utf8'));
const lyrics=readFileSync(lyricsPath);
const lyricDigest=createHash('sha256').update(lyrics).digest('hex');
const lyricAddress='sha256:'+lyricDigest;

function sourcePacket(){
  const value=structuredClone(packetTemplate);
  const compose=value.doors.find(door=>door.role==='COMPOSE');
  compose.instruments.find(item=>item.kind==='audio-player').ref=audio.address;
  compose.instruments.find(item=>item.kind==='video-player').ref=video.address;
  compose.instruments.find(item=>item.kind==='text-sheet').ref=lyricAddress;
  for(const media of value.media_refs){
    if(media.role==='song')media.address=audio.address;
    if(media.role==='video')media.address=video.address;
    if(media.role==='lyrics')media.address=lyricAddress;
  }
  return value;
}

const nav=openNavigator(sourcePacket());
assert.equal(nav.ok,true);

let room=enterDoor(nav,'COMPOSE',true,'room-encounter:guest-port-real');
room=acceptMediaResolution(room,'lego:2:audio-player',audio);
room=acceptMediaResolution(room,'lego:4:video-player',video);
room=await acceptLocalTextBytes(room,'lego:3:text-sheet',lyrics);
room=compileRoomScore(room,{
  schema:'roroomom.room-score/v0',
  title:'Guest Port score',
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

const weird=await createPerformanceMemory(room,{verdict:'weird',reopenRequested:true});
const keepRoom={...room,encounterId:'room-encounter:guest-port-keep'};
const keep=await createPerformanceMemory(keepRoom,{verdict:'keep',reopenRequested:false});
const memories=[weird,keep];

const offer=await createHumanOffer(room,{
  intent:'Let multiple guests independently suggest nearby video timing variations. Preserve every source and expose WEIRD memory only.',
  offeredInstruments:[
    'lego:2:audio-player',
    'lego:4:video-player',
    'lego:3:text-sheet',
  ],
  allowedActions:[
    'INSPECT_ROOM_SCORE',
    'READ_PLAY_MEMORY',
    'PROPOSE_MEDIA_OFFSET_MS',
  ],
  memoryPolicy:{enabled:true,allowedVerdicts:['weird']},
  maxOffsetDeltaMs:500,
});

const port=await createGuestPortPacket(room,memories,offer);
assert.equal(port.schema,'roroomom.guest-port/v0');
assert.deepEqual(port.memoryView.memoryRefs,[weird.memoryId]);
assert.equal(port.memoryView.memoryRefs.includes(keep.memoryId),false);
assert.equal(port.responseContract.schemas.draft,'roroomom.guest-response-draft/v0');

const drafts=[
  {
    schema:'roroomom.guest-response-draft/v0',
    participant:{
      type:'ai-participant',
      id:'ai:guest-port-a',
      label:'Guest A',
      provider:'transport-a',
      model:'model-a',
    },
    understanding:'Preserve sources and try a modest later video entrance.',
    uncertainties:['The visual beat may already be correct.'],
    proposal:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:500,
      rationale:'Try 250 ms later as one bounded option.',
    },
  },
  {
    schema:'roroomom.guest-response-draft/v0',
    participant:{
      type:'ai-participant',
      id:'ai:guest-port-b',
      label:'Guest B',
      provider:'transport-b',
      model:'model-b',
    },
    understanding:'Use only the exported WEIRD memory and test the far edge of the timing envelope.',
    uncertainties:['Another encounter may prefer the original timing.'],
    proposal:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:750,
      rationale:'Try the full permitted 500 ms later timing shift.',
    },
  },
  {
    schema:'roroomom.guest-response-draft/v0',
    participant:{
      type:'ai-participant',
      id:'ai:guest-port-c',
      label:'Guest C',
      provider:'transport-c',
      model:'model-c',
    },
    understanding:'I understand the offer but do not have a timing change I would propose.',
    uncertainties:['No proposal is better than inventing confidence.'],
    proposal:null,
  },
];

const responses=[];
for(const draft of drafts){
  const response=await createGuestPortResponse(port,draft);
  assert.equal(response.schema,'roroomom.guest-port-response/v0');
  assert.equal(response.guestPortId,port.guestPortId);
  responses.push(response);
}

const projection=await projectGuestPortResponses(port,responses);
assert.equal(projection.responses.length,3);
assert.equal(projection.invalidCount,0);
assert.equal(projection.responses[0].participant.id,'ai:guest-port-a');
assert.equal(projection.responses[1].participant.id,'ai:guest-port-b');
assert.equal(projection.responses[2].proposal,null);
assert.ok(projection.boundary.includes('MULTIPLE ECHOES != CONSENSUS'));
assert.ok(projection.boundary.includes('DISAGREEMENT != FAILURE'));

const importedB=await importGuestPortResponse(
  room,memories,offer,port,responses[1]
);
assert.equal(importedB.ok,true);
assert.equal(importedB.participant.id,'ai:guest-port-b');
assert.equal(importedB.proposal.patch.value,750);
assert.equal(importedB.proposal.crossingContext.guestPortId,port.guestPortId);
assert.equal(importedB.proposal.crossingContext.guestResponseId,responses[1].responseId);

const held=await resolveHumanAiCrossing(room,importedB.proposal,'HOLD');
assert.equal(held.ok,true);
assert.equal(held.crossingReceipt.changed,false);
assert.equal(
  held.room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
  250,
);

const accepted=await resolveHumanAiCrossing(held.room,importedB.proposal,'ACCEPT');
assert.equal(accepted.ok,true);
assert.equal(accepted.crossingReceipt.changed,true);
assert.equal(
  accepted.room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
  750,
);
assert.equal(accepted.room.sourceMutated,false);
assert.equal(accepted.room.sharedWorldChanged,false);

const staleSibling=await importGuestPortResponse(
  accepted.room,memories,offer,port,responses[0]
);
assert.equal(staleSibling.ok,false);
assert.equal(staleSibling.code,'invalid-guest-port');

console.log('One Human Offer -> three separate guests -> one opened crossing -> human HOLD/ACCEPT -> sibling packet stales cleanly.');
