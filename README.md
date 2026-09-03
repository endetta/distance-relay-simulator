# Simulator Distance Relay

Simulator edukasi **proteksi distance relay** (relay jarak) yang berjalan sepenuhnya di browser — tanpa build, tanpa framework, satu file HTML. Simulator ini mem-plot keputusan trip empat relay (R1–R4) pada bidang **R–X (impedansi)**, lengkap dengan one-line diagram, tangga waktu zona, dan readout numerik.

> An educational, browser-only simulator for distance relay protection. It plots how different relay characteristics (Impedance, Reactance, Mho, Quadrilateral) decide whether to trip, on the R–X plane.

## Cara menjalankan

Tidak ada instalasi — cukup buka file-nya:

1. **Double-click** `distance_relay_simulator.html`, atau
2. Jalankan server statis:

   ```bash
   python -m http.server      # lalu buka http://localhost:8000
   # atau
   npx serve
   ```

Satu-satunya dependensi eksternal adalah CDN: **KaTeX** (render rumus) dan **Google Fonts**. Untuk pengalaman penuh, dibutuhkan koneksi internet saat pertama membuka halaman.

## Fitur

- **4 karakteristik relay**: Impedance, Reactance, Mho, Quadrilateral — masing-masing dengan penjelasan konsepnya sendiri.
- **Model 2 saluran, 4 relay** (Bus A–B–C), relay dapat dinyalakan/dimatikan dan dikonfigurasi per-relay (reach zona 1/2/3, RCA offset, QRM, waktu trip).
- **Bidang R–X interaktif**: zoom (scroll) & pan (drag), grid dinamis 1-2-5, label yang selalu terbaca pada zoom/pan ekstrem.
- **Fault engine**: jenis gangguan (3φ, φ-φ, φ-G), posisi gangguan (slider & drag pada SLD), resistansi lengkung `Rf` / mode impedansi kompleks `Z`, dan **infeed** dari bus remote.
- **Error CT/PT**: simulasi underreach (CT saturation) dan overreach (CVT transient) terhadap impedansi terukur.
- **Load encroachment**: wedges beban minimum/nominal ditampilkan sebagai overlay di bidang R–X.
- **Animasi**: sapuan gangguan (fault sweep) sepanjang saluran + animasi aliran daya pada SLD.
- **SIR note** (source impedance ratio) dan tangga waktu Zona 1/2/3 untuk relay terpilih.

## Arsitektur (ringkas)

Satu blok `<script>` di `distance_relay_simulator.html`, tersusun sebagai:

| Bagian | Peran |
|---|---|
| Complex-number helpers | `C`, `add`, `sub`, `scl`, `mag`, `ang` — seluruh model bekerja di ruang impedansi kompleks `{R, X}` |
| Global state `S` | Sumber tunggal semua parameter; UI hanya menulis ke `S` |
| Core model `computeModel()` | Satu sumber kebenaran nilai turunan (Z sekunder, zona per relay, Z apparent/terukur, SIR) |
| Trip decision | `relayFaultZ()` → `tripTest()` → `decideRelay()` — keputusan trip diambil dari **impedansi terukur** (dengan error CT/PT), bukan Z apparent |
| Renderers | `renderPlane` (R–X), `renderSLD`, `renderStaircase`, `updateReadout` — fungsi murni yang membangun string SVG |
| Master `render()` | `computeModel()` → keputusan per relay → semua renderer. Satu-satunya pintu masuk perubahan state |

Detail lebih lanjut (konvensi koordinat, scaling bidang R–X, jebakan zoom/pan) ada di [`CLAUDE.md`](CLAUDE.md).

## Struktur repo

```
.
├── distance_relay_simulator.html   # seluruh aplikasi (HTML + CSS + JS)
├── CLAUDE.md                       # panduan untuk agent/AI yang mengedit kode
└── design-plans/                   # arsip rencana perubahan desain (historis)
```

## Catatan

- Semua perhitungan memakai **impedansi sekunder** (Ω sekunder = Ω primer × CTR/PTR) sebagaimana praktik nyata relay panel.
- Konvensi slider error: positif = transformator *under-delivers* sinyal sekunder (CT saturasi ⇒ underreach; CVT transien ⇒ overreach).
- `design-plans/flow-toggle-label-initial-state.md` adalah arsip: tombol `#flowToggle` yang dibahas di sana sudah dihapus dari kode (animasi aliran kini selalu tampil).
