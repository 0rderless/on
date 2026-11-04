# OVERCHARGE

A mobile **zero-build battle royale** built for phones in landscape. Guns, **Shockwave** and **Overdrive** grenades, realistic bots, ranked play and a fully customizable HUD. Drop into **Reversal Compound**.

## Play

The game is a static web app. Open `overcharge/index.html` from any web server, for example with GitHub Pages:

1. On GitHub, open **Settings → Pages** for this repository.
2. Under *Build and deployment*, pick **Deploy from a branch**, choose the branch with the game and the `/ (root)` folder, then save.
3. Open `https://<your-user>.github.io/<repo>/` on your phone. The root `index.html` redirects to the game.
4. Tip: use your browser's **Add to Home Screen** to play full screen in landscape.

For local testing: `python3 -m http.server` in the repository root, then open `http://localhost:8000/overcharge/`.

## Features

- **Modes:** Battle Royale (solo, 30 players) and Reload (squads of 4, 24 players, respawn while a squadmate is alive until the storm closes Reload).
- **Queues:** Unranked for casual play with easier bots; Ranked with **Bronze I → Gold III**. Everyone starts at Bronze I and climbs with placement and eliminations. Bronze never loses progress, and you can't be demoted out of a division you've earned. Bots get tougher as you rank up.
- **Zero Build:** 100 health and a 50 overshield that regenerates after 5 s out of combat. Every elimination fully restores your health and shield.
- **Jetpacks:** everyone drops in wearing one by default (you can switch this off in the LOADOUT tab). Two more spawn at every named location, more are scattered around, and chests can drop them. A jetpack sits on your back without using a slot. Hold JUMP in the air to fly, up to about 24 m. Fuel refills on the ground, and you take no fall damage while wearing one. Bots use them too.
- **Weapons:** Assault Rifle, Pump Shotgun, Volt SMG and Arc Sniper, in Common → Legendary rarities.
- **Shockwave Grenade:** works like Fortnite's. Tap fire and it pops at your feet, launching you up and forward (about 30 m) in the direction you're moving, or where you're looking if you're standing still. You can steer in the air, and you take no fall damage. Anyone next to you gets knocked away.
- **Overdrive Grenade:** an electric blast that damages enemies and supercharges you and allies (+25% speed, +30% fire rate, faster reloads, faster shield regen).
- **Mobile controls:** joystick; two fire buttons that also steer the camera while held; swipe to look; **Auto Fire**; aim assist; auto-sprint; auto pick-up.
- **Field of View:** defaults to Fortnite mobile's 80° and is adjustable from 60° to 120° in Settings, with a live preview of the game view.
- **Auto Shoot:** locks onto enemies near your crosshair (the closer they are, the wider it grabs). It sticks to them while they strafe or briefly duck behind cover, and fires accurately for you. Only a deliberate flick breaks the lock. It's separate from Aim Assist and can be toggled with the AUTO button in a match.
- **HUD editor** (Settings → Edit HUD): drag any control, inventory or panel, and set its size and opacity per element.
- **Locker:** outfits *Default*, *Shock Trooper* and *Platinum Boy*, and pickaxes *Standard Issue*, *Volt Splitter*, *Platinum Pick* and *Neon Reaper*. All are free while the game is in testing.
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
