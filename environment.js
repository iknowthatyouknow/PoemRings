/* environment.js
   Background “wind + leaves” + Poem-in-the-Wind + Recap
   RULESET: No changes to index.html. This file only augments the background.
*/

/* =========================
   Config (timings & layers)
   ========================= */
const CFG = {
  // Leaves (unchanged defaults)
  leaves: {
    spawnMsMin: 600,
    spawnMsMax: 1400,
    zIndex: 1
  },

  // Poem drift (line-by-line floating across the screen)
  drift: {
    // NEW: first line appears within 120s of page load, not immediately
    initialDelayMinMs: 10_000,   // 10s (never immediate)
    initialDelayMaxMs: 120_000,  // 120s

    // subsequent line gaps (unchanged as requested)
    gapMinMs: 6_000,             // 6s
    gapMaxMs: 9_000,             // 9s

    // per-line travel time across the screen
    travelMinMs: 10_000,
    travelMaxMs: 12_000,

    // visual
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans"',
    fontSizeMin: 16,  // px
    fontSizeMax: 22,  // px
    color: 'rgba(255,255,255,0.92)',    // brighter than leaves
    textShadow:
      '0 0 8px rgba(255,255,255,0.25), 0 2px 10px rgba(0,0,0,0.45)',
    zIndex: 3, // above leaves, below UI
  },

  // Recap (word-by-word row at the bottom) — unchanged
  recap: {
    bottomOffsetPx: 18,
    maxWidthPx: 920,
    // Each 2-line pair consumes ~15s total (as previously designed)
    perPairTotalMs: 15_000,
    afterLastDriftPauseMs: 30_000,
    wordFadeInMs: 260,     // tuned for smooth cadence
    wordFadeOutMs: 260,
    interWordGapMs: 120
  }
};

/* =========================
   Helpers
   ========================= */
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

/* =========================
   DOM layers
   ========================= */
let root, leavesLayer, poemLayer, recapLayer;

function ensureLayers() {
  if (root) return;

  root = document.createElement('div');
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '0' // container stays behind site UI; sublayers manage their own z
  });

  // Leaves layer (existing behavior remains unchanged)
  leavesLayer = document.createElement('div');
  Object.assign(leavesLayer.style, {
    position: 'absolute',
    inset: '0',
    zIndex: String(CFG.leaves.zIndex),
    pointerEvents: 'none',
    overflow: 'hidden'
  });

  // Poem drift layer (our moving lines left → right)
  poemLayer = document.createElement('div');
  Object.assign(poemLayer.style, {
    position: 'absolute',
    inset: '0',
    zIndex: String(CFG.drift.zIndex),
    pointerEvents: 'none',
    overflow: 'hidden'
  });

  // Recap layer (bottom row, word-by-word)
  recapLayer = document.createElement('div');
  Object.assign(recapLayer.style, {
    position: 'absolute',
    left: '0',
    right: '0',
    bottom: `${CFG.recap.bottomOffsetPx}px`,
    display: 'flex',
    justifyContent: 'center',
    zIndex: String(Math.max(CFG.drift.zIndex, CFG.leaves.zIndex) + 1),
    pointerEvents: 'none'
  });

  document.body.appendChild(root);
  root.appendChild(leavesLayer);
  root.appendChild(poemLayer);
  root.appendChild(recapLayer);
}

/* =========================
   Leaves (unchanged effects)
   ========================= */
function spawnLeaf() {
  const el = document.createElement('div');
  const size = randi(8, 18);
  el.textContent = '🍂';
  Object.assign(el.style, {
    position: 'absolute',
    left: `${randi(-40, window.innerWidth + 40)}px`,
    top: `-40px`,
    fontSize: `${size}px`,
    filter: 'blur(0.2px)',
    opacity: String(rand(0.6, 0.9)),
    transform: `rotate(${randi(-30, 30)}deg)`,
    transition: 'transform 0.2s linear'
  });

  leavesLayer.appendChild(el);

  const driftX = randi(-60, 60);
  const fallMs = randi(6000, 11000);

  const start = performance.now();
  function anim(t) {
    const k = Math.min(1, (t - start) / fallMs);
    const y = k * (window.innerHeight + 80);
    const x = parseFloat(el.style.left) + driftX * Math.sin(k * Math.PI);
    el.style.transform = `translate(${x - parseFloat(el.style.left)}px, ${y}px) rotate(${randi(-25,25)}deg)`;
    if (k < 1) requestAnimationFrame(anim);
    else el.remove();
  }
  requestAnimationFrame(anim);
}

