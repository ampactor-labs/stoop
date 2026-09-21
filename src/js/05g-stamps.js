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
  barcode: { w: 0.3,  h: 0.1,  ops: [] }
};
var STAMP_ORDER = ['free', 'takeone', 'copy', 'no', 'arrow', 'star', 'tape', 'staple', 'barcode'];

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
    return '<button class="stampbtn" data-stamp="' + id + '" title="' + id + '" style="aspect-ratio:' +
      (st.w / st.h).toFixed(2) + '">' + stampSvg(id) + '</button>';
  }).join('');
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
