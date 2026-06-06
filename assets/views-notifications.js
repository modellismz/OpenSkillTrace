/* ===== Views: Platform Notification Inbox ===== */
(function(){
const D = window.DATA, ic = window.icon;
window.Views = window.Views || {};

const STATE_KEY = 'ost_notifications_state_v1';
const DEFAULT_ID = 'notif-001';

const STATUS = {
  unread:{ label:'Unread', tone:'info' },
  read:{ label:'Read', tone:'draft' },
  waiting_approval:{ label:'Waiting approval', tone:'harness' },
  blocked:{ label:'Blocked', tone:'danger' },
  recovered:{ label:'Recovered', tone:'ok' },
  acknowledged:{ label:'Acknowledged', tone:'draft' },
};
const SEVERITY = {
  critical:{ label:'Critical', tone:'danger' },
  high:{ label:'High', tone:'harness' },
  medium:{ label:'Medium', tone:'warn' },
  low:{ label:'Low', tone:'ok' },
};

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

function initialState(){
  return {
    selectedId:DEFAULT_ID,
    read:{},
    status:{},
    filters:{ status:'All' },
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

function effectiveRead(state, notification){
  if(Object.prototype.hasOwnProperty.call(state.read || {}, notification.id)) return !!state.read[notification.id];
  return !!notification.read;
}

function effectiveStatus(state, notification){
  return state.status?.[notification.id] || notification.status;
}

function displayStatus(state, notification){
  const status = effectiveStatus(state, notification);
  if(status === 'unread' && effectiveRead(state, notification)) return 'read';
  return status;
}

function unreadCount(state){
  return (D.notifications || []).filter(n => !effectiveRead(state, n)).length;
}

function syncCounts(state = loadState()){
  const count = unreadCount(state);
  (D.nav || []).forEach(group => (group.items || []).forEach(item => {
    if(item.id === 'notifications') item.count = count ? String(count) : '';
  }));
  document.querySelectorAll('[data-notification-count], [data-count-for="notifications"]').forEach(el => {
    el.textContent = String(count);
    el.hidden = count === 0;
  });
  document.querySelectorAll('#navMount a[data-view="notifications"] .count').forEach(el => {
    el.textContent = String(count);
    el.hidden = count === 0;
  });
}

function selectedNotification(state){
  return (D.notifications || []).find(n => n.id === state.selectedId) || (D.notifications || [])[0];
}

function statusPill(state, notification){
  const key = displayStatus(state, notification);
  const meta = STATUS[key] || STATUS.unread;
  return `<span class="pill ${meta.tone} notifStatus">${esc(meta.label)}</span>`;
}

function severityPill(notification){
  const meta = SEVERITY[notification.severity] || SEVERITY.low;
  return `<span class="notifSeverityLabel ${esc(notification.severity)}"><i></i>${esc(meta.label)}</span>`;
}

function filterNotifications(state){
  const filter = state.filters?.status || 'All';
  if(filter === 'All') return D.notifications || [];
  if(filter === 'Unread') return (D.notifications || []).filter(n => !effectiveRead(state, n));
  if(filter === 'Waiting approval') return (D.notifications || []).filter(n => effectiveStatus(state, n) === 'waiting_approval');
  if(filter === 'Blocked') return (D.notifications || []).filter(n => effectiveStatus(state, n) === 'blocked' || /blocked/i.test(n.title));
  if(filter === 'Recovered') return (D.notifications || []).filter(n => effectiveStatus(state, n) === 'recovered');
  return D.notifications || [];
}

function renderTopFilters(){
  return `<div class="notifGlobalFilters" aria-label="Global filters">
    ${['Project: All','Owner: Me','Severity: All','Status: All','Time range: Last 7 days'].map(label => `<button class="chip" type="button">${esc(label)} ${ic('chevd')}</button>`).join('')}
    <button class="btn sm ghost" data-act="notif-clear-filters">${ic('x')} Clear all</button>
  </div>`;
}

function renderKpis(){
  const items = [
    ['alert','Unread critical','3','Across 3 projects','danger'],
    ['approval','Waiting owner action','2','Across 2 projects','harness'],
    ['fallback','Auto-recovered today','9','Across 4 projects','ok'],
    ['eval','Eval-blocked releases','1','Across 1 project','info'],
  ];
  return `<div class="notifKpis">
    ${items.map(([icon, label, value, sub, tone]) => `<div class="card metric notifKpi ${tone}">
      <div class="top"><div class="ico">${ic(icon)}</div><span class="notifKpiArrow">${ic('chev')}</span></div>
      <div><div class="lbl">${esc(label)}</div><div class="num tnum">${esc(value)}</div><div class="delta">${esc(sub)}</div></div>
    </div>`).join('')}
  </div>`;
}

function renderFilterPanel(state){
  const active = state.filters?.status || 'All';
  const statusFilters = ['All','Unread','Waiting approval','Blocked','Recovered'];
  const projectFilters = ['All projects','Monee FraudOps — 4','KYC Ops — 2','Seller Review — 2','Payments Risk — 1','Account Health — 1','Show more (2)'];
  const severityFilters = ['Critical','High','Medium','Low'];
  const ownerFilters = ['Me','RiskOps','Compliance','Platform'];
  const filterButtons = (items, kind) => items.map(item => `<button type="button" class="notifFilter ${active === item ? 'active' : ''}" data-notif-filter="${esc(kind)}" data-value="${esc(item)}">${esc(item)}</button>`).join('');

  return `<aside class="card pad notifFiltersPanel">
    <div class="sectionhd"><h3>Filters</h3></div>
    <div class="notifSearchBox">${ic('search')}<input aria-label="Search notifications" placeholder="Search workflow, trace, owner…"></div>
    <div class="notifFilterGroup"><b>Status filters</b><div>${filterButtons(statusFilters, 'status')}</div></div>
    <div class="notifFilterGroup"><b>Project filter</b><div>${filterButtons(projectFilters, 'project')}</div></div>
    <div class="notifFilterGroup"><b>Severity filters</b><div>${filterButtons(severityFilters, 'severity')}</div></div>
    <div class="notifFilterGroup"><b>Owner filter</b><div>${filterButtons(ownerFilters, 'owner')}</div></div>
    <button class="btn sm notifSaveView" data-act="notif-save-view">${ic('file')} Save as view</button>
  </aside>`;
}

function renderRow(notification, state){
  const selected = state.selectedId === notification.id;
  const unread = !effectiveRead(state, notification);
  return `<button class="notifRow ${selected ? 'selected' : ''} ${unread ? 'unread' : ''}" type="button" data-notification-id="${esc(notification.id)}">
    <span class="notifAccent"></span>
    <span class="notifDot ${esc(notification.severity)}"></span>
    <div class="notifRowMain">
      <div class="notifRowTop">
        <span class="pill notifProject">${esc(notification.project)}</span>
        <b>${esc(notification.title)}</b>
      </div>
      <div class="notifMeta">
        <span>Workflow: ${esc(notification.workflow)}</span>
        <span>Owner: ${esc(notification.owner)}</span>
        <span>${esc(notification.time)}</span>
      </div>
      <div class="notifTags">${(notification.tags || []).map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
      <div class="notifSummary">${esc(notification.summary)}</div>
      <div class="notifFallback"><span>Fallback/action</span>${esc(notification.fallback)}</div>
    </div>
    <div class="notifRowSide">
      ${statusPill(state, notification)}
      ${severityPill(notification)}
      <span class="pill notifLayer">${esc(notification.layerLabel)}</span>
    </div>
  </button>`;
}

function renderList(state){
  const rows = filterNotifications(state).map(n => renderRow(n, state)).join('');
  return `<section class="card notifListPanel">
    <div class="notifPanelHead">
      <div><b>10 notifications</b><span>Cross-project operational queue</span></div>
      <button class="btn sm ghost" type="button">Newest first ${ic('chevd')}</button>
    </div>
    <div class="notifRows">${rows}</div>
  </section>`;
}

function renderDetail(state){
  const n = selectedNotification(state);
  const timeline = (n.timeline || []).map(step => `<div class="notifTimelineStep">
    <span class="mono">${esc(step[0])}</span><i></i><p>${esc(step[1])}</p>
  </div>`).join('');
  const explanation = n.explanation || [];

  return `<aside class="card pad notifDetailPanel">
    <div class="notifDetailTop">
      <div>
        <h2>${esc(n.title)}</h2>
        <div class="notifDetailPills">${severityPill(n)}${statusPill(state, n)}<span class="pill">${ic(n.layer)} ${esc(n.layerLabel)}</span></div>
      </div>
      <button class="iconbtn" data-act="notif-close-detail" title="Close detail">${ic('x')}</button>
    </div>

    <div class="notifKvGrid">
      ${[
        ['Project', n.project],
        ['Workflow', n.workflow],
        ['Owner', n.owner],
        ['SLA', n.sla],
        ['Failed node', n.failedNode],
        ['Failure layer', n.layerLabel],
        ['Trace ID', n.traceId],
        ['Run ID', n.runId],
        ['Impact', n.impact],
      ].map(([k,v]) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v ${/ID$/.test(k) ? 'mono' : ''}">${esc(v)}</span></div>`).join('')}
    </div>

    <div class="notifDetailBlock">
      <b>Fallback action taken</b>
      <p>${n.id === DEFAULT_ID ? 'Snowflake warehouse query executed via Evidence Warehouse MCP.' : esc(n.fallback)}</p>
    </div>
    <div class="notifDetailBlock">
      <b>Recommended next action</b>
      <p>${esc(n.action)}</p>
    </div>

    <div class="notifDetailBlock">
      <b>Mini recovery timeline</b>
      <div class="notifTimeline">${timeline}</div>
    </div>

    <div class="explain harness notifExplain">
      ${ic('layers')}
      <div>
        <b>${esc(explanation[0] || 'SkillTrace explanation')}</b>
        ${(explanation.slice(1)).map(line => `<p>${esc(line)}</p>`).join('')}
      </div>
    </div>

    <div class="notifDetailActions">
      <button class="btn primary" data-goto="warroom">${ic('users')} Open in War Room</button>
      <button class="btn" data-act="notif-ack">${ic('checkc')} Acknowledge</button>
      <button class="btn" data-act="notif-rerun">${ic('refresh')} Rerun Replay</button>
      <button class="btn" data-act="notif-read">${ic('bell')} Mark as Read</button>
      <button class="btn" data-act="notif-assign">${ic('user')} Assign Owner</button>
      <button class="btn" data-act="notif-trace">${ic('activity')} View Trace</button>
    </div>
  </aside>`;
}

Views.notifications = function(){
  const state = loadState();
  if(!selectedNotification(state)) state.selectedId = DEFAULT_ID;
  setTimeout(() => syncCounts(state), 0);
  return `<div class="notifFull" id="notificationsRoot">
    <div class="notifHeader">
      <div>
        <div class="notifCrumb">Projects / Notification Inbox</div>
        <h1>Notification Inbox</h1>
        <p>Workflow owners see failures, fallback decisions, approval waits, and recovered incidents across projects in one auditable queue.</p>
      </div>
      <div class="notifHeaderActions">
        <button class="btn">Scope: All projects ${ic('chevd')}</button>
        <button class="btn" data-act="notif-read-all">${ic('checkc')} Mark all read</button>
        <button class="btn" data-goto="warroom">${ic('users')} Open War Room</button>
        <button class="btn primary" data-goto="fallback">${ic('sliders')} Configure routing</button>
      </div>
    </div>
    ${renderTopFilters()}
    ${renderKpis()}
    <div class="notifMainGrid">
      ${renderFilterPanel(state)}
      ${renderList(state)}
      ${renderDetail(state)}
    </div>
  </div>`;
};

function rerender(){
  const root = document.querySelector('#notificationsRoot');
  if(root) root.outerHTML = Views.notifications();
  syncCounts();
}

function selectNotification(id){
  const state = loadState();
  state.selectedId = id;
  saveState(state);
  rerender();
}

function handleAct(action){
  const state = loadState();
  const selected = selectedNotification(state);
  if(action === 'notif-read-all'){
    (D.notifications || []).forEach(n => { state.read[n.id] = true; });
    saveState(state);
    syncCounts(state);
    rerender();
    window.OSTtoast?.('All notifications marked read','ok');
    return true;
  }
  if(action === 'notif-read' && selected){
    state.read[selected.id] = true;
    saveState(state);
    syncCounts(state);
    rerender();
    window.OSTtoast?.('Notification marked read','ok');
    return true;
  }
  if(action === 'notif-ack' && selected){
    state.read[selected.id] = true;
    state.status[selected.id] = 'acknowledged';
    saveState(state);
    syncCounts(state);
    rerender();
    window.OSTtoast?.('Acknowledged · audit trail updated','ok');
    return true;
  }
  if(action === 'notif-rerun'){
    const pass = window.OST?.runReplay?.();
    window.OSTtoast?.(pass ? `Replay rerun complete · ${pass}% pass rate` : 'Replay rerun queued','harness');
    return true;
  }
  if(action === 'notif-assign'){
    window.OSTtoast?.('Assign owner panel opened in prototype','info');
    return true;
  }
  if(action === 'notif-trace'){
    window.OSTtoast?.('Trace opened · timeline preserved for audit','info');
    return true;
  }
  if(action === 'notif-save-view'){
    window.OSTtoast?.('Saved as portfolio notification view','ok');
    return true;
  }
  if(action === 'notif-clear-filters'){
    state.filters = { status:'All' };
    saveState(state);
    rerender();
    window.OSTtoast?.('Filters cleared','info');
    return true;
  }
  if(action === 'notif-close-detail'){
    window.OSTtoast?.('Detail stays pinned in desktop layout','info');
    return true;
  }
  return false;
}

document.addEventListener('click', e => {
  const action = e.target.closest('[data-act^="notif-"]');
  if(action){
    e.preventDefault();
    e.stopImmediatePropagation();
    handleAct(action.dataset.act);
    return;
  }
  const filter = e.target.closest('[data-notif-filter]');
  if(filter){
    e.preventDefault();
    const state = loadState();
    if(filter.dataset.notifFilter === 'status') state.filters.status = filter.dataset.value;
    saveState(state);
    rerender();
    return;
  }
  const row = e.target.closest('[data-notification-id]');
  if(row){
    e.preventDefault();
    selectNotification(row.dataset.notificationId);
  }
});

window.OSTNotifications = { syncCounts, handleAct };
})();
