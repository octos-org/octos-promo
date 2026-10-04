// v6-space scenes 5–9: stations (blueprint), world map, clippings wall, today, outro.
import * as THREE from 'three';
import {
  CSS, L, col, paperMat, plane, textMesh, photo, photoCard, hit, pulse, slam, Lines, lathe, satellite, globe, loadLand,
  dottedOrbit, orbitPoint, V, look, clamp, lerp, ease, hash, keys, prog, bt, BEAT, BAR, ROCKET_STEEL,
} from './lib6.js';
import { STATIONS, SITES, MAP_LINE, CLIPS, TODAY, TODAY_BIG, TODAY_DATE, TODAY_LINE, OUTRO, OUTRO_SUB, DUR } from './story.js';
import { ht } from './scenes_a.js';

const persp = (fov = 30) => new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 400);
const M4 = () => new THREE.Matrix4();

// ---------------------------------------------------------------- wire primitives with a transform
function cyl(lines, m, r, len, { n = 14, rings = 3, w = 1.6, c, al = 1, k = 1 } = {}) {
  const P = (a, x) => V(x, Math.cos(a) * r, Math.sin(a) * r).applyMatrix4(m);
  const segs = [];
  for (let i = 0; i < rings; i++) { const x = -len / 2 + (i / (rings - 1)) * len; for (let j = 0; j < n; j++) segs.push([P((j / n) * 6.283, x), P(((j + 1) / n) * 6.283, x)]); }
  for (let j = 0; j < n; j += 2) segs.push([P((j / n) * 6.283, -len / 2), P((j / n) * 6.283, len / 2)]);
  const nn = Math.floor(segs.length * clamp(k)); for (let i = 0; i < nn; i++) lines.line(segs[i][0], segs[i][1], w, c, al);
}
function panel(lines, m, w0, h0, { cols = 6, w = 1.2, c, al = 1, k = 1 } = {}) {
  const P = (x, y) => V(x, y, 0).applyMatrix4(m);
  const segs = [[P(-w0 / 2, -h0 / 2), P(w0 / 2, -h0 / 2)], [P(w0 / 2, -h0 / 2), P(w0 / 2, h0 / 2)], [P(w0 / 2, h0 / 2), P(-w0 / 2, h0 / 2)], [P(-w0 / 2, h0 / 2), P(-w0 / 2, -h0 / 2)]];
  for (let i = 1; i < cols; i++) { const x = -w0 / 2 + (i / cols) * w0; segs.push([P(x, -h0 / 2), P(x, h0 / 2)]); }
  segs.push([P(-w0 / 2, 0), P(w0 / 2, 0)]);
  const nn = Math.floor(segs.length * clamp(k)); for (let i = 0; i < nn; i++) lines.line(segs[i][0], segs[i][1], w, c, al);
}
const at = (base, x, y, z, rx = 0, ry = 0, rz = 0) => base.clone().multiply(M4().makeTranslation(x, y, z)).multiply(M4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));

