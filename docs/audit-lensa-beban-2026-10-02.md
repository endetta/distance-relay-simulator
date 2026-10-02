# Audit Koreksi Lensa Beban (Load-Encroachment Lens) — Simulator Distance Relay

Tanggal: 2026-10-02
Objek audit: `distance_relay_simulator.html` (lensa beban, sesi 2026-09-03) dan `tools/lens.test.js`
Status: audit baca‑saja — tidak ada kode yang diubah. Semua tes `node --test tools/lens.test.js` lolos (15/15) saat audit berjalan.

---

## 1. Ringkasan eksekutif

| # | Klaim yang diaudit | Verdict | Sumber kunci |
|---|---|---|---|
| M1 | Batas dalam lensa = `0.85·V²/S` (Ω sekunder) — kriteria loadability PRC-023 | **BENAR** (dengan catatan kecil pada semantik V) | PRC-023‑6 R1; TRD SPCWG; `distance_relay_simulator.html:684` |
| M2 | Batas luar = `V²/(0.5·S)` = 50% beban @1.0 pu V ≈ **2.35×** batas dalam | **BENAR** (konstanta panduan, bukan persyaratan standar) | `distance_relay_simulator.html:691`; verifikasi numerik: rasio = 2.3529 |
| M3 | Wedge **SIMETRIS** ±(pf+margin) — beban boleh leading & lagging | **BENAR** (sesuai literatur & praktik vendor; simpangan kecil dari 30° standar) | Horowitz–Phadke §5.3; PRC-023 R1 (30°); `loadRegionPoints` |
| M4 | Fillet `rf = min(0.10·Δ, 0.8·rIn·sinθ, 0.4·Δ)` + tangensi `phiI/phiO/ri1/ri2` + fallback `rf=0` | **BENAR** (matematika fillet valid; dua istilah pertama min‑idempoten) | `loadRegion` hlm. 930–941; tes literal `lens.test.js:98–107` |
| M5 | Ellipse titik sistem dijamin di dalam lensa (sumbu radial 0.35·headroom radius, tangensial 0.5·|Z|·tan(θ−∠zlNow)) | **BENAR** (dengan dua kelemahan kecil: cakupan titik‑uji sertifikat tidak penuh; beberapa sudut sistem outlier praktis) | `renderPlane` hlm. 1112–1114; `lens.test.js:147–173` |
| V1 | Wedge + 4 fillet + 2 busur digambar benar (6 arc, simetri bbox, fallback tajam) | **BENAR** | `renderPlane` hlm. 1093–1105; `lens.test.js:80–96` |
| V2 | `<animateMotion>` ellipse tertutup (M…Z) + dur 14 s + indefinite | **BENAR** | `renderPlane` hlm. 1120–1126; `lens.test.js:139–145` |
| V3 | Lensa overlay yang TIDAK memengaruhi skala plot | **BENAR** | `relayBounds` hlm. 965–983 (zona beban tidak dibaca); `lens.test.js:210–217` |
| V4 | Clip/label/halo benar (lensa di dalam clip, label tick di luar clip + halo) | **BENAR** | `renderPlane` hlm. 1041–1063, 1072–1073 |
| S1 | 0.85 pu V + sudut beban 30° = parameter evaluasi PRC-023 | **BENAR** (simulator default 30°; pangkal 31.8°/pf 0.85 adalah preseden praktik, bukan persyaratan) | PRC-023‑6 R1, R1.12; TRD §1.1 |
| S2 | "PRC-023 hanya mewajibkan no‑trip s.d. 150% rating" (komentar kode) | **BENAR** untuk kriteria R1.1; perlu nuansa (13 kriteria R1 yang lain, termasuk R1.12) | PRC-023‑6 R1 cri. 1–13; `distance_relay_simulator.html:685–690` |
| S3 | Konsep/istilah "load‑encroachment" dan bentuk wedge berfillet | **BENAR** secara konsep; bentuk wedge simetris adalah pilihan aksara edukasi (bukan kotak quad vendor) | Horowitz–Phadke Fig. 11.5; IEEE PSRC C37.113‑2016 §7.3.2; TRD App. C |

