/* environment.js
   Background-only environment for wind + leaves + "poem in the wind".
   - Runs inside environment.html (iframe).
   - 100% isolated: pointer-events: none; no interference with index.html.
   - Honors prefers-reduced-motion.
*/

/* ======== Setup root & styles (scoped) ======== */
(function initEnvironment() {
  if (window.__envBooted) return;
  window.__envBooted = true;

  const RMO = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.createElement('div');
  root.id = 'env-root';
  document.body.appendChild(root);

  const style = document.createElement('style');
  style.textContent = `
    html, body { height:100%; }
    body {
      margin:0;
      background: transparent;
      overflow:hidden;
    }
    #env-root{
      position:fixed; inset:0;
      pointer-events:none;          /* never block main page interactions */
      z-index: 0;                   /* stays behind main UI */
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans";
    }

    /* ===== Leaves layer ===== */
    .leaf-layer { position:absolute; inset:0; overflow:hidden; }
    .leaf {
      position:absolute;
      will-change: transform, opacity;
      opacity: 0.85;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,.25));
    }

    /* Simple SVG leaf (no external assets) */
    .leaf svg { display:block; width:100%; height:100%; }
    .leaf path { fill: rgba(255, 209, 102, 0.8); }               /* warm gold */
    .leaf.ve2 path { fill: rgba(255, 150, 80, 0.8); }            /* orange */
    .leaf.ve3 path { fill: rgba(190, 220, 120, 0.8); }           /* pale green */
    .leaf.ve4 path { fill: rgba(230, 180, 140, 0.8); }           /* maple tan */

    @keyframes leafFloatX {
      0%   { transform: translateX(var(--x-start)) translateY(0) rotate(0deg); }
      50%  { transform: translateX(calc((var(--x-end) + var(--x-start))/2)) translateY(40px) rotate(180deg); }
      100% { transform: translateX(var(--x-end)) translateY(0) rotate(360deg); }
    }
    @keyframes leafSwayY {
      0% { transform: translateY(var(--y-start)) }
      50%{ transform: translateY(calc(var(--y-start) + var(--y-amp))) }
      100%{ transform: translateY(var(--y-start)) }
    }

    /* ===== Poem drift & recap layers ===== */
    .pw-layer { position:absolute; inset:0; }
    .pw-line{
      position:absolute;
      left:0; top:0;
      white-space:nowrap;
      opacity:0;
      color:#cdd6e7;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,.45));
      font-weight:600;
      letter-spacing:.2px;
      font-size: clamp(12px, 1.6vw, 18px);
      text-shadow: 0 0 10px rgba(205,214,231,0.12);
      will-change: transform, opacity;
    }
    .pw-recap-wrap{
      position:absolute;
      left:50%;
      bottom:min(44px, 10vh);
      transform: translateX(-50%);
      max-width: 86vw;
      width: max-content;
      display:flex; flex-direction:row; gap:18px;
      align-items:flex-end; justify-content:center;
      opacity: 1;
    }
    .pw-recap-line{
      display:block; white-space:nowrap;
      color:#cdd6e7;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,.45));
      font-weight:700; letter-spacing:.25px;
      font-size: clamp(12px, 1.5vw, 17px);
    }
    .pw-recap-line .w{ display:inline-block; opacity:0; transition: opacity 350ms linear; }
    .pw-recap-line .w.on{ opacity:1; }

    @media (prefers-reduced-motion: reduce){
      .leaf { transition: opacity 300ms ease; }
      .pw-line { transition: opacity 600ms ease; }
    }
  `;
  document.head.appendChild(style);

  // Layers
  const leafLayer = document.createElement('div');
  leafLayer.className = 'leaf-layer';
  const poemLayer = document.createElement('div');
  poemLayer.className = 'pw-layer';
  root.appendChild(leafLayer);
  root.appendChild(poemLayer);

  /* ======== WIND + LEAVES (non-intrusive, background only) ======== */
  (function leaves() {
    if (RMO) {
      // Reduced motion: render a light sprinkling statically
      for (let i = 0; i < 12; i++) addLeaf({ staticOnly: true });
      return;
    }
    // Continuous gentle emission
    const RATE_MS = 900;  // one leaf roughly every 0.9s
    let run = true;
    const tick = () => {
      if (!run) return;
      addLeaf();
      setTimeout(tick, RATE_MS + Math.round((Math.random()-0.5)*400));
    };
    tick();
    // Stop if iframe is ever hidden/unloaded
    window.addEventListener('pagehide', () => run = false);
    document.addEventListener('visibilitychange', () => { if (document.hidden) run = false; });
  })();

  function addLeaf({ staticOnly = false } = {}) {
    const w = window.innerWidth || 1024;
    const h = window.innerHeight || 768;

    const size = Math.max(10, Math.round(12 + Math.random()*18));    // px
    const yStart = Math.round(h * (0.05 + Math.random()*0.8));        // spawn band
    const amp = Math.round(20 + Math.random()*40);                    // sway amplitude

    const dir = Math.random() < 0.5 ? 'ltr' : 'rtl';
    const xStart = dir === 'ltr' ? -60 : (w + 60);
    const xEnd   = dir === 'ltr' ? (w + 60) : -60;

    const dur = Math.round(9000 + Math.random()*7000); // 9–16s

    const vClass = 've' + (1 + (Math.floor(Math.random()*4)));

    const el = document.createElement('div');
    el.className = `leaf ${vClass}`;
    el.style.width = `${size}px`;
    el.style.height = `${Math.round(size*1.2)}px`;
    el.style.top = `${yStart}px`;

    // embed a tiny SVG leaf (no external image)
    el.innerHTML = `
      <svg viewBox="0 0 50 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path d="M25,2 C38,6 48,18 48,30 C48,42 40,54 25,58 C10,54 2,42 2,30 C2,18 12,6 25,2 Z"></path>
      </svg>
    `;

    // motion via JS or CSS based on preference
    if (RMO || staticOnly) {
      el.style.left = `${Math.round(Math.random()*w)}px`;
      el.style.opacity = '0.7';
      leafLayer.appendChild(el);
      if (!staticOnly) setTimeout(() => el.remove(), 2500);
      return;
    }

    // Set CSS vars for keyframes (some modern browsers support in @keyframes ticks)
    el.style.setProperty('--x-start', `${xStart}px`);
    el.style.setProperty('--x-end', `${xEnd}px`);
    el.style.setProperty('--y-start', `${-8 + Math.round(Math.random()*16)}px`);
    el.style.setProperty('--y-amp', `${amp}px`);

    // We'll animate with requestAnimationFrame for smoother control
    leafLayer.appendChild(el);
    const t0 = performance.now();
    const life = dur;
    const rotStart = Math.random()*360;
    const rotDir = Math.random()<0.5 ? -1 : 1;
    const floatAmp = 14 + Math.random()*16;

    const step = (now) => {
      const t = Math.min(1, (now - t0)/life);
      const ease = t<0.5 ? 2*t*t : -1 + (4-2*t)*t;  // ease in-out
      const x = xStart + (xEnd - xStart) * ease;
      const y = yStart + Math.sin(t * Math.PI * 2 * (0.6 + Math.random()*0.2)) * floatAmp;
      const rot = rotStart + rotDir * t * 360;

      const alpha = t < 0.1 ? t/0.1 : (t > 0.9 ? (1 - t)/0.1 : 1);
      el.style.opacity = String(alpha);
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) rotate(${rot}deg)`;

      if (t < 1 && document.body.contains(el)) requestAnimationFrame(step);
      else el.remove();
    };
    requestAnimationFrame(step);
  }

  /* ======== POEM IN THE WIND (drift + recap) ======== */
  (function PoemInTheWind() {
    if (window.__poemWindStarted) return;
    window.__poemWindStarted = true;

    // ---- Config
    const LINES = [
      "Falling in love was never the plan,",
      "Like leaves in the wind, it softly began",
      "You moved through me the way the wind moves the trees,",
      "Love is the wind, and the wind is you"
    ];

    // Drift timings
    const DRIFT_MIN_GAP_MS = 6000;   // 6s between line starts
    const DRIFT_MAX_GAP_MS = 9000;   // 9s
    const DRIFT_MIN_DUR_MS = 10000;  // each drift 10–12s
    const DRIFT_MAX_DUR_MS = 12000;

    // After all drifts, wait before recap
    const RECAP_DELAY_AFTER_DRIFT_MS = 30000; // 30s
    const PAIR_TOTAL_MS = 15000;              // 15s per pair (1↔2, 2↔3, 3↔4)
    const FINAL_FADE_MS = 6000;               // 6s L4 fade out
    const WORD_FADE_MS = 350;

    // Layer for poem
    const pwRoot = poemLayer;

    // Utils
    const rand = (min, max) => Math.random() * (max - min) + min;
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    const pickBandY = (i) => {
      const vh = window.innerHeight || 800;
      const bands = [0.14, 0.32, 0.58, 0.78];
      const y = clamp(Math.round(vh * bands[i % bands.length]), 20, vh - 20);
      return y;
    };

    async function driftLine(text, bandIndex) {
      const el = document.createElement('div');
      el.className = 'pw-line';
      el.setAttribute('aria-hidden','true');
      el.textContent = text;
      pwRoot.appendChild(el);

      if (RMO) {
        el.style.opacity = '1';
        el.style.transform = `translate(20px, ${pickBandY(bandIndex)}px)`;
        await wait(1200);
        el.remove();
        return;
      }

      const dur = Math.round(rand(DRIFT_MIN_DUR_MS, DRIFT_MAX_DUR_MS));
      const dir = Math.random() < 0.5 ? 'ltr' : 'rtl';
      const startX = dir === 'ltr' ? -40 : (window.innerWidth + 40);
      const endX   = dir === 'ltr' ? (window.innerWidth + 40) : -40;
      const y = pickBandY(bandIndex);
      const t0 = performance.now();

      return new Promise(resolve => {
        const step = (now) => {
          const t = clamp((now - t0) / dur, 0, 1);
          const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
          const x = startX + (endX - startX) * ease;
          const wobble = Math.sin(t*2*Math.PI) * 8;
          const alpha = t < 0.15 ? t/0.15 : (t > 0.85 ? (1 - t)/0.15 : 1);
          el.style.opacity = String(alpha);
          el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y + wobble)}px)`;
          if (t < 1) requestAnimationFrame(step); else { el.remove(); resolve(); }
        };
        requestAnimationFrame(step);
      });
    }

    async function runDriftSequence() {
      if (RMO) {
        // Brief static preview of all lines
        for (let i = 0; i < LINES.length; i++) {
          const el = document.createElement('div');
          el.className = 'pw-line';
          el.style.opacity = '1';
          el.style.transform = `translate(20px, ${pickBandY(i)}px)`;
          el.textContent = LINES[i];
          el.setAttribute('aria-hidden','true');
          pwRoot.appendChild(el);
        }
        await wait(2000);
        pwRoot.querySelectorAll('.pw-line').forEach(n => n.remove());
        return;
      }

      // sequential drifts with random gaps
      for (let i = 0; i < LINES.length; i++) {
        const p = driftLine(LINES[i], i);
        if (i < LINES.length - 1) {
          await wait(Math.round(rand(DRIFT_MIN_GAP_MS, DRIFT_MAX_GAP_MS)));
        }
        await p;
      }
    }

    function buildWordLine(text) {
      const lineEl = document.createElement('div');
      lineEl.className = 'pw-recap-line';
      const words = text.trim().split(/\s+/);
      const spans = words.map((w, idx) => {
        const s = document.createElement('span');
        s.className = 'w';
        s.textContent = (idx > 0 ? ' ' : '') + w;
        lineEl.appendChild(s);
        return s;
      });
      return { lineEl, spans };
    }

    async function runPair(frontText, middleText, wrapEl) {
      wrapEl.innerHTML = '';

      const { lineEl: frontEl, spans: frontWords } = buildWordLine(frontText);
      const { lineEl: middleEl, spans: middleWords } = buildWordLine(middleText);
      wrapEl.appendChild(frontEl);
      wrapEl.appendChild(middleEl);

      frontWords.forEach(s => s.classList.add('on'));
      middleWords.forEach(s => s.classList.remove('on'));

      if (RMO) {
        await wait(800);
        frontEl.remove();
        middleWords.forEach(s => s.classList.add('on'));
        await wait(800);
        return;
      }

      const steps = middleWords.length || 1;
      const stepMs = PAIR_TOTAL_MS / steps;

      for (let i = 0; i < steps; i++) {
        if (middleWords[i]) middleWords[i].classList.add('on');
        if (frontWords[i])  frontWords[i].classList.remove('on');
        await wait(stepMs);
      }
      if (frontWords.length > middleWords.length) {
        const leftovers = frontWords.slice(middleWords.length);
        leftovers.forEach(s => s.classList.remove('on'));
        await wait(WORD_FADE_MS + 50);
      }
    }

    async function fadeOutFinal(text, wrapEl) {
      wrapEl.innerHTML = '';
      const { lineEl, spans } = buildWordLine(text);
      wrapEl.appendChild(lineEl);
      spans.forEach(s => s.classList.add('on'));

      if (RMO) {
        await wait(600);
        wrapEl.remove();
        return;
      }

      const steps = spans.length || 1;
      const stepMs = FINAL_FADE_MS / steps;
      for (let i = 0; i < steps; i++) {
        spans[i].classList.remove('on');
        await wait(stepMs);
      }
      await wait(WORD_FADE_MS + 80);
      wrapEl.remove();
    }

    async function runRecapSequence() {
      const wrap = document.createElement('div');
      wrap.className = 'pw-recap-wrap';
      wrap.setAttribute('aria-hidden','true');
      pwRoot.appendChild(wrap);

      await runPair(LINES[0], LINES[1], wrap);
      await runPair(LINES[1], LINES[2], wrap);
      await runPair(LINES[2], LINES[3], wrap);
      await fadeOutFinal(LINES[3], wrap);
    }

    (async function orchestrate() {
      try {
        await runDriftSequence();
        await wait(RECAP_DELAY_AFTER_DRIFT_MS);
        await runRecapSequence();
      } catch (e) {
        console.warn('[PoemInTheWind] aborted:', e);
      }
    })();
  })();
})();
