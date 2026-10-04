// COSMOS — promo for the GOSIM survey26 hackathon 「巡天智能体 · Agentic Observer」.
// An observatory opens under the Milky Way; an agent picks survey tiles slot by slot; weather rolls in;
// a target-of-opportunity request, then the last REQUIRED tile closes out the coverage; the score builds; then the call to action.
// 96 BPM, 24 bars = 60 s. Timeline shared with the soundtrack via cues.json (audio/cues.py).
import * as THREE from 'three';
import {
  TAU, DEG, V, STAR, SODIUM, dirAE, camLook, project, makeSky, makeGround, makeObservatory, makeField, makeClouds, makeNova,
  makeLine, placeInView, hudText, typed, rgba, cloudAtJS, tileAE, tilePos, PIVOT, RS, FIELD, NBLOB,
  clamp, lerp, prog, ease, hash, keys,
} from './lib.js';
import { noise1 } from '../engine/util.js';

const CUES = await (await fetch(new URL('./cues.json', import.meta.url))).json();
const BPM = CUES.bpm, BEAT = CUES.beat, BAR = CUES.bar;
const T = (bar, beat = 0) => bar * BAR + beat * BEAT;
const DUR = 60;
const LB = 46;

// ---------------------------------------------------------------- palette (HUD)
const C_STAR = [232, 240, 255], C_DIM = [150, 172, 210], C_WARM = [255, 168, 80], C_ALERT = [255, 96, 56], C_COOL = [140, 190, 255];

// ---------------------------------------------------------------- beats
const KICKS = CUES.kicks.map(([t, g]) => [t, g]);
function envHit(t, list, decay = 0.25) { let r = 0; for (const [t0, g] of list) { if (t0 > t + 1e-6) break; r = g * Math.exp(-(t - t0) / decay); } return r; }
const kickEnv = (t, d = 0.22) => envHit(t, KICKS, d);

// ---------------------------------------------------------------- weather: a front of cloud blobs moving right -> left
const BLOBS0 = [ // az at t=24, el, sx, sy, speed deg/s
  [46, 32, 13, 6.5, -11.5], [58, 22, 16, 5.5, -11.0], [72, 36, 12, 5, -12.0], [82, 25, 15, 7, -11.8],
  [95, 30, 12, 6, -12.5], [104, 19, 10, 4.5, -12.2], [115, 34, 14, 6, -12.8],
];
const blobsAt = (t) => BLOBS0.map(([a, e, sx, sy, v]) => [a + v * (t - 24), e, sx, sy]);
const cloudOnAt = (t) => prog(t, 24.2, 25.6) * (1 - prog(t, 31.2, 33.0));

// ---------------------------------------------------------------- key times
const tLift1 = CUES.lift1, tToo = CUES.too, tReq = CUES.nova /* audio cue keeps its old name */, tFast = CUES.fast, tFormal = CUES.formal, tLift2 = CUES.lift2;
const tGame = T(6);

// ---------------------------------------------------------------- camera path (whole film)
const FC = tilePos(0, 28);                    // field centre
const idxOf = (reg, c, r) => reg * FIELD.cols * FIELD.rows + r * FIELD.cols + c;
const TOO_T = [idxOf(6, 1, 2), idxOf(6, 2, 3), idxOf(6, 0, 3)];
const REQ_T = idxOf(2, 1, 3); // the last REQUIRED tile, closed on the big hit
const aeOf = (i) => { const reg = Math.floor(i / (FIELD.cols * FIELD.rows)), k = i % (FIELD.cols * FIELD.rows); return tileAE(reg, k % FIELD.cols, Math.floor(k / FIELD.cols)); };
const TOO_C = tilePos(aeOf(TOO_T[0])[0] + 1, aeOf(TOO_T[0])[1] + 1.5);
const REQ_P = tilePos(...aeOf(REQ_T));
const P2 = [10, 3.2, 21], T2 = [-4, 44, -40];
const TITLE_POS = (() => { const p = V(...P2), d = V(...T2).sub(p).normalize(); return p.addScaledVector(d, 60); })();

function camAt(t) {
  // returns [pos, target, fov, roll]
  if (t < tLift2) {
    const pos = keys(t, [
      [0, [17, 1.7, 33]], [8.6, [12.5, 2.3, 25]], [12.4, P2, ease.inOutCubic], [14.2, [9.2, 3.4, 20]],
      [16.4, [0, 5.4, 27], ease.inOutCubic], [24.8, [-2.5, 6.2, 26.5]], [29.8, [3.5, 6.0, 25.5]],
      [31.0, [4.5, 6.0, 25], ease.inOutCubic], [32.6, [4.2, 6.0, 24.5]], [34.4, [0.5, 6.2, 22], ease.inOutCubic], [36.9, [0.2, 6.2, 21.5]],
      [38.6, [0, 7.5, 44], ease.inOutCubic], [42.4, [0, 7.8, 42]], [45.0, [0, 3.0, 14], ease.inOutCubic], [tLift2, [2, 3.0, 12]],
    ]);
    const tgt = keys(t, [
      [0, [-6.5, 7.6, 0]], [8.6, [-5.5, 9.4, 0]], [12.4, T2, ease.inOutCubic], [14.2, [-4, 44.5, -40]],
      [16.4, FC.toArray(), ease.inOutCubic], [24.8, FC.clone().add(V(-4, 0, 0)).toArray()], [29.8, FC.clone().add(V(4, 0, 0)).toArray()],
      [31.0, TOO_C.toArray(), ease.inOutCubic], [32.6, TOO_C.toArray()], [34.4, REQ_P.toArray(), ease.inOutCubic], [36.9, REQ_P.toArray()],
      [38.6, FC.clone().add(V(0, -26, 0)).toArray(), ease.inOutCubic], [42.4, FC.clone().add(V(0, -25, 0)).toArray()],
      [45.0, [18, 95, -38], ease.inOutCubic], [tLift2, [26, 95, -30]],
    ]);
    const fov = keys(t, [[0, 36], [8.6, 38], [12.4, 42], [14.2, 42], [16.4, 54], [29.8, 54], [31.0, 44], [32.6, 44], [34.4, 36], [35.2, 32, ease.outCubic], [36.9, 31],
      [38.6, 62, ease.inOutCubic], [42.4, 62], [45.0, 70], [tLift2, 72]]);
    const roll = keys(t, [[0, 0], [12.4, -0.02], [16.4, 0], [29.8, 0.02], [34.4, -0.02], [38.6, 0], [45, 0.05], [tLift2, 0.09]]);
    return [pos, tgt, fov, roll];
  }
  const lt = t - tLift2;
  const pos = keys(lt, [[0, [-31, 1.5, 44]], [10, [-26, 2.8, 36]]]);
  const tgt = keys(lt, [[0, [-13, 14, -14]], [10, [-12, 17, -13]]]);
  return [pos, tgt, keys(lt, [[0, 44], [10, 40]]), 0.015];
}