// generic station silhouettes (illustrative, not scale models); k = build progress 0..1
const BUILD = {
  salyut(l, m, k, c) {
    cyl(l, at(m, -2.2, 0, 0), 0.7, 3.2, { c, k: k * 3 }); cyl(l, at(m, 0.6, 0, 0), 1.0, 3.0, { c, k: k * 3 - 0.5 }); cyl(l, at(m, 2.8, 0, 0), 0.5, 1.4, { c, k: k * 3 - 1 });
    panel(l, at(m, -1.6, 2.4, 0, 0.3), 1.4, 2.6, { c, k: k * 2 - 1 }); panel(l, at(m, -1.6, -2.4, 0, 0.3), 1.4, 2.6, { c, k: k * 2 - 1 });
  },
  mir(l, m, k, c) {
    cyl(l, at(m, 0, 0, 0), 0.9, 4.2, { c, k: k * 4 });
    const arms = [[0, 0, 0], [0, 0, Math.PI / 2], [0, 0, Math.PI], [Math.PI / 2, 0, Math.PI / 2]];
    arms.forEach((r, i) => cyl(l, at(m, 2.1, 0, 0, r[0], r[1], r[2]).multiply(M4().makeTranslation(1.9, 0, 0)), 0.6, 3.4, { c, k: k * 4 - 1 - i * 0.5 }));
    panel(l, at(m, -0.8, 0, 2.6, Math.PI / 2), 1.2, 3.2, { c, k: k * 2 - 1.2 }); panel(l, at(m, -0.8, 0, -2.6, Math.PI / 2), 1.2, 3.2, { c, k: k * 2 - 1.2 });
  },
  iss(l, m, k, c) {
    const P = (x, y, z) => V(x, y, z).applyMatrix4(m);
    const nT = Math.floor(28 * clamp(k * 2));
    for (let i = 0; i < nT; i++) { const x = -7 + i * 0.5; for (const [y, z] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) l.line(P(x, y, z), P(x + 0.5, y, z), 1.4, c); l.line(P(x, 0.3, 0.3), P(x + 0.5, -0.3, -0.3), 1, c, 0.7); }
    for (let i = 0; i < 8; i++) { const x = (i < 4 ? -6.5 : 4.6) + (i % 2) * 1.9, y = i % 4 < 2 ? 2.4 : -2.4; panel(l, at(m, x, y, 0), 1.6, 4.0, { c, cols: 8, k: k * 3 - 1.2 - i * 0.1 }); }
    cyl(l, at(m, 0, 0, -1.4, 0, Math.PI / 2, 0), 0.55, 2.4, { c, k: k * 3 - 1 }); cyl(l, at(m, 0, 0, 1.6, 0, Math.PI / 2, 0), 0.55, 2.8, { c, k: k * 3 - 1.2 }); cyl(l, at(m, 0, 0, 3.6, 0, Math.PI / 2, 0), 0.55, 1.8, { c, k: k * 3 - 1.5 });
  },
  tiangong(l, m, k, c) {
    cyl(l, at(m, 0, 0, 0, 0, 0, Math.PI / 2), 0.8, 4.4, { c, k: k * 4 });
    cyl(l, at(m, -2.7, 2.2, 0), 0.75, 5.2, { c, k: k * 4 - 1 }); cyl(l, at(m, 2.7, 2.2, 0), 0.75, 5.2, { c, k: k * 4 - 1.3 });
    panel(l, at(m, -6.5, 2.2, 0), 2.2, 1.3, { c, cols: 8, k: k * 2 - 1 }); panel(l, at(m, 6.5, 2.2, 0), 2.2, 1.3, { c, cols: 8, k: k * 2 - 1 });
    panel(l, at(m, 0, -2.6, 0, 0, 0, Math.PI / 2), 1.0, 2.2, { c, k: k * 2 - 1.2 });
  },
};

// ---------------------------------------------------------------- S5 stations (blueprint: ink ground, paper lines)
export async function stations(ctx) {
  const scene = new THREE.Scene(); scene.background = col(L.ink);
  const cam = persp(32);
  const lines = new Lines(60000, { normal: true }); scene.add(new THREE.Mesh(lines.geo, lines.mat));
  const items = STATIONS.map(([bar, beat, kind, year, zh, en]) => ({ kind, year, zh, en, t0: hit(bar, beat, 0.12) }));
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      let i = 0; for (let j = 0; j < items.length; j++) if (t >= items[j].t0 - 0.05) i = j;
      const it = items[i], lt = t - it.t0;
      look(cam, [Math.sin(t * 0.3) * 2, 3.2 - lt * 0.2, 19 - lt * 0.6], [0, 0, 0]);
      lines.clear();
      // blueprint grid
      for (let x = -30; x <= 30; x += 2) lines.seg(x, -12, -8, x, 12, -8, 1, ...L.paper, 0.1);
      for (let y = -12; y <= 12; y += 2) lines.seg(-30, y, -8, 30, y, -8, 1, ...L.paper, 0.1);
      const m = M4().makeRotationFromEuler(new THREE.Euler(0.35 + Math.sin(t * 0.4) * 0.05, t * 0.35 + i, 0.08));
      BUILD[it.kind](lines, m, ease.outCubic(clamp(lt / (BEAT * 2.2))), L.paper);
      // dimension line under the model
      const d = prog(t, it.t0 + BEAT * 2, it.t0 + BEAT * 2.6);
      lines.seg(-7 * d, -4.6, 0, 7 * d, -4.6, 0, 1.2, ...L.red2, 0.9);
      lines.seg(-7 * d, -4.9, 0, -7 * d, -4.3, 0, 1.2, ...L.red2, 0.9); lines.seg(7 * d, -4.9, 0, 7 * d, -4.3, 0, 1.2, ...L.red2, 0.9);
      lines.flush();
      return { flash: pulse(t, it.t0, 0.07) * 0.25, flashColor: [0.9, 0.88, 0.84] };
    },
    hud(h, f) {
      const t = f.t;
      let i = 0; for (let j = 0; j < items.length; j++) if (t >= items[j].t0 - 0.05) i = j;
      const it = items[i];
      const s = slam(t, it.t0 + BEAT * 0.5, 0.22, 1.7);
      if (s) { h.save(); h.translate(150, 230); h.scale(s, s); ht(h, it.year, 0, 0, { font: 'SK', px: 190, color: CSS.red2, align: 'left', baseline: 'middle' }); h.restore(); }
      const a = prog(t, it.t0 + BEAT, it.t0 + BEAT * 1.5);
      ht(h, it.zh, 160, 390, { font: 'SB', px: 64, color: CSS.paper, align: 'left', alpha: a, tracking: 0.1 });
      ht(h, it.en, 162, 440, { font: 'PM', px: 24, color: CSS.glow, align: 'left', alpha: a * 0.8, tracking: 0.3 });
      ht(h, `${String(i + 1).padStart(2, '0')} / 04  空间站`, 1780, 1000, { font: 'PM', px: 20, color: CSS.glow, align: 'right', alpha: 0.7, tracking: 0.2 });
    },
  };
}

