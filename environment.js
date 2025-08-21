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
const rand = (a, b) => a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* --------------------------
   Config (tuned to your ruleset)
--------------------------- */
const CFG = {
  z: {
    // Background leaves stay under content via iframe.
    // Poem and bottom reveal render above content but ignore pointer events.
    leaves: 2,
    poem:  2,   // overlay above page content
    reveal: 3,  // bottom reveal above poem drift
    debug:  9
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
      "Love is the wind, and the wind is you."
    ],
    firstLineDelayMaxMs: 120_000,   // 0–120s window
    betweenLinesMinMs: 10_000,      // 10–12s as requested
    betweenLinesMaxMs: 12_000,
    driftDurationMs: 26_000,        // slower left→right
    driftFontMin: 13,
    driftFontMax: 16,
    fadeEdge: 0.18                   // fade in first 18%, fade out last 18%
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30_000,   // 30s after last drift line
    rowPadding: 10,
    fontSizePx: 16,
    wordFadeTotalMs: 15_000,         // per two-line phase (unchanged)
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    minEveryMs: 60_000,
    maxEveryMs: 90_000,
    travelMsMin: 12_000,
    travelMsMax: 18_000,
    sizeMin: 20,
    sizeMax: 28,
    tint: {
      waiting: 'rgba(255, 230, 120, 0.50)', // yellow (scheduled)
      playing: 'rgba(120, 200, 255, 0.55)', // cyan/blue (running)
      done:    'rgba(140, 235, 170, 0.55)', // green (finished)
      warn:    'rgba(255, 120, 120, 0.55)'  // red (no start >130s)
    }
  }
};

/* --------------------------
   Layers
--------------------------- */
// Root the leaves remain in the iframe (environment.html). We keep this node
// for any future back-layer needs, but poem/reveal go to top overlay layers.
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

// Poem layer: attach directly to BODY, fixed, above main content.
const poemLayer = (() => {
  let el = document.getElementById('env-poem');
  if (!el) {
    el = document.createElement('div');
    el.id = 'env-poem';
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      zIndex: String(CFG.z.poem),
      pointerEvents: 'none',
      overflow: 'hidden'
    });
    document.body.appendChild(el);
  }
  return el;
})();

// Bottom reveal layer: also on BODY, centered.
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
   Scoped styles
