// OCTOS — "WIRE" (v2): neon wireframe / data-flow promo. 128 BPM, 32 bars + tail.
import { clamp, prog, ease } from '../engine/util.js';
import { BAR, BEAT, bt, hit, beatEnv } from './lib.js';
import boot from './scenes/boot.js';
import kernel from './scenes/kernel.js';
import protocol from './scenes/protocol.js';
import crates from './scenes/crates.js';
import swarm from './scenes/swarm.js';
import anywhere from './scenes/anywhere.js';
import boundary from './scenes/boundary.js';
import logo from './scenes/logo.js';

const SCENES = [
  { name: '01 BOOT', from: 0, to: bt(4), make: boot },
  { name: '02 KERNEL', from: bt(4), to: bt(8), make: kernel },
  { name: '03 PROTOCOL', from: bt(8), to: bt(12), make: protocol },
  { name: '04 CRATES', from: bt(12), to: bt(16), make: crates },
  { name: '05 SWARM', from: bt(16), to: bt(20), make: swarm },
  { name: '06 ANYWHERE', from: bt(20), to: bt(24), make: anywhere },
  { name: '07 BOUNDARY', from: bt(24), to: bt(28), make: boundary },
  { name: '08 OCTOS', from: bt(28), to: 62, make: logo },
];

export default {
  bpm: 128, dur: 62, audio: 'audio/track.wav',
  fonts: { Mono: '/v2-wire/fonts/IBMPlexMono-SemiBold.ttf', MonoR: '/v2-wire/fonts/IBMPlexMono-Regular.ttf', ArchX: '/v2-wire/fonts/Archivo-w1250-900.ttf', Arch: '/v2-wire/fonts/Archivo-w1000-900.ttf' },
  scenes: SCENES,
  post(t) {
    const fade = Math.max(1 - prog(t, 0, 1.2), prog(t, 61, 62));
    return { fade, grain: 0.06, vignette: 0.6, ca: 0.0018, bloom: 0.8, bloomThreshold: 0.8, bloomRadius: 0.45 };
  },
  hud(h, f, s) {
    const t = f.t;
    h.shadowColor = 'rgba(0,0,0,0)'; h.shadowBlur = 0;
    h.font = '500 20px Mono';
    h.fillStyle = 'rgba(120,220,255,0.55)';
    h.fillText('OCTOS', 96, 80);
    h.fillStyle = 'rgba(120,220,255,0.35)';
    h.fillText('// ' + s.name, 170, 80);
    const bar = Math.floor(t / BAR), beat = Math.floor((t % BAR) / BEAT);
    const tc = `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}  ${String(bar + 1).padStart(2, '0')}.${beat + 1}`;
    h.textAlign = 'right'; h.fillText(tc, 1920 - 96, 80); h.textAlign = 'left';
  },
};
