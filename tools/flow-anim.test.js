/* Tes TDD revisi animasi aliran daya di SLD — flowSegments() + panah di #sld.
   Masalah lama (artefak visual):
     - fault di L2 + infeed: segmen A–B ikut digambar BESAR padahal hanya membawa
       arus sumber ia (infeed masuk di Bus B) → panah A–B "membesar" mendadak.
     - ukuran panah 2 level diskret (normal/besar), tidak ∝ arus.
   Perbaikan (disepakati):
     - flowSegments(m, vi) murni: panah PER SEGMEN sesuai kontribusi arus nyata.
       L1: Sumber→fault = ia (source); B→fault = ib (infeed, copper).
       L2: Sumber→B = ia SAJA (kecil); B→fault = gabungan ifK = ia+ib (besar).
       Tidak pernah ada panah melewati titik gangguan.
     - ukuran panah kontinu ∝ kA (ref = hubung-singkat di Bus A: E/|ZsA|),
       kecepatan tetap 125 px/s.
   Jaringan sintetis murni-reaktif (angka eksak, sama dgn sld-v-i.test.js):
     l1=100 x1=0.5 (Z1=j50), l2=80 x2=0.5 (Z2=j40), zsmag=10 (Zs=j10),
     VLL=150 → E=86.60254 kV. Fault 3φ, pos=130 (30 km di L2) & pos=50 (tengah L1).
   Nilai harapan = hitung tangan (spesifikasi), BUKAN dihitung ulang oleh kode.

   Seam 1 (model): flowSegments(m, vi) → [{from,to,kA,color,w}] (w = kA/E|Zs|⁻¹, clamp 0..1)
   Seam 2 (render): panah di #sld — glyph ∝ w, jalur per segmen, tanpa panah lewat fault.
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
function approx(act, exp, ctx, tol) {
  tol = tol === undefined ? 0.02 : tol;
  if (!(Math.abs(act - exp) <= tol))
    throw new Error(`${ctx}: aktual ${act} ≠ harapan ${exp} (±${tol})`);
}
function contains(hay, needle, ctx) {
  if (!hay.includes(needle)) throw new Error(`${ctx}: tidak memuat ${JSON.stringify(needle)}\n    awal: ${JSON.stringify(hay.slice(0, 400))}…`);
}
function notContains(hay, needle, ctx) {
  if (hay.includes(needle)) throw new Error(`${ctx}: TIDAK BOLEH memuat ${JSON.stringify(needle)}`);
}

/* skenario sintetis; semua posisi km dari Bus A. infeedOff=true → P.infeedOn=false. */
function scenario(pos, infeedOn, infeed) {
  const ctx = loadSimulator(HTML);
  const { pub } = ctx;
  const P = pub.P;
  P.r1 = 0; P.x1 = 0.5; P.l1 = 100;
  P.r2 = 0; P.x2 = 0.5; P.l2 = 80;
  P.zsmag = 10; P.vLL_kV = 150;
  P.pos = pos; P.rf = 0; P.xf = 0; P.rfMode = 'R';
  P.faultType = '3ph'; P.infeedOn = infeedOn; P.infeed = infeed;
  pub.render();
  const m = pub.computeModel();
  const vi = pub.computeFaultCircuit(m);
  const segs = pub.flowSegments(m, vi);
  return { ctx, pub, m, vi, segs, sld: ctx.els.sld.innerHTML };
}
/* konstanta layout #sld (sama dgn renderSLD, setelah recenter simetris):
   srcX=75, xA=145, span=760, totalKm=180 → xB=145+760·(100/180)=567.222 */
const SRC = 75, FAULT50 = 356.111, XB = 567.222, FAULT130 = 693.889;
/* ref arus = E/|ZsA| = 86.60254/10 = 8.660254 kA → glyph = 10 + 16·(kA/ref) */
const glyph = kA => 10 + 16 * (kA / 8.660254);
function segOf(segs, from, to) {
  const s = segs.find(x => x.from === from && x.to === to);
  if (!s) throw new Error(`tidak ada segmen ${from}→${to}; aktual: ${JSON.stringify(segs.map(x => x.from + '→' + x.to))}`);
  return s;
}
/* parse panah aliran dari SVG #sld: polygon + animateMotion-nya */
function parseArrows(sld) {
  const out = [];
  const re = /<polygon points="([^"]+)" fill="(var\(--(?:red|copper)\))" opacity="0.88"><animateMotion dur="([\d.]+)s" begin="-?[\d.]+s" repeatCount="indefinite" rotate="auto" path="M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)"\/><\/polygon>/g;
  let mm;
  while ((mm = re.exec(sld))) {
    out.push({
      glyph: parseFloat(mm[1].split(',')[0]),
      fill: mm[2],
      dur: parseFloat(mm[3]),
      x1: parseFloat(mm[4]), y1: parseFloat(mm[5]),
      x2: parseFloat(mm[6]),
    });
  }
  return out;
}

