// A single match: Battle Royale (solo) or Reload (squads, respawns until the storm closes it).
import * as THREE from 'three';
import { Fighter } from './fighter.js';
import { BotBrain, botName } from './bot.js';
import { Combat } from './combat.js';
import { Loot } from './loot.js';
import { Effects, StormWall } from './effects.js';
import { PlayerController } from './player.js';
import { makeGun, makeGrenade, WEAPONS, AMMO_TYPES, DEFAULT_LOADOUT } from '../data/items.js';
import { SKINS, PICKAXES } from '../data/cosmetics.js';
import { Audio } from '../core/audio.js';
import { MAP_HALF, MAX_SHIELD } from '../config.js';

const BR_PHASES = [
  { wait: 70, shrink: 50, r: 118, dps: 1 },
  { wait: 45, shrink: 40, r: 70, dps: 2 },
  { wait: 35, shrink: 30, r: 38, dps: 5 },
  { wait: 25, shrink: 25, r: 18, dps: 8 },
  { wait: 20, shrink: 20, r: 6, dps: 10 },
  { wait: 15, shrink: 25, r: 0, dps: 14 },
];
const RELOAD_PHASES = [
  { wait: 50, shrink: 35, r: 100, dps: 1 },
  { wait: 35, shrink: 30, r: 62, dps: 2 },
  { wait: 30, shrink: 25, r: 34, dps: 4 },
  { wait: 25, shrink: 25, r: 15, dps: 7 },
  { wait: 20, shrink: 20, r: 5, dps: 10 },
  { wait: 10, shrink: 20, r: 0, dps: 14 },
];
const RELOAD_CLOSE_PHASE = 3;
const WEAPON_NAMES = { ar: 'Assault Rifle', shotgun: 'Pump Shotgun', smg: 'Volt SMG', sniper: 'Arc Sniper', pickaxe: 'Pickaxe', overdrive: 'Overdrive Grenade' };

export class Match {
  /**
   * opts: {mode:'br'|'reload', ranked, skill, profile, app}
   * app supplies renderer, scene, camera, world, nav, factory, textures, hud, input, charPool, quality
   */
  constructor(app, opts) {
    this.app = app;
    this.opts = opts;
    this.mode = opts.mode;
    this.ranked = opts.ranked;
    this.scene = app.gameScene;
    this.world = app.world; this.col = app.world.col; this.nav = app.nav;
    this.factory = app.factory; this.textures = app.textures;
    this.hud = app.hud;
    this.time = 0;
    this.fighters = [];
    this.pathQueue = [];
    this.feed = [];
    this.ended = false;
    this.result = null;
    this.over = false;
    this.effects = app.effects;
    this.effects.clear();
    this.combat = new Combat(this);
    this.loot = app.loot || (app.loot = new Loot(this));
    this.loot.g = this;
    this.storm = { cx: 0, cz: 0, r: 240, nx: 0, nz: 0, nr: 240, phase: -1, timeLeft: 0, shrinking: false, dps: 1, reloadOpen: this.mode === 'reload' };
    this.stormWall = new StormWall(this.scene, this.textures.noise);
    this.ctrl = new PlayerController(this, app.camera, opts.profile.settings);
    this.stormTick = 0;
    this.lastHumT = 0;
    this.placement = 0;
    this.startTime = 0;
    this.victoryT = -1;
    this.setup();
  }

