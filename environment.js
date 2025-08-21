/* =========================================================================
   environment.js
   - Background-only effects (NO changes to index.html)
   - Keeps existing wind/leaves intact
   - Adds "poem in the wind" drift + bottom reveal
   - Adds subtle blue butterfly (reduced brightness) that also signals status
   ======================================================================== */

/* --------------------------
   Utilities
--------------------------- */
const wait = (ms) => new Promise(res => setTimeout(res, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* --------------------------
   Config (tuned to your ruleset)
--------------------------- */
const CFG = {
  z: {
    // Leaves and poem/butterfly layer ordering; higher appears above
    leaves: 2,
    poem: 3,
    reveal: 4,   // bottom reveal text overlay
    debug: 9
  },
  colors: {
    poemLine: '#ffffff',           // drifting lines
    poemShadow: 'rgba(0,0,0,.35)', // readability on dark bg
    reveal: '#ffffff'
  },
  poem: {
    lines: [
      "Falling in love was never the plan,",
      "Like leaves in the wind, it softly began,",
      "Your breath brushed my world into motion,",
      "Love is the wind, and the wind is you."
    ],
    firstLineDelayMaxMs: 120_000,   // first line appears within 0–120s
    betweenLinesMinMs: 6_000,       // 6–9s between drifting lines
    betweenLinesMaxMs: 9_000,
    driftDurationMs: 18_000,        // time to cross the screen left→right
    driftFontMin: 13,               // smaller than ring poem
    driftFontMax: 16
  },
  reveal: {
    // Bottom-of-viewport reveal (background overlay, not changing index DOM)
    enabled: true,
    appearAfterLastLineMs: 30_000,  // wait 30s after last line drifted
    rowPadding: 10,                 // padding in the bar
    fontSizePx: 16,                 // “same white color”, ring-size is larger; this is readable
    wordFadeTotalMs: 15_000,        // per two-line phase timing you outlined
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    // Reduced brightness: use SVG with ~0.5 opacity
    minEveryMs: 60_000,
    maxEveryMs: 90_000,
    travelMsMin: 12_000,
    travelMsMax: 18_000,
    sizeMin: 20,
    sizeMax: 28,
    // Status tints (wings fill)
    tint: {
      waiting: 'rgba(255, 230, 120, 0.50)', // yellow (scheduled, waiting)
      playing: 'rgba(120, 200, 255, 0.55)', // cyan/blue (in progress)
      done:    'rgba(140, 235, 170, 0.55)', // green (finished)
      warn:    'rgba(255, 120, 120, 0.55)'  // red (no start > 130s)
    }
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
      zIndex: '0',              // background container
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
    display: none; /* shown when we render */
  }
  .env-reveal-line {
    display: inline-block;
    margin-right: .75em;
    white-space: nowrap;
    opacity: 0.0;
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
   Poem: drifting lines
--------------------------- */
async function runPoemDrift() {
  try {
    // First line appears within 0–120s
    const t0 = randi(0, CFG.poem.firstLineDelayMaxMs);
    let started = false;

    // Watchdog: if no start by 130s, warn
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

    // schedule the reveal (bottom) after last line
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

  // font smaller than ring poem
  const fontSize = randi(CFG.poem.driftFontMin, CFG.poem.driftFontMax);
  el.style.fontSize = `${fontSize}px`;

  // vertical position (random band; avoid top-right menu area ~ first 80px)
  const minY = 90;
  const maxY = Math.max(minY + 60, window.innerHeight - 100);
  const y = randi(minY, maxY);
  el.style.top = `${y}px`;

  // start just off-screen left, end off-screen right
  const startX = -Math.max(120, text.length * (fontSize * 0.6));
  const endX = window.innerWidth + 80;

  // add to layer
  poemLayer.appendChild(el);

  const dur = CFG.poem.driftDurationMs;
  const start = performance.now();
  const startOpacity = 0.0;
  const peakOpacity = 0.95;

  function step(t) {
    const k = clamp((t - start) / dur, 0, 1);
    const x = startX + (endX - startX) * k;
    // gentle ease (S-curve)
    const ease = k < 0.5 ? 2*k*k : -1 + (4 - 2*k) * k;
    el.style.transform = `translate(${x}px, 0)`;
    // fade in/out slightly at ends
    const fade = k < 0.1 ? k/0.1 : (k > 0.9 ? (1-k)/0.1 : 1);
    el.style.opacity = String(startOpacity + (peakOpacity - startOpacity) * ease * fade);

    if (k < 1) requestAnimationFrame(step);
    else el.remove();
  }
  requestAnimationFrame(step);
}

/* --------------------------
   Bottom reveal (word-by-word, phased)
   - For simplicity here, we reveal all 4 lines sequentially with word-by-word fade-in
   - Then fade them away word-by-word
--------------------------- */
async function runRevealSequence() {
  const bar = document.createElement('div');
  bar.className = 'env-reveal-bar';
  revealLayer.appendChild(bar);

  // Build word spans
  const lines = CFG.poem.lines.map(line => {
    const lineEl = document.createElement('span');
    lineEl.className = 'env-reveal-line';
    const words = line.split(' ').map((w, idx, arr) => {
      const span = document.createElement('span');
      span.className = 'env-reveal-word';
      // preserve punctuation spacing
      span.textContent = (idx < arr.length - 1) ? w + ' ' : w;
      lineEl.appendChild(span);
      return span;
    });
    bar.appendChild(lineEl);
    return { lineEl, words };
  });

  bar.style.display = 'block';

  // Phase A: show lines 1 & 2 word-by-word (~15s total for both lines fade-in)
  await revealWords(lines[0].words, 0.5 * CFG.reveal.wordFadeTotalMs);
  await crossoverFade(lines[0].words, lines[1].words, 0.5 * CFG.reveal.wordFadeTotalMs);

  // Phase B: lines 3 & 4
  await crossoverFade(lines[1].words, lines[2].words, 0.5 * CFG.reveal.wordFadeTotalMs);
  await crossoverFade(lines[2].words, lines[3].words, 0.5 * CFG.reveal.wordFadeTotalMs);

  // After last line fully visible, fade it out word-by-word (no incoming line)
  await fadeWords(lines[3].words, 0.5 * CFG.reveal.wordFadeTotalMs);

  // Hide and cleanup
  bar.remove();
}

// fade-in one list of words over totalMs
async function revealWords(words, totalMs) {
  const per = totalMs / Math.max(1, words.length);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    w.style.transition = `opacity 400ms ease, transform 400ms ease`;
    w.style.opacity = '1';
    w.style.transform = 'translateY(0px)';
    await wait(per);
  }
}

// cross-fade: while we fade in “incoming”, we fade out “outgoing” word-by-word
async function crossoverFade(outgoingWords, incomingWords, totalMs) {
  const steps = Math.max(outgoingWords.length, incomingWords.length);
  const per = totalMs / Math.max(1, steps);

  for (let i = 0; i < steps; i++) {
    // fade-in next incoming word
    if (i < incomingWords.length) {
      const wIn = incomingWords[i];
      wIn.style.transition = `opacity 400ms ease, transform 400ms ease`;
      wIn.style.opacity = '1';
      wIn.style.transform = 'translateY(0px)';
    }
    // fade-out next outgoing word
    if (i < outgoingWords.length) {
      const wOut = outgoingWords[i];
      wOut.style.transition = `opacity 400ms ease, transform 400ms ease`;
      wOut.style.opacity = '0';
      wOut.style.transform = 'translateY(4px)';
    }
    await wait(per);
  }
}

// fade-out list of words over totalMs
async function fadeWords(words, totalMs) {
  const per = totalMs / Math.max(1, words.length);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    w.style.transition = `opacity 400ms ease, transform 400ms ease`;
    w.style.opacity = '0';
    w.style.transform = 'translateY(4px)';
    await wait(per);
  }
}

/* --------------------------
   Butterfly (reduced brightness + status tint)
--------------------------- */
function spawnButterfly() {
  const size = randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);

  // SVG butterfly (simple path wings), tinted by status
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
    zIndex: String(CFG.z.leaves), // weave with leaves
    willChange: 'transform'
  });

  // A very lightweight butterfly shape (two wings) + small body
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
  const start = performance.now();

  function anim(t) {
    const k = clamp((t - start) / travelMs, 0, 1);
    const x = startX + (endX - startX) * k;
    const flutterY = Math.sin(k * Math.PI * 3) * 40; // gentle 3-wave flutter
    const y = baseTop + flutterY;
    el.style.transform = `translate(${x}px, ${y - baseTop}px)`;
    if (k < 1) requestAnimationFrame(anim);
    else el.remove();
  }
  requestAnimationFrame(anim);
}

async function runButterfliesLoop() {
  // one subtle “status ping” butterfly fairly soon (helps you see status quickly)
  await wait(randi(6_000, 14_000));
  spawnButterfly();

  while (true) {
    await wait(randi(CFG.butterflies.minEveryMs, CFG.butterflies.maxEveryMs));
    spawnButterfly();
  }
}

/* --------------------------
   Orchestrate (without touching index.html)
--------------------------- */
async function main() {
  // (Leaves system assumed to be running already in your environment.html / environment.js setup)
  // Start poem drift + butterflies in parallel
  runPoemDrift();
  runButterfliesLoop();
}

main();
