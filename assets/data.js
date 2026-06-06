/* ===== OpenSkillTrace — shared data ===== */
window.DATA = (function(){

  // ---- Sidebar nav ----
  const nav = [
    { group:'Build', items:[
      { id:'overview', icon:'overview', label:'Overview' },
      { id:'studio', icon:'studio', label:'Workflow Studio', harness:true },
      { id:'catalog', icon:'catalog', label:'Catalogs', count:'128' },
      { id:'rag', icon:'rag', label:'RAG Builder' },
    ]},
    { group:'Reliability', items:[
      { id:'providers', icon:'provider', label:'Model Providers' },
      { id:'fallback', icon:'fallback', label:'Fallback Center', harness:true },
      { id:'eval', icon:'eval', label:'Eval & Replay' },
    ]},
    { group:'Govern', items:[
      { id:'governance', icon:'govern', label:'Data Governance' },
    ]},
  ];

  // ---- Palette blocks (left panel of Studio) ----
  const blocks = [
    { grp:'Start', items:[
      { id:'in-scam', t:'input', kind:'Input', icon:'input', name:'Scam alert / claim', desc:'Customer claim, fraud-score spike, suspicious-transfer webhook, or manual case.' },
      { id:'in-csv', t:'input', kind:'Input', icon:'upload', name:'CSV / batch upload', desc:'Scheduled batch of flagged transactions for overnight review.' },
    ]},
    { grp:'Reason', items:[
      { id:'ag-fraud', t:'agent', kind:'LLM', icon:'agent', name:'Fraud Investigator Agent', desc:'Plans evidence collection, calls approved tools, classifies risk, drafts safe action.' },
      { id:'ag-classify', t:'agent', kind:'LLM', icon:'agent', name:'Risk classifier', desc:'Labels scam / takeover / mule / false-positive and estimates harm.' },
    ]},
    { grp:'Evidence', items:[
      { id:'tl-ledger', t:'tool', kind:'Tool', icon:'tool', name:'Transaction timeline', desc:'Read-only ledger / API with warehouse + event-stream fallback.' },
      { id:'tl-kyc', t:'tool', kind:'Tool', icon:'user', name:'KYC / account profile', desc:'Account standing, age, prior disputes, risk score.' },
      { id:'mcp-mule', t:'mcp', kind:'MCP', icon:'graph', name:'Mule graph checker', desc:'Counterparty, device, IP, account-graph & blacklist signals.' },
      { id:'mcp-device', t:'mcp', kind:'MCP', icon:'mcp', name:'Device / IP risk MCP', desc:'Device fingerprint, login history, geo-velocity anomalies.' },
      { id:'rag-sop', t:'rag', kind:'RAG', icon:'rag', name:'Fraud SOP & regulation', desc:'Cited fraud SOP, refund/freeze policy, PDPA/AML constraints.' },
    ]},
    { grp:'Decide & act', items:[
      { id:'ap-analyst', t:'approval', kind:'Approval', icon:'approval', name:'Fraud analyst approval', desc:'Human gate for freeze, reversal, refund, law-enforcement escalation.' },
      { id:'out-packet', t:'output', kind:'Output', icon:'output', name:'Approval packet', desc:'Evidence, timeline, confidence, citations + approve/reject/escalate.' },
      { id:'out-capture', t:'output', kind:'Skill', icon:'capture', name:'Capture scam pattern', desc:'Register reusable capability after replay eval passes.' },
    ]},
    { grp:'Harness policy', items:[
      { id:'h-safe', t:'harness', kind:'Harness', icon:'policy', name:'Safe-action policy', desc:'Freeze/refund/contact require confidence + analyst approval.' },
      { id:'h-conf', t:'harness', kind:'Harness', icon:'gauge', name:'Confidence gate', desc:'Below threshold → block risky action, switch to evidence-only.' },
      { id:'h-pii', t:'harness', kind:'Harness', icon:'mask', name:'PII masking', desc:'Mask customer id, phone, account, references across traces.' },
    ]},
  ];

  // ---- The Monee workflow on the canvas (6 lanes) ----
  const lanes = [
    { n:1, title:'Input', sub:'claim / alert' },
    { n:2, title:'Intake', sub:'customer details' },
    { n:3, title:'Agent', sub:'investigator' },
    { n:4, title:'Evidence', sub:'tools + RAG' },
    { n:5, title:'Decision', sub:'safe mode' },
    { n:6, title:'Output', sub:'approval + reuse' },
  ];

  const flow = [
    { x:40,   y:240, id:'n-input', t:'input', icon:'input', title:'Scam claim / alert', type:'Trigger',
      desc:'Customer claim or risk-engine alert. “Tricked into transferring ฿50,000” + mule-account pattern.',
      port:'webhook · form', meta:[{c:'',t:'schema'},{c:'',t:'PII mask'}], badge:'trace' },
    { x:330,  y:230, id:'n-intake', t:'input', icon:'input', title:'Customer Intake', type:'Guided Form',
      desc:'Turns the customer chat into structured scam-report fields with choices, text fallback, and safety flags.',
      port:'case_state · missing fields', meta:[{c:'',t:'schema'},{c:'',t:'PII mask'}], badge:'intake' },
    { x:620,  y:230, id:'n-agent', t:'agent', icon:'agent', title:'Investigator Agent', type:'LLM Agent', selected:true,
      desc:'Plans evidence collection, calls approved tools, explains risk, drafts a safe next action.',
      port:'Claude → GPT → GLM', meta:[{c:'fb',t:'model fallback'},{c:'',t:'policy'}], badge:'model + policy' },
    { x:930,  y:60,  id:'n-tools', t:'tool', icon:'tool', title:'Evidence tools', type:'Tools',
      desc:'Ledger timeline, device/IP mismatch, login history, counterparty & mule-graph risk.',
      port:'ledger → warehouse → events', meta:[{c:'fb',t:'tool fallback'},{c:'ev',t:'eval'}], badge:'tool fallback' },
    { x:930,  y:420, id:'n-rag', t:'rag', icon:'rag', title:'SOP & policy RAG', type:'Retrieval',
      desc:'Refund SOP, freeze criteria, AML escalation rule, customer-notification scripts — cited.',
      port:'vector → keyword → cache', meta:[{c:'',t:'citation'},{c:'ev',t:'grounded'}], badge:'grounding' },
    { x:1240, y:240, id:'n-class', t:'agent', icon:'gauge', title:'Risk classifier', type:'Reason',
      desc:'Labels scam / takeover / false-positive and estimates harm if no action in 10 minutes.',
      port:'confidence score', meta:[{c:'fb',t:'skill fallback'},{c:'',t:'conf. gate'}], badge:'confidence gate' },
    { x:1540, y:240, id:'n-policy', t:'harness', icon:'policy', title:'Safe-action gate', type:'Policy',
      desc:'Decides whether freeze, hold, refund, contact or escalation is allowed under PDPA · AML.',
      port:'allow / block / escalate', meta:[{c:'ap',t:'approval'},{c:'',t:'PDPA·AML'}], badge:'policy gate' },
    { x:1840, y:80,  id:'n-out', t:'output', icon:'output', title:'Approval packet', type:'Output',
      desc:'Approve / reject / escalate card with evidence, timeline, confidence and citations.',
      port:'human decision', meta:[{c:'ap',t:'human gate'},{c:'',t:'audit'}], badge:'audit packet' },
    { x:1840, y:400, id:'n-cap', t:'output', icon:'capture', title:'Capture pattern', type:'Skill',
      desc:'If analyst confirms a new pattern, register a reusable capability after replay eval.',
      port:'versioned skill', meta:[{c:'ev',t:'eval req'},{c:'',t:'versioned'}], badge:'capture' },
  ];

  const edges = [
    ['n-input','n-intake'], ['n-intake','n-agent'], ['n-agent','n-tools'], ['n-agent','n-rag'],
    ['n-tools','n-class'], ['n-rag','n-class'], ['n-class','n-policy'],
    ['n-policy','n-out'], ['n-out','n-cap'],
  ];

  const harnessRail = [
    { icon:'trace', label:'Trace' }, { icon:'fallback', label:'Fallback' },
    { icon:'eval', label:'Eval' }, { icon:'policy', label:'Policy' },
    { icon:'approval', label:'Approval' }, { icon:'capture', label:'Capture' },
  ];

  // ---- Catalog (unified) ----
  const catTabs = [
    { id:'all', label:'All', n:128 }, { id:'skill', label:'Skills', n:46 },
    { id:'tool', label:'Tools', n:38 }, { id:'plugin', label:'Plugins', n:14 },
    { id:'mcp', label:'MCP', n:17 }, { id:'rag', label:'RAG', n:9 },
    { id:'harness', label:'Harness', n:11 }, { id:'template', label:'Templates', n:6 },
  ];
  const catalog = [
    { type:'mcp', t:'mcp', icon:'graph', name:'Mule Graph Checker', domain:'FraudOps', desc:'Counterparty, device & account-graph anomaly checks over the transaction network.', status:'Approved', st:'ok', perm:'read-only', eval:94, owner:'RiskOps', ver:'v2.3.1', action:'Drag to canvas' },
    { type:'tool', t:'tool', icon:'tool', name:'Transaction Timeline API', domain:'FraudOps', desc:'Read-only ledger timeline with warehouse + Kafka fallback sources.', status:'Approved', st:'ok', perm:'read-only', eval:97, owner:'Payments', ver:'v4.0.0', action:'Drag to canvas' },
    { type:'skill', t:'agent', icon:'skill', name:'qr_mule_split_transfer_v1', domain:'FraudOps', desc:'Detects QR-mule split-transfer scam typology. Captured & replay-validated.', status:'Approved', st:'ok', perm:'read-only', eval:91, owner:'Auto-capture', ver:'v1.0.0', action:'Drag to canvas' },
    { type:'rag', t:'rag', icon:'rag', name:'Fraud SOP & Regulation', domain:'FraudOps', desc:'Hybrid search over fraud SOP, refund/freeze policy, PDPA & AML guidance.', status:'Approved', st:'ok', perm:'cited', eval:89, owner:'Compliance', ver:'sync 2h', action:'Add source' },
    { type:'plugin', t:'approval', icon:'plugin', name:'Human Approval Plugin', domain:'Shared', desc:'Slack / Teams / Telegram approval cards with full audit trail.', status:'Installed', st:'info', perm:'gated', eval:96, owner:'Platform', ver:'v3.2.0', action:'Configure' },
    { type:'mcp', t:'mcp', icon:'mcp', name:'Device / IP Risk MCP', domain:'FraudOps', desc:'Device fingerprint, login history, geo-velocity & impossible-travel signals.', status:'Approved', st:'ok', perm:'read-only', eval:92, owner:'RiskOps', ver:'v1.8.2', action:'Connect' },
    { type:'tool', t:'tool', icon:'user', name:'KYC / Account Profile', domain:'FraudOps', desc:'Account standing, KYC tier, age, prior disputes & risk score lookup.', status:'Approved', st:'ok', perm:'read-only', eval:95, owner:'Identity', ver:'v2.1.0', action:'Drag to canvas' },
    { type:'harness', t:'harness', icon:'policy', name:'Safe-Action Policy Pack', domain:'FraudOps', desc:'Freeze/refund/contact require confidence threshold + named approver.', status:'Approved', st:'ok', perm:'enforced', eval:100, owner:'Risk Council', ver:'v5.0', action:'Apply' },
    { type:'skill', t:'agent', icon:'skill', name:'account_takeover_screen_v2', domain:'FraudOps', desc:'Screens for ATO indicators across device, login & beneficiary change.', status:'Needs review', st:'warn', perm:'read-only', eval:78, owner:'Auto-capture', ver:'draft', action:'Review' },
    { type:'plugin', t:'tool', icon:'plugin', name:'Warehouse SQL Fallback', domain:'Shared', desc:'Read-only warehouse query used when the primary operational API is down.', status:'Approved', st:'ok', perm:'read-only', eval:93, owner:'Data', ver:'v1.4.2', action:'Install' },
    { type:'template', t:'template', icon:'template', name:'Mule Account Investigation', domain:'FraudOps', desc:'Graph → KYC/device risk → AML escalation → case packet.', status:'Template', st:'info', perm:'—', eval:88, owner:'RiskOps', ver:'starter', action:'Use template' },
    { type:'rag', t:'rag', icon:'doc', name:'Confirmed Fraud Case Library', domain:'FraudOps', desc:'Prior confirmed cases & dispute resolutions for grounding & few-shot.', status:'Syncing', st:'warn', perm:'cited', eval:84, owner:'Compliance', ver:'sync…', action:'View' },
  ];

  // ---- Model providers ----
  const providers = [
    { id:'anthropic', name:'Anthropic', icon:'A', color:'#d97757', status:'Connected', st:'ok', models:'Claude Sonnet 4.5, Opus 4.1, Haiku', keys:2, latency:'820ms', note:'Primary reasoning' },
    { id:'openai', name:'OpenAI', icon:'O', color:'#10a37f', status:'Connected', st:'ok', models:'GPT-4.1, GPT-4.1 mini, o4-mini', keys:1, latency:'910ms', note:'Fallback #1' },
    { id:'zhipu', name:'Zhipu (GLM)', icon:'Z', color:'#3b6ef5', status:'Connected', st:'ok', models:'GLM-4.7, GLM-4-Air', keys:1, latency:'640ms', note:'Fallback #2 · low-cost' },
    { id:'google', name:'Google Vertex', icon:'G', color:'#4285f4', status:'Connected', st:'ok', models:'Gemini 2.5 Pro, Flash', keys:1, latency:'780ms', note:'EU residency' },
    { id:'bedrock', name:'AWS Bedrock', icon:'B', color:'#ff9900', status:'Available', st:'idle', models:'Claude, Llama, Titan', keys:0, latency:'—', note:'Connect for VPC routing' },
    { id:'ollama', name:'Ollama (local)', icon:'L', color:'#475569', status:'Available', st:'idle', models:'Qwen2.5, Llama 3.3', keys:0, latency:'—', note:'On-prem evidence-only fallback' },
  ];

  // ---- Fallback Center routes ----
  const fbRoutes = {
    model:[
      { name:'FraudOps reasoning route', tag:'live', hops:[['Claude Sonnet 4.5','primary'],['GPT-4.1',''],['GLM-4.7',''],['Evidence template','human']], note:'Timeout 8s · circuit breaker 3 failures · cost cap outside SEV-1.' },
      { name:'Evidence extraction route', tag:'live', hops:[['GLM-4-Air','primary'],['Haiku',''],['Rule parser','']], note:'Fast/cheap models with deterministic parser backstop.' },
    ],
    tool:[
      { name:'Transaction evidence source', tag:'live', hops:[['Ledger API','primary'],['Warehouse snapshot',''],['Kafka archive',''],['Analyst note','human']], note:'Freshness ≤ 5 min required before warehouse fallback.' },
      { name:'Device risk source', tag:'live', hops:[['Device MCP','primary'],['Cached fingerprint',''],['Manual check','human']], note:'Read-only; never blocks workflow on failure.' },
    ],
    skill:[
      { name:'Scam typology diagnosis', tag:'live', hops:[['qr_mule_split_v1','primary'],['Generic fraud checker',''],['Evidence template',''],['Human analyst','human']], note:'Prefer specific captured pattern; degrade gracefully to human.' },
    ],
    workflow:[
      { name:'Low confidence or risky action', tag:'live', hops:[['Block automation','primary'],['Evidence-only packet',''],['Human analyst','human'],['Audit log','']], note:'This is what makes OpenSkillTrace different from a model-only gateway.' },
    ],
  };

  // ---- Eval & Replay ----
  const evalScenarios = [
    { t:'00:12', name:'Confirmed scam — QR mule split transfer', st:'pass' },
    { t:'00:19', name:'False positive — VIP large legitimate transfer', st:'pass' },
    { t:'00:27', name:'Ledger API down → warehouse fallback', st:'pass' },
    { t:'00:34', name:'Mule graph timeout → degrade to evidence-only', st:'pass' },
    { t:'00:41', name:'Refund not allowed by policy → blocked', st:'pass' },
    { t:'00:48', name:'PII masking — customer_id / account_no redacted', st:'pass' },
    { t:'00:55', name:'Low-confidence (62%) → escalate to senior analyst', st:'pass' },
    { t:'01:03', name:'AML escalation required → compliance route', st:'fail' },
  ];
  const evalMetrics = [
    { k:'Replay pass rate', v:'91%', bar:91, tone:'ok' },
    { k:'Unsafe action blocked', v:'100%', bar:100, tone:'harness' },
    { k:'Evidence completeness', v:'88%', bar:88, tone:'ok' },
    { k:'Citation coverage', v:'94%', bar:94, tone:'ok' },
    { k:'PII leakage rate', v:'0%', bar:2, tone:'ok' },
    { k:'False-positive rate', v:'7%', bar:7, tone:'ok' },
  ];

  // ---- RAG sources ----
  const ragSources = [
    { icon:'doc', name:'Fraud SOP & Investigation Playbook', meta:'Confluence · 142 pages · updated 2d ago', status:'Indexed', st:'ok' },
    { icon:'scale', name:'AML Escalation Policy', meta:'SharePoint · 38 pages · PII redaction on', status:'Indexed', st:'ok' },
    { icon:'lock', name:'PDPA Privacy Policy', meta:'S3 bucket · 24 docs · masked', status:'Indexed', st:'ok' },
    { icon:'money', name:'Refund / Freeze Decision SOP', meta:'Confluence · 56 pages', status:'Indexed', st:'ok' },
    { icon:'doc', name:'Customer Notification Scripts', meta:'Google Drive · 31 templates', status:'Indexed', st:'ok' },
    { icon:'history', name:'Confirmed Fraud Case Library', meta:'Warehouse · 1,240 cases · 180 days', status:'Syncing', st:'warn' },
  ];

  // ---- Templates (overview) ----
  const templates = [
    { name:'Monee Scam Transaction Response', flow:'Claim → evidence → policy check → analyst approval → audit', status:'Live', st:'ok', icon:'money' },
    { name:'Monee Mule Account Investigation', flow:'Graph → KYC/device risk → AML escalation → case packet', status:'Draft', st:'warn', icon:'graph' },
    { name:'Card Dispute Triage', flow:'Dispute → evidence → chargeback policy → ops approval', status:'Template', st:'info', icon:'doc' },
    { name:'Account Takeover Response', flow:'Login anomaly → device risk → hold → customer verify', status:'Template', st:'info', icon:'lock' },
  ];

  return { nav, blocks, lanes, flow, edges, harnessRail, catTabs, catalog, providers, fbRoutes, evalScenarios, evalMetrics, ragSources, templates };
})();
