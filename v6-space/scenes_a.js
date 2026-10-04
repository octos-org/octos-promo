// v6-space scenes 1–4: quote, title, dawn (museum plates), the Moon.
import * as THREE from 'three';
import {
  CSS, L, col, paperMat, plane, textMesh, textTex, photo, photoCard, hit, pulse, slam, Lines, lathe, fins, satellite, globe,
  dottedOrbit, orbitPoint, V, look, clamp, lerp, ease, hash, keys, prog, bt, BEAT, BAR,
} from './lib6.js';
import { QUOTE, QUOTE_BY, TITLE, TITLE_EN, DAWN, MOON_WORDS, MOON_DATE, MOON_LINE } from './story.js';
import { ROCKET_TALL as RT } from './lib6.js';

const persp = (fov = 30) => new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 400);
const U = V(1, 0, 0), UY = V(0, 1, 0), UZ = V(0, 0, 1);

// hud text helper (exact colours: the hud is composited after tone mapping)
export function ht(h, str, x, y, { font = 'SR', px = 40, color = CSS.ink, align = 'center', alpha = 1, tracking = 0, weight = '', baseline = 'alphabetic' } = {}) {
  if (alpha <= 0.002) return;
  h.save(); h.globalAlpha = clamp(alpha); h.fillStyle = color; h.textAlign = align; h.textBaseline = baseline;
  h.font = `${weight}${px}px ${font}`; if ('letterSpacing' in h) h.letterSpacing = `${tracking * px}px`;
  h.fillText(str, x, y); h.restore();
}

// ---------------------------------------------------------------- S1 quote (ink)
export async function quote(ctx) {
  const scene = new THREE.Scene(); scene.background = col(L.ink);
  const cam = persp(32);
  const lines = new Lines(4000, { normal: true }); scene.add(new THREE.Mesh(lines.geo, lines.mat));
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      look(cam, [0, 0, 20 - t * 0.35], [0, 0, 0]);
      lines.clear();
      // a faint orbit slowly drawing itself behind the words
      dottedOrbit(lines, V(0, 0, -6), V(1, 0, 0), V(0, 0.34, 0.94), 13, 5, { k: prog(t, 0.4, 5.5), phase: t * 2, w: 2, c: L.paper, al: 0.22, n: 120 });
      lines.flush();
      return { vignette: 0.35, grain: 0.06 };
    },
    hud(h, f) {
      const t = f.t, cx = 960;
      const rows = [QUOTE[0], QUOTE[1]], y0 = [470, 560];
      let k = 0;
      rows.forEach((row, r) => {
        const chars = [...row], px = 58, adv = px * 1.02, w0 = chars.length * adv;
        chars.forEach((ch, i) => {
          const tc = 0.5 + k * 0.085; k++;
          const a = prog(t, tc, tc + 0.35, ease.outCubic);
          const red = ch === '摇' || ch === '篮';
          ht(h, ch, cx - w0 / 2 + i * adv + adv / 2, y0[r] + (1 - a) * 14, { font: 'SB', px, color: red ? CSS.red2 : CSS.paper, alpha: a });
        });
      });
      const a = prog(t, 3.9, 4.5);
      h.save(); h.globalAlpha = a * 0.7; h.fillStyle = CSS.red2; h.fillRect(cx - 40, 628, 80 * a, 2); h.restore();
      ht(h, '—— ' + QUOTE_BY, cx, 690, { font: 'SR', px: 26, color: CSS.glow, alpha: a * 0.8, tracking: 0.12 });
    },
  };
}

