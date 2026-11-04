// Emotes: procedural dances layered on the static T-pose (bones are restored every frame, see Character.mixerStep)
// plus a little synth beat for each one. Choreography works in character space through three axes:
//   R = character right, F = forward, U = up. From the T-pose (arms straight out):
//   RightArm about F: + lowers it / − raises it        LeftArm about F: − lowers it / + raises it
//   RightArm about U: + swings it forward              LeftArm about U: − swings it forward
//   UpLeg about R: + lifts the thigh forward           Leg (knee) about R: − bends the knee
//   Spine about R: − leans forward / + leans back
import * as THREE from 'three';
import { Audio } from '../core/audio.js';

export const EMOTES = [
  { id: 'takethel', name: 'Take the L', loop: true, bpm: 128 },
  { id: 'floss', name: 'Floss', loop: true, bpm: 116 },
  { id: 'orangejustice', name: 'Orange Justice', loop: true, bpm: 122 },
  { id: 'laugh', name: 'Laugh', loop: true, bpm: 0 },
  { id: 'defaultdance', name: 'Default Dance', loop: true, bpm: 120 },
];

const TAU = Math.PI * 2;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _ax = new THREE.Vector3(), _qa = new THREE.Quaternion();

/** Rotate `bone` (in world space) so the segment bone → child points along world direction `dir`, blended by k. */
function aimBone(rot, bone, child, dir, k) {
  if (!bone || !child) return;
  bone.getWorldPosition(_a); child.getWorldPosition(_b);
  _c.subVectors(_b, _a); if (_c.lengthSq() < 1e-10) return;
  _c.normalize();
  _qa.setFromUnitVectors(_c, _b.copy(dir).normalize());
  const ang = 2 * Math.acos(Math.min(1, Math.abs(_qa.w))) * (_qa.w < 0 ? -1 : 1);
  const sn = Math.sqrt(Math.max(0, 1 - _qa.w * _qa.w));
  if (sn < 1e-6 || !ang) return;
  _ax.set(_qa.x / sn, _qa.y / sn, _qa.z / sn);
  rot(bone, _ax, ang * k);
}
const dirOf = (R, U, F, r, u, f, out) => out.set(0, 0, 0).addScaledVector(R, r).addScaledVector(U, u).addScaledVector(F, f).normalize();
const _d = new THREE.Vector3(), _h = new THREE.Vector3();
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));

/**
 * Pose the character for emote `id` at time t (seconds since start).
 * rot(bone, axis, angle) rotates a bone about a world axis; ax = {R, F, U}; model = the model group (for hops/sways).
 * k = blend-in amount 0..1.
 */
