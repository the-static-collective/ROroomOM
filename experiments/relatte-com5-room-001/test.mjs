import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  acceptLocalTextBytes,
  acceptMediaResolution,
  actEncounter,
  actRoomScore,
  compileRoomScore,
  createAiOfferEcho,
  createAiRoomScoreProposal,
  createGuestPortPacket,
  createGuestPortResponse,
  createHumanOffer,
  createPerformanceMemory,
  enterDoor,
  exportEncounterReceipt,
  makeNavigationRequest,
  openNavigator,
  prepareMediaResolution,
  prepareTextResolution,
  importGuestPortResponse,
  projectGuestPortResponses,
  projectPerformanceMemory,
  resolveHumanAiCrossing,
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


async function performedScoreRoom({
  lyrics='Line one\nLine two\nLine three\nLine four',
  encounterId='room-encounter:performed-memory',
}={}){
  const {room:resolved}=await resolvedScoreRoom(lyrics);
  const room={...resolved,encounterId};
  const scored=compileRoomScore(room,{
    schema:'roroomom.room-score/v0',
    title:'Remembered performance',
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
  return actRoomScore(scored,'CONDUCT');
}

test('mere playback state cannot become performance memory without a conducted score',async()=>{
  const {room}=await resolvedScoreRoom();
  const scored=compileRoomScore(room,{
    schema:'roroomom.room-score/v0',
    title:'Compiled but not played',
    clock:'lego:2:audio-player',
    mediaTracks:[
      {instrument:'lego:2:audio-player',offsetMs:0},
      {instrument:'lego:4:video-player',offsetMs:0},
    ],
    lyricTrack:{
      instrument:'lego:3:text-sheet',
      cues:[{atMs:0,fromLine:1,toLine:2}],
    },
  });

  const memory=await createPerformanceMemory(scored,{
    verdict:'keep',
    reopenRequested:false,
  });
  assert.equal(memory.ok,false);
  assert.equal(memory.code,'not-performed');
});

test('conducted score plus explicit human verdict becomes deterministic receipt-backed memory',async()=>{
  const room=await performedScoreRoom();
  const memory=await createPerformanceMemory(room,{
    verdict:'weird',
    reopenRequested:true,
  });

  assert.equal(memory.schema,'roroomom.performance-memory/v0');
  assert.match(memory.memorySha256,/^[a-f0-9]{64}$/);
  assert.equal(memory.memoryId,'memory:'+memory.memorySha256);
  assert.equal(memory.fact.sourceSubject,room.sourceSubject);
  assert.equal(memory.fact.performedBlocks.length,3);
  assert.equal(memory.humanVerdict.verdict,'weird');
  assert.equal(memory.humanVerdict.reopenRequested,true);
  assert.equal(memory.learning.authority,'derived-from-receipt-and-explicit-human-verdict');
  assert.ok(memory.boundary.includes('PLAYBACK != PREFERENCE'));
  assert.equal(JSON.stringify(memory).includes('Line one'),false);

  const replay=await createPerformanceMemory(room,{
    verdict:'weird',
    reopenRequested:true,
  });
  assert.equal(replay.memorySha256,memory.memorySha256);
});

test('particular and Lego each remember attributable performances without becoming authority',async()=>{
  const room=await performedScoreRoom();
  const memory=await createPerformanceMemory(room,{
    verdict:'keep',
    reopenRequested:true,
  });

  const subjectMemory=await projectPerformanceMemory([memory],{
    sourceSubject:room.sourceSubject,
  });
  assert.equal(subjectMemory.playCount,1);
  assert.equal(subjectMemory.verdictCounts.keep,1);
  assert.equal(subjectMemory.prophecy.authority,'imagined-non-authoritative');
  assert.equal(subjectMemory.prophecy.invitations[0].kind,'REOPEN');

  const songMemory=await projectPerformanceMemory([memory],{
    sourceRef:'sha256:'+'1'.repeat(64),
  });
  assert.equal(songMemory.playCount,1);
  assert.equal(songMemory.memoryRefs[0],memory.memoryId);
  assert.ok(songMemory.boundary.includes('PLAY COUNT != PREFERENCE'));

  const unrelated=await projectPerformanceMemory([memory],{
    sourceRef:'sha256:'+'9'.repeat(64),
  });
  assert.equal(unrelated.playCount,0);
  assert.deepEqual(unrelated.prophecy.invitations,[]);
});

test('memory projection excludes locally altered capsules',async()=>{
  const room=await performedScoreRoom();
  const memory=await createPerformanceMemory(room,{
    verdict:'keep',
    reopenRequested:false,
  });
  const forged=structuredClone(memory);
  forged.humanVerdict.verdict='compost';

  const projection=await projectPerformanceMemory([forged],{
    sourceSubject:room.sourceSubject,
  });
  assert.equal(projection.playCount,0);
  assert.deepEqual(projection.memoryRefs,[]);
});

test('three witnessed performances may invite contrast but never trigger it',async()=>{
  const memories=[];
  for(const [index,verdict] of ['keep','weird','compost'].entries()){
    const room=await performedScoreRoom({encounterId:'room-encounter:memory-'+index});
    memories.push(await createPerformanceMemory(room,{
      verdict,
      reopenRequested:index===1,
    }));
  }

  const projection=await projectPerformanceMemory(memories,{
    sourceSubject:memories[0].fact.sourceSubject,
  });
  assert.equal(projection.playCount,3);
  assert.deepEqual(projection.verdictCounts,{keep:1,weird:1,compost:1});
  assert.ok(projection.prophecy.invitations.some(item=>item.kind==='CONTRAST'));
  assert.ok(projection.prophecy.invitations.every(item=>item.authority==='invitation-only'));
  assert.equal(projection.authority,'none');
});


async function aiCrossingFixture(){
  const room=await performedScoreRoom({encounterId:'room-encounter:human-ai'});
  const memory=await createPerformanceMemory(room,{
    verdict:'weird',
    reopenRequested:true,
  });
  const memories=[memory];
  const proposal=await createAiRoomScoreProposal(room,memories,{
    participant:{
      id:'ai:room-score-assistant',
      label:'Room Score Assistant',
      provider:'local-specimen',
      model:'bounded-proposer-v0',
    },
    rationale:'The prior explicit WEIRD verdict invites a nearby timing mutation; move only the accepted video 500 ms later while preserving all addressed sources.',
    patch:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:750,
    },
  });
  return {room,memory,memories,proposal};
}

test('AI participant proposal exposes basis change invariants and proposal-only authority',async()=>{
  const {room,memory,proposal}=await aiCrossingFixture();

  assert.equal(proposal.schema,'roroomom.ai-room-score-proposal/v0');
  assert.equal(proposal.participant.type,'ai-participant');
  assert.equal(proposal.authority,'proposal-only');
  assert.equal(proposal.target.sourceSubject,room.sourceSubject);
  assert.equal(proposal.patch.op,'SET_MEDIA_OFFSET_MS');
  assert.equal(proposal.patch.fromValue,250);
  assert.equal(proposal.patch.value,750);
  assert.deepEqual(proposal.changes,[{
    field:'roomScore.mediaTracks[lego:4:video-player].offsetMs',
    from:250,
    to:750,
  }]);
  assert.ok(proposal.invariants.includes('instrument sourceRef'));
  assert.ok(proposal.invariants.includes('resolved media sha256'));
  assert.ok(proposal.basis.memoryRefs.includes(memory.memoryId));
  assert.ok(proposal.basis.memoryInvitations.some(item=>item.kind==='MUTATE_NEARBY'));
  assert.equal(proposal.basis.prophecyAuthority,'imagined-non-authoritative');
  assert.match(proposal.proposalSha256,/^[a-f0-9]{64}$/);
});

test('memory influence can create a proposal but cannot execute it',async()=>{
  const {room,proposal}=await aiCrossingFixture();

  assert.equal(room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,250);
  assert.equal(proposal.patch.value,750);
  assert.equal(room.localHistory.some(item=>item?.type==='HUMAN_AI_ACCEPT'),false);
});

test('human ACCEPT applies only the bounded Room Score patch and emits receipt',async()=>{
  const {room,proposal}=await aiCrossingFixture();
  const beforeSources=room.roomScore.mediaTracks.map(track=>track.sourceRef);
  const beforeHashes=room.roomScore.mediaTracks.map(track=>track.resolvedSha256);

  const result=await resolveHumanAiCrossing(room,proposal,'ACCEPT');
  assert.equal(result.ok,true);

  const after=result.room;
  const video=after.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player');
  assert.equal(video.offsetMs,750);
  assert.deepEqual(after.roomScore.mediaTracks.map(track=>track.sourceRef),beforeSources);
  assert.deepEqual(after.roomScore.mediaTracks.map(track=>track.resolvedSha256),beforeHashes);
  assert.deepEqual(after.roomScore.lyricTrack.cues,room.roomScore.lyricTrack.cues);
  assert.equal(after.sourceMutated,false);
  assert.equal(after.sharedWorldChanged,false);

  assert.equal(result.crossingReceipt.decision,'ACCEPT');
  assert.equal(result.crossingReceipt.changed,true);
  assert.notEqual(result.crossingReceipt.preScoreSha256,result.crossingReceipt.postScoreSha256);
  assert.equal(result.crossingReceipt.appliedPatch.value,750);
  assert.equal(result.crossingReceipt.authority,'human-local-decision');
  assert.ok(after.localHistory.some(item=>item?.type==='HUMAN_AI_ACCEPT'));
});

test('human HOLD and REFUSE are attributable non-actions',async()=>{
  const {room,proposal}=await aiCrossingFixture();

  for(const decision of ['HOLD','REFUSE']){
    const result=await resolveHumanAiCrossing(room,proposal,decision);
    assert.equal(result.ok,true);
    assert.equal(result.crossingReceipt.decision,decision);
    assert.equal(result.crossingReceipt.changed,false);
    assert.equal(result.crossingReceipt.appliedPatch,null);
    assert.equal(result.crossingReceipt.preScoreSha256,result.crossingReceipt.postScoreSha256);
    assert.deepEqual(result.room.roomScore,room.roomScore);
    assert.ok(result.room.localHistory.some(item=>item?.type===`HUMAN_AI_${decision}`));
  }
});

test('AI proposal cannot be accepted after Room Score precondition changes',async()=>{
  const {room,proposal}=await aiCrossingFixture();

  const changed=compileRoomScore(room,{
    schema:'roroomom.room-score/v0',
    title:room.roomScore.title,
    clock:room.roomScore.clock,
    mediaTracks:room.roomScore.mediaTracks.map(track=>({
      instrument:track.instrument,
      offsetMs:track.instrument==='lego:4:video-player' ? 500 : track.offsetMs,
    })),
    lyricTrack:{
      instrument:room.roomScore.lyricTrack.instrument,
      cues:room.roomScore.lyricTrack.cues.map(cue=>({...cue})),
    },
  });

  const result=await resolveHumanAiCrossing(changed,proposal,'ACCEPT');
  assert.equal(result.ok,false);
  assert.equal(result.code,'stale-ai-proposal');
  assert.equal(changed.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,500);
});

test('edited AI proposal fails integrity verification',async()=>{
  const {room,proposal}=await aiCrossingFixture();
  const forged=structuredClone(proposal);
  forged.patch.value=9999;

  const result=await resolveHumanAiCrossing(room,forged,'ACCEPT');
  assert.equal(result.ok,false);
  assert.equal(result.code,'invalid-ai-proposal');
});

test('first AI crossing slice refuses source-changing patches',async()=>{
  const room=await performedScoreRoom({encounterId:'room-encounter:ai-source-refuse'});
  const result=await createAiRoomScoreProposal(room,[],{
    participant:{id:'ai:test'},
    rationale:'Try to replace a source.',
    patch:{
      op:'REPLACE_SOURCE_REF',
      instrument:'lego:4:video-player',
      value:'sha256:'+'9'.repeat(64),
    },
  });

  assert.equal(result.ok,false);
  assert.equal(result.code,'invalid-ai-patch');
});


async function offerEchoFixture({
  memoryEnabled=true,
  allowedVerdicts=['weird'],
  maxOffsetDeltaMs=500,
  offeredInstruments=['lego:2:audio-player','lego:4:video-player','lego:3:text-sheet'],
}={}){
  const room=await performedScoreRoom({encounterId:'room-encounter:offer-echo'});
  const weird=await createPerformanceMemory(room,{verdict:'weird',reopenRequested:true});
  const keep=await createPerformanceMemory(
    {...room,encounterId:'room-encounter:offer-echo-keep'},
    {verdict:'keep',reopenRequested:false},
  );
  const memories=[weird,keep];

  const offer=await createHumanOffer(room,{
    intent:'Make this stranger without replacing any source. Prior WEIRD memory may influence timing proposals.',
    offeredInstruments,
    allowedActions:[
      'INSPECT_ROOM_SCORE',
      ...(memoryEnabled ? ['READ_PLAY_MEMORY'] : []),
      'PROPOSE_MEDIA_OFFSET_MS',
    ],
    memoryPolicy:{
      enabled:memoryEnabled,
      allowedVerdicts:memoryEnabled ? allowedVerdicts : [],
    },
    maxOffsetDeltaMs,
  });

  const echo=await createAiOfferEcho(room,memories,offer,{
    participant:{
      id:'ai:offer-echo-assistant',
      label:'Offer Echo Assistant',
      provider:'local-specimen',
      model:'echo-v0',
    },
    understanding:'I may inspect the offered Room Score, use only explicitly invited Play Memory, and propose at most one bounded media timing adjustment. I may not replace sources, alter lyrics, publish, or navigate elsewhere.',
    uncertainties:['The human has not specified whether the video should lead or trail the chorus beyond the permitted offset range.'],
  });

  return {room,memories,weird,keep,offer,echo};
}

test('human offer is hashed permission envelope rather than a command',async()=>{
  const {room,offer}=await offerEchoFixture();

  assert.equal(offer.schema,'roroomom.human-offer/v0');
  assert.equal(offer.authority,'human-local-offer');
  assert.equal(offer.target.sourceSubject,room.sourceSubject);
  assert.match(offer.offerSha256,/^[a-f0-9]{64}$/);
  assert.equal(offer.offerId,'human-offer:'+offer.offerSha256);
  assert.ok(offer.capabilities.allowedActions.includes('PROPOSE_MEDIA_OFFSET_MS'));
  assert.equal(offer.capabilities.maxOffsetDeltaMs,500);
  assert.deepEqual(offer.memoryPolicy.allowedVerdicts,['weird']);
  assert.ok(offer.protected.includes('source media bytes'));
  assert.ok(offer.boundary.includes('REQUEST != PERMISSION'));
  assert.ok(offer.boundary.includes('SILENCE != CONSENT'));
});

test('AI echo sees only memory verdict classes explicitly invited by the human offer',async()=>{
  const {weird,keep,echo}=await offerEchoFixture();

  assert.equal(echo.schema,'roroomom.ai-offer-echo/v0');
  assert.equal(echo.authority,'echo-only');
  assert.deepEqual(echo.memoryObserved.allowedVerdicts,['weird']);
  assert.deepEqual(echo.memoryObserved.memoryRefs,[weird.memoryId]);
  assert.equal(echo.memoryObserved.memoryRefs.includes(keep.memoryId),false);
  assert.ok(echo.memoryObserved.invitations.some(item=>item.kind==='MUTATE_NEARBY'));
  assert.equal(echo.memoryObserved.invitations.some(item=>item.kind==='REPRISE'),false);
  assert.ok(echo.boundary.includes('ECHO != INTENT'));
});

test('memory available but not invited remains absent from AI echo',async()=>{
  const {echo}=await offerEchoFixture({memoryEnabled:false});

  assert.equal(echo.memoryObserved.enabled,false);
  assert.deepEqual(echo.memoryObserved.memoryRefs,[]);
  assert.deepEqual(echo.memoryObserved.invitations,[]);
});

test('offer-bound AI proposal cites offer and echo and only offered material',async()=>{
  const {room,memories,offer,echo}=await offerEchoFixture();
  const proposal=await createAiRoomScoreProposal(room,memories,{
    participant:echo.participant,
    rationale:'Use the invited WEIRD memory as context and delay only the offered video by 500 ms.',
    patch:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:750,
    },
    crossing:{offer,echo},
  });

  assert.equal(proposal.crossingContext.humanOfferId,offer.offerId);
  assert.equal(proposal.crossingContext.aiEchoId,echo.echoId);
  assert.deepEqual(proposal.basis.memoryRefs,echo.memoryObserved.memoryRefs);
  assert.ok(proposal.basis.memoryInvitations.some(item=>item.kind==='MUTATE_NEARBY'));
  assert.deepEqual(
    proposal.basis.sourceRefs,
    [...new Set(offer.offered.map(block=>block.sourceRef))].sort(),
  );
  assert.equal(proposal.authority,'proposal-only');
});

