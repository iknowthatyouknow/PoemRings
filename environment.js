/* =========================================================================
   environment.js (drop‑in)
   - No index.html edits
   - Wind/Breath/Elegra/Rez hooks from windsong-controller.js
   - Drifting poem lines with dynamic spacing (speed‑independent separation)
   - Final reveal with correct word spacing (shown only when no special poem active)
   - Butterflies (status tints, interaction) + Butterfly Party tied to special poem
   ======================================================================== */

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Restore saved knobs if controller loaded first */
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

/* Shared state + listeners (defaults if controller loads after) */
window.__WINDS_SONG__ = window.__WINDS_SONG__ || { wind:5, breath:16, elegra:15, rez:1 };
window.addEventListener("windsong:update", (e) => {
  const { wind, breath, elegra, rez } = e.detail || {};
  if (wind   !== undefined) window.__WINDS_SONG__.wind   = Number(wind);
  if (breath !== undefined) window.__WINDS_SONG__.breath = Number(breath);
  if (elegra !== undefined) window.__WINDS_SONG__.elegra = Number(elegra);
  if (rez    !== undefined) window.__WINDS_SONG__.rez    = Number(rez);
});
window.addEventListener("windsong:trigger", () => { if (typeof runPoemDrift === "function") runPoemDrift(); });

/* Config */
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
    baseDriftDurationMs:     32_000,    // cross‑screen baseline at Wind=5
    driftFontMin: 13, driftFontMax: 16,
    // desired minimum time separation between full‑opacity portions of lines
    baseSeparationS: 20,                // pick: 16 / 20 / 25 (we use 20s as agreed)
    separationRatioOfDrift: 0.60        // also ensure ≥60% of drift time before next line
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30_000,      // only when not in special‑poem mode
    rowPadding: 10, fontSizePx: 16,
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    baseTravelMsMin: 18_000, baseTravelMsMax: 26_000,
    sizeMin: 20, sizeMax: 28,
    flutterWaves: 2,
    flutterAmpBase: 28, // multiplied by Breath factor below
    // status tints
    tint: {
      waiting:'rgba(255, 230, 120, 0.60)', // yellow (scheduled/idle)
      playing:'rgba(255, 120, 120, 0.60)', // red during Wind’s Song
      done:   'rgba(140, 235, 170, 0.60)', // green after Wind’s Song completes
      warn:   'rgba(255, 160,  80, 0.60)'  // orange if something stalled
    },
    // palette available after Wind’s Song completes (free flight)
    palette: [
      'rgba(120, 200, 255, 0.60)', // blue/cyan
      'rgba(200, 120, 255, 0.60)', // purple/magenta
      'rgba(255, 150,  90, 0.60)', // orange
      'rgba(120, 255, 180, 0.60)', // green-mint
      'rgba(255, 130, 200, 0.60)', // pink
      'rgba(255, 210, 120, 0.60)'  // warm yellow
    ],
    interactionRadiusPx: 55,           // proximity to interact
    partyGatherMs: 60000               // party dance duration
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

/* Status & guards */
const poemStatus = { state:'waiting', set(next){ this.state = next; } };
let __windsSongRunInProgress = false;
let __specialPoemActive = false;
let __revealSuppressed = false;
let __activeButterflies = []; // track for interactions & party

/* Special Poem hooks: suspend reveal during special poem */
window.addEventListener('special-poem:begin', () => {
  __specialPoemActive = true;
  __revealSuppressed = true;   // block reveal while special poem is up
  // if a reveal bar is currently visible, fade it away gracefully
  const bar = document.querySelector('.env-reveal-bar');
  if (bar) {
    bar.style.transition = 'opacity 600ms ease';
    bar.style.opacity = '0';
    setTimeout(()=> bar.remove(), 700);
  }
  startButterflyParty();       // kick off party on begin
});

window.addEventListener('special-poem:end', () => {
  __specialPoemActive = false;
  // reveal can run again on the next Wind’s Song cycle
  __revealSuppressed = false;
});

