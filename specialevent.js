// specialevent.js
(function(){
  const COLORS = [
    'rgba(255, 120, 120, 0.65)', // red
    'rgba(255, 210, 120, 0.70)', // amber
    'rgba(140, 235, 170, 0.70)', // green
    'rgba(140, 180, 255, 0.70)', // blue
    'rgba(220, 140, 255, 0.70)', // purple
    'rgba(255, 120, 220, 0.70)'  // magenta
  ];
  let partyActive = false;
  let partyStopAt = 0;
  let partyButterflies = [];

  window.addEventListener('special-poem:begin', startParty, { passive:true });
  window.addEventListener('special-poem:end',   stopParty,  { passive:true });

  function getAnchorRect(){
    // Try to find your main poem output box; fall back to center
    const candidates = document.querySelectorAll(
      '.poem-output, #poem, .special-poem, .ring-poem, [data-role="poem-output"]'
    );
    for (const el of candidates){
      const r = el.getBoundingClientRect();
      if (r.width && r.height) return r;
    }
    // Fallback: center box
    return { left: window.innerWidth/2 - 120, top: window.innerHeight/2 - 60, width:240, height:120 };
  }

  function startParty(){
    if (partyActive) return;
    partyActive = true;
    partyStopAt = performance.now() + 60_000; // 60s
    const anchor = getAnchorRect();
    const centerX = anchor.left + anchor.width/2;
    const centerY = anchor.top + anchor.height/2;

    const count = randi(8, 12);
    for (let i=0;i<count;i++){
      const b = spawnPartyButterfly(centerX, centerY, i, count);
      partyButterflies.push(b);
    }
    requestAnimationFrame(partyTick);
  }

  function stopParty(){
    partyStopAt = performance.now(); // end asap
  }

  function partyTick(now){
    if (!partyActive) return;
    const timeLeft = partyStopAt - now;
    for (const b of partyButterflies){
      b.step(now, timeLeft <= 0);
    }
    // Clean up finished
    partyButterflies = partyButterflies.filter(b => !b.done);
    if (timeLeft <= 0 && partyButterflies.length === 0){
      partyActive = false;
      return;
    }
    requestAnimationFrame(partyTick);
  }

  function spawnPartyButterfly(cx, cy, idx, total){
    const size = randi(22, 30);
    const color = COLORS[idx % COLORS.length];
    const el = document.createElement('div');
    Object.assign(el.style,{
      position:'fixed', left:`${cx}px`, top:`${cy}px`,
      width:`${size}px`, height:`${size}px`,
      transform:'translate(-50%,-50%)', pointerEvents:'none',
      zIndex:'4', willChange:'transform, opacity'
    });
    el.innerHTML = svgButterfly(size, color);
    document.body.appendChild(el);

    // Circular dance params
    const baseRadius = randi(60, 110);
    const phase = Math.random()*Math.PI*2;
    const dir = Math.random()<0.5 ? -1 : 1;
    const wobble = rand(8, 24);

    let dispersed = false;
    let done = false;
    let disperseStart = 0;
    const disperseDur = randi(2000, 3500);
    const offX = Math.random() < 0.5 ? -1 : 1;
    const offY = Math.random() < 0.5 ? -1 : 1;

    function step(now, shouldDisperse){
      if (done) return;
      if (!dispersed && shouldDisperse){
        dispersed = true;
        disperseStart = now;
      }

      if (!dispersed){
        // dance (orbit with slight wobble)
        const t = now * 0.0015 * dir + phase;
        const r = baseRadius + Math.sin(now*0.004 + phase)*wobble;
        const x = cx + Math.cos(t) * r;
        const y = cy + Math.sin(t) * r;
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%,-50%)`;
      } else {
        // disperse flight out of screen
        const k = clamp((now - disperseStart) / disperseDur, 0, 1);
        const dx = offX * (window.innerWidth*0.6) * k;
        const dy = offY * (window.innerHeight*0.6) * k + Math.sin(k*Math.PI*3)*18;
        el.style.transform = `translate(${Math.round(cx+dx)}px, ${Math.round(cy+dy)}px) translate(-50%,-50%)`;
        el.style.opacity = String(1 - k);
        if (k >= 1) {
          el.remove();
          done = true;
        }
      }
    }

    return {
      step,
      get done(){ return done; }
    };
  }

  function svgButterfly(size, fill){
    return `
    <svg viewBox="0 0 120 80" width="${size}" height="${size}" style="display:block">
      <defs><filter id="bshadow2" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/></filter></defs>
      <g filter="url(#bshadow2)">
        <path d="M60,40 C30,5 5,5 10,35 C15,60 35,55 60,40 Z" fill="${fill}" />
        <path d="M60,40 C90,5 115,5 110,35 C105,60 85,55 60,40 Z" fill="${fill}" />
        <rect x="57" y="35" width="6" height="16" rx="3" fill="rgba(30,40,60,0.6)"/>
      </g>
    </svg>`;
  }

  function rand(a,b){ return a + Math.random()*(b-a); }
  function randi(a,b){ return Math.floor(rand(a,b+1)); }
  function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }
})();
