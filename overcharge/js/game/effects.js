// Visual effects: GPU-light particle system, tracers, muzzle flashes, explosions, fields, storm wall.
import * as THREE from 'three';

const MAX_PARTICLES = 1800;
const _z = new THREE.Vector3(0, 0, 1), _n = new THREE.Vector3(), _s = new THREE.Vector3(), _mtx = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Effects {
  constructor(scene, textures, quality) {
    this.scene = scene;
    this.T = textures;
    this.low = quality === 'low';
    this.time = 0;
    this.initParticles();
    this.initTracers();
    this.timed = [];  // {obj, life, max, update(k,dt), keep}
    this.initFlashes();
    this.initDecals();
    this.initRings();
    this.shared = {};
  }

  // ---------------------------------------------------------------- textures
  static canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ---------------------------------------------------------------- muzzle flashes
  initFlashes() {
    // a flame tongue along the barrel, a star burst across it and a soft glow
    const flame = Effects.canvasTex(64, 128, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h * 0.82, 2, w / 2, h * 0.55, h * 0.62);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)'); g.addColorStop(0.6, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(w / 2, 2); x.bezierCurveTo(w * 0.95, h * 0.45, w * 0.9, h * 0.9, w / 2, h - 2); x.bezierCurveTo(w * 0.1, h * 0.9, w * 0.05, h * 0.45, w / 2, 2); x.fill();
    });
    const star = Effects.canvasTex(128, 128, (x, w) => {
      x.translate(w / 2, w / 2);
      for (let i = 0; i < 6; i++) {
        x.rotate(Math.PI / 3 + (i % 2) * 0.2);
        const L = w * (i % 2 ? 0.34 : 0.48);
        const g = x.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.moveTo(0, -5); x.lineTo(L, 0); x.lineTo(0, 5); x.fill();
      }
      const g = x.createRadialGradient(0, 0, 0, 0, 0, w * 0.22); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, w * 0.22, 0, 6.3); x.fill();
    });
    // flame: two crossed quads from z=0 to z=1 (v=1 at the muzzle end of the texture)
    const fg = new THREE.BufferGeometry();
    const w = 0.5;
    fg.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, w, 0, 1, -w, 0, 1, 0, -w, 0, 0, w, 0, 0, w, 1, 0, -w, 1], 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2));
    fg.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const sg = new THREE.PlaneGeometry(1, 1);
    const add = (map) => new THREE.MeshBasicMaterial({ map, color: 0xffd38a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    const glowMat = new THREE.SpriteMaterial({ map: this.T.glow, color: 0xffd38a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false });
    this.flashPool = [];
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const flameM = new THREE.Mesh(fg, add(flame)), starM = new THREE.Mesh(sg, add(star)), glow = new THREE.Sprite(glowMat.clone());
      starM.position.z = 0.04;
      g.add(flameM, starM, glow);
      g.visible = false; g.renderOrder = 10; flameM.renderOrder = 10; starM.renderOrder = 10; glow.renderOrder = 10;
      flameM.frustumCulled = starM.frustumCulled = false;
      this.scene.add(g);
      this.flashPool.push({ g, flame: flameM, star: starM, glow, life: 0, max: 0, size: 1 });
    }
    this.fNext = 0;
    // small impact / hit sparks
    this.sparkPool = [];
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
      s.visible = false; s.renderOrder = 10; this.scene.add(s);
      this.sparkPool.push({ s, life: 0, max: 0, size: 1 });
    }
    this.sNext = 0;
  }

  // ---------------------------------------------------------------- bullet scorch decals (one instanced draw)
  initDecals() {
    const tex = Effects.canvasTex(64, 64, (x, w) => {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,190,110,0.95)'); g.addColorStop(0.14, 'rgba(150,60,24,0.85)'); g.addColorStop(0.32, 'rgba(12,9,18,0.8)'); g.addColorStop(0.65, 'rgba(12,9,18,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, w);
    });
    this.DEC = 72;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, this.DEC);
    this.decals.frustumCulled = false; this.decals.renderOrder = 3;
    this.decalLife = new Float32Array(this.DEC); this.decalSize = new Float32Array(this.DEC);
    this.decalPos = []; this.decalQuat = [];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.DEC; i++) { this.decals.setMatrixAt(i, zero); this.decalPos.push(new THREE.Vector3()); this.decalQuat.push(new THREE.Quaternion()); }
    this.dNext = 0;
    this.scene.add(this.decals);
  }

  decal(p, n, size = 0.22) {
    if (!n) return;
    const i = this.dNext; this.dNext = (this.dNext + 1) % this.DEC;
    this.decalPos[i].set(p.x + n.x * 0.012, p.y + n.y * 0.012, p.z + n.z * 0.012);
    this.decalQuat[i].setFromUnitVectors(_z, _n.set(n.x, n.y, n.z).normalize());
    this.decalLife[i] = 9; this.decalSize[i] = size * (0.8 + Math.random() * 0.5);
    _mtx.compose(this.decalPos[i], this.decalQuat[i], _s.setScalar(this.decalSize[i]));
    this.decals.setMatrixAt(i, _mtx); this.decals.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- expanding rings (shield hits, landings, pickups)
  initRings() {
    const tex = Effects.canvasTex(128, 128, (x, w) => {
      x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 7; x.shadowColor = '#fff'; x.shadowBlur = 12;
      x.beginPath(); x.arc(64, 64, 48, 0, 6.3); x.stroke();
      x.lineWidth = 2; x.globalAlpha = 0.6; x.beginPath(); x.arc(64, 64, 36, 0, 6.3); x.stroke();
    });
    this.ringTex = tex;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.ringPool = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
      m.visible = false; m.renderOrder = 9; m.frustumCulled = false; this.scene.add(m);
      this.ringPool.push({ m, life: 0, max: 0, from: 0, to: 1, face: false });
    }
    this.rNext = 0;
  }

  /** Expanding ring. normal: surface normal to lie on, or null to face the camera. */
  ring(p, color, from, to, life = 0.35, normal = null) {
    const r = this.ringPool[this.rNext]; this.rNext = (this.rNext + 1) % this.ringPool.length;
    r.m.position.copy(p); r.m.material.color.setHex(color); r.m.material.opacity = 1;
    r.life = r.max = life; r.from = from; r.to = to; r.face = !normal;
    if (normal) r.m.quaternion.setFromUnitVectors(_z, _n.set(normal.x, normal.y, normal.z).normalize());
    r.m.scale.setScalar(from); r.m.visible = true;
  }

  spark(p, color, size = 0.4, life = 0.07) {
    const k = this.sparkPool[this.sNext]; this.sNext = (this.sNext + 1) % this.sparkPool.length;
    k.s.position.copy(p); k.s.material.color.setHex(color); k.s.material.opacity = 1; k.s.material.rotation = Math.random() * 6.28;
    k.size = size; k.life = k.max = life; k.s.scale.setScalar(size); k.s.visible = true;
  }

  // ---------------------------------------------------------------- particles
  initParticles() {
    const g = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 4);
    this.pSize = new Float32Array(MAX_PARTICLES);
    this.pVel = new Float32Array(MAX_PARTICLES * 3);
    this.pLife = new Float32Array(MAX_PARTICLES);
    this.pMax = new Float32Array(MAX_PARTICLES);
    this.pGrav = new Float32Array(MAX_PARTICLES);
    this.pSize0 = new Float32Array(MAX_PARTICLES);
    this.pGrow = new Float32Array(MAX_PARTICLES);
    this.pAlpha0 = new Float32Array(MAX_PARTICLES);
    this.pNext = 0;
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.T.glow }, scale: { value: 600 } },
      vertexShader: `
        attribute float size; attribute vec4 color; varying vec4 vColor;
        uniform float scale;
        void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D map; varying vec4 vColor;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a); if (gl_FragColor.a < 0.01) discard; }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 9;
    this.scene.add(this.points);
  }

  setViewport(h) { this.points.material.uniforms.scale.value = h * 0.9; }

  emit(x, y, z, vx, vy, vz, color, size, life, grav = 0, grow = 0, alpha = 1) {
    const i = this.pNext; this.pNext = (this.pNext + 1) % MAX_PARTICLES;
    this.pPos[i * 3] = x; this.pPos[i * 3 + 1] = y; this.pPos[i * 3 + 2] = z;
    this.pVel[i * 3] = vx; this.pVel[i * 3 + 1] = vy; this.pVel[i * 3 + 2] = vz;
    const c = typeof color === 'number' ? color : 0xffffff;
    this.pCol[i * 4] = ((c >> 16) & 255) / 255; this.pCol[i * 4 + 1] = ((c >> 8) & 255) / 255; this.pCol[i * 4 + 2] = (c & 255) / 255; this.pCol[i * 4 + 3] = alpha;
    this.pSize[i] = size; this.pSize0[i] = size; this.pLife[i] = life; this.pMax[i] = life; this.pGrav[i] = grav; this.pGrow[i] = grow; this.pAlpha0[i] = alpha;
  }

  burst(x, y, z, n, color, speed, size, life, grav = 9, spreadUp = 0.5) {
    if (this.low) n = Math.ceil(n * 0.5);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1 + spreadUp;
      const s = speed * (0.4 + Math.random() * 0.6);
      const r = Math.sqrt(Math.max(0, 1 - Math.min(1, u * u)));
      this.emit(x, y, z, Math.cos(a) * r * s, u * s, Math.sin(a) * r * s, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav);
    }
  }

  updateParticles(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.pLife[i] <= 0) { if (this.pCol[i * 4 + 3] !== 0) { this.pCol[i * 4 + 3] = 0; this.pSize[i] = 0; } continue; }
      this.pLife[i] -= dt;
      const k = Math.max(0, this.pLife[i] / this.pMax[i]);
      this.pVel[i * 3 + 1] -= this.pGrav[i] * dt;
      const drag = 1 - dt * 1.5;
      this.pVel[i * 3] *= drag; this.pVel[i * 3 + 2] *= drag;
      this.pPos[i * 3] += this.pVel[i * 3] * dt; this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt; this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      if (this.pPos[i * 3 + 1] < 0.02) { this.pPos[i * 3 + 1] = 0.02; this.pVel[i * 3 + 1] *= -0.3; }
      this.pCol[i * 4 + 3] = this.pAlpha0[i] * k;
      this.pSize[i] = this.pSize0[i] * (1 + this.pGrow[i] * (1 - k));
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
  }

  // ---------------------------------------------------------------- tracers
  initTracers() {
    const geo = new THREE.BufferGeometry();
    // two crossed quads along +Z from 0..1
    const w = 0.5;
    const pos = [-w, 0, 0, w, 0, 0, w, 0, 1, -w, 0, 1, 0, -w, 0, 0, w, 0, 0, w, 1, 0, -w, 1];
    const uv = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const c = document.createElement('canvas'); c.width = 64; c.height = 8;
    const x = c.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grad; x.fillRect(0, 0, 64, 8);
    const tex = new THREE.CanvasTexture(c);
    this.tracers = [];
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: 0xffeeaa, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
      m.visible = false; m.frustumCulled = false; m.renderOrder = 8;
      this.scene.add(m);
      this.tracers.push({ m, life: 0, max: 0, from: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0, width: 0.04, travel: 0, streak: 8, age: 0, fade: 0.09 });
    }
    this.tNext = 0;
  }

  /** A bullet streak that travels from the muzzle to the hit point, leaving a short fading trail. */
  tracer(from, to, color = 0xffeeaa, width = 0.035, life = 0.09) {
    const t = this.tracers[this.tNext]; this.tNext = (this.tNext + 1) % this.tracers.length;
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    t.m.position.copy(from);
    t.m.lookAt(to);
    t.from.copy(from); t.dir.subVectors(to, from).divideScalar(len);
    t.len = len; t.width = width * 1.25;
    t.travel = Math.min(0.16, len / 420);      // time for the head to reach the target
    t.streak = Math.min(len, 14 + len * 0.12);  // visible length of the streak
    t.age = 0; t.fade = life;
    t.m.material.color.setHex(color);
    t.m.material.opacity = 1;
    t.m.scale.set(t.width, t.width, 0.01);
    t.m.visible = true; t.life = t.travel + life; t.max = t.life;
  }

  muzzleFlash(pos, color = 0xffd38a, size = 0.55, dir = null) {
    const f = this.flashPool[this.fNext]; this.fNext = (this.fNext + 1) % this.flashPool.length;
    f.g.position.copy(pos);
    if (dir) { f.g.lookAt(_a.copy(pos).add(dir)); f.flame.visible = true; } else f.flame.visible = false;
    f.g.rotateZ(Math.random() * 6.28);
    for (const m of [f.flame, f.star, f.glow]) { m.material.color.setHex(color); m.material.opacity = 1; }
    f.size = size * (0.85 + Math.random() * 0.35);
    f.life = f.max = 0.06; f.g.visible = true;
    this.applyFlash(f, 1);
    // a wisp of smoke and a couple of sparks out of the barrel
    this.emit(pos.x, pos.y, pos.z, (dir ? dir.x : 0) * 0.8, 0.5, (dir ? dir.z : 0) * 0.8, 0x9d93b8, 0.22, 0.45, -0.6, 2.4, 0.18);
    if (dir && !this.low) for (let i = 0; i < 3; i++) this.emit(pos.x, pos.y, pos.z, dir.x * (9 + Math.random() * 8) + (Math.random() - 0.5) * 3, dir.y * 9 + (Math.random() - 0.3) * 3, dir.z * (9 + Math.random() * 8) + (Math.random() - 0.5) * 3, color, 0.05, 0.14, 6);
  }

  applyFlash(f, k) {
    const s = f.size * (1.25 - 0.4 * k);
    f.flame.scale.set(s * 0.42, s * 0.42, s * 1.5);
    f.star.scale.setScalar(s * 0.95);
    f.glow.scale.setScalar(s * 1.6);
    f.flame.material.opacity = f.star.material.opacity = k; f.glow.material.opacity = k * 0.7;
  }

  /** Spent casing flicked out of the ejection port. right: unit vector to the shooter's right. */
  shell(pos, right) {
    if (this.low) return;
    this.emit(pos.x, pos.y, pos.z, right.x * (2.2 + Math.random()) + (Math.random() - 0.5), 2.2 + Math.random() * 1.2, right.z * (2.2 + Math.random()) + (Math.random() - 0.5), 0xffc55a, 0.045, 0.7, 13);
  }

  impact(p, normal, kind = 'world', color = 0xffc37a) {
    if (kind === 'shield') {
      this.burst(p.x, p.y, p.z, 12, 0x56c8ff, 4.5, 0.11, 0.35, 4);
      this.ring(p, 0x6fd6ff, 0.25, 1.15, 0.28);
      this.spark(p, 0xbfeaff, 0.55, 0.08);
    } else if (kind === 'flesh') {
      this.burst(p.x, p.y, p.z, 9, 0xffffff, 3.5, 0.1, 0.3, 6);
      this.burst(p.x, p.y, p.z, 5, 0xff5c7a, 2.6, 0.09, 0.35, 5);
      this.spark(p, 0xffffff, 0.42, 0.06);
    } else {
      const n = normal || _n.set(0, 1, 0);
      for (let i = 0; i < 9; i++) {
        const s = 2.5 + Math.random() * 5;
        this.emit(p.x, p.y, p.z, n.x * s + (Math.random() - 0.5) * 3.2, n.y * s + Math.random() * 2.4, n.z * s + (Math.random() - 0.5) * 3.2, i < 3 ? 0xffffff : color, 0.055 + Math.random() * 0.03, 0.22 + Math.random() * 0.2, 13);
      }
      this.emit(p.x + n.x * 0.1, p.y + n.y * 0.1, p.z + n.z * 0.1, n.x * 0.5, 0.45, n.z * 0.5, 0xb8b0d8, 0.32, 0.7, -0.25, 2.8, 0.22);
      this.spark(_a.set(p.x + n.x * 0.04, p.y + n.y * 0.04, p.z + n.z * 0.04), color, 0.5, 0.07);
      this.decal(p, n);
    }
  }

  // ---------------------------------------------------------------- big effects
  addTimed(obj, life, update) {
    this.scene.add(obj);
    this.timed.push({ obj, life, max: life, update });
  }

  /** Cached geometry that survives the timed effects that use it. */
  geo(key, make) {
    if (!this.shared[key]) { this.shared[key] = make(); this.shared[key].userData.shared = true; }
    return this.shared[key];
  }
  addMat(color, extra = {}) { return new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide, ...extra }); }

  shockwave(p) {
    const ring = new THREE.Mesh(this.geo('torus', () => new THREE.TorusGeometry(1, 0.12, 8, 48)), this.addMat(0x6cc8ff));
    ring.rotation.x = Math.PI / 2; ring.position.copy(p);
    this.addTimed(ring, 0.6, (k) => { const s = 1 + (1 - k) * 7; ring.scale.set(s, s, 1 + (1 - k) * 2); ring.material.opacity = k; });
    const dome = new THREE.Mesh(this.geo('sphere', () => new THREE.SphereGeometry(1, 24, 16)), this.addMat(0x3b8cff));
    dome.position.copy(p);
    this.addTimed(dome, 0.45, (k) => { dome.scale.setScalar(1 + (1 - k) * 5.5); dome.material.opacity = k * 0.5; });
    this.ring(_a.set(p.x, p.y + 0.06, p.z), 0x9fe2ff, 1, 13, 0.55, _b.set(0, 1, 0));
    this.spark(_a.set(p.x, p.y + 0.5, p.z), 0xdff4ff, 5.5, 0.12);
    this.burst(p.x, p.y + 0.3, p.z, 50, 0x8fd8ff, 14, 0.2, 0.7, 6, 0.8);
    this.burst(p.x, p.y + 0.3, p.z, 20, 0xffffff, 8, 0.14, 0.5, 4, 0.8);
    this.decal(p, _b.set(0, 1, 0), 3.2);
  }

  overdriveBlast(p, radius, fieldTime) {
    const sphere = new THREE.Mesh(this.geo('sphere', () => new THREE.SphereGeometry(1, 24, 16)), this.addMat(0xffe14d));
    sphere.position.copy(p);
    this.spark(_a.set(p.x, p.y + 0.6, p.z), 0xfff3b0, 7, 0.14);
    this.ring(_a.set(p.x, p.y + 0.06, p.z), 0xffe14d, 1, radius * 2.4, 0.5, _b.set(0, 1, 0));
    this.decal(p, _b.set(0, 1, 0), 3.6);
    this.addTimed(sphere, 0.35, (k) => { sphere.scale.setScalar(radius * (1.15 - k * 0.8)); sphere.material.opacity = k * 0.8; });
    this.burst(p.x, p.y + 0.3, p.z, 60, 0xffe14d, 12, 0.22, 0.8, 5, 0.6);
    this.burst(p.x, p.y + 0.3, p.z, 30, 0x6ff6ff, 9, 0.16, 0.6, 3, 0.6);
    // lingering electric field dome
    const field = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd23a, map: this.T.noise, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    field.position.set(p.x, Math.max(0, p.y - 0.2), p.z);
    const arcs = this.makeArcs(p, radius);
    this.addTimed(field, fieldTime, (k, dt) => {
      field.material.opacity = Math.min(1, k * 4) * (0.18 + 0.08 * Math.sin(this.time * 20));
      field.rotation.y += dt * 1.5;
      if (this.T.noise) field.material.map.offset.x = this.time * 0.3;
      this.jitterArcs(arcs, p, radius);
      arcs.material.opacity = Math.min(1, k * 4);
      if (Math.random() < 0.3) { const a = Math.random() * 6.28; this.emit(p.x + Math.cos(a) * radius * 0.9, p.y + Math.random() * 2, p.z + Math.sin(a) * radius * 0.9, 0, 1, 0, 0x6ff6ff, 0.18, 0.4, 0); }
    });
    this.addTimed(arcs, fieldTime, () => {});
  }

  makeArcs(p, radius) {
    const n = 8, segs = 10;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * segs * 2 * 3), 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xbff8ff, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
    lines.frustumCulled = false;
    lines.userData = { n, segs };
    this.jitterArcs(lines, p, radius);
    return lines;
  }

  jitterArcs(lines, p, radius) {
    const { n, segs } = lines.userData;
    const a = lines.geometry.attributes.position.array;
    let o = 0;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, el = Math.random() * 1.2;
      const ex = p.x + Math.cos(ang) * Math.cos(el) * radius, ey = Math.max(0.05, p.y + Math.sin(el) * radius * 0.7), ez = p.z + Math.sin(ang) * Math.cos(el) * radius;
      let px = p.x, py = p.y + 0.3, pz = p.z;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const j = s === segs ? 0 : 0.6;
        const nx = p.x + (ex - p.x) * t + (Math.random() - 0.5) * j, ny = p.y + 0.3 + (ey - p.y - 0.3) * t + (Math.random() - 0.5) * j, nz = p.z + (ez - p.z) * t + (Math.random() - 0.5) * j;
        a[o++] = px; a[o++] = py; a[o++] = pz; a[o++] = nx; a[o++] = ny; a[o++] = nz;
        px = nx; py = ny; pz = nz;
      }
    }
    lines.geometry.attributes.position.needsUpdate = true;
  }

  /** Elimination: the fighter is beamed out in a column of light with a ground ring and rising shards. */
  elimination(p) {
    const beam = new THREE.Mesh(this.geo('beam', () => { const g = new THREE.CylinderGeometry(0.55, 0.75, 16, 16, 1, true); g.translate(0, 8, 0); return g; }), this.addMat(0x8fe8ff, { map: this.beamTex() }));
    beam.position.set(p.x, p.y, p.z); beam.renderOrder = 8;
    this.addTimed(beam, 0.9, (k) => { const w = k < 0.75 ? 1 : 1 + (k - 0.75) * 2; beam.scale.set(w * (0.25 + k * 0.75), 1, w * (0.25 + k * 0.75)); beam.material.opacity = Math.min(1, k * 2.2); });
    const core = new THREE.Mesh(this.geo('beam', () => null), this.addMat(0xffffff, { map: this.beamTex() }));
    core.position.set(p.x, p.y, p.z); core.renderOrder = 9;
    this.addTimed(core, 0.5, (k) => { core.scale.set(0.3 * k, 1, 0.3 * k); core.material.opacity = k; });
    this.ring(_a.set(p.x, p.y + 0.05, p.z), 0x8fe8ff, 0.6, 6, 0.6, _b.set(0, 1, 0));
    this.ring(_a.set(p.x, p.y + 0.05, p.z), 0xb98cff, 0.3, 3.4, 0.8, _b.set(0, 1, 0));
    this.spark(_a.set(p.x, p.y + 1, p.z), 0xdff8ff, 3.2, 0.12);
    this.burst(p.x, p.y + 1, p.z, 44, 0x6ff6ff, 5, 0.16, 1.1, -2.2, 0.5);
    this.burst(p.x, p.y + 1, p.z, 24, 0xb98cff, 4, 0.2, 1.3, -1.4, 0.3);
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = 0.2 + Math.random() * 0.5; this.emit(p.x + Math.cos(a) * r, p.y + Math.random() * 1.8, p.z + Math.sin(a) * r, 0, 5 + Math.random() * 6, 0, 0xffffff, 0.09, 0.8, -3); }
  }

  beamTex() {
    return this._beamTex || (this._beamTex = Effects.canvasTex(8, 128, (x, w, h) => { const g = x.createLinearGradient(0, h, 0, 0); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }));
  }

  /** Respawn / redeploy flash at a position. */
  arrival(p) {
    this.ring(_a.set(p.x, p.y + 0.05, p.z), 0x7dffc4, 0.5, 5, 0.5, _b.set(0, 1, 0));
    this.burst(p.x, p.y + 1, p.z, 26, 0x7dffc4, 4, 0.15, 0.8, -1.5, 0.4);
  }

  landingDust(p, big = false) {
    const n = big ? 16 : 10;
    for (let i = 0; i < n; i++) { const a = i / n * 6.28; this.emit(p.x, p.y + 0.1, p.z, Math.cos(a) * (big ? 4.5 : 3), 0.3, Math.sin(a) * (big ? 4.5 : 3), 0xc8c0f0, 0.5, 0.6, 0, 2, 0.35); }
    this.ring(_a.set(p.x, p.y + 0.05, p.z), 0xd8d0ff, 0.4, big ? 4.2 : 2.6, 0.32, _b.set(0, 1, 0));
  }

  /** Little puffs kicked up by sprinting feet. */
  footDust(p) { if (!this.low) this.emit(p.x + (Math.random() - 0.5) * 0.2, p.y + 0.06, p.z + (Math.random() - 0.5) * 0.2, 0, 0.5, 0, 0xc8c0f0, 0.2, 0.4, -0.3, 2.2, 0.22); }

  /** Sparks and dust thrown back while sliding. */
  slideTrail(p, vx, vz) {
    for (let i = 0; i < 2; i++) this.emit(p.x + (Math.random() - 0.5) * 0.4, p.y + 0.05, p.z + (Math.random() - 0.5) * 0.4, -vx * 0.25 + (Math.random() - 0.5) * 2, 0.8 + Math.random() * 1.6, -vz * 0.25 + (Math.random() - 0.5) * 2, i ? 0xffc37a : 0x8fe8ff, 0.06, 0.3, 9);
    if (Math.random() < 0.5) this.emit(p.x, p.y + 0.08, p.z, -vx * 0.1, 0.4, -vz * 0.1, 0xc8c0f0, 0.3, 0.5, -0.3, 2.4, 0.25);
  }

  healPulse(p) {
    this.ring(_a.set(p.x, p.y + 0.1, p.z), 0x5ff4c8, 0.4, 3, 0.5, _b.set(0, 1, 0));
    this.ring(_a.set(p.x, p.y + 1.1, p.z), 0x5ff4c8, 0.3, 2, 0.6, _b.set(0, 1, 0));
    this.burst(p.x, p.y + 1, p.z, 24, 0x5ff4c8, 3, 0.14, 0.8, -2, 0.6);
  }

  shieldBreak(p) {
    this.ring(p, 0x56c8ff, 0.4, 2.6, 0.4);
    this.burst(p.x, p.y, p.z, 26, 0x8fdcff, 6, 0.14, 0.5, 9);
  }

  chestBurst(p) {
    this.ring(_a.set(p.x, p.y + 0.3, p.z), 0xffd36b, 0.4, 3, 0.45, _b.set(0, 1, 0));
    this.burst(p.x, p.y + 0.6, p.z, 26, 0xffd36b, 4.5, 0.13, 0.8, 5, 0.9);
    this.burst(p.x, p.y + 0.6, p.z, 10, 0xffffff, 3, 0.1, 0.5, 3, 0.9);
  }

  overdriveAura(p) { if (Math.random() < 0.5) this.emit(p.x + (Math.random() - 0.5) * 0.8, p.y + Math.random() * 1.8, p.z + (Math.random() - 0.5) * 0.8, 0, 1.2, 0, 0xffe14d, 0.12, 0.45, 0); }

  // ---------------------------------------------------------------- frame
  update(dt, camera = null) {
    this.time += dt;
    this.updateParticles(dt);
    for (const t of this.tracers) {
      if (t.life <= 0) { t.m.visible = false; continue; }
      t.life -= dt; t.age += dt;
      const head = Math.min(t.len, t.len * (t.travel > 0 ? t.age / t.travel : 1));
      const done = t.age >= t.travel;
      // while travelling: a streak behind the head; afterwards the whole line thins out and fades
      const tail = done ? 0 : Math.max(0, head - t.streak);
      const k = done ? Math.max(0, 1 - (t.age - t.travel) / t.fade) : 1;
      t.m.position.copy(t.from).addScaledVector(t.dir, tail);
      t.m.scale.set(t.width * (done ? 0.35 + 0.65 * k : 1), t.width * (done ? 0.35 + 0.65 * k : 1), Math.max(0.01, head - tail));
      t.m.material.opacity = done ? k * 0.55 : 1;
    }
    for (const f of this.flashPool) {
      if (!f.g.visible) continue;
      f.life -= dt; if (f.life <= 0) { f.g.visible = false; continue; }
      this.applyFlash(f, f.life / f.max);
    }
    for (const k of this.sparkPool) {
      if (!k.s.visible) continue;
      k.life -= dt; if (k.life <= 0) { k.s.visible = false; continue; }
      const u = k.life / k.max; k.s.scale.setScalar(k.size * (1.3 - 0.5 * u)); k.s.material.opacity = u;
    }
    for (const r of this.ringPool) {
      if (!r.m.visible) continue;
      r.life -= dt; if (r.life <= 0) { r.m.visible = false; continue; }
      const u = 1 - r.life / r.max, e = 1 - (1 - u) * (1 - u);
      r.m.scale.setScalar(r.from + (r.to - r.from) * e); r.m.material.opacity = (1 - u) * (1 - u);
      if (r.face && camera) r.m.quaternion.copy(camera.quaternion);
    }
    // scorch marks shrink away at the end of their life
    let dirty = false;
    for (let i = 0; i < this.DEC; i++) {
      if (this.decalLife[i] <= 0) continue;
      this.decalLife[i] -= dt;
      if (this.decalLife[i] < 1.2) {
        const k = Math.max(0, this.decalLife[i] / 1.2);
        _mtx.compose(this.decalPos[i], this.decalQuat[i], _s.setScalar(this.decalSize[i] * k));
        this.decals.setMatrixAt(i, _mtx); dirty = true;
      }
    }
    if (dirty) this.decals.instanceMatrix.needsUpdate = true;
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const e = this.timed[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.scene.remove(e.obj);
        e.obj.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && o.material.map !== this.T.noise) o.material.dispose(); });
        this.timed.splice(i, 1); continue;
      }
      e.update(e.life / e.max, dt);
    }
  }

  clear() {
    for (const e of this.timed) this.scene.remove(e.obj);
    this.timed = [];
    this.pLife.fill(0);
    for (const t of this.tracers) { t.life = 0; t.m.visible = false; }
    for (const f of this.flashPool) f.g.visible = false;
    for (const k of this.sparkPool) k.s.visible = false;
    for (const r of this.ringPool) r.m.visible = false;
    const zero = _mtx.makeScale(0, 0, 0);
    for (let i = 0; i < this.DEC; i++) { this.decalLife[i] = 0; this.decals.setMatrixAt(i, zero); }
    this.decals.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ storm wall
export class StormWall {
  constructor(scene, noiseTex) {
    this.uniforms = { uTime: { value: 0 }, uNoise: { value: noiseTex } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `varying vec2 vUv; varying float vH; void main(){ vUv = uv; vH = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform sampler2D uNoise; varying vec2 vUv; varying float vH;
        void main(){
          vec2 uv = vec2(vUv.x * 24.0, vUv.y * 3.0);
          float n = texture2D(uNoise, uv + vec2(uTime * 0.05, -uTime * 0.12)).r;
          float n2 = texture2D(uNoise, uv * 0.5 + vec2(-uTime * 0.03, -uTime * 0.07)).r;
          float k = n * 0.6 + n2 * 0.6;
          vec3 col = mix(vec3(0.35, 0.12, 0.75), vec3(0.75, 0.45, 1.0), k);
          float edge = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
          gl_FragColor = vec4(col, (0.32 + k * 0.3) * edge);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 160, 96, 1, true), mat);
    this.mesh.position.y = 60;
    this.mesh.renderOrder = 7;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  set(x, z, r) { this.mesh.position.x = x; this.mesh.position.z = z; this.mesh.scale.set(Math.max(0.1, r), 1, Math.max(0.1, r)); }
  update(dt) { this.uniforms.uTime.value += dt; }
  dispose() { this.mesh.parent && this.mesh.parent.remove(this.mesh); }
}
