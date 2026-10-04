// v6-space kit: paper / ink / red editorial look on top of the shared engine.
// The engine's final pass does ACES + gamma 2.2; every colour here is pre-inverted so what you set is what you see.
import * as THREE from 'three';
import { clamp, lerp, ease, hash, keys, prog } from '../engine/util.js';
import { Lines, canvasTex } from './base.js';
import { bt, BEAT, BAR } from './story.js';
export { clamp, lerp, ease, hash, keys, prog, Lines, canvasTex, bt, BEAT, BAR };

// ---------------------------------------------------------------- colour
export const CSS = { paper: '#f3efe6', paper2: '#e7e1d4', ink: '#232323', red: '#963c47', red2: '#b4737e', grey: '#828282', glow: '#d4d3d2' };
const EXPOSURE = 1.0;
export function invACES(y) {
  const a = 2.51 - 2.43 * y, b = 0.03 - 0.59 * y, c = -0.14 * y;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a) / EXPOSURE;
}
// display sRGB hex -> pre-tonemap linear rgb array
export function D(hex) {
  const c = new THREE.Color(hex); // three converts css to linear sRGB; engine gamma is 2.2 so recompute from the raw hex
  const n = parseInt(hex.slice(1), 16), s = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return s.map((v) => invACES(Math.min(0.985, Math.pow(v, 2.2))));
}
export const L = Object.fromEntries(Object.entries(CSS).map(([k, v]) => [k, D(v)]));
export const col = (arr) => new THREE.Color(arr[0], arr[1], arr[2]);

const INV_ACES_GLSL = /* glsl */`
vec3 invACES(vec3 y){ y = min(y, vec3(0.985)); vec3 a = 2.51 - 2.43*y, b = 0.03 - 0.59*y, c = -0.14*y;
  return (-b + sqrt(b*b - 4.0*a*c)) / (2.0*a); }
vec3 toLin(vec3 s){ return pow(s, vec3(2.2)); }`;

