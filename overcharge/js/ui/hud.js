// In-game HUD: all DOM overlays driven by the match.
import * as THREE from 'three';
import { WEAPONS, GRENADES, RARITIES, itemName, itemColor } from '../data/items.js';
import { MAP_HALF, MAX_HEALTH, MAX_SHIELD } from '../config.js';

const $ = id => document.getElementById(id);
const _p = new THREE.Vector3();

export class Hud {
  constructor(app) {
    this.app = app;
    this.el = $('hud');
    this.dn = [];
    this.dnLayer = $('dmgnums');
    for (let i = 0; i < 22; i++) {
      const d = document.createElement('div'); d.className = 'dn'; d.style.display = 'none';
      this.dnLayer.appendChild(d); this.dn.push({ el: d, life: 0, pos: new THREE.Vector3(), vx: 0 });
    }
    this.mm = $('minimap').getContext('2d');
    this.bm = $('bigmap-c').getContext('2d');
    this.mmT = 0;
    this.slotKey = '';
    this.bannerT = 0; this.toastT = 0;
    this.dirEls = [];
    this.lastHurtT = 0;
    this.fpsT = 0; this.frames = 0;
    $('bigmap-close').addEventListener('click', () => this.toggleMap(false));
    $('b-pause').addEventListener('click', () => app.pause(true));
  }

  matchStart(m) {
    this.m = m;
    this.el.classList.add('show');
    ['death', 'victory', 'pause'].forEach(id => $(id).classList.remove('show', 'spectating'));
    $('bigmap').classList.remove('show');
    $('respawn').classList.remove('show');
    $('spec-tag').classList.remove('show');
    $('killfeed').innerHTML = '';
    $('h-kills').textContent = '0';
    this.slotKey = '';
    this.setAlive(m.fighters.length, m.mode === 'reload' ? m.teams : null);
    const rt = $('reload-tag');
    rt.textContent = m.mode === 'reload' ? 'RELOAD ACTIVE' : ''; rt.className = 'reload-tag' + (m.mode === 'reload' ? ' open' : '');
    this.squadUpdate(m);
    $('fps').style.display = this.app.settings().showFps ? 'block' : 'none';
  }

  hide() { this.el.classList.remove('show'); }

