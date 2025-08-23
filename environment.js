/* =========================================================================
   environment.js (drop-in)
   - No index.html changes; visuals unchanged
   - Reads Wind/Breath/Elegra/Rez live
   - Wind controls all moving elements’ speed (via factor wind/5)
   - Breath affects butterflies’ vertical oscillation feel (not poem spacing)
   - Elegra sets the Wind’s Song reveal pacing (kept smooth & spaced)
   - Rez scheduling handled elsewhere
   - ADDED: Butterfly Party for the SPECIAL POEM (not Wind’s Song)
   ======================================================================== */

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Restore saved settings early (so first frame uses them) */
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
    baseFirstLineDelayMaxMs: 120_000,   // surprise window
    baseDriftDurationMs:     32_000,    // cross-screen baseline at Wind=5
    driftFontMin: 13, driftFontMax: 16
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30_000,  // Wind’s Song reveal runs well after drift
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
`; const tag=document.createElement('style'); tag.textContent=css; document.head.appendChild(tag);})();

/* Status */
const poemStatus = { state:'waiting', set(next){ this.state = next; } };

/* ===================== Poem drift (Wind & fixed spacing) ===================== */
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

    // Fixed on-screen spacing: delay scales with drift so visual spacing stays constant
    for (let i=0;i<CFG.poem.lines.length;i++){
      const windVal   = Number(window.__WINDS_SONG__.wind) || 5;
      const windFact  = Math.max(0.1, windVal/5);
      const driftMs   = Math.max(1000, Math.round(CFG.poem.baseDriftDurationMs / windFact));
      spawnDriftingLine(CFG.poem.lines[i], driftMs);

      if (i < CFG.poem.lines.length - 1){
        // keep the same gap in *screen distance*: wait ~70% of drift time
        const gap = Math.round(driftMs * 0.70);
        await wait(gap);
      }
    }

    if (CFG.reveal.enabled){
      await wait(CFG.reveal.appearAfterLastLineMs);
      await runRevealSequence(); // Elegra pacing inside; spacing preserved, spaces preserved
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
    const fadeIn = Math.min(1, k/0.20), fadeOut = Math.min(1, (1-k)/0.20);
    el.style.opacity = String(peak * Math.min(fadeIn, fadeOut));
    if (k<1) requestAnimationFrame(step); else el.remove();
  }
  requestAnimationFrame(step);
}

/* ===================== Wind’s Song bottom reveal (spaces preserved) ===================== */
async function runRevealSequence(){
  // Elegra drives the “pair” pacing, but reveal speed itself is fixed & smooth feeling
  const elegraS = Number(window.__WINDS_SONG__.elegra) || 15;
  const pairTotalMs = Math.max(1000, Math.round(elegraS*1000));
  const half = 0.5 * pairTotalMs;

  const bar = document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);
  const lines = CFG.poem.lines.map(line=>{
    const lineEl=document.createElement('span'); lineEl.className='env-reveal-line';
    const words = line.split(' ').map((w,i,arr)=>{
      const s=document.createElement('span'); s.className='env-reveal-word';
      s.textContent = (i<arr.length-1) ? (w+' ') : w; // <— preserve spaces always
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

  // smooth fade-out of the whole bar (no pop)
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

/* ===================== Butterflies (normal loop + proximity) ===================== */
const __butterflies = new Set();   // track normal-flight butterflies for interactions
let __butterflyLoopPaused = false; // paused during party
let __proximityEnabled = true;     // disabled during party

function spawnButterfly(){
  const windVal = Number(window.__WINDS_SONG__.wind) || 5;
  const windFact= Math.max(0.1, windVal/5);
  const breathS = Number(window.__WINDS_SONG__.breath) || 16; // use for oscillation feel

  const size=randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);
  // normal tint by state
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
  const baseTop = randi(40, Math.max(120, window.innerHeight/2));
  el.style.top = `${baseTop}px`;

  const base=randi(CFG.butterflies.baseTravelMsMin, CFG.butterflies.baseTravelMsMax);
  const travelMs=Math.max(800, Math.round(base/ windFact));
  const t0=performance.now();
  const waves = CFG.butterflies.flutterWaves;
  const ampBase = CFG.butterflies.flutterAmp;
  const amp = ampBase * (0.6 + 0.4*Math.min(2, breathS/16)); // breath influences vertical sway

  const obj = { el, size, party:false };
  __butterflies.add(obj);

  function anim(t){
    const k=clamp((t-t0)/travelMs,0,1);
    const x=startX + (endX-startX)*k;
    const y=baseTop + Math.sin(k*Math.PI*waves)*amp;
    el.style.transform=`translate(${x}px, ${y-baseTop}px)`;
    if(k<1) requestAnimationFrame(anim); else { el.remove(); __butterflies.delete(obj); }
  }
  requestAnimationFrame(anim);
}

async function runButterfliesLoop(){
  await wait(randi(6_000,14_000)); if(!__butterflyLoopPaused) spawnButterfly();
  while(true){
    await wait(randi(60_000,90_000));
    if(!__butterflyLoopPaused) spawnButterfly();
  }
}

/* Simple proximity interaction for normal flight (subtle “dance”) */
(function proximityLoop(){
  const R = 55; // interaction radius (px)
  const CHECK_MS = 200;
  async function tick(){
    await wait(CHECK_MS);
    if (__proximityEnabled && __butterflies.size >= 2){
      const arr = Array.from(__butterflies);
      for (let i=0;i<arr.size-1;++i){
        const a = arr[i], ra = a.el.getBoundingClientRect();
        for (let j=i+1;j<arr.size;++j){
          const b = arr[j], rb = b.el.getBoundingClientRect();
          const dx = (ra.left+ra.width/2) - (rb.left+rb.width/2);
          const dy = (ra.top +ra.height/2) - (rb.top +rb.height/2);
          const d2 = dx*dx+dy*dy;
          if (d2 < R*R){
            // small synchronized wiggle
            a.el.animate([{transform:a.el.style.transform},{transform:a.el.style.transform+' rotate(6deg)'}],{duration:220,iterations:1});
            b.el.animate([{transform:b.el.style.transform},{transform:b.el.style.transform+' rotate(-6deg)'}],{duration:220,iterations:1});
          }
        }
      }
    }
    tick();
  }
  tick();
})();

/* ===================== Butterfly Party (SPECIAL POEM ONLY) ===================== */
let __partyActive = false;
let __partyCooldownUntil = 0;

// Festive palette (semi-subtle)
const PARTY_COLORS = [
  'rgba(255, 230, 120, 0.55)', // yellow
  'rgba(120, 200, 255, 0.55)', // cyan-blue
  'rgba(140, 235, 170, 0.55)', // green
  'rgba(200, 140, 255, 0.55)', // purple
  'rgba(255, 140, 220, 0.55)'  // magenta
];

// Hook into “special poem” triggers without changing index.html
// 1) Custom events (if index.js emits them)
window.addEventListener('specialPoem:start', tryStartButterflyParty);
window.addEventListener('special-poem:start', tryStartButterflyParty);
// 2) DOM observer fallback: if a special-poem element appears
const SPECIAL_SELECTORS = ['#special-poem', '.special-poem', '#poem-output', '.poem-output'];
const mo = new MutationObserver(() => {
  const target = findSpecialPoemElement();
  if (target && isElementVisible(target)) tryStartButterflyParty();
});
mo.observe(document.documentElement, { childList:true, subtree:true });

// helper
function findSpecialPoemElement(){
  for (const sel of SPECIAL_SELECTORS){
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}
function isElementVisible(el){
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.right >= 0 &&
         r.top < (window.innerHeight||0) && r.left < (window.innerWidth||0);
}

async function tryStartButterflyParty(){
  if (__partyActive) return;
  const now = Date.now();
  if (now < __partyCooldownUntil) return;

  // Respect prefers-reduced-motion: skip party entirely
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mql && mql.matches) return;

  const anchor = findSpecialPoemElement();
  const rect = anchor ? anchor.getBoundingClientRect() : {left:window.innerWidth/2, top:window.innerHeight/2, width:10, height:10};
  const cx = rect.left + rect.width/2;
  const cy = rect.top  + rect.height/2;

  await startButterflyParty({ cx, cy, rect });
}

async function startButterflyParty({ cx, cy, rect }){
  __partyActive = true;
  __partyCooldownUntil = Date.now() + 10*60*1000; // 10 min cooldown
  __butterflyLoopPaused = true;
  __proximityEnabled = false; // party has its own choreography

  const windVal = Number(window.__WINDS_SONG__.wind) || 5;
  const windFact= Math.max(0.1, windVal/5);

  // build party group
  const count = randi(8, 12);
  const group = [];
  const baseRadius = Math.max(70, Math.min(140, Math.max(rect.width, rect.height) * 0.75));
  const radiusJitter = 30;

  // Create SVG butterflies with festive colors
  for (let i=0;i<count;i++){
    const size = randi(22, 30);
    const color = PARTY_COLORS[i % PARTY_COLORS.length];
    const el = document.createElement('div');
    Object.assign(el.style,{
      position:'absolute', left:'0px', top:'0px',
      width:`${size}px`, height:`${size}px`, pointerEvents:'none',
      zIndex:String(CFG.z.leaves+1), willChange:'transform'
    });
    el.innerHTML = `
      <svg viewBox="0 0 120 80" width="${size}" height="${size}" style="display:block">
        <defs><filter id="bshadowP" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/></filter></defs>
        <g filter="url(#bshadowP)">
          <path d="M60,40 C30,5 5,5 10,35 C15,60 35,55 60,40 Z" fill="${color}"/>
          <path d="M60,40 C90,5 115,5 110,35 C105,60 85,55 60,40 Z" fill="${color}"/>
          <rect x="57" y="35" width="6" height="16" rx="3" fill="rgba(30,40,60,0.6)"/>
        </g>
      </svg>`;
    leavesLayer.appendChild(el);

    // Random arrival direction
    const startX = Math.random()<0.5 ? -60 : window.innerWidth+60;
    const startY = randi(40, window.innerHeight-40);
    const arriveMs = randi(1200, 1800);

    el.style.transform = `translate(${startX}px, ${startY}px)`;

    group.push({
      el, size,
      // orbital params
      R: baseRadius + rand(-radiusJitter, radiusJitter),
      omega: rand(0.7, 1.4) * (Math.random()<0.5 ? -1 : 1), // rad/sec
      phi0: rand(0, Math.PI*2),
      // arrival / disperse
      arrived:false,
      arriveStart: performance.now(),
      arriveMs,
      // interaction state
      dancePhase: rand(0, Math.PI*2)
    });
  }

  const PARTY_MS = 60_000; // 60s party
  const tEnter = performance.now();
  const tPartyEnd = tEnter + PARTY_MS;

  // Arrival tween then orbital swirl
  function partyFrame(t){
    const dt = (t - tEnter) / 1000; // seconds since start
    for (const b of group){
      // arrival lerp for first ~1.2–1.8s
      if (!b.arrived){
        const k = clamp((t - b.arriveStart) / b.arriveMs, 0, 1);
        const sx = parseFloat(b.el.style.transform.match(/translate\(([^p]+)px/)[1]);
        const sy = parseFloat(b.el.style.transform.match(/, ([^p]+)px\)/)[1]);
        const tx = cx + Math.cos(b.phi0)*b.R*0.6;
        const ty = cy + Math.sin(b.phi0)*b.R*0.6;
        const x = sx + (tx - sx)*k;
        const y = sy + (ty - sy)*k;
        b.el.style.transform = `translate(${x}px, ${y}px)`;
        if (k >= 1) b.arrived = true;
        continue;
      }

      // orbital motion around (cx, cy)
      const phi = b.phi0 + b.omega * dt;
      const wobble = 1 + 0.05*Math.sin(dt*2 + b.dancePhase);
      const x = cx + Math.cos(phi)*b.R*wobble;
      const y = cy + Math.sin(phi)*b.R*wobble;
      b.el.style.transform = `translate(${x}px, ${y}px)`;
    }

    // in-party proximity “dance” (pair wiggles)
    partyInteraction(group);

    if (t < tPartyEnd){
      requestAnimationFrame(partyFrame);
    } else {
      disperse(group);
    }
  }
  requestAnimationFrame(partyFrame);

  // Disperse off-screen, then cleanup & resume normal loop
  function disperse(group){
    const promises = group.map((b)=>{
      return new Promise((resolve)=>{
        const rect = b.el.getBoundingClientRect();
        const fromX = rect.left, fromY = rect.top;
        const dir = Math.atan2(fromY - cy, fromX - cx);
        const speed = rand(120, 180) * (Number(window.__WINDS_SONG__.wind)||5)/5; // px/s scales with wind
        // choose a heading roughly away from center
        const theta = dir + rand(-0.6, 0.6);
        const vx = Math.cos(theta)*speed;
        const vy = Math.sin(theta)*speed;

        const start = performance.now();
        function step(t){
          const s = (t - start)/1000;
          const x = fromX + vx*s;
          const y = fromY + vy*s;
          b.el.style.transform = `translate(${x}px, ${y}px)`;
          if (x < -100 || x > window.innerWidth+100 || y < -100 || y > window.innerHeight+100){
            b.el.remove(); resolve();
          } else requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    });

    Promise.all(promises).then(()=>{
      __partyActive = false;
      __butterflyLoopPaused = false;
      __proximityEnabled = true;
    });
  }
}

/* Party-time proximity: tighter & more frequent inside group */
function partyInteraction(group){
  const R = 55; // interaction radius
  for (let i=0;i<group.length-1;i++){
    const a = group[i];
    const ra = a.el.getBoundingClientRect();
    const ax = ra.left + ra.width/2, ay = ra.top + ra.height/2;
    for (let j=i+1;j<group.length;j++){
      const b = group[j];
      const rb = b.el.getBoundingClientRect();
      const bx = rb.left + rb.width/2, by = rb.top + rb.height/2;
      const dx = ax - bx, dy = ay - by;
      const d2 = dx*dx + dy*dy;
      if (d2 < R*R){
        // subtle synchronized wiggle
        a.el.animate([{transform:a.el.style.transform},{transform:a.el.style.transform+' rotate(8deg)'}],{duration:220,iterations:1});
        b.el.animate([{transform:b.el.style.transform},{transform:b.el.style.transform+' rotate(-8deg)'}],{duration:220,iterations:1});
      }
    }
  }
}

/* Orchestrate */
async function main(){ runPoemDrift(); runButterfliesLoop(); }
main();
