// ABYSS — Octos promo v1. A dive from the ocean surface ("the interface") to a living,
// bioluminescent kernel in the deep; its eight arms reach out to every surface.
// 104 BPM, 26 bars = 60 s. Every frame is a pure function of t.
import * as THREE from 'three';
import {
  BPM, BEAT, BAR, T, TAU, ORANGE, CYAN, ICE, HITS, BELLS, CLAPS, env, recent, lastHit, camLook, project,
  makeWorld, makeCreature, pulseList, makeLine, placeInView, hudText, typed, clamp, lerp, prog, ease, hash, mulberry32,
} from './lib.js';
import { keys, noise1, fbm1 } from '../engine/util.js';

const DUR = 60;
const col = (r, g, b) => new THREE.Color(r, g, b);
const mixC = (a, b, x) => a.clone().lerp(b, clamp(x));
const DEEP = col(0.002, 0.009, 0.013);
const TEAL = col(0.010, 0.060, 0.072);
const WHITE = col(0.82, 0.94, 1.0);
const newCam = (fov = 40) => new THREE.PerspectiveCamera(fov, 16 / 9, 0.05, 900);
const sph = (r, a, e, c = [0, 0, 0]) => [c[0] + r * Math.cos(e) * Math.cos(a), c[1] + r * Math.sin(e), c[2] + r * Math.cos(e) * Math.sin(a)];
const LB = 66; // letterbox height (px)

// depth readout (m), a continuous through-line
function depthAt(t) {
  if (t < T(4)) return keys(t, [[0, 0], [3.8, 4], [T(4), 240, ease.inCubic]]);
  if (t < T(8)) return keys(t, [[T(4), 240], [T(5, 0.5), 3800, ease.outCubic], [T(8), 4096]]);
  return 4096 + Math.round(16 * (0.5 + 0.5 * Math.sin(t * 0.3)));
}

// big depth readout + scrolling ruler for the dive
function depthHud(h, t, A) {
  if (A <= 0.001) return;
  const d = depthAt(t);
  const cx = 960, cy = 540;
  h.save();
  h.globalAlpha = A;
  h.textAlign = 'center';
  h.font = '300 132px AX3'; h.fillStyle = 'rgba(225,248,255,0.92)';
  try { h.letterSpacing = '6px'; } catch (e) { /* */ }
  h.fillText(String(Math.round(d)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), cx, cy + 40);
  try { h.letterSpacing = '8px'; } catch (e) { /* */ }
  h.font = '400 18px Plex'; h.fillStyle = 'rgba(255,140,70,0.95)';
  h.fillText('METRES BELOW THE INTERFACE', cx, cy + 92);
  try { h.letterSpacing = '0px'; } catch (e) { /* */ }
  // ruler
  const x = 1720, px = 7; // px per metre
  h.strokeStyle = 'rgba(160,225,240,0.55)'; h.lineWidth = 1.5;
  h.beginPath(); h.moveTo(x, 150); h.lineTo(x, 930); h.stroke();
  const m0 = Math.floor((d - 60) / 5) * 5;
  for (let m = m0; m < d + 60; m += 5) {
    const y = cy + (m - d) * px;
    if (y < 150 || y > 930) continue;
    const big = m % 50 === 0, mid = m % 10 === 0;
    h.beginPath(); h.moveTo(x, y); h.lineTo(x - (big ? 34 : mid ? 18 : 9), y); h.stroke();
    if (big) { h.font = '400 13px Plex'; h.fillStyle = 'rgba(160,225,240,0.7)'; h.textAlign = 'right'; h.fillText(String(m), x - 42, y + 4); }
  }
  h.fillStyle = 'rgba(255,120,50,1)'; h.beginPath(); h.moveTo(x + 6, cy); h.lineTo(x + 20, cy - 7); h.lineTo(x + 20, cy + 7); h.fill();
  h.restore();
}
// darken box sides so extruded blocks read as 3D under flat emissive shading
function shadeBox(g) {
  const n = g.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const z = n.getZ(i), y = n.getY(i), x = n.getX(i);
    const s = z > 0.5 ? 1 : y > 0.5 ? 0.55 : x !== 0 ? 0.32 : y < -0.5 ? 0.2 : 0.1;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = s;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
}

// ================================================================ 1. SURFACE (bars 0-4)
function sceneSurface(ctx) {
  // Engine workaround: with autoClear on, every accumulate draw into accumRT clears it first, so a
  // multi-sample frame came out as (last sub-frame / n). All passes clear explicitly, so turn it off.
  ctx.renderer.autoClear = false;
  const scene = new THREE.Scene();
  const world = makeWorld(scene, { surface: true, rays: 44, rayArea: [60, 60], snow: 7000, seed: 3 });
  const cam = newCam(42);
  const line = makeLine(ctx, 'AX5', 'BELOW THE INTERFACE', { size: 0.2, depth: 0.05, tracking: 0.14, color: col(0, 0, 0), intensity: 1 });
  scene.add(line.group);
  const tA = 0, tDive = 3.9, tEnd = T(4);
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      const dv = prog(t, tDive, tEnd);
      const y = keys(t, [[0, -6.5], [tDive, -7.5], [tEnd, -86, ease.inCubic]]);
      const z = keys(t, [[0, 5.5], [tDive, 4.4], [tEnd, -6]]);
      const lookY = keys(t, [[0, 8.0], [tDive - 0.4, 7.0], [tDive + 2.2, -30, ease.inOutCubic], [tEnd, -80]]);
      const lookZ = keys(t, [[0, 1.5], [tDive, 0.8], [tEnd, -10]]);
      const yaw = keys(t, [[0, -0.1], [tEnd, 0.5]]);
      camLook(cam, [Math.sin(yaw) * 2, y, z], [Math.sin(yaw) * 2 + Math.sin(t * 0.3) * 0.4, y + lookY, lookZ], Math.sin(t * 0.4) * 0.03 + dv * 0.12);
      // text: fixed in the water, silhouetted against Snell's window
      placeInView(line.group, cam, 0.1 - t * 0.03, 0.05 + t * 0.04, 4.6, [0, 0, -0.02]);
      line.set(prog(t, 0.9, 2.6), { stagger: 0.6, rise: 0.4, out: prog(t, 3.8, 4.5), intensity: 0, col: col(0, 0, 0) });
      const deep = prog(y, -7, -84);
      world.update(t, cam, {
        fog: mixC(TEAL, DEEP, Math.pow(deep, 0.6)), density: lerp(0.024, 0.05, deep),
        shallow: 1 - deep, surfBright: 1.0 * (1 - deep), rayI: 0.3 + 0.5 * prog(t, 3.5, 6) * (1 - deep), snowBright: 0.8, plankton: deep,
        glowDir: new THREE.Vector3(0, -1, 0), glowCol: ORANGE.clone().multiplyScalar(0.07 * prog(t, 6.5, tEnd)),
      });
      return { bloom: 0.8, bloomThreshold: 0.8, exposure: 1 - 0.15 * prog(t, 8.2, tEnd), zoomBlur: 0.08 * ease.inCubic(dv) };
    },
    hud(h, f) { depthHud(h, f.t, prog(f.t, 4.7, 5.4)); },
  };
}

