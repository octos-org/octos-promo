// S3 15–26.25 s (bars 8–14): the factory at work. Left: the app assembles inside the glass container, one block per
// requirement. Right: the kernel's pipeline graph — SEED, then IMPL n → CHECK n per requirement; a failed check takes the
// orange back-edge (REPAIR) and re-checks; every 4th requirement a regression checkpoint sweeps the container.
// Beat grid (beats from t = 0; bar 8 = beat 32) matches audio/track.py EV.
import * as THREE from 'three';
import { C, CSS, LC, BONE, ORANGE, GREEN, RED, ASH, envMap, camLook, keys, since, keyLight, bt, BEAT, hudCaption, flat, canvasTex, Lines, mul, mix3 } from './lib.js';
import { ease, clamp, lerp } from '../engine/util.js';
import { getTS } from './common.js';
import { floor, glassContainer, lightCone, uiPanel, backendBox, dbCylinder } from './factory.js';

const B = BEAT;
// requirements: impl beat, first check beat/result, optional repair + recheck
export const REQS = [
  { impl: 34, check: 35 },
  { impl: 36, check: 37 },
  { impl: 38, check: 39, fail: true, repair: 40, recheck: 41 },
  { impl: 42, check: 43 },
  { impl: 45, check: 46 },
  { impl: 47, check: 48, fail: true, repair: 49, recheck: 50 },
  { impl: 51, check: 52 },
  { impl: 53, check: 54 },
];
export const SAVES = [44, 55];
const SEED = 32;

// node face texture: white text on transparent, tinted by material colour
function nodeTex(label, sub, w = 640, h = 112) {
  return canvasTex(w, h, (g) => {
    g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#fff'; g.font = '600 54px PM'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = '4px';
    g.fillText(label, 30, h / 2 + 2);
    if (sub) { g.font = '400 34px PR'; g.textAlign = 'right'; g.globalAlpha = 0.75; g.fillText(sub, w - 28, h / 2 + 2); }
  });
}

