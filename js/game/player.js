// Local player controller + third-person camera rig.
import * as THREE from 'three';
import { WEAPONS } from '../data/items.js';
import { vfovFromH, FORTNITE_FOV } from '../config.js';
import { Audio } from '../core/audio.js';

const _v = new THREE.Vector3(), _dir = new THREE.Vector3(), _o = new THREE.Vector3(), _t = new THREE.Vector3();
const TAU = Math.PI * 2;
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

// Over-the-shoulder camera rig (metres): distance behind, offset to the right, extra height.
// Framing measured from Fortnite Mobile (docs/fortnite-mobile-camera-notes.md): body ~41 % across,
// head ~43 % and feet ~85 % down the screen, so the camera sits at chest height just over the right shoulder.
export const CAMERA_RIG = { hip: { dist: 4.5, right: 0.64, up: -0.08 }, ads: { dist: 2.1, right: 0.6, up: 0.0 } };

/** Where the third-person camera sits for a character (no wall collision). Used by the game and the FOV preview. */
export function rigPose(pos, yaw, pitch, crouch, rig, outPos, outTarget) {
  const pivotY = pos.y + (crouch ? 1.18 : 1.56);
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const fwd = new THREE.Vector3(sy * cp, sp, cy * cp), rgt = new THREE.Vector3(-cy, 0, sy);
  outPos.set(pos.x, pivotY, pos.z).addScaledVector(rgt, rig.right).addScaledVector(fwd, -rig.dist);
  outPos.y += rig.up;
  outTarget.copy(outPos).addScaledVector(fwd, 10);
}

export class PlayerController {
  constructor(game, camera, settings) {
    this.g = game;
    this.cam = camera;
    this.settings = settings;
    this.yaw = 0; this.pitch = -0.1;
    this.camPos = new THREE.Vector3();
    this.camDist = 3.2;
    this.shake = 0;
    this.fovBase = vfovFromH(settings.fov || FORTNITE_FOV);
    this.zoom = 1;
    this.interactTarget = null;
    this.autoScanT = 0; this.autoTarget = null; this.autoUntil = 0; this.autoStart = 0; this.autoFiring = false;
    this.lock = null; this.lockF = null; this.lockTarget = null; this.lockAge = 0; this.lockCd = 0; this.brokeFrom = null;
    this.assistTarget = null;
    this.spectating = null;
    this.busOrbit = 0;
    this.throwHeld = false;
    this.emoteOrbit = 0; this.emotePitch = -0.12; this.emoteCamK = 0;
  }

  /** Camera aim ray (from the camera through the crosshair). */
  aimRay(origin, dir) {
    this.cam.getWorldDirection(dir);
    origin.copy(this.cam.position);
    // start the ray at the player's depth so we never hit things between the camera and the player
    const f = this.g.player;
    const toP = _v.set(f.pos.x - origin.x, f.eyeY - origin.y, f.pos.z - origin.z);
    const along = Math.max(0, toP.dot(dir) - 0.3);
    origin.addScaledVector(dir, along);
  }

