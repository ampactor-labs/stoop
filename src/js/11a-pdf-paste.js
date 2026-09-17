// ---------- the paste-up, on paper ----------
// Everything the screen lets somebody glue down has to survive the trip to
// the printer, or the sheet on screen is a mockup and the press is a lie.
// Coordinates arrive as fractions of the panel and land as points.
//
// Widths for the standard faces, in thousandths of an em, from code 32 up.
// Helvetica-BoldOblique is Helvetica-Bold sheared, so it shares that table
// exactly; Courier-Bold is 600 for every glyph like its roman.
var TIMES_BOLD_W = [250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520];
var TIMES_ITALIC_W = [250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541];

// The four hands a ransom note is cut from, and the voices a text element can
// speak in. `w` of null means a monospaced 600.
var FACES = {
  type: { f: 'F1', w: null },
  head: { f: 'F2', w: HELV_BOLD_W },
  hand: { f: 'F6', w: TIMES_ITALIC_W },
  ransom: { f: 'F2', w: HELV_BOLD_W }
};
var RANSOM_FACES = [
  { f: 'F2', w: HELV_BOLD_W },
  { f: 'F3', w: TIMES_BOLD_W },
  { f: 'F4', w: null },
  { f: 'F5', w: HELV_BOLD_W }
];

function faceOf(el) {
  return FACES[el.voice || 'type'] || FACES.type;
}

function glyphWidth(face, ch, size) {
  if (!face.w) return size * COURIER_W;
  var c = ch.charCodeAt(0);
  if (c < 32 || c > 126) c = 63;
  return face.w[c - 32] / 1000 * size;
}

function runWidth(face, text, size) {
  var total = 0;
  for (var i = 0; i < text.length; i++) total += glyphWidth(face, text.charAt(i), size);
  return total;
}

// Word wrap against a real width table, so a proportional headline breaks
// where it actually runs out of panel rather than where a monospace guess says.
function wrapFace(text, face, size, width) {
  var out = [];
  String(text || '').split('\n').forEach(function (para) {
    var line = '';
    para.split(/\s+/).forEach(function (word) {
      if (!word) return;
      var next = line ? line + ' ' + word : word;
      if (runWidth(face, next, size) <= width || !line) { line = next; return; }
      out.push(line);
      line = word;
    });
    out.push(line);
  });
  return out;
}

// An element's box, in PDF points. The paste-up layer covers the whole panel,
// padding included, because a cutting glued over the margin is the point.
function elBoxPdf(box, el) {
  var w = el.w * box.w;
  var h = el.h * box.h;
  var x = box.left + el.x * box.w;
  var top = box.top - el.y * box.h;
  return { x: x, y: top - h, w: w, h: h, top: top, cx: x + w / 2, cy: top - h / 2 };
}

// CSS turns clockwise with y running down the page; PDF turns anticlockwise
// with y running up. The same visual tilt is therefore the negative angle,
// applied about the element's own centre so it matches transform-origin.
function spin(deg, cx, cy) {
  if (!deg) return '';
  var t = deg * Math.PI / 180;
  var c = Math.cos(t).toFixed(5);
  var s = Math.sin(t).toFixed(5);
  return '1 0 0 1 ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ' cm\n' +
    c + ' ' + (-s).toFixed(5) + ' ' + s + ' ' + c + ' 0 0 cm\n' +
    '1 0 0 1 ' + (-cx).toFixed(2) + ' ' + (-cy).toFixed(2) + ' cm\n';
}

function rect(g) {
  return g.x.toFixed(2) + ' ' + g.y.toFixed(2) + ' ' + g.w.toFixed(2) + ' ' + g.h.toFixed(2) + ' re';
}

