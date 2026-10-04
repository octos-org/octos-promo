// v5-arc shared kit (adapted from v3-type/lib.js + v2-wire/lib.js): colour, kerned 3D type, materials,
// rigs, beat maths, GPU lines, canvas labels, HUD.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, ease, hash, keys, prog, mulberry32 } from '../engine/util.js';

export const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4, S16 = BEAT / 4;
export const bt = (bar, beat = 0) => bar * BAR + beat * BEAT;

// ---------- colour ----------
// Pre-tonemap linear value that lands exactly on the given sRGB value after the engine's ACES + 1/2.2 gamma.
function acesInv(y) {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  y = Math.min(y, 0.985);
  const A = a - c * y, B = b - d * y, C = -e * y;
  return (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
}
export function flat(hex, out = new THREE.Color()) {
  const s = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => acesInv((v / 255) ** 2.2));
  return out.setRGB(s[0], s[1], s[2]);
}
export const OR_SIDE = 0xd9480c;
// industrial palette: graphite, steel, bone, signal orange, test green, fail red
export const INK = 0x0d0e10, GRAPH = 0x17181b, GRAPH2 = 0x222428, STEEL = 0x3b3e44, BONE = 0xe9e5dc, ORANGE = 0xff6a1a, GREEN = 0x2fe27a, RED = 0xff3346, ASH = 0x8d8a84;
export const C = { ink: flat(INK), graph: flat(GRAPH), graph2: flat(GRAPH2), steel: flat(STEEL), bone: flat(BONE), orange: flat(ORANGE), green: flat(GREEN), red: flat(RED), ash: flat(ASH) };
export const CSS = { ink: '#0d0e10', graph: '#17181b', bone: '#e9e5dc', orange: '#ff6a1a', green: '#2fe27a', red: '#ff3346', ash: '#8d8a84', steel: '#3b3e44' };
// linear rgb arrays for additive lines (values > 1 bloom)
export const LC = { orange: [1.0, 0.145, 0.01], green: [0.03, 0.78, 0.2], red: [1.0, 0.03, 0.05], bone: [0.8, 0.78, 0.72], steel: [0.05, 0.055, 0.06] };
export const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const mix3 = (a, b, x) => [a[0] + (b[0] - a[0]) * x, a[1] + (b[1] - a[1]) * x, a[2] + (b[2] - a[2]) * x];

// ---------- beat maths ----------
export const since = (t, t0) => (t >= t0 ? t - t0 : 1e9);
// decaying pulse after the most recent grid hit (grid from t0 every `every`)
export function gridPulse(t, t0, t1, every, decay = 0.12) {
  if (t < t0 || t > t1 + decay * 6) return 0;
  const k = Math.floor((Math.min(t, t1) - t0) / every + 1e-6);
  const dt = t - (t0 + k * every);
  return Math.exp(-dt / decay);
}
export function hitsPulse(t, times, decay = 0.12) {
  let v = 0;
  for (const h of times) if (t >= h) v = Math.max(v, Math.exp(-(t - h) / decay));
  return v;
}
export const quant = (x, q) => Math.round(x / q) * q;

// ---------- environment / rigs ----------
let envCache = null;
export function envMap(renderer) {
  if (!envCache) {
    const pm = new THREE.PMREMGenerator(renderer);
    envCache = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  return envCache;
}
export function setupRenderer(renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}
export function keyLight(scene, { color = 0xffffff, intensity = 3, pos = [-8, 14, 10], target = [0, 0, 0], size = 30, map = 4096, bias = -0.0004, normalBias = 0.02, near = 0.5, far = 120 } = {}) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.set(...pos); l.target.position.set(...target);
  l.castShadow = true;
  l.shadow.mapSize.set(map, map);
  const c = l.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = near; c.far = far;
  l.shadow.bias = bias; l.shadow.normalBias = normalBias;
  scene.add(l, l.target);
  return l;
}

