import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openLocalRoom, actLocalRoom, exportLocalRoom } from "../room.mjs";

const clone = x => JSON.parse(JSON.stringify(x));
const fixture = () => {
 const id="pc001:cicada:echo:radio";
 const source={sourceClass:"published-design-draft",repository:"the-static-collective/Jubilee-Engine-VM",commit:"20b529038be86cb88e2fd386536493cd694fd719",path:"docs/superpowers/specs/2026-09-21-postemahhn-v0.1-design.md",sourceCardTitle:"RECEIVE // G0",sourceCardStatus:"specified-not-issued",proofOfPhysicalCard:false,proofOfStickerIssuance:false};
 return {format:"static-field.living-deck-portable-proposal",version:1,status:"unverified-proposal",sourceDesign:source,sourceCardReceipts:null,sourceStickerReceipt:null,sourceVerification:"unavailable",externalAuthority:"none",selection:{firstId:"cicada",secondId:"radio",stickerId:"echo"},localPreviewActions:["INSPECT"],compositionReceipt:{schema:"static-field.postemahhn-composition-preview.v0",id,orderedCardRefs:["fixture:cicada","fixture:radio"],stickerRef:"fixture:echo",authority:"none",status:"proposed",acceptedIntoSharedWorld:false,provenance:{origin:"local-demo-fixture",verifiedExternalCardIdentity:false,importedPostEmahhnReceipt:null}},fullMeasure:{format:"full-measure.project-draft-proposal/0.1",title:"The Porch Radio",story:"A cicada sings.",needs:[{title:"Find the rhythm",status:"open"}],status:"proposal",notAProjectRecord:true,sourceCardProof:null},roroomom:{format:"static-room-source-handoff",version:1,boundary:"Creative handoff for review; not an imported ROroomOM room, capability, or snapshot.",object:{id,name:"The Porch Radio",address:`static://living-deck/${id}`,kind:"proposed encounter"},intent:"explore",sourceEvidence:{designSource:source,issuedCardProof:null},brief:"The porch is singing.",drafts:{quest:"Find the rhythm",room:"The porch is singing."},questions:[],localReceiptCount:0}};
};
test("guest room accepts correctly marked local proposal without admitting canon",()=>{
 const r=openLocalRoom(JSON.stringify(fixture()));
 assert.equal(r.ok,true);
 assert.equal(r.source.compositionId,"pc001:cicada:echo:radio");
 assert.equal(r.source.sourceVerified,false);
 assert.equal(r.status,"preview-only");
 assert.equal(r.destinationDisposition,"held");
 assert.equal(r.sharedWorldChanged,false);
});
test("inspect → attempt → leave → return changes local trace only",()=>{
 const original=openLocalRoom(fixture());
 assert.equal(actLocalRoom(original,"ATTEMPT").code,"inspect-first");
 const inspected=actLocalRoom(original,"INSPECT");
 const attempted=actLocalRoom(inspected,"ATTEMPT");
 const left=actLocalRoom(attempted,"LEAVE");
 assert.equal(left.phase,"away");
 assert.equal(actLocalRoom(left,"ATTEMPT").code,"away");
 const returned=actLocalRoom(left,"RETURN");
 assert.deepEqual(returned.history,["INSPECT","ATTEMPT","LEAVE","RETURN"]);
 assert.deepEqual(original.history,[]);
 const receipt=exportLocalRoom(returned);
 assert.equal(receipt.authority,"none");
 assert.equal(receipt.sharedWorldChanged,false);
 assert.equal(receipt.destinationDisposition,"held");
});
test("source/card/quest overclaims and mismatched composition are refused",()=>{
 const mutations=[
 x=>x.sourceCardReceipts=[{verified:true}],
 x=>x.externalAuthority="admin",
 x=>x.sourceDesign.proofOfPhysicalCard=true,
 x=>x.selection.firstId="radio",
 x=>x.compositionReceipt.authority="unlimited",
 x=>x.compositionReceipt.id="forged",
 x=>x.fullMeasure.status="open",
 x=>x.roroomom.sourceEvidence.issuedCardProof={ok:true},
 x=>x.localPreviewActions.push("DELETE_WORLD"),
 x=>x.roroomom.boundary="imported as world canon"
 ];
 for(const mutate of mutations){
  const x=fixture();mutate(x);
  const response=openLocalRoom(x);
  assert.equal(response.ok,false,JSON.stringify(x));
 }
});
test("unsupported JSON and actions fail closed; large history does not truncate silently",()=>{
 assert.equal(openLocalRoom("{").code,"invalid-json");
 assert.equal(openLocalRoom(JSON.stringify({format:"foreign"})).code,"wrong-format");
 assert.equal(actLocalRoom(openLocalRoom(fixture()),"SHELL").code,"unsupported-action");
 let r=openLocalRoom(fixture());
 for(let i=0;i<60;i++)r=actLocalRoom(r,"INSPECT");
 assert.equal(actLocalRoom(r,"INSPECT").code,"trace-full");
});

// Actual producer→consumer contract when the Static Field checkout is available.
// CI checks out the current public producer branch into a separate read-only tree.
test("Static Field browser export becomes a playable ROroomOM local room",async(t)=>{
 const dir=process.env.STATIC_FIELD_DECK_DIR;
 if(!dir){t.skip("Set STATIC_FIELD_DECK_DIR to a checkout of the producer to run cross-repo contract");return}
 const modulePath=resolve(dir,"experiments/postemahhn-living-deck-001/browser-handoff.mjs");
 const {buildBrowserHandoff}=await import(pathToFileURL(modulePath).href);
 const p=buildBrowserHandoff({firstId:"cicada",secondId:"radio",stickerId:"echo"},["INSPECT"]);
 const r=openLocalRoom(JSON.stringify(p));
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.equal(r.title,p.roroomom.object.name);
 assert.equal(r.source.designCommit,p.sourceDesign.commit);
 const played=actLocalRoom(actLocalRoom(r,"INSPECT"),"ATTEMPT");
 assert.equal(played.phase,"attempted");
 assert.equal(exportLocalRoom(played).sharedWorldChanged,false);
});
