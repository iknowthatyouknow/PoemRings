/* =========================================================================
   environment.js  (ruleset-safe updates: slower speeds + reveal layout)
   ======================================================================== */

/* Utilities */
function wait(ms){ return new Promise(function(res){ setTimeout(res, ms); }); }
function rand(a,b){ return a + Math.random()*(b-a); }
function randi(a,b){ return Math.floor(rand(a, b+1)); }
function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }

/* Config */
var CFG = {
  z: { leaves: 2, poem: 3, reveal: 4, debug: 9 },
  colors: {
    poemLine: '#ffffff',
    poemShadow: 'rgba(0,0,0,.35)',
    reveal: '#ffffff'
  },
  poem: {
    lines: [
      "Falling in love was never the plan,",
      "Like leaves in the wind, it softly began,",
      "Your breath brushed my world into motion,",
      "For lifes Breath is the wind, and the wind is you."
    ],
    firstLineDelayMaxMs: 120000,     // 0–120s
    betweenLinesMinMs: 16000,        // 16–18s (more separation; ~one line at a time)
    betweenLinesMaxMs: 18000,
    driftDurationMs: 36000,          // slower left→right drift (was 26000)
    driftFontMin: 13,
    driftFontMax: 16,
    fadeEdge: 0.25                   // earlier/longer fade edges for readability
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30000,    // unchanged (you requested earlier)
    rowPadding: 12,
    fontSizePx: 16,
    wordFadeTotalMs: 20000,          // slower/longer fades (was 15000)
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    minEveryMs: 80000,               // slower cadence (was 60000–90000)
    maxEveryMs: 110000,
    travelMsMin: 18000,              // slower flight (was 12000–18000)
    travelMsMax: 26000,
    sizeMin: 20,
    sizeMax: 28,
    tint: {
      waiting: 'rgba(255, 230, 120, 0.50)',
      playing: 'rgba(120, 200, 255, 0.55)',
      done:    'rgba(140, 235, 170, 0.55)',
      warn:    'rgba(255, 120, 120, 0.55)'
    }
  }
};

/* Root layers */
var envRoot = (function(){
  var el = document.getElementById('env-root');
  if (!el){
    el = document.createElement('div');
    el.id = 'env-root';
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = '0';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
  }
  return el;
})();

var leavesLayer = (function(){
  var el = document.getElementById('env-leaves');
  if (!el){
    el = document.createElement('div');
    el.id = 'env-leaves';
    el.style.position = 'absolute';
    el.style.inset = '0';
    el.style.zIndex = String(CFG.z.leaves);
    el.style.pointerEvents = 'none';
    envRoot.appendChild(el);
  }
  return el;
})();

var poemLayer = (function(){
  var el = document.getElementById('env-poem');
  if (!el){
    el = document.createElement('div');
    el.id = 'env-poem';
    el.style.position = 'absolute';
    el.style.inset = '0';
    el.style.zIndex = String(CFG.z.poem);
    el.style.pointerEvents = 'none';
    el.style.overflow = 'hidden';
    envRoot.appendChild(el);
  }
  return el;
})();

var revealLayer = (function(){
  var el = document.getElementById('env-reveal');
  if (!el){
    el = document.createElement('div');
    el.id = 'env-reveal';
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.right = '0';
    el.style.bottom = '0';
    el.style.zIndex = String(CFG.z.reveal);
    el.style.pointerEvents = 'none';
    el.style.display = 'flex';
    el.style.justifyContent = 'center';
    document.body.appendChild(el);
  }
  return el;
})();

/* Styles */
(function(){
  var css =
  ".env-poem-line{position:absolute;white-space:nowrap;color:"+CFG.colors.poemLine+";text-shadow:0 1px 3px "+CFG.colors.poemShadow+";opacity:.95;font-weight:600;letter-spacing:.2px;user-select:none;will-change:transform,opacity;pointer-events:none}" +
  ".env-reveal-bar{max-width:980px;width:calc(100vw - 24px);margin:0 12px 12px;background:"+CFG.reveal.barBg+";border:"+CFG.reveal.border+";border-radius:10px;padding:"+CFG.reveal.rowPadding+"px 16px;color:"+CFG.colors.reveal+";font-size:"+CFG.reveal.fontSizePx+"px;line-height:1.5;letter-spacing:.2px;display:none}" +
  ".env-reveal-inner{display:flex;justify-content:center;align-items:center;gap:24px;flex-wrap:nowrap;white-space:nowrap;text-align:center}" +
  ".env-slot{display:inline-block}" +
  ".env-reveal-line{display:inline-block;white-space:nowrap;opacity:1}" +
  ".env-reveal-word{display:inline-block;opacity:0;will-change:opacity,transform;transform:translateY(6px)}";
  var tag = document.createElement('style');
  tag.textContent = css;
  document.head.appendChild(tag);
})();

/* Status */
var poemStatus = { state: 'waiting', set: function(next){ this.state = next; } };

