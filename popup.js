'use strict';
const DEFAULTS = {
  active: true, rotate: true, canvas: true, canvasMode: 'soft',
  webgl: true, audio: true, audioMode: 'soft',
  cores: true, memory: true, langs: true, touch: false, uach: false
};

const FIELDS = [
  { key: 'active', label: 'Protection globale', tag: 'MAÎTRE', desc: 'Coupure générale — toutes les sondes sont neutralisées d\u2019un coup.' },
  { key: 'rotate', label: 'Incognito — rotation auto', tag: 'RELOAD ≠ MEME HASH', desc: 'À chaque page chargée : nouveau sel de bruit canvas/audio, cœurs et langues tirés au hasard. Rechargez → empreinte différente. Rien de visible ne change.' },
  { key: 'canvas', label: 'Canvas 2D', tag: 'EMPREINTE', desc: 'Lectures bruitées : l\u2019empreinte change à chaque visite, la page reste intacte.' },
  { key: 'canvasMode', type: 'mode', label: 'Canvas — intensité', options: [['soft', 'Doux · déterministe'], ['strong', 'Fort · aléatoire']], parent: 'canvas' },
  { key: 'webgl', label: 'WebGL / GPU', tag: 'EMPREINTE', desc: 'Extension unmasked neutralisée : le modèle exact du GPU devient illisible.' },
  { key: 'audio', label: 'Audio', tag: 'EMPREINTE', desc: 'Rendu OfflineAudioContext bruité. Aucun son joué : zéro impact audible.' },
  { key: 'audioMode', type: 'mode', label: 'Audio — intensité', options: [['soft', 'Doux · déterministe'], ['strong', 'Fort · aléatoire']], parent: 'audio' },
  { key: 'cores', label: 'Cœurs CPU', tag: 'SIGNAL', desc: 'hardwareConcurrency forcé à 2 (comme Firefox en mode résistant).' },
  { key: 'memory', label: 'Mémoire (deviceMemory)', tag: 'SIGNAL', desc: 'Valeur masquée — la RAM n\u2019est plus annoncée.' },
  { key: 'langs', label: 'Langues', tag: 'SIGNAL', desc: 'Une seule langue exposée au JavaScript (le serveur garde la vraie liste).' },
  { key: 'touch', label: 'Tactile (maxTouchPoints)', tag: 'SIGNAL', desc: 'Forcé à 0. À laisser OFF sur tablette : casse les gestes tactiles.' },
  { key: 'uach', label: 'UA Client Hints', tag: 'SIGNAL', desc: 'Supprime navigator.userAgentData (détails Chromium/OS granulaires).' }
];

const isChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
let settings = Object.assign({}, DEFAULTS);

function build() {
  const rows = document.getElementById('rows');
  rows.innerHTML = '';
  FIELDS.forEach(function (f) {
    const row = document.createElement('div');
    row.className = 'row' + (f.type === 'mode' ? ' mode' : '');
    const parent = f.parent;
    row.dataset.key = f.key;
    if (parent) row.dataset.parent = parent;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const lb = document.createElement('div');
    lb.className = 'lb';
    const span = document.createElement('span');
    span.textContent = f.label;
    lb.appendChild(span);
    if (f.tag) {
      const s = document.createElement('span');
      s.className = 'sub';
      s.textContent = f.tag;
      lb.appendChild(s);
    }
    meta.appendChild(lb);
    if (f.desc) {
      const ds = document.createElement('div');
      ds.className = 'ds';
      ds.textContent = f.desc;
      meta.appendChild(ds);
    }
    row.appendChild(meta);

    if (f.type === 'mode') {
      const sel = document.createElement('select');
      f.options.forEach(function (o) {
        const op = document.createElement('option');
        op.value = o[0];
        op.textContent = o[1];
        sel.appendChild(op);
      });
      sel.addEventListener('change', function () {
        settings[f.key] = sel.value;
        save();
      });
      row.appendChild(sel);
    } else {
      const sw = document.createElement('label');
      sw.className = 'sw';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.setAttribute('role', 'switch');
      inp.addEventListener('change', function () {
        settings[f.key] = inp.checked;
        save();
      });
      const track = document.createElement('i');
      sw.appendChild(inp);
      sw.appendChild(track);
      row.appendChild(sw);
    }
    rows.appendChild(row);
  });
}

function refresh() {
  const rows = document.querySelectorAll('.row');
  rows.forEach(function (row) {
    const key = row.dataset.key;
    const parent = row.dataset.parent;
    const hidden = parent && !settings[parent];
    row.style.display = hidden ? 'none' : '';
    if (row.querySelector('input')) {
      row.querySelector('input').checked = !!settings[key];
      row.querySelector('input').disabled = !settings.active;
    } else if (row.querySelector('select')) {
      row.querySelector('select').value = settings[key] || 'soft';
      row.querySelector('select').disabled = !settings.active;
    }
  });
  document.body.classList.toggle('off', !settings.active);
  const pill = document.getElementById('statusPill');
  if (pill) {
    pill.textContent = settings.active ? 'ACTIF' : 'COUPÉ';
    pill.className = 'pill' + (settings.active ? ' on' : '');
  }
}

function save() {
  if (isChrome) {
    chrome.storage.local.set({ shield: settings }, function () { /* ok */ });
  }
  refresh();
}

function load() {
  build();
  if (isChrome) {
    chrome.storage.local.get('shield', function (res) {
      const s = res && res.shield;
      if (s) {
        Object.keys(DEFAULTS).forEach(function (k) {
          if (typeof s[k] !== 'undefined') settings[k] = s[k];
        });
      }
      refresh();
    });
  } else {
    document.querySelector('.hint').textContent = 'Aperçu hors Chrome — réglages non persistants.';
    refresh();
  }
}

document.addEventListener('DOMContentLoaded', load);
