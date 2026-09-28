// ---------- the pages, for a print shop ----------
// A shop with a proper press imposes the pages itself and wants them one to a
// sheet of the PDF, in reading order, each with an eighth of an inch of bleed
// past its trimmed edge and marks showing where to cut. A page colour, a
// photograph filling the page and a cutting hung over the edge all run on
// into the bleed, so the blade never leaves a white hairline.
var BLEED = 9;
var MARKS = 18;

function shopBox(pw, ph) {
  var left = MARKS + BLEED, top = MARKS + BLEED + ph;
  return {
    left: left, top: top, w: pw, h: ph, bleed: BLEED,
    cx: left + pw / 2, cy: top - ph / 2,
    x: left + PAD_X, y: top - PAD_Y,
    cw: pw - PAD_X * 2, ch: ph - PAD_Y * 2
  };
}

// Two short hairlines at each corner of the trim, out beyond the bleed.
function cropMarks(box) {
  var ops = 'q 0.25 w 0 G\n';
  var x0 = box.left, x1 = box.left + box.w, y0 = box.top - box.h, y1 = box.top;
  var near = BLEED + 3, far = BLEED + MARKS - 2;
  [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]].forEach(function (c) {
    ops += (c[0] + c[2] * near).toFixed(2) + ' ' + c[1].toFixed(2) + ' m ' + (c[0] + c[2] * far).toFixed(2) + ' ' +
      c[1].toFixed(2) + ' l S ' + c[0].toFixed(2) + ' ' + (c[1] + c[3] * near).toFixed(2) + ' m ' +
      c[0].toFixed(2) + ' ' + (c[1] + c[3] * far).toFixed(2) + ' l S\n';
  });
  return ops + 'Q\n';
}

function writeShopPdf(panels, formatId, url, issue, gen) {
  var doc = pdfDoc();
  var size = pageSize(formatId);
  var pw = Number(size.pw), ph = Number(size.ph);
  var mw = pw + 2 * (BLEED + MARKS), mh = ph + 2 * (BLEED + MARKS);
  var box = shopBox(pw, ph);
  var n = panels.length;
  var r = function (x0, y0, x1, y1) { return '[' + [x0, y0, x1, y1].map(function (v) { return v.toFixed(2); }).join(' ') + ']'; };
  return pdfPrepare(doc, panels, url, gen).then(function (got) {
    var pages = panels.map(function (p, i) {
      var page = i + 1;
      var panel = p || { h: '', body: '', photo: null };
      if (page === 1) {
        var cover = { issue: issue };
        Object.keys(panel).forEach(function (k) { if (k !== 'issue') cover[k] = panel[k]; });
        panel = cover;
      }
      var inner = pdfPanel(panel, page, n, box, got.images, url, spreadGhosts(panels, page, ph / pw));
      return {
        ops: 'q ' + (box.left - BLEED).toFixed(2) + ' ' + (box.top - box.h - BLEED).toFixed(2) + ' ' +
          (pw + 2 * BLEED).toFixed(2) + ' ' + (ph + 2 * BLEED).toFixed(2) + ' re W n\n' + pdfFill(panel, box) + inner +
          'Q\n0 g ' + pdfSpeckle(gen, box, 'p' + page) + cropMarks(box),
        boxes: '/MediaBox' + r(0, 0, mw, mh) +
          '/BleedBox' + r(MARKS, MARKS, mw - MARKS, mh - MARKS) +
          '/TrimBox' + r(MARKS + BLEED, MARKS + BLEED, mw - MARKS - BLEED, mh - MARKS - BLEED)
      };
    });
    return pdfFinish(doc, pages, got.resources);
  });
}

function saveShopPdf(panels, formatId, url, issue, name, gen) {
  toast('Writing the pages for a print shop…');
  return loadFaces().then(function () { return writeShopPdf(panels, formatId, url, issue, gen); }).then(function (blob) {
    downloadBlob(name, blob);
    toast('Saved: one page to a sheet, with bleed and crop marks, in reading order');
  }).catch(function (e) { toast('Could not write the PDF: ' + e.message); });
}

document.addEventListener('click', function (ev) {
  var t = ev.target.closest && ev.target.closest('#pdfshopbtn,[data-shopissue]');
  if (!t) return;
  if (t.id === 'pdfshopbtn') {
    capturePanels();
    if (!confirmSheet('Save a PDF for a print shop')) return;
    var ps = pressState();
    saveShopPdf(ps.panels, ps.format, issueUrl(ps.issue), ps.issue, sceneSlug() + '-' + ps.issue + '-shop.pdf', genOf(ps));
    return;
  }
  var iss = issueByNo(t.getAttribute('data-shopissue'));
  if (iss) saveShopPdf(iss.panels || [], iss.format, issueUrl(iss.no), iss.no, sceneSlug() + '-' + iss.no + '-shop.pdf', iss.gen);
});