  // ================================================================ setup
  setup() {
    const P = this.opts.profile;
    const reload = this.mode === 'reload';
    const total = reload ? 24 : 30;
    const teamSize = reload ? 4 : 1;
    const used = new Set([P.username.toLowerCase()]);
    this.loot.populate(this.world, reload ? 0.95 : 0.8);
    this.loot.spawnJetpacks(this.world);
    const pool = this.app.charPool;
    for (let i = 0; i < total; i++) {
      const isPlayer = i === 0;
      const team = Math.floor(i / teamSize);
      const skin = isPlayer ? P.locker.skin : SKINS[Math.floor(Math.random() * SKINS.length)].id;
      const pick = isPlayer ? P.locker.pickaxe : PICKAXES[Math.floor(Math.random() * PICKAXES.length)].id;
      const f = new Fighter({ name: isPlayer ? P.username : botName(used), team, isPlayer, skin, pickaxe: pick });
      f.char = pool[i];
      f.char.revive();
      f.char.setSkin(skin);
      f.char.pickaxeId = pick;
      f.char.setHeld(null);
      f.char.setGlider(false);
      f.char.setJetpack(false);
      f.char.root.visible = false;
      f.char.root.position.set(0, -50, 0);
      this.scene.add(f.char.root);
      if (!isPlayer) f.bot = new BotBrain(f, this, this.opts.skill);
      f.loadoutOrder = isPlayer ? P.loadout : DEFAULT_LOADOUT;
      f.giveLoadout(f.loadoutOrder);
      this.fighters.push(f);
    }
    this.player = this.fighters[0];
    this.teams = reload ? 6 : total;
    if (reload) for (const f of this.fighters) if (f.team === 0 && f.bot) { f.bot.followLeader = this.player; this.addNameTag(f); }
    // reload: start with a common pistol-equivalent so fights start quickly
    this.setupBus();
    this.initStorm();
    this.hud.matchStart(this);
    Audio.loop('engine', 0.35);
  }

