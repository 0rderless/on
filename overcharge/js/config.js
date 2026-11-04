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

export const GAME_VERSION = '1.0.0';

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
export const SIPHON = 50;              // health/shield restored on elimination

export const QUALITY = {
  low:    { pixelRatio: 1.0, shadows: false, shadowSize: 0,    drawDist: 130, antialias: false },
  medium: { pixelRatio: 1.5, shadows: true,  shadowSize: 1024, drawDist: 170, antialias: true },
  high:   { pixelRatio: 2.0, shadows: true,  shadowSize: 2048, drawDist: 220, antialias: true },
};
