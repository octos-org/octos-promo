// Shared helpers for v3-type: colour, type-setting with real kerning, materials, rigs, beat maths.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, ease, hash, keys, prog, mulberry32 } from '../engine/util.js';

export const BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4, S16 = BEAT / 4;

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
export const INK = 0x0b0b0c, INK2 = 0x1a1a1c, BONE = 0xece7dc, ORANGE = 0xff6a1a, GRAPHITE = 0x5e5b57, ASH = 0x9c978f;
export const C = { ink: flat(INK), ink2: flat(INK2), bone: flat(BONE), orange: flat(ORANGE), graphite: flat(GRAPHITE), ash: flat(ASH) };
export const CSS = { ink: '#0b0b0c', bone: '#ece7dc', orange: '#ff6a1a', graphite: '#5e5b57', ash: '#9c978f' };

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
  // Engine.renderFrame accumulates motion-blur sub-frames with renderer.render() into accumRT; with the
  // default autoClear every accumulation pass wipes the previous ones (samples > 1 ends up 1/n as bright).
  // All passes we use clear their own targets explicitly (RenderPass, bloom, shadows, Reflector).
  renderer.autoClear = false;
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
