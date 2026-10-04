// S5 33.75–37.5 s (bars 18–20, the break): main.py as a tower of code lines counts up to 3811; on bar 19 the loop is
// pulled out of the Python glue into the kernel's pipeline engine — lines stream into the orange-seamed block,
// the counter drops to 460 (PR #228). Reverse crash into the drop at 37.5.
import * as THREE from 'three';
import { C, CSS, LC, BONE, ORANGE, GREEN, ASH, typeMat, kinetic, envMap, camLook, keys, since, keyLight, bt, BEAT, S16, hudCaption, flat, canvasTex } from './lib.js';
import { ease, clamp, lerp, mulberry32 } from '../engine/util.js';
import { getTS } from './common.js';
import { floor, steelMat } from './factory.js';

const LINES_BEFORE = 3811, LINES_AFTER = 460, PER = 10; // one slab = 10 lines
const NS = Math.round(LINES_BEFORE / PER), NKEEP = Math.round(LINES_AFTER / PER);
const SH = 0.015, PITCH = 0.02;

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.fog = new THREE.Fog(C.ink.clone(), 30, 75);
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.3;
  const cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 300);

  floor(scene, { size: 200, cell: 1.5 });
  keyLight(scene, { intensity: 1.8, pos: [-10, 18, 14], target: [0, 3, 0], size: 16, map: 2048 });
  scene.add(new THREE.HemisphereLight(0x8a98a8, 0x101010, 0.35));
  const kLight = new THREE.PointLight(0xff6a1a, 0, 18, 1.6); kLight.position.set(4.2, 2.2, 2.5); scene.add(kLight);

  // tower of code-line slabs (left-aligned with indentation, ragged right edge)
  const TX = -4.6;
  const rnd = mulberry32(228);
  const slabGeo = new THREE.BoxGeometry(1, SH, 1.1);
  slabGeo.translate(0.5, 0, 0);
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.1 });
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, NS);
  slabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); slabs.frustumCulled = false; slabs.castShadow = true;
  const S = [];
  const cBone = new THREE.Color(0xcfc9bd), cAsh = new THREE.Color(0x5d5a55), cOr = new THREE.Color(ORANGE);
  for (let i = 0; i < NS; i++) {
    const indent = [0, 0, 0.3, 0.3, 0.6, 0.9][Math.floor(rnd() * 6)];
    const len = 0.5 + rnd() * 2.4;
    const keep = i < NKEEP;
    const col = rnd() < 0.08 ? cOr : rnd() < 0.5 ? cBone : cAsh;
    slabs.setColorAt(i, col);
    S.push({ indent, len, keep, y: 0.05 + i * PITCH, order: (i - NKEEP) / (NS - NKEEP), r1: rnd(), r2: rnd() });
  }
  scene.add(slabs);

  // kernel block
  const KX = 4.4, KS = 3.0;
  const kTex = canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#1b1d21'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#ff6a1a'; g.lineWidth = 6;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * w / 4); g.lineTo(w, i * w / 4); g.stroke(); g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, w); g.stroke(); }
    g.strokeRect(3, 3, w - 6, w - 6);
  });
  const kMat = new THREE.MeshStandardMaterial({ color: 0x777777, map: kTex, emissive: 0xffffff, emissiveMap: kTex, emissiveIntensity: 0.2, roughness: 0.45, metalness: 0.6 });
  const kernel = new THREE.Mesh(new THREE.BoxGeometry(KS, KS, KS), kMat);
  kernel.position.set(KX, KS / 2, 0); kernel.castShadow = true; kernel.rotation.y = -0.35;
  scene.add(kernel);

  // labels
  const pyMat = typeMat({ face: BONE, side: 0x6b6760, rough: 0.4, flatFace: 0.85 });
  const py = kinetic(ts, 'PM', 'main.py', pyMat, { size: 0.36, depth: 0.08, castShadow: false, align: 'right' });
  py.group.position.set(TX - 0.35, 0.2, 0.3); py.group.rotation.x = 0; scene.add(py.group);
  const kLab = kinetic(ts, 'PM', 'pipeline engine', typeMat({ face: ORANGE, side: 0x9a3208, flatFace: 0.9 }), { size: 0.34, depth: 0.08, castShadow: false });
  kLab.group.position.set(KX, KS + 0.45, 0); kLab.group.rotation.y = -0.1; scene.add(kLab.group);

  // counter digits (tabular) + LINES
  const digMat = typeMat({ face: BONE, side: 0xff6a1a, rough: 0.35, clearcoat: 0.4, flatFace: 0.85 });
  const DS = 1.15, ADV = ts.adv('AX', '0') * DS;
  const slots = [];
  for (let s = 0; s < 4; s++) {
    const ms = [];
    for (let d = 0; d < 10; d++) {
      const g = ts.glyph('AX', String(d), { depth: 0.3 });
      const m = new THREE.Mesh(g.geo, digMat); m.scale.setScalar(DS); m.castShadow = true;
      m.position.set((s - 1.5) * ADV, g.cy * DS, 0); m.visible = false;
      scene.add(m); ms.push(m);
    }
    slots.push(ms);
  }
  const counter = new THREE.Group(); scene.add(counter);
  slots.flat().forEach((m) => counter.add(m));
  counter.position.set(1.4, 6.0, 1.0);
  const unit = kinetic(ts, 'PM', 'LINES', typeMat({ face: ORANGE, side: 0x9a3208, flatFace: 0.9 }), { size: 0.36, depth: 0.08, align: 'left', castShadow: false });
  unit.group.position.set(1.4 + 2 * ADV - 0.1, 5.35, 1.0); scene.add(unit.group);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SC = new THREE.Vector3(), P = new THREE.Vector3();
  const tUp0 = bt(18), tUp1 = bt(18, 3), tPress = bt(19), tDone = bt(19, 3);
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      // build-up: slabs stack in bottom → top during bar 18
      const upK = clamp((t - tUp0) / (tUp1 - tUp0));
      const nUp = ease.outCubic(upK) * NS;
      let count = Math.round(ease.outCubic(upK) * LINES_BEFORE);
      // transfer: non-kept slabs stream into the kernel, top first
      const tr = clamp((t - tPress) / (tDone - tPress));
      if (t >= tPress) count = Math.round(lerp(LINES_BEFORE, LINES_AFTER, ease.outCubic(tr)));
      let flying = 0;
      S.forEach((s, i) => {
        let x = TX + s.indent, y = s.y, z = 0, sx = s.len, sc = 1, ry = 0;
        const born = i < nUp;
        if (!born) { sc = 0; }
        else if (i + 1 > nUp - 3) y += (1 - (nUp - i) / 3) * 0.6;
        if (!s.keep && t >= tPress) {
          const t0 = tPress + (1 - s.order) * (tDone - tPress) * 0.75;
          const u = clamp((t - t0) / 0.45);
          if (u > 0) {
            const e = ease.inOutCubic(u);
            flying++;
            const arc = Math.sin(u * Math.PI) * (1.5 + s.r1 * 2);
            x = lerp(x, KX - 0.6, e); y = lerp(y, 1.6 + (s.r2 - 0.5) * 1.8, e) + arc; z = lerp(0, (s.r1 - 0.5) * 1.2, e);
            sx = lerp(s.len, 0.4, e); ry = e * -0.35;
            if (u >= 1) sc = 0;
          }
        }
        // the kept slabs settle after the press
        if (s.keep && t >= tPress) y -= Math.exp(-(t - tPress) / 0.05) * 0.0;
        E.set(0, ry, 0); Q.setFromEuler(E); SC.set(sx * sc, sc, sc);
        P.set(x, y, z); M.compose(P, Q, SC); slabs.setMatrixAt(i, M);
      });
      slabs.instanceMatrix.needsUpdate = true;

      // kernel glow grows as it absorbs the loop
      const absorb = clamp(tr * 1.2);
      const press = t >= tPress ? Math.exp(-(t - tPress) / 0.12) : 0;
      kMat.emissiveIntensity = 0.2 + 1.3 * absorb + 1.2 * press;
      kLight.intensity = 60 * absorb + 120 * press;
      kernel.scale.setScalar(1 + 0.05 * press);
      kernel.rotation.y = -0.35 + ease.inOutCubic(tr) * 0.25;

      // counter
      const str = String(count).padStart(4, ' ');
      slots.forEach((ms, s) => { const ch = str[s]; ms.forEach((m, d) => { m.visible = ch !== ' ' && Number(ch) === d && t >= tUp0 + 0.05; }); });
      unit.group.visible = t >= tUp0 + 0.05;
      counter.position.y = 6.0 + press * 0.15;

      const p = keys(t, [[bt(18), [-4.5, 3.0, 16.5]], [bt(18, 3), [-2.0, 4.0, 18.0], ease.inOutCubic], [bt(19), [-0.5, 4.2, 19.0], ease.outCubic], [bt(19, 3), [0.8, 4.0, 18.0], ease.inOutCubic], [bt(20), [3.0, 2.6, 9.5], ease.inExpo]]);
      const look = keys(t, [[bt(18), [-1.2, 3.4, 0]], [bt(18, 3), [-0.6, 3.6, 0], ease.inOutCubic], [bt(19), [0, 3.4, 0], ease.outCubic], [bt(19, 3), [0.4, 3.2, 0]], [bt(20), [4.4, 1.6, 0], ease.inExpo]]);
      camLook(cam, p, look, keys(t, [[bt(18), -0.05], [bt(19), 0]]));
      const push = ease.inExpo(clamp((t - bt(19, 3)) / BEAT));
      cam.fov = 36 + 20 * push; cam.updateProjectionMatrix();
      return {
        bloom: 0.8, bloomThreshold: 1.1, bloomRadius: 0.55, vignette: 0.6,
        exposure: 1 + 0.25 * press,
        shake: [0.006 * press * Math.sin(t * 120), 0.006 * press * Math.cos(t * 97)],
        flash: 0.3 * Math.exp(-since(t, bt(18)) / 0.2) + 0.35 * press + 0.9 * ease.inExpo(clamp((t - bt(20) + 0.1) / 0.1)), flashColor: [1, 0.5, 0.2],
        zoomBlur: 0.25 * push + 0.05 * press,
      };
    },
    hud(h, f) {
      const t = f.t;
      const a = clamp((t - bt(18, 1)) / 0.3) * clamp((bt(19, 3.5) - t) / 0.2);
      hudCaption(h, 'PR #228 · KERNEL-NATIVE ORCHESTRATION', 'The build loop moved into the Octos pipeline engine: main.py 3811 → 460 lines.', a);
    },
  };
}
