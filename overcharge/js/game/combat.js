// Shooting, grenades and damage resolution.
import * as THREE from 'three';
import { WEAPONS, GRENADES } from '../data/items.js';
import { Audio } from '../core/audio.js';
import { MAX_SHIELD } from '../config.js';

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _m = new THREE.Vector3(), _hit = new THREE.Vector3();

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return -1;
  return tca - Math.sqrt(r * r - d2);
}

/** Random direction inside a cone around dir (half-angle `spread`). */
export function spreadDir(dir, spread, out) {
  if (spread <= 0) return out.copy(dir);
  const up = Math.abs(dir.y) < 0.95 ? _a.set(0, 1, 0) : _a.set(1, 0, 0);
  const u = _b.crossVectors(dir, up).normalize();
  const v = _m.crossVectors(dir, u).normalize();
  const r = Math.sqrt(Math.random()) * Math.tan(spread), th = Math.random() * Math.PI * 2;
  return out.copy(dir).addScaledVector(u, Math.cos(th) * r).addScaledVector(v, Math.sin(th) * r).normalize();
}

export class Combat {
  constructor(game) {
    this.g = game;
    this.projectiles = [];
    this.fields = [];
  }

  // ------------------------------------------------------------ hit testing
  /** Ray vs fighters. Returns {t, f, head} or null. */
  rayFighters(shooter, ox, oy, oz, dx, dy, dz, maxT) {
    let best = null, bestT = maxT;
    for (const f of this.g.fighters) {
      if (!f.alive || f === shooter || f.mode === 'bus') continue;
      if (shooter && f.team === shooter.team) continue;
      // quick reject
      const px = f.pos.x - ox, pz = f.pos.z - oz;
      const along = px * dx + pz * dz;
      if (along < -1 || along > bestT + 1) continue;
      const crouch = f.crouch && f.mode === 'ground';
      const sky = f.mode === 'skydive';
      const headY = f.pos.y + (crouch ? 1.2 : sky ? 1.0 : 1.62);
      let t = raySphere(ox, oy, oz, dx, dy, dz, f.pos.x, headY, f.pos.z, 0.21);
      if (t >= 0 && t < bestT) { bestT = t; best = { t, f, head: true }; }
      const ys = crouch ? [0.35, 0.8] : sky ? [0.9] : [0.4, 0.82, 1.22];
      for (const y of ys) {
        t = raySphere(ox, oy, oz, dx, dy, dz, f.pos.x, f.pos.y + y, f.pos.z, 0.38);
        if (t >= 0 && t < bestT) { bestT = t; best = { t, f, head: false }; }
      }
    }
    return best;
  }

