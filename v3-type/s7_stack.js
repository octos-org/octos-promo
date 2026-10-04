// S7 44–50 s: the crates as a tower of slabs dropping in on the beat (orange field),
// then rings of platforms and bindings orbit the finished stack.
import * as THREE from 'three';
import { C, CSS, INK, BONE, ORANGE, OR_SIDE, typeMat, kinetic, envMap, camLook, since, gridPulse, posterPlane, keyLight, keys, orbit } from './lib.js';
import { ease, clamp, lerp } from '../engine/util.js';
import { getTS } from './common.js';

const CRATES = [
  ['octos-core', 'types · OUP commands · codecs'],
  ['octos-agent', 'execution · context · tools · sandboxing'],
  ['octos-memory', 'memory · episodes · retrieval'],
  ['octos-llm', 'providers · routing · failover'],
  ['octos-plugin', 'skills · plugins'],
  ['octos-pipeline / swarm', 'workflows · parallel workers'],
  ['octos-bus / cli', 'sessions · runtime · OUP hosting'],
];
const RING1 = 'LINUX · WINDOWS · MACOS · X86-64 · ARM64 · RISC-V · ';
const RING2 = 'C ABI · PYTHON · SWIFT · KOTLIN · WASM · ';

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.orange.clone();
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.6;
  const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 800);
  const key = keyLight(scene, { intensity: 2.8, pos: [-16, 30, 18], target: [0, 4, 0], size: 22 });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a5a40, 1.0));
  const floor = posterPlane(900, 900, ORANGE, { shadowHex: 0x5a1500, strength: 0.45 });
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  const SW = 15, SH = 1.15, SD = 5, GAPY = 0.14;
  const geo = new THREE.BoxGeometry(SW, SH, SD);
  const matInk = new THREE.MeshPhysicalMaterial({ color: 0x131316, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.3, envMapIntensity: 0.7 });
  const matBone = new THREE.MeshPhysicalMaterial({ color: 0xd8d2c6, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.5 });
  const lblBone = typeMat({ face: BONE, side: 0x777777, rough: 0.5, clearcoat: 0, flatFace: true });
  const lblInk = typeMat({ face: INK, side: 0x444444, rough: 0.5, clearcoat: 0, flatFace: true });
  const lblOr = typeMat({ face: ORANGE, side: 0x9a3208, rough: 0.5, clearcoat: 0, flatFace: true });
  const slabs = CRATES.map(([name, desc], k) => {
    const g = new THREE.Group();
    const ink = k % 2 === 0;
    const m = new THREE.Mesh(geo, ink ? matInk : matBone);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
    const nm = kinetic(ts, 'AB', name, ink ? lblBone : lblInk, { size: 0.5, depth: 0.04, bevel: 0, align: 'left', castShadow: false });
    nm.group.position.set(-SW / 2 + 0.55, -0.02, SD / 2 + 0.03); g.add(nm.group);
    const ds = kinetic(ts, 'PR', desc, ink ? lblOr : lblInk, { size: 0.22, depth: 0.03, bevel: 0, align: 'right', castShadow: false });
    ds.group.position.set(SW / 2 - 0.55, -0.12, SD / 2 + 0.03); g.add(ds.group);
    const idx = kinetic(ts, 'PM', String(k + 1).padStart(2, '0'), ink ? lblOr : lblInk, { size: 0.22, depth: 0.03, bevel: 0, align: 'right', castShadow: false });
    idx.group.position.set(SW / 2 - 0.55, 0.3, SD / 2 + 0.03); g.add(idx.group);
    scene.add(g);
    return { g, y: SH / 2 + k * (SH + GAPY), t0: 44 + k * 0.5, rot: (k % 2 ? 1 : -1) * 0.06 };
  });
  const TOP = CRATES.length * (SH + GAPY);

  // rings of glyphs around the tower
  const ringMat1 = typeMat({ face: INK, side: 0x333333, rough: 0.4, clearcoat: 0.3, flatFace: 0.8 });
  const ringMat2 = typeMat({ face: BONE, side: 0x9c978f, rough: 0.4, clearcoat: 0.3, flatFace: 0.8 });
  const mkRing = (str, mat, R, y, size) => {
    const circ = 2 * Math.PI * R;
    const one = ts.layout('AB', str, { tracking: 0.04 }).width * size + size * 0.9;
    const reps = Math.max(1, Math.round(circ / one));
    const kin = kinetic(ts, 'AB', str.repeat(reps), mat, { size, depth: 0.12, bevel: 0, align: 'left', tracking: 0.04 });
    const scale = circ / (kin.width + size * 0.9); // close the loop exactly
    const grp = new THREE.Group(); grp.position.y = y;
    kin.glyphs.forEach((g) => {
      const th = (g.x * scale) / R;
      g.mesh.position.set(Math.sin(th) * R, g.y, Math.cos(th) * R);
      g.mesh.rotation.y = th;
      grp.add(g.mesh);
      g.th = th;
    });
    scene.add(grp);
    return { grp, kin };
  };
  const ring1 = mkRing(RING1, ringMat1, 9.6, TOP * 0.62, 0.95);
  const ring2 = mkRing(RING2, ringMat2, 10.8, TOP * 0.3, 0.95);

  return {
    scene, camera: cam,
    tone: () => 'ink',
    update(f) {
      const t = f.t;
      for (const s of slabs) {
        const u = clamp((t - (s.t0 - 0.35)) / 0.35);
        const fall = ease.inQuad(u);
        const land = since(t, s.t0);
        const bounce = land < 1e8 ? Math.exp(-land / 0.08) * Math.sin(land * 60) * 0.06 : 0;
        s.g.position.y = s.y + (1 - fall) * 16 + bounce;
        s.g.rotation.y = s.rot * (1 - fall);
        s.g.visible = t >= s.t0 - 0.35;
      }
      // rings sweep in at 47.5 and spin opposite ways
      const r = ease.outExpo(clamp((t - 47.5) / 0.8));
      ring1.grp.visible = ring2.grp.visible = t >= 47.4;
      ring1.grp.rotation.y = (t - 47.5) * 0.35 + (1 - r) * 2.2;
      ring2.grp.rotation.y = -(t - 47.5) * 0.3 - (1 - r) * 2.2;
      ring1.grp.scale.setScalar(lerp(0.35, 1, r)); ring2.grp.scale.setScalar(lerp(0.3, 1, r));
      ring1.grp.position.y = TOP + 2.6 + (1 - r) * 1.5; ring2.grp.position.y = 0.55 - (1 - r) * 0.5;

      // camera: close on the front as slabs land (tracks the stack), then pulls out and up
      const topY = clamp((t - 44) / 3.5) * TOP;
      const pull = ease.inOutCubic(clamp((t - 47.2) / 1.6));
      const yaw = lerp(-0.5, 0.15, ease.inOutCubic(clamp((t - 44) / 4))) + pull * 0.35;
      const R = lerp(24, 40, pull);
      const pitch = lerp(0.1, 0.2, pull);
      const tgt = [0, lerp(Math.max(1.2, topY - 1.8), TOP * 0.5, pull), 0];
      const p = orbit(tgt, R, yaw, pitch);
      camLook(cam, p, tgt, lerp(0.03, -0.02, pull));
      cam.fov = 32; cam.updateProjectionMatrix();
      const hit = slabs.reduce((a, s) => Math.max(a, Math.exp(-since(t, s.t0) / 0.08)), 0);
      const collapse = ease.inExpo(clamp((t - 49.6) / 0.4));
      return {
        bloom: 0.25, bloomThreshold: 3, vignette: 0.22,
        exposure: 1 + 0.03 * hit,
        shake: [0.003 * hit * Math.sin(t * 150), 0.004 * hit * Math.cos(t * 130)],
        flash: 0.4 * Math.exp(-since(t, 44) / 0.08) + 0.9 * collapse, flashColor: [0.04, 0.04, 0.045],
        zoomBlur: 0.015 * hit + 0.3 * collapse,
      };
    },
  };
}
