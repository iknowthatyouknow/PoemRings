/* =========================================================================
   environment.js  (strict, background-only)
   - No changes to index.html
   - Wind/leaves remain in environment.html (their speed controlled there)
   - Slower poem drift + wider spacing between lines (16–18s)
   - Slower butterfly flight (gentler flutter)
   - Bottom reveal: fixed word spacing + smoother fades, centered
   ======================================================================== */

/* --------------------------
   Utilities
--------------------------- */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);   // ← fixed: no stray ')'
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* --------------------------
   Config (tuned to your ruleset)
--------------------------- */
const CFG = {
  z: { leaves: 2, poem: 3, reveal: 4, debug: 9 },
  colors: {
    poemLine: '#ffffff',
    poemShadow: 'rgba(0,0,0,.35)',
    reveal: '#ffffff'
  },
  poem: {
    lines: [
      "Falling in love was never the plan,",
      "Like leaves dancing in the wind, it softly began,",
      "Your breath brushed my world into motion,",
      "For life’s breath is the wind, and your breath its creation."
    ],
    firstLineDelayMaxMs: 120_000,   // first line within 0–120s after load
    betweenLinesMinMs:   16_000,    // wider spacing: ~one line at a time
    betweenLinesMaxMs:   18_000,
    driftDurationMs:     36_000,    // slower cross-screen glide
    driftFontMin: 13,
    driftFontMax: 16
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30_000,  // 30s after last drifted line
    rowPadding: 10,
    fontSizePx: 16,
    wordFadeTotalMs: 20_000,        // slower, smoother per phase
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    minEveryMs: 60_000,
    maxEveryMs: 90_000,
    travelMsMin: 22_000,            // slower
    travelMsMax: 30_000,            // slower
    sizeMin: 20,
    sizeMax: 28,
    tint: {
      waiting: 'rgba(255, 230, 120, 0.50)', // yellow
      playing: 'rgba(120, 200, 255, 0.55)', // cyan/blue
      done:    'rgba(140, 235, 170, 0.55)', // green
      warn:    'rgba(255, 120, 120, 0.55)'  // red
    },
    flutterWaves: 2,   // gentler
    flutterAmp:   22   // gentler
  }
};

/* --------------------------
   Root layers (idempotent)
--------------------------- */
const envRoot = (() => {
  let el = document.getElementById('env-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'env-root';
    Object.assign(el.style, {
      position: 'fixed', inset: '0', zIndex: '0', pointerEvents: 'none'
    });
    document.body.appendChild(el);
  }
  return el;
})();

const leavesLayer = (() => {
  let el = document.getElementById('env-leaves');
  if (!el) {
    el = document.createElement('div');
    el.id = 'env-leaves';
    Object.assign(el.style, {
      position: 'absolute', inset: '0', zIndex: String(CFG.z.leaves), pointerEvents: 'none'
    });
    envRoot.appendChild(el);
  }
  return el;
})();

const poemLayer = (() => {
  let el = document.getElementById('env-poem');
  if (!el) {
    el = document.createElement('div');
    el.id = 'env-poem';
    Object.assign(el.style, {
      position: 'absolute', inset: '0', zIndex: String(CFG.z.poem),
      pointerEvents: 'none', overflow: 'hidden'
    });
    envRoot.appendChild(el);
  }
  return el;
})();

const revealLayer = (() => {
  let el = document.getElementById('env-reveal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'env-reveal';
    Object.assign(el.style, {
      position: 'fixed', left: '0', right: '0', bottom: '0',
      zIndex: String(CFG.z.reveal), pointerEvents: 'none',
      display: 'flex', justifyContent: 'center'
    });
    document.body.appendChild(el);
  }
  return el;
})();

/* --------------------------
   Style injection (scoped)
--------------------------- */
(() => {
  const css = `
  .env-poem-line {
    position: absolute;
    white-space: nowrap;
    color: ${CFG.colors.poemLine};
    text-shadow: 0 1px 3px ${CFG.colors.poemShadow};
    opacity: 0.95;
    font-weight: 600;
    letter-spacing: .2px;
    user-select: none;
    will-change: transform, opacity;
    pointer-events: none;
  }
  .env-reveal-bar {
    max-width: 980px;
    width: calc(100vw - 24px);
    margin: 0 12px 10px;
    background: ${CFG.reveal.barBg};
    border: ${CFG.reveal.border};
    border-radius: 10px;
    padding: ${CFG.reveal.rowPadding}px 14px;
    color: ${CFG.colors.reveal};
    font-size: ${CFG.reveal.fontSizePx}px;
    line-height: 1.45;
    letter-spacing: .2px;
    display: none;          /* shown at render */
    text-align: center;     /* centered within the bar */
  }
  .env-reveal-line {
    display: inline-block;
    margin-right: .75em;
    white-space: nowrap;
    opacity: 1;
  }
  .env-reveal-word {
    display: inline-block;
    opacity: 0;
    will-change: opacity, transform;
    transform: translateY(4px);
  }
  `;
  const tag = document.createElement('style');
  tag.textContent = css;
  document.head.appendChild(tag);
})();

