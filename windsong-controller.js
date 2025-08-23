<script>
// windsong-controller.js
(function () {
  // ---------- Storage helpers ----------
  const STORE_KEY = 'windsong.settings.v1';
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return {
        wind:   clampN(s.wind,   1, 10, 5),
        breath: clampN(s.breath, 6,  30, 16), // now: butterfly oscillation
        elegra: clampN(s.elegra, 8,  30, 15), // UI kept; reveal speed fixed in env.js
        rez:    clampN(s.rez,    1,   6,  1),
      };
    } catch { return { wind:5, breath:16, elegra:15, rez:1 }; }
  }
  function saveSettings(s) {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  }
  function clampN(v, min, max, def) {
    v = Number(v);
    return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def;
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

  // ---------- Minimal styles ----------
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
      right:14px; /* below About area; top set dynamically */
      display:none;
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
    .ws-menu-item{ cursor:pointer; }
  `);

  // ---------- Build UI ----------
  const panel = buildPanel(settings, onApply, onExit);
  document.body.appendChild(panel);

  // Try to place activator a few px below the "About" three-dot button; fallback to bottom-right
  const activator = buildActivator(openPanel);
  positionActivatorNearAbout(activator);
  document.body.appendChild(activator);

  // ---------- Rez scheduler (top-of-hour aligned) ----------
  let rezTimerInitial = null;
  let rezInterval = null;
  let suspendedBySpecialPoem = false;

  function clearRezSchedule(){
    if (rezTimerInitial) { clearTimeout(rezTimerInitial); rezTimerInitial = null; }
    if (rezInterval) { clearInterval(rezInterval); rezInterval = null; }
  }
  function scheduleRez(rez){
    clearRezSchedule();
    if (rez <= 1) return; // repeats disabled; environment does the once-per-refresh
    // wait until top of next hour, then fire rez times/hour evenly
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setMinutes(0,0,0);
    if (now >= nextHour) nextHour.setHours(nextHour.getHours()+1);

    rezTimerInitial = setTimeout(()=>{
      if (!suspendedBySpecialPoem) dispatchTrigger();
      const periodMs = Math.floor(60*60*1000 / rez);
      rezInterval = setInterval(()=>{
        if (!suspendedBySpecialPoem) dispatchTrigger();
      }, periodMs);
    }, nextHour.getTime() - now.getTime());
  }
  function dispatchTrigger(){
    window.dispatchEvent(new Event('windsong:trigger'));
  }

  // suspend/resume for special poem
  window.addEventListener('special-poem:begin', ()=>{ suspendedBySpecialPoem = true; });
  window.addEventListener('special-poem:end', ()=>{ suspendedBySpecialPoem = false; });

  // kick scheduler with current rez
  scheduleRez(settings.rez);

  // ---------- Functions ----------
  function buildPanel(initVals, onApplyCb, onExitCb) {
    const el = document.createElement('div');
    el.className = 'ws-panel';
    el.innerHTML = `
      <div class="ws-head">
        <div class="ws-title">
          ${svgWind()}
          <span>Wind Song</span>
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
        Wind = speed of all motion. Breath = butterfly oscillation. Elegra kept (reveal is fixed slow).
        Rez = repeats per hour (1 = once per refresh only).
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

    // Apply button (saves, dispatches, posts wind to iframe, closes)
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
    const pnl = document.querySelector('.ws-panel');
    pnl.style.display = 'block';
    // place panel a little below the activator
    const activ = document.querySelector('.ws-activator');
    if (activ) {
      pnl.style.top = (activ.getBoundingClientRect().bottom + 10) + 'px';
    } else {
      pnl.style.bottom = '62px';
    }
  }
  function onExit() {
    document.querySelector('.ws-panel').style.display = 'none';
  }

  function onApply(next) {
    // Save
    saveSettings(next);

    // Update shared state
    window.__WINDS_SONG__.wind   = Number(next.wind);
    window.__WINDS_SONG__.breath = Number(next.breath);
    window.__WINDS_SONG__.elegra = Number(next.elegra);
    window.__WINDS_SONG__.rez    = Number(next.rez);

    // Dispatch app-wide event (environment.js listens)
    window.dispatchEvent(new CustomEvent('windsong:update', { detail: next }));

    // Inform the background iframe (environment.html) about wind speed as well
    postWindToEnvironment(next.wind);

    // Re-schedule Rez
    scheduleRez(next.rez);

    // Close panel
    onExit();
  }

  function buildActivator(openFn) {
    const b = document.createElement('div');
    b.className = 'ws-activator';
    b.innerHTML = svgWind();
    b.title = 'Wind Song';
    b.addEventListener('click', openFn);
    return b;
  }

  function positionActivatorNearAbout(el){
    // try to find an About button (heuristics)
    const candidates = Array.from(document.querySelectorAll('*'))
      .filter(n=>{
        const txt = (n.textContent || '').trim().toLowerCase();
        const aria = (n.getAttribute && (n.getAttribute('aria-label')||'')).toLowerCase();
        return txt === 'about' || aria === 'about' || n.id === 'about' || n.className.toLowerCase().includes('about');
      });

    if (candidates.length){
      const a = candidates[0].getBoundingClientRect();
      el.style.left = (a.left) + 'px';
      el.style.top  = (a.bottom + 12) + 'px'; // a few spaces below
    } else {
      // fallback bottom-right
      el.style.right = '14px';
      el.style.bottom = '14px';
    }
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

  // ---------- SVG icons ----------
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
</script>
