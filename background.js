// BLACKOUT·SHIELD — service worker (Manifest V3)
// Les réglages sont stockés dans chrome.storage.local ; le contenu est injecté
// par manifest (world MAIN, document_start) pour précéder les scripts de la page.

const DEFAULTS = {
  active: true,
  rotate: true,     // « incognito » : nouveau sel + nouveaux signaux à chaque chargement → hash différent à chaque visite
  canvas: true,     // brouillage canvas (lectures rendues instables entre visites)
  canvasMode: 'soft', // 'soft' = déterministe par page | 'strong' = aléatoire à chaque lecture
  webgl: true,      // neutralise WEBGL_debug_renderer_info (GPU masqué)
  audio: true,      // brouillage de l'empreinte audio (OfflineAudioContext)
  audioMode: 'soft',
  cores: true,      // hardwareConcurrency → 2 (comme Firefox RFP)
  memory: true,     // deviceMemory masquée (Firefox n'expose rien)
  langs: true,      // une seule langue exposée côté JS
  touch: false,     // maxTouchPoints → 0 (désactivé : casse le tactile sur tablettes)
  uach: false       // supprime navigator.userAgentData (désactivé par défaut)
};

chrome.runtime.onInstalled.addListener(async () => {
  const res = await chrome.storage.local.get('shield');
  if (!res.shield) {
    await chrome.storage.local.set({ shield: DEFAULTS });
  }
  refreshBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.shield) refreshBadge();
});

async function refreshBadge() {
  try {
    const res = await chrome.storage.local.get('shield');
    const s = res.shield || DEFAULTS;
    if (s.active === false) {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#6b6b6b' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (e) { /* API badge indisponible dans certains contextes */ }
}

refreshBadge();
