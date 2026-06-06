/* ===== Views: Overview, Workflow Studio, Catalogs, RAG Builder ===== */
(function(){
const D = window.DATA, ic = window.icon;
window.Views = window.Views || {};
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

/* ---------- rectangular graph-node renderer (free-canvas) ---------- */
const TYPE_COLOR = { input:'#2563eb', agent:'#7c3aed', tool:'#0891b2', rag:'#4f46e5', mcp:'#c026d3', approval:'#0d9488', output:'#059669', harness:'#ea580c' };
window.renderGNode = function(n){
  const chips = [`<span class="gnHrn h">${ic('layers')}${n.badge}</span>`]
    .concat((n.meta||[]).map(m=>`<span class="gnHrn ${m.c}">${m.t}</span>`)).join('');
  return `<div class="gnode${n.selected?' selected':''}" data-node="${n.id}" data-type="${n.t}" style="left:${n.x}px;top:${n.y}px">
    <button class="gnDel" title="Delete" data-del="${n.id}">${ic('x')}</button>
    <span class="gnRunBadge" hidden></span>
    <span class="gPortDot pin" data-port="in" title="input"></span>
    <span class="gPortDot pout" data-port="out" data-from="${n.id}" title="drag to connect"></span>
    <div class="gnStrip" style="background:${TYPE_COLOR[n.t]||'#64748b'}"></div>
    <div class="gnIn">
      <div class="gnIco bk-${n.t}">${ic(n.icon)}</div>
      <div class="gnTitle"><h4>${n.title}</h4><span class="gnType ty-${n.t}">${n.type}</span></div>
    </div>
    <div class="gnBody">
      <p>${n.desc}</p>
      ${n.port?`<div class="gnPort">${ic('link')}<code>${n.port}</code></div>`:''}
    </div>
    <div class="gnFoot">${chips}</div>
  </div>`;
};

window.renderPreviewPanel = function(){
  return `<div class="previewPanel">
    <div class="previewTop">
      <div class="previewProcess" id="previewProcess">
        <div class="ppTop"><span class="spinDot"></span><b id="previewProcessTitle">Workflow Process</b><span id="previewRunStatus">idle</span></div>
        <div class="ppStatus" id="previewProcessStatus">Waiting for input.</div>
        <div class="ppFiles" id="previewFiles"></div>
        <button class="btn sm harness" id="repairCta" data-modal="repair-detail" hidden>${ic('approval')} Review repair proposal</button>
      </div>
      <details class="previewTrace">
        <summary>${ic('trace')} Live trace</summary>
        <div class="previewLog" id="previewLog"></div>
      </details>
    </div>
    <div class="previewChat" id="previewChat">
      <div class="previewEmpty" id="previewEmpty">
        <div class="rico bk-agent">${ic('agent')}</div>
        <b>Preview workflow</b>
        <span>Send a scam claim to run the live graph.</span>
      </div>
    </div>
    <div class="intakeAgent" id="intakeAgent" hidden>
      <div class="intakeHead"><div class="rico bk-agent">${ic('agent')}</div><div><b id="intakeTitle">Claim intake helper</b><span id="intakeSubtitle">Click choices, add only what you know.</span></div></div>
      <div class="intakeProgress" id="intakeProgress">Waiting for the Customer Intake node.</div>
      <div id="intakeDynamic" hidden></div>
      <details class="intakeCase" id="intakeCase" hidden>
        <summary><span>Case details</span><small id="intakeCaseSummary">0 of 9 key details</small></summary>
        <div class="intakeBase" id="intakeBase"></div>
      </details>
      <div class="intakeActions"><button class="btn sm" data-act="intake-type">${ic('file')} Type myself</button><button class="btn sm primary" data-act="intake-send">${ic('arrow')} Send details</button></div>
    </div>
    <div class="previewStop" id="previewStopWrap" hidden>
      <button class="btn sm" data-act="preview-stop">${ic('block')} Stop responding</button>
    </div>
    <div class="previewComposer">
      <textarea id="previewInput" rows="2" placeholder="Talk to Bot"></textarea>
      <button class="sendBtn" data-act="preview-send" title="Run workflow preview">${ic('play')}</button>
    </div>
  </div>`;
};

/* ---------- inspector renderer ---------- */
const KNOWN_NODE_IDS = ['n-input','n-intake','n-agent','n-tools','n-rag','n-class','n-policy','n-out','n-cap'];
function routeLine(type, fallback='inherit route'){
  const route = D.fbRoutes?.[type]?.[0];
  const hops = (route?.hops || []).map(h=>Array.isArray(h)?h[0]:h?.name).filter(Boolean);
  return hops.length ? hops.join(' → ') : fallback;
}
function routeName(type){
  return D.fbRoutes?.[type]?.[0]?.name || `${type} fallback`;
}
function providerById(id){ return D.providers.find(p=>p.id===id) || {}; }
function facts(rows){
  return rows.filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('');
}
function harnessRows(rows){
  return rows.map(([icon,label,value])=>`<div class="hmatrix"><span class="hk">${ic(icon)} ${esc(label)}</span><span class="hv">${esc(value)}</span></div>`).join('');
}
function capRows(rows){
  return rows.map(([color,name,score])=>`<div class="capRow"><span class="cd" style="background:${esc(color)}"></span><span class="cn mono">${esc(name)}</span><span class="cs">${esc(score)}</span></div>`).join('');
}
function routePreview(type){
  const route = D.fbRoutes?.[type]?.[0];
  const hops = route?.hops || [];
  if(!hops.length) return '';
  return `<div class="inspRoute">
    <div><b>${esc(route.name)}</b><span>${esc(route.note || 'Configured in Fallback Center')}</span></div>
    <div class="route">${hops.map((h,i)=>`<span class="hop ${esc(h[1] || '')}"><span class="n">${i+1}</span>${esc(h[0])}</span>${i<hops.length-1?ic('arrow','arr'):''}`).join('')}</div>
  </div>`;
}
function nodeSpec(n){
  const openai = providerById('openai');
  const local = providerById('local_gpt_oss');
  const fireworks = providerById('fireworks_gpt_oss');
  const specs = {
    'n-input':{
      purpose:'This trigger is the customer or risk-system entrypoint. It starts a traced preview run and protects sensitive identifiers before they reach downstream nodes.',
      runtime:'Input contract',
      routeType:'workflow',
      facts:[['Accepted sources','Preview chat, webhook, manual risk alert'],['Backend event','run.started'],['Writes','workflow_runs, run_events']],
      harness:[['trace','Trace capture','run_events'],['mask','PII handling','redacted before trace'],['branch','Workflow fallback',routeLine('workflow')]],
      caps:[['var(--brand)','customer_preview_chat','live'],['var(--t-tool)','risk_alert_webhook','ready'],['var(--harness)','pii_mask_guard','on']],
    },
    'n-intake':{
      purpose:'Customer Intake owns the guided form. The model can talk naturally, but the UI renders fields only from backend intake.schema and intake.update events.',
      runtime:'Schema runtime',
      routeType:'workflow',
      facts:[['Events','intake.schema, intake.update, case_state.updated'],['Required fields','9 customer scam-report details'],['Output','structured case_state']],
      harness:[['trace','Trace capture','case_state diffs'],['policy','Safety copy','OTP/card/login/remote-access warning'],['branch','Missing info route','awaiting_user']],
      caps:[['var(--brand)','customer_scam_intake_v1','schema'],['var(--ok)','choice chips + other text','on'],['var(--harness)','no regex prose parsing','enforced']],
    },
    'n-agent':{
      purpose:'The Investigator Agent is the customer-facing model turn. It uses server-side provider routing and receives structured case_state instead of raw chat only.',
      runtime:'LLM runtime',
      routeType:'model',
      facts:[['Primary provider',`${openai.name || 'OpenAI'} · ${openai.defaultModel || 'gpt-5.5'}`],['Fallback #1',`${local.name || 'Local GPT-OSS'} · ${local.defaultModel || 'gpt-oss:20b'}`],['Fallback #2',`${fireworks.name || 'Fireworks GPT-OSS'} · ${fireworks.defaultModel || 'accounts/fireworks/models/gpt-oss-120b'}`],['API mode','OpenAI Responses stream, then OpenAI-compatible chat']],
      harness:[['fallback','Model route',routeLine('model')],['clock','Timeout','connect 5s · read 45s'],['policy','Prompt guard','no refund promise'],['trace','Live stream','assistant.delta']],
      caps:[['var(--t-agent)','openai_responses_stream','primary'],['var(--t-agent)','openai_compatible_chat','fallback'],['var(--harness)','concise_customer_prompt','enforced']],
      prompt:'Customer-facing fraud support voice. Say we are working on evidence/policy. Do not promise refund, freeze, reversal, AML, or contact actions. Keep prose concise; intake UI asks structured questions.',
    },
    'n-tools':{
      purpose:'Evidence tools create the mocked employee-review evidence records now shown in My Tickets. They simulate DB, ledger, evidence vault, and graph lookups.',
      runtime:'Evidence runtime',
      routeType:'tool',
      facts:[['Primary source','Payments DB / Ledger API'],['Fallback route',routeLine('tool')],['Employee output','evidence_records[]']],
      harness:[['fallback','Tool fallback',routeLine('tool')],['db','Mock DB evidence','recipient, ledger, channel'],['eval','Replay gate','tool failure creates repair harness']],
      caps:[['var(--t-tool)','payments_db_counterparty','86%'],['var(--t-tool)','core_ledger_candidate','78%'],['var(--t-mcp)','risk_graph_signal','71%']],
    },
    'n-rag':{
      purpose:'Policy RAG grounds refund, freeze, AML, and customer-notification rules. It uses vector search when available and SQLite keyword fallback when Qdrant is down.',
      runtime:'RAG runtime',
      routeType:'workflow',
      facts:[['Embedding provider','Local FastEmbed or OpenAI embeddings'],['Vector store','Qdrant collection'],['Fallback','SQLite FTS keyword search'],['Ticket output','rag_context[] citations']],
      harness:[['rag','Grounding','policy citations required'],['fallback','RAG fallback','Qdrant → SQLite FTS'],['mask','PII redaction','before indexing']],
      caps:[['var(--t-rag)','refund_freeze_sop','grounded'],['var(--t-rag)','payment_rail_playbook','grounded'],['var(--t-rag)','scam_typology_rag','grounded']],
    },
    'n-class':{
      purpose:'The classifier scores refund likelihood and evidence coverage for the employee. Human decisions become labels for harness learning.',
      runtime:'Classifier runtime',
      routeType:'skill',
      facts:[['Model id','refund_pattern_classifier_v0.3'],['Approve threshold','≥70% refund probability and enough evidence'],['Manual threshold','40–69% or mixed evidence'],['Learning signal','classifier_feedback']],
      harness:[['gauge','Refund probability','0–100%'],['approval','Human label','approve/reject/escalate'],['capture','Learning loop','mismatch queues replay case']],
      caps:[['var(--t-agent)','evidence_coverage_score','live'],['var(--t-agent)','refund_probability','live'],['var(--harness)','human_alignment_accuracy','tracked']],
    },
    'n-policy':{
      purpose:'Safe-action gate blocks irreversible actions until the employee ticket has a human approval decision and audit trail.',
      runtime:'Policy gate',
      routeType:'workflow',
      facts:[['Blocked automation','refund, reversal, freeze, AML, customer-contact'],['Decision source','/api/workflow-runs/{run_id}/case-approval'],['Customer result','approved/rejected/escalated message']],
      harness:[['policy','Safe-action policy','human approval required'],['approval','Employee gate','My Tickets'],['file','Audit','approvals + audit_events']],
      caps:[['var(--harness)','safe_action_policy_pack','enforced'],['var(--t-approval)','human_approval_plugin','ready'],['var(--ok)','automated_refund_block','passed']],
    },
    'n-out':{
      purpose:'This node creates the employee-only My Tickets page entry. The customer preview never sees Approve/Reject controls.',
      runtime:'Ticket output',
      routeType:'workflow',
      facts:[['Collection','tickets'],['API','GET /api/tickets'],['Actions','Approve Refund, Reject, Escalate'],['Customer visibility','status message only']],
      harness:[['approval','Human action','employee-only'],['file','Packet contents','case, evidence, classifier, RAG'],['trace','Audit','approvals + audit_events']],
      caps:[['var(--t-approval)','fraudops_work_queue','live'],['var(--t-tool)','evidence_records_view','live'],['var(--t-agent)','classifier_panel','live']],
    },
    'n-cap':{
      purpose:'Harness learning compares the classifier recommendation with the employee decision and stores calibration metadata for future replay/eval.',
      runtime:'Learning feedback',
      routeType:'skill',
      facts:[['Collections','classifier_feedback, harness_learning'],['Match outcome','accuracy_confirmed'],['Mismatch outcome','learning_queued + replay case'],['Target metric','human_alignment_accuracy']],
      harness:[['capture','Feedback capture','decision mismatch'],['eval','Replay case','queued when disagreement'],['skill','Model improvement','feature-weight recommendation']],
      caps:[['var(--harness)','classifier_feedback_record','live'],['var(--harness)','harness_learning_record','live'],['var(--t-output)','replay_calibration_case','queued']],
    },
  };
  return specs[n.id] || {
    purpose:'This node inherits the default OpenSkillTrace harness: trace, fallback, policy, approval, eval, and audit.',
    runtime:'Runtime',
    routeType:'workflow',
    facts:[['Fallback','inherit route'],['Status','draft']],
    harness:[['trace','Trace','on'],['fallback','Fallback','inherit'],['policy','Policy','default']],
    caps:[['var(--harness)','default_harness','on']],
  };
}
window.renderInspector = function(nodeId){
  const n = D.flow.find(f=>f.id===nodeId) || D.flow.find(f=>f.id==='n-agent');
  const spec = nodeSpec(n);
  const isKnown = !String(n.id || '').startsWith('n-added-');
  let section = 1;
  let body = `
    <div class="inspPurpose">${ic('info')}<div>${esc(spec.purpose)}</div></div>
    <div class="inspNode">
      <div class="iIco bk-${n.t}">${ic(n.icon)}</div>
      <div><b>${esc(n.title)}</b><span>${esc(n.type)} · owner: RiskOps · synced</span></div>
      <span class="pill ok" style="margin-left:auto">healthy</span>
    </div>
    <div class="inspSection">
      <div class="isHd" data-acc><span class="num">${section++}</span> Step settings ${ic('chevd','chev')}</div>
      <div class="isBody">
        <div class="field"><label>Step name</label><input class="input" data-node-id="${esc(n.id)}" data-node-field="title" value="${esc(n.title)}"></div>
        <div class="field"><label>Description</label><textarea class="textarea" data-node-id="${esc(n.id)}" data-node-field="desc">${esc(n.desc||'')}</textarea></div>
        <div class="field"><label>Runtime / capability</label><input class="input mono" data-node-id="${esc(n.id)}" data-node-field="port" value="${esc(n.port||'')}"></div>
      </div>
    </div>
    <div class="inspSection">
      <div class="isHd" data-acc><span class="num">${section++}</span> ${esc(spec.runtime)} ${ic('chevd','chev')}</div>
      <div class="isBody">
        ${facts(spec.facts || [])}
        ${routePreview(spec.routeType)}
        <div class="inspActions">
          <button class="btn sm" data-goto="providers">${ic('provider')} Model Providers</button>
          <button class="btn sm" data-goto="fallback">${ic('fallback')} Fallback Center</button>
          ${n.id==='n-rag'?`<button class="btn sm" data-goto="rag">${ic('rag')} RAG Builder</button>`:''}
          ${n.id==='n-out'?`<button class="btn sm primary" data-goto="tickets">${ic('approval')} My Tickets</button>`:''}
        </div>
      </div>
    </div>
    <div class="inspSection harness">
      <div class="isHd" data-acc><span class="num">${section++}</span> Harness controls ${ic('chevd','chev')}</div>
      <div class="isBody">${harnessRows(spec.harness || [])}</div>
    </div>`;
  if(spec.prompt){
    body += `<div class="inspSection adv-only">
      <div class="isHd" data-acc><span class="num">${section++}</span> System prompt ${ic('chevd','chev')}</div>
      <div class="isBody"><div class="promptBox">${esc(spec.prompt)}</div></div>
    </div>`;
  }
  body += `<div class="inspSection">
      <div class="isHd" data-acc><span class="num">${section++}</span> Connected capabilities ${ic('chevd','chev')}</div>
      <div class="isBody">${capRows(spec.caps || [])}</div>
    </div>
    <div class="inspSection">
      <div class="isHd" data-acc><span class="num">${section++}</span> Evaluation before publish ${ic('chevd','chev')}</div>
      <div class="isBody">
        <div class="kv"><span class="k">Replay suite</span><span class="v" style="color:var(--ok)">${isKnown?'14 / 14 pass':'pending'}</span></div>
        <div class="kv"><span class="k">Graph sync</span><span class="v">provider · fallback · ticket · learning</span></div>
        <button class="btn harness sm" style="width:100%;margin-top:10px;justify-content:center" data-act="replay">${ic('play')} Run harness replay</button>
      </div>
    </div>`;
  return body;
};

/* ---------- OVERVIEW / OPS COMMAND ---------- */

function toneClass(tone){
  return ({ ok:'ok', warn:'warn', danger:'danger', info:'info', harness:'harness' })[tone] || 'info';
}
function severityClass(severity){
  return String(severity || '').toLowerCase();
}
function harnessClass(state){
  if(/quarantine/i.test(state)) return 'danger';
  if(/degraded/i.test(state)) return 'harness';
  if(/warning/i.test(state)) return 'warn';
  return 'ok';
}
function sparkline(points=[], tone='info'){
  const data = points.length ? points : [1,2,1,3,2,4];
  const min = Math.min(...data), max = Math.max(...data);
  const spread = Math.max(1, max - min);
  const path = data.map((p,i)=>{
    const x = data.length === 1 ? 0 : (i/(data.length-1))*92;
    const y = 28 - ((p - min)/spread)*24;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="opsSpark ${toneClass(tone)}" viewBox="0 0 92 32" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${path}"></polyline>
  </svg>`;
}
function filterIncidents(incidents, filter){
  if(filter === 'needs-action') return incidents.filter(i => !/acknowledge/i.test(i.nextAction));
  if(filter && filter !== 'all') return incidents.filter(i => severityClass(i.severity) === filter);
  return incidents;
}
function countFor(dashboard, filter){
  const counts = dashboard.incidentCounts || {};
  if(filter === 'needs-action') return counts.needsAction ?? filterIncidents(dashboard.incidents, filter).length;
  return counts[filter] ?? filterIncidents(dashboard.incidents, filter).length;
}
function renderProjectButton(project, selectedId){
  const selected = project.id === selectedId;
  return `<button class="opsProject${selected ? ' active' : ''}" type="button" data-project-id="${esc(project.id)}">
    <span class="opsAvatar" data-tone="${esc(project.tone)}">${esc(project.badge)}</span>
    <span><b>${esc(project.shortName || project.name)}</b><small>${esc(project.subtitle)}</small></span>
    ${selected ? `<i>${ic('check')}</i>` : ''}
  </button>`;
}
function renderMetric(metric, dashboard){
  const isEnv = metric.key === 'environment';
  return `<div class="opsMetric" data-tone="${esc(metric.tone)}">
    <span>${esc(metric.label)}</span>
    <b class="tnum">${esc(metric.value)}</b>
    <em>${esc(metric.delta)}</em>
    ${isEnv ? `<button class="opsEnv" type="button">${esc(metric.value)} ${ic('chevd')}</button>` : sparkline(dashboard.sparklines?.[metric.spark], metric.tone)}
  </div>`;
}
function renderIncidentRow(incident){
  const actionLabel = incident.route === 'overview' ? 'Acknowledge' : 'Review';
  return `<tr>
    <td class="mono">${esc(incident.id)}</td>
    <td><span class="opsSeverity ${severityClass(incident.severity)}">${esc(incident.severity)}</span></td>
    <td class="opsAge">${esc(incident.age)}</td>
    <td>${esc(incident.workflow)}</td>
    <td><span class="opsHarness ${harnessClass(incident.harnessState)}">${ic(harnessClass(incident.harnessState)==='ok'?'checkc':'alert')}${esc(incident.harnessState)}</span></td>
    <td>${esc(incident.nextAction)}</td>
    <td><button class="btn sm" data-open-workflow="${esc(incident.route)}" data-incident-id="${esc(incident.id)}">${actionLabel}</button></td>
  </tr>`;
}
function renderApprovalRow(approval){
  return `<tr>
    <td class="mono">${esc(approval.id)}</td>
    <td>${esc(approval.type)}</td>
    <td>${esc(approval.requestedBy)}</td>
    <td class="opsAge">${esc(approval.age)}</td>
    <td><button class="btn sm" data-approval-action="approve" data-approval-id="${esc(approval.id)}">${esc(approval.action)}</button></td>
  </tr>`;
}

Views.overview = function(){
  const project = window.OST?.currentProject?.() || D.projects?.[0];
  const dashboard = window.OST?.currentProjectDashboard?.() || D.projectDashboards?.[project?.id] || D.projectDashboards?.['monee-fraudops'];
  const selectedId = project?.id || 'monee-fraudops';
  const filter = window.OST?.opsDashboardState?.incidentFilter || 'all';
  const incidents = filterIncidents(dashboard.incidents || [], filter);
  const filters = [
    ['all','All'],
    ['critical','Critical'],
    ['high','High'],
    ['medium','Medium'],
    ['low','Low'],
    ['needs-action','Needs Action'],
  ];

  const projectSelector = (D.projects || []).map(p => renderProjectButton(p, selectedId)).join('');
  const metricStrip = (dashboard.metrics || []).map(m => renderMetric(m, dashboard)).join('');
  const filterBar = filters.map(([id,label]) => `<button class="${filter===id?'active':''}" type="button" data-incident-filter="${id}">
    ${esc(label)} <span>${countFor(dashboard,id)}</span>
  </button>`).join('');
  const incidentRows = incidents.map(renderIncidentRow).join('');
  const approvalRows = (dashboard.approvals || []).slice(0,5).map(renderApprovalRow).join('');
  const timeline = (dashboard.timeline || []).map(event => `<div class="opsEvent" data-tone="${esc(event.tone)}">
    <span class="tnum">${esc(event.time)}</span><i></i><p>${esc(event.text)}</p><code>${esc(event.run)}</code>
  </div>`).join('');
  const recovery = (dashboard.recoveryServices || []).map(service => `<div class="opsRecoveryRow">
    <span>${esc(service.name)}</span>
    <b class="${toneClass(service.tone)}">${esc(service.status)}</b>
    ${sparkline(dashboard.sparklines?.[service.spark], service.tone)}
    <em class="tnum">${esc(service.value)}</em>
  </div>`).join('');

  return `<div class="opsCommand">
    <section class="opsMissionBar" aria-label="Project mission selector">
      <div class="opsMissionTitle">Select Project (Mission) ${ic('info')}</div>
      <div class="opsProjectGrid">${projectSelector}</div>
    </section>

    <section class="opsProjectHeader" aria-label="Selected project status">
      <div class="opsSelected">
        <span class="opsAvatar big" data-tone="${esc(project.tone)}">${esc(project.badge)}</span>
        <div><h1>${esc(project.name)}</h1><p>${esc(project.subtitle)}</p></div>
        <button class="iconbtn" type="button" data-project-id="${esc(project.id)}" title="Project menu">${ic('chevd')}</button>
      </div>
      <div class="opsMetrics">${metricStrip}</div>
    </section>

    <section class="opsDashboardGrid">
      <div class="opsPanel opsIncidentPanel">
        <div class="opsPanelHead">
          <div><h2>Incident Queue <span>${countFor(dashboard,'all')}</span></h2></div>
          <div class="opsPanelTools">
            <span>Auto-refresh</span><button class="opsToggle on" type="button" aria-label="Auto refresh on"></button>
            <button class="iconbtn" type="button" title="Filter">${ic('filter')}</button>
            <button class="iconbtn" type="button" title="Columns">${ic('grid')}</button>
            <button class="iconbtn" type="button" title="Export">${ic('download')}</button>
          </div>
        </div>
        <div class="opsFilters">${filterBar}</div>
        <div class="opsTableWrap">
          <table class="opsTable">
            <thead><tr><th>ID</th><th>Severity</th><th>Age</th><th>Affected Workflow</th><th>Harness State</th><th>Next Required Human Action</th><th></th></tr></thead>
            <tbody>${incidentRows || `<tr><td colspan="7" class="opsEmpty">No incidents match this filter.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="opsTableFoot">
          <span>Showing 1-${incidents.length} of ${countFor(dashboard,filter)}</span>
          <div class="opsPager"><button disabled>${ic('chev')}</button><button class="active">1</button><button>2</button><button>3</button><button>4</button><button>5</button><span>...</span><button>7</button><button>${ic('chev')}</button></div>
        </div>
      </div>

      <aside class="opsRail" aria-label="Operations rail">
        <div class="opsPanel">
          <div class="opsPanelHead tight"><h2>Pending Approvals <span>${esc((dashboard.metrics || [])[4]?.value || dashboard.approvals.length)}</span></h2><button class="linkBtn" type="button">View All</button></div>
          <table class="opsMiniTable"><thead><tr><th>ID</th><th>Type</th><th>Requested By</th><th>Age</th><th>Action</th></tr></thead><tbody>${approvalRows}</tbody></table>
          <button class="linkBtn right" type="button">View All</button>
        </div>
        <div class="opsPanel">
          <div class="opsPanelHead tight"><h2>Live Run Timeline</h2><button class="linkBtn" type="button">View Runs</button></div>
          <div class="opsTimeline">${timeline}</div>
          <button class="linkBtn" type="button">View full timeline</button>
        </div>
        <div class="opsPanel">
          <div class="opsPanelHead tight"><h2>Harness Recovery Status</h2><button class="linkBtn" type="button" data-open-workflow="studio">Open Workflow Studio</button></div>
          <div class="opsRecovery">${recovery}</div>
          <div class="opsRailFoot">Metrics: Success rate (last 24h)<span>Updated 10:42:20 ${ic('refresh')}</span></div>
        </div>
      </aside>
    </section>
  </div>`;
};

/* ---------- TEMPLATES ---------- */
Views.templates = function(){
  const active = window.OST?.activeWorkflow;
  const cards = D.templates.map((t,i)=>{
    const tone = t.st === 'ok' ? 'output' : t.st === 'warn' ? 'harness' : 'input';
    const steps = t.flow.split('→').map(s=>s.trim()).filter(Boolean);
    return `<article class="templateCard" data-template-name="${esc(t.name)}">
      <div class="templateCardTop">
        <div class="templateMark bk-${tone}">${ic(t.icon)}</div>
        <span class="pill ${t.st==='ok'?'live':t.st==='warn'?'draft':'info'}">${esc(t.status)}</span>
      </div>
      <h2>${esc(t.name)}</h2>
      <p>${esc(t.flow)}</p>
      <div class="templateSteps">
        ${steps.map((step,idx)=>`<span>${idx ? ic('arrow') : ''}<b>${esc(step)}</b></span>`).join('')}
      </div>
      <div class="templateMeta">
        <span>${ic('layers')} Harness policy included</span>
        <span>${ic('eval')} Replay starter suite</span>
      </div>
      <div class="templateActions">
        <button class="btn primary" data-act="use-template" data-template-index="${i}">${ic('plus')} Use template</button>
        <button class="btn" data-goto="studio">${ic('studio')} Open Studio</button>
      </div>
    </article>`;
  }).join('');
  return `<div class="wrap templatesPage">
    <section class="templateHero">
      <div>
        <div class="eyebrow">${ic('template')} Workflow templates</div>
        <h1>Start governed workflows from proven FraudOps patterns</h1>
        <p>Templates create a real workflow in Studio, including connected nodes, harness policy metadata, replay-ready defaults, and a saveable backend record Codex can update through MCP.</p>
      </div>
      <div class="templateHeroPanel">
        <span>Current workspace</span>
        <b>${esc(active?.name || 'No active workflow')}</b>
        <small>${esc(window.OST?.workflows?.length || 0)} saved workflows available</small>
        <button class="btn harness" data-goto="studio">${ic('studio')} Manage in Studio</button>
      </div>
    </section>
    <section class="templateWorkbench">
      <div class="templateShelf">
        <div class="sectionhd"><h3>Template library</h3><span class="hint">${D.templates.length} starters</span></div>
        <div class="templateGrid">${cards}</div>
      </div>
      <aside class="templateGuide">
        <div class="sectionhd"><h3>What gets generated</h3></div>
        ${[
          ['studio','Workflow graph','Nodes and links are created immediately in Studio.'],
          ['policy','Harness layer','Trace, fallback, policy, approval, and audit metadata ride with every step.'],
          ['file','Backend record','The new workflow is saved through /api/workflows for frontend and MCP use.'],
          ['eval','Replay baseline','Validation and replay controls are ready from the first draft.'],
        ].map(row=>`<div class="templateGuideRow"><div class="rico bk-input">${ic(row[0])}</div><div><b>${row[1]}</b><span>${row[2]}</span></div></div>`).join('')}
      </aside>
    </section>
  </div>`;
};

/* ---------- MY TICKETS ---------- */
Views.tickets = function(){
  const tickets = window.OST?.tickets || [];
  const activeId = window.OST?.activeTicketId;
  const active = tickets.find(t=>t.id===activeId) || tickets[0];
  const statusLabel = status => ({
    pending_employee_approval:'Pending approval',
    refund_approved:'Refund approved',
    refund_rejected:'Rejected',
    escalated:'Escalated',
    approved:'Approved',
    rejected:'Rejected',
  }[status] || status || 'Pending');
  const pillClass = status => /approved/.test(status||'') ? 'ok' : /rejected|escalated/.test(status||'') ? 'warn' : 'info';
  const decisionLabel = decision => ({
    approve_refund:'Approve refund',
    reject:'Reject',
    escalate:'Escalate',
    manual_review:'Manual review',
    reject_or_request_more_evidence:'Request more evidence',
  }[decision] || decision || 'Manual review');
  const list = tickets.length ? tickets.map(t=>{
    const summary = t.summary || {};
    const classifier = t.classification || t.approval_packet?.classification || {};
    const selected = (active?.id || activeId) === t.id;
    return `<button class="ticketRow ${selected?'active':''}" data-ticket-id="${esc(t.id)}">
      <div class="ticketRowTop"><b>${esc(t.title || `${summary.amount || 'Claim'} refund review`)}</b><span class="pill ${pillClass(t.status)}">${esc(statusLabel(t.status))}</span></div>
      <div class="ticketMeta"><span>${ic('money')} ${esc(summary.amount || 'amount unknown')}</span><span>${ic('approval')} ${esc(t.queue || 'FraudOps')}</span></div>
      ${classifier.refund_probability != null ? `<div class="ticketMeta"><span>${ic('gauge')} Agent refund confidence ${esc(classifier.refund_probability)}%</span></div>` : ''}
      <div class="ticketSub">${esc(summary.scam_type || 'Scam claim')} · ${esc(summary.platform || 'channel unknown')} · ${esc(t.customer_status || 'Waiting')}</div>
    </button>`;
  }).join('') : `<div class="ticketEmpty">${ic('approval')}<b>No tickets yet</b><span>Run Preview until all required customer details are collected. The approval packet will appear here automatically.</span></div>`;

  const detail = active ? (()=>{
    const packet = active.approval_packet || {};
    const summary = active.summary || packet.summary || {};
    const checks = packet.status_checks || [];
    const classifier = active.classification || packet.classification || {};
    const evidenceRecords = active.evidence_records || packet.evidence_records || [];
    const ragContext = active.rag_context || packet.rag_context || [];
    const learning = active.harness_learning || packet.harness_learning || {};
    const feedback = packet.classifier_feedback || active.classifier_feedback || {};
    const refundPct = Math.max(0, Math.min(100, Number(classifier.refund_probability || 0)));
    const coveragePct = Math.max(0, Math.min(100, Number(classifier.evidence_coverage || 0)));
    const rec = classifier.recommended_decision || classifier.recommendation || 'manual_review';
    const recTone = rec === 'approve_refund' ? 'ok' : rec === 'reject' ? 'danger' : 'warn';
    const rows = [
      ['Amount', summary.amount],
      ['When', summary.when],
      ['Payment method', summary.payment_method],
      ['Scam type', summary.scam_type],
      ['Where', summary.platform],
      ['Recipient', summary.recipient],
      ['Additional payment', summary.additional_payment],
      ['Requested action', summary.requested_action],
      ['Evidence', Array.isArray(summary.evidence) ? summary.evidence.join(', ') : summary.evidence],
      ['Sensitive info', Array.isArray(summary.sensitive_info) ? summary.sensitive_info.join(', ') : summary.sensitive_info],
    ].filter(([,v])=>v);
    const disabled = ['refund_approved','refund_rejected','escalated'].includes(active.status) || ['approved','rejected','escalated'].includes(packet.status);
    const approveLabel = active.status === 'refund_approved' || packet.status === 'approved' ? 'Refund Approved' : 'Approve Refund';
    const rejectLabel = active.status === 'refund_rejected' || packet.status === 'rejected' ? 'Rejected' : 'Reject';
    const escalateLabel = active.status === 'escalated' || packet.status === 'escalated' ? 'Escalated' : 'Escalate';
    return `<div class="ticketDetail">
      <div class="ticketDetailHead">
        <div><div class="eyebrow">${ic('approval')} Employee approval ticket</div><h1>${esc(active.title || 'Refund approval')}</h1><p>${esc(active.customer_status || 'Waiting for employee approval')}</p></div>
        <span class="pill ${pillClass(active.status)}">${esc(statusLabel(active.status))}</span>
      </div>
      <div class="ticketKpis">
        <div><span>Priority</span><b>${esc(active.priority || 'standard')}</b></div>
        <div><span>Evidence items</span><b>${esc(active.evidence_count ?? evidenceRecords.length ?? 0)}</b></div>
        <div><span>Agent refund confidence</span><b>${esc(refundPct)}%</b></div>
        <div><span>Evidence coverage</span><b>${esc(coveragePct)}%</b></div>
        <div><span>Assignee</span><b>${esc(active.assignee || 'Unassigned')}</b></div>
      </div>
      <div class="ticketSection classifier">
        <h3>Agent classification</h3>
        <div class="classifierPanel">
          <div class="classifierScore"><span>Refund confidence</span><b>${esc(refundPct)}%</b><i style="--p:${refundPct}%"></i></div>
          <div class="classifierScore coverage"><span>Evidence coverage</span><b>${esc(coveragePct)}%</b><i style="--p:${coveragePct}%"></i></div>
          <div class="classifierDecision"><span class="pill ${recTone}">${esc(decisionLabel(rec))}</span><p>${esc(classifier.label || 'The classifier needs employee review before any refund action.')}</p></div>
        </div>
        ${(classifier.factors || []).length ? `<div class="classifierFactors">${classifier.factors.map(f=>`<div><b>${esc(f.label)}</b><span>${esc(f.impact > 0 ? `+${f.impact}` : f.impact)} · ${esc(f.detail)}</span></div>`).join('')}</div>` : ''}
      </div>
      <div class="ticketSection"><h3>Customer information</h3><div class="ticketInfoGrid">${rows.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div></div>
      <div class="ticketSection">
        <h3>Evidence records</h3>
        <div class="ticketEvidenceGrid">${evidenceRecords.length ? evidenceRecords.map(ev=>`<details class="ticketEvidence">
          <summary><span>${ic(ev.record_type === 'transaction' ? 'money' : ev.record_type === 'pattern_signal' ? 'graph' : ev.record_type === 'counterparty' ? 'db' : 'file')}<b>${esc(ev.title)}</b></span><em>${esc(ev.confidence || 0)}%</em></summary>
          <div class="ticketEvidenceBody"><p>${esc(ev.summary)}</p><div><span>Source</span><b>${esc(ev.source)}</b></div><div><span>Status</span><b>${esc(ev.status)}</b></div><p>${esc(ev.detail)}</p></div>
        </details>`).join('') : `<div class="ticketEmpty inline">${ic('file')}<b>No evidence records yet</b><span>The workflow will attach DB/RAG evidence metadata when the approval packet is created.</span></div>`}</div>
      </div>
      <div class="ticketSection">
        <h3>RAG and policy grounding</h3>
        <div class="ticketRagList">${ragContext.length ? ragContext.map(src=>`<div class="ticketRag"><span>${ic('rag')}</span><div><b>${esc(src.source)}</b><small>${esc(src.citation)} · ${esc(src.status)}</small><p>${esc(src.summary)}</p></div></div>`).join('') : `<div class="ticketEmpty inline">${ic('rag')}<b>No policy sources</b><span>Upload or index SOP sources in RAG Builder to ground this step.</span></div>`}</div>
      </div>
      <div class="ticketSection"><h3>Status checks</h3><div class="ticketChecks">${checks.map(c=>`<div class="ticketCheck ${esc(c.status || 'pending')}">${ic(c.status==='passed'?'check':c.status==='review'?'alert':'clock')}<span>${esc(c.name)}</span><b>${esc(c.status || 'pending')}</b></div>`).join('')}</div></div>
      <div class="ticketSection policy"><h3>Policy gate</h3><p>${esc(packet.policy?.reason || 'Refund, reversal, freeze, and customer-contact actions require employee approval and audit trail.')}</p></div>
      <div class="ticketSection learning">
        <h3>Harness learning</h3>
        <div class="learningPanel">
          <span class="pill ${feedback.agreement === true ? 'ok' : feedback.agreement === false ? 'warn' : 'info'}">${esc(feedback.accuracy_label || learning.status || 'awaiting human decision')}</span>
          <p>${esc(learning.summary || 'The harness will compare the employee decision with the classifier recommendation and create a calibration signal if they disagree.')}</p>
          ${learning.recommended_update ? `<small>${esc(learning.recommended_update)}</small>` : ''}
        </div>
      </div>
      <div class="ticketActions">
        <button class="btn" data-act="ticket-telegram-call" data-ticket-id="${esc(active.id)}">${ic('bell')} Send War Room Call</button>
        <button class="btn" data-act="case-escalate" data-run-id="${esc(active.run_id)}" ${disabled?'disabled':''}>${ic('arrow')} ${esc(escalateLabel)}</button>
        <button class="btn" data-act="case-reject" data-run-id="${esc(active.run_id)}" ${disabled?'disabled':''}>${ic('x')} ${esc(rejectLabel)}</button>
        <button class="btn primary" data-act="case-approve-refund" data-run-id="${esc(active.run_id)}" ${disabled?'disabled':''}>${ic('check')} ${esc(approveLabel)}</button>
      </div>
    </div>`;
  })() : `<div class="ticketDetail empty"><div class="ticketEmpty">${ic('approval')}<b>No ticket selected</b><span>Approval tickets created by Workflow Preview will show the combined customer details, evidence status, policy checks, and employee actions.</span></div></div>`;

  return `<div class="wrap ticketsPage">
    <div class="pagehead compact">
      <div><div class="eyebrow">${ic('approval')} FraudOps work queue</div><h1>My Tickets</h1><p>Employee view for scam-claim refund reviews. Each ticket is created from the workflow approval packet.</p></div>
      <div class="actions"><button class="btn" data-act="tickets-refresh">${ic('refresh')} Refresh</button><button class="btn primary" data-goto="studio">${ic('play')} Run Preview</button></div>
    </div>
    <div class="ticketsShell">
      <aside class="ticketsList"><div class="ticketListHead"><b>Queue</b><span>${tickets.length} ticket${tickets.length===1?'':'s'}</span></div>${list}</aside>
      ${detail}
    </div>
  </div>`;
};

/* ---------- WORKFLOW STUDIO (full-page free canvas) ---------- */
Views.studio = function(options = {}){
  const embedded = !!options.embedded;
  const harnessOn = options.harnessOn !== false;
  const sum = window.OST?.workflowSummary?.() || {nodes:D.flow.length,edges:D.edges.length};
  const lastSaved = window.OST?.state?.lastSaved || 'not saved yet';
  const initialNode = D.flow.find(n=>n.selected) || D.flow.find(n=>n.id==='n-agent') || D.flow[0];
  const workflows = window.OST?.workflows || [];
  const activeWorkflow = window.OST?.activeWorkflow || workflows[0] || {id:'default', name:'Scam Transaction Response'};
  const workflowOptions = workflows.map(w=>`<option value="${esc(w.id)}" ${w.id===activeWorkflow.id?'selected':''}>${esc(w.name || w.id)}</option>`).join('');
  const palette = D.blocks.map(g=>`
    <div class="palGroupLbl">${g.grp}</div>
    ${g.items.map(b=>`<div class="block" draggable="true" data-block="${b.id}" data-type="${b.t}">
      <span class="grip">${ic('drag')}</span>
      <div class="bTop"><div class="bIco bk-${b.t}">${ic(b.icon)}</div><b>${b.name}</b><span class="bKind bk-${b.t}">${b.kind}</span></div>
      <p>${b.desc}</p></div>`).join('')}
  `).join('');

  const nodes = D.flow.map(window.renderGNode).join('');

  const legendTypes = [['input','Trigger'],['agent','Agent'],['tool','Tool / MCP'],['rag','RAG'],['harness','Policy'],['output','Output']];
  const legend = legendTypes.map(t=>`<div class="lgRow"><i style="background:var(--t-${t[0]})"></i>${t[1]}</div>`).join('');

  return `<div class="studioFull${embedded ? ' warroomStudio' : ''}${harnessOn ? ' harness-on' : ''}" id="studioFull"${embedded ? ' data-embedded-studio="warroom"' : ''}>
    <!-- pannable canvas -->
    <div class="gcanvas" id="gcanvas">
      <div class="gviewport" id="gviewport">
        <svg class="wireLayer" id="wireLayer" viewBox="0 0 3000 1700" preserveAspectRatio="none"></svg>
        ${nodes}
      </div>
    </div>

    <!-- floating toolbar -->
    <div class="gtoolbar commandRibbon">
      <div class="workflowIdentity">
        <span class="tIco">${ic('money')}</span>
        <div><b>${esc(activeWorkflow.name || activeWorkflow.id)}</b><small id="studioSaveState">${sum.nodes} nodes · ${sum.edges} links · ${lastSaved}</small></div>
      </div>
      <label class="workflowPicker"><span>Workflow</span><select class="workflowSelect" data-workflow-select aria-label="Select workflow">${workflowOptions || `<option value="default">Scam Transaction Response</option>`}</select></label>
      <div class="toolbarGroup manage">
        <button class="btn sm ghost" data-act="new-workflow" title="New workflow">${ic('plus')} New</button>
        <button class="btn sm ghost danger" data-act="delete-workflow" title="Delete workflow">${ic('trash')} Delete</button>
        <button class="btn sm ghost" data-act="save-workflow" title="Save workflow">${ic('file')} Save</button>
      </div>
      <div class="toolbarGroup quality">
        <button class="btn sm ghost" data-act="validate" title="Validate workflow">${ic('check')} Validate</button>
        <button class="btn sm ghost" data-act="replay" title="Run replay">${ic('play')} Replay</button>
        <button class="btn sm harness" data-modal="fallback-drill" title="Run fallback drill">${ic('fallback')} Fallback Test</button>
      </div>
      <div class="toolbarGroup run">
        <button class="btn sm primary" data-act="open-preview">${ic('play')} Preview</button>
        <button class="hToggleBtn ${harnessOn ? 'on' : 'off'}" id="hToggle" title="Show / hide harness overlay">${ic('layers')} Harness <span class="sw"></span></button>
        <button class="btn sm primary publishBtn" data-modal="publish">${ic('upload')} Publish</button>
      </div>
    </div>

    <!-- palette -->
    <aside class="gpanel gpalette" id="gpalette">
      <div class="gpHd"><div class="pt"><b>Block library</b><small>Drag onto the canvas</small></div>
        <button class="iconbtn collapse" data-collapse="gpalette" title="Collapse">${ic('chev')}</button></div>
      <div class="gpBody">
        <div class="palette">
          <div class="paletteSearch">${ic('search')}<input placeholder="Search blocks…"></div>
          <div class="palTabs"><button class="active">All</button><button>Input</button><button>Agent</button><button>Tools</button><button>Harness</button><button>RAG</button></div>
          <div class="palHint">${ic('info')}<div>Drag a block anywhere, then drag from a node's <b>right port</b> to connect it.</div></div>
          <div class="palList">${palette}</div>
        </div>
      </div>
    </aside>

    <!-- inspector -->
    <aside class="gpanel ginspector" id="ginspector">
      <div class="gpHd"><div class="pt"><b id="panelTitle">Harness Inspector</b><small id="inspSel">Investigator Agent</small></div>
        <button class="btn sm ghost" data-act="open-preview">${ic('play')} Preview</button>
        <button class="iconbtn collapse" data-collapse="ginspector" title="Collapse">${ic('chev')}</button></div>
      <div class="gpBody"><div class="inspBody" id="inspBody">${initialNode ? window.renderInspector(initialNode.id) : window.renderInspector()}</div></div>
    </aside>

    <!-- zoom controls -->
    <div class="gzoom">
      <button data-zoom="out" title="Zoom out"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
      <span class="zlvl" id="zlvl">100%</span>
      <button data-zoom="in" title="Zoom in">${ic('plus')}</button>
      <button data-zoom="fit" title="Fit to screen">${ic('scale')}</button>
    </div>

    <!-- legend -->
    <div class="glegend">
      <div class="lgT">Block types</div>
      ${legend}
      <div class="lgHint">Drag canvas to pan · scroll to zoom · drag nodes to arrange freely.</div>
    </div>
  </div>`;
};

/* ---------- CATALOGS ---------- */
Views.catalog = function(){
  const tabs = D.catTabs.map((t,i)=>`<button class="${i===0?'active':''}" data-cattab="${t.id}">${t.label}<span class="cnt">${t.n}</span></button>`).join('');
  const cards = D.catalog.map(c=>`<div class="card pad catCard" data-cat="${c.type}" data-name="${c.name}" style="display:flex;flex-direction:column;gap:11px">
    <div style="display:flex;align-items:flex-start;gap:11px">
      <div class="rico bk-${c.t}" style="width:40px;height:40px;border-radius:11px">${ic(c.icon)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><b class="mono" style="font-size:13px">${c.name}</b></div>
        <div style="display:flex;gap:6px;margin-top:4px"><span class="tag">${c.domain}</span><span class="tag">${c.type.toUpperCase()}</span></div>
      </div>
      <span class="pill ${c.st==='ok'?'ok':c.st==='warn'?'warn':'info'}">${c.status}</span>
    </div>
    <p style="font-size:12.5px;color:var(--muted);line-height:1.45">${c.desc}</p>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--muted)">
      <span class="pill" style="height:22px">${ic('gauge')} eval ${c.eval}%</span>
      <span class="pill" style="height:22px">${ic('lock')} ${c.perm}</span>
      <span class="tag">${c.owner} · ${c.ver}</span>
    </div>
    <div style="display:flex;gap:8px;margin-top:2px">
      <button class="btn sm" style="flex:1;justify-content:center" data-act="catalog-action">${ic('plus')} ${c.action}</button>
      <button class="btn sm icon" title="Details">${ic('info')}</button>
    </div>
  </div>`).join('');

  const fGroup = (title, opts)=>`<div style="margin-bottom:16px"><b style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)">${title}</b>
    <div style="margin-top:8px;display:flex;flex-direction:column;gap:7px">${opts.map((o,i)=>`<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink-2);cursor:pointer"><input type="checkbox" ${i<2?'checked':''} style="accent-color:var(--harness)"> ${o}</label>`).join('')}</div></div>`;

  return `<div class="wrap">
    <div class="pagehead">
      <div><div class="eyebrow">${ic('catalog')} Unified catalog</div>
        <h1>Skill, Tool, Plugin, MCP & RAG catalog</h1>
        <p>Search governed capabilities, then drag onto the canvas — each carries permission, eval score, owner, version & fallback compatibility.</p></div>
      <div class="actions">
        <button class="btn" data-modal="import">${ic('download')} Import from Dify / Lyzr / Portkey</button>
        <button class="btn primary" data-modal="publish-cat">${ic('upload')} Publish to catalog</button>
      </div>
    </div>
    <div class="tabs" style="margin-bottom:16px">${tabs}</div>
    <div style="display:grid;grid-template-columns:212px 1fr;gap:18px;align-items:start">
      <aside class="card pad" style="position:sticky;top:0">
        <div class="search" style="max-width:none;margin-bottom:14px">${ic('search')} Search catalog…</div>
        ${fGroup('Type',['Skills','Tools','MCP servers','Plugins','RAG sources'])}
        ${fGroup('Domain',['FraudOps','RiskOps','Payments','Shared'])}
        ${fGroup('Governance',['Approved','Read-only','Needs review'])}
      </aside>
      <div class="grid g3" id="catGrid" style="grid-template-columns:repeat(auto-fill,minmax(255px,1fr))">${cards}</div>
    </div>
  </div>`;
};

/* ---------- RAG BUILDER ---------- */
Views.rag = function(){
  return `<div class="wrap">
    <div class="pagehead">
      <div><div class="eyebrow">${ic('rag')} Governed operational knowledge</div>
        <h1>RAG Builder</h1>
        <p>Upload operational documents, index redacted chunks, search cited evidence, and verify grounding before a workflow relies on the source.</p></div>
      <div class="actions"><button class="btn" data-act="ground-eval">${ic('eval')} Run grounding eval</button><button class="btn primary" data-modal="add-source">${ic('plus')} Add source</button></div>
    </div>
    <div class="grid" style="grid-template-columns:1.3fr 1fr;align-items:start">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card pad">
          <div class="sectionhd"><h3>Knowledge sources</h3><span class="pill ok" id="ragIndexedCount">0 indexed</span></div>
          <div class="field" style="margin-bottom:12px"><label>Active workflow / RAG node</label><div class="kv" style="margin-bottom:8px"><span class="k">Workflow</span><span class="v" id="ragWorkflowName">Loading workflow</span></div><select class="select" id="ragNodeFilter"><option value="">Loading RAG nodes...</option></select></div>
          <div id="ragSources"><div class="ragEmpty">${ic('clock')}<b>Loading sources</b><span>Checking the RAG index.</span></div></div>
        </div>
        <div class="card pad">
          <div class="sectionhd"><h3>Search cited evidence</h3><span class="pill info" id="ragLastSearchStatus">ready</span></div>
          <div class="ragSearchBar">
            <input class="input" id="ragQuery" placeholder="Search SOPs, policies, prior cases...">
            <select class="select" id="ragTopK"><option value="4">Top 4</option><option value="8" selected>Top 8</option><option value="12">Top 12</option></select>
            <button class="btn primary" data-act="rag-search">${ic('search')} Search</button>
          </div>
          <div class="field adv-only"><label>Source filter</label><select class="select" id="ragSourceFilter"><option value="">All indexed sources</option></select></div>
          <div id="ragResults"></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card pad">
          <div class="sectionhd"><h3>RAG node settings</h3></div>
          <div class="field"><label>Embedding provider</label><select class="select" id="ragProvider"><option value="local">Local FastEmbed</option><option value="openai">OpenAI embeddings</option></select></div>
          <div class="field"><label>Local model</label><input class="input mono" id="ragLocalModel" value="BAAI/bge-small-en-v1.5"></div>
          <div class="field"><label>OpenAI model</label><input class="input mono" id="ragOpenaiModel" value="text-embedding-3-small"></div>
          <div class="kv"><span class="k">Collection</span><span class="v mono" id="ragCollection">openskilltrace_rag_local_bge_small_en_v15</span></div>
          <div class="kv"><span class="k">Qdrant</span><span id="ragQdrant" class="pill warn">checking</span></div>
          <div class="field"><label>Grounding policy ${ic('layers','')}</label><textarea class="textarea">Every recommendation must cite ≥2 SOP / policy sources. If unsupported, output uncertainty and ask a human.</textarea></div>
          <button class="btn" data-act="rag-save-config" style="width:100%;justify-content:center">${ic('check')} Save settings</button>
        </div>
        <div class="card pad" style="border-color:var(--harness-line);background:var(--harness-bg)">
          <div class="sectionhd"><h3 style="color:var(--harness-ink)">${ic('fallback','')} RAG fallback</h3><span id="ragFallbackStatus" class="pill info">checking</span></div>
          <div class="route"><span class="hop primary"><span class="n">1</span>Vector DB</span>${ic('arrow','arr')}<span class="hop"><span class="n">2</span>Keyword index</span>${ic('arrow','arr')}<span class="hop"><span class="n">3</span>Cached SOP</span>${ic('arrow','arr')}<span class="hop human"><span class="n">4</span>Ask senior analyst</span></div>
          <div class="hintline" id="ragFallbackReason" style="color:var(--harness-ink)">Waiting for index health.</div>
        </div>
        <div class="card pad">
          <div class="sectionhd"><h3>Grounding eval</h3><span class="hint">FraudOps fixed suite</span></div>
          <div id="ragEvalResults"><div class="hintline">No eval run yet.</div></div>
        </div>
      </div>
    </div>
  </div>`;
};

})();