// ================================================================ 2. ABYSS (bars 4-8)
function sceneAbyss(ctx) {
  const scene = new THREE.Scene();
  const world = makeWorld(scene, { rays: 0, snow: 7000 });
  const cr = makeCreature(world); scene.add(cr.group);
  const cam = newCam(38);
  const l1 = makeLine(ctx, 'AX3', 'AN EMBEDDABLE', { size: 0.17, tracking: 0.45, color: ICE, intensity: 0.8 });
  const l2 = makeLine(ctx, 'AX5', 'AGENT HARNESS KERNEL', { size: 0.34, tracking: 0.08, color: WHITE, intensity: 0.92 });
  const l3 = makeLine(ctx, 'AX5', 'WRITTEN IN RUST', { size: 0.13, tracking: 0.6, color: ORANGE, intensity: 1.6 });
  const txt = new THREE.Group(); l1.group.position.y = 0.46; l3.group.position.y = -0.46; txt.add(l1.group, l2.group, l3.group); scene.add(txt);
  const heartHits = HITS.filter((h) => h[2] === 'heart');
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = f.lt;
      const y = keys(lt, [[0, 42], [3.2, 13, ease.outCubic], [6.5, 6.0], [f.len, 4.6]]);
      const r = keys(lt, [[0, 2.5], [3.2, 6], [6.5, 9.5], [f.len, 10.5]]);
      const a = keys(lt, [[0, 0.6], [f.len, 2.1]]) + 0.0;
      const tgt = [0, keys(lt, [[0, 0], [6.5, 0.2], [f.len, 0.4]]), 0];
      camLook(cam, [Math.cos(a) * r, y, Math.sin(a) * r], tgt, 0.02 * Math.sin(t * 0.5));
      cam.setViewOffset(1920, 1080, 0, keys(lt, [[4, 0], [6.5, -170]]), 1920, 1080);
      const hb = env(t, 0.28, heartHits);
      const wake = prog(lt, 1.0, 6.5, ease.inOutCubic);
      cr.update(t, cam, {
        heartI: (0.25 + 0.8 * wake) * (1 + hb * 1.2), rimI: 0.2 + 0.8 * wake, ambI: 0.15, spotI: 0.4 + 0.8 * wake, veinI: 0.3 + 0.7 * wake + hb,
        breathe: hb, beat: hb * 0.6, haloI: 0.3 + 0.5 * wake + hb * 0.6, haloScale: 8, spin: t * 0.4,
        tent: (i) => ({ len: 3.6 + 0.5 * Math.sin(i * 2.1), curl: 1.5 + 0.4 * Math.sin(t * 0.4 + i), wave: 0.35, droop: 0.9, speed: 0.6, radius: 0.19 }),
        pulses: () => pulseList(t, 0.8, 1.4, heartHits), pulseCol: CYAN, tipI: 0.25,
      });
      // text above the creature, in the dark water
      placeInView(txt, cam, 0, 2.55, 9.5);
      const p1 = prog(t, T(5, 2), T(6, 2)), p3 = prog(t, T(7, 0), T(7, 3));
      const out = prog(t, T(8) - 0.5, T(8));
      l1.set(p1, { stagger: 0.5, rise: 0.3, out });
      l2.set(prog(t, T(5, 3), T(6, 3)), { stagger: 0.45, rise: 0.3, out });
      l3.set(p3, { stagger: 0.55, rise: 0.2, out, intensity: 1.4 + 1.2 * hb });
      world.update(t, cam, {
        fog: DEEP, density: 0.045, snowBright: 1.1, plankton: 0.6 + wake, pulse: hb * 0.4, snowSize: 0.045,
        glowDir: new THREE.Vector3(0, -1, 0), glowCol: ORANGE.clone().multiplyScalar(0.04 * (1 - wake)),
      });
      return {
        exposure: 1, bloom: 0.55 + 0.25 * prog(lt, 2, 6) + hb * 0.3, bloomThreshold: 0.78, zoomBlur: 0.05 * (1 - prog(lt, 0, 2.5)),
        fade: lt < 0.6 ? 0.6 * (1 - lt / 0.6) : 0,
      };
    },
    hud(h, f) { depthHud(h, f.t, 1 - prog(f.t, T(4, 3.5), T(5, 0.5))); },
  };
}

