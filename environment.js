/* =========================================================================
   environment.js
   - Background-only effects (NO changes to index.html)
   - Keeps existing wind/leaves intact (wind speed is in environment.html)
   - Slower poem drift + wider spacing between lines
   - Slower butterfly flight (gentler flutter)
   - Bottom reveal unchanged
   ======================================================================== */

/* --------------------------
   Utilities
--------------------------- */
const wait = (ms) => new Promise(res => setTimeout(res, ms));
const rand = (a, b) => a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* --------------------------
   Config (tuned to your ruleset)
--------------------------- */
const CFG = {
  z: {
    leaves: 2,
    poem: 3,
    reveal: 4,
    debug: 9
  },
  colors: {
    poemLine: '#ffffff',
    poemShadow: 'rgba(0,0,0,.35)',
    reveal: '#ffffff'
  },
  poem: {
    lines: [
      "Falling in love was never the plan,",
      "Like leaves in the wind, it softly began,",
      "Your breath brushed my world into motion,",
      "For Lifes Breath is the Wind, and the wind is you."
    ],
    // >>> Slower cadence between lines (want mostly one line visible at a time)
    betweenLinesMinMs: 16_000,
    betweenLinesMaxMs: 18_000,
    // >>> Slower left→right traverse
    driftDurationMs: 38_000,
    driftFontMin: 13,
    driftFontMax: 16,
    // First line still appears within 0–120s after page load (unchanged)
    firstLineDelayMaxMs: 120_000
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30_000,
    rowPadding: 10,
    fontSizePx: 16,
    wordFadeTotalMs: 15_000,
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    // >>> Slower flight (longer traversal), softer flutter
    minEveryMs: 60_000,
    maxEveryMs: 90_000,
    travelMsMin: 22_000,  // was 12_000
    travelMsMax: 32_000,  // was 18_000
    sizeMin: 20,
    sizeMax: 28,
    tint: {
      waiting: 'rgba(255, 230, 120, 0.50)',
      playing: 'rgba(120, 200, 255, 0.55)',
      done:    'rgba(140, 235, 170, 0.55)',
      warn:    'rgba(255, 120, 120, 0.55)'
    },
    flutterWaves: 2,   // was 3
    flutterAmp: 28     // was 40
  }
};

