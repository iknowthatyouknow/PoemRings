/* =========================================================================
   environment.js (drop-in)
   - No index.html changes; visuals unchanged
   - Reads Wind/Breath/Elegra/Rez live (from windsong-controller.js) when present
   - 5 on the Wind slider = current baseline speed
   - Butterfly interaction: nearby butterflies briefly “circle dance” at random
   ======================================================================== */

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Restore controller values (if previously saved) */
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
    appearAfterLastLineMs: 30_000,
    rowPadding: 10, fontSizePx: 16,
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    baseTravelMsMin: 18_000, baseTravelMsMax: 26_000,
    sizeMin: 20, sizeMax: 28,
    tint: {
      waiting:'rgba(255, 230, 120, 0.50)',   // yellow
      playing:'rgba(120, 200, 255, 0.55)',   // cyan/blue
      done:   'rgba(140, 235, 170, 0.55)',   // green
      warn:   'rgba(255, 120, 120, 0.55)'    // red
    },
    flutterWaves: 2, flutterAmp: 28,
    /* --- Interaction knobs (new) --- */
    interact: {
      enabled: true,     // set false to disable pairing/dancing
      rangePx: 110,      // proximity threshold
      danceMs: 2000,     // ~2s circle dance
      cooldownMs: 25000, // per-butterfly cooldown after a dance
      minApproachMs: 500 // must be close for at least this long
    },
    // Temporary tints during dance (purple, green, magenta)
    danceTints: [
      'rgba(190,140,255,0.55)',
      'rgba(140,235,170,0.55)',
      'rgba(255,140,210,0.55)'
    ]
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
      // Wind: 5 = baseline → factor = wind/5
      const windVal   = Number(window.__WINDS_SONG__.wind) || 5;
      const windFact  = Math.max(0.1, windVal/5);
      const driftMs   = Math.max(1000, Math.round(CFG.poem.baseDriftDurationMs / windFact));
      spawnDriftingLine(CFG.poem.lines[i], driftMs);

      if (i < CFG.poem.lines.length - 1){
        // Breath in seconds (current definition); adjustable via controller
        const breathS = Number(window.__WINDS_SONG__.breath) || 16;
        await wait(Math.max(500, Math.round(breathS*1000)));
      }
    }

    if (CFG.reveal.enabled){
      await wait(CFG.reveal.appearAfterLastLineMs);
      await runRevealSequence();
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
    // early fade-in & smooth fade-out
    const fadeIn = Math.min(1, k/0.20), fadeOut = Math.min(1, (1-k)/0.20);
    el.style.opacity = String(peak * Math.min(fadeIn, fadeOut));
    if (k<1) requestAnimationFrame(step); else el.remove();
  }
  requestAnimationFrame(step);
}

