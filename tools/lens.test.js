/* Tes lensa beban (load-encroachment lens) pada bidang R-X.
   Cara jalankan: node --test tools/lens.test.js
   Seam yang diuji (disepakati sesi ini):
     1. computeModel() -> loadzMin / loadzNom (Ω sekunder) — formula PRC-023 0.85·V²/S
     2. Bentuk lensa: wedge SIMETRIS ±(pf+margin) dgn 4 pojok difillet (bukan sektor
        tajam satu sisi) — helper murni loadRegion/loadRegionPoints + string SVG #plane
     3. Titik sistem NORMAL DINAMIS: mengelilingi zlNow dalam ellipse kecil via
        <animateMotion> (path tertutup M…Z), ellipse tetap DI DALAM lensa. */
'use strict';
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require_ = createRequire(import.meta.url);
const { loadSimulator, planeSvg } = require_('./lens-harness.js');

const FILE = fileURLToPath(new URL('../distance_relay_simulator.html', import.meta.url));

let ctx;
test.before(() => { ctx = loadSimulator(FILE); });
const rad = d => d * Math.PI / 180;

/* ---------- util: pemetaan px -> data dari tick label SVG ---------- */
function readTicks(svg) {
  const rt = [...svg.matchAll(/<text x="([\d.]+)" y="458"[^>]*>([^<]+)<\/text>/g)]
    .map(m => ({ px: +m[1], v: +m[2] }));
  const xt = [...svg.matchAll(/<text x="33" y="([\d.]+)"[^>]*text-anchor="end">([^<]+)<\/text>/g)]
    .map(m => ({ px: +m[1], v: +m[2] }));
  assert.ok(rt.length >= 2 && xt.length >= 2, 'tick R dan X harus ada');
  const lin = a => { // regresi linear px->nilai (robust utk floating error)
    const n = a.length, sx = a.reduce((s, t) => s + t.px, 0), sv = a.reduce((s, t) => s + t.v, 0);
    const sxx = a.reduce((s, t) => s + t.px * t.px, 0), sxv = a.reduce((s, t) => s + t.px * t.v, 0);
    const slope = (n * sxv - sx * sv) / (n * sxx - sx * sx);
    return { slope, b0: (sv - slope * sx) / n };
  };
  return { r: lin(rt), x: lin(xt) };
}
const toR = (t, px) => t.r.slope * px + t.r.b0;
const toX = (t, px) => t.x.slope * px + t.x.b0;

/* Flatten SEMUA geometri path (lensa = <path> pertama di #plane) lalu
   konversi tiap titik ke data (Ω). Parser perintah-perintah: M/L pakai pasangan
   (x,y); A (arc SVG) berformat `A rx ry rot large-arc sweep x y` — endpoint =
   DUA angka TERAKHIR, bukan rx/ry. */
function lensPoints(svg) {
  const t = readTicks(svg);
  const d = (svg.match(/<path[^>]*d="([^"]+)"/) || [])[1];
  assert.ok(d, 'path lensa beban harus ada di #plane');
  const pts = [];
  for (const m of d.matchAll(/([MLAZ])([^MLAZ]*)/g)) {
    const cmd = m[1];
    const nums = [...m[2].matchAll(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)].map(n => +n[0]);
    if (cmd === 'M' || cmd === 'L') {
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ R: toR(t, nums[i]), X: toX(t, nums[i + 1]) });
    } else if (cmd === 'A' && nums.length >= 7) {
      pts.push({ R: toR(t, nums[nums.length - 2]), X: toX(t, nums[nums.length - 1]) });
    }
  }
  assert.ok(pts.length >= 4, `lensa harus punya >=4 titik tepi, dapat ${pts.length}`);
  return pts;
}
const bbox = pts => ({
  minR: Math.min(...pts.map(p => p.R)), maxR: Math.max(...pts.map(p => p.R)),
  minX: Math.min(...pts.map(p => p.X)), maxX: Math.max(...pts.map(p => p.X)),
});

