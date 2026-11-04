// OVERCHARGE — app bootstrap and state machine.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { QUALITY, GAME_VERSION, MAP_HALF } from './config.js';
import { Store } from './net/store.js';
import { Assets } from './core/assets.js';
import { Audio } from './core/audio.js';
import { World } from './game/world.js';
import { NavGrid } from './game/nav.js';
import { CharacterFactory } from './game/characters.js';
import { Effects } from './game/effects.js';
import { Loot } from './game/loot.js';
import { Match } from './game/match.js';
import { Controls, applyLayout } from './ui/controls.js';
import { Hud } from './ui/hud.js';
import { LobbyScene } from './ui/lobbyScene.js';
import { renderIcons, renderMapImage } from './ui/icons.js';
import { initAuth, initLobby, initLoadout, renderLoadout, refreshModeCard, refreshMe, renderLocker, renderCareer, renderSettings, HudEditor, showResults } from './ui/menus.js';
import { rankedDelta, applyRanked, botSkillFor, xpForLevel } from './data/ranks.js';

const $ = id => document.getElementById(id);
const TIPS = [
  'Throw a Shockwave Grenade at your feet to launch out of a bad fight — no fall damage!',
  'Overdrive Grenades shock enemies and supercharge you and your squad: faster moves, faster fire.',
  'Your overshield regenerates after 5 seconds without taking damage. Break line of sight to recharge.',
  'Every elimination restores 50 health or shield.',
  'In Reload, you redeploy as long as a squadmate is standing — until the storm closes Reload.',
  'Ranked climbs from Bronze to Gold. High placements and eliminations earn the most progress.',
  'Customize every button in Settings → HUD Layout. Drag to move, slider to resize.',
  'Auto Fire shoots as soon as your crosshair is on an enemy. Toggle it in Settings.',
  'Chests hum when you are close. Listen for them!',
  'Footsteps are directional — headphones help you hear where enemies are coming from.',
];

class App {
  constructor() {
    this.state = 'loading';
    this.match = null;
    this.paused = false;
    this.clock = new THREE.Clock();
    this.drawDist = 170;
    this.lockerCat = 'skins';
  }

  settings() { return (this.profile && this.profile.settings) || { quality: 'medium', haptics: true, showFps: false }; }

