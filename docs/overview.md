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
Satu-satunya dependensi eksternal: KaTeX + Google Fonts via CDN (opsional, core tetap jalan).

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
| `tools/plane-zoom.test.js` | Tes zoom roda landai (`wheelZoomFactor`) & kanvas R–X adaptif. Jalankan: `node tools/plane-zoom.test.js`. |
| `design-plans/` | Arsip design plan; yang ada berlabel **OBSOLETE** — jangan dieksekusi. |

## Arsitektur isi file HTML (urut dalam `<script>`)

1. **Helper kompleks** (`C`, `add`, `sub`, `scl`, `mag`, `ang`, `fromPolar`, `deg`, `rad`) —
   model bekerja di ruang impedansi kompleks `{R,X}`. Jangan pakai `Math.hypot`/`atan2` mentah.
2. **State `S`** (dan `P=S.param`): panjang/`r`/`x` saluran L1/L2, CTR/PTR, Zs, VLL, beban,
   fault (`pos`,`rf`,`xf`,`rfMode`,`faultType`,`infeed`,`infeedOn`), error CT/PT, relay
   R1–R4 (`charType`, reach zona, timer), `selectedRelayId`, `showZones`, `showLoad`,
   `ui.view` (zoom/pan).
3. **DOM bindings**: slider/checkbox/button → tulis `S` → `render()`. Ada tombol:
   animasi sapuan gangguan (`#animateBtn`), collapse cards.
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
- **Header halaman**: judul `Simulator Distance Relay` 17px gradien `--blue→--teal` + dot
  copper (`--teal` & `--copper-deep` ditambahkan ke `:root`); `.wrap` padding 14px/40px.
- **Kartu readout** (`.side-card`, `updateReadout`): kotak status → kalimat ringkasan `.r-sum`
  (bahasa manusia, angka kunci `<b>`) → tabel 2 grup berjudul (`Impedansi gangguan`,
  `Lokasi gangguan & jangkauan`; grup `Relay & karakteristik` DIHAPUS); baris
  `Z apparent (primer)` hanya muncul jika ≠ Z asli; label reach `Reach zona 1/2/3`.
- **Kartu kanan dua mode + batas bawah halaman (sesi ini)**: tombol `#sideModeGroup`
  (`P.sideMode` default `'relay'`) — `Relay terpilih` = konten lama (grup `Relay &
  karakteristik` DIHAPUS); `Sekuens trip` = `tripSequence(m)` (relay enabled urut
  waktu→zona→id; non-trip disertakan dgn alasan, kotak status menyorot trip pertama).
  Zona formula/SIR disembunyikan penuh di mode sekuens (tanpa sisa blok hijau). Kartu
  waktu–impedansi (`#staircase`) & kotak catatan `#typeNote` DIHAPUS.
- **Kunci tinggi desktop (sesi ini)**: di ≥921px lebar & ≥600px tinggi halaman terkunci
  1 layar (`body overflow:hidden`; hanya panel/card yg scroll internal); kanvas R–X
  di-fit ke sisa tinggi lewat `fitPlane()`; di luar itu (layar kecil) scroll normal.
- **SLD compact & simetris (sesi ini)**: blok isi SLD dipusatkan kiri–kanan berbasis
  tinta (sumber 75 → Bus A 145 … Bus C 905, gutter ≈53 px tiap sisi) & dirapatkan
  vertikal (viewBox 142 → 130, baris label atas/bawah dirapatkan).
- **Kanvas R–X full-kartu & zoom roda landai (sesi ini)**: toolbar zoom (−/+/Fit) overlay
  di atas plot (tanpa ruang putih khusus); `renderPlane` adaptif thd ukuran kanvas
  (viewBox = ukuran elemen, 1:1 px); `fitPlane` mengisi kartu s.d. legenda. Zoom roda
  `wheelZoomFactor`: ±8% per 100 px gulir (trackpad tak lagi 1.15× per event).
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
  (tidak ada pasangan konstanta VBG/VBH2 lagi). Toolbar zoom overlay di atas plot
  (`padT=26`); zoom roda = `wheelZoomFactor` ±8% per 100 px gulir. `viewBox` SLD harus
  sinkron dgn `VBH` di `renderSLD`.
- **Skala bidang R–X** dari bounding box zona + titik fault relay aktif, **bukan** dari
  lensa beban (lensa overlay full-canvas; memakainya utk skala merusak grid).
- Warna pakai variabel tema `:root` (`--blue/--copper/--ink/-soft`, `--teal`,
  `--copper-deep`); hindari hex hard-code di SVG.
- KaTeX utk rumus; teks UI bahasa Indonesia (mis. `tidak trip`, `waktu operasi`, `nyala`).
- Semua kontrol → `render()`; jangan simpan state UI di luar `S`.

## Validasi (tanpa build)

```bash
node tools/readout.test.js   # 24 asersi kartu readout (2 grup)
node tools/sld-v-i.test.js   # 14 asersi model V/I + chip SLD
node tools/flow-anim.test.js # 17 asersi panah aliran (flowSegments + #sld)
node tools/side-mode.test.js # 15 asersi mode dua-mode & pemangkasan layout
node tools/plane-zoom.test.js # 11 asersi zoom roda & kanvas adaptif
```

Harness mengabaikan CSS & tidak punya hirarki DOM anak — teks status readout dibaca dari
`els.zoneLabel`/`els.timeLabel`, bukan `els.statusBox`. Semua file tes meng-hard-code nama
file HTML; update jika file di-rename.

## Gaya bahasa & tone

Aplikasi & dokumentasi teknis memakai Bahasa Indonesia untuk label UI. Kode, komentar
kode, dan CLAUDE.md memakai campuran Indonesia/Inggris sesuai konteks; usahakan konsisten
dengan sekitarnya.
