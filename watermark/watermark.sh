#!/usr/bin/env bash
# Usage: watermark/watermark.sh [BAH|BAHH] input [output]
#   BAH  = watermark D (very faint)    BAHH = watermark C (faint)
# Applies the SGC KS "glass" watermark (video shows through the letters). Audio copied.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/watermark.conf"

CODE="$DEFAULT_CODE"
case "${1:-}" in
  [Bb][Aa][Hh])         CODE="BAH";  shift ;;
  [Bb][Aa][Hh][Hh])     CODE="BAHH"; shift ;;
esac
LIFT_VAR="LIFT_$CODE"; LIFT="${!LIFT_VAR}"

IN="${1:?usage: watermark.sh [BAH|BAHH] input [output]}"
OUT="${2:-${IN%.*}_wm.mp4}"

read -r VW VH FPS < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate \
  -of csv=p=0 "$IN" | tr ',' ' ')
FS=$(awk "BEGIN{v=$VH*$SIZE; if(v<18)v=18; printf \"%d\", v+0.5}")
M=$(awk "BEGIN{printf \"%d\", $VH*0.035+0.5}")

case "$POSITION" in
  bottom-right)  TX="w-tw-$M";   TY="h-th-$M" ;;
  bottom-left)   TX="$M";        TY="h-th-$M" ;;
  bottom-center) TX="(w-tw)/2";  TY="h-th-$M" ;;
  top-right)     TX="w-tw-$M";   TY="$M" ;;
  top-left)      TX="$M";        TY="$M" ;;
  center)        TX="(w-tw)/2";  TY="(h-th)/2" ;;
  *) echo "unknown POSITION: $POSITION" >&2; exit 1 ;;
esac

SAFE_TEXT="${TEXT//:/\\:}"; SAFE_TEXT="${SAFE_TEXT//\'/}"
T="fontfile=${FONT}:text='${SAFE_TEXT}':fontsize=${FS}:x=${TX}:y=${TY}"
L="val+(255-val)*${LIFT}"

ffmpeg -y -hide_banner -loglevel error -i "$IN" -filter_complex \
  "[0:v]format=rgba,split[base][src];\
color=c=black:s=${VW}x${VH}:r=${FPS},format=gray,drawtext=${T}:fontcolor=white[mask];\
[src]lutrgb=r='${L}':g='${L}':b='${L}'[lit];[lit][mask]alphamerge[txt];\
[base]drawtext=${T}:fontcolor=black@0:shadowcolor=black@0.15:shadowx=1:shadowy=1[b2];\
[b2][txt]overlay=shortest=1,format=yuv420p[out]" \
  -map "[out]" -map "0:a?" -c:v libx264 -crf 18 -preset medium -c:a copy "$OUT"
echo "$OUT  (code $CODE)"
