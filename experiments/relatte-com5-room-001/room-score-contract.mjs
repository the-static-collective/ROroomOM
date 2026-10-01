import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  acceptLocalTextBytes,
  acceptMediaResolution,
  compileRoomScore,
  enterDoor,
  exportEncounterReceipt,
  openNavigator,
  roomScoreFrame,
} from './room.mjs';

const [audioPath,videoPath,lyricsPath] = process.argv.slice(2);
if (!audioPath || !videoPath || !lyricsPath) {
  throw new Error('usage: node room-score-contract.mjs audio.json video.json lyrics.txt');
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

let room=enterDoor(nav,'COMPOSE',true,'room-encounter:full-room-score');
assert.equal(room.ok,true);

room=acceptMediaResolution(room,'lego:2:audio-player',audio);
assert.equal(room.ok,true);

room=acceptMediaResolution(room,'lego:4:video-player',video);
assert.equal(room.ok,true);

room=await acceptLocalTextBytes(room,'lego:3:text-sheet',lyrics);
assert.equal(room.ok,true);

room=compileRoomScore(room,{
  schema:'roroomom.room-score/v0',
  title:'CI living media score',
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
assert.equal(room.ok,true);

const first=roomScoreFrame(room,1000);
const second=roomScoreFrame(room,9000);
assert.equal(first.lyric.text,'The room opens\nwithout swallowing the road');
assert.equal(second.lyric.text,'The song keeps its name\nthe picture keeps its own');
assert.equal(second.media.find(item=>item.kind==='video-player').desiredTimeSeconds,9.25);

const receipt=exportEncounterReceipt(room);
assert.equal(receipt.roomScore.status,'compiled-local-arrangement');
assert.equal(receipt.roomScore.mediaTracks.length,2);
assert.equal(receipt.roomScore.lyricTrack.resolvedSha256,lyricDigest);
assert.equal(receipt.sourceMutated,false);
assert.equal(receipt.sharedWorldChanged,false);
assert.equal(JSON.stringify(receipt).includes('The room opens'),false);

console.log('Vault audio + Blender video + exact lyric bytes → Room Score contract passed.');
