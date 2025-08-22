// windsong-controller.js
// Adds a runtime control panel for Wind / Breath / Elegra / Rez
// No edits to index.html. Integrates with existing menu if present.

(function () {
  // ---------- Defaults (match your environment.js live defaults) ----------
  const DEFAULTS = {
    windSlider: 5,   // 1..10 (baseline 5 => multiplier 1.0)
    breathSec: 16,   // seconds between lines
    elegraSec: 15,   // seconds per two-line reveal phase
    rezCount: 1      // 1 => once per refresh; 2..6 => every (60/rez) minutes
  };

  // ---------- State (ephemeral; reset on page reload) ----------
  let state = { ...DEFAULTS };
  let rezTimer = null;    // interval handle for Rez>1
  let nextTickAt = null;  // timestamp for next scheduled trigger

  // ---------- Utilities ----------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmtMin = (ms) => Math.max(0, Math.round(ms/60000));
  const byId = (id) => document.getElementById(id);

  function windFromSlider(s) {
    // Map 1..10 to multiplier with 5 => 1.0 (baseline)
    return clamp(Number(s)/5, 0.2, 10);
  }
  function sliderFromWind(mult) {
    // Inverse map for prefill: multiplier -> slider value
    return clamp(Math.round(Number(mult)*5), 1, 10);
  }

  function dispatchUpdate() {
    window.dispatchEvent(new CustomEvent("windsong:update", {
      detail: {
        wind:   windFromSlider(state.windSlider),
        breath: Number(state.breathSec),
        elegra: Number(state.elegraSec),
        rez:    Number(state.rezCount)
      }
    }));
  }

  function triggerNow() {
    window.dispatchEvent(new Event("windsong:trigger"));
  }

  // ---------- Rez scheduler ----------
  function clearRezTimer() {
    if (rezTimer) { clearInterval(rezTimer); rezTimer = null; }
    nextTickAt = null;
    updateStatus();
  }

  function scheduleRezIfNeeded() {
    clearRezTimer();
    const rez = Number(state.rezCount);
    if (rez <= 1) return; // once per refresh only

    const minutes = 60 / rez; // e.g., 2 -> every 30 min
    const periodMs = Math.max(60_000, Math.round(minutes * 60_000));

    // First tick at exactly one period from now.
    nextTickAt = Date.now() + periodMs;
    rezTimer = setInterval(() => {
      // If a run is currently executing, environment.js will ignore overlapping triggers.
      triggerNow();
      nextTickAt = Date.now() + periodMs;
      updateStatus();
    }, periodMs);

    updateStatus();
  }

  // ---------- Panel UI ----------
  function buildPanel() {
    if (byId('windsongPanel')) return byId('windsongPanel');

    // Styles (scoped)
    const css = `
      #windsongOverlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.5);
        z-index: 10002; display: none; align-items: center; justify-content: center;
      }
      #windsongPanel {
        background: #121826; border: 1px solid #26313d; border-radius: 14px;
        width: min(96vw, 640px); box-shadow: 0 12px 32px rgba(0,0,0,.4);
        padding: 14px 16px; color: #e8ecf4; font-family: inherit;
      }
      .ws-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom: 10px; }
      .ws-title { margin:0; font-size: 1rem; color:#aeb7c8; font-weight:800; letter-spacing:.3px; }
      .ws-close { background:#0b1120; border:1px solid #242c3e; color:#cdd6e7; border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:700; }
      .ws-close:hover{ background:#121a30; }

      .ws-row { display:grid; grid-template-columns: 160px 1fr auto; gap:10px; align-items:center; margin:10px 0; }
      .ws-label { color:#cdd6e7; font-weight:700; letter-spacing:.2px; }
      .ws-input { display:flex; gap:8px; align-items:center; }
      .ws-input input[type="number"] {
        width: 90px; background:#0b1120; color:#e8ecf4; border:1px solid #242c3e; border-radius:8px; padding:6px 8px;
      }
      .ws-input input[type="range"] { width: 260px; }
      .ws-note { color:#aeb7c8; font-size:.9rem; opacity:.9; }

      .ws-actions { display:flex; gap:10px; justify-content:flex-end; margin-top: 12px; }
      .ws-btn {
        background: #1b2333; color: #e8ecf4; border: 1px solid #2b3449;
        padding: 8px 12px; border-radius: 10px; cursor: pointer; font-weight: 800; letter-spacing:.2px;
      }
      .ws-btn:hover { background:#202a3f; border-color:#35415a; }

      .ws-status { margin-top: 8px; color:#aeb7c8; font-size:.9rem; }
    `;
    const tag = document.createElement('style');
    tag.textContent = css;
    document.head.appendChild(tag);

    // Overlay + panel
    const overlay = document.createElement('div');
    overlay.id = 'windsongOverlay';
    overlay.innerHTML = `
      <div id="windsongPanel" role="dialog" aria-labelledby="wsTitle" aria-modal="true">
        <div class="ws-head">
          <h3 id="wsTitle" class="ws-title">Wind’s Song</h3>
          <button class="ws-close" id="wsClose">Close</button>
        </div>

        <div class="ws-row">
          <div class="ws-label">Wind</div>
          <div class="ws-input">
            <input id="wsWind" type="range" min="1" max="10" step="1" />
            <span id="wsWindVal" class="ws-note"></span>
          </div>
          <div class="ws-note">1–10 (baseline 5 = normal speed)</div>
        </div>

        <div class="ws-row">
          <div class="ws-label">Breath</div>
          <div class="ws-input">
            <input id="wsBreath" type="number" min="1" step="1" />
            <span class="ws-note">sec between lines</span>
          </div>
          <div class="ws-note">Uniform gap</div>
        </div>

        <div class="ws-row">
          <div class="ws-label">Elegra</div>
          <div class="ws-input">
            <input id="wsElegra" type="number" min="1" step="1" />
            <span class="ws-note">sec per two-line phase</span>
          </div>
          <div class="ws-note">Bottom reveal pacing</div>
        </div>

        <div class="ws-row">
          <div class="ws-label">Rez</div>
          <div class="ws-input">
            <select id="wsRez">
              <option value="1">1 (once per refresh)</option>
              <option value="2">2 (every 30 min)</option>
              <option value="3">3 (every 20 min)</option>
              <option value="4">4 (every 15 min)</option>
              <option value="5">5 (every 12 min)</option>
              <option value="6">6 (every 10 min)</option>
            </select>
          </div>
          <div class="ws-note">Runs per hour (repeating)</div>
        </div>

        <div class="ws-actions">
          <button class="ws-btn" id="wsApply">Apply</button>
          <button class="ws-btn" id="wsStart">Start Now</button>
          <button class="ws-btn" id="wsReset">Reset</button>
        </div>

        <div class="ws-status" id="wsStatus"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Wiring
    const wind = byId('wsWind');
    const windVal = byId('wsWindVal');
    const breath = byId('wsBreath');
    const elegra = byId('wsElegra');
    const rez = byId('wsRez');

    const updWindLabel = () => {
      const mult = windFromSlider(wind.value).toFixed(2);
      windVal.textContent = `×${mult}`;
    };

    function prefillFromEnv() {
      // If environment.js has already been loaded, prefill from live values
      const live = window.__WINDS_SONG__ || {};
      const currentWind = (typeof live.wind === 'number') ? live.wind : windFromSlider(DEFAULTS.windSlider);
      state.windSlider = sliderFromWind(currentWind);
      state.breathSec  = (typeof live.breath === 'number') ? live.breath : DEFAULTS.breathSec;
      state.elegraSec  = (typeof live.elegra === 'number') ? live.elegra : DEFAULTS.elegraSec;
      state.rezCount   = (typeof live.rez === 'number') ? live.rez : DEFAULTS.rezCount;

      wind.value   = String(state.windSlider);
      breath.value = String(state.breathSec);
      elegra.value = String(state.elegraSec);
      rez.value    = String(state.rezCount);
      updWindLabel();
      updateStatus();
    }

    // Events
    wind.addEventListener('input', () => { state.windSlider = Number(wind.value); updWindLabel(); });
    breath.addEventListener('input', () => { state.breathSec = Number(breath.value); });
    elegra.addEventListener('input', () => { state.elegraSec = Number(elegra.value); });
    rez.addEventListener('change', () => { state.rezCount = Number(rez.value); });

    byId('wsApply').addEventListener('click', () => {
      dispatchUpdate();
      scheduleRezIfNeeded();
      updateStatus();
    });
    byId('wsStart').addEventListener('click', () => {
      dispatchUpdate(); // apply latest knobs before trigger
      triggerNow();
    });
    byId('wsReset').addEventListener('click', () => {
      state = { ...DEFAULTS };
      wind.value = String(state.windSlider);
      breath.value = String(state.breathSec);
      elegra.value = String(state.elegraSec);
      rez.value = String(state.rezCount);
      updWindLabel();
      clearRezTimer();
      dispatchUpdate();
    });

    byId('wsClose').addEventListener('click', () => hidePanel());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hidePanel(); });

    // Public helpers
    function showPanel() {
      prefillFromEnv();
      overlay.style.display = 'flex';
      overlay.setAttribute('aria-hidden', 'false');
    }
    function hidePanel() {
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }
    function updateStatus() {
      const el = byId('wsStatus');
      const lines = [];
      lines.push(`Wind ×${windFromSlider(state.windSlider).toFixed(2)}`);
      lines.push(`Breath ${state.breathSec}s`);
      lines.push(`Elegra ${state.elegraSec}s`);
      if (rezTimer && nextTickAt) {
        const mins = fmtMin(nextTickAt - Date.now());
        lines.push(`Rez ${state.rezCount} — next in ~${mins}m`);
      } else {
        lines.push(`Rez ${state.rezCount}`);
      }
      el.textContent = lines.join('  •  ');
    }

    // Expose some locals for outer scope
    overlay._showPanel = showPanel;
    overlay._hidePanel = hidePanel;
    overlay._updateStatus = updateStatus;

    return overlay;
  }

  function openPanel() {
    const overlay = buildPanel();
    overlay._showPanel();
  }

  // ---------- Menu item (inject, no index.html changes) ----------
  function attachMenuItem() {
    const dropdown = document.getElementById('menuDropdown');
    if (dropdown && !document.getElementById('windsongItem')) {
      const item = document.createElement('button');
      item.id = 'windsongItem';
      item.className = 'menu-item';
      item.type = 'button';
      item.textContent = "Wind’s Song";
      item.addEventListener('click', () => {
        // close the existing menu if possible
        const menuBtn = document.getElementById('menuBtn');
        if (menuBtn) menuBtn.setAttribute('aria-expanded','false');
        dropdown.classList.remove('open');
        openPanel();
      });
      dropdown.appendChild(item);
    } else if (!dropdown) {
      // Fallback: tiny floating button if menu not found
      if (!document.getElementById('windsongFab')) {
        const fab = document.createElement('button');
        fab.id = 'windsongFab';
        fab.textContent = '♪';
        Object.assign(fab.style, {
          position:'fixed', right:'12px', bottom:'12px',
          width:'40px', height:'40px', borderRadius:'10px',
          background:'#121826', color:'#e8ecf4',
          border:'1px solid #2a3348', cursor:'pointer', zIndex:'10002'
        });
        fab.addEventListener('click', openPanel);
        document.body.appendChild(fab);
      }
    }
  }

  // ---------- Init ----------
  function init() {
    attachMenuItem();
    // Prefill environment with defaults once (no persistence across reload)
    // We do not auto-trigger; your environment.js will do its first run per its logic.
    dispatchUpdate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
