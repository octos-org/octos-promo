// S3 16–22 s: the one-line definition, one bar per poster, colour field flips on each downbeat.
//  A 16–18 orange: AN EMBEDDABLE — glyphs lie flat on the page and stand up on the 16ths, hard shadows.
//  B 18–20 ink:    AI AGENT / HARNESS — glyphs fly in from behind the camera, word per beat.
//  C 20–22 bone:   KERNEL — deep extrusion, camera orbits; WRITTEN IN RUST. slides in.
import * as THREE from 'three';
import { C, INK, BONE, ORANGE, OR_SIDE, typeMat, kinetic, envMap, camLook, keys, since, gridPulse, posterPlane, keyLight, S16, orbit } from './lib.js';
import { ease, clamp, lerp, mulberry32 } from '../engine/util.js';
import { getTS } from './common.js';

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.orange.clone();
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.8;
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 800);
  const key = keyLight(scene, { intensity: 3.0, pos: [-14, 24, 16], target: [0, 0, 0], size: 40 });
  const hemi = new THREE.HemisphereLight(0xffffff, 0x808080, 1.0);
  scene.add(hemi);

  // ---- A: AN EMBEDDABLE on orange ----
  const A = new THREE.Group(); scene.add(A);
  const floorA = posterPlane(800, 800, ORANGE, { shadowHex: 0x6a1a00, strength: 0.45 });
  floorA.rotation.x = -Math.PI / 2; A.add(floorA);
  const matA = typeMat({ face: INK, side: 0x2a2a2e, rough: 0.4, clearcoat: 0.7, flatFace: 0.7 });
  const lineA1 = kinetic(ts, 'AX', 'AN', matA, { size: 2.0, depth: 0.3, tracking: -0.01, align: 'left' });
  const lineA2 = kinetic(ts, 'AX', 'EMBEDDABLE', matA, { size: 2.0, depth: 0.3, tracking: -0.01, align: 'left' });
  // Swiss left alignment: both lines share the left edge
  const leftA = -lineA2.width / 2;
  const standA = [];
  [[lineA1, 4.3], [lineA2, 0]].forEach(([ln, zRow], li) => {
    ln.glyphs.forEach((g, k) => {
      const piv = new THREE.Group();
      piv.position.set(leftA + g.x, 0, -zRow);
      g.mesh.position.set(0, g.y, 0);
      piv.add(g.mesh); A.add(piv);
      standA.push({ piv, t0: 16.0 + (li === 0 ? k : 2 + k) * S16 });
    });
  });

  // ---- B: AI AGENT / HARNESS on ink ----
  const B = new THREE.Group(); scene.add(B);
  const floorB = posterPlane(800, 800, INK, { shadowHex: 0x000000, strength: 0.6 });
  floorB.rotation.x = -Math.PI / 2; floorB.position.y = -4.2; B.add(floorB);
  const matB = typeMat({ face: 0xece7dc, side: OR_SIDE, rough: 0.3, clearcoat: 1, flatFace: 0.5 });
  const bWords = [['AI', 18.0, 0], ['AGENT', 18.5, 0], ['HARNESS', 19.0, 1]];
  const bLine1 = kinetic(ts, 'AX', 'AI AGENT', matB, { size: 2.7, depth: 0.5, align: 'left' });
  const bLine2 = kinetic(ts, 'AX', 'HARNESS', matB, { size: 2.7, depth: 0.5, align: 'left' });
  const leftB = -Math.max(bLine1.width, bLine2.width) / 2;
  const flyB = [];
  const rnd = mulberry32(5);
  const placeLine = (ln, y, t0s) => {
    const off = leftB;
    ln.glyphs.forEach((g, k) => {
      const home = new THREE.Vector3(g.x + off, g.y + y, 0);
      const from = new THREE.Vector3((rnd() - 0.5) * 30, (rnd() - 0.5) * 16, 30 + rnd() * 20);
      flyB.push({ m: g.mesh, home, from, t0: t0s(k) + k * 0.03, rot: [(rnd() - 0.5) * 6, (rnd() - 0.5) * 6, (rnd() - 0.5) * 3] });
      B.add(g.mesh);
    });
  };
  placeLine(bLine1, 1.75, (k) => (k < 2 ? 18.0 : 18.5));
  placeLine(bLine2, -1.75, () => 19.0);

  // ---- C: KERNEL on bone ----
  const Cg = new THREE.Group(); scene.add(Cg);
  const floorC = posterPlane(800, 800, BONE, { shadowHex: 0x3a3530, strength: 0.3 });
  floorC.rotation.x = -Math.PI / 2; Cg.add(floorC);
  const matC = typeMat({ face: INK, side: OR_SIDE, rough: 0.35, clearcoat: 0.8, flatFace: 0.6 });
  const kern = kinetic(ts, 'AX', 'KERNEL', matC, { size: 3.6, depth: 1.2, bevel: 0.006, curve: 8 });
  kern.group.position.set(0, 0, 0);
  Cg.add(kern.group);
  const matR = typeMat({ face: ORANGE, side: 0xb8420a, rough: 0.4, clearcoat: 0.5, flatFace: true });
  const rust = kinetic(ts, 'AB', 'WRITTEN IN RUST.', matR, { size: 1.0, depth: 0.35, tracking: 0.01 });
  Cg.add(rust.group);
  // split into words for staggered entrances
  const rustWords = [[0, 7, 21.0], [7, 9, 21.25], [9, 14, 21.5]];

  const V = new THREE.Vector3();
  const obj = {
    scene, camera: cam,
    tone: (t) => (t < 18 ? 'ink' : t < 20 ? 'bone' : 'ink'),
    update(f) {
      const t = f.t;
      const shot = t < 18 ? 0 : t < 20 ? 1 : 2;
      A.visible = shot === 0; B.visible = shot === 1; Cg.visible = shot === 2;
      scene.background.copy([C.orange, C.ink, C.bone][shot]);
      let p, look, roll = 0;
      if (shot === 0) {
        for (const s of standA) {
          const u = clamp((t - s.t0) / 0.28);
          s.piv.rotation.x = -Math.PI / 2 * (1 - ease.outBack(u));
        }
        const u = (t - 16) / 2;
        p = [lerp(-4, 1, u), lerp(36, 17, ease.inOutCubic(u)), lerp(12, 30, ease.inOutCubic(u))];
        look = [lerp(-0.5, 0, u), lerp(0, 1.2, u), -1.9];
        roll = lerp(0.1, 0.0, ease.inOutCubic(u));
        key.position.set(-14, 20, 14);
      } else if (shot === 1) {
        for (const g of flyB) {
          const u = clamp((t - g.t0) / 0.35);
          const e = ease.outExpo(u);
          g.m.position.lerpVectors(g.from, g.home, e);
          g.m.rotation.set(g.rot[0] * (1 - e), g.rot[1] * (1 - e), g.rot[2] * (1 - e));
          g.m.visible = t >= g.t0;
        }
        const u = (t - 18) / 2;
        const yaw = lerp(0.35, -0.12, ease.outCubic(u));
        p = orbit([0, 0, 0], lerp(34, 30, u), yaw, lerp(0.05, 0.12, u));
        look = [0, 0, 0];
        roll = lerp(-0.05, 0.0, u);
        key.position.set(-10, 18, 20);
      } else {
        const u = (t - 20) / 2;
        kern.group.position.y = kern.glyphs[0].y * 0 + 0.0;
        // KERNEL stands on the floor: shift so baseline sits at y=0
        const yaw = lerp(1.05, 0.12, ease.outCubic(Math.min(1, u * 1.2)));
        p = orbit([0, 2.0, 0], lerp(34, 44, ease.inOutCubic(u)), yaw, lerp(0.08, 0.2, u));
        look = [0, lerp(2.0, 0.8, ease.inOutCubic(u)), 1.5];
        rust.group.position.set(0, 0, 9.5);
        for (const [a, b, t0] of rustWords) {
          const e = ease.outExpo(clamp((t - t0) / 0.3));
          for (let k = a; k < Math.min(b, rust.glyphs.length); k++) {
            const g = rust.glyphs[k];
            g.mesh.position.set(g.x, g.y - (1 - e) * 1.6, 0);
            g.mesh.rotation.x = 0;
            g.mesh.visible = t >= t0;
          }
        }
        key.position.set(-16, 22, 18);
      }
      cam.fov = 30; cam.updateProjectionMatrix();
      camLook(cam, p, look, roll);
      const beat = gridPulse(t, 16, 22, 0.5, 0.1);
      const cut = Math.min(since(t, 16), since(t, 18), since(t, 20));
      const whip = ease.inExpo(clamp((t - 21.7) / 0.3));
      return {
        bloom: 0.3, bloomThreshold: 3, vignette: 0.22,
        exposure: 1 + 0.02 * beat,
        flash: 0.6 * Math.exp(-cut / 0.07), flashColor: [1, 1, 1],
        zoomBlur: 0.05 * Math.exp(-cut / 0.12) + 0.35 * whip,
        shake: [0.004 * Math.exp(-cut / 0.1) * Math.sin(t * 120), 0],
      };
    },
  };
  // KERNEL glyph baseline: kinetic() puts baseline at y=0 already.
  return obj;
}
