// Extract one face from a .ttc into a standalone sfnt, optionally subset to given chars (opentype.js → CFF OTF).
// node tools/ttc.mjs list <ttc> | node tools/ttc.mjs sub <ttc> <index> <out.otf> "<chars>"
import fs from 'node:fs';
import opentype from '../../node_modules/opentype.js/dist/opentype.module.js';
const [mode, file, idx, out, chars] = process.argv.slice(2);
const buf = fs.readFileSync(file);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const isTTC = buf.toString('latin1', 0, 4) === 'ttcf';
const nFonts = isTTC ? dv.getUint32(8) : 1;
const offs = isTTC ? [...Array(nFonts)].map((_, i) => dv.getUint32(12 + 4 * i)) : [0];
function extract(o) {
  const numTables = dv.getUint16(o + 4);
  const tabs = [];
  for (let i = 0; i < numTables; i++) {
    const r = o + 12 + 16 * i;
    tabs.push({ tag: buf.toString('latin1', r, r + 4), sum: dv.getUint32(r + 4), off: dv.getUint32(r + 8), len: dv.getUint32(r + 12) });
  }
  let pos = 12 + 16 * numTables; const parts = [];
  const head = Buffer.alloc(pos); buf.copy(head, 0, o, o + 12);
  tabs.forEach((t, i) => {
    const r = 12 + 16 * i; head.write(t.tag, r, 'latin1'); head.writeUInt32BE(t.sum, r + 4); head.writeUInt32BE(pos, r + 8); head.writeUInt32BE(t.len, r + 12);
    const pad = (4 - (t.len % 4)) % 4; parts.push(buf.subarray(t.off, t.off + t.len), Buffer.alloc(pad)); pos += t.len + pad;
  });
  return Buffer.concat([head, ...parts]);
}
if (mode === 'list') {
  offs.forEach((o, i) => { const f = opentype.parse(extract(o).buffer.slice(0)); console.log(i, f.names.fullName?.en, '|', f.names.fontFamily?.en, f.names.fontSubfamily?.en, 'glyphs', f.numGlyphs, f.outlinesFormat); });
} else {
  const sf = extract(offs[+idx]);
  const f = opentype.parse(sf.buffer.slice(sf.byteOffset, sf.byteOffset + sf.byteLength));
  const set = [...new Set([...chars])];
  const glyphs = [f.glyphs.get(0)];
  for (const ch of set) { const g = f.charToGlyph(ch); if (!g || g.index === 0) { console.error('missing', ch); continue; } glyphs.push(new opentype.Glyph({ name: 'u' + ch.codePointAt(0).toString(16), unicode: ch.codePointAt(0), advanceWidth: g.advanceWidth, path: g.getPath(0, 0, f.unitsPerEm) ? g.path : g.path })); }
  const nf = new opentype.Font({ familyName: (f.names.fontFamily?.en || 'X') + 'Sub', styleName: f.names.fontSubfamily?.en || 'Regular', unitsPerEm: f.unitsPerEm, ascender: f.ascender, descender: f.descender, glyphs });
  fs.writeFileSync(out, Buffer.from(nf.toArrayBuffer()));
  console.log('wrote', out, glyphs.length, 'glyphs');
}
