// OVERCHARGE jetpack (v2): a realistic twin-turbine jet pack.
// Carbon-fibre backplate on aluminium rails, a brushed-aluminium fuel tank, two turbojets with spinning
// compressor fans, heat-blued titanium nozzles, braided fuel hoses, a control box with a live fuel read-out
// and a harness. Static parts are merged per material; only the fans, read-out and exhaust are separate.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const ENG_X = 0.158, ENG_Z = -0.1, SPLAY = 0.06;

function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const brushed = (base) => canvas(256, 256, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { const y = Math.random() * h, a = Math.random() * 0.08; x.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; x.fillRect(0, y, w, 1); }
});
const heatTint = () => canvas(16, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#c9ccd2'); g.addColorStop(0.3, '#c9b27a'); g.addColorStop(0.5, '#a46a3c'); g.addColorStop(0.68, '#6a3f8a'); g.addColorStop(0.85, '#2f5fae'); g.addColorStop(1, '#8aa8c8');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
const carbon = () => canvas(128, 128, (x, w, h) => {
  x.fillStyle = '#16181d'; x.fillRect(0, 0, w, h);
  for (let j = 0; j < h; j += 8) for (let i = 0; i < w; i += 8) { const k = ((i + j) / 8) % 2; x.fillStyle = k ? '#2a2e37' : '#1d2027'; x.fillRect(i, j, 8, 4); x.fillStyle = k ? '#1d2027' : '#2a2e37'; x.fillRect(i, j + 4, 8, 4); }
});
const hazard = () => canvas(64, 16, (x, w, h) => { x.fillStyle = '#f2b81c'; x.fillRect(0, 0, w, h); x.fillStyle = '#16181d'; for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 8, h); x.lineTo(i * 8 + 4, h); x.lineTo(i * 8 + 4 + h, 0); x.lineTo(i * 8 + h, 0); x.fill(); } });
const braid = () => canvas(32, 32, (x, w, h) => { x.fillStyle = '#5a5f6a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c7ccd6'; x.lineWidth = 2; for (let i = -32; i < 64; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, h); x.stroke(); x.beginPath(); x.moveTo(i + 32, 0); x.lineTo(i, h); x.stroke(); } });

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

/** Engine frame in pack space (engines splay out a little at the bottom). */
function engineMatrix(side) {
  return new THREE.Matrix4().compose(new THREE.Vector3(side * ENG_X, 0.0, ENG_Z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0, side * SPLAY)), new THREE.Vector3(1, 1, 1));
}

