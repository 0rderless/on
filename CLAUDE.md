# Notes for Claude

The owner (sgc.ks) makes TikTok edits and sometimes asks Claude to cut them.
Follow these preferences for any video edit unless told otherwise.

## Watermark — ALWAYS use this exact one: sgc.ks (small glass style)

Apply it with `python3 edits/watermark.py input.mp4 output.mp4`. The script holds the exact spec:

- Text: **sgc.ks** (lowercase, exactly like that)
- Font: **Inter Display Black**, **24px** on a 1080×1920 video, letter spacing **3px**
- Fill: **no solid color**. The letters show the video itself through them, lightened **32%** toward white
  (each channel: `v + (255 - v) * 0.32`). This "see-through" look is what the owner wants;
  faint gray text or semi-transparent white is NOT it.
- Edges: 1px black outline at 45% opacity, 1px top-left bevel highlight (white 55%),
  1px bottom-right bevel shadow (black 45%)
- Position: centered horizontally, bottom of the text **40px above the bottom edge of the
  video picture** (inside the picture, not in the black bars, because TikTok's caption UI covers those)
- Same spot for the whole video. Scale everything with the video width if it isn't 1080 wide.
- Visual reference: `edits/sgcks_watermark_reference.png` — the chosen one is **Option 1**.

## Edit style preferences

- Output: **1080×1920, 60fps**, H.264 MP4 + AAC. Near-square source footage sits centered
  with black bars (no blurry full-screen upscale unless asked).
- **Everything on beat.** Detect the song's hits (librosa onset/RMS-rise), build a beat grid,
  and cut ~1 frame before each hit. Half-beat cuts are fine; never cut off-grid.
  Verify by measuring cut times against audio hits (aim ≤ ~1.5 frames).
- End right **before** a hit so the video loops cleanly on TikTok.
- **Remove source watermarks/text** — prefer cropping the strip over blurring.
- Saturation: light boost overall; dark/desaturated clips can take more
  (they used ~1.5x on dark clips); don't push already-vivid clips (they clip/blob).
- Slow-mo only where a clip is too short for its beat; use optical-flow interpolation,
  and never interpolate across a hard cut.
- Show the owner labeled stills (one image per clip with a big letter) when they want to
  pick or reorder clips.

## Files

- `edits/watermark.py` — applies the sgc.ks watermark to any video (auto-detects the picture area).
- `edits/spiderman_render.py` — the beat-synced renderer used for the Spider-Man edit
  (edit list, beat grid, zoom punches, flashes, grading, slow-mo). Reuse it as a template.
- `edits/sgcks_watermark_reference.png` — watermark options; Option 1 is the chosen one.
