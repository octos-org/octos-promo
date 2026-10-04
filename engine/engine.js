// Shared three.js engine for the Octos promo versions.
// A version module (vX/video.js) default-exports:
//   { bpm, dur, audio, fonts: {name: '/fonts/x.ttf'}, scenes: [{ name, from, to, make }], post?(t), hud?(ctx2d, f) }
// scene.make(ctx) → { scene: THREE.Scene, camera, update(f) → postOverrides?, hud?(ctx2d, f) }
// Every frame is a pure function of t. The export averages sub-frames (motion blur), in any order.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { frameIdx } from './util.js';

export const W = 1920, H = 1080;

export const POST_DEFAULTS = {
  exposure: 1, bloom: 0.9, bloomRadius: 0.55, bloomThreshold: 0.75,
  ca: 0.0015, grain: 0.05, vignette: 0.55, flash: 0, flashColor: [1, 1, 1], fade: 0,
  zoomBlur: 0, zoomCenter: [0.5, 0.5], shake: [0, 0], invert: 0, saturation: 1, hud: 1,
};

const FINAL_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tAccum, tHud;
uniform float exposure, ca, grain, vignette, flash, fade, zoomBlur, invert, saturation, hudAlpha, frame;
uniform vec3 flashColor;
uniform vec2 zoomCenter, shake, res;
varying vec2 vUv;
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 sampleCA(vec2 u){
  vec2 d = (u - 0.5);
  return vec3(texture2D(tAccum, 0.5 + d*(1.0+ca)).r, texture2D(tAccum, u).g, texture2D(tAccum, 0.5 + d*(1.0-ca)).b);
}
void main(){
  vec2 uv = vUv + shake;
  vec3 col = vec3(0.);
  int n = zoomBlur > 0.0005 ? 24 : 1;
  for (int i = 0; i < 24; i++) {
    if (i >= n) break;
    float s = 1.0 - zoomBlur * float(i) / 23.0;
    col += sampleCA(zoomCenter + (uv - zoomCenter) * s);
  }
  col /= float(n);
  col *= exposure;
  col = aces(col);
  float l = dot(col, vec3(0.2126,0.7152,0.0722));
  col = mix(vec3(l), col, saturation);
  col = pow(col, vec3(1.0/2.2));
  vec2 v = (vUv - 0.5) * vec2(1.25, 1.0);
  col *= mix(1.0, smoothstep(0.95, 0.25, length(v)), vignette);
  col = mix(col, flashColor, clamp(flash, 0., 1.));
  vec4 hd = texture2D(tHud, vUv);
  col = mix(col, hd.rgb, hd.a * hudAlpha);
  col = mix(col, 1.0 - col, invert);
  float g = h12(vUv*res + frame*17.13) - 0.5;
  col += g * grain * (1.0 - 0.6*abs(l*2.0-1.0));
  col *= 1.0 - clamp(fade, 0., 1.);
  col += (h12(vUv*res + 3.7) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
const QUAD_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

export class Engine {
  constructor(canvas, video, base) {
    this.video = video; this.base = base;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1); r.setSize(W, H, false);
    r.outputColorSpace = THREE.LinearSRGBColorSpace; // tone map + sRGB happen in FINAL_FRAG
    r.toneMapping = THREE.NoToneMapping;
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.renderToScreen = false;
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.55, 0.75);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.accumRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
    const quad = new THREE.PlaneGeometry(2, 2);
    this.accumMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, w: { value: 1 } }, vertexShader: QUAD_VERT,
      fragmentShader: 'uniform sampler2D map; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(map, vUv).rgb * w, 1.0); }',
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    this.accumScene = new THREE.Scene(); this.accumScene.add(new THREE.Mesh(quad, this.accumMat));
    this.hudCanvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    this.hud = this.hudCanvas.getContext('2d');
    this.hudTex = new THREE.CanvasTexture(this.hudCanvas);
    this.hudTex.minFilter = THREE.LinearFilter; this.hudTex.generateMipmaps = false;
    const u = (v) => ({ value: v });
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tAccum: u(this.accumRT.texture), tHud: u(this.hudTex), exposure: u(1), ca: u(0), grain: u(0), vignette: u(0),
        flash: u(0), flashColor: u(new THREE.Color()), fade: u(0), zoomBlur: u(0), zoomCenter: u(new THREE.Vector2(0.5, 0.5)),
        shake: u(new THREE.Vector2()), invert: u(0), saturation: u(1), hudAlpha: u(1), frame: u(0), res: u(new THREE.Vector2(W, H)),
      },
      vertexShader: QUAD_VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false,
    });
    this.finalScene = new THREE.Scene(); this.finalScene.add(new THREE.Mesh(quad, this.finalMat));
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.ready = this.init();
  }

  async init() {
    const v = this.video;
    this.fonts = {};
    const ttf = new TTFLoader();
    await Promise.all(Object.entries(v.fonts || {}).map(async ([name, url]) => {
      const ff = new FontFace(name, `url(${url})`); document.fonts.add(await ff.load());
      this.fonts[name] = new Font(await ttf.loadAsync(url));
    }));
    const ctx = {
      THREE, W, H, renderer: this.renderer, fonts: this.fonts, base: this.base, video: v,
      text3d: (font, str, opts) => text3d(this.fonts[font], str, opts),
      glyphs3d: (font, str, opts) => glyphs3d(this.fonts[font], str, opts),
      loadTexture: (p) => new THREE.TextureLoader().loadAsync(this.base + p),
    };
    this.scenes = [];
    for (const s of v.scenes) this.scenes.push({ ...s, obj: await s.make(ctx) });
    // warm up: compile every scene's shaders once
    for (const s of this.scenes) this.renderer.compile(s.obj.scene, s.obj.camera);
  }

  sceneAt(t) {
    let cur = this.scenes[0];
    for (const s of this.scenes) if (t >= s.from) cur = s;
    return cur;
  }

  frameInfo(t, s) {
    const BEAT = 60 / this.video.bpm;
    return { t, lt: t - s.from, len: s.to - s.from, p: (t - s.from) / (s.to - s.from), beat: t / BEAT, bar: t / BEAT / 4, BEAT, BAR: BEAT * 4 };
  }

  // Render sub-frame at time t into the composer's read buffer; returns post overrides.
  drawSub(t) {
    const s = this.sceneAt(t);
    this.current = s;
    const f = this.frameInfo(t, s);
    const o = { ...POST_DEFAULTS, ...(this.video.post?.(t, f) || {}), ...(s.obj.update(f) || {}) };
    this.renderPass.scene = s.obj.scene; this.renderPass.camera = s.obj.camera;
    this.bloomPass.strength = o.bloom; this.bloomPass.radius = o.bloomRadius; this.bloomPass.threshold = o.bloomThreshold;
    this.composer.render();
    return o;
  }

  renderFrame(t, samples = 1, shutter = 0.5) {
    const r = this.renderer;
    r.setRenderTarget(this.accumRT); r.setClearColor(0x000000, 1); r.clear();
    const n = Math.max(1, samples | 0);
    for (let k = 0; k < n; k++) {
      this.drawSub(n === 1 ? t : t + ((k + 0.5) / n - 0.5) * shutter / 60);
      this.accumMat.uniforms.map.value = this.composer.readBuffer.texture;
      this.accumMat.uniforms.w.value = 1 / n;
      // additive accumulation: must not clear between sub-frames
      const ac = r.autoClear; r.autoClear = false;
      r.setRenderTarget(this.accumRT); r.render(this.accumScene, this.quadCam);
      r.autoClear = ac;
    }
    // post params and HUD are read once, at the frame's own time
    const s = this.sceneAt(t);
    const f = this.frameInfo(t, s);
    const post = { ...POST_DEFAULTS, ...(this.video.post?.(t, f) || {}), ...(s.obj.update(f) || {}) };
    const h = this.hud;
    h.setTransform(1, 0, 0, 1, 0, 0); h.clearRect(0, 0, W, H);
    s.obj.hud?.(h, f);
    h.setTransform(1, 0, 0, 1, 0, 0);
    this.video.hud?.(h, f, s);
    this.hudTex.needsUpdate = true;
    const U = this.finalMat.uniforms;
    for (const k of ['exposure', 'ca', 'grain', 'vignette', 'flash', 'fade', 'zoomBlur', 'invert', 'saturation']) U[k].value = post[k];
    U.hudAlpha.value = post.hud;
    U.flashColor.value.setRGB(...post.flashColor);
    U.zoomCenter.value.set(...post.zoomCenter);
    U.shake.value.set(...post.shake);
    U.frame.value = frameIdx(t) % 997;
    r.setRenderTarget(null); r.render(this.finalScene, this.quadCam);
  }
}

