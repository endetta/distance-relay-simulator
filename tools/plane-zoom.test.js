/* Tes TDD bidang R–X (revisi sesi):
   (A) wheelZoomFactor — zoom roda: ±15% per 100 px gulir (deltaMode dinormalisasi),
       tetap landai per-event trackpad (bukan 1.15× per event).
   (B) pinchZoomFactor — zoom dua-jari (wheel dgn ctrlKey): RENGGANGKAN jari (deltaY<0
       di Chrome) = zoom IN, arah dibalik dari perilaku lama yg terbalik; kuat-menengah
       ≈ ×1.08 per 10 px; simetris f(−x)=1/f(x).
   (C) renderPlane adaptif — kanvas mengikuti ukuran elemen (#plane clientWidth/Height).
   (D) Jendela R–X DIPEPETKAN ke kartu — k=1 merapat ke konten (×0.75, bulat tetap
       bulat) dan DIPUSATKAN pd pusat konten yg digambar (gap kiri ≈ gap kanan): di
       kanvas 720×430 label tick R −3..4 & X −2..2; plus clamp NO-CUT di fit default
       supaya konten yg digambar tak pernah terpotong kiri/kanan.
   (E) Label tick R & X membawa halo putih (paint-order stroke) agar terbaca di atas kurva.
   Stub harness tak punya CSS/layout → #plane.clientWidth di-set manual utk mensimulasikan
   kotak kanvas sebenarnya; tanpa nilai → fallback 640×470.
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
/* kumpulkan label tick angka: (a) baris bawah sumbu R (y > VBH−60) dan
   (b) kolom kiri sumbu X (x ≈ padL−5=33). */
function tickNums(svg, VBH) {
  const r = [], x = [];
  for (const m of svg.matchAll(/<text x="(-?[\d.]+)" y="([\d.]+)" font-family="JetBrains Mono"[^>]*>(-?[\d.]+)<\/text>/g)) {
    const px = +m[1], py = +m[2], v = parseFloat(m[3]);
    if (px > 26 && px < 46) x.push({ v, y: py });
    else if (py > VBH - 60) r.push(v);
  }
  x.sort((a, b) => a.y - b.y);
  return { r, x: x.map(t => t.v) };
}

/* ============ Seam A: wheelZoomFactor (±15% per 100 px gulir) ============ */
console.log('\nwheelZoomFactor — sensitivitas zoom roda');
{
  const { pub } = load();
  const f = pub.wheelZoomFactor;
  check('100 px gulir (deltaMode 0) = ×1.15', () => approx(f(100, 0), 1.15, 'f(100)', 1e-9));
  check('gulir balik simetris: f(−100,0) = 1/1.15', () => approx(f(-100, 0), 1 / 1.15, 'f(-100)', 1e-12));
  check('tanpa gulir = 1', () => approx(f(0, 0), 1, 'f(0)', 0));
  check('mode garis (deltaMode 1) dinormalisasi ≈16 px/garis → f(1,1) = f(16,0)', () =>
    approx(f(1, 1), f(16, 0), 'line-mode', 1e-12));
  check('mode halaman (deltaMode 2) dinormalisasi ≈400 px → f(1,2) = f(400,0)', () =>
    approx(f(1, 2), f(400, 0), 'page-mode', 1e-12));
  check('trackpad tetap landai per event kecil: f(5px)−1 < 0.008 & f(50px)−1 < 0.075', () => {
    if (!(f(5, 0) - 1 < 0.008)) throw new Error(`f(5)=${f(5, 0)} terlalu besar per event`);
    if (!(f(50, 0) - 1 < 0.075)) throw new Error(`f(50)=${f(50, 0)} terlalu besar`);
    if (!(f(100, 0) - 1 <= 0.15)) throw new Error('100px tidak boleh melebihi zoom lama 1.15/event');
  });
  check('monoton naik thd jarak gulir positif', () => {
    for (const d of [0.1, 10, 40, 90]) if (!(f(d + 1, 0) > f(d, 0))) throw new Error('tidak monoton');
  });
}

