/* =========================================================================
   environment.js (drop-in)
   - No index.html edits
   - Wind (speed), Breath (butterfly oscillation), Elegra (reveal pacing) read live
   - Rez scheduling handled by controller (not here)
   - Special Poem “Butterfly Party” supported via events:
       window.dispatchEvent(new CustomEvent('special-poem:begin'))
       window.dispatchEvent(new CustomEvent('special-poem:end'))
   ======================================================================== */

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Restore menu settings if controller loaded earlier this session */
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

/* Shared state + listeners */
window.__WINDS_SONG__ = window.__WINDS_SONG__ || { wind:5, breath:16, elegra:15, rez:1 };
window.addEventListener("windsong:update", (e) => {
  const { wind, breath, elegra, rez } = e.detail || {};
  if (wind   !== undefined) window.__WINDS_SONG__.wind   = Number(wind);
  if (breath !== undefined) window.__WINDS_SONG__.breath = Number(breath);
  if (elegra !== undefined) window.__WINDS_SONG__.elegra = Number(elegra);
  if (rez    !== undefined) window.__WINDS_SONG__.rez    = Number(rez);
});
window.addEventListener("windsong:trigger", () => {
  if (typeof runPoemDrift === "function") runPoemDrift();
});

/* Config (visual tokens only) */
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
    baseFirstLineDelayMaxMs: 120_000,   // surprise window
    baseDriftDurationMs:     32_000,    // cross-screen baseline at Wind=5
    driftFontMin: 13, driftFontMax: 16,
    desiredScreenSeparationPx: 220      // target gap between drifting lines (kept across speeds)
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30_000,
    rowPadding: 10, fontSizePx: 16,
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    baseTravelMsMin: 18_000, baseTravelMsMax: 26_000,
    sizeMin: 20, sizeMax: 28,
    tint: { // status colors for Wind’s Song lifecycle
      waiting:'rgba(255, 230, 120, 0.50)', // yellow (pre)
      playing:'rgba(255, 120, 120, 0.55)', // red (in progress)  — per your change
      done:   'rgba(140, 235, 170, 0.55)', // green (finished)
      warn:   'rgba(255, 120, 120, 0.70)'
    },
    // Free-flight palette (post Wind’s Song): add blue, magenta, purple, etc.
    freePalette:[
      'rgba(120,200,255,0.55)', // blue
      'rgba(200,120,255,0.55)', // purple
      'rgba(255,120,220,0.55)', // magenta
      'rgba(140,235,170,0.55)', // green
      'rgba(255,200,120,0.55)', // amber
    ],
    flutterBaseWaves: 2,  // multiplied by Breath
    flutterBaseAmp: 28,   // multiplied by Breath factor
    interactRadiusPx: 55, // proximity for interaction
    earlyBoostMinutes: 5, // higher interaction chance in first X minutes
  },
  party: {
    durationMs: 60_000,
    countMin: 8,
    countMax: 12,
    orbitRadiusMin: 60,
    orbitRadiusMax: 120
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

/* Styles */
(()=>{ const css = `
  .env-poem-line{position:absolute;white-space:nowrap;color:${CFG.colors.poemLine};
    text-shadow:0 1px 3px ${CFG.colors.poemShadow};opacity:.95;font-weight:600;letter-spacing:.2px;
    user-select:none;will-change:transform,opacity;pointer-events:none;}
  .env-reveal-bar{max-width:980px;width:calc(100vw - 24px);margin:0 12px 10px;
    background:${CFG.reveal.barBg};border:${CFG.reveal.border};border-radius:10px;
    padding:${CFG.reveal.rowPadding}px 14px;color:${CFG.colors.reveal};
    font-size:${CFG.reveal.fontSizePx}px;line-height:1.4;letter-spacing:.2px;display:none;text-align:center;}
  .env-reveal-line{display:inline-block;margin-right:.75em;white-space:nowrap;opacity:1;}
  .env-reveal-word{display:inline-block;opacity:0;will-change:opacity,transform;transform:translateY(4px);}
`; const tag=document.createElement('style'); tag.textContent=css; document.head.appendChild(tag);})();

/* Status */
const poemStatus = { state:'waiting', set(next){ this.state = next; } };

/* --------------------------
   Wind’s Song: DRIFT (kept spaced across speeds)
--------------------------- */
let __windsSongRunInProgress = false;
let __specialPoemActive = false;         // when true: suspend final reveal
let __lastDriftEndTime = 0;

async function runPoemDrift(){
  if (__windsSongRunInProgress) return;
  __windsSongRunInProgress = true;
  try{
    // surprise window for first line
    const firstDelayMs = randi(0, CFG.poem.baseFirstLineDelayMaxMs);
    let started = false;
    (async()=>{ await wait(130_000); if(!started) poemStatus.set('warn'); })();

    await wait(firstDelayMs);
    started = true; poemStatus.set('playing');

    const windVal  = Number(window.__WINDS_SONG__.wind) || 5;
    const windFact = Math.max(0.1, windVal/5);
    const driftMs  = Math.max(1000, Math.round(CFG.poem.baseDriftDurationMs / windFact));

    // compute between-lines time so the screen gap stays ~constant regardless of speed
    const screenW = window.innerWidth || 1280;
    const travelPx = screenW + 200; // start off-left to off-right
    const pixelsPerMs = travelPx / driftMs;
    const targetGap = CFG.poem.desiredScreenSeparationPx; // fixed visual gap
    const betweenMs = Math.max(1000, Math.round(targetGap / Math.max(0.001, pixelsPerMs)));

    for (let i=0;i<CFG.poem.lines.length;i++){
      spawnDriftingLine(CFG.poem.lines[i], driftMs);
      if (i < CFG.poem.lines.length - 1){
        await wait(betweenMs);
      }
    }

    // Mark drift complete time
    __lastDriftEndTime = performance.now();

    // final reveal only if enabled and NOT during special-poem activity
    if (CFG.reveal.enabled) {
      await wait(CFG.reveal.appearAfterLastLineMs);
      if (!__specialPoemActive) {
        await runRevealSequence();
      }
    }
    poemStatus.set('done');
  }catch(e){ console.error('Poem drift error:', e); poemStatus.set('warn'); }
  finally{ __windsSongRunInProgress=false; }
}

function spawnDriftingLine(text, driftDurationMs){
  const el = document.createElement('div');
  el.className='env-poem-line'; el.textContent=text;
  const fs = randi(CFG.poem.driftFontMin, CFG.poem.driftFontMax);
  el.style.fontSize = fs+'px';
  const minY=90, maxY=Math.max(minY+60, window.innerHeight-100);
  el.style.top = randi(minY, maxY)+'px';
  const startX = -Math.max(120, text.length*(fs*0.6));
  const endX   = (window.innerWidth || 1280) + 80;
  poemLayer.appendChild(el);

  const t0 = performance.now(), peak=0.95;
  function step(t){
    const k = clamp((t-t0)/driftDurationMs,0,1);
    const x = startX + (endX - startX)*k;
    el.style.transform = `translate(${x}px,0)`;
    const fadeIn = Math.min(1, k/0.20), fadeOut = Math.min(1, (1-k)/0.20);
    el.style.opacity = String(peak * Math.min(fadeIn, fadeOut));
    if (k<1) requestAnimationFrame(step); else el.remove();
  }
  requestAnimationFrame(step);
}

/* --------------------------
   Wind’s Song: FINAL REVEAL (spacing preserved)
   - Suspended while __specialPoemActive = true
--------------------------- */
async function runRevealSequence(){
  if (__specialPoemActive) return; // suspend during special poem

  const elegraS = Number(window.__WINDS_SONG__.elegra) || 15;
  const pairTotalMs = Math.max(1000, Math.round(elegraS*1000));
  const half = 0.5 * pairTotalMs;

  const bar = document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);
  const lines = CFG.poem.lines.map(line=>{
    const lineEl=document.createElement('span'); lineEl.className='env-reveal-line';
    // IMPORTANT: preserve spacing by keeping a space after every word except last:
    const words = line.split(' ').map((w,i,arr)=>{
      const s=document.createElement('span'); s.className='env-reveal-word';
      s.textContent = (i<arr.length-1) ? (w+' ') : w; lineEl.appendChild(s); return s;
    });
    bar.appendChild(lineEl); return { lineEl, words };
  });

  bar.style.display='block';

  await revealWords(lines[0].words, half);
  if (__specialPoemActive) { bar.remove(); return; }
  await crossoverFade(lines[0].words, lines[1].words, half);

  if (__specialPoemActive) { bar.remove(); return; }
  await crossoverFade(lines[1].words, lines[2].words, half);

  if (__specialPoemActive) { bar.remove(); return; }
  await crossoverFade(lines[2].words, lines[3].words, half);

  if (__specialPoemActive) { bar.remove(); return; }
  await fadeWords(lines[3].words, half);

  bar.remove();
}
async function revealWords(words,totalMs){ const per=totalMs/Math.max(1,words.length);
  for(let i=0;i<words.length;i++){ const w=words[i];
    w.style.transition='opacity 600ms ease, transform 600ms ease';
    w.style.opacity='1'; w.style.transform='translateY(0px)'; await wait(per); } }
