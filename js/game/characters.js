// Characters: skinned soldier model, 3 skins, pickaxes, weapon models, animation blending
// and procedural poses (aim pitch, crouch, recoil, reload, skydive, glide, swing, throw).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RARITIES } from '../data/items.js';
import { makeJetpack } from './jetpack.js';

const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();
const _right = new THREE.Vector3(), _fwd = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** Rotate a bone about a world-space axis (applied after the animation mixer). */
function rotateBoneWorld(bone, axis, angle) {
  if (!angle) return;
  bone.parent.getWorldQuaternion(_qp);
  _q.setFromAxisAngle(axis, angle);
  _qi.copy(_qp).invert();
  bone.quaternion.premultiply(_qp).premultiply(_q).premultiply(_qi);
}

// Per gun-model normalisation: rotate so the muzzle points +Z, scale, grip location (fractions of bbox).
const GUN_MODELS = {
  rifle:   { flip: false, scale: 1.0,  grip: [0.5, 0.32, 0.36], muzzle: 1.0 },
  shotgun: { flip: true,  scale: 1.05, grip: [0.5, 0.28, 0.32], muzzle: 1.0 },
  blaster: { flip: false, scale: 1.6,  grip: [0.5, 0.25, 0.30], muzzle: 1.0 },
};

// Material settings for the shader-based skins (body + visor).
const SKIN_LOOKS = {
  cursed: { rough: 0.55, metal: 0.35, env: 0.5, visor: 0x0a0010, visorGlow: 0xb24dff, visorI: 2.4 },
  zombie: { rough: 0.85, metal: 0.05, env: 0.25, visor: 0x050a02, visorGlow: 0x7dff3c, visorI: 2.2 },
  dragon: { rough: 0.32, metal: 0.55, env: 0.9, visor: 0x220400, visorGlow: 0xff8a1f, visorI: 2.0 },
  frost: { rough: 0.18, metal: 0.25, env: 1.2, visor: 0x0a2236, visorGlow: 0x7ee8ff, visorI: 2.2 },
};