export function poseEmote(id, t, B, ax, rot, model, k) {
  const { R, F, U } = ax;
  const r = (bone, axis, a) => rot(bone, axis, a * k);
  const armsDown = (a = 1.25) => { r(B.RightArm, F, a); r(B.LeftArm, F, -a); };
  switch (id) {
    case 'floss': {
      // straight arms swing side to side together, one in front of the body and one behind; hips swing the other way
      const s = Math.sin(t * TAU * 2.0);
      model.position.x = -s * 0.07 * k;
      r(B.Hips, F, s * 0.12); r(B.Spine, F, -s * 0.14);
      armsDown(1.32);
      r(B.RightArm, R, s * 0.5); r(B.LeftArm, R, -s * 0.5);
      r(B.RightArm, F, -s * 0.55); r(B.LeftArm, F, -s * 0.55);
      r(B.LeftUpLeg, R, 0.1); r(B.RightUpLeg, R, 0.1); r(B.LeftLeg, R, -0.18); r(B.RightLeg, R, -0.18);
      break;
    }
    case 'takethel': {
      // right hand makes an L on the forehead; hop from leg to leg kicking the other one out to the side
      const ph = (t * 2.1) % 2, side = ph < 1 ? 1 : -1, kick = Math.sin(Math.PI * (ph % 1));
      model.position.y = kick * 0.08 * k;
      r(B.Spine1, F, -side * 0.06); r(B.Head, F, side * 0.1); r(B.Head, R, -0.08);
      // the L: elbow up and out to the side, forearm folded in so the hand rests on the forehead
      aimBone(rot, B.RightArm, B.RightForeArm, dirOf(R, U, F, 0.78, 0.42, 0.46, _d), k);
      B.Head.getWorldPosition(_h).addScaledVector(U, 0.1).addScaledVector(F, 0.2).addScaledVector(R, 0.02);
      B.RightForeArm.getWorldPosition(_a);
      aimBone(rot, B.RightForeArm, B.RightHand, _d.subVectors(_h, _a), k);
      r(B.RightHand, F, 0.35);
      // free arm pumps by the hip
      r(B.LeftArm, F, -1.2); r(B.LeftArm, R, 0.2 + kick * 0.35); r(B.LeftForeArm, R, 0.8);
      // side kicks + hop
      if (side > 0) { r(B.LeftUpLeg, F, kick * 0.8); r(B.LeftLeg, R, -kick * 0.3); r(B.RightUpLeg, R, 0.1); r(B.RightLeg, R, -0.25); }
      else { r(B.RightUpLeg, F, -kick * 0.8); r(B.RightLeg, R, -kick * 0.3); r(B.LeftUpLeg, R, 0.1); r(B.LeftLeg, R, -0.25); }
      break;
    }
    case 'orangejustice': {
      // arms swing low across the front while the legs shuffle out and in, body bouncing
      const s = Math.sin(t * TAU * 1.9), b = Math.abs(s);
      model.position.y = -b * 0.08 * k;
      r(B.Spine, R, -0.12); r(B.Spine1, U, s * 0.2);
      armsDown(1.25);
      r(B.RightArm, R, 0.5); r(B.LeftArm, R, 0.5);
      r(B.RightArm, F, -s * 0.75); r(B.LeftArm, F, -s * 0.75);
      r(B.RightForeArm, R, 0.35); r(B.LeftForeArm, R, 0.35);
      r(B.LeftUpLeg, F, Math.max(0, s) * 0.6); r(B.RightUpLeg, F, Math.min(0, s) * 0.6);
      r(B.LeftUpLeg, R, 0.3 * b); r(B.RightUpLeg, R, 0.3 * b);
      r(B.LeftLeg, R, -0.55 * b); r(B.RightLeg, R, -0.55 * b);
      r(B.LeftFoot, R, 0.25 * b); r(B.RightFoot, R, 0.25 * b);
      break;
    }
    case 'laugh': {
      // throws the head back laughing, then doubles over slapping a knee; shoulders shaking throughout
      const cyc = (t % 3.2) / 3.2, back = 1 - ease((cyc - 0.45) / 0.15) + ease((cyc - 0.92) / 0.08);
      const shake = Math.sin(t * 34) * 0.05;
      const lean = back * 0.32 - (1 - back) * 0.6;
      r(B.Spine, R, lean * 0.45 + shake * 0.4); r(B.Spine1, R, lean * 0.35); r(B.Spine2, R, lean * 0.25 + shake);
      r(B.Head, R, back * 0.35 - (1 - back) * 0.1);
      armsDown(1.3);
      r(B.RightArm, R, 0.35 + (1 - back) * 0.3); r(B.LeftArm, R, 0.35);
      r(B.RightForeArm, R, 1.45 * back + 0.3); r(B.LeftForeArm, R, 1.45);
      r(B.RightArm, F, -0.25); r(B.LeftArm, F, 0.25);
      if (back < 0.5) { const slap = Math.max(0, Math.sin(t * 14)); r(B.RightArm, R, slap * 0.4); }
      r(B.LeftUpLeg, R, (1 - back) * 0.35); r(B.RightUpLeg, R, (1 - back) * 0.45); r(B.LeftLeg, R, -(1 - back) * 0.5); r(B.RightLeg, R, -(1 - back) * 0.6);
      model.position.y = (shake * 0.3 - (1 - back) * 0.08) * k;
      break;
    }
    case 'defaultdance': {
      // elbows bent, fists pumping side to side in front of the chest, knees bouncing, step-touch
      const s = Math.sin(t * TAU * 2.0), b = Math.abs(s), step = Math.sin(t * TAU * 1.0);
      model.position.y = -b * 0.06 * k; model.position.x = step * 0.05 * k;
      r(B.Hips, U, s * 0.14); r(B.Spine1, U, -s * 0.18);
      armsDown(1.3);
      r(B.RightArm, R, 0.25); r(B.LeftArm, R, 0.25);
      r(B.RightForeArm, R, 1.75); r(B.LeftForeArm, R, 1.75);
      r(B.RightArm, F, -s * 0.35); r(B.LeftArm, F, -s * 0.35);
      r(B.RightForeArm, F, -s * 0.45); r(B.LeftForeArm, F, -s * 0.45);
      r(B.LeftUpLeg, R, 0.2 * b); r(B.RightUpLeg, R, 0.2 * b); r(B.LeftLeg, R, -0.42 * b); r(B.RightLeg, R, -0.42 * b);
      r(B.LeftUpLeg, F, Math.max(0, step) * 0.28); r(B.RightUpLeg, F, Math.min(0, step) * 0.28);
      r(B.Head, F, s * 0.1);
      break;
    }
  }
}

