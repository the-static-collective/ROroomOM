import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  acceptLocalTextBytes,
  acceptMediaResolution,
  actRoomScore,
  compileRoomScore,
  createAiOfferEcho,
  createAiRoomScoreProposal,
  createHumanOffer,
  createPerformanceMemory,
  enterDoor,
  openNavigator,
  resolveHumanAiCrossing,
} from './room.mjs';

const [audioPath,videoPath,lyricsPath] = process.argv.slice(2);
if (!audioPath || !videoPath || !lyricsPath) {
  throw new Error('usage: node offer-echo-cross-contract.mjs audio.json video.json lyrics.txt');
}

const basePacket=JSON.parse(
  readFileSync(new URL('./fixture-enterable-song.json',import.meta.url),'utf8'),
);
const audio=JSON.parse(readFileSync(audioPath,'utf8'));
const video=JSON.parse(readFileSync(videoPath,'utf8'));
const lyrics=readFileSync(lyricsPath);
const lyricDigest=createHash('sha256').update(lyrics).digest('hex');
const lyricAddress='sha256:'+lyricDigest;

function packet(){
  const value=structuredClone(basePacket);
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

async function roomAt(encounterId){
  const nav=openNavigator(packet());
  assert.equal(nav.ok,true);
  let room=enterDoor(nav,'COMPOSE',true,encounterId);
  room=acceptMediaResolution(room,'lego:2:audio-player',audio);
  room=acceptMediaResolution(room,'lego:4:video-player',video);
  room=await acceptLocalTextBytes(room,'lego:3:text-sheet',lyrics);
  room=compileRoomScore(room,{
    schema:'roroomom.room-score/v0',
    title:'Offer Echo Cross score',
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
  return actRoomScore(room,'CONDUCT');
}

const room=await roomAt('room-encounter:offer-echo-cross');
const weird=await createPerformanceMemory(room,{verdict:'weird',reopenRequested:true});
const keepRoom={...room,encounterId:'room-encounter:offer-echo-cross-keep'};
const keep=await createPerformanceMemory(keepRoom,{verdict:'keep',reopenRequested:false});
const memories=[weird,keep];

const offer=await createHumanOffer(room,{
  intent:'Make this stranger, but preserve every source. You may use prior WEIRD memory and propose one nearby video timing change only.',
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
  memoryPolicy:{
    enabled:true,
    allowedVerdicts:['weird'],
  },
  maxOffsetDeltaMs:500,
});

assert.equal(offer.authority,'human-local-offer');
assert.deepEqual(offer.memoryPolicy.allowedVerdicts,['weird']);

const echo=await createAiOfferEcho(room,memories,offer,{
  participant:{
    id:'ai:offer-echo-ci',
    label:'Offer Echo CI',
    provider:'contract-specimen',
    model:'echo-v0',
  },
  understanding:'I may inspect the offered score, observe only invited WEIRD memory, and propose at most one media offset within 500 ms. I may not replace or publish any source.',
  uncertainties:['The preferred exact video timing remains for the human to judge.'],
});

assert.equal(echo.authority,'echo-only');
assert.deepEqual(echo.memoryObserved.memoryRefs,[weird.memoryId]);
assert.equal(echo.memoryObserved.memoryRefs.includes(keep.memoryId),false);
assert.ok(echo.memoryObserved.invitations.some(item=>item.kind==='MUTATE_NEARBY'));
assert.equal(echo.memoryObserved.invitations.some(item=>item.kind==='REPRISE'),false);

const proposal=await createAiRoomScoreProposal(room,memories,{
  participant:echo.participant,
  rationale:'The invited WEIRD memory supports trying a nearby timing mutation. Delay only the offered accepted-video track by 500 ms.',
  patch:{
    op:'SET_MEDIA_OFFSET_MS',
    instrument:'lego:4:video-player',
    value:750,
  },
  crossing:{offer,echo},
});

assert.equal(proposal.authority,'proposal-only');
assert.equal(proposal.crossingContext.humanOfferId,offer.offerId);
assert.equal(proposal.crossingContext.aiEchoId,echo.echoId);
assert.deepEqual(proposal.basis.memoryRefs,[weird.memoryId]);
assert.equal(proposal.basis.memoryRefs.includes(keep.memoryId),false);
assert.equal(
  room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
  250,
);

const beforeRefs=room.roomScore.mediaTracks.map(track=>track.sourceRef);
const beforeHashes=room.roomScore.mediaTracks.map(track=>track.resolvedSha256);
const beforeCues=structuredClone(room.roomScore.lyricTrack.cues);

const held=await resolveHumanAiCrossing(room,proposal,'HOLD');
assert.equal(held.ok,true);
assert.equal(held.crossingReceipt.changed,false);
assert.equal(held.crossingReceipt.crossingContext.humanOfferId,offer.offerId);
assert.equal(
  held.room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
  250,
);

const accepted=await resolveHumanAiCrossing(held.room,proposal,'ACCEPT');
assert.equal(accepted.ok,true);
assert.equal(accepted.crossingReceipt.changed,true);
assert.equal(
  accepted.room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
  750,
);
assert.deepEqual(accepted.room.roomScore.mediaTracks.map(track=>track.sourceRef),beforeRefs);
assert.deepEqual(accepted.room.roomScore.mediaTracks.map(track=>track.resolvedSha256),beforeHashes);
assert.deepEqual(accepted.room.roomScore.lyricTrack.cues,beforeCues);
assert.equal(accepted.room.sourceMutated,false);
assert.equal(accepted.room.sharedWorldChanged,false);

const tooFar=await createAiRoomScoreProposal(room,memories,{
  participant:echo.participant,
  rationale:'Attempt to exceed the explicit human timing envelope.',
  patch:{
    op:'SET_MEDIA_OFFSET_MS',
    instrument:'lego:4:video-player',
    value:751,
  },
  crossing:{offer,echo},
});
assert.equal(tooFar.ok,false);
assert.equal(tooFar.code,'proposal-exceeds-offer-limit');

console.log('Human Offer -> AI Echo -> bounded Proposal -> Human HOLD/ACCEPT -> exact source invariants passed.');
