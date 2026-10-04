// S2 8–16 s: bone studio. ~2.5k ink voxels fly in on the 16th grid and lock into the README logo;
// orange box-drawing beams trace its shadow; the tagline folds up off the floor; then it all blows at the camera.
import * as THREE from 'three';
import { C, ORANGE, INK, typeMat, kinetic, envMap, camLook, keys, since, gridPulse, posterPlane, keyLight, S16 } from './lib.js';
import { ease, clamp, lerp } from '../engine/util.js';
import { getTS } from './common.js';
import { buildLogo, logoMeshes } from './voxel.js';

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.bone.clone();
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.9;
  const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 600);

  const FLOOR = -9;
  const floor = posterPlane(600, 600, 0xece7dc, { shadowHex: 0x2a2724, strength: 0.28 });
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR;
  const wall = posterPlane(600, 300, 0xe6e0d4, { shadowHex: 0x2a2724, strength: 0.28 });
  wall.position.set(0, 140, -4.2);
  scene.add(floor, wall);

  const key = keyLight(scene, { intensity: 3.2, pos: [-16, 26, 22], target: [0, -2, 0], size: 34 });
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d0c0, 1.2));

  const logo = buildLogo({ seed: 11 });
  const cubeMat = new THREE.MeshPhysicalMaterial({ color: 0x121215, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.8 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 0.4 });
  const L = logoMeshes(logo, cubeMat, beamMat, { gap: 0.9 });
  scene.add(L.cubes, L.beams);

  // per-cube choreography (seeded, precomputed)
  const cols = logo.cols;
  const P = logo.cubes.map((c) => {
    const th = c.r1 * Math.PI * 2, ph = Math.acos(2 * c.r2 - 1);
    const R = 18 + 26 * c.r3;
    const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.6, Math.sin(ph) * Math.sin(th) * 0.5 - 0.1);
    const start = c.p.clone().addScaledVector(dir, R);
    // arrival quantised to the 16th grid, sweeping left → right with jitter
    const arr = 8.5 + Math.round(((c.col / cols) * 3.6 + c.r4 * 0.9) / S16) * S16;
    const out = new THREE.Vector3((c.p.x) * 0.04 + (c.r1 - 0.5) * 1.2, (c.r2 - 0.5) * 1.0, 1.4 + c.r3);
    return { start, arr, rot: [c.r1 * 9, c.r2 * 9, c.r3 * 9], out: out.normalize() };
  });

  // tagline folds up off the floor, one word per beat
  const tagMat = typeMat({ face: INK, side: 0xff6a1a, rough: 0.35, clearcoat: 0.8, flatFace: true });
  const words = ['AGENTIC', 'OPERATING', 'SYSTEM'];
  const tagSize = 1.45;
  const lay = ts.layout('AB', words.join(' '), { tracking: 0.01 });
  // split the laid-out line into words so spacing/kerning comes from the whole line
  const wordGroups = [];
  let gi = 0;
  const allGlyphs = kinetic(ts, 'AB', words.join(' '), tagMat, { size: tagSize, depth: 0.35, tracking: 0.01 });
  words.forEach((w, wi) => {
    const grp = new THREE.Group();
    const n = w.length;
    const gl = allGlyphs.glyphs.slice(gi, gi + n); gi += n;
    const x0 = Math.min(...gl.map((g) => g.x));
    grp.position.set(x0, FLOOR + 0.001, 4.0);
    for (const g of gl) { g.mesh.position.x = g.x - x0; g.mesh.position.y = g.y; grp.add(g.mesh); }
    scene.add(grp);
    wordGroups.push({ grp, t0: 14.0 + wi * 0.5 });
  });

  const V = new THREE.Vector3();
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      const blow = ease.inExpo(clamp((t - 15.5) / 0.5));
      logo.cubes.forEach((c, i) => {
        const q = P[i];
        const u = clamp((t - (q.arr - 0.6)) / 0.6);
        const e = ease.outExpo(u);
        const drift = (t - 8) * 0.6;
        V.copy(q.start).addScaledVector(q.out, -drift * 0.3).lerp(c.p, e);
        const land = gridPulse(t, q.arr, q.arr, 1, 0.08) * (t >= q.arr ? 1 : 0);
        V.z += land * 0.25;
        if (blow > 0) V.addScaledVector(q.out, blow * (40 + 40 * c.r5));
        const r = 1 - e + blow * 0.6;
        L.setCube(i, V, q.rot[0] * r, q.rot[1] * r, q.rot[2] * r, 1);
      });
      logo.beams.forEach((b, i) => {
        const k = ease.outExpo(clamp((t - (12.0 + (b.col / cols) * 1.5)) / 0.4));
        V.copy(b.p);
        if (blow > 0) V.z += blow * 50 * (0.5 + b.r1);
        L.setBeam(i, V, 0, 0, 0, b.s, Math.max(1e-3, k));
      });
      L.commit();
      for (const w of wordGroups) {
        const u = clamp((t - w.t0) / 0.3);
        w.grp.rotation.x = -Math.PI / 2 * (1 - ease.outBack(u));
        w.grp.visible = t >= w.t0 - 0.01;
        w.grp.position.z = 4.0 + blow * 40;
      }

      // camera: low grazing angle along the wall → frontal
      const p = keys(t, [[8, [30, -5, 13]], [11, [16, -3.5, 30], ease.inOutCubic], [13.5, [2, -0.5, 56], ease.inOutCubic], [16, [0, -1.6, 51], ease.outCubic]]);
      const look = keys(t, [[8, [4, -1, 0]], [11, [2, -1, 0], ease.inOutCubic], [13.5, [0, -1.5, 0], ease.inOutCubic], [16, [0, -2.6, 0]]]);
      const roll = keys(t, [[8, -0.12], [11, -0.03], [13.5, 0]]);
      cam.fov = 32; cam.updateProjectionMatrix();
      camLook(cam, p, look, roll);
      const k8 = since(t, 8);
      const beat = gridPulse(t, 8, 16, 0.5, 0.1);
      return {
        bloom: 0.55, bloomThreshold: 2.4, bloomRadius: 0.4, vignette: 0.25, grain: 0.04,
        exposure: 1 + 0.03 * beat,
        flash: Math.exp(-k8 / 0.12) * 0.9 + 0.8 * ease.inExpo(clamp((t - 15.8) / 0.2)), flashColor: [1, 0.42, 0.1],
        zoomBlur: 0.25 * blow,
        shake: [0.002 * Math.sin(t * 90) * blow, 0.002 * Math.cos(t * 77) * blow],
      };
    },
  };
}
