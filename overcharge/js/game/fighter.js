// A combatant (the player or a bot): health, shield, inventory, weapon state and movement physics.
import * as THREE from 'three';
import { WEAPONS, GRENADES, AMMO_TYPES, HEALS, JETPACK, LOADOUT_ITEMS, LOADOUT_AMMO, normalizeLoadout } from '../data/items.js';
import {
  GRAVITY, PLAYER_RADIUS, PLAYER_HEIGHT, CROUCH_HEIGHT, STEP_HEIGHT,
  MAX_HEALTH, MAX_SHIELD, SHIELD_REGEN_DELAY, SHIELD_REGEN_RATE, MAP_HALF } from '../config.js';

export const SPEED = { run: 5.6, sprint: 7.3, crouch: 2.7, ads: 3.4, air: 0.35 };
const JUMP_V = 8.2;
const SLIDE_TIME = 0.95;
const _mv = new THREE.Vector3();

let NEXT_ID = 1;

export class Fighter {
  constructor({ name, team, isPlayer = false, skin = 'default', pickaxe = 'standard' }) {
    this.id = NEXT_ID++;
    this.name = name;
    this.team = team;
    this.isPlayer = isPlayer;
    this.skin = skin; this.pickaxe = pickaxe;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.phys = { grounded: false };
    this.yaw = 0; this.pitch = 0;
    this.health = MAX_HEALTH; this.shield = 0;
    this.lastHurt = -99;
    this.alive = true;
    this.mode = 'bus';     // bus | skydive | glide | ground | dead
    this.slots = [null, null, null, null, null];
    this.selected = 0;     // 0 = pickaxe, 1..5 = slots
    this.ammo = { light: 0, medium: 0, heavy: 0, shells: 0 };
    this.fireCd = 0; this.reloadT = 0; this.reloadDur = 0; this.bloom = 0;
    this.swingCd = 0; this.throwCd = 0; this.equipT = 0;
    this.crouch = false; this.sprint = false; this.ads = false;
    this.move = new THREE.Vector2();   // desired world-space move (x, z), magnitude 0..1
    this.wantJump = false;
    this.overdriveT = 0;
    this.healT = 0; this.healDur = 0;
    this.jetpack = false; this.fuel = JETPACK.fuel; this.jetHeld = false; this.thrusting = false; this.jetIdle = 0;
    this.noFallDamage = false;
    this.airTime = 0; this.peakFallSpeed = 0;
    this.kills = 0; this.damageDealt = 0; this.placement = 0;
    this.eliminatedBy = null;
    this.respawnT = -1;
    this.char = null;
    this.bot = null;
    this.lastShotAt = -99;
    this.spawnedAt = 0;
    this.stepT = 0;
    this.slideT = 0; this.slideCd = 0; this.slideSpeed = 0; this.slideDir = new THREE.Vector2();
    this.mantle = null;      // {t, dur, from, to} while climbing a ledge
    this.coyote = 0;         // short grace period to jump after running off an edge
    this.landK = 0;          // landing impact, decays (animation / camera)
  }

  get sliding() { return this.slideT > 0; }

