# Fortnite Mobile camera framing: notes

Source: the "Fortnite Mobile on the iPhone 18 Pro" gameplay video (third person, hip fire, landscape).
Each measurement is a fraction of the screen, taken from frames sampled every 15 s with a quarter grid laid over them.

## Hip fire (not aiming)
- **Horizontal:** the body's centre line sits at about **40–43 %** of the screen width, just left of centre. The camera rides over the right shoulder, so the crosshair (screen centre) sits to the right of the head.
- **Vertical:**
  - The head is at about **43–46 %** of the screen height, level with or slightly above the crosshair.
  - The feet are at about **83–88 %**, so they stay clear of the bottom HUD (hotbar and health bars).
- **Size:** the character takes up about **40–44 %** of the screen height (around 1.8 m of character at about 4.3 m from the camera, with an 80° horizontal FOV).
- **Camera height:** when looking level, the camera's line of sight crosses the character at roughly **chest or shoulder height** (about 1.45–1.5 m), not above the head. This keeps the horizon near the middle of the screen and the whole body above the hotbar.
- **Pitch:** looking down, the camera swings up and over. Looking up, it drops towards the character's back. The orbit pivots around the upper chest.

## Aiming down sights (non-scoped)
- The camera moves in close over the right shoulder. The character becomes large and sits in the **bottom-left quarter**, with the shoulder and gun at about 25–35 % across.
- The head stays at about **45–50 %** height, and the crosshair stays clear to the right of the shoulder.

## Other observations
- When sprinting or moving forward, the framing stays the same. There is no camera bob.
- When skydiving or gliding, the camera pulls back and centres the character.
- Things on the HUD that sit next to the character: joystick bottom-left (about 12 % across, 70 % down), hotbar bottom-centre, fire buttons right.

## What OVERCHARGE does with this (v1.6.0)
- The hip rig was lowered and pulled in so that the head lands at about 45 % and the feet at about 85 %. Before, the head was at about 57 % and the feet touched the hotbar.
- The ADS rig was lowered the same way.
- The values are in `js/game/player.js` → `CAMERA_RIG`.
