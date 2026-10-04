// The Redbank III unit: the real v08 pyramid body (4 printed STL parts) + an illustrative alt-az head on top.
// STL data: data/pyramid.json (gzip+base64 float32 triangles, print pose; assembly_to_print inverted -> assembled pose).
import * as THREE from 'three';
import { V, PIVOT } from './lib.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const MM = 0.0165;            // mm -> world units
export const BODY_H = 221 * MM;

async function parseMesh(p) {
  const d = atob(p.data); const b = new Uint8Array(d.length);
  for (let i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
  const buf = await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf), 3));
  return g;
}

export async function makeUnit(scene) {
  const DATA = await (await fetch(new URL('./data/pyramid.json', import.meta.url))).json();
  const root = new THREE.Group(); root.name = 'unit'; scene.add(root);
  // STL is Z-up millimetres; world is Y-up
  const body = new THREE.Group(); body.rotation.x = -Math.PI / 2; body.scale.setScalar(MM); root.add(body);
  const parts = {};
  const box = new THREE.Box3();
  for (const p of DATA.parts) {
    const g = await parseMesh(p.mesh);
    g.applyMatrix4(new THREE.Matrix4().set(...p.assembly_to_print.flat()).invert());
    g.computeVertexNormals(); g.computeBoundingBox(); box.union(g.boundingBox);
    const shell = p.name.startsWith('shell');
    const mat = new THREE.MeshStandardMaterial({ color: shell ? 0xb8bcc4 : 0x5a606b, roughness: shell ? 0.62 : 0.8, metalness: 0.0, flatShading: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, mat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: 0x0a0c10, transparent: true, opacity: 0.35 }));
    const grp = new THREE.Group(); grp.add(mesh, edges); body.add(grp); parts[p.name] = grp;
  }
  // Mac mini (M4: 127 x 127 x 50 mm) on the base floor (z = 6 mm, measured from the STL), centred
  const mini = new THREE.Group(); body.add(mini); parts.mini = mini;
  const alu = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.32, metalness: 0.85 });
  const miniBox = new THREE.Mesh(new RoundedBoxGeometry(127, 127, 48, 4, 9), alu); miniBox.position.z = 8 + 24; mini.add(miniBox);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(52, 52, 2.2, 48), new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.9 }));
  foot.rotation.x = Math.PI / 2; foot.position.z = 7.1; mini.add(foot);
  const led = new THREE.Mesh(new THREE.CircleGeometry(1.2, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.4, 1.4) }));
  led.rotation.x = Math.PI / 2; led.position.set(40, -63.6, 16); mini.add(led);

  // 7" 1024x600 screen, portrait, behind the front-face opening (measured: x ±54, slant z 27..189, wall 2.4 mm)
  const N = new THREE.Vector3(0, -205, 45).normalize();       // outward normal of the front face
  const U = new THREE.Vector3(0, 45, 205).normalize();        // up the slant
  const X = new THREE.Vector3(1, 0, 0);
  const sc = new THREE.Vector3(0, -105 + 45 * 108 / 205, 108).addScaledVector(N, -3.6);
  const scr = new THREE.Group(); body.add(scr); parts.screen = scr;
  scr.matrixAutoUpdate = false;
  const scrBase = new THREE.Matrix4().makeBasis(X, U, N).setPosition(sc);
  scr.matrix.copy(scrBase);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(100, 165, 5), new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.25, metalness: 0.3 }));
  bezel.position.z = -2.5; scr.add(bezel);
  const cv = document.createElement('canvas'); cv.width = 600; cv.height = 1024;
  const g2 = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const uiMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const ui = new THREE.Mesh(new THREE.PlaneGeometry(86, 154), uiMat); ui.position.z = 0.15; scr.add(ui);
  let uiT = -1;
  function drawUI(t) {
    const k = Math.floor(t * 4) / 4; if (k === uiT) return; uiT = k;
    const h = g2; h.fillStyle = '#04070d'; h.fillRect(0, 0, 600, 1024);
    h.fillStyle = '#e8eef8'; h.font = '600 64px PFB'; h.textAlign = 'center'; h.fillText('第三红岸', 300, 120);
    h.fillStyle = '#ff5c54'; h.font = '500 26px AX5'; h.fillText('REDBANK III', 300, 166);
    // star map
    const cx = 300, cy = 440, R = 210;
    h.strokeStyle = 'rgba(140,190,255,0.55)'; h.lineWidth = 2; h.beginPath(); h.arc(cx, cy, R, 0, Math.PI * 2); h.stroke();
    h.strokeStyle = 'rgba(140,190,255,0.2)'; h.beginPath(); h.arc(cx, cy, R * 0.55, 0, Math.PI * 2); h.moveTo(cx - R, cy); h.lineTo(cx + R, cy); h.moveTo(cx, cy - R); h.lineTo(cx, cy + R); h.stroke();
    let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 140; i++) { const a = rnd() * 6.283 + t * 0.02, r = Math.sqrt(rnd()) * R * 0.97, m = rnd();
      h.fillStyle = `rgba(230,240,255,${0.35 + 0.6 * m})`; h.beginPath(); h.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 1 + 2.4 * m * m, 0, 6.283); h.fill(); }
    const ta = 0.8 + t * 0.15, tr = R * 0.5;
    const tx = cx + tr * Math.cos(ta), ty = cy + tr * Math.sin(ta);
    h.strokeStyle = '#ffa850'; h.lineWidth = 3; h.strokeRect(tx - 18, ty - 18, 36, 36);
    // status
    h.textAlign = 'left';
    const rows = [['值守中', 'ON DUTY', '#5ee08a'], ['云台', 'MOUNT OK', '#5ee08a'], ['相机', 'EXPOSING', '#ffa850'], ['天气', 'CLEAR', '#5ee08a']];
    rows.forEach(([cn, en, col], i) => {
      const y = 740 + i * 62;
      const blink = i === 0 ? (0.55 + 0.45 * Math.abs(Math.sin(t * 3))) : 1;
      h.fillStyle = col; h.globalAlpha = blink; h.beginPath(); h.arc(70, y - 12, 12, 0, 6.283); h.fill(); h.globalAlpha = 1;
      h.fillStyle = '#e8eef8'; h.font = '600 36px PFB'; h.fillText(cn, 100, y);
      h.fillStyle = '#96a8c8'; h.font = '500 24px AX5'; h.fillText(en, 300, y);
    });
    tex.needsUpdate = true;
  }
  drawUI(0);

  // centre the body on the origin (x/y of the STL), base at y = 0.3 (plinth top)
  const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2;
  body.position.set(-cx * MM, 0.3 - box.min.z * MM, cy * MM);
  const top = 0.3 + (box.max.z - box.min.z) * MM;

  // illustrative alt-az head (AZ-GTi-like) + camera/lens, pivot at PIVOT
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1f25, roughness: 0.45, metalness: 0.45 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb3222c, roughness: 0.4, metalness: 0.3, emissive: 0x300508 });
  const az = new THREE.Group(); az.position.set(0, top, 0); root.add(az);
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.24, 48), dark); disk.position.y = 0.12; az.add(disk);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, PIVOT.y - top + 0.25, 0.5), dark); arm.position.set(-0.62, (PIVOT.y - top + 0.25) / 2 + 0.1, 0); az.add(arm);
  const alt = new THREE.Group(); alt.position.set(0, PIVOT.y - top, 0); az.add(alt);
  const lensBody = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.05, 40), dark); lensBody.position.y = 0.2; alt.add(lensBody);
  const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.6, 0.72), dark); camBox.position.y = -0.55; alt.add(camBox);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.05, 12, 40), red); ring.rotation.x = Math.PI / 2; ring.position.y = 0.55; alt.add(ring);
  const glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.22, 0.4) });
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.31, 40), glassMat); glass.rotation.x = -Math.PI / 2; glass.position.y = 0.73; alt.add(glass);

  // lights for the standard materials (the rest of the world is self-lit shaders)
  const moon = new THREE.DirectionalLight(0xc8d4ff, 0.55); moon.position.set(-12, 18, 14); scene.add(moon); moon.target = root;
  const rim = new THREE.DirectionalLight(0xff7a5a, 0.22); rim.position.set(14, 6, -12); scene.add(rim); rim.target = root;
  const fill = new THREE.HemisphereLight(0x5068a0, 0x080808, 0.18); scene.add(fill);
  const screen = new THREE.PointLight(0x7fb0ff, 0, 6, 1.5); screen.position.set(0, 1.6, 2.2); scene.add(screen);

  const up = V(0, 1, 0);
  return {
    root, parts, top,
    // world-space label anchors for the exploded view
    anchors() {
      root.updateMatrixWorld(true);
      const w = (o, v) => o.localToWorld(v.clone());
      return {
        shell: w(parts.shell_back, V(80, 60, 150)), base: w(parts.base_front, V(90, -90, 6)),
        mini: w(parts.mini, V(63, -40, 40)), screen: w(scr, V(-50, 60, 0)),
        mount: w(az, V(0.68, 0.12, 0)), lens: w(alt, V(0.36, 0.2, 0)),
      };
    },
    // p: { aim: Vector3, explode: 0..1, glow }
    update(t, p = {}) {
      const e = p.explode ?? 0;
      // exploded view along the assembly directions (body local = STL mm, z up, front face toward -y)
      parts.shell_front.position.set(0, -150 * e, 120 * e);
      parts.shell_back.position.set(0, 150 * e, 120 * e);
      parts.base_front.position.set(0, -60 * e, 0);
      parts.base_back.position.set(0, 60 * e, 0);
      parts.mini.position.set(0, 0, 55 * e);
      const so = new THREE.Vector3(0, -150 * e, 120 * e).addScaledVector(N, 95 * e);
      scr.matrix.copy(scrBase).premultiply(new THREE.Matrix4().makeTranslation(so.x, so.y, so.z));
      drawUI(t);
      const hd = Math.max(0, p.headDrop ?? 0);
      az.position.y = top + 4.4 * hd;
      alt.position.y = PIVOT.y - top + 1.7 * hd;
      const aim = (p.aim ?? up).clone().normalize();
      az.rotation.y = Math.atan2(aim.x, aim.z);
      const el = Math.asin(Math.max(-1, Math.min(1, aim.y)));
      alt.rotation.x = Math.PI / 2 - el;
      glassMat.color.setRGB(0.15, 0.22, 0.4).multiplyScalar(1 + 3 * (p.glow ?? 0));
      screen.intensity = 3 * (p.screen ?? 0);
    },
  };
}