async function crossoverFade(outgoing,incoming,totalMs){
  const steps=Math.max(outgoing.length,incoming.length), per=totalMs/Math.max(1,steps);
  for(let i=0;i<steps;i++){
    if(i<incoming.length){ const w=incoming[i]; w.style.transition='opacity 600ms ease, transform 600ms ease';
      w.style.opacity='1'; w.style.transform='translateY(0px)'; }
    if(i<outgoing.length){ const w=outgoing[i]; w.style.transition='opacity 600ms ease, transform 600ms ease';
      w.style.opacity='0'; w.style.transform='translateY(4px)'; }
    await wait(per);
  } }
async function fadeWords(words,totalMs){ const per=totalMs/Math.max(1,words.length);
  for(let i=0;i<words.length;i++){ const w=words[i];
    w.style.transition='opacity 600ms ease, transform 600ms ease';
    w.style.opacity='0'; w.style.transform='translateY(4px)'; await wait(per); } }

/* --------------------------
   Butterflies: normal loop + interactions
--------------------------- */
const __butterflies = new Set();
let __bootTime = performance.now();

function currentTintFree(){
  // After Wind’s Song finished, use rich palette; during playing/waiting use status tint
  switch (poemStatus.state) {
    case 'waiting': return CFG.butterflies.tint.waiting;
    case 'playing': return CFG.butterflies.tint.playing; // red while poem is running
    case 'done':    return CFG.butterflies.tint.done;
    case 'warn':    return CFG.butterflies.tint.warn;
    default:        return CFG.butterflies.tint.waiting;
  }
}

