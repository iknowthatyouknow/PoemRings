/* =========================================================================
   environment.js (final, ruleset-compliant)
   - No index.html changes
   - Wind controls all motion speeds (poem drift & butterflies). Leaves wind
     is handled in environment.html via postMessage from the controller.
   - Breath controls butterfly oscillation (not poem spacing).
   - Poem drifting: inter-line spacing auto-scales with Wind so the visual
     gap stays consistent (baseline ≈ 16s at Wind=5).
   - Bottom reveal:
       • Starts ONLY after the last drifting line has fully exited the screen.
       • Smooth fade-in/out, correct word spacing (always).
       • Elegra slider no longer affects reveal speed (fixed timing here).
       • Suppressed during Special Poem; resume next Wind’s Song cycle.
   - Butterflies:
       • Colors: waiting=yellow, playing=red, done=green; ambient palette after done.
       • Proximity “dance” when within radius (55px) with higher probability
         for first 5 minutes after page load; then normal probability.
       • Special Poem “party”: handled by events from index.js (see notes).
   - Rez: handled by windsong-controller.js; environment honors triggers.
   ======================================================================== */

/* --------------------------
   Utilities
--------------------------- */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* --------------------------
   Restore user settings (if controller loaded earlier)
--------------------------- */
(function restoreWindsSongFromStorage(){
  try {
    const raw = localStorage.getItem('windsong.settings.v1');
    if (!raw) return;
    const s = JSON.parse(raw);
    window.__WINDS_SONG__ = window.__WINDS_SONG__ || {};
    if (s.wind   != null) window.__WINDS_SONG__.wind   = Number(s.wind);
    if (s.breath != null) window.__WINDS_SONG__.breath = Number(s.breath);
    if (s.elegra != null) window.__WINDS_SONG__.elegra = Number(s.elegra);
    if (s.rez    != null) window.__WINDS_SONG__.rez    = Number(s.rez);
  } catch {}
})();

/* --------------------------
   Shared knobs (defaults)
--------------------------- */
window.__WINDS_SONG__ = window.__WINDS_SONG__ || {
  wind:   5,   // 1..10 (5 = baseline speeds)
  breath: 16,  // now butterfly oscillation "strength" (6..30)
  elegra: 15,  // kept for UI, but NOT used for reveal timing anymore
  rez:    1
};

window.addEventListener("windsong:update", (e) => {
  const { wind, breath, elegra, rez } = e.detail || {};
  if (wind   !== undefined) window.__WINDS_SONG__.wind   = Number(wind);
  if (breath !== undefined) window.__WINDS_SONG__.breath = Number(breath);
  if (elegra !== undefined) window.__WINDS_SONG__.elegra = Number(elegra); // ignored for reveal
  if (rez    !== undefined) window.__WINDS_SONG__.rez    = Number(rez);
});

window.addEventListener("windsong:trigger", () => {
  if (typeof runPoemDrift === "function") runPoemDrift();
});

/* Special poem lifecycle signals (sent by index.js) */
let SPECIAL_ACTIVE = false;
window.addEventListener('special-poem:begin', () => {
  SPECIAL_ACTIVE = true;
  cancelBottomReveal(); // if a reveal was pending/showing, fade/clear it
});
window.addEventListener('special-poem:end', () => {
  SPECIAL_ACTIVE = false; // next Wind’s Song cycle will be allowed again
});

