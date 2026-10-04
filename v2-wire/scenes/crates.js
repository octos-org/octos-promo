// 04 CRATES (bars 12-16, the build): the lanes run through the kernel's crates — wire portals the
// camera threads one per two beats, accelerating with the snare roll, then dives into the core (drop).
import * as THREE from 'three';
import { clamp, lerp, keys, prog, ease, hash } from '../../engine/util.js';
import { Lines, C, mul, mix3, bt, BEAT, BAR, label, setColor, dust, makeCam, baseScene, hit, beatEnv, drawCore, heart, packetMesh } from '../lib.js';

const CRATES = [
  ['octos-core', 'types · OUP commands · codecs'],
  ['octos-agent', 'execution · context · tools · hooks · sandboxing'],
  ['octos-memory', 'memory · episodes · retrieval'],
  ['octos-llm', 'providers · model routing · retries · failover'],
  ['octos-plugin', 'skills & plugins'],
  ['octos-pipeline / octos-swarm', 'workflow graphs · parallel workers · aggregation'],
  ['octos-bus / octos-cli', 'sessions · runtime · OUP hosting'],
];

export default function make(ctx) {
  const scene = baseScene();
  const cam = makeCam(60);
  const S = new Lines(40000, { fog: [30, 100] });
  const D = new Lines(20000, { fog: [30, 120] });
  scene.add(S.mesh, D.mesh);
  const T0 = bt(12), T1 = bt(16);
  const sCam = (t) => { const u = clamp(t - T0 + 0.35, 0, 99); return 8 * u + 0.9 * u * u; };
  const passT = CRATES.map((_, k) => bt(12, 1 + 2 * k));
  const passS = passT.map(sCam);
  const sCore = sCam(T1) + 1.2;
  const W = 4.6, Hh = 2.9, Dp = 1.2;
  const LANES = [[-2.6, -1.7], [2.6, -1.7], [-2.6, 1.7], [2.6, 1.7], [0, -2.2]];

  // static: lanes straight down -z, gates of the crates
  for (let z = 5; z > -sCore; z -= 1.2) {
    for (const [x, y] of LANES) {
      S.ring(new THREE.Vector3(x, y, z), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 0.3, 8, 1, mul(C.orange, 0.4), 1);
      for (let k = 0; k < 3; k++) { const a = k * 2.09; S.seg(x + Math.cos(a) * 0.3, y + Math.sin(a) * 0.3, z, x + Math.cos(a) * 0.3, y + Math.sin(a) * 0.3, z - 1.2, 0.8, ...mul(C.orange, 0.25), 1); }
    }
  }
  const crates = CRATES.map(([name, desc], k) => {
    const z = -passS[k];
    const roll = (k % 2 ? 1 : -1) * 0.12;
    const m = new THREE.Matrix4().makeRotationZ(roll);
    const P = (x, y, dz = 0) => new THREE.Vector3(x, y, 0).applyMatrix4(m).add(new THREE.Vector3(0, 0, z + dz));
    const c = mul(C.cyan, 0.8);
    // outer & inner frame, front and back
    for (const dz of [Dp, -Dp]) {
      S.poly([P(-W, -Hh, dz), P(W, -Hh, dz), P(W, Hh, dz), P(-W, Hh, dz)], 2, c, 1, true);
      S.poly([P(-W + 0.7, -Hh + 0.6, dz), P(W - 0.7, -Hh + 0.6, dz), P(W - 0.7, Hh - 1.1, dz), P(-W + 0.7, Hh - 1.1, dz)], 1.2, mul(c, 0.6), 1, true);
    }
    for (const [x, y] of [[-W, -Hh], [W, -Hh], [W, Hh], [-W, Hh], [-W + 0.7, -Hh + 0.6], [W - 0.7, -Hh + 0.6], [W - 0.7, Hh - 1.1], [-W + 0.7, Hh - 1.1]]) S.line(P(x, y, Dp), P(x, y, -Dp), 1.2, mul(c, 0.6));
    // chip pins top & bottom, fins on the sides
    for (let x = -W + 0.3; x <= W - 0.3; x += 0.42) {
      S.line(P(x, Hh, 0.5), P(x, Hh + 0.45, 0.5), 1.4, mul(C.orange, 0.8));
      S.line(P(x, -Hh, 0.5), P(x, -Hh - 0.45, 0.5), 1.4, mul(C.orange, 0.8));
    }
    for (let y = -Hh + 0.8; y < Hh - 1.2; y += 0.28) {
      S.line(P(-W, y, Dp), P(-W + 0.7, y, Dp), 0.8, mul(c, 0.4)); S.line(P(W, y, Dp), P(W - 0.7, y, Dp), 0.8, mul(c, 0.4));
    }
    // name plate band
    S.line(P(-W, Hh - 1.1, Dp), P(W, Hh - 1.1, Dp), 1.2, mul(c, 0.8));
    const nm = label(name, 0.8, [1, 1, 1], { font: '600 96px Mono', align: 'center' });
    const ds = label(desc, 0.3, C.orange, { font: '500 64px Mono', align: 'center' });
    nm.position.copy(P(0, 0.75, Dp + 0.6)); ds.position.copy(P(0, 0.05, Dp + 0.6));
    nm.rotation.z = roll; ds.rotation.z = roll;
    const ix = label(String(k + 1).padStart(2, '0') + '/07', 0.26, C.orange, { font: '600 64px Mono', anchor: 'left' });
    ix.position.copy(P(-W + 0.15, -Hh + 0.3, Dp + 0.02)); ix.rotation.z = roll;
    // fit name into the plate
    const maxW = 2 * W - 2.2; if (nm.userData.width > maxW) nm.scale.setScalar(maxW / nm.userData.width);
    scene.add(nm, ds, ix);
    return { nm, ds, ix, z, roll, m, P };
  });
  dust(S, 1600, [-35, -25, -sCore - 20], [35, 25, 10], 21, [0.25, 0.5, 0.7], 1.6);
  S.flush();

  const hrt = heart(0.5); hrt.position.set(0, 0, -sCore); scene.add(hrt);
  const NP = 40, pm = packetMesh(NP, 0.09, 0.45); scene.add(pm);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - T0;
      const s = sCam(t);
      const build = prog(t, bt(14), T1);
      const kick = beatEnv(t, 9, 1, T0, bt(15, 2));
      const roll16 = beatEnv(t, 18, t > bt(15) ? 4 : 2, bt(14), T1 - 0.2);
      const outK = prog(t, passT[6], T1);
      cam.position.set(0.35 * Math.sin(lt * 1.1), 0.15 + 0.25 * Math.sin(lt * 0.7) + 0.3 * (1 - outK), -s);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, 0.1 * (1 - outK), -s - 10);
      cam.rotateZ(Math.sin(lt * 0.9) * 0.08 + build * build * 1.2 * Math.sin(lt * 2.2));
      cam.fov = 60 + build * 18 + hit(t, T0, 5) * 20; cam.updateProjectionMatrix();

      D.clear();
      // crate highlight on pass + ring shock
      crates.forEach((c, k) => {
        const d = passT[k] - t; // time to pass
        const near = clamp(1 - Math.abs(d) / 1.3);
        const h = hit(t, passT[k], 4);
        const dist = -c.z - s; // distance ahead
        const vis = clamp((dist - 2.5) / 3) * clamp((34 - dist) / 10);
        setColor(c.nm, [0.66, 0.7, 0.72], vis);
        setColor(c.ds, [1.0, 0.33, 0.08], vis);
        c.nm.visible = c.ds.visible = vis > 0.01;
        setColor(c.ix, C.orange, 0.3 + 0.7 * near);
        const glow = 0.25 * near + 1.5 * h;
        if (glow > 0.02) {
          const P = c.P;
          D.poly([P(-W, -Hh, Dp), P(W, -Hh, Dp), P(W, Hh, Dp), P(-W, Hh, Dp)], 3, mul(C.cyanHot, glow), 1, true);
          if (h > 0.01) {
            const r = 1 + (t - passT[k]) * 40;
            D.poly([P(-W * r, -Hh * r, 0), P(W * r, -Hh * r, 0), P(W * r, Hh * r, 0), P(-W * r, Hh * r, 0)], 2, mul(C.orangeHot, h * 0.6), 1, true);
          }
        }
      });
      // packets in lanes, overtaking toward the core
      for (let i = 0; i < NP; i++) {
        const [x, y] = LANES[i % LANES.length];
        const rel = ((hash(i * 3.1) * 90 + lt * (6 + 4 * hash(i))) % 90) - 5;
        const z = -(s + rel);
        if (-z > sCore) { m4.makeScale(0, 0, 0); pm.setMatrixAt(i, m4); continue; }
        m4.makeRotationY(Math.PI / 2).setPosition(x, y, z);
        pm.setMatrixAt(i, m4);
        col.setRGB(2.2, 0.5, 0.09); pm.setColorAt(i, col);
        D.seg(x, y, z + 0.3, x, y, z + 2.0, 2, ...mul(C.orangeHot, 0.5), 1);
      }
      pm.instanceMatrix.needsUpdate = true; pm.instanceColor.needsUpdate = true;
      // the core ahead: spins up with the build
      const spinT = t + 6 * build * build * build;
      const coreE = 0.5 + build * 1.2 + roll16 * build;
      drawCore(D, new THREE.Vector3(0, 0, -sCore), 3.2, spinT, { energy: coreE, armK: 1, spin: 0.4, pulse: roll16 * build * 0.8 });
      // converging speed lines in the build
      if (build > 0) {
        for (let i = 0; i < 90; i++) {
          const a = hash(i * 1.3) * Math.PI * 2, r = 4 + hash(i * 2.7) * 12;
          const zz = -s - ((hash(i * 5.9) * 60 + lt * 45) % 60);
          const L = 2 + 10 * build;
          D.seg(Math.cos(a) * r, Math.sin(a) * r, zz, Math.cos(a) * r, Math.sin(a) * r, zz - L, 1.4, ...mul(C.cyanHot, 0.5 * build), 1);
        }
      }
      D.flush();
      hrt.scale.setScalar(0.6 + build * 1.4 + roll16 * build * 0.5);

      const endK = prog(t, T1 - 0.5, T1, ease.inCubic);
      return {
        bloom: 0.8 + build * 0.5 + roll16 * build * 0.4, ca: 0.002 + build * 0.006 + endK * 0.01,
        zoomBlur: Math.max(hit(t, T0, 5) * 0.4, build * 0.12 + endK * 0.55),
        flash: roll16 * build * 0.12 + hit(t, T0, 10) * 0.3 + endK * 0.6, flashColor: [1, 0.95, 0.9],
        shake: [Math.sin(t * 91) * 0.004 * build, Math.cos(t * 77) * 0.004 * build],
      };
    },
  };
}
