/* =========================================================================
   environment.js (drop-in)
   - Wind affects speed of leaves (via environment.html), drifting lines, butterflies
   - Breath (1..10) affects only butterflies’ oscillation (amplitude/frequency)
   - Poem line spacing consistent across wind speeds
   - Final reveal only after last line leaves; fixed pacing, word spacing preserved
   - Butterflies: state colors + interactions + party on special-poem:show
   - Rez scheduler:
       * rez === 1  → NO replays; only once per page refresh (initial run)
       * rez  >  1  → rez/60 replays per hour, aligned to top-of-hour
   ======================================================================== */

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Restore settings if controller loads later */
(function restoreWindsSongFromStorage(){
  try {
    const raw = localStorage.getItem('windsong.settings.v2');
    if (!raw) return;
    const s = JSON.parse(raw);
    window.__WINDS_SONG__ = window.__WINDS_SONG__ || {};
    if (s.wind   != null) window.__WINDS_SONG__.wind   = Number(s.wind);
    if (s.breath != null) window.__WINDS_SONG__.breath = Number(s.breath);
    if (s.rez    != null) window.__WINDS_SONG__.rez    = Number(s.rez);
  } catch {}
})();

/* Shared state + listeners */
window.__WINDS_SONG__ = window.__WINDS_SONG__ || { wind:5, breath:5, rez:1 };
window.addEventListener("windsong:update", (e) => {
  const { wind, breath, rez } = e.detail || {};
  if (wind   !== undefined) window.__WINDS_SONG__.wind   = Number(wind);
  if (breath !== undefined) window.__WINDS_SONG__.breath = Number(breath);
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
    baseFirstLineDelayMaxMs: 120_000,
    baseDriftDurationMs:     32_000,    // at Wind=5
    driftFontMin: 13, driftFontMax: 16,
    baseSpacingSec:          20         // locked visual read-time
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30_000,      // only AFTER last line fully left
    rowPadding: 10, fontSizePx: 16,
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)',
    fixedPairMs: 15000                  // fixed pacing; NOT user-controlled
  },
  butterflies: {
    baseTravelMsMin: 18_000, baseTravelMsMax: 26_000,
    sizeMin: 20, sizeMax: 28,
    flutterWavesBase: 2,
    flutterAmpBase: 28,
    tint: {
      waiting: 'rgba(255, 230, 120, 0.55)', // yellow on load/waiting
      playing: 'rgba(255,  80,  80, 0.60)', // red while poem drift is running
      done:    'rgba(140, 235, 170, 0.60)', // green after finished
      blue:    'rgba( 80, 160, 255, 0.65)',
      magenta: 'rgba(220,  90, 220, 0.65)',
      purple:  'rgba(160, 110, 255, 0.65)',
      cyan:    'rgba( 90, 220, 220, 0.65)'
    },
    spawnMinMs: 60_000, spawnMaxMs: 90_000,
    collideRadius: 55,
    partyCountMin: 8, partyCountMax: 12,
    partyDurationMs: 60_000
  }
};

/* Layers */
const envRoot = (() => { let el=document.getElementById('env-root');
  if(!el){ el=document.createElement('div'); el.id='env-root';
    Object.assign(el.style,{position:'fixed',inset:'0',zIndex:'0',pointerEvents:'none'});
    document.body.appendChild(el);} return el; })();
const leavesLayer = (() => { let el=document.getElementById('env-leaves');
  if(!el){ el=document.createElement('div'); el.id='env-leaves';
    Object.assign(el.style,{position:'absolute',inset:'0',zIndex:String(CFG.z.leaves),pointerEvents:'none'});
    envRoot.appendChild(el);} return el; })();
const poemLayer = (() => { let el=document.getElementById('env-poem');
  if(!el){ el=document.createElement('div'); el.id='env-poem';
    Object.assign(el.style,{position:'absolute',inset:'0',zIndex:String(CFG.z.poem),pointerEvents:'none',overflow:'hidden'});
    envRoot.appendChild(el);} return el; })();
const revealLayer = (() => { let el=document.getElementById('env-reveal');
  if(!el){ el=document.createElement('div'); el.id='env-reveal';
    Object.assign(el.style,{position:'fixed',left:'0',right:'0',bottom:'0',
      zIndex:String(CFG.z.reveal),pointerEvents:'none',display:'flex',justifyContent:'center'});
    document.body.appendChild(el);} return el; })();

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
const poemStatus = { state:'waiting', set(next){ this.state=next; } };

