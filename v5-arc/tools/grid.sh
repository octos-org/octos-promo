#!/bin/zsh
# tile the given stills (or all in out/stills) into out/grid.png ; env COLS, W
cd /Users/mac/projects/octos-promo/v5-arc/out/stills
cols=${COLS:-2}; w=${W:-960}; h=$(( w * 9 / 16 ))
files=(${@:-*.png}); n=${#files}
rows=$(( (n + cols - 1) / cols ))
args=(); for f in $files; do args+=(-i $f); done
ffmpeg -y -loglevel error $args -filter_complex "$(for i in $(seq 0 $((n-1))); do printf "[$i:v]scale=${w}:${h}[v$i];"; done)$(for i in $(seq 0 $((n-1))); do printf "[v$i]"; done)xstack=inputs=${n}:layout=$(python3 -c "
c=$cols;n=$n;w=$w;h=$h
print('|'.join(f'{(i%c)*w}_{(i//c)*h}' for i in range(n)))")$( [ $n -eq 1 ] && echo '' )" -frames:v 1 ../grid.png 2>&1 || cp $files[1] ../grid.png