// ---------------------------------------------------------------- the agent's night: simulate picks at build time
const PROGS = ['DARK', 'BRIGHT', 'BACKUP'];
function simulate(field) {
  const tiles = field.tiles;
  TOO_T.forEach((i) => { tiles[i].tooT = tToo; });
  tiles[REQ_T].req = 1;
  const reserved = new Set([...TOO_T, REQ_T]);
  const count = Array(FIELD.regions).fill(0);
  const log = [];
  let slot = 1, tooK = 0;
  const events = [...CUES.picks.map((p) => ({ ...p, type: 'pick' })), ...CUES.waits.map((t) => ({ t, type: 'wait' }))].sort((a, b) => a.t - b.t);
  const observe = (i, p, prog_, val, extra = {}) => {
    const tl = tiles[i]; tl.obsT = p.t; count[tl.reg]++;
    return { tile: i, reg: tl.reg, prog: prog_, val, ...extra };
  };
  for (const ev of events) {
    if (ev.type === 'wait') { log.push({ t: ev.t, slot: slot++, kind: 'wait' }); continue; }
    const p = ev; const done = [];
    if (p.kind === 'too') done.push(observe(TOO_T[tooK++], p, 'DARK', 140, { too: 1 }));
    else if (Math.abs(p.beat - 54) < 1e-6) done.push(observe(REQ_T, p, 'DARK', 18.6));
    else {
      const blobs = blobsAt(p.t), on = cloudOnAt(p.t);
      for (let j = 0; j < p.n; j++) {
        const regs = [...Array(FIELD.regions).keys()].sort((a, b) => (count[a] - count[b]) || (hash(p.t * 7.3 + a * 1.9 + j) - hash(p.t * 7.3 + b * 1.9 + j)));
        let pick = -1;
        for (const r of regs) {
          const cand = tiles.filter((tl) => tl.reg === r && tl.obsT > 1e5 && !reserved.has(tl.i) && cloudAtJS(blobs, tl.az, tl.el, on) < 0.12);
          if (cand.length) { cand.sort((a, b) => hash(a.seed * 91 + p.t) - hash(b.seed * 91 + p.t)); pick = cand[0].i; break; }
        }
        if (pick < 0) continue;
        const cloudy = on > 0.2;
        const h = hash(pick * 3.1 + p.t);
        const pr = cloudy ? (h < 0.5 ? 'BRIGHT' : 'BACKUP') : (h < 0.6 ? 'DARK' : h < 0.88 ? 'BRIGHT' : 'BACKUP');
        const val = (cloudy ? 5 : 9) + 9 * hash(pick * 1.7 + 3) + (tiles[pick].req ? 3 : 0);
        done.push(observe(pick, p, pr, val));
      }
    }
    done.forEach((d) => log.push({ t: p.t, slot: slot, kind: p.kind, ...d }));
    slot += 1;
  }
  field.commit();
  // running score
  let s = 0; const score = log.filter((l) => l.val).map((l) => { s += l.val; return [l.t, s]; });
  return { log, score, count };
}

// ---------------------------------------------------------------- the one world
let WORLD = null;
async function makeWorld(ctx) {
  if (WORLD) return WORLD;
  const scene = new THREE.Scene();
  const sky = makeSky(scene);
  const ground = makeGround(scene);
  const obs = makeObservatory(scene);
  const field = makeField(scene);
  const clouds = makeClouds(scene, field.U);
  const nova = makeNova(scene);
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 9000);
  const sim = simulate(field);
  const picks = sim.log.filter((l) => l.tile !== undefined);
  // title (3D): CJK + Latin
  const cn = makeLine(ctx, 'PFB', '巡天智能体', { size: 6.2, depth: 0.2, tracking: 0.12, color: STAR, intensity: 1.05 });
  const en = makeLine(ctx, 'AX5', 'AGENTIC OBSERVER', { size: 1.25, depth: 0.05, tracking: 0.62, color: SODIUM, intensity: 1.6 });
  const title = new THREE.Group(); cn.group.position.y = 1.6; en.group.position.y = -3.6; title.add(cn.group, en.group); title.name='title'; scene.add(title);

  // aim of the telescope over time
  const upAim = V(0, 1, 0);
  const titleAim = TITLE_POS.clone().sub(PIVOT).normalize();
  const tileDir = (i) => field.tiles[i].pos.clone().sub(PIVOT).normalize();
  function lastPick(t) { let r = null; for (const p of picks) { if (p.t <= t + 1e-6) r = p; else break; } return r; }
  function prevPick(p) { const k = picks.indexOf(p); for (let j = k - 1; j >= 0; j--) if (picks[j].t < p.t - 1e-6) return picks[j]; return null; }
  function aimAt(t) {
    if (t < tGame) {
      const a = keys(t, [[0, 0], [9.3, 0], [10.0, 1, ease.inOutCubic]]);
      const b = prog(t, 13.8, tGame - 0.05, ease.inOutCubic);
      const first = tileDir(picks[0].tile);
      return upAim.clone().lerp(titleAim, a).lerp(first, b).normalize();
    }
    if (t >= tFormal) {
      const last = tileDir(picks[picks.length - 1].tile);
      return last.lerp(V(0.25, 1, -0.35).normalize(), prog(t, tFormal, tFormal + 2, ease.inOutCubic)).normalize();
    }
    const p = lastPick(t); if (!p) return tileDir(picks[0].tile);
    const q = prevPick(p); const d1 = tileDir(p.tile);
    if (!q) return d1;
    const slew = p.kind === 'fast' ? 0.07 : 0.2;
    return tileDir(q.tile).lerp(d1, ease.inOutCubic(prog(t, p.t - slew, p.t))).normalize();
  }
  function scoreAt(t) {
    let s = 0; const tick = 0.35;
    for (const [t0, v] of sim.score) { if (t0 > t) break; s = v; }
    // ease the last increment
    const k = sim.score.findIndex(([t0]) => t0 > t);
    const prevV = k > 0 ? sim.score[k - 1][1] : sim.score.length && t >= sim.score[sim.score.length - 1][0] ? sim.score[sim.score.length - 1][1] : 0;
    const lastIdx = k < 0 ? sim.score.length - 1 : k - 1;
    if (lastIdx >= 0) {
      const [t0, v] = sim.score[lastIdx]; const before = lastIdx > 0 ? sim.score[lastIdx - 1][1] : 0;
      s = lerp(before, v, ease.outCubic(prog(t, t0, t0 + tick)));
    }
    // coverage bonus lands in the score section
    const covP = ease.outCubic(prog(t, T(16, 2), T(16, 3.5)));
    return s + covP * coverageBonus(t) + 0 * prevV;
  }
  const baseTotal = sim.score.length ? sim.score[sim.score.length - 1][1] : 0;
  function coverageBonus() {
    const c = sim.count, sx = c.reduce((a, b) => a + b, 0), sx2 = c.reduce((a, b) => a + b * b, 0);
    const E = sx * sx / (c.length * sx2);
    return 0.35 * (baseTotal - 420) * E;
  }
  function evenness(t) {
    const c = Array(FIELD.regions).fill(0);
    for (const p of picks) { if (p.t > t) break; c[p.reg]++; }
    return c;
  }

  WORLD = { scene, cam, sky, ground, obs, field, clouds, nova, sim, picks, cn, en, title, aimAt, lastPick, scoreAt, evenness, tileDir };
  return WORLD;
}