/* ============ Seam 1: flowSegments — struktur segmen & kA literal ============ */
console.log('\nflowSegments — fault di L2 (pos=130)');
{
  const { segs } = scenario(130, false, 1);
  check('L2 off: 2 segmen Sumber→B & B→fault, tanpa infeed', () => {
    if (segs.length !== 2) throw new Error(`jumlah segmen ${segs.length}, harus 2`);
    const a = segOf(segs, 'src', 'B'), b = segOf(segs, 'B', 'fault');
    if (a.color !== 'source' || b.color !== 'source') throw new Error('warna harus source semua (infeed mati)');
    if (segs.some(s => s.color === 'infeed')) throw new Error('infeed off tidak boleh ada segmen infeed');
  });
  check('L2 off: kA Sumber→B = ia = kA B→fault = ifK = 1.15470 (hitung tangan)', () => {
    approx(segOf(segs, 'src', 'B').kA, 1.15470, 'ia L2 off', 0.002);
    approx(segOf(segs, 'B', 'fault').kA, 1.15470, 'ifK L2 off', 0.002);
  });
}
{
  const { segs } = scenario(130, true, 1);
  check('L2 ×1: B→fault = gabungan ifK = 4.61880; Sumber→B tetap ia = 1.15470', () => {
    approx(segOf(segs, 'src', 'B').kA, 1.15470, 'ia L2 ×1', 0.002);
    approx(segOf(segs, 'B', 'fault').kA, 4.61880, 'ifK L2 ×1', 0.002);
  });
  check('L2 ×1: bobot segmen B→fault = 4× bobot Sumber→B (ia+ib, bukan 2 level)', () => {
    const wa = segOf(segs, 'src', 'B').w, wb = segOf(segs, 'B', 'fault').w;
    approx(wb / wa, 4, 'rasio w', 0.05);
  });
}
{
  const { segs } = scenario(130, true, 4);
  check('L2 ×4: B→fault ifK = 6.10345; Sumber→B ia = 1.15470 TIDAK ikut membesar', () => {
    approx(segOf(segs, 'src', 'B').kA, 1.15470, 'ia L2 ×4', 0.002);
    approx(segOf(segs, 'B', 'fault').kA, 6.10345, 'ifK L2 ×4', 0.003);
    approx(segOf(segs, 'B', 'fault').w, 0.70477, 'w gabungan', 0.003);
  });
}
check('L2: ia TIDAK berubah saat infeed on/off/×1/×4 (arus A–B tak boleh melonjak)', () => {
  const iaOff = segOf(scenario(130, false, 1).segs, 'src', 'B').kA;
  const ia1 = segOf(scenario(130, true, 1).segs, 'src', 'B').kA;
  const ia4 = segOf(scenario(130, true, 4).segs, 'src', 'B').kA;
  [ia1, ia4].forEach(v => approx(v, iaOff, 'ia vs off', 0.001));
});
check('L2 (infeed off): ia mengecil makin jauh fault (105 → 130 → 160 km)', () => {
  const ia = pos => segOf(scenario(pos, false, 1).segs, 'src', 'B').kA;
  const a = ia(105), b = ia(130), c = ia(160);
  if (!(a > b + 0.02 && b > c + 0.02))
    throw new Error(`ia harus turun: ${a} @105, ${b} @130, ${c} @160`);
});

console.log('\nflowSegments — fault di L1 (pos=50)');
{
  const { segs } = scenario(50, false, 1);
  check('L1 off: SATU segmen Sumber→fault (ia=2.47436); tak ada segmen ke B', () => {
    if (segs.length !== 1) throw new Error(`jumlah segmen ${segs.length}, harus 1`);
    const s = segs[0];
    if (s.from !== 'src' || s.to !== 'fault') throw new Error(`jalur salah: ${s.from}→${s.to}`);
    approx(s.kA, 2.47436, 'ia L1 off', 0.002);
  });
}
{
  const { segs } = scenario(50, true, 4);
  check('L1 ×4: segmen infeed B→fault ada (ib=3.14918) di samping Sumber→fault (ia=2.47436)', () => {
    if (segs.length !== 2) throw new Error(`jumlah segmen ${segs.length}, harus 2`);
    const s = segOf(segs, 'src', 'fault'), i = segOf(segs, 'B', 'fault');
    approx(s.kA, 2.47436, 'ia L1 ×4', 0.002);
    approx(i.kA, 3.14918, 'ib L1 ×4', 0.002);
    if (s.color !== 'source' || i.color !== 'infeed') throw new Error(`warna: source=${s.color}, infeed=${i.color}`);
  });
  check('L1 ×4: w infeed (ib) > w sumber (ia) — kontribusi remote lebih besar', () => {
    const s = segOf(segs, 'src', 'fault'), i = segOf(segs, 'B', 'fault');
    if (!(i.w > s.w)) throw new Error(`w infeed ${i.w} harus > w sumber ${s.w}`);
  });
}

