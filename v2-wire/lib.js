// v2-wire shared kit: GPU capsule lines (additive, depth-faded, near-clipped), label planes,
// hero text, kernel-core geometry, timing. Everything is a pure function of t.
import * as THREE from 'three';
import { clamp, lerp, hash, ease } from '../engine/util.js';

export const BPM = 128;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const bt = (bar, beat = 0) => bar * BAR + beat * BEAT;

// palette (linear rgb)
export const C = {
  cyan: [0.05, 0.75, 1.0],
  cyanHot: [0.5, 1.4, 2.0],
  orange: [1.0, 0.145, 0.01], // #ff6a1a in linear
  orangeHot: [3.0, 0.6, 0.08],
  white: [1, 1, 1],
  dim: [0.03, 0.12, 0.18],
};
export const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const mix3 = (a, b, x) => [lerp(a[0], b[0], x), lerp(a[1], b[1], x), lerp(a[2], b[2], x)];

// envelope that fires at each beat: exp decay since last beat (k = sharpness)
export function beatEnv(t, k = 8, div = 1, from = -1e9, to = 1e9) {
  if (t < from || t >= to) return 0;
  const step = BEAT / div;
  const ph = (t - from) / step;
  const x = (ph - Math.floor(ph)) * step;
  return Math.exp(-x * k);
}
export const since = (t, t0) => (t >= t0 ? t - t0 : 1e9);
export const hit = (t, t0, k = 6) => (t >= t0 ? Math.exp(-(t - t0) * k) : 0);

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
// Plane mesh of world height h showing text; additive; color can exceed 1 (bloom).
export function label(text, h, color = [1, 1, 1], opts = {}) {
  const { tex, aspect } = labelTexture(text, opts);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: opts.depthTest ?? true, side: THREE.DoubleSide });
  mat.color.setRGB(...color);
  const geo = new THREE.PlaneGeometry(h * aspect, h);
  if (opts.anchor === 'left') geo.translate(h * aspect / 2, 0, 0);
  const m = new THREE.Mesh(geo, mat);
  m.userData.width = h * aspect;
  m.renderOrder = 10;
  return m;
}
export function setColor(mesh, c, k = 1) { mesh.material.color.setRGB(c[0] * k, c[1] * k, c[2] * k); }

