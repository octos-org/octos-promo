import { Video, DUR } from './video.js';

const canvas = document.getElementById('c');
const video = new Video(canvas);
window.__video = video;
await video.ready;
window.__ready = true;

// Offline renderer drives renderFrame directly; the preview below is only for humans.
if (!new URLSearchParams(location.search).has('offline')) {
  const audio = document.getElementById('a');
  const ui = document.getElementById('ui');
  let t = parseFloat(new URLSearchParams(location.search).get('t') || '0');
  let playing = false, t0 = 0, wall = 0;
  const now = () => (playing ? t0 + (performance.now() - wall) / 1000 : t);
  function play() { playing = true; t0 = t; wall = performance.now(); audio.currentTime = t; audio.play(); }
  function pause() { t = now(); playing = false; audio.pause(); }
  addEventListener('keydown', (e) => {
    if (e.key === ' ') { playing ? pause() : play(); e.preventDefault(); }
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const p = playing; if (p) pause();
      t = Math.max(0, Math.min(DUR, t + (e.key === 'ArrowRight' ? step : -step)));
      if (p) play();
    }
    if (e.key === 'h') ui.style.display = ui.style.display === 'none' ? '' : 'none';
  });
  (function loop() {
    const tt = now();
    if (tt >= DUR) pause();
    video.renderFrame(Math.min(tt, DUR));
    ui.textContent = `${tt.toFixed(2)}s · space play/pause · ←/→ seek · h hide`;
    requestAnimationFrame(loop);
  })();
}