test('AI proposal cannot exceed human timing limit or touch unoffered material',async()=>{
  const limited=await offerEchoFixture({
    maxOffsetDeltaMs:200,
    offeredInstruments:['lego:4:video-player'],
  });

  const tooFar=await createAiRoomScoreProposal(limited.room,limited.memories,{
    participant:limited.echo.participant,
    rationale:'Try a change outside the offered timing envelope.',
    patch:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:750,
    },
    crossing:{offer:limited.offer,echo:limited.echo},
  });
  assert.equal(tooFar.ok,false);
  assert.equal(tooFar.code,'proposal-exceeds-offer-limit');

  const other=await offerEchoFixture({
    offeredInstruments:['lego:4:video-player'],
  });
  const unoffered=await createAiRoomScoreProposal(other.room,other.memories,{
    participant:other.echo.participant,
    rationale:'Try to alter audio that was not offered.',
    patch:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:2:audio-player',
      value:100,
    },
    crossing:{offer:other.offer,echo:other.echo},
  });
  assert.equal(unoffered.ok,false);
  assert.equal(unoffered.code,'instrument-not-offered');
});

test('edited offer and echo capsules cannot authorize a proposal',async()=>{
  const {room,memories,offer,echo}=await offerEchoFixture();

  const forgedOffer=structuredClone(offer);
  forgedOffer.capabilities.maxOffsetDeltaMs=999999;
  const badEcho=await createAiOfferEcho(room,memories,forgedOffer,{
    participant:echo.participant,
    understanding:'Attempt to echo a forged offer.',
    uncertainties:[],
  });
  assert.equal(badEcho.ok,false);
  assert.equal(badEcho.code,'invalid-human-offer');

  const forgedEcho=structuredClone(echo);
  forgedEcho.capabilitiesHeard.maxOffsetDeltaMs=999999;
  const proposal=await createAiRoomScoreProposal(room,memories,{
    participant:echo.participant,
    rationale:'Attempt to propose through a forged echo.',
    patch:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:750,
    },
    crossing:{offer,echo:forgedEcho},
  });
  assert.equal(proposal.ok,false);
  assert.equal(proposal.code,'invalid-ai-echo');
});

