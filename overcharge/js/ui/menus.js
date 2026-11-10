// Menus: auth, lobby tabs, locker, career, settings, HUD editor, results.
import { makeEmoteWheel } from './emoteWheel.js';
import { Store, validateUsername } from '../net/store.js';
import { SKINS, PICKAXES, GLIDERS, RARITY_COLORS, RARITY_NAMES } from '../data/cosmetics.js';
import { divInfo, MAX_DIV, TIERS, tierTop } from '../data/ranks.js';
import { HUD_DEFAULTS, HUD_NAMES, applyLayout } from './controls.js';
import { Audio } from '../core/audio.js';
import { esc } from './hud.js';
import { xpForLevel } from '../data/ranks.js';
import { GAME_VERSION, TEAM_SIZES, TEAM_LABELS, PLAYER_COUNTS, MAPS, DEFAULT_MAP } from '../config.js';
import { LOADOUT_ITEMS, DEFAULT_LOADOUT, normalizeLoadout, itemColor, HEALS, GRENADES, WEAPONS } from '../data/items.js';

const $ = id => document.getElementById(id);
const click = () => Audio.play('click', { vol: 0.5 });

// ------------------------------------------------------------------ rank badge
export function rankBadge(div, size = 54) {
  const d = divInfo(div);
  const t = d.tier, ti = d.tierIndex, trim = t.trim || 'rgba(255,255,255,0.8)';
  const gid = 'g' + Math.random().toString(36).slice(2, 8);
  const grad = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.light}"/><stop offset="0.55" stop-color="${t.color}"/><stop offset="1" stop-color="${t.dark}"/></linearGradient></defs>`;
  const shield = `<path d="M50 3 L92 22 L92 62 Q92 84 50 97 Q8 84 8 62 L8 22 Z" fill="url(#${gid})" stroke="${trim}" stroke-width="3"/>
    <path d="M50 14 L82 28 L82 60 Q82 77 50 87 Q18 77 18 60 L18 28 Z" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="3"/>`;
  const crown = (c, s) => `<path d="M30 20 L40 30 L50 14 L60 30 L70 20 L68 36 L32 36 Z" fill="${c}" stroke="${s}" stroke-width="2"/>`;
  let art;
  if (ti <= 2) art = shield + (ti === 2 ? crown('#fff6c0', '#8a5a00') : '');
  else if (ti === 3) art = `<path d="M8 40 Q2 26 14 18 Q12 32 22 36 Z M92 40 Q98 26 86 18 Q88 32 78 36 Z" fill="${t.light}" stroke="${t.dark}" stroke-width="2"/>` + shield;
  else if (ti === 4) art = `<path d="M50 3 L90 38 L50 97 L10 38 Z" fill="url(#${gid})" stroke="${trim}" stroke-width="3"/>
    <path d="M10 38 L90 38 M50 3 L32 38 L50 97 L68 38 Z" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>`;
  else if (ti === 5) art = `<path d="M50 0 Q60 12 56 20 Q66 10 70 2 Q78 18 70 28 Q82 22 88 12 Q94 34 82 44 L82 62 Q82 84 50 97 Q18 84 18 62 L18 44 Q6 34 12 12 Q18 22 30 28 Q22 18 30 2 Q34 10 44 20 Q40 12 50 0 Z" fill="url(#${gid})" stroke="${trim}" stroke-width="3"/>
    <path d="M50 30 L58 46 L76 48 L62 60 L66 78 L50 69 L34 78 L38 60 L24 48 L42 46 Z" fill="rgba(255,255,255,0.85)"/>`;
  else {
    // Unreal and up: a faceted star emblem; Legend adds wings, Supreme a crown and flames
    const star = `<path d="M50 4 L61 34 L94 36 L68 56 L78 92 L50 72 L22 92 L32 56 L6 36 L39 34 Z" fill="url(#${gid})" stroke="${trim}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M50 22 L56 40 L74 41 L60 52 L65 72 L50 61 L35 72 L40 52 L26 41 L44 40 Z" fill="rgba(255,255,255,0.35)"/>`;
    const wings = `<path d="M30 54 Q4 50 0 30 Q14 40 26 40 Q10 30 8 16 Q24 32 34 38 Z M70 54 Q96 50 100 30 Q86 40 74 40 Q90 30 92 16 Q76 32 66 38 Z" fill="${t.light}" stroke="${trim}" stroke-width="2"/>`;
    const flames = `<path d="M20 96 Q14 80 24 70 Q24 82 32 86 Q28 74 38 64 Q40 80 50 84 Q60 80 62 64 Q72 74 68 86 Q76 82 76 70 Q86 80 80 96 Z" fill="#ff8a1a" opacity="0.9"/>`;
    art = (ti >= 7 ? wings : '') + (ti === 8 ? flames : '') + star + (ti === 8 ? crown('#ffd24a', '#7a4a00').replace('M30 20', 'M30 12').replace('L40 30', 'L40 22').replace('L50 14', 'L50 4').replace('L60 30', 'L60 22').replace('L70 20', 'L70 12').replace('L68 36', 'L68 28').replace('L32 36', 'L32 28') : '');
  }
  return `<div class="rank-badge tier-${ti}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100">${grad}${art}</svg><b>${d.numeral}</b></div>`;
}

