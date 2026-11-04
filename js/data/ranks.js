// Ranked ladder (Fortnite order and colours):
// Bronze → Silver → Gold → Platinum → Diamond (three divisions each), then Champion → Unreal →
// Unreal Legend → Supreme (one division each). Supreme is the top rank.

export const TIERS = [
  { name: 'Bronze',        divs: 3, color: '#cd8a52', dark: '#5e3417', light: '#ffd0a3' },
  { name: 'Silver',        divs: 3, color: '#c4d3e6', dark: '#56677e', light: '#ffffff' },
  { name: 'Gold',          divs: 3, color: '#ffcc33', dark: '#8a5a00', light: '#fff2a8' },
  { name: 'Platinum',      divs: 3, color: '#46d6d2', dark: '#0f6466', light: '#d9fffd' },
  { name: 'Diamond',       divs: 3, color: '#3f86ff', dark: '#122f80', light: '#c9dcff' },
  { name: 'Champion',      divs: 1, color: '#ff6a1c', dark: '#7a2404', light: '#ffd2a6' },
  { name: 'Unreal',        divs: 1, color: '#a24dff', dark: '#3a0d75', light: '#ead6ff' },
  { name: 'Unreal Legend', divs: 1, color: '#ff3fbf', dark: '#5e0646', light: '#ffd4f2', trim: '#ffd24a' },
  { name: 'Supreme',       divs: 1, color: '#ff2433', dark: '#5c040b', light: '#ffc4c8', trim: '#ffd24a' },
];
export const DIVISIONS = ['I', 'II', 'III'];
// division index → tier (Bronze I = 0 … Diamond III = 14, Champion 15, Unreal 16, Unreal Legend 17, Supreme 18)
const DIV_TABLE = [];
TIERS.forEach((t, ti) => { for (let k = 0; k < t.divs; k++) DIV_TABLE.push({ ti, k }); });
export const MAX_DIV = DIV_TABLE.length - 1;
/** First division index of a tier. */
export function tierStart(ti) { return DIV_TABLE.findIndex(d => d.ti === ti); }
/** Last (highest) division index of a tier. */
export function tierTop(ti) { return tierStart(ti) + TIERS[ti].divs - 1; }

export function divInfo(div) {
  const d = Math.max(0, Math.min(MAX_DIV, div | 0));
  const { ti, k } = DIV_TABLE[d];
  const tier = TIERS[ti];
  return { div: d, tierIndex: ti, tier, numeral: tier.divs > 1 ? DIVISIONS[k] : '', name: tier.divs > 1 ? `${tier.name} ${DIVISIONS[k]}` : tier.name };
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
  const tierIdx = divInfo(rank.div).tierIndex;
  // higher tiers: less RP per placement and a bigger entry cost (Unreal and up are a real grind)
  const tierScale = [1, 0.85, 0.72, 0.64, 0.56, 0.5, 0.46, 0.44, 0.4][tierIdx];
  const entry = [0, 5, 10, 13, 16, 20, 23, 25, 28][tierIdx];
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
  const perElim = (mode === 'br' ? [6, 5, 4, 4, 3.5, 3, 3, 3, 3] : [5, 4, 3, 3, 3, 2.5, 2.5, 2.5, 2.5])[tierIdx];
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
  // Bronze → Gold III ramps quickly (0.36 → 0.88), then every rank above tightens up to 0.97 at Supreme
  const d = rank.div;
  return Math.min(0.97, d <= 8 ? 0.36 + d * 0.065 : 0.88 + (d - 8) * 0.009);
}

// Account level curve
export function xpForLevel(level) { return 800 + level * 150; }
