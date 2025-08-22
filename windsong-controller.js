<!-- windsong-controller.js -->
<script>
(function(){
  const STORAGE_KEY = 'windsong.settings.v1';
  const defaults = { wind: 5, breath: 16, elegra: 15, rez: 1 };

  // ---------- storage / state ----------
  function loadSettings(){
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')); }
    catch { return { ...defaults }; }
  }
  function saveSettings(s){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  }

  // Shared state for environment.js
  window.__WINDS_SONG__ = window.__WINDS_SONG__ || { ...defaults };
  Object.assign(window.__WINDS_SONG__, loadSettings());

  function broadcastUpdate(s){
    Object.assign(window.__WINDS_SONG__, s);
    window.dispatchEvent(new CustomEvent('windsong:update', { detail: s }));
    // Tell the environment iframe (leaves) about wind speed
    try{
      const envIframe = document.getElementById('environment-iframe');
      if (envIframe && envIframe.contentWindow && s.wind != null){
        envIframe.contentWindow.postMessage({ type:'WIND_UPDATE', wind:Number(s.wind) }, '*');
      }
    }catch{}
    saveSettings(Object.assign(loadSettings(), s));
  }

  // ---------- compact panel ----------
  let panel, openBtn;
  function ensurePanel(){
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'windsong-panel';
    Object.assign(panel.style, {
      position:'fixed', right:'12px', bottom:'12px', zIndex:'9999',
      width:'min(92vw, 340px)', background:'rgba(12,16,24,.9)',
      border:'1px solid rgba(255,255,255,.08)', borderRadius:'12px',
      boxShadow:'0 10px 30px rgba(0,0,0,.35)', color:'#fff',
      fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
      padding:'12px 12px 10px', display:'none', backdropFilter:'blur(6px)'
    });
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div style="font-weight:700;letter-spacing:.2px;">Wind’s Song</div>
        <button id="ws-close" aria-label="Close"
          style="all:unset;cursor:pointer;font-size:18px;line-height:1;padding:4px 6px;border-radius:8px;">✕</button>
      </div>

      <div style="display:grid;grid-template-columns:80px 1fr;gap:8px 10px;align-items:center;">
        <label><span style="display:inline-flex;gap:6px;align-items:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 8h10a3 3 0 1 0-3-3" stroke="#9ec7ff" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M3 14h14a3 3 0 1 1-3 3" stroke="#9ec7ff" stroke-width="1.5" stroke-linecap="round"/>
          </svg> Wind</span></label>
        <input id="ws-wind" type="range" min="1" max="10" step="1" />

        <label><span style="display:inline-flex;gap:6px;align-items:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="6" cy="12" r="2.2" stroke="#ffd89e" stroke-width="1.5"/>
            <circle cx="18" cy="12" r="2.2" stroke="#ffd89e" stroke-width="1.5"/>
            <path d="M8.5 12h7" stroke="#ffd89e" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M13 9l3 3-3 3" stroke="#ffd89e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg> Breath</span></label>
        <input id="ws-breath" type="range" min="6" max="30" step="1" />

        <label><span style="display:inline-flex;gap:6px;align-items:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 17c3-8 6-8 9 0 3-10 6-10 9 0" stroke="#b0ffda" stroke-width="1.5" stroke-linecap="round"/>
          </svg> Elegra</span></label>
        <input id="ws-elegra" type="range" min="6" max="30" step="1" />

        <label><span style="display:inline-flex;gap:6px;align-items:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" stroke="#d1d1ff" stroke-width="1.5"/>
            <path d="M12 8v4l3 2" stroke="#d1d1ff" stroke-width="1.5" stroke-linecap="round"/>
          </svg> Rez</span></label>
        <input id="ws-rez" type="range" min="1" max="6" step="1" />
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">
        <button id="ws-apply" style="all:unset;background:#1a2436;border:1px solid rgba(255,255,255,.12);
                padding:8px 12px;border-radius:10px;cursor:pointer;">Apply</button>
      </div>
    `;
    document.body.appendChild(panel);

    const s = loadSettings();
    panel.querySelector('#ws-wind').value   = String(s.wind);
    panel.querySelector('#ws-breath').value = String(s.breath);
    panel.querySelector('#ws-elegra').value = String(s.elegra);
    panel.querySelector('#ws-rez').value    = String(s.rez);

    panel.querySelector('#ws-apply').addEventListener('click', () => {
      broadcastUpdate({
        wind:   Number(panel.querySelector('#ws-wind').value),
        breath: Number(panel.querySelector('#ws-breath').value),
        elegra: Number(panel.querySelector('#ws-elegra').value),
        rez:    Number(panel.querySelector('#ws-rez').value)
      });
      closePanel();
    });
    panel.querySelector('#ws-close').addEventListener('click', closePanel);
    return panel;
  }
  function openPanel(){ ensurePanel(); panel.style.display='block'; }
  function closePanel(){ if (panel) panel.style.display='none'; }

  // Fallback opener button
  function ensureOpenButton(){
    if (openBtn) return openBtn;
    openBtn = document.createElement('button');
    openBtn.id='windsong-open';
    openBtn.title='Wind’s Song';
    openBtn.textContent='♪';
    Object.assign(openBtn.style,{
      position:'fixed', right:'12px', bottom:'12px', zIndex:'9998',
      width:'36px', height:'36px', borderRadius:'10px',
      background:'rgba(12,16,24,.85)', color:'#9ec7ff',
      border:'1px solid rgba(255,255,255,.12)', cursor:'pointer',
      boxShadow:'0 8px 20px rgba(0,0,0,.35)', fontSize:'18px', lineHeight:'36px',
      textAlign:'center'
    });
    openBtn.addEventListener('click', openPanel);
    document.body.appendChild(openBtn);
    return openBtn;
  }

  // ---------- robust desktop attach ----------
  function findMenuIn(doc){
    if (!doc) return null;
    // 1) Common containers
    const cand = doc.querySelector(
      '[data-menu], nav .menu-list, nav ul, .menu, .site-menu, .main-menu, header nav ul'
    );
    if (cand) return cand;

    // 2) Find the existing “About” item, then use its parent as menu
    const about = Array.from(doc.querySelectorAll('*'))
      .find(el => el.textContent && el.textContent.trim().toLowerCase() === 'about');
    if (about && about.parentElement) return about.parentElement;

    return null;
  }

  function insertMenuItem(doc){
    const menu = findMenuIn(doc);
    if (!menu) return false;
    if (doc.getElementById('windsong-menu-item')) return true;

    const item = doc.createElement('li');
    item.id = 'windsong-menu-item';
    item.style.listStyle = 'none';
    item.style.cursor = 'pointer';
    item.style.userSelect = 'none';
    item.style.padding = '6px 0';
    item.textContent = 'Wind’s Song';
    item.addEventListener('click', (e)=>{ e.preventDefault(); openPanel(); });

    const tag = menu.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      menu.appendChild(item);
    } else {
      // Non-list menus (e.g., div). Insert a simple block.
      const block = doc.createElement('div');
      block.id = 'windsong-menu-item';
      block.style.cursor='pointer';
      block.style.userSelect='none';
      block.style.padding='6px 0';
      block.textContent='Wind’s Song';
      block.addEventListener('click', (e)=>{ e.preventDefault(); openPanel(); });
      menu.appendChild(block);
    }
    return true;
  }

  function attachWithRetries(){
    // Try immediately, then a few retries (for late-rendered menus)
    let attached = insertMenuItem(document);
    if (attached) return true;

    let tries = 0;
    const t = setInterval(()=>{
      tries++;
      attached = insertMenuItem(document);
      if (attached || tries > 10) {
        clearInterval(t);
        if (!attached) ensureOpenButton(); // fallback
      }
    }, 200);

    // MutationObserver as an extra safety net
    const mo = new MutationObserver(() => {
      if (insertMenuItem(document)) {
        mo.disconnect();
      }
    });
    mo.observe(document.body, { childList:true, subtree:true });

    return attached;
  }

  // ---------- boot ----------
  function boot(){
    attachWithRetries();

    // Keep panel knobs in sync if something else updates them
    window.addEventListener('windsong:update', () => {
      if (!panel) return;
      const s = window.__WINDS_SONG__ || defaults;
      panel.querySelector('#ws-wind').value   = String(s.wind);
      panel.querySelector('#ws-breath').value = String(s.breath);
      panel.querySelector('#ws-elegra').value = String(s.elegra);
      panel.querySelector('#ws-rez').value    = String(s.rez);
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
</script>