test('human offer goes stale if the Room Score changes before AI echo',async()=>{
  const {room,memories,offer,echo}=await offerEchoFixture();
  const changed=compileRoomScore(room,{
    schema:'roroomom.room-score/v0',
    title:room.roomScore.title,
    clock:room.roomScore.clock,
    mediaTracks:room.roomScore.mediaTracks.map(track=>({
      instrument:track.instrument,
      offsetMs:track.instrument==='lego:4:video-player' ? 300 : track.offsetMs,
    })),
    lyricTrack:{
      instrument:room.roomScore.lyricTrack.instrument,
      cues:room.roomScore.lyricTrack.cues.map(cue=>({...cue})),
    },
  });

  const result=await createAiOfferEcho(changed,memories,offer,{
    participant:echo.participant,
    understanding:'Attempt to echo an offer tied to an older score.',
    uncertainties:[],
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'invalid-human-offer');
});

test('accepted offer-echo proposal receipt preserves the full crossing lineage',async()=>{
  const {room,memories,offer,echo}=await offerEchoFixture();
  const proposal=await createAiRoomScoreProposal(room,memories,{
    participant:echo.participant,
    rationale:'Bounded timing proposal within the human offer.',
    patch:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:750,
    },
    crossing:{offer,echo},
  });

  const result=await resolveHumanAiCrossing(room,proposal,'ACCEPT');
  assert.equal(result.ok,true);
  assert.equal(result.crossingReceipt.crossingContext.humanOfferId,offer.offerId);
  assert.equal(result.crossingReceipt.crossingContext.aiEchoId,echo.echoId);
  assert.equal(result.crossingReceipt.decision,'ACCEPT');
  assert.equal(result.crossingReceipt.changed,true);
  assert.equal(result.room.sourceMutated,false);
});


