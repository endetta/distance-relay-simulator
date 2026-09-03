/* Tes lensa beban (load-encroachment lens) pada bidang R-X.
   Cara jalankan: node --test tools/
   Seam yang diuji (sudah disepakati di CLAUDE.md):
     1. computeModel() -> loadzMin / loadzNom (Ω sekunder)
     2. string SVG #plane hasil render() — geometri path lensa di-flatten dan
        diukur dalam KOORDINAT DATA (Ω) via pemetaan label tick sumbu. */
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

/* Flatten SEMUA geometri path (lensa = satu-satunya <path> di #plane) lalu
   konversi tiap titik ke data (Ω). Parser perintah-per-intah: M/L pakai pasangan
   (x,y); A (arc SVG) berformat `A rx ry rot large-arc sweep x y` — endpoint =
   DUA angka TERAKHIR, bukan rx/ry (bug alat ukur: rx/ry terbaca sbg koordinat). */
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

/* ---------- 2. GEOMETRI: lensa di kuadran induktif saja ---------- */
test('lensa: seluruhnya di R>0 (sisi resistif kanan origin)', () => {
  const b = bbox(lensPoints(planeSvg(ctx.els ? ctx : ctx)));
  assert.ok(b.minR > 0, `minR ${b.minR.toFixed(2)} harus > 0`);
});

test('lensa: tidak masuk daerah kapasitif (X ≥ −0.5 Ω)', () => {
  const b = bbox(lensPoints(planeSvg(ctx)));
  assert.ok(b.minX >= -0.5, `minX ${b.minX.toFixed(2)} — bagian kapasitif dilarang`);
});

test('lensa: sektor menempel sumbu R — tepi bawah ≈ sumbu R (X≈0 di R≥rIn)', () => {
  // endpoint M pertama & A terakhir adalah sudut-sudut sektor pada tepi bawah/atas;
  // minimal dua titik tepi harus X≈0 (sentuhan dgn sumbu R)
  const pts = lensPoints(planeSvg(ctx));
  const near = pts.filter(p => Math.abs(p.X) < 1 && p.R > 1);
  assert.ok(near.length >= 2, `titik tepi X≈0 hanya ${near.length} — lensa tidak menempel sumbu R`);
});

test('lensa: kompak — lebar R ≤ 3.5× tinggi X (bukan bowtie raksasa)', () => {
  const b = bbox(lensPoints(planeSvg(ctx)));
  const w = b.maxR - b.minR, h = b.maxX - b.minX;
  assert.ok(w <= 3.5 * h, `lebar ${w.toFixed(1)} Ω > 3.5 × tinggi ${h.toFixed(1)} Ω`);
});

/* ---------- 3. KONSISTENSI DGN ISI PANEL ---------- */
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
  assert.ok(angDeg >= 0 && angDeg <= la, `sudut sistem ${angDeg}° di luar [0, ${la}°]`);
});

test('zona relay tetap di luar/di bawah batas dalam lensa (zone3 < loadzMin)', () => {
  const m = ctx.pub.computeModel();
  const z = ctx.pub.relayZones(ctx.pub.S.relays[0], m);
  assert.ok(Math.hypot(z.zone3.R, z.zone3.X) < m.loadzMin, 'zone 3 menembus lensa beban');
});

/* ---------- 4. INVARIANS SKALA (regresi bug lama) ---------- */
test('lensa TIDAK memengaruhi skala plot: span grid sama dgn showLoad=off', () => {
  const P = ctx.pub.P;
  const ticks1 = readTicks(planeSvg(ctx)).r;
  P.showLoad = false; ctx.pub.render();
  const ticks2 = readTicks(planeSvg(ctx)).r;
  P.showLoad = true; ctx.pub.render();
  assert.ok(Math.abs(ticks1.slope - ticks2.slope) < 1e-9, 'skala berubah saat lensa on/off');
});
