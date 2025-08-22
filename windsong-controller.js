// windsong-controller.js
(function () {
  const SS_KEY = 'windsong.settings.v1'; // session only (resets on reload)
  const DEF = {
    wind: 5,     // 1..10 (5 = baseline)
    breath: 16,  // seconds between drifting lines
    elegra: 15,  // seconds per reveal pair
    rez: 1       // 1 = once per refresh; 2..6 => x/60 minutes
  };

  const qs  = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const loadSS = () => {
    try { return Object.assign({}, DEF, JSON.parse(sessionStorage.getItem(SS_KEY) || '{}')); }
    catch { return { ...DEF }; }
  };
  const saveSS = (st) => sessionStorage.setItem(SS_KEY, JSON.stringify(st));

  let state = loadSS();

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
      if (btn) btn.setAttribute('aria-expanded','false');
    }
  }

  let panel, overlay;

  function buildPanel() {
    if (panel) return;

    overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,.6)',
      backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)',
      zIndex:'10002', display:'none'
    });
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closePanel(); });
    document.body.appendChild(overlay);

    panel = document.createElement('div');
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');
    panel.setAttribute('aria-labelledby','windsongTitle');
    Object.assign(panel.style, {
      background:'var(--panel,#121826)',
      border:'1px solid var(--stroke,#263047)',
      borderRadius:'14px',
      boxShadow:'0 12px 32px rgba(0,0,0,.4)',
      width:'min(92vw, 640px)',
      margin:'10vh auto 0',
      padding:'16px 18px',
      color:'var(--text,#e8ecf4)',
      fontFamily:'inherit'
    });
    overlay.appendChild(panel);

    const head = document.createElement('div');
    Object.assign(head.style, {
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', marginBottom:'8px'
    });
    const title = document.createElement('h3');
    title.id = 'windsongTitle';
    title.textContent = 'Wind’s Song Controls';
    Object.assign(title.style, {
      margin:'0', fontSize:'1rem', color:'var(--muted,#aeb7c8)', fontWeight:'800', letterSpacing:'.3px'
    });
    const xBtn = document.createElement('button');
    xBtn.setAttribute('aria-label','Close');
    xBtn.textContent = '×';
    Object.assign(xBtn.style, {
      background:'var(--btn,#1b2333)', border:'1px solid #2b3449',
      color:'var(--text,#e8ecf4)', borderRadius:'10px',
      width:'36px', height:'32px', cursor:'pointer', fontWeight:'700'
    });
    xBtn.addEventListener('click', closePanel);
    head.appendChild(title);
    head.appendChild(xBtn);
    panel.appendChild(head);

    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'
    });

    const makeField = (labelTxt, inputEl, hint) => {
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        background:'linear-gradient(180deg, var(--panel,#121826), var(--panel-2,#141b2a))',
        border:'1px solid #21283a', borderRadius:'10px', padding:'10px 12px'
      });
      const lab = document.createElement('div');
      lab.textContent = labelTxt;
      Object.assign(lab.style, { fontWeight:'700', marginBottom:'6px', color:'var(--muted,#aeb7c8)' });
      const hintEl = document.createElement('div');
      hintEl.textContent = hint || '';
      Object.assign(hintEl.style, { fontSize:'12px', color:'var(--muted,#aeb7c8)', opacity:.85, marginTop:'6px' });
      inputEl.style.width = '100%';
      inputEl.style.marginTop = '6px';
      wrap.appendChild(lab);
      wrap.appendChild(inputEl);
      if (hint) wrap.appendChild(hintEl);
      return wrap;
    };

    // Inputs
    const windInput = document.createElement('input');
    windInput.type='range'; windInput.min='1'; windInput.max='10'; windInput.step='1';
    const breathInput = document.createElement('input');
    breathInput.type='range'; breathInput.min='6'; breathInput.max='30'; breathInput.step='1';
    const elegraInput = document.createElement('input');
    elegraInput.type='range'; elegraInput.min='8'; elegraInput.max='30'; elegraInput.step='1';
    const rezSelect = document.createElement('select');
    ['1','2','3','4','5','6'].forEach(v => {
      const opt = document.createElement('option'); opt.value=v; opt.textContent=v; rezSelect.appendChild(opt);
    });

    const windVal = document.createElement('div');
    const breathVal = document.createElement('div');
    const elegraVal = document.createElement('div');
    [windVal, breathVal, elegraVal].forEach(el => Object.assign(el.style, {
      marginTop:'4px', fontSize:'12px', color:'var(--muted,#aeb7c8)'
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

    windInput.addEventListener('input', ()=>{ windVal.textContent = `Speed: ${windInput.value} (5 = baseline)`; });
    breathInput.addEventListener('input', ()=>{ breathVal.textContent = `Between lines: ${breathInput.value}s`; });
    elegraInput.addEventListener('input', ()=>{ elegraVal.textContent = `Reveal pacing: ${elegraInput.value}s`; });

    grid.appendChild(makeField('Wind', windInput, 'Controls leaves, drifting lines, and butterfly speed (1–10; 5 = baseline).'));
    grid.appendChild(windVal);
    grid.appendChild(makeField('Breath', breathInput, 'Seconds between drifting poem lines (uniform).'));
    grid.appendChild(breathVal);
    grid.appendChild(makeField('Elegra', elegraInput, 'Seconds per reveal pair (bottom display pacing).'));
    grid.appendChild(elegraVal);
    grid.appendChild(makeField('Rez', rezSelect, 'x/60 minutes per hour; 1 = once per refresh.'));
    const spacer = document.createElement('div'); spacer.style.minHeight='1px'; grid.appendChild(spacer);
    panel.appendChild(grid);

    const foot = document.createElement('div');
    Object.assign(foot.style, { display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'12px' });

    const applyBtn = document.createElement('button');
    styleBtn(applyBtn); applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => {
      state = {
        wind:   clamp(parseInt(windInput.value,10)||DEF.wind, 1,10),
        breath: clamp(parseInt(breathInput.value,10)||DEF.breath, 6,60),
        elegra: clamp(parseInt(elegraInput.value,10)||DEF.elegra, 6,60),
        rez:    clamp(parseInt(rezSelect.value,10)||DEF.rez, 1,6)
      };
      saveSS(state);
      dispatchSettings(state);
      scheduleRez(state);
      closePanel();
    });

    const resetBtn = document.createElement('button');
    styleBtn(resetBtn, true); resetBtn.textContent = 'Reset (baseline)';
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

    syncInputsFromState();

    function styleBtn(b, ghost=false){
      Object.assign(b.style, {
        background: ghost ? 'var(--btn,#1b2333)' : 'linear-gradient(180deg,var(--pbtn-bg1,#1c2741),var(--pbtn-bg2,#121b2f))',
        border:'1px solid var(--pbtn-border,#2b3854)',
        color:'var(--text,#e8ecf4)',
        borderRadius:'12px', padding:'10px 14px', fontWeight:'700', cursor:'pointer',
        boxShadow:'var(--pbtn-shadow,0 10px 24px rgba(0,0,0,.35))'
      });
    }
  }

  function openPanel() {
    buildPanel();
    // reload session values into panel each time it's opened
    state = loadSS();
    const ranges = qsa('input[type="range"]', panel);
    const select = qs('select', panel);
    const [windInput, breathInput, elegraInput] = ranges;
    windInput.value = String(state.wind);
    breathInput.value = String(state.breath);
    elegraInput.value = String(state.elegra);
    select.value = String(state.rez);
    panel.querySelectorAll('div').forEach(d => {
      if (d.textContent && d.textContent.startsWith('Speed:')) d.textContent = `Speed: ${state.wind} (5 = baseline)`;
      if (d.textContent && d.textContent.startsWith('Between lines:')) d.textContent = `Between lines: ${state.breath}s`;
      if (d.textContent && d.textContent.startsWith('Reveal pacing:')) d.textContent = `Reveal pacing: ${state.elegra}s`;
    });
    overlay.style.display = 'flex';
  }
  function closePanel(){ if (overlay) overlay.style.display='none'; }

  function dispatchSettings(st){
    // -> environment.js (poem drift + butterfly + reveal)
    window.dispatchEvent(new CustomEvent('windsong:update', {
      detail: { wind: st.wind, breath: st.breath, elegra: st.elegra, rez: st.rez }
    }));
    // -> environment.html (wind & leaves)
    const ifr = qs('#environment-iframe');
    if (ifr && ifr.contentWindow) {
      ifr.contentWindow.postMessage({ type:'WIND_UPDATE', wind: st.wind }, '*');
    }
  }

  let rezTimer = null;
  function scheduleRez(st){
    if (rezTimer) { clearInterval(rezTimer); rezTimer=null; }
    // always run once immediately
    window.dispatchEvent(new Event('windsong:trigger'));

    const n = clamp(st.rez|0, 1, 6);
    if (n > 1) {
      const ms = (60 / n) * 60 * 1000;
      rezTimer = setInterval(() => window.dispatchEvent(new Event('windsong:trigger')), ms);
    }
  }

  function bootstrap(){
    ensureMenuItem();
    dispatchSettings(state);
    scheduleRez(state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once:true });
  } else {
    bootstrap();
  }
})();
