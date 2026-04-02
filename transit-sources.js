/**
 * transit-sources.js
 * Two-tab transit data management app:
 *   Tab 1 — My Database  (Supabase CRUD, Google Sheet style)
 *   Tab 2 — Browse All   (Mobility Database CSV, read-only)
 */

// ═══════════════════════════════════════════════════════════════════════
// 1. Constants & config
// ═══════════════════════════════════════════════════════════════════════

const FEEDS_V2_URL    = 'feeds_v2.csv';
const TRANSITLAND_API = 'https://transit.land/api/v2/rest';
const NOMINATIM_URL   = 'https://nominatim.openstreetmap.org/search';

const MODES    = ['Bus', 'Tram', 'Metro', 'Rail', 'Ferry', 'BRT', 'Cable', 'Other'];
const STATUSES = ['NOT STARTED', 'SOURCING', 'WORKING', 'FINISHED FOR NOW', 'BLOCKED'];

const STATUS_CSS = {
  'NOT STARTED':    's-not-started',
  'SOURCING':       's-sourcing',
  'WORKING':        's-working',
  'FINISHED FOR NOW': 's-finished',
  'FINISHED':       's-finished',
  'BLOCKED':        's-blocked',
};

const STATUS_ORDER = {
  'WORKING': 0, 'SOURCING': 1, 'NOT STARTED': 2,
  'FINISHED FOR NOW': 3, 'FINISHED': 3, 'BLOCKED': 4,
};

// Seed data is now in Supabase — see supabase-schema.sql

// ═══════════════════════════════════════════════════════════════════════
// 3. DB — Supabase + in-memory cache
// ═══════════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://ybkvkpuujvqpodjlcumd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlia3ZrcHV1anZxcG9kamxjdW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzE4MjAsImV4cCI6MjA5MDY0NzgyMH0.qZi4ap8s280lcdYHP__GSFFRimFbYVmkQJij0uL3yCY';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// In-memory cache — loadDB() returns this synchronously
let dbCache = { countries:{}, agencies:{} };

function mkUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Map Supabase snake_case row → camelCase agency object
function agencyFromRow(r) {
  return {
    id: r.id, countryCode: r.country_code, subdivision: r.subdivision||'',
    cityRegion: r.city_region||'', agencyName: r.agency_name,
    modes: r.modes||[], hasStatic: r.has_static||false, staticUrl: r.static_url||'',
    hasRT: r.has_rt||false, rtVpUrl: r.rt_vp_url||'', rtTuUrl: r.rt_tu_url||'', rtSaUrl: r.rt_sa_url||'',
    quality: r.quality||'', status: r.status||'NOT STARTED', notes: r.notes||'',
    source: r.source||'manual', mdbSourceId: r.mdb_source_id||'',
    addedAt: r.created_at, updatedAt: r.updated_at,
  };
}

// Map camelCase agency fields → snake_case for Supabase
function agencyToRow(fields) {
  const map = {
    countryCode:'country_code', subdivision:'subdivision', cityRegion:'city_region',
    agencyName:'agency_name', modes:'modes', hasStatic:'has_static', staticUrl:'static_url',
    hasRT:'has_rt', rtVpUrl:'rt_vp_url', rtTuUrl:'rt_tu_url', rtSaUrl:'rt_sa_url',
    quality:'quality', status:'status', notes:'notes', source:'source', mdbSourceId:'mdb_source_id',
  };
  const row = {};
  for (const [k, v] of Object.entries(fields)) {
    if (map[k] !== undefined) row[map[k]] = v;
  }
  return row;
}

// Load all data from Supabase into cache
async function initDB() {
  const [cRes, aRes] = await Promise.all([
    sb.from('countries').select('*'),
    sb.from('agencies').select('*'),
  ]);
  if (cRes.error) { console.error('Failed to load countries:', cRes.error); toast('DB connection error — check console', 'error'); return; }
  if (aRes.error) { console.error('Failed to load agencies:', aRes.error); toast('DB connection error — check console', 'error'); return; }
  dbCache.countries = {};
  for (const c of cRes.data) dbCache.countries[c.code] = { code: c.code, status: c.status };
  dbCache.agencies = {};
  for (const r of aRes.data) { const ag = agencyFromRow(r); dbCache.agencies[ag.id] = ag; }
}

// Synchronous read from cache
function loadDB() { return dbCache; }

