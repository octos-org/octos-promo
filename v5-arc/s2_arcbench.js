// S2 7.5–15 s (bars 4–8): ARC-BENCH slams onto the factory floor; arc-bench.com; four track slabs stamp down
// in front of it on bar 6 (one per beat); the camera dives at the WEB slab on bar 7.
import * as THREE from 'three';
import { C, CSS, BONE, ORANGE, GREEN, typeMat, kinetic, envMap, camLook, keys, since, keyLight, bt, BEAT, S16, hudCaption, flat, canvasTex, gridPulse } from './lib.js';
import { ease, clamp } from '../engine/util.js';
import { getTS } from './common.js';
import { floor, steelMat } from './factory.js';

const TRACKS = [
  { name: 'SMOKE', sub: 'TRACK 01' },
  { name: 'SMOKE EVOLUTION', sub: 'TRACK 02' },
  { name: 'TICKET BOOKING', sub: 'TRACK 03' },
  { name: 'WEB', sub: 'TRACK 04 · 6 REAL APPS', hot: true },
];

function slabTex({ name, sub, hot }) {
  return canvasTex(1024, 560, (g, w, h) => {
    g.fillStyle = hot ? '#ff6a1a' : '#1f2125'; g.fillRect(0, 0, w, h);
    g.strokeStyle = hot ? 'rgba(0,0,0,0.35)' : '#3b3e44'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = hot ? '#0d0e10' : '#8d8a84'; g.font = '600 50px PM';
    if ('letterSpacing' in g) g.letterSpacing = '6px';
    g.fillText(sub, 52, 92);
    g.fillStyle = hot ? '#0d0e10' : '#e9e5dc';
    const size = name.length > 12 ? 100 : 150;
    g.font = `${size}px AB`; if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.fillText(name, 48, h - 70);
    g.fillStyle = hot ? '#0d0e10' : '#ff6a1a'; g.fillRect(52, 118, 90, 8);
  });
}

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.fog = new THREE.Fog(C.ink.clone(), 40, 90);
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.35;
  const cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 300);

  floor(scene, { size: 200, cell: 2 });
  keyLight(scene, { intensity: 2.4, pos: [-14, 20, 18], target: [0, 0, 2], size: 22, map: 4096 });
  const fill = new THREE.DirectionalLight(0xbfd0e0, 0.5); fill.position.set(14, 8, 10); scene.add(fill);
  const back = new THREE.SpotLight(0xffc8a0, 160, 50, 0.6, 0.6, 1.5); back.position.set(0, 14, -10); back.target.position.set(0, 0, 0); scene.add(back, back.target);
  scene.add(new THREE.HemisphereLight(0x9aa6b4, 0x101010, 0.3));

  // ARC-BENCH
  const face = typeMat({ face: BONE, side: 0xff6a1a, rough: 0.35, clearcoat: 0.5, flatFace: 0.82 });
  const title = kinetic(ts, 'AX', 'ARC-BENCH', face, { size: 1.8, depth: 0.75, tracking: 0.0, castShadow: true });
  title.group.position.set(0, 0.88, 0);
  scene.add(title.group);
  const drops = title.glyphs.map((g, i) => ({ t0: bt(4) + Math.round((i * 0.7 + (i % 3) * 0.4)) * S16 * 0.5, r: (i % 2 ? 1 : -1) }));

  // arc-bench.com
  const urlMat = typeMat({ face: ORANGE, side: 0x9a3208, rough: 0.4, clearcoat: 0.2, flatFace: 0.92 });
  const url = kinetic(ts, 'PM', 'arc-bench.com', urlMat, { size: 0.5, depth: 0.12, tracking: 0.02, castShadow: true });
  url.group.position.set(0, 0.3, 1.6);
  scene.add(url.group);

  // track slabs
  const sm = steelMat();
  const slabs = TRACKS.map((tr, i) => {
    const top = new THREE.MeshStandardMaterial({ map: slabTex(tr), roughness: 0.55, metalness: 0.1, emissive: tr.hot ? 0xff4a0a : 0x000000, emissiveIntensity: tr.hot ? 0.25 : 0 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.36, 2.5), [sm, sm, top, sm, sm, sm]);
    m.castShadow = true; m.receiveShadow = true;
    const x = (i - 1.5) * 5.1;
    m.position.set(x, 0.18, 5.4);
    scene.add(m);
    return { m, x, t0: bt(6, i), top };
  });

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      // title drop
      title.glyphs.forEach((g, i) => {
        const d = drops[i];
        const u = clamp((t - d.t0 + 0.22) / 0.22);
        const e = ease.inCubic(u);
        const land = t >= d.t0 ? Math.exp(-(t - d.t0) / 0.09) * Math.sin((t - d.t0) * 40) : 0;
        g.mesh.position.y = g.y + (1 - e) * 9 + land * 0.12;
        g.mesh.rotation.z = (1 - e) * 0.25 * d.r;
        g.mesh.visible = t >= d.t0 - 0.24;
      });
      url.glyphs.forEach((g, i) => { g.mesh.visible = t >= bt(4, 2) + i * 0.025; });
      // slabs stamp down on beats of bar 6
      let stamp = 0;
      for (const s of slabs) {
        const u = clamp((t - (s.t0 - 0.16)) / 0.16);
        s.m.position.y = 0.18 + (1 - ease.inQuad(u)) * 7;
        s.m.visible = t >= s.t0 - 0.4;
        s.m.rotation.y = (1 - u) * 0.3;
        stamp = Math.max(stamp, t >= s.t0 ? Math.exp(-(t - s.t0) / 0.12) : 0);
      }
      const web = slabs[3];
      web.top.emissiveIntensity = 0.25 + 0.6 * gridPulse(t, bt(7), bt(8), BEAT, 0.12) * (t >= bt(7) ? 1 : 0);

      const land = t >= bt(4) ? Math.exp(-(t - bt(4)) / 0.15) : 0;
      // camera: low hero on the title → crane up over the slabs → dive at WEB
      const p = keys(t, [[bt(4), [-2.5, 1.2, 20]], [bt(5, 3), [2.5, 2.0, 23.5], ease.inOutCubic], [bt(6, 0), [0, 9.5, 28], ease.inOutCubic], [bt(7, 0), [1.0, 11.5, 26], ease.outCubic], [bt(8), [7.5, 2.4, 8.2], ease.inExpo]]);
      const look = keys(t, [[bt(4), [0, 1.5, 0]], [bt(5, 3), [0, 1.5, 0]], [bt(6, 0), [0, 0.9, 3.0], ease.inOutCubic], [bt(7, 0), [0.4, 0.5, 3.4]], [bt(8), [7.65, 0.2, 5.4], ease.inExpo]]);
      camLook(cam, p, look, keys(t, [[bt(4), -0.04], [bt(5), 0], [bt(7, 2), 0], [bt(8), 0.08, ease.inExpo]]));
      const dive = ease.inExpo(clamp((t - bt(7, 2)) / (2 * BEAT)));
      cam.fov = 34 + 20 * dive; cam.updateProjectionMatrix();
      return {
        bloom: 0.6, bloomThreshold: 1.8, bloomRadius: 0.5, vignette: 0.55,
        exposure: 1 + 0.08 * stamp + 0.1 * land,
        shake: [0.004 * (stamp + land) * Math.sin(t * 97), 0.004 * (stamp + land) * Math.cos(t * 83)],
        flash: 0.5 * Math.exp(-since(t, bt(4)) / 0.14) + 0.85 * ease.inExpo(clamp((t - bt(8) + 0.12) / 0.12)), flashColor: [1, 0.55, 0.25],
        zoomBlur: 0.22 * dive,
      };
    },
    hud(h, f) {
      const t = f.t;
      const a1 = clamp((t - bt(4, 2)) / 0.4) * clamp((bt(6) - 0.2 - t) / 0.3);
      hudCaption(h, 'THE BENCHMARK', 'ARC-Bench, by the CoPhi group at Shanghai Jiao Tong University', a1);
      const a2 = clamp((t - bt(6)) / 0.4) * clamp((bt(7, 3) - t) / 0.3);
      hudCaption(h, 'GOSIM FACTORY26 · SOFTWARE FACTORY', 'Four tracks. The Web track: six real apps to build.', a2);
    },
  };
}
