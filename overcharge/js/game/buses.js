// Map-themed battle buses. Each returns { group, anim(t) } with the nose pointing +Z and the
// passenger cabin at the origin (that's where the players ride).
//   compound  → a real coach bus slung under an OVERCHARGE hot-air balloon
//   warehouse → a tandem-rotor heavy-lift helicopter carrying a freight trailer
//   vulcan    → an armoured military VTOL dropship with tilt engines
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _up = new THREE.Vector3(0, 1, 0);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2, ...o });
const glow = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); parent.add(m); return m;
};
function rod(parent, a, b, r, mat, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1, true), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(_up, d.normalize());
  parent.add(m); return m;
}
function wheel(parent, x, y, z, r = 0.55, w = 0.38, tire, hub) {
  add(parent, new THREE.CylinderGeometry(r, r, w, 20), tire, x, y, z, 0, 0, Math.PI / 2);
  add(parent, new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 16), hub, x, y, z, 0, 0, Math.PI / 2);
  add(parent, new THREE.CylinderGeometry(r * 0.18, r * 0.18, w + 0.06, 8), tire, x, y, z, 0, 0, Math.PI / 2);
}
const exhaustTex = () => canvasTex(16, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(150,230,255,0.7)'); g.addColorStop(1, 'rgba(60,140,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });

