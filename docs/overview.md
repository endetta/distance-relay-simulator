# Overview Proyek — Simulator Distance Relay

> **Cara pakai dokumen ini:** AI (atau manusia) yang ingin *debug*, *review*, atau menambah
> fitur cukup baca file ini dulu untuk mendapat peta mental utuh, lalu telusuri bagian
> `distance_relay_simulator.html` yang relevan. Detail baris demi baris ada di `CLAUDE.md`.

## TL;DR

Satu aplikasi browser mandiri dalam **satu file HTML**: `distance_relay_simulator.html`
(markup + CSS + satu blok `<script>` ≈ 1400 baris). Tidak ada build system, framework,
package manager, atau backend. Ini simulator **edukasi bahasa Indonesia** untuk proteksi
*distance relay*: memetakan karakteristik relay (Impedance/Reactance/Mho/Quadrilateral) di
bidang R–X, plus SLD interaktif dan kartu pembacaan hasil trip (detail relay terpilih atau
sekuens trip seluruh relay).
Satu-satunya dependensi eksternal: Google Fonts via CDN (opsional, core tetap jalan).

**Loop inti:** semua kontrol menulis ke satu objek state `S` (param di `S.param`/`P`) →
`render()` → `computeModel()` → `decideRelay()` per relay → empat renderer murni yang
mengisi `innerHTML` elemen SVG/div. Tidak ada state lain.

## Menjalankan

Buka file langsung di browser (`file:///`), atau `python -m http.server` / `npx serve`.

## Peta file

| File | Isi |
|---|---|
| `distance_relay_simulator.html` | Seluruh aplikasi. |
| `CLAUDE.md` | Panduan arsitektur/konvensi untuk agen coding. |
| `docs/overview.md` | Dokumen ini — ringkasan untuk orientasi cepat. |
| `README.md` | Deskripsi publik + cara menjalankan + validasi. |
| `tools/lens-harness.js` | Harness Node: stub `document`/`window`, jalankan `<script>`, ekspor `__pub{render,S,P,computeModel,computeFaultCircuit,…}` + elemen tertangkap (`els.<id>.innerHTML`). |
| `tools/readout.test.js` | Tes kartu readout/status. Jalankan: `node tools/readout.test.js`. |
| `tools/sld-v-i.test.js` | Tes model V/I + chip SLD. Jalankan: `node tools/sld-v-i.test.js`. |
| `tools/flow-anim.test.js` | Tes revisi animasi aliran SLD (`flowSegments` + geometri panah). Jalankan: `node tools/flow-anim.test.js`. |
| `tools/side-mode.test.js` | Tes pemangkasan layout & mode dua-mode kartu kanan (`tripSequence` + `P.sideMode`). Jalankan: `node tools/side-mode.test.js`. |
| `tools/plane-zoom.test.js` | Tes zoom roda ±15%/100px + pinch dua-jari (`wheelZoomFactor`/`pinchZoomFactor`), jendela R–X dipepetkan ke kartu (×0.75 + pusat konten + clamp no-cut) & kanvas adaptif + halo putih pd label tick. Jalankan: `node tools/plane-zoom.test.js`. |
| `tools/title-anim.test.js` | Tes animasi judul header (`tt-a`/`tt-b` + gradien `--ink→--copper-deep` + kilau `ttShine` + crossfade `ttSwapA/B` + reduced-motion), animasi collapse (`card-b-i` grid 1fr→0fr) & pemusatan saat semua ciut (`syncCollapsedCentering`). Jalankan: `node tools/title-anim.test.js`. |
| `tools/lens.test.js` | Tes lensa beban (wedge simetris ber-fillet + titik sistem dinamis) & model loadability PRC-023. Jalankan: `node --test tools/lens.test.js`. |
| `design-plans/` | Arsip design plan; yang ada berlabel **OBSOLETE** — jangan dieksekusi. |

## Arsitektur isi file HTML (urut dalam `<script>`)

1. **Helper kompleks** (`C`, `add`, `sub`, `scl`, `mag`, `ang`, `fromPolar`, `deg`, `rad`) —
   model bekerja di ruang impedansi kompleks `{R,X}`. Jangan pakai `Math.hypot`/`atan2` mentah.
2. **State `S`** (dan `P=S.param`): panjang/`r`/`x` saluran L1/L2, CTR/PTR, Zs, VLL, beban,
   fault (`pos`,`rf`,`xf`,`rfMode`,`faultType`,`infeed`,`infeedOn`), error CT/PT, relay
   R1–R4 (`charType`, reach zona, timer), `selectedRelayId`, `showZones`, `showLoad`,
   `ui.view` (zoom/pan).
