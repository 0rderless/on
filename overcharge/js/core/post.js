// Bloom ("glow") post effect, built to leave the normal render untouched.
// The scene is drawn straight to the canvas as before (same anti-aliasing, tone mapping and colours); the
// finished frame is then copied into a texture, its bright / saturated pixels are blurred down a small
// mip chain and the result is added back on top. No extra scene render, a handful of tiny passes.
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

function pass(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra });
}

export class Bloom {
  constructor(renderer) {
    this.r = renderer;
    this.enabled = true;
    this.strength = 0.75;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    this.size = new THREE.Vector2();
    this.frame = null; this.levels = [];
    // bright pass: only bright AND saturated pixels glow (neon, energy, flames); pale lit surfaces and the sky do not
    this.mBright = pass(`
      uniform sampler2D tMap; uniform vec2 uTexel; varying vec2 vUv;
      vec3 pick(vec2 uv){ vec3 c = texture2D(tMap, uv).rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float sat = mx - mn; float w = smoothstep(0.7, 1.0, mx) * smoothstep(0.3, 0.72, sat); return c * w; }
      void main(){ vec2 d = uTexel * 1.5;
        vec3 c = pick(vUv + vec2(-d.x, -d.y)) + pick(vUv + vec2(d.x, -d.y)) + pick(vUv + vec2(-d.x, d.y)) + pick(vUv + vec2(d.x, d.y));
        gl_FragColor = vec4(c * 0.25, 1.0); }`, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mDown = pass(`
      uniform sampler2D tMap; uniform vec2 uTexel; varying vec2 vUv;
      void main(){ vec2 d = uTexel;
        vec3 c = texture2D(tMap, vUv).rgb * 4.0 + texture2D(tMap, vUv + vec2(-d.x, -d.y)).rgb + texture2D(tMap, vUv + vec2(d.x, -d.y)).rgb + texture2D(tMap, vUv + vec2(-d.x, d.y)).rgb + texture2D(tMap, vUv + vec2(d.x, d.y)).rgb;
        gl_FragColor = vec4(c / 8.0, 1.0); }`, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } });
    // tent upsample, added onto the next larger level
    this.mUp = pass(`
      uniform sampler2D tMap; uniform vec2 uTexel; uniform float uGain; varying vec2 vUv;
      void main(){ vec2 d = uTexel;
        vec3 c = texture2D(tMap, vUv + vec2(-d.x, 0.0)).rgb + texture2D(tMap, vUv + vec2(d.x, 0.0)).rgb + texture2D(tMap, vUv + vec2(0.0, -d.y)).rgb + texture2D(tMap, vUv + vec2(0.0, d.y)).rgb
          + (texture2D(tMap, vUv + vec2(-d.x, -d.y)).rgb + texture2D(tMap, vUv + vec2(d.x, -d.y)).rgb + texture2D(tMap, vUv + vec2(-d.x, d.y)).rgb + texture2D(tMap, vUv + vec2(d.x, d.y)).rgb) * 0.5;
        gl_FragColor = vec4(c / 6.0 * uGain, 1.0); }`, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() }, uGain: { value: 1 } },
      { blending: THREE.AdditiveBlending, transparent: true });
  }

  resize() {
    this.r.getDrawingBufferSize(this.size);
    const w = Math.max(8, Math.floor(this.size.x)), h = Math.max(8, Math.floor(this.size.y));
    if (this.frame && this.frame.image.width === w && this.frame.image.height === h) return;
    this.dispose();
    this.frame = new THREE.FramebufferTexture(w, h);
    this.frame.minFilter = this.frame.magFilter = THREE.LinearFilter;
    let lw = Math.max(4, w >> 2), lh = Math.max(4, h >> 2);
    for (let i = 0; i < 4; i++) {
      const rt = new THREE.WebGLRenderTarget(lw, lh, { depthBuffer: false, stencilBuffer: false, type: THREE.UnsignedByteType });
      rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter; rt.texture.generateMipmaps = false;
      this.levels.push(rt);
      lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1);
    }
  }

  dispose() {
    if (this.frame) this.frame.dispose();
    for (const l of this.levels) l.dispose();
    this.frame = null; this.levels = [];
  }

  draw(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  /** Call right after the scene has been rendered to the canvas. */
  render() {
    if (!this.enabled) return;
    const r = this.r;
    this.resize();
    const L = this.levels;
    const autoClear = r.autoClear;
    r.autoClear = false;
    r.copyFramebufferToTexture(this.frame);
    // bright pass → level 0, then down the chain
    this.mBright.uniforms.tMap.value = this.frame;
    this.mBright.uniforms.uTexel.value.set(1 / this.frame.image.width, 1 / this.frame.image.height);
    r.setRenderTarget(L[0]); r.clear();
    this.draw(this.mBright, L[0]);
    for (let i = 1; i < L.length; i++) {
      this.mDown.uniforms.tMap.value = L[i - 1].texture;
      this.mDown.uniforms.uTexel.value.set(1 / L[i - 1].width, 1 / L[i - 1].height);
      r.setRenderTarget(L[i]); r.clear();
      this.draw(this.mDown, L[i]);
    }
    // back up, adding each level onto the one above
    this.mUp.uniforms.uGain.value = 1;
    for (let i = L.length - 1; i > 0; i--) {
      this.mUp.uniforms.tMap.value = L[i].texture;
      this.mUp.uniforms.uTexel.value.set(1 / L[i].width, 1 / L[i].height);
      this.draw(this.mUp, L[i - 1]);
    }
    // and onto the canvas
    this.mUp.uniforms.tMap.value = L[0].texture;
    this.mUp.uniforms.uTexel.value.set(1 / L[0].width, 1 / L[0].height);
    this.mUp.uniforms.uGain.value = this.strength;
    this.draw(this.mUp, null);
    r.autoClear = autoClear;
  }
}
