import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  acceptLocalTextBytes,
  acceptMediaResolution,
  actRoomScore,
  compileRoomScore,
  createPerformanceMemory,
  enterDoor,
  openNavigator,
  projectPerformanceMemory,
} from './room.mjs';

const [audioPath,videoPath,lyricsPath] = process.argv.slice(2);
if (!audioPath || !videoPath || !lyricsPath) {
  throw new Error('usage: node play-memory-contract.mjs audio.json video.json lyrics.txt');
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

async function performance(encounterId, verdict, reopenRequested){
  const nav=openNavigator(packet());
  assert.equal(nav.ok,true);

  let room=enterDoor(nav,'COMPOSE',true,encounterId);
  room=acceptMediaResolution(room,'lego:2:audio-player',audio);
  room=acceptMediaResolution(room,'lego:4:video-player',video);
  room=await acceptLocalTextBytes(room,'lego:3:text-sheet',lyrics);

  room=compileRoomScore(room,{
    schema:'roroomom.room-score/v0',
    title:'Remember me playing',
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

  const memory=await createPerformanceMemory(room,{verdict,reopenRequested});
  assert.equal(memory.schema,'roroomom.performance-memory/v0');
  assert.equal(memory.fact.performedBlocks.length,3);
  assert.equal(memory.fact.performedBlocks[0].sourceRef,audio.address);
  assert.equal(JSON.stringify(memory).includes('The room opens'),false);
  return {room,memory};
}

const first=await performance('room-encounter:memory-real-1','keep',false);
const second=await performance('room-encounter:memory-real-2','weird',true);
const third=await performance('room-encounter:memory-real-3','compost',false);

const ledger=[first.memory,second.memory,third.memory];

const particular=await projectPerformanceMemory(ledger,{
  sourceSubject:first.room.sourceSubject,
});
assert.equal(particular.playCount,3);
assert.deepEqual(particular.verdictCounts,{keep:1,weird:1,compost:1});
assert.ok(particular.prophecy.invitations.some(item=>item.kind==='MUTATE_NEARBY'));
assert.ok(particular.prophecy.invitations.some(item=>item.kind==='COMPOST_RESIDUE'));
assert.ok(particular.prophecy.invitations.some(item=>item.kind==='REPRISE'));
assert.ok(particular.prophecy.invitations.some(item=>item.kind==='CONTRAST'));
assert.equal(particular.prophecy.authority,'imagined-non-authoritative');

const song=await projectPerformanceMemory(ledger,{sourceRef:audio.address});
assert.equal(song.playCount,3);
assert.equal(song.authority,'none');

const forged=structuredClone(first.memory);
forged.humanVerdict.verdict='compost';
const guarded=await projectPerformanceMemory([forged],{
  sourceSubject:first.room.sourceSubject,
});
assert.equal(guarded.playCount,0);

console.log('Real playable Room Score -> explicit human verdict -> block/particular memory -> non-authoritative prophecy passed.');