3. **DOM bindings**: slider/checkbox/button → tulis `S` → `render()`. Ada tombol:
   animasi sapuan gangguan (`#animateBtn`), collapse cards (animasi grid + pemusatan
   saat semua ciut via `syncCollapsedCentering`).
4. **Model inti** (`computeModel`) + **zona & trip**: `relayZones`, `charShape` (satu-satunya
   sumber geometri zona), `pointIn`, `tripTest`, `decideRelay` (zona 1→2→3; keputusan
   memakai **Z terukur** `zm`, bukan Z apparent). `relayFaultZ` memberi `{behind,z,zm,zlPrim,…}`.
5. **`computeFaultCircuit(m)`** (tambahan baru) — lihat bagian "Model V/I" di bawah.
6. **Renderer**: `renderPlane` (R–X + zoom/pan), `renderSLD` (diagram satu garis + chip V/I),
   `updateReadout` (kartu kanan dua mode: detail relay terpilih / sekuens trip). Semua murni:
   `m` + keputusan → string SVG/HTML.
7. **`render()`** master — satu-satunya entry point perubahan state.
8. **Splash pembuka** (IIFE) + **kunci tinggi panel parameter** (ResizeObserver).

## Fitur terkini (sesi 2026-09-03) — pastikan perubahan baru tidak merusaknya

- **Splash pembuka**: overlay `#splash` krem/ivory (bukan navy) menyapu **tirai kiri→kanan**
  saat file dibuka; teks: judul gradien ink→copper + `S H E V A` (tanpa baris "by Sheva"
  terpisah). Timeline JS: `.go` (masuk) → `.out` (keluar) → `#root.ready` → `#splash`
  dihapus. Klik = skip; `prefers-reduced-motion` = langsung; `<noscript>` fallback.
  **`#root.ready .wrap` mengatur tampilnya halaman**: `.wrap` default `opacity:0` — jangan
  hapus, atau halaman bocor sebelum animasi. Tepi panel pakai CSS mask (fade kiri–kanan).
- **Header halaman**: `.tt` dua span — `tt-a` "Simulator Distance Relay" & `tt-b`
  "by Sheva - Endetta" — bergantian via crossfade opacity (`ttSwapA/B`), gradien
  `--ink→--copper-deep` (bukan `--blue→--teal`) + kilau menyapu kiri→kanan (`ttShine`,
  band terang di dalam `background-size` di-clip ke huruf); `prefers-reduced-motion`
  mematikannya & menyembunyikan `tt-b`. `.wrap` padding 14px/40px.
- **Collapse animasi & pemusatan**: kartu parameter dibungkus `.card-b-i`; collapse
  `grid-template-rows 1fr→0fr` + fade (bukan `display:none`); saat semua kartu ciut
  `syncCollapsedCentering()` → `.params-panel.all-collapsed` (tumpukan dipusatkan,
  tak ada ruang kosong asimetris).
- **Lensa beban — wedge simetris ber-fillet + titik sistem DINAMIS** (hasil riset:
  area beban standar = region V/wedge; formula PRC-023 `0.85·V²/S` sudah benar): lensa
  lama (sektor tajam satu sisi 0°..35°) diganti wedge **simetris ±(pf+margin)** (leading
  & lagging) dengan **4 pojok difillet** — geometri murni `loadRegion`/`loadRegionPoints`
  (radius fillet `rf=min(0.10·Δ,0.8·rIn·sinθ,0.4·Δ)`, tangensi busur `phiI/phiO` & ray
  `ri1/ri2`; fallback wedge tajam saat θ kecil). **Titik sistem normal berfluktuasi
  sepanjang waktu** mengelilingi `zlNow` dalam ellipse kecil (SVG `<animateMotion>` path
  tertutup, `dur=14s`): sumbu radial dari headroom jari-jari, sumbu tangensial dari
  headroom sudut → ellipse selalu DI DALAM lensa; label `sistem` ikut bergerak; fallback
  statis bila headroom habis. Lensa tetap overlay yang TIDAK memengaruhi skala.
- **Audit bug — relayFaultZ R4 (Bus C, rev, L2) utk fault di L1**: cabang fault-di-L1
  memakai `seg(pos,…)` (km dari A) padahal jarak dari Bus B ke fault = `L1−pos` → R4
  membaca |Z| terlalu kecil (pos=30 → 3.24 Ω, salah ZONA 2; benar 4.42 Ω → ZONA 3).
  Diperbaiki `seg(L1-pos,…)` + tes regresi S7 di readout.test.js. Gotcha: `pos` selalu
  diukur dari sumber A (Bus A=0); jarak sisi-B ke fault di L1 = `L1−pos`.