/* --------------------------
   Root layers
--------------------------- */
const envRoot = (() => {
  let el = document.getElementById('env-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'env-root';
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '0',
      pointerEvents: 'none'
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
      position: 'absolute',
      inset: '0',
      zIndex: String(CFG.z.leaves),
      pointerEvents: 'none'
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
      position: 'absolute',
      inset: '0',
      zIndex: String(CFG.z.poem),
      pointerEvents: 'none',
      overflow: 'hidden'
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
      position: 'fixed',
      left: '0',
      right: '0',
      bottom: '0',
      zIndex: String(CFG.z.reveal),
      pointerEvents: 'none',
      display: 'flex',
      justifyContent: 'center'
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
    line-height: 1.4;
    letter-spacing: .2px;
    display: none;
    text-align: center; /* keep centered */
  }
  .env-reveal-line {
    display: inline-block;
    margin-right: .75em;
    white-space: nowrap;
    opacity: 1;
  }
  .env-reveal-word {
    display: inline-block;
    opacity: 0.0;
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
const poemStatus = {
  state: 'waiting', // 'waiting' | 'playing' | 'done' | 'warn'
  set(next) { this.state = next; }
};

/* --------------------------
   Poem: drifting lines (slower)
--------------------------- */
async function runPoemDrift() {
  try {
    const t0 = randi(0, CFG.poem.firstLineDelayMaxMs);
    let started = false;

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
    console.error('Poem drift error:', e);
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

  const startX = -Math.max(120, text.length * (fontSize * 0.6));
  const endX = window.innerWidth + 80;

  poemLayer.appendChild(el);

  const dur = CFG.poem.driftDurationMs;
  const tStart = performance.now();
  const peakOpacity = 0.95;

  function step(t) {
    const k = clamp((t - tStart) / dur, 0, 1);
    const x = startX + (endX - startX) * k;
    // smooth ease (S-curve)
    const ease = k < 0.5 ? 2*k*k : -1 + (4 - 2*k) * k;
    el.style.transform = `translate(${x}px, 0)`;
    // visible sooner as it enters, then fade near the exit
    const fadeIn  = Math.min(1, k / 0.20);      // first 20% of path
    const fadeOut = Math.min(1, (1 - k) / 0.20); // last 20% of path
    el.style.opacity = String(peakOpacity * Math.min(fadeIn, fadeOut) * (0.75 + 0.25*ease));

    if (k < 1) requestAnimationFrame(step);
    else el.remove();
  }
  requestAnimationFrame(step);
}

/* --------------------------
   Bottom reveal (unchanged)
--------------------------- */
async function runRevealSequence() {
  const bar = document.createElement('div');
  bar.className = 'env-reveal-bar';
  revealLayer.appendChild(bar);

  const lines = CFG.poem.lines.map(line => {
    const lineEl = document.createElement('span');
    lineEl.className = 'env-reveal-line';
    const words = line.split(' ').map((w, idx, arr) => {
      const span = document.createElement('span');
      span.className = 'env-reveal-word';
      span.textContent = (idx < arr.length - 1) ? w + ' ' : w;
      lineEl.appendChild(span);
      return span;
    });
    bar.appendChild(lineEl);
    return { lineEl, words };
  });

  bar.style.display = 'block';

  await revealWords(lines[0].words, 0.5 * CFG.reveal.wordFadeTotalMs);
  await crossoverFade(lines[0].words, lines[1].words, 0.5 * CFG.reveal.wordFadeTotalMs);

  await crossoverFade(lines[1].words, lines[2].words, 0.5 * CFG.reveal.wordFadeTotalMs);
  await crossoverFade(lines[2].words, lines[3].words, 0.5 * CFG.reveal.wordFadeTotalMs);

  await fadeWords(lines[3].words, 0.5 * CFG.reveal.wordFadeTotalMs);

  bar.remove();
}

async function revealWords(words, totalMs) {
  const per = totalMs / Math.max(1, words.length);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    w.style.transition = `opacity 500ms ease, transform 500ms ease`;
    w.style.opacity = '1';
    w.style.transform = 'translateY(0px)';
    await wait(per);
  }
}

async function crossoverFade(outgoingWords, incomingWords, totalMs) {
  const steps = Math.max(outgoingWords.length, incomingWords.length);
  const per = totalMs / Math.max(1, steps);

  for (let i = 0; i < steps; i++) {
    if (i < incomingWords.length) {
      const wIn = incomingWords[i];
      wIn.style.transition = `opacity 500ms ease, transform 500ms ease`;
      wIn.style.opacity = '1';
      wIn.style.transform = 'translateY(0px)';
    }
    if (i < outgoingWords.length) {
      const wOut = outgoingWords[i];
      wOut.style.transition = `opacity 500ms ease, transform 500ms ease`;
      wOut.style.opacity = '0';
      wOut.style.transform = 'translateY(4px)';
    }
    await wait(per);
  }
}

async function fadeWords(words, totalMs) {
  const per = totalMs / Math.max(1, words.length);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    w.style.transition = `opacity 500ms ease, transform 500ms ease`;
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
  const endX = fromLeft ? (window.innerWidth + 40) : -40;
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
  await wait(randi(6_000, 14_000));
  spawnButterfly();

  while (true) {
    await wait(randi(CFG.butterflies.minEveryMs, CFG.butterflies.maxEveryMs));
    spawnButterfly();
  }
}

/* --------------------------
   Orchestrate
--------------------------- */
async function main() {
  runPoemDrift();
  runButterfliesLoop();
}

main();