export function rankBlock(rank, label) {
  const d = divInfo(rank.div);
  const max = rank.div >= MAX_DIV;
  return `<div class="rank">${rankBadge(rank.div)}<div class="rank-txt">
    <div class="rank-name" style="color:${d.tier.color}">${d.name.toUpperCase()}</div>
    <div class="rank-sub">${label ? label + ' · ' : ''}${max ? 'Highest rank reached' : Math.floor(rank.rp) + '% to next rank'}</div>
    <div class="rank-bar"><div style="width:${Math.min(100, rank.rp)}%;background:linear-gradient(90deg, ${d.tier.dark}, ${d.tier.color})"></div></div>
  </div></div>`;
}

// ------------------------------------------------------------------ auth
export function initAuth(app) {
  let mode = 'create';
  document.querySelectorAll('[data-auth]').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.auth; click();
    document.querySelectorAll('[data-auth]').forEach(x => x.classList.toggle('active', x === b));
    $('auth-go').querySelector('span').textContent = mode === 'create' ? 'CREATE PLAYER' : 'SIGN IN';
    $('auth-note').textContent = mode === 'create' ? 'Your progress, ranks, locker and HUD layout are saved to the cloud.' : 'Sign in with the username and PIN you created.';
    $('auth-err').textContent = '';
  }));
  if (window.OC_PREVIEW) {
    $('auth-note').textContent = 'Preview build: your progress is saved on this device.';
    document.querySelector('[data-auth="signin"]').style.display = 'none';
  }
  $('auth-name').addEventListener('input', () => {
    const v = $('auth-name').value;
    $('auth-err').textContent = v.length >= 3 && mode === 'create' ? (validateUsername(v) || '') : '';
  });
  $('auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    Audio.unlock();
    const name = $('auth-name').value.trim(), pin = $('auth-pin').value.trim();
    const btn = $('auth-go');
    $('auth-err').textContent = '';
    btn.disabled = true; btn.querySelector('span').textContent = 'CONNECTING…';
    const res = mode === 'create' ? await Store.createAccount(name, pin) : await Store.signIn(name, pin);
    btn.disabled = false; btn.querySelector('span').textContent = mode === 'create' ? 'CREATE PLAYER' : 'SIGN IN';
    if (!res.ok) { $('auth-err').textContent = res.error; return; }
    document.activeElement && document.activeElement.blur();
    app.enterLobby(res.offline ? 'Cloud unreachable — playing offline. Progress will sync when it reconnects.' : null);
  });
}

// ------------------------------------------------------------------ lobby
export function initLobby(app) {
  document.querySelectorAll('.navtab').forEach(b => b.addEventListener('click', () => { click(); app.showTab(b.dataset.tab); }));
  document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => {
    click(); app.profile.lastMode.mode = b.dataset.mode; Store.save(); refreshModeCard(app);
  }));
  document.querySelectorAll('.m-btn').forEach(b => b.addEventListener('click', () => {
    click(); app.profile.lastMode.map = b.dataset.map; Store.save(); refreshModeCard(app);
  }));
  document.querySelectorAll('.t-btn').forEach(b => b.addEventListener('click', () => {
    click(); app.profile.lastMode.team = b.dataset.team; Store.save(); refreshModeCard(app);
  }));
  document.querySelectorAll('.q-btn').forEach(b => b.addEventListener('click', () => {
    click(); app.profile.lastMode.ranked = b.dataset.ranked === '1'; Store.save(); refreshModeCard(app);
  }));
  $('btn-play').addEventListener('click', () => { Audio.unlock(); Audio.play('uiopen', { vol: 0.7 }); app.startMatchmaking(); });
  // lobby emotes (like dancing in the Fortnite lobby before a match)
  app.lobbyWheel = makeEmoteWheel($('lobby-wheel'), id => app.startLobbyEmote(id), () => app.stopLobbyEmote());
  $('lobby-emote').addEventListener('click', () => { Audio.unlock(); click(); app.lobbyWheel.toggle(); });
  document.querySelectorAll('.ltab').forEach(b => b.addEventListener('click', () => {
    click(); document.querySelectorAll('.ltab').forEach(x => x.classList.toggle('active', x === b));
    app.lockerCat = b.dataset.cat; renderLocker(app);
  }));
  // drag to spin the lobby character
  let last = null;
  const lobby = $('lobby');
  lobby.addEventListener('pointerdown', e => { if (!e.target.closest('button, .panel, .card, input')) last = e.clientX; });
  window.addEventListener('pointermove', e => { if (last !== null) { app.lobbyScene.drag(e.clientX - last); last = e.clientX; } });
  window.addEventListener('pointerup', () => { last = null; });
}