// ---------- materials ----------
// Physical material whose extrusion sides can take a second colour (attribute aSide: 0 caps, 1 sides).
export function typeMat({ face = 0xece7dc, side = null, rough = 0.35, metal = 0.0, clearcoat = 0.6, env = 1, emissive = 0x000000, emissiveIntensity = 0, flatFace = false } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: face, roughness: rough, metalness: metal, clearcoat, clearcoatRoughness: 0.35, envMapIntensity: env, emissive, emissiveIntensity });
  const sideU = { value: new THREE.Color(side ?? face) };
  // flatFace: caps render (mostly) as the exact poster colour, sides stay lit → graphic face, sculpted edges
  const flatU = { value: flat(face) }, flatK = { value: flatFace === true ? 0.85 : flatFace || 0 };
  m.userData.side = sideU.value; m.userData.flatK = flatK; m.userData.flatColor = flatU.value;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.sideColor = sideU; sh.uniforms.faceFlat = flatU; sh.uniforms.flatK = flatK;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSide; varying float vSide;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSide = aSide;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 sideColor; uniform vec3 faceFlat; uniform float flatK; varying float vSide;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( mix( diffuse, sideColor, step(0.5, vSide) ), opacity );')
      .replace('#include <opaque_fragment>', 'if (vSide < 0.5) outgoingLight = mix(outgoingLight, faceFlat, flatK);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'typeSide';
  return m;
}
// unlit flat colour that lands on exact sRGB
export function flatMat(hex, opts = {}) {
  return new THREE.MeshBasicMaterial({ color: flat(hex), ...opts });
}
// flat colour field that receives hard shadows: flat base + ShadowMaterial overlay (tinted)
export function posterPlane(w, h, hex, { shadowHex = 0x000000, strength = 0.35, segments = 1 } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h, segments, segments);
  const base = new THREE.Mesh(geo, flatMat(hex));
  const sm = new THREE.ShadowMaterial({ color: flat(shadowHex), opacity: strength, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const sh = new THREE.Mesh(geo, sm); sh.receiveShadow = true;
  g.add(base, sh);
  g.userData = { base, shadow: sh };
  return g;
}

// ---------- type ----------
// Glyph geometries are cached per (font, char, style) at size 1 (≈ cap height 0.97); meshes scale them.
export class Typesetter {
  constructor(ctx) { this.ctx = ctx; this.cache = new Map(); this.ot = {}; }
  async init(names) {
    const ot = (await import('https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm')).default;
    for (const n of names) {
      const buf = await (await fetch(this.ctx.video.fonts[n])).arrayBuffer();
      this.ot[n] = ot.parse(buf);
    }
  }
  kern(font, a, b) {
    const f = this.ot[font]; if (!f) return 0;
    const v = f.getKerningValue(f.charToGlyph(a), f.charToGlyph(b));
    return (v / f.unitsPerEm) * (100 / 72);
  }
  adv(font, ch) {
    const F = this.ctx.fonts[font];
    const g = F.data.glyphs[ch] || F.data.glyphs['?'];
    return g.ha / F.data.resolution;
  }
  glyph(font, ch, { depth = 0.25, bevel = 0.012, curve = 6 } = {}) {
    const key = `${font}|${ch}|${depth}|${bevel}|${curve}`;
    let g = this.cache.get(key);
    if (g) return g;
    const geo = new TextGeometry(ch, { font: this.ctx.fonts[font], size: 1, depth, curveSegments: curve, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    const cx = (b.max.x + b.min.x) / 2, cy = (b.max.y + b.min.y) / 2, cz = (b.max.z + b.min.z) / 2;
    geo.translate(-cx, -cy, -cz);
    // degenerate bevel triangles give NaN / zero normals → NaN pixels that bloom into black holes
    const nr = geo.attributes.normal.array;
    for (let i = 0; i < nr.length; i += 3) {
      const l = Math.hypot(nr[i], nr[i + 1], nr[i + 2]);
      if (!(l > 1e-6)) { nr[i] = 0; nr[i + 1] = 0; nr[i + 2] = 1; } else { nr[i] /= l; nr[i + 1] /= l; nr[i + 2] /= l; }
    }
    // aSide attribute from the extrude groups (0 = caps, 1 = sides)
    const n = geo.attributes.position.count;
    const side = new Float32Array(n);
    for (const gr of geo.groups) if (gr.materialIndex === 1) side.fill(1, gr.start, gr.start + gr.count);
    geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    geo.computeBoundingBox();
    g = { geo, cx, cy, w: b.max.x - b.min.x, h: b.max.y - b.min.y };
    this.cache.set(key, g);
    return g;
  }
  // Lay out a single line. Returns glyph items with centre positions (size 1 units), total width.
  // x is centred on 0 when align = 'center'. Baseline at y = 0.
  layout(font, str, { tracking = 0, depth = 0.25, bevel = 0.012, curve = 6, align = 'center', space = 1 } = {}) {
    const items = [];
    let x = 0, prev = null;
    const chars = [...str];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (prev) x += this.kern(font, prev, ch);
      const adv = this.adv(font, ch) * (ch === ' ' ? space : 1);
      if (ch.trim()) {
        const g = this.glyph(font, ch, { depth, bevel, curve });
        items.push({ ch, i, g, x: x + g.cx, y: g.cy, geo: g.geo });
      }
      x += adv + (i < chars.length - 1 ? tracking : 0);
      prev = ch;
    }
    // ink extents
    let minX = Infinity, maxX = -Infinity;
    for (const it of items) { minX = Math.min(minX, it.x - it.g.w / 2); maxX = Math.max(maxX, it.x + it.g.w / 2); }
    const off = align === 'center' ? -(minX + maxX) / 2 : align === 'right' ? -maxX : -minX;
    for (const it of items) it.x += off;
    return { items, width: maxX - minX, n: items.length };
  }
  // Static merged geometry for a whole line (size 1). Keeps aSide.
  line(font, str, opts = {}) {
    const L = this.layout(font, str, opts);
    const geos = L.items.map((it) => { const g = it.geo.clone(); g.translate(it.x, it.y, 0); return g; });
    const geo = mergeGeometries(geos.map((g) => { g.clearGroups(); return g; }), false);
    geos.forEach((g) => g.dispose());
    geo.computeBoundingBox();
    return { geo, width: L.width };
  }
}

// Mesh group of per-glyph meshes for kinetic type. Returns { group, glyphs:[{mesh, x, y}], width }
export function kinetic(ts, font, str, mat, { size = 1, depthScale = 1, castShadow = true, receiveShadow = false, ...opts } = {}) {
  const L = ts.layout(font, str, opts);
  const group = new THREE.Group();
  const glyphs = L.items.map((it, k) => {
    const mesh = new THREE.Mesh(it.geo, mat);
    mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
    const x = it.x * size, y = it.y * size;
    mesh.position.set(x, y, 0); mesh.scale.set(size, size, size * depthScale);
    group.add(mesh);
    return { mesh, x, y, ch: it.ch, k, n: L.items.length };
  });
  return { group, glyphs, width: L.width * size };
}
export function staticLine(ts, font, str, mat, { size = 1, depthScale = 1, castShadow = true, receiveShadow = false, ...opts } = {}) {
  const { geo, width } = ts.line(font, str, opts);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(size, size, size * depthScale);
  mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
  return { mesh, width: width * size };
}

// ---------- camera helpers ----------
export function camLook(cam, p, target, roll = 0) {
  cam.position.set(p[0], p[1], p[2]);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(target[0], target[1], target[2]);
}
export function orbit(center, radius, yaw, pitch) {
  return [center[0] + radius * Math.sin(yaw) * Math.cos(pitch), center[1] + radius * Math.sin(pitch), center[2] + radius * Math.cos(yaw) * Math.cos(pitch)];
}
export { clamp, lerp, ease, hash, keys, prog, mulberry32 };

// ---------- HUD (Swiss annotation layer) ----------
export function hudText(h, str, x, y, { font = 'PM', px = 15, color = CSS.bone, align = 'left', alpha = 1, tracking = 0.06, baseline = 'alphabetic' } = {}) {
  h.save();
  h.globalAlpha = alpha; h.fillStyle = color; h.textAlign = align; h.textBaseline = baseline;
  h.font = `${px}px ${font}`;
  if ('letterSpacing' in h) h.letterSpacing = `${tracking * px}px`;
  h.fillText(str, x, y);
  h.restore();
}
export function hudRule(h, x0, y0, x1, y1, { color = CSS.bone, alpha = 1, w = 1 } = {}) {
  h.save(); h.globalAlpha = alpha; h.strokeStyle = color; h.lineWidth = w;
  h.beginPath(); h.moveTo(x0, y0); h.lineTo(x1, y1); h.stroke(); h.restore();
}

// ---------------------------------------------------------------- lines
const VERT = /* glsl */ `
precision highp float;
in vec3 position; in vec3 iA; in vec3 iB; in vec4 iColor; in float iWidth;
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix;
uniform vec2 res; uniform bool worldWidth; uniform float widthScale; uniform vec2 fog; uniform vec2 nearFade; uniform float clipW;
out vec2 vLocal; out float vLen; out float vHalfW; out vec4 vColor;
void main() {
  vec4 ca = projectionMatrix * modelViewMatrix * vec4(iA, 1.0);
  vec4 cb = projectionMatrix * modelViewMatrix * vec4(iB, 1.0);
  if (ca.w < clipW && cb.w < clipW) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (ca.w < clipW) ca = mix(ca, cb, (clipW - ca.w) / (cb.w - ca.w));
  if (cb.w < clipW) cb = mix(cb, ca, (clipW - cb.w) / (ca.w - cb.w));
  vec2 sa = ca.xy / ca.w * 0.5 * res, sb = cb.xy / cb.w * 0.5 * res;
  float w = iWidth * widthScale;
  float wd = mix(ca.w, cb.w, position.x);
  if (worldWidth) w = iWidth * widthScale * projectionMatrix[1][1] * 0.5 * res.y / wd;
  float hw = max(w * 0.5, 0.35) + 1.0;
  vec2 d = sb - sa; float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float along = mix(-hw, len + hw, position.x);
  vec2 p = sa + dir * along + nrm * position.y * hw;
  float z = mix(ca.z / ca.w, cb.z / cb.w, position.x);
  gl_Position = vec4(p / (0.5 * res), z, 1.0);
  vLocal = vec2(along, position.y * hw);
  vLen = len; vHalfW = max(w * 0.5, 0.35);
  float f = 1.0 - smoothstep(fog.x, fog.y, wd);
  float nf = smoothstep(nearFade.x, nearFade.y, wd);
  vColor = iColor * vec4(1.0, 1.0, 1.0, min(1.0, w / 0.7) * f * nf);
}`;
const FRAG = /* glsl */ `
precision highp float;
in vec2 vLocal; in float vLen; in float vHalfW; in vec4 vColor;
out vec4 fragColor;
void main() {
  float x = clamp(vLocal.x, 0.0, vLen);
  float d = length(vec2(vLocal.x - x, vLocal.y)) - vHalfW;
  float a = clamp(0.5 - d, 0.0, 1.0) * vColor.a;
  if (a <= 0.001) discard;
  fragColor = vec4(vColor.rgb * a, a);
}`;

export class Lines {
  constructor(capacity, { worldWidth = false, depthTest = true, fog = [30, 120], nearFade = [0.0, 0.0], widthScale = 1 } = {}) {
    const g = this.geo = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.a = new Float32Array(capacity * 3); this.b = new Float32Array(capacity * 3);
    this.c = new Float32Array(capacity * 4); this.w = new Float32Array(capacity);
    this.attrs = [new THREE.InstancedBufferAttribute(this.a, 3), new THREE.InstancedBufferAttribute(this.b, 3),
      new THREE.InstancedBufferAttribute(this.c, 4), new THREE.InstancedBufferAttribute(this.w, 1)];
    this.attrs.forEach((x) => x.setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iA', this.attrs[0]); g.setAttribute('iB', this.attrs[1]);
    g.setAttribute('iColor', this.attrs[2]); g.setAttribute('iWidth', this.attrs[3]);
    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        res: { value: new THREE.Vector2(1920, 1080) }, worldWidth: { value: worldWidth }, widthScale: { value: widthScale },
        fog: { value: new THREE.Vector2(...fog) }, nearFade: { value: new THREE.Vector2(...nearFade) }, clipW: { value: 0.06 },
      },
      transparent: true, depthWrite: false, depthTest, blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.count = 0;
  }
  set fog(v) { this.mat.uniforms.fog.value.set(v[0], v[1]); }
  set nearFade(v) { this.mat.uniforms.nearFade.value.set(v[0], v[1]); }
  clear() { this.count = 0; }
  seg(ax, ay, az, bx, by, bz, w, r, g, b, al = 1) {
    if (this.count >= this.w.length) return;
    const i = this.count++;
    this.a[i * 3] = ax; this.a[i * 3 + 1] = ay; this.a[i * 3 + 2] = az;
    this.b[i * 3] = bx; this.b[i * 3 + 1] = by; this.b[i * 3 + 2] = bz;
    this.c[i * 4] = r; this.c[i * 4 + 1] = g; this.c[i * 4 + 2] = b; this.c[i * 4 + 3] = al;
    this.w[i] = w;
  }
  line(p, q, w, c, al = 1) { this.seg(p.x, p.y, p.z, q.x, q.y, q.z, w, c[0], c[1], c[2], al); }
  poly(pts, w, c, al = 1, closed = false) {
    for (let i = 1; i < pts.length; i++) this.line(pts[i - 1], pts[i], w, c, al);
    if (closed && pts.length > 2) this.line(pts[pts.length - 1], pts[0], w, c, al);
  }
  // partial segment: draws p→q up to fraction k (0..1)
  lineK(p, q, k, w, c, al = 1) {
    if (k <= 0) return;
    k = Math.min(1, k);
    this.seg(p.x, p.y, p.z, p.x + (q.x - p.x) * k, p.y + (q.y - p.y) * k, p.z + (q.z - p.z) * k, w, c[0], c[1], c[2], al);
  }
  // ring in the plane spanned by unit vectors u, v around center o
  ring(o, u, v, r, n, w, c, al = 1, a0 = 0, a1 = Math.PI * 2) {
    let px, py, pz;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      const cs = Math.cos(a) * r, sn = Math.sin(a) * r;
      const x = o.x + u.x * cs + v.x * sn, y = o.y + u.y * cs + v.y * sn, z = o.z + u.z * cs + v.z * sn;
      if (i) this.seg(px, py, pz, x, y, z, w, c[0], c[1], c[2], al);
      px = x; py = y; pz = z;
    }
  }
  // axis-aligned wire box (center, half-sizes), optional matrix
  box(cx, cy, cz, hx, hy, hz, w, c, al = 1, m = null) {
    const P = [];
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz);
      if (m) v.applyMatrix4(m);
      P.push(v.add(new THREE.Vector3(cx, cy, cz)));
    }
    for (const [i, j] of BOX_E) this.line(P[i], P[j], w, c, al);
  }
  // add a list of [p,q] edge pairs transformed by matrix m
  edges(E, m, w, c, al = 1, k = 1) {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const n = Math.floor(E.length * clamp(k));
    for (let i = 0; i < n; i++) {
      a.copy(E[i][0]).applyMatrix4(m); b.copy(E[i][1]).applyMatrix4(m);
      this.line(a, b, w, c, al);
    }
  }
  flush() {
    for (const at of this.attrs) { at.needsUpdate = true; at.clearUpdateRanges(); at.addUpdateRange(0, this.count * at.itemSize); }
    this.geo.instanceCount = this.count;
  }
}
export const BOX_E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

