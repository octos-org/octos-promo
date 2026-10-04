// S1 0–8 s: monumental extruded OCTOS in a dark studio. A raking spot finds the letter edges,
// the bone backdrop switches on with the kick, the camera flies through the counter of the O.
import * as THREE from 'three';
import { C, typeMat, kinetic, envMap, camLook, keys, since, gridPulse } from './lib.js';
import { ease, clamp, lerp, prog } from '../engine/util.js';
import { getTS } from './common.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.18;
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 500);

  const S = 5;
  const mat = typeMat({ face: 0xe4ded2, side: 0x17171a, rough: 0.55, clearcoat: 0.9, env: 1 });
  const flatK = mat.userData.flatK; // faces go flat bone once the backdrop is on
  const word = kinetic(ts, 'AX', 'OCTOS', mat, { size: S, depth: 0.7, bevel: 0.008, curve: 14, tracking: -0.01, receiveShadow: true });
  scene.add(word.group);
  const O = word.glyphs[0];
  const oC = [O.x, O.y, 0];

  const mirror = new Reflector(new THREE.PlaneGeometry(400, 400), { textureWidth: 1920, textureHeight: 1080, color: 0x2a2a2a });
  mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.03;
  // a dark satin layer on top of the mirror carries the shadows / spot pool
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.6, transparent: true, opacity: 0.72, envMapIntensity: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true;
  scene.add(mirror, floor);

  const backMat = new THREE.MeshBasicMaterial({ color: C.orange.clone() });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), backMat);
  back.position.set(0, 100, -90);
  scene.add(back);

  const spot = new THREE.SpotLight(0xfff1e0, 60, 80, 0.3, 0.4, 1.2);
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.02;
  scene.add(spot, spot.target);
  const rim = new THREE.DirectionalLight(0xffe2c8, 0);
  rim.position.set(-10, 25, -40); rim.castShadow = true; rim.shadow.mapSize.set(2048, 2048);
  Object.assign(rim.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0);
  fill.position.set(8, 6, 30);
  scene.add(fill);

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      // backdrop / lights
      const on = clamp((t - 4.0) / 0.04);
      const beat = gridPulse(t, 4, 8, 0.5, 0.1);
      backMat.color.copy(C.orange).multiplyScalar(on * (0.9 + 0.1 * beat));
      rim.intensity = on * 1.2;
      flatK.value = on * 0.55;
      fill.intensity = on * 1.1;
      scene.environmentIntensity = 0.12 + on * 0.25;
      // spot rakes across the letters in the dark, then eases up to a top light
      const sx = keys(t, [[0, 26], [4, -12, ease.inOutCubic], [8, -4]]);
      spot.position.set(sx, keys(t, [[0, 3], [4, 7], [8, 20]]), 9);
      spot.target.position.set(sx * 0.4 - 2, 2.5, 0);
      spot.intensity = keys(t, [[0, 0], [0.8, 70], [4, 70], [4.05, 40]]);

      // camera
      let p, look, roll = 0, fov = 30;
      if (t < 4) {
        const u = t / 4;
        p = [lerp(20, 4, ease.inOutCubic(u)), lerp(0.8, 2.6, u), lerp(6.5, 8.5, u)];
        look = [lerp(10, -6, ease.inOutCubic(u)), lerp(2.2, 3.2, u), 0];
        roll = lerp(-0.08, 0.04, u);
        fov = 34;
      } else if (t < 6) {
        const u = (t - 4) / 2;
        p = [lerp(6, 3, ease.outCubic(u)), lerp(1.2, 2.0, u), lerp(40, 34, ease.outCubic(u))];
        look = [lerp(0.5, 0.5, u), 3.2, 0];
        roll = lerp(0.03, 0, u);
      } else {
        const u = (t - 6) / 2;
        const e = ease.inExpo(u);
        const a = [3, 2.0, 34], b = [oC[0], oC[1], -1.5];
        p = [lerp(a[0], b[0], ease.inOutCubic(Math.min(1, u * 1.4))), lerp(a[1], b[1], ease.inOutCubic(Math.min(1, u * 1.4))), lerp(a[2], b[2], e)];
        look = [lerp(0.5, oC[0], ease.outCubic(u)), lerp(3.2, oC[1], u), -60];
        fov = lerp(30, 38, e);
      }
      cam.fov = fov; cam.updateProjectionMatrix();
      camLook(cam, p, look, roll);
      const hit = since(t, 4.0);
      return {
        exposure: 1 + 0.6 * Math.exp(-hit / 0.25) + 0.08 * beat,
        bloom: 0.45, bloomThreshold: 2.2, vignette: 0.55,
        zoomBlur: 0.12 * ease.inExpo(clamp((t - 7.2) / 0.8)),
        flash: 0.5 * Math.exp(-hit / 0.08) * (t >= 4 ? 1 : 0), flashColor: [1, 0.97, 0.92],
      };
    },
  };
}
