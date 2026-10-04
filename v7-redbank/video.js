// REDBANK III — music promo for 第三红岸, an open-source self-attending telescope network (GOSIM Spotlight 2026).
// The v08 printed pyramid unit under the Milky Way; it assembles; its agent surveys tile by tile; weather rolls in;
// an EP alert arrives, the agent slews to the error circle and confirms the target; the network takes over; call to action.
// Built on the v4-cosmos world (sky, field, clouds, HUD); 96 BPM, 24 bars = 60 s.
// 96 BPM, 24 bars = 60 s. Timeline shared with the soundtrack via cues.json (audio/cues.py).
import * as THREE from 'three';
import {
  TAU, DEG, V, STAR, SODIUM, dirAE, camLook, project, makeSky, makeGround, makeObservatory, makeField, makeClouds, makeNova,
  makeLine, placeInView, hudText, typed, rgba, cloudAtJS, tileAE, tilePos, PIVOT, RS, FIELD, NBLOB,
  clamp, lerp, prog, ease, hash, keys,
} from './lib.js';
import { noise1 } from '../engine/util.js';
import { makeUnit } from './unit.js';

const CUES = await (await fetch(new URL('./cues.json', import.meta.url))).json();
const BPM = CUES.bpm, BEAT = CUES.beat, BAR = CUES.bar;
const T = (bar, beat = 0) => bar * BAR + beat * BEAT;
const DUR = 60;
const LB = 46;

// ---------------------------------------------------------------- palette (HUD)
const C_STAR = [232, 240, 255], C_DIM = [150, 172, 210], C_WARM = [255, 168, 80], C_ALERT = [255, 96, 56], C_COOL = [140, 190, 255], C_RED = [255, 92, 84];

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
const REQ_T = idxOf(6, 1, 3); // the confirmed counterpart, inside the alert error circle
const aeOf = (i) => { const reg = Math.floor(i / (FIELD.cols * FIELD.rows)), k = i % (FIELD.cols * FIELD.rows); return tileAE(reg, k % FIELD.cols, Math.floor(k / FIELD.cols)); };
const TOO_C = tilePos(aeOf(TOO_T[0])[0] + 1, aeOf(TOO_T[0])[1] + 1.5);
const REQ_P = tilePos(...aeOf(REQ_T));
const P2 = [10, 3.2, 21], T2 = [-4, 44, -40];
const TITLE_POS = (() => { const p = V(...P2), d = V(...T2).sub(p).normalize(); return p.addScaledVector(d, 60); })();