// ================================================================ 3. ANATOMY (bars 8-12)
const CAPS = [
  ['EXECUTION LOOP', 'octos-agent'], ['CONTEXT', 'octos-agent'], ['MEMORY', 'octos-memory'], ['TOOLS', 'octos-agent · sandboxed'],
  ['SKILLS', 'octos-plugin'], ['WORKFLOWS', 'octos-pipeline'], ['COORDINATION', 'octos-swarm'], ['MODEL ROUTING', 'octos-llm · failover'],
];
const unfurlAt = (i) => T(8, i * 2);
function sceneAnatomy(ctx) {
  const scene = new THREE.Scene();
  const world = makeWorld(scene, { rays: 10, rayArea: [40, 40], snow: 6000, seed: 11 });
  const cr = makeCreature(world); scene.add(cr.group);
  const cam = newCam(40);
  let tipScreens = [];
  const kicks = HITS.filter((h) => h[2] === 'kick');
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = f.lt;
      const a = -0.2 + lt * 0.16 + 0.25 * ease.outExpo(prog(lt, 0, 1.2));
      const r = keys(lt, [[0, 8.5], [f.len, 12.5]]);
      const y = keys(lt, [[0, 1.2], [f.len, 3.2]]);
      camLook(cam, [Math.cos(a) * r, y, Math.sin(a) * r], [0, keys(lt, [[0, 0.6], [f.len, -0.4]]), 0], -0.04);
      const k = env(t, 0.25, kicks);
      cr.update(t, cam, {
        heartI: 1.0 + k * 0.7, rimI: 1, ambI: 0.2, spotI: 1, veinI: 1 + k, breathe: k, beat: k, haloI: 0.7 + k * 0.5, haloScale: 8, spin: t * 0.5,
        tent: (i) => {
          const u = prog(t, unfurlAt(i) - 0.2, unfurlAt(i) + 1.1, ease.outCubic);
          return { len: lerp(3.4, 6.2, u), curl: lerp(1.6, 0.25, u), wave: lerp(0.35, 0.5, u), droop: lerp(0.9, 0.15, u), speed: 0.8, radius: 0.2, tipI: 0.2 + u * 0.6 };
        },
        pulses: (i) => {
          const pl = pulseList(t, 0.9, 1.3, kicks);
          const own = t >= unfurlAt(i) ? [[(t - unfurlAt(i)) * 0.8, 2.5]] : [];
          return [...own, ...pl].slice(0, 6);
        },
        pulseCol: CYAN,
      });
      tipScreens = cr.tips.map((p) => project(cam, p));
      world.update(t, cam, { fog: DEEP, density: 0.04, rayI: 0.12, rayTop: 30, rayCol: col(0.3, 0.7, 0.9), snowBright: 1, plankton: 1, pulse: k * 0.5 });
      const flash = t < T(8) + 0.25 ? 0.35 * (1 - (t - T(8)) / 0.25) : 0;
      return { bloom: 1.0 + k * 0.4, bloomThreshold: 0.7, flash, flashColor: [0.6, 0.9, 1], zoomBlur: 0.12 * (1 - prog(lt, 0, 0.5)) };
    },
    hud(h, f) {
      const t = f.t;
      tipScreens.forEach((s, i) => {
        const a = prog(t, unfurlAt(i) + 0.3, unfurlAt(i) + 0.8);
        if (a <= 0 || s.behind) return;
        const focus = 1 - prog(t, unfurlAt(i) + 2 * BEAT - 0.15, unfurlAt(i) + 2 * BEAT + 0.15);
        const out = prog(t, T(12) - 0.4, T(12));
        const A = a * (1 - out);
        h.font = '500 34px AX5'; const wEst = h.measureText(CAPS[i][0]).width + 60;
        let dx = s.x < 960 ? -1 : 1;
        if (dx < 0 && s.x - 70 - wEst < 50) dx = 1;
        else if (dx > 0 && s.x + 70 + wEst > 1870) dx = -1;
        const lx = s.x + dx * 60, ly = s.y - 46 < 130 ? s.y + 70 : s.y - 46;
        h.strokeStyle = `rgba(120,230,255,${0.7 * A})`; h.lineWidth = 1.5;
        h.beginPath(); h.moveTo(s.x, s.y); h.lineTo(lx, ly); h.lineTo(lx + dx * lerp(40, 180, focus * a), ly); h.stroke();
        h.fillStyle = `rgba(160,240,255,${A})`; h.beginPath(); h.arc(s.x, s.y, 4, 0, TAU); h.fill();
        h.strokeStyle = `rgba(160,240,255,${0.5 * A})`; h.beginPath(); h.arc(s.x, s.y, 10 + 20 * (1 - a), 0, TAU); h.stroke();
        const al = dx < 0 ? 'right' : 'left';
        const tx = lx + dx * 8;
        if (focus > 0.02) {
          hudText(h, typed(CAPS[i][0], a * 1.4), tx, ly - 12, { font: `500 ${Math.round(lerp(18, 34, focus))}px AX5`, color: `rgba(230,250,255,${A})`, align: al, spacing: 2 });
          hudText(h, CAPS[i][1], tx, ly + 22, { font: '400 17px Plex', color: `rgba(255,140,70,${A * focus})`, align: al });
        } else {
          hudText(h, CAPS[i][0], tx, ly - 10, { font: '500 17px AX5', color: `rgba(200,240,255,${0.75 * A})`, align: al, spacing: 2 });
        }
      });
    },
  };
}

// ================================================================ 4. GATHER (bars 12-14)
function sceneGather(ctx) {
  const scene = new THREE.Scene();
  const world = makeWorld(scene, { rays: 0, snow: 6000 });
  const cr = makeCreature(world); scene.add(cr.group);
  const cam = newCam(40);
  const title = makeLine(ctx, 'AX9', 'ONE KERNEL.', { size: 0.34, tracking: 0.12, color: WHITE, intensity: 0.8 });
  scene.add(title.group);
  const kicks = HITS.filter((h) => h[2] === 'kick');
  const tBlack = T(13, 3);
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = f.lt;
      const pr = prog(t, T(12), tBlack);
      const r = lerp(11, 4.6, ease.inOutCubic(pr));
      const a = 0.9 + lt * 0.22;
      const k = env(t, 0.2, kicks);
      const shake = 0.03 * pr * pr;
      camLook(cam, [Math.cos(a) * r + noise1(t * 9) * shake, 1.1 + lerp(2.5, 0.3, pr), Math.sin(a) * r + noise1(t * 9 + 5) * shake], [0, 1.1, 0], lerp(0, 0.18, pr));
      const black = t >= tBlack;
      const hI = black ? 0.05 : (1.0 + 1.0 * pr) * (1 + k * 0.6);
      cr.update(t, cam, {
        heartI: hI, rimI: black ? 0.05 : 1 + pr, ambI: black ? 0 : 0.2, spotI: black ? 0 : 1 + pr * 2, veinI: black ? 0 : 1 + 2 * pr + k, breathe: k + pr,
        beat: k + pr * 0.5, haloI: black ? 0.0 : 0.7 + pr * 0.6 + k * 0.4, haloScale: 7 - pr * 3, ringI: black ? 0.08 : 1, mantleA: black ? 0.25 : 1, spin: t * (0.5 + pr * 3),
        tent: (i) => ({ len: lerp(6.0, 3.2, ease.inCubic(pr)), curl: lerp(0.35, 3.0, pr), wave: lerp(0.5, 0.15, pr), droop: lerp(0.2, 0.9, pr), speed: 1 + pr * 3, radius: 0.2 }),
        pulses: () => (black ? [] : pulseList(t, lerp(0.9, 2.2, pr), 1.0, kicks).map(([u, g]) => [1 - u, g * 1.5])),
        pulseCol: mixC(CYAN, ORANGE, pr), tipI: 0.4,
      });
      cr.group.visible = true;
      cr.heart.children.forEach((c) => { c.visible = true; });
      if (black) { cr.mantle.visible = false; cr.tents.forEach((m) => { m.visible = false; }); cr.halo.visible = false; cr.heart.children[3].visible = false; cr.hotMat.color.setRGB(3, 2.4, 2); } else { cr.halo.visible = true; }
      placeInView(title.group, cam, 0, -1.3, 6.2, [0, 0, 0]);
      title.set(prog(t, T(12), T(12, 1.5)), { stagger: 0.5, rise: 0.25, out: prog(t, T(13, 1.5), T(13, 2.5)), intensity: 0.8 + k * 0.1 });
      world.update(t, cam, { fog: DEEP, density: 0.045, snowBright: black ? 0.1 : 1, plankton: 1 + pr, pulse: k, flow: [0, 0, 0] });
      return {
        bloom: 0.8 + pr * 0.3 + k * 0.2, bloomThreshold: 0.86, ca: 0.0015 + pr * 0.004, zoomBlur: pr * pr * 0.04 + k * 0.015 * pr,
        exposure: black ? 0.45 : 1, saturation: 1 + pr * 0.2,
      };
    },
  };
}

