// ---------- the pages, as made ----------
// What somebody handed the file sees first is the zine: the pages as they
// were pasted up, right way up, in reading order, cuttings and stamps where
// they were glued. The text view is the other way in, for a screen reader or
// a slow phone, and it is one click away. Shared with the printed sheet, so
// the file, the print and the press draw a page the same way.
var readMode = 'pages';

function pageSize(formatId) {
  var plan = impose(formatId, 'A');
  var paper = paperOf(formatId);
  var first = plan.sheets[0];
  return { pw: (paper.wpt / first.cols).toFixed(2), ph: (paper.hpt / first.rows).toFixed(2), pages: plan.format.pages };
}

// Cover alone, then facing pairs, then the back cover.
function spreadsOf(pages) {
  var spreads = [[1]];
  for (var p = 2; p < pages; p += 2) spreads.push([p, p + 1]);
  spreads.push([pages]);
  return spreads;
}

// Most home printers stop about a quarter inch short of the paper's edge.
// Where a page meets the edge of the sheet a faint line shows that limit, on
// screen only; which edges those are depends on the fold.
function outerEdges(plan) {
  var out = {};
  plan.sheets.forEach(function (sheet) {
    sheet.slots.forEach(function (slot, i) {
      var row = Math.floor(i / sheet.cols), col = i % sheet.cols;
      var e = { t: row === 0, b: row === sheet.rows - 1, l: col === 0, r: col === sheet.cols - 1 };
      out[slot.page] = slot.flip ? { t: e.b, b: e.t, l: e.r, r: e.l } : e;
    });
  });
  return out;
}

function reachHtml(e) {
  if (!e) return '';
  var at = function (on) { return on ? '18pt' : '0'; };
  return '<div class="reach" title="Most home printers cannot reach past this line" style="top:' + at(e.t) +
    ';right:' + at(e.r) + ';bottom:' + at(e.b) + ';left:' + at(e.l) + ';border-width:' +
    [e.t, e.r, e.b, e.l].map(function (on) { return on ? '1px' : '0'; }).join(' ') + '"></div>';
}

function addrHtml(url) {
  return url ? '<div class="addr"><img class="qr" src="' + esc(qrDataUrl(url, 3)) + '" alt=""><span>' +
    esc(url.replace(/^https?:\/\//, '')) + '</span></div>' : '';
}

// One page's face, everything on it that prints.
function panelFaceHtml(panels, page, pics, url, issue, aspect) {
  var p = panels[page - 1] || { h: '', body: '', photo: null };
  var pages = panels.length;
  return '<h3>' + esc(p.h || '') + '</h3>' +
    (page === 1 ? '<div class="no">№' + esc(issue || '') + '</div><div class="rule"></div>' : '') +
    (p.photo && pics[p.photo] ? '<img class="panel-photo" src="' + esc(pics[p.photo]) + '" alt=""' +
      (pngSize(pics[p.photo]) ? ' style="aspect-ratio:' + pngSize(pics[p.photo]).w + ' / ' + pngSize(pics[p.photo]).h + '"' : '') + '>' : '') +
    '<div class="body">' + esc(p.body || '') + '</div>' +
    pasteupHtml(p, pics, false, spreadGhosts(panels, page, aspect)) +
    (page === pages ? addrHtml(url) : '');
}

function readPagesHtml(issue, url, nameFn) {
  var size = pageSize(issue.format);
  var panels = issue.panels || [];
  var pages = panels.length || size.pages;
  var aspect = size.ph / size.pw;
  var who = nameFn || nameOf;
  return '<p class="read-meta">' + esc((panels[0] && panels[0].h) || 'STOOP ZINE') + ' · №' + esc(issue.no) +
    ' · ' + esc(fmtDay(issue.ts)) + ' · edited by ' + esc(who(issue.editor)) + '</p>' +
    '<div class="readrun"><div class="pages" data-gen="' + (issue.gen || 0) + '" style="--pw:' + size.pw +
    'pt;--ph:' + size.ph + 'pt">' + spreadsOf(pages).map(function (sp, i, all) {
      var kind = i === 0 ? ' cover' : (i === all.length - 1 ? ' backcover' : '');
      return '<div class="spread' + kind + '">' + sp.map(function (pg) {
        var cls = pg === 1 ? ' cover' : (pg === pages ? ' backcover' : '');
        return '<div class="panel' + cls + '" data-readpage="' + pg + '">' +
          panelFaceHtml(panels, pg, photoCache, url, issue.no, aspect) + '</div>';
      }).join('') + '</div>';
    }).join('') + '</div></div>';
}

function readHtml(issue, url, nameFn) {
  var mode = function (m, label) {
    return '<button class="btn quiet' + (readMode === m ? ' on' : '') + '" data-readmode="' + m + '">' + label + '</button>';
  };
  return '<div class="readtoggle">' + mode('pages', 'PAGES') + mode('text', 'TEXT') + '</div>' +
    (readMode === 'pages' ? readPagesHtml(issue, url, nameFn) : readingHtml(issue, null, nameFn));
}

// Scaled to the column, the way the press scales its pages, but only by
// width: a page is read by scrolling, not held to the window.
function fitReads() {
  var sx = window.scrollX, sy = window.scrollY;
  document.querySelectorAll('.readrun').forEach(function (box) {
    var run = box.querySelector('.pages');
    if (!run || !box.clientWidth) return;
    box.style.setProperty('--fit', 1);
    var w = run.getBoundingClientRect().width;
    if (w) box.style.setProperty('--fit', Math.max(0.3, Math.min(2, (box.clientWidth - 12) / w)));
  });
  if (window.scrollY !== sy || window.scrollX !== sx) window.scrollTo(sx, sy);
}
window.addEventListener('resize', fitReads);

document.addEventListener('click', function (ev) {
  var b = ev.target.closest && ev.target.closest('[data-readmode]');
  if (!b) return;
  readMode = b.getAttribute('data-readmode');
  if (document.body.classList.contains('landing')) renderLanding(); else renderReader();
});
