#!/bin/zsh
# per-section loudness via ffmpeg volumedetect: sections = bar boundaries at 128 BPM
f=${1:-/Users/mac/projects/octos-promo/v5-arc/audio/track.wav}
for sec in "0 7.5 intro" "7.5 15 arcbench" "15 26.25 pipeline" "26.25 33.75 testwall" "33.75 37.5 break" "37.5 45 sites" "45 52.5 results" "52.5 56.25 outro" "56.25 60 end"; do
  set -- ${=sec}
  r=$(ffmpeg -hide_banner -nostats -ss $1 -to $2 -i $f -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume" | awk '{print $5}' | tr '\n' ' ')
  printf "%-10s %6s-%-6s mean/max dB: %s\n" $3 $1 $2 "$r"
done
