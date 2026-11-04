// WAREHOUSE — a mega distribution centre: steel-framed walls, an open truss roof, red pallet racks,
// orange totes, catwalks with red railings, red-door offices, a red room, docks, containers and conveyors.
// Built with the same merged-geometry/collider primitives as Reversal Compound (see World).
import * as THREE from 'three';
import { MAP_HALF } from '../config.js';

const L = MAP_HALF;
const WALL_H = 26, ROOF_Y = 24.2, PART_H = 9;

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function stripeTexture(a, b, n = 8) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, 128, 128);
  x.fillStyle = b;
  for (let i = -n; i < n * 2; i++) { x.beginPath(); x.moveTo(i * 128 / n, 0); x.lineTo(i * 128 / n + 64 / n, 0); x.lineTo(i * 128 / n + 64 / n + 128, 128); x.lineTo(i * 128 / n + 128, 128); x.closePath(); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Zone signs (one atlas, 3x3 cells). */
const SIGNS = ['DISPATCH', 'HIGH RACKS', 'OFFICES', 'LOADING DOCKS', 'COLD STORAGE', 'CONTAINERS', 'RED ROOM', 'CONVEYORS', 'FORKLIFT BAY'];
function signAtlas() {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 768;
  const x = c.getContext('2d');
  SIGNS.forEach((s, i) => {
    const cx = (i % 3) * 512, cy = Math.floor(i / 3) * 256;
    x.fillStyle = '#1c2130'; x.fillRect(cx + 6, cy + 6, 500, 244);
    x.fillStyle = '#d8382c'; x.fillRect(cx + 6, cy + 6, 500, 34);
    x.fillStyle = '#ffffff'; x.font = 'bold 26px "Russo One", Impact, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('ZONE ' + String.fromCharCode(65 + i), cx + 22, cy + 24);
    x.font = `bold ${s.length > 11 ? 62 : 76}px "Russo One", Impact, sans-serif`; x.textAlign = 'center';
    x.fillStyle = '#f2f4fa'; x.fillText(s, cx + 256, cy + 150);
    x.fillStyle = '#ffc928'; x.fillRect(cx + 150, cy + 205, 212, 10);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function addMaterials(w) {
  const T = w.T, low = w.quality === 'low';
  const std = (o) => low
    ? new THREE.MeshLambertMaterial({ color: o.color, map: o.map || null, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: o.depthWrite ?? true })
    : new THREE.MeshStandardMaterial({ color: o.color, map: o.map || null, roughness: o.roughness ?? 0.9, metalness: o.metalness ?? 0, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: o.depthWrite ?? true });
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
  const M = (key, mat, uv = 'world', scale = 4, shadow = true) => { w.mats[key] = { mat, uv, scale, shadow }; };
  M('whFloor', std({ color: 0xbfc3ce, map: T.concrete, roughness: 0.93 }), 'world', 9);
  M('whWall', std({ color: 0xd4d7e0, map: T.concrete }), 'world', 5);
  M('whWallDark', std({ color: 0x737a8c, map: T.concrete }), 'world', 4);
  M('whPanel', std({ color: 0xb4bac8, map: T.slats, roughness: 0.75, metalness: 0.2 }), 'world', 3);
  M('whSteel', std({ color: 0x2d3343, roughness: 0.48, metalness: 0.65 }), 'world', 2);
  M('whGrate', std({ color: 0x5f6678, map: T.plate, roughness: 0.5, metalness: 0.6 }), 'world', 1.4);
  M('rackRed', std({ color: 0xcf3329, roughness: 0.5, metalness: 0.35 }), 'world', 2);
  M('rackOrange', std({ color: 0xf07a2c, roughness: 0.5, metalness: 0.3 }), 'world', 2);
  M('totes', std({ color: 0xf2622a, map: T.crate, roughness: 0.6 }), 'unit', 1);
  M('boxBlue', std({ color: 0x3471d6, map: T.crate, roughness: 0.6 }), 'unit', 1);
  M('boxWhite', std({ color: 0xeef1f6, map: T.crate, roughness: 0.75 }), 'unit', 1);
  M('cardboard', std({ color: 0xc99a60, map: T.crate, roughness: 0.9 }), 'unit', 1);
  M('boxBlack', std({ color: 0x272a33, roughness: 0.42, metalness: 0.45 }), 'world', 2);
  M('wood', std({ color: 0xa9845a, map: T.slats, roughness: 0.9 }), 'world', 1.2);
  M('greyPlastic', std({ color: 0x8c93a4, roughness: 0.6 }), 'world', 2);
  M('redPaint', std({ color: 0xc22f2e, map: T.concrete, roughness: 0.7 }), 'world', 3);
  M('carpet', std({ color: 0x96202b, map: T.tiles, roughness: 1 }), 'world', 2.5);
  M('roomWall', std({ color: 0xcbbcc6, map: T.concrete }), 'world', 4);
  M('coldWall', std({ color: 0xe7ecf4, map: T.slats, roughness: 0.6, metalness: 0.1 }), 'world', 2.4);
  M('ice', std({ color: 0xd9eefc, map: T.tiles, roughness: 0.25, metalness: 0.1 }), 'world', 3);
  M('cont1', std({ color: 0x2c60c2, map: T.container, roughness: 0.55, metalness: 0.35 }), 'world', 3);
  M('cont2', std({ color: 0xdc5f2a, map: T.container, roughness: 0.55, metalness: 0.35 }), 'world', 3);
  M('cont3', std({ color: 0xd5d9e2, map: T.container, roughness: 0.55, metalness: 0.3 }), 'world', 3);
  M('cont4', std({ color: 0xa92e2c, map: T.container, roughness: 0.55, metalness: 0.35 }), 'world', 3);
  M('yellow', std({ color: 0xf5bf22, roughness: 0.55, metalness: 0.2 }), 'world', 2);
  M('rubber', std({ color: 0x1b1c21, roughness: 0.92 }), 'world', 2);
  M('redWhite', std({ color: 0xffffff, map: stripeTexture('#f3f3f6', '#d22f2d'), roughness: 0.6 }), 'world', 1.6);
  M('glass', std({ color: 0xa8d8ff, transparent: true, opacity: 0.26, roughness: 0.05, metalness: 0.3, depthWrite: false }), 'unit', 1, false);
  M('lineY', basic(0xcfa72a), 'unit', 1, false);
  M('lineW', basic(0xd6d9e3), 'unit', 1, false);
  M('lineR', basic(0xc0302e), 'unit', 1, false);
  M('stripW', basic(0xf2f6ff), 'unit', 1, false);
  M('stripBlue', basic(0x3fb2ff), 'unit', 1, false);
  M('stripRed', basic(0xff3a3a), 'unit', 1, false);
  M('greenLed', basic(0x48ff8c), 'unit', 1, false);
  M('beacon', basic(0xff9a2a), 'unit', 1, false);
  M('whSigns', basic(0xffffff, { map: signAtlas() }), 'unit', 1, false);
}

export function buildWarehouse(w) {
  addMaterials(w);
  const rng = seeded(9001);
  const box = (...a) => w.box(...a), pb = (...a) => w.pushBox(...a);
  const reserved = [];  // rects kept free of columns/scatter: [x0,z0,x1,z1]
  const reserve = (x0, z0, x1, z1) => reserved.push([x0, z0, x1, z1]);
  const inReserved = (x, z, pad = 0) => reserved.some(([a, b, c, d]) => x > a - pad && x < c + pad && z > b - pad && z < d + pad);

  // ------------------------------------------------------------------ helpers
  const cylAxis = (mat, x, y, z, r, len, axis, seg = 12) => {
    const geo = new THREE.CylinderGeometry(r, r, len, seg);
    const m = new THREE.Matrix4();
    if (axis === 'x') m.makeRotationZ(Math.PI / 2); else if (axis === 'z') m.makeRotationX(Math.PI / 2);
    m.setPosition(x, y, z);
    w.pushGeometry(mat, geo, m);
  };
  // local->world for small props facing rot (0:+z, 1:+x, 2:-z, 3:-x)
  const orient = (cx, cz, rot) => (lx, lz) => {
    switch (rot & 3) { case 0: return [cx + lx, cz + lz]; case 1: return [cx + lz, cz - lx]; case 2: return [cx - lx, cz - lz]; default: return [cx - lz, cz + lx]; }
  };
  const obox = (cx, cz, rot, lx, y0, lz, bw, h, bd, mat, opts = {}) => {
    const [x, z] = orient(cx, cz, rot)(lx, lz);
    const sw = rot & 1 ? bd : bw, sd = rot & 1 ? bw : bd;
    if (opts.deco) pb(mat, x, y0 + h / 2, z, sw, h, sd); else box(x, y0, z, sw, h, sd, mat, opts);
  };
  const line = (mat, x1, z1, x2, z2, wdt = 0.14) => {
    const alongX = Math.abs(z2 - z1) < 1e-6;
    if (alongX) pb(mat, (x1 + x2) / 2, 0.012, z1, Math.abs(x2 - x1), 0.02, wdt);
    else pb(mat, x1, 0.012, (z1 + z2) / 2, wdt, 0.02, Math.abs(z2 - z1));
  };
  const rectLines = (mat, x0, z0, x1, z1, wdt = 0.16) => { line(mat, x0, z0, x1, z0, wdt); line(mat, x0, z1, x1, z1, wdt); line(mat, x0, z0, x0, z1, wdt); line(mat, x1, z0, x1, z1, wdt); };
  const hatch = (x, z, s = 3) => { pb('lineR', x, 0.013, z, s, 0.02, s); pb('whFloor', x, 0.016, z, s - 0.5, 0.02, s - 0.5); };
  const sign = (idx, x, y, z, facing, wdt = 7) => {
    // facing: direction the sign's front looks (0:+z,1:+x,2:-z,3:-x)
    const geo = new THREE.PlaneGeometry(wdt, wdt / 2);
    const uv = geo.attributes.uv, u0 = (idx % 3) / 3, v1 = 1 - Math.floor(idx / 3) / 3;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 3, v1 - (1 - uv.getY(i)) / 3);
    const m = new THREE.Matrix4().makeRotationY([0, Math.PI / 2, Math.PI, -Math.PI / 2][facing]);
    m.setPosition(x, y, z);
    w.pushGeometry('whSigns', geo, m);
    const [bx, bz] = facing & 1 ? [0.2, wdt + 0.3] : [wdt + 0.3, 0.2];
    const off = [[0, -0.12], [-0.12, 0], [0, 0.12], [0.12, 0]][facing];
    pb('whSteel', x + off[0], y, z + off[1], bx, wdt / 2 + 0.3, bz);
  };
  const doorFrame = (x, z, alongX, wdt, h, y0 = 0, t = 0.5) => {
    const T = t + 0.12;
    if (alongX) { pb('redPaint', x - wdt / 2 - 0.12, y0 + h / 2, z, 0.24, h, T); pb('redPaint', x + wdt / 2 + 0.12, y0 + h / 2, z, 0.24, h, T); pb('redPaint', x, y0 + h + 0.12, z, wdt + 0.48, 0.24, T); }
    else { pb('redPaint', x, y0 + h / 2, z - wdt / 2 - 0.12, T, h, 0.24); pb('redPaint', x, y0 + h / 2, z + wdt / 2 + 0.12, T, h, 0.24); pb('redPaint', x, y0 + h + 0.12, z, T, 0.24, wdt + 0.48); }
  };
  const redRailing = (x1, z1, x2, z2, y0, h = 1.1) => {
    const alongX = Math.abs(z2 - z1) < 1e-6;
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const sx = Math.min(x1, x2), sz = Math.min(z1, z2);
    const posts = Math.max(2, Math.ceil(len / 2) + 1);
    for (let i = 0; i < posts; i++) {
      const o = (len * i) / (posts - 1);
      if (alongX) pb('rackRed', sx + o, y0 + h / 2, z1, 0.1, h, 0.1); else pb('rackRed', x1, y0 + h / 2, sz + o, 0.1, h, 0.1);
    }
    for (const yy of [h, h * 0.5]) {
      if (alongX) pb('rackRed', sx + len / 2, y0 + yy, z1, len, 0.08, 0.08); else pb('rackRed', x1, y0 + yy, sz + len / 2, 0.08, 0.08, len);
    }
    if (alongX) pb('rackRed', sx + len / 2, y0 + 0.08, z1, len, 0.16, 0.04); else pb('rackRed', x1, y0 + 0.08, sz + len / 2, 0.04, 0.16, len);
    if (alongX) w.col.addBox(sx, y0, z1 - 0.07, sx + len, y0 + h, z1 + 0.07); else w.col.addBox(x1 - 0.07, y0, sz, x1 + 0.07, y0 + h, sz + len);
  };
  /** Pallet with a load. kind: 0 totes (orange on grey), 1 wrapped white, 2 cardboard, 3 blue bins, 4 mixed */
  const palletLoad = (x, z, y0 = 0, kind = -1, alongX = true, col = true) => {
    if (kind < 0) kind = Math.floor(rng() * 5);
    const pw = alongX ? 1.25 : 1.05, pd = alongX ? 1.05 : 1.25;
    pb('wood', x, y0 + 0.08, z, pw, 0.15, pd);
    let top = y0 + 0.15;
    const lw = pw - 0.1, ld = pd - 0.1;
    if (kind === 0 || kind === 4) {
      const layers = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < layers; i++) {
        pb('greyPlastic', x, top + 0.11, z, lw, 0.22, ld);
        pb(kind === 4 && i ? 'boxBlue' : 'totes', x, top + 0.22 + 0.2, z, lw, 0.4, ld);
        top += 0.62;
      }
    } else if (kind === 1) { const h = 0.9 + rng() * 0.5; pb('boxWhite', x, top + h / 2, z, lw, h, ld); top += h; }
    else if (kind === 2) { const h = 0.7 + rng() * 0.6; pb('cardboard', x, top + h / 2, z, lw, h, ld); top += h; if (rng() < 0.5) { pb('cardboard', x + 0.1, top + 0.25, z - 0.05, lw * 0.6, 0.5, ld * 0.6); top += 0.5; } }
    else { const h = 0.75; pb('boxBlue', x, top + h / 2, z, lw, h, ld); top += h; }
    if (col) w.col.addBox(x - pw / 2, y0, z - pd / 2, x + pw / 2, top, z + pd / 2);
    return top;
  };
  const palletCluster = (x, z, n = 4) => {
    for (let i = 0; i < n; i++) {
      const px = x + (i % 2) * 1.35 - 0.67, pz = z + Math.floor(i / 2) * 1.2 - 0.6 * Math.floor((n - 1) / 2);
      palletLoad(px, pz, 0, -1, true);
    }
  };
  const drum = (x, z, mat = 'boxBlue') => { w.cyl(x, 0, z, 0.32, 0.95, mat, { seg: 12 }); pb('whSteel', x, 0.97, z, 0.4, 0.04, 0.4); };
  const drums = (x, z) => { const mats = ['boxBlue', 'redPaint', 'yellow']; for (let i = 0; i < 4; i++) drum(x + (i % 2) * 0.72, z + Math.floor(i / 2) * 0.72, mats[Math.floor(rng() * 3)]); };
  const jersey = (x, z, alongX = true) => {
    const [bw, bd] = alongX ? [3, 0.7] : [0.7, 3];
    pb('boxWhite', x, 0.25, z, bw, 0.5, bd); pb('boxWhite', x, 0.75, z, alongX ? bw : 0.42, 0.5, alongX ? 0.42 : bd);
    pb('redWhite', x, 0.75, z, alongX ? bw + 0.01 : 0.44, 0.3, alongX ? 0.44 : bd + 0.01);
    w.col.addBox(x - bw / 2, 0, z - bd / 2, x + bw / 2, 1.0, z + bd / 2);
  };
  const blackCase = (x, z, alongX = true) => {
    // heavy equipment case (the black "monitor" boxes in the walkthrough)
    const [bw, bd] = alongX ? [2.4, 1.3] : [1.3, 2.4];
    box(x, 0, z, bw, 1.6, bd, 'boxBlack');
    if (alongX) { pb('greyPlastic', x, 0.85, z + bd / 2 + 0.01, bw - 0.4, 1.1, 0.02); pb('greyPlastic', x, 0.85, z - bd / 2 - 0.01, bw - 0.4, 1.1, 0.02); }
    else { pb('greyPlastic', x + bw / 2 + 0.01, 0.85, z, 0.02, 1.1, bd - 0.4); pb('greyPlastic', x - bw / 2 - 0.01, 0.85, z, 0.02, 1.1, bd - 0.4); }
    pb('whSteel', x, 1.62, z, bw + 0.08, 0.06, bd + 0.08);
  };
  const forklift = (cx, cz, rot = 0) => {
    const B = (lx, y0, lz, bw, h, bd, mat) => obox(cx, cz, rot, lx, y0, lz, bw, h, bd, mat, { deco: true });
    B(0, 0.3, -0.15, 1.3, 0.85, 2.0, 'yellow');
    B(0, 0.3, -1.25, 1.32, 1.05, 0.45, 'whSteel');
    for (const lx of [-0.58, 0.58]) for (const lz of [-0.95, 0.4]) B(lx, 1.15, lz, 0.08, 1.15, 0.08, 'whSteel');
    B(0, 2.28, -0.28, 1.3, 0.08, 1.48, 'whSteel');
    B(0, 1.15, -0.55, 0.6, 0.35, 0.55, 'rubber');
    B(0, 1.15, 0.38, 0.5, 0.45, 0.12, 'rubber');
    for (const lx of [-0.36, 0.36]) B(lx, 0.12, 0.92, 0.12, 2.7, 0.14, 'whSteel');
    B(0, 2.7, 0.92, 0.84, 0.12, 0.14, 'whSteel');
    for (const lx of [-0.3, 0.3]) B(lx, 0.1, 1.55, 0.12, 0.06, 1.15, 'whSteel');
    B(0, 0.1, 0.98, 0.84, 0.6, 0.06, 'whSteel');
    { const [x, z] = orient(cx, cz, rot)(0, -0.28); pb('beacon', x, 2.4, z, 0.16, 0.12, 0.16); }
    for (const lx of [-0.66, 0.66]) for (const lz of [0.55, -0.95]) {
      const [x, z] = orient(cx, cz, rot)(lx, lz);
      cylAxis('rubber', x, 0.3, z, 0.3, 0.26, rot & 1 ? 'z' : 'x', 10);
    }
    const [x, z] = orient(cx, cz, rot)(0, -0.15);
    const sw = rot & 1 ? 2.7 : 1.4, sd = rot & 1 ? 1.4 : 2.7;
    w.col.addBox(x - sw / 2, 0, z - sd / 2, x + sw / 2, 2.35, z + sd / 2);
  };
  const container = (x, z, y0, alongX, mat, open = false, openDir = 1) => {
    const CL = 12.2, CW = 2.5, CH = 2.6;
    const [sw, sd] = alongX ? [CL, CW] : [CW, CL];
    if (!open) {
      box(x, y0, z, sw, CH, sd, mat);
      // end doors + corner posts
      for (const s of [-1, 1]) {
        if (alongX) { pb('whSteel', x + s * (CL / 2 + 0.01), y0 + CH / 2, z, 0.04, CH - 0.2, CW - 0.2); }
        else { pb('whSteel', x, y0 + CH / 2, z + s * (CL / 2 + 0.01), CW - 0.2, CH - 0.2, 0.04); }
      }
      return;
    }
    const t = 0.12;
    // floor, roof, sides, closed end; open end at openDir side
    box(x, y0, z, sw, 0.1, sd, mat);
    box(x, y0 + CH - t, z, sw, t, sd, mat);
    if (alongX) {
      box(x, y0, z - CW / 2 + t / 2, CL, CH, t, mat); box(x, y0, z + CW / 2 - t / 2, CL, CH, t, mat);
      box(x - openDir * (CL / 2 - t / 2), y0, z, t, CH, CW, mat);
      pb('whSteel', x + openDir * (CL / 2 + 0.6), y0 + CH / 2, z + CW / 2 + 0.6, 0.06, CH - 0.2, 1.2);
    } else {
      box(x - CW / 2 + t / 2, y0, z, t, CH, CL, mat); box(x + CW / 2 - t / 2, y0, z, t, CH, CL, mat);
      box(x, y0, z - openDir * (CL / 2 - t / 2), CW, CH, t, mat);
      pb('whSteel', x + CW / 2 + 0.6, y0 + CH / 2, z + openDir * (CL / 2 + 0.6), 1.2, CH - 0.2, 0.06);
    }
  };
  /** A pallet rack row along X from x0..x1 centred on z: red uprights, orange beams, grate decks, loads. */
  const rackRow = (x0, x1, z, levels = [2.6, 5.2, 7.8], loadChance = 0.78) => {
    const D = 2.4, bays = Math.max(1, Math.round((x1 - x0) / 4)), bw = (x1 - x0) / bays, top = levels[levels.length - 1];
    const mid = (x0 + x1) / 2, len = x1 - x0;
    for (let i = 0; i <= bays; i++) {
      const x = x0 + i * bw;
      for (const s of [-1, 1]) pb('rackRed', x, (top + 0.4) / 2, z + s * (D / 2 - 0.06), 0.12, top + 0.4, 0.12);
      // frame bracing between front and back uprights
      for (let y = 1.2; y < top; y += 3.2) pb('rackRed', x, y, z, 0.06, 0.06, D - 0.1);
      w.col.addBox(x - 0.08, 0, z - D / 2, x + 0.08, top + 0.4, z - D / 2 + 0.14);
      w.col.addBox(x - 0.08, 0, z + D / 2 - 0.14, x + 0.08, top + 0.4, z + D / 2);
    }
    for (const ly of levels) {
      for (const s of [-1, 1]) pb('rackOrange', mid, ly - 0.08, z + s * (D / 2 - 0.06), len, 0.16, 0.1);
      box(mid, ly - 0.03, z, len, 0.05, D - 0.2, 'whGrate');
    }
    // loads: floor + every level below the top deck
    const shelves = [0, ...levels.slice(0, -1)];
    for (let i = 0; i < bays; i++) {
      const bx = x0 + (i + 0.5) * bw;
      shelves.forEach((ly, li) => {
        for (const off of [-0.95, 0.95]) {
          if (rng() > loadChance) continue;
          // one pallet run spanning the rack depth: base + 1-2 load layers (cheap: 2-3 boxes)
          const kind = Math.floor(rng() * 5), x = bx + off, y0 = ly + 0.02;
          pb('wood', x, y0 + 0.07, z, 1.25, 0.14, 2.2);
          let top = y0 + 0.14;
          if (kind === 0 || kind === 4) {
            pb('totes', x, top + 0.3, z, 1.15, 0.6, 2.1); top += 0.6;
            if (rng() < 0.5) { pb(kind === 4 ? 'boxBlue' : 'totes', x, top + 0.3, z, 1.15, 0.6, 2.1); top += 0.6; }
          } else {
            const h = kind === 1 ? 0.9 + rng() * 0.5 : kind === 2 ? 0.7 + rng() * 0.6 : 0.75;
            pb(kind === 1 ? 'boxWhite' : kind === 2 ? 'cardboard' : 'boxBlue', x, top + h / 2, z, 1.15, h, 2.1); top += h;
          }
          w.col.addBox(x - 0.63, ly, z - 1.1, x + 0.63, top, z + 1.1);
        }
      });
    }
    // floor guide lines
    line('lineY', x0, z - D / 2 - 0.5, x1, z - D / 2 - 0.5, 0.1); line('lineY', x0, z + D / 2 + 0.5, x1, z + D / 2 + 0.5, 0.1);
  };
  const desk = (x, z, alongX = true) => {
    const [dw, dd] = alongX ? [2, 0.9] : [0.9, 2];
    box(x, 0, z, dw, 0.08, dd, 'whWallDark', { noCol: true });
    pb('whWallDark', x, 0.76, z, dw, 0.06, dd);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pb('whSteel', x + sx * (dw / 2 - 0.08), 0.38, z + sz * (dd / 2 - 0.08), 0.06, 0.74, 0.06);
    w.col.addBox(x - dw / 2, 0, z - dd / 2, x + dw / 2, 0.8, z + dd / 2);
  };
  const deskAt = (x, y0, z, alongX = true) => {
    const [dw, dd] = alongX ? [2, 0.9] : [0.9, 2];
    pb('whWallDark', x, y0 + 0.76, z, dw, 0.06, dd);
    pb('whSteel', x, y0 + 0.38, z, dw - 0.2, 0.7, dd - 0.3);
    w.col.addBox(x - dw / 2, y0, z - dd / 2, x + dw / 2, y0 + 0.8, z + dd / 2);
  };
  const lockers = (x, z, y0, alongX, n = 4) => {
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * 0.62;
      const [lx, lz] = alongX ? [x + o, z] : [x, z + o];
      pb('greyPlastic', lx, y0 + 1, lz, alongX ? 0.58 : 0.5, 2, alongX ? 0.5 : 0.58);
      pb('whSteel', lx, y0 + 1.6, lz + (alongX ? 0.26 : 0), alongX ? 0.4 : 0.02, 0.08, alongX ? 0.02 : 0.4);
    }
    const hw = n * 0.31;
    if (alongX) w.col.addBox(x - hw, y0, z - 0.25, x + hw, y0 + 2, z + 0.25); else w.col.addBox(x - 0.25, y0, z - hw, x + 0.25, y0 + 2, z + hw);
  };

  // ------------------------------------------------------------------ shell
  box(0, -1, 0, L * 2 + 8, 1, L * 2 + 8, 'whFloor', { noCol: true });
  // perimeter walls
  box(0, 0, -L - 1, L * 2 + 4, WALL_H, 2, 'whPanel');
  box(0, 0, L + 1, L * 2 + 4, WALL_H, 2, 'whPanel');
  box(-L - 1, 0, 0, 2, WALL_H, L * 2 + 4, 'whPanel');
  box(L + 1, 0, 0, 2, WALL_H, L * 2 + 4, 'whPanel');
  const bayW = 16, braceA = Math.atan2(8.5, bayW), braceLen = Math.hypot(8.5, bayW);
  for (const side of [0, 1, 2, 3]) {
    // side 0: north (z=-L), 1: south, 2: west (x=-L), 3: east
    const alongX = side < 2, sgn = side % 2 === 0 ? -1 : 1, face = sgn * (L - 0.3);
    const P = (a, y, w_, h, d) => alongX ? pb('whSteel', a, y, face, w_, h, d) : pb('whSteel', face, y, a, d, h, w_);
    for (let a = -L + bayW; a < L; a += bayW) {
      if (alongX) box(a, 0, face, 1.1, WALL_H, 0.6, 'whSteel'); else box(face, 0, a, 0.6, WALL_H, 1.1, 'whSteel');
    }
    for (const y of [8.5, 17]) P(0, y, L * 2, 0.4, 0.5);
    P(0, 0.75, L * 2, 1.5, 0.3); // dark kick band
    if (alongX) pb('whWallDark', 0, 0.75, sgn * (L - 0.05), L * 2, 1.5, 0.1); else pb('whWallDark', sgn * (L - 0.05), 0.75, 0, 0.1, 1.5, L * 2);
    if (alongX) pb('lineR', 0, 1.6, sgn * (L - 0.06), L * 2, 0.18, 0.1); else pb('lineR', sgn * (L - 0.06), 1.6, 0, 0.1, 0.18, L * 2);
    // clerestory windows
    if (alongX) pb('stripW', 0, 21.4, sgn * (L - 0.05), L * 2, 2.4, 0.05); else pb('stripW', sgn * (L - 0.05), 21.4, 0, 0.05, 2.4, L * 2);
    // X-bracing in alternating bays (lower and upper tier)
    let k = 0;
    for (let a = -L; a < L - 1; a += bayW, k++) {
      if (k % 2) continue;
      for (const [y0, dir] of [[0, 1], [8.5, -1], [0, -1], [8.5, 1]]) {
        const cy = y0 + 4.25, ca = a + bayW / 2;
        const rot = alongX ? new THREE.Euler(0, 0, dir * braceA) : new THREE.Euler(dir * braceA, 0, 0);
        if (alongX) pb('whSteel', ca, cy, face, braceLen, 0.22, 0.22, rot); else pb('whSteel', face, cy, ca, 0.22, 0.22, braceLen, rot);
      }
    }
  }
  // open truss roof (its own layer: hidden on the map, never collides)
  w.layer = 'roof';
  for (let z = -128; z <= 128; z += 32) {
    pb('whSteel', 0, ROOF_Y, z, L * 2, 0.4, 0.4);
    pb('whSteel', 0, ROOF_Y + 2.8, z, L * 2, 0.4, 0.4);
    const da = Math.atan2(2.8, 8), dl = Math.hypot(2.8, 8);
    for (let x = -L, i = 0; x < L; x += 8, i++) {
      pb('whSteel', x, ROOF_Y + 1.4, z, 0.2, 2.8, 0.2);
      pb('whSteel', x + 4, ROOF_Y + 1.4, z, dl, 0.18, 0.18, new THREE.Euler(0, 0, i % 2 ? da : -da));
    }
  }
  for (let x = -128; x <= 128; x += 32) pb('whSteel', x, ROOF_Y, 0, 0.4, 0.4, L * 2);
  for (let x = -L + 8; x < L; x += 8) pb('whSteel', x, ROOF_Y + 2.95, 0, 0.22, 0.3, L * 2);
  for (let x = -144; x <= 144; x += 32) for (let z = -144; z <= 144; z += 32) {
    pb('whSteel', x, ROOF_Y - 0.8, z, 0.8, 0.14, 6.4);
    pb('stripW', x, ROOF_Y - 0.9, z, 0.5, 0.06, 6);
    pb('whSteel', x, ROOF_Y - 0.4, z - 2.6, 0.04, 0.8, 0.04); pb('whSteel', x, ROOF_Y - 0.4, z + 2.6, 0.04, 0.8, 0.04);
  }
  w.layer = '';

  // ------------------------------------------------------------------ POI footprints (no columns there)
  reserve(-10, -8, 10, 8);              // dispatch office
  reserve(-20, -36, 20, -32); reserve(-20, 32, 20, 36);
  reserve(-46, -160, 46, -136);         // offices
  reserve(-52, 128, 52, 160);           // docks + trailers
  reserve(-152, -42, -64, 42);          // cold storage
  reserve(86, -132, 130, -92);          // red room building
  reserve(-150, 70, -64, 150);          // conveyor line
  reserve(-158, -152, -60, -64);        // high racks
  reserve(60, -50, 156, 50);            // containers

  // interior columns on a 32 m grid with hazard collars
  for (let gx = -128; gx <= 128; gx += 32) for (let gz = -128; gz <= 128; gz += 32) {
    if (inReserved(gx, gz, 2)) continue;
    box(gx, 0, gz, 1.1, ROOF_Y, 1.1, 'whSteel');
    box(gx, 0, gz, 1.7, 0.5, 1.7, 'whWallDark');
    pb('hazard', gx, 1.25, gz, 1.16, 1.4, 1.16);
  }

  // partition walls: a 3x3 grid of halls joined by wide doorways
  const partition = (fixed, alongX, gapsAt) => {
    const a0 = -L + 2, a1 = L - 2, gw = 11, gh = 7;
    const gaps = gapsAt.map(c => [c - gw / 2, c + gw / 2]).sort((p, q) => p[0] - q[0]);
    let cur = a0;
    const seg = (s0, s1, y0, y1) => {
      const len = s1 - s0, c = (s0 + s1) / 2; if (len <= 0.05) return;
      if (alongX) {
        box(c, y0, fixed, len, y1 - y0, 0.8, 'whWall');
        pb('whSteel', c, y1 + 0.06, fixed, len, 0.12, 0.9);
        if (y0 === 0) { pb('whWallDark', c, 0.7, fixed, len, 1.4, 0.86); pb('lineR', c, 1.5, fixed, len, 0.16, 0.88); }
      } else {
        box(fixed, y0, c, 0.8, y1 - y0, len, 'whWall');
        pb('whSteel', fixed, y1 + 0.06, c, 0.9, 0.12, len);
        if (y0 === 0) { pb('whWallDark', fixed, 0.7, c, 0.86, 1.4, len); pb('lineR', fixed, 1.5, c, 0.88, 0.16, len); }
      }
    };
    for (const [g0, g1] of gaps) {
      seg(cur, g0, 0, PART_H); seg(g0, g1, gh, PART_H);
      // yellow/black door posts
      for (const e of [g0, g1]) if (alongX) pb('hazard', e, gh / 2, fixed, 0.3, gh, 0.9); else pb('hazard', fixed, gh / 2, e, 0.9, gh, 0.3);
      cur = g1;
    }
    seg(cur, a1, 0, PART_H);
    for (let a = -L + 16; a < L; a += 16) {
      if (gaps.some(([g0, g1]) => a > g0 - 1 && a < g1 + 1)) continue;
      if (alongX) pb('whSteel', a, PART_H / 2, fixed, 0.5, PART_H + 0.1, 1.0); else pb('whSteel', fixed, PART_H / 2, a, 1.0, PART_H + 0.1, 0.5);
    }
  };
  const doorways = [-134, -94, -26, 26, 94, 134];
  partition(-56, false, doorways); partition(56, false, doorways);
  partition(-56, true, doorways); partition(56, true, doorways);

  // ------------------------------------------------------------------ A: Dispatch (centre)
  {
    const cx = 0, cz = 0, Y = 4.6;
    w.pois.push({ name: 'Dispatch', x: cx, z: cz, r: 40 });
    box(cx, Y - 0.4, cz, 16, 0.4, 12, 'whGrate');
    for (const sx of [-7.6, 0, 7.6]) for (const sz of [-5.6, 5.6]) box(cx + sx, 0, cz + sz, 0.5, Y - 0.4, 0.5, 'whSteel');
    // lower walls with doors west/east, glass above, roof
    w.wall(cx - 8, cz - 6, cx + 8, cz - 6, 1.05, 0.25, 'whWall', [], Y);
    w.wall(cx - 8, cz + 6, cx + 8, cz + 6, 1.05, 0.25, 'whWall', [], Y);
    w.wall(cx - 8, cz - 6, cx - 8, cz + 6, 1.05, 0.25, 'whWall', [{ at: 6, w: 2.2, h: 3 }], Y);
    w.wall(cx + 8, cz - 6, cx + 8, cz + 6, 1.05, 0.25, 'whWall', [{ at: 6, w: 2.2, h: 3 }], Y);
    for (const sz of [-6, 6]) { pb('glass', cx, Y + 2, cz + sz, 15.6, 1.9, 0.06); w.col.addBox(cx - 8, Y, cz + sz - 0.12, cx + 8, Y + 3, cz + sz + 0.12); }
    for (const sx of [-8, 8]) for (const [z0, z1] of [[-6, -1.1], [1.1, 6]]) {
      pb('glass', cx + sx, Y + 2, cz + (z0 + z1) / 2, 0.06, 1.9, z1 - z0); w.col.addBox(cx + sx - 0.12, Y, cz + z0, cx + sx + 0.12, Y + 3, cz + z1);
    }
    for (const sx of [-8, 0, 8]) for (const sz of [-6, 6]) pb('whSteel', cx + sx, Y + 1.6, cz + sz, 0.2, 3.2, 0.2);
    box(cx, Y + 3.1, cz, 16.8, 0.35, 12.8, 'whSteel');
    pb('stripW', cx, Y + 3.08, cz, 10, 0.04, 0.5);
    w.stairs(cx - 13.2, cz, 2.2, 10, Y, '+x', 'whGrate'); w.stairs(cx + 13.2, cz, 2.2, 10, Y, '-x', 'whGrate');
    deskAt(cx - 3, Y, cz - 4.6); deskAt(cx + 3, Y, cz - 4.6); deskAt(cx, Y, cz + 4.4);
    w.monitor(cx - 3, cz - 4.9, 0, Y - 0.4); w.monitor(cx + 3, cz - 4.9, 0, Y - 0.4);
    w.chest(cx + 4, Y, cz + 2); w.loot(cx - 4, Y, cz + 2); w.ammo(cx, Y, cz);
    // beneath + around
    w.chest(cx, 0, cz, Math.PI / 2); palletLoad(cx - 4, cz + 3); palletLoad(cx + 4, cz - 3);
    rectLines('lineY', cx - 30, cz - 30, cx + 30, cz + 30, 0.25);
    for (const [hx, hz] of [[-22, -22], [22, 22], [-22, 22], [22, -22]]) hatch(cx + hx, cz + hz, 3.2);
    forklift(cx - 20, cz - 12, 1); forklift(cx + 21, cz + 14, 3); forklift(cx + 8, cz - 22, 0);
    palletCluster(cx - 16, cz + 18, 4); palletCluster(cx + 17, cz - 17, 4); palletCluster(cx - 26, cz + 2, 2); palletCluster(cx + 26, cz - 2, 2);
    rackRow(cx - 18, cx + 18, cz - 34, [2.6, 5.2], 0.7); rackRow(cx - 18, cx + 18, cz + 34, [2.6, 5.2], 0.7);
    jersey(cx - 10, cz + 24, true); jersey(cx + 12, cz - 26, true); jersey(cx + 28, cz + 22, false); jersey(cx - 28, cz - 20, false);
    blackCase(cx - 12, cz - 20, true); blackCase(cx + 14, cz + 26, false);
    w.chest(cx - 24, 0, cz + 20); w.chest(cx + 24, 0, cz - 21, Math.PI); w.chest(cx, 5.2, cz - 34); w.chest(cx - 30, 0, cz - 4);
    [[-14, 6], [14, -6], [-8, -16], [10, 18], [20, 4], [-20, -4]].forEach(([x, z]) => w.loot(cx + x, 0, cz + z));
    w.ammo(cx - 18, 0, cz - 26); w.ammo(cx + 18, 0, cz + 26); w.ammo(cx + 30, 0, cz + 8);
    sign(0, cx, Y + 5.2, cz - 6.6, 2, 6); sign(0, cx, Y + 5.2, cz + 6.6, 0, 6);
  }

  // ------------------------------------------------------------------ B: High Racks (NW)
  {
    const cx = -108, cz = -108;
    w.pois.push({ name: 'High Racks', x: cx, z: cz, r: 46 });
    const rows = [-146, -134, -122, -110, -98, -86, -74];
    rows.forEach((z, i) => {
      rackRow(-154, -114, z); rackRow(-102, -62, z);
      if (i % 2 === 0) { w.chest(-108, 0, z + 6); } else w.ammo(-108, 0, z + 6);
      w.chest(i % 2 ? -150 : -66, 7.8, z);
      w.loot(-130 + (i % 3) * 12, 0, z + 5.5);
    });
    // order picker cart + floor markings in the cross aisle
    forklift(-108, -128, 0); forklift(-108, -80, 2);
    for (let z = -150; z <= -66; z += 6) pb('lineW', -108, 0.012, z, 3.5, 0.02, 0.4);
    sign(1, -108, 12, -L + 0.9, 0, 9);
  }

  // ------------------------------------------------------------------ C: Offices (N)
  {
    const cz0 = -159, cz1 = -142, x0 = -44, x1 = 44, FY = 4.4, RY = 8.6;
    w.pois.push({ name: 'Offices', x: 0, z: -112, r: 44 });
    const rooms = [-38.5, -27.5, -16.5, -5.5, 5.5, 16.5, 27.5, 38.5];
    // shell
    w.wall(x0, cz0, x1, cz0, RY, 0.4, 'roomWall');
    w.wall(x0, cz0, x0, cz1, RY, 0.5, 'roomWall'); w.wall(x1, cz0, x1, cz1, RY, 0.5, 'roomWall');
    w.wall(x0, cz1, x1, cz1, FY, 0.5, 'roomWall', rooms.map(r => ({ at: r - x0, w: 2.2, h: 3 })).concat(rooms.filter((_, i) => i % 2).map(r => ({ at: r - x0 + 3, w: 2.6, h: 2.6, sill: 1.1 }))));
    w.wall(x0, cz1, x1, cz1, RY - FY, 0.5, 'roomWall', rooms.map(r => ({ at: r - x0, w: 2.2, h: 3 })).concat(rooms.map(r => ({ at: r - x0 + 3, w: 2.4, h: 2.4, sill: 1.1 }))), FY);
    for (const r of rooms) { doorFrame(r, cz1, true, 2.2, 3, 0); doorFrame(r, cz1, true, 2.2, 3, FY); }
    box(0, FY - 0.4, (cz0 + cz1) / 2, x1 - x0, 0.4, cz1 - cz0, 'whWall');
    box(0, RY, (cz0 + cz1) / 2, x1 - x0 + 1, 0.4, cz1 - cz0 + 1, 'whWallDark');
    for (let x = -33; x <= 33; x += 11) { w.wall(x, cz0, x, cz1, FY - 0.4, 0.3, 'roomWall'); w.wall(x, cz0, x, cz1, RY - FY, 0.3, 'roomWall', [], FY); }
    // catwalk, stairs, railings
    box(0, FY - 0.4, -140, 100, 0.4, 4, 'whGrate');
    for (let x = -46; x <= 46; x += 10) box(x, 0, -138.3, 0.3, FY - 0.4, 0.3, 'whSteel');
    redRailing(-46.2, -138.1, 46.2, -138.1, FY);
    redRailing(-50, -142, -50, -138.1, FY); redRailing(50, -142, 50, -138.1, FY);
    w.stairs(-48.2, -133, 2.6, 10, FY, '-z', 'whGrate'); w.stairs(48.2, -133, 2.6, 10, FY, '-z', 'whGrate');
    // interiors
    rooms.forEach((r, i) => {
      deskAt(r - 2, 0, cz0 + 4, true); deskAt(r + 2, FY, cz0 + 4, true);
      lockers(r + 3.6, cz0 + 1, 0, true, 3); lockers(r - 3.4, cz0 + 1, FY, true, 3);
      if (i % 2) w.chest(r + 2, 0, cz0 + 8); else w.chest(r - 2, FY, cz0 + 8);
      w.loot(r, i % 2 ? FY : 0, cz0 + 11);
      pb('stripW', r, FY - 0.42, (cz0 + cz1) / 2, 4, 0.04, 0.4); pb('stripW', r, RY - 0.02, (cz0 + cz1) / 2, 4, 0.04, 0.4);
    });
    w.ammo(-20, FY, -140); w.ammo(20, FY, -140);
    sign(2, 0, RY + 2.2, cz1 + 0.5, 0, 8);
    // open floor in front: cubicles + pallets
    const cubicle = (x, z) => {
      for (const [a, b, c, d] of [[x - 3, z - 3, x + 3, z - 3], [x - 3, z - 3, x - 3, z + 3]]) w.wall(a, b, c, d, 1.5, 0.12, 'greyPlastic');
      w.wall(x + 3, z - 3, x + 3, z + 1, 1.5, 0.12, 'greyPlastic');
      desk(x - 1.6, z - 2.2, true); desk(x + 1.8, z + 1.4, false);
    };
    cubicle(-30, -118); cubicle(-18, -118); cubicle(18, -118); cubicle(30, -118);
    cubicle(-30, -100); cubicle(30, -100);
    palletCluster(-6, -96, 4); palletCluster(8, -110, 2); forklift(0, -122, 1);
    blackCase(-42, -76, true); blackCase(42, -80, false); jersey(-12, -72, true); jersey(14, -70, true);
    w.chest(-24, 0, -108); w.chest(24, 0, -108, Math.PI); w.chest(0, 0, -88);
    [[-30, -112], [30, -112], [-10, -100], [12, -96], [-38, -90], [38, -92]].forEach(([x, z]) => w.loot(x, 0, z));
    w.ammo(-18, 0, -92); w.ammo(18, 0, -124);
  }

  // ------------------------------------------------------------------ D: Loading Docks (S)
  {
    const DH = 1.3, z0 = 144, z1 = L;
    w.pois.push({ name: 'Loading Docks', x: 0, z: 112, r: 44 });
    box(0, 0, (z0 + z1) / 2, 100, DH, z1 - z0, 'whWall');
    pb('rubber', 0, DH - 0.05, z0 + 0.3, 100, 0.08, 0.6);
    for (const sx of [-50, 50]) pb('hazard', sx, DH / 2, (z0 + z1) / 2, 0.06, DH, z1 - z0);
    pb('hazard', 0, DH / 2, z0 - 0.02, 100, DH, 0.05);
    w.stairs(-40, z0 - 3, 5, 6, DH, '+z', 'whWall'); w.stairs(40, z0 - 3, 5, 6, DH, '+z', 'whWall');
    const doors = [-44, -33, -22, -11, 0, 11, 22, 33, 44];
    doors.forEach((x, i) => {
      pb('whPanel', x, DH + 2.6, L - 0.35, 5, 5.2, 0.1);
      for (let y = DH + 0.4; y < DH + 5.2; y += 0.55) pb('whSteel', x, y, L - 0.42, 5, 0.05, 0.05);
      pb('yellow', x - 2.65, DH + 2.6, L - 0.4, 0.3, 5.4, 0.3); pb('yellow', x + 2.65, DH + 2.6, L - 0.4, 0.3, 5.4, 0.3);
      pb('beacon', x + 3.2, DH + 5.7, L - 0.5, 0.3, 0.3, 0.2);
      box(x - 1.8, DH, z0 + 0.1, 0.5, 0.6, 0.3, 'rubber'); box(x + 1.8, DH, z0 + 0.1, 0.5, 0.6, 0.3, 'rubber');
      if (i % 3 === 1) palletLoad(x, z0 + 6, DH); else if (i % 3 === 2) palletLoad(x - 1, z0 + 9, DH);
    });
    // trailers backed onto the dock (bed level = dock level, open towards the dock)
    for (const [x, open] of [[-33, true], [-11, false], [11, true], [33, true]]) {
      const TL = 13, tz = z0 - TL / 2 - 0.05, TW = 2.8, TH = 3.3, bed = DH - 0.05;
      const mat = open ? 'whWall' : 'cont3';
      box(x, bed - 0.15, tz, TW, 0.15, TL, 'whSteel');
      box(x - TW / 2 + 0.06, bed, tz, 0.12, TH, TL, mat); box(x + TW / 2 - 0.06, bed, tz, 0.12, TH, TL, mat);
      box(x, bed + TH - 0.1, tz, TW, 0.12, TL, mat);
      box(x, bed, tz - TL / 2 + 0.06, TW, TH, 0.12, mat);
      if (!open) box(x, bed, tz + TL / 2 - 0.06, TW, TH, 0.12, 'whSteel');
      pb('redWhite', x, bed - 0.35, tz + TL / 2 - 0.1, TW, 0.25, 0.1);
      for (const az of [tz + 3.4, tz + 4.7]) for (const sx of [-1, 1]) cylAxis('rubber', x + sx * 1.05, 0.5, az, 0.5, 0.5, 'x', 12);
      box(x, 0, tz + 4.05, 1.6, bed - 0.15, 2.4, 'whSteel');
      for (const sx of [-0.9, 0.9]) box(x + sx, 0, tz - 4.5, 0.2, bed - 0.15, 0.2, 'whSteel');
      if (open) { w.chest(x, bed, tz + 1); palletLoad(x, tz - 3, bed, 0, false); }
    }
    // dock floor
    palletLoad(-46, 152, DH, 2); palletLoad(46, 152, DH, 1);
    w.chest(-22, DH, 154); w.chest(22, DH, 154, Math.PI); w.chest(0, DH, 150);
    [[-38, 150], [-5, 156], [28, 150], [44, 156]].forEach(([x, z]) => w.loot(x, DH, z));
    w.ammo(-14, DH, 156); w.ammo(14, DH, 150);
    // yard in front of the docks
    for (const x of [-44, -22, 0, 22, 44]) { w.cyl(x, 0, 128, 0.25, 1.1, 'yellow', { seg: 10 }); }
    container(-40, 100, 0, true, 'cont1'); container(-40, 100, 2.6, true, 'cont2'); container(28, 92, 0, true, 'cont4', true, 1);
    w.chest(30, 0, 92, -Math.PI / 2);
    palletCluster(-6, 104, 4); palletCluster(10, 84, 2); forklift(-14, 116, 1); forklift(16, 112, 3);
    jersey(-40, 80, true); jersey(40, 74, true); jersey(0, 72, true); drums(-46, 112); drums(42, 104);
    for (let x = -50; x <= 50; x += 4) pb('lineY', x, 0.012, 136, 0.12, 0.02, 6);
    w.chest(-44, 0, 96); w.chest(44, 0, 118, Math.PI);
    [[-20, 84], [6, 96], [20, 124], [-34, 120]].forEach(([x, z]) => w.loot(x, 0, z));
    w.ammo(0, 0, 88); w.ammo(-24, 0, 126);
    sign(3, 0, 9.5, L - 0.9, 2, 10);
  }

  // ------------------------------------------------------------------ E: Cold Storage (W)
  {
    const x0 = -150, x1 = -66, z0 = -40, z1 = 40, H = 6, cx = -108, cz = 0;
    w.pois.push({ name: 'Cold Storage', x: cx, z: cz, r: 44 });
    const len = x1 - x0, dep = z1 - z0;
    w.wall(x0, z0, x1, z0, H, 0.6, 'coldWall', [{ at: cx - x0, w: 6, h: 4.5 }]);
    w.wall(x0, z1, x1, z1, H, 0.6, 'coldWall', [{ at: cx - x0, w: 6, h: 4.5 }]);
    w.wall(x0, z0, x0, z1, H, 0.6, 'coldWall', [{ at: dep / 2, w: 6, h: 4.5 }]);
    w.wall(x1, z0, x1, z1, H, 0.6, 'coldWall', [{ at: dep / 2, w: 6, h: 4.5 }]);
    box(cx, H, cz, len + 0.6, 0.5, dep + 0.6, 'whWallDark');
    box(cx, 0, cz, len, 0.04, dep, 'ice', { noCol: true });
    const doorsX = [-140, -121, -95, -76];
    for (const zz of [-3, 3]) w.wall(x0, zz, x1, zz, H, 0.4, 'coldWall', [{ at: cx - x0, w: 6, h: H }, ...doorsX.map(d => ({ at: d - x0, w: 2.4, h: 3 }))]);
    for (const xx of [-111, -105]) w.wall(xx, z0, xx, z1, H, 0.4, 'coldWall', [{ at: dep / 2, w: 6, h: H }, { at: 20 - 1, w: 2.4, h: 3 }, { at: dep - 19, w: 2.4, h: 3 }]);
    for (const [xx, za, zb, dz] of [[-130.5, z0, -3, -21], [-130.5, 3, z1, 21], [-85.5, z0, -3, -21], [-85.5, 3, z1, 21]]) w.wall(xx, za, xx, zb, H, 0.4, 'coldWall', [{ at: dz - za, w: 2.4, h: 3 }]);
    for (const d of doorsX) { doorFrame(d, -3, true, 2.4, 3, 0, 0.4); doorFrame(d, 3, true, 2.4, 3, 0, 0.4); }
    // corridor lights: white ceiling strips, blue floor strips
    pb('stripW', cx, H - 0.03, 0, len - 2, 0.04, 0.6); pb('stripW', cx - 3, H - 0.03, cz, 0.6, 0.04, dep - 2);
    for (const zz of [-2.6, 2.6]) pb('stripBlue', cx, 0.05, zz, len - 2, 0.04, 0.14);
    for (const xx of [-110.6, -105.4]) pb('stripBlue', xx, 0.05, cz, 0.14, 0.04, dep - 2);
    // room contents
    const roomCentres = [[-140.2, -21.5], [-120.7, -21.5], [-95.2, -21.5], [-75.7, -21.5], [-140.2, 21.5], [-120.7, 21.5], [-95.2, 21.5], [-75.7, 21.5]];
    roomCentres.forEach(([rx, rz], i) => {
      pb('stripW', rx, H - 0.03, rz, 6, 0.04, 0.6);
      const sz = rz < 0 ? -1 : 1;
      rackRow(rx - 7, rx + 7, rz + sz * 12, [2.2, 4.4], 0.85);
      if (i % 3 !== 2) palletLoad(rx - 5, rz - sz * 6, 0, 1); palletLoad(rx + 5, rz, 0, 1);
      if (i !== 3 && i !== 6) w.chest(rx + (i % 2 ? -3 : 3), 0, rz - sz * 4, 0); else w.ammo(rx, 0, rz - sz * 4);
      w.loot(rx, 0, rz + sz * 4);
    });
    w.chest(cx, 0, cz, 0); w.ammo(-140, 0, 0); w.ammo(-76, 0, 0);
    // outside
    palletCluster(-140, -50, 4); palletCluster(-80, 50, 4); jersey(-108, -50, true); jersey(-108, 50, true);
    drums(-156, -48); blackCase(-60.5, -36, false); blackCase(-60.5, 36, false);
    w.chest(-152, 0, 48); w.loot(-130, 0, -48); w.loot(-86, 0, 48);
    sign(4, cx + 15, H + 2.4, z1 + 0.4, 0, 8); sign(4, cx - 15, H + 2.4, z0 - 0.4, 2, 8);
  }

  // ------------------------------------------------------------------ F: Containers (E)
  {
    const cx = 108, cz = 0;
    w.pois.push({ name: 'Container Stacks', x: cx, z: cz, r: 46 });
    const mats = ['cont1', 'cont2', 'cont3', 'cont4'];
    const rows = [-46, -43.4, -30, -27.4, -14, 12, 26, 28.6, 42, 44.6];
    const xs = [68.5, 82, 95.5, 120.5, 134, 147.5];
    rows.forEach((z, ri) => xs.forEach((x, xi) => {
      const r = rng();
      if (r < 0.12) return;
      const n = r < 0.45 ? 1 : r < 0.82 ? 2 : 3;
      for (let k = 0; k < n; k++) container(x, z, k * 2.6, true, mats[Math.floor(rng() * 4)]);
      if ((ri + xi) % 4 === 0) w.chest(x + 2, n * 2.6, z);
      else if ((ri + xi) % 5 === 1) w.loot(x - 2, n * 2.6, z);
    }));
    // open containers around the plaza, doors facing it
    for (const [x, z, dir] of [[90, 1, 1], [126, -1, -1], [108, 22, 1]]) {
      container(x, z, 0, false, mats[Math.floor(rng() * 4)], true, dir);
      w.chest(x, 0, z + dir * 1.5, dir > 0 ? 0 : Math.PI);
    }
    // stairs up onto a 2-high stack + gantry crane over the plaza
    container(108, -36, 0, false, 'cont3'); container(108, -36, 2.6, false, 'cont1');
    w.stairs(108, -24.5, 2.4, 10.6, 5.2, '-z', 'whGrate');
    w.chest(108, 5.2, -38);
    for (const gx of [90, 126]) for (const gz of [-9, 9]) box(gx, 0, gz, 1.2, 16, 1.2, 'yellow');
    for (const gz of [-9, 9]) box(108, 16, gz, 37.2, 1.4, 1.2, 'yellow');
    for (const gx of [90, 126]) box(gx, 16, 0, 1.2, 1.4, 18, 'yellow');
    box(108, 17.4, 0, 4, 1.6, 19.6, 'yellow'); box(108, 15.2, 6, 2.4, 2.2, 2.4, 'boxBlack', { noCol: true });
    pb('whSteel', 106.6, 13.5, 0, 0.06, 6, 0.06); pb('whSteel', 109.4, 13.5, 0, 0.06, 6, 0.06);
    box(108, 10.2, 0, 3, 0.4, 12.4, 'yellow', { noCol: true });
    pb('beacon', 108, 19.4, 0, 0.5, 0.3, 0.5);
    w.chest(108, 17.4 + 1.6, -6); w.ammo(108, 0, 4); w.loot(102, 0, -4); w.loot(114, 0, 4);
    for (let x = 62; x <= 156; x += 6) pb('lineY', x, 0.012, 0, 3, 0.02, 0.14);
    sign(5, L - 0.9, 12, 0, 3, 9);
  }

  // ------------------------------------------------------------------ G: The Red Room (NE)
  {
    const cx = 108, cz = -112, W = 40, D = 36, FY = 4.5, RY = 9;
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
    w.pois.push({ name: 'The Red Room', x: cx, z: cz, r: 38 });
    const UH = RY - FY;
    w.wall(x0, z0, x1, z0, FY, 0.5, 'roomWall', [{ at: 10, w: 2.4, h: 3 }, { at: 30, w: 3, h: 2.4, sill: 1 }]);
    w.wall(x0, z0, x1, z0, UH, 0.5, 'roomWall', [{ at: 30, w: 3, h: 2.6, sill: 1 }, { at: 16, w: 3, h: 2.6, sill: 1 }], FY);
    w.wall(x0, z1, x1, z1, FY, 0.5, 'roomWall', [{ at: 8, w: 2.4, h: 3 }, { at: 26, w: 2.4, h: 3 }]);
    w.wall(x0, z1, x1, z1, UH, 0.5, 'roomWall', [{ at: 16, w: 4, h: 2.6, sill: 1 }], FY);
    w.wall(x0, z0, x0, z1, FY, 0.5, 'roomWall', [{ at: 18, w: 2.4, h: 3 }]);
    w.wall(x0, z0, x0, z1, UH, 0.5, 'roomWall', [{ at: 8, w: 3, h: 2.6, sill: 1 }, { at: 26, w: 3, h: 2.6, sill: 1 }], FY);
    w.wall(x1, z0, x1, z1, FY, 0.5, 'roomWall', [{ at: 24, w: 2.4, h: 3 }]);
    w.wall(x1, z0, x1, z1, UH, 0.5, 'roomWall', [], FY);
    doorFrame(x0 + 10, z0, true, 2.4, 3); doorFrame(x0 + 8, z1, true, 2.4, 3); doorFrame(x0 + 26, z1, true, 2.4, 3);
    doorFrame(x0, z0 + 18, false, 2.4, 3); doorFrame(x1, z0 + 24, false, 2.4, 3);
    box(cx, RY, cz, W + 0.8, 0.45, D + 0.8, 'whWallDark');
    // the red room: red walls, red carpet, lounge + screen
    const rx0 = cx - 9, rx1 = cx + 7, rz0 = cz - 8, rz1 = cz + 6;
    box((rx0 + rx1) / 2, 0, (rz0 + rz1) / 2, rx1 - rx0, 0.05, rz1 - rz0, 'carpet', { noCol: true });
    w.wall(rx0, rz0, rx1, rz0, FY - 0.4, 0.35, 'redPaint', [{ at: 8, w: 2.4, h: 3 }]);
    w.wall(rx0, rz1, rx1, rz1, FY - 0.4, 0.35, 'redPaint', [{ at: 4, w: 2.4, h: 3 }]);
    w.wall(rx0, rz0, rx0, rz1, FY - 0.4, 0.35, 'redPaint');
    w.wall(rx1, rz0, rx1, rz1, FY - 0.4, 0.35, 'redPaint', [{ at: 7, w: 2.4, h: 3 }]);
    for (const [sx, sz, a] of [[rx0 + 1.2, (rz0 + rz1) / 2, false], [(rx0 + rx1) / 2, rz1 - 1.2, true]]) {
      const [bw, bd] = a ? [5, 1] : [1, 5];
      box(sx, 0, sz, bw, 0.5, bd, 'carpet'); pb('redPaint', sx + (a ? 0 : -0.35), 0.85, sz + (a ? 0.35 : 0), a ? bw : 0.3, 0.7, a ? 0.3 : bd);
    }
    w.monitor(rx1 - 0.6, rz0 + 3, -Math.PI / 2, 0, true);
    pb('stripRed', (rx0 + rx1) / 2, FY - 0.46, (rz0 + rz1) / 2, rx1 - rx0 - 1, 0.04, 0.3);
    w.chest((rx0 + rx1) / 2, 0, (rz0 + rz1) / 2); w.loot(rx0 + 3, 0, rz0 + 2);
    // red stairwell up to the loft
    const sx = x1 - 3, sz0 = z1 - 4, sz1 = sz0 - 11;
    w.stairs(sx, (sz0 + sz1) / 2, 3, 11, FY, '-z', 'carpet');
    w.wall(sx - 1.7, sz1, sx - 1.7, sz0, FY, 0.3, 'redPaint');
    // loft floor with the stairwell opening
    box(cx - 3, FY - 0.4, cz, W - 6, 0.4, D, 'whWall');
    box(x1 - 3, FY - 0.4, (z0 + sz1) / 2, 6, 0.4, sz1 - z0, 'whWall');
    box(x1 - 3, FY - 0.4, (sz0 + z1) / 2, 6, 0.4, z1 - sz0, 'whWall');
    redRailing(sx - 1.6, sz1, sx - 1.6, sz0, FY);
    for (let x = x0 + 4; x < x1 - 6; x += 8) pb('stripW', x, FY - 0.42, cz, 3, 0.04, 0.4);
    for (let x = x0 + 4; x < x1; x += 8) pb('stripW', x, RY - 0.02, cz, 3, 0.04, 0.4);
    // loft contents
    lockers(x0 + 6, z0 + 0.6, FY, true, 6); lockers(x0 + 0.6, cz + 6, FY, false, 5);
    palletLoad(cx - 4, cz - 10, FY, 0); palletLoad(cx + 4, cz + 8, FY, 2); deskAt(cx - 10, FY, cz + 10);
    w.chest(cx + 2, FY, cz - 4); w.chest(x0 + 4, FY, z1 - 4, Math.PI); w.loot(cx - 6, FY, cz + 2); w.ammo(cx + 10, FY, cz - 12);
    // ground floor outside the red room
    lockers(x0 + 0.6, z0 + 6, 0, false, 5); deskAt(x0 + 5, 0, z1 - 4); blackCase(cx + 10, z0 + 3, true);
    w.chest(x0 + 6, 0, z0 + 3, 0); w.ammo(cx + 2, 0, z1 - 3);
    sign(6, cx, RY + 1.9, z1 + 0.3, 0, 7);
    // surroundings: generators, racks, drums
    blackCase(72, -154, true); blackCase(78, -154, true); blackCase(144, -70, false); blackCase(150, -76, false);
    rackRow(72, 100, -148, [2.6, 5.2]); rackRow(122, 150, -148, [2.6, 5.2]);
    drums(140, -86); drums(66, -72); palletCluster(80, -76, 4); forklift(140, -112, 0); jersey(70, -100, false);
    w.chest(66, 0, -120); w.chest(152, 0, -100, Math.PI); w.chest(136, 5.2, -148);
    w.loot(80, 0, -88); w.loot(146, 0, -128); w.ammo(70, 0, -84);
  }

  // ------------------------------------------------------------------ H: Conveyor Line (SW)
  {
    const cx = -108, cz = 110;
    w.pois.push({ name: 'Conveyor Line', x: cx, z: cz, r: 46 });
    const conveyor = (xa, xb, z, y0 = 0, legs = true) => {
      const len = xb - xa, mx = (xa + xb) / 2, top = y0 + 1.0;
      box(mx, top - 0.35, z, len, 0.3, 1.5, 'whSteel', { noCol: true });
      pb('rubber', mx, top - 0.02, z, len, 0.06, 1.2);
      for (const s of [-1, 1]) pb('yellow', mx, top + 0.1, z + s * 0.72, len, 0.18, 0.08);
      if (legs) for (let x = xa + 1; x < xb; x += 3) { pb('whSteel', x, (top - 0.35) / 2, z - 0.6, 0.1, top - 0.35, 0.1); pb('whSteel', x, (top - 0.35) / 2, z + 0.6, 0.1, top - 0.35, 0.1); }
      for (let x = xa + 2; x < xb - 1; x += 5 + rng() * 4) { const s = 0.5 + rng() * 0.5; pb('cardboard', x, top + s / 2, z + (rng() - 0.5) * 0.4, s * 1.2, s, s); }
      w.col.addBox(xa, y0, z - 0.8, xb, top + 0.2, z + 0.8);
    };
    for (const z of [78, 96, 124, 142]) { conveyor(-150, -116, z); conveyor(-100, -66, z); }
    // sorter in the middle, belts feed into it
    box(cx, 0, cz, 12, 6, 9, 'boxBlack');
    pb('greyPlastic', cx, 3, cz + 4.52, 9, 4, 0.05); pb('greyPlastic', cx, 3, cz - 4.52, 9, 4, 0.05);
    for (const s of [-1, 1]) { pb('stripRed', cx + s * 3, 5.3, cz + 4.56, 2.2, 0.3, 0.04); pb('stripRed', cx - s * 3, 5.3, cz - 4.56, 2.2, 0.3, 0.04); }
    w.monitor(cx - 7.6, cz + 5.6, 0, 0, true); w.monitor(cx + 7.6, cz - 5.6, Math.PI, 0, false);
    box(cx, 6, cz, 8, 0.3, 6, 'whGrate');
    w.stairs(cx + 10.5, cz + 3.2, 2.2, 9, 6, '-x', 'whGrate');
    redRailing(cx - 4, cz - 3, cx + 4, cz - 3, 6.3); redRailing(cx - 4, cz + 3, cx + 4, cz + 3, 6.3); redRailing(cx - 4, cz - 3, cx - 4, cz + 3, 6.3);
    w.chest(cx, 6.3, cz); w.ammo(cx - 2, 6.3, cz + 1.5);
    conveyor(-126, -114, cz); conveyor(-102, -90, cz);
    // elevated cross belt on stilts + scanner arches
    const ey = 4.2;
    box(-132, ey + 0.65, 110, 1.6, 0.3, 64, 'whSteel');
    pb('rubber', -132, ey + 1.0, 110, 1.2, 0.06, 64);
    for (let z = 80; z <= 140; z += 6) { pb('whSteel', -132.6, (ey + 0.65) / 2, z, 0.14, ey + 0.65, 0.14); pb('whSteel', -131.4, (ey + 0.65) / 2, z, 0.14, ey + 0.65, 0.14); }
    for (const s of [-1, 1]) pb('yellow', -132 + s * 0.75, ey + 1.1, 110, 0.08, 0.2, 64);
    for (const [ax, az] of [[-140, 78], [-76, 96], [-140, 124], [-76, 142]]) {
      pb('whSteel', ax, 1.6, az - 1.1, 0.2, 3.2, 0.2); pb('whSteel', ax, 1.6, az + 1.1, 0.2, 3.2, 0.2); pb('whSteel', ax, 3.25, az, 0.3, 0.3, 2.5);
      pb('stripRed', ax, 3.05, az, 0.32, 0.08, 2.1);
    }
    // parcel heaps
    for (const [hx, hz] of [[-146, 88], [-72, 132], [-90, 86], [-126, 134]]) {
      for (let i = 0; i < 7; i++) { const s = 0.5 + rng() * 0.6; box(hx + (rng() - 0.5) * 3, 0, hz + (rng() - 0.5) * 3, s * 1.2, s, s, 'cardboard', { noCol: i > 2 }); }
    }
    w.chest(-150, 0, 104); w.chest(-66, 0, 118, Math.PI); w.chest(-132, ey + 1.05, 96); w.chest(-118, 0, 70);
    [[-140, 108], [-84, 108], [-120, 88], [-96, 132], [-150, 150], [-66, 72]].forEach(([x, z]) => w.loot(x, 0, z));
    w.ammo(-108, 0, 86); w.ammo(-108, 0, 136);
    sign(7, -L + 0.9, 12, 110, 1, 9);
  }

  // ------------------------------------------------------------------ I: Forklift Bay (SE)
  {
    const cx = 108, cz = 108;
    w.pois.push({ name: 'Forklift Bay', x: cx, z: cz, r: 42 });
    for (let i = 0; i < 7; i++) {
      const x = 76 + i * 6;
      for (const [z, rot] of [[86, 0], [104, 2]]) {
        rectLines('lineY', x - 2.4, z - 3.2, x + 2.4, z + 3.2, 0.12);
        if (rng() < 0.7) forklift(x, z, rot);
        else palletLoad(x, z, 0);
      }
      // charging posts behind the bays
      box(x, 0, 80.6, 0.8, 1.7, 0.5, 'whSteel'); pb('greenLed', x, 1.45, 80.9, 0.4, 0.12, 0.03);
    }
    for (const [tx, tz] of [[136, 124], [140, 126], [138, 140], [80, 140]]) for (let k = 0; k < 4; k++) w.cyl(tx, k * 0.32, tz, 0.55, 0.3, 'rubber', { seg: 14 });
    // maintenance shed
    const mx = 124, mz = 136;
    w.wall(mx - 7, mz - 5, mx + 7, mz - 5, 3.4, 0.3, 'roomWall', [{ at: 5, w: 2.4, h: 2.8 }, { at: 11, w: 2.6, h: 1.4, sill: 1.1 }]);
    w.wall(mx - 7, mz + 5, mx + 7, mz + 5, 3.4, 0.3, 'roomWall');
    w.wall(mx - 7, mz - 5, mx - 7, mz + 5, 3.4, 0.3, 'roomWall', [{ at: 5, w: 2.4, h: 2.8 }]);
    w.wall(mx + 7, mz - 5, mx + 7, mz + 5, 3.4, 0.3, 'roomWall');
    doorFrame(mx - 2, mz - 5, true, 2.4, 2.8, 0, 0.3); doorFrame(mx - 7, mz, false, 2.4, 2.8, 0, 0.3);
    box(mx, 3.4, mz, 14.6, 0.3, 10.6, 'whWallDark');
    deskAt(mx + 3, 0, mz + 3.6); lockers(mx + 6.4, mz - 1, 0, false, 4); drums(mx - 5, mz + 2.5);
    w.chest(mx, 0, mz); w.ammo(mx + 3, 0, mz - 2);
    palletCluster(150, 90, 4); palletCluster(70, 126, 2); jersey(100, 122, true); jersey(146, 108, false); blackCase(110, 150, true);
    rackRow(66, 98, 152, [2.6, 5.2]);
    w.chest(70, 0, 114); w.chest(150, 0, 140, Math.PI); w.chest(108, 0, 95); w.chest(90, 5.2, 152);
    [[84, 95], [128, 95], [110, 126], [150, 70], [66, 66]].forEach(([x, z]) => w.loot(x, 0, z));
    w.ammo(118, 0, 114); w.ammo(76, 0, 70);
    sign(8, L - 0.9, 12, 108, 3, 9);
  }

  // ------------------------------------------------------------------ scatter (fills the halls between POIs)
  {
    const r = seeded(777);
    let placed = 0;
    for (let tries = 0; tries < 2200 && placed < 120; tries++) {
      const x = (r() - 0.5) * (L * 2 - 20), z = (r() - 0.5) * (L * 2 - 20);
      if (inReserved(x, z, 6)) continue;
      if (Math.abs(Math.abs(x) - 56) < 5 || Math.abs(Math.abs(z) - 56) < 5) continue;   // keep doorways/partitions clear
      if (!w.col.isFree(x, 0, z, 3.4, 3)) continue;
      const k = r();
      if (k < 0.3) palletCluster(x, z, 1 + Math.floor(r() * 4));
      else if (k < 0.45) jersey(x, z, r() < 0.5);
      else if (k < 0.57) blackCase(x, z, r() < 0.5);
      else if (k < 0.67) drums(x, z);
      else if (k < 0.77) forklift(x, z, Math.floor(r() * 4));
      else if (k < 0.87) { for (let i = 0; i < 3; i++) palletLoad(x + i * 1.35, z, 0, 0); }
      else hatch(x, z, 3);
      placed++;
      if (r() < 0.4) w.loot(x + 2.6, 0, z + 2.6);
      else if (r() < 0.22) w.chest(x + 2.6, 0, z - 2.6);
      else if (r() < 0.3) w.ammo(x - 2.6, 0, z);
    }
  }

  // ------------------------------------------------------------------ main aisle floor markings
  for (const c of [-56, 56]) {
    line('lineY', -L + 4, c - 7, L - 4, c - 7, 0.22); line('lineY', -L + 4, c + 7, L - 4, c + 7, 0.22);
    line('lineY', c - 7, -L + 4, c - 7, L - 4, 0.22); line('lineY', c + 7, -L + 4, c + 7, L - 4, 0.22);
  }
  for (let a = -L + 6; a < L - 4; a += 5) for (const c of [-56, 56]) { pb('lineW', a, 0.012, c - 9.5, 2.2, 0.02, 0.18); pb('lineW', c - 9.5, 0.012, a, 0.18, 0.02, 2.2); }
}

/** Per-frame animation for the warehouse (beacons pulse). Call after finalize. */
export function animateWarehouse(w) {
  const b = w.mats.beacon && w.mats.beacon.mat;
  if (b) w.animated.push(t => { const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * 5.5)); b.color.setRGB(1 * k + 0.05, 0.55 * k + 0.04, 0.12 * k); });
}