/* ---------------- Poem drift (dynamic spacing) ---------------- */
let __windsSongRunInProgress=false;
async function runPoemDrift(){
  if(__windsSongRunInProgress) return;
  __windsSongRunInProgress=true;
  try{
    const firstDelayMs = randi(0, CFG.poem.baseFirstLineDelayMaxMs);
    await wait(firstDelayMs);
    poemStatus.set('playing');

    const windVal = Number(window.__WINDS_SONG__.wind)||5;
    const windFact= Math.max(0.1, windVal/5);
    const completions=[];

    for(let i=0;i<CFG.poem.lines.length;i++){
      const driftMs=Math.max(1000, Math.round(CFG.poem.baseDriftDurationMs/windFact));
      const doneP=spawnDriftingLine(CFG.poem.lines[i], driftMs);
      completions.push(doneP);
      if(i<CFG.poem.lines.length-1){
        // keep visual spacing constant regardless of speed
        const scale=CFG.poem.baseDriftDurationMs/driftMs;
        const gapMs=Math.max(500, Math.round(CFG.poem.baseSpacingSec*1000*scale));
        await wait(gapMs);
      }
    }
    // reveal only after last line fully left
    await completions[completions.length-1];
    if(CFG.reveal.enabled){ await wait(CFG.reveal.appearAfterLastLineMs); await runRevealSequence(); }
    poemStatus.set('done');
  }catch(e){console.error('Poem drift error:',e);}
  finally{__windsSongRunInProgress=false;}
}
function spawnDriftingLine(text,driftDurationMs){
  return new Promise(resolve=>{
    const el=document.createElement('div'); el.className='env-poem-line'; el.textContent=text;
    const fs=randi(CFG.poem.driftFontMin,CFG.poem.driftFontMax); el.style.fontSize=fs+'px';
    const y=randi(90,Math.max(150,window.innerHeight-100)); el.style.top=y+'px';
    const startX=-Math.max(120,text.length*(fs*0.6)); const endX=window.innerWidth+80;
    poemLayer.appendChild(el);
    const t0=performance.now(), peak=0.95;
    function step(t){
      const k=clamp((t-t0)/driftDurationMs,0,1);
      const x=startX+(endX-startX)*k;
      el.style.transform=`translate(${x}px,0)`;
      const fadeIn=Math.min(1,k/0.20), fadeOut=Math.min(1,(1-k)/0.20);
      el.style.opacity=String(peak*Math.min(fadeIn,fadeOut));
      if(k<1) requestAnimationFrame(step); else {el.remove();resolve();}
    }
    requestAnimationFrame(step);
  });
}

/* ---------------- Reveal (fixed pacing; preserves spaces) ---------------- */
async function runRevealSequence(){
  const half=0.5*CFG.reveal.fixedPairMs;
  const bar=document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);
  const lines=CFG.poem.lines.map(line=>{
    const lineEl=document.createElement('span'); lineEl.className='env-reveal-line';
    const words=line.split(' ').map((w,i,arr)=>{
      const s=document.createElement('span'); s.className='env-reveal-word';
      s.textContent=(i<arr.length-1)?(w+' '):w; // <- preserve spacing always
      lineEl.appendChild(s); return s;
    });
    bar.appendChild(lineEl); return {lineEl,words};
  });
  bar.style.display='block';
  await revealWords(lines[0].words,half);
  await crossoverFade(lines[0].words,lines[1].words,half);
  await crossoverFade(lines[1].words,lines[2].words,half);
  await crossoverFade(lines[2].words,lines[3].words,half);
  await fadeWords(lines[3].words,half);
  bar.remove(); poemStatus.set('free');
}
async function revealWords(words,totalMs){const per=totalMs/Math.max(1,words.length);
  for(let i=0;i<words.length;i++){const w=words[i];w.style.transition='opacity 600ms ease,transform 600ms ease';
    w.style.opacity='1';w.style.transform='translateY(0)';await wait(per);}}
