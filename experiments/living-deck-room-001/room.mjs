// ROroomOM-owned, local-only render adapter for Static Field Living Deck proposals.
// Import is a proposed creative encounter, never admission of a source card or a world event.

const cardIds = ["cicada", "cup", "radio", "door"];
const stickerIds = ["echo", "pour", "open", "grow", "call", "wait"];
const fail = (code, explanation) => ({ ok: false, code, explanation });
const plain = x => x !== null && typeof x === "object" && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const strictText = (v, limit) => typeof v === "string" && v.length > 0 && v.length <= limit;
const same = (a, b) => a === b;
function validSelection({firstId:a,secondId:b,stickerId:s} = {}) {
 if (!cardIds.includes(a)||!cardIds.includes(b)||!stickerIds.includes(s)) return false;
 if (a === b) return false;
 if (s === "echo" && !(a === "cicada" && b === "radio")) return false;
 if (s === "pour" && a !== "cup") return false;
 if (s === "open" && b !== "door") return false;
 if (s === "call" && !["cicada", "radio"].includes(a)) return false;
 return true;
}
function parseInput(value) {
 if (typeof value === "string") {
   if (value.length > 65536) return fail("too-large", "The handoff exceeds 64 KiB.");
   try { value = JSON.parse(value); } catch { return fail("invalid-json", "The handoff is not valid JSON."); }
 }
 if (!plain(value)) return fail("malformed", "Expected a plain JSON object.");
 if (value.format !== "static-field.living-deck-portable-proposal" || value.version !== 1)
   return fail("wrong-format", "Use the living-deck cross-world proposal JSON, not a card scan or unrelated snapshot.");
 if (value.status !== "unverified-proposal" || value.externalAuthority !== "none" ||
     value.sourceCardReceipts !== null || value.sourceStickerReceipt !== null ||
     value.sourceVerification !== "unavailable")
   return fail("authority-overclaim", "This preview accepts only explicitly unverified local proposals.");
 const source = value.sourceDesign;
 if (!plain(source) || source.repository !== "the-static-collective/Jubilee-Engine-VM" ||
     source.commit !== "20b529038be86cb88e2fd386536493cd694fd719" ||
     source.sourceCardStatus !== "specified-not-issued" ||
     source.proofOfPhysicalCard !== false || source.proofOfStickerIssuance !== false)
   return fail("source-mismatch", "Unknown design source or inflated physical-card claim.");
 if (!plain(value.selection) || !validSelection(value.selection))
   return fail("incompatible-cards", "The selected card/sticker relation has no declared adapter.");
 const s=value.selection,c=value.compositionReceipt;
 const id=`pc001:${s.firstId}:${s.stickerId}:${s.secondId}`;
 if (!plain(c) || c.id !== id || c.schema !== "static-field.postemahhn-composition-preview.v0" ||
     !Array.isArray(c.orderedCardRefs) || c.orderedCardRefs.length!==2 ||
     !same(c.orderedCardRefs[0],`fixture:${s.firstId}`) ||
     !same(c.orderedCardRefs[1],`fixture:${s.secondId}`) ||
     c.stickerRef !== `fixture:${s.stickerId}` || c.authority !== "none" ||
     c.status !== "proposed" || c.acceptedIntoSharedWorld !== false ||
     !plain(c.provenance) || c.provenance.origin !== "local-demo-fixture" ||
     c.provenance.verifiedExternalCardIdentity !== false ||
     c.provenance.importedPostEmahhnReceipt !== null)
   return fail("composition-mismatch", "The card receipt does not match the selected local fixture relation.");
 const fm=value.fullMeasure, room=value.roroomom;
 if (!plain(fm) || fm.format !== "full-measure.project-draft-proposal/0.1" ||
     fm.status !== "proposal" || fm.notAProjectRecord !== true ||
     fm.sourceCardProof !== null || !strictText(fm.title,200) ||
     !Array.isArray(fm.needs) || fm.needs.length !== 1 || fm.needs[0]?.status !== "open")
   return fail("project-overclaim", "The Full Measure payload is not a bounded, unadmitted project draft.");
 if (!plain(room) || room.format !== "static-room-source-handoff" ||
     room.version !== 1 || !plain(room.object) || room.object.id !== id ||
     !strictText(room.object.name,200) || !strictText(room.brief,2000) ||
     room.object.address !== `static://living-deck/${id}` ||
     !strictText(room.boundary,500) || !room.boundary.includes("not an imported ROroomOM room") ||
     !plain(room.sourceEvidence) || room.sourceEvidence.issuedCardProof !== null ||
     room.sourceEvidence.designSource?.commit !== source.commit)
   return fail("room-overclaim", "The room handoff is not a bounded unverified creative proposal.");
 if (!Array.isArray(value.localPreviewActions) || value.localPreviewActions.length > 50 ||
     value.localPreviewActions.some(x=>!["INSPECT","ATTEMPT","LEAVE"].includes(x)))
   return fail("invalid-history", "Unrecognized or oversized local action trace.");
 return {ok:true,source: {
   format:value.format,compositionId:id,cardRefs:[...c.orderedCardRefs],stickerRef:c.stickerRef,
   designCommit:source.commit,origin:"local-fixture",sourceVerified:false,
   physicalCardVerified:false,cardAuthority:"none",humanApprovalForExternalEffect:false
 },title:room.object.name,brief:room.brief,quest:fm.needs[0].title,
 proposedProject:fm.title,priorLocalActions:[...value.localPreviewActions]};
}
export function openLocalRoom(input) {
 const parsed=parseInput(input);
 if (!parsed.ok) return parsed;
 return {ok:true, status:"preview-only",...parsed,phase:"arrived",history:[],
  destinationDisposition:"held",admissionReason:"requires-project-owned-verification-and-explicit-authorization",
  sharedWorldChanged:false};
}
export function actLocalRoom(room,action) {
 if (!room?.ok || room.status !== "preview-only" || !Array.isArray(room.history))
   return fail("room-not-open", "Open a supported handoff before acting.");
 if (!["INSPECT","ATTEMPT","LEAVE","RETURN"].includes(action))
   return fail("unsupported-action", "Only inspect, attempt, leave, and return are locally playable.");
 if (room.history.length >= 60) return fail("trace-full", "Local trace limit reached; export instead of silently dropping history.");
 if (room.phase === "away" && action !== "RETURN") return fail("away", "Choose Return before taking another action.");
 if (room.phase !== "away" && action === "RETURN") return fail("not-away", "Return applies only after leaving.");
 if (action === "ATTEMPT" && !room.history.includes("INSPECT"))
   return fail("inspect-first", "Inspect the proposed relationship before attempting it.");
 const history=[...room.history,action];
 const phase=action==="LEAVE"?"away":action==="RETURN"?"returned":action==="ATTEMPT"?"attempted":"inspected";
 return {...room,phase,history,sharedWorldChanged:false,destinationDisposition:"held"};
}
export function exportLocalRoom(room) {
 if (!room?.ok || room.status !== "preview-only") return fail("room-not-open","Nothing to export.");
 return {format:"roroomom.living-deck-local-preview",version:1,source:room.source,
  title:room.title,brief:room.brief,quest:room.quest,history:[...room.history],
  sourceVerification:"unverified",destinationDisposition:"held",
  sharedWorldChanged:false,externalPublication:false,authority:"none"};
}