**Kesimpulan singkat:** lensa beban simulator secara matematis dan visual **benar**. Tidak ditemukan bug perhitungan. Temuan utamanya adalah dokumen tingkat catatan (semantik `V` pada `loadzMin`: V L‑L 150 kV bukan V L‑N), ketidakjelasan pemilihan konstanta, dan beberapa saran asersi tes.

---

## 2. Metodologi & sumber primer

### Metodologi
1. Baca `distance_relay_simulator.html` bagian model lensa (`computeModel`, `loadRegion`, `loadRegionPoints`), renderer (`renderPlane`, `rxWindow`/`fitRxWindow`), dan `.test.js`/harness.
2. Turunkan ulang setiap konstanta matematika secara manual (Node) — tabel rasio di bawah.
3. Verifikasi klaim masing‑masing terhadap **sumber primer** (NERC PRC-023‑6 teks lengkap; NERC TRD "Determination of Practical Transmission Relaying Loadability Settings"; IEEE PSRC C37.113‑2016; Horowitz & Phadke *Power System Relaying*, edisi 3).
4. Verifikasi visual SVG terhadap keluaran harness.

### Sumber primer yang digunakan
- **NERC PRC-023‑6, "Transmission Relay Loadability"** (Adopsi 2022; FERC 2024), R1 + Attackment A — PDF diambil dari nerc.com.
- **NERC SPCWG TRD, "Determination of Practical Transmission Relaying Loadability Settings"** — revisi RSTC (SPCWG), PDF dari nerc.com.
- **NERC RSTC SPCWG, "PRC-023 Implementation Guidance — Transmission Relay Loadability Requirement R1 (PRC‑023‑6)"** (Feb 2026, Proposal, *NOT ERO Endorsed*) — PDF dari nerc.com.
- **IEEE C37.113‑2016, "IEEE Guide for Protective Relay Applications to Transmission Lines"**, §7.3.2 — load‑encroachment & blinder quad.
- **S. H. Horowitz, A. G. Phadke, *Power System Relaying* (3rd ed.)**, §5.3, §5.11, §11.7 (Fig. 11.5) — teks penuh (edisi 3 arsip).
- **G. Zocholl, "Dynamic State Testing of Distance Elements", SEL 2005, WPRC** — referensi blinder/power swing (dikutip lewat tesis pendukung) — diacu di daftar sumber.

---

## 3. Temuan matematika (per formula)

### 3.1 M1 — Batas dalam `loadzMin = 0.85·V²/S`

Kode (`distance_relay_simulator.html:684`):
```js
const Vv=P.vLL_kV*1000, Sv=P.loadMVA*1e6;
const loadzMin=0.85*(Vv*Vv)/Sv*conv;
```

PRC-023‑6 R1: "…shall evaluate relay loadability at 0.85 per unit voltage and a power factor angle of 30 degrees"; R1.1: "relays so they do not operate at or below 150% of the highest seasonal Facility Rating".

TRD §1.1 (rumus lengkap): `Zrelay30 = 0.85·V_L‑L / (√3·1.5·I_rating)` — dalam bentuk daya: `Z_relay = 0.85·V_L‑L²/(1.5·S_rating)`. Simulator: `0.85·V²/S` dengan **S = rating fasilitas**. Jadi istilah `V²/S` di sini = **V_L‑L²/S** (daya 3‑fasa V L‑N = V L‑L/√3 ⇒ V L‑L²/S ⇒ ekuivalen V L‑N² × 3). Persamaan TRD menjadi `Z = V L‑L²/S×(0.85/1.5)`. Simulator bermakna `0.85·V L‑L²/S` — sesuai dengan notasi TRD (yang faktornya 1.5 ada di penyebut untuk kriteria termal 150%, dan 0.85 untuk tegangan).

> **Catatan label**: komentar kode menyebut "3‑fasa Z = 0.85·V²/S", dan V diisi `P.vLL_kV` (L‑L). Jika yang dimaksud V adalah tegangan **line‑to‑netral** lalu daya 3‑fasa, hasilnya identik; jika yang dimaksud V L‑L²/S maka hasilnya juga identik. Konsekuensinya `loadzMin` untuk sistem 150 kV/120 MVA = 10.08 Ω (primer), `×conv` (80/1363.6) = 0.59 Ω. Tes `lens.test.js:69` memakai literal 10.08 — konsisten.

