// ---------- the sheet, as a PDF ----------
// The same imposition the screen draws, laid onto paper at exact coordinates.
// PDF puts its origin at the bottom left and CSS at the top left, so every
// vertical here is measured down from the panel's top edge and flipped once,
// at the end, rather than reasoned about twice.

var PAD_X = 0.3 * PT_PER_IN;     // the panel padding from views.css, in points
var PAD_Y = 0.28 * PT_PER_IN;

function pdfLayout(formatId) {
  var paper = paperOf(formatId);
  return { w: paper.wpt, h: paper.hpt };
}

// A panel's content box, in PDF coordinates.
function panelBox(geom, sheet, index) {
  var pw = geom.w / sheet.cols;
  var ph = geom.h / sheet.rows;
  var col = index % sheet.cols;
  var row = Math.floor(index / sheet.cols);
  var left = col * pw;
  var top = geom.h - row * ph;
  return {
    left: left, top: top, w: pw, h: ph,
    cx: left + pw / 2, cy: top - ph / 2,
    x: left + PAD_X, y: top - PAD_Y,
    cw: pw - PAD_X * 2, ch: ph - PAD_Y * 2
  };
}

function pdfLine(text, font, size, x, y) {
  return 'BT /' + font + ' ' + size + ' Tf 1 0 0 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) +
    ' Tm (' + pdfEsc(text) + ') Tj ET\n';
}

// A heading breaks where the screen broke it, since both measure the same
// face at the same width; the issue number shrinks to its line instead, the
// way a number would. Returns the ink and how far the next thing moves down.
function pdfHeading(text, x, y, width, size, lh, oneLine) {
  var face = displayFace();
  var s = size;
  if (oneLine) while (s > 7 && runWidth(face, text, s) > width) s -= 0.5;
  var lead = s * (lh || 1.05);
  var base = y - (face.face ? faceBaseline(face.face, s, lead) : s);
  var lines = oneLine ? [text] : wrapFace(text, face, s, width);
  var op = '';
  lines.forEach(function (line) {
    if (line) op += pdfLine(faceText(face, line), face.f, s, x, base);
    base -= lead;
  });
  return { op: op, drop: lines.length * lead };
}

