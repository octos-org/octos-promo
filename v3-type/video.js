// v3-type — "TYPE": Swiss/brutalist kinetic typography in 3D for Octos. 120 BPM, bar = 2 s.
import * as S1 from './s1_monolith.js';
import * as S2 from './s2_voxel.js';
import * as S3 from './s3_statement.js';
import * as S4 from './s4_rapid.js';
import * as S5 from './s5_boundary.js';
import * as S6 from './s6_protocol.js';
import * as S7 from './s7_stack.js';
import * as S8 from './s8_outro.js';
import { CSS, hudText, hudRule } from './lib.js';

const F = '/v3-type/fonts/';
const fade = (t) => Math.max(0, 1 - t / 0.8) + Math.max(0, (t - 58.6) / 1.4);
const LABELS = { monolith: '01', voxel: '02', statement: '03', rapid: '04', boundary: '05', protocol: '06', stack: '07', outro: '08' };

export default {
  bpm: 120, dur: 60, audio: 'audio/track.wav',
  fonts: {
    AX: F + 'Archivo-w1250-900.ttf', AW: F + 'Archivo-w1125-900.ttf', AB: F + 'Archivo-w1000-900.ttf',
    AC: F + 'Archivo-w750-900.ttf', AN: F + 'Archivo-w620-900.ttf', AM: F + 'Archivo-w1000-500.ttf',
    PM: F + 'IBMPlexMono-SemiBold.ttf', PR: F + 'IBMPlexMono-Regular.ttf',
  },
  scenes: [
    { name: 'monolith', from: 0, to: 8, make: S1.make },
    { name: 'voxel', from: 8, to: 16, make: S2.make },
    { name: 'statement', from: 16, to: 22, make: S3.make },
    { name: 'rapid', from: 22, to: 30, make: S4.make },
    { name: 'boundary', from: 30, to: 36, make: S5.make },
    { name: 'protocol', from: 36, to: 44, make: S6.make },
    { name: 'stack', from: 44, to: 50, make: S7.make },
    { name: 'outro', from: 50, to: 60, make: S8.make },
  ],
  post(t) { return { fade: Math.min(1, fade(t)), ca: 0.0012, grain: 0.045 }; },
  // Swiss corner annotations; colour follows the scene's field
  hud(h, f, s) {
    const t = f.t;
    if (t < 2 || t > 57.5) return;
    const tone = s.obj.tone ? s.obj.tone(t) : 'bone';
    const col = tone === 'ink' ? CSS.ink : CSS.bone;
    const a = 0.8 * Math.min(1, (t - 2) / 0.6);
    const m = 56;
    hudText(h, 'OCTOS', m, m + 8, { font: 'PM', px: 15, color: col, alpha: a, tracking: 0.2 });
    hudText(h, 'AGENTIC OPERATING SYSTEM', m + 86, m + 8, { font: 'PR', px: 15, color: col, alpha: a * 0.7, tracking: 0.12 });
    hudText(h, `${LABELS[s.name] ?? ''} / 08`, 1920 - m, m + 8, { font: 'PM', px: 15, color: col, alpha: a, align: 'right', tracking: 0.12 });
    hudRule(h, m, m + 22, 1920 - m, m + 22, { color: col, alpha: a * 0.35 });
  },
};
