// Offline renderer: headless Chrome (GPU) draws each frame, PNGs are piped to ffmpeg.
//   node engine/render.mjs <dir> stills --t 3,12.5 [--samples 1] [--out <dir>/out/stills]
//   node engine/render.mjs <dir> sheet --from 0 --to 60 --n 24 [--cols 6] [--out <dir>/out/sheet.png]
//   node engine/render.mjs <dir> video [--from 0 --to DUR] [--samples 8] [--jobs 3] [--out <dir>/out/<dir>.mp4]
//   node engine/render.mjs <dir> perf --t 10,20
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FPS = 60;
const [dir, mode] = process.argv.slice(2, 4);
const args = process.argv.slice(4);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
if (!dir || !mode) { console.log('usage: node engine/render.mjs <dir> stills|sheet|video|perf ...'); process.exit(1); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`http://127.0.0.1:${port}/engine/player.html?v=${dir}&offline`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  return page;
}
const frame = (page, t, samples, shutter) => page.evaluate(([t, s, sh]) => {
  window.__engine.renderFrame(t, s, sh);
  return document.getElementById('c').toDataURL('image/png').split(',')[1];
}, [t, samples, shutter]);

const srv = await serve();
const port = srv.address().port;
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const samples = Number(opt('samples', mode === 'video' ? 8 : 1));
const shutter = Number(opt('shutter', 0.5));
try {
  const page0 = mode === 'video' ? null : await openPage(browser, port);
  if (page0) console.log('GPU:', await page0.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e.UNMASKED_RENDERER_WEBGL); }));
  if (mode === 'stills' || mode === 'perf') {
    const out = opt('out', `${dir}/out/stills`); fs.mkdirSync(out, { recursive: true });
    for (const t of opt('t', '1').split(',').map(Number)) {
      const t0 = Date.now();
      const png = await frame(page0, t, samples, shutter);
      if (mode === 'stills') { const f = path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`); fs.writeFileSync(f, Buffer.from(png, 'base64')); console.log(f, `${Date.now() - t0} ms`); }
      else console.log(`t=${t}: ${Date.now() - t0} ms`);
    }
  } else if (mode === 'sheet') {
    const from = Number(opt('from', 0)), to = Number(opt('to', 60)), n = Number(opt('n', 24)), cols = Number(opt('cols', 6));
    const out = opt('out', `${dir}/out/sheet.png`);
    const tmp = fs.mkdtempSync(path.join(ROOT, 'out', '.sheet-'));
    for (let i = 0; i < n; i++) {
      const t = from + ((to - from) * i) / Math.max(1, n - 1);
      fs.writeFileSync(path.join(tmp, `f${String(i).padStart(3, '0')}.png`), Buffer.from(await frame(page0, t, samples, shutter), 'base64'));
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', path.join(tmp, 'f*.png'), '-vf', `scale=480:270,tile=${cols}x${Math.ceil(n / cols)}`, '-frames:v', '1', out], { stdio: 'inherit' });
    fs.rmSync(tmp, { recursive: true });
    console.log(out, `(frames at t = ${from} + i * ${((to - from) / Math.max(1, n - 1)).toFixed(3)})`);
  } else if (mode === 'video') {
    // video.js is a browser module; read dur / audio from its source instead of importing it
    const src = fs.readFileSync(path.join(ROOT, dir, 'video.js'), 'utf8');
    const video = { dur: Number(src.match(/\bdur:\s*([\d.]+)/)?.[1] ?? 60), audio: src.match(/\baudio:\s*['"]([^'"]+)/)?.[1] };
    const dur = Number(opt('to', video.dur)), from = Number(opt('from', 0));
    const out = opt('out', `${dir}/out/${dir}.mp4`);
    const jobs = Number(opt('jobs', 3));
    const F0 = Math.round(from * FPS), F1 = Math.round(dur * FPS);
    const tmp = path.join(path.dirname(out), '.seg'); fs.mkdirSync(tmp, { recursive: true });
    const per = Math.ceil((F1 - F0) / jobs); const segs = [];
    for (let j = 0; j < jobs; j++) { const a = F0 + j * per, b = Math.min(F1, a + per); if (a < b) segs.push([a, b, path.join(tmp, `seg${j}.mp4`)]); }
    const t0 = Date.now();
    await Promise.all(segs.map(async ([a, b, file]) => {
      const page = await openPage(browser, port);
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (let f = a; f < b; f++) {
        const png = Buffer.from(await frame(page, f / FPS, samples, shutter), 'base64');
        if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
        if ((f - a) % 240 === 0) console.log(`  ${path.basename(file)}: ${f - a}/${b - a}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      }
      ff.stdin.end();
      await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));
      await page.close();
    }));
    fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map(([, , f]) => `file '${path.resolve(f)}'`).join('\n'));
    const wav = path.join(ROOT, dir, video?.audio ?? 'audio/track.wav');
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
      '-ss', String(from), '-t', String(dur - from), '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
      '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('concat failed');
    fs.rmSync(tmp, { recursive: true });
    console.log(`done: ${out} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
} finally { await browser.close(); srv.close(); }
