/* =========================================================================
   environment.js
   - Background-only effects (NO index.html edits)
   - Wind controls speed of all moving elements (poem drift + butterflies + leaves)
   - Breath redefined: butterfly oscillation style
   - Elegra: bottom reveal pacing
   - Rez: times per hour (trigger handled by controller)
   - Word spacing fix (permanent)
   - Smooth fade in/out for bottom reveal bar
   ======================================================================== */

/* Utils */
const wait  = (ms) => new Promise(res => setTimeout(res, ms));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Restore settings if controller already saved */
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

/* Shared state */
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

/* Config */
const CFG = {
  z: { leaves:2, poem:3, reveal:4 },
  colors: { poemLine:'#fff', poemShadow:'rgba(0,0,0,.35)', reveal:'#fff' },
  poem: {
    lines: [
      "Falling in love was never the plan,",
      "Like leaves dancing in the wind, it softly began,",
      "Your breath brushed my world into motion,",
      "For life’s breath is the wind, and your breath its creation."
    ],
    baseFirstLineDelayMaxMs: 120_000,
    baseDriftDurationMs: 32_000,
    driftFontMin: 13, driftFontMax: 16,
    baseGapMs: 16_000  // baseline spacing at Wind=5
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
      waiting:'rgba(255, 230, 120, 0.50)',
      playing:'rgba(120, 200, 255, 0.55)',
      done:   'rgba(140, 235, 170, 0.55)',
      warn:   'rgba(255, 120, 120, 0.55)'
    }
  }
};

/* Layers */
const envRoot = (() => {
  let el=document.getElementById('env-root');
  if(!el){ el=document.createElement('div'); el.id='env-root';
    Object.assign(el.style,{position:'fixed',inset:'0',zIndex:'0',pointerEvents:'none'});
    document.body.appendChild(el);}
  return el;
})();
const leavesLayer = (() => {
  let el=document.getElementById('env-leaves');
  if(!el){ el=document.createElement('div'); el.id='env-leaves';
    Object.assign(el.style,{position:'absolute',inset:'0',zIndex:String(CFG.z.leaves),pointerEvents:'none'});
    envRoot.appendChild(el);}
  return el;
})();
const poemLayer = (() => {
  let el=document.getElementById('env-poem');
  if(!el){ el=document.createElement('div'); el.id='env-poem';
    Object.assign(el.style,{position:'absolute',inset:'0',zIndex:String(CFG.z.poem),pointerEvents:'none',overflow:'hidden'});
    envRoot.appendChild(el);}
  return el;
})();
const revealLayer = (() => {
  let el=document.getElementById('env-reveal');
  if(!el){ el=document.createElement('div'); el.id='env-reveal';
    Object.assign(el.style,{position:'fixed',left:'0',right:'0',bottom:'0',
      zIndex:String(CFG.z.reveal),pointerEvents:'none',display:'flex',justifyContent:'center'});
    document.body.appendChild(el);}
  return el;
})();

/* Styles */
(()=>{const css=`
  .env-poem-line{position:absolute;white-space:nowrap;color:${CFG.colors.poemLine};
    text-shadow:0 1px 3px ${CFG.colors.poemShadow};opacity:.95;font-weight:600;letter-spacing:.2px;
    user-select:none;will-change:transform,opacity;pointer-events:none;}
  .env-reveal-bar{max-width:980px;width:calc(100vw - 24px);margin:0 12px 10px;
    background:${CFG.reveal.barBg};border:${CFG.reveal.border};border-radius:10px;
    padding:${CFG.reveal.rowPadding}px 14px;color:${CFG.colors.reveal};
    font-size:${CFG.reveal.fontSizePx}px;line-height:1.4;letter-spacing:.2px;display:none;text-align:center;
    opacity:0;transition:opacity .8s ease;}
  .env-reveal-line{display:inline-block;margin-right:.75em;white-space:nowrap;opacity:1;}
  .env-reveal-word{display:inline-block;opacity:0;will-change:opacity,transform;transform:translateY(4px);}
`;const tag=document.createElement('style');tag.textContent=css;document.head.appendChild(tag);})();

/* Status */
const poemStatus={ state:'waiting', set(n){this.state=n;} };

/* Poem drift */
let __windsSongRunInProgress=false;
async function runPoemDrift(){
  if(__windsSongRunInProgress)return;
  __windsSongRunInProgress=true;
  try{
    const firstDelayMs=randi(0,CFG.poem.baseFirstLineDelayMaxMs);
    await wait(firstDelayMs);
    poemStatus.set('playing');

    const windVal=Number(window.__WINDS_SONG__.wind)||5;
    const windFact=Math.max(0.1, windVal/5);

    for(let i=0;i<CFG.poem.lines.length;i++){
      const driftMs=Math.max(1000,Math.round(CFG.poem.baseDriftDurationMs/windFact));
      spawnDriftingLine(CFG.poem.lines[i], driftMs);

      if(i<CFG.poem.lines.length-1){
        const gap=Math.round(CFG.poem.baseGapMs/windFact);
        await wait(gap);
      }
    }

    if(CFG.reveal.enabled){
      await wait(CFG.reveal.appearAfterLastLineMs);
      await runRevealSequence();
    }
    poemStatus.set('done');
  }catch(e){console.error('Poem drift error:',e);poemStatus.set('warn');}
  finally{__windsSongRunInProgress=false;}
}
function spawnDriftingLine(text,dur){
  const el=document.createElement('div');el.className='env-poem-line';el.textContent=text;
  const fs=randi(CFG.poem.driftFontMin,CFG.poem.driftFontMax);el.style.fontSize=fs+'px';
  const y=randi(90,Math.max(150,window.innerHeight-100));el.style.top=y+'px';
  const startX=-Math.max(120,text.length*(fs*0.6));const endX=window.innerWidth+80;
  poemLayer.appendChild(el);

  const t0=performance.now(),peak=0.95;
  function step(t){
    const k=clamp((t-t0)/dur,0,1);
    const x=startX+(endX-startX)*k;
    el.style.transform=`translate(${x}px,0)`;
    const fadeIn=Math.min(1,k/0.2),fadeOut=Math.min(1,(1-k)/0.2);
    el.style.opacity=String(peak*Math.min(fadeIn,fadeOut));
    if(k<1)requestAnimationFrame(step);else el.remove();
  }
  requestAnimationFrame(step);
}

