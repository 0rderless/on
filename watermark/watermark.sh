#!/usr/bin/env bash
# Usage: watermark/watermark.sh input.mp4 [output.mp4]
# Applies the confirmed watermark from watermark.conf to a clip (audio copied untouched).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/watermark.conf"
IN="${1:?usage: watermark.sh input [output]}"
OUT="${2:-${IN%.*}_wm.mp4}"
M="(h*0.035)"   # margin from edges

case "$POSITION" in
  bottom-right)  X="W-w-$M"; Y="H-h-$M"; TX="w-tw-$M"; TY="h-th-$M" ;;
  bottom-left)   X="$M";     Y="H-h-$M"; TX="$M";     TY="h-th-$M" ;;
  bottom-center) X="(W-w)/2";Y="H-h-$M"; TX="(w-tw)/2";TY="h-th-$M" ;;
  top-right)     X="W-w-$M"; Y="$M";     TX="w-tw-$M"; TY="$M" ;;
  top-left)      X="$M";     Y="$M";     TX="$M";     TY="$M" ;;
  center)        X="(W-w)/2";Y="(H-h)/2";TX="(w-tw)/2";TY="(h-th)/2" ;;
  *) echo "unknown POSITION: $POSITION" >&2; exit 1 ;;
esac
X="${X//h*/H*}"; Y="${Y//h*/H*}"   # overlay uses H for main height

if [[ -n "$LOGO" ]]; then
  LOGO_PATH="$LOGO"; [[ "$LOGO" = /* ]] || LOGO_PATH="$DIR/../$LOGO"
  ffmpeg -y -hide_banner -loglevel error -i "$IN" -i "$LOGO_PATH" -filter_complex \
    "[1:v][0:v]scale2ref=w=oh*mdar:h=ih*${SIZE}*2.5[lg][base];[lg]format=rgba,colorchannelmixer=aa=${OPACITY}[lga];[base][lga]overlay=x=${X}:y=${Y}" \
    -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a copy "$OUT"
else
  SAFE_TEXT="${TEXT//:/\\:}"; SAFE_TEXT="${SAFE_TEXT//\'/}"
  ffmpeg -y -hide_banner -loglevel error -i "$IN" -vf \
    "drawtext=fontfile=${FONT}:text='${SAFE_TEXT}':fontsize=h*${SIZE}:fontcolor=white@${OPACITY}:shadowcolor=black@$(awk "BEGIN{print ${OPACITY}*0.7}"):shadowx=2:shadowy=2:x=${TX}:y=${TY}" \
    -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a copy "$OUT"
fi
echo "$OUT"
