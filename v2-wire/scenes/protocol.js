// 03 PROTOCOL (bars 8-12): inside the arm — OUP is a bundle of lanes. JSON-RPC packets race along;
// requests (orange) travel with us into the kernel, deltas/results (cyan) stream back at us.
// The camera flies through a giant wire "OUP" and under highway gantries that name the transport.
import * as THREE from 'three';
import { clamp, lerp, keys, prog, ease, hash } from '../../engine/util.js';
import { Lines, C, mul, mix3, bt, BEAT, BAR, label, setColor, dust, makeCam, baseScene, hit, beatEnv, heroText, drawHero, revealGlyphs, packetMesh, METHODS_DOWN, METHODS_UP } from '../lib.js';

export const pathP = (s, out = new THREE.Vector3()) => out.set(7 * Math.sin(s / 45) + 2 * Math.sin(s / 17), 3 * Math.sin(s / 31), -s);
export function frameAt(s) {
  const p = pathP(s), q = pathP(s + 0.5);
  const T = q.sub(p).normalize();
  const R = new THREE.Vector3().crossVectors(T, new THREE.Vector3(0, 1, 0)).normalize();
  const U = new THREE.Vector3().crossVectors(R, T);
  return { p, T, R, U };
}
// lanes: angle around the path, direction +1 (with camera / into kernel) or -1 (toward camera)
const LANES = [
  { a: -2.35, r: 2.3, dir: 1 }, { a: -1.57, r: 2.0, dir: 1 }, { a: -0.79, r: 2.3, dir: 1 },
  { a: 0.6, r: 2.6, dir: -1 }, { a: 1.57, r: 2.4, dir: -1 }, { a: 2.54, r: 2.6, dir: -1 },
];
const SIGNS = [
  ['JSON-RPC 2.0', 'the OUP wire format'],
  ['WebSocket  |  stdio', 'stdio: newline-delimited JSON'],
  ['$ octos serve --stdio', 'reference host'],
];