export function refreshModeCard(app) {
  const p = app.profile, lm = p.lastMode;
  const team = TEAM_SIZES[lm.team] ? lm.team : 'solo';
  const teamLabel = TEAM_LABELS[team];
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === lm.mode);
    const n = PLAYER_COUNTS[b.dataset.mode][team];
    b.querySelector('small').textContent = b.dataset.mode === 'reload' ? (team === 'solo' ? 'Solo · 2 Respawns' : `${teamLabel} · Respawns`) : `${teamLabel} · ${n} players`;
  });
  document.querySelectorAll('.t-btn').forEach(b => b.classList.toggle('active', b.dataset.team === team));
  const map = MAPS[lm.map] ? lm.map : DEFAULT_MAP;
  document.querySelectorAll('.m-btn').forEach(b => b.classList.toggle('active', b.dataset.map === map));
  document.querySelectorAll('.q-btn').forEach(b => b.classList.toggle('active', (b.dataset.ranked === '1') === !!lm.ranked));
  $('mode-rank').innerHTML = lm.ranked ? rankBlock(p.ranked[lm.mode], lm.mode === 'br' ? 'Battle Royale' : 'Reload')
    : `<div class="rank-sub" style="padding:4px 2px">Casual playlist — practice with chill bots. Your rank isn't affected.</div>`;
  const sk = SKINS.find(s => s.id === p.locker.skin), pk = PICKAXES.find(s => s.id === p.locker.pickaxe);
  const gl = GLIDERS.find(s => s.id === p.locker.glider) || GLIDERS[0];
  $('lobby-loadout').innerHTML = `
    <div class="lo-row"><span>OUTFIT</span><b style="color:${RARITY_COLORS[sk.rarity]}">${sk.name}</b></div>
    <div class="lo-row"><span>PICKAXE</span><b style="color:${RARITY_COLORS[pk.rarity]}">${pk.name}</b></div>
    <div class="lo-row"><span>GLIDER</span><b style="color:${RARITY_COLORS[gl.rarity]}">${gl.name}</b></div>
    <div class="lo-row"><span>LOADOUT</span><span class="lo-icons">${normalizeLoadout(p.loadout).map(id => `<img src="${loadoutIcon(app, id)}" alt="">`).join('')}</span></div>
    <div class="lo-row"><span>BACK</span><b style="color:#ff9a3c">${p.jetpackStart !== false ? 'Jetpack' : 'None'}</b></div>
    <div class="lo-row"><span>BR RANK</span><b style="color:${divInfo(p.ranked.br.div).tier.color}">${divInfo(p.ranked.br.div).name}</b></div>
    <div class="lo-row"><span>RELOAD RANK</span><b style="color:${divInfo(p.ranked.reload.div).tier.color}">${divInfo(p.ranked.reload.div).name}</b></div>`;
}

export function refreshMe(app) {
  const p = app.profile;
  $('me-name').textContent = p.username;
  $('me-lvl').innerHTML = `<span style="transform:rotate(-45deg)">${p.level}</span>`;
  $('me-xpbar').style.width = (p.xp / xpForLevel(p.level) * 100) + '%';
}

// ------------------------------------------------------------------ locker
const LOCKER_CATS = {
  skins: { list: SKINS, key: 'skin', label: 'OUTFIT' },
  pickaxes: { list: PICKAXES, key: 'pickaxe', label: 'PICKAXE' },
  gliders: { list: GLIDERS, key: 'glider', label: 'GLIDER' },
};

