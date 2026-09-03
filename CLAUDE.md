# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This folder contains a single self-contained file: **`distance_relay_simulator.html`** — an educational, browser-only simulator for **distance relay protection** (sistem proteksi tenaga listrik). It plots how different relay characteristics (Impedance, Reactance, Mho, Quadrilateral) decide whether to trip, on an R–X plane. For a quick orientation (TL;DR, file map, feature summary, gotchas) read `docs/overview.md` first.

There is **no build system, no package manager, no test suite, no framework and no external tooling**. Everything runs in the browser, and the only external dependencies are loaded from CDNs (KaTeX for formula rendering, Google Fonts).

## Running it

Just open the `.html` file directly in a browser (double-click, or `file:///...`). For a quick orientation (TL;DR, file map, feature summary, gotchas) read `docs/overview.md` first. A static server also works:

```bash
python -m http.server      # then browse to http://localhost:8000
# or
npx serve
```

There is no lint/build/test command. The JS **can** run outside the browser via a small Node mock-DOM harness (see `/tmp/diag3.js`, `/tmp/measure.js` for the pattern): stub `document`/`window` with elements that capture `innerHTML`, then run the `<script>` body with `new Function(code + ';global.__pub={render,S,P,computeModel};')()`, and regex-measure the generated `#plane` SVG. This is the pixel-level validation loop for the R–X plane (label placement, zoom anchor invariance, extreme pan, no-NaN). The seam under test is the generated SVG string — what the browser actually draws.