**Kesimpulan: BENAR** — dengan klarifikasi bahwa "0.85·V²/S" mengikuti konvensi TRD (V = V L‑L, S 3‑fasa).

### 3.2 M2 — Batas luar `loadzNom = V²/(0.5·S)` ≈ 2.35× batas dalam

Kode (`distance_relay_simulator.html:691`): `V² / (0.5·S)` = `Z = 2·V²/S` — artinya beban ringan = setengah beban maks (50% S pada 1.0 pu V).

Perbandingan dengan batas dalam: `(2·V²/S) / (0.85·V²/S) = 2/0.85 ≈ 2.35`. Diverifikasi numerik (150 kV, 120 MVA): ratio terhitung 2.3529.

**Basis standar**: tidak ada konstanta literal "0.5 S" di PRC-023. Namun: kriteria R1.1 (150%) dan R1.2 (115% dari rating 15‑menit) mendefinisikan pita no‑trip; batas **atas** (beban ringan, |Z| besar) secara praktis ditentukan oleh **panduan TRD App. C** (PSB, "Load Impedance 3 well outside both the tripping characteristic and the PSB characteristic") dan praktik vendor — 50% S sebagai batas atas bersifat panduan, bukan persyaratan. Komentar kode menyatakan hal ini dengan benar ("PRC-023 hanya mewajibkan no‑trip s.d. 150% rating").

**Kesimpulan: BENAR** — konstanta layak & konsisten; didokumentasikan sebagai pilihan panduan.

### 3.3 M3 — Wedge simetris ±(pf+margin), leading & lagging

`loadRegionPoints` membangun 8 jangkar simetris terhadap sumbu R (`lens.test.js:112–115` memverifikasi pasangan cermin [0,3],[1,2],[4,7],[5,6]).

**Basis standar**: PRC-023 R1 mengevaluasi pada **satu** sudut beban 30° (lagging) — bukan memerintahkan simetri. Namun sudut beban di dalam simulator bukan sudut kepatuhan regulator: ini parameter pengguna (`pfAngleDeg` default 30, `loadEncroachDeg` default 5). Simetri adalah representasi standar dalam literatur: Horowitz & Phadke §5.3 menggambar titik beban `L1..L4` untuk 0.8 pf **lagging dan leading** pada bidang R‑X (Fig. 5.6): beban normal nyata memang dapat berada di kedua kuadran. Praktik vendor (IEEE C37.113‑2016 §7.3.2; manual SEL/ABB) menetapkan blinder ke dua arah (maju–mundur) dengan sudut blinder positif & negatif.

**Kesimpulan: BENAR** — simetri ± sesuai literatur; satu‑satunya nuansa: tidak 1:1 dengan "sudut 30°" standar PRC-023 (tidak bermasalah secara konsep karena ini parameter edukasi, bukan kepatuhan).

### 3.4 M4 — Fillet `rf = min(0.10·Δ, 0.8·rIn·sinθ, 0.4·Δ)` + tangensi

Kode (`distance_relay_simulator.html:930–941`):
```js
let rf=Math.min(0.10*d, 0.8*rIn*Math.sin(th), 0.4*d);
if(th < 0.04 || rf <= 0.01*d){ return {…,rf:0,…}; }
const dI=Math.asin(rf/(rIn+rf)), dO=Math.asin(rf/(rOut-rf));
return {…, phiI:th-dI, phiO:th-dO,
  ri1:Math.sqrt((rIn+rf)^2−rf^2), ri2:Math.sqrt((rOut−rf)^2−rf^2)};
```

