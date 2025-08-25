/* =========================================================================
   environment.js  (NO HTML TAGS IN THIS FILE)
   - Wind controls drift speed (poem lines & butterflies)
   - Breath controls butterfly oscillation (amplitude & waves)
   - Lines spawn distance-based (next at 70% progress)
   - Final reveal word-by-word with true spacing (whitespace preserved)
   - Special poem suspension respected (begin/end)
   - Butterfly proximity interaction
   - Initial random kickoff (0–120s) + Rez clock-aligned repeats
   ======================================================================== */

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Shared state (fallbacks if controller not yet present) */
window.__WINDS_SONG__ = window.__WINDS_SONG__ || { wind: 2, breath: 20, elegra: 15, rez: 1 };
function windFactor() {
  // Keep aligned with environment.html (leaves) convention: 5 => 1.0
  const w = Number(window.__WINDS_SONG__.wind ?? 2);
  return clamp(w / 5, 0.1, 3.0);
}

/* Live updates / triggers */
window.addEventListener('windsong:update', (e) => {
  const prevRez = Number(window.__WINDS_SONG__.rez ?? 1);
  const d = e.detail || {};
  if ('wind'   in d) window.__WINDS_SONG__.wind   = Number(d.wind);
  if ('breath' in d) window.__WINDS_SONG__.breath = Number(d.breath);
  if ('elegra' in d) window.__WINDS_SONG__.elegra = Number(d.elegra);
  if ('rez'    in d) window.__WINDS_SONG__.rez    = Number(d.rez);

  // If Rez changed, rebuild the clock-aligned scheduler
  const nextRez = Number(window.__WINDS_SONG__.rez ?? 1);
  if (nextRez !== prevRez) {
    teardownRezTimers();
    setupRezTimers();
  }
});
window.addEventListener('windsong:trigger', () => { if (!specialPoemActive) tryStartWindSong(); });

/* Special poem suspension */
let specialPoemActive = false;
window.addEventListener('special-poem:begin', () => {
  specialPoemActive = true;
  abortReveal();
  fadeOutAllDrifting();
});
window.addEventListener('special-poem:end', () => {
  specialPoemActive = false;
  // No immediate restart here:
  //  - Rez>1: next clock slot will run automatically
  //  - Rez=1: only on refresh (design intent)
});

/* Visual tokens */
const CFG = {
  z: { leaves: 2, poem: 3, reveal: 4, debug: 9 },
  colors: {
    poemLine: '#ffffff',
    poemShadow: 'rgba(0,0,0,.35)',
    reveal: '#ffffff',
    status: { waiting: 'rgba(255, 230, 120, 0.55)', playing: 'rgba(255, 120, 120, 0.60)', done: 'rgba(140, 235, 170, 0.60)' },
    palette: ['#d24ee6', '#7e5bef', '#4fc3f7', '#ff8a65', '#ffca28', '#66bb6a', '#ec407a', '#42a5f5']
  },
  poem: {
    lines: [
      "Falling in love was never the plan,",
      "Like leaves dancing in the wind, it softly began,",
      "Your breath brushed my world into motion,",
      "For life’s breath is the wind, and your breath its creation."
    ],
    baseDriftDurationMs: 32000, // at wind=5
    minY: 90,
    bottomPad: 100
  },
  reveal: {
    extraWaitAfterLastLineMs: 60000, // 60s after last line exits
    rowPadding: 10,
    fontSizePx: 16,
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    baseMinMs: 60000,
    baseMaxMs: 90000,
    baseTravelMsMin: 18000,
    baseTravelMsMax: 26000,
    sizeMin: 20,
    sizeMax: 28,
    flutterMarginTop: 40,
    flutterMarginBottom: 120,
    interactionRadius: 55,
    interactionChance: 0.6,
    interactionDurationMs: 1500,
    interactionOrbitMin: 28,
    interactionOrbitMax: 34
  }
};

