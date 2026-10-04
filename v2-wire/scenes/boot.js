// 01 BOOT (bars 0-4): darkness, one wire. The first OUP message — client_hello — rides the wire
// into a dormant kernel; on bar 3 the kernel boots and the floor grid ignites in a ring wave.
import * as THREE from 'three';
import { clamp, lerp, keys, prog, ease, hash } from '../../engine/util.js';
import { Lines, C, mul, mix3, bt, BEAT, drawCore, heart, label, setColor, floorGrid, dust, makeCam, baseScene, packetMesh, ARM_DIRS, hit } from '../lib.js';

export default function make(ctx) {
  const scene = baseScene();
  const cam = makeCam(52);
  const S = new Lines(20000, { fog: [20, 110] });
  const D = new Lines(30000, { fog: [20, 110] });
  const K = new Lines(4000, { fog: [40, 160] }); // core, rotated so arm 7 points at +z
  K.mesh.quaternion.setFromUnitVectors(ARM_DIRS[7], new THREE.Vector3(0, 0, 1));
  scene.add(S.mesh, D.mesh, K.mesh);
  const TIP = 2 * (1.1 + 3.2); // arm tip distance
  const T_BOOT = bt(3);

  // static: dust + the 7 other arm wires heading off into space
  dust(S, 700, [-40, -12, -40], [40, 20, 90], 3, [0.25, 0.55, 0.75], 1.8);
  const qK = K.mesh.quaternion;
  const others = [];
  for (let i = 0; i < 7; i++) {
    const d = ARM_DIRS[i].clone().applyQuaternion(qK);
    others.push(d);
  }
  S.flush();

  const hrt = heart(0.45); scene.add(hrt);
  const pk = packetMesh(1, 0.09, 0.55); scene.add(pk);
  const lab = label('client_hello', 0.26, [1.4, 0.5, 0.15], { font: '600 64px Mono' }); scene.add(lab);
  const m4 = new THREE.Matrix4();

  const zc = (t) => keys(t, [[0, 78], [3.0, 62, ease.inOutCubic], [5.625, 40], [6.9, 24], [7.5, 11.5, ease.inCubic]]);
  const pkZ = (t) => keys(t, [[0.9, zc(0.9) - 9], [2.6, zc(2.6) - 5, ease.outCubic], [4.4, zc(4.4) - 5.5], [T_BOOT, TIP + 0.6, ease.inCubic]]);

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      const boot = prog(t, T_BOOT, T_BOOT + 1.4, ease.outCubic);
      const bh = hit(t, T_BOOT, 4.5);
      const z = zc(t);
      const sway = Math.sin(t * 0.7) * 0.25;
      cam.position.set(0.55 + sway, 0.42 + boot * 1.2, z);
      cam.up.set(Math.sin(t * 0.3) * 0.08, 1, 0);
      cam.lookAt(0.2 * (1 - boot), 0.1, z - 12);
      if (t > 5.8) { const k = prog(t, 5.8, 7.5, ease.inOutCubic); cam.lookAt(lerp(0.2, 0, k), lerp(0.1, 0, k), lerp(z - 12, 0, k)); }

      D.clear();
      // main wire (+z axis) with 3 rails, pulses every beat
      const ignite = prog(t, 0.2, 1.6);
      const wc = mul(C.cyan, 0.35 + 0.4 * ignite);
      const segs = 90;
      for (let i = 0; i < segs; i++) {
        const za = TIP + i * 1.4, zb = za + 1.4;
        if (t < 0.2 || za > z + 2 + (t - 0.2) * 0) continue;
        D.seg(0, 0, za, 0, 0, zb, 1.6, wc[0], wc[1], wc[2], 1);
        for (let r = 0; r < 3; r++) {
          const a = r * 2.094;
          const x = Math.cos(a) * 0.14, y = Math.sin(a) * 0.14;
          D.seg(x, y, za, x, y, zb, 0.8, wc[0] * 0.5, wc[1] * 0.5, wc[2] * 0.5, 1);
        }
        if (i % 2 === 0) D.ring(new THREE.Vector3(0, 0, za), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 0.22, 8, 0.9, mul(wc, 0.45), 1);
      }
      // beat pulses running ahead toward the core
      for (let b = 0; b < 16; b++) {
        const tb = BEAT * b + 0.02;
        if (t < tb) continue;
        const pz = zc(tb) - 1 - (t - tb) * 38;
        if (pz < TIP) continue;
        const k = b % 4 === 0 ? 1.4 : 0.8;
        for (let j = 0; j < 8; j++) {
          const a = pz + j * 0.5, fall = Math.exp(-j * 0.45);
          D.seg(0, 0, a, 0, 0, a + 0.5, 3.2 * fall + 1, 1.8 * k * fall, 2.2 * k * fall, 2.6 * k * fall, 1);
        }
      }
      // other arms' wires (appear on boot)
      for (let i = 0; i < 7; i++) {
        const d = others[i];
        const len = 60 * boot;
        if (len < 0.1) continue;
        const a = d.clone().multiplyScalar(TIP), b = d.clone().multiplyScalar(TIP + len);
        D.line(a, b, 1.4, mul(C.cyan, 0.6), 1);
        // packet lights racing out on each beat after boot
        for (let bb = 0; bb < 6; bb++) {
          const tb = T_BOOT + bb * BEAT * 0.5 + i * 0.03;
          if (t < tb) continue;
          const s = TIP + (t - tb) * 30;
          if (s > TIP + len) continue;
          const p = d.clone().multiplyScalar(s), q = d.clone().multiplyScalar(s + 1.4);
          D.line(p, q, 3, i % 2 ? C.orangeHot : C.cyanHot, 1);
        }
      }
      // distant parallel wires (parallax + depth), each with its own pulse train
      for (let w = 0; w < 8; w++) {
        const wx = [-9, 9, -17, 15, -26, 24, -5, 6][w], wy = [-2.5, -3.2, 1.5, 3, -4.5, 0.5, 5, -5.5][w];
        const a = ignite * (0.25 + 0.15 * (w % 3));
        D.seg(wx, wy, TIP + 10, wx, wy, 140, 1.2, ...mul(C.cyan, a), 1);
        for (let b = 0; b < 4; b++) {
          const ph = ((t * (0.35 + 0.1 * (w % 4)) + b / 4 + w * 0.13) % 1);
          const pz = 140 - ph * 130;
          D.seg(wx, wy, pz, wx, wy, pz + 3, 2.5, ...mul(w % 3 === 0 ? C.orangeHot : C.cyanHot, 0.6 * ignite), 1);
        }
      }
      // floor grid ignition ring
      const R = (t - T_BOOT) * 55;
      floorGrid(D, -7, 0, z - 30, 90, 4, (x, zz) => {
        const r = Math.hypot(x, zz);
        let a = (0.05 + 0.1 * clamp(1 - Math.abs(x) / 40)) * ignite;
        if (t > T_BOOT) {
          const wave = Math.exp(-Math.abs(r - R) * 0.35);
          a = Math.max(a, (r < R ? 0.22 : 0) + wave * 0.7);
          const c = mix3(C.cyan, C.white, wave * 0.6);
          return [c[0], c[1], c[2], a];
        }
        return [C.cyan[0], C.cyan[1], C.cyan[2], a];
      }, 4);
      D.flush();

      // core
      K.clear();
      if (t < T_BOOT) {
        // dormant silhouette, slowly breathing
        drawCore(K, new THREE.Vector3(), 2, t, { energy: 0.12 + 0.05 * Math.sin(t * 3), armK: [0, 0, 0, 0, 0, 0, 0, 1], build: 1, spin: 0.08 });
      } else {
        drawCore(K, new THREE.Vector3(), 2, t, { energy: 1 + bh, armK: 1, build: clamp(0.35 + boot), spin: 0.25, pulse: bh * 0.6 });
      }
      K.flush();
      hrt.visible = t > T_BOOT;
      hrt.scale.setScalar(0.25 + boot * 0.45 + bh * 0.6);

      // client_hello packet + its label
      const pz = pkZ(t);
      const on = t > 0.9 && t < T_BOOT;
      pk.visible = lab.visible = on;
      if (on) {
        m4.makeRotationY(Math.PI / 2).setPosition(0, 0, pz);
        pk.setMatrixAt(0, m4); pk.instanceMatrix.needsUpdate = true;
        pk.setColorAt(0, new THREE.Color(2.6, 0.7, 0.15)); pk.instanceColor.needsUpdate = true;
        lab.position.set(0.0, 0.36, pz);
        lab.quaternion.copy(cam.quaternion);
        setColor(lab, [1.0, 0.36, 0.1], prog(t, 0.9, 1.3));
      }

      return {
        bloom: 0.9 + bh * 0.4, bloomRadius: 0.5, ca: 0.002 + bh * 0.006,
        zoomBlur: prog(t, 6.9, 7.5, ease.inCubic) * 0.35, flash: bh * 0.12, flashColor: [0.7, 0.9, 1],
      };
    },
    hud(h, f) {
      h.shadowColor = 'rgba(0,0,0,0.95)'; h.shadowBlur = 14;
      const t = f.t;
      h.font = '500 26px Mono';
      const type = (s, t0, cps) => s.slice(0, Math.max(0, Math.floor((t - t0) * cps)));
      h.fillStyle = 'rgba(120,220,255,0.9)';
      const l1 = type('$ octos serve --stdio', 0.35, 30);
      h.fillText(l1 + (Math.floor(t * 4) % 2 && l1.length < 21 ? '▌' : ''), 96, 940);
      h.fillStyle = 'rgba(255,140,70,0.95)';
      h.fillText(type('→ {"jsonrpc":"2.0","id":1,"method":"client_hello","params":{…}}', 1.1, 45), 96, 980);
      if (t > T_BOOT + 0.2) { h.fillStyle = 'rgba(160,235,255,0.95)'; h.fillText(type('← {"jsonrpc":"2.0","id":1,"result":{…}}', T_BOOT + 0.2, 50), 96, 1020); }
    },
  };
}