function camAt(t) {
  // returns [pos, target, fov, roll]
  if (t < tLift2) {
    const pos = keys(t, [
      [0, [17, 1.7, 33]], [8.6, [12.5, 2.3, 25]], [12.4, P2, ease.inOutCubic], [13.6, [9.2, 3.4, 20]],
      [14.8, [18.0, 7.0, 12.5], ease.inOutCubic], [16.4, [20.5, 6.8, 5.5]], [18.0, [18.0, 6.6, 11.5]], [19.7, [5.5, 4.0, 12.0], ease.inOutCubic], [20.6, [1.0, 3.6, 11.5]],
      [22.6, [0, 5.4, 27], ease.inOutCubic], [24.8, [-2.5, 6.2, 26.5]], [29.8, [3.5, 6.0, 25.5]],
      [31.0, [4.5, 6.0, 25], ease.inOutCubic], [32.6, [4.2, 6.0, 24.5]], [34.4, [0.5, 6.2, 22], ease.inOutCubic], [36.9, [0.2, 6.2, 21.5]],
      [38.6, [0, 7.5, 44], ease.inOutCubic], [42.4, [0, 7.8, 42]], [45.0, [0, 3.0, 14], ease.inOutCubic], [tLift2, [2, 3.0, 12]],
    ]);
    const tgt = keys(t, [
      [0, [-6.5, 7.6, 0]], [8.6, [-5.5, 9.4, 0]], [12.4, T2, ease.inOutCubic], [13.6, [-4, 44.5, -40]],
      [14.8, [0, 4.6, 0], ease.inOutCubic], [18.0, [0, 4.6, 0]], [19.7, [0, 2.9, 0], ease.inOutCubic], [20.6, [0, 3.0, 0]],
      [22.6, FC.toArray(), ease.inOutCubic], [24.8, FC.clone().add(V(-4, 0, 0)).toArray()], [29.8, FC.clone().add(V(4, 0, 0)).toArray()],
      [31.0, TOO_C.toArray(), ease.inOutCubic], [32.6, TOO_C.toArray()], [34.4, REQ_P.toArray(), ease.inOutCubic], [36.9, REQ_P.toArray()],
      [38.6, FC.clone().add(V(0, -26, 0)).toArray(), ease.inOutCubic], [42.4, FC.clone().add(V(0, -25, 0)).toArray()],
      [45.0, [18, 95, -38], ease.inOutCubic], [tLift2, [26, 95, -30]],
    ]);
    const fov = keys(t, [[0, 36], [8.6, 38], [12.4, 42], [13.6, 42], [14.8, 44], [18.0, 44], [19.7, 36], [20.6, 36], [22.6, 54], [29.8, 54], [31.0, 44], [32.6, 44], [34.4, 36], [35.2, 32, ease.outCubic], [36.9, 31],
      [38.6, 62, ease.inOutCubic], [42.4, 62], [45.0, 70], [tLift2, 72]]);
    const roll = keys(t, [[0, 0], [12.4, -0.02], [15.0, 0.01], [20.6, -0.01], [22.6, 0], [29.8, 0.02], [34.4, -0.02], [38.6, 0], [45, 0.05], [tLift2, 0.09]]);
    return [pos, tgt, fov, roll];
  }
  const lt = t - tLift2;
  const pos = keys(lt, [[0, [-16, 1.6, 22]], [10, [-12, 2.4, 17]]]);
  const tgt = keys(lt, [[0, [-4, 9, -6]], [10, [-3.5, 10, -5]]]);
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
  for (const n of ['dome', 'base', 'tel', 'fork', 'plinth']) { const o = scene.getObjectByName(n); if (o) o.visible = false; }
  const unit = await makeUnit(scene);
  const field = makeField(scene);
  const clouds = makeClouds(scene, field.U);
  const nova = makeNova(scene);
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 9000);
  const sim = simulate(field);
  const picks = sim.log.filter((l) => l.tile !== undefined);
  // title (3D): CJK + Latin
  const cn = makeLine(ctx, 'PFB', '第三红岸', { size: 6.6, depth: 0.2, tracking: 0.16, color: STAR, intensity: 1.05 });
  const en = makeLine(ctx, 'AX5', 'REDBANK III', { size: 1.5, depth: 0.05, tracking: 0.7, color: new THREE.Color(1.0, 0.32, 0.28), intensity: 1.6 });
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

  WORLD = { scene, cam, sky, ground, obs, unit, field, clouds, nova, sim, picks, cn, en, title, aimAt, lastPick, scoreAt, evenness, tileDir };
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
  if (t >= 14.0 && t < 20.4) beamI *= prog(t, 19.9, 20.4);
  W.obs.update(t, { domeAz: t < tLift2 ? lerp(153, aimAz, ease.inOutCubic(prog(t, 9.1, 10.4))) : aimAz, slit, interior, aim, beamI, beamLen });
  W.ground.update({ warm: interior * 0.25 });
  const explode = ease.inOutCubic(prog(t, 13.4, 14.8)) * (1 - ease.inOutCubic(prog(t, 18.0, 19.7)));
  W.unit.update(t, { aim, explode, headDrop: ease.inOutCubic(prog(t, 13.4, 14.8)) * (1 - ease.inOutCubic(prog(t, 18.0, 19.7))), glow: beamI * 0.4, screen: interior });

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
  const A = fadeWin(t, 20.4, tFormal + 0.8, 0.6, 1.2);
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
          hudText(h, p.too ? 'EP' : p.prog, lx, ly + 30, { font: '400 14px Plex', color: rgba(col, a), spacing: 2 });
          h.strokeStyle = rgba(col, a * 0.5); h.lineWidth = 1; h.beginPath(); h.moveTo(cx, cy); h.lineTo(lx - 6, ly + 4); h.stroke();
        }
      }
    }
  }
  // decision log (bottom-left)
  const LA = A * (1 - prog(t, tFast + 0.2, tFast + 0.8)) * prog(t, 22.2, 23.0) * (1 - fadeWin(t, 34.0, 38.0, 0.5, 0.6));
  if (LA > 0.01) {
    const rows = W.sim.log.filter((l) => l.t <= t + 1e-6).slice(-6);
    const x0 = 72, yb = 1080 - LB - 60;
    hudText(h, 'Agent 日志 · AGENT LOG', x0, yb - 6 * 26 - 16, { font: '600 13px PFB', color: rgba(C_DIM, LA * 0.8), spacing: 2 });
    rows.forEach((l, j) => {
      const age = rows.length - 1 - j;
      const fresh = Math.exp(-(t - l.t) * 4);
      const a = LA * (1 - age * 0.13);
      const y = yb - age * 26;
      let s;
      if (l.kind === 'wait') s = `SLOT ${pad4(l.slot)}  wait     ·  cloud cover`;
      else s = `SLOT ${pad4(l.slot)}  observe  ${regName(l.reg)}·${tileName(l.tile)}  ${(l.too ? 'EP' : l.prog).padEnd(6)}  60 s`;
      const col = l.kind === 'wait' ? C_DIM : l.too ? C_ALERT : fresh > 0.05 ? [lerp(C_STAR[0], C_WARM[0], fresh), lerp(C_STAR[1], C_WARM[1], fresh), lerp(C_STAR[2], C_WARM[2], fresh)] : C_STAR;
      hudText(h, s, x0, y, { font: '400 16px Plex', color: rgba(col, a) });
    });
  }
  // slot + score (top-right)
  const lastLog = W.sim.log.filter((l) => l.t <= t + 1e-6).slice(-1)[0];
  const slot = lastLog ? lastLog.slot : 0;
  const x1 = 1920 - 72;
  hudText(h, `仿真推演 · SIMULATED NIGHT · SLOT ${pad4(slot)}`, x1, LB + 44, { font: '400 15px Plex', color: rgba(C_DIM, A * 0.9), align: 'right', spacing: 2 });
  hudText(h, '已拍天区 TILES', x1, LB + 76, { font: '600 13px PFB', color: rgba(C_WARM, A * 0.9), align: 'right', spacing: 3 });
  const sc = W.scoreAt(t);
  const bump = Math.exp(-(t - (lastLog?.t ?? -9)) * 6);
  hudText(h, String(W.picks.filter((q) => q.t <= t + 1e-6).length + 0 * sc), x1, LB + 128, { font: `500 ${Math.round(48 + 4 * bump)}px AX5`, color: rgba([lerp(232, 255, bump), lerp(240, 190, bump), lerp(255, 120, bump)], A), align: 'right', spacing: 2 });
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

