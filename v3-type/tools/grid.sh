#!/bin/zsh
# tile all stills in out/stills into out/grid.png ; args: cols width
cols=${1:-3}; w=${2:-640}; h=$(( w * 9 / 16 ))
cd /Users/mac/projects/octos-promo/v3-type/out/stills
n=$(ls *.png | wc -l | tr -d ' ')
rows=$(( (n + cols - 1) / cols ))
ffmpeg -y -loglevel error -pattern_type glob -i '*.png' -vf "scale=${w}:${h},tile=${cols}x${rows}" -frames:v 1 ../grid.png