/* ---------- 1. MODEL: loadability sesuai PRC-023 ---------- */
test('model: batas dalam = 0.85·V²/S maks (Ω sekunder) — konvensi PRC-023', () => {
  const m = ctx.pub.computeModel();
  const conv = ctx.pub.P.ctr / ctx.pub.P.ptr;
  const expected = 0.85 * (150e3) ** 2 / (120e6) * conv; // 10.08 Ω primer → sekunder
  assert.ok(Math.abs(m.loadzMin - expected) < 0.01, `loadzMin ${m.loadzMin} != ${expected}`);
});

test('model: rasio batas luar/dalam realistis (≤3), bukan 5×', () => {
  const m = ctx.pub.computeModel();
  const ratio = m.loadzNom / m.loadzMin;
  assert.ok(ratio > 1.2 && ratio <= 3.0, `rasio ${ratio.toFixed(2)}× di luar 1.2–3.0`);
});

/* ---------- 2. GEOMETRI: wedge simetris ±θ, pojok difillet ---------- */
test('lensa: SIMETRIS terhadap sumbu R — minX ≈ −maxX (beban boleh leading & lagging)', () => {
  const b = bbox(lensPoints(planeSvg(ctx)));
  assert.ok(b.minX < 0, `minX ${b.minX.toFixed(2)} harus negatif (sisi leading)`);
  assert.ok(Math.abs(b.minX + b.maxX) < 0.6, `tak simetris: minX ${b.minX.toFixed(2)} vs maxX ${b.maxX.toFixed(2)}`);
});

test('lensa: seluruhnya di R>0 (sisi resistif kanan origin)', () => {
  const b = bbox(lensPoints(planeSvg(ctx)));
  assert.ok(b.minR > 0, `minR ${b.minR.toFixed(2)} harus > 0`);
});

test('lensa: pojok tajam dibuang — path memakai ≥6 arc (A: 4 fillet + 2 busur)', () => {
  const svg = planeSvg(ctx);
  const d = (svg.match(/<path[^>]*d="([^"]+)"/) || [])[1];
  const arcs = (d.match(/ A /g) || []).length;
  assert.ok(arcs >= 6, `hanya ${arcs} arc — sektor tajam tidak difillet`);
});

test('loadRegion: tangensi fillet (literal hitung tangan, θ=35°, rIn=9.35, rOut=22)', () => {
  const L = ctx.pub.loadRegion(9.35, 22.0, rad(35));
  assert.ok(Math.abs(L.rf - 1.265) < 0.01, `rf ${L.rf.toFixed(3)} != 1.265`);
  assert.ok(Math.abs(L.phiI - rad(28.16)) < 0.005, `phiI ${L.phiI.toFixed(4)} != 28.16°`);
  assert.ok(Math.abs(L.phiO - rad(31.50)) < 0.005, `phiO ${L.phiO.toFixed(4)} != 31.50°`);
  assert.ok(Math.abs(L.ri1 - 10.54) < 0.05, `ri1 ${L.ri1.toFixed(2)} != 10.54`);
  assert.ok(Math.abs(L.ri2 - 20.70) < 0.05, `ri2 ${L.ri2.toFixed(2)} != 20.70`);
  // busur dalam/ luar menembus sumbu R (tidak ada celah di 0°): phiI > 0.3·th
  assert.ok(L.phiI > 0.3 * L.th, 'phiI terlalu kecil — celah di sumbu R');
});

