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
        wind:   clampN(s.wind,   1, 10, 5),  // 5 = baseline
        breath: clampN(s.breath, 6,  30, 16),// now: butterfly feel only
        elegra: clampN(s.elegra, 8,  30, 15),
        rez:    clampN(s.rez,    1,   6,  1),
      };
    } catch {
      return { wind:5, breath:16, elegra:15, rez:1 };
    }
  }
  function saveSettings(s) {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  }

  // ---------- Shared state bootstrap ----------
  const settings = loadSettings();
  window.__WINDS_SONG__ = window.__WINDS_SONG__ || {};
  if (window.__WINDS_SONG__.wind   == null) window.__WINDS_SONG__.wind   = settings.wind;
  if (window.__WINDS_SONG__.breath == null) window.__WINDS_SONG__.breath = settings.breath;
  if (window.__WINDS_SONG__.elegra == null) window.__WINDS_SONG__.elegra = settings.elegra;
  if (window.__WINDS_SONG__.rez    == null) window.__WINDS_SONG__.rez    = settings.rez;

  // Inform environment.html about current wind multiplier (so leaves speed match)
  postWindToEnvironment(settings.wind);

  // ---------- Minimal styles (same clean look) ----------
  injectCSS(`
    .ws-activator{
      position:fixed; z-index:9998;
      width:38px; height:38px; border-radius:10px; display:grid; place-items:center;
      background:rgba(20,24,30,.55); backdrop-filter:blur(6px);
      border:1px solid rgba(255,255,255,.08); color:#cfe7ff; cursor:pointer;
      box-shadow:0 6px 18px rgba(0,0,0,.25);
    }
    .ws-activator svg{ width:20px; height:20px; opacity:.9 }

    .ws-panel{
      position:fixed; z-index:9999;
      max-width:360px; width:calc(100vw - 28px);
      background:linear-gradient(180deg, rgba(15,18,24,.85), rgba(15,18,24,.90));
      border:1px solid rgba(255,255,255,.08); border-radius:14px;
      padding:12px 12px 10px; color:#fff; font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
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
    .ws-slider input[type="range"]{
      width:100%; -webkit-appearance:none; height:4px; background:#2a3444; border-radius:6px; outline:none;
    }
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
  `);

  // ---------- Build UI ----------
  const panel = buildPanel(settings, onApply, onExit);
  document.body.appendChild(panel);

  // Place activator a bit below the “three-dot About” menu (if we can find it),
  // otherwise fall back to bottom-right.
  const activator = buildActivator(openPanel);
  document.body.appendChild(activator);
  positionActivatorNearMoreMenu(activator);

  // Reposition on resize (layout can shift)
  window.addEventListener('resize', () => positionActivatorNearMoreMenu(activator));

  // ---------- Functions ----------
  function buildPanel(initVals, onApplyCb, onExitCb) {
    const el = document.createElement('div');
    el.className = 'ws-panel';
    el.style.display = 'none';

    el.innerHTML = `
      <div class="ws-head">
        <div class="ws-title">
          ${svgWind()}
          <span>WindSong</span>
        </div>
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
        Breath = butterfly feel. Elegra = reveal pacing (seconds).
        Rez = times per hour (1 = once per refresh).
      </div>

      <div class="ws-actions">
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

    // Close button
    el.querySelector('.ws-close').addEventListener('click', onExitCb);

    // Apply (applies + closes)
    el.querySelector('#ws-apply').addEventListener('click', () => {
      const next = {
        wind:   clampN(wind.value,   1, 10, 5),
        breath: clampN(breath.value, 6, 30, 16),
        elegra: clampN(elegra.value, 8, 30, 15),
        rez:    clampN(rez.value,    1,  6,  1),
      };
      onApplyCb(next);
    });

    return el;
  }

  function openPanel() {
    const p = document.querySelector('.ws-panel');
    if (p) {
      // Position the panel near the activator (top-right by default)
      const a = document.querySelector('.ws-activator');
      if (a) {
        const r = a.getBoundingClientRect();
        p.style.right  = `${Math.max(14, window.innerWidth - r.right)}px`;
        p.style.bottom = `${Math.max(62, window.innerHeight - r.top + 8)}px`;
      } else {
        // default bottom-right
        p.style.right = '14px';
        p.style.bottom = '62px';
      }
      p.style.display = 'block';
    }
  }

  function onExit() {
    const p = document.querySelector('.ws-panel');
    if (p) p.style.display = 'none';
  }

  function onApply(next) {
    // Save
    saveSettings(next);

    // Update shared state for environment.js
    window.__WINDS_SONG__.wind   = Number(next.wind);
    window.__WINDS_SONG__.breath = Number(next.breath); // butterflies only
    window.__WINDS_SONG__.elegra = Number(next.elegra);
    window.__WINDS_SONG__.rez    = Number(next.rez);

    // Broadcast to environment.js
    window.dispatchEvent(new CustomEvent('windsong:update', { detail: next }));

    // Inform background iframe (environment.html) about wind speed (leaves)
    postWindToEnvironment(next.wind);

    // Close panel
    onExit();
  }

  function buildActivator(openFn) {
    const b = document.createElement('div');
    b.className = 'ws-activator';
    b.innerHTML = svgWind();
    b.title = 'WindSong';
    b.addEventListener('click', openFn);
    // default position (bottom-right); may be repositioned below
    Object.assign(b.style, { right: '14px', bottom: '14px' });
    return b;
  }

  function positionActivatorNearMoreMenu(buttonEl) {
    // Try to find the three-dot About menu trigger; common guesses:
    const candidates = [
      '.menu [aria-label="More"]',
      '.menu .more',
      '.menu button',
      '.menu',
      'nav .more',
      'nav [aria-label="More"]',
      'nav button.more',
      'nav',
      '.wrap .menu'
    ];
    let anchor = null;
    for (const sel of candidates) {
      const found = document.querySelector(sel);
      if (found) { anchor = found; break; }
    }
    if (!anchor) {
      // fallback: bottom-right
      Object.assign(buttonEl.style, { right: '14px', bottom: '14px', left: '', top: '' });
      return;
    }
    const r = anchor.getBoundingClientRect();
    // Place a few pixels below it, right-aligned to the anchor’s right edge
    const top  = Math.round(r.bottom + 10);
    const left = Math.round(r.right - 38); // align right edges (38px wide)
    Object.assign(buttonEl.style, {
      top:  `${top}px`,
      left: `${Math.max(8, left)}px`,
      right: '', bottom: ''
    });
  }

  function postWindToEnvironment(windVal) {
    const iframe = document.getElementById('environment-iframe');
    if (!iframe || !iframe.contentWindow) return;
    const wind = Number(windVal) || 5;
    iframe.contentWindow.postMessage({ type: 'WIND_UPDATE', wind }, '*');
  }

  function injectCSS(text) {
    const tag = document.createElement('style');
    tag.textContent = text;
    document.head.appendChild(tag);
  }

  // ---------- SVG icons (unchanged visuals) ----------
  function svgWind() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 8c4 0 6-2 9-2 2.5 0 3.5 1.5 3.5 2.8 0 1.2-1 2.2-2.3 2.2" />
        <path d="M3 12h10c2 0 3-1 3-2.2C16 8.5 15 7 12.5 7" />
        <path d="M3 16c5 0 8-2 12-2 2 0 3 1.2 3 2.2 0 1.2-1 2.8-3.2 2.8" />
        <path d="M6 9c.8-.6 1.5-1.2 2.2-1.8" />
      </svg>`;
  }
  function svgBreath() {
    // "poem ↔ poem" glyph: two blocks with a bidirectional arrow
    return `
      <svg viewBox="0 0 64 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="18" height="16" rx="2" />
        <rect x="44" y="4" width="18" height="16" rx="2" />
        <path d="M22 12h20" />
        <path d="M28 8l-6 4 6 4" />
        <path d="M36 8l6 4-6 4" />
      </svg>`;
  }
  function svgElegra() {
    // rhythm line (fade pattern feel)
    return `
      <svg viewBox="0 0 64 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
        <path d="M2 12 C10 4, 18 20, 26 12 S42 4, 50 12 S58 20, 62 12" />
      </svg>`;
  }
  function svgClock() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7v5l3 2"></path>
      </svg>`;
  }
  function svgClose() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12"></path>
      </svg>`;
  }
})();