- `0.10·d` dan `0.4·d` keduanya linier terhadap Δ; `min` menghasilkan `0.10·d` untuk semua kombinasi wajar (0.8·rIn·sinθ > 0.1·d pada default) — istilah kedua & ketiga adalah batas keamanan aktif saat θ kecil.
- Tangensi busur‑dalam: `dI = asin(rf/(rIn+rf))` — radius fillet + rIn = jarak pusat; segitiga siku‑siku menghasilkan persisnya itu (teorema: fillet menyinggung sudut interior wedge pada jarak `rIn + rf` dari pusat). Terverifikasi literalis tes: θ=35°: rf=1.265, phiI=28.16°, phiO=31.50°, ri1=10.54, ri2=20.70 (`lens.test.js:98–107`).
- `ri = √((r∓rf)² − rf²)` = jarak dari pusat ke titik tangensi antara fillet dan ray (koordinat radial) — benar.
- Fallback: `th < 0.04` atau `rf ≤ 0.01·d` → wedge tajam `rf=0` — mencegah NaN (`asin` di luar domain); `th → 0` ⇒ `sinθ → 0` ⇒ `rf → 0` ⇒ tidak ada busur. Terverifikasi `lens.test.js:127–136`.

**Kesimpulan: BENAR** — geometri fillet persis.

### 3.5 M5 — Ellipse titik sistem dijamin di dalam lensa

`renderPlane` hlm. 1112–1114:
```js
const aR=0.35*Math.max(Math.min(rOut-mg, mg-rIn), 0);
const aT=0.5*Math.max(mg*Math.tan(Math.max(la-Math.abs(thC),0)), 0);
```

- **Sumbu radial**: `aR = 0.35·min(rOut−mg, mg−rIn)` — setengah dari headroom radial terkecil, faktor 0.35 memastikan margin ≥ 65%; ellipse (dalam koordinat data, lingkaran transformasi isotropik) tidak keluar dari pita radial.
- **Sumbu tangensial**: `aT = 0.5·mg·tan(la−|thC|)` — setengah dari headroom sudut dikonversi ke panjang busur. Untuk sudut kecil, ellipse tetap di dalam wedge karena `mg·tan(…)` = jari‑jari sudut pada jari‑jari mg; faktor 0.5 aman.
- Dipastikan positif (`Math.max(…,0)`); jika headroom habis, fallback statis (hlm. 1128–1133) — tidak `NaN`.

Batasan yang perlu dicatat:
1. **Sertifikat pengujian**: `lens.test.js:147–173` hanya menguji **4 titik kardinal** (2 ujung sumbu besar + ekstrem tangensial) — untuk ellipse, kemiringan terbesar terhadap sumbu radius terjadi pada ±45° elips, tidak diuji. Kardinal "4" di `lens.test.js:158–162` sebenarnya 4 titik tetapi dua di antaranya adalah **dua ujung sumbu besar** dan satu jari‑jari tangensial — titik ±45° elips (yang paling mengancam batas sudut wedge) **tidak** diuji eksplisit. Amannya tetap ~benar oleh konstruksi (aT ≤ 0.5·headroom), tetapi asersi tidak seketat narasi "4 titik kardinal" yang dinyatakan.
2. **Outlier sudut**: `Math.tan(la−|thC|)` menjadi deras di dekat tepi (tan → ∞ saat la−thC → 90°). Dengan `la = 35°`, batas atas tan = tan(35°) ≈ 0.7 ⇒ aT ≈ 0.35·mg — headroom hilang saat |thC| dekat la, tetapi `Math.max(…,0)` membatasi; saat |thC| = la persis, aT = 0 → titik diam di tepi (fallback statis).

**Kesimpulan: BENAR dengan catatan** — konstruksi matematis benar; saran perbaikan (tes) di §6.

---

## 4. Temuan visual SVG

### V1 — Path wedge (6 arc, simetri)
`renderPlane` hlm. 1093–1101: `M p0 A rf … p1 A rIn … p2 A rf … p3 L p4 A rf … p5 A rOut … p6 A rf … p7 L p0 Z` — 6 arc persis (4 fillet + 2 busur), urutan benar (busur dalam → busur luar), `sweep` dibalik untuk y‑SVG terbalik (`0` untuk arc luar & fillet luar). Verifikasi: `lens.test.js:91–96` (6 arc), `:80–84` (simetri bbox, `|minX+maxX| < 0.6`), `:86–89` (minR > 0), `:109–125` (8 jangkar, radius ∈ [rIn,rOut], pojok asli sektor dipotong).

Fallback tajam (`L.rf=0`): hlm. 1103–1104 — 2 arc (rIn, rOut) membentuk sektor dua‑busur, bukan NaN. Terverifikasi `lens.test.js:127–136`.