  /** Start a slide: only out of a sprint, on the ground. */
  startSlide() {
    if (this.sliding || this.slideCd > 0 || this.mode !== 'ground' || !this.phys.grounded || this.healing) return false;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp < 5.2) return false;
    this.slideT = SLIDE_TIME; this.slideSpeed = Math.max(sp * 1.22, 9.4);
    this.slideDir.set(this.vel.x / sp, this.vel.z / sp);
    this.crouch = true; this.ads = false; this._inSlide = true;
    return true;
  }
  endSlide(stand = true) {
    if (!this.sliding && !this._inSlide) return;
    this._inSlide = false;
    this.slideT = 0; this.slideCd = 0.45;
    if (stand) this.crouch = false;
  }

  get height() { return this.crouch && this.mode === 'ground' ? CROUCH_HEIGHT : PLAYER_HEIGHT; }
  get item() { return this.selected === 0 ? null : this.slots[this.selected - 1]; }
  get weapon() { const it = this.item; return it && it.kind === 'gun' ? WEAPONS[it.id] : null; }
  get reloading() { return this.reloadT > 0; }
  get healing() { return this.healT > 0; }
  get eyeY() { return this.pos.y + (this.crouch && this.mode === 'ground' ? 1.15 : 1.58); }

  resetForMatch() {
    this.health = MAX_HEALTH; this.shield = 0;
    this.alive = true; this.mode = 'bus';
    this.slots = [null, null, null, null, null]; this.selected = 0;
    this.ammo = { light: 0, medium: 0, heavy: 0, shells: 0 };
    this.kills = 0; this.damageDealt = 0; this.placement = 0; this.eliminatedBy = null;
    this.overdriveT = 0; this.reloadT = 0; this.fireCd = 0; this.respawnT = -1; this.healT = 0; this.emote = null;
    this.slideT = 0; this.slideCd = 0; this.mantle = null; this.coyote = 0; this.landK = 0;
    this.jetpack = false; this.fuel = JETPACK.fuel; this.thrusting = false;
    this.vel.set(0, 0, 0);
  }

  /** Give the starting loadout in the given slot order. */
  giveLoadout(order) {
    const ids = normalizeLoadout(order);
    this.slots = ids.map(id => LOADOUT_ITEMS[id].make());
    for (const k in LOADOUT_AMMO) this.ammo[k] = Math.max(this.ammo[k] || 0, LOADOUT_AMMO[k]);
    const firstGun = this.slots.findIndex(s => s && s.kind === 'gun');
    this.selected = firstGun >= 0 ? firstGun + 1 : 0;
  }

  swapSlots(a, b) {
    if (a < 1 || b < 1 || a > 5 || b > 5 || a === b) return false;
    const t = this.slots[a - 1]; this.slots[a - 1] = this.slots[b - 1]; this.slots[b - 1] = t;
    if (this.selected === a) this.selected = b; else if (this.selected === b) this.selected = a;
    this.cancelReload(); this.healT = 0;
    return true;
  }

  // ------------------------------------------------------------ inventory
  hasEmptySlot() { return this.slots.some(s => !s); }

  /** Add an item. Returns {ok, dropped:[items], slot} */
  addItem(item, allowSwap = true) {
    const dropped = [];
    if (item.kind === 'ammo') { this.ammo[item.id] = Math.min(AMMO_TYPES[item.id].max, this.ammo[item.id] + item.count); return { ok: true, dropped }; }
    if (item.kind === 'jetpack') {
      // worn on your back, not in the hotbar; a second one just refuels
      if (!this.jetpack) { this.jetpack = true; this.fuel = JETPACK.fuel; return { ok: true, dropped, jetpack: true }; }
      if (this.fuel < JETPACK.fuel - 1) { this.fuel = JETPACK.fuel; return { ok: true, dropped }; }
      return { ok: false, dropped };
    }
    if (item.kind === 'grenade' || item.kind === 'heal') {
      const stackOf = it => (it.kind === 'grenade' ? GRENADES : HEALS)[it.id].stack;
      let left = item.count;
      for (const s of this.slots) {
        if (s && s.kind === item.kind && s.id === item.id && s.count < stackOf(s)) {
          const add = Math.min(left, stackOf(s) - s.count); s.count += add; left -= add;
          if (!left) return { ok: true, dropped };
        }
      }
      item = { ...item, count: left };
    }
    const empty = this.slots.findIndex(s => !s);
    if (empty >= 0) { this.slots[empty] = item; return { ok: true, dropped, slot: empty + 1 }; }
    if (!allowSwap) return { ok: false, dropped };
    const idx = this.selected > 0 ? this.selected - 1 : 0;
    dropped.push(this.slots[idx]);
    this.slots[idx] = item;
    this.cancelReload();
    return { ok: true, dropped, slot: idx + 1 };
  }

  select(i) {
    if (i === this.selected || i < 0 || i > 5) return false;
    if (i > 0 && !this.slots[i - 1]) return false;
    this.selected = i;
    this.cancelReload();
    this.healT = 0;
    this.equipT = 0.3;
    this.ads = false;
    return true;
  }

  cancelReload() { this.reloadT = 0; }

  /** Best slot for a given situation (bots + auto-switch). */
  slotOf(pred) { const i = this.slots.findIndex(s => s && pred(s)); return i < 0 ? -1 : i + 1; }

  canReload() {
    const it = this.item; const w = this.weapon;
    return w && !this.reloading && it.mag < w.mag && this.ammo[w.ammo] > 0;
  }

  startReload() {
    if (!this.canReload()) return false;
    const it = this.item, w = this.weapon;
    let dur = w.reload[it.rarity];
    if (this.overdriveT > 0) dur *= 0.6;
    this.reloadT = dur; this.reloadDur = dur; this.ads = this.isPlayer ? this.ads : false;
    return true;
  }

  finishReload() {
    const it = this.item, w = this.weapon;
    if (!w) return;
    if (w.id === 'shotgun') {
      // shell-by-shell feel: fills fully but we reload faster when only a few shells are missing
      const need = w.mag - it.mag, take = Math.min(need, this.ammo[w.ammo]);
      it.mag += take; this.ammo[w.ammo] -= take;
    } else {
      const need = w.mag - it.mag, take = Math.min(need, this.ammo[w.ammo]);
      it.mag += take; this.ammo[w.ammo] -= take;
    }
  }

  canHeal() { const it = this.item; return it && it.kind === 'heal' && !this.healing && this.health < 100 && this.alive; }

  startHeal() {
    if (!this.canHeal()) return false;
    this.healDur = this.healT = HEALS[this.item.id].useTime;
    this.ads = false; this.cancelReload();
    return true;
  }

  finishHeal() {
    const it = this.item;
    if (!it || it.kind !== 'heal') return;
    this.health = Math.min(100, this.health + HEALS[it.id].heal);
    it.count--;
    if (it.count <= 0) {
      this.slots[this.selected - 1] = null;
      const gun = this.slotOf(s => s.kind === 'gun');
      this.selected = gun > 0 ? gun : 0;
    }
  }

  // ------------------------------------------------------------ damage
  /** Returns {shieldDmg, healthDmg, killed} */
  takeDamage(amount, now) {
    if (!this.alive) return { shieldDmg: 0, healthDmg: 0, killed: false };
    let sd = 0, hd = 0;
    if (this.shield > 0) { sd = Math.min(this.shield, amount); this.shield -= sd; amount -= sd; }
    if (amount > 0) { hd = Math.min(this.health, amount); this.health -= hd; }
    this.lastHurt = now;
    const killed = this.health <= 0.0001;
    if (killed) this.health = 0;
    return { shieldDmg: sd, healthDmg: hd, killed, shieldBroke: sd > 0 && this.shield <= 0 };
  }

  heal(amount) {
    const h = Math.min(MAX_HEALTH - this.health, amount); this.health += h; amount -= h;
    this.shield = Math.min(MAX_SHIELD, this.shield + amount);
  }

  // ------------------------------------------------------------ per-frame
  tickStatus(dt, now) {
    if (!this.alive) return;
    if (this.overdriveT > 0) this.overdriveT -= dt;
    const regenDelay = this.overdriveT > 0 ? 1.5 : SHIELD_REGEN_DELAY;
    if (now - this.lastHurt > regenDelay && this.shield < MAX_SHIELD) {
      this.shield = Math.min(MAX_SHIELD, this.shield + (SHIELD_REGEN_RATE + (this.overdriveT > 0 ? 8 : 0)) * dt);
    }
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.swingCd > 0) this.swingCd -= dt;
    if (this.throwCd > 0) this.throwCd -= dt;
    if (this.equipT > 0) this.equipT -= dt;
    const w = this.weapon;
    if (w) this.bloom = Math.max(0, this.bloom - dt * (w.bloomMax * 4 + 0.02));
    if (this.healT > 0) {
      const it = this.item;
      if (!it || it.kind !== 'heal') this.healT = 0;
      else { this.healT -= dt; if (this.healT <= 0) { this.healT = 0; this.finishHeal(); this.justHealed = true; } }
    }
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.reloadT = 0; this.finishReload(); }
    }
  }

  /** A ledge in front (dx,dz unit) that can be climbed from the air: {from, to, dur, dx, dz} or null. */
  findMantle(world, dx, dz) {
    const feet = this.pos.y, R = PLAYER_RADIUS;
    // something solid in front at chest height?
    const hit = world.raycast(this.pos.x, feet + 1.0, this.pos.z, dx, 0, dz, R + 0.45);
    if (!hit) return null;
    const px = this.pos.x + dx * (hit.t + 0.42), pz = this.pos.z + dz * (hit.t + 0.42);
    const top = world.groundHeight(px, pz, 0.18, feet + 2.25, 0);
    const rise = top - feet;
    if (rise < 0.75 || rise > 2.25) return null;
    if (!world.isFree(px, top, pz, R * 0.9, PLAYER_HEIGHT)) return null;                 // room to stand on top
    if (!world.isFree(this.pos.x, feet + 0.1, this.pos.z, R * 0.8, rise + PLAYER_HEIGHT)) return null; // headroom on the way up
    return { t: 0, dur: 0.24 + rise * 0.1, from: this.pos.clone(), to: _mv.set(px, top, pz).clone(), dx, dz };
  }

  /** Movement physics. Returns events {landed, fallDamage, deploy, jumped, mantle} */
  simulate(dt, world, groundAt) {
    const ev = {};
    const od = this.overdriveT > 0 ? 1.25 : 1;
    if (this.mode === 'skydive' || this.mode === 'glide') {
      const glide = this.mode === 'glide';
      const maxH = glide ? 13 : 20, fall = glide ? 6.5 : 26;
      const dive = !glide && this.pitch < -0.6 ? 1.45 : 1;
      const tx = this.move.x * maxH, tz = this.move.y * maxH;
      const k = Math.min(1, dt * (glide ? 1.6 : 1.2));
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.z += (tz - this.vel.z) * k;
      this.vel.y += (-fall * dive - this.vel.y) * Math.min(1, dt * 2.5);
      this.pos.addScaledVector(this.vel, dt);
      const lim = Math.min(world.half - 3, MAP_HALF - 1.5);   // never above the perimeter wall
      this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x)); this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
      const g = groundAt(this.pos.x, this.pos.z, this.pos.y);
      if (!glide && this.pos.y - g < 42) { this.mode = 'glide'; ev.deploy = true; }
      if (this.pos.y <= g + 0.05) { this.pos.y = g; this.mode = 'ground'; this.vel.set(0, 0, 0); this.phys.grounded = true; ev.landed = true; this.noFallDamage = false; }
      // keep out of walls while gliding low
      world.pushOut(this.pos, PLAYER_RADIUS, PLAYER_HEIGHT);
      return ev;
    }
    if (this.mode !== 'ground') return ev;
    if (this.slideCd > 0) this.slideCd -= dt;
    if (this.landK > 0) this.landK = Math.max(0, this.landK - dt * 3.2);
    // ---- climbing a ledge: a short scripted move up and over
    if (this.mantle) {
      const m = this.mantle;
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      const up = Math.min(1, k / 0.62), fw = Math.max(0, (k - 0.45) / 0.55);
      const eu = 1 - (1 - up) * (1 - up), ef = fw * fw * (3 - 2 * fw);
      this.pos.set(m.from.x + (m.to.x - m.from.x) * ef, m.from.y + (m.to.y - m.from.y) * eu, m.from.z + (m.to.z - m.from.z) * ef);
      this.vel.set(0, 0, 0); this.thrusting = false; this.wantJump = false; this.peakFallSpeed = 0;
      if (k >= 1) { this.mantle = null; this.phys.grounded = true; this.vel.set(m.dx * 2.5, 0, m.dz * 2.5); }
      return ev;
    }
    // ---- ground movement
    let speed = SPEED.run;
    if (this.crouch) speed = SPEED.crouch;
    else if (this.ads) speed = SPEED.ads;
    else if (this.sprint) speed = SPEED.sprint;
    speed *= od;
    if (this.healing) speed *= 0.45;
    const mag = Math.min(1, Math.hypot(this.move.x, this.move.y));
    const tx = this.move.x * speed, tz = this.move.y * speed;
    const grounded = this.phys.grounded;
    this.coyote = grounded ? 0.12 : Math.max(0, this.coyote - dt);
    const accel = grounded ? (mag > 0.05 ? 14 : 18) : 2.2;
    const k = Math.min(1, dt * accel);
    if (this.sliding) {
      // slide: carried by momentum that bleeds off, steerable a little
      this.slideT -= dt;
      this.slideSpeed = Math.max(0, this.slideSpeed - 5.2 * dt);
      if (mag > 0.2) {
        const st = Math.min(1, dt * 1.6);
        this.slideDir.x += (this.move.x / mag - this.slideDir.x) * st; this.slideDir.y += (this.move.y / mag - this.slideDir.y) * st;
        const l = Math.hypot(this.slideDir.x, this.slideDir.y) || 1; this.slideDir.x /= l; this.slideDir.y /= l;
      }
      this.vel.x = this.slideDir.x * this.slideSpeed * od; this.vel.z = this.slideDir.y * this.slideSpeed * od;
      const blocked = Math.hypot(this.pos.x - (this._sx ?? this.pos.x), this.pos.z - (this._sz ?? this.pos.z)) < this.slideSpeed * dt * 0.3;
      this._sx = this.pos.x; this._sz = this.pos.z;
      if (this.slideT <= 0 || this.slideSpeed < 4.2 || !grounded && this.vel.y < -6 || (blocked && this.slideT < SLIDE_TIME - 0.12)) this.endSlide();
    } else if (!grounded && this.noFallDamage) {
      // launched by a shockwave: keep your speed, the joystick only steers it
      if (mag > 0.05) {
        const hs = Math.max(Math.hypot(this.vel.x, this.vel.z), speed);
        const sk = Math.min(1, dt * 2.4);
        this.vel.x += (this.move.x / mag * hs - this.vel.x) * sk;
        this.vel.z += (this.move.y / mag * hs - this.vel.z) * sk;
      }
    } else if (grounded || mag > 0.05) {
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.z += (tz - this.vel.z) * k;
    }
    // jetpack: hold jump while airborne to thrust upward
    this.thrusting = false;
    if (this.jetpack && this.jetHeld && this.fuel > 0 && (!grounded || this.wantJump)) {
      if (!grounded) {
        this.thrusting = true;
        const alt = this.pos.y - groundAt(this.pos.x, this.pos.z, this.pos.y);
        const cap = alt > 24 ? 0.5 : JETPACK.maxUp; // flight ceiling ~24 m above the ground
        this.vel.y = Math.min(cap, this.vel.y + (JETPACK.thrust + (this.vel.y < 0 ? 20 : 0)) * dt);
        this.fuel = Math.max(0, this.fuel - JETPACK.burn * dt);
        this.jetIdle = 0; this.crouch = false;
        this.peakFallSpeed = 0;
        // better air steering while flying
        const jk = Math.min(1, dt * 5);
        this.vel.x += (tx * 1.15 - this.vel.x) * jk; this.vel.z += (tz * 1.15 - this.vel.z) * jk;
      }
    } else if (this.jetpack) {
      this.jetIdle += dt;
      if (grounded && this.jetIdle > JETPACK.regenDelay) this.fuel = Math.min(JETPACK.fuel, this.fuel + JETPACK.regen * dt);
    }
    if (this.wantJump && (grounded || (this.coyote > 0 && this.vel.y <= 0))) {
      this.vel.y = JUMP_V; this.phys.grounded = false; ev.jumped = true; this.coyote = 0;
      if (this.sliding) { this.endSlide(); ev.slideJump = true; }   // slide-jump: the slide's speed carries into the air
      if (this.crouch) this.crouch = false;
    }
    this.wantJump = false;
    // mantle: in the air, pushing into a ledge you can reach → climb it
    if (!this.phys.grounded && !this.thrusting && mag > 0.3 && this.vel.y < 5.5 && this.vel.y > -14) {
      const m = this.findMantle(world, this.move.x / mag, this.move.y / mag);
      if (m) { this.mantle = m; ev.mantle = true; this.crouch = false; this.endSlide(); return ev; }
    }
    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -55) this.vel.y = -55;
    if (!this.phys.grounded) this.peakFallSpeed = Math.max(this.peakFallSpeed, -this.vel.y);
    const landed = world.moveCharacter(this.pos, this.vel, dt, PLAYER_RADIUS, this.height, STEP_HEIGHT, this.phys);
    if (landed) {
      ev.landed = true;
      const v = this.peakFallSpeed;
      this.landK = Math.min(1, Math.max(this.landK, v / 16));
      if (v > 17.5 && !this.noFallDamage && !this.jetpack) ev.fallDamage = Math.round((v - 17.5) * 7); // jetpacks soften landings
      this.noFallDamage = false;
      this.peakFallSpeed = 0;
    }
    if (this.phys.grounded) this.peakFallSpeed = 0;
    return ev;
  }
}
