/* =========================================================================
   windsong-controller.js
   - Central controller for Wind’s Song knobs (wind, breath, elegra, rez)
   - Rez semantics:
       rez = 1  -> once per page refresh (no extra triggers)
       rez = 2..6 -> trigger every (60/rez) minutes
   - No persistence; refresh restores defaults.
   - Must be loaded AFTER environment.js
   ========================================================================= */

(function(){
  // Hard defaults per your ruleset (mirror your current live behavior)
  const defaults = {
    wind:   1.0,  // global speed multiplier (1 = current speed)
    breath: 16,   // seconds between drifting lines
    elegra: 15,   // seconds for bottom reveal phase pacing
    rez:    1     // 1=once per refresh; 2..6=(60/rez) minutes
  };

  // Ensure the shared hook exists with defaults
  if (!window.__WINDS_SONG__) {
    window.__WINDS_SONG__ = { ...defaults };
  } else {
    for (const k in defaults) {
      if (window.__WINDS_SONG__[k] === undefined) {
        window.__WINDS_SONG__[k] = defaults[k];
      }
    }
  }

  // Broadcast current values to environment.js
  function broadcastUpdate() {
    const { wind, breath, elegra, rez } = window.__WINDS_SONG__;
    document.dispatchEvent(new CustomEvent("windsong:update", {
      detail: { wind, breath, elegra, rez }
    }));
  }

  // Rez scheduler
  let rezTimer = null;

  function clearRezTimer(){
    if (rezTimer) {
      clearInterval(rezTimer);
      rezTimer = null;
    }
  }

  function scheduleByRez(){
    clearRezTimer();
    const rez = Number(window.__WINDS_SONG__.rez) || 1;
    if (rez <= 1) return; // once per page load only

    const minutes = 60 / rez;                 // e.g., 2->30 min, 3->20, 4->15, 5->12, 6->10
    const intervalMs = Math.max(1, Math.round(minutes * 60 * 1000));

    rezTimer = setInterval(() => {
      // environment.js listens for this to run the poem again (guarded there)
      document.dispatchEvent(new Event("windsong:trigger"));
    }, intervalMs);
  }

  // Public API (optional UI can call this)
  function setKnobs({wind, breath, elegra, rez} = {}){
    if (wind   !== undefined) window.__WINDS_SONG__.wind   = Number(wind)   || defaults.wind;
    if (breath !== undefined) window.__WINDS_SONG__.breath = Math.max(1, Number(breath) || defaults.breath);
    if (elegra !== undefined) window.__WINDS_SONG__.elegra = Math.max(1, Number(elegra) || defaults.elegra);
    if (rez    !== undefined) window.__WINDS_SONG__.rez    = Math.min(6, Math.max(1, Number(rez) || defaults.rez));

    broadcastUpdate();
    scheduleByRez();
  }

  window.WindsSong = {
    set: setKnobs,
    get: () => ({ ...window.__WINDS_SONG__ }),
    rezOnce(){ setKnobs({rez:1}); },
    rezPreset(minutes){
      // helper for exact divisors (10,12,15,20,30)
      const map = {10:6, 12:5, 15:4, 20:3, 30:2};
      if (map[minutes]) setKnobs({rez: map[minutes]});
    }
  };

  // Initialize now (defaults)
  setKnobs(window.__WINDS_SONG__);
})();