--------------------------- */
(() => {
  const css = `
  .env-poem-line {
    position: absolute;
    white-space: nowrap;
    color: ${CFG.colors.poemLine};
    text-shadow: 0 1px 3px ${CFG.colors.poemShadow};
    opacity: 0.0;
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
    text-align: center; /* center content inside the bar */
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
const poemStatus = { state: 'waiting', set(next){ this.state = next; } };

/* --------------------------
   Poem: drifting lines
--------------------------- */
async function runPoemDrift() {
  try {
    const t0 = randi(0, CFG.poem.firstLineDelayMaxMs);
    let started = false;

    // Watchdog (optional visual signal via butterfly tint)
    (async () => { await wait(130_000); if (!started) poemStatus.set('warn'); })();

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

  // Random vertical band; avoid very top UI
  const minY = 90;
  const maxY = Math.max(minY + 60, window.innerHeight - 100);
  const y = randi(minY, maxY);
  el.style.top = `${y}px`;

  // Start just off-screen left; make sure they’re readable immediately.
  const approximateWidth = Math.max(200, text.length * (fontSize * 0.62));
  const startX = -approximateWidth;           // off-screen
  const endX   = window.innerWidth + 80;      // off-screen right

  poemLayer.appendChild(el);

  const dur = CFG.poem.driftDurationMs;
  const fadeEdge = clamp(CFG.poem.fadeEdge, 0.05, 0.3); // 5–30% window
  const t0 = performance.now();

  function step(t) {
    const k = clamp((t - t0) / dur, 0, 1);
    const x = startX + (endX - startX) * k;
    el.style.transform = `translate(${x}px, 0)`;

    // Smooth fade near edges (visible earlier)
    let o = 1;
    if (k < fadeEdge) o = k / fadeEdge;
    else if (k > 1 - fadeEdge) o = (1 - k) / fadeEdge;
    el.style.opacity = String(o);

    if (k < 1) requestAnimationFrame(step);
    else el.remove();
  }
  requestAnimationFrame(step);
}

/* --------------------------
   Bottom reveal (word-by-word, phased)
--------------------------- */
async function runRevealSequence() {
  const bar = document.createElement('div');
  bar.className = 'env-reveal-bar';
  revealLayer.appendChild(bar);

  // Build lines/words with explicit spacing nodes for reliable gaps
  const lines = CFG.poem.lines.map(line => {
    const lineEl = document.createElement('span');
    lineEl.className = 'env-reveal-line';

    const rawWords = line.split(' ');
    const words = [];

    rawWords.forEach((w, idx) => {
      const span = document.createElement('span');
      span.className = 'env-reveal-word';
      span.textContent = w;
      lineEl.appendChild(span);
      words.push(span);

      // add an explicit space node between words to avoid any spacing collapse
      if (idx < rawWords.length - 1) {
        lineEl.appendChild(document.createTextNode(' '));
      }
    });

    bar.appendChild(lineEl);
    return { lineEl, words };
  });

  bar.style.display = 'block';

  // Phase A: 1→2
  await revealWords(lines[0].words, 0.5 * CFG.reveal.wordFadeTotalMs);
  await crossoverFade(lines[0].words, lines[1].words, 0.5 * CFG.reveal.wordFadeTotalMs);

  // Phase B: 2→3 then 3→4
  await crossoverFade(lines[1].words, lines[2].words, 0.5 * CFG.reveal.wordFadeTotalMs);
  await crossoverFade(lines[2].words, lines[3].words, 0.5 * CFG.reveal.wordFadeTotalMs);

  // Fade out the last line
  await fadeWords(lines[3].words, 0.5 * CFG.reveal.wordFadeTotalMs);

  bar.remove();
}

// Smooth reveal: apply transition, then flip opacity on next frame
async function revealWords(words, totalMs) {
  const per = totalMs / Math.max(1, words.length);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    w.style.transition = 'opacity 600ms cubic-bezier(.22,.61,.36,1), transform 600ms cubic-bezier(.22,.61,.36,1)';
    // ensure transition is registered before style change
    await new Promise(r => requestAnimationFrame(r));
    w.style.opacity = '1';
    w.style.transform = 'translateY(0px)';
    await wait(per);
  }
}

// Crossfade word-by-word: next-frame commit to avoid “popping”
async function crossoverFade(outgoingWords, incomingWords, totalMs) {
  const steps = Math.max(outgoingWords.length, incomingWords.length);
  const per = totalMs / Math.max(1, steps);

  for (let i = 0; i < steps; i++) {
    if (i < incomingWords.length) {
      const wIn = incomingWords[i];
      wIn.style.transition = 'opacity 600ms cubic-bezier(.22,.61,.36,1), transform 600ms cubic-bezier(.22,.61,.36,1)';
      await new Promise(r => requestAnimationFrame(r));
      wIn.style.opacity = '1';
      wIn.style.transform = 'translateY(0px)';
    }
    if (i < outgoingWords.length) {
      const wOut = outgoingWords[i];
      wOut.style.transition = 'opacity 600ms cubic-bezier(.22,.61,.36,1), transform 600ms cubic-bezier(.22,.61,.36,1)';
      await new Promise(r => requestAnimationFrame(r));
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
    w.style.transition = 'opacity 600ms cubic-bezier(.22,.61,.36,1), transform 600ms cubic-bezier(.22,.61,.36,1)';
    await new Promise(r => requestAnimationFrame(r));
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
    zIndex: String(CFG.z.poem), // weave above content but below reveal bar
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

  document.body.appendChild(el);

  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -40 : (window.innerWidth + 40);
  const endX   = fromLeft ? (window.innerWidth + 40) : -40;
  const baseTop = parseFloat(el.style.top);
  const travelMs = randi(CFG.butterflies.travelMsMin, CFG.butterflies.travelMsMax);
  const t0 = performance.now();

  function anim(t) {
    const k = clamp((t - t0) / travelMs, 0, 1);
    const x = startX + (endX - startX) * k;
    const flutterY = Math.sin(k * Math.PI * 3) * 40;
    const y = baseTop + flutterY;
    el.style.transform = `translate(${x}px, ${y - baseTop}px)`;
    if (k < 1) requestAnimationFrame(anim);
    else el.remove();
  }
  requestAnimationFrame(anim);
}

async function runButterfliesLoop() {
  await wait(randi(6_000, 14_000)); // early status ping
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