// Hero text: per-glyph extruded meshes (dark glass fill that occludes the world behind it) plus
// neon outline edges (front/back contours + depth connectors), drawn each frame by drawHero().
export function heroText(ctx, font, str, { size = 1, depth = 0.15, tracking = 0.02, face = [0.0, 0.0, 0.0], side = [0.006, 0.009, 0.012], div = 6 } = {}) {
  const grp = new THREE.Group();
  const F = ctx.fonts[font];
  const glyphs = ctx.glyphs3d(font, str, { size, depth, tracking, curveSegments: div });
  const fm = new THREE.MeshBasicMaterial(); fm.color.setRGB(...face);
  const sm = new THREE.MeshBasicMaterial(); sm.color.setRGB(...side);
  grp.userData.glyphs = [];
  let minX = 1e9, maxX = -1e9;
  for (const gl of glyphs) {
    const m = new THREE.Mesh(gl.geo, [fm, sm]);
    m.position.x = gl.x; m.userData.x = gl.x;
    // outline edges in glyph-local space
    const shapes = F.generateShapes(gl.ch, size);
    const loops = [];
    for (const sh of shapes) { const ex = sh.extractPoints(div); loops.push(ex.shape, ...ex.holes); }
    let x0 = 1e9, x1 = -1e9;
    for (const lp of loops) for (const p of lp) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); }
    const cx = (x0 + x1) / 2, dy = -size * 0.36, hz = depth / 2 + 0.004 + size * 0.004;
    const front = [], back = [], conn = [];
    for (const lp of loops) {
      for (let i = 0; i < lp.length; i++) {
        const a = lp[i], b = lp[(i + 1) % lp.length];
        if (a.x === b.x && a.y === b.y) continue;
        front.push([new THREE.Vector3(a.x - cx, a.y + dy, hz), new THREE.Vector3(b.x - cx, b.y + dy, hz)]);
        back.push([new THREE.Vector3(a.x - cx, a.y + dy, -hz), new THREE.Vector3(b.x - cx, b.y + dy, -hz)]);
        // connector at sharp corners
        const c = lp[(i + lp.length - 1) % lp.length];
        const d1 = new THREE.Vector2(a.x - c.x, a.y - c.y).normalize(), d2 = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
        if (d1.dot(d2) < 0.7) conn.push([new THREE.Vector3(a.x - cx, a.y + dy, hz), new THREE.Vector3(a.x - cx, a.y + dy, -hz)]);
      }
    }
    m.userData.front = front; m.userData.back = back; m.userData.conn = conn;
    minX = Math.min(minX, gl.x - (x1 - x0) / 2); maxX = Math.max(maxX, gl.x + (x1 - x0) / 2);
    grp.add(m); grp.userData.glyphs.push(m);
  }
  grp.userData.face = fm; grp.userData.side = sm;
  grp.userData.width = maxX - minX;
  return grp;
}
// emit the hero's neon outlines into L (world space). k: 0..1 draw-on fraction of each contour
export function drawHero(L, grp, { front = C.cyanHot, back = mul(C.cyan, 0.35), conn = mul(C.cyan, 0.5), w = 2.2, k = 1, glyphK = null } = {}) {
  grp.updateWorldMatrix(true, true);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  grp.userData.glyphs.forEach((m, gi) => {
    if (!m.visible) return;
    const mw = m.matrixWorld;
    const kk = glyphK ? glyphK[gi] : k;
    if (kk <= 0) return;
    const emit = (E, c, ww) => {
      const n = Math.floor(E.length * clamp(kk));
      for (let i = 0; i < n; i++) { a.copy(E[i][0]).applyMatrix4(mw); b.copy(E[i][1]).applyMatrix4(mw); L.seg(a.x, a.y, a.z, b.x, b.y, b.z, ww, c[0], c[1], c[2], 1); }
    };
    emit(m.userData.front, front, w);
    if (back) emit(m.userData.back, back, w * 0.6);
    if (conn) emit(m.userData.conn, conn, w * 0.6);
  });
}
// reveal glyphs: k 0..1 over the string; each glyph drops/scales in
export function revealGlyphs(grp, k, { spread = 0.6, dy = 0.6, dz = 0, out = 0 } = {}) {
  const gs = grp.userData.glyphs, n = gs.length;
  gs.forEach((m, i) => {
    const a = clamp((k * (1 + spread) - (i / Math.max(1, n - 1)) * spread));
    const e = ease.outCubic(a);
    const o = clamp(out * (1 + spread) - ((n - 1 - i) / Math.max(1, n - 1)) * spread);
    m.visible = a > 0.001 && o < 0.999;
    m.position.set(m.userData.x, (1 - e) * dy - ease.inCubic(o) * dy, (1 - e) * dz + o * dz);
    m.scale.setScalar(Math.max(0.001, (0.6 + 0.4 * e) * (1 - o)));
  });
}

// ---------------------------------------------------------------- kernel core
const _ico = edgesOf(new THREE.IcosahedronGeometry(1, 1));
const _oct = edgesOf(new THREE.OctahedronGeometry(1, 0));
const _ico0 = edgesOf(new THREE.IcosahedronGeometry(1, 0));
export const ARM_DIRS = [];
for (let i = 0; i < 8; i++) ARM_DIRS.push(new THREE.Vector3(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1).normalize());
export const OCT_EDGES = _oct;
export const ICO_EDGES = _ico0;

// Draws the Octos core into L. o: center, s: scale, t: time, energy: 0..1+, arms: array of arm lengths (0..1) or number
export function drawCore(L, o, s, t, { energy = 1, armK = 1, armLen = 3.2, spin = 0.25, build = 1, armHot = null, pulse = 0 } = {}) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(t * spin * 0.7, t * spin, t * spin * 0.3));
  const e = energy;
  // outer lattice
  m.compose(o, q, new THREE.Vector3(s * 1.35, s * 1.35, s * 1.35));
  L.edges(_ico, m, 1.4, mul(C.cyan, 0.9 * e + pulse), 0.9, build);
  // counter-rotating mid shell
  const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-t * spin * 1.3, t * spin * 0.4, -t * spin));
  m.compose(o, q2, new THREE.Vector3(s * 0.9, s * 0.9, s * 0.9));
  L.edges(_ico0, m, 1.8, mul(C.cyanHot, 0.55 * e + pulse), 1, clamp(build * 1.5 - 0.3));
  // inner octahedron (orange)
  const q3 = new THREE.Quaternion().setFromEuler(new THREE.Euler(t * 0.9, t * 1.1, 0));
  m.compose(o, q3, new THREE.Vector3(s * 0.55, s * 0.55, s * 0.55));
  L.edges(_oct, m, 2.4, mul(C.orangeHot, 0.8 * e + pulse), 1, clamp(build * 2 - 0.8));
  // 8 arms along cube diagonals (static frame so they can be followed)
  for (let i = 0; i < 8; i++) {
    const d = ARM_DIRS[i];
    const k = Array.isArray(armK) ? armK[i] : armK;
    if (k <= 0) continue;
    const a = o.clone().addScaledVector(d, s * 1.1), b = o.clone().addScaledVector(d, s * (1.1 + armLen * k));
    const hot = armHot ? armHot[i] : 0;
    const col = mix3(mul(C.cyan, 0.8 * e), C.orangeHot, hot);
    L.line(a, b, 2 + hot * 2, col, 1);
    // side rails
    const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const v = new THREE.Vector3().crossVectors(d, u);
    const r = s * 0.12;
    for (let j = 0; j < 3; j++) {
      const ang = j * 2.094 + t * 0.5;
      const off = u.clone().multiplyScalar(Math.cos(ang) * r).addScaledVector(v, Math.sin(ang) * r);
      L.line(a.clone().add(off), b.clone().add(off), 0.9, mul(col, 0.5), 0.8);
    }
    // node at end
    if (k > 0.98) {
      L.ring(b, u, v, s * 0.22, 16, 1.6, mul(col, 1.3), 1);
      L.ring(b, u, d, s * 0.22, 16, 1.2, mul(col, 0.8), 1);
    }
  }
}
// solid hot heart (sphere) — add once, scale in update
export function heart(r = 0.3) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 3), new THREE.MeshBasicMaterial());
  m.material.color.setRGB(3, 2.6, 2.3);
  return m;
}

