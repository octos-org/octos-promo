// S6 36–44 s (the drop): OUP.
//  36–38  OUP slams in letter by letter, the spec types out under it; camera dives through the O's counter
//  38–42  corridor of JSON-RPC methods, one per beat, the camera flies through each plate
//  42–44  bone poster: ASSIGN / OBSERVE / INTERVENE / COLLECT — driving Octos from another agent
import * as THREE from 'three';
import { C, CSS, INK, BONE, ORANGE, OR_SIDE, typeMat, kinetic, envMap, camLook, since, gridPulse, posterPlane, keyLight, keys, orbit, hudText, hudRule } from './lib.js';
import { ease, clamp, lerp, mulberry32 } from '../engine/util.js';
import { getTS } from './common.js';

const METHODS = ['client_hello', 'session/open', 'turn/start', 'turn/steer', 'turn/interrupt', 'approval/respond', 'peer/gather', 'task/*'];
const WALL = ['config/capabilities/list', 'user_question/respond', 'peer/prepare', 'JSON-RPC 2.0', 'WebSocket', 'stdio', 'octos serve --stdio'];
const VERBS = ['ASSIGN', 'OBSERVE', 'INTERVENE', 'COLLECT'];

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.8;
  scene.fog = new THREE.Fog(C.ink.clone(), 1e4, 2e4);
  const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 900);
  const key = keyLight(scene, { intensity: 3.0, pos: [-10, 20, 24], target: [0, 0, 0], size: 30 });
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(hemi);

  // ---------- part 1: OUP ----------
  const P1 = new THREE.Group(); scene.add(P1);
  const oupMat = typeMat({ face: ORANGE, side: 0x9a3208, rough: 0.35, clearcoat: 0.6, flatFace: 0.8, emissive: 0xff5a14, emissiveIntensity: 0.0 });
  const oup = kinetic(ts, 'AX', 'OUP', oupMat, { size: 6, depth: 0.5, bevel: 0.006, curve: 16, tracking: 0.02 });
  P1.add(oup.group);
  const oupO = oup.glyphs[0];
  const specMat = typeMat({ face: BONE, side: 0x777777, rough: 0.5, clearcoat: 0, flatFace: true });
  const spec1 = kinetic(ts, 'PM', 'OCTOS UI PROTOCOL', specMat, { size: 0.62, depth: 0.08, bevel: 0, tracking: 0.12 });
  const spec2 = kinetic(ts, 'PR', 'JSON-RPC 2.0  ·  WebSocket  ·  stdio', specMat, { size: 0.5, depth: 0.08, bevel: 0, tracking: 0.04 });
  spec1.group.position.set(0, -4.6, 0); spec2.group.position.set(0, -5.7, 0);
  P1.add(spec1.group, spec2.group);
  const floor1 = posterPlane(900, 900, INK, { shadowHex: 0x000000, strength: 0 });
  floor1.rotation.x = -Math.PI / 2; floor1.position.y = -7.5; P1.add(floor1);

  // ---------- part 2: method corridor ----------
  const P2 = new THREE.Group(); scene.add(P2);
  const Z0 = -40, DZ = 16; // plate k sits at Z0 - k*DZ; camera passes one per beat
  const methMat = typeMat({ face: BONE, side: 0x55524d, rough: 0.4, clearcoat: 0.3, flatFace: 0.9 });
  const methHot = typeMat({ face: ORANGE, side: 0x9a3208, rough: 0.4, clearcoat: 0.3, flatFace: 0.9 });
  const rnd = mulberry32(3);
  const plates = METHODS.map((m, k) => {
    const kin = kinetic(ts, 'PM', m, k % 3 === 1 ? methHot : methMat, { size: 0.8, depth: 0.16, bevel: 0.004, tracking: -0.02 });
    const side = k % 2 ? 1 : -1;
    kin.group.position.set(side * 0.3, (k % 3 - 1) * 0.35 + 0.1, Z0 - k * DZ);
    kin.group.rotation.set(0, 0, side * 0.03);
    P2.add(kin.group);
    return { kin, z: Z0 - k * DZ, side };
  });
  // wall strips: small mono text lining both walls, floor and ceiling rails
  const wallMat = typeMat({ face: 0x5e5b57, side: 0x2a2a2a, rough: 0.6, clearcoat: 0, flatFace: 0.9 });
  const strips = [];
  for (let s = 0; s < 30; s++) {
    const str = WALL[s % WALL.length] + '   ' + METHODS[(s * 3) % METHODS.length] + '   ' + WALL[(s + 3) % WALL.length];
    const kin = kinetic(ts, 'PR', str, s % 7 === 3 ? methHot : wallMat, { size: 0.55, depth: 0.04, bevel: 0, align: 'left', castShadow: false });
    const g = new THREE.Group(); g.add(kin.group);
    const left = s % 2 === 0;
    g.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
    g.position.set(left ? -8 : 8, -3.6 + ((s * 5) % 8) * 1.15, -20 - s * 5 + (left ? 0 : 30));
    P2.add(g); strips.push(g);
  }
  const railMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff5a14, emissiveIntensity: 2.5 });
  for (const [x, y] of [[-8, -4.6], [8, -4.6], [-8, 5.2], [8, 5.2]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 200), railMat);
    r.position.set(x, y, Z0 - 40); P2.add(r);
  }

  // ---------- part 3: verbs on bone ----------
  const P3 = new THREE.Group(); scene.add(P3);
  const floor3 = posterPlane(900, 900, BONE, { shadowHex: 0x2d2a26, strength: 0.32 });
  floor3.rotation.x = -Math.PI / 2; floor3.position.y = -6.4; P3.add(floor3);
  const verbMat = typeMat({ face: INK, side: OR_SIDE, rough: 0.35, clearcoat: 0.6, flatFace: 0.8 });
  const verbs = VERBS.map((v, k) => {
    const kin = kinetic(ts, 'AW', v, verbMat, { size: 2.3, depth: 0.5, align: 'left', tracking: -0.01 });
    kin.group.position.set(-11.5, 3.9 - k * 2.75, 0);
    P3.add(kin.group);
    return { kin, t0: 42 + k * 0.5 };
  });
  const tagMat = typeMat({ face: ORANGE, side: 0x9a3208, rough: 0.4, clearcoat: 0, flatFace: true });
  const tag1 = kinetic(ts, 'PM', 'drive octos from codex or claude code', tagMat, { size: 0.56, depth: 0.05, bevel: 0, align: 'left', tracking: 0.0, castShadow: false });
  const tag2 = kinetic(ts, 'PM', 'over OUP', tagMat, { size: 0.56, depth: 0.05, bevel: 0, align: 'left', tracking: 0.0, castShadow: false });
  tag1.group.position.set(-11.4, -6.25, 0.5); tag2.group.position.set(-11.4, -7.2, 0.5);
  P3.add(tag1.group, tag2.group);

  return {
    scene, camera: cam,
    tone: (t) => (t < 42 ? 'bone' : 'ink'),
    update(f) {
      const t = f.t;
      const part = t < 38 ? 0 : t < 42 ? 1 : 2;
      P1.visible = part === 0; P2.visible = part === 1; P3.visible = part === 2;
      scene.background.copy(part === 2 ? C.bone : C.ink);
      scene.fog.color.copy(scene.background);
      scene.fog.near = part === 1 ? 14 : 1e4; scene.fog.far = part === 1 ? 40 : 2e4;
      let p, look, roll = 0, fov = 32;
      if (part === 0) {
        oup.glyphs.forEach((g, k) => {
          const t0 = 36 + k * 0.125;
          const e = ease.outExpo(clamp((t - t0) / 0.22));
          g.mesh.position.z = lerp(26, 0, e);
          g.mesh.rotation.x = (1 - e) * -0.6;
          g.mesh.visible = t >= t0;
        });
        spec1.glyphs.forEach((g, i) => { g.mesh.visible = t >= 36.5 + i * 0.025; });
        spec2.glyphs.forEach((g, i) => { g.mesh.visible = t >= 37.0 + i * 0.02; });
        oupMat.emissiveIntensity = 0.25 * gridPulse(t, 36, 38, 0.5, 0.12);
        // slow push, then dive through the counter of the O
        const dive = ease.inExpo(clamp((t - 37.2) / 0.8));
        const base = [lerp(4, 1, ease.outCubic(clamp((t - 36) / 1.2))), lerp(1.5, 0.3, clamp(t - 36)), lerp(40, 34, ease.outCubic(clamp((t - 36) / 1.2)))];
        const tgt = [oupO.x, oupO.y, -3];
        p = [lerp(base[0], tgt[0], ease.inOutCubic(clamp((t - 37.2) / 0.6))), lerp(base[1], tgt[1], ease.inOutCubic(clamp((t - 37.2) / 0.6))), lerp(base[2], tgt[2], dive)];
        look = [lerp(0, oupO.x, ease.inOutCubic(clamp((t - 37.2) / 0.5))), lerp(-0.8, oupO.y, ease.inOutCubic(clamp((t - 37.2) / 0.5))), -60];
        roll = lerp(0.04, 0, clamp(t - 36));
      } else if (part === 1) {
        // camera travels one plate per beat, passing through plate k at 38.5 + k*0.5
        const u = t - 38;
        // surge: fastest on each beat (when a plate is crossed), nearly still between
        const su = u + 0.075 * Math.sin(2 * Math.PI * 2 * u);
        const z = Z0 + DZ * 1.0 - su * (DZ / 0.5);
        p = [Math.sin(u * 1.3) * 0.5, Math.sin(u * 0.9) * 0.3 + 0.2, z];
        look = [Math.sin(u * 1.3 + 0.6) * 0.3, 0.1, z - 20];
        roll = Math.sin(u * 0.8) * 0.1;
        fov = 40;
        for (const pl of plates) {
          const dist = z - pl.z; // positive = ahead of the camera
          pl.kin.group.visible = dist > -2 && dist < DZ + 2;
          // glyphs rise into place as the plate approaches, then part like doors to let the camera through
          const split = ease.inCubic(clamp((5 - dist) / 5));
          pl.kin.glyphs.forEach((g, i) => {
            const rise = ease.outCubic(clamp((DZ + 2 - dist - i * 0.25) / 5));
            const sg = Math.sign(g.x) || 1;
            g.mesh.position.set(g.x + sg * split * (4 + Math.abs(g.x) * 1.2), g.y - (1 - rise) * 7, split * 2);
            g.mesh.rotation.set((1 - rise) * 1.2, -sg * split * 1.4, 0);
          });
        }
      } else {
        verbs.forEach((v) => {
          v.kin.glyphs.forEach((g, i) => {
            const e = ease.outExpo(clamp((t - v.t0 - i * 0.02) / 0.3));
            g.mesh.position.z = lerp(14, 0, e);
            g.mesh.rotation.y = (1 - e) * 1.2;
            g.mesh.visible = t >= v.t0 + i * 0.02;
          });
        });
        tag1.glyphs.forEach((g, i) => { g.mesh.visible = t >= 43.0 + i * 0.015; });
        tag2.glyphs.forEach((g, i) => { g.mesh.visible = t >= 43.6 + i * 0.02; });
        const u = (t - 42) / 2;
        p = orbit([-2.5, -0.4, 0], lerp(31, 34, u), lerp(-0.42, -0.18, ease.outCubic(u)), lerp(0.06, 0.14, u));
        look = [-2.5, -0.4, 0];
        roll = 0;
      }
      cam.fov = fov; cam.updateProjectionMatrix();
      camLook(cam, p, look, roll);
      const beat = gridPulse(t, 36, 44, 0.5, 0.09);
      const drop = since(t, 36);
      const cut = Math.min(since(t, 38), since(t, 42));
      const whip = ease.inExpo(clamp((t - 43.75) / 0.25));
      return {
        bloom: part === 2 ? 0.3 : 0.8, bloomThreshold: part === 2 ? 3 : 1.6, bloomRadius: 0.5, vignette: part === 2 ? 0.2 : 0.5,
        exposure: 1 + 0.06 * beat,
        flash: Math.exp(-drop / 0.1) + 0.5 * Math.exp(-cut / 0.08), flashColor: [1, 1, 1],
        zoomBlur: 0.35 * Math.exp(-drop / 0.25) + (part === 0 ? 0.2 * ease.inExpo(clamp((t - 37.4) / 0.6)) : 0) + (part === 1 ? 0.02 + 0.03 * beat : 0) + 0.3 * whip,
        shake: [0.01 * Math.exp(-drop / 0.18) * Math.sin(t * 140) + 0.002 * beat * Math.sin(t * 90), 0.01 * Math.exp(-drop / 0.18) * Math.cos(t * 120)],
        ca: 0.0012 + 0.006 * Math.exp(-drop / 0.3),
      };
    },
  };
}