// ================================================================ 5. REACH — the drop (bars 14-18)
const SURFS = [
  ['LINUX', 'x86-64 · ARM64'], ['MACOS', 'x86-64 · ARM64'], ['WINDOWS', 'x86-64 · ARM64'], ['WASM', 'in the browser · speaks OUP'],
  ['PYTHON', 'pyo3'], ['SWIFT / KOTLIN', 'uniffi'], ['C ABI', 'native bindings'], ['RISC-V', 'unverified'],
];
function panelMesh(w, h) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { I: { value: 0 }, hit: { value: 0 }, time: { value: 0 }, c1: { value: CYAN.clone() }, c2: { value: ORANGE.clone() } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float I, hit, time; uniform vec3 c1, c2; varying vec2 vUv;
      void main(){ vec2 q = vUv - 0.5; vec2 aq = abs(q) * vec2(${(w / h).toFixed(3)}, 1.0);
        float edge = smoothstep(0.012, 0.0, abs(max(aq.x - ${(0.5 * w / h - 0.012).toFixed(3)}, aq.y - 0.488)));
        float scan = 0.5 + 0.5 * sin(vUv.y * 180.0 - time * 3.0);
        float r = length(q * vec2(${(w / h).toFixed(3)}, 1.0));
        float ring = exp(-((r - hit * 1.4) * 14.0) * ((r - hit * 1.4) * 14.0)) * (1.0 - hit);
        vec3 c = c1 * (edge * 2.2 + 0.05 + 0.04 * scan) * I + c2 * ring * 4.0 * I + c2 * exp(-r*r*40.0) * 2.5 * I;
        gl_FragColor = vec4(c, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  g.add(m); g.userData.mat = mat;
  return g;
}
const surfPos = (i) => {
  const a = (i / 8) * TAU + 0.35;
  const e = [0.55, -0.05, 0.3, 0.75, 0.1, 0.5, -0.12, 0.35][i];
  const r = [16, 18, 15, 19, 17, 15.5, 18, 16.5][i];
  return new THREE.Vector3(...sph(r, a, e, [0, 1, 0]));
};
function sceneReach(ctx) {
  const scene = new THREE.Scene();
  const world = makeWorld(scene, { rays: 16, rayArea: [60, 60], snow: 7000, seed: 21 });
  const cr = makeCreature(world); scene.add(cr.group);
  const cam = newCam(42);
  const panels = SURFS.map((s, i) => { const p = panelMesh(3.4, 2.1); p.position.copy(surfPos(i)); p.lookAt(0, 1, 0); scene.add(p); return p; });
  const title = makeLine(ctx, 'AX9', 'EVERY SURFACE.', { size: 0.36, tracking: 0.12, color: WHITE, intensity: 0.8 });
  scene.add(title.group);
  const kicks = HITS.filter((h) => h[2] === 'kick');
  const D = T(14);
  const hitT = (i) => D + 0.18 + 0.05 * i;
  let scr = [];
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = f.lt;
      const k = env(t, 0.18, kicks);
      const whip = T(16);
      if (t < whip) {
        const pull = ease.outExpo(prog(t, D, D + 1.6));
        const r = lerp(3.0, 27, pull) + lt * 0.8;
        const a = 0.3 + pull * 1.0 + lt * 0.1;
        const e = lerp(0.1, 0.32, pull);
        camLook(cam, sph(r, a, e, [0, 1.1, 0]), [0, lerp(1.1, 2.5, pull), 0], 0.08 * (1 - pull) + noise1(t * 11) * 0.015 * k);
      } else {
        const ll = t - whip;
        const a = 2.4 + ll * 0.13;
        camLook(cam, sph(24, a, -0.42, [0, 1, 0]), [0, 5, 0], 0.05 + noise1(t * 11) * 0.012 * k);
      }
      cr.update(t, cam, {
        heartI: 1.6 * (1 + k * 0.6), rimI: 1.3, ambI: 0.3, spotI: 1.5, veinI: 1.5 + k * 2, breathe: k, beat: k, haloI: 0.9 + k * 0.6, haloScale: 8, spin: t * 0.8,
        tent: (i) => {
          const ext = ease.outExpo(prog(t, D, hitT(i)));
          const tg = cr.group.worldToLocal(surfPos(i).clone());
          const glow = Math.exp(-Math.max(0, t - hitT(i)) * 3) * (t >= hitT(i) ? 1 : 0);
          return { len: 3.2, curl: 2.5, wave: 0.2, droop: 0.9, reach: ext > 0 ? 1 : 0, ext: Math.max(0.02, ext), target: tg, sag: 0.1, radius: 0.24, reachGlow: 0.5 + glow * 3 + k * 0.6 };
        },
        pulses: () => pulseList(t, 1.1, 1.0, kicks).map(([u, g]) => [u, g * 1.2]),
        pulseCol: ORANGE, tipI: 0.8,
      });
      panels.forEach((p, i) => {
        const on = prog(t, hitT(i), hitT(i) + 0.1);
        p.userData.mat.uniforms.I.value = on * (0.7 + 0.6 * k);
        p.userData.mat.uniforms.hit.value = clamp((t - hitT(i)) / 0.9);
        p.userData.mat.uniforms.time.value = t;
      });
      scr = panels.map((p) => project(cam, p.position));
      placeInView(title.group, cam, 0, -1.45, 6.8);
      title.set(prog(t, D + 0.05, D + 0.5), { stagger: 0.35, rise: 0.15, out: prog(t, whip - 0.5, whip - 0.1), intensity: 0.8 + k * 0.1 });
      world.update(t, cam, { fog: DEEP, density: 0.03, rayI: 0.25, rayTop: 40, rayCol: col(0.35, 0.75, 1), snowBright: 1.1, plankton: 1.5, pulse: k, snowSize: 0.05 });
      const sd = t - D;
      const flash = sd < 0.3 ? (1 - sd / 0.3) ** 2 : 0;
      const wd = t - whip;
      return {
        flash: Math.max(flash, wd >= 0 && wd < 0.2 ? 0.35 * (1 - wd / 0.2) : 0), flashColor: [1, 0.85, 0.7],
        zoomBlur: Math.max(sd < 0.7 ? 0.5 * (1 - sd / 0.7) ** 2 : 0, wd >= -0.12 && wd < 0.35 ? 0.35 * (1 - Math.abs(wd) / 0.35) : 0, k * 0.035),
        bloom: 0.85 + k * 0.3, bloomThreshold: 0.86, ca: 0.002 + k * 0.003 + flash * 0.01,
        shake: [noise1(t * 30) * 0.006 * (flash + k * 0.3), noise1(t * 30 + 7) * 0.006 * (flash + k * 0.3)],
      };
    },
    hud(h, f) {
      const t = f.t;
      scr.forEach((s, i) => {
        const a = prog(t, hitT(i) + 0.3 + i * 0.12, hitT(i) + 0.6 + i * 0.12) * (1 - prog(t, T(18) - 0.3, T(18)));
        if (a <= 0 || s.behind || s.x < 40 || s.x > 1880 || s.y < 80 || s.y > 1000) return;
        h.font = '500 24px AX5'; const wEst = h.measureText(SURFS[i][0]).width + 110;
        let dx = s.x < 960 ? -1 : 1;
        if (dx < 0 && s.x - wEst < 50) dx = 1; else if (dx > 0 && s.x + wEst > 1870) dx = -1;
        const al = dx < 0 ? 'right' : 'left';
        h.strokeStyle = `rgba(255,150,90,${0.7 * a})`; h.lineWidth = 1.5;
        h.beginPath(); h.moveTo(s.x, s.y); h.lineTo(s.x + dx * 40, s.y - 30); h.lineTo(s.x + dx * 90, s.y - 30); h.stroke();
        hudText(h, SURFS[i][0], s.x + dx * 96, s.y - 36, { font: '500 24px AX5', color: `rgba(235,250,255,${a})`, align: al, spacing: 2 });
        hudText(h, SURFS[i][1], s.x + dx * 96, s.y - 10, { font: '400 16px Plex', color: `rgba(255,150,90,${a})`, align: al });
      });
    },
  };
}

