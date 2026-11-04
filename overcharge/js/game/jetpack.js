// OVERCHARGE jetpack: twin-turbine sci-fi pack with a glowing reactor core.
// Every part is merged per material once, so each worn jetpack costs only a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const THRUSTER_X = 0.128, THRUSTER_Z = -0.088, SPLAY = 0.07;

function roundedShape(wTop, wBot, h, r) {
  // tapered plate: wider at the shoulders, rounded corners
  const s = new THREE.Shape();
  const t = h / 2, b = -h / 2, xt = wTop / 2, xb = wBot / 2;
  s.moveTo(-xb + r, b);
  s.lineTo(xb - r, b); s.quadraticCurveTo(xb, b, xb + (xt - xb) * (r / h), b + r);
  s.lineTo(xt, t - r); s.quadraticCurveTo(xt, t, xt - r, t);
  s.lineTo(-xt + r, t); s.quadraticCurveTo(-xt, t, -xt, t - r);
  s.lineTo(-xb - (xt - xb) * (r / h), b + r); s.quadraticCurveTo(-xb, b, -xb + r, b);
  return s;
}

function extrude(shape, depth, bevel) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
}

function gradientTex(stops, w = 32, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function radialTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Thruster frame (shared by the geometry and the flame placement). */
function thrusterMatrix(side) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(side * THRUSTER_X, 0.005, THRUSTER_Z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, 0, side * SPLAY)), new THREE.Vector3(1, 1, 1));
  return m;
}

