/* environment.js
   Background “wind + leaves” + Poem-in-the-Wind + Recap
   RULESET: No changes to index.html. This file only augments the background.
*/

/* =========================
   Config (timings & layers)
   ========================= */
const CFG = {
  // Leaves (unchanged)
  leaves: {
    spawnMsMin: 600,
    spawnMsMax: 1400,
    zIndex: 1
  },

  // Poem drift (line-by-line floating across the screen)
  drift: {
    // First line appears within 10s..120s after load
    initialDelayMinMs: 10_000,
    initialDelayMaxMs: 120_000,

    // Gaps between lines
    gapMinMs: 6_000,
    gapMaxMs: 9_000,

    // Travel time across the screen
    travelMinMs: 10_000,
    travelMaxMs: 12_000,

    // VISUALS
    // Smaller than the ring poem; crisp and readable
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans"',
    fontSizeMin: 14,  // px (smaller than ring lines)
    fontSizeMax: 18,  // px
    color: '#e8ecf4', // same white as your site text
    textShadow:
      '0 0 6px rgba(0,0,0,0.35), 0 2px 10px rgba(0,0,0,0.45)',
    zIndex: 3 // above leaves, below site UI
  },

  // Recap (word-by-word row at the bottom)
  recap: {
    bottomOffsetPx: 18,
    maxWidthPx: 920,
    perPairTotalMs: 15_000,
    afterLastDriftPauseMs: 30_000,
    wordFadeInMs: 260,
    wordFadeOutMs: 260,
    interWordGapMs: 120,
    // Match the ring poem’s size: clamp(18px, 5.2vw, 32px)
    fontSize: 'clamp(18px, 5.2vw, 32px)',
    color: '#e8ecf4'
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
    zIndex: '0'
  });

  // Leaves layer
  leavesLayer = document.createElement('div');
  Object.assign(leavesLayer.style, {
    position: 'absolute',
    inset: '0',
    zIndex: String(CFG.leaves.zIndex),
    pointerEvents: 'none',
    overflow: 'hidden'
  });

  // Poem drift layer
  poemLayer = document.createElement('div');
  Object.assign(poemLayer.style, {
    position: 'absolute',
    inset: '0',
    zIndex: String(CFG.drift.zIndex),
    pointerEvents: 'none',
    overflow: 'hidden'
  });

  // Recap layer (bottom row)
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
    top: `${randi(12, Math.max(48, window.innerHeight - 120))}px`,
    whiteSpace: 'nowrap',
    fontFamily: CFG.drift.fontFamily,
    fontWeight: '700',
    fontSize: `${randi(CFG.drift.fontSizeMin, CFG.drift.fontSizeMax)}px`,
    letterSpacing: '0.2px',
    color: CFG.drift.color,
    textShadow: CFG.drift.textShadow,
    opacity: '1', // fully visible
    willChange: 'transform, opacity'
  });
  return el;
}

function animateLeftToRight(el, durationMs) {
  poemLayer.appendChild(el);
  // measure width after paint
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
  // random initial delay (10s..120s)
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
   Recap row (word-by-word)
   ========================= */
function buildRecapContainer() {
  const box = document.createElement('div');
  Object.assign(box.style, {
    maxWidth: `${CFG.recap.maxWidthPx}px`,
    width: 'min(92vw, 920px)',
    textAlign: 'center',
    fontFamily: CFG.drift.fontFamily,
    fontSize: CFG.recap.fontSize,   // same as ring poem
    color: CFG.recap.color,
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
  await wait(CFG.recap.wordFadeOutMs + 60);
  container.innerHTML = '';
}

async function runRecap() {
  // Wait after last drifting line
  await wait(CFG.recap.afterLastDriftPauseMs);

  const box = buildRecapContainer();

  const partA = document.createElement('div'); // L1
  const partB = document.createElement('div'); // L2
  box.appendChild(partA);
  box.appendChild(partB);

  const L1 = POEM_LINES[0].trim().split(/\s+/);
  const L2 = POEM_LINES[1].trim().split(/\s+/);
  const L3 = POEM_LINES[2].trim().split(/\s+/);
  const L4 = POEM_LINES[3].trim().split(/\s+/);

  const pairTotal = CFG.recap.perPairTotalMs;
  const halfPair = pairTotal / 2;

  // Pair A: L1 in; interleave L2 in, fade out L1 word-by-word
  const t0 = performance.now();
  await fadeWordsIn(partA, L1);

  let startedL1Out = false;
  for (let i = 0; i < L2.length; i++) {
    const w = createWordSpan(L2[i]);
    partB.appendChild(w);
    // eslint-disable-next-line no-unused-expressions
    w.offsetWidth;
    w.style.opacity = '1';

    if (!startedL1Out) {
      startedL1Out = true;
      fadeWordsOut(partA, 0);
    }
    await wait(CFG.recap.interWordGapMs);
  }

  const elapsedA = performance.now() - t0;
  if (elapsedA < halfPair) await wait(halfPair - elapsedA);

  // Pair B: L3 in; fade out L2
  const partC = document.createElement('div'); // L3
  box.appendChild(partC);

  const t1 = performance.now();
  let startedL2Out = false;
  for (let i = 0; i < L3.length; i++) {
    const w = createWordSpan(L3[i]);
    partC.appendChild(w);
    // eslint-disable-next-line no-unused-expressions
    w.offsetWidth;
    w.style.opacity = '1';

    if (!startedL2Out) {
      startedL2Out = true;
      fadeWordsOut(partB, 0);
    }
    await wait(CFG.recap.interWordGapMs);
  }

  const elapsedB = performance.now() - t1;
  if (elapsedB < halfPair) await wait(halfPair - elapsedB);

  // Final: L4 in, fade out L3, then fade out L4
  const partD = document.createElement('div'); // L4
  box.appendChild(partD);

  let startedL3Out = false;
  for (let i = 0; i < L4.length; i++) {
    const w = createWordSpan(L4[i]);
    partD.appendChild(w);
    // eslint-disable-next-line no-unused-expressions
    w.offsetWidth;
    w.style.opacity = '1';

    if (!startedL3Out) {
      startedL3Out = true;
      fadeWordsOut(partC, 0);
    }
    await wait(CFG.recap.interWordGapMs);
  }

  await wait(600);
  await fadeWordsOut(partD, 0);

  // cleanup
  recapLayer.innerHTML = '';
}

/* =========================
   Orchestration
   ========================= */
async function main() {
  ensureLayers();

  // Leaves immediately
  runLeavesLoop();

  // Poem drift after randomized delay, then recap
  (async () => {
    await runDriftSequence();
    await runRecap();
    // Do not loop; show again only on next page refresh
  })();
}

/* Kick off */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
