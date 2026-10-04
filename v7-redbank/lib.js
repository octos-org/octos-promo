// COSMOS — building blocks: night sky (Milky Way shader, instanced stars), terrain, the observatory dome +
// telescope + guide-star laser, the survey tile field on the celestial sphere, weather, a completion ping. Pure functions of t.
import * as THREE from 'three';
import { clamp, lerp, prog, ease, hash, keys, mulberry32 } from '../engine/util.js';

export const TAU = Math.PI * 2, DEG = Math.PI / 180;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const STAR = new THREE.Color(0.86, 0.92, 1.0);
export const SODIUM = new THREE.Color(1.0, 0.58, 0.18);
export const COOL = new THREE.Color(0.55, 0.75, 1.0);

// sky direction from azimuth (0 = -z, + toward +x) and elevation, degrees
export function dirAE(az, el) {
  const a = az * DEG, e = el * DEG;
  return V(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}
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
export const NOISE = /* glsl */`
float h13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x), mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x), mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm(vec3 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+17.1; a*=.5;} return s; }
`;
// cloud blobs in (az, el) degrees: vec4(az, el, sx, sy)
export const NBLOB = 7;
const CLOUD = /* glsl */`
uniform vec4 blobs[${NBLOB}]; uniform float cloudOn;
float cloudAt(vec2 ae){ float s = 0.;
  for (int i=0;i<${NBLOB};i++){ vec4 b = blobs[i]; vec2 q = (ae - b.xy) / b.zw; s += exp(-dot(q,q)); }
  return clamp(s, 0., 1.) * cloudOn; }
`;
export function cloudAtJS(blobs, az, el, on = 1) {
  let s = 0;
  for (const b of blobs) { const qx = (az - b[0]) / b[2], qy = (el - b[1]) / b[3]; s += Math.exp(-(qx * qx + qy * qy)); }
  return clamp(s) * on;
}

// ---------------------------------------------------------------- sky: env + Milky Way + stars
export const MW_N = V(0.735, -0.443, -0.513).normalize();                 // galactic pole
export const MW_C = (() => { const c = V(-0.45, 0.12, -0.88); c.addScaledVector(MW_N, -c.dot(MW_N)); return c.normalize(); })();

export function makeSky(scene) {
  const U = { time: { value: 0 }, skyI: { value: 1 }, mwI: { value: 1 }, starI: { value: 1 }, horizon: { value: new THREE.Color(0.0065, 0.013, 0.032) } };
  const envMat = new THREE.ShaderMaterial({
    uniforms: { ...U, mwN: { value: MW_N }, mwC: { value: MW_C } },
    vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix*viewMatrix*vec4(cameraPosition + position, 1.0); gl_Position = p; gl_Position.z = p.w*0.99999; }`,
    fragmentShader: `uniform float time, skyI, mwI; uniform vec3 mwN, mwC, horizon; varying vec3 vD; ${NOISE}
      void main(){ vec3 d = normalize(vD); float el = d.y;
        vec3 zen = vec3(0.0012,0.0022,0.0065);
        vec3 col = mix(horizon, zen, smoothstep(-0.02, 0.55, el));
        col += vec3(0.004,0.010,0.018)*exp(-max(el,0.)*10.);
        float b = dot(d, mwN);
        vec3 inPlane = normalize(d - mwN*b + 1e-5);
        float core = pow(max(dot(inPlane, mwC), 0.), 2.2);
        float w = 0.085 + 0.09*core;
        float band = exp(-b*b/(w*w));
        float n1 = fbm(d*5.0 + 2.0), n2 = fbm(d*16.0 + 7.0), n3 = fbm(d*34.0);
        float glow = band * (0.25 + 1.1*n1) * (0.55 + 0.6*n2) * (0.35 + 2.2*core);
        glow += exp(-b*b/(0.35*0.35)) * 0.06 * (0.5 + n1);
        float lane = smoothstep(0.42, 0.72, fbm(d*7.0 + 11.0 + vec3(0.0, n3*0.4, 0.0))) * exp(-((b - 0.012)/(0.03+0.03*core))*((b - 0.012)/(0.03+0.03*core)));
        glow *= 1.0 - 0.85*lane;
        vec3 mwc = mix(vec3(0.50,0.62,0.95), vec3(1.0,0.78,0.52), core*0.75);
        col += mwc * glow * 0.075 * mwI;
        col += vec3(0.7,0.8,1.0) * pow(n3, 6.0) * band * 0.05 * mwI;
        gl_FragColor = vec4(col * skyI, 1.0); }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  });
  const env = new THREE.Mesh(new THREE.SphereGeometry(10, 96, 48), envMat);
  env.renderOrder = -10; env.frustumCulled = false; env.name = 'env'; scene.add(env);

  // stars: field stars + a dense faint Milky Way population, as directions
  const rnd = mulberry32(2026);
  const NF = 9000, NM = 55000, N = NF + NM;
  const dir = new Float32Array(N * 3), inf = new Float32Array(N * 4);
  const tmp = V(), e1 = V().crossVectors(MW_N, MW_C).normalize();
  const nz = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
  const vn = (x, y, z) => { // cheap smooth-ish noise for clumping
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z); let s = 0;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      const w = (1 - Math.abs(x - fx - i)) * (1 - Math.abs(y - fy - j)) * (1 - Math.abs(z - fz - k)); s += w * nz(fx + i, fy + j, fz + k);
    } return s;
  };
  for (let i = 0; i < N; i++) {
    let mag, bv;
    if (i < NF) {
      const u = rnd() * 2 - 1, a = rnd() * TAU, r = Math.sqrt(1 - u * u);
      tmp.set(r * Math.cos(a), u, r * Math.sin(a));
      mag = 7.2 - 8.4 * Math.pow(rnd(), 5.5);
    } else {
      let ok = false, guard = 0;
      while (!ok && guard++ < 20) {
        const L = rnd() * TAU, g = () => (rnd() + rnd() + rnd() - 1.5) * 0.9;
        const core = Math.pow(Math.max(0, Math.cos(L)), 2.2);
        const bb = g() * (0.07 + 0.08 * core);
        tmp.copy(MW_C).multiplyScalar(Math.cos(L)).addScaledVector(e1, Math.sin(L)).multiplyScalar(Math.cos(bb)).addScaledVector(MW_N, Math.sin(bb)).normalize();
        ok = rnd() < 0.25 + 0.75 * vn(tmp.x * 7 + 3, tmp.y * 7, tmp.z * 7) * (0.6 + core);
      }
      mag = 6.8 + 2.2 * rnd();
    }
    bv = rnd();
    dir[i * 3] = tmp.x; dir[i * 3 + 1] = tmp.y; dir[i * 3 + 2] = tmp.z;
    inf[i * 4] = mag; inf[i * 4 + 1] = bv; inf[i * 4 + 2] = rnd(); inf[i * 4 + 3] = i < NF ? 0 : 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(dir, 3));
  g.setAttribute('aInf', new THREE.BufferAttribute(inf, 4));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { ...U, pix: { value: 1 } },
    vertexShader: `attribute vec4 aInf; uniform float time, starI, pix; varying vec3 vC; varying float vA;
      void main(){
        vec3 d = normalize(position);
        vec4 p = projectionMatrix*viewMatrix*vec4(cameraPosition + d*4000.0, 1.0);
        gl_Position = p;
        float flux = pow(10.0, -0.4*aInf.x);
        float tw = 1.0 + 0.45*sin(time*(3.0+7.0*aInf.z) + aInf.z*91.0)*smoothstep(0.5, 0.0, d.y);
        float px = clamp(1.5 + 30.0*pow(flux, 0.55), 1.5, 15.0) * pix;
        gl_PointSize = px;
        vA = clamp(flux * 9.0, 0.0, 1.0) * mix(1.0, 0.55, aInf.w) * tw * starI * smoothstep(-0.02, 0.06, d.y) * (0.35 + 0.65*clamp(pix, 0.0, 1.0));
        vA *= min(1.0, 1.6 / px * 1.6);
        vec3 hot = vec3(0.70,0.80,1.0), sun = vec3(1.0,0.93,0.82), red = vec3(1.0,0.72,0.50);
        vC = aInf.y < 0.35 ? hot : (aInf.y < 0.85 ? mix(hot, sun, (aInf.y-0.35)/0.5) : red);
        vC *= 1.0 + 3.0*clamp(flux - 0.05, 0.0, 1.0);
      }`,
    fragmentShader: `varying vec3 vC; varying float vA;
      void main(){ vec2 q = gl_PointCoord - 0.5; float r2 = dot(q,q)*4.0; float a = exp(-r2*4.0) + 0.25*exp(-r2*1.2);
        float sp = exp(-abs(q.x)*40.0)*exp(-abs(q.y)*5.0) + exp(-abs(q.y)*40.0)*exp(-abs(q.x)*5.0);
        a = (a + sp*0.3) * vA; if (a < 0.002) discard; gl_FragColor = vec4(vC*a, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false,
  });
  const stars = new THREE.Points(g, starMat); stars.frustumCulled = false; stars.renderOrder = -5;
  stars.name='stars'; scene.add(stars);
  return {
    env, stars, U,
    update(t, p = {}) {
      U.time.value = t;
      U.skyI.value = p.skyI ?? 1; U.mwI.value = p.mwI ?? 1; U.starI.value = p.starI ?? 1;
      starMat.uniforms.pix.value = p.pix ?? 1;
    },
  };
}

// ---------------------------------------------------------------- terrain
export function makeGround(scene) {
  const U = { warm: { value: 0 }, haze: { value: new THREE.Color(0.012, 0.024, 0.05) }, domePos: { value: V(0, 0, 0) } };
  const hgt = (x, z) => {
    const r = Math.hypot(x, z);
    const hill = -0.012 * Math.max(0, r - 7) ** 1.35;
    const n = Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.043) * 1.2 + Math.sin(x * 0.013 - z * 0.017) * 4;
    return hill + n * clamp((r - 10) / 40);
  };
  const g = new THREE.PlaneGeometry(1600, 1600, 240, 240); g.rotateX(-Math.PI / 2);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), z = pa.getZ(i);
    // non-uniform: denser near dome
    pa.setY(i, hgt(x, z));
  }
  g.computeVertexNormals();
  // far ridge: a ring of mountains
  const ridge = new THREE.CylinderGeometry(700, 700, 1, 512, 1, true);
  const rp = ridge.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), z = rp.getZ(i), y = rp.getY(i);
    const a = Math.atan2(z, x);
    let h = 0; for (let o = 0; o < 5; o++) h += Math.abs(Math.sin(a * (3 + o * 4.1) + o * 1.7 + Math.sin(a * 2 + o))) * (40 / (o + 1));
    rp.setY(i, y > 0 ? -12 + h * 1.1 : -60);
  }
  ridge.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float warm; uniform vec3 haze, domePos; varying vec3 vW; varying vec3 vN;
      void main(){
        float d = length(vW - cameraPosition);
        vec3 c = vec3(0.004,0.0055,0.008) * (0.5 + 0.5*max(vN.y,0.0));
        float r = length(vW.xz - domePos.xz);
        c += vec3(1.0,0.5,0.18) * warm * (0.10*exp(-r*0.35) + 0.02*exp(-r*0.08));
        c = mix(c, haze, 1.0 - exp(-d*0.0022));
        gl_FragColor = vec4(c, 1.0); }`,
    fog: false,
  });
  const ground = new THREE.Mesh(g, mat);
  const mount = new THREE.Mesh(ridge, mat);
  ground.name='ground'; mount.name='ridge'; scene.add(ground, mount);
  return { U, hgt, update(p = {}) { U.warm.value = p.warm ?? 0; } };
}

