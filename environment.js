/* =========================================================================
   environment.js  (compat-safe; no numeric separators; no ruleset drift)
   - Background-only effects (NO changes to index.html)
   - Leaves stay as-is (from environment.html)
   - Adds poem drift + bottom reveal
   - Adds subtle status butterfly
   ======================================================================== */

/* --------------------------
   Utilities (compat-safe)
--------------------------- */
function wait(ms){ return new Promise(function(res){ setTimeout(res, ms); }); }
function rand(a,b){ return a + Math.random()*(b-a); }
function randi(a,b){ return Math.floor(rand(a, b+1)); }
function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }

/* --------------------------
   Config (per ruleset)
--------------------------- */
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
      "Love is the wind, and the wind is you."
    ],
    firstLineDelayMaxMs: 120000,     // 0–120s
    betweenLinesMinMs: 16000,        // 16–18s (slower sequencing; ~one at a time)
    betweenLinesMaxMs: 18000,
    driftDurationMs: 26000,          // slower cross-screen
    driftFontMin: 13,
    driftFontMax: 16,
    fadeEdge: 0.20                   // earlier fade in/out window (readability)
  },
  reveal: {
    enabled: true,
    appearAfterLastLineMs: 30000,    // 30s after final drift line
    rowPadding: 10,
    fontSizePx: 16,
    wordFadeTotalMs: 15000,          // per two-line phase (unchanged)
    barBg: 'linear-gradient(180deg, rgba(10,14,22,.85), rgba(10,14,22,.9))',
    border: '1px solid rgba(255,255,255,.08)'
  },
  butterflies: {
    minEveryMs: 60000,
    maxEveryMs: 90000,
    travelMsMin: 12000,
    travelMsMax: 18000,
    sizeMin: 20,
    sizeMax: 28,
    tint: {
      waiting: 'rgba(255, 230, 120, 0.50)', // yellow: scheduled/waiting
      playing: 'rgba(120, 200, 255, 0.55)', // cyan/blue: in progress
      done:    'rgba(140, 235, 170, 0.55)', // green: finished
      warn:    'rgba(255, 120, 120, 0.55)'  // red: watchdog warning
    }
  }
};

/* --------------------------
   Root layers (no index.html edits)
--------------------------- */
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

/* --------------------------
   Scoped styles
--------------------------- */
(function(){
  var css =
  ".env-poem-line{position:absolute;white-space:nowrap;color:"+CFG.colors.poemLine+";text-shadow:0 1px 3px "+CFG.colors.poemShadow+";opacity:.95;font-weight:600;letter-spacing:.2px;user-select:none;will-change:transform,opacity;pointer-events:none}" +
  ".env-reveal-bar{max-width:980px;width:calc(100vw - 24px);margin:0 12px 10px;background:"+CFG.reveal.barBg+";border:"+CFG.reveal.border+";border-radius:10px;padding:"+CFG.reveal.rowPadding+"px 14px;color:"+CFG.colors.reveal+";font-size:"+CFG.reveal.fontSizePx+"px;line-height:1.45;letter-spacing:.2px;display:none;text-align:center}" +
  ".env-reveal-line{display:inline-block;margin-right:.75em;white-space:nowrap;opacity:1}" +
  ".env-reveal-word{display:inline-block;opacity:0;will-change:opacity,transform;transform:translateY(4px)}";
  var tag = document.createElement('style');
  tag.textContent = css;
  document.head.appendChild(tag);
})();

/* --------------------------
   Poem status (for butterfly tint)
--------------------------- */
var poemStatus = { state: 'waiting', set: function(next){ this.state = next; } };