test('loadRegionPoints: 8 jangkar — simetris, radius ∈ [rIn,rOut], pojok terpotong', () => {
  const { pts, L } = ctx.pub.loadRegionPoints(9.35, 22.0, rad(35));
  assert.strictEqual(pts.length, 8, `jangkar ${pts.length} != 8`);
  // pasangan cermin (sumbu R): [0,3] [1,2] [4,7] [5,6] — titik ±θ dengan jari-jari sama
  for (const [i, j] of [[0, 3], [1, 2], [4, 7], [5, 6]]) {
    const a = pts[i], b = pts[j];
    assert.ok(Math.abs(a.R - b.R) < 0.01 && Math.abs(a.X + b.X) < 0.01, `pasangan ${i}/${j} tak simetris`);
  }
  for (const p of pts) {
    const z = Math.hypot(p.R, p.X);
    assert.ok(z >= 9.35 - 0.05 && z <= 22.0 + 0.05, `radius ${z.toFixed(2)} di luar [rIn,rOut]`);
  }
  // pojok sektor asli (rOut @ ±θ) TIDAK ada sebagai jangkar — sudah dipotong fillet
  const corner = { R: 22 * Math.cos(rad(35)), X: 22 * Math.sin(rad(35)) };
  const dMin = Math.min(...pts.map(p => Math.hypot(p.R - corner.R, p.X - corner.X)));
  assert.ok(dMin > L.rf * 0.5, `pojok sektor masih ada (jarak ${dMin.toFixed(2)} Ω)`);
});

test('loadRegion: degenerasi (θ kecil / lensa tipis) → fallback wedge tajam, tanpa NaN', () => {
  const L0 = ctx.pub.loadRegion(1, 2, rad(2));
  assert.strictEqual(L0.rf, 0, 'θ < ambang harus fallback rf=0');
  const pts = ctx.pub.loadRegionPoints(1, 2, rad(2)).pts;
  for (const p of pts) {
    assert.ok(Number.isFinite(p.R) && Number.isFinite(p.X), 'NaN di jangkar fallback');
    const z = Math.hypot(p.R, p.X);
    assert.ok(z >= 0.9 && z <= 2.1, `radius ${z.toFixed(2)} tak wajar`);
  }
});

/* ---------- 3. TITIK SISTEM NORMAL — DINAMIS (ellipse di dalam lensa) ---------- */
test('titik dinamis: animateMotion dgn path ellipse TERTUTUP (M…Z) + dur 8–25 s + indefinite', () => {
  const svg = planeSvg(ctx);
  const m = svg.match(/<animateMotion dur="([\d.]+)s" repeatCount="indefinite" path="M ([^"]+)"/);
  assert.ok(m, 'animateMotion titik sistem tidak ada');
  assert.ok(+m[1] >= 8 && +m[1] <= 25, `dur ${m[1]}s di luar 8–25 s`);
  assert.ok(m[2].includes(' Z'), 'path gerak tidak tertutup (Z)');
});

test('titik dinamis: 4 titik kardinal ellipse tetap DI DALAM lensa', () => {
  const svg = planeSvg(ctx);
  const m = svg.match(/<animateMotion dur="[\d.]+s" repeatCount="indefinite" path="M ([^"]+)"/);
  assert.ok(m, 'animateMotion tidak ada');
  const nums = [...m[1].matchAll(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)].map(n => +n[0]);
  // M x0 y0 A rx ry rot 0 1 x1 y1 A rx ry rot 0 1 x0 y0 Z
  const x0 = nums[0], y0 = nums[1], rx = nums[2], ry = nums[3];
  const x1 = nums[7], y1 = nums[8];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const vx = -dy / len, vy = dx / len; // vektor tangensial (tegak lurus sumbu besar)
  const pts = [
    { px: x0, py: y0 }, { px: x1, py: y1 },                       // ujung radial
    { px: cx + ry * vx, py: cy + ry * vy },                        // ujung tangensial +
    { px: cx - ry * vx, py: cy - ry * vy },                        // ujung tangensial −
  ];
  const t = readTicks(svg);
  const m2 = ctx.pub.computeModel();
  const th = rad(ctx.pub.P.pfAngleDeg + ctx.pub.P.loadEncroachDeg);
  for (const p of pts) {
    const R = toR(t, p.px), X = toX(t, p.py);
    const z = Math.hypot(R, X), a = Math.atan2(X, R);
    assert.ok(z >= m2.loadzMin - 0.3 && z <= m2.loadzNom + 0.3,
      `kardinal |Z| ${z.toFixed(2)} di luar [${m2.loadzMin.toFixed(2)}, ${m2.loadzNom.toFixed(2)}]`);
    assert.ok(Math.abs(a) <= th + 0.02, `kardinal sudut ${(a * 180 / Math.PI).toFixed(1)}° > ±${(th * 180 / Math.PI).toFixed(1)}°`);
  }
});

