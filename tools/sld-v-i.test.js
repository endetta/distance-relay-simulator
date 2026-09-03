/* Tes TDD fitur V & I di SLD — computeFaultCircuit() + chip SVG.
   Skenario sintetis bersih (r=0 → angka eksak):
     l1=100 x1=0.5 (Z1=j50), l2=80 x2=0.5 (Z2=j40), zsmag=10 (Zs=j10),
     VLL=150 → E_phase=86.60254 kV, fault di pos=50 km (tengah L1), Rf=0.
   Nilai harapan = hasil hitung tangan (spesifikasi), BUKAN dihitung ulang dgn kode.

   Seam 1 (model): computeFaultCircuit(m) → {buses:{A,B,C:{loopKv}}, currents:{ia,ib,if}}
     loopKv: 3φ & φ-φ = |Vb−Vc| kV; φ-G = |Va| kV (loop yang diukur relay).
     currents: kA primer utk loop gangguan (3φ:I1, φ-φ:√3·I1, φ-G:3·I0).
   Seam 2 (render): renderSLD memuat chip `V <kv> kV`, `I? <kA> kA` dgn toggle P.showVI.
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
  tol = tol === undefined ? 0.02 : tol;          // kV/kA; nilai sintetis seharusnya eksak ±0.02
  if (!(Math.abs(act - exp) <= tol))
    throw new Error(`${ctx}: aktual ${act} ≠ harapan ${exp} (±${tol})`);
}
function contains(hay, needle, ctx) {
  if (!hay.includes(needle)) throw new Error(`${ctx}: tidak memuat ${JSON.stringify(needle)}\n    awal: ${JSON.stringify(hay.slice(0, 400))}…`);
}
function notContains(hay, needle, ctx) {
  if (hay.includes(needle)) throw new Error(`${ctx}: TIDAK BOLEH memuat ${JSON.stringify(needle)}`);
}

function scenario(faultType, infeedOn, infeed) {
  const ctx = loadSimulator(HTML);
  const { pub } = ctx;
  const S = pub.S, P = pub.P;
  /* sintetis murni-reaktif utk angka eksak */
  P.r1 = 0; P.x1 = 0.5; P.l1 = 100;
  P.r2 = 0; P.x2 = 0.5; P.l2 = 80;
  P.zsmag = 10; P.vLL_kV = 150;
  P.pos = 50; P.rf = 0; P.xf = 0; P.rfMode = 'R';
  P.faultType = faultType; P.infeedOn = infeedOn; P.infeed = infeed;
  pub.render();
  const fc = pub.computeFaultCircuit(pub.computeModel());
  return { ctx, fc, sld: ctx.els.sld.innerHTML };
}

/* ============ Seam 1: computeFaultCircuit (model) ============ */
const CASES = [
  ['3ph',  false, 1,   107.143, 0,        0,        2.47436, 0,       2.47436, '3φ off'],
  ['3ph',  true,  1,   107.143, 107.143,  107.143,  2.47436, 2.47436, 4.94872, '3φ ×1'],
  ['3ph',  true,  4,   107.143, 136.364,  136.364,  2.47436, 3.14918, 5.62354, '3φ ×4'],
  ['phph', false, 1,   107.143, 0,        0,        2.14286, 0,       2.14286, 'φ-φ off'],
  ['phph', true,  1,   107.143, 107.143,  107.143,  2.14286, 2.14286, 4.28571, 'φ-φ ×1'],
  ['phph', true,  4,   107.143, 136.364,  136.364,  2.14286, 2.72727, 4.87013, 'φ-φ ×4'],
  ['phg',  false, 1,    61.859, 0,        0,        2.47436, 0,       2.47436, 'φ-G off'],
  ['phg',  true,  1,    61.859, 61.859,   61.859,   2.47436, 2.47436, 4.94872, 'φ-G ×1'],
  ['phg',  true,  4,    61.859, 78.730,   78.730,   2.47436, 3.14918, 5.62354, 'φ-G ×4'],
];
CASES.forEach(([ft, on, x, va, vb, vc, ia, ib, ifK, name]) => {
  check(`model [${name}]: tegangan bus & arus`, () => {
    const { fc } = scenario(ft, on, x);
    approx(fc.buses.A.loopKv, va, `bus A [${name}]`);
    approx(fc.buses.B.loopKv, vb, `bus B [${name}]`);
    approx(fc.buses.C.loopKv, vc, `bus C [${name}]`);
    approx(fc.currents.ia, ia, `IA [${name}]`);
    approx(fc.currents.ib, ib, `IB [${name}]`);
    approx(fc.currents.ifK, ifK, `If [${name}]`);
    if (fc.currents.ib !== 0 && fc.currents.ib < 1e-9) throw new Error('IB harus 0 saat infeed off');
  });
});
check('model: tag loop sesuai tipe gangguan', () => {
  const a = scenario('3ph', true, 1).fc.buses.A, b = scenario('phph', true, 1).fc.buses.A, c = scenario('phg', true, 1).fc.buses.A;
  if (a.tag !== 'V' || b.tag !== 'Vbc' || c.tag !== 'Va') throw new Error(`tag salah: ${a.tag}/${b.tag}/${c.tag}`);
});

/* ============ Seam 2: chip di renderSLD + toggle P.showVI ============ */
check('sld [3φ ×1]: chip tegangan bus, arus sumber & If tampil', () => {
  const { sld } = scenario('3ph', true, 1);
  contains(sld, 'V 107 kV', 'chip bus');
  contains(sld, '2.5 kA', 'chip arus');                 // IA (dekat Sumber) & IB (Infeed)
  contains(sld, 'Infeed on · 2.5 kA', 'chip infeed');
  contains(sld, 'If 4.9 kA', 'If di label gangguan');
});
check('sld [3φ off]: IB tidak tampil saat infeed mati', () => {
  const { sld } = scenario('3ph', false, 1);
  contains(sld, 'If 2.5 kA', 'If');
  notContains(sld, 'Infeed on', 'infeed harus off');
});
check('sld [φ-G ×4]: chip Va (fasa) memakai nilai loop fasa', () => {
  const { sld } = scenario('phg', true, 4);
  contains(sld, 'Va 79 kV', 'chip bus B/C φ-G');
});
check('sld: toggle P.showVI=false menyembunyikan semua chip', () => {
  const { ctx, sld } = scenario('3ph', true, 1);
  contains(sld, 'V 107 kV', 'sebelum dimatikan');
  ctx.pub.P.showVI = false;
  ctx.pub.render();
  const sld2 = ctx.els.sld.innerHTML;
  notContains(sld2, 'kV<', 'chip tegangan harus hilang');
  notContains(sld2, 'If ', 'If harus hilang');
  notContains(sld2, '2.5 kA', 'arus harus hilang');
});

console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed === 0 ? 0 : 1);
