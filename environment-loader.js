// environment-loader.js

// --- Mobile routing (no index.html changes) -------------------------
(function mobileRouter(){
  const params = new URLSearchParams(location.search);

  const isMobileUA =
    /iphone|ipad|ipod|android|windows phone|blackberry|silk|kindle|opera mini|mobile/i
      .test(navigator.userAgent);
  const isTouchNarrow =
    (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && window.innerWidth < 1024;

  const forceMobile  = params.has('mobile');
  const forceDesktop = params.has('desktop');
  const preferMobile = forceMobile || (!forceDesktop && (isMobileUA || isTouchNarrow));

  const path = location.pathname.toLowerCase();
  const onMobilePage  = path.endsWith('/mobile.html');
  const onIndexOrRoot = path.endsWith('/') || path.endsWith('/index.html');

  // Keep existing params when bouncing (except our overrides)
  const kept = [...params.entries()].filter(([k]) => (k !== 'mobile' && k !== 'desktop'));
  const qs   = kept.length ? ('?' + new URLSearchParams(kept).toString()) : '';

  if (preferMobile && !onMobilePage) {
    location.replace('mobile.html' + qs);
    return;
  }
  if (!preferMobile && onMobilePage) {
    location.replace('index.html' + qs);
    return;
  }
})();

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
      if (!wrap.style.zIndex)   wrap.style.zIndex = '1';
    }

    // --- 2) Inject environment.js into the TOP document (poem + butterfly) ---
    if (!document.querySelector('script[data-env-js="1"]')) {
      const s = document.createElement('script');
      s.src = 'environment.js';          // same folder
      s.defer = true;                    // do not block
      s.async = false;                   // preserve order relative to this loader
      s.dataset.envJs = '1';
      s.onload  = () => console.log('[environment-loader] environment.js loaded');
      s.onerror = () => console.warn('[environment-loader] FAILED to load environment.js');
      document.head.appendChild(s);
    }

    // --- 3) Inject windsong-controller.js AFTER environment.js (controls) ---
    if (!document.querySelector('script[data-windsong-ctl="1"]')) {
      const c = document.createElement('script');
      c.src = 'windsong-controller.js';
      c.defer = true;
      c.async = false;
      c.dataset.windsongCtl = '1';
      c.onload  = () => {
        console.log('[environment-loader] windsong-controller.js loaded');
        // Try to position the activator once controller has created it
        scheduleActivatorReposition();
      };
      c.onerror = () => console.warn('[environment-loader] FAILED to load windsong-controller.js');
      document.head.appendChild(c);
    } else {
      // If controller is already there (hard refresh race), still ensure placement
      scheduleActivatorReposition();
    }

    // --- 4) Inject specialevent.js (butterfly party) ---
    if (!document.querySelector('script[data-specialevent="1"]')) {
      const p = document.createElement('script');
      p.src = 'specialevent.js';
      p.defer = true;
      p.async = false;
      p.dataset.specialevent = '1';
      p.onload  = () => console.log('[environment-loader] specialevent.js loaded');
      p.onerror = () => console.warn('[environment-loader] FAILED to load specialevent.js');
      document.head.appendChild(p);
    }

    console.log('[environment-loader] environment iframe injected');
  }

  // Reposition the Wind Song activator a few pixels under the 3-dot menu (top-right)
  function scheduleActivatorReposition() {
    let attempts = 0;
    const maxAttempts = 120; // ~10s @ 83ms
    const tryPlace = () => {
      attempts++;
      const activator = document.querySelector('.ws-activator');
      if (activator) {
        positionActivatorNearThreeDots(activator);
        // keep it sticky on resize
        window.addEventListener('resize', () => positionActivatorNearThreeDots(activator));
        return; // done
      }
      if (attempts < maxAttempts) {
        setTimeout(tryPlace, 83);
      }
    };
    tryPlace();
  }

  function positionActivatorNearThreeDots(node) {
    // Try likely selectors for the three-dot menu; we don't modify index.html
    const candidates = document.querySelectorAll(
      '.three-dots, .menu-toggle, .menu button, nav .menu button, .about-menu, [data-role="menu"], .menu > button'
    );
    let anchor = null;
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect && rect.width && rect.height) { anchor = el; break; }
    }

    if (anchor) {
      const r = anchor.getBoundingClientRect();
      node.style.top = `${Math.max(8, r.bottom + 8)}px`;
      node.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
      node.style.left = 'auto';
      node.style.bottom = 'auto';
    } else {
      // Fallback near top-right if we can’t detect the menu
      node.style.top = '56px';
      node.style.right = '14px';
      node.style.left = 'auto';
      node.style.bottom = 'auto';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectEnvironment, { once: true });
  } else {
    injectEnvironment();
  }
})();