- **Kartu readout DE-DUPLIKASI** (`.side-card`, `updateReadout`): tanpa kalimat
  ringkasan `.r-sum`, tanpa baris `|Z| ∠θ` & tanpa rumus KaTeX (`#formulaOut` dihapus) —
  ketiganya mengulang status box / baris `Z apparent (sekunder)` / tabel reach. Kartu =
  kotak status (hasil trip; utk TIDAK TRIP baris waktunya membedakan `di belakang relay`
  vs `di luar seluruh zona`) → tabel 2 grup berjudul (`Impedansi gangguan`, `Lokasi
  gangguan & jangkauan`; grup `Relay & karakteristik` DIHAPUS); baris `Z apparent
  (primer)` hanya muncul jika ≠ Z asli; label reach `Reach zona 1/2/3`.
- **Kartu kanan dua mode + batas bawah halaman (sesi ini)**: tombol `#sideModeGroup`
  (`P.sideMode` default `'relay'`) — `Relay terpilih` = status box + 2 grup tabel (tanpa
  ringkasan/rumus dobel); `Sekuens trip` = `tripSequence(m)` (relay enabled urut
  waktu→zona→id; non-trip disertakan dgn alasan). Kotak status DISEMBUNYIKAN di mode
  sekuens (dobel dgn baris pertama daftar) & catatan SIR disembunyikan penuh (tanpa sisa
  blok hijau). Kartu waktu–impedansi (`#staircase`), kotak catatan `#typeNote` & kotak
  rumus `#formulaOut` DIHAPUS.
- **Kunci tinggi desktop (sesi ini)**: di ≥921px lebar & ≥600px tinggi halaman terkunci
  1 layar (`body overflow:hidden`; hanya panel/card yg scroll internal); kanvas R–X
  di-fit ke sisa tinggi lewat `fitPlane()`; di luar itu (layar kecil) scroll normal.
- **SLD compact & simetris (sesi ini)**: blok isi SLD dipusatkan kiri–kanan berbasis
  tinta (sumber 75 → Bus A 145 … Bus C 905, gutter ≈53 px tiap sisi) & dirapatkan
  vertikal (viewBox 142 → 130, baris label atas/bawah dirapatkan).
- **Kanvas R–X dipepetkan ke kartu & zoom roda/pinch (sesi ini)**: jendela default
  ×0.75 (k=1 merapat ke kurva — diagram mengisi kartu, gap kiri ≈ gap kanan ≈3% di
  desktop; label R −3..4 / X −2..2 di kanvas 720×430, lingkaran tetap bulat), jendela R
  dipusatkan pd pusat konten yg digambar + clamp NO-CUT di fit default (dihitung ulang
  tiap render): jendela R melebar otomatis bila konten yg digambar bakal terpotong
  kiri/kanan. Label tick R & X ber-halo putih (`paint-order:stroke`, `stroke:var(--surface)`).
  Toolbar zoom (−/+/Fit) chip melayang DI DALAM plot (pojok kanan-atas, radius 12px,
  `padT` 26→10). `renderPlane` adaptif thd ukuran kanvas (viewBox = ukuran elemen, 1:1
  px); `fitPlane` mengisi kartu s.d. legenda. Zoom roda `wheelZoomFactor` ±15% per 100 px
  gulir; pinch dua-jari (wheel `ctrlKey`) pakai `pinchZoomFactor` — renggangan = zoom IN
  (tanda dibalik dari yg terbalik), ≈×1.08/10 px.
- **Scrollbar tipis**: `.params-panel` 6px, thumb pill rounded, track transparan
  (`scrollbar-width:thin` utk Firefox).
- **Chip V & I di SLD (SELALU tampil)**: tombol `#viToggle`/`P.showVI` DIHAPUS (dulu
  menghalangi pojok SLD). Chip tegangan per bus (`V/Vbc/Va … kV` di atas bus) dan arus
  (`I … kA` dekat Sumber, `· … kA` di kapten Infeed, `If … kA` baris sendiri di bawah
  label jenis gangguan) selalu digambar. SLD `viewBox` kini `980×130`.
- **Animasi aliran SLD direvisi (sesi ini)**: fungsi murni `flowSegments(m, vi)` jadi
  satu-satunya sumber jalur & arus panah. Fault L1 → merah Sumber→fault = `ia`, copper
  B→fault = `ib` (infeed); fault L2 → merah Sumber→B = `ia` **saja** (artefak lama di mana
  segmen A–B ikut digambar besar saat infeed nyala sudah dihapus) dan B→fault = gabungan
  `ifK`. Ukuran panah kontinu ∝ kA (referensi = arus hubung-singkat di Bus A), kecepatan
  tetap 125 px/s; tidak ada panah melewati titik gangguan.

