// Bot AI. Designed to feel like real players: imperfect, reaction-limited aim that settles while
// tracking, weapon choice by range, strafing, jump/crouch habits, looting, storm rotations,
// cover-seeking when shields break, grenade usage and memory of enemies they lost sight of.
import * as THREE from 'three';
import { WEAPONS } from '../data/items.js';
import { EMOTES } from './emotes.js';

const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const TAU = Math.PI * 2;
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function rnd(a, b) { return a + Math.random() * (b - a); }

const FIRST = ['Night', 'Volt', 'Lunar', 'Ghost', 'Frost', 'Hex', 'Nova', 'Raze', 'Echo', 'Kai', 'Zen', 'Blaze', 'Sly', 'Mako', 'Rift', 'Onyx', 'Pixel', 'Viper', 'Jinx', 'Storm', 'Ash', 'Neo', 'Vex', 'Koda', 'Juno', 'Rook', 'Lyric', 'Saber', 'Arc', 'Drift'];
const SECOND = ['Fox', 'Wolf', 'Byte', 'Shade', 'Rider', 'Hawk', 'Spark', 'Fang', 'Pulse', 'Strike', 'Lynx', 'Bolt', 'Rogue', 'Mist', 'Comet', 'Grim', 'Ray', 'Stack', 'Knight', 'Wave'];
const SINGLE = ['kxlz', 'zyphr', 'mxrcy', 'jaydn', 'sweatymango', 'notbenji', 'lilpeanut', 'yeetlord', 'aim_assist', 'tryhard_tim', 'blu3berry', 'sh0ckz', 'ok_boomer', 'clutchgod', 'noscope_nora', 'pizzarolls', 'meltz', 'R3X', 'Tsunami', 'crankd', 'Vortexx', 'ghostie', 'boxedlike', 'sk8rboi', 'ttv_reload'];
export function botName(used) {
  for (let i = 0; i < 50; i++) {
    let n;
    const k = Math.random();
    if (k < 0.35) n = FIRST[Math.floor(Math.random() * FIRST.length)] + SECOND[Math.floor(Math.random() * SECOND.length)];
    else if (k < 0.55) n = SINGLE[Math.floor(Math.random() * SINGLE.length)];
    else if (k < 0.75) n = FIRST[Math.floor(Math.random() * FIRST.length)] + (Math.random() < 0.5 ? '_' : '') + Math.floor(Math.random() * 999);
    else if (k < 0.88) n = 'x' + FIRST[Math.floor(Math.random() * FIRST.length)] + SECOND[Math.floor(Math.random() * SECOND.length)] + 'x';
    else n = (Math.random() < 0.5 ? 'TTV_' : 'YT_') + FIRST[Math.floor(Math.random() * FIRST.length)] + SECOND[Math.floor(Math.random() * SECOND.length)];
    if (n.length > 16) n = n.slice(0, 16);
    if (!used.has(n.toLowerCase())) { used.add(n.toLowerCase()); return n; }
  }
  return 'Player' + Math.floor(Math.random() * 99999);
}

export class BotBrain {
  constructor(f, game, skill) {
    this.f = f; this.g = game;
    this.skill = Math.max(0.05, Math.min(1, skill + rnd(-0.1, 0.1)));
    const s = this.skill;
    this.pers = {
      aggression: rnd(0.25, 1),
      jumpy: Math.random() < 0.45 ? rnd(0.3, 1) : 0.05,
      crouchy: Math.random() < 0.4 ? rnd(0.3, 1) : 0.05,
      camper: Math.random() < 0.3 ? rnd(0.4, 1) : 0.1,
      looter: rnd(0.4, 1),
    };
    this.reaction = 0.78 - 0.5 * s + rnd(-0.05, 0.08);
    this.turnSpeed = 2.4 + 7.5 * s;
    this.vision = 62 + 55 * s;
    this.state = 'drop';
    this.target = null; this.targetSeenAt = -99; this.lastKnown = new THREE.Vector3(); this.trackT = 0;
    this.aimErr = new THREE.Vector2();
    this.path = null; this.pathIdx = 0; this.pathGoal = new THREE.Vector3(); this.pathPending = false; this.repathAt = 0;
    this.goal = null; // {x,z, type, rec}
    this.thinkT = Math.random() * 0.5; this.perceiveT = Math.random() * 0.3;
    this.strafe = 1; this.strafeT = 0; this.jumpT = rnd(1, 3); this.crouchT = 0;
    this.stuckT = 0; this.lastPos = new THREE.Vector3(); this.stuckCheckT = 0;
    this.heard = null; this.heardAt = -99;
    this.chestT = 0; this.holdT = 0; this.holdUntil = 0;
    this.switchCd = 0; this.nadeCd = rnd(3, 8);
    this.coverPoint = null; this.coverUntil = 0;
    this.lookYaw = f.yaw; this.lookPitch = 0;
    this.dropTarget = null; this.jumpDist = rnd(20, 70);
    this.burstLeft = 0; this.burstPause = 0;
    this.celebrateT = 0; this.emoteWait = 0; this.emoteUntil = 0;
    this.followLeader = null; this.slot = 0;
  }

  // -------------------------------------------------------------- events
  onHurt(attacker) {
    if (!attacker || attacker === this.f || attacker.team === this.f.team) return;
    if (!this.target || !this.target.alive || this.g.time - this.targetSeenAt > 1.5) {
      this.target = attacker; this.targetSeenAt = this.g.time - 0.3;
      this.lastKnown.copy(attacker.pos);
      this.trackT = 0;
      this.aimErr.set(rnd(-0.4, 0.4), rnd(-0.15, 0.15));
    }
    if (this.f.emote) this.g.stopEmote(this.f);
    this.emoteWait = 0;
    // panic jump/crouch habits
    if (Math.random() < this.pers.jumpy * 0.5) this.f.wantJump = true;
  }