/* --------------------------
   Poem status (for butterfly tint)
--------------------------- */
const poemStatus = { state: 'waiting', set(next){ this.state = next; } };

/* --------------------------
   Poem: drifting lines (slower, earlier fade-in)
--------------------------- */
async function runPoemDrift() {
  try {
    const t0 = randi(0, CFG.poem.firstLineDelayMaxMs);
    let started = false;

    // Safety watchdog
    (async () => {
      await wait(130_000);
      if (!started) poemStatus.set('warn');
    })();

    await wait(t0);
    started = true;
    poemStatus.set('playing');

    for (let i = 0; i < CFG.poem.lines.length; i++) {
      spawnDriftingLine(CFG.poem.lines[i]);
      if (i < CFG.poem.lines.length - 1) {
        await wait(randi(CFG.poem.betweenLinesMinMs, CFG.poem.betweenLinesMaxMs));
      }
    }

    if (CFG.reveal.enabled) {
      await wait(CFG.reveal.appearAfterLastLineMs);
      await runRevealSequence();
    }

    poemStatus.set('done');
  } catch (e) {
    console.error('[env] Poem drift error:', e);
    poemStatus.set('warn');
  }
}

function spawnDriftingLine(text) {
  const el = document.createElement('div');
  el.className = 'env-poem-line';
  el.textContent = text;

  const fontSize = randi(CFG.poem.driftFontMin, CFG.poem.driftFontMax);
  el.style.fontSize = `${fontSize}px`;

  const minY = 90;
  const maxY = Math.max(minY + 60, window.innerHeight - 100);
  const y = randi(minY, maxY);
  el.style.top = `${y}px`;

  // start just off-screen left, end off right
  const textWidthGuess = Math.max(120, text.length * (fontSize * 0.6));
  const startX = -textWidthGuess - 8;
  const endX   = window.innerWidth + 80;

  poemLayer.appendChild(el);

  const dur = CFG.poem.driftDurationMs;
  const tStart = performance.now();
  const peakOpacity = 0.95;

  function step(t) {
    const k = clamp((t - tStart) / dur, 0, 1);
    const x = startX + (endX - startX) * k;
    el.style.transform = `translate(${x}px, 0)`;

    // visible early, smooth fade near exit (enter/exit 22% of path)
    const enter = Math.min(1, k / 0.22);
    const exit  = Math.min(1, (1 - k) / 0.22);
    const vis   = Math.min(enter, exit);
    el.style.opacity = String(peakOpacity * vis);

    if (k < 1) requestAnimationFrame(step);
    else el.remove();
  }
  requestAnimationFrame(step);
}

/* --------------------------
   Bottom reveal (word-by-word, with guaranteed spacing)
--------------------------- */
async function runRevealSequence() {
  const bar = document.createElement('div');
  bar.className = 'env-reveal-bar';
  revealLayer.appendChild(bar);

  // Build lines → words. Each span includes a NBSP so spacing never collapses.
  const lines = CFG.poem.lines.map(line => {
    const lineEl = document.createElement('span');
    lineEl.className = 'env-reveal-line';
    const parts = line.split(' ');
    const words = parts.map((w, idx) => {
      const span = document.createElement('span');
      span.className = 'env-reveal-word';
      // non-breaking space after every word (even the last is fine visually)
      span.textContent = w + '\u00A0';
      lineEl.appendChild(span);
      return span;
    });
    bar.appendChild(lineEl);
    return { lineEl, words };
  });

  bar.style.display = 'block';

  // Smoother transition timing
  const fadeMs = 800;

  await revealWords(lines[0].words, 0.5 * CFG.reveal.wordFadeTotalMs, fadeMs);
  await crossoverFade(lines[0].words, lines[1].words, 0.5 * CFG.reveal.wordFadeTotalMs, fadeMs);

  await crossoverFade(lines[1].words, lines[2].words, 0.5 * CFG.reveal.wordFadeTotalMs, fadeMs);
  await crossoverFade(lines[2].words, lines[3].words, 0.5 * CFG.reveal.wordFadeTotalMs, fadeMs);

  await fadeWords(lines[3].words, 0.5 * CFG.reveal.wordFadeTotalMs, fadeMs);

  bar.remove();
}

