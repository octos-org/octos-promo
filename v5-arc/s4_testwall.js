// S4 26.25–33.75 s (bars 14–18): a split-flap wall of Playwright tests. CHECK-ALL sweeps it red → green on the 16th grid,
// the few stragglers stay red; FIX-ALL flips them one per 16th; SHIP BEST freezes the best full-suite state in a snapshot frame.
import * as THREE from 'three';
import { C, CSS, LC, BONE, ORANGE, GREEN, RED, typeMat, kinetic, envMap, camLook, keys, since, keyLight, bt, BEAT, S16, hudCaption, flat, canvasTex, mul, Lines } from './lib.js';
import { ease, clamp, lerp, mulberry32 } from '../engine/util.js';
import { getTS } from './common.js';
import { floor, steelMat } from './factory.js';

const COLS = 20, ROWS = 7, TW = 0.86, TH = 0.6, GX = 0.96, GY = 0.7;

function tileTex(pass) {
  return canvasTex(256, 180, (g, w, h) => {
    g.fillStyle = pass ? '#2fe27a' : '#ff3346'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h / 2 - 2, w, 4); // split-flap seam
    g.strokeStyle = '#0d0e10'; g.lineWidth = 16; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    if (pass) { g.moveTo(74, 94); g.lineTo(112, 130); g.lineTo(184, 52); } else { g.moveTo(90, 52); g.lineTo(166, 128); g.moveTo(166, 52); g.lineTo(90, 128); }
    g.stroke();
    g.fillStyle = 'rgba(13,14,16,0.65)'; g.font = '600 22px PM'; g.fillText('spec.ts', 14, 30);
  });
}

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.fog = new THREE.Fog(C.ink.clone(), 30, 70);
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.3;
  const cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 300);

  floor(scene, { size: 200, cell: 1.5 });
  keyLight(scene, { intensity: 1.5, pos: [-8, 16, 16], target: [0, 2, 0], size: 18, map: 2048 });
  scene.add(new THREE.HemisphereLight(0x8a98a8, 0x101010, 0.35));

  // wall
  const wallW = COLS * GX + 0.5, wallH = ROWS * GY + 0.5, Y0 = 0.9;
  const back = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, 0.3), new THREE.MeshStandardMaterial({ color: 0x131417, roughness: 0.7, metalness: 0.4 }));
  back.position.set(0, Y0 + wallH / 2 - 0.25, -0.25); back.castShadow = true; back.receiveShadow = true; scene.add(back);
  const sm = steelMat();
  for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, Y0 + wallH, 0.5), sm); leg.position.set(sx * (wallW / 2 + 0.15), (Y0 + wallH) / 2 - 0.25, -0.25); leg.castShadow = true; scene.add(leg); }

  const red = new THREE.MeshBasicMaterial({ map: tileTex(false) });
  const green = new THREE.MeshBasicMaterial({ map: tileTex(true) });
  green.map.center.set(0.5, 0.5); green.map.rotation = Math.PI; // back face reads upright after the X flip
  const side = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, metalness: 0.6 });
  const n = COLS * ROWS;
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(TW, TH, 0.05), [side, side, side, side, red, green], n);
  tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tiles.frustumCulled = false;
  scene.add(tiles);
  const rnd = mulberry32(42);
  const T = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = (c - (COLS - 1) / 2) * GX, y = Y0 + (ROWS - 1 - r) * GY;
    const sweep = bt(14) + Math.round(((c / (COLS - 1)) * 0.8 + (r / (ROWS - 1)) * 0.25) * 24 + rnd() * 2) * S16;
    T.push({ x, y, c, r, sweep, fail: rnd() < 0.09, fix: 0 });
  }
  const fails = T.filter((q) => q.fail);
  fails.forEach((q, k) => { q.fix = bt(16) + Math.round((k / fails.length) * 15) * S16; });

  // headline words above the wall
  const wMat = typeMat({ face: BONE, side: 0x6b6760, rough: 0.4, clearcoat: 0.3, flatFace: 0.85 });
  const gMat = typeMat({ face: GREEN, side: 0x137a3d, rough: 0.4, clearcoat: 0.3, flatFace: 0.85 });
  const oMat = typeMat({ face: ORANGE, side: 0x9a3208, rough: 0.4, clearcoat: 0.3, flatFace: 0.85 });
  const WORDS = [['CHECK-ALL', wMat, bt(14), bt(16)], ['FIX-ALL', oMat, bt(16), bt(17)], ['SHIP BEST', gMat, bt(17), bt(18) + 1]];
  const words = WORDS.map(([s, m, a, b]) => {
    const k = kinetic(ts, 'AX', s, m, { size: 1.15, depth: 0.4, tracking: 0.01 });
    k.group.position.set(0, Y0 + wallH + 0.3, 0);
    scene.add(k.group);
    return { k, a, b };
  });

  // snapshot frame (additive lines)
  const lines = new Lines(64, { fog: [40, 90] });
  scene.add(lines.mesh);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      let flipK = 0;
      T.forEach((q, i) => {
        // flip angle: sweep (non-fail) or fix (fail); fails jitter at their sweep time
        let ang = 0, z = 0;
        const tf = q.fail ? q.fix : q.sweep;
        const u = clamp((t - tf) / 0.2);
        ang = Math.PI * ease.outBack(u);
        if (u > 0 && u < 1) z = Math.sin(u * Math.PI) * 0.25;
        if (t >= tf && t < tf + 0.3) flipK = Math.max(flipK, 1 - (t - tf) / 0.3);
        let jit = 0;
        if (q.fail && t >= q.sweep && t < q.fix) jit = Math.exp(-(t - q.sweep) / 0.15) * Math.sin((t - q.sweep) * 80) * 0.12;
        E.set(ang + jit, 0, 0); Q.setFromEuler(E);
        P.set(q.x, q.y, z);
        M.compose(P, Q, S); tiles.setMatrixAt(i, M);
      });
      tiles.instanceMatrix.needsUpdate = true;
      // glow on the green faces as the sweep passes; red pulses before FIX-ALL
      const gl = 1 + 0.25 * flipK;
      green.color.setScalar(0.8 * gl);
      const redK = t >= bt(15, 2) && t < bt(16) ? Math.exp(-((t - bt(15, 2)) % BEAT) / 0.15) : 0;
      red.color.setScalar(0.72 + 0.3 * redK);

      for (const w of words) {
        const on = t >= w.a && t < w.b;
        w.k.glyphs.forEach((g, i) => {
          const t0 = w.a + i * 0.018;
          const e = ease.outExpo(clamp((t - t0) / 0.3));
          const out = ease.inExpo(clamp((t - (w.b - 0.12)) / 0.12));
          g.mesh.visible = on && t >= t0;
          g.mesh.position.y = g.y + (1 - e) * -1.2 + out * 1.5;
          g.mesh.rotation.x = (1 - e) * -1.4;
        });
      }

      // snapshot frame on SHIP BEST
      lines.clear();
      const sp = t - bt(17);
      if (sp >= 0) {
        const k = ease.outExpo(clamp(sp / 0.3));
        const hw = lerp(wallW * 0.75, wallW / 2 + 0.35, k), hh = lerp(wallH * 0.8, wallH / 2 + 0.25, k), cy = Y0 + wallH / 2 - 0.25;
        const col = mul([1, 1, 1], 0.9 + 2 * Math.exp(-sp / 0.15));
        const L = 1.2;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const cx = sx * hw, yy = cy + sy * hh;
          lines.seg(cx, yy, 0.3, cx - sx * L, yy, 0.3, 5, ...col, 1);
          lines.seg(cx, yy, 0.3, cx, yy - sy * L * 0.8, 0.3, 5, ...col, 1);
        }
      }
      lines.flush();

      // camera: grazing along the wall with the sweep → frontal → wide on SHIP BEST → push to break
      const p = keys(t, [[bt(14), [-12.5, 3.2, 7.5]], [bt(15, 2), [-3.0, 3.6, 13.0], ease.inOutCubic], [bt(16), [2.0, 3.9, 15.0], ease.inOutCubic], [bt(17), [0, 4.1, 16.5], ease.inOutCubic], [bt(17, 2.5), [0, 4.0, 18.0], ease.outCubic], [bt(18), [0, 3.4, 6.0], ease.inExpo]]);
      const look = keys(t, [[bt(14), [-3.0, 4.3, 0]], [bt(15, 2), [1.0, 3.9, 0], ease.inOutCubic], [bt(16), [0.5, 4.1, 0], ease.inOutCubic], [bt(17), [0, 4.0, 0]], [bt(18), [0, 3.4, 0]]]);
      camLook(cam, p, look, keys(t, [[bt(14), 0.06], [bt(15, 2), 0.02], [bt(16), 0]]));
      const push = ease.inExpo(clamp((t - bt(17, 2.5)) / (1.5 * BEAT)));
      cam.fov = 36 + 16 * push; cam.updateProjectionMatrix();
      const ship = t >= bt(17) ? Math.exp(-(t - bt(17)) / 0.16) : 0;
      return {
        bloom: 0.7, bloomThreshold: 1.2, bloomRadius: 0.5, vignette: 0.55,
        exposure: 1 + 0.05 * flipK + 0.2 * ship,
        flash: 0.5 * Math.exp(-since(t, bt(14)) / 0.14) + 0.55 * ship + 0.35 * ease.inExpo(clamp((t - bt(18) + 0.1) / 0.1)), flashColor: ship > 0.2 ? [1, 1, 1] : [1, 0.55, 0.25],
        zoomBlur: 0.18 * push,
      };
    },
    hud(h, f) {
      const t = f.t;
      const cap = (label, text, a0, a1) => hudCaption(h, label, text, clamp((t - a0) / 0.3) * clamp((a1 - t) / 0.3));
      cap('FINAL CHECK', 'Check-all runs the full Playwright suite over the finished app.', bt(14, 0.5), bt(16) - 0.05);
      cap('FINAL REPAIR', 'Fix-all repairs whatever is still red.', bt(16), bt(17) - 0.05);
      cap('DELIVERY', 'Ship the best full-suite state, not whatever state the run ends in.', bt(17), bt(17, 3.4));
    },
  };
}