/* Layers */
const envRoot = (() => {
  let el = document.getElementById('env-root');
  if (!el) { el = document.createElement('div'); el.id='env-root';
    Object.assign(el.style,{position:'fixed',inset:'0',zIndex:'0',pointerEvents:'none'});
    document.body.appendChild(el); }
  return el;
})();
const leavesLayer = (() => {
  let el = document.getElementById('env-leaves');
  if (!el) { el = document.createElement('div'); el.id='env-leaves';
    Object.assign(el.style,{position:'absolute',inset:'0',zIndex:String(CFG.z.leaves),pointerEvents:'none'});
    envRoot.appendChild(el); }
  return el;
})();
const poemLayer = (() => {
  let el = document.getElementById('env-poem');
  if (!el) { el = document.createElement('div'); el.id='env-poem';
    Object.assign(el.style,{position:'absolute',inset:'0',zIndex:String(CFG.z.poem),pointerEvents:'none',overflow:'hidden'});
    envRoot.appendChild(el); }
  return el;
})();
const revealLayer = (() => {
  let el = document.getElementById('env-reveal');
  if (!el) { el = document.createElement('div'); el.id='env-reveal';
    Object.assign(el.style,{position:'fixed',left:'0',right:'0',bottom:'0',zIndex:String(CFG.z.reveal),
                            pointerEvents:'none',display:'flex',justifyContent:'center'});
    document.body.appendChild(el); }
  return el;
})();

/* CSS (spacing baked in via word tokenization + letter-spacing:0) */
(()=>{ const css = `
  .env-poem-line{position:absolute;white-space:nowrap;color:${CFG.colors.poemLine};
    text-shadow:0 1px 3px ${CFG.colors.poemShadow};opacity:.95;font-weight:600;letter-spacing:.2px;
    user-select:none;will-change:transform,opacity;pointer-events:none;}
  .env-reveal-bar{max-width:980px;width:calc(100vw - 24px);margin:0 12px 10px;
    background:${CFG.reveal.barBg};border:${CFG.reveal.border};border-radius:10px;
    padding:${CFG.reveal.rowPadding}px 14px;color:${CFG.colors.reveal};
    font-size:${CFG.reveal.fontSizePx}px;line-height:1.4;letter-spacing:0;display:none;text-align:center;}
  .env-reveal-line{display:inline-block;margin-right:.6em;white-space:nowrap;opacity:1;}
  .env-reveal-word{display:inline-block;opacity:0;will-change:opacity,transform;transform:translateY(4px);}
`; const tag=document.createElement('style'); tag.textContent=css; document.head.appendChild(tag);})();

/* Poem status (drives butterfly status tints) */
const poemStatus = { state:'waiting', set(next){ this.state = next; } };

/* --- Wind’s Song: drifting (distance based) --- */
let windsongRunInProgress = false;
let activeDrifts = [];
function fadeOutAllDrifting(){
  activeDrifts.forEach(d => d.abort && d.abort());
  activeDrifts = [];
}
async function tryStartWindSong(){
  if (windsongRunInProgress || specialPoemActive) return;
  runWindSong();
}
async function runWindSong(){
  if (windsongRunInProgress || specialPoemActive) return;
  windsongRunInProgress = true;
  poemStatus.set('playing');
  try{
    const lines = CFG.poem.lines.slice();
    let lastCtrl = null;

    for (let i=0;i<lines.length;i++){
      const ctrl = spawnDriftingLine(lines[i]);
      activeDrifts.push(ctrl);
      if (lastCtrl){ await lastCtrl.waitProgress(0.70); }
      lastCtrl = ctrl;
    }

    if (lastCtrl) { await lastCtrl.done; }
    await wait(CFG.reveal.extraWaitAfterLastLineMs);
    if (!specialPoemActive) { await runRevealSequence(); }

    poemStatus.set('done');
  } catch(e){
    console.warn('WindSong run error:', e);
    poemStatus.set('waiting');
  } finally {
    windsongRunInProgress = false;
    activeDrifts = [];
  }
}

