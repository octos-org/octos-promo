#!/bin/bash
# usage: tools/sheet.sh FROM TO N COLS OUT   (renders stills via engine/render.mjs, tiles them without drawtext)
cd /Users/mac/projects/octos-promo
FROM=$1; TO=$2; N=$3; COLS=$4; OUT=$5
TS=$(python3 -c "print(','.join('%.3f'%($FROM+($TO-$FROM)*i/max(1,$N-1)) for i in range($N)))")
D=v2-wire/out/.sheet; rm -rf $D; mkdir -p $D
node engine/render.mjs v2-wire stills --t $TS --out $D 2>&1 | grep -v 404 | grep -v "^v2-wire" 
ROWS=$(( (N + COLS - 1) / COLS ))
ffmpeg -y -loglevel error -pattern_type glob -i "$D/t*.png" -vf "scale=480:270,tile=${COLS}x${ROWS}" -frames:v 1 $OUT
echo "$OUT  t=$TS"
