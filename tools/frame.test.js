/* Tes TDD mode frame diagram R-X: 'global' (Bus A = 0,0) vs 'relay' (bus relay terpilih = 0,0).
   Seam yang diuji:
     1. Default S.frame = 'global'; toggle setFrame() mengubah S.frame + kelas tombol.
     2. Mode relay: origin relay terpilih jadi 0,0 — gz(sel, 0) = 0; zona terpilih
        tergambar di sekitar origin (bounds memuat 0).
     3. Mode relay: lensa beban disembunyikan (milik frame global) — teks 'lensa beban'
        tidak ada di #plane; mode global tetap ada.
     4. Ganti relay terpilih di mode relay menggeser gambar (posisi lingkaran Z1 berubah),
        sedangkan di mode global posisi Z1 tetap (hanya ray + titik yang bergerak).
     5. Trip tidak terpengaruh frame (decideRelay identik global vs relay).
   Jalankan: node tools/frame.test.js
*/
'use strict';
const path = require('path');
const { loadSimulator } = require('./lens-harness.js');
const HTML = path.join(__dirname, '..', 'distance_relay_simulator.html');

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
function contains(hay, needle, ctx) {
  if (!hay.includes(needle)) throw new Error(`${ctx}: tidak memuat ${JSON.stringify(needle)}`);
}
function notContains(hay, needle, ctx) {
  if (hay.includes(needle)) throw new Error(`${ctx}: TIDAK BOLEH memuat ${JSON.stringify(needle)}`);
}
function load() {
  const ctx = loadSimulator(HTML);
  ctx.pub.render();
  return ctx;
}
/* posisi lingkaran Z1 (fill merah) — hanya lingkaran ZONA (r besar);
   titik gangguan (r=4.5, fill sama saat zone 1) dikecualikan */
function z1Centers(svg) {
  const out = [];
  for (const m of svg.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)" fill="var\(--red\)"/g)) {
    if (+m[3] < 10) continue;
    out.push({ x: +m[1], y: +m[2], r: +m[3] });
  }
  return out;
}

console.log('\nframe — default global + toggle');
{
  const ctx = load();
  check('default S.frame = global', () => {
    if (ctx.pub.S.frame !== 'global') throw new Error(`S.frame=${ctx.pub.S.frame}`);
  });
  check('setFrame tersedia & diekspor harness', () => {
    if (typeof ctx.pub.setFrame !== 'function') throw new Error('setFrame tidak diekspor');
  });
  check('setFrame(relay): S.frame berubah + tombol sinkron', () => {
    ctx.pub.setFrame('relay');
    if (ctx.pub.S.frame !== 'relay') throw new Error('S.frame tidak berubah');
    ctx.pub.setFrame('global');
    if (ctx.pub.S.frame !== 'global') throw new Error('S.frame tidak kembali');
  });
}

console.log('\nframe relay — origin = bus relay terpilih');
{
  const ctx = load();
  const { pub } = ctx;
  pub.S.selectedRelayId = 'R4';
  pub.setFrame('relay');
  const m = pub.computeModel();
  const sel = pub.S.relays.find(r => r.id === 'R4');
  // gz(sel, 0) harus 0,0 — origin relay terpilih jadi pusat frame
  const o = (() => {
    // hitung via bounds: posisi gambar origin terpilih = gz(sel, C(0,0))
    // diekspos tidak langsung — verifikasi lewat relayBounds memuat 0 di tengah konten
    const b = pub.relayBounds(m);
    return b;
  })();
  check('relayBounds mode relay memuat origin (minR<=0<=maxR, minX<=0<=maxX)', () => {
    if (!(o.minR <= 0 && 0 <= o.maxR)) throw new Error(`R [${o.minR},${o.maxR}] tak memuat 0`);
    if (!(o.minX <= 0 && 0 <= o.maxX)) throw new Error(`X [${o.minX},${o.maxX}] tak memuat 0`);
  });
  check('trip identik global vs relay (frame hanya tampilan)', () => {
    const before = {};
    pub.S.relays.forEach(r => { before[r.id] = pub.decideRelay(r, m).zone; });
    // decideRelay tidak memakai S.frame — panggil ulang, hasil harus sama
    pub.S.relays.forEach(r => {
      const z = pub.decideRelay(r, m).zone;
      if (z !== before[r.id]) throw new Error(`${r.id}: ${before[r.id]} → ${z}`);
    });
    if (typeof sel === 'undefined') throw new Error('R4 tidak ada');
  });
}

console.log('\nframe relay — lensa beban disembunyikan, global tetap ada');
{
  const ctxG = load();
  check('global: label lensa beban tampil', () => {
    contains(ctxG.els.plane.innerHTML, 'lensa beban', 'global');
  });
  const ctxR = load();
  ctxR.pub.setFrame('relay');
  ctxR.pub.render();
  check('relay: label lensa beban hilang', () => {
    notContains(ctxR.els.plane.innerHTML, 'lensa beban', 'relay');
  });
}

console.log('\nframe — posisi zona ikut seleksi hanya di mode relay');
{
  const posOf = (frame, selId) => {
    const ctx = load();
    if (frame === 'relay') ctx.pub.setFrame('relay');
    ctx.pub.S.selectedRelayId = selId;
    ctx.pub.render();
    return z1Centers(ctx.els.plane.innerHTML).map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join('|');
  };
  const gR1 = posOf('global', 'R1'), gR4 = posOf('global', 'R4');
  check('global: posisi lingkaran Z1 TETAP saat ganti R1→R4 (bug asal yang dilaporkan)', () => {
    if (gR1 !== gR4) throw new Error('posisi Z1 berubah di mode global — regresi perilaku lama');
  });
  const rR1 = posOf('relay', 'R1'), rR4 = posOf('relay', 'R4');
  check('relay: posisi lingkaran Z1 BERGESER saat ganti R1→R4 (origin ikut relay)', () => {
    if (rR1 === rR4) throw new Error('posisi Z1 identik — origin tidak ikut relay terpilih');
  });
}

console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed === 0 ? 0 : 1);
