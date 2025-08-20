// environment-loader.js
(function(){
  // 1) Insert the environment iframe at the very front of <body>
  var iframe = document.createElement('iframe');
  iframe.src = './environment.html';
  iframe.title = 'Decorative background';
  iframe.setAttribute('aria-hidden','true');
  iframe.tabIndex = -1;
  Object.assign(iframe.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    border: '0',
    zIndex: '0',          // behind main content
    pointerEvents: 'none',
    background: 'transparent'
  });
  document.body.prepend(iframe);

  // 2) Ensure your main content renders above (without changing your CSS files)
  var wrap = document.querySelector('.wrap');
  if (wrap){
    wrap.style.position = 'relative';
    wrap.style.zIndex = '1';
  }
})();
