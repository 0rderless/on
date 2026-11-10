// The futuristic layer shared by every map: a glowing energy grid in the floor, neon trims on structures,
// holographic zone signs, patrol drones, an energy shield over the perimeter and a distant megacity skyline.
// Static pieces go through the world's merged buckets (few draw calls); the animated ones are a handful of
// small meshes driven from world.animated.
import * as THREE from 'three';
import { MAP_HALF } from '../config.js';

const L = MAP_HALF;

/** Per-map look. */
export const FUTURE = {
  compound: {
    floor: ['floor'], floorTint: 0x7a74bb, grid: 0x7df6ff, gridB: 0xffffff, spacing: 8,
    trimMats: ['concrete', 'dark', 'darker', 'block', 'teal', 'tealDark', 'plate', 'platePurple', 'contA', 'contB', 'contC'], trimA: 0x5ff4ff, trimB: 0xb06bff,
    holo: 0x7df6ff, drones: 16, droneLight: 0xff5cf0, shield: 0x8a6cff, shieldY: 18, shieldH: 26, skyline: [0x3f3a78, 0xb9a8ff, 0x5ff4ff], pylons: 14, pylon: 0x5ff4ff,
  },
  vulcan: {
    floor: ['vgDeck'], grid: 0x2f8dff, gridB: 0xff8a2a, spacing: 8,
    trimMats: ['vgPanel', 'vgPanelB', 'vgTank'], trimA: 0x4fb6ff, trimB: 0xff8a2a,
    holo: 0x6fd0ff, drones: 16, droneLight: 0xff8a2a, shield: 0x2f8dff, shieldY: 0, shieldH: 14, skyline: [0x0d1322, 0x4fb6ff, 0xff8a2a], pylons: 12, pylon: 0x4fb6ff,
  },
  warehouse: {
    floor: ['whFloor'], grid: 0x38c8ff, gridB: 0xff9a3c, spacing: 8,
    trimMats: ['whWall', 'whWallDark', 'roomWall', 'coldWall', 'whPanel'], trimA: 0x38c8ff, trimB: 0xff9a3c,
    holo: 0x8fe2ff, drones: 12, droneLight: 0x38c8ff, shield: 0, skyline: null, pylons: 10, pylon: 0xff9a3c, droneY: [9, 15],
  },
};

function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }

// ------------------------------------------------------------------ static: materials + trim hook
/** Call before the map is built: registers the neon materials and hooks world.box so structures get edge trims. */
export function futurizeBegin(w) {
  const F = FUTURE[w.mapId] || FUTURE.compound;
  const basic = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  w.mats.fxTrimA = { mat: basic(F.trimA), uv: 'unit', scale: 1, shadow: false };
  w.mats.fxTrimB = { mat: basic(F.trimB), uv: 'unit', scale: 1, shadow: false };
  w.mats.fxPylon = { mat: basic(F.pylon), uv: 'unit', scale: 1, shadow: false };
  w.mats.fxMetal = { mat: w.quality === 'low' ? new THREE.MeshLambertMaterial({ color: 0x242838 }) : new THREE.MeshStandardMaterial({ color: 0x242838, roughness: 0.4, metalness: 0.75 }), uv: 'world', scale: 2, shadow: true };
  const allow = new Set(F.trimMats);
  let n = 0;
  w.trim = (x, y0, z, bw, h, d, mat) => {
    if (!allow.has(mat) || h < 2.4 || h > 26 || Math.min(bw, d) < 2.2 || Math.max(bw, d) > 64 || n > 520) return;
    const k = hash(x, z);
    if (k < 0.22) return;                       // leave some plain
    n++;
    const key = k < 0.62 ? 'fxTrimA' : 'fxTrimB';
    const y = y0 + h - 0.16, t = 0.07, o = 0.03;
    const prev = w.layer; // keep trims in the same layer as the box they sit on
    w.pushBox(key, x, y, z - d / 2 - o, bw + 0.1, t, 0.05);
    w.pushBox(key, x, y, z + d / 2 + o, bw + 0.1, t, 0.05);
    w.pushBox(key, x - bw / 2 - o, y, z, 0.05, t, d + 0.1);
    w.pushBox(key, x + bw / 2 + o, y, z, 0.05, t, d + 0.1);
    // tall structures also get a light line down two corners
    if (h > 6 && k > 0.5) for (const [sx, sz] of [[-1, -1], [1, 1]]) w.pushBox(key, x + sx * (bw / 2 + o), y0 + h / 2, z + sz * (d / 2 + o), 0.06, h - 0.6, 0.06);
    w.layer = prev;
  };
}