  hear(src, pos) {
    if (src === this.f || (src && src.team === this.f.team)) return;
    this.heard = pos.clone(); this.heardAt = this.g.time;
    if (src && (!this.target || !this.target.alive)) { this.lastKnown.copy(pos); }
  }

  /** True for a bot on the human player's team (they escort the player instead of doing their own thing). */
  get mate() { const L = this.followLeader; return !!(L && L.isPlayer && L.alive); }

  /** Formation slot beside / behind the leader. */
  slotPos() {
    const L = this.followLeader, a = L.yaw + Math.PI + [-0.75, 0.75, 0][this.slot % 3], r = 4.2 + (this.slot > 2 ? 2 : 0);
    return { x: L.pos.x + Math.sin(a) * r, z: L.pos.z + Math.cos(a) * r };
  }

  /** Focus an enemy the player is fighting (called when the player hits someone or gets hit). */
  assist(enemy) {
    if (!enemy || !enemy.alive || enemy.team === this.f.team || !this.f.alive) return;
    const g = this.g;
    if (this.target && this.target.alive && this.target !== enemy && g.time - this.targetSeenAt < 0.6 && this.target.pos.distanceTo(this.f.pos) < 12) return; // busy with someone on top of us
    if (this.target !== enemy) { this.trackT = 0; this.aimErr.set(rnd(-0.2, 0.2), rnd(-0.1, 0.1)); }
    this.target = enemy; this.targetSeenAt = g.time; this.lastKnown.copy(enemy.pos); this.trackT = Math.max(this.trackT, this.reaction * 0.5);
    this.state = 'fight'; this.emoteWait = 0; if (this.f.emote) g.stopEmote(this.f);
  }

  onKill(victim) {
    const r = Math.random();
    if (r < 0.25 * this.pers.crouchy + 0.05) this.celebrateT = 1.2; // the classic crouch-spam
    else if (r < 0.25 * this.pers.crouchy + 0.3) this.emoteWait = rnd(0.6, 1.4); // or hit a dance
    this.target = null;
  }

  // -------------------------------------------------------------- helpers
  enemiesNear(maxD) {
    const out = [];
    for (const o of this.g.fighters) {
      if (!o.alive || o.team === this.f.team || o.mode === 'bus') continue;
      const d = o.pos.distanceTo(this.f.pos);
      if (d < maxD) out.push([o, d]);
    }
    return out;
  }

  canSee(o, d) {
    const f = this.f;
    if (d > this.vision * (o.crouch ? 0.75 : 1)) return false;
    if (o.mode === 'skydive' || o.mode === 'glide') { if (d > 90) return false; }
    const dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z;
    const fwdx = Math.sin(this.lookYaw), fwdz = Math.cos(this.lookYaw);
    const dot = (dx * fwdx + dz * fwdz) / Math.max(0.01, Math.hypot(dx, dz));
    if (d > 7 && dot < 0.26) return false; // ~150° field of view
    const ty = o.pos.y + (o.crouch ? 0.9 : 1.3);
    return this.g.col.clear(f.pos.x, f.eyeY, f.pos.z, o.pos.x, ty, o.pos.z);
  }

  inStorm(x, z, margin = 0) { const s = this.g.storm; return Math.hypot(x - s.cx, z - s.cz) > s.r - margin; }

  setGoal(x, z, type, rec = null) {
    if (this.goal && this.goal.type === type && Math.hypot(this.goal.x - x, this.goal.z - z) < 2) return;
    this.goal = { x, z, type, rec };
    this.requestPath(x, z);
  }

  requestPath(x, z) {
    this.pathGoal.set(x, 0, z);
    if (this.pathPending) return;
    this.pathPending = true;
    this.g.requestPath(this, this.f.pos.x, this.f.pos.z, x, z);
  }
  onPath(path) { this.pathPending = false; this.path = path; this.pathIdx = 0; this.repathAt = this.g.time + 6; }

  bestGunFor(dist) {
    let best = -1, bestScore = -1e9;
    this.f.slots.forEach((s, i) => {
      if (!s || s.kind !== 'gun') return;
      const w = WEAPONS[s.id];
      if (s.mag <= 0 && this.f.ammo[w.ammo] <= 0) return;
      const [lo, hi] = w.botRange;
      let fit = dist < lo ? -(lo - dist) * 1.5 : dist > hi ? -(dist - hi) * 0.5 : 10;
      if (w.id === 'sniper' && dist < 25) fit -= 25;
      if (s.mag <= 0) fit -= 6;
      const score = fit + s.rarity * 2;
      if (score > bestScore) { bestScore = score; best = i + 1; }
    });
    return best;
  }

  gunCount() { return this.f.slots.filter(s => s && s.kind === 'gun').length; }

  wantsItem(item) {
    const f = this.f;
    if (item.kind === 'ammo') return true;
    if (item.kind === 'jetpack') return !f.jetpack;
    if (item.kind === 'grenade' || item.kind === 'heal') return f.hasEmptySlot() || f.slots.some(s => s && s.kind === item.kind && s.id === item.id && s.count < 3);
    if (f.hasEmptySlot()) return true;
    // swap only for an upgrade of a same-type or worse gun
    return f.slots.some(s => s && s.kind === 'gun' && (s.id === item.id ? item.rarity > s.rarity : item.rarity >= s.rarity + 2));
  }