function buildParts() {
  const parts = { carbon: [], alu: [], ti: [], heat: [], dark: [], red: [], hazard: [], hose: [], strap: [], glow: [] };
  const put = (key, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = null, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    if (parent) m.premultiply(parent);
    geo.applyMatrix4(m);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    parts[key].push(geo.index ? geo.toNonIndexed() : geo);
  };
  // backplate (carbon) on two aluminium rails, with a moulded lumbar pad
  const bp = new THREE.Shape(); const W = 0.15, H = 0.21, r = 0.04;
  bp.moveTo(-W + r, -H); bp.lineTo(W - r, -H); bp.quadraticCurveTo(W, -H, W, -H + r); bp.lineTo(W, H - r); bp.quadraticCurveTo(W, H, W - r, H); bp.lineTo(-W + r, H); bp.quadraticCurveTo(-W, H, -W, H - r); bp.lineTo(-W, -H + r); bp.quadraticCurveTo(-W, -H, -W + r, -H);
  const plate = new THREE.ExtrudeGeometry(bp, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 3 });
  const pos = plate.attributes.position, uv = plate.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 6, pos.getY(i) * 6);
  put('carbon', plate, 0, 0, -0.03);
  for (const s of [-1, 1]) {
    put('alu', new RoundedBoxGeometry(0.026, 0.42, 0.022, 1, 0.006), s * 0.105, 0, -0.05);
    for (const y of [0.13, -0.11]) put('alu', new RoundedBoxGeometry(0.07, 0.022, 0.03, 1, 0.006), s * 0.13, y, -0.07, 0, 0, s * SPLAY * 0.5);
    put('glow', new THREE.BoxGeometry(0.008, 0.16, 0.004), s * 0.105, 0.0, -0.062);
  }
  // fuel tank: brushed aluminium with a red band, end caps and a valve
  put('alu', new THREE.CapsuleGeometry(0.068, 0.2, 4, 14), 0, 0.01, -0.09);
  put('red', new THREE.CylinderGeometry(0.0695, 0.0695, 0.05, 18, 1, true), 0, 0.06, -0.09);
  put('dark', new THREE.CylinderGeometry(0.07, 0.07, 0.012, 18, 1, true), 0, -0.04, -0.09);
  put('dark', new THREE.CylinderGeometry(0.018, 0.022, 0.04, 10), 0, 0.2, -0.09);
  put('red', new THREE.TorusGeometry(0.022, 0.007, 5, 12), 0, 0.225, -0.09, Math.PI / 2);
  // control box with the read-out (the read-out itself is a separate live mesh)
  put('dark', new RoundedBoxGeometry(0.13, 0.06, 0.06, 1, 0.012), 0, 0.245, -0.055);
  put('alu', new THREE.CylinderGeometry(0.004, 0.004, 0.12, 5), 0.045, 0.32, -0.04);
  put('glow', new THREE.SphereGeometry(0.007, 6, 4), 0.045, 0.385, -0.04);
  // harness straps over the shoulders and a waist belt stub
  for (const s of [-1, 1]) {
    const strap = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.08, 0.2, -0.015), new THREE.Vector3(s * 0.088, 0.25, 0.03), new THREE.Vector3(s * 0.095, 0.255, 0.1), new THREE.Vector3(s * 0.1, 0.22, 0.15)]);
    put('strap', new THREE.TubeGeometry(strap, 6, 0.013, 4, false), 0, 0, 0, 0, 0, 0, null, 1, 1, 1);
    put('alu', new RoundedBoxGeometry(0.035, 0.022, 0.012, 1, 0.004), s * 0.09, 0.235, 0.035);
    put('strap', new RoundedBoxGeometry(0.07, 0.035, 0.03, 1, 0.008), s * 0.13, -0.2, -0.015);
  }
  // turbojets
  const body = [[0.05, 0.215], [0.062, 0.208], [0.066, 0.194], [0.06, 0.182], [0.063, 0.17], [0.066, 0.1], [0.067, 0.0], [0.064, -0.08], [0.058, -0.115]].map(([a, b]) => new THREE.Vector2(a, b));
  const nozzle = [[0.058, -0.115], [0.052, -0.14], [0.047, -0.17], [0.05, -0.2], [0.046, -0.212], [0.039, -0.205], [0.032, -0.18], [0.0, -0.17]].map(([a, b]) => new THREE.Vector2(a, b));
  const lip = [[0.044, 0.2], [0.05, 0.218], [0.062, 0.212], [0.066, 0.196]].map(([a, b]) => new THREE.Vector2(a, b));
  for (const s of [-1, 1]) {
    const T = engineMatrix(s);
    put('ti', new THREE.LatheGeometry(body, 16), 0, 0, 0, 0, 0, 0, T);
    put('alu', new THREE.LatheGeometry(lip, 16), 0, 0, 0, 0, 0, 0, T);
    const nz = new THREE.LatheGeometry(nozzle, 16);
    const np = nz.attributes.position, nu = nz.attributes.uv; for (let i = 0; i < np.count; i++) nu.setXY(i, nu.getX(i), 1 - (np.getY(i) + 0.115) / -0.1);
    put('heat', nz, 0, 0, 0, 0, 0, 0, T);
    for (const y of [0.13, 0.035, -0.06]) put('dark', new THREE.TorusGeometry(0.0665, 0.004, 3, 16), 0, y, 0, Math.PI / 2, 0, 0, T);
    put('hazard', new THREE.CylinderGeometry(0.0672, 0.0672, 0.022, 16, 1, true), 0, 0.075, 0, 0, 0, 0, T);
    put('dark', new THREE.CylinderGeometry(0.045, 0.045, 0.004, 18), 0, 0.172, 0, 0, 0, 0, T);   // intake floor
    put('glow', new THREE.TorusGeometry(0.036, 0.003, 3, 14), 0, -0.172, 0, Math.PI / 2, 0, 0, T);
    // braided hose from the tank to the engine
    const e = new THREE.Vector3(-s * 0.05, -0.04, 0.02).applyMatrix4(T);
    const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.02, -0.17, -0.09), new THREE.Vector3(s * 0.05, -0.2, -0.11), new THREE.Vector3(s * 0.09, -0.15, -0.12), e]);
    put('hose', new THREE.TubeGeometry(hose, 10, 0.011, 5, false));
  }
  const merged = {};
  for (const [k, list] of Object.entries(parts)) if (list.length) merged[k] = mergeGeometries(list);
  return merged;
}

