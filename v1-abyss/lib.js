// ABYSS — shared building blocks: timing, water world (env, surface, rays, marine snow),
// the bioluminescent kernel creature, and 3D type helpers. Everything is a pure function of t.
import * as THREE from 'three';
import { clamp, lerp, prog, ease, hash, mulberry32 } from '../engine/util.js';

export const BPM = 104, BEAT = 60 / BPM, BAR = 4 * BEAT;
export const T = (bar, beat = 0) => bar * BAR + beat * BEAT;
export const TAU = Math.PI * 2;

export const ORANGE = new THREE.Color(0xff6a1a);
export const CYAN = new THREE.Color(0x38e1ff);
export const ICE = new THREE.Color(0xbff4ff);

// ---------------------------------------------------------------- music mirror (audio/track.py)
export const HITS = (() => {
  const k = [];
  for (let b = 4; b < 8; b++) for (const bt of [0, 2]) k.push([T(b, bt), 0.55, 'heart'], [T(b, bt + 0.4), 0.3, 'heart']);
  for (let b = 8; b < 12; b++) k.push([T(b, 0), 0.8, 'kick'], [T(b, 2), 0.8, 'kick'], [T(b, 2.75), 0.35, 'kick']);
  for (let bt = 0; bt < 4; bt++) k.push([T(12, bt), 0.85, 'kick']);
  for (const bt of [0, 0.5, 1, 1.5, 2, 2.5]) k.push([T(13, bt), 0.8, 'kick']);
  for (let b = 14; b < 22; b++) for (let bt = 0; bt < 4; bt++) k.push([T(b, bt), 1, 'kick']);
  k.push([T(22), 1, 'kick']);
  for (const b of [23, 24]) for (const bt of [0, 2]) k.push([T(b, bt), 0.4, 'heart'], [T(b, bt + 0.4), 0.22, 'heart']);
  return k.sort((a, b) => a[0] - b[0]);
})();
export const BELLS = [[0, 2], [1, 0], [1, 2.5], [2, 0], [2, 3], [3, 1.5], [3, 3], [4, 2], [5, 0], [5, 2.5], [6, 0], [6, 2], [7, 1], [7, 3]]
  .map(([b, bt]) => [T(b, bt), 1]);
export const CLAPS = (() => { const c = []; for (let b = 10; b < 12; b++) c.push([T(b, 1), 0.5], [T(b, 3), 0.5]); for (let b = 14; b < 22; b++) c.push([T(b, 1), 1], [T(b, 3), 1]); return c; })();

export function lastHit(t, list = HITS) { let r = null; for (const h of list) { if (h[0] <= t + 1e-6) r = h; else break; } return r; }
export function env(t, decay = 0.22, list = HITS) { const h = lastHit(t, list); return h ? h[1] * Math.exp(-(t - h[0]) / decay) : 0; }
export function recent(t, win, list = HITS) { return list.filter((h) => h[0] <= t + 1e-6 && t - h[0] < win); }

// ---------------------------------------------------------------- small vec helpers
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export function camLook(cam, pos, target, roll = 0) {
  cam.position.set(...pos);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(...target);
  cam.updateMatrixWorld(true);
}
export function project(cam, v) {
  const p = v.clone().project(cam);
  return { x: (p.x * 0.5 + 0.5) * 1920, y: (-p.y * 0.5 + 0.5) * 1080, behind: p.z > 1 };
}

// ---------------------------------------------------------------- GLSL shared
const FOG = /* glsl */`
uniform vec3 fogColor; uniform float fogDensity;
vec3 applyFog(vec3 c, float d){ float f = 1.0 - exp(-fogDensity*fogDensity*d*d); return mix(c, fogColor, clamp(f,0.,1.)); }
`;
const CAUSTIC = /* glsl */`
float caustic(vec2 uv, float time){
  vec2 p = mod(uv * 6.2831853, 6.2831853) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(max(c, 0.0), 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 3.0);
}
`;

