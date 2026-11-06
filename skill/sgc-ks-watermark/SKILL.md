---
name: sgc-ks-watermark
description: Puts the user's "SGC KS" watermark on video clips and edits. Use whenever the user says "Code BAH" or "Code BAHH" (any capitalisation), or sends a video and asks for their watermark.
---

# SGC KS watermark

The user's watermark is **"SGC KS"**: bold, small, bottom-center, in a "glass" style where the
video shows through the lightened letters (not a grey overlay). Never change the text, size,
position, font or style unless the user explicitly asks.

## Codes

| User says   | Style                | Run                                        |
|-------------|----------------------|--------------------------------------------|
| `Code BAH`  | D - very faint (20%) | `bash watermark.sh BAH <input> <output>`   |
| `Code BAHH` | C - faint (30%)      | `bash watermark.sh BAHH <input> <output>`  |

Codes are case-insensitive. A clip sent with no code gets BAHH.

## Steps

1. Find the user's uploaded video. If they gave a code but no clip, ask them to send the clip.
2. Make sure ffmpeg is available (`ffmpeg -version`). If it is not:
   `pip install imageio-ffmpeg` then
   `export FFMPEG=$(python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")`.
   The script works without ffprobe.
3. Run the script from this skill's folder, writing an .mp4, e.g.
   `bash <skill-folder>/watermark.sh BAH input.mov output.mp4`
   The original audio is kept.
4. Give the watermarked video back to the user as a downloadable file.

If ffmpeg cannot be made to work, tell the user plainly. Never fake a result.