function spawnButterfly(custom = {}){
  const windVal = Number(window.__WINDS_SONG__.wind) || 5;
  const windFact= Math.max(0.1, windVal/5);

  const size = custom.size != null ? custom.size : randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);

  // Color: during Wind’s Song lifecycle use status tint; when done, allow palette variety
  const tint = (poemStatus.state === 'done')
    ? (custom.tint || CFG.butterflies.freePalette[randi(0, CFG.butterflies.freePalette.length-1)])
    : (custom.tint || currentTintFree());

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

  const fromLeft = Math.random()<0.5;
  const startX = custom.startX ?? (fromLeft ? -40 : (window.innerWidth + 40));
  const endX   = custom.endX   ?? (fromLeft ? (window.innerWidth + 40) : -40);
  const baseTop = custom.baseTop ?? parseFloat(el.style.top);

  const base = custom.travelMs ?? randi(CFG.butterflies.baseTravelMsMin, CFG.butterflies.baseTravelMsMax);
  const travelMs = Math.max(800, Math.round(base/ windFact));
  const t0=performance.now();

  // Breath shapes flutter (oscillation) — larger value => deeper/wavier
  const breath = Number(window.__WINDS_SONG__.breath) || 16;
  const breathFactor = clamp(breath / 16, 0.4, 2.0);
  const waves = (custom.waves != null ? custom.waves : CFG.butterflies.flutterBaseWaves) * breathFactor;
  const amp   = (custom.amp   != null ? custom.amp   : CFG.butterflies.flutterBaseAmp)   * breathFactor;

  const node = { el, startX, endX, baseTop, t0, travelMs, mode: custom.mode || 'linear', // 'linear' | 'orbit'
                 cx: custom.cx, cy: custom.cy, r: custom.r, w: custom.w, // orbit params
                 waves, amp, size, active:true };
  __butterflies.add(node);

  function linearStep(u){
    const x = startX + (endX - startX) * u;
    const y = baseTop + Math.sin(u*Math.PI*waves)*amp;
    el.style.transform=`translate(${x}px, ${y-baseTop}px)`;
  }
  function orbitStep(u){
    // u: 0..1 over travelMs, but orbits run continuous using time
    const t = (performance.now() - t0)/1000;
    const angle = (node.w || 1) * t * 2*Math.PI; // angular velocity
    const ox = (node.cx || (window.innerWidth/2)) + Math.cos(angle)*node.r;
    const oy = (node.cy || (window.innerHeight/2)) + Math.sin(angle)*node.r + Math.sin(t*Math.PI*waves)*amp*0.25;
    el.style.transform=`translate(${ox}px, ${oy}px)`;
  }

  function step(){
    if (!node.active){ el.remove(); __butterflies.delete(node); return; }
    const u = clamp((performance.now()-t0)/travelMs, 0, 1);
    if (node.mode === 'orbit') orbitStep(u); else linearStep(u);
    if (u < 1) requestAnimationFrame(step);
    else { el.remove(); __butterflies.delete(node); }
  }
  requestAnimationFrame(step);
  return node;
}

async function runButterfliesLoop(){
  await wait(randi(6_000,14_000)); spawnButterfly();
  while(true){
    // normal cadence (random); party manager may temporarily pause free spawns if needed
    await wait(randi(60_000,90_000));
    if (!__specialPoemActive) spawnButterfly();
  }
}