/* Bottom reveal */
async function runRevealSequence(){
  const elegraS=Number(window.__WINDS_SONG__.elegra)||15;
  const pairTotalMs=Math.max(1000,Math.round(elegraS*1000));
  const half=0.5*pairTotalMs;

  const bar=document.createElement('div');bar.className='env-reveal-bar';revealLayer.appendChild(bar);

  const lines=CFG.poem.lines.map(line=>{
    const lineEl=document.createElement('span');lineEl.className='env-reveal-line';
    const words=line.split(' ').map((w,i,a)=>{
      const s=document.createElement('span');s.className='env-reveal-word';
      s.textContent=(i<a.length-1)?(w+' '):w;lineEl.appendChild(s);return s;});
    bar.appendChild(lineEl);return {lineEl,words};
  });

  bar.style.display='block';bar.style.opacity='1';

  await revealWords(lines[0].words,half);
  await crossoverFade(lines[0].words,lines[1].words,half);
  await crossoverFade(lines[1].words,lines[2].words,half);
  await crossoverFade(lines[2].words,lines[3].words,half);
  await fadeWords(lines[3].words,half);

  bar.style.opacity='0';
  await wait(800);
  bar.remove();
}
async function revealWords(words,totalMs){const per=totalMs/Math.max(1,words.length);
  for(const w of words){w.style.transition='opacity 600ms ease, transform 600ms ease';
    w.style.opacity='1';w.style.transform='translateY(0px)';await wait(per);}}
async function crossoverFade(out,incoming,totalMs){const steps=Math.max(out.length,incoming.length);
  const per=totalMs/Math.max(1,steps);
  for(let i=0;i<steps;i++){
    if(i<incoming.length){const w=incoming[i];w.style.transition='opacity 600ms ease, transform 600ms ease';
      w.style.opacity='1';w.style.transform='translateY(0px)';}
    if(i<out.length){const w=out[i];w.style.transition='opacity 600ms ease, transform 600ms ease';
      w.style.opacity='0';w.style.transform='translateY(4px)';}
    await wait(per);
  }}
async function fadeWords(words,totalMs){const per=totalMs/Math.max(1,words.length);
  for(const w of words){w.style.transition='opacity 600ms ease, transform 600ms ease';
    w.style.opacity='0';w.style.transform='translateY(4px)';await wait(per);}}
    
/* Butterfly */
function spawnButterfly(){
  const windVal=Number(window.__WINDS_SONG__.wind)||5;
  const windFact=Math.max(0.1,windVal/5);

  const breath=Number(window.__WINDS_SONG__.breath)||16;
  const flutterAmp=10+breath;   // bigger breath → bigger arc
  const flutterWaves=2+(breath%3);

  const size=randi(CFG.butterflies.sizeMin,CFG.butterflies.sizeMax);
  const tint=(()=>{switch(poemStatus.state){
    case 'playing':return CFG.butterflies.tint.playing;
    case 'done':return CFG.butterflies.tint.done;
    case 'warn':return CFG.butterflies.tint.warn;
    default:return CFG.butterflies.tint.waiting;}})();

  const el=document.createElement('div');
  Object.assign(el.style,{position:'absolute',top:`${randi(40,Math.max(120,window.innerHeight/2))}px`,
    left:'0px',width:`${size}px`,height:`${size}px`,opacity:'1',pointerEvents:'none',
    zIndex:String(CFG.z.leaves),willChange:'transform'});
  el.innerHTML=`
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
  const endX=fromLeft?(window.innerWidth+40):-40;
  const baseTop=parseFloat(el.style.top);

  const base=randi(CFG.butterflies.baseTravelMsMin,CFG.butterflies.baseTravelMsMax);
  const travelMs=Math.max(800,Math.round(base/windFact));
  const t0=performance.now();

  function anim(t){
    const k=clamp((t-t0)/travelMs,0,1);
    const x=startX+(endX-startX)*k;
    const y=baseTop+Math.sin(k*Math.PI*flutterWaves)*flutterAmp;
    el.style.transform=`translate(${x}px,${y-baseTop}px)`;
    if(k<1)requestAnimationFrame(anim);else el.remove();
  }
  requestAnimationFrame(anim);
}
async function runButterfliesLoop(){
  await wait(randi(6_000,14_000));spawnButterfly();
  while(true){await wait(randi(60_000,90_000));spawnButterfly();}
}

/* Orchestrate */
async function main(){runPoemDrift();runButterfliesLoop();}
main();
