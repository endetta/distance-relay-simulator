# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This folder contains a single self-contained file: **`distance_relay_simulator.html`** — an educational, browser-only simulator for **distance relay protection** (sistem proteksi tenaga listrik). It plots how different relay characteristics (Impedance, Reactance, Mho, Quadrilateral) decide whether to trip, on an R–X plane.

There is **no build system, no package manager, no test suite, no framework and no external tooling**. Everything runs in the browser, and the only external dependencies are loaded from CDNs (KaTeX for formula rendering, Google Fonts).

## Running it

Just open the `.html` file directly in a browser (double-click, or `file:///...`). A static server also works:

```bash
python -m http.server      # then browse to http://localhost:8000
# or
npx serve
```

There is no lint/build/test command. The JS **can** run outside the browser via a small Node mock-DOM harness (see `/tmp/diag3.js`, `/tmp/measure.js` for the pattern): stub `document`/`window` with elements that capture `innerHTML`, then run the `<script>` body with `new Function(code + ';global.__pub={render,S,P,computeModel};')()`, and regex-measure the generated `#plane` SVG. This is the pixel-level validation loop for the R–X plane (label placement, zoom anchor invariance, extreme pan, no-NaN). The seam under test is the generated SVG string — what the browser actually draws.

## Architecture

The whole program is one `<script>` block, organized into these logical sections (in file order):

1. **Complex-number helpers** (`C`, `add`, `sub`, `scl`, `mag`, `ang`, `fromPolar`, `deg`, `rad`) — the electrical model works entirely in complex impedance space `{R, X}`. Most code reads through these, so never do raw `Math.hypot`/`Math.atan2` inline.

2. **Global state** — a single object `S` holds every parameter (line lengths/`r1`/`x1`, CTR/PTR, relay characteristic & RCA offset & R-reach multiplier, zones/load toggles, fault type/position/`Rf`/infeed, zone-2/3 times). All UI controls write into `S`; nothing else holds mutable state.

3. **DOM bindings** — `bindRange(id, key)` and `setupGroup(groupId, key)` wire sliders, buttons, and checkboxes to `S`. Every control change calls `onParamChange()` (which clamps fault position to line length) → `render()`. This is a purely reactive loop: mutate `S`, call `render()`.