  // ================================================================ boot
  async boot() {
    $('ld-ver').textContent = 'v' + GAME_VERSION;
    this.loadingFx();
    let tipI = Math.floor(Math.random() * TIPS.length);
    $('ld-tip').textContent = TIPS[tipI];
    this.tipTimer = setInterval(() => { tipI = (tipI + 1) % TIPS.length; $('ld-tip').textContent = TIPS[tipI]; }, 4200);
    const progress = (f, label) => { $('ld-fill').style.width = (f * 100).toFixed(1) + '%'; $('ld-pct').textContent = Math.round(f * 100) + '%'; if (label) $('ld-status').textContent = label; };
    // quality from a previously saved profile
    let saved = null; try { saved = JSON.parse(localStorage.getItem('oc_profile') || 'null'); } catch { saved = null; }
    this.quality = saved?.settings?.quality || (Math.min(screen.width, screen.height) < 500 ? 'medium' : 'high');
    this.initRenderer();
    Store.init();
    Store.onConnection(on => { const d = $('net-dot'); if (d) { d.className = 'net ' + (on ? 'on' : 'off'); d.title = on ? 'Connected to cloud' : 'Offline'; } });
    const profileP = Store.loadLocal().catch(() => null);
    try {
      await Assets.load((f, l) => progress(f * 0.62, l));
      this.textures = Assets.tex;
      progress(0.64, 'Building Reversal Compound…'); await frame();
      this.world = new World(this.textures, this.quality).build();
      progress(0.72, 'Mapping routes…'); await frame();
      this.nav = new NavGrid(this.world.col, MAP_HALF, 2, 0.45);
      progress(0.76, 'Suiting up soldiers…'); await frame();
      this.setupGameScene();
      this.factory = new CharacterFactory(Assets, this.renderer);
      this.charPool = [];
      for (let i = 0; i < 30; i++) {
        this.charPool.push(this.factory.create({ shadows: QUALITY[this.quality].shadows }));
        if (i % 6 === 5) { progress(0.76 + (i / 30) * 0.1, 'Suiting up soldiers…'); await frame(); }
      }
      this.effects = new Effects(this.gameScene, this.textures, this.quality);
      this.loot = new Loot({ scene: this.gameScene, factory: this.factory, textures: this.textures, time: 0, col: this.world.col, noise() {} });
      progress(0.88, 'Drawing the map…'); await frame();
      this.mapImage = renderMapImage(this.renderer, this.world, 1024);
      this.icons = renderIcons(this.renderer, this.factory, this.env);
      progress(0.93, 'Warming up…'); await frame();
      this.lobbyScene = new LobbyScene(this.factory, this.env, this.textures);
      this.hud = new Hud(this);
      this.controls = new Controls($('hud'));
      this.input = this.controls;
      this.controls.onMap = () => this.hud.toggleMap();
      this.controls.onPause = () => this.pause(!this.paused);
      this.controls.onAutoToggle = () => {
        const S = this.profile.settings; S.autoFire = !S.autoFire; Store.save();
        this.hud.toast(S.autoFire ? 'AUTO SHOOT ON' : 'AUTO SHOOT OFF', S.autoFire ? 'cyan' : '');
        Audio.play('click', { vol: 0.6 });
      };
      this.hudEditor = new HudEditor(this);
      this.compileShaders();
      progress(0.97, 'Connecting…');
    } catch (e) {
      console.error(e);
      $('ld-status').textContent = 'Failed to load: ' + e.message;
      $('ld-status').style.color = '#ff4d6a';
      return;
    }
    const profile = await profileP;
    progress(1, 'Ready');
    clearInterval(this.tipTimer);
    initAuth(this); initLobby(this); initLoadout(this);
    this.bindGlobal();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
    await new Promise(r => setTimeout(r, 350));
    $('loading').classList.remove('show');
    if (profile) this.enterLobby();
    else { this.state = 'auth'; $('auth').classList.add('show'); this.renderLobbyBehind = true; }
  }

