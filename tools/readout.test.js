/* Tes TDD kartu readout (.side-card) — struktur baru "ringkasan + tabel 3 grup".
   Menjalankan <script> simulator lewat tools/lens-harness.js (stub DOM), lalu
   mengubah state S/P per skenario dan menegaskan DOM yang dihasilkan render().

   Seam yang diuji (disepakati dgn user):
     1. #statusBox  — teks zona & waktu (perilaku lama dipertahankan)
     2. #readout    — kalimat ringkasan (div .r-sum) sesuai skenario
     3. #readout    — struktur tabel: 3 grup berjudul urut, label baru, label lama hilang
*/
'use strict';
const path = require('path');
const { loadSimulator } = require('./lens-harness.js');
const HTML = path.join(__dirname, '..', 'distance_relay_simulator.html');

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.log('  \u2717 ' + name + '\n      ' + e.message); }
}
function contains(hay, needle, ctx) {
  if (!hay.includes(needle))
    throw new Error(`${ctx}: tidak memuat ${JSON.stringify(needle)}\n    aktual: ${JSON.stringify(hay.slice(0, 700))}${hay.length > 700 ? '…' : ''}`);
}
function notContains(hay, needle, ctx) {
  if (hay.includes(needle)) throw new Error(`${ctx}: TIDAK BOLEH memuat ${JSON.stringify(needle)}`);
}
/* Muat ulang simulator (state bersih) lalu mutasi state & render. */
function scenario(fn) {
  const ctx = loadSimulator(HTML);
  const { pub } = ctx;
  const S = pub.S, P = pub.P;
  fn(S, P);
  pub.render();
  /* Teks status tinggal di anak #zoneLabel/#timeLabel (statusBox hanya wadah). */
  const status = ctx.els.zoneLabel.textContent;
  const time = ctx.els.timeLabel.textContent;
  return { ctx, status, time, readout: ctx.els.readout.innerHTML };
}

/* ============ struktur kartu (dipakai beberapa skenario) ============ */
function assertStructure(readout, label) {
  const gi = s => readout.indexOf(s);
  check(`[${label}] struktur: ringkasan (.r-sum) sebelum grup`, () => {
    const a = gi('class="r-sum"'), b = gi('class="rgroup-title"');
    if (a < 0) throw new Error('tidak ada .r-sum');
    if (b < 0) throw new Error('tidak ada .rgroup-title');
    if (!(a < b)) throw new Error('.r-sum harus sebelum judul grup');
  });
  check(`[${label}] struktur: 3 judul grup dgn urutan benar`, () => {
    const t1 = gi('Relay &amp; karakteristik'), t2 = gi('Impedansi gangguan'), t3 = gi('Lokasi gangguan &amp; jangkauan');
    if ([t1, t2, t3].some(x => x < 0)) throw new Error(`judul grup hilang: ${[t1, t2, t3].map((x, i) => x < 0 ? i : null).filter(x => x !== null).join(',')}`);
    if (!(t1 < t2 && t2 < t3)) throw new Error('urutan judul grup salah');
    const n = (readout.match(/class="rgroup-title"/g) || []).length;
    if (n !== 3) throw new Error(`jumlah grup ${n}, harus 3`);
  });
  check(`[${label}] struktur: label teknis baru hadir`, () => {
    ['Z apparent (sekunder)', '|Z| \u2220\u03b8', 'Reach zona 1', 'Reach zona 2', 'Reach zona 3', 'Karakteristik', 'Z asli (primer)']
      .forEach(s => contains(readout, s, label));
  });
  check(`[${label}] struktur: label lama yang digantikan hilang`, () => {
    ['Zone 1 reach', 'Zone 2 reach', 'Zone 3 reach', 'saluran, primer', 'Z apparent (primer)']
      .forEach(s => notContains(readout, s, label));
  });
  return check;
}

