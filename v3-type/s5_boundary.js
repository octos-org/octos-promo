// S5 30–36 s (the break): the architecture as a top-down Swiss diagram in 3D.
// Two slabs rise from the bone floor — YOUR APP (ink) | OCTOS (orange) — split by a glowing protocol membrane.
// The camera floats over it, then dives into the boundary as the membrane opens and fills the frame.
import * as THREE from 'three';
import { C, CSS, INK, BONE, ORANGE, OR_SIDE, typeMat, kinetic, envMap, camLook, since, gridPulse, posterPlane, keyLight, keys } from './lib.js';
import { ease, clamp, lerp } from '../engine/util.js';
import { getTS } from './common.js';

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.bone.clone();
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.7;
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 800);
  const key = keyLight(scene, { intensity: 2.6, pos: [-14, 30, 10], target: [0, 0, 0], size: 26 });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a948a, 1.1));

  const floor = posterPlane(800, 800, BONE, { shadowHex: 0x2d2a26, strength: 0.32 });
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  const SW = 11, SH = 2.4, SD = 9, GAP = 3.2;
  const slabGeo = new THREE.BoxGeometry(SW, SH, SD); slabGeo.translate(0, SH / 2, 0);
  const inkMat = new THREE.MeshPhysicalMaterial({ color: 0x060607, roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.4, envMapIntensity: 0.25 });
  const orMat = new THREE.MeshPhysicalMaterial({ color: OR_SIDE, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.4, envMapIntensity: 0.5 });
  // tops are flat poster colour (exact), sides are lit
  const topInk = new THREE.MeshBasicMaterial({ color: C.ink }), topOr = new THREE.MeshBasicMaterial({ color: C.orange });
  const L = new THREE.Mesh(slabGeo, [inkMat, inkMat, topInk, inkMat, inkMat, inkMat]);
  const R = new THREE.Mesh(slabGeo, [orMat, orMat, topOr, orMat, orMat, orMat]);
  L.position.x = -(SW + GAP) / 2; R.position.x = (SW + GAP) / 2;
  for (const s of [L, R]) { s.castShadow = true; s.receiveShadow = true; scene.add(s); }

  // exact signal orange, a touch hotter on the beat (kept below the ACES shoulder so it never turns yellow)
  const memMat = new THREE.MeshBasicMaterial({ color: C.orange.clone() });
  memMat.emissiveIntensity = 0;
  const mem = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), memMat);
  mem.castShadow = false; scene.add(mem);

  // labels lying on the slab tops (read from above, top of text towards -z)
  const lie = (grp) => { grp.rotation.x = -Math.PI / 2; return grp; };
  const lblMatBone = typeMat({ face: BONE, side: 0x9c978f, rough: 0.5, clearcoat: 0, flatFace: true });
  const lblMatInk = typeMat({ face: INK, side: 0x3a1a08, rough: 0.5, clearcoat: 0, flatFace: true });
  const mk = (font, str, mat, size, x, z, y = SH + 0.005) => {
    const k = kinetic(ts, font, str, mat, { size, depth: 0.08, bevel: 0, align: 'left', castShadow: false });
    const g = lie(new THREE.Group()); g.add(k.group); g.position.set(x, y, z); scene.add(g);
    return { g, k };
  };
  const lx = L.position.x - SW / 2 + 0.9, rx = R.position.x - SW / 2 + 0.9;
  const labels = [
    { ...mk('AB', 'YOUR APP', lblMatBone, 1.05, lx, -2.2), t0: 31.0 },
    { ...mk('PR', 'interface', lblMatBone, 0.42, lx, -0.6), t0: 31.25 },
    { ...mk('PR', 'product workflow', lblMatBone, 0.42, lx, 0.2), t0: 31.375 },
    { ...mk('AB', 'OCTOS', lblMatInk, 1.05, rx, -2.2), t0: 32.0 },
    { ...mk('PR', 'agent execution', lblMatInk, 0.42, rx, -0.6), t0: 32.25 },
    { ...mk('PR', 'runtime state', lblMatInk, 0.42, rx, 0.2), t0: 32.375 },
  ];
  // index numerals, Swiss style
  labels.push({ ...mk('PM', '01', lblMatBone, 0.36, lx, 3.6), t0: 31.0 });
  labels.push({ ...mk('PM', '02', lblMatInk, 0.36, rx, 3.6), t0: 32.0 });
  // floor caption running along the boundary line (reads bottom → top)
  const cap = kinetic(ts, 'PM', 'OUP — PROGRAMMABLE PROTOCOL BOUNDARY', lblMatInk, { size: 0.46, depth: 0.05, bevel: 0, align: 'center', castShadow: false, tracking: 0.06 });
  const capG = new THREE.Group(); capG.add(cap.group);
  capG.rotation.set(-Math.PI / 2, 0, 0);
  capG.position.set(0, 0.004, SD / 2 + 1.5);
  scene.add(capG);

  return {
    scene, camera: cam,
    tone: (t) => 'ink',
    update(f) {
      const t = f.t;
      const rise = (t0) => ease.outExpo(clamp((t - t0) / 0.7));
      L.scale.y = Math.max(0.001, rise(30.0)); R.scale.y = Math.max(0.001, rise(30.5));
      for (const l of labels) {
        const n = l.k.glyphs.length;
        l.k.glyphs.forEach((g, i) => { g.mesh.visible = t >= l.t0 + i * 0.03; });
        l.g.position.y = SH * (l.g.userData.slab ?? 1) * (l.t0 < 32 ? L.scale.y : R.scale.y) + 0.005;
      }
      cap.glyphs.forEach((g, i) => { g.mesh.visible = t >= 33.2 + i * 0.022; });
      // membrane: grows up at 33, then opens to fill the gap for the dive
      const grow = ease.outExpo(clamp((t - 33.0) / 0.6));
      const open = ease.inOutCubic(clamp((t - 35.1) / 0.7));
      mem.scale.set(lerp(0.14, GAP + 0.02, open), Math.max(0.001, (SH + 0.5) * grow), SD + 0.6);
      mem.position.set(0, mem.scale.y / 2, 0);
      memMat.color.copy(C.orange).multiplyScalar(1 + 0.25 * gridPulse(t, 33, 35, 0.5, 0.1));

      // camera: oblique float → top-down → dive into the boundary
      const p = keys(t, [[30, [-9, 22, 24]], [33, [-3, 34, 12], ease.inOutCubic], [34.8, [0, 38, 0.8], ease.inOutCubic], [36, [0, 2.4 + SH + 0.5, 0.2], ease.inExpo]]);
      const look = keys(t, [[30, [0, 0.5, 0]], [33, [0, 0, 0]], [34.8, [0, 0, 0]]]);
      const roll = keys(t, [[30, 0.0], [34.8, -0.25], [36, -Math.PI / 2, ease.inExpo]]);
      cam.fov = keys(t, [[30, 30], [34.8, 30], [36, 22, ease.inExpo]]); cam.updateProjectionMatrix();
      cam.position.set(...p);
      // for the top-down part use -z as screen-up so labels read upright
      const td = clamp((t - 32.2) / 1.6);
      cam.up.set(Math.sin(roll) * td, (1 - td), -td * Math.cos(roll)).normalize();
      if (cam.up.lengthSq() < 1e-6) cam.up.set(0, 0, -1);
      cam.lookAt(...look);
      const dive = ease.inExpo(clamp((t - 35.2) / 0.8));
      const slab = Math.min(since(t, 30), since(t, 30.5));
      return {
        bloom: 0.5, bloomThreshold: 2.0, vignette: 0.25,
        zoomBlur: 0.3 * dive,
        flash: 0.9 * ease.inExpo(clamp((t - 35.75) / 0.25)) + 0.35 * Math.exp(-since(t, 30) / 0.2), flashColor: [1, 0.42, 0.1],
        shake: [0.003 * Math.exp(-slab / 0.1) * Math.sin(t * 100), 0],
      };
    },
  };
}