export async function make(ctx) {
  await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.fog = new THREE.Fog(C.ink.clone(), 35, 80);
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.35;
  const cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 300);

  floor(scene, { size: 200, cell: 1.5 });
  keyLight(scene, { intensity: 1.8, pos: [-10, 18, 14], target: [-2, 0, 0], size: 18, map: 4096 });
  const spot = new THREE.SpotLight(0xfff0e0, 240, 30, 0.45, 0.5, 1.6);
  spot.position.set(-5.2, 11, 0.3); spot.target.position.set(-5.2, 0, 0); spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048);
  scene.add(spot, spot.target);
  scene.add(new THREE.HemisphereLight(0x8a98a8, 0x101010, 0.3));

  // ---------- container + blocks ----------
  const CX = -5.2;
  const box = glassContainer(7.4, 4.8, 4.4);
  box.group.position.set(CX, 0, 0);
  scene.add(box.group);
  const cone = lightCone(3.8, 10.5, 0xfff0e0, 0.12); cone.position.set(CX, 11, 0.3); scene.add(cone);

  const blocks = [];
  const add = (obj, pos, led) => { obj.position.set(...pos); scene.add(obj); blocks.push({ obj, home: new THREE.Vector3(...pos), led, rot0: obj.rotation.clone() }); };
  const db = dbCylinder(0.62, 1.5); add(db, [CX - 2.35, 0.75, -0.7], db.userData.led);
  for (let i = 0; i < 3; i++) { const b = backendBox(1.25, 1.2, 1.7); add(b, [CX - 0.85 + i * 1.45, 0.6, -0.8], b.userData.led); }
  for (let i = 0; i < 3; i++) {
    const p = uiPanel(1.95, 1.22, 11 + i * 7); p.rotation.y = (i - 1) * -0.12;
    const led = p.material[4]; add(p, [CX - 2.1 + i * 2.1, 2.55, 1.05], led);
  }
  const nav = uiPanel(5.6, 0.62, 5, { accent: CSS.green }); add(nav, [CX, 3.85, 0.4], nav.material[4]);

  // checkpoint scan plane
  const scanMat = new THREE.MeshBasicMaterial({ color: flat(GREEN), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(7.1, 4.1), scanMat); scan.rotation.x = -Math.PI / 2; scene.add(scan);

  // ---------- pipeline board ----------
  const board = new THREE.Group();
  board.position.set(1.5, 0, -0.4);
  board.rotation.y = -0.2;
  scene.add(board);
  const RH = 0.52; // row pitch
  const TOP = 6.9;
  const nodes = [];
  const mkNode = (label, sub, x, y, w, h = 0.4) => {
    const mat = new THREE.MeshBasicMaterial({ map: nodeTex(label, sub, Math.round(640 * w / 2.6)), transparent: true, depthWrite: false });
    flat(ASH, mat.color);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x + w / 2, y, 0.02);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.14, h + 0.14), glowMat);
    glow.position.set(x + w / 2, y, 0.0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.5 }));
    back.position.set(x + w / 2, y, -0.05);
    board.add(back, glow, m);
    const n = { m, mat, glowMat, glow, x, y, w, h, cx: x + w / 2, left: x, right: x + w };
    nodes.push(n);
    return n;
  };
  const seed = mkNode('SEED', null, 0, TOP, 6.0);
  const rows = [];
  let y = TOP - RH;
  REQS.forEach((r, i) => {
    const impl = mkNode(`IMPL ${i + 1}`, 'codergen', 0, y, 2.75);
    const check = mkNode(`CHECK ${i + 1}`, 'playwright', 3.25, y, 2.75);
    rows.push({ impl, check, y, r });
    y -= RH;
    if (i === 3 || i === 7) { rows[i].band = y; y -= RH; }
  });
  const finals = [mkNode('CHECK-ALL', null, 0, y, 1.85), mkNode('FIX-ALL', null, 2.07, y, 1.85), mkNode('SHIP BEST', null, 4.15, y, 1.85)];
  const bandTex = canvasTex(1400, 90, (g, w, h) => {
    g.fillStyle = '#fff'; g.font = '600 46px PM'; g.textBaseline = 'middle'; if ('letterSpacing' in g) g.letterSpacing = '6px';
    g.textAlign = 'right'; g.fillText('REGRESSION CHECKPOINT', w - 12, h / 2 + 2);
    g.fillRect(12, h / 2 - 2, 560, 4);
  });
  const bands = rows.filter((r) => r.band !== undefined).map((r, k) => {
    const mat = new THREE.MeshBasicMaterial({ map: bandTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    mat.color.setRGB(0.05, 0.05, 0.05);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 6.0 * 90 / 1400), mat); m.position.set(3.0, r.band, 0.02); board.add(m);
    return { mat, t: SAVES[k] * B };
  });
  // header
  const headTex = canvasTex(1400, 80, (g, w, h) => { g.fillStyle = '#fff'; g.font = '600 40px PM'; g.textBaseline = 'middle'; if ('letterSpacing' in g) g.letterSpacing = '8px'; g.fillText('OCTOS KERNEL · PIPELINE GRAPH', 0, h / 2); });
  const headMat = new THREE.MeshBasicMaterial({ map: headTex, transparent: true, depthWrite: false }); flat(ORANGE, headMat.color);
  const head = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 6.0 * 80 / 1400), headMat); head.position.set(3.0, TOP + 0.55, 0.02); board.add(head);

  // edges (additive lines in board space → world)
  const lines = new Lines(600, { fog: [40, 90] });
  scene.add(lines.mesh);
  const W = (x, y, z = 0.05) => board.localToWorld(new THREE.Vector3(x, y, z));
  board.updateMatrixWorld(true);

  // node state over time: returns {col:[r,g,b], k:intensity}
  const tb = (beat) => beat * B;
  const stateAt = (t) => {
    const s = new Map();
    const set = (n, col, k) => s.set(n, { col, k });
    for (const n of nodes) set(n, null, 0);
    if (t >= tb(SEED)) set(seed, 'green', 1);
    if (t >= tb(SEED) && t < tb(SEED + 1)) set(seed, 'orange', 1);
    rows.forEach(({ impl, check, r }) => {
      if (t >= tb(r.impl)) set(impl, 'orange', 1);
      if (t >= tb(r.check)) set(impl, 'bone', 0.6);
      if (t >= tb(r.check)) set(check, r.fail ? 'red' : 'green', 1);
      if (r.fail && t >= tb(r.repair)) { set(impl, 'orange', 1); set(check, 'red', 0.45); }
      if (r.fail && t >= tb(r.recheck)) { set(impl, 'bone', 0.6); set(check, 'green', 1); }
    });
    return s;
  };
  // token waypoints: [beat, node, side]
  const way = [[SEED, seed, 'seed']];
  rows.forEach(({ impl, check, r }) => {
    way.push([r.impl, impl, 'impl'], [r.check, check, r.fail ? 'fail' : 'pass']);
    if (r.fail) way.push([r.repair, impl, 'repair'], [r.recheck, check, 'pass']);
  });
  const nodePos = (n) => W(n.cx, n.y, 0.12);

  const hitsAll = [SEED, ...REQS.flatMap((r) => [r.impl, r.check, ...(r.fail ? [r.repair, r.recheck] : [])]), ...SAVES].map(tb);
  const fails = REQS.filter((r) => r.fail).map((r) => tb(r.check));
  const repairs = REQS.filter((r) => r.fail).map((r) => tb(r.repair));
  const COL = { green: LC.green, red: LC.red, orange: LC.orange, bone: LC.bone };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      // ---- blocks: drop in on impl, shake on fail, lift+respin on repair, LED colours
      REQS.forEach((r, i) => {
        const b = blocks[i];
        const t0 = tb(r.impl) - 0.2;
        const e = ease.outCubic(clamp((t - t0) / 0.3));
        b.obj.visible = t >= t0;
        b.obj.position.copy(b.home);
        b.obj.position.y += (1 - e) * 6;
        const land = t >= t0 + 0.3 ? Math.exp(-(t - t0 - 0.3) / 0.08) * Math.sin((t - t0 - 0.3) * 50) * 0.06 : 0;
        b.obj.position.y += land;
        b.obj.rotation.copy(b.rot0);
        let led = 'orange';
        if (t >= tb(r.check)) led = r.fail ? 'red' : 'green';
        if (r.fail) {
          const sk = t >= tb(r.check) && t < tb(r.repair) ? Math.exp(-(t - tb(r.check)) / 0.25) : 0;
          b.obj.position.x += Math.sin(t * 90) * 0.06 * sk;
          const rp = clamp((t - tb(r.repair)) / (B * 0.9));
          if (rp > 0 && rp < 1) { b.obj.position.y += Math.sin(rp * Math.PI) * 0.7; b.obj.rotation.y += ease.inOutCubic(rp) * Math.PI * 2; led = 'orange'; }
          if (t >= tb(r.recheck)) led = 'green';
        }
        const save = SAVES.some((s) => t >= tb(s) && t < tb(s) + 0.4 && i <= (s === 44 ? 3 : 7)) ? 1 : 0;
        const c = led === 'green' ? GREEN : led === 'red' ? RED : ORANGE;
        if (b.led.isMeshStandardMaterial) { // UI panels: emissive screen tint
          if (led === 'green') b.led.emissive.setRGB(0.85, 1, 0.9); else if (led === 'red') b.led.emissive.setRGB(1, 0.35, 0.35); else b.led.emissive.setRGB(1, 0.8, 0.65);
          b.led.emissiveIntensity = 0.7 + 0.3 * save;
        } else flat(c, b.led.color).multiplyScalar(1 + 1.2 * save);
      });

      // ---- checkpoint scan
      let scanK = 0;
      for (const s of SAVES) {
        const u = (t - tb(s)) / 0.55;
        if (u >= 0 && u <= 1) { scan.position.set(CX, 0.1 + u * 4.6, 0); scanK = Math.sin(u * Math.PI); }
      }
      scanMat.opacity = 0.35 * scanK; scan.visible = scanK > 0.001;

      // ---- board node states
      const st = stateAt(t);
      for (const n of nodes) {
        const s = st.get(n);
        let pulse = 0;
        for (const h of hitsAll) if (t >= h && t - h < 0.5) pulse = Math.max(pulse, Math.exp(-(t - h) / 0.15));
        if (s.col) {
          const c = s.col === 'green' ? GREEN : s.col === 'red' ? RED : s.col === 'orange' ? ORANGE : BONE;
          flat(c, n.mat.color).multiplyScalar(0.6 + 0.4 * s.k);
          n.glowMat.color.setRGB(...mul(COL[s.col], 0.10 * s.k));
        } else { flat(0x4a4d52, n.mat.color); n.glowMat.color.setRGB(0, 0, 0); }
      }
      // active node pop (the one whose event just fired)
      for (const [beat, n] of way) {
        const dt = t - tb(beat);
        if (dt >= 0 && dt < 0.5) n.glowMat.color.multiplyScalar(1 + 6 * Math.exp(-dt / 0.12));
      }
      for (const b of bands) {
        const on = t >= b.t ? 1 : 0;
        const k = on * (0.55 + 2.5 * Math.exp(-(t - b.t) / 0.2));
        b.mat.color.setRGB(...mul(LC.green, k)).addScalar(on ? 0 : 0.035);
      }
      finals.forEach((n) => { flat(0x33363b, n.mat.color); n.glowMat.color.setRGB(0, 0, 0); });

      // ---- edges
      lines.clear();
      const dim = [0.035, 0.037, 0.04];
      const edge = (a, b, col, w = 2.2) => lines.line(a, b, w, col);
      // seed → impl1
      edge(W(0.6, seed.y - 0.22), W(0.6, rows[0].impl.y + 0.22), t >= tb(REQS[0].impl) ? mul(LC.bone, 0.35) : dim);
      rows.forEach((row, i) => {
        const { impl, check, r } = row;
        const done = t >= tb(r.check);
        edge(W(impl.right, impl.y), W(check.left, check.y), t >= tb(r.impl) ? mul(LC.bone, 0.4) : dim);
        if (i < rows.length - 1) {
          const nx = rows[i + 1].impl;
          const lit = t >= tb(REQS[i + 1].impl);
          const ym = check.y - 0.26, col = lit ? mul(LC.green, 0.45) : dim;
          lines.poly([W(check.cx, check.y - 0.2), W(check.cx, ym), W(nx.cx, ym), W(nx.cx, nx.y + 0.2)], 1.6, col);
        }
        // repair back-edge: arc under the row from CHECK back to IMPL
        if (r.fail) {
          const on = t >= tb(r.check) ? 1 : 0;
          const hot = t >= tb(r.check) && t < tb(r.recheck) ? 1 : 0;
          const col = mul(LC.orange, on * (hot ? 1.6 + 1.2 * Math.exp(-since(t, tb(r.repair)) / 0.2) : 0.35));
          const pts = [];
          for (let k = 0; k <= 16; k++) { const u = k / 16; const x = lerp(check.cx, impl.cx, u); const yy = check.y - 0.22 - Math.sin(u * Math.PI) * 0.26; pts.push(W(x, yy, 0.1)); }
          const vis = on ? 1 : 0;
          if (vis) lines.poly(pts, hot ? 3.2 : 2.0, col);
        }
      });
      // token along waypoints
      for (let k = 1; k < way.length; k++) {
        const [b0, n0] = way[k - 1], [b1, n1, kind] = way[k];
        const t0 = tb(b0), t1 = tb(b1);
        if (t >= t0 && t < t1 + 0.05 && t <= tb(55)) {
          const u = ease.inOutCubic(clamp((t - (t0 + 0.45 * (t1 - t0))) / (0.55 * (t1 - t0))));
          tmpA.copy(nodePos(n0)); tmpB.copy(nodePos(n1));
          const p = tmpA.lerp(tmpB, u);
          const col = kind === 'repair' ? LC.orange : LC.bone;
          lines.seg(p.x - 0.001, p.y, p.z, p.x + 0.001, p.y, p.z, 16, ...mul(col, 3), 1);
          break;
        }
      }
      lines.flush();

      // ---- camera: glide from a 3/4 on SEED, follow the active rows down, pull wide for the second checkpoint
      const p = keys(t, [[bt(8), [-2.8, 5.4, 16.5]], [bt(9, 2), [-0.8, 4.9, 18.5], ease.inOutCubic], [bt(11), [0.6, 4.5, 18.6], ease.inOutCubic], [bt(12, 2), [-0.4, 4.3, 19.2], ease.inOutCubic], [bt(14), [-1.4, 5.2, 22.0], ease.inOutCubic]]);
      const look = keys(t, [[bt(8), [-1.4, 3.9, 0]], [bt(9, 2), [-0.8, 3.7, 0]], [bt(11), [-0.3, 3.4, 0], ease.inOutCubic], [bt(12, 2), [-0.6, 3.3, 0], ease.inOutCubic], [bt(14), [-0.8, 3.5, 0]]]);
      camLook(cam, p, look, 0);
      cam.fov = 36; cam.updateProjectionMatrix();

      let hk = 0; for (const h of hitsAll) if (t >= h) hk = Math.max(hk, Math.exp(-(t - h) / 0.12));
      let fk = 0; for (const h of fails) if (t >= h) fk = Math.max(fk, Math.exp(-(t - h) / 0.2));
      let sk = 0; for (const s of SAVES) if (t >= tb(s)) sk = Math.max(sk, Math.exp(-(t - tb(s)) / 0.25));
      spot.intensity = 220 + 80 * hk + 200 * sk;
      return {
        bloom: 0.75, bloomThreshold: 1.3, bloomRadius: 0.5, vignette: 0.55,
        exposure: 1 + 0.04 * hk + 0.1 * sk,
        flash: 0.5 * Math.exp(-since(t, bt(8)) / 0.15) + 0.12 * fk, flashColor: fk > 0.5 ? [1, 0.15, 0.1] : [1, 0.55, 0.25],
        shake: [0.003 * fk * Math.sin(t * 110), 0.003 * fk * Math.cos(t * 93)],
      };
    },
    hud(h, f) {
      const t = f.t;
      const cap = (label, text, a0, a1) => hudCaption(h, label, text, clamp((t - a0) / 0.3) * clamp((a1 - t) / 0.3));
      cap('ONE PIPELINE GRAPH PER TASK', 'Seed, then an implement node and a check node for every requirement.', bt(8, 1), tb(39) - 0.1);
      cap('REPAIR LOOP', 'A failed check takes the back-edge: repair, then check again.', tb(39), tb(43.6));
      cap('REGRESSION CHECKPOINT', 'Every 4th requirement, the work so far is re-verified.', tb(44), tb(48.8));
      cap('KERNEL-NATIVE', 'The loop runs inside the Octos pipeline engine, not in Python glue.', tb(49), bt(14) - 0.1);
    },
  };
}