function pdfElPhoto(el, g, images) {
  var pic = el.photo && images[el.photo];
  if (!pic) return '';
  var iw = g.w, ih = g.h;
  var ar = pic.w / pic.h;
  if (el.crop) {
    // Fill the box and clip the overflow, which is what object-fit: cover does.
    if (g.w / g.h < ar) { ih = g.h; iw = ih * ar; } else { iw = g.w; ih = iw / ar; }
    return 'q ' + rect(g) + ' W n ' + iw.toFixed(2) + ' 0 0 ' + ih.toFixed(2) + ' ' +
      (g.cx - iw / 2).toFixed(2) + ' ' + (g.cy - ih / 2).toFixed(2) + ' cm /Im' + pic.num + ' Do Q\n';
  }
  if (g.w / g.h > ar) { ih = g.h; iw = ih * ar; } else { iw = g.w; ih = iw / ar; }
  return 'q ' + iw.toFixed(2) + ' 0 0 ' + ih.toFixed(2) + ' ' + (g.cx - iw / 2).toFixed(2) + ' ' +
    (g.cy - ih / 2).toFixed(2) + ' cm /Im' + pic.num + ' Do Q\n';
}

function pdfElRansom(el, g) {
  var size = el.size || 20;
  var ops = '';
  var x = g.x;
  var y = g.top - size;
  var lead = size * 1.5;
  ransomSpec(el.text).forEach(function (c) {
    if (c.ch === '\n') { x = g.x; y -= lead; return; }
    var s = size * c.scale;
    var face = RANSOM_FACES[c.face] || RANSOM_FACES[0];
    var cw = glyphWidth(face, c.ch, s) + 2;
    if (x + cw > g.x + g.w && c.ch !== ' ') { x = g.x; y -= lead; }
    if (y < g.y - size) return;
    if (c.ch !== ' ') {
      var ccx = x + cw / 2;
      var ccy = y + s * 0.32;
      ops += 'q\n' + spin(c.tilt, ccx, ccy);
      if (c.inv) {
        ops += '0 g ' + (x - 1).toFixed(2) + ' ' + (y - s * 0.22).toFixed(2) + ' ' +
          (cw + 1).toFixed(2) + ' ' + (s * 1.12).toFixed(2) + ' re f\n1 g\n';
      }
      ops += 'BT /' + face.f + ' ' + s.toFixed(2) + ' Tf 1 0 0 1 ' + x.toFixed(2) + ' ' +
        y.toFixed(2) + ' Tm (' + pdfEsc(c.ch) + ') Tj ET\n0 g\nQ\n';
    }
    x += cw;
  });
  return ops;
}

function pdfElText(el, g) {
  if ((el.voice || 'type') === 'ransom') return pdfElRansom(el, g);
  var face = faceOf(el);
  var size = el.size || 12;
  var lead = size * ((el.voice === 'head') ? 1.0 : 1.45);
  var ops = '';
  if (el.ink === 'white') ops += '0 g ' + rect(g) + ' f\n1 g\n';
  var y = g.top - size;
  wrapFace(el.text, face, size, g.w - 4).forEach(function (line) {
    if (y < g.y - size * 0.3) return;
    if (line.length) {
      ops += 'BT /' + face.f + ' ' + size + ' Tf 1 0 0 1 ' + (g.x + 2).toFixed(2) + ' ' +
        y.toFixed(2) + ' Tm (' + pdfEsc(line) + ') Tj ET\n';
    }
    y -= lead;
  });
  return ops + '0 g\n';
}

function pdfEl(el, box, images) {
  var g = elBoxPdf(box, el);
  var ops = 'q\n' + spin(el.rot || 0, g.cx, g.cy);
  if (el.kind === 'rule') {
    ops += '0 g ' + g.x.toFixed(2) + ' ' + g.y.toFixed(2) + ' ' + g.w.toFixed(2) + ' ' +
      Math.max(1.5, g.h).toFixed(2) + ' re f\n';
  } else if (el.kind === 'box') {
    ops += el.ink === 'white' ? '0 g ' + rect(g) + ' f\n' : 'q 2 w 0 G ' + rect(g) + ' S Q\n';
  } else if (el.kind === 'photo') {
    ops += pdfElPhoto(el, g, images);
  } else {
    ops += pdfElText(el, g);
  }
  return ops + 'Q\n';
}

function pdfPasteup(panel, box, images) {
  return elsOf(panel).slice()
    .sort(function (a, b) { return (a.z || 0) - (b.z || 0); })
    .map(function (el) { return pdfEl(el, box, images); })
    .join('');
}
