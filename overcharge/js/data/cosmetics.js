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
  {
    id: 'cursed', name: 'Cursed Trooper', rarity: 4, series: 'Hexed Series',
    desc: 'Charred armor split by glowing curse veins, horns, and spirits that never leave its side.',
  },
  {
    id: 'zombie', name: 'Zombie', rarity: 2, series: 'Hexed Series',
    desc: 'Rotting, mossy and still on its feet. Toxic green eyes see you first.',
  },
  {
    id: 'dragon', name: 'Red Dragon Trooper', rarity: 4, series: 'Dragonforge Series',
    desc: 'Crimson scale armor with gold trim, swept horns and a pair of dragon wings.',
  },
  {
    id: 'frost', name: 'Frost Trooper', rarity: 3, series: 'Glacier Series',
    desc: 'Glacier-white plating that glitters with frost, crowned with ice crystals.',
  },
  {
    id: 'nova', name: 'Nova', rarity: 3, series: 'Strike Force Series', body: 'female',
    desc: 'White strike armor with hot-pink trim and a ponytail to match.',
  },
  {
    id: 'viper', name: 'Viper', rarity: 4, series: 'Strike Force Series', body: 'female',
    desc: 'Glossy black armor laced with neon venom-green. Strikes first.',
  },
  {
    id: 'valkyrie', name: 'Valkyrie', rarity: 4, series: 'Mythic Series', body: 'female',
    desc: 'Crimson and gold battle plate, a winged helm and a golden braid.',
  },
  {
    id: 'arcticfox', name: 'Arctic Fox', rarity: 2, series: 'Glacier Series', body: 'female',
    desc: 'Snow-camo plating with blaze-orange accents. Quick and quiet.',
  },
  {
    id: 'rose', name: 'Midnight Rose', rarity: 3, series: 'Nightfall Series', body: 'female',
    desc: 'Deep violet armor with rose-gold trim and a long midnight ponytail.',
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

export const GLIDERS = [
  { id: 'volt',     name: 'Volt Wing',        rarity: 2, desc: 'The standard-issue OVERCHARGE glider. Purple, fast, reliable.' },
  { id: 'military', name: 'Airborne Canopy',  rarity: 1, desc: 'A classic round military parachute. Lines, risers and an olive-drab canopy.' },
  { id: 'surf',     name: 'Sky Surfer',       rarity: 3, desc: 'Stand up and ride the wind down on a surfboard.' },
  { id: 'snake',    name: 'Sky Serpent',      rarity: 3, desc: 'A giant serpent slithers through the sky with you hanging from its reins.' },
  { id: 'dragon',   name: 'Red Dragon',       rarity: 4, desc: 'A crimson dragon grabs you in its claws and flaps you down to the fight.' },
  { id: 'saucer',   name: 'Close Encounter',  rarity: 4, desc: 'Beamed down from a flying saucer. They come in peace. Probably.' },
];