async function revealWords(words, totalMs, fadeMs) {
  const per = totalMs / Math.max(1, words.length);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    w.style.transition = `opacity ${fadeMs}ms ease, transform ${fadeMs}ms ease`;
    w.style.opacity = '1';
    w.style.transform = 'translateY(0px)';
    await wait(per);
  }
}

async function crossoverFade(outgoingWords, incomingWords, totalMs, fadeMs) {
  const steps = Math.max(outgoingWords.length, incomingWords.length);
  const per = totalMs / Math.max(1, steps);

  for (let i = 0; i < steps; i++) {
    if (i < incomingWords.length) {
      const wIn = incomingWords[i];
      wIn.style.transition = `opacity ${fadeMs}ms ease, transform ${fadeMs}ms ease`;
      wIn.style.opacity = '1';
      wIn.style.transform = 'translateY(0px)';
    }
    if (i < outgoingWords.length) {
      const wOut = outgoingWords[i];
      wOut.style.transition = `opacity ${fadeMs}ms ease, transform ${fadeMs}ms ease`;
      wOut.style.opacity = '0';
      wOut.style.transform = 'translateY(4px)';
    }
    await wait(per);
  }
}

async function fadeWords(words, totalMs, fadeMs) {
  const per = totalMs / Math.max(1, words.length);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    w.style.transition = `opacity ${fadeMs}ms ease, transform ${fadeMs}ms ease`;
    w.style.opacity = '0';
    w.style.transform = 'translateY(4px)';
    await wait(per);
  }
}

/* --------------------------
   Butterfly (slower + gentler)
--------------------------- */
function spawnButterfly() {
  const size = randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);

  const tint = (() => {
    switch (poemStatus.state) {
      case 'playing': return CFG.butterflies.tint.playing;
      case 'done':    return CFG.butterflies.tint.done;
      case 'warn':    return CFG.butterflies.tint.warn;
      default:        return CFG.butterflies.tint.waiting;
    }
  })();

  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'absolute',
    top: `${randi(40, Math.max(120, window.innerHeight / 2))}px`,
    left: '0px',
    width: `${size}px`,
    height: `${size}px`,
    opacity: '1',
    pointerEvents: 'none',
    zIndex: String(CFG.z.leaves),
    willChange: 'transform'
  });

  el.innerHTML = `
  <svg viewBox="0 0 120 80" width="${size}" height="${size}" style="display:block">
    <defs>
      <filter id="bshadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
    </defs>
    <g filter="url(#bshadow)">
      <path d="M60,40 C30,5 5,5 10,35 C15,60 35,55 60,40 Z" fill="${tint}" />
      <path d="M60,40 C90,5 115,5 110,35 C105,60 85,55 60,40 Z" fill="${tint}" />
      <rect x="57" y="35" width="6" height="16" rx="3" fill="rgba(30,40,60,0.6)"/>
    </g>
  </svg>`;

  leavesLayer.appendChild(el);

  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -40 : (window.innerWidth + 40);
  const endX   = fromLeft ? (window.innerWidth + 40) : -40;
  const baseTop = parseFloat(el.style.top);

  const travelMs = randi(CFG.butterflies.travelMsMin, CFG.butterflies.travelMsMax);
  const tStart = performance.now();

  function anim(t) {
    const k = clamp((t - tStart) / travelMs, 0, 1);
    const x = startX + (endX - startX) * k;
    const flutterY = Math.sin(k * Math.PI * CFG.butterflies.flutterWaves) * CFG.butterflies.flutterAmp;
    const y = baseTop + flutterY;
    el.style.transform = `translate(${x}px, ${y - baseTop}px)`;
    if (k < 1) requestAnimationFrame(anim);
    else el.remove();
  }
  requestAnimationFrame(anim);
}

async function runButterfliesLoop() {
  // early status ping (subtle)
  await wait(randi(6_000, 14_000));
  spawnButterfly();

  while (true) {
    await wait(randi(CFG.butterflies.minEveryMs, CFG.butterflies.maxEveryMs));
    spawnButterfly();
  }
}

/* --------------------------
   Orchestrate (idempotent)
--------------------------- */
(function main(){
  try {
    if (window.__ENV_JS_RAN__) return;      // guard against double-inject
    window.__ENV_JS_RAN__ = true;
    runPoemDrift();
    runButterfliesLoop();
    console.log('[env] environment.js active');
  } catch (e) {
    console.error('[env] init error:', e);
  }
})();