// ================================================================ 6. PROTOCOL (bars 18-20)
const METHODS = ['client_hello', 'config/capabilities/list', 'session/open', 'turn/start', 'turn/steer', 'approval/respond',
  'user_question/respond', 'turn/interrupt', 'peer/prepare', 'peer/gather', 'task/*'];
function sceneProtocol(ctx) {
  const scene = new THREE.Scene();
  const world = makeWorld(scene, { rays: 0, rayArea: [90, 90], snow: 7000, seed: 31 });
  const cr = makeCreature(world); scene.add(cr.group);
  const cam = newCam(44);
  const H0 = 90;
  const labels = METHODS.map((m, k) => {
    const l = makeLine(ctx, 'Plex', m, { size: 0.26, depth: 0.02, tracking: 0.02, color: k % 2 ? CYAN : ORANGE, intensity: 1.0 });
    scene.add(l.group); return l;
  });
  const oup = makeLine(ctx, 'AX9', 'OUP', { size: 1.1, tracking: 0.14, color: WHITE, intensity: 0.8 });
  scene.add(oup.group);
  const kicks = HITS.filter((h) => h[2] === 'kick');
  const S0 = T(18);
  const camY = (t) => 1.5 + (t - S0) * 7.5;
  const labelY = (k) => 6 + k * 3.1;
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = f.lt;
      const k = env(t, 0.18, kicks);
      const yc = camY(t);
      camLook(cam, [5.2, yc, 5.6], [-0.4, yc + 3.6, -0.2], -0.05);
      cr.group.position.set(0, 0, 0);
      cr.update(t, cam, {
        heartI: 1.6, rimI: 1.3, ambI: 0.3, spotI: 1.4, veinI: 1.5, beat: k, haloI: 0.8, spin: t,
        tent: (i) => {
          if (i === 0) return { reach: 1, ext: 1, target: new THREE.Vector3(-0.35, H0, -0.12), sag: 0.004, radius: 0.36, reachGlow: 0.05 + k * 0.1, pulseCol: ORANGE };
          return { len: 3.5, curl: 1.8, wave: 0.3, droop: 0.9, radius: 0.2 };
        },
        pulses: (i) => {
          if (i !== 0) return pulseList(t, 0.25, 4, kicks).map(([u, g]) => [u, g * 0.35]);
          // requests up (from below the camera), responses down
          return recent(t, 1.5, kicks).slice(-6).map((h, j) => {
            const dir = hash(h[0] * 3.1) > 0.4 ? 1 : -1;
            const y0 = camY(h[0]) + (dir > 0 ? -4 : 12);
            return [(y0 + dir * (t - h[0]) * 16) / H0, 1.0];
          });
        },
        pulseCol: ORANGE, tipI: 0.5,
      });
      labels.forEach((l, j) => {
                const ly = labelY(j);
        l.group.position.set(0, ly, 0);
        l.group.quaternion.copy(cam.quaternion);
        l.group.translateX(l.width * 0.5 + 0.95);
        l.group.translateY(-0.12);
        const rv = prog(yc + 5.5 - ly, 0, 1.2);
        l.set(rv, { stagger: 0.7, rise: 0.1, out: prog(yc - ly, -1.5, 0.2), intensity: 0.9 + 1.2 * Math.exp(-Math.abs(yc + 3 - ly)) });
      });
      placeInView(oup.group, cam, -3.3, 0.35, 10, [0, 0.12, 0]);
      oup.set(prog(t, S0, S0 + 0.45), { stagger: 0.4, rise: 0.2, out: prog(t, T(20) - 0.35, T(20)), intensity: 0.8 + k * 0.1 });
      world.update(t, cam, { fog: col(0.004, 0.018, 0.026), density: 0.028, rayI: 0.1, rayTop: 95, rayCol: col(0.35, 0.8, 1), snowBright: 1, plankton: 1.2, pulse: k, flow: [0, 0, 0] });
      const sd = t - S0;
      return {
        flash: sd < 0.25 ? 0.5 * (1 - sd / 0.25) : 0, flashColor: [0.6, 0.9, 1],
        zoomBlur: Math.max(sd < 0.4 ? 0.35 * (1 - sd / 0.4) : 0, k * 0.03), bloom: 0.8 + k * 0.3, bloomThreshold: 0.8, ca: 0.002 + k * 0.003,
      };
    },
    hud(h, f) {
      const t = f.t;
      const a = prog(t, T(18, 0.5), T(18, 1.5)) * (1 - prog(t, T(20) - 0.35, T(20)));
      if (a <= 0) return;
      hudText(h, 'OCTOS UI PROTOCOL', 190, 640, { font: '500 26px AX5', color: `rgba(235,250,255,${a})`, spacing: 3 });
      hudText(h, typed('JSON-RPC 2.0  ·  WEBSOCKET OR STDIO', prog(t, T(18, 1), T(18, 3))), 190, 676, { font: '400 19px Plex', color: `rgba(255,150,90,${a})` });
      hudText(h, typed('$ octos serve --stdio', prog(t, T(19, 0), T(19, 2))), 190, 716, { font: '400 19px Plex', color: `rgba(140,230,255,${a * 0.9})` });
    },
  };
}

