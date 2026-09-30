// ---------- riso plates ----------
// A riso prints one drum at a time, and what a studio asks for is one
// greyscale PDF per ink: the pages in reading order, bleed, no marks, black
// where that ink goes. The inks a cutting can be printed in are already the
// drums, so a plate is the shop's page drawn with a filter: everything in
// the plate's ink in black, everything else left out. The page's own type,
// its address and a colour photograph, as greyscale, go on the black drum.
// A page colour is paper, not ink, so it goes in the note as stock. The
// preview overprints every plate in its ink, the way the studios' guides
// tell people to proof in Photoshop.
//
// plateInk and plateTint live in 05i-ink.js beside pdfInk, which reads them.

function inkName(hex) {
  var known = INKS.filter(function (i) { return i[1] === hex; })[0];
  return known ? known[0].toLowerCase() : 'ink-' + hex.slice(1);
}

function stockName(hex) {
  var known = FILLS.filter(function (f) { return f[1] === hex; })[0];
  return known ? known[0].toLowerCase() : hex;
}

// A cutting's drum: a colour photograph is the black drum's; paper showing
// through, which is what white is, is on every drum.
function plateOfEl(el) {
  var hex = inkOf(el);
  if (el.kind === 'photo' && !twoTonePhoto(photoCache[el.photo])) return '';
  return hex === '#ffffff' ? null : hex;
}

function onPlate(el) {
  var p = plateOfEl(el);
  return p === null || p === plateInk;
}

// Which drums an issue needs: black always, then every ink a cutting prints in.
function platesOf(panels) {
  var inks = [''];
  panels.forEach(function (p) {
    elsOf(p).forEach(function (e) {
      var hex = plateOfEl(e);
      if (hex && inks.indexOf(hex) < 0) inks.push(hex);
    });
  });
  return inks;
}

function platePages(panels, hex) {
  var out = [];
  panels.forEach(function (p, i) {
    if (elsOf(p).some(function (e) { return plateOfEl(e) === hex; })) out.push(i + 1);
  });
  return out;
}

// The page with its bleed and nothing else around it.
function plateBox(pw, ph) {
  var top = BLEED + ph;
  return {
    left: BLEED, top: top, w: pw, h: ph, bleed: BLEED,
    cx: BLEED + pw / 2, cy: top - ph / 2,
    x: BLEED + PAD_X, y: top - PAD_Y, cw: pw - PAD_X * 2, ch: ph - PAD_Y * 2
  };
}

// One page of one plate. The filter is on only while this draws.
function plateOps(panels, i, box, images, url, issue, gen, hex, tint) {
  plateInk = hex;
  plateTint = !!tint;
  var page = i + 1;
  var panel = panels[i] || { h: '', body: '', photo: null };
  if (page === 1) {
    var cover = { issue: issue };
    Object.keys(panel).forEach(function (k) { if (k !== 'issue') cover[k] = panel[k]; });
    panel = cover;
  }
  var ops = 'q 0 0 ' + (box.w + 2 * BLEED).toFixed(2) + ' ' + (box.h + 2 * BLEED).toFixed(2) + ' re W n\n' +
    pdfPanel(panel, page, panels.length, box, images, url, spreadGhosts(panels, page, box.h / box.w)) + 'Q\n';
  if (hex === '') ops += '0 g ' + pdfSpeckle(gen, box, 'p' + page);
  plateInk = null;
  plateTint = false;
  return ops;
}

function platesNote(panels, inks, issue) {
  var lines = [(state.zine || 'STOOP ZINE') + ' №' + issue + ' — riso plates', '',
    'One greyscale PDF per drum, a page per zine page in reading order, at the trimmed size',
    'with an eighth of an inch of bleed and no crop marks. Black is where the ink goes.', ''];
  inks.forEach(function (hex) {
    var name = inkName(hex) + '.pdf';
    lines.push('  ' + name + new Array(Math.max(2, 16 - name.length)).join(' ') + (hex
      ? 'the ' + inkName(hex) + ' drum: pages ' + platePages(panels, hex).join(', ')
      : 'the black drum: the pages\' own type and address, every cutting in black,\n' +
        '                and colour photographs as greyscale'));
  });
  lines.push('  preview.pdf    every plate overprinted in its ink, on the stock', '');
  var stock = [];
  panels.forEach(function (p, i) { if (fillOf(p)) stock.push('  page ' + (i + 1) + ': print on ' + stockName(fillOf(p)) + ' stock'); });
  lines.push(stock.length ? 'Stock:' : 'Stock: white throughout.');
  return lines.concat(stock).join('\n') + '\n';
}