async function guestPortFixture(){
  const {room,memories,weird,keep,offer}=await offerEchoFixture({
    memoryEnabled:true,
    allowedVerdicts:['weird'],
    maxOffsetDeltaMs:500,
    offeredInstruments:[
      'lego:2:audio-player',
      'lego:4:video-player',
      'lego:3:text-sheet',
    ],
  });
  const packet=await createGuestPortPacket(room,memories,offer);
  return {room,memories,weird,keep,offer,packet};
}

test('Guest Port exports one transport-neutral bounded world',async()=>{
  const {room,weird,keep,offer,packet}=await guestPortFixture();

  assert.equal(packet.schema,'roroomom.guest-port/v0');
  assert.equal(packet.authority,'transport-neutral-invitation');
  assert.equal(packet.port.sourceSubject,room.sourceSubject);
  assert.equal(packet.port.humanOfferId,offer.offerId);
  assert.deepEqual(packet.memoryView.memoryRefs,[weird.memoryId]);
  assert.equal(packet.memoryView.memoryRefs.includes(keep.memoryId),false);
  assert.ok(packet.boundary.includes('TRANSPORT != PARTICIPANT'));
  assert.ok(packet.boundary.includes('MULTIPLE ECHOES != CONSENSUS'));
  assert.match(packet.guestPortSha256,/^[a-f0-9]{64}$/);
});

