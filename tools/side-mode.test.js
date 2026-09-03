/* Tes TDD pemangkasan layout & mode kartu kanan (side-card).
   Perubahan yang diuji:
     1. PEMANGKASAN: kartu staircase (time–impedansi) & kotak catatan #typeNote
        dihapus dari halaman → render() tak lagi menulis ke #staircase/#typeNote.
        Kolom kanan berakhir di plane-row → tinggi panel parameter terkunci di situ.
     2. MODE KARTU KANAN (P.sideMode, default 'relay'):
        - 'relay' (default) = konten lama — dijamin tetap oleh tools/readout.test.js.
        - 'seq' (Sekuens trip) = tripSequence(m) utk relay ENABLED:
          baris trip urut waktu operasi naik → zona naik → id (Z1 = seketika/0 s),
          lalu baris non-trip (abu-abu) dgn alasan 'di belakang relay'/'di luar jangkauan'.
          Kotak status menyorot relay trip PERTAMA; #formulaOut & #sirNote dikosongkan.

   Skenario literal (default: L1=100 km, L2=80 km, mho, semua relay enabled):
     pos=135 (35 km di L2): R2 & R4 lihat Z1 (seketika), R1 lihat Z2 (0.40 s),
     R3 di belakang → urutan: R2, R4, R1, lalu R3 (tidak trip).
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
function scenario(fn) {
  const ctx = loadSimulator(HTML);
  const { pub } = ctx;
  fn(pub.S, pub.P);
  pub.render();
  return { ctx, pub, S: pub.S, P: pub.P };
}
const idsOf = seq => seq.trip.map(x => x.id).join(',');
const idsOfAll = seq => seq.trip.map(x => x.id).concat(seq.not.map(x => x.id)).join(',');

/* ============ 1. pemangkasan: staircase & typeNote tak lagi ditulis ============ */
console.log('\nPemangkasan layout — staircase & catatan tipe');
{
  const { ctx } = scenario(() => {});
  check('render() tidak menulis ke #staircase (kartu time–impedansi dihapus)', () => {
    const v = ctx.els.staircase; // undefined = elemen bahkan tak pernah diminta DOM
    if (v && v.innerHTML !== '') throw new Error(`#staircase terisi: ${v.innerHTML.slice(0, 80)}`);
  });
  check('render() tidak menulis ke #typeNote (catatan karakteristik dihapus)', () => {
    const v = ctx.els.typeNote;
    if (v && v.textContent !== '') throw new Error(`#typeNote terisi: ${v.textContent.slice(0, 80)}`);
  });
  check('mode default = relay terpilih: kartu readout tetap terisi penuh', () => {
    contains(ctx.els.readout.innerHTML, 'class="r-sum"', 'readout default');
    contains(ctx.els.zoneLabel.textContent, 'TRIP', 'status default');
  });
}

/* ============ 2. model sekuens: tripSequence(m) ============ */
console.log('\ntripSequence — urutan operasi relay (enabled)');
{
  const { pub } = scenario((S, P) => { P.pos = 135; });
  const m = pub.computeModel();
  const seq = pub.tripSequence(m);
  check('pos=135: urutan trip = R2 (Z1), R4 (Z1), R1 (Z2); R3 tidak trip', () => {
    if (idsOf(seq) !== 'R2,R4,R1') throw new Error(`urutan trip salah: ${idsOf(seq)}`);
    if (seq.trip.map(x => x.zone).join(',') !== '1,1,2') throw new Error(`zona salah: ${seq.trip.map(x => x.zone)}`);
    if (seq.not.map(x => x.id).join(',') !== 'R3') throw new Error(`non-trip salah: ${idsOfAll(seq)}`);
    if (seq.not[0].reason !== 'di belakang relay') throw new Error(`alasan R3: ${seq.not[0].reason}`);
  });
  check('pos=135: waktu operasi Z1 seketika (0), Z2 = 0.40 s', () => {
    const [a, b, c] = seq.trip;
    if (a.time !== 0 || b.time !== 0 || !(Math.abs(c.time - 0.4) < 1e-9)) throw new Error(`waktu: ${a.time}, ${b.time}, ${c.time}`);
  });
  check('urutan utuh: 4 relay enabled semua tercantum', () => {
    if (seq.trip.length + seq.not.length !== 4) throw new Error(`total ${seq.trip.length + seq.not.length}, harus 4`);
  });
}
{
  const { pub } = scenario((S, P) => {
    P.pos = 135;
    S.relays.find(r => r.id === 'R4').enabled = false; // relay mati TIDAK ikut sekuens
  });
  const seq = pub.tripSequence(pub.computeModel());
  check('pos=135, R4 disabled: trip = R2, R1; R4 tidak dicantumkan', () => {
    if (idsOf(seq) !== 'R2,R1') throw new Error(`urutan trip salah: ${idsOf(seq)}`);
    if (idsOfAll(seq).includes('R4')) throw new Error('R4 disabled tidak boleh muncul');
    if (seq.trip.length + seq.not.length !== 3) throw new Error(`total ${seq.trip.length + seq.not.length}, harus 3`);
  });
}
{
  const { pub } = scenario((S, P) => {
    P.pos = 50;
    S.relays.forEach(r => { r.enabled = (r.id === 'R2'); }); // hanya R2; fault di belakangnya
  });
  const seq = pub.tripSequence(pub.computeModel());
  check('hanya R2 enabled & fault di belakang: tak ada trip; R2 = di belakang relay', () => {
    if (seq.trip.length !== 0) throw new Error(`tidak boleh ada trip: ${idsOf(seq)}`);
    if (seq.not.length !== 1 || seq.not[0].id !== 'R2') throw new Error(`non-trip: ${idsOfAll(seq)}`);
    if (seq.not[0].reason !== 'di belakang relay') throw new Error(`alasan: ${seq.not[0].reason}`);
  });
}