/* ============ Seam 2: panah di #sld — jalur, glyph ∝ w, kecepatan tetap ============ */
console.log('\nSVG #sld — geometri panah');
{
  const { sld } = scenario(130, true, 1);
  const arr = parseArrows(sld);
  check('L2 ×1: ada jalur Sumber→B dan B→fault; TIDAK ada panah copper', () => {
    if (arr.length < 3) throw new Error(`panah cuma ${arr.length}`);
    const laneAB = arr.filter(a => Math.abs(a.x1 - SRC) < 1 && Math.abs(a.x2 - XB) < 1);
    const laneBf = arr.filter(a => Math.abs(a.x1 - XB) < 1 && Math.abs(a.x2 - FAULT130) < 1);
    if (!laneAB.length || !laneBf.length) throw new Error(`jalur hilang: AB=${laneAB.length}, Bf=${laneBf.length}`);
    if (arr.some(a => a.fill === 'var(--copper)')) throw new Error('L2 tidak boleh panah copper (infeed menyatu)');
  });
  check('L2 ×1: glyph B→fault (gabungan) JAUH lebih besar dari glyph Sumber→B (ia saja)', () => {
    const gAB = Math.max(...arr.filter(a => Math.abs(a.x1 - SRC) < 1 && Math.abs(a.x2 - XB) < 1).map(a => a.glyph));
    const gBf = Math.max(...arr.filter(a => Math.abs(a.x1 - XB) < 1 && Math.abs(a.x2 - FAULT130) < 1).map(a => a.glyph));
    approx(gAB, glyph(1.15470), 'glyph Sumber→B', 0.2);
    approx(gBf, glyph(4.61880), 'glyph B→fault', 0.2);
    if (!(gBf > gAB + 5)) throw new Error(`B→fault ${gBf} harus > Sumber→B ${gAB} + 5`);
  });
  check('L2 ×1: tidak ada panah melewati fault (semua endpoint ≤ faultX)', () => {
    const bad = arr.filter(a => a.x1 > FAULT130 + 1 || a.x2 > FAULT130 + 1);
    if (bad.length) throw new Error(`${bad.length} panah lewat fault: ${JSON.stringify(bad.slice(0, 3))}`);
  });
}
{
  const { sld } = scenario(130, false, 1);
  const arr = parseArrows(sld);
  check('L2 off: glyph Sumber→B = glyph B→fault (ia = ifK), semua merah', () => {
    const gAB = Math.max(...arr.filter(a => Math.abs(a.x1 - SRC) < 1 && Math.abs(a.x2 - XB) < 1).map(a => a.glyph));
    const gBf = Math.max(...arr.filter(a => Math.abs(a.x1 - XB) < 1 && Math.abs(a.x2 - FAULT130) < 1).map(a => a.glyph));
    approx(gAB, glyph(1.15470), 'glyph AB off', 0.2);
    approx(gBf, glyph(1.15470), 'glyph Bf off', 0.2);
    if (arr.some(a => a.fill !== 'var(--red)')) throw new Error('harus semua merah saat infeed off');
  });
}
{
  const { sld } = scenario(50, true, 4);
  const arr = parseArrows(sld);
  check('L1 ×4: panah merah Sumber→fault & panah copper B→fault (kontribusi infeed)', () => {
    const red = arr.filter(a => a.fill === 'var(--red)');
    const cu = arr.filter(a => a.fill === 'var(--copper)');
    if (!red.length || !cu.length) throw new Error(`red=${red.length}, copper=${cu.length}`);
    if (red.some(a => Math.abs(a.x2 - FAULT50) > 1)) throw new Error('panah sumber harus berakhir di fault (50 km)');
    if (cu.some(a => Math.abs(a.x1 - XB) > 1 || Math.abs(a.x2 - FAULT50) > 1))
      throw new Error('panah copper harus membentang B→fault');
  });
  check('L1 ×4: glyph copper (ib) > glyph merah (ia) — ukuran ∝ arus per segmen', () => {
    const gRed = Math.max(...arr.filter(a => a.fill === 'var(--red)').map(a => a.glyph));
    const gCu = Math.max(...arr.filter(a => a.fill === 'var(--copper)').map(a => a.glyph));
    approx(gRed, glyph(2.47436), 'glyph merah', 0.2);
    approx(gCu, glyph(3.14918), 'glyph copper', 0.2);
    if (!(gCu > gRed + 0.5)) throw new Error(`copper ${gCu} harus > merah ${gRed}`);
  });
}
{
  const { sld } = scenario(130, true, 4);
  const arr = parseArrows(sld);
  check('kecepatan panah konstan: |x2−x1|/dur ≈ 125 px/s di semua segmen', () => {
    if (arr.length < 3) throw new Error('terlalu sedikit panah');
    arr.forEach(a => {
      const v = Math.abs(a.x2 - a.x1) / a.dur;
      if (!(Math.abs(v - 125) <= 3)) throw new Error(`kecepatan ${v.toFixed(1)} px/s (bukan ~125) di ${a.x1}→${a.x2}, dur ${a.dur}`);
    });
  });
}

console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed === 0 ? 0 : 1);