/* Bottom reveal (Elegra per phase) — spacing fix preserved */
async function runRevealSequence(){
  const elegraS = Number(window.__WINDS_SONG__.elegra) || 15;
  const pairTotalMs = Math.max(1000, Math.round(elegraS*1000));
  const half = 0.5 * pairTotalMs;

  const bar = document.createElement('div'); bar.className='env-reveal-bar'; revealLayer.appendChild(bar);
  const lines = CFG.poem.lines.map(line=>{
    const lineEl=document.createElement('span'); lineEl.className='env-reveal-line';
    const words = line.split(' ').map((w,i,arr)=>{
      const s=document.createElement('span'); s.className='env-reveal-word';
      s.textContent = (i<arr.length-1) ? (w+' ') : w; // <-- preserve spaces
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
   Butterfly (Wind applied + interaction manager)
   - Normal sparse flights as before
   - Random, optional “circle dance” when two are close for a moment
--------------------------- */
const ButterflyManager = (() => {
  const list = [];
  let rafId = 0;
  let nextDanceTintIdx = 0;

  function setTint(el, color) {
    const wings = el.querySelectorAll('path');
    wings.forEach(p => p.setAttribute('fill', color));
  }

  function posAlongPath(obj, k) {
    const x = obj.startX + (obj.endX - obj.startX) * k;
    const flutterY = Math.sin(k * Math.PI * CFG.butterflies.flutterWaves) * CFG.butterflies.flutterAmp;
    const y = obj.baseTop + flutterY;
    return { x, y };
  }

  function spawnOne() {
    const windVal  = Number(window.__WINDS_SONG__.wind) || 5;
    const windFact = Math.max(0.1, windVal / 5);
    const size = randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);

    // status tint mirrors poem status
    const baseTint = (() => {
      switch (poemStatus.state) {
        case 'playing': return CFG.butterflies.tint.playing;
        case 'done':    return CFG.butterflies.tint.done;
        case 'warn':    return CFG.butterflies.tint.warn;
        default:        return CFG.butterflies.tint.waiting;
      }
    })();

    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      top: `${randi(40, Math.max(120, window.innerHeight / 2))}px`,
      left: '0px',
      width: `${size}px`,
      height: `${size}px`,
      opacity: '1',
      pointerEvents: 'none',
      zIndex: String(CFG.z.leaves),
      willChange: 'transform'
    });
    el.innerHTML = `
      <svg viewBox="0 0 120 80" width="${size}" height="${size}" style="display:block">
        <defs>
          <filter id="bshadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/>
          </filter>
        </defs>
        <g filter="url(#bshadow)">
          <path d="M60,40 C30,5 5,5 10,35 C15,60 35,55 60,40 Z" />
          <path d="M60,40 C90,5 115,5 110,35 C105,60 85,55 60,40 Z" />
          <rect x="57" y="35" width="6" height="16" rx="3" fill="rgba(30,40,60,0.6)"/>
        </g>
      </svg>`;
    leavesLayer.appendChild(el);
    setTint(el, baseTint);

    const fromLeft = Math.random() < 0.5;
    const startX   = fromLeft ? -40 : (window.innerWidth + 40);
    const endX     = fromLeft ? (window.innerWidth + 40) : -40;

    const baseTop  = parseFloat(el.style.top);
    const base     = randi(CFG.butterflies.baseTravelMsMin, CFG.butterflies.baseTravelMsMax);
    const travelMs = Math.max(800, Math.round(base / windFact));

    const obj = {
      el,
      state: 'free',             // 'free' | 'dancing' | 'cooldown'
      startX, endX,
      baseTop,
      travelMs,
      t0: performance.now(),
      k: 0,
      lastCloseSince: 0,
      lastDanceDone: 0,
      freeTint: baseTint,
      dance: null                // {cx, cy, r, t0, dur, ccw}
    };
    list.push(obj);
    return obj;
  }

  function updateFree(obj, now) {
    const dt = now - obj.t0;
    obj.k = clamp(dt / obj.travelMs, 0, 1);
    const p = posAlongPath(obj, obj.k);
    obj.el.style.transform = `translate(${p.x}px, ${p.y - obj.baseTop}px)`;
    if (obj.k >= 1) {
      obj.el.remove();
      const i = list.indexOf(obj);
      if (i >= 0) list.splice(i, 1);
      return false;
    }
    return true;
  }

  function considerPair(a, b, now) {
    const cfg = CFG.butterflies.interact;
    if (!cfg?.enabled) return false;

    // cooldown guard
    if (now - a.lastDanceDone < cfg.cooldownMs || now - b.lastDanceDone < cfg.cooldownMs) return false;

    const pa = posAlongPath(a, a.k), pb = posAlongPath(b, b.k);
    const dx = pa.x - pb.x, dy = (pa.y) - (pb.y);
    const dist = Math.hypot(dx, dy);
    if (dist > cfg.rangePx) {
      a.lastCloseSince = b.lastCloseSince = 0;
      return false;
    }

    if (!a.lastCloseSince || !b.lastCloseSince) {
      a.lastCloseSince = b.lastCloseSince = now;
      return false;
    }
    if ((now - a.lastCloseSince) < cfg.minApproachMs || (now - b.lastCloseSince) < cfg.minApproachMs) return false;

    // set up dance
    const cx = (pa.x + pb.x) * 0.5;
    const cy = (pa.y + pb.y) * 0.5;
    const r  = Math.max(28, Math.min(64, dist * 0.6));
    const dur= cfg.danceMs;

    const tint = CFG.butterflies.danceTints[(nextDanceTintIdx++) % CFG.butterflies.danceTints.length];

    a.state = b.state = 'dancing';
    a.dance = { cx, cy, r, t0: now, dur, ccw: false };
    b.dance = { cx, cy, r, t0: now, dur, ccw: true  };

    setTint(a.el, tint); setTint(b.el, tint);
    return true;
  }

  function updateDance(obj, now) {
    const d = obj.dance;
    const u = clamp((now - d.t0) / d.dur, 0, 1);
    const ang0 = d.ccw ? Math.PI * 0.2 : Math.PI * 1.2;
    const ang  = ang0 + (d.ccw ? 1 : -1) * u * Math.PI * 1.6;

    const x = d.cx + d.r * Math.cos(ang);
    const y = d.cy + d.r * Math.sin(ang);
    obj.el.style.transform = `translate(${x}px, ${y - obj.baseTop}px)`;

    if (u >= 1) {
      // resume flight near current absolute X
      const total = (obj.endX - obj.startX);
      obj.k  = clamp((x - obj.startX) / total, 0, 0.98);
      obj.t0 = now - obj.k * obj.travelMs;
      obj.state = 'cooldown';
      obj.lastDanceDone = now;
      obj.dance = null;
      // restore original tint (status)
      setTint(obj.el, obj.freeTint);
    }
  }

  function updateCooldown(obj, now) {
    obj.state = 'free';
    updateFree(obj, now);
  }

  function tick(now) {
    // advance each butterfly
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (b.state === 'free') {
        if (!updateFree(b, now)) continue;
      } else if (b.state === 'dancing') {
        updateDance(b, now);
      } else if (b.state === 'cooldown') {
        updateCooldown(b, now);
      }
    }

    // attempt one pairing this frame (keeps things subtle)
    for (let i = 0; i < list.length; i++) {
      const a = list[i]; if (a.state !== 'free') continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]; if (b.state !== 'free') continue;
        if (considerPair(a, b, now)) { i = list.length; break; }
      }
    }

    requestAnimationFrame(tick);
  }

  // kick the loop once the first butterfly spawns
  let loopStarted = false;
  function ensureLoop() {
    if (loopStarted) return;
    loopStarted = true;
    requestAnimationFrame(tick);
  }

  return {
    spawn() { const obj = spawnOne(); ensureLoop(); return obj; },
    count() { return list.length; }
  };
})();

function spawnButterfly(){ ButterflyManager.spawn(); }
async function runButterfliesLoop(){
  await wait(randi(6_000,14_000)); spawnButterfly();
  while(true){ await wait(randi(60_000,90_000)); spawnButterfly(); }
}

/* Orchestrate */
async function main(){ runPoemDrift(); runButterfliesLoop(); }
main();
