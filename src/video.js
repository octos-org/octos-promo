// Octos promo. Every frame is a pure function of song time t (seconds).
// The soundtrack (audio/synth.py) is 128 BPM, so the edit is laid out in bars.

export const W = 1920, H = 1080;
export const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;
export const DUR = 63;

const C = {
  ink: '#07090d', ink2: '#10141b', bone: '#ece7dc', dim: '#5d6470', faint: '#232934',
  signal: '#ff6a1a', cyan: '#43d3ff',
};

// ---------- small math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, x) => a + (b - a) * x;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ss = (x) => x * x * (3 - 2 * x);
const outCubic = (x) => 1 - (1 - x) ** 3;
const outExpo = (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x));
const inCubic = (x) => x * x * x;
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const frameIdx = (t) => Math.floor(t * 60 + 1e-6);
const bar = (b) => b * BAR;
const beatIn = (t) => t / BEAT;
// Kick pulse: 1 on each kick, decays within the beat. Kicks run bars 4-28.
function kick(t) {
  if (t < bar(4) || t >= bar(29)) return 0;
  return Math.exp(-((t % BEAT) / BEAT) * 7);
}

// ---------- fonts ----------
const FONTS = [
  ['Archivo', 'fonts/Archivo-w1000-500.ttf', '500'],
  ['Archivo', 'fonts/Archivo-w1000-900.ttf', '900'],
  ['ArchivoX', 'fonts/Archivo-w1250-900.ttf', '900'],
  ['Plex', 'fonts/IBMPlexMono-Regular.ttf', '400'],
  ['Plex', 'fonts/IBMPlexMono-SemiBold.ttf', '600'],
];
const font = (fam, px, wt = 400) => `${wt} ${px}px ${fam}`;

// ---------- the Octos logo, from the README ----------
const LOGO = [
  ' ██████╗  ██████╗████████╗ ██████╗ ███████╗',
  '██╔═══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔════╝',
  '██║   ██║██║        ██║   ██║   ██║███████╗',
  '██║   ██║██║        ██║   ██║   ██║╚════██║',
  '╚██████╔╝╚██████╗   ██║   ╚██████╔╝███████║',
  ' ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚══════╝',
];
// Box-drawing chars → which sides of the cell the (double) line reaches.
const BOX = { '═': 'lr', '║': 'ud', '╔': 'rd', '╗': 'ld', '╚': 'ur', '╝': 'ul' };
const LOGO_CELLS = [];
LOGO.forEach((row, r) => [...row].forEach((ch, c) => {
  if (ch === '█') LOGO_CELLS.push({ r, c, kind: 'block' });
  else if (BOX[ch]) LOGO_CELLS.push({ r, c, kind: 'box', sides: BOX[ch] });
}));
const LOGO_COLS = Math.max(...LOGO.map((r) => [...r].length));

// ---------- content ----------
const CRATES = [
  ['octos-core', 'types · OUP commands · codecs'],
  ['octos-llm', 'providers · routing · failover'],
  ['octos-memory', 'memory · episodes · retrieval'],
  ['octos-plugin', 'skills · plugins'],
  ['octos-agent', 'execution loop · tools · sandbox'],
  ['octos-pipeline', 'workflow graphs · validation'],
  ['octos-bus', 'sessions · infrastructure'],
  ['octos-swarm', 'parallel workers · aggregation'],
  ['octos-cli', 'runtime · OUP hosting'],
];
const CRATE_ORDER = [4, 0, 1, 2, 5, 8, 7, 6, 3]; // agent first, then clockwise

const OUP_MSGS = [
  ['client_hello', 1], ['config/capabilities/list', 1], ['session/open', 1], ['session/opened', -1],
  ['turn/start', 1], ['turn/accepted', -1], ['message/delta', -1], ['tool/started', -1],
  ['tool/completed', -1], ['task/progress', -1], ['turn/steer', 1], ['message/delta', -1],
  ['approval/request', -1], ['approval/respond', 1], ['tool/started', -1], ['task/progress', -1],
  ['peer/prepare', 1], ['session/open', 1], ['turn/start', 1], ['peer/gather', 1],
  ['task/output', -1], ['message/delta', -1], ['turn/interrupt', 1], ['turn/completed', -1],
];

const SURFACES = ['Linux', 'macOS', 'Windows', 'RISC-V', 'C ABI', 'Python', 'Swift · Kotlin', 'WASM + OUP'];

