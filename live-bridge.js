/* STATIC ROOM 004 · explicit read-only, same-origin Workbench source door.
   Works only while bridge_server.py serves this HTML on loopback.
   No model, GitHub write, Workbench token, or Workbench action can be invoked here. */
const BRIDGE_TIER='workbench-local-inspected-once';
let liveRepos=[];
let livePrepared=null;
const originalBoundedSourceEvidence=boundedSourceEvidence;
boundedSourceEvidence=function(n){
  const p=sourceProof(n);
  if(p&&p.tier===BRIDGE_TIER)return {
    tier:p.tier,root_id:p.root_id,repo_path:p.repo_path,source_path:p.source_path,
    head:p.head,headType:p.headType,dirty:p.dirty,contentSha256:p.contentSha256,
    workbenchVersion:p.workbenchVersion,checkedAt:p.checkedAt,contentBytes:p.contentBytes,
    excerpt:p.excerpt,contentTruncated:p.contentTruncated,boundary:p.boundary
  };
  return originalBoundedSourceEvidence(n);
};
const originalSourceReaderMarkup=sourceReaderMarkup;
sourceReaderMarkup=function(n){
  const p=sourceProof(n);
  if(!p||p.tier!==BRIDGE_TIER)return originalSourceReaderMarkup(n);
  return `<div class="module source-module"><h4>Source reader · live Workbench witness</h4>
  <p>${esc(p.root_id)} / ${esc(p.repo_path)} / ${esc(p.source_path)} · local HEAD ${esc(p.head)} · SHA-256 ${esc(p.contentSha256.slice(0,16))}…</p>
  <p class="subtle">Read at ${esc(p.checkedAt)}. Snapshot of one inspected worktree file, not continuously refreshed or a verified Git blob. Open Source shelf to prepare another inspection.</p>
  <pre class="source-preview">${esc(p.excerpt)}</pre>
  <div class="module-actions"><button class="action secondary small" id="source-brief">Compose brief from source ↗</button><button class="action secondary small" id="source-handoff">Export source handoff ↗</button></div></div>`;
};
const originalSourceBrief=sourceBrief;
sourceBrief=function(n,p){
  if(p?.tier!==BRIDGE_TIER)return originalSourceBrief(n,p);
  const coordinate=`Workbench ${p.root_id}/${p.repo_path} at short HEAD ${p.head}; ${p.source_path}; SHA-256 ${p.contentSha256}; read ${p.checkedAt}; local-worktree-only`;
  return `STATIC ROOM 004 · Local source-informed creative brief\nSource: ${coordinate}\nObject: ${n.address}\nIntent: ${INTENTS[state.intent].label}\n\nREAD (bounded local worktree excerpt):\n${p.excerpt.slice(0,6500)}\n\nPROPOSE (independent creative work):\nWhat can this source inspire?\n\nFOG:\nHEAD was the Workbench-reported short ref, not a complete commit or immutable Git blob. This is a historical local inspection, not a current-state guarantee.\n\nNEXT:\nDraft, test, then obtain project-owned evidence before making external claims.`;
};
const originalSourceQuickMarkup=sourceQuickMarkup;
sourceQuickMarkup=function(){
  const p=sourceProof(node());
  if(p?.tier!==BRIDGE_TIER)return originalSourceQuickMarkup();
  return `<div class="source-quick"><span>WORKBENCH LOCAL WITNESS · ${esc(p.head)} · ${esc(p.checkedAt)}</span><button class="action secondary small" data-viewgo="sources">Source shelf ↗</button><button class="action secondary small" id="source-brief">Compose source brief ↗</button></div>`;
};
const originalInspectorMarkup=inspectorMarkup;
inspectorMarkup=function(){
  const html=originalInspectorMarkup();
  const p=sourceProof(node());
  if(p?.tier!==BRIDGE_TIER)return html;
  return html.replace('No external repository or file has been verified by this page.', `Read-only local Workbench inspection at ${esc(p.checkedAt)}; no project authority or current upstream state was verified.`);
};