/* --------------------------
   Config (visual constants)
--------------------------- */
const CFG = {
  z: { leaves: 2, poem: 3, reveal: 4, debug: 9 },
  colors: { poemLine:'#ffffff', poemShadow:'rgba(0,0,0,.35)', reveal:'#ffffff' },
  poem: {
    lines: [
      "Falling in love was never the plan,",
      "Like leaves dancing in the wind, it softly began,",
      "Your breath brushed my world into motion,",
      "For life’s breath is the wind, and your breath its creation."
    ],
    baseFirstLineDelayMaxMs: 120_000,   // first line appears sometime in 0..120s
    baseDriftDurationMs:     32_000,    // cross-screen time at Wind=5
    driftFontMin: 13, driftFontMax: 16,
    targetVisualGapS: 16                // baseline gap between line spawns when Wind=5
  },
  reveal: {
    // Elegra is FIXED here; slider no longer applies.
    appearCushionMs: 1200,             // extra cushion after last line exits
    wordStepMs: 400,                   // per-word tween step used inside helpers
    pairPhaseMs: 7500                  // each 2-line phase total (slow, smooth)
  },
  butterflies: {
    baseTravelMsMin: 18_000, baseTravelMsMax: 26_000,
    sizeMin: 20, sizeMax: 28,
    flutterWavesBase: 2, flutterAmpBase: 28, // baseline oscillation
    interactRadius: 55,                       // proximity radius
    interactBoostWindowMs: 5 * 60 * 1000,     // first 5 minutes boost
    interactBaseProb: 0.08,                   // normal chance on proximity
    interactBoostProb: 0.22,                  // during boost window
    paletteAmbient: [
      'rgba(120, 200, 255, 0.55)', // blue
      'rgba(220, 120, 255, 0.55)', // magenta
      'rgba(180, 140, 255, 0.55)', // purple
      'rgba(140, 235, 170, 0.55)'  // green (also used for "done")
    ],
    tint: {
      waiting: 'rgba(255, 230, 120, 0.60)', // yellow (scheduled)
      playing: 'rgba(255, 120, 120, 0.60)', // RED (poem playing)
      done:    'rgba(140, 235, 170, 0.60)', // green (finished)
      warn:    'rgba(255, 120, 120, 0.75)'  // red (warning state)
    }
  }
};

/* --------------------------
   Layers
--------------------------- */
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

/* --------------------------
   Styles
--------------------------- */
(()=>{ const css = `
  .env-poem-line{position:absolute;white-space:nowrap;color:${CFG.colors.poemLine};
    text-shadow:0 1px 3px ${CFG.colors.poemShadow};opacity:.95;font-weight:600;letter-spacing:.2px;
    user-select:none;will-change:transform,opacity;pointer-events:none;}
  .env-reveal-bar{max-width:980px;width:calc(100vw - 24px);margin:0 12px 10px;
    background:linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9));
    border:1px solid rgba(255,255,255,.08);border-radius:10px;
    padding:10px 14px;color:${CFG.colors.reveal};
    font-size:16px;line-height:1.4;letter-spacing:.2px;display:none;text-align:center;
    opacity:0; transition:opacity 600ms ease;}
  .env-reveal-line{display:inline-block;margin-right:.75em;white-space:nowrap;opacity:1;}
  .env-reveal-word{display:inline-block;opacity:0;will-change:opacity,transform;transform:translateY(4px);}
`; const tag=document.createElement('style'); tag.textContent=css; document.head.appendChild(tag);})();

/* --------------------------
   Status (influences butterfly tint)
--------------------------- */
const poemStatus = { state:'waiting', set(next){ this.state = next; } };

/* --------------------------
   Poem drift with Wind-based spacing
--------------------------- */
let __windsSongRunInProgress = false;
let __lastLineExitAt = 0;    // timestamp when the final line actually exits
let __revealCancelled = false;

