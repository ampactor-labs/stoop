// ---------- the flyer ----------
// A sheet for a noticeboard: the zine's name big enough to read walking past,
// and a fringe of tear-off tabs each carrying the address sideways. Split from
// the sheet writer only because the file hit its line ceiling; it shares
// pdfDoc, the fonts and the image packing with it.
// Tear-off tabs go here rather than on a back cover, because tearing a tab off
// a folded zine destroys the zine.
var FLYER = { w: 612, h: 792, pad: 54, strip: 96, tabs: 8 };

function pdfFlyerContent(title, issue, url, photo, images) {
  var F = FLYER;
  var ops = '';
  var y = F.h - F.pad;
  var width = F.w - F.pad * 2;

  var head = pdfHeading(String(title || 'A ZINE').toUpperCase(), F.pad, y, width, 42);
  ops += head.op;
  y -= head.drop + 6;

  ops += 'q 3 w 0 G ' + F.pad + ' ' + y.toFixed(2) + ' m ' + (F.pad + width) + ' ' +
    y.toFixed(2) + ' l S Q\n';
  y -= 22;
  ops += pdfLine('Issue No.' + issue + ' - take one, leave one.', 'F1', 12, F.pad, y);
  y -= 26;

  var pic = photo && images[photo];
  if (pic) {
    var iw = width, ih = iw * (pic.h / pic.w);
    var room = y - (F.pad + F.strip) - 90;
    if (ih > room) { ih = room; iw = ih * (pic.w / pic.h); }
    if (ih > 40) {
      ops += 'q ' + iw.toFixed(2) + ' 0 0 ' + ih.toFixed(2) + ' ' + F.pad + ' ' +
        (y - ih).toFixed(2) + ' cm /Im' + pic.num + ' Do Q\n';
      y -= ih + 20;
    }
  }

  var qr = images['__qr'];
  var stripTop = F.pad + F.strip;
  if (qr) {
    ops += 'q 96 0 0 96 ' + F.pad + ' ' + (stripTop + 16).toFixed(2) + ' cm /Im' + qr.num + ' Do Q\n';
  }
  if (url) {
    var shown = url.replace(/^https?:\/\//, '');
    wrapMono(shown, 10, width - (qr ? 112 : 0)).slice(0, 3).forEach(function (line, i) {
      ops += pdfLine(line, 'F1', 10, F.pad + (qr ? 112 : 0), stripTop + 92 - i * 13);
    });
  }

  // The strip: one dashed rule across, then a comb of cuts, then the address
  // turned on its side in every tab.
  ops += 'q 1 w 0 G [4 3] 0 d ' + F.pad + ' ' + stripTop.toFixed(2) + ' m ' +
    (F.pad + width) + ' ' + stripTop.toFixed(2) + ' l S Q\n';
  var tabW = width / F.tabs;
  for (var i = 0; i <= F.tabs; i++) {
    var x = F.pad + i * tabW;
    ops += 'q 1 w 0 G [4 3] 0 d ' + x.toFixed(2) + ' ' + stripTop.toFixed(2) + ' m ' +
      x.toFixed(2) + ' ' + F.pad.toFixed(2) + ' l S Q\n';
  }
  var tab = (url || '').replace(/^https?:\/\//, '') || String(title || '');
  for (var t = 0; t < F.tabs; t++) {
    var tx = F.pad + t * tabW + tabW / 2 + 3;
    ops += 'BT /F1 7 Tf 0 1 -1 0 ' + tx.toFixed(2) + ' ' + (F.pad + 6).toFixed(2) +
      ' Tm (' + pdfEsc(tab.slice(0, 20)) + ') Tj ET\n';
  }
  return ops;
}

function buildFlyerPdf(title, issue, url, photoId) {
  var doc = pdfDoc();
  var images = {};
  var chain = Promise.resolve();
  if (photoId && photoCache[photoId]) {
    chain = chain.then(function () {
      return pdfAddImage(doc, photoCache[photoId]).then(function (r) { if (r) images[photoId] = r; });
    });
  }
  if (url) {
    chain = chain.then(function () {
      return pdfAddImage(doc, qrDataUrl(url, 4)).then(function (r) { if (r) images['__qr'] = r; });
    });
  }
  return chain.then(function () {
    var xo = Object.keys(images).map(function (k) {
      return '/Im' + images[k].num + ' ' + images[k].num + ' 0 R';
    }).join('');
    var courier = doc.obj(['<</Type/Font/Subtype/Type1/BaseFont/Courier/Encoding/WinAnsiEncoding>>']);
    var helv = doc.obj(['<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>']);
    var pagesNum = doc.obj(['']);
    var content = doc.stream('', pdfBytes(pdfFlyerContent(title, issue, url, photoId, images)));
    var pageNum = doc.obj(['<</Type/Page/Parent ' + pagesNum + ' 0 R/MediaBox[0 0 ' +
      FLYER.w + ' ' + FLYER.h + ']/Resources<</Font<</F1 ' + courier + ' 0 R/F2 ' + helv +
      ' 0 R>>' + (xo ? '/XObject<<' + xo + '>>' : '') + '>>/Contents ' + content + ' 0 R>>']);
    doc.replace(pagesNum, ['<</Type/Pages/Count 1/Kids[' + pageNum + ' 0 R]>>']);
    return doc.build(doc.obj(['<</Type/Catalog/Pages ' + pagesNum + ' 0 R>>']));
  });
}

function saveFlyer(title, issue, url, photoId, name) {
  toast('Writing the flyer…');
  return buildFlyerPdf(title, issue, url, photoId).then(function (blob) {
    var href = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 1000);
    toast('Flyer saved — print it, cut the tabs, staple it somewhere');
  }).catch(function (e) {
    toast('Could not write the flyer: ' + e.message);
  });
}