  /** Full trace: returns {t, point, normal, f, head} where f may be null (world hit) */
  trace(shooter, origin, dir, range) {
    const w = this.g.col.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, range);
    const wt = w ? w.t : range;
    const fh = this.rayFighters(shooter, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, wt);
    if (fh) return { t: fh.t, point: _hit.copy(origin).addScaledVector(dir, fh.t).clone(), normal: _p.copy(dir).negate().clone(), f: fh.f, head: fh.head };
    if (w) return { t: w.t, point: new THREE.Vector3(w.x, w.y, w.z), normal: new THREE.Vector3(w.nx, w.ny, w.nz), f: null };
    return { t: range, point: origin.clone().addScaledVector(dir, range), normal: null, f: null };
  }

  // ------------------------------------------------------------ guns
  /**
   * Fire the shooter's current gun.
   * aimOrigin/aimDir: the ray the shooter is aiming along (camera ray for the player, eyes for bots).
   * extraSpread: added cone (bots use it for inaccuracy).
   */
  fireGun(f, aimOrigin, aimDir, extraSpread = 0, spreadMul = 1) {
    const it = f.item, w = f.weapon;
    if (!w || f.fireCd > 0 || f.equipT > 0) return false;
    if (f.reloading) { if (w.id === 'shotgun' && it.mag > 0) f.cancelReload(); else return false; }
    if (it.mag <= 0) { f.startReload(); return false; }
    const rate = w.rate * (f.overdriveT > 0 ? 1.3 : 1);
    f.fireCd = 1 / rate;
    it.mag--;
    f.lastShotAt = this.g.time;
    const moving = Math.hypot(f.vel.x, f.vel.z) > 1 || !f.phys.grounded;
    let spread = ((f.ads ? w.ads : w.hip) + f.bloom + (moving ? w.moveSpread : 0)) * spreadMul + extraSpread;
    if (f.crouch) spread *= 0.75;
    f.bloom = Math.min(w.bloomMax, f.bloom + w.bloom);
    const muzzle = f.char ? f.char.muzzleWorld(new THREE.Vector3()) : new THREE.Vector3(f.pos.x, f.eyeY, f.pos.z);
    if (f.char) f.char.fire();
    const eye = _o.set(f.pos.x, f.eyeY, f.pos.z);
    const dmgBase = w.damage[it.rarity];
    const hitsByTarget = new Map();
    for (let p = 0; p < w.pellets; p++) {
      const d = spreadDir(aimDir, spread, new THREE.Vector3());
      let tr = this.trace(f, aimOrigin, d, w.range);
      // validate from the shooter's eyes (stops shooting around corners with the 3rd-person camera)
      if (f.isPlayer) {
        const to = tr.point.clone().sub(eye); const dist = to.length();
        if (dist > 0.3) {
          to.divideScalar(dist);
          const block = this.g.col.raycast(eye.x, eye.y, eye.z, to.x, to.y, to.z, dist - 0.1);
          if (block) tr = { t: block.t, point: new THREE.Vector3(block.x, block.y, block.z), normal: new THREE.Vector3(block.nx, block.ny, block.nz), f: null };
        }
      }
      if (p < 4 || w.pellets === 1) this.g.effects.tracer(muzzle, tr.point, w.tracer, w.id === 'sniper' ? 0.06 : 0.035, w.id === 'sniper' ? 0.25 : 0.08);
      if (tr.f) {
        const dist = tr.point.distanceTo(muzzle);
        let fall = 1;
        if (dist > w.falloffStart) fall = Math.max(w.falloffMin, 1 - (1 - w.falloffMin) * (dist - w.falloffStart) / Math.max(1, w.range - w.falloffStart));
        const dmg = dmgBase * fall * (tr.head ? w.head : 1);
        const rec = hitsByTarget.get(tr.f) || { dmg: 0, head: false, point: tr.point };
        rec.dmg += dmg; rec.head = rec.head || tr.head; rec.point = tr.point;
        hitsByTarget.set(tr.f, rec);
      } else if (tr.normal) {
        this.g.effects.impact(tr.point, tr.normal, 'world', w.tracer);
        if (Math.random() < 0.35) Audio.play('impact' + (1 + Math.floor(Math.random() * 3)), { pos: tr.point, vol: 0.35, range: 40 });
      }
    }
    for (const [target, rec] of hitsByTarget) this.damage(target, rec.dmg, f, { head: rec.head, point: rec.point, weapon: w.id });
    this.g.effects.muzzleFlash(muzzle, w.tracer, w.id === 'shotgun' ? 0.9 : w.id === 'sniper' ? 0.95 : w.id === 'smg' ? 0.5 : 0.62, aimDir);
    // spent casing out of the right-hand side (energy SMG has none)
    if (w.id !== 'smg') this.g.effects.shell(_p.set(f.pos.x + Math.sin(f.yaw) * 0.25, muzzle.y, f.pos.z + Math.cos(f.yaw) * 0.25), _a.set(-Math.cos(f.yaw), 0, Math.sin(f.yaw)));
    const snd = w.sound === 'sniper' ? 'sniper' : w.sound;
    Audio.play(snd, { pos: muzzle, vol: f.isPlayer ? 0.75 : 0.9, range: w.id === 'sniper' ? 260 : 160, near: 6, rate: w.id === 'smg' ? 1.25 : 1 });
    this.g.noise(f, muzzle, w.id === 'sniper' ? 160 : 90);
    if (f.isPlayer) this.g.onPlayerFired(w);
    if (it.mag <= 0) setTimeout(() => { if (f.alive && f.item === it) f.startReload(); }, 250);
    return true;
  }

  melee(f, dir) {
    if (f.swingCd > 0) return;
    f.swingCd = 0.55;
    if (f.char) f.char.swing();
    Audio.play('swing', { pos: f.pos, vol: 0.6, range: 25 });
    const o = new THREE.Vector3(f.pos.x, f.pos.y + 1.2, f.pos.z);
    setTimeout(() => {
      if (!f.alive) return;
      const hit = this.rayFighters(f, o.x, o.y, o.z, dir.x, dir.y * 0.3, dir.z, 2.3);
      if (hit) this.damage(hit.f, 20, f, { head: false, point: o.clone().addScaledVector(dir, hit.t), weapon: 'pickaxe' });
      else {
        const w = this.g.col.raycast(o.x, o.y, o.z, dir.x, 0, dir.z, 2.2);
        if (w) { this.g.effects.impact(new THREE.Vector3(w.x, w.y, w.z), new THREE.Vector3(w.nx, w.ny, w.nz)); Audio.play('impact1', { pos: f.pos, vol: 0.7, range: 25 }); }
      }
    }, 170);
  }

  // ------------------------------------------------------------ damage
  damage(target, amount, attacker, info = {}) {
    if (!target.alive || amount <= 0) return;
    const g = this.g;
    const res = target.takeDamage(amount, g.time);
    if (attacker) attacker.damageDealt += res.shieldDmg + res.healthDmg;
    const p = info.point || new THREE.Vector3(target.pos.x, target.pos.y + 1.2, target.pos.z);
    g.effects.impact(p, null, res.shieldDmg > 0 && res.healthDmg <= 0 ? 'shield' : 'flesh');
    if (res.shieldBroke) { Audio.play('shieldbreak', { pos: p, vol: 0.7, range: 50 }); g.effects.shieldBreak(p); }
    g.onDamage(target, attacker, res, info);
    if (target.bot) target.bot.onHurt(attacker);
    if (res.killed) g.eliminate(target, attacker, info);
  }

  // every elimination fully restores health and shield
  siphon(f) { if (f && f.alive) { f.health = 100; f.shield = MAX_SHIELD; } }

  // ------------------------------------------------------------ grenades
  throwGrenade(f, aimDir, power = 1) {
    const it = f.item;
    if (!it || it.kind !== 'grenade' || f.throwCd > 0) return false;
    f.throwCd = 0.7;
    it.count--;
    if (it.count <= 0) { f.slots[f.selected - 1] = null; f.selected = Math.max(0, f.slotOf(() => true)); if (f.selected < 0) f.selected = 0; }
    if (f.char) f.char.throwAnim();
    Audio.play('throw', { pos: f.pos, vol: 0.6, range: 30 });
    const start = new THREE.Vector3(f.pos.x, f.eyeY + 0.1, f.pos.z).addScaledVector(new THREE.Vector3(aimDir.x, 0, aimDir.z).normalize(), 0.6);
    const v = aimDir.clone().multiplyScalar(24 * power); v.y += 4.5;
    v.x += f.vel.x * 0.5; v.z += f.vel.z * 0.5;
    const mesh = this.g.factory.grenadeModel(it.id);
    mesh.position.copy(start);
    this.g.scene.add(mesh);
    this.projectiles.push({ id: it.id, owner: f, pos: start, vel: v, mesh, fuse: -1, age: 0, bounces: 0 });
    return true;
  }

  updateProjectiles(dt) {
    const col = this.g.col;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      p.vel.y -= 22 * dt;
      const step = p.vel.length() * dt;
      const dir = p.vel.clone().normalize();
      let detonate = false;
      const hit = col.raycast(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z, step + 0.08);
      // close to an enemy? (proximity trigger)
      for (const f of this.g.fighters) {
        if (!f.alive || f === p.owner || f.team === p.owner.team || f.mode !== 'ground' || p.age < 0.15) continue;
        const dx = f.pos.x - p.pos.x, dy = f.pos.y + 0.9 - p.pos.y, dz = f.pos.z - p.pos.z;
        if (dx * dx + dy * dy + dz * dz < 0.8) { detonate = true; break; }
      }
      if (hit && !detonate) {
        p.pos.set(hit.x + hit.nx * 0.06, hit.y + hit.ny * 0.06, hit.z + hit.nz * 0.06);
        if (p.id === 'shockwave') detonate = true;
        else {
          const n = new THREE.Vector3(hit.nx, hit.ny, hit.nz);
          p.vel.reflect(n).multiplyScalar(0.42);
          if (p.fuse < 0) p.fuse = GRENADES[p.id].fuse;
          if (p.bounces++ < 4) Audio.play('bounce', { pos: p.pos, vol: 0.5, range: 30 });
          if (p.vel.length() < 1) p.vel.set(0, 0, 0);
        }
      } else if (!detonate) p.pos.addScaledVector(p.vel, dt);
      if (p.fuse >= 0) { p.fuse -= dt; if (p.fuse <= 0) detonate = true; }
      if (p.age > 6) detonate = true;
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.x += dt * 9; p.mesh.rotation.z += dt * 5;
      if (Math.random() < 0.5) this.g.effects.emit(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, p.id === 'shockwave' ? 0x6cc8ff : 0xffe14d, 0.12, 0.25, 0);
      if (detonate) {
        this.g.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        if (p.id === 'shockwave') this.shockwave(p.pos, p.owner); else this.overdrive(p.pos, p.owner);
      }
    }
    // overdrive fields keep buffing allies inside
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const fl = this.fields[i];
      fl.t -= dt;
      if (fl.t <= 0) { this.fields.splice(i, 1); continue; }
      for (const f of this.g.fighters) {
        if (!f.alive || f.team !== fl.team) continue;
        if (f.pos.distanceToSquared(fl.pos) < fl.r * fl.r) {
          if (f.overdriveT <= 0 && f.isPlayer) this.g.onOverdrive(f);
          f.overdriveT = Math.max(f.overdriveT, GRENADES.overdrive.buffTime);
        }
      }
    }
  }

  /**
   * Shockwave (Fortnite-style mobility): pops at your feet the moment you use it and rockets you
   * up and forward in `dir` (your movement or look direction). Anyone else caught in the blast is
   * knocked away from you. No damage, and no fall damage until you land.
   */
  useShockwave(f, dir) {
    const it = f.item;
    if (!it || it.kind !== 'grenade' || it.id !== 'shockwave' || f.throwCd > 0 || f.mode !== 'ground') return false;
    f.throwCd = 0.55;
    it.count--;
    if (it.count <= 0) { f.slots[f.selected - 1] = null; const gun = f.slotOf(s => s.kind === 'gun'); f.selected = gun > 0 ? gun : 0; }
    if (f.char) f.char.throwAnim();
    const d = new THREE.Vector3(dir.x, 0, dir.z);
    if (d.lengthSq() < 1e-4) d.set(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    d.normalize();
    this.shockwave(new THREE.Vector3(f.pos.x, f.pos.y + 0.1, f.pos.z), f, d);
    return true;
  }

  shockwave(pos, owner, ownerDir = null) {
    const R = GRENADES.shockwave.radius;
    this.g.effects.shockwave(pos);
    Audio.play('shock', { pos, vol: 1, range: 120, near: 10 });
    for (const f of this.g.fighters) {
      if (!f.alive || f.mode === 'bus') continue;
      const dx = f.pos.x - pos.x, dz = f.pos.z - pos.z, dy = f.pos.y + 0.9 - pos.y;
      const d = Math.hypot(dx, dy, dz);
      if (d > R) continue;
      f.mode = 'ground';
      if (f === owner && ownerDir) {
        // the user: big boost up and forward, keeping a bit of the speed you already had
        f.vel.set(ownerDir.x * 18 + f.vel.x * 0.25, 19.5, ownerDir.z * 18 + f.vel.z * 0.25);
      } else {
        const h = Math.hypot(dx, dz);
        const nx = h > 0.3 ? dx / h : Math.sin(f.yaw), nz = h > 0.3 ? dz / h : Math.cos(f.yaw);
        const k = 1 - 0.35 * Math.min(1, d / R); // stronger near the centre
        f.vel.set(nx * 15 * k, 17 * k + 4, nz * 15 * k);
      }
      f.phys.grounded = false;
      f.pos.y += 0.15;
      f.noFallDamage = true; f.peakFallSpeed = 0;
      f.crouch = false;
      if (f.isPlayer) this.g.onLaunched(f);
    }
    this.g.noise(owner, pos, 70);
  }

  overdrive(pos, owner) {
    const G = GRENADES.overdrive;
    this.g.effects.overdriveBlast(pos, G.radius, G.fieldTime);
    Audio.play('zap', { pos, vol: 1, range: 110, near: 10 });
    Audio.play('explosion', { pos, vol: 0.7, range: 140, near: 10 });
    for (const f of this.g.fighters) {
      if (!f.alive || f.mode === 'bus') continue;
      const d = f.pos.distanceTo(pos);
      if (d > G.radius) continue;
      if (f.team === owner.team) {
        if (f.overdriveT <= 0 && f.isPlayer) this.g.onOverdrive(f);
        f.overdriveT = G.buffTime;
      } else if (this.g.col.clear(pos.x, pos.y + 0.3, pos.z, f.pos.x, f.pos.y + 1, f.pos.z)) {
        const dmg = G.damage * (1 - 0.6 * (d / G.radius));
        this.damage(f, dmg, owner, { head: false, weapon: 'overdrive' });
      }
    }
    this.fields.push({ pos: pos.clone(), r: G.radius, team: owner.team, t: G.fieldTime });
    this.g.noise(owner, pos, 90);
  }

  clear() {
    for (const p of this.projectiles) this.g.scene.remove(p.mesh);
    this.projectiles = []; this.fields = [];
  }
}
