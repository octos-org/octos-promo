// S4 22–30 s: rapid fire. One capability per 2 beats, each a 3D moment: glyphs converge on the downbeat,
// the camera swings round the word, then the word bursts toward the lens as the colour field flips.
import * as THREE from 'three';
import { C, CSS, INK, BONE, ORANGE, OR_SIDE, typeMat, kinetic, envMap, camLook, since, gridPulse, posterPlane, keyLight, orbit, hudText, hudRule } from './lib.js';
import { ease, clamp, lerp, mulberry32 } from '../engine/util.js';
import { getTS } from './common.js';

export const WORDS = [
  ['EXECUTION', 'octos-agent', 'the execution loop'],
  ['CONTEXT', 'octos-agent', 'context management'],
  ['MEMORY', 'octos-memory', 'memory · episodes · retrieval'],
  ['TOOLS', 'octos-agent', 'tools · hooks · sandboxing'],
  ['SKILLS', 'octos-plugin', 'skills & plugins'],
  ['WORKFLOWS', 'octos-pipeline', 'workflow graphs · validation'],
  ['COORDINATION', 'octos-swarm', 'parallel workers · aggregation'],
  ['ONE KERNEL.', 'octos', 'embeddable · written in rust'],
];
const T0 = 22, STEP = 1;
const BG = ['ink', 'orange', 'bone', 'ink', 'orange', 'bone', 'ink', 'orange'];

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.9;
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 800);
  const key = keyLight(scene, { intensity: 3.0, pos: [-12, 22, 18], target: [0, 0, 0], size: 30 });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.3));

  const mats = {
    ink: typeMat({ face: BONE, side: OR_SIDE, rough: 0.4, clearcoat: 0.6, flatFace: 0.45 }),
    orange: typeMat({ face: INK, side: BONE, rough: 0.4, clearcoat: 0.6, flatFace: 0.45 }),
    bone: typeMat({ face: INK, side: OR_SIDE, rough: 0.4, clearcoat: 0.6, flatFace: 0.45 }),
  };
  const floors = {};
  for (const [k, hex, sh] of [['ink', INK, 0x000000], ['orange', ORANGE, 0x5a1500], ['bone', BONE, 0x3a3530]]) {
    const fl = posterPlane(900, 900, hex, { shadowHex: sh, strength: k === 'ink' ? 0.0 : 0.4 });
    fl.rotation.x = -Math.PI / 2; fl.visible = false; scene.add(fl); floors[k] = fl;
  }

  const rnd = mulberry32(99);
  const words = WORDS.map(([w], i) => {
    const font = w.length > 10 ? 'AC' : 'AW';
    const probe = ts.layout(font, w, { tracking: -0.01 });
    const size = Math.min(5.2, 25 / probe.width);
    const kin = kinetic(ts, font, w, mats[BG[i]], { size, depth: 0.55, tracking: -0.01 });
    kin.group.visible = false; scene.add(kin.group);
    const capH = size * 0.97;
    const gl = kin.glyphs.map((g, j) => ({
      m: g.mesh, home: new THREE.Vector3(g.x, g.y - capH / 2, 0), j,
      from: new THREE.Vector3(g.x * 0.3 + (rnd() - 0.5) * 18, (rnd() - 0.5) * 12, 16 + rnd() * 16),
      rot: [(rnd() - 0.5) * 8, (rnd() - 0.5) * 8, (rnd() - 0.5) * 4],
      out: new THREE.Vector3(g.x * 0.08 + (rnd() - 0.5) * 1.5, (rnd() - 0.5) * 1.2, 1.2 + rnd()).normalize(),
      spin: [(rnd() - 0.5) * 10, (rnd() - 0.5) * 10, (rnd() - 0.5) * 6],
    }));
    return { kin, gl, size, capH, dir: i % 2 ? -1 : 1 };
  });

  const cur = (t) => clamp(Math.floor((t - T0) / STEP), 0, WORDS.length - 1);
  return {
    scene, camera: cam,
    tone: (t) => (BG[cur(t)] === 'ink' ? 'bone' : 'ink'),
    update(f) {
      const t = f.t;
      const i = cur(t);
      const lt = t - (T0 + i * STEP);
      const bg = BG[i];
      scene.background.copy(C[bg]);
      for (const k in floors) floors[k].visible = k === bg;
      words.forEach((w, k) => { w.kin.group.visible = k === i; });
      const W = words[i];
      const n = W.gl.length;
      for (const g of W.gl) {
        const u = clamp((lt - g.j * 0.018) / 0.3);
        const e = ease.outExpo(u);
        g.m.position.lerpVectors(g.from, g.home, e);
        const r = 1 - e;
        let rx = g.rot[0] * r, ry = g.rot[1] * r, rz = g.rot[2] * r;
        const last = i === WORDS.length - 1;
        const v = last ? 0 : ease.inExpo(clamp((lt - 0.8 - (n - 1 - g.j) * 0.008) / 0.2));
        if (v > 0) {
          g.m.position.addScaledVector(g.out, v * 55);
          rx += g.spin[0] * v; ry += g.spin[1] * v; rz += g.spin[2] * v;
        }
        g.m.rotation.set(rx, ry, rz);
      }
      floors[bg].position.y = -W.capH / 2 - 2.2;
      // camera swings round the word; slams back on the downbeat
      const slam = ease.outExpo(clamp(lt / 0.35));
      const R = lerp(21, 30, slam) + lt * 1.5;
      const yaw = W.dir * lerp(-0.42, 0.3, ease.outCubic(clamp(lt / 1.0)));
      const pitch = lerp(0.28, 0.1, ease.outCubic(clamp(lt)));
      camLook(cam, orbit([0, 0, 0], R, yaw, pitch), [0, -0.2, 0], W.dir * lerp(0.06, -0.02, lt));
      cam.fov = 30; cam.updateProjectionMatrix();
      key.position.set(-12 * W.dir, 22, 18);
      const cut = lt;
      const beat = gridPulse(t, T0, 30, 0.5, 0.1);
      return {
        bloom: bg === 'ink' ? 0.35 : 0.25, bloomThreshold: 3.5, vignette: bg === 'ink' ? 0.45 : 0.2,
        exposure: 1 + 0.02 * beat,
        flash: 0.35 * Math.exp(-cut / 0.06), flashColor: [1, 1, 1],
        zoomBlur: 0.08 * Math.exp(-cut / 0.1) + (i < 7 ? 0.12 * ease.inExpo(clamp((lt - 0.85) / 0.15)) : 0),
        shake: [0.003 * Math.exp(-cut / 0.08) * Math.sin(t * 130), 0.003 * Math.exp(-cut / 0.08) * Math.cos(t * 110)],
      };
    },
    hud(h, f) {
      const t = f.t;
      const i = cur(t);
      const lt = t - (T0 + i * STEP);
      const col = BG[i] === 'ink' ? CSS.bone : CSS.ink;
      const a = clamp((lt - 0.12) / 0.1) * (i < 7 ? 1 - clamp((lt - 0.85) / 0.1) : 1);
      const [, crate, desc] = WORDS[i];
      const x = 120, y = 900;
      hudRule(h, x, y - 38, x + 420 * ease.outExpo(clamp((lt - 0.1) / 0.3)), y - 38, { color: col, alpha: a, w: 2 });
      hudText(h, i < 7 ? `CAPABILITY ${String(i + 1).padStart(2, '0')}` : 'THE KERNEL', x, y - 52, { px: 16, color: col, alpha: a, tracking: 0.14 });
      hudText(h, crate, x, y, { font: 'PM', px: 30, color: col, alpha: a, tracking: 0.01 });
      hudText(h, desc, x, y + 36, { font: 'PR', px: 22, color: col, alpha: a * 0.85, tracking: 0.02 });
    },
  };
}
