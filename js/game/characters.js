// Characters: skinned soldier model, 3 skins, pickaxes, weapon models, animation blending
// and procedural poses (aim pitch, crouch, recoil, reload, skydive, glide, swing, throw).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RARITIES } from '../data/items.js';
import { makeJetpack } from './jetpack.js';
import { makeGlider } from './gliders.js';
import { buildFemaleGeometries } from './femaleBody.js';
import { poseEmote } from './emotes.js';
import { SKINS } from '../data/cosmetics.js';

const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();
const _right = new THREE.Vector3(), _fwd = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _bUp = new THREE.Vector3(), _bFwd = new THREE.Vector3(), _bX = new THREE.Vector3(), _bBasis = new THREE.Matrix4();

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
// Palette skins (the female line): base/mid/dark armour, accent (the texture's red straps), glow seams, hair.
const v3 = (c) => { const k = new THREE.Color(c); return `vec3(${k.r.toFixed(4)}, ${k.g.toFixed(4)}, ${k.b.toFixed(4)})`; };
export const PALETTE_LOOKS = {
  nova:      { light: 0xf4f6fb, mid: 0xb9c2d4, dark: 0x1a1d26, accent: 0xff3d97, glow: 0x4fe8ff, glowI: 0.55, accentI: 0.8, rough: 0.32, metal: 0.25, env: 0.8, visor: 0x05121a, visorGlow: 0x5ff4ff, visorI: 2.2, hair: 0xff4fa8, hairTip: 0xffb3dc, hairStyle: 'ponytail' },
  viper:     { light: 0x2b3230, mid: 0x111514, dark: 0x050606, accent: 0x39ff7a, glow: 0x39ff7a, glowI: 0.75, accentI: 1.2, rough: 0.2, metal: 0.55, env: 1.0, visor: 0x021006, visorGlow: 0x39ff7a, visorI: 2.4, hair: 0x101214, hairTip: 0x39ff7a, hairStyle: 'ponytail' },
  valkyrie:  { light: 0xc0262f, mid: 0x6a0c12, dark: 0x1c0306, accent: 0xffc24a, glow: 0xfff0c8, glowI: 0.3, accentI: 0.35, rough: 0.28, metal: 0.6, env: 1.0, visor: 0x1a0c00, visorGlow: 0xffd45a, visorI: 1.8, hair: 0xf0c75a, hairTip: 0xfff0b0, hairStyle: 'braid', goldMetal: true },
  arcticfox: { light: 0xf2f5f8, mid: 0x9aa6b4, dark: 0x2a313b, accent: 0xff7a1c, glow: 0xffa040, glowI: 0.25, accentI: 0.7, rough: 0.55, metal: 0.1, env: 0.5, visor: 0x1a0a00, visorGlow: 0xff8a2a, visorI: 2.0, hair: 0xb5501e, hairTip: 0xe08a4a, hairStyle: 'bun', camo: true },
  void:      { light: 0x2a2140, mid: 0x0d0a18, dark: 0x020104, accent: 0x9b4dff, glow: 0xb06bff, glowI: 0.9, accentI: 1.1, rough: 0.25, metal: 0.5, env: 0.7, visor: 0x05000c, visorGlow: 0xa040ff, visorI: 1.2, stars: true },
  emerald:   { light: 0x2fe08a, mid: 0x07804a, dark: 0x02261a, accent: 0xffc84a, glow: 0x7dffc2, glowI: 0.35, accentI: 0.3, rough: 0.12, metal: 0.55, env: 1.4, visor: 0x011a0e, visorGlow: 0x20e070, visorI: 1.1, goldMetal: true, facets: true },
  king:      { light: 0xffd36b, mid: 0xb07a18, dark: 0x2a1404, accent: 0xc0122a, glow: 0xffe9a8, glowI: 0.25, accentI: 0.55, rough: 0.2, metal: 0.95, env: 1.3, visor: 0x1a0a00, visorGlow: 0xffb020, visorI: 1.0 },
  beast:     { light: 0xff9a1c, mid: 0xd25a08, dark: 0x1a0a02, accent: 0x1a0a02, glow: 0xffb040, glowI: 0.2, accentI: 0.0, rough: 0.7, metal: 0.05, env: 0.4, visor: 0x200800, visorGlow: 0xff6a00, visorI: 1.3, stripes: true },
  rose:      { light: 0x6b3fa8, mid: 0x2e1650, dark: 0x0d0618, accent: 0xf2a68a, glow: 0xff5cc8, glowI: 0.6, accentI: 0.5, rough: 0.3, metal: 0.45, env: 0.9, visor: 0x12041a, visorGlow: 0xff5cc8, visorI: 2.2, hair: 0x2a1240, hairTip: 0xc25cff, hairStyle: 'ponytail', goldMetal: true },
};

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
    // Head and chest gear frames come from the rest pose, so crowns, horns and shoulder pieces sit square on
    // the body part they belong to in every pose (the rifle idle twists the torso by ~50 degrees).
    const rest = SkeletonUtils.clone(this.template); rest.updateMatrixWorld(true);
    const rHead = this.findBone(rest, 'Head'), rChest = this.findBone(rest, 'Spine2');
    const headPos = new THREE.Vector3().setFromMatrixPosition(rHead.matrixWorld);
    this.headLocal = rHead.matrixWorld.clone().invert().multiply(new THREE.Matrix4().makeTranslation(headPos.x, headPos.y, headPos.z));
    const chestPos = new THREE.Vector3().setFromMatrixPosition(rChest.matrixWorld);
    this.chestLocal = rChest.matrixWorld.clone().invert().multiply(new THREE.Matrix4().makeTranslation(chestPos.x, chestPos.y, chestPos.z));
    // Back gear (jetpack, battery pack) rides on a mount that faces where the character faces, because the
    // rifle stance blades the whole torso ~55 degrees and a pack glued to it would hang off one side.
    // How far behind the spine the back surface is depends on that twist: measure it straight and bladed.
    const backDepth = (root) => {
      root.updateMatrixWorld(true);
      const sp = this.findBone(root, 'Spine2');
      const p = new THREE.Vector3().setFromMatrixPosition(sp.matrixWorld);
      let minZ = Infinity; const v = new THREE.Vector3();
      root.traverse(o => {
        if (!o.isSkinnedMesh) return;
        const P = o.geometry.attributes.position;
        for (let i = 0; i < P.count; i++) {
          o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld);
          if (Math.abs(v.y - p.y) < 0.06 && Math.abs(v.x - p.x) < 0.06 && v.z < minZ) minZ = v.z;
        }
      });
      const f = new THREE.Vector3(0, 0, 1).transformDirection(sp.matrixWorld); f.y = 0; f.normalize();
      return { d: isFinite(minZ) ? p.z - minZ : 0.19, twist: Math.abs(Math.atan2(f.x, f.z)) };
    };
    const straight = backDepth(SkeletonUtils.clone(this.template));
    const bladed = backDepth(inst);
    // model the torso as an ellipse: depth(twist) = sqrt(w^2 sin^2 + d0^2 cos^2)
    this.backD0 = straight.d;
    const s2 = Math.sin(bladed.twist) ** 2;
    this.backW2 = s2 > 0.05 ? Math.max(straight.d ** 2, (bladed.d ** 2 - straight.d ** 2 * (1 - s2)) / s2) : straight.d ** 2;
    // legacy frame (bone-relative), kept for anything that still wants to follow the torso exactly
    const backWorld = new THREE.Matrix4().makeTranslation(chestPos.x, chestPos.y + 0.02, chestPos.z - straight.d);
    this.backLocal = spine2.matrixWorld.clone().invert().multiply(backWorld);
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
    } else if (PALETTE_LOOKS[skinId]) {
      const L = PALETTE_LOOKS[skinId];
      mat = new THREE.MeshStandardMaterial({ map: baseMat.map, normalMap: baseMat.normalMap || null, roughness: L.rough, metalness: L.metal, envMapIntensity: L.env });
      if (isVisor) { mat.map = null; mat.color.set(L.visor); mat.emissive.set(L.visorGlow); mat.emissiveIntensity = L.visorI; mat.roughness = 0.12; }
      else this.patchShader(mat, 'pal:' + skinId);
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
      if (kind.startsWith('pal:')) {
        const L = PALETTE_LOOKS[kind.slice(4)];
        const camo = L.camo ? `float camo = smoothstep(0.52, 0.58, oc_noise(vMapUv * 26.0)) * 0.55 + smoothstep(0.6, 0.66, oc_noise(vMapUv * 61.0 + 3.0)) * 0.3; pal = mix(pal, ${v3(L.mid)}, camo);` : '';
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', common + `
          vec3 pal = mix(${v3(L.mid)}, ${v3(L.light)}, smoothstep(0.18, 0.78, lum));
          ${camo}
          ${L.stars ? `float neb = smoothstep(0.5, 0.85, oc_noise(vMapUv * 7.0 + vec2(uTime * 0.04, uTime * 0.02))); pal = mix(pal, vec3(0.16, 0.05, 0.3), neb * 0.7);` : ''}
          ${L.stripes ? `float oc_band = sin(vMapUv.y * 95.0 + oc_noise(vMapUv * 13.0) * 7.0 + vMapUv.x * 20.0); float stripe = smoothstep(0.45, 0.8, oc_band) * smoothstep(0.3, 0.55, oc_noise(vMapUv * 8.0 + 5.0)); pal = mix(pal, ${v3(L.dark)}, stripe * 0.92);` : ''}
          ${L.facets ? `pal *= 0.75 + 0.5 * oc_noise(floor(vMapUv * 60.0) + 0.5);` : ''}
          pal = mix(pal, ${v3(L.dark)}, darkness);
          float oc_acc = max(redness, edge * 0.35 * (1.0 - darkness));
          diffuseColor.rgb = mix(pal, ${v3(L.accent)}, oc_acc);
        `);
        if (L.goldMetal) sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', `
          #include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, 1.0, oc_acc);
        `);
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          float oc_p = 0.75 + 0.25 * sin(uTime * 2.6 + vMapUv.y * 18.0);
          totalEmissiveRadiance += ${v3(L.glow)} * edge * (1.0 - darkness) * ${L.glowI.toFixed(3)} * oc_p;
          totalEmissiveRadiance += ${v3(L.accent)} * redness * ${L.accentI.toFixed(3)} * 0.6;
          ${L.stars ? `vec2 oc_cell = floor(vMapUv * 240.0); float oc_star = step(0.988, oc_hash(oc_cell)); totalEmissiveRadiance += vec3(0.85, 0.75, 1.0) * oc_star * (0.55 + 0.45 * sin(uTime * 3.0 + oc_hash(oc_cell + 7.0) * 40.0)) * 1.6;` : ''}
          ${L.facets ? `vec2 oc_gc = floor(vMapUv * 300.0); float oc_glint = step(0.994, oc_hash(oc_gc + floor(uTime * 1.5))); totalEmissiveRadiance += vec3(0.7, 1.0, 0.85) * oc_glint * 1.8;` : ''}
        `);
      } else if (kind === 'shock') {
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

  gliderModel(id = 'volt') { return makeGlider(id, this); }

  /** The female-body geometry matching one of the character's skinned meshes (built once). */
  femaleGeometry(mesh) {
    if (!this._female) this._female = buildFemaleGeometries(this.template);
    return this._female[mesh.name] || mesh.userData.baseGeo || mesh.geometry;
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
    // procedural layers rotate these bones on top of the animation. three.js only rewrites a bone when its
    // animated value changes, so with a static pose (skydive/glide T-pose) the extra rotations would pile up
    // frame after frame. We restore the animated pose before every mixer update instead.
    this.poseBones = Object.values(this.bones).filter(Boolean);
    this.poseBase = this.poseBones.map(b => b.quaternion.clone());
    this.actions = {};
    for (const k of ['idle', 'forward', 'backward', 'left', 'right', 'run', 'tpose']) {
      const a = this.mixer.clipAction(factory.clips[k]);
      a.play(); a.setEffectiveWeight(k === 'idle' ? 1 : 0);
      this.actions[k] = a;
    }
    // the T-pose clip is a single-frame loop: let it drift and the arms flail while skydiving/gliding
    this.actions.tpose.timeScale = 0; this.actions.tpose.time = 0;
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
    this.gliderId = 'volt';
  }

  setSkin(id) {
    this.skin = id;
    const female = (SKINS.find(s => s.id === id) || {}).body === 'female';
    this.female = female;
    for (const m of this.meshes) {
      const base = this.f.baseMats[m.userData.baseName || m.material.name] || m.material;
      m.userData.baseName = m.userData.baseName || m.material.name;
      m.material = this.f.skinMaterial(id, this.f.baseMats[m.userData.baseName] || base);
      m.userData.baseGeo = m.userData.baseGeo || m.geometry;
      m.geometry = female ? this.f.femaleGeometry(m) : m.userData.baseGeo;
    }
    this.hair = null;
    for (const a of this.attachments) a.parent && a.parent.remove(a);
    this.attachments = [];
    this.orbit = null; this.wings = null;
    if (id === 'shock') this.addShockGear();
    if (id === 'platinum') this.addPlatinumGear();
    if (id === 'cursed') this.addCursedGear();
    if (id === 'dragon') this.addDragonGear();
    if (id === 'frost') this.addFrostGear();
    if (PALETTE_LOOKS[id] && PALETTE_LOOKS[id].hairStyle) this.addHair(PALETTE_LOOKS[id], id);
    if (id === 'void') this.addVoidGear();
    if (id === 'emerald') this.addEmeraldGear();
    if (id === 'king') this.addKingGear();
    if (id === 'beast') this.addBeastGear();
    for (const a of this.attachments) a.visible = !this.jetpackObj || !!a.userData.keep;
  }

  /** Hair out of the back of the helmet: ponytail, braid or bun. Segments chain so they can swing. */
  addHair(L, id) {
    const F = this.f;
    if (!F._hairGeo) F._hairGeo = {
      seg: new THREE.CylinderGeometry(1, 0.82, 1, 10, 1, true), ball: new THREE.SphereGeometry(1, 12, 10), tie: new THREE.TorusGeometry(0.034, 0.011, 6, 14),
    };
    F._hairMats = F._hairMats || {};
    const mk = (c) => F._hairMats[c] || (F._hairMats[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05 }));
    const G = F._hairGeo, root = new THREE.Group();
    const tieMat = mk(L.accent);
    const hair = new THREE.Group(); hair.position.set(0, 0.13, -0.118); root.add(hair);
    const segs = [];
    if (L.hairStyle === 'bun') {
      const bun = new THREE.Mesh(G.ball, mk(L.hair)); bun.scale.set(0.075, 0.068, 0.07); bun.position.set(0, 0.03, -0.03); hair.add(bun);
      const tie = new THREE.Mesh(G.tie, tieMat); tie.rotation.x = 0.3; tie.position.set(0, 0.0, 0.0); hair.add(tie);
      const tail = new THREE.Group(); tail.rotation.x = 0.5; hair.add(tail); segs.push(tail);
      const t = new THREE.Mesh(G.seg, mk(L.hairTip)); t.scale.set(0.028, 0.12, 0.028); t.position.y = -0.07; tail.add(t);
    } else {
      const n = L.hairStyle === 'braid' ? 5 : 4, len = L.hairStyle === 'braid' ? 0.095 : 0.115;
      const tie = new THREE.Mesh(G.tie, tieMat); tie.rotation.x = 1.2; tie.scale.setScalar(1.35); hair.add(tie);
      const cA = new THREE.Color(L.hair), cB = new THREE.Color(L.hairTip);
      let parent = hair;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1), r = (L.hairStyle === 'braid' ? 0.042 : 0.058) * (1 - k * 0.55);
        const joint = new THREE.Group(); joint.rotation.x = i === 0 ? 0.55 : -0.13;
        if (i > 0) joint.position.y = -len;
        parent.add(joint); segs.push(joint);
        const col = '#' + cA.clone().lerp(cB, Math.pow(k, 1.5)).getHexString();
        const m = new THREE.Mesh(G.seg, mk(col)); m.scale.set(r, len, r); m.position.y = -len / 2; joint.add(m);
        const b = new THREE.Mesh(G.ball, mk(col)); b.scale.setScalar(L.hairStyle === 'braid' ? r * 1.25 : r); joint.add(b);
        parent = joint;
      }
      const end = new THREE.Mesh(G.ball, mk(L.hairTip)); end.scale.set(0.014, 0.03, 0.014); end.position.y = -len - 0.01; parent.add(end);
      if (L.hairStyle === 'braid') { const t2 = new THREE.Mesh(G.tie, tieMat); t2.scale.setScalar(0.5); t2.rotation.x = Math.PI / 2; t2.position.y = -len; parent.add(t2); }
    }
    // valkyrie: little gold wings on the helmet
    if (id === 'valkyrie') {
      const M = this.gearMats();
      const ws = new THREE.Shape(); ws.moveTo(0, 0); ws.quadraticCurveTo(0.05, 0.1, 0.02, 0.17); ws.quadraticCurveTo(-0.03, 0.12, -0.07, 0.15); ws.quadraticCurveTo(-0.05, 0.06, 0, 0);
      const wg = new THREE.ShapeGeometry(ws);
      for (const s of [-1, 1]) { const w = new THREE.Mesh(wg, M.gold); w.material.side = THREE.DoubleSide; w.position.set(s * 0.115, 0.13, -0.02); w.rotation.set(0, s * Math.PI / 2, s * -0.35); root.add(w); }
    }
    root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.keepGear(this.attachToBone('Head', root, this.f.headLocal));
    this.hair = { segs, t: Math.random() * 10 };
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
    pack.position.z = -0.045;
    this.getBackMount().add(pack);
    this.updateBackMount();
    this.attachments.push(pack);
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
    // ride the facing-aligned back mount (like the jetpack): glued to Spine2 the wings swung sideways
    // whenever the walk/run animations twisted the torso differently from the idle pose
    wings.position.set(0, 0.06, 0.02);
    wings.userData.keep = true;
    this.getBackMount().add(wings);
    this.updateBackMount();
    this.attachments.push(wings);
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

  /** Void: a dark halo behind the head and void shards drifting round the body. */
  addVoidGear() {
    const F = this.f;
    F._voidMats = F._voidMats || {
      core: new THREE.MeshStandardMaterial({ color: 0x050208, roughness: 0.2, metalness: 0.7, emissive: 0x2a0a50, emissiveIntensity: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xb06bff, toneMapped: false }),
      soft: new THREE.MeshBasicMaterial({ color: 0x7a2cff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    };
    const M = F._voidMats;
    const halo = new THREE.Group();
    halo.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 36), M.core));
    halo.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.004, 4, 36), M.glow));
    const haloGlow = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 36), M.soft); halo.add(haloGlow);
    halo.position.set(0, 0.13, -0.17);
    this.keepGear(this.attachToBone('Head', halo, this.f.headLocal));
    const orbit = new THREE.Group(); orbit.position.y = 1.05;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), M.core); shard.scale.y = 1.8;
      const glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), M.soft); glow.scale.y = 1.8;
      shard.position.set(Math.cos(a) * 0.58, Math.sin(a * 2) * 0.28, Math.sin(a) * 0.58); glow.position.copy(shard.position);
      shard.rotation.set(0.4 * i, i, 0.3); glow.rotation.copy(shard.rotation);
      orbit.add(shard, glow);
    }
    this.root.add(orbit);
    this.orbit = orbit;
    this.keepGear(orbit);
  }

  /** Emerald: green crystal clusters on the shoulders and a crystal crown. */
  addEmeraldGear() {
    const F = this.f;
    F._emeraldMat = F._emeraldMat || new THREE.MeshStandardMaterial({ color: 0x1fe08a, roughness: 0.05, metalness: 0.15, envMapIntensity: 1.6, emissive: 0x0a7a40, emissiveIntensity: 0.6, flatShading: true });
    const gold = this.gearMats().gold;
    const gem = (r, h) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), F._emeraldMat);
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      for (const [dx, dy, dz, h, tilt] of [[0.2, 0.2, 0, 0.2, 0.3], [0.25, 0.18, 0.04, 0.14, 0.65], [0.16, 0.19, -0.05, 0.12, 0.1]]) {
        const c = gem(0.034, h); c.position.set(dx * s, dy + h / 2, dz); c.rotation.z = -tilt * s; g.add(c);
      }
      const set = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.025, 8), gold); set.position.set(0.2 * s, 0.2, 0); set.rotation.z = -0.3 * s; g.add(set);
    }
    this.keepGear(this.attachToBone('Spine2', g, this.f.chestLocal));
    const crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 6, 24), gold); band.rotation.x = Math.PI / 2; band.position.set(0, 0.17, -0.01); crown.add(band);
    for (let i = -2; i <= 2; i++) { const c = gem(0.02, 0.07 + (2 - Math.abs(i)) * 0.03); c.position.set(i * 0.045, 0.2, 0.07 - Math.abs(i) * 0.025); crown.add(c); }
    this.keepGear(this.attachToBone('Head', crown, this.f.headLocal));
  }

  /** King: jewelled gold crown, ermine collar and gold pauldrons. */
  addKingGear() {
    const F = this.f;
    F._kingMats = F._kingMats || {
      gold: new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.18, emissive: 0x3a2000, envMapIntensity: 1.4 }),
      ruby: new THREE.MeshStandardMaterial({ color: 0xe01030, roughness: 0.05, metalness: 0.2, emissive: 0x600010, emissiveIntensity: 0.8 }),
      sapphire: new THREE.MeshStandardMaterial({ color: 0x2a5cff, roughness: 0.05, metalness: 0.2, emissive: 0x0a1a70, emissiveIntensity: 0.8 }),
      fur: new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.95, metalness: 0 }),
      spot: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0 }),
    };
    const M = F._kingMats;
    const crown = new THREE.Group(); crown.position.set(0, 0.165, -0.005);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.098, 0.05, 24, 1, true), M.gold); crown.add(band);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const pt = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 6), M.gold); pt.position.set(Math.sin(a) * 0.1, 0.055, Math.cos(a) * 0.1); crown.add(pt);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), M.gold); ball.position.set(Math.sin(a) * 0.1, 0.095, Math.cos(a) * 0.1); crown.add(ball);
      const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), i % 2 ? M.sapphire : M.ruby); jewel.position.set(Math.sin(a) * 0.106, 0.0, Math.cos(a) * 0.106); crown.add(jewel);
    }
    const big = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), M.ruby); big.position.set(0, 0.01, 0.112); crown.add(big);
    this.keepGear(this.attachToBone('Head', crown, this.f.headLocal));
    // ermine collar and gold pauldrons round the shoulders
    const g = new THREE.Group();
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 8, 26), M.fur); collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.15, -0.01); collar.scale.set(1.15, 1, 1); g.add(collar);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), M.spot); sp.scale.set(0.6, 1.4, 0.6);
      sp.position.set(Math.sin(a) * 0.15 * 1.15 * 1.18, 0.16, Math.cos(a) * 0.15 * 1.18 - 0.01); g.add(sp);
    }
    for (const s of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.gold); pad.position.set(0.2 * s, 0.12, -0.01); pad.rotation.z = -0.45 * s; pad.scale.set(1, 0.7, 1.05); g.add(pad);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.02, 0), M.ruby); gem.position.set(0.23 * s, 0.16, 0.07); g.add(gem);
    }
    this.keepGear(this.attachToBone('Spine2', g, this.f.chestLocal));
  }

  /** Orange Beast: curled horns, a spiked back ridge and claw-like shoulder spikes. */
  addBeastGear() {
    const F = this.f;
    F._beastMats = F._beastMats || {
      horn: new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.45, metalness: 0.1, emissive: 0x3a1000, emissiveIntensity: 0.4 }),
      spike: new THREE.MeshStandardMaterial({ color: 0xf2e6cc, roughness: 0.4, metalness: 0.05 }),
    };
    const M = F._beastMats;
    this.keepGear(this.attachToBone('Head', this.addHorns(M.horn, true), this.f.headLocal));
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const h = 0.12 - i * 0.012;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, h, 6), M.spike); sp.position.set(0, 0.2 - i * 0.085, -0.17); sp.rotation.x = -1.15; g.add(sp);
    }
    for (const s of [-1, 1]) for (const [dx, dy, dz, h] of [[0.21, 0.21, 0.02, 0.13], [0.25, 0.18, -0.04, 0.1]]) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.025, h, 6), M.spike); sp.position.set(dx * s, dy + h / 2, dz); sp.rotation.z = -0.55 * s; g.add(sp);
    }
    this.keepGear(this.attachToBone('Spine2', g, this.f.chestLocal));
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
      m.position.set(0, -0.035, 0.008);
      this.getBackMount().add(m);
      this.updateBackMount();
      this.jetpackObj = m;
      this.jetFlames = m.userData.flames;
    } else if (!on && this.jetpackObj) {
      this.jetpackObj.parent && this.jetpackObj.parent.remove(this.jetpackObj);
      this.jetpackObj = null; this.jetFlames = null;
    }
    // the Shock Trooper battery pack would clip through the jetpack (horns, wings, crystals stay)
    for (const a of this.attachments) a.visible = !this.jetpackObj || !!a.userData.keep;
  }

  setGlider(on) {
    const id = this.gliderId || 'volt';
    if (on && (!this.glider || this.glider.userData.id !== id)) {
      if (this.glider) this.root.remove(this.glider);
      this.glider = this.f.gliderModel(id); this.root.add(this.glider);
    }
    if (this.glider) this.glider.visible = on;
  }

  muzzleWorld(out) {
    if (this.heldObj) { this.heldObj.updateWorldMatrix(true, false); return out.copy(this.muzzleLocal).applyMatrix4(this.heldObj.matrixWorld); }
    return out.set(this.root.position.x, this.root.position.y + 1.4, this.root.position.z);
  }

  /** Start / stop an emote (a dance laid over the T-pose). */
  playEmote(id) { this.emote = { id, t: 0, k: 0 }; this.setHeld(null); }
  stopEmote() { this.emote = null; this.model.position.x = 0; }

  fire() { this.recoil = Math.min(1, this.recoil + 0.6); }
  swing() { this.swingT = 0; }
  throwAnim() { this.throwT = 0; }

  die(seed = Math.random()) {
    if (this.dead) return;
    this.emote = null; this.model.position.x = 0;
    this.dead = true; this.deathT = 0;
    for (const k in this.weights) this.actions[k].setEffectiveWeight(0);
    const a = this.actions[seed < 0.5 ? 'death1' : 'death2'];
    a.reset(); a.setEffectiveWeight(1); a.play();
    this.body.rotation.x = 0;
    if (this.glider) this.glider.visible = false;
  }

  revive() {
    this.dead = false; this.emote = null; this.model.position.x = 0;
    this.actions.death1.stop(); this.actions.death2.stop();
    this.root.visible = true;
  }

  /**
   * state: {vx, vz (world velocity), yaw, pitch, grounded, crouch, sprint, mode:'ground'|'skydive'|'glide',
   *         reloadFrac (0..1 or -1), camDist (for LOD)}
   */
  update(dt, s) {
    this.updatePose(dt, s);
    if (this.backMount) this.updateBackMount();
  }

  /** A mount on the middle of the back that faces where the character faces, leaning with the spine. */
  getBackMount() {
    if (!this.backMount) { this.backMount = new THREE.Group(); this.body.add(this.backMount); }
    return this.backMount;
  }

  updateBackMount() {
    const sp = this.bones.Spine2;
    sp.updateWorldMatrix(true, false);
    _m.copy(this.body.matrixWorld).invert().multiply(sp.matrixWorld);        // spine in body space
    _v.setFromMatrixPosition(_m);
    _bUp.set(0, 1, 0).transformDirection(_m);                               // along the spine
    _bFwd.set(0, 0, 1).addScaledVector(_bUp, -_bUp.z);                       // facing, leaned with the spine
    if (_bFwd.lengthSq() < 1e-4) _bFwd.set(0, 0, 1).transformDirection(_m); else _bFwd.normalize();
    _bX.crossVectors(_bUp, _bFwd).normalize();
    _bFwd.crossVectors(_bX, _bUp);
    _bBasis.makeBasis(_bX, _bUp, _bFwd);
    this.backMount.quaternion.setFromRotationMatrix(_bBasis);
    // how bladed is the torso right now? (spine forward vs facing, around the spine)
    _v2.set(0, 0, 1).transformDirection(_m);
    const tw = Math.atan2(_v2.dot(_bX), _v2.dot(_bFwd));
    const sn = Math.sin(tw), cs = Math.cos(tw);
    const depth = Math.sqrt(this.f.backW2 * sn * sn + this.f.backD0 * this.f.backD0 * cs * cs);
    this.backMount.position.copy(_v).addScaledVector(_bFwd, -depth).addScaledVector(_bUp, 0.02);
  }

  /** Animation step with the procedural offsets of the previous frame undone first. */
  mixerStep(dt) {
    const B = this.poseBones, Q = this.poseBase;
    for (let i = 0; i < B.length; i++) B[i].quaternion.copy(Q[i]);
    this.mixer.update(dt);
    for (let i = 0; i < B.length; i++) Q[i].copy(B[i].quaternion);
  }

  updatePose(dt, s) {
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
    if (this.hair) {
      const H = this.hair; H.t += dt;
      const sy0 = Math.sin(s.yaw), cy0 = Math.cos(s.yaw);
      const fwd = (s.vx || 0) * sy0 + (s.vz || 0) * cy0, side = -((s.vx || 0) * cy0 - (s.vz || 0) * sy0);
      const air = s.mode === 'skydive' || s.mode === 'glide';
      H.swing = (H.swing || 0) + ((Math.max(-0.5, Math.min(0.5, side * 0.06))) - (H.swing || 0)) * Math.min(1, dt * 4);
      H.lift = (H.lift || 0) + ((air ? 0.9 : Math.min(0.6, Math.abs(fwd) * 0.07)) - (H.lift || 0)) * Math.min(1, dt * 3);
      H.segs.forEach((j, i) => {
        const base = i === 0 ? 0.55 : -0.13;
        j.rotation.x = base + (i === 0 ? H.lift : H.lift * 0.15) + Math.sin(H.t * 3.1 - i * 0.7) * 0.05 * (1 + H.lift);
        j.rotation.z = H.swing * (i === 0 ? 1 : 0.4) + Math.sin(H.t * 2.3 - i * 0.6) * 0.06;
      });
    }
    if (this.jetpackObj && this.jetpackObj.userData.spin) {
      const near = (s.camDist ?? 0) < 26;
      if (this.jetNear !== near) { this.jetNear = near; this.jetpackObj.userData.setDetail(near); }
      if (near) this.jetpackObj.userData.spin(dt, !!s.thrusting && !this.dead);
      if (s.fuel !== undefined) this.jetpackObj.userData.setFuel(s.fuel);
    }
    if (this.jetFlames) for (const fl of this.jetFlames) { fl.visible = !!s.thrusting && !this.dead; if (fl.visible) fl.scale.set(1, 0.75 + Math.random() * 0.5, 1); }
    if (this.dead) {
      this.deathT += dt;
      this.mixerStep(dt);
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
    if (mode !== 'ground' || this.emote) {
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
    this.mixerStep(dt);

    // ----- body orientation (skydive pitch)
    this.body.rotation.x = this.skydiveAmt * 1.25;
    this.body.position.y = this.skydiveAmt * 0.9;
    if (this.glider) {
      this.glider.visible = this.glideAmt > 0.3;
      if (this.glider.visible && this.glider.userData.anim) { this.glideT = (this.glideT || 0) + dt; this.glider.userData.anim(this.glideT, dt); }
    }

    if (this.lod >= 2) return;
    // ----- procedural layers
    this.root.updateMatrixWorld(true);
    _right.set(-cy, 0, sy);
    _fwd.set(sy, 0, cy);
    const B = this.bones;
    this.model.position.x = 0;
    if (this.emote && mode === 'ground') {
      this.emote.t += dt;
      this.emote.k = Math.min(1, this.emote.k + dt * 6);
      this.model.position.y = 0;
      poseEmote(this.emote.id, this.emote.t, B, { R: _right, F: _fwd, U: _up }, rotateBoneWorld, this.model, this.emote.k);
      return;
    }
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
      const g = this.glideAmt, pose = (this.glider && this.glider.userData.pose) || 'hang';
      if (pose === 'ride') {
        // surf stance: knees bent, arms out for balance, slight lean into the turn
        const lean = Math.max(-0.35, Math.min(0.35, ((s.vx || 0) * cy - (s.vz || 0) * sy) * -0.03));
        this.model.position.y = -0.26 * g;
        rotateBoneWorld(B.LeftUpLeg, _right, 0.62 * g); rotateBoneWorld(B.RightUpLeg, _right, 0.5 * g);
        rotateBoneWorld(B.LeftLeg, _right, -1.15 * g); rotateBoneWorld(B.RightLeg, _right, -0.95 * g);
        rotateBoneWorld(B.LeftFoot, _right, 0.5 * g); rotateBoneWorld(B.RightFoot, _right, 0.45 * g);
        rotateBoneWorld(B.Spine, _right, 0.22 * g); rotateBoneWorld(B.Spine1, _fwd, lean * g);
        rotateBoneWorld(B.RightArm, _fwd, 0.28 * g); rotateBoneWorld(B.LeftArm, _fwd, -0.18 * g);
        rotateBoneWorld(B.RightForeArm, _fwd, -0.25 * g); rotateBoneWorld(B.LeftForeArm, _fwd, 0.3 * g);
      } else if (pose === 'float') {
        // hovering in a tractor beam: arms loosely out, legs dangling
        rotateBoneWorld(B.RightArm, _fwd, 0.42 * g); rotateBoneWorld(B.LeftArm, _fwd, -0.42 * g);
        rotateBoneWorld(B.RightForeArm, _fwd, -0.3 * g); rotateBoneWorld(B.LeftForeArm, _fwd, 0.3 * g);
        rotateBoneWorld(B.RightUpLeg, _right, 0.25 * g); rotateBoneWorld(B.RightLeg, _right, -0.55 * g);
        rotateBoneWorld(B.LeftUpLeg, _right, -0.08 * g);
      } else {
        // hanging from a bar / reins / risers: both hands up and still
        const up = pose === 'canopy' ? 1.32 : 1.15;
        rotateBoneWorld(B.RightArm, _fwd, -up * g); rotateBoneWorld(B.LeftArm, _fwd, up * g);
        rotateBoneWorld(B.RightForeArm, _fwd, -0.12 * g); rotateBoneWorld(B.LeftForeArm, _fwd, 0.12 * g);
        rotateBoneWorld(B.RightUpLeg, _right, 0.3 * g); rotateBoneWorld(B.LeftUpLeg, _right, 0.15 * g);
        rotateBoneWorld(B.RightLeg, _right, -0.5 * g);
      }
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