// ---------- text helpers ----------
// Centered extruded text. opts: size, depth, curveSegments, bevel (bool), bevelSize, bevelThickness, align ('center'|'left'), letterSpacing (em)
export function text3d(font, str, { size = 1, depth = 0.2, curveSegments = 8, bevel = false, bevelSize = 0.02, bevelThickness = 0.02, align = 'center' } = {}) {
  const g = new TextGeometry(str, { font, size, depth, curveSegments, bevelEnabled: bevel, bevelSize, bevelThickness, bevelSegments: 3 });
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(align === 'center' ? -(b.max.x + b.min.x) / 2 : -b.min.x, -(b.max.y + b.min.y) / 2, -depth / 2);
  g.computeVertexNormals();
  return g;
}
// One geometry per glyph, each centred on its own origin, with x positions for the laid-out string (centred).
export function glyphs3d(font, str, { size = 1, depth = 0.2, curveSegments = 8, bevel = false, bevelSize = 0.02, bevelThickness = 0.02, tracking = 0 } = {}) {
  const scale = size / font.data.resolution;
  const out = []; let x = 0;
  for (const ch of str) {
    const gl = font.data.glyphs[ch] || font.data.glyphs['?'];
    const adv = gl.ha * scale + tracking * size;
    if (ch.trim()) {
      const g = new TextGeometry(ch, { font, size, depth, curveSegments, bevelEnabled: bevel, bevelSize, bevelThickness, bevelSegments: 3 });
      g.computeBoundingBox();
      const b = g.boundingBox, cx = (b.max.x + b.min.x) / 2;
      g.translate(-cx, -size * 0.36, -depth / 2);
      out.push({ ch, geo: g, x: x + cx });
    }
    x += adv;
  }
  const total = x - tracking * size;
  for (const o of out) o.x -= total / 2;
  return out;
}
