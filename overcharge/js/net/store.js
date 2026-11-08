// Player data persistence: Firebase Realtime Database with a localStorage mirror.
// If Firebase is unreachable (offline, rules denied) the game keeps working locally
// and syncs again next time the cloud is reachable.
import { firebaseConfig, DB_ROOT } from '../config.js';
import { newRank } from '../data/ranks.js';
import { DEFAULT_LOADOUT, normalizeLoadout } from '../data/items.js';
import { DEFAULT_GLIDER, normalizeGlider } from '../data/cosmetics.js';

const LS_UID = 'oc_uid';
const LS_PROFILE = 'oc_profile';

let db = null;
let connected = false;
const listeners = new Set();

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } }
function lsDel(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } }

function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label || 'request'} timed out`)), ms)),
  ]);
}

export function usernameKey(name) { return name.trim().toLowerCase(); }

export function validateUsername(name) {
  const n = (name || '').trim();
  if (n.length < 3) return 'Username must be at least 3 characters.';
  if (n.length > 16) return 'Username must be 16 characters or less.';
  if (!/^[A-Za-z0-9_.]+$/.test(n)) return 'Use letters, numbers, _ and . only.';
  if (/^[._]|[._]$/.test(n)) return 'Username cannot start or end with _ or .';
  return null;
}

async function hashPin(key, pin) {
  const text = `overcharge:${key}:${pin}`;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'f' + (h >>> 0).toString(16);
  }
}

function makeUid() {
  const a = new Uint8Array(12);
  (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256));
  return 'p' + Array.from(a).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 19);
}

export function defaultSettings() {
  return {
    sens: 1.0, adsSens: 0.75, invertY: false, fov: 80,
    autoFire: true, aimAssist: true, autoPickup: true, autoSprint: true,
    quality: 'medium', showFps: false, dynRes: false, fpsCap: true,
    master: 0.8, sfx: 1.0, music: 0.5,
    haptics: true,
  };
}

export function defaultProfile(uid, username) {
  return {
    uid, username, usernameKey: usernameKey(username),
    created: Date.now(), lastSeen: Date.now(),
    level: 1, xp: 0,
    stats: { matches: 0, wins: 0, kills: 0, deaths: 0, top10: 0, damage: 0 },
    ranked: { br: newRank(), reload: newRank() },
    locker: { skin: 'default', pickaxe: 'standard', glider: DEFAULT_GLIDER },
    settings: defaultSettings(),
    hud: {},
    loadout: [...DEFAULT_LOADOUT],
    jetpackStart: true,
    lastMode: { mode: 'br', ranked: false, team: 'solo', map: 'compound' },
  };
}

// Make sure older / partial profiles always have every field.
function normalize(p) {
  const d = defaultProfile(p.uid, p.username || 'Player');
  const out = { ...d, ...p };
  out.stats = { ...d.stats, ...(p.stats || {}) };
  out.ranked = { br: { ...newRank(), ...(p.ranked?.br || {}) }, reload: { ...newRank(), ...(p.ranked?.reload || {}) } };
  out.locker = { ...d.locker, ...(p.locker || {}) };
  out.locker.glider = normalizeGlider(out.locker.glider);
  out.settings = { ...d.settings, ...(p.settings || {}) };
  out.hud = p.hud || {};
  out.loadout = normalizeLoadout(p.loadout);
  out.jetpackStart = p.jetpackStart !== false;
  out.lastMode = { ...d.lastMode, ...(p.lastMode || {}) };
  return out;
}

export const Store = {
  profile: null,
  cloudOk: false,

  init() {
    try {
      if (typeof firebase === 'undefined') throw new Error('Firebase SDK missing');
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      db.ref('.info/connected').on('value', s => {
        connected = !!s.val();
        listeners.forEach(fn => fn(connected));
      });
    } catch (e) {
      console.warn('[store] Firebase unavailable, running offline:', e.message);
      db = null;
    }
  },

  onConnection(fn) { listeners.add(fn); fn(connected); },
  isConnected() { return connected; },
  ref(path) { return db ? db.ref(`${DB_ROOT}/${path}`) : null; },

  localUid() { return lsGet(LS_UID); },

  /** Load the profile for the uid saved on this device. Returns null if this device has no account. */
  async loadLocal() {
    const uid = lsGet(LS_UID);
    if (!uid) return null;
    let local = null;
    try { local = JSON.parse(lsGet(LS_PROFILE) || 'null'); } catch { local = null; }
    let cloud = null;
    if (db) {
      try {
        const snap = await withTimeout(this.ref(`players/${uid}`).once('value'), 6000, 'profile load');
        cloud = snap.val();
        this.cloudOk = true;
      } catch (e) { console.warn('[store] cloud load failed:', e.message); }
    }
    let p = cloud || local;
    if (cloud && local && (local.lastSeen || 0) > (cloud.lastSeen || 0)) p = local; // newer offline progress wins
    if (!p) return null;
    this.profile = normalize({ ...p, uid });
    this.saveLocalOnly();
    if (this.cloudOk && p === local) this.save(true);
    return this.profile;
  },

  /** Create a new account. Returns {ok, error} */
  async createAccount(username, pin) {
    const err = validateUsername(username);
    if (err) return { ok: false, error: err };
    if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'PIN must be exactly 4 digits.' };
    const key = usernameKey(username);
    const uid = makeUid();
    const pinHash = await hashPin(key, pin);
    if (db) {
      try {
        const res = await withTimeout(this.ref(`usernames/${key}`).transaction(cur => {
          if (cur === null) return { uid, name: username.trim() };
          return undefined; // abort: taken
        }), 8000, 'username check');
        if (!res.committed) return { ok: false, error: 'That username is taken. Try another.' };
        this.cloudOk = true;
      } catch (e) {
        console.warn('[store] username claim failed, creating offline account:', e.message);
        this.cloudOk = false;
      }
    }
    const p = defaultProfile(uid, username.trim());
    p.pinHash = pinHash;
    p.nameClaimed = this.cloudOk;
    this.profile = p;
    lsSet(LS_UID, uid);
    this.saveLocalOnly();
    if (this.cloudOk) await this.save(true);
    return { ok: true, offline: !this.cloudOk };
  },

  /** Sign in on a new device with username + PIN. */
  async signIn(username, pin) {
    if (!db) return { ok: false, error: 'Cloud is offline. Sign in needs an internet connection.' };
    const key = usernameKey(username);
    try {
      const u = (await withTimeout(this.ref(`usernames/${key}`).once('value'), 8000, 'sign in')).val();
      if (!u) return { ok: false, error: 'No player with that username.' };
      const p = (await withTimeout(this.ref(`players/${u.uid}`).once('value'), 8000, 'sign in')).val();
      if (!p) return { ok: false, error: 'Account data not found.' };
      const h = await hashPin(key, pin);
      if (p.pinHash && p.pinHash !== h) return { ok: false, error: 'Wrong PIN.' };
      this.cloudOk = true;
      this.profile = normalize({ ...p, uid: u.uid });
      lsSet(LS_UID, u.uid);
      this.saveLocalOnly();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Could not reach the server: ' + e.message };
    }
  },

  signOut() {
    lsDel(LS_UID); lsDel(LS_PROFILE);
    this.profile = null;
  },

  saveLocalOnly() {
    if (!this.profile) return;
    this.profile.lastSeen = Date.now();
    lsSet(LS_PROFILE, JSON.stringify(this.profile));
  },

  _saveTimer: 0,
  /** Persist the profile (debounced unless immediate). */
  save(immediate = false) {
    if (!this.profile) return Promise.resolve();
    this.saveLocalOnly();
    clearTimeout(this._saveTimer);
    const doSave = async () => {
      if (!db) return;
      try {
        await withTimeout(this.ref(`players/${this.profile.uid}`).set(this.profile), 8000, 'save');
        this.cloudOk = true;
        if (!this.profile.nameClaimed) this.claimLater();
      } catch (e) { console.warn('[store] cloud save failed:', e.message); this.cloudOk = false; }
    };
    if (immediate) return doSave();
    return new Promise(res => { this._saveTimer = setTimeout(() => doSave().then(res), 1200); });
  },

  /** Accounts created while offline reserve their username the first time the cloud is reachable. */
  async claimLater() {
    const p = this.profile; if (!db || !p) return;
    try {
      const uid = p.uid, name = p.username;
      await withTimeout(this.ref(`usernames/${usernameKey(name)}`).transaction(cur => (cur === null || cur.uid === uid) ? { uid, name } : undefined), 8000, 'claim');
      p.nameClaimed = true; this.saveLocalOnly();
    } catch { /* try again next save */ }
  },

  async pushLeaderboard() {
    const p = this.profile;
    if (!db || !p) return;
    const br = p.ranked.br;
    try {
      await withTimeout(this.ref(`leaderboard/${p.uid}`).set({
        name: p.username, score: br.div * 100 + br.rp, div: br.div, rp: br.rp,
        wins: p.stats.wins, kills: p.stats.kills, level: p.level, t: Date.now(),
      }), 8000, 'leaderboard');
    } catch (e) { console.warn('[store] leaderboard push failed:', e.message); }
  },

  async fetchLeaderboard() {
    if (!db) return null;
    try {
      const snap = await withTimeout(this.ref('leaderboard').orderByChild('score').limitToLast(25).once('value'), 8000, 'leaderboard');
      const rows = [];
      snap.forEach(c => { rows.push({ uid: c.key, ...c.val() }); });
      return rows.sort((a, b) => b.score - a.score || b.wins - a.wins);
    } catch (e) { console.warn('[store] leaderboard fetch failed:', e.message); return null; }
  },

  async recordMatch(summary) {
    if (!db || !this.profile) return;
    try { await withTimeout(this.ref(`matches/${this.profile.uid}`).push(summary), 8000, 'match'); } catch { /* best effort */ }
  },
};