// ---------------------------------------------------------------- S2 title (paper flood)
export async function title(ctx) {
  const T0 = bt(2.5);
  const scene = new THREE.Scene(); scene.background = col(L.paper);
  const cam = persp(28);
  const lines = new Lines(20000, { normal: true }); const lm = new THREE.Mesh(lines.geo, lines.mat); lm.renderOrder = 2; scene.add(lm);
  const glyphs = [...TITLE].map((ch, i) => {
    const m = textMesh(ch, 2.3, { font: '400 300px SK', color: CSS.ink, pad: 10 });
    m.position.set((i - 1.5) * 2.35, 0.35, 0); scene.add(m); return m;
  });
  const en = textMesh(TITLE_EN, 0.34, { font: '400 90px PM', color: CSS.ink, tracking: 0.5 }); en.position.set(0, -1.35, 0); scene.add(en);
  const bar = plane(9.6, 0.05, paperMat({ tint: CSS.red })); bar.position.set(0, -0.95, 0); scene.add(bar);
  const drops = [0, 1, 2, 3].map((i) => hit(2, 2 + i * 0.5, 0.1));
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t, lt = t - T0;
      look(cam, [Math.sin(lt * 0.25) * 1.2, 0.4, 17 - lt * 0.9], [0, 0, 0], -0.02 + lt * 0.006);
      glyphs.forEach((g, i) => {
        const s = slam(t, drops[i], 0.26, 2.2); g.visible = t >= drops[i];
        g.scale.setScalar(s); g.position.y = 0.35 + (1 - clamp((t - drops[i]) / 0.18)) * 0.6;
        g.rotation.z = (1 - clamp((t - drops[i]) / 0.3)) * (i % 2 ? 0.12 : -0.12);
      });
      const e = prog(t, drops[3], drops[3] + 0.5, ease.outCubic);
      en.material.uniforms.opacity.value = e; bar.scale.x = Math.max(0.001, e);
      lines.clear();
      // globe behind + a red orbit ring swinging round the title with a tiny satellite
      globe(lines, V(0, 0.2, -9), 7.2, { rot: lt * 0.25, tilt: 0.4, w: 1.2, c: L.grey, al: 0.35, k: prog(t, T0, T0 + 1.2) });
      const o = V(0, 0.2, 0), u = V(1, 0, 0), v = V(0, 0.28, 0.96);
      dottedOrbit(lines, o, u, v, 7.4, 2.6, { k: prog(t, drops[0], drops[3] + 0.4), phase: lt * 6, w: 3.2, c: L.red, al: 0.95, n: 110 });
      if (t > drops[3]) satellite(lines, orbitPoint(o, u, v, 7.4, 2.6, -lt * 1.3 + 1.2), { r: 0.22, w: 2, c: L.ink, rot: lt });
      lines.flush();
      return { flash: pulse(t, drops[0], 0.1) * 0.15, flashColor: [1, 1, 1] };
    },
    hud(h, f) {
      const t = f.t, lt = t - T0;
      // ink curtain opening as a growing circle of paper
      const r = 2400 * ease.outCubic(clamp(lt / 0.55));
      if (r < 2300) { h.save(); h.fillStyle = CSS.ink; h.beginPath(); h.rect(0, 0, 1920, 1080); h.arc(960, 540, Math.max(0.1, r), 0, Math.PI * 2, true); h.fill('evenodd'); h.restore(); }
      const yr = Math.round(lerp(1903, 2026, prog(t, hit(3, 0), bt(4) - 0.1, ease.inOutCubic)));
      ht(h, `1903 — ${yr}`, 960, 900, { font: 'PM', px: 30, color: CSS.red, tracking: 0.3, alpha: prog(t, hit(3, 0) - 0.2, hit(3, 0)) });
    },
  };
}