  // ------------------------------------------------------------ per-frame
  frame(m, dt) {
    const p = m.player;
    const spec = !p.alive && m.ctrl.spectating && m.ctrl.spectating.alive ? m.ctrl.spectating : null;
    const f = spec || p;
    // bars
    $('hp-fill').style.width = (f.health / MAX_HEALTH * 100) + '%';
    $('sh-fill').style.width = (f.shield / MAX_SHIELD * 100) + '%';
    $('hp-num').textContent = Math.ceil(f.health);
    $('sh-num').textContent = Math.ceil(f.shield);
    const od = $('od');
    if (f.overdriveT > 0) { od.classList.add('show'); $('od-fill').style.width = (f.overdriveT / GRENADES.overdrive.buffTime * 100) + '%'; } else od.classList.remove('show');
    // slots
    this.updateSlots(f);
    // ammo
    const w = f.weapon, it = f.item;
    if (w) {
      $('ammo-mag').textContent = f.reloading ? 'RELOADING' : it.mag;
      $('ammo-res').textContent = f.reloading ? '' : '/ ' + f.ammo[w.ammo];
    } else if (it && it.kind === 'grenade') { $('ammo-mag').textContent = '×' + it.count; $('ammo-res').textContent = GRENADES[it.id].short; }
    else { $('ammo-mag').textContent = ''; $('ammo-res').textContent = ''; }
    // crosshair
    const ch = $('crosshair');
    const scoped = m.ctrl.scoped;
    $('scope').classList.toggle('on', !!scoped);
    if (!p.alive || p.mode !== 'ground' || scoped) ch.classList.add('hidden');
    else {
      ch.classList.remove('hidden');
      const style = w ? w.crosshair : 'dot';
      ch.className = 'ch-' + style + (m.ctrl.autoTarget && m.time < m.ctrl.autoUntil ? ' target' : '') + (m.ctrl.assistTarget ? ' target' : '');
      if (w) {
        const spread = (p.ads ? w.ads : w.hip) + p.bloom + (Math.hypot(p.vel.x, p.vel.z) > 1 ? w.moveSpread : 0);
        const px = Math.max(4, Math.tan(spread) / Math.tan(m.app.camera.fov * Math.PI / 360) * innerHeight / 2);
        this.setCross(ch, style === 'circle' ? px : px + 2);
      } else this.setCross(ch, 6);
    }
    // interact button
    const t = m.ctrl.interactTarget, ib = $('b-interact');
    if (t && p.alive) {
      ib.classList.add('show');
      const txt = $('interact-txt');
      if (t.type === 'item') { txt.textContent = (t.rec.item.kind === 'gun' && !p.hasEmptySlot() ? 'SWAP · ' : 'PICK UP · ') + itemName(t.rec.item) + (t.rec.item.count > 1 ? ' ×' + t.rec.item.count : ''); ib.style.borderColor = itemColor(t.rec.item); }
      else if (t.type === 'chest') { txt.textContent = 'OPEN CHEST'; ib.style.borderColor = '#ffc94d'; }
      else { txt.textContent = 'OPEN AMMO BOX'; ib.style.borderColor = '#7dffa0'; }
    } else ib.classList.remove('show');
    // storm timer
    const S = m.storm;
    $('h-storm').textContent = S.phase >= m.phases.length ? '—' : fmt(Math.max(0, S.timeLeft));
    $('h-storm').style.color = S.shrinking ? '#c58bff' : '#fff';
    // damage numbers
    for (const d of this.dn) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) { d.el.style.display = 'none'; continue; }
      d.pos.y += dt * 0.9;
      _p.copy(d.pos).project(m.app.camera);
      if (_p.z > 1) { d.el.style.display = 'none'; continue; }
      d.el.style.display = 'block';
      const x = (_p.x * 0.5 + 0.5) * innerWidth + d.vx * (1 - d.life), y = (-_p.y * 0.5 + 0.5) * innerHeight;
      const k = Math.min(1, d.life * 3);
      d.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${0.8 + (1 - Math.min(1, (0.9 - d.life) * 4)) * 0.6})`;
      d.el.style.opacity = k;
    }
    // timers
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').classList.remove('show'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').classList.remove('show'); }
    this.lastHurtT -= dt;
    $('vignette').style.opacity = Math.max(0, Math.min(0.9, this.lastHurtT * 1.5)) + (p.alive && p.health < 30 ? 0.35 : 0);
    // minimap
    this.mmT -= dt;
    if (this.mmT <= 0) { this.mmT = 0.08; this.drawMinimap(m, f); if ($('bigmap').classList.contains('show')) this.drawBigMap(m); }
    if (spec) $('spec-tag').textContent = 'SPECTATING · ' + spec.name;
    // fps
    this.frames++; this.fpsT += dt;
    if (this.fpsT > 0.5) { $('fps').textContent = Math.round(this.frames / this.fpsT) + ' FPS'; this.frames = 0; this.fpsT = 0; }
  }

  setCross(ch, gap) {
    if (this._gap === Math.round(gap)) return;
    this._gap = Math.round(gap);
    ch.style.setProperty('--g', gap + 'px');
    const [a, b, c, d] = ch.querySelectorAll('i');
    const L = 9, T = 2;
    a.style.cssText = `left:${-T / 2}px; top:${-gap - L}px; width:${T}px; height:${L}px`;
    b.style.cssText = `left:${-T / 2}px; top:${gap}px; width:${T}px; height:${L}px`;
    c.style.cssText = `left:${-gap - L}px; top:${-T / 2}px; width:${L}px; height:${T}px`;
    d.style.cssText = `left:${gap}px; top:${-T / 2}px; width:${L}px; height:${T}px`;
  }

  updateSlots(f) {
    const key = f.selected + '|' + f.slots.map(s => s ? `${s.kind}${s.id}${s.rarity ?? ''}${s.count ?? ''}` : '-').join(',') + '|' + (f.reloading ? 1 : 0) + f.pickaxe;
    if (key === this.slotKey) {
      if (f.reloading) { const r = this.slotsEl?.querySelector('.slot.sel .s-rel'); if (r) r.style.width = ((1 - f.reloadT / f.reloadDur) * 100) + '%'; }
      return;
    }
    this.slotKey = key;
    const el = $('slots');
    this.slotsEl = el;
    const icons = this.app.icons;
    let html = `<div class="slot ${f.selected === 0 ? 'sel' : ''}" data-i="0"><img src="${icons['pick_' + f.pickaxe] || ''}"><span class="s-key">1</span></div>`;
    f.slots.forEach((s, i) => {
      let inner = '';
      if (s) {
        const col = s.kind === 'gun' ? RARITIES[s.rarity].color : s.id === 'shockwave' ? '#4fb6ff' : '#ffe14d';
        inner = `<div class="s-rar" style="background:linear-gradient(0deg, ${col}, transparent 75%)"></div><img src="${icons[s.kind === 'gun' ? 'gun_' + s.id : 'nade_' + s.id] || ''}">` +
          (s.kind === 'grenade' ? `<span class="s-cnt">${s.count}</span>` : '') + (f.selected === i + 1 && f.reloading ? '<div class="s-rel"></div>' : '');
      }
      html += `<div class="slot ${f.selected === i + 1 ? 'sel' : ''}" data-i="${i + 1}">${inner}<span class="s-key">${i + 2}</span></div>`;
    });
    el.innerHTML = html;
  }

  // ------------------------------------------------------------ events
  setAlive(n, teams) { $('h-alive').textContent = teams ? `${teams}` : n; $('h-alive').parentElement.title = teams ? 'Squads left' : 'Players left'; }

  killfeed(msg, myTeam) {
    const kf = $('killfeed');
    const name = (n, team) => `<b class="${n === this.m.player.name ? 'me' : team === myTeam ? 'mate' : ''}">${esc(n)}</b>`;
    const d = document.createElement('div'); d.className = 'kf';
    d.innerHTML = msg.a ? `${name(msg.a, msg.aTeam)} <em>${msg.head ? '🎯 ' : ''}eliminated</em> ${name(msg.b, msg.bTeam)} <em>· ${msg.how}</em>` : `${name(msg.b, msg.bTeam)} <em>${msg.how}</em>`;
    kf.appendChild(d);
    while (kf.children.length > 4) kf.removeChild(kf.firstChild);
    setTimeout(() => d.remove(), 7000);
    $('h-kills').textContent = this.m.player.kills;
  }

  banner(title, sub = '', time = 3.2) {
    const b = $('banner');
    b.querySelector('.b-title').textContent = title; b.querySelector('.b-sub').textContent = sub;
    b.classList.add('show'); this.bannerT = time;
  }

  toast(text, cls = '') { const t = $('toast'); t.textContent = text; t.className = 'show ' + cls; this.toastT = 2.4; }

  elimPopup(name) {
    const e = $('elimpop');
    e.innerHTML = `ELIMINATED <b>${esc(name)}</b>`;
    e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
  }

  hitmarker(head, kill) {
    const h = $('hitmarker');
    h.className = (head ? 'head ' : '') + (kill ? 'kill' : '');
    void h.offsetWidth; h.classList.add('show');
  }

  damageNumber(pos, amount, type) {
    const d = this.dn.find(x => x.life <= 0) || this.dn[0];
    d.life = 0.9; d.pos.copy(pos); d.pos.y += 0.3; d.vx = (Math.random() - 0.5) * 60;
    d.el.textContent = amount; d.el.className = 'dn ' + type;
  }

  hurt(attacker, amount, shield) {
    this.lastHurtT = Math.min(0.6, 0.25 + amount / 100);
    if (!attacker || !this.m) return;
    const p = this.m.player;
    const ang = Math.atan2(attacker.pos.x - p.pos.x, attacker.pos.z - p.pos.z) - this.m.ctrl.yaw;
    const d = document.createElement('div'); d.className = 'dd';
    d.style.transform = `rotate(${-ang}rad)`;
    $('dmgdir').appendChild(d);
    setTimeout(() => { d.style.opacity = 0; }, 400);
    setTimeout(() => d.remove(), 1100);
  }

  inStorm(on) { $('storm-tint').classList.toggle('on', on); }

  onFire() { /* crosshair bloom is drawn from the player's state each frame */ }

  busInfo(inBus, bus) {
    const h = $('bus-hint');
    if (inBus) { h.classList.add('show'); h.innerHTML = `TAP <span style="color:var(--y)">JUMP</span> TO DROP<small>Pick your landing spot — the dropship leaves the compound soon</small>`; }
    else h.classList.remove('show');
  }

  respawning(sec) {
    const r = $('respawn');
    if (sec > 0 && this.m && !this.m.player.alive) { r.classList.add('show'); r.innerHTML = `REDEPLOYING IN ${sec}<small>Your squad is still in the fight</small>`; }
    else r.classList.remove('show');
    if (sec <= 0) r.classList.remove('show');
  }

  squadUpdate(m) {
    const sq = $('squad');
    if (m.mode !== 'reload') { sq.innerHTML = ''; return; }
    sq.innerHTML = m.fighters.filter(f => f.team === m.player.team).map(f =>
      `<div class="sq ${f.alive ? '' : 'dead'}" data-id="${f.id}"><span class="sq-n" style="color:${f.isPlayer ? 'var(--y)' : 'var(--c)'}">${esc(f.name)}</span><div class="sq-b"><i style="width:${f.alive ? f.health : 0}%"></i></div></div>`).join('');
    clearTimeout(this._sqT);
    this._sqT = setTimeout(() => { if (this.m === m && !m.ended) this.squadUpdate(m); }, 1000);
    if (m.mode === 'reload') {
      const rt = $('reload-tag');
      rt.textContent = m.storm.reloadOpen ? 'RELOAD ACTIVE' : 'RELOAD CLOSED';
      rt.className = 'reload-tag ' + (m.storm.reloadOpen ? 'open' : 'closed');
    }
  }

  playerEliminated(killer, placement, result) {
    const d = $('death');
    $('respawn').classList.remove('show');
    $('death-by').innerHTML = killer ? `by <b style="color:var(--red)">${esc(killer.name)}</b>` : 'by the storm';
    $('death-place').textContent = '#' + placement;
    $('death-stats').textContent = `${result.kills} eliminations · ${result.damage} damage`;
    d.classList.remove('spectating');
    d.classList.add('show');
    $('death-spec').style.display = this.m.ctrl.spectating ? '' : 'none';
    $('death-spec').onclick = () => { d.classList.add('spectating'); $('spec-tag').classList.add('show'); };
    $('death-leave').onclick = () => this.app.endMatch(this.m.result);
  }

  victory() {
    $('death').classList.remove('show');
    $('victory').classList.add('show');
  }

  toggleMap(force) {
    const b = $('bigmap');
    const on = force !== undefined ? force : !b.classList.contains('show');
    b.classList.toggle('show', on);
    if (on && this.m) this.drawBigMap(this.m);
  }

  // ------------------------------------------------------------ maps
  w2m(x, z, size) { return [(x + MAP_HALF) / (MAP_HALF * 2) * size, (z + MAP_HALF) / (MAP_HALF * 2) * size]; }

  drawStorm(ctx, S, toPx, scale, w, h) {
    // purple fill outside the current circle
    const [cx, cy] = toPx(S.cx, S.cz);
    ctx.save();
    ctx.beginPath(); ctx.rect(-10, -10, w + 20, h + 20); ctx.arc(cx, cy, Math.max(0, S.r * scale), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(130, 50, 230, 0.42)'; ctx.fill('evenodd');
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, S.r * scale), 0, Math.PI * 2);
    ctx.strokeStyle = '#b77cff'; ctx.lineWidth = 2; ctx.stroke();
    if (S.phase < this.m.phases.length) {
      const [nx, ny] = toPx(S.nx, S.nz);
      ctx.beginPath(); ctx.arc(nx, ny, Math.max(0, S.nr * scale), 0, Math.PI * 2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  drawArrow(ctx, x, y, yaw, color, size = 9) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-yaw + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.7, size * 0.8); ctx.lineTo(0, size * 0.35); ctx.lineTo(-size * 0.7, size * 0.8); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  drawMinimap(m, f) {
    const ctx = this.mm, W = 300, H = 300;
    const view = 140; // metres shown
    const scale = W / view;
    const cx = f.mode === 'bus' ? m.bus.pos.x : f.pos.x, cz = f.mode === 'bus' ? m.bus.pos.z : f.pos.z;
    const toPx = (x, z) => [(x - cx) * scale + W / 2, (z - cz) * scale + H / 2];
    ctx.fillStyle = '#1c1640'; ctx.fillRect(0, 0, W, H);
    const img = this.app.mapImage;
    if (img) {
      const s = img.width / (MAP_HALF * 2);
      ctx.drawImage(img, (cx - view / 2 + MAP_HALF) * s, (cz - view / 2 + MAP_HALF) * s, view * s, view * s, 0, 0, W, H);
    }
    this.drawStorm(ctx, m.storm, toPx, scale, W, H);
    if (m.bus.active) {
      const a = toPx(m.bus.start.x, m.bus.start.z), b = toPx(m.bus.start.x + m.bus.dir.x * m.bus.len, m.bus.start.z + m.bus.dir.z * m.bus.len);
      ctx.strokeStyle = 'rgba(255,225,77,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
      const bp = toPx(m.bus.pos.x, m.bus.pos.z);
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(bp[0], bp[1], 6, 0, Math.PI * 2); ctx.fill();
    }
    // teammates
    for (const o of m.fighters) {
      if (o === f || o.team !== m.player.team || !o.alive || o.mode === 'bus') continue;
      const [x, y] = toPx(o.pos.x, o.pos.z);
      this.drawArrow(ctx, x, y, o.yaw, '#4ff2ff', 7);
    }
    if (f.mode !== 'bus') this.drawArrow(ctx, W / 2, H / 2, f === m.player ? m.ctrl.yaw : f.yaw, '#ffe14d', 11);
    // north marker
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = 'bold 20px Rajdhani, sans-serif'; ctx.fillText('N', W / 2 - 6, 20);
  }

  drawBigMap(m) {
    const ctx = this.bm, W = 900;
    const scale = W / (MAP_HALF * 2);
    const toPx = (x, z) => this.w2m(x, z, W);
    ctx.fillStyle = '#1c1640'; ctx.fillRect(0, 0, W, W);
    if (this.app.mapImage) ctx.drawImage(this.app.mapImage, 0, 0, W, W);
    this.drawStorm(ctx, m.storm, toPx, scale, W, W);
    ctx.font = 'bold 22px "Russo One", sans-serif'; ctx.textAlign = 'center';
    for (const p of m.world.pois) {
      const [x, y] = toPx(p.x, p.z);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(p.name.toUpperCase(), x + 2, y + 2);
      ctx.fillStyle = '#fff'; ctx.fillText(p.name.toUpperCase(), x, y);
    }
    if (m.bus.active) {
      const a = toPx(m.bus.start.x, m.bus.start.z), b = toPx(m.bus.start.x + m.bus.dir.x * m.bus.len, m.bus.start.z + m.bus.dir.z * m.bus.len);
      ctx.strokeStyle = 'rgba(255,225,77,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
      const bp = toPx(m.bus.pos.x, m.bus.pos.z);
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(bp[0], bp[1], 9, 0, Math.PI * 2); ctx.fill();
    }
    for (const o of m.fighters) {
      if (o.team !== m.player.team || !o.alive || o.mode === 'bus') continue;
      const [x, y] = toPx(o.pos.x, o.pos.z);
      this.drawArrow(ctx, x, y, o.isPlayer ? m.ctrl.yaw : o.yaw, o.isPlayer ? '#ffe14d' : '#4ff2ff', o.isPlayer ? 14 : 10);
    }
  }
}

function fmt(s) { s = Math.ceil(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
export function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