const RAPID = [
  'EXECUTION LOOP', 'CONTEXT', 'MEMORY', 'TOOLS', 'SKILLS', 'HOOKS',
  'SANDBOX', 'WORKFLOWS', 'MODEL ROUTING', 'FAILOVER', 'APPROVALS', 'REPLAY',
  'ALL', 'IN ONE', 'RUST', 'KERNEL.',
];

// ---------- timeline (bars) ----------
const SCENES = [
  { name: 'BOOT', from: 0, to: 4, fn: sceneBoot },
  { name: 'KERNEL', from: 4, to: 8, fn: sceneTagline },
  { name: 'CRATES', from: 8, to: 12, fn: sceneCrates },
  { name: 'OUP', from: 12, to: 16, fn: sceneOUP },
  { name: 'SURFACES', from: 16, to: 20, fn: sceneSurfaces },
  { name: 'SWARM', from: 20, to: 24, fn: sceneSwarm },
  { name: 'FEATURES', from: 24, to: 28, fn: sceneRapid },
  { name: 'OCTOS', from: 28, to: 99, fn: sceneOutro },
];

// =====================================================================
export class Video {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bloom = Object.assign(document.createElement('canvas'), { width: W / 4, height: H / 4 });
    this.bctx = this.bloom.getContext('2d');
    this.accum = Object.assign(document.createElement('canvas'), { width: W, height: H });
    this.actx = this.accum.getContext('2d', { alpha: false });
    this.ready = this.init();
  }

  async init() {
    await Promise.all(FONTS.map(async ([fam, url, wt]) => {
      const f = new FontFace(fam, `url(${url})`, { weight: wt });
      document.fonts.add(await f.load());
    }));
    // Grain tiles: a few precomputed noise textures, picked per frame.
    this.grain = [0, 1, 2, 3, 4, 5].map((k) => {
      const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
      const g = c.getContext('2d'); const img = g.createImageData(256, 256);
      for (let i = 0; i < 256 * 256; i++) {
        const v = hash(i * 1.37 + k * 9173.1) * 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0); return c;
    });
    this.vignette = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const v = this.vignette.getContext('2d');
    const rg = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.75)');
    v.fillStyle = rg; v.fillRect(0, 0, W, H);
  }

  // samples > 1 averages sub-frames over a short shutter (motion blur).
  renderFrame(t, samples = 1, shutter = 0.5) {
    const ctx = this.ctx;
    if (samples <= 1) {
      this.drawScene(ctx, t);
    } else {
      for (let k = 0; k < samples; k++) {
        const st = t + ((k + 0.5) / samples - 0.5) * shutter / 60;
        this.drawScene(ctx, st);
        this.actx.globalAlpha = 1 / (k + 1);
        this.actx.drawImage(this.canvas, 0, 0);
      }
      ctx.drawImage(this.accum, 0, 0);
    }
    this.post(ctx, t);
  }

  drawScene(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
    const b = t / BAR;
    const s = SCENES.find((sc) => b >= sc.from && b < sc.to) || SCENES[SCENES.length - 1];
    ctx.save();
    s.fn(ctx, t, t - bar(s.from), s);
    ctx.restore();
    this.scene = s;
  }

  post(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    // bloom: blurred quarter-res copy added back
    const bc = this.bctx;
    bc.globalCompositeOperation = 'copy'; bc.filter = 'blur(6px) brightness(0.9)';
    bc.drawImage(this.canvas, 0, 0, W / 4, H / 4);
    bc.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + 0.25 * kick(t);
    ctx.drawImage(this.bloom, 0, 0, W, H);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.vignette, 0, 0);
    // HUD
    drawHUD(ctx, t, this.scene);
    // grain
    const g = this.grain[frameIdx(t) % this.grain.length];
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.09;
    ctx.fillStyle = ctx.createPattern(g, 'repeat');
    const off = hash(frameIdx(t)) * 256;
    ctx.translate(-off, -off * 0.7); ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // flash into the drop, fade out at the end
    const flash = t >= bar(16) ? Math.exp(-(t - bar(16)) * 5) : 0;
    if (flash > 0.003) { ctx.fillStyle = `rgba(255,240,225,${flash})`; ctx.fillRect(0, 0, W, H); }
    const fadeIn = 1 - prog(t, 0, 0.6);
    const fadeOut = prog(t, 60.5, 62.8);
    const black = Math.max(fadeIn, fadeOut);
    if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, W, H); }
  }
}

