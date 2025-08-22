// windsong-controller.js
(function () {
  // ---------- Storage helpers ----------
  const STORE_KEY = 'windsong.settings.v1';
  function clampN(v, min, max, def) {
    v = Number(v);
    return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def;
  }
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return {
        wind:   clampN(s.wind,   1, 10, 5),
        breath: clampN(s.breath, 6,  30, 16),
        elegra: clampN(s.elegra, 8,  30, 15),
        rez:    clampN(s.rez,    1,   6,  1),
      };
    } catch {
      return { wind:5, breath:16, elegra:15, rez:1 };
    }
  }
  function saveSettings(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
  }

  // ---------- Shared state bootstrap ----------
  const settings = loadSettings();
  window.__WINDS_SONG__ = window.__WINDS_SONG__ || {};
  if (window.__WINDS_SONG__.wind   == null) window.__WINDS_SONG__.wind   = settings.wind;
  if (window.__WINDS_SONG__.breath == null) window.__WINDS_SONG__.breath = settings.breath;
  if (window.__WINDS_SONG__.elegra == null) window.__WINDS_SONG__.elegra = settings.elegra;
  if (window.__WINDS_SONG__.rez    == null) window.__WINDS_SONG__.rez    = settings.rez;

  // Inform environment.html about current wind on boot (leaves speed)
  postWindToEnvironment(window.__WINDS_SONG__.wind);

  // ---------- Minimal styles ----------
  injectCSS(`
    .ws-activator{
      position:fixed; right:14px; bottom:14px; z-index:9998;
      width:38px; height:38px; border-radius:10px; display:grid; place-items:center;
      background:rgba(20,24,30,.55); backdrop-filter:blur(6px);
      border:1px solid rgba(255,255,255,.08); color:#cfe7ff; cursor:pointer;
      box-shadow:0 6px 18px rgba(0,0,0,.25);
    }
    .ws-activator svg{ width:20px; height:20px; opacity:.9 }

    .ws-panel{
      position:fixed; right:14px; bottom:62px; z-index:9999;
      max-width:360px; width:calc(100vw - 28px);
      background:linear-gradient(180deg, rgba(15,18,24,.85), rgba(15,18,24,.90));
      border:1px solid rgba(255,255,255,.08); border-radius:14px;
      padding:12px 12px 10px; color:#fff;
      font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      box-shadow:0 10px 28px rgba(0,0,0,.35);
    }
    .ws-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
    .ws-title{ font-weight:700; letter-spacing:.3px; color:#e9f2ff; display:flex; align-items:center; gap:8px; }
    .ws-close{ cursor:pointer; opacity:.8; }
    .ws-close:hover{ opacity:1; }
    .ws-row{ display:flex; align-items:center; gap:10px; margin:10px 2px; }
    .ws-icon{ width:22px; height:22px; opacity:.9; flex:0 0 auto; }
    .ws-label{ color:#cfe7ff; min-width:72px; }
    .ws-slider{ flex:1; display:flex; align-items:center; gap:8px; }
    .ws-slider input[type="range"]{ width:100%; -webkit-appearance:none; height:4px; background:#2a3444; border-radius:6px; outline:none; }
    .ws-slider input[type="range"]::-webkit-slider-thumb{
      -webkit-appearance:none; width:16px; height:16px; border-radius:50%;
      background:#8dc6ff; border:1px solid rgba(255,255,255,.6);
      box-shadow:0 0 0 3px rgba(141,198,255,.15);
    }
    .ws-val{ width:36px; text-align:right; color:#a9c6ff; opacity:.95; font-variant-numeric:tabular-nums; }
    .ws-help{ color:#9fb4d8; opacity:.85; font-size:12px; margin:6px 4px 2px; }
    .ws-actions{ display:flex; gap:8px; margin-top:10px; }
    .ws-btn{
      flex:1; text-align:center; padding:8px 10px; border-radius:10px; cursor:pointer; user-select:none;
      background:rgba(141,198,255,.12); color:#e6f3ff; border:1px solid rgba(141,198,255,.35);
    }
    .ws-btn.primary{ background:rgba(141,198,255,.22); }
    .ws-btn:hover{ filter:brightness(1.05); }

    /* Menu item variant */
    .ws-menu-item{ cursor:pointer; }
  `);

  // ---------- Build UI ----------
  const panel = buildPanel(
    settings,
    onApply,                     // Apply closes panel + broadcasts
    onTriggerNow,                // Trigger-now for testing
    onExit                       // X close
  );
  panel.style.display = 'none';
  document.body.appendChild(panel);

  // Try to add a “WindSong” menu item near “About”; fallback to floating ♪
  const menuInserted = attachMenuRobust(openPanel);
  if (!menuInserted) {
    const activator = buildActivator(openPanel);
    document.body.appendChild(activator);
  }

  // Keep panel knobs synced if something else updates them
  window.addEventListener('windsong:update', () => {
    const s = window.__WINDS_SONG__ || settings;
    const map = {
      '#ws-wind': s.wind, '#ws-breath': s.breath, '#ws-elegra': s.elegra, '#ws-rez': s.rez
    };
    for (const sel in map) {
      const input = panel.querySelector(sel);
      const val   = panel.querySelector(sel + '-val');
      if (input) input.value = String(map[sel]);
      if (val)   val.textContent = String(map[sel]);
    }
  });

  // ---------- Functions ----------
  function buildPanel(initVals, onApplyCb, onTriggerCb, onExitCb) {
    const el = document.createElement('div');
    el.className = 'ws-panel';
    el.innerHTML = `
      <div class="ws-head">
        <div class="ws-title">${svgWind()} <span>WindSong</span></div>
        <div class="ws-close" title="Close">${svgClose()}</div>
      </div>

      <div class="ws-row">
        <div class="ws-icon">${svgWind()}</div>
        <div class="ws-label">Wind</div>
        <div class="ws-slider">
          <input id="ws-wind" type="range" min="1" max="10" step="1" />
          <div class="ws-val" id="ws-wind-val"></div>
        </div>
      </div>

      <div class="ws-row">
        <div class="ws-icon">${svgBreath()}</div>
        <div class="ws-label">Breath</div>
        <div class="ws-slider">
          <input id="ws-breath" type="range" min="6" max="30" step="1" />
          <div class="ws-val" id="ws-breath-val"></div>
        </div>
      </div>

      <div class="ws-row">
        <div class="ws-icon">${svgElegra()}</div>
        <div class="ws-label">Elegra</div>
        <div class="ws-slider">
          <input id="ws-elegra" type="range" min="8" max="30" step="1" />
          <div class="ws-val" id="ws-elegra-val"></div>
        </div>
      </div>

      <div class="ws-row">
        <div class="ws-icon">${svgClock()}</div>
        <div class="ws-label">Rez</div>
        <div class="ws-slider">
          <input id="ws-rez" type="range" min="1" max="6" step="1" />
          <div class="ws-val" id="ws-rez-val"></div>
        </div>
      </div>

      <div class="ws-help">
        Breath = seconds between drifting lines. Elegra = reveal pacing (seconds).
        Rez = times per hour (1 = once per refresh).
      </div>

      <div class="ws-actions">
        <div class="ws-btn" id="ws-trigger">Trigger now</div>
        <div class="ws-btn primary" id="ws-apply">Apply</div>
      </div>
    `;

    // Wire inputs + initial values
    const wind   = el.querySelector('#ws-wind');
    const breath = el.querySelector('#ws-breath');
    const elegra = el.querySelector('#ws-elegra');
    const rez    = el.querySelector('#ws-rez');

    const windVal   = el.querySelector('#ws-wind-val');
    const breathVal = el.querySelector('#ws-breath-val');
    const elegraVal = el.querySelector('#ws-elegra-val');
    const rezVal    = el.querySelector('#ws-rez-val');

    wind.value   = initVals.wind;
    breath.value = initVals.breath;
    elegra.value = initVals.elegra;
    rez.value    = initVals.rez;

    const syncVals = () => {
      windVal.textContent   = wind.value;
      breathVal.textContent = breath.value;
      elegraVal.textContent = elegra.value;
      rezVal.textContent    = rez.value;
    };
    syncVals();

    wind.addEventListener('input', syncVals);
    breath.addEventListener('input', syncVals);
    elegra.addEventListener('input', syncVals);
    rez.addEventListener('input', syncVals);

    // Close (X)
    el.querySelector('.ws-close').addEventListener('click', onExitCb);

    // Buttons
    el.querySelector('#ws-apply').addEventListener('click', () => {
      const next = {
        wind:   clampN(wind.value,   1, 10, 5),
        breath: clampN(breath.value, 6, 30, 16),
        elegra: clampN(elegra.value, 8, 30, 15),
        rez:    clampN(rez.value,    1,  6,  1),
      };
      onApplyCb(next);   // also closes panel
    });
    el.querySelector('#ws-trigger').addEventListener('click', () => { onTriggerCb(); });

    return el;
  }

  function openPanel() { panel.style.display = 'block'; }
  function onExit()    { panel.style.display = 'none'; }

  function onApply(next) {
    // Save and update shared state
    saveSettings(next);
    window.__WINDS_SONG__.wind   = Number(next.wind);
    window.__WINDS_SONG__.breath = Number(next.breath);
    window.__WINDS_SONG__.elegra = Number(next.elegra);
    window.__WINDS_SONG__.rez    = Number(next.rez);

    // Broadcast to environment.js
    window.dispatchEvent(new CustomEvent('windsong:update', { detail: next }));

    // Inform the background iframe (environment.html) about wind speed
    postWindToEnvironment(next.wind);

    // Close the panel on Apply (as requested)
    onExit();
  }

  function onTriggerNow() {
    // Immediately run a Wind’s Song cycle (for testing)
    window.dispatchEvent(new Event('windsong:trigger'));
  }

  // Fallback floating button
  function buildActivator(openFn) {
    const b = document.createElement('div');
    b.className = 'ws-activator';
    b.innerHTML = svgWind();
    b.title = 'WindSong';
    b.addEventListener('click', openFn);
    return b;
  }

  // -------- Robust menu attach (next to "About" if present) --------
  function findMenuCandidate(doc){
    if (!doc) return null;
    // 1) Obvious containers
    const cand = doc.querySelector('[data-menu], nav .menu-list, nav ul, .menu, .site-menu, .main-menu, header nav ul, nav, .wrap .menu');
    if (cand) return cand;

    // 2) Locate the existing “About” item
    const about = Array.from(doc.querySelectorAll('*'))
      .find(el => el.textContent && el.textContent.trim().toLowerCase() === 'about');
    if (about && about.parentElement) return about.parentElement;

    return null;
  }

  function insertMenuItem(doc, openFn){
    const menu = findMenuCandidate(doc);
    if (!menu) return false;
    if (doc.getElementById('windsong-menu-item')) return true;

    // Determine if it's a list or a free container
    const tag = menu.tagName.toLowerCase();
    const item = (tag === 'ul' || tag === 'ol') ? doc.createElement('li') : doc.createElement('div');
    item.id = 'windsong-menu-item';
    item.className = 'ws-menu-item';
    item.style.cssText = 'padding:6px 10px; opacity:.9;';
    item.textContent = 'WindSong';
    item.addEventListener('click', (e)=>{ e.preventDefault(); openFn(); });

    // If there's an "About" sibling, try to place next to it
    const maybeAbout = Array.from(menu.children).find(
      n => n.textContent && n.textContent.trim().toLowerCase() === 'about'
    );
    if (maybeAbout && maybeAbout.nextSibling) {
      menu.insertBefore(item, maybeAbout.nextSibling);
    } else {
      menu.appendChild(item);
    }
    return true;
  }

  function attachMenuRobust(openFn){
    let attached = insertMenuItem(document, openFn);
    if (attached) return true;

    // Retry a few times in case menu renders late
    let tries = 0;
    const t = setInterval(()=>{
      tries++;
      attached = insertMenuItem(document, openFn);
      if (attached || tries > 10) {
        clearInterval(t);
        if (!attached) {
          // Will fall back to floating button
        }
      }
    }, 200);

    // MutationObserver safety net
    const mo = new MutationObserver(() => {
      if (insertMenuItem(document, openFn)) {
        mo.disconnect();
      }
    });
    mo.observe(document.body, { childList:true, subtree:true });

    return attached;
  }

  // ---------- helpers ----------
  function postWindToEnvironment(windVal) {
    const iframe = document.getElementById('environment-iframe');
    if (!iframe || !iframe.contentWindow) return;
    const wind = Number(windVal) || 5;
    try { iframe.contentWindow.postMessage({ type: 'WIND_UPDATE', wind }, '*'); } catch {}
  }

  function injectCSS(text) {
    const tag = document.createElement('style');
    tag.textContent = text;
    document.head.appendChild(tag);
  }

  // ---------- SVG icons ----------
  function svgWind() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 8h10a3 3 0 1 0-3-3" />
        <path d="M3 12h14a3 3 0 1 1-3 3" />
      </svg>`;
  }
  function svgBreath() {
    // poem ↔ poem
    return `
      <svg viewBox="0 0 64 24" fill="none" stroke="currentColor" stroke-width="1.4"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="18" height="16" rx="2" />
        <rect x="44" y="4" width="18" height="16" rx="2" />
        <path d="M22 12h20" />
        <path d="M28 8l-6 4 6 4" />
        <path d="M36 8l6 4-6 4" />
      </svg>`;
  }
  function svgElegra() {
    return `
      <svg viewBox="0 0 64 24" fill="none" stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round" aria-hidden="true">
        <path d="M2 12 C10 4, 18 20, 26 12 S42 4, 50 12 S58 20, 62 12" />
      </svg>`;
  }
  function svgClock() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7v5l3 2"></path>
      </svg>`;
  }
  function svgClose() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12"></path>
      </svg>`;
  }
})();