async function roomBridgeGet(path,params){
  const url=new URL(path,window.location.origin);
  for(const [k,v] of Object.entries(params||{}))url.searchParams.set(k,v);
  const response=await fetch(url.toString(),{method:'GET',cache:'no-store',credentials:'omit'});
  const data=await response.json();
  if(!response.ok)throw Error(data.detail||`Read-only bridge returned ${response.status}`);
  return data;
}
function bridgeMessage(s){const el=document.getElementById('live-message');if(el)el.textContent=s;}
function bridgePanel(){
  const screen=document.getElementById('screen');
  if(state.view!=='sources'||!screen||screen.querySelector('#live-workbench'))return;
  const section=document.createElement('section');section.className='workspace';section.id='live-workbench';
  section.innerHTML=`<div class="row"><div><span class="eyebrow">ROOM 004 / EXPLICIT SOURCE CROSSING</span><h3>Live Workbench shelf</h3></div><span class="tag">READ ONLY</span></div>
  <p class="subtle">Requires the separately running local Workbench and the opt-in loopback Room bridge. Source files are read through existing Workbench GET endpoints; no repo writes, project execution, keys, or background sync.</p>
  <div class="module-actions"><button class="action secondary small" id="live-connect">Check local connection ↗</button><button class="action secondary small" id="live-refresh">List Workbench checkouts ↗</button></div>
  <p id="live-message" class="subtle" role="status">Offline HTML mode: use the local file shelf, or launch bridge_server.py and open the printed loopback URL.</p>
  <label class="smallcaps" for="live-repo">Choose a discovered checkout</label><select id="live-repo" style="width:100%;max-width:100%;padding:12px;color:var(--text);background:var(--panel2);border:1px solid var(--edge);border-radius:8px"><option value="">Check connection to load local checkouts</option></select>
  <label class="smallcaps" for="live-file" style="margin-top:10px;display:block">Repository-relative text file</label>
  <input id="live-file" value="README.md" maxlength="240" style="width:100%;padding:12px;color:var(--text);background:var(--panel2);border:1px solid var(--edge);border-radius:8px" placeholder="README.md or docs/design.md">
  <div class="module-actions" style="margin-top:12px"><button class="action secondary" id="live-prepare">1 · Prepare &amp; compare ↗</button><button class="action" id="live-inspect" disabled>2 · Inspect exact source ↗</button></div>
  <div id="live-preview" class="subtle" style="overflow-wrap:anywhere"></div>
  <p class="hint">The prepare receipt pins the Workbench API version, its reported abbreviated HEAD, clean-worktree state, and SHA-256 of source bytes. The inspect button re-reads and fails closed on changes. The file is imported as an explicitly dated LOCAL worktree witness, never as an immutable Git blob.</p>`;
  const shelf=screen.querySelector('.workspace');if(shelf)shelf.insertAdjacentElement('beforebegin',section);else screen.append(section);
  section.querySelector('#live-connect').addEventListener('click',async()=>{
    bridgeMessage('Checking existing local Workbench…');
    try{const r=await roomBridgeGet('/api/room/identity');bridgeMessage(r.connected?`Connected: Workbench ${r.workbenchVersion} matches pinned adapter contract. Select List checkouts.`:`Offline or incompatible: ${r.reason||'No verified Workbench identity.'}`);}
    catch{bridgeMessage('Bridge unavailable. Start bridge_server.py and reopen this page at the printed http://127.0.0.1 address.');}
  });
  section.querySelector('#live-refresh').addEventListener('click',async()=>{
    bridgeMessage('Reading configured Workbench checkout list…');livePrepared=null;section.querySelector('#live-inspect').disabled=true;
    try{const r=await roomBridgeGet('/api/room/repos');liveRepos=r.repos;
      section.querySelector('#live-repo').innerHTML='<option value="">Select a checkout</option>'+liveRepos.map((repo,i)=>`<option value="${i}">${esc(repo.root_id)} / ${esc(repo.repo_path)} @ ${esc(repo.head)} ${repo.dirty?'(dirty)':''} ${repo.detached?'(detached)':''}</option>`).join('');
      bridgeMessage(`${liveRepos.length} Workbench-discovered checkouts; no file has been inspected.`);
    }catch(e){bridgeMessage(`Cannot list checkouts: ${e.message}`);}
  });
  section.querySelector('#live-prepare').addEventListener('click',async()=>{
    livePrepared=null;section.querySelector('#live-inspect').disabled=true;section.querySelector('#live-preview').textContent='';
    const selected=liveRepos[Number(section.querySelector('#live-repo').value)];
    if(!selected||!section.querySelector('#live-repo').value){bridgeMessage('Choose one discovered checkout first.');return;}
    try{const r=await roomBridgeGet('/api/room/prepare',{root_id:selected.root_id,repo_path:selected.repo_path,source_path:section.querySelector('#live-file').value.trim()});
      livePrepared=r;section.querySelector('#live-inspect').disabled=false;
      section.querySelector('#live-preview').textContent=`Source: ${r.root_id}/${r.repo_path}/${r.source_path}\nHEAD: ${r.head} (abbreviated)\nSHA-256: ${r.contentSha256}\nBytes: ${r.bytes}\nPreview:\n${r.preview}`;
      section.querySelector('#live-preview').style.whiteSpace='pre-wrap';bridgeMessage('Prepared source candidate. Inspect only if this is the exact file you intend to bring into the Room.');
    }catch(e){bridgeMessage(`Prepare refused: ${e.message}`);}
  });
  section.querySelector('#live-inspect').addEventListener('click',async()=>{
    if(!livePrepared)return;const candidate=livePrepared;livePrepared=null;section.querySelector('#live-inspect').disabled=true;
    try{const p=await roomBridgeGet('/api/room/inspect',{ticket:candidate.ticket});
      if(Object.keys(state.customNodes).length>=200){bridgeMessage('Room object limit reached; export a snapshot before adding more.');return;}
      const serial=id(),key='workbench-'+serial;
      const name=`${p.repo_path} / ${p.source_path}`.slice(0,120);
      state.customNodes[key]={id:key,name,kind:'Local source',glyph:'⌘',address:`static://source/workbench/${serial}`,summary:'Explicit read-only Workbench witness; a dated local worktree excerpt, not live sync or GitHub blob.',source:`Workbench local witness · ${p.root_id}/${p.repo_path}/${p.source_path} @ ${p.head} · inspected ${p.checkedAt}`,relations:[]};
      state.sourceFiles[key]={...p,name,importedAt:stamp()};
      record('Workbench read-only inspection',`Inspected ${p.root_id}/${p.repo_path}/${p.source_path} @ short HEAD ${p.head}; SHA-256 ${p.contentSha256}; no project mutation.`);
      go(key);notice('Local Workbench source opened. Export a context capsule or compose a brief.');
    }catch(e){bridgeMessage(`Inspection refused: ${e.message}. Prepare again if you still need this source.`);}
  });
}
const priorRoomRender=render;
render=function(){priorRoomRender();bridgePanel();};
render();