// ===================================================================== Reversal Compound
function compoundBus() {
  const g = new THREE.Group();
  const paint = std({ color: 0x4a22b8, metalness: 0.55, roughness: 0.28 });
  const white = std({ color: 0xf1f0f7, metalness: 0.35, roughness: 0.3 });
  const chrome = std({ color: 0xdfe3ea, metalness: 1, roughness: 0.12 });
  const glass = std({ color: 0x162036, metalness: 0.6, roughness: 0.05, emissive: 0x0a1630, emissiveIntensity: 0.6 });
  const rubber = std({ color: 0x16171c, roughness: 0.85, metalness: 0 });
  const dark = std({ color: 0x23202e, roughness: 0.5, metalness: 0.4 });
  const L = 12, W = 2.6, H = 3.1;
  // body: purple lower half, white upper, tinted window band, roof cap
  add(g, new RoundedBoxGeometry(W, H * 0.48, L, 3, 0.22), paint, 0, -H * 0.26, 0);
  add(g, new RoundedBoxGeometry(W, H * 0.56, L - 0.1, 3, 0.3), white, 0, H * 0.22, 0);
  add(g, new RoundedBoxGeometry(W - 0.25, 0.25, L - 1.2, 2, 0.1), white, 0, H * 0.52, -0.2);
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.04, 1.0, L - 2.6), glass, s * (W / 2 + 0.005), H * 0.2, -0.5);
    for (let i = 0; i < 7; i++) add(g, new THREE.BoxGeometry(0.06, 1.04, 0.12), white, s * (W / 2 + 0.02), H * 0.2, -L / 2 + 1.3 + i * 1.55);
    add(g, new THREE.BoxGeometry(0.05, 0.12, L - 0.6), chrome, s * (W / 2 + 0.01), -H * 0.02, 0);
    add(g, new THREE.BoxGeometry(0.05, 0.22, L - 1), glow(0x5ff4ff), s * (W / 2 + 0.012), -H * 0.38, 0);
    // big lightning decal along the side
    const bolt = new THREE.Shape(); bolt.moveTo(0, 0.5); bolt.lineTo(-0.9, -0.1); bolt.lineTo(0.1, -0.05); bolt.lineTo(-0.5, -0.6); bolt.lineTo(1.1, 0.15); bolt.lineTo(0.15, 0.1); bolt.lineTo(0.6, 0.5); bolt.lineTo(0, 0.5);
    const bm = add(g, new THREE.ShapeGeometry(bolt), glow(0xffd23a), s * (W / 2 + 0.03), -H * 0.22, 0.5, 0, s * Math.PI / 2, 0, 1.4, 0.9, 1);
    bm.material.side = THREE.DoubleSide;
    // mirrors
    rod(g, new THREE.Vector3(s * 1.3, 0.6, L / 2 - 0.4), new THREE.Vector3(s * 1.75, 0.75, L / 2 - 0.1), 0.03, chrome);
    add(g, new THREE.BoxGeometry(0.08, 0.42, 0.24), dark, s * 1.78, 0.62, L / 2 - 0.1);
  }
  // front: windshield, grille, headlights, bumper, destination sign
  add(g, new THREE.BoxGeometry(W - 0.3, 1.25, 0.05), glass, 0, H * 0.24, L / 2 + 0.01, -0.06, 0, 0);
  add(g, new THREE.BoxGeometry(W - 0.5, 0.26, 0.05), dark, 0, H * 0.55, L / 2 - 0.02);
  const sign = canvasTex(256, 32, (x, w, h) => { x.fillStyle = '#100a20'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffb21a'; x.font = 'bold 22px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('OVERCHARGE  ★  DROP ZONE', w / 2, h / 2 + 1); });
  add(g, new THREE.PlaneGeometry(W - 0.6, 0.22), glow(0xffffff, { map: sign }), 0, H * 0.55, L / 2 + 0.02);
  add(g, new THREE.BoxGeometry(1.4, 0.45, 0.06), chrome, 0, -H * 0.3, L / 2 + 0.02);
  for (let i = 0; i < 5; i++) add(g, new THREE.BoxGeometry(1.3, 0.04, 0.07), dark, 0, -H * 0.3 - 0.16 + i * 0.08, L / 2 + 0.03);
  for (const s of [-1, 1]) { add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), glow(0xfff6d8), s * 0.95, -H * 0.3, L / 2 + 0.03, Math.PI / 2); add(g, new THREE.BoxGeometry(0.3, 0.1, 0.05), glow(0xffa21a), s * 1.05, -H * 0.16, L / 2 + 0.03); }
  add(g, new RoundedBoxGeometry(W + 0.1, 0.32, 0.3, 2, 0.08), chrome, 0, -H * 0.48, L / 2 + 0.05);
  add(g, new RoundedBoxGeometry(W + 0.1, 0.32, 0.3, 2, 0.08), chrome, 0, -H * 0.48, -L / 2 - 0.05);
  // rear lights + jet boosters
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.3, 0.6, 0.05), glow(0xff2a3a), s * 1.0, -H * 0.2, -L / 2 - 0.02);
  const boosters = [];
  for (const s of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.42, 0.55, 2.2, 18), chrome, s * 0.85, H * 0.36, -L / 2 - 0.6, Math.PI / 2);
    add(g, new THREE.TorusGeometry(0.5, 0.06, 6, 20), glow(0x5ff4ff), s * 0.85, H * 0.36, -L / 2 - 1.72);
    const fl = add(g, new THREE.ConeGeometry(0.42, 2.4, 16, 1, true), new THREE.MeshBasicMaterial({ map: exhaustTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), s * 0.85, H * 0.36, -L / 2 - 2.9, -Math.PI / 2);
    boosters.push(fl);
  }
  // wheels + wheel arches
  for (const z of [L / 2 - 2.2, -L / 2 + 2.6, -L / 2 + 1.4]) for (const s of [-1, 1]) {
    wheel(g, s * (W / 2 - 0.12), -H * 0.5 - 0.05, z, 0.55, 0.36, rubber, chrome);
    add(g, new THREE.CylinderGeometry(0.68, 0.68, 0.1, 18, 1, false, 0, Math.PI), dark, s * (W / 2 + 0.01), -H * 0.5 + 0.02, z, 0, 0, Math.PI / 2);
  }
  // balloon: gores in OVERCHARGE colours, a load ring, ropes and a burner
  const gores = canvasTex(512, 256, (x, w, h) => {
    const cols = ['#5b2bd6', '#f2f0ff', '#2ec6ff', '#f2f0ff'];
    for (let i = 0; i < 16; i++) { x.fillStyle = cols[i % 4]; x.fillRect(i * w / 16, 0, w / 16 + 1, h); }
    x.fillStyle = '#ffd23a';
    for (let k = 0; k < 4; k++) { const cx = (k + 0.5) * w / 4; x.beginPath(); x.moveTo(cx + 6, 70); x.lineTo(cx - 22, 128); x.lineTo(cx + 2, 128); x.lineTo(cx - 10, 176); x.lineTo(cx + 26, 112); x.lineTo(cx + 2, 112); x.lineTo(cx + 16, 70); x.fill(); }
    x.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 16; i++) x.fillRect(i * w / 16, 0, 2, h);
  });
  const prof = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, a = -Math.PI / 2 + t * Math.PI; const r = Math.cos(a) * (t < 0.5 ? 0.75 + t : 1.25 - (t - 0.5) * 0.5); prof.push(new THREE.Vector2(Math.max(0.6, r * 7.2), Math.sin(a) * 8.5)); }
  const balloon = new THREE.Group(); balloon.position.y = 16; g.add(balloon);
  add(balloon, new THREE.LatheGeometry(prof, 40), std({ map: gores, roughness: 0.65, metalness: 0, side: THREE.DoubleSide }), 0, 0, 0);
  add(balloon, new THREE.TorusGeometry(2.0, 0.09, 6, 32), dark, 0, -8.3, 0, Math.PI / 2);
  const flame = add(balloon, new THREE.ConeGeometry(0.55, 2.2, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 0, -7.6, 0);
  add(balloon, new THREE.CylinderGeometry(0.35, 0.45, 0.6, 12), chrome, 0, -8.9, 0);
  const rope = std({ color: 0x3a3340, roughness: 0.9 });
  for (const [x, z] of [[-1.2, 5], [1.2, 5], [-1.2, -5], [1.2, -5]]) rod(g, new THREE.Vector3(x, H * 0.62, z), new THREE.Vector3(x * 1.4, 16 - 8.3, z * 0.35), 0.035, rope, 4);
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return {
    group: g, anim: (t) => {
      balloon.rotation.z = Math.sin(t * 0.6) * 0.04; balloon.rotation.x = Math.sin(t * 0.45) * 0.03;
      flame.scale.set(1, 0.7 + Math.random() * 0.6, 1); flame.visible = Math.sin(t * 1.3) > -0.4;
      for (const b of boosters) b.scale.set(1, 0.8 + Math.random() * 0.4, 1);
    },
  };
}

