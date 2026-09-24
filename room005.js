/* ROroomOM 005 · explicit project-owned search and Room-owned artifact crossing.
   No generic URL, command execution, GitHub mutation, or Workbench token relay. */
const ROOM_SEARCH='static-workbench.creator.search-v1';
const ROOM_EXPORT='roroomom.outbox.materialize-v1';
let room005Prepared=null,room005Repos=[],room005LastReceipt=null,room005Busy=false;
function room005Status(msg){const el=document.getElementById('room005-status');if(el)el.textContent=msg;}
function room005DisableApproval(){const b=document.getElementById('room005-execute');if(b)b.disabled=!room005Prepared;}
async function room005Get(path,params={}){return roomBridgeGet(path,params);}
async function room005Post(path,data){
  const response=await fetch(path,{method:'POST',credentials:'omit',cache:'no-store',
    headers:{'Content-Type':'application/json','X-Room-Action':'explicit-user-confirm'},
    body:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok)throw Error(result.detail||`Room bridge returned ${response.status}`);
  return result;
}
function room005Panel(){
 const screen=document.getElementById('screen');
 if(!screen||!['room','sources'].includes(state.view)||screen.querySelector('#room005-deck'))return;
 const area=document.createElement('section');area.id='room005-deck';area.className='workspace';
 const draft=state.drafts[`${state.current}:${state.intent}`]||state.drafts[`${state.current}:trace`]||'';
 area.innerHTML=`<div class="row"><div><span class="eyebrow">ROroomOM 005 / CAPABILITY CROSSING</span><h3>Instrument deck · explicit execution</h3></div><span class="tag">TWO PINNED OPERATIONS</span></div>
 <p class="subtle">Discover → prepare → inspect exact preview → human confirm → execute → inspect receipt. Descriptors are not execution authority. The Workbench search is project-owned and read-only; the Room outbox creates only a Room-owned local file.</p>
 <label class="smallcaps" for="room005-kind">Choose an admitted instrument</label>
 <select id="room005-kind" style="width:100%;padding:11px;color:var(--text);background:var(--panel2);border:1px solid var(--edge);border-radius:8px">
  <option value="${ROOM_SEARCH}">Workbench · bounded Creator Desk search (read only)</option>
  <option value="${ROOM_EXPORT}">ROroomOM · materialize one Markdown artifact (local outbox)</option></select>
 <div id="room005-search" style="margin-top:12px"><button class="action secondary small" id="room005-load">Discover local Workbench checkouts ↗</button>
  <label class="smallcaps" for="room005-repo">Discovered checkout</label><select id="room005-repo" style="width:100%;padding:11px;color:var(--text);background:var(--panel2);border:1px solid var(--edge);border-radius:8px"><option value="">Load local Workbench checkouts first</option></select>
  <label class="smallcaps" for="room005-query">Bounded source query</label><input id="room005-query" value="room" maxlength="100" style="width:100%;padding:11px;color:var(--text);background:var(--panel2);border:1px solid var(--edge);border-radius:8px"></div>
 <div id="room005-export" style="display:none;margin-top:12px"><label class="smallcaps" for="room005-title">Artifact title</label><input id="room005-title" maxlength="100" value="${esc(node().name+' · creative trace')}" style="width:100%;padding:11px;color:var(--text);background:var(--panel2);border:1px solid var(--edge);border-radius:8px">
 <label class="smallcaps" for="room005-source">Source coordinate (unverified user-supplied reference)</label><input id="room005-source" maxlength="1000" value="${esc(node().address)}" style="width:100%;padding:11px;color:var(--text);background:var(--panel2);border:1px solid var(--edge);border-radius:8px">
 <label class="smallcaps" for="room005-content">Exact Markdown content to materialize</label><textarea id="room005-content" maxlength="8192" style="width:100%;min-height:130px">${esc(draft)}</textarea></div>
 <div class="module-actions" style="margin-top:12px"><button class="action secondary" id="room005-discover">Inspect contracts ↗</button><button class="action" id="room005-prepare">1 · Prepare operation ↗</button></div>
 <p role="status" id="room005-status" class="subtle">Offline: launch bridge_server.py and open the loopback URL to enable execution. Existing Room drafting works without the bridge.</p>
 <div id="room005-review" style="display:none"><h4>Exact proposed operation · inspect before authorizing</h4><pre id="room005-preview" class="source-preview" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>
  <label style="display:flex;gap:8px;align-items:center"><input id="room005-approval" type="checkbox">I have reviewed this exact preview and approve this one operation.</label>
  <div class="module-actions"><button class="action" id="room005-execute" disabled>2 · Execute this exact operation ↗</button><button class="action secondary small" id="room005-cancel">Discard ticket</button></div></div>
 <div id="room005-outcome" role="status" style="white-space:pre-wrap;overflow-wrap:anywhere"></div>
 <div class="module-actions"><button class="action secondary small" id="room005-pin-result" style="display:none">Pin inspected result into creative field ↗</button></div>
 <div class="module-actions"><input id="room005-receipt-id" maxlength="32" placeholder="32-character receipt ID" style="width:220px;max-width:100%;padding:9px;color:var(--text);background:var(--panel2);border:1px solid var(--edge);border-radius:8px"><button class="action secondary small" id="room005-inspect-receipt">Inspect saved receipt ↗</button></div>
 <p class="hint">Any external project action requires its own project adapter and authorization. These two operations do not execute arbitrary project commands. Outbox files exist only on the computer running the local Room bridge.</p>`;
 if(state.view==='room')screen.insertBefore(area,screen.children[1]||null);else screen.appendChild(area);
 const $=id=>area.querySelector('#'+id);
 function discard(){room005Prepared=null;$('room005-review').style.display='none';$('room005-approval').checked=false;room005DisableApproval();}
 $('room005-kind').addEventListener('change',()=>{discard();$('room005-search').style.display=$('room005-kind').value===ROOM_SEARCH?'block':'none';$('room005-export').style.display=$('room005-kind').value===ROOM_EXPORT?'block':'none';});
 $('room005-discover').addEventListener('click',async()=>{try{const c=await room005Get('/api/room/capabilities');room005Status(`Discovered ${c.capabilities.length} allowlisted capability descriptors. Presence does not grant execution authority.`);}catch(e){room005Status('No local capability bridge: '+e.message);}});
 $('room005-load').addEventListener('click',async()=>{discard();try{room005Repos=(await room005Get('/api/room/repos')).repos;$('room005-repo').innerHTML='<option value="">Select a checkout</option>'+room005Repos.map((r,i)=>`<option value="${i}">${esc(r.root_id)} / ${esc(r.repo_path)} @ ${esc(r.head)}${r.dirty?' (dirty)':''}</option>`).join('');room005Status(`${room005Repos.length} locally discovered Workbench checkouts.`);}catch(e){room005Status('Discovery unavailable: '+e.message);}});
 $('room005-prepare').addEventListener('click',async()=>{
  if(room005Busy)return;discard();room005Busy=true;room005Status('Preparing only; no action has been approved.');
  try{const operationId=$('room005-kind').value;let inputs;
   if(operationId===ROOM_SEARCH){const i=$('room005-repo').value;const repo=room005Repos[Number(i)];if(!i||!repo)throw Error('Select a discovered checkout first.');inputs={root_id:repo.root_id,repo_path:repo.repo_path,query:$('room005-query').value.trim()};}
   else inputs={title:$('room005-title').value,content:$('room005-content').value,source:$('room005-source').value};
   const p=await room005Post('/api/room/capabilities/prepare',{operationId,inputs});
   room005Prepared=p;$('room005-preview').textContent=JSON.stringify({operationId:p.operationId,inputSha256:p.inputSha256,preview:p.preview,expiresSeconds:p.expiresSeconds},null,2);
   $('room005-review').style.display='block';room005Status('Prepared, NOT executed. Inspect the complete preview and approve separately.');
  }catch(e){room005Status('Preparation refused: '+e.message);}finally{room005Busy=false;}
 });
 $('room005-approval').addEventListener('change',()=>{$('room005-execute').disabled=!room005Prepared||!$('room005-approval').checked;});
 $('room005-cancel').addEventListener('click',()=>{discard();room005Status('Local preview discarded; unused server ticket expires automatically.');});
 $('room005-execute').addEventListener('click',async()=>{
  if(room005Busy||!room005Prepared||!$('room005-approval').checked)return;
  const p=room005Prepared;discard();room005Busy=true;room005Status('Executing the one approved operation; outcome not yet known.');
  try{const receipt=await room005Post('/api/room/capabilities/execute',{ticket:p.ticket,approvedInputSha256:p.inputSha256,approval:'I approve this exact operation'});
   room005LastReceipt=receipt;$('room005-receipt-id').value=receipt.receiptId;
   $('room005-pin-result').style.display=receipt.disposition==='completed'&&receipt.operationId===ROOM_SEARCH?'inline-block':'none';
   $('room005-outcome').textContent=JSON.stringify(receipt,null,2);
   record('capability execution',`${receipt.operationId}: ${receipt.disposition}; receipt ${receipt.receiptId}; externally verified authority: none.`);persist();
   room005Status(`${receipt.disposition.toUpperCase()} · Durable local receipt ${receipt.receiptId}. This receipt records observed effects, not anticipated success.`);
  }catch(e){room005Status('Execution outcome not confirmed: '+e.message+'. Inspect outbox/receipts before preparing a retry.');}
  finally{room005Busy=false;}
 });
 $('room005-pin-result').addEventListener('click',()=>{
  const receipt=room005LastReceipt;
  if(!receipt||receipt.disposition!=='completed'||receipt.operationId!==ROOM_SEARCH||!receipt.result)return;
  const origin=node();const n=receipt.result;const serial=id();const key='leaf-'+serial;
  const obj={id:key,name:`Search · ${n.repo_path} · ${n.query}`.slice(0,120),kind:'Research',glyph:'⌕',
    address:`static://local/workbench-search-${serial}`,summary:`${n.hits.length} source-location candidates from a local Workbench Creator Desk search. Read-only, not an authoritative interpretation.`,
    source:`Workbench local search receipt ${receipt.receiptId}; root ${n.root_id}; repo ${n.repo_path}; short HEAD ${n.head}`,relations:[{to:origin.id,type:'searched during encounter with',status:'proposed',why:'Search proximity does not establish a semantic relationship.'}]};
  state.customNodes[key]=obj;
  (state.extraRelations[origin.id]??=[]).push({to:key,type:'generated bounded local search result',status:'proposed',why:'Source hits are locators, not independently inspected source files or verified claims.'});
  state.drafts[`${key}:trace`]=`Search receipt: ${receipt.receiptId}\nQuery: ${n.query}\nRoot: ${n.root_id}\nRepo: ${n.repo_path}\nHEAD (short): ${n.head}\n\n`+n.hits.map(h=>`${h.source_path}:${h.line} · ${h.snippet}\nSHA-256 ${h.file_sha256}`).join('\n\n');
  record('source search projected',`Local Workbench search ${receipt.receiptId} projected as ${obj.address}; no source file imported or fact promoted.`);
  go(key);notice('Source locations projected into a new research object; inspect exact files separately.');
 });
 $('room005-inspect-receipt').addEventListener('click',async()=>{try{const id=$('room005-receipt-id').value;const r=await room005Get('/api/room/capabilities/receipt',{id});$('room005-outcome').textContent=JSON.stringify(r,null,2);room005Status(`Receipt ${id}: ${r.disposition}. Retrieved from local receipt store.`);}catch(e){room005Status('Receipt inspection failed: '+e.message);}});
}
const before005Render=render;
render=function(){before005Render();room005Panel();};
render();