test('titik dinamis: ellipse radial ≠ tangensial (rx≠ry — bukan lingkaran)', () => {
  const svg = planeSvg(ctx);
  const m = svg.match(/<animateMotion dur="[\d.]+s" repeatCount="indefinite" path="M ([^"]+)"/);
  const nums = [...m[1].matchAll(/-?\d*\.?\d+/g)].map(n => +n[0]);
  const rx = nums[2], ry = nums[3];
  assert.ok(Math.abs(rx - ry) > 0.5, `rx ${rx.toFixed(1)} ≈ ry ${ry.toFixed(1)} — lingkaran, bukan ellipse`);
});

/* ---------- 4. KONSISTENSI DGN ISI PANEL ---------- */
test('label lensa konsisten dgn model & masuk akal (< 30 Ω sekunder)', () => {
  const svg = planeSvg(ctx);
  const label = svg.match(/lensa beban \(([\d.]+)–([\d.]+) Ω\)/);
  assert.ok(label, 'label lensa beban harus ada');
  const m = ctx.pub.computeModel();
  assert.ok(Math.abs(+label[1] - m.loadzMin) < 0.15, 'batas dlm label != loadzMin');
  assert.ok(Math.abs(+label[2] - m.loadzNom) < 0.15, 'batas luar label != loadzNom');
  assert.ok(m.loadzNom < 30, `loadzNom ${m.loadzNom} Ω — terlalu jauh`);
});

test('titik sistem (beban normal) berada DI DALAM lensa', () => {
  const m = ctx.pub.computeModel();
  const mag = Math.hypot(m.zlNow.R, m.zlNow.X);
  const angDeg = Math.atan2(m.zlNow.X, m.zlNow.R) * 180 / Math.PI;
  const la = ctx.pub.P.pfAngleDeg + ctx.pub.P.loadEncroachDeg;
  assert.ok(mag >= m.loadzMin && mag <= m.loadzNom, `|Z sistem| ${mag.toFixed(1)} di luar [${m.loadzMin.toFixed(1)}, ${m.loadzNom.toFixed(1)}]`);
  assert.ok(Math.abs(angDeg) <= la, `sudut sistem ${angDeg}° di luar ±${la}°`);
});

test('zona relay tetap di luar/di bawah batas dalam lensa (zone3 < loadzMin)', () => {
  const m = ctx.pub.computeModel();
  const z = ctx.pub.relayZones(ctx.pub.S.relays[0], m);
  assert.ok(Math.hypot(z.zone3.R, z.zone3.X) < m.loadzMin, 'zone 3 menembus lensa beban');
});

/* ---------- 5. INVARIANS SKALA (regresi bug lama) ---------- */
test('lensa TIDAK memengaruhi skala plot: span grid sama dgn showLoad=off', () => {
  const P = ctx.pub.P;
  const ticks1 = readTicks(planeSvg(ctx)).r;
  P.showLoad = false; ctx.pub.render();
  const ticks2 = readTicks(planeSvg(ctx)).r;
  P.showLoad = true; ctx.pub.render();
  assert.ok(Math.abs(ticks1.slope - ticks2.slope) < 1e-9, 'skala berubah saat lensa on/off');
});