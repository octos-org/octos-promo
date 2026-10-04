// Deterministic helpers. Visuals must be a pure function of t: never Math.random / Date.now.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, x) => a + (b - a) * x;
export const remap = (x, a, b, c, d) => c + ((x - a) / (b - a)) * (d - c);
export const prog = (t, a, b, e = (x) => x) => e(clamp((t - a) / (b - a)));
export const smooth = (x) => x * x * (3 - 2 * x);
export const ease = {
  inQuad: (x) => x * x, outQuad: (x) => 1 - (1 - x) ** 2,
  inCubic: (x) => x ** 3, outCubic: (x) => 1 - (1 - x) ** 3,
  inOutCubic: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  outBack: (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
  outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};
// keys(t, [[t0, v0], [t1, v1, easeFn], ...]) piecewise interpolation; ease applies to the segment ending at that key.
export function keys(t, ks) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1, e = smooth] = ks[i];
      const x = e((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? v0.map((a, j) => lerp(a, v1[j], x)) : lerp(v0, v1, x);
    }
  }
  return ks[ks.length - 1][1];
}
export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export function hash2(a, b) { return hash(a * 157.31 + b * 71.97); }
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Smooth 1D value noise.
export function noise1(x) { const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }
export function fbm1(x, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * noise1(x * f + i * 17.3); a *= 0.5; f *= 2; } return s; }
// Frame index, constant over a frame's shutter: use for per-frame flicker.
export const frameIdx = (t) => Math.floor(t * 60 + 1e-6);
