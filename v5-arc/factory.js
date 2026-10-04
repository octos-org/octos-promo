// "The Factory" props: floor, glass container, app blocks (UI panels, backend boxes, database), light cones.
import * as THREE from 'three';
import { flat, canvasTex, frameBox, GRAPH, GRAPH2, STEEL, ORANGE, GREEN, BONE, RED, CSS } from './lib.js';
import { mulberry32 } from '../engine/util.js';

// graphite factory floor with painted grid + hazard border; receives shadows
export function floor(scene, { size = 200, y = 0, cell = 1, tint = 0x1c1d20, lines = 0x2b2d31, rough = 0.85 } = {}) {
  const px = 2048, cells = 16;
  const tex = canvasTex(px, px, (g, w) => {
    g.fillStyle = '#' + tint.toString(16).padStart(6, '0'); g.fillRect(0, 0, w, w);
    // concrete mottling (seeded)
    const r = mulberry32(3);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.015 + r() * 0.02})`; const s = 4 + r() * 40; g.fillRect(r() * w, r() * w, s, s); }
    g.strokeStyle = '#' + lines.toString(16).padStart(6, '0'); g.lineWidth = 3;
    for (let i = 0; i <= cells; i++) { const p = (i / cells) * w; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, w); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(size / (cells * cell), size / (cells * cell));
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: 0.1, envMapIntensity: 0.4 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true;
  scene.add(m);
  return m;
}

export const steelMat = () => new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.45, metalness: 0.85, envMapIntensity: 0.9 });
export const castMat = () => new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.5, metalness: 0.2, emissive: 0xff4a0a, emissiveIntensity: 0.15 });

// glass box with a steel frame and orange corner castings; origin at floor centre
export function glassContainer(w, h, d, { beam = 0.16 } = {}) {
  const group = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xaecbd6, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.075, clearcoat: 1, clearcoatRoughness: 0.05,
    envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false,
  });
  const pane = new THREE.Mesh(new THREE.BoxGeometry(w - beam, h - beam, d - beam), glass);
  pane.position.y = h / 2; pane.renderOrder = 5;
  const sm = steelMat();
  const frame = frameBox(w, h, d, beam, sm); frame.position.y = h / 2;
  const cm = castMat();
  const casts = new THREE.Group();
  for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(beam * 1.6, beam * 1.6, beam * 1.6), cm);
    c.position.set(sx * (w / 2 - beam * 0.5), sy * (h - beam) + beam / 2, sz * (d / 2 - beam * 0.5)); c.castShadow = true;
    casts.add(c);
  }
  group.add(frame, casts, pane);
  return { group, glass, frame, castMat: cm, steel: sm, w, h, d };
}

// additive light cone (fake volumetric) from apex (top) spreading down to radius r over height h
export function lightCone(r, h, color = 0xffe2c4, strength = 0.25) {
  const geo = new THREE.CylinderGeometry(0.05, r, h, 48, 1, true);
  geo.translate(0, -h / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color(color).multiplyScalar(strength) }, k: { value: 1 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; uniform float dummy;
      void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 col; uniform float k; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.6); float a = f * pow(clamp(vY, 0.0, 1.0), 1.3) * k; gl_FragColor = vec4(col * a, 1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 8;
  return m;
}

// ---------- app blocks ----------
// fake web-UI screen texture (header, nav, rows, button), seeded variants
export function uiTexture(seed = 1, { accent = CSS.orange } = {}) {
  return canvasTex(512, 320, (g, w, h) => {
    const r = mulberry32(seed);
    g.fillStyle = '#0f1114'; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.fillRect(0, 0, w, 34);
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 4; i++) g.fillRect(200 + i * 70, 12, 50, 10);
    g.fillStyle = '#e9e5dc'; g.fillRect(16, 11, 90, 12);
    const kind = Math.floor(r() * 3);
    if (kind === 0) { // list
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#1a1d21' : '#15181b'; g.fillRect(16, 50 + i * 40, w - 32, 34); g.fillStyle = '#9c978f'; g.fillRect(28, 62 + i * 40, 120 + r() * 200, 8); g.fillStyle = '#2fe27a'; g.fillRect(w - 70, 60 + i * 40, 36, 14); }
    } else if (kind === 1) { // form
      for (let i = 0; i < 3; i++) { g.fillStyle = '#9c978f'; g.fillRect(40, 60 + i * 66, 90, 8); g.strokeStyle = '#5e5b57'; g.lineWidth = 3; g.strokeRect(40, 76 + i * 66, w - 80, 30); }
      g.fillStyle = '#2fe27a'; g.fillRect(40, 268, 140, 36);
    } else { // cards
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.fillStyle = '#1a1d21'; g.fillRect(16 + i * 164, 50 + j * 132, 152, 120); g.fillStyle = '#5e5b57'; g.fillRect(28 + i * 164, 62 + j * 132, 128, 60); g.fillStyle = '#9c978f'; g.fillRect(28 + i * 164, 132 + j * 132, 80 + r() * 40, 8); }
    }
  });
}
export function uiPanel(w, h, seed, { accent } = {}) {
  const tex = uiTexture(seed, { accent });
  const face = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.3 });
  const side = new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.4, metalness: 0.7 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), [side, side, side, side, face, side]);
  m.castShadow = true;
  return m;
}
// backend box: dark steel box with vent lines and a status LED strip (emissive, colour settable)
export function backendBox(w, h, d) {
  const tex = canvasTex(256, 256, (g, W) => {
    g.fillStyle = '#23262b'; g.fillRect(0, 0, W, W);
    g.fillStyle = '#16181b'; for (let i = 0; i < 9; i++) g.fillRect(24, 30 + i * 20, W - 48, 8);
    g.strokeStyle = '#3b3e44'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, W - 6);
  });
  const body = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.6 });
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), body); m.castShadow = true; m.receiveShadow = true;
  const led = new THREE.MeshBasicMaterial({ color: flat(ORANGE) });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.05, 0.02), led); strip.position.set(0, h * 0.36, d / 2 + 0.011);
  g.add(m, strip);
  g.userData.led = led;
  return g;
}
export function dbCylinder(r, h) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.35, metalness: 0.8 });
  const n = 3;
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h / n * 0.86, 40), mat);
    c.position.y = -h / 2 + (i + 0.5) * h / n; c.castShadow = true; c.receiveShadow = true;
    g.add(c);
  }
  const led = new THREE.MeshBasicMaterial({ color: flat(ORANGE) });
  for (let i = 0; i < n - 1; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.001, 0.025, 6, 48), led);
    ring.rotation.x = Math.PI / 2; ring.position.y = -h / 2 + (i + 1) * h / n; g.add(ring);
  }
  g.userData.led = led;
  return g;
}
export { GRAPH, GRAPH2, STEEL, ORANGE, GREEN, BONE, RED };
