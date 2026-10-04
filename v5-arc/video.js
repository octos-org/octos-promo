// v5-arc — "THE FACTORY": Octos on ARC-Bench. 128 BPM, 32 bars = 60 s (bar = 1.875 s).
// A coding agent builds a whole web app inside a container; the Octos kernel runs one pipeline graph per task.
import * as S1 from './s1_container.js';
import * as S2 from './s2_arcbench.js';
import * as S3 from './s3_pipeline.js';
import * as S4 from './s4_testwall.js';
import * as S5 from './s5_kernel.js';
import * as S6 from './s6_sites.js';
import * as S7 from './s7_results.js';
import * as S8 from './s8_outro.js';
import { CSS, hudText, hudRule, bt, BAR, BEAT } from './lib.js';

const F = '/v5-arc/fonts/';
const fade = (t) => Math.max(0, 1 - t / 0.9) + Math.max(0, (t - 58.6) / 1.4);
const LABELS = { container: '01', arcbench: '02', pipeline: '03', testwall: '04', kernel: '05', sites: '06', results: '07', outro: '08' };
const TITLES = { container: 'CONTAINER', arcbench: 'ARC-BENCH', pipeline: 'PIPELINE', testwall: 'PLAYWRIGHT', kernel: 'KERNEL', sites: 'WEB TRACK', results: 'RESULTS', outro: 'OCTOS-ARC' };

export default {
  bpm: 128, dur: 60, audio: 'audio/track.wav',
  fonts: {
    AX: F + 'Archivo-w1250-900.ttf', AW: F + 'Archivo-w1125-900.ttf', AB: F + 'Archivo-w1000-900.ttf',
    AC: F + 'Archivo-w750-900.ttf', AM: F + 'Archivo-w1000-500.ttf',
    PM: F + 'IBMPlexMono-SemiBold.ttf', PR: F + 'IBMPlexMono-Regular.ttf',
  },
  scenes: [
    { name: 'container', from: 0, to: bt(4), make: S1.make },
    { name: 'arcbench', from: bt(4), to: bt(8), make: S2.make },
    { name: 'pipeline', from: bt(8), to: bt(14), make: S3.make },
    { name: 'testwall', from: bt(14), to: bt(18), make: S4.make },
    { name: 'kernel', from: bt(18), to: bt(20), make: S5.make },
    { name: 'sites', from: bt(20), to: bt(24), make: S6.make },
    { name: 'results', from: bt(24), to: bt(28), make: S7.make },
    { name: 'outro', from: bt(28), to: 60, make: S8.make },
  ],
  post(t) { return { fade: Math.min(1, fade(t)), ca: 0.0012, grain: 0.045 }; },
  // industrial annotation layer
  hud(h, f, s) {
    const t = f.t;
    if (t < 1.2 || t > 57.2) return;
    const a = 0.75 * Math.min(1, (t - 1.2) / 0.6) * Math.min(1, (57.2 - t) / 0.6);
    const m = 56;
    hudText(h, 'OCTOS', m, m + 8, { font: 'PM', px: 15, color: CSS.bone, alpha: a, tracking: 0.2 });
    hudText(h, '×', m + 72, m + 8, { font: 'PR', px: 15, color: CSS.orange, alpha: a });
    hudText(h, 'ARC-BENCH', m + 92, m + 8, { font: 'PM', px: 15, color: CSS.bone, alpha: a, tracking: 0.2 });
    hudText(h, `${LABELS[s.name] ?? ''} / 08   ${TITLES[s.name] ?? ''}`, 1920 - m, m + 8, { font: 'PM', px: 15, color: CSS.bone, alpha: a, align: 'right', tracking: 0.14 });
    hudRule(h, m, m + 22, 1920 - m, m + 22, { color: CSS.bone, alpha: a * 0.25 });
    // bar.beat counter + beat lamp
    const bar = Math.floor(t / BAR + 1e-6), beat = Math.floor((t % BAR) / BEAT + 1e-6);
    hudText(h, `${String(bar + 1).padStart(2, '0')}.${beat + 1}`, 1920 - m, 1080 - m, { font: 'PM', px: 14, color: CSS.bone, alpha: a * 0.6, align: 'right', tracking: 0.1 });
    const ph = (t % BEAT) / BEAT;
    h.save(); h.globalAlpha = a * (0.25 + 0.75 * Math.exp(-ph * 6)); h.fillStyle = CSS.orange;
    h.fillRect(1920 - m - 74, 1080 - m - 11, 8, 8); h.restore();
  },
};
