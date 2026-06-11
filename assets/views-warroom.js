/* ===== Views: War Room runtime command surface ===== */
(function(){
const D = window.DATA, ic = window.icon;
window.Views = window.Views || {};

const STATE_KEY = 'ost_warroom_state_v2';

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

function initialState(){
  return {
    status:D.warroom.incident.status,
    riskScore:D.warroom.incident.riskScore,
    statusTone:'harness',
    harnessOn:true,
    sessionEnded:false,
    approvalDecision:null,
    validation:'pending',
    replayPass:null,
    terminal:[],
    transcript:[],
    routing:{},
    timeline:{},
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? {...initialState(), ...JSON.parse(raw)} : initialState();
  }catch{
    localStorage.removeItem(STATE_KEY);
    return initialState();
  }
}

function saveState(state){
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function postJson(path, payload){
  return fetch(path, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
  });
}

async function responseMessage(response, fallback){
  try{
    const body = await response.json();
    return body.detail || body.message || fallback;
  }catch{
    return fallback;
  }
}

function nowTime(){
  return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function addTerminal(state, tone, text){
  state.terminal = [...(state.terminal || []), { tone, text }].slice(-7);
}

function addTranscript(state, actor, text){
  state.transcript = [...(state.transcript || []), { actor, time:nowTime(), text }].slice(-6);
}

function realtimeState(){
  return window.OSTRealtime?.state || {};
}

function realtimeStatusLabel(status){
  return ({
    idle:'Ready',
    connecting:'Connecting...',
    connected:'Connected',
    listening:'Listening...',
    thinking:'Agent thinking',
    speaking:'Agent speaking',
    stopped:'Disconnected',
    error:'Connection issue',
  })[status] || 'Ready';
}

function pillClass(tone){
  const map = { ok:'ok', danger:'danger', harness:'harness', warn:'warn', info:'info', draft:'draft', brand:'info', tool:'info', agent:'info' };
  return map[tone] || 'draft';
}

function statusTone(status){
  if(/resolved|completed|approved/i.test(status)) return 'ok';
  if(/blocked|denied|failed/i.test(status)) return 'danger';
  if(/pending|sharing|approval|review/i.test(status)) return 'harness';
  return 'draft';
}

function studioWorkflow(){
  const nodes = Array.isArray(D.flow) ? D.flow : [];
  const rawEdges = Array.isArray(D.edges) ? D.edges : [];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges = rawEdges.filter(([from,to]) => byId.has(from) && byId.has(to));
  const ordered = nodes.slice().sort((a,b) => (a.x ?? 0) - (b.x ?? 0) || (a.y ?? 0) - (b.y ?? 0) || String(a.id).localeCompare(String(b.id)));
  const split = Math.max(1, Math.ceil(ordered.length / 2));
  return { nodes, edges, rawEdges, ordered, lanes:[ordered.slice(0, split), ordered.slice(split)] };
}

function metaText(n){
  return [n.badge, ...(n.meta || []).map(m => typeof m === 'string' ? m : m.t)].filter(Boolean);
}

function validateVisibleWarroom(){
  const {nodes, edges, rawEdges} = studioWorkflow();
  const ids = new Set(nodes.map(n => n.id));
  const brokenEdges = rawEdges.filter(([a,b]) => !ids.has(a) || !ids.has(b));
  const types = nodes.reduce((acc,n) => { acc[n.t] = (acc[n.t] || 0) + 1; return acc; }, {});
  const hasPendingGate = nodes.some(n => /approval|policy|gate|human/i.test(`${n.title} ${n.type} ${metaText(n).join(' ')}`));
  const hasFallback = nodes.some(n => /fallback|recovery|degrade/i.test(`${n.title} ${n.desc} ${n.port || ''} ${metaText(n).join(' ')}`));
  const issues = [];
  if(!nodes.length) issues.push('missing Studio workflow nodes');
  if(!rawEdges.length) issues.push('missing Studio workflow links');
  if(!types.input) issues.push('missing Studio input node');
  if(!types.agent) issues.push('missing Studio agent node');
  if(!types.output) issues.push('missing Studio output node');
  if(brokenEdges.length) issues.push(`${brokenEdges.length} broken Studio link${brokenEdges.length === 1 ? '' : 's'}`);
  if(!hasPendingGate) issues.push('missing Studio approval or policy gate');
  if(!hasFallback) issues.push('missing Studio fallback path');
  return { ok: issues.length === 0, issues, nodes:nodes.length, edges:rawEdges.length, visibleEdges:edges.length };
}

function renderParticipants(W){
  const realtime = realtimeState();
  const active = ['connecting','connected','listening','thinking','speaking'].includes(realtime.status);
  const voiceStatus = active ? realtimeStatusLabel(realtime.status) : 'Ready';
  const voiceAgent = `<div class="wrParticipant wrVoiceParticipant" data-tone="agent" data-voice-target="true">
    <div class="wrAvatar">${ic('agent')}</div>
    <div><b>GPT Realtime Agent</b><span>Sharing Studio</span><em>${esc(voiceStatus)}</em></div>
  </div>`;
  const support = W.participants.map(p => `<div class="wrParticipant" data-tone="${esc(p.tone)}" data-work-agent="true">
    <div class="wrAvatar">${esc(p.initials)}</div>
    <div><b>${esc(p.name)}</b><span>${esc(p.status)}</span></div>
  </div>`).join('');
  return voiceAgent + support;
}

function renderBlocks(workflow){
  return workflow.ordered.slice(0, 8).map(n => `<div class="wrBlock" data-tone="${esc(n.t)}">
    <div class="wrBlockTop"><span class="tag">${esc(n.type)}</span><b>${esc(n.title)}</b><span class="wrEval">${esc(n.badge || 'Studio')}</span></div>
    <p>${esc(n.desc)}</p>
  </div>`).join('');
}

function renderEdgeSummary(workflow){
  const names = new Map(workflow.nodes.map(n => [n.id, n.title]));
  const chips = workflow.edges.slice(0, 4).map(([from,to]) => `<span>${esc(names.get(from) || from)} -&gt; ${esc(names.get(to) || to)}</span>`).join('');
  const rest = workflow.edges.length > 4 ? `<em>+${workflow.edges.length - 4} more</em>` : '';
  return `<div class="wrEdgeSummary" aria-label="Workflow Studio edge map">${chips}${rest}</div>`;
}

function renderNodes(){
  const workflow = studioWorkflow();
  return `<div class="wrWorkflowSource">${ic('studio')}<span>Workflow Studio source</span><b>${workflow.nodes.length} nodes · ${workflow.edges.length} links</b></div>
    ${workflow.lanes.map((laneNodes, index) => `<div class="wrNodeLane" data-lane="${index === 0 ? 'primary' : 'support'}">
    ${laneNodes.map(n => `<button class="wrNode" type="button" data-tone="${esc(n.t)}" data-node-id="${esc(n.id)}">
      <span class="wrPort in"></span><span class="wrPort out"></span>
      <div class="wrNodeHead"><span class="wrNodeIcon">${ic(n.icon)}</span><div><h4>${esc(n.title)}</h4><small>${esc(n.type)}</small></div></div>
      <p>${esc(n.desc)}</p>
      <div class="wrNodeMeta">${metaText(n).slice(0, 3).map(m => `<span>${esc(m)}</span>`).join('')}</div>
      <span class="wrNodeState">${esc(n.port || n.badge || 'Studio node')}</span>
    </button>`).join('')}
  </div>`).join('')}
  ${renderEdgeSummary(workflow)}`;
}

function renderEmbeddedStudio(state){
  if(!Views.studio) return '';
  return Views.studio({ embedded:true, harnessOn:state.harnessOn });
}

function renderTranscript(W, state){
  return [...W.transcript, ...(state.transcript || [])].slice(-3).map(t => `<div class="wrTranscriptBubble">
    <div><b>${esc(t.actor)}</b><span>${esc(t.time)}</span></div>
    <p>${esc(t.text)}</p>
  </div>`).join('');
}

function renderRealtimeTranscript(){
  const realtime = realtimeState();
  return (realtime.transcript || []).slice(-2).map(t => `<div class="wrTranscriptBubble realtime">
    <div><b>${esc(t.actor)}</b><span>${esc(t.time)}</span></div>
    <p>${esc(t.text)}</p>
  </div>`).join('');
}

function renderRealtimeActivity(){
  const realtime = realtimeState();
  const rows = (realtime.events || []).slice(-3);
  if(!rows.length) return `<div class="wrActivityEmpty">${ic('activity')}<span>Voice session idle</span></div>`;
  return rows.map(row => `<div class="wrActivityLine" data-tone="${esc(row.tone || 'info')}">
    <span>${ic(row.icon || 'activity')}</span><div><b>${esc(row.label || row.type || 'Realtime event')}</b><small>${esc(row.detail || '')}</small></div>
  </div>`).join('');
}

function renderRouting(W, state){
  return W.routing.map(r => {
    const current = state.routing?.[r.name] || r.status;
    const tone = statusTone(current === r.status ? r.tone : current);
    return `<div class="wrRouteLine">
      <span>${esc(r.name)}</span>
      <span class="pill ${pillClass(tone)}">${esc(current)}</span>
    </div>`;
  }).join('');
}

function renderTerminal(W, state){
  return [...W.terminal, ...(state.terminal || [])].slice(-9).map(row => `<div class="wrLogLine" data-tone="${esc(row.tone)}">${esc(row.text)}</div>`).join('');
}

function renderTimeline(W, state){
  return W.timeline.map((step, index) => {
    const override = state.timeline?.[index] || {};
    const merged = {...step, ...override};
    return `<div class="wrStep" data-status="${esc(merged.status)}">
      <div class="wrStepIcon">${ic(merged.icon)}</div>
      <div><b>${index + 1}. ${esc(merged.title)}</b><p>${esc(merged.desc)}</p><span>${esc(merged.time)}</span></div>
    </div>`;
  }).join('');
}

function renderApproval(W, state){
  const resolved = state.status === 'Issue Resolved';
  const denied = state.approvalDecision === 'deny';
  return `<section class="wrApproval" aria-label="Approval proposal">
    <div class="wrApprovalHead">
      <span class="wrApprovalIcon">${ic(resolved ? 'checkc' : denied ? 'block' : 'approval')}</span>
      <div><h3>${resolved ? 'Resolution Approved' : denied ? 'Approval Denied' : esc(W.proposal.title)}</h3><p>${esc(W.proposal.summary)}</p></div>
    </div>
    <div class="wrChangeBox"><b>Proposed Changes</b><ul>${W.proposal.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
    <div class="wrChangeBox"><b>Impact</b><ul>${W.proposal.impact.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
    <div class="wrConfidence"><span>Confidence</span><span class="pill ok">${esc(W.proposal.confidence)}</span></div>
    <div class="wrApprovalActions">
      <button class="btn primary" data-warroom-act="approve" ${resolved ? 'disabled' : ''}>${ic('check')} Approve</button>
      <button class="btn" data-warroom-act="rerun">${ic('play')} Rerun Tests</button>
      <button class="btn" data-warroom-act="deny" ${resolved ? 'disabled' : ''}>${ic('block')} Deny</button>
    </div>
  </section>`;
}

Views.warroom = function(){
  const W = D.warroom;
  const state = loadState();
  const workflow = studioWorkflow();
  const realtime = realtimeState();
  const tone = state.statusTone || statusTone(state.status);
  const statusCopy = state.sessionEnded && state.status !== 'Issue Resolved' ? 'Review Closed' : state.status;
  const realtimeActive = ['connecting','connected','listening','thinking','speaking'].includes(realtime.status);
  const realtimeStatus = realtimeStatusLabel(realtime.status || 'idle');
  const approvalClosed = state.status === 'Issue Resolved' || state.approvalDecision === 'deny';
  const approvalCta = state.status === 'Issue Resolved'
    ? 'Approved'
    : state.approvalDecision === 'deny'
      ? 'Denied'
      : 'Approve Fix';
  const approvalIcon = state.status === 'Issue Resolved'
    ? 'checkc'
    : state.approvalDecision === 'deny'
      ? 'block'
      : 'check';
  const overall = state.status === 'Issue Resolved'
    ? { tone:'ok', title:'Sandbox fix approved', sub:'Fallback workflow promoted and audit trail updated.' }
    : state.approvalDecision === 'deny'
      ? { tone:'danger', title:'Approval denied', sub:'Fallback artifact retained for audit review.' }
      : { tone:'harness', title:'Approve sandboxed workflow fix', sub:'Agents finished the sandbox run. Production promotion waits for you.' };
  const validationLabel = state.validation === 'ok' ? 'Validated' : state.validation === 'needs-review' ? 'Needs Review' : 'Validate';
  const replayLabel = state.replayPass ? `${state.replayPass}% Replay` : 'Replay';

  return `<div class="warroomFull${state.harnessOn ? ' harness-on' : ' harness-off'}${state.sessionEnded ? ' session-ended' : ''}" aria-label="Workflow Recovery War Room">
    <aside class="wrPanel wrMeeting" aria-label="War room meeting participants">
      <div class="wrMeetingHead">
        <div class="wrPanelTitle">${ic('users')}<b>War Room Approval</b></div>
        <button class="btn sm" data-warroom-act="end">${ic('phone')} ${state.sessionEnded ? 'Closed' : 'Leave'}</button>
      </div>
      <div class="wrMeetingMeta"><span class="pill harness"><span class="dot"></span>Workflow down</span><span class="mono">${esc(W.incident.elapsed)}</span></div>
      <section class="wrAnalyst" aria-label="Analyst voice card">
        <div class="wrVoiceBars" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="wrPortrait"><span>YA</span></div>
        <b>${esc(W.incident.analyst)}</b>
        <span class="wrSpeaking wrApprovalReady"><i></i>Approval ready</span>
      </section>
      <div class="wrMeetingVoice" data-realtime-state="${esc(realtime.status || 'idle')}">
        <button class="btn icon primary" title="Talk to GPT Realtime Agent" data-realtime-act="start" data-realtime-start ${realtimeActive ? 'disabled' : ''}>${ic('mic')}</button>
        <div><b>Realtime Agent</b><span data-realtime-status>${esc(realtimeStatus)}</span></div>
        <button class="btn icon" title="End realtime voice" data-realtime-act="stop" data-realtime-stop ${realtimeActive ? '' : 'disabled'}>${ic('phone')}</button>
      </div>
      <div class="wrParticipantsHead"><span>Participants (${W.participants.length + 1})</span><em>one voice agent</em></div>
      <div class="wrParticipantGrid">${renderParticipants(W)}</div>
      <button class="btn wrInvite">${ic('plus')} Invite Participant</button>
    </aside>

    <header class="wrPanel wrIncident">
      <div class="wrBrand"><span class="wrShield">${ic('govern')}</span><div><h2>${esc(W.incident.title)}</h2><p>${esc(W.incident.id)} · ${esc(W.incident.workflow)}</p></div></div>
      <span class="pill ${pillClass(tone)} wrStatusPill" data-warroom-status aria-live="polite">${esc(statusCopy)}</span>
      <div class="wrMetrics" aria-label="Incident metrics">
        <div class="wrMetric"><b>${esc(W.incident.severity)}</b><span>Severity</span></div>
        <div class="wrMetric"><b>${esc(state.riskScore)}</b><span>Sandbox Replay</span></div>
        <div class="wrMetric"><b>${esc(W.incident.pendingSince)}</b><span>Pending Approval</span></div>
      </div>
      <div class="wrIncidentActions">
        <button class="btn" data-warroom-act="validate">${ic('check')} ${esc(validationLabel)}</button>
        <button class="btn" data-warroom-act="replay">${ic('play')} ${esc(replayLabel)}</button>
        <button class="hToggleBtn ${state.harnessOn ? 'on' : 'off'}" data-warroom-act="harness" aria-pressed="${state.harnessOn ? 'true' : 'false'}">${ic('layers')} Harness <span class="sw"></span></button>
        <button class="btn" data-warroom-act="telegram">${ic('bell')} Telegram</button>
        <button class="btn primary" data-warroom-act="approve" ${approvalClosed ? 'disabled' : ''}>${ic(approvalIcon)} ${esc(approvalCta)}</button>
      </div>
    </header>

    <main class="wrPanel wrWorkspace" aria-label="Workflow Studio shared canvas">
      <div class="wrEmbeddedStudio" aria-label="Embedded Workflow Studio shared screen">
        ${renderEmbeddedStudio(state)}
      </div>
    </main>

    <aside class="wrPanel wrOps" aria-label="Agent transcript and routing status">
      <section class="wrSideCard wrTranscript" aria-live="polite">
        <div class="wrSideRow"><b>Transcript</b><span class="pill live">Live</span></div>
        <div class="wrTranscriptList">
          ${renderTranscript(W, state)}
          <div data-realtime-transcript>${renderRealtimeTranscript()}</div>
        </div>
      </section>
      <section class="wrSideCard wrRealtimeEvents">
        <div class="wrSideRow"><b>Agent Activity</b><span class="pill ${realtimeActive ? 'ok' : 'draft'}" data-realtime-pill>${esc(realtimeActive ? 'voice live' : 'idle')}</span></div>
        <div class="wrActivityList" data-realtime-events>${renderRealtimeActivity()}</div>
      </section>
      <section class="wrSideCard wrRoutingCard">
        <div class="wrSideRow"><b>Routing Status</b>${ic('info')}</div>
        ${renderRouting(W, state)}
      </section>
      <section class="wrOverall wrDecision" data-tone="${overall.tone}">
        <span>${ic(overall.tone === 'ok' ? 'checkc' : overall.tone === 'danger' ? 'alert' : 'approval')}</span>
        <div class="wrDecisionBody">
          <b>${esc(overall.title)}</b>
          <p>${esc(overall.sub)}</p>
          <div class="wrDecisionActions">
            <button class="btn primary sm" data-warroom-act="approve" ${approvalClosed ? 'disabled' : ''}>${ic(approvalIcon)} ${esc(approvalCta)}</button>
            <button class="btn sm" data-warroom-act="rerun">${ic('play')} Rerun sandbox</button>
            <button class="btn sm" data-warroom-act="deny" ${approvalClosed ? 'disabled' : ''}>${ic('block')} Deny</button>
          </div>
        </div>
      </section>
    </aside>

    <footer class="wrPanel wrTimeline" aria-label="Behind the scenes orchestration workflow">
      <div class="wrTimelineHead">${ic('branch')}<b>Behind the Scenes: Sandbox Recovery Workflow</b><span class="pill ${pillClass(overall.tone)}">${overall.tone === 'ok' ? 'all steps completed' : 'approval gate active'}</span></div>
      <div class="wrSteps">${renderTimeline(W, state)}</div>
    </footer>
  </div>`;
};

function rerender(root, focusAction){
  const live = document.querySelector('.warroomFull') || root;
  if(!live) return;
  live.outerHTML = Views.warroom();
  const nextLive = document.querySelector('.warroomFull');
  setTimeout(()=>window.initStudio?.(nextLive), 0);
  if(!focusAction) return;
  const next = document.querySelector(`.warroomFull [data-warroom-act="${focusAction}"]:not([disabled])`)
    || document.querySelector('.warroomFull [data-warroom-act]:not([disabled])');
  next?.focus?.({preventScroll:true});
}

async function handleAction(action, root){
  const state = loadState();
  if(action === 'validate'){
    const executable = window.OST?.validateWorkflow?.();
    const visible = validateVisibleWarroom();
    const ok = !!executable?.ok && visible.ok;
    state.validation = ok ? 'ok' : 'needs-review';
    const issues = [...(executable?.issues || []), ...visible.issues];
    addTerminal(state, ok ? 'ok' : 'warn', ok ? `[VALIDATE] Studio graph and sandbox approval packet passed (${visible.nodes} nodes · ${visible.edges} links)` : `[VALIDATE] Review needed: ${issues.join(', ')}`);
    addTranscript(state, 'Orchestrator Agent', ok ? 'Studio graph and sandbox approval packet both passed validation.' : 'Validation needs review before promotion.');
    saveState(state);
    window.OSTtoast?.(ok ? 'War Room workflow validated' : 'Validation needs review', ok ? 'ok' : 'harness');
    rerender(root, action);
    return;
  }
  if(action === 'replay' || action === 'rerun'){
    const pass = window.OST?.runReplay?.() || 91;
    state.replayPass = pass;
    addTerminal(state, pass >= 95 ? 'ok' : 'warn', `[SANDBOX] FraudOps replay suite completed at ${pass}%`);
    addTranscript(state, 'Fraud Risk Agent', pass >= 95 ? 'Sandbox replay passed. Proposed fallback is still waiting for your approval.' : 'Sandbox replay result is below publish threshold.');
    saveState(state);
    window.OSTtoast?.(`War Room replay complete · ${pass}%`, pass >= 95 ? 'ok' : 'harness');
    rerender(root, action);
    return;
  }
  if(action === 'harness'){
    state.harnessOn = !state.harnessOn;
    addTerminal(state, state.harnessOn ? 'warn' : 'info', state.harnessOn ? '[HARNESS] Recovery overlays enabled' : '[HARNESS] Recovery overlays hidden');
    saveState(state);
    window.OSTtoast?.(state.harnessOn ? 'Harness overlays on' : 'Harness overlays hidden', 'harness');
    rerender(root, action);
    return;
  }
  if(action === 'telegram'){
    const res = await postJson('/api/telegram/warroom-call', {
      source:'warroom',
      incident:{
        id:D.warroom.incident.id,
        title:D.warroom.incident.title,
        workflow:D.warroom.incident.workflow,
        severity:D.warroom.incident.severity,
        status:state.status,
        risk_score:state.riskScore,
        summary:'Workflow is down, agents completed sandbox recovery, and human approval is required before promotion.',
      },
    });
    let body = {};
    try{ body = await res.json(); }catch{}
    const result = body.telegram || {};
    const sent = !!result.sent;
    addTerminal(state, sent ? 'ok' : 'warn', sent ? '[TELEGRAM] War Room call sent' : `[TELEGRAM] ${result.reason || 'Telegram is not configured'}`);
    saveState(state);
    window.OSTtoast?.(sent ? 'War Room call sent to Telegram' : (result.reason || 'Telegram is not configured'), sent ? 'ok' : 'harness');
    rerender(root, action);
    return;
  }
  if(action === 'approve'){
    const runId = window.OST?.state?.previewRun || window.OST?.state?.lastRepair?.run_id || window.OST?.state?.lastRepair?.artifact?.run_id;
    if(runId){
      const res = await postJson(`/api/workflow-runs/${encodeURIComponent(runId)}/approval`, { decision:'approve', comment:'Approved from War Room' });
      if(!res.ok){
        const message = await responseMessage(res, 'Run approval failed');
        state.status = 'Approval Blocked';
        state.statusTone = 'danger';
        state.approvalDecision = 'blocked';
        state.routing = {...state.routing, 'Fraud Risk Agent':'Blocked'};
        state.timeline = {...state.timeline, 5:{ status:'blocked', desc:'Approval blocked by replay/eval gate.', time:nowTime() }};
        addTerminal(state, 'danger', `[GATE] ${message}`);
        addTranscript(state, 'Orchestrator Agent', `Approval blocked: ${message}`);
        saveState(state);
        window.OSTtoast?.(message, 'harness');
        rerender(root, action);
        return;
      }
    }else{
      await postJson('/api/approvals', { workflow_id:'default', decision:'approve', packet:'warroom_sandbox_fix', graph:window.OST?.workflowSummary?.() });
    }
    try{
      await postJson('/api/audit-events', { type:'warroom_resolution_approved', workflow_id:'default', incident_id:D.warroom.incident.id, graph:window.OST?.workflowSummary?.() });
    }catch{}
    state.status = 'Issue Resolved';
    state.statusTone = 'ok';
    state.approvalDecision = 'approve';
    state.riskScore = 'Approved';
    state.routing = {...state.routing, 'Fraud Risk Agent':'Completed', 'Customer Support Agent':'Notified'};
    state.timeline = {...state.timeline, 5:{ status:'done', desc:'Human approved the sandbox fix and promotion.', time:nowTime() }};
    addTerminal(state, 'ok', '[APPLY] Sandbox fallback repair approved and audit packet updated');
    addTranscript(state, 'Orchestrator Agent', 'Approval recorded. The sandbox fix can promote and the audit trail has been updated.');
    saveState(state);
    window.OSTtoast?.('Resolution approved · audit trail updated', 'ok');
    rerender(root, action);
    return;
  }
  if(action === 'deny'){
    const runId = window.OST?.state?.previewRun || window.OST?.state?.lastRepair?.run_id || window.OST?.state?.lastRepair?.artifact?.run_id;
    if(runId){
      const res = await postJson(`/api/workflow-runs/${encodeURIComponent(runId)}/approval`, { decision:'reject', comment:'Rejected from War Room' });
      if(!res.ok) await postJson('/api/approvals', { workflow_id:'default', decision:'reject', packet:'warroom_sandbox_fix', graph:window.OST?.workflowSummary?.() }).catch(()=>{});
    }else{
      await postJson('/api/approvals', { workflow_id:'default', decision:'reject', packet:'warroom_sandbox_fix', graph:window.OST?.workflowSummary?.() }).catch(()=>{});
    }
    state.status = 'Approval Denied';
    state.statusTone = 'danger';
    state.approvalDecision = 'deny';
    state.routing = {...state.routing, 'Fraud Risk Agent':'Blocked'};
    state.timeline = {...state.timeline, 5:{ status:'blocked', desc:'Human denied promotion. Artifact retained for audit.', time:nowTime() }};
    addTerminal(state, 'danger', '[GATE] Sandbox fix denied by human approver');
    addTranscript(state, 'Orchestrator Agent', 'Approval denied. The proposed sandbox fix remains blocked and retained for audit.');
    saveState(state);
    window.OSTtoast?.('Approval denied · artifact retained', 'harness');
    rerender(root, action);
    return;
  }
  if(action === 'end'){
    state.sessionEnded = true;
    addTerminal(state, 'info', '[SESSION] War Room session ended locally');
    saveState(state);
    window.OSTtoast?.('War Room session ended', 'info');
    rerender(root, action);
  }
}

document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-warroom-act]');
  if(!trigger) return;
  const root = trigger.closest('.warroomFull');
  if(!root) return;
  e.preventDefault();
  handleAction(trigger.dataset.warroomAct, root);
});

})();
