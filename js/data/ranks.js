// Ranked ladder: Bronze I → Gold III. Gold is the highest tier.

export const TIERS = [
  { name: 'Bronze', color: '#d08a4e', dark: '#6b3d1c', light: '#ffc58f' },
  { name: 'Silver', color: '#c4d3e6', dark: '#5a6b82', light: '#ffffff' },
  { name: 'Gold',   color: '#ffcc33', dark: '#8a5a00', light: '#fff2a8' },
];
export const DIVISIONS = ['I', 'II', 'III'];
export const MAX_DIV = TIERS.length * DIVISIONS.length - 1; // 8 = Gold III

export function divInfo(div) {
  const d = Math.max(0, Math.min(MAX_DIV, div | 0));
  const tier = TIERS[Math.floor(d / 3)];
  return { div: d, tierIndex: Math.floor(d / 3), tier, name: `${tier.name} ${DIVISIONS[d % 3]}` };
}

export function newRank() { return { div: 0, rp: 0, matches: 0, wins: 0 }; }

/**
 * Compute RP change for a ranked match.
 * @param {'br'|'reload'} mode
 * @param {{div:number, rp:number}} rank current rank
 * @param {number} placement 1 = winner
 * @param {number} total number of teams in the lobby (players in solo)
 * @param {number} elims eliminations by the player
 */
export function rankedDelta(mode, rank, placement, total, elims) {
  const tierIdx = Math.floor(rank.div / 3);
  const tierScale = [1, 0.85, 0.72][tierIdx];
  const entry = [0, 5, 10][tierIdx];
  let place = 0;
  if (total > 12) {
    // big lobbies (solo, BR duos): percentile based
    const pct = (placement - 1) / Math.max(1, total - 1);
    if (placement === 1) place = mode === 'br' ? 42 : 40;
    else if (placement <= 3) place = 28;
    else if (placement <= 5) place = 20;
    else if (pct <= 0.34) place = 12;
    else if (pct <= 0.5) place = 6;
    else if (pct <= 0.7) place = 2;
    else place = -2;
  } else {
    // a handful of teams (squads, Reload duos): every spot matters
    place = [0, mode === 'br' ? 42 : 40, 22, 12, 5, 0, -2, -2, -2][Math.min(placement, 8)] ?? -2;
  }
  if (tierIdx === 0) place = Math.max(0, place); // Bronze is a no-loss tier
  const perElim = mode === 'br' ? [6, 5, 4][tierIdx] : [5, 4, 3][tierIdx];
  const elimPts = Math.min(elims, 10) * perElim;
  const delta = Math.round(place * tierScale + elimPts - entry);
  return { delta, place: Math.round(place * tierScale), elimPts, entry };
}

/** Apply delta with promotion and demotion protection. Returns {rank, promoted, from, to} */
export function applyRanked(rank, delta) {
  const r = { ...rank };
  const from = r.div;
  r.rp += delta;
  let promoted = false;
  while (r.rp >= 100 && r.div < MAX_DIV) { r.rp -= 100; r.div++; promoted = true; }
  if (r.div >= MAX_DIV) r.rp = Math.min(r.rp, 100);
  if (r.rp < 0) r.rp = 0; // demotion protection: you never lose a division you earned
  return { rank: r, promoted, from, to: r.div };
}

/** Bot skill 0..1 used for aim, reaction, decision quality. */
export function botSkillFor(ranked, rank) {
  if (!ranked) return 0.28;
  return Math.min(0.92, 0.36 + rank.div * 0.065);
}

// Account level curve
export function xpForLevel(level) { return 800 + level * 150; }
