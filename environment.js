/* =========================================================================
   environment.js (drop-in)
   - No index.html changes; visuals unchanged
   - Wind controls poem drift speed (and spacing ratio), leaves handled in environment.html
   - Breath now affects butterfly motion ONLY
   - Final reveal timing is fixed (not user-controlled)
   - 5 on the Wind slider = current baseline speed
   - FIX: bottom reveal words spaced via CSS margins (no trimmed spaces)
   - FIX: bottom reveal bar fades out smoothly before removal
   - FIX: final reveal is gated until the LAST drifting line has fully left the screen
   ======================================================================== */

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp  = (a,b,t) => a + (b-a)*t;
const invLerp = (a,b,v) => clamp((v-a)/(b-a), 0, 1);

/* Restore settings early (so first cycle uses saved values) */
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
window.addEventListener("windsong:trigger", () => { if (typeof runPoemDrift === "function") runPoemDrift(); });

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
    baseFirstLineDelayMaxMs: 120_000,   // surprise window (0–120s)
    baseDriftDurationMs:     32_000,    // cross-screen baseline at Wind=5
    driftFontMin: 13, driftFontMax: 16,

    // Keep spacing visually similar regardless of speed:
    // between-lines delay = SPACING_RATIO * driftMs
    SPACING_RATIO: 0.50,                // 0.50 * 32s => ~16s at baseline Wind=5
    MIN_BETWEEN_MS: 2000
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30_000,      // wait after the LAST line has EXITED
    rowPadding: 10, fontSizePx: 16,
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)',

    // Fixed pacing (not controlled by any slider)
    FIXED_PAIR_MS: 15000,               // ~15s per two-line phase
    WORD_FADE_MS: 600,                  // per-word transition softness
    BAR_FADE_MS: 600                    // end fade for the bar
  },
  butterflies: {
    baseTravelMsMin: 18_000, baseTravelMsMax: 26_000,
    sizeMin: 20, sizeMax: 28,
    tint: {
      waiting:'rgba(255, 230, 120, 0.50)',
      playing:'rgba(120, 200, 255, 0.55)',
      done:   'rgba(140, 235, 170, 0.55)',
      warn:   'rgba(255, 120, 120, 0.55)'
    },
    // defaults; per-flight we’ll derive from Breath
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

/* Styles (includes word-spacing via margin-right on each word) */
(()=>{ const css = `
  .env-poem-line{position:absolute;white-space:nowrap;color:${CFG.colors.poemLine};
    text-shadow:0 1px 3px ${CFG.colors.poemShadow};opacity:.95;font-weight:600;letter-spacing:.2px;
    user-select:none;will-change:transform,opacity;pointer-events:none;}
  .env-reveal-bar{max-width:980px;width:calc(100vw - 24px);margin:0 12px 10px;
    background:${CFG.reveal.barBg};border:${CFG.reveal.border};border-radius:10px;
    padding:${CFG.reveal.rowPadding}px 14px;color:${CFG.colors.reveal};
    font-size:${CFG.reveal.fontSizePx}px;line-height:1.4;letter-spacing:.2px;display:none;text-align:center;}
  .env-reveal-line{display:inline-block;margin-right:.75em;white-space:nowrap;opacity:1;}
  .env-reveal-word{
    display:inline-block;opacity:0;will-change:opacity,transform;transform:translateY(4px);
    margin-right:.35em; /* persistent spacing between words */
  }
`; const tag=document.createElement('style'); tag.textContent=css; document.head.appendChild(tag);})();

/* Status */
const poemStatus = { state:'waiting', set(next){ this.state = next; } };

/* Poem drift (spacing tied to wind; breath NO LONGER used here) */
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

    let lastExitPromise = Promise.resolve();

    for (let i=0;i<CFG.poem.lines.length;i++){
      const windVal   = Number(window.__WINDS_SONG__.wind) || 5;
      const windFact  = Math.max(0.1, windVal/5);
      const driftMs   = Math.max(1000, Math.round(CFG.poem.baseDriftDurationMs / windFact));

      // spacing linked to current drift duration
      const betweenMs = Math.max(
        CFG.poem.MIN_BETWEEN_MS,
        Math.round(CFG.poem.SPACING_RATIO * driftMs)
      );

      // spawn and keep the promise for when this line fully exits
      lastExitPromise = spawnDriftingLine(CFG.poem.lines[i], driftMs);

      // wait the spacing time before launching the next line
      if (i < CFG.poem.lines.length - 1) {
        await wait(betweenMs);
      }
    }

    // >>> GATE the reveal until the LAST line has COMPLETELY left
    await lastExitPromise;

    if (CFG.reveal.enabled){
      await wait(CFG.reveal.appearAfterLastLineMs); // still keep the romantic pause
      await runRevealSequence();  // fixed pacing (not reading Elegra)
    }
    poemStatus.set('done');
  }catch(e){ console.error('Poem drift error:', e); poemStatus.set('warn'); }
  finally{ __windsSongRunInProgress=false; }
}