// ---------------------------------------------------------------- observatory
export const PIVOT = V(0, 4.55, 0);
export function makeObservatory(scene) {
  const U = { slit: { value: 0 }, interior: { value: 0 }, moonDir: { value: V(-0.5, 0.6, 0.6).normalize() }, sky: { value: new THREE.Color(0.05, 0.09, 0.18) }, time: { value: 0 } };
  const domeFrag = (isBase) => `uniform float slit, interior, time; uniform vec3 moonDir, sky; varying vec3 vL, vN, vW;
    void main(){
      vec3 q = vL - vec3(0.0, 3.0, 0.0);
      ${isBase ? '' : 'if (abs(q.x) < slit && q.z < 1.3 && q.y > 0.5) discard;'}
      vec3 n = normalize(vN);
      vec3 warm = vec3(1.0, 0.55, 0.2);
      if (gl_FrontFacing) {
        vec3 V = normalize(cameraPosition - vW);
        float dif = max(dot(n, moonDir), 0.0);
        float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        float az = atan(q.x, q.z);
        float rib = ${isBase ? '0.0' : 'smoothstep(0.93, 1.0, abs(cos(az*10.0)))'};
        float ring = ${isBase ? 'smoothstep(0.9,1.0, abs(sin(vL.y*3.1416*1.0)))' : 'smoothstep(0.96, 1.0, abs(cos(asin(clamp(q.y/4.0,0.,1.))*9.0)))'};
        vec3 c = vec3(0.05, 0.06, 0.075) * (0.18 + 0.9*dif) * (1.0 - 0.35*rib - 0.2*ring);
        c += sky * fr * 0.9;
        c += vec3(0.6,0.7,0.9) * pow(max(dot(reflect(-V, n), moonDir), 0.0), 40.0) * 0.08;
        ${isBase ? `float da = atan(vL.x, vL.z); float door = smoothstep(0.11, 0.095, abs(da - 0.62)) * step(vL.y, 1.9);
          c = mix(c, warm * (0.9 + 0.1*sin(time*1.3)) * 1.1, door * interior);` : `
          float e = abs(q.x) - slit; float edge = exp(-max(e,0.0)*5.0) * step(q.z, 1.3) * step(0.5, q.y) * step(0.001, slit);
          c += warm * edge * interior * 0.35;`}
        gl_FragColor = vec4(c, 1.0);
      } else {
        float h = clamp(vL.y / 7.0, 0.0, 1.0);
        gl_FragColor = vec4(warm * interior * (0.15 + 0.55*h), 1.0);
      }
    }`;
  const vert = `varying vec3 vL, vN, vW; void main(){ vL = position; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`;
  const domeMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: vert, fragmentShader: domeFrag(false), side: THREE.DoubleSide, fog: false });
  const baseMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: vert, fragmentShader: domeFrag(true), side: THREE.DoubleSide, fog: false });
  const domeGeo = new THREE.SphereGeometry(4, 96, 48, 0, TAU, 0, Math.PI / 2); domeGeo.translate(0, 3, 0);
  const baseGeo = new THREE.CylinderGeometry(4.05, 4.2, 3, 96, 1, true); baseGeo.translate(0, 1.5, 0);
  const dome = new THREE.Mesh(domeGeo, domeMat); dome.name = 'dome';
  const base = new THREE.Mesh(baseGeo, baseMat);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.006, 0.007, 0.01) }));
  plinth.position.y = 0.0;
  base.name='base'; plinth.name='plinth'; scene.add(dome, base, plinth);

  // telescope
  const tel = new THREE.Group(); tel.position.copy(PIVOT); scene.add(tel);
  const metal = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.45, metalness: 0.6 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 4.6, 48, 1, true), metal); tube.position.y = 1.1;
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide });
  tube.material = trussMat;
  const apMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.85, 0.35) });
  const aperture = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 48), apMat); aperture.rotation.x = Math.PI / 2; aperture.position.y = 3.4;
  const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.68, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.3, 0.45) })); mirror.rotation.x = -Math.PI / 2; mirror.position.y = -1.1;
  tel.add(tube, aperture, mirror); tel.name='tel';
  const fork = new THREE.Group(); fork.position.copy(PIVOT); scene.add(fork); fork.name='fork';
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.0, 0.7), metal); arm.position.set(s * 1.0, -0.4, 0); fork.add(arm); }
  const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.2, 24), metal); pier.position.set(0, -1.9, 0); fork.add(pier);
  const lamp = new THREE.PointLight(0xff9a40, 0, 12, 1.2); lamp.position.set(0, 1.2, 0.5); scene.add(lamp);
  const hemi = new THREE.HemisphereLight(0x3050a0, 0x000000, 0.15); scene.add(hemi);

  // guide-star laser: camera-facing strip from A to B
  const beamU = { A: { value: V() }, B: { value: V() }, I: { value: 0 }, width: { value: 0.12 }, col: { value: SODIUM.clone() } };
  const bg = new THREE.PlaneGeometry(1, 1, 1, 64); bg.translate(0.5, 0.5, 0);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: beamU,
    vertexShader: `uniform vec3 A, B; uniform float width; varying vec2 vUv;
      void main(){ vUv = uv; vec3 ax = B - A; vec3 p = A + ax*uv.y;
        vec3 cr = cross(ax, cameraPosition - p); vec3 side = cr / max(length(cr), 1e-4);
        float w = width * (1.0 + uv.y*6.0);
        p += side * (uv.x - 0.5) * w;
        gl_Position = projectionMatrix*viewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform float I; uniform vec3 col; varying vec2 vUv;
      void main(){ float x = (vUv.x-0.5)*2.0; float a = exp(-x*x*6.0) + 0.6*exp(-x*x*60.0);
        float along = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.6) * 0.9 + 0.1;
        gl_FragColor = vec4(col * a * along * I, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const beam = new THREE.Mesh(bg, beamMat); beam.frustumCulled = false; beam.renderOrder = 4; beam.name='beam'; scene.add(beam);

  const up = V(0, 1, 0), q = new THREE.Quaternion();
  return {
    U, dome, base, tel, beamU, lamp,
    // p: { domeAz (deg), slit (0..1), interior, aim: Vector3 dir, beamI, beamLen }
    update(t, p = {}) {
      U.time.value = t;
      dome.rotation.y = -(p.domeAz ?? 0) * DEG;
      U.slit.value = (p.slit ?? 0) * 1.05;
      U.interior.value = p.interior ?? 0;
      const aim = (p.aim ?? V(0, 1, 0)).clone().normalize();
      q.setFromUnitVectors(up, aim); tel.quaternion.copy(q);
      fork.rotation.y = Math.atan2(aim.x, aim.z);
      lamp.intensity = 6 * (p.interior ?? 0);
      apMat.color.setRGB(1.6, 0.85, 0.35).multiplyScalar(0.3 + 0.7 * (p.interior ?? 0) + (p.beamI ?? 0));
      const A = PIVOT.clone().addScaledVector(aim, 0.95);
      beamU.A.value.copy(A);
      beamU.B.value.copy(A).addScaledVector(aim, p.beamLen ?? 118);
      beamU.I.value = p.beamI ?? 0;
      beam.visible = (p.beamI ?? 0) > 0.001;
    },
  };
}

// ---------------------------------------------------------------- survey field on the celestial sphere
export const RS = 118;
export const FIELD = { regions: 8, cols: 3, rows: 6, cell: 3.6, el0: 19, gap: 1.1 };
export function tileAE(reg, c, r) {
  const col = reg * FIELD.cols + c, n = FIELD.regions * FIELD.cols;
  return [(col - (n - 1) / 2) * FIELD.cell + (reg - (FIELD.regions - 1) / 2) * FIELD.gap, FIELD.el0 + r * FIELD.cell];
}
export function tilePos(az, el, r = RS) { return PIVOT.clone().addScaledVector(dirAE(az, el), r); }

export function makeField(scene) {
  const tiles = [];
  const rnd = mulberry32(417);
  for (let reg = 0; reg < FIELD.regions; reg++) for (let r = 0; r < FIELD.rows; r++) for (let c = 0; c < FIELD.cols; c++) {
    const [az, el] = tileAE(reg, c, r);
    tiles.push({ i: tiles.length, reg, c, r, az, el, req: rnd() < 0.28 ? 1 : 0, seed: rnd(), obsT: 1e6, tooT: 1e6, nova: 0 });
  }
  const n = tiles.length;
  const geo = new THREE.PlaneGeometry(1, 1);
  const U = { time: { value: 0 }, gridA: { value: 0 }, blobs: { value: [...Array(NBLOB)].map(() => new THREE.Vector4(0, -90, 1, 1)) }, cloudOn: { value: 0 }, reveal: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `attribute vec4 aInfo; attribute vec3 aAE; varying vec2 vUv; varying vec4 vInfo; varying vec3 vAE;
      void main(){ vUv = uv; vInfo = aInfo; vAE = aAE; gl_Position = projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float time, gridA, reveal; varying vec2 vUv; varying vec4 vInfo; varying vec3 vAE; ${CLOUD}
      void main(){
        vec2 p = vUv*2.0 - 1.0;
        float req = vInfo.x;
        float d = req > 0.5 ? (abs(p.x)+abs(p.y))*0.62 : max(abs(p.x),abs(p.y));
        float fw = fwidth(d)*1.2;
        float outline = smoothstep(0.06+fw, 0.06-fw*0.2, abs(d-0.84));
        float inside = smoothstep(0.84+fw, 0.84-fw, d);
        float since = time - vInfo.y;
        float obs = since > 0.0 ? smoothstep(0.0, 0.22, since) : 0.0;
        float flash = since > 0.0 ? exp(-since*2.6) : 0.0;
        vec3 cool = vec3(0.50,0.72,1.0), warm = vec3(1.0,0.60,0.22);
        float rv = smoothstep(0.0, 0.15, reveal - vAE.z);
        vec3 c = cool*outline*(0.30 + 0.25*req)*rv;
        c += cool*inside*obs*(0.16 + 0.06*sin(vAE.z*40.0));
        c += warm*(inside*0.9 + outline*2.2)*flash;
        float tooS = time - vInfo.z;
        if (tooS > 0.0) {
          float pend = 1.0 - obs;
          float pulse = 0.5 + 0.5*cos(tooS*9.0);
          c += vec3(1.0,0.32,0.12)*(outline*2.4 + inside*0.25)*pend*(0.35 + 0.65*pulse);
          c += vec3(1.0,0.45,0.2)*inside*obs*0.25;
        }
        float cl = cloudAt(vAE.xy);
        c *= gridA * (1.0 - 0.9*cl);
        gl_FragColor = vec4(c, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const info = new Float32Array(n * 4), ae = new Float32Array(n * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V();
  const size = 2 * RS * Math.tan((FIELD.cell * 0.9 / 2) * DEG);
  tiles.forEach((tl, i) => {
    const pos = tilePos(tl.az, tl.el);
    const o = new THREE.Object3D(); o.position.copy(pos); o.lookAt(PIVOT); o.updateMatrix();
    s.set(size, size, 1); m4.compose(pos, o.quaternion, s); mesh.setMatrixAt(i, m4);
    tl.pos = pos; tl.quat = o.quaternion.clone(); tl.size = size;
    // reveal order: sweep from the centre outward
    ae[i * 3] = tl.az; ae[i * 3 + 1] = tl.el; ae[i * 3 + 2] = (Math.abs(tl.az) / 50) * 0.8 + tl.seed * 0.2;
  });
  mesh.geometry.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
  mesh.geometry.setAttribute('aAE', new THREE.InstancedBufferAttribute(ae, 3));
  mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name='tiles';
  scene.add(mesh);

  // graticule + region boundaries
  const lp = [], lc = [];
  const push = (a, b, k) => { lp.push(a.x, a.y, a.z, b.x, b.y, b.z); lc.push(k, k, k, k, k, k); };
  const R2 = RS * 1.002;
  for (let el = 0; el <= 75; el += 15) for (let az = -180; az < 180; az += 3) push(tilePos(az, el, R2), tilePos(az + 3, el, R2), 0.35);
  for (let az = -180; az < 180; az += 15) for (let el = 0; el < 88; el += 3) push(tilePos(az, el, R2), tilePos(az, el + 3, R2), 0.35);
  const eTop = FIELD.el0 + (FIELD.rows - 0.5) * FIELD.cell + 1.2, eBot = FIELD.el0 - FIELD.cell / 2 - 1.2;
  for (let reg = 0; reg <= FIELD.regions; reg++) {
    const aL = reg === FIELD.regions ? tileAE(reg - 1, FIELD.cols - 1, 0)[0] + FIELD.cell / 2 + FIELD.gap / 2 : tileAE(reg, 0, 0)[0] - FIELD.cell / 2 - FIELD.gap / 2;
    for (let el = eBot; el < eTop - 0.01; el += 1) push(tilePos(aL, el, R2), tilePos(aL, Math.min(eTop, el + 1), R2), 1.0);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lg.setAttribute('aK', new THREE.Float32BufferAttribute(lc, 1));
  const lineMat = new THREE.ShaderMaterial({
    uniforms: { gridA: { value: 0 }, lineA: { value: 0 } },
    vertexShader: `attribute float aK; varying float vK; void main(){ vK = aK; gl_Position = projectionMatrix*viewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float gridA, lineA; varying float vK; void main(){ float k = vK > 0.5 ? gridA*0.22 : lineA*0.07; gl_FragColor = vec4(vec3(0.45,0.62,1.0)*k, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const lines = new THREE.LineSegments(lg, lineMat); lines.frustumCulled = false; lines.renderOrder = 1; lines.name='lines';
  scene.add(lines);

  return {
    tiles, mesh, U, lineMat,
    commit() {
      tiles.forEach((tl, i) => { info[i * 4] = tl.req; info[i * 4 + 1] = tl.obsT; info[i * 4 + 2] = tl.tooT; info[i * 4 + 3] = tl.nova; });
      mesh.geometry.attributes.aInfo.needsUpdate = true;
    },
    update(t, p = {}) {
      U.time.value = t; U.gridA.value = p.gridA ?? 1; U.reveal.value = p.reveal ?? 2; U.cloudOn.value = p.cloudOn ?? 0;
      lineMat.uniforms.gridA.value = p.gridA ?? 1; lineMat.uniforms.lineA.value = p.lineA ?? 0;
      if (p.blobs) p.blobs.forEach((b, i) => U.blobs.value[i].set(...b));
      mesh.visible = lines.visible = (p.gridA ?? 1) > 0.002 || (p.lineA ?? 0) > 0.002;
    },
  };
}

// ---------------------------------------------------------------- weather: a cloud shell
export function makeClouds(scene, fieldU) {
  const U = { time: { value: 0 }, blobs: fieldU.blobs, cloudOn: fieldU.cloudOn, lit: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float time, lit; varying vec3 vD; ${NOISE} ${CLOUD}
      void main(){ vec3 d = normalize(vD);
        float az = degrees(atan(d.x, -d.z)), el = degrees(asin(clamp(d.y, -1.0, 1.0)));
        float C = cloudAt(vec2(az, el));
        vec3 q = d*7.0 + vec3(-time*0.09, 0.0, time*0.02);
        float n = fbm(q), n2 = fbm(q*2.7 + 4.0);
        float dens = smoothstep(0.18, 0.75, C*(0.45 + 0.9*n) + 0.12*n2 - 0.08);
        if (dens < 0.004) discard;
        vec3 dark = vec3(0.020,0.026,0.038), light = vec3(0.13,0.15,0.20);
        vec3 col = mix(dark, light, clamp(n2*1.3 - 0.2 + (1.0-dens)*0.5, 0.0, 1.0)) * lit;
        col += vec3(0.25,0.12,0.05)*0.12*(1.0 - smoothstep(0.0, 0.5, d.y));
        gl_FragColor = vec4(col, dens*0.94); }`,
    transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
  });
  const sh = new THREE.Mesh(new THREE.SphereGeometry(RS * 0.8, 128, 48, 0, TAU, 0, Math.PI * 0.49), mat);
  sh.position.copy(PIVOT); sh.name = 'clouds'; sh.renderOrder = 6; sh.frustumCulled = false;
  scene.add(sh);
  return { update(t, p = {}) { U.time.value = t; sh.visible = (U.cloudOn.value > 0.001); U.lit.value = p.lit ?? 1; } };
}

// ---------------------------------------------------------------- nova: a flaring point with spikes and a ring
export function makeNova(scene) {
  const U = { I: { value: 0 }, ring: { value: 0 }, ringA: { value: 0 }, col: { value: new THREE.Color(1.0, 0.9, 0.8) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float I, ring, ringA; uniform vec3 col; varying vec2 vUv;
      void main(){ vec2 q = (vUv - 0.5)*2.0; float r = length(q);
        float core = exp(-r*r*900.0)*3.0 + exp(-r*r*120.0)*0.6 + exp(-r*r*12.0)*0.06;
        float sp = (exp(-abs(q.x)*260.0) + exp(-abs(q.y)*260.0)) * exp(-r*3.0) * 0.5;
        float rr = (r - ring)*28.0; float rg = exp(-rr*rr) * ringA;
        vec3 c = col*(core + sp)*I + vec3(1.0,0.55,0.25)*rg*1.2;
        gl_FragColor = vec4(c, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.renderOrder = 5; m.frustumCulled = false; m.name='nova';
  scene.add(m);
  return { mesh: m, U, update(pos, cam, size, p = {}) { m.position.copy(pos); m.quaternion.copy(cam.quaternion); m.scale.setScalar(size); U.I.value = p.I ?? 0; U.ring.value = p.ring ?? 0; U.ringA.value = p.ringA ?? 0; m.visible = (p.I ?? 0) + (p.ringA ?? 0) > 0.001; } };
}

// ---------------------------------------------------------------- 3D type (from v1-abyss)
export function makeLine(ctx, font, str, { size = 1, depth = 0.04, tracking = 0.08, color = STAR, intensity = 1, curve = 6 } = {}) {
  const group = new THREE.Group();
  const gl = ctx.glyphs3d(font, str, { size, depth, tracking, curveSegments: curve });
  const items = gl.map((g, k) => {
    const mat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity), transparent: true, opacity: 1, fog: false, depthWrite: false, depthTest: false });
    const m = new THREE.Mesh(g.geo, mat); m.position.x = g.x; m.renderOrder = 20; group.add(m);
    return { m, x: g.x, k, ch: g.ch };
  });
  let minX = Infinity, maxX = -Infinity; for (const g of gl) { minX = Math.min(minX, g.x); maxX = Math.max(maxX, g.x); }
  const base = color.clone();
  return {
    group, items, width: maxX - minX + size,
    set(p, { stagger = 0.5, rise = 0.25, out = 0, intensity: I = intensity, col = base, spread = 0 } = {}) {
      const n = items.length;
      for (const it of items) {
        const k0 = n > 1 ? (it.k / (n - 1)) * stagger : 0;
        const a = clamp((p - k0) / (1 - stagger + 1e-6));
        const e = ease.outCubic(a);
        const o = ease.inCubic(clamp(out));
        it.m.material.opacity = e * (1 - o);
        it.m.material.color.copy(col).multiplyScalar(I * (1 + (1 - e) * 3));
        it.m.position.y = (1 - e) * -rise * size + o * rise * size * 0.5;
        it.m.position.x = it.x * (1 + spread * (1 - e));
        it.m.visible = it.m.material.opacity > 0.002;
      }
    },
  };
}
export function placeInView(obj, cam, x, y, dist) {
  const f = V(0, 0, -1).applyQuaternion(cam.quaternion), r = V(1, 0, 0).applyQuaternion(cam.quaternion), u = V(0, 1, 0).applyQuaternion(cam.quaternion);
  obj.position.copy(cam.position).addScaledVector(f, dist).addScaledVector(r, x).addScaledVector(u, y);
  obj.quaternion.copy(cam.quaternion);
}

// ---------------------------------------------------------------- HUD helpers
export function hudText(h, str, x, y, { font = '400 18px Plex', color = 'rgba(220,232,255,0.9)', align = 'left', spacing = 0, baseline = 'alphabetic' } = {}) {
  h.font = font; h.fillStyle = color; h.textAlign = align; h.textBaseline = baseline;
  if (spacing) { try { h.letterSpacing = spacing + 'px'; } catch (e) { /* */ } }
  h.fillText(str, x, y);
  const w = h.measureText(str).width;
  if (spacing) { try { h.letterSpacing = '0px'; } catch (e) { /* */ } }
  return w;
}
export function typed(str, p) { const a = [...str]; return a.slice(0, Math.floor(clamp(p) * a.length + 1e-6)).join(''); }
export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(3)})`;
export { clamp, lerp, prog, ease, hash, keys, mulberry32 };
