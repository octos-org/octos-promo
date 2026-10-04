// 07 BOUNDARY (bars 24-28): the architecture as a place. Above a glowing protocol plane float the apps
// (Octoscode, Octoscode Web, your app); below it runs the kernel. Lanes pierce the plane. The camera
// starts with the apps, plunges through the boundary, then pulls out to see both worlds.
import * as THREE from 'three';
import { clamp, lerp, keys, prog, ease, hash } from '../../engine/util.js';
import { Lines, C, mul, mix3, bt, BEAT, BAR, label, setColor, dust, makeCam, baseScene, hit, beatEnv, drawCore, heart, heroText, drawHero, revealGlyphs, floorGrid, packetMesh, plate } from '../lib.js';

const PANELS = [
  { x: -11, name: 'Octoscode', kind: 'term' },
  { x: 0, name: 'your app', kind: 'app' },
  { x: 11, name: 'Octoscode Web', kind: 'web' },
];
const TERM = ['› turn/start', '‹ message/delta', '‹ message/delta', '› approval/respond', '‹ message/delta'];

export default function make(ctx) {
  const scene = baseScene();
  const cam = makeCam(52);
  scene.add(cam);
  const S = new Lines(40000, { fog: [40, 140] });
  const D = new Lines(30000, { fog: [40, 140] });
  scene.add(S.mesh, D.mesh);
  const T0 = bt(24), T1 = bt(28);
  const PY = 9, CY = -11; // panel centre height, core height
  // panels
  const P = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  PANELS.forEach((pn) => {
    const w = 4.4, h = 2.9, x = pn.x, y = PY;
    const c = mul(C.cyan, 0.8);
    S.poly([P(x - w, y - h), P(x + w, y - h), P(x + w, y + h), P(x - w, y + h)], 2, c, 1, true);
    S.poly([P(x - w, y - h, -0.6), P(x + w, y - h, -0.6), P(x + w, y + h, -0.6), P(x - w, y + h, -0.6)], 1, mul(c, 0.35), 1, true);
    for (const [a, b] of [[-w, -h], [w, -h], [w, h], [-w, h]]) S.line(P(x + a, y + b), P(x + a, y + b, -0.6), 1, mul(c, 0.35));
    S.line(P(x - w, y + h - 0.7), P(x + w, y + h - 0.7), 1.4, mul(c, 0.7)); // title bar
    for (let k = 0; k < 3; k++) S.ring(P(x - w + 0.4 + k * 0.35, y + h - 0.35, 0.01), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 0.1, 10, 1.2, k === 0 ? C.orange : mul(c, 0.6));
    if (pn.kind === 'web') {
      S.poly([P(x - w + 1.6, y + h - 0.55), P(x + w - 0.4, y + h - 0.55), P(x + w - 0.4, y + h - 0.15), P(x - w + 1.6, y + h - 0.15)], 1, mul(c, 0.5), 1, true);
      for (let k = 0; k < 3; k++) S.poly([P(x - w + 0.5 + k * 2.8, y - h + 0.5), P(x - w + 2.8 + k * 2.8, y - h + 0.5), P(x - w + 2.8 + k * 2.8, y - 0.2), P(x - w + 0.5 + k * 2.8, y - 0.2)], 1, mul(c, 0.4), 1, true);
    }
    if (pn.kind === 'app') {
      S.poly([P(x - w + 0.5, y - h + 0.5), P(x - 1.2, y - h + 0.5), P(x - 1.2, y + h - 1.1), P(x - w + 0.5, y + h - 1.1)], 1, mul(c, 0.4), 1, true);
      for (let k = 0; k < 4; k++) S.line(P(x - 0.8, y + h - 1.4 - k * 0.8), P(x + w - 0.6 - (k % 2) * 1.5, y + h - 1.4 - k * 0.8), 2, mul(c, 0.35));
    }
  });
  // boundary plane: rings + ticks
  const O = new THREE.Vector3();
  for (const r of [6, 12, 18, 26]) S.ring(O, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), r, 128, r === 18 ? 2 : 1, mul(C.cyan, r === 18 ? 0.8 : 0.35));
  for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, r1 = i % 10 ? 18.6 : 19.6; S.seg(Math.cos(a) * 18, 0, Math.sin(a) * 18, Math.cos(a) * r1, 0, Math.sin(a) * r1, 1, ...mul(C.cyan, 0.5), 1); }
  dust(S, 1200, [-70, -40, -70], [70, 40, 70], 51, [0.25, 0.5, 0.7], 1.8);
  // vertical lanes from panels to core
  const lanes = PANELS.map((pn) => ({ top: P(pn.x, PY - 2.9, 0.3), bot: P(pn.x * 0.25, CY + 2.6, 0.3 + (pn.x === 0 ? 1.2 : 0)) }));
  lanes.forEach((L) => {
    for (let k = 0; k <= 40; k++) {
      const p = L.top.clone().lerp(L.bot, k / 40);
      S.ring(p, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), 0.4, 10, 1, mul(C.orange, 0.45));
    }
    for (const dx of [-0.4, 0.4]) S.line(L.top.clone().add(P(dx, 0)), L.bot.clone().add(P(dx, 0)), 1, mul(C.orange, 0.3));
  });
  S.flush();
  const hrt = heart(0.5); hrt.position.set(0, CY, 0); scene.add(hrt);

  // labels
  const pl = PANELS.map((pn) => { const l = label(pn.name, 0.55, [1, 1, 1], { font: '600 72px Mono', anchor: 'left' }); l.position.set(pn.x - 4.4 + 1.5, PY + 2.9 - 0.36, 0.05); scene.add(l); return l; });
  const term = TERM.map((s, i) => { const l = label(s, 0.42, s[0] === '›' ? C.orange : C.cyan, { font: '500 64px Mono', anchor: 'left' }); l.position.set(-11 - 4.0, PY + 1.3 - i * 0.62, 0.05); scene.add(l); return l; });
  const planeLab = label('OUP · JSON-RPC 2.0', 1.3, [0.5, 0.8, 0.9], { font: '600 96px Mono', align: 'center' });
  planeLab.rotation.x = -Math.PI / 2; planeLab.position.set(0, 0.03, 15.2); scene.add(planeLab);
  const heroA = heroText(ctx, 'ArchX', 'YOUR APP', { size: 1, depth: 0.35, tracking: 0.05 });
  const heroB = heroText(ctx, 'ArchX', 'OCTOS', { size: 1, depth: 0.35, tracking: 0.05 });
  const subA = label('owns the interface & product workflow', 0.3, [0.45, 0.78, 0.9], { font: '600 64px Mono', align: 'center' });
  const subB = label('owns agent execution & runtime state', 0.3, [1.0, 0.33, 0.08], { font: '600 64px Mono', align: 'center' });
  plate(subA); plate(subB);
  cam.add(heroA, heroB, subA, subB);
  const NP = 24, pm = packetMesh(NP, 0.13, 0.5); scene.add(pm);
  const plabs = [];
  for (let i = 0; i < NP; i++) {
    const down = i % 2 === 0;
    const name = down ? ['turn/start', 'turn/steer', 'approval/respond', 'session/open'][i / 2 % 4] : ['message/delta', 'result', 'message/delta'][((i - 1) / 2) % 3];
    const l = label(name, 0.34, [1, 1, 1], { font: '600 64px Mono' }); scene.add(l);
    plabs.push({ l, down, lane: lanes[i % 3], ph: hash(i * 3.7) });
  }
  const m4 = new THREE.Matrix4(), col = new THREE.Color();

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - T0;
      const kick = beatEnv(t, 10);
      const plunge = prog(t, bt(26), bt(26, 2), ease.inOutCubic);
      const wide = prog(t, bt(27), bt(27, 2.5), ease.inOutCubic);
      const whip = prog(t, bt(27, 3.25), T1, ease.inCubic);
      // camera
      const above = P(lerp(-2, 1, prog(t, T0, bt(26))), PY + 1.5 - prog(t, T0, bt(26)) * 1.5, lerp(26, 20, prog(t, T0, bt(26))));
      const below = P(2, CY + 4, 15);
      const wideP = P(34, 2, 30);
      const pos = above.clone().lerp(below, plunge).lerp(wideP, wide);
      // arc through the plane on the plunge
      pos.z += Math.sin(plunge * Math.PI) * -6;
      cam.position.copy(pos);
      cam.up.set(0, 1, 0);
      const lookA = P(0, PY - 0.5, 0), lookB = P(0, CY + 1, 0), lookW = P(0, -1, 0);
      cam.lookAt(lookA.clone().lerp(lookB, plunge).lerp(lookW, wide));
      cam.rotateZ(Math.sin(lt * 0.6) * 0.03 + whip * 0.8);
      cam.fov = 52 + wide * 4 + whip * 30 + hit(t, T0, 5) * 20; cam.updateProjectionMatrix();
      cam.updateMatrixWorld();

      D.clear();
      // boundary plane grid, pulses from the lane ports
      const cross = hit(t, bt(26, 1), 3);
      floorGrid(D, 0, 0, 0, 36, 2, (x, z) => {
        const r = Math.hypot(x, z);
        if (r > 36) return null;
        const w = Math.exp(-Math.abs(r - ((t - T0) * 14) % 36) * 0.4);
        const a = 0.3 * (1 - r / 36) + 0.4 * w + cross * 0.35 * Math.exp(-r * 0.08);
        return [C.cyan[0], C.cyan[1], C.cyan[2], a * (0.8 + 0.3 * kick)];
      }, 2);
      // ports where lanes cross the plane
      lanes.forEach((L, i) => {
        const k = L.top.y / (L.top.y - L.bot.y);
        const pp = L.top.clone().lerp(L.bot, k);
        for (let j = 0; j < 3; j++) {
          const r = 0.8 + ((t * 1.5 + j / 3) % 1) * 2.5;
          D.ring(pp, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), r, 32, 2, mul(C.orangeHot, 0.8 * (1 - ((t * 1.5 + j / 3) % 1))), 1);
        }
      });
      drawCore(D, P(0, CY, 0), 2.2, t, { energy: 0.9 + kick * 0.4, armK: 1, spin: 0.3, pulse: kick * 0.3 });
      // panel glow on kicks
      PANELS.forEach((pn) => { const w = 4.4, h = 2.9; D.poly([P(pn.x - w, PY - h, 0.02), P(pn.x + w, PY - h, 0.02), P(pn.x + w, PY + h, 0.02), P(pn.x - w, PY + h, 0.02)], 3, mul(C.cyanHot, 0.15 + kick * 0.3), 1, true); });
      // packets on lanes
      for (let i = 0; i < NP; i++) {
        const Q = plabs[i];
        const ph = (Q.ph + lt * 0.28) % 1;
        const k = Q.down ? ph : 1 - ph;
        const p = Q.lane.top.clone().lerp(Q.lane.bot, k);
        const side = Q.down ? -0.0 : 0.0;
        m4.makeRotationZ(Math.PI / 2).setPosition(p.x + side, p.y, p.z);
        pm.setMatrixAt(i, m4);
        col.setRGB(...(Q.down ? [2.4, 0.55, 0.1] : [0.5, 1.6, 2.4])); pm.setColorAt(i, col);
        const dir = Q.down ? 1 : -1;
        D.seg(p.x, p.y + dir * 0.35, p.z, p.x, p.y + dir * 2.2, p.z, 2.5, ...mul(Q.down ? C.orangeHot : C.cyanHot, 0.5), 1);
        Q.l.position.set(p.x + 0.45, p.y, p.z); Q.l.quaternion.copy(cam.quaternion);
        Q.l.visible = true;
        setColor(Q.l, Q.down ? [1.0, 0.36, 0.1] : [0.35, 0.72, 0.9], clamp(Math.sin(ph * Math.PI) * 3));
      }
      pm.instanceMatrix.needsUpdate = true; pm.instanceColor.needsUpdate = true;
      // heroes
      const aOn = prog(t, T0 + 0.1, T0 + 0.5, ease.outExpo) * (1 - prog(t, bt(26), bt(26, 0.5)));
      const bOn = prog(t, bt(26, 2), bt(26, 2.4), ease.outExpo) * (1 - prog(t, bt(27), bt(27, 0.5)));
      heroA.visible = subA.visible = aOn > 0.01; heroB.visible = subB.visible = bOn > 0.01;
      heroA.position.set(0, 2.55 + (1 - aOn) * 0.5, -9); heroB.position.set(0, 2.55 + (1 - bOn) * 0.5, -9);
      subA.position.set(0, 1.6, -9); subB.position.set(0, 1.6, -9);
      heroA.scale.setScalar(0.95); heroB.scale.setScalar(0.95);
      revealGlyphs(heroA, aOn, { spread: 0.6, dy: 0.3 }); revealGlyphs(heroB, bOn, { spread: 0.6, dy: 0.3 });
      if (heroA.visible) drawHero(D, heroA, { front: mul(C.cyanHot, 1), back: mul(C.cyan, 0.3), w: 2.4 });
      if (heroB.visible) drawHero(D, heroB, { front: mul(C.orangeHot, 0.9), back: mul(C.orange, 0.4), w: 2.4 });
      setColor(subA, [0.45, 0.78, 0.9], aOn); setColor(subB, [1.0, 0.36, 0.1], bOn);
      D.flush();
      pl.forEach((l) => setColor(l, [0.7, 0.72, 0.74], 1));
      term.forEach((l, i) => { const on = prog(t, T0 + 0.3 + i * BEAT, T0 + 0.4 + i * BEAT); l.visible = on > 0; setColor(l, i % 3 === 0 ? [1.0, 0.36, 0.1] : [0.35, 0.72, 0.9], on); });
      setColor(planeLab, [0.4, 0.66, 0.75], 0.5 + 0.5 * wide);
      hrt.scale.setScalar(0.7 + kick * 0.3);
      const roll = beatEnv(t, 16, t > bt(27) ? 4 : 2, bt(26), T1 - 0.25) * prog(t, bt(26), T1);
      return {
        bloom: 0.8 + kick * 0.2 + cross * 0.3 + roll * 0.2, ca: 0.002 + cross * 0.01 + whip * 0.01,
        zoomBlur: Math.max(hit(t, T0, 5) * 0.35, cross * 0.3, whip * 0.55), flash: cross * 0.15 + hit(t, T0, 9) * 0.25 + roll * 0.08 + whip * 0.5,
        flashColor: [0.7, 0.9, 1],
      };
    },
    hud(h, f) {
      h.shadowColor = 'rgba(0,0,0,0.95)'; h.shadowBlur = 14;
      const t = f.t;
      const a = prog(t, bt(27, 1), bt(27, 1.5)) * (1 - prog(t, bt(27, 3.2), bt(27, 3.6)));
      h.textAlign = 'center'; h.font = '500 32px Mono';
      h.fillStyle = `rgba(190,230,245,${0.9 * a})`;
      h.fillText('a reusable kernel with a programmable protocol boundary', 960, 950);
      h.textAlign = 'left';
    },
  };
}