export class CharacterFactory {
  constructor(assets, renderer) {
    this.assets = assets;
    this.renderer = renderer;
    this.time = { value: 0 };
    const g = assets.gltf.soldier;
    this.template = g.scene;
    this.clips = {};
    for (const c of g.animations) this.clips[c.name.replace('soldier_', '')] = c;
    const run = assets.gltf.run.animations.find(a => a.name === 'Run');
    if (run) this.clips.run = run;
    // strip root motion from locomotion clips (keep vertical bob)
    for (const k of ['forward', 'backward', 'left', 'right', 'run', 'idle']) {
      const clip = this.clips[k]; if (!clip) continue;
      for (const t of clip.tracks) {
        if (t.name.endsWith('Hips.position')) {
          const v = t.values; const x0 = v[0], y0 = v[1];
          for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 1] = y0; }
        }
      }
    }
    this.baseMats = {};
    this.template.traverse(o => {
      if (o.isSkinnedMesh) {
        o.castShadow = true; o.receiveShadow = false;
        this.baseMats[o.material.name] = o.material;
      }
    });
    this.skinCache = {};
    this.gunCache = {};
    this.computeAttachFrames();
    this.gunTemplates = {};
    for (const key of Object.keys(GUN_MODELS)) this.gunTemplates[key] = this.normalizeGun(key);
  }

  findBone(root, suffix) {
    let found = null;
    root.traverse(o => { if (!found && o.isBone && o.name.endsWith(suffix)) found = o; });
    return found;
  }

  /** Work out where the right hand is in the idle pose, so held items can be expressed in character space. */
  computeAttachFrames() {
    const inst = SkeletonUtils.clone(this.template);
    const mixer = new THREE.AnimationMixer(inst);
    mixer.clipAction(this.clips.idle).play();
    mixer.update(0.4);
    inst.updateMatrixWorld(true);
    const hand = this.findBone(inst, 'RightHand');
    const lhand = this.findBone(inst, 'LeftHand');
    const spine2 = this.findBone(inst, 'Spine2');
    const head = this.findBone(inst, 'Head');
    const handPos = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld);
    const lhandPos = new THREE.Vector3().setFromMatrixPosition(lhand.matrixWorld);
    this.idleHand = handPos.clone();
    this.idleLHand = lhandPos.clone();
    this.headY = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld).y;
    // Gun frame: at the right hand, barrel pointing from right hand toward left hand (as the idle pose holds it).
    const dir = lhandPos.clone().sub(handPos); dir.y *= 0.35; dir.normalize();
    // bias toward straight ahead so the gun points where the character faces
    dir.lerp(new THREE.Vector3(0, -0.02, 1), 0.55).normalize();
    const look = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir.clone().negate(), _up);
    const gunWorld = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(look));
    gunWorld.setPosition(handPos);
    const handInv = hand.matrixWorld.clone().invert();
    this.gunLocal = handInv.clone().multiply(gunWorld);
    // Pickaxe frame: handle up/forward from the hand
    const pickWorld = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.55, 0, 0));
    pickWorld.setPosition(handPos);
    this.pickLocal = handInv.clone().multiply(pickWorld);
    // Back frame (for backpacks) relative to Spine2
    const backWorld = new THREE.Matrix4().makeTranslation(0, new THREE.Vector3().setFromMatrixPosition(spine2.matrixWorld).y + 0.02, -0.17);
    this.backLocal = spine2.matrixWorld.clone().invert().multiply(backWorld);
    const headPos = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
    this.headLocal = head.matrixWorld.clone().invert().multiply(new THREE.Matrix4().makeTranslation(headPos.x, headPos.y, headPos.z));
    const chestPos = new THREE.Vector3().setFromMatrixPosition(spine2.matrixWorld);
    this.chestLocal = spine2.matrixWorld.clone().invert().multiply(new THREE.Matrix4().makeTranslation(chestPos.x, chestPos.y, chestPos.z));
    const s = new THREE.Vector3(); hand.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    this.boneScale = s.x; // ~0.01 (armature is in centimetres)
  }

  normalizeGun(key) {
    const src = this.assets.gltf[key].scene;
    const cfg = GUN_MODELS[key];
    const holder = new THREE.Group();
    const m = src.clone(true);
    if (cfg.flip) m.rotation.y = Math.PI;
    holder.add(m);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    const grip = new THREE.Vector3(
      box.min.x + size.x * cfg.grip[0], box.min.y + size.y * cfg.grip[1], box.min.z + size.z * cfg.grip[2]);
    m.position.sub(grip);
    const outer = new THREE.Group();
    outer.add(holder);
    outer.scale.setScalar(cfg.scale);
    const muzzleZ = (box.max.z - grip.z) * cfg.scale;
    const topY = (box.max.y - grip.y) * cfg.scale;
    outer.userData.muzzle = new THREE.Vector3(0, topY * 0.35, muzzleZ);
    outer.userData.length = size.z * cfg.scale;
    outer.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    return outer;
  }

  // ------------------------------------------------------------------ skins
  skinMaterial(skinId, baseMat) {
    const key = `${skinId}|${baseMat.name}`;
    if (this.skinCache[key]) return this.skinCache[key];
    const isVisor = /visor/i.test(baseMat.name);
    let mat;
    if (skinId === 'default') {
      mat = baseMat.clone();
      if (!isVisor) { mat.roughness = 0.7; mat.metalness = 0.15; }
    } else if (skinId === 'shock') {
      mat = new THREE.MeshStandardMaterial({ map: baseMat.map, normalMap: baseMat.normalMap || null, roughness: 0.38, metalness: 0.3, envMapIntensity: 0.5 });
      if (isVisor) { mat.map = null; mat.color.set(0x111111); mat.emissive.set(0xffe14d); mat.emissiveIntensity = 2.2; }
      else this.patchShader(mat, 'shock');
    } else if (skinId === 'platinum') {
      mat = new THREE.MeshStandardMaterial({ map: baseMat.map, normalMap: baseMat.normalMap || null, roughness: 0.2, metalness: 1.0, envMapIntensity: 1.35 });
      if (isVisor) { mat.map = null; mat.color.set(0xffc44d); mat.metalness = 1; mat.roughness = 0.12; mat.emissive.set(0x5a3a00); }
      else this.patchShader(mat, 'platinum');
    } else if (SKIN_LOOKS[skinId]) {
      const L = SKIN_LOOKS[skinId];
      mat = new THREE.MeshStandardMaterial({ map: baseMat.map, normalMap: baseMat.normalMap || null, roughness: L.rough, metalness: L.metal, envMapIntensity: L.env });
      if (isVisor) { mat.map = null; mat.color.set(L.visor); mat.emissive.set(L.visorGlow); mat.emissiveIntensity = L.visorI; mat.roughness = 0.15; }
      else this.patchShader(mat, skinId);
    } else mat = baseMat.clone();
    mat.name = key;
    this.skinCache[key] = mat;
    return mat;
  }

  patchShader(mat, kind) {
    const timeU = this.time;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = timeU;
      sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader;
      const helpers = `
          float oc_l(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
          float oc_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float oc_noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(oc_hash(i), oc_hash(i + vec2(1.0, 0.0)), f.x), mix(oc_hash(i + vec2(0.0, 1.0)), oc_hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      `;
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', helpers + '\nvoid main() {');
      const common = `
          #include <map_fragment>
          vec3 oc_src = diffuseColor.rgb;
          float lum = oc_l(oc_src);
          float oc_r = max(oc_src.r, 1e-3);
          float redness = smoothstep(0.45, 0.25, oc_src.g / oc_r) * smoothstep(0.45, 0.25, oc_src.b / oc_r) * smoothstep(0.12, 0.25, oc_src.r);
          float darkness = 1.0 - smoothstep(0.08, 0.2, lum);
          vec2 oc_px = vec2(1.5 / 1024.0);
          float oc_lx = oc_l(texture2D(map, vMapUv + vec2(oc_px.x, 0.0)).rgb);
          float oc_ly = oc_l(texture2D(map, vMapUv + vec2(0.0, oc_px.y)).rgb);
          float edge = smoothstep(0.05, 0.16, abs(oc_lx - lum) + abs(oc_ly - lum));
      `;
      if (kind === 'shock') {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', common + `
          vec3 armor = mix(vec3(0.012, 0.016, 0.035), vec3(0.045, 0.06, 0.12), smoothstep(0.15, 0.75, lum));
          armor = mix(armor, vec3(0.015, 0.015, 0.02), darkness);
          diffuseColor.rgb = armor;
        `).replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          float band = smoothstep(0.9, 1.0, fract(vMapUv.y * 2.5 - uTime * 0.7));
          float pulse = 0.7 + 0.3 * sin(uTime * 6.0 + vMapUv.x * 20.0);
          totalEmissiveRadiance += vec3(0.15, 0.8, 1.0) * edge * (1.0 - darkness) * (1.3 * pulse + band * 2.5);
          totalEmissiveRadiance += vec3(1.0, 0.85, 0.2) * redness * 1.6 * pulse;
        `);
      } else if (kind === 'cursed') {
        // charred armour split by glowing purple curse veins
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', common + `
          float vein = 1.0 - smoothstep(0.0, 0.035, abs(oc_noise(vMapUv * 34.0) - 0.5));
          vein *= 1.0 - darkness;
          diffuseColor.rgb = mix(vec3(0.018, 0.012, 0.025), vec3(0.11, 0.07, 0.14), smoothstep(0.15, 0.8, lum));
        `).replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          float flick = 0.65 + 0.35 * sin(uTime * 3.0 + vMapUv.y * 30.0);
          totalEmissiveRadiance += vec3(0.62, 0.18, 1.0) * (vein * 1.6 * flick + edge * 0.35);
          totalEmissiveRadiance += vec3(0.25, 1.0, 0.45) * redness * 0.9;
        `);
      } else if (kind === 'zombie') {
        // rotting, mossy skin with dried-blood straps
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', common + `
          float rot = oc_noise(vMapUv * 14.0) * 0.55 + oc_noise(vMapUv * 48.0) * 0.45;
          vec3 flesh = mix(vec3(0.11, 0.15, 0.08), vec3(0.27, 0.35, 0.17), rot);         // grey-green dead skin
          float sores = smoothstep(0.6, 0.74, oc_noise(vMapUv * 22.0 + 7.0));
          flesh = mix(flesh, vec3(0.06, 0.05, 0.025), sores * 0.85);                     // dark rot patches
          float blood = smoothstep(0.68, 0.8, oc_noise(vMapUv * 31.0 + 21.0));
          flesh = mix(flesh, vec3(0.3, 0.02, 0.015), blood * 0.75);                       // dried blood
          flesh *= 0.6 + 0.5 * smoothstep(0.1, 0.8, lum);
          flesh = mix(flesh, vec3(0.04, 0.04, 0.025), darkness * 0.8);
          diffuseColor.rgb = mix(flesh, vec3(0.2, 0.02, 0.015), redness);
        `).replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.35, 1.0, 0.2) * edge * 0.12 * (1.0 - darkness);
        `);
      } else if (kind === 'dragon') {
        // crimson scale armour, gold trim, ember glow in the seams
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', common + `
          vec2 suv = vMapUv * vec2(70.0, 90.0); suv.x += floor(suv.y) * 0.5;
          float scaleRim = smoothstep(0.32, 0.5, length((fract(suv) - 0.5) * vec2(1.0, 1.35)));
          vec3 red = mix(vec3(0.12, 0.005, 0.005), vec3(0.5, 0.03, 0.02), smoothstep(0.1, 0.8, lum));
          red *= 1.0 - scaleRim * 0.45;
          red = mix(red, vec3(0.03, 0.01, 0.01), darkness);
          float gold = max(redness, edge * 0.6);
          diffuseColor.rgb = mix(red, vec3(1.0, 0.68, 0.18), gold);
          float oc_gold = gold;
        `).replace('#include <metalnessmap_fragment>', `
          #include <metalnessmap_fragment>
          metalnessFactor = mix(0.45, 1.0, oc_gold);
        `).replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.0, 0.32, 0.05) * edge * (1.0 - darkness) * (0.45 + 0.25 * sin(uTime * 2.2 + vMapUv.x * 12.0));
        `);
      } else if (kind === 'frost') {
        // glacier-white plating with icy cyan seams and twinkling frost
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', common + `
          float frostN = oc_noise(vMapUv * 28.0);
          vec3 ice = mix(vec3(0.45, 0.62, 0.8), vec3(0.93, 0.97, 1.0), smoothstep(0.1, 0.75, lum) * 0.8 + frostN * 0.2);
          ice = mix(ice, vec3(0.12, 0.2, 0.32), darkness);
          diffuseColor.rgb = ice;
          float sparkle = step(0.985, oc_hash(floor(vMapUv * 420.0))) * (0.5 + 0.5 * sin(uTime * 4.0 + oc_hash(floor(vMapUv * 420.0)) * 30.0));
        `).replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.3, 0.85, 1.0) * (edge * 0.7 * (1.0 - darkness) + redness * 0.8) + vec3(0.8, 0.95, 1.0) * sparkle * 1.5;
        `);
      } else {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', common + `
          vec3 plat = mix(vec3(0.62, 0.64, 0.7), vec3(0.97, 0.97, 1.0), smoothstep(0.2, 0.8, lum));
          plat = mix(plat, vec3(0.16, 0.16, 0.2), darkness);
          diffuseColor.rgb = mix(plat, vec3(1.0, 0.75, 0.26), max(redness, edge * 0.0));
          float oc_glint = redness;
        `).replace('#include <roughnessmap_fragment>', `
          #include <roughnessmap_fragment>
          roughnessFactor = mix(0.14, 0.42, darkness);
        `).replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.0, 0.7, 0.2) * oc_glint * (0.12 + 0.08 * sin(uTime * 2.0));
        `);
      }
    };
    mat.customProgramCacheKey = () => 'oc_' + kind;
  }

  // ------------------------------------------------------------------ items
  gunModel(id, rarity = 0) {
    const key = id === 'ar' || id === 'sniper' ? 'rifle' : id === 'shotgun' ? 'shotgun' : 'blaster';
    const tpl = this.gunTemplates[key];
    const g = tpl.clone(true);
    g.userData.muzzle = tpl.userData.muzzle.clone(); // clone() JSON-copies userData, restore the Vector3
    const rc = new THREE.Color(RARITIES[rarity].glow);
    // rarity tint: clone materials once per (key, rarity)
    const ck = `${key}|${rarity}|${id}`;
    if (!this.gunCache[ck]) {
      this.gunCache[ck] = new Map();
    }
    const cache = this.gunCache[ck];
    g.traverse(o => {
      if (o.isMesh) {
        if (!cache.has(o.material)) {
          const m = o.material.clone();
          m.emissive = rc.clone(); m.emissiveIntensity = 0.06 + rarity * 0.035;
          if (id === 'sniper') m.color = new THREE.Color(0xb9a6ff);
          cache.set(o.material, m);
        }
        o.material = cache.get(o.material);
      }
    });
    if (!this._parts) {
      this._parts = {
        barrel: new THREE.CylinderGeometry(0.018, 0.022, 0.42, 10), scope: new THREE.CylinderGeometry(0.035, 0.035, 0.32, 14),
        lens: new THREE.CircleGeometry(0.03, 14), lensMat: new THREE.MeshBasicMaterial({ color: 0xff5cf0, toneMapped: false }),
        strips: {}, stripMats: RARITIES.map(r => new THREE.MeshBasicMaterial({ color: r.glow, toneMapped: false })),
      };
    }
    const P = this._parts;
    if (id === 'sniper') {
      // longer barrel + big scope
      const barrel = new THREE.Mesh(P.barrel, this.metalMat());
      barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.035, g.userData.muzzle.z + 0.17);
      const scope = new THREE.Mesh(P.scope, this.metalMat());
      scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.16, 0.05);
      const lens = new THREE.Mesh(P.lens, P.lensMat);
      lens.position.set(0, 0.16, 0.211);
      g.add(barrel, scope, lens);
      g.userData.muzzle = g.userData.muzzle.clone(); g.userData.muzzle.z += 0.38;
    }
    const L = +(g.userData.length * 0.45).toFixed(3);
    const stripGeo = P.strips[L] || (P.strips[L] = new THREE.BoxGeometry(0.012, 0.012, L));
    const strip = new THREE.Mesh(stripGeo, P.stripMats[rarity]);
    strip.position.set(0.035, 0.03, g.userData.length * 0.12);
    g.add(strip);
    return g;
  }

  metalMat() {
    if (!this._metal) this._metal = new THREE.MeshStandardMaterial({ color: 0x2a2d3a, metalness: 0.8, roughness: 0.35 });
    return this._metal;
  }

  grenadeModel(id) {
    if (!this._nade) {
      const glowB = new THREE.MeshBasicMaterial({ color: 0x4fb6ff, toneMapped: false });
      const glowY = new THREE.MeshBasicMaterial({ color: 0xffe14d, toneMapped: false });
      this._nade = {
        sphere: new THREE.SphereGeometry(0.075, 16, 12), torus: new THREE.TorusGeometry(0.076, 0.012, 8, 24),
        capS: new THREE.CylinderGeometry(0.025, 0.03, 0.04, 10), body: new THREE.CylinderGeometry(0.05, 0.05, 0.16, 14),
        band: new THREE.CylinderGeometry(0.052, 0.052, 0.014, 14), capO: new THREE.CylinderGeometry(0.03, 0.04, 0.035, 10),
        shockMat: new THREE.MeshStandardMaterial({ color: 0x1b2a4a, metalness: 0.6, roughness: 0.3 }),
        odMat: new THREE.MeshStandardMaterial({ color: 0x1d1b22, metalness: 0.5, roughness: 0.4 }), glowB, glowY,
      };
    }
    const N = this._nade, grp = new THREE.Group();
    if (id === 'shockwave') {
      const band = new THREE.Mesh(N.torus, N.glowB); band.rotation.x = Math.PI / 2;
      const band2 = new THREE.Mesh(N.torus, N.glowB);
      const cap = new THREE.Mesh(N.capS, this.metalMat()); cap.position.y = 0.08;
      grp.add(new THREE.Mesh(N.sphere, N.shockMat), band, band2, cap);
    } else {
      for (const y of [-0.045, 0, 0.045]) { const b = new THREE.Mesh(N.band, N.glowY); b.position.y = y; grp.add(b); }
      const cap = new THREE.Mesh(N.capO, this.metalMat()); cap.position.y = 0.095;
      grp.add(new THREE.Mesh(N.body, N.odMat), cap);
    }
    return grp;
  }

  jetpackModel() { return makeJetpack(); }

  medkitModel() {
    if (!this._med) {
      const plus = new THREE.MeshBasicMaterial({ color: 0x5ff4c8, toneMapped: false });
      this._med = {
        body: new RoundedBoxGeometry(0.3, 0.2, 0.11, 2, 0.025), handle: new THREE.TorusGeometry(0.045, 0.012, 6, 14, Math.PI),
        bar: new THREE.BoxGeometry(0.11, 0.032, 0.012), latch: new THREE.BoxGeometry(0.3, 0.02, 0.115),
        bodyMat: new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.35, metalness: 0.1 }),
        latchMat: new THREE.MeshStandardMaterial({ color: 0x24303c, roughness: 0.5, metalness: 0.5 }), plus,
      };
    }
    const M = this._med, g = new THREE.Group();
    g.add(new THREE.Mesh(M.body, M.bodyMat));
    const latch = new THREE.Mesh(M.latch, M.latchMat); latch.position.y = 0.04; g.add(latch);
    const handle = new THREE.Mesh(M.handle, M.latchMat); handle.position.y = 0.1; g.add(handle);
    for (const z of [0.058, -0.058]) {
      const h = new THREE.Mesh(M.bar, M.plus); h.position.set(0, -0.02, z);
      const v = new THREE.Mesh(M.bar, M.plus); v.position.set(0, -0.02, z); v.rotation.z = Math.PI / 2;
      g.add(h, v);
    }
    return g;
  }

  pickaxeModel(id) {
    const g = new THREE.Group();
    const std = (c, mt = 0.2, r = 0.6, e = 0) => new THREE.MeshStandardMaterial({ color: c, metalness: mt, roughness: r, emissive: e ? new THREE.Color(e) : new THREE.Color(0), emissiveIntensity: e ? 1.6 : 0 });
    const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
    if (id === 'standard') {
      add(new THREE.CylinderGeometry(0.022, 0.026, 0.85, 10), std(0x6b4a2e, 0, 0.8), 0, 0.3, 0);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10), std(0x222222, 0, 0.9), 0, -0.05, 0);
      const head = add(new RoundedBoxGeometry(0.62, 0.07, 0.07, 2, 0.02), std(0x9aa2b5, 0.85, 0.35), 0, 0.68, 0);
      head.scale.set(1, 1, 1);
      add(new THREE.ConeGeometry(0.035, 0.16, 8), std(0x9aa2b5, 0.85, 0.3), 0.36, 0.66, 0, 0, 0, -Math.PI / 2 - 0.25);
      add(new THREE.ConeGeometry(0.035, 0.12, 8), std(0x9aa2b5, 0.85, 0.3), -0.34, 0.66, 0, 0, 0, Math.PI / 2 + 0.25);
    } else if (id === 'volt') {
      add(new THREE.CylinderGeometry(0.024, 0.028, 0.9, 10), std(0x15161e, 0.6, 0.4), 0, 0.32, 0);
      for (const y of [0.05, 0.25, 0.45]) add(new THREE.TorusGeometry(0.03, 0.008, 6, 14), glow(0x4ff2ff), 0, y, 0, Math.PI / 2);
      const blade = new THREE.Shape();
      blade.moveTo(0, 0); blade.lineTo(0.32, 0.12); blade.lineTo(0.36, -0.14); blade.lineTo(0.05, -0.1); blade.lineTo(0, 0);
      const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.03, bevelEnabled: false });
      add(bg, std(0x2b3350, 0.8, 0.3, 0x1a6aff), 0.02, 0.7, -0.015);
      add(new THREE.BoxGeometry(0.34, 0.012, 0.035), glow(0x6ff6ff), 0.2, 0.6, 0, 0, 0, 0.75);
      add(new THREE.ConeGeometry(0.03, 0.18, 6), std(0x2b3350, 0.8, 0.3), -0.1, 0.72, 0, 0, 0, Math.PI / 2);
    } else if (id === 'platinum') {
      add(new THREE.CylinderGeometry(0.024, 0.026, 0.85, 12), std(0xe8e8ee, 1, 0.18), 0, 0.3, 0);
      for (let y = -0.05; y < 0.25; y += 0.04) add(new THREE.TorusGeometry(0.027, 0.007, 6, 14), std(0xffc94d, 1, 0.2), 0, y, 0, Math.PI / 2);
      add(new RoundedBoxGeometry(0.66, 0.08, 0.08, 2, 0.025), std(0xf2f2f8, 1, 0.12), 0, 0.68, 0);
      add(new THREE.ConeGeometry(0.04, 0.2, 10), std(0xf2f2f8, 1, 0.12), 0.4, 0.65, 0, 0, 0, -Math.PI / 2 - 0.3);
      add(new THREE.ConeGeometry(0.04, 0.16, 10), std(0xf2f2f8, 1, 0.12), -0.38, 0.65, 0, 0, 0, Math.PI / 2 + 0.3);
      add(new THREE.SphereGeometry(0.05, 12, 10), std(0xffc94d, 1, 0.15), 0, 0.68, 0);
    } else { // reaper
      add(new THREE.CylinderGeometry(0.02, 0.024, 1.05, 10), std(0x231b33, 0.5, 0.5), 0, 0.38, 0);
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.quadraticCurveTo(0.35, 0.2, 0.55, -0.12); s.quadraticCurveTo(0.32, 0.05, 0.02, -0.08); s.lineTo(0, 0);
      add(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), std(0x6b2fd6, 0.7, 0.25, 0x7a2cff), 0, 0.88, -0.01);
      add(new THREE.SphereGeometry(0.04, 10, 8), glow(0xff5ce1), 0, 0.9, 0);
    }
    return g;
  }

  gliderModel() {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-1.4, 0); shape.quadraticCurveTo(0, 0.55, 1.4, 0); shape.lineTo(1.1, -0.25); shape.quadraticCurveTo(0, 0.2, -1.1, -0.25); shape.lineTo(-1.4, 0);
    if (!this._gliderTex) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 256, 0);
      g.addColorStop(0, '#5b2bd6'); g.addColorStop(0.5, '#9a5cff'); g.addColorStop(1, '#5b2bd6');
      x.fillStyle = g; x.fillRect(0, 0, 256, 64);
      x.fillStyle = '#ffe14d'; x.beginPath(); x.moveTo(118, 8); x.lineTo(100, 36); x.lineTo(126, 36); x.lineTo(112, 58); x.lineTo(156, 24); x.lineTo(130, 24); x.lineTo(142, 8); x.fill();
      x.fillStyle = 'rgba(79,242,255,0.9)'; x.fillRect(0, 0, 256, 5); x.fillRect(0, 59, 256, 5);
      this._gliderTex = new THREE.CanvasTexture(c); this._gliderTex.colorSpace = THREE.SRGBColorSpace;
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false });
    // planar UVs across the span
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 1.4) / 2.8, pos.getZ(i) / 0.9);
    const wing = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this._gliderTex, metalness: 0.2, roughness: 0.55, side: THREE.DoubleSide, emissive: 0x2a0f6a, emissiveIntensity: 0.6 }));
    wing.rotation.x = Math.PI / 2; wing.position.set(0, 2.55, 0.45);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: 0x5ff4ff, toneMapped: false }));
    trim.position.set(0, 2.62, 0.46);
    g.add(wing, trim);
    for (const x of [-0.25, 0.25]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0x222233 }));
      rope.position.set(x, 2.1, 0.05); g.add(rope);
    }
    return g;
  }

  create(opts) { return new Character(this, opts); }
}

