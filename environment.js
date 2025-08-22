/* =========================================================================
   environment.js
   - Background-only effects (NO changes to index.html)
   - Keeps existing wind/leaves intact (wind speed in environment.html)
   - Wind/Breath/Elegra/Rez hooks (from windsong-controller.js)
   - Uses knobs live: Wind (speed), Breath (inter-line delay), Elegra (reveal pacing)
   - Rez scheduling handled by controller; guarded re-entry here
   ======================================================================== */

/* --------------------------
   Utilities
--------------------------- */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* --------------------------
   Wind’s Song shared state + listeners
--------------------------- */
window.__WINDS_SONG__ = window.__WINDS_SONG__ || {
  wind:   1.0,  // global speed multiplier
  breath: 16,   // seconds between lines
  elegra: 15,   // seconds for reveal phase pacing
  rez:    1
};

window.addEventListener("windsong:update", (e) => {
  const { wind, breath, elegra, rez } = e.detail || {};
  if (wind   !== undefined) window.__WINDS_SONG__.wind   = wind;
  if (breath !== undefined) window.__WINDS_SONG__.breath = breath;
  if (elegra !== undefined) window.__WINDS_SONG__.elegra = elegra;
  if (rez    !== undefined) window.__WINDS_SONG__.rez    = rez;
});

window.addEventListener("windsong:trigger", () => {
  if (typeof runPoemDrift === "function") runPoemDrift();
});

/* --------------------------
   Config (visual tokens only)
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
    // base durations (will be adjusted by Wind/Breath live)
    baseFirstLineDelayMaxMs: 120_000,  // 0–120s
    baseDriftDurationMs:     32_000,   // cross-screen time at Wind=1
    driftFontMin: 13,
    driftFontMax: 16
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30_000,      // wait after last drifted line
    rowPadding: 10,
    fontSizePx: 16,
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    // base travel times (will be adjusted by Wind live)
    baseTravelMsMin: 18_000,
    baseTravelMsMax: 26_000,
    sizeMin: 20,
    sizeMax: 28,
    tint: {
      waiting: 'rgba(255, 230, 120, 0.50)',
      playing: 'rgba(120, 200, 255, 0.55)',
      done:    'rgba(140, 235, 170, 0.55)',
      warn:    'rgba(255, 120, 120, 0.55)'
    },
    flutterWaves: 2,
    flutterAmp: 28
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
      left: '0', right: '0', bottom: '0',
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
    text-align: center;
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
   Poem status (for tint)
--------------------------- */
const poemStatus = {
  state: 'waiting',
  set(next) { this.state = next; }
};

/* --------------------------
   Poem drift (Wind & Breath applied)
--------------------------- */
let __windsSongRunInProgress = false;

async function runPoemDrift() {
  if (__windsSongRunInProgress) return;
  __windsSongRunInProgress = true;
  try {
    const wind    = Number(window.__WINDS_SONG__.wind)   || 1;
    const breathS = Number(window.__WINDS_SONG__.breath) || 16;

    const firstDelayMs = randi(0, CFG.poem.baseFirstLineDelayMaxMs); // unchanged (surprise window)
    const betweenMs    = Math.max(500, Math.round(breathS * 1000));  // uniform gap per knob
    const driftMs      = Math.max(1000, Math.round(CFG.poem.baseDriftDurationMs / Math.max(0.1, wind)));

    let started = false;

    (async () => {
      await wait(130_000);
      if (!started) poemStatus.set('warn');
    })();

    await wait(firstDelayMs);
    started = true;
    poemStatus.set('playing');

    for (let i = 0; i < CFG.poem.lines.length; i++) {
      spawnDriftingLine(CFG.poem.lines[i], driftMs);
      if (i < CFG.poem.lines.length - 1) {
        await wait(betweenMs);
      }
    }

    if (CFG.reveal.enabled) {
      await wait(CFG.reveal.appearAfterLastLineMs);
      await runRevealSequence(); // Elegra is applied inside
    }

    poemStatus.set('done');
  } catch (e) {
    console.error('Poem drift error:', e);
    poemStatus.set('warn');
  } finally {
    __windsSongRunInProgress = false;
  }
}