/** Call after the map's own pieces are placed, before finalize(): energy pylons on free ground. */
export function futurizeStatic(w) {
  const F = FUTURE[w.mapId] || FUTURE.compound;
  let s = 99173;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let placed = 0;
  const saved = w.trim; w.trim = null;
  for (let tries = 0; tries < 600 && placed < F.pylons; tries++) {
    const x = (rnd() - 0.5) * (L * 2 - 40), z = (rnd() - 0.5) * (L * 2 - 40);
    if (Math.hypot(x, z) < 14) continue;
    if (!w.col.isFree(x, 0.05, z, 2.2, 9)) continue;
    const g = w.col.groundHeight(x, z, 0.3, 0.5, 0.5);
    if (g > 0.2) continue;
    const H = w.mapId === 'warehouse' ? 5.5 : 7.5;
    w.cyl(x, 0, z, 0.55, 0.35, 'fxMetal', { seg: 8 });
    w.cyl(x, 0.35, z, 0.14, H - 1.2, 'fxMetal', { seg: 6 });
    w.pushBox('fxPylon', x, H * 0.45, z, 0.32, 0.08, 0.32);
    w.pushBox('fxPylon', x, H * 0.62, z, 0.3, 0.08, 0.3);
    w.pushGeometry('fxPylon', new THREE.OctahedronGeometry(0.42, 0), new THREE.Matrix4().makeTranslation(x, H - 0.25, z));
    w.pushGeometry('fxMetal', new THREE.TorusGeometry(0.62, 0.05, 5, 16), new THREE.Matrix4().makeTranslation(x, H - 0.25, z).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    placed++;
  }
  w.trim = saved;
}

// ------------------------------------------------------------------ dynamic pieces
function holoTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  const col = '#' + new THREE.Color(color).getHexString();
  x.fillStyle = 'rgba(10,16,40,0.38)'; x.fillRect(8, 20, 496, 88);
  x.strokeStyle = col; x.lineWidth = 4;
  // corner brackets
  for (const [px, py, sx, sy] of [[8, 20, 1, 1], [504, 20, -1, 1], [8, 108, 1, -1], [504, 108, -1, -1]]) { x.beginPath(); x.moveTo(px + sx * 34, py); x.lineTo(px, py); x.lineTo(px, py + sy * 26); x.stroke(); }
  x.font = 'bold 54px "Russo One", Rajdhani, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = col; x.shadowBlur = 18; x.fillStyle = '#ffffff';
  let size = 54; while (x.measureText(text).width > 440 && size > 26) { size -= 2; x.font = `bold ${size}px "Russo One", Rajdhani, Impact, sans-serif`; }
  x.fillText(text, 256, 66);
  // scan lines
  x.shadowBlur = 0; x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 20; y < 108; y += 5) x.fillRect(8, y, 496, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Floor material: glowing grid lines with a pulse travelling out from the centre of the map. */
function patchFloor(mat, uTime, colA, colB, spacing) {
  const a = new THREE.Color(colA), b = new THREE.Color(colB);
  const v3 = (c) => `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uFxT = uTime;
    sh.vertexShader = 'varying vec3 vFxW; varying float vFxUp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFxW = (modelMatrix * vec4(transformed, 1.0)).xyz; vFxUp = normal.y;');
    sh.fragmentShader = 'varying vec3 vFxW; varying float vFxUp; uniform float uFxT;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      {
        float S = ${spacing.toFixed(1)};
        vec2 gq = abs(fract(vFxW.xz / S - 0.5) - 0.5) * S;
        float dist = length(vViewPosition);
        float wdt = 0.035 + dist * 0.0022;                         // lines stay about a pixel wide far away
        float line = 1.0 - smoothstep(0.0, wdt, min(gq.x, gq.y));
        vec2 gq2 = abs(fract(vFxW.xz / (S * 0.25) - 0.5) - 0.5) * S * 0.25;
        float fine = (1.0 - smoothstep(0.0, wdt * 0.7, min(gq2.x, gq2.y))) * (1.0 - smoothstep(12.0, 34.0, dist));
        float rd = length(vFxW.xz);
        float pulse = 1.0 - smoothstep(0.0, 7.0, abs(rd - mod(uFxT * 26.0, 300.0)));
        float fade = 1.0 - smoothstep(55.0, 130.0, dist);
        float up = step(0.5, vFxUp);   // only the top face
        vec3 gc = mix(${v3(a)}, ${v3(b)}, pulse);
        totalEmissiveRadiance += gc * up * fade * (line * (0.55 + pulse * 1.2) + fine * (0.12 + pulse * 0.4));
      }`);
  };
  mat.customProgramCacheKey = () => 'fxfloor' + colA + colB;
  mat.needsUpdate = true;
}