export function renderLocker(app) {
  const p = app.profile;
  const cat = LOCKER_CATS[app.lockerCat] ? app.lockerCat : 'skins';
  const C = LOCKER_CATS[cat], list = C.list;
  const equipped = p.locker[C.key] || list[0].id;
  if (!app.lockerSel || !list.find(x => x.id === app.lockerSel)) app.lockerSel = equipped;
  // preview: gliders show you gliding with the selected one
  if (cat === 'gliders') app.lobbyScene.showGlider(app.lockerSel); else app.lobbyScene.showGlider(null);
  const grid = $('locker-grid');
  grid.innerHTML = list.map(it => {
    const img = cat === 'skins' ? app.icons['skin_' + it.id] : cat === 'pickaxes' ? app.icons['pickcard_' + it.id + '_bg'] : app.icons['glidercard_' + it.id + '_bg'];
    const ov = cat === 'pickaxes' ? app.icons['pick_' + it.id] : cat === 'gliders' ? app.icons['glider_' + it.id] : null;
    const overlay = ov ? `<img src="${ov}" style="object-fit:contain;padding:${cat === 'gliders' ? 10 : 16}px">` : '';
    return `<button class="card ${app.lockerSel === it.id ? 'sel' : ''}" data-id="${it.id}" style="border-color:${RARITY_COLORS[it.rarity]}">
      <img src="${img}">${overlay}<span class="c-tag" style="color:${RARITY_COLORS[it.rarity]}">${RARITY_NAMES[it.rarity].toUpperCase()}</span>
      ${equipped === it.id ? '<span class="c-eq" title="Equipped"><i class="ic ic-check"></i></span>' : ''}<span class="c-name">${it.name}</span></button>`;
  }).join('');
  grid.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => {
    click(); app.lockerSel = c.dataset.id; renderLocker(app);
    if (cat === 'skins') { app.lobbyScene.setSkin(c.dataset.id); app.lobbyScene.showIdle(); }
    else if (cat === 'pickaxes') app.lobbyScene.showPickaxe(c.dataset.id);
  }));
  const it = list.find(x => x.id === app.lockerSel);
  const isEq = equipped === it.id;
  $('locker-info').innerHTML = `
    <div class="li-rar" style="color:${RARITY_COLORS[it.rarity]}">${RARITY_NAMES[it.rarity].toUpperCase()} ${C.label}</div>
    <div class="li-name">${it.name}</div>
    ${it.series ? `<div class="li-series">${it.series}</div>` : ''}
    <div class="li-desc">${it.desc}</div>
    <div class="li-free">FREE · TESTING</div>
    <button class="btn ${isEq ? 'ghost' : 'primary'} wide" id="equip-btn"><span>${isEq ? 'EQUIPPED' : 'EQUIP'}</span></button>`;
  $('equip-btn').addEventListener('click', () => {
    if (isEq) return;
    Audio.play('equip', { vol: 0.8 });
    p.locker[C.key] = it.id;
    Store.save(); renderLocker(app); refreshModeCard(app);
  });
}

// ------------------------------------------------------------------ career
export async function renderCareer(app) {
  const p = app.profile, s = p.stats;
  $('career-ranks').innerHTML = `
    <div class="panel"><h3>BATTLE ROYALE <small>Ranked</small></h3>${rankBlock(p.ranked.br)}<div class="rank-sub" style="margin-top:8px">${p.ranked.br.matches} ranked matches · ${p.ranked.br.wins} wins</div></div>
    <div class="panel"><h3>RELOAD <small>Ranked</small></h3>${rankBlock(p.ranked.reload)}<div class="rank-sub" style="margin-top:8px">${p.ranked.reload.matches} ranked matches · ${p.ranked.reload.wins} wins</div></div>
    <div class="panel"><h3>LADDER</h3><div style="display:flex;gap:6px;flex-wrap:wrap">${TIERS.map((t, i) => `<div class="ladder-step">${rankBadge(tierTop(i), 40)}<span style="color:${t.color}">${t.name}</span></div>`).join('')}</div><div class="rank-sub" style="margin-top:6px">Bronze → Silver → Gold → Platinum → Diamond → Champion → Unreal → Unreal Legend → Supreme. Climb by placing high and getting eliminations.</div></div>`;
  const kd = (s.kills / Math.max(1, s.deaths)).toFixed(2);
  const wr = s.matches ? ((s.wins / s.matches) * 100).toFixed(1) : '0.0';
  $('career-stats').innerHTML = `<h3>CAREER <small style="color:var(--muted);font-family:var(--ui);font-size:12px">Level ${p.level}</small></h3><div class="stat-grid">
    <div class="stat"><b>${s.matches}</b><span>MATCHES</span></div><div class="stat"><b>${s.wins}</b><span>VICTORIES</span></div>
    <div class="stat"><b>${wr}%</b><span>WIN RATE</span></div><div class="stat"><b>${s.kills}</b><span>ELIMINATIONS</span></div>
    <div class="stat"><b>${kd}</b><span>K/D</span></div><div class="stat"><b>${s.top10}</b><span>TOP 10s</span></div>
    <div class="stat"><b>${Math.round(s.damage / 1000 * 10) / 10}k</b><span>DAMAGE</span></div><div class="stat"><b>${p.level}</b><span>LEVEL</span></div></div>`;
  const board = $('board');
  board.textContent = 'Loading…';
  const rows = await Store.fetchLeaderboard();
  if (!rows) { board.innerHTML = '<div class="rank-sub">Leaderboard needs a cloud connection.</div>'; return; }
  if (!rows.length) { board.innerHTML = '<div class="rank-sub">No ranked players yet — be the first!</div>'; return; }
  board.innerHTML = rows.map((r, i) => {
    const d = divInfo(r.div || 0);
    return `<div class="board-row ${r.uid === p.uid ? 'br-me' : ''}"><span class="br-n">${i + 1}</span>${rankBadge(r.div || 0, 26)}<span class="br-name">${esc(r.name)}</span><span class="br-rank" style="color:${d.tier.color}">${d.name} · ${Math.floor(r.rp || 0)}%</span></div>`;
  }).join('');
}

