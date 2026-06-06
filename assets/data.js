/* ===== OpenSkillTrace — shared data ===== */
window.DATA = (function(){

  // ---- Sidebar nav ----
  const nav = [
    { group:'Build', items:[
      { id:'overview', icon:'overview', label:'Overview' },
      { id:'studio', icon:'studio', label:'Workflow Studio', harness:true },
      { id:'tickets', icon:'approval', label:'My Tickets', harness:true },
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
      { id:'ag-fraud', t:'agent', kind:'LLM', icon:'agent', name:'Fraud Investigator Agent', desc:'Streams concise customer replies through the configured OpenAI-compatible provider route.' },
      { id:'ag-classify', t:'agent', kind:'ML', icon:'gauge', name:'Refund classifier', desc:'Scores refund probability, evidence coverage, and human-alignment feedback.' },
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
      { id:'out-packet', t:'output', kind:'Ticket', icon:'output', name:'Employee approval ticket', desc:'Evidence, classifier score, citations + approve/reject/escalate for My Tickets.' },
      { id:'out-capture', t:'output', kind:'Feedback', icon:'capture', name:'Harness learning', desc:'Record human decision feedback and create replay calibration cases.' },
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
      desc:'Customer preview chat, webhook, or risk-engine alert starts the scam-report workflow and masks sensitive identifiers.',
      port:'preview chat · webhook · risk alert', meta:[{c:'',t:'PII mask'},{c:'ev',t:'trace event'}], badge:'trigger' },
    { x:330,  y:230, id:'n-intake', t:'input', icon:'input', title:'Customer Intake', type:'Guided Form',
      desc:'Backend-driven intake.schema and intake.update collect scam details as clickable customer choices plus text fallback.',
      port:'intake.schema → case_state', meta:[{c:'',t:'9 key fields'},{c:'',t:'PII mask'}], badge:'customer intake' },
    { x:620,  y:230, id:'n-agent', t:'agent', icon:'agent', title:'Investigator Agent', type:'LLM Agent', selected:true,
      desc:'Streams the customer-facing response through the configured provider route and receives structured case_state.',
      port:'OpenAI gpt-5.5 → Local GPT-OSS → Fireworks GPT-OSS', meta:[{c:'fb',t:'model route'},{c:'',t:'concise prompt'}], badge:'provider route' },
    { x:930,  y:60,  id:'n-tools', t:'tool', icon:'tool', title:'Evidence tools', type:'Tools',
      desc:'Creates reviewable evidence records from mocked Payments DB, core ledger, evidence vault, and risk graph sources.',
      port:'Payments DB → ledger → evidence vault', meta:[{c:'fb',t:'tool fallback'},{c:'ev',t:'DB/RAG mock'}], badge:'evidence records' },
    { x:930,  y:420, id:'n-rag', t:'rag', icon:'rag', title:'SOP & policy RAG', type:'Retrieval',
      desc:'Grounds refund, freeze, AML, and customer-notification policy with vector search and keyword fallback.',
      port:'Qdrant vector → SQLite FTS keyword', meta:[{c:'',t:'citation'},{c:'ev',t:'grounded'}], badge:'RAG fallback' },
    { x:1240, y:240, id:'n-class', t:'agent', icon:'gauge', title:'Refund classifier', type:'ML Classifier',
      desc:'Scores refund probability, evidence coverage, and recommended decision for the employee review ticket.',
      port:'refund_probability · evidence_coverage', meta:[{c:'fb',t:'skill fallback'},{c:'ev',t:'human feedback'}], badge:'refund classifier' },
    { x:1540, y:240, id:'n-policy', t:'harness', icon:'policy', title:'Safe-action gate', type:'Policy',
      desc:'Blocks automated refund, freeze, reversal, AML, and customer-contact actions until employee approval exists.',
      port:'block automation → employee review', meta:[{c:'ap',t:'human approval'},{c:'',t:'PDPA·AML'}], badge:'safe action' },
    { x:1840, y:80,  id:'n-out', t:'output', icon:'output', title:'Employee approval ticket', type:'My Tickets',
      desc:'Creates the employee-only ticket with case summary, evidence records, classifier score, policy citations, and actions.',
      port:'#tickets · /api/tickets', meta:[{c:'ap',t:'approve/reject'},{c:'',t:'audit'}], badge:'ticket packet' },
    { x:1840, y:400, id:'n-cap', t:'output', icon:'capture', title:'Harness learning', type:'Feedback',
      desc:'Compares human decision with classifier recommendation and creates classifier_feedback plus replay calibration metadata.',
      port:'classifier_feedback → replay case', meta:[{c:'ev',t:'learning signal'},{c:'',t:'versioned'}], badge:'ML feedback' },
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
    { id:'openai', name:'OpenAI', icon:'O', color:'#10a37f', status:'Connected', st:'ok', models:'GPT-5.5, GPT-5.5 mini, text-embedding-3-large', keys:1, latency:'910ms', note:'Primary system model', defaultModel:'gpt-5.5', apiBase:'https://api.openai.com/v1', organization:'', apiKeyLabel:'OpenAI API key', docsUrl:'https://platform.openai.com/api-keys', types:['LLM','TEXT EMBEDDING','SPEECH2TEXT','MODERATION','TTS'] },
    { id:'local_gpt_oss', name:'Local GPT-OSS', icon:'L', color:'#475569', status:'Available', st:'idle', models:'gpt-oss:20b via OpenAI-compatible local server', keys:0, latency:'—', note:'No-key local fallback', defaultModel:'gpt-oss:20b', apiBase:'http://localhost:11434/v1', organization:'', apiKeyLabel:'Optional local API key', docsUrl:'https://ollama.com', types:['LLM'] },
    { id:'fireworks_gpt_oss', name:'Fireworks GPT-OSS', icon:'F', color:'#7c3aed', status:'Available', st:'idle', models:'accounts/fireworks/models/gpt-oss-120b', keys:0, latency:'—', note:'Cloud GPT-OSS fallback', defaultModel:'accounts/fireworks/models/gpt-oss-120b', apiBase:'https://api.fireworks.ai/inference/v1', organization:'', apiKeyLabel:'Fireworks API key', docsUrl:'https://fireworks.ai/account/api-keys', types:['LLM'] },
    { id:'openai_compatible', name:'OpenAI-compatible', icon:'C', color:'#0d9488', status:'Available', st:'idle', models:'Any /v1/chat/completions compatible model', keys:0, latency:'—', note:'Bring your own gateway', defaultModel:'gpt-oss-120b', apiBase:'https://your-provider.example.com/v1', organization:'', apiKeyLabel:'Provider API key', docsUrl:'', types:['LLM','TEXT EMBEDDING','RERANK','TTS'] },
    { id:'google', name:'Google Vertex', icon:'G', color:'#4285f4', status:'Connected', st:'ok', models:'Gemini 2.5 Pro, Flash', keys:1, latency:'780ms', note:'EU residency', defaultModel:'gemini-2.5-pro', apiBase:'https://aiplatform.googleapis.com', organization:'', apiKeyLabel:'Google Cloud credential', docsUrl:'https://cloud.google.com/vertex-ai', types:['LLM','TEXT EMBEDDING'] },
    { id:'anthropic', name:'Anthropic', icon:'A', color:'#d97757', status:'Available', st:'idle', models:'Claude Sonnet 4.5, Opus 4.1, Haiku', keys:0, latency:'—', note:'Optional reasoning provider', defaultModel:'claude-sonnet-4-5', apiBase:'https://api.anthropic.com/v1', organization:'', apiKeyLabel:'Anthropic API key', docsUrl:'https://console.anthropic.com/settings/keys', types:['LLM'] },
  ];

  // ---- Fallback Center routes ----
  const fbRoutes = {
    model:[
      { name:'FraudOps reasoning route', tag:'live', hops:[['GPT-5.5','primary'],['Local GPT-OSS',''],['Fireworks GPT-OSS',''],['Evidence template','human']], note:'Timeout 8s · circuit breaker 3 failures · cost cap outside SEV-1.' },
      { name:'Open-source fallback route', tag:'live', hops:[['Fireworks GPT-OSS','primary'],['Local GPT-OSS',''],['Rule parser','']], note:'OpenAI-compatible GPT-OSS route with deterministic parser backstop.' },
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