// ---------------------------------------------------------------- S3 dawn: museum plates on a long paper wall
export async function dawn(ctx) {
  const scene = new THREE.Scene(); scene.background = col(L.paper);
  const cam = persp(30);
  const lines = new Lines(30000, { normal: true }); const lm = new THREE.Mesh(lines.geo, lines.mat); lm.renderOrder = 3; scene.add(lm);
  const GAP = 12;
  const plates = [];
  for (let i = 0; i < DAWN.length; i++) {
    const [bar, beat, img, year, zh, en] = DAWN[i];
    const tex = await photo(ctx.base, img);
    const g = new THREE.Group(); g.position.x = i * GAP; scene.add(g);
    const card = photoCard(tex, { w: 5.2, h: 4.2, dots: 64, shadow: 0.14 });
    card.position.set(-1.2, 0.2, 0); g.add(card);
    const yearM = textMesh(year, 2.2, { font: '400 300px SK', color: CSS.red, anchor: 'l' });
    yearM.position.set(-1.2 + card.userData.pw / 2 + 0.3, 1.35, 0.05); g.add(yearM);
    const zhM = textMesh(zh, 0.62, { font: '400 160px SB', color: CSS.ink, anchor: 'l' }); zhM.position.set(-1.2 + card.userData.pw / 2 + 0.38, -0.25, 0.05); g.add(zhM);
    const enM = textMesh(en, 0.24, { font: '400 80px PM', color: CSS.grey, anchor: 'l', tracking: 0.2 }); enM.position.set(-1.2 + card.userData.pw / 2 + 0.42, -0.85, 0.05); g.add(enM);
    const rule = plane(0.08, 3.4, paperMat({ tint: CSS.red })); rule.position.set(-1.2 + card.userData.pw / 2 + 0.16, 0.25, 0.04); g.add(rule);
    plates.push({ g, card, yearM, zhM, enM, rule, t0: hit(bar, beat, 0.12) });
  }
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      // camera glides plate to plate, arriving just before each downbeat
      const xs = plates.map((p, i) => [p.t0 - BEAT * 1.2, i * GAP + 1.2]);
      const x = keys(t, [[bt(4) - 0.2, -2.5], ...xs.flatMap(([tt, xx], i) => [[tt, i ? xs[i - 1][1] : -2.5], [tt + BEAT * 1.1, xx, ease.inOutCubic]])]);
      look(cam, [x - 0.3, 0.6 + Math.sin(t * 0.7) * 0.15, 11.2 - (t - bt(4)) * 0.08], [x, 0.3, 0], Math.sin(t * 0.5) * 0.01);
      for (const p of plates) {
        const on = t >= p.t0 - 0.02; p.g.visible = on || t > p.t0 - BEAT * 2;
        const a = clamp((t - p.t0) / 0.2);
        p.card.position.y = 0.2 - (1 - ease.outCubic(a)) * 5;
        p.card.rotation.z = (1 - ease.outCubic(a)) * 0.15;
        p.card.visible = t >= p.t0 - 0.2;
        const s = slam(t, p.t0 + BEAT * 0.5, 0.24, 2.0); p.yearM.visible = s > 0; p.yearM.scale.setScalar(s || 0.001);
        const c = prog(t, p.t0 + BEAT, p.t0 + BEAT * 1.6, ease.outCubic);
        p.zhM.material.uniforms.opacity.value = c; p.enM.material.uniforms.opacity.value = c * 0.9;
        p.zhM.material.uniforms.reveal.value = c;
        p.rule.scale.y = Math.max(0.001, prog(t, p.t0 + BEAT * 0.4, p.t0 + BEAT * 0.9, ease.outCubic));
      }
      lines.clear();
      // registration crosses and ruled lines on the wall
      for (let i = -3; i < 44; i++) {
        const xx = i * 1.5, yy = (hash(i) - 0.5) * 7;
        lines.seg(xx - 0.12, yy, -0.5, xx + 0.12, yy, -0.5, 1.5, ...L.grey, 0.5);
        lines.seg(xx, yy - 0.12, -0.5, xx, yy + 0.12, -0.5, 1.5, ...L.grey, 0.5);
      }
      lines.seg(-20, -3.2, -0.3, 60, -3.2, -0.3, 1.2, ...L.grey, 0.5);
      lines.seg(-20, 3.9, -0.3, 60, 3.9, -0.3, 1.2, ...L.grey, 0.5);
      // Sputnik era: a small globe with an orbit near the first plate
      const o = V(-6.5 + 2, -1.8, -4);
      globe(lines, o, 1.6, { rot: t * 0.6, tilt: 0.4, w: 1.2, c: L.ink, al: 0.55 });
      dottedOrbit(lines, o, V(1, 0, 0), V(0, 0.4, 0.92), 2.7, 1.2, { phase: t * 8, w: 2.4, c: L.red, al: 0.9 });
      satellite(lines, orbitPoint(o, V(1, 0, 0), V(0, 0.4, 0.92), 2.7, 1.2, t * 2.2), { r: 0.14, w: 1.6, c: L.ink, rot: t * 2 });
      lines.flush();
      return {};
    },
  };
}

