import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openLocalRoom,actLocalRoom,exportLocalRoom } from "../room.mjs";

test("real Static Field → Full Measure → ROroomOM local encounter and hostile receipt replays",async(t)=>{
 const source=process.env.STATIC_FIELD_DECK_DIR,full=process.env.FULL_MEASURE_QUEST_DIR;
 if(!source||!full){t.skip("Set producer and Full Measure checkout paths for the three-repository test");return}
 const {buildBrowserHandoff}=await import(pathToFileURL(resolve(source,"experiments/postemahhn-living-deck-001/browser-handoff.mjs")).href);
 const {openQuestHandoff,takeQuestAction,createRoomRequest}=await import(pathToFileURL(resolve(full,"experiments/living-deck-quest-001/quest.mjs")).href);
 const handoff=buildBrowserHandoff({firstId:"cicada",secondId:"radio",stickerId:"echo"});
 const opened=openQuestHandoff(handoff);
 assert.equal(opened.ok,true);
 let quest=takeQuestAction(opened,"INSPECT");
 quest=takeQuestAction(quest,"JOIN");
 quest=takeQuestAction(quest,"ATTEMPT");
 quest=takeQuestAction(quest,"REPORT");
 assert.equal(quest.phase,"reported-unconfirmed");
 const carried=createRoomRequest(quest);
 const room=openLocalRoom(JSON.stringify(carried));
 assert.equal(room.ok,true,JSON.stringify(room));
 assert.equal(room.fullMeasurePreview.phase,"reported-unconfirmed");
 assert.deepEqual(room.fullMeasurePreview.localActions,["INSPECT","JOIN","ATTEMPT","REPORT"]);
 assert.equal(room.fullMeasurePreview.pledgeConfirmed,false);
 assert.equal(room.sharedWorldChanged,false);
 const played=actLocalRoom(actLocalRoom(room,"INSPECT"),"ATTEMPT");
 const receipt=exportLocalRoom(played);
 assert.equal(receipt.fullMeasurePreview.receiptRef,carried.questPreviewReceipt.receiptRef);
 assert.equal(receipt.destinationDisposition,"held");
 assert.equal(receipt.sharedWorldChanged,false);
 const clone=()=>JSON.parse(JSON.stringify(carried));
 for(const tamper of [
  q=>q.questPreviewReceipt.pledgeConfirmationRef="fake:confirmed",
  q=>q.questPreviewReceipt.phase="confirmed",
  q=>q.questPreviewReceipt.localActions[1]="REPORT",
  q=>q.questPreviewReceipt.receiptRef="forged",
  q=>q.grant="write-project",
  q=>q.sourceProposal.sourceCardReceipts=[{verified:true}],
  q=>q.questPreviewReceipt.sourceDesignCommit="different"
 ]){
  const specimen=clone();tamper(specimen);
  const refusal=openLocalRoom(specimen);
  assert.equal(refusal.ok,false,JSON.stringify(specimen));
 }
});