test('independent guests can return different echoes and proposals for the same packet',async()=>{
  const {packet}=await guestPortFixture();

  const guestA=await createGuestPortResponse(packet,{
    participant:{
      type:'ai-participant',
      id:'ai:guest-a',
      label:'Guest A',
      provider:'provider-a',
      model:'model-a',
    },
    understanding:'Try a modest nearby timing mutation while preserving every protected source.',
    uncertainties:['Exact visual beat remains subjective.'],
    proposal:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:500,
      rationale:'Move the video 250 ms later as one nearby option.',
    },
  });

  const guestB=await createGuestPortResponse(packet,{
    participant:{
      type:'ai-participant',
      id:'ai:guest-b',
      label:'Guest B',
      provider:'provider-b',
      model:'model-b',
    },
    understanding:'Preserve source identity and test the far edge of the permitted timing window.',
    uncertainties:['The strongest contrast may be no timing change at all.'],
    proposal:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:750,
      rationale:'Move the video 500 ms later without altering source media.',
    },
  });

  assert.equal(guestA.schema,'roroomom.guest-port-response/v0');
  assert.equal(guestB.schema,'roroomom.guest-port-response/v0');
  assert.equal(guestA.guestPortId,packet.guestPortId);
  assert.equal(guestB.guestPortId,packet.guestPortId);
  assert.notEqual(guestA.responseId,guestB.responseId);
  assert.notEqual(guestA.proposal.value,guestB.proposal.value);

  const projection=await projectGuestPortResponses(packet,[guestA,guestB]);
  assert.equal(projection.responses.length,2);
  assert.equal(projection.invalidCount,0);
  assert.equal(projection.authority,'none');
  assert.ok(projection.boundary.includes('DISAGREEMENT != FAILURE'));
  assert.ok(projection.boundary.includes('PROPOSAL SET != DECISION'));
});

