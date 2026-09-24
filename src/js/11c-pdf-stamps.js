// ---------- stamps, on paper ----------
// The same unit-box descriptions in 05g-stamps.js, as path operators. A
// stamp's text is fitted to its box in the page's own face, as on screen.
function pdfElStamp(el, g) {
  var st = STAMPS[el.stamp];
  if (!st) return '';
  var X = function (v) { return (g.x + v * g.w).toFixed(2); };
  var Y = function (v) { return (g.top - v * g.h).toFixed(2); };
  var ops = '0 g 0 G\n';
  st.ops.forEach(function (op) {
    if (op.p) {
      ops += op.p.map(function (pt, i) { return X(pt[0]) + ' ' + Y(pt[1]) + (i ? ' l' : ' m'); }).join(' ') + ' f\n';
    } else if (op.r) {
      ops += X(op.r[0]) + ' ' + Y(op.r[1] + op.r[3]) + ' ' + (op.r[2] * g.w).toFixed(2) + ' ' + (op.r[3] * g.h).toFixed(2) + ' re f\n';
    } else if (op.o) {
      ops += 'q ' + (op.o[4] * g.h).toFixed(2) + ' w ' + X(op.o[0]) + ' ' + Y(op.o[1] + op.o[3]) + ' ' +
        (op.o[2] * g.w).toFixed(2) + ' ' + (op.o[3] * g.h).toFixed(2) + ' re S Q\n';
    } else if (op.l) {
      ops += 'q ' + (op.l[4] * g.h).toFixed(2) + ' w ' + X(op.l[0]) + ' ' + Y(op.l[1]) + ' m ' + X(op.l[2]) + ' ' + Y(op.l[3]) + ' l S Q\n';
    } else if (op.t) {
      // The screen sets the lettering at 62% of the box and centres its line
      // box, which puts the baseline this far below the middle for any face.
      var face = displayFace();
      var f = face.face;
      var size = g.h * 0.62;
      while (size > 4 && runWidth(face, op.t, size) > g.w * 0.86) size -= 0.5;
      var tw = runWidth(face, op.t, size);
      var below = f ? f.ascent / f.upm - (f.ascent - f.descent) / f.upm / 2 : 0.36;
      ops += 'BT /' + face.f + ' ' + size.toFixed(2) + ' Tf 1 0 0 1 ' + (g.cx - tw / 2).toFixed(2) + ' ' +
        (g.cy - size * below).toFixed(2) + ' Tm (' + pdfEsc(faceText(face, op.t)) + ') Tj ET\n';
    }
  });
  return ops;
}

// Toner over a panel, at the generation the issue was printed at.
function pdfSpeckle(gen, box, seed) {
  return speckle(gen, seed).map(function (d) {
    return (box.left + d.x * box.w).toFixed(2) + ' ' + (box.top - d.y * box.h).toFixed(2) + ' ' +
      d.s.toFixed(2) + ' ' + d.s.toFixed(2) + ' re';
  }).join(' ') + (gen ? ' f\n' : '');
}