// ------------------------------------------------------------------ settings
export function renderSettings(app, container, inGame = false) {
  const S = app.profile.settings;
  const slider = (key, label, min, max, step, sub = '', fmt = v => v) => `<div class="set-row"><div>${label}<small>${sub}</small></div><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${S[key]}"><span data-v="${key}" style="width:42px;text-align:right">${fmt(S[key])}</span></div>`;
  const toggle = (key, label, sub = '') => `<div class="set-row"><div>${label}<small>${sub}</small></div><button class="toggle ${S[key] ? 'on' : ''}" data-t="${key}"></button></div>`;
  container.innerHTML = `
    <div class="set-sec"><h3>CONTROLS</h3>
      ${slider('sens', 'Look Sensitivity', 0.3, 2.5, 0.05, 'How fast swiping turns the camera', v => (+v).toFixed(2))}
      ${slider('adsSens', 'Aim (ADS) Sensitivity', 0.3, 1.5, 0.05, 'Multiplier while aiming down sights', v => (+v).toFixed(2))}
      ${slider('fov', 'Field of View', 60, 120, 1, 'How wide your camera sees. Fortnite mobile uses 80°', v => v + '°')}
      <div class="fov-preview">
        <div class="fov-view"><canvas class="fov-canvas"></canvas><div class="fov-cross"></div><div class="fov-tag">PREVIEW · <b class="fov-val">${S.fov}°</b>${S.fov === 80 ? ' · FORTNITE DEFAULT' : ''}</div></div>
        <button class="btn ghost sm fov-reset"><span>RESET TO 80° (FORTNITE)</span></button>
      </div>
      ${toggle('autoFire', 'Auto Shoot', 'Locks onto enemies near your crosshair, tracks them and fires accurately for you — no fire button needed. The closer they are, the stronger it grabs. Swipe hard to break the lock. Also toggled by the AUTO button in a match')}
      ${toggle('aimAssist', 'Aim Assist', 'Slows and gently pulls your crosshair onto nearby enemies (works with or without Auto Shoot)')}
      ${toggle('autoSprint', 'Auto Sprint', 'Sprint when the joystick is pushed all the way')}
      ${toggle('autoPickup', 'Auto Pick Up', 'Grab ammo, grenades and guns into empty slots')}
      ${toggle('invertY', 'Invert Look')}
      ${toggle('haptics', 'Vibration', 'Buzz when you take damage')}
      <div class="set-row"><div>HUD Layout<small>Move and resize every button and panel</small></div><button class="btn ghost sm" id="set-hud"><span>EDIT HUD</span></button></div>
      <div class="set-row"><div>How to Play<small>Controls, Auto Shoot, jetpack, Shockwave and more</small></div><button class="btn ghost sm" id="set-howto"><span>SHOW</span></button></div>
    </div>
    <div class="set-sec"><h3>GRAPHICS</h3>
      <div class="set-row"><div>Quality<small>Lower = smoother on older phones (full effect after restart)</small></div><div class="seg" data-seg="quality">${['low', 'medium', 'high'].map(q => `<button class="${S.quality === q ? 'on' : ''}" data-q="${q}">${q.toUpperCase()}</button>`).join('')}</div></div>
      ${toggle('dynRes', 'Dynamic Resolution', 'Off by default. Only for very slow phones: lowers sharpness slightly when the frame rate is low')}
      ${toggle('fpsCap', '60 FPS Cap', 'Saves battery and heat on 120 Hz phones')}
      ${toggle('bloom', 'Glow Effects', 'Neon lights, muzzle flashes and energy glow softly. Off on Low quality; turn off for extra frame rate')}
      ${toggle('showFps', 'Show FPS')}
    </div>
    <div class="set-sec"><h3>AUDIO</h3>
      ${slider('master', 'Master Volume', 0, 1, 0.05, '', v => Math.round(v * 100) + '%')}
      ${slider('sfx', 'Effects', 0, 1, 0.05, '', v => Math.round(v * 100) + '%')}
      ${slider('music', 'Lobby Music', 0, 1, 0.05, '', v => Math.round(v * 100) + '%')}
    </div>
    <div class="set-sec"><h3>ACCOUNT</h3>
      <div class="set-row"><div>${esc(app.profile.username)}<small>${Store.isConnected() ? 'Synced to the cloud' : 'Offline — saved on this device'}</small></div>${inGame ? '' : '<button class="btn danger sm" id="set-signout"><span>SIGN OUT</span></button>'}</div>
    </div>
    <div class="set-sec"><h3>ABOUT</h3>
      <div class="set-row"><div>OVERCHARGE v${GAME_VERSION}<small>Map: Reversal Compound · Engine: three.js · Data: Firebase Realtime Database</small></div></div>
      <div class="set-row"><div>Credits<small>Soldier model &amp; animations: Mixamo (Adobe), via the open-source “Dive” project by Mugen87 (MIT).
        Sci-Fi Assault Rifle by Ptis (CC BY-NC 4.0) · Shotgun by Harry_L (CC BY 4.0) · SciFi Blaster by Feche Pedroza (CC BY 4.0), all from Sketchfab.
        Gunshot/footstep sounds from Dive (MIT). Everything else made for this game.</small></div></div>
    </div>
    ${inGame ? '<div class="set-close"><button class="btn primary" id="set-done"><span>DONE</span></button></div>' : ''}`;
  container.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', () => {
    const k = r.dataset.k; S[k] = +r.value;
    const v = container.querySelector(`[data-v="${k}"]`);
    v.textContent = k === 'sens' || k === 'adsSens' ? (+r.value).toFixed(2) : k === 'fov' ? r.value + '°' : Math.round(r.value * 100) + '%';
    if (k === 'fov') fovPreview();
    app.applySettings(); Store.save();
  }));
  // live FOV preview
  const fovCanvas = container.querySelector('.fov-canvas');
  let fovQueued = false;
  const fovPreview = () => {
    if (fovQueued) return; fovQueued = true;
    requestAnimationFrame(() => {
      fovQueued = false;
      try { app.renderFovPreview(fovCanvas, S.fov); } catch (e) { console.warn('fov preview', e); }
      container.querySelector('.fov-tag').innerHTML = `PREVIEW · <b class="fov-val">${S.fov}°</b>${S.fov === 80 ? ' · FORTNITE DEFAULT' : ''}`;
    });
  };
  container.querySelector('.fov-reset').addEventListener('click', () => {
    click(); S.fov = 80;
    const r = container.querySelector('[data-k="fov"]'); r.value = 80;
    container.querySelector('[data-v="fov"]').textContent = '80°';
    fovPreview(); app.applySettings(); Store.save();
  });
  setTimeout(fovPreview, 60);
  container.querySelectorAll('[data-t]').forEach(t => t.addEventListener('click', () => {
    click(); const k = t.dataset.t; S[k] = !S[k]; t.classList.toggle('on', S[k]); app.applySettings(); Store.save();
  }));
  container.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    click(); S.quality = b.dataset.q; container.querySelectorAll('[data-q]').forEach(x => x.classList.toggle('on', x === b)); app.applySettings(); Store.save();
  }));
  const howBtn = container.querySelector('#set-howto');
  if (howBtn) howBtn.addEventListener('click', () => { click(); app.showHowTo(); });
  const hudBtn = container.querySelector('#set-hud');
  if (hudBtn) hudBtn.addEventListener('click', () => { click(); app.openHudEditor(inGame); });
  const so = container.querySelector('#set-signout');
  if (so) so.addEventListener('click', () => { if (window.OC_PREVIEW || confirm('Sign out of ' + app.profile.username + '? You can sign back in with your username and PIN.')) { Store.signOut(); location.reload(); } });
  const done = container.querySelector('#set-done');
  if (done) done.addEventListener('click', () => { click(); $('settings-modal').classList.remove('show'); });
}