  // -------------------------------------------------------------- main update
  update(dt) {
    const f = this.f, g = this.g;
    if (!f.alive) return;
    if (f.mode === 'bus') return;
    if (f.mode === 'skydive' || f.mode === 'glide') { this.updateAir(dt); return; }
    this.jetT = (this.jetT || 0) - dt;
    // squad mates take off when you do, and jet up to you when you're on higher ground
    let flyWith = false;
    if (this.mate && f.jetpack) {
      const L = this.followLeader;
      if (L.mode === 'ground') {
        const up = L.pos.y - f.pos.y, d = Math.hypot(L.pos.x - f.pos.x, L.pos.z - f.pos.z);
        const want = L.thrusting || (!L.phys.grounded && up > 1.2) || (up > 2.6 && d < 14);
        if (want && d < 70 && f.fuel > (f.phys.grounded ? 25 : 4) && up > -1.5) { flyWith = true; this.jetT = 0.2; if (f.phys.grounded) f.wantJump = true; }
      }
    }
    f.jetHeld = this.jetT > 0 && f.jetpack;
    this.switchCd -= dt; this.nadeCd -= dt;

    // ---- perception
    this.perceiveT -= dt;
    if (this.perceiveT <= 0) {
      this.perceiveT = 0.32 - this.skill * 0.18 + Math.random() * 0.08;
      this.perceive();
    }
    // ---- decisions
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.45 + Math.random() * 0.3; this.decide(); }

    // ---- act
    f.move.set(0, 0); f.sprint = false;
    let lookAtX = null, lookAtZ = null, lookAtY = null;
    // ---- post-elimination dance (bails the moment someone shows up)
    if (this.emoteWait > 0 || f.emote) {
      const threat = this.target && this.target.alive && g.time - this.targetSeenAt < 0.5;
      if (threat || f.healing) { this.emoteWait = 0; if (f.emote) g.stopEmote(f); }
      else if (!f.emote) {
        this.emoteWait -= dt;
        if (this.emoteWait <= 0 && f.mode === 'ground') { g.startEmote(f, EMOTES[Math.floor(Math.random() * EMOTES.length)].id); this.emoteUntil = g.time + rnd(2.5, 5); }
        return this.applyLook(dt);
      } else {
        if (g.time > this.emoteUntil) g.stopEmote(f);
        return this.applyLook(dt);
      }
    }
    if (this.celebrateT > 0) {
      this.celebrateT -= dt;
      f.crouch = Math.floor(this.celebrateT * 6) % 2 === 0;
      return this.applyLook(dt);
    }
    const tgt = this.target && this.target.alive ? this.target : null;
    const seen = tgt && g.time - this.targetSeenAt < 0.35;

    // ---- healing: hunker down, bail out if someone pushes us
    if (f.healing) {
      f.crouch = true;
      if (seen && tgt.pos.distanceTo(f.pos) < 20) { f.healT = 0; this.switchCd = 0; this.equipBest(tgt.pos.distanceTo(f.pos)); }
      else { this.lookYaw += Math.sin(g.time * 0.9 + f.id) * dt * 0.6; return this.applyLook(dt); }
    } else if (this.wantHeal()) {
      f.select(f.slotOf(s => s.kind === 'heal')); f.equipT = 0;
      f.startHeal();
      return this.applyLook(dt);
    } else if (f.item && f.item.kind === 'heal' && this.gunCount() > 0) { this.switchCd = 0; this.equipBest(30); }

