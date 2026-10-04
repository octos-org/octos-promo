// S6 37.5–45 s (bars 20–24, the drop): the six ARC-Bench Web apps as building sites on one factory line.
// A site stamps in every 2 beats (slab, scaffold, blocks extruding out of the floor, name slams); the camera tracks
// the line, then cranes up to the wide shot of all six.
import * as THREE from 'three';
import { C, CSS, LC, BONE, ORANGE, GREEN, typeMat, kinetic, envMap, camLook, keys, since, keyLight, bt, BEAT, S16, hudCaption, flat, canvasTex, frameBox, gridPulse } from './lib.js';
import { ease, clamp, lerp, mulberry32 } from '../engine/util.js';
import { getTS } from './common.js';
import { floor, steelMat, castMat, uiPanel, backendBox, dbCylinder } from './factory.js';

export const APPS = ['BOOKSTACK', 'KEEP', 'STACKOVERFLOW', '12306', 'CTRIP', 'PRESTASHOP'];
const SP = 8.6;

function hazardTex() {
  const tex = canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = '#16171a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff6a1a';
    for (let x = -h; x < w + h; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 24 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export async function make(ctx) {
  const ts = await getTS(ctx);
  const scene = new THREE.Scene();
  scene.background = C.ink.clone();
  scene.fog = new THREE.Fog(C.ink.clone(), 50, 120);
  scene.environment = envMap(ctx.renderer);
  scene.environmentIntensity = 0.35;
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400);

  floor(scene, { size: 300, cell: 2 });
  keyLight(scene, { intensity: 2.0, pos: [-18, 26, 22], target: [0, 0, 0], size: 34, map: 4096 });
  scene.add(new THREE.HemisphereLight(0x8a98a8, 0x101010, 0.4));
  const rim = new THREE.DirectionalLight(0xffc090, 0.6); rim.position.set(20, 10, -20); scene.add(rim);

  const hz = hazardTex();
  const sm = steelMat();
  const nameMat = typeMat({ face: BONE, side: 0xff6a1a, rough: 0.35, clearcoat: 0.4, flatFace: 0.85 });
  const sites = APPS.map((name, i) => {
    const x = (i - 2.5) * SP;
    const grp = new THREE.Group(); grp.position.set(x, 0, 0); scene.add(grp);
    const rnd = mulberry32(100 + i * 17);
    // slab with hazard edge
    const edgeMat = new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.9 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.25, 6.2), [edgeMat, edgeMat, topMat, topMat, edgeMat, edgeMat]);
    slab.position.y = 0.125; slab.receiveShadow = true; slab.castShadow = true; grp.add(slab);
    // blocks (extrude out of the floor)
    const blocks = [];
    const nb = 4 + Math.floor(rnd() * 3);
    const tall = 1.6 + rnd() * 2.2;
    for (let k = 0; k < nb; k++) {
      let o, h;
      const kind = k === 0 ? 'db' : k < nb - 2 ? 'be' : 'ui';
      if (kind === 'db') { h = 1.2 + rnd() * 0.8; o = dbCylinder(0.55, h); o.position.set(-2.3, 0.25 + h / 2, -1.2); }
      else if (kind === 'be') { h = 1.0 + rnd() * tall; o = backendBox(1.3, h, 1.6); o.position.set(-0.8 + (k - 1) * 1.5, 0.25 + h / 2, -1.2); if (o.userData.led) flat(GREEN, o.userData.led.color); }
      else { h = 1.1; o = uiPanel(2.2, 1.3, 30 + i * 5 + k); o.position.set(-1.3 + (k - (nb - 2)) * 2.6, 2.0 + tall * 0.5 + rnd() * 0.6, 0.9); }
      if (o.userData.led) flat(GREEN, o.userData.led.color);
      o.userData.home = o.position.y; o.userData.h = h + 1.5;
      grp.add(o); blocks.push(o);
    }
    // scaffold
    const SH = 4.8 + tall * 0.6;
    const fr = frameBox(6.4, SH, 4.6, 0.08, sm); fr.position.y = SH / 2;
    const scaf = new THREE.Group(); scaf.add(fr); scaf.position.set(0, 0.25, -0.3); grp.add(scaf);
    // tower crane
    const cm = castMat();
    const crane = new THREE.Group();
    const mastH = 8 + rnd() * 3;
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.3, mastH, 0.3), cm); mast.position.y = mastH / 2; mast.castShadow = true;
    const jib = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.22, 0.22), cm); jib.position.set(1.6, mastH, 0); jib.castShadow = true;
    const cw = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.5), sm); cw.position.set(-1.4, mastH - 0.3, 0);
    const cable = new THREE.Mesh(new THREE.BoxGeometry(0.03, 3, 0.03), sm); cable.position.set(4.2, mastH - 1.5, 0);
    crane.add(mast, jib, cw, cable);
    crane.position.set(3.0, 0, -2.6); crane.rotation.y = rnd() * 6.28; grp.add(crane);
    // name
    const probe = ts.layout('AX', name, { tracking: 0.01 });
    const size = Math.min(0.95, 6.6 / probe.width);
    const lab = kinetic(ts, 'AX', name, nameMat, { size, depth: 0.35, tracking: 0.01 });
    lab.group.position.set(0, 0.25 + 0.36 * size + 0.02, 3.35); grp.add(lab.group);
    const t0 = bt(20 + Math.floor(i / 2), (i % 2) * 2);
    return { grp, slab, blocks, scaf, crane, lab, t0, x, rot0: crane.rotation.y, cm };
  });

  // the factory line: a lit rail in front of the sites that runs to each new site as it stamps in
  const railMat = new THREE.MeshBasicMaterial({ color: flat(ORANGE) });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.14), railMat);
  rail.geometry.translate(0.5, 0, 0);
  rail.position.set(-3.2 * SP, 0.03, 4.4); scene.add(rail);
  const railDim = new THREE.Mesh(new THREE.BoxGeometry(6 * SP + 2, 0.03, 0.14), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6 }));
  railDim.position.set(0, 0.015, 4.4); scene.add(railDim);
  const railKeys = [[bt(20) - 0.4, -3.2 * SP], ...sites.map((s) => [s.t0, s.x + 3.6]), [bt(24), 3.2 * SP]];

  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      const rx = keys(t, railKeys.map(([a, b]) => [a, b, ease.outExpo]));
      rail.scale.x = Math.max(1e-3, rx + 3.2 * SP);
      railMat.color.copy(flat(ORANGE)).multiplyScalar(0.22 + 0.12 * gridPulse(t, bt(20), bt(24), BEAT, 0.1));
      let stamp = 0;
      for (const s of sites) {
        const dt = t - s.t0;
        const on = dt >= -0.2;
        s.grp.visible = on;
        if (!on) continue;
        stamp = Math.max(stamp, dt >= 0 ? Math.exp(-dt / 0.12) : 0);
        const e = ease.inQuad(clamp((dt + 0.2) / 0.2));
        s.slab.position.y = 0.125 + (1 - e) * 3;
        s.scaf.visible = dt >= 0;
        s.scaf.scale.y = Math.max(1e-3, ease.outExpo(clamp(dt / 0.35)));
        s.blocks.forEach((b, k) => {
          const bt0 = s.t0 + (k + 1) * S16;
          const u = ease.outExpo(clamp((t - bt0) / 0.3));
          b.position.y = b.userData.home - (1 - u) * b.userData.h;
          b.visible = t >= bt0;
        });
        s.lab.glyphs.forEach((g, k) => {
          const g0 = s.t0 + 0.04 + k * 0.015;
          const u = ease.outBack(clamp((t - g0) / 0.25));
          g.mesh.visible = t >= g0; g.mesh.rotation.x = (1 - u) * -1.5; g.mesh.position.y = g.y;
        });
        s.crane.rotation.y = s.rot0 + (t - s.t0) * 0.35;
        s.cm.emissiveIntensity = 0.15 + 1.5 * (dt >= 0 ? Math.exp(-dt / 0.15) : 0) + 0.4 * gridPulse(t, bt(20), bt(24), BEAT, 0.1);
      }
      // camera: track the line with the reveals, then crane up to the wide shot
      const track = (i) => (i - 2.5) * SP;
      const p = keys(t, [[bt(20), [track(0) - 3, 3.0, 15]], [bt(21), [track(1), 3.6, 16], ease.inOutCubic], [bt(22), [track(3) - 1, 3.8, 16.5], ease.inOutCubic], [bt(22, 3), [track(5) - 1, 4.2, 17], ease.inOutCubic], [bt(23, 2), [8, 14, 40], ease.inOutCubic], [bt(24), [2, 16, 46], ease.outCubic]]);
      const look = keys(t, [[bt(20), [track(0) + 0.5, 2.4, 0]], [bt(21), [track(1) + 1, 2.6, 0], ease.inOutCubic], [bt(22), [track(3) + 0.5, 2.6, 0], ease.inOutCubic], [bt(22, 3), [track(5), 2.6, 0], ease.inOutCubic], [bt(23, 2), [0, 4.2, 0], ease.inOutCubic], [bt(24), [0, 4.6, 0]]]);
      camLook(cam, p, look, keys(t, [[bt(20), 0.05], [bt(22), -0.03], [bt(23, 2), 0]]));
      cam.fov = 38; cam.updateProjectionMatrix();
      const drop = Math.exp(-since(t, bt(20)) / 0.2);
      const beat = gridPulse(t, bt(20), bt(24), BEAT, 0.1);
      return {
        bloom: 0.7, bloomThreshold: 1.4, bloomRadius: 0.5, vignette: 0.5,
        exposure: 1 + 0.06 * beat + 0.08 * stamp,
        flash: 0.8 * drop + 0.6 * ease.inExpo(clamp((t - bt(24) + 0.1) / 0.1)), flashColor: [1, 0.55, 0.25],
        zoomBlur: 0.12 * drop,
        shake: [0.004 * stamp * Math.sin(t * 101), 0.004 * stamp * Math.cos(t * 89)],
      };
    },
    hud(h, f) {
      const t = f.t;
      const a = clamp((t - bt(20, 1)) / 0.3) * clamp((bt(24) - 0.1 - t) / 0.2);
      hudCaption(h, 'ARC-BENCH WEB · 6 REAL APPS', 'Each one built by the agent inside a container, graded by Playwright.', a);
    },
  };
}