// ================================================================ 7. BOUNDARY (bars 20-22)
function sceneBoundary(ctx) {
  const scene = new THREE.Scene();
  const world = makeWorld(scene, { surface: true, rays: 30, rayArea: [60, 60], snow: 6000, seed: 41 });
  const cr = makeCreature(world); scene.add(cr.group);
  const cam = newCam(46);
  const SY = 17;
  const l1 = makeLine(ctx, 'AX5', 'YOUR APP OWNS THE INTERFACE.', { size: 0.4, tracking: 0.1, color: WHITE, intensity: 0.85 });
  const l2 = makeLine(ctx, 'AX5', 'OCTOS OWNS THE RUNTIME.', { size: 0.4, tracking: 0.1, color: ORANGE, intensity: 1.5 });
  scene.add(l1.group, l2.group);
  const kicks = HITS.filter((h) => h[2] === 'kick');
  const S0 = T(20);
  const touch = [...Array(8)].map((_, i) => { const a = (i / 8) * TAU + 0.35; const r = 9 + 3 * hash(i + 9); return new THREE.Vector3(Math.cos(a) * r, SY, Math.sin(a) * r * 0.7); });
  // ripple rings on the surface where arms touch it
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, I: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float time, I; varying vec2 vUv; void main(){ float r = length(vUv-0.5)*2.0; float w = 0.0;
      for (int k=0;k<3;k++){ float ph = fract(time*0.6 + float(k)/3.0); w += exp(-((r-ph)*18.0)*((r-ph)*18.0))*(1.0-ph); }
      vec3 c = vec3(1.0,0.35,0.08)*(w*1.8 + exp(-r*r*30.0)*3.0) * I; gl_FragColor = vec4(c, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const ripples = touch.map((p) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), ringMat); m.rotation.x = Math.PI / 2; m.position.copy(p).add(new THREE.Vector3(0, -0.05, 0)); scene.add(m); return m; });
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = f.lt;
      const k = env(t, 0.18, kicks);
      const a = 1.2 + lt * 0.06;
      const r = lerp(24, 20, prog(lt, 0, f.len, ease.outCubic));
      camLook(cam, [Math.cos(a) * r, lerp(-3.5, -2.5, lt / f.len), Math.sin(a) * r], [0, 7.8, 0], 0);
      const reachP = ease.outCubic(prog(t, S0, S0 + 0.8));
      cr.update(t, cam, {
        heartI: 1.6 * (1 + k * 0.5), rimI: 1.2, ambI: 0.5, spotI: 1.4, veinI: 1.5 + k, beat: k, haloI: 0.8 + k * 0.5, haloScale: 8, spin: t,
        tent: (i) => ({ reach: 1, ext: Math.max(0.05, reachP), target: cr.group.worldToLocal(touch[i].clone()), sag: 0.08, radius: 0.24, reachGlow: 0.6 + k * 0.5 }),
        pulses: () => pulseList(t, 0.9, 1.2, kicks), pulseCol: ORANGE, tipI: 0.8,
      });
      ringMat.uniforms.time.value = t; ringMat.uniforms.I.value = reachP;
      placeInView(l1.group, cam, 0, 2.55, 13);
      placeInView(l2.group, cam, 0, -2.55, 13);
      l1.set(prog(t, S0 + 0.1, S0 + 1.1), { stagger: 0.5, rise: 0.2, out: prog(t, T(22) - 0.3, T(22)), intensity: 0.85 });
      l2.set(prog(t, T(21), T(21) + 1.0), { stagger: 0.5, rise: 0.2, out: prog(t, T(22) - 0.3, T(22)), intensity: 1.4 + k * 0.5 });
      world.update(t, cam, {
        fog: col(0.006, 0.035, 0.045), density: 0.03, shallow: 0.6, surfBright: 0.9, surfY: SY, rayI: 0.35, rayTop: SY, rayCol: col(0.4, 0.85, 1),
        snowBright: 0.9, plankton: 1, pulse: k,
      });
      const sd = t - S0;
      return {
        flash: sd < 0.2 ? 0.4 * (1 - sd / 0.2) : 0, flashColor: [0.7, 0.95, 1], zoomBlur: Math.max(sd < 0.35 ? 0.3 * (1 - sd / 0.35) : 0, k * 0.03),
        bloom: 1.05 + k * 0.3, bloomThreshold: 0.72, ca: 0.002,
      };
    },
    hud(h, f) {
      const t = f.t;
      const a = prog(t, T(21, 2), T(21, 3)) * (1 - prog(t, T(22) - 0.3, T(22)));
      if (a > 0) hudText(h, typed('DRIVE IT FROM YOUR APP — OR FROM ANOTHER AGENT: CODEX, CLAUDE CODE', prog(t, T(21, 2), T(21, 3.6))), 960, 1080 - LB - 26,
        { font: '400 17px Plex', color: `rgba(170,235,255,${a})`, align: 'center', spacing: 1 });
    },
  };
}

