/* ===== OpenSkillTrace — app controller ===== */
(function(){
const D = window.DATA, ic = window.icon, V = window.Views;
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

const VIEWS = {
  overview:{ render:V.overview, crumb:['Build','Overview'], flush:false },
  studio:{ render:V.studio, crumb:['Build','Workflow Studio','Scam Transaction Response'], flush:true },
  catalog:{ render:V.catalog, crumb:['Build','Catalogs'], flush:false },
  rag:{ render:V.rag, crumb:['Build','RAG Builder'], flush:false },
  providers:{ render:V.providers, crumb:['Reliability','Model Providers'], flush:false },
  fallback:{ render:V.fallback, crumb:['Reliability','Fallback Center'], flush:true&&false, flush:false },
  eval:{ render:V.eval, crumb:['Reliability','Eval & Replay'], flush:false },
  governance:{ render:V.governance, crumb:['Govern','Data Governance'], flush:false },
};

/* ---------- shared workflow state ---------- */
const STATE_KEY = 'ost_workflow_state_v3';
const seed = {
  flow: D.flow.map(n=>({...n, meta:(n.meta||[]).map(m=>({...m}))})),
  edges: D.edges.map(e=>e.slice()),
};
const state = {
  dirty:false,
  lastSaved:'not saved yet',
  replayPass:91,
  evalRuns:1,
  auditPackets:1,
  catalogAdds:0,
  lastValidation:null,
};

function loadState(){
  try{
    const raw = localStorage.getItem(STATE_KEY);
    if(!raw) return;
    const saved = JSON.parse(raw);
    if(Array.isArray(saved.flow) && Array.isArray(saved.edges)){
      D.flow.splice(0,D.flow.length,...saved.flow);
      D.edges.splice(0,D.edges.length,...saved.edges);
    }
    Object.assign(state, saved.state||{});
  }catch{
    localStorage.removeItem(STATE_KEY);
  }
}
function saveState(label='saved'){
  state.dirty=false;
  state.lastSaved = label==='auto' ? 'auto-saved just now' : 'saved just now';
  localStorage.setItem(STATE_KEY, JSON.stringify({ flow:D.flow, edges:D.edges, state }));
  refreshConnectedViews();
}
function markDirty(reason='draft changed'){
  state.dirty=true;
  state.lastSaved=reason;
  localStorage.setItem(STATE_KEY, JSON.stringify({ flow:D.flow, edges:D.edges, state }));
  refreshConnectedViews();
}
function workflowSummary(){
  const types = D.flow.reduce((acc,n)=>{ acc[n.t]=(acc[n.t]||0)+1; return acc; },{});
  const harnessed = D.flow.filter(n => (n.meta||[]).some(m => /harness|policy|fallback|eval|audit|trace/i.test(m.t)) || n.t==='harness').length;
  return { nodes:D.flow.length, edges:D.edges.length, types, harnessed };
}
function validateWorkflow(){
  const s = workflowSummary();
  const ids = new Set(D.flow.map(n=>n.id));
  const brokenEdges = D.edges.filter(([a,b])=>!ids.has(a)||!ids.has(b)).length;
  const hasInput = !!s.types.input;
  const hasAgent = !!s.types.agent;
  const hasOutput = !!s.types.output;
  const hasPolicy = !!s.types.harness || D.flow.some(n=>/policy|gate/i.test(n.title));
  const issues = [];
  if(!hasInput) issues.push('missing input');
  if(!hasAgent) issues.push('missing agent');
  if(!hasOutput) issues.push('missing output');
  if(!hasPolicy) issues.push('missing safe-action policy');
  if(brokenEdges) issues.push(`${brokenEdges} broken link${brokenEdges===1?'':'s'}`);
  const ok = issues.length===0;
  state.lastValidation = { ok, issues, nodes:s.nodes, edges:s.edges, at:new Date().toISOString() };
  markDirty(ok ? 'validated just now' : 'validation needs review');
  return state.lastValidation;
}
function runReplay(){
  const v = validateWorkflow();
  state.evalRuns += 1;
  state.replayPass = v.ok ? Math.min(99, 88 + Math.min(11, D.edges.length)) : 72;
  saveState('auto');
  return state.replayPass;
}
function publishReadiness(){
  const v = state.lastValidation || validateWorkflow();
  const pass = state.replayPass >= 95;
  return { valid:v.ok, pass, replayPass:state.replayPass, issues:v.issues||[], canPublish:v.ok && pass };
}
function createWorkflowNode(source, pos={}){
  const t = source.t || source.type || 'tool';
  const maxX = D.flow.reduce((m,n)=>Math.max(m,n.x||0), 40);
  const id = `n-added-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
  const node = {
    id,
    t,
    icon:source.icon || t,
    title:source.name || source.title || 'New workflow step',
    type:source.kind || source.type || t.toUpperCase(),
    desc:source.desc || 'Connected from another OpenSkillTrace surface.',
    port:source.port || (source.perm ? `${source.perm} · ${source.domain||'shared'}` : 'configure in inspector'),
    meta:[{c:'fb',t:'harness on'},{c:'ev',t:`eval ${source.eval||'pending'}%`}],
    badge:'trace + policy',
    x:pos.x ?? maxX + 280,
    y:pos.y ?? 260,
  };
  D.flow.push(node);
  const from = D.flow.find(n=>n.id==='n-agent') || D.flow[D.flow.length-2];
  if(from && from.id!==id) D.edges.push([from.id,id]);
  state.catalogAdds += source.name ? 1 : 0;
  markDirty('canvas changed');
  return node;
}
function updateNode(id, patch){
  const n = D.flow.find(x=>x.id===id); if(!n) return null;
  Object.assign(n, patch);
  markDirty('node edited');
  return n;
}
function refreshView(id){
  const view = $('#v-'+id);
  if(!view || !VIEWS[id] || id==='studio') return;
  const v = VIEWS[id];
  view.innerHTML = v.flush ? `<div class="page flush">${v.render()}</div>` : `<div class="page">${v.render()}</div>`;
  if(id==='catalog') wireCatalog(view);
}
function refreshConnectedViews(){
  ['overview','catalog','providers','fallback','eval','governance'].forEach(refreshView);
  if(window.OSTStudio) window.OSTStudio.syncSummary?.();
}
window.OST = { state, seed, saveState, markDirty, workflowSummary, validateWorkflow, runReplay, publishReadiness, createWorkflowNode, updateNode, refreshConnectedViews };
loadState();

/* ---------- sidebar ---------- */
function renderNav(){
  const html = D.nav.map(g=>`<div class="navGroup"><div class="lbl">${g.group}</div><div class="nav">${
    g.items.map(it=>`<a data-view="${it.id}">${ic(it.icon,'ic')}<span class="ntxt">${it.label}</span>${
      it.count?`<span class="count">${it.count}</span>`:it.harness?`<span class="harnessDot" title="harness-aware"></span>`:''}</a>`).join('')
  }</div></div>`).join('');
  $('#navMount').innerHTML = html;
}

/* ---------- router ---------- */
let current = null;
function go(id){
  if(!VIEWS[id]) id='overview';
  const mount = $('#viewMount');
  let view = $('#v-'+id);
  let created=false;
  if(!view){
    created=true;
    view = document.createElement('div');
    view.className='view'; view.id='v-'+id;
    const v = VIEWS[id];
    view.innerHTML = v.flush ? `<div class="page flush">${v.render()}</div>` : `<div class="page">${v.render()}</div>`;
    mount.appendChild(view);
    if(id==='catalog') wireCatalog(view);
  }
  $$('.view',mount).forEach(v=>v.classList.toggle('active', v===view));
  $$('#navMount a').forEach(a=>a.classList.toggle('active', a.dataset.view===id));
  if(created && id==='studio') window.initStudio(view);   // boot after view is active (needs real sizes)
  $('#crumb').innerHTML = VIEWS[id].crumb.map((c,i,a)=>
    `<span class="${i===a.length-1?'':''}" ${i===a.length-1?'style="color:var(--ink);font-weight:640"':''}>${c}</span>${i<a.length-1?'<span class="sep">'+'/'+'</span>':''}`
  ).join('');
  current=id; localStorage.setItem('ost_view',id);
  if(location.hash.slice(1)!==id) history.replaceState(null,'','#'+id);
  view.scrollTop = 0;
}

/* ---------- studio helpers (used by studio.js engine) ---------- */
window.genericInspector = function(n){
  return `<div class="inspPurpose">${ic('info')}<div>Newly added <b>${n.type}</b> step. The harness applies trace, fallback, policy and audit by default — tune below.</div></div>
    <div class="inspNode"><div class="iIco bk-${n.t}">${ic(n.icon)}</div><div><b>${n.title}</b><span>${n.type} · unsaved</span></div><span class="pill warn" style="margin-left:auto">draft</span></div>
    <div class="inspSection"><div class="isHd" data-acc><span class="num">1</span> Step settings ${ic('chevd','chev')}</div><div class="isBody">
      <div class="field"><label>Step name</label><input class="input" data-node-id="${n.id}" data-node-field="title" value="${n.title}"></div>
      <div class="field"><label>Description</label><textarea class="textarea" data-node-id="${n.id}" data-node-field="desc">${n.desc||''}</textarea></div>
      <div class="field"><label>Runtime / capability</label><input class="input mono" data-node-id="${n.id}" data-node-field="port" value="${n.port||''}"></div>
    </div></div>
    <div class="inspSection harness"><div class="isHd" data-acc><span class="num">1</span> Harness controls ${ic('chevd','chev')}</div><div class="isBody">
      <div class="hmatrix"><span class="hk">${ic('trace')} Trace</span><span class="hv">on</span></div>
      <div class="hmatrix"><span class="hk">${ic('fallback')} Fallback</span><span class="hv">inherit route</span></div>
      <div class="hmatrix"><span class="hk">${ic('policy')} Policy gate</span><span class="hv">default pack</span></div>
      <div class="hmatrix"><span class="hk">${ic('file')} Audit</span><span class="hv">auto</span></div>
    </div></div>
    <div class="inspSection adv-only"><div class="isHd" data-acc><span class="num">3</span> Permission ${ic('chevd','chev')}</div><div class="isBody">
      <div class="field"><label>Permission</label><select class="select"><option>read-only (default)</option><option>write — requires approval</option></select></div>
    </div></div>`;
};

window.wireAccordions = function(root){
  $$('.isHd[data-acc]',root).forEach(h=>{ if(h._w) return; h._w=1;
    h.addEventListener('click',()=> h.closest('.inspSection').classList.toggle('collapsed')); });
};
window.OSTtoast = (m,k)=>toast(m,k);

/* ---------- catalog tab filter ---------- */
function wireCatalog(root){
  $$('[data-cattab]',root).forEach(t=>t.addEventListener('click',()=>{
    $$('[data-cattab]',root).forEach(x=>x.classList.remove('active')); t.classList.add('active');
    const k=t.dataset.cattab;
    $$('.catCard',root).forEach(c=> c.style.display = (k==='all'||c.dataset.cat===k)?'':'none');
  }));
}

/* ---------- modals ---------- */
const MODALS = {
  new:{ title:'New workflow', sub:'Start from a guided template or a blank canvas', body:()=>`
    <div class="explain" style="margin-bottom:14px">${ic('wand')}<div><b>Guided setup</b> walks non-technical users through input → agent → evidence → approval, applying the harness at each step.</div></div>
    <div class="grid g2" style="gap:11px">
      ${[['money','Monee Scam Response','Claim → evidence → approval → audit'],['graph','Mule Investigation','Graph → KYC → AML escalation'],['doc','Card Dispute Triage','Dispute → policy → ops approval'],['studio','Blank canvas','Start from scratch']]
        .map(t=>`<button class="card pad flat soft" data-pick style="text-align:left;border:1px solid var(--line);cursor:pointer;display:flex;gap:11px;align-items:flex-start">
          <div class="rico bk-input" style="width:34px;height:34px">${ic(t[0])}</div><div><b style="font-size:13px">${t[1]}</b><p style="font-size:11.5px;color:var(--muted);margin-top:3px">${t[2]}</p></div></button>`).join('')}
    </div>`, foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-go="studio" data-close>${ic('arrow')} Open in Studio</button>` },
  import:{ title:'Import workflow', sub:'Bring in flows from other platforms', body:()=>`
    <p style="font-size:13px;color:var(--muted);margin-bottom:14px">Map external nodes to OpenSkillTrace blocks, then we wrap every step with the harness automatically.</p>
    <div style="display:flex;flex-direction:column;gap:9px">
      ${[['Dify','Visual workflow / Chatflow export','D','#1c64f2'],['Lyzr','Agent Studio configuration','L','#7c3aed'],['Portkey','Gateway configs & routes','P','#0d9488'],['LangGraph','Graph definition (JSON)','G','#ea580c']]
        .map(p=>`<div class="row"><div class="rico" style="background:${p[3]}1a;color:${p[3]};font-weight:800">${p[2]}</div><div class="rmain"><b>${p[0]}</b><span>${p[1]}</span></div><div class="rend"><button class="btn sm" data-close>Connect</button></div></div>`).join('')}
    </div>`, foot:()=>`<button class="btn" data-close>Close</button>` },
  mcp:{ title:'Connect MCP server', sub:'Expose enterprise capabilities to agents', body:()=>`
    <div class="field"><label>Server URL</label><input class="input mono" placeholder="https://mcp.internal.monee.co/device-risk"></div>
    <div class="field"><label>Auth</label><select class="select"><option>OAuth 2.0 (recommended)</option><option>API key</option></select></div>
    <div class="field"><label>Default permission</label><select class="select"><option>read-only</option><option>write — requires approval</option></select></div>
    <div class="explain harness">${ic('lock')}<div>MCP tools default to <b>read-only</b>. Write actions require explicit permission and a human approval gate.</div></div>`,
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-close>${ic('mcp')} Connect & discover</button>` },
  publish:{ title:'Publish workflow', sub:'Production-safe publish checklist', body:()=>`
    ${(()=>{ const r=window.OST.publishReadiness(); return `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${[
        ['Validate graph', r.valid?'done':'warn', r.valid?'passed':r.issues.join(', ')],
        ['Validate tool permissions','done','read-only / approval-gated'],
        ['Run replay eval', r.pass?'done':'warn', `${r.replayPass}% ${r.pass?'passed':'— gate ≥95%'}`],
        ['Check approval policies','done','freeze/refund require human'],
        ['Check PII masking','done','customer/account refs masked']
      ].map(s=>`<div class="row" style="padding:11px 13px"><div class="rico ${s[1]==='done'?'bk-output':'bk-harness'}" style="width:30px;height:30px;border-radius:9px">${ic(s[1]==='done'?'check':'clock')}</div><div class="rmain"><b style="font-size:13px">${s[0]}</b><span>${s[2]}</span></div><span class="pill ${s[1]==='done'?'ok':'warn'}">${s[1]==='done'?'passed':'review'}</span></div>`).join('')}
    </div>
    <div class="explain harness" style="margin-top:13px">${ic(r.canPublish?'check':'alert')}<div>${r.canPublish?'<b>Ready to publish.</b> This workflow passed graph validation and replay gate.':'Publishing is blocked until validation is clean and replay pass rate is at least <b>95%</b>.'}</div></div>`; })()}`,
    foot:()=>{ const r=window.OST.publishReadiness(); return `<button class="btn" data-close>Cancel</button><button class="btn" data-go="eval" data-close>Open Eval & Replay</button><button class="btn primary" data-act="publish-workflow" data-close ${r.canPublish?'':'disabled style="opacity:.5"'}>${ic(r.canPublish?'upload':'lock')} Publish</button>` } },
  'provider-keys':{ title:'API keys & routing', sub:'Keys are encrypted at rest', body:()=>`
    <div class="field"><label>Provider</label><select class="select"><option>Anthropic</option><option>OpenAI</option><option>Zhipu (GLM)</option></select></div>
    <div class="field"><label>API key <span class="req">*</span></label><input class="input mono" type="password" value="sk-ant-••••••••••••••••3xQ2"></div>
    <div class="field"><label>Use in route position</label><select class="select"><option>Primary</option><option>Fallback #1</option><option>Fallback #2</option></select></div>
    <div class="kv"><span class="k">Status</span><span class="v" style="color:var(--ok)">verified ✓</span></div>`,
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-close>${ic('check')} Save key</button>` },
  'add-provider':{ title:'Add model provider', sub:'200+ providers supported', body:()=>`
    <div class="search" style="max-width:none;margin-bottom:12px">${ic('search')} Search providers…</div>
    <div class="grid g3" style="gap:9px">${D.providers.concat([{name:'Mistral',icon:'M',color:'#fb6a00'},{name:'Cohere',icon:'C',color:'#39594d'},{name:'Groq',icon:'G',color:'#f55036'}]).map(p=>`<button class="card pad flat soft" data-close style="border:1px solid var(--line);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;text-align:center"><div class="rico" style="background:${p.color}1a;color:${p.color};font-weight:800">${p.icon}</div><b style="font-size:12px">${p.name}</b></button>`).join('')}</div>`,
    foot:()=>`<button class="btn" data-close>Close</button>` },
  'add-route':{ title:'Create fallback policy', sub:'Composable like Portkey configs', body:()=>`
    <div class="field"><label>Policy type</label><select class="select"><option>Model fallback</option><option>Tool fallback</option><option>Skill fallback</option><option>Workflow fallback</option></select></div>
    <div class="field"><label>Trigger on</label><select class="select"><option>error · timeout · 429 rate-limit</option><option>guardrail violation</option><option>low confidence</option></select></div>
    <div class="field"><label>Route order</label><div class="route" style="margin-top:4px"><span class="hop primary"><span class="n">1</span>Primary</span>${ic('arrow','arr')}<span class="hop"><span class="n">2</span>+ add target</span></div></div>
    <div class="explain harness">${ic('branch')}<div>Workflow fallback can <b>block a risky action</b>, switch to evidence-only, or escalate to a human — not just retry a model.</div></div>`,
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn harness" data-close>${ic('check')} Save policy</button>` },
  'add-source':{ title:'Add knowledge source', sub:'Governed operational knowledge', body:()=>`
    <div class="field"><label>Source type</label><select class="select"><option>Confluence / SharePoint</option><option>S3 bucket</option><option>Google Drive</option><option>Warehouse table</option></select></div>
    <div class="field"><label>Location</label><input class="input mono" placeholder="confluence://fraud-ops/sop"></div>
    <div class="kv"><span class="k">${ic('mask')} PII redaction at index</span><span class="v" style="color:var(--harness-ink)">on</span></div>
    <div class="kv"><span class="k">${ic('layers')} Citation required</span><span class="v" style="color:var(--harness-ink)">on</span></div>`,
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-close>${ic('plus')} Add & index</button>` },
  'add-scenario':{ title:'Add replay scenario', sub:'Test failures before production', body:()=>`
    <div class="field"><label>Scenario name</label><input class="input" placeholder="e.g. Counterparty bank API 503"></div>
    <div class="field"><label>Inject failure</label><select class="select"><option>Tool timeout</option><option>Model unavailable</option><option>Stale RAG source</option><option>Low confidence</option><option>Policy violation</option></select></div>
    <div class="field"><label>Expected safe behavior</label><textarea class="textarea">Degrade to evidence-only; never freeze; escalate to senior analyst.</textarea></div>`,
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-close>${ic('plus')} Add scenario</button>` },
  audit:{ title:'Approval & audit packet', sub:'trace trc_892f1a · signed', body:()=>`
    <div class="card pad soft" style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div class="rico bk-output">${ic('approval')}</div><div><b>Freeze decision — ฿50,000 transfer</b><div style="font-size:11.5px;color:var(--muted)">confidence 76% · evidence-only recommended</div></div></div>
      ${[['Timeline','5 transfers to 3 mule accounts in 4 min'],['Risk class','Likely scam — QR mule split'],['Policy','PDPA ✓ · AML ✓ · refund not allowed'],['Recommended','Evidence-only packet + senior review'],['PII','customer_id, account_no masked']].map(r=>`<div class="kv"><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('')}</div>
    <div style="display:flex;gap:8px"><button class="btn" style="flex:1;justify-content:center" data-close>${ic('x')} Reject</button><button class="btn" style="flex:1;justify-content:center" data-close>${ic('arrow')} Escalate</button><button class="btn primary" style="flex:1;justify-content:center" data-close>${ic('check')} Approve</button></div>`,
    foot:()=>`<button class="btn" data-close>Close</button><button class="btn dark" data-close>${ic('download')} Export packet</button>` },
};
MODALS['publish-cat']=MODALS.publish; MODALS['ground-eval']=MODALS.audit;

function openModal(key){
  const m = MODALS[key]; if(!m) return;
  $('#modalBox').className='modal'+((key==='new'||key==='import'||key==='add-provider'||key==='audit')?' wide':'');
  $('#modalBox').innerHTML = `
    <div class="modalHd"><div><h3>${m.title}</h3><p>${m.sub||''}</p></div><button class="iconbtn x" data-close>${ic('x')}</button></div>
    <div class="modalBody">${m.body()}</div>
    ${m.foot?`<div class="modalFoot">${m.foot()}</div>`:''}`;
  $('#scrim').classList.add('open');
}
function closeModal(){ $('#scrim').classList.remove('open'); }

/* ---------- toast ---------- */
function toast(msg, kind='ok'){
  const t = document.createElement('div'); t.className='toast '+kind;
  t.innerHTML = `${ic(kind==='harness'?'layers':kind==='info'?'info':'checkc')}<span>${msg}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .3s,transform .3s'; t.style.opacity='0'; t.style.transform='translateY(10px)'; setTimeout(()=>t.remove(),320); }, 2600);
}

/* ---------- global events ---------- */
document.addEventListener('click',e=>{
  const nav = e.target.closest('[data-view]'); if(nav){ go(nav.dataset.view); return; }
  const goto = e.target.closest('[data-goto]'); if(goto){ go(goto.dataset.goto); return; }
  const md = e.target.closest('[data-modal]'); if(md){ openModal(md.dataset.modal); return; }
  if(e.target.closest('[data-close]')) closeModal();
  const dgo = e.target.closest('[data-go]'); if(dgo){ go(dgo.dataset.go); }
  const act = e.target.closest('[data-act]'); if(act){ handleAct(act.dataset.act, act); }
  if(e.target.id==='scrim') closeModal();
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });
document.addEventListener('input',e=>{
  const field = e.target.closest('[data-node-field]');
  if(!field) return;
  const n = window.OST.updateNode(field.dataset.nodeId, {[field.dataset.nodeField]:field.value});
  if(field.dataset.nodeField==='title'){
    const lbl = document.querySelector('#inspSel'); if(lbl) lbl.textContent = field.value;
    const nodeTitle = document.querySelector('.inspNode b'); if(nodeTitle) nodeTitle.textContent = field.value;
  }
  if(window.OSTStudio && n) window.OSTStudio.updateNodeEl?.(n.id);
});
window.addEventListener('hashchange',()=>{
  const id = location.hash.slice(1);
  if(id && id!==current) go(id);
});

function catalogFromButton(btn){
  const card = btn.closest('.catCard');
  if(!card) return null;
  return D.catalog.find(c => c.name === card.dataset.name) || null;
}
function handleAct(a, el){
  if(a==='save-workflow'){
    window.OST.saveState();
    toast(`Workflow saved · ${window.OST.workflowSummary().nodes} nodes linked`,'ok');
    return;
  }
  if(a==='validate'){
    const v = window.OST.validateWorkflow();
    toast(v.ok ? `Workflow valid · ${v.nodes} steps · ${v.edges} links` : `Validation needs review · ${v.issues.join(', ')}`, v.ok?'ok':'harness');
    return;
  }
  if(a==='replay'){
    const pass = window.OST.runReplay();
    toast(`Harness replay complete · ${pass}% pass rate`,'harness');
    refreshView('eval');
    return;
  }
  if(a==='catalog-action'){
    const c = catalogFromButton(el);
    const n = c ? (window.OSTStudio?.addCatalogItem?.(c) || window.OST.createWorkflowNode(c)) : null;
    toast(n ? `Added “${n.title}” to Studio · linked to workflow` : 'Added to canvas · harness applied','harness');
    if(current!=='studio') setTimeout(()=>go('studio'), 400);
    return;
  }
  if(a==='publish-workflow'){
    window.OST.state.published=true; window.OST.saveState('auto');
    toast('Workflow published · audit packet generated','ok');
    return;
  }
  if(a==='export-audit'){
    window.OST.state.auditPackets += 1; window.OST.saveState('auto');
    toast(`Audit packet exported · ${window.OST.workflowSummary().nodes} nodes included`,'ok');
    return;
  }
  const map={ 'ground-eval':['Grounding eval queued','ok'] };
  const m = map[a]; if(m) toast(m[0],m[1]);
}

/* ---------- shell + mode ---------- */
function wireShell(){
  $$('.shellSwitch button').forEach(b=>b.addEventListener('click',()=>{
    document.body.dataset.shell=b.dataset.shell;
    $$('.shellSwitch button').forEach(x=>x.classList.toggle('active',x===b));
    localStorage.setItem('ost_shell',b.dataset.shell);
  }));
  $('#modeSwitch').addEventListener('click',()=>{
    const next = document.body.dataset.mode==='advanced'?'simple':'advanced';
    document.body.dataset.mode=next; localStorage.setItem('ost_mode',next);
    $('#modeLabel').textContent = next==='advanced'?'Advanced':'Simple';
  });
}

/* ---------- init ---------- */
function init(){
  renderNav(); wireShell();
  const shell = localStorage.getItem('ost_shell')||'clarity';
  document.body.dataset.shell = shell;
  $$('.shellSwitch button').forEach(x=>x.classList.toggle('active',x.dataset.shell===shell));
  const mode = localStorage.getItem('ost_mode')||'simple';
  document.body.dataset.mode = mode; $('#modeLabel').textContent = mode==='advanced'?'Advanced':'Simple';
  go(location.hash.slice(1)||localStorage.getItem('ost_view')||'overview');
}
init();
})();
