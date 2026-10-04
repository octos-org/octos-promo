// S8 50–60 s: the voxel logo again, inverted — bone cubes in an ink void, orange beams glowing behind.
// Cubes spiral in and lock on the 16th grid, tagline + repo URL set underneath; final hit at 56; fade out.
import * as THREE from 'three';
import { C, CSS, INK, BONE, ORANGE, typeMat, kinetic, envMap, camLook, since, gridPulse, keyLight, keys, posterPlane, S16 } from './lib.js';
import { ease, clamp, lerp } from '../engine/util.js';
import { getTS } from './common.js';
import { buildLogo, logoMeshes } from './voxel.js';

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.35;
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 800);

  const FLOOR = -12.5;
  const floor = posterPlane(900, 900, INK, { shadowHex: 0x000000, strength: 0.6 });
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; scene.add(floor);
  const wall = posterPlane(900, 400, 0x101012, { shadowHex: 0x000000, strength: 0.55 });
  wall.position.set(0, 150, -5); scene.add(wall);

  const key = keyLight(scene, { intensity: 2.2, pos: [-18, 24, 26], target: [0, -2, 0], size: 34 });
  const rim = new THREE.DirectionalLight(0xffd9b8, 1.2); rim.position.set(16, 12, -20); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 0.45));

  const logo = buildLogo({ seed: 23 });
  const cubeMat = new THREE.MeshPhysicalMaterial({ color: 0xd6d0c4, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4, envMapIntensity: 0.5 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff4a0a, emissiveIntensity: 2.0, roughness: 0.4 });
  const L = logoMeshes(logo, cubeMat, beamMat, { gap: 0.9 });
  scene.add(L.cubes, L.beams);

  const cols = logo.cols;
  const P = logo.cubes.map((c) => {
    const a0 = c.r1 * Math.PI * 2;
    const rad = 26 + c.r2 * 24;
    const arr = 50.5 + Math.round(((c.col / cols) * 1.8 + c.r4 * 1.0 + (c.row / 6) * 0.3) / S16) * S16;
    return { a0, rad, h: (c.r3 - 0.5) * 30, arr, spin: [c.r1 * 12, c.r2 * 12, c.r5 * 12] };
  });

  const tagMat = typeMat({ face: BONE, side: 0x8a857c, rough: 0.4, clearcoat: 0.3, flatFace: 0.9 });
  const tag = kinetic(ts, 'AB', 'AGENTIC OPERATING SYSTEM', tagMat, { size: 1.3, depth: 0.3, tracking: 0.03 });
  tag.group.position.set(0, -9.0, 1.5);
  scene.add(tag.group);
  const urlMat = typeMat({ face: ORANGE, side: 0x9a3208, rough: 0.4, clearcoat: 0.2, flatFace: 0.92 });
  const url = kinetic(ts, 'PM', 'github.com/octos-org/octos', urlMat, { size: 0.95, depth: 0.15, tracking: 0.0 });
  url.group.position.set(0, -11.2, 1.5);
  scene.add(url.group);

  const V = new THREE.Vector3();
  return {
    scene, camera: cam,
    tone: () => 'bone',
    update(f) {
      const t = f.t;
      const hit = since(t, 56);
      const pop = hit < 1e8 ? Math.exp(-hit / 0.2) * Math.sin(Math.min(hit, 0.6) * 18) : 0;
      logo.cubes.forEach((c, i) => {
        const q = P[i];
        const u = clamp((t - (q.arr - 0.9)) / 0.9);
        const e = ease.outExpo(u);
        const a = q.a0 + (1 - e) * 2.5 + (t - 50) * 0.4 * (1 - e);
        V.set(Math.sin(a) * q.rad, q.h, Math.cos(a) * q.rad * 0.6 - 6).lerp(c.p, e);
        if (pop) V.z += pop * (0.6 + c.r3 * 0.8) * (1 + Math.sin(c.col * 0.7 + c.row * 1.3) * 0.3);
        const r = 1 - e;
        L.setCube(i, V, q.spin[0] * r, q.spin[1] * r, q.spin[2] * r, 1);
      });
      logo.beams.forEach((b, i) => {
        const k = ease.outExpo(clamp((t - (52.2 + (b.col / cols) * 0.9)) / 0.35));
        V.copy(b.p);
        if (pop) V.z -= pop * 0.4;
        L.setBeam(i, V, 0, 0, 0, b.s, Math.max(1e-3, k));
      });
      L.commit();
      beamMat.emissiveIntensity = 2.0 + 1.2 * Math.exp(-hit / 0.25) + 0.3 * gridPulse(t, 52, 56, 0.5, 0.1);
      tag.glyphs.forEach((g, i) => {
        const t0 = 53.5 + i * 0.02;
        const e = ease.outExpo(clamp((t - t0) / 0.35));
        g.mesh.position.y = g.y - (1 - e) * 1.2; g.mesh.rotation.x = (1 - e) * -1.2; g.mesh.visible = t >= t0;
      });
      url.glyphs.forEach((g, i) => { g.mesh.visible = t >= 54.5 + i * 0.035; });

      // camera: from high above the vortex down to a frontal hero framing, slow push after the hit
      const p = keys(t, [[50, [10, 30, 40]], [53, [-4, 1, 60], ease.inOutCubic], [56, [0, -1.5, 62], ease.outCubic], [60, [0, -1.8, 55], ease.inOutCubic]]);
      const look = keys(t, [[50, [0, -2, 0]], [53, [0, -2.2, 0], ease.inOutCubic], [56, [0, -2.8, 0]], [60, [0, -2.8, 0]]]);
      camLook(cam, p, look, keys(t, [[50, 0.1], [53, 0.0]]));
      cam.fov = 30; cam.updateProjectionMatrix();
      const beat = gridPulse(t, 50, 56, 0.5, 0.1);
      return {
        bloom: 0.7, bloomThreshold: 2.2, bloomRadius: 0.55, vignette: 0.5,
        exposure: 1 + 0.03 * beat + 0.15 * Math.exp(-hit / 0.3),
        flash: 0.7 * Math.exp(-since(t, 50) / 0.12) + 0.45 * Math.exp(-hit / 0.08), flashColor: [1, 0.5, 0.2],
        zoomBlur: 0.08 * Math.exp(-hit / 0.2) + 0.1 * Math.exp(-since(t, 50) / 0.2),
        shake: [0.005 * Math.exp(-hit / 0.15) * Math.sin(t * 120), 0.005 * Math.exp(-hit / 0.15) * Math.cos(t * 100)],
      };
    },
  };
}