export function edgesOf(geo, thresh = 1) {
  const e = new THREE.EdgesGeometry(geo, thresh);
  const p = e.attributes.position.array, out = [];
  for (let i = 0; i < p.length; i += 6) out.push([new THREE.Vector3(p[i], p[i + 1], p[i + 2]), new THREE.Vector3(p[i + 3], p[i + 4], p[i + 5])]);
  return out;
}

// ---------------------------------------------------------------- labels (canvas textures)
export function labelTexture(text, { font = '600 72px Mono', pad = 18, fill = '#fff', box = false, boxColor = '#fff', lw = 4, sub = null, subFont = '400 40px Mono', align = 'left' } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const mt = g.measureText(text);
  const fs = parseFloat(font.match(/(\d+)px/)[1]);
  let wsub = 0, sfs = 0;
  if (sub) { g.font = subFont; wsub = g.measureText(sub).width; sfs = parseFloat(subFont.match(/(\d+)px/)[1]); }
  const w = Math.ceil(Math.max(mt.width, wsub) + pad * 2), h = Math.ceil(fs * 1.25 + (sub ? sfs * 1.5 : 0) + pad * 2);
  c.width = w; c.height = h;
  g.font = font; g.fillStyle = fill; g.textBaseline = 'middle';
  const x = align === 'center' ? w / 2 : pad;
  g.textAlign = align;
  g.fillText(text, x, pad + fs * 0.62);
  if (sub) { g.font = subFont; g.globalAlpha = 0.75; g.fillText(sub, x, pad + fs * 1.25 + sfs * 0.7); g.globalAlpha = 1; }
  if (box) { g.strokeStyle = boxColor; g.lineWidth = lw; g.strokeRect(lw / 2, lw / 2, w - lw, h - lw); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  return { tex, aspect: w / h, w, h };
}
// Canvas-drawn texture: draw(g, w, h) paints it once at build time.
export function canvasTex(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  return tex;
}
// Flat label plane (normal alpha blending) of world height h. Text is drawn in CSS colour; tint via material.color.
export function textPlane(text, h, { font = '600 96px PM', color = BONE, glow = 1, pad = 16, align = 'left', additive = false, depthTest = true, tracking = 0 } = {}) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font; if ('letterSpacing' in probe) probe.letterSpacing = `${tracking}px`;
  const fs = parseFloat(font.match(/(\d+)px/)[1]);
  const w = Math.ceil(probe.measureText(text).width + pad * 2), hh = Math.ceil(fs * 1.3 + pad * 2);
  const tex = canvasTex(w, hh, (g) => {
    g.font = font; g.fillStyle = '#fff'; g.textBaseline = 'middle'; if ('letterSpacing' in g) g.letterSpacing = `${tracking}px`;
    g.fillText(text, pad, hh / 2 + fs * 0.04);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  flat(color, mat.color).multiplyScalar(glow);
  const geo = new THREE.PlaneGeometry(h * w / hh, h);
  if (align === 'left') geo.translate(h * w / hh / 2, 0, 0);
  if (align === 'right') geo.translate(-h * w / hh / 2, 0, 0);
  const m = new THREE.Mesh(geo, mat);
  m.userData.width = h * w / hh;
  return m;
}
// steel frame of a box: 12 beams (w × h × d outer size), returns Group
export function frameBox(w, h, d, t, mat) {
  const g = new THREE.Group();
  const add = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); };
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) add(w, t, t, 0, sy * (h - t) / 2, sz * (d - t) / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(t, h, t, sx * (w - t) / 2, 0, sz * (d - t) / 2);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) add(t, t, d, sx * (w - t) / 2, sy * (h - t) / 2, 0);
  return g;
}
// film-style HUD caption: small label + main line, bottom-left
export function hudCaption(h, label, text, a, { x = 96, y = 960, color = CSS.bone, accent = CSS.orange, px = 30 } = {}) {
  if (a <= 0.001) return;
  h.save();
  const gr = h.createLinearGradient(0, y - px - 70, 0, 1080);
  gr.addColorStop(0, 'rgba(8,9,10,0)'); gr.addColorStop(0.45, `rgba(8,9,10,${0.5 * a})`); gr.addColorStop(1, `rgba(8,9,10,${0.6 * a})`);
  h.fillStyle = gr; h.fillRect(0, y - px - 70, 1920, 1080);
  h.restore();
  hudText(h, label, x, y - px - 14, { font: 'PM', px: 15, color: accent, alpha: a, tracking: 0.2 });
  hudText(h, text, x, y, { font: 'PR', px, color, alpha: a, tracking: 0.02 });
}