export default function make(ctx) {
  const scene = baseScene();
  const cam = makeCam(58);
  scene.add(cam);
  const S = new Lines(60000, { fog: [25, 95] });
  const D = new Lines(20000, { fog: [25, 95] });
  scene.add(S.mesh, D.mesh);
  const T0 = bt(8), LEN = 260;
  const V = 19.5, A = 1.4; // cruise speed, surge per beat
  const sCam = (t) => { const u = t - T0 + 0.6; const b = u / BEAT; return V * u + A * (Math.floor(b) + ease.inOutCubic(b - Math.floor(b))); };
  const sAt = (t) => sCam(t);
  const sOUP = sAt(bt(9)) + 0.0; // fly through the O on the bar-9 downbeat
  const signS = [sAt(bt(10)) - 1, sAt(bt(10.75)) - 1, sAt(bt(11.5)) - 1];

  const laneOff = (L, f) => f.R.clone().multiplyScalar(Math.cos(L.a) * L.r).addScaledVector(f.U, Math.sin(L.a) * L.r);
  // static lanes: rings + rails
  for (let s = -10; s < LEN; s += 1.2) {
    const f = frameAt(s), f2 = frameAt(s + 1.2);
    for (const L of LANES) {
      const c = L.dir > 0 ? mul(C.orange, 0.55) : mul(C.cyan, 0.5);
      const o = f.p.clone().add(laneOff(L, f)), o2 = f2.p.clone().add(laneOff(L, f2));
      S.ring(o, f.R, f.U, 0.36, 10, 1.1, c, 0.9);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + 0.4;
        const d1 = f.R.clone().multiplyScalar(Math.cos(a) * 0.36).addScaledVector(f.U, Math.sin(a) * 0.36);
        const d2 = f2.R.clone().multiplyScalar(Math.cos(a) * 0.36).addScaledVector(f2.U, Math.sin(a) * 0.36);
        S.line(o.clone().add(d1), o2.clone().add(d2), 0.9, mul(c, 0.6), 1);
      }
    }
    // big hex gate every 12 units
    if (Math.round(s / 1.2) % 10 === 0) {
      const pts = [];
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; pts.push(f.p.clone().addScaledVector(f.R, Math.cos(a) * 5.2).addScaledVector(f.U, Math.sin(a) * 4.4)); }
      S.poly(pts, 1.6, mul(C.cyan, 0.45), 1, true);
      const pts2 = pts.map((p) => p.clone().addScaledVector(f.T, 0.6));
      S.poly(pts2, 1, mul(C.cyan, 0.25), 1, true);
      for (let k = 0; k < 6; k++) S.line(pts[k], pts2[k], 1, mul(C.cyan, 0.25));
      // radial ticks
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; const r0 = 5.6, r1 = k % 6 ? 5.9 : 6.5; S.line(f.p.clone().addScaledVector(f.R, Math.cos(a) * r0).addScaledVector(f.U, Math.sin(a) * r0 * 0.85), f.p.clone().addScaledVector(f.R, Math.cos(a) * r1).addScaledVector(f.U, Math.sin(a) * r1 * 0.85), 1, mul(C.cyan, 0.3)); }
    }
  }
  // gantries
  const signMeshes = [];
  SIGNS.forEach(([a, b], i) => {
    const f = frameAt(signS[i]);
    const o = f.p;
    const w = 5.6, top = 3.9, bot = -3.6;
    const P = (x, y) => o.clone().addScaledVector(f.R, x).addScaledVector(f.U, y);
    S.line(P(-w, bot), P(-w, top), 2, mul(C.cyan, 0.7)); S.line(P(w, bot), P(w, top), 2, mul(C.cyan, 0.7));
    S.line(P(-w, top), P(w, top), 2, mul(C.cyan, 0.7)); S.line(P(-w, top - 1.5), P(w, top - 1.5), 1.2, mul(C.cyan, 0.5));
    for (let k = 0; k <= 16; k++) { const x = -w + k * w / 8; S.line(P(x, top), P(x + (k % 2 ? -1 : 1) * w / 8, top - 1.5), 0.8, mul(C.cyan, 0.3)); }
    const m = label(a, 0.95, [1, 1, 1], { font: '600 96px Mono', align: 'center' });
    const m2 = label(b, 0.42, C.orange, { font: '500 72px Mono', align: 'center' });
    m.position.copy(P(0, top - 0.75)); m2.position.copy(P(0, top + 0.55));
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.R, f.U, f.T.clone().negate()));
    m.quaternion.copy(q); m2.quaternion.copy(q);
    scene.add(m, m2); signMeshes.push([m, m2, signS[i]]);
  });
  dust(S, 1500, [-30, -20, -LEN], [30, 20, 10], 11, [0.25, 0.5, 0.7], 1.6);
  S.flush();

  // hero OUP, straddling the path
  const hero = heroText(ctx, 'ArchX', 'OUP', { size: 7.5, depth: 1.8, tracking: 0.06 });
  scene.add(hero);
  const fO = frameAt(sOUP);
  // position so that the O's centre sits on the path
  const oX = hero.userData.glyphs[0].userData.x;
  hero.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fO.R, fO.U, fO.T.clone().negate()));
  hero.position.copy(fO.p).addScaledVector(fO.R, -oX);
  const heroSub = label('OCTOS UI PROTOCOL', 0.8, [0.9, 0.95, 1], { font: '600 96px Mono', align: 'center' });
  heroSub.quaternion.copy(hero.quaternion);
  const gU = hero.userData.glyphs; const upX = (gU[1].userData.x + gU[2].userData.x) / 2 - oX;
  heroSub.position.copy(fO.p).addScaledVector(fO.U, -3.8).addScaledVector(fO.R, upX).addScaledVector(fO.T, -0.2);
  scene.add(heroSub);

  // packets
  const NP = 72;
  const pm = packetMesh(NP, 0.1, 0.55); scene.add(pm);
  const pk = [];
  for (let i = 0; i < NP; i++) {
    const lane = LANES[i % 6];
    const down = lane.dir > 0;
    const name = down ? METHODS_DOWN[Math.floor(hash(i * 3.3) * METHODS_DOWN.length)] : METHODS_UP[Math.floor(hash(i * 5.1) * METHODS_UP.length)];
    const lab = label(name, 0.2, [1, 1, 1], { font: '600 64px Mono' });
    scene.add(lab);
    pk.push({ lane, down, base: hash(i * 7.77 + 1) * 120, lab, name });
  }
  const m4 = new THREE.Matrix4(), col = new THREE.Color();

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - T0;
      const kick = beatEnv(t, 9);
      const s = sCam(t);
      const fr = frameAt(s), fa = frameAt(s + 7);
      // camera rides the bundle centre, slight bob & roll with the curve
      cam.position.copy(fr.p).addScaledVector(fr.U, 0.25 + 0.15 * Math.sin(lt * 1.3)).addScaledVector(fr.R, 0.2 * Math.sin(lt * 0.9));
      cam.up.copy(fr.U);
      const frameWord = (1 - prog(t, T0 + 0.5, bt(9) - 0.25, ease.inOutCubic)) * (t < bt(9) ? 1 : 0);
      cam.lookAt(fa.p.clone().addScaledVector(fa.U, 0.2 - 1.2 * frameWord).addScaledVector(fO.R, upX * 0.3 * frameWord));
      const curv = new THREE.Vector3().subVectors(fa.T, fr.T).dot(fr.R);
      cam.rotateZ(-curv * 2.5 + Math.sin(lt * 0.6) * 0.05);
      // exit whip at the end
      const ex = prog(t, bt(11.75), bt(12), ease.inCubic);
      cam.fov = 58 + ex * 25 + hit(t, T0, 5) * 20; cam.updateProjectionMatrix();

      D.clear();
      const sLin = V * (t - T0 + 0.6) + A * (t - T0 + 0.6) / BEAT;
      for (let i = 0; i < NP; i++) {
        const P = pk[i];
        const vel = P.down ? 4 + 3 * hash(i) : -26 - 10 * hash(i);
        const rel = ((P.base + vel * lt) % 110 + 110) % 110 - 12;
        const ps = sLin + rel;
        const f2 = frameAt(ps);
        const o = f2.p.clone().add(laneOff(P.lane, f2));
        const dir = P.down ? f2.T : f2.T.clone().negate();
        m4.lookAt(new THREE.Vector3(), dir, f2.U);
        m4.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
        m4.setPosition(o);
        pm.setMatrixAt(i, m4);
        const hot = P.down ? [2.4, 0.55, 0.1] : [0.5, 1.6, 2.4];
        col.setRGB(...hot); pm.setColorAt(i, col);
        // trail
        const tl = P.down ? 1.2 : 3.5;
        for (let j = 0; j < 5; j++) {
          const a = o.clone().addScaledVector(dir, -0.3 - j * tl / 5), b = o.clone().addScaledVector(dir, -0.3 - (j + 1) * tl / 5);
          const k = Math.exp(-j * 0.6) * 0.8;
          D.line(a, b, 3 * k + 0.5, mul(P.down ? C.orangeHot : C.cyanHot, k), 1);
        }
        // label
        const L = P.lab;
        const dist = rel;
        L.visible = dist > 1.2 && dist < 40;
        if (L.visible) {
          L.position.copy(o).addScaledVector(f2.U, 0.34);
          L.quaternion.copy(cam.quaternion);
          const a = clamp((dist - 1.2) / 2) * clamp((40 - dist) / 15);
          setColor(L, P.down ? [1.0, 0.36, 0.1] : [0.35, 0.72, 0.9], a);
        }
      }
      pm.instanceMatrix.needsUpdate = true; pm.instanceColor.needsUpdate = true;
      // lane pulses on kicks: a ring wave running ahead along every lane
      for (let b = 0; b < 17; b++) {
        const tb = T0 + b * BEAT;
        if (t < tb || t > tb + 1.2) continue;
        const ss = sCam(tb) + 2 + (t - tb) * 60;
        const f2 = frameAt(ss);
        const k = 1 - (t - tb) / 1.2;
        for (const L of LANES) D.ring(f2.p.clone().add(laneOff(L, f2)), f2.R, f2.U, 0.45, 12, 2.5, mul(L.dir > 0 ? C.orangeHot : C.cyanHot, k), 1);
      }
      // OUP hero
      const hk = prog(t, T0, T0 + 0.6);
      revealGlyphs(hero, 1, { spread: 0.5, dy: 0, dz: 0 });
      hero.visible = s < sOUP + 3;
      if (hero.visible) drawHero(D, hero, { front: mix3(C.cyanHot, [3, 3, 3], hit(t, bt(9), 4)), back: mul(C.orange, 0.8), conn: mul(C.orange, 0.5), w: 3, k: hk });
      heroSub.visible = hero.visible; setColor(heroSub, [0.7, 0.75, 0.8], prog(t, T0 + 0.3, T0 + 0.8));
      // sign flash when passing under
      for (const [m, m2, ss] of signMeshes) {
        const d = ss - s;
        m.visible = m2.visible = d > -1 && d < 70;
        const flash = hit(t, T0 + 0, 1) * 0;
        setColor(m, [0.75, 0.8, 0.82], clamp((70 - d) / 25) + flash);
        setColor(m2, [1.0, 0.33, 0.08], clamp((70 - d) / 25));
      }
      D.flush();
      const oupHit = hit(t, bt(9), 5);
      return {
        bloom: 0.8 + kick * 0.25 + oupHit * 0.4, ca: 0.002 + kick * 0.002 + ex * 0.01,
        zoomBlur: Math.max(hit(t, T0, 5) * 0.4, ex * 0.4, oupHit * 0.15), flash: oupHit * 0.18 + hit(t, T0, 10) * 0.3, flashColor: [0.6, 0.9, 1],
      };
    },
  };
}
