# BLACKOUT·SHIELD

Extension Chromium (Manifest V3) anti-fingerprinting : brouille les empreintes
**canvas**, **WebGL** et **audio**, et normalise les signaux **matériel / langue**,
**sans casser les sites** — contrairement à un changement d'User-Agent.

Complément du laboratoire d'audit `index.html` (BLACKOUT·LAB) : l'audit détecte la
protection active et l'indice de discrétion grimpe en conséquence.

## Comment ça marche

| Vecteur | Action | Effet sur les sites |
|---|---|---|
| Incognito — rotation auto | **À chaque chargement de page**, le sel de bruit (canvas/audio), `hardwareConcurrency` (2/4/6/8) et la liste de langues sont **retirés au sort**. Rechargez une page → le hash d'empreinte change. | La langue principale reste la vraie (l'interface ne change pas) ; rien d'audible ni de visible. Désactivable. |
| Canvas 2D | Les lectures `getImageData` / `toDataURL` / `toBlob` reçoivent un bruit subtil (amplitude et densité tirées au sort à chaque chargement). Mode **doux** (défaut) : déterministe au sein d'une page → comportement cohérent, mais empreinte différente à chaque visite et par site. Mode **fort** : aléatoire à chaque lecture. | Rien de visible ; seule la *lecture* des pixels est modifiée de quelques unités. L'affichage est intact. |
| WebGL | `WEBGL_debug_renderer_info` renvoyé `null` : le modèle exact du GPU n'est plus lisible. | Aucun impact : les jeux/visualisations continuent de fonctionner, seul le nom du GPU est masqué. |
| Audio | Le buffer rendu par `OfflineAudioContext` est bruité (± 0,001). Aucun son n'est jamais joué par cette API. | Zéro impact audible. |
| Cœurs CPU | `navigator.hardwareConcurrency` → `2` | Aucun impact perceptible (réglage désactivable). |
| Mémoire | `navigator.deviceMemory` masquée | Identique à Firefox (qui n'expose rien). |
| Langues | `navigator.languages` → une seule langue | Le serveur reçoit toujours la vraie liste (en-tête Accept-Language intact) ; seul le JS lit une liste réduite. |
| Tactile / UA-CH | Désactivés par défaut (risque de casse ou inutile) | — |

Limites assumées :
- **Fuite IP WebRTC** : non modifiable par une extension. Activez
  `chrome://flags/#enable-webrtc-hide-local-ips-with-mdns` (ou `#webrtc-ip-handling-policy`
  → `disable_non_proxied_udp`) dans Chromium.
- **Workers** : les `Worker`/`SharedWorker` ne sont pas patchés (limitation des
  content scripts). Peu utilisé pour le fingerprinting.
- **Fuseau / écran / polices** : non modifiables par extension ; Firefox +
  `privacy.resistFingerprinting` reste la référence absolue pour ces vecteurs.

## Installation

1. Téléchargez / copiez le dossier `blackout-shield/`.
2. Ouvrez `chrome://extensions` (ou `edge://extensions`, `brave://extensions`).
3. Activez **Mode développeur** (coin haut-droit).
4. **Charger l'extension non empaquetée** → sélectionnez `blackout-shield/`.
5. Optionnel — pour auditer un fichier local (`file://`) : bouton **Détails** de
   l'extension → activer **Autoriser l'accès aux URLs en fichier**.
6. Ouvrez l'icône BLACKOUT·SHIELD : réglez les interrupteurs (Canvas fort = plus
   agressif mais décelable par un test double-lecture), puis rechargez l'onglet.

## Vérification

- Ouvrez `index.html` (BLACKOUT·LAB) **via un serveur HTTP ou en `file://`** :
  canvas, WebGL, audio passent en « PROTÉGÉ » et l'indice global monte nettement.
- Rechargez deux fois la même page : le hash d'empreinte affiché doit **changer à chaque rechargement**
  (c'est la rotation incognito).
- Ou testez sur des sites connus : `browserleaks.com/canvas`, `amiunique.org`,
  `fingerprintjs.com/demo` (le hash doit changer d'une visite à l'autre).
- DevTools → Réseau : l'extension n'émet **aucune** requête.

## Réglages (popup)

Interrupteurs mémorisés dans `chrome.storage.local` (aucune donnée envoyée).
Après un changement, **rechargez l'onglet** pour une application complète.