// ---------------------------------------------------------------- per-frame world update (shared by all sections)
function updateWorld(W, t) {
  const [pos, tgt, fov, roll] = camAt(t);
  const cam = W.cam;
  const sh = noise1(t * 0.7) * 0.03, sv = noise1(t * 0.6 + 9) * 0.03;
  camLook(cam, [pos[0] + sh, pos[1] + sv, pos[2]], tgt, roll);
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  const k = kickEnv(t);

  // sky
  const skyIn = prog(t, 0, 3.5, ease.outCubic);
  W.sky.update(t, { skyI: 0.35 + 0.65 * skyIn, mwI: (0.2 + 0.8 * prog(t, 0.5, 6)) * (t > tFormal ? 1.25 : 1), starI: 0.3 + 0.7 * skyIn, pix: 1 });

  // dome + telescope + laser
  const aim = W.aimAt(t);
  const slit = t < tLift2 ? ease.inOutCubic(prog(t, CUES.dome + 0.3, CUES.dome + 4.0)) : 1;
  const interior = t < tLift2 ? prog(t, CUES.dome, CUES.dome + 1.6) * (0.85 + 0.15 * Math.sin(t * 2.3)) : 1;
  let beamI = 0, beamLen = RS - 4;
  if (t >= tLift1 && t < tGame) {
    const f = t - tLift1;
    beamI = 0.55 + 2.2 * Math.exp(-f * 2.2);
    beamLen = lerp(8, TITLE_POS.distanceTo(PIVOT) - 4, ease.outExpo(clamp(f / 0.6)));
    if (t > 13.8) beamLen = lerp(TITLE_POS.distanceTo(PIVOT) - 4, RS - 4, prog(t, 13.8, tGame));
  } else if (t >= tGame && t < tFormal) {
    const p = W.lastPick(t);
    const since = p ? t - p.t : 9;
    const waiting = CUES.waits.some((w) => t >= w && t < w + BEAT * 0.9);
    beamI = (waiting ? 0.12 : 0.42) + (p?.kind === 'fast' ? 0.5 : 1.3) * Math.exp(-since * 5);
    if (t > tFast - 0.2 && t < tFormal) beamI = 0.5 + 0.5 * Math.exp(-since * 9);
  } else if (t >= tFormal && t < tLift2) {
    beamI = 0.4 * (1 - prog(t, tFormal, tFormal + 1.5));
  } else if (t >= tLift2) {
    beamI = 0.6 + 2.0 * Math.exp(-(t - tLift2) * 2.5);
    beamLen = 900;
  }
  const aimAz = Math.atan2(aim.x, -aim.z) / DEG;
  W.obs.update(t, { domeAz: t < tLift2 ? lerp(153, aimAz, ease.inOutCubic(prog(t, 9.1, 10.4))) : aimAz, slit, interior, aim, beamI, beamLen });
  W.ground.update({ warm: interior * 0.8 });

  // survey field
  const gridA = t < tGame ? prog(t, 13.4, 15.6) : t < tFormal ? 1 : 1 - prog(t, tFormal + 0.4, tFormal + 2.2);
  const blobs = blobsAt(t);
  W.field.update(t, { gridA: gridA * (t >= tLift2 ? 0 : 1) * (1 - 0.4 * fadeWin(t, 34.6, 37.8, 0.6, 0.9)), reveal: prog(t, 13.4, 15.8) * 1.2, lineA: gridA * 0.9, cloudOn: cloudOnAt(t), blobs });
  W.clouds.update(t, { lit: 1 });

  // last REQUIRED tile: a soft completion ping, not a flare
  const nt = t - tReq;
  const pingOn = t < tFormal ? 1 : 1 - prog(t, tFormal, tFormal + 1.5);
  W.nova.update(REQ_P, cam, 26, { I: nt >= 0 ? 0.3 * Math.exp(-nt * 2.5) * pingOn : 0, ring: nt > 0 ? 0.08 + nt * 0.35 : 0, ringA: nt > 0 ? 0.8 * Math.exp(-nt * 1.2) * pingOn : 0 });

  // title (3D)
  let tP = 0, tOut = 0, eP = 0;
  if (t < tGame) {
    W.title.position.copy(TITLE_POS); W.title.lookAt(V(...P2)); W.title.scale.setScalar(1);
    tP = prog(t, tLift1 + 0.05, tLift1 + 1.3); eP = prog(t, tLift1 + 0.9, tLift1 + 2.1); tOut = prog(t, 13.6, 14.6);
  } else if (t >= tLift2) {
    placeInView(W.title, cam, 0, 7.8, 60); W.title.scale.setScalar(0.92);
    tP = prog(t, tLift2 + 0.05, tLift2 + 1.2); eP = prog(t, tLift2 + 0.6, tLift2 + 1.7); tOut = 0;
  }
  W.title.visible = tP > 0 && tOut < 1;
  W.cn.set(tP, { stagger: 0.45, rise: 0.12, out: tOut, intensity: 0.6 + 0.12 * k, spread: 0.25 });
  W.en.set(eP, { stagger: 0.6, rise: 0.2, out: tOut, intensity: 1.05 + 0.25 * k, spread: 0.6 });
  return { k, cam };
}

