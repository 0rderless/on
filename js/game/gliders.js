// Gliders (the "parachutes" you deploy after skydiving). Each returns a Group placed on the character root
// (origin at the feet, +Z forward) with userData { id, pose, anim(t, dt) }.
// pose: 'hang' (hands up on a bar/reins), 'canopy' (hands high on risers), 'ride' (standing on it), 'float'.
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
  volt(C) {
    if (!C.volt) {
      const shape = new THREE.Shape();
      shape.moveTo(-1.4, 0); shape.quadraticCurveTo(0, 0.55, 1.4, 0); shape.lineTo(1.1, -0.25); shape.quadraticCurveTo(0, 0.2, -1.1, -0.25); shape.lineTo(-1.4, 0);
      const tex = canvasTex(256, 64, (x) => {
        const g = x.createLinearGradient(0, 0, 256, 0);
        g.addColorStop(0, '#5b2bd6'); g.addColorStop(0.5, '#9a5cff'); g.addColorStop(1, '#5b2bd6');
        x.fillStyle = g; x.fillRect(0, 0, 256, 64);
        x.fillStyle = '#ffe14d'; x.beginPath(); x.moveTo(118, 8); x.lineTo(100, 36); x.lineTo(126, 36); x.lineTo(112, 58); x.lineTo(156, 24); x.lineTo(130, 24); x.lineTo(142, 8); x.fill();
        x.fillStyle = 'rgba(79,242,255,0.9)'; x.fillRect(0, 0, 256, 5); x.fillRect(0, 59, 256, 5);
      });
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false });
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 1.4) / 2.8, pos.getZ(i) / 0.9);
      C.volt = {
        geo, mat: std({ map: tex, metalness: 0.2, side: THREE.DoubleSide, emissive: 0x2a0f6a, emissiveIntensity: 0.6 }),
        trim: glow(0x5ff4ff), rope: new THREE.MeshBasicMaterial({ color: 0x222233 }),
      };
    }
    const V = C.volt, g = new THREE.Group();
    const wing = new THREE.Mesh(V.geo, V.mat); wing.rotation.x = Math.PI / 2; wing.position.set(0, 2.62, 0.45);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.04, 0.05), V.trim); trim.position.set(0, 2.69, 0.46);
    g.add(wing, trim);
    for (const [h, x] of [[HAND_L, 0.55], [HAND_R, -0.55]]) g.add(rod(new THREE.Vector3(x, 2.55, 0.05), h.clone().setY(h.y + 0.05), 0.012, V.rope, 4));
    g.add(rod(HAND_L.clone().setY(2.0), HAND_R.clone().setY(2.0), 0.022, V.rope, 6));
    return { g, pose: 'hang' };
  },

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
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(S.spray, S.sprayMat); board.add(s); spray.push(s); }
    board.position.y = -0.07;
    g.add(board);
    return {
      g, pose: 'ride', anim: (t) => {
        board.position.y = -0.07 + Math.sin(t * 3.2) * 0.03; board.rotation.z = Math.sin(t * 1.7) * 0.07; board.rotation.x = -0.14 + Math.sin(t * 2.3) * 0.04; board.rotation.y = 0.55;
        spray.forEach((s, i) => { const k = ((t * 1.6 + i / 6) % 1); s.position.set(Math.sin(i * 2.1) * 0.35 * (1 + k), -0.05 - k * 0.5, -1.0 - k * 1.6); s.scale.setScalar(1.2 - k); });
      },
    };
  },

  snake(C) {
    if (!C.snake) {
      // the body snakes across the sky (left to right) and the head turns to face forward
      const Y = 3.1, pts = [];
      for (let i = 0; i <= 12; i++) { const x = -3.0 + 5.0 * i / 12; pts.push(new THREE.Vector3(x, Y + Math.sin(x * 0.9) * 0.1, Math.sin(x * 1.5) * 0.55)); }
      pts.push(new THREE.Vector3(2.35, Y + 0.08, 0.35), new THREE.Vector3(2.5, Y + 0.14, 0.95));
      const curve = new THREE.CatmullRomCurve3(pts);
      const body = taperedTube(curve, 80, 12, u => 0.04 + 0.28 * Math.pow(Math.sin(Math.min(1, u * 1.08) * Math.PI * 0.62), 0.8));
      const scales = canvasTex(128, 64, (x, w, h) => {
        x.fillStyle = '#2f8a3a'; x.fillRect(0, 0, w, h);
        for (let yy = 0; yy < h; yy += 8) for (let xx = (yy / 8) % 2 ? 0 : 8; xx < w; xx += 16) { x.fillStyle = (xx + yy) % 32 ? '#256e2e' : '#3fa548'; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 8, yy + 4); x.lineTo(xx, yy + 8); x.lineTo(xx - 8, yy + 4); x.fill(); }
        x.fillStyle = '#d8c14a'; x.fillRect(0, h * 0.42, w, h * 0.16);
        x.fillStyle = '#16301a'; for (let xx = 0; xx < w; xx += 32) { x.beginPath(); x.ellipse(xx + 16, h * 0.18, 9, 6, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(xx, h * 0.82, 9, 6, 0, 0, Math.PI * 2); x.fill(); }
      }, [14, 1]);
      const mat = std({ map: scales, roughness: 0.35, metalness: 0.15 });
      const uTime = { value: 0 };
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uSnakeT = uTime;
        sh.vertexShader = 'uniform float uSnakeT;\n' + sh.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n float sk = clamp((2.1 - position.x) / 5.0, 0.0, 1.0);\n transformed.z += sin(position.x * 1.9 + uSnakeT * 5.0) * 0.34 * sk;\n transformed.y += sin(position.x * 1.3 + uSnakeT * 3.0) * 0.09 * sk;');
      };
      mat.customProgramCacheKey = () => 'oc-snake';
      const head = new THREE.SphereGeometry(1, 16, 12);
      C.snake = {
        body, mat, uTime, end: curve.getPointAt(1), dir: curve.getTangentAt(1),
        head, headMat: std({ color: 0x2c7f36, roughness: 0.35, metalness: 0.15 }), hoodMat: std({ color: 0x24692c, roughness: 0.45, side: THREE.DoubleSide }),
        eye: new THREE.SphereGeometry(0.05, 8, 6), eyeMat: glow(0xffd21a), pupil: new THREE.BoxGeometry(0.012, 0.07, 0.02), pupilMat: new THREE.MeshBasicMaterial({ color: 0x111111 }),
        fang: new THREE.ConeGeometry(0.022, 0.11, 6), fangMat: std({ color: 0xf4f0e2, roughness: 0.3 }),
        tongue: new THREE.BoxGeometry(0.03, 0.012, 0.32), tongueMat: std({ color: 0xc61f3b, roughness: 0.5 }),
        rein: new THREE.MeshBasicMaterial({ color: 0x3b2a16 }),
      };
    }
    const S = C.snake, g = new THREE.Group();
    const body = new THREE.Mesh(S.body, S.mat); g.add(body);
    const head = new THREE.Group(); head.position.copy(S.end); g.add(head);
    const skull = new THREE.Mesh(S.head, S.headMat); skull.scale.set(0.26, 0.17, 0.4); skull.position.z = 0.16; head.add(skull);
    const hood = new THREE.Mesh(S.head, S.hoodMat); hood.scale.set(0.55, 0.08, 0.36); hood.position.set(0, -0.02, -0.18); head.add(hood);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(S.eye, S.eyeMat); e.position.set(s * 0.15, 0.08, 0.3); head.add(e);
      const p = new THREE.Mesh(S.pupil, S.pupilMat); p.position.set(s * 0.165, 0.08, 0.34); head.add(p);
      const f = new THREE.Mesh(S.fang, S.fangMat); f.rotation.x = Math.PI; f.position.set(s * 0.07, -0.12, 0.46); head.add(f);
    }
    const tongue = new THREE.Mesh(S.tongue, S.tongueMat); tongue.position.set(0, -0.05, 0.62); head.add(tongue);
    // reins from the belly to the hands
    const belly = new THREE.Vector3(0, 2.85, 0.0);
    const rL = rod(belly, HAND_L, 0.014, S.rein, 4), rR = rod(belly, HAND_R, 0.014, S.rein, 4); g.add(rL, rR);
    g.add(rod(HAND_L.clone().setY(2.0), HAND_R.clone().setY(2.0), 0.025, S.rein, 6));
    return {
      g, pose: 'hang', anim: (t) => {
        S.uTime.value = t;
        head.rotation.y = Math.sin(t * 2.4) * 0.25; head.rotation.x = Math.sin(t * 1.3) * 0.08;
        tongue.scale.z = 0.5 + Math.max(0, Math.sin(t * 9)) * 0.8; tongue.position.z = 0.5 + tongue.scale.z * 0.13;
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
  const b = (BUILD[id] || BUILD.volt)(C);
  b.g.userData.id = BUILD[id] ? id : 'volt';
  b.g.userData.pose = b.pose;
  b.g.userData.anim = b.anim || null;
  b.g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return b.g;
}