// ---------------------------------------------------------------- music
/** Start a beat for emote `id`. Returns a stop() function. */
export function playEmoteBeat(id) {
  const A = Audio, ctx = A.ctx;
  const E = EMOTES.find(e => e.id === id);
  if (!ctx || !E) return () => {};
  const out = ctx.createGain(); out.gain.value = 0.0001; out.connect(A.musicBus || A.master);
  out.gain.setTargetAtTime(0.55, ctx.currentTime, 0.08);
  let stopped = false, next = ctx.currentTime + 0.05, step = 0;
  const noise = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const kick = (t) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3); };
  const hat = (t, v = 0.18) => { const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 0.06); };
  const snare = (t) => { const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = ctx.createGain(); g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 0.18); };
  const note = (t, f0, len, type = 'square', v = 0.12) => { const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = type; o.frequency.value = f0; lp.type = 'lowpass'; lp.frequency.value = 1800; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02); };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // 16-step patterns: bass line (midi or 0), lead (midi or 0)
  const P = {
    takethel:      { bass: [40, 0, 40, 0, 43, 0, 40, 0, 45, 0, 43, 0, 40, 0, 38, 0], lead: [64, 0, 67, 0, 69, 0, 67, 64, 0, 0, 62, 0, 64, 0, 0, 0] },
    floss:         { bass: [36, 0, 0, 36, 0, 0, 39, 0, 41, 0, 0, 41, 0, 0, 39, 0], lead: [72, 0, 72, 0, 75, 0, 72, 0, 77, 0, 75, 0, 72, 0, 70, 0] },
    orangejustice: { bass: [43, 0, 43, 43, 0, 43, 46, 0, 41, 0, 41, 41, 0, 41, 38, 0], lead: [67, 0, 0, 70, 0, 0, 72, 0, 65, 0, 0, 69, 0, 0, 67, 0] },
    defaultdance:  { bass: [38, 0, 38, 0, 38, 0, 41, 0, 43, 0, 43, 0, 41, 0, 36, 0], lead: [62, 0, 65, 0, 69, 0, 65, 0, 67, 0, 70, 0, 69, 0, 65, 0] },
  }[id];
  const stepLen = E.bpm ? 60 / E.bpm / 4 : 0;
  const laughs = [];
  const tick = () => {
    if (stopped) return;
    while (next < ctx.currentTime + 0.25) {
      if (P) {
        const i = step % 16;
        if (i % 4 === 0) kick(next);
        if (i % 8 === 4) snare(next);
        hat(next, i % 2 ? 0.08 : 0.16);
        if (P.bass[i]) note(next, hz(P.bass[i]), stepLen * 1.8, 'sawtooth', 0.16);
        if (P.lead[i]) note(next, hz(P.lead[i]), stepLen * 1.5, 'square', 0.07);
        next += stepLen; step++;
      } else {
        // laugh: bursts of "ha" (formant-ish blips), then a breath
        const n = 5;
        for (let k = 0; k < n; k++) {
          const t0 = next + k * 0.13, f0 = 260 - k * 12;
          const o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t0 + 0.1);
          bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 3;
          g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);
          o.connect(bp); bp.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.12); laughs.push(o);
        }
        next += 3.2;
      }
    }
  };
  tick();
  const iv = setInterval(tick, 60);
  return () => {
    if (stopped) return; stopped = true; clearInterval(iv);
    out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
    setTimeout(() => out.disconnect(), 600);
  };
}