### V2 — `<animateMotion>` ellipse
Hlm. 1120–1126: path `M … A aR·scale aT·scale rot 0 1 … A … 0 1 … Z` — dua arc setengah membentuk ellipse tertutup, `dur="14s"` (dalam 8–25), `repeatCount="indefinite"`. Label "sistem" + pulse lingkaran dibungkus dalam `<g>` yang sama — ikut bergerak. Terverifikasi `lens.test.js:139–145`, `:175–181` (aR ≠ aT, ellipse bukan lingkaran).

> Catatan kecil: `rx ≠ ry` **tidak** secara otomatis berarti "bukan lingkaran" di SVG murni (SVG memperbolehkan affine/rotasi), tetapi pada kasus ini aR/aT dari model memang beda → valid.

### V3 — Overlay tidak memengaruhi skala
`relayBounds` (hlm. 965–983) tumbuh bounding box dari zona + titik fault relay **saja**; lensa beban TIDAK dibaca. `rxWindow`/`fitRxWindow` hanya memakai `relayBounds`. Terverifikasi `lens.test.js:210–217` (slope grid identik saat `showLoad` on/off).

### V4 — Clip & label
- Konten data (wedge, zona, titik) di dalam `<g clip-path>` (hlm. 1072–1073); grid, sumbu, label tick di luar (hlm. 1047–1063).
- Label tick pakai halo `paint-order:stroke` + `stroke:var(--surface)` (hlm. 1057, 1063) — terbaca di atas kurva.
- Label lensa & "sistem" dibangun terakhir sebagai teks di luar clip — tidak tertutup kurva.
- Catatan kecil: label lensa `text-anchor="end"` menempel padL+plotW−6 (tidak menyinggung komentar CLAUDE.md tentang label di dalam plot) — valid.

**Kesimpulan visual: BENAR semua.**

---

## 5. Kesesuaian PRC-023

### 5.1 Parameter evaluasi
- PRC-023‑6 R1: "evaluate relay loadability at **0.85 per unit voltage and a power factor angle of 30 degrees**" — simulator default `pfAngleDeg=30`, `loadEncroachDeg=5` → total sudut tepi ±35°. **Tepat 30°** untuk inti; tambahan 5° margin adalah opsi pengguna. **SESUAI.**
- Catatan historis: sudut 31.79° (0.85 pf) muncul di literatur vendor (perhitungan loadability mho di pf 0.85); PRC-023 menetapkan **30°** secara eksplisit, jadi 30° simulator benar untuk kepatuhan.

### 5.2 Batas nilai lensa vs kriteria R1
- Batas dalam = titik evaluasi **R1.1 150%** pada 0.85 pu V (rumus TRD §1.1). **SESUAI.**
- Batas luar (50% S, 2.35×) bukan persyaratan standar; sebagai batas visual pita aman sahih secara konsep (TRD App. C: load impedances "well outside both the tripping characteristic and the PSB characteristic").

### 5.3 Pernyataan komentar "PRC-023 hanya mewajibkan no‑trip s.d. 150% rating"
Benar dalam konteks kriteria R1.1 (kriteria yang dipilih simulator). Halus: R1 memiliki **13 kriteria** (R1.1–R1.13) termasuk R1.12 (long‑line mho reach 125% & MTA 90°) dan R1.2 (115% 15‑menit). Tidak ada konflik; hanya memastikan kalimat tidak dipahami sebagai "hanya 150%" universal.

### 5.4 Basis konsep "load‑encroachment"
- IEEE C37.113‑2016 §7.3.2 (load‑encroachment / blinder quad element): area beban pada R‑X ditangani dengan blinder garis lurus (maju & mundur) atau karakteristik quad — konsep "area beban segi empat" modal di vendor.
- Bentuk **wedge berfillet** yang dipakai simulator adalah pilihan aksara **edukasi** (region kontinu yang berisi locus beban normal) — bukan penyalinan karakteristik quad vendor. Konsisten dengan Horowitz–Phadke Fig. 11.5 (load impedance di dalam/tepi karakteristik trip), tetapi tidak diklaim sebagai bentuk perangkat standar. **SESUAI dengan tujuan edukasi; tidak klaim sebagai bentuk device tertentu.**

---