// ---------------------------------------------------------------- S6 world map: launch sites stamped on the beat
export async function world(ctx) {
  const land = await loadLand(ctx.base);
  const scene = new THREE.Scene(); scene.background = col(L.paper);
  const cam = persp(24);
  const lines = new Lines(40000, { normal: true }); scene.add(new THREE.Mesh(lines.geo, lines.mat));
  const S = 0.1; // world units per degree
  const T0 = bt(16);
  const sites = SITES.map(([b, zh, en, lon, lat]) => ({ zh, en, lon, lat, t0: hit(16, 0.5 + b * 0.75, 0.12) }));
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - T0;
      look(cam, [lerp(-2, 3, prog(t, T0, bt(18))), 1.5 - lt * 0.15, 42 - lt * 1.4], [lerp(-2, 3, prog(t, T0, bt(18))), 1.5, 0]);
      this._cam = cam;
      lines.clear();
      const k = prog(t, T0 - 0.1, T0 + BEAT * 2.5, ease.outCubic);
      for (const ring of land) {
        const nn = Math.floor(ring.length * k);
        for (let i = 1; i < nn; i++) lines.seg(ring[i - 1][0] * S, ring[i - 1][1] * S, 0, ring[i][0] * S, ring[i][1] * S, 0, 1.8, ...L.ink, 0.85);
      }
      for (let lon = -180; lon <= 180; lon += 30) lines.seg(lon * S, -60 * S, -0.1, lon * S, 80 * S, -0.1, 1, ...L.grey, 0.3);
      for (let lat = -60; lat <= 80; lat += 20) lines.seg(-180 * S, lat * S, -0.1, 180 * S, lat * S, -0.1, 1, ...L.grey, 0.3);
      for (const s of sites) {
        if (t < s.t0) continue;
        const x = s.lon * S, y = s.lat * S, lt2 = t - s.t0;
        const r = 0.25 + ease.outCubic(clamp(lt2 / 0.5)) * 0.9;
        lines.ring(V(x, y, 0.05), V(1, 0, 0), V(0, 1, 0), r, 40, 2.4, L.red, clamp(1.4 - lt2));
        lines.ring(V(x, y, 0.05), V(1, 0, 0), V(0, 1, 0), 0.16, 16, 5, L.red, 1);
        // launch arc rising out of the site
        const ak = clamp(lt2 / 0.8);
        for (let i = 0; i < 24 * ak; i += 2) { const a0 = i / 24, a1 = (i + 1) / 24; lines.seg(x + a0 * 3, y + Math.sin(a0 * 2.4) * 3.2, 0.05, x + a1 * 3, y + Math.sin(a1 * 2.4) * 3.2, 0.05, 2, ...L.red, 0.8); }
      }
      lines.flush();
      return {};
    },
    hud(h, f) {
      const t = f.t; const cam = this._cam; if (!cam) return;
      cam.updateMatrixWorld();
      for (const s of sites) {
        if (t < s.t0) continue;
        const p = V(s.lon * S, s.lat * S, 0).project(cam);
        const x = (p.x * 0.5 + 0.5) * 1920 + 26, y = (-p.y * 0.5 + 0.5) * 1080 + 14;
        const sc = slam(t, s.t0, 0.18, 1.8);
        h.save(); h.translate(x, y); h.scale(sc, sc);
        ht(h, s.zh, 0, 0, { font: 'SK', px: 40, color: CSS.red, align: 'left' });
        ht(h, s.en, 2, 26, { font: 'PM', px: 15, color: CSS.ink, align: 'left', tracking: 0.2, alpha: 0.8 });
        h.restore();
      }
      const a = prog(t, hit(17, 2.5), hit(17, 3.2));
      if (a > 0) {
        h.save(); h.globalAlpha = a; h.fillStyle = CSS.ink; h.fillRect(0, 900, 1920 * ease.outCubic(a), 110); h.restore();
        ht(h, MAP_LINE, 960, 975, { font: 'SK', px: 64, color: CSS.paper, alpha: a, tracking: 0.25 });
      }
    },
  };
}

