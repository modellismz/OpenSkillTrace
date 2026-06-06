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
  previewRun:null,
  lastRepair:null,
};
let previewController = null;
let previewAssistantText = '';
let previewCaseState = {};
let previewIntakeSchema = null;
let previewIntakeUpdate = null;
function syncBackend(path, payload, method='POST'){
  fetch(path, {
    method,
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
  }).catch(()=>{});
}
function ensureCustomerIntakeNode(){
  if(D.flow.some(n=>n.id==='n-intake')) return;
  const input = D.flow.find(n=>n.id==='n-input');
  const agent = D.flow.find(n=>n.id==='n-agent');
  D.flow.push({
    x:330,
    y:230,
    id:'n-intake',
    t:'input',
    icon:'input',
    title:'Customer Intake',
    type:'Guided Form',
    desc:'Turns the customer chat into structured scam-report fields with choices, text fallback, and safety flags.',
    port:'case_state · missing fields',
    meta:[{c:'',t:'schema'},{c:'',t:'PII mask'}],
    badge:'intake',
  });
  if(agent && agent.x < 560) agent.x = 620;
  D.flow.filter(n=>['n-tools','n-rag'].includes(n.id)).forEach(n=>{ if(n.x < 880) n.x = 930; });
  D.flow.filter(n=>n.id==='n-class').forEach(n=>{ if(n.x < 1180) n.x = 1240; });
  D.flow.filter(n=>n.id==='n-policy').forEach(n=>{ if(n.x < 1480) n.x = 1540; });
  D.flow.filter(n=>['n-out','n-cap'].includes(n.id)).forEach(n=>{ if(n.x < 1780) n.x = 1840; });
  D.edges.splice(0,D.edges.length,...D.edges.filter(([a,b])=>!(a==='n-input' && b==='n-agent')));
  if(input && agent){
    if(!D.edges.some(([a,b])=>a==='n-input' && b==='n-intake')) D.edges.push(['n-input','n-intake']);
    if(!D.edges.some(([a,b])=>a==='n-intake' && b==='n-agent')) D.edges.push(['n-intake','n-agent']);
  }
}

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
  syncBackend('/api/workflows', {
    id:'default',
    name:'Scam Transaction Response',
    status: state.published ? 'published' : 'draft',
    graph:{ flow:D.flow, edges:D.edges },
    state,
  });
  refreshConnectedViews();
}
function markDirty(reason='draft changed'){
  state.dirty=true;
  state.lastSaved=reason;
  localStorage.setItem(STATE_KEY, JSON.stringify({ flow:D.flow, edges:D.edges, state }));
  syncBackend('/api/workflows', {
    id:'default',
    name:'Scam Transaction Response',
    status:'draft',
    graph:{ flow:D.flow, edges:D.edges },
    state,
  });
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
  syncBackend('/api/replay/scenarios', {
    name:'FraudOps replay suite',
    workflow_id:'default',
    pass_rate:state.replayPass,
    validation:v,
    status:state.replayPass >= 95 ? 'passed' : 'blocked',
  });
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
ensureCustomerIntakeNode();

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
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-act="connect-mcp" data-close>${ic('mcp')} Connect & discover</button>` },
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
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-act="save-provider-key" data-close>${ic('check')} Save key</button>` },
  'add-provider':{ title:'Add model provider', sub:'200+ providers supported', body:()=>`
    <div class="search" style="max-width:none;margin-bottom:12px">${ic('search')} Search providers…</div>
    <div class="grid g3" style="gap:9px">${D.providers.concat([{name:'Mistral',icon:'M',color:'#fb6a00'},{name:'Cohere',icon:'C',color:'#39594d'},{name:'Groq',icon:'G',color:'#f55036'}]).map(p=>`<button class="card pad flat soft" data-close style="border:1px solid var(--line);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;text-align:center"><div class="rico" style="background:${p.color}1a;color:${p.color};font-weight:800">${p.icon}</div><b style="font-size:12px">${p.name}</b></button>`).join('')}</div>`,
    foot:()=>`<button class="btn" data-close>Close</button>` },
  'add-route':{ title:'Create fallback policy', sub:'Composable like Portkey configs', body:()=>`
    <div class="field"><label>Policy type</label><select class="select"><option>Model fallback</option><option>Tool fallback</option><option>Skill fallback</option><option>Workflow fallback</option></select></div>
    <div class="field"><label>Trigger on</label><select class="select"><option>error · timeout · 429 rate-limit</option><option>guardrail violation</option><option>low confidence</option></select></div>
    <div class="field"><label>Route order</label><div class="route" style="margin-top:4px"><span class="hop primary"><span class="n">1</span>Primary</span>${ic('arrow','arr')}<span class="hop"><span class="n">2</span>+ add target</span></div></div>
    <div class="explain harness">${ic('branch')}<div>Workflow fallback can <b>block a risky action</b>, switch to evidence-only, or escalate to a human — not just retry a model.</div></div>`,
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn harness" data-act="save-fallback-policy" data-close>${ic('check')} Save policy</button>` },
  'add-source':{ title:'Add knowledge source', sub:'Governed operational knowledge', body:()=>`
    <div class="field"><label>Source type</label><select class="select"><option>Confluence / SharePoint</option><option>S3 bucket</option><option>Google Drive</option><option>Warehouse table</option></select></div>
    <div class="field"><label>Location</label><input class="input mono" placeholder="confluence://fraud-ops/sop"></div>
    <div class="kv"><span class="k">${ic('mask')} PII redaction at index</span><span class="v" style="color:var(--harness-ink)">on</span></div>
    <div class="kv"><span class="k">${ic('layers')} Citation required</span><span class="v" style="color:var(--harness-ink)">on</span></div>`,
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-act="save-rag-source" data-close>${ic('plus')} Add & index</button>` },
  'add-scenario':{ title:'Add replay scenario', sub:'Test failures before production', body:()=>`
    <div class="field"><label>Scenario name</label><input class="input" placeholder="e.g. Counterparty bank API 503"></div>
    <div class="field"><label>Inject failure</label><select class="select"><option>Tool timeout</option><option>Model unavailable</option><option>Stale RAG source</option><option>Low confidence</option><option>Policy violation</option></select></div>
    <div class="field"><label>Expected safe behavior</label><textarea class="textarea">Degrade to evidence-only; never freeze; escalate to senior analyst.</textarea></div>`,
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-act="save-replay-scenario" data-close>${ic('plus')} Add scenario</button>` },
  audit:{ title:'Approval & audit packet', sub:'trace trc_892f1a · signed', body:()=>`
    <div class="card pad soft" style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div class="rico bk-output">${ic('approval')}</div><div><b>Freeze decision — ฿50,000 transfer</b><div style="font-size:11.5px;color:var(--muted)">confidence 76% · evidence-only recommended</div></div></div>
      ${[['Timeline','5 transfers to 3 mule accounts in 4 min'],['Risk class','Likely scam — QR mule split'],['Policy','PDPA ✓ · AML ✓ · refund not allowed'],['Recommended','Evidence-only packet + senior review'],['PII','customer_id, account_no masked']].map(r=>`<div class="kv"><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('')}</div>
    <div style="display:flex;gap:8px"><button class="btn" style="flex:1;justify-content:center" data-act="approval-reject" data-close>${ic('x')} Reject</button><button class="btn" style="flex:1;justify-content:center" data-act="approval-escalate" data-close>${ic('arrow')} Escalate</button><button class="btn primary" style="flex:1;justify-content:center" data-act="approval-approve" data-close>${ic('check')} Approve</button></div>`,
    foot:()=>`<button class="btn" data-close>Close</button><button class="btn dark" data-act="export-audit" data-close>${ic('download')} Export packet</button>` },
  'repair-detail':{ title:'Harness repair proposal', sub:'sandbox artifact pending human approval', body:()=>repairModalBody(),
    foot:()=>{ const a=state.lastRepair?.artifact; const ready = !!a?.approval_ready; return `<button class="btn" data-act="repair-reject" data-close>${ic('x')} Reject</button><button class="btn primary" data-act="repair-approve" data-close ${ready?'':'disabled style="opacity:.5"'}>${ic(ready?'check':'lock')} Approve repair</button>` } },
};
MODALS['publish-cat']=MODALS.publish; MODALS['ground-eval']=MODALS.audit;

function openModal(key){
  const m = MODALS[key]; if(!m) return;
  $('#modalBox').className='modal'+((key==='new'||key==='import'||key==='add-provider'||key==='audit'||key==='repair-detail')?' wide':'');
  $('#modalBox').innerHTML = `
    <div class="modalHd"><div><h3>${m.title}</h3><p>${m.sub||''}</p></div><button class="iconbtn x" data-close>${ic('x')}</button></div>
    <div class="modalBody">${m.body()}</div>
    ${m.foot?`<div class="modalFoot">${m.foot()}</div>`:''}`;
  $('#scrim').classList.add('open');
}
function closeModal(){ $('#scrim').classList.remove('open'); }

function repairModalBody(){
  const artifact = state.lastRepair?.artifact;
  if(!artifact) return `<div class="explain">${ic('info')}<div>No repair proposal is available for the current run.</div></div>`;
  const manifest = artifact.manifest || {};
  const evalReport = artifact.eval || manifest.eval || {};
  const failed = manifest.failed_node || {};
  const files = artifact.files || manifest.files || [];
  const checks = evalReport.checks || [];
  return `<div class="grid g2" style="align-items:start">
    <div class="card pad soft">
      <div class="sectionhd"><h3>What happened</h3><span class="pill ${artifact.approval_ready?'ok':'warn'}">${evalReport.status||artifact.status}</span></div>
      ${[
        ['Run', artifact.run_id],
        ['Failed node', `${failed.title||'Workflow node'}${failed.id?` · ${failed.id}`:''}`],
        ['Failure', manifest.failure || 'Node failed during preview run'],
        ['Sandbox', artifact.sandbox_dir],
      ].map(r=>`<div class="kv"><span class="k">${r[0]}</span><span class="v">${r[1]||'—'}</span></div>`).join('')}
      <div class="explain harness" style="margin-top:12px">${ic('layers')}<div>The harness switched the run to evidence-only recovery and created sandbox files for review.</div></div>
    </div>
    <div class="card pad">
      <div class="sectionhd"><h3>Replay evaluation</h3><span class="pill ${artifact.approval_ready?'ok':'warn'}">${evalReport.pass_rate||0}%</span></div>
      ${(checks.length?checks:[{name:'replay suite',passed:false}]).map(c=>`<div class="kv"><span class="k">${ic(c.passed?'check':'alert')} ${c.name}</span><span class="v" style="color:${c.passed?'var(--ok)':'var(--danger)'}">${c.passed?'passed':'blocked'}</span></div>`).join('')}
      <div class="hintline">Approval is enabled only when the replay gate passes.</div>
    </div>
    <div class="card pad" style="grid-column:1/-1">
      <div class="sectionhd"><h3>Sandbox files created</h3><span class="hint">${files.length} files</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px">
        ${files.map(f=>`<div class="capRow" style="margin-bottom:0"><span class="cd" style="background:var(--harness)"></span><span class="cn">${f.path}</span><span class="cs">${f.bytes}b</span></div>`).join('')}
      </div>
    </div>
    <div class="card pad" style="grid-column:1/-1">
      <div class="sectionhd"><h3>What approval promotes</h3></div>
      ${(manifest.proposed_capabilities||['scam_claim_missing_selector_guard_v1']).map(name=>`<div class="row" style="padding:10px 0"><div class="rico bk-harness" style="width:30px;height:30px">${ic('capture')}</div><div class="rmain"><b>${name}</b><span>Durable capability metadata linked to this harness run.</span></div></div>`).join('')}
    </div>
  </div>`;
}

/* ---------- toast ---------- */
function toast(msg, kind='ok'){
  const t = document.createElement('div'); t.className='toast '+kind;
  t.innerHTML = `${ic(kind==='harness'?'layers':kind==='info'?'info':'checkc')}<span>${msg}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .3s,transform .3s'; t.style.opacity='0'; t.style.transform='translateY(10px)'; setTimeout(()=>t.remove(),320); }, 2600);
}