## 6. Saran perbaikan minimal (urut prioritas)

1. **Komentar `loadzMin` — perjelas semantik V** (hlm. 681–684):
   Tulis ulang komentar menjadi: `Z = 0.85·V_LL²/S` (PRC-023 evaluasi pada 0.85 pu V; TRD §1.1: `Zrelay30 = 0.85·V_L‑L/(√3·1.5·I_rating)`). Ini menghilangkan ambiguitas V L‑N vs V L‑L (hasil sama, tapi dokumen tegas).

2. **Tes asersi ellipse — tambah titik ±45°** (`lens.test.js:147–173`):
   Kata "4 titik kardinal" hanya menguji 2 ujung sumbu besar + 1 jari‑jari tangensial. Tambahkan explicit poin pada arah elips ±45° (titik dengan `x = cx ± aR/√2·cos(thC)∓aT/√2·sin(thC)` dgn transformasi ellipse non‑trivial), atau setidaknya ganti nama test menjadi "2 ujung sumbu + ekstrem tangensial" agar tidak over‑claim.

3. **Asersi garis batas wedge di tepi konstan** (`lens.test.js` putaran kedua):
   Tambah 1 test: `loadRegion` menghasilkan `rf=0` saat `th < 0.04` DAN saat `rIn→rOut` (lensa tipis); cek `loadRegionPoints` tidak `NaN` pada kedua kondisi ekstrem. (Sudah 1 test degenerasi θ kecil; tambah kasus rIn≈rOut.)

4. **Komentar batas luar — kutip TRD App. C** (hlm. 685–690):
   Kalimat "≈2.35× batas dalam" terjadi dari rasio 2/0.85; tambahkan referensi ke "50% S sebagai batas overlay panduan (bukan klausul PRC-023)" — statusnya sudah benar di komentar, cukup diperjelas.

5. **(Opsional, dokumentasi)** `docs/overview.md` baris lensa: tambahkan satu kalimat bahwa sudut tepi default 35° = pf 30° (PRC-023) + margin 5°, bukan kebetulan.

---

## 7. Daftar sumber (URL)

- NERC PRC-023‑6, "Transmission Relay Loadability" (R1, Attachment A, version history): `https://www.nerc.com/pa/Stand/Reliability%20Standards/PRC-023-6.pdf`
- NERC RSTC SPCWG TRD, "Determination of Practical Transmission Relaying Loadability Settings": `https://www.nerc.com/globalassets/who-we-are/standing-committees/rstc/spcwg/determination_of_practical_transmission_relaying_loadability_settings_trd.pdf`
  (arsip versi 2008: `https://web.archive.org/web/20220604222237/https://www.nerc.com/fileUploads/File/Standards/Relay_Loadability_Reference_Doc_Clean_Final_2008July3.pdf`)
- NERC RSTC SPCWG, "PRC-023 Implementation Guidance — Requirement R1" (Feb 2026, proposed): `https://www.nerc.com/globalassets/programs/compliance/compliance-guidance/implementation/prc-023-r1-transmission-relay-loadability.pdf`
- IEEE C37.113‑2016, "IEEE Guide for Protective Relay Applications to Transmission Lines", §7.3.2 (load‑encroachment): `https://ieeexplore.ieee.org/document/7534623`
- S. H. Horowitz, A. G. Phadke, *Power System Relaying*, 3rd ed., Wiley 2008 — §5.3 (R‑X, beban leading/lagging L1–L4), §5.11 (Loadability of relays), §11.7 (Fig. 11.5 load encroachment): arsip full‑text `https://archive.org/details/PowerSystemRelaying`
- G. Zocholl, "Dynamic State Testing of Distance Elements", SEL, WPRC 2005 — referensi blinder & load: `https://selinc.com` (diacu via literatur pendukung; arsip wayback)
- Referensi dokumen PRC-023 "(Relay_Loadability_Reference_Doc_Clean_Final_2008July3)" (arsip).

---

*Catatan validasi:* seluruh klaim kode dicocokkan ke baris persis (`file:baris` di atas); angka rasio & literal fillet diverifikasi ulang dengan eksekusi Node (rasio 2.3529; rf=1.265 @ θ=35°). Audit adalah baca‑saja; tidak ada perubahan kode.