  addNameTag(f) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48;
    const x = c.getContext('2d');
    x.font = 'bold 30px Rajdhani, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.75)'; x.strokeText(f.name, 128, 24);
    x.fillStyle = '#4ff2ff'; x.fillText(f.name, 128, 24);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
    s.scale.set(1.6, 0.3, 1); s.position.y = 2.25; s.renderOrder = 20;
    f.char.root.add(s);
    f.nameTag = s;
  }

  setupBus() {
    const a = Math.random() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const off = (Math.random() - 0.5) * 120;
    const start = new THREE.Vector3().addScaledVector(dir, -MAP_HALF - 50).addScaledVector(perp, off);
    start.y = 135;
    this.bus = { pos: start.clone(), start, dir, speed: 30, t: 0, len: (MAP_HALF + 50) * 2, active: true, mesh: this.makeBusMesh() };
    this.bus.mesh.position.copy(start);
    this.bus.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    this.scene.add(this.bus.mesh);
    for (const f of this.fighters) {
      f.mode = 'bus';
      f.pos.copy(start);
      if (f.bot) {
        // choose a landing spot: hot POIs are popular
        const pois = this.world.pois;
        let target;
        if (Math.random() < 0.7) {
          const p = pois[Math.floor(Math.random() * pois.length)];
          target = this.nav.randomWalkableNear(p.x, p.z, p.r * 0.8);
        } else target = this.nav.randomWalkableNear((Math.random() - 0.5) * 280, (Math.random() - 0.5) * 280, 10);
        f.bot.dropTarget = target;
        // jump when the bus is near the closest point to the target (with some variation)
        const rel = new THREE.Vector3(target.x - start.x, 0, target.z - start.z);
        f.bot.jumpAt = Math.max(15, Math.min(this.bus.len - 20, rel.dot(dir) - 25 + Math.random() * 30));
      }
    }
  }

  makeBusMesh() {
    const g = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0x2b2450, metalness: 0.6, roughness: 0.35 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x8a6cff, metalness: 0.4, roughness: 0.4, emissive: 0x3a1a9a, emissiveIntensity: 0.6 });
    const glow = new THREE.MeshBasicMaterial({ color: 0x5ff4ff, toneMapped: false });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 12, 6, 16), hull); body.rotation.x = Math.PI / 2; g.add(body);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 9, 16, 1, true), trim); stripe.rotation.x = Math.PI / 2; stripe.scale.set(1, 1, 0.3); stripe.position.y = 0.4; g.add(stripe);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(18, 0.35, 3.2), hull); wing.position.set(0, -0.3, -0.5); g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 2.4), trim); tail.position.set(0, 2.4, -7.2); g.add(tail);
    const tailW = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 1.8), hull); tailW.position.set(0, 0.6, -7.4); g.add(tailW);
    for (const x of [-6, 6]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 3.6, 14), hull); eng.rotation.x = Math.PI / 2; eng.position.set(x, -0.9, -0.4); g.add(eng);
      const ex = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), glow); ex.position.set(x, -0.9, -2.25); ex.rotation.y = Math.PI; g.add(ex);
    }
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9ff0ff, metalness: 0.9, roughness: 0.1, emissive: 0x1a5a6a })); cockpit.position.set(0, 0.9, 5.2); cockpit.scale.set(1, 0.7, 1.5); g.add(cockpit);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x5ff4ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    beam.position.set(0, -4.5, -2); g.add(beam);
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    return g;
  }

  initStorm() {
    const S = this.storm;
    this.phases = this.mode === 'reload' ? RELOAD_PHASES : BR_PHASES;
    if (this.mode === 'reload') {
      S.cx = (Math.random() - 0.5) * 60; S.cz = (Math.random() - 0.5) * 60; S.r = 175;
    } else { S.cx = 0; S.cz = 0; S.r = 240; }
    S.phase = 0; S.shrinking = false; S.timeLeft = this.phases[0].wait + 18; // + drop time
    this.pickNextCircle();
    this.stormWall.set(S.cx, S.cz, S.r);
  }

  pickNextCircle() {
    const S = this.storm, ph = this.phases[S.phase];
    if (!ph) return;
    S.nr = ph.r;
    for (let tries = 0; tries < 40; tries++) {
      const maxOff = Math.max(0, Math.min(S.r - S.nr, S.r * 0.6));
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * maxOff;
      let x = S.cx + Math.cos(a) * d, z = S.cz + Math.sin(a) * d;
      const lim = MAP_HALF - Math.max(8, S.nr * 0.7);
      x = Math.max(-lim, Math.min(lim, x)); z = Math.max(-lim, Math.min(lim, z));
      if (S.nr > 20 || this.nav.isWalkable(x, z)) { S.nx = x; S.nz = z; break; }
    }
    S.startR = S.r; S.startCx = S.cx; S.startCz = S.cz;
  }

  // ================================================================ API used by subsystems
  groundAt(x, z, y) { return this.col.groundHeight(x, z, 0.3, y, 0.5); }

  noise(src, pos, radius) {
    const r2 = radius * radius;
    for (const f of this.fighters) if (f.bot && f.alive && f !== src && f.pos.distanceToSquared(pos) < r2) f.bot.hear(src, pos);
  }

  requestPath(brain, ax, az, bx, bz) { this.pathQueue.push({ brain, ax, az, bx, bz }); }

  jumpFromBus(f) {
    if (f.mode !== 'bus') return;
    f.mode = 'skydive';
    f.pos.copy(this.bus.pos); f.pos.y -= 3;
    f.vel.set(this.bus.dir.x * 10, -5, this.bus.dir.z * 10);
    f.char.root.visible = true;
    f.char.setHeld(null);
    if (f.isPlayer) { Audio.play('deploy', { vol: 0.8 }); Audio.loop('wind', 0.5); this.hud.toast('Dive! Tap JUMP to open your glider early'); }
  }

  onDeploy(f) {
    f.char.setGlider(true);
    if (f.isPlayer) Audio.play('deploy', { vol: 0.9 });
  }

  onPlayerFired(w) { this.hud.onFire(w); }
  onOverdrive(f) { if (f.isPlayer) { this.hud.toast('⚡ OVERDRIVE ACTIVE', 'yellow'); Audio.play('zap', { vol: 0.5 }); } }
  onLaunched(f) { if (f.isPlayer) { this.ctrl.shake = 0.8; Audio.loop('wind', 0.4); setTimeout(() => Audio.stopLoop('wind'), 2500); } }

  onDamage(target, attacker, res, info) {
    const amount = Math.round(res.shieldDmg + res.healthDmg);
    if (attacker && attacker.isPlayer && target !== attacker) {
      const type = info.head ? 'head' : res.shieldDmg > 0 && res.healthDmg <= 0 ? 'shield' : 'health';
      this.hud.damageNumber(info.point || target.pos, amount, type);
      this.hud.hitmarker(info.head, res.killed);
      Audio.play(info.head ? 'headshot' : res.shieldDmg > 0 ? 'shieldhit' : 'hit', { vol: info.head ? 0.7 : 0.6 });
    }
    if (target.isPlayer) {
      this.ctrl.shake = Math.max(this.ctrl.shake, 0.35);
      this.hud.hurt(attacker, amount, res.shieldDmg > 0);
      if (this.app.settings().haptics && navigator.vibrate) try { navigator.vibrate(18); } catch { /* unsupported */ }
    }
  }

  eliminate(target, attacker, info = {}) {
    if (!target.alive) return;
    target.alive = false;
    target.mode = 'dead';
    target.ads = false; target.crouch = false;
    target.vel.set(0, 0, 0);
    target.eliminatedBy = attacker || null;
    target.char.die();
    target.char.setGlider(false);
    const dropPos = target.pos.clone();
    setTimeout(() => {
      // the character may have been recycled into a new match by now
      if (target.alive || this.ended || !this.fighters.includes(target)) return;
      this.effects.elimination(dropPos);
      target.char.root.visible = false;
    }, 1700);
    // drop everything
    const drops = target.slots.filter(Boolean);
    if (target.jetpack) { drops.push({ kind: 'jetpack', id: 'jetpack' }); target.jetpack = false; target.thrusting = false; }
    for (const k in target.ammo) if (target.ammo[k] > 0) drops.push({ kind: 'ammo', id: k, count: Math.min(target.ammo[k], AMMO_TYPES[k].pickup * 2) });
    this.loot.drop(drops, dropPos, 1.2);
    target.slots = [null, null, null, null, null]; target.selected = 0;
    // credit
    const how = info.weapon;
    let msg;
    if (attacker && attacker !== target) {
      attacker.kills++;
      this.combat.siphon(attacker);
      if (attacker.bot) attacker.bot.onKill(target);
      msg = { a: attacker.name, b: target.name, how: WEAPON_NAMES[how] || 'Eliminated', aTeam: attacker.team, bTeam: target.team, head: !!info.head };
      if (attacker.isPlayer) { this.hud.elimPopup(target.name); Audio.play('elim', { vol: 0.8 }); }
    } else {
      msg = { a: null, b: target.name, how: how === 'storm' ? 'was lost in the storm' : how === 'fall' ? 'fell to their death' : 'was eliminated', bTeam: target.team };
    }
    this.hud.killfeed(msg, this.player.team);
    // Reload: respawn while the team still has someone standing and Reload is open
    const reload = this.mode === 'reload';
    if (reload && this.storm.reloadOpen && this.teamAlive(target.team)) {
      target.respawnT = 7;
      if (target.isPlayer) this.hud.respawning(7);
    } else {
      if (reload) this.wipeCheck(target.team);
      else { target.placement = this.aliveCount() + 1; }
    }
    if (target.isPlayer && !(reload && target.respawnT > 0)) this.playerOut(attacker);
    this.checkEnd();
  }

  teamAlive(team) { return this.fighters.some(f => f.team === team && f.alive); }
  aliveCount() { return this.fighters.filter(f => f.alive).length; }
  teamsRemaining() {
    const set = new Set();
    for (const f of this.fighters) if (f.alive || f.respawnT > 0) set.add(f.team);
    return set.size;
  }

  wipeCheck(team) {
    // a reload team is out when nobody is alive (pending respawns die with the team)
    if (this.teamAlive(team)) return;
    const placement = this.teamsRemaining() + 1;
    for (const f of this.fighters) if (f.team === team) { f.respawnT = -1; f.placement = placement; }
    if (team === this.player.team && !this.result) this.playerOut(this.player.eliminatedBy);
  }

  playerOut(killer) {
    if (this.result) return;
    const p = this.player;
    const placement = this.mode === 'reload'
      ? (p.placement || (this.teamAlive(p.team) ? this.teamsRemaining() : this.teamsRemaining() + 1))
      : (p.placement || this.aliveCount() + 1);
    this.finish(false, placement);
    this.ctrl.spectating = killer && killer.alive ? killer : this.fighters.find(f => f.alive && (this.mode !== 'reload' || f.team === p.team)) || null;
    this.hud.playerEliminated(killer, placement, this.result);
  }

  finish(won, placement) {
    const p = this.player;
    const total = this.mode === 'reload' ? this.teams : this.fighters.length;
    this.result = {
      mode: this.mode, ranked: this.ranked, won, placement, total,
      kills: p.kills, damage: Math.round(p.damageDealt), timeAlive: Math.round(this.time - this.startTime),
      squad: this.mode === 'reload' ? this.fighters.filter(f => f.team === p.team).map(f => ({ name: f.name, kills: f.kills })) : null,
    };
  }

  checkEnd() {
    if (this.over) return;
    const reload = this.mode === 'reload';
    const remaining = reload ? this.teamsRemaining() : this.aliveCount();
    this.hud.setAlive(reload ? this.aliveCount() : remaining, reload ? remaining : null);
    if (remaining <= 1) {
      const winnerTeam = this.fighters.find(f => f.alive)?.team;
      const playerWon = winnerTeam === this.player.team;
      this.over = true;
      if (playerWon) {
        this.finish(true, 1);
        this.victoryT = 4.5;
        this.hud.victory(this.result);
        Audio.play('elim', { vol: 1, rate: 0.8 });
      } else if (!this.result) {
        this.finish(false, 2);
      }
    }
  }

  respawn(f) {
    const S = this.storm;
    const mates = this.fighters.filter(o => o.team === f.team && o.alive && o.mode === 'ground');
    let p;
    if (mates.length) { const m = mates[Math.floor(Math.random() * mates.length)]; p = this.nav.randomWalkableNear(m.pos.x, m.pos.z, 30); }
    else p = this.nav.randomWalkableNear(S.nx, S.nz, Math.max(10, S.nr * 0.5));
    f.alive = true; f.respawnT = -1;
    f.health = 100; f.shield = MAX_SHIELD; f.eliminatedBy = null;
    f.ammo = { light: 0, medium: 0, heavy: 0, shells: 0 };
    f.giveLoadout(f.loadoutOrder || DEFAULT_LOADOUT);
    f.overdriveT = 0; f.healT = 0;
    f.mode = 'skydive';
    f.pos.set(p.x, 95, p.z); f.vel.set(0, -10, 0);
    f.char.revive(); f.char.root.visible = true; f.char.setHeld(null);
    if (f.bot) { f.bot.dropTarget = p; f.bot.state = 'drop'; f.bot.target = null; f.bot.goal = null; f.bot.path = null; }
    if (f.isPlayer) { this.hud.toast('REDEPLOYING…', 'cyan'); this.ctrl.spectating = null; Audio.loop('wind', 0.5); }
    this.hud.squadUpdate(this);
  }

  // ================================================================ frame
  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const input = this.app.input.state;
    this.app.factory.time.value = this.time;
    // ---- bus
    const B = this.bus;
    if (B.active) {
      B.t += B.speed * dt;
      B.pos.copy(B.start).addScaledVector(B.dir, B.t);
      B.mesh.position.copy(B.pos);
      B.mesh.position.y += Math.sin(this.time * 1.3) * 0.4;
      for (const f of this.fighters) {
        if (f.mode !== 'bus') continue;
        f.pos.copy(B.pos);
        if (f.bot && B.t >= f.bot.jumpAt) this.jumpFromBus(f);
      }
      if (B.t > B.len - 40) {
        for (const f of this.fighters) if (f.mode === 'bus') this.jumpFromBus(f);
      }
      if (B.t > B.len) { B.active = false; this.scene.remove(B.mesh); Audio.stopLoop('engine'); }
      this.hud.busInfo(this.player.mode === 'bus', B);
    }
    // ---- player + bots intentions
    this.ctrl.update(dt, input);
    for (const f of this.fighters) if (f.bot) f.bot.update(dt);
    // ---- path requests (budgeted)
    for (let i = 0; i < 4 && this.pathQueue.length; i++) {
      const r = this.pathQueue.shift();
      if (!r.brain.f.alive) { r.brain.pathPending = false; continue; }
      r.brain.onPath(this.nav.findPath(r.ax, r.az, r.bx, r.bz, 7000));
    }
    // ---- physics
    const camPos = this.app.camera.position;
    for (const f of this.fighters) {
      if (!f.alive) {
        if (f.respawnT > 0) {
          f.respawnT -= dt;
          if (f.isPlayer) this.hud.respawning(Math.ceil(f.respawnT));
          if (f.respawnT <= 0) {
            if (this.storm.reloadOpen && this.teamAlive(f.team)) this.respawn(f);
            else { f.respawnT = -1; this.wipeCheck(f.team); if (f.isPlayer) this.playerOut(f.eliminatedBy); }
          }
        }
        f.char.update(dt, { vx: 0, vz: 0, yaw: f.yaw, camDist: 10 });
        continue;
      }
      if (f.mode === 'bus') continue;
      f.tickStatus(dt, this.time);
      const prevMode = f.mode;
      const ev = f.simulate(dt, this.col, (x, z, y) => this.groundAt(x, z, y));
      if (ev.deploy) this.onDeploy(f);
      if (ev.landed) {
        if (prevMode === 'glide' || prevMode === 'skydive') {
          f.char.setGlider(false);
          this.effects.landingDust(f.pos);
          if (f.isPlayer) { Audio.stopLoop('wind'); Audio.play('land', { vol: 0.8 }); if (!this.startTime) this.startTime = this.time; }
          if (f.bot) { f.bot.state = 'loot'; f.bot.thinkT = 0; }
          f.selected = f.slotOf(s => s.kind === 'gun') > 0 ? f.slotOf(s => s.kind === 'gun') : 0;
        } else if (f.isPlayer) Audio.play('land', { vol: 0.5 });
        if (ev.fallDamage > 0) this.combat.damage(f, ev.fallDamage, null, { weapon: 'fall' });
      }
      if (ev.jumped && f.isPlayer) Audio.play('step2', { vol: 0.4 });
      // footsteps (spatial — important for hearing enemies)
      if (f.mode === 'ground' && f.phys.grounded) {
        const sp = Math.hypot(f.vel.x, f.vel.z);
        if (sp > 1.5 && !f.crouch) {
          f.stepT -= dt * sp;
          if (f.stepT <= 0) {
            f.stepT = 2.6;
            Audio.play(Math.random() < 0.5 ? 'step1' : 'step2', { pos: f.isPlayer ? null : f.pos, vol: f.isPlayer ? 0.18 : 0.75, range: 32, near: 2, jitter: 0.15 });
          }
        }
      }
      if (f.overdriveT > 0 && Math.random() < 0.6) this.effects.overdriveAura(f.pos);
      // jetpack exhaust + sound
      if (f.thrusting) {
        const bx = f.pos.x - Math.sin(f.yaw) * 0.3, bz = f.pos.z - Math.cos(f.yaw) * 0.3;
        this.effects.emit(bx, f.pos.y + 0.75, bz, (Math.random() - 0.5) * 0.6, -6 - Math.random() * 3, (Math.random() - 0.5) * 0.6, 0xff9a3c, 0.22, 0.25, 0, 1.5);
        if (Math.random() < 0.5) this.effects.emit(bx, f.pos.y + 0.6, bz, (Math.random() - 0.5), -2, (Math.random() - 0.5), 0x9a92b8, 0.4, 0.8, -0.5, 2, 0.3);
        if (!f.isPlayer) { f.jetSndT = (f.jetSndT || 0) - dt; if (f.jetSndT <= 0) { f.jetSndT = 0.3; Audio.play('jet', { pos: f.pos, vol: 0.5, range: 70, rate: 1.1 }); } }
      }
      if (f.isPlayer) { if (f.thrusting) { Audio.loop('jet', 0.5); } else Audio.stopLoop('jet'); }
      if (f.justHealed) {
        f.justHealed = false;
        this.effects.burst(f.pos.x, f.pos.y + 1, f.pos.z, 24, 0x5ff4c8, 3, 0.14, 0.8, -2, 0.6);
        if (f.isPlayer) { Audio.play('chest', { vol: 0.6, rate: 1.3 }); this.hud.toast('+ HEALTH RESTORED', 'cyan'); }
      }
      if (f.healing && Math.random() < 0.3) this.effects.emit(f.pos.x + (Math.random() - 0.5) * 0.6, f.pos.y + 0.4 + Math.random(), f.pos.z + (Math.random() - 0.5) * 0.6, 0, 1, 0, 0x5ff4c8, 0.1, 0.5, 0);
    }
    this.combat.updateProjectiles(dt);
    // ---- storm
    this.updateStorm(dt);
    // ---- loot
    this.loot.update(dt, camPos);
    const hum = this.loot.closestChest(this.player.pos.x, this.player.pos.z, 14);
    if (hum && this.player.alive) { Audio.loop('chesthum', 0); Audio.loopVolume('chesthum', 0.25 * (1 - hum.pos.distanceTo(this.player.pos) / 14)); }
    else Audio.loopVolume('chesthum', 0);
    // ---- characters (visual sync)
    for (const f of this.fighters) {
      if (!f.alive || f.mode === 'bus') continue;
      const ch = f.char;
      ch.root.position.copy(f.pos);
      const d = f.pos.distanceTo(camPos);
      ch.root.visible = d < this.app.drawDist || f.isPlayer;
      const shadow = d < 38;
      if (ch.castsShadow !== shadow) { ch.castsShadow = shadow; for (const mesh of ch.meshes) mesh.castShadow = shadow; }
      if (f.isPlayer && this.ctrl.scoped) ch.root.visible = false;
      // held item
      const it = f.item;
      if (f.mode === 'ground') {
        if (!it) ch.setHeld('pickaxe', f.pickaxe);
        else if (it.kind === 'gun') ch.setHeld('gun', it.id, it.rarity);
        else if (it.kind === 'heal') ch.setHeld('heal', it.id);
        else ch.setHeld('grenade', it.id);
      } else ch.setHeld(null);
      if (!ch.root.visible) continue;
      ch.setJetpack(f.jetpack);
      ch.update(dt, {
        vx: f.vel.x, vz: f.vel.z, yaw: f.yaw, pitch: f.pitch, grounded: f.phys.grounded, crouch: f.crouch,
        sprint: f.sprint, mode: f.mode, reloadFrac: f.reloadT > 0 ? 1 - f.reloadT / f.reloadDur : -1, camDist: d, thrusting: f.thrusting,
      });
    }
    this.effects.update(dt);
    this.stormWall.update(dt);
    // listener
    const c = this.app.camera;
    const fw = new THREE.Vector3(); c.getWorldDirection(fw);
    Audio.setListener(c.position.x, c.position.y, c.position.z, Math.atan2(-fw.x, -fw.z));
    // ---- victory sequence
    if (this.victoryT > 0) { this.victoryT -= dt; if (this.victoryT <= 0) this.app.endMatch(this.result); }
    this.hud.frame(this, dt);
  }

  updateStorm(dt) {
    const S = this.storm, ph = this.phases[S.phase];
    if (ph) {
      S.timeLeft -= dt;
      if (!S.shrinking && S.timeLeft <= 0) {
        S.shrinking = true; S.timeLeft = ph.shrink; S.dps = ph.dps;
        this.hud.banner('THE STORM IS CLOSING', `Phase ${S.phase + 1}`);
        if (this.mode === 'reload' && S.phase >= RELOAD_CLOSE_PHASE && S.reloadOpen) {
          S.reloadOpen = false;
          this.hud.banner('RELOAD CLOSED', 'No more respawns — survive!');
        }
      } else if (S.shrinking) {
        const k = 1 - Math.max(0, S.timeLeft) / ph.shrink;
        S.r = S.startR + (S.nr - S.startR) * k;
        S.cx = S.startCx + (S.nx - S.startCx) * k;
        S.cz = S.startCz + (S.nz - S.startCz) * k;
        if (S.timeLeft <= 0) {
          S.r = S.nr; S.cx = S.nx; S.cz = S.nz;
          S.shrinking = false; S.phase++;
          const nph = this.phases[S.phase];
          if (nph) { S.timeLeft = nph.wait; this.pickNextCircle(); this.hud.banner('STORM EYE SHRINKS IN ' + nph.wait + 's', 'New safe zone marked on your map'); }
        }
      }
    }
    this.stormWall.set(S.cx, S.cz, S.r);
    // damage
    this.stormTick -= dt;
    const pIn = Math.hypot(this.player.pos.x - S.cx, this.player.pos.z - S.cz) > S.r && this.player.alive && this.player.mode === 'ground';
    Audio.setMuffle(pIn ? 0.35 : 0);
    if (pIn) Audio.loop('storm', 0.5); else Audio.stopLoop('storm');
    this.hud.inStorm(pIn);
    if (this.stormTick <= 0) {
      this.stormTick = 1;
      for (const f of this.fighters) {
        if (!f.alive || f.mode === 'bus') continue;
        if (Math.hypot(f.pos.x - S.cx, f.pos.z - S.cz) > S.r && (f.mode === 'ground' || S.r < 60)) this.combat.damage(f, S.dps, null, { weapon: 'storm' });
      }
    }
  }

  dispose() {
    Audio.stopAllLoops();
    this.stormWall.dispose();
    this.combat.clear();
    this.effects.clear();
    this.loot.clear();
    if (this.bus.mesh.parent) this.scene.remove(this.bus.mesh);
    for (const f of this.fighters) {
      if (f.nameTag) { f.char.root.remove(f.nameTag); f.nameTag.material.map.dispose(); f.nameTag.material.dispose(); }
      f.char.root.visible = false; f.char.setGlider(false); this.scene.remove(f.char.root);
    }
    this.fighters = [];
  }
}