async function runPoemDrift(){
  if (__windsSongRunInProgress) return;
  __windsSongRunInProgress = true;
  __revealCancelled = false;

  try{
    // Random surprise window for first line
    const firstDelayMs = randi(0, CFG.poem.baseFirstLineDelayMaxMs);

    // Warn if nothing started after 130s
    let started = false;
    (async()=>{ await wait(130_000); if(!started) poemStatus.set('warn'); })();

    // Optional delay before starting
    await wait(firstDelayMs);
    started = true;

    if (SPECIAL_ACTIVE) { // don’t start while special poem is live
      __windsSongRunInProgress = false;
      return;
    }

    poemStatus.set('playing'); // => butterflies RED
    const windVal  = Number(window.__WINDS_SONG__.wind) || 5;
    const windFact = Math.max(0.1, windVal/5);

    // Drift duration per line scales with wind (faster wind => shorter time)
    const driftMs  = Math.max(1500, Math.round(CFG.poem.baseDriftDurationMs / windFact));

    // Derive inter-line spawn so the “visual gap” feels constant across speeds.
    // If drift gets shorter, we lengthen the time between spawns to compensate.
    const baselineWind = 5;
    const baselineDrift = CFG.poem.baseDriftDurationMs; // at Wind=5
    // keep gap proportional to drift duration
    const gapMs = Math.max(1000, Math.round(CFG.poem.targetVisualGapS * 1000 * (driftMs / baselineDrift)));

    // Spawn each line; record when the LAST one will fully exit for reveal timing
    let lastExit = 0;
    for (let i=0;i<CFG.poem.lines.length;i++){
      const startAt = performance.now();
      const exitAt  = startAt + driftMs;
      if (i === CFG.poem.lines.length - 1) lastExit = exitAt;

      spawnDriftingLine(CFG.poem.lines[i], driftMs);
      if (i < CFG.poem.lines.length - 1){
        await wait(gapMs); // spacing independent of Breath now
        if (SPECIAL_ACTIVE) { // abort mid-cycle if special begins
          poemStatus.set('waiting');
          __windsSongRunInProgress = false;
          return;
        }
      }
    }

    __lastLineExitAt = lastExit;

    // Start bottom reveal ONLY after the last line has actually left the screen
    const waitUntil = Math.max(0, (__lastLineExitAt + CFG.reveal.appearCushionMs) - performance.now());
    await wait(waitUntil);

    if (!SPECIAL_ACTIVE && !__revealCancelled) {
      await runRevealSequence(); // Elegra slider ignored here; fixed timing used
    }

    poemStatus.set('done'); // => butterflies GREEN, ambient palette enabled
  }catch(e){
    console.error('Poem drift error:', e);
    poemStatus.set('warn');
  }finally{
    __windsSongRunInProgress = false;
  }
}

function spawnDriftingLine(text, driftDurationMs){
  const el = document.createElement('div');
  el.className='env-poem-line'; el.textContent=text;
  const fs = randi(CFG.poem.driftFontMin, CFG.poem.driftFontMax);
  el.style.fontSize = fs+'px';
  const minY=90, maxY=Math.max(minY+60, window.innerHeight-100);
  el.style.top = randi(minY, maxY)+'px';
  const startX = -Math.max(120, text.length*(fs*0.6));
  const endX   = window.innerWidth + 80;
  poemLayer.appendChild(el);

  const t0 = performance.now(), peak=0.95;
  function step(t){
    const k = clamp((t-t0)/driftDurationMs,0,1);
    const x = startX + (endX - startX)*k;
    el.style.transform = `translate(${x}px,0)`;
    // earlier fade-in, smooth fade-out
    const fadeIn = Math.min(1, k/0.20), fadeOut = Math.min(1, (1-k)/0.20);
    el.style.opacity = String(peak * Math.min(fadeIn, fadeOut));
    if (k<1) requestAnimationFrame(step); else el.remove();
  }
  requestAnimationFrame(step);
}

/* --------------------------
   Bottom reveal (fixed pacing, correct spacing)
--------------------------- */
let __revealBar = null;
function cancelBottomReveal(){
  __revealCancelled = true;
  if (__revealBar){
    __revealBar.style.opacity = '0';
    setTimeout(()=>{ __revealBar?.remove(); __revealBar = null; }, 500);
  }
}

async function runRevealSequence(){
  // Build bar
  const bar = document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);
  __revealBar = bar;

  // Words with preserved spaces (ALWAYS)
  const lines = CFG.poem.lines.map(line=>{
    const lineEl=document.createElement('span'); lineEl.className='env-reveal-line';
    const words = line.split(' ').map((w,i,arr)=>{
      const s=document.createElement('span'); s.className='env-reveal-word';
      s.textContent = (i<arr.length-1) ? (w+' ') : w; lineEl.appendChild(s); return s;
    });
    bar.appendChild(lineEl); return { lineEl, words };
  });

  // Fade bar in
  bar.style.display='block';
  await wait(20);
  bar.style.opacity='1';

  // Two-line phases, slow & smooth (Elegra slider NOT applied)
  const halfPhase = CFG.reveal.pairPhaseMs; // one line fade-in; one crossover step uses per-word pacing

  await revealWords(lines[0].words, halfPhase);
  await crossoverFade(lines[0].words, lines[1].words, halfPhase);

  await crossoverFade(lines[1].words, lines[2].words, halfPhase);
  await crossoverFade(lines[2].words, lines[3].words, halfPhase);

  await fadeWords(lines[3].words, halfPhase);

  // Fade bar out smoothly
  bar.style.opacity='0';
  await wait(600);
  bar.remove();
  __revealBar = null;
}