// ======================================================================= Character
export class Character {
  constructor(factory, { skin = 'default', pickaxe = 'standard', shadows = true } = {}) {
    this.f = factory;
    this.root = new THREE.Group();
    this.body = new THREE.Group();     // pitched for skydive
    this.root.add(this.body);
    this.model = SkeletonUtils.clone(factory.template);
    this.body.add(this.model);
    this.meshes = [];
    this.model.traverse(o => { if (o.isSkinnedMesh) { this.meshes.push(o); o.castShadow = shadows; o.frustumCulled = true; } });
    this.bones = {};
    for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightShoulder', 'LeftShoulder'])
      this.bones[n] = factory.findBone(this.model, n);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const k of ['idle', 'forward', 'backward', 'left', 'right', 'run', 'tpose']) {
      const a = this.mixer.clipAction(factory.clips[k]);
      a.play(); a.setEffectiveWeight(k === 'idle' ? 1 : 0);
      this.actions[k] = a;
    }
    for (const k of ['death1', 'death2']) {
      const a = this.mixer.clipAction(factory.clips[k]);
      a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
      this.actions[k] = a;
    }
    this.weights = { idle: 1, forward: 0, backward: 0, left: 0, right: 0, run: 0, tpose: 0 };
    this.held = null; this.heldKind = null; this.heldId = null;
    this.muzzleLocal = new THREE.Vector3();
    this.recoil = 0; this.swingT = -1; this.throwT = -1;
    this.dead = false; this.deathT = 0;
    this.crouchAmt = 0; this.pitchSmooth = 0;
    this.skydiveAmt = 0; this.glideAmt = 0;
    this.lod = 0; this.frameSkip = 0;
    this.attachments = [];
    this.glider = null;
    this.setSkin(skin);
    this.pickaxeId = pickaxe;
  }

  setSkin(id) {
    this.skin = id;
    for (const m of this.meshes) {
      const base = this.f.baseMats[m.userData.baseName || m.material.name] || m.material;
      m.userData.baseName = m.userData.baseName || m.material.name;
      m.material = this.f.skinMaterial(id, this.f.baseMats[m.userData.baseName] || base);
    }
    for (const a of this.attachments) a.parent && a.parent.remove(a);
    this.attachments = [];
    this.orbit = null; this.wings = null;
    if (id === 'shock') this.addShockGear();
    if (id === 'platinum') this.addPlatinumGear();
    if (id === 'cursed') this.addCursedGear();
    if (id === 'dragon') this.addDragonGear();
    if (id === 'frost') this.addFrostGear();
    for (const a of this.attachments) a.visible = !this.jetpackObj || !!a.userData.keep;
  }

  attachToBone(boneName, obj, localMatrix) {
    const bone = this.bones[boneName];
    const holder = new THREE.Group();
    localMatrix.decompose(holder.position, holder.quaternion, holder.scale);
    holder.add(obj); // localMatrix already carries the bone's inverse (centimetre) scale
    bone.add(holder);
    return holder;
  }

  addShockGear() {
    const pack = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x14161f, metalness: 0.7, roughness: 0.35 });
    const glow = new THREE.MeshBasicMaterial({ color: 0x4ff2ff, toneMapped: false });
    const yel = new THREE.MeshBasicMaterial({ color: 0xffe14d, toneMapped: false });
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.32, 0.1, 2, 0.025), dark);
    pack.add(box);
    for (const x of [-0.07, 0, 0.07]) {
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8), glow);
      cell.position.set(x, 0, -0.055); pack.add(cell);
    }
    for (const x of [-0.09, 0.09]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.26, 6), dark);
      ant.position.set(x, 0.28, 0); pack.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), yel);
      tip.position.set(x, 0.42, 0); pack.add(tip);
    }
    this.attachments.push(this.attachToBone('Spine2', pack, this.f.backLocal));
  }

  gearMats() {
    if (!this.f._gear) {
      this.f._gear = {
        horn: new THREE.MeshStandardMaterial({ color: 0x1a0d22, roughness: 0.4, metalness: 0.3, emissive: 0x4a1080, emissiveIntensity: 0.7 }),
        purple: new THREE.MeshBasicMaterial({ color: 0xb24dff, toneMapped: false }),
        purpleSoft: new THREE.MeshBasicMaterial({ color: 0x7a2cff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
        gold: new THREE.MeshStandardMaterial({ color: 0xffc04a, metalness: 1, roughness: 0.22, emissive: 0x3a1a00 }),
        membrane: new THREE.MeshStandardMaterial({ color: 0x8a0a06, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide, emissive: 0x3a0300, emissiveIntensity: 0.8 }),
        bone: new THREE.MeshStandardMaterial({ color: 0x2a0806, roughness: 0.5, metalness: 0.4 }),
        ice: new THREE.MeshStandardMaterial({ color: 0xcfefff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x2a9cff, emissiveIntensity: 0.55 }),
      };
    }
    return this.f._gear;
  }

  keepGear(holder) { holder.userData.keep = true; this.attachments.push(holder); return holder; }

  addHorns(mat, long) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const base = new THREE.Mesh(new THREE.ConeGeometry(long ? 0.05 : 0.035, long ? 0.18 : 0.2, 10), mat);
      base.position.set(0.085 * s, 0.2, -0.01); base.rotation.set(long ? -0.9 : -0.35, 0, -0.55 * s);
      g.add(base);
      if (long) {
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.2, 10), mat);
        tip.position.set(0.15 * s, 0.25, -0.12); tip.rotation.set(-1.7, 0, -0.35 * s);
        g.add(tip);
      }
    }
    return g;
  }

  addCursedGear() {
    const M = this.gearMats();
    this.keepGear(this.attachToBone('Head', this.addHorns(M.horn, false), this.f.headLocal));
    // three spirits orbiting the body
    const orbit = new THREE.Group(); orbit.position.y = 1.05;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M.purple);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M.purpleSoft);
      core.position.set(Math.cos(a) * 0.55, Math.sin(a * 2) * 0.25, Math.sin(a) * 0.55); halo.position.copy(core.position);
      orbit.add(core, halo);
    }
    this.root.add(orbit);
    this.orbit = orbit;
    this.keepGear(orbit);
  }

  addDragonGear() {
    const M = this.gearMats();
    this.keepGear(this.attachToBone('Head', this.addHorns(M.gold, true), this.f.headLocal));
    // bat-style wings spreading from the shoulder blades
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(0.32, 0.26); shape.lineTo(0.72, 0.34); shape.lineTo(0.95, 0.14);
    shape.quadraticCurveTo(0.76, 0.04, 0.7, -0.16); shape.quadraticCurveTo(0.52, -0.04, 0.42, -0.3);
    shape.quadraticCurveTo(0.26, -0.12, 0.12, -0.3); shape.lineTo(0, 0);
    const memGeo = new THREE.ShapeGeometry(shape);
    const wings = new THREE.Group(); wings.position.set(0, 0.1, -0.16);
    const pivots = [];
    for (const s of [1, -1]) {
      const pivot = new THREE.Group(); pivot.position.x = 0.09 * s;
      const wing = new THREE.Group(); wing.scale.x = s;
      wing.add(new THREE.Mesh(memGeo, M.membrane));
      for (const [x, y, len, rz] of [[0.36, 0.17, 0.42, 0.67], [0.83, 0.24, 0.27, -0.73], [0.45, 0.1, 0.48, -0.1], [0.3, -0.05, 0.38, -0.9]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.022, 0.022), M.bone); b.position.set(x, y, 0.004); b.rotation.z = rz; wing.add(b);
      }
      pivot.add(wing); pivot.rotation.y = 0.55 * s; pivot.userData.side = s;
      wings.add(pivot); pivots.push(pivot);
    }
    wings.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.keepGear(this.attachToBone('Spine2', wings, this.f.chestLocal));
    this.wings = pivots;
  }

  addFrostGear() {
    const M = this.gearMats();
    const crystal = (r, h) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), M.ice);
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      for (const [dx, dy, dz, h, tilt] of [[0.2, 0.2, 0, 0.22, 0.35], [0.26, 0.17, 0.04, 0.15, 0.7], [0.16, 0.19, -0.05, 0.13, 0.15]]) {
        const c = crystal(0.035, h); c.position.set(dx * s, dy + h / 2, dz); c.rotation.z = -tilt * s; g.add(c);
      }
      const back = crystal(0.05, 0.34); back.position.set(0.1 * s, 0.22, -0.17); back.rotation.set(-0.5, 0, -0.25 * s); g.add(back);
    }
    this.keepGear(this.attachToBone('Spine2', g, this.f.chestLocal));
    const crown = new THREE.Group();
    for (let i = -2; i <= 2; i++) { const c = crystal(0.018, 0.08 + (2 - Math.abs(i)) * 0.03); c.position.set(i * 0.04, 0.2, 0.06 - Math.abs(i) * 0.02); crown.add(c); }
    this.keepGear(this.attachToBone('Head', crown, this.f.headLocal));
  }

  addPlatinumGear() {
    // gold collar ring + shoulder sparkle
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc44d, metalness: 1, roughness: 0.15, emissive: 0x3a2400 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 24), gold);
    ring.rotation.x = Math.PI / 2;
    const m = new THREE.Matrix4().makeTranslation(0, 0.18, 0.02);
    const neck = this.bones.Neck;
    this.model.updateMatrixWorld(true);
    const holder = new THREE.Group(); holder.add(ring);
    ring.scale.multiplyScalar(1 / this.f.boneScale);
    // place collar at the base of the neck in bone space
    m.identity();
    m.decompose(holder.position, holder.quaternion, holder.scale);
    neck.add(holder);
    this.attachments.push(holder);
  }

  /** Equip held item. kind: 'gun'|'pickaxe'|'grenade'|null */
  setHeld(kind, id, rarity = 0) {
    const key = `${kind}|${id}|${rarity}`;
    if (this.heldKey === key) return;
    this.heldKey = key;
    if (this.held) { this.held.parent.remove(this.held); this.held = null; }
    this.heldKind = kind; this.heldId = id;
    if (!kind) return;
    let obj, local = this.f.gunLocal;
    if (kind === 'gun') { obj = this.f.gunModel(id, rarity); this.muzzleLocal.copy(obj.userData.muzzle); }
    else if (kind === 'pickaxe') { obj = this.f.pickaxeModel(id); local = this.f.pickLocal; this.muzzleLocal.set(0, 0.7, 0); }
    else if (kind === 'heal') { obj = this.f.medkitModel(); this.muzzleLocal.set(0, 0, 0); obj.position.set(0, -0.04, 0.12); obj.rotation.y = Math.PI / 2; }
    else { obj = this.f.grenadeModel(id); this.muzzleLocal.set(0, 0, 0); obj.position.set(0, 0, 0.05); }
    obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.held = this.attachToBone('RightHand', obj, local);
    this.heldObj = obj;
  }

  /** Show or hide a jetpack on the character's back. */
  setJetpack(on) {
    if (on && !this.jetpackObj) {
      const m = this.f.jetpackModel();
      m.position.set(0, -0.035, -0.02);
      this.jetpackObj = this.attachToBone('Spine2', m, this.f.backLocal);
      this.jetFlames = m.userData.flames;
    } else if (!on && this.jetpackObj) {
      this.jetpackObj.parent && this.jetpackObj.parent.remove(this.jetpackObj);
      this.jetpackObj = null; this.jetFlames = null;
    }
    // the Shock Trooper battery pack would clip through the jetpack (horns, wings, crystals stay)
    for (const a of this.attachments) a.visible = !this.jetpackObj || !!a.userData.keep;
  }

  setGlider(on) {
    if (on && !this.glider) { this.glider = this.f.gliderModel(); this.root.add(this.glider); }
    if (this.glider) this.glider.visible = on;
  }

  muzzleWorld(out) {
    if (this.heldObj) { this.heldObj.updateWorldMatrix(true, false); return out.copy(this.muzzleLocal).applyMatrix4(this.heldObj.matrixWorld); }
    return out.set(this.root.position.x, this.root.position.y + 1.4, this.root.position.z);
  }

  fire() { this.recoil = Math.min(1, this.recoil + 0.6); }
  swing() { this.swingT = 0; }
  throwAnim() { this.throwT = 0; }

  die(seed = Math.random()) {
    if (this.dead) return;
    this.dead = true; this.deathT = 0;
    for (const k in this.weights) this.actions[k].setEffectiveWeight(0);
    const a = this.actions[seed < 0.5 ? 'death1' : 'death2'];
    a.reset(); a.setEffectiveWeight(1); a.play();
    this.body.rotation.x = 0;
    if (this.glider) this.glider.visible = false;
  }

  revive() {
    this.dead = false;
    this.actions.death1.stop(); this.actions.death2.stop();
    this.root.visible = true;
  }

  /**
   * state: {vx, vz (world velocity), yaw, pitch, grounded, crouch, sprint, mode:'ground'|'skydive'|'glide',
   *         reloadFrac (0..1 or -1), camDist (for LOD)}
   */
  update(dt, s) {
    const camDist = s.camDist ?? 0;
    this.lod = camDist > 70 ? 2 : camDist > 30 ? 1 : 0;
    if (this.lod === 2) {
      this.frameSkip = (this.frameSkip + 1) % 3;
      if (this.frameSkip !== 0) { this._accum = (this._accum || 0) + dt; return; }
      dt += this._accum || 0; this._accum = 0;
    }
    this.root.rotation.y = s.yaw;
    if (this.orbit) { this.orbitT = (this.orbitT || 0) + dt; this.orbit.rotation.y = this.orbitT * 1.6; this.orbit.position.y = 1.05 + Math.sin(this.orbitT * 2) * 0.06; }
    if (this.wings) { this.wingT = (this.wingT || 0) + dt * (s.thrusting || s.mode === 'glide' ? 9 : 2.2); for (const w of this.wings) w.rotation.y = w.userData.side * (0.55 + Math.sin(this.wingT) * (s.thrusting ? 0.35 : 0.1)); }
    if (this.jetFlames) for (const fl of this.jetFlames) { fl.visible = !!s.thrusting && !this.dead; if (fl.visible) fl.scale.set(1, 0.75 + Math.random() * 0.5, 1); }
    if (this.dead) {
      this.deathT += dt;
      this.mixer.update(dt);
      return;
    }
    // ----- locomotion weights
    const sy = Math.sin(s.yaw), cy = Math.cos(s.yaw);
    const vf = s.vx * sy + s.vz * cy;          // forward component
    const vr = -(s.vx * cy - s.vz * sy);       // right component (character right = -X at yaw 0)
    const speed = Math.hypot(vf, vr);
    const target = { idle: 0, forward: 0, backward: 0, left: 0, right: 0, run: 0, tpose: 0 };
    const mode = s.mode || 'ground';
    const skyTarget = mode === 'skydive' ? 1 : 0, glideTarget = mode === 'glide' ? 1 : 0;
    this.skydiveAmt += (skyTarget - this.skydiveAmt) * Math.min(1, dt * 6);
    this.glideAmt += (glideTarget - this.glideAmt) * Math.min(1, dt * 6);
    if (mode !== 'ground') {
      target.tpose = 1;
    } else if (speed < 0.4) target.idle = 1;
    else {
      const k = Math.min(1, speed / 2.2);
      target.idle = 1 - k;
      if (s.sprint && vf > speed * 0.7) target.run = k;
      else {
        target.forward = Math.max(0, vf / speed) * k;
        target.backward = Math.max(0, -vf / speed) * k;
        target.right = Math.max(0, vr / speed) * k;
        target.left = Math.max(0, -vr / speed) * k;
      }
    }
    const blend = Math.min(1, dt * 10);
    for (const k in this.weights) {
      this.weights[k] += (target[k] - this.weights[k]) * blend;
      this.actions[k].setEffectiveWeight(this.weights[k]);
    }
    const air = mode === 'ground' && !s.grounded;
    const ts = air ? 0.15 : Math.max(0.6, Math.min(1.9, speed / (s.crouch ? 2.2 : 3.6)));
    this.actions.forward.timeScale = this.actions.backward.timeScale = ts;
    this.actions.left.timeScale = this.actions.right.timeScale = ts;
    this.actions.run.timeScale = air ? 0.15 : Math.max(0.8, speed / 6.2);
    this.mixer.update(dt);

    // ----- body orientation (skydive pitch)
    this.body.rotation.x = this.skydiveAmt * 1.25;
    this.body.position.y = this.skydiveAmt * 0.9;
    if (this.glider) this.glider.visible = this.glideAmt > 0.3;

    if (this.lod >= 2) return;
    // ----- procedural layers
    this.root.updateMatrixWorld(true);
    _right.set(-cy, 0, sy);
    _fwd.set(sy, 0, cy);
    const B = this.bones;
    // crouch
    const crouchT = s.crouch && mode === 'ground' ? 1 : 0;
    this.crouchAmt += (crouchT - this.crouchAmt) * Math.min(1, dt * 12);
    const c = this.crouchAmt;
    this.model.position.y = -0.36 * c;
    if (c > 0.01) {
      const a = 0.95 * c;
      rotateBoneWorld(B.LeftUpLeg, _right, a); rotateBoneWorld(B.RightUpLeg, _right, a);
      rotateBoneWorld(B.LeftLeg, _right, -a * 1.9); rotateBoneWorld(B.RightLeg, _right, -a * 1.9);
      rotateBoneWorld(B.LeftFoot, _right, a * 0.9); rotateBoneWorld(B.RightFoot, _right, a * 0.9);
      rotateBoneWorld(B.Spine, _right, -0.18 * c);
    }
    if (mode === 'glide' || this.glideAmt > 0.05) {
      const g = this.glideAmt;
      rotateBoneWorld(B.RightArm, _fwd, -1.15 * g); rotateBoneWorld(B.LeftArm, _fwd, 1.15 * g);
      rotateBoneWorld(B.RightUpLeg, _right, 0.3 * g); rotateBoneWorld(B.LeftUpLeg, _right, 0.15 * g);
      rotateBoneWorld(B.RightLeg, _right, -0.5 * g);
    }
    if (mode === 'skydive') {
      rotateBoneWorld(B.RightArm, _fwd, 0.35); rotateBoneWorld(B.LeftArm, _fwd, -0.35);
      rotateBoneWorld(B.LeftLeg, _right, -0.6); rotateBoneWorld(B.RightLeg, _right, -0.4);
      return;
    }
    if (mode !== 'ground') return;
    // aim pitch distributed over the spine
    this.pitchSmooth += ((s.pitch || 0) - this.pitchSmooth) * Math.min(1, dt * 18);
    let p = this.pitchSmooth;
    // recoil kick
    this.recoil = Math.max(0, this.recoil - dt * 6);
    p += this.recoil * 0.08;
    // reload dip
    if (s.reloadFrac >= 0) p -= Math.sin(Math.min(1, s.reloadFrac) * Math.PI) * 0.45;
    rotateBoneWorld(B.Spine, _right, p * 0.3);
    rotateBoneWorld(B.Spine1, _right, p * 0.3);
    rotateBoneWorld(B.Spine2, _right, p * 0.4);
    if (s.reloadFrac >= 0) {
      const k = Math.sin(Math.min(1, s.reloadFrac) * Math.PI);
      rotateBoneWorld(B.LeftArm, _right, -0.6 * k);
      rotateBoneWorld(B.RightHand, _fwd, 0.5 * k);
    }
    // pickaxe swing
    if (this.swingT >= 0) {
      this.swingT += dt;
      const t = this.swingT / 0.42;
      if (t >= 1) this.swingT = -1;
      else {
        const wind = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
        const ang = t < 0.35 ? wind * 1.6 : 1.6 - (t - 0.35) / 0.65 * 2.6;
        rotateBoneWorld(B.RightArm, _right, ang);
        rotateBoneWorld(B.Spine2, _up, (t < 0.35 ? -0.4 * wind : 0.3 * (1 - wind)));
      }
    }
    // grenade throw
    if (this.throwT >= 0) {
      this.throwT += dt;
      const t = this.throwT / 0.45;
      if (t >= 1) this.throwT = -1;
      else {
        const ang = t < 0.4 ? (t / 0.4) * 2.2 : 2.2 - ((t - 0.4) / 0.6) * 3.2;
        rotateBoneWorld(B.RightArm, _right, ang);
      }
    }
  }

  dispose() {
    this.root.parent && this.root.parent.remove(this.root);
    this.mixer.stopAllAction();
  }
}
