// 06 ANYWHERE (bars 20-24, drop continued): the kernel on a Tron floor, eight targets in a ring —
// four platforms, four bindings — each lit on a beat by a pulse down its trace. Crane up to an
// eight-armed star from above: EMBED ANYWHERE.
import * as THREE from 'three';
import { clamp, lerp, keys, prog, ease, hash } from '../../engine/util.js';
import { Lines, C, mul, mix3, bt, BEAT, BAR, label, setColor, dust, makeCam, baseScene, hit, beatEnv, drawCore, heart, heroText, drawHero, revealGlyphs, floorGrid, ICO_EDGES, plate } from '../lib.js';

const TARGETS = [
  ['Linux', 'x86-64 · ARM64', 0], ['C ABI', 'native binding', 1], ['macOS', 'x86-64 · ARM64', 0], ['Python', 'pyo3', 1],
  ['Windows', 'x86-64 · ARM64', 0], ['Swift / Kotlin', 'uniffi', 1], ['RISC-V', 'unverified', 0], ['WASM', 'browser · talks OUP', 1],
];

export default function make(ctx) {
  const scene = baseScene();
  const cam = makeCam(50);
  scene.add(cam);
  const S = new Lines(20000, { fog: [45, 150] });
  const D = new Lines(40000, { fog: [45, 150] });
  scene.add(S.mesh, D.mesh);
  const T0 = bt(20), T1 = bt(24);
  const RR = 13, CY = 4.5;
  const pos = TARGETS.map((_, i) => { const a = i * Math.PI / 4 + Math.PI / 8; return new THREE.Vector3(Math.cos(a) * RR, 0, Math.sin(a) * RR); });
  const actT = TARGETS.map((_, i) => bt(20, i));
  dust(S, 900, [-90, 1, -90], [90, 40, 90], 41, [0.25, 0.5, 0.7], 1.8);
  // pedestals (static part)
  pos.forEach((p, i) => {
    const col = mul(TARGETS[i][2] ? C.cyan : C.orange, 0.5);
    for (const y of [0.02, 1.0]) {
      const pts = []; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; pts.push(new THREE.Vector3(p.x + Math.cos(a) * 1.9, y, p.z + Math.sin(a) * 1.9)); }
      S.poly(pts, 1.4, col, 1, true);
      if (y > 0.5) for (let k = 0; k < 6; k++) S.line(pts[k], new THREE.Vector3(pts[k].x, 0.02, pts[k].z), 1, mul(col, 0.7));
    }
  });
  // central dais
  for (const [r, y] of [[3.2, 0.02], [2.6, 0.8], [4.2, 0.02]]) S.ring(new THREE.Vector3(0, y, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), r, 48, 1.4, mul(C.cyan, 0.5));
  S.flush();
  const hrt = heart(0.4); hrt.position.set(0, CY, 0); scene.add(hrt);

  const labs = TARGETS.map(([n, sub, b]) => {
    const l = label(n, 0.95, [1, 1, 1], { font: '600 96px Mono', align: 'center' });
    const s = label(sub, 0.45, b ? C.cyan : C.orange, { font: '500 64px Mono', align: 'center' });
    plate(l, { opacity: 0.6 }); plate(s, { opacity: 0.6 });
    scene.add(l, s); return [l, s];
  });
  const hero1 = heroText(ctx, 'ArchX', 'EMBED', { size: 1, depth: 0.35, tracking: 0.06 });
  const hero2 = heroText(ctx, 'ArchX', 'ANYWHERE', { size: 1, depth: 0.35, tracking: 0.06 });
  cam.add(hero1, hero2);

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - T0;
      const kick = beatEnv(t, 10);
      const crane = prog(t, bt(22), bt(22, 3), ease.inOutCubic);
      const whip = prog(t, bt(23, 3), T1, ease.inCubic);
      const th = keys(t, [[T0, -0.35], [bt(22), 0.9, (x) => x], [T1, 1.9, (x) => x]]);
      const R = lerp(keys(t, [[T0, 32], [bt(20, 1.5), 23, ease.outExpo], [bt(22), 21]]), 9, crane);
      const Y = lerp(keys(t, [[T0, 14], [bt(20, 1.5), 9, ease.outExpo], [bt(22), 8.5]]), 40, crane);
      cam.position.set(Math.cos(th) * R, Y, Math.sin(th) * R);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, lerp(3.2, 0, crane), 0);
      cam.rotateZ(Math.sin(lt * 0.8) * 0.04);
      cam.rotateX(whip * 1.3);
      cam.fov = 50 + hit(t, T0, 5) * 25 + whip * 20; cam.updateProjectionMatrix();
      cam.updateMatrixWorld();

      D.clear();
      // floor grid, rings of light expanding on kicks
      const kb = Math.floor((t - T0) / BEAT), tk = T0 + kb * BEAT;
      floorGrid(D, 0, 0, 0, 100, 4, (x, z) => {
        const r = Math.hypot(x, z);
        const w = Math.exp(-Math.abs(r - (t - tk) * 45) * 0.25) * Math.exp(-(t - tk) * 2);
        const a = 0.2 * clamp(1 - r / 100) + 0.55 * w;
        return [C.cyan[0], C.cyan[1], C.cyan[2], a];
      }, 4);
      drawCore(D, new THREE.Vector3(0, CY, 0), 1.4, t * 1.2, { energy: 1 + kick * 0.5, armK: 0.55, spin: 0.35, pulse: kick * 0.4 });
      // traces + pedestals
      pos.forEach((p, i) => {
        const ta = actT[i];
        const plat = !TARGETS[i][2];
        const base = plat ? C.orangeHot : C.cyanHot;
        const a = new THREE.Vector3(p.x * 0.24, 0.05, p.z * 0.24), b = new THREE.Vector3(p.x * 0.86, 0.05, p.z * 0.86);
        const lit = t >= ta;
        D.line(a, b, 2, mul(lit ? base : C.cyan, lit ? 0.45 + hit(t, ta, 4) * 1.5 : 0.25), 1);
        // pulse arriving on the beat
        const k = prog(t, ta - 0.25, ta, ease.inCubic);
        if (k > 0 && k < 1) { const q = a.clone().lerp(b, k), q2 = a.clone().lerp(b, Math.max(0, k - 0.2)); D.line(q2, q, 6, mul(base, 1.6), 1); }
        // continuing data on lit traces
        if (lit) for (let j = 0; j < 3; j++) { const ph = ((t - ta) * 1.6 + j / 3) % 1; const q = a.clone().lerp(b, ph), q2 = a.clone().lerp(b, Math.min(1, ph + 0.06)); D.line(q, q2, 3.5, mul(base, 0.9), 1); }
        // mini kernel on the pedestal
        const bk = prog(t, ta, ta + 0.4, ease.outCubic);
        if (bk > 0) {
          const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, 2.6 + 0.15 * Math.sin(t * 3 + i), p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(t, t * 1.3 + i, 0)), new THREE.Vector3(0.9 * bk, 0.9 * bk, 0.9 * bk));
          D.edges(ICO_EDGES, m, 1.8, mul(base, 0.7 + hit(t, ta, 5) * 1.5), 1);
          D.seg(p.x, 2.6, p.z, p.x, 2.6, p.z, 7, ...mul(base, 1.2), 1);
          // light column
          const hk = hit(t, ta, 3);
          if (hk > 0.02) D.seg(p.x, 0, p.z, p.x, 30 * (1 - hk) + 4, p.z, 4, ...mul(base, hk * 1.2), 1);
          // expanding ring
          const rk = prog(t, ta, ta + 0.6);
          if (rk < 1) D.ring(new THREE.Vector3(p.x, 0.05, p.z), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), 1.9 + rk * 5, 32, 2, mul(base, 1 - rk), 1);
        }
        const [l, s] = labs[i];
        const cd = cam.position.distanceTo(p);
        const on = prog(t, ta, ta + 0.2) * (1 - crane * 0.35) * (0.45 + 0.55 * clamp((34 - cd) / 12));
        l.visible = s.visible = on > 0.01;
        const top = new THREE.Vector3(p.x, 5.2, p.z);
        l.position.copy(top); s.position.copy(top);
        l.quaternion.copy(cam.quaternion); s.quaternion.copy(cam.quaternion);
        s.translateY(-0.95);
        setColor(l, [0.68, 0.72, 0.74], on); setColor(s, plat ? [1.0, 0.33, 0.08] : [0.3, 0.7, 0.9], on);
      });
      // hero
      const h1 = prog(t, bt(22), bt(22, 0.3), ease.outExpo), h2 = prog(t, bt(22, 1), bt(22, 1.3), ease.outExpo);
      const ho = prog(t, bt(23, 3), bt(23, 3.6), ease.inCubic);
      hero1.visible = t >= bt(22); hero2.visible = t >= bt(22, 1);
      hero1.position.set(0, 2.35 + ho * 3, -9); hero2.position.set(0, 1.1 + ho * 3, -9);
      hero1.scale.setScalar(1.1 * (1.3 - 0.3 * h1)); hero2.scale.setScalar(1.1 * (1.3 - 0.3 * h2));
      revealGlyphs(hero1, 1, { out: 0 }); revealGlyphs(hero2, 1, { out: 0 });
      if (hero1.visible) drawHero(D, hero1, { front: mix3(C.cyanHot, [3, 3, 3], hit(t, bt(22), 5)), back: mul(C.orange, 0.7), w: 2.6 });
      if (hero2.visible) drawHero(D, hero2, { front: mix3(C.orangeHot, [3, 3, 3], hit(t, bt(22, 1), 5)), back: mul(C.cyan, 0.6), w: 2.6 });
      D.flush();
      hrt.scale.setScalar(0.7 + kick * 0.4);
      return {
        bloom: 0.85 + kick * 0.3 + hit(t, bt(22), 5) * 0.5, ca: 0.002 + kick * 0.003 + whip * 0.01,
        zoomBlur: Math.max(hit(t, T0, 5) * 0.4, whip * 0.5), flash: hit(t, T0, 9) * 0.35 + hit(t, bt(22), 8) * 0.3, flashColor: [1, 0.6, 0.3],
        exposure: 1 + kick * 0.1,
      };
    },
    hud(h, f) {
      h.shadowColor = 'rgba(0,0,0,0.95)'; h.shadowBlur = 14;
      const t = f.t;
      const a = prog(t, bt(22, 2), bt(22, 2.5)) * (1 - prog(t, bt(23, 3), bt(23, 3.5)));
      h.textAlign = 'center'; h.font = '500 28px Mono';
      h.fillStyle = `rgba(190,230,245,${0.85 * a})`;
      h.fillText('Linux · macOS · Windows  —  C ABI · Python · Swift / Kotlin · WASM', 960, 960);
      h.textAlign = 'left';
    },
  };
}
