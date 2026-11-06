# Instructions for Claude

## Watermark codes (SGC KS)
The user watermarks their video edits with **"SGC KS"**: bold, small, bottom-center, in a
"glass" style where the video shows through the lightened letters (not a grey overlay).

When the user says one of these codes with a clip, apply that watermark:

| User says   | Watermark            | Command                                          |
|-------------|----------------------|--------------------------------------------------|
| `Code BAH`  | D - very faint (20%) | `watermark/watermark.sh BAH <input> [output]`    |
| `Code BAHH` | C - faint (30%)      | `watermark/watermark.sh BAHH <input> [output]`   |

Codes are case-insensitive (`code bah`, `CODE BAHH`). If they send a clip and ask for the
watermark without a code, use BAHH. Send the watermarked file back to the user.
Do not change the watermark settings in `watermark/watermark.conf` unless the user asks.
