/* ===== OpenSkillTrace — Workflow Studio engine (free-form node canvas) ===== */
(function(){
const D = window.DATA, ic = window.icon;
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

const blockMap = {};
D.blocks.forEach(g=>g.items.forEach(b=>blockMap[b.id]=b));
const PORT_Y = 53.5;          // vertical center of port dots (CSS top:46 + 7.5)
let newSeq = Math.max(1, ...D.flow.map(n=>Number((n.id.match(/n-new-(\d+)/)||[])[1])||0)) + 1;

window.initStudio = function(root){
  if(root._studio) return; root._studio = true;

  const studio   = $('#studioFull', root);
  const canvas   = $('#gcanvas', root);
  const viewport = $('#gviewport', root);
  const wire     = $('#wireLayer', root);
  const zlvl     = $('#zlvl', root);

  // shared mutable graph state
  const edges = D.edges;
  const nodeById = id => D.flow.find(n=>n.id===id);
  const elById   = id => viewport.querySelector(`.gnode[data-node="${id}"]`);

  let tx = 0, ty = 0, scale = 1;
  let panelMode = 'inspector';
  let runNodeStates = {};
  let runEdgeStates = {};
  const HOT = new Set(['harness','approval','output']);

  function applyTransform(){
    viewport.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    if(zlvl) zlvl.textContent = Math.round(scale*100)+'%';
  }
  function screenToCanvas(clientX, clientY){
    const r = canvas.getBoundingClientRect();
    return { x:(clientX - r.left - tx)/scale, y:(clientY - r.top - ty)/scale };
  }
  function nodeAtPoint(clientX, clientY){
    const hit = document.elementFromPoint(clientX, clientY);
    const node = hit && hit.closest ? hit.closest('.gnode') : null;
    return node && viewport.contains(node) ? node : null;
  }

  /* ---------- edge drawing ---------- */
  function portPos(el, side){
    const x = side==='out' ? el.offsetLeft + el.offsetWidth : el.offsetLeft;
    return { x, y: el.offsetTop + PORT_Y };
  }
  function edgePath(s, t){
    const dx = Math.max(46, Math.abs(t.x - s.x) * 0.42);
    return `M ${s.x} ${s.y} C ${s.x+dx} ${s.y}, ${t.x-dx} ${t.y}, ${t.x} ${t.y}`;
  }
  function drawEdges(){
    let defs = `<defs>
      <marker id="arw" markerWidth="10" markerHeight="10" refX="7" refY="4.5" orient="auto"><path d="M1.5 1.5 L7.5 4.5 L1.5 7.5" fill="none" stroke="#c2cbd9" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker>
      <marker id="arwH" markerWidth="10" markerHeight="10" refX="7" refY="4.5" orient="auto"><path d="M1.5 1.5 L7.5 4.5 L1.5 7.5" fill="none" stroke="#f97316" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>
    </defs>`;
    let paths = '';
    edges.forEach(([from,to])=>{
      const se = elById(from), te = elById(to); if(!se||!te) return;
      const s = portPos(se,'out'), t = portPos(te,'in');
      const sn = nodeById(from), tn = nodeById(to);
      const hot = (sn&&HOT.has(sn.t)) || (tn&&HOT.has(tn.t));
      const edgeState = runEdgeStates[`${from}->${to}`];
      paths += `<path class="wirePath${hot?' hot':''}${edgeState?` edge-${edgeState}`:''}" d="${edgePath(s,t)}" marker-end="url(#${hot?'arwH':'arw'})"></path>`;
    });
    wire.innerHTML = defs + paths;
  }

  function syncSummary(){
    const s = window.OST.workflowSummary();
    const status = $('#studioSaveState',root);
    if(status) status.textContent = `${s.nodes} nodes · ${s.edges} links · ${window.OST.state.lastSaved}`;
  }
  function persist(reason='canvas changed'){
    window.OST.markDirty(reason);
    syncSummary();
  }
  function updateNodeEl(id){
    const n = nodeById(id), old = elById(id); if(!n||!old) return;
    const wasSelected = old.classList.contains('selected');
    old.insertAdjacentHTML('afterend', window.renderGNode(n));
    const fresh = old.nextElementSibling;
    if(wasSelected) fresh.classList.add('selected');
    old.remove();
    applyNodeRunState(id);
    drawEdges();
    syncSummary();
  }
  function addExistingNode(node){
    if(elById(node.id)) updateNodeEl(node.id);
    else viewport.insertAdjacentHTML('beforeend', window.renderGNode(node));
    const el = elById(node.id); if(el) el.classList.add('justAdded');
    select(node.id); drawEdges(); syncSummary();
  }

  /* ---------- selection / inspector ---------- */
  function select(id){
    $$('.gnode',viewport).forEach(n=>n.classList.toggle('selected', n.dataset.node===id));
    const n = nodeById(id); if(!n) return;
    if(panelMode!=='inspector') return;
    renderInspectorPanel(id);
    // make sure inspector panel is open
    $('#ginspector',root).classList.remove('collapsed');
  }
  function renderInspectorPanel(id){
    const n = nodeById(id); if(!n) return;
    const body = $('#inspBody',root);
    const known = ['n-input','n-agent','n-tools','n-rag','n-class','n-policy','n-out','n-cap'].includes(id);
    body.innerHTML = known ? window.renderInspector(id) : window.genericInspector(n);
    window.wireAccordions(body.parentElement);
    const panel = $('#ginspector',root);
    panel.classList.remove('previewMode');
    const title = $('#panelTitle',root); if(title) title.textContent = 'Harness Inspector';
    const lbl = $('#inspSel',root); if(lbl) lbl.textContent = n.title;
  }
  function showInspector(id){
    panelMode='inspector';
    renderInspectorPanel(id || ($('.gnode.selected',viewport)?.dataset.node) || 'n-agent');
    $('#ginspector',root).classList.remove('collapsed');
  }
  function showPreview(){
    panelMode='preview';
    const panel = $('#ginspector',root);
    panel.classList.add('previewMode');
    const title = $('#panelTitle',root); if(title) title.textContent = 'Preview';
    const lbl = $('#inspSel',root); if(lbl) lbl.textContent = 'Live workflow run';
    const body = $('#inspBody',root);
    body.innerHTML = window.renderPreviewPanel();
    panel.classList.remove('collapsed');
    setTimeout(fit, 30);
  }

  function applyNodeRunState(id){
    const el = elById(id); if(!el) return;
    el.classList.remove('node-running','node-passed','node-failed','node-healing');
    const badge = el.querySelector('.gnRunBadge');
    if(badge){
      badge.className = 'gnRunBadge';
      badge.hidden = true;
      badge.textContent = '';
    }
    const state = runNodeStates[id];
    if(!state) return;
    el.classList.add(`node-${state}`);
    if(badge){
      badge.hidden = false;
      badge.classList.add(state);
      badge.textContent = state==='running'?'run':state==='passed'?'ok':state==='failed'?'err':'heal';
    }
  }
  function setNodeRunState(id, state){
    if(!id) return;
    if(state) runNodeStates[id]=state;
    else delete runNodeStates[id];
    applyNodeRunState(id);
    edges.forEach(([from,to])=>{
      if(to===id){
        if(state) runEdgeStates[`${from}->${to}`] = state==='passed'?'passed':state;
        else delete runEdgeStates[`${from}->${to}`];
      }
    });
    drawEdges();
  }
  function clearRunStates(){
    runNodeStates = {};
    runEdgeStates = {};
    $$('.gnode',viewport).forEach(el=>applyNodeRunState(el.dataset.node));
    drawEdges();
  }

  /* ---------- create / delete ---------- */
  function addNode(blockId, cx, cy){
    const b = blockMap[blockId]; if(!b) return;
    const id = 'n-new-'+(newSeq++);
    const node = { id, t:b.t, icon:b.icon, title:b.name, type:b.kind,
      desc:b.desc, port:'configure in inspector', meta:[{c:'fb',t:'harness on'}], badge:'trace + policy',
      x: Math.round(cx-118), y: Math.round(cy-PORT_Y) };
    D.flow.push(node);
    addExistingNode(node);
    persist('canvas changed');
    window.OSTtoast(`Added “${b.name}” · harness applied automatically`,'harness');
  }
  function addCatalogItem(item){
    const r = canvas.getBoundingClientRect();
    const p = screenToCanvas(r.left + r.width*.54, r.top + r.height*.52);
    const node = window.OST.createWorkflowNode(item, {x:Math.round(p.x), y:Math.round(p.y)});
    addExistingNode(node);
    fit();
    return node;
  }
  function deleteNode(id){
    const el = elById(id); if(el) el.remove();
    for(let i=edges.length-1;i>=0;i--) if(edges[i][0]===id||edges[i][1]===id) edges.splice(i,1);
    const idx = D.flow.findIndex(n=>n.id===id); if(idx>=0) D.flow.splice(idx,1);
    drawEdges(); persist('canvas changed'); window.OSTtoast('Step removed','info');
  }

  /* ---------- pointer: pan + node drag + connect ---------- */
  let mode=null, moved=false, start={}, dragId=null, connectFrom=null, tempEl=null;

  canvas.addEventListener('pointerdown', e=>{
    const del = e.target.closest('.gnDel');
    if(del){ e.stopPropagation(); deleteNode(del.dataset.del); return; }

    const port = e.target.closest('.gPortDot.pout');
    if(port){ // start a connection
      e.preventDefault();
      mode='connect'; connectFrom = port.dataset.from; moved=false;
      tempEl = document.createElementNS('http://www.w3.org/2000/svg','path');
      tempEl.setAttribute('class','tempWire'); wire.appendChild(tempEl);
      canvas.classList.add('connecting');
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    const node = e.target.closest('.gnode');
    if(node){ // drag node (and remember for click-select)
      mode='node'; dragId = node.dataset.node; moved=false;
      const n = nodeById(dragId);
      start = { px:e.clientX, py:e.clientY, nx:n.x, ny:n.y };
      node.classList.add('dragging');
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    // pan background
    mode='pan'; moved=false; start={ px:e.clientX, py:e.clientY, tx, ty };
    canvas.classList.add('panning');
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e=>{
    if(!mode) return;
    const ddx = e.clientX-start.px, ddy = e.clientY-start.py;
    if(Math.abs(ddx)+Math.abs(ddy) > 3) moved=true;
    if(mode==='pan'){ tx = start.tx+ddx; ty = start.ty+ddy; applyTransform(); }
    else if(mode==='node'){
      const n = nodeById(dragId); const el = elById(dragId);
      n.x = Math.round(start.nx + ddx/scale); n.y = Math.round(start.ny + ddy/scale);
      el.style.left = n.x+'px'; el.style.top = n.y+'px';
      drawEdges();
    }
    else if(mode==='connect'){
      const p = screenToCanvas(e.clientX, e.clientY);
      const se = elById(connectFrom); const s = portPos(se,'out');
      tempEl.setAttribute('d', edgePath(s, {x:p.x, y:p.y}));
      const over = nodeAtPoint(e.clientX, e.clientY);
      $$('.gnode.connectTarget',viewport).forEach(x=>x.classList.remove('connectTarget'));
      if(over && over.dataset.node!==connectFrom) over.classList.add('connectTarget');
    }
  });

  function endPointer(e){
    if(mode==='connect'){
      const over = nodeAtPoint(e.clientX, e.clientY);
      if(over && over.dataset.node!==connectFrom){
        const to = over.dataset.node;
        if(!edges.some(([a,b])=>a===connectFrom&&b===to)){
          edges.push([connectFrom,to]);
          persist('canvas changed');
          window.OSTtoast('Connected · harness carries across the link','harness');
        }
      }
      if(tempEl){ tempEl.remove(); tempEl=null; }
      $$('.gnode.connectTarget',viewport).forEach(x=>x.classList.remove('connectTarget'));
      drawEdges();
    }
    if(mode==='node'){
      const el = elById(dragId); if(el) el.classList.remove('dragging');
      if(!moved) select(dragId);   // it was a click, not a drag
      else persist('canvas changed');
    }
    canvas.classList.remove('panning','connecting');
    mode=null; dragId=null; connectFrom=null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  /* ---------- zoom ---------- */
  function zoomAt(factor, ox, oy){
    const r = canvas.getBoundingClientRect();
    const cx = ox - r.left, cy = oy - r.top;
    const ns = clamp(scale*factor, 0.35, 1.8);
    const k = ns/scale;
    tx = cx - (cx - tx)*k; ty = cy - (cy - ty)*k;
    scale = ns; applyTransform(); drawEdges();
  }
  canvas.addEventListener('wheel', e=>{
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.1 : 1/1.1, e.clientX, e.clientY);
  }, {passive:false});

  function bbox(){
    const els = $$('.gnode',viewport); let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
    els.forEach(el=>{ minX=Math.min(minX,el.offsetLeft); minY=Math.min(minY,el.offsetTop);
      maxX=Math.max(maxX,el.offsetLeft+el.offsetWidth); maxY=Math.max(maxY,el.offsetTop+el.offsetHeight); });
    return {minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY,n:els.length};
  }
  function fit(){
    const b = bbox(); if(!b.n) return;
    const r = canvas.getBoundingClientRect();
    const padL = $('#gpalette',root).classList.contains('collapsed')?70:272;
    const padR = $('#ginspector',root).classList.contains('collapsed')?70:366;
    const padTop=104, padBottom=64;
    const availW = Math.max(240, r.width-padL-padR), availH = Math.max(240, r.height-padTop-padBottom);
    scale = clamp(Math.min(availW/b.w, availH/b.h), 0.35, 1.2);
    tx = padL + (availW - b.w*scale)/2 - b.minX*scale;
    ty = padTop + (availH - b.h*scale)/2 - b.minY*scale;
    applyTransform(); drawEdges();
  }
  // opening view: readable zoom, anchored at the start of the flow
  function home(){
    const b = bbox(); if(!b.n) return;
    const r = canvas.getBoundingClientRect();
    const padL = $('#gpalette',root).classList.contains('collapsed')?70:272;
    scale = 0.82;
    tx = padL - b.minX*scale;
    ty = (r.height - b.h*scale)/2 - b.minY*scale;
    applyTransform(); drawEdges();
  }

  root.addEventListener('click', e=>{
    const z = e.target.closest('[data-zoom]'); if(!z) return;
    const k = z.dataset.zoom;
    if(k==='fit'){ fit(); return; }
    const r = canvas.getBoundingClientRect();
    zoomAt(k==='in'?1.18:1/1.18, r.left+r.width/2, r.top+r.height/2);
  });

  /* ---------- palette drag (HTML5 DnD) → drop on canvas ---------- */
  let dndBlock=null;
  $$('.block',root).forEach(b=>{
    b.addEventListener('dragstart',ev=>{ dndBlock=b.dataset.block; b.classList.add('dragging'); ev.dataTransfer.effectAllowed='copy'; });
    b.addEventListener('dragend',()=>{ b.classList.remove('dragging'); dndBlock=null; });
  });
  canvas.addEventListener('dragover', ev=>{ ev.preventDefault(); ev.dataTransfer.dropEffect='copy'; });
  canvas.addEventListener('drop', ev=>{
    ev.preventDefault(); if(!dndBlock) return;
    const p = screenToCanvas(ev.clientX, ev.clientY);
    addNode(dndBlock, p.x, p.y); dndBlock=null;
  });

  /* ---------- palette tabs + search ---------- */
  const palTabFor = { 'All':null,'Input':'input','Agent':'agent','Tools':'tool','Harness':'harness','RAG':'rag' };
  $$('.palTabs button',root).forEach(btn=>btn.addEventListener('click',()=>{
    $$('.palTabs button',root).forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    const t = palTabFor[btn.textContent.trim()];
    $$('.palList .block',root).forEach(bl=> bl.style.display = (!t||bl.dataset.type===t)?'':'none');
    $$('.palGroupLbl',root).forEach(l=>l.style.display = t?'none':'');
  }));
  const psearch = $('.paletteSearch input',root);
  if(psearch) psearch.addEventListener('input',()=>{
    const q = psearch.value.toLowerCase();
    $$('.palList .block',root).forEach(bl=> bl.style.display = bl.textContent.toLowerCase().includes(q)?'':'none');
    $$('.palGroupLbl',root).forEach(l=>l.style.display = q?'none':'');
  });

  /* ---------- harness overlay toggle ---------- */
  const hT = $('#hToggle',root);
  if(hT) hT.addEventListener('click',()=>{
    const on = studio.classList.toggle('harness-on');
    hT.classList.toggle('on',on); hT.classList.toggle('off',!on);
    window.OSTtoast(on?'Harness overlay on':'Harness overlay hidden', on?'harness':'info');
  });

  /* ---------- panel collapse ---------- */
  $$('[data-collapse]',root).forEach(btn=>btn.addEventListener('click',()=>{
    const p = $('#'+btn.dataset.collapse, root); p.classList.toggle('collapsed');
    btn.style.transform = p.classList.contains('collapsed')?'rotate(180deg)':'';
  }));

  /* ---------- accordions in default inspector + boot ---------- */
  window.wireAccordions(root);
  applyTransform();
  function boot(tries){
    const r = canvas.getBoundingClientRect();
    if(r.width < 60 && tries>0){ setTimeout(()=>boot(tries-1), 60); return; }
    drawEdges(); home();
  }
  setTimeout(()=>boot(8), 30);
  let rt; window.addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(drawEdges,120); });
  window.OSTStudio = { addCatalogItem, updateNodeEl, drawEdges, fit, syncSummary, showPreview, showInspector, setNodeRunState, clearRunStates };
  syncSummary();
};
})();