/* --------------------------
   Poem: drifting lines
--------------------------- */
function runPoemDrift(){
  (function(){ // watchdog
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
        } else {
          poemStatus.set('done');
        }
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
  var fadeEdge = CFG.poem.fadeEdge; // fade window at each edge

  function step(t){
    var k = clamp((t - tStart)/dur, 0, 1);
    var x = startX + (endX - startX) * k;

    // smoothstep ease for entry/exit opacity
    var fade;
    if (k < fadeEdge){
      var u = k / fadeEdge; fade = u*u*(3-2*u);
    } else if (k > 1 - fadeEdge){
      var v = (1 - k) / fadeEdge; fade = v*v*(3-2*v);
    } else {
      fade = 1;
    }

    el.style.transform = "translate("+x+"px,0)";
    el.style.opacity = String(0.95 * fade);

    if (k < 1){ requestAnimationFrame(step); }
    else { el.remove(); }
  }
  requestAnimationFrame(step);
}

/* --------------------------
   Bottom reveal (word-by-word, centered)
--------------------------- */
function runRevealSequence(){
  var bar = document.createElement('div');
  bar.className = 'env-reveal-bar';
  revealLayer.appendChild(bar);

  // Build words with real spaces between (no run-together)
  var lines = CFG.poem.lines.map(function(line){
    var lineEl = document.createElement('span');
    lineEl.className = 'env-reveal-line';

    var tokens = line.split(' ');
    var words = [];
    for (var i=0;i<tokens.length;i++){
      var w = document.createElement('span');
      w.className = 'env-reveal-word';
      w.textContent = tokens[i];
      w.style.transition = 'opacity 600ms ease, transform 600ms ease';
      lineEl.appendChild(w);
      if (i < tokens.length - 1){
        lineEl.appendChild(document.createTextNode(' ')); // real space node
      }
      words.push(w);
    }
    bar.appendChild(lineEl);
    return { lineEl: lineEl, words: words };
  });

  bar.style.display = 'block';

  // Phase A: show L1 then cross-fade L1→L2
  return revealWords(lines[0].words, 0.5*CFG.reveal.wordFadeTotalMs).then(function(){
    return crossoverFade(lines[0].words, lines[1].words, 0.5*CFG.reveal.wordFadeTotalMs);
  })
  // Phase B: L2→L3 then L3→L4
  .then(function(){ return crossoverFade(lines[1].words, lines[2].words, 0.5*CFG.reveal.wordFadeTotalMs); })
  .then(function(){ return crossoverFade(lines[2].words, lines[3].words, 0.5*CFG.reveal.wordFadeTotalMs); })
  // Fade out L4 word-by-word
  .then(function(){ return fadeWords(lines[3].words, 0.5*CFG.reveal.wordFadeTotalMs); })
  .then(function(){ bar.remove(); });
}

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

function crossoverFade(outgoingWords, incomingWords, totalMs){
  var steps = Math.max(outgoingWords.length, incomingWords.length);
  var per = totalMs / Math.max(1, steps);
  var i = 0;
  return new Promise(function(done){
    (function tick(){
      if (i >= steps) return done();

      if (i < incomingWords.length){
        var wIn = incomingWords[i];
        wIn.style.opacity = '1';
        wIn.style.transform = 'translateY(0px)';
      }
      if (i < outgoingWords.length){
        var wOut = outgoingWords[i];
        wOut.style.opacity = '0';
        wOut.style.transform = 'translateY(4px)';
      }
      i++;
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
      w.style.transform = 'translateY(4px)';
      setTimeout(tick, per);
    })();
  });
}

/* --------------------------
   Butterfly (reduced brightness + status tint)
--------------------------- */
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
    var flutterY = Math.sin(k * Math.PI * 3) * 40;
    var y = baseTop + flutterY;
    el.style.transform = "translate("+x+"px,"+(y - baseTop)+"px)";
    if (k < 1) requestAnimationFrame(anim);
    else el.remove();
  }
  requestAnimationFrame(anim);
}

function runButterfliesLoop(){
  wait(randi(6000, 14000)).then(function(){ spawnButterfly(); });
  (function loop(){
    wait(randi(CFG.butterflies.minEveryMs, CFG.butterflies.maxEveryMs)).then(function(){
      spawnButterfly(); loop();
    });
  })();
}

/* --------------------------
   Orchestrate
--------------------------- */
function main(){
  runPoemDrift();
  runButterfliesLoop();
}
main();