// ---------------------------------------------------------------- S4 the Moon
export async function moon(ctx) {
  const scene = new THREE.Scene(); scene.background = col(L.paper);
  const cam = persp(34); scene.add(cam);
  const lines = new Lines(60000, { normal: true }); const lm = new THREE.Mesh(lines.geo, lines.mat); lm.renderOrder = 3; scene.add(lm);
  const boot = await photo(ctx.base, 'bootprint');
  const aldrin = await photo(ctx.base, 'aldrin');
  const mkFull = (tex) => { const m = paperMat({ map: tex, halftone: 1, dots: 110, depthTest: false }); m.uniforms.aspect.value = 16 / 9; const p = plane(2, 2 * 9 / 16, m); p.renderOrder = 10; p.position.z = -1.2 / Math.tan((34 / 2) * Math.PI / 180) * 0 - 1; p.visible = false; cam.add(p); return p; };
  // full-frame plates in front of the camera (z=-1 at fov 34: visible height = 2*tan(17°) = 0.611)
  const fh = 2 * Math.tan((34 / 2) * Math.PI / 180);
  const full = [boot, aldrin].map((tx) => { const p = mkFull(tx); p.scale.set(fh * 16 / 9 / 2 * 1.04, fh / (9 / 8) * 1.04, 1); return p; });
  const words = MOON_WORDS.map((w, i) => ({ w, t0: hit(8, i * 1.5 + (i === 2 ? 0.5 : 0), 0.12) }));
  const IGN = hit(10, 0), LIFT = hit(10, 1.5), STROBE = hit(11, 2, 0.12), LAND = bt(11, 3.5);
  const cols = { paper: L.paper, ink: L.ink };
  return {
    scene, camera: cam,
    update(f) {
      const t = f.t;
      const alt = t < LIFT ? 0 : Math.pow(t - LIFT, 2) * 3.2;       // rocket altitude
      const sky = prog(t, LIFT + 0.4, STROBE - 0.2, ease.inOutCubic);  // paper -> ink as we climb
      scene.background.setRGB(lerp(L.paper[0], L.ink[0], sky), lerp(L.paper[1], L.ink[1], sky), lerp(L.paper[2], L.ink[2], sky));
      const inkC = [0, 1, 2].map((i) => lerp(L.ink[i], L.paper[i], sky));
      const camY = keys(t, [[bt(8), 3.5], [IGN, 5.5], [LIFT, 6]]) + alt * 0.92;
      look(cam, [keys(t, [[bt(8), 7], [IGN, 5], [STROBE, 9]]), camY - 1, keys(t, [[bt(8), 24], [IGN, 21], [STROBE, 26]])], [0, camY + (t > LIFT ? 3 : 0), 0], 0.03);
      lines.clear();
      const shake = t > IGN && t < STROBE ? (hash(Math.floor(t * 60)) - 0.5) * 0.06 : 0;
      const o = V(shake, alt, 0);
      lathe(lines, RT, { o, n: 14, w: 2.2, c: inkC, rot: t * 0.3 });
      fins(lines, o, { r: 0.9, h: 1.4, span: 0.6, w: 2.2, c: inkC, rot: t * 0.3 + Math.PI / 4 });
      // launch tower (static), ground line
      for (let y = 0; y < 13; y += 1) { lines.seg(2.6, y, -0.6, 2.6, y + 1, -0.6, 1.6, ...inkC, 0.8); lines.seg(3.6, y, -0.6, 3.6, y + 1, -0.6, 1.6, ...inkC, 0.8); lines.seg(2.6, y, -0.6, 3.6, y + 1, -0.6, 1.2, ...inkC, 0.6); }
      lines.seg(-30, 0, 0, 30, 0, 0, 2, ...inkC, 1);
      // exhaust: ink dashes pouring down and sideways from the nozzle, red core
      if (t > IGN) {
        const n = Math.min(260, Math.floor((t - IGN) * 400));
        for (let i = 0; i < n; i++) {
          const life = (t * 1.3 + hash(i) * 3) % 1.4, sp = 1 + hash(i + 7) * 3;
          const a = (hash(i + 3) - 0.5) * (alt < 2 ? 3.2 : 0.9);
          const px = o.x + Math.sin(a) * life * sp * 2.2, py = o.y - 0.1 - Math.cos(a) * life * sp * (alt < 2 ? 0.6 : 3), pz = (hash(i + 11) - 0.5) * 2 * life;
          const c = i % 5 === 0 ? L.red : inkC;
          lines.seg(px, Math.max(py, 0.05), pz, px + 0.18, Math.max(py, 0.05) + 0.04, pz, 3 + hash(i) * 4, ...c, (1 - life / 1.4) * 0.8);
        }
      }
      // the Moon ahead
      if (t > LIFT + 0.8) { const mo = V(-9, camY + 10, -30); globe(lines, mo, 7 * prog(t, LIFT + 0.8, STROBE, ease.outCubic), { rot: t * 0.2, tilt: 0.2, w: 1.4, c: inkC, al: 0.7, n: 10 }); }
      lines.flush();
      // strobe: bootprint / ink alternating, then hold bootprint
      const sI = Math.floor((t - STROBE) / (BEAT / 4));
      full[0].visible = t >= STROBE && (t >= LAND || sI % 2 === 0);
      full[1].visible = t >= STROBE && t < LAND && sI % 4 === 1;
      if (full[0].visible) full[0].material.uniforms.dots.value = t >= LAND ? 120 + (t - LAND) * 30 : 90;
      return { flash: pulse(t, STROBE, 0.08) * 0.6 + pulse(t, LAND, 0.12) * 0.5, shake: [shake * 0.01, shake * 0.01] };
    },
    hud(h, f) {
      const t = f.t;
      // kinetic words: huge Song Black, stacked, each slams on its beat; clear at ignition
      if (t < IGN + 0.05) {
        const pos = [[420, 420], [960, 640], [1500, 860]];
        words.forEach((w, i) => {
          if (t < w.t0) return;
          const s = slam(t, w.t0, 0.2, 1.6) * (1 + (t - w.t0) * 0.025);
          h.save(); h.translate(pos[i][0], pos[i][1]); h.scale(s, s);
          ht(h, w.w, 0, 0, { font: 'SK', px: 250, color: i === 2 ? CSS.red : CSS.ink, baseline: 'middle' });
          h.restore();
        });
      }
      if (t >= LAND) {
        const a = prog(t, LAND, LAND + 0.3);
        h.save(); h.globalAlpha = 0.86 * a; h.fillStyle = CSS.paper; h.fillRect(0, 700, 1920, 260); h.restore();
        h.save(); const s = slam(t, LAND, 0.22, 1.5); h.translate(960, 812); h.scale(s, s);
        ht(h, MOON_DATE, 0, 0, { font: 'SK', px: 150, color: CSS.red, baseline: 'middle', tracking: 0.02 }); h.restore();
        ht(h, MOON_LINE, 960, 925, { font: 'SB', px: 44, color: CSS.ink, alpha: prog(t, LAND + 0.3, LAND + 0.7), tracking: 0.3 });
      }
    },
  };
}
