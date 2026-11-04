// Floor loot, chests, ammo boxes and dropped items.
import * as THREE from 'three';
import { RARITIES, AMMO_TYPES, FLOOR_RARITY, CHEST_RARITY, rollRarity, rollWeapon, makeGun, makeGrenade, WEAPONS } from '../data/items.js';
import { Audio } from '../core/audio.js';

const SHOW_DIST = 46;
let NEXT = 1;

export class Loot {
  constructor(game) {
    this.g = game;
    this.items = [];   // {id, item, pos, mesh, active, born}
    this.chests = [];  // {pos, rot, mesh, lid, opened, glow}
    this.boxes = [];   // ammo boxes
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.ringTex = this.makeRingTex();
    this.ringMats = RARITIES.map(r => new THREE.MeshBasicMaterial({ map: this.ringTex, color: r.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.beamMats = RARITIES.map(r => new THREE.MeshBasicMaterial({ color: r.glow, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    this.ringGeo = new THREE.PlaneGeometry(1.4, 1.4); this.ringGeo.rotateX(-Math.PI / 2);
    this.beamGeo = new THREE.CylinderGeometry(0.06, 0.18, 4, 8, 1, true); this.beamGeo.translate(0, 2, 0);
    this.ammoMats = {};
    for (const k in AMMO_TYPES) this.ammoMats[k] = new THREE.MeshStandardMaterial({ color: AMMO_TYPES[k].color, roughness: 0.5, metalness: 0.3, emissive: new THREE.Color(AMMO_TYPES[k].color), emissiveIntensity: 0.25 });
    this.ammoGeo = new THREE.BoxGeometry(0.34, 0.2, 0.22);
    this.chestMats = {
      body: new THREE.MeshStandardMaterial({ color: 0x5a3b8f, roughness: 0.5, metalness: 0.4 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xffc94d, roughness: 0.3, metalness: 0.9, emissive: 0xffa31a, emissiveIntensity: 0.6 }),
      opened: new THREE.MeshStandardMaterial({ color: 0x3a2d55, roughness: 0.8 }),
      glow: new THREE.SpriteMaterial({ map: game.textures.glow, color: 0xffd36b, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6, toneMapped: false }),
    };
    this.boxMat = new THREE.MeshStandardMaterial({ color: 0x3b6b4a, roughness: 0.6, metalness: 0.3 });
    this.boxTrim = new THREE.MeshBasicMaterial({ color: 0x7dffa0, toneMapped: false });
  }

  makeRingTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 20, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.65, 'rgba(255,255,255,0.15)'); g.addColorStop(0.85, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  clear() {
    for (const it of this.items) this.group.remove(it.mesh);
    for (const c of this.chests) this.group.remove(c.mesh);
    for (const b of this.boxes) this.group.remove(b.mesh);
    this.items = []; this.chests = []; this.boxes = [];
  }

  /** Spawn the match's loot from the world's spots. density 0..1 */
  populate(world, density = 0.8, rng = Math.random) {
    this.clear();
    const free = s => world.col.isFree(s.x, s.y + 0.05, s.z, 0.45, 1.2);
    for (const s of world.lootSpots) {
      if (rng() > density || !free(s)) continue;
      const k = rng();
      if (k < 0.72) {
        const id = rollWeapon(rng);
        this.spawn(makeGun(id, rollRarity(FLOOR_RARITY, rng)), s, false);
        this.spawn(this.ammoFor(id), { x: s.x + 0.7, y: s.y, z: s.z + 0.3 }, false);
      } else if (k < 0.88) this.spawn(makeGrenade(rng() < 0.55 ? 'shockwave' : 'overdrive', 1 + Math.floor(rng() * 2)), s, false);
      else this.spawn(this.randomAmmo(rng), s, false);
    }
    for (const s of world.chestSpots) {
      if (rng() > Math.min(1, density + 0.15) || !free(s)) continue;
      this.addChest(s);
    }
    for (const s of world.ammoSpots) {
      if (!free(s)) continue;
      this.addAmmoBox(s);
    }
  }

  ammoFor(gunId) { const t = WEAPONS[gunId].ammo; return { kind: 'ammo', id: t, count: AMMO_TYPES[t].pickup }; }
  randomAmmo(rng = Math.random) { const ks = Object.keys(AMMO_TYPES); const t = ks[Math.floor(rng() * ks.length)]; return { kind: 'ammo', id: t, count: AMMO_TYPES[t].pickup }; }

  makeMesh(item) {
    const g = new THREE.Group();
    let model;
    if (item.kind === 'gun') { model = this.g.factory.gunModel(item.id, item.rarity); model.rotation.y = Math.PI / 2; model.position.y = 0.42; }
    else if (item.kind === 'grenade') { model = this.g.factory.grenadeModel(item.id); model.scale.setScalar(1.8); model.position.y = 0.35; }
    else { model = new THREE.Mesh(this.ammoGeo, this.ammoMats[item.id]); model.position.y = 0.2; }
    g.add(model);
    g.userData.model = model;
    const rar = item.kind === 'gun' ? item.rarity : item.kind === 'grenade' ? 2 : 1;
    const ring = new THREE.Mesh(this.ringGeo, this.ringMats[rar]); ring.position.y = 0.03; ring.renderOrder = 4;
    g.add(ring);
    if (item.kind === 'gun' && item.rarity >= 2) { const b = new THREE.Mesh(this.beamGeo, this.beamMats[item.rarity]); b.renderOrder = 5; g.add(b); }
    return g;
  }

  spawn(item, pos, dropped = true, vel = null) {
    const mesh = this.makeMesh(item);
    mesh.position.set(pos.x, pos.y, pos.z);
    this.group.add(mesh);
    const rec = { id: NEXT++, item, pos: new THREE.Vector3(pos.x, pos.y, pos.z), mesh, active: true, born: this.g.time, vel: vel ? vel.clone() : null, dropped };
    this.items.push(rec);
    return rec;
  }

  /** Drop items in a little fan around a point (eliminations, chest opening, swaps). */
  drop(items, pos, spread = 1.4) {
    const col = this.g.col;
    items.forEach((item, i) => {
      if (!item) return;
      const a = (i / Math.max(1, items.length)) * Math.PI * 2 + Math.random() * 0.5;
      const v = new THREE.Vector3(Math.cos(a) * spread * 2.2, 4.5, Math.sin(a) * spread * 2.2);
      const p = new THREE.Vector3(pos.x, pos.y + 0.8, pos.z);
      const rec = this.spawn(item, p, true, v);
      rec.ground = col.groundHeight(p.x, p.z, 0.2, p.y, 0.6);
    });
  }

  addChest(s) {
    const g = new THREE.Group();
    const M = this.chestMats;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.7), M.body); body.position.y = 0.275;
    const lid = new THREE.Group(); lid.position.set(0, 0.55, -0.35);
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.22, 0.72), M.body); lidMesh.position.set(0, 0.11, 0.35);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.06, 0.74), M.trim); t1.position.set(0, 0.02, 0.35);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.05), M.trim); lock.position.set(0, -0.02, 0.73);
    lid.add(lidMesh, t1, lock);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.06, 0.74), M.trim); t2.position.y = 0.06;
    const t3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.56, 0.74), M.trim); t3.position.set(-0.45, 0.28, 0);
    const t4 = t3.clone(); t4.position.x = 0.45;
    const glow = new THREE.Sprite(M.glow); glow.scale.setScalar(2.2); glow.position.y = 0.5;
    g.add(body, lid, t2, t3, t4, glow);
    g.position.set(s.x, s.y, s.z); g.rotation.y = s.rot || 0;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.group.add(g);
    this.chests.push({ pos: new THREE.Vector3(s.x, s.y, s.z), mesh: g, lid, glow, body, opened: false, openT: 0 });
  }

  addAmmoBox(s) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.55), this.boxMat); b.position.y = 0.25;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.57), this.boxTrim); t.position.y = 0.38;
    g.add(b, t); g.position.set(s.x, s.y, s.z); g.rotation.y = Math.random() * Math.PI;
    this.group.add(g);
    this.boxes.push({ pos: new THREE.Vector3(s.x, s.y, s.z), mesh: g, opened: false });
  }

  openChest(c, f) {
    if (c.opened) return;
    c.opened = true; c.openT = 0;
    c.glow.visible = false;
    Audio.play('chest', { pos: c.pos, vol: 0.9, range: 50 });
    const id = rollWeapon();
    const items = [makeGun(id, rollRarity(CHEST_RARITY)), this.ammoFor(id), Math.random() < 0.6 ? makeGrenade(Math.random() < 0.5 ? 'shockwave' : 'overdrive', 1 + Math.floor(Math.random() * 2)) : this.randomAmmo()];
    this.drop(items, c.pos, 0.9);
    this.g.noise(f, c.pos, 25);
  }

  openBox(b, f) {
    if (b.opened) return;
    b.opened = true;
    Audio.play('ammo', { pos: b.pos, vol: 0.8, range: 30 });
    b.mesh.children[1].visible = false;
    this.drop([this.randomAmmo(), this.randomAmmo()], b.pos, 0.6);
  }

  remove(rec) {
    rec.active = false;
    this.group.remove(rec.mesh);
    const i = this.items.indexOf(rec); if (i >= 0) this.items.splice(i, 1);
  }

  /** Nearest pickup/chest within reach for a fighter. */
  nearest(f, reach = 2.0) {
    let best = null, bd = reach * reach;
    for (const it of this.items) {
      if (it.vel) continue;
      const d = it.pos.distanceToSquared(f.pos); if (d < bd && Math.abs(it.pos.y - f.pos.y) < 1.6) { bd = d; best = { type: 'item', rec: it }; }
    }
    for (const c of this.chests) {
      if (c.opened) continue;
      const d = c.pos.distanceToSquared(f.pos); if (d < bd * 1.3 && Math.abs(c.pos.y - f.pos.y) < 1.6) { bd = d; best = { type: 'chest', rec: c }; }
    }
    for (const b of this.boxes) {
      if (b.opened) continue;
      const d = b.pos.distanceToSquared(f.pos); if (d < bd && Math.abs(b.pos.y - f.pos.y) < 1.6) { bd = d; best = { type: 'box', rec: b }; }
    }
    return best;
  }

  /** Try to take an item for a fighter. Returns true if picked up. */
  take(f, rec, allowSwap = true) {
    if (!rec.active) return false;
    const res = f.addItem(rec.item, allowSwap);
    if (!res.ok) return false;
    this.remove(rec);
    if (res.dropped.length) this.drop(res.dropped, f.pos, 0.5);
    if (f.isPlayer) Audio.play(rec.item.kind === 'ammo' ? 'ammo' : 'pickup', { vol: 0.7 });
    // auto-equip the first weapon picked up
    if (rec.item.kind === 'gun' && (f.selected === 0 || !f.item) && res.slot) f.select(res.slot);
    return true;
  }

  update(dt, cam) {
    const t = this.g.time;
    const cx = cam.x, cz = cam.z;
    const col = this.g.col;
    for (const it of this.items) {
      if (it.vel) {
        it.vel.y -= 20 * dt;
        it.pos.addScaledVector(it.vel, dt);
        col.pushOut(it.pos, 0.25, 0.6);
        const g = col.groundHeight(it.pos.x, it.pos.z, 0.15, it.pos.y + 0.3, 0.4);
        if (it.pos.y <= g) { it.pos.y = g; it.vel = null; }
        it.mesh.position.copy(it.pos);
      }
      const d2 = (it.pos.x - cx) ** 2 + (it.pos.z - cz) ** 2;
      const vis = d2 < SHOW_DIST * SHOW_DIST;
      it.mesh.visible = vis;
      if (vis) {
        const m = it.mesh.userData.model;
        m.rotation.y = (it.item.kind === 'gun' ? Math.PI / 2 : 0) + Math.sin(t * 0.8 + it.id) * 0.35;
        m.position.y = (it.item.kind === 'ammo' ? 0.2 : 0.4) + Math.sin(t * 2 + it.id) * 0.05;
      }
    }
    for (const c of this.chests) {
      const d2 = (c.pos.x - cx) ** 2 + (c.pos.z - cz) ** 2;
      c.mesh.visible = d2 < 70 * 70;
      if (!c.opened && c.mesh.visible) c.glow.material.opacity = 0.45 + Math.sin(t * 4) * 0.15;
      if (c.opened && c.openT < 1) { c.openT = Math.min(1, c.openT + dt * 3); c.lid.rotation.x = -c.openT * 1.9; }
    }
    for (const b of this.boxes) b.mesh.visible = (b.pos.x - cx) ** 2 + (b.pos.z - cz) ** 2 < 60 * 60;
  }

  /** Closest unopened chest to a point (for chest hum & bots). */
  closestChest(x, z, maxD = 30) {
    let best = null, bd = maxD * maxD;
    for (const c of this.chests) { if (c.opened) continue; const d = (c.pos.x - x) ** 2 + (c.pos.z - z) ** 2; if (d < bd) { bd = d; best = c; } }
    return best;
  }
}