/* ============ 3. mode readout 'seq' di DOM ============ */
console.log('\nMode Sekuens trip — kartu kanan');
{
  const { ctx, pub } = scenario((S, P) => { P.pos = 135; P.sideMode = 'seq'; });
  check('status: sorot relay trip pertama R2 ZONE 1', () => {
    contains(ctx.els.zoneLabel.textContent, 'R2: TRIP — ZONE 1', 'zoneLabel seq');
    contains(ctx.els.timeLabel.textContent, 'seketika', 'timeLabel seq');
  });
  check('readout: urutan R2 → R4 → R1 lalu grup Tidak trip berisi R3', () => {
    const h = ctx.els.readout.innerHTML;
    const gi = s => h.indexOf(s);
    const p2 = gi('>R2<'), p4 = gi('>R4<'), p1 = gi('>R1<'), gN = gi('Tidak trip');
    if ([p2, p4, p1, gN].some(x => x < 0)) throw new Error(`fragmen hilang: ${[p2, p4, p1, gN]}`);
    if (!(p2 < p4 && p4 < p1 && p1 < gN)) throw new Error('urutan DOM salah (harus R2<R4<R1 lalu Tidak trip)');
    contains(h, 'Urutan trip', 'judul grup urutan');
    contains(h, '0.40 s', 'waktu R1 di daftar');
  });
  check('mode seq: #formulaOut & #sirNote dikosongkan', () => {
    if (ctx.els.formulaOut.innerHTML !== '') throw new Error('formulaOut harus kosong di mode seq');
    if (ctx.els.sirNote.textContent !== '') throw new Error('sirNote harus kosong di mode seq');
  });
  check('mode seq: zona formula & SIR disembunyikan — tak ada blok hijau kosong', () => {
    if (ctx.els.formulaOut.style.display !== 'none') throw new Error(`formulaOut display=${ctx.els.formulaOut.style.display}, harus none`);
    if (ctx.els.sirNote.style.display !== 'none') throw new Error(`sirNote display=${ctx.els.sirNote.style.display}, harus none`);
    if (ctx.els.sirNote.style.background) throw new Error(`sirNote masih bergaris-bawah: ${ctx.els.sirNote.style.background}`);
  });
  check('kembali ke mode relay: konten readout/status pulih & zona formula/SIR tampil lagi', () => {
    pub.P.sideMode = 'relay';
    pub.render();
    contains(ctx.els.readout.innerHTML, 'class="r-sum"', 'readout relay lagi');
    contains(ctx.els.zoneLabel.textContent, 'R1: TRIP — ZONE 2', 'status relay lagi');
    if (ctx.els.sirNote.style.display === 'none') throw new Error('sirNote harus tampil lagi di mode relay');
    if (!ctx.els.sirNote.textContent) throw new Error('sirNote harus berisi teks di mode relay');
  });
}
{
  const { ctx } = scenario((S, P) => { P.pos = 50; P.sideMode = 'seq'; S.relays.forEach(r => { r.enabled = (r.id === 'R2'); }); });
  check('tak ada relay trip: status TIDAK ADA TRIP', () => {
    contains(ctx.els.zoneLabel.textContent, 'TIDAK ADA TRIP', 'zoneLabel kosong');
    contains(ctx.els.timeLabel.textContent, 'tidak ada relay', 'timeLabel kosong');
  });
  check('daftar tetap memuat R2 dgn alasan di belakang', () => {
    contains(ctx.els.readout.innerHTML, 'R2', 'R2 di daftar');
    contains(ctx.els.readout.innerHTML, 'di belakang relay', 'alasan R2');
  });
}

console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed === 0 ? 0 : 1);
