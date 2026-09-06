/*
 * BLACKOUT·SHIELD — content script (world MAIN, document_start, all frames)
 *
 * Objectif : rendre illisibles les empreintes qu'un site peut relever, sans
 * altérer ce que l'utilisateur voit ni casser le comportement des sites.
 *
 *  - Canvas 2D  : les lectures (getImageData / toDataURL / toBlob) reçoivent un
 *                 bruit subtil, déterministe par document (mode "soft") : une
 *                 même page reste cohérente, mais l'empreinte change à chaque
 *                 visite et diffère d'un site à l'autre.
 *  - WebGL      : l'extension WEBGL_debug_renderer_info est neutralisée → le GPU
 *                 réel (modèle exact) n'est plus lisible.
 *  - Audio      : le buffer rendu par OfflineAudioContext est bruité de la même
 *                 façon (aucun son n'est jamais joué → zéro impact audible).
 *  - Signaux    : hardwareConcurrency → 2, deviceMemory masquée, une seule
 *                 langue côté JS (optionnel : tactile et userAgentData).
 */
(() => {
  'use strict';
  const VER = '0.1.0';
  const DEFAULTS = {
    active: true,
    rotate: true,   // « incognito » : à CHAQUE chargement, nouveau sel de bruit + nouveaux signaux → hash différent à chaque visite
    canvas: true,
    canvasMode: 'soft',
    webgl: true,
    audio: true,
    audioMode: 'soft',
    cores: true,
    memory: true,
    langs: true,
    touch: false,
    uach: false
  };

  /* ---------- état local ---------- */
  const cfg = Object.assign({}, DEFAULTS);
  const state = { docSalt: (Math.random() * 0x7fffffff) | 0, tick: 0 };
  /* Profil « incognito » : tiré au sort à chaque chargement de page. */
  const PROFILE = (function () {
    const pick = function (a) { return a[(Math.random() * a.length) | 0]; };
    return {
      canvasAmp: pick([2, 3, 4, 5]),          // amplitude du bruit pixels
      canvasDiv: pick([5, 6, 7, 8, 9]),        // 1/div pixels touchés
      canvasOff: (Math.random() * 1000) | 0,   // décalage du motif
      audioMag: pick([0.0004, 0.0008, 0.0012, 0.0016]), // amplitude audio
      hw: pick([2, 4, 6, 8])                  // cœurs annoncés
    };
  })();
  const flag = (function () {
    let f = null;
    try { f = window.__BLACKOUT_SHIELD__ || (window.__BLACKOUT_SHIELD__ = {}); } catch (e) { f = {}; }
    return f;
  })();
  flag.version = VER;
  flag.features = [];
  function mark(key, val) {
    try {
      flag[key] = val;
      if (flag.features.indexOf(key) < 0) flag.features.push(key);
    } catch (e) { /* world non modifiable (rare) */ }
  }

  /* ---------- primitives ---------- */
  function clamp255(n) { return n < 0 ? 0 : n > 255 ? 255 : n | 0; }
  function cyrb(str) {
    str = String(str);
    let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }
  function mix(x, y) {
    let h = state.docSalt ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function strongTick() { return state.tick++; }

  /* ---------- capture des natifs ---------- */
  const natives = {};
  const C2d = window.CanvasRenderingContext2D;
  const OC2d = window.OffscreenCanvasRenderingContext2D;
  const HC = window.HTMLCanvasElement;
  const OBC = window.OffscreenCanvas;
  const GL1 = window.WebGLRenderingContext;
  const GL2 = window.WebGL2RenderingContext;
  const OAC = window.OfflineAudioContext;
  if (C2d) natives.gid2d = C2d.prototype.getImageData;
  if (OC2d && OC2d.prototype && OC2d.prototype.getImageData) natives.gidOff = OC2d.prototype.getImageData;
  if (HC) {
    natives.tdu = HC.prototype.toDataURL;
    natives.tbl = HC.prototype.toBlob;
  }
  if (OBC && OBC.prototype && OBC.prototype.convertToBlob) natives.ctb = OBC.prototype.convertToBlob;
  if (OAC) natives.sr = OAC.prototype.startRendering;

  const registry = []; // {obj, key, native, wrapper}
  function wrap(obj, key, native, wrapper) {
    if (!obj || typeof obj[key] !== 'function') return;
    obj[key] = wrapper;
    registry.push({ obj: obj, key: key, native: native, wrapper: wrapper });
  }
  function revertAll() {
    for (const r of registry) {
      try { if (r.obj[r.key] === r.wrapper) r.obj[r.key] = r.native; } catch (e) {}
    }
    registry.length = 0;
  }

  /* ============================================================
   * 1) CANVAS — bruit sur les lectures
   * ============================================================ */
  function noisifyImage(img) {
    const d = img.data;
    if (!d || !d.length) return img;
    const w = img.width || 1;
    const strong = cfg.canvasMode === 'strong';
    const tick = strong ? strongTick() : 0;
    const rot = cfg.rotate;
    const amp = rot ? PROFILE.canvasAmp : 3;
    const div = rot ? PROFILE.canvasDiv : 7;
    const off = rot ? (PROFILE.canvasOff % div) : 0;
    for (let i = 0; i < d.length; i += 4) {
      const p = i >> 2;
      const x = p % w;
      const y = (p / w) | 0;
      let hsh = mix(x, y) ^ Math.imul(tick, 2654435761);
      if (hsh % div === off) { // pixels touchés selon le profil du chargement
        const j = (hsh % (amp * 2 + 1)) - amp;
        d[i] = clamp255(d[i] + j);
        d[i + 1] = clamp255(d[i + 1] + (((hsh >> 5) % (amp * 2 + 1)) - amp));
        d[i + 2] = clamp255(d[i + 2] + (((hsh >> 9) % (amp * 2 + 1)) - amp));
        /* alpha (d[i+3]) laissé intact */
      }
    }
    return img;
  }
  function noisyCopy(src) {
    try {
      const w = src.width, h = src.height;
      if (!w || !h) return src;
      const ctx = src.getContext && src.getContext('2d');
      if (!ctx || !natives.gid2d) return src;
      const img = natives.gid2d.call(ctx, 0, 0, w, h);
      noisifyImage(img);
      const t = document.createElement('canvas');
      t.width = w; t.height = h;
      const tc = t.getContext('2d');
      if (!tc) return src;
      tc.putImageData(img, 0, 0);
      return t;
    } catch (e) { return src; }
  }
  function applyCanvas() {
    if (!natives.gid2d && !natives.tdu) { mark('canvas', 'indisponible'); return; }
    if (natives.gid2d && C2d) {
      wrap(C2d.prototype, 'getImageData', natives.gid2d, function getImageData() {
        const img = natives.gid2d.apply(this, arguments);
        try { noisifyImage(img); } catch (e) {}
        return img;
      });
    }
    if (natives.gidOff && OC2d) {
      wrap(OC2d.prototype, 'getImageData', natives.gidOff, function getImageData() {
        const img = natives.gidOff.apply(this, arguments);
        try { noisifyImage(img); } catch (e) {}
        return img;
      });
    }
    if (natives.tdu && HC) {
      wrap(HC.prototype, 'toDataURL', natives.tdu, function toDataURL() {
        return natives.tdu.apply(noisyCopy(this), arguments);
      });
    }
    if (natives.tbl && HC) {
      wrap(HC.prototype, 'toBlob', natives.tbl, function toBlob() {
        const args = Array.prototype.slice.call(arguments);
        const cb = args[0];
        natives.tbl.call(noisyCopy(this), function (b) {
          try { cb(b); } catch (e) {}
        }, args[1], args[2]);
      });
    }
    if (natives.ctb && OBC) {
      wrap(OBC.prototype, 'convertToBlob', natives.ctb, function convertToBlob() {
        return natives.ctb.apply(noisyCopy(this), arguments);
      });
    }
    mark('canvas', cfg.canvasMode === 'strong' ? 'bruit aléatoire' : 'bruit déterministe');
    mark('canvasMode', cfg.canvasMode);
  }

  /* ============================================================
   * 2) WEBGL — neutraliser l'identité GPU
   * ============================================================ */
  function applyWebgl() {
    let done = 0;
    function hook(Proto) {
      if (!Proto || !Proto.prototype) return;
      const native = Proto.prototype.getExtension;
      if (typeof native !== 'function') return;
      wrap(Proto.prototype, 'getExtension', native, function getExtension(name) {
        if (name === 'WEBGL_debug_renderer_info') return null;
        return native.call(this, name);
      });
      done++;
    }
    if (GL1) { hook(GL1); }
    if (GL2 && GL2 !== GL1) { hook(GL2); }
    if (done) mark('webgl', 'GPU masqué'); else mark('webgl', 'indisponible');
  }

  /* ============================================================
   * 3) AUDIO — bruit sur le rendu OfflineAudioContext
   * ============================================================ */
  function noisifyBuffer(buf) {
    if (!buf || typeof buf.copyToChannel !== 'function') return buf;
    try {
      const chans = buf.numberOfChannels || 1;
      const out = new AudioBuffer({
        length: buf.length,
        sampleRate: buf.sampleRate,
        numberOfChannels: chans
      });
      const strong = cfg.audioMode === 'strong';
      const tick = strong ? strongTick() : 0;
      for (let c = 0; c < chans; c++) {
        const src = buf.getChannelData(c);
        const dst = new Float32Array(src.length);
        const magScale = cfg.rotate ? (PROFILE.audioMag / 0.001) : 1;
        for (let i = 0; i < src.length; i++) {
          let h = state.docSalt ^ Math.imul(i + 1, 2246822519) ^ Math.imul(c + 1, 88913) ^ Math.imul(tick, 1597334677);
          h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
          const j = (((h % 2001) - 1000) / 1000000) * magScale;
          dst[i] = src[i] + j;
        }
        out.copyToChannel(dst, c);
      }
      return out;
    } catch (e) { return buf; }
  }
  function applyAudio() {
    if (!OAC || !natives.sr) { mark('audio', 'indisponible'); return; }
    wrap(OAC.prototype, 'startRendering', natives.sr, function startRendering() {
      const r = natives.sr.apply(this, arguments);
      if (r && typeof r.then === 'function') {
        return r.then(function (b) {
          try { return noisifyBuffer(b); } catch (e) { return b; }
        });
      }
      return r;
    });
    mark('audio', cfg.audioMode === 'strong' ? 'bruit aléatoire' : 'bruit déterministe');
    mark('audioMode', cfg.audioMode);
  }

  /* ============================================================
   * 4) SIGNAL NAVIGATEUR — normalisation
   * ============================================================ */
  const navPrev = [];
  function defNav(key, val, tagged) {
    try {
      const desc = Object.getOwnPropertyDescriptor(navigator, key);
      navPrev.push({ key: key, desc: desc });
      Object.defineProperty(navigator, key, { value: val, configurable: true, writable: true });
    } catch (e) { /* propriété protégée */ }
  }
  function restoreNav() {
    for (const p of navPrev) {
      try {
        if (p.desc) Object.defineProperty(navigator, p.key, p.desc);
        else delete navigator[p.key];
      } catch (e) {}
    }
    navPrev.length = 0;
  }
  function applyNav() {
    if (cfg.cores) { try { defNav('hardwareConcurrency', cfg.rotate ? PROFILE.hw : 2, 'cores'); } catch (e) {} }
    if (cfg.memory) { try { defNav('deviceMemory', undefined, 'memory'); } catch (e) {} }
    if (cfg.touch) { try { defNav('maxTouchPoints', 0, 'touch'); } catch (e) {} }
    if (cfg.langs && navigator.languages && navigator.languages.length) {
      let list;
      if (cfg.rotate) {
        /* langue principale conservée (l'interface ne change pas), le reste est réordonné/aléatoire */
        const prim = (navigator.language && String(navigator.language)) || String(navigator.languages[0]);
        const rest = Array.prototype.map.call(navigator.languages, String).filter(function (l) { return l !== prim; });
        for (let i = rest.length - 1; i > 0; i--) {
          const k = (Math.random() * (i + 1)) | 0;
          const tmp = rest[i]; rest[i] = rest[k]; rest[k] = tmp;
        }
        const extra = rest.slice(0, (Math.random() * 3) | 0); // 0 à 2 langues supplémentaires
        list = [prim].concat(extra);
      } else {
        list = [(navigator.language && String(navigator.language)) || String(navigator.languages[0])];
      }
      try { defNav('languages', list, 'langs'); } catch (e) {}
    }
    if (cfg.uach && 'userAgentData' in navigator) {
      try { defNav('userAgentData', undefined, 'uach'); } catch (e) {}
    }
    mark('nav', 'normalisé');
    mark('rotate', !!cfg.rotate);
  }

  /* ============================================================
   * application / réglages
   * ============================================================ */
  function applyAll() {
    revertAll();
    restoreNav();
    try { flag.features.length = 0; } catch (e) {}
    try { flag.active = !!cfg.active; } catch (e) {}
    if (!cfg.active) {
      return;
    }
    if (cfg.canvas) applyCanvas();
    if (cfg.webgl) applyWebgl();
    if (cfg.audio) applyAudio();
    if (cfg.cores || cfg.memory || cfg.touch || cfg.langs || cfg.uach || cfg.rotate) applyNav();
    try { flag.settings = Object.assign({}, cfg); } catch (e) {}
  }

  /* Applique d'abord les réglages par défaut (synchrone, dès document_start),
   * puis affine avec ceux stockés (asynchrone). */
  applyAll();
  mark('ready', true);
  flag.id = cyrb(location.origin + '|' + state.docSalt).slice(0, 12);

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('shield', function (res) {
        const s = res && res.shield;
        if (s) {
          Object.keys(DEFAULTS).forEach(function (k) {
            if (typeof s[k] !== 'undefined') cfg[k] = s[k];
          });
          try { flag.settings = Object.assign({}, cfg); } catch (e) {}
          applyAll();
        }
      });
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === 'local' && changes.shield && changes.shield.newValue) {
          const s = changes.shield.newValue;
          Object.keys(DEFAULTS).forEach(function (k) {
            if (typeof s[k] !== 'undefined') cfg[k] = s[k];
          });
          try { flag.settings = Object.assign({}, cfg); } catch (e) {}
          applyAll(); // recharger la page pour un basculement complet des API déjà patchées
        }
      });
    }
  } catch (e) { /* chrome API indisponible (page statique) */ }
})();