// ---------------------------------------------------------------- S7 clippings wall
export async function clips(ctx) {
  const scene = new THREE.Scene(); scene.background = col(L.paper2);
  const cam = persp(30);
  const lines = new Lines(20000, { normal: true }); const lm = new THREE.Mesh(lines.geo, lines.mat); lm.renderOrder = 1; scene.add(lm);
  const items = [];
  const POS = [[-8.2, 1.9], [-2.4, 2.2], [3.4, 1.8], [-7.6, -3.1], [-1.8, -2.8], [4.0, -3.2], [9.4, 2.0], [9.9, -2.9]];
  for (let i = 0; i < CLIPS.length; i++) {
    const [bar, beat, img, year, cap] = CLIPS[i];
    const tex = await photo(ctx.base, img);
    const g = new THREE.Group();
    const card = photoCard(tex, { w: 4.4, h: 3.3, dots: 56, shadow: 0.2, border: 0.16 });
    g.add(card);
    const y = textMesh(year, 0.95, { font: '400 300px SK', color: CSS.red, anchor: 'l' });
    y.position.set(-card.userData.pw / 2 - 0.1, card.userData.ph / 2 + 0.55, 0.03); g.add(y);
    const c = textMesh(cap, 0.36, { font: '400 120px SB', color: CSS.ink, anchor: 'l' });
    c.position.set(-card.userData.pw / 2 - 0.05, -card.userData.ph / 2 - 0.42, 0.03); g.add(c);
    // tape strips
    for (const sx of [-1, 1]) { const tp = plane(0.9, 0.3, paperMat({ tint: '#ece6d6', opacity: 0.8 })); tp.position.set(sx * (card.userData.pw / 2 - 0.2), card.userData.ph / 2 + 0.05, 0.04); tp.rotation.z = sx * 0.5; g.add(tp); }
    g.position.set(POS[i][0], POS[i][1], i * 0.02);
    g.rotation.z = (hash(i + 3) - 0.5) * 0.14;
    scene.add(g);
    items.push({ g, t0: hit(bar, beat, 0.1), rz: g.rotation.z });
  }
  const STR = hit(20, 2, 0.1);
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - bt(18);
      const cx = keys(t, [[bt(18), -4.5], [bt(19), -1.5], [bt(20), 2.5], [bt(21), 5]]);
      look(cam, [cx, 0.1, 23 - lt * 0.5], [cx + 0.5, 0.1, 0], -0.02);
      for (const it of items) {
        const a = clamp((t - it.t0) / 0.16);
        it.g.visible = t >= it.t0;
        it.g.scale.setScalar(lerp(1.35, 1, ease.outCubic(a)));
        it.g.rotation.z = it.rz + (1 - a) * 0.2;
      }
      lines.clear();
      // newspaper columns ruled in grey behind everything
      for (let c = -8; c < 12; c++) { const x = c * 2.4; lines.seg(x, -8, -0.2, x, 8, -0.2, 1, ...L.grey, 0.25); for (let r = 0; r < 26; r++) { const y = -7 + r * 0.55; const w = 1.4 + hash(c * 31 + r) * 0.6; lines.seg(x + 0.2, y, -0.2, x + 0.2 + w, y, -0.2, 1.6, ...L.grey, 0.18); } }
      lines.flush();
      const s = t >= STR && t < STR + BEAT * 1.5 ? Math.floor((t - STR) / (BEAT / 4)) % 2 : 0;
      return { invert: s, flash: pulse(t, items[items.length - 1].t0, 0.1) * 0.2 };
    },
    hud(h, f) {
      h.save(); h.globalAlpha = 0.92 * prog(f.t, bt(18), bt(18) + 0.3); h.fillStyle = CSS.ink; h.fillRect(0, 930, 760, 110); h.restore();
      ht(h, '新的时代', 90, 1000, { font: 'SK', px: 54, color: CSS.paper, align: 'left', alpha: prog(f.t, bt(18), bt(18) + 0.3) });
      ht(h, 'EVERY NATION · 2003 — 2024', 360, 994, { font: 'PM', px: 18, color: CSS.red, align: 'left', tracking: 0.25, alpha: prog(f.t, bt(18) + 0.2, bt(18) + 0.5) });
    },
  };
}

