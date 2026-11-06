# Instructions for Claude

## Watermark every clip
The user's confirmed watermark is **"SGC KS"**: bold (Inter Black), small (3% of video height), bottom-center,
white at 40% opacity with a faint shadow. Settings live in `watermark/watermark.conf`.

Whenever the user sends a video clip/edit (or says "add my watermark"), apply it with:

    watermark/watermark.sh <input> [output]

Do not change the watermark settings unless the user explicitly asks.
Send the watermarked file back to the user.
