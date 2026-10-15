// ---------- stamps ----------
// The grammar of the form, ready cut: FREE, TAKE ONE, an arrow, a star, a
// strip of tape, a staple, a barcode that scans nothing. Each is one small
// description in a unit box, and the same description is drawn as SVG on
// the screen and as path operators on paper, so the two cannot drift.
//
//   p: polygon, points in 0..1     r: filled rect [x, y, w, h]
//   o: outlined rect [x,y,w,h,stroke]   l: line [x1, y1, x2, y2, stroke]
//   t: text, drawn upright and fitted to the box
var STAMPS = {
  free:    { w: 0.34, h: 0.11, ops: [{ o: [0.02, 0.06, 0.96, 0.88, 0.07] }, { t: 'FREE' }] },
  takeone: { w: 0.44, h: 0.11, ops: [{ o: [0.02, 0.06, 0.96, 0.88, 0.06] }, { t: 'TAKE ONE' }] },
  copy:    { w: 0.6,  h: 0.1,  ops: [{ o: [0.01, 0.06, 0.98, 0.88, 0.05] }, { t: 'PHOTOCOPY THIS' }] },
  no:      { w: 0.16, h: 0.13, ops: [{ t: '№' }] },
  arrow:   { w: 0.3,  h: 0.14, ops: [{ p: [[0, 0.32], [0.62, 0.32], [0.62, 0], [1, 0.5], [0.62, 1], [0.62, 0.68], [0, 0.68]] }] },
  star:    { w: 0.16, h: 0.2,  ops: [{ p: [[0.5, 0], [0.62, 0.36], [1, 0.38], [0.7, 0.62], [0.8, 1], [0.5, 0.78], [0.2, 1], [0.3, 0.62], [0, 0.38], [0.38, 0.36]] }] },
  tape:    { w: 0.4,  h: 0.07, ops: [{ o: [0, 0, 1, 1, 0.04] }, { l: [0.05, 1, 0.2, 0, 0.03] }, { l: [0.25, 1, 0.4, 0, 0.03] }, { l: [0.45, 1, 0.6, 0, 0.03] }, { l: [0.65, 1, 0.8, 0, 0.03] }, { l: [0.85, 1, 1, 0, 0.03] }] },
  staple:  { w: 0.07, h: 0.03, ops: [{ r: [0, 0, 1, 0.34] }, { r: [0, 0.34, 0.14, 0.66] }, { r: [0.86, 0.34, 0.14, 0.66] }] },
  barcode: { w: 0.3,  h: 0.1,  ops: [] },
  bat:     { w: 0.34, h: 0.11, ops: [] },
  moon:    { w: 0.18, h: 0.12, ops: [] }
};
var STAMP_ORDER = ['free', 'takeone', 'copy', 'no', 'arrow', 'star', 'tape', 'staple', 'barcode', 'bat', 'moon'];

