// Procedurally painted canvas textures for the Reversal Compound (no image downloads needed).
import * as THREE from 'three';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function speckle(ctx, size, count, alpha, r, light = true, seed = 1) {
  const R = rng(seed);
  for (let i = 0; i < count; i++) {
    const v = light ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * R()})`;
    const s = R() * r + 0.5;
    ctx.fillRect(R() * size, R() * size, s, s);
  }
}

function blotches(ctx, size, count, alpha, seed) {
  const R = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = R() * size, y = R() * size, rad = size * (0.05 + R() * 0.2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const dark = R() < 0.5;
    g.addColorStop(0, `rgba(${dark ? 0 : 255},${dark ? 0 : 255},${dark ? 0 : 255},${alpha})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      ctx.save(); ctx.translate(ox, oy); ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); ctx.restore();
    }
  }
}

function finish(c, { repeat = true, aniso = 8, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

export function makeTextures() {
  const T = {};

  // Concrete: light, subtle variation, used with a tint colour.
  {
    const [c, x] = canvas(512);
    x.fillStyle = '#e4e2ee'; x.fillRect(0, 0, 512, 512);
    blotches(x, 512, 26, 0.06, 3);
    speckle(x, 512, 9000, 0.10, 1.6, false, 4);
    speckle(x, 512, 4000, 0.12, 1.2, true, 5);
    T.concrete = finish(c);
  }
  // Floor tiles: concrete with large slab seams.
  {
    const [c, x] = canvas(512);
    x.fillStyle = '#e6e4f0'; x.fillRect(0, 0, 512, 512);
    blotches(x, 512, 30, 0.05, 7);
    speckle(x, 512, 12000, 0.08, 1.5, false, 8);
    x.strokeStyle = 'rgba(40,30,80,0.12)'; x.lineWidth = 2;
    x.strokeRect(1.5, 1.5, 509, 509);
    x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 1;
    x.strokeRect(4, 4, 504, 504);
    T.tiles = finish(c);
  }
  // Slat panels (spawn hangar walls).
  {
    const [c, x] = canvas(256);
    x.fillStyle = '#c9c7d6'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
      const y = i * 32;
      const g = x.createLinearGradient(0, y, 0, y + 32);
      g.addColorStop(0, '#e9e8f2'); g.addColorStop(0.15, '#cfcde0'); g.addColorStop(0.85, '#b3b0c9'); g.addColorStop(1, '#6d6a86');
      x.fillStyle = g; x.fillRect(0, y, 256, 32);
    }
    speckle(x, 256, 1500, 0.08, 1.2, false, 11);
    T.slats = finish(c);
  }
  // Diamond plate.
  {
    const [c, x] = canvas(256);
    x.fillStyle = '#c7d3d6'; x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 3000, 0.06, 1.5, false, 13);
    const step = 32;
    for (let r = -1; r < 9; r++) for (let q = -1; q < 9; q++) {
      const cx = q * step + (r % 2 ? step / 2 : 0), cy = r * step;
      x.save(); x.translate(cx, cy); x.rotate(r % 2 ? -0.6 : 0.6);
      const g = x.createLinearGradient(-12, -3, 12, 3);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#b8c6ca'); g.addColorStop(1, '#5d6f75');
      x.fillStyle = g;
      x.beginPath(); x.ellipse(0, 0, 13, 3.2, 0, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    T.plate = finish(c);
  }
  // Wooden crate with X brace (like the compound's supply crates).
  {
    const [c, x] = canvas(256);
    x.fillStyle = '#a99fbe'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6; i++) {
      x.fillStyle = i % 2 ? '#a196b7' : '#b2a8c6'; x.fillRect(0, i * 43, 256, 43);
      x.fillStyle = 'rgba(40,30,70,0.35)'; x.fillRect(0, i * 43, 256, 2);
    }
    speckle(x, 256, 2500, 0.1, 1.3, false, 17);
    x.strokeStyle = '#4d4468'; x.lineCap = 'square';
    x.lineWidth = 26; x.strokeRect(13, 13, 230, 230);
    x.lineWidth = 24; x.beginPath(); x.moveTo(26, 26); x.lineTo(230, 230); x.stroke();
    x.strokeStyle = '#625883'; x.lineWidth = 18; x.strokeRect(13, 13, 230, 230);
    x.beginPath(); x.moveTo(26, 26); x.lineTo(230, 230); x.stroke();
    T.crate = finish(c, { repeat: false });
  }
  // Container (corrugated).
  {
    const [c, x] = canvas(256);
    for (let i = 0; i < 32; i++) {
      const g = x.createLinearGradient(i * 8, 0, i * 8 + 8, 0);
      g.addColorStop(0, '#d8d8e4'); g.addColorStop(0.5, '#a9a9bd'); g.addColorStop(1, '#e8e8f2');
      x.fillStyle = g; x.fillRect(i * 8, 0, 8, 256);
    }
    speckle(x, 256, 2000, 0.12, 1.5, false, 19);
    T.container = finish(c);
  }
  // Glass window with bars.
  {
    const [c, x] = canvas(256);
    const g = x.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, 'rgba(190,230,255,0.55)'); g.addColorStop(0.5, 'rgba(140,170,255,0.25)'); g.addColorStop(1, 'rgba(200,240,255,0.5)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.save(); x.rotate(-0.5); x.fillRect(-40, 90, 400, 18); x.fillRect(-40, 125, 400, 6); x.restore();
    x.fillStyle = 'rgba(30,30,60,0.9)';
    for (let i = 0; i < 4; i++) x.fillRect(0, i * 64 + 28, 256, 8);
    x.fillRect(0, 0, 256, 6); x.fillRect(0, 250, 256, 6);
    T.window = finish(c, { srgb: true });
  }
  // Hazard stripes.
  {
    const [c, x] = canvas(128);
    x.fillStyle = '#ffcc22'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#1d1a2a';
    for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 16 + 128, 128); x.lineTo(i * 32 + 128, 128); x.fill(); }
    T.hazard = finish(c);
  }
  // Holo monitor screens.
  {
    const [c, x] = canvas(256);
    x.fillStyle = '#071a24'; x.fillRect(0, 0, 256, 256);
    const R = rng(23);
    for (let i = 0; i < 18; i++) {
      x.fillStyle = `rgba(${80 + R() * 80},${200 + R() * 55},255,${0.4 + R() * 0.5})`;
      x.fillRect(12 + R() * 120, 12 + i * 13, 30 + R() * 100, 5);
    }
    x.strokeStyle = 'rgba(120,255,240,0.9)'; x.lineWidth = 3;
    x.beginPath();
    for (let i = 0; i <= 40; i++) { const px = 140 + i * 2.6, py = 200 - Math.abs(Math.sin(i * 0.5)) * 50 * R(); i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
    x.strokeStyle = 'rgba(190,120,255,0.9)'; x.strokeRect(140, 30, 100, 80);
    x.fillStyle = 'rgba(190,120,255,0.5)'; x.fillRect(150, 70, 30, 30); x.fillRect(190, 50, 40, 50);
    x.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < 256; y += 4) x.fillRect(0, y, 256, 1);
    T.screen = finish(c, { repeat: false });
  }
  // Soft radial glow sprite.
  {
    const [c, x] = canvas(128);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    T.glow = finish(c, { repeat: false, srgb: false });
  }
  // Spark / star sprite.
  {
    const [c, x] = canvas(64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(30, 0, 4, 64); x.fillRect(0, 30, 64, 4);
    T.spark = finish(c, { repeat: false, srgb: false });
  }
  // Smoke puff.
  {
    const [c, x] = canvas(128);
    const R = rng(29);
    for (let i = 0; i < 30; i++) {
      const px = 64 + (R() - 0.5) * 50, py = 64 + (R() - 0.5) * 50, rad = 15 + R() * 30;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    T.smoke = finish(c, { repeat: false, srgb: false });
  }
  // Storm wall noise.
  {
    const [c, x] = canvas(256);
    x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 60, 0.35, 31);
    speckle(x, 256, 3000, 0.2, 2, true, 32);
    T.noise = finish(c, { srgb: false });
  }
  return T;
}
