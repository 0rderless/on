// A combatant (the player or a bot): health, shield, inventory, weapon state and movement physics.
import * as THREE from 'three';
import { WEAPONS, GRENADES, AMMO_TYPES } from '../data/items.js';
import {
  GRAVITY, PLAYER_RADIUS, PLAYER_HEIGHT, CROUCH_HEIGHT, STEP_HEIGHT,
  MAX_HEALTH, MAX_SHIELD, SHIELD_REGEN_DELAY, SHIELD_REGEN_RATE,
} from '../config.js';

export const SPEED = { run: 5.6, sprint: 7.3, crouch: 2.7, ads: 3.4, air: 0.35 };
const JUMP_V = 8.2;

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
  }

  get height() { return this.crouch && this.mode === 'ground' ? CROUCH_HEIGHT : PLAYER_HEIGHT; }
  get item() { return this.selected === 0 ? null : this.slots[this.selected - 1]; }
  get weapon() { const it = this.item; return it && it.kind === 'gun' ? WEAPONS[it.id] : null; }
  get reloading() { return this.reloadT > 0; }
  get eyeY() { return this.pos.y + (this.crouch && this.mode === 'ground' ? 1.15 : 1.58); }

  resetForMatch() {
    this.health = MAX_HEALTH; this.shield = 0;
    this.alive = true; this.mode = 'bus';
    this.slots = [null, null, null, null, null]; this.selected = 0;
    this.ammo = { light: 0, medium: 0, heavy: 0, shells: 0 };
    this.kills = 0; this.damageDealt = 0; this.placement = 0; this.eliminatedBy = null;
    this.overdriveT = 0; this.reloadT = 0; this.fireCd = 0; this.respawnT = -1;
    this.vel.set(0, 0, 0);
  }

  // ------------------------------------------------------------ inventory
  hasEmptySlot() { return this.slots.some(s => !s); }

  /** Add an item. Returns {ok, dropped:[items], slot} */
  addItem(item, allowSwap = true) {
    const dropped = [];
    if (item.kind === 'ammo') { this.ammo[item.id] = Math.min(AMMO_TYPES[item.id].max, this.ammo[item.id] + item.count); return { ok: true, dropped }; }
    if (item.kind === 'grenade') {
      let left = item.count;
      for (const s of this.slots) {
        if (s && s.kind === 'grenade' && s.id === item.id && s.count < GRENADES[s.id].stack) {
          const add = Math.min(left, GRENADES[s.id].stack - s.count); s.count += add; left -= add;
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
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.reloadT = 0; this.finishReload(); }
    }
  }

  /** Movement physics. Returns events {landed, fallDamage, deploy} */
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
      const lim = world.half - 3;
      this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x)); this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
      const g = groundAt(this.pos.x, this.pos.z, this.pos.y);
      if (!glide && this.pos.y - g < 42) { this.mode = 'glide'; ev.deploy = true; }
      if (this.pos.y <= g + 0.05) { this.pos.y = g; this.mode = 'ground'; this.vel.set(0, 0, 0); this.phys.grounded = true; ev.landed = true; this.noFallDamage = false; }
      // keep out of walls while gliding low
      world.pushOut(this.pos, PLAYER_RADIUS, PLAYER_HEIGHT);
      return ev;
    }
    if (this.mode !== 'ground') return ev;
    // ---- ground movement
    let speed = SPEED.run;
    if (this.crouch) speed = SPEED.crouch;
    else if (this.ads) speed = SPEED.ads;
    else if (this.sprint) speed = SPEED.sprint;
    speed *= od;
    const mag = Math.min(1, Math.hypot(this.move.x, this.move.y));
    const tx = this.move.x * speed, tz = this.move.y * speed;
    const grounded = this.phys.grounded;
    const accel = grounded ? (mag > 0.05 ? 14 : 18) : (this.noFallDamage ? 0.8 : 2.2);
    const k = Math.min(1, dt * accel);
    if (grounded || mag > 0.05) {
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.z += (tz - this.vel.z) * k;
    }
    if (this.wantJump && grounded) {
      this.vel.y = JUMP_V; this.phys.grounded = false; ev.jumped = true;
      if (this.crouch) this.crouch = false;
    }
    this.wantJump = false;
    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -55) this.vel.y = -55;
    if (!this.phys.grounded) this.peakFallSpeed = Math.max(this.peakFallSpeed, -this.vel.y);
    const landed = world.moveCharacter(this.pos, this.vel, dt, PLAYER_RADIUS, this.height, STEP_HEIGHT, this.phys);
    if (landed) {
      ev.landed = true;
      const v = this.peakFallSpeed;
      if (v > 17.5 && !this.noFallDamage) ev.fallDamage = Math.round((v - 17.5) * 7);
      this.noFallDamage = false;
      this.peakFallSpeed = 0;
    }
    if (this.phys.grounded) this.peakFallSpeed = 0;
    return ev;
  }
}