// ---------------------------------------------------------------- S8 today
export async function today(ctx) {
  const scene = new THREE.Scene(); scene.background = col(L.paper);
  const cam = persp(32);
  const lines = new Lines(40000, { normal: true }); const lm = new THREE.Mesh(lines.geo, lines.mat); lm.renderOrder = 3; scene.add(lm);
  const plates = [];
  for (let i = 0; i < TODAY.length; i++) {
    const [bar, beat, img, year, cap] = TODAY[i];
    const tex = await photo(ctx.base, img);
    const g = new THREE.Group(); scene.add(g);
    const card = photoCard(tex, { w: 7.2, h: 4.6, dots: 72, shadow: 0.12 }); card.position.x = -1.6; g.add(card);
    const y = textMesh(year, 1.7, { font: '400 300px SK', color: CSS.red, anchor: 'l' }); y.position.set(card.userData.pw / 2 - 1.2, 1.2, 0.05); g.add(y);
    const c = textMesh(cap, 0.5, { font: '400 140px SB', color: CSS.ink, anchor: 'l' }); c.position.set(card.userData.pw / 2 - 1.1, -0.3, 0.05); g.add(c);
    plates.push({ g, card, y, c, t0: hit(bar, beat, 0.12), t1: hit(bar + 1, beat, 0.12) });
  }
  const BIG = hit(23, 0), LIFT = hit(23, 2), ORB = hit(24, 0);
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      lines.clear();
      if (t < BIG) {
        const p = t < plates[1].t0 ? plates[0] : plates[1];
        for (const q of plates) q.g.visible = q === p;
        const lt = t - p.t0;
        look(cam, [0.8 - lt * 0.25, 0.2, 14 - lt * 0.5], [0.4 - lt * 0.2, 0, 0]);
        const a = clamp(lt / 0.22);
        p.card.position.y = -(1 - ease.outCubic(a)) * 6;
        const s = slam(t, p.t0 + BEAT * 0.5, 0.22, 1.9); p.y.visible = s > 0; p.y.scale.setScalar(s || 0.001);
        const c = prog(t, p.t0 + BEAT, p.t0 + BEAT * 1.6); p.c.material.uniforms.opacity.value = c; p.c.material.uniforms.reveal.value = c;
      } else {
        for (const q of plates) q.g.visible = false;
        const lt = t - BIG;
        const alt = t < LIFT ? 0 : Math.pow(t - LIFT, 2) * 2.2;
        look(cam, [6, 3 + alt * 0.5, 26], [0, 4 + alt * 0.7, 0]);
        const o = V(0, alt, 0);
        lathe(lines, ROCKET_STEEL, { o, n: 12, w: 2.4, c: L.ink, rot: lt * 0.4 });
        // four little flaps
        for (const [y0, s] of [[10.6, 1], [1.2, 1]]) for (const sx of [-1, 1]) lines.poly([V(o.x + sx * 0.9, o.y + y0, 0), V(o.x + sx * 1.6, o.y + y0 - 0.3, 0), V(o.x + sx * 1.6, o.y + y0 - 1.4, 0), V(o.x + sx * 0.9, o.y + y0 - 1.6, 0)], 2.2, L.ink);
        lines.seg(-40, 0, 0, 40, 0, 0, 2, ...L.ink, 1);
        // trail: dotted red path from pad curving towards orbit
        const n = Math.floor(clamp((t - LIFT) / 2.2) * 60);
        for (let i = 0; i < n; i += 2) { const a = i / 60, b = (i + 1) / 60; lines.seg(Math.pow(a, 2) * -8, a * alt, 0, Math.pow(b, 2) * -8, b * alt, 0, 3, ...L.red, 0.9); }
        if (t > LIFT) for (let i = 0; i < 120; i++) { const life = (t * 1.5 + hash(i) * 2) % 1.1; const px = o.x + (hash(i + 5) - 0.5) * life * 2, py = o.y - life * 5; lines.seg(px, py, 0, px + 0.1, py - 0.3, 0, 3 + hash(i) * 3, ...(i % 4 ? L.ink : L.red), (1 - life / 1.1) * 0.7); }
      }
      lines.flush();
      return { flash: pulse(t, BIG, 0.1) * 0.4 };
    },
    hud(h, f) {
      const t = f.t;
      if (t < BIG) return;
      const s = slam(t, BIG, 0.22, 1.8);
      h.save(); h.translate(470, 470); h.scale(s, s);
      ht(h, TODAY_BIG, 0, 0, { font: 'SK', px: 330, color: CSS.red, baseline: 'middle' }); h.restore();
      ht(h, TODAY_DATE, 470, 700, { font: 'PM', px: 52, color: CSS.ink, tracking: 0.2, alpha: prog(t, BIG + BEAT, BIG + BEAT * 1.5) });
      const a = prog(t, ORB, ORB + 0.5);
      if (a > 0) { h.save(); h.globalAlpha = a; h.fillStyle = CSS.ink; h.fillRect(160, 760, 620 * ease.outCubic(a), 88); h.restore(); ht(h, TODAY_LINE, 470, 818, { font: 'SB', px: 46, color: CSS.paper, alpha: a, tracking: 0.2 }); }
    },
  };
}