function spawnDriftingLine(text){
  const el = document.createElement('div');
  el.className='env-poem-line'; el.textContent=text;
  const fs = randi(13, 16);
  el.style.fontSize = fs+'px';

  const minY = CFG.poem.minY;
  const maxY = Math.max(minY+60, window.innerHeight - CFG.poem.bottomPad);
  const topY = randi(minY, maxY);
  el.style.top = topY+'px';

  const startX = -Math.max(120, text.length*(fs*0.6));
  const endX   = window.innerWidth + 80;

  poemLayer.appendChild(el);

  const wf = windFactor();
  const driftMs = Math.max(1000, Math.round(CFG.poem.baseDriftDurationMs / wf));
  const t0 = performance.now();
  let aborted = false;

  let doneResolve; const done = new Promise(res => (doneResolve = res));

  function getProgress(now){
    return clamp((now - t0)/driftMs, 0, 1);
  }

  function step(now){
    if (aborted) { el.remove(); doneResolve(); return; }
    const k = getProgress(now);
    const x = startX + (endX - startX)*k;
    el.style.transform = `translate(${x}px,0)`;

    const fi = Math.min(1, k/0.20), fo = Math.min(1, (1-k)/0.20);
    el.style.opacity = String(0.95 * Math.min(fi, fo));

    if (k < 1 && !specialPoemActive) {
      requestAnimationFrame(step);
    } else {
      el.remove(); doneResolve();
    }
  }
  requestAnimationFrame(step);

  return {
    waitProgress: (threshold=0.7) => new Promise(res=>{
      function check(){
        const now = performance.now();
        const k = getProgress(now);
        if (k >= threshold || aborted || specialPoemActive) res();
        else requestAnimationFrame(check);
      }
      requestAnimationFrame(check);
    }),
    abort: ()=>{ aborted = true; },
    done
  };
}

/* --- Final reveal (word-by-word with perfect spacing) --- */
let revealAbortCtl = { aborted:false };
function abortReveal(){
  revealAbortCtl.aborted = true;
  const bar = document.querySelector('.env-reveal-bar');
  if (bar) bar.remove();
  revealAbortCtl = { aborted:false };
}
function tokenizeWords(line){
  // Returns array of {span, space?TextNode} preserving original whitespace
  const out = [];
  const re = /(\S+)(\s*)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const word = m[1], spaces = m[2] || '';
    const w = document.createElement('span');
    w.className = 'env-reveal-word';
    w.textContent = word;
    out.push({ span: w, space: spaces ? document.createTextNode(spaces) : null });
  }
  return out;
}
async function runRevealSequence(){
  const elegraS = Number(window.__WINDS_SONG__.elegra ?? 15);
  const pairTotalMs = Math.max(1000, Math.round(elegraS*1000));
  const half = 0.5 * pairTotalMs;

  const bar = document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);

  const tokenLines = CFG.poem.lines.map(line=>{
    const lineEl = document.createElement('span'); lineEl.className='env-reveal-line';
    const tokens = tokenizeWords(line);
    tokens.forEach(t => { lineEl.appendChild(t.span); if (t.space) lineEl.appendChild(t.space); });
    bar.appendChild(lineEl);
    return tokens.map(t => t.span);
  });

  bar.style.display = 'block';
  const ctl = revealAbortCtl;

  async function revealWords(words,totalMs){
    const per = totalMs / Math.max(1, words.length);
    for (let i=0;i<words.length;i++){
      if (ctl.aborted || specialPoemActive) return;
      const w = words[i];
      w.style.transition = 'opacity 600ms ease, transform 600ms ease';
      w.style.opacity ='1'; w.style.transform='translateY(0px)';
      await wait(per);
    }
  }
  async function crossover(outgoing,incoming,totalMs){
    const steps = Math.max(outgoing.length, incoming.length);
    const per = totalMs / Math.max(1, steps);
    for (let i=0;i<steps;i++){
      if (ctl.aborted || specialPoemActive) return;
      if (i<incoming.length){
        const wIn = incoming[i];
        wIn.style.transition='opacity 600ms ease, transform 600ms ease';
        wIn.style.opacity='1'; wIn.style.transform='translateY(0px)';
      }
      if (i<outgoing.length){
        const wOut = outgoing[i];
        wOut.style.transition='opacity 600ms ease, transform 600ms ease';
        wOut.style.opacity='0'; wOut.style.transform='translateY(4px)';
      }
      await wait(per);
    }
  }
  async function fadeWords(words,totalMs){
    const per = totalMs / Math.max(1, words.length);
    for (let i=0;i<words.length;i++){
      if (ctl.aborted || specialPoemActive) return;
      const w = words[i];
      w.style.transition='opacity 600ms ease, transform 600ms ease';
      w.style.opacity='0'; w.style.transform='translateY(4px)';
      await wait(per);
    }
  }

  await revealWords(tokenLines[0], half);
  if (ctl.aborted || specialPoemActive) { bar.remove(); return; }
  await crossover(tokenLines[0], tokenLines[1], half);
  if (ctl.aborted || specialPoemActive) { bar.remove(); return; }
  await crossover(tokenLines[1], tokenLines[2], half);
  if (ctl.aborted || specialPoemActive) { bar.remove(); return; }
  await crossover(tokenLines[2], tokenLines[3], half);
  if (ctl.aborted || specialPoemActive) { bar.remove(); return; }
  await fadeWords(tokenLines[3], half);
  if (ctl.aborted || specialPoemActive) { bar.remove(); return; }

  bar.remove();
}

