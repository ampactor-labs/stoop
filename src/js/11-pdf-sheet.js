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

// Headings shrink to fit rather than spilling off the panel, which is what the
// screen does by clipping and what a reader would rather have.
function pdfHeading(text, x, y, width, size) {
  var s = size;
  while (s > 7 && helvBoldWidth(text, s) > width) s -= 0.5;
  return { op: pdfLine(text, 'F2', s, x, y - s), drop: s * 1.15 };
}

function pdfPanel(panel, page, pages, box, images, url) {
  var ops = '';
  var y = box.y;
  var isCover = page === 1;
  var isBack = page === pages;

  var head = pdfHeading(String(panel.h || '').toUpperCase(), box.x, y, box.cw, isCover ? 18 : 15);
  ops += head.op;
  y -= head.drop;

  if (isCover) {
    var no = pdfHeading('No.' + (panel.issue || ''), box.x, y - 4, box.cw, 51);
    ops += no.op;
    y -= no.drop + 4;
    ops += 'q 2 w 0 G ' + box.x.toFixed(2) + ' ' + (y - 2).toFixed(2) + ' m ' +
      (box.x + box.cw).toFixed(2) + ' ' + (y - 2).toFixed(2) + ' l S Q\n';
    y -= 10;
  }

  var pic = panel.photo && images[panel.photo];
  if (pic) {
    var iw = box.cw;
    var ih = iw * (pic.h / pic.w);
    var cap = box.h * 0.46;
    if (ih > cap) { ih = cap; iw = ih * (pic.w / pic.h); }
    ops += 'q ' + iw.toFixed(2) + ' 0 0 ' + ih.toFixed(2) + ' ' + box.x.toFixed(2) + ' ' +
      (y - ih).toFixed(2) + ' cm /Im' + pic.num + ' Do Q\n';
    y -= ih + 4;
  }

  var size = isBack ? 7.875 : 8.625;
  var leading = size * 1.45;
  var floorY = box.top - box.h + PAD_Y + (isBack && url ? 52 : 0);
  wrapMono(panel.body || '', size, box.cw).forEach(function (line) {
    if (y - leading < floorY) return;
    y -= leading;
    if (line.length) ops += pdfLine(line, 'F1', size, box.x, y);
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
function pdfSheetContent(sheet, panels, geom, images, url, issue) {
  var ops = '';
  sheet.slots.forEach(function (slot, i) {
    var box = panelBox(geom, sheet, i);
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
function buildSheetPdf(panels, formatId, hand, url, issue) {
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
      return pdfAddImage(doc, photoCache[id]).then(function (ref) { if (ref) images[id] = ref; });
    });
  });
  if (url) {
    chain = chain.then(function () {
      return pdfAddImage(doc, qrDataUrl(url, 4)).then(function (ref) { if (ref) images['__qr'] = ref; });
    });
  }

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
      '/F5 ' + std('Helvetica-BoldOblique') + ' 0 R/F6 ' + std('Times-Italic') + ' 0 R>>' +
      (xobjects ? '/XObject<<' + xobjects + '>>' : '');

    var pagesNum = doc.obj(['']);          // reserved: the page tree needs its kids first
    var kids = plan.sheets.map(function (sheet) {
      var content = doc.stream('', pdfBytes(pdfSheetContent(sheet, panels, geom, images, url, issue)));
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

function savePdf(panels, formatId, hand, url, issue, name) {
  toast('Writing the PDF…');
  return buildSheetPdf(panels, formatId, hand, url, issue).then(function (blob) {
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