// ---------------------------------------------------------------- S9 outro
export async function outro(ctx) {
  const scene = new THREE.Scene(); scene.background = col(L.paper);
  const cam = persp(30);
  const lines = new Lines(20000, { normal: true }); const lm = new THREE.Mesh(lines.geo, lines.mat); lm.renderOrder = 3; scene.add(lm);
  const tex = await photo(ctx.base, 'earth');
  const card = photoCard(tex, { w: 34, h: 19.2, dots: 150, shadow: 0, card: false }); card.position.set(0, 0, -2); scene.add(card);
  const T0 = bt(25);
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - T0;
      look(cam, [0, 0, 15.5 + lt * 0.9], [0, 0, 0]);
      card.userData.photoMat.uniforms.halftone.value = 1 - prog(t, T0 + 2, T0 + 5) * 0.5;
      lines.clear();
      const o = V(0, 0, 0.5);
      dottedOrbit(lines, o, V(1, 0, 0), V(0, 0.3, 0.95), 7.5, 3.2, { k: prog(t, T0, T0 + 2), phase: lt * 4, w: 2.6, c: L.red, al: 0.9 });
      satellite(lines, orbitPoint(o, V(1, 0, 0), V(0, 0.3, 0.95), 7.5, 3.2, lt * 0.9 + 2), { r: 0.2, w: 1.8, c: L.paper });
      lines.flush();
      return { fade: prog(t, DUR - 1.4, DUR - 0.1) };
    },
    hud(h, f) {
      const t = f.t;
      const a = prog(t, T0 + 0.6, T0 + 1.4);
      if (a <= 0) return;
      h.save(); h.globalAlpha = 0.9 * a; h.fillStyle = CSS.paper; h.fillRect(0, 330, 1920, 420); h.restore();
      ht(h, OUTRO[0], 960, 470, { font: 'SK', px: 86, color: CSS.ink, alpha: a, tracking: 0.08 });
      ht(h, OUTRO[1], 960, 580, { font: 'SK', px: 86, color: CSS.ink, alpha: prog(t, T0 + 1.2, T0 + 2), tracking: 0.08 });
      ht(h, OUTRO_SUB, 960, 680, { font: 'SB', px: 34, color: CSS.red, alpha: prog(t, T0 + 2.4, T0 + 3.2), tracking: 0.3 });
    },
  };
}