const STATIONS = [['BJ-001', '北京'], ['XJ-001', '新疆'], ['LENGHU-001', '冷湖'], ['CD-001', '成都'], ['SH-001', '上海'], ['GZ-001', '广州'], ['SZ-001', '深圳']];
const ST_COL = [[140, 190, 255], [255, 168, 80], [120, 230, 170], [255, 120, 150], [200, 160, 255], [255, 220, 120], [120, 220, 255]];
function networkHud(h, t) {
  const A = fadeWin(t, tFast + 0.1, tLift2 - 0.05, 0.4, 0.35);
  if (A <= 0) return;
  const x = 1920 - 72 - 520, y0 = 250;
  h.save();
  h.fillStyle = rgba([4, 8, 18], 0.62 * A); h.fillRect(x - 24, y0 - 50, 568, 690);
  h.strokeStyle = rgba(C_COOL, 0.35 * A); h.lineWidth = 1; h.strokeRect(x - 24, y0 - 50, 568, 690);
  hudText(h, '台站 · STATIONS', x, y0 - 16, { font: '600 15px PFB', color: rgba(C_DIM, A), spacing: 3 });
  STATIONS.forEach(([id, city], i) => {
    const ti = tFast + 0.25 + i * BEAT * 0.5;
    const a = A * prog(t, ti, ti + 0.25);
    if (a <= 0.01) return;
    const y = y0 + 22 + i * 40;
    const ph = (t - ti) / (BEAT * 2) + i * 0.37;
    const st = t < ti + 0.6 ? ['转向', 'SLEW'] : (Math.floor(ph) % 3 === 0 ? ['转向', 'SLEW'] : ['曝光', 'EXPOSE']);
    const col = ST_COL[i];
    h.fillStyle = rgba(col, a); h.beginPath(); h.arc(x + 6, y - 6, 6, 0, TAU); h.fill();
    hudText(h, id, x + 24, y, { font: '600 18px PlexB', color: rgba(C_STAR, a), spacing: 1 });
    hudText(h, city, x + 200, y, { font: '600 18px PFB', color: rgba(C_DIM, a) });
    hudText(h, `${st[0]} ${st[1]}`, x + 520, y, { font: '600 16px PFB', color: rgba(st[1] === 'EXPOSE' ? C_WARM : C_COOL, a), align: 'right', spacing: 1 });
  });
  // light curve
  const cx = x, cy = y0 + 340, cw = 520, ch = 270;
  const la = A * prog(t, tFast + 1.6, tFast + 2.2);
  if (la > 0.01) {
    hudText(h, '光变曲线 · LIGHT CURVE', cx, cy - 14, { font: '600 15px PFB', color: rgba(C_DIM, la), spacing: 3 });
    h.strokeStyle = rgba(C_DIM, 0.4 * la); h.lineWidth = 1; h.strokeRect(cx, cy, cw, ch);
    for (let k = 1; k < 4; k++) { h.beginPath(); h.moveTo(cx, cy + ch * k / 4); h.lineTo(cx + cw, cy + ch * k / 4); h.strokeStyle = rgba(C_DIM, 0.12 * la); h.stroke(); }
    hudText(h, '星等 MAG', cx + 8, cy + 20, { font: '500 12px PFB', color: rgba(C_DIM, 0.8 * la) });
    hudText(h, '时间 TIME →', cx + cw - 8, cy + ch - 10, { font: '500 12px PFB', color: rgba(C_DIM, 0.8 * la), align: 'right' });
    const span = tLift2 - 0.4 - (tFast + 2.0);
    const N = 84;
    for (let k = 0; k < N; k++) {
      const u = k / (N - 1);
      const tk = tFast + 2.0 + u * span;
      if (tk > t) break;
      const mag = 0.18 + 0.68 * (Math.exp(-u * 3.2) * (1 - Math.exp(-u * 40))) + 0.05 * (hash(k * 7.7) - 0.5);
      const px = cx + 18 + u * (cw - 36), py = cy + ch - 18 - mag * (ch - 40);
      const si = k % STATIONS.length;
      const fresh = Math.exp(-(t - tk) * 6);
      h.fillStyle = rgba(ST_COL[si], la * (0.75 + 0.25 * fresh)); h.beginPath(); h.arc(px, py, 3.2 + 3 * fresh, 0, TAU); h.fill();
    }
  }
  h.restore();
}