/* ---- Drifting Poem (dynamic spacing) ---- */
async function runPoemDrift(){
  if (__windsSongRunInProgress) return;
  __windsSongRunInProgress = true;
  try{
    const firstDelayMs = randi(0, CFG.poem.baseFirstLineDelayMaxMs);
    let started = false;
    (async()=>{ await wait(130_000); if(!started) poemStatus.set('warn'); })();

    await wait(firstDelayMs);
    started = true; poemStatus.set('playing');

    // Wind factor
    const windVal  = Number(window.__WINDS_SONG__.wind) || 5;
    const windFact = Math.max(0.1, windVal/5);

    for (let i=0;i<CFG.poem.lines.length;i++){
      // drift duration shortens as wind increases
      const driftMs = Math.max(1200, Math.round(CFG.poem.baseDriftDurationMs / windFact));
      spawnDriftingLine(CFG.poem.lines[i], driftMs);

      // spacing: keep at least baseSeparationS, and also ≥ separationRatio * driftMs
      if (i < CFG.poem.lines.length - 1){
        const desiredMs = CFG.poem.baseSeparationS * 1000;
        const ratioMs   = Math.round(CFG.poem.separationRatioOfDrift * driftMs);
        const betweenMs = Math.max(desiredMs, ratioMs);
        await wait(betweenMs);
      }
    }

    if (CFG.reveal.enabled && !__specialPoemActive && !__revealSuppressed){
      await wait(CFG.reveal.appearAfterLastLineMs);
      if (!__specialPoemActive) { // re-check in case special poem started during wait
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
  const endX   = window.innerWidth + 80;
  poemLayer.appendChild(el);

  const t0 = performance.now(), peak=0.95;
  function step(t){
    const k = clamp((t-t0)/driftDurationMs,0,1);
    const x = startX + (endX - startX)*k;
    el.style.transform = `translate(${x}px,0)`;
    // readable sooner at entry, softer exit
    const fadeIn = Math.min(1, k/0.20), fadeOut = Math.min(1, (1-k)/0.20);
    el.style.opacity = String(peak * Math.min(fadeIn, fadeOut));
    if (k<1) requestAnimationFrame(step); else el.remove();
  }
  requestAnimationFrame(step);
}

/* ---- Final Reveal (correct word spacing, smooth) ---- */
async function runRevealSequence(){
  // If special poem is active now, skip
  if (__specialPoemActive || __revealSuppressed) return;

  const bar = document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);

  const lines = CFG.poem.lines.map(line=>{
    const lineEl=document.createElement('span'); lineEl.className='env-reveal-line';
    // Preserve spaces explicitly
    const words = line.split(' ').map((w,i,arr)=>{
      const s=document.createElement('span'); s.className='env-reveal-word';
      s.textContent = (i<arr.length-1) ? (w+' ') : w; lineEl.appendChild(s); return s;
    });
    bar.appendChild(lineEl); return { lineEl, words };
  });

  bar.style.opacity = '0';
  bar.style.display = 'block';
  // fade in bar container smoothly
  bar.style.transition = 'opacity 700ms ease';
  requestAnimationFrame(()=>{ bar.style.opacity='1'; });

  // Elegra no longer changes reveal pacing; use a fixed graceful cadence
  const PAIR_MS = 15000; // ~15s per pair is the “confession” pace
  const HALF = 0.5 * PAIR_MS;

  await revealWords(lines[0].words, HALF);
  if (__specialPoemActive) return cleanupReveal(bar);

  await crossoverFade(lines[0].words, lines[1].words, HALF);
  if (__specialPoemActive) return cleanupReveal(bar);

  await crossoverFade(lines[1].words, lines[2].words, HALF);
  if (__specialPoemActive) return cleanupReveal(bar);

  await crossoverFade(lines[2].words, lines[3].words, HALF);
  if (__specialPoemActive) return cleanupReveal(bar);

  await fadeWords(lines[3].words, HALF);

  // gentle fade-out of the whole bar
  bar.style.transition = 'opacity 700ms ease';
  bar.style.opacity = '0';
  setTimeout(()=> bar.remove(), 800);
}
function cleanupReveal(bar){
  try{
    bar.style.transition = 'opacity 400ms ease';
    bar.style.opacity = '0';
  }catch{}
  setTimeout(()=>{ try{ bar.remove(); }catch{} }, 500);
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

/* ---- Butterflies (status, interaction, party) ---- */
function currentButterflyTint(){
  // During Wind’s Song run → red; idle → yellow; after → green; warn → orange
  switch (poemStatus.state) {
    case 'playing': return CFG.butterflies.tint.playing;
    case 'done':    return CFG.butterflies.tint.done;
    case 'warn':    return CFG.butterflies.tint.warn;
    default:        return CFG.butterflies.tint.waiting;
  }
}
function freePaletteColor(){
  const arr = CFG.butterflies.palette;
  return arr[randi(0, arr.length-1)];
}

function spawnButterfly(opts={}){
  const windVal  = Number(window.__WINDS_SONG__.wind) || 5;
  const windFact = Math.max(0.1, windVal/5);

  const size=randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);
  const el=document.createElement('div');
  Object.assign(el.style,{position:'absolute',top:`${randi(40, Math.max(120, window.innerHeight/2))}px`,
    left:'0px',width:`${size}px`,height:`${size}px`,opacity:'1',pointerEvents:'none',
    zIndex:String(CFG.z.leaves),willChange:'transform'});

  // choose color depending on mode
  const tint = opts.forceColor || (__specialPoemActive ? freePaletteColor() : currentButterflyTint());

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
  const baseTop= randi(40, Math.max(120, window.innerHeight/2));
  el.style.top = `${baseTop}px`;

  // travel time follows Wind; Breath increases vertical oscillation amplitude
  const base=randi(CFG.butterflies.baseTravelMsMin, CFG.butterflies.baseTravelMsMax);
  const travelMs=Math.max(1000, Math.round(base/ windFact));
  const breath  = Number(window.__WINDS_SONG__.breath) || 16;
  const oscAmp  = CFG.butterflies.flutterAmpBase * clamp(breath/16, 0.5, 2.0);
  const waves   = CFG.butterflies.flutterWaves;

  const actor = { el, startX, endX, baseTop, travelMs, oscAmp, waves, t0: performance.now(), party: !!opts.party };
  __activeButterflies.push(actor);

  function anim(t){
    const k=clamp((t-actor.t0)/actor.travelMs,0,1);
    const x=actor.startX + (actor.endX-actor.startX)*k;
    const y=actor.baseTop + Math.sin(k*Math.PI*actor.waves)*actor.oscAmp + (actor.party ? Math.sin(k*8)*6 : 0);
    el.style.transform=`translate(${x}px, ${y-actor.baseTop}px)`;
    if(k<1) requestAnimationFrame(anim); else {
      // cleanup
      el.remove();
      __activeButterflies = __activeButterflies.filter(b => b !== actor);
    }
  }
  requestAnimationFrame(anim);
  return actor;
}

async function runButterfliesLoop(){
  // a quick early butterfly
  await wait(randi(6_000,14_000)); spawnButterfly();
  while(true){
    await wait(randi(60_000,90_000));
    spawnButterfly();
    // simple proximity interaction pass after each spawn
    setTimeout(checkButterflyInteractions, 500);
  }
}

// Interaction: if two get close, they spiral briefly
function checkButterflyInteractions(){
  const R = CFG.butterflies.interactionRadiusPx;
  for (let i=0;i<__activeButterflies.length;i++){
    for (let j=i+1;j<__activeButterflies.length;j++){
      const a = __activeButterflies[i], b = __activeButterflies[j];
      if (!a || !b || !a.el || !b.el) continue;
      const ra = a.el.getBoundingClientRect(), rb = b.el.getBoundingClientRect();
      const ax = ra.left + ra.width/2, ay = ra.top + ra.height/2;
      const bx = rb.left + rb.width/2, by = rb.top + rb.height/2;
      const dx = ax-bx, dy = ay-by, d = Math.hypot(dx,dy);
      if (d < R) {
        // tiny one-time swirl
        swirl(a.el); swirl(b.el);
      }
    }
  }
}
function swirl(el){
  el.animate(
    [
      { transform: el.style.transform },
      { transform: el.style.transform + ' rotate(20deg) translate(6px,-4px)' },
      { transform: el.style.transform }
    ],
    { duration: 800, easing:'ease-in-out' }
  );
}

/* ---- Butterfly Party (Special Poem) ---- */
let __partyTimer = null;
async function startButterflyParty(){
  try{
    // spawn 8–12 multicolor party butterflies, converging toward center for a bit
    const count = randi(8,12);
    const centerX = window.innerWidth/2, centerY = window.innerHeight*0.40;
    for (let i=0;i<count;i++){
      const actor = spawnButterfly({ party:true, forceColor: freePaletteColor() });
      // nudge actor path toward center by offsetting baseTop
      if (actor) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        actor.baseTop = clamp(centerY + dir*randi(0, 60), 40, window.innerHeight-80);
      }
      await wait(120 + randi(0,120));
    }

    // while party active, boost interaction checks frequency
    let running = true;
    __partyTimer = setInterval(()=> { if (!running) return; checkButterflyInteractions(); }, 500);

    await wait(CFG.butterflies.partyGatherMs); // ~60s

    running = false;
    clearInterval(__partyTimer); __partyTimer = null;

    // disperse: nothing forced; their travel anim completes and cleanup happens
  } catch(e){
    console.warn('Butterfly party error:', e);
    try{ clearInterval(__partyTimer); }catch{}
    __partyTimer = null;
  }
}

/* Orchestrate */
async function main(){
  runPoemDrift();
  runButterfliesLoop();
}
main();