/* Interactions: occasionally pair up if within radius */
(function interactionLoop(){
  function tick(){
    try {
      if (__butterflies.size >= 2){
        const arr = Array.from(__butterflies);
        for (let i=0;i<arr.length;i++){
          const a = arr[i]; if (!a.active || !a.el) continue;
          const ra = a.el.getBoundingClientRect();
          const ax = ra.left + ra.width/2, ay = ra.top + ra.height/2;

          for (let j=i+1;j<arr.length;j++){
            const b = arr[j]; if (!b.active || !b.el) continue;
            const rb = b.el.getBoundingClientRect();
            const bx = rb.left + rb.width/2, by = rb.top + rb.height/2;

            const dx = ax-bx, dy = ay-by;
            const d2 = dx*dx + dy*dy;
            const R = CFG.butterflies.interactRadiusPx;
            if (d2 < R*R){
              // Decide probability based on early-boost window
              const minutesSinceBoot = (performance.now() - __bootTime) / 60000;
              const early = minutesSinceBoot < CFG.butterflies.earlyBoostMinutes;
              const p = early ? 0.20 : 0.04; // higher in first few minutes
              if (Math.random() < p){
                // briefly curve both (swap their waves/amp for a moment)
                const tmpW = a.waves; a.waves = b.waves; b.waves = tmpW;
                const tmpA = a.amp;   a.amp   = b.amp;   b.amp   = tmpA;
              }
            }
          }
        }
      }
    } catch(e){}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* --------------------------
   SPECIAL POEM: Butterfly Party
   - Trigger: special-poem:begin
   - Stop:    special-poem:end OR after duration
   - Pauses Wind’s Song FINAL REVEAL while active
--------------------------- */
let __partyRunning = false;
let __partyEndTimer = null;

function findSpecialPoemAnchor(){
  // try a few likely elements; fallback to viewport center
  const cand = document.querySelector('#poem-output, .poem-output, .rings, .wrap, .content');
  if (cand){
    const r = cand.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }
  return { x: (window.innerWidth||1280)/2, y: (window.innerHeight||720)/2 };
}

function spawnPartyButterfly(cx, cy){
  const r   = rand(CFG.party.orbitRadiusMin, CFG.party.orbitRadiusMax);
  const w   = rand(0.08, 0.16); // angular speed (revs/sec-ish)
  const tint= CFG.butterflies.freePalette[randi(0, CFG.butterflies.freePalette.length-1)];
  return spawnButterfly({
    mode:'orbit', cx, cy, r, w,
    tint,
    waves: 1.5, amp: 8, // keep orbit fairly tidy; slight flutter layered
    travelMs: 90_000,   // long-running; we’ll stop manually at party end
    size: randi(22, 28)
  });
}

async function startButterflyParty(){
  if (__partyRunning) return;
  __partyRunning = true;
  __specialPoemActive = true;

  const { x:cx, y:cy } = findSpecialPoemAnchor();
  const n = randi(CFG.party.countMin, CFG.party.countMax);
  const partyNodes = [];
  for (let i=0;i<n;i++){
    partyNodes.push(spawnPartyButterfly(cx, cy));
  }

  // End party after duration, then disperse
  clearTimeout(__partyEndTimer);
  __partyEndTimer = setTimeout(async () => {
    await endButterflyParty();
  }, CFG.party.durationMs);
}

async function endButterflyParty(){
  if (!__partyRunning) return;
  __partyRunning = false;

  // Disperse orbiters gently off-screen
  const arr = Array.from(__butterflies);
  const dispersers = arr.filter(b => b.mode === 'orbit');
  for (const b of dispersers){
    // convert to linear flight to edge
    const fromLeft = Math.random()<0.5;
    b.mode = 'linear';
    const startRect = b.el.getBoundingClientRect();
    const curX = startRect.left, curY = startRect.top;
    b.startX = curX;
    b.baseTop = curY;
    b.endX   = fromLeft ? -80 : (window.innerWidth + 80);
    b.travelMs = randi(4_000, 7_000);
    b.t0 = performance.now();
    b.active = true; // ensure animator keeps moving
  }

  // After dispersal, allow Wind’s Song reveal again
  setTimeout(() => { __specialPoemActive = false; }, 8000);
}

/* Event wiring for special poem */
window.addEventListener('special-poem:begin', startButterflyParty);
window.addEventListener('special-poem:end',   endButterflyParty);

// Manual demo helper (optional)
window.__demoParty = async function(){
  startButterflyParty();
  setTimeout(() => endButterflyParty(), CFG.party.durationMs);
};

/* --------------------------
   Orchestrate
--------------------------- */
async function main(){ runPoemDrift(); runButterfliesLoop(); }
main();
