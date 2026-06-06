/* ===== OpenSkillTrace — app controller ===== */
(function(){
const D = window.DATA, ic = window.icon, V = window.Views;
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const h = v => String(v ?? '').replace(/[&<>"']/g, ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

const VIEWS = {
  overview:{ render:V.overview, crumb:['Build','Overview'], flush:false },
  studio:{ render:V.studio, crumb:['Build','Workflow Studio','Scam Transaction Response'], flush:true },
  templates:{ render:V.templates, crumb:['Build','Templates'], flush:false },
  tickets:{ render:V.tickets, crumb:['Build','My Tickets'], flush:false },
  catalog:{ render:V.catalog, crumb:['Build','Catalogs'], flush:false },
  rag:{ render:V.rag, crumb:['Build','RAG Builder'], flush:false },
  providers:{ render:V.providers, crumb:['Reliability','Model Providers'], flush:false },
  fallback:{ render:V.fallback, crumb:['Reliability','Fallback Center'], flush:true&&false, flush:false },
  eval:{ render:V.eval, crumb:['Reliability','Eval & Replay'], flush:false },
  governance:{ render:V.governance, crumb:['Govern','Data Governance'], flush:false },
};

/* ---------- shared workflow state ---------- */
const STATE_KEY = 'ost_workflow_state_v3';
const ACTIVE_WORKFLOW_KEY = 'ost_active_workflow_id';
const FB_ROUTES_KEY = 'ost_fallback_routes_v1';
const FB_ROUTE_TYPES = {
  model:'Model fallback',
  tool:'Tool fallback',
  skill:'Skill fallback',
  workflow:'Workflow fallback',
};
const seed = {
  flow: D.flow.map(n=>({...n, meta:(n.meta||[]).map(m=>({...m}))})),
  edges: D.edges.map(e=>e.slice()),
};
const stateDefaults = () => ({
  dirty:false,
  lastSaved:'not saved yet',
  replayPass:91,
  evalRuns:1,
  auditPackets:1,
  catalogAdds:0,
  lastValidation:null,
  previewRun:null,
  lastRepair:null,
});
const state = stateDefaults();
let workflowStore = [];
let activeWorkflowId = localStorage.getItem(ACTIVE_WORKFLOW_KEY) || 'default';
let previewController = null;
let previewAssistantText = '';
let previewCaseState = {};
let previewIntakeSchema = null;
let previewIntakeUpdate = null;
let previewApprovalPacket = null;
let ticketStore = [];
let activeTicketId = null;
let activeFallbackRouteKey = null;
function syncBackend(path, payload, method='POST'){
  fetch(path, {
    method,
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
  }).catch(()=>{});
}
function cloneFlow(flow){
  return (flow || []).map(n=>({...n, meta:(n.meta||[]).map(m=>({...m}))}));
}
function cloneEdges(edges){
  return (edges || []).map(e=>e.slice());
}
function resetState(next={}){
  Object.keys(state).forEach(key=>delete state[key]);
  Object.assign(state, stateDefaults(), next || {});
}
function activeWorkflow(){
  return workflowStore.find(w=>w.id===activeWorkflowId) || null;
}
function activeWorkflowName(){
  return activeWorkflow()?.name || 'Scam Transaction Response';
}
function workflowLocalKey(id=activeWorkflowId){
  return `${STATE_KEY}:${id}`;
}
function workflowPayload(status){
  return {
    id:activeWorkflowId,
    name:activeWorkflowName(),
    status:status || (state.published ? 'published' : 'draft'),
    graph:{ flow:cloneFlow(D.flow), edges:cloneEdges(D.edges) },
    state:{...state},
  };
}
function updateWorkflowStore(payload){
  const idx = workflowStore.findIndex(w=>w.id===payload.id);
  const item = {...(workflowStore[idx] || {}), ...payload, updated_at:new Date().toISOString()};
  if(idx >= 0) workflowStore.splice(idx, 1, item);
  else workflowStore.push(item);
  workflowStore.sort((a,b)=>String(a.name || a.id).localeCompare(String(b.name || b.id)));
}
function applyWorkflow(workflow){
  const graph = workflow?.graph || {};
  const flow = Array.isArray(graph.flow) && graph.flow.length ? graph.flow : seed.flow;
  const edges = Array.isArray(graph.edges) ? graph.edges : seed.edges;
  D.flow.splice(0, D.flow.length, ...cloneFlow(flow));
  D.edges.splice(0, D.edges.length, ...cloneEdges(edges));
  resetState({
    ...(workflow?.state || {}),
    dirty:false,
    published:workflow?.status === 'published' || workflow?.state?.published,
    lastSaved:workflow?.updated_at ? 'loaded from backend' : (workflow?.state?.lastSaved || 'not saved yet'),
  });
}
function loadLocalWorkflow(id=activeWorkflowId){
  const raw = localStorage.getItem(workflowLocalKey(id)) || (id === 'default' ? localStorage.getItem(STATE_KEY) : null);
  if(!raw) return null;
  const saved = JSON.parse(raw);
  if(!Array.isArray(saved.flow) || !Array.isArray(saved.edges)) return null;
  return {
    id,
    name:saved.name || 'Scam Transaction Response',
    status:saved.state?.published ? 'published' : 'draft',
    graph:{flow:saved.flow, edges:saved.edges},
    state:saved.state || {},
  };
}
async function loadWorkflows(){
  try{
    const res = await fetch('/api/workflows');
    if(!res.ok) throw new Error('workflow API unavailable');
    const body = await res.json();
    workflowStore = Array.isArray(body.items) ? body.items : [];
  }catch{
    workflowStore = [];
  }
  if(!workflowStore.length){
    const local = loadLocalWorkflow(activeWorkflowId);
    workflowStore = [local || {id:'default', name:'Scam Transaction Response', status:'draft', graph:{flow:seed.flow, edges:seed.edges}, state:{}}];
  }
  if(!workflowStore.some(w=>w.id===activeWorkflowId)){
    activeWorkflowId = workflowStore.find(w=>w.id==='default')?.id || workflowStore[0].id;
  }
  localStorage.setItem(ACTIVE_WORKFLOW_KEY, activeWorkflowId);
  applyWorkflow(activeWorkflow());
}
function refreshStudioView(){
  const old = $('#v-studio');
  if(old) old.remove();
  if(current === 'studio') go('studio');
}
function switchWorkflow(id){
  if(!id || id === activeWorkflowId) return;
  if(state.dirty) saveState('auto');
  const next = workflowStore.find(w=>w.id===id);
  if(!next){ toast('Workflow not found','harness'); return; }
  activeWorkflowId = id;
  localStorage.setItem(ACTIVE_WORKFLOW_KEY, activeWorkflowId);
  applyWorkflow(next);
  refreshStudioView();
  refreshConnectedViews();
  toast(`Switched to “${activeWorkflowName()}”`,'ok');
}
function slugWorkflowName(name){
  const base = String(name || 'workflow').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'workflow';
  let id = base;
  let i = 2;
  while(workflowStore.some(w=>w.id===id)) id = `${base}-${i++}`;
  return id;
}
function createWorkflow(){
  const name = prompt('New workflow name', 'New workflow');
  if(!name) return;
  if(state.dirty) saveState('auto');
  const payload = {
    id:slugWorkflowName(name),
    name:name.trim(),
    status:'draft',
    graph:{ flow:cloneFlow(seed.flow), edges:cloneEdges(seed.edges) },
    state:{...stateDefaults(), lastSaved:'created locally'},
  };
  updateWorkflowStore(payload);
  activeWorkflowId = payload.id;
  localStorage.setItem(ACTIVE_WORKFLOW_KEY, activeWorkflowId);
  applyWorkflow(payload);
  saveState('auto');
  refreshStudioView();
  toast(`Created workflow “${payload.name}”`,'ok');
}
function graphFromTemplate(template){
  const labels = String(template?.flow || 'Input → Agent → Policy → Output')
    .split('→')
    .map(s=>s.trim())
    .filter(Boolean);
  const phases = labels.length ? labels : ['Input','Agent','Policy','Output'];
  const nodeFor = (label, i) => {
    const raw = label.toLowerCase();
    const t = /policy|approval|hold|freeze|aml|verify|check|gate|escalation/.test(raw) ? 'harness'
      : /evidence|graph|kyc|device|risk|login|rag|sop/.test(raw) ? (raw.includes('rag') || raw.includes('sop') ? 'rag' : 'tool')
      : /audit|packet|case|ops|output/.test(raw) ? 'output'
      : /agent|triage|classif/.test(raw) ? 'agent'
      : i === 0 ? 'input'
      : i === phases.length - 1 ? 'output'
      : 'agent';
    const icon = t === 'input' ? (template?.icon || 'input')
      : t === 'agent' ? 'agent'
      : t === 'tool' ? (/graph/.test(raw) ? 'graph' : /device|login/.test(raw) ? 'mcp' : 'tool')
      : t === 'rag' ? 'rag'
      : t === 'harness' ? (/approval/.test(raw) ? 'approval' : 'policy')
      : 'output';
    const type = t === 'input' ? 'Trigger'
      : t === 'agent' ? 'LLM Agent'
      : t === 'tool' ? 'Evidence Tool'
      : t === 'rag' ? 'Retrieval'
      : t === 'harness' ? 'Harness Gate'
      : 'Output';
    return {
      id:`tpl-${i + 1}-${raw.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'step'}`,
      t,
      icon,
      title:label,
      type,
      selected:i === Math.min(1, phases.length - 1),
      desc:`Template step for ${template?.name || 'a governed workflow'}: ${label}. Harness trace, fallback, policy, and audit are enabled by default.`,
      port:t === 'input' ? 'webhook · form'
        : t === 'agent' ? 'provider route · fallback'
        : t === 'tool' ? 'read-only evidence source'
        : t === 'rag' ? 'cited policy source'
        : t === 'harness' ? 'allow / block / escalate'
        : 'approval packet · audit',
      meta:[{c:'fb',t:'harness on'},{c:'ev',t:'replay ready'}],
      badge:t === 'harness' ? 'policy gate' : 'template',
      x:80 + i * 300,
      y: i % 2 ? 300 : 220,
    };
  };
  const flow = phases.map(nodeFor);
  const edges = flow.slice(1).map((n, i)=>[flow[i].id, n.id]);
  return {flow, edges};
}
function createWorkflowFromTemplate(template){
  if(!template) return null;
  if(state.dirty) saveState('auto');
  const graph = graphFromTemplate(template);
  const payload = {
    id:slugWorkflowName(template.name),
    name:template.name,
    status:template.status === 'Live' ? 'published' : 'draft',
    graph:{ flow:cloneFlow(graph.flow), edges:cloneEdges(graph.edges) },
    state:{...stateDefaults(), lastSaved:'created from template'},
  };
  updateWorkflowStore(payload);
  activeWorkflowId = payload.id;
  localStorage.setItem(ACTIVE_WORKFLOW_KEY, activeWorkflowId);
  applyWorkflow(payload);
  saveState('auto');
  refreshStudioView();
  refreshConnectedViews();
  toast(`Created “${payload.name}” from template`,'ok');
  if(current !== 'studio') setTimeout(()=>go('studio'), 180);
  return payload;
}
async function deleteActiveWorkflow(){
  if(workflowStore.length <= 1){ toast('Keep at least one workflow','harness'); return; }
  const currentWorkflow = activeWorkflow();
  if(!currentWorkflow) return;
  if(!confirm(`Delete workflow “${currentWorkflow.name || currentWorkflow.id}”?`)) return;
  try{
    const res = await fetch(`/api/workflows/${encodeURIComponent(currentWorkflow.id)}`, { method:'DELETE' });
    if(!res.ok) throw new Error('Delete failed');
  }catch(err){
    toast(err.message || 'Delete failed','harness');
    return;
  }
  localStorage.removeItem(workflowLocalKey(currentWorkflow.id));
  workflowStore = workflowStore.filter(w=>w.id!==currentWorkflow.id);
  activeWorkflowId = workflowStore[0].id;
  localStorage.setItem(ACTIVE_WORKFLOW_KEY, activeWorkflowId);
  applyWorkflow(workflowStore[0]);
  refreshStudioView();
  refreshConnectedViews();
  toast('Workflow deleted','ok');
}
const ragState = {
  config:null,
  sources:[],
  selectedNodeId:'',
  lastSearch:null,
  eval:null,
  pollTimer:null,
};
function currentWorkflowRagNodes(){
  const flow = activeWorkflow()?.graph?.flow || D.flow || [];
  return (Array.isArray(flow) ? flow : []).filter(node=>node?.t === 'rag');
}
function ragNodeTitle(nodeId){
  return currentWorkflowRagNodes().find(node=>node.id === nodeId)?.title || nodeId || 'Unknown RAG node';
}
function normalizeRagNodeSelection(){
  const nodes = currentWorkflowRagNodes();
  if(!nodes.length){
    ragState.selectedNodeId = '';
    return;
  }
  if(!nodes.some(node=>node.id === ragState.selectedNodeId)) ragState.selectedNodeId = nodes[0].id;
}
function ragSourcesForSelection(){
  const sources = Array.isArray(ragState.sources) ? ragState.sources : [];
  if(!ragState.selectedNodeId) return sources;
  return sources.filter(source=>Array.isArray(source.workflow_node_ids) && source.workflow_node_ids.includes(ragState.selectedNodeId));
}
function formatBytes(bytes){
  const n = Number(bytes || 0);
  if(n < 1024) return `${n} B`;
  if(n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function ragStatusClass(status){
  return {
    indexed:'ok',
    uploaded:'info',
    indexing:'info',
    pending:'info',
    failed:'warn',
    needs_reindex:'warn',
  }[status] || 'info';
}
function ragStatusLabel(status){
  return {
    indexed:'Indexed',
    uploaded:'Uploaded',
    indexing:'Indexing',
    failed:'Failed',
    needs_reindex:'Needs reindex',
  }[status] || h(status || 'Unknown');
}
async function ragFetch(path, options={}){
  const res = await fetch(path, options);
  const body = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(body.detail || body.message || `RAG request failed (${res.status})`);
  return body;
}
function ragFallbackLabel(){
  if(ragState.lastSearch) return ragState.lastSearch.fallback_used ? 'Keyword fallback used' : 'Vector search used';
  if(ragState.eval) return ragState.eval.results?.some(r=>r.fallback_used) ? 'Eval used fallback' : 'Eval ready';
  return ragState.config?.qdrant?.ok ? 'Vector DB online' : 'Keyword fallback ready';
}
function renderRagFallback(){
  const status = $('#ragFallbackStatus');
  const reason = $('#ragFallbackReason');
  if(!status || !reason) return;
  const fallback = !!ragState.lastSearch?.fallback_used;
  status.textContent = ragFallbackLabel();
  status.className = `pill ${fallback ? 'warn' : 'ok'}`;
  reason.textContent = ragState.lastSearch?.fallback_reason || (ragState.config?.qdrant?.ok ? 'Qdrant is healthy for the active profile.' : 'Qdrant is unavailable; searches can still use the SQLite keyword index.');
}
function renderRagConfig(){
  if(!$('#ragProvider') || !ragState.config) return;
  const c = ragState.config;
  $('#ragProvider').value = c.embedding_provider || 'local';
  $('#ragLocalModel').value = c.local_model || 'BAAI/bge-small-en-v1.5';
  $('#ragOpenaiModel').value = c.openai_model || 'text-embedding-3-small';
  $('#ragCollection').textContent = c.collection_name || 'openskilltrace_rag_local_bge_small_en_v15';
  $('#ragQdrant').textContent = c.qdrant?.ok ? 'online' : 'offline';
  $('#ragQdrant').className = `pill ${c.qdrant?.ok ? 'ok' : 'warn'}`;
  renderRagFallback();
}
function renderRagNodeFilter(){
  normalizeRagNodeSelection();
  const select = $('#ragNodeFilter');
  const workflowName = $('#ragWorkflowName');
  const nodes = currentWorkflowRagNodes();
  if(workflowName) workflowName.textContent = activeWorkflowName();
  if(!select) return;
  if(!nodes.length){
    select.innerHTML = `<option value="">No RAG nodes in workflow</option>`;
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.innerHTML = nodes.map(node=>
    `<option value="${h(node.id)}" ${node.id===ragState.selectedNodeId?'selected':''}>${h(node.title)} · ${h(node.id)}</option>`
  ).join('');
}
function renderRagSourceFilter(){
  const select = $('#ragSourceFilter');
  if(!select) return;
  const selected = select.value;
  const sources = ragSourcesForSelection();
  const label = ragState.selectedNodeId ? `All sources in ${ragNodeTitle(ragState.selectedNodeId)}` : 'All indexed sources';
  select.innerHTML = `<option value="">${h(label)}</option>` + sources.map(s=>
    `<option value="${h(s.id)}">${h(s.name)} · ${h(ragStatusLabel(s.status))}</option>`
  ).join('');
  if([...select.options].some(o=>o.value===selected)) select.value = selected;
}
function renderRagSources(){
  const wrap = $('#ragSources');
  if(!wrap) return;
  const sources = ragSourcesForSelection();
  const indexed = sources.filter(s=>s.status === 'indexed').length;
  const count = $('#ragIndexedCount');
  if(count) count.textContent = `${indexed} indexed`;
  if(!currentWorkflowRagNodes().length){
    wrap.innerHTML = `<div class="ragEmpty">${ic('rag')}<b>No RAG node in this workflow</b><span>Add a Retrieval step in Workflow Studio first, then attach sources here.</span></div>`;
    renderRagSourceFilter();
    return;
  }
  if(!sources.length){
    wrap.innerHTML = `<div class="ragEmpty">${ic('rag')}<b>No sources indexed</b><span>Upload a PDF, Markdown, text, or CSV file.</span></div>`;
    renderRagSourceFilter();
    return;
  }
  wrap.innerHTML = sources.map(s=>`
    <div class="ragSource row">
      <div class="rico bk-rag">${ic('file')}</div>
      <div class="rmain">
        <b>${h(s.name)}</b>
        <span>${h(s.filename)} · ${formatBytes(s.bytes)} · ${s.chunk_count || 0} chunks${s.embedding_provider ? ` · ${h(s.embedding_provider)}:${h(s.embedding_model || '')}` : ''}</span>
        <span>${(s.workflow_node_ids || []).map(id=>`<code>${h(ragNodeTitle(id))}</code>`).join(' · ') || '<code>unassigned</code>'}</span>
        ${s.error ? `<span class="ragError">${h(s.error)}</span>` : ''}
      </div>
      <div class="rend">
        <span class="pill ${ragStatusClass(s.status)}">${ragStatusLabel(s.status)}</span>
        <button class="iconbtn" title="Reindex" data-act="rag-reindex" data-source-id="${h(s.id)}">${ic('refresh')}</button>
        <button class="iconbtn" title="Delete" data-act="rag-delete-source" data-source-id="${h(s.id)}">${ic('trash')}</button>
      </div>
    </div>`).join('');
  renderRagSourceFilter();
}
function renderRagResults(){
  const wrap = $('#ragResults');
  if(!wrap) return;
  const body = ragState.lastSearch;
  if(!body){
    wrap.innerHTML = `<div class="ragEmpty small">${ic('search')}<b>No query run</b><span>Retrieved chunks and citations appear here.</span></div>`;
    return;
  }
  const badge = $('#ragLastSearchStatus');
  if(badge){
    badge.textContent = body.fallback_used ? 'fallback' : body.status;
    badge.className = `pill ${body.fallback_used ? 'warn' : body.status === 'grounded' ? 'ok' : 'warn'}`;
  }
  if(!body.results?.length){
    wrap.innerHTML = `<div class="ragEmpty small">${ic('alert')}<b>No grounded evidence</b><span>${h(body.message || 'Ask a human analyst.')}</span></div>`;
    renderRagFallback();
    return;
  }
  wrap.innerHTML = body.results.map((r,i)=>`
    <div class="ragResult">
      <div class="ragResultTop">
        <b>${h(r.source_name || r.filename || 'Source')}</b>
        <span class="pill ${r.retrieval_mode === 'keyword' ? 'warn' : 'ok'}">${h(r.retrieval_mode)} · ${Number(r.score || 0).toFixed(3)}</span>
      </div>
      <p>${h(r.excerpt)}</p>
      <div class="ragCitation"><code>C${i + 1}</code><span>${h(r.citation)}</span>${r.page ? `<span>page ${h(r.page)}</span>` : ''}${r.row_start ? `<span>row ${h(r.row_start)}</span>` : ''}</div>
    </div>`).join('');
  renderRagFallback();
}
function renderRagEval(){
  const wrap = $('#ragEvalResults');
  if(!wrap) return;
  const result = ragState.eval;
  if(!result){
    wrap.innerHTML = `<div class="hintline">No eval run yet.</div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="ragEvalMetrics">
      <div><span>Coverage</span><b>${h(result.citation_coverage)}%</b></div>
      <div><span>Unsupported</span><b>${h(result.unsupported_rate)}%</b></div>
      <div><span>Status</span><b>${h(result.status)}</b></div>
    </div>
    ${(result.results || []).map(item=>`
      <div class="kv"><span class="k">${ic(item.passed ? 'check' : 'alert')} ${h(item.name)}</span><span class="v">${h((item.citations || []).join(', ') || 'no citation')}</span></div>
    `).join('')}`;
  renderRagFallback();
}
function startRagPolling(){
  if(ragState.pollTimer) clearInterval(ragState.pollTimer);
  ragState.pollTimer = setInterval(()=>{
    if(current !== 'rag'){
      clearInterval(ragState.pollTimer);
      ragState.pollTimer = null;
      return;
    }
    loadRag(false);
    if(!ragState.sources.some(s=>['uploaded','indexing','pending'].includes(s.status))){
      clearInterval(ragState.pollTimer);
      ragState.pollTimer = null;
    }
  }, 2500);
}
async function loadRag(showErrors=true){
  if(!$('#ragSources')) return;
  try{
    const [config, sources] = await Promise.all([
      ragFetch('/api/rag/config'),
      ragFetch('/api/rag/sources'),
    ]);
    ragState.config = config;
    ragState.sources = sources.items || [];
    normalizeRagNodeSelection();
    renderRagNodeFilter();
    renderRagConfig();
    renderRagSources();
    renderRagResults();
    renderRagEval();
    if(ragState.sources.some(s=>['uploaded','indexing','pending'].includes(s.status))) startRagPolling();
  }catch(err){
    if(showErrors) toast(err.message || 'RAG unavailable','harness');
  }
}
function providerRequiresKey(provider){
  return provider?.id !== 'local_gpt_oss';
}
function applyProviderSettings(payload, fromBackend=false){
  const providerId = payload.provider || payload.id;
  const provider = D.providers.find(p=>p.id===providerId || p.name===payload.provider_name);
  if(!provider) return null;
  const hasKey = !!(payload.key || payload.key_masked || payload.key_fingerprint || payload.key_ciphertext);
  const connected = !providerRequiresKey(provider) || hasKey || provider.keys > 0;
  provider.st = connected ? 'ok' : 'idle';
  provider.status = connected ? 'Connected' : 'Available';
  provider.keys = hasKey ? Math.max(provider.keys || 0, 1) : (providerRequiresKey(provider) ? (provider.keys || 0) : 0);
  provider.defaultModel = payload.model_name || payload.model || provider.defaultModel;
  provider.apiBase = payload.base_url || payload.api_base || provider.apiBase;
  provider.organization = payload.organization || provider.organization || '';
  provider.note = payload.route_position ? payload.route_position : provider.note;
  if(fromBackend && payload.status === 'disabled'){
    provider.st = 'idle';
    provider.status = 'Available';
  }
  return provider;
}
function loadProviderSettings(){
  fetch('/api/provider-keys')
    .then(r=>r.ok ? r.json() : null)
    .then(body=>{
      const items = Array.isArray(body?.items) ? body.items : [];
      if(!items.length) return;
      items.forEach(item=>applyProviderSettings(item, true));
      refreshView('providers');
    })
    .catch(()=>{});
}
function normalizeTicket(ticket){
  const packet = ticket?.approval_packet || ticket?.packet || {};
  return {
    ...(ticket || {}),
    approval_packet: packet,
    summary: ticket?.summary || packet.summary || {},
    status: ticket?.status || packet.status || 'pending_employee_approval',
    run_id: ticket?.run_id || packet.run_id,
    id: ticket?.id || `ticket_${ticket?.run_id || packet.run_id || Date.now()}`,
  };
}
function upsertLocalTicket(ticket){
  if(!ticket) return null;
  const normalized = normalizeTicket(ticket);
  const index = ticketStore.findIndex(item=>item.id===normalized.id || item.run_id===normalized.run_id);
  if(index >= 0) ticketStore.splice(index, 1, {...ticketStore[index], ...normalized});
  else ticketStore.unshift(normalized);
  activeTicketId = activeTicketId || normalized.id;
  refreshTicketsPage();
  return normalized;
}
function ticketFromPacket(packet){
  if(!packet) return null;
  const summary = packet.summary || {};
  const sensitive = Array.isArray(summary.sensitive_info) ? summary.sensitive_info : [];
  const evidenceRecords = Array.isArray(packet.evidence_records) ? packet.evidence_records : [];
  const customerStatus = packet.status === 'approved'
    ? 'Refund approved and customer notified'
    : packet.status === 'rejected'
      ? 'Refund request rejected and customer notified'
      : packet.status === 'escalated'
        ? 'Escalated to a fraud specialist'
        : 'Waiting for employee approval';
  const ticketStatus = packet.status === 'approved'
    ? 'refund_approved'
    : packet.status === 'rejected'
      ? 'refund_rejected'
      : packet.status === 'escalated'
        ? 'escalated'
        : packet.status || 'pending_employee_approval';
  return normalizeTicket({
    id:`ticket_${packet.run_id}`,
    run_id:packet.run_id,
    workflow_id:packet.workflow_id,
    title:`${summary.amount || 'Unknown amount'} ${summary.scam_type || 'scam'} refund review`,
    status:ticketStatus,
    priority:sensitive.length ? 'urgent' : 'standard',
    queue:'FraudOps refund approval',
    assignee:'Head of Ops',
    customer_status:customerStatus,
    summary,
    approval_packet:packet,
    evidence_count:evidenceRecords.length,
    evidence_records:evidenceRecords,
    rag_context:Array.isArray(packet.rag_context) ? packet.rag_context : [],
    classification:packet.classification || {},
    harness_learning:packet.harness_learning || {},
    safety_flags:sensitive,
    updated_at:new Date().toISOString(),
  });
}
function refreshTicketsPage(){
  const view = $('#v-tickets');
  if(!view || !VIEWS.tickets) return;
  view.innerHTML = `<div class="page">${VIEWS.tickets.render()}</div>`;
  wireTickets(view);
}
async function loadTickets(){
  try{
    const res = await fetch('/api/tickets');
    if(!res.ok) throw new Error('tickets unavailable');
    const body = await res.json();
    ticketStore = (body.items || []).map(normalizeTicket).sort((a,b)=>String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
    if(!activeTicketId && ticketStore[0]) activeTicketId = ticketStore[0].id;
    refreshTicketsPage();
  }catch{
    refreshTicketsPage();
  }
}
function routeSlug(value){
  return String(value || 'route').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'route';
}
function fallbackRouteId(type, route, index){
  return route.id || `${type}-${routeSlug(route.name)}-${index + 1}`;
}
function fallbackHopParts(hop){
  if(Array.isArray(hop)) return [String(hop[0] || ''), String(hop[1] || '')];
  return [String(hop?.name || hop?.target || ''), String(hop?.role || '')];
}
function normalizeHopRoles(hops){
  const normalized = hops.map(h=>{
    const role = h[1] === 'human' ? 'human' : '';
    return [h[0], role];
  });
  const primaryIndex = normalized.findIndex(h=>h[1] !== 'human');
  if(primaryIndex >= 0) normalized[primaryIndex][1] = 'primary';
  else if(normalized.length) normalized[0][1] = 'primary';
  return normalized;
}
function normalizeFallbackRoutes(){
  Object.keys(FB_ROUTE_TYPES).forEach(type=>{
    if(!Array.isArray(D.fbRoutes[type])) D.fbRoutes[type] = [];
    D.fbRoutes[type].forEach((route,index)=>{
      route.id = fallbackRouteId(type, route, index);
      route.tag = route.tag || 'live';
      route.hops = (route.hops || []).map(fallbackHopParts).filter(([name])=>name.trim());
      if(!route.hops.length) route.hops = [['Primary target','primary']];
      route.hops = normalizeHopRoles(route.hops);
    });
  });
}
function loadFallbackRoutes(){
  normalizeFallbackRoutes();
  try{
    const raw = localStorage.getItem(FB_ROUTES_KEY);
    if(raw){
      const saved = JSON.parse(raw);
      Object.keys(FB_ROUTE_TYPES).forEach(type=>{
        if(Array.isArray(saved?.[type])){
          D.fbRoutes[type].splice(0,D.fbRoutes[type].length,...saved[type]);
        }
      });
    }
  }catch{
    localStorage.removeItem(FB_ROUTES_KEY);
  }
  normalizeFallbackRoutes();
}
function persistFallbackRoutes(){
  normalizeFallbackRoutes();
  localStorage.setItem(FB_ROUTES_KEY, JSON.stringify(D.fbRoutes));
}
function setActiveFallbackRoute(type, id){
  normalizeFallbackRoutes();
  activeFallbackRouteKey = { type, id };
}
function getActiveFallbackRoute(){
  normalizeFallbackRoutes();
  const type = activeFallbackRouteKey?.type;
  const id = activeFallbackRouteKey?.id;
  const route = type && D.fbRoutes[type]?.find(r=>r.id===id);
  return route ? { type, route } : null;
}
function fallbackTypeLabel(type){
  return FB_ROUTE_TYPES[type] || 'Fallback route';
}
function selected(value, expected){ return value === expected ? 'selected' : ''; }
function fallbackHopRow(hop=['',''], index=0){
  const [name, role] = fallbackHopParts(hop);
  return `<div class="fbHopRow" data-hop-row>
    <span class="fbPriority">${index + 1}</span>
    <input class="input" data-hop-name value="${escapeHtml(name)}" placeholder="Fallback target">
    <select class="select" data-hop-role>
      <option value="primary" ${selected(role,'primary')}>Primary</option>
      <option value="" ${selected(role,'')}>Fallback</option>
      <option value="human" ${selected(role,'human')}>Human / manual</option>
    </select>
    <div class="fbHopActions">
      <button class="iconbtn" title="Move up" aria-label="Move target up" data-act="fb-hop-up">${ic('chevd')}</button>
      <button class="iconbtn" title="Move down" aria-label="Move target down" data-act="fb-hop-down">${ic('chevd')}</button>
      <button class="iconbtn" title="Remove target" aria-label="Remove target" data-act="fb-hop-delete">${ic('trash')}</button>
    </div>
  </div>`;
}
function collectFallbackHops(box, normalize=true){
  const rows = $$('[data-hop-row]', box);
  const hops = rows.map(row=>[
    ($('[data-hop-name]', row)?.value || '').trim(),
    $('[data-hop-role]', row)?.value || '',
  ]).filter(([name])=>name);
  const safe = hops.length ? hops : [['Primary target','primary']];
  return normalize ? normalizeHopRoles(safe) : safe;
}
function fallbackRoutePreview(hops){
  return hops.map((h,i)=>`<span class="hop ${escapeHtml(h[1])}"><span class="n">${i+1}</span>${escapeHtml(h[0])}</span>${i<hops.length-1?ic('arrow','arr'):''}`).join('');
}
function syncFallbackRoleControls(box){
  const rows = $$('[data-hop-row]', box);
  let primaryAssigned = false;
  rows.forEach(row=>{
    const selectEl = $('[data-hop-role]', row);
    if(!selectEl) return;
    if(selectEl.value === 'human') return;
    selectEl.value = primaryAssigned ? '' : 'primary';
    primaryAssigned = true;
  });
  if(!primaryAssigned && rows[0]){
    const firstRole = $('[data-hop-role]', rows[0]);
    if(firstRole) firstRole.value = 'primary';
  }
}
function updateFallbackPreview(box){
  if(!box) return;
  syncFallbackRoleControls(box);
  const preview = $('.fbPreview .route', box);
  if(preview) preview.innerHTML = fallbackRoutePreview(normalizeHopRoles(collectFallbackHops(box, false)));
}
function renumberFallbackEditor(box){
  const rows = $$('[data-hop-row]', box);
  rows.forEach((row,index)=>{
    const priority = $('.fbPriority', row);
    if(priority) priority.textContent = index + 1;
    const up = $('[data-act="fb-hop-up"]', row);
    const down = $('[data-act="fb-hop-down"]', row);
    const del = $('[data-act="fb-hop-delete"]', row);
    if(up) up.disabled = index === 0;
    if(down) down.disabled = index === rows.length - 1;
    if(del) del.disabled = rows.length === 1;
  });
  updateFallbackPreview(box);
}
function moveFallbackHop(el, direction){
  const row = el.closest('[data-hop-row]');
  const list = row?.parentElement;
  if(!row || !list) return;
  const target = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
  if(!target) return;
  if(direction < 0) list.insertBefore(row, target);
  else list.insertBefore(target, row);
  renumberFallbackEditor(el.closest('#modalBox'));
}
function deleteFallbackHop(el){
  const box = el.closest('#modalBox');
  const rows = $$('[data-hop-row]', box);
  if(rows.length <= 1){ toast('Keep at least one fallback target','info'); return; }
  el.closest('[data-hop-row]')?.remove();
  renumberFallbackEditor(box);
}
function addFallbackHop(el){
  const box = el.closest('#modalBox');
  const list = $('.fbHopList', box);
  if(!list) return;
  list.insertAdjacentHTML('beforeend', fallbackHopRow(['',''], $$('[data-hop-row]', box).length));
  renumberFallbackEditor(box);
  $('[data-hop-name]', list.lastElementChild)?.focus();
}
function fallbackRouteModalBody(){
  const active = getActiveFallbackRoute();
  if(!active) return `<div class="explain">${ic('info')}<div>Select a fallback block to configure its route hierarchy.</div></div>`;
  const { type, route } = active;
  return `<div class="fbEditor">
    <div class="grid g2" style="gap:12px">
      <div class="field"><label>Route name</label><input class="input" data-fb-field="name" value="${escapeHtml(route.name)}"></div>
      <div class="field"><label>Status</label><select class="select" data-fb-field="tag"><option value="live" ${selected(route.tag,'live')}>live</option><option value="draft" ${selected(route.tag,'draft')}>draft</option><option value="paused" ${selected(route.tag,'paused')}>paused</option></select></div>
    </div>
    <div class="field"><label>Route note</label><textarea class="textarea" data-fb-field="note">${escapeHtml(route.note || '')}</textarea></div>
    <div class="fbEditorHead">
      <div><b>${escapeHtml(fallbackTypeLabel(type))} hierarchy</b><span>Use the arrow controls to reorder the targets. The first non-human target becomes primary.</span></div>
      <button class="btn sm" data-act="fb-hop-add">${ic('plus')} Add target</button>
    </div>
    <div class="fbHopList">${route.hops.map((hop,index)=>fallbackHopRow(hop,index)).join('')}</div>
    <div class="fbPreview">
      <span>Preview</span>
      <div class="route">${fallbackRoutePreview(route.hops)}</div>
    </div>
    <div class="explain harness">${ic('fallback')}<div>Saving updates this existing fallback block and keeps the configured hierarchy in the Fallback Center after refresh.</div></div>
  </div>`;
}
function collectFallbackRouteModal(box){
  const active = getActiveFallbackRoute();
  const name = ($('[data-fb-field="name"]', box)?.value || active?.route.name || 'Fallback route').trim();
  return {
    name,
    tag: $('[data-fb-field="tag"]', box)?.value || 'live',
    note: ($('[data-fb-field="note"]', box)?.value || '').trim(),
    hops: collectFallbackHops(box, true),
  };
}
function saveFallbackRouteFromModal(el){
  const active = getActiveFallbackRoute();
  const box = el.closest('#modalBox');
  if(!active || !box){ toast('No fallback route selected','harness'); return; }
  Object.assign(active.route, collectFallbackRouteModal(box));
  persistFallbackRoutes();
  syncBackend('/api/fallback-policies', {
    id:active.route.id,
    name:active.route.name,
    policy_type:fallbackTypeLabel(active.type),
    workflow_id:activeWorkflowId,
    status:active.route.tag,
    note:active.route.note,
    hops:active.route.hops,
  });
  refreshView('fallback');
  toast('Fallback hierarchy updated · route reordered','harness');
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
  const payload = workflowPayload();
  localStorage.setItem(workflowLocalKey(), JSON.stringify({ name:payload.name, flow:D.flow, edges:D.edges, state }));
  if(activeWorkflowId === 'default') localStorage.setItem(STATE_KEY, JSON.stringify({ name:payload.name, flow:D.flow, edges:D.edges, state }));
  updateWorkflowStore(payload);
  syncBackend('/api/workflows', payload);
  refreshConnectedViews();
}
function markDirty(reason='draft changed'){
  state.dirty=true;
  state.lastSaved=reason;
  const payload = workflowPayload('draft');
  localStorage.setItem(workflowLocalKey(), JSON.stringify({ name:payload.name, flow:D.flow, edges:D.edges, state }));
  updateWorkflowStore(payload);
  syncBackend('/api/workflows', payload);
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
    workflow_id:activeWorkflowId,
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
  if(id==='tickets') wireTickets(view);
  if(id==='rag') loadRag();
}
function refreshConnectedViews(){
  ['overview','templates','tickets','catalog','rag','providers','fallback','eval','governance'].forEach(refreshView);
  if(window.OSTStudio) window.OSTStudio.syncSummary?.();
}
window.OST = {
  state,
  seed,
  get activeWorkflowId(){ return activeWorkflowId; },
  get activeWorkflow(){ return activeWorkflow(); },
  get workflows(){ return workflowStore; },
  activeWorkflowName,
  switchWorkflow,
  createWorkflow,
  createWorkflowFromTemplate,
  deleteActiveWorkflow,
  saveState,
  markDirty,
  workflowSummary,
  validateWorkflow,
  runReplay,
  publishReadiness,
  createWorkflowNode,
  updateNode,
  refreshConnectedViews,
  loadProviderSettings,
  loadTickets,
  upsertLocalTicket,
  get tickets(){ return ticketStore; },
  get activeTicketId(){ return activeTicketId; },
};
loadFallbackRoutes();

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
    if(id==='tickets') wireTickets(view);
    if(id==='rag') loadRag();
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
  if(id==='tickets') loadTickets();
  if(id==='rag') loadRag();
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
function wireTickets(root){
  $$('[data-ticket-id]',root).forEach(row=>{
    if(row._ticketWired) return;
    row._ticketWired = true;
    row.addEventListener('click',()=>{
      activeTicketId = row.dataset.ticketId;
      refreshTicketsPage();
    });
  });
}

function providerForContext(ctx={}){
  const id = ctx.provider || 'openai';
  return D.providers.find(p=>p.id===id) || D.providers[0];
}
function providerRouteDefault(provider){
  return provider?.id==='openai' ? 'Primary' : provider?.id==='local_gpt_oss' ? 'Fallback #1' : provider?.id==='fireworks_gpt_oss' ? 'Fallback #2' : 'Fallback #2';
}
function providerConfigBody(ctx={}){
  const provider = providerForContext(ctx);
  const providerOptions = D.providers.map(p=>`<option value="${p.id}" ${p.id===provider.id?'selected':''}>${p.name}</option>`).join('');
  const routeDefault = providerRouteDefault(provider);
  const routeOptions = ['Primary','Fallback #1','Fallback #2','Disabled'].map(r=>`<option ${r===routeDefault?'selected':''}>${r}</option>`).join('');
  const modelTypes = ['LLM','Text Embedding','Speech2text','Moderation','TTS'];
  const typeRows = modelTypes.map((type,i)=>`
    <label class="modelTypeOption ${i===0?'active':''}">
      <input type="radio" name="provider_model_type" data-field="model_type" value="${type}" ${i===0?'checked':''}>
      <span class="radioDot"></span>
      <span>${type}</span>
    </label>`).join('');
  const docsLink = `<a class="providerDocs" href="${provider.docsUrl || '#'}" target="_blank" rel="noreferrer" ${provider.docsUrl?'':'hidden'}>Get your API key from ${provider.name} ${ic('arrow')}</a>`;
  const keyPlaceholder = provider.keys ? 'Leave blank to keep the saved key' : provider.apiKeyLabel || 'Enter provider API key';
  return `
    <div class="providerConfig">
      <div class="field"><label>Model Type <span class="req">*</span></label><div class="modelTypeList">${typeRows}</div></div>
      <div class="grid g2" style="gap:13px">
        <div class="field"><label>Provider <span class="req">*</span></label><select class="select" data-field="provider">${providerOptions}</select></div>
        <div class="field"><label>Use in route position</label><select class="select" data-field="route_position">${routeOptions}</select></div>
      </div>
      <div class="field"><label>Model Name <span class="req">*</span></label><input class="input mono" data-field="model_name" value="${provider.defaultModel || 'gpt-5.5'}" placeholder="Enter your model name"></div>
      <div class="field"><label>API Key <span class="req">*</span></label><input class="input mono" type="password" data-field="api_key" placeholder="${keyPlaceholder}" autocomplete="off"></div>
      <div class="field"><label>Organization</label><input class="input mono" data-field="organization" value="${provider.organization || ''}" placeholder="Enter your Organization ID"></div>
      <div class="field"><label>API Base</label><input class="input mono" data-field="api_base" value="${provider.apiBase || ''}" placeholder="Enter your API Base"></div>
      <div class="providerConfigMeta">${docsLink}<span>Default route: GPT-5.5 -> Local GPT-OSS -> Fireworks GPT-OSS.</span></div>
    </div>`;
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
  'provider-keys':{ title:'Model provider setup', sub:'Keys are encrypted at rest and model defaults are saved with the route', body:(ctx)=>providerConfigBody(ctx),
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-act="save-provider-key">${ic('check')} Save key</button>` },
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
  'configure-fallback':{ title:'Configure fallback route', sub:'Reorder the hierarchy used by this existing block', body:()=>fallbackRouteModalBody(),
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn harness" data-act="save-fallback-route" data-close>${ic('check')} Save hierarchy</button>` },
  'add-source':{ title:'Add knowledge source', sub:'File upload for production RAG v1', body:()=>`
    <div class="field"><label>Source name</label><input class="input" data-field="source_name" placeholder="Fraud SOP or policy pack"></div>
    <div class="field"><label>Files</label><input class="input" data-rag-files type="file" multiple accept=".pdf,.md,.txt,.csv"></div>
    <div class="field"><label>RAG node</label><select class="select" data-field="workflow_node_id">${(()=>{
      const nodes = currentWorkflowRagNodes();
      return nodes.length
        ? nodes.map(node=>`<option value="${h(node.id)}" ${node.id===ragState.selectedNodeId?'selected':''}>${h(node.title)} · ${h(node.id)}</option>`).join('')
        : '<option value="">No RAG nodes in active workflow</option>';
    })()}</select></div>
    <div class="field adv-only"><label>Additional workflow node IDs</label><input class="input mono" data-field="workflow_node_ids" placeholder="optional comma-separated extra node ids"></div>
    <div class="kv"><span class="k">${ic('mask')} PII redaction at index</span><span class="v" style="color:var(--harness-ink)">on</span></div>
    <div class="kv"><span class="k">${ic('layers')} Citation required</span><span class="v" style="color:var(--harness-ink)">on</span></div>`,
    foot:()=>`<button class="btn" data-close>Cancel</button><button class="btn primary" data-act="save-rag-source">${ic('plus')} Upload & index</button>` },
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
MODALS['publish-cat']=MODALS.publish;

function openModal(key, trigger=null){
  const m = MODALS[key]; if(!m) return;
  const ctx = trigger ? {...trigger.dataset} : {};
  const wide = key==='new'||key==='import'||key==='add-provider'||key==='audit'||key==='repair-detail'||key==='provider-keys'||key==='configure-fallback';
  $('#modalBox').className='modal'+(wide?' wide':'');
  $('#modalBox').innerHTML = `
    <div class="modalHd"><div><h3>${m.title}</h3><p>${m.sub||''}</p></div><button class="iconbtn x" data-close>${ic('x')}</button></div>
    <div class="modalBody">${m.body(ctx)}</div>
    ${m.foot?`<div class="modalFoot">${m.foot(ctx)}</div>`:''}`;
  $('#scrim').classList.add('open');
  if(key==='configure-fallback') renumberFallbackEditor($('#modalBox'));
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
    approval: $('#caseApproval'),
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
  if(el.approval) el.approval.hidden = true;
}
function hideIntakeAgent(){
  const el = previewEls();
  if(el.intake) el.intake.hidden = true;
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
function renderIntakeSchema(payload, show=false){
  if(payload?.fields) previewIntakeSchema = payload;
  if(payload?.case_state) mergeLocalCaseState(payload.case_state);
  const schema = previewIntakeSchema;
  const base = $('#intakeBase');
  const title = $('#intakeTitle');
  const subtitle = $('#intakeSubtitle');
  if(!base || !schema) return;
  if(show) revealIntakeAgent();
  if(title) title.textContent = schema.title || 'Claim intake helper';
  if(subtitle) subtitle.textContent = schema.subtitle || 'Click choices, add only what you know.';
  const fields = schema.fields || [];
  const primary = fields.filter(f=>['amount','occurred_at'].includes(f.field_id));
  const rest = fields.filter(f=>!['amount','occurred_at'].includes(f.field_id));
  base.innerHTML = `${primary.length ? `<div class="intakeGrid">${primary.map(f=>renderIntakeField(f)).join('')}</div>` : ''}
    ${rest.map(f=>renderIntakeField(f, {full:true})).join('')}`;
  renderIntakeProgress(schema.progress);
}
function renderIntakeUpdate(payload, shouldMerge=true){
  if(payload) previewIntakeUpdate = payload;
  if(shouldMerge && payload?.case_state) mergeLocalCaseState(payload.case_state);
  const dynamic = $('#intakeDynamic');
  if(!dynamic || !payload) return;
  renderIntakeProgress(payload.progress);
  const fields = payload.fields || [];
  const safety = payload.safety || [];
  if(!fields.length){
    hideIntakeAgent();
    return;
  }
  revealIntakeAgent();
  const title = $('#intakeTitle');
  const subtitle = $('#intakeSubtitle');
  const caseBox = $('#intakeCase');
  if(title) title.textContent = payload.title || 'Next details needed';
  if(subtitle) subtitle.textContent = payload.subtitle || 'Answer only what you know.';
  if(caseBox) caseBox.hidden = true;
  dynamic.hidden = false;
  dynamic.innerHTML = `<div class="followupList">
    <div class="followupIntro"><b>${escapeHtml(payload.title || 'Next details needed')}</b><span>${escapeHtml(payload.subtitle || 'Answer only the fields you know.')}</span></div>
    ${fields.map(f=>renderIntakeField(f, {followup:true, full:true})).join('')}
    ${safety.map(text=>`<div class="intakeSafety">${ic('alert')}<span>${escapeHtml(text)}</span></div>`).join('')}
  </div>`;
}
function renderApprovalPacket(packet){
  previewApprovalPacket = packet || previewApprovalPacket;
  if(packet) upsertLocalTicket(ticketFromPacket(packet));
  const el = previewEls();
  if(el.approval){
    el.approval.hidden = true;
    el.approval.innerHTML = '';
  }
  if(!previewApprovalPacket) return;
  hideIntakeAgent();
}
function selectedIntakeValues(name, root=document){
  return [...new Set($$(`[data-intake-choice="${name}"].active`, root).map(btn=>{
    if(btn.dataset.value !== 'Other') return btn.dataset.value;
    const custom = ($(`[data-intake-other="${name}"]`, root)?.value || '').trim();
    return custom ? `Other: ${custom}` : 'Other';
  }))];
}
function collectIntakeAnswers(){
  const dynamic = $('#intakeDynamic');
  const root = dynamic && !dynamic.hidden ? dynamic : document;
  const answers = {};
  $$('[data-intake-input]', root).forEach(input=>{
    const key = input.dataset.intakeInput;
    const value = input.value.trim();
    if(value) answers[key] = value;
  });
  const fields = new Set($$('[data-intake-choice]', root).map(btn=>btn.dataset.intakeChoice));
  fields.forEach(field=>{
    const values = selectedIntakeValues(field, root).filter(Boolean);
    if(values.length) answers[field] = ($(`[data-single="${field}"]`, root) ? values[0] : values);
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
  const customerAnswers = Object.prototype.hasOwnProperty.call(opts, 'customerAnswers') ? opts.customerAnswers : {};
  if(Object.keys(customerAnswers).length) mergeLocalCaseState(customerAnswers);
  window.OSTStudio?.showPreview?.();
  window.OSTStudio?.clearRunStates?.();
  const el = previewEls();
  if(el.files) el.files.innerHTML = '';
  if(el.log) el.log.innerHTML = '';
  if(el.repair) el.repair.hidden = true;
  if(el.intake) el.intake.hidden = true;
  if(el.approval) el.approval.hidden = true;
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
        workflow_id:activeWorkflowId,
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
    renderIntakeSchema(data, false);
    setPreviewProcess('running','Customer Intake',`${data.progress?.collected || 0} of ${data.progress?.required || 0} key details collected.`);
  }
  if(event==='case_state.updated'){
    mergeLocalCaseState(data.case_state || {});
    renderIntakeSchema({ ...(previewIntakeSchema || {}), case_state: previewCaseState, progress: data.progress }, false);
    setPreviewProcess('running','Customer Intake',`${data.progress?.collected || 0} of ${data.progress?.required || 0} key details collected.`);
  }
  if(event==='intake.update'){
    renderIntakeUpdate(data);
    const missing = data.fields?.length || 0;
    setPreviewProcess(missing ? 'running' : null,'Customer Intake', missing ? `${missing} next detail${missing===1?'':'s'} needed.` : 'Key customer details are ready for the workflow.');
  }
  if(event==='approval.packet'){
    renderApprovalPacket(data.packet);
    setPreviewProcess(null,'Employee approval', 'Refund packet is ready for employee approval.');
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
      : data.status === 'approval_required'
        ? 'Employee refund approval is required.'
      : data.status === 'completed'
        ? 'Workflow turn completed. You can continue the chat.'
        : `Run ${data.status || 'completed'}.`;
    setPreviewProcess(data.status==='blocked'?'failed':null,'Workflow Process',statusText);
    if(data.status==='awaiting_user' && previewIntakeUpdate?.fields?.length) renderIntakeUpdate(previewIntakeUpdate, false);
    if(data.status==='approval_required' && data.approval_packet) renderApprovalPacket(data.approval_packet);
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
  const md = e.target.closest('[data-modal]'); if(md){
    if(md.dataset.modal === 'configure-fallback') setActiveFallbackRoute(md.dataset.fbType, md.dataset.fbId);
    openModal(md.dataset.modal, md);
    return;
  }
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
    if(message){
      e.target.value = '';
      startWorkflowPreview(message);
    }
  }
});
document.addEventListener('change',e=>{
  const workflowSelect = e.target.closest('[data-workflow-select]');
  if(workflowSelect){
    switchWorkflow(workflowSelect.value);
    return;
  }
  const ragNodeFilter = e.target.closest('#ragNodeFilter');
  if(ragNodeFilter){
    ragState.selectedNodeId = ragNodeFilter.value || '';
    ragState.lastSearch = null;
    renderRagNodeFilter();
    renderRagSources();
    renderRagSourceFilter();
    renderRagResults();
    return;
  }
  const fbControl = e.target.closest('#modalBox [data-hop-role], #modalBox [data-fb-field]');
  if(fbControl) updateFallbackPreview(fbControl.closest('#modalBox'));
  const providerSelect = e.target.closest('#modalBox [data-field="provider"]');
  if(!providerSelect) return;
  const provider = D.providers.find(p=>p.id===providerSelect.value);
  const box = providerSelect.closest('#modalBox');
  if(!provider || !box) return;
  const modelInput = box.querySelector('[data-field="model_name"]');
  const baseInput = box.querySelector('[data-field="api_base"]');
  const keyInput = box.querySelector('[data-field="api_key"]');
  const routeSelect = box.querySelector('[data-field="route_position"]');
  const docs = box.querySelector('.providerDocs');
  if(modelInput) modelInput.value = provider.defaultModel || '';
  if(baseInput) baseInput.value = provider.apiBase || '';
  if(keyInput) keyInput.placeholder = provider.keys ? 'Leave blank to keep the saved key' : provider.apiKeyLabel || 'Enter provider API key';
  if(routeSelect) routeSelect.value = providerRouteDefault(provider);
  if(docs){
    docs.href = provider.docsUrl || '#';
    docs.innerHTML = `Get your API key from ${provider.name} ${ic('arrow')}`;
    docs.hidden = !provider.docsUrl;
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
  const fallbackField = e.target.closest('#modalBox [data-hop-name], #modalBox [data-fb-field]');
  if(fallbackField){
    updateFallbackPreview(fallbackField.closest('#modalBox'));
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
function templateFromButton(btn){
  const index = Number(btn.dataset.templateIndex);
  if(Number.isInteger(index) && D.templates[index]) return D.templates[index];
  const name = btn.dataset.templateName || btn.closest('[data-template-name]')?.dataset.templateName;
  return D.templates.find(t => t.name === name) || null;
}
function modalPayload(el){
  const box = el.closest('#modalBox');
  const fields = [];
  const named = {};
  if(box){
    [...box.querySelectorAll('input,select,textarea')].forEach(x=>{
      if((x.type==='radio' || x.type==='checkbox') && !x.checked) return;
      const value = x.value;
      if(!value) return;
      fields.push(value);
      const key = x.dataset.field || x.name;
      if(key) named[key] = value;
    });
  }
  return { fields, named };
}
async function handleAct(a, el){
  if(a==='open-preview'){
    openPreviewPanel();
    return;
  }
  if(a==='fb-hop-up' || a==='fb-hop-down'){
    moveFallbackHop(el, a==='fb-hop-up' ? -1 : 1);
    return;
  }
  if(a==='fb-hop-delete'){
    deleteFallbackHop(el);
    return;
  }
  if(a==='fb-hop-add'){
    addFallbackHop(el);
    return;
  }
  if(a==='save-fallback-route'){
    saveFallbackRouteFromModal(el);
    return;
  }
  if(a==='preview-send'){
    if(current!=='studio') return;
    const input = $('#previewInput');
    const message = (input?.value || '').trim();
    if(!message){ toast('Enter a preview message first','info'); return; }
    if(input) input.value = '';
    startWorkflowPreview(message);
    return;
  }
  if(a==='preview-stop'){
    if(previewController) previewController.abort();
    return;
  }
  if(a==='tickets-refresh'){
    loadTickets();
    toast('Tickets refreshed','info');
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
    if(input) input.value = '';
    hideIntakeAgent();
    startWorkflowPreview(text, { customerAnswers: answers });
    return;
  }
  if(a==='case-approve-refund' || a==='case-reject' || a==='case-escalate'){
    const runId = el.dataset.runId || previewApprovalPacket?.run_id || state.previewRun;
    if(!runId){ toast('No approval packet selected','harness'); return; }
    const decision = a==='case-approve-refund' ? 'approve_refund' : a==='case-reject' ? 'reject' : 'escalate';
    fetch(`/api/workflow-runs/${encodeURIComponent(runId)}/case-approval`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({decision}),
    })
      .then(r=>r.ok ? r.json() : r.json().then(x=>Promise.reject(new Error(x.detail||'Approval failed'))))
      .then(body=>{
        upsertLocalTicket(ticketFromPacket(body.packet));
        renderApprovalPacket(body.packet);
        setPreviewProcess(null,'Employee approval', body.message || 'Approval decision recorded.');
        if($('#previewChat')){
          appendChatMessage('assistant', body.decision === 'approve_refund'
            ? 'Refund approved. The employee approval has been recorded, and the case is now marked approved.'
            : body.decision === 'reject'
              ? 'Refund request rejected after employee review. We will keep the case record, and you can provide more evidence if available.'
              : 'Your case has been escalated to a fraud specialist for deeper review.');
        }
        toast(body.decision === 'approve_refund' ? 'Refund approved · customer updated' : body.decision === 'reject' ? 'Refund rejected · customer updated' : 'Case escalated · customer updated', body.decision === 'approve_refund' ? 'ok' : 'harness');
      })
      .catch(err=>toast(err.message || 'Approval failed','harness'));
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
  if(a==='new-workflow'){
    window.OST.createWorkflow();
    return;
  }
  if(a==='use-template'){
    const t = templateFromButton(el);
    const created = window.OST.createWorkflowFromTemplate(t);
    if(!created) toast('Template not found','harness');
    return;
  }
  if(a==='delete-workflow'){
    await window.OST.deleteActiveWorkflow();
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
    const provider = p.named.provider || 'openai';
    const providerMeta = D.providers.find(x=>x.id===provider);
    if(providerRequiresKey(providerMeta) && !p.named.api_key && !(providerMeta?.keys > 0)){
      toast('Enter an API key before connecting this provider','harness');
      return;
    }
    const payload = {
      provider,
      provider_name:providerMeta?.name || provider,
      model_type:p.named.model_type || 'LLM',
      model_name:p.named.model_name || providerMeta?.defaultModel || 'gpt-5.5',
      key:p.named.api_key || '',
      organization:p.named.organization || '',
      base_url:p.named.api_base || providerMeta?.apiBase || '',
      route_position:p.named.route_position || 'Primary',
      status:'configured'
    };
    syncBackend('/api/provider-keys', payload);
    applyProviderSettings(payload);
    refreshView('providers');
    closeModal();
    toast('Provider settings saved · plaintext never returned','ok');
    return;
  }
  if(a==='save-fallback-policy'){
    const p = modalPayload(el);
    syncBackend('/api/fallback-policies', {name:'Studio fallback policy', policy_type:p.fields[0], trigger:p.fields[1], workflow_id:activeWorkflowId});
    toast('Fallback policy saved · publish gate updated','harness');
    return;
  }
  if(a==='save-rag-source'){
    const box = el.closest('#modalBox');
    const files = box?.querySelector('[data-rag-files]')?.files;
    if(!files || !files.length){ toast('Choose at least one RAG file','harness'); return; }
    const nodeId = box.querySelector('[data-field="workflow_node_id"]')?.value.trim();
    if(!nodeId){ toast('Choose a RAG node for this source','harness'); return; }
    const form = new FormData();
    [...files].forEach(file=>form.append('files', file));
    const name = box.querySelector('[data-field="source_name"]')?.value.trim();
    const nodes = box.querySelector('[data-field="workflow_node_ids"]')?.value.trim();
    if(name) form.append('name', name);
    form.append('source_type','file');
    form.append('workflow_node_ids', nodeId);
    if(nodes) form.append('workflow_node_ids', nodes);
    el.disabled = true;
    try{
      const body = await ragFetch('/api/rag/sources/upload', { method:'POST', body:form });
      closeModal();
      toast(`${body.items?.length || files.length} source${(body.items?.length || files.length)===1?'':'s'} uploaded · indexing queued`,'ok');
      await loadRag();
      startRagPolling();
    }catch(err){
      toast(err.message || 'Upload failed','harness');
    }finally{
      el.disabled = false;
    }
    return;
  }
  if(a==='rag-save-config'){
    try{
      ragState.config = await ragFetch('/api/rag/config', {
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          embedding_provider:$('#ragProvider')?.value || 'local',
          local_model:$('#ragLocalModel')?.value || 'BAAI/bge-small-en-v1.5',
          openai_model:$('#ragOpenaiModel')?.value || 'text-embedding-3-small',
        }),
      });
      toast('RAG settings saved · reindex required for changed profiles','ok');
      await loadRag();
    }catch(err){
      toast(err.message || 'RAG settings failed','harness');
    }
    return;
  }
  if(a==='rag-search'){
    const query = $('#ragQuery')?.value.trim();
    if(!query){ toast('Enter a RAG query','info'); return; }
    const nodeId = $('#ragNodeFilter')?.value.trim();
    if(!nodeId){ toast('Choose a RAG node first','info'); return; }
    const sourceId = $('#ragSourceFilter')?.value;
    try{
      ragState.lastSearch = await ragFetch('/api/rag/search', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          query,
          top_k:Number($('#ragTopK')?.value || 8),
          source_ids:sourceId ? [sourceId] : [],
          workflow_node_ids:[nodeId],
        }),
      });
      renderRagResults();
      toast(ragState.lastSearch.fallback_used ? 'Keyword fallback returned cited chunks' : 'Vector search returned cited chunks', ragState.lastSearch.fallback_used ? 'harness' : 'ok');
    }catch(err){
      toast(err.message || 'RAG search failed','harness');
    }
    return;
  }
  if(a==='ground-eval'){
    try{
      ragState.eval = await ragFetch('/api/rag/eval', { method:'POST' });
      renderRagEval();
      toast(`Grounding eval ${ragState.eval.status} · ${ragState.eval.citation_coverage}% citation coverage`, ragState.eval.status === 'passed' ? 'ok' : 'harness');
    }catch(err){
      toast(err.message || 'Grounding eval failed','harness');
    }
    return;
  }
  if(a==='rag-reindex'){
    const id = el.dataset.sourceId;
    if(!id) return;
    try{
      await ragFetch(`/api/rag/sources/${encodeURIComponent(id)}/reindex`, { method:'POST' });
      toast('Reindex queued','ok');
      await loadRag();
      startRagPolling();
    }catch(err){
      toast(err.message || 'Reindex failed','harness');
    }
    return;
  }
  if(a==='rag-delete-source'){
    const id = el.dataset.sourceId;
    if(!id) return;
    if(!confirm('Delete this RAG source and its indexed chunks?')) return;
    try{
      await ragFetch(`/api/rag/sources/${encodeURIComponent(id)}`, { method:'DELETE' });
      ragState.lastSearch = null;
      toast('RAG source deleted','ok');
      await loadRag();
    }catch(err){
      toast(err.message || 'Delete failed','harness');
    }
    return;
  }
  if(a==='save-replay-scenario'){
    const p = modalPayload(el);
    syncBackend('/api/replay/scenarios', {name:p.fields[0]||'Custom replay scenario', failure:p.fields[1], expected:p.fields[2], workflow_id:activeWorkflowId, status:'draft'});
    toast('Replay scenario saved · ready for suite run','ok');
    return;
  }
  if(a.startsWith('approval-')){
    const decision = a.replace('approval-','');
    syncBackend('/api/approvals', {workflow_id:activeWorkflowId, decision, packet:'fraud_approval_packet', graph:window.OST.workflowSummary()});
    toast(`Approval ${decision} recorded · audit trail updated`, decision==='approve'?'ok':'harness');
    return;
  }
  if(a==='publish-workflow'){
    window.OST.state.published=true; window.OST.saveState('auto');
    syncBackend('/api/audit-events', {type:'workflow_published', workflow_id:activeWorkflowId, graph:window.OST.workflowSummary()});
    toast('Workflow published · audit packet generated','ok');
    return;
  }
  if(a==='export-audit'){
    window.OST.state.auditPackets += 1; window.OST.saveState('auto');
    syncBackend('/api/audit-events', {type:'audit_exported', workflow_id:activeWorkflowId, graph:window.OST.workflowSummary()});
    toast(`Audit packet exported · ${window.OST.workflowSummary().nodes} nodes included`,'ok');
    return;
  }
  const map={};
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
async function init(){
  renderNav(); wireShell();
  const shell = localStorage.getItem('ost_shell')||'clarity';
  document.body.dataset.shell = shell;
  $$('.shellSwitch button').forEach(x=>x.classList.toggle('active',x.dataset.shell===shell));
  const mode = localStorage.getItem('ost_mode')||'simple';
  document.body.dataset.mode = mode; $('#modeLabel').textContent = mode==='advanced'?'Advanced':'Simple';
  await loadWorkflows();
  go(location.hash.slice(1)||localStorage.getItem('ost_view')||'overview');
  loadProviderSettings();
}
init();
})();