// Every plate, then the preview, zipped with the note.
function writePlates(panels, formatId, url, issue, gen) {
  var size = pageSize(formatId);
  var pw = Number(size.pw), ph = Number(size.ph);
  var mw = pw + 2 * BLEED, mh = ph + 2 * BLEED;
  var box = plateBox(pw, ph);
  var r = function (x0, y0, x1, y1) { return '[' + [x0, y0, x1, y1].map(function (v) { return v.toFixed(2); }).join(' ') + ']'; };
  var boxes = '/MediaBox' + r(0, 0, mw, mh) + '/BleedBox' + r(0, 0, mw, mh) + '/TrimBox' + r(BLEED, BLEED, mw - BLEED, mh - BLEED);
  var inks = platesOf(panels);
  var files = [{ name: 'plates.txt', data: new TextEncoder().encode(platesNote(panels, inks, issue)) }];
  var chain = Promise.resolve();
  inks.forEach(function (hex) {
    chain = chain.then(function () {
      var doc = pdfDoc();
      return pdfPrepare(doc, panels, url, gen, true).then(function (got) {
        return pdfFinish(doc, panels.map(function (p, i) {
          return { ops: plateOps(panels, i, box, got.images, url, issue, gen, hex, false), boxes: boxes };
        }), got.resources).arrayBuffer();
      }).then(function (buf) { files.push({ name: inkName(hex) + '.pdf', data: new Uint8Array(buf) }); });
    });
  });
  // The preview: each plate drawn in its ink inside a transparency group of
  // its own, so paper showing through a plate stays paper, and the group
  // multiplied onto the page, so two inks overprinting darken as they do.
  chain = chain.then(function () {
    var doc = pdfDoc();
    return pdfPrepare(doc, panels, url, gen, true).then(function (got) {
      var forms = [];
      var pages = panels.map(function (p, i) {
        var ops = pdfFill(p, box);
        inks.forEach(function (hex) {
          var num = doc.stream('/Type/XObject/Subtype/Form/BBox' + r(0, 0, mw, mh) +
            '/Group<</S/Transparency/CS/DeviceRGB/I true>>/Resources<<' + got.resources + '>>',
            pdfBytes(plateOps(panels, i, box, got.images, url, issue, gen, hex, true)));
          forms.push('/P' + num + ' ' + num + ' 0 R');
          ops += 'q /GS1 gs /P' + num + ' Do Q\n';
        });
        return { ops: ops, boxes: boxes };
      });
      var res = got.resources.indexOf('/XObject<<') >= 0
        ? got.resources.replace('/XObject<<', '/XObject<<' + forms.join(''))
        : got.resources + '/XObject<<' + forms.join('') + '>>';
      return pdfFinish(doc, pages, res + '/ExtGState<</GS1<</BM/Multiply>>>>').arrayBuffer();
    }).then(function (buf) { files.push({ name: 'preview.pdf', data: new Uint8Array(buf) }); });
  });
  return chain.then(function () { return zipFiles(files); });
}

function saveRisoPlates(panels, formatId, url, issue, gen) {
  toast('Separating the plates…');
  copierFlash();
  return loadFaces().then(function () { return writePlates(panels, formatId, url, issue, gen); }).then(function (blob) {
    downloadBlob(sceneSlug() + '-' + issue + '-riso.zip', blob);
    var n = platesOf(panels).length;
    toast(n + ' plate' + (n === 1 ? '' : 's') + ', a preview and a note on the stock. Hand the zip to the studio.');
  }).catch(function (e) { toast('Could not write the plates: ' + e.message); });
}

document.addEventListener('click', function (ev) {
  var t = ev.target.closest && ev.target.closest('#risobtn,[data-risoissue]');
  if (!t) return;
  if (t.id === 'risobtn') {
    capturePanels();
    if (!confirmSheet('Write riso plates')) return;
    var ps = pressState();
    saveRisoPlates(ps.panels, ps.format, issueUrl(ps.issue), ps.issue, genOf(ps));
    return;
  }
  var iss = issueByNo(t.getAttribute('data-risoissue'));
  if (iss) saveRisoPlates(iss.panels || [], iss.format, issueUrl(iss.no), iss.no, iss.gen);
});
