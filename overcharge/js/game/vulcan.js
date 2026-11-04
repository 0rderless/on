// VULCAN GARRISON — a sci-fi fortress deck floating over a pale plain at night. Dark grated decking,
// pale blue-white armour modules with dark slits and blue light strips, white X-braced truss frames,
// orange hazard decks and a molten forge (the Vulcan Core) under a blue-lit spire.
import * as THREE from 'three';
import { MAP_HALF } from '../config.js';

const L = MAP_HALF;

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function tex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function addMaterials(w) {
  const T = w.T, low = w.quality === 'low';
  const std = (o) => low
    ? new THREE.MeshLambertMaterial({ color: o.color, map: o.map || null, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: o.depthWrite ?? true, emissive: o.emissive ?? 0 })
    : new THREE.MeshStandardMaterial({ color: o.color, map: o.map || null, roughness: o.roughness ?? 0.85, metalness: o.metalness ?? 0, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: o.depthWrite ?? true, emissive: o.emissive ?? 0 });
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
  const M = (key, mat, uv = 'world', scale = 4, shadow = true) => { w.mats[key] = { mat, uv, scale, shadow }; };
  // deck grating: fine grid + panel seams
  const grid = tex(256, 256, (x, W) => {
    x.fillStyle = '#4b546c'; x.fillRect(0, 0, W, W);
    x.strokeStyle = '#2c3244'; x.lineWidth = 3;
    for (let i = 0; i <= W; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, W); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    x.strokeStyle = '#1d2230'; x.lineWidth = 6; x.strokeRect(0, 0, W, W);
    x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 400; i++) x.fillRect(Math.random() * W, Math.random() * W, 2, 2);
  });
  const hazard = tex(128, 128, (x, W) => {
    x.fillStyle = '#f0761e'; x.fillRect(0, 0, W, W);
    x.fillStyle = '#16191f';
    for (let i = -4; i < 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 16 + W, W); x.lineTo(i * 32 + W, W); x.closePath(); x.fill(); }
  });
  const panel = tex(256, 256, (x, W) => {
    x.fillStyle = '#d9e2f2'; x.fillRect(0, 0, W, W);
    x.fillStyle = 'rgba(30,40,70,0.08)'; for (let i = 0; i < 6; i++) x.fillRect(0, i * 44 + 10, W, 2);
    x.fillStyle = 'rgba(30,40,70,0.12)'; x.fillRect(W / 2 - 1, 0, 2, W);
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, 0, W, 3);
  });
  M('vgDeck', std({ color: 0xffffff, map: grid, roughness: 0.6, metalness: 0.45 }), 'world', 4);
  M('vgDeckLight', std({ color: 0x7c88a6, map: T.plate, roughness: 0.5, metalness: 0.55 }), 'world', 1.6);
  M('vgPanel', std({ color: 0xffffff, map: panel, roughness: 0.42, metalness: 0.15 }), 'world', 6);
  M('vgPanelB', std({ color: 0xaab8d4, map: T.concrete, roughness: 0.5, metalness: 0.15 }), 'world', 4);
  M('vgSlit', std({ color: 0x1b2234, roughness: 0.5, metalness: 0.5 }), 'world', 2);
  M('vgSteel', std({ color: 0x252c3f, roughness: 0.48, metalness: 0.65 }), 'world', 2);
  M('vgTruss', std({ color: 0xdde3f0, roughness: 0.4, metalness: 0.35 }), 'world', 2);
  M('vgOrange', std({ color: 0xf0761e, roughness: 0.5, metalness: 0.2 }), 'world', 2);
  M('vgHazard', std({ color: 0xffffff, map: hazard, roughness: 0.6 }), 'world', 2);
  M('vgTank', std({ color: 0xe4e9f2, map: T.concrete, roughness: 0.3, metalness: 0.25 }), 'world', 8);
  M('vgCrateA', std({ color: 0xe56a1f, map: T.crate, roughness: 0.55 }), 'unit', 1);
  M('vgCrateB', std({ color: 0x2c3a5c, map: T.crate, roughness: 0.5, metalness: 0.3 }), 'unit', 1);
  M('vgGround', std({ color: 0xa3acbf, map: T.concrete, roughness: 1 }), 'world', 60);
  M('vgGlass', std({ color: 0x8fe8c4, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3, depthWrite: false }), 'unit', 1, false);
  M('vgBlue', basic(0x58c8ff), 'unit', 1, false);
  M('vgBlueDim', basic(0x2f78c8), 'unit', 1, false);
  M('vgWhiteGlow', basic(0xeaf4ff), 'unit', 1, false);
  M('vgOrangeGlow', basic(0xff8a22), 'unit', 1, false);
  M('vgRedGlow', basic(0xff3b3b), 'unit', 1, false);
  M('vgCore', basic(0xff6a10), 'world', 4, false);
  M('vgBeam', new THREE.MeshBasicMaterial({ map: w.mats.beam.mat.map, color: 0x2a9ad8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), 'unit', 1, false);
  M('vgBeamOrange', new THREE.MeshBasicMaterial({ map: w.mats.beam.mat.map, color: 0xd8601a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), 'unit', 1, false);
}

export function buildVulcan(w) {
  addMaterials(w);
  const rng = seeded(2077);
  const box = (...a) => w.box(...a), pb = (...a) => w.pushBox(...a);
  const reserved = [];
  const reserve = (x0, z0, x1, z1) => reserved.push([x0, z0, x1, z1]);
  const inReserved = (x, z, pad = 0) => reserved.some(([a, b, c, d]) => x > a - pad && x < c + pad && z > b - pad && z < d + pad);

  // ------------------------------------------------------------------ helpers
  const line = (mat, x1, z1, x2, z2, wdt = 0.2, y = 0.012) => {
    if (Math.abs(z2 - z1) < 1e-6) pb(mat, (x1 + x2) / 2, y, z1, Math.abs(x2 - x1), 0.02, wdt);
    else pb(mat, x1, y, (z1 + z2) / 2, wdt, 0.02, Math.abs(z2 - z1));
  };
  const hazardPad = (x, z, sx, sz) => { pb('vgHazard', x, 0.012, z, sx, 0.02, sz); pb('vgDeckLight', x, 0.016, z, sx - 1, 0.02, sz - 1); };
  const railing = (x1, z1, x2, z2, y0, h = 1.1) => {
    const alongX = Math.abs(z2 - z1) < 1e-6;
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const sx = Math.min(x1, x2), sz = Math.min(z1, z2);
    const posts = Math.max(2, Math.ceil(len / 2.4) + 1);
    for (let i = 0; i < posts; i++) {
      const o = (len * i) / (posts - 1);
      if (alongX) pb('vgSteel', sx + o, y0 + h / 2, z1, 0.1, h, 0.1); else pb('vgSteel', x1, y0 + h / 2, sz + o, 0.1, h, 0.1);
    }
    if (alongX) { pb('vgTruss', sx + len / 2, y0 + h, z1, len, 0.08, 0.08); pb('vgBlueDim', sx + len / 2, y0 + h * 0.55, z1, len, 0.05, 0.05); }
    else { pb('vgTruss', x1, y0 + h, sz + len / 2, 0.08, 0.08, len); pb('vgBlueDim', x1, y0 + h * 0.55, sz + len / 2, 0.05, 0.05, len); }
    if (alongX) w.col.addBox(sx, y0, z1 - 0.07, sx + len, y0 + h, z1 + 0.07); else w.col.addBox(x1 - 0.07, y0, sz, x1 + 0.07, y0 + h, sz + len);
  };
  const cylAxis = (mat, x, y, z, r, len, axis, seg = 12) => {
    const geo = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
    const m = new THREE.Matrix4();
    if (axis === 'x') m.makeRotationZ(Math.PI / 2); else if (axis === 'z') m.makeRotationX(Math.PI / 2);
    m.setPosition(x, y, z);
    w.pushGeometry(mat, geo, m);
  };
  const ring = (mat, x, y, z, r, tube = 0.12, seg = 40) => {
    const geo = new THREE.TorusGeometry(r, tube, 4, seg);
    w.pushGeometry(mat, geo, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, y, z));
  };
  /** Armoured module: pale panels, vertical dark slits, chamfered corners, a blue strip under the cap. */
  const pod = (x, z, pw, pd, h, opts = {}) => {
    const t = 0.45;
    if (opts.hollow) {
      const x0 = x - pw / 2, x1 = x + pw / 2, z0 = z - pd / 2, z1 = z + pd / 2, dw = opts.doorW || 2.4;
      const gapsX = (side) => opts.doors && opts.doors.includes(side) ? [{ at: pw / 2, w: dw, h: 3 }] : [];
      const gapsZ = (side) => opts.doors && opts.doors.includes(side) ? [{ at: pd / 2, w: dw, h: 3 }] : [];
      w.wall(x0, z0, x1, z0, h, t, 'vgPanel', gapsX('n')); w.wall(x0, z1, x1, z1, h, t, 'vgPanel', gapsX('s'));
      w.wall(x0, z0, x0, z1, h, t, 'vgPanel', gapsZ('w')); w.wall(x1, z0, x1, z1, h, t, 'vgPanel', gapsZ('e'));
      box(x, h, z, pw + 0.3, 0.45, pd + 0.3, 'vgPanelB');
      pb('vgWhiteGlow', x, h - 0.04, z, Math.min(pw, pd) * 0.5, 0.04, 0.4);
      for (const side of opts.doors || []) {
        const [dx, dz, ax] = side === 'n' ? [0, -pd / 2, true] : side === 's' ? [0, pd / 2, true] : side === 'w' ? [-pw / 2, 0, false] : [pw / 2, 0, false];
        if (ax) { pb('vgTruss', x + dx - dw / 2 - 0.15, 1.5, z + dz, 0.3, 3, t + 0.14); pb('vgTruss', x + dx + dw / 2 + 0.15, 1.5, z + dz, 0.3, 3, t + 0.14); pb('vgTruss', x + dx, 3.12, z + dz, dw + 0.6, 0.25, t + 0.14); pb('vgBlue', x + dx, 3.3, z + dz, dw, 0.06, t + 0.16); }
        else { pb('vgTruss', x + dx, 1.5, z + dz - dw / 2 - 0.15, t + 0.14, 3, 0.3); pb('vgTruss', x + dx, 1.5, z + dz + dw / 2 + 0.15, t + 0.14, 3, 0.3); pb('vgTruss', x + dx, 3.12, z + dz, t + 0.14, 0.25, dw + 0.6); pb('vgBlue', x + dx, 3.3, z + dz, t + 0.16, 0.06, dw); }
      }
    } else {
      box(x, 0, z, pw, h, pd, 'vgPanel');
      box(x, h, z, pw - 0.5, 0.35, pd - 0.5, 'vgPanelB');
    }
    // slits on the long faces + corner chamfers + light strip
    const slitsAlongX = Math.max(1, Math.floor(pw / 2.2)), slitsAlongZ = Math.max(1, Math.floor(pd / 2.2));
    for (let i = 0; i < slitsAlongX; i++) {
      const sx = x - pw / 2 + (i + 0.5) * pw / slitsAlongX;
      if (opts.hollow && Math.abs(sx - x) < 2) continue;
      pb('vgSlit', sx, h * 0.5, z - pd / 2 - 0.02, 0.18, h * 0.6, 0.05); pb('vgSlit', sx, h * 0.5, z + pd / 2 + 0.02, 0.18, h * 0.6, 0.05);
    }
    for (let i = 0; i < slitsAlongZ; i++) {
      const sz = z - pd / 2 + (i + 0.5) * pd / slitsAlongZ;
      if (opts.hollow && Math.abs(sz - z) < 2) continue;
      pb('vgSlit', x - pw / 2 - 0.02, h * 0.5, sz, 0.05, h * 0.6, 0.18); pb('vgSlit', x + pw / 2 + 0.02, h * 0.5, sz, 0.05, h * 0.6, 0.18);
    }
    const rot = new THREE.Euler(0, Math.PI / 4, 0);
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pb('vgPanelB', x + cx * pw / 2, h / 2, z + cz * pd / 2, 0.8, h, 0.8, rot);
    pb('vgBlue', x, h - 0.35, z - pd / 2 - 0.03, pw * 0.92, 0.12, 0.04); pb('vgBlue', x, h - 0.35, z + pd / 2 + 0.03, pw * 0.92, 0.12, 0.04);
    pb('vgBlue', x - pw / 2 - 0.03, h - 0.35, z, 0.04, 0.12, pd * 0.92); pb('vgBlue', x + pw / 2 + 0.03, h - 0.35, z, 0.04, 0.12, pd * 0.92);
  };
  /** Dark steel frame with white X-bracing on its sides and an open braced roof (the video's truss canopies). */
  const trussFrame = (x0, z0, x1, z1, h, roof = true) => {
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(px, 0, pz, 0.7, h, 0.7, 'vgSteel');
    const sides = [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]];
    for (const [a, b, c, d] of sides) {
      const alongX = b === d, len = alongX ? c - a : d - b;
      const n = Math.max(1, Math.round(len / 6)), seg = len / n;
      if (alongX) pb('vgSteel', (a + c) / 2, h, b, len, 0.5, 0.5); else pb('vgSteel', a, h, (b + d) / 2, 0.5, 0.5, len);
      for (let i = 0; i < n; i++) {
        const mid = (alongX ? a : b) + (i + 0.5) * seg, diag = Math.hypot(seg, h * 0.45), ang = Math.atan2(h * 0.45, seg);
        for (const dir of [1, -1]) {
          const rot = alongX ? new THREE.Euler(0, 0, dir * ang) : new THREE.Euler(dir * ang, 0, 0);
          if (alongX) pb('vgTruss', mid, h * 0.775, b, diag, 0.14, 0.14, rot); else pb('vgTruss', a, h * 0.775, mid, 0.14, 0.14, diag, rot);
        }
        if (alongX) pb('vgSteel', (alongX ? a : b) + i * seg, h * 0.55, b, 0.3, 0.3, 0.3);
      }
      if (alongX) pb('vgSteel', (a + c) / 2, h * 0.55, b, len, 0.3, 0.3); else pb('vgSteel', a, h * 0.55, (b + d) / 2, 0.3, 0.3, len);
    }
    if (roof) {
      w.layer = 'roof';
      const n = Math.max(1, Math.round((x1 - x0) / 7));
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; pb('vgSteel', x, h + 0.3, (z0 + z1) / 2, 0.35, 0.35, z1 - z0); }
      for (let i = 0; i < n; i++) {
        const xa = x0 + (x1 - x0) * i / n, xb = x0 + (x1 - x0) * (i + 1) / n, len = Math.hypot(xb - xa, z1 - z0), ang = Math.atan2(z1 - z0, xb - xa);
        pb('vgTruss', (xa + xb) / 2, h + 0.45, (z0 + z1) / 2, len, 0.12, 0.12, new THREE.Euler(0, ang, 0));
        pb('vgTruss', (xa + xb) / 2, h + 0.45, (z0 + z1) / 2, len, 0.12, 0.12, new THREE.Euler(0, -ang, 0));
      }
      w.layer = '';
    }
  };
  const crate = (x, z, s = 1.5, y0 = 0, kind = null) => {
    const mat = kind || (rng() < 0.55 ? 'vgCrateA' : 'vgCrateB');
    box(x, y0, z, s, s, s, mat);
    pb('vgTruss', x, y0 + s + 0.01, z, s * 0.9, 0.04, 0.14); pb('vgTruss', x, y0 + s + 0.01, z, 0.14, 0.04, s * 0.9);
  };
  const crates = (x, z, n = 3) => {
    const s = 1.5;
    crate(x, z, s); if (n > 1) crate(x + s * 1.05, z, s); if (n > 2) crate(x + s * 0.5, z, s * 0.95, s); if (n > 3) crate(x, z + s * 1.05, s);
  };
  const barrier = (x, z, alongX = true) => {
    const [bw, bd] = alongX ? [3.4, 0.8] : [0.8, 3.4];
    pb('vgPanelB', x, 0.3, z, bw, 0.6, bd); pb('vgPanel', x, 0.85, z, alongX ? bw : 0.5, 0.55, alongX ? 0.5 : bd);
    pb('vgBlue', x, 0.9, z, alongX ? bw + 0.01 : 0.52, 0.08, alongX ? 0.52 : bd + 0.01);
    w.col.addBox(x - bw / 2, 0, z - bd / 2, x + bw / 2, 1.12, z + bd / 2);
  };
  const lightPylon = (x, z, h = 12) => {
    box(x, 0, z, 1.2, h, 1.2, 'vgSteel');
    pb('vgBlue', x + 0.61, h * 0.55, z, 0.04, h * 0.8, 0.3); pb('vgBlue', x - 0.61, h * 0.55, z, 0.04, h * 0.8, 0.3);
    pb('vgBlue', x, h * 0.55, z + 0.61, 0.3, h * 0.8, 0.04); pb('vgBlue', x, h * 0.55, z - 0.61, 0.3, h * 0.8, 0.04);
    pb('vgWhiteGlow', x, h + 0.1, z, 0.8, 0.2, 0.8);
  };
  const tank = (x, z, r = 5, h = 12) => {
    w.cyl(x, 0, z, r, h, 'vgTank', { seg: 24 });
    w.cyl(x, 0, z, r + 0.08, 0.8, 'vgSteel', { seg: 24, noCol: true });
    for (const y of [h * 0.35, h * 0.72]) w.cyl(x, y, z, r + 0.06, 0.5, 'vgBlueDim', { seg: 24, noCol: true });
    w.cyl(x, h, z, r - 0.4, 0.12, 'vgDeckLight', { seg: 24, noCol: true });
    ring('vgBlue', x, h + 0.1, z, r - 0.5, 0.06, 32);
    for (let i = 0; i < 5; i++) pb('vgSteel', x + r + 0.15, 1 + i * (h - 2) / 4, z, 0.1, 0.08, 0.8);
    pb('vgSteel', x + r + 0.15, h / 2, z - 0.4, 0.08, h, 0.08); pb('vgSteel', x + r + 0.15, h / 2, z + 0.4, 0.08, h, 0.08);
  };
  const dropship = (x, z, rot = 0, y0 = 0) => {
    // hull along local +z (nose); rot 0 = nose +z, 1 = nose +x
    const R = (lx, lz) => rot ? [x + lz, z - lx] : [x + lx, z + lz];
    const B = (lx, ly, lz, bw, bh, bd, mat, e = null) => {
      const [px, pz] = R(lx, lz);
      const [sw, sd] = rot ? [bd, bw] : [bw, bd];
      pb(mat, px, y0 + ly, pz, sw, bh, sd, e ? new THREE.Euler(e[0], e[1] + (rot ? Math.PI / 2 : 0), e[2]) : null);
    };
    B(0, 1.9, 0, 4.2, 2.4, 10, 'vgPanel');
    B(0, 3.2, 0.5, 3.2, 0.5, 8, 'vgPanelB');
    B(0, 1.7, 6.0, 3.0, 1.8, 2.6, 'vgPanel', [0.35, 0, 0]);
    B(0, 2.4, 5.0, 2.2, 0.8, 1.6, 'vgGlass', [-0.3, 0, 0]);
    for (const s of [-1, 1]) {
      B(s * 4.2, 2.2, -1, 4.6, 0.25, 4.5, 'vgPanelB', [0, 0, s * -0.12]);
      B(s * 6.3, 2.75, -2.2, 0.25, 1.4, 2.2, 'vgSteel');
      B(s * 1.6, 1.6, -5.4, 1.2, 1.2, 1.4, 'vgSteel');
      B(s * 1.6, 1.6, -6.15, 0.9, 0.9, 0.1, 'vgBlue');
      B(s * 2.12, 1.9, 0, 0.05, 0.14, 9, 'vgBlue');
      B(s * 1.4, 0.35, 2.5, 0.3, 0.7, 0.3, 'vgSteel'); B(s * 1.4, 0.35, -3, 0.3, 0.7, 0.3, 'vgSteel');
    }
    B(0, 0.6, -4.6, 2.6, 0.12, 2.2, 'vgDeckLight', [0.35, 0, 0]);
    const [cx, cz] = R(0, 0);
    const [hw, hd] = rot ? [5, 2.1] : [2.1, 5];
    w.col.addBox(cx - hw, y0 + 0.7, cz - hd, cx + hw, y0 + 3.45, cz + hd);
  };
  const turret = (x, z, y0, face = 0) => {
    w.cyl(x, y0, z, 1.3, 1.0, 'vgSteel', { seg: 16 });
    const g = new THREE.Group(); g.position.set(x, y0 + 1.0, z);
    const mats = w.mats;
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 2.4), mats.vgPanel.mat); head.position.y = 0.7; g.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.05), mats.vgRedGlow.mat); visor.position.set(0, 0.9, 1.22); g.add(visor);
    for (const s of [-0.45, 0.45]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.6, 8), mats.vgSteel.mat); b.rotation.x = Math.PI / 2; b.position.set(s, 0.55, 2.3); g.add(b); }
    g.rotation.y = face;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    w.group.add(g);
    const base = face, ph = rng() * 6;
    w.animated.push(t => { g.rotation.y = base + Math.sin(t * 0.35 + ph) * 0.9; });
    w.col.addBox(x - 1.2, y0, z - 1.2, x + 1.2, y0 + 2.4, z + 1.2);
  };
  const stairsWithRails = (x, z, wd, len, h, dir, mat = 'vgDeckLight') => w.stairs(x, z, wd, len, h, dir, mat);

  // ------------------------------------------------------------------ the deck, its edge and the world below
  box(0, -1, 0, L * 2 + 8, 1, L * 2 + 8, 'vgDeck', { noCol: true });
  // skirt under the deck edge + edge lights + railings + invisible barrier
  box(0, -14, -L - 2, L * 2 + 8, 13.5, 4, 'vgSteel', { noCol: true });
  box(0, -14, L + 2, L * 2 + 8, 13.5, 4, 'vgSteel', { noCol: true });
  box(-L - 2, -14, 0, 4, 13.5, L * 2 + 8, 'vgSteel', { noCol: true });
  box(L + 2, -14, 0, 4, 13.5, L * 2 + 8, 'vgSteel', { noCol: true });
  for (const s of [-1, 1]) {
    pb('vgBlue', 0, -0.6, s * (L + 4.02), L * 2 + 8, 0.25, 0.05); pb('vgBlue', s * (L + 4.02), -0.6, 0, 0.05, 0.25, L * 2 + 8);
    pb('vgOrangeGlow', 0, -6, s * (L + 4.02), L * 2 + 8, 0.15, 0.05); pb('vgOrangeGlow', s * (L + 4.02), -6, 0, 0.05, 0.15, L * 2 + 8);
    pb('vgHazard', 0, 0.015, s * (L - 1.2), L * 2, 0.02, 1.6); pb('vgHazard', s * (L - 1.2), 0.015, 0, 1.6, 0.02, L * 2);
  }
  railing(-L + 0.3, -L + 0.3, L - 0.3, -L + 0.3, 0, 1.3); railing(-L + 0.3, L - 0.3, L - 0.3, L - 0.3, 0, 1.3);
  railing(-L + 0.3, -L + 0.3, -L + 0.3, L - 0.3, 0, 1.3); railing(L - 0.3, -L + 0.3, L - 0.3, L - 0.3, 0, 1.3);
  for (const s of [-1, 1]) { w.col.addBox(-L - 4, 0, s > 0 ? L : -L - 4, L + 4, 80, s > 0 ? L + 4 : -L); w.col.addBox(s > 0 ? L : -L - 4, 0, -L - 4, s > 0 ? L + 4 : -L, 80, L + 4); }
  // support pylons down to the plain + the plain itself (decor only, far below)
  for (const [px, pz] of [[-L, -L], [L, -L], [-L, L], [L, L], [0, -L], [0, L], [-L, 0], [L, 0]]) {
    const geo = new THREE.CylinderGeometry(6, 10, 56, 8);
    w.pushGeometry('vgSteel', geo, new THREE.Matrix4().makeTranslation(px * 0.96, -42, pz * 0.96));
    pb('vgBlue', px * 0.96, -20, pz * 0.96, 12.4, 0.4, 12.4);
  }
  w.pushBox('vgGround', 0, -71, 0, 1800, 2, 1800);

  // night sky dressing: stars + moon (roof layer → hidden on the map render)
  w.layer = 'roof';
  {
    const n = 1400, pos = new Float32Array(n * 3);
    const r = seeded(31);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, e = 0.12 + r() * 1.35, R = 620;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * R; pos[i * 3 + 1] = Math.sin(e) * R; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * R;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
    stars.frustumCulled = false; stars.renderOrder = -5; w.roof.add(stars);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(26, 24, 16), new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false, toneMapped: false }));
    moon.position.set(-360, 280, -470); w.roof.add(moon);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), new THREE.MeshBasicMaterial({ color: 0x6f86c8, transparent: true, opacity: 0.18, fog: false, depthWrite: false, toneMapped: false }));
    halo.position.copy(moon.position); w.roof.add(halo);
  }
  w.layer = '';

  // main avenues (open lanes with orange edges and blue floor lights)
  for (const s of [-1, 1]) {
    line('vgOrange', -L + 4, s * 10, L - 4, s * 10, 0.3); line('vgOrange', s * 10, -L + 4, s * 10, L - 4, 0.3);
  }
  for (let a = -L + 8; a < L - 6; a += 8) { pb('vgBlue', a, 0.013, 0, 2.2, 0.02, 0.18); pb('vgBlue', 0, 0.013, a, 0.18, 0.02, 2.2); }

  // POI footprints kept clear of scatter
  reserve(-30, -30, 30, 30);
  reserve(-38, -146, 38, -92);
  reserve(84, -134, 126, -88);
  reserve(88, -36, 156, 36);
  reserve(82, 86, 146, 122);
  reserve(-40, 96, 40, 146);
  reserve(-130, 80, -78, 128);
  reserve(-150, -50, -100, 50);
  reserve(-150, -150, -58, -60);

  // ------------------------------------------------------------------ A: Vulcan Core (centre)
  {
    w.pois.push({ name: 'Vulcan Core', x: 0, z: 0, r: 30 });
    w.cyl(0, 0, 0, 16, 0.5, 'vgDeckLight', { seg: 40 });
    w.cyl(0, 0.5, 0, 12, 0.5, 'vgSteel', { seg: 40 });
    ring('vgOrangeGlow', 0, 0.52, 0, 15.6, 0.1, 64); ring('vgBlue', 0, 1.02, 0, 11.7, 0.08, 56);
    w.cyl(0, 1, 0, 4.2, 7.2, 'vgSteel', { seg: 24 });
    w.cyl(0, 3, 0, 4.26, 2.6, 'vgCore', { seg: 24, noCol: true });
    w.cyl(0, 8.2, 0, 4.7, 0.6, 'vgOrange', { seg: 24 });
    // the spire
    let y = 8.8;
    for (const [s, h] of [[3.4, 9], [2.6, 10], [1.9, 11], [1.3, 10], [0.7, 8]]) {
      box(0, y, 0, s, h, s, 'vgSteel');
      for (const [dx, dz, sw, sd] of [[s / 2 + 0.02, 0, 0.04, 0.35], [-s / 2 - 0.02, 0, 0.04, 0.35], [0, s / 2 + 0.02, 0.35, 0.04], [0, -s / 2 - 0.02, 0.35, 0.04]]) pb('vgBlue', dx, y + h / 2, dz, sw, h * 0.86, sd);
      pb('vgPanelB', 0, y + h - 0.2, 0, s + 0.5, 0.4, s + 0.5);
      y += h;
    }
    pb('vgRedGlow', 0, y + 0.5, 0, 0.6, 0.9, 0.6);
    // heat vents around the dais
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.26, vx = Math.cos(a) * 9.2, vz = Math.sin(a) * 9.2;
      box(vx, 1, vz, 1.3, 3.6, 1.3, 'vgSteel'); pb('vgOrangeGlow', vx, 4.65, vz, 1.0, 0.12, 1.0);
      const beam = new THREE.CylinderGeometry(0.35, 0.6, 7, 10, 1, true);
      w.pushGeometry('vgBeamOrange', beam, new THREE.Matrix4().makeTranslation(vx, 8.2, vz));
    }
    // square catwalk at 6 m with stairs north & south
    const CY = 6, C = 9;
    for (const [cx, cz, sx, sz] of [[0, -C, C * 2 + 2.4, 2.4], [0, C, C * 2 + 2.4, 2.4], [-C, 0, 2.4, C * 2 - 2.4], [C, 0, 2.4, C * 2 - 2.4]]) box(cx, CY - 0.35, cz, sx, 0.35, sz, 'vgDeckLight');
    for (const [px, pz] of [[-C, -C], [C, -C], [-C, C], [C, C]]) box(px, 1, pz, 0.5, CY - 1.35, 0.5, 'vgSteel');
    railing(-C - 1.2, -C - 1.2, C + 1.2, -C - 1.2, CY, 1.1); railing(-C - 1.2, C + 1.2, -2, C + 1.2, CY, 1.1); railing(2, C + 1.2, C + 1.2, C + 1.2, CY, 1.1);
    railing(-C - 1.2, -C - 1.2, -C - 1.2, C + 1.2, CY, 1.1); railing(C + 1.2, -C - 1.2, C + 1.2, C + 1.2, CY, 1.1);
    stairsWithRails(0, C + 7.2, 2.6, 12, CY, '-z');
    w.chest(-C, CY, 0, Math.PI / 2); w.chest(C, CY, 0, -Math.PI / 2); w.ammo(0, CY, -C);
    w.chest(0, 1, 6.5); w.loot(-7, 1, 0); w.loot(7, 1, 0);
    // molten channels along the avenues
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = dx * 24, cz = dz * 24;
      if (dx) { pb('vgOrangeGlow', cx, 0.02, cz, 16, 0.03, 1.1); pb('vgSteel', cx, 0.1, cz - 0.9, 16, 0.2, 0.5); pb('vgSteel', cx, 0.1, cz + 0.9, 16, 0.2, 0.5); }
      else { pb('vgOrangeGlow', cx, 0.02, cz, 1.1, 0.03, 16); pb('vgSteel', cx - 0.9, 0.1, cz, 0.5, 0.2, 16); pb('vgSteel', cx + 0.9, 0.1, cz, 0.5, 0.2, 16); }
    }
    for (const [cx, cz] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) { lightPylon(cx, cz, 14); crates(cx + 3, cz + 2, 3); }
    barrier(-18, 12, false); barrier(18, -12, false); barrier(12, 18, true); barrier(-12, -18, true);
    w.chest(-24, 0, -18); w.chest(24, 0, 18, Math.PI); w.ammo(18, 0, 24); w.ammo(-18, 0, -24);
  }

  // ------------------------------------------------------------------ B: Hangar Bay (N)
  {
    const x0 = -34, x1 = 34, z0 = -142, z1 = -98, H = 18;
    w.pois.push({ name: 'Hangar Bay', x: 0, z: -118, r: 38 });
    w.wall(x0, z0, x1, z0, H, 1.0, 'vgPanelB');
    w.wall(x0, z0, x0, z1, H, 1.0, 'vgPanelB', [{ at: 14, w: 6, h: 6 }, { at: 34, w: 4, h: 4 }]);
    w.wall(x1, z0, x1, z1, H, 1.0, 'vgPanelB', [{ at: 14, w: 6, h: 6 }, { at: 34, w: 4, h: 4 }]);
    trussFrame(x0, z0, x1, z1, H, true);
    pb('vgSteel', 0, H - 1, z1, x1 - x0, 2, 1.2);
    pb('vgBlue', 0, H - 2.1, z1 + 0.62, x1 - x0 - 2, 0.25, 0.05);
    for (let x = x0 + 4; x < x1 - 2; x += 6) pb('vgWhiteGlow', x, H - 0.3, (z0 + z1) / 2, 0.4, 0.1, z1 - z0 - 6);
    // pads + ships
    hazardPad(-14, -122, 14, 18); hazardPad(15, -118, 14, 18);
    dropship(-14, -122, 0); dropship(15, -118, 0);
    // rear catwalk at 7 m
    box(0, 6.6, z0 + 2.6, x1 - x0 - 2, 0.4, 4, 'vgDeckLight');
    for (let x = x0 + 4; x < x1; x += 8) box(x, 0, z0 + 4.4, 0.4, 6.6, 0.4, 'vgSteel');
    railing(x0 + 1, z0 + 4.65, x1 - 7, z0 + 4.65, 7);
    stairsWithRails(x1 - 4, z0 + 11.1, 3, 13, 7, '-z');
    // maintenance gantry + cargo
    for (const [gx, gz] of [[-27, -108], [-27, -132], [-1, -108], [-1, -132]]) box(gx, 0, gz, 0.6, 9, 0.6, 'vgOrange');
    box(-14, 9, -108, 26.6, 0.8, 0.8, 'vgOrange'); box(-14, 9, -132, 26.6, 0.8, 0.8, 'vgOrange');
    crates(-30, -102, 4); crates(26, -104, 3); crates(-4, -138, 3); crates(28, -134, 2);
    barrier(0, -96, true); barrier(-20, -94, true); barrier(20, -94, true);
    w.chest(0, 7, z0 + 2.6); w.chest(-30, 0, -120, Math.PI / 2); w.chest(30, 0, -126, -Math.PI / 2); w.chest(0, 0, -110);
    w.chest(-14, 3.45, -120); w.chest(15, 3.45, -116);
    [[-24, -112], [8, -130], [24, -104], [-8, -100]].forEach(([x, z]) => w.loot(x, 0, z));
    w.ammo(-2, 0, -126); w.ammo(22, 0, -112);
  }

  // ------------------------------------------------------------------ C: Command Spire (NE)
  {
    const x0 = 88, x1 = 120, z0 = -118, z1 = -92, FY = 5, RY = 10;
    w.pois.push({ name: 'Command Spire', x: 104, z: -108, r: 32 });
    w.wall(x0, z0, x1, z0, FY, 0.6, 'vgPanel', [{ at: 8, w: 3, h: 2.6, sill: 1.1 }, { at: 24, w: 3, h: 2.6, sill: 1.1 }]);
    w.wall(x0, z1, x1, z1, FY, 0.6, 'vgPanel', [{ at: 10, w: 3, h: 3.4 }, { at: 22, w: 3, h: 2.6, sill: 1.1 }]);
    w.wall(x0, z0, x0, z1, FY, 0.6, 'vgPanel', [{ at: 13, w: 3, h: 3.4 }]);
    w.wall(x1, z0, x1, z1, FY, 0.6, 'vgPanel', [{ at: 16, w: 3, h: 3.4 }]);
    w.wall(x0, z0, x1, z0, RY - FY, 0.6, 'vgPanel', [{ at: 6, w: 4, h: 2.6, sill: 1 }, { at: 16, w: 4, h: 2.6, sill: 1 }, { at: 26, w: 4, h: 2.6, sill: 1 }], FY);
    w.wall(x0, z1, x1, z1, RY - FY, 0.6, 'vgPanel', [{ at: 6, w: 4, h: 2.6, sill: 1 }, { at: 16, w: 4, h: 2.6, sill: 1 }, { at: 26, w: 4, h: 2.6, sill: 1 }], FY);
    w.wall(x0, z0, x0, z1, RY - FY, 0.6, 'vgPanel', [{ at: 13, w: 5, h: 2.6, sill: 1 }], FY);
    w.wall(x1, z0, x1, z1, RY - FY, 0.6, 'vgPanel', [], FY);
    // floor with a stairwell opening, roof
    box((x0 + x1) / 2 - 3, FY - 0.4, (z0 + z1) / 2, x1 - x0 - 6, 0.4, z1 - z0, 'vgDeckLight');
    box(x1 - 3, FY - 0.4, z0 + 5, 6, 0.4, 10, 'vgDeckLight');
    w.stairs(x1 - 3, z0 + 15, 2.8, 10, FY - 0.4, '-z', 'vgDeckLight');
    box((x0 + x1) / 2, RY, (z0 + z1) / 2, x1 - x0 + 0.6, 0.5, z1 - z0 + 0.6, 'vgSteel');
    for (const [dx, dz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) pb('vgPanelB', dx, RY / 2, dz, 1.2, RY + 0.4, 1.2, new THREE.Euler(0, Math.PI / 4, 0));
    pb('vgBlue', (x0 + x1) / 2, RY - 0.3, z1 + 0.32, x1 - x0, 0.15, 0.04); pb('vgBlue', (x0 + x1) / 2, FY - 0.25, z1 + 0.32, x1 - x0, 0.1, 0.04);
    for (let x = x0 + 4; x < x1; x += 8) { pb('vgWhiteGlow', x, FY - 0.42, (z0 + z1) / 2, 2.5, 0.04, 0.4); pb('vgWhiteGlow', x, RY - 0.02, (z0 + z1) / 2, 2.5, 0.04, 0.4); }
    // command consoles
    for (const [mx, mz, r] of [[94, -112, 0], [100, -112, 0], [106, -112, 0], [96, -98, Math.PI]]) { box(mx, 0, mz, 3, 1, 1.2, 'vgSteel'); w.monitor(mx, mz + (r ? 0.5 : -0.5), r, -0.4); }
    // tower with an observation deck (jetpack up from the roof)
    const tx = 115, tz = -127;
    box(tx, 0, tz, 10, 30, 10, 'vgPanelB');
    for (let yy = 4; yy < 30; yy += 6) pb('vgBlue', tx, yy, tz + 5.03, 8, 0.15, 0.05);
    for (const s of [-1, 1]) pb('vgSlit', tx + s * 5.03, 15, tz, 0.05, 26, 0.3);
    box(tx, 30, tz, 15, 0.6, 15, 'vgDeckLight');
    railing(tx - 7.5, tz - 7.5, tx + 7.5, tz - 7.5, 30.6); railing(tx - 7.5, tz + 7.5, tx + 7.5, tz + 7.5, 30.6);
    railing(tx - 7.5, tz - 7.5, tx - 7.5, tz + 7.5, 30.6); railing(tx + 7.5, tz - 7.5, tx + 7.5, tz + 7.5, 30.6);
    w.cyl(tx, 30.6, tz, 0.5, 6, 'vgSteel', { seg: 8 }); pb('vgRedGlow', tx, 37, tz, 0.5, 0.6, 0.5);
    w.chest(tx, 30.6, tz + 3); w.chest(98, FY, -100); w.chest(112, 0, -96, Math.PI); w.chest(92, RY + 0.5, -112);
    w.loot(104, FY, -108); w.loot(92, 0, -104); w.ammo(108, 0, -114); w.ammo(100, FY, -114);
    // dish antennas on the roof
    for (const [dx, dz] of [[96, -96], [104, -96]]) {
      w.cyl(dx, RY + 0.5, dz, 0.2, 2.2, 'vgSteel', { seg: 8 });
      const dish = new THREE.SphereGeometry(1.6, 16, 6, 0, Math.PI * 2, 0, 0.9);
      w.pushGeometry('vgTruss', dish, new THREE.Matrix4().makeRotationX(Math.PI * 0.75).setPosition(dx, RY + 2.9, dz));
    }
    crates(86, -88, 3); barrier(124, -96, false); lightPylon(126, -88, 12);
  }

  // ------------------------------------------------------------------ D: Fuel Depot (E)
  {
    w.pois.push({ name: 'Fuel Depot', x: 120, z: 0, r: 36 });
    const tanks = [[98, -22, 5.5, 13], [98, 22, 5.5, 13], [124, -24, 6, 14], [124, 24, 6, 14], [146, -8, 4.5, 11], [146, 12, 4, 10]];
    for (const [x, z, r, h] of tanks) { tank(x, z, r, h); hazardPad(x, z, r * 2 + 4, r * 2 + 4); }
    // pipe rack down the middle
    for (let z = -32; z <= 32; z += 8) { box(112, 0, z, 0.5, 4.2, 0.5, 'vgSteel'); box(112, 4.2, z, 4, 0.3, 0.4, 'vgSteel', { noCol: true }); }
    for (const [dx, y, r, mat] of [[-1.2, 4.75, 0.45, 'vgTank'], [0, 4.75, 0.45, 'vgOrange'], [1.2, 4.75, 0.45, 'vgTank'], [0, 5.7, 0.35, 'vgBlueDim']]) cylAxis(mat, 112 + dx, y, 0, r, 68, 'z', 10);
    box(112, 4.45, 0, 4, 0.6, 68, 'vgSteel', { noCol: true });
    w.col.addBox(110, 4.2, -34, 114, 6.2, 34);
    // pumps + carts
    for (const [px, pz] of [[108, -42], [116, 42], [138, 30], [138, -32]]) { box(px, 0, pz, 1.6, 2.2, 1.2, 'vgOrange'); pb('vgBlue', px, 1.8, pz + 0.61, 1.2, 0.3, 0.04); }
    crates(90, 2, 3); crates(132, -2, 4); barrier(104, 40, true); barrier(150, -30, false);
    for (const [x, z, , h] of tanks.slice(0, 4)) w.chest(x, h, z);
    w.chest(112, 0, 8, Math.PI / 2); w.chest(150, 0, 2); w.loot(92, 0, -4); w.loot(132, 0, 8); w.loot(118, 0, -38); w.ammo(104, 0, 0); w.ammo(140, 0, 22);
  }

  // ------------------------------------------------------------------ E: Armory (SE)
  {
    w.pois.push({ name: 'Armory', x: 112, z: 104, r: 34 });
    const bunker = (x0, z0, x1, z1, doors, armour) => {
      const H = 6;
      w.wall(x0, z0, x1, z0, H, 1.4, 'vgSteel', doors.n || []); w.wall(x0, z1, x1, z1, H, 1.4, 'vgSteel', doors.s || []);
      w.wall(x0, z0, x0, z1, H, 1.4, 'vgSteel', doors.w || []); w.wall(x1, z0, x1, z1, H, 1.4, 'vgSteel', doors.e || []);
      box((x0 + x1) / 2, H, (z0 + z1) / 2, x1 - x0 + 1.4, 1, z1 - z0 + 1.4, 'vgPanelB');
      // sloped armour on the long faces
      if (armour === 'n') pb('vgPanel', (x0 + x1) / 2, 2.2, z0 - 1.2, x1 - x0, 4.6, 0.6, new THREE.Euler(0.35, 0, 0));
      if (armour === 's') pb('vgPanel', (x0 + x1) / 2, 2.2, z1 + 1.2, x1 - x0, 4.6, 0.6, new THREE.Euler(-0.35, 0, 0));
      for (const [side, list] of Object.entries(doors)) for (const g of list) {
        const along = side === 'n' || side === 's';
        const px = along ? x0 + g.at : (side === 'w' ? x0 : x1), pz = along ? (side === 'n' ? z0 : z1) : z0 + g.at;
        if (along) { pb('vgHazard', px - g.w / 2 - 0.25, g.h / 2, pz, 0.5, g.h, 1.6); pb('vgHazard', px + g.w / 2 + 0.25, g.h / 2, pz, 0.5, g.h, 1.6); pb('vgHazard', px, g.h + 0.25, pz, g.w + 1, 0.5, 1.6); }
        else { pb('vgHazard', px, g.h / 2, pz - g.w / 2 - 0.25, 1.6, g.h, 0.5); pb('vgHazard', px, g.h / 2, pz + g.w / 2 + 0.25, 1.6, g.h, 0.5); pb('vgHazard', px, g.h + 0.25, pz, 1.6, 0.5, g.w + 1); }
      }
      pb('vgWhiteGlow', (x0 + x1) / 2, H - 0.03, (z0 + z1) / 2, (x1 - x0) * 0.6, 0.04, 0.5);
    };
    bunker(86, 92, 112, 112, { s: [{ at: 13, w: 4, h: 3.6 }], w: [{ at: 10, w: 3, h: 3 }] }, 'n');
    bunker(118, 94, 142, 116, { n: [{ at: 12, w: 4, h: 3.6 }], e: [{ at: 11, w: 3, h: 3 }] }, 's');
    // weapon racks + crates inside
    for (const [rx, rz] of [[92, 96], [106, 96], [124, 112], [136, 112]]) { box(rx, 0, rz, 3.4, 2, 0.8, 'vgSteel'); pb('vgOrange', rx, 1.3, rz + 0.41, 3, 0.2, 0.04); }
    crates(96, 106, 3); crates(128, 100, 3);
    w.chest(99, 0, 102); w.chest(104, 0, 108, Math.PI); w.chest(130, 0, 106); w.chest(126, 0, 98, Math.PI);
    w.loot(90, 0, 104); w.loot(138, 0, 100); w.ammo(108, 0, 100); w.ammo(122, 0, 108);
    // watch tower + yard
    const wx = 146, wz = 84;
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) box(wx + dx, 0, wz + dz, 0.4, 7, 0.4, 'vgSteel');
    box(wx, 7, wz, 5.4, 0.4, 5.4, 'vgDeckLight'); railing(wx - 2.7, wz - 2.7, wx + 2.7, wz - 2.7, 7.4); railing(wx - 2.7, wz + 2.7, wx + 2.7, wz + 2.7, 7.4); railing(wx + 2.7, wz - 2.7, wx + 2.7, wz + 2.7, 7.4);
    w.stairs(wx - 7.5, wz, 2.4, 10, 7.4, '+x', 'vgDeckLight');
    w.chest(wx, 7.4, wz); turret(wx, wz + 12, 0, Math.PI);
    for (const [bx, bz, ax] of [[90, 124, true], [110, 126, true], [132, 128, true], [150, 104, false], [80, 100, false]]) barrier(bx, bz, ax);
  }

  // ------------------------------------------------------------------ F: Landing Pads (S)
  {
    w.pois.push({ name: 'Landing Pads', x: 0, z: 118, r: 38 });
    for (const [px, pz, ship] of [[-24, 110, false], [0, 130, true], [24, 110, false]]) {
      w.cyl(px, 0, pz, 10, 0.4, 'vgSteel', { seg: 36 }); w.cyl(px, 0.4, pz, 9, 0.4, 'vgDeckLight', { seg: 36 });
      ring('vgBlue', px, 0.82, pz, 8.4, 0.12, 48); ring('vgOrangeGlow', px, 0.42, pz, 9.6, 0.08, 48);
      pb('vgWhiteGlow', px - 1.4, 0.83, pz, 0.5, 0.02, 4); pb('vgWhiteGlow', px + 1.4, 0.83, pz, 0.5, 0.02, 4); pb('vgWhiteGlow', px, 0.83, pz, 2.4, 0.02, 0.5);
      if (ship) dropship(px, pz, 1, 0.8); else { crates(px + 4, pz - 3, 2); w.chest(px - 3, 0.8, pz + 2); }
    }
    w.chest(0, 0.8, 136); w.chest(0, 0.8 + 3.45, 130);
    // control tower
    const cx = 40, cz = 140;
    box(cx, 0, cz, 6, 6, 6, 'vgPanelB');
    box(cx, 6, cz, 8.4, 0.4, 8.4, 'vgDeckLight');
    pb('vgGlass', cx, 7.4, cz - 4.15, 8, 2, 0.06); pb('vgGlass', cx - 4.15, 7.4, cz, 0.06, 2, 8);
    box(cx, 8.4, cz, 8.6, 0.4, 8.6, 'vgSteel');
    railing(cx + 4.2, cz - 4.2, cx + 4.2, cz + 4.2, 6.4); railing(cx - 4.2, cz + 4.2, cx + 4.2, cz + 4.2, 6.4);
    w.stairs(cx - 9.2, cz + 2.6, 2.4, 10, 6.4, '+x', 'vgDeckLight');
    w.chest(cx, 6.4, cz); w.monitor(cx - 2, cz - 3.4, 0, 6.4 - 0.6);
    crates(-38, 128, 3); crates(36, 104, 2); barrier(-40, 100, false); barrier(40, 120, false); barrier(-12, 96, true); barrier(12, 96, true);
    for (const [lx, lz] of [[-36, 140], [-12, 146], [14, 146]]) lightPylon(lx, lz, 10);
    w.loot(-10, 0, 112); w.loot(10, 0, 112); w.loot(-30, 0, 132); w.ammo(0, 0, 104); w.ammo(30, 0, 128);
  }

  // ------------------------------------------------------------------ G: Shield Generators (SW)
  {
    w.pois.push({ name: 'Shield Generators', x: -104, z: 104, r: 34 });
    const gens = [[-120, 88], [-88, 88], [-120, 120], [-88, 120]];
    for (const [gx, gz] of gens) {
      box(gx, 0, gz, 5, 2, 5, 'vgPanelB');
      box(gx, 2, gz, 1.8, 14, 1.8, 'vgSteel');
      for (const [dx, dz, sw, sd] of [[0.92, 0, 0.04, 0.6], [-0.92, 0, 0.04, 0.6], [0, 0.92, 0.6, 0.04], [0, -0.92, 0.6, 0.04]]) pb('vgBlue', gx + dx, 9, gz + dz, sw, 12, sd);
      const orb = new THREE.SphereGeometry(1.4, 16, 10);
      w.pushGeometry('vgBlue', orb, new THREE.Matrix4().makeTranslation(gx, 17.2, gz));
      ring('vgWhiteGlow', gx, 17.2, gz, 2.2, 0.08, 32);
      const beam = new THREE.CylinderGeometry(0.6, 1.2, 70, 12, 1, true);
      w.pushGeometry('vgBeam', beam, new THREE.Matrix4().makeTranslation(gx, 17 + 35, gz));
      w.chest(gx + 3.5, 0, gz);
    }
    // conduits linking the pylons
    line('vgBlue', -120, 88, -88, 88, 0.5); line('vgBlue', -120, 120, -88, 120, 0.5); line('vgBlue', -120, 88, -120, 120, 0.5); line('vgBlue', -88, 88, -88, 120, 0.5);
    // capacitor banks in the middle
    for (let i = 0; i < 4; i++) { const bx = -110 + i * 6.5; box(bx, 0, 104, 2, 2.6, 8, 'vgSteel'); pb('vgBlue', bx + 1.01, 1.9, 104, 0.04, 0.25, 7); pb('vgBlue', bx - 1.01, 1.9, 104, 0.04, 0.25, 7); }
    pod(-104, 136, 10, 7, 4.5, { hollow: true, doors: ['n'] });
    w.chest(-104, 0, 137); w.loot(-96, 0, 104); w.loot(-114, 0, 96); w.ammo(-104, 0, 92); w.ammo(-130, 0, 104);
    crates(-136, 88, 3); crates(-74, 124, 2); barrier(-104, 76, true);
  }

  // ------------------------------------------------------------------ H: Rampart (W)
  {
    w.pois.push({ name: 'Rampart', x: -118, z: 0, r: 36 });
    const WX = -128, H = 7, z0 = -44, z1 = 44;
    w.wall(WX, z0, WX, z1, H, 1.8, 'vgPanelB', [{ at: 44, w: 8, h: 5 }]);
    for (let z = z0 + 1.5; z < z1; z += 3) { if (Math.abs(z) < 5) continue; box(WX - 0.5, H, z, 0.8, 1.1, 1.5, 'vgPanelB'); }
    pb('vgBlue', WX + 0.92, H - 0.6, (z0 + z1) / 2, 0.04, 0.2, z1 - z0);
    // walkway behind the battlements + stairs
    box(WX + 2.4, H - 2.4, -28.5, 3, 0.4, 31, 'vgDeckLight'); box(WX + 2.4, H - 2.4, 28.5, 3, 0.4, 31, 'vgDeckLight');
    for (let z = z0 + 4; z < z1; z += 8) if (Math.abs(z) > 5) box(WX + 3.7, 0, z, 0.4, H - 2.4, 0.4, 'vgSteel');
    railing(WX + 3.9, -44, WX + 3.9, -13, H - 2); railing(WX + 3.9, 13, WX + 3.9, 44, H - 2);
    w.stairs(WX + 2.4, -8.5, 2.8, 9, H - 2.0, '-z', 'vgDeckLight'); w.stairs(WX + 2.4, 8.5, 2.8, 9, H - 2.0, '+z', 'vgDeckLight');
    for (const tz of [-34, 34]) turret(WX + 2.4, tz, H - 2.0, -Math.PI / 2);
    // bunkers inside, trenches outside
    pod(-112, -24, 10, 8, 5, { hollow: true, doors: ['e'] }); pod(-112, 24, 10, 8, 5, { hollow: true, doors: ['e'] });
    pod(-104, 0, 6, 12, 4);
    for (const [tx, tz0, tz1] of [[-140, -40, -10], [-146, -6, 14], [-140, 18, 42]]) { box(tx, 0, (tz0 + tz1) / 2, 1, 1.4, tz1 - tz0, 'vgSteel'); pb('vgHazard', tx + 0.51, 1.2, (tz0 + tz1) / 2, 0.02, 0.2, tz1 - tz0); }
    crates(-152, -30, 2); crates(-150, 30, 3);
    w.chest(-112, 0, -24); w.chest(-112, 0, 24); w.chest(WX + 2.4, H - 2.0, -20); w.chest(-150, 0, 0);
    w.loot(WX + 2.4, H - 2.0, 20); w.loot(-118, 0, 0); w.loot(-144, 0, -20); w.ammo(-100, 0, -10); w.ammo(-140, 0, 20);
  }

  // ------------------------------------------------------------------ I: Barracks (NW)
  {
    w.pois.push({ name: 'Barracks', x: -104, z: -104, r: 40 });
    const cols = [-142, -122, -102, -82, -64], rows = [-140, -116, -92, -70];
    rows.forEach((z, ri) => cols.forEach((x, ci) => {
      if ((ri === 1 || ri === 2) && ci === 2) return;   // central plaza
      const big = (ri + ci) % 3 === 0;
      const pw = big ? 12 : 9, pd = big ? 9 : 8, h = big ? 6 : 5;
      const hollow = (ri + ci) % 2 === 0;
      pod(x, z, pw, pd, h, hollow ? { hollow: true, doors: [ri % 2 ? 'n' : 's', ci % 2 ? 'e' : 'w'] } : {});
      if (hollow) { w.chest(x + 1.5, 0, z - 1, 0); w.loot(x - 2, 0, z + 1.5); }
      else if ((ri + ci) % 3 === 1) w.chest(x, h + 0.35, z);
    }));
    // rooftop bridges along two rows
    for (const z of [-116, -70]) for (let i = 0; i < cols.length - 1; i++) {
      const xa = cols[i] + 4.4, xb = cols[i + 1] - 4.4; if (xb <= xa) continue;
      box((xa + xb) / 2, 5.0, z, xb - xa, 0.35, 2.4, 'vgDeckLight');
      railing(xa, z - 1.2, xb, z - 1.2, 5.35); railing(xa, z + 1.2, xb, z + 1.2, 5.35);
    }
    lightPylon(-102, -104, 16); crates(-108, -98, 3); crates(-96, -110, 2);
    w.chest(-102, 0, -98); w.ammo(-110, 0, -104); w.ammo(-90, 0, -128);
    for (let z = -150; z < -60; z += 6) pb('vgBlue', -132, 0.013, z, 0.18, 0.02, 2.4);
  }

  // ------------------------------------------------------------------ scatter
  {
    const r = seeded(4401);
    let placed = 0;
    for (let tries = 0; tries < 2400 && placed < 130; tries++) {
      const x = (r() - 0.5) * (L * 2 - 24), z = (r() - 0.5) * (L * 2 - 24);
      if (inReserved(x, z, 6) || Math.abs(x) < 12 || Math.abs(z) < 12) continue;
      if (!w.col.isFree(x, 0, z, 4, 3)) continue;
      const k = r();
      if (k < 0.3) crates(x, z, 1 + Math.floor(r() * 4));
      else if (k < 0.48) barrier(x, z, r() < 0.5);
      else if (k < 0.6) lightPylon(x, z, 8 + r() * 8);
      else if (k < 0.78) pod(x, z, 5 + r() * 4, 4 + r() * 3, 3.2 + r() * 1.6);
      else if (k < 0.9) { box(x, 0, z, 12.2, 2.6, 2.5, 'vgCrateB'); pb('vgBlue', x, 2.0, z + 1.27, 11, 0.12, 0.03); pb('vgBlue', x, 2.0, z - 1.27, 11, 0.12, 0.03); }
      else hazardPad(x, z, 6, 6);
      placed++;
      if (r() < 0.4) w.loot(x + 3, 0, z + 3);
      else if (r() < 0.25) w.chest(x + 3, 0, z - 3);
      else if (r() < 0.3) w.ammo(x - 3, 0, z);
    }
  }
}

/** Per-frame animation (core pulse, flicker). Call after finalize. */
export function animateVulcan(w) {
  const core = w.mats.vgCore && w.mats.vgCore.mat;
  if (core) w.animated.push(t => { const k = 0.7 + 0.3 * Math.sin(t * 2.4) + 0.08 * Math.sin(t * 13.1); core.color.setRGB(1, 0.32 * k + 0.1, 0.04 * k); });
  const red = w.mats.vgRedGlow && w.mats.vgRedGlow.mat;
  if (red) w.animated.push(t => { const on = Math.sin(t * 3.0) > 0.2; red.color.setRGB(on ? 1 : 0.25, on ? 0.23 : 0.05, on ? 0.23 : 0.05); });
}