function pdfPanel(panel, page, pages, box, images, url) {
  var ops = '';
  var y = box.y;
  var isCover = page === 1;
  var isBack = page === pages;

  // The vertical rhythm is views.css in points: the h3 and its 6px below,
  // the number at line-height .9 with 2px either side, the 3px rule with 6px
  // either side, the photograph with 5px under it.
  var head = pdfHeading(String(panel.h || '').toUpperCase(), box.x, y, box.cw, isCover ? 18 : 15);
  ops += head.op;
  y -= head.drop + 4.5;

  if (isCover) {
    var no = pdfHeading('\u2116' + (panel.issue || ''), box.x, y - 1.5, box.cw, 51, 0.9, true);
    ops += no.op;
    y -= no.drop + 3;
    ops += 'q 2.25 w 0 G ' + box.x.toFixed(2) + ' ' + (y - 5.625).toFixed(2) + ' m ' +
      (box.x + box.cw).toFixed(2) + ' ' + (y - 5.625).toFixed(2) + ' l S Q\n';
    y -= 11.25;
  }

  var pic = panel.photo && images[panel.photo];
  if (pic) {
    var iw = box.cw;
    var ih = iw * (pic.h / pic.w);
    var cap = box.h * 0.46;
    if (ih > cap) { ih = cap; iw = ih * (pic.w / pic.h); }
    ops += 'q ' + iw.toFixed(2) + ' 0 0 ' + ih.toFixed(2) + ' ' + box.x.toFixed(2) + ' ' +
      (y - ih).toFixed(2) + ' cm /Im' + pic.num + ' Do Q\n';
    y -= ih + 3.75;
  }

  // Courier New at line-height 1.45 puts its first baseline .99em down.
  var size = isBack ? 7.875 : 8.625;
  var leading = size * 1.45;
  var floorY = box.top - box.h + PAD_Y + (isBack && url ? 52 : 0);
  y -= size * 0.99;
  wrapMono(panel.body || '', size, box.cw).forEach(function (line) {
    if (y < floorY) return;
    if (line.length) ops += pdfLine(line, 'F1', size, box.x, y);
    y -= leading;
  });

  if (isBack && url) {
    var qr = images['__qr'];
    var qy = box.top - box.h + PAD_Y;
    if (qr) {
      ops += 'q 48 0 0 48 ' + box.x.toFixed(2) + ' ' + qy.toFixed(2) + ' cm /Im' + qr.num + ' Do Q\n';
    }
    var tx = box.x + (qr ? 54 : 0);
    var shown = url.replace(/^https?:\/\//, '');
    wrapMono(shown, 6.375, box.cw - (qr ? 54 : 0)).slice(0, 4).forEach(function (line, i) {
      ops += pdfLine(line, 'F1', 6.375, tx, qy + 34 - i * 8);
    });
  }
  return ops + pdfPasteup(panel, box, images);
}

// A flipped panel is the same drawing rotated half a turn about its own
// centre, which is the one place this file has to think in two directions at
// once. Everything inside the q/Q pair is drawn as though it were upright.
function pdfSheetContent(sheet, panels, geom, images, url, issue, gen) {
  var ops = '';
  sheet.slots.forEach(function (slot, i) {
    var box = panelBox(geom, sheet, i);
    ops += '0 g ' + pdfSpeckle(gen, box, 'p' + slot.page);
    var panel = panels[slot.page - 1] || { h: '', body: '', photo: null };
    if (slot.page === 1) panel = { h: panel.h, body: panel.body, photo: panel.photo, els: panel.els, issue: issue };
    var inner = pdfPanel(panel, slot.page, panels.length, box, images, url);
    if (slot.flip) {
      ops += 'q -1 0 0 -1 ' + (2 * box.cx).toFixed(2) + ' ' + (2 * box.cy).toFixed(2) + ' cm\n' +
        inner + 'Q\n';
    } else {
      ops += inner;
    }
  });
  return ops;
}

// ---------- the public call ----------
// Gathers every image the sheet needs, then writes one page per printed side.
function buildSheetPdf(panels, formatId, hand, url, issue, gen) {
  var doc = pdfDoc();
  var plan = impose(formatId, hand);
  var geom = pdfLayout(formatId);
  var wanted = [];

  var want = function (id) {
    if (id && photoCache[id] && wanted.indexOf(id) < 0) wanted.push(id);
  };
  panels.forEach(function (p) {
    if (!p) return;
    want(p.photo);
    elsOf(p).forEach(function (el) { if (el.kind === 'photo') want(el.photo); });
  });

  var images = {};
  var chain = Promise.resolve();
  wanted.forEach(function (id) {
    chain = chain.then(function () {
      return pdfAddImage(doc, photoCache[id], gen).then(function (ref) { if (ref) images[id] = ref; });
    });
  });
  if (url) {
    chain = chain.then(function () {
      return pdfAddImage(doc, qrDataUrl(url, 4)).then(function (ref) { if (ref) images['__qr'] = ref; });
    });
  }

  // The page's own typeface travels with the sheet, so the headline on paper
  // is the headline on screen, glyph for glyph.
  var face = pressFaceLoaded();
  var faceNum = 0;
  if (face) chain = chain.then(function () { return pdfEmbedFace(doc, face).then(function (n) { faceNum = n; }); });

  return chain.then(function () {
    var xobjects = Object.keys(images).map(function (k) {
      return '/Im' + images[k].num + ' ' + images[k].num + ' 0 R';
    }).join('');
    var std = function (name) {
      return doc.obj(['<</Type/Font/Subtype/Type1/BaseFont/' + name + '/Encoding/WinAnsiEncoding>>']);
    };
    var courier = std('Courier');
    var helv = std('Helvetica-Bold');
    var resources = '/Font<</F1 ' + courier + ' 0 R/F2 ' + helv + ' 0 R' +
      '/F3 ' + std('Times-Bold') + ' 0 R/F4 ' + std('Courier-Bold') + ' 0 R' +
      '/F5 ' + std('Helvetica-BoldOblique') + ' 0 R/F6 ' + std('Times-Italic') + ' 0 R' +
      (faceNum ? '/F7 ' + faceNum + ' 0 R' : '') + '>>' +
      (xobjects ? '/XObject<<' + xobjects + '>>' : '');

    var pagesNum = doc.obj(['']);          // reserved: the page tree needs its kids first
    var kids = plan.sheets.map(function (sheet) {
      var content = doc.stream('', pdfBytes(pdfSheetContent(sheet, panels, geom, images, url, issue, gen)));
      return doc.obj(['<</Type/Page/Parent ' + pagesNum + ' 0 R/MediaBox[0 0 ' +
        geom.w.toFixed(2) + ' ' + geom.h.toFixed(2) + ']/Resources<<' + resources +
        '>>/Contents ' + content + ' 0 R>>']);
    });
    doc.replace(pagesNum, ['<</Type/Pages/Count ' + kids.length + '/Kids[' +
      kids.map(function (k) { return k + ' 0 R'; }).join(' ') + ']>>']);
    var root = doc.obj(['<</Type/Catalog/Pages ' + pagesNum + ' 0 R>>']);
    return doc.build(root);
  });
}

function savePdf(panels, formatId, hand, url, issue, name, gen) {
  toast('Writing the PDF…');
  return buildSheetPdf(panels, formatId, hand, url, issue, gen).then(function (blob) {
    var href = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 1000);
    toast('PDF saved — exact size, no print dialog to argue with');
  }).catch(function (e) {
    toast('Could not write the PDF: ' + e.message);
  });
}