/* Drifting lines */
function runPoemDrift(){
  (function(){
    wait(130000).then(function(){
      if (poemStatus.state === 'waiting'){ poemStatus.set('warn'); }
    });
  })();

  var delay0 = randi(0, CFG.poem.firstLineDelayMaxMs);
  wait(delay0).then(function(){
    poemStatus.set('playing');
    (function playLines(i){
      if (i >= CFG.poem.lines.length){
        if (CFG.reveal.enabled){
          wait(CFG.reveal.appearAfterLastLineMs).then(runRevealSequence).then(function(){
            poemStatus.set('done');
          });
        } else { poemStatus.set('done'); }
        return;
      }
      spawnDriftingLine(CFG.poem.lines[i]);
      if (i < CFG.poem.lines.length - 1){
        wait(randi(CFG.poem.betweenLinesMinMs, CFG.poem.betweenLinesMaxMs)).then(function(){
          playLines(i+1);
        });
      } else {
        playLines(i+1);
      }
    })(0);
  });
}

function spawnDriftingLine(text){
  var el = document.createElement('div');
  el.className = 'env-poem-line';
  el.textContent = text;

  var fontSize = randi(CFG.poem.driftFontMin, CFG.poem.driftFontMax);
  el.style.fontSize = String(fontSize)+'px';

  var minY = 90;
  var maxY = Math.max(minY + 60, window.innerHeight - 100);
  var y = randi(minY, maxY);
  el.style.top = String(y)+'px';

  var startX = -Math.max(120, text.length * (fontSize * 0.6));
  var endX = window.innerWidth + 80;

  poemLayer.appendChild(el);

  var dur = CFG.poem.driftDurationMs;
  var tStart = performance.now();
  var fadeEdge = CFG.poem.fadeEdge;

  function smoothstep(u){ return u*u*(3-2*u); }

  function step(t){
    var k = clamp((t - tStart)/dur, 0, 1);
    var x = startX + (endX - startX) * k;

    var fade;
    if (k < fadeEdge){ fade = smoothstep(k / fadeEdge); }
    else if (k > 1 - fadeEdge){ fade = smoothstep((1 - k) / fadeEdge); }
    else { fade = 1; }

    el.style.transform = "translate("+x+"px,0)";
    el.style.opacity = String(0.95 * fade);

    if (k < 1){ requestAnimationFrame(step); }
    else { el.remove(); }
  }
  requestAnimationFrame(step);
}

/* Bottom reveal: 2 slots centered, no wrapping
   - Slot A shows L1, fades out while L2 fades in at Slot B.
   - When L1 is fully gone and L2 is starting to fade out, L3 fades in at Slot A.
   - Then L4 fades in at Slot B while L3 fades out.
   - Final: fade out whatever remains. */
function runRevealSequence(){
  var bar = document.createElement('div');
  bar.className = 'env-reveal-bar';

  var inner = document.createElement('div');
  inner.className = 'env-reveal-inner';

  var slotA = document.createElement('span'); slotA.className = 'env-slot';
  var slotB = document.createElement('span'); slotB.className = 'env-slot';

  inner.appendChild(slotA);
  inner.appendChild(slotB);
  bar.appendChild(inner);
  revealLayer.appendChild(bar);
  bar.style.display = 'block';

  function buildLine(lineText){
    var lineEl = document.createElement('span');
    lineEl.className = 'env-reveal-line';
    var tokens = lineText.split(' ');
    var words = [];
    for (var i=0;i<tokens.length;i++){
      var w = document.createElement('span');
      w.className = 'env-reveal-word';
      w.style.transition = 'opacity 900ms ease-in-out, transform 900ms ease-in-out'; // smoother/slower
      w.textContent = tokens[i];
      lineEl.appendChild(w);
      if (i < tokens.length - 1) lineEl.appendChild(document.createTextNode(' '));
      words.push(w);
    }
    return { lineEl: lineEl, words: words };
  }

  var L1 = buildLine(CFG.poem.lines[0]);
  var L2 = buildLine(CFG.poem.lines[1]);
  var L3 = buildLine(CFG.poem.lines[2]);
  var L4 = buildLine(CFG.poem.lines[3]);

  // helpers
  function mount(slot, line){ slot.innerHTML = ''; slot.appendChild(line.lineEl); }
  function revealWords(words, totalMs){
    var per = totalMs / Math.max(1, words.length);
    var i = 0;
    return new Promise(function(done){
      (function tick(){
        if (i >= words.length) return done();
        var w = words[i++];
        w.style.opacity = '1';
        w.style.transform = 'translateY(0px)';
        setTimeout(tick, per);
      })();
    });
  }
  function fadeWords(words, totalMs){
    var per = totalMs / Math.max(1, words.length);
    var i = 0;
    return new Promise(function(done){
      (function tick(){
        if (i >= words.length) return done();
        var w = words[i++];
        w.style.opacity = '0';
        w.style.transform = 'translateY(6px)';
        setTimeout(tick, per);
      })();
    });
  }
  function crossoverFade(outWords, inWords, totalMs){
    var steps = Math.max(outWords.length, inWords.length);
    var per = totalMs / Math.max(1, steps);
    var i = 0;
    return new Promise(function(done){
      (function tick(){
        if (i >= steps) return done();
        if (i < inWords.length){
          inWords[i].style.opacity = '1';
          inWords[i].style.transform = 'translateY(0px)';
        }
        if (i < outWords.length){
          outWords[i].style.opacity = '0';
          outWords[i].style.transform = 'translateY(6px)';
        }
        i++;
        setTimeout(tick, per);
      })();
    });
  }

  // Phase plan:
  // A) L1 fades in at Slot A
  // B) L1 fades out while L2 fades in at Slot B
  // C) When L1 fully gone and L2 starts to fade out, L3 fades in at Slot A
  // D) L3 fades out while L4 fades in at Slot B
  // E) Fade out whatever remains, then remove bar.

  var half = 0.5 * CFG.reveal.wordFadeTotalMs;

  // A) L1 in Slot A
  mount(slotA, L1);
  return revealWords(L1.words, half)

  // B) L1 → out, L2 → in (Slot B)
  .then(function(){
    mount(slotB, L2);
    return crossoverFade(L1.words, L2.words, half);
  })

  // (Begin fading L2 out), start L3 in Slot A where L1 was
  .then(function(){
    // Kick off L2 fade-out (no incoming yet)
    var l2Out = fadeWords(L2.words, half);
    // In parallel, start L3 fade-in at Slot A
    mount(slotA, L3);
    return Promise.all([ l2Out, revealWords(L3.words, half) ]);
  })

  // D) L3 → out, L4 → in (Slot B)
  .then(function(){
    mount(slotB, L4);
    return crossoverFade(L3.words, L4.words, half);
  })

  // E) Fade out L4 (and any remnants), then cleanup
  .then(function(){
    return fadeWords(L4.words, half);
  })
  .then(function(){
    bar.remove();
  });
}