// ------------------------------------------------------------------ HUD editor
export class HudEditor {
  constructor(app) {
    this.app = app;
    this.sel = null; this.layout = null; this.drag = null;
    const hud = $('hud');
    hud.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', e => this.move(e));
    window.addEventListener('pointerup', () => { this.drag = null; });
    $('he-size').addEventListener('input', () => this.setProp('s', $('he-size').value / 100));
    $('he-op').addEventListener('input', () => this.setProp('o', $('he-op').value / 100));
    $('he-reset').addEventListener('click', () => { click(); this.layout = {}; applyLayout(this.layout); this.select(null); });
    $('he-cancel').addEventListener('click', () => { click(); this.close(false); });
    $('he-save').addEventListener('click', () => { Audio.play('equip', { vol: 0.8 }); this.close(true); });
  }

  open(fromGame) {
    this.fromGame = fromGame;
    this.layout = JSON.parse(JSON.stringify(this.app.profile.hud || {}));
    this.original = JSON.parse(JSON.stringify(this.layout));
    $('hud').classList.add('show', 'editing');
    $('hud-editor').classList.add('show');
    if (!fromGame) $('lobby').classList.remove('show');
    this.app.hudPreview(true);
    applyLayout(this.layout);
    this.select(null);
  }

  close(save) {
    if (save) { this.app.profile.hud = this.layout; Store.save(); }
    applyLayout(this.app.profile.hud);
    $('hud').classList.remove('editing');
    $('hud-editor').classList.remove('show');
    this.app.hudPreview(false);
    if (!this.fromGame) { $('hud').classList.remove('show'); $('lobby').classList.add('show'); }
    else $('pause').classList.add('show');
  }

  get(id) { return { ...HUD_DEFAULTS[id], ...(this.layout[id] || {}) }; }

  select(id) {
    this.sel = id;
    document.querySelectorAll('.hud-el').forEach(e => e.classList.toggle('he-active', e.dataset.hud === id));
    if (!id) { $('he-sel').textContent = 'Tap a control to select it, drag to move'; return; }
    const L = this.get(id);
    $('he-sel').textContent = HUD_NAMES[id];
    $('he-size').value = Math.round(L.s * 100); $('he-size-v').textContent = Math.round(L.s * 100) + '%';
    $('he-op').value = Math.round(L.o * 100); $('he-op-v').textContent = Math.round(L.o * 100) + '%';
  }

