// v6-space — 摇篮之外 · BEYOND THE CRADLE. Pilot on the music-box track (101.75 BPM, 28 bars ≈ 66 s).
// Paper / ink / one dusty red. Archival photos only appear as halftone plates; all line art is original.
import * as A from './scenes_a.js';
import * as B from './scenes_b.js';
import { loadOnsets, CSS, clamp, prog } from './lib6.js';
import { bt, DUR, BAR, BEAT } from './story.js';
import { ht } from './scenes_a.js';

const F = '/v6-space/fonts/';
const first = async (ctx) => { await loadOnsets(ctx.base); return A.quote(ctx); };
const SECTIONS = [
  ['quote', 0, bt(2.5), first, ''], ['title', bt(2.5), bt(4), A.title, ''],
  ['dawn', bt(4), bt(8), A.dawn, '黎明'], ['moon', bt(8), bt(12), A.moon, '月球'],
  ['stations', bt(12), bt(16), B.stations, '空间站'], ['world', bt(16), bt(18), B.world, '全人类'],
  ['clips', bt(18), bt(21), B.clips, '新时代'], ['today', bt(21), bt(25), B.today, '今天'], ['outro', bt(25), DUR, B.outro, ''],
];
const DARK = new Set(['quote', 'stations']);

export default {
  bpm: 101.75, dur: 66.2, audio: 'audio/disc.mp3',
  fonts: {
    SR: F + 'SongtiSC-Regular-sub.otf', SB: F + 'SongtiSC-Bold-sub.otf', SK: F + 'SongtiSC-Black-sub.otf',
    PM: F + 'IBMPlexMono-SemiBold.ttf', PR: F + 'IBMPlexMono-Regular.ttf', AB: F + 'Archivo-w1000-900.ttf',
  },
  scenes: SECTIONS.map(([name, from, to, make]) => ({ name, from, to, make })),
  post(t) {
    return { bloom: 0, bloomThreshold: 10, vignette: 0.12, grain: 0.055, ca: 0.0005, fade: Math.max(0, 1 - t / 0.6) };
  },
  hud(h, f, s) {
    const t = f.t, sec = SECTIONS.find((x) => x[0] === s.name);
    if (!sec || !sec[4]) return;
    const dark = DARK.has(s.name), c = dark ? CSS.glow : CSS.ink;
    const a = 0.8 * prog(t, sec[1] + 0.2, sec[1] + 0.6);
    const idx = SECTIONS.filter((x) => x[4]).findIndex((x) => x[0] === s.name) + 1;
    ht(h, '摇篮之外', 64, 70, { font: 'SB', px: 20, color: c, align: 'left', alpha: a, tracking: 0.3 });
    ht(h, 'BEYOND THE CRADLE', 180, 70, { font: 'PM', px: 13, color: c, align: 'left', alpha: a * 0.7, tracking: 0.3 });
    ht(h, `${String(idx).padStart(2, '0')} ${sec[4]}`, 1856, 70, { font: 'SB', px: 20, color: CSS.red, align: 'right', alpha: a, tracking: 0.2 });
    h.save(); h.globalAlpha = a * 0.35; h.fillStyle = c; h.fillRect(64, 84, 1792, 1); h.restore();
  },
};