/* --- Butterflies (ambient with proximity interaction) --- */
const butterflies = new Map(); // id -> state
let butterflySeq = 1;

function currentButterflyTint(){
  switch (poemStatus.state) {
    case 'playing': return CFG.colors.status.playing; // red
    case 'done':    return CFG.colors.status.done;    // green
    case 'waiting': default: return CFG.colors.status.waiting; // yellow
  }
}
function randomPaletteTint(){
  if (poemStatus.state === 'done' && Math.random() < 0.65) {
    return CFG.colors.palette[randi(0, CFG.colors.palette.length-1)];
  }
  return currentButterflyTint();
}

function spawnButterfly(){
  const id = butterflySeq++;
  const size = randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);
  const el = document.createElement('div');
  Object.assign(el.style, {
    position:'absolute', left:'0px', width:`${size}px`, height:`${size}px`,
    opacity:'1', pointerEvents:'none', zIndex:String(CFG.z.leaves), willChange:'transform'
  });

  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -40 : (window.innerWidth + 40);
  const endX   = fromLeft ? (window.innerWidth + 40) : -40;

  const topMargin = CFG.butterflies.flutterMarginTop;
  const bottomMargin = CFG.butterflies.flutterMarginBottom;
  const baseTop = randi(topMargin, Math.max(topMargin+80, window.innerHeight - bottomMargin));

  const wf = windFactor();
  const base = randi(CFG.butterflies.baseTravelMsMin, CFG.butterflies.baseTravelMsMax);
  const travelMs = Math.max(800, Math.round(base / wf));
  const tStart = performance.now();

  // Breath mapping: amplitude and wave count
  const breath = clamp(Number(window.__WINDS_SONG__.breath ?? 20), 0, 100);
  const maxAmp = Math.min(baseTop - topMargin, (window.innerHeight - bottomMargin) - baseTop);
  const amp = clamp((breath / 100) * maxAmp, 6, Math.max(12, maxAmp));
  const waves = 1 + 3 * (breath / 100);

  const tint = randomPaletteTint();
  el.innerHTML = `
  <svg viewBox="0 0 120 80" width="${size}" height="${size}" style="display:block">
    <defs>
      <filter id="bshadow-${id}" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
    </defs>
    <g filter="url(#bshadow-${id})">
      <path d="M60,40 C30,5 5,5 10,35 C15,60 35,55 60,40 Z" fill="${tint}" />
      <path d="M60,40 C90,5 115,5 110,35 C105,60 85,55 60,40 Z" fill="${tint}" />
      <rect x="57" y="35" width="6" height="16" rx="3" fill="rgba(30,40,60,0.6)"/>
    </g>
  </svg>`;
  leavesLayer.appendChild(el);

  const state = {
    id, el, fromLeft, startX, endX, baseTop, size,
    tStart, travelMs, amp, waves,
    interactingUntil: 0,
    interactCenter: null,
    interactAngle0: 0,
    interactOrbit: 0,
    partnerId: null,
    removed: false
  };
  butterflies.set(id, state);

  function anim(now){
    if (state.removed) return;

    // interaction orbit
    if (now < state.interactingUntil && state.interactCenter) {
      const t = (now - (state.interactingUntil - CFG.butterflies.interactionDurationMs)) / CFG.butterflies.interactionDurationMs;
      const angle = state.interactAngle0 + (state.id % 2 ? 1 : -1) * (Math.PI * 2) * t;
      const cx = state.interactCenter.x + Math.cos(angle) * state.interactOrbit;
      const cy = state.interactCenter.y + Math.sin(angle) * state.interactOrbit;
      state.el.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px)`;
      requestAnimationFrame(anim);
      return;
    } else if (state.partnerId && now >= state.interactingUntil) {
      state.partnerId = null;
      state.interactCenter = null;
    }

    // normal flight
    const k = clamp((now - state.tStart)/state.travelMs, 0, 1);
    const x = state.startX + (state.endX - state.startX) * k;
    const y = state.baseTop + Math.sin(k * Math.PI * state.waves) * state.amp;
    state.el.style.transform = `translate(${x}px, ${y}px)`;

    if (k < 1) {
      checkInteraction(state, now);
      requestAnimationFrame(anim);
    } else {
      state.el.remove(); state.removed = true; butterflies.delete(state.id);
    }
  }
  requestAnimationFrame(anim);
}

function checkInteraction(a, now){
  if (a.partnerId || now < a.interactingUntil) return;
  const rect = a.el.getBoundingClientRect();
  const ax = rect.left + rect.width/2;
  const ay = rect.top + rect.height/2;

  for (const [id, b] of butterflies){
    if (id === a.id || b.partnerId || now < b.interactingUntil) continue;
    const br = b.el.getBoundingClientRect();
    const bx = br.left + br.width/2;
    const by = br.top + br.height/2;

    const dx = ax - bx, dy = ay - by;
    const dist = Math.hypot(dx, dy);
    if (dist <= CFG.butterflies.interactionRadius){
      if (Math.random() < CFG.butterflies.interactionChance){
        const center = { x: (ax+bx)/2, y: (ay+by)/2 };
        const orbit = rand(CFG.butterflies.interactionOrbitMin, CFG.butterflies.interactionOrbitMax);
        const until = now + CFG.butterflies.interactionDurationMs;

        a.interactCenter = center; b.interactCenter = center;
        a.interactingUntil = until; b.interactingUntil = until;
        a.partnerId = b.id; b.partnerId = a.id;

        a.interactAngle0 = Math.atan2(ay - center.y, ax - center.x);
        b.interactAngle0 = Math.atan2(by - center.y, bx - center.x) + Math.PI;
        a.interactOrbit = orbit; b.interactOrbit = orbit;
      }
      break;
    }
  }
}

async function butterfliesLoop(){
  await wait(randi(6000, 14000));
  spawnButterfly();
  while (true){
    await wait(randi(CFG.butterflies.baseMinMs, CFG.butterflies.baseMaxMs));
    spawnButterfly();
  }
}

/* --- Rez clock-aligned scheduler --- */
let rezAnchorTimeout = null;
let rezInterval = null;

function teardownRezTimers(){
  if (rezAnchorTimeout) { clearTimeout(rezAnchorTimeout); rezAnchorTimeout = null; }
  if (rezInterval) { clearInterval(rezInterval); rezInterval = null; }
}
function setupRezTimers(){
  const rez = Number(window.__WINDS_SONG__.rez ?? 1);
  teardownRezTimers();
  if (rez <= 1) return; // once per refresh only

  const intervalMinutes = Math.max(1, Math.floor(60 / rez)); // 2→30, 3→20, 6→10, etc.
  const now = new Date();
  const next = new Date(now.getTime());
  next.setSeconds(0,0);
  const m = now.getMinutes();
  const nextSlotMin = Math.ceil(m / intervalMinutes) * intervalMinutes;
  if (nextSlotMin >= 60) {
    next.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(nextSlotMin, 0, 0);
  }
  const msUntilNext = next.getTime() - now.getTime();

  rezAnchorTimeout = setTimeout(() => {
    tryStartWindSong(); // attempt at the aligned slot
    rezInterval = setInterval(() => { tryStartWindSong(); }, intervalMinutes * 60 * 1000);
  }, msUntilNext);
}

/* --- Initial random kickoff (0–120s) --- */
async function scheduleInitialWindSong(){
  const ms = randi(0, 120000);
  await wait(ms);
  tryStartWindSong();
}

/* Orchestrate */
async function main(){
  // Ambient butterflies always on
  butterfliesLoop();

  // First show: random in [0..120]s
  scheduleInitialWindSong();

  // Then set up Rez clock alignment (if Rez>1)
  setupRezTimers();
}
main();