/* ============ skenario ============ */
console.log('\nSkenario 1 — fault di L1 dekat bus (pos=20) → R1 TRIP ZONE 1 seketika');
{
  const { status, time, readout } = scenario((S, P) => { P.pos = 20; });
  assertStructure(readout, 'S1');
  check('S1: statusBox zone 1 + instantaneous', () => {
    contains(status, 'R1: TRIP \u2014 ZONE 1', 'S1 status');
    contains(time, 'instantaneous', 'S1 status');
  });
  check('S1: ringkasan menyebut Zona 1 & trip seketika', () => {
    contains(readout, '<b>Zona 1</b>', 'S1 summary');
    contains(readout, 'seketika', 'S1 summary');
  });
}

console.log('\nSkenario 2 — fault di L2 (pos=135) → R1 TRIP ZONE 2 t=0.40s');
{
  const { status, time, readout } = scenario((S, P) => { P.pos = 135; });
  assertStructure(readout, 'S2');
  check('S2: statusBox zone 2 + 0.40 s', () => {
    contains(status, 'R1: TRIP \u2014 ZONE 2', 'S2 status');
    contains(time, '0.40 s', 'S2 status');
  });
  check('S2: ringkasan menyebut Zona 2 & waktu 0.40 s', () => {
    contains(readout, 'masuk <b>Zona 2</b>', 'S2 summary');
    contains(readout, '0.40 s', 'S2 summary');
  });
  check('S2: baris relay memuat nama relay terpilih', () => {
    contains(readout, 'Relay Bus A', 'S2 relay row');
  });
}

console.log('\nSkenario 3 — fault di ujung L2 (pos=160) → R1 TRIP ZONE 3 t=1.20s');
{
  const { status, time, readout } = scenario((S, P) => { P.pos = 160; });
  check('S3: statusBox zone 3 + 1.20 s', () => {
    contains(status, 'R1: TRIP \u2014 ZONE 3', 'S3 status');
    contains(time, '1.20 s', 'S3 status');
  });
  check('S3: ringkasan menyebut Zona 3 & waktu 1.20 s', () => {
    contains(readout, 'masuk <b>Zona 3</b>', 'S3 summary');
    contains(readout, '1.20 s', 'S3 summary');
  });
}

console.log('\nSkenario 4 — R3 terpilih, fault di belakang relay (pos=120) → TIDAK TRIP');
{
  const { status, time, readout } = scenario((S, P) => { S.selectedRelayId = 'R3'; P.pos = 120; });
  check('S4: statusBox R3 TIDAK TRIP + di luar seluruh zona', () => {
    contains(status, 'R3: TIDAK TRIP', 'S4 status');
    contains(time, 'di luar seluruh zona', 'S4 status');
  });
  check('S4: ringkasan menyebut "di belakang relay"', () => {
    contains(readout, 'di belakang relay', 'S4 summary');
  });
}

console.log('\nSkenario 5 — Rf besar (40 \u03a9) di ujung L2 → TIDAK TRIP (di luar semua zona)');
{
  const { status, readout } = scenario((S, P) => { P.pos = 179.9; P.rf = 40; });
  check('S5: statusBox TIDAK TRIP', () => {
    contains(status, 'R1: TIDAK TRIP', 'S5 status');
  });
  check('S5: ringkasan menyebut tidak trip + jangkauan terjauh', () => {
    contains(readout, 'tidak trip', 'S5 summary');
    contains(readout, 'terjauh', 'S5 summary');
  });
}

console.log('\nSkenario 6 — error PT 5% (pos=135) → Z terukur tampil di ringkasan & tabel');
{
  const { status, readout } = scenario((S, P) => { P.pos = 135; P.ptErr = 5; });
  check('S6: statusBox tetap zone 2', () => {
    contains(status, 'R1: TRIP \u2014 ZONE 2', 'S6 status');
  });
  check('S6: ringkasan memakai Z terukur', () => {
    contains(readout, 'Z terukur', 'S6 summary');
  });
  check('S6: baris Z terukur + Δ|Z| error hadir', () => {
    contains(readout, '\u0394|Z|', 'S6 row');
    contains(readout, 'Z terukur', 'S6 row');
  });
}

console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed === 0 ? 0 : 1);
