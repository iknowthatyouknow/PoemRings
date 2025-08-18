// index.js — loads the music library from tracks.json and exposes window.LIBRARY
(function () {
  const MUSIC_DIR  = 'music/';
  const TRACKS_URL = 'tracks.json';

  function toEntry(name) {
    const clean = String(name || '').trim();
    return { name: clean, url: MUSIC_DIR + encodeURIComponent(clean) };
  }

  async function loadLibrary() {
    try {
      // cache-bust so we always pull the latest manifest
      const res = await fetch(TRACKS_URL + '?v=' + Date.now(), { cache: 'no-cache' });
      if (!res.ok) throw new Error('tracks.json HTTP ' + res.status);

      const arr = await res.json();
      const files = Array.isArray(arr) ? arr : [];
      const lib = files
        .map(toEntry)
        .filter(e => e.name && /\.mp3(\?.*)?$/i.test(e.name));

      if (!lib.length) throw new Error('Empty manifest');

      // ✅ FIX: assign the actual library
      window.LIBRARY = lib;
      console.log('[music] loaded', lib.length, 'tracks from tracks.json');
    } catch (err) {
      console.warn('[music] failed to load tracks.json; using minimal fallback', err);
      window.LIBRARY = [
        toEntry('Jazz Relax-1.mp3'),
        toEntry('Lofi Jazz-1.mp3')
      ];
    }

    // Signal readiness
    window.musicReady = Promise.resolve(true);
    window.dispatchEvent(new Event('musicReady'));
  }

  window.musicReady = loadLibrary();
})();
