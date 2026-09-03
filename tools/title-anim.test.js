/* tools/title-anim.test.js — Seam judul header (gradien ink→copper-deep + kilau
   menyapu kiri→kanan + teks bergantian tt-a/tt-b), Seam animasi collapse
   (grid-template-rows 1fr→0fr + fade, bukan display:none), Seam pemusatan kartu
   saat SEMUA diciutkan (.params-panel.all-collapsed). RED → GREEN: tulis dulu,
   jalankan merah, implementasi, lalu hijau. */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadSimulator } = require('./lens-harness');

const HTML = path.join(__dirname, '..', 'distance_relay_simulator.html');
const src = fs.readFileSync(HTML, 'utf8');
const css = (src.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';

let pass = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  \u2714 ' + name); }
  catch (e) { console.error('  \u2717 ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

/* ---------- Seam A: judul header ---------- */
t('judul: dua span .tt-a (utama) & .tt-b ("by Sheva - Endetta")', () => {
  assert.ok(src.includes('<span class="tt-a">Simulator Distance Relay</span>'), 'tt-a tidak ada');
  assert.ok(src.includes('<span class="tt-b">by Sheva - Endetta</span>'), 'tt-b tidak ada');
});
t('judul: gradien .tt memakai --ink & --copper-deep, TANPA --teal', () => {
  const rule = (css.match(/\.topbar \.tt\{[^}]*\}/) || [''])[0];
  assert.ok(rule.length > 0, 'rule .topbar .tt tidak ditemukan');
  assert.ok(!rule.includes('--teal'), 'masih ada --teal di rule .tt');
  const spanRule = (css.match(/\.topbar \.tt-a,\.topbar \.tt-b\{[^}]*\}/) || [''])[0];
  assert.ok(spanRule.includes('--ink'), 'tidak ada --ink');
  assert.ok(spanRule.includes('--copper-deep'), 'tidak ada --copper-deep');
  assert.ok(spanRule.includes('-webkit-background-clip:text'), 'clip teks hilang');
});
t('judul: kilau menyapu kiri→kanan (@keyframes ttShine + background-size)', () => {
  assert.ok(css.includes('@keyframes ttShine'), 'keyframes ttShine tidak ada');
  assert.ok(/@keyframes ttShine\{[^}]*background-position[^}]*\}/.test(css), 'ttShine tidak menggerakkan background-position');
  const spanRule = (css.match(/\.topbar \.tt-a,\.topbar \.tt-b\{[^}]*\}/) || [''])[0];
  assert.ok(spanRule.includes('background-size'), 'band kilau (background-size) hilang');
  assert.ok((css.match(/ttShine/g) || []).length >= 3, 'ttShine harus dipakai kedua span (rule a & b) + keyframes');
});
t('judul: pergantian teks via @keyframes ttSwapA/ttSwapB + .tt-b absolut', () => {
  assert.ok(css.includes('@keyframes ttSwapA'), 'ttSwapA tidak ada');
  assert.ok(css.includes('@keyframes ttSwapB'), 'ttSwapB tidak ada');
  const aRule = (css.match(/\.topbar \.tt-a\{[^}]*\}/) || [''])[0];
  const bRule = (css.match(/\.topbar \.tt-b\{position:absolute[^}]*\}/) || [''])[0];
  assert.ok(aRule.includes('ttSwapA'), 'tt-a tidak memakai ttSwapA');
  assert.ok(bRule.includes('ttSwapB'), 'tt-b tidak memakai ttSwapB');
  assert.ok(bRule.includes('position:absolute'), 'tt-b harus absolut');
});
t('judul: prefers-reduced-motion mematikan animasi & menyembunyikan tt-b', () => {
  const blocks = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\{[\s\S]*?\}/g) || [];
  const mine = blocks.find(b => b.includes('.topbar .tt-b'));
  assert.ok(mine, 'media block utk judul tidak ada');
  assert.ok(/animation\s*:\s*none/.test(mine), 'animation:none tidak ada');
});

/* ---------- Seam B: animasi collapse ---------- */
t('collapse: 4 wrapper .card-b-i (kartu parameter saja, bukan modal)', () => {
  const n = (src.match(/<div class="card-b-i[^>]*>/g) || []).length;
  const relay = (src.match(/<div class="card-b-i" id="relayList"><\/div>/g) || []).length;
  assert.strictEqual(n, 4, 'jumlah .card-b-i = ' + n);
  assert.strictEqual(relay, 1, 'relayList harus dibungkus card-b-i');
  const wrapped = (src.match(/<div class="card-b"[^>]*>\s*<div class="card-b-i[^>]*>/g) || []).length;
  assert.strictEqual(wrapped, 4, 'card-b yang langsung membungkus card-b-i = ' + wrapped);
});
t('collapse: transisi grid 1fr→0fr + fade (bukan display:none) + wrapper overflow-hidden', () => {
  assert.ok(!css.includes('.card.collapsed .card-b{display:none'), 'display:none lama masih ada');
  assert.ok(css.includes('grid-template-rows:0fr;opacity:0'), '0fr/opacity:0 tidak ada');
  assert.ok(css.includes('.card .card-b{display:grid;grid-template-rows:1fr'), '1fr tidak ada');
  assert.ok(css.includes('.card .card-b-i{overflow:hidden;min-height:0'), 'wrapper tidak overflow-hidden/min-height:0');
});

/* ---------- Seam C: pemusatan saat semua diciutkan ---------- */
t('pusat: CSS .params-panel.all-collapsed{justify-content:center}', () => {
  assert.ok(css.includes('.params-panel.all-collapsed{justify-content:center;}'), 'rule pemusatan tidak ada');
});
t('pusat: syncCollapsedCentering diekspor & menoggle kelas all-collapsed', () => {
  const { pub, els } = loadSimulator(HTML);
  assert.strictEqual(typeof pub.syncCollapsedCentering, 'function', 'syncCollapsedCentering tidak diekspor');
  pub.S.ui.collapsed = { line: true, load: true, fault: true, relays: true };
  pub.syncCollapsedCentering();
  assert.ok(els.paramsPanel.classList.contains('all-collapsed'), 'semua diciutkan → kelas tidak ada');
  pub.S.ui.collapsed.load = false;
  pub.syncCollapsedCentering();
  assert.ok(!els.paramsPanel.classList.contains('all-collapsed'), 'satu dibuka → kelas masih ada');
});

console.log('\n  title-anim: ' + pass + ' asersi lulus');