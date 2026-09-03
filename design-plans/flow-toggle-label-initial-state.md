# Tombol aliran daya menampilkan label yang cocok dengan state awal

> **⚠ OBSOLETE (2026-09-03):** plan ini sudah tidak dapat diterapkan — tombol targetnya
> `#flowToggle` **sudah dihapus dari kode**: animasi aliran daya kini SELALU tampil tanpa
> tombol (lihat komentar "aliran daya pada SLD" di `distance_relay_simulator.html` ~baris 432).
> Diarsipkan apa adanya sebagai rekam jejak audit; jangan dieksekusi.

Written against: unavailable (folder bukan repositori git; audit 2026-09-03 terhadap
`distance_relay_simulator.html` di `C:\Users\pcelr\Documents\Sheva\SHEVA'S SIMULATOR LIBRARY\New folder\`)


## Evidence chain

- Surface: Bilah kontrol section SLD — `.sld-ctl` di dalam `.sld-card`, tombol `#flowToggle` (`Aliran daya` / `Jalankan SC`), dirender saat halaman dibuka
- Problem: Saat halaman dimuat, state `S.flowOn=true` (aliran berjalan) tetapi tombol bertuliskan **"Aliran daya"** — label yang sama yang handler pakai untuk state `flowOn=false`. Klik pertama pengguna (mematikan aliran) tidak mengubah teks sama sekali, lalu klik kedua (menyalakan) mengubahnya menjadi "Hentikan aliran". Satu state kini punya dua label berbeda tergantung riwayat klik; label tidak lagi menjadi indikator state.
- Design evidence:
  - `distance_relay_simulator.html:261` — markup statis: `<button class="mini-btn on" id="flowToggle">Aliran daya</button>` (class `on` menandai state aktif).
  - `distance_relay_simulator.html:444–450` — handler: `b.textContent = S.flowOn ? 'Hentikan aliran' : 'Aliran daya'` setelah toggle. Jadi `flowOn=true` ⇒ label benar adalah "Hentikan aliran".
  - Pola saudara yang menjadi konvensi internal: `#animateBtn` (`:251` markup, `:428–438` handler). Markup statisnya **sudah** sama dengan hasil mapping handler untuk state awal (`▶ Animasikan sapuan gangguan`), sehingga klik pertamanya langsung menukar label. `#flowToggle` menyimpang dari pola ini.
- Owner: markup statis `.sld-ctl` di `distance_relay_simulator.html` (baris 261); handler `flowToggle` di baris 444–450 tidak diubah
- Scope and affected surfaces: hanya tombol `#flowToggle` di bilah kontrol SLD. Tidak memengaruhi `#scRun`, `#animateBtn`, atau bagian aplikasi lain.
- Uncertainty: none — kedua sumber (markup dan handler) ada di file yang sama, keduanya sudah diverifikasi ulang saat penyusunan plan ini.

## Design decision

Ubah teks statis tombol `#flowToggle` di markup dari `Aliran daya` menjadi `Hentikan aliran`, sehingga markup awal identik dengan hasil pemetaan handler untuk state awal `S.flowOn=true`. Ini memperbaiki akar masalah (markup tidak sinkron dengan mapping state→label handler) tanpa menyentuh handler: label menjadi fungsi murni dari state, tidak lagi bergantung riwayat klik.

## Reuse

- Class yang sudah ada: `mini-btn on` (`.mini-btn.on` di CSS, baris 79) — tetap dipakai, menandai state aliran aktif.
- Pola eksemplar: pasangan markup/handler `#animateBtn` (`:251`, `:428–438`) — markup statis mengikuti hasil mapping handler untuk state awal.
- Tidak ada token/primitif baru yang diperlukan; perubahan murni teks markup.

## Changes

1. `distance_relay_simulator.html` baris 261 (markup statis `.sld-ctl`)
   - Change: ganti teks tombol `<button class="mini-btn on" id="flowToggle">Aliran daya</button>` menjadi `<button class="mini-btn on" id="flowToggle">Hentikan aliran</button>`.
   - Preserve: id `flowToggle`, class `mini-btn on`, posisi tombol sebelum `#scRun`; handler `:444–450` tidak diubah sama sekali.
   - Verify: buka halaman — tombol pertama bilah kontrol SLD bertuliskan "Hentikan aliran" dengan warna biru (class `on`) selama dash aliran biru bergerak di SLD; klik pertama mematikan dash DAN teksnya berubah menjadi "Aliran daya" (warna kembali netral); klik kedua mengembalikan keduanya.

## Scope

- Inherit: tidak ada consumer lain — teks tombol ini hanya dibaca pengguna; tidak ada selector CSS/JS yang mencocokkan teksnya (handler memakai id, bukan teks).
- Verify: `#scRun` (tombol tetangga) dan `#animateBtn` tidak berubah; animasi aliran default tetap menyala saat load (`S.flowOn:true` di state, baris 378).
- Exclude: penggantian model label-toggle (mis. menambah ikon status terpisah), perubahan salindia teks handler, dan semua area UI di luar bilah kontrol SLD.

## Validation

- Product: buka `distance_relay_simulator.html` di browser (double-click atau `python -m http.server`). Tugas: matikan lalu nyalakan aliran daya lewat tombol pertama di SLD. Hasil yang diharapkan: setiap klik mengubah teks tombol sesuai tabel di atas, dan dash biru bergerak/berhenti serempak dengan teksnya.
- Interface: state awal halaman (aliran on, tombol "Hentikan aliran" + class `on`); setelah 1 klik (aliran off, tombol "Aliran daya", tanpa class `on`); setelah 2 klik (kembali ke state awal). Tidak ada state lain untuk tombol ini; tidak ada viewport khusus (bilah mengalir normal di layout responsif ≤920px).
- System: konfirmasi hanya satu tempat yang menetapkan teks awal tombol (markup baris 261) dan satu tempat yang menetapkan teks runtime (handler baris 447) — tidak muncul pola paralel baru; kedua string ("Aliran daya" / "Hentikan aliran") kini muncul tepat di dua lokasi tersebut.
- Repository: tidak ada test suite/build di project ini. Cek statis: `Select-String -Path "distance_relay_simulator.html" -Pattern "id=""flowToggle"""` → tepat satu hasil, berisi `Hentikan aliran`; dan `Select-String -Path "distance_relay_simulator.html" -Pattern "Hentikan aliran"` → tepat dua hasil (baris 261 markup, baris 447 handler).

## Stop conditions

- Stop jika handler `flowToggle` (baris 444–450) ternyata sudah diubah sejak audit ini (mis. pemetaan state→labelnya dibalik atau dihapus) — verifikasi ulang mapping-nya terlebih dahulu sebelum mengubah markup.
- Stop jika state `S.flowOn` tidak lagi default `true` saat load — nilai markup awal harus mengikuti mapping handler untuk state awal yang baru.

## Design documentation

- None — perbaikan ini mengembalikan tombol ke pola yang sudah dipakai `#animateBtn`; tidak ada keputusan desain baru yang perlu dicatat.
