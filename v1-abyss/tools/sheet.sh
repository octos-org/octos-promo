#!/bin/bash
# usage: tools/sheet.sh "t1,t2,..." out.png [cols]
cd /Users/mac/projects/octos-promo
OUT=v1-abyss/out/sheetframes
rm -rf $OUT; mkdir -p $OUT
node engine/render.mjs v1-abyss stills --t "$1" --out $OUT 2>&1 | grep -v -E "404|GPU" | awk '{print $2, $3}' | tr '\n' ' '; echo
COLS=${3:-4}
N=$(ls $OUT/*.png | wc -l | tr -d ' ')
ROWS=$(( (N + COLS - 1) / COLS ))
ffmpeg -loglevel error -y -pattern_type glob -i "$OUT/t*.png" -vf "scale=640:360,tile=${COLS}x${ROWS}:padding=4" -frames:v 1 "$2"
