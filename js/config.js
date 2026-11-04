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

export const GAME_VERSION = '1.2.0';

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
