// ---------- a code, glued anywhere ----------
// The back cover carries the scene's address as a code. A code is also a
// thing to glue down anywhere else: the band's songs beside their photo, the
// way to the show, a number to text. It comes from the same encoder, drawn
// square by square in the cutting's ink on a white square, and on paper as
// shapes rather than an image, so it scans at any size.
var qrSeen = new Map();

function qrOf(text) {
  var t = String(text || '');
  if (!qrSeen.has(t)) {
    if (qrSeen.size > 100) qrSeen.clear();
    qrSeen.set(t, t ? qrMatrix(t) : null);
  }
  return qrSeen.get(t);
}

// The dark squares as runs along each row, so a code is a few hundred shapes
// rather than a few thousand.
function qrRuns(m) {
  var runs = [];
  for (var y = 0; y < m.length; y++) {
    for (var x = 0; x < m.length; x++) {
      if (!m[y][x]) continue;
      var s = x;
      while (x + 1 < m.length && m[y][x + 1]) x++;
      runs.push([s, y, x - s + 1]);
    }
  }
  return runs;
}

function qrSvg(el) {
  var m = qrOf(el.text);
  if (!m) return '<div class="elmissing">' + (el.text ? 'too long for a code' : 'type a link below') + '</div>';
  var n = m.length + 8;
  return '<svg class="elqr" viewBox="0 0 ' + n + ' ' + n + '" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"' +
    ' role="img" aria-label="' + esc('A code for ' + el.text) + '"><rect width="' + n + '" height="' + n + '" fill="#fff"/>' +
    '<path fill="currentColor" d="' + qrRuns(m).map(function (r) {
      return 'M' + (r[0] + 4) + ' ' + (r[1] + 4) + 'h' + r[2] + 'v1h-' + r[2] + 'z';
    }).join('') + '"/></svg>';
}

// What a new code says before anybody types: the scene's own address, if it
// has one.
function defaultCodeText() {
  var a = (state.address || '').trim();
  return a ? (/^https?:\/\//.test(a) ? a : 'https://' + a) : '';
}

document.addEventListener('input', function (ev) {
  if (ev.target.id !== 'qrtext' || !pasteSel) return;
  updateEl(pasteSel, { text: ev.target.value.trim() });
  var node = liveEl(pasteSel);
  var panelEl = node && node.closest('.panel');
  var panel = panelEl && panelOfPage(Number(panelEl.getAttribute('data-page')));
  if (panel) paintPasteup(panelEl, panel);
});

// ---------- a code, on paper ----------
// A white square with its quiet margin, then the dark runs in the ink the
// cutting set, as one filled path.
function pdfElQr(el, g) {
  var m = qrOf(el.text);
  if (!m) return '';
  var n = m.length + 8;
  var size = Math.min(g.w, g.h), cell = size / n;
  var x0 = g.cx - size / 2, top = g.cy + size / 2;
  var ops = 'q 1 g ' + x0.toFixed(2) + ' ' + (top - size).toFixed(2) + ' ' + size.toFixed(2) + ' ' +
    size.toFixed(2) + ' re f Q\n';
  qrRuns(m).forEach(function (r) {
    ops += (x0 + (r[0] + 4) * cell).toFixed(3) + ' ' + (top - (r[1] + 5) * cell).toFixed(3) + ' ' +
      (r[2] * cell).toFixed(3) + ' ' + cell.toFixed(3) + ' re\n';
  });
  return ops + 'f\n';
}
