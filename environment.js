<script>
// =========================================================================
// environment.js (drop-in)
// - No index.html changes
// - Wind Song: runs once per refresh here; repeats per hour handled by controller
// - Final reveal only after last line fully exits; word spacing enforced
// - Wind-invariant on-screen spacing (inter-line gap scales with drift)
// - Breath => butterfly oscillation (amplitude/frequency), NOT poem spacing
// - Butterfly proximity dance + early 5-min bias; party for special poem
// - Status colors: waiting(yellow) -> playing(RED) -> done(green); free palette otherwise
// =========================================================================

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Restore settings early if present (non-blocking; safe if controller loads later) */
(function restoreWindsSongFromStorage(){
  try {
    const raw = localStorage.getItem('windsong.settings.v1');
    if (!raw) return;
    const s = JSON.parse(raw);
    window.__WINDS_SONG__ = window.__WINDS_SONG__ || {};
    if (s.wind   != null) window.__WINDS_SONG__.wind   = Number(s.wind);
    if (s.breath != null) window.__WINDS_SONG__.breath = Number(s.breath);
    if (s.elegra != null) window.__WINDS_SONG__.elegra = Number(s.elegra); // kept; no longer drives reveal speed
    if (s.rez    != null) window.__WINDS_SONG__.rez    = Number(s.rez);
  } catch {}
})();

/* Shared state + listeners */
window.__WINDS_SONG__ = window.__WINDS_SONG__ || { wind:5, breath:16, elegra:15, rez:1 };
window.addEventListener("windsong:update", (e) => {
  const { wind, breath, elegra, rez } = e.detail || {};
  if (wind   !== undefined) window.__WINDS_SONG__.wind   = Number(wind);
  if (breath !== undefined) window.__WINDS_SONG__.breath = Number(breath); // now affects butterfly oscillation
  if (elegra !== undefined) window.__WINDS_SONG__.elegra = Number(elegra);
  if (rez    !== undefined) window.__WINDS_SONG__.rez    = Number(rez);
});
window.addEventListener("windsong:trigger", () => {
  if (!__suspendWindsSong) runPoemDrift();
});