  update(dt, input) {
    const g = this.g, f = g.player, S = this.settings;
    // ---------------- look
    const ads = f.ads && f.weapon;
    const zoom = ads ? f.weapon.zoom : 1;
    let sens = 0.0042 * S.sens * (ads ? S.adsSens / Math.sqrt(zoom) : 1);
    // aim assist slowdown
    const assist = S.aimAssist && f.alive && f.mode === 'ground' && f.weapon && !f.emote ? this.findAssist(f) : null;
    if (assist && assist.ang < 0.07) sens *= 0.62;
    if (this.lock) sens *= 0.7; // steadier while locked on
    // while dancing, swipes orbit the camera around the player instead of turning them
    if (f.emote && f.alive) {
      this.emoteOrbit -= input.look.dx * sens;
      this.emotePitch = Math.max(-0.9, Math.min(0.6, this.emotePitch - input.look.dy * sens * (S.invertY ? -1 : 1)));
      input.look.dx = 0; input.look.dy = 0;
    }
    const swipePx = Math.abs(input.look.dx) + Math.abs(input.look.dy);
    this.yaw -= input.look.dx * sens;
    this.pitch -= input.look.dy * sens * (S.invertY ? -1 : 1);
    input.look.dx = 0; input.look.dy = 0;
    this.pitch = Math.max(-1.35, Math.min(1.2, this.pitch));
    // AUTO SHOOT lock-on: snaps onto nearby enemies and tracks them (Fortnite-mobile style)
    const lockable = S.autoFire && f.alive && f.mode === 'ground' && f.weapon && !f.emote;
    if (lockable) this.updateLock(dt, f, f.weapon, swipePx); else { this.lock = null; this.lockF = null; }
    this.lockTarget = this.lock ? this.lock.f : null;
    // aim assist pull (only while moving or shooting, like console/mobile assist)
    if (assist && !this.lock && (Math.hypot(input.move.x, input.move.y) > 0.2 || input.fire)) {
      const k = Math.min(1, dt * (assist.ang < 0.03 ? 3.5 : 2));
      this.yaw += angDiff(this.yaw, assist.yaw) * k * 0.55;
      this.pitch += (assist.pitch - this.pitch) * k * 0.35;
    }
    this.assistTarget = assist ? assist.f : null;

    if (!f.alive) { this.updateCamera(dt); return; }

    // ---------------- movement intent (camera relative)
    const mx = input.move.x, my = input.move.y; // y = forward
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    // forward = (sin yaw, cos yaw); right = (-cos yaw, sin yaw)
    f.move.set(sy * my - cy * mx, cy * my + sy * mx);
    const mag = Math.hypot(mx, my);
    f.sprint = (S.autoSprint && mag > 0.9 && my > 0.3) && !f.ads && !input.fire && f.fireCd <= 0.05;
    if (input.sprintKey) f.sprint = mag > 0.1 && !f.ads;
    f.yaw = this.yaw; f.pitch = this.pitch;

    if (f.mode === 'bus') {
      if (input.jump) { input.jump = false; g.jumpFromBus(f); }
      this.updateCamera(dt); return;
    }
    // ---------------- emotes: anything that moves, shoots or switches gear ends the dance
    if (input.emote) {
      const id = input.emote; input.emote = null;
      if (g.startEmote(f, id)) { this.emoteOrbit = 0; this.emotePitch = -0.12; }
      else if (f.mode !== 'ground') g.hud.toast('Land first to emote');
    }
    if (f.emote) {
      const quit = mag > 0.25 || input.jump || input.fire || input.firePressed || input.reload || input.adsToggle || input.adsHeld ||
        input.crouch || input.interact || input.swap || (input.slot !== null && input.slot !== undefined) || input.jumpHeld;
      if (quit) g.stopEmote(f);
      else {
        f.move.set(0, 0); f.sprint = false; f.jetHeld = false;
        this.interactTarget = null;
        this.updateCamera(dt); return;
      }
    }
    if (f.mode === 'skydive') {
      if (input.jump) { input.jump = false; const gH = g.groundAt(f.pos.x, f.pos.z, f.pos.y); if (f.pos.y - gH > 12) { f.mode = 'glide'; g.onDeploy(f); } }
    }
    if (input.jump) { f.wantJump = true; input.jump = false; }
    f.jetHeld = !!input.jumpHeld && f.mode === 'ground';
    if (input.crouch) { input.crouch = false; if (f.mode === 'ground') f.crouch = !f.crouch; }
    if (input.slot !== null && input.slot !== undefined) {
      if (f.select(input.slot)) Audio.play('equip', { vol: 0.6 });
      input.slot = null;
    }
    if (input.swap) { const [a, b] = input.swap; input.swap = null; if (f.swapSlots(a, b)) Audio.play('equip', { vol: 0.6 }); }
    if (input.reload) { input.reload = false; if (f.startReload()) Audio.play(f.weapon.id === 'shotgun' ? 'pump' : 'reload', { vol: 0.55 }); }
    // ADS toggle
    if (input.adsToggle) { input.adsToggle = false; f.ads = !!f.weapon && !f.ads && f.mode === 'ground'; }
    if (!f.weapon || f.mode !== 'ground' || f.sprint) { if (f.sprint) f.ads = false; if (!f.weapon) f.ads = false; }
    if (input.adsHeld !== undefined && input.adsHeld !== null) { f.ads = !!f.weapon && input.adsHeld && f.mode === 'ground'; }

    // ---------------- interact / pickups
    this.interactTarget = f.mode === 'ground' ? g.loot.nearest(f, 2.2) : null;
    if (S.autoPickup && f.mode === 'ground') {
      const n = g.loot.nearest(f, 1.5);
      if (n && n.type === 'item') {
        const it = n.rec.item;
        if ((it.kind === 'jetpack' && !f.jetpack) || it.kind === 'ammo' || (it.kind === 'grenade' && (f.hasEmptySlot() || f.slots.some(s => s && s.kind === 'grenade' && s.id === it.id))) || (it.kind === 'gun' && f.hasEmptySlot()))
          if (g.time - n.rec.born > 0.6 || !n.rec.dropped) g.loot.take(f, n.rec, false);
      }
    }
    if (input.interact) {
      input.interact = false;
      const t = this.interactTarget;
      if (t) {
        if (t.type === 'item') g.loot.take(f, t.rec, true);
        else if (t.type === 'chest') g.loot.openChest(t.rec, f);
        else if (t.type === 'box') g.loot.openBox(t.rec, f);
      }
    }

    // ---------------- firing
    const it = f.item;
    if (f.mode === 'ground') {
      if (!it) {
        if (input.firePressed || input.fire) this.g.combat.melee(f, _dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)));
      } else if (it.kind === 'heal') {
        if ((input.firePressed || input.fire) && !f.healing) {
          if (f.startHeal()) Audio.play('uiopen', { vol: 0.5, rate: 0.8 });
          else if (input.firePressed && f.health >= 100) this.g.hud.toast('Health is already full');
        }
      } else if (it.kind === 'grenade' && it.id === 'shockwave') {
        // Shockwave = mobility: launch up and forward where you're moving (or looking)
        if (input.firePressed) {
          const mv = Math.hypot(input.move.x, input.move.y);
          const dir = mv > 0.3 ? new THREE.Vector3(f.move.x, 0, f.move.y) : new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          if (g.combat.useShockwave(f, dir)) this.shake = Math.max(this.shake, 0.6);
        }
      } else if (it.kind === 'grenade') {
        if (input.firePressed) { this.cam.getWorldDirection(_dir); g.combat.throwGrenade(f, _dir.clone()); }
      } else if (it.kind === 'gun') {
        const w = WEAPONS[it.id];
        let wantFire = w.auto ? input.fire : input.firePressed;
        if (!w.auto && input.fire && f.fireCd <= 0 && it.mag > 0 && !f.reloading) wantFire = true; // hold-to-fire for semi autos
        // ---- AUTO SHOOT: fires for you whenever the crosshair is over an enemy (like Fortnite mobile)
        let autoNow = false;
        const L = this.lock;
        const onLock = L && L.seen && L.ang < Math.atan2(0.6, L.dist) + 0.04; // crosshair is on the locked enemy
        if (S.autoFire && !wantFire) {
          this.autoScanT -= dt;
          if (this.autoScanT <= 0) {
            this.autoScanT = 0.04;
            const t = onLock ? L.f : this.findAutoTarget(f, w);
            if (t) {
              if (t !== this.autoTarget || g.time > this.autoUntil) this.autoStart = g.time + 0.06; // tiny human-like delay
              this.autoTarget = t; this.autoUntil = g.time + 0.14;
            }
          }
          if (this.autoTarget && this.autoTarget.alive && g.time < this.autoUntil && g.time >= this.autoStart && !f.reloading) autoNow = true;
        }
        this.autoFiring = autoNow;
        if (autoNow) { f.sprint = false; wantFire = true; }
        if (wantFire && !f.sprint) {
          this.aimRay(_o, _dir);
          // locked on: shots go to the target's centre mass with tightened spread
          let spreadMul = 1;
          if (onLock && S.autoFire) {
            _dir.copy(L.pt).sub(_o).normalize();
            spreadMul = w.id === 'shotgun' ? 0.65 : w.id === 'sniper' ? 1 : 0.35;
          }
          if (g.combat.fireGun(f, _o, _dir, 0, spreadMul)) {
            const k = w.recoil * (f.ads ? 0.6 : 1) * (onLock ? 0.3 : 1);
            this.pitch += k * (0.6 + Math.random() * 0.4);
            this.yaw += (Math.random() - 0.5) * k * 0.6;
            this.shake = Math.max(this.shake, w.id === 'shotgun' || w.id === 'sniper' ? 0.5 : 0.12);
            if (w.id === 'sniper' || w.id === 'shotgun') setTimeout(() => Audio.play('pump', { vol: 0.4 }), 350);
          }
        }
      }
    }
    input.firePressed = false;
    this.updateCamera(dt);
  }

  /**
   * Lock-on for Auto Shoot (Fortnite-mobile style). Acquires the best enemy near the crosshair
   * (the closer they are, the wider it grabs), then sticks: it tracks them with lead, holds through
   * brief cover, and only lets go when you deliberately flick away, they get far, or die.
   */
  updateLock(dt, f, w, swipePx = 0) {
    const g = this.g;
    if (w.id === 'sniper' && !this.scoped) { this.lock = null; this.lockF = null; return; }
    const range = w.lockRange || 40;
    const cp = this.cam.position, fwd = this.cam.getWorldDirection(new THREE.Vector3());
    // deliberate flicks build up; small corrections fade away quickly
    this.swipeAcc = (this.swipeAcc || 0) * Math.exp(-dt * 5) + swipePx;
    const aimPoint = (o, head) => new THREE.Vector3(o.pos.x, o.pos.y + ((o.crouch && o.mode === 'ground') ? (head ? 1.15 : 0.85) : (head ? 1.58 : 1.2)), o.pos.z);
    const angTo = pt => { const v = pt.clone().sub(cp).normalize(); return { v, ang: Math.acos(Math.min(1, v.dot(fwd))) }; };
    const visible = pt => g.col.clear(cp.x, cp.y, cp.z, pt.x, pt.y, pt.z) && g.col.clear(f.pos.x, f.eyeY, f.pos.z, pt.x, pt.y, pt.z);
    const evalT = (o, needInFront) => {
      if (!o || !o.alive || o.team === f.team || o.mode === 'bus') return null;
      const dist = o.pos.distanceTo(f.pos);
      if (dist > range * (needInFront ? 1 : 1.35)) return null;
      const ahead = (o.pos.x - f.pos.x) * fwd.x + (o.pos.z - f.pos.z) * fwd.z;
      if (ahead < (needInFront ? 0.5 : -0.5)) return null;
      for (const head of [false, true]) {
        const pt = aimPoint(o, head);
        if (!visible(pt)) continue;
        return { f: o, dist, pt, ang: angTo(pt).ang, seen: true };
      }
      const pt = aimPoint(o, false);
      return { f: o, dist, pt, ang: angTo(pt).ang, seen: false };
    };
    const cone = d => Math.min(0.66, Math.max(0.09, Math.atan2(3.8, d))); // acquisition window (rad)
    if (this.lockCd > 0) this.lockCd -= dt;
    // ---- keep the current lock?
    let cur = this.lockF ? evalT(this.lockF, false) : null;
    if (cur) {
      if (cur.seen) this.lockLostT = 0; else this.lockLostT = (this.lockLostT || 0) + dt;
      const flickedAway = this.swipeAcc > 170 && cur.ang > cone(cur.dist) * 1.5;
      if (flickedAway || this.lockLostT > 0.9 || cur.ang > 1.25) {
        if (flickedAway) { this.brokeFrom = cur.f; this.lockCd = 0.7; }
        cur = null;
      }
    }
    // ---- acquire a new one
    if (!cur) {
      let best = null, bestScore = Infinity;
      for (const o of g.fighters) {
        if (o === this.brokeFrom && this.lockCd > 0) continue;
        if (!o.alive || o.team === f.team) continue;
        const d0 = o.pos.distanceTo(f.pos);
        if (d0 > range || angTo(aimPoint(o, false)).ang > cone(d0) + 0.05) continue; // cheap reject before ray casts
        const t = evalT(o, true);
        if (!t || !t.seen || t.ang > cone(t.dist)) continue;
        const score = t.ang / cone(t.dist) + (t.dist / range) * 0.35;
        if (score < bestScore) { bestScore = score; best = t; }
      }
      if (best) { this.lockAge = 0; this.lockLostT = 0; }
      cur = best;
    }
    this.lock = cur; this.lockF = cur ? cur.f : null;
    if (!cur) return;
    this.lockAge = (this.lockAge || 0) + dt;
    // ---- track: aim where they are about to be (lead), snap fast on acquire, then hold tight
    const o = cur.f;
    const lead = cur.pt.clone().addScaledVector(o.vel, 0.09);
    const v = lead.sub(cp).normalize();
    const wantYaw = Math.atan2(v.x, v.z), wantPitch = Math.asin(Math.max(-1, Math.min(1, v.y)));
    const strength = !cur.seen ? 6 : this.lockAge < 0.2 ? 24 : 20;
    const k = 1 - Math.exp(-dt * strength);
    this.yaw += angDiff(this.yaw, wantYaw) * k;
    this.pitch += (wantPitch - this.pitch) * k;
  }

  /** Enemy currently under the crosshair (any part of the body), with line of sight. */
  findAutoTarget(f, w) {
    const g = this.g;
    if (w.id === 'sniper' && !this.scoped) return null; // snipers only auto-shoot through the scope
    const range = w.autoRange;
    const cp = this.cam.position;
    const fwd = this.cam.getWorldDirection(new THREE.Vector3());
    const spread = (f.ads ? w.ads : w.hip) + f.bloom;
    let best = null, bestAng = Infinity;
    for (const o of g.fighters) {
      if (!o.alive || o.team === f.team || o.mode === 'bus') continue;
      const dist = o.pos.distanceTo(f.pos);
      if (dist > range) continue;
      // must be in front of the player, not between the camera and the player
      if ((o.pos.x - f.pos.x) * fwd.x + (o.pos.z - f.pos.z) * fwd.z < 0.3) continue;
      const crouch = o.crouch && o.mode === 'ground';
      const parts = crouch ? [[0.85, 0.45], [1.2, 0.26], [0.4, 0.4]] : [[1.15, 0.45], [1.62, 0.26], [0.55, 0.4]];
      for (const [hy, r] of parts) {
        _t.set(o.pos.x, o.pos.y + hy, o.pos.z);
        _v.copy(_t).sub(cp);
        const d = _v.length(); _v.divideScalar(d);
        const ang = Math.acos(Math.min(1, _v.dot(fwd)));
        if (ang > Math.atan2(r, d) + spread * 0.35 || ang >= bestAng) continue;
        if (!g.col.clear(cp.x, cp.y, cp.z, _t.x, _t.y, _t.z)) continue;
        if (!g.col.clear(f.pos.x, f.eyeY, f.pos.z, _t.x, _t.y, _t.z)) continue;
        best = o; bestAng = ang;
      }
    }
    return best;
  }

  findAssist(f) {
    const w = f.weapon; if (!w) return null;
    const range = Math.min(w.range, w.id === 'sniper' ? 120 : 90);
    let best = null;
    this.cam.getWorldDirection(_dir);
    for (const o of this.g.fighters) {
      if (!o.alive || o.team === f.team || o.mode !== 'ground') continue;
      _t.set(o.pos.x, o.pos.y + (o.crouch ? 0.9 : 1.2), o.pos.z);
      _v.copy(_t).sub(this.cam.position);
      const d = _v.length();
      if (d > range) continue;
      _v.divideScalar(d);
      const ang = Math.acos(Math.min(1, _v.dot(_dir)));
      const lim = 0.09 + 1.2 / Math.max(4, d);
      if (ang > lim) continue;
      if (best && ang > best.ang) continue;
      if (!this.g.col.clear(this.cam.position.x, this.cam.position.y, this.cam.position.z, _t.x, _t.y, _t.z)) continue;
      // yaw/pitch that would put the crosshair (camera ray) on the target
      const cx = _t.x - this.cam.position.x, cz = _t.z - this.cam.position.z;
      best = { f: o, ang, yaw: Math.atan2(cx, cz), pitch: Math.atan2(_t.y - this.cam.position.y, Math.hypot(cx, cz)) };
    }
    return best;
  }

  updateCamera(dt) {
    const g = this.g;
    let f = g.player;
    if (!f.alive && this.spectating && !this.spectating.alive) {
      // follow whoever took out the player we were watching, or anyone still standing
      const next = this.spectating.eliminatedBy;
      const mate = g.teamSize > 1 ? g.fighters.find(o => o.alive && o.team === g.player.team) : null;
      this.spectating = mate || (next && next.alive ? next : g.fighters.find(o => o.alive) || null);
    }
    if (!f.alive && this.spectating && this.spectating.alive) f = this.spectating;
    const cam = this.cam;
    this.fovBase = vfovFromH(this.settings.fov || FORTNITE_FOV);
    let target, dist, right, up, fov = this.fovBase;
    const ads = f === g.player && f.ads && f.weapon;
    if (f.mode === 'bus') {
      this.busOrbit = this.yaw;
      const b = g.bus.pos;
      _t.set(b.x, b.y - 2 + (g.bus.camUp || 0), b.z);
      const d = g.bus.camDist || 26;
      cam.position.set(_t.x - Math.sin(this.yaw) * Math.cos(this.pitch) * d, _t.y - Math.sin(this.pitch) * d + 6, _t.z - Math.cos(this.yaw) * Math.cos(this.pitch) * d);
      cam.lookAt(_t);
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix();
      return;
    }
    let yaw = f === g.player ? this.yaw : f.yaw, pitch = f === g.player ? this.pitch : f.pitch * 0.5;
    // emote camera: swing round to the front of the dancer (and back again afterwards)
    const dancing = !!(f.emote && f.alive && f.mode === 'ground');
    this.emoteCamK += ((dancing ? 1 : 0) - this.emoteCamK) * Math.min(1, dt * (dancing ? 4 : 7));
    if (this.emoteCamK < 0.002) this.emoteCamK = 0;
    const ek = this.emoteCamK;
    if (ek > 0) {
      const e = ek * ek * (3 - 2 * ek);
      const eYaw = (f === g.player ? this.yaw : f.yaw) + Math.PI + (f === g.player ? this.emoteOrbit : 0);
      yaw += angDiff(yaw, eYaw) * e;
      pitch += ((f === g.player ? this.emotePitch : -0.12) - pitch) * e;
    }
    if (f.mode === 'skydive') { dist = 6.5; right = 0; up = 1.2; fov = this.fovBase * 1.12; }
    else if (f.mode === 'glide') { dist = 7.6; right = 0; up = 0.05; fov = this.fovBase * 1.12; }   // you and the whole glider in frame
    else if (ads) {
      const w = f.weapon;
      if (w.scope) { dist = -0.2; right = 0.0; up = 0; fov = this.fovBase / w.zoom; }
      else { ({ dist, right, up } = CAMERA_RIG.ads); fov = this.fovBase / w.zoom; }
    } else ({ dist, right, up } = CAMERA_RIG.hip);
    if (ek > 0) { dist += (3.9 - dist) * ek; right *= 1 - ek; up += (-0.25 - up) * ek; }
    if (!f.alive) { dist = 5; right = 0; }
    const pivotY = f.pos.y + (f.crouch && f.mode === 'ground' ? 1.18 : 1.56) + (f.mode !== 'ground' ? 0.8 : 0);
    const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    const fwd = _dir.set(sy * cp, sp, cy * cp);
    const rgt = new THREE.Vector3(-cy, 0, sy);
    const pivot = _o.set(f.pos.x, pivotY, f.pos.z).addScaledVector(rgt, right * 0.6);
    this.camDist += (dist - this.camDist) * Math.min(1, dt * 14);
    const want = new THREE.Vector3().copy(pivot).addScaledVector(rgt, right * 0.4).addScaledVector(fwd, -this.camDist);
    want.y += up;
    // camera collision
    const dv = want.clone().sub(pivot); const dl = dv.length();
    if (dl > 0.01) {
      dv.divideScalar(dl);
      const hit = g.col.raycast(pivot.x, pivot.y, pivot.z, dv.x, dv.y, dv.z, dl + 0.25);
      if (hit) want.copy(pivot).addScaledVector(dv, Math.max(0.2, hit.t - 0.25));
    }
    if (want.y < 0.3) want.y = 0.3;
    cam.position.copy(want);
    // look direction
    _t.copy(cam.position).addScaledVector(fwd, 10);
    cam.lookAt(_t);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      cam.rotation.x += (Math.random() - 0.5) * this.shake * 0.02;
      cam.rotation.y += (Math.random() - 0.5) * this.shake * 0.02;
    }
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 12);
    cam.updateProjectionMatrix();
    // hide own model when the scope is up
    if (f === g.player && f.alive && f.char) f.char.root.visible = !(ads && f.weapon.scope && this.camDist < 0.5);
    this.scoped = !!(ads && f.weapon.scope && this.camDist < 0.5);
  }
}