// =====================================================================
// HUD: crop marks, section, bar counter, timecode.
function drawHUD(ctx, t, scene) {
  const a = 0.55;
  ctx.strokeStyle = `rgba(236,231,220,${a * 0.6})`; ctx.lineWidth = 1.5;
  const m = 44, L = 28;
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x + dx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * L); ctx.stroke();
  }
  ctx.font = font('Plex', 15, 400); ctx.fillStyle = `rgba(236,231,220,${a})`;
  ctx.letterSpacing = '2px';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('OCTOS — AGENTIC OPERATING SYSTEM', m + 38, H - m - 6);
  ctx.fillText(`${String((scene && SCENES.indexOf(scene) + 1) || 1).padStart(2, '0')} / ${scene ? scene.name : ''}`, m + 38, m + 20);
  ctx.textAlign = 'right';
  const b = Math.floor(t / BAR), bt = Math.floor((t % BAR) / BEAT);
  const tc = `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  ctx.fillText(`BAR ${String(b + 1).padStart(2, '0')}.${bt + 1}   ${tc}`, W - m - 38, H - m - 6);
  ctx.fillText('128 BPM · 1920×1080 · 60P', W - m - 38, m + 20);
  // beat ticker
  const k = kick(t);
  ctx.fillStyle = k > 0 ? `rgba(255,106,26,${0.3 + 0.7 * k})` : `rgba(236,231,220,0.2)`;
  ctx.fillRect(W - m - 30, m + 8, 12, 12);
  ctx.letterSpacing = '0px';
}

// ---------- drawing helpers ----------
function text(ctx, s, x, y, { f = 'Archivo', px = 40, wt = 900, color = C.bone, align = 'left', base = 'alphabetic', track = 0, alpha = 1 } = {}) {
  ctx.font = font(f, px, wt); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.letterSpacing = `${track}px`; ctx.globalAlpha = alpha;
  ctx.fillText(s, x, y);
  ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
}
function typed(s, t, cps) { return s.slice(0, Math.max(0, Math.floor(t * cps))); }
function measure(ctx, s, f, px, wt, track = 0) {
  ctx.font = font(f, px, wt); ctx.letterSpacing = `${track}px`;
  const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w;
}
function fitPx(ctx, s, f, wt, maxW, maxPx, track = 0) {
  const w = measure(ctx, s, f, 100, wt, track);
  return Math.min(maxPx, (100 * maxW) / w);
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// Logo drawn from cells. `appear(cell)` returns 0..1 per cell; returns nothing.
function drawLogo(ctx, cx, cy, cw, t, appear, { glow = 1, scatter = 0 } = {}) {
  const ch = cw * 2;
  const x0 = cx - (LOGO_COLS * cw) / 2, y0 = cy - (LOGO.length * ch) / 2;
  for (const cell of LOGO_CELLS) {
    const a = appear(cell);
    if (a <= 0) continue;
    const seed = cell.r * 97 + cell.c;
    const sc = scatter * (1 - a);
    const dx = (hash(seed) - 0.5) * 900 * sc, dy = (hash(seed + 7) - 0.5) * 600 * sc;
    const x = x0 + cell.c * cw + dx, y = y0 + cell.r * ch + dy;
    ctx.globalAlpha = clamp(a * 1.5);
    if (cell.kind === 'block') {
      ctx.fillStyle = C.bone;
      ctx.fillRect(x - 0.5, y - 0.5, cw + 1, ch + 1);
    } else {
      ctx.strokeStyle = C.signal; ctx.lineWidth = Math.max(1.5, cw * 0.09);
      const mx = x + cw / 2, my = y + ch / 2, o = cw * 0.16;
      ctx.beginPath();
      for (const s of cell.sides) {
        for (const k of [-1, 1]) {
          if (s === 'l' || s === 'r') {
            ctx.moveTo(mx - o, my + k * o); ctx.lineTo(s === 'l' ? x : x + cw, my + k * o);
            ctx.moveTo(mx + o, my + k * o); ctx.lineTo(s === 'l' ? x : x + cw, my + k * o);
          } else {
            ctx.moveTo(mx + k * o, my - o); ctx.lineTo(mx + k * o, s === 'u' ? y : y + ch);
            ctx.moveTo(mx + k * o, my + o); ctx.lineTo(mx + k * o, s === 'u' ? y : y + ch);
          }
        }
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  if (glow > 0) {
    // soft signal underglow
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, LOGO_COLS * cw * 0.6);
    g.addColorStop(0, `rgba(255,106,26,${0.10 * glow})`); g.addColorStop(1, 'rgba(255,106,26,0)');
    ctx.fillStyle = g; ctx.globalCompositeOperation = 'lighter';
    ctx.fillRect(cx - LOGO_COLS * cw, cy - 400, LOGO_COLS * cw * 2, 800);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function bgGrid(ctx, t, alpha = 1, step = 60) {
  ctx.strokeStyle = C.faint; ctx.globalAlpha = alpha; ctx.lineWidth = 1;
  ctx.beginPath();
  const off = (t * 12) % step;
  for (let x = -step + off; x < W + step; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke(); ctx.globalAlpha = 1;
}

// =====================================================================
// 1. BOOT — build, serve, logo.
function sceneBoot(ctx, t, lt) {
  bgGrid(ctx, t, 0.5 * prog(lt, 0, 2));
  const lines = [
    [0.3, '$ cargo build --release -p octos-cli', 'cmd'],
    [1.25, '   Compiling octos-core', 'out'], [1.4, '   Compiling octos-llm', 'out'],
    [1.55, '   Compiling octos-memory', 'out'], [1.7, '   Compiling octos-plugin', 'out'],
    [1.85, '   Compiling octos-agent', 'out'], [2.0, '   Compiling octos-pipeline', 'out'],
    [2.15, '   Compiling octos-swarm', 'out'], [2.3, '   Compiling octos-cli', 'out'],
    [2.6, '    Finished `release` profile [optimized]', 'ok'],
    [2.95, '$ octos serve --stdio', 'cmd'],
  ];
  const termFade = 1 - 0.8 * ss(prog(lt, bar(2) - 0.2, bar(2) + 0.6));
  const x = 180; let y = 200;
  for (const [ts, s, kind] of lines) {
    if (lt < ts) break;
    let shown = s;
    if (kind === 'cmd') shown = '$' + typed(s.slice(1), lt - ts, 38);
    const color = kind === 'cmd' ? C.bone : kind === 'ok' ? C.signal : C.dim;
    text(ctx, shown, x, y, { f: 'Plex', px: 30, wt: kind === 'cmd' ? 600 : 400, color, alpha: termFade });
    y += 46;
  }
  // cursor
  if (Math.floor(lt / 0.35) % 2 === 0 || lt > 2.95) {
    ctx.globalAlpha = termFade; ctx.fillStyle = C.signal;
    ctx.fillRect(x + (lt > 2.95 ? measure(ctx, typed('$ octos serve --stdio', lt - 2.95, 38), 'Plex', 30, 600) + 4 : 0), y - 60 - (lt > 2.95 ? 0 : -46) + 32, 16, 30);
    ctx.globalAlpha = 1;
  }
  // logo assembles from the top row down, cell by cell, over bars 2-3
  const la = lt - bar(2);
  if (la > 0) {
    drawLogo(ctx, W / 2, H / 2 - 40, 30, t, (cell) => outCubic(prog(la, cell.r * 0.22 + cell.c * 0.012, cell.r * 0.22 + cell.c * 0.012 + 0.5)), { glow: prog(la, 0.5, 2), scatter: 0.15 });
    const sub = 'the agent harness kernel';
    text(ctx, typed(sub, la - 1.9, 20), W / 2, H / 2 + 190, { f: 'Plex', px: 34, wt: 400, color: C.bone, align: 'center', track: 4 });
  }
}

// 2. KERNEL — tagline slams, one word per beat.
function sceneTagline(ctx, t, lt) {
  const b = lt / BEAT; // 0..16
  const k = kick(t);
  bgGrid(ctx, t, 0.35);
  if (b < 10) {
    const words = ['AN', 'EMBEDDABLE', 'AI AGENT', 'HARNESS', 'KERNEL'];
    const at = [0, 1, 2.5, 4, 6];
    const rows = [['AN', 'EMBEDDABLE'], ['AI AGENT'], ['HARNESS'], ['KERNEL']];
    const sizes = [120, 170, 170, 250];
    let y = 250;
    rows.forEach((row, ri) => {
      let x = 170;
      row.forEach((w) => {
        const wi = words.indexOf(w);
        const p = prog(b, at[wi], at[wi] + 0.35);
        if (p > 0) {
          const pop = 1 + 0.25 * (1 - outExpo(p));
          const isLast = w === 'KERNEL';
          ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
          text(ctx, w, 0, 0, { f: isLast ? 'ArchivoX' : 'Archivo', px: sizes[ri], wt: 900, color: isLast ? C.signal : C.bone, alpha: clamp(p * 3), base: 'alphabetic' });
          ctx.restore();
        }
        x += measure(ctx, w + ' ', ri === 3 ? 'ArchivoX' : 'Archivo', sizes[ri], 900);
      });
      y += sizes[ri] * 0.92 + (ri === 0 ? 30 : 0);
    });
    // exit: wipe up on beat 8.5
    const wipe = ss(prog(b, 8.6, 10));
    if (wipe > 0) { ctx.fillStyle = C.ink; ctx.fillRect(0, H * (1 - wipe), W, H * wipe); }
  }
  if (b >= 9.5) {
    const p = outExpo(prog(b, 10, 10.4));
    text(ctx, 'WRITTEN IN', W / 2, H / 2 - 150, { f: 'Plex', px: 44, wt: 600, color: C.dim, align: 'center', track: 18, alpha: prog(b, 9.5, 10) });
    const rp = prog(b, 12, 12.3);
    if (rp > 0) {
      const sc = 1 + 0.5 * (1 - outExpo(rp)) + 0.03 * k;
      ctx.save(); ctx.translate(W / 2, H / 2 + 150); ctx.scale(sc, sc);
      text(ctx, 'RUST.', 0, 0, { f: 'ArchivoX', px: 330, wt: 900, color: C.signal, align: 'center', alpha: clamp(rp * 3) });
      ctx.restore();
    }
    void p;
  }
}

// 3. CRATES — the workspace lights up crate by crate.
function sceneCrates(ctx, t, lt) {
  const b = lt / BEAT;
  bgGrid(ctx, t, 0.3);
  text(ctx, 'COMPOSE THE PARTS YOU NEED', 170, 175, { f: 'Archivo', px: 64, wt: 900, color: C.bone, alpha: prog(b, 0, 0.5) });
  text(ctx, typed('cargo add --git https://github.com/octos-org/octos', b * BEAT - 0.2, 45), 172, 222, { f: 'Plex', px: 24, color: C.dim });
  const cw = 500, chh = 200, gx = 30, gy = 26;
  const ox = W / 2 - (3 * cw + 2 * gx) / 2, oy = 280;
  const pos = (i) => [ox + (i % 3) * (cw + gx), oy + Math.floor(i / 3) * (chh + gy)];
  // wires from agent (centre) to each lit crate
  const [ax, ay] = pos(4);
  CRATE_ORDER.forEach((ci, k) => {
    if (ci === 4) return;
    const p = prog(b, k + 0.1, k + 0.9);
    if (p <= 0) return;
    const [x, y] = pos(ci);
    const sx = ax + cw / 2, sy = ay + chh / 2, ex = x + cw / 2, ey = y + chh / 2;
    ctx.strokeStyle = C.signal; ctx.globalAlpha = 0.45; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -lt * 40;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(lerp(sx, ex, outCubic(p)), lerp(sy, ey, outCubic(p))); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // travelling packet
    const q = (lt * 0.9 + k * 0.13) % 1;
    if (p >= 1) { ctx.fillStyle = C.signal; ctx.fillRect(lerp(sx, ex, q) - 4, lerp(sy, ey, q) - 4, 8, 8); }
  });
  CRATE_ORDER.forEach((ci, k) => {
    const [x, y] = pos(ci);
    const p = prog(b, k, k + 0.3);
    const lit = Math.exp(-Math.max(0, b - k) * 1.5) * (b >= k ? 1 : 0);
    ctx.fillStyle = ci === 4 ? '#1a1410' : C.ink2;
    ctx.globalAlpha = 0.4 + 0.6 * p;
    roundRect(ctx, x, y, cw, chh, 10); ctx.fill();
    ctx.strokeStyle = ci === 4 || lit > 0.05 ? C.signal : C.faint;
    ctx.lineWidth = ci === 4 ? 3 : 1.5 + 2 * lit;
    ctx.globalAlpha = ci === 4 ? p : 0.3 + 0.7 * Math.max(lit, p * 0.4);
    ctx.stroke(); ctx.globalAlpha = 1;
    if (p > 0) {
      const [name, role] = CRATES[ci];
      text(ctx, name, x + 30, y + 80, { f: 'Plex', px: 40, wt: 600, color: ci === 4 ? C.signal : C.bone, alpha: p });
      text(ctx, role, x + 30, y + 130, { f: 'Plex', px: 22, color: C.dim, alpha: p });
      text(ctx, `crates/${name}`, x + cw - 24, y + chh - 20, { f: 'Plex', px: 14, color: C.faint, align: 'right', alpha: p });
    }
    if (lit > 0.02) { ctx.fillStyle = `rgba(255,106,26,${0.12 * lit})`; roundRect(ctx, x, y, cw, chh, 10); ctx.fill(); }
  });
}

// 4. OUP — requests and events fly between an app and the runtime.
function sceneOUP(ctx, t, lt) {
  bgGrid(ctx, t, 0.3);
  const b = lt / BEAT; // 0..16
  const lx = 330, rx = W - 330, top = 300, bot = 900;
  // app / runtime pillars
  for (const [x, title, sub, col] of [[lx, 'YOUR APP', 'native · terminal · browser · agent', C.bone], [rx, 'OCTOS RUNTIME', 'owns history · state · permissions', C.signal]]) {
    const p = outCubic(prog(b, x === lx ? 0 : 0.5, x === lx ? 1 : 1.5));
    ctx.fillStyle = C.ink2; ctx.globalAlpha = p; roundRect(ctx, x - 190, top, 380, bot - top, 14); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    text(ctx, title, x, top + 70, { f: 'Archivo', px: 44, wt: 900, color: col, align: 'center', alpha: p });
    text(ctx, sub, x, top + 110, { f: 'Plex', px: 17, color: C.dim, align: 'center', alpha: p });
  }
  text(ctx, 'OUP', W / 2, 190, { f: 'ArchivoX', px: 150, wt: 900, color: C.bone, align: 'center', alpha: prog(b, 0, 0.4) });
  text(ctx, 'OCTOS UI PROTOCOL · JSON-RPC 2.0 · WEBSOCKET OR STDIO', W / 2, 240, { f: 'Plex', px: 22, wt: 600, color: C.signal, align: 'center', track: 3, alpha: prog(b, 1, 1.5) });
  // messages: one every 8th note from beat 2; the last bar doubles to 16ths.
  const lanes = 9, laneY = (i) => top + 170 + i * 44;
  const spawn = [];
  for (let i = 0, s = 2; s < 16.5; i++) { spawn.push(s); s += s >= 12 ? 0.25 : 0.5; }
  spawn.forEach((s, i) => {
    const age = (b - s) * BEAT;
    const dur = 0.9;
    if (age < 0 || age > dur) return;
    const [m, dir] = OUP_MSGS[i % OUP_MSGS.length];
    const p = ss(age / dur);
    const x0 = dir > 0 ? lx + 190 : rx - 190, x1 = dir > 0 ? rx - 190 : lx + 190;
    const y = laneY(i % lanes);
    const x = lerp(x0, x1, p);
    const w = measure(ctx, m, 'Plex', 22, 600) + 36;
    const col = dir > 0 ? C.bone : C.signal;
    // trail
    const g = ctx.createLinearGradient(x0, 0, x, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, dir > 0 ? 'rgba(236,231,220,0.35)' : 'rgba(255,106,26,0.45)');
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x, y); ctx.stroke();
    const px = x - (dir > 0 ? w : 0);
    ctx.fillStyle = C.ink; roundRect(ctx, px, y - 17, w, 34, 17); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, m, px + 18, y + 8, { f: 'Plex', px: 22, wt: 600, color: col });
  });
  // legend
  text(ctx, '→ requests', lx - 170, bot + 50, { f: 'Plex', px: 20, color: C.bone, alpha: prog(b, 2, 3) });
  text(ctx, '← events', rx + 170, bot + 50, { f: 'Plex', px: 20, color: C.signal, align: 'right', alpha: prog(b, 2, 3) });
  // riser: brighten toward the drop
  const r = inCubic(prog(b, 12, 16));
  if (r > 0) { ctx.fillStyle = `rgba(255,235,215,${0.55 * r})`; ctx.fillRect(0, 0, W, H); }
}

// 5. SURFACES — one kernel, eight arms, every platform.
function sceneSurfaces(ctx, t, lt) {
  const b = lt / BEAT;
  const k = kick(t);
  const cx = W / 2, cy = 615;
  // radial glow
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 700);
  g.addColorStop(0, `rgba(255,106,26,${0.16 + 0.1 * k})`); g.addColorStop(1, 'rgba(255,106,26,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // rings
  ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.ellipse(cx, cy, 130 * i + 20 * k, 75 * i + 12 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
  const grow = outCubic(prog(b, 0, 2));
  SURFACES.forEach((name, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / 4 + Math.PI / 8;
    const L = 560 * grow;
    const N = 40;
    let px = cx, py = cy;
    const pts = [];
    for (let j = 0; j <= N; j++) {
      const s = j / N;
      const r = 95 + s * L;
      const a = ang + 0.28 * Math.sin(s * 5.5 - lt * 3.2 + i * 1.7) * s;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.56]);
    }
    for (let j = 1; j <= N; j++) {
      const s = j / N;
      ctx.strokeStyle = C.signal; ctx.lineCap = 'round';
      ctx.lineWidth = lerp(22, 3, s) * (1 + 0.25 * k);
      ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.moveTo(pts[j - 1][0], pts[j - 1][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke();
      // suckers
      if (j % 5 === 0 && s < 0.85) {
        ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(pts[j][0], pts[j][1], lerp(6, 1.5, s), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    [px, py] = pts[N];
    // label pops on beat i/2 after the arms land
    const lp = outExpo(prog(b, 2 + i * 0.75, 2.4 + i * 0.75));
    if (lp > 0) {
      const lw = measure(ctx, name, 'Plex', 28, 600) + 40;
      const bx = px - lw / 2, by = py - 26 + (py < cy ? -30 : 30);
      ctx.globalAlpha = lp; ctx.fillStyle = C.ink; roundRect(ctx, bx, by, lw, 52, 26); ctx.fill();
      ctx.strokeStyle = C.bone; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
      text(ctx, name, px, by + 35, { f: 'Plex', px: 28, wt: 600, color: C.bone, align: 'center', alpha: lp });
    }
  });
  // core
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(cx, cy, 120 + 8 * k, 120 + 8 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.signal; ctx.lineWidth = 4; ctx.stroke();
  text(ctx, 'octos', cx, cy + 16, { f: 'ArchivoX', px: 52, wt: 900, color: C.bone, align: 'center' });
  // headline
  const h1 = outExpo(prog(b, 0, 0.3)), h2 = outExpo(prog(b, 8, 8.3));
  text(ctx, 'ONE KERNEL.', W / 2 - 24, 150, { f: 'ArchivoX', px: 70, wt: 900, color: C.bone, align: 'right', alpha: h1 });
  text(ctx, 'EVERY SURFACE.', W / 2 + 24, 150, { f: 'ArchivoX', px: 70, wt: 900, color: C.signal, align: 'left', alpha: h2 });
}

// 6. SWARM — a lead prepares peers, they work, results are gathered.
function sceneSwarm(ctx, t, lt) {
  bgGrid(ctx, t, 0.3);
  const b = lt / BEAT;
  const k = kick(t);
  const lead = [380, 600];
  const peers = [];
  for (let i = 0; i < 24; i++) {
    const col = i % 6, row = Math.floor(i / 6);
    peers.push([900 + col * 150 + (hash(i) - 0.5) * 50 + (row % 2) * 70, 360 + row * 150 + (hash(i + 50) - 0.5) * 40, i]);
  }
  const stage = b < 4 ? 'peer/prepare' : b < 8 ? 'turn/start' : b < 12 ? 'task/progress' : 'peer/gather';
  text(ctx, 'COORDINATE A FLEET', 150, 190, { f: 'ArchivoX', px: 86, wt: 900, color: C.bone, alpha: outExpo(prog(b, 0, 0.3)) });
  text(ctx, stage, 154, 245, { f: 'Plex', px: 30, wt: 600, color: C.signal });
  peers.forEach(([x, y, i]) => {
    const born = (i / 24) * 6; // peers appear across beats 0-6
    const p = outCubic(prog(b, born, born + 0.6));
    if (p <= 0) return;
    // link
    ctx.strokeStyle = C.faint; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(lead[0], lead[1]); ctx.lineTo(lerp(lead[0], x, p), lerp(lead[1], y, p)); ctx.stroke();
    // outgoing brief
    const q = prog(b, born, born + 1);
    if (q > 0 && q < 1) { ctx.fillStyle = C.bone; ctx.fillRect(lerp(lead[0], x, q) - 4, lerp(lead[1], y, q) - 4, 8, 8); }
    // incoming result during gather (beats 12-15)
    const gstart = 12 + (i / 24) * 3;
    const r = prog(b, gstart, gstart + 0.8);
    if (r > 0 && r < 1) {
      ctx.fillStyle = C.signal; ctx.beginPath(); ctx.arc(lerp(x, lead[0], ss(r)), lerp(y, lead[1], ss(r)), 6, 0, Math.PI * 2); ctx.fill();
    }
    // node + work ring
    const work = clamp(prog(b, 6 + hash(i) * 2, 11 + hash(i + 3)));
    ctx.fillStyle = C.ink2; ctx.beginPath(); ctx.arc(x, y, 30 * p, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.faint; ctx.lineWidth = 3; ctx.stroke();
    if (work > 0) {
      ctx.strokeStyle = work >= 1 ? C.signal : C.bone; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + work * Math.PI * 2); ctx.stroke();
    }
    if (work >= 1) { ctx.fillStyle = C.signal; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); }
    text(ctx, `peer-${String(i + 1).padStart(2, '0')}`, x, y + 56, { f: 'Plex', px: 15, color: C.dim, align: 'center', alpha: p });
  });
  // lead
  const gathered = prog(b, 12, 15.5);
  ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(lead[0], lead[1], 70 + 6 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.signal; ctx.lineWidth = 4; ctx.stroke();
  if (gathered > 0) { ctx.fillStyle = `rgba(255,106,26,${0.7 * gathered})`; ctx.beginPath(); ctx.arc(lead[0], lead[1], 70 * gathered, 0, Math.PI * 2); ctx.fill(); }
  text(ctx, 'lead', lead[0], lead[1] + 10, { f: 'Plex', px: 28, wt: 600, color: C.bone, align: 'center' });
  text(ctx, `${Math.round(gathered * 24)}/24 results`, lead[0], lead[1] + 120, { f: 'Plex', px: 22, color: C.dim, align: 'center' });
}

// 7. FEATURES — one word per beat, full frame.
function sceneRapid(ctx, t, lt) {
  const b = lt / BEAT;
  const i = Math.min(RAPID.length - 1, Math.floor(b));
  const f = b - i;
  const w = RAPID[i];
  const final = i >= 12;
  const bgc = final ? (i === 15 ? C.signal : C.ink) : [C.ink, C.bone, C.ink, C.signal][i % 4];
  const fg = bgc === C.bone ? C.ink : bgc === C.signal ? C.ink : C.bone;
  ctx.fillStyle = bgc; ctx.fillRect(0, 0, W, H);
  const px = fitPx(ctx, w, 'ArchivoX', 900, W - 300, 380);
  const sc = 1.12 - 0.12 * outExpo(clamp(f * 3));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc);
  text(ctx, w, 0, px * 0.36, { f: 'ArchivoX', px, wt: 900, color: fg, align: 'center' });
  ctx.restore();
  if (!final) text(ctx, `${String(i + 1).padStart(2, '0')} / 12`, W / 2, H / 2 + px * 0.36 + 90, { f: 'Plex', px: 26, wt: 600, color: fg, align: 'center', track: 6, alpha: 0.6 });
  // strobe bar on the beat
  ctx.fillStyle = fg; ctx.globalAlpha = 0.9 * Math.exp(-f * 8);
  ctx.fillRect(0, H / 2 - 3, W * (1 - f), 6); ctx.globalAlpha = 1;
}

// 8. OUTRO — logo, name, repo.
function sceneOutro(ctx, t, lt) {
  bgGrid(ctx, t, 0.25);
  drawLogo(ctx, W / 2, H / 2 - 110, 34, t, (cell) => outCubic(prog(lt, 0.02 * cell.c + hash(cell.r * 50 + cell.c) * 0.4, 0.02 * cell.c + hash(cell.r * 50 + cell.c) * 0.4 + 1.1)), { glow: 1, scatter: 1 });
  text(ctx, 'AGENTIC OPERATING SYSTEM', W / 2, H / 2 + 150, { f: 'Archivo', px: 58, wt: 900, color: C.bone, align: 'center', track: 10, alpha: prog(lt, BAR, BAR + 0.5) });
  text(ctx, 'An embeddable AI agent harness kernel, written in Rust.', W / 2, H / 2 + 210, { f: 'Plex', px: 28, color: C.dim, align: 'center', alpha: prog(lt, BAR + 0.5, BAR + 1) });
  const repo = 'github.com/octos-org/octos';
  const rp = lt - BAR * 2;
  if (rp > 0) {
    const s = typed(repo, rp, 30);
    const w = measure(ctx, repo, 'Plex', 40, 600);
    text(ctx, s, W / 2 - w / 2, H / 2 + 320, { f: 'Plex', px: 40, wt: 600, color: C.signal });
    if (Math.floor(lt / 0.4) % 2 === 0) { ctx.fillStyle = C.signal; ctx.fillRect(W / 2 - w / 2 + measure(ctx, s, 'Plex', 40, 600) + 6, H / 2 + 288, 20, 40); }
  }
}