function spawnDriftingLine(text, driftDurationMs) {
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

  const tStart = performance.now();
  const peakOpacity = 0.95;

  function step(t) {
    const k = clamp((t - tStart) / driftDurationMs, 0, 1);
    const x = startX + (endX - startX) * k;
    // smooth ease (S-curve)
    const ease = k < 0.5 ? 2*k*k : -1 + (4 - 2*k) * k;
    el.style.transform = `translate(${x}px, 0)`;
    // earlier fade-in and smooth fade-out
    const fadeIn  = Math.min(1, k / 0.20);
    const fadeOut = Math.min(1, (1 - k) / 0.20);
    el.style.opacity = String(peakOpacity * Math.min(fadeIn, fadeOut) * (0.75 + 0.25*ease));

    if (k < 1) requestAnimationFrame(step);
    else el.remove();
  }
  requestAnimationFrame(step);
}

/* --------------------------
   Bottom reveal (Elegra applied)
--------------------------- */
async function runRevealSequence() {
  const elegraS = Number(window.__WINDS_SONG__.elegra) || 15;
  // Each crossover phase uses half the total (pair) time
  const pairTotalMs = Math.max(1000, Math.round(elegraS * 1000));
  const halfPair = 0.5 * pairTotalMs;

  const bar = document.createElement('div');
  bar.className = 'env-reveal-bar';
  revealLayer.appendChild(bar);

  const lines = CFG.poem.lines.map(line => {
    const lineEl = document.createElement('span');
    lineEl.className = 'env-reveal-line';
    const words = line.split(' ').map((w, idx, arr) => {
      const span = document.createElement('span');
      span.className = 'env-reveal-word';
      span.textContent = (idx < arr.length - 1) ? (w + ' ') : w; // preserve spaces
      lineEl.appendChild(span);
      return span;
    });
    bar.appendChild(lineEl);
    return { lineEl, words };
  });

  bar.style.display = 'block';

  await revealWords(lines[0].words, halfPair);
  await crossoverFade(lines[0].words, lines[1].words, halfPair);

  await crossoverFade(lines[1].words, lines[2].words, halfPair);
  await crossoverFade(lines[2].words, lines[3].words, halfPair);

  await fadeWords(lines[3].words, halfPair);

  bar.remove();
}

async function revealWords(words, totalMs) {
  const per = totalMs / Math.max(1, words.length);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    w.style.transition = `opacity 600ms ease, transform 600ms ease`;
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
      wIn.style.transition = `opacity 600ms ease, transform 600ms ease`;
      wIn.style.opacity = '1';
      wIn.style.transform = 'translateY(0px)';
    }
    if (i < outgoingWords.length) {
      const wOut = outgoingWords[i];
      wOut.style.transition = `opacity 600ms ease, transform 600ms ease`;
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
    w.style.transition = `opacity 600ms ease, transform 600ms ease`;
    w.style.opacity = '0';
    w.style.transform = 'translateY(4px)';
    await wait(per);
  }
}

/* --------------------------
   Butterfly (Wind applied)
--------------------------- */
function spawnButterfly() {
  const wind = Number(window.__WINDS_SONG__.wind) || 1;

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

  // Wind increases speed -> shorter travel duration
  const baseMin = CFG.butterflies.baseTravelMsMin;
  const baseMax = CFG.butterflies.baseTravelMsMax;
  const travel  = randi(baseMin, baseMax);
  const travelMs = Math.max(800, Math.round(travel / Math.max(0.1, wind)));

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
    // unchanged cadence; speed itself is controlled by Wind inside spawnButterfly()
    await wait(randi(60_000, 90_000));
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
