/**
 * transit-sources.js
 * Data source: Transitland v2 REST API (CORS-friendly public API)
 * Discovery search: Transitland + Nominatim geocode autocomplete
 */

// ── Constants ────────────────────────────────────────────────────────────────

const TRANSITLAND_API = 'https://transit.land/api/v2/rest';
const NOMINATIM_URL   = 'https://nominatim.openstreetmap.org/search';
const FEEDS_PER_PAGE  = 500;

// ── State ────────────────────────────────────────────────────────────────────

let allAgencies   = [];
let activeFilter  = 'all';
let searchQuery   = '';
let countryFilter = '';
let hasRtFilter   = false;
let loadingMore   = false; // still fetching pages in background

// ── Helpers ──────────────────────────────────────────────────────────────────

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(code) {
  if (!code) return 'Unknown';
  try { return regionNames.of(code.toUpperCase()); } catch { return code; }
}

function flagEmoji(code) {
  if (!code || code.length !== 2) return '🌐';
  try {
    return String.fromCodePoint(
      ...[...code.toUpperCase()].map(c => 0x1F1E0 + c.charCodeAt(0) - 65)
    );
  } catch { return '🌐'; }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Transitland data fetch ───────────────────────────────────────────────────

/**
 * Fetch all feeds from Transitland (paginated).
 * Calls onBatch(feeds, totalSoFar, estimatedTotal) after each page.
 */
async function fetchTransitlandFeeds(onBatch) {
  const apiKey = localStorage.getItem('transitland_api_key') || '';
  let after    = null;
  let fetched  = 0;
  let estimated = null;

  while (true) {
    const params = new URLSearchParams({ limit: FEEDS_PER_PAGE });
    if (after  !== null) params.set('after', after);
    if (apiKey)          params.set('apikey', apiKey);

    const res = await fetch(`${TRANSITLAND_API}/feeds?${params}`);

    if (res.status === 429) throw new Error(
      'Rate limited by Transitland. Add an API key in "Find More Feeds" → details, or wait a moment.'
    );
    if (!res.ok) throw new Error(`Transitland API returned HTTP ${res.status}`);

    const data = await res.json();
    const batch = data.feeds || [];
    fetched += batch.length;
    if (data.meta?.total) estimated = data.meta.total;

    onBatch(batch, fetched, estimated);

    const nextAfter = data.meta?.after;
    if (!nextAfter || batch.length < FEEDS_PER_PAGE) break;
    after = nextAfter;

    // Throttle to ~1 req/sec without API key to respect Transitland rate limit
    if (!apiKey) await sleep(1100);
  }
}

// ── Feed → Agency processing ─────────────────────────────────────────────────

/**
 * Convert a batch of raw Transitland feed objects into the internal agency map.
 * Merges into existing `agencyMap` (for incremental loading).
 */
function mergeFeedsIntoAgencies(feeds, agencyMap) {
  for (const feed of feeds) {
    if (!feed.operators || feed.operators.length === 0) continue;

    const urls = feed.urls || {};
    const authType = resolveAuth(feed.authorization);

    for (const op of feed.operators) {
      const key = op.onestop_id || `${op.country_iso_3166_1_alpha_2 || ''}|${op.city || ''}|${op.name || ''}`;
      if (!agencyMap.has(key)) {
        agencyMap.set(key, {
          key,
          provider:    op.name || op.short_name || 'Unknown',
          country:     op.country_iso_3166_1_alpha_2 || '',
          subdivision: op.state || '',
          municipality: op.city || '',
          staticFeeds: [],
          rtVP: [], rtTU: [], rtSA: [],
          authType,
          coverageLevel: 'static_only',
        });
      }
      const ag = agencyMap.get(key);

      // Update auth if we find a more restrictive type later
      if (authType !== 'open' && ag.authType === 'open') ag.authType = authType;

      // Static feed
      if (feed.spec === 'gtfs' && urls.static_current) {
        if (!ag.staticFeeds.some(f => f.url === urls.static_current)) {
          ag.staticFeeds.push({ url: urls.static_current, id: feed.onestop_id });
        }
      }

      // RT feeds – may be on a gtfs_rt entry OR inline on a gtfs entry
      function addIfNew(arr, url) {
        if (url && !arr.some(f => f.url === url)) arr.push({ url, id: feed.onestop_id });
      }
      addIfNew(ag.rtVP, urls.realtime_vehicle_positions);
      addIfNew(ag.rtTU, urls.realtime_trip_updates);
      addIfNew(ag.rtSA, urls.realtime_alerts);
    }
  }

  // Recompute coverage for every agency in the map
  for (const ag of agencyMap.values()) {
    const hs = ag.staticFeeds.length > 0;
    const hv = ag.rtVP.length > 0;
    const ht = ag.rtTU.length > 0;
    const hasRT = hv || ht || ag.rtSA.length > 0;
    if      (hs && hv && ht) ag.coverageLevel = 'full';
    else if (hs && hasRT)    ag.coverageLevel = 'partial_rt';
    else if (hs)             ag.coverageLevel = 'static_only';
    else                     ag.coverageLevel = 'rt_only';
  }
}

function resolveAuth(auth) {
  if (!auth || !auth.type) return 'open';
  const t = auth.type.toLowerCase();
  if (t.includes('oauth') || t.includes('bearer')) return 'oauth';
  if (t.includes('header') || t.includes('query') || t.includes('path') || t.includes('key')) return 'key';
  return 'open';
}

// ── Filtering ────────────────────────────────────────────────────────────────

function getFiltered() {
  return allAgencies.filter(ag => {
    if (activeFilter !== 'all' && ag.coverageLevel !== activeFilter) return false;
    if (countryFilter && ag.country !== countryFilter) return false;
    if (hasRtFilter && !ag.rtVP.length && !ag.rtTU.length && !ag.rtSA.length) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = [ag.provider, ag.municipality, ag.subdivision, ag.country, countryName(ag.country)]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ── Rendering ────────────────────────────────────────────────────────────────

function feedBadge(feeds, cls, label) {
  if (!feeds.length) return '<span class="dash">—</span>';
  return feeds.slice(0, 2).map(f =>
    f.url
      ? `<span class="badge ${cls}"><a href="${esc(f.url)}" target="_blank" rel="noopener" title="${esc(f.url)}">${label}</a></span>`
      : `<span class="badge ${cls}">${label}</span>`
  ).join('') + (feeds.length > 2 ? `<span class="badge badge-dim">+${feeds.length - 2}</span>` : '');
}

function authBadge(ag) {
  if (ag.authType === 'oauth') return '<span class="auth auth-oauth">OAuth</span>';
  if (ag.authType === 'key')   return '<span class="auth auth-key">API Key</span>';
  return '<span class="auth auth-open">Open</span>';
}

function renderAgencyRow(ag) {
  const loc = [ag.municipality, ag.subdivision].filter(Boolean).join(', ');
  const cls = { full:'row-full', partial_rt:'row-partial', static_only:'row-static', rt_only:'row-rtonly' }[ag.coverageLevel] || '';

  const staticBadges = ag.staticFeeds.length === 0
    ? '<span class="dash">—</span>'
    : ag.staticFeeds.slice(0, 2).map(f =>
        f.url
          ? `<span class="badge badge-gtfs"><a href="${esc(f.url)}" target="_blank" rel="noopener" title="${esc(f.url)}">GTFS</a></span>`
          : `<span class="badge badge-gtfs">GTFS</span>`
      ).join('') + (ag.staticFeeds.length > 2 ? `<span class="badge badge-dim">+${ag.staticFeeds.length - 2}</span>` : '');

  return `
    <tr class="${cls}">
      <td>
        <div class="agency-name" title="${esc(ag.provider)}">${esc(ag.provider)}</div>
        ${loc ? `<div class="agency-loc">${esc(loc)}</div>` : ''}
      </td>
      <td><div class="badges">${staticBadges}</div></td>
      <td><div class="badges">${feedBadge(ag.rtVP, 'badge-vp', 'VP')}</div></td>
      <td><div class="badges">${feedBadge(ag.rtTU, 'badge-tu', 'TU')}</div></td>
      <td><div class="badges">${feedBadge(ag.rtSA, 'badge-sa', 'SA')}</div></td>
      <td>${authBadge(ag)}</td>
    </tr>`;
}

function renderCountry(cc, agencies) {
  const order = { full: 0, partial_rt: 1, static_only: 2, rt_only: 3 };
  agencies.sort((a, b) => (order[a.coverageLevel] ?? 4) - (order[b.coverageLevel] ?? 4));

  const full    = agencies.filter(a => a.coverageLevel === 'full').length;
  const partial = agencies.filter(a => a.coverageLevel === 'partial_rt').length;
  const stat    = agencies.filter(a => a.coverageLevel === 'static_only').length;
  const rtOnly  = agencies.filter(a => a.coverageLevel === 'rt_only').length;

  const badges = [
    full    ? `<span class="c-badge cb-full">${full} Full RT</span>` : '',
    partial ? `<span class="c-badge cb-partial">${partial} Partial RT</span>` : '',
    stat    ? `<span class="c-badge cb-static">${stat} Static</span>` : '',
    rtOnly  ? `<span class="c-badge cb-rtonly">${rtOnly} RT only</span>` : '',
  ].filter(Boolean).join('');

  const expand = agencies.length <= 8;
  const rows = agencies.map(renderAgencyRow).join('');

  return `
    <div class="country-section">
      <div class="country-header">
        <span class="c-flag">${flagEmoji(cc)}</span>
        <div>
          <span class="c-name">${esc(countryName(cc))}</span>
          <span class="c-count"> · ${agencies.length} agenc${agencies.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <div class="c-badges">${badges}</div>
        <svg class="chevron ${expand ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
      <div class="table-wrap" style="display:${expand ? 'block' : 'none'}">
        <table class="agency-table">
          <thead>
            <tr>
              <th>Agency</th>
              <th>GTFS Static</th>
              <th>Vehicle Positions</th>
              <th>Trip Updates</th>
              <th>Alerts</th>
              <th>Auth</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function renderResults() {
  const area   = document.getElementById('results-area');
  const filtered = getFiltered();

  // Result count label
  const cc = document.getElementById('result-count');
  if (cc) {
    const suffix = loadingMore ? ' (loading more…)' : '';
    cc.textContent = `${filtered.length.toLocaleString()} of ${allAgencies.length.toLocaleString()}${suffix}`;
  }

  if (!filtered.length) {
    area.innerHTML = '<div class="center-state"><p>No agencies match your filters.</p></div>';
    return;
  }

  // Group by country, sort by most agencies
  const byCC = {};
  for (const ag of filtered) (byCC[ag.country || 'XX'] ??= []).push(ag);
  const sorted = Object.entries(byCC).sort((a, b) => b[1].length - a[1].length);

  area.innerHTML = sorted.map(([cc, ags]) => renderCountry(cc, ags)).join('');

  // Chevron toggles
  area.querySelectorAll('.country-header').forEach(h => {
    h.addEventListener('click', () => {
      const body = h.nextElementSibling;
      const chev = h.querySelector('.chevron');
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      chev.classList.toggle('open', !open);
    });
  });
}

function updateStats() {
  document.getElementById('s-total').textContent   = allAgencies.length.toLocaleString();
  document.getElementById('s-full').textContent    = allAgencies.filter(a => a.coverageLevel === 'full').length.toLocaleString();
  document.getElementById('s-partial').textContent = allAgencies.filter(a => a.coverageLevel === 'partial_rt').length.toLocaleString();
  document.getElementById('s-static').textContent  = allAgencies.filter(a => a.coverageLevel === 'static_only').length.toLocaleString();
  document.getElementById('s-rtonly').textContent  = allAgencies.filter(a => a.coverageLevel === 'rt_only').length.toLocaleString();
}

function populateCountryFilter() {
  const sel = document.getElementById('f-country');
  // Clear all but first "All countries" option
  while (sel.options.length > 1) sel.remove(1);
  const ccs = [...new Set(allAgencies.map(a => a.country).filter(Boolean))]
    .sort((a, b) => countryName(a).localeCompare(countryName(b)));
  ccs.forEach(cc => {
    const o = document.createElement('option');
    o.value = cc;
    o.textContent = `${flagEmoji(cc)} ${countryName(cc)} (${cc})`;
    if (cc === countryFilter) o.selected = true;
    sel.appendChild(o);
  });
}

// ── Progress bar (during loading) ────────────────────────────────────────────

function showProgress(fetched, total) {
  const area = document.getElementById('results-area');
  const pct  = total ? Math.min(100, Math.round(fetched / total * 100)) : null;

  // First render: replace loading state
  const ls = document.getElementById('loading-state');
  if (ls) {
    ls.innerHTML = `
      <div class="spinner"></div>
      <p>Loading transit feeds…</p>
      <p class="sub" id="progress-text">Fetched ${fetched.toLocaleString()}${total ? ' of ~' + total.toLocaleString() : ''} feeds</p>
      ${pct !== null ? `
        <div style="width:220px;height:6px;background:#e0e0e0;border-radius:3px;overflow:hidden;margin-top:4px">
          <div style="height:100%;background:#2c5aa0;width:${pct}%;transition:width .3s"></div>
        </div>` : ''}
    `;
  }
}

// ── Controls ─────────────────────────────────────────────────────────────────

function wireControls() {
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    renderResults();
  });
  document.getElementById('f-country').addEventListener('change', e => {
    countryFilter = e.target.value;
    renderResults();
  });
  document.getElementById('f-hasrt').addEventListener('change', e => {
    hasRtFilter = e.target.checked;
    renderResults();
  });
  document.querySelectorAll('.stat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter;
      document.querySelectorAll('.stat-chip').forEach(c => c.classList.remove('active-filter'));
      chip.classList.add('active-filter');
      renderResults();
    });
  });
  document.getElementById('clear-btn').addEventListener('click', () => {
    activeFilter = 'all'; searchQuery = ''; countryFilter = ''; hasRtFilter = false;
    document.getElementById('search-input').value = '';
    document.getElementById('f-country').value = '';
    document.getElementById('f-hasrt').checked = false;
    document.querySelectorAll('.stat-chip').forEach(c => c.classList.remove('active-filter'));
    document.querySelectorAll('.stat-chip')[0]?.classList.add('active-filter');
    renderResults();
  });

  // Remove "Status" filter from HTML since Transitland only returns active feeds
  document.getElementById('f-status')?.parentElement?.remove();
}

// ── Discovery modal ──────────────────────────────────────────────────────────

function buildDiscoveryModal() {
  const modal = document.createElement('div');
  modal.id = 'discovery-modal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:white;border-radius:12px;width:min(680px,95vw);max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)">
      <div style="padding:20px 24px 16px;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;gap:12px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2c5aa0" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div>
          <h2 style="font-size:17px;font-weight:700;color:#1c4580">Find GTFS Feeds</h2>
          <p style="font-size:12px;color:#888;margin-top:2px">Search Transitland for feeds by city, region, or agency name</p>
        </div>
        <button id="disc-close" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:24px;color:#bbb;line-height:1;padding:4px 6px">×</button>
      </div>

      <div style="padding:16px 24px;border-bottom:1px solid #f0f0f0">
        <div style="display:flex;gap:10px">
          <div style="flex:1;position:relative">
            <svg style="position:absolute;left:11px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:#aaa;pointer-events:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input id="disc-query" type="text" placeholder="Chicago · São Paulo · TfL · New South Wales…"
              style="width:100%;padding:10px 14px 10px 36px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none;font-family:inherit;transition:border-color .2s"
              onfocus="this.style.borderColor='#2c5aa0'" onblur="this.style.borderColor='#ddd'">
          </div>
          <button id="disc-search-btn"
            style="padding:10px 22px;background:#2c5aa0;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit">
            Search
          </button>
        </div>

        <div id="disc-suggestions" style="display:none;margin-top:6px;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.08)"></div>

        <details style="margin-top:10px">
          <summary style="font-size:12px;color:#aaa;cursor:pointer;user-select:none">Transitland API key (optional — higher rate limits)</summary>
          <div style="margin-top:8px;display:flex;gap:8px">
            <input id="disc-apikey" type="password" placeholder="Paste API key from transit.land…"
              style="flex:1;padding:7px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;outline:none;font-family:inherit">
            <button id="disc-save-key"
              style="padding:7px 14px;background:#f0f2f5;border:1px solid #ddd;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit">Save</button>
          </div>
        </details>
      </div>

      <div id="disc-results" style="flex:1;overflow-y:auto;padding:12px 24px 20px">
        <p style="font-size:13px;color:#ccc;text-align:center;padding:30px 0">
          Enter a city, agency, or country above to search for GTFS feeds.
        </p>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function renderDiscoveryResults(data, query) {
  const el = document.getElementById('disc-results');
  if (!data.feeds || !data.feeds.length) {
    el.innerHTML = `<p style="font-size:13px;color:#999;text-align:center;padding:30px">No feeds found for "<strong>${esc(query)}</strong>".</p>`;
    return;
  }

  const items = data.feeds.map(f => {
    const spec  = (f.spec || '').toUpperCase().replace('_', '-');
    const name  = f.name || f.onestop_id || 'Unknown';
    const urls  = f.urls || {};
    const ops   = (f.operators || []).slice(0, 2)
      .map(o => [o.city, o.state, o.country_iso_3166_1_alpha_2 || o.country].filter(Boolean).join(', '))
      .join(' / ');

    const specColor = spec === 'GTFS' ? '#dbeafe:#1d4ed8' : spec === 'GTFS-RT' ? '#d1fae5:#065f46' : '#f3f4f6:#888';
    const [spBg, spFg] = specColor.split(':');

    const rtDots = [
      urls.realtime_vehicle_positions ? `<span style="background:#d1fae5;color:#065f46;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">VP</span>` : '',
      urls.realtime_trip_updates      ? `<span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">TU</span>` : '',
      urls.realtime_alerts            ? `<span style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">SA</span>` : '',
    ].filter(Boolean).join(' ');

    const urlLinks = [
      urls.static_current              ? `<a href="${esc(urls.static_current)}" target="_blank" rel="noopener" style="font-size:12px;color:#2c5aa0">Static ↗</a>` : '',
      urls.realtime_vehicle_positions  ? `<a href="${esc(urls.realtime_vehicle_positions)}" target="_blank" rel="noopener" style="font-size:12px;color:#2c5aa0">VP ↗</a>` : '',
      urls.realtime_trip_updates       ? `<a href="${esc(urls.realtime_trip_updates)}" target="_blank" rel="noopener" style="font-size:12px;color:#2c5aa0">TU ↗</a>` : '',
      urls.realtime_alerts             ? `<a href="${esc(urls.realtime_alerts)}" target="_blank" rel="noopener" style="font-size:12px;color:#2c5aa0">SA ↗</a>` : '',
    ].filter(Boolean).join(' ');

    return `
      <div style="padding:12px 0;border-bottom:1px solid #f5f5f5">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="background:${spBg};color:${spFg};font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px">${esc(spec)}</span>
              <span style="font-weight:600;font-size:14px;color:#222">${esc(name)}</span>
            </div>
            ${ops ? `<div style="font-size:12px;color:#888;margin-top:3px">${esc(ops)}</div>` : ''}
            ${rtDots ? `<div style="display:flex;gap:5px;margin-top:6px">${rtDots}</div>` : ''}
            ${urlLinks ? `<div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap">${urlLinks}</div>` : ''}
          </div>
          <a href="https://www.transit.land/feeds/${esc(f.onestop_id || '')}" target="_blank" rel="noopener"
            style="font-size:11px;color:#2c5aa0;white-space:nowrap;flex-shrink:0">Transitland ↗</a>
        </div>
      </div>`;
  }).join('');

  const total = data.meta?.total || data.feeds.length;
  el.innerHTML = `
    <p style="font-size:12px;color:#aaa;padding-bottom:8px">
      Showing ${data.feeds.length} of ${total} for "<strong style="color:#555">${esc(query)}</strong>" via Transitland
    </p>
    ${items}
    ${total > data.feeds.length ? `<p style="font-size:12px;color:#ccc;padding-top:8px;text-align:center">Refine your search to see more results</p>` : ''}`;
}

async function doDiscoverySearch() {
  const query = document.getElementById('disc-query').value.trim();
  if (!query) return;

  const btn = document.getElementById('disc-search-btn');
  const res = document.getElementById('disc-results');
  btn.disabled = true; btn.textContent = 'Searching…';
  res.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:40px;color:#888">
    <div class="spinner"></div><span>Querying Transitland…</span></div>`;

  const apiKey = localStorage.getItem('transitland_api_key') || '';
  try {
    const params = new URLSearchParams({ search: query, limit: '30' });
    if (apiKey) params.set('apikey', apiKey);
    const r = await fetch(`${TRANSITLAND_API}/feeds?${params}`);
    if (!r.ok) {
      const msg = r.status === 401 ? 'Invalid API key.' :
                  r.status === 429 ? 'Rate limited — wait a moment or add an API key.' :
                  `Transitland returned ${r.status}.`;
      res.innerHTML = `<p style="color:#c62828;font-size:13px;text-align:center;padding:30px">${esc(msg)}</p>`;
      return;
    }
    renderDiscoveryResults(await r.json(), query);
  } catch (err) {
    res.innerHTML = `<p style="color:#c62828;font-size:13px;text-align:center;padding:30px">
      Search failed: ${esc(err.message)}</p>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Search';
  }
}

// Nominatim location autocomplete
let acTimer = null;
async function fetchSuggestions(query) {
  if (query.length < 3) return [];
  try {
    const params = new URLSearchParams({ format: 'json', q: query, limit: '5', addressdetails: '1', 'accept-language': 'en' });
    const r = await fetch(`${NOMINATIM_URL}?${params}`, { headers: { 'User-Agent': 'gtfs-tools/1.0' } });
    if (!r.ok) return [];
    return (await r.json()).map(x => ({
      label: x.display_name,
      cc:    (x.address?.country_code || '').toUpperCase(),
      city:  x.address?.city || x.address?.town || x.address?.municipality || x.address?.county || '',
      state: x.address?.state || '',
    }));
  } catch { return []; }
}

function wireDiscoveryModal() {
  const modal     = document.getElementById('discovery-modal');
  const closeBtn  = document.getElementById('disc-close');
  const searchBtn = document.getElementById('disc-search-btn');
  const input     = document.getElementById('disc-query');
  const suggs     = document.getElementById('disc-suggestions');
  const keyInput  = document.getElementById('disc-apikey');
  const saveKey   = document.getElementById('disc-save-key');

  const savedKey = localStorage.getItem('transitland_api_key');
  if (savedKey) keyInput.value = savedKey;

  closeBtn.addEventListener('click',  () => { modal.style.display = 'none'; suggs.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) { modal.style.display = 'none'; suggs.style.display = 'none'; } });
  searchBtn.addEventListener('click', () => { suggs.style.display = 'none'; doDiscoverySearch(); });
  input.addEventListener('keydown',   e => { if (e.key === 'Enter') { suggs.style.display = 'none'; doDiscoverySearch(); } });

  saveKey.addEventListener('click', () => {
    const v = keyInput.value.trim();
    if (v) localStorage.setItem('transitland_api_key', v);
    else   localStorage.removeItem('transitland_api_key');
    saveKey.textContent = v ? 'Saved ✓' : 'Cleared';
    setTimeout(() => saveKey.textContent = 'Save', 2000);
  });

  // Location autocomplete
  input.addEventListener('input', () => {
    clearTimeout(acTimer);
    const q = input.value.trim();
    if (q.length < 3) { suggs.style.display = 'none'; return; }
    acTimer = setTimeout(async () => {
      const results = await fetchSuggestions(q);
      if (!results.length) { suggs.style.display = 'none'; return; }
      suggs.style.display = 'block';
      suggs.innerHTML = results.map((r, i) => `
        <div data-idx="${i}" style="padding:9px 14px;cursor:pointer;font-size:13px;color:#333;background:white;border-bottom:1px solid #f5f5f5"
          onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='white'">
          <span style="font-weight:600">${esc(r.city || r.label.split(',')[0])}</span>
          ${r.state ? `<span style="color:#888"> · ${esc(r.state)}</span>` : ''}
          ${r.cc ? `<span style="color:#bbb;font-size:11px"> · ${esc(r.cc)}</span>` : ''}
        </div>`).join('');
      suggs.querySelectorAll('[data-idx]').forEach(el => {
        el.addEventListener('click', () => {
          const r = results[+el.dataset.idx];
          input.value = [r.city, r.state, r.cc].filter(Boolean).join(', ');
          suggs.style.display = 'none';
          doDiscoverySearch();
        });
      });
    }, 300);
  });
}

function addDiscoveryButton() {
  const header = document.querySelector('.page-header');
  if (!header) return;
  const btn = document.createElement('button');
  btn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    Find More Feeds`;
  btn.style.cssText = 'display:flex;align-items:center;gap:7px;padding:9px 16px;background:#2c5aa0;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:background .15s';
  btn.onmouseover = () => btn.style.background = '#1c4580';
  btn.onmouseout  = () => btn.style.background = '#2c5aa0';
  btn.addEventListener('click', () => {
    document.getElementById('discovery-modal').style.display = 'flex';
    document.getElementById('disc-query').focus();
  });
  header.insertBefore(btn, header.querySelector('.search-wrap'));
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  buildDiscoveryModal();
  wireDiscoveryModal();
  addDiscoveryButton();
  wireControls();

  const agencyMap = new Map();
  let firstBatch  = true;

  try {
    await fetchTransitlandFeeds((batch, fetched, total) => {
      mergeFeedsIntoAgencies(batch, agencyMap);
      allAgencies = Array.from(agencyMap.values());

      updateStats();

      if (firstBatch) {
        // Replace loading spinner with first results
        firstBatch = false;
        loadingMore = true;
        document.getElementById('loading-state')?.remove();
        populateCountryFilter();
        renderResults();
      } else {
        // Incrementally update while more pages load
        populateCountryFilter();
        renderResults();
        showLoadingBanner(fetched, total);
      }
    });

    loadingMore = false;
    removeLoadingBanner();
    updateStats();
    renderResults();

  } catch (err) {
    loadingMore = false;
    removeLoadingBanner();

    const isFromFile = location.protocol === 'file:';
    const area = document.getElementById('results-area');

    if (firstBatch) {
      // No data at all — show full error
      const ls = document.getElementById('loading-state') || area;
      ls.innerHTML = `
        <div class="center-state" style="color:#c62828">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:#e57373">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style="font-size:16px;font-weight:700;margin-top:4px">Could not load feed data</p>
          <p class="sub">${esc(err.message)}</p>
          ${isFromFile ? `
          <div style="margin-top:16px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:14px 18px;text-align:left;max-width:420px">
            <p style="font-size:13px;font-weight:700;color:#f57f17;margin-bottom:6px">Open via a local web server</p>
            <p style="font-size:13px;color:#555;margin-bottom:8px">Browsers block API requests from <code>file://</code> pages. Run:</p>
            <code style="display:block;background:#fff3cd;padding:8px 12px;border-radius:5px;font-size:13px;color:#333">python3 -m http.server 8080</code>
            <p style="font-size:12px;color:#888;margin-top:8px">Then open <strong>http://localhost:8080/transit-sources.html</strong></p>
          </div>` : ''}
          <button onclick="location.reload()"
            style="margin-top:16px;padding:9px 22px;background:#2c5aa0;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-family:inherit">
            Retry
          </button>
        </div>`;
    } else {
      // Partial data loaded — show warning banner
      area.insertAdjacentHTML('afterbegin', `
        <div id="error-banner" style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:10px 16px;margin-bottom:12px;font-size:13px;color:#555;display:flex;align-items:center;gap:10px">
          <span style="color:#f57f17">⚠</span>
          Data load interrupted: ${esc(err.message)} — showing partial results.
          <button onclick="location.reload()" style="margin-left:auto;background:none;border:1px solid #ddd;border-radius:6px;padding:4px 12px;cursor:pointer;font-family:inherit;font-size:12px">Retry</button>
        </div>`);
    }
  }
}

// Banner shown while more pages are loading in background
function showLoadingBanner(fetched, total) {
  let banner = document.getElementById('loading-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'loading-banner';
    banner.style.cssText = 'background:#e3f2fd;border:1px solid #bbdefb;border-radius:8px;padding:8px 16px;margin-bottom:12px;font-size:13px;color:#1565c0;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:5';
    document.getElementById('results-area')?.prepend(banner);
  }
  const pct = total ? Math.round(fetched / total * 100) : 0;
  banner.innerHTML = `
    <div class="spinner" style="width:16px;height:16px;border-width:2px;flex-shrink:0"></div>
    Loading more feeds… ${fetched.toLocaleString()}${total ? ' / ~' + total.toLocaleString() : ''}
    ${pct ? `<div style="flex:1;height:4px;background:#bbdefb;border-radius:2px;overflow:hidden">
      <div style="height:100%;background:#1565c0;width:${pct}%;transition:width .3s"></div>
    </div>` : ''}`;
}

function removeLoadingBanner() {
  document.getElementById('loading-banner')?.remove();
}

init();