async function runLeavesLoop() {
  while (true) {
    spawnLeaf();
    await wait(randi(CFG.leaves.spawnMsMin, CFG.leaves.spawnMsMax));
  }
}

/* =========================
   Poem content
   ========================= */
const POEM_LINES = [
  "Falling in love was never the plan,",
  "Like leaves in the wind, it softly began,",
  "You became the current that carried me through,",
  "Love is the wind, and the wind is you."
];

/* =========================
   Poem drift (left → right)
   ========================= */
function createDriftLineEl(text) {
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, {
    position: 'absolute',
    left: `-100vw`, // start fully off-screen left
    top: `${randi(12, Math.max(48, window.innerHeight - 120))}px`, // random vertical band
    whiteSpace: 'nowrap',
    fontFamily: CFG.drift.fontFamily,
    fontWeight: '700',
    fontSize: `${randi(CFG.drift.fontSizeMin, CFG.drift.fontSizeMax)}px`,
    letterSpacing: '0.2px',
    color: CFG.drift.color,
    textShadow: CFG.drift.textShadow,
    opacity: '0.96',
    willChange: 'transform, opacity'
  });
  return el;
}

function animateLeftToRight(el, durationMs) {
  // Measure approximate width after paint
  poemLayer.appendChild(el);
  const textWidth = Math.ceil(el.getBoundingClientRect().width) || 600;
  const startX = -textWidth - 40;
  const endX = window.innerWidth + 40;
  const start = performance.now();

  function step(t) {
    const k = Math.min(1, (t - start) / durationMs);
    const x = startX + (endX - startX) * k;
    el.style.transform = `translateX(${x}px)`;
    if (k < 1) requestAnimationFrame(step);
    else el.remove();
  }
  requestAnimationFrame(step);
}

async function runDriftSequence() {
  // NEW: random initial delay (10s..120s)
  const firstDelay = randi(CFG.drift.initialDelayMinMs, CFG.drift.initialDelayMaxMs);
  await wait(firstDelay);

  for (let i = 0; i < POEM_LINES.length; i++) {
    const line = POEM_LINES[i];
    const el = createDriftLineEl(line);
    animateLeftToRight(el, randi(CFG.drift.travelMinMs, CFG.drift.travelMaxMs));

    if (i < POEM_LINES.length - 1) {
      await wait(randi(CFG.drift.gapMinMs, CFG.drift.gapMaxMs)); // 6–9s
    }
  }
}

/* =========================
   Recap row (unchanged flow)
   ========================= */
function buildRecapContainer() {
  const box = document.createElement('div');
  Object.assign(box.style, {
    maxWidth: `${CFG.recap.maxWidthPx}px`,
    width: 'min(92vw, 920px)',
    textAlign: 'center',
    fontFamily: CFG.drift.fontFamily,
    fontSize: '16px',
    color: 'rgba(235,240,255,0.92)',
    textShadow: '0 1px 2px rgba(0,0,0,0.45)',
    lineHeight: '1.35',
  });
  recapLayer.appendChild(box);
  return box;
}

function setRecapHTML(box, html) {
  box.innerHTML = html;
}

function createWordSpan(word) {
  const s = document.createElement('span');
  s.textContent = word + ' ';
  s.style.opacity = '0';
  s.style.transition = `opacity ${CFG.recap.wordFadeInMs}ms linear`;
  return s;
}

async function fadeWordsIn(container, words) {
  for (let i = 0; i < words.length; i++) {
    const w = createWordSpan(words[i]);
    container.appendChild(w);
    // force style flush
    // eslint-disable-next-line no-unused-expressions
    w.offsetWidth;
    w.style.opacity = '1';
    await wait(CFG.recap.interWordGapMs);
  }
}