In-repo harness & tests: `tools/lens-harness.js` stubs the DOM and exports `{render,S,P,computeModel,computeFaultCircuit,flowSegments,tripSequence,wheelZoomFactor,pinchZoomFactor,syncCollapsedCentering,loadRegion,loadRegionPoints,…}` plus captured elements (`els.<id>.innerHTML`/`textContent`); `tools/lens.test.js` (run with `node --test tools/lens.test.js`) verifies the **load-encroachment lens**: `loadzMin`/`loadzNom` PRC-023 literals, the **symmetric rounded wedge** (SVG bbox `minX≈−maxX`, ≥6 arc commands = 4 fillets + 2 boundary arcs, `loadRegion` fillet-tangency literals `phiI/phiO/ri1/ri2/rf`, 8 mirrored anchors, degenerate fallback `rf=0` without NaN), and the **dynamic operating point** (`<animateMotion>` closed `M…Z` ellipse path, dur 8–25 s, radial≠tangential `rx≠ry`, and the 4 ellipse cardinal points all staying inside the lens). `tools/readout.test.js` verifies the readout/status card (`.side-card`, mode `'relay'`) — summary sentence `.r-sum`, the two titled groups of `#readout` (`Impedansi gangguan` → `Lokasi gangguan & jangkauan`; the old `Relay & karakteristik` group was trimmed), and `#zoneLabel`/`#timeLabel` texts across trip/behind/no-trip/CT-PT-error scenarios. `tools/sld-v-i.test.js` verifies the SLD V/I feature: `computeFaultCircuit` literals (hand-derived) for a pure-X synthetic network across 3φ/φ-φ/φ-G × infeed off/×1/×4, loop tags, and the always-on SVG chips (the `#viToggle`/`P.showVI` toggle was removed). `tools/flow-anim.test.js` verifies the SLD flow-arrow physics: `flowSegments` segment/colour/`kA` literals plus `#sld` arrow glyphs ∝ `kA` per lane (never copper on L2, nothing past the fault, constant 125 px/s speed). `tools/side-mode.test.js` verifies the trimmed layout & two-mode right card: `tripSequence(m)` order literals, `P.sideMode='seq'` DOM (status/readout/formula/SIR incl. the zones being fully hidden — no leftover green block), and that `render()` no longer writes `#staircase`/`#typeNote`. `tools/plane-zoom.test.js` verifies the zoom & window spec (`wheelZoomFactor` ±15% per 100 px scroll + `pinchZoomFactor` for two-finger ctrlKey pinch — spread=zoom IN at ≈×1.08 per 10 px, inverted from the old bug; deltaMode normalisation; symmetry), the squeezed-to-card default window (both spans ×0.75, centered on the drawn content with even side gaps, plus a no-cut clamp that auto-widens the R window while at the default fit so drawn zones are never cropped on the sides; isotropic so circles stay round), the white halo on tick labels (`paint-order:stroke` + `stroke:var(--surface)`), and the adaptive canvas (`renderPlane` draws at measured `#plane` `clientWidth/Height`; 640×470 fallback only without layout). `tools/title-anim.test.js` verifies the animated header & collapse seams: `.tt-a`/`.tt-b` spans ("Simulator Distance Relay" ↔ "by Sheva - Endetta", crossfade keyframes `ttSwapA/B`, `tt-b` absolute), gradient `--ink→--copper-deep` without `--teal` + left→right shine sweep (`@keyframes ttShine`, band inside `background-size` clipped to text), `prefers-reduced-motion` killing both, the 4 `.card-b-i` wrappers (params cards only — the modal's `.card-b` stays unwrapped) with `grid-template-rows 1fr→0fr` + fade collapse (no `display:none`), and `syncCollapsedCentering()` toggling `.params-panel.all-collapsed` (stack centered when every card is collapsed). Run with `node tools/readout.test.js` / `node tools/sld-v-i.test.js` / `node tools/flow-anim.test.js` / `node tools/side-mode.test.js` / `node tools/plane-zoom.test.js` / `node tools/title-anim.test.js` / `node --test tools/lens.test.js`. All hard-code the HTML filename in their `fs.readFileSync`/`HTML` path — update if the file is ever renamed.

## Git & GitHub

Repo: `https://github.com/endetta/distance-relay-simulator` (remote `origin`, branch `main`, akun `endetta` via `gh` CLI).

- Setelah satu perubahan yang koheren selesai (fitur/fix/doc), **commit dan push ke `origin/main` di sesi yang sama** — jangan biarkan kerja selesai menggantung tanpa commit.
- Identitas git dikonfigurasi **repo-lokal** (`user.name=endetta`, `user.email=endetta@users.noreply.github.com`); jika `.git/config` hilang, ulangi dua baris `git config` itu.
- Artefak sementara (design plan, catatan kerja): selesaikan lalu hapus di sesi yang sama, atau commit bila mendokumentasikan keputusan yang layak diingat. Riwayat git adalah arsipnya — menghapus dokumen usang itu aman dan lebih baik daripada menumpuk dokumen basi.
- Peringatan LF→CRLF saat `git add` di Windows itu benign — abaikan.

## Architecture

The whole program is one `<script>` block, organized into these logical sections (in file order):

1. **Complex-number helpers** (`C`, `add`, `sub`, `scl`, `mag`, `ang`, `fromPolar`, `deg`, `rad`) — the electrical model works entirely in complex impedance space `{R, X}`. Most code reads through these, so never do raw `Math.hypot`/`Math.atan2` inline.

2. **Global state** — a single object `S` holds every parameter (line lengths/`r1`/`x1`, CTR/PTR, relay characteristic & RCA offset & R-reach multiplier, zones/load toggles, fault type/position/`Rf`/infeed, zone-2/3 times). All UI controls write into `S`; nothing else holds mutable state.

3. **DOM bindings** — `bindRange(id, key, suffix, dec)` and `setupGroup(groupId, fn)` (the callback receives the clicked button's `b.dataset.v`) wire sliders, buttons, and checkboxes to `S`. Every control change calls `onParamChange()` (which clamps fault position to line length) → `render()`. This is a purely reactive loop: mutate `S`, call `render()`.

4. **Core electrical model** — `computeModel()` is the single source of truth for all derived values. The model is **relay-centric** (4 relays R1–R4), each with a `bus` (A/B/C), a `direction` (`'fwd'`|`'rev'`), a `lineRef` (`'L1'`|`'L2'`), and per-relay reach/timing under `relay.z1Reach`/`z2Reach`/`t2`/`t3`/`rcaOffset`/`qrm`/`charType`. Key conventions to know before editing anything:
   - Line impedance **Z** is computed from per-km `r`/`x` × length (primary Ω), then converted to **secondary Ω** with `conv = CTR / PTR`.
   - **Per-relay zone reach** (secondary), via `relayZones(relay, m)`: `zone1 = scl(Zline, z1Reach)` (default **0.8**); `zone2 = Zline + scl(opp, z2Reach)` (0.5); `zone3 = Zline + opp + scl(opp, z3AdjLine+z3NextLine−1)` (default `1.0+0.2−1=0.2`). `Zline` = the relay's own line; `opp` = the other line.
   - **Apparent Z** at the fault = Z-to-fault plus `Rf × infeed` (and, in `rfMode 'Z'`, `Xf × infeed`); `infeed` applies only when `P.infeedOn`. Fwd/rev directions are placed on the R–X plane by `relayOrigin(relay,m)` (R1 at Bus A=0, R2/R3 at `m.Z1`, R4 at `m.Z1+m.Z2`) and `gz(relay,z,m)`.
   - **Measured Z** (`relayFaultZ` → `fz.zm`) carries the CT/PT error: `fz.zm = Z · (1−ptErr/100)/(1−ctErr/100)` — slider convention: positive error = transformer **under-delivers** the secondary signal (CT saturation ⇒ underreach, CVT transient ⇒ overreach). Tripping is decided on `fz.zm`, **not** `ZapparentS`. `fz.zl` is the pure line impedance to the fault (the point's true position on the ray).
   - **SIR** (source impedance ratio) = `|Zs| / |Z1p|`; drives the sensitivity note.
   - **Bus V & fault I for the SLD chips** (`computeFaultCircuit(m)`, also exported for tests): a deliberately simple equivalent, *not* part of the relay decision. E = VLL/√3 kV behind `Zs` at Bus A (source angle = L1 line angle); when `P.infeedOn`, an equal-EMF source at Bus B behind `Zs / P.infeed`. Fault is solved per fault type with classical symmetrical components under `Z1=Z2=Z0` (line and grounded sources), load ignored; fault current splits between the A and B paths by impedance divider, and passive stubs beyond the fault carry no current (voltage there = fault node). It returns, per bus, the relay-loop voltage (`|Vb−Vc|` for 3φ/φ-φ, `|Va|` for φ-G, kV primary) and loop fault currents per source + total (kA primary). `flowSegments` and `renderSLD` (and tests) consume it.
   - `tau = lineAngle + rcaOffset` orients the Mho circle.

5. **Trip decision** — `tripTest(relay, z, zn, zones, m)` returns true if **measured** Z falls inside a zone's characteristic shape; `relayFaultZ` computes the measured fault Z relative to the relay's bus and returns `{behind, z, zm, zl, ...}` (`behind` → no trip); `decideRelay(relay, m)` checks zones in order 1→2→3 and returns `{zone, time}` (`zone: 0` means no trip). Characteristic shapes:
   - **impedance**: circle centered at origin, `|z| ≤ |zn|`, plus a forward-direction check (`forwardOK`) on the line angle.
   - **reactance**: a band on `X` (`z.X ≤ zn.X`), bounded by the zone-3 reach for R.
   - **mho**: circle passing through origin, diameter along `tau`.
   - **quadrilateral**: rectangle `R ∈ [0, zn.X×qrm]`, `X ∈ [0, zn.X]`.
   - **Characteristic module — the single source of zone geometry**: `charShape(relay, zn, zones, m)` → `{kind:'circle', c, r, dir?}` | `{kind:'rect', c1, c2}`; `pointIn(shape, z)` tests points; `shapeBounds(shape)` gives the plot bounding box. All shape constants (impedance non-directional `dir` check, reactance blinder `1.3×zone3`, mho center = reach/2 along `tau`, quad R-reach = `zn.X×qrm`) are written ONCE here. `tripTest`, the `grow()` bounding pass in `renderPlane`, and `shapeSVG` all consume these — never duplicate zone geometry elsewhere. The mho/impedance angle follows the relay's `lineRef` (L1 → `m.lineAngle`, L2 → `ang(m.Z2)`) plus `rcaOffset`.

6. **Rendering** — four independent pure functions that each build an SVG string from `m` (model) and `dec` (decision) and set `innerHTML`:    - `renderPlane(m, dec)` — the R–X diagram (see *Rx diagram notes* below).    - `renderSLD(m)` — buses are thick vertical lines with relay boxes floating beside them (no arrows, no drop lines); a grid/infeed symbol below Bus B toggles `P.infeedOn` and stays in sync with its checkbox. The fault handle drags along the line (updates `S.pos`). All text is collected into the `lbl` string and appended LAST, each label carrying a paint-order halo — labels must never be buried under channel lines, fault arrows, or flow dashes (a past bug). The flow animation is ALWAYS drawn (no toggle) and re-renders with the fault position: lanes come from the pure `flowSegments(m, vi)` — L1 faults: red Sumber→fault (`ia`), copper B→fault (infeed `ib`, only when infeed on); L2 faults: red Sumber→B carries `ia` ONLY (never the infeed — a past artifact made it balloon at Bus B), B→fault is the combined red lane (`ifK`). Arrow glyph size is continuous ∝ `kA` (reference = bolted-at-A current `E/|ZsA|`), speed constant 125 px/s, nothing flows past the fault.
    - V/I chips (ALWAYS on — the `#viToggle`/`P.showVI` toggle was removed): `computeFaultCircuit(m)` feeds a per-bus loop-voltage chip (`V/Vbc/Va … kV`, blue, above each bus) plus current chips — `I … kA` under the Sumber label, `· … kA` appended to the Infeed caption (only when infeed on), `· If … kA` appended to the fault label. All still go through `lbl`, so they get the halo and never bury channel lines.
   - `updateReadout(m, dec)` — two-mode right card driven by `P.sideMode` (default `'relay'`): `'relay'` = the selected relay's status + `.r-sum` summary + readout with TWO titled groups (`Impedansi gangguan`, `Lokasi gangguan & jangkauan`; group `Relay & karakteristik` was trimmed) + KaTeX formula + SIR note; `'seq'` = trip sequence from pure `tripSequence(m)` — enabled relays sorted by operating time (zone-1 instant first, ties by zone then id) then non-trip relays with reason (`di belakang relay` / `di luar jangkauan`); status highlights the first trip and the `#formulaOut`/`#sirNote` zones are hidden entirely (content AND inline background cleared — no leftover empty green block). The staircase card (`renderStaircase`) and the `#typeNote`/`typeNotes` block were removed.
   - **Desktop height lock & SLD layout**: on ≥921px wide & ≥600px tall the whole page is locked to one viewport (`html,body{overflow:hidden}` + flex `.wrap`/`.layout`); only the `.params-panel` (and readout overflow if ever needed) scroll internally. The R–X svg is fit to the remaining column height by `fitPlane()` (aspect kept, `plane.style` px, `lockH()` gate), and the JS panel-height lock is bypassed in that mode. `renderSLD` content band is re-centered horizontally by ink extents (srcX 40→75, xA/xC 110/870→145/905) and compacted vertically (VBH 142→130, tightened label rows).

7. **Master** `render()` — `computeModel()` → `decideRelay()` per relay → `renderPlane`, `renderSLD`, `updateReadout` (right card). This is the only entry point; every state change funnels through it.

#### R–X diagram axis scaling (`renderPlane`)

The plot bounds are computed from the **bounding box of the zone shapes + fault points of enabled relays** (`minR`/`maxR`/`minX`/`maxX`, grown via `grow()`), **not** from the load zone. This is important: the load-encroachment wedge is a full-canvas overlay and must never influence the data scale, otherwise shrinking `Z beban minimum` collapses the entire grid (vertical lines bunch up against the left edge — a known past bug). The scale is **isotropic** (one `scale`, `plotH/spanXw`) so circles stay circular.

**Zoom = a data window**: `S.ui.view = {k, cx, cy}`. `k=1` fits the data; `k<1` widens the window (tick numbers show a wider range, boxes stay full-size & linear); `k>1` zooms in. `k` is clamped to `[0.12, 64]`. The window center `(cx, cy)` is in data (Ω) coordinates; `toPx` maps data → a fixed pixel plot box. Grid step is **dynamic 1-2-5** from the window width — not a fixed tick count.

**Clip separation**: the `clipPath` rect wraps only data content (zones, load wedge, bus markers, fault points); grid, axes and **all labels are drawn OUTSIDE the clip** so tick labels always stay visible at any zoom/pan. Tick labels live in the margins (`padL=38, padR=12, padT=10, padB=26`; axis titles `R (Ω)`/`X (Ω)` sit inside the plot) and each tick label carries a white halo (`paint-order:stroke` + `stroke:var(--surface)` width 3) so numbers stay readable even if curves run behind them.

**Adaptive canvas (no fixed viewBox anymore)**: `renderPlane` reads the element's actual `clientWidth`/`clientHeight` (fallback `640×470` only when there is no layout) and sets the svg `viewBox` to that same size → internal coordinates are 1:1 with CSS px. `fitPlane()` (desktop-lock mode) sizes `#plane` to fill the whole card above the legend and re-renders only when the dimensions actually change (`svg._dims` guard). The zoom toolbar is a **floating chip cluster inside the plot's top-right corner** (`.plane-card .toolbar` `position:absolute`, `pointer-events:none` on the container so only the buttons grab events; chip radius 12px matches the card) — no reserved band eats diagram height (`padT=10`). The **default window is squeezed to the card**: after the ratio-fill both spans are ×0.75 (`WIDE`) so `k=1` hugs the curves (R−X diagram fills the card); the R window is **centred on the drawn-content centre** so both side gaps are even (≈3% at desktop), and a **no-cut clamp** auto-widens it (margin 0.15 Ω) at the default fit (and on Fit/Reset) if the *drawn* zones (gz-transformed, incl. rev mirrors) would be cropped on the sides. The at-fit guard is recomputed every render (`cx` ≈ fit centre or origin) so the clamp survives init & resize; pan/zoom (k≠1 or shifted cx/cy) disables it. Multiplying both spans keeps the ratio → circles stay round (zone-1 circle top may clip slightly by design). **Gotcha**: because viewBox == CSS px, the wheel/pan handlers now use raw cursor offsets (`e.clientX-rect.left`) and read pads from `svg._map` — there is no `VBG/VBH2` constant pair to keep in sync anymore. Wheel zoom uses `wheelZoomFactor(deltaY, deltaMode)` — ±15% per 100 px of scroll (trackpad line/page deltas normalised), no longer the old 1.15× per event; **two-finger pinch** arrives as `ctrlKey` wheel events and uses `pinchZoomFactor(deltaY)` — spreading fingers (negative deltaY in Chrome) now zooms IN (sign flipped from the old inverted behaviour), ≈×1.08 per 10 px of spread.

**Layout**: the parameter cards live in a single scroll container `.params-panel`, height-locked to the main column (SLD → R–X) by a `ResizeObserver`; on screens ≤920px the lock is released via CSS `height:auto!important`.

## Fitur & perubahan sesi 2026-09-03 (konteks tambahan)

Baca `docs/overview.md` utk ringkasan orientasi cepat (TL;DR, peta file, gotcha).
Perubahan yang sudah masuk & wajib dijaga agar tidak rusak oleh edit berikutnya:

- **Splash pembuka** (`#splash`, IIFE sebelum init): tirai kiri→kanan, palet **ivory/krem**
  hangat (BUKAN navy — user menolak navy), teks = judul gradien `--ink→--copper-deep` +
  `S H E V A` (by-Sheva kecil sudah dihapus, jangan kembalikan). Timeline: `.go` masuk
  (~20ms) → `.out` + `#root.ready` (~1350ms) → hapus splash (~1860ms). Klik = skip;
  `prefers-reduced-motion` langsung skip; `<noscript>` fallback. **`.wrap` punya
  `opacity:0` bawaan dan hanya tampil via `#root.ready .wrap`** — jangan hapus, itu
  keputusan desain (halaman utama tak boleh terlihat sebelum animasi selesai). Tepi
  kiri–kanan panel memakai CSS `mask-image` gradien agar tidak tampak kotak keras.
- **Header halaman**: `.topbar .tt` 17px + dot copper; dua span `.tt-a` ("Simulator
  Distance Relay") & `.tt-b` ("by Sheva - Endetta", absolut, `left:20px` di belakang dot)
  bergantian via crossfade opacity (`@keyframes ttSwapA/ttSwapB`, 8 s), gradien
  `--ink→--copper-deep` (BUKAN `--blue→--teal`) + kilau menyapu kiri→kanan
  (`@keyframes ttShine`: band terang di dalam `background-size:260%` yang di-`background-clip`
  ke huruf, `background-position` 140%→-140%). `prefers-reduced-motion` mematikan animasi
  & menyembunyikan `tt-b`. `.wrap` padding 14px/40px (compact). Var di `:root`: `--teal`, `--copper-deep`.
- **Collapse animasi & pemusatan**: tiap `.card-b` parameter dibungkus `.card-b-i`
  (`overflow:hidden;min-height:0`); collapse memakai `grid-template-rows 1fr→0fr` + fade
  (bukan `display:none`). `syncCollapsedCentering()` menambah `.params-panel.all-collapsed`
  saat SEMUA kartu diciutkan → tumpukan dipusatkan (tak ada ruang kosong asimetris di bawah).
- **Lensa beban — wedge simetris ber-fillet & titik sistem DINAMIS**: hasil riset
  (eohm/IEEE, PRC-023): area beban standar = region berbentuk V/wedge; formula batas dalam
  `0.85·V²/S_maks` @ 0.85 pu benar. Lensa lama (sektor tajam satu sisi 0°..35° menempel
  sumbu R) diganti **wedge simetris ±(pf+margin)** (beban boleh lagging & leading) dengan
  **4 pojok difillet** (busur tangen ke busur & ray — tak ada sudut lancip). Geometri
  murni di `loadRegion(rIn,rOut,th)` (fillet radius `rf=min(0.10·Δ,0.8·rIn·sinθ,0.4·Δ)`, tangensi
  `phiI=θ−asin(rf/(rIn+rf))`, `ri1=√((rIn+rf)²−rf²)`; fallback wedge tajam `rf=0` saat θ kecil)
  + `loadRegionPoints` (8 jangkar simetris); renderPlane memakai keduanya (4 fillet + 2
  busur = 6 arc). **Titik sistem normal berfluktuasi sepanjang waktu** — mengelilingi
  `zlNow` dalam ellipse kecil via SVG `<animateMotion>` (path tertutup `M…Z`, `dur=14s`
  indefinite): sumbu radial dari headroom jari-jari (`0.35·min(rOut−|Z|,|Z|−rIn)`), sumbu
  tangensial dari headroom sudut (`0.5·|Z|·tan(θ−|∠zlNow|)`) → ellipse DIJAMIN di dalam
  lensa; label `sistem` ikut bergerak; fallback titik statis + pulse bila headroom habis.
  Lensanya tetap overlay yang TIDAK memengaruhi skala plot.
- **Kartu readout** (`updateReadout`): ringkasan `.r-sum` (1 kalimat + angka kunci) di atas
  tabel 2 grup (`Impedansi gangguan` / `Lokasi gangguan & jangkauan`; grup `Relay &
  karakteristik` DIHAPUS — info relay sudah ada di daftar relay kiri). Struktur ini diuji
  `tools/readout.test.js` — label lama (`Zone 1 reach`, `Z asli (saluran, primer)`, dst.)
  sudah dihapus dari DOM.
- **Kunci tinggi desktop & SLD compact/simetris (sesi ini)**: ≥921px & ≥600px → halaman
  terkunci satu layar (body `overflow:hidden`; hanya panel & konten yang scroll internal),
  kanvas R–X di-fit ke sisa tinggi via `fitPlane()` (`lockH()`), lock-tinggi JS panel
  dilewati di mode itu. `renderSLD`: blok isi dipusatkan berbasis tinta (srcX 40→75,
  xA/xC 110/870→145/905) & dirapatkan vertikal (VBH 142→130, baris label dirapatkan).
- **Mode 'Sekuens trip' tanpa sisa blok hijau**: zona `#formulaOut`/`#sirNote` kini
  disembunyikan penuh (display none + background di-clear) — dulu background hijau SIR
  tertinggal kosong.
- **Kanvas R–X DIPEPETKAN ke kartu, zoom roda/pinch & chip toolbar (sesi ini)**: jendela
  default ×0.75 sesudah ratio-fill (k=1 merapat — diagram mengisi kartu, gap kiri ≈ gap
  kanan ≈3% di desktop; label R −3..4 / X −2..2 di kanvas 720×430) + jendela R
  DIPUSATKAN pd pusat konten yg DIGAMBAR + clamp NO-CUT (margin 0.15 Ω): di fit default
  (k=1 & cx ≈ pusat fit/origin — dihitung ulang tiap render agar tetap aktif setelah
  init/resize) jendela R otomatis melebar bila konten DIGAMBAR (zona via gz) bakal
  terpotong kiri/kanan — nonaktif saat pan/zoom. Label tick R & X ber-halo putih
  (`paint-order:stroke` + `stroke:var(--surface)` width 3) agar terbaca di atas kurva;
  `padT` 14→10. Zoom roda `wheelZoomFactor` = ±15% per 100 px gulir (garis ≈16 px &
  halaman ≈400 px dinormalisasi) + helper `pinchZoomFactor` utk pinch dua-jari (wheel
  `ctrlKey`): renggangan = zoom IN (tanda dibalik dari yg terbalik), ≈×1.08 per 10 px.
  Toolbar zoom (−/+/Fit) = chip melayang DI DALAM plot pojok kanan-atas (radius 12px
  mengikuti kartu; container `pointer-events:none`). `renderPlane` ADAPTIF thd ukuran
  elemen (`clientWidth/Height`, fallback 640×470 utk tes; `viewBox` = ukuran → 1:1 px);
  `fitPlane()` mengisi kartu hingga legenda & render ulang hanya bila ukuran berubah
  (`svg._dims`). Handler wheel/pan memakai offset kursor mentah (tanpa konstanta
  VBG/VBH2). Diuji `tools/plane-zoom.test.js` (26 asersi).
- **Kartu kanan dua mode & pemangkasan layout (sesi ini)**: `#sideModeGroup`/`P.sideMode`
  (`'relay'` default | `'seq'`). Mode `'seq'` = sekuens trip dari `tripSequence(m)` (fungsi
  murni, diekspor `__pub`, diuji `tools/side-mode.test.js`): relay enabled urut waktu
  operasi → zona → id (Z1 seketika), non-trip disertakan dgn alasan; kotak status menyorot
  trip pertama; `#formulaOut`/`#sirNote` dikosongkan. Kartu `#staircase` (waktu–impedansi)
  & `#typeNote`/`typeNotes` DIHAPUS — kolom kanan berakhir di dasar `plane-row`, jadi
  batas bawah scroll panel parameter = dasar diagram R–X (lock tinggi `.main` otomatis).
- **Scrollbar tipis**: `.params-panel` 6px thumb pill `var(--line)` + track transparan +
  `scrollbar-width:thin` (Firefox).
- **Chip V/I di SLD (SELALU tampil — tombol dihapus)**: `computeFaultCircuit(m)` (lihat
  bullet model di atas). `#viToggle`/`P.showVI` DIHAPUS (menghalangi pojok SLD) — chip
  tegangan & arus selalu digambar. `viewBox` SLD = `980×130`; label `If … kA` baris
  TERPISAH di bawah label jenis gangguan; penanda copper "terlihat R1" di `y+62`.
- **Animasi aliran SLD (revisi sesi ini)**: jalur & arus panah bersumber dari fungsi murni
  `flowSegments(m, vi)` (`ia`/`ib`/`ifK` dari `computeFaultCircuit`). Aturan segmen: fault
  L1 → merah Sumber→fault = `ia`, copper B→fault = `ib` (infeed); fault L2 → merah
  Sumber→B = `ia` SAJA (artefak lama: segmen A–B ikut BESAR saat infeed nyala — dihapus),
  B→fault = gabungan `ifK`. Ukuran panah kontinu ∝ kA (ref hubung-singkat di Bus A),
  kecepatan tetap 125 px/s. `computeFaultCircuit` kini dihitung setiap render (dipakai   panah); chip V/I selalu tampil (toggle `#viToggle` dihapus). Diuji `tools/flow-anim.test.js` (17 asersi).
- **Harness & tes di repo**: `tools/lens-harness.js`, `tools/readout.test.js`,
  `tools/sld-v-i.test.js` (lihat bagian "Running it"). Harness diekspor fungsi baru hanya
  bila nama fungsi sudah ada di daftar `__pub` — saat menambah fungsi baru utk diuji,
  tambahkan ke daftar itu.

## Editing conventions

- Theme colors are CSS variables in `:root` (e.g. `--red`, `--copper`, `--blue`, `--green` and their `-soft` variants). SVG fill/stroke should reference these variables, not hard-coded hex.
- KaTeX is used for the apparent-Z formula; formulas are written in LaTeX strings rendered with `katex.render(...)`.
- The single-line diagram and the fault position slider share state (`S.pos`); keep them consistent if you change either.
- Zone-shape geometry in `shapeSVG()` depends on the same `toPx`/`scale` transform that `renderPlane` sets up, so any change to the transform must keep origin `R=0,X=0` mapped through `toPx(C(0,0))` — not a hard-coded panel coordinate.
