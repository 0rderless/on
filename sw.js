// OVERCHARGE service worker: lets the game launch like an app and play offline after the first load.
const VERSION = 'oc-4662d07683';
const CORE = ["./", "./index.html", "./manifest.json", "./assets/icon.png", "./assets/audio/ammo.mp3", "./assets/audio/assault_rifle_shot.mp3", "./assets/audio/blaster_shot.mp3", "./assets/audio/impact1.mp3", "./assets/audio/impact2.mp3", "./assets/audio/impact3.mp3", "./assets/audio/reload.mp3", "./assets/audio/shotgun_shot.mp3", "./assets/audio/shotgun_shot_reload.mp3", "./assets/audio/step1.mp3", "./assets/audio/step2.mp3", "./assets/models/blaster.glb", "./assets/models/rifle.glb", "./assets/models/run_anim.glb", "./assets/models/shotgun.glb", "./assets/models/soldier.glb", "./css/style.css", "./js/config.js", "./js/main.js", "./js/core/assets.js", "./js/core/audio.js", "./js/core/textures.js", "./js/data/cosmetics.js", "./js/data/items.js", "./js/data/ranks.js", "./js/game/bot.js", "./js/game/characters.js", "./js/game/collision.js", "./js/game/combat.js", "./js/game/effects.js", "./js/game/fighter.js", "./js/game/loot.js", "./js/game/match.js", "./js/game/nav.js", "./js/game/player.js", "./js/game/world.js", "./js/net/store.js", "./js/ui/controls.js", "./js/ui/hud.js", "./js/ui/icons.js", "./js/ui/lobbyScene.js", "./js/ui/menus.js", "./vendor/firebase/firebase-app-compat.js", "./vendor/firebase/firebase-database-compat.js", "./vendor/three/three.module.min.js", "./vendor/three/addons/environments/RoomEnvironment.js", "./vendor/three/addons/geometries/RoundedBoxGeometry.js", "./vendor/three/addons/loaders/GLTFLoader.js", "./vendor/three/addons/utils/BufferGeometryUtils.js", "./vendor/three/addons/utils/SkeletonUtils.js"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function cachePut(req, res) {
  if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fonts, Firebase etc. go straight to the network
  const heavy = /\/(assets|vendor)\//.test(url.pathname);
  if (heavy) {
    // big, rarely-changing files: cache first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => cachePut(req, res))));
    return;
  }
  // pages, code and styles: network first (revalidated, never a stale HTTP-cache copy) so every
  // file is from the same version; falls back to the offline cache
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => cachePut(req, res)).catch(() =>
    caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