// ---------------------------------------------------------------- HUD pieces
function caption(h, cn, en, x, y, a, { align = 'left', cnPx = 44, enPx = 17, cnCol = C_STAR, enCol = C_DIM, gap = 40, rise = 0, scrim = 0 } = {}) {
  if (a <= 0.003) return;
  if (scrim) {
    h.font = `600 ${cnPx}px PFB`; const w = h.measureText(cn).width + 160;
    const cx = align === 'center' ? x : align === 'right' ? x - w / 2 + 80 : x + w / 2 - 80, cy = y + gap / 2 - cnPx * 0.3;
    h.save(); h.translate(cx, cy); h.scale(w / 2, (gap + cnPx) * 1.1);
    const g = h.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(0,2,8,${0.55 * scrim * a})`); g.addColorStop(1, 'rgba(0,2,8,0)');
    h.fillStyle = g; h.beginPath(); h.arc(0, 0, 1, 0, TAU); h.fill(); h.restore();
  }
  const dy = (1 - ease.outCubic(clamp(a))) * 14 + rise;
  h.save(); h.shadowColor = 'rgba(0,0,0,0.6)'; h.shadowBlur = 18;
  if (cn) hudText(h, cn, x, y + dy, { font: `600 ${cnPx}px PFB`, color: rgba(cnCol, a), align, spacing: 2 });
  if (en) hudText(h, en, x, y + gap + dy, { font: `500 ${enPx}px AX5`, color: rgba(enCol, a * 0.95), align, spacing: 4 });
  h.restore();
}
const fadeWin = (t, a, b, fi = 0.5, fo = 0.4) => prog(t, a, a + fi) * (1 - prog(t, b - fo, b));

function tileCorners(W, i) {
  const tl = W.field.tiles[i], s = tl.size * 0.62;
  const r = V(1, 0, 0).applyQuaternion(tl.quat), u = V(0, 1, 0).applyQuaternion(tl.quat);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => project(W.cam, tl.pos.clone().addScaledVector(r, a * s).addScaledVector(u, b * s)));
}
function brackets(h, pts, col, a, len = 14, w = 2) {
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4, cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  h.strokeStyle = rgba(col, a); h.lineWidth = w;
  for (const p of pts) {
    const dx = Math.sign(cx - p.x), dy = Math.sign(cy - p.y);
    h.beginPath(); h.moveTo(p.x + dx * len, p.y); h.lineTo(p.x, p.y); h.lineTo(p.x, p.y + dy * len); h.stroke();
  }
  return [cx, cy];
}
const pad4 = (n) => String(n).padStart(4, '0');
const fmt1 = (v) => v.toFixed(1);
const tileName = (i) => `T${String(i).padStart(3, '0')}`;
const regName = (r) => `R${String(r).padStart(2, '0')}`;

function gameHud(h, W, t) {
  const cam = W.cam;
  const A = fadeWin(t, 15.2, tFormal + 0.8, 0.6, 1.2);
  if (A <= 0) return;
  // region labels
  for (let reg = 0; reg < FIELD.regions; reg++) {
    const [az] = tileAE(reg, 1, 0);
    const s = project(cam, tilePos(az, FIELD.el0 + FIELD.rows * FIELD.cell + 0.6));
    if (s.behind || s.x < 30 || s.x > 1890 || s.y < 70 || s.y > 1010) continue;
    hudText(h, regName(reg), s.x, s.y, { font: '400 14px Plex', color: rgba(C_COOL, 0.55 * A * (1 - prog(t, 33.6, 34.4) + prog(t, 37.2, 38.2))), align: 'center', spacing: 2 });
  }
  // current pick reticle
  const p = W.lastPick(t);
  if (p && t < tFormal) {
    const since = t - p.t;
    const fast = p.kind === 'fast';
    const a = A * (fast ? Math.exp(-since * 6) : 1) * (t < tFast || fast ? 1 : 0);
    if (a > 0.01) {
      const pts = tileCorners(W, p.tile);
      if (!pts.some((q) => q.behind)) {
        const grow = 1 + 0.6 * Math.exp(-since * 10);
        const cx0 = pts.reduce((s, q) => s + q.x, 0) / 4, cy0 = pts.reduce((s, q) => s + q.y, 0) / 4;
        const ps = pts.map((q) => ({ x: cx0 + (q.x - cx0) * grow, y: cy0 + (q.y - cy0) * grow }));
        const col = p.too ? C_ALERT : C_WARM;
        const [cx, cy] = brackets(h, ps, col, a, 12, 2);
        if (!fast) {
          const lx = Math.max(...ps.map((q) => q.x)) + 16, ly = Math.min(...ps.map((q) => q.y)) + 4;
          const lab = `${regName(p.reg)} · ${tileName(p.tile)}`;
          hudText(h, lab, lx, ly + 10, { font: '600 15px PlexB', color: rgba(C_STAR, a * 0.95), spacing: 1 });
          hudText(h, p.too ? 'ToO' : p.prog, lx, ly + 30, { font: '400 14px Plex', color: rgba(col, a), spacing: 2 });
          h.strokeStyle = rgba(col, a * 0.5); h.lineWidth = 1; h.beginPath(); h.moveTo(cx, cy); h.lineTo(lx - 6, ly + 4); h.stroke();
        }
      }
    }
  }
  // decision log (bottom-left)
  const LA = A * (1 - prog(t, tFast + 0.2, tFast + 0.8)) * prog(t, 15.4, 16.2) * (1 - fadeWin(t, 34.0, 38.0, 0.5, 0.6));
  if (LA > 0.01) {
    const rows = W.sim.log.filter((l) => l.t <= t + 1e-6).slice(-6);
    const x0 = 72, yb = 1080 - LB - 60;
    hudText(h, '决策日志 · DECISION LOG', x0, yb - 6 * 26 - 16, { font: '600 13px PFB', color: rgba(C_DIM, LA * 0.8), spacing: 2 });
    rows.forEach((l, j) => {
      const age = rows.length - 1 - j;
      const fresh = Math.exp(-(t - l.t) * 4);
      const a = LA * (1 - age * 0.13);
      const y = yb - age * 26;
      let s;
      if (l.kind === 'wait') s = `SLOT ${pad4(l.slot)}  wait     ·  cloud cover`;
      else s = `SLOT ${pad4(l.slot)}  observe  ${regName(l.reg)}·${tileName(l.tile)}  ${(l.too ? 'ToO' : l.prog).padEnd(6)}  +${fmt1(l.val)}`;
      const col = l.kind === 'wait' ? C_DIM : l.too ? C_ALERT : fresh > 0.05 ? [lerp(C_STAR[0], C_WARM[0], fresh), lerp(C_STAR[1], C_WARM[1], fresh), lerp(C_STAR[2], C_WARM[2], fresh)] : C_STAR;
      hudText(h, s, x0, y, { font: '400 16px Plex', color: rgba(col, a) });
    });
  }
  // slot + score (top-right)
  const lastLog = W.sim.log.filter((l) => l.t <= t + 1e-6).slice(-1)[0];
  const slot = lastLog ? lastLog.slot : 0;
  const x1 = 1920 - 72;
  hudText(h, `SLOT ${pad4(slot)} · 900 s`, x1, LB + 44, { font: '400 15px Plex', color: rgba(C_DIM, A * 0.9), align: 'right', spacing: 2 });
  hudText(h, '得分 SCORE', x1, LB + 76, { font: '600 13px PFB', color: rgba(C_WARM, A * 0.9), align: 'right', spacing: 3 });
  const sc = W.scoreAt(t);
  const bump = Math.exp(-(t - (lastLog?.t ?? -9)) * 6);
  hudText(h, sc.toFixed(1), x1, LB + 128, { font: `500 ${Math.round(48 + 4 * bump)}px AX5`, color: rgba([lerp(232, 255, bump), lerp(240, 190, bump), lerp(255, 120, bump)], A), align: 'right', spacing: 2 });
}

function legendHud(h, t) {
  const a = fadeWin(t, 17.4, 24.6, 0.6, 0.5);
  if (a <= 0) return;
  const x = 1920 - 72, y = 1080 - LB - 140;
  h.save(); h.globalAlpha = a;
  // tile types
  const drawSq = (cx, cy, r) => { h.strokeStyle = rgba(C_COOL, 0.95); h.lineWidth = 2; h.strokeRect(cx - r, cy - r, 2 * r, 2 * r); };
  const drawDi = (cx, cy, r) => { h.strokeStyle = rgba(C_COOL, 0.95); h.lineWidth = 2; h.beginPath(); h.moveTo(cx, cy - r); h.lineTo(cx + r, cy); h.lineTo(cx, cy + r); h.lineTo(cx - r, cy); h.closePath(); h.stroke(); };
  hudText(h, '天区 TILES', x, y, { font: '600 13px PFB', color: rgba(C_DIM, 0.85), align: 'right', spacing: 3 });
  let w = hudText(h, '必做 REQUIRED', x, y + 34, { font: '600 19px PFB', color: rgba(C_STAR, 1), align: 'right', spacing: 1 });
  drawDi(x - w - 20, y + 27, 9);
  w = hudText(h, '可选 FLEXIBLE', x, y + 66, { font: '600 19px PFB', color: rgba(C_STAR, 1), align: 'right', spacing: 1 });
  drawSq(x - w - 20, y + 59, 7.5);
  hudText(h, '观测项目 PROGRAMS', x, y + 104, { font: '600 13px PFB', color: rgba(C_DIM, 0.85), align: 'right', spacing: 3 });
  hudText(h, 'DARK · BRIGHT · BACKUP', x, y + 132, { font: '600 18px PlexB', color: rgba(C_WARM, 1), align: 'right', spacing: 2 });
  h.restore();
}

function formulaHud(h, W, t) {
  const A = fadeWin(t, T(15), tFormal + 0.3, 0.3, 0.6);
  if (A <= 0) return;
  const terms = [
    ['得分', 'SCORE', ''], ['基础科学分', 'SCIENCE', '='], ['项目加成', 'PROGRAM BONUS', '+'], ['请求奖励', 'REQUEST REWARD', '+'],
    ['覆盖均匀性', 'COVERAGE UNIFORMITY', '+'], ['罚分', 'PENALTIES', '−'],
  ];
  const y = 700;
  h.save();
  { const g = h.createLinearGradient(0, y - 150, 0, y + 70); g.addColorStop(0, 'rgba(0,2,8,0)'); g.addColorStop(0.5, `rgba(0,2,8,${0.45 * A})`); g.addColorStop(1, 'rgba(0,2,8,0)'); h.fillStyle = g; h.fillRect(0, y - 150, 1920, 220); }
  // measure
  const widths = terms.map(([cn, en]) => { h.font = '500 17px AX5'; try { h.letterSpacing = '2px'; } catch (e) { /* */ } const a = h.measureText(en).width; h.font = '600 34px PFB'; try { h.letterSpacing = '1px'; } catch (e) { /* */ } const b = h.measureText(cn).width; return Math.max(a, b); });
  try { h.letterSpacing = '0px'; } catch (e) { /* */ }
  const opW = 48, total = widths.reduce((a, b) => a + b, 0) + opW * (terms.length - 1);
  let x = 960 - total / 2;
  terms.forEach(([cn, en, op], i) => {
    const ti = T(15, 0.5 + i * 0.75);
    const a = A * prog(t, ti, ti + 0.3);
    if (op) { hudText(h, op, x + opW / 2 - opW, y + 4, { font: '300 40px AX3', color: rgba(op === '−' ? C_ALERT : C_WARM, a), align: 'center' }); }
    const cx = x + widths[i] / 2;
    const hot = i === 0 ? 1 : Math.exp(-Math.max(0, t - ti) * 2.5);
    const col = i === 5 ? C_ALERT : i === 0 ? C_WARM : C_STAR;
    hudText(h, cn, cx, y + (1 - ease.outCubic(prog(t, ti, ti + 0.35))) * 12, { font: '600 34px PFB', color: rgba(col, a), align: 'center', spacing: 1 });
    hudText(h, en, cx, y + 34, { font: '500 15px AX5', color: rgba(i === 0 ? C_WARM : C_DIM, a * (0.8 + 0.2 * hot)), align: 'center', spacing: 2 });
    x += widths[i] + opW;
  });
  // coverage evenness (per-region bars)
  const ba = A * prog(t, T(16, 1.5), T(16, 2.5));
  if (ba > 0.01) {
    const c = W.evenness(t), mx = Math.max(...c, 1);
    const bx = 960 - 8 * 26 / 2, by = y - 70;
    hudText(h, '八个天区的覆盖 · COVERAGE ACROSS R00–R07', 960, by - 54, { font: '600 13px PFB', color: rgba(C_DIM, ba * 0.9), align: 'center', spacing: 2 });
    c.forEach((v, i) => { const hh = 44 * v / Math.max(mx, 14); h.fillStyle = rgba(C_COOL, ba * 0.85); h.fillRect(bx + i * 26 + 4, by - hh, 16, hh); });
  }
  h.restore();
}

function competitionHud(h, t) {
  const A = fadeWin(t, tFormal + 0.2, tLift2 - 0.05, 0.4, 0.35);
  if (A <= 0) return;
  caption(h, '正式赛 · 10 月 5–7 日（北京时间）', 'FORMAL ROUND · OCT 5–7, 2026 · BEIJING TIME', 960, 210, A * prog(t, tFormal + 0.2, tFormal + 0.8), { align: 'center', cnPx: 50, enPx: 18, gap: 44 });
  // three scenario cards + the hidden one
  const cw = 270, chh = 176, gap = 36, y0 = 350;
  const x0 = 960 - (4 * cw + 3 * gap + 60) / 2;
  const labels = ['A', 'B', 'C'];
  for (let i = 0; i < 4; i++) {
    const hidden = i === 3;
    const ti = hidden ? T(18, 2) : T(17, 2 + i * 0.5);
    const a = A * prog(t, ti, ti + 0.35);
    if (a <= 0.01) continue;
    const x = x0 + i * (cw + gap) + (hidden ? 60 : 0), y = y0 + (1 - ease.outCubic(prog(t, ti, ti + 0.4))) * 20;
    const col = hidden ? C_WARM : C_COOL;
    h.strokeStyle = rgba(col, a * 0.9); h.lineWidth = hidden ? 2 : 1.5; h.strokeRect(x, y, cw, chh);
    h.fillStyle = rgba(hidden ? [60, 30, 10] : [10, 20, 40], a * 0.55); h.fillRect(x, y, cw, chh);
    // mini tile grid filling step by step
    const cols = 12, rows = 4, s = 14, gx = x + (cw - cols * (s + 4)) / 2, gy = y + 24;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      if (hidden) {
        const tw = 0.25 + 0.35 * hash(k * 3.1 + Math.floor(t * 8));
        h.fillStyle = rgba(C_WARM, a * tw * 0.5); h.fillRect(gx + c * (s + 4), gy + r * (s + 4), s, s);
      } else {
        const on = prog(t, ti + 0.3 + (c + hash(k + i * 50) * 3) * 0.12, ti + 0.4 + (c + hash(k + i * 50) * 3) * 0.12);
        h.strokeStyle = rgba(C_COOL, a * 0.35); h.lineWidth = 1; h.strokeRect(gx + c * (s + 4) + 0.5, gy + r * (s + 4) + 0.5, s - 1, s - 1);
        if (on > 0) { h.fillStyle = rgba(C_STAR, a * on * 0.55); h.fillRect(gx + c * (s + 4) + 2, gy + r * (s + 4) + 2, s - 4, s - 4); }
      }
    }
    if (hidden) {
      hudText(h, '隐藏场景', x + cw / 2, y + chh - 36, { font: '600 26px PFB', color: rgba(C_STAR, a), align: 'center', spacing: 3 });
      hudText(h, 'HIDDEN SCENARIO', x + cw / 2, y + chh - 12, { font: '500 14px AX5', color: rgba(C_WARM, a), align: 'center', spacing: 3 });
    } else {
      hudText(h, `正式场景 ${labels[i]}`, x + cw / 2, y + chh - 36, { font: '600 24px PFB', color: rgba(C_STAR, a), align: 'center', spacing: 3 });
      hudText(h, `FORMAL SCENARIO ${labels[i]}`, x + cw / 2, y + chh - 12, { font: '500 13px AX5', color: rgba(C_DIM, a), align: 'center', spacing: 3 });
    }
  }
  // arrow to hidden
  const aa = A * prog(t, T(18, 1.5), T(18, 2));
  if (aa > 0) {
    const ax = x0 + 3 * (cw + gap) - gap + 8, ay = y0 + chh / 2;
    h.strokeStyle = rgba(C_WARM, aa); h.lineWidth = 2; h.beginPath(); h.moveTo(ax, ay); h.lineTo(ax + 70, ay); h.lineTo(ax + 60, ay - 7); h.moveTo(ax + 70, ay); h.lineTo(ax + 60, ay + 7); h.stroke();
  }
  caption(h, '三套固定正式场景，观测逐步下发', 'THREE FIXED FORMAL SCENARIOS · OBSERVATIONS REVEALED STEP BY STEP', 960, y0 + chh + 70, A * prog(t, T(17, 3), T(17, 3.5)), { align: 'center', cnPx: 28, enPx: 14, gap: 30 });
  caption(h, '截止后，最终版本只在隐藏场景上跑一次 —— 只有这一次决定排名', 'AFTER THE FREEZE, YOUR FINAL VERSION RUNS ONCE ON A HIDDEN SCENARIO · ONLY THAT RUN DECIDES THE RANKING', 960, y0 + chh + 154, A * prog(t, T(18, 2.5), T(18, 3.1)), { align: 'center', cnPx: 30, enPx: 14, gap: 32, cnCol: C_WARM, enCol: C_STAR });
  // teams / model / sponsor
  const la = A * prog(t, T(19, 0), T(19, 0.6));
  caption(h, '每队最多 3 人 · 自带 OpenAI 兼容模型 · KIMI Token 赞助', 'TEAMS OF UP TO 3 · BRING YOUR OWN OPENAI-COMPATIBLE MODEL · TOKEN SPONSOR KIMI', 960, 880, la, { align: 'center', cnPx: 28, enPx: 14, gap: 32 });
}

function ctaHud(h, t) {
  const lt = t - tLift2;
  if (lt < 0) return;
  const out = 1 - prog(t, 58.2, 59.4);
  const a1 = prog(lt, 1.3, 1.9) * out;
  if (a1 > 0) {
    h.save(); h.shadowColor = 'rgba(0,0,0,0.7)'; h.shadowBlur = 24;
    const y = 640 + (1 - ease.outCubic(prog(lt, 1.3, 1.9))) * 16;
    hudText(h, '$5,500', 960, y, { font: '900 96px AX9', color: rgba(C_WARM, a1), align: 'center', spacing: 4 });
    hudText(h, '总奖金 · PRIZE POOL', 960, y + 42, { font: '600 20px PFB', color: rgba(C_STAR, a1 * 0.9), align: 'center', spacing: 6 });
    h.restore();
  }
  const rows = [
    ['10 月 5–7 日正式赛 · 10 月 17 日 GOSIM 深圳颁奖', 'FORMAL ROUND OCT 5–7 · AWARDS OCT 17 AT GOSIM SHENZHEN', 2.2],
    ['10 月 2–3 日线上培训 · 练习赛（Playground）现已开放', 'TRAINING OCT 2–3 · PLAYGROUND PRACTICE OPEN NOW', 3.0],
  ];
  rows.forEach(([cn, en, d], i) => caption(h, cn, en, 960, 772 + i * 84, prog(lt, d, d + 0.5) * out, { align: 'center', cnPx: 30, enPx: 14, gap: 30, scrim: 0.8 }));
  const ua = prog(lt, 4.0, 4.6) * out;
  if (ua > 0) {
    const y = 1080 - LB - 36;
    h.save(); h.shadowColor = 'rgba(255,140,40,0.55)'; h.shadowBlur = 18 * ua;
    hudText(h, 'create.gosim.org/survey26/platform/', 960, y, { font: '600 34px PlexB', color: rgba(C_WARM, ua), align: 'center', spacing: 1 });
    h.restore();
  }
}

// ---------------------------------------------------------------- scenes (one world, several sections)
function section(name, from, to, label) {
  return {
    name, from, to, label,
    async make(ctx) {
      const W = await makeWorld(ctx);
      return {
        scene: W.scene, camera: W.cam,
        update(f) {
          const t = f.t;
          const { k } = updateWorld(W, t);
          return postAt(t, k);
        },
        hud(h, f) { sectionHud(h, W, f.t); },
      };
    },
  };
}

function postAt(t, k) {
  const o = { bloom: 0.8, bloomRadius: 0.6, bloomThreshold: 0.72, exposure: 1.15, ca: 0.0012, grain: 0.045, vignette: 0.6 };
  // lift 1: laser + title
  const l1 = t - tLift1;
  if (l1 >= 0 && l1 < 1.2) { o.flash = 0.35 * Math.exp(-l1 * 6); o.flashColor = [1, 0.75, 0.45]; o.zoomBlur = 0.12 * Math.exp(-l1 * 5); o.ca += 0.006 * Math.exp(-l1 * 5); }
  // ToO alert
  const la = t - tToo;
  if (la >= 0 && la < 1) { o.flash = 0.18 * Math.exp(-la * 8); o.flashColor = [1, 0.35, 0.2]; o.zoomBlur = 0.05 * Math.exp(-la * 6); }
  // last REQUIRED tile closed
  const nv = t - tReq;
  if (nv >= 0 && nv < 2) { o.flash = 0.16 * Math.exp(-nv * 5); o.flashColor = [1, 0.8, 0.55]; o.zoomBlur = 0.06 * Math.exp(-nv * 4); o.bloom = 0.9 + 0.3 * Math.exp(-nv * 2); }
  // time-lapse pulse
  if (t >= tFast && t < tFormal) { o.zoomBlur = Math.max(o.zoomBlur ?? 0, 0.02 * k); o.bloom = 0.95 + 0.2 * k; }
  // lift 2
  const l2 = t - tLift2;
  if (l2 >= 0 && l2 < 1.5) { o.flash = 0.6 * Math.exp(-l2 * 4); o.flashColor = [1, 0.8, 0.55]; o.zoomBlur = 0.22 * Math.exp(-l2 * 4); o.ca += 0.008 * Math.exp(-l2 * 4); }
  return o;
}

function sectionHud(h, W, t) {
  // S1 intro lines
  caption(h, '每 900 秒，主值观测员都要做一个决定：', 'EVERY 900 SECONDS, THE DUTY OBSERVER MAKES ONE DECISION:', 120, 740, fadeWin(t, 1.4, 6.6, 0.7, 0.5), { scrim: 1 });
  caption(h, '下一次，拍哪片天？', 'WHICH PATCH OF SKY TO OBSERVE NEXT?', 120, 838, fadeWin(t, 2.9, 6.6, 0.7, 0.5), { cnCol: C_WARM });
  caption(h, '这一次，交给你写的智能体。', 'THIS TIME, YOUR AGENT DECIDES.', 120, 790, fadeWin(t, 6.9, 9.8, 0.6, 0.5), { cnPx: 52, enPx: 18, gap: 46 });
  // S2 title sub
  const ta = fadeWin(t, tLift1 + 1.8, 14.6, 0.6, 0.6);
  caption(h, 'GOSIM 黑客松 · 智能巡天', 'GOSIM HACKATHON · SURVEY26', 960, 880, ta, { align: 'center', cnPx: 30, enPx: 15, gap: 32, cnCol: C_STAR, enCol: C_WARM, scrim: 1 });
  // S3 explain
  caption(h, '每个时隙：读取公开的天空状态，决定观测哪块天区', 'EVERY SLOT: READ THE PUBLIC SKY STATE, DECIDE WHICH TILE TO OBSERVE', 960, 172, fadeWin(t, 15.4, 24.7, 0.6, 0.5), { align: 'center', cnPx: 34, enPx: 15, gap: 34, scrim: 1 });
  // S4 weather
  caption(h, '看不见的真实天气 · 不确定的预报', 'HIDDEN WEATHER · UNCERTAIN FORECASTS', 960, 172, fadeWin(t, 25.1, 29.8, 0.5, 0.4), { align: 'center', cnPx: 38, enPx: 16, gap: 36, scrim: 1 });
  const ua = fadeWin(t, 26.4, 29.8, 0.4, 0.4);
  if (ua > 0) {
    const x = 1920 - 72, y = 1080 - LB - 64;
    hudText(h, '圆顶关闭时观测  −2000', x, y, { font: '600 22px PFB', color: rgba(C_ALERT, ua), align: 'right', spacing: 2 });
    hudText(h, 'UNSAFE OBSERVATION · CLOSED DOME', x, y + 24, { font: '500 13px AX5', color: rgba(C_DIM, ua), align: 'right', spacing: 3 });
  }
  // S5 ToO
  const ta2 = fadeWin(t, tToo, 32.8, 0.12, 0.4);
  if (ta2 > 0) {
    const blink = t < tToo + 1.25 ? (Math.floor((t - tToo) / (BEAT / 2)) % 2 === 0 ? 1 : 0.55) : 1;
    const x = 960, y = 172;
    h.save(); h.globalAlpha = ta2 * blink;
    h.strokeStyle = rgba(C_ALERT, 1); h.lineWidth = 2; h.strokeRect(x - 330, y - 44, 660, 96);
    h.fillStyle = rgba([60, 12, 6], 0.55); h.fillRect(x - 330, y - 44, 660, 96);
    h.fillStyle = rgba(C_ALERT, 1); h.beginPath(); h.moveTo(x - 300, y + 16); h.lineTo(x - 280, y - 20); h.lineTo(x - 260, y + 16); h.closePath(); h.fill();
    hudText(h, '!', x - 280, y + 12, { font: '900 22px AX9', color: 'rgba(40,6,0,1)', align: 'center' });
    hudText(h, '临时观测请求', x + 20, y + 4, { font: '600 36px PFB', color: rgba(C_STAR, 1), align: 'center', spacing: 4 });
    hudText(h, 'TARGET-OF-OPPORTUNITY REQUEST · ToO', x + 20, y + 36, { font: '500 15px AX5', color: rgba([255, 200, 175], 1), align: 'center', spacing: 3 });
    h.restore();
  }
  const rd = fadeWin(t, CUES.toodone, 33.6, 0.25, 0.4);
  caption(h, '请求完成  +140 × 3', 'REQUEST REWARD · 140 PER REQUIRED TILE', 960, 300, rd, { align: 'center', cnPx: 32, enPx: 14, gap: 30, cnCol: C_WARM, scrim: 1.4 });
  // last REQUIRED tile
  caption(h, '必做天区，一块都不能漏', 'REQUIRED TILES — EVERY ONE COUNTS', 960, 250, fadeWin(t, tReq + 0.15, 37.4, 0.35, 0.5), { align: 'center', cnPx: 54, enPx: 18, gap: 44, scrim: 1.3 });
  const ra = fadeWin(t, CUES.report, 37.4, 0.3, 0.5);
  caption(h, '漏掉一块  −1000 · 覆盖越均匀，得分越高', 'MISSED REQUIRED TILE −1000 · EVEN COVERAGE SCORES HIGHER', 960, 850, ra, { align: 'center', cnPx: 28, enPx: 14, gap: 28, cnCol: C_STAR, scrim: 1.3 });

  gameHud(h, W, t);
  legendHud(h, t);
  formulaHud(h, W, t);
  competitionHud(h, t);
  ctaHud(h, t);
}

const SCENES = [
  section('night', 0, tLift1, '01  夜 · NIGHT'),
  section('title', tLift1, tGame, ''),
  section('slots', tGame, T(10), '02  时隙 · SLOTS'),
  section('weather', T(10), tToo, '03  天气 · WEATHER'),
  section('interrupt', tToo, tFast, '04  请求与必做 · REQUESTS & REQUIRED'),
  section('score', tFast, tFormal, '05  得分 · SCORE'),
  section('competition', tFormal, tLift2, '06  赛制 · THE COMPETITION'),
  section('cta', tLift2, DUR, ''),
];

export default {
  bpm: BPM, dur: 60, audio: 'audio/track.wav',
  fonts: {
    AX9: '/v4-cosmos/fonts/Archivo-w1250-900.ttf',
    AX5: '/v4-cosmos/fonts/Archivo-w1250-500.ttf',
    AX3: '/v4-cosmos/fonts/Archivo-w1250-300.ttf',
    Plex: '/v4-cosmos/fonts/IBMPlexMono-Regular.ttf',
    PlexB: '/v4-cosmos/fonts/IBMPlexMono-SemiBold.ttf',
    PFB: '/v4-cosmos/fonts/PingFangSC-Semibold-sub.otf',
    PFR: '/v4-cosmos/fonts/PingFangSC-Regular-sub.otf',
  },
  scenes: SCENES,
  post(t) {
    return { fade: Math.max(1 - prog(t, 0, 1.6), prog(t, DUR - 1.6, DUR - 0.05)) };
  },
  hud(h, f, s) {
    const t = f.t;
    h.fillStyle = '#000'; h.fillRect(0, 0, 1920, LB); h.fillRect(0, 1080 - LB, 1920, LB);
    const A = prog(t, 1.0, 2.4) * (1 - prog(t, DUR - 2.0, DUR - 0.6));
    if (A <= 0) return;
    hudText(h, '巡天智能体', 72, LB + 40, { font: '600 17px PFB', color: rgba(C_STAR, 0.85 * A), spacing: 3 });
    hudText(h, 'AGENTIC OBSERVER · GOSIM SURVEY26', 186, LB + 40, { font: '500 12px AX5', color: rgba(C_DIM, 0.7 * A), spacing: 3 });
    const sc = SCENES.find((x) => x.name === s.name);
    if (sc?.label) {
      const la = prog(t, sc.from + 0.1, sc.from + 0.6) * (1 - prog(t, sc.to - 0.3, sc.to));
      hudText(h, sc.label, 72, 1080 - LB - 22, { font: '500 13px PFR', color: rgba(C_DIM, 0.75 * la * A), spacing: 3 });
    }
    // beat ticks
    const bt = Math.floor(t / BEAT + 1e-6) % 4;
    for (let i = 0; i < 4; i++) { h.fillStyle = i === bt ? rgba(C_WARM, 0.8 * A) : rgba(C_DIM, 0.25 * A); h.fillRect(1920 - 72 - 50 + i * 14, 1080 - LB - 30, 8, 8); }
  },
};
