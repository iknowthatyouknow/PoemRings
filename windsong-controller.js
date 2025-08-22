// windsong-controller.js
(function(){
  const READY = () => document.getElementById('menuDropdown');

  function addPanel(menu){
    if (document.getElementById('windsong-panel')) return;

    // menu item
    const item = document.createElement('button');
    item.className = 'menu-item';
    item.textContent = "Wind’s Song";
    item.id = 'windsong-item';
    item.type = 'button';
    menu.appendChild(item);

    // panel
    const panel = document.createElement('div');
    panel.id = 'windsong-panel';
    panel.style.cssText = `
      position:absolute; right:0; margin-top:8px;
      background: linear-gradient(180deg, #101522, #0f1522);
      border:1px solid #21283a; border-radius:10px; padding:10px;
      box-shadow:0 10px 24px rgba(0,0,0,.35); width: 280px; display:none;
    `;
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
        <strong style="color:#cdd6e7; font-weight:800;">Wind’s Song Controls</strong>
        <button id="windsong-close" class="about-close" style="padding:4px 8px">Close</button>
      </div>

      <label style="display:block;color:#cdd6e7;margin:8px 0 4px;">Wind (1–10, 5 = normal)</label>
      <input id="ws-wind" type="range" min="1" max="10" step="1" value="5" style="width:100%">

      <label style="display:block;color:#cdd6e7;margin:10px 0 4px;">Breath (seconds between lines)</label>
      <input id="ws-breath" type="range" min="6" max="30" step="1" value="16" style="width:100%">

      <label style="display:block;color:#cdd6e7;margin:10px 0 4px;">Elegra (seconds per phase at bottom)</label>
      <input id="ws-elegra" type="range" min="8" max="30" step="1" value="15" style="width:100%">

      <label style="display:block;color:#cdd6e7;margin:10px 0 4px;">Rez (times per hour: 1=once on reload)</label>
      <input id="ws-rez" type="range" min="1" max="6" step="1" value="1" style="width:100%">

      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="ws-trigger" class="about-close" style="flex:1;">Trigger now</button>
        <button id="ws-reset" class="about-close" style="flex:1;">Reset to defaults</button>
      </div>
    `;
    menu.appendChild(panel);

    // open/close
    item.addEventListener('click', () => {
      panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
    });
    panel.querySelector('#windsong-close').addEventListener('click', () => panel.style.display='none');

    // controls
    const windEl   = panel.querySelector('#ws-wind');
    const breathEl = panel.querySelector('#ws-breath');
    const elegraEl = panel.querySelector('#ws-elegra');
    const rezEl    = panel.querySelector('#ws-rez');

    function pushUpdate(){
      // Map wind slider 1..10 where 5 = baseline => factor = wind/5
      const windVal   = Number(windEl.value || 5);
      const breathVal = Number(breathEl.value || 16);
      const elegraVal = Number(elegraEl.value || 15);
      const rezVal    = Number(rezEl.value || 1);

      // 1) Notify environment.js (top doc)
      const evt = new CustomEvent('windsong:update', {
        detail: { wind: windVal, breath: breathVal, elegra: elegraVal, rez: rezVal }
      });
      window.dispatchEvent(evt);

      // 2) Notify the iframe (leaves speed)
      const ifr = document.getElementById('environment-iframe');
      if (ifr && ifr.contentWindow) {
        ifr.contentWindow.postMessage({ type:'WIND_UPDATE', wind: windVal }, '*');
      }
    }

    windEl.addEventListener('input', pushUpdate);
    breathEl.addEventListener('input', pushUpdate);
    elegraEl.addEventListener('input', pushUpdate);
    rezEl.addEventListener('input', pushUpdate);

    // buttons
    panel.querySelector('#ws-trigger').addEventListener('click', () => {
      window.dispatchEvent(new Event('windsong:trigger'));
    });

    panel.querySelector('#ws-reset').addEventListener('click', () => {
      windEl.value = 5; breathEl.value = 16; elegraEl.value = 15; rezEl.value = 1;
      pushUpdate();
    });

    // initial push (matches defaults)
    pushUpdate();
  }

  function init(){
    const menu = READY();
    if (menu) addPanel(menu);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