/** Call after finalize(): everything that animates. */
export function futurizeDynamic(w) {
  const F = FUTURE[w.mapId] || FUTURE.compound;
  const uT = { value: 0 };
  w.animated.push(t => { uT.value = t; });
  const low = w.quality === 'low';
  // ---- energy grid in the floor
  for (const key of F.floor) if (w.mats[key]) { if (F.floorTint) w.mats[key].mat.color.setHex(F.floorTint); patchFloor(w.mats[key].mat, uT, F.grid, F.gridB, F.spacing); }

  // ---- holographic zone signs floating over every named location
  const holoY = w.mapId === 'warehouse' ? 9.5 : 17;
  for (const p of w.pois) {
    const mat = new THREE.SpriteMaterial({ map: holoTexture(p.name.toUpperCase(), F.holo), color: F.holo, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(mat);
    const sc = w.mapId === 'warehouse' ? 9 : 15;
    s.scale.set(sc, sc / 4, 1); s.position.set(p.x, holoY, p.z); s.renderOrder = 6;
    w.roof.add(s);   // roof layer: not baked into the minimap image
    const ph = hash(p.x, p.z) * 6.28;
    w.animated.push(t => { s.position.y = holoY + Math.sin(t * 0.9 + ph) * 0.5; mat.opacity = 0.78 + 0.18 * Math.sin(t * 7 + ph) * Math.sin(t * 1.3 + ph); });
  }

  // ---- patrol drones (one instanced draw for the bodies, one for their lights)
  if (!low) {
    const body = new THREE.Group();
    const parts = [];
    const add = (g, x, y, z) => { g.translate(x, y, z); parts.push(g); };
    add(new THREE.BoxGeometry(0.9, 0.22, 1.5), 0, 0, 0);
    add(new THREE.BoxGeometry(2.6, 0.08, 0.3), 0, 0.02, 0.2);
    for (const sx of [-1, 1]) { const c = new THREE.CylinderGeometry(0.38, 0.38, 0.1, 10); add(c, sx * 1.3, 0.06, 0.2); }
    add(new THREE.BoxGeometry(0.3, 0.3, 0.5), 0, 0.16, -0.4);
    // merge by hand (all non-indexed boxes/cylinders share attributes)
    let count = 0; for (const g of parts) count += g.toNonIndexed().attributes.position.count;
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3); let o = 0;
    for (const g of parts) { const n = g.toNonIndexed(); pos.set(n.attributes.position.array, o); nor.set(n.attributes.normal.array, o); o += n.attributes.position.array.length; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const N = F.drones;
    const drones = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x2a2f44, roughness: 0.4, metalness: 0.7 }), N);
    const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: F.droneLight, toneMapped: false }), N * 2);
    drones.frustumCulled = lights.frustumCulled = false; drones.castShadow = false;
    w.roof.add(drones, lights);
    const [y0, y1] = F.droneY || [22, 46];
    const paths = [];
    for (let i = 0; i < N; i++) paths.push({ cx: (hash(i, 1) - 0.5) * L * 1.2, cz: (hash(i, 2) - 0.5) * L * 1.2, rx: 30 + hash(i, 3) * 90, rz: 30 + hash(i, 4) * 90, y: y0 + hash(i, 5) * (y1 - y0), sp: (0.05 + hash(i, 6) * 0.07) * (hash(i, 7) < 0.5 ? -1 : 1), ph: hash(i, 8) * 6.28 });
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    w.animated.push(t => {
      for (let i = 0; i < N; i++) {
        const d = paths[i], a = t * d.sp + d.ph;
        p.set(d.cx + Math.cos(a) * d.rx, d.y + Math.sin(t * 0.7 + d.ph) * 1.2, d.cz + Math.sin(a) * d.rz);
        const lim = L - 6; p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z));
        const hx = -Math.sin(a) * d.rx * d.sp, hz = Math.cos(a) * d.rz * d.sp;
        e.set(0, Math.atan2(hx, hz), Math.sin(a * 2) * 0.12); q.setFromEuler(e);
        m.compose(p, q, one); drones.setMatrixAt(i, m);
        const blink = (Math.sin(t * 6 + i) > 0.3) ? 1 : 0.15;
        for (const sx of [-1, 1]) { v.set(sx * 1.3, -0.08, 0.2).applyQuaternion(q).add(p); m.compose(v, q, one.set(blink, blink, blink)); lights.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), m); one.set(1, 1, 1); }
      }
      drones.instanceMatrix.needsUpdate = true; lights.instanceMatrix.needsUpdate = true;
    });
  }

  // ---- energy shield rising from the perimeter
  if (F.shield) {
    const col = new THREE.Color(F.shield);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT, uCol: { value: col } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float uT; uniform vec3 uCol; varying vec2 vUv; varying vec3 vW;
        float hex(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.0) * 0.5; p = abs(fract(p) - 0.5); return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0); }
        void main(){
          vec2 p = vec2(vW.x + vW.z, vW.y) * 0.22;
          float h = 1.0 - smoothstep(0.0, 0.09, hex(p));
          float sweep = 0.5 + 0.5 * sin(vW.y * 0.5 - uT * 1.6 + (vW.x + vW.z) * 0.02);
          float fade = pow(1.0 - vUv.y, 1.6);
          float a = (h * (0.25 + 0.55 * sweep) + 0.05) * fade;
          gl_FragColor = vec4(uCol * (0.7 + 0.6 * sweep), a);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const H = F.shieldH, y = F.shieldY, e = L + 0.2;
    const g = new THREE.BufferGeometry();
    const P = [], U = [], I = [];
    const quad = (x1, z1, x2, z2) => { const b = P.length / 3; P.push(x1, y, z1, x2, y, z2, x2, y + H, z2, x1, y + H, z1); U.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    quad(-e, -e, e, -e); quad(e, -e, e, e); quad(e, e, -e, e); quad(-e, e, -e, -e);
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 6;
    w.roof.add(mesh);   // kept off the minimap render
  }

  // ---- megacity skyline far beyond the walls (one draw, hazy and unfogged)
  if (F.skyline && !low) {
    const [baseC, winA, winB] = F.skyline;
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#' + new THREE.Color(baseC).getHexString(); x.fillRect(0, 0, 128, 256);
    for (let yy = 6; yy < 250; yy += 8) for (let xx = 6; xx < 122; xx += 9) {
      const k = Math.random();
      if (k < 0.42) continue;
      x.fillStyle = k > 0.93 ? '#' + new THREE.Color(winB).getHexString() : '#' + new THREE.Color(winA).getHexString();
      x.globalAlpha = 0.25 + Math.random() * 0.6; x.fillRect(xx, yy, 5, 4);
    }
    x.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const P = [], U = [], I = [];
    let s = 4711; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const tower = (cx, cz, wx, wz, h, y0) => {
      const corners = [[-wx, -wz], [wx, -wz], [wx, wz], [-wx, wz]];
      for (let i = 0; i < 4; i++) {
        const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4], b = P.length / 3;
        P.push(cx + ax, y0, cz + az, cx + bx, y0, cz + bz, cx + bx, y0 + h, cz + bz, cx + ax, y0 + h, cz + az);
        const ur = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 14)), vr = h / 42;
        U.push(0, 0, ur, 0, ur, vr, 0, vr); I.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    };
    const baseY = w.mapId === 'vulcan' ? -60 : 0;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2 + rnd() * 0.08, r = 300 + rnd() * 170;
      const h = 34 + rnd() * rnd() * 78, wd = 9 + rnd() * 16;
      tower(Math.cos(a) * r, Math.sin(a) * r, wd, 8 + rnd() * 14, h, baseY);
      if (rnd() < 0.45) tower(Math.cos(a) * r, Math.sin(a) * r, wd * 0.45, wd * 0.45, h + 10 + rnd() * 22, baseY);   // spire on top
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false, side: THREE.DoubleSide }));
    mesh.frustumCulled = false; mesh.renderOrder = -5;
    w.roof.add(mesh);
  }
}
