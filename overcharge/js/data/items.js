// Weapons, grenades, rarities and loot tables.

export const RARITIES = [
  { id: 0, name: 'Common',    color: '#b9bec7', glow: 0xb9bec7 },
  { id: 1, name: 'Uncommon',  color: '#4fd16a', glow: 0x4fd16a },
  { id: 2, name: 'Rare',      color: '#3aa2ff', glow: 0x3aa2ff },
  { id: 3, name: 'Epic',      color: '#c25cff', glow: 0xc25cff },
  { id: 4, name: 'Legendary', color: '#ffb52e', glow: 0xffb52e },
];

export const AMMO_TYPES = {
  light:  { name: 'Light Ammo',  color: '#9fd8ff', max: 999, pickup: 30 },
  medium: { name: 'Medium Ammo', color: '#7dffa0', max: 999, pickup: 30 },
  heavy:  { name: 'Heavy Ammo',  color: '#ff9a6b', max: 999, pickup: 6 },
  shells: { name: 'Shells',      color: '#ffd95e', max: 999, pickup: 8 },
};

// damage[] is indexed by rarity. spread values are radians (cone half-angle).
export const WEAPONS = {
  ar: {
    id: 'ar', name: 'Assault Rifle', short: 'AR', model: 'rifle', ammo: 'medium',
    mag: 30, rate: 5.5, auto: true, pellets: 1,
    damage: [30, 31, 33, 35, 37], head: 1.5,
    hip: 0.024, ads: 0.006, moveSpread: 0.014, bloom: 0.005, bloomMax: 0.045,
    range: 220, falloffStart: 50, falloffMin: 0.7, reload: [2.5, 2.4, 2.3, 2.2, 2.1],
    zoom: 1.35, recoil: 0.012, sound: 'ar', tracer: 0xfff2b0, crosshair: 'cross',
    autoRange: 140, lockRange: 65, botRange: [12, 75],
  },
  shotgun: {
    id: 'shotgun', name: 'Pump Shotgun', short: 'PUMP', model: 'shotgun', ammo: 'shells',
    mag: 5, rate: 0.9, auto: false, pellets: 10,
    damage: [8.5, 9.2, 10, 10.8, 11.5], head: 2.0,
    hip: 0.085, ads: 0.06, moveSpread: 0.01, bloom: 0, bloomMax: 0,
    range: 45, falloffStart: 7, falloffMin: 0.25, reload: [5.0, 4.7, 4.4, 4.1, 3.8],
    zoom: 1.15, recoil: 0.05, sound: 'shotgun', tracer: 0xffd0a0, crosshair: 'circle',
    autoRange: 24, lockRange: 22, botRange: [2, 12],
  },
  smg: {
    id: 'smg', name: 'Volt SMG', short: 'SMG', model: 'blaster', ammo: 'light',
    mag: 30, rate: 11, auto: true, pellets: 1,
    damage: [16, 17, 18, 19, 20], head: 1.5,
    hip: 0.045, ads: 0.022, moveSpread: 0.012, bloom: 0.004, bloomMax: 0.06,
    range: 120, falloffStart: 22, falloffMin: 0.55, reload: [2.2, 2.1, 2.0, 1.9, 1.8],
    zoom: 1.2, recoil: 0.007, sound: 'smg', tracer: 0x9ff0ff, crosshair: 'cross',
    autoRange: 70, lockRange: 45, botRange: [5, 28],
  },
  sniper: {
    id: 'sniper', name: 'Arc Sniper', short: 'SNIPER', model: 'rifle', ammo: 'heavy',
    mag: 1, rate: 0.5, auto: false, pellets: 1,
    damage: [100, 105, 110, 116, 121], head: 2.5,
    hip: 0.09, ads: 0.0, moveSpread: 0.03, bloom: 0, bloomMax: 0,
    range: 400, falloffStart: 400, falloffMin: 1, reload: [3.0, 2.85, 2.7, 2.55, 2.4],
    zoom: 4.0, scope: true, recoil: 0.06, sound: 'sniper', tracer: 0xff6bff, crosshair: 'dot',
    autoRange: 240, lockRange: 140, botRange: [40, 160],
  },
};

