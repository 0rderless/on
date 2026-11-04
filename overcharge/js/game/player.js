// Local player controller + third-person camera rig.
import * as THREE from 'three';
import { WEAPONS } from '../data/items.js';
import { Audio } from '../core/audio.js';

const _v = new THREE.Vector3(), _dir = new THREE.Vector3(), _o = new THREE.Vector3(), _t = new THREE.Vector3();
const TAU = Math.PI * 2;
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

export class PlayerController {
  constructor(game, camera, settings) {
    this.g = game;
    this.cam = camera;
    this.settings = settings;
    this.yaw = 0; this.pitch = -0.1;
    this.camPos = new THREE.Vector3();
    this.camDist = 3.2;
    this.shake = 0;
    this.fovBase = 78;
    this.zoom = 1;
    this.interactTarget = null;
    this.autoFireT = 0;
    this.assistTarget = null;
    this.spectating = null;
    this.busOrbit = 0;
    this.throwHeld = false;
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
    const assist = S.aimAssist && f.alive && f.mode === 'ground' && f.weapon ? this.findAssist(f) : null;
    if (assist && assist.ang < 0.07) sens *= 0.62;
    this.yaw -= input.look.dx * sens;
    this.pitch -= input.look.dy * sens * (S.invertY ? -1 : 1);
    input.look.dx = 0; input.look.dy = 0;
    this.pitch = Math.max(-1.35, Math.min(1.2, this.pitch));
    // aim assist pull (only while moving or shooting, like console/mobile assist)
    if (assist && (Math.hypot(input.move.x, input.move.y) > 0.2 || input.fire)) {
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
    if (f.mode === 'skydive') {
      if (input.jump) { input.jump = false; const gH = g.groundAt(f.pos.x, f.pos.z, f.pos.y); if (f.pos.y - gH > 12) { f.mode = 'glide'; g.onDeploy(f); } }
    }
    if (input.jump) { f.wantJump = true; input.jump = false; }
    if (input.crouch) { input.crouch = false; if (f.mode === 'ground') f.crouch = !f.crouch; }
    if (input.slot !== null && input.slot !== undefined) {
      if (f.select(input.slot)) Audio.play('equip', { vol: 0.6 });
      input.slot = null;
    }
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
        if (it.kind === 'ammo' || (it.kind === 'grenade' && (f.hasEmptySlot() || f.slots.some(s => s && s.kind === 'grenade' && s.id === it.id))) || (it.kind === 'gun' && f.hasEmptySlot()))
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
      } else if (it.kind === 'grenade') {
        if (input.firePressed) { this.cam.getWorldDirection(_dir); g.combat.throwGrenade(f, _dir.clone()); }
      } else if (it.kind === 'gun') {
        const w = WEAPONS[it.id];
        let wantFire = w.auto ? input.fire : input.firePressed || (input.fire && f.fireCd <= 0 && w.id !== 'sniper' && false);
        if (!w.auto && input.fire && f.fireCd <= 0 && it.mag > 0 && !f.reloading) wantFire = true; // hold-to-fire for semi autos
        // mobile auto-fire
        if (S.autoFire && w.autoRange > 0 && !wantFire) {
          this.autoFireT -= dt;
          if (this.autoFireT <= 0) {
            this.autoFireT = 0.05;
            this.aimRay(_o, _dir);
            const hit = g.combat.rayFighters(f, _o.x, _o.y, _o.z, _dir.x, _dir.y, _dir.z, w.autoRange);
            if (hit) {
              const w2 = g.col.raycast(_o.x, _o.y, _o.z, _dir.x, _dir.y, _dir.z, hit.t);
              if (!w2) { this.autoTarget = hit.f; this.autoUntil = g.time + 0.25; }
            }
          }
          if (this.autoTarget && g.time < this.autoUntil && this.autoTarget.alive) wantFire = true;
        }
        if (wantFire && !f.sprint) {
          this.aimRay(_o, _dir);
          if (g.combat.fireGun(f, _o, _dir)) {
            const k = w.recoil * (f.ads ? 0.6 : 1);
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
      this.spectating = next && next.alive ? next : g.fighters.find(o => o.alive && (g.mode !== 'reload' || o.team === g.player.team)) || g.fighters.find(o => o.alive) || null;
    }
    if (!f.alive && this.spectating && this.spectating.alive) f = this.spectating;
    const cam = this.cam;
    let target, dist, right, up, fov = this.fovBase;
    const ads = f === g.player && f.ads && f.weapon;
    if (f.mode === 'bus') {
      this.busOrbit = this.yaw;
      const b = g.bus.pos;
      _t.set(b.x, b.y - 2, b.z);
      const d = 26;
      cam.position.set(_t.x - Math.sin(this.yaw) * Math.cos(this.pitch) * d, _t.y - Math.sin(this.pitch) * d + 6, _t.z - Math.cos(this.yaw) * Math.cos(this.pitch) * d);
      cam.lookAt(_t);
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix();
      return;
    }
    const yaw = f === g.player ? this.yaw : f.yaw, pitch = f === g.player ? this.pitch : f.pitch * 0.5;
    if (f.mode === 'skydive' || f.mode === 'glide') { dist = 6.5; right = 0; up = 1.2; fov = 84; }
    else if (ads) {
      const w = f.weapon;
      if (w.scope) { dist = -0.2; right = 0.0; up = 0; fov = this.fovBase / w.zoom; }
      else { dist = 1.7; right = 0.58; up = 0.12; fov = this.fovBase / w.zoom; }
    } else { dist = 3.1; right = 0.7; up = 0.22; }
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