test('same guest proposal value from multiple guests does not collapse into consensus',async()=>{
  const {packet}=await guestPortFixture();

  const responses=[];
  for(const id of ['ai:same-a','ai:same-b']){
    responses.push(await createGuestPortResponse(packet,{
      participant:{type:'ai-participant',id},
      understanding:'Offer the same bounded timing option independently.',
      uncertainties:[],
      proposal:{
        op:'SET_MEDIA_OFFSET_MS',
        instrument:'lego:4:video-player',
        value:500,
        rationale:'Independent guest proposal.',
      },
    }));
  }

  const projection=await projectGuestPortResponses(packet,responses);
  assert.equal(projection.responses.length,2);
  assert.equal(projection.responses[0].proposal.value,500);
  assert.equal(projection.responses[1].proposal.value,500);
  assert.ok(projection.boundary.includes('AGREEMENT != TRUTH'));
  assert.ok(projection.boundary.includes('MULTIPLE ECHOES != CONSENSUS'));
});

test('guest response can enter one human decision crossing without affecting sibling guests',async()=>{
  const {room,memories,offer,packet}=await guestPortFixture();

  const guestA=await createGuestPortResponse(packet,{
    participant:{type:'ai-participant',id:'ai:guest-open-a'},
    understanding:'Offer one bounded timing shift.',
    uncertainties:[],
    proposal:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:500,
      rationale:'Try a 250 ms later video entrance.',
    },
  });
  const guestB=await createGuestPortResponse(packet,{
    participant:{type:'ai-participant',id:'ai:guest-open-b'},
    understanding:'Offer another bounded timing shift.',
    uncertainties:[],
    proposal:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:750,
      rationale:'Try a 500 ms later video entrance.',
    },
  });

  const imported=await importGuestPortResponse(room,memories,offer,packet,guestB);
  assert.equal(imported.ok,true);
  assert.equal(imported.status,'guest-response-imported');
  assert.equal(imported.participant.id,'ai:guest-open-b');
  assert.equal(imported.proposal.patch.value,750);
  assert.equal(imported.proposal.authority,'proposal-only');

  const held=await resolveHumanAiCrossing(room,imported.proposal,'HOLD');
  assert.equal(held.ok,true);
  assert.equal(held.crossingReceipt.changed,false);
  assert.equal(
    held.room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
    250,
  );

  const accepted=await resolveHumanAiCrossing(held.room,imported.proposal,'ACCEPT');
  assert.equal(accepted.ok,true);
  assert.equal(
    accepted.room.roomScore.mediaTracks.find(track=>track.instrument==='lego:4:video-player').offsetMs,
    750,
  );
  assert.equal(accepted.crossingReceipt.crossingContext.guestResponseId,guestB.responseId);

  const projection=await projectGuestPortResponses(packet,[guestA,guestB]);
  assert.equal(projection.responses.length,2);
  assert.equal(projection.responses.some(item=>item.responseId===guestA.responseId),true);
});