## Model V/I (`computeFaultCircuit`) — asumsi penting

Setara sederhana **hanya untuk tampilan** (tidak dipakai keputusan relay): EMF fasa
`VLL/√3` kV di belakang `Zs` (Bus A) dan, saat `P.infeedOn`, sumber kedua EMF sama di Bus B
dengan impedansi `Zs/P.infeed`. Gangguan dihitung **komponen simetris klasik per tipe**
(3φ / φ-φ / φ-G) dengan asumsi:
- `Z1 = Z2 = Z0` di saluran **dan** sumber (grounded);
- beban diabaikan saat gangguan;
- sudut sumber = sudut impedansi saluran L1;
- EMF kedua sumber sama besar (tanpa beda fasa);
- arus terbagi A/B via pembagi impedansi; segmen pasif di belakang titik gangguan tidak
  dialiri arus → tegangan bus di sana = tegangan titik gangguan (akibatnya saat infeed
  mati dan fault bolted di L1, Bus B & C bisa terbaca `0 kV` — itu memang pelajaran infeed).

Keluaran: per bus tegangan **loop relay** (3φ & φ-φ → `|Vb−Vc|` kV; φ-G → `|Va|` kV),
dan arus loop gangguan per sumber + total dalam kA primer. Uji literalnya ada di
`tools/sld-v-i.test.js` (jaringan sintetis murni-reaktif agar angka eksak).

## Konvensi & gotcha yang sering menggigit

- **Label SLD/R–X**: semua teks dikumpulkan ke string `lbl` dan dirender **paling akhir**
  dengan halo `paint-order:stroke;stroke:var(--surface)`. Jangan pernah menaruh teks
  sebelum garis/panah — bug lama label tertimpa.
- **Zoom/pan plane (adaptif)**: `renderPlane` membaca ukuran elemen aktual
  (`clientWidth/Height`, fallback 640×470 utk tes) dan menyetel `viewBox` = ukuran itu,
  jadi koordinat internal 1:1 dgn px CSS — handler wheel/pan memakai offset kursor mentah
  (tidak ada pasangan konstanta VBG/VBH2 lagi). Toolbar zoom = chip melayang DI DALAM
  plot pojok kanan-atas (`padT=10`); jendela default dipepetkan ×0.75 + pusat konten +
  clamp no-cut (bulat tetap bulat); label tick ber-halo putih; zoom roda =
  `wheelZoomFactor` ±15% per 100 px gulir, pinch dua-jari = `pinchZoomFactor` (renggangan
  = zoom IN). `viewBox` SLD harus
  sinkron dgn `VBH` di `renderSLD`.
- **Skala bidang R–X** dari bounding box zona + titik fault relay aktif, **bukan** dari
  lensa beban (lensa overlay full-canvas; memakainya utk skala merusak grid).
- Warna pakai variabel tema `:root` (`--blue/--copper/--ink/-soft`, `--teal`,
  `--copper-deep`); hindari hex hard-code di SVG.
- Teks UI bahasa Indonesia (mis. `tidak trip`, `waktu operasi`, `nyala`); rumus
  LaTeX/KaTeX sudah dihapus (dobel dgn tabel readout).
- Semua kontrol → `render()`; jangan simpan state UI di luar `S`.

## Validasi (tanpa build)

```bash
node tools/readout.test.js     # 25 asersi kartu readout (2 grup, tanpa duplikat) + regresi R4 S7
node tools/sld-v-i.test.js     # 14 asersi model V/I + chip SLD
node tools/flow-anim.test.js   # 17 asersi panah aliran (flowSegments + #sld)
node tools/side-mode.test.js   # 15 asersi mode dua-mode & pemangkasan layout
node tools/plane-zoom.test.js  # 26 asersi zoom roda/pinch & jendela R–X
node tools/title-anim.test.js  # 9 asersi animasi judul & collapse
node --test tools/lens.test.js # 15 asersi lensa beban & model PRC-023
```

Harness mengabaikan CSS & tidak punya hirarki DOM anak — teks status readout dibaca dari
`els.zoneLabel`/`els.timeLabel`, bukan `els.statusBox`. Semua file tes meng-hard-code nama
file HTML; update jika file di-rename.

## Gaya bahasa & tone

Aplikasi & dokumentasi teknis memakai Bahasa Indonesia untuk label UI. Kode, komentar
kode, dan CLAUDE.md memakai campuran Indonesia/Inggris sesuai konteks; usahakan konsisten
dengan sekitarnya.