/* Special poem party hooks (provided by index.html app) */
let __suspendWindsSong = false;
window.addEventListener('special-poem:begin', () => {
  __suspendWindsSong = true;
  startButterflyParty( /* durationMs */ 60_000, /* count range */ [8,12] );
});
window.addEventListener('special-poem:end', () => {
  __suspendWindsSong = false;
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
    // desired visual gap: base seconds at baseline wind (maps proportionally)
    baseGapSeconds: 16
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 0, // UNUSED now; we trigger exactly after last line exits
    rowPadding: 10, fontSizePx: 16,
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)',
    fixedPhaseSecondsPerPair: 15 // slow, smooth, beautiful; not user-controlled
  },
  butterflies: {
    baseTravelMsMin: 18_000, baseTravelMsMax: 26_000,
    sizeMin: 20, sizeMax: 28,
    tint: {
      waiting:'rgba(255, 230, 120, 0.60)', // yellow
      playing:'rgba(240, 80, 80, 0.60)',   // RED during Wind’s Song
      done:   'rgba(140, 235, 170, 0.60)', // green after Wind’s Song
      warn:   'rgba(255, 140, 80, 0.60)'   // orange/red warning
    },
    palette: [
      'rgba(120,190,255,0.60)', // blue
      'rgba(200,140,255,0.60)', // purple
      'rgba(255,120,210,0.60)', // magenta
      'rgba(120,255,210,0.60)', // aqua-green
      'rgba(255,200,120,0.60)'  // soft amber
    ],
    flutterWavesBase: 2.0, flutterAmpBase: 28,
    // Breath remap ranges (Breath min..max -> these ranges)
    breathAmpRange: [16, 48],
    breathWaveRange: [1.2, 3.8],
    interactRadiusPx: 55,
    interactCooldownMs: 6000,
    earlyBiasMinutes: 5,            // elevated interaction probability in first 5 minutes
    earlyBiasMultiplier: 2.0        // doubles chance early on
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

/* Poem drift with wind-invariant on-screen spacing */
let __windsSongRunInProgress = false;
let __pageStartTs = performance.now();

async function runPoemDrift(){
  if (__windsSongRunInProgress || __suspendWindsSong) return;
  __windsSongRunInProgress = true;
  try{
    const firstDelayMs = randi(0, CFG.poem.baseFirstLineDelayMaxMs);
    let started = false;
    (async()=>{ await wait(130_000); if(!started) poemStatus.set('warn'); })();

    await wait(firstDelayMs);
    if (__suspendWindsSong) return;
    started = true; poemStatus.set('playing');

    const windVal   = Number(window.__WINDS_SONG__.wind) || 5;
    const windFact  = Math.max(0.1, windVal/5);
    const driftMs   = Math.max(1000, Math.round(CFG.poem.baseDriftDurationMs / windFact));

    // Keep visual spacing constant: gap scales with drift duration
    const gapMs = Math.round(CFG.poem.baseGapSeconds * 1000 * (driftMs / CFG.poem.baseDriftDurationMs));

    const exitPromises = [];
    for (let i=0;i<CFG.poem.lines.length;i++){
      if (__suspendWindsSong) break;
      exitPromises.push(spawnDriftingLine(CFG.poem.lines[i], driftMs));
      if (i < CFG.poem.lines.length - 1){
        await wait(gapMs);
      }
    }

    // Wait for the last line to FULLY exit before reveal
    if (CFG.reveal.enabled && !__suspendWindsSong) {
      try { await exitPromises[exitPromises.length-1]; } catch {}
      if (!__suspendWindsSong) await runRevealSequence();
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
  return new Promise(res=>{
    function step(t){
      const k = clamp((t-t0)/driftDurationMs,0,1);
      const x = startX + (endX - startX)*k;
      el.style.transform = `translate(${x}px,0)`;
      const fadeIn = Math.min(1, k/0.20), fadeOut = Math.min(1, (1-k)/0.20);
      el.style.opacity = String(peak * Math.min(fadeIn, fadeOut));
      if (k<1) requestAnimationFrame(step);
      else { el.remove(); res(); }
    }
    requestAnimationFrame(step);
  });
}

/* Bottom reveal (fixed slow pacing; spaces preserved; console self-check) */
async function runRevealSequence(){
  const pairTotalMs = Math.max(1000, Math.round(CFG.reveal.fixedPhaseSecondsPerPair * 1000));
  const half = 0.5 * pairTotalMs;

  const bar = document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);

  const lines = CFG.poem.lines.map(line=>{
    const lineEl=document.createElement('span'); lineEl.className='env-reveal-line';
    const wordsRaw = line.split(' ');
    const words = wordsRaw.map((w,i,arr)=>{
      const s=document.createElement('span'); s.className='env-reveal-word';
      s.textContent = (i<arr.length-1) ? (w+' ') : w; // preserve spaces
      lineEl.appendChild(s); return s;
    });
    bar.appendChild(lineEl); return { lineEl, words };
  });
  bar.style.display='block';

  // quick self-check: if first line’s rendered text has no spaces, warn (minifier issue)
  try {
    const testText = lines[0].lineEl.textContent || '';
    if (!/\s/.test(testText)) console.warn('[Wind Song] Reveal spacing check failed (no spaces detected).');
  } catch {}

  await revealWords(lines[0].words, half);
  await crossoverFade(lines[0].words, lines[1].words, half);
  await crossoverFade(lines[1].words, lines[2].words, half);
  await crossoverFade(lines[2].words, lines[3].words, half);
  await fadeWords(lines[3].words, half);

  // Smooth bar fade-out instead of pop
  bar.style.transition = 'opacity 900ms ease';
  bar.style.opacity = '0';
  await wait(1000);
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

/* Butterfly system with oscillation (Breath), proximity dance, and party mode */
const __butterflies = new Set();

function currentOscillationSettings(){
  const breath = Number(window.__WINDS_SONG__.breath) || 16;
  const t = clamp((breath-6)/(30-6), 0, 1); // normalize from slider min..max
  const amp = CFG.butterflies.breathAmpRange[0] + t*(CFG.butterflies.breathAmpRange[1]-CFG.butterflies.breathAmpRange[0]);
  const waves = CFG.butterflies.breathWaveRange[0] + t*(CFG.butterflies.breathWaveRange[1]-CFG.butterflies.breathWaveRange[0]);
  return { amp, waves };
}
function pickTintFreeFlight(){
  const p = CFG.butterflies.palette;
  return p[randi(0, p.length-1)];
}
function currentStatusTint(){
  switch (poemStatus.state) {
    case 'playing': return CFG.butterflies.tint.playing; // RED
    case 'done':    return CFG.butterflies.tint.done;
    case 'warn':    return CFG.butterflies.tint.warn;
    default:        return CFG.butterflies.tint.waiting;
  }
}
function spawnButterfly(customTint){
  const windVal = Number(window.__WINDS_SONG__.wind) || 5;
  const windFact= Math.max(0.1, windVal/5);

  const size=randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);
  const partyOrStatus = customTint ?? (poemStatus.state === 'playing' || poemStatus.state === 'waiting' || poemStatus.state === 'done' || poemStatus.state === 'warn'
                        ? currentStatusTint()
                        : pickTintFreeFlight());

  const el=document.createElement('div');
  Object.assign(el.style,{position:'absolute',top:`${randi(40, Math.max(120, window.innerHeight/2))}px`,
    left:'0px',width:`${size}px`,height:`${size}px`,opacity:'1',pointerEvents:'none',
    zIndex:String(CFG.z.leaves),willChange:'transform'});
  el.innerHTML = `
    <svg viewBox="0 0 120 80" width="${size}" height="${size}" style="display:block">
      <defs><filter id="bshadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/></filter></defs>
      <g filter="url(#bshadow)">
        <path d="M60,40 C30,5 5,5 10,35 C15,60 35,55 60,40 Z" fill="${partyOrStatus}"/>
        <path d="M60,40 C90,5 115,5 110,35 C105,60 85,55 60,40 Z" fill="${partyOrStatus}"/>
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

  // register in global set for interaction checks
  const bfly = { el, startX, endX, baseTop, t0, travelMs, fromLeft,
                 phaseSeed: Math.random()*Math.PI*2, cooling:false };
  __butterflies.add(bfly);

  function anim(t){
    // if removed or finished
    if (!el.isConnected) { __butterflies.delete(bfly); return; }

    const k=clamp((t-t0)/travelMs,0,1);
    const { amp, waves } = currentOscillationSettings();
    const x=startX + (endX-startX)*k;
    const y=baseTop + Math.sin(k*Math.PI*waves + bfly.phaseSeed)*amp;
    el.style.transform=`translate(${x}px, ${y-baseTop}px)`;

    if (k<1) requestAnimationFrame(anim);
    else { __butterflies.delete(bfly); el.remove(); }
  }
  requestAnimationFrame(anim);
  return bfly;
}

// Interaction check loop (circling “dance” when within radius, with cooldown)
(function interactionLoop(){
  const partyBiasUntil = __pageStartTs + CFG.butterflies.earlyBiasMinutes*60_000;
  function step(){
    const now = performance.now();
    const bias = (now < partyBiasUntil) ? CFG.butterflies.earlyBiasMultiplier : 1.0;

    const arr = Array.from(__butterflies);
    for (let i=0;i<arr.length;i++){
      for (let j=i+1;j<arr.length;j++){
        const A = arr[i], B = arr[j];
        if (!A || !B || A.cooling || B.cooling) continue;
        const rectA = A.el.getBoundingClientRect();
        const rectB = B.el.getBoundingClientRect();
        const ax = rectA.left + rectA.width/2, ay = rectA.top + rectA.height/2;
        const bx = rectB.left + rectB.width/2, by = rectB.top + rectB.height/2;
        const dx = ax - bx, dy = ay - by;
        const dist = Math.hypot(dx, dy);
        if (dist <= CFG.butterflies.interactRadiusPx && Math.random() < 0.006 * bias){
          // start a brief dance
          doPairDance(A, B, 1800 + randi(0,800));
        }
      }
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  function doPairDance(A,B,dur){
    A.cooling = B.cooling = true;
    const t0 = performance.now();
    const cx = () => {
      const ra = A.el.getBoundingClientRect(), rb = B.el.getBoundingClientRect();
      return (ra.left+ra.width/2 + rb.left+rb.width/2)/2;
    };
    const cy = () => {
      const ra = A.el.getBoundingClientRect(), rb = B.el.getBoundingClientRect();
      return (ra.top+ra.height/2 + rb.top+rb.height/2)/2;
    };
    const r = CFG.butterflies.interactRadiusPx*0.6;

    const animA = (t)=>{
      if (!A.el.isConnected) return;
      const k = clamp((t-t0)/dur, 0, 1);
      const ang = k* Math.PI*2*1.25;
      A.el.style.transform = `translate(${(cx()+Math.cos(ang)*r) - (A.el.offsetLeft)}px, ${(cy()+Math.sin(ang)*r) - (A.el.offsetTop)}px)`;
      if (k<1) requestAnimationFrame(animA);
    };
    const animB = (t)=>{
      if (!B.el.isConnected) return;
      const k = clamp((t-t0)/dur, 0, 1);
      const ang = -k* Math.PI*2*1.25;
      B.el.style.transform = `translate(${(cx()+Math.cos(ang)*r) - (B.el.offsetLeft)}px, ${(cy()+Math.sin(ang)*r) - (B.el.offsetTop)}px)`;
      if (k<1) requestAnimationFrame(animB);
    };
    requestAnimationFrame(animA);
    requestAnimationFrame(animB);

    setTimeout(()=>{ A.cooling=false; B.cooling=false; }, CFG.butterflies.interactCooldownMs);
  }
})();

// Butterfly party (special poem only)
let __partyTimer = null;
function startButterflyParty(durationMs, countRange){
  if (__partyTimer) { clearTimeout(__partyTimer); __partyTimer=null; }
  const [minC,maxC] = countRange;
  const count = randi(minC, maxC);
  for (let i=0;i<count;i++){
    // spawn with colorful palette during party
    spawnButterfly( pickTintFreeFlight() );
  }
  __partyTimer = setTimeout(()=>{ __partyTimer=null; }, durationMs);
}

/* Loop spawner */
async function runButterfliesLoop(){
  await wait(randi(6_000,14_000)); spawnButterfly();
  while(true){ await wait(randi(60_000,90_000)); spawnButterfly(); }
}

/* Orchestrate */
async function main(){ 
  runPoemDrift(); 
  runButterfliesLoop(); 
}
main();
</script>