function ctaHud(h, t) {
  const lt = t - tLift2;
  if (lt < 0) return;
  const out = 1 - prog(t, 58.2, 59.4);
  const a1 = prog(lt, 1.4, 2.0) * out;
  if (a1 > 0) {
    h.save(); h.shadowColor = 'rgba(0,0,0,0.75)'; h.shadowBlur = 24;
    const y = 690 + (1 - ease.outCubic(prog(lt, 1.4, 2.0))) * 16;
    hudText(h, '一台会自己值守的开源望远镜', 960, y, { font: '600 40px PFB', color: rgba(C_STAR, a1), align: 'center', spacing: 4 });
    hudText(h, 'AN OPEN-SOURCE, SELF-ATTENDING TELESCOPE NETWORK', 960, y + 38, { font: '500 16px AX5', color: rgba(C_RED, a1 * 0.95), align: 'center', spacing: 5 });
    h.restore();
  }
  const rows = [
    ['在线体验  redbank-iii.org/sim', 'TRY THE LIVE TWIN', 2.3],
    ['开源  github.com/redbank-iii', 'OPEN SOURCE', 3.0],
  ];
  rows.forEach(([cn, en, d], i) => caption(h, cn, en, 960, 806 + i * 76, prog(lt, d, d + 0.5) * out, { align: 'center', cnPx: 32, enPx: 14, gap: 28, scrim: 0.8, cnCol: i === 0 ? C_WARM : C_STAR }));
  const ua = prog(lt, 4.0, 4.6) * out;
  if (ua > 0) {
    hudText(h, 'GOSIM SPOTLIGHT 2026 · 深圳 SHENZHEN', 960, 1080 - LB - 30, { font: '600 20px PFB', color: rgba(C_DIM, ua), align: 'center', spacing: 4 });
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
  caption(h, '每天夜里，天上都有来不及看的事：', 'EVERY NIGHT, THE SKY CHANGES FASTER THAN ANYONE CAN WATCH', 120, 740, fadeWin(t, 1.4, 6.6, 0.7, 0.5), { scrim: 1 });
  caption(h, 'X 射线暴 · 伽马暴 · 变星', 'X-RAY TRANSIENTS · GAMMA-RAY BURSTS · VARIABLE STARS', 120, 838, fadeWin(t, 2.9, 6.6, 0.7, 0.5), { cnCol: C_WARM });
  caption(h, '让望远镜，自己值守。', 'LET THE TELESCOPE KEEP WATCH ON ITS OWN.', 120, 790, fadeWin(t, 6.9, 9.8, 0.6, 0.5), { cnPx: 52, enPx: 18, gap: 46 });
  // title sub
  caption(h, '一台会自己值守的开源望远镜', 'AN OPEN-SOURCE TELESCOPE THAT RUNS ITS OWN NIGHT', 960, 880, fadeWin(t, tLift1 + 1.8, 13.4, 0.6, 0.5), { align: 'center', cnPx: 32, enPx: 15, gap: 32, cnCol: C_STAR, enCol: C_RED, scrim: 1 });
  // the unit
  caption(h, '3D 打印机身 · 内置 Mac mini', 'PRINTED PYRAMID BODY · MAC MINI INSIDE · ONE POWER CABLE', 120, 200, fadeWin(t, 18.2, 21.0, 0.5, 0.4), { scrim: 1 });
  caption(h, 'AZ-GTi 云台 · ASI585 相机 + 50mm 镜头', 'AZ-GTi MOUNT · ZWO ASI585 CAMERA · 50 MM LENS', 120, 296, fadeWin(t, 18.6, 21.0, 0.5, 0.4), { cnCol: C_WARM, cnPx: 36 });
  const mr = fadeWin(t, 18.2, 21.0, 0.5, 0.4);
  if (mr > 0) hudText(h, 'v08 模型渲染 · MODEL RENDER · 云台与镜头为示意', 1920 - 72, 1080 - LB - 64, { font: '500 14px PFB', color: rgba(C_DIM, 0.8 * mr), align: 'right', spacing: 2 });
  // exploded-view labels
  const xa = fadeWin(t, 15.0, 18.1, 0.5, 0.4);
  if (xa > 0) {
    const an = W.unit.anchors();
    const L = [['shell', '外壳 · 前后两半', 'PRINTED SHELL', 1], ['screen', '7 寸屏 · 1024×600', '7" DISPLAY', -1], ['mini', 'Mac mini 主控', 'MAC MINI · M4', 1],
      ['base', '底板', 'BASE PLATES', -1], ['mount', 'AZ-GTi 云台', 'AZ-GTi MOUNT', 1], ['lens', 'ASI585 + 50mm', 'CAMERA + LENS', 1]];
    h.save();
    L.forEach(([k, cn, en, side], i) => {
      const a = xa * prog(t, 15.0 + i * 0.18, 15.4 + i * 0.18);
      if (a <= 0.01) return;
      const s = project(W.cam, an[k]); if (s.behind) return;
      const lx = s.x + side * 150, ly = s.y - 46;
      h.strokeStyle = rgba(C_STAR, 0.7 * a); h.lineWidth = 1.2;
      h.beginPath(); h.moveTo(s.x, s.y); h.lineTo(lx - side * 10, ly); h.lineTo(lx, ly); h.stroke();
      h.fillStyle = rgba(C_WARM, a); h.beginPath(); h.arc(s.x, s.y, 3.5, 0, TAU); h.fill();
      const al = side > 0 ? 'left' : 'right', tx = lx + side * 8;
      hudText(h, cn, tx, ly + 7, { font: '600 22px PFB', color: rgba(C_STAR, a), align: al, spacing: 1 });
      hudText(h, en, tx, ly + 28, { font: '500 12px AX5', color: rgba(C_DIM, a), align: al, spacing: 2 });
    });
    h.restore();
  }
  // survey
  caption(h, '平时：Agent 自主巡天，一块一块拍', 'ROUTINE: THE AGENT SURVEYS THE SKY, TILE BY TILE', 960, 172, fadeWin(t, 22.4, 24.8, 0.5, 0.4), { align: 'center', cnPx: 34, enPx: 15, gap: 34, scrim: 1 });
  // weather
  caption(h, '云来了：读天气，换到晴朗的天区', 'CLOUDS ROLL IN: READ THE WEATHER, MOVE TO CLEAR SKY', 960, 172, fadeWin(t, 25.1, 29.8, 0.5, 0.4), { align: 'center', cnPx: 38, enPx: 16, gap: 36, scrim: 1 });
  // EP alert
  const ta2 = fadeWin(t, tToo, 32.8, 0.12, 0.4);
  if (ta2 > 0) {
    const blink = t < tToo + 1.25 ? (Math.floor((t - tToo) / (BEAT / 2)) % 2 === 0 ? 1 : 0.55) : 1;
    const x = 960, y = 172;
    h.save(); h.globalAlpha = ta2 * blink;
    h.strokeStyle = rgba(C_ALERT, 1); h.lineWidth = 2; h.strokeRect(x - 360, y - 44, 720, 96);
    h.fillStyle = rgba([60, 12, 6], 0.55); h.fillRect(x - 360, y - 44, 720, 96);
    h.fillStyle = rgba(C_ALERT, 1); h.beginPath(); h.moveTo(x - 330, y + 16); h.lineTo(x - 310, y - 20); h.lineTo(x - 290, y + 16); h.closePath(); h.fill();
    hudText(h, '!', x - 310, y + 12, { font: '900 22px AX9', color: 'rgba(40,6,0,1)', align: 'center' });
    hudText(h, 'EP 警报 · X 射线暂现源', x + 20, y + 4, { font: '600 36px PFB', color: rgba(C_STAR, 1), align: 'center', spacing: 4 });
    hudText(h, 'EP ALERT · GCN-EP-20260803-001', x + 20, y + 36, { font: '500 15px AX5', color: rgba([255, 200, 175], 1), align: 'center', spacing: 3 });
    h.restore();
  }
  const rd = fadeWin(t, CUES.toodone, 34.6, 0.25, 0.4);
  caption(h, 'Agent：判断误差圈 → 转向 → 曝光', 'AGENT: ERROR CIRCLE → SLEW → EXPOSE', 960, 300, rd, { align: 'center', cnPx: 34, enPx: 14, gap: 30, cnCol: C_WARM, scrim: 1.4 });
  caption(h, '目标确认', 'COUNTERPART CONFIRMED', 960, 250, fadeWin(t, tReq + 0.15, 37.4, 0.35, 0.5), { align: 'center', cnPx: 58, enPx: 18, gap: 44, scrim: 1.3 });
  caption(h, '从收到警报到拍到目标，全程无人值守', 'FROM ALERT TO IMAGE · NO HUMAN IN THE LOOP', 960, 850, fadeWin(t, CUES.report, 37.4, 0.3, 0.5), { align: 'center', cnPx: 30, enPx: 14, gap: 28, scrim: 1.3 });
  // network
  caption(h, '多台组网 · 统一调度', 'A NETWORK OF UNITS · ONE SCHEDULER', 120, 190, fadeWin(t, tFast + 0.2, tFormal + 0.2, 0.4, 0.4), { cnPx: 46, enPx: 16, gap: 40, scrim: 1 });
  caption(h, '仿真内核逐秒推演', 'A DETERMINISTIC TWIN, SECOND BY SECOND', 120, 190, fadeWin(t, tFormal + 0.3, tLift2 - 0.1, 0.4, 0.35), { cnPx: 46, enPx: 16, gap: 40, scrim: 1 });
  caption(h, '同一套接口，仿真与真机无缝切换', 'THE SAME STATION API DRIVES SIMULATION AND REAL HARDWARE', 120, 840, fadeWin(t, tFormal + 1.2, tLift2 - 0.1, 0.4, 0.35), { cnPx: 30, enPx: 14, gap: 30, cnCol: C_WARM, scrim: 1 });
  caption(h, '同一种子，事件流逐字节一致', 'SAME SEED → BYTE-IDENTICAL EVENT STREAM', 120, 930, fadeWin(t, T(19, 0), tLift2 - 0.1, 0.4, 0.35), { cnPx: 26, enPx: 13, gap: 26, scrim: 1 });

  gameHud(h, W, t);
  networkHud(h, t);
  ctaHud(h, t);
}

const SCENES = [
  section('night', 0, tLift1, '01  夜 · NIGHT'),
  section('title', tLift1, tGame, ''),
  section('slots', tGame, T(10), '02  机身与巡天 · THE UNIT'),
  section('weather', T(10), tToo, '03  天气 · WEATHER'),
  section('interrupt', tToo, tFast, '04  EP 警报 · THE ALERT'),
  section('score', tFast, tFormal, '05  组网 · THE NETWORK'),
  section('competition', tFormal, tLift2, '06  数字孪生 · THE TWIN'),
  section('cta', tLift2, DUR, ''),
];

export default {
  bpm: BPM, dur: 60, audio: 'audio/track.wav',
  fonts: {
    AX9: '/v7-redbank/fonts/Archivo-w1250-900.ttf',
    AX5: '/v7-redbank/fonts/Archivo-w1250-500.ttf',
    AX3: '/v7-redbank/fonts/Archivo-w1250-300.ttf',
    Plex: '/v7-redbank/fonts/IBMPlexMono-Regular.ttf',
    PlexB: '/v7-redbank/fonts/IBMPlexMono-SemiBold.ttf',
    PFB: '/v7-redbank/fonts/NotoSansSC-Bold-sub.otf',
    PFR: '/v7-redbank/fonts/NotoSansSC-Regular-sub.otf',
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
    hudText(h, '第三红岸', 72, LB + 40, { font: '600 17px PFB', color: rgba(C_STAR, 0.85 * A), spacing: 3 });
    hudText(h, 'REDBANK III · OPEN-SOURCE TELESCOPE NETWORK', 168, LB + 40, { font: '500 12px AX5', color: rgba(C_DIM, 0.7 * A), spacing: 3 });
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
