# OVERCHARGE

A mobile **zero-build battle royale** built for phones in landscape. Guns, **Shockwave** and **Overdrive** grenades, realistic bots, ranked play and a fully customizable HUD. Drop into **Reversal Compound**, the **Warehouse** or **Vulcan Garrison**.

## Play

The game is a static web app. Open `overcharge/index.html` from any web server, for example with GitHub Pages:

1. On GitHub, open **Settings → Pages** for this repository.
2. Under *Build and deployment*, pick **Deploy from a branch**, choose the branch with the game and the `/ (root)` folder, then save.
3. Open `https://<your-user>.github.io/<repo>/` on your phone. The root `index.html` redirects to the game.
4. Tip: use your browser's **Add to Home Screen** to play full screen in landscape.

For local testing: `python3 -m http.server` in the repository root, then open `http://localhost:8000/overcharge/`.

## Features

- **Modes:** Battle Royale and Reload, each in **Solo, Duos or Squads**. Battle Royale has 30 players (32 in Squads). Reload has 20 players in Solo and 24 in Duos and Squads. In Reload Solo you get 2 respawns and earn one back every 3 eliminations, up to 2. In Duos and Squads you respawn while a teammate is alive. Respawns stop when the storm closes Reload.
- **Maps** (pick one in the lobby):
  - **Reversal Compound:** an open industrial compound around a reactor core.
  - **Warehouse:** a giant distribution centre under an open steel-truss roof. Nine zones are joined by wide doorways: Dispatch, High Racks, Offices, Loading Docks, Cold Storage, Container Stacks, The Red Room, Conveyor Line and Forklift Bay.
  - **Vulcan Garrison:** a sci-fi fortress deck floating over a pale plain at night, built around a molten forge under a blue-lit spire. Its zones are Vulcan Core, Hangar Bay, Command Spire, Fuel Depot, Armory, Landing Pads, Shield Generators, Rampart and Barracks.
- **Gliders** (Locker → GLIDERS), each with its own riding pose and animation:
  - Volt Wing
  - Airborne Canopy, a military round parachute
  - Sky Surfer, where you stand on a surfboard
  - Sky Serpent, a giant slithering serpent you ride standing on its back, like the surfboard
  - Red Dragon, with flapping wings and claws that hold you
  - Close Encounter, a flying saucer with a tractor beam
- **Camera:** matched to Fortnite Mobile's third-person framing. See `docs/fortnite-mobile-camera-notes.md`.
- **Battle bus per map:**
  - Reversal Compound: a coach bus under an OVERCHARGE hot-air balloon.
  - Warehouse: a tandem-rotor cargo helicopter hauling a freight trailer.
  - Vulcan Garrison: an armoured VTOL dropship with tilt engines and searchlights.
- **Queues:**
  - Unranked: casual play with easier bots.
  - Ranked: Bronze → Silver → Gold → Platinum → Diamond, three divisions each, then Champion → Unreal → Unreal Legend → Supreme. The colours follow Fortnite's ranks: teal Platinum, blue Diamond, orange Champion, purple Unreal, magenta Unreal Legend and red Supreme.
  - Everyone starts at Bronze I and climbs with placement and eliminations. Bronze never loses progress, and you can't be demoted out of a division you've earned.
  - Higher tiers give less RP per match, and bots get tougher as you rank up.