// A bat, one half drawn and the other mirrored: ears, a curved leading edge
// out to the wrist and the wing tip, the trailing edge scalloped between
// the fingers, and the body down to the tail.
(function () {
  function quad(a, c, b, n) {
    var out = [];
    for (var i = 1; i <= n; i++) {
      var t = i / n, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
    return out;
  }
  var half = [[0.5, 0.16], [0.533, 0.12], [0.552, 0], [0.574, 0.16], [0.6, 0.25]]
    .concat(quad([0.6, 0.25], [0.73, 0], [0.86, 0.07], 5), quad([0.86, 0.07], [0.96, 0.12], [1, 0.34], 3));
  var tips = [[1, 0.34], [0.9, 0.68], [0.77, 0.76], [0.65, 0.68]];
  for (var i = 0; i + 1 < tips.length; i++) {
    var a = tips[i], b = tips[i + 1];
    half = half.concat(quad(a, [(a[0] + b[0]) / 2 - 0.02, (a[1] + b[1]) / 2 - 0.16], b, 4));
  }
  half = half.concat(quad([0.65, 0.68], [0.57, 0.74], [0.5, 0.97], 3));
  var mirror = half.slice(1, -1).reverse().map(function (q) { return [1 - q[0], q[1]]; });
  STAMPS.bat.ops.push({ p: half.concat(mirror).map(function (q) { return [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]; }) });
})();

// A crescent: the left of one circle, then back up the left of a second
// circle set to the right of it.
(function () {
  var pts = [], a;
  for (a = 70; a <= 290; a += 10) pts.push([0.5 + 0.5 * Math.cos(a * Math.PI / 180), 0.5 + 0.5 * Math.sin(a * Math.PI / 180)]);
  for (a = 250; a >= 110; a -= 10) pts.push([0.8 + 0.42 * Math.cos(a * Math.PI / 180), 0.5 + 0.47 * Math.sin(a * Math.PI / 180)]);
  STAMPS.moon.ops.push({ p: pts.map(function (q) { return [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]; }) });
})();

// The barcode's bars come from a hash so every copy of the issue draws the
// same nothing.
(function () {
  var x = 0, i = 0;
  while (x < 0.98) {
    var r = hash32('bar' + i);
    var w = 0.012 + (r % 4) * 0.008;
    var gap = 0.008 + ((r >>> 4) % 3) * 0.008;
    STAMPS.barcode.ops.push({ r: [x, 0, w, 0.82] });
    x += w + gap;
    i++;
  }
})();

function stampSvg(id) {
  var st = STAMPS[id];
  if (!st) return '';
  var W = 100, H = 100;
  var body = st.ops.map(function (op) {
    if (op.p) {
      return '<polygon points="' + op.p.map(function (pt) { return (pt[0] * W).toFixed(1) + ',' + (pt[1] * H).toFixed(1); }).join(' ') + '"/>';
    }
    if (op.r) return '<rect x="' + op.r[0] * W + '" y="' + op.r[1] * H + '" width="' + op.r[2] * W + '" height="' + op.r[3] * H + '"/>';
    if (op.o) {
      return '<rect x="' + op.o[0] * W + '" y="' + op.o[1] * H + '" width="' + op.o[2] * W + '" height="' + op.o[3] * H +
        '" fill="none" stroke="currentColor" stroke-width="' + (op.o[4] * H).toFixed(1) + '" vector-effect="non-scaling-stroke"/>';
    }
    if (op.l) {
      return '<line x1="' + op.l[0] * W + '" y1="' + op.l[1] * H + '" x2="' + op.l[2] * W + '" y2="' + op.l[3] * H +
        '" stroke="currentColor" stroke-width="' + (op.l[4] * H).toFixed(1) + '" vector-effect="non-scaling-stroke"/>';
    }
    return '';
  }).join('');
  var text = st.ops.filter(function (op) { return op.t; })[0];
  return '<svg class="stampsvg" viewBox="0 0 100 100" preserveAspectRatio="none" fill="currentColor">' + body + '</svg>' +
    (text ? '<div class="stamptext">' + esc(text.t) + '</div>' : '');
}

function stampHtml(el) {
  return '<div class="elstamp">' + stampSvg(el.stamp) + '</div>';
}

// The palette under + STAMP: every stamp, drawn small, one click to glue it
// to the page last touched.
function renderStampPalette(open) {
  var box = document.getElementById('stamps');
  if (!box) return;
  box.classList.toggle('on', !!open);
  if (!open) { box.innerHTML = ''; return; }
  box.innerHTML = STAMP_ORDER.map(function (id) {
    var st = STAMPS[id];
    return '<button class="stampbtn" data-stamp="' + id + '" title="' + id + '" aria-label="' + id + ' stamp" style="aspect-ratio:' +
      (st.w / st.h).toFixed(2) + '">' + stampSvg(id) + '</button>';
  }).join('') + kitPaletteHtml();
}

document.addEventListener('click', function (ev) {
  var t = ev.target;
  if (t.closest && t.closest('#stampbtn')) {
    var box = document.getElementById('stamps');
    renderStampPalette(!(box && box.classList.contains('on')));
    return;
  }
  var pick = t.closest && t.closest('[data-stamp]');
  if (pick) {
    addEl(pastePage, 'stamp', { stamp: pick.getAttribute('data-stamp') });
    renderStampPalette(false);
    renderPress();
    toast('Stamped. Drag it, turn it.');
  }
});