let CACHE = null;
function cache() {
  if (CACHE) return CACHE;
  const geo = buildParts();
  const carbonT = carbon(); carbonT.repeat.set(1, 1);
  const mats = {
    carbon: new THREE.MeshStandardMaterial({ map: carbonT, color: 0xffffff, metalness: 0.35, roughness: 0.32 }),
    alu: new THREE.MeshStandardMaterial({ map: brushed('#c9ced6'), metalness: 0.92, roughness: 0.3 }),
    ti: new THREE.MeshStandardMaterial({ map: brushed('#8d939e'), metalness: 0.95, roughness: 0.34 }),
    heat: new THREE.MeshStandardMaterial({ map: heatTint(), metalness: 0.95, roughness: 0.28 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1d2028, metalness: 0.65, roughness: 0.42 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc8202a, metalness: 0.4, roughness: 0.35 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazard(), metalness: 0.3, roughness: 0.5 }),
    hose: new THREE.MeshStandardMaterial({ map: braid(), metalness: 0.8, roughness: 0.38 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.9, metalness: 0 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x5ff6ff, toneMapped: false }),
  };
  mats.hazard.map.repeat.set(5, 1);
  const additive = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const flameOuter = additive(gradientTex([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,214,120,0.95)'], [0.55, 'rgba(255,110,40,0.5)'], [1, 'rgba(255,60,20,0)']]));
  const flameCore = additive(gradientTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(190,230,255,0.9)'], [1, 'rgba(120,200,255,0)']]));
  const diamond = new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glowSprite = new THREE.SpriteMaterial({ map: radialTex('rgba(255,240,200,1)', 'rgba(255,140,50,0.55)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  const outerGeo = new THREE.ConeGeometry(0.05, 0.62, 14, 1, true); outerGeo.rotateX(Math.PI); outerGeo.translate(0, -0.31, 0);
  const coreGeo = new THREE.ConeGeometry(0.026, 0.3, 10, 1, true); coreGeo.rotateX(Math.PI); coreGeo.translate(0, -0.15, 0);
  const diamondGeo = new THREE.SphereGeometry(0.022, 8, 6); diamondGeo.scale(1, 1.6, 1);
  // compressor fan: spinner + blades (one mesh, spun per engine)
  const fanParts = [];
  const sp = new THREE.ConeGeometry(0.016, 0.03, 12); sp.translate(0, 0.012, 0); fanParts.push(sp.toNonIndexed());
  for (let k = 0; k < 12; k++) { const b = new THREE.BoxGeometry(0.036, 0.003, 0.012); b.translate(0.026, 0, 0); b.rotateX(0.5); b.rotateY(k / 12 * Math.PI * 2); fanParts.push(b.toNonIndexed()); }
  for (const g of fanParts) { for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); }
  const fanGeo = mergeGeometries(fanParts);
  const fanMat = new THREE.MeshStandardMaterial({ color: 0xb8bec9, metalness: 0.95, roughness: 0.25 });
  // live fuel read-out
  const readGeo = new THREE.PlaneGeometry(0.09, 0.034);
  const exits = [-1, 1].map(s => new THREE.Vector3(0, -0.205, 0).applyMatrix4(engineMatrix(s)));
  const intakes = [-1, 1].map(s => new THREE.Vector3(0, 0.178, 0).applyMatrix4(engineMatrix(s)));
  CACHE = { geo, mats, flameOuter, flameCore, diamond, glowSprite, outerGeo, coreGeo, diamondGeo, fanGeo, fanMat, readGeo, exits, intakes };
  return CACHE;
}

function readoutTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const draw = (pct) => {
    const x = c.getContext('2d');
    x.fillStyle = '#031208'; x.fillRect(0, 0, 128, 48);
    x.fillStyle = '#39ff7a'; x.font = 'bold 20px monospace'; x.textBaseline = 'middle';
    x.fillText('FUEL', 6, 16); x.fillText(String(Math.round(pct)).padStart(3, ' ') + '%', 62, 16);
    x.fillStyle = 'rgba(57,255,122,0.25)'; x.fillRect(6, 30, 116, 10);
    x.fillStyle = pct < 25 ? '#ff4040' : '#39ff7a'; x.fillRect(6, 30, 116 * pct / 100, 10);
    t.needsUpdate = true;
  };
  draw(100);
  return { tex: t, draw };
}

/** A new jetpack group. userData.flames: exhaust plumes (hidden until thrusting); userData.setFuel(pct); userData.spin(dt, thrusting). */
export function makeJetpack() {
  const C = cache();
  const g = new THREE.Group();
  for (const [k, geo] of Object.entries(C.geo)) {
    const m = new THREE.Mesh(geo, C.mats[k]);
    m.userData.part = k;
    m.castShadow = k !== 'glow';
    g.add(m);
  }
  // fans in the intakes
  const fans = C.intakes.map((p, i) => { const f = new THREE.Mesh(C.fanGeo, C.fanMat); f.position.copy(p); f.rotation.z = (i ? 1 : -1) * SPLAY; g.add(f); return f; });
  // read-out
  const ro = readoutTexture();
  const screen = new THREE.Mesh(C.readGeo, new THREE.MeshBasicMaterial({ map: ro.tex, toneMapped: false }));
  screen.position.set(0, 0.247, -0.0865); screen.rotation.y = Math.PI; g.add(screen);
  let shown = 100;
  g.userData.setFuel = (pct) => { const p = Math.max(0, Math.min(100, Math.round(pct))); if (p !== shown) { shown = p; ro.draw(p); } };
  g.userData.spin = (dt, thrusting) => { for (const f of fans) f.rotation.y += dt * (thrusting ? 70 : 9); };
  const fine = g.children.filter(m => m.isMesh && ['hose', 'hazard', 'red', 'strap'].includes(m.userData.part)).concat(fans, [screen]);
  g.userData.setDetail = (near) => { for (const m of fine) m.visible = near; };
  // exhaust
  g.userData.flames = [];
  for (let i = 0; i < 2; i++) {
    const fl = new THREE.Group();
    fl.position.copy(C.exits[i]);
    fl.rotation.z = (i === 0 ? -1 : 1) * SPLAY;
    const outer = new THREE.Mesh(C.outerGeo, C.flameOuter); outer.renderOrder = 8;
    const core = new THREE.Mesh(C.coreGeo, C.flameCore); core.renderOrder = 9;
    fl.add(outer, core);
    for (let k = 0; k < 3; k++) { const d = new THREE.Mesh(C.diamondGeo, C.diamond); d.position.y = -0.08 - k * 0.1; d.scale.setScalar(1 - k * 0.22); d.renderOrder = 9; fl.add(d); }
    const glow = new THREE.Sprite(C.glowSprite); glow.scale.setScalar(0.24); glow.position.y = -0.03; glow.renderOrder = 9;
    fl.add(glow);
    fl.visible = false;
    g.add(fl); g.userData.flames.push(fl);
  }
  return g;
}
