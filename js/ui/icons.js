// Renders inventory icons and locker portraits from the real 3D models.
import * as THREE from 'three';
import { SKINS, PICKAXES, RARITY_COLORS } from '../data/cosmetics.js';

function rtToDataURL(renderer, rt, w, h, bg) {
  const buf = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  const img = x.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  const t = document.createElement('canvas'); t.width = w; t.height = h;
  t.getContext('2d').putImageData(img, 0, 0);
  x.drawImage(t, 0, 0);
  return c;
}

export function renderIcons(renderer, factory, envTex) {
  const icons = {};
  const W = 128;
  const rt = new THREE.WebGLRenderTarget(W, W, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x554488, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(2, 3, 4); scene.add(dl);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50);
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  const shoot = (obj, key, opts = {}) => {
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const half = Math.max(s.x, s.y, s.z) * 0.58;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
    const dir = opts.dir || new THREE.Vector3(1, 0.15, 0.05);
    cam.position.copy(c).addScaledVector(dir.normalize(), 10);
    cam.lookAt(c); cam.updateProjectionMatrix();
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
    icons[key] = rtToDataURL(renderer, rt, W, W).toDataURL('image/png');
    scene.remove(obj);
  };
  for (const id of ['ar', 'shotgun', 'smg', 'sniper']) {
    const g = factory.gunModel(id, 2);
    // icon facing right: muzzle (+Z) → camera sees from +X
    g.rotation.y = 0;
    shoot(g, 'gun_' + id, { dir: new THREE.Vector3(-1, 0.12, 0) });
  }
  for (const id of ['shockwave', 'overdrive']) shoot(factory.grenadeModel(id), 'nade_' + id, { dir: new THREE.Vector3(0.3, 0.4, 1) });
  shoot(factory.medkitModel(), 'heal_medkit', { dir: new THREE.Vector3(0.25, 0.35, 1) });
  { const jp = factory.jetpackModel(); for (const fl of jp.userData.flames) jp.remove(fl); shoot(jp, 'jetpack', { dir: new THREE.Vector3(0.7, 0.25, -1) }); }
  for (const p of PICKAXES) { const g = factory.pickaxeModel(p.id); g.rotation.z = -0.7; shoot(g, 'pick_' + p.id, { dir: new THREE.Vector3(0, 0, 1) }); }

  // Skin portraits (locker cards) — taller render target
  const PW = 224, PH = 292;
  const rt2 = new THREE.WebGLRenderTarget(PW, PH, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const pcam = new THREE.PerspectiveCamera(30, PW / PH, 0.1, 50);
  for (const s of SKINS) {
    const ch = factory.create({ skin: s.id });
    ch.setHeld('gun', 'ar', 2);
    ch.update(0.5, { vx: 0, vz: 0, yaw: -0.4, pitch: 0, grounded: true, mode: 'ground', reloadFrac: -1, camDist: 2 });
    scene.add(ch.root);
    pcam.position.set(0, 1.25, 4.3); pcam.lookAt(0, 0.98, 0);
    renderer.setRenderTarget(rt2); renderer.clear(); renderer.render(scene, pcam);
    const grad = RARITY_COLORS[s.rarity];
    const canvas = rtToDataURL(renderer, rt2, PW, PH, null);
    const out = document.createElement('canvas'); out.width = PW; out.height = PH;
    const x = out.getContext('2d');
    const g = x.createRadialGradient(PW / 2, PH * 0.4, 10, PW / 2, PH * 0.45, PH * 0.8);
    g.addColorStop(0, grad); g.addColorStop(1, '#120a30');
    x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    x.globalAlpha = 0.15; x.strokeStyle = '#fff';
    for (let i = -PH; i < PW; i += 18) { x.beginPath(); x.moveTo(i, PH); x.lineTo(i + PH, 0); x.stroke(); }
    x.globalAlpha = 1;
    x.drawImage(canvas, 0, 0);
    icons['skin_' + s.id] = out.toDataURL('image/png');
    scene.remove(ch.root); ch.dispose();
  }
  // Pickaxe cards
  for (const p of PICKAXES) {
    const out = document.createElement('canvas'); out.width = PW; out.height = PH;
    const x = out.getContext('2d');
    const g = x.createRadialGradient(PW / 2, PH * 0.45, 10, PW / 2, PH * 0.45, PH * 0.8);
    g.addColorStop(0, RARITY_COLORS[p.rarity]); g.addColorStop(1, '#120a30');
    x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    const img = new Image(); img.src = icons['pick_' + p.id];
    icons['pickcard_' + p.id + '_bg'] = out.toDataURL('image/png');
  }
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(0x000000, prevClear);
  rt.dispose(); rt2.dispose();
  return icons;
}

/** Top-down render of the map for the minimap / big map. */
export function renderMapImage(renderer, world, size = 1024) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8f86c9);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5fa0, 2.4));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(-0.4, 1, -0.3); scene.add(dl);
  const parent = world.group.parent;
  scene.add(world.group);
  const half = 160;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 1, 400);
  cam.position.set(0, 200, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  const rt = new THREE.WebGLRenderTarget(size, size, { colorSpace: THREE.SRGBColorSpace });
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prev);
  const canvas = rtToDataURL(renderer, rt, size, size, null);
  rt.dispose();
  scene.remove(world.group);
  if (parent) parent.add(world.group);
  // subtle grid + vignette
  const x = canvas.getContext('2d');
  x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { const p = i * size / 8; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, size); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(size, p); x.stroke(); }
  return canvas;
}
