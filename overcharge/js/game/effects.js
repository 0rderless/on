// Visual effects: GPU-light particle system, tracers, muzzle flashes, explosions, fields, storm wall.
import * as THREE from 'three';

const MAX_PARTICLES = 1400;

export class Effects {
  constructor(scene, textures, quality) {
    this.scene = scene;
    this.T = textures;
    this.low = quality === 'low';
    this.time = 0;
    this.initParticles();
    this.initTracers();
    this.flashes = [];
    this.timed = [];  // {obj, life, max, update(k,dt), dispose}
    const glowMat = new THREE.SpriteMaterial({ map: textures.glow, color: 0xffd38a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
    this.flashPool = [];
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(glowMat.clone()); s.visible = false; s.renderOrder = 10;
      scene.add(s); this.flashPool.push(s);
    }
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
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: 0xffeeaa, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      m.visible = false; m.frustumCulled = false; m.renderOrder = 8;
      this.scene.add(m);
      this.tracers.push({ m, life: 0, max: 0 });
    }
    this.tNext = 0;
  }

  tracer(from, to, color = 0xffeeaa, width = 0.035, life = 0.09) {
    const t = this.tracers[this.tNext]; this.tNext = (this.tNext + 1) % this.tracers.length;
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    t.m.position.copy(from);
    t.m.lookAt(to);
    t.m.scale.set(width, width, len);
    t.m.material.color.setHex(color);
    t.m.material.opacity = 1;
    t.m.visible = true; t.life = life; t.max = life;
  }

  muzzleFlash(pos, color = 0xffd38a, size = 0.55) {
    const s = this.flashPool.find(f => !f.visible) || this.flashPool[0];
    s.position.copy(pos); s.material.color.setHex(color);
    s.scale.setScalar(size * (0.8 + Math.random() * 0.4));
    s.material.rotation = Math.random() * 6.28;
    s.visible = true; s.userData.life = 0.05;
    this.emit(pos.x, pos.y, pos.z, 0, 0.3, 0, 0x9988aa, 0.25, 0.4, -0.5, 2, 0.2);
  }

  impact(p, normal, kind = 'world') {
    if (kind === 'shield') this.burst(p.x, p.y, p.z, 10, 0x56c8ff, 4, 0.12, 0.35, 4);
    else if (kind === 'flesh') this.burst(p.x, p.y, p.z, 10, 0xffffff, 3.5, 0.11, 0.3, 6);
    else {
      for (let i = 0; i < 6; i++) {
        const s = 2 + Math.random() * 3;
        this.emit(p.x, p.y, p.z, normal.x * s + (Math.random() - 0.5) * 2, normal.y * s + Math.random() * 2, normal.z * s + (Math.random() - 0.5) * 2, 0xffc37a, 0.07, 0.25, 12);
      }
      this.emit(p.x, p.y, p.z, normal.x * 0.4, 0.4, normal.z * 0.4, 0xb8b0d8, 0.35, 0.6, -0.2, 2.5, 0.25);
    }
  }

  // ---------------------------------------------------------------- big effects
  addTimed(obj, life, update) {
    this.scene.add(obj);
    this.timed.push({ obj, life, max: life, update });
  }

  shockwave(p) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 48), new THREE.MeshBasicMaterial({ color: 0x6cc8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.copy(p);
    this.addTimed(ring, 0.6, (k) => { const s = 1 + (1 - k) * 7; ring.scale.set(s, s, 1 + (1 - k) * 2); ring.material.opacity = k; });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0x3b8cff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    dome.position.copy(p);
    this.addTimed(dome, 0.45, (k) => { dome.scale.setScalar(1 + (1 - k) * 5.5); dome.material.opacity = k * 0.5; });
    this.burst(p.x, p.y + 0.3, p.z, 50, 0x8fd8ff, 14, 0.2, 0.7, 6, 0.8);
    this.burst(p.x, p.y + 0.3, p.z, 20, 0xffffff, 8, 0.14, 0.5, 4, 0.8);
  }

  overdriveBlast(p, radius, fieldTime) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sphere.position.copy(p);
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

  elimination(p) {
    this.burst(p.x, p.y + 1, p.z, 40, 0x6ff6ff, 5, 0.16, 1.0, -1.5, 0.4);
    this.burst(p.x, p.y + 1, p.z, 20, 0xb98cff, 4, 0.2, 1.2, -1, 0.3);
  }

  landingDust(p) { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; this.emit(p.x, p.y + 0.1, p.z, Math.cos(a) * 3, 0.3, Math.sin(a) * 3, 0xc8c0f0, 0.5, 0.6, 0, 2, 0.35); } }

  overdriveAura(p) { if (Math.random() < 0.5) this.emit(p.x + (Math.random() - 0.5) * 0.8, p.y + Math.random() * 1.8, p.z + (Math.random() - 0.5) * 0.8, 0, 1.2, 0, 0xffe14d, 0.12, 0.45, 0); }

  // ---------------------------------------------------------------- frame
  update(dt) {
    this.time += dt;
    this.updateParticles(dt);
    for (const t of this.tracers) {
      if (t.life <= 0) { t.m.visible = false; continue; }
      t.life -= dt; t.m.material.opacity = Math.max(0, t.life / t.max);
    }
    for (const s of this.flashPool) {
      if (!s.visible) continue;
      s.userData.life -= dt; if (s.userData.life <= 0) s.visible = false;
    }
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const e = this.timed[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.scene.remove(e.obj);
        e.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map !== this.T.noise) o.material.dispose(); });
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
