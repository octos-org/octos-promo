// 02 KERNEL (bars 4-8): orbit the booted core. One arm lights per beat with what the kernel owns;
// bar 6 the name lands (3D), bar 7.5 the camera whips down an arm into the protocol.
import * as THREE from 'three';
import { clamp, lerp, keys, prog, ease, hash } from '../../engine/util.js';
import { Lines, C, mul, mix3, bt, BEAT, BAR, drawCore, heart, label, setColor, floorGrid, dust, makeCam, baseScene, ARM_DIRS, hit, beatEnv, heroText, revealGlyphs, drawHero, plate } from '../lib.js';

const ARMS = ['execution loop', 'context', 'memory', 'tools', 'skills', 'workflows', 'agent coordination', 'runtime state'];

export default function make(ctx) {
  const scene = baseScene();
  const cam = makeCam(45);
  scene.add(cam);
  const S = new Lines(20000, { fog: [30, 140] });
  const D = new Lines(30000, { fog: [30, 140] });
  scene.add(S.mesh, D.mesh);
  const T0 = bt(4);
  const s = 2, TIP = s * (1.1 + 3.2);
  dust(S, 900, [-60, -20, -60], [60, 30, 60], 7, [0.25, 0.55, 0.75], 1.8);
  // static outer frame: two big faint orbit rings
  const O = new THREE.Vector3();
  S.ring(O, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), 13, 128, 1, mul(C.cyan, 0.25));
  S.ring(O, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.34, 0.94), 15.5, 128, 1, mul(C.cyan, 0.14));
  for (let i = 0; i < 64; i++) { // tick marks on ring
    const a = i / 64 * Math.PI * 2, r0 = 13, r1 = i % 8 === 0 ? 14 : 13.4;
    S.seg(Math.cos(a) * r0, 0, Math.sin(a) * r0, Math.cos(a) * r1, 0, Math.sin(a) * r1, 1, ...mul(C.cyan, 0.4), 1);
  }
  S.flush();
  const hrt = heart(0.45); scene.add(hrt);

  const labels = ARMS.map((n, i) => {
    const l = label(n, 0.72, [0.9, 0.95, 1], { font: '600 72px Mono', anchor: 'left' });
    plate(l, { opacity: 1 }); scene.add(l); return l;
  });
  const idx = labels.map((_, i) => {
    const l = label(String(i + 1).padStart(2, '0'), 0.4, C.orange, { font: '600 64px Mono', anchor: 'left' });
    scene.add(l); return l;
  });

  const hero = heroText(ctx, 'ArchX', 'OCTOS', { size: 1.05, depth: 0.5, tracking: 0.05 });
  cam.add(hero);
  const sub1 = label('embeddable AI agent harness kernel', 0.26, [0.45, 0.78, 0.9], { font: '600 64px Mono', anchor: 'left' });
  const sub2 = label('written in Rust', 0.26, [1.0, 0.33, 0.08], { font: '600 64px Mono', anchor: 'left' });
  cam.add(sub1, sub2);

  const armT = (i) => T0 + i * BEAT;
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - T0;
      const kick = beatEnv(t, 9);
      // camera: orbit, then frame for the name, then whip down arm 1
      const th = keys(t, [[T0, 0.9], [bt(6), 2.2, (x) => x], [bt(7.5), 2.75, ease.outCubic], [bt(8), 2.95, ease.inCubic]]);
      const R = keys(t, [[T0, 17], [bt(6), 18], [bt(6.5), 14, ease.outCubic], [bt(7.5), 12.5], [bt(8), 3, ease.inCubic]]);
      const y = keys(t, [[T0, 3], [bt(6), 5.5], [bt(6.5), 2.5, ease.outCubic], [bt(8), 1.5]]);
      const p = new THREE.Vector3(Math.cos(th) * R, y, Math.sin(th) * R);
      // whip target: tip of arm 1
      const tip = ARM_DIRS[1].clone().multiplyScalar(TIP);
      const wk = prog(t, bt(7.5), bt(8), ease.inCubic);
      p.lerp(tip.clone().multiplyScalar(1.6), wk);
      cam.position.copy(p);
      cam.up.set(0, 1, 0);
      const look = new THREE.Vector3(0, 0, 0);
      // during the name, push the core to the right third
      const side = prog(t, bt(6), bt(6.5), ease.outCubic) * (1 - wk);
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(O, p).normalize(), new THREE.Vector3(0, 1, 0)).normalize();
      look.addScaledVector(right, -6.8 * side);
      look.lerp(tip, wk);
      cam.lookAt(look);
      cam.rotateZ(Math.sin(lt * 0.8) * 0.04 + wk * 0.5);

      D.clear();
      const armK = [], armHot = [];
      for (let i = 0; i < 8; i++) {
        armK.push(1);
        armHot.push(t >= armT(i) ? Math.max(0.0, hit(t, armT(i), 3.5)) : 0);
      }
      const e = 0.7 + 0.3 * kick;
      drawCore(D, O, s, t, { energy: e, armK, armHot, spin: 0.3, pulse: kick * 0.35 });
      // arm power-up: packet racing to tip, then lit arm core-line
      for (let i = 0; i < 8; i++) {
        const d = ARM_DIRS[i];
        const k = prog(t, armT(i) - 0.12, armT(i), ease.inCubic);
        if (t < armT(i) - 0.12) continue;
        const a = d.clone().multiplyScalar(s * 1.1);
        if (k < 1) { const q = d.clone().multiplyScalar(s * 1.1 + (TIP - s * 1.1) * k); D.line(a, q, 5, C.orangeHot, 1); }
        else {
          const lit = 0.5 + 1.5 * hit(t, armT(i), 4);
          D.line(a, d.clone().multiplyScalar(TIP), 2.5, mul(C.cyanHot, lit), 1);
          // ring burst at tip
          const bk = prog(t, armT(i), armT(i) + 0.5);
          if (bk < 1) {
            const u = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize(), v = new THREE.Vector3().crossVectors(d, u);
            D.ring(d.clone().multiplyScalar(TIP), u, v, 0.4 + bk * 2.5, 24, 2, mul(C.orangeHot, 1 - bk), 1);
          }
        }
        // data ticks travelling out along lit arms on every 8th
        if (t > armT(i)) {
          for (let j = 0; j < 4; j++) {
            const ph = ((t - armT(i)) * 2.2 + j / 4) % 1;
            const q0 = d.clone().multiplyScalar(s * 1.1 + ph * (TIP - s * 1.1));
            const q1 = d.clone().multiplyScalar(s * 1.1 + Math.min(1, ph + 0.05) * (TIP - s * 1.1));
            D.line(q0, q1, 3, mul(C.cyanHot, 0.8), 1);
          }
        }
      }
      // floor grid below
      floorGrid(D, -9, 0, 0, 80, 4, (x, z) => {
        const r = Math.hypot(x, z);
        const a = 0.22 * clamp(1 - r / 80) + 0.5 * Math.exp(-Math.abs(r - ((lt * 30) % 90)) * 0.3) * 0.4;
        return [C.cyan[0], C.cyan[1], C.cyan[2], a * (0.8 + 0.4 * kick)];
      }, 4);
      hrt.scale.setScalar((0.7 + kick * 0.25) * (1 - 0.35 * prog(t, bt(6), bt(6.25))));

      // labels
      for (let i = 0; i < 8; i++) {
        const l = labels[i], n = idx[i];
        const on = prog(t, armT(i), armT(i) + 0.18, ease.outCubic) * (1 - prog(t, bt(6) - 0.1, bt(6) + 0.15));
        l.visible = n.visible = on > 0.001;
        const pos = ARM_DIRS[i].clone().multiplyScalar(TIP + 0.9);
        l.position.copy(pos); n.position.copy(pos);
        l.quaternion.copy(cam.quaternion); n.quaternion.copy(cam.quaternion);
        l.translateY(-0.02); n.translateY(0.6);
        l.translateX(0.02); n.translateX(0.04);
        const flash = hit(t, armT(i), 5);
        setColor(l, mix3([0.6, 0.72, 0.78], [1.0, 1.0, 1.0], flash), on);
        setColor(n, C.orange, on);
        l.scale.set(0.7 + 0.3 * on, 1, 1);
      }

      // hero name (camera space)
      const hk = prog(t, bt(6), bt(6, 1.5));
      const ho = prog(t, bt(7.5), bt(7.75), ease.inCubic);
      hero.visible = t >= bt(6) - 0.01;
      hero.position.set(-4.3 + hero.userData.width / 2, 0.6, -7);
      revealGlyphs(hero, hk, { spread: 0.8, dy: 0, dz: 3, out: ho });
      hero.rotation.set(0, 0.12 - 0.05 * prog(t, bt(6), bt(8)), 0);
      cam.updateMatrixWorld();
      if (hero.visible) {
        const gk = hero.userData.glyphs.map((_, i) => prog(t, bt(6) + i * BEAT / 4, bt(6) + i * BEAT / 4 + 0.35));
        const hot = hit(t, bt(6), 3) + 0.3 * kick;
        drawHero(D, hero, { front: mix3([0.35, 1.3, 1.9], [2.5, 2.5, 2.5], hot * 0.5), w: 2.6, glyphK: gk });
      }
      D.flush();
      const sk1 = prog(t, bt(6, 2), bt(6, 2.5)), sk2 = prog(t, bt(7), bt(7, 0.5));
      sub1.visible = sk1 > 0 && ho < 1; sub2.visible = sk2 > 0 && ho < 1;
      sub1.position.set(-4.42 - ho * 3, -0.4, -7); sub2.position.set(-4.42 - ho * 3, -0.8, -7);
      setColor(sub1, [0.45, 0.78, 0.9], sk1 * (1 - ho)); setColor(sub2, [1.0, 0.33, 0.08], sk2 * (1 - ho));
      sub1.scale.x = sk1; sub2.scale.x = sk2;

      const nameHit = hit(t, bt(6), 9);
      return {
        bloom: 1.0 + kick * 0.25 + nameHit * 0.5, ca: 0.0018 + kick * 0.002 + wk * 0.01,
        zoomBlur: Math.max(hit(t, T0, 6) * 0.25, wk * 0.5), flash: nameHit * 0.15 + hit(t, T0, 8) * 0.2,
        flashColor: [0.8, 0.95, 1],
      };
    },
  };
}
