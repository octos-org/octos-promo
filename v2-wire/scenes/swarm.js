// 05 SWARM (bars 16-20, the drop): the camera is blasted out of the core; peer agents spawn on every
// kick (peer/prepare), work, and report back (peer/gather). One verb per bar: another agent drives
// Octos over OUP — assign, observe, intervene, collect.
import * as THREE from 'three';
import { clamp, lerp, keys, prog, ease, hash } from '../../engine/util.js';
import { Lines, C, mul, mix3, bt, BEAT, BAR, label, setColor, dust, makeCam, baseScene, hit, beatEnv, drawCore, heart, heroText, drawHero, revealGlyphs, OCT_EDGES, plate } from '../lib.js';

const WORDS = [
  ['ASSIGN', 'turn/start', 'another agent hands Octos the work'],
  ['OBSERVE', 'message/delta', 'every turn streams back as it runs'],
  ['INTERVENE', 'turn/steer · turn/interrupt', 'steer or stop it mid-turn'],
  ['COLLECT', 'peer/gather', 'results come home from parallel peers'],
];

export default function make(ctx) {
  const scene = baseScene();
  const cam = makeCam(55);
  scene.add(cam);
  const S = new Lines(8000, { fog: [40, 160] });
  const D = new Lines(40000, { fog: [40, 160] });
  scene.add(S.mesh, D.mesh);
  const T0 = bt(16), T1 = bt(20);
  dust(S, 1400, [-80, -50, -80], [80, 50, 80], 31, [0.25, 0.5, 0.7], 1.8);
  const O = new THREE.Vector3();
  S.ring(O, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), 24, 160, 1, mul(C.cyan, 0.2));
  S.ring(O, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.5, 0.866), 30, 160, 1, mul(C.cyan, 0.12));
  S.flush();

  // peers
  const N = 64, peers = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    const R = 7 + 13 * hash(i * 4.1);
    const p = new THREE.Vector3(Math.cos(a) * r, y * 0.75, Math.sin(a) * r).multiplyScalar(R);
    const wave = i % 8; // spawns on beats 0..7 of bars 16-17
    peers.push({ p, ts: T0 + wave * BEAT + (hash(i) * 0.08), tg: bt(18) + (hash(i * 9.1) * 7.5) * BEAT, orange: hash(i * 2.2) < 0.25 });
  }
  // neighbour graph
  const nb = [];
  for (let i = 0; i < N; i++) {
    const ds = peers.map((q, j) => [q.p.distanceTo(peers[i].p), j]).filter(([, j]) => j !== i).sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 2; k++) if (ds[k][1] > i) nb.push([i, ds[k][1]]);
  }
  const hrt = heart(0.5); scene.add(hrt);

  const heroes = WORDS.map(([w]) => {
    const h = heroText(ctx, 'ArchX', w, { size: 1, depth: 0.4, tracking: 0.05 });
    const sc = Math.min(1.25, 8.2 / h.userData.width); h.scale.setScalar(sc); h.userData.sc = sc;
    cam.add(h); return h;
  });
  const tags = WORDS.map(([, m]) => { const l = label(m, 0.3, C.orange, { font: '600 64px Mono', align: 'center' }); plate(l); cam.add(l); return l; });
  const peerLabs = [0, 5, 11, 19, 26, 40].map((i) => { const l = label('peer/prepare', 0.35, C.orange, { font: '600 64px Mono' }); scene.add(l); return [i, l]; });
  const gatherLabs = [3, 14, 29, 47].map((i) => { const l = label('peer/gather', 0.35, C.cyan, { font: '600 64px Mono' }); scene.add(l); return [i, l]; });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler();
  const peerPos = (P, t) => {
    const k = prog(t, P.ts, P.ts + 0.55, ease.outExpo);
    return P.p.clone().multiplyScalar(k);
  };

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - T0;
      const kick = beatEnv(t, 10);
      const bar = Math.floor(lt / BAR);
      // camera: blasted out of the core, then orbit; bar 18 dives into the swarm, bar 19 pulls out
      const R = keys(t, [[T0, 0.8], [T0 + 0.7, 24, ease.outExpo], [bt(18), 21], [bt(18, 2), 12, ease.inOutCubic], [bt(19), 15], [bt(19, 3), 34, ease.inOutCubic], [T1, 36]]);
      const th = keys(t, [[T0, 0.3], [bt(18), 1.3, (x) => x], [bt(19), 2.3, ease.inOutCubic], [T1, 2.8]]);
      const el = keys(t, [[T0, 0.1], [bt(17), 0.35], [bt(18, 2), -0.15], [bt(19, 3), 0.45], [T1, 0.5]]);
      cam.position.set(Math.cos(th) * Math.cos(el) * R, Math.sin(el) * R, Math.sin(th) * Math.cos(el) * R);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, 0, 0);
      cam.rotateZ(Math.sin(lt * 0.7) * 0.06 + hit(t, T0, 3) * 0.6 * Math.sin(lt * 9));
      cam.fov = 55 + hit(t, T0, 3) * 35 + kick * 1.5; cam.updateProjectionMatrix();
      cam.updateMatrixWorld();

      D.clear();
      const gatherPulse = peers.reduce((a, P) => a + hit(t, P.tg + 0.35, 10), 0);
      drawCore(D, O, 1.8, t * 1.4, { energy: 1 + kick * 0.6 + gatherPulse * 0.3, armK: 1, armLen: 1.6, spin: 0.35, pulse: kick * 0.5 });
      // peers
      const pos = peers.map((P) => peerPos(P, t));
      peers.forEach((P, i) => {
        if (t < P.ts) return;
        const p = pos[i];
        const sp = prog(t, P.ts, P.ts + 0.55);
        const born = hit(t, P.ts + 0.5, 6);
        const work = 0.5 + 0.5 * Math.sin(t * 6 + i);
        const base = P.orange ? C.orangeHot : C.cyanHot;
        const col = mul(base, 0.45 + 0.25 * work + born * 1.5);
        e3.set(t * (0.7 + hash(i)), t * (1.1 + hash(i * 3)), 0); q.setFromEuler(e3);
        const sc = 0.45 * (0.3 + 0.7 * sp);
        m4.compose(p, q, new THREE.Vector3(sc, sc, sc));
        D.edges(OCT_EDGES, m4, 1.6, col, 1);
        D.seg(p.x, p.y, p.z, p.x, p.y, p.z, 5, ...mul(base, 0.8 + born * 2), 1);
        // tether to core
        D.line(O, p, 0.9, mul(C.cyan, 0.18 + 0.4 * born), 1);
        // peer/prepare packet riding out on spawn
        if (sp < 1) { const a = p.clone().multiplyScalar(0.92), b = p.clone().multiplyScalar(Math.max(0, 0.92 - 0.25)); D.line(b, a, 4, C.orangeHot, 1); }
        // peer/gather: packet returns to core
        const g = prog(t, P.tg, P.tg + 0.35, ease.inCubic);
        if (g > 0 && g < 1) { const a = p.clone().multiplyScalar(1 - g), b = p.clone().multiplyScalar(Math.min(1, 1 - g + 0.18)); D.line(a, b, 4, mul(C.cyanHot, 1.5), 1); }
        if (t > P.tg + 0.35) D.line(O, p, 1.4, mul(C.cyanHot, 0.25 + hit(t, P.tg + 0.35, 5)), 1);
      });
      // mesh between neighbouring peers
      for (const [i, j] of nb) {
        if (t < peers[i].ts + 0.4 || t < peers[j].ts + 0.4) continue;
        const k = prog(t, Math.max(peers[i].ts, peers[j].ts) + 0.4, Math.max(peers[i].ts, peers[j].ts) + 0.9);
        D.lineK(pos[i], pos[j], k, 1, mul(C.cyan, 0.35), 1);
      }
      // shock rings on each kick of the first bar
      for (let b = 0; b < 8; b++) {
        const tb = T0 + b * BEAT; if (t < tb || t > tb + 1) continue;
        const r = 2 + (t - tb) * 30, k = 1 - (t - tb);
        D.ring(O, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), r, 64, 2, mul(b % 4 === 0 ? C.white : C.orangeHot, k * (b === 0 ? 2 : 0.8)), 1);
      }
      // hero verbs (camera space)
      heroes.forEach((h, i) => {
        const tb = bt(16 + i);
        const on = t >= tb && t < tb + BAR;
        h.visible = on;
        if (!on) return;
        const k = prog(t, tb, tb + 0.28, ease.outExpo);
        const out = prog(t, tb + BAR - 0.22, tb + BAR, ease.inCubic);
        revealGlyphs(h, 1, { out });
        h.scale.setScalar(h.userData.sc * (1.35 - 0.35 * k));
        h.position.set(0, -1.05, -7);
        h.rotation.set(0, Math.sin(lt * 0.9) * 0.08, 0);
        drawHero(D, h, { front: mix3(C.cyanHot, [3, 3, 3], hit(t, tb, 5)), back: mul(C.orange, 0.7), conn: mul(C.orange, 0.5), w: 2.6 });
      });
      tags.forEach((l, i) => {
        const tb = bt(16 + i);
        const on = t >= tb + 0.1 && t < tb + BAR - 0.1;
        l.visible = on; l.position.set(0, -2.0, -7);
        setColor(l, [1.0, 0.36, 0.1], prog(t, tb + 0.1, tb + 0.3));
      });
      // floating packet labels near peers
      for (const [i, l] of peerLabs) {
        const P = peers[i]; const on = t > P.ts && t < P.ts + 1.2;
        l.visible = on; if (!on) continue;
        l.position.copy(pos[i]).multiplyScalar(0.8).add(new THREE.Vector3(0, 0.5, 0)); l.quaternion.copy(cam.quaternion);
        setColor(l, [1.0, 0.36, 0.1], clamp(1.2 - (t - P.ts)));
      }
      for (const [i, l] of gatherLabs) {
        const P = peers[i]; const on = t > P.tg - 0.2 && t < P.tg + 0.9;
        l.visible = on; if (!on) continue;
        l.position.copy(pos[i]).add(new THREE.Vector3(0, 0.6, 0)); l.quaternion.copy(cam.quaternion);
        setColor(l, [0.4, 0.8, 0.95], clamp(1 - (t - P.tg - 0.2) / 0.9));
      }
      D.flush();
      hrt.scale.setScalar(0.6 + kick * 0.35 + gatherPulse * 0.15);

      const drop = hit(t, T0, 2.2), dropF = hit(t, T0, 7);
      const strobe = t < bt(17) && t > T0 + 0.2 ? beatEnv(t, 28, 1, T0) * 0.3 : 0;
      const barHit = t > bt(17) ? hit(t, bt(16 + bar), 7) * 0.2 : 0;
      return {
        bloom: 0.85 + kick * 0.3 + dropF * 1.2, ca: 0.002 + kick * 0.004 + drop * 0.012,
        zoomBlur: Math.max(hit(t, T0, 4) * 0.7, prog(t, T1 - 0.3, T1, ease.inCubic) * 0.45), flash: Math.min(1, dropF * 1.1 + strobe + barHit), flashColor: [1, 0.95, 0.9],
        shake: [Math.sin(t * 83) * 0.008 * drop, Math.cos(t * 71) * 0.008 * drop], exposure: 1 + kick * 0.12,
      };
    },
    hud(h, f) {
      h.shadowColor = 'rgba(0,0,0,0.95)'; h.shadowBlur = 14;
      const t = f.t, lt = t - T0;
      const i = clamp(Math.floor(lt / BAR), 0, 3);
      const tb = bt(16 + i);
      const a = prog(t, tb + 0.15, tb + 0.4) * (1 - prog(t, tb + BAR - 0.25, tb + BAR));
      h.textAlign = 'center';
      h.font = '500 30px Mono';
      h.fillStyle = `rgba(190,230,245,${0.85 * a})`;
      h.fillText(WORDS[i][2], 960, 945);
      h.textAlign = 'left';
      // corner log
      h.font = '500 20px Mono';
      const spawned = Math.min(64, Math.max(0, Math.floor((t - T0) / BEAT + 1) * 8));
      h.fillStyle = 'rgba(255,140,70,0.8)';
      h.fillText(`peers  ${String(Math.min(64, spawned)).padStart(2, '0')}/64`, 96, 1000);
      const gathered = t < bt(18) ? 0 : Math.min(64, Math.floor(((t - bt(18)) / (7.5 * BEAT)) * 64));
      h.fillStyle = 'rgba(120,220,255,0.8)';
      h.fillText(`gather ${String(gathered).padStart(2, '0')}/64`, 96, 1028);
    },
  };
}