// ---------------------------------------------------------------- the water world
// opts: { snow: count, rays: count, surface: bool, rayArea }
export function makeWorld(scene, opts = {}) {
  const U = {
    fogColor: { value: new THREE.Color(0x02090c) }, fogDensity: { value: 0.035 }, time: { value: 0 },
    camPos: { value: V() },
  };
  scene.fog = new THREE.FogExp2(U.fogColor.value, 0.035);
  scene.background = null;

  // env sphere
  const envMat = new THREE.ShaderMaterial({
    uniforms: { ...U, shallow: { value: 0 }, glowDir: { value: V(0, -1, 0) }, glowCol: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: `varying vec3 vD; void main(){ vD = (modelMatrix*vec4(position,1.0)).xyz - cameraPosition; gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w*0.9999; }`,
    fragmentShader: `uniform vec3 fogColor; uniform float shallow, time; uniform vec3 glowDir, glowCol; varying vec3 vD;
      ${CAUSTIC}
      void main(){ vec3 d = normalize(vD); float up = d.y;
        vec3 col = fogColor * mix(0.35, 1.0, smoothstep(-0.9, 0.1, up));
        col += fogColor * 2.2 * pow(max(up, 0.0), 2.0) * shallow;
        col += vec3(0.05,0.3,0.4) * pow(max(up,0.0), 6.0) * shallow * shallow;
        float g = max(dot(d, glowDir), 0.0);
        col += glowCol * (pow(g, 12.0) * 0.6 + pow(g, 3.0) * 0.12);
        gl_FragColor = vec4(col, 1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const envMesh = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), envMat);
  envMesh.renderOrder = -10; envMesh.frustumCulled = false;
  scene.add(envMesh);

  // ocean surface seen from below (the "interface")
  let surface = null;
  if (opts.surface) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, bright: { value: 1 }, surfY: { value: 0 } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 camPos; uniform float time, bright; varying vec3 vW; ${FOG} ${CAUSTIC}
        void main(){
          vec3 Vv = normalize(camPos - vW); float cosI = abs(Vv.y);
          float c = caustic(vW.xz * 0.55 + vec2(time*0.05, 0.0), time * 0.45);
          float c2 = caustic(vW.xz * 0.13 + 3.0, time * 0.3);
          float win = smoothstep(0.64, 0.7, cosI + (c2 - 0.3) * 0.03);
          vec3 sky = vec3(0.30, 0.62, 0.72) * (0.35 + 0.5 * smoothstep(0.7, 1.0, cosI)) + vec3(0.6, 0.95, 1.0) * (c * 0.9 + c2 * 0.25);
          vec3 refl = vec3(0.012, 0.05, 0.06) * (0.7 + 0.8 * c);
          vec3 col = mix(refl, sky, win) * bright;
          gl_FragColor = vec4(applyFog(col, length(camPos - vW)), 1.0); }`,
      side: THREE.DoubleSide, fog: false,
    });
    surface = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), mat);
    surface.rotation.x = -Math.PI / 2;
    scene.add(surface);
  }

  // god rays: camera-facing tall quads hanging from a plane
  const rays = [];
  const rayGeo = new THREE.PlaneGeometry(1, 1); rayGeo.translate(0, -0.5, 0);
  const nR = opts.rays ?? 0; const rr = mulberry32(opts.seed ?? 7);
  const rayMat0 = new THREE.ShaderMaterial({
    uniforms: { ...U, intensity: { value: 1 }, seed: { value: 0 }, col: { value: new THREE.Color(0.5, 0.9, 1.0) } },
    vertexShader: `varying vec2 vUv; varying float vDist, vFace; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vDist = length(w.xyz - cameraPosition);
      vFace = abs(dot(normalize(mat3(modelMatrix)*vec3(0.0,0.0,1.0)), normalize(cameraPosition - w.xyz))); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float intensity, seed, time; uniform vec3 col; varying vec2 vUv; varying float vDist, vFace;
      void main(){ float x = (vUv.x - 0.5) * 2.0;
        float across = exp(-x*x*4.0) * (0.75 + 0.25*sin(x*9.0 + seed*7.0 + time*0.6));
        float along = pow(clamp(vUv.y, 0.0, 1.0), 1.6);
        float flick = 0.55 + 0.45*sin(time*0.9 + seed*6.28 + vUv.y*2.0);
        float near = smoothstep(0.5, 4.0, vDist);
        float f = exp(-vDist*0.018) * near;
        gl_FragColor = vec4(col * across * along * flick * intensity * f, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  for (let i = 0; i < nR; i++) {
    const m = rayMat0.clone();
    m.uniforms.time = U.time; m.uniforms.intensity = { value: 1 }; m.uniforms.seed = { value: rr() };
    const mesh = new THREE.Mesh(rayGeo, m); mesh.frustumCulled = false;
    const a = opts.rayArea ?? [60, 60];
    mesh.userData = { x: (rr() - 0.5) * a[0], z: (rr() - 0.5) * a[1], w: 1.5 + rr() * 5, len: 40 + rr() * 60, base: 0.3 + rr() * 0.7, sway: rr() * 10 };
    rays.push(mesh); scene.add(mesh);
  }

  // marine snow
  const N = opts.snow ?? 6000;
  const sg = new THREE.BufferGeometry();
  const seeds = new Float32Array(N * 4); const sr = mulberry32(99);
  for (let i = 0; i < N * 4; i++) seeds[i] = sr();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const snowMat = new THREE.ShaderMaterial({
    uniforms: { ...U, box: { value: 36 }, size: { value: 0.05 }, pix: { value: 1080 / (2 * Math.tan((40 * Math.PI) / 360)) }, bright: { value: 1 }, plankton: { value: 1 }, pulse: { value: 0 }, flow: { value: V() }, tint: { value: new THREE.Color(0.55, 0.8, 0.85) } },
    vertexShader: `attribute vec4 aSeed; uniform float time, box, size, pix, bright, plankton, pulse; uniform vec3 camPos, flow;
      varying float vA; varying vec3 vC; uniform vec3 tint;
      void main(){
        vec3 p = aSeed.xyz * box;
        p += vec3(sin(time*0.31 + aSeed.w*40.0)*0.35, -time*(0.06 + 0.12*aSeed.w), cos(time*0.23 + aSeed.x*30.0)*0.35) + flow;
        p = camPos + mod(p - camPos + box*0.5, box) - box*0.5;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        float s = size * (0.4 + 1.2 * fract(aSeed.w * 13.7));
        float px = s * pix / max(dist, 0.01);
        float isP = step(0.965, aSeed.w);
        gl_PointSize = max(px, 1.6) * (1.0 + isP * 1.2);
        float cov = clamp(px / 1.6, 0.0, 1.0);
        float edge = 1.0 - smoothstep(box*0.32, box*0.5, length(p - camPos));
        vA = cov * cov * edge * smoothstep(0.15, 0.8, dist) * bright;
        float blink = 0.5 + 0.5 * sin(time * (1.0 + 3.0*fract(aSeed.y*7.3)) + aSeed.z * 60.0);
        vC = mix(tint * 0.9, vec3(0.2, 0.9, 1.0) * (1.5 + 5.0 * pulse) * blink * plankton, isP);
      }`,
    fragmentShader: `varying float vA; varying vec3 vC; uniform vec3 fogColor; uniform float fogDensity;
      void main(){ vec2 q = gl_PointCoord - 0.5; float r = dot(q,q)*4.0; float a = exp(-r*3.5) * vA;
        if (a < 0.003) discard;
        float d = gl_FragCoord.z / gl_FragCoord.w; float f = exp(-fogDensity*fogDensity*d*d*0.7);
        gl_FragColor = vec4(vC * a * f, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const snow = new THREE.Points(sg, snowMat); snow.frustumCulled = false;
  scene.add(snow);

  return {
    U, envMat, envMesh, surface, rays, snow, snowMat,
    // p: { fog: THREE.Color, density, shallow, rayI, rayCol, snowBright, plankton, pulse, surfBright, glowDir, glowCol }
    update(t, cam, p = {}) {
      U.time.value = t;
      U.camPos.value.copy(cam.position);
      if (p.fog) U.fogColor.value.copy(p.fog);
      if (p.density !== undefined) U.fogDensity.value = p.density;
      scene.fog.color.copy(U.fogColor.value); scene.fog.density = U.fogDensity.value;
      envMesh.position.copy(cam.position);
      envMat.uniforms.shallow.value = p.shallow ?? 0;
      if (p.glowDir) envMat.uniforms.glowDir.value.copy(p.glowDir);
      envMat.uniforms.glowCol.value.copy(p.glowCol ?? new THREE.Color(0, 0, 0));
      if (surface) { surface.material.uniforms.bright.value = p.surfBright ?? 1; surface.position.y = p.surfY ?? 0; surface.visible = (p.surfBright ?? 1) > 0; }
      snowMat.uniforms.bright.value = p.snowBright ?? 1;
      snowMat.uniforms.plankton.value = p.plankton ?? 1;
      snowMat.uniforms.pulse.value = p.pulse ?? 0;
      snowMat.uniforms.size.value = p.snowSize ?? 0.05;
      if (p.flow) snowMat.uniforms.flow.value.set(...p.flow);
      const rayTop = p.rayTop ?? 0;
      for (const r of rays) {
        const d = r.userData;
        const x = d.x + Math.sin(t * 0.07 + d.sway) * 2, z = d.z + Math.cos(t * 0.05 + d.sway) * 2;
        r.position.set(x, rayTop, z);
        r.scale.set(d.w, d.len, 1);
        r.rotation.set(0, Math.atan2(cam.position.x - x, cam.position.z - z), 0);
        r.rotation.z = 0.12; r.rotation.order = 'YXZ';
        r.material.uniforms.intensity.value = (p.rayI ?? 0) * d.base;
        if (p.rayCol) r.material.uniforms.col.value.copy(p.rayCol);
        r.visible = (p.rayI ?? 0) > 0.001;
      }
    },
  };
}

// ---------------------------------------------------------------- the kernel creature
const NR = 96, NS = 16;
function tentacleGeometry() {
  const g = new THREE.BufferGeometry();
  const n = NR * (NS + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const uv = new Float32Array(n * 2);
  for (let r = 0; r < NR; r++) for (let s = 0; s <= NS; s++) { const i = r * (NS + 1) + s; uv[i * 2] = r / (NR - 1); uv[i * 2 + 1] = s / NS; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let r = 0; r < NR - 1; r++) for (let s = 0; s < NS; s++) {
    const a = r * (NS + 1) + s, b = a + 1, c = a + NS + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  g.setIndex(idx);
  return g;
}

const TENT_VS = /* glsl */`varying vec3 vW, vN; varying vec2 vUv;
void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`;
const TENT_FS = /* glsl */`
uniform vec3 camPos, heartPos, heartCol, rimCol, pulseCol; uniform float heartI, rimI, spotI, tipI, ambI, time, seed, reachGlow;
uniform float pulses[6]; uniform float pulseG[6];
varying vec3 vW, vN; varying vec2 vUv;
${FOG}
void main(){
  vec3 N = normalize(vN); vec3 Vv = normalize(camPos - vW);
  float ndv = min(abs(dot(N, Vv)), 1.0); float fres = pow(1.0 - ndv, 2.4);
  float u = vUv.x, v = vUv.y;
  vec3 L = heartPos - vW; float dl = length(L); L /= dl;
  float lamb = max(dot(N, L), 0.0) * 0.8 + 0.2;
  vec3 alb = vec3(0.32, 0.075, 0.06);
  vec3 col = alb * heartCol * heartI * lamb * 1.1 / (1.0 + 0.1 * dl * dl);
  col += alb * vec3(0.2, 0.5, 0.6) * (0.25 + 0.75 * max(N.y, 0.0)) * ambI;
  // suckers on the underside
  float cv = cos(v * 6.2831853);
  float su = fract(u * 52.0);
  float suck = smoothstep(0.34, 0.24, length(vec2(su - 0.5, (v - 0.5) * 7.0)));
  float suckR = suck - smoothstep(0.2, 0.1, length(vec2(su - 0.5, (v - 0.5) * 7.0)));
  col += vec3(0.9, 0.55, 0.45) * suckR * 0.18 * (heartI * lamb * 0.8 + ambI * 0.3);
  // photophores along the top
  float pu = fract(u * 30.0 + seed);
  float ph = smoothstep(0.30, 0.06, length(vec2(pu - 0.5, sin(v * 6.2831853) * 1.6))) * step(0.3, cv);
  float tw = 0.45 + 0.55 * sin(time * 3.1 + u * 71.0 + seed * 9.0);
  // pulses
  float band = 0.0;
  for (int j = 0; j < 6; j++) { float x = (u - pulses[j]) * 16.0; band += exp(-x * x) * pulseG[j]; }
  col += pulseCol * band * (0.5 + 1.2 * fres) * 1.3;
  col += rimCol * ph * (spotI * tw + band * 5.0) * 3.0;
  col += rimCol * rimI * fres * 0.9;
  col += heartCol * tipI * smoothstep(0.82, 1.0, u) * 2.5;
  col += pulseCol * reachGlow * smoothstep(0.55, 1.0, u) * (0.3 + fres) * 2.0;
  gl_FragColor = vec4(applyFog(col, length(camPos - vW)), 1.0);
}`;

const MANTLE_VS = /* glsl */`uniform float time, breathe; varying vec3 vW, vN, vL;
void main(){
  vec3 p = position; vL = position;
  float w = sin(p.y * 4.0 - time * 1.3) * 0.025 + sin(p.x * 5.0 + p.z * 3.0 + time * 0.9) * 0.02;
  float pinch = smoothstep(0.2, -1.0, p.y);
  p.xz *= 1.0 - 0.35 * pinch;
  p *= 1.0 + w + breathe * 0.07 * (0.6 + 0.4 * p.y);
  p *= vec3(1.0, 1.35, 1.0);
  p.y += 1.15; p.z -= 0.15 * (p.y - 1.15);
  vec4 w4 = modelMatrix * vec4(p, 1.0); vW = w4.xyz;
  vN = normalize(mat3(modelMatrix) * normalize(normal * vec3(1.0, 1.0/1.35, 1.0)));
  gl_Position = projectionMatrix * viewMatrix * w4;
}`;
const MANTLE_FS = /* glsl */`
uniform vec3 camPos, heartPos, heartCol, rimCol; uniform float heartI, rimI, veinI, spotI, time, ambI, alpha;
varying vec3 vW, vN, vL;
${FOG}
void main(){
  vec3 N = normalize(vN); vec3 Vv = normalize(camPos - vW);
  float ndv = clamp(dot(N, Vv), 0.0, 1.0); float fres = pow(1.0 - ndv, 2.5);
  vec3 col = vec3(0.10, 0.03, 0.025) * (0.3 + 0.7 * max(N.y, 0.0)) * ambI;
  col += heartCol * heartI * pow(ndv, 2.5) * 0.3;
  float vein = pow(max(0.0, 1.0 - abs(sin(vL.y * 7.0 + sin(vL.x * 6.0 + time * 0.4) * 1.3 + sin(vL.z * 5.0 + 1.0)))), 22.0);
  float vein2 = pow(max(0.0, 1.0 - abs(sin(vL.x * 9.0 + vL.z * 4.0 + sin(vL.y * 5.0 - time * 0.3) * 1.6))), 30.0);
  col += rimCol * (vein * 0.9 + vein2 * 0.5) * veinI * (0.4 + 0.6 * heartI);
  vec2 sp = vec2(atan(vL.z, vL.x) * 5.0, vL.y * 9.0);
  vec2 cell = fract(sp) - 0.5;
  float spot = smoothstep(0.18, 0.04, length(cell)) * step(0.55, fract(sin(dot(floor(sp), vec2(12.9898, 78.233))) * 43758.5));
  col += rimCol * spot * spotI * (0.5 + 0.5 * sin(time * 2.3 + dot(floor(sp), vec2(3.1, 1.7)))) * 2.5;
  col += rimCol * rimI * fres * 1.1;
  float a = mix(0.62, 1.0, fres) * alpha;
  gl_FragColor = vec4(applyFog(col, length(camPos - vW)), a);
}`;

export function makeCreature(world) {
  const U = world.U;
  const group = new THREE.Group();
  const S = {
    heartPos: { value: V() }, heartCol: { value: ORANGE.clone() }, heartI: { value: 1 },
    rimCol: { value: CYAN.clone() }, rimI: { value: 1 }, ambI: { value: 0.3 }, spotI: { value: 1 },
  };
  const common = { fogColor: U.fogColor, fogDensity: U.fogDensity, time: U.time, camPos: U.camPos, ...S };

  // heart (the kernel)
  const heart = new THREE.Group(); heart.position.set(0, 1.1, 0);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), coreMat);
  const hotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
  const hot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), hotMat);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
  const rings = [0.52, 0.62, 0.72].map((r) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 128), ringMat); heart.add(m); return m; });
  heart.add(core, hot);
  group.add(heart);

  // mantle
  const mantleMat = new THREE.ShaderMaterial({
    uniforms: { ...common, breathe: { value: 0 }, veinI: { value: 1 }, alpha: { value: 1 } },
    vertexShader: MANTLE_VS, fragmentShader: MANTLE_FS, transparent: true, depthWrite: false, fog: false,
  });
  const mantle = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mantleMat);
  mantle.renderOrder = 2; mantle.frustumCulled = false;
  group.add(mantle);

  // tentacles
  const tents = [];
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...common, pulseCol: { value: CYAN.clone() }, tipI: { value: 0 }, seed: { value: hash(i + 3) }, reachGlow: { value: 0 },
        pulses: { value: new Array(6).fill(-5) }, pulseG: { value: new Array(6).fill(0) },
      },
      vertexShader: TENT_VS, fragmentShader: TENT_FS, fog: false,
    });
    const mesh = new THREE.Mesh(tentacleGeometry(), mat); mesh.frustumCulled = false;
    group.add(mesh); tents.push(mesh);
  }

  // halo (volumetric glow around the heart)
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { I: { value: 1 }, cA: { value: ORANGE.clone() }, cB: { value: CYAN.clone() } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float I; uniform vec3 cA, cB; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0;
      vec3 c = cA * (exp(-d*d*30.0) * 0.55 + exp(-d*d*7.0) * 0.1) + cB * exp(-d*d*2.5) * 0.025;
      gl_FragColor = vec4(c * I * smoothstep(1.0, 0.7, d), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat);
  halo.renderOrder = 5; halo.frustumCulled = false;
  group.add(halo);

  // scratch buffers
  const P = Array.from({ length: NR }, () => V());
  const Tn = Array.from({ length: NR }, () => V());
  const tmp = V(), tmp2 = V(), side = V(), dir = V(), nrm = V(), bin = V(), axis2 = V(), q = new THREE.Quaternion();

  function path(i, st, t) {
    const a = (i / 8) * TAU + 0.35 + (st.twist ?? 0);
    const ca = Math.cos(a), sa = Math.sin(a);
    const root = V(ca * 0.42, 0.25, sa * 0.42);
    dir.set(ca, -(st.droop ?? 0.5), sa).normalize();
    side.set(-sa, 0, ca); // tangential axis
    const L = Math.max(0.05, st.len ?? 4);
    const ds = L / (NR - 1);
    const ph = (st.phase ?? 0) + i * 1.7;
    const curl = st.curl ?? 0.4, wave = st.wave ?? 0.4, spd = st.speed ?? 1;
    const p = root.clone();
    for (let r = 0; r < NR; r++) {
      const u = r / (NR - 1);
      P[r].copy(p);
      const k1 = curl * (0.2 + 3.2 * u * u * u) + wave * Math.sin(u * 7 - t * 1.6 * spd + ph);
      const k2 = wave * 0.7 * Math.sin(u * 5 + t * 1.1 * spd + ph * 1.7);
      q.setFromAxisAngle(side, k1 * ds); dir.applyQuaternion(q);
      axis2.crossVectors(side, dir).normalize();
      q.setFromAxisAngle(axis2, k2 * ds); dir.applyQuaternion(q);
      p.addScaledVector(dir, ds);
    }
    const reach = st.reach ?? 0;
    if (reach > 0 && st.target) {
      const e = st.ext ?? 1;
      const tg = st.target; tmp.subVectors(tg, root);
      const D = tmp.length();
      tmp2.crossVectors(tmp, V(0, 1, 0)); if (tmp2.lengthSq() < 1e-6) tmp2.set(1, 0, 0); tmp2.normalize();
      const up = V().crossVectors(tmp2, tmp).normalize();
      for (let r = 0; r < NR; r++) {
        const u = r / (NR - 1);
        const s = u * e;
        const w = Math.sin(Math.PI * s) * (st.sag ?? 0.12) * D;
        const wv = Math.sin(u * 9 - t * 3 + ph) * 0.03 * D * (1 - e * 0.7) * u;
        const Q = root.clone().addScaledVector(tmp, s).addScaledVector(up, w).addScaledVector(tmp2, wv);
        // near the root, keep the organic launch direction
        P[r].lerp(Q, reach * clamp(0.35 + u * 3));
      }
    }
    return root;
  }

  function buildTent(mesh, st, t, i) {
    path(i, st, t);
    const pos = mesh.geometry.attributes.position.array, nor = mesh.geometry.attributes.normal.array;
    for (let r = 0; r < NR; r++) {
      const a = P[Math.max(0, r - 1)], b = P[Math.min(NR - 1, r + 1)];
      Tn[r].subVectors(b, a).normalize();
    }
    nrm.crossVectors(Tn[0], V(0, 1, 0)); if (nrm.lengthSq() < 1e-6) nrm.set(1, 0, 0); nrm.normalize();
    nrm.crossVectors(nrm, Tn[0]).normalize();
    const R0 = st.radius ?? 0.2;
    for (let r = 0; r < NR; r++) {
      const u = r / (NR - 1);
      const T_ = Tn[r];
      nrm.addScaledVector(T_, -nrm.dot(T_)).normalize();
      bin.crossVectors(T_, nrm);
      const rad = R0 * (Math.pow(1 - u, 0.85) * 0.94 + 0.06) * (1 + 0.5 * Math.exp(-u * 18));
      for (let s = 0; s <= NS; s++) {
        const th = (s / NS) * TAU;
        const cx = Math.cos(th), sx = Math.sin(th);
        const nx = nrm.x * cx + bin.x * sx, ny = nrm.y * cx + bin.y * sx, nz = nrm.z * cx + bin.z * sx;
        const k = (r * (NS + 1) + s) * 3;
        pos[k] = P[r].x + nx * rad; pos[k + 1] = P[r].y + ny * rad; pos[k + 2] = P[r].z + nz * rad;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.attributes.normal.needsUpdate = true;
  }

  const tip = (i) => group.localToWorld(P[NR - 1].clone());
  const tips = [];

  return {
    group, heart, mantle, tents, halo, S, coreMat, hotMat,
    // st: { heartI, rimI, ambI, spotI, veinI, breathe, haloI, haloScale, spin, tent(i) → tentacle state, pulses(i) → [[u,g],...], pulseCol, tipI, cam }
    update(t, cam, st = {}) {
      group.updateMatrixWorld(true);
      S.heartI.value = st.heartI ?? 1; S.rimI.value = st.rimI ?? 1; S.ambI.value = st.ambI ?? 0.3; S.spotI.value = st.spotI ?? 1;
      heart.getWorldPosition(S.heartPos.value);
      const hI = st.heartI ?? 1;
      coreMat.color.copy(ORANGE).multiplyScalar(1.4 * hI);
      hotMat.color.setRGB(1, 0.6, 0.35).multiplyScalar(2.2 * hI);
      ringMat.color.copy(CYAN).multiplyScalar(1.6 * (st.ringI ?? 1));
      const spin = st.spin ?? t;
      core.rotation.set(spin * 0.7, spin * 1.1, 0);
      rings[0].rotation.set(spin * 0.9, 0.3, 0); rings[1].rotation.set(1.2, spin * 1.3, 0.2); rings[2].rotation.set(spin * 0.5 + 0.6, 1.9, spin * 0.8);
      heart.scale.setScalar(1 + (st.beat ?? 0) * 0.18);
      mantleMat.uniforms.breathe.value = st.breathe ?? 0;
      mantleMat.uniforms.veinI.value = st.veinI ?? 1;
      mantleMat.uniforms.alpha.value = st.mantleA ?? 1;
      mantle.visible = (st.mantleA ?? 1) > 0.01;
      halo.position.copy(heart.position);
      halo.quaternion.copy(group.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(cam.quaternion));
      halo.scale.setScalar(st.haloScale ?? 7);
      haloMat.uniforms.I.value = st.haloI ?? 1;
      tips.length = 0;
      for (let i = 0; i < 8; i++) {
        const ts = st.tent ? st.tent(i) : {};
        const m = tents[i];
        m.visible = (ts.len ?? 4) > 0.06 || (ts.reach ?? 0) > 0;
        buildTent(m, ts, t, i);
        tips.push(tip(i));
        const u = m.material.uniforms;
        const pl = st.pulses ? st.pulses(i) : [];
        for (let j = 0; j < 6; j++) { u.pulses.value[j] = pl[j] ? pl[j][0] : -5; u.pulseG.value[j] = pl[j] ? pl[j][1] : 0; }
        u.pulseCol.value.copy(ts.pulseCol ?? st.pulseCol ?? CYAN);
        u.tipI.value = ts.tipI ?? st.tipI ?? 0.3;
        u.reachGlow.value = ts.reachGlow ?? 0;
      }
    },
    tips,
    tipAt: (i) => tips[i],
    heartWorld: () => S.heartPos.value.clone(),
  };
}

// kick pulses → travelling bands along tentacles
export function pulseList(t, speed = 0.9, win = 1.6, list = HITS, delay = 0) {
  return recent(t - delay, win, list).slice(-6).map((h) => [(t - delay - h[0]) * speed, h[1]]);
}

// ---------------------------------------------------------------- type
// A line of 3D glyphs with per-glyph materials so we can stagger reveals.
export function makeLine(ctx, font, str, { size = 1, depth = 0.04, tracking = 0.08, color = ICE, intensity = 1, bevel = false, curve = 6 } = {}) {
  const group = new THREE.Group();
  const gl = ctx.glyphs3d(font, str, { size, depth, tracking, bevel, curveSegments: curve, bevelSize: size * 0.01, bevelThickness: size * 0.01 });
  const items = gl.map((g, k) => {
    const mat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity), transparent: true, opacity: 1, fog: true, depthWrite: false });
    const m = new THREE.Mesh(g.geo, mat); m.position.x = g.x; group.add(m);
    return { m, x: g.x, k, ch: g.ch };
  });
  let minX = Infinity, maxX = -Infinity; for (const g of gl) { minX = Math.min(minX, g.x); maxX = Math.max(maxX, g.x); }
  const base = color.clone();
  return {
    group, items, width: maxX - minX + size,
    // reveal: p in 0..1 across glyphs with stagger; out in 0..1 fades
    set(p, { stagger = 0.5, rise = 0.25, out = 0, intensity: I = intensity, col = base, blur = 0 } = {}) {
      const n = items.length;
      for (const it of items) {
        const k0 = n > 1 ? (it.k / (n - 1)) * stagger : 0;
        const a = clamp((p - k0) / (1 - stagger + 1e-6));
        const e = ease.outCubic(a);
        const o = ease.inCubic(clamp(out));
        it.m.material.opacity = e * (1 - o);
        it.m.material.color.copy(col).multiplyScalar(I * (1 + (1 - e) * 2));
        it.m.position.y = (1 - e) * -rise * size + o * rise * size * 0.5;
        it.m.position.z = (1 - e) * -blur;
        it.m.visible = it.m.material.opacity > 0.002;
      }
    },
  };
}