/* ============ Seam B: pinchZoomFactor (zoom dua-jari touchpad) ============ */
console.log('\npinchZoomFactor — zoom dua-jari (ctrlKey wheel), arah dibalik & kuat-menengah');
{
  const { pub } = load();
  const f = pub.pinchZoomFactor;
  check('helper tersedia (diekspor harness)', () => { if (typeof f !== 'function') throw new Error('pinchZoomFactor tidak diekspor'); });
  check('RENGGANGKAN (deltaY<0) = zoom IN: f(−10) = ×1.08', () => approx(f(-10), 1.08, 'f(-10)', 1e-9));
  check('rapatkan (deltaY>0) = zoom OUT: f(10) = 1/1.08', () => approx(f(10), 1 / 1.08, 'f(10)', 1e-12));
  check('tanpa gerak = 1', () => approx(f(0), 1, 'f(0)', 0));
  check('simetris: f(−x)·f(x) = 1', () => {
    for (const d of [1, 5, 20, 60]) if (!(Math.abs(f(-d) * f(d) - 1) < 1e-12)) throw new Error(`f(−${d})·f(${d}) ≠ 1`);
  });
  check('kuat-menengah: per 10 px = ×1.05..1.15; per 5 px = ×1.03..1.08', () => {
    const a = f(-10) - 1, b = f(-5) - 1;
    if (!(a > 0.05 && a < 0.15)) throw new Error(`f(−10)−1=${a} di luar 5–15%`);
    if (!(b > 0.03 && b < 0.08)) throw new Error(`f(−5)−1=${b} di luar 3–8%`);
  });
  check('arah: jari renggang (negatif) SELALU memperbesar, rapat (positif) memperkecil', () => {
    for (const d of [1, 10, 40]) if (!(f(-d) > 1 && f(d) < 1)) throw new Error('arah terbalik');
  });
  check('monoton: makin lebar renggangan makin besar zoom-nya', () => {
    for (const d of [1, 10, 40, 90]) if (!(f(-(d + 1)) > f(-d))) throw new Error('tidak monoton');
  });
}

/* ============ Seam C: renderPlane adaptif thd ukuran kanvas aktual ============ */
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

/* ============ Seam D: jendela DIPEPETKAN — RX diagram mengisi kartu ============
   WIDE<1 membuat k=1 merapat ke konten (margin kiri–kanan kecil), plus clamp
   no-cut: di fit default jendela R otomatis melebar bila kurva DIGAMBAR akan
   terpotong sisi (kanvas persegi). Lingkaran tetap bulat (rasio dijaga). */
