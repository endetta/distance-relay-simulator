/* Harness mock-DOM utk menjalankan <script> simulator di Node.
   Pola dari CLAUDE.md: stub document/window dgn elemen yg menangkap innerHTML,
   lalu jalankan isi <script> via new Function, ekspor __pub{render,S,P,computeModel}.
   Seam yang diuji tools/lens.test.js: string SVG #plane (path lensa) + nilai computeModel. */
'use strict';
const fs = require('fs');
const path = require('path');

function makeEl(id) {
  const listeners = {};
  const el = {
    id,
    innerHTML: '',
    textContent: '',
    value: '',
    checked: true,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    querySelectorAll: () => [],
    querySelector: () => makeEl('q'),  // generik: .sw dsb. cukup "ada"
    appendChild() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 470 }),
  };
  return el;
}

function loadSimulator(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('script block not found');
  const code = m[1];

  const elements = {};
  const getEl = id => (elements[id] = elements[id] || makeEl(id));
  const qsa = sel => {
    if (sel.startsWith('#')) return [getEl(sel.slice(1))];
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      // .card-h / .rels / .grid / .card[data-card] — harness hanya butuh yang statis
      if (cls === 'card-h') return ['line', 'load', 'fault', 'relays'].map(c => makeEl('h-' + c));
      return [];
    }
    return [];
  };
  const documentStub = {
    getElementById: getEl,
    querySelectorAll: qsa,
    querySelector: sel => (sel === '.main' ? makeEl('main') : null),
    createElement: tag => makeEl('dyn-' + tag),
  };
  global.document = documentStub;
  global.window = global;
  global.addEventListener = () => {};
  global.matchMedia = () => ({ matches: true }); // anggap layar sempit → panel height tak ditulis
  global.ResizeObserver = class { observe() {} };
  global.katex = { render() {} };

  new Function(code + ';global.__pub={render,S,P,computeModel,computeFaultCircuit,relayZones,relayFaultZ,C,add,scl,mag,ang,rad,deg};')();

  const pub = global.__pub;
  if (!pub || !pub.render) throw new Error('simulator did not export __pub');
  return { pub, els: elements };
}

/* Ambil SVG string terakhir yang ditulis ke #plane (els.plane.innerHTML). */
function planeSvg(ctx) { return ctx.els.plane.innerHTML; }

module.exports = { loadSimulator, planeSvg };
