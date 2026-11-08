// OVERCHARGE — global configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCf1_uelYRFLSW8e652hHBppFUwmegkJE0",
  authDomain: "mingchat-e8a29.firebaseapp.com",
  databaseURL: "https://mingchat-e8a29-default-rtdb.firebaseio.com",
  projectId: "mingchat-e8a29",
  storageBucket: "mingchat-e8a29.appspot.com",
  messagingSenderId: "570070920841",
  appId: "1:570070920841:web:fa45f0f67b6fb33598e058"
};

// All game data lives under this root so it never collides with other apps on the same database.
export const DB_ROOT = 'overcharge';

export const GAME_VERSION = '1.9.6';

export const MAP_HALF = 160;          // map spans -160..160 on X and Z (metres)
export const GRAVITY = 24;
export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.8;
export const CROUCH_HEIGHT = 1.25;
export const STEP_HEIGHT = 0.5;

export const MAX_HEALTH = 100;
export const MAX_SHIELD = 50;          // Zero Build overshield
export const SHIELD_REGEN_DELAY = 5;   // seconds without damage
export const SHIELD_REGEN_RATE = 12;   // per second
export const SIPHON = 'full';          // eliminations fully restore health and shield

export const QUALITY = {
  low:    { pixelRatio: 1.0, shadows: false, shadowSize: 0,    drawDist: 95, antialias: false },
  medium: { pixelRatio: 1.5, shadows: true,  shadowSize: 1024, drawDist: 125, antialias: true },
  high:   { pixelRatio: 2.0, shadows: true,  shadowSize: 2048, drawDist: 155, antialias: true },
};

// Field of view is set the Fortnite way: horizontal degrees measured on a 16:9 screen (Fortnite = 80).
// Wider phones then see a little more to the sides (Hor+), exactly like Fortnite on mobile.
export const FORTNITE_FOV = 80;
export function vfovFromH(hfov) {
  return 2 * Math.atan(Math.tan((hfov * Math.PI / 180) / 2) / (16 / 9)) * 180 / Math.PI;
}

// Team sizes and lobby sizes for every playlist (Solo / Duos / Squads)
export const TEAM_SIZES = { solo: 1, duo: 2, squad: 4 };
export const TEAM_LABELS = { solo: 'Solo', duo: 'Duos', squad: 'Squads' };
export const PLAYER_COUNTS = { br: { solo: 30, duo: 30, squad: 32 }, reload: { solo: 20, duo: 24, squad: 24 } };
// Reload Solo: everyone starts with 2 respawns (also the cap) and earns one back every 3 eliminations
export const SOLO_RESPAWNS = 2;
export const KILLS_PER_RESPAWN = 3;

// Maps: id -> display name + atmosphere (fog/sky/light colours)
export const MAPS = {
  compound: {
    name: 'Reversal Compound', short: 'Compound',
    fog: 0x8f8ad6, fogDensity: 0.0102, skyHorizon: [0.56, 0.54, 0.84], skyTop: [0.24, 0.18, 0.55],
    hemi: [0xcfc6ff, 0x4a3f7a, 1.75], sun: [0xfff1e0, 1.65], mapBg: 0x8f86c9,
  },
  vulcan: {
    name: 'Vulcan Garrison', short: 'Vulcan',
    fog: 0x283247, fogDensity: 0.0066, skyHorizon: [0.12, 0.15, 0.25], skyTop: [0.015, 0.02, 0.05],
    hemi: [0xb4c4ff, 0x2b303e, 1.65], sun: [0xcfdcff, 1.3], mapBg: 0x141926,
  },
  warehouse: {
    name: 'Warehouse', short: 'Warehouse',
    fog: 0x9ea6ba, fogDensity: 0.0088, skyHorizon: [0.6, 0.63, 0.72], skyTop: [0.22, 0.25, 0.33],
    hemi: [0xe6ecff, 0x4f566c, 1.7], sun: [0xf2f5ff, 1.35], mapBg: 0x8a91a6,
  },
};
export const DEFAULT_MAP = 'compound';