4. **Core electrical model** — `computeModel()` is the single source of truth for all derived values. The model is **relay-centric** (4 relays R1–R4), each with a `bus` (A/B/C), a `direction` (`'fwd'`|`'rev'`), a `lineRef` (`'L1'`|`'L2'`), and per-relay reach/timing under `relay.z1Reach`/`z2Reach`/`t2`/`t3`/`rcaOffset`/`qrm`/`charType`. Key conventions to know before editing anything:
   - Line impedance **Z** is computed from per-km `r`/`x` × length (primary Ω), then converted to **secondary Ω** with `conv = CTR / PTR`.
   - **Per-relay zone reach** (secondary), via `relayZones(relay, m)`: `zone1 = scl(Zline, z1Reach)` (default **0.8**); `zone2 = Zline + scl(opp, z2Reach)` (0.5); `zone3 = Zline + opp + scl(opp, z3AdjLine+z3NextLine−1)` (default `1.0+0.2−1=0.2`). `Zline` = the relay's own line; `opp` = the other line.
   - **Apparent Z** at the fault = Z-to-fault plus `Rf × infeed` (and, in `rfMode 'Z'`, `Xf × infeed`); `infeed` applies only when `P.infeedOn`. Fwd/rev directions are placed on the R–X plane by `relayOrigin(relay,m)` (R1 at Bus A=0, R2/R3 at `m.Z1`, R4 at `m.Z1+m.Z2`) and `gz(relay,z,m)`.
   - **Measured Z** (`relayFaultZ` → `fz.zm`) carries the CT/PT error: `fz.zm = Z · (1−ptErr/100)/(1−ctErr/100)` — slider convention: positive error = transformer **under-delivers** the secondary signal (CT saturation ⇒ underreach, CVT transient ⇒ overreach). Tripping is decided on `fz.zm`, **not** `ZapparentS`. `fz.zl` is the pure line impedance to the fault (the point's true position on the ray).
   - **SIR** (source impedance ratio) = `|Zs| / |Z1p|`; drives the sensitivity note.
   - `tau = lineAngle + rcaOffset` orients the Mho circle.

5. **Trip decision** — `tripTest(relay, z, zn, zones, lineAngle)` returns true if **measured** Z falls inside a zone's characteristic shape; `relayFaultZ` computes the measured fault Z relative to the relay's bus and returns `{behind, z, zm, zl, ...}` (`behind` → no trip); `decideRelay(relay, m)` checks zones in order 1→2→3 and returns `{zone, time}` (`zone: 0` means no trip). Characteristic shapes:
   - **impedance**: circle centered at origin, `|z| ≤ |zn|`, plus a forward-direction check (`forwardOK`) on the line angle.
   - **reactance**: a band on `X` (`z.X ≤ zn.X`), bounded by the zone-3 reach for R.
   - **mho**: circle passing through origin, diameter along `tau`.
   - **quadrilateral**: rectangle `R ∈ [0, zn.X×qrm]`, `X ∈ [0, zn.X]`.

6. **Rendering** — four independent pure functions that each build an SVG string from `m` (model) and `dec` (decision) and set `innerHTML`:
   - `renderPlane(m, dec)` — the R–X diagram (see *Rx diagram notes* below).
   - `renderSLD(m)` — buses are thick vertical lines with relay boxes floating beside them (no arrows, no drop lines); a grid/infeed symbol below Bus B toggles `P.infeedOn` and stays in sync with its checkbox. The fault handle drags along the line (updates `S.pos`).
   - `renderStaircase(m, dec)` — time–impedance (time–distance) steps for the selected relay.
   - `updateReadout(m, dec)` — status box, readout table, KaTeX formula, SIR note, and the per-characteristic explanatory note (`typeNotes`).

7. **Master** `render()` — `computeModel()` → `decideRelay()` per relay → calls all four renderers. This is the only entry point; every state change funnels through it.

#### R–X diagram axis scaling (`renderPlane`)

The plot bounds are computed from the **bounding box of the zone shapes + fault points of enabled relays** (`minR`/`maxR`/`minX`/`maxX`, grown via `grow()`), **not** from the load zone. This is important: the load-encroachment wedge is a full-canvas overlay and must never influence the data scale, otherwise shrinking `Z beban minimum` collapses the entire grid (vertical lines bunch up against the left edge — a known past bug). The scale is **isotropic** (one `scale`, `plotH/spanXw`) so circles stay circular.

**Zoom = a data window**: `S.ui.view = {k, cx, cy}`. `k=1` fits the data; `k<1` widens the window (tick numbers show a wider range, boxes stay full-size & linear); `k>1` zooms in. `k` is clamped to `[0.12, 64]`. The window center `(cx, cy)` is in data (Ω) coordinates; `toPx` maps data → a fixed pixel plot box. Grid step is **dynamic 1-2-5** from the window width — not a fixed tick count.

**Clip separation**: the `clipPath` rect wraps only data content (zones, load wedge, bus markers, fault points); grid, axes and **all labels are drawn OUTSIDE the clip** so tick labels always stay visible at any zoom/pan. Tick labels live in the margins (`padL=38, padR=12, padT=10, padB=26` in a `640×470` viewBox; axis titles `R (Ω)`/`X (Ω)` sit inside the plot).

**Gotcha**: the zoom/pan handlers read pads from `svg._map` (so they follow renderPlane automatically), but the `const VBG=640,VBH2=470` in the handlers and the svg's `viewBox="0 0 640 470"` attribute **must match** the `VBW/VBH` in renderPlane, or zoom/pan coordinates diverge.

**Layout**: the parameter cards live in a single scroll container `.params-panel`, height-locked to the main column (SLD → R–X) by a `ResizeObserver`; on screens ≤920px the lock is released via CSS `height:auto!important`.

## Editing conventions

- Theme colors are CSS variables in `:root` (e.g. `--red`, `--copper`, `--blue`, `--green` and their `-soft` variants). SVG fill/stroke should reference these variables, not hard-coded hex.
- KaTeX is used for the apparent-Z formula; formulas are written in LaTeX strings rendered with `katex.render(...)`.
- The single-line diagram and the fault position slider share state (`S.pos`); keep them consistent if you change either.
- Zone-shape geometry in `shapeSVG()` depends on the same `toPx`/`scale` transform that `renderPlane` sets up, so any change to the transform must keep origin `R=0,X=0` mapped through `toPx(C(0,0))` — not a hard-coded panel coordinate.