// Place an object in front of the camera (camera-space offset), keeping it facing the camera.
export function placeInView(obj, cam, x, y, dist, tilt = [0, 0, 0]) {
  const f = V(0, 0, -1).applyQuaternion(cam.quaternion);
  const r = V(1, 0, 0).applyQuaternion(cam.quaternion);
  const u = V(0, 1, 0).applyQuaternion(cam.quaternion);
  obj.position.copy(cam.position).addScaledVector(f, dist).addScaledVector(r, x).addScaledVector(u, y);
  obj.quaternion.copy(cam.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...tilt)));
}

// ---------------------------------------------------------------- HUD helpers
export const HUDC = { ice: 'rgba(214,246,255,', orange: 'rgba(255,122,48,', cyan: 'rgba(88,228,255,' };
export function hudText(h, str, x, y, { font = '400 18px Plex', color = 'rgba(214,246,255,0.85)', align = 'left', spacing = 0 } = {}) {
  h.font = font; h.fillStyle = color; h.textAlign = align; h.textBaseline = 'alphabetic';
  if (spacing) { try { h.letterSpacing = spacing + 'px'; } catch (e) { /* ignore */ } }
  h.fillText(str, x, y);
  if (spacing) { try { h.letterSpacing = '0px'; } catch (e) { /* ignore */ } }
}
// typewriter substring, deterministic
export function typed(str, p) { return str.slice(0, Math.floor(clamp(p) * str.length + 1e-6)); }

export { clamp, lerp, prog, ease, hash, mulberry32 };
