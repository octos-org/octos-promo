# Octos promo video

Code-rendered promo for [Octos](https://github.com/octos-org/octos), modelled on
[mexicat/pdoom-video](https://github.com/mexicat/pdoom-video): every frame is a pure
function of song time, so the browser preview and the offline export match.

- `audio/synth.py` — original 128 BPM soundtrack (numpy), writes `audio/octos.wav`.
- `src/video.js` — the whole video: 8 scenes laid out in bars, HUD, bloom, grain.
- `render.mjs` — headless Chrome → PNG frames → ffmpeg.

```sh
npm install
python3 audio/synth.py
node render.mjs stills --t 3,20,34
node render.mjs video --samples 3 --jobs 4 --out out/octos-promo.mp4
npx http-server . # then open /index.html?t=30 — space play/pause, ←/→ seek
```

Fonts: Archivo and IBM Plex Mono (SIL OFL), copied from pdoom-video.

## Versions

`v1-abyss` … `v6-space` are separate cuts sharing `engine/` (`node engine/render.mjs <dir> …`).
Soundtracks are generated, not committed: run each version's `audio/track.py` (or `audio/synth.py`) to rebuild `track.wav`.

CJK fonts: `v4-cosmos` and `v6-space` expect Chinese subset fonts in `<version>/fonts/` (`PingFangSC-{Regular,Semibold}-sub.otf`, `SongtiSC-{Regular,Bold,Black}-sub.otf`). These are subsets of Apple system fonts and are not redistributed here. On macOS, build them with `tools/ttc.mjs sub <font.ttc> <index> <out.otf> "<chars>"` (see `v6-space/tools/subset.mjs`), or drop in an open CJK font (e.g. Noto Sans SC / Source Han Serif, SIL OFL) under the same filenames.
