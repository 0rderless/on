// Touch controls (multi-touch via pointer events), keyboard/mouse fallback and HUD layout.

export const HUD_DEFAULTS = {
  minimap:  { x: 0.105, y: 0.27, s: 1, o: 1 },
  status:   { x: 0.235, y: 0.935, s: 1, o: 1 },
  hotbar:   { x: 0.585, y: 0.885, s: 1, o: 1 },
  joystick: { x: 0.13,  y: 0.655, s: 1, o: 0.9 },
  fire:     { x: 0.885, y: 0.60, s: 1, o: 0.9 },
  fireL:    { x: 0.28,  y: 0.40, s: 1, o: 0.8 },
  ads:      { x: 0.765, y: 0.66, s: 1, o: 0.9 },
  jump:     { x: 0.945, y: 0.36, s: 1, o: 0.9 },
  crouch:   { x: 0.945, y: 0.85, s: 1, o: 0.9 },
  reload:   { x: 0.775, y: 0.38, s: 0.85, o: 0.9 },
  interact: { x: 0.62,  y: 0.63, s: 1, o: 1 },
  map:      { x: 0.5,   y: 0.08, s: 1, o: 0.9 },
  autofire: { x: 0.86,  y: 0.885, s: 1, o: 0.95 },
};
export const HUD_NAMES = {
  minimap: 'Minimap', status: 'Health & Shield', hotbar: 'Inventory', joystick: 'Move Joystick', fire: 'Fire (Right)', fireL: 'Fire (Left)',
  ads: 'Aim (ADS)', jump: 'Jump', crouch: 'Crouch', reload: 'Reload', interact: 'Pick Up / Open', map: 'Map', autofire: 'Auto Shoot Toggle',
};

/** Scale factor so the HUD keeps the same proportions on small phones and tablets (baseline 844×390). */
export function hudScale() {
  return Math.max(0.68, Math.min(1.6, Math.min(innerWidth / 844, innerHeight / 390)));
}

export function applyLayout(layout) {
  const k = hudScale();
  document.documentElement.style.setProperty('--hud-k', k);
  for (const id in HUD_DEFAULTS) {
    const el = document.querySelector(`[data-hud="${id}"]`);
    if (!el) continue;
    const L = { ...HUD_DEFAULTS[id], ...(layout[id] || {}) };
    el.style.left = Math.round(L.x * innerWidth) + 'px';
    el.style.top = Math.round(L.y * innerHeight) + 'px';
    el.style.transform = `translate(-50%, -50%) scale(${L.s * k})`;
    el.style.opacity = L.o;
  }
}