  setProp(k, v) {
    if (!this.sel) return;
    this.layout[this.sel] = { ...this.get(this.sel), [k]: v };
    $('he-size-v').textContent = $('he-size').value + '%'; $('he-op-v').textContent = $('he-op').value + '%';
    applyLayout(this.layout);
  }

  down(e) {
    if (!$('hud').classList.contains('editing')) return;
    const el = e.target.closest('.hud-el');
    if (!el) { this.select(null); return; }
    e.preventDefault();
    const id = el.dataset.hud;
    this.select(id);
    const L = this.get(id);
    this.drag = { id, sx: e.clientX, sy: e.clientY, x0: L.x, y0: L.y };
  }

  move(e) {
    if (!this.drag) return;
    const d = this.drag;
    let x = d.x0 + (e.clientX - d.sx) / innerWidth, y = d.y0 + (e.clientY - d.sy) / innerHeight;
    // snap to a 1% grid, keep on screen
    x = Math.max(0.02, Math.min(0.98, Math.round(x * 200) / 200)); y = Math.max(0.03, Math.min(0.97, Math.round(y * 200) / 200));
    this.layout[d.id] = { ...this.get(d.id), x, y };
    applyLayout(this.layout);
  }
}

// ------------------------------------------------------------------ results
export function showResults(app, r, rewards) {
  $('results').classList.add('show');
  $('res-place').textContent = '#' + r.placement;
  const team = TEAM_SIZES[r.team] ? r.team : 'solo';
  $('res-title').textContent = r.won ? 'OVERCHARGED VICTORY' : r.placement <= (r.total > 12 ? 10 : 3) ? 'SO CLOSE!' : 'MATCH COMPLETE';
  $('res-mode').textContent = `${r.mode === 'br' ? 'BATTLE ROYALE' : 'RELOAD'} · ${TEAM_LABELS[team].toUpperCase()} · ${r.ranked ? 'RANKED' : 'UNRANKED'} · ${(MAPS[r.map] || MAPS[DEFAULT_MAP]).name.toUpperCase()}`;
  const mins = Math.floor(r.timeAlive / 60), secs = String(r.timeAlive % 60).padStart(2, '0');
  $('res-tiles').innerHTML = `
    <div class="stat"><b>${r.kills}</b><span>ELIMINATIONS</span></div>
    <div class="stat"><b>${r.damage}</b><span>DAMAGE DEALT</span></div>
    <div class="stat"><b>${mins}:${secs}</b><span>TIME SURVIVED</span></div>
    <div class="stat"><b>${r.placement}/${r.total}</b><span>${{ solo: 'PLACEMENT', duo: 'DUO PLACEMENT', squad: 'SQUAD PLACEMENT' }[team]}</span></div>`;
  $('res-squad').innerHTML = r.squad && r.squad.length > 1
    ? r.squad.map(m => `<div class="rs${m.name === app.profile.username ? ' me' : ''}"><b>${esc(m.name)}</b><span>${m.kills} elim${m.kills === 1 ? '' : 's'}</span></div>`).join('')
    : '';
  // XP
  const p = app.profile;
  $('res-lvl').textContent = rewards.levelBefore;
  $('res-xpgain').textContent = '+' + rewards.xp + ' XP';
  const fill = $('res-xpfill');
  fill.style.transition = 'none'; fill.style.width = (rewards.xpBefore / xpForLevel(rewards.levelBefore) * 100) + '%';
  void fill.offsetWidth; fill.style.transition = '';
  setTimeout(() => {
    if (p.level > rewards.levelBefore) {
      fill.style.width = '100%';
      setTimeout(() => { $('res-lvl').textContent = p.level; fill.style.transition = 'none'; fill.style.width = '0%'; void fill.offsetWidth; fill.style.transition = ''; fill.style.width = (p.xp / xpForLevel(p.level) * 100) + '%'; Audio.play('chest', { vol: 0.7 }); }, 1450);
    } else fill.style.width = (p.xp / xpForLevel(p.level) * 100) + '%';
  }, 400);
  // Rank
  const rr = $('res-rank');
  if (!r.ranked) {
    rr.innerHTML = `<div class="res-lbl">UNRANKED</div><div class="rank-sub" style="margin-top:4px">Casual match — switch to Ranked in the lobby to climb from Bronze to Gold.</div>`;
  } else {
    const rk = rewards.rank;
    const before = rewards.rankBefore;
    rr.innerHTML = `<div class="res-lbl">RANKED PROGRESS <span class="rp-delta ${rk.delta >= 0 ? 'up' : 'down'}" style="float:right">${rk.delta >= 0 ? '+' : ''}${rk.delta}%</span></div>
      <div id="rr-block" style="margin-top:6px">${rankBlock(before)}</div>
      <div class="rank-sub" style="margin-top:6px">Placement ${rk.place >= 0 ? '+' : ''}${rk.place} · Eliminations +${rk.elimPts}${rk.entry ? ` · Entry −${rk.entry}` : ''}</div>
      <div id="rr-promo"></div>`;
    setTimeout(() => {
      const block = $('rr-block');
      if (!block) return;
      if (rewards.promoted) {
        const bar = block.querySelector('.rank-bar > div');
        if (bar) bar.style.width = '100%';
        setTimeout(() => {
          block.innerHTML = rankBlock(p.ranked[r.mode]);
          $('rr-promo').innerHTML = `<div class="promo">RANK UP! ${divInfo(p.ranked[r.mode].div).name.toUpperCase()}</div>`;
          Audio.play('elim', { vol: 1 });
        }, 1300);
      } else {
        const bar = block.querySelector('.rank-bar > div');
        if (bar) bar.style.width = Math.min(100, p.ranked[r.mode].rp) + '%';
        const sub = block.querySelector('.rank-sub');
        if (sub) sub.textContent = p.ranked[r.mode].div >= MAX_DIV ? 'Highest rank reached' : Math.floor(p.ranked[r.mode].rp) + '% to next rank';
      }
    }, 700);
  }
  $('res-continue').onclick = () => { click(); $('results').classList.remove('show'); app.enterLobby(); };
}

