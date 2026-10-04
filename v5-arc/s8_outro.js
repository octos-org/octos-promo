// S8 52.5–60 s (bars 28–32): the OCTOS README logo rebuilt as voxels on the factory floor — cubes stream in on the
// 16th grid and lock, orange box-drawing beams light behind; final hit on bar 30 (56.25): "× ARC-BENCH" slams in,
// then the repo URL. Fade out 58.6–60.
import * as THREE from 'three';
import { C, CSS, BONE, ORANGE, GREEN, typeMat, kinetic, envMap, camLook, since, gridPulse, keyLight, keys, posterPlane, bt, S16, BEAT } from './lib.js';
import { ease, clamp, lerp } from '../engine/util.js';
import { getTS } from './common.js';
import { buildLogo, logoMeshes } from './voxel.js';
import { floor } from './factory.js';

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.fog = new THREE.Fog(C.ink.clone(), 80, 160);
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.35;
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 800);

  const FLOOR = -13.2;
  const fl = floor(scene, { size: 600, y: FLOOR, cell: 4 });
  keyLight(scene, { intensity: 2.2, pos: [-18, 26, 30], target: [0, -3, 0], size: 36 });
  const rim = new THREE.DirectionalLight(0xffd9b8, 1.0); rim.position.set(16, 12, -20); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xb0bcc8, 0x111111, 0.45));

  const logo = buildLogo({ seed: 26 });
  const cubeMat = new THREE.MeshPhysicalMaterial({ color: 0xd6d0c4, roughness: 0.45, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.35, envMapIntensity: 0.6 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff4a0a, emissiveIntensity: 2.0, roughness: 0.4 });
  const L = logoMeshes(logo, cubeMat, beamMat, { gap: 0.9 });
  scene.add(L.cubes, L.beams);

  // cubes arrive from a conveyor stream on the left, quantised to the 16th grid, sweeping left → right
  const cols = logo.cols;
  const P = logo.cubes.map((c) => {
    const arr = bt(28, 1) + Math.round(((c.col / cols) * 5.2 + c.r4 * 1.2 + (c.row / 6) * 0.4) / (S16 / BEAT)) * S16;
    const start = new THREE.Vector3(-60 - c.r1 * 30, c.p.y + (c.r2 - 0.5) * 16, c.p.z + (c.r3 - 0.5) * 30 - 10);
    return { arr, start, spin: [c.r1 * 10, c.r2 * 10, c.r5 * 10] };
  });

  const boneT = typeMat({ face: BONE, side: 0x8a857c, rough: 0.4, clearcoat: 0.3, flatFace: 0.9 });
  const orT = typeMat({ face: ORANGE, side: 0x9a3208, rough: 0.4, clearcoat: 0.2, flatFace: 0.92 });
  const grT = typeMat({ face: GREEN, side: 0x137a3d, rough: 0.4, clearcoat: 0.2, flatFace: 0.92 });
  const x = kinetic(ts, 'AX', '×', orT, { size: 1.9, depth: 0.4 });
  const arc = kinetic(ts, 'AX', 'ARC-BENCH', boneT, { size: 1.9, depth: 0.45, tracking: 0.01 });
  const gap = 1.1;
  const totalW = 1.4 + gap + arc.width;
  x.group.position.set(-totalW / 2 + 0.7, -8.8, 1.5);
  arc.group.position.set(-totalW / 2 + 1.4 + gap + arc.width / 2, -8.8, 1.5);
  scene.add(x.group, arc.group);
  const url = kinetic(ts, 'PM', 'github.com/octos-org/octos-arc', grT, { size: 1.0, depth: 0.15, tracking: 0.0 });
  url.group.position.set(0, -11.4, 1.5);
  scene.add(url.group);

  const V = new THREE.Vector3();
  const HIT = bt(30);
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      const hit = since(t, HIT);
      const pop = hit < 1e8 ? Math.exp(-hit / 0.2) * Math.sin(Math.min(hit, 0.6) * 18) : 0;
      logo.cubes.forEach((c, i) => {
        const q = P[i];
        const u = clamp((t - (q.arr - 0.7)) / 0.7);
        const e = ease.outExpo(u);
        V.copy(q.start).lerp(c.p, e);
        if (pop) V.z += pop * (0.6 + c.r3 * 0.8) * (1 + Math.sin(c.col * 0.7 + c.row * 1.3) * 0.3);
        const r = 1 - e;
        L.setCube(i, V, q.spin[0] * r, q.spin[1] * r, q.spin[2] * r, t >= q.arr - 0.7 ? 1 : 1e-3);
      });
      logo.beams.forEach((b, i) => {
        const k = ease.outExpo(clamp((t - (bt(29, 2) + (b.col / cols) * 0.8)) / 0.3));
        V.copy(b.p);
        if (pop) V.z -= pop * 0.4;
        L.setBeam(i, V, 0, 0, 0, b.s, Math.max(1e-3, k));
      });
      L.commit();
      beamMat.emissiveIntensity = 2.0 + 1.4 * Math.exp(-hit / 0.25) + 0.3 * gridPulse(t, bt(28), HIT, BEAT, 0.1);

      const slam = (k, t0, dy) => k.glyphs.forEach((g, i) => {
        const g0 = t0 + i * 0.022;
        const e = ease.outExpo(clamp((t - g0) / 0.32));
        g.mesh.visible = t >= g0; g.mesh.position.y = g.y + (1 - e) * dy; g.mesh.rotation.x = (1 - e) * -1.2;
      });
      slam(x, HIT, 1.4);
      slam(arc, HIT + 0.04, 1.4);
      url.glyphs.forEach((g, i) => { g.mesh.visible = t >= HIT + 0.55 + i * 0.03; });

      // camera: tracks the stream from the left, settles frontal for the lock, slow push after the hit
      const p = keys(t, [[bt(28), [-34, 6, 44]], [bt(29, 2), [-8, 2, 60], ease.inOutCubic], [HIT, [0, -1.5, 66], ease.outCubic], [60, [0, -2.0, 58], ease.inOutCubic]]);
      const look = keys(t, [[bt(28), [-16, 0, 0]], [bt(29, 2), [-2, -1.8, 0], ease.inOutCubic], [HIT, [0, -3.6, 0], ease.outCubic], [60, [0, -3.8, 0]]]);
      camLook(cam, p, look, keys(t, [[bt(28), -0.06], [bt(29, 2), 0]]));
      cam.fov = 30; cam.updateProjectionMatrix();
      const beat = gridPulse(t, bt(28), HIT, BEAT, 0.1);
      return {
        bloom: 0.7, bloomThreshold: 2.0, bloomRadius: 0.55, vignette: 0.5,
        exposure: 1 + 0.03 * beat + 0.15 * Math.exp(-hit / 0.3),
        flash: 0.6 * Math.exp(-since(t, bt(28)) / 0.14) + 0.45 * Math.exp(-hit / 0.08), flashColor: [1, 0.5, 0.2],
        zoomBlur: 0.08 * Math.exp(-hit / 0.2) + 0.1 * Math.exp(-since(t, bt(28)) / 0.2),
        shake: [0.005 * Math.exp(-hit / 0.15) * Math.sin(t * 120), 0.005 * Math.exp(-hit / 0.15) * Math.cos(t * 100)],
      };
    },
  };
}
