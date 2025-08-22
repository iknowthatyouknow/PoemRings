// environment-loader.js
(function () {
  function injectEnvironment() {
    if (!document.body || document.getElementById('environment-iframe')) return;

    // --- 1) Inject the background iframe (wind + leaves canvas) ---
    const iframe = document.createElement('iframe');
    iframe.id = 'environment-iframe';
    iframe.src = 'environment.html'; // must exist in the same folder
    iframe.title = 'Decorative background';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;

    Object.assign(iframe.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      border: '0',
      background: 'transparent',
      pointerEvents: 'none',
      zIndex: '0' // sits behind main content
    });

    // Put it under everything
    document.body.prepend(iframe);

    // Ensure your main wrapper paints above (no layout change)
    const wrap = document.querySelector('.wrap');
    if (wrap) {
      if (!wrap.style.position) wrap.style.position = 'relative';
      if (!wrap.style.zIndex) wrap.style.zIndex = '1';
    }

    // --- 2) Inject environment.js into the TOP document (poem + butterfly) ---
    if (!document.querySelector('script[data-env-js="1"]')) {
      const s = document.createElement('script');
      s.src = 'environment.js';          // same folder
      s.defer = true;                    // do not block
      s.async = false;                   // preserve order relative to this loader
      s.dataset.envJs = '1';
      s.onload = () => console.log('[environment-loader] environment.js loaded');
      s.onerror = () => console.warn('[environment-loader] FAILED to load environment.js');
      document.head.appendChild(s);
    }

    // --- 3) Inject windsong-controller.js AFTER environment.js ---
    if (!document.querySelector('script[data-windsong-ctl="1"]')) {
      const c = document.createElement('script');
      c.src = 'windsong-controller.js';
      c.defer = true;
      c.async = false;
      c.dataset.windsongCtl = '1';
      c.onload = () => console.log('[environment-loader] windsong-controller.js loaded');
      c.onerror = () => console.warn('[environment-loader] FAILED to load windsong-controller.js');
      document.head.appendChild(c);
}

    console.log('[environment-loader] environment iframe injected');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectEnvironment, { once: true });
  } else {
    injectEnvironment();
  }
})();
