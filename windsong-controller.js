// windsong-controller.js
(function () {
  // ------- ephemeral state (no persistence; reload resets to defaults) -------
  let ui = {
    windScale: 1.0, // 0.2..3.0 (ONLY changes speed, not visuals)
    breathSec: 18,  // seconds between drifting lines (same gap for all lines)
    elegraSec: 15,  // seconds per reveal phase at the bottom
    rezPerHour: 1   // 1 = once per refresh; >1 = repeat every (60 / rez) minutes
  };

  // schedule handle for Rez repeats
  let rezTimer = null;

  // ------- helpers -------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const $ = (id) => document.getElementById(id);

  // Send wind speed to the background iframe (leaves/wind only)
  function pushWindToIframe() {
    const iframe = document.getElementById('environment-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'ENV_SET_WIND', scale: ui.windScale }, '*');
    }
  }

  // Notify environment.js (poem & butterfly) without touching its visuals/logic
  function broadcastToEnvironment() {
    const detail = {
      windScale: ui.windScale,
      breathSec: ui.breathSec,
      elegraSec: ui.elegraSec
    };
    window.dispatchEvent(new CustomEvent('windsong:update', { detail }));
  }

  // Ask environment.js to start another poem “cycle” (drift + reveal)
  function triggerPoemCycle(reason) {
    window.dispatchEvent(new CustomEvent('windsong:trigger', { detail: { reason } }));
  }

  // ------- Rez scheduling (repeat cycles per hour until reload) -------
  function clearRezTimer() {
    if (rezTimer) {
      clearInterval(rezTimer);
      rezTimer = null;
    }
  }

  function applyRez() {
    clearRezTimer();

    const n = clamp(Math.round(ui.rezPerHour), 1, 10);

    // Rez = 1 → once per refresh only; environment.js already runs one cycle.
    if (n <= 1) return;

    // Rez > 1 → repeat every (60 / Rez) minutes.
    const intervalMs = Math.round((60 / n) * 60_000);

    // Fire the additional cycles on schedule.
    // We DO NOT interrupt a running cycle; environment.js will ignore overlap.
    rezTimer = setInterval(() => triggerPoemCycle('rez'), intervalMs);

    // Optionally start one immediately so the user doesn’t wait a long interval.
    // (Comment the next line out if you want the first repeat strictly on the interval.)
    triggerPoemCycle('rez-instant');
  }

  // ------- settings panel (opened from your existing menu) -------
  function createPanel() {
    if (document.getElementById('windsong-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'windsong-panel';
    panel.style.cssText = `
      position:fixed; top:58px; right:12px; z-index:10001;
      background:linear-gradient(180deg,#101522,#0f1522);
      border:1px solid #21283a; border-radius:12px; padding:10px 12px; color:#e8ecf4;
      box-shadow:0 10px 24px rgba(0,0,0,.35);
      width: 300px; display:none; pointer-events:auto;
    `;
    panel.innerHTML = `
      <h4 style="margin:4px 0 8px; font-size:14px; color:#aeb7c8; letter-spacing:.2px;">Wind’s Song</h4>

      <div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:8px 0;">
        <label for="ws-wind" style="font-size:13px;">Wind (speed)</label>
        <input id="ws-wind" type="range" min="0.2" max="3" step="0.1" style="width:160px;">
        <span id="ws-wind-val" style="font-size:12px;color:#aeb7c8;"></span>
      </div>

      <div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:8px 0;">
        <label for="ws-breath" style="font-size:13px;">Breath (sec between lines)</label>
        <input id="ws-breath" type="number" min="6" max="60" style="width:80px;background:#0b1120;border:1px solid #242c3e;color:#e8ecf4;border-radius:8px;padding:4px 6px;">
      </div>

      <div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:8px 0;">
        <label for="ws-elegra" style="font-size:13px;">Elegra (sec per phase)</label>
        <input id="ws-elegra" type="number" min="6" max="45" style="width:80px;background:#0b1120;border:1px solid #242c3e;color:#e8ecf4;border-radius:8px;padding:4px 6px;">
      </div>

      <div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:8px 0;">
        <label for="ws-rez" style="font-size:13px;">Rez (cycles/hour)</label>
        <input id="ws-rez" type="number" min="1" max="10" style="width:80px;background:#0b1120;border:1px solid #242c3e;color:#e8ecf4;border-radius:8px;padding:4px 6px;">
      </div>

      <div style="font-size:12px;color:#aeb7c8;line-height:1.4;margin-top:6px;">
        Rez 1 = once per refresh (default). Rez &gt; 1 = repeat every (60 / Rez) min until reload. Changes are temporary.
      </div>
    `;
    document.body.appendChild(panel);

    // wire
    const wind   = $('ws-wind'),   windVal = $('ws-wind-val');
    const breath = $('ws-breath'), elegra  = $('ws-elegra');
    const rez    = $('ws-rez');

    function sync() {
      wind.value   = String(ui.windScale);
      windVal.textContent = ui.windScale.toFixed(1) + '×';
      breath.value = String(ui.breathSec);
      elegra.value = String(ui.elegraSec);
      rez.value    = String(ui.rezPerHour);
    }
    sync();

    wind.addEventListener('input', () => {
      ui.windScale = clamp(Number(wind.value), 0.2, 3.0);
      windVal.textContent = ui.windScale.toFixed(1) + '×';
      pushWindToIframe();       // leaves / wind
      broadcastToEnvironment(); // poem drift + butterfly
    });

    breath.addEventListener('change', () => {
      ui.breathSec = clamp(Number(breath.value), 6, 60);
      broadcastToEnvironment();
    });

    elegra.addEventListener('change', () => {
      ui.elegraSec = clamp(Number(elegra.value), 6, 45);
      broadcastToEnvironment();
    });

    rez.addEventListener('change', () => {
      ui.rezPerHour = clamp(Number(rez.value), 1, 10);
      applyRez();
    });

    // click-away close
    document.addEventListener('click', (e) => {
      const inPanel = e.target.closest('#windsong-panel');
      const inMenu  = e.target.closest('.menu-wrap');
      if (!inPanel && !inMenu) panel.style.display = 'none';
    });
  }

  function ensureMenuItem() {
    const menu = document.getElementById('menuDropdown');
    if (!menu) return;
    if (document.getElementById('windsongMenuItem')) return;

    const btn = document.createElement('button');
    btn.id = 'windsongMenuItem';
    btn.className = 'menu-item';
    btn.type = 'button';
    btn.textContent = 'Wind’s Song';
    btn.addEventListener('click', () => {
      createPanel();
      const p = document.getElementById('windsong-panel');
      if (p) p.style.display = 'block';
      // close dropdown
      const dd = document.getElementById('menuDropdown');
      const mb = document.getElementById('menuBtn');
      if (dd) dd.classList.remove('open');
      if (mb) mb.setAttribute('aria-expanded', 'false');
    });
    menu.appendChild(btn);
  }

  // initial hookup after DOM ready
  function boot() {
    ensureMenuItem();
    // push defaults so everything is in sync on load
    pushWindToIframe();
    broadcastToEnvironment();
    applyRez(); // schedule repeats if Rez > 1
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
