// OVERCHARGE jetpack (v3): a chunky cartoon rocket pack.
// Two silver rocket thrusters with painted flame decals, LED fuel gauges and dark bell nozzles, a gunmetal
// core with a big round hatch (ribbed centre plate, ring of chasing lights), two red gas tanks on top under
// a gunmetal valve cap, and black hoses looping from the thruster tops to the tanks.
// Static parts are merged per material; only the light ring, the gauges and the exhaust are separate.
// Pack space: +Z points into the wearer's back, -Z faces away (the hatch side), +Y up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TX = 0.168, TZ = -0.075;            // thruster centres
const HATCH_Y = 0.015, HATCH_Z = -0.128;  // round hatch centre

function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

// brushed silver with a little grime (lines run round the cylinder)
function brushedInto(x, w, h, base) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 1100; i++) { const y = Math.random() * h, a = Math.random() * 0.07; x.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; x.fillRect(0, y, w, 1); }
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(40,34,30,${rnd(0.03, 0.09)})`; x.beginPath(); x.ellipse(rnd(0, w), rnd(0, h), rnd(4, 18), rnd(2, 8), 0, 0, Math.PI * 2); x.fill(); }
}
const silver = () => canvas(256, 256, (x, w, h) => brushedInto(x, w, h, '#b8bec7'));

// thruster skin: silver, panel seams, and flame decals licking up the back half from the bottom
const thrusterSkin = () => canvas(256, 256, (x, w, h) => {
  brushedInto(x, w, h, '#bcc2ca');
  // soot towards the nozzle
  const sg = x.createLinearGradient(0, h, 0, h * 0.55); sg.addColorStop(0, 'rgba(30,26,24,0.45)'); sg.addColorStop(1, 'rgba(30,26,24,0)');
  x.fillStyle = sg; x.fillRect(0, h * 0.55, w, h * 0.45);
  // seams
  x.fillStyle = 'rgba(25,28,34,0.55)'; for (const y of [0.16, 0.5]) x.fillRect(0, h * y, w, 2);
  const tongues = [[0.3, 0.42, 0.075], [0.38, 0.6, 0.085], [0.46, 0.5, 0.08], [0.54, 0.66, 0.09], [0.62, 0.48, 0.08], [0.7, 0.58, 0.075]];
  const path = (cx, ht, wd, k) => {
    const base = h + 4, W = wd * w * k, H = ht * h * k, X = cx * w;
    x.beginPath(); x.moveTo(X - W / 2, base);
    x.bezierCurveTo(X - W * 0.75, base - H * 0.45, X - W * 0.1, base - H * 0.62, X + W * 0.18, base - H);
    x.bezierCurveTo(X + W * 0.06, base - H * 0.62, X + W * 0.7, base - H * 0.42, X + W / 2, base);
    x.closePath();
  };
  for (const [cx, ht, wd] of tongues) { path(cx, ht, wd, 1.08); x.fillStyle = '#5a1608'; x.fill(); }
  for (const [cx, ht, wd] of tongues) {
    path(cx, ht, wd, 1);
    const g = x.createLinearGradient(0, h, 0, h - ht * h); g.addColorStop(0, '#e2420e'); g.addColorStop(0.55, '#ff8a1c'); g.addColorStop(1, '#ffc63a');
    x.fillStyle = g; x.fill();
  }
  for (const [cx, ht, wd] of tongues) { path(cx, ht * 0.62, wd * 0.5, 1); x.fillStyle = '#ffe45c'; x.fill(); }
});

const gunmetal = () => canvas(128, 128, (x, w, h) => brushedInto(x, w, h, '#4a505a'));
// ribbed centre plate of the hatch
const grille = () => canvas(128, 128, (x, w, h) => {
  x.fillStyle = '#6c727c'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 11; i++) {
    const X = 18 + i * 8.6;
    x.fillStyle = '#9aa0aa'; x.fillRect(X, 22, 4, 84);
    x.fillStyle = '#3a3f47'; x.fillRect(X + 4, 22, 2.5, 84);
  }
  x.strokeStyle = '#2b2f36'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#2b2f36'; x.fillRect(14, 60, 100, 8);
  x.fillStyle = '#8e949e'; x.fillRect(14, 60, 100, 2);
});
const hazard = () => canvas(64, 32, (x, w, h) => {
  x.fillStyle = '#c86a1c'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#1b1c20'; for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 10, h); x.lineTo(i * 10 + 5, h); x.lineTo(i * 10 + 5 + h, 0); x.lineTo(i * 10 + h, 0); x.fill(); }
  x.fillStyle = '#e8d9b0'; x.fillRect(18, 9, 28, 14); x.fillStyle = '#1b1c20'; x.fillRect(21, 13, 22, 2); x.fillRect(21, 17, 15, 2);
});
// ring of lights round the hatch: one bright "comet" that chases round when the ring spins
const lightRing = () => canvas(256, 256, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2 + 0.05, a1 = ((i + 1) / N) * Math.PI * 2 - 0.05;
    const b = Math.pow(i / (N - 1), 2.2);
    const c = (lo, hi) => Math.round(lo + (hi - lo) * b);
    x.strokeStyle = `rgb(${c(70, 244)},${c(78, 255)},${c(88, 252)})`;
    x.lineWidth = 16; x.beginPath(); x.arc(128, 128, 118, a0, a1); x.stroke();
  }
});

/** Lathe from a top-to-bottom profile (reversed here: three.js faces point outward only for profiles that run
 *  upward); v is mapped by height so a decal painted on the canvas lands where it is drawn. */
function lathe(points, seg, yMin, yMax) {
  const g = new THREE.LatheGeometry(points.slice().reverse().map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const p = g.attributes.position, uv = g.attributes.uv;
  if (yMax !== undefined) for (let i = 0; i < p.count; i++) uv.setY(i, (p.getY(i) - yMin) / (yMax - yMin));
  return g;
}

function buildParts() {
  const parts = { silver: [], skin: [], gun: [], dark: [], red: [], rubber: [], hazard: [], grille: [], strap: [] };
  const put = (key, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    parts[key].push(geo.index ? geo.toNonIndexed() : geo);
  };
  // ---- core: gunmetal body the thrusters bolt onto
  put('gun', new RoundedBoxGeometry(0.21, 0.36, 0.085, 1, 0.022), 0, 0.015, -0.062);
  for (const s of [-1, 1]) for (const y of [0.13, -0.1]) put('gun', new RoundedBoxGeometry(0.075, 0.034, 0.05, 1, 0.01), s * 0.11, y, TZ);
  // ---- round hatch
  put('silver', new THREE.CylinderGeometry(0.112, 0.116, 0.04, 28), 0, HATCH_Y, HATCH_Z + 0.008, Math.PI / 2);
  put('gun', new THREE.TorusGeometry(0.11, 0.007, 4, 28), 0, HATCH_Y, HATCH_Z - 0.012);
  put('grille', new THREE.CylinderGeometry(0.066, 0.07, 0.016, 24), 0, HATCH_Y, HATCH_Z - 0.016, -Math.PI / 2);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.26; put('gun', new THREE.CylinderGeometry(0.006, 0.006, 0.008, 6), Math.cos(a) * 0.075, HATCH_Y + Math.sin(a) * 0.075, HATCH_Z - 0.013, Math.PI / 2); }
  // little orange box under the hatch
  put('hazard', new RoundedBoxGeometry(0.075, 0.042, 0.045, 1, 0.008), 0, -0.165, -0.1);
  // ---- red gas tanks under a gunmetal valve cap
  for (const s of [-1, 1]) {
    put('red', new THREE.SphereGeometry(0.052, 14, 8), s * 0.058, 0.235, -0.07, 0, 0, 0, 1, 0.86, 0.95);
    put('gun', new THREE.CylinderGeometry(0.011, 0.013, 0.022, 8), s * 0.07, 0.282, -0.072);
    put('silver', new THREE.CylinderGeometry(0.015, 0.015, 0.006, 8), s * 0.07, 0.295, -0.072);
  }
  put('gun', new THREE.CylinderGeometry(0.042, 0.046, 0.06, 18), 0, 0.24, -0.06);
  put('gun', new THREE.SphereGeometry(0.042, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.27, -0.06);
  put('dark', new THREE.CylinderGeometry(0.047, 0.047, 0.01, 18), 0, 0.215, -0.06);
  // ---- thrusters
  const yTop = 0.182, yBot = -0.13;
  const cap = [[0.0, 0.222], [0.03, 0.219], [0.05, 0.208], [0.062, 0.194], [0.066, 0.182]];
  const body = [[0.066, 0.182], [0.07, 0.165], [0.071, 0.1], [0.071, -0.07], [0.068, -0.112], [0.062, -0.13]];
  const collar = [[0.062, -0.13], [0.067, -0.134], [0.067, -0.152], [0.056, -0.158]];
  const nozzle = [[0.042, -0.156], [0.046, -0.172], [0.058, -0.2], [0.066, -0.222], [0.06, -0.226], [0.05, -0.206], [0.034, -0.182], [0.0, -0.176]];
  for (const s of [-1, 1]) {
    const x = s * TX;
    put('gun', lathe(cap, 20), x, 0, TZ);
    put('skin', lathe(body, 22, yBot, yTop), x, 0, TZ);
    put('gun', lathe(collar, 20), x, 0, TZ);
    put('dark', lathe(nozzle, 18), x, 0, TZ);
    put('dark', new THREE.TorusGeometry(0.0712, 0.0035, 3, 22), x, 0.05, TZ, Math.PI / 2);
    // dark label plate low on the back
    const a = Math.PI - s * 0.3;
    put('dark', new THREE.BoxGeometry(0.05, 0.03, 0.008), x + Math.sin(a) * 0.071, -0.075, TZ + Math.cos(a) * 0.071, 0, a, 0);
    // gauge bezel (the lit segments are a separate live mesh)
    const g = Math.PI - s * 0.78;
    put('gun', new THREE.BoxGeometry(0.03, 0.19, 0.008), x + Math.sin(g) * 0.069, 0.045, TZ + Math.cos(g) * 0.069, 0, g, 0);
    // hose looping from the thruster top to the tanks
    const hose = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + s * 0.012, 0.212, TZ - 0.012), new THREE.Vector3(x + s * 0.03, 0.275, TZ - 0.008),
      new THREE.Vector3(x - s * 0.01, 0.325, TZ + 0.005), new THREE.Vector3(s * 0.1, 0.31, -0.06), new THREE.Vector3(s * 0.085, 0.262, -0.07),
    ]);
    put('rubber', new THREE.TubeGeometry(hose, 14, 0.0115, 6, false));
    put('gun', new THREE.CylinderGeometry(0.016, 0.016, 0.018, 8), x + s * 0.012, 0.212, TZ - 0.012);
    // harness: shoulder straps and waist belt stubs
    const strap = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.075, 0.19, -0.02), new THREE.Vector3(s * 0.085, 0.25, 0.03), new THREE.Vector3(s * 0.093, 0.255, 0.1), new THREE.Vector3(s * 0.1, 0.22, 0.15)]);
    put('strap', new THREE.TubeGeometry(strap, 6, 0.013, 4, false));
    put('strap', new RoundedBoxGeometry(0.07, 0.035, 0.03, 1, 0.008), s * 0.12, -0.19, -0.02);
  }
  const merged = {};
  for (const [k, list] of Object.entries(parts)) if (list.length) merged[k] = mergeGeometries(list);
  return merged;
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

let CACHE = null;
function cache() {
  if (CACHE) return CACHE;
  const geo = buildParts();
  const mats = {
    silver: new THREE.MeshStandardMaterial({ map: silver(), metalness: 0.85, roughness: 0.36 }),
    skin: new THREE.MeshStandardMaterial({ map: thrusterSkin(), metalness: 0.75, roughness: 0.38 }),
    gun: new THREE.MeshStandardMaterial({ map: gunmetal(), metalness: 0.8, roughness: 0.42 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x232a36, metalness: 0.7, roughness: 0.38 }),
    red: new THREE.MeshStandardMaterial({ color: 0xd4232c, metalness: 0.25, roughness: 0.28 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141518, metalness: 0.1, roughness: 0.55 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazard(), metalness: 0.3, roughness: 0.55 }),
    grille: new THREE.MeshStandardMaterial({ map: grille(), metalness: 0.75, roughness: 0.4 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x17191e, roughness: 0.9, metalness: 0 }),
  };
  const ringGeo = new THREE.RingGeometry(0.084, 0.1, 44, 1); ringGeo.rotateY(Math.PI);
  const ringMat = new THREE.MeshBasicMaterial({ map: lightRing(), alphaTest: 0.5, toneMapped: false, side: THREE.DoubleSide });
  const gaugeGeo = new THREE.PlaneGeometry(0.02, 0.17);
  const additive = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const flameOuter = additive(gradientTex([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,214,120,0.95)'], [0.55, 'rgba(255,110,40,0.5)'], [1, 'rgba(255,60,20,0)']]));
  const flameCore = additive(gradientTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,240,170,0.9)'], [1, 'rgba(255,200,90,0)']]));
  const diamond = new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glowSprite = new THREE.SpriteMaterial({ map: radialTex('rgba(255,240,200,1)', 'rgba(255,140,50,0.55)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  const outerGeo = new THREE.ConeGeometry(0.06, 0.66, 14, 1, true); outerGeo.rotateX(Math.PI); outerGeo.translate(0, -0.33, 0);
  const coreGeo = new THREE.ConeGeometry(0.032, 0.32, 10, 1, true); coreGeo.rotateX(Math.PI); coreGeo.translate(0, -0.16, 0);
  const diamondGeo = new THREE.SphereGeometry(0.025, 8, 6); diamondGeo.scale(1, 1.6, 1);
  const exits = [-1, 1].map(s => new THREE.Vector3(s * TX, -0.222, TZ));
  CACHE = { geo, mats, ringGeo, ringMat, gaugeGeo, flameOuter, flameCore, diamond, glowSprite, outerGeo, coreGeo, diamondGeo, exits };
  return CACHE;
}

/** LED fuel gauge (shared by both thrusters of one pack). */
function gaugeTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 160;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const N = 10;
  const draw = (pct) => {
    const x = c.getContext('2d');
    x.fillStyle = '#101317'; x.fillRect(0, 0, 32, 160);
    const lit = Math.ceil(pct / 100 * N - 0.001), low = pct < 25;
    for (let i = 0; i < N; i++) {
      const y = 160 - 6 - (i + 1) * 15 + 2;
      x.fillStyle = i < lit ? (low ? '#ff5446' : i >= N - 2 ? '#f4fff8' : '#b9ffd9') : '#26302d';
      x.fillRect(5, y, 22, 11);
    }
    t.needsUpdate = true;
  };
  draw(100);
  return { tex: t, draw };
}

/** A new jetpack group. userData.flames: exhaust plumes (hidden until thrusting); userData.setFuel(pct); userData.spin(dt, thrusting); userData.setDetail(near). */
export function makeJetpack() {
  const C = cache();
  const g = new THREE.Group();
  for (const [k, geo] of Object.entries(C.geo)) {
    const m = new THREE.Mesh(geo, C.mats[k]);
    m.userData.part = k;
    m.castShadow = true;
    g.add(m);
  }
  // chasing light ring round the hatch
  const ring = new THREE.Mesh(C.ringGeo, C.ringMat);
  ring.position.set(0, HATCH_Y, HATCH_Z - 0.0135); g.add(ring);
  // LED fuel gauges on the thrusters
  const gt = gaugeTexture();
  const gaugeMat = new THREE.MeshBasicMaterial({ map: gt.tex, toneMapped: false });
  const gauges = [-1, 1].map(s => {
    const a = Math.PI - s * 0.78;
    const m = new THREE.Mesh(C.gaugeGeo, gaugeMat);
    m.position.set(s * TX + Math.sin(a) * 0.0738, 0.045, TZ + Math.cos(a) * 0.0738); m.rotation.y = a;
    g.add(m); return m;
  });
  let shown = 100;
  g.userData.setFuel = (pct) => { const p = Math.max(0, Math.min(100, Math.round(pct / 5) * 5)); if (p !== shown) { shown = p; gt.draw(p); } };
  g.userData.spin = (dt, thrusting) => { ring.rotation.z -= dt * (thrusting ? 11 : 1.6); };
  const fine = g.children.filter(m => m.isMesh && ['rubber', 'hazard', 'strap', 'grille'].includes(m.userData.part)).concat([ring], gauges);
  g.userData.setDetail = (near) => { for (const m of fine) m.visible = near; };
  // exhaust
  g.userData.flames = [];
  for (let i = 0; i < 2; i++) {
    const fl = new THREE.Group();
    fl.position.copy(C.exits[i]);
    const outer = new THREE.Mesh(C.outerGeo, C.flameOuter); outer.renderOrder = 8;
    const core = new THREE.Mesh(C.coreGeo, C.flameCore); core.renderOrder = 9;
    fl.add(outer, core);
    for (let k = 0; k < 3; k++) { const d = new THREE.Mesh(C.diamondGeo, C.diamond); d.position.y = -0.09 - k * 0.11; d.scale.setScalar(1 - k * 0.22); d.renderOrder = 9; fl.add(d); }
    const glow = new THREE.Sprite(C.glowSprite); glow.scale.setScalar(0.28); glow.position.y = -0.03; glow.renderOrder = 9;
    fl.add(glow);
    fl.visible = false;
    g.add(fl); g.userData.flames.push(fl);
  }
  return g;
}
