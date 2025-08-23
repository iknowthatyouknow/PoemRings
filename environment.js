/* =========================================================================
   environment.js (drop-in)
   - No index.html changes; visuals unchanged
   - Wind controls overall motion speed (poem drift + butterfly flight)
   - Breath controls butterfly oscillation (amplitude & wave count)
   - Poem inter-line spacing auto-scales with wind (constant visual spacing)
   - Final reveal starts only after last drift line leaves the screen
   - Butterfly "dance" interaction: bigger radius + higher odds in first 5 min
   ======================================================================== */

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp  = (a, b, t) => a + (b - a) * t;

/* Restore controller settings if present */
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

/* Shared state + listeners (defaults) */
window.__WINDS_SONG__ = window.__WINDS_SONG__ || { wind:5, breath:16, elegra:15, rez:1 };
window.addEventListener("windsong:update", (e) => {
  const { wind, breath, elegra, rez } = e.detail || {};
  if (wind   !== undefined) window.__WINDS_SONG__.wind   = Number(wind);
  if (breath !== undefined) window.__WINDS_SONG__.breath = Number(breath); // now: butterfly oscillation
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
    baseFirstLineDelayMaxMs: 120_000,   // surprise window
    baseDriftDurationMs:     32_000,    // cross-screen baseline at Wind=5
    driftFontMin: 13, driftFontMax: 16
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30_000, // starts counting AFTER last line fully exits
    rowPadding: 10, fontSizePx: 16,
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
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
    // Interaction tuning
    interactRadiusPx: 55,        // was smaller; now 55px
    interactChanceEarly: 0.7,    // first 5 minutes
    interactChanceNormal: 0.4,   // after 5 minutes
    interactCooldownMs: 20_000,  // per butterfly cooldown
    danceDurationMs: 1600        // circle dance time
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
const sessionStartTS = performance.now();
const poemStatus = { state:'waiting', set(next){ this.state = next; } };

/* =======================
   Poem drift (wind-linked spacing)
   ======================= */
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

    const driftPromises = [];

    for (let i=0;i<CFG.poem.lines.length;i++){
      // Wind: 5 = baseline → factor = wind/5
      const windVal   = Number(window.__WINDS_SONG__.wind) || 5;
      const windFact  = Math.max(0.1, windVal/5);
      const driftMs   = Math.max(1200, Math.round(CFG.poem.baseDriftDurationMs / windFact));

      // Launch this line (returns a promise that resolves when it leaves screen)
      const p = spawnDriftingLine(CFG.poem.lines[i], driftMs);
      driftPromises.push(p);

      if (i < CFG.poem.lines.length - 1){
        // Auto spacing: next line starts halfway through previous line's crossing
        const gapMs = Math.round(0.5 * driftMs);
        await wait(gapMs);
      }
    }

    // Wait for the last line to fully leave the screen
    await driftPromises[driftPromises.length - 1];

    // Then wait the configured pause and perform the bottom reveal
    if (CFG.reveal.enabled){
      await wait(CFG.reveal.appearAfterLastLineMs);
      await runRevealSequence();
    }
    poemStatus.set('done');
  }catch(e){ console.error('Poem drift error:', e); poemStatus.set('warn'); }
  finally{ __windsSongRunInProgress=false; }
}

function spawnDriftingLine(text, driftDurationMs){
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className='env-poem-line'; el.textContent = text;
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
      // earlier fade-in / fade-out at ends
      const fadeIn = Math.min(1, k/0.20), fadeOut = Math.min(1, (1-k)/0.20);
      el.style.opacity = String(peak * Math.min(fadeIn, fadeOut));
      if (k<1) { requestAnimationFrame(step); }
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(step);
  });
}

/* =======================
   Bottom reveal (spaces preserved; timing independent of sliders)
   ======================= */
async function runRevealSequence(){
  // Elegra slider no longer affects this pacing per ruleset; use a fixed, smooth tempo
  const pairTotalMs = 15_000; // fixed; smooth & slow
  const half = 0.5 * pairTotalMs;

  const bar = document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);
  const lines = CFG.poem.lines.map(line=>{
    const lineEl=document.createElement('span'); lineEl.className='env-reveal-line';
    const words = line.split(' ').map((w,i,arr)=>{
      const s=document.createElement('span'); s.className='env-reveal-word';
      s.textContent = (i<arr.length-1) ? (w+' ') : w; // ← preserve spaces
      lineEl.appendChild(s); return s;
    });
    bar.appendChild(lineEl); return { lineEl, words };
  });
  bar.style.display='block';

  // reveal and crossfade pairs
  await revealWords(lines[0].words, half);
  await crossoverFade(lines[0].words, lines[1].words, half);
  await crossoverFade(lines[1].words, lines[2].words, half);
  await crossoverFade(lines[2].words, lines[3].words, half);
  await fadeWords(lines[3].words, half);

  // gentle overall bar fade-out (no pop)
  bar.style.transition = 'opacity 800ms ease';
  bar.style.opacity = '0';
  await wait(820);
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

