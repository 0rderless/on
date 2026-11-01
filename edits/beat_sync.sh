#!/usr/bin/env bash
# Re-sync the Winter Soldier edit to "Raya (Slowed)" - Zericxon.
#
# Analysis (spectral-flux onsets + grid fit):
#   original edit : 16th note = 0.1740s (~86.2 BPM), grid phase 0.064s, every cut on this grid (<=9ms)
#                   drop cut  = 16th #32 (5.632s)
#   new song      : 16th note = 0.1532s (~97.9 BPM), grid phase 0.016s (in the screen recording)
#                   accent/drop = 16th #73 (11.200s) - hit right after the 1/16 gap
#
# The video is sped up uniformly by 0.1740/0.1532 so every original grid slot maps
# onto the new grid, and the song is offset so the drop cut lands on the song's drop.
# Result: all 39 cuts within +/-11ms of the new beat grid (< 1 frame at 60fps).
#
# Usage: ./beat_sync.sh <edit.mp4> <song_screen_recording.mp4> [out.mp4]
set -euo pipefail
EDIT=$1; SONG=$2; OUT=${3:-winter_soldier_edit_raya.mp4}

O16=0.1740; O0=0.064; ODROP=32     # original grid
N16=0.1532; N0=0.016; NDROP=73     # new song grid
DUR=17.30                          # song recording runs out here

R=$(python3 -c "print($O16/$N16)")
AS=$(python3 -c "print($N0+$NDROP*$N16 - ($O0+$ODROP*$O16)/$R)")
FADE=$(python3 -c "print($DUR-0.6)")

ffmpeg -y -i "$EDIT" -ss "$AS" -i "$SONG" \
  -filter_complex "[0:v]setpts=PTS/$R,fps=60,trim=0:$DUR,setpts=PTS-STARTPTS[v];\
[1:a]atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=out:st=$FADE:d=0.6[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset veryfast -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -movflags +faststart "$OUT"