async function fadeWordsOut(container, fromIndex = 0) {
  const spans = Array.from(container.querySelectorAll('span'));
  for (let i = fromIndex; i < spans.length; i++) {
    const w = spans[i];
    w.style.transition = `opacity ${CFG.recap.wordFadeOutMs}ms linear`;
    w.style.opacity = '0';
    await wait(CFG.recap.interWordGapMs);
  }
  // cleanup after fade
  await wait(CFG.recap.wordFadeOutMs + 60);
  container.innerHTML = '';
}

async function runRecap() {
  // Wait after the last drifted line finishes
  await wait(CFG.recap.afterLastDriftPauseMs);

  const box = buildRecapContainer();

  // Pair A: L1 (front) with L2 (middle)
  const partA = document.createElement('div');
  const partB = document.createElement('div');
  setRecapHTML(box, '');
  box.appendChild(partA);
  box.appendChild(partB);

  const L1 = POEM_LINES[0].replace(/\s+/g, ' ').trim().split(' ');
  const L2 = POEM_LINES[1].replace(/\s+/g, ' ').trim().split(' ');
  const L3 = POEM_LINES[2].replace(/\s+/g, ' ').trim().split(' ');
  const L4 = POEM_LINES[3].replace(/\s+/g, ' ').trim().split(' ');

  // L1 in, then interleave L2 in while L1 fades out word-by-word
  const pairTotal = CFG.recap.perPairTotalMs;
  const halfPair = pairTotal / 2;

  // Start L1 fade-in words
  const t0 = performance.now();
  await fadeWordsIn(partA, L1);

  // Begin L2; when the first word of L2 appears, start fading out L1 word-by-word
  let startedL1Out = false;
  for (let i = 0; i < L2.length; i++) {
    const w = createWordSpan(L2[i]);
    partB.appendChild(w);
    // show the word
    // eslint-disable-next-line no-unused-expressions
    w.offsetWidth;
    w.style.opacity = '1';

    if (!startedL1Out) {
      startedL1Out = true;
      // fade out L1 in sync, one-by-one
      fadeWordsOut(partA, 0);
    }
    await wait(CFG.recap.interWordGapMs);
  }

  // Ensure pair A lasts ~15s total (from t0)
  const elapsedA = performance.now() - t0;
  if (elapsedA < halfPair) await wait(halfPair - elapsedA);

  // Pair B: L3 interleaves in while L2 fades out
  const t1 = performance.now();
  const partC = document.createElement('div');
  box.appendChild(partC);

  // Start L3 in, and begin fading out L2 as soon as L3 starts
  let startedL2Out = false;
  for (let i = 0; i < L3.length; i++) {
    const w = createWordSpan(L3[i]);
    partC.appendChild(w);
    // show the word
    // eslint-disable-next-line no-unused-expressions
    w.offsetWidth;
    w.style.opacity = '1';

    if (!startedL2Out) {
      startedL2Out = true;
      fadeWordsOut(partB, 0);
    }
    await wait(CFG.recap.interWordGapMs);
  }

  // Hold timing so pair B (L3 in while L2 out) totals ~15s
  const elapsedB = performance.now() - t1;
  if (elapsedB < halfPair) await wait(halfPair - elapsedB);

  // Final: L4 in, then L3 fades out; after L4 fully visible, fade it away too.
  const partD = document.createElement('div');
  box.appendChild(partD);

  let startedL3Out = false;
  for (let i = 0; i < L4.length; i++) {
    const w = createWordSpan(L4[i]);
    partD.appendChild(w);
    // show the word
    // eslint-disable-next-line no-unused-expressions
    w.offsetWidth;
    w.style.opacity = '1';

    if (!startedL3Out) {
      startedL3Out = true;
      fadeWordsOut(partC, 0);
    }
    await wait(CFG.recap.interWordGapMs);
  }

  // After L4 is fully shown, fade it out word-by-word and finish
  await wait(600);
  await fadeWordsOut(partD, 0);

  // Clean up row
  await wait(200);
  recapLayer.innerHTML = '';
}

/* =========================
   Orchestration
   ========================= */
async function main() {
  ensureLayers();

  // Start leaves immediately (unchanged)
  runLeavesLoop(); // no await

  // Start poem drift with new initial randomized delay (10–120s)
  (async () => {
    await runDriftSequence();
    // After drift finishes, keep prior behavior: recap after 30s
    await runRecap();
    // Reset only on next page refresh per ruleset — do not loop.
  })();
}

/* Kick off */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