export const GRENADES = {
  shockwave: {
    id: 'shockwave', name: 'Shockwave Grenade', short: 'SHOCK', stack: 6, color: 0x4fb6ff,
    radius: 5.5, fuse: 0.0, desc: 'Tap fire to pop it at your feet and launch up and forward where you are moving or looking. Knocks nearby players away. No damage, no fall damage.',
  },
  overdrive: {
    id: 'overdrive', name: 'Overdrive Grenade', short: 'OVERDRIVE', stack: 4, color: 0xffe14d,
    radius: 6, fuse: 1.2, damage: 45, buffTime: 8, fieldTime: 6,
    desc: 'Electric blast damages enemies and supercharges you & allies: +25% speed, +30% fire rate, faster reloads, shield regen.',
  },
};

export const JETPACK = { fuel: 100, burn: 30, regen: 24, regenDelay: 0.8, thrust: 44, maxUp: 9.5,
  desc: 'Hold JUMP in the air to fly. Fuel refills while you are on the ground.' };

export const HEALS = {
  medkit: { id: 'medkit', name: 'Medkit', short: 'MEDKIT', stack: 3, useTime: 5, heal: 100, color: 0x5ff4c8,
    desc: 'Restores health to full after 5 seconds. You can walk slowly while healing.' },
};

// Starting loadout every fighter drops in with. The player can reorder it in the lobby.
export const LOADOUT_ITEMS = {
  smg:       { label: 'Volt SMG',          make: () => makeGun('smg', 2) },
  shotgun:   { label: 'Pump Shotgun',      make: () => makeGun('shotgun', 2) },
  ar:        { label: 'Assault Rifle',     make: () => makeGun('ar', 2) },
  shockwave: { label: 'Shockwave Grenade', make: () => makeGrenade('shockwave', 2) },
  medkit:    { label: 'Medkit',            make: () => makeHeal('medkit', 1) },
};
export const DEFAULT_LOADOUT = ['smg', 'shotgun', 'ar', 'shockwave', 'medkit'];
export const LOADOUT_AMMO = { light: 120, medium: 120, heavy: 0, shells: 20 };

/** Validate a saved loadout order (must contain each loadout item exactly once). */
export function normalizeLoadout(order) {
  if (!Array.isArray(order)) return [...DEFAULT_LOADOUT];
  const seen = new Set(), out = [];
  for (const id of order) if (LOADOUT_ITEMS[id] && !seen.has(id)) { seen.add(id); out.push(id); }
  for (const id of DEFAULT_LOADOUT) if (!seen.has(id)) out.push(id);
  return out.slice(0, 5);
}

// Weighted rarity tables
export const FLOOR_RARITY = [40, 30, 18, 9, 3];
export const CHEST_RARITY = [10, 30, 32, 20, 8];

export function rollRarity(table, rng = Math.random) {
  const total = table.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < table.length; i++) { r -= table[i]; if (r <= 0) return i; }
  return 0;
}

const GUN_WEIGHTS = { ar: 34, shotgun: 26, smg: 26, sniper: 14 };
export function rollWeapon(rng = Math.random) {
  let r = rng() * 100;
  for (const k in GUN_WEIGHTS) { r -= GUN_WEIGHTS[k]; if (r <= 0) return k; }
  return 'ar';
}

export function makeGun(id, rarity) {
  const w = WEAPONS[id];
  return { kind: 'gun', id, rarity, mag: w.mag };
}
export function makeGrenade(id, count) {
  return { kind: 'grenade', id, count: Math.min(count, GRENADES[id].stack) };
}

export function makeHeal(id, count) {
  return { kind: 'heal', id, count: Math.min(count, HEALS[id].stack) };
}

export function itemName(item) {
  if (!item) return '';
  if (item.kind === 'gun') return `${RARITIES[item.rarity].name} ${WEAPONS[item.id].name}`;
  if (item.kind === 'grenade') return GRENADES[item.id].name;
  if (item.kind === 'heal') return HEALS[item.id].name;
  if (item.kind === 'jetpack') return 'Jetpack';
  if (item.kind === 'ammo') return AMMO_TYPES[item.id].name;
  return '';
}
export function itemColor(item) {
  if (!item) return '#fff';
  if (item.kind === 'gun') return RARITIES[item.rarity].color;
  if (item.kind === 'grenade') return item.id === 'shockwave' ? '#4fb6ff' : '#ffe14d';
  if (item.kind === 'heal') return '#5ff4c8';
  if (item.kind === 'jetpack') return '#ff9a3c';
  if (item.kind === 'ammo') return AMMO_TYPES[item.id].color;
  return '#fff';
}
