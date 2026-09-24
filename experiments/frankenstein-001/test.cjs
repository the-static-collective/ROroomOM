'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const F=require('./core.js');
const fixture=path.join(__dirname,'fixture-lemon-receipt.json');
const receipt=JSON.parse(fs.readFileSync(fixture,'utf8'));
let passes=0;
const test=async(name,fn)=>{await fn();passes++;console.log('PASS '+name)};
(async()=>{
 await test('real Slice 003 receipt replays cup invention and witnessed performance',async()=>{
   const {state}=F.verifyLemon(receipt);assert.equal(Object.keys(state.performed).length,1);
   assert.equal(F.witnesses(state,receipt.events).length,1);
 });
 const w=F.witnesses(F.verifyLemon(receipt).state,receipt.events)[0];
 await test('unperformed proposal cannot be transported',async()=>{
   await assert.rejects(F.makeDoor(receipt,receipt.events.find(e=>e.type==='INVENT_RELATION').id),/performed cup/);
 });
 const door=await F.makeDoor(receipt,w.eventId);
 await test('door carries source receipt and byte digest',async()=>{
   assert.equal(door.source.receiptSha256.length,64);
   assert.equal(door.source.object,F.IDS.cup);
   assert.equal(door.witness.eventId,w.eventId);
 });
 await test('receiver requires explicit acceptance and rejects inherited grants',async()=>{
   await assert.rejects(F.acceptDoor(door,F.freshState(),false,'guest-test'),/Human acceptance/);
   await assert.rejects(F.acceptDoor({...door,grants:['write']},F.freshState(),true,'guest-test'),/Unexpected door fields/);
 });
 const accepted=await F.acceptDoor(door,F.freshState(),true,'guest-test');
 await test('independent guest preserves source ID, but has no authority',async()=>{
   assert.equal(accepted.guest.sourceObject,F.IDS.cup);
   assert.deepEqual(accepted.guest.permissions,[]);
   assert.equal(accepted.state.guests.length,1);
   assert.deepEqual(receipt.events,door.source.receipt.events);
 });
 await test('re-import refuses replay without mutating prior receiver',async()=>{
   await assert.rejects(F.acceptDoor(door,accepted.state,true,'guest-new'),/already accepted/);
   assert.equal(accepted.state.guests.length,1);
 });
 await test('tampered quality, order and witness are rejected',async()=>{
   const tamper=JSON.parse(JSON.stringify(door));tamper.source.receipt.events.find(e=>e.type==='MARK_QUALITY').quality='forged';
   await assert.rejects(F.acceptDoor(tamper,F.freshState(),true,'guest-2'),/digest mismatch/);
   const order=JSON.parse(JSON.stringify(receipt));order.events.reverse();assert.throws(()=>F.verifyLemon(order));
   const forged=JSON.parse(JSON.stringify(door));forged.witness.eventId='ev:forged';
   await assert.rejects(F.acceptDoor(forged,F.freshState(),true,'guest-3'),/Witness/);
 });
 await test(process.argv[2]?'real ROroomOM 008 schema accepts exported guest score':'exports ROroomOM 008 score contract for downstream import',async()=>{
   const score=F.toRoomScore(accepted.guest);
   assert.equal(score.format,'roroomom-experience-score');
   assert.deepEqual(score.assets,{});
   const roomPath=process.argv[2];
   if(roomPath){
     const roomFile=fs.statSync(roomPath).isDirectory()?path.join(roomPath,'experience008.js'):roomPath;
     const script=fs.readFileSync(roomFile,'utf8');
     const pre=script.slice(script.indexOf('function exValidate('),script.indexOf('function exRead('));
     const ctx={EX_MAX_ASSETS:30,EX_MAX_SCORES:25,EX_MAX_CARDS:24,EXPERIENCE_KEY:'__experience008',Error,Set,Object,Number};
     const verify=vm.runInNewContext(pre+'\nexValidate',{...ctx});
     const s={schema:'roroomom-experience-v1',assets:score.assets,scores:{[score.score.id]:{...score.score,object:'room-node-1'}},activeByObject:{'room-node-1':score.score.id},events:[]};
     assert.equal(verify(s,{'room-node-1':{}}),s);
   }
 });
 console.log('FRANKENSTEIN-001 '+passes+' checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
