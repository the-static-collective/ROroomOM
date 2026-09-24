/* FRANKENSTEIN-001 · opt-in, offline Lemon → door → Room Score adapter.
 * Independently replays the bounded Lemon Press Slice 003 event contract.
 * No imported authority, project writes, or canonical admission. */
'use strict';
const Frankenstein = (() => {
  const IDS=Object.freeze({book:'lp:book/001',cup:'lp:cup/blue',photo:'lp:photograph/blue-hour'});
  const QUALITY={
    [IDS.book]:['holds','memory','threshold'],
    [IDS.cup]:['holds','blue','water'],
    [IDS.photo]:['memory','blue','light']
  };
  const GESTURES={holds:true,memory:true,blue:true};
  const ALLOWED=new Set(['DISCOVER_DOOR','ENTER_ROOM','SIP_CUP','TAKE_PHOTO','PLACE_PHOTO','RECOGNIZE_PHOTO','LEAVE_ROOM','RELATE','TRACE_PATH','PRINT_LEAF','MARK_QUALITY','INVENT_RELATION','PLAY_INVENTION','WEAVE_RELATION']);
  const clone=x=>JSON.parse(JSON.stringify(x));
  const assert=(condition,message)=>{if(!condition)throw Error(message);};
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const pair=(a,b)=>[a,b].sort();
  const pairId=(a,b)=>'rel:'+pair(a,b).join('~');
  const qualities=(s,id)=>[...(QUALITY[id]||[]),...s.marks.filter(m=>m.objectId===id).map(m=>m.quality),...Object.values(s.inventions).filter(l=>l.kind==='weave'&&(l.a===id||l.b===id)).map(l=>l.quality)];
  const shared=(s,a,b)=>qualities(s,a).filter(q=>qualities(s,b).includes(q));
  const validQuality=v=>typeof v==='string'&&v.length<=28&&/^[a-z0-9][a-z0-9 -]*$/.test(v)&&v===v.trim()&&v===v.toLowerCase();
  const validCopy=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&v===v.trim()&&/[^\s]/.test(v)&&!/[\u0000-\u001f\u007f]/.test(v);
  function initial(){return {door:false,visits:0,sips:0,photoLocation:'wall',recognized:false,links:{},paths:{},printed:false,marks:[],inventions:{},performed:{},weaves:{}};}
  function originalPair(a,b){
    if(a===b||!QUALITY[a]||!QUALITY[b])return null;
    const q=QUALITY[a].find(x=>QUALITY[b].includes(x)&&GESTURES[x]);
    return q?{id:pairId(a,b),a:pair(a,b)[0],b:pair(a,b)[1],quality:q}:null;
  }
  function pairs(){return Object.keys(QUALITY).flatMap((a,i,all)=>all.slice(i+1).map(b=>originalPair(a,b)).filter(Boolean));}
  function routes(s){
    const links=[...Object.values(s.links),...Object.values(s.inventions).filter(l=>s.performed[l.id])],out=[];
    for(let i=0;i<links.length;i++)for(let j=i+1;j<links.length;j++){
      const a=links[i],b=links[j],intersection=[a.a,a.b].filter(id=>id===b.a||id===b.b);
      if(intersection.length!==1)continue;
      const via=intersection[0],ends=[a.a,a.b,b.a,b.b].filter(id=>id!==via).sort(),edges=[a.id,b.id].sort();
      const legacy=edges.every(id=>id.startsWith('rel:lp:'));
      const id='path:'+ends.join('~')+'|via:'+via+(legacy?'':'|witness:'+edges.join('+'));
      if(!out.some(r=>r.id===id))out.push({id,via,ends,edges});
    }
    return out;
  }
  const target=e=>e.type==='MARK_QUALITY'?e.objectId:({SIP_CUP:IDS.cup,TAKE_PHOTO:IDS.photo,PLACE_PHOTO:IDS.photo,RECOGNIZE_PHOTO:IDS.photo})[e.type]||IDS.book;
  function fields(type){return ['id','at','type','target',...({RELATE:['a','b','quality'],TRACE_PATH:['pathId','via','edges'],MARK_QUALITY:['objectId','quality'],INVENT_RELATION:['a','b','quality','title','description'],PLAY_INVENTION:['relationId'],WEAVE_RELATION:['a','b','via','edges','routeId','quality','title','description']})[type]||[]];}
  function replay(events){
    const s=initial(),ids=new Set();
    for(const e of events){
      assert(record(e)&&typeof e.id==='string'&&/^ev:[a-zA-Z0-9._:-]{1,100}$/.test(e.id)&&!ids.has(e.id)&&typeof e.at==='string'&&Number.isFinite(Date.parse(e.at))&&ALLOWED.has(e.type)&&e.target===target(e),'Invalid Lemon event record');
      const keys=fields(e.type);assert(Object.keys(e).length===keys.length&&keys.every(k=>own(e,k)),'Unknown or missing Lemon event fields');ids.add(e.id);
      switch(e.type){
        case 'DISCOVER_DOOR':assert(!s.door,'Door already found');s.door=true;break;
        case 'ENTER_ROOM':assert(s.door,'Door not found');s.visits++;break;
        case 'SIP_CUP':assert(s.visits&&!s.sips,'Cup not available');s.sips++;break;
        case 'TAKE_PHOTO':assert(s.visits&&s.photoLocation==='wall','Photo unavailable');s.photoLocation='held';break;
        case 'PLACE_PHOTO':assert(s.visits&&s.photoLocation==='held','Photo not held');s.photoLocation='book';break;
        case 'RECOGNIZE_PHOTO':assert(s.photoLocation==='book'&&!s.recognized,'Photo not ready');s.recognized=true;break;
        case 'LEAVE_ROOM':assert(s.visits,'Not entered');break;
        case 'RELATE':{
          assert(s.visits,'Not entered');const p=originalPair(e.a,e.b);
          assert(p&&p.a===e.a&&p.b===e.b&&p.quality===e.quality&&!s.links[p.id],'Invalid original relation');
          s.links[p.id]={...p,sourceEvent:e.id};break;}
        case 'TRACE_PATH':{
          assert(Array.isArray(e.edges)&&e.edges.length===2&&e.edges.every(x=>typeof x==='string'),'Invalid route edges');
          const r=routes(s).find(x=>x.id===e.pathId&&x.via===e.via&&x.edges[0]===e.edges[0]&&x.edges[1]===e.edges[1]);
          assert(r&&!s.paths[r.id],'Route has no witnessed edges');s.paths[r.id]={...r,sourceEvent:e.id};break;}
        case 'MARK_QUALITY':assert(s.visits&&QUALITY[e.objectId]&&validQuality(e.quality)&&s.marks.length<18&&!qualities(s,e.objectId).includes(e.quality),'Invalid quality');s.marks.push({objectId:e.objectId,quality:e.quality,sourceEvent:e.id});break;
        case 'INVENT_RELATION':{
          assert(s.visits&&Object.keys(s.inventions).length<14&&QUALITY[e.a]&&QUALITY[e.b]&&e.a<e.b&&validQuality(e.quality)&&shared(s,e.a,e.b).includes(e.quality)&&validCopy(e.title,58)&&validCopy(e.description,200),'Invalid invention');
          const id='rel:invented:'+e.id;s.inventions[id]={id,kind:'pair',a:e.a,b:e.b,quality:e.quality,title:e.title,description:e.description,sourceEvent:e.id};break;}
        case 'PLAY_INVENTION':assert(s.visits&&s.inventions[e.relationId]&&!s.performed[e.relationId],'Invention not available to perform');s.performed[e.relationId]=e.id;break;
        case 'WEAVE_RELATION':{
          assert(s.visits&&Object.keys(s.inventions).length<14&&validCopy(e.title,58)&&validCopy(e.description,200)&&validQuality(e.quality)&&Array.isArray(e.edges)&&e.edges.length===2&&e.edges.every(x=>typeof x==='string'),'Invalid weave');
          const route=routes(s).find(r=>r.id===e.routeId&&r.ends[0]===e.a&&r.ends[1]===e.b&&r.via===e.via&&r.edges[0]===e.edges[0]&&r.edges[1]===e.edges[1]);
          assert(route&&s.paths[route.id]&&!s.weaves[route.id]&&!shared(s,e.a,e.b).includes(e.quality),'Unwitnessed weave');
          const id='rel:invented:'+e.id;s.inventions[id]={id,kind:'weave',a:e.a,b:e.b,quality:e.quality,title:e.title,description:e.description,sourceEvent:e.id,via:e.via,edges:clone(e.edges),routeId:e.routeId};s.weaves[route.id]=id;break;}
        case 'PRINT_LEAF':assert(Object.keys(s.links).length===pairs().length&&Object.keys(s.paths).length>0&&s.recognized&&s.photoLocation==='book'&&!s.printed,'Leaf not ready');s.printed=true;break;
        default:throw Error('Unknown event type');
      }
    }
    return s;
  }
  function verifyLemon(input){
    const receipt=typeof input==='string'?JSON.parse(input):clone(input);
    assert(record(receipt)&&JSON.stringify(receipt).length<=131072,'Oversized or malformed receipt');
    assert(receipt.kind==='lemon-press.living-artifact.receipt'&&receipt.version===3&&receipt.edition==='001-slice-003','Requires real Lemon Slice 003 receipt');
    assert(Array.isArray(receipt.objectIds)&&receipt.objectIds.length===3&&Object.keys(QUALITY).every(x=>receipt.objectIds.includes(x)),'Object identity mismatch');
    assert(Array.isArray(receipt.events)&&receipt.events.length<=2000,'Invalid event count');
    const state=replay(receipt.events);
    return {receipt,state};
  }
  function witnesses(state,events){
    const selected=[];
    for(const e of events){
      if(e.type==='SIP_CUP')selected.push({eventId:e.id,kind:'sip',title:'The blue cup was used',description:'An actual recorded SIP_CUP event.'});
      if(e.type==='PLAY_INVENTION'){
        const link=state.inventions[e.relationId];
        if(link&&(link.a===IDS.cup||link.b===IDS.cup))selected.push({eventId:e.id,kind:'performed-relation',relationId:link.id,title:link.title,description:link.description});
      }
    }
    return selected;
  }
  async function sha256(value){
    const bytes=new TextEncoder().encode(value);
    const subtle=typeof globalThis!=='undefined'&&globalThis.crypto?.subtle?globalThis.crypto.subtle:typeof require==='function'?require('node:crypto').webcrypto.subtle:null;
    assert(subtle,'SHA-256 unavailable');const result=await subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');
  }
  const sourceBytes=r=>JSON.stringify({objectIds:r.objectIds,events:r.events});
  async function makeDoor(input,eventId){
    const {receipt,state}=verifyLemon(input),valid=witnesses(state,receipt.events),w=valid.find(x=>x.eventId===eventId);
    assert(w,'Select an actually performed cup encounter, not a proposal');
    const digest=await sha256(sourceBytes(receipt));
    return {schema:'frankenstein-door/v1-experimental',source:{application:'lemon-press',edition:receipt.edition,object:IDS.cup,receiptSha256:digest,receipt},witness:clone(w),returnAddress:IDS.book,request:'guest-preview-only',note:'Untrusted local source assertion. No actor authentication, canonical admission or grant.'};
  }
  function freshState(){return {schema:'frankenstein-receiver/v1',guests:[],seen:[]};}
  async function acceptDoor(packet,inputState,approved,localId){
    assert(approved===true,'Human acceptance required');
    const raw=JSON.stringify(packet);assert(raw.length<=131072,'Door packet too large');
    assert(record(packet)&&Object.keys(packet).sort().join(',')==='note,request,returnAddress,schema,source,witness','Unexpected door fields');
    assert(packet.schema==='frankenstein-door/v1-experimental'&&packet.request==='guest-preview-only'&&packet.returnAddress===IDS.book&&record(packet.source)&&Object.keys(packet.source).sort().join(',')==='application,edition,object,receipt,receiptSha256','Invalid source envelope');
    const src=packet.source;assert(src.application==='lemon-press'&&src.object===IDS.cup&&src.edition==='001-slice-003'&&/^[a-f0-9]{64}$/.test(src.receiptSha256),'Invalid source address');
    assert(await sha256(sourceBytes(src.receipt))===src.receiptSha256,'Source digest mismatch');
    const {receipt,state:sourceState}=verifyLemon(src.receipt);const options=witnesses(sourceState,receipt.events);
    assert(options.some(w=>JSON.stringify(w)===JSON.stringify(packet.witness)),'Witness does not match replayed source');
    const state=clone(inputState);assert(record(state)&&state.schema==='frankenstein-receiver/v1'&&Array.isArray(state.guests)&&Array.isArray(state.seen)&&state.guests.length<24,'Invalid or full local receiver');
    const key=src.receiptSha256+':'+packet.witness.eventId;assert(!state.seen.includes(key),'This source event was already accepted locally');
    const id=localId||('guest-'+(typeof globalThis!=='undefined'&&globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():require('node:crypto').randomUUID()));
    assert(/^guest-[a-zA-Z0-9-]{1,100}$/.test(id)&&!state.guests.some(g=>g.id===id),'Invalid or repeated guest ID');
    const guest={id,sourceObject:IDS.cup,sourceEvent:packet.witness.eventId,sourceHash:src.receiptSha256,returnAddress:IDS.book,title:packet.witness.title,description:packet.witness.description,permissions:[],localHistory:[{type:'ACCEPT_GUEST_PREVIEW',sourceEvent:packet.witness.eventId}],sourceTrusted:false};
    state.guests.push(guest);state.seen.push(key);
    return {state,guest};
  }
  function toRoomScore(guest){
    assert(record(guest)&&guest.sourceObject===IDS.cup&&guest.permissions?.length===0&&guest.localHistory?.length===1,'Invalid guest projection');
    const sourceNote='Unverified source '+guest.sourceObject+' · event '+guest.sourceEvent+' · SHA-256 '+guest.sourceHash+' · return '+guest.returnAddress;
    return {format:'roroomom-experience-score',version:1,score:{id:'score-'+guest.id,object:'guest-preview-proposal',parent:null,title:'The blue cup · visiting encounter',layout:'stack',cards:[
      {id:'card-'+guest.id+'-source',kind:'text',role:'card',title:'A cup enters another Room',body:sourceNote,assetId:null},
      {id:'card-'+guest.id+'-action',kind:'action',role:'button',title:guest.title,body:guest.description+' This Room witnesses only the local preview acceptance, not the original encounter.',assetId:null}
    ],events:[]},assets:{},lineage:[],boundary:'Experimental local preview. Source history remains outside this score. No imported permission, source authority, original object ownership, or canonical admission.'};
  }
  return {IDS,verifyLemon,witnesses,sha256,makeDoor,freshState,acceptDoor,toRoomScore};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Frankenstein;