  initRenderer() {
    const Q = QUALITY[this.quality];
    const r = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: Q.antialias, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
    r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = Q.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    const pm = new THREE.PMREMGenerator(r);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 900);
  }

  setupGameScene() {
    const s = new THREE.Scene();
    const fogC = 0x8f8ad6;
    s.fog = new THREE.FogExp2(fogC, this.quality === 'low' ? 0.0135 : 0.0102);
    s.background = new THREE.Color(fogC);
    s.environment = this.env; s.environmentIntensity = 0.35;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); vec3 hor = vec3(0.56,0.54,0.84); vec3 top = vec3(0.24,0.18,0.55); gl_FragColor = vec4(mix(hor, top, pow(h, 0.6)), 1.0); }',
    }));
    sky.renderOrder = -10; sky.frustumCulled = false;
    this.sky = sky; s.add(sky);
    s.add(new THREE.HemisphereLight(0xcfc6ff, 0x4a3f7a, 1.75));
    const sun = new THREE.DirectionalLight(0xfff1e0, 1.65);
    sun.position.set(40, 80, 25);
    const Q = QUALITY[this.quality];
    if (Q.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
      const c = sun.shadow.camera; c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 220;
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    }
    s.add(sun); s.add(sun.target);
    this.sun = sun;
    s.add(this.world.group);
    this.gameScene = s;
    this.drawDist = Q.drawDist;
  }

  compileShaders() {
    // compile game + lobby materials up front so the first frames do not hitch
    const tmp = this.charPool.slice(0, 3);
    tmp.forEach((c, i) => { c.setSkin(['default', 'shock', 'platinum'][i]); c.setHeld('gun', 'ar', 2); this.gameScene.add(c.root); });
    try { this.renderer.compile(this.gameScene, this.camera); this.renderer.compile(this.lobbyScene.scene, this.lobbyScene.camera); } catch (e) { console.warn(e); }
    tmp.forEach(c => this.gameScene.remove(c.root));
  }

  loadingFx() {
    const c = $('ld-bolts'), x = c.getContext('2d');
    let alive = true;
    const bolt = () => {
      if (!$('loading').classList.contains('show')) { alive = false; return; }
      c.width = innerWidth; c.height = innerHeight;
      x.clearRect(0, 0, c.width, c.height);
      if (Math.random() < 0.5) {
        let px = Math.random() * c.width, py = 0;
        x.strokeStyle = Math.random() < 0.5 ? 'rgba(79,242,255,0.7)' : 'rgba(185,140,255,0.7)';
        x.lineWidth = 2; x.shadowColor = x.strokeStyle; x.shadowBlur = 16;
        x.beginPath(); x.moveTo(px, py);
        while (py < c.height * 0.6) { px += (Math.random() - 0.5) * 60; py += 20 + Math.random() * 30; x.lineTo(px, py); }
        x.stroke();
      }
      setTimeout(() => { x.clearRect(0, 0, c.width, c.height); if (alive) setTimeout(bolt, 300 + Math.random() * 900); }, 90);
    };
    bolt();
  }

  bindGlobal() {
    const unlock = () => {
      Audio.unlock();
      if (this.state === 'lobby') Audio.loop('music', 0.8, true);
    };
    // iOS only unlocks Web Audio inside certain gestures, so listen to all of them
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { passive: true });
    // block pinch-zoom and double-tap zoom (iOS ignores user-scalable=no)
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
    let lastTouch = 0;
    document.addEventListener('touchend', e => { const now = Date.now(); if (now - lastTouch < 300 && !e.target.closest('input')) e.preventDefault(); lastTouch = now; }, { passive: false });
    this.setupInstall();
    document.addEventListener('visibilitychange', () => {
      if (!Audio.ctx) return;
      if (document.hidden) { Audio.ctx.suspend(); if (this.state === 'match' && !this.paused) this.pause(true); }
      else Audio.ctx.resume();
    });
    $('p-resume').addEventListener('click', () => this.pause(false));
    $('p-leave').addEventListener('click', () => {
      if (!this.match) return;
      if (!this.match.result) { this.match.player.alive && this.match.combat.damage(this.match.player, 9999, null, { weapon: 'storm' }); }
      this.pause(false);
      this.endMatch(this.match.result);
    });
    $('p-settings').addEventListener('click', () => { renderSettings(this, $('settings2'), true); $('settings-modal').classList.add('show'); });
    $('p-hud').addEventListener('click', () => { $('pause').classList.remove('show'); this.openHudEditor(true); });
    $('mm-cancel').addEventListener('click', () => { clearInterval(this.mmTimer); clearTimeout(this.mmDone); $('mm').classList.remove('show'); this.state = 'lobby'; });
  }

  setupInstall() {
    const box = $('install'), msg = $('install-msg'), go = $('install-go');
    let dismissed = false; try { dismissed = localStorage.getItem('oc_install_x') === '1'; } catch { /* storage blocked */ }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (standalone || dismissed || window.OC_PREVIEW) return;
    if (ios) {
      msg.innerHTML = 'In Safari tap <i class="share"></i> <b style="display:inline;color:#fff;font-family:inherit">Share</b>, then <b style="display:inline;color:#fff;font-family:inherit">Add to Home Screen</b> for full screen.';
      box.classList.add('show');
    }
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); this.installEvt = e;
      msg.textContent = 'Install OVERCHARGE to launch it full screen from your home screen.';
      go.style.display = ''; box.classList.add('show');
    });
    go.addEventListener('click', async () => { if (!this.installEvt) return; this.installEvt.prompt(); await this.installEvt.userChoice.catch(() => {}); this.installEvt = null; box.classList.remove('show'); });
    $('install-x').addEventListener('click', () => { box.classList.remove('show'); try { localStorage.setItem('oc_install_x', '1'); } catch { /* storage blocked */ } });
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.lobbyScene && this.lobbyScene.resize(w, h);
    this.effects && this.effects.setViewport(h * this.renderer.getPixelRatio());
    if (this.profile) applyLayout(this.hudEditor && document.getElementById('hud').classList.contains('editing') ? this.hudEditor.layout : this.profile.hud);
  }

  applySettings() {
    const S = this.profile.settings;
    Audio.setVolumes({ master: S.master, sfx: S.sfx, music: S.music });
    const Q = QUALITY[S.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
    this.renderer.shadowMap.enabled = Q.shadows && QUALITY[this.quality].shadows;
    this.drawDist = Q.drawDist;
    this.resize();
    $('fps').style.display = S.showFps ? 'block' : 'none';
    if (this.match) this.match.ctrl.settings = S;
  }

  // ================================================================ screens
  enterLobby(notice) {
    this.profile = Store.profile;
    if (!this.profile) { $('auth').classList.add('show'); return; }
    this.state = 'lobby';
    ['auth', 'results', 'mm'].forEach(id => $(id).classList.remove('show'));
    $('lobby').classList.add('show');
    this.hud.hide();
    this.applySettings();
    applyLayout(this.profile.hud);
    this.lobbyScene.setSkin(this.profile.locker.skin);
    this.lobbyScene.showGun();
    refreshMe(this); refreshModeCard(this);
    this.showTab('play');
    Audio.stopAllLoops();
    Audio.loop('music', 0.8, true);
    if (notice) setTimeout(() => alert(notice), 50);
  }

  showTab(tab) {
    document.querySelectorAll('.navtab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('show', p.dataset.pane === tab));
    this.lobbyScene.layout(tab);
    if (tab === 'locker') { this.lockerSel = null; renderLocker(this); }
    else { this.lobbyScene.setSkin(this.profile.locker.skin); this.lobbyScene.showGun(); }
    if (tab === 'loadout') { this.lePicked = null; renderLoadout(this); }
    if (tab === 'career') renderCareer(this);
    if (tab === 'settings') renderSettings(this, $('settings'));
    if (tab === 'play') refreshModeCard(this);
  }

  openHudEditor(fromGame) {
    $('settings-modal').classList.remove('show');
    this.hudEditor.open(fromGame);
  }

  /** Fill the HUD with sample content while editing from the lobby. */
  hudPreview(on) {
    if (on && !this.match) {
      const fake = { selected: 1, slots: [{ kind: 'gun', id: 'ar', rarity: 3, mag: 30 }, { kind: 'gun', id: 'shotgun', rarity: 2, mag: 5 }, { kind: 'grenade', id: 'shockwave', count: 2 }, { kind: 'grenade', id: 'overdrive', count: 1 }, null], pickaxe: this.profile.locker.pickaxe, reloading: false };
      this.hud.slotKey = '';
      this.hud.updateSlots(fake);
      $('ammo-mag').textContent = '30'; $('ammo-res').textContent = '/ 120';
      $('hp-fill').style.width = '100%'; $('sh-fill').style.width = '100%'; $('hp-num').textContent = 100; $('sh-num').textContent = 50;
      const ctx = $('minimap').getContext('2d'); ctx.drawImage(this.mapImage, 380, 380, 260, 260, 0, 0, 300, 300);
      $('interact-txt').textContent = 'PICK UP · Epic Assault Rifle';
      this.controls.enabled = false;
    } else if (!on && this.match) this.controls.enabled = true;
  }

  pause(on) {
    if (this.state !== 'match') return;
    this.paused = on;
    $('pause').classList.toggle('show', on);
    if (on) { this.controls.reset(); if (document.pointerLockElement) document.exitPointerLock(); }
  }

  // ================================================================ match flow
  startMatchmaking() {
    if (this.state !== 'lobby') return;
    this.state = 'mm';
    const lm = this.profile.lastMode;
    const total = lm.mode === 'reload' ? 24 : 30;
    $('mm-mode').textContent = (lm.mode === 'br' ? 'BATTLE ROYALE' : 'RELOAD') + (lm.ranked ? ' · RANKED' : '');
    $('mm').classList.add('show');
    $('mm-status').textContent = 'Finding players…';
    let n = 1;
    $('mm-count').textContent = n;
    // try to go fullscreen + landscape on mobile (needs a user gesture — the PLAY tap)
    try { const d = document.documentElement; if (d.requestFullscreen && !document.fullscreenElement) d.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch { /* not supported */ }
    this.mmTimer = setInterval(() => {
      n = Math.min(total, n + 1 + Math.floor(Math.random() * 4));
      $('mm-count').textContent = n;
      if (n >= total) { clearInterval(this.mmTimer); $('mm-status').textContent = 'Loading Reversal Compound…'; this.mmDone = setTimeout(() => this.startMatch(), 500); }
    }, 140);
  }

  startMatch() {
    const lm = this.profile.lastMode;
    const rank = this.profile.ranked[lm.mode];
    Audio.stopLoop('music');
    $('lobby').classList.remove('show'); $('mm').classList.remove('show');
    this.loot.g = null;
    this.match = new Match(this, { mode: lm.mode, ranked: !!lm.ranked, skill: botSkillFor(!!lm.ranked, rank), profile: this.profile });
    this.state = 'match';
    this.paused = false;
    this.controls.reset();
    this.controls.enabled = true;
    applyLayout(this.profile.hud);
    this.camera.fov = 78; this.camera.updateProjectionMatrix();
    this.clock.getDelta();
  }

  endMatch(result) {
    if (!this.match || this.state !== 'match') return;
    const m = this.match;
    m.ended = true;
    this.controls.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    const r = result || m.result || { mode: m.mode, ranked: m.ranked, won: false, placement: m.mode === 'reload' ? m.teamsRemaining() : m.aliveCount(), total: m.mode === 'reload' ? m.teams : m.fighters.length, kills: m.player.kills, damage: Math.round(m.player.damageDealt), timeAlive: Math.round(m.time) };
    const rewards = this.applyRewards(r);
    m.dispose();
    this.match = null;
    this.hud.hide();
    this.state = 'results';
    showResults(this, r, rewards);
  }

  applyRewards(r) {
    const p = this.profile;
    const rewards = { levelBefore: p.level, xpBefore: p.xp };
    const placeXp = r.mode === 'br'
      ? (r.placement === 1 ? 500 : r.placement <= 5 ? 250 : r.placement <= 10 ? 150 : r.placement <= 15 ? 70 : 20)
      : (r.placement === 1 ? 450 : r.placement <= 3 ? 200 : 60);
    const xp = Math.round(120 + r.kills * 65 + placeXp + Math.min(600, r.timeAlive * 0.9) + (r.ranked ? 80 : 0));
    rewards.xp = xp;
    p.xp += xp;
    while (p.xp >= xpForLevel(p.level)) { p.xp -= xpForLevel(p.level); p.level++; }
    const s = p.stats;
    s.matches++; s.kills += r.kills; s.damage += r.damage;
    if (r.won) s.wins++; else s.deaths++;
    if (r.placement <= (r.mode === 'br' ? 10 : 3)) s.top10++;
    if (r.ranked) {
      const before = { ...p.ranked[r.mode] };
      rewards.rankBefore = before;
      const d = rankedDelta(r.mode, before, r.placement, r.total, r.kills);
      const res = applyRanked(before, d.delta);
      res.rank.matches = (before.matches || 0) + 1;
      res.rank.wins = (before.wins || 0) + (r.won ? 1 : 0);
      p.ranked[r.mode] = res.rank;
      rewards.rank = d; rewards.promoted = res.promoted;
    }
    Store.save(true);
    Store.recordMatch({ ...r, t: Date.now() });
    if (r.ranked && r.mode === 'br') Store.pushLeaderboard();
    return rewards;
  }

  // ================================================================ loop
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.state === 'match' && this.match) {
      if (!this.paused && !$('hud').classList.contains('editing')) {
        this.match.update(dt);
        this.world.update(this.match.time);
      }
      // shadow camera follows the camera focus
      const f = this.match.player;
      const fx = f.alive ? f.pos.x : this.camera.position.x, fz = f.alive ? f.pos.z : this.camera.position.z;
      this.sun.position.set(fx + 40, 80, fz + 25); this.sun.target.position.set(fx, 0, fz); this.sun.target.updateMatrixWorld();
      this.sky.position.copy(this.camera.position);
      this.renderer.render(this.gameScene, this.camera);
    } else if (this.lobbyScene && this.state !== 'loading') {
      this.factory.time.value += dt;
      this.lobbyScene.update(dt);
      this.renderer.render(this.lobbyScene.scene, this.lobbyScene.camera);
    }
  }
}

function frame() { return new Promise(r => requestAnimationFrame(() => r())); }

const app = new App();
window.__oc = app;
app.boot();

// Offline support + app-like launching (not inside the hosted preview, which can't use service workers)
if ('serviceWorker' in navigator && !window.OC_PREVIEW && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker:', e.message)));
}