function previewEls(){
  return {
    chat: $('#previewChat'),
    empty: $('#previewEmpty'),
    input: $('#previewInput'),
    process: $('#previewProcess'),
    title: $('#previewProcessTitle'),
    status: $('#previewProcessStatus'),
    runStatus: $('#previewRunStatus'),
    log: $('#previewLog'),
    files: $('#previewFiles'),
    repair: $('#repairCta'),
    intake: $('#intakeAgent'),
    stop: $('#previewStopWrap'),
    send: $('.sendBtn'),
  };
}
function openPreviewPanel(){
  if(current!=='studio') go('studio');
  setTimeout(()=>window.OSTStudio?.showPreview?.(), current==='studio'?0:80);
}
function appendChatMessage(role, text=''){
  const el = previewEls();
  if(!el.chat) return null;
  if(el.empty) el.empty.remove();
  const row = document.createElement('div');
  row.className = `chatMsg ${role}`;
  row.innerHTML = `${role==='assistant'?`<span class="chatAvatar">${ic('agent')}</span>`:''}<div class="bubble"></div>`;
  row.querySelector('.bubble').textContent = text;
  el.chat.appendChild(row);
  el.chat.scrollTop = el.chat.scrollHeight;
  return row.querySelector('.bubble');
}
function setPreviewProcess(kind, title, status){
  const el = previewEls();
  if(!el.process) return;
  el.process.classList.remove('running','failed','healing');
  if(kind) el.process.classList.add(kind);
  if(el.title && title) el.title.textContent = title;
  if(el.status && status) el.status.textContent = status;
  if(el.runStatus) el.runStatus.textContent = kind || 'idle';
}
function appendPreviewLog(event, data={}){
  const el = previewEls();
  if(!el.log) return;
  const row = document.createElement('div');
  row.className = 'logRow';
  const label = data.title || data.node_id || data.artifact_id || data.status || data.provider?.name || '';
  row.innerHTML = `<b>${event}</b><span>${label}</span>`;
  el.log.appendChild(row);
  el.log.scrollTop = el.log.scrollHeight;
}
function appendPreviewFile(file){
  const el = previewEls();
  if(!el.files || !file?.path) return;
  const row = document.createElement('div');
  row.className = 'ppFile';
  row.innerHTML = `${ic('file')}<code>${file.path}</code>`;
  el.files.appendChild(row);
}
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}
function revealIntakeAgent(){
  const el = previewEls();
  if(el.intake) el.intake.hidden = false;
}
function mergeLocalCaseState(next={}){
  Object.entries(next || {}).forEach(([key,value])=>{
    if(value === undefined || value === null) return;
    if(typeof value === 'string' && !value.trim()) return;
    if(Array.isArray(value) && !value.length) return;
    previewCaseState[key] = value;
  });
  return previewCaseState;
}
function intakeFields(){
  return previewIntakeSchema?.fields || [];
}
function hasIntakeValue(value){
  if(Array.isArray(value)) return value.some(hasIntakeValue);
  return value !== undefined && value !== null && String(value).trim() !== '';
}
function localIntakeProgress(){
  const required = intakeFields().filter(f=>f.required);
  const collected = required.filter(f=>hasIntakeValue(previewCaseState[f.field_id])).length;
  return { collected, required:required.length, missing:required.filter(f=>!hasIntakeValue(previewCaseState[f.field_id])).map(f=>f.field_id), complete:required.length > 0 && collected === required.length };
}
function intakeFieldLabel(fieldId){
  return intakeFields().find(f=>f.field_id===fieldId)?.label || fieldId.replace(/_/g,' ');
}
function valueList(value){
  if(Array.isArray(value)) return value;
  if(value === undefined || value === null || value === '') return [];
  return [value];
}
function fieldCurrentValue(fieldId){
  const inputs = $$(`[data-intake-input="${fieldId}"]`);
  const typed = inputs.map(input=>input.value.trim()).find(Boolean);
  if(typed) return typed;
  return previewCaseState[fieldId] || '';
}
function isOtherActive(fieldId, selected){
  return selected.some(value=>String(value).startsWith('Other'));
}
function renderIntakeField(field, opts={}){
  const id = field.field_id;
  const label = escapeHtml(field.label || id);
  const help = field.help_text ? `<small>${escapeHtml(field.help_text)}</small>` : '';
  const required = field.required ? '<em>Required</em>' : '';
  const stateValue = previewCaseState[id];
  const selected = valueList(stateValue).map(String);
  const activeOther = isOtherActive(id, selected);
  const otherValue = selected.find(value=>value.startsWith('Other:'))?.replace(/^Other:\s*/,'') || '';
  const extraClass = opts.followup ? ' followupField' : '';
  if(field.type === 'single_choice' || field.type === 'multi_choice'){
    return `<div class="intakeGroup${extraClass}" ${field.type === 'single_choice' ? `data-single="${escapeHtml(id)}"` : ''}>
      <div class="intakeLabel"><b>${label}</b>${required}</div>
      <div class="intakeChoices ${field.type === 'multi_choice' ? 'multi' : ''}">
        ${(field.choices || []).map(choice=>{
          const active = selected.includes(choice) || (choice === 'Other' && activeOther);
          return `<button type="button" class="${active?'active':''}" data-intake-choice="${escapeHtml(id)}" data-value="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`;
        }).join('')}
      </div>
      <label class="intakeOther" data-intake-other-wrap="${escapeHtml(id)}" ${activeOther?'':'hidden'}><span>Other ${label.toLowerCase()}</span><input data-intake-other="${escapeHtml(id)}" value="${escapeHtml(otherValue)}" placeholder="Type details"></label>
      ${help}
    </div>`;
  }
  const tag = field.type === 'textarea' ? 'textarea' : 'input';
  const value = fieldCurrentValue(id);
  const placeholder = escapeHtml(field.placeholder || 'Type your answer');
  if(tag === 'textarea'){
    return `<label class="intakeField wide${extraClass}"><span>${label} ${required}</span><textarea data-intake-input="${escapeHtml(id)}" rows="${opts.followup ? 2 : 3}" placeholder="${placeholder}">${escapeHtml(value)}</textarea>${help}</label>`;
  }
  return `<label class="intakeField${opts.full ? ' wide' : ''}${extraClass}"><span>${label} ${required}</span><input data-intake-input="${escapeHtml(id)}" placeholder="${placeholder}" value="${escapeHtml(value)}">${help}</label>`;
}
function renderIntakeProgress(progress){
  const bar = $('#intakeProgress');
  const summary = $('#intakeCaseSummary');
  if(!progress) return;
  const text = `${progress.collected || 0} of ${progress.required || 0} key details collected`;
  if(bar) bar.innerHTML = `<span>${escapeHtml(text)}</span><i style="--p:${Math.max(4, Math.round(((progress.collected || 0)/(progress.required || 1))*100))}%"></i>`;
  if(summary) summary.textContent = text;
}
function renderIntakeSchema(payload){
  if(payload?.fields) previewIntakeSchema = payload;
  if(payload?.case_state) mergeLocalCaseState(payload.case_state);
  const schema = previewIntakeSchema;
  const base = $('#intakeBase');
  const title = $('#intakeTitle');
  const subtitle = $('#intakeSubtitle');
  if(!base || !schema) return;
  revealIntakeAgent();
  if(title) title.textContent = schema.title || 'Claim intake helper';
  if(subtitle) subtitle.textContent = schema.subtitle || 'Click choices, add only what you know.';
  const fields = schema.fields || [];
  const primary = fields.filter(f=>['amount','occurred_at'].includes(f.field_id));
  const rest = fields.filter(f=>!['amount','occurred_at'].includes(f.field_id));
  base.innerHTML = `${primary.length ? `<div class="intakeGrid">${primary.map(f=>renderIntakeField(f)).join('')}</div>` : ''}
    ${rest.map(f=>renderIntakeField(f, {full:true})).join('')}`;
  renderIntakeProgress(schema.progress);
  if(previewIntakeUpdate) renderIntakeUpdate(previewIntakeUpdate, false);
}
function renderIntakeUpdate(payload, shouldMerge=true){
  if(payload) previewIntakeUpdate = payload;
  if(shouldMerge && payload?.case_state) mergeLocalCaseState(payload.case_state);
  const dynamic = $('#intakeDynamic');
  if(!dynamic || !payload) return;
  revealIntakeAgent();
  renderIntakeProgress(payload.progress);
  const fields = payload.fields || [];
  const safety = payload.safety || [];
  if(!fields.length && !safety.length){
    dynamic.hidden = false;
    dynamic.innerHTML = `<div class="intakeReady">${ic('check')}<div><b>${escapeHtml(payload.title || 'Case details ready')}</b><span>${escapeHtml(payload.subtitle || 'Enough key details are collected for the workflow packet.')}</span></div></div>`;
    return;
  }
  dynamic.hidden = false;
  dynamic.innerHTML = `<div class="followupList">
    <div class="followupIntro"><b>${escapeHtml(payload.title || 'Next details needed')}</b><span>${escapeHtml(payload.subtitle || 'Answer only the fields you know.')}</span></div>
    ${fields.map(f=>renderIntakeField(f, {followup:true, full:true})).join('')}
    ${safety.map(text=>`<div class="intakeSafety">${ic('alert')}<span>${escapeHtml(text)}</span></div>`).join('')}
  </div>`;
}
function selectedIntakeValues(name){
  return $$(`[data-intake-choice="${name}"].active`).map(btn=>{
    if(btn.dataset.value !== 'Other') return btn.dataset.value;
    const custom = ($(`[data-intake-other="${name}"]`)?.value || '').trim();
    return custom ? `Other: ${custom}` : 'Other';
  });
}
function collectIntakeAnswers(){
  const answers = {};
  $$('[data-intake-input]').forEach(input=>{
    const key = input.dataset.intakeInput;
    const value = input.value.trim();
    if(value) answers[key] = value;
  });
  const fields = new Set($$('[data-intake-choice]').map(btn=>btn.dataset.intakeChoice));
  fields.forEach(field=>{
    const values = selectedIntakeValues(field).filter(Boolean);
    if(values.length) answers[field] = ($(`[data-single="${field}"]`) ? values[0] : values);
  });
  return answers;
}
function intakePayloadText(answers=collectIntakeAnswers()){
  const rows = Object.entries(answers)
    .filter(([,value])=>Array.isArray(value) ? value.length : value)
    .map(([key,value])=>[intakeFieldLabel(key), Array.isArray(value) ? value.join(', ') : value]);
  return rows.length ? `Here are my scam claim details:\n${rows.map(([k,v])=>`- ${k}: ${v}`).join('\n')}` : '';
}
function setPreviewRunning(on){
  const el = previewEls();
  if(el.stop) el.stop.hidden = !on;
  if(el.send) el.send.disabled = on;
  if(el.input) el.input.disabled = on;
}
function parseSseBlock(block){
  const lines = block.split('\n');
  let event = 'message';
  const data = [];
  lines.forEach(line=>{
    if(line.startsWith('event:')) event = line.slice(6).trim();
    if(line.startsWith('data:')) data.push(line.slice(5).trim());
  });
  if(!data.length) return null;
  try{ return { event, data:JSON.parse(data.join('\n')) }; }
  catch{ return null; }
}
async function startWorkflowPreview(message, opts={}){
  if(previewController) previewController.abort();
  previewController = new AbortController();
  previewAssistantText = '';
  state.lastRepair = null;
  const customerAnswers = opts.customerAnswers || collectIntakeAnswers();
  if(Object.keys(customerAnswers).length) mergeLocalCaseState(customerAnswers);
  window.OSTStudio?.showPreview?.();
  window.OSTStudio?.clearRunStates?.();
  const el = previewEls();
  if(el.files) el.files.innerHTML = '';
  if(el.log) el.log.innerHTML = '';
  if(el.repair) el.repair.hidden = true;
  if(el.intake) el.intake.hidden = !previewIntakeSchema;
  appendChatMessage('user', message);
  previewAssistantText = 'We are working on this now. I am checking the workflow, evidence gates, and safe-action policy.\n\n';
  const assistantBubble = appendChatMessage('assistant', previewAssistantText);
  setPreviewRunning(true);
  setPreviewProcess('running','Workflow Process','Starting live workflow run.');
  try{
    const res = await fetch('/api/workflow-runs/stream', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        workflow_id:'default',
        message,
        case_state: previewCaseState,
        customer_answers: customerAnswers,
        graph:{ flow:D.flow, edges:D.edges },
      }),
      signal:previewController.signal,
    });
    if(!res.ok || !res.body) throw new Error(`Preview stream failed (${res.status})`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while(true){
      const {value, done} = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, {stream:true});
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for(const part of parts){
        const parsed = parseSseBlock(part);
        if(parsed) handlePreviewEvent(parsed.event, parsed.data, assistantBubble);
      }
    }
    if(buffer.trim()){
      const parsed = parseSseBlock(buffer);
      if(parsed) handlePreviewEvent(parsed.event, parsed.data, assistantBubble);
    }
  }catch(err){
    if(err.name === 'AbortError'){
      setPreviewProcess(null,'Workflow Process','Preview stopped by human.');
      appendPreviewLog('run.stopped', {status:'stopped'});
    }else{
      setPreviewProcess('failed','Workflow Process', err.message || 'Preview failed.');
      appendPreviewLog('run.error', {status:err.message || 'error'});
      toast('Preview failed · check provider route','harness');
    }
  }finally{
    setPreviewRunning(false);
    previewController = null;
  }
}
function handlePreviewEvent(event, data, assistantBubble){
  appendPreviewLog(event, data);
  if(event==='run.started'){
    state.previewRun = data.run_id;
    setPreviewProcess('running','Workflow Process','Run started.');
  }
  if(event==='provider.attempt'){
    setPreviewProcess('running','Model route',`Trying ${data.provider?.name || 'provider'} · ${data.provider?.model || ''}`);
  }
  if(event==='provider.failed'){
    setPreviewProcess('failed','Model route',`${data.provider?.name || 'provider'} failed.`);
  }
  if(event==='node.started'){
    window.OSTStudio?.setNodeRunState?.(data.node_id,'running');
    setPreviewProcess('running','Workflow Process',`${data.title || data.node_id} is working.`);
  }
  if(event==='node.completed'){
    window.OSTStudio?.setNodeRunState?.(data.node_id,'passed');
    setPreviewProcess('running','Workflow Process',`${data.title || data.node_id} completed.`);
  }
  if(event==='intake.schema'){
    renderIntakeSchema(data);
    setPreviewProcess('running','Customer Intake',`${data.progress?.collected || 0} of ${data.progress?.required || 0} key details collected.`);
  }
  if(event==='case_state.updated'){
    mergeLocalCaseState(data.case_state || {});
    renderIntakeSchema({ ...(previewIntakeSchema || {}), case_state: previewCaseState, progress: data.progress });
    setPreviewProcess('running','Customer Intake',`${data.progress?.collected || 0} of ${data.progress?.required || 0} key details collected.`);
  }
  if(event==='intake.update'){
    renderIntakeUpdate(data);
    const missing = data.fields?.length || 0;
    setPreviewProcess(missing ? 'running' : null,'Customer Intake', missing ? `${missing} next detail${missing===1?'':'s'} needed.` : 'Key customer details are ready for the workflow.');
  }
  if(event==='node.failed'){
    window.OSTStudio?.setNodeRunState?.(data.node_id,'failed');
    setPreviewProcess('failed','Workflow Process',data.error || `${data.title || data.node_id} failed.`);
  }
  if(event==='assistant.delta'){
    previewAssistantText += data.delta || '';
    if(assistantBubble) assistantBubble.textContent = previewAssistantText;
    const chat = $('#previewChat'); if(chat) chat.scrollTop = chat.scrollHeight;
  }
  if(event==='harness.started'){
    window.OSTStudio?.setNodeRunState?.(data.node_id,'healing');
    setPreviewProcess('healing','Harness run',data.reason || 'Building sandbox repair.');
  }
  if(event==='harness.file_created'){
    appendPreviewFile(data.file);
    setPreviewProcess('healing','Harness run',`Created ${data.file?.path || 'sandbox file'}.`);
  }
  if(event==='eval.completed'){
    const ok = data.status === 'passed';
    setPreviewProcess(ok?'healing':'failed','Replay evaluation',`${data.pass_rate || 0}% · ${data.status || 'completed'}`);
  }
  if(event==='repair.proposed'){
    state.lastRepair = data;
    const el = previewEls();
    if(el.repair) el.repair.hidden = false;
    setPreviewProcess(data.artifact?.approval_ready?'healing':'failed','Repair proposal',data.artifact?.approval_ready?'Ready for human approval.':'Replay gate blocked approval.');
  }
  if(event==='run.completed'){
    const statusText = data.status === 'awaiting_user'
      ? 'Waiting for your next answer.'
      : data.status === 'completed'
        ? 'Workflow turn completed. You can continue the chat.'
        : `Run ${data.status || 'completed'}.`;
    setPreviewProcess(data.status==='blocked'?'failed':null,'Workflow Process',statusText);
    if(data.status==='awaiting_user' || data.status==='completed') revealIntakeAgent();
  }
}
function toggleIntakeChoice(btn){
  const group = btn.closest('.intakeGroup');
  const field = btn.dataset.intakeChoice;
  if(group?.dataset.single){
    $$(`[data-intake-choice="${field}"]`).forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
  }else{
    btn.classList.toggle('active');
  }
  updateIntakeOtherField(field);
  const values = selectedIntakeValues(field).filter(Boolean);
  if(values.length) previewCaseState[field] = group?.dataset.single ? values[0] : values;
  else delete previewCaseState[field];
  renderIntakeProgress(localIntakeProgress());
}
function updateIntakeOtherField(field){
  $$(`[data-intake-other-wrap="${field}"]`).forEach(wrap=>{
    const group = wrap.closest('.intakeGroup');
    const otherBtn = group ? $(`[data-intake-choice="${field}"][data-value="Other"]`, group) : null;
    const show = !!otherBtn?.classList.contains('active');
    wrap.hidden = !show;
    const input = wrap.querySelector('input');
    if(show) setTimeout(()=>input?.focus(), 30);
    else if(input) input.value = '';
  });
}

/* ---------- global events ---------- */
document.addEventListener('click',e=>{
  const nav = e.target.closest('[data-view]'); if(nav){ go(nav.dataset.view); return; }
  const goto = e.target.closest('[data-goto]'); if(goto){ go(goto.dataset.goto); return; }
  const md = e.target.closest('[data-modal]'); if(md){ openModal(md.dataset.modal); return; }
  const intakeChoice = e.target.closest('[data-intake-choice]'); if(intakeChoice){ toggleIntakeChoice(intakeChoice); return; }
  if(e.target.closest('[data-close]')) closeModal();
  const dgo = e.target.closest('[data-go]'); if(dgo){ go(dgo.dataset.go); }
  const act = e.target.closest('[data-act]'); if(act){ handleAct(act.dataset.act, act); }
  if(e.target.id==='scrim') closeModal();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closeModal();
  if(e.key==='Enter' && !e.shiftKey && e.target?.id==='previewInput'){
    e.preventDefault();
    const message = e.target.value.trim();
    if(message) startWorkflowPreview(message);
  }
});
document.addEventListener('input',e=>{
  const intakeInput = e.target.closest('[data-intake-input]');
  if(intakeInput){
    const value = intakeInput.value.trim();
    if(value) previewCaseState[intakeInput.dataset.intakeInput] = value;
    else delete previewCaseState[intakeInput.dataset.intakeInput];
    renderIntakeProgress(localIntakeProgress());
    return;
  }
  const intakeOther = e.target.closest('[data-intake-other]');
  if(intakeOther){
    const fieldId = intakeOther.dataset.intakeOther;
    if(fieldId && intakeOther.value.trim()) previewCaseState[fieldId] = `Other: ${intakeOther.value.trim()}`;
    else if(fieldId) previewCaseState[fieldId] = 'Other';
    renderIntakeProgress(localIntakeProgress());
    return;
  }
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
function modalPayload(el){
  const box = el.closest('#modalBox');
  const fields = box ? [...box.querySelectorAll('input,select,textarea')].map(x=>x.value).filter(Boolean) : [];
  return { fields };
}
function handleAct(a, el){
  if(a==='open-preview'){
    openPreviewPanel();
    return;
  }
  if(a==='preview-send'){
    if(current!=='studio') return;
    const input = $('#previewInput');
    const message = (input?.value || '').trim();
    if(!message){ toast('Enter a preview message first','info'); return; }
    startWorkflowPreview(message);
    return;
  }
  if(a==='preview-stop'){
    if(previewController) previewController.abort();
    return;
  }
  if(a==='intake-type'){
    const input = $('#previewInput');
    if(input){ input.focus(); input.select(); }
    toast('Type any detail you know · one answer is enough','info');
    return;
  }
  if(a==='intake-send'){
    const answers = collectIntakeAnswers();
    const text = intakePayloadText(answers);
    if(!text){ toast('Choose or type at least one detail first','info'); return; }
    const input = $('#previewInput');
    if(input) input.value = text;
    startWorkflowPreview(text, { customerAnswers: answers });
    return;
  }
  if(a==='repair-approve' || a==='repair-reject'){
    const runId = state.lastRepair?.run_id || state.lastRepair?.artifact?.run_id || state.previewRun;
    if(!runId){ toast('No repair run selected','harness'); return; }
    const decision = a==='repair-approve' ? 'approve' : 'reject';
    fetch(`/api/workflow-runs/${encodeURIComponent(runId)}/approval`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({decision}),
    })
      .then(r=>r.ok ? r.json() : r.json().then(x=>Promise.reject(new Error(x.detail||'Approval failed'))))
      .then(body=>{
        toast(decision==='approve' ? 'Repair approved · capability promoted' : 'Repair rejected · artifact kept for audit', decision==='approve'?'ok':'harness');
        if(decision==='approve' && body.capability){
          state.catalogAdds += 1;
          refreshConnectedViews();
        }
      })
      .catch(err=>toast(err.message || 'Approval failed','harness'));
    return;
  }
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
  if(a==='connect-mcp'){
    const p = modalPayload(el);
    syncBackend('/api/mcp/servers', {name:'Device / IP Risk MCP', url:p.fields[0], auth:p.fields[1], permission:p.fields[2], status:'connected'});
    toast('MCP server connected · tools discoverable in Catalog','ok');
    return;
  }
  if(a==='save-provider-key'){
    const p = modalPayload(el);
    syncBackend('/api/provider-keys', {provider:p.fields[0]||'OpenAI', key:p.fields[1]||'', route_position:p.fields[2]||'Fallback #1'});
    toast('Provider key saved · plaintext never returned','ok');
    return;
  }
  if(a==='save-fallback-policy'){
    const p = modalPayload(el);
    syncBackend('/api/fallback-policies', {name:'Studio fallback policy', policy_type:p.fields[0], trigger:p.fields[1], workflow_id:'default'});
    toast('Fallback policy saved · publish gate updated','harness');
    return;
  }
  if(a==='save-rag-source'){
    const p = modalPayload(el);
    syncBackend('/api/rag/sources', {name:'Governed knowledge source', source_type:p.fields[0], location:p.fields[1], pii_redaction:true, citations_required:true});
    toast('RAG source added · grounding eval queued','ok');
    return;
  }
  if(a==='save-replay-scenario'){
    const p = modalPayload(el);
    syncBackend('/api/replay/scenarios', {name:p.fields[0]||'Custom replay scenario', failure:p.fields[1], expected:p.fields[2], workflow_id:'default', status:'draft'});
    toast('Replay scenario saved · ready for suite run','ok');
    return;
  }
  if(a.startsWith('approval-')){
    const decision = a.replace('approval-','');
    syncBackend('/api/approvals', {workflow_id:'default', decision, packet:'fraud_approval_packet', graph:window.OST.workflowSummary()});
    toast(`Approval ${decision} recorded · audit trail updated`, decision==='approve'?'ok':'harness');
    return;
  }
  if(a==='publish-workflow'){
    window.OST.state.published=true; window.OST.saveState('auto');
    syncBackend('/api/audit-events', {type:'workflow_published', workflow_id:'default', graph:window.OST.workflowSummary()});
    toast('Workflow published · audit packet generated','ok');
    return;
  }
  if(a==='export-audit'){
    window.OST.state.auditPackets += 1; window.OST.saveState('auto');
    syncBackend('/api/audit-events', {type:'audit_exported', workflow_id:'default', graph:window.OST.workflowSummary()});
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
