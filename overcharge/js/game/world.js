// REVERSAL COMPOUND — the map. Built procedurally from boxes/cylinders, merged per material
// and per chunk for few draw calls. Everything solid also registers a collider.
import * as THREE from 'three';
import { CollisionWorld } from './collision.js';
import { MAP_HALF } from '../config.js';

const CHUNKS = 3;
const CHUNK_SIZE = (MAP_HALF * 2) / CHUNKS;

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class World {
  constructor(textures, quality = 'medium') {
    this.T = textures;
    this.quality = quality;
    this.col = new CollisionWorld(MAP_HALF + 4, 8);
    this.group = new THREE.Group();
    this.buckets = new Map();
    this.mats = {};
    this.animated = [];       // {mesh, update(t)}
    this.lootSpots = [];      // {x,y,z}
    this.chestSpots = [];     // {x,y,z,rot}
    this.ammoSpots = [];      // {x,y,z}
    this.pois = [];           // {name,x,z,r}
    this.rng = seeded(1337);
    this.makeMaterials();
  }

  // ---------------------------------------------------------------- materials
  makeMaterials() {
    const T = this.T, low = this.quality === 'low';
    const std = (o) => low
      ? new THREE.MeshLambertMaterial({ color: o.color, map: o.map || null, transparent: !!o.transparent, side: o.side || THREE.FrontSide })
      : new THREE.MeshStandardMaterial({ color: o.color, map: o.map || null, roughness: o.roughness ?? 0.9, metalness: o.metalness ?? 0, transparent: !!o.transparent, side: o.side || THREE.FrontSide });
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
    const M = (key, mat, uv = 'world', scale = 4, shadow = true) => { this.mats[key] = { mat, uv, scale, shadow }; };

    M('floor', std({ color: 0xb4b0e2, map: T.tiles, roughness: 0.95 }), 'world', 8);
    M('concrete', std({ color: 0x8a85c2, map: T.concrete }), 'world', 4);
    M('dark', std({ color: 0x625ca0, map: T.concrete }), 'world', 4);
    M('darker', std({ color: 0x48437c, map: T.concrete }), 'world', 4);
    M('block', std({ color: 0xe4e1ff, map: T.concrete }), 'world', 3);
    M('slats', std({ color: 0x5d5a8c, map: T.slats, roughness: 0.7, metalness: 0.15 }), 'world', 2);
    M('plate', std({ color: 0x86aab0, map: T.plate, roughness: 0.45, metalness: 0.55 }), 'world', 1.6);
    M('platePurple', std({ color: 0x8a72d8, map: T.plate, roughness: 0.45, metalness: 0.5 }), 'world', 1.6);
    M('teal', std({ color: 0x74c2ba, map: T.concrete }), 'world', 4);
    M('tealDark', std({ color: 0x3c7f80, map: T.concrete }), 'world', 4);
    M('crate', std({ color: 0xcfc6ea, map: T.crate, roughness: 0.85 }), 'unit', 1);
    M('contA', std({ color: 0x8e5a9e, map: T.container, roughness: 0.6, metalness: 0.3 }), 'world', 3);
    M('contB', std({ color: 0x4f8f9e, map: T.container, roughness: 0.6, metalness: 0.3 }), 'world', 3);
    M('contC', std({ color: 0x5b5f8e, map: T.container, roughness: 0.6, metalness: 0.3 }), 'world', 3);
    M('metal', std({ color: 0x3a3c52, roughness: 0.5, metalness: 0.6 }), 'world', 2);
    M('steel', std({ color: 0x9ea3c0, roughness: 0.35, metalness: 0.8 }), 'world', 2);
    M('hazard', std({ color: 0xffffff, map: T.hazard, roughness: 0.8 }), 'world', 1.2);
    M('padPurple', basic(0xa564ff), 'unit', 1, false);
    M('orange', basic(0xffb46b), 'unit', 1, false);
    M('cyan', basic(0x5ff4ff), 'unit', 1, false);
    M('white', basic(0xf2f0ff), 'unit', 1, false);
    M('pink', basic(0xff63d8), 'unit', 1, false);
    M('screen', basic(0xffffff, { map: T.screen }), 'unit', 1, false);
    M('core', basic(0x9a70e0), 'world', 4, false);
    M('sign', basic(0xffffff, { map: this.makeSignTexture(), transparent: true }), 'unit', 1, false);
    // transparent beam (additive)
    const beamTex = this.makeBeamTexture();
    M('beam', new THREE.MeshBasicMaterial({ map: beamTex, color: 0x7a48c8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), 'unit', 1, false);
    M('beamCyan', new THREE.MeshBasicMaterial({ map: beamTex, color: 0x2a9ab8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), 'unit', 1, false);
  }

  makeBeamTexture() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  makeSignTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(20,10,50,0.85)'; x.fillRect(0, 0, 1024, 256);
    x.strokeStyle = '#a564ff'; x.lineWidth = 10; x.strokeRect(10, 10, 1004, 236);
    x.font = 'bold 120px "Russo One", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#b780ff'; x.shadowBlur = 30;
    x.fillStyle = '#efe6ff'; x.fillText('REVERSAL', 512, 100);
    x.font = 'bold 64px "Russo One", Impact, sans-serif'; x.fillStyle = '#5ff4ff'; x.shadowColor = '#5ff4ff';
    x.fillText('C O M P O U N D', 512, 190);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }

  // ---------------------------------------------------------------- geometry buckets
  bucket(matKey, x, z) {
    const cx = Math.max(0, Math.min(CHUNKS - 1, Math.floor((x + MAP_HALF) / CHUNK_SIZE)));
    const cz = Math.max(0, Math.min(CHUNKS - 1, Math.floor((z + MAP_HALF) / CHUNK_SIZE)));
    const key = `${matKey}|${cx},${cz}`;
    let b = this.buckets.get(key);
    if (!b) { b = { matKey, pos: [], nor: [], uv: [], idx: [] }; this.buckets.set(key, b); }
    return b;
  }

  /** Push a box (centre cx,cy,cz). rot: optional THREE.Euler for decorative pieces. */
  pushBox(matKey, cx, cy, cz, w, h, d, rot = null) {
    const m = this.mats[matKey];
    const b = this.bucket(matKey, cx, cz);
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const faces = [
      // normal, corners (local), uv axes
      [[1, 0, 0], [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]], 'z', 'y', -1],
      [[-1, 0, 0], [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]], 'z', 'y', 1],
      [[0, 1, 0], [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]], 'x', 'z', 1],
      [[0, -1, 0], [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]], 'x', 'z', 1],
      [[0, 0, 1], [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]], 'x', 'y', 1],
      [[0, 0, -1], [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]], 'x', 'y', -1],
    ];
    const q = rot ? new THREE.Quaternion().setFromEuler(rot) : null;
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (const [nrm, corners, ua, va, flip] of faces) {
      const base = b.pos.length / 3;
      n.set(nrm[0], nrm[1], nrm[2]); if (q) n.applyQuaternion(q);
      corners.forEach((c, i) => {
        v.set(c[0], c[1], c[2]); if (q) v.applyQuaternion(q);
        b.pos.push(cx + v.x, cy + v.y, cz + v.z);
        b.nor.push(n.x, n.y, n.z);
        if (m.uv === 'unit') {
          b.uv.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0);
        } else {
          const wc = { x: (q ? c[0] : cx + c[0]), y: (q ? c[1] : cy + c[1]), z: (q ? c[2] : cz + c[2]) };
          b.uv.push((wc[ua] * flip) / m.scale, wc[va] / m.scale);
        }
      });
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  pushGeometry(matKey, geo, matrix, uvScaleU = 1, uvScaleV = 1) {
    const b = this.bucket(matKey, matrix.elements[12], matrix.elements[14]);
    const g = geo.index ? geo : geo;
    const p = g.attributes.position, nr = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const base = b.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      n.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize();
      b.pos.push(v.x, v.y, v.z); b.nor.push(n.x, n.y, n.z);
      b.uv.push(uv ? uv.getX(i) * uvScaleU : 0, uv ? uv.getY(i) * uvScaleV : 0);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) b.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) b.idx.push(base + i);
    geo.dispose();
  }

  // ---------------------------------------------------------------- primitives
  /** Solid box: x,z centre, y0 bottom. */
  box(x, y0, z, w, h, d, mat, opts = {}) {
    this.pushBox(mat, x, y0 + h / 2, z, w, h, d);
    if (!opts.noCol) this.col.addBox(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2, opts.tag || 0);
  }

  cyl(x, y0, z, r, h, mat, opts = {}) {
    const seg = opts.seg || 20;
    const geo = new THREE.CylinderGeometry(opts.rTop ?? r, r, h, seg, 1, !!opts.open);
    const m = new THREE.Matrix4().makeTranslation(x, y0 + h / 2, z);
    const sc = this.mats[mat].uv === 'world' ? this.mats[mat].scale : 1;
    this.pushGeometry(mat, geo, m, this.mats[mat].uv === 'world' ? (Math.PI * 2 * r) / sc : 1, this.mats[mat].uv === 'world' ? h / sc : 1);
    if (!opts.noCol) {
      const k = r * 0.86;
      this.col.addBox(x - k, y0, z - r * 0.5, x + k, y0 + h, z + r * 0.5);
      this.col.addBox(x - r * 0.5, y0, z - k, x + r * 0.5, y0 + h, z + k);
    }
  }

  /** Wall from (x1,z1) to (x2,z2) — must be axis aligned. gaps: [{at, w, h}] measured from start. */
  wall(x1, z1, x2, z2, h, t, mat, gaps = [], y0 = 0) {
    const alongX = Math.abs(z2 - z1) < 1e-6;
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const sx = Math.min(x1, x2), sz = Math.min(z1, z2);
    const segs = [];
    let cur = 0;
    const sorted = [...gaps].sort((a, b) => a.at - b.at);
    for (const g of sorted) {
      const a = g.at - g.w / 2, bnd = g.at + g.w / 2;
      if (a > cur) segs.push([cur, a, 0, h]);
      if (g.h < h) segs.push([a, bnd, g.h, h]);           // lintel
      if (g.sill) segs.push([a, bnd, 0, g.sill]);          // window sill
      cur = bnd;
    }
    if (cur < len) segs.push([cur, len, 0, h]);
    for (const [a, bnd, ya, yb] of segs) {
      const L = bnd - a; if (L <= 0.01) continue;
      if (alongX) this.box(sx + a + L / 2, y0 + ya, z1, L, yb - ya, t, mat);
      else this.box(x1, y0 + ya, sz + a + L / 2, t, yb - ya, L, mat);
    }
  }

  /** Stairs rising toward `dir` ('+x','-x','+z','-z'); x,z = centre of the footprint. */
  stairs(x, z, w, len, height, dir, mat = 'concrete') {
    const steps = Math.max(3, Math.round(height / 0.3));
    const along = dir[1];
    const sign = dir[0] === '+' ? 1 : -1;
    const stepLen = len / steps;
    for (let i = 0; i < steps; i++) {
      const hgt = (height * (i + 1)) / steps;
      const off = -len / 2 + stepLen * (i + 0.5);
      const px = along === 'x' ? x + off * sign : x, pz = along === 'z' ? z + off * sign : z;
      if (along === 'x') this.pushBox(mat, px, hgt / 2, pz, stepLen, hgt, w);
      else this.pushBox(mat, px, hgt / 2, pz, w, hgt, stepLen);
    }
    const minX = along === 'x' ? x - len / 2 : x - w / 2, maxX = along === 'x' ? x + len / 2 : x + w / 2;
    const minZ = along === 'z' ? z - len / 2 : z - w / 2, maxZ = along === 'z' ? z + len / 2 : z + w / 2;
    this.col.addRamp(minX, minZ, maxX, maxZ, along, sign > 0 ? 0 : height, sign > 0 ? height : 0);
  }

  railing(x1, z1, x2, z2, y0, h = 1.05) {
    const alongX = Math.abs(z2 - z1) < 1e-6;
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const sx = Math.min(x1, x2), sz = Math.min(z1, z2);
    const posts = Math.max(2, Math.ceil(len / 2.2) + 1);
    for (let i = 0; i < posts; i++) {
      const o = (len * i) / (posts - 1);
      if (alongX) this.pushBox('metal', sx + o, y0 + h / 2, z1, 0.08, h, 0.08);
      else this.pushBox('metal', x1, y0 + h / 2, sz + o, 0.08, h, 0.08);
    }
    for (const yy of [h, h * 0.55]) {
      if (alongX) this.pushBox('metal', sx + len / 2, y0 + yy, z1, len, 0.06, 0.06);
      else this.pushBox('metal', x1, y0 + yy, sz + len / 2, 0.06, 0.06, len);
    }
    if (alongX) this.col.addBox(sx, y0, z1 - 0.06, sx + len, y0 + h, z1 + 0.06);
    else this.col.addBox(x1 - 0.06, y0, sz, x1 + 0.06, y0 + h, sz + len);
  }

  crate(x, z, s = 1.6, y0 = 0) { this.box(x, y0, z, s, s, s, 'crate'); }
  crateStack(x, z, s = 1.6, count = 2) {
    this.crate(x, z, s);
    if (count >= 2) this.crate(x + s * 1.02, z, s);
    if (count >= 3) this.crate(x + s * 0.5, z, s * 0.95, s);
    if (count >= 4) this.crate(x, z + s * 1.02, s);
  }
  barrier(x, z, alongX = true) {
    if (alongX) { this.box(x, 0, z, 3.2, 0.35, 0.8, 'concrete'); this.box(x, 0.35, z, 3.2, 0.75, 0.4, 'concrete'); }
    else { this.box(x, 0, z, 0.8, 0.35, 3.2, 'concrete'); this.box(x, 0.35, z, 0.4, 0.75, 3.2, 'concrete'); }
  }
  /** Concrete wall with a blown-out hole (like the video's broken walls). */
  brokenWall(x, z, len, h, alongX, mat = 'dark') {
    const t = 0.7;
    const r = this.rng;
    const holeW = len * (0.32 + r() * 0.12), holeC = len * (0.4 + r() * 0.2);
    const a = holeC - holeW / 2, b = holeC + holeW / 2;
    const seg = (s0, s1, y0, y1) => {
      const L = s1 - s0, c = s0 + L / 2 - len / 2;
      if (alongX) this.box(x + c, y0, z, L, y1 - y0, t, mat); else this.box(x, y0, z + c, t, y1 - y0, L, mat);
    };
    seg(0, a, 0, h);
    seg(b, len, 0, h * (0.75 + r() * 0.25));
    const sill = h * (0.25 + r() * 0.15);
    seg(a, b, 0, sill);
    // jagged edges
    seg(a, a + 0.6, sill, h * 0.75); seg(b - 0.5, b, sill, h * 0.6);
    seg(a + 0.6, a + 1.2, sill, sill + 0.5);
  }
  kiosk(x, z, facing = 0) {
    // 5x4 hut with window slots, open on one side (facing: 0=+z,1=+x,2=-z,3=-x)
    const W = 5.2, D = 4.2, H = 3.1, t = 0.35;
    const mat = 'dark';
    const corners = [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]];
    corners.forEach(([cx, cz]) => this.box(x + cx, 0, z + cz, 0.5, H, 0.5, mat));
    this.box(x, H, z, W + 0.6, 0.35, D + 0.6, 'darker');
    const sides = [
      () => this.wall(x - W / 2, z + D / 2, x + W / 2, z + D / 2, H, t, mat, [{ at: W / 2, w: 3.4, h: H - 0.9, sill: 1.1 }]),
      () => this.wall(x + W / 2, z - D / 2, x + W / 2, z + D / 2, H, t, mat, [{ at: D / 2, w: 2.4, h: H - 0.9, sill: 1.1 }]),
      () => this.wall(x - W / 2, z - D / 2, x + W / 2, z - D / 2, H, t, mat, [{ at: W / 2, w: 3.4, h: H - 0.9, sill: 1.1 }]),
      () => this.wall(x - W / 2, z - D / 2, x - W / 2, z + D / 2, H, t, mat, [{ at: D / 2, w: 2.4, h: H - 0.9, sill: 1.1 }]),
    ];
    sides.forEach((fn, i) => { if (i !== facing) fn(); });
    this.lootSpots.push({ x, y: 0, z });
  }
  slab(x, z, rotY, tilt, w = 4, h = 3) {
    // decorative tilted concrete slab leaning on the ground
    const rot = new THREE.Euler(tilt, rotY, 0, 'YXZ');
    this.pushBox('dark', x, h * 0.5 * Math.cos(tilt) * 0.9, z, w, h, 0.35, rot);
    const ext = Math.max(w, 1.2) / 2;
    const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
    const ex = ext * c + 0.6 * s, ez = ext * s + 0.6 * c;
    this.col.addBox(x - ex, 0, z - ez, x + ex, h * Math.cos(tilt) * 0.85, z + ez);
  }
  lightBeam(x, z, y0, h, cyan = false, r = 0.7) {
    const geo = new THREE.CylinderGeometry(r * 0.6, r, h, 12, 1, true);
    this.pushGeometry(cyan ? 'beamCyan' : 'beam', geo, new THREE.Matrix4().makeTranslation(x, y0 + h / 2, z));
    this.cyl(x, y0, z, r * 1.3, 0.4, 'metal', { seg: 12 });
    this.cyl(x, y0 + 0.4, z, r * 0.9, 0.12, cyan ? 'cyan' : 'padPurple', { seg: 12, noCol: true });
  }
  monitor(x, z, rotY = 0, y0 = 0, big = false) {
    const W = big ? 3.2 : 1.7, H = big ? 1.9 : 1.05;
    this.box(x, y0, z, 0.18, 1.5, 0.18, 'metal');
    const rot = new THREE.Euler(-0.1, rotY, 0, 'YXZ');
    this.pushBox('metal', x, y0 + 1.5 + H / 2, z, W + 0.15, H + 0.15, 0.12, rot);
    const off = new THREE.Vector3(0, 0, 0.07).applyEuler(rot);
    this.pushBox('screen', x + off.x, y0 + 1.5 + H / 2 + off.y, z + off.z, W, H, 0.02, rot);
  }
  truss(x, z, h, y0 = 0) {
    // steel X-braced column
    const s = 0.9;
    for (const [dx, dz] of [[-s / 2, -s / 2], [s / 2, -s / 2], [-s / 2, s / 2], [s / 2, s / 2]]) this.pushBox('metal', x + dx, y0 + h / 2, z + dz, 0.12, h, 0.12);
    for (let y = 0; y < h - 0.5; y += 1.4) {
      for (const side of [0, 1]) {
        const rot = new THREE.Euler(0, side ? Math.PI / 2 : 0, 0.78);
        const off = side ? [s / 2, 0] : [0, s / 2];
        this.pushBox('metal', x + off[0], y0 + y + 0.7, z + off[1], 1.6, 0.08, 0.08, rot);
        this.pushBox('metal', x - off[0], y0 + y + 0.7, z - off[1], 1.6, 0.08, 0.08, rot);
      }
    }
    this.col.addBox(x - s / 2, y0, z - s / 2, x + s / 2, y0 + h, z + s / 2);
  }
  chest(x, y, z, rot = 0) { this.chestSpots.push({ x, y, z, rot }); }
  loot(x, y, z) { this.lootSpots.push({ x, y, z }); }
  ammo(x, y, z) { this.ammoSpots.push({ x, y, z }); }

  // ---------------------------------------------------------------- build
  build() {
    // ground
    this.box(0, -1, 0, MAP_HALF * 2 + 8, 1, MAP_HALF * 2 + 8, 'floor', { noCol: true });
    this.perimeter();
    this.theYard(0, 0);
    this.spawnHangar(0, -118);
    this.overlook(-112, -6);
    this.tealLabs(6, 114);
    this.plateTunnels(-106, 106);
    this.fogBlocks(104, 102);
    this.monitorStation(106, -106);
    this.glassWing(120, 4);
    this.crateDepot(-108, -108);
    this.scatter();
    this.finalize();
    this.animatedPieces();
    return this;
  }

  perimeter() {
    const H = 18, L = MAP_HALF;
    this.box(0, 0, -L - 1, L * 2 + 4, H, 2, 'slats');
    this.box(0, 0, L + 1, L * 2 + 4, H, 2, 'slats');
    this.box(-L - 1, 0, 0, 2, H, L * 2 + 4, 'slats');
    this.box(L + 1, 0, 0, 2, H, L * 2 + 4, 'slats');
    for (let p = -L + 20; p < L; p += 20) {
      for (const [x, z, w, d] of [[p, -L + 0.4, 2.4, 1.6], [p, L - 0.4, 2.4, 1.6], [-L + 0.4, p, 1.6, 2.4], [L - 0.4, p, 1.6, 2.4]]) {
        this.box(x, 0, z, w, H + 1, d, 'darker');
        // vertical light strip
        const sx = Math.abs(x) > L - 2 ? x - Math.sign(x) * 0.82 : x, sz = Math.abs(z) > L - 2 ? z - Math.sign(z) * 0.82 : z;
        this.pushBox('padPurple', sx, H * 0.55, sz, Math.abs(x) > L - 2 ? 0.05 : 0.3, H * 0.8, Math.abs(z) > L - 2 ? 0.05 : 0.3);
      }
    }
    // top light band
    this.pushBox('cyan', 0, H - 0.6, -L + 0.02, L * 2, 0.25, 0.06);
    this.pushBox('cyan', 0, H - 0.6, L - 0.02, L * 2, 0.25, 0.06);
    this.pushBox('cyan', -L + 0.02, H - 0.6, 0, 0.06, 0.25, L * 2);
    this.pushBox('cyan', L - 0.02, H - 0.6, 0, 0.06, 0.25, L * 2);
  }

  theYard(cx, cz) {
    this.pois.push({ name: 'The Yard', x: cx, z: cz, r: 42 });
    // Reactor plinth (two tiers, with steps)
    this.cyl(cx, 0, cz, 9.5, 0.45, 'concrete', { seg: 32 });
    this.cyl(cx, 0.45, cz, 7.5, 0.45, 'dark', { seg: 32 });
    this.cyl(cx, 0.9, cz, 2.6, 1.2, 'metal', { seg: 24 });
    this.cyl(cx, 2.1, cz, 1.5, 22, 'core', { seg: 20 });
    this.pushBox('hazard', cx, 0.47, cz + 8.2, 4, 0.04, 1.2);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const px = cx + Math.cos(a) * 5.4, pz = cz + Math.sin(a) * 5.4;
      const alongX = i % 2 === 0;
      this.box(px, 0.9, pz, alongX ? 2.8 : 0.6, 1.15, alongX ? 0.6 : 2.8, 'darker');
      this.lightBeam(cx + Math.cos(a) * 8.2, cz + Math.sin(a) * 8.2, 0.45, 9, i % 2 === 1, 0.35);
    }
    this.chest(cx + 3.4, 0.9, cz, Math.PI / 2);
    this.loot(cx - 3.4, 0.9, cz);
    this.ammo(cx, 0.9, cz + 3.6);

    // broken walls & cover around the yard (mirrors the walkthrough's courtyard)
    this.brokenWall(cx + 15, cz - 11, 10, 3.4, true);
    this.brokenWall(cx - 17, cz + 12, 10, 3.4, false);
    this.brokenWall(cx + 2, cz + 26, 16, 3.2, true, 'darker');
    this.brokenWall(cx - 4, cz - 30, 12, 3.4, true);
    this.kiosk(cx + 24, cz + 14, 2);
    this.kiosk(cx - 25, cz - 17, 0);
    this.crateStack(cx + 8, cz + 17, 1.6, 3);
    this.crateStack(cx - 12, cz - 23, 1.6, 2);
    this.crateStack(cx + 27, cz - 4, 1.6, 4);
    this.crateStack(cx - 30, cz + 3, 1.8, 3);
    this.crateStack(cx + 4, cz - 19, 1.5, 2);
    this.crateStack(cx - 6, cz + 33, 1.6, 2);
    this.crate(cx + 33, cz + 28, 1.6); this.crate(cx - 34, cz - 30, 1.6);
    this.barrier(cx + 13, cz + 6, false); this.barrier(cx - 12, cz - 6, false);
    this.barrier(cx + 18, cz + 30, true); this.barrier(cx - 20, cz - 34, true);
    this.slab(cx + 19, cz - 25, 0.6, 0.35);
    this.slab(cx - 21, cz + 27, -0.9, 0.3);
    this.slab(cx + 35, cz + 8, 1.6, 0.28, 3.4, 2.6);
    // L-shaped low walls
    this.box(cx + 31, 0, cz + 22, 6, 1.3, 0.6, 'dark'); this.box(cx + 33.7, 0, cz + 19.6, 0.6, 1.3, 4.2, 'dark');
    this.box(cx - 31, 0, cz - 22, 6, 1.3, 0.6, 'dark'); this.box(cx - 33.7, 0, cz - 19.6, 0.6, 1.3, 4.2, 'dark');
    this.chest(cx - 32, 0, cz - 20); this.chest(cx + 32, 0, cz + 20);
    [[10, -6], [-9, 8], [20, 22], [-22, -9], [6, 30], [-14, -32], [30, -14], [-30, 16], [16, -30], [-3, 15]]
      .forEach(([x, z]) => this.loot(cx + x, 0, cz + z));
    [[18, 4], [-18, -4], [0, -24], [0, 22]].forEach(([x, z]) => this.ammo(cx + x, 0, cz + z));
  }

  spawnHangar(cx, cz) {
    this.pois.push({ name: 'Spawn Hangar', x: cx, z: cz, r: 30 });
    const W = 52, D = 26, H = 9, t = 0.8;
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
    this.wall(x0, z0, x1, z0, H, t, 'slats');
    this.wall(x0, z0, x0, z1, H, t, 'slats', [{ at: D / 2, w: 4, h: 4 }]);
    this.wall(x1, z0, x1, z1, H, t, 'slats', [{ at: D / 2, w: 4, h: 4 }]);
    this.wall(x0, z1, x1, z1, H, t, 'slats', [{ at: 10, w: 8, h: 5.5 }, { at: W / 2, w: 10, h: 5.5 }, { at: W - 10, w: 8, h: 5.5 }]);
    this.box(cx, H, cz, W + 1, 0.6, D + 1, 'darker');
    // skylight strips + inner light bands
    for (let i = -2; i <= 2; i++) this.pushBox('white', cx + i * 9, H - 0.02, cz, 4, 0.05, D - 6);
    this.pushBox('padPurple', cx, 6.2, z0 + t / 2 + 0.03, W - 3, 0.18, 0.04);
    this.pushBox('padPurple', cx, 2.2, z0 + t / 2 + 0.03, W - 3, 0.1, 0.04);
    // spawn pads (purple glowing floor tiles like the walkthrough)
    for (const px of [-14, 0, 14]) for (const pz of [-3, 6]) {
      this.box(cx + px, 0, cz + pz, 4.4, 0.08, 4.4, 'darker', { noCol: true });
      this.pushBox('padPurple', cx + px, 0.1, cz + pz, 3.8, 0.04, 3.8);
    }
    // mezzanine along the back wall
    const mzY = 4.2;
    this.box(cx, mzY - 0.4, z0 + t / 2 + 2.6, W - t * 2, 0.4, 5.2, 'plate');
    for (let px = -20; px <= 20; px += 10) this.box(cx + px, 0, z0 + 5, 0.4, mzY - 0.4, 0.4, 'metal');
    this.railing(x0 + t, z0 + 5.4, x1 - 6, z0 + 5.4, mzY);
    this.stairs(x1 - 3.4, z0 + 11, 3, 10.4, mzY, '-z', 'plate');
    this.railing(x1 - 5, z0 + 6, x1 - 5, z0 + 16, 0.1, 0.9);
    // signage on the facade
    this.pushBox('sign', cx, 6.4, z1 + t / 2 + 0.06, 14, 3.5, 0.05);
    this.pushBox('cyan', cx, H - 0.5, z1 + t / 2 + 0.05, W, 0.2, 0.05);
    // contents
    this.crateStack(cx - 22, cz + 9, 1.6, 3); this.crateStack(cx + 18, cz + 9, 1.6, 2);
    this.crateStack(cx - 6, z0 + 2.2, 1.4, 2);
    this.chest(cx, mzY, z0 + 2.6); this.chest(cx - 20, 0, cz + 2, Math.PI / 2); this.chest(cx + 21, 0, cz - 4, -Math.PI / 2);
    for (const px of [-14, 0, 14]) this.loot(cx + px, 0.1, cz + 1.5);
    this.loot(cx - 15, mzY, z0 + 2.6); this.loot(cx + 12, mzY, z0 + 2.6);
    this.ammo(cx - 8, 0, cz + 10); this.ammo(cx + 8, 0, cz - 8);
    // outside cover
    this.barrier(cx - 18, z1 + 8, true); this.barrier(cx + 18, z1 + 8, true); this.barrier(cx, z1 + 14, true);
    this.crateStack(cx - 32, cz + 6, 1.6, 2); this.crateStack(cx + 31, cz - 6, 1.6, 3);
    this.loot(cx - 30, 0, cz + 14); this.loot(cx + 30, 0, cz + 12);
  }

  overlook(cx, cz) {
    this.pois.push({ name: 'Overlook', x: cx, z: cz, r: 26 });
    const W = 34, D = 14, Y = 6;
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
    this.box(cx, Y - 0.5, cz, W, 0.5, D, 'plate');
    this.pushBox('darker', cx, Y - 0.62, cz, W + 0.4, 0.25, D + 0.4);
    for (let px = x0 + 1; px <= x1 - 1; px += 8) for (const pz of [z0 + 1, z1 - 1]) this.box(px, 0, pz, 0.9, Y - 0.5, 0.9, 'dark');
    // railings with stair gaps
    this.railing(x0, z0, cx - 14, z0, Y); this.railing(cx - 10, z0, x1, z0, Y);
    this.railing(x0, z1, cx + 6, z1, Y); this.railing(cx + 10, z1, x1, z1, Y);
    this.railing(x0, z0, x0, z1, Y);
    // parapet with window slots facing the Yard
    this.wall(x1, z0, x1, z1, 1.4, 0.5, 'dark', [{ at: 4, w: 2, h: 1.4, sill: 0.9 }, { at: 10, w: 2, h: 1.4, sill: 0.9 }], Y);
    this.stairs(cx - 12, z0 - 6, 4, 12, Y, '+z', 'concrete');
    this.stairs(cx + 8, z1 + 6, 4, 12, Y, '-z', 'concrete');
    // energy pillars
    for (const [px, pz] of [[x0 + 1, z0 + 1], [x1 - 1, z1 - 1]]) this.lightBeam(px, pz, Y, 16, false, 0.6);
    this.lightBeam(x0 - 6, cz, 0, 22, false, 1.1);
    // orange canopy on the west end
    for (const [px, pz] of [[x0 + 1.5, z0 + 1.5], [x0 + 1.5, z1 - 1.5], [x0 + 9, z0 + 1.5], [x0 + 9, z1 - 1.5]]) this.box(px, Y, pz, 0.5, 3.6, 0.5, 'metal');
    this.box(x0 + 5.2, Y + 3.6, cz, 9.5, 0.4, D - 1, 'darker');
    this.pushBox('orange', x0 + 5.2, Y + 3.58, cz, 8.4, 0.04, D - 2.4);
    this.monitor(x0 + 5, cz - 3, Math.PI / 2, Y); this.monitor(x0 + 5, cz + 3, Math.PI / 2, Y);
    this.crate(cx + 4, cz - 3, 1.4, Y); this.crate(cx + 9, cz + 3.5, 1.4, Y);
    this.chest(x0 + 3, Y, cz); this.chest(cx + 2, 0, cz, 0);
    this.loot(cx + 12, Y, cz); this.loot(cx - 4, Y, cz + 2); this.loot(cx - 8, 0, cz - 2); this.loot(cx + 10, 0, cz + 1);
    this.ammo(cx, Y, cz - 4); this.ammo(cx - 14, 0, cz + 2);
    // backdrop wall and cover beneath
    this.wall(x0 - 12, cz - 20, x0 - 12, cz + 20, 10, 1.2, 'slats');
    this.crateStack(cx - 2, cz + 2, 1.5, 2); this.crateStack(cx + 12, cz - 2, 1.5, 3);
    this.barrier(x1 + 8, cz - 6, false); this.barrier(x1 + 8, cz + 6, false);
    this.kiosk(cx - 2, cz + 21, 2); this.kiosk(cx - 6, cz - 21, 0);
  }

  tealLabs(cx, cz) {
    this.pois.push({ name: 'Teal Labs', x: cx, z: cz, r: 28 });
    const W = 44, D = 28, H = 5, t = 0.6;
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
    // floor plate
    this.box(cx, 0, cz, W, 0.06, D, 'plate', { noCol: true });
    // outer walls
    this.wall(x0, z0, x1, z0, H, t, 'teal', [{ at: 10, w: 3, h: 3 }, { at: 34, w: 3, h: 3 }, { at: 22, w: 6, h: 3.4, sill: 1.2 }]);
    this.wall(x0, z1, x1, z1, H, t, 'teal', [{ at: 22, w: 3.4, h: 3 }, { at: 8, w: 5, h: 3.4, sill: 1.2 }, { at: 36, w: 5, h: 3.4, sill: 1.2 }]);
    this.wall(x0, z0, x0, z1, H, t, 'teal', [{ at: 14, w: 3, h: 3 }]);
    this.wall(x1, z0, x1, z1, H, t, 'teal', [{ at: 14, w: 3, h: 3 }]);
    // corridor walls (diamond plate)
    this.wall(x0, cz - 2, x1, cz - 2, H, 0.5, 'plate', [{ at: 7, w: 2.6, h: 2.9 }, { at: 22, w: 2.6, h: 2.9 }, { at: 37, w: 2.6, h: 2.9 }]);
    this.wall(x0, cz + 2, x1, cz + 2, H, 0.5, 'plate', [{ at: 13, w: 2.6, h: 2.9 }, { at: 29, w: 2.6, h: 2.9 }]);
    this.wall(cx, z0, cx, cz - 2, H, 0.5, 'tealDark', [{ at: 6, w: 2.4, h: 2.9 }]);
    this.wall(cx - 8, cz + 2, cx - 8, z1, H, 0.5, 'tealDark');
    this.wall(cx + 9, cz + 2, cx + 9, z1, H, 0.5, 'tealDark', [{ at: 6, w: 2.4, h: 2.9 }]);
    // roof with light panels
    this.box(cx, H, cz, W + 0.8, 0.5, D + 0.8, 'tealDark');
    for (let px = x0 + 4; px < x1 - 2; px += 8) {
      this.pushBox('white', px, H - 0.03, cz, 2.5, 0.05, 1.2);
      this.pushBox('white', px, H - 0.03, cz - 8, 1.6, 0.05, 1.6);
      this.pushBox('white', px, H - 0.03, cz + 8, 1.6, 0.05, 1.6);
    }
    this.pushBox('cyan', cx, 0.08, cz, W - 2, 0.04, 0.15);
    // trusses + furniture
    this.truss(x0 + 2, z0 + 2, H); this.truss(x1 - 2, z1 - 2, H); this.truss(cx - 2, cz + 4.5, H);
    const desk = (x, z, alongX) => { this.box(x, 0, z, alongX ? 2.4 : 1, 0.95, alongX ? 1 : 2.4, 'metal'); };
    desk(x0 + 6, z0 + 5, true); desk(x0 + 14, z0 + 5, true); desk(x1 - 6, z0 + 6, false);
    desk(x0 + 4, z1 - 4, true); desk(x1 - 5, z1 - 5, true);
    this.monitor(x0 + 6, z0 + 4.2, 0, 0.95 - 1.45); this.monitor(x1 - 5, z1 - 5.8, Math.PI, 0.95 - 1.45);
    this.crateStack(cx + 4, z0 + 3, 1.3, 2); this.crateStack(cx - 3, z1 - 3, 1.3, 2);
    this.box(x1 - 2, 0, cz - 8, 1.2, 2.2, 3.6, 'tealDark');
    this.chest(cx - 14, 0, cz - 9); this.chest(cx + 14, 0, cz + 9, Math.PI); this.chest(cx, 0, cz, Math.PI / 2);
    [[-16, 9], [-4, -9], [12, -9], [0, 9], [17, 0], [-17, 0]].forEach(([x, z]) => this.loot(cx + x, 0.06, cz + z));
    this.ammo(cx - 10, 0.06, cz); this.ammo(cx + 18, 0.06, cz - 10);
    // exterior
    this.crateStack(x0 - 5, cz - 6, 1.6, 3); this.barrier(cx, z0 - 7, true); this.barrier(cx + 14, z1 + 6, true);
    this.lightBeam(x1 + 4, z0 - 4, 0, 12, true, 0.5);
  }

  plateTunnels(cx, cz) {
    this.pois.push({ name: 'Plate Tunnels', x: cx, z: cz, r: 32 });
    const map = [
      '..#.........#..',
      '..#.........#..',
      '#############..',
      '..#....#....#..',
      '..#....#....#..',
      '..#....#....###',
      '..#....#....#..',
      '..###########..',
      '..#....#....#..',
      '..#....#....#..',
      '###....#....#..',
      '..#....#....#..',
      '..############.',
      '.......#.......',
      '.......#.......',
    ];
    const C = 4, N = map.length, H = 4.6;
    const ox = cx - (N * C) / 2, oz = cz - (N * C) / 2;
    const isC = (i, k) => k >= 0 && k < N && i >= 0 && i < N && map[k][i] === '#';
    // greedy horizontal runs of solid cells
    for (let k = 0; k < N; k++) {
      let i = 0;
      while (i < N) {
        if (isC(i, k)) { i++; continue; }
        let j = i; while (j < N && !isC(j, k)) j++;
        const len = (j - i) * C;
        this.box(ox + i * C + len / 2, 0, oz + k * C + C / 2, len, H, C, k % 2 ? 'plate' : 'platePurple');
        i = j;
      }
    }
    // roofs, ceiling lights, floor strips over corridor cells
    let n = 0;
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
      if (!isC(i, k)) continue;
      const x = ox + i * C + C / 2, z = oz + k * C + C / 2;
      this.box(x, H, z, C, 0.4, C, 'darker');
      const horiz = isC(i - 1, k) || isC(i + 1, k);
      if (n++ % 2 === 0) this.pushBox('white', x, H - 0.03, z, horiz ? 1.6 : 0.5, 0.05, horiz ? 0.5 : 1.6);
      if (horiz) { this.pushBox('cyan', x, 0.03, z - 1.6, C, 0.04, 0.12); this.pushBox('cyan', x, 0.03, z + 1.6, C, 0.04, 0.12); }
      else { this.pushBox('cyan', x - 1.6, 0.03, z, 0.12, 0.04, C); this.pushBox('cyan', x + 1.6, 0.03, z, 0.12, 0.04, C); }
    }
    this.box(cx, H + 0.4, cz, N * C - 8, 0.3, N * C - 8, 'dark', { noCol: true });
    // loot inside corridors
    const cell = (i, k) => ({ x: ox + i * C + C / 2, z: oz + k * C + C / 2 });
    [[7, 7], [2, 4], [12, 4], [2, 10], [12, 9], [7, 12]].forEach(([i, k]) => { const p = cell(i, k); this.loot(p.x, 0, p.z); });
    [[4, 2], [10, 7], [9, 12]].forEach(([i, k]) => { const p = cell(i, k); this.chest(p.x, 0, p.z, 0); });
    [[7, 4], [2, 7]].forEach(([i, k]) => { const p = cell(i, k); this.ammo(p.x, 0, p.z); });
    // entrance signage
    this.lightBeam(ox - 3, oz + 2 * C + 2, 0, 10, true, 0.5);
    this.crateStack(ox + 2 * C + 6, oz - 4, 1.5, 2);
  }

  fogBlocks(cx, cz) {
    this.pois.push({ name: 'Fog Blocks', x: cx, z: cz, r: 26 });
    const r = seeded(77);
    for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
      if (r() < 0.22) continue;
      const x = cx + gx * 7 + (r() - 0.5) * 2.5, z = cz + gz * 7 + (r() - 0.5) * 2.5;
      const s = 2.4 + r() * 2.2, h = [1.3, 2.6, 3.6][Math.floor(r() * 3)];
      this.box(x, 0, z, s, h, s * (0.7 + r() * 0.6), 'block');
      if (r() < 0.25) this.box(x + (r() - 0.5), h, z, s * 0.6, 1.2, s * 0.6, 'block');
      if (r() < 0.18) this.loot(x + s / 2 + 1.2, 0, z);
    }
    this.box(cx, 0, cz, 8, 0.6, 8, 'block');
    this.chest(cx, 0.6, cz); this.chest(cx - 18, 0, cz + 18); this.chest(cx + 19, 0, cz - 15, Math.PI);
    this.ammo(cx + 4, 0, cz + 12); this.ammo(cx - 12, 0, cz - 6);
  }

  monitorStation(cx, cz) {
    this.pois.push({ name: 'Monitor Station', x: cx, z: cz, r: 26 });
    // canopy with orange glow
    const W = 26, D = 16, Y = 6.5;
    for (const px of [-W / 2 + 1, 0, W / 2 - 1]) for (const pz of [-D / 2 + 1, D / 2 - 1]) this.box(cx + px, 0, cz + pz, 0.7, Y, 0.7, 'metal');
    this.box(cx, Y, cz, W, 0.6, D, 'darker');
    this.pushBox('orange', cx, Y - 0.03, cz, W - 3, 0.05, D - 3);
    // consoles
    for (const px of [-8, 0, 8]) {
      this.box(cx + px, 0, cz - 2, 4, 1.0, 1.2, 'metal');
      this.pushBox('screen', cx + px, 1.02, cz - 2, 3.6, 0.03, 1.0);
      this.monitor(cx + px, cz - 3.4, 0, 0, false);
    }
    // teal door block
    this.box(cx - 2, 0, cz + 14, 12, 4, 6, 'teal');
    this.pushBox('cyan', cx - 2, 1.4, cz + 10.96, 2.2, 2.8, 0.05);
    this.box(cx - 2, 2.8, cz + 10.9, 2.8, 0.25, 0.3, 'tealDark');
    // screen tower (big holo screens up high, like the video)
    this.box(cx + 18, 0, cz - 12, 3, 9, 3, 'metal');
    this.pushBox('screen', cx + 18, 10.2, cz - 10.45, 4.2, 2.6, 0.06);
    this.pushBox('screen', cx + 16.45, 10.2, cz - 12, 0.06, 2.6, 4.2);
    this.box(cx + 18, 9, cz - 12, 4.4, 0.3, 4.4, 'darker');
    this.box(cx + 18, 11.6, cz - 12, 4.4, 0.3, 4.4, 'darker');
    this.pushBox('orange', cx + 18, 11.55, cz - 12, 3.8, 0.05, 3.8);
    this.monitor(cx - 15, cz + 4, Math.PI / 2, 0, true);
    this.crateStack(cx + 10, cz + 6, 1.5, 3); this.crateStack(cx - 14, cz - 9, 1.5, 2);
    this.crateStack(cx + 20, cz + 10, 1.6, 2);
    this.chest(cx, 0, cz + 2, Math.PI); this.chest(cx + 15, 0, cz - 6); this.chest(cx - 10, 0, cz + 8);
    [[-6, 5], [6, 5], [12, -6], [-12, -5], [22, 4], [-20, 2]].forEach(([x, z]) => this.loot(cx + x, 0, cz + z));
    this.ammo(cx + 4, 0, cz - 6); this.ammo(cx - 4, 0, cz + 6);
    this.barrier(cx, cz - 14, true); this.barrier(cx - 18, cz - 14, true);
  }

  glassWing(cx, cz) {
    this.pois.push({ name: 'Glass Wing', x: cx, z: cz, r: 32 });
    const W = 16, D = 60, H = 6, t = 0.6;
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
    const windows = [];
    for (let a = 6; a < D - 4; a += 7) windows.push({ at: a, w: 4, h: 3.6, sill: 1.25 });
    // west face: windows + 2 doors
    const westGaps = windows.filter(g => Math.abs(g.at - 20) > 3 && Math.abs(g.at - 41) > 3);
    westGaps.push({ at: 20, w: 3, h: 3 }, { at: 41, w: 3, h: 3 });
    this.wall(x0, z0, x0, z1, H, t, 'dark', westGaps);
    this.wall(x1, z0, x1, z1, H, t, 'dark', windows.filter((_, i) => i % 2 === 0));
    this.wall(x0, z0, x1, z0, H, t, 'dark', [{ at: W / 2, w: 3.4, h: 3 }]);
    this.wall(x0, z1, x1, z1, H, t, 'dark', [{ at: W / 2, w: 3.4, h: 3 }]);
    // window frames glow strip
    this.pushBox('padPurple', x0 - t / 2 - 0.02, 4.95, cz, 0.04, 0.12, D - 2);
    // interior partitions
    this.wall(x0, cz - 8, x1, cz - 8, H, 0.4, 'concrete', [{ at: 4, w: 2.6, h: 2.9 }, { at: 12, w: 2.6, h: 2.9 }]);
    this.wall(x0, cz + 10, x1, cz + 10, H, 0.4, 'concrete', [{ at: 8, w: 3, h: 2.9 }]);
    this.box(cx, H, cz, W + 0.8, 0.5, D + 0.8, 'darker');
    for (let pz = z0 + 4; pz < z1; pz += 8) this.pushBox('white', cx, H - 0.03, pz, 6, 0.05, 0.8);
    // offices
    for (let pz = z0 + 5; pz < z1 - 3; pz += 9) {
      this.box(cx + 3, 0, pz, 2.6, 0.9, 1.1, 'metal');
      if ((pz | 0) % 2) this.monitor(cx + 3, pz - 0.2, Math.PI, -0.55);
    }
    this.crateStack(cx - 4, z0 + 3, 1.3, 2); this.crateStack(cx - 4, z1 - 3, 1.3, 2);
    // AC units on roof
    for (let pz = z0 + 8; pz < z1; pz += 16) this.box(cx, H + 0.5, pz, 3, 1.4, 3, 'steel', { noCol: false });
    this.chest(cx + 5, 0, z0 + 2); this.chest(cx - 5, 0, cz); this.chest(cx + 5, 0, z1 - 2, Math.PI);
    [[-3, -24], [3, -16], [-3, -3], [3, 6], [-3, 16], [3, 26]].forEach(([x, z]) => this.loot(cx + x, 0, cz + z));
    this.ammo(cx, 0, cz - 12); this.ammo(cx, 0, cz + 20);
    // outside
    this.crateStack(x0 - 6, cz - 14, 1.6, 2); this.crateStack(x0 - 7, cz + 16, 1.6, 3);
    this.barrier(x0 - 12, cz, false); this.slab(x0 - 10, cz + 28, 0.3, 0.32);
    this.loot(x0 - 9, 0, cz - 26); this.loot(x0 - 10, 0, cz + 8);
  }

  crateDepot(cx, cz) {
    this.pois.push({ name: 'Crate Depot', x: cx, z: cz, r: 28 });
    const cont = (x, z, alongX, y0 = 0, m = 'contA') => {
      const L = 7, Wd = 2.6, Hh = 2.7;
      this.box(x, y0, z, alongX ? L : Wd, Hh, alongX ? Wd : L, m);
      // door ribs
      this.pushBox('metal', alongX ? x + L / 2 + 0.03 : x, y0 + Hh / 2, alongX ? z : z + L / 2 + 0.03, alongX ? 0.06 : Wd - 0.3, Hh - 0.3, alongX ? Wd - 0.3 : 0.06);
    };
    cont(cx - 14, cz - 12, true, 0, 'contA'); cont(cx - 14, cz - 12, true, 2.7, 'contB');
    cont(cx - 14, cz - 6, true, 0, 'contC');
    cont(cx + 2, cz - 14, false, 0, 'contB'); cont(cx + 6, cz - 14, false, 0, 'contA'); cont(cx + 6, cz - 14, false, 2.7, 'contC');
    cont(cx + 14, cz + 2, true, 0, 'contA');
    cont(cx - 6, cz + 10, true, 0, 'contB'); cont(cx - 6, cz + 13, true, 0, 'contC'); cont(cx - 6, cz + 10, true, 2.7, 'contA');
    cont(cx + 12, cz + 14, false, 0, 'contC');
    // ramp up to the double stack
    this.stairs(cx - 14, cz - 19.3, 3, 12, 5.4, '+z', 'metal');
    this.chest(cx - 14, 5.4, cz - 12); this.loot(cx - 6, 5.4, cz + 11.5); this.loot(cx + 6, 5.4, cz - 14);
    for (let i = 0; i < 9; i++) {
      const x = cx + (this.rng() - 0.5) * 34, z = cz + (this.rng() - 0.5) * 34;
      if (this.col.isFree(x, 0, z, 1.6, 2)) this.crateStack(x, z, 1.4 + this.rng() * 0.4, 1 + Math.floor(this.rng() * 3));
    }
    this.kiosk(cx + 16, cz - 10, 3);
    this.chest(cx + 2, 0, cz + 2); this.chest(cx - 18, 0, cz + 6, Math.PI / 2);
    [[-4, -4], [8, 6], [-10, 2], [14, -4], [0, 16], [-18, -2]].forEach(([x, z]) => this.loot(cx + x, 0, cz + z));
    this.ammo(cx + 4, 0, cz - 2); this.ammo(cx - 8, 0, cz + 6);
    this.lightBeam(cx + 20, cz + 20, 0, 14, false, 0.6);
  }

  scatter() {
    const r = seeded(4242);
    const nearPoi = (x, z, pad) => this.pois.some(p => Math.hypot(x - p.x, z - p.z) < p.r + pad);
    let placed = 0;
    for (let tries = 0; tries < 1400 && placed < 230; tries++) {
      const x = (r() - 0.5) * (MAP_HALF * 2 - 24), z = (r() - 0.5) * (MAP_HALF * 2 - 24);
      if (nearPoi(x, z, 6)) continue;
      if (!this.col.isFree(x, 0, z, 4, 3)) continue;
      const k = r();
      if (k < 0.32) this.crateStack(x, z, 1.4 + r() * 0.5, 1 + Math.floor(r() * 3));
      else if (k < 0.5) this.barrier(x, z, r() < 0.5);
      else if (k < 0.64) this.brokenWall(x, z, 7 + r() * 5, 2.8 + r() * 0.8, r() < 0.5, r() < 0.5 ? 'dark' : 'darker');
      else if (k < 0.74) this.box(x, 0, z, r() < 0.5 ? 5 : 0.6, 1.2, r() < 0.5 ? 0.6 : 5, 'dark');
      else if (k < 0.84) this.slab(x, z, r() * Math.PI, 0.25 + r() * 0.15);
      else if (k < 0.9) this.box(x, 0, z, 2.5 + r() * 2, 1.3 + r() * 2, 2.5 + r() * 2, 'block');
      else if (k < 0.94) this.lightBeam(x, z, 0, 10 + r() * 6, r() < 0.4, 0.45);
      else this.kiosk(x, z, Math.floor(r() * 4));
      placed++;
      if (r() < 0.45) this.loot(x + 2.5, 0, z + 2.5);
      else if (r() < 0.2) this.chest(x + 2.4, 0, z - 2.4);
      else if (r() < 0.25) this.ammo(x - 2.5, 0, z);
    }
  }

  finalize() {
    for (const [key, b] of this.buckets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(b.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const m = this.mats[b.matKey];
      const mesh = new THREE.Mesh(g, m.mat);
      mesh.name = key;
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = m.shadow;
      mesh.castShadow = m.shadow && b.matKey !== 'floor';
      if (b.matKey === 'beam' || b.matKey === 'beamCyan') mesh.renderOrder = 5;
      this.group.add(mesh);
    }
    this.buckets.clear();
    // clamp loot spots to valid ground
    const fix = s => { s.y = Math.max(s.y, this.col.groundHeight(s.x, s.z, 0.2, s.y + 0.2, 0.3)); };
    this.lootSpots.forEach(fix); this.chestSpots.forEach(fix); this.ammoSpots.forEach(fix);
  }

  animatedPieces() {
    // Floating energy rings around the reactor core
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xc9a2ff, toneMapped: false });
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x6ff0ff, toneMapped: false });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4 - i * 0.4, 0.12, 8, 48), i % 2 ? ringMat2 : ringMat);
      ring.position.set(0, 8 + i * 6, 0);
      const speed = 0.4 + i * 0.25, phase = i * 1.3;
      this.animated.push(t => { ring.rotation.x = Math.PI / 2 + Math.sin(t * speed + phase) * 0.35; ring.rotation.y = t * speed; ring.position.y = 8 + i * 6 + Math.sin(t * 0.8 + phase) * 0.6; });
      this.group.add(ring);
    }
    // Central reactor beam
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 90, 16, 1, true), this.mats.beam.mat);
    beam.position.set(0, 45 + 2, 0); beam.renderOrder = 6;
    this.group.add(beam);
    // Core pulse
    const coreMat = this.mats.core.mat;
    this.animated.push(t => { const k = 0.75 + 0.25 * Math.sin(t * 3); coreMat.color.setRGB(0.45 * k + 0.12, 0.3 * k + 0.1, 0.75 + 0.15 * k); });
  }

  update(t) { for (const fn of this.animated) fn(t); }
}