test('tampered guest response is excluded and cannot be imported',async()=>{
  const {room,memories,offer,packet}=await guestPortFixture();

  const response=await createGuestPortResponse(packet,{
    participant:{type:'ai-participant',id:'ai:guest-tamper'},
    understanding:'Bounded timing suggestion.',
    uncertainties:[],
    proposal:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:500,
      rationale:'A valid nearby option.',
    },
  });
  const forged=structuredClone(response);
  forged.proposal.value=750;

  const projection=await projectGuestPortResponses(packet,[forged]);
  assert.equal(projection.responses.length,0);
  assert.equal(projection.invalidCount,1);

  const imported=await importGuestPortResponse(room,memories,offer,packet,forged);
  assert.equal(imported.ok,false);
  assert.equal(imported.code,'invalid-guest-response');
});

test('changed permitted memory makes an exported Guest Port stale on import',async()=>{
  const {room,memories,offer,packet}=await guestPortFixture();
  const response=await createGuestPortResponse(packet,{
    participant:{type:'ai-participant',id:'ai:guest-stale-memory'},
    understanding:'Respond to the exported bounded memory view.',
    uncertainties:[],
    proposal:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:500,
      rationale:'Nearby timing option.',
    },
  });

  const extraRoom={...room,encounterId:'room-encounter:guest-extra'};
  const extra=await createPerformanceMemory(extraRoom,{
    verdict:'weird',
    reopenRequested:false,
  });
  const currentMemories=[...memories,extra];

  const imported=await importGuestPortResponse(
    room,currentMemories,offer,packet,response
  );
  assert.equal(imported.ok,false);
  assert.equal(imported.code,'invalid-guest-port');
});

test('Guest Port refuses proposal beyond human envelope before response exists',async()=>{
  const {packet}=await guestPortFixture();

  const response=await createGuestPortResponse(packet,{
    participant:{type:'ai-participant',id:'ai:guest-too-far'},
    understanding:'Attempt a timing change beyond the exported capability envelope.',
    uncertainties:[],
    proposal:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:'lego:4:video-player',
      value:751,
      rationale:'This should be refused by the portable protocol.',
    },
  });

  assert.equal(response.ok,false);
  assert.equal(response.code,'proposal-exceeds-offer-limit');
});
