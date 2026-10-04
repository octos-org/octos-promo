// The README ASCII logo rebuilt as instanced voxels: each █ is a 2×4×2 stack of cubes,
// the box-drawing strokes (╔═╗║╚╝) become thin beams set back behind the blocks.
import * as THREE from 'three';
import { mulberry32 } from '../engine/util.js';

export const LOGO = [
  ' ██████╗  ██████╗████████╗ ██████╗ ███████╗',
  '██╔═══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔════╝',
  '██║   ██║██║        ██║   ██║   ██║███████╗',
  '██║   ██║██║        ██║   ██║   ██║╚════██║',
  '╚██████╔╝╚██████╗   ██║   ╚██████╔╝███████║',
  ' ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚══════╝',
];
// direction flags: which half-segments leave the cell centre
const BOX = { '═': 'LR', '║': 'UD', '╔': 'RD', '╗': 'LD', '╚': 'RU', '╝': 'LU' };

// cell = CW × CH world units; a █ is split into NX × NY × NZ cubes
export function buildLogo({ CW = 1, CH = 2, NX = 2, NY = 4, NZ = 2, beamT = 0.22, beamZ = -1.1, seed = 7 } = {}) {
  const rows = LOGO.length, cols = Math.max(...LOGO.map((r) => [...r].length));
  const W = cols * CW, H = rows * CH;
  const cube = CW / NX; // cube edge
  const cubes = [], beams = [];
  const rnd = mulberry32(seed);
  LOGO.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const x0 = c * CW - W / 2, y0 = H / 2 - r * CH; // top-left corner of cell
      if (ch === '█') {
        for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
          cubes.push({
            p: new THREE.Vector3(x0 + (i + 0.5) * cube, y0 - (j + 0.5) * cube, (k - (NZ - 1) / 2) * cube),
            col: c + i / NX, row: r + j / NY, r1: rnd(), r2: rnd(), r3: rnd(), r4: rnd(), r5: rnd(),
          });
        }
      } else if (BOX[ch]) {
        const cx = x0 + CW / 2, cy = y0 - CH / 2;
        const d = BOX[ch];
        const seg = (ax, ay, bx, by) => {
          const len = Math.hypot(bx - ax, by - ay) + beamT;
          const horiz = Math.abs(by - ay) < 1e-6;
          beams.push({ p: new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, beamZ), s: horiz ? new THREE.Vector3(len, beamT, beamT) : new THREE.Vector3(beamT, len, beamT), col: c, row: r, r1: rnd(), r2: rnd(), r3: rnd() });
        };
        // double-line box chars: draw as a single centred stroke
        if (d === 'LR') seg(cx - CW / 2, cy, cx + CW / 2, cy);
        else if (d === 'UD') seg(cx, cy - CH / 2, cx, cy + CH / 2);
        else {
          if (d.includes('L')) seg(cx - CW / 2, cy, cx, cy);
          if (d.includes('R')) seg(cx, cy, cx + CW / 2, cy);
          if (d.includes('U')) seg(cx, cy, cx, cy + CH / 2);
          if (d.includes('D')) seg(cx, cy - CH / 2, cx, cy);
        }
      }
    });
  });
  return { cubes, beams, W, H, cols, rows, cube };
}

// Instanced meshes for a logo. update via setCube(i, pos, quat, scale).
export function logoMeshes(logo, cubeMat, beamMat, { gap = 0.9, bevel = true } = {}) {
  const cg = new THREE.BoxGeometry(logo.cube * gap, logo.cube * gap, logo.cube * gap);
  const cm = new THREE.InstancedMesh(cg, cubeMat, logo.cubes.length);
  cm.castShadow = true; cm.receiveShadow = true;
  cm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cm.frustumCulled = false;
  const bg = new THREE.BoxGeometry(1, 1, 1);
  const bm = new THREE.InstancedMesh(bg, beamMat, logo.beams.length);
  bm.castShadow = true; bm.receiveShadow = false;
  bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bm.frustumCulled = false;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  return {
    cubes: cm, beams: bm,
    setCube(i, p, rx, ry, rz, s) { _e.set(rx, ry, rz); _q.setFromEuler(_e); _s.setScalar(s); _m.compose(p, _q, _s); cm.setMatrixAt(i, _m); },
    setBeam(i, p, rx, ry, rz, sv, k = 1) { _e.set(rx, ry, rz); _q.setFromEuler(_e); _s.copy(sv).multiplyScalar(k); _m.compose(p, _q, _s); bm.setMatrixAt(i, _m); },
    commit() { cm.instanceMatrix.needsUpdate = true; bm.instanceMatrix.needsUpdate = true; },
    tmp: _p,
  };
}
