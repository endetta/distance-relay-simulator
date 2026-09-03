# Simulator Distance Relay

Simulator **pendidikan** untuk sistem proteksi *distance relay* (relai jarak) pada saluran transmisi. Berjalan sepenuhnya di browser — satu file HTML mandiri, tanpa build, tanpa framework, tanpa backend.

Simulator memetakan bagaimana karakteristik relay yang berbeda (**Impedance, Reactance, Mho, Quadrilateral**) memutuskan untuk *trip* pada bidang **R–X** (resistansi–reaktansi), lengkap dengan diagram satu garis (SLD) interaktif.

## Menjalankan

Buka langsung `distance_relay_simulator.html` di browser (double-click, atau `file:///...`). Untuk orientasi cepat (peta fitur & cara kerja) baca [docs/overview.md](docs/overview.md). Static server juga bisa:

```bash
python -m http.server      # lalu buka http://localhost:8000
# atau
npx serve
```

Satu-satunya dependensi eksternal dimuat dari CDN (KaTeX, Google Fonts) — butuh koneksi internet agar rumus & font tampil; fungsionalitas inti tetap jalan tanpanya.

## Fitur

- **4 relay** (R1–R4) pada topologi radial Bus A – Bus B – Bus C, dua saluran (L1, L2), masing-masing bisa dinyalakan/dimatikan dan dikonfigurasi (karakteristik, RCA, reach zona, timer) lewat modal ⚙
- **Bidang R–X** dengan zoom (scroll) & pan (drag), grid dinamis 1-2-5, label selalu terlihat di margin
- **Zona 1/2/3** dengan jangkauan & waktu bertingkat, divisualkan sebagai *staircase* time–distance
- **Diagram satu garis interaktif**: geser handle gangguan, klik kotak relay, klik simbol infeed; animasi aliran daya mengikuti fisika radial
- **Model gangguan**: jenis (3φ, φ-φ, φ-G), posisi, impedansi gangguan resistif (Rf) atau kompleks (Rf+jXf), *infeed* dari sumber remote
- **Error CT/PT** (CT saturasi ⇒ underreach, CVT transient ⇒ overreach) dengan visualisasi geseran Z asli vs Z terukur
- **Lensa beban** (kriteria loadability PRC-023) & titik operasi pra-gangguan, indikator **SIR** (source impedance ratio)
- Mode tampilan bahasa Indonesia

## Struktur

Satu file: `distance_relay_simulator.html` (markup + CSS + satu blok `<script>`). Panduan arsitektur lengkap untuk pengembangan ada di [CLAUDE.md](CLAUDE.md).

## Validasi

Tidak ada test suite formal; dua jalur validasi:

- **Pixel-level bidang R–X** — harness Node kecil (stub DOM → jalankan isi `<script>` → ukur SVG `#plane` yang dihasilkan). Polanya didokumentasikan di CLAUDE.md.
- **Kartu readout/status** — `node tools/readout.test.js`: menjalankan simulator lewat `tools/lens-harness.js` dan menegaskan kalimat ringkasan, struktur tabel 3 grup, serta teks status untuk berbagai skenario gangguan (zona 1/2/3, di belakang relay, tidak trip, error CT/PT).
- **Tegangan & arus di SLD** — `node tools/sld-v-i.test.js`: `computeFaultCircuit` (nilai literal hasil hitung tangan pada jaringan sintetis murni-reaktif, untuk 3φ/φ-φ/φ-G × infeed off/×1/×4) + kehadiran chip `kV`/`kA` di `#sld` dan tombol toggle `P.showVI`.
- **Animasi aliran daya di SLD** — `node tools/flow-anim.test.js`: `flowSegments` (jalur/`kA`/warna per segmen; segmen Sumber→B hanya membawa arus sumber `ia`, tak membesar saat fault lintas Bus B) + geometri panah di `#sld` (glyph ∝ kA, kecepatan konstan 125 px/s).