// Unlit textured / flat material whose output lands on screen exactly as authored (sRGB colours, straight alpha).
// mode 0: texture rgb * tint; mode 1: halftone of the texture luminance in ink on paper.
export function paperMat({ map = null, tint = '#ffffff', opacity = 1, halftone = 0, dots = 90, ink = CSS.ink, paper = CSS.paper, contrast = 1.15, side = THREE.FrontSide, depthTest = true, depthWrite = false } = {}) {
  const hex3 = (h) => new THREE.Vector3(...[16, 8, 0].map((s) => ((parseInt(h.slice(1), 16) >> s) & 255) / 255));
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map }, useMap: { value: map ? 1 : 0 }, tint: { value: hex3(tint) }, opacity: { value: opacity },
      halftone: { value: halftone }, dots: { value: dots }, ink: { value: hex3(ink) }, paper: { value: hex3(paper) },
      contrast: { value: contrast }, reveal: { value: 1 }, aspect: { value: 1 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D map; uniform float useMap, opacity, halftone, dots, contrast, reveal, aspect;
      uniform vec3 tint, ink, paper;
      varying vec2 vUv;
      ${INV_ACES_GLSL}
      void main(){
        vec4 tx = useMap > 0.5 ? texture2D(map, vUv) : vec4(1.0);
        vec3 s = tx.rgb * tint;                           // authored sRGB
        if (halftone > 0.0) {
          float l = dot(tx.rgb, vec3(0.299, 0.587, 0.114));
          l = clamp((l - 0.5) * contrast + 0.5, 0.0, 1.0);
          vec2 p = vec2(vUv.x * aspect, vUv.y) * dots;
          p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
          vec2 cell = fract(p) - 0.5;
          float r = sqrt(1.0 - l) * 0.62;
          float d = length(cell) - r;
          float aa = fwidth(d) * 0.8 + 1e-4;
          float inkAmt = 1.0 - smoothstep(-aa, aa, d);
          vec3 ht = mix(paper, ink, inkAmt);
          vec3 gray = mix(paper, ink, (1.0 - l) * 0.92);
          s = mix(gray, ht, halftone);
        }
        float a = tx.a * opacity * step(vUv.x, reveal);
        gl_FragColor = vec4(invACES(toLin(s)), a);
      }`,
    transparent: true, depthTest, depthWrite, side,
    extensions: { derivatives: true },
  });
}

export function plane(w, h, mat) { return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); }

// ---------------------------------------------------------------- text as canvas planes
const texCache = new Map();
// Draw a string to a texture. font e.g. '900 200px SB'. Returns { tex, aspect }.
export function textTex(str, { font = '400 160px SR', color = CSS.ink, tracking = 0, pad = 24, vertical = false } = {}) {
  const key = [str, font, color, tracking, vertical].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const px = parseFloat(font.match(/(\d+)px/)[1]);
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font; if ('letterSpacing' in probe) probe.letterSpacing = `${tracking * px}px`;
  let w, h;
  if (vertical) { w = Math.ceil(px * 1.15 + pad * 2); h = Math.ceil([...str].length * px * 1.08 + pad * 2); }
  else { w = Math.ceil(probe.measureText(str).width + pad * 2); h = Math.ceil(px * 1.3 + pad * 2); }
  const tex = canvasTex(w, h, (g) => {
    g.font = font; g.fillStyle = color; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = `${tracking * px}px`;
    if (vertical) { g.textAlign = 'center'; [...str].forEach((ch, i) => g.fillText(ch, w / 2, pad + px * 0.54 + i * px * 1.08)); }
    else { g.textAlign = 'left'; g.fillText(str, pad, h / 2 + px * 0.04); }
  });
  const out = { tex, aspect: w / h, w, h };
  texCache.set(key, out);
  return out;
}
// A text plane of world height hgt (anchor: 'c' centre, 'l' left-middle, 'r' right-middle)
export function textMesh(str, hgt, opts = {}) {
  const { tex, aspect } = textTex(str, opts);
  const m = plane(hgt * aspect, hgt, paperMat({ map: tex }));
  const anchor = opts.anchor || 'c';
  if (anchor === 'l') m.geometry.translate(hgt * aspect / 2, 0, 0);
  if (anchor === 'r') m.geometry.translate(-hgt * aspect / 2, 0, 0);
  m.userData.w = hgt * aspect;
  return m;
}

// ---------------------------------------------------------------- photos
const loader = new THREE.TextureLoader();
export async function photo(base, name) {
  const t = await loader.loadAsync(`${base}img/${name}.jpg`);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
  return t;
}
// Museum plate / clipping: paper card + halftone photo (+ optional drop shadow). Photo is fit inside (w x h).
export function photoCard(tex, { w = 4, h = 3, border = 0.12, paper = CSS.paper, halftone = 1, dots = 70, shadow = 0.18, card = true } = {}) {
  const g = new THREE.Group();
  const iw = tex.image.width, ih = tex.image.height, ar = iw / ih;
  let pw = w, ph = w / ar; if (ph > h) { ph = h; pw = h * ar; }
  if (shadow > 0) {
    const sh = plane(pw + border * 2, ph + border * 2, paperMat({ tint: '#000000', opacity: shadow }));
    sh.position.set(0.08, -0.1, -0.02); g.add(sh);
  }
  if (card) { const c = plane(pw + border * 2, ph + border * 2, paperMat({ tint: paper })); c.position.z = -0.01; g.add(c); }
  const pm = paperMat({ map: tex, halftone, dots, paper });
  pm.uniforms.aspect.value = pw / ph;
  const p = plane(pw, ph, pm); g.add(p);
  g.userData = { pw, ph, photoMat: pm };
  return g;
}

// ---------------------------------------------------------------- beat helpers
let ONSETS = [];
export async function loadOnsets(base) { ONSETS = (await (await fetch(`${base}data/disc.onsets.json`)).json()).onsets; }
// grid time snapped to the nearest real note within tol
export function hit(bar, beat = 0, tol = 0.14) {
  const t = bt(bar, beat); let best = t, bd = tol;
  for (const o of ONSETS) { const d = Math.abs(o - t); if (d < bd) { bd = d; best = o; } }
  return best;
}
export const since = (t, t0) => t - t0;
export const pulse = (t, t0, dec = 0.18) => (t < t0 ? 0 : Math.exp(-(t - t0) / dec));
// slam-in scale: big -> 1 with a small overshoot
export function slam(t, t0, dur = 0.22, from = 1.8) {
  if (t < t0) return 0;
  const x = clamp((t - t0) / dur);
  return lerp(from, 1, ease.outBack(x));
}

// ---------------------------------------------------------------- line art (original, generic shapes)
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
// profile-of-revolution wireframe: pts [[r, y], ...] -> meridians + rings
export function lathe(lines, pts, { o = V(0, 0, 0), n = 16, rings = true, w = 2, c = L.ink, al = 1, k = 1, rot = 0 } = {}) {
  const segs = [];
  for (let m = 0; m < n; m++) {
    const a = rot + (m / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 1; i < pts.length; i++) segs.push([V(o.x + pts[i - 1][0] * ca, o.y + pts[i - 1][1], o.z + pts[i - 1][0] * sa), V(o.x + pts[i][0] * ca, o.y + pts[i][1], o.z + pts[i][0] * sa)]);
  }
  if (rings) for (const [r, y] of pts) if (r > 0.001) {
    for (let m = 0; m < n * 2; m++) {
      const a0 = rot + (m / (n * 2)) * Math.PI * 2, a1 = rot + ((m + 1) / (n * 2)) * Math.PI * 2;
      segs.push([V(o.x + r * Math.cos(a0), o.y + y, o.z + r * Math.sin(a0)), V(o.x + r * Math.cos(a1), o.y + y, o.z + r * Math.sin(a1))]);
    }
  }
  const nn = Math.floor(segs.length * clamp(k));
  for (let i = 0; i < nn; i++) lines.line(segs[i][0], segs[i][1], w, c, al);
}
// A generic multi-stage moon rocket (not a scale model): profile of revolution + fins. height ~ 11 units
export const ROCKET_TALL = [[0, 11], [0.12, 10.6], [0.18, 10.1], [0.18, 9.8], [0.45, 9.2], [0.45, 8.6], [0.62, 8.0], [0.62, 6.4], [0.62, 6.3], [0.9, 5.9], [0.9, 3.2], [0.9, 3.1], [0.9, 0.3], [1.02, 0], [0, 0]];
export const ROCKET_STEEL = [[0, 12], [0.5, 11.3], [0.85, 10.2], [0.9, 9.2], [0.9, 7.0], [0.9, 0.2], [0.9, 0], [0, 0]];
export function fins(lines, o, { n = 4, r = 0.9, h = 1.6, span = 0.7, w = 2, c = L.ink, al = 1, rot = Math.PI / 4 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const p0 = V(o.x + r * ca, o.y + h, o.z + r * sa), p1 = V(o.x + (r + span) * ca, o.y + 0.15, o.z + (r + span) * sa), p2 = V(o.x + (r + span) * ca, o.y - 0.25, o.z + (r + span) * sa), p3 = V(o.x + r * ca, o.y, o.z + r * sa);
    lines.poly([p0, p1, p2, p3], w, c, al);
  }
}
// generic little satellite: sphere + four swept antennas
export function satellite(lines, o, { r = 0.35, w = 2, c = L.ink, al = 1, rot = 0 } = {}) {
  lines.ring(o, V(1, 0, 0), V(0, 1, 0), r, 28, w, c, al);
  lines.ring(o, V(Math.cos(rot), 0, Math.sin(rot)), V(0, 1, 0), r, 28, w * 0.7, c, al * 0.8);
  lines.ring(o, V(1, 0, 0), V(0, 0, 1), r, 28, w * 0.7, c, al * 0.6);
  for (let i = 0; i < 4; i++) {
    const a = rot + (i - 1.5) * 0.28;
    const d = V(-Math.cos(a) * 1, -0.55 + (i % 2) * 0.12, Math.sin(a) * 0.4).normalize();
    lines.line(o.clone().addScaledVector(d, r), o.clone().addScaledVector(d, r + 1.6 + (i % 2) * 0.4), w * 0.8, c, al);
  }
}
// wire globe: parallels + meridians; land outlines optional (geojson polygons, lon/lat)
export function globe(lines, o, R, { rot = 0, tilt = 0.35, w = 1.4, c = L.ink, al = 1, n = 12, land = null, landW = 2, landC = null, k = 1, front = true } = {}) {
  const m = new THREE.Matrix4().makeRotationX(tilt).multiply(new THREE.Matrix4().makeRotationY(rot));
  const P = (lon, lat) => V(R * Math.cos(lat) * Math.sin(lon), R * Math.sin(lat), R * Math.cos(lat) * Math.cos(lon)).applyMatrix4(m).add(o);
  const vis = (p) => !front || (p.z - o.z) > -R * 0.15;
  const dim = (p) => (front ? clamp(((p.z - o.z) / R + 0.4) * 1.2, 0.12, 1) : 1);
  const seg = (a, b, ww, cc, aa) => { const f = Math.min(dim(a), dim(b)); lines.line(a, b, ww, cc, aa * f); };
  const S = 72, kk = clamp(k);
  for (let i = 1; i < 6; i++) { const lat = -Math.PI / 2 + (i / 6) * Math.PI; for (let j = 0; j < S * kk; j++) seg(P((j / S) * 2 * Math.PI, lat), P(((j + 1) / S) * 2 * Math.PI, lat), w, c, al); }
  for (let i = 0; i < n; i++) { const lon = (i / n) * 2 * Math.PI; for (let j = 0; j < 36 * kk; j++) seg(P(lon, -Math.PI / 2 + (j / 36) * Math.PI), P(lon, -Math.PI / 2 + ((j + 1) / 36) * Math.PI), w, c, al); }
  lines.ring(o, V(1, 0, 0), V(0, 1, 0), R, 96, w * 1.4, c, al);
  if (land) for (const ring of land) {
    const nn = Math.floor(ring.length * kk);
    for (let i = 1; i < nn; i++) { const a = P(ring[i - 1][0] * Math.PI / 180, ring[i - 1][1] * Math.PI / 180), b = P(ring[i][0] * Math.PI / 180, ring[i][1] * Math.PI / 180); if (vis(a) && vis(b)) seg(a, b, landW, landC || c, al); }
  }
  return P;
}
export async function loadLand(base) {
  const gj = await (await fetch(`${base}data/land110.geojson`)).json();
  const rings = [];
  for (const f of gj.features) {
    const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) rings.push(p[0]);
  }
  return rings;
}
// dotted ellipse (orbit) in plane (u,v) around o; k = drawn fraction; phase animates the dashes
export function dottedOrbit(lines, o, u, v, rx, ry, { n = 90, k = 1, phase = 0, w = 3, c = L.red, al = 1 } = {}) {
  const nn = Math.floor(n * clamp(k));
  for (let i = 0; i < nn; i++) {
    const a = ((i + phase) / n) * Math.PI * 2, b = a + (Math.PI * 2 / n) * 0.35;
    const p = o.clone().addScaledVector(u, Math.cos(a) * rx).addScaledVector(v, Math.sin(a) * ry);
    const q = o.clone().addScaledVector(u, Math.cos(b) * rx).addScaledVector(v, Math.sin(b) * ry);
    lines.line(p, q, w, c, al);
  }
}
export const orbitPoint = (o, u, v, rx, ry, a) => o.clone().addScaledVector(u, Math.cos(a) * rx).addScaledVector(v, Math.sin(a) * ry);
export { V };

// ---------------------------------------------------------------- camera
export function look(cam, p, t, roll = 0) { cam.position.set(...p); cam.up.set(Math.sin(roll), Math.cos(roll), 0); cam.lookAt(...t); }
export function orthoCam(h = 10) { const c = new THREE.OrthographicCamera(-h * 16 / 18, h * 16 / 18, h / 2, -h / 2, 0.1, 200); c.position.z = 50; return c; }
