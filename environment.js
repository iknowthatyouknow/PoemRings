/* =========================================================================
   environment.js (drop-in, stable)
   - No index.html changes; visuals unchanged
   - Reads Wind/Breath/Elegra/Rez live (menu Apply works)
   - 5 on Wind = baseline speed
   - Bottom reveal keeps spaces between words
   - Butterfly Party protocol (special-poem:begin / special-poem:end)
   ======================================================================== */

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Restore persisted settings BEFORE we init */
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

/* Shared state + event listeners */
window.__WINDS_SONG__ = window.__WINDS_SONG__ || { wind:5, breath:16, elegra:15, rez:1 };

window.addEventListener("windsong:update", (e) => {
  try {
    const { wind, breath, elegra, rez } = e.detail || {};
    if (wind   !== undefined) window.__WINDS_SONG__.wind   = Number(wind);
    if (breath !== undefined) window.__WINDS_SONG__.breath = Number(breath);
    if (elegra !== undefined) window.__WINDS_SONG__.elegra = Number(elegra);
    if (rez    !== undefined) window.__WINDS_SONG__.rez    = Number(rez);
    // Also forward wind to environment.html (background) so wind lines/leaves update immediately
    postWindToEnvironment(window.__WINDS_SONG__.wind);
  } catch(err){ console.warn('[environment] windsong:update handler error', err); }
});