function buildParts() {
  const parts = { shell: [], armor: [], metal: [], accent: [], glow: [] };
  const put = (key, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = null) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    if (parent) m.premultiply(parent);
    geo.applyMatrix4(m);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    parts[key].push(geo.index ? geo.toNonIndexed() : geo);
  };

  // ---- back shell (graphite) and armoured housing (white)
  put('shell', extrude(roundedShape(0.31, 0.22, 0.40, 0.045), 0.026, 0.011), 0, 0, -0.037);
  put('armor', extrude(roundedShape(0.14, 0.11, 0.34, 0.03), 0.034, 0.012), 0, -0.005, -0.083);
  // shoulder yoke across the top
  put('armor', new RoundedBoxGeometry(0.29, 0.05, 0.05, 1, 0.016), 0, 0.17, -0.05);
  put('accent', new THREE.BoxGeometry(0.2, 0.012, 0.052), 0, 0.152, -0.052);
  // reactor core window
  put('shell', new RoundedBoxGeometry(0.056, 0.24, 0.014, 1, 0.006), 0, 0.006, -0.097);
  put('glow', new THREE.CapsuleGeometry(0.019, 0.17, 3, 8), 0, 0.006, -0.1);
  for (const y of [-0.06, 0.006, 0.072]) put('shell', new THREE.BoxGeometry(0.054, 0.009, 0.014), 0, y, -0.118);
  // status lights and vents
  for (let i = 0; i < 4; i++) put('glow', new THREE.BoxGeometry(0.011, 0.011, 0.006), -0.027 + i * 0.018, 0.142, -0.098);
  for (let i = 0; i < 3; i++) put('shell', new THREE.BoxGeometry(0.075, 0.006, 0.01), 0, -0.118 - i * 0.017, -0.098);
  // carry handle
  put('metal', new THREE.TorusGeometry(0.034, 0.0075, 6, 12, Math.PI), 0, 0.195, -0.056);
  // lower mount and exhaust manifold
  put('shell', new RoundedBoxGeometry(0.2, 0.04, 0.05, 1, 0.014), 0, -0.185, -0.055);
  for (const s of [-1, 1]) {
    // pylons tying the turbines to the core
    put('shell', new THREE.BoxGeometry(0.07, 0.028, 0.028), s * 0.088, 0.1, -0.075);
    put('shell', new THREE.BoxGeometry(0.07, 0.028, 0.028), s * 0.088, -0.08, -0.075);
    // shoulder straps that disappear over the shoulders
    const strap = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.085, 0.17, -0.02), new THREE.Vector3(s * 0.092, 0.225, 0.03),
      new THREE.Vector3(s * 0.098, 0.235, 0.09), new THREE.Vector3(s * 0.1, 0.21, 0.14),
    ]);
    put('shell', new THREE.TubeGeometry(strap, 7, 0.011, 4, false));
  }

  // ---- turbines
  const bodyProfile = [
    [0.0, 0.205], [0.022, 0.202], [0.04, 0.193], [0.052, 0.178], [0.058, 0.158],
    [0.061, 0.11], [0.062, 0.0], [0.06, -0.08], [0.054, -0.105], [0.05, -0.125],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const nozzleProfile = [
    [0.05, -0.12], [0.047, -0.135], [0.052, -0.155], [0.061, -0.185], [0.068, -0.212],
    [0.06, -0.214], [0.05, -0.19], [0.038, -0.172], [0.0, -0.166],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  for (const s of [-1, 1]) {
    const T = thrusterMatrix(s);
    put('armor', new THREE.LatheGeometry(bodyProfile, 14), 0, 0, 0, 0, 0, 0, T);
    put('metal', new THREE.LatheGeometry(nozzleProfile, 14), 0, 0, 0, 0, 0, 0, T);
    for (const y of [0.12, -0.035, -0.1]) put('shell', new THREE.TorusGeometry(0.0615, 0.0055, 4, 14), 0, y, 0, Math.PI / 2, 0, 0, T);
    put('accent', new THREE.CylinderGeometry(0.0628, 0.0628, 0.03, 14, 1, true), 0, 0.072, 0, 0, 0, 0, T);
    // intake grille on top
    put('shell', new THREE.CylinderGeometry(0.03, 0.03, 0.006, 10), 0, 0.2, 0, 0, 0, 0, T);
    // stabiliser fin on the outside
    const fin = new THREE.Shape();
    fin.moveTo(0, 0.07); fin.lineTo(0.045 * s, 0.0); fin.lineTo(0.05 * s, -0.07); fin.lineTo(0, -0.085); fin.lineTo(0, 0.07);
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
    put('accent', fg, s * 0.056, -0.01, -0.004, 0, 0, 0, T);
    // glowing heat ring inside the nozzle
    put('glow', new THREE.TorusGeometry(0.045, 0.004, 3, 12), 0, -0.17, 0, Math.PI / 2, 0, 0, T);
  }
  const merged = {};
  for (const [k, list] of Object.entries(parts)) merged[k] = mergeGeometries(list);
  return merged;
}

let CACHE = null;
function cache() {
  if (CACHE) return CACHE;
  const geo = buildParts();
  const mats = {
    shell: new THREE.MeshStandardMaterial({ color: 0x272b36, metalness: 0.65, roughness: 0.42 }),
    armor: new THREE.MeshStandardMaterial({ color: 0xe9ebf2, metalness: 0.25, roughness: 0.32 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa0ad, metalness: 0.95, roughness: 0.26 }),
    accent: new THREE.MeshStandardMaterial({ color: 0xff7a1c, metalness: 0.3, roughness: 0.38, emissive: 0x401400, emissiveIntensity: 0.6 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x5ff6ff, toneMapped: false }),
  };
  const flameOuter = new THREE.MeshBasicMaterial({
    map: gradientTex([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,214,120,0.95)'], [0.55, 'rgba(255,110,40,0.55)'], [1, 'rgba(255,60,20,0)']]),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const flameCore = new THREE.MeshBasicMaterial({
    map: gradientTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(190,240,255,0.9)'], [1, 'rgba(120,200,255,0)']]),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const glowSprite = new THREE.SpriteMaterial({ map: radialTex('rgba(255,240,200,1)', 'rgba(255,140,50,0.55)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  const outerGeo = new THREE.ConeGeometry(0.056, 0.62, 12, 1, true); outerGeo.rotateX(Math.PI); outerGeo.translate(0, -0.31, 0);
  const coreGeo = new THREE.ConeGeometry(0.03, 0.3, 10, 1, true); coreGeo.rotateX(Math.PI); coreGeo.translate(0, -0.15, 0);
  // nozzle exits in pack space
  const exits = [-1, 1].map(s => new THREE.Vector3(0, -0.205, 0).applyMatrix4(thrusterMatrix(s)));
  CACHE = { geo, mats, flameOuter, flameCore, glowSprite, outerGeo, coreGeo, exits };
  return CACHE;
}

/** A new jetpack group. userData.flames holds the two exhaust plumes (hidden until thrusting). */
export function makeJetpack() {
  const C = cache();
  const g = new THREE.Group();
  for (const k of ['shell', 'armor', 'metal', 'accent', 'glow']) {
    const m = new THREE.Mesh(C.geo[k], C.mats[k]);
    m.castShadow = k !== 'glow';
    g.add(m);
  }
  g.userData.flames = [];
  for (let i = 0; i < 2; i++) {
    const fl = new THREE.Group();
    fl.position.copy(C.exits[i]);
    fl.rotation.z = (i === 0 ? -1 : 1) * SPLAY;
    const outer = new THREE.Mesh(C.outerGeo, C.flameOuter); outer.renderOrder = 8;
    const core = new THREE.Mesh(C.coreGeo, C.flameCore); core.renderOrder = 9;
    const glow = new THREE.Sprite(C.glowSprite); glow.scale.setScalar(0.24); glow.position.y = -0.03; glow.renderOrder = 9;
    fl.add(outer, core, glow);
    fl.visible = false;
    g.add(fl); g.userData.flames.push(fl);
  }
  return g;
}