    if (this.state === 'fight' && tgt) {
      this.fight(dt, tgt, seen);
      return;
    }
    // non-combat movement
    f.crouch = false;
    if (flyWith || (this.mate && !f.phys.grounded && this.followLeader.mode === 'ground')) {
      const sp = this.slotPos(), dx = sp.x - f.pos.x, dz = sp.z - f.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.5) { f.move.set(dx / d, dz / d); f.sprint = true; this.lookYaw = this.turnToward(this.lookYaw, Math.atan2(dx, dz), dt * 6); }
      this.lookPitch *= 0.9;
      return this.applyLook(dt);
    }
    if (this.state === 'escort') {
      // in position: cover the squad — watch where the leader isn't looking
      const L = this.followLeader;
      this.lookYaw = this.turnToward(this.lookYaw, L.yaw + [-1.1, 1.1, Math.PI][this.slot % 3] + Math.sin(g.time * 0.6 + f.id) * 0.5, dt * 2.5);
      this.lookPitch *= 0.9;
      if (f.weapon && f.item.mag < WEAPONS[f.item.id].mag) f.startReload();
      return this.applyLook(dt);
    }
    if (this.state === 'hold') {
      if (g.time > this.holdUntil) this.state = 'roam';
      this.lookYaw += Math.sin(g.time * 0.7 + f.id) * dt * 0.8;
      if (f.weapon && f.item.mag < WEAPONS[f.item.id].mag) f.startReload();
      return this.applyLook(dt);
    }
    const moving = this.followPath(dt, this.state !== 'investigate');
    if (this.state === 'investigate' && this.heard) { lookAtX = this.heard.x; lookAtZ = this.heard.z; }
    if (this.state === 'chest' && this.goal && this.goal.rec) {
      const c = this.goal.rec;
      if (c.opened) { this.goal = null; this.state = 'loot'; }
      else if (c.pos.distanceTo(f.pos) < 2.0) {
        this.chestT += dt; lookAtX = c.pos.x; lookAtZ = c.pos.z;
        if (this.chestT > 0.45) { g.loot.openChest(c, f); this.chestT = 0; this.goal = null; this.thinkT = 0.4; }
      }
    }
    if (this.state === 'loot' && this.goal && this.goal.rec) {
      const r = this.goal.rec;
      if (!r.active) { this.goal = null; }
      else if (r.pos.distanceTo(f.pos) < 1.8 && !r.vel) {
        g.loot.take(f, r, true);
        this.goal = null; this.thinkT = 0.15;
        this.equipBest(40);
      }
    }
    // opportunistic pickups of ammo / items we walk over
    if (Math.random() < 0.2) {
      const n = g.loot.nearest(f, 1.6);
      if (n && n.type === 'item' && this.wantsItem(n.rec.item)) { g.loot.take(f, n.rec, true); this.equipBest(40); }
    }
    if (lookAtX !== null) this.lookYaw = this.turnToward(this.lookYaw, Math.atan2(lookAtX - f.pos.x, lookAtZ - f.pos.z), dt * this.turnSpeed);
    else if (moving) this.lookYaw = this.turnToward(this.lookYaw, Math.atan2(f.move.x, f.move.y), dt * 5);
    this.lookPitch *= 0.9;
    // reload while safe
    if (f.weapon && f.item.mag < WEAPONS[f.item.id].mag * 0.6) f.startReload();
    this.applyLook(dt);
  }

  applyLook() { this.f.yaw = this.lookYaw; this.f.pitch = this.lookPitch; }

  turnToward(cur, target, maxStep) { const d = angDiff(cur, target); return cur + Math.max(-maxStep, Math.min(maxStep, d)); }

  updateAir(dt) {
    const f = this.f;
    // duos/squads: track the leader through the air so the team lands together
    const L = this.followLeader;
    if (L && L.alive && (L.mode === 'skydive' || L.mode === 'glide')) {
      if (!this.airOff) { const a = Math.random() * Math.PI * 2; this.airOff = { x: Math.cos(a) * 7, z: Math.sin(a) * 7 }; }
      this.dropTarget = { x: L.pos.x + L.vel.x * 1.5 + this.airOff.x, z: L.pos.z + L.vel.z * 1.5 + this.airOff.z };
    }
    else if (L && L.alive && L.isPlayer && L.mode === 'ground') { const sp = this.slotPos(); this.dropTarget = { x: sp.x, z: sp.z }; }
    if (!this.dropTarget) { f.move.set(0, 0); return; }
    const dx = this.dropTarget.x - f.pos.x, dz = this.dropTarget.z - f.pos.z, d = Math.hypot(dx, dz);
    if (d > 3) f.move.set(dx / d, dz / d); else f.move.set(0, 0);
    this.lookYaw = Math.atan2(dx, dz);
    f.pitch = d > 60 && f.mode === 'skydive' ? -0.9 : -0.3;
    f.yaw = this.lookYaw;
  }

  perceive() {
    const f = this.f, g = this.g;
    const near = this.enemiesNear(this.vision + 10);
    let best = null, bestScore = -1e9;
    for (const [o, d] of near) {
      if (!this.canSee(o, d)) continue;
      let score = -d;
      if (o === this.target) score += 25;                 // stickiness
      if (o.lastShotAt > g.time - 1.5) score += 10;        // shooters draw attention
      if (o.health + o.shield < 60) score += 12;           // finish weak targets
      if (o.isPlayer) score += 3;
      if (score > bestScore) { bestScore = score; best = o; }
    }
    if (best) {
      if (best !== this.target) {
        this.trackT = 0;
        const e = 0.28 - 0.2 * this.skill;
        this.aimErr.set(rnd(-1, 1) * e * 1.6, rnd(-1, 1) * e);
      }
      this.target = best; this.targetSeenAt = g.time; this.lastKnown.copy(best.pos);
    } else if (this.target && (!this.target.alive || g.time - this.targetSeenAt > 7)) this.target = null;
  }

  decide() {
    const f = this.f, g = this.g, s = g.storm;
    // inventory housekeeping
    if (f.healing) return;
    if (!f.weapon && this.gunCount() > 0 && this.state !== 'fight' && !this.wantHeal()) this.equipBest(30);
    // storm first
    const distNext = Math.hypot(f.pos.x - s.nx, f.pos.z - s.nz);
    const timeToShrink = s.timeLeft;
    const mate = this.mate, L = this.followLeader;
    const leadD = mate ? Math.hypot(L.pos.x - f.pos.x, L.pos.z - f.pos.z) : 0;
    // squad mates rotate with the player; they only run for the circle themselves when the storm is on them
    const needRotate = this.inStorm(f.pos.x, f.pos.z, 4) || (!mate && distNext > s.nr * 0.8 && (s.shrinking || timeToShrink < distNext / 6 + 12));
    const tgt = this.target && this.target.alive ? this.target : null;
    let recentlySeen = tgt && g.time - this.targetSeenAt < 4.5;
    // leash: don't chase a fight far away from the player
    if (mate && recentlySeen && leadD > 48 && tgt.pos.distanceTo(L.pos) > 40) { this.target = null; recentlySeen = false; }
    if (recentlySeen && this.gunCount() > 0 && !(this.inStorm(f.pos.x, f.pos.z) && f.health < 40)) { this.state = 'fight'; return; }
    if (recentlySeen && this.gunCount() === 0) {
      // unarmed: run away from the threat toward loot
      this.state = 'loot';
    }
    if (needRotate && mate && L.mode === 'ground' && !this.inStorm(L.pos.x, L.pos.z, 2)) {
      const sp = this.slotPos(); this.state = 'follow'; this.setGoal(sp.x, sp.z, 'follow');   // the player is safe: run to them
      if (leadD > 40 && this.nadeCd <= 0) this.useShockwaveTo(L.pos.x, L.pos.z);
      return;
    }
    if (needRotate) {
      if (this.state !== 'storm' || !this.goal || g.time > this.repathAt) {
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * s.nr * 0.6;
        const p = g.nav.randomWalkableNear(s.nx + Math.cos(a) * r, s.nz + Math.sin(a) * r, 6);
        this.state = 'storm'; this.setGoal(p.x, p.z, 'storm');
      }
      // shockwave rotate if far & storm is hurting
      if (this.inStorm(f.pos.x, f.pos.z) && distNext > 40 && this.nadeCd <= 0 && Math.random() < this.skill) this.useShockwaveTo(s.nx, s.nz);
      return;
    }
    // your squad: hold formation on you, loot only what's right next to you
    if (mate && L.mode === 'ground') {
      this.thinkT = 0.22;
      const sp = this.slotPos();
      const off = Math.hypot(sp.x - f.pos.x, sp.z - f.pos.z);
      const moving = Math.hypot(L.vel.x, L.vel.z) > 1.5;
      if (off > (moving ? 2.2 : 3.6) || leadD > 9) {
        if (leadD > 42 && this.nadeCd <= 0 && Math.random() < 0.5) this.useShockwaveTo(L.pos.x, L.pos.z);   // catch up fast
        this.state = 'follow';
        if (!this.goal || this.goal.type !== 'follow' || Math.hypot(this.goal.x - sp.x, this.goal.z - sp.z) > 2.2) { this.goal = null; this.setGoal(sp.x, sp.z, 'follow'); }
        return;
      }
      if (!moving && (this.gunCount() < 3 || this.lowAmmo())) {
        if (this.goal && (this.goal.type === 'loot' || this.goal.type === 'chest') && this.goal.rec && this.goal.rec.active !== false && !this.goal.rec.opened) { this.state = this.goal.type; return; }
        const found = this.findLoot(13);
        if (found && found.rec.pos.distanceTo(L.pos) < 15) { this.state = found.type; this.chestT = 0; this.setGoal(found.rec.pos.x, found.rec.pos.z, found.type, found.rec); return; }
      }
      this.state = 'escort'; this.goal = null; this.path = null;
      return;
    }
    // bot squads follow their leader loosely
    if (this.followLeader && this.followLeader.alive && this.followLeader.mode === 'ground') {
      const d = this.followLeader.pos.distanceTo(f.pos);
      if (d > 28 && !recentlySeen) {
        const p = g.nav.randomWalkableNear(this.followLeader.pos.x, this.followLeader.pos.z, 8);
        this.state = 'follow'; this.setGoal(p.x, p.z, 'follow'); return;
      }
    }
    // investigate noises
    if (this.heard && g.time - this.heardAt < 6 && this.gunCount() > 0 && this.pers.aggression > 0.4 && this.heard.distanceTo(f.pos) > 6) {
      this.state = 'investigate'; this.setGoal(this.heard.x, this.heard.z, 'investigate'); return;
    }
    // loot
    const guns = this.gunCount();
    const needLoot = guns < 2 || (guns < 3 && Math.random() < this.pers.looter * 0.6) || this.lowAmmo();
    if (needLoot) {
      if (this.goal && (this.goal.type === 'loot' || this.goal.type === 'chest') && this.goal.rec && (this.goal.rec.active !== false) && !this.goal.rec.opened) { this.state = this.goal.type; return; }
      const found = this.findLoot(guns === 0 ? 55 : 38);
      if (found) { this.state = found.type; this.chestT = 0; this.setGoal(found.rec.pos.x, found.rec.pos.z, found.type, found.rec); return; }
    }
    // hold an angle (campers) or roam
    if (this.state !== 'hold' && Math.random() < this.pers.camper * 0.12 && guns > 0) {
      this.state = 'hold'; this.holdUntil = g.time + rnd(4, 12); this.path = null; return;
    }
    if (this.state !== 'roam' || !this.goal || (this.path && this.pathIdx >= this.path.length) || g.time > this.repathAt + 10) {
      const p = this.pickRoamPoint();
      this.state = 'roam'; this.setGoal(p.x, p.z, 'roam');
    } else this.state = 'roam';
  }

  wantHeal() {
    const f = this.f, g = this.g;
    if (f.health >= 65 || f.slotOf(s => s.kind === 'heal') < 0) return false;
    if (g.time - this.targetSeenAt < 2.5 && this.target && this.target.alive) return false;
    return !this.inStorm(f.pos.x, f.pos.z, 3);
  }

  lowAmmo() {
    const w = this.f.slots.filter(s => s && s.kind === 'gun');
    return w.length > 0 && w.every(s => this.f.ammo[WEAPONS[s.id].ammo] + s.mag < WEAPONS[s.id].mag * 0.8);
  }

  findLoot(range) {
    const f = this.f, g = this.g;
    let best = null, bestScore = -1e9;
    for (const it of g.loot.items) {
      if (it.vel) continue;
      const d = it.pos.distanceTo(f.pos);
      if (d > range || Math.abs(it.pos.y - f.pos.y) > 3) continue;
      if (!this.wantsItem(it.item)) continue;
      let sc = -d + (it.item.kind === 'gun' ? 12 + it.item.rarity * 3 : it.item.kind === 'jetpack' ? 14 : it.item.kind === 'ammo' ? (this.lowAmmo() ? 10 : -5) : 4);
      if (it.claimedBy && it.claimedBy !== f && it.claimedAt > g.time - 4) sc -= 30;
      if (sc > bestScore) { bestScore = sc; best = { type: 'loot', rec: it }; }
    }
    for (const c of g.loot.chests) {
      if (c.opened) continue;
      const d = c.pos.distanceTo(f.pos);
      if (d > range || Math.abs(c.pos.y - f.pos.y) > 3) continue;
      let sc = -d + 18;
      if (c.claimedBy && c.claimedBy !== f && c.claimedAt > g.time - 5) sc -= 30;
      if (sc > bestScore) { bestScore = sc; best = { type: 'chest', rec: c }; }
    }
    if (best) { best.rec.claimedBy = f; best.rec.claimedAt = g.time; }
    return best;
  }

  pickRoamPoint() {
    const g = this.g, s = g.storm;
    // head toward a POI inside the safe zone, or a random spot
    const pois = g.world.pois.filter(p => Math.hypot(p.x - s.nx, p.z - s.nz) < s.nr * 0.9);
    if (pois.length && Math.random() < 0.55) {
      const p = pois[Math.floor(Math.random() * pois.length)];
      return g.nav.randomWalkableNear(p.x, p.z, p.r * 0.7);
    }
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * Math.min(s.nr, 120) * 0.85;
    return g.nav.randomWalkableNear(s.nx + Math.cos(a) * r, s.nz + Math.sin(a) * r, 10);
  }

  equipBest(dist) {
    if (this.switchCd > 0) return;
    const best = this.bestGunFor(dist);
    if (best > 0 && best !== this.f.selected) { this.f.select(best); this.switchCd = 1.2 - this.skill * 0.6; }
  }

  /** Follow the current path. Returns true if moving. */
  followPath(dt, sprint = true) {
    const f = this.f, g = this.g;
    if (!this.goal) return false;
    if (this.goal.type === 'follow' && this.mate) {
      const sp = this.slotPos(), dx = sp.x - f.pos.x, dz = sp.z - f.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.8) return false;
      if (d < 16 && g.col.clear(f.pos.x, f.pos.y + 0.6, f.pos.z, sp.x, f.pos.y + 0.6, sp.z)) {
        const k = Math.min(1, d / 2.5);
        f.move.set(dx / d * k, dz / d * k); f.sprint = d > 5 || this.followLeader.sprint; this.checkStuck(dt);
        return true;
      }
    }
    if (!this.path) {
      if (!this.pathPending && g.time > this.repathAt - 5.5) this.requestPath(this.goal.x, this.goal.z);
      // walk straight toward goal while waiting
      const dx = this.goal.x - f.pos.x, dz = this.goal.z - f.pos.z, d = Math.hypot(dx, dz);
      if (d < 1.2) return false;
      f.move.set(dx / d, dz / d); f.sprint = sprint; return true;
    }
    if (this.pathIdx >= this.path.length) {
      const dx = this.goal.x - f.pos.x, dz = this.goal.z - f.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.0 && d < 4) { f.move.set(dx / d, dz / d); return true; }
      if (this.goal.type === 'roam' || this.goal.type === 'storm' || this.goal.type === 'follow' || this.goal.type === 'investigate') { this.goal = null; this.path = null; this.thinkT = Math.min(this.thinkT, 0.1); }
      return false;
    }
    const wp = this.path[this.pathIdx];
    const dx = wp.x - f.pos.x, dz = wp.z - f.pos.z, d = Math.hypot(dx, dz);
    if (d < 1.3) { this.pathIdx++; return true; }
    f.move.set(dx / d, dz / d);
    f.sprint = sprint;
    this.checkStuck(dt);
    return true;
  }

  checkStuck(dt) {
    const f = this.f;
    this.stuckCheckT += dt;
    if (this.stuckCheckT < 0.8) return;
    const moved = Math.hypot(f.pos.x - this.lastPos.x, f.pos.z - this.lastPos.z);
    this.lastPos.copy(f.pos); this.stuckCheckT = 0;
    if (moved < 0.6) {
      this.stuckT += 0.8;
      f.wantJump = true;
      if (f.jetpack && f.fuel > 30) this.jetT = 0.8; // fly over whatever we're stuck on
      if (this.stuckT > 2) {
        this.stuckT = 0;
        const p = this.g.nav.randomWalkableNear(f.pos.x, f.pos.z, 6);
        this.path = [p, ...(this.path ? this.path.slice(this.pathIdx) : [])]; this.pathIdx = 0;
      }
    } else this.stuckT = 0;
  }

  // -------------------------------------------------------------- combat
  fight(dt, tgt, seen) {
    const f = this.f, g = this.g;
    const dist = tgt.pos.distanceTo(f.pos);
    const lowHp = f.shield <= 0 && f.health < 55;
    // weapon choice by range
    if (this.switchCd <= 0 && (!f.weapon || (f.item.mag <= 0 && f.ammo[f.weapon.ammo] <= 0) || Math.random() < 0.02)) this.equipBest(dist);
    if (f.weapon && f.item.mag <= 0) { if (!f.startReload() && this.switchCd <= 0) this.equipBest(dist); }
    const w = f.weapon;
    // ---- movement
    let mx = 0, mz = 0;
    const toX = tgt.pos.x - f.pos.x, toZ = tgt.pos.z - f.pos.z, toL = Math.max(0.01, Math.hypot(toX, toZ));
    const nx = toX / toL, nz = toZ / toL;
    if (lowHp && this.skill > 0.35 && g.time > this.coverUntil) {
      // look for cover, regen shield there
      if (!this.coverPoint || g.time > this.coverUntil + 3) { this.coverPoint = this.findCover(tgt); this.coverUntil = g.time + 5.5; }
    }
    if (this.coverPoint && g.time < this.coverUntil) {
      const dx = this.coverPoint.x - f.pos.x, dz = this.coverPoint.z - f.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.8) { mx = dx / d; mz = dz / d; f.sprint = !seen; } else { f.crouch = Math.random() < 0.02 ? !f.crouch : f.crouch; if (f.weapon) f.startReload(); }
      if (f.shield > 30 || !seen && g.time > this.coverUntil - 1) this.coverPoint = null;
      // throw shockwave to disengage
      if (seen && dist < 12 && this.nadeCd <= 0 && f.health < 35) this.useShockwaveAway(tgt);
    } else if (!seen) {
      // push last known position (aggressive) or hold
      if (this.pers.aggression > 0.35 || dist > 40) {
        if (!this.goal || this.goal.type !== 'chase' || g.time > this.repathAt - 4) this.setGoal(this.lastKnown.x, this.lastKnown.z, 'chase');
        this.followPath(dt, false);
        mx = f.move.x; mz = f.move.y;
      }
      if (f.weapon && f.item.mag < WEAPONS[f.item.id].mag * 0.5) f.startReload();
    } else {
      const [lo, hi] = w ? w.botRange : [1.5, 2.5];
      const want = (lo + hi) / 2;
      let fwd = 0;
      if (dist > hi) fwd = 1; else if (dist < lo) fwd = -1; else fwd = (dist - want) / (hi - lo) * 0.6;
      if (!w) fwd = 1;
      // strafe
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = rnd(0.35, 1.3) * (1.4 - this.skill * 0.6); }
      const strafeAmt = 0.35 + this.skill * 0.65;
      mx = nx * fwd + (-nz) * this.strafe * strafeAmt;
      mz = nz * fwd + (nx) * this.strafe * strafeAmt;
      // avoid walking into walls: probe
      const ml = Math.hypot(mx, mz);
      if (ml > 0.01) {
        mx /= ml; mz /= ml;
        if (!g.nav.isWalkable(f.pos.x + mx * 1.6, f.pos.z + mz * 1.6)) { this.strafe *= -1; mx = nx * fwd + (-nz) * this.strafe * strafeAmt; mz = nz * fwd + nx * this.strafe * strafeAmt; }
      }
      // habits
      this.jumpT -= dt;
      if (this.jumpT <= 0) {
        this.jumpT = rnd(0.8, 3.5) / (0.3 + this.pers.jumpy);
        if (Math.random() < this.pers.jumpy * 0.8) f.wantJump = true;
        // jetpack hop to dodge / take high ground
        if (f.jetpack && f.fuel > 45 && Math.random() < 0.35 + this.pers.jumpy * 0.3) { f.wantJump = true; this.jetT = rnd(0.35, 0.9); }
      }
      const wantCrouch = w && (w.id === 'sniper' || (w.id === 'ar' && dist > 35)) && Math.random() < this.pers.crouchy;
      this.crouchT -= dt;
      if (this.crouchT <= 0) { this.crouchT = rnd(0.5, 2); f.crouch = wantCrouch || Math.random() < this.pers.crouchy * 0.25; }
      if (w && w.id === 'sniper' && dist > 50) { mx *= 0.2; mz *= 0.2; }
      // overdrive grenade at the start of a fight
      if (this.nadeCd <= 0 && dist > 6 && dist < 24 && Math.random() < 0.02 + this.skill * 0.03) this.throwNade('overdrive', tgt.pos);
    }
    // stay out of the storm while fighting
    if (this.inStorm(f.pos.x, f.pos.z, 2)) {
      const s = g.storm, dx = s.cx - f.pos.x, dz = s.cz - f.pos.z, d = Math.hypot(dx, dz);
      mx = mx * 0.4 + dx / d; mz = mz * 0.4 + dz / d;
    }
    const L = Math.hypot(mx, mz); if (L > 1) { mx /= L; mz /= L; }
    f.move.set(mx, mz);
    if (!seen && this.coverPoint == null) f.crouch = false;

    // ---- aim
    const aimPt = this.aimPoint(tgt, dist, dt);
    const ex = aimPt.x - f.pos.x, ey = aimPt.y - f.eyeY, ez = aimPt.z - f.pos.z;
    const wantYaw = Math.atan2(ex, ez), wantPitch = Math.atan2(ey, Math.hypot(ex, ez));
    const step = this.turnSpeed * dt * (seen ? 1 : 0.5);
    this.lookYaw = this.turnToward(this.lookYaw, wantYaw, step);
    this.lookPitch += Math.max(-step, Math.min(step, wantPitch - this.lookPitch));
    this.applyLook();
    if (!seen || !w) {
      if (!w && dist < 2.2) g.combat.melee(f, _d.set(nx, 0, nz));
      return;
    }
    // ---- shoot
    this.trackT += dt;
    if (this.trackT < this.reaction) return;
    const yawErr = Math.abs(angDiff(this.lookYaw, wantYaw)), pitchErr = Math.abs(wantPitch - this.lookPitch);
    const tol = w.id === 'shotgun' ? 0.25 : w.id === 'sniper' ? 0.03 : 0.09;
    if (yawErr > tol || pitchErr > tol * 1.5) return;
    if (dist > w.range * 0.95) return;
    // tap/burst fire at range for automatic weapons
    if (w.auto && dist > 30) {
      if (this.burstPause > 0) { this.burstPause -= dt; return; }
      if (this.burstLeft <= 0) this.burstLeft = 2 + Math.floor(Math.random() * (2 + this.skill * 3));
    }
    if (w.id === 'sniper' && Math.random() > 0.04 + this.skill * 0.05) return; // snipers line up their shot
    const dir = _d.set(Math.sin(this.lookYaw) * Math.cos(this.lookPitch), Math.sin(this.lookPitch), Math.cos(this.lookYaw) * Math.cos(this.lookPitch)).normalize();
    const extra = (1 - this.skill) * 0.045 + (tgt.mode !== 'ground' ? 0.02 : 0);
    const eye = _e.set(f.pos.x, f.eyeY, f.pos.z);
    if (g.combat.fireGun(f, eye, dir, extra)) {
      if (w.auto && dist > 30) { this.burstLeft--; if (this.burstLeft <= 0) this.burstPause = rnd(0.2, 0.55) * (1.3 - this.skill); }
    }
  }

  aimPoint(tgt, dist, dt) {
    // error decays while tracking; skilled bots settle faster and aim higher (head)
    const decay = Math.exp(-dt * (1.2 + 3.2 * this.skill));
    this.aimErr.multiplyScalar(decay);
    const minErr = 0.05 - 0.04 * this.skill;
    const t = this.g.time;
    const jitterYaw = Math.sin(t * 2.3 + this.f.id) * minErr, jitterPitch = Math.cos(t * 1.7 + this.f.id * 2) * minErr * 0.6;
    // lead moving targets a little (skilled bots lead better)
    const lead = Math.min(0.25, dist / 300) * this.skill;
    const headBias = Math.max(0, this.skill - 0.3) * 0.55 + (this.f.weapon && this.f.weapon.id === 'sniper' ? 0.25 : 0);
    const y = tgt.pos.y + (tgt.crouch ? 0.85 : 1.15) + headBias * 0.42;
    const yaw = this.aimErr.x + jitterYaw, pitch = this.aimErr.y + jitterPitch;
    const px = tgt.pos.x + tgt.vel.x * lead, pz = tgt.pos.z + tgt.vel.z * lead;
    // rotate error around the shooter
    const dx = px - this.f.pos.x, dz = pz - this.f.pos.z;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    return _v.set(this.f.pos.x + dx * cs + dz * sn, y + pitch * dist, this.f.pos.z - dx * sn + dz * cs);
  }

  findCover(tgt) {
    const f = this.f, g = this.g;
    let best = null, bd = 1e9;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, r = 3 + (i % 3) * 3;
      const x = f.pos.x + Math.cos(a) * r, z = f.pos.z + Math.sin(a) * r;
      if (!g.nav.isWalkable(x, z)) continue;
      if (g.col.clear(tgt.pos.x, tgt.eyeY, tgt.pos.z, x, f.pos.y + 1.2, z)) continue;
      const d = r + (Math.hypot(x - tgt.pos.x, z - tgt.pos.z) < 6 ? 20 : 0);
      if (d < bd) { bd = d; best = { x, z }; }
    }
    return best;
  }

  throwNade(id, at) {
    const f = this.f, g = this.g;
    const slot = f.slotOf(s => s.kind === 'grenade' && s.id === id);
    if (slot < 0) return false;
    const prev = f.selected;
    f.selected = slot;
    const dx = at.x - f.pos.x, dz = at.z - f.pos.z, d = Math.hypot(dx, dz);
    const pitch = Math.min(0.55, 0.08 + d * 0.012);
    const dir = new THREE.Vector3(dx / d * Math.cos(pitch), Math.sin(pitch), dz / d * Math.cos(pitch)).normalize();
    const power = Math.min(1, 0.45 + d / 40);
    const ok = g.combat.throwGrenade(f, dir, power);
    if (f.slots[prev - 1] || prev === 0) f.selected = prev; else f.selected = 0;
    this.nadeCd = rnd(6, 14);
    return ok;
  }

  /** Pop a shockwave to launch ourselves in a direction (x,z). */
  launch(dx, dz) {
    const f = this.f;
    const slot = f.slotOf(s => s.kind === 'grenade' && s.id === 'shockwave');
    if (slot < 0 || f.mode !== 'ground') return false;
    const prev = f.selected;
    f.selected = slot; f.throwCd = 0;
    const ok = this.g.combat.useShockwave(f, new THREE.Vector3(dx, 0, dz));
    f.selected = f.slots[prev - 1] || prev === 0 ? prev : (f.slotOf(s => s.kind === 'gun') > 0 ? f.slotOf(s => s.kind === 'gun') : 0);
    this.nadeCd = rnd(6, 14);
    return ok;
  }

  useShockwaveAway(tgt) {
    const f = this.f;
    // escape: launch away from the threat, angled a little to the side
    const dx = f.pos.x - tgt.pos.x, dz = f.pos.z - tgt.pos.z, s = Math.random() < 0.5 ? 0.5 : -0.5;
    this.launch(dx - dz * s, dz + dx * s);
  }

  useShockwaveTo(x, z) { const f = this.f; this.launch(x - f.pos.x, z - f.pos.z); }
}