// ===================================================================== Warehouse
function warehouseBus() {
  const g = new THREE.Group();
  const yellow = std({ color: 0xe0a419, metalness: 0.35, roughness: 0.38 });
  const grey = std({ color: 0x4a4f5c, metalness: 0.5, roughness: 0.45 });
  const dark = std({ color: 0x23262e, metalness: 0.55, roughness: 0.4 });
  const glass = std({ color: 0x1b2a3c, metalness: 0.6, roughness: 0.05, emissive: 0x0a1424, emissiveIntensity: 0.6 });
  const rubber = std({ color: 0x15161a, roughness: 0.9 });
  const steel = std({ color: 0xbfc5d0, metalness: 0.9, roughness: 0.25 });
  const heli = new THREE.Group(); heli.position.y = 9.5; g.add(heli);
  // fuselage
  add(heli, new RoundedBoxGeometry(3.4, 3.4, 15, 4, 0.9), yellow, 0, 0, 0);
  add(heli, new RoundedBoxGeometry(3.42, 0.9, 15.02, 3, 0.35), grey, 0, -1.3, 0);
  add(heli, new THREE.SphereGeometry(1.7, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), yellow, 0, 0.1, 7.4, Math.PI / 2, 0, 0, 1, 1.4, 1.0);
  add(heli, new THREE.SphereGeometry(1.72, 20, 14, 0, Math.PI, 0, Math.PI / 2.4), glass, 0, 0.35, 7.9, -Math.PI / 2, 0, 0, 1, 1.1, 0.85);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) add(heli, new RoundedBoxGeometry(0.06, 0.6, 0.7, 1, 0.05), glass, s * 1.71, 0.5, 3.5 - i * 1.8);
    add(heli, new THREE.BoxGeometry(0.05, 0.16, 13), glow(0xff8a1a), s * 1.72, -0.5, 0);
    add(heli, new RoundedBoxGeometry(1.0, 1.1, 6, 2, 0.3), grey, s * 2.1, -1.1, -1.5);   // sponsons
    wheel(heli, s * 2.2, -1.95, 0.5, 0.42, 0.3, rubber, steel); wheel(heli, s * 2.2, -1.95, -3.2, 0.42, 0.3, rubber, steel);
  }
  wheel(heli, 0, -2.05, 6.0, 0.36, 0.26, rubber, steel);
  // rear pylon + front rotor head
  add(heli, new RoundedBoxGeometry(2.4, 3.2, 4.6, 3, 0.6), yellow, 0, 2.1, -5.4);
  add(heli, new RoundedBoxGeometry(1.4, 1.2, 1.8, 2, 0.3), grey, 0, 2.1, 5.2);
  const hubs = [];
  for (const [y, z, dir] of [[3.0, 5.2, 1], [4.0, -5.6, -1]]) {
    const hub = new THREE.Group(); hub.position.set(0, y, z); heli.add(hub);
    add(hub, new THREE.CylinderGeometry(0.35, 0.45, 0.8, 12), dark, 0, 0, 0);
    for (let i = 0; i < 3; i++) {
      const b = add(hub, new THREE.BoxGeometry(0.55, 0.08, 9.5), dark, 0, 0.35, 0, 0, i * Math.PI * 2 / 3, 0);
      b.geometry.translate(0, 0, 4.75);
    }
    // motion blur disc
    add(hub, new THREE.CircleGeometry(9.6, 40), new THREE.MeshBasicMaterial({ color: 0x1c1d22, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }), 0, 0.36, 0, -Math.PI / 2);
    hubs.push({ hub, dir });
  }
  // beacons
  const beacon = add(heli, new THREE.SphereGeometry(0.16, 10, 8), glow(0xff3030), 0, 1.75, 0);
  add(heli, new THREE.SphereGeometry(0.12, 8, 6), glow(0x30ff60), 1.72, 0, 6); add(heli, new THREE.SphereGeometry(0.12, 8, 6), glow(0xff3030), -1.72, 0, 6);
  // freight trailer on four cables (players ride in the trailer)
  const cargo = new THREE.Group(); g.add(cargo);
  const trailerTex = canvasTex(512, 128, (x, w, h) => {
    x.fillStyle = '#e9ecf2'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#d8382c'; x.fillRect(0, h * 0.78, w, h * 0.1);
    x.fillStyle = '#ff8a1a'; x.fillRect(0, h * 0.88, w, h * 0.05);
    x.fillStyle = '#1c2130'; x.font = 'bold 54px "Russo One", Impact, sans-serif'; x.textBaseline = 'middle'; x.fillText('OVERCHARGE', 28, h * 0.42);
    x.fillStyle = '#d8382c'; x.font = 'bold 26px "Russo One", Impact, sans-serif'; x.fillText('FREIGHT  ·  ZONE DROP', 30, h * 0.66);
    x.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < w; i += 16) x.fillRect(i, 0, 2, h);
  });
  const tm = std({ map: trailerTex, roughness: 0.5, metalness: 0.2 });
  const side = new THREE.BoxGeometry(2.6, 2.8, 12);
  const mats = [tm, tm, std({ color: 0xe9ecf2 }), grey, std({ color: 0xd6dae2 }), std({ color: 0xd6dae2 })];
  add(cargo, side, mats, 0, 0, 0);
  add(cargo, new THREE.BoxGeometry(2.7, 0.25, 12.1), dark, 0, -1.5, 0);
  for (const s of [-1, 1]) for (const z of [-4.4, -3.2]) wheel(cargo, s * 1.05, -1.9, z, 0.5, 0.36, rubber, steel);
  add(cargo, new THREE.BoxGeometry(0.06, 2.6, 2.4), dark, 0, 0, -6.02);
  for (const s of [-1, 1]) add(cargo, new THREE.BoxGeometry(0.25, 0.25, 0.05), glow(0xff2a3a), s * 1.1, -1.25, -6.04);
  const cable = std({ color: 0x2a2c33, roughness: 0.6, metalness: 0.6 });
  for (const [x, z] of [[-1.2, 5.6], [1.2, 5.6], [-1.2, -5.6], [1.2, -5.6]]) rod(g, new THREE.Vector3(x, 1.4, z), new THREE.Vector3(x * 0.5, 9.5 - 1.8, z * 0.45), 0.04, cable, 5);
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return {
    group: g, anim: (t) => {
      for (const { hub, dir } of hubs) hub.rotation.y = dir * t * 14;
      cargo.rotation.z = Math.sin(t * 0.9) * 0.025; cargo.rotation.x = Math.sin(t * 0.7) * 0.02;
      beacon.visible = (t * 1.5) % 1 < 0.5;
      heli.rotation.x = 0.04 + Math.sin(t * 0.5) * 0.01;
    },
  };
}

