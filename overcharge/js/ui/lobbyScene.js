// 3D lobby: your character on an energised podium.
import * as THREE from 'three';

export class LobbyScene {
  constructor(factory, envTex, textures) {
    this.scene = new THREE.Scene();
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.55;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    this.time = 0;
    this.spin = 0; this.spinVel = 0;
    // background dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; varying vec3 vP;
        void main(){
          float h = vP.y * 0.5 + 0.5;
          vec3 top = vec3(0.05, 0.03, 0.16), mid = vec3(0.24, 0.12, 0.55), low = vec3(0.07, 0.04, 0.2);
          vec3 c = mix(low, mid, smoothstep(0.2, 0.5, h));
          c = mix(c, top, smoothstep(0.55, 1.0, h));
          float rays = pow(max(0.0, sin(atan(vP.x, vP.z) * 9.0 + uTime * 0.2)), 12.0) * smoothstep(0.35, 0.6, h) * 0.12;
          c += vec3(0.5, 0.3, 1.0) * rays;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    this.dome = dome;
    this.scene.add(dome);
    // podium
    const podMat = new THREE.MeshStandardMaterial({ color: 0x1d1440, metalness: 0.7, roughness: 0.35 });
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.4, 6), podMat); pod.position.y = -0.2; this.scene.add(pod);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.04, 8, 64), new THREE.MeshBasicMaterial({ color: 0x4ff2ff, toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; this.scene.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.025, 8, 80), new THREE.MeshBasicMaterial({ color: 0xffe14d, toneMapped: false }));
    ring2.rotation.x = Math.PI / 2; ring2.position.y = -0.38; this.scene.add(ring2);
    this.ring2 = ring2;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshStandardMaterial({ color: 0x120c2c, metalness: 0.5, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.4; this.scene.add(floor);
    // beams behind
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x7a48c8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 14, 8, 1, true), beamMat);
      b.position.set(-6 + i * 3, 6, -7 - Math.abs(i - 2)); this.scene.add(b);
    }
    // floating particles
    const pg = new THREE.BufferGeometry(); const n = 160; const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 16; pos[i * 3 + 1] = Math.random() * 7 - 0.3; pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2; }
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particles = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.07, map: textures.glow, color: 0xb98cff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(this.particles);
    // lights
    this.scene.add(new THREE.HemisphereLight(0xb8a8ff, 0x2a1a50, 1.4));
    const key = new THREE.DirectionalLight(0xfff0e0, 2.6); key.position.set(2, 4, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x4ff2ff, 3.0); rim.position.set(-3, 2.5, -3); this.scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0xb06bff, 2.4); rim2.position.set(3, 1.5, -2); this.scene.add(rim2);
    this.char = factory.create({ skin: 'default', shadows: false });
    this.scene.add(this.char.root);
    this.char.setHeld('gun', 'ar', 4);
    this.layout('play');
  }

  setSkin(id) { this.char.setSkin(id); }
  showPickaxe(id) { this.char.setHeld('pickaxe', id); }
  showGun() { if (!this.emoteId) this.char.setHeld('gun', 'ar', 4); }
  /** Lobby emote: the character dances (gun put away) until stopped. */
  playEmote(id) { this.showGlider(null); this.emoteId = id; this.char.playEmote(id); }
  stopEmote() { if (!this.emoteId) return; this.emoteId = null; this.char.stopEmote(); this.showGun(); }
  /** Locker glider preview: the character glides in place under the chosen glider (null = back to normal). */
  showGlider(id) {
    this.glidePreview = id || null;
    if (id) { this.char.gliderId = id; this.char.setHeld(null); this.char.setGlider(true); this.layout('glider'); }
    else if (this.char.glider) { this.char.setGlider(false); if (this.mode === 'glider') this.layout('locker'); }
  }

  layout(mode) {
    // frame the character depending on which tab is open
    this.mode = mode;
    this.target = mode === 'glider' ? { x: 2.3, y: 3.1, z: 13, lx: 2.3, ly: 2.95 } : mode === 'locker' ? { x: 0.9, y: 1.05, z: 5.8, lx: 0.9, ly: 0.95 } : mode === 'play' ? { x: 0.2, y: 1.15, z: 6.3, lx: 0.2, ly: 0.95 } : { x: -1.4, y: 1.1, z: 6.8, lx: -1.4, ly: 0.95 };
  }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  drag(dx) { this.spinVel += dx * 0.012; }

  update(dt) {
    this.time += dt;
    this.dome.material.uniforms.uTime.value = this.time;
    this.spinVel *= Math.pow(0.04, dt);
    this.spin += this.spinVel * dt * 10;
    this.char.update(dt, { vx: 0, vz: 0, yaw: -0.35 + this.spin + (this.glidePreview ? 0.6 : 0), pitch: 0.02, grounded: !this.glidePreview, mode: this.glidePreview ? 'glide' : 'ground', reloadFrac: -1, camDist: 3 });
    if (this.glidePreview) this.char.root.position.y = 0.35 + Math.sin(this.time * 1.4) * 0.12; else this.char.root.position.y = 0;
    this.ring2.rotation.z = this.time * 0.3;
    const p = this.particles.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * 0.25; if (y > 7) y = -0.3; p.setY(i, y); }
    p.needsUpdate = true;
    const t = this.target, c = this.camera;
    const k = Math.min(1, dt * 4);
    c.position.x += (t.x - c.position.x) * k; c.position.y += (t.y - c.position.y) * k; c.position.z += (t.z - c.position.z) * k;
    this.look = this.look || new THREE.Vector3(t.lx, t.ly, 0);
    this.look.x += (t.lx - this.look.x) * k; this.look.y += (t.ly - this.look.y) * k;
    c.lookAt(this.look);
  }
}
