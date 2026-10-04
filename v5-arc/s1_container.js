// S1 0–7.5 s (bars 0–4): dark factory floor, an empty glass container under a work light.
// Three statement lines slam onto the wall on bars 1, 2, 3; then the camera pushes into the glass.
import * as THREE from 'three';
import { C, CSS, BONE, ORANGE, GREEN, typeMat, kinetic, envMap, camLook, keys, since, keyLight, bt, BEAT, hudCaption, flat } from './lib.js';
import { ease, clamp } from '../engine/util.js';
import { getTS } from './common.js';
import { floor, glassContainer, lightCone } from './factory.js';

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.fog = new THREE.Fog(C.ink.clone(), 30, 70);
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.3;
  const cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 300);

  floor(scene, { size: 160, cell: 1.5 });
  const key = keyLight(scene, { intensity: 1.6, pos: [8, 16, 10], target: [2, 0, 0], size: 16, map: 2048 });
  const spot = new THREE.SpotLight(0xfff0e0, 260, 30, 0.42, 0.5, 1.6);
  spot.position.set(5.6, 11, -0.9); spot.target.position.set(5.6, 0, -1.4); spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048);
  scene.add(spot, spot.target);
  scene.add(new THREE.HemisphereLight(0x8090a0, 0x101010, 0.25));
  const rim = new THREE.DirectionalLight(0xffb080, 0.6); rim.position.set(-10, 6, -12); scene.add(rim);

  const box = glassContainer(7.5, 4.4, 4.4);
  box.group.position.set(5.6, 0, -1.4);
  scene.add(box.group);
  const cone = lightCone(3.6, 10.5, 0xffe2c4, 0.16);
  cone.position.set(5.6, 11, -0.9);
  scene.add(cone);
  // floor inset inside the container: orange grid that lights on each hit
  const gridMat = new THREE.MeshBasicMaterial({ color: flat(ORANGE), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const gridGeo = new THREE.BufferGeometry();
  const gp = [];
  for (let i = -6; i <= 6; i++) { gp.push(i * 0.55, 0, -2.0, i * 0.55, 0, 2.0); }
  for (let j = -3; j <= 3; j++) { gp.push(-3.3, 0, j * 0.6, 3.3, 0, j * 0.6); }
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  const grid = new THREE.LineSegments(gridGeo, gridMat); grid.position.set(5.6, 0.02, -1.4); scene.add(grid);

  // statement lines, left of the container
  const bone = typeMat({ face: BONE, side: 0x6b6760, rough: 0.4, clearcoat: 0.3, flatFace: 0.8 });
  const green = typeMat({ face: GREEN, side: 0x137a3d, rough: 0.4, clearcoat: 0.3, flatFace: 0.85 });
  const orange = typeMat({ face: ORANGE, side: 0x9a3208, rough: 0.4, clearcoat: 0.3, flatFace: 0.85 });
  const SZ = 0.58, X0 = -9.2;
  const mk = (parts, y, t0) => {
    const grp = new THREE.Group();
    let x = 0; const glyphs = [];
    for (const [str, mat] of parts) {
      const k = kinetic(ts, 'AW', str, mat, { size: SZ, depth: 0.35, tracking: 0.02, align: 'left' });
      k.group.position.x = x; x += k.width + SZ * 0.32;
      grp.add(k.group); glyphs.push(...k.glyphs);
    }
    grp.position.set(X0, y, 2.4);
    scene.add(grp);
    return { grp, glyphs, t0 };
  };
  const lines = [
    mk([['BUILD', bone], ['A WHOLE', bone], ['WEB APP', orange]], 3.5, bt(1)),
    mk([['INSIDE', bone], ['A CONTAINER', bone]], 2.55, bt(2)),
    mk([['GRADED BY', bone], ['PLAYWRIGHT', green]], 1.6, bt(3)),
  ];

  const hits = [bt(1), bt(2), bt(3)];
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      let hk = 0; for (const h of hits) hk = Math.max(hk, t >= h ? Math.exp(-(t - h) / 0.18) : 0);
      for (const L of lines) {
        L.glyphs.forEach((g, i) => {
          const t0 = L.t0 + i * 0.012;
          const e = ease.outExpo(clamp((t - t0) / 0.32));
          g.mesh.visible = t >= t0;
          g.mesh.position.y = g.y + (1 - e) * 1.4;
          g.mesh.rotation.x = (1 - e) * 1.3;
          g.mesh.position.z = (1 - e) * 0.8;
        });
      }
      gridMat.opacity = 0.08 + 0.9 * hk;
      spot.intensity = 220 + 160 * hk;
      cone.material.uniforms.k.value = 0.9 + 0.8 * hk;
      box.castMat.emissiveIntensity = 0.15 + 1.5 * hk;

      // camera: slow crane from high/right down to a 3/4 frontal, then a push into the glass
      const p = keys(t, [[0, [9, 7.5, 17]], [bt(1), [4, 4.6, 18.5], ease.inOutCubic], [bt(3), [0.6, 3.4, 17.5], ease.inOutCubic], [bt(3, 3), [0.3, 3.2, 16.2], ease.outCubic], [bt(4), [5.5, 2.4, 1.8], ease.inExpo]]);
      const look = keys(t, [[0, [2, 1.6, 0]], [bt(1), [-0.8, 2.4, 0]], [bt(3), [-1.0, 2.3, 0], ease.inOutCubic], [bt(3, 3), [-0.8, 2.3, 0]], [bt(4), [5.6, 2.2, -3.4], ease.inExpo]]);
      camLook(cam, p, look, keys(t, [[0, 0.05], [bt(1), 0.0]]));
      const push = ease.inExpo(clamp((t - bt(3, 3)) / BEAT));
      cam.fov = 34 + 26 * push; cam.updateProjectionMatrix();
      return {
        bloom: 0.7, bloomThreshold: 1.6, bloomRadius: 0.5, vignette: 0.6,
        exposure: 1 + 0.12 * hk,
        zoomBlur: 0.2 * push, zoomCenter: [0.62, 0.5],
        flash: 0.9 * ease.inExpo(clamp((t - bt(4) + 0.12) / 0.12)), flashColor: [1, 0.55, 0.25],
      };
    },
    hud(h, f) {
      const t = f.t;
      const a = clamp((t - 1.0) / 0.5) * clamp((bt(3, 3) - t) / 0.3);
      hudCaption(h, 'THE TASK', 'A requirements tree in, a running web app out, scored by Playwright tests.', a);
    },
  };
}
