// Skins and pickaxes. Everything is free while the game is in testing.

export const SKINS = [
  {
    id: 'default', name: 'Default', rarity: 0, series: 'Standard Issue',
    desc: 'Compound-issued recon armor. Reliable, battle-tested, ready.',
  },
  {
    id: 'shock', name: 'Shock Trooper', rarity: 3, series: 'Overcharge Series',
    desc: 'Storm-forged armor with live current coursing through every plate.',
  },
  {
    id: 'platinum', name: 'Platinum Boy', rarity: 4, series: 'Icon Series',
    desc: 'Polished platinum plating with a gold visor. Never seen a scratch.',
  },
];

export const PICKAXES = [
  { id: 'standard', name: 'Standard Issue', rarity: 0, desc: 'A trusty steel pick.' },
  { id: 'volt',     name: 'Volt Splitter',  rarity: 3, desc: 'Crackles with stored charge.' },
  { id: 'platinum', name: 'Platinum Pick',  rarity: 4, desc: 'Platinum head, gold-wrapped grip.' },
  { id: 'reaper',   name: 'Neon Reaper',    rarity: 2, desc: 'A violet blade that hums in the fog.' },
];

export const RARITY_COLORS = ['#8a93a3', '#3fbf5c', '#2f8cff', '#a64dff', '#ff9d1c'];
export const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