window.addEventListener("windsong:trigger", () => {
  try { if (typeof runPoemDrift === "function") runPoemDrift(); }
  catch(err){ console.warn('[environment] windsong:trigger error', err); }
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
    driftFontMin: 13, driftFontMax: 16
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
    tint: {
      waiting:'rgba(255, 230, 120, 0.50)', // yellow (waiting/idle)
      playing:'rgba(240, 80,  80,  0.55)', // red   (poem playing)
      done:   'rgba(140, 235, 170, 0.55)', // green (finished)
      warn:   'rgba(255, 120, 120, 0.55)'  // warn
    },
    flutterWaves: 2, flutterAmp: 28
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
  .env-butterfly-party{ position:absolute; pointer-events:none; z-index:${CFG.z.poem}; }
`; const tag=document.createElement('style'); tag.textContent=css; document.head.appendChild(tag);})();

/* Status */
const poemStatus = { state:'waiting', set(next){ this.state = next; } };

/* Poem drift (live knobs applied per line) */
let __windsSongRunInProgress = false;
async function runPoemDrift(){
  if (__windsSongRunInProgress) return;
  __windsSongRunInProgress = true;
  try{
    const firstDelayMs = randi(0, CFG.poem.baseFirstLineDelayMaxMs);
    let started = false;
    (async()=>{ await wait(130_000); if(!started) poemStatus.set('warn'); })();

    await wait(firstDelayMs);
    started = true; poemStatus.set('playing');

    for (let i=0;i<CFG.poem.lines.length;i++){
      const windVal   = Number(window.__WINDS_SONG__.wind) || 5;
      const windFact  = Math.max(0.1, windVal/5);
      const driftMs   = Math.max(1000, Math.round(CFG.poem.baseDriftDurationMs / windFact));
      spawnDriftingLine(CFG.poem.lines[i], driftMs);

      if (i < CFG.poem.lines.length - 1){
        const breathS = Number(window.__WINDS_SONG__.breath) || 16; // gap between lines (kept per ruleset)
        await wait(Math.max(500, Math.round(breathS*1000)));
      }
    }

    if (CFG.reveal.enabled){
      await wait(CFG.reveal.appearAfterLastLineMs);
      await runRevealSequence();
    }
    poemStatus.set('done');
  }catch(e){ console.error('[environment] Poem drift error:', e); poemStatus.set('warn'); }
  finally{ __windsSongRunInProgress=false; }
}

function spawnDriftingLine(text, driftDurationMs){
  try{
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
      const fadeIn = Math.min(1, k/0.20), fadeOut = Math.min(1, (1-k)/0.20);
      el.style.opacity = String(peak * Math.min(fadeIn, fadeOut));
      if (k<1) requestAnimationFrame(step); else el.remove();
    }
    requestAnimationFrame(step);
  }catch(err){ console.warn('[environment] spawnDriftingLine error', err); }
}

/* Bottom reveal (Elegra per phase) */
async function runRevealSequence(){
  try{
    const elegraS = Number(window.__WINDS_SONG__.elegra) || 15;
    const pairTotalMs = Math.max(1000, Math.round(elegraS*1000));
    const half = 0.5 * pairTotalMs;

    const bar = document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);
    const lines = CFG.poem.lines.map(line=>{
      const lineEl=document.createElement('span'); lineEl.className='env-reveal-line';
      const words = line.split(' ').map((w,i,arr)=>{
        const s=document.createElement('span'); s.className='env-reveal-word';
        s.textContent = (i<arr.length-1) ? (w+' ') : w; // ← keep spaces permanently
        lineEl.appendChild(s); return s;
      });
      bar.appendChild(lineEl); return { lineEl, words };
    });
    bar.style.display='block';

    await revealWords(lines[0].words, half);
    await crossoverFade(lines[0].words, lines[1].words, half);
    await crossoverFade(lines[1].words, lines[2].words, half);
    await crossoverFade(lines[2].words, lines[3].words, half);
    await fadeWords(lines[3].words, half);

    bar.remove();
  }catch(err){ console.warn('[environment] runRevealSequence error', err); }
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

/* -------------------------------------------------------------------------
   Butterflies (normal) + Butterfly Party
   - Normal loop pauses during party
   - Party listens for: special-poem:begin / special-poem:end
   - Party: 8–12 butterflies orbit near special poem for ~60s, then disperse
---------------------------------------------------------------------------*/

/* Normal butterfly spawn */
let __butterflyLoopPaused = false;  // paused during party

function spawnButterfly(){
  if (__butterflyLoopPaused) return; // don't spawn normal ones during party
  try{
    const windVal = Number(window.__WINDS_SONG__.wind) || 5;
    const windFact= Math.max(0.1, windVal/5);

    const size=randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);
    const tint=(()=>{switch(poemStatus.state){
      case 'playing': return CFG.butterflies.tint.playing;
      case 'done':    return CFG.butterflies.tint.done;
      case 'warn':    return CFG.butterflies.tint.warn;
      default:        return CFG.butterflies.tint.waiting; }})();

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
    const baseTop=parseFloat(el.style.top);

    const base=randi(CFG.butterflies.baseTravelMsMin, CFG.butterflies.baseTravelMsMax);
    const travelMs=Math.max(800, Math.round(base/ windFact));
    const t0=performance.now();

    function anim(t){
      const k=clamp((t-t0)/travelMs,0,1);
      const x=startX + (endX-startX)*k;
      const y=baseTop + Math.sin(k*Math.PI*CFG.butterflies.flutterWaves)*CFG.butterflies.flutterAmp;
      el.style.transform=`translate(${x}px, ${y-baseTop}px)`;
      if(k<1) requestAnimationFrame(anim); else el.remove();
    }
    requestAnimationFrame(anim);
  }catch(err){ console.warn('[environment] spawnButterfly error', err); }
}

async function runButterfliesLoop(){
  try{
    await wait(randi(6_000,14_000)); if (!__butterflyLoopPaused) spawnButterfly();
    while(true){
      await wait(randi(60_000,90_000));
      if (!__butterflyLoopPaused) spawnButterfly();
    }
  }catch(err){ console.warn('[environment] butterfly loop error', err); }
}

/* Butterfly Party state */
let __partyActive = false;
let __partyEndTimer = null;
let __partyButterflies = []; // {el, rafId}

const PARTY_COLORS = [
  'rgba(255, 230, 120, 0.60)', // yellow
  'rgba(240,  80,  80, 0.60)', // red
  'rgba(140, 235, 170, 0.60)', // green
  'rgba(120, 180, 255, 0.60)', // blue
  'rgba(190, 120, 255, 0.60)', // purple
  'rgba(255, 120, 255, 0.60)'  // magenta
];

function pauseNormalButterflies(pause){
  __butterflyLoopPaused = !!pause;
}

function startButterflyParty(centerX, centerY, durationMs = 60_000){
  if (__partyActive) return;
  __partyActive = true;
  pauseNormalButterflies(true);

  const count = randi(8, 12);
  const windVal = Number(window.__WINDS_SONG__.wind) || 5;
  const windFact= Math.max(0.1, windVal/5);

  for (let i=0;i<count;i++){
    const size = randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax) + randi(-2,2);
    const tint = PARTY_COLORS[randi(0, PARTY_COLORS.length-1)];
    const el = document.createElement('div');
    el.className = 'env-butterfly-party';
    Object.assign(el.style,{
      left: '0px', top: '0px', width: `${size}px`, height:`${size}px`, opacity:'1',
      willChange:'transform'
    });
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

    const angle0 = rand(0, Math.PI*2);
    const speed  = rand(0.7, 1.4) * (windFact);
    const radius = rand(90, 140);
    const wobbleAmp = rand(6, 14);
    const flutterF  = rand(1.2, 2.2);

    const tStart = performance.now();
    function loop(t){
      if (!__partyActive) return;
      const elapsed = (t - tStart) / 1000;
      const a = angle0 + elapsed * speed;
      const r = radius + Math.sin(elapsed * 1.5) * wobbleAmp;
      const x = centerX + Math.cos(a) * r;
      const y = centerY + Math.sin(a) * r + Math.sin(elapsed * Math.PI * flutterF) * 8;
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      const rafId = requestAnimationFrame(loop);
      inst.rafId = rafId;
    }
    const inst = { el, rafId: null };
    inst.rafId = requestAnimationFrame(loop);
    __partyButterflies.push(inst);
  }

  clearTimeout(__partyEndTimer);
  __partyEndTimer = setTimeout(()=> endButterflyParty(), durationMs);
}

function endButterflyParty(){
  if (!__partyActive) return;
  __partyActive = false;
  clearTimeout(__partyEndTimer); __partyEndTimer = null;

  const dispersals = __partyButterflies.map(inst => new Promise(resolve=>{
    try { if (inst.rafId) cancelAnimationFrame(inst.rafId); } catch {}
    const el = inst.el;
    const startRect = el.getBoundingClientRect();
    const startX = startRect.left;
    const startY = startRect.top;
    const endX = (Math.random()<0.5) ? -80 : (window.innerWidth + 80);
    const endY = (Math.random()<0.5) ? -80 : (window.innerHeight + 80);
    const travelMs = randi(1200, 2000);
    const t0 = performance.now();
    function flyOff(t){
      const k = clamp((t - t0)/travelMs, 0, 1);
      const x = startX + (endX - startX) * k;
      const y = startY + (endY - startY) * k;
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      el.style.opacity = String(1 - k*0.7);
      if (k < 1) requestAnimationFrame(flyOff);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(flyOff);
  }));

  Promise.allSettled(dispersals).then(()=>{
    __partyButterflies = [];
    pauseNormalButterflies(false); // resume normal butterflies
  });
}

/* Party hooks (wire these from the special poem feature) */
window.addEventListener('special-poem:begin', (e)=>{
  try{
    let cx = window.innerWidth * 0.5;
    let cy = window.innerHeight * 0.65;
    const rect = e?.detail?.rect;
    if (rect && typeof rect.left === 'number') {
      cx = rect.left + rect.width / 2;
      cy = rect.top  + rect.height/ 2;
    }
    startButterflyParty(cx, cy, 60_000);
  }catch(err){ console.warn('[environment] special-poem:begin error', err); }
});
window.addEventListener('special-poem:end', ()=>{
  try{ endButterflyParty(); }catch(err){ console.warn('[environment] special-poem:end error', err); }
});

/* Helper: forward wind to environment.html background (iframe) */
function postWindToEnvironment(windVal) {
  try{
    const iframe = document.getElementById('environment-iframe');
    if (!iframe || !iframe.contentWindow) return;
    const wind = Number(windVal) || 5;
    iframe.contentWindow.postMessage({ type: 'WIND_UPDATE', wind }, '*');
  }catch(err){ console.warn('[environment] postWindToEnvironment error', err); }
}

/* Orchestrate (start everything) */
async function main(){
  try{
    // On load, forward current wind to background so canvas uses correct speed
    postWindToEnvironment(window.__WINDS_SONG__.wind);
  }catch{}
  runPoemDrift();
  runButterfliesLoop();
}
main();
