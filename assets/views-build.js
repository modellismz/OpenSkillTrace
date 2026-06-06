/* ===== Views: Overview, Workflow Studio, Catalogs, RAG Builder ===== */
(function(){
const D = window.DATA, ic = window.icon;
window.Views = window.Views || {};

/* ---------- rectangular graph-node renderer (free-canvas) ---------- */
const TYPE_COLOR = { input:'#2563eb', agent:'#7c3aed', tool:'#0891b2', rag:'#4f46e5', mcp:'#c026d3', approval:'#0d9488', output:'#059669', harness:'#ea580c' };
window.renderGNode = function(n){
  const chips = [`<span class="gnHrn h">${ic('layers')}${n.badge}</span>`]
    .concat((n.meta||[]).map(m=>`<span class="gnHrn ${m.c}">${m.t}</span>`)).join('');
  return `<div class="gnode${n.selected?' selected':''}" data-node="${n.id}" data-type="${n.t}" style="left:${n.x}px;top:${n.y}px">
    <button class="gnDel" title="Delete" data-del="${n.id}">${ic('x')}</button>
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

/* ---------- inspector renderer ---------- */
window.renderInspector = function(nodeId){
  const n = D.flow.find(f=>f.id===nodeId) || D.flow.find(f=>f.id==='n-agent');
  const isAgent = n.t==='agent' && n.id==='n-agent';
  const purpose = `The right panel is the <b>harness control plane</b> for the selected node. The LLM config is visible, but the real value is safe recovery, policy gating, eval, approval and audit.`;
  let body = `
    <div class="inspPurpose">${ic('info')}<div>${purpose}</div></div>
    <div class="inspNode">
      <div class="iIco bk-${n.t}">${ic(n.icon)}</div>
      <div><b>${n.title}</b><span>${n.type} · owner: RiskOps · v1.4</span></div>
      <span class="pill ok" style="margin-left:auto">healthy</span>
    </div>
    <div class="inspSection">
      <div class="isHd" data-acc><span class="num">1</span> Step settings ${ic('chevd','chev')}</div>
      <div class="isBody">
        <div class="field"><label>Step name</label><input class="input" data-node-id="${n.id}" data-node-field="title" value="${n.title}"></div>
        <div class="field"><label>Description</label><textarea class="textarea" data-node-id="${n.id}" data-node-field="desc">${n.desc||''}</textarea></div>
        <div class="field"><label>Runtime / capability</label><input class="input mono" data-node-id="${n.id}" data-node-field="port" value="${n.port||''}"></div>
      </div>
    </div>`;

  if(isAgent){
    body += `
    <div class="inspSection adv-only">
      <div class="isHd" data-acc><span class="num">2</span> LLM Runtime ${ic('chevd','chev')}</div>
      <div class="isBody">
        <div class="field"><label>Primary model</label>
          <select class="select"><option>Claude Sonnet 4.5 — reasoning</option><option>GPT-4.1</option><option>GLM-4.7</option></select></div>
        <div class="field"><label>Fallback route</label>
          <select class="select"><option>Claude → GPT-4.1 → GLM-4.7 → evidence template</option></select>
          <div class="hintline">Configured in Fallback Center · applies to this node.</div></div>
        <div class="kv"><span class="k">Timeout / circuit breaker</span><span class="v">8s · 3 failures</span></div>
        <div class="kv"><span class="k">Max cost / run</span><span class="v">$0.18</span></div>
      </div>
    </div>`;
  }

  body += `
    <div class="inspSection harness">
      <div class="isHd" data-acc><span class="num">${isAgent?'3':'2'}</span> Harness controls ${ic('chevd','chev')}</div>
      <div class="isBody">
        <div class="hmatrix"><span class="hk">${ic('trace')} Trace capture</span><span class="hv">PII-masked timeline</span></div>
        <div class="hmatrix"><span class="hk">${ic('fallback')} Tool fallback</span><span class="hv">ledger → warehouse → events</span></div>
        <div class="hmatrix"><span class="hk">${ic('branch')} Workflow fallback</span><span class="hv">evidence-only mode</span></div>
        <div class="hmatrix"><span class="hk">${ic('gauge')} Confidence gate</span><span class="hv">&lt;80% blocks freeze</span></div>
        <div class="hmatrix"><span class="hk">${ic('approval')} Human approval</span><span class="hv">freeze / refund</span></div>
        <div class="hmatrix"><span class="hk">${ic('file')} Audit packet</span><span class="hv">auto-generated</span></div>
      </div>
    </div>`;

  if(isAgent){
    body += `
    <div class="inspSection adv-only">
      <div class="isHd" data-acc><span class="num">4</span> System prompt ${ic('chevd','chev')}</div>
      <div class="isBody">
        <div class="promptBox">You are a fraud-investigation assistant.
Collect evidence first.
Never approve freeze, refund, reversal, or
law-enforcement escalation.
Cite policy and show uncertainty.
Escalate if evidence is incomplete.</div>
      </div>
    </div>
    <div class="inspSection">
      <div class="isHd" data-acc><span class="num">5</span> Allowed capabilities ${ic('chevd','chev')}</div>
      <div class="isBody">
        <div class="capRow"><span class="cd" style="background:var(--t-tool)"></span><span class="cn mono">ledger_timeline</span><span class="cs">97%</span></div>
        <div class="capRow"><span class="cd" style="background:var(--t-mcp)"></span><span class="cn mono">device_risk_mcp</span><span class="cs">92%</span></div>
        <div class="capRow"><span class="cd" style="background:var(--t-mcp)"></span><span class="cn mono">mule_graph</span><span class="cs">94%</span></div>
        <div class="capRow"><span class="cd" style="background:var(--t-rag)"></span><span class="cn mono">fraud_sop_rag</span><span class="cs">89%</span></div>
      </div>
    </div>`;
  }

  body += `
    <div class="inspSection">
      <div class="isHd" data-acc><span class="num">${isAgent?'6':'3'}</span> Evaluation before publish ${ic('chevd','chev')}</div>
      <div class="isBody">
        <div class="kv"><span class="k">Replay suite</span><span class="v" style="color:var(--ok)">18 / 18 pass</span></div>
        <div class="kv"><span class="k">Last run</span><span class="v">2h ago</span></div>
        <button class="btn harness sm" style="width:100%;margin-top:10px;justify-content:center" data-act="replay">${ic('play')} Run harness replay</button>
      </div>
    </div>`;
  return body;
};

/* ---------- OVERVIEW ---------- */
Views.overview = function(){
  const sum = window.OST?.workflowSummary?.() || {nodes:D.flow.length,edges:D.edges.length,harnessed:0};
  const metrics = [
    { ico:'bk-agent', icon:'agent', num:String(sum.nodes), lbl:'Workflow steps linked', delta:`${sum.edges} live connections`, tone:'var(--ok)' },
    { ico:'bk-output', icon:'eval', num:`${window.OST?.state?.replayPass||91}%`, lbl:'Replay eval pass rate', delta:`${window.OST?.state?.evalRuns||1} run${(window.OST?.state?.evalRuns||1)===1?'':'s'} completed`, tone:'var(--ok)' },
    { ico:'bk-harness', icon:'policy', num:'12', lbl:'Unsafe actions blocked', delta:'this month', tone:'var(--harness)', accent:true },
    { ico:'bk-tool', icon:'clock', num:String(sum.harnessed), lbl:'Harnessed steps', delta:'trace · fallback · policy', tone:'var(--ok)' },
  ];
  const mcards = metrics.map(m=>`<div class="card metric${m.accent?' accent':''}">
    <div class="top"><div class="ico ${m.ico}">${ic(m.icon)}</div></div>
    <div class="num tnum">${m.num}</div><div class="lbl">${m.lbl}</div>
    <div class="delta" style="color:${m.tone}">${m.delta}</div></div>`).join('');

  const tpls = D.templates.map(t=>`<div class="row" data-goto="studio" style="cursor:pointer">
    <div class="rico bk-${t.st==='ok'?'output':t.st==='warn'?'harness':'input'}">${ic(t.icon)}</div>
    <div class="rmain"><b>${t.name}</b><span>${t.flow}</span></div>
    <div class="rend"><span class="pill ${t.st==='ok'?'live':t.st==='warn'?'draft':'info'}">${t.status}</span>${ic('chev','chev')}</div></div>`).join('');

  const cfg = [
    { icon:'agent', t:'Agent behavior', d:'Model, prompt, memory, tools, skills, approval thresholds.' },
    { icon:'fallback', t:'Harness routes', d:'Model, tool, skill & workflow fallback for graceful failure.' },
    { icon:'rag', t:'Knowledge / RAG', d:'Connect SOPs, policies, postmortems & prior cases — governed.' },
    { icon:'govern', t:'Governance', d:'Permissions, PII masks, human approval, audit evidence.' },
  ].map(c=>`<div class="card pad flat soft" style="display:flex;gap:11px"><div class="rico bk-input" style="width:34px;height:34px">${ic(c.icon)}</div><div><b style="font-size:13px">${c.t}</b><p style="font-size:12px;color:var(--muted);margin-top:3px">${c.d}</p></div></div>`).join('');

  return `<div class="wrap">
    <div class="pagehead">
      <div>
        <div class="eyebrow">${ic('bolt')} Production-ready AgentOps</div>
        <h1>Build operational agents that act fast but cannot act unsafely</h1>
        <p>Every workflow step is wrapped by trace, fallback, eval, policy, approval, audit and capability capture — the <b style="color:var(--harness-ink)">Harness Layer</b>. Build it visually; ship it governed.</p>
      </div>
      <div class="actions">
        <button class="btn" data-modal="import">${ic('download')} Import</button>
        <button class="btn" data-modal="mcp">${ic('mcp')} Connect MCP</button>
        <button class="btn primary" data-modal="new">${ic('plus')} New workflow</button>
      </div>
    </div>
    <div class="grid g4">${mcards}</div>
    <div class="grid g2" style="margin-top:18px;align-items:start">
      <div class="card pad">
        <div class="sectionhd"><h3>High-value workflow templates</h3><span class="hint">start in one click</span></div>
        ${tpls}
      </div>
      <div class="card pad">
        <div class="sectionhd"><h3>What you configure without code</h3><span class="adv-badge adv-only">advanced reveals more</span></div>
        <div class="grid g2" style="gap:10px">${cfg}</div>
        <div class="explain harness" style="margin-top:14px">${ic('info')}<div>Switch on <b>Advanced</b> in the top bar to expose deep harness, routing and policy controls. Non-technical reviewers can stay in <b>Simple</b>.</div></div>
      </div>
    </div>
  </div>`;
};

/* ---------- WORKFLOW STUDIO (full-page free canvas) ---------- */
Views.studio = function(){
  const sum = window.OST?.workflowSummary?.() || {nodes:D.flow.length,edges:D.edges.length};
  const lastSaved = window.OST?.state?.lastSaved || 'not saved yet';
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

  return `<div class="studioFull harness-on" id="studioFull">
    <!-- pannable canvas -->
    <div class="gcanvas" id="gcanvas">
      <div class="gviewport" id="gviewport">
        <svg class="wireLayer" id="wireLayer" viewBox="0 0 3000 1700" preserveAspectRatio="none"></svg>
        ${nodes}
      </div>
    </div>

    <!-- floating toolbar -->
    <div class="gtoolbar">
      <div class="tName"><span class="tIco">${ic('money')}</span><div><b>Scam Transaction Response</b><small id="studioSaveState">${sum.nodes} nodes · ${sum.edges} links · ${lastSaved}</small></div></div>
      <button class="btn sm ghost" data-act="save-workflow">${ic('file')} Save</button>
      <button class="btn sm ghost" data-act="validate">${ic('check')} Validate</button>
      <button class="btn sm ghost" data-act="replay">${ic('play')} Replay</button>
      <button class="hToggleBtn on" id="hToggle" title="Show / hide harness overlay">${ic('layers')} Harness <span class="sw"></span></button>
      <button class="btn sm primary" data-modal="publish">${ic('upload')} Publish</button>
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
      <div class="gpHd"><div class="pt"><b>Harness Inspector</b><small id="inspSel">Investigator Agent</small></div>
        <button class="iconbtn collapse" data-collapse="ginspector" title="Collapse">${ic('chev')}</button></div>
      <div class="gpBody"><div class="inspBody" id="inspBody">${window.renderInspector('n-agent')}</div></div>
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
  const sources = D.ragSources.map(s=>`<div class="row">
    <div class="rico bk-rag">${ic(s.icon)}</div>
    <div class="rmain"><b>${s.name}</b><span>${s.meta}</span></div>
    <div class="rend"><span class="pill ${s.st==='ok'?'ok':'warn'}">${s.status}</span><button class="iconbtn">${ic('sliders')}</button></div></div>`).join('');

  return `<div class="wrap">
    <div class="pagehead">
      <div><div class="eyebrow">${ic('rag')} Governed operational knowledge</div>
        <h1>RAG Builder</h1>
        <p>Not a generic knowledge base. RAG here is tied to workflow nodes, policies, evidence grounding and eval — with a fallback path when retrieval fails.</p></div>
      <div class="actions"><button class="btn" data-act="ground-eval">${ic('eval')} Run grounding eval</button><button class="btn primary" data-modal="add-source">${ic('plus')} Add source</button></div>
    </div>
    <div class="grid" style="grid-template-columns:1.3fr 1fr;align-items:start">
      <div class="card pad">
        <div class="sectionhd"><h3>Knowledge sources</h3><span class="pill ok">5 indexed</span></div>
        ${sources}
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card pad">
          <div class="sectionhd"><h3>RAG node settings</h3></div>
          <div class="field"><label>Retrieval mode</label><select class="select"><option>Hybrid search + reranker + citation required</option><option>Vector only</option></select></div>
          <div class="field adv-only"><label>Allowed workflow nodes</label><select class="select"><option>Evidence pack · Policy check · Notification draft</option></select></div>
          <div class="field"><label>Grounding policy ${ic('layers','')}</label><textarea class="textarea">Every recommendation must cite ≥2 SOP / policy sources. If unsupported, output uncertainty and ask a human.</textarea></div>
          <div class="kv"><span class="k">Freshness window</span><span class="v">≤ 30 days</span></div>
          <div class="kv adv-only"><span class="k">PII redaction</span><span class="v" style="color:var(--harness-ink)">on · masked at index</span></div>
        </div>
        <div class="card pad" style="border-color:var(--harness-line);background:var(--harness-bg)">
          <div class="sectionhd"><h3 style="color:var(--harness-ink)">${ic('fallback','')} RAG fallback</h3></div>
          <div class="route"><span class="hop primary"><span class="n">1</span>Vector DB</span>${ic('arrow','arr')}<span class="hop"><span class="n">2</span>Keyword index</span>${ic('arrow','arr')}<span class="hop"><span class="n">3</span>Cached SOP</span>${ic('arrow','arr')}<span class="hop human"><span class="n">4</span>Ask senior analyst</span></div>
          <div class="hintline" style="color:var(--harness-ink)">Retrieval never silently fails — it degrades to a cited cache, then to a human.</div>
        </div>
      </div>
    </div>
  </div>`;
};

})();