- **Zero Build:** 100 health and a 50 overshield that regenerates after 5 s out of combat. Every elimination fully restores your health and shield.
- **Jetpacks:** a chunky rocket pack with two silver thrusters with flame decals, a round hatch ringed with chasing lights, red gas tanks and looping hoses on top, and LED gauges on the thrusters that show your fuel. Everyone drops in wearing one by default. If you switch that off in the LOADOUT tab, jetpacks spawn around the map and in chests instead. A jetpack sits on your back without using a slot. Hold JUMP in the air to fly, up to about 24 m. Fuel refills on the ground, and you take no fall damage while wearing one. Bots use them too.
- **Weapons:** Assault Rifle, Volt SMG and Arc Sniper, in Common → Legendary rarities. The default loadout carries the Arc Sniper where the shotgun used to be (old saved loadouts are switched over automatically). Nothing ever lies on the floor. You drop in with your loadout. Chests and ammo boxes put their contents straight into your inventory, and a chest upgrades the matching gun if its rarity is higher. When you eliminate someone, you automatically collect their ammo, grenades and medkits.
- **Shockwave Grenade:** works like Fortnite's. Tap fire and it pops at your feet, launching you up and forward (about 30 m) in the direction you're moving, or where you're looking if you're standing still. You can steer in the air, and you take no fall damage. Anyone next to you gets knocked away.
- **Overdrive Grenade:** an electric blast that damages enemies and supercharges you and allies (+25% speed, +30% fire rate, faster reloads, faster shield regen).
- **Mobile controls:** joystick; two fire buttons that also steer the camera while held; swipe to look; **Auto Fire**; aim assist; auto-sprint; auto pick-up.
- **Field of View:** defaults to Fortnite mobile's 80° and is adjustable from 60° to 120° in Settings, with a live preview of the game view.
- **Auto Shoot:** locks onto enemies near your crosshair (the closer they are, the wider it grabs). It sticks to them while they strafe or briefly duck behind cover, and fires accurately for you. Only a deliberate flick breaks the lock. It's separate from Aim Assist and can be toggled with the AUTO button in a match.
- **Emotes:** tap the dancer button at the top of the HUD (or press B) for the emote wheel: *Take the L*, *Floss*, *Orange Justice*, *Laugh* and *Default Dance*, each with its own beat. The camera swings round to the front (swipe to orbit), and moving, jumping, shooting or switching items ends the dance. Tapping the stop button in the middle of the wheel ends it too. Bots sometimes dance after an elimination. You can also dance in the lobby before a match: tap **EMOTE** under your character on the PLAY tab, and the dance's beat takes over from the lobby music.
- **Icons, not emojis:** the kill feed shows the weapon's icon (or pickaxe, grenade, storm and fall icons) and a headshot marker, and every toast and button uses SVG icons.
- **Updates:** the game checks for a newer version whenever you come back to it and every few minutes in the lobby. Coming back to the lobby reloads into the new version straight away, otherwise an UPDATE READY bar appears. The running version is shown in the bottom-right corner of the lobby.
- **HUD editor** (Settings → Edit HUD): drag any control, inventory or panel, and set its size and opacity per element.
- **Locker:** outfits *Default*, *Shock Trooper*, *Platinum Boy*, *Cursed Trooper* (curse veins, horns, orbiting spirits), *Zombie*, *Red Dragon Trooper* (scale armor, gold horns, wings) and *Frost Trooper* (ice armor and crystals), plus five female outfits (*Nova*, *Viper*, *Valkyrie*, *Arctic Fox* and *Midnight Rose*) on a slim hourglass frame: narrow waist, slim arms and legs, full bust, hips and glutes. In the lobby your character puts the gun away and faces you like in Fortnite; the female outfits stand hand on hip with the hips tilted. Pickaxes are *Standard Issue*, *Volt Splitter*, *Platinum Pick* and *Neon Reaper*. All are free while the game is in testing.
- **Bots** have imperfect, reaction-limited aim, choose weapons by range, strafe and jump, loot chests, rotate with the storm, retreat to cover to recharge shields, use grenades, investigate gunfire, and have player-style names.
- **Firebase:** username plus 4-digit PIN accounts, profile, stats, ranks, locker, settings, HUD layout, match history and a ranked leaderboard.

Desktop testing controls: WASD to move, mouse to look (click the game to capture the mouse), left click to fire, right click to aim, Space to jump, C to crouch, R to reload, E to interact, 1–6 for slots, Q to toggle ADS, M for the map and Esc to pause.

## Firebase setup

The game uses the provided `mingchat-e8a29` project through the compat SDK (`firebase.initializeApp(firebaseConfig); const db = firebase.database();`). All game data lives under `/overcharge` so it never touches other data in the same database. In the Firebase console, open **Realtime Database → Rules** and allow that path, for example:

```json
{
  "rules": {
    "overcharge": {
      ".read": true,
      ".write": true,
      "leaderboard": { ".indexOn": ["score"] }
    }
  }
}
```

Merge this into your existing rules and keep the rules your other apps rely on. These rules are open, which is fine for a test game. For anything public, add Firebase Authentication and lock each `players/<uid>` record to its owner.

If the database can't be reached, the game still works offline. Progress is kept on the device and syncs when the cloud is reachable again.

## Credits

- Soldier model and animations: Mixamo (Adobe), via the open-source [Dive](https://github.com/Mugen87/dive) project by Mugen87 (MIT).
- Sci-Fi Assault Rifle by **Ptis** (CC BY-NC 4.0), Shotgun by **Harry_L** (CC BY 4.0) and SciFi Blaster by **Feche Pedroza** (CC BY 4.0), all from Sketchfab.
- Gunshot, reload and footstep sounds from Dive (MIT). Other sounds and the lobby music are generated in code.
- three.js (MIT) and Firebase JS SDK (Apache-2.0) are vendored in `overcharge/vendor`.