/* Butterfly (slower flight) */
function spawnButterfly(){
  var size = randi(CFG.butterflies.sizeMin, CFG.butterflies.sizeMax);
  var tint = (function(){
    switch (poemStatus.state){
      case 'playing': return CFG.butterflies.tint.playing;
      case 'done':    return CFG.butterflies.tint.done;
      case 'warn':    return CFG.butterflies.tint.warn;
      default:        return CFG.butterflies.tint.waiting;
    }
  })();

  var el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.top = String(randi(40, Math.max(120, Math.floor(window.innerHeight/2))))+'px';
  el.style.left = '0px';
  el.style.width = String(size)+'px';
  el.style.height = String(size)+'px';
  el.style.opacity = '1';
  el.style.pointerEvents = 'none';
  el.style.zIndex = String(CFG.z.leaves);
  el.style.willChange = 'transform';

  el.innerHTML =
    '<svg viewBox="0 0 120 80" width="'+size+'" height="'+size+'" style="display:block">'+
      '<defs><filter id="bshadow" x="-30%" y="-30%" width="160%" height="160%">'+
      '<feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/></filter></defs>'+
      '<g filter="url(#bshadow)">'+
        '<path d="M60,40 C30,5 5,5 10,35 C15,60 35,55 60,40 Z" fill="'+tint+'"/>'+
        '<path d="M60,40 C90,5 115,5 110,35 C105,60 85,55 60,40 Z" fill="'+tint+'"/>'+
        '<rect x="57" y="35" width="6" height="16" rx="3" fill="rgba(30,40,60,0.6)"/>'+
      '</g></svg>';

  leavesLayer.appendChild(el);

  var fromLeft = Math.random() < 0.5;
  var startX = fromLeft ? -40 : (window.innerWidth + 40);
  var endX   = fromLeft ? (window.innerWidth + 40) : -40;
  var baseTop = parseFloat(el.style.top);
  var travelMs = randi(CFG.butterflies.travelMsMin, CFG.butterflies.travelMsMax);
  var tStart = performance.now();

  function anim(t){
    var k = clamp((t - tStart)/travelMs, 0, 1);
    var x = startX + (endX - startX) * k;
    var flutterY = Math.sin(k * Math.PI * 2.5) * 34; // slightly gentler flutter
    var y = baseTop + flutterY;
    el.style.transform = "translate("+x+"px,"+(y - baseTop)+"px)";
    if (k < 1) requestAnimationFrame(anim);
    else el.remove();
  }
  requestAnimationFrame(anim);
}

function runButterfliesLoop(){
  wait(randi(8000, 16000)).then(function(){ spawnButterfly(); });
  (function loop(){
    wait(randi(CFG.butterflies.minEveryMs, CFG.butterflies.maxEveryMs)).then(function(){
      spawnButterfly(); loop();
    });
  })();
}

/* Orchestrate */
function main(){
  runPoemDrift();
  runButterfliesLoop();
}
main();