async function revealWords(words,totalMs){
  const per=Math.max(60, totalMs/Math.max(1,words.length));
  for(let i=0;i<words.length;i++){
    const w=words[i];
    w.style.transition='opacity 600ms ease, transform 600ms ease';
    w.style.opacity='1'; w.style.transform='translateY(0px)';
    await wait(per);
  }
}
async function crossoverFade(outgoing,incoming,totalMs){
  const steps=Math.max(outgoing.length,incoming.length);
  const per=Math.max(60, totalMs/Math.max(1,steps));
  for(let i=0;i<steps;i++){
    if(i<incoming.length){ const w=incoming[i]; w.style.transition='opacity 600ms ease, transform 600ms ease';
      w.style.opacity='1'; w.style.transform='translateY(0px)'; }
    if(i<outgoing.length){ const w=outgoing[i]; w.style.transition='opacity 600ms ease, transform 600ms ease';
      w.style.opacity='0'; w.style.transform='translateY(4px)'; }
    await wait(per);
  }
}
async function fadeWords(words,totalMs){
  const per=Math.max(60, totalMs/Math.max(1,words.length));
  for(let i=0;i<words.length;i++){
    const w=words[i];
    w.style.transition='opacity 600ms ease, transform 600ms ease';
    w.style.opacity='0'; w.style.transform='translateY(4px)';
    await wait(per);
  }
}

/* --------------------------
   Butterflies (oscillation via Breath, proximity dance)
--------------------------- */
const ACTIVE_BUTTERFLIES = new Set();
const PAGE_LOAD_T0 = performance.now();

function currentButterflyTint(){
  switch (poemStatus.state) {
    case 'playing': return CFG.butterflies.tint.playing; // RED
    case 'done':    return CFG.butterflies.tint.done;    // GREEN
    case 'warn':    return CFG.butterflies.tint.warn;    // RED (warn)
    default:        return CFG.butterflies.tint.waiting; // YELLOW
  }
}
function ambientTint(){
  // after poem done, allow a wider palette
  if (poemStatus.state === 'done') {
    return CFG.butterflies.paletteAmbient[randi(0, CFG.butterflies.paletteAmbient.length-1)];
  }
  return currentButterflyTint();
}