// ================================================================ 8. LOGO (bars 22-26)
const LOGO = [
  ' ██████╗  ██████╗████████╗ ██████╗ ███████╗',
  '██╔═══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔════╝',
  '██║   ██║██║        ██║   ██║   ██║███████╗',
  '██║   ██║██║        ██║   ██║   ██║╚════██║',
  '╚██████╔╝╚██████╗   ██║   ╚██████╔╝███████║',
  ' ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚══════╝',
];
const BOX = { '═': 'lr', '║': 'ud', '╔': 'rd', '╗': 'ld', '╚': 'ur', '╝': 'ul' };
function sceneLogo(ctx) {
  const scene = new THREE.Scene();
  const world = makeWorld(scene, { rays: 22, rayArea: [60, 40], snow: 6000, seed: 51 });
  const cam = newCam(38);
  const cols = Math.max(...LOGO.map((r) => [...r].length));
  const CW = 0.5, CH = 1.0; // cell size (monospace aspect)
  const blocks = [], strokes = [];
  LOGO.forEach((row, r) => [...row].forEach((ch, c) => {
    const x = (c - (cols - 1) / 2) * CW, y = ((LOGO.length - 1) / 2 - r) * CH;
    if (ch === '█') blocks.push({ x, y, c, r });
    else if (BOX[ch]) {
      const g = 0.11, th = 0.05;
      for (const s of BOX[ch]) for (const o of [-g, g]) {
        if (s === 'l') strokes.push({ x: x - CW / 4, y: y + o, sx: CW / 2 + th, sy: th, c, r });
        if (s === 'r') strokes.push({ x: x + CW / 4, y: y + o, sx: CW / 2 + th, sy: th, c, r });
        if (s === 'u') strokes.push({ x: x + o, y: y + CH / 4, sx: th, sy: CH / 2 + th, c, r });
        if (s === 'd') strokes.push({ x: x + o, y: y - CH / 4, sx: th, sy: CH / 2 + th, c, r });
      }
    }
  }));
  const bGeo = new THREE.BoxGeometry(CW * 0.9, CH * 0.92, 0.42).toNonIndexed(); shadeBox(bGeo);
  const bMesh = new THREE.InstancedMesh(bGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true, vertexColors: true }), blocks.length);
  const sMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }), strokes.length);
  bMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(blocks.length * 3), 3);
  sMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(strokes.length * 3), 3);
  bMesh.frustumCulled = sMesh.frustumCulled = false;
  const logo = new THREE.Group(); logo.add(bMesh, sMesh); scene.add(logo);
  // the kernel glow behind, where the blocks burst from
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { I: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float I; varying vec2 vUv; void main(){ vec2 q = (vUv-0.5)*vec2(2.6,1.0)*2.0; float d = length(q);
      vec3 c = vec3(1.0,0.25,0.04)*(exp(-d*d*9.0)*0.7 + exp(-d*d*1.5)*0.08) + vec3(0.1,0.6,0.8)*exp(-d*d*0.6)*0.03; gl_FragColor = vec4(c*I, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), haloMat); halo.position.z = -6; scene.add(halo);
  const tag = makeLine(ctx, 'AX5', 'AGENTIC OPERATING SYSTEM', { size: 0.46, tracking: 0.42, color: ICE, intensity: 0.8 });
  const url = makeLine(ctx, 'Plex', 'github.com/octos-org/octos', { size: 0.4, tracking: 0.04, color: ORANGE, intensity: 2.6 });
  tag.group.position.set(0, -4.6, 0); url.group.position.set(0, -5.7, 0);
  scene.add(tag.group, url.group);
  const S0 = T(22);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e3 = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
  const heartHits = HITS.filter((h) => h[0] >= S0);
  function place(mesh, list, t, isStroke) {
    list.forEach((b, i) => {
      const h1 = hash(i * 1.37 + (isStroke ? 50 : 0)), h2 = hash(i * 2.11 + 7), h3 = hash(i * 3.7 + 1);
      const delay = 0.04 + (Math.abs(b.x) / 11) * 0.5 + h1 * 0.25 + (isStroke ? 0.45 : 0);
      const p = ease.outExpo(prog(t, S0 + delay, S0 + delay + (isStroke ? 1.0 : 1.3)));
      // burst from the kernel at the centre, curving out through space
      const sx = (h2 - 0.5) * 3, sy = (h3 - 0.5) * 2, sz = -6;
      const bend = Math.sin(p * Math.PI) * (4 + 6 * h1);
      pv.set(lerp(sx, b.x, p) + (h2 - 0.5) * bend, lerp(sy, b.y, p) + (h3 - 0.5) * bend, lerp(sz, 0, p) + bend * 0.8);
      e3.set((1 - p) * (h1 * 6), (1 - p) * (h2 * 6), 0); qq.setFromEuler(e3);
      const s = p <= 0 ? 0.0001 : Math.min(1, p * 3);
      if (isStroke) sv.set(b.sx * s, b.sy * s, s); else sv.set(s, s, s);
      m4.compose(pv, qq, sv); mesh.setMatrixAt(i, m4);
      const hot = Math.exp(-Math.max(0, t - (S0 + delay + 0.3)) * 2.5);
      const hb = env(t, 0.3, heartHits);
      const wave = 0.5 + 0.5 * Math.sin(b.x * 0.9 - (t - S0) * 2.2);
      if (isStroke) mesh.instanceColor.setXYZ(i, 0.12 + 0.2 * hot + 0.05 * wave, 0.55 + 0.9 * hot + 0.2 * wave, 0.8 + 1.4 * hot + 0.3 * wave);
      else mesh.instanceColor.setXYZ(i, 1.25 + 1.2 * hot + 0.35 * hb + 0.25 * wave, 0.26 + 0.6 * hot + 0.1 * hb + 0.06 * wave, 0.05 + 0.3 * hot);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = f.lt;
      const z = lerp(27, 23.5, ease.outCubic(prog(lt, 0, f.len)));
      const a = lerp(0.18, -0.06, prog(lt, 0, f.len, ease.inOutCubic));
      camLook(cam, [Math.sin(a) * z, lerp(1.4, -0.4, prog(lt, 0, f.len)), Math.cos(a) * z], [0, -0.9, 0], 0);
      place(bMesh, blocks, t, false);
      place(sMesh, strokes, t, true);
      haloMat.uniforms.I.value = (0.4 + 2.5 * Math.exp(-lt * 1.5)) * (1 + env(t, 0.3, heartHits) * 0.5);
      tag.set(prog(t, T(23), T(23, 2.5)), { stagger: 0.6, rise: 0.2 });
      url.set(prog(t, T(24), T(24, 1.5)), { stagger: 0.7, rise: 0.15 });
      world.update(t, cam, { fog: col(0.003, 0.012, 0.018), density: 0.022, rayI: 0.18, rayTop: 30, rayCol: col(0.35, 0.75, 1), snowBright: 0.9, plankton: 0.8, snowSize: 0.045 });
      const sd = lt;
      return {
        flash: sd < 0.45 ? 0.9 * (1 - sd / 0.45) ** 1.5 : 0, flashColor: [1, 0.8, 0.6],
        zoomBlur: sd < 0.8 ? 0.45 * (1 - sd / 0.8) ** 2 : 0, bloom: 1.0, bloomThreshold: 0.72, ca: 0.0018 + (sd < 0.5 ? 0.01 * (1 - sd / 0.5) : 0),
        shake: sd < 0.6 ? [noise1(t * 40) * 0.008 * (1 - sd / 0.6), noise1(t * 40 + 3) * 0.008 * (1 - sd / 0.6)] : [0, 0],
      };
    },
  };
}

// ================================================================ global post + HUD
const SCENES = [
  { name: 'surface', from: 0, to: T(4), make: sceneSurface, label: '01  THE SURFACE' },
  { name: 'abyss', from: T(4), to: T(8), make: sceneAbyss, label: '02  THE ABYSS' },
  { name: 'anatomy', from: T(8), to: T(12), make: sceneAnatomy, label: '03  ANATOMY' },
  { name: 'gather', from: T(12), to: T(14), make: sceneGather, label: '04  ONE KERNEL' },
  { name: 'reach', from: T(14), to: T(18), make: sceneReach, label: '05  EVERY SURFACE' },
  { name: 'protocol', from: T(18), to: T(20), make: sceneProtocol, label: '06  PROTOCOL' },
  { name: 'boundary', from: T(20), to: T(22), make: sceneBoundary, label: '07  THE BOUNDARY' },
  { name: 'logo', from: T(22), to: DUR, make: sceneLogo, label: '' },
];

export default {
  bpm: BPM, dur: DUR, audio: 'audio/track.wav',
  fonts: {
    AX9: '/fonts/Archivo-w1250-900.ttf',
    AX5: '/v1-abyss/fonts/Archivo-w1250-500.ttf',
    AX3: '/v1-abyss/fonts/Archivo-w1250-300.ttf',
    Plex: '/fonts/IBMPlexMono-Regular.ttf',
    PlexB: '/fonts/IBMPlexMono-SemiBold.ttf',
  },
  scenes: SCENES,
  post(t) {
    return {
      bloom: 0.75, bloomRadius: 0.4, bloomThreshold: 0.78, grain: 0.055, vignette: 0.62, ca: 0.0018,
      fade: Math.max(1 - prog(t, 0, 1.8), prog(t, DUR - 2.4, DUR - 0.1)),
    };
  },
  hud(h, f, s) {
    const t = f.t;
    // letterbox
    h.fillStyle = '#000'; h.fillRect(0, 0, 1920, LB); h.fillRect(0, 1080 - LB, 1920, LB);
    const fadeIn = prog(t, 1.2, 2.6), fadeOut = 1 - prog(t, T(22) - 0.2, T(22));
    const A = fadeIn * fadeOut;
    if (A <= 0) return;
    const dim = `rgba(150,200,215,${0.55 * A})`;
    hudText(h, 'OCTOS', 64, 42, { font: '900 17px AX9', color: `rgba(235,250,255,${0.85 * A})`, spacing: 3 });
    hudText(h, 'AGENTIC OPERATING SYSTEM', 172, 42, { font: '400 13px Plex', color: dim, spacing: 2 });
    const d = depthAt(t);
    hudText(h, `DEPTH  ${String(Math.round(d)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} M`, 1856, 42, { font: '400 15px Plex', color: `rgba(255,140,70,${0.85 * A})`, align: 'right', spacing: 2 });
    const sc = SCENES.find((x) => x.name === s.name);
    if (sc?.label) {
      const la = prog(t, sc.from + 0.1, sc.from + 0.6) * (1 - prog(t, sc.to - 0.3, sc.to));
      hudText(h, sc.label, 64, 1080 - 26, { font: '400 13px Plex', color: `rgba(150,200,215,${0.7 * la * A})`, spacing: 3 });
    }
    hudText(h, 'github.com/octos-org/octos', 1856, 1080 - 26, { font: '400 13px Plex', color: dim, align: 'right', spacing: 1 });
    // beat ticks
    const bt = Math.floor(t / BEAT) % 4;
    for (let i = 0; i < 4; i++) { h.fillStyle = i === bt ? `rgba(255,120,50,${0.8 * A})` : `rgba(150,200,215,${0.25 * A})`; h.fillRect(1560 + i * 14, 1080 - 36, 8, 8); }
  },
};
