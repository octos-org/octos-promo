// Offline renderer: headless Chrome draws each frame, PNGs are piped to ffmpeg.
//   node render.mjs stills --t 3,12.5,40 [--out out/stills]
//   node render.mjs video [--from 0 --to 63] [--samples 3] [--jobs 4] [--out out/octos.mp4]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FPS = 60, DUR = 63;

const args = process.argv.slice(2);
const mode = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.wav': 'audio/wav' };
function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?offline`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  return page;
}

const frame = (page, t, samples) => page.evaluate(([t, s]) => {
  window.__video.renderFrame(t, s);
  return document.getElementById('c').toDataURL('image/png').split(',')[1];
}, [t, samples]);

async function renderSegment(browser, port, f0, f1, samples, file) {
  const page = await openPage(browser, port);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = f0; f < f1; f++) {
    const png = Buffer.from(await frame(page, f / FPS, samples), 'base64');
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 300 === 0) console.log(`  ${path.basename(file)}: frame ${f}/${f1}`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));
  await page.close();
}

const srv = await serve();
const port = srv.address().port;
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
try {
  if (mode === 'stills') {
    const out = opt('out', 'out/stills'); fs.mkdirSync(out, { recursive: true });
    const page = await openPage(browser, port);
    for (const t of opt('t', '1').split(',').map(Number)) {
      const t0 = Date.now();
      const png = await frame(page, t, Number(opt('samples', 1)));
      const file = path.join(out, `t${t.toFixed(2)}.png`);
      fs.writeFileSync(file, Buffer.from(png, 'base64'));
      console.log(file, `${Date.now() - t0} ms`);
    }
  } else if (mode === 'video') {
    const out = opt('out', 'out/octos.mp4');
    const from = Number(opt('from', 0)), to = Number(opt('to', DUR));
    const samples = Number(opt('samples', 1)), jobs = Number(opt('jobs', 4));
    const F0 = Math.round(from * FPS), F1 = Math.round(to * FPS);
    const tmp = path.join(path.dirname(out), '.seg'); fs.mkdirSync(tmp, { recursive: true });
    const per = Math.ceil((F1 - F0) / jobs);
    const segs = [];
    for (let j = 0; j < jobs; j++) {
      const a = F0 + j * per, b = Math.min(F1, a + per);
      if (a < b) segs.push([a, b, path.join(tmp, `seg${j}.mp4`)]);
    }
    const t0 = Date.now();
    await Promise.all(segs.map(([a, b, f]) => renderSegment(browser, port, a, b, samples, f)));
    fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map(([, , f]) => `file '${path.resolve(f)}'`).join('\n'));
    await new Promise((r, j) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
      '-ss', String(from), '-t', String(to - from), '-i', path.join(ROOT, 'audio/octos.wav'),
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' })
      .on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg concat ' + c)))));
    console.log(`done: ${out} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } else {
    console.log('usage: node render.mjs stills --t 1,2 | video [--from --to --samples --jobs --out]');
  }
} finally {
  await browser.close(); srv.close();
}
