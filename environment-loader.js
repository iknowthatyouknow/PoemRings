// environment-loader.js
(function () {
  function injectEnvironment() {
    if (!document.body || document.getElementById('environment-iframe')) return;

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
      zIndex: '0'
    });

    // Put it under everything
    document.body.prepend(iframe);

    // Ensure your main wrapper paints above (no layout change)
    const wrap = document.querySelector('.wrap');
    if (wrap) {
      if (!wrap.style.position) wrap.style.position = 'relative';
      if (!wrap.style.zIndex) wrap.style.zIndex = '1';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectEnvironment, { once: true });
  } else {
    injectEnvironment();
  }
})();