function spawnButterfly(){
  const windVal = Number(window.__WINDS_SONG__.wind) || 5;
  const windFact= Math.max(0.1, windVal/5);

  const size=randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);
  const tint=ambientTint();

  const el=document.createElement('div');
  Object.assign(el.style,{position:'absolute',top:`${randi(40, Math.max(120, window.innerHeight/2))}px`,
    left:'0px',width:`${size}px`,height:`${size}px`,opacity:'1',pointerEvents:'none',
    zIndex:String(CFG.z.leaves),willChange:'transform'});
  el.innerHTML = `
    <svg viewBox="0 0 120 80" width="${size}" height="${size}" style="display:block">
      <defs><filter id="bshadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/></filter></defs>
      <g filter="url(#bshadow)">
        <path d="M60,40 C30,5 5,5 10,35 C15,60 35,55 60,40 Z" fill="${tint}"/>
        <path d="M60,40 C90,5 115,5 110,35 C105,60 85,55 60,40 Z" fill="${tint}"/>
        <rect x="57" y="35" width="6" height="16" rx="3" fill="rgba(30,40,60,0.6)"/>
      </g>
    </svg>`;
  leavesLayer.appendChild(el);

  const fromLeft=Math.random()<0.5;
  const startX=fromLeft?-40:(window.innerWidth+40);
  const endX  =fromLeft?(window.innerWidth+40):-40;

  const baseTop=randi(40, Math.max(120, window.innerHeight/2));
  const base=randi(CFG.butterflies.baseTravelMsMin, CFG.butterflies.baseTravelMsMax);
  const travelMs=Math.max(800, Math.round(base/ windFact));
  const t0=performance.now();

  // Breath → oscillation (map 6..30 to amplitude/frequency multipliers)
  const breath = clamp(Number(window.__WINDS_SONG__.breath)||16, 6, 30);
  const ampMul = 0.6 + (breath-6) / (30-6);        // ~0.6 .. 1.0
  const freqMul= 0.8 + (breath-6) / (30-6) * 0.6;  // ~0.8 .. 1.4

  const waves = CFG.butterflies.flutterWavesBase * freqMul;
  const amp   = CFG.butterflies.flutterAmpBase * ampMul;

  const node = { el, radius: CFG.butterflies.interactRadius, inDance:false, vx:0, vy:0 };
  ACTIVE_BUTTERFLIES.add(node);

  function normalAnim(t){
    const k=clamp((t-t0)/travelMs,0,1);
    const x=startX + (endX-startX)*k;
    const y=baseTop + Math.sin(k*Math.PI*waves)*amp;
    el.style.transform=`translate(${x}px, ${y-0}px)`;

    // Proximity check (only if not dancing)
    if (!node.inDance) tryProximityDance(node, x, y);

    if(k<1 && !node.inDance) requestAnimationFrame(normalAnim);
    else if (!node.inDance) { el.remove(); ACTIVE_BUTTERFLIES.delete(node); }
  }
  requestAnimationFrame(normalAnim);

  // Dance controller attaches by flipping node.inDance and animating in orbit
  node.startDance = (mateX, mateY, durationMs=7000) => {
    node.inDance = true;
    const d0 = performance.now();
    const rOrbit = 26 + Math.random()*10;
    function danceStep(tt){
      const u = clamp((tt-d0)/durationMs, 0, 1);
      const angle = u * Math.PI * 4; // 2 full orbits
      const dx = Math.cos(angle)*rOrbit, dy = Math.sin(angle)*rOrbit;
      el.style.transform = `translate(${mateX+dx}px, ${mateY+dy}px)`;
      if (u<1) requestAnimationFrame(danceStep);
      else { // resume normal by removing gracefully
        el.remove(); ACTIVE_BUTTERFLIES.delete(node);
      }
    }
    requestAnimationFrame(danceStep);
  };

  return node;
}

function tryProximityDance(selfNode, x, y){
  const now = performance.now();
  const boost = (now - PAGE_LOAD_T0) < CFG.butterflies.interactBoostWindowMs;
  const p = boost ? CFG.butterflies.interactBoostProb : CFG.butterflies.interactBaseProb;

  for (const other of ACTIVE_BUTTERFLIES){
    if (other === selfNode || other.inDance) continue;
    const mat = other.el.getBoundingClientRect();
    const my  = { x, y };
    const ox  = mat.left, oy = mat.top;
    const dx = ox - my.x, dy = oy - my.y;
    const d2 = dx*dx + dy*dy;
    const R  = Math.max(selfNode.radius, other.radius);
    if (d2 <= R*R && Math.random() < p){
      // Choose a midpoint and start both orbits
      const cx = my.x + dx*0.5;
      const cy = my.y + dy*0.5;
      const dur = 6000 + Math.random()*3000;
      selfNode.startDance(cx, cy, dur);
      other.startDance(cx, cy, dur);
      break;
    }
  }
}

async function runButterfliesLoop(){
  await wait(randi(6_000,14_000)); spawnButterfly();
  while(true){
    // cadence unchanged; speed changes via Wind, oscillation via Breath
    await wait(randi(60_000,90_000));
    spawnButterfly();
  }
}

/* --------------------------
   Orchestrate
--------------------------- */
async function main(){ runPoemDrift(); runButterfliesLoop(); }
main();
