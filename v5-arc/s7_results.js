// S7 45–52.5 s (bars 24–28): results.
// A (bars 24–26): full marks on the three small tracks — three glass columns fill green on beats 24.0 / 24.1 / 24.2.
// B (bars 26–28): Web track, submission 5f93e1548ec3 — BOOKSTACK 34/34 = 100% (bar 26), KEEP 28/32 = 87.5% (bar 27).
import * as THREE from 'three';
import { C, CSS, LC, BONE, ORANGE, GREEN, typeMat, kinetic, envMap, camLook, keys, since, keyLight, bt, BEAT, S16, hudCaption, flat, gridPulse } from './lib.js';
import { ease, clamp, lerp } from '../engine/util.js';
import { getTS } from './common.js';
import { floor, steelMat } from './factory.js';

const SMALL = ['SMOKE', 'SMOKE EVOLUTION', 'TICKET BOOKING'];
const BX = 24; // x of the web-results area

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.fog = new THREE.Fog(C.ink.clone(), 40, 90);
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.35;
  const cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 300);

  floor(scene, { size: 300, cell: 1.5 });
  keyLight(scene, { intensity: 1.8, pos: [-8, 20, 18], target: [10, 0, 0], size: 30, map: 4096 });
  scene.add(new THREE.HemisphereLight(0x8a98a8, 0x101010, 0.4));

  const sm = steelMat();
  const bone = typeMat({ face: BONE, side: 0x6b6760, rough: 0.4, clearcoat: 0.3, flatFace: 0.85 });
  const greenT = typeMat({ face: GREEN, side: 0x137a3d, rough: 0.4, clearcoat: 0.3, flatFace: 0.88 });
  const orangeT = typeMat({ face: ORANGE, side: 0x9a3208, rough: 0.4, clearcoat: 0.3, flatFace: 0.9 });
  const fillMat = new THREE.MeshStandardMaterial({ color: 0x0a3a1c, emissive: flat(GREEN), emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xaecbd6, roughness: 0.06, transparent: true, opacity: 0.1, clearcoat: 1, envMapIntensity: 2, side: THREE.DoubleSide, depthWrite: false });

  // ---- A: three columns
  const H = 4.6, R = 0.85, NSEG = 12;
  const cols = SMALL.map((name, i) => {
    const x = (i - 1) * 5.2;
    const g = new THREE.Group(); g.position.set(x, 0, 0); scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.35, R * 1.45, 0.35, 48), sm); base.position.y = 0.175; base.castShadow = true; base.receiveShadow = true; g.add(base);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.2, R * 1.2, 0.18, 48), sm); cap.position.y = 0.35 + H + 0.09; g.add(cap);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 48, 1, true), glass); tube.position.y = 0.35 + H / 2; tube.renderOrder = 5; g.add(tube);
    const segs = [];
    for (let k = 0; k < NSEG; k++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.9, H / NSEG * 0.86, 40), fillMat);
      s.position.y = 0.35 + (k + 0.5) * H / NSEG; s.castShadow = true; g.add(s); segs.push(s);
    }
    const pct = kinetic(ts, 'AX', '100%', greenT, { size: 0.95, depth: 0.3, tracking: 0.0 });
    pct.group.position.set(0, 0.35 + H + 0.95, 0); g.add(pct.group);
    const labSize = Math.min(...SMALL.map((n) => Math.min(0.5, 4.4 / ts.layout('AB', n, { tracking: 0.02 }).width)));
    const lab = kinetic(ts, 'AB', name, bone, { size: labSize, depth: 0.12, tracking: 0.02 });
    lab.group.position.set(0, 0.3, R * 1.5 + 0.2); g.add(lab.group);
    return { g, segs, pct, lab, t0: bt(24, i) };
  });
  const fm = kinetic(ts, 'AX', 'FULL MARKS', bone, { size: 0.7, depth: 0.25, tracking: 0.02 });
  fm.group.position.set(0, 7.85, -0.3); scene.add(fm.group);

  // ---- B: web results boards
  const tileGeo = new THREE.BoxGeometry(0.46, 0.46, 0.08);
  const tileOn = new THREE.MeshBasicMaterial({ color: flat(GREEN) });
  const tileOff = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.4 });
  const mkBoard = (name, total, pass, pctStr, cx, t0, perRow) => {
    const g = new THREE.Group(); g.position.set(cx, 0, 0); scene.add(g);
    const rows = Math.ceil(total / perRow);
    const bw = perRow * 0.56 + 0.5, bh = rows * 0.56 + 0.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.2), new THREE.MeshStandardMaterial({ color: 0x131417, roughness: 0.7, metalness: 0.4 }));
    const by = 1.75 + bh / 2; back.position.set(0, by, -0.15); back.castShadow = true; g.add(back);
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, by, 0.3), sm); leg.position.set(sx * (bw / 2 - 0.3), by / 2, -0.2); g.add(leg); }
    const tiles = [];
    for (let k = 0; k < total; k++) {
      const r = Math.floor(k / perRow), c = k % perRow;
      const m = new THREE.Mesh(tileGeo, tileOff);
      m.position.set((c - (perRow - 1) / 2) * 0.56, by + ((rows - 1) / 2 - r) * 0.56, 0);
      g.add(m); tiles.push({ m, on: k < pass, t: t0 + (k / total) * 0.4 });
    }
    const big = kinetic(ts, 'AX', pctStr, pass === total ? greenT : bone, { size: 1.25, depth: 0.4, tracking: 0.0 });
    big.group.position.set(0, by + bh / 2 + 1.55, 0); g.add(big.group);
    const lab = kinetic(ts, 'AX', name, bone, { size: 0.62, depth: 0.2, tracking: 0.02 });
    lab.group.position.set(0, 0.95, 0.4); g.add(lab.group);
    const cnt = kinetic(ts, 'PM', `${pass} / ${total} TESTS PASSED`, orangeT, { size: 0.3, depth: 0.06, tracking: 0.04, castShadow: false });
    cnt.group.position.set(0, by + bh / 2 + 0.5, 0); g.add(cnt.group);
    return { g, tiles, big, lab, cnt, t0 };
  };
  const bs = mkBoard('BOOKSTACK', 34, 34, '100%', BX - 3.6, bt(26), 9);
  const kp = mkBoard('KEEP', 32, 28, '87.5%', BX + 3.6, bt(27), 8);

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      let hit = 0;
      // columns fill bottom → top in a beat
      cols.forEach((c) => {
        c.segs.forEach((s, k) => {
          const tk = c.t0 - 0.3 + (k / NSEG) * 0.28;
          const u = clamp((t - tk) / 0.1);
          s.visible = u > 0; s.scale.set(1, Math.max(1e-3, u), 1);
        });
        c.pct.glyphs.forEach((g, i) => {
          const g0 = c.t0 + i * 0.03;
          const e = ease.outBack(clamp((t - g0) / 0.3));
          g.mesh.visible = t >= g0; g.mesh.position.y = g.y + (1 - e) * 0.8; g.mesh.rotation.x = (1 - e) * 1.2;
        });
        hit = Math.max(hit, t >= c.t0 ? Math.exp(-(t - c.t0) / 0.15) : 0);
      });
      fillMat.emissiveIntensity = 0.35 + 0.8 * hit;
      fm.glyphs.forEach((g, i) => {
        const g0 = bt(24, 3) + i * 0.02;
        const e = ease.outExpo(clamp((t - g0) / 0.3));
        g.mesh.visible = t >= g0; g.mesh.position.y = g.y + (1 - e) * 1.2;
      });
      // boards
      for (const b of [bs, kp]) {
        let flipK = 0;
        b.tiles.forEach((q) => {
          const u = clamp((t - q.t) / 0.15);
          if (q.on) { q.m.material = u > 0.5 ? tileOn : tileOff; q.m.rotation.x = u > 0 && u < 1 ? Math.sin(u * Math.PI) * 0.6 : 0; q.m.position.z = u > 0 && u < 1 ? Math.sin(u * Math.PI) * 0.2 : 0; }
          if (u > 0 && u < 1) flipK = 1;
        });
        const tb0 = b.t0 + BEAT;
        b.big.glyphs.forEach((g, i) => {
          const g0 = tb0 + i * 0.03;
          const e = ease.outBack(clamp((t - g0) / 0.3));
          g.mesh.visible = t >= g0; g.mesh.position.y = g.y + (1 - e) * 0.8; g.mesh.rotation.x = (1 - e) * 1.2;
        });
        b.cnt.glyphs.forEach((g, i) => { g.mesh.visible = t >= tb0 + 0.1 + i * 0.012; });
        b.lab.glyphs.forEach((g) => { g.mesh.visible = t >= bt(26) - 0.3; });
        hit = Math.max(hit, t >= b.t0 ? 0.6 * Math.exp(-(t - b.t0) / 0.2) : 0, t >= tb0 ? Math.exp(-(t - tb0) / 0.15) : 0);
      }
      tileOn.color.copy(flat(GREEN)).multiplyScalar(1 + 0.3 * hit);

      // camera: A frontal push → whip pan right → B frontal, slow push, flash out
      const p = keys(t, [[bt(24), [0, 4.2, 21.0]], [bt(25, 3), [0.6, 4.0, 18.5], ease.inOutCubic], [bt(26) - 0.05, [BX - 4, 4.6, 18.5], ease.inOutExpo], [bt(27, 2), [BX + 0.5, 4.5, 16.5], ease.outCubic], [bt(28), [BX + 0.8, 4.4, 14.5], ease.inCubic]]);
      const look = keys(t, [[bt(24), [0, 4.0, 0]], [bt(25, 3), [0.3, 4.0, 0], ease.inOutCubic], [bt(26) - 0.05, [BX - 1.5, 4.0, 0], ease.inOutExpo], [bt(27, 2), [BX + 0.4, 3.95, 0], ease.outCubic], [bt(28), [BX + 0.6, 3.95, 0]]]);
      camLook(cam, p, look, 0);
      const whip = Math.sin(clamp((t - (bt(26) - 0.45)) / 0.45) * Math.PI);
      cam.fov = 36; cam.updateProjectionMatrix();
      return {
        bloom: 0.75, bloomThreshold: 1.3, bloomRadius: 0.5, vignette: 0.5,
        exposure: 1 + 0.12 * hit + 0.04 * gridPulse(t, bt(24), bt(28), BEAT, 0.1),
        flash: 0.5 * Math.exp(-since(t, bt(24)) / 0.15) + 0.9 * ease.inExpo(clamp((t - bt(28) + 0.12) / 0.12)), flashColor: [1, 0.55, 0.25],
        zoomBlur: 0.12 * whip,
      };
    },
    hud(h, f) {
      const t = f.t;
      const cap = (label, text, a0, a1) => hudCaption(h, label, text, clamp((t - a0) / 0.3) * clamp((a1 - t) / 0.25));
      cap('SMALL TRACKS', 'Full marks on Smoke, Smoke Evolution and Ticket Booking.', bt(24, 1), bt(26) - 0.3);
      cap('WEB TRACK · SUBMISSION 5f93e1548ec3', 'Platform scores on arc-bench.com: bookstack 34/34, keep 28/32.', bt(26, 1), bt(28) - 0.1);
    },
  };
}
