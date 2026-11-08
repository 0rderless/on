// Gliders (the "parachutes" you deploy after skydiving). Each returns a Group placed on the character root
// (origin at the feet, +Z forward) with userData { id, pose, anim(t, dt) }.
// pose: 'hang' (hands up on a bar/reins), 'canopy' (hands high on risers), 'ride' (standing on it), 'float',
// 'sit' (sitting astride with hands on handlebars).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const HAND_L = new THREE.Vector3(0.4, 1.95, 0.02), HAND_R = new THREE.Vector3(-0.4, 1.95, 0.02);
const _up = new THREE.Vector3(0, 1, 0);

function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/** A thin cylinder from a to b. */
function rod(a, b, r, mat, seg = 5) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1, true), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(_up, d.normalize());
  return m;
}

/** Tube along a curve with a radius profile f(u) (u: 0..1 along the curve). */
function taperedTube(curve, segs, radial, radiusAt) {
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const r = radiusAt(i / segs);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1, ...o });
const glow = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });

// ------------------------------------------------------------------ builders (geometry/materials cached per type)
const BUILD = {
  military(C) {
    if (!C.mil) {
      const tex = canvasTex(256, 64, (x, w, h) => {
        for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#5d6a3b' : '#77794f'; x.fillRect(i * w / 16, 0, w / 16 + 1, h); }
        x.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < 16; i++) x.fillRect(i * w / 16, 0, 2, h);
        x.fillStyle = '#3b4426'; x.fillRect(0, h - 6, w, 6);
      });
      C.mil = {
        dome: new THREE.SphereGeometry(2.6, 32, 10, 0, Math.PI * 2, 0.12, 0.92),
        mat: std({ map: tex, roughness: 0.85, side: THREE.DoubleSide }),
        vent: new THREE.CircleGeometry(0.33, 16), ventMat: std({ color: 0x2d331d, side: THREE.DoubleSide, roughness: 0.9 }),
        skirt: new THREE.TorusGeometry(2.6 * Math.sin(1.04), 0.035, 4, 40), skirtMat: std({ color: 0x3b4426, roughness: 0.9 }),
        line: new THREE.MeshBasicMaterial({ color: 0xc9c4a8 }), strap: std({ color: 0x4a5230, roughness: 0.9 }),
      };
    }
    const M = C.mil, g = new THREE.Group(), canopy = new THREE.Group();
    const cy = 2.85, R = 2.6, rimY = cy + R * Math.cos(1.04), rimR = R * Math.sin(1.04);
    const dome = new THREE.Mesh(M.dome, M.mat); dome.position.y = cy; canopy.add(dome);
    const vent = new THREE.Mesh(M.vent, M.ventMat); vent.rotation.x = -Math.PI / 2; vent.position.y = cy + R * Math.cos(0.12) - 0.01; canopy.add(vent);
    const skirt = new THREE.Mesh(M.skirt, M.skirtMat); skirt.rotation.x = Math.PI / 2; skirt.position.y = rimY; canopy.add(skirt);
    g.add(canopy);
    // suspension lines to two riser links above the hands
    const riserL = new THREE.Vector3(0.36, 2.4, 0.02), riserR = new THREE.Vector3(-0.36, 2.4, 0.02);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * rimR, rimY, Math.sin(a) * rimR);
      g.add(rod(p, p.x >= 0 ? riserL : riserR, 0.008, M.line, 3));
    }
    for (const [r, h] of [[riserL, HAND_L], [riserR, HAND_R]]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, r.y - h.y, 0.02), M.strap);
      s.position.set((r.x + h.x) / 2, (r.y + h.y) / 2, 0.02); g.add(s);
    }
    return { g, pose: 'canopy', anim: (t) => { canopy.scale.set(1 + Math.sin(t * 2.1) * 0.025, 1 - Math.sin(t * 2.1) * 0.03, 1 + Math.sin(t * 2.1) * 0.025); canopy.rotation.z = Math.sin(t * 0.9) * 0.05; canopy.rotation.x = Math.sin(t * 0.7) * 0.04; } };
  },

  surf(C) {
    if (!C.surf) {
      // board outline (x across, y along the board): rounded tail, pointed nose
      const s = new THREE.Shape(), L = 1.15;
      s.moveTo(0, -L);
      s.bezierCurveTo(0.22, -L, 0.33, -0.7, 0.34, -0.15);
      s.bezierCurveTo(0.35, 0.45, 0.2, 0.9, 0, L + 0.08);
      s.bezierCurveTo(-0.2, 0.9, -0.35, 0.45, -0.34, -0.15);
      s.bezierCurveTo(-0.33, -0.7, -0.22, -L, 0, -L);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 18 });
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 0.4) / 0.8, (pos.getY(i) + L) / (2 * L + 0.1));
      const tex = canvasTex(128, 512, (x, w, h) => {
        x.fillStyle = '#f4f6fa'; x.fillRect(0, 0, w, h);
        x.fillStyle = '#18c2c9'; x.fillRect(w * 0.42, 0, w * 0.16, h);
        x.fillStyle = '#ff7a2c'; x.fillRect(w * 0.36, 0, w * 0.04, h); x.fillRect(w * 0.6, 0, w * 0.04, h);
        x.fillStyle = '#18c2c9'; x.beginPath(); x.arc(w / 2, h * 0.25, 30, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ffe14d'; x.beginPath(); x.moveTo(66, 100); x.lineTo(52, 128); x.lineTo(66, 128); x.lineTo(58, 152); x.lineTo(80, 120); x.lineTo(66, 120); x.lineTo(74, 100); x.fill();
      });
      const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0.16, 0); fin.quadraticCurveTo(0.02, 0.06, -0.04, 0.16); fin.lineTo(0, 0);
      const trailTex = canvasTex(16, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.3, 'rgba(120,240,255,0.6)'); g.addColorStop(1, 'rgba(40,140,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
      C.surf = {
        geo, mat: std({ map: tex, roughness: 0.3, metalness: 0.05 }),
        fin: new THREE.ExtrudeGeometry(fin, { depth: 0.02, bevelEnabled: false }), finMat: std({ color: 0x1a2030, roughness: 0.4 }),
        trail: new THREE.PlaneGeometry(0.7, 2.6), trailMat: new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
        spray: new THREE.SphereGeometry(0.08, 6, 4), sprayMat: glow(0xbff6ff, { transparent: true, opacity: 0.8 }),
      };
    }
    const S = C.surf, g = new THREE.Group(), board = new THREE.Group();
    const b = new THREE.Mesh(S.geo, S.mat); b.rotation.x = Math.PI / 2; b.position.y = 0.0; board.add(b);   // nose forward, deck on top
    for (const [x, z] of [[0, -0.95], [0.18, -0.85], [-0.18, -0.85]]) {
      const f = new THREE.Mesh(S.fin, S.finMat); f.rotation.set(Math.PI, Math.PI / 2, 0); f.position.set(x, -0.06, z); board.add(f);
    }
    const trail = new THREE.Mesh(S.trail, S.trailMat); trail.rotation.x = -Math.PI / 2 + 0.25; trail.position.set(0, -0.35, -2.2); trail.renderOrder = 7;
    board.add(trail);
    const spray = [];
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(S.spray, S.sprayMat); s.renderOrder = 7; board.add(s); spray.push(s); }
    board.position.y = -0.07;
    g.add(board);
    return {
      g, pose: 'ride', anim: (t) => {
        board.position.y = -0.07 + Math.sin(t * 3.2) * 0.03; board.rotation.z = Math.sin(t * 1.7) * 0.07; board.rotation.x = -0.14 + Math.sin(t * 2.3) * 0.04; board.rotation.y = 0.55;
        spray.forEach((s, i) => { const k = ((t * 1.6 + i / 6) % 1); s.position.set(Math.sin(i * 2.1) * 0.35 * (1 + k), -0.05 - k * 0.5, -1.0 - k * 1.6); s.scale.setScalar(1.2 - k); });
      },
    };
  },

  car(C) {
    // a chunky yellow cab: you stand on the roof (roof top at y = 0)
    if (!C.car) {
      const checker = canvasTex(256, 32, (x, w, h) => { x.fillStyle = '#ffd21a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 32; i++) { x.fillStyle = '#111'; x.fillRect(i * 8, (i % 2) * 8, 8, 8); x.fillRect(i * 8, 16 + (i % 2) * 8, 8, 8); } });
      C.car = {
        body: new RoundedBoxGeometry(1.75, 0.62, 3.7, 3, 0.18), paint: std({ color: 0xffc81a, roughness: 0.3, metalness: 0.35 }),
        cabin: new RoundedBoxGeometry(1.55, 0.62, 1.9, 3, 0.16), glass: std({ color: 0x1b2a3a, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.4 }),
        roof: new RoundedBoxGeometry(1.42, 0.06, 1.6, 2, 0.03),
        stripe: new THREE.BoxGeometry(1.77, 0.12, 2.6), stripeMat: std({ map: checker, roughness: 0.4 }),
        tire: new THREE.CylinderGeometry(0.36, 0.36, 0.3, 18), tireMat: std({ color: 0x15161a, roughness: 0.85 }),
        hub: new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10), hubMat: std({ color: 0xcfd5de, roughness: 0.25, metalness: 0.9 }),
        bumper: new RoundedBoxGeometry(1.8, 0.16, 0.18, 2, 0.06), chrome: std({ color: 0xd8dde6, roughness: 0.2, metalness: 1 }),
        lamp: new THREE.CircleGeometry(0.12, 14), head: glow(0xfff6c8), tail: glow(0xff2a2a),
        sign: new RoundedBoxGeometry(0.5, 0.16, 0.18, 2, 0.04), signMat: std({ color: 0xffffff, emissive: 0xffe9a0, emissiveIntensity: 0.6 }),
      };
    }
    const K = C.car, g = new THREE.Group(), car = new THREE.Group(); g.add(car);
    car.position.y = -0.07;
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); car.add(m); return m; };
    add(K.body, K.paint, 0, -1.0, 0);
    add(K.stripe, K.stripeMat, 0, -0.86, 0.15);
    add(K.cabin, K.glass, 0, -0.42, -0.15);
    add(K.roof, K.paint, 0, -0.08, -0.15);
    add(K.sign, K.signMat, 0, 0.0, -0.75);
    add(K.bumper, K.chrome, 0, -1.22, 1.87); add(K.bumper, K.chrome, 0, -1.22, -1.87);
    for (const sx of [-1, 1]) { add(K.lamp, K.head, sx * 0.6, -0.98, 1.855); add(K.lamp, K.tail, sx * 0.62, -0.98, -1.855, 0, Math.PI, 0); }
    const wheels = [];
    for (const [x, z] of [[0.86, 1.2], [-0.86, 1.2], [0.86, -1.2], [-0.86, -1.2]]) {
      const w = new THREE.Group(); w.position.set(x, -1.36, z); car.add(w);
      const t = new THREE.Mesh(K.tire, K.tireMat); t.rotation.z = Math.PI / 2; w.add(t);
      const h = new THREE.Mesh(K.hub, K.hubMat); h.rotation.z = Math.PI / 2; w.add(h);
      wheels.push(w);
    }
    return {
      g, pose: 'ride', anim: (t) => {
        for (const w of wheels) w.rotation.x = t * 9;
        car.position.y = -0.07 + Math.sin(t * 2.4) * 0.04; car.rotation.z = Math.sin(t * 1.3) * 0.04; car.rotation.x = -0.06 + Math.sin(t * 1.9) * 0.025;
      },
    };
  },

  cloud(C) {
    // a puffy cloud you stand on (its flattened top sits at y = 0)
    if (!C.cloud) {
      C.cloud = { puff: new THREE.SphereGeometry(1, 16, 12), mat: std({ color: 0xffffff, roughness: 1, metalness: 0, emissive: 0xc9d8ff, emissiveIntensity: 0.25 }), shade: std({ color: 0xdfe7f5, roughness: 1, metalness: 0 }) };
    }
    const K = C.cloud, g = new THREE.Group(), cloud = new THREE.Group(); g.add(cloud);
    const puffs = [];
    const P = [[0, -0.32, 0, 0.75, 0.45, 0.75], [0.62, -0.38, 0.15, 0.55, 0.38, 0.5], [-0.6, -0.36, -0.1, 0.58, 0.4, 0.55], [0.15, -0.36, 0.62, 0.5, 0.36, 0.48], [-0.2, -0.38, -0.65, 0.52, 0.36, 0.5],
      [0.95, -0.5, -0.35, 0.38, 0.3, 0.36], [-0.95, -0.52, 0.4, 0.4, 0.3, 0.38], [0.5, -0.62, -0.7, 0.4, 0.3, 0.4], [-0.45, -0.6, 0.85, 0.4, 0.3, 0.4], [0, -0.7, 0, 0.95, 0.35, 0.95]];
    P.forEach(([x, y, z, sx, sy, sz], i) => { const m = new THREE.Mesh(K.puff, i === P.length - 1 ? K.shade : K.mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); cloud.add(m); puffs.push([m, sx, sy, sz, i]); });
    return {
      g, pose: 'ride', anim: (t) => {
        cloud.position.y = Math.sin(t * 1.6) * 0.05; cloud.rotation.y = Math.sin(t * 0.4) * 0.15;
        for (const [m, sx, sy, sz, i] of puffs) { const k = 1 + Math.sin(t * 1.8 + i * 1.3) * 0.04; m.scale.set(sx * k, sy * k, sz * k); }
      },
    };
  },

  carpet(C) {
    // a rippling flying carpet (deck at y = 0), gold tassels at both ends
    if (!C.carpet) {
      const tex = canvasTex(256, 384, (x, w, h) => {
        x.fillStyle = '#9b1020'; x.fillRect(0, 0, w, h);
        x.strokeStyle = '#f2c14e'; x.lineWidth = 10; x.strokeRect(10, 10, w - 20, h - 20);
        x.strokeStyle = '#1d2a6b'; x.lineWidth = 8; x.strokeRect(26, 26, w - 52, h - 52);
        x.fillStyle = '#f2c14e';
        for (let y = 40; y < h - 40; y += 24) { x.beginPath(); x.moveTo(30, y); x.lineTo(40, y + 12); x.lineTo(30, y + 24); x.fill(); x.beginPath(); x.moveTo(w - 30, y); x.lineTo(w - 40, y + 12); x.lineTo(w - 30, y + 24); x.fill(); }
        x.translate(w / 2, h / 2);
        for (const [r, c] of [[100, '#1d2a6b'], [78, '#f2c14e'], [58, '#c42a3a'], [36, '#1d2a6b'], [16, '#f2c14e']]) { x.fillStyle = c; x.beginPath(); x.moveTo(0, -r * 1.4); x.lineTo(r, 0); x.lineTo(0, r * 1.4); x.lineTo(-r, 0); x.fill(); }
      });
      const geo = new THREE.PlaneGeometry(1.5, 2.4, 12, 20); geo.rotateX(-Math.PI / 2);
      C.carpet = {
        geo, base: Float32Array.from(geo.attributes.position.array), mat: std({ map: tex, roughness: 0.85, side: THREE.DoubleSide }),
        tassel: new THREE.ConeGeometry(0.035, 0.16, 5), gold: std({ color: 0xf2c14e, roughness: 0.4, metalness: 0.6 }),
        spark: new THREE.OctahedronGeometry(0.035, 0), sparkMat: glow(0xffe9a0),
      };
    }
    const K = C.carpet, g = new THREE.Group(), carpet = new THREE.Group(); g.add(carpet);
    const geo = K.geo.clone(); const mesh = new THREE.Mesh(geo, K.mat); carpet.add(mesh);
    const base = K.base, pos = geo.attributes.position;
    const tassels = [];
    for (const zEnd of [-1.2, 1.2]) for (let i = 0; i < 7; i++) {
      const tt = new THREE.Mesh(K.tassel, K.gold); tt.rotation.x = zEnd > 0 ? Math.PI / 2 + 0.3 : -Math.PI / 2 - 0.3; tt.position.set(-0.6 + i * 0.2, -0.02, zEnd + Math.sign(zEnd) * 0.07); carpet.add(tt); tassels.push(tt);
    }
    const sparks = [];
    for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(K.spark, K.sparkMat); sp.renderOrder = 7; carpet.add(sp); sparks.push(sp); }
    return {
      g, pose: 'ride', anim: (t) => {
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3], z = base[i * 3 + 2];
          const under = Math.max(0, 1 - Math.hypot(x, z * 0.8) / 0.55);   // calm under the rider's feet
          pos.setY(i, (Math.sin(z * 3.2 - t * 5) * 0.06 + Math.sin(x * 4 + t * 3) * 0.025) * (1 - under) + Math.abs(x) * 0.06);
        }
        pos.needsUpdate = true; geo.computeVertexNormals();
        carpet.position.y = -0.03 + Math.sin(t * 2) * 0.03; carpet.rotation.z = Math.sin(t * 1.2) * 0.05;
        tassels.forEach((tt, i) => { tt.rotation.z = Math.sin(t * 6 + i) * 0.25; });
        sparks.forEach((sp, i) => { const k = (t * 0.6 + i / 8) % 1; sp.position.set(Math.sin(i * 2.4) * 0.8, -0.1 - k * 0.6, -1.3 - k * 1.2); sp.scale.setScalar(1 - k); sp.rotation.y = t * 3 + i; });
      },
    };
  },

  bike(C) {
    // a sky bike you sit on and drive (seat at y = 0.6, handlebars at the hands of the 'sit' pose)
    if (!C.bike) {
      const ringTex = canvasTex(64, 64, (x, w, h) => { const gr = x.createRadialGradient(32, 32, 10, 32, 32, 32); gr.addColorStop(0, 'rgba(90,240,255,0)'); gr.addColorStop(0.7, 'rgba(90,240,255,0.85)'); gr.addColorStop(1, 'rgba(90,240,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
      const flameTex = canvasTex(16, 128, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(120,230,255,0.9)'); gr.addColorStop(1, 'rgba(40,120,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
      C.bike = {
        red: std({ color: 0xd8182a, roughness: 0.25, metalness: 0.45 }), black: std({ color: 0x16171c, roughness: 0.5, metalness: 0.3 }),
        chrome: std({ color: 0xdfe4ec, roughness: 0.15, metalness: 1 }), seat: std({ color: 0x1c1410, roughness: 0.7 }),
        tire: new THREE.TorusGeometry(0.34, 0.1, 10, 24), rim: new THREE.CylinderGeometry(0.25, 0.25, 0.1, 18), spoke: new THREE.BoxGeometry(0.03, 0.48, 0.02),
        tank: new THREE.SphereGeometry(1, 18, 12), seatGeo: new RoundedBoxGeometry(0.34, 0.12, 0.7, 2, 0.05),
        headlight: new THREE.CircleGeometry(0.1, 16), lightMat: glow(0xfff4c0),
        ring: new THREE.PlaneGeometry(1, 1), ringMat: new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
        flame: new THREE.ConeGeometry(0.07, 0.6, 10, 1, true), flameMat: new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      };
    }
    const K = C.bike, g = new THREE.Group(), bike = new THREE.Group(); g.add(bike);
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, parent = bike) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); parent.add(m); return m; };
    // wheels (spinning)
    const wheels = [];
    for (const z of [0.82, -0.78]) {
      const w = new THREE.Group(); w.position.set(0, 0.3, z); bike.add(w); wheels.push(w);
      add(K.tire, K.black, 0, 0, 0, 0, Math.PI / 2, 0, 1, 1, 1, w);
      add(K.rim, K.chrome, 0, 0, 0, 0, 0, Math.PI / 2, 1, 1, 1, w);
      for (let i = 0; i < 3; i++) add(K.spoke, K.red, 0, 0, 0, i * Math.PI / 3, 0, 0, 1, 1, 1, w);
      const ring = add(K.ring, K.ringMat, 0, 0, 0, 0, Math.PI / 2, 0, 1.1, 1.1, 1.1, w); ring.renderOrder = 7;
    }
    // frame, tank, seat, engine
    bike.add(rod(new THREE.Vector3(0, 0.3, 0.82), new THREE.Vector3(0, 0.92, 0.46), 0.04, K.chrome, 8));   // fork
    bike.add(rod(new THREE.Vector3(0, 0.3, -0.78), new THREE.Vector3(0, 0.55, -0.1), 0.045, K.black, 8)); // swingarm
    add(K.tank, K.red, 0, 0.72, 0.28, 0.25, 0, 0, 0.2, 0.15, 0.36);                                        // tank
    add(K.tank, K.red, 0, 0.42, -0.62, -0.2, 0, 0, 0.16, 0.12, 0.42);                                     // tail
    add(K.tank, K.black, 0, 0.36, 0.05, 0, 0, 0, 0.2, 0.2, 0.3);                                         // engine
    add(K.seatGeo, K.seat, 0, 0.56, -0.2, 0.06);
    bike.add(rod(new THREE.Vector3(-0.36, 0.94, 0.42), new THREE.Vector3(0.36, 0.94, 0.42), 0.024, K.chrome, 6));   // handlebar
    for (const sx of [-1, 1]) add(K.seatGeo, K.seat, sx * 0.31, 0.94, 0.42, 0, 0, Math.PI / 2, 0.42, 0.9, 0.17);   // grips
    add(K.headlight, K.lightMat, 0, 0.8, 0.62, 0, 0, 0);
    add(K.tank, K.chrome, 0, 0.8, 0.56, 0, 0, 0, 0.12, 0.12, 0.08);
    // exhausts with blue jet flames
    const flames = [];
    for (const sx of [-1, 1]) {
      bike.add(rod(new THREE.Vector3(sx * 0.16, 0.3, 0.1), new THREE.Vector3(sx * 0.18, 0.44, -0.75), 0.04, K.chrome, 8));
      const f = add(K.flame, K.flameMat, sx * 0.18, 0.45, -1.05, -Math.PI / 2 - 0.18, 0, 0); f.renderOrder = 8; flames.push(f);
    }
    return {
      g, pose: 'sit', anim: (t) => {
        for (const w of wheels) w.rotation.x = t * 14;
        flames.forEach((f, i) => f.scale.set(1, 0.8 + Math.sin(t * 30 + i * 2) * 0.25, 1));
        bike.position.y = Math.sin(t * 2.6) * 0.03; bike.rotation.z = Math.sin(t * 1.1) * 0.06; bike.rotation.x = -0.05 + Math.sin(t * 1.7) * 0.02;
      },
    };
  },

  hand(C) {
    // a giant open hand rising from a cloud; you stand on the palm (palm top at y = 0), fingers out in front
    if (!C.hand) {
      C.hand = {
        skin: std({ color: 0xe8b48c, roughness: 0.6, metalness: 0 }), nail: std({ color: 0xf6d7c4, roughness: 0.3 }),
        cuff: std({ color: 0xf4f4f6, roughness: 0.7 }), cloud: std({ color: 0xffffff, roughness: 1, emissive: 0xc9d8ff, emissiveIntensity: 0.25 }),
        palm: new RoundedBoxGeometry(1.7, 0.42, 1.7, 4, 0.2), seg: new THREE.CapsuleGeometry(0.17, 0.42, 6, 12), ball: new THREE.SphereGeometry(1, 14, 10),
        arm: new THREE.CylinderGeometry(0.62, 0.78, 2.4, 20), cuffGeo: new THREE.TorusGeometry(0.66, 0.14, 10, 24),
      };
    }
    const K = C.hand, g = new THREE.Group(), hand = new THREE.Group(); g.add(hand);
    hand.position.y = -0.22;
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, parent = hand) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); parent.add(m); return m; };
    add(K.palm, K.skin, 0, 0, 0);
    // four fingers pointing forward (+Z), curling up a little at the tips
    const fingers = [];
    [[-0.6, 0.95], [-0.2, 1.05], [0.2, 1.0], [0.58, 0.85]].forEach(([x, len], i) => {
      const f = new THREE.Group(); f.position.set(x, 0.02, 0.8); hand.add(f);
      const a = add(K.seg, K.skin, 0, 0, len * 0.27, Math.PI / 2, 0, 0, 1, len, 1, f);
      const tip = new THREE.Group(); tip.position.set(0, 0, len * 0.56); f.add(tip);
      add(K.seg, K.skin, 0, 0, 0.18, Math.PI / 2 - 0.0, 0, 0, 0.95, 0.85, 0.95, tip);
      add(K.ball, K.nail, 0, 0.12, 0.36, 0, 0, 0, 0.11, 0.04, 0.12, tip);
      tip.rotation.x = -0.45; fingers.push({ f, tip, i });
    });
    // thumb out to the side
    const thumb = new THREE.Group(); thumb.position.set(-0.85, 0.02, 0.15); thumb.rotation.y = -0.9; hand.add(thumb);
    add(K.seg, K.skin, 0, 0, 0.3, Math.PI / 2, 0, 0, 1.15, 1.0, 1.15, thumb);
    // wrist and forearm going down into a cloud
    add(K.arm, K.skin, 0, -1.2, -0.75, 0.55, 0, 0);
    add(K.cuffGeo, K.cuff, 0, -1.55, -0.95, Math.PI / 2 + 0.55, 0, 0);
    const puffs = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; puffs.push(add(K.ball, K.cloud, Math.cos(a) * 0.75, -2.2 + Math.sin(i * 1.7) * 0.1, -1.35 + Math.sin(a) * 0.6, 0, 0, 0, 0.55, 0.42, 0.55)); }
    return {
      g, pose: 'ride', anim: (t) => {
        hand.position.y = -0.22 + Math.sin(t * 1.8) * 0.05; hand.rotation.z = Math.sin(t * 1.1) * 0.05;
        for (const { tip, i } of fingers) tip.rotation.x = -0.45 - Math.max(0, Math.sin(t * 1.5 + i * 0.5)) * 0.15;
        puffs.forEach((p, i) => p.scale.setScalar(0.5 + Math.sin(t * 2 + i) * 0.05));
      },
    };
  },

  dragon(C) {
    if (!C.dragon) {
      const red = std({ color: 0xa3121c, roughness: 0.5, metalness: 0.2 });
      const dark = std({ color: 0x5a0a10, roughness: 0.6 });
      const gold = std({ color: 0xe0a63a, roughness: 0.35, metalness: 0.6 });
      const ivory = std({ color: 0xefe4c8, roughness: 0.4 });
      const membrane = std({ color: 0xc21d2a, roughness: 0.65, side: THREE.DoubleSide, emissive: 0x3a0508, emissiveIntensity: 0.6 });
      const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 3.35, -1.05), new THREE.Vector3(0.12, 3.45, -1.95), new THREE.Vector3(-0.18, 3.62, -2.8), new THREE.Vector3(0.06, 3.88, -3.5)]);
      const neckCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 3.45, 0.95), new THREE.Vector3(0, 3.75, 1.5), new THREE.Vector3(0, 3.9, 2.0)]);
      // wing membrane: shoulder at origin, spans +X
      const ws = new THREE.Shape();
      ws.moveTo(0, 0.35); ws.lineTo(1.3, 0.55); ws.lineTo(2.9, 0.15); ws.lineTo(2.55, -0.35); ws.quadraticCurveTo(2.1, -0.25, 1.9, -0.75);
      ws.quadraticCurveTo(1.45, -0.6, 1.15, -1.0); ws.quadraticCurveTo(0.8, -0.75, 0.45, -1.05); ws.quadraticCurveTo(0.2, -0.6, 0, -0.5); ws.lineTo(0, 0.35);
      C.dragon = {
        red, dark, gold, ivory, membrane,
        sphere: new THREE.SphereGeometry(1, 18, 12),
        tail: taperedTube(tailCurve, 30, 8, u => 0.24 * (1 - u) + 0.02),
        neck: taperedTube(neckCurve, 12, 10, u => 0.26 - u * 0.08),
        spade: new THREE.ConeGeometry(0.16, 0.32, 4), horn: new THREE.ConeGeometry(0.05, 0.4, 6), spike: new THREE.ConeGeometry(0.05, 0.16, 4),
        wing: new THREE.ShapeGeometry(ws, 12), eye: new THREE.SphereGeometry(0.04, 8, 6), eyeMat: glow(0xffd21a),
        leg: new THREE.CylinderGeometry(0.07, 0.11, 1, 8), claw: new THREE.ConeGeometry(0.025, 0.12, 5),
      };
    }
    const D = C.dragon, g = new THREE.Group();
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); g.add(m); return m; };
    add(D.sphere, D.red, 0, 3.35, 0, 0.5, 0.4, 1.25);
    add(D.sphere, D.gold, 0, 3.17, 0.08, 0.38, 0.24, 1.05);
    add(D.neck, D.red, 0, 0, 0);
    add(D.tail, D.red, 0, 0, 0);
    add(D.spade, D.dark, 0.06, 3.98, -3.72, 1, 1, 0.25, -Math.PI / 2 - 0.35, 0, 0);
    for (let i = 0; i < 6; i++) add(D.spike, D.dark, 0, 3.74 - i * 0.02, 0.9 - i * 0.42, 1, 1, 1, -0.3, 0, 0);
    // head
    const head = new THREE.Group(); head.position.set(0, 3.95, 2.15); g.add(head);
    const hm = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); head.add(m); return m; };
    hm(D.sphere, D.red, 0, 0, 0, 0.3, 0.26, 0.42);
    hm(D.sphere, D.red, 0, -0.06, 0.38, 0.2, 0.15, 0.32);
    const jaw = hm(D.sphere, D.dark, 0, -0.17, 0.3, 0.17, 0.07, 0.3);
    for (const s of [-1, 1]) {
      hm(D.horn, D.ivory, s * 0.15, 0.2, -0.22, 1, 1, 1, -1.1, 0, s * 0.35);
      hm(D.eye, D.eyeMat, s * 0.17, 0.08, 0.2, 1, 1, 1);
    }
    // wings
    const wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.36, 3.6, 0.3); g.add(pivot);
      const wing = new THREE.Group(); wing.scale.setScalar(1.3); wing.rotation.x = -0.62; pivot.add(wing);   // angled so the membrane shows from behind
      const w = new THREE.Mesh(D.wing, D.membrane); w.rotation.x = Math.PI / 2; if (s < 0) w.scale.x = -1; wing.add(w);
      for (const [x, z] of [[1.3, 0.55], [2.9, 0.15], [1.9, -0.75], [1.15, -1.0], [0.45, -1.05]]) {
        wing.add(rod(new THREE.Vector3(0, 0.01, 0), new THREE.Vector3(s * x, 0.02, z), 0.04, D.gold, 5));
      }
      wings.push({ pivot, s });
    }
    // hind legs reaching down to grab your hands
    for (const [s, h] of [[1, HAND_L], [-1, HAND_R]]) {
      const hip = new THREE.Vector3(s * 0.3, 3.05, -0.1), foot = h.clone().setY(h.y + 0.12);
      g.add(rod(hip, foot, 0.08, D.red, 7));
      for (const dx of [-0.05, 0, 0.05]) { const c = new THREE.Mesh(D.claw, D.ivory); c.position.set(foot.x + dx, foot.y - 0.08, foot.z + 0.05); c.rotation.x = Math.PI * 0.85; g.add(c); }
    }
    return {
      g, pose: 'hang', anim: (t) => {
        for (const { pivot, s } of wings) pivot.rotation.z = s * (0.42 + Math.sin(t * 3.6) * 0.5);
        head.rotation.y = Math.sin(t * 0.8) * 0.18; jaw.position.y = -0.17 - Math.max(0, Math.sin(t * 1.7)) * 0.05;
        g.position.y = Math.sin(t * 3.6 + 1.2) * 0.06;
      },
    };
  },

  saucer(C) {
    if (!C.saucer) {
      const prof = [[0, -0.32], [0.9, -0.3], [1.9, -0.12], [2.25, 0], [1.95, 0.14], [1.1, 0.24], [0, 0.26]].map(([r, y]) => new THREE.Vector2(r, y));
      const beamTex = canvasTex(8, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(180,255,220,0.85)'); g.addColorStop(0.6, 'rgba(80,255,170,0.3)'); g.addColorStop(1, 'rgba(40,255,140,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
      C.saucer = {
        hull: new THREE.LatheGeometry(prof, 40), hullMat: std({ color: 0xb9c3d3, roughness: 0.2, metalness: 0.9 }),
        dome: new THREE.SphereGeometry(0.85, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat: std({ color: 0x8ff3ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55, emissive: 0x0b5560, emissiveIntensity: 0.6 }),
        rim: new THREE.TorusGeometry(2.25, 0.06, 6, 48), rimMat: std({ color: 0x5a6476, roughness: 0.3, metalness: 0.8 }),
        light: new THREE.SphereGeometry(0.09, 8, 6), lightMats: [glow(0x5ff4ff), glow(0xff5ce0), glow(0xffe14d)],
        beam: new THREE.CylinderGeometry(0.75, 1.6, 4.6, 24, 1, true), beamMat: new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
        ring: new THREE.TorusGeometry(1, 0.03, 4, 32), ringMat: glow(0x7dffc4, { transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
        alien: new THREE.SphereGeometry(0.22, 12, 10), alienMat: std({ color: 0x7ee35a, roughness: 0.5 }),
      };
    }
    const S = C.saucer, g = new THREE.Group(), ship = new THREE.Group();
    ship.position.y = 4.7; g.add(ship);
    ship.add(new THREE.Mesh(S.hull, S.hullMat));
    const dome = new THREE.Mesh(S.dome, S.domeMat); dome.position.y = 0.24; ship.add(dome);
    const alien = new THREE.Mesh(S.alien, S.alienMat); alien.position.y = 0.45; alien.scale.set(1, 1.2, 1); ship.add(alien);
    const rim = new THREE.Mesh(S.rim, S.rimMat); rim.rotation.x = Math.PI / 2; ship.add(rim);
    const lights = [];
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const l = new THREE.Mesh(S.light, S.lightMats[i % 3]); l.position.set(Math.cos(a) * 2.05, -0.06, Math.sin(a) * 2.05); ship.add(l); lights.push(l); }
    const beam = new THREE.Mesh(S.beam, S.beamMat); beam.position.y = 2.2; beam.renderOrder = 7; g.add(beam);
    const rings = [];
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(S.ring, S.ringMat); r.rotation.x = Math.PI / 2; r.renderOrder = 8; g.add(r); rings.push(r); }
    return {
      g, pose: 'float', anim: (t) => {
        ship.rotation.y = t * 0.9; ship.position.y = 4.7 + Math.sin(t * 1.4) * 0.08;
        lights.forEach((l, i) => l.scale.setScalar(0.7 + 0.6 * Math.max(0, Math.sin(t * 6 - i * 0.9))));
        rings.forEach((r, i) => { const k = (t * 0.5 + i / 3) % 1; r.position.y = 4.3 - k * 4.4; const s = 0.8 + k * 0.85; r.scale.set(s, s, s); });
        S.beamMat.opacity = 0.75 + Math.sin(t * 7) * 0.2;
      },
    };
  },
};

/** Build a glider of type id. cache: any object to keep shared geometry/materials on (the CharacterFactory). */
export function makeGlider(id, cache) {
  const C = cache._gliders || (cache._gliders = {});
  const b = (BUILD[id] || BUILD.military)(C);
  b.g.userData.id = BUILD[id] ? id : 'military';
  b.g.userData.pose = b.pose;
  b.g.userData.anim = b.anim || null;
  b.g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return b.g;
}