// packet capsule mesh (instanced)
export function packetMesh(n, r = 0.08, len = 0.5) {
  const geo = new THREE.CapsuleGeometry(r, len, 4, 10);
  geo.rotateZ(Math.PI / 2); // along x
  const mat = new THREE.MeshBasicMaterial();
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  for (let i = 0; i < n; i++) im.setColorAt(i, new THREE.Color(1, 1, 1));
  return im;
}

export const METHODS_DOWN = ['client_hello', 'session/open', 'turn/start', 'turn/steer', 'turn/interrupt', 'approval/respond', 'user_question/respond', 'peer/prepare', 'config/capabilities/list', 'task/*'];
export const METHODS_UP = ['message/delta', 'result', 'message/delta', 'peer/gather', 'message/delta', 'result'];

// ---------------------------------------------------------------- environment helpers
// Tron floor grid, segmented so fog / reveal work per piece. colorFn(x, z) → [r, g, b, a] or null
export function floorGrid(L, y, cx, cz, half, step, colorFn, seg = step) {
  const x0 = Math.floor((cx - half) / step) * step, z0 = Math.floor((cz - half) / step) * step;
  const n = Math.ceil(half * 2 / step);
  const ns = Math.ceil(half * 2 / seg);
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * step;
    for (let j = 0; j < ns; j++) {
      const za = z0 + j * seg, zb = za + seg;
      const c = colorFn(x, (za + zb) / 2); if (!c || c[3] <= 0.003) continue;
      L.seg(x, y, za, x, y, zb, c[4] ?? 1, c[0], c[1], c[2], c[3]);
    }
    const z = z0 + i * step;
    for (let j = 0; j < ns; j++) {
      const xa = x0 + j * seg, xb = xa + seg;
      const c = colorFn((xa + xb) / 2, z); if (!c || c[3] <= 0.003) continue;
      L.seg(xa, y, z, xb, y, z, c[4] ?? 1, c[0], c[1], c[2], c[3]);
    }
  }
}
// static dust motes (dots) in a box
export function dust(L, n, [x0, y0, z0], [x1, y1, z1], seed = 1, c = [0.3, 0.6, 0.8], w = 1.6) {
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, hash(seed * 13.1 + i * 1.7)), y = lerp(y0, y1, hash(seed * 7.3 + i * 3.1)), z = lerp(z0, z1, hash(seed * 3.9 + i * 5.3));
    const k = 0.3 + 0.7 * hash(i * 9.7 + seed);
    L.seg(x, y, z, x, y, z, w, c[0] * k, c[1] * k, c[2] * k, 1);
  }
}
export function makeCam(fov = 55) { const c = new THREE.PerspectiveCamera(fov, 16 / 9, 0.05, 600); return c; }
export function baseScene() { const s = new THREE.Scene(); s.background = new THREE.Color(0, 0, 0); return s; }
// dark backing plate for a label (occludes the additive lines behind it); add as child of the label
export function plate(lab, { padX = 0.35, padY = 0.35, opacity = 0.72 } = {}) {
  lab.geometry.computeBoundingBox();
  const b = lab.geometry.boundingBox;
  const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  const g = new THREE.PlaneGeometry(w + padX * h, h * (1 - padY));
  g.translate((b.max.x + b.min.x) / 2, (b.max.y + b.min.y) / 2, -0.01);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x000000 }));
  m.renderOrder = -1;
  lab.add(m);
  return m;
}
