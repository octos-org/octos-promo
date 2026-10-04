// Per-version shared state: one Typesetter for all scenes.
import { Typesetter, setupRenderer } from './lib.js';

let tsPromise = null;
export function getTS(ctx) {
  if (!tsPromise) {
    setupRenderer(ctx.renderer);
    const ts = new Typesetter(ctx);
    tsPromise = ts.init(Object.keys(ctx.video.fonts)).then(() => ts);
  }
  return tsPromise;
}
