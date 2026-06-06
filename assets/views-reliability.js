/* ===== Views: Model Providers, Fallback Center, Eval & Replay, Governance ===== */
(function(){
const D = window.DATA, ic = window.icon;
window.Views = window.Views || {};
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

/* ---------- MODEL PROVIDERS ---------- */
Views.providers = function(){
  const providerTags = p => (p.types || ['LLM']).map(t=>`<span class="tag">${t}</span>`).join('');
  const connected = D.providers.filter(p=>p.st==='ok').length;
  const available = D.providers.length - connected;
  const cards = D.providers.map(p=>`<div class="card pad providerCard" style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;align-items:center;gap:11px">
      <div class="rico" style="background:${p.color}1a;color:${p.color};font-weight:800">${p.icon}</div>
      <div style="flex:1;min-width:0"><b style="font-size:14px">${p.name}</b><div style="font-size:11.5px;color:var(--muted)">${p.note}</div></div>
      <span class="pill ${p.st==='ok'?'ok':'draft'}">${p.status}</span>
    </div>
    <div style="font-size:12px;color:var(--muted);line-height:1.4">${p.models}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${providerTags(p)}</div>
    <div class="providerFacts">
      <span><b>Default model</b>${p.defaultModel || 'Configure model'}</span>
      <span><b>API base</b>${p.apiBase || 'Provider endpoint'}</span>
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap">
      <span class="pill" style="height:23px">${ic('key')} ${p.keys} key${p.keys===1?'':'s'}</span>
      <span class="pill" style="height:23px">${ic('clock')} ${p.latency}</span>
    </div>
    <div style="display:flex;gap:8px">
      ${p.st==='ok'?`<button class="btn sm" style="flex:1;justify-content:center" data-modal="provider-keys" data-provider="${p.id}">${ic('sliders')} Configure</button>`
        :`<button class="btn sm primary" style="flex:1;justify-content:center" data-modal="provider-keys" data-provider="${p.id}">${ic('plus')} Connect</button>`}
    </div>
  </div>`).join('');

  return `<div class="wrap">
    <div class="pagehead">
      <div><div class="eyebrow">${ic('provider')} Provider gateway</div>
        <h1>Model Providers</h1>
        <p>Connect providers once, store keys securely, set defaults, then compose primary → fallback routes used by every agent node.</p></div>
      <div class="actions"><button class="btn" data-modal="provider-keys" data-provider="openai">${ic('key')} API keys</button><button class="btn primary" data-modal="add-provider">${ic('plus')} Add provider</button></div>
    </div>

    <div class="card pad" style="margin-bottom:18px;border-color:var(--harness-line);background:var(--harness-bg)">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div class="rico bk-harness" style="width:40px;height:40px">${ic('fallback')}</div>
        <div style="flex:1;min-width:220px"><b style="font-size:14px;color:var(--harness-ink)">Default reasoning route</b>
          <div style="font-size:12px;color:var(--harness-ink);opacity:.85;margin-top:2px">Used when a node doesn't override the model. Edit in Fallback Center.</div></div>
        <div class="route"><span class="hop primary"><span class="n">1</span>GPT-5.5</span>${ic('arrow','arr')}<span class="hop"><span class="n">2</span>Local GPT-OSS</span>${ic('arrow','arr')}<span class="hop"><span class="n">3</span>Fireworks GPT-OSS</span>${ic('arrow','arr')}<span class="hop human"><span class="n">4</span>Evidence template</span></div>
      </div>
    </div>

    <div class="sectionhd"><h3>Connected & available providers</h3><span class="hint">${connected} connected · ${available} available</span></div>
    <div class="grid g3">${cards}</div>

    <div class="grid g2" style="margin-top:18px;align-items:start">
      <div class="card pad">
        <div class="sectionhd"><h3>Default models</h3></div>
        <div class="field"><label>System reasoning model</label><select class="select"><option>GPT-5.5</option><option>Fireworks GPT-OSS 120B</option><option>Local GPT-OSS 20B</option></select></div>
        <div class="field"><label>Open-source fallback model</label><select class="select"><option>Fireworks GPT-OSS 120B</option><option>Local GPT-OSS 20B</option><option>OpenAI-compatible GPT-OSS</option></select></div>
        <div class="field adv-only"><label>Embedding model</label><select class="select"><option>text-embedding-3-large</option></select></div>
        <div class="hintline">Mirrors Dify's "Default Model Settings" — set once, reused by new nodes.</div>
      </div>
      <div class="card pad adv-only">
        <div class="sectionhd"><h3>Guardrails on the gateway</h3><span class="adv-badge">advanced</span></div>
        <div class="kv"><span class="k">${ic('mask')} Input PII screen</span><span class="v" style="color:var(--harness-ink)">before-request hook</span></div>
        <div class="kv"><span class="k">${ic('shield')} Output moderation</span><span class="v" style="color:var(--harness-ink)">after-request hook</span></div>
        <div class="kv"><span class="k">${ic('clock')} Request timeout</span><span class="v">8s</span></div>
        <div class="kv"><span class="k">${ic('refresh')} Auto-retry</span><span class="v">3 · exp backoff</span></div>
        <div class="kv"><span class="k">${ic('money')} Budget limit</span><span class="v">$4,000 / mo</span></div>
        <div class="explain harness" style="margin-top:12px">${ic('info')}<div>Like Portkey Configs: retries, timeouts, budgets & guardrails live on the gateway, not in your workflow logic.</div></div>
      </div>
    </div>
  </div>`;
};

/* ---------- FALLBACK CENTER ---------- */
Views.fallback = function(){
  const sum = window.OST?.workflowSummary?.() || {nodes:D.flow.length,edges:D.edges.length};
  const card = (r,type,idx)=>{
    const id = r.id || `${type}-${idx}`;
    const hops = r.hops.map((h,i)=>`<span class="hop ${esc(h[1])}"><span class="n">${i+1}</span>${esc(h[0])}</span>${i<r.hops.length-1?ic('arrow','arr'):''}`).join('');
    return `<div class="card pad fallbackRouteCard" style="margin-bottom:11px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:11px"><b style="font-size:13.5px">${esc(r.name)}</b><span class="pill live" style="margin-left:auto">${esc(r.tag)}</span><button class="iconbtn" title="Configure route hierarchy" aria-label="Configure ${esc(r.name)}" data-modal="configure-fallback" data-fb-type="${esc(type)}" data-fb-id="${esc(id)}">${ic('sliders')}</button></div>
      <div class="route">${hops}</div>
      <div class="hintline">${esc(r.note)}</div></div>`;
  };
  const section = (type, title, icon, sub, routes, accent)=>`<div class="card pad${accent?'':''}" style="${accent?'border-color:var(--harness-line);background:linear-gradient(180deg,var(--harness-bg),var(--surface))':''}">
    <div class="sectionhd"><h3 style="${accent?'color:var(--harness-ink)':''}">${ic(icon,'')} ${title}</h3><span class="hint">${sub}</span><button class="btn sm" style="margin-left:auto" data-modal="add-route">${ic('plus')} Add</button></div>
    ${routes.map((r,idx)=>card(r,type,idx)).join('')}</div>`;

  return `<div class="wrap">
    <div class="pagehead">
      <div><div class="eyebrow" style="color:var(--harness)">${ic('fallback')} The harness, configured</div>
        <h1>Fallback Center</h1>
        <p>One place for model, tool, skill and workflow fallback. Current Studio graph has <b>${sum.nodes} nodes</b> and <b>${sum.edges} links</b>; these routes are used by the same workflow you build on the canvas.</p></div>
      <div class="actions"><button class="btn harness" data-modal="add-route">${ic('plus')} Create fallback policy</button></div>
    </div>
    <div class="grid g2" style="align-items:start">
      ${section('model','Model fallback','provider','reasoning resilience', D.fbRoutes.model)}
      ${section('tool','Tool fallback','tool','data-source resilience', D.fbRoutes.tool)}
      ${section('skill','Skill / capability fallback','skill','degrade to generic, then human', D.fbRoutes.skill)}
      ${section('workflow','Workflow fallback','branch','the differentiator', D.fbRoutes.workflow, true)}
    </div>
  </div>`;
};

/* ---------- EVAL & REPLAY ---------- */
Views.eval = function(){
  const readiness = window.OST?.publishReadiness?.() || {replayPass:91, canPublish:false};
  const rows = D.evalScenarios.map(s=>`<div style="display:flex;align-items:center;gap:11px;padding:11px 13px;border-bottom:1px solid var(--line)">
    <span class="mono" style="font-size:11px;color:var(--faint)">${s.t}</span>
    <span style="flex:1;font-size:13px;font-weight:550">${s.name}</span>
    ${s.st==='pass'?`<span class="pill ok">${ic('check')} pass</span>`:`<span class="pill danger">${ic('alert')} fail</span>`}
    <button class="iconbtn" title="Open trace">${ic('activity')}</button></div>`).join('');

  const liveMetrics = D.evalMetrics.map((m,i)=> i===0 ? {...m, v:`${readiness.replayPass}%`, bar:readiness.replayPass} : m);
  const metrics = liveMetrics.map(m=>`<div style="margin-bottom:13px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12.5px;margin-bottom:7px"><span style="color:var(--muted);font-weight:550;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.k}</span><b class="tnum" style="flex:none">${m.v}</b></div>
    <div class="bar ${m.tone}"><i style="width:${m.bar}%"></i></div></div>`).join('');

  return `<div class="wrap">
    <div class="pagehead">
      <div><div class="eyebrow">${ic('eval')} Test before production</div>
        <h1>Eval & Replay</h1>
        <p>Replay historical cases and injected failures — model down, tool timeout, false positives, policy violations, PII leaks, low-confidence behavior — before publishing.</p></div>
      <div class="actions"><button class="btn" data-modal="add-scenario">${ic('plus')} Add scenario</button><button class="btn harness" data-act="replay">${ic('play')} Run replay suite</button></div>
    </div>
    <div class="grid" style="grid-template-columns:1.5fr 1fr;align-items:start">
      <div class="card" style="overflow:hidden">
        <div class="sectionhd" style="padding:15px 15px 0;margin-bottom:11px"><h3>FraudOps replay suite</h3><span class="pill warn">7 / 8 pass</span><button class="btn sm" style="margin-left:auto">${ic('history')} History</button></div>
        ${rows}
        <div class="explain harness" style="margin:13px">${ic('alert')}<div><b>AML escalation required</b> failed: agent recommended evidence-only when policy mandates compliance routing. <b>Suggested fix:</b> add AML keyword trigger to safe-action policy. <a style="color:var(--harness-ink);text-decoration:underline;cursor:pointer">Open trace →</a></div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card pad"><div class="sectionhd"><h3>Outcome metrics</h3><span class="hint">last run · 2h ago</span></div>${metrics}</div>
        <div class="card pad" style="border-color:var(--harness-line);background:var(--harness-bg)">
          <div class="sectionhd"><h3 style="color:var(--harness-ink)">${ic('approval','')} Publish gate</h3></div>
          <div class="kv" style="border-color:var(--harness-line)"><span class="k" style="color:var(--harness-ink)">Replay must pass</span><span class="v" style="color:var(--harness-ink)">≥ 95%</span></div>
          <div class="kv" style="border-color:var(--harness-line)"><span class="k" style="color:var(--harness-ink)">Unsafe-action blocked</span><span class="v" style="color:var(--ok)">100% ✓</span></div>
          <div class="kv" style="border-color:var(--harness-line)"><span class="k" style="color:var(--harness-ink)">Current</span><span class="v" style="color:${readiness.canPublish?'var(--ok)':'var(--danger)'}">${readiness.replayPass}% — ${readiness.canPublish?'ready':'blocked'}</span></div>
          <button class="btn sm ${readiness.canPublish?'primary':''}" style="width:100%;margin-top:11px;justify-content:center" ${readiness.canPublish?'data-modal="publish"':'disabled'}>${ic(readiness.canPublish?'upload':'lock')} ${readiness.canPublish?'Publish workflow':'Publish blocked until eval passes'}</button>
        </div>
      </div>
    </div>
  </div>`;
};

/* ---------- GOVERNANCE ---------- */
Views.governance = function(){
  const sum = window.OST?.workflowSummary?.() || {nodes:D.flow.length,edges:D.edges.length,harnessed:0};
  const perm = [
    { t:'Read-only diagnostics', d:'Ledger, KYC, device, graph lookups', s:'Allow', st:'ok' },
    { t:'Freeze / hold account', d:'High-risk write action', s:'Approval', st:'harness' },
    { t:'Refund / reversal', d:'High-risk write action', s:'Approval', st:'harness' },
    { t:'AML / compliance report', d:'Regulatory escalation', s:'Approval', st:'harness' },
    { t:'Contact customer', d:'Outbound notification', s:'Approval', st:'warn' },
    { t:'Disable provider / account', d:'Destructive', s:'Off', st:'draft' },
  ].map(p=>`<div class="row"><div class="rmain"><b>${p.t}</b><span>${p.d}</span></div>
    <div class="rend"><span class="pill ${p.st==='ok'?'ok':p.st==='harness'?'harness':p.st==='warn'?'warn':'draft'}">${p.s}</span></div></div>`).join('');

  const audit = [
    { k:'Who approved', v:'analyst:n.suwan' }, { k:'When', v:'2026-06-05 14:22 +07' },
    { k:'Evidence used', v:'timeline · graph · KYC · SOP×2' }, { k:'Model / tool', v:'claude-4.5 · ledger v4' },
    { k:'Policy checked', v:'PDPA ✓ · AML ✓ · refund ✗' }, { k:'Action', v:'evidence-only — freeze blocked' },
  ].map(a=>`<div class="kv"><span class="k">${a.k}</span><span class="v mono" style="font-size:11px">${a.v}</span></div>`).join('');

  return `<div class="wrap">
    <div class="pagehead">
      <div><div class="eyebrow">${ic('govern')} Enterprise trust layer</div>
        <h1>Data Governance</h1>
        <p>No production write by default. This audit view is linked to the current Studio graph: <b>${sum.nodes} steps</b>, <b>${sum.edges} links</b>, and <b>${sum.harnessed} harnessed controls</b>.</p></div>
      <div class="actions"><button class="btn" data-modal="audit">${ic('eye')} Preview approval card</button><button class="btn primary" data-act="export-audit">${ic('download')} Export audit packet</button></div>
    </div>
    <div class="grid" style="grid-template-columns:1.1fr 1fr;align-items:start">
      <div class="card pad">
        <div class="sectionhd"><h3>Approval policy</h3><span class="hint">what requires a human</span></div>
        ${perm}
        <div class="explain harness" style="margin-top:13px">${ic('approval')}<div>Mirrors Dify's Human-Input node: <b>Approve / Reject / Request evidence / Escalate</b> routes the workflow — automation can move fast, but a person owns the irreversible call.</div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card pad">
          <div class="sectionhd"><h3>${ic('mask','')} PII & data policy</h3></div>
          <div class="field"><label>Masking rules</label><textarea class="textarea">customer_id, phone, email, account_no, payment_ref, device_id</textarea></div>
          <div class="field"><label>Retention</label><select class="select"><option>Trace 90 days · audit summary 1 year</option></select></div>
          <div class="kv"><span class="k">Masking applied in traces & previews</span><span class="v" style="color:var(--ok)">on ✓</span></div>
        </div>
        <div class="card pad">
          <div class="sectionhd"><h3>${ic('file','')} Audit packet</h3><span class="pill ok">signed</span></div>
          ${audit}
          <button class="btn sm dark" style="width:100%;margin-top:11px;justify-content:center" data-modal="audit">${ic('eye')} Preview full packet</button>
        </div>
      </div>
    </div>
  </div>`;
};

})();