// ------------------------------------------------------------------ loadout editor
function loadoutIcon(app, id) {
  const it = LOADOUT_ITEMS[id].make();
  return app.icons[it.kind === 'gun' ? 'gun_' + it.id : it.kind === 'heal' ? 'heal_' + it.id : 'nade_' + it.id] || '';
}

export function renderLoadout(app) {
  const p = app.profile;
  $('le-jet').classList.toggle('on', p.jetpackStart !== false);
  if (app.icons.jetpack) $('le-jet-img').src = app.icons.jetpack;
  p.loadout = normalizeLoadout(p.loadout);
  const box = $('le-slots');
  box.innerHTML = p.loadout.map((id, i) => {
    const it = LOADOUT_ITEMS[id].make();
    return `<div class="le-card ${app.lePicked === i ? 'picked' : ''}" data-i="${i}">
      <div class="le-rar" style="background:linear-gradient(0deg, ${itemColor(it)}, transparent)"></div>
      <span class="le-num">${i + 2}</span><img src="${loadoutIcon(app, id)}" alt=""><span class="le-name">${LOADOUT_ITEMS[id].label.toUpperCase()}</span></div>`;
  }).join('');
}

function commitLoadout(app, order) {
  app.profile.loadout = normalizeLoadout(order);
  Store.save();
  renderLoadout(app); refreshModeCard(app);
  Audio.play('equip', { vol: 0.7 });
}

export function initLoadout(app) {
  const box = $('le-slots');
  let drag = null;
  const cardAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.le-card') : null; };
  box.addEventListener('pointerdown', e => {
    const card = e.target.closest('.le-card'); if (!card) return;
    e.preventDefault();
    drag = { i: +card.dataset.i, x: e.clientX, y: e.clientY, moved: false, ghost: null, card };
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.ghost = drag.card.cloneNode(true); drag.ghost.classList.add('le-ghost'); drag.ghost.classList.remove('picked');
      drag.ghost.style.width = drag.card.offsetWidth + 'px';
      document.body.appendChild(drag.ghost);
      drag.card.classList.add('dragging');
    }
    drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
    box.querySelectorAll('.le-card').forEach(c => c.classList.remove('target'));
    const over = cardAt(e.clientX, e.clientY);
    if (over && over !== drag.card) over.classList.add('target');
  });
  window.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    box.querySelectorAll('.le-card').forEach(c => c.classList.remove('target', 'dragging'));
    const order = [...normalizeLoadout(app.profile.loadout)];
    if (d.moved) {
      const over = cardAt(e.clientX, e.clientY);
      if (over) {
        const to = +over.dataset.i;
        if (to !== d.i) { const [it] = order.splice(d.i, 1); order.splice(to, 0, it); app.lePicked = null; commitLoadout(app, order); return; }
      }
      renderLoadout(app); return;
    }
    // tap: pick one, tap another to swap
    if (app.lePicked === null || app.lePicked === undefined) { app.lePicked = d.i; click(); renderLoadout(app); return; }
    if (app.lePicked === d.i) { app.lePicked = null; renderLoadout(app); return; }
    const a = app.lePicked; app.lePicked = null;
    [order[a], order[d.i]] = [order[d.i], order[a]];
    commitLoadout(app, order);
  });
  $('le-reset').addEventListener('click', () => { app.lePicked = null; commitLoadout(app, [...DEFAULT_LOADOUT]); });
  $('le-jet').addEventListener('click', () => { click(); app.profile.jetpackStart = app.profile.jetpackStart === false; Store.save(); renderLoadout(app); });
}
