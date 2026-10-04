// 08 LOGO (bars 28-32 + tail): the README's ASCII logo, built for real — every █ is a block that flies
// in from the swarm on a 16th, every box-drawing stroke a double neon line. Tagline, URL, final hit.
import * as THREE from 'three';
import { clamp, lerp, keys, prog, ease, hash } from '../../engine/util.js';
import { Lines, C, mul, mix3, bt, BEAT, BAR, label, setColor, dust, makeCam, baseScene, hit, beatEnv, drawCore, heroText, drawHero, revealGlyphs, floorGrid, OCT_EDGES, BOX_E } from '../lib.js';

const ART = [
  ' ██████╗  ██████╗████████╗ ██████╗ ███████╗',
  '██╔═══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔════╝',
  '██║   ██║██║        ██║   ██║   ██║███████╗',
  '██║   ██║██║        ██║   ██║   ██║╚════██║',
  '╚██████╔╝╚██████╗   ██║   ╚██████╔╝███████║',
  ' ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚══════╝',
];
const CW = 0.56, CH = 1.12, NC = 43;

export default function make(ctx) {
  const scene = baseScene();
  const cam = makeCam(45);
  scene.add(cam);
  const S = new Lines(8000, { fog: [50, 180] });
  const D = new Lines(30000, { fog: [50, 180] });
  scene.add(S.mesh, D.mesh);
  const T0 = bt(28), TEND = bt(32);
  dust(S, 1500, [-80, -40, -90], [80, 40, 30], 61, [0.25, 0.5, 0.7], 1.8);
  S.flush();

  // parse
  const blocks = [], strokes = [];
  ART.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const x = (c - (NC - 1) / 2) * CW, y = (2.5 - r) * CH;
      if (ch === '█') blocks.push({ x, y, c, r });
      else if (ch.trim()) strokes.push({ x, y, c, r, ch });
    });
  });
  // block instanced mesh: bright face, orange-dark sides
  const bgeo = new THREE.BoxGeometry(CW * 0.9, CH * 0.9, 0.7);
  const faceM = new THREE.MeshBasicMaterial(); faceM.color.setRGB(0.62, 0.68, 0.72);
  const sideM = new THREE.MeshBasicMaterial(); sideM.color.setRGB(0.16, 0.035, 0.006);
  // BoxGeometry groups: +x,-x,+y,-y,+z,-z
  const bm = new THREE.InstancedMesh(bgeo, [sideM, sideM, sideM, sideM, faceM, sideM], blocks.length);
  bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bm.frustumCulled = false;
  scene.add(bm);
  blocks.forEach((b, i) => {
    b.ta = T0 + (b.c / NC) * BAR * 0.85 + hash(i * 1.7) * 0.06; // arrival: sweep left→right over bar 28
    const a = hash(i * 3.1) * Math.PI * 2, e = (hash(i * 5.3) - 0.5) * 1.6, R = 25 + hash(i * 7.7) * 25;
    b.from = new THREE.Vector3(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, -Math.abs(Math.sin(a)) * R - 10);
  });
  // stroke polylines per box-drawing char (cell-local, double lines)
  const d = 0.1, L = -CW / 2, Rr = CW / 2, T = CH / 2, B = -CH / 2;
  const SH = {
    '═': [[[L, d], [Rr, d]], [[L, -d], [Rr, -d]]],
    '║': [[[-d, T], [-d, B]], [[d, T], [d, B]]],
    '╗': [[[L, d], [d, d], [d, B]], [[L, -d], [-d, -d], [-d, B]]],
    '╔': [[[Rr, d], [-d, d], [-d, B]], [[Rr, -d], [d, -d], [d, B]]],
    '╚': [[[-d, T], [-d, -d], [Rr, -d]], [[d, T], [d, d], [Rr, d]]],
    '╝': [[[d, T], [d, -d], [L, -d]], [[-d, T], [-d, d], [L, d]]],
  };
  const SZ = -0.2;
  strokes.forEach((s) => { s.polys = (SH[s.ch] || []).map((pl) => pl.map(([x, y]) => new THREE.Vector3(s.x + x, s.y + y, SZ))); s.tk = T0 + BAR + (s.c / NC) * BAR * 0.7; });

  const tag = heroText(ctx, 'Arch', 'AGENTIC OPERATING SYSTEM', { size: 1, depth: 0.25, tracking: 0.08, face: [0.5, 0.78, 0.9], side: [0.05, 0.2, 0.28] });
  tag.scale.setScalar(20.5 / tag.userData.width); tag.position.set(0, -4.9, 0); scene.add(tag);
  const url = label('github.com/octos-org/octos', 0.95, [1, 1, 1], { font: '600 96px Mono', align: 'center' });
  url.position.set(0, -6.9, 0); scene.add(url);
  const sub = label('embeddable AI agent harness kernel  ·  written in Rust', 0.62, C.cyan, { font: '500 64px Mono', align: 'center' });
  sub.position.set(0, -8.25, 0); scene.add(sub);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - T0;
      const kick = t < TEND + 0.01 ? beatEnv(t, 10) : 0;
      const fin = hit(t, TEND, 1.6);
      // camera: tracks the build sweep low and close, then swings frontal and settles
      const sweep = prog(t, T0, T0 + BAR);
      const front = prog(t, bt(29), bt(30), ease.inOutCubic);
      const camA = new THREE.Vector3(lerp(-14, 5, ease.inOutCubic(sweep)), -2.6, 12);
      const camB = new THREE.Vector3(0, -0.6, keys(t, [[bt(30), 27], [TEND, 23.5], [TEND + 2, 25.5, ease.outCubic]]));
      cam.position.copy(camA).lerp(camB, front);
      const lookA = new THREE.Vector3(lerp(-9, 7, ease.inOutCubic(sweep)) + 1, 0.5, 0);
      const lookB = new THREE.Vector3(0, -1.4, 0);
      cam.up.set(0, 1, 0);
      cam.lookAt(lookA.lerp(lookB, front));
      cam.rotateZ((1 - front) * -0.12 + Math.sin(lt * 0.5) * 0.015);
      cam.fov = 45 + hit(t, T0, 4) * 25; cam.updateProjectionMatrix();

      D.clear();
      // big dim kernel behind the logo, arms reaching out of frame
      drawCore(D, new THREE.Vector3(0, 0, -22), 7, t * 0.6, { energy: 0.22 + 0.15 * kick + fin * 0.35, armK: 1, armLen: 4, spin: 0.2 });
      floorGrid(D, -10, 0, -10, 90, 4, (x, z) => {
        const r = Math.hypot(x, z + 10);
        return [C.cyan[0], C.cyan[1], C.cyan[2], (0.16 + 0.2 * fin) * clamp(1 - r / 90) + 0.25 * kick * Math.exp(-Math.abs(r - 20) * 0.1)];
      }, 4);
      // blocks
      blocks.forEach((b, i) => {
        const k = prog(t, b.ta - 0.45, b.ta, ease.outCubic);
        if (k <= 0) { m4.makeScale(0, 0, 0); bm.setMatrixAt(i, m4); return; }
        v.set(b.x, b.y, 0).lerp(b.from, 1 - k);
        e3.set((1 - k) * 6 * hash(i), (1 - k) * 8 * hash(i * 2), 0); q.setFromEuler(e3);
        const land = hit(t, b.ta, 8);
        const pulse = fin * Math.exp(-Math.abs(b.c - (t - TEND) * 60) * 0.3);
        const s = 1 + land * 0.25 + pulse * 0.3;
        m4.compose(v, q, new THREE.Vector3(s, s, 1 + land * 2));
        bm.setMatrixAt(i, m4);
        // incoming trail
        if (k < 1) { const tail = v.clone().lerp(b.from, 0.12); D.line(tail, v, 2, mul(C.cyanHot, 0.8), 1); }
        if (land > 0.05) { const hx = CW * 0.45, hy = CH * 0.45; D.poly([new THREE.Vector3(b.x - hx, b.y - hy, 0.36), new THREE.Vector3(b.x + hx, b.y - hy, 0.36), new THREE.Vector3(b.x + hx, b.y + hy, 0.36), new THREE.Vector3(b.x - hx, b.y + hy, 0.36)], 2, mul(C.cyanHot, land * 1.5), 1, true); }
      });
      bm.instanceMatrix.needsUpdate = true;
      const glow = 0.62 + 0.1 * kick + fin * 0.15;
      faceM.color.setRGB(glow * 0.95, glow * 1.02, glow * 1.08);
      // strokes draw on
      strokes.forEach((s) => {
        const k = prog(t, s.tk, s.tk + 0.25);
        if (k <= 0) return;
        const col = mix3(C.orangeHot, [3, 2, 1.5], hit(t, s.tk + 0.25, 6) + fin * 0.5);
        for (const pl of s.polys) {
          // draw polyline progressively
          const segs = pl.length - 1;
          for (let j = 0; j < segs; j++) D.lineK(pl[j], pl[j + 1], k * segs - j, 2.2, mul(col, 0.8), 1);
        }
      });
      // tagline + URL
      const tk = prog(t, bt(30), bt(30, 1.5));
      tag.visible = tk > 0;
      revealGlyphs(tag, tk, { spread: 0.7, dy: 0.5, dz: 0 });
      const tg = 1 + hit(t, bt(30), 3) * 0.8 + fin * 0.3;
      tag.userData.face.color.setRGB(0.5 * tg, 0.78 * tg, 0.9 * tg);
      const uk = prog(t, bt(30, 2), bt(30, 2.6));
      url.visible = uk > 0; setColor(url, [0.72, 0.74, 0.76], uk); url.scale.x = 0.9 + 0.1 * uk;
      const sk = prog(t, bt(31), bt(31, 0.6));
      sub.visible = sk > 0; setColor(sub, [0.3, 0.62, 0.75], sk);
      // final hit: shock ring through the logo
      if (t > TEND) { const r = (t - TEND) * 40; D.ring(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), r, 96, 3, mul(C.white, 2 * Math.exp(-(t - TEND) * 2)), 1); }
      D.flush();
      const barH = t < TEND ? hit(t, T0 + Math.floor(lt / BAR) * BAR, 6) * 0.15 : 0;
      return {
        bloom: 0.8 + kick * 0.2 + fin * 0.15, ca: 0.0018 + kick * 0.002 + fin * 0.004,
        zoomBlur: Math.max(hit(t, T0, 4) * 0.5, hit(t, TEND, 6) * 0.15), flash: Math.min(1, hit(t, T0, 7) * 0.8 + barH + hit(t, TEND, 7) * 0.3),
        flashColor: [1, 0.95, 0.9], exposure: 1 + kick * 0.08,
      };
    },
  };
}
