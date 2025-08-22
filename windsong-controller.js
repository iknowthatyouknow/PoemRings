// windsong-controller.js
(function () {
  // --- keys & defaults (baseline = current site behavior) ---
  const SS_KEY = 'windsong.settings.v1'; // session only (resets on reload)
  const DEF = {
    wind: 5,     // 1..10 (5 = baseline speed)
    breath: 16,  // seconds between drifting lines
    elegra: 15,  // seconds per reveal pair phase
    rez: 1       // 1 = once per refresh; 2..6 = x/60 min schedule (controller handles)
  };

  // --- helpers ---
  const qs  = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const loadSS = () => {
    try { return Object.assign({}, DEF, JSON.parse(sessionStorage.getItem(SS_KEY) || '{}')); }
    catch { return { ...DEF }; }
  };
  const saveSS = (st) => sessionStorage.setItem(SS_KEY, JSON.stringify(st));

  // --- state (per tab) ---
  let state = loadSS(); // survives while the tab is open; resets on reload

  // --- menu hook: add "Wind’s Song" under the existing menu (below About) ---
  function ensureMenuItem() {
    const menu = qs('#menuDropdown');
    if (!menu || qs('#windsongMenuItem')) return;

    const item = document.createElement('button');
    item.id = 'windsongMenuItem';
    item.className = 'menu-item';
    item.setAttribute('role', 'menuitem');
    item.textContent = 'Wind’s Song';
    item.addEventListener('click', () => {
      closeMenu();
      openPanel();
    });
    menu.appendChild(item);

    function closeMenu() {
      const btn = qs('#menuBtn');
      menu.classList.remove('open');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  }

  // --- panel: styled to match site tokens (uses your CSS variables) ---
  let panel, overlay;

  function buildPanel() {
    if (panel) return;

    // overlay
    overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
      zIndex: '10002', display: 'none'
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
    document.body.appendChild(overlay);

    // card
    panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'windsongTitle');
    Object.assign(panel.style, {
      background: 'var(--panel, #121826)',
      border: '1px solid var(--stroke, #263047)',
      borderRadius: '14px',
      boxShadow: '0 12px 32px rgba(0,0,0,.4)',
      width: 'min(92vw, 640px)',
      margin: '10vh auto 0',
      padding: '16px 18px',
      color: 'var(--text, #e8ecf4)',
      fontFamily: 'inherit'
    });
    overlay.appendChild(panel);

    // header
    const head = document.createElement('div');
    Object.assign(head.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px'
    });
    const title = document.createElement('h3');
    title.id = 'windsongTitle';
    title.textContent = 'Wind’s Song Controls';
    Object.assign(title.style, {
      margin: '0', fontSize: '1rem', color: 'var(--muted, #aeb7c8)', fontWeight: '800', letterSpacing: '.3px'
    });
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    Object.assign(closeBtn.style, {
      background: 'var(--btn, #1b2333)',
      border: '1px solid #2b3449',
      color: 'var(--text, #e8ecf4)',
      borderRadius: '10px', padding: '6px 10px', cursor: 'pointer', fontWeight: '700'
    });
    closeBtn.addEventListener('click', closePanel);
    head.appendChild(title);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    // grid
    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'
    });

    // control factory
    const makeField = (labelTxt, inputEl, hint) => {
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        background: 'linear-gradient(180deg, var(--panel, #121826), var(--panel-2, #141b2a))',
        border: '1px solid #21283a', borderRadius: '10px', padding: '10px 12px'
      });
      const lab = document.createElement('div');
      lab.textContent = labelTxt;
      Object.assign(lab.style, { fontWeight: '700', marginBottom: '6px', color: 'var(--muted, #aeb7c8)' });
      const hintEl = document.createElement('div');
      hintEl.textContent = hint || '';
      Object.assign(hintEl.style, { fontSize: '12px', color: 'var(--muted, #aeb7c8)', opacity: .85, marginTop: '6px' });
      inputEl.style.width = '100%';
      inputEl.style.marginTop = '6px';
      wrap.appendChild(lab);
      wrap.appendChild(inputEl);
      if (hint) wrap.appendChild(hintEl);
      return wrap;
    };

    // WIND (1..10; 5 baseline)
    const windInput = document.createElement('input');
    windInput.type = 'range'; windInput.min = '1'; windInput.max = '10'; windInput.step = '1';
    // BREATH (6..30 seconds recommended; default 16)
    const breathInput = document.createElement('input');
    breathInput.type = 'range'; breathInput.min = '6'; breathInput.max = '30'; breathInput.step = '1';
    // ELEGRA (8..30 seconds recommended; default 15)
    const elegraInput = document.createElement('input');
    elegraInput.type = 'range'; elegraInput.min = '8'; elegraInput.max = '30'; elegraInput.step = '1';
    // REZ (1..6 select)
    const rezSelect = document.createElement('select');
    ['1','2','3','4','5','6'].forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      rezSelect.appendChild(opt);
    });

    // Readouts
    const windVal = document.createElement('div');
    const breathVal = document.createElement('div');
    const elegraVal = document.createElement('div');

    [windVal, breathVal, elegraVal].forEach(el => Object.assign(el.style, {
      marginTop: '4px', fontSize: '12px', color: 'var(--muted, #aeb7c8)'
    }));

    function syncInputsFromState() {
      windInput.value = String(state.wind);
      breathInput.value = String(state.breath);
      elegraInput.value = String(state.elegra);
      rezSelect.value = String(state.rez);
      windVal.textContent   = `Speed: ${state.wind} (5 = baseline)`;
      breathVal.textContent = `Between lines: ${state.breath}s`;
      elegraVal.textContent = `Reveal pacing: ${state.elegra}s`;
    }

    // bind oninput (live readouts only; apply happens on button)
    windInput.addEventListener('input', () => { windVal.textContent = `Speed: ${windInput.value} (5 = baseline)`; });
    breathInput.addEventListener('input', () => { breathVal.textContent = `Between lines: ${breathInput.value}s`; });
    elegraInput.addEventListener('input', () => { elegraVal.textContent = `Reveal pacing: ${elegraInput.value}s`; });

    // fields
    grid.appendChild(makeField('Wind', windInput,
      'Controls leaves, drifting lines, and butterfly speed (1–10; 5 = baseline).'));
    grid.appendChild(windVal);

    grid.appendChild(makeField('Breath', breathInput,
      'Seconds between drifting poem lines (uniform).'));
    grid.appendChild(breathVal);

    grid.appendChild(makeField('Elegra', elegraInput,
      'Seconds per reveal pair (bottom fade-in/out pacing).'));
    grid.appendChild(elegraVal);

    grid.appendChild(makeField('Rez', rezSelect,
      'How often Wind’s Song runs within one hour: x/60 minutes; 1 = once per refresh.'));
    // empty cell to keep grid even
    const spacer = document.createElement('div'); spacer.style.minHeight = '1px';
    grid.appendChild(spacer);

    panel.appendChild(grid);

    // footer buttons
    const foot = document.createElement('div');
    Object.assign(foot.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' });

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    styleBtn(applyBtn);
    applyBtn.addEventListener('click', () => {
      // update state
      state = {
        wind: clamp(parseInt(windInput.value, 10) || DEF.wind, 1, 10),
        breath: clamp(parseInt(breathInput.value, 10) || DEF.breath, 6, 60),
        elegra: clamp(parseInt(elegraInput.value, 10) || DEF.elegra, 6, 60),
        rez: clamp(parseInt(rezSelect.value, 10) || DEF.rez, 1, 6)
      };
      saveSS(state);
      dispatchSettings(state);
      scheduleRez(state);
      closePanel(); // auto-close on apply
    });

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset (baseline)';
    styleBtn(resetBtn, true);
    resetBtn.addEventListener('click', () => {
      state = { ...DEF };
      saveSS(state);
      syncInputsFromState();
      dispatchSettings(state);
      scheduleRez(state);
      closePanel();
    });

    foot.appendChild(resetBtn);
    foot.appendChild(applyBtn);
    panel.appendChild(foot);

    // prime values
    syncInputsFromState();

    function styleBtn(b, ghost=false) {
      Object.assign(b.style, {
        background: ghost ? 'var(--btn, #1b2333)' : 'linear-gradient(180deg, var(--pbtn-bg1, #1c2741), var(--pbtn-bg2, #121b2f))',
        border: '1px solid var(--pbtn-border, #2b3854)',
        color: 'var(--text, #e8ecf4)',
        borderRadius: '12px',
        padding: '10px 14px',
        fontWeight: '700',
        cursor: 'pointer',
        boxShadow: 'var(--pbtn-shadow, 0 10px 24px rgba(0,0,0,.35))'
      });
    }
  }

  function openPanel() {
    buildPanel();
    // refresh inputs from current session state each time you open
    if (panel) {
      // re-sync values so reopening shows last selections
      const current = loadSS();
      state = current;
      // find inputs again and sync
      const ranges = qsa('input[type="range"]', panel);
      const select = qs('select', panel);
      const [windInput, breathInput, elegraInput] = ranges;
      windInput.value = String(state.wind);
      breathInput.value = String(state.breath);
      elegraInput.value = String(state.elegra);
      select.value = String(state.rez);
      // update readouts
      panel.querySelectorAll('div').forEach(d => {
        // update known readouts by text pattern
        if (d.textContent && d.textContent.startsWith('Speed:'))   d.textContent = `Speed: ${state.wind} (5 = baseline)`;
        if (d.textContent && d.textContent.startsWith('Between lines:')) d.textContent = `Between lines: ${state.breath}s`;
        if (d.textContent && d.textContent.startsWith('Reveal pacing:')) d.textContent = `Reveal pacing: ${state.elegra}s`;
      });
    }
    overlay.style.display = 'flex';
  }
  function closePanel() {
    if (overlay) overlay.style.display = 'none';
  }

  // --- dispatch to top document (environment.js) + iframe (environment.html) ---
  function dispatchSettings(st) {
    // 1) environment.js (drift/butterfly/reveal)
    window.dispatchEvent(new CustomEvent('windsong:update', {
      detail: { wind: st.wind, breath: st.breath, elegra: st.elegra, rez: st.rez }
    }));
    // 2) environment.html (wind/leaves) via postMessage to iframe
    const ifr = qs('#environment-iframe');
    if (ifr && ifr.contentWindow) {
      ifr.contentWindow.postMessage({ type: 'WIND_UPDATE', wind: st.wind }, '*');
    }
  }

  // --- Rez scheduling (per-hour cadence inside this tab; resets on reload) ---
  let rezTimer = null;
  function scheduleRez(st) {
    if (rezTimer) { clearInterval(rezTimer); rezTimer = null; }

    // always run once after settings change (if rez === 1, it will only run once)
    window.dispatchEvent(new Event('windsong:trigger'));

    const n = clamp(st.rez|0, 1, 6);
    if (n > 1) {
      const minutes = 60 / n;
      const ms = minutes * 60 * 1000;
      rezTimer = setInterval(() => {
        window.dispatchEvent(new Event('windsong:trigger'));
      }, ms);
    }
  }

  // --- bootstrap on load: add menu item, send current (session) settings, start Rez ---
  function bootstrap() {
    ensureMenuItem();
    // push current state to both listeners immediately
    dispatchSettings(state);
    scheduleRez(state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