console.log('\nrenderPlane — jendela dipepetkan (isi kartu, tanpa potong kurva)');
/* ambil ekstrem px zona (lingkaran & rect dgn fill zona) thd kotak plot */
function zoneExtremes(svg, padL, plotW) {
  let lmn = 1e9, lmx = -1e9;
  for (const m2 of svg.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)" fill="var\(--(?:red|copper|blue)\)"/g)) {
    const x = +m2[1], r = +m2[3]; if (x - r < lmn) lmn = x - r; if (x + r > lmx) lmx = x + r;
  }
  for (const m2 of svg.matchAll(/<rect x="(-?[\d.]+)" y="[\d.]+" width="([\d.]+)" height="[\d.]+" fill="var\(--(?:red|copper|blue)\)"/g)) {
    const x = +m2[1], wd = +m2[2]; if (x < lmn) lmn = x; if (x + wd > lmx) lmx = x + wd;
  }
  return { lmn, lmx };
}
{
  const ctx = load();
  ctx.els.plane.clientWidth = 720; ctx.els.plane.clientHeight = 430;
  ctx.pub.render();
  const svg = ctx.els.plane.innerHTML;
  const { r, x } = tickNums(svg, 430);
  check('label R −3..4 (window dipusatkan pd konten: kiri −3, kanan +4)', () => {
    contains(r.map(String).join(','), '-3', 'ekor kiri sumbu R');
    contains(r.map(String).join(','), '3', 'tengah sumbu R');
    contains(r.map(String).join(','), '4', 'ekor kanan sumbu R');
    notContains(r.map(String).join(','), '-4', 'tidak boleh lebih kiri dari −3');
    notContains(r.map(String).join(','), '5', 'tidak boleh lebih kanan dari +4');
  });
  check('label X −2..2 (window ±~2.2, BUKAN −3..3)', () => {
    contains(x.map(String).join(','), '-2', 'ekor bawah sumbu X');
    contains(x.map(String).join(','), '2', 'ekor atas sumbu X');
    notContains(x.map(String).join(','), '-3', 'versi lama −3');
  });
  check('kurva mengisi lebar plot: gap kiri < 10% & gap kanan < 10% & rata (|Δ| < 2%)', () => {
    const gm = svg.match(/clipPath id="clipZ\d+"><rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/);
    const padL = +gm[1], plotW = +gm[2];
    const { lmn, lmx } = zoneExtremes(svg, padL, plotW);
    const gl = (lmn - padL) / plotW, gr = (padL + plotW - lmx) / plotW;
    if (!(gl < 0.10)) throw new Error(`gap kiri ${(gl * 100).toFixed(1)}% ≥ 10%`);
    if (!(gr < 0.10)) throw new Error(`gap kanan ${(gr * 100).toFixed(1)}% ≥ 10%`);
    if (!(Math.abs(gl - gr) < 0.02)) throw new Error(`gap tak rata: kiri ${(gl * 100).toFixed(1)}% vs kanan ${(gr * 100).toFixed(1)}%`);
  });
  check('lingkaran tetap bulat: step tick R & X memakai px/Ω sama', () => {
    const r2 = r.sort((a, b) => a - b), x2 = x.sort((a, b) => a - b);
    const rStep = (r2[r2.length - 1] - r2[0]) / (r2.length - 1);
    const xStep = (x2[x2.length - 1] - x2[0]) / (x2.length - 1);
    if (Math.abs(rStep - 1) > 1e-6 || Math.abs(xStep - 1) > 1e-6) throw new Error(`step R=${rStep} X=${xStep}`);
  });
}
{
  /* kanvas lebih persegi: tanpa clamp jendela R akan memotong kurva kanan;
     clamp no-cut harus melebarkan jendela sampai SEMUA zona masuk plot. */
  const ctx = load();
  ctx.els.plane.clientWidth = 700; ctx.els.plane.clientHeight = 560;
  ctx.pub.render();
  const svg = ctx.els.plane.innerHTML;
  check('clamp no-cut: di kanvas persegi tak ada zona terpotong sisi (max cx+r ≤ tepi plot)', () => {
    const gm = svg.match(/clipPath id="clipZ\d+"><rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/);
    const padL = +gm[1], plotW = +gm[2];
    const { lmx } = zoneExtremes(svg, padL, plotW);
    if (!(lmx <= padL + plotW + 0.01)) throw new Error(`zona kanan ${lmx.toFixed(0)}px > tepi plot ${(padL + plotW).toFixed(0)}px`);
    // clamp aktif: gap kanan ≈ margin 0.15 Ω (≤ 5%) — tanpa clamp zona kanan akan terpotong
    const gr = (padL + plotW - lmx) / plotW;
    if (!(gr <= 0.05)) throw new Error(`gap kanan ${(gr * 100).toFixed(1)}% — clamp no-cut tidak melebar`);
  });
}

/* ============ Seam E: label tick punya outline putih (terbaca di atas kurva) ============ */
console.log('\nrenderPlane — label tick dgn halo putih (paint-order stroke)');
{
  const ctx = load();
  ctx.els.plane.clientWidth = 720; ctx.els.plane.clientHeight = 430;
  ctx.pub.render();
  const svg = ctx.els.plane.innerHTML;
  const halos = svg.match(/stroke="var\(--surface\)" stroke-width="3" paint-order="stroke"/g) || [];
  check('setiap label tick angka (R & X) membawa halo putih', () => {
    if (halos.length < 8) throw new Error(`hanya ${halos.length} label ber-halo — harap ≥ 8 (tick R 9 + X 5)`);
  });
  check('halo menempel pada teks tick (font-family JetBrains Mono, ukuran 9)', () => {
    const sample = svg.match(/<text x="(-?[\d.]+)" y="([\d.]+)" font-family="JetBrains Mono" font-size="9" fill="var\(--ink-soft\)" stroke="var\(--surface\)" stroke-width="3" paint-order="stroke"/g) || [];
    if (sample.length < 8) throw new Error(`teks tick ber-halo hanya ${sample.length}`);
  });
}

console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed === 0 ? 0 : 1);