// ===================================================================== Vulcan Garrison
function vulcanBus() {
  const g = new THREE.Group();
  const hullTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#d6deef'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(25,35,60,0.35)'; x.lineWidth = 2;
    for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, i * 44 + 8); x.lineTo(w, i * 44 + 8); x.stroke(); }
    for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 70 + 20, 0); x.lineTo(i * 70 + 20, h); x.stroke(); }
    x.fillStyle = 'rgba(25,35,60,0.5)'; for (let i = 0; i < 40; i++) x.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  });
  const hull = std({ map: hullTex, metalness: 0.45, roughness: 0.35 });
  const navy = std({ color: 0x232a3f, metalness: 0.65, roughness: 0.4 });
  const orange = std({ color: 0xf0761e, metalness: 0.3, roughness: 0.45 });
  const glass = std({ color: 0x8fe8c4, metalness: 0.4, roughness: 0.05, emissive: 0x0c3a2e, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 });
  const blue = glow(0x58c8ff);
  // armoured hull: tapered body built from bevelled blocks
  add(g, new RoundedBoxGeometry(4.2, 3.0, 11, 3, 0.45), hull, 0, 0, -0.5);
  add(g, new RoundedBoxGeometry(3.0, 2.2, 4.4, 3, 0.4), hull, 0, -0.2, 6.6, 0.12, 0, 0);
  add(g, new RoundedBoxGeometry(2.6, 1.1, 3.4, 3, 0.4), glass, 0, 0.9, 6.3, -0.2, 0, 0);
  add(g, new RoundedBoxGeometry(3.6, 0.6, 10.5, 2, 0.25), navy, 0, 1.75, -0.8);
  add(g, new RoundedBoxGeometry(4.4, 0.7, 11.4, 2, 0.25), navy, 0, -1.55, -0.5);
  for (const s of [-1, 1]) {
    // armour plates, slits, blue strips and an orange chevron
    add(g, new RoundedBoxGeometry(0.25, 1.8, 8.6, 2, 0.1), navy, s * 2.15, 0.1, -0.8);
    for (let i = 0; i < 5; i++) add(g, new THREE.BoxGeometry(0.06, 1.0, 0.18), std({ color: 0x141a28 }), s * 2.29, 0.2, -4.4 + i * 1.8);
    add(g, new THREE.BoxGeometry(0.05, 0.12, 9.6), blue, s * 2.3, -0.95, -0.6);
    add(g, new THREE.BoxGeometry(0.06, 0.5, 1.2), orange, s * 2.28, 0.9, 3.2, 0, 0, 0);
    // stub wings with tilt-engine nacelles
    add(g, new RoundedBoxGeometry(4.6, 0.4, 2.8, 2, 0.15), hull, s * 4.3, 0.2, -1.2, 0, 0, s * 0.06);
    add(g, new THREE.BoxGeometry(4.2, 0.08, 0.3), orange, s * 4.3, 0.42, -0.1);
    for (const ez of [-0.2, -2.6]) {
      const n = new THREE.Group(); n.position.set(s * 6.3, 0.3, ez); n.rotation.x = 0.35; g.add(n);
      add(n, new THREE.CylinderGeometry(0.7, 0.8, 2.4, 18), navy, 0, 0, 0);
      add(n, new THREE.CylinderGeometry(0.72, 0.72, 0.5, 18), hull, 0, 0.7, 0);
      add(n, new THREE.TorusGeometry(0.6, 0.08, 6, 24), blue, 0, -1.22, 0, Math.PI / 2);
      const ex = add(n, new THREE.ConeGeometry(0.62, 2.2, 16, 1, true), new THREE.MeshBasicMaterial({ map: exhaustTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), 0, -2.3, 0, Math.PI);
      n.userData.ex = ex;
      g.userData.engines = (g.userData.engines || []).concat(n);
    }
    // tail fins
    add(g, new RoundedBoxGeometry(0.25, 2.4, 2.6, 2, 0.1), hull, s * 1.4, 2.6, -5.4, -0.35, 0, s * -0.3);
    add(g, new THREE.BoxGeometry(0.06, 0.14, 2.2), blue, s * 1.55, 3.6, -5.6, -0.35, 0, s * -0.3);
    // nav lights
    add(g, new THREE.SphereGeometry(0.13, 8, 6), glow(s > 0 ? 0x30ff60 : 0xff3030), s * 6.6, 0.4, -1.2);
  }
  // rear ramp (open a crack, red interior light) + hazard stripes
  add(g, new RoundedBoxGeometry(3.6, 0.25, 2.6, 2, 0.08), navy, 0, -1.2, -6.9, 0.45, 0, 0);
  add(g, new THREE.BoxGeometry(3.2, 0.06, 0.4), orange, 0, -0.95, -6.2, 0.45, 0, 0);
  add(g, new THREE.BoxGeometry(3.0, 1.6, 0.05), glow(0x8a2a2a), 0, 0.1, -6.02);
  // chin turret + search lights
  add(g, new THREE.SphereGeometry(0.55, 14, 10), navy, 0, -1.4, 7.6);
  for (const s of [-0.18, 0.18]) add(g, new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8), navy, s, -1.5, 8.4, Math.PI / 2);
  const searchMat = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const lights = [];
  for (const s of [-1, 1]) { const b = add(g, new THREE.ConeGeometry(3.5, 26, 16, 1, true), searchMat, s * 1.4, -14.5, 4.5, 0, 0, 0); b.geometry.translate(0, 0, 0); lights.push(b); }
  // red/white strobe on top
  const strobe = add(g, new THREE.SphereGeometry(0.14, 8, 6), glow(0xffffff), 0, 2.15, -3.6);
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return {
    group: g, anim: (t) => {
      for (const n of g.userData.engines) { n.userData.ex.scale.set(1, 0.8 + Math.random() * 0.4, 1); }
      g.rotation.z = Math.sin(t * 0.7) * 0.02;
      strobe.visible = (t * 1.2) % 1 < 0.12;
      lights.forEach((l, i) => { l.rotation.z = Math.sin(t * 0.6 + i * 2) * 0.25; });
    },
  };
}

const BUILDERS = { compound: compoundBus, warehouse: warehouseBus, vulcan: vulcanBus };

/** The battle bus for a map: { group, anim(t) }. */
export function makeBus(mapId) { return (BUILDERS[mapId] || compoundBus)(); }