/* Return a promise that resolves when the line has fully exited and is removed */
function spawnDriftingLine(text, driftDurationMs){
  return new Promise((resolve) => {
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
      if (k<1) requestAnimationFrame(step);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(step);
  });
}

/* Bottom reveal (Fixed pacing — Elegra IGNORED here) */
async function runRevealSequence(){
  const pairTotalMs = CFG.reveal.FIXED_PAIR_MS;
  const half = 0.5 * pairTotalMs;

  const bar = document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);
  const lines = CFG.poem.lines.map(line=>{
    const lineEl=document.createElement('span'); lineEl.className='env-reveal-line';
    const words = line.split(' ').map((w)=>{
      const s=document.createElement('span'); s.className='env-reveal-word';
      s.textContent = w; // CSS margin provides spacing
      lineEl.appendChild(s); return s;
    });
    bar.appendChild(lineEl); return { lineEl, words };
  });
  bar.style.display='block';
  bar.style.opacity='1';

  const WMS = CFG.reveal.WORD_FADE_MS;

  await revealWords(lines[0].words, half, WMS);
  await crossoverFade(lines[0].words, lines[1].words, half, WMS);
  await crossoverFade(lines[1].words, lines[2].words, half, WMS);
  await crossoverFade(lines[2].words, lines[3].words, half, WMS);
  await fadeWords(lines[3].words, half, WMS);

  // Smooth bar fade-out before removal
  bar.style.transition = `opacity ${CFG.reveal.BAR_FADE_MS}ms ease`;
  bar.style.opacity = '0';
  await wait(CFG.reveal.BAR_FADE_MS + 50);
  bar.remove();
}

async function revealWords(words,totalMs,wordMs){
  const per=totalMs/Math.max(1,words.length);
  for(let i=0;i<words.length;i++){
    const w=words[i];
    w.style.transition=`opacity ${wordMs}ms ease, transform ${wordMs}ms ease`;
    w.style.opacity='1'; w.style.transform='translateY(0px)';
    await wait(per);
  }
}
async function crossoverFade(outgoing,incoming,totalMs,wordMs){
  const steps=Math.max(outgoing.length,incoming.length), per=totalMs/Math.max(1,steps);
  for(let i=0;i<steps;i++){
    if(i<incoming.length){
      const w=incoming[i];
      w.style.transition=`opacity ${wordMs}ms ease, transform ${wordMs}ms ease`;
      w.style.opacity='1'; w.style.transform='translateY(0px)';
    }
    if(i<outgoing.length){
      const w=outgoing[i];
      w.style.transition=`opacity ${wordMs}ms ease, transform ${wordMs}ms ease`;
      w.style.opacity='0'; w.style.transform='translateY(4px)';
    }
    await wait(per);
  }
}
async function fadeWords(words,totalMs,wordMs){
  const per=totalMs/Math.max(1,words.length);
  for(let i=0;i<words.length;i++){
    const w=words[i];
    w.style.transition=`opacity ${wordMs}ms ease, transform ${wordMs}ms ease`;
    w.style.opacity='0'; w.style.transform='translateY(4px)';
    await wait(per);
  }
}

/* Butterfly (Wind affects speed; Breath affects flutter style ONLY) */
function spawnButterfly(){
  const windVal = Number(window.__WINDS_SONG__.wind) || 5;
  const windFact= Math.max(0.1, windVal/5);

  const breathS = Number(window.__WINDS_SONG__.breath) || 16;
  const t = invLerp(6, 30, breathS);              // 0..1 across slider range
  const waves = lerp(3.0, 1.6, t);                // fewer waves as breath increases
  const amp   = Math.round(lerp(36, 16, t));      // smaller amplitude as breath increases

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

  function anim(tnow){
    const k=clamp((tnow-t0)/travelMs,0,1);
    const x=startX + (endX-startX)*k;
    const y=baseTop + Math.sin(k*Math.PI*waves)*amp;
    el.style.transform=`translate(${x}px, ${y-baseTop}px)`;
    if(k<1) requestAnimationFrame(anim); else el.remove();
  }
  requestAnimationFrame(anim);
}
async function runButterfliesLoop(){
  await wait(randi(6_000,14_000)); spawnButterfly();
  while(true){ await wait(randi(60_000,90_000)); spawnButterfly(); }
}

/* Orchestrate */
async function main(){ runPoemDrift(); runButterfliesLoop(); }
main();