async function crossoverFade(out,incoming,totalMs){const steps=Math.max(out.length,incoming.length),per=totalMs/Math.max(1,steps);
  for(let i=0;i<steps;i++){if(i<incoming.length){const w=incoming[i];w.style.transition='opacity 600ms ease,transform 600ms ease';
      w.style.opacity='1';w.style.transform='translateY(0)';}
    if(i<out.length){const w=out[i];w.style.transition='opacity 600ms ease,transform 600ms ease';
      w.style.opacity='0';w.style.transform='translateY(4px)';}await wait(per);}}
async function fadeWords(words,totalMs){const per=totalMs/Math.max(1,words.length);
  for(let i=0;i<words.length;i++){const w=words[i];w.style.transition='opacity 600ms ease,transform 600ms ease';
    w.style.opacity='0';w.style.transform='translateY(4px)';await wait(per);}}

/* ---------------- Butterflies: spawn, interactions, party ---------------- */
const butterflies = new Set();
let partyMode = false;
const pageStartTs = Date.now();

function currentTint(){
  switch (poemStatus.state) {
    case 'playing': return CFG.butterflies.tint.playing; // red during drift
    case 'done':    return CFG.butterflies.tint.done;    // green after
    case 'warn':    return CFG.butterflies.tint.waiting;
    default: {
      // Free state → richer palette (random)
      const pool = [
        CFG.butterflies.tint.blue,
        CFG.butterflies.tint.magenta,
        CFG.butterflies.tint.purple,
        CFG.butterflies.tint.cyan
      ];
      return pool[randi(0,pool.length-1)];
    }
  }
}

