// windsong-controller.js
(function () {
  const KEY = 'windsong.settings.v1';

  // ----- defaults (match your baseline: wind=5 => factor=1.0) -----
  const defaults = { wind: 5, breath: 16, elegra: 15, rez: 1 };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      return {
        wind:   Number(parsed.wind)   || defaults.wind,
        breath: Number(parsed.breath) || defaults.breath,
        elegra: Number(parsed.elegra) || defaults.elegra,
        rez:    Number(parsed.rez)    || defaults.rez
      };
    } catch { return { ...defaults }; }
  }

  function saveSettings(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  function dispatchUpdate(s) {
    // to top doc (environment.js)
    window.dispatchEvent(new CustomEvent('windsong:update', { detail: s }));
    // to iframe (environment.html) for wind/leaves speed (wind factor only)
    const iframe = document.getElementById('environment-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: 'WIND_UPDATE', wind: s.wind },
        '*'
      );
    }
  }

  // ----- build menu item + panel (styling matches your tokens) -----
  function ensurePanel() {
    if (document.getElementById('windsong-panel')) return document.getElementById('windsong-panel');

    const panel = document.createElement('div');
    panel.id = 'windsong-panel';
    Object.assign(panel.style, {
      position: 'fixed',
      right: '12px',
      top: '60px',
      zIndex: '10001',
      display: 'none',
      pointerEvents: 'auto'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: 'linear-gradient(180deg, #101522, #0f1522)',
      border: '1px solid #21283a',
      boxShadow: '0 10px 24px rgba(0,0,0,.35)',
      borderRadius: '10px',
      padding: '10px',
      minWidth: '260px',
      color: '#e8ecf4',
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans"',
      letterSpacing: '.2px'
    });

    const title = document.createElement('div');
    title.textContent = 'Wind’s Song';
    Object.assign(title.style, {
      fontWeight: '800',
      color: '#aeb7c8',
      fontSize: '14px',
      marginBottom: '6px',
      textAlign: 'center'
    });

    const row = (label, control) => {
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        gap: '8px',
        background: '#0b1120',
        border: '1px solid #242c3e',
        borderRadius: '8px',
        padding: '8px 10px',
        marginBottom: '8px',
        color: '#aeb7c8',
        fontSize: '13px'
      });
      const lab = document.createElement('div');
      lab.textContent = label;
      wrap.appendChild(lab);
      wrap.appendChild(control);
      return wrap;
    };

    // Controls (loaded with persisted values)
    const settings = loadSettings();

    // Wind 1..10 (5 is baseline)
    const windInput = document.createElement('input');
    windInput.type = 'range';
    windInput.min = '1'; windInput.max = '10'; windInput.step = '1';
    windInput.value = String(settings.wind);
    windInput.style.width = '140px';
    const windWrap = row('Wind (1–10)', windInput);

    // Breath (seconds between drifting lines)
    const breathInput = document.createElement('input');
    breathInput.type = 'number';
    breathInput.min = '1'; breathInput.max = '120'; breathInput.step = '1';
    breathInput.value = String(settings.breath);
    Object.assign(breathInput.style, { width: '64px', textAlign: 'right', color: '#e8ecf4', background: '#0b1120', border: '1px solid #242c3e', borderRadius: '6px', padding: '4px 6px' });
    const breathWrap = row('Breath (s)', breathInput);

    // Elegra (seconds per pair phase in bottom reveal)
    const elegraInput = document.createElement('input');
    elegraInput.type = 'number';
    elegraInput.min = '2'; elegraInput.max = '60'; elegraInput.step = '1';
    elegraInput.value = String(settings.elegra);
    Object.assign(elegraInput.style, { width: '64px', textAlign: 'right', color: '#e8ecf4', background: '#0b1120', border: '1px solid #242c3e', borderRadius: '6px', padding: '4px 6px' });
    const elegraWrap = row('Elegra (s)', elegraInput);

    // Rez (1..6) – present; scheduler can be wired later if you say so
    const rezSelect = document.createElement('select');
    [1,2,3,4,5,6].forEach(v=>{
      const opt = document.createElement('option');
      opt.value = String(v); opt.textContent = String(v);
      if (v === settings.rez) opt.selected = true;
      rezSelect.appendChild(opt);
    });
    Object.assign(rezSelect.style, { width: '68px', textAlign: 'center', color: '#e8ecf4', background: '#0b1120', border: '1px solid #242c3e', borderRadius: '6px', padding: '4px 6px' });
    const rezWrap = row('Rez (1–6)', rezSelect);

    // Buttons
    const btns = document.createElement('div');
    Object.assign(btns.style, { display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '6px' });

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    styleBtn(applyBtn);

    const triggerBtn = document.createElement('button');
    triggerBtn.textContent = 'Trigger now';
    styleBtn(triggerBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    styleBtn(closeBtn);

    btns.appendChild(applyBtn);
    btns.appendChild(triggerBtn);
    btns.appendChild(closeBtn);

    card.appendChild(title);
    card.appendChild(windWrap);
    card.appendChild(breathWrap);
    card.appendChild(elegraWrap);
    card.appendChild(rezWrap);
    card.appendChild(btns);
    panel.appendChild(card);
    document.body.appendChild(panel);

    // events
    function applyAndClose() {
      const s = {
        wind:   clamp(Number(windInput.value)   || defaults.wind, 1, 10),
        breath: clamp(Number(breathInput.value) || defaults.breath, 1, 120),
        elegra: clamp(Number(elegraInput.value) || defaults.elegra, 2, 60),
        rez:    clamp(Number(rezSelect.value)   || defaults.rez, 1, 6)
      };
      saveSettings(s);
      dispatchUpdate(s);
      // Auto-close after applying
      panel.style.display = 'none';
    }

    applyBtn.addEventListener('click', applyAndClose);
    triggerBtn.addEventListener('click', () => {
      // ensure current fields are also saved & dispatched before triggering
      applyAndClose();
      window.dispatchEvent(new Event('windsong:trigger'));
    });
    closeBtn.addEventListener('click', () => { panel.style.display = 'none'; });

    return panel;
  }

  function styleBtn(btn) {
    Object.assign(btn.style, {
      background: 'linear-gradient(180deg, #1c2741, #121b2f)',
      border: '1px solid #2b3854',
      boxShadow: '0 6px 16px rgba(0,0,0,.28), inset 0 0 0 1px rgba(255,255,255,0.03)',
      color: '#e8ecf4',
      borderRadius: '10px',
      padding: '8px 12px',
      cursor: 'pointer',
      fontWeight: '700',
      fontSize: '13px'
    });
    btn.onmouseenter = () => { btn.style.background = 'linear-gradient(180deg, #243253, #15203a)'; btn.style.borderColor = '#3a4a6a'; };
    btn.onmouseleave = () => { btn.style.background = 'linear-gradient(180deg, #1c2741, #121b2f)'; btn.style.borderColor = '#2b3854'; };
  }

  function ensureMenuItem() {
    const dd = document.getElementById('menuDropdown');
    if (!dd) return;
    if (document.getElementById('windsong-menu-item')) return;

    const mi = document.createElement('button');
    mi.id = 'windsong-menu-item';
    mi.className = 'menu-item';
    mi.type = 'button';
    mi.textContent = 'Wind’s Song';
    mi.addEventListener('click', () => {
      const panel = ensurePanel();
      panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
    });
    dd.appendChild(mi);
  }

  // On first load: restore settings & dispatch once so environment starts with them.
  function bootstrap() {
    ensureMenuItem();
    const s = loadSettings();
    // Immediately tell both top doc and iframe about the saved values
    dispatchUpdate(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