export class Controls {
  constructor(hudEl) {
    this.hud = hudEl;
    this.state = {
      move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 },
      fire: false, firePressed: false, adsToggle: false, adsHeld: null,
      jump: false, jumpHeld: false, crouch: false, reload: false, interact: false, slot: null, sprintKey: false, swap: null,
    };
    this.swapFrom = null; this.holdTimer = 0;
    this.enabled = false;
    this.pointers = new Map();  // pointerId → {role, x, y, el}
    this.keys = new Set();
    this.onMap = null; this.onPause = null;
    this.joy = document.getElementById('joy');
    this.knob = document.getElementById('joy-knob');
    this.bind();
  }

  reset() {
    const s = this.state;
    s.move.x = s.move.y = 0; s.look.dx = s.look.dy = 0;
    s.fire = false; s.firePressed = false; s.adsToggle = false; s.adsHeld = null;
    s.jump = s.crouch = s.reload = s.interact = false; s.jumpHeld = false; s.slot = null; s.sprintKey = false; s.swap = null;
    this.endSwap();
    this.pointers.clear();
    this.knob.style.transform = '';
    document.querySelectorAll('.pressed').forEach(e => e.classList.remove('pressed'));
  }

  bind() {
    const h = this.hud;
    h.addEventListener('pointerdown', e => this.down(e), { passive: false });
    window.addEventListener('pointermove', e => this.move(e), { passive: false });
    window.addEventListener('pointerup', e => this.up(e));
    window.addEventListener('pointercancel', e => this.up(e));
    h.addEventListener('contextmenu', e => e.preventDefault());
    // keyboard + mouse (desktop testing)
    window.addEventListener('keydown', e => this.key(e, true));
    window.addEventListener('keyup', e => this.key(e, false));
    document.addEventListener('mousemove', e => {
      if (!this.enabled || document.pointerLockElement !== document.body) return;
      this.state.look.dx += e.movementX * 0.55; this.state.look.dy += e.movementY * 0.55;
    });
    document.addEventListener('mousedown', e => {
      if (!this.enabled || document.pointerLockElement !== document.body) return;
      if (e.button === 0) { this.state.fire = true; this.state.firePressed = true; }
      if (e.button === 2) this.state.adsHeld = true;
    });
    document.addEventListener('mouseup', e => {
      if (document.pointerLockElement !== document.body) return;
      if (e.button === 0) this.state.fire = false;
      if (e.button === 2) this.state.adsHeld = false;
    });
  }

  roleFor(target) {
    const ctl = target.closest('.ctl, .slot, #minimap-wrap');
    if (!ctl) return { role: 'look' };
    if (ctl.classList.contains('slot')) return { role: 'slot', el: ctl };
    switch (ctl.id) {
      case 'joy': return { role: 'joy', el: ctl };
      case 'b-fire': case 'b-fireL': return { role: 'fire', el: ctl };
      case 'b-ads': return { role: 'ads', el: ctl };
      case 'b-jump': return { role: 'jump', el: ctl };
      case 'b-crouch': return { role: 'crouch', el: ctl };
      case 'b-reload': return { role: 'reload', el: ctl };
      case 'b-interact': return { role: 'interact', el: ctl };
      case 'b-map': case 'minimap-wrap': return { role: 'map', el: ctl };
      case 'b-pause': return { role: 'pause', el: ctl };
      case 'b-auto': return { role: 'auto', el: ctl };
      default: return { role: 'look' };
    }
  }

  down(e) {
    if (!this.enabled || this.hud.classList.contains('editing')) return;
    if (e.target.closest('.overlay.show, #bigmap.show, button.btn')) return;
    if (e.pointerType === 'mouse' && document.pointerLockElement !== document.body && !e.target.closest('.ctl, .slot')) {
      // desktop: click the 3D view to capture the mouse
      try { document.body.requestPointerLock(); } catch { /* unsupported */ }
      return;
    }
    e.preventDefault();
    const r = this.roleFor(e.target);
    const p = { role: r.role, el: r.el, x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0 };
    this.pointers.set(e.pointerId, p);
    const s = this.state;
    if (r.el) r.el.classList.add('pressed');
    switch (r.role) {
      case 'joy': this.joyUpdate(p, e.clientX, e.clientY); break;
      case 'fire': s.fire = true; s.firePressed = true; break;
      case 'ads': s.adsToggle = true; break;
      case 'jump': s.jump = true; s.jumpHeld = true; break;
      case 'crouch': s.crouch = true; break;
      case 'reload': s.reload = true; break;
      case 'interact': s.interact = true; break;
      case 'map': this.onMap && this.onMap(); break;
      case 'pause': this.onPause && this.onPause(); break;
      case 'auto': this.onAutoToggle && this.onAutoToggle(); break;
      case 'slot': {
        const i = +r.el.dataset.i;
        if (this.swapFrom !== null) {
          if (i > 0 && i !== this.swapFrom) s.swap = [this.swapFrom, i];
          this.endSwap();
          break;
        }
        s.slot = i;
        // press and hold a slot to move it
        clearTimeout(this.holdTimer);
        if (i > 0) this.holdTimer = setTimeout(() => { if (this.pointers.get(p.id)) this.beginSwap(i); }, 450);
        break;
      }
    }
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.moved += Math.abs(dx) + Math.abs(dy);
    if (p.role === 'joy') this.joyUpdate(p, e.clientX, e.clientY);
    else if (p.role === 'look' || p.role === 'fire' || p.role === 'ads' || p.role === 'jump') {
      // buttons on the right side also steer the camera while held (like Fortnite mobile)
      this.state.look.dx += dx; this.state.look.dy += dy;
    }
    p.x = e.clientX; p.y = e.clientY;
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.el) p.el.classList.remove('pressed');
    if (p.role === 'slot') clearTimeout(this.holdTimer);
    if (p.role === 'jump') { let other = false; for (const q of this.pointers.values()) if (q.role === 'jump') other = true; if (!other) this.state.jumpHeld = false; }
    if (p.role === 'joy') { this.state.move.x = 0; this.state.move.y = 0; this.knob.style.transform = ''; }
    if (p.role === 'fire') {
      // stop firing only when no other fire button is held
      let other = false; for (const q of this.pointers.values()) if (q.role === 'fire') other = true;
      if (!other) this.state.fire = false;
    }
  }

  beginSwap(i) {
    this.swapFrom = i;
    const el = document.querySelector(`.slot[data-i="${i}"]`);
    if (el) el.classList.add('swapping');
    document.getElementById('hotbar').classList.add('swap-mode');
    if (navigator.vibrate) try { navigator.vibrate(15); } catch { /* unsupported */ }
  }

  endSwap() {
    this.swapFrom = null;
    clearTimeout(this.holdTimer);
    document.querySelectorAll('.slot.swapping').forEach(e => e.classList.remove('swapping'));
    const hb = document.getElementById('hotbar'); if (hb) hb.classList.remove('swap-mode');
  }

  joyUpdate(p, x, y) {
    const r = this.joy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const rad = r.width / 2 * 0.72;
    let dx = (x - cx) / rad, dy = (y - cy) / rad;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    this.state.move.x = dx; this.state.move.y = -dy;
    const scale = r.width / this.joy.offsetWidth || 1;
    this.knob.style.transform = `translate(${dx * rad / scale}px, ${dy * rad / scale}px)`;
  }

  key(e, down) {
    if (!this.enabled) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (down && this.keys.has(k)) return;
    if (down) this.keys.add(k); else this.keys.delete(k);
    const s = this.state;
    const mv = () => {
      s.move.x = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
      s.move.y = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0);
      const l = Math.hypot(s.move.x, s.move.y); if (l > 1) { s.move.x /= l; s.move.y /= l; }
    };
    if ('wasd'.includes(k) && k.length === 1) mv();
    if (!down) { if (k === 'shift') s.sprintKey = false; if (k === ' ') s.jumpHeld = false; return; }
    if (k === ' ') { s.jump = true; s.jumpHeld = true; }
    else if (k === 'c' || k === 'control') s.crouch = true;
    else if (k === 'r') s.reload = true;
    else if (k === 'e' || k === 'f') s.interact = true;
    else if (k === 'shift') s.sprintKey = true;
    else if (k === 'm') this.onMap && this.onMap();
    else if (k === 'escape' || k === 'p') this.onPause && this.onPause();
    else if (k >= '1' && k <= '6') s.slot = +k - 1;
    else if (k === 'q') s.adsToggle = true;
  }
}