function spawnButterfly(opts={}){
  const windVal = Number(window.__WINDS_SONG__.wind) || 5;
  const windFact= Math.max(0.1, windVal/5);

  const breath= Number(window.__WINDS_SONG__.breath) || 5;
  const breathFactor = 0.6 + (breath/10) * 1.0; // 0.6..1.6

  const size = opts.size || randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);
  const tint = opts.tint || currentTint();

  const el = document.createElement('div');
  Object.assign(el.style, {
    position:'absolute', top:`${randi(40, Math.max(120, window.innerHeight/2))}px`,
    left:'0px', width:`${size}px`, height:`${size}px`, opacity:'1',
    pointerEvents:'none', zIndex:String(CFG.z.leaves), willChange:'transform'
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

  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -40 : (window.innerWidth + 40);
  const endX   = fromLeft ? (window.innerWidth + 40) : -40;
  const baseTop = parseFloat(el.style.top);

  const base = randi(CFG.butterflies.baseTravelMsMin, CFG.butterflies.baseTravelMsMax);
  const travelMs = Math.max(800, Math.round(base / windFact));
  const waves = CFG.butterflies.flutterWavesBase * breathFactor;
  const amp   = CFG.butterflies.flutterAmpBase   * breathFactor;

  const bfly = { el, baseTop, startX, endX, travelMs, t0:performance.now(), waves, amp, size, interacting:false, party: !!opts.party };
  butterflies.add(bfly);

  function anim(t){
    if (bfly.interacting) return; // path is controlled by interaction routine
    const k = clamp((t - bfly.t0) / bfly.travelMs, 0, 1);
    const x = bfly.startX + (bfly.endX - bfly.startX) * k;
    const y = bfly.baseTop + Math.sin(k * Math.PI * bfly.waves) * bfly.amp;
    el.style.transform = `translate(${x}px, ${y - bfly.baseTop}px)`;
    if (k < 1 && !bfly.party) { requestAnimationFrame(anim); }
    else if (k < 1 && bfly.party) { requestAnimationFrame(anim); }
    else { cleanupButterfly(bfly); }
  }
  requestAnimationFrame(anim);
  return bfly;
}

function cleanupButterfly(bfly){
  butterflies.delete(bfly);
  if (bfly.el && bfly.el.parentNode) bfly.el.parentNode.removeChild(bfly.el);
}

/* Pair interactions when close */
let interactionCooldown = 0;
function checkInteractions(){
  const now = Date.now();
  const firstFiveMinBoost = (now - pageStartTs) < 5*60*1000 ? 3 : 1; // higher chance early
  const baseChance = 0.02 * firstFiveMinBoost; // per check when in radius

  if (interactionCooldown > now) return;

  const arr = Array.from(butterflies).filter(b => !b.interacting && !b.party);
  for (let i=0;i<arr.length;i++){
    for (let j=i+1;j<arr.length;j++){
      const a = arr[i], b = arr[j];
      const ra = a.el.getBoundingClientRect();
      const rb = b.el.getBoundingClientRect();
      const ax = ra.left + ra.width/2, ay = ra.top + ra.height/2;
      const bx = rb.left + rb.width/2, by = rb.top + rb.height/2;
      const dist = Math.hypot(ax - bx, ay - by);
      if (dist <= CFG.butterflies.collideRadius && Math.random() < baseChance){
        startInteractionDance(a, b);
        interactionCooldown = now + 5000; // small cooldown before next pair dance
        return;
      }
    }
  }
}
function startInteractionDance(a, b){
  a.interacting = b.interacting = true;
  const ra = a.el.getBoundingClientRect();
  const rb = b.el.getBoundingClientRect();
  const centerX = (ra.left + rb.left)/2;
  const centerY = (ra.top  + rb.top )/2;
  const start = performance.now();
  const duration = 4000; // 4s dance

  function orbit(el, radius, phase, t){
    const k = clamp((t - start) / duration, 0, 1);
    const theta = phase + k * Math.PI * 2;
    const x = centerX + radius * Math.cos(theta);
    const y = centerY + radius * Math.sin(theta);
    el.style.transform = `translate(${x}px, ${y}px)`;
  }
  function step(t){
    orbit(a.el, 30, 0, t);
    orbit(b.el, 30, Math.PI, t);
    if (t - start < duration) requestAnimationFrame(step);
    else {
      a.interacting = b.interacting = false;
      a.t0 = performance.now();
      b.t0 = performance.now();
    }
  }
  requestAnimationFrame(step);
}
setInterval(checkInteractions, 400);

/* Party on special poem */
window.addEventListener('special-poem:show', () => {
  if (partyMode) return;
  partyMode = true;
  const count = randi(CFG.butterflies.partyCountMin, CFG.butterflies.partyCountMax);
  for (let i=0;i<count;i++){
    spawnButterfly({ party:true, size:randi(22,30) });
  }
  setTimeout(()=>{ partyMode=false; }, CFG.butterflies.partyDurationMs);
});

/* Regular butterfly loop */
async function runButterfliesLoop(){
  await wait(randi(6_000,14_000));
  spawnButterfly();
  while(true){
    const t = randi(CFG.butterflies.spawnMinMs, CFG.butterflies.spawnMaxMs);
    await wait(t);
    spawnButterfly();
  }
}

/* ---------------- Rez scheduler (top-of-hour aligned) ----------------
   rez === 1: NO replays are scheduled at all (only initial run)
   rez  >  1: schedule rez/60 replays each hour, aligned to the next hour
--------------------------------------------------------------------- */
let __rezSchedulerStarted=false;
let __rezBucketTimer=null;
let __rezReplayTimers=[];

function clearReplayTimers(){ __rezReplayTimers.forEach(id=>clearTimeout(id)); __rezReplayTimers=[]; }

function startRezScheduler(){
  if(__rezSchedulerStarted) return;
  __rezSchedulerStarted=true;

  function planBucket(){
    clearTimeout(__rezBucketTimer);
    clearReplayTimers();

    const now = new Date();
    const rez = Number(window.__WINDS_SONG__.rez) || 1;

    // Next hour boundary; changes to rez apply on next hour
    const nextHourStart = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()+1, 0, 0, 0
    ).getTime();
    const bucketEnd = nextHourStart + 60*60*1000;

    if (rez > 1) {
      const period = (60*60*1000) / rez;
      for (let i=0; i<rez; i++){
        const t = nextHourStart + period * i;
        if (t > now.getTime() && t < bucketEnd){
          const id = setTimeout(()=>{
            if (!__windsSongRunInProgress) runPoemDrift();
          }, t - now.getTime());
          __rezReplayTimers.push(id);
        }
      }
    }
    // Always plan next bucket
    __rezBucketTimer = setTimeout(planBucket, Math.max(1000, bucketEnd - now.getTime()));
  }

  planBucket();
}

/* ---------------- Orchestrate ---------------- */
async function main(){
  runPoemDrift();           // initial once-per-refresh run
  runButterfliesLoop();     // ambient butterflies
  startRezScheduler();      // hourly planner (no-op when rez === 1)
}
main();
