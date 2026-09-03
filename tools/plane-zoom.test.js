/* Tes TDD: (A) sensitivitas zoom roda yang lebih landai & (B) kanvas R–X adaptif —
   renderPlane memakai ukuran elemen aktual (#plane clientWidth/Height), bukan kunci 640×470,
   sehingga diagram bisa mengisi seluruh kartu (toolbar zoom jadi overlay).
   Stub harness tak punya CSS/layout → #plane.clientWidth di-set manual utk mensimulasikan
   kotak kanvas sebenarnya (mis. hasil fitPlane); tanpa nilai → fallback 640×470.
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
  tol = tol === undefined ? 1e-9 : tol;
  if (!(Math.abs(act - exp) <= tol)) throw new Error(`${ctx}: aktual ${act} ≠ harapan ${exp} (±${tol})`);
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

/* ============ Seam A: wheelZoomFactor (spesifikasi ±8% per 100 px gulir) ============ */
console.log('\nwheelZoomFactor — sensitivitas zoom roda');
{
  const { pub } = load();
  const f = pub.wheelZoomFactor;
  check('100 px gulir (deltaMode 0) = ×1.08', () => approx(f(100, 0), 1.08, 'f(100)', 1e-9));
  check('gulir balik simetris: f(−100,0) = 1/1.08', () => approx(f(-100, 0), 1 / 1.08, 'f(-100)', 1e-12));
  check('tanpa gulir = 1', () => approx(f(0, 0), 1, 'f(0)', 0));
  check('mode garis (deltaMode 1) dinormalisasi ≈16 px/garis → f(1,1) = f(16,0)', () =>
    approx(f(1, 1), f(16, 0), 'line-mode', 1e-12));
  check('mode halaman (deltaMode 2) dinormalisasi ≈400 px → f(1,2) = f(400,0)', () =>
    approx(f(1, 2), f(400, 0), 'page-mode', 1e-12));
  check('trackpad jauh lebih landai dari zoom lama (1.15×/event): f(10px) < 1.012 & f(50px) < 1.06', () => {
    if (!(f(10, 0) - 1 < 0.012)) throw new Error(`f(10)=${f(10, 0)} terlalu besar`);
    if (!(f(50, 0) - 1 < 0.06)) throw new Error(`f(50)=${f(50, 0)} terlalu besar`);
    if (!(f(100, 0) - 1 < 1.15 - 1)) throw new Error('100px masih lebih sensitif dari zoom lama 1.15');
  });
  check('monoton naik thd jarak gulir positif', () => {
    for (const d of [0.1, 10, 40, 90]) if (!(f(d + 1, 0) > f(d, 0))) throw new Error('tidak monoton');
  });
}

/* ============ Seam B: renderPlane adaptif thd ukuran kanvas aktual ============ */
console.log('\nrenderPlane — kanvas mengikuti ukuran elemen (fill card)');
{
  const ctx = load();
  ctx.els.plane.clientWidth = 920; ctx.els.plane.clientHeight = 560;
  ctx.pub.render();
  const svg = ctx.els.plane.innerHTML;
  check('VBH=560: label tick sumbu R di y=560−26+14=548 (bukan 458)', () => contains(svg, 'y="548"', 'tick R bawah'));
  check('VBW=920: judul sumbu R di x=920−12−6=902 (melewati batas lama 640)', () => contains(svg, 'x="902"', 'judul R'));
}
{
  const ctx = load();
  ctx.els.plane.clientWidth = 800; ctx.els.plane.clientHeight = 420;
  ctx.pub.render();
  const svg = ctx.els.plane.innerHTML;
  check('VBH=420: tick R di y=408; bukan sisa y=458 dari ukuran lama', () => {
    contains(svg, 'y="408"', 'tick R 420px');
    notContains(svg, 'y="458"', 'sisa lama');
  });
}
{
  const ctx = load(); // tanpa clientWidth → fallback 640×470 (perilaku lama utk tes DOM)
  const svg = ctx.els.plane.innerHTML;
  check('tanpa ukuran elemen: fallback 640×470 (y tick = 458)', () => contains(svg, 'y="458"', 'fallback'));
}

console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed === 0 ? 0 : 1);