/* =======================
   Butterflies (wind speed + breath oscillation + interaction)
   ======================= */
const activeButterflies = [];

function spawnButterfly(){
  const windVal = Number(window.__WINDS_SONG__.wind) || 5;
  const windFact= Math.max(0.1, windVal/5);

  // Breath → oscillation mapping (6..30 → calmer..wavier)
  const breath  = clamp(Number(window.__WINDS_SONG__.breath) || 16, 6, 30);
  const t       = (breath - 6) / (30 - 6);                // 0..1
  const waves   = lerp(1.6, 3.2, t);                      // gentler → wavier
  const amp     = lerp(18, 48, t);                        // smaller → larger sway

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

  const bf = {
    el, startX, endX, baseTop,
    travelMs, t0,
    waves, amp,
    state: 'fly',     // 'fly' | 'dance'
    danceEnd: 0,
    cooldownUntil: 0
  };
  activeButterflies.push(bf);

  function anim(t){
    if (!document.body.contains(el)) return;

    if (bf.state === 'dance') {
      if (t >= bf.danceEnd) {
        bf.state = 'fly';
        // Reset baseline to current time to keep movement smooth
        bf.t0 = t;
      } else {
        // circle around a gentle midpoint wobble
        const prog = (bf.danceEnd - t0) > 0 ? (1 - (bf.danceEnd - t)/ (bf.danceEnd - t0)) : 0.5;
        const cx = (bf.startX + bf.endX) / 2;
        const radius = 24;
        const ang = prog * Math.PI * 2;
        const x = cx + Math.cos(ang) * radius * (fromLeft ? 1 : -1);
        const y = bf.baseTop + Math.sin(ang) * radius * 0.6;
        el.style.transform=`translate(${x}px, ${y-bf.baseTop}px)`;
        requestAnimationFrame(anim);
        return;
      }
    }

    const k=clamp((t-bf.t0)/bf.travelMs,0,1);
    const x=bf.startX + (bf.endX-bf.startX)*k;
    const y=bf.baseTop + Math.sin(k*Math.PI*bf.waves)*bf.amp;
    el.style.transform=`translate(${x}px, ${y-bf.baseTop}px)`;

    if (k<1) requestAnimationFrame(anim);
    else { el.remove(); const idx=activeButterflies.indexOf(bf); if (idx>=0) activeButterflies.splice(idx,1); }
  }
  requestAnimationFrame(anim);
}

function tryButterflyInteractions(){
  const now = performance.now();
  const early = (now - sessionStartTS) < 5 * 60_000; // first 5 minutes
  const chance = early ? CFG.butterflies.interactChanceEarly : CFG.butterflies.interactChanceNormal;

  for (let i=0;i<activeButterflies.length;i++){
    const a = activeButterflies[i];
    if (a.state !== 'fly' || now < a.cooldownUntil) continue;
    // current approx position
    const kA = clamp((now - a.t0)/a.travelMs, 0, 1);
    const xA = a.startX + (a.endX - a.startX)*kA;
    const yA = a.baseTop + Math.sin(kA*Math.PI*a.waves)*a.amp;

    for (let j=i+1;j<activeButterflies.length;j++){
      const b = activeButterflies[j];
      if (b.state !== 'fly' || now < b.cooldownUntil) continue;

      const kB = clamp((now - b.t0)/b.travelMs, 0, 1);
      const xB = b.startX + (b.endX - b.startX)*kB;
      const yB = b.baseTop + Math.sin(kB*Math.PI*b.waves)*b.amp;

      const dx = xA - xB, dy = yA - yB;
      const d  = Math.hypot(dx, dy);
      if (d <= CFG.butterflies.interactRadiusPx) {
        // simple relative angle check (converging-ish)
        const goingToward = (a.endX > a.startX) !== (b.endX > b.startX); // opposite directions feels nicer
        if (goingToward && Math.random() < chance) {
          // trigger dance for both
          a.state = b.state = 'dance';
          a.danceEnd = b.danceEnd = now + CFG.butterflies.danceDurationMs;
          a.cooldownUntil = b.cooldownUntil = now + CFG.butterflies.interactCooldownMs;
          return; // one pair per tick is enough
        }
      }
    }
  }
}

async function runButterfliesLoop(){
  // one soon-ish so users see it
  await wait(randi(6_000,14_000)); spawnButterfly();
  // interaction checker
  setInterval(tryButterflyInteractions, 300);

  while(true){
    await wait(randi(60_000,90_000));
    spawnButterfly();
  }
}

/* Orchestrate */
async function main(){ runPoemDrift(); runButterfliesLoop(); }
main();