async function dbAdd(fields) {
  const id = mkUuid();
  const row = { id, ...agencyToRow({ source:'manual', mdbSourceId:'', ...fields }) };
  const { error } = await sb.from('agencies').insert(row);
  if (error) { console.error('dbAdd error:', error); toast('Save failed — ' + error.message, 'error'); return null; }
  dbCache.agencies[id] = { id, source:'manual', mdbSourceId:'', ...fields, addedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return id;
}

async function dbUpdate(id, fields) {
  if (!dbCache.agencies[id]) return;
  const row = agencyToRow(fields);
  const { error } = await sb.from('agencies').update(row).eq('id', id);
  if (error) { console.error('dbUpdate error:', error); toast('Update failed — ' + error.message, 'error'); return; }
  dbCache.agencies[id] = { ...dbCache.agencies[id], ...fields, updatedAt: new Date().toISOString() };
}

async function dbDelete(id) {
  const { error } = await sb.from('agencies').delete().eq('id', id);
  if (error) { console.error('dbDelete error:', error); toast('Delete failed — ' + error.message, 'error'); return; }
  delete dbCache.agencies[id];
}

async function dbSetCountryStatus(code, status) {
  const { error } = await sb.from('countries').update({ status }).eq('code', code);
  if (error) { console.error('dbSetCountryStatus error:', error); toast('Update failed — ' + error.message, 'error'); return; }
  if (dbCache.countries[code]) dbCache.countries[code].status = status;
}

async function dbAddCountry(code, status='NOT STARTED') {
  if (dbCache.countries[code]) return;
  const { error } = await sb.from('countries').insert({ code, status });
  if (error) { console.error('dbAddCountry error:', error); toast('Add failed — ' + error.message, 'error'); return; }
  dbCache.countries[code] = { code, status };
}

async function dbRemoveCountry(code) {
  // Agencies are CASCADE deleted in DB, but also clean cache
  const { error } = await sb.from('countries').delete().eq('code', code);
  if (error) { console.error('dbRemoveCountry error:', error); toast('Remove failed — ' + error.message, 'error'); return; }
  delete dbCache.countries[code];
  Object.keys(dbCache.agencies).forEach(id => { if (dbCache.agencies[id].countryCode===code) delete dbCache.agencies[id]; });
}

// ═══════════════════════════════════════════════════════════════════════
// 4. Utilities
// ═══════════════════════════════════════════════════════════════════════

const regionNames = new Intl.DisplayNames(['en'], { type:'region' });
function countryName(code) {
  if (!code) return 'Unknown';
  try { return regionNames.of(code.toUpperCase()); } catch { return code; }
}
function flagEmoji(code) {
  if (!code || code.length!==2 || !/^[A-Za-z]{2}$/.test(code)) return '';
  try { return String.fromCodePoint(...[...code.toUpperCase()].map(c=>0x1F1E0+c.charCodeAt(0)-65)); }
  catch { return ''; }
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function csvCell(v) {
  const s = String(v??'');
  return (s.includes(',')||s.includes('"')||s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s;
}
function toast(msg, type='info') {
  const c=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className=`toast toast-${type}`; t.textContent=msg; c.appendChild(t);
  setTimeout(()=>t.remove(), 3500);
}
function statusBadge(status) {
  return `<span class="status-badge ${STATUS_CSS[status]||'s-not-started'}">${esc(status||'NOT STARTED')}</span>`;
}
function modeBadges(modes=[]) {
  if (!modes.length) return '<span style="color:#ccc;font-size:12px">—</span>';
  return modes.map(m=>`<span class="badge badge-mode">${esc(m)}</span>`).join('');
}
function rtBadges(ag) {
  const vp = ag.rtVpUrl ? `<span class="badge badge-vp"><a href="${esc(ag.rtVpUrl)}" target="_blank" rel="noopener">VP</a></span>` : '';
  const tu = ag.rtTuUrl ? `<span class="badge badge-tu"><a href="${esc(ag.rtTuUrl)}" target="_blank" rel="noopener">TU</a></span>` : '';
  const sa = ag.rtSaUrl ? `<span class="badge badge-sa"><a href="${esc(ag.rtSaUrl)}" target="_blank" rel="noopener">SA</a></span>` : '';
  return vp+tu+sa || '<span class="badge badge-no">No</span>';
}
function staticBadge(ag) {
  if (!ag.hasStatic) return '<span class="badge badge-no">No</span>';
  return ag.staticUrl
    ? `<span class="badge badge-yes"><a href="${esc(ag.staticUrl)}" target="_blank" rel="noopener">Yes</a></span>`
    : '<span class="badge badge-yes">Yes</span>';
}
function validatorLink(ag) {
  const p = new URLSearchParams();
  if (ag.staticUrl) p.set('static', ag.staticUrl);
  if (ag.rtTuUrl) p.set('tu', ag.rtTuUrl);
  if (ag.rtVpUrl) p.set('vp', ag.rtVpUrl);
  if (ag.rtSaUrl) p.set('sa', ag.rtSaUrl);
  return `gtfs-validator.html?${p.toString()}`;
}
function qualityBadge(q) {
  if (!q) return '<span style="color:#ccc">—</span>';
  const cls = q==='High'?'badge-quality-high':q==='Medium'?'badge-quality-medium':'badge-quality-low';
  return `<span class="badge ${cls}">${esc(q)}</span>`;
}
function normalizeAgencyName(s) { return s.toLowerCase().replace(/[^a-z0-9]/g,''); }

// ═══════════════════════════════════════════════════════════════════════
// 5. CSV parser (MDB)
// ═══════════════════════════════════════════════════════════════════════

function parseCSVLine(line) {
  const r=[]; let cur='', inQ=false;
  for (let i=0;i<line.length;i++) {
    const c=line[i];
    if (c==='"') { if (inQ&&line[i+1]==='"'){cur+='"';i++;} else inQ=!inQ; }
    else if (c===','&&!inQ){r.push(cur);cur='';}
    else cur+=c;
  }
  r.push(cur); return r;
}
function parseCSV(text) {
  // Split into logical lines, handling quoted fields that contain newlines
  const logicalLines=[];
  let cur='', inQ=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (c==='"') { inQ=!inQ; cur+=c; }
    else if (c==='\n'&&!inQ) { logicalLines.push(cur); cur=''; }
    else if (c==='\r'&&!inQ) { /* skip \r */ }
    else cur+=c;
  }
  if (cur.trim()) logicalLines.push(cur);
  const headers=parseCSVLine(logicalLines[0]).map(h=>h.trim()), rows=[];
  for (let i=1;i<logicalLines.length;i++) {
    const line=logicalLines[i].trim(); if (!line) continue;
    const vals=parseCSVLine(line), row={};
    headers.forEach((h,idx)=>{ row[h]=(vals[idx]??'').trim(); });
    rows.push(row);
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════
// 6. MDB feed processor (for Browse All + Import)
// ═══════════════════════════════════════════════════════════════════════

let allMdbAgencies = []; // loaded once for Browse All
let mdbLoaded = false;

function feedId(row) { return row['mdb_source_id'] || row['id'] || ''; }

function processFeeds(rows) {
  const staticById={}, rtFeeds=[];
  for (const row of rows) {
    if (row['data_type']==='gtfs') staticById[feedId(row)]=row;
    else if (row['data_type']==='gtfs_rt') rtFeeds.push(row);
  }
  const agencies=new Map(), agByStaticId={};
  function agKey(f){ return [f['location.country_code']||'',f['location.subdivision_name']||'',f['location.municipality']||'',f['provider']||''].join('|'); }
  function getOrCreate(f){
    const key=agKey(f);
    if (!agencies.has(key)) agencies.set(key,{key,country:f['location.country_code']||'',subdivision:f['location.subdivision_name']||'',municipality:f['location.municipality']||'',provider:f['provider']||'',staticFeeds:[],rtVP:[],rtTU:[],rtSA:[],coverageLevel:'static_only'});
    return agencies.get(key);
  }
  for (const [id,feed] of Object.entries(staticById)) { const ag=getOrCreate(feed); ag.staticFeeds.push(feed); agByStaticId[id]=ag; }
  for (const rt of rtFeeds) {
    const ref=rt['static_reference']?.trim();
    const ag=(ref&&agByStaticId[ref])?agByStaticId[ref]:getOrCreate(rt);
    const et=(rt['entity_type']||'').toLowerCase();
    if (et.includes('vp')) ag.rtVP.push(rt);
    if (et.includes('tu')) ag.rtTU.push(rt);
    if (et.includes('sa')) ag.rtSA.push(rt);
  }
  for (const ag of agencies.values()) {
    const active=f=>!f['status']||f['status']==='active';
    const hs=ag.staticFeeds.some(active), hv=ag.rtVP.some(active), ht=ag.rtTU.some(active), hasRT=hv||ht||ag.rtSA.some(active);
    if (hs&&hv&&ht) ag.coverageLevel='full';
    else if (hs&&hasRT) ag.coverageLevel='partial_rt';
    else if (hs) ag.coverageLevel='static_only';
    else ag.coverageLevel='rt_only';
  }
  return Array.from(agencies.values());
}

// ═══════════════════════════════════════════════════════════════════════
// 7. My Database tab — render
// ═══════════════════════════════════════════════════════════════════════

let mydbSearch='', mydbStatusFilter='', mydbCountryFilter='';

function getMyDBFiltered() {
  const db=loadDB();
  let ags=Object.values(db.agencies);
  if (mydbStatusFilter) {
    const f=mydbStatusFilter;
    if (f==='FINISHED FOR NOW') ags=ags.filter(a=>a.status==='FINISHED FOR NOW'||a.status==='FINISHED');
    else ags=ags.filter(a=>a.status===f);
  }
  if (mydbCountryFilter) ags=ags.filter(a=>a.countryCode===mydbCountryFilter);
  if (mydbSearch) {
    const q=mydbSearch.toLowerCase();
    ags=ags.filter(a=>[a.agencyName,a.cityRegion,a.countryCode,countryName(a.countryCode)].join(' ').toLowerCase().includes(q));
  }
  return ags;
}

function renderMyDatabase() {
  try { _renderMyDatabase(); }
  catch(e) {
    const area=document.getElementById('mydb-results');
    if (area) area.innerHTML=`<div class="center-state" style="color:#c62828"><p style="font-weight:700">Render error</p><p class="sub">${esc(e.message)}</p><p class="sub" style="font-size:11px">${esc(e.stack||'')}</p></div>`;
    console.error('renderMyDatabase error:', e);
  }
}
function _renderMyDatabase() {
  const area=document.getElementById('mydb-results');
  const db=loadDB();
  const ags=getMyDBFiltered();

  // Update count
  const countEl=document.getElementById('mydb-count');
  if (countEl) countEl.textContent=`${ags.length.toLocaleString()} of ${Object.keys(db.agencies).length.toLocaleString()} agencies`;

  // Populate country filter
  const cSel=document.getElementById('f-mydb-country');
  const prevCC=cSel.value;
  while(cSel.options.length>1) cSel.remove(1);
  Object.keys(db.countries).sort((a,b)=>countryName(a).localeCompare(countryName(b))).forEach(cc=>{
    const o=document.createElement('option'); o.value=cc; o.textContent=`${countryName(cc)} (${cc})`;
    if(cc===prevCC) o.selected=true; cSel.appendChild(o);
  });

  if (!Object.keys(db.countries).length) {
    area.innerHTML=`<div class="center-state">
      <p>No countries added yet.</p>
      <p class="sub">Use "Add Country" to start tracking a region.</p>
    </div>`;
    return;
  }

  // Group by country, show all countries even if empty (filtered or not)
  const byCC={};
  for (const cc of Object.keys(db.countries)) byCC[cc]=[];
  for (const ag of ags) (byCC[ag.countryCode]??=[]).push(ag);

  // Sort countries: by status order, then alphabetically
  const sorted=Object.entries(byCC).sort(([a],[b])=>{
    const sa=STATUS_ORDER[db.countries[a]?.status]??9, sb=STATUS_ORDER[db.countries[b]?.status]??9;
    if (sa!==sb) return sa-sb;
    return countryName(a).localeCompare(countryName(b));
  });

  // If filtered, hide countries with no matches (unless country filter is active)
  const display = mydbSearch||mydbStatusFilter
    ? sorted.filter(([cc,ags])=>ags.length>0)
    : sorted;

  if (!display.length) {
    area.innerHTML='<div class="center-state"><p>No agencies match your filters.</p></div>';
    return;
  }

  area.innerHTML='';
  for (const [cc, countryAgs] of display) {
    area.appendChild(renderCountryTable(cc, countryAgs, db));
  }
}

function renderCountryTable(cc, ags, db) {
  const wrap=document.createElement('div');
  wrap.className='country-db-section';
  wrap.style.cssText='background:white;border:1px solid #e0e0e0;border-radius:10px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05)';

  const countryStatus=db.countries[cc]?.status||'NOT STARTED';
  const isOpen=ags.length>0 && ags.length<=12;

  // Sort agencies within country: city, then name
  const sortedAgs=[...ags].sort((a,b)=>(a.cityRegion||'').localeCompare(b.cityRegion||'')||(a.agencyName||'').localeCompare(b.agencyName||''));

  // ── Header
  const hdr=document.createElement('div');
  hdr.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 14px;background:#1c3a72;color:white;cursor:pointer;user-select:none';
  hdr.innerHTML=`
    <button class="cg-chevron ${isOpen?'open':''}" title="Toggle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <span class="cg-name">${esc(countryName(cc))} (${esc(cc)})</span>
    <span class="cg-count">${ags.length} agenc${ags.length===1?'y':'ies'}</span>
    <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
      <select class="status-select ${STATUS_CSS[countryStatus]||'s-not-started'}" data-cc="${esc(cc)}" title="Country status">
        ${STATUSES.map(s=>`<option${s===countryStatus?' selected':''}>${esc(s)}</option>`).join('')}
      </select>
      <button class="cg-btn" data-action="add-agency" data-cc="${esc(cc)}" title="Add agency to this country">+ Add</button>
      <button class="cg-btn cg-btn-danger" data-action="remove-country" data-cc="${esc(cc)}" title="Remove country">✕</button>
    </div>`;

  // Prevent row click from toggling when interacting with controls
  hdr.querySelector('.status-select').addEventListener('change', async e=>{
    e.stopPropagation();
    const sel=e.target;
    await dbSetCountryStatus(cc, sel.value);
    sel.className=`status-select ${STATUS_CSS[sel.value]||'s-not-started'}`;
    toast(`${countryName(cc)} → ${sel.value}`, 'success');
  });
  hdr.querySelector('[data-action="add-agency"]').addEventListener('click', e=>{
    e.stopPropagation(); openAgencyModal(null, cc);
  });
  hdr.querySelector('[data-action="remove-country"]').addEventListener('click', async e=>{
    e.stopPropagation();
    const n=Object.values(loadDB().agencies).filter(a=>a.countryCode===cc).length;
    if (!confirm(`Remove ${countryName(cc)}?${n ? ` This will also delete ${n} agency record${n===1 ? '' : 's'}.` : ''}`)) return;
    await dbRemoveCountry(cc); toast(`Removed ${countryName(cc)}`, 'info'); renderMyDatabase();
  });
  hdr.querySelector('.cg-chevron').addEventListener('click', e=>{ e.stopPropagation(); toggleCountryBody(body, hdr.querySelector('.cg-chevron')); });
  hdr.addEventListener('click', ()=>toggleCountryBody(body, hdr.querySelector('.cg-chevron')));
  wrap.appendChild(hdr);

  // ── Body
  const body=document.createElement('div');
  body.style.display=isOpen?'block':'none';

  if (!ags.length) {
    body.innerHTML=`<div class="empty-country">
      No agencies yet for this country.
      <br><button class="add-first-agency" data-cc="${esc(cc)}">+ Add first agency</button>
    </div>`;
    body.querySelector('.add-first-agency').addEventListener('click', ()=>openAgencyModal(null, cc));
  } else {
    // Group by subdivision
    const bySub={};
    for (const ag of sortedAgs) (bySub[ag.subdivision||'']??=[]).push(ag);
    const subEntries=Object.entries(bySub).sort((a,b)=>{
      if (a[0]===''&&b[0]!=='') return 1; if (b[0]===''&&a[0]!=='') return -1;
      return a[0].localeCompare(b[0]);
    });
    const hasSubdivisions=subEntries.length>1||(subEntries.length===1&&subEntries[0][0]!=='');

    for (const [sub, subAgs] of subEntries) {
      if (hasSubdivisions) {
        const subHdr=document.createElement('div');
        subHdr.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 18px 6px 36px;background:#f0f4fa;border-top:1px solid #e0e0e0;cursor:pointer;user-select:none';
        subHdr.innerHTML=`
          <svg class="chevron open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px;color:#7a8fb5;flex-shrink:0;transition:transform .2s"><polyline points="9 18 15 12 9 6"/></svg>
          <span style="font-weight:600;font-size:13px;color:#3a5a8c">${esc(sub||'Other')}</span>
          <span style="font-size:12px;color:#aaa">${subAgs.length}</span>`;
        const subBody=document.createElement('div');
        subHdr.addEventListener('click',()=>{
          const open=subBody.style.display!=='none';
          subBody.style.display=open?'none':'block';
          subHdr.querySelector('.chevron').classList.toggle('open',!open);
        });
        body.appendChild(subHdr);
        body.appendChild(subBody);
        buildAgencyTable(subAgs, subBody);
      } else {
        buildAgencyTable(subAgs, body);
      }
    }
  }
  wrap.appendChild(body);
  return wrap;
}

function buildAgencyTable(ags, container) {
  const tableWrap=document.createElement('div');
  tableWrap.style.overflowX='auto';
  const table=document.createElement('table');
  table.className='sources-table';
  table.innerHTML=`<thead><tr>
    <th>Agency Name</th><th>City / Region</th><th>Modes</th>
    <th>Static</th><th>RT</th><th>Quality</th><th>Status</th><th>Notes</th><th></th>
  </tr></thead>`;
  const tbody=document.createElement('tbody');
  for (const ag of ags) tbody.appendChild(buildAgencyRow(ag));
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);
}

function buildAgencyRow(ag) {
  const tr=document.createElement('tr');
  tr.className='agency-row';
  tr.dataset.id=ag.id;
  tr.innerHTML=`
    <td><div class="agency-name">${esc(ag.agencyName||'—')}</div>
        ${ag.source==='mdb'?'<div class="agency-loc" style="color:#1e88e5;font-size:10px">MDB import</div>':''}</td>
    <td><div style="white-space:nowrap">${esc(ag.cityRegion||'—')}</div></td>
    <td>${modeBadges(ag.modes||[])}</td>
    <td>${staticBadge(ag)}</td>
    <td>${rtBadges(ag)}</td>
    <td>${qualityBadge(ag.quality)}</td>
    <td>${statusBadge(ag.status)}</td>
    <td><div style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:#888" title="${esc(ag.notes||'')}">${esc(ag.notes||'—')}</div></td>
    <td>
      <div class="row-actions">
        ${ag.staticUrl||ag.rtVpUrl||ag.rtTuUrl||ag.rtSaUrl?`<a class="icon-btn" href="${validatorLink(ag)}" target="_blank" rel="noopener" title="Validate GTFS" style="color:#43a047">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
        </a>`:''}
        <button class="icon-btn" data-action="edit" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn danger" data-action="delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    </td>`;
  tr.querySelector('[data-action="edit"]').addEventListener('click', e=>{ e.stopPropagation(); openAgencyModal(ag.id); });
  tr.querySelector('[data-action="delete"]').addEventListener('click', async e=>{
    e.stopPropagation();
    if (!confirm(`Delete "${ag.agencyName}"?`)) return;
    await dbDelete(ag.id); toast(`Deleted ${ag.agencyName}`, 'info'); renderMyDatabase();
  });
  return tr;
}

function toggleCountryBody(body, chevBtn) {
  const open=body.style.display!=='none';
  body.style.display=open?'none':'block';
  chevBtn.classList.toggle('open', !open);
}

// ── My Database filter wiring
function wireMyDBControls() {
  document.getElementById('mydb-search').addEventListener('input', e=>{ mydbSearch=e.target.value.trim(); renderMyDatabase(); });
  document.getElementById('f-mydb-status').addEventListener('change', e=>{ mydbStatusFilter=e.target.value; renderMyDatabase(); });
  document.getElementById('f-mydb-country').addEventListener('change', e=>{ mydbCountryFilter=e.target.value; renderMyDatabase(); });
  document.getElementById('mydb-clear').addEventListener('click', ()=>{
    mydbSearch=''; mydbStatusFilter=''; mydbCountryFilter='';
    document.getElementById('mydb-search').value='';
    document.getElementById('f-mydb-status').value='';
    document.getElementById('f-mydb-country').value='';
    renderMyDatabase();
  });
}

// ── CSV Export
function exportCSV() {
  const db=loadDB();
  const ags=Object.values(db.agencies).sort((a,b)=>countryName(a.countryCode).localeCompare(countryName(b.countryCode))||(a.cityRegion||'').localeCompare(b.cityRegion||''));
  const headers=['Country','Country Code','Subdivision','City/Region','Agency Name','Modes','Static','Static URL','RT','VP URL','TU URL','SA URL','Quality','Notes','Agency Status','Country Status'];
  const lines=[headers.map(csvCell).join(',')];
  for (const ag of ags) {
    lines.push([
      countryName(ag.countryCode), ag.countryCode, ag.subdivision||'', ag.cityRegion||'', ag.agencyName||'',
      (ag.modes||[]).join('|'), ag.hasStatic?'Yes':'No', ag.staticUrl||'',
      ag.hasRT?'Yes':'No', ag.rtVpUrl||'', ag.rtTuUrl||'', ag.rtSaUrl||'',
      ag.quality||'', ag.notes||'', ag.status||'',
      db.countries[ag.countryCode]?.status||'',
    ].map(csvCell).join(','));
  }
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`transit-sources-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('Exported CSV', 'success');
}

// ═══════════════════════════════════════════════════════════════════════
// 8. Agency modal (add / edit)
// ═══════════════════════════════════════════════════════════════════════

let currentEditId = null;

function buildModesGrid() {
  const grid=document.getElementById('modes-grid');
  grid.innerHTML='';
  for (const m of MODES) {
    const label=document.createElement('label');
    label.className='mode-check';
    label.innerHTML=`<input type="checkbox" value="${m}"> ${m}`;
    label.querySelector('input').addEventListener('change', e=>{
      label.classList.toggle('checked', e.target.checked);
    });
    grid.appendChild(label);
  }
}

function buildStatusSelects() {
  // Agency modal status
  const sel=document.getElementById('m-status');
  sel.innerHTML=STATUSES.map(s=>`<option>${s}</option>`).join('');
  // Country modal status
  const csel=document.getElementById('cmodal-status');
  csel.innerHTML=STATUSES.map(s=>`<option>${s}</option>`).join('');
}

function populateCountrySelect(selectedCode='') {
  const db=loadDB();
  const sel=document.getElementById('m-country');
  sel.innerHTML='<option value="">— Select Country —</option>';
  const codes=Object.keys(db.countries).sort((a,b)=>countryName(a).localeCompare(countryName(b)));
  for (const cc of codes) {
    const o=document.createElement('option');
    o.value=cc; o.textContent=`${countryName(cc)} (${cc})`;
    if (cc===selectedCode) o.selected=true;
    sel.appendChild(o);
  }
}

function openAgencyModal(id=null, preCC='') {
  currentEditId=id;
  const modal=document.getElementById('agency-modal');
  populateCountrySelect(preCC);

  const title=document.getElementById('modal-title');
  const saveBtn=document.getElementById('modal-save');
  const sourceRow=document.getElementById('m-source-row');

  // Reset
  ['m-subdivision','m-city','m-name','m-static-url','m-vp','m-tu','m-sa','m-notes'].forEach(k=>{ const el=document.getElementById(k); if(el) el.value=''; });
  document.getElementById('m-quality').value='';
  document.getElementById('m-status').value='NOT STARTED';
  document.getElementById('m-has-static').checked=false;
  document.getElementById('m-has-rt').checked=false;
  document.getElementById('static-fields').classList.remove('visible');
  document.getElementById('rt-fields').classList.remove('visible');
  document.querySelectorAll('#modes-grid .mode-check').forEach(l=>{ l.classList.remove('checked'); l.querySelector('input').checked=false; });
  sourceRow.style.display='none';

  if (id) {
    title.textContent='Edit Agency';
    saveBtn.textContent='Save Changes';
    const db=loadDB();
    const ag=db.agencies[id];
    if (!ag) return;
    populateCountrySelect(ag.countryCode);
    document.getElementById('m-subdivision').value=ag.subdivision||'';
    document.getElementById('m-city').value=ag.cityRegion||'';
    document.getElementById('m-name').value=ag.agencyName||'';
    document.getElementById('m-quality').value=ag.quality||'';
    document.getElementById('m-status').value=ag.status||'NOT STARTED';
    document.getElementById('m-notes').value=ag.notes||'';
    if (ag.hasStatic) { document.getElementById('m-has-static').checked=true; document.getElementById('static-fields').classList.add('visible'); }
    document.getElementById('m-static-url').value=ag.staticUrl||'';
    if (ag.hasRT) { document.getElementById('m-has-rt').checked=true; document.getElementById('rt-fields').classList.add('visible'); }
    document.getElementById('m-vp').value=ag.rtVpUrl||'';
    document.getElementById('m-tu').value=ag.rtTuUrl||'';
    document.getElementById('m-sa').value=ag.rtSaUrl||'';
    (ag.modes||[]).forEach(m=>{
      const label=[...document.querySelectorAll('#modes-grid .mode-check')].find(l=>l.querySelector('input').value===m);
      if (label) { label.classList.add('checked'); label.querySelector('input').checked=true; }
    });
    if (ag.source==='mdb') { sourceRow.style.display='flex'; document.getElementById('m-source').value=`Mobility Database (${ag.mdbSourceId})`; }
  } else {
    title.textContent=preCC ? `Add Agency — ${countryName(preCC)}` : 'Add Agency';
    saveBtn.textContent='Save Agency';
  }

  modal.classList.add('open');
  document.getElementById('m-name').focus();
}

function closeAgencyModal() {
  document.getElementById('agency-modal').classList.remove('open');
  currentEditId=null;
}

async function saveAgencyModal() {
  const cc=document.getElementById('m-country').value;
  const name=document.getElementById('m-name').value.trim();
  if (!cc) { document.getElementById('m-country').classList.add('error'); toast('Select a country', 'error'); return; }
  if (!name) { document.getElementById('m-name').classList.add('error'); toast('Agency name is required', 'error'); return; }
  document.getElementById('m-country').classList.remove('error');
  document.getElementById('m-name').classList.remove('error');

  const modes=[...document.querySelectorAll('#modes-grid .mode-check input:checked')].map(i=>i.value);
  const fields={
    countryCode: cc,
    subdivision: document.getElementById('m-subdivision').value.trim(),
    cityRegion:  document.getElementById('m-city').value.trim(),
    agencyName:  name,
    modes,
    hasStatic:   document.getElementById('m-has-static').checked,
    staticUrl:   document.getElementById('m-static-url').value.trim(),
    hasRT:       document.getElementById('m-has-rt').checked,
    rtVpUrl:     document.getElementById('m-vp').value.trim(),
    rtTuUrl:     document.getElementById('m-tu').value.trim(),
    rtSaUrl:     document.getElementById('m-sa').value.trim(),
    quality:     document.getElementById('m-quality').value,
    status:      document.getElementById('m-status').value,
    notes:       document.getElementById('m-notes').value.trim(),
  };

  if (currentEditId) {
    await dbUpdate(currentEditId, fields);
    toast(`Updated ${name}`, 'success');
  } else {
    await dbAdd(fields);
    toast(`Added ${name}`, 'success');
  }
  closeAgencyModal();
  renderMyDatabase();
}

function wireAgencyModal() {
  document.getElementById('modal-close').addEventListener('click', closeAgencyModal);
  document.getElementById('modal-cancel').addEventListener('click', closeAgencyModal);
  document.getElementById('modal-save').addEventListener('click', saveAgencyModal);
  document.getElementById('agency-modal').addEventListener('click', e=>{ if(e.target===document.getElementById('agency-modal')) closeAgencyModal(); });
  document.getElementById('m-has-static').addEventListener('change', e=>{ document.getElementById('static-fields').classList.toggle('visible',e.target.checked); });
  document.getElementById('m-has-rt').addEventListener('change', e=>{ document.getElementById('rt-fields').classList.toggle('visible',e.target.checked); });
}

// Pre-fill modal from a discovery result (MDB or Transitland)
function openAgencyModalPrefilled(fields) {
  openAgencyModal(null, fields.countryCode||'');
  if (fields.subdivision) document.getElementById('m-subdivision').value=fields.subdivision;
  if (fields.cityRegion) document.getElementById('m-city').value=fields.cityRegion;
  if (fields.agencyName) document.getElementById('m-name').value=fields.agencyName;
  if (fields.staticUrl) { document.getElementById('m-has-static').checked=true; document.getElementById('static-fields').classList.add('visible'); document.getElementById('m-static-url').value=fields.staticUrl; }
  if (fields.rtVpUrl||fields.rtTuUrl||fields.rtSaUrl) { document.getElementById('m-has-rt').checked=true; document.getElementById('rt-fields').classList.add('visible'); document.getElementById('m-vp').value=fields.rtVpUrl||''; document.getElementById('m-tu').value=fields.rtTuUrl||''; document.getElementById('m-sa').value=fields.rtSaUrl||''; }
  if (fields.mdbSourceId) {
    document.getElementById('m-source-row').style.display='flex';
    document.getElementById('m-source').value=`Mobility Database (${fields.mdbSourceId})`;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 9. Country modal
// ═══════════════════════════════════════════════════════════════════════

// Common ISO codes for datalist autocomplete
const ISO_CODES = ['AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW'];

function populateCountryDatalist() {
  const dl=document.getElementById('country-datalist');
  dl.innerHTML=ISO_CODES.map(cc=>`<option value="${countryName(cc)} (${cc})">`).join('');
}

function openCountryModal() {
  document.getElementById('cmodal-name').value='';
  document.getElementById('cmodal-status').value='NOT STARTED';
  document.getElementById('country-modal').classList.add('open');
  document.getElementById('cmodal-name').focus();
}

function wireCountryModal() {
  document.getElementById('cmodal-close').addEventListener('click',()=>document.getElementById('country-modal').classList.remove('open'));
  document.getElementById('cmodal-cancel').addEventListener('click',()=>document.getElementById('country-modal').classList.remove('open'));
  document.getElementById('country-modal').addEventListener('click',e=>{ if(e.target===document.getElementById('country-modal')) document.getElementById('country-modal').classList.remove('open'); });
  document.getElementById('cmodal-save').addEventListener('click', async ()=>{
    const raw=document.getElementById('cmodal-name').value.trim();
    // Accept "Name (CC)" format or just "CC"
    const match=raw.match(/\(([A-Z]{2})\)$/) || (raw.length===2?[null,raw.toUpperCase()]:null);
    if (!match) { toast('Enter a country name from the list or a 2-letter ISO code', 'error'); return; }
    const cc=match[1];
    const db=loadDB();
    if (db.countries[cc]) { toast(`${countryName(cc)} is already tracked`, 'error'); return; }
    const status=document.getElementById('cmodal-status').value;
    await dbAddCountry(cc, status);
    document.getElementById('country-modal').classList.remove('open');
    toast(`Added ${countryName(cc)}`, 'success');
    renderMyDatabase();
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 10. Import from MDB
// ═══════════════════════════════════════════════════════════════════════

let importCandidates = [];

async function openImportModal() {
  const modal=document.getElementById('import-modal');
  const body=document.getElementById('import-body');
  const footer=document.getElementById('import-footer');
  footer.style.display='none';
  importCandidates=[];
  document.getElementById('import-title').textContent='Import from Feeds v2';
  body.innerHTML=`<div class="center-state" style="padding:30px"><div class="spinner"></div><p>Loading Feeds v2…</p></div>`;
  modal.classList.add('open');

  try {
    if (!mdbLoaded) {
      const res=await fetch(FEEDS_V2_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allMdbAgencies=processFeeds(parseCSV(await res.text()));
      mdbLoaded=true;
    }
    buildImportCandidates();
  } catch(err) {
    body.innerHTML=`<div class="center-state" style="color:#c62828"><p>Failed to load Feeds v2: ${esc(err.message)}</p></div>`;
  }
}

function buildImportCandidates() {
  const db=loadDB();
  const trackedCCs=new Set(Object.keys(db.countries));
  const existingNames=new Map(); // normalizedName+CC → id
  for (const ag of Object.values(db.agencies)) {
    existingNames.set(normalizeAgencyName(ag.agencyName)+ag.countryCode, ag.id);
  }

  const newOnes=[], updates=[], skipped=[];
  for (const ag of allMdbAgencies) {
    if (!trackedCCs.has(ag.country)) continue; // only import for tracked countries
    const norm=normalizeAgencyName(ag.provider)+ag.country;
    const existId=existingNames.get(norm);
    const staticUrl=(ag.staticFeeds[0]?.['urls.latest']||ag.staticFeeds[0]?.['urls.direct_download']||'');
    const vpUrl=(ag.rtVP[0]?.['urls.latest']||ag.rtVP[0]?.['urls.direct_download']||'');
    const tuUrl=(ag.rtTU[0]?.['urls.latest']||ag.rtTU[0]?.['urls.direct_download']||'');
    const saUrl=(ag.rtSA[0]?.['urls.latest']||ag.rtSA[0]?.['urls.direct_download']||'');
    const candidate={
      existId, agencyName:ag.provider, countryCode:ag.country,
      subdivision:ag.subdivision||'',
      cityRegion:ag.municipality||'',
      hasStatic:ag.staticFeeds.length>0, staticUrl,
      hasRT:ag.rtVP.length>0||ag.rtTU.length>0||ag.rtSA.length>0,
      rtVpUrl:vpUrl, rtTuUrl:tuUrl, rtSaUrl:saUrl,
      coverageLevel:ag.coverageLevel,
      mdbSourceId:feedId(ag.staticFeeds[0]||{}),
      selected:true,
    };
    if (existId) updates.push(candidate);
    else newOnes.push(candidate);
  }

  importCandidates=[...newOnes,...updates,...skipped];

  const body=document.getElementById('import-body');
  const footer=document.getElementById('import-footer');

  if (!newOnes.length&&!updates.length) {
    body.innerHTML=`<div class="center-state"><p>No new feeds found for your tracked countries.</p><p class="sub">Your database is up to date with MDB.</p></div>`;
    return;
  }

  footer.style.display='flex';
  const confirmBtn=document.getElementById('import-confirm');
  confirmBtn.textContent=`Import ${newOnes.length} new + ${updates.length} updates`;

  body.innerHTML=`
    <div style="margin-bottom:12px;font-size:13px;color:#555">
      Found <strong>${newOnes.length}</strong> new agenc${newOnes.length===1?'y':'ies'} and
      <strong>${updates.length}</strong> URL update${updates.length===1?'':'s'} for your
      ${Object.keys(loadDB().countries).length} tracked countries.
      Only URL fields will be updated on existing entries (status/notes are preserved).
    </div>
    <div style="max-height:340px;overflow-y:auto">
      ${importCandidates.filter(c=>!c.skip).map((c,i)=>`
        <div class="import-item">
          <div class="import-dot ${c.existId?'dot-update':'dot-new'}"></div>
          <div style="flex:1">
            <div style="font-weight:600">${esc(c.agencyName)}</div>
            <div style="font-size:11px;color:#999">${esc(countryName(c.countryCode))} · ${esc(c.cityRegion||'—')} · ${c.coverageLevel.replace('_',' ')}</div>
          </div>
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#888;cursor:pointer">
            <input type="checkbox" data-idx="${i}" ${c.selected?'checked':''}>
            ${c.existId?'Update URLs':'Import'}
          </label>
        </div>`).join('')}
    </div>`;

  body.querySelectorAll('[data-idx]').forEach(cb=>{
    cb.addEventListener('change', e=>{
      importCandidates[+e.target.dataset.idx].selected=e.target.checked;
    });
  });
}

async function commitImport() {
  const selected=importCandidates.filter(c=>c.selected);
  let added=0, updated=0;
  for (const c of selected) {
    const fields={ countryCode:c.countryCode, subdivision:c.subdivision||'', cityRegion:c.cityRegion, agencyName:c.agencyName,
      modes:[], hasStatic:c.hasStatic, staticUrl:c.staticUrl, hasRT:c.hasRT,
      rtVpUrl:c.rtVpUrl, rtTuUrl:c.rtTuUrl, rtSaUrl:c.rtSaUrl,
      source:'mdb', mdbSourceId:c.mdbSourceId, quality:'', notes:'', status:'NOT STARTED' };
    if (c.existId) {
      await dbUpdate(c.existId, { staticUrl:c.staticUrl, rtVpUrl:c.rtVpUrl, rtTuUrl:c.rtTuUrl, rtSaUrl:c.rtSaUrl, hasStatic:c.hasStatic, hasRT:c.hasRT, mdbSourceId:c.mdbSourceId, source:'mdb' });
      updated++;
    } else {
      await dbAdd(fields); added++;
    }
  }
  document.getElementById('import-modal').classList.remove('open');
  toast(`Imported ${added} new, updated ${updated} URL${updated===1?'':'s'}`, 'success');
  renderMyDatabase();
}

function wireImportModal() {
  document.getElementById('import-close').addEventListener('click',()=>document.getElementById('import-modal').classList.remove('open'));
  document.getElementById('import-cancel').addEventListener('click',()=>document.getElementById('import-modal').classList.remove('open'));
  document.getElementById('import-confirm').addEventListener('click', commitImport);
  document.getElementById('import-modal').addEventListener('click',e=>{ if(e.target===document.getElementById('import-modal')) document.getElementById('import-modal').classList.remove('open'); });
}

// ═══════════════════════════════════════════════════════════════════════
// 11. Browse All tab (MDB CSV, read-only)
// ═══════════════════════════════════════════════════════════════════════

let brFilter='all', brSearch='', brCountry='', brSubdivision='', brStatus='active', brHasRT=false;
let browseLoaded=false;

function getFiltered() {
  return allMdbAgencies.filter(ag=>{
    if (brFilter!=='all'&&ag.coverageLevel!==brFilter) return false;
    if (brCountry&&ag.country!==brCountry) return false;
    if (brSubdivision&&ag.subdivision!==brSubdivision) return false;
    if (brStatus==='active'){
      const all=[...ag.staticFeeds,...ag.rtVP,...ag.rtTU,...ag.rtSA];
      if (!all.some(f=>!f['status']||f['status']==='active')) return false;
    }
    if (brHasRT&&!ag.rtVP.length&&!ag.rtTU.length&&!ag.rtSA.length) return false;
    if (brSearch){
      const q=brSearch.toLowerCase();
      if (![ag.provider,ag.municipality,ag.subdivision,ag.country,countryName(ag.country)].join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function brFeedBadge(feeds,cls,label){
  if(!feeds.length) return '<span class="dash">—</span>';
  const active=feeds.filter(f=>!f['status']||f['status']==='active');
  const shown=(active.length?active:feeds).slice(0,2);
  return shown.map(f=>{
    const url=f['urls.direct_download']||f['urls.latest'];
    return url
      ?`<span class="badge ${cls} has-url-tip" data-url="${esc(url)}"><a href="${esc(url)}" target="_blank" rel="noopener">${label}</a></span>`
      :`<span class="badge ${cls}">${label}</span>`;
  }).join('') + (feeds.length>2?`<span class="badge badge-dim">+${feeds.length-2}</span>`:'');
}

function renderBrowseRow(ag) {
  const loc=[ag.municipality].filter(Boolean).join(', ');
  const cls={full:'row-full',partial_rt:'row-partial',static_only:'row-static',rt_only:'row-rtonly'}[ag.coverageLevel]||'';
  const sb=ag.staticFeeds.length===0?'<span class="dash">—</span>':ag.staticFeeds.slice(0,2).map(f=>{
    const isA=!f['status']||f['status']==='active'; const url=f['urls.latest']||f['urls.direct_download'];
    return url
      ?`<span class="badge ${isA?'badge-gtfs':'badge-dim'} has-url-tip" data-url="${esc(url)}"><a href="${esc(url)}" target="_blank" rel="noopener">GTFS</a></span>`
      :`<span class="badge ${isA?'badge-gtfs':'badge-dim'}">GTFS</span>`;
  }).join('')+(ag.staticFeeds.length>2?`<span class="badge badge-dim">+${ag.staticFeeds.length-2}</span>`:'');

  // Check if in My DB
  const db=loadDB();
  const inDB=Object.values(db.agencies).some(a=>normalizeAgencyName(a.agencyName)+a.countryCode===normalizeAgencyName(ag.provider)+ag.country);
  const addBtn=inDB
    ?`<span style="font-size:11px;color:#2e7d32;font-weight:600">✓ Tracked</span>`
    :`<button class="cg-btn" style="background:#2c5aa0;border-color:#2c5aa0;white-space:nowrap" data-browse-add>+ My DB</button>`;

  return `<tr class="${cls}">
    <td><div class="agency-name" title="${esc(ag.provider)}">${esc(ag.provider||'Unknown')}</div>${loc?`<div class="agency-loc">${esc(loc)}</div>`:''}</td>
    <td><div class="badges">${sb}</div></td>
    <td><div class="badges">${brFeedBadge(ag.rtVP,'badge-vp','VP')}</div></td>
    <td><div class="badges">${brFeedBadge(ag.rtTU,'badge-tu','TU')}</div></td>
    <td><div class="badges">${brFeedBadge(ag.rtSA,'badge-sa','SA')}</div></td>
    <td>${addBtn}</td>
  </tr>`;
}

function coverageBadges(agencies) {
  const full=agencies.filter(a=>a.coverageLevel==='full').length;
  const partial=agencies.filter(a=>a.coverageLevel==='partial_rt').length;
  const stat=agencies.filter(a=>a.coverageLevel==='static_only').length;
  const rtOnly=agencies.filter(a=>a.coverageLevel==='rt_only').length;
  return [
    full?`<span class="c-badge cb-full">${full} Full RT</span>`:'',
    partial?`<span class="c-badge cb-partial">${partial} Partial RT</span>`:'',
    stat?`<span class="c-badge cb-static">${stat} Static</span>`:'',
    rtOnly?`<span class="c-badge cb-rtonly">${rtOnly} RT only</span>`:'',
  ].filter(Boolean).join('');
}

function renderSubdivisionSection(subName, agencies) {
  const order={full:0,partial_rt:1,static_only:2,rt_only:3};
  agencies.sort((a,b)=>(order[a.coverageLevel]??4)-(order[b.coverageLevel]??4));
  const expand=agencies.length<=8;
  return `<div class="subdivision-section" style="border-top:1px solid #eee">
    <div class="subdivision-header" style="display:flex;align-items:center;gap:10px;padding:8px 18px 8px 36px;cursor:pointer;user-select:none;font-size:13px;background:#fafbfc">
      <svg class="chevron ${expand?'open':''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px;color:#aaa;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
      <span style="font-weight:600;color:#444">${esc(subName||'Other')}</span>
      <span style="color:#aaa;font-size:12px">${agencies.length}</span>
      <div class="c-badges" style="margin-left:auto">${coverageBadges(agencies)}</div>
    </div>
    <div class="table-wrap" style="display:${expand?'block':'none'}">
      <table class="agency-table"><thead><tr>
        <th>Agency</th><th>GTFS Static</th><th>VP</th><th>TU</th><th>SA</th><th></th>
      </tr></thead><tbody>${agencies.map(renderBrowseRow).join('')}</tbody></table>
    </div>
  </div>`;
}

function renderBrowseCountry(cc, agencies) {
  const order={full:0,partial_rt:1,static_only:2,rt_only:3};
  agencies.sort((a,b)=>(order[a.coverageLevel]??4)-(order[b.coverageLevel]??4));
  const expand=agencies.length<=12;

  // Group by subdivision
  const bySub={};
  for (const ag of agencies) (bySub[ag.subdivision||'']??=[]).push(ag);
  const subEntries=Object.entries(bySub).sort((a,b)=>b[1].length-a[1].length);
  const hasSubdivisions=subEntries.length>1 || (subEntries.length===1 && subEntries[0][0]!=='');

  let bodyHTML;
  if (hasSubdivisions) {
    bodyHTML=subEntries.map(([sub,ags])=>renderSubdivisionSection(sub,ags)).join('');
  } else {
    bodyHTML=`<div class="table-wrap">
      <table class="agency-table"><thead><tr>
        <th>Agency</th><th>GTFS Static</th><th>VP</th><th>TU</th><th>SA</th><th></th>
      </tr></thead><tbody>${agencies.map(renderBrowseRow).join('')}</tbody></table>
    </div>`;
  }

  return `<div class="country-section">
    <div class="country-header">
      <div><span class="c-name">${esc(countryName(cc))} (${esc(cc)})</span><span class="c-count"> · ${agencies.length} agenc${agencies.length===1?'y':'ies'}</span></div>
      <div class="c-badges">${coverageBadges(agencies)}</div>
      <svg class="chevron ${expand?'open':''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
    <div class="country-body" style="display:${expand?'block':'none'}">
      ${bodyHTML}
    </div>
  </div>`;
}

function renderBrowseResults() {
  const area=document.getElementById('browse-results');
  const filtered=getFiltered();
  const cc=document.getElementById('br-count');
  if (cc) cc.textContent=`${filtered.length.toLocaleString()} of ${allMdbAgencies.length.toLocaleString()}`;

  if (!filtered.length) { area.innerHTML='<div class="center-state"><p>No agencies match your filters.</p></div>'; return; }
  const byCC={};
  for (const ag of filtered) (byCC[ag.country||'XX']??=[]).push(ag);
  const sorted=Object.entries(byCC).sort((a,b)=>b[1].length-a[1].length);
  area.innerHTML=sorted.map(([cc,ags])=>renderBrowseCountry(cc,ags)).join('');
  // Wire country header toggles
  area.querySelectorAll('.country-header').forEach(h=>{
    h.addEventListener('click',()=>{
      const body=h.nextElementSibling, chev=h.querySelector('.chevron');
      const open=body.style.display!=='none';
      body.style.display=open?'none':'block'; chev.classList.toggle('open',!open);
    });
  });
  // Wire subdivision header toggles
  area.querySelectorAll('.subdivision-header').forEach(h=>{
    h.addEventListener('click',()=>{
      const body=h.nextElementSibling, chev=h.querySelector('.chevron');
      const open=body.style.display!=='none';
      body.style.display=open?'none':'block'; chev.classList.toggle('open',!open);
    });
  });
  // Add to My DB buttons
  area.querySelectorAll('[data-browse-add]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const row=btn.closest('tr');
      const name=row.querySelector('.agency-name')?.textContent?.trim()||'';
      const loc=row.querySelector('.agency-loc')?.textContent?.trim()||'';
      // Find the agency in allMdbAgencies
      const ag=allMdbAgencies.find(a=>a.provider===name);
      if (!ag) { openAgencyModalPrefilled({ agencyName:name, cityRegion:loc }); return; }
      const staticUrl=ag.staticFeeds[0]?.['urls.latest']||ag.staticFeeds[0]?.['urls.direct_download']||'';
      const vpUrl=ag.rtVP[0]?.['urls.direct_download']||ag.rtVP[0]?.['urls.latest']||'';
      const tuUrl=ag.rtTU[0]?.['urls.direct_download']||ag.rtTU[0]?.['urls.latest']||'';
      const saUrl=ag.rtSA[0]?.['urls.direct_download']||ag.rtSA[0]?.['urls.latest']||'';
      openAgencyModalPrefilled({
        countryCode:ag.country, subdivision:ag.subdivision||'', cityRegion:ag.municipality||'',
        agencyName:ag.provider, staticUrl,
        rtVpUrl:vpUrl, rtTuUrl:tuUrl, rtSaUrl:saUrl,
        mdbSourceId:feedId(ag.staticFeeds[0]||{}),
      });
      // Switch to My Database tab to show the modal in context
      showTab('mydb');
    });
  });
}

function updateBrowseStats() {
  document.getElementById('s-total').textContent   = allMdbAgencies.length.toLocaleString();
  document.getElementById('s-full').textContent    = allMdbAgencies.filter(a=>a.coverageLevel==='full').length.toLocaleString();
  document.getElementById('s-partial').textContent = allMdbAgencies.filter(a=>a.coverageLevel==='partial_rt').length.toLocaleString();
  document.getElementById('s-static').textContent  = allMdbAgencies.filter(a=>a.coverageLevel==='static_only').length.toLocaleString();
  document.getElementById('s-rtonly').textContent  = allMdbAgencies.filter(a=>a.coverageLevel==='rt_only').length.toLocaleString();
}

function populateBrowseCountryFilter() {
  const sel=document.getElementById('f-br-country');
  while(sel.options.length>1) sel.remove(1);
  const ccs=[...new Set(allMdbAgencies.map(a=>a.country).filter(Boolean))].sort((a,b)=>countryName(a).localeCompare(countryName(b)));
  ccs.forEach(cc=>{ const o=document.createElement('option'); o.value=cc; o.textContent=`${countryName(cc)} (${cc})`; if(cc===brCountry)o.selected=true; sel.appendChild(o); });
  populateBrowseSubdivisionFilter();
}

function populateBrowseSubdivisionFilter() {
  const sel=document.getElementById('f-br-subdivision');
  while(sel.options.length>1) sel.remove(1);
  const src=brCountry ? allMdbAgencies.filter(a=>a.country===brCountry) : allMdbAgencies;
  const subs=[...new Set(src.map(a=>a.subdivision).filter(Boolean))].sort();
  subs.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; if(s===brSubdivision)o.selected=true; sel.appendChild(o); });
}

function wireBrowseControls() {
  document.getElementById('br-search').addEventListener('input',e=>{ brSearch=e.target.value.trim(); renderBrowseResults(); });
  document.getElementById('f-br-country').addEventListener('change',e=>{ brCountry=e.target.value; brSubdivision=''; populateBrowseSubdivisionFilter(); renderBrowseResults(); });
  document.getElementById('f-br-subdivision').addEventListener('change',e=>{ brSubdivision=e.target.value; renderBrowseResults(); });
  document.getElementById('f-br-status').addEventListener('change',e=>{ brStatus=e.target.value; renderBrowseResults(); });
  document.getElementById('f-br-hasrt').addEventListener('change',e=>{ brHasRT=e.target.checked; renderBrowseResults(); });
  document.querySelectorAll('.stat-chip').forEach(chip=>{
    chip.addEventListener('click',()=>{
      brFilter=chip.dataset.filter;
      document.querySelectorAll('.stat-chip').forEach(c=>c.classList.remove('active-filter'));
      chip.classList.add('active-filter');
      renderBrowseResults();
    });
  });
  document.getElementById('br-clear').addEventListener('click',()=>{
    brFilter='all'; brSearch=''; brCountry=''; brSubdivision=''; brStatus='active'; brHasRT=false;
    document.getElementById('br-search').value='';
    document.getElementById('f-br-country').value='';
    document.getElementById('f-br-subdivision').value='';
    document.getElementById('f-br-status').value='active';
    document.getElementById('f-br-hasrt').checked=false;
    document.querySelectorAll('.stat-chip').forEach(c=>c.classList.remove('active-filter'));
    document.querySelectorAll('.stat-chip')[0]?.classList.add('active-filter');
    renderBrowseResults();
  });
}

async function loadBrowseTab(forceReload=false) {
  if (browseLoaded && !forceReload) return;
  const area=document.getElementById('browse-results');
  area.innerHTML='<div class="center-state" id="browse-init-state"><div class="spinner"></div><p>Loading Feeds v2…</p></div>';
  try {
    const res=await fetch(FEEDS_V2_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allMdbAgencies=processFeeds(parseCSV(await res.text()));
    mdbLoaded=true; browseLoaded=true;
    document.getElementById('browse-stat-chips').style.display='flex';
    document.getElementById('browse-filters').style.display='flex';
    updateBrowseStats();
    populateBrowseCountryFilter();
    document.getElementById('browse-init-state')?.remove();
    renderBrowseResults();
  } catch(err) {
    const isFile=location.protocol==='file:';
    area.innerHTML=`<div class="center-state" style="color:#c62828">
      <p style="font-weight:700">Could not load Feeds v2</p>
      <p class="sub">${esc(err.message)}</p>
      ${isFile?`<p class="sub">Open via a local server: <code>python3 -m http.server 8080</code></p>`:''}
      <button id="browse-retry-btn" style="margin-top:12px;padding:8px 20px;background:#2c5aa0;color:white;border:none;border-radius:7px;cursor:pointer;font-family:inherit">Retry</button>
    </div>`;
    document.getElementById('browse-retry-btn').addEventListener('click', ()=>{
      browseLoaded=false;
      loadBrowseTab();
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 12. Discovery modal (Transitland + local MDB search)
// ═══════════════════════════════════════════════════════════════════════

function buildDiscoveryModal() {
  const el=document.createElement('div');
  el.id='discovery-modal';
  el.className='modal-overlay';
  el.innerHTML=`
    <div class="modal-box" style="max-width:680px">
      <div class="modal-header">
        <h2>Find & Add Feeds</h2>
        <div style="display:flex;gap:8px;margin:0 12px 0 auto">
          <button class="tab-btn active" data-disc-tab="local" style="font-size:12px;padding:5px 12px">Mobility Database</button>
          <button class="tab-btn" data-disc-tab="transitland" style="font-size:12px;padding:5px 12px">Transitland</button>
        </div>
        <button class="modal-close-btn" id="disc-close">×</button>
      </div>
      <div class="modal-body" style="padding:14px 20px;gap:10px">
        <div style="display:flex;gap:8px">
          <div style="flex:1;position:relative">
            <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:#aaa;pointer-events:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="disc-query" type="text" placeholder="City, agency, or country name…" style="width:100%;padding:9px 12px 9px 32px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:inherit;outline:none" onfocus="this.style.borderColor='#2c5aa0'" onblur="this.style.borderColor='#ddd'">
          </div>
          <button id="disc-search-btn" class="btn btn-primary">Search</button>
        </div>
        <div id="disc-suggestions" style="display:none;border:1px solid #e8e8e8;border-radius:7px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.08)"></div>
        <div id="disc-tl-key-row" style="display:none;margin-top:2px;display:none;align-items:center;gap:8px;font-size:12px;color:#888">
          <span>Transitland API key (required):</span>
          <input id="disc-apikey" type="password" placeholder="Paste key…" style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:12px;font-family:inherit;outline:none">
          <button id="disc-save-key" class="btn btn-ghost" style="padding:5px 10px;font-size:12px">Save</button>
          <a href="https://www.transit.land/sign-up" target="_blank" rel="noopener" style="color:#2c5aa0;white-space:nowrap">Get key ↗</a>
        </div>
      </div>
      <div id="disc-results" style="flex:1;overflow-y:auto;padding:0 20px 16px;max-height:400px">
        <p style="font-size:13px;color:#ccc;text-align:center;padding:24px 0">Search above to find GTFS feeds</p>
      </div>
    </div>`;
  document.body.appendChild(el);
}

let discTab='local';

function wireDiscoveryModal() {
  const modal=document.getElementById('discovery-modal');
  document.getElementById('disc-close').addEventListener('click',()=>modal.classList.remove('open'));
  modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.remove('open'); });

  // Tab switching
  modal.querySelectorAll('[data-disc-tab]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      discTab=btn.dataset.discTab;
      modal.querySelectorAll('[data-disc-tab]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const keyRow=document.getElementById('disc-tl-key-row');
      keyRow.style.display=discTab==='transitland'?'flex':'none';
      document.getElementById('disc-results').innerHTML='<p style="font-size:13px;color:#ccc;text-align:center;padding:24px 0">Search above to find GTFS feeds</p>';
    });
  });

  // API key
  const saved=localStorage.getItem('transitland_api_key');
  if (saved) document.getElementById('disc-apikey').value=saved;
  document.getElementById('disc-save-key').addEventListener('click',()=>{
    const v=document.getElementById('disc-apikey').value.trim();
    if (v) localStorage.setItem('transitland_api_key',v); else localStorage.removeItem('transitland_api_key');
    toast(v?'API key saved':'API key cleared','info');
  });

  const btn=document.getElementById('disc-search-btn');
  const input=document.getElementById('disc-query');
  btn.addEventListener('click',()=>runDiscoverySearch());
  input.addEventListener('keydown',e=>{ if(e.key==='Enter') runDiscoverySearch(); });

  // Nominatim autocomplete
  let acTimer=null;
  input.addEventListener('input',()=>{
    clearTimeout(acTimer);
    const q=input.value.trim();
    const suggs=document.getElementById('disc-suggestions');
    if (q.length<3){suggs.style.display='none';return;}
    acTimer=setTimeout(async()=>{
      try {
        const params=new URLSearchParams({format:'json',q,limit:'5',addressdetails:'1','accept-language':'en'});
        const r=await fetch(`${NOMINATIM_URL}?${params}`,{headers:{'User-Agent':'gtfs-tools/1.0'}});
        if (!r.ok) return;
        const data=await r.json();
        if (!data.length){suggs.style.display='none';return;}
        suggs.style.display='block';
        suggs.innerHTML=data.map((x,i)=>{
          const city=x.address?.city||x.address?.town||x.address?.municipality||x.address?.county||'';
          const state=x.address?.state||'';
          const cc=(x.address?.country_code||'').toUpperCase();
          return `<div data-sugg="${i}" style="padding:8px 14px;cursor:pointer;font-size:13px;background:white;border-bottom:1px solid #f5f5f5" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='white'">
            <strong>${esc(city||x.display_name.split(',')[0])}</strong>${state?` · ${esc(state)}`:''} ${cc?`<span style="color:#bbb;font-size:11px">${esc(cc)}</span>`:''}
          </div>`;
        }).join('');
        suggs.querySelectorAll('[data-sugg]').forEach((el,i)=>{
          el.addEventListener('click',()=>{
            const x=data[i];
            const city=x.address?.city||x.address?.town||x.address?.municipality||'';
            const state=x.address?.state||'';
            const cc=(x.address?.country_code||'').toUpperCase();
            input.value=[city,state,cc].filter(Boolean).join(', ');
            suggs.style.display='none';
            runDiscoverySearch();
          });
        });
      } catch {}
    },300);
  });
}

async function runDiscoverySearch() {
  const query=document.getElementById('disc-query').value.trim();
  if (!query) return;
  document.getElementById('disc-suggestions').style.display='none';
  const results=document.getElementById('disc-results');
  results.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:30px;color:#888;justify-content:center"><div class="spinner"></div><span>Searching…</span></div>`;
  if (discTab==='local') await searchLocalMDB(query);
  else await searchTransitland(query);
}

async function searchLocalMDB(query) {
  const results=document.getElementById('disc-results');
  if (!mdbLoaded) {
    results.innerHTML=`<div style="text-align:center;padding:24px;font-size:13px;color:#888">
      <p>Load the Browse All tab first to enable local search.</p>
      <button class="btn btn-secondary" onclick="showTab('browse');document.getElementById('discovery-modal').classList.remove('open')" style="margin-top:10px">Open Browse All</button>
    </div>`;
    return;
  }
  const q=query.toLowerCase();
  const hits=allMdbAgencies.filter(a=>[a.provider,a.municipality,a.subdivision,a.country,countryName(a.country)].join(' ').toLowerCase().includes(q)).slice(0,40);
  if (!hits.length) { results.innerHTML=`<p style="text-align:center;padding:24px;font-size:13px;color:#999">No results for "${esc(query)}"</p>`; return; }
  renderDiscoveryCards(hits.map(ag=>({
    name:ag.provider, subdivision:ag.subdivision||'', loc:ag.municipality||'',
    country:ag.country, coverageLevel:ag.coverageLevel,
    staticUrl:ag.staticFeeds[0]?.['urls.latest']||ag.staticFeeds[0]?.['urls.direct_download']||'',
    vpUrl:ag.rtVP[0]?.['urls.latest']||'', tuUrl:ag.rtTU[0]?.['urls.latest']||'', saUrl:ag.rtSA[0]?.['urls.latest']||'',
    mdbSourceId:feedId(ag.staticFeeds[0]||{}), source:'mdb',
  })), query);
}

async function searchTransitland(query) {
  const results=document.getElementById('disc-results');
  const apiKey=localStorage.getItem('transitland_api_key')||'';
  if (!apiKey) {
    results.innerHTML=`<div style="text-align:center;padding:24px;font-size:13px;color:#888">
      <p>A Transitland API key is required.</p>
      <a href="https://www.transit.land/sign-up" target="_blank" rel="noopener" style="color:#2c5aa0">Get a free key ↗</a> then paste it above.
    </div>`;
    return;
  }
  try {
    const params=new URLSearchParams({search:query,limit:'30',apikey:apiKey});
    const r=await fetch(`${TRANSITLAND_API}/feeds?${params}`);
    if (r.status===401){results.innerHTML=`<p style="text-align:center;padding:24px;font-size:13px;color:#c62828">Invalid API key. <a href="https://www.transit.land/sign-up" target="_blank" rel="noopener" style="color:#2c5aa0">Get a free key ↗</a></p>`;return;}
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data=await r.json();
    if (!data.feeds?.length){results.innerHTML=`<p style="text-align:center;padding:24px;font-size:13px;color:#999">No results for "${esc(query)}"</p>`;return;}
    renderDiscoveryCards(data.feeds.map(f=>({
      name:f.name||f.onestop_id||'Unknown',
      loc:(f.operators||[]).slice(0,1).map(o=>[o.city,o.state].filter(Boolean).join(', ')).join(''),
      country:(f.operators||[])[0]?.country_iso_3166_1_alpha_2||'',
      coverageLevel:f.spec==='gtfs_rt'?'rt_only':'static_only',
      staticUrl:f.urls?.static_current||'', vpUrl:f.urls?.realtime_vehicle_positions||'',
      tuUrl:f.urls?.realtime_trip_updates||'', saUrl:f.urls?.realtime_alerts||'',
      mdbSourceId:'', tlId:f.onestop_id||'', source:'transitland',
    })), query);
  } catch(err){results.innerHTML=`<p style="text-align:center;padding:24px;font-size:13px;color:#c62828">Search failed: ${esc(err.message)}</p>`;}
}

function renderDiscoveryCards(items, query) {
  const results=document.getElementById('disc-results');
  results.innerHTML=`<p style="font-size:12px;color:#aaa;padding:8px 0 6px">${items.length} results for "<strong style="color:#555">${esc(query)}</strong>"</p>`
    +items.map((item,i)=>{
      const db=loadDB();
      const inDB=Object.values(db.agencies).some(a=>normalizeAgencyName(a.agencyName)+a.countryCode===normalizeAgencyName(item.name)+item.country);
      const addBtn=inDB
        ?`<span style="font-size:11px;color:#2e7d32;font-weight:600">✓ Already tracked</span>`
        :`<button class="btn btn-primary" style="padding:5px 12px;font-size:12px" data-disc-idx="${i}">+ Add to My DB</button>`;
      const rt=[item.vpUrl&&'VP',item.tuUrl&&'TU',item.saUrl&&'SA'].filter(Boolean).map(l=>`<span class="badge badge-${l.toLowerCase()}">${l}</span>`).join('');
      return `<div style="padding:10px 0;border-bottom:1px solid #f5f5f5;display:flex;align-items:flex-start;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
            ${item.country?`<span style="font-size:11px;color:#999">${esc(item.country)}</span>`:''}
            <span style="font-weight:600;font-size:14px;color:#222">${esc(item.name)}</span>
            <span class="status-badge" style="background:#e3f2fd;color:#1565c0;font-size:10px">${esc(item.coverageLevel.replace('_',' '))}</span>
          </div>
          ${item.loc?`<div style="font-size:11px;color:#999;margin-top:2px">${esc(item.loc)}</div>`:''}
          ${rt?`<div style="display:flex;gap:4px;margin-top:5px">${rt}</div>`:''}
          ${item.staticUrl?`<a href="${esc(item.staticUrl)}" target="_blank" rel="noopener" style="font-size:11px;color:#2c5aa0;display:block;margin-top:4px">Static feed ↗</a>`:''}
        </div>
        <div style="flex-shrink:0;display:flex;align-items:center">${addBtn}</div>
      </div>`;
    }).join('');

  results.querySelectorAll('[data-disc-idx]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const item=items[+btn.dataset.discIdx];
      openAgencyModalPrefilled({
        countryCode:item.country, subdivision:item.subdivision||'', cityRegion:item.loc, agencyName:item.name,
        staticUrl:item.staticUrl, rtVpUrl:item.vpUrl, rtTuUrl:item.tuUrl, rtSaUrl:item.saUrl,
        mdbSourceId:item.mdbSourceId,
      });
      document.getElementById('discovery-modal').classList.remove('open');
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 13. Header actions
// ═══════════════════════════════════════════════════════════════════════

function setHeaderActions(tab) {
  const el=document.getElementById('header-actions');
  const sub=document.getElementById('header-subtitle');
  if (tab==='mydb') {
    sub.textContent='Track and manage GTFS data sources globally';
    el.innerHTML=`
      <button class="btn btn-secondary" id="ha-find">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Find & Add
      </button>
      <button class="btn btn-secondary" id="ha-add">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Manually
      </button>
      <button class="btn btn-secondary" id="ha-country">+ Country</button>
      <button class="btn btn-secondary" id="ha-import">Import Source</button>
      <button class="btn btn-secondary" id="ha-export">Export CSV</button>`;
    document.getElementById('ha-find').addEventListener('click',()=>{ populateCountrySelect(); document.getElementById('discovery-modal').classList.add('open'); document.getElementById('disc-query').focus(); });
    document.getElementById('ha-add').addEventListener('click',()=>openAgencyModal());
    document.getElementById('ha-country').addEventListener('click',openCountryModal);
    document.getElementById('ha-import').addEventListener('click',openImportModal);
    document.getElementById('ha-export').addEventListener('click',exportCSV);
  } else {
    sub.textContent='Global GTFS feed directory · Feeds v2 · Read-only';
    el.innerHTML='';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 14. Tab switching
// ═══════════════════════════════════════════════════════════════════════

let activeTab='mydb';

function showTab(name) {
  activeTab=name;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  document.getElementById('tab-mydb').style.display=name==='mydb'?'flex':'none';
  document.getElementById('tab-browse').style.display=name==='browse'?'flex':'none';
  setHeaderActions(name);
  if (name==='browse'&&!browseLoaded) loadBrowseTab();
}

// ═══════════════════════════════════════════════════════════════════════
// 15. Init
// ═══════════════════════════════════════════════════════════════════════

async function init() {
  // Load data from Supabase
  await initDB();

  // Build dynamic modal content
  buildModesGrid();
  buildStatusSelects();
  populateCountryDatalist();
  buildDiscoveryModal();

  // Wire all modals
  wireAgencyModal();
  wireCountryModal();
  wireImportModal();
  wireDiscoveryModal();

  // Wire My Database controls
  wireMyDBControls();

  // Wire Browse controls (safe to call now, elements exist in DOM)
  wireBrowseControls();

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>showTab(btn.dataset.tab));
  });

  // URL tooltip on badges (delegated)
  let activeTip=null;
  function removeTip(){ if(activeTip){activeTip.remove();activeTip=null;} }
  document.addEventListener('mouseover',e=>{
    const badge=e.target.closest('.has-url-tip');
    if(!badge){ removeTip(); return; }
    if(activeTip&&activeTip.parentElement===badge) return;
    removeTip();
    const url=badge.dataset.url; if(!url) return;
    const tip=document.createElement('div');
    tip.className='url-tooltip';
    tip.innerHTML=`<span class="url-tooltip-text">${esc(url)}</span><button class="url-tooltip-copy">Copy</button>`;
    tip.querySelector('.url-tooltip-copy').addEventListener('click',ev=>{
      ev.stopPropagation(); ev.preventDefault();
      navigator.clipboard.writeText(url).then(()=>toast('URL copied','success')).catch(()=>{});
    });
    badge.appendChild(tip);
    activeTip=tip;
  });
  document.addEventListener('mouseout',e=>{
    const badge=e.target.closest('.has-url-tip');
    if(badge&&!badge.contains(e.relatedTarget)) removeTip();
  });

  // Start on My Database tab
  showTab('mydb');
  renderMyDatabase();
}

init();
