// ---------- the shelf ----------
// An issue is archived whole — its panels, its format, its fold hand — so a
// back issue reprints as it shipped rather than as the current draft is set.

// The imposed sheet, with nothing editable about it. This is the only place
// the imposition is drawn as HTML: the press on screen shows pages, and this
// is what goes to the printer, whether for the draft, a numbered test sheet,
// or a back issue off the shelf. Test numbers are always in the markup and
// shown only when the print zone carries the testing class.
function staticSheetHtml(panels, formatId, hand, photos, url, gen) {
  var plan = impose(formatId, hand);
  var paper = paperOf(formatId);
  var pages = plan.format.pages;
  var pics = photos || photoCache;
  var addr = url ? '<div class="addr"><img class="qr" src="' + esc(qrDataUrl(url, 3)) +
    '" alt=""><span>' + esc(url.replace(/^https?:\/\//, '')) + '</span></div>' : '';
  return plan.sheets.map(function (sheet, i) {
    return '<div class="sheetwrap"><div class="sheetlabel">' + esc(sheet.side) + '</div>' +
      '<div class="sheet" data-sheet="' + i + '" data-gen="' + (gen || 0) + '" style="width:' + paper.w + ';height:' + paper.h +
      ';--cols:' + sheet.cols + ';--rows:' + sheet.rows + '">' +
      sheet.slots.map(function (slot) {
        var p = panels[slot.page - 1] || { h: '', body: '', photo: null };
        var cover = slot.page === 1 ? ' cover' : (slot.page === pages ? ' backcover' : '');
        return '<div class="panel' + cover + (slot.flip ? ' flip' : '') + '" data-page="' + slot.page + '">' +
          '<h3>' + esc(p.h || '') + '</h3>' +
          (p.photo && pics[p.photo] ? '<img class="panel-photo" src="' + esc(pics[p.photo]) + '" alt="">' : '') +
          '<div class="body">' + esc(p.body || '') + '</div>' +
          pasteupHtml(p, pics, false) +
          (slot.page === pages ? addr : '') +
          '<div class="testnum"><b>' + slot.page + '</b><small>' + esc(pageLabel(slot.page, pages)) + '</small></div>' +
          '</div>';
      }).join('') + '</div></div>';
  }).join('');
}

// The other substrate. Same source, no imposition and no paste-up: a collage
// is a property of a page at a fixed size, and this view has neither. What was
// written still reads; where it was glued does not survive, by design. This is
// the issue you open on a phone at the bus stop, and nothing in it needs a
// network to mean something.
function readingHtml(issue, photos) {
  var pics = photos || photoCache;
  var panels = issue.panels || [];
  var cover = panels[0] || { h: 'STOOP ZINE' };
  var out = '<article class="reading">' +
    '<header class="reading-head"><h1>' + esc(cover.h || 'STOOP ZINE') + '</h1>' +
    '<p class="reading-meta">№' + esc(issue.no) + ' · ' + esc(fmtDay(issue.ts)) +
    ' · edited by ' + esc(nameOf(issue.editor)) + '</p>' +
    (cover.photo && pics[cover.photo] ? '<img src="' + esc(pics[cover.photo]) + '" alt="">' : '') +
    '</header>';
  if (issue.note) out += '<section class="reading-note"><h2>Editor\'s note</h2><p>' + esc(issue.note) + '</p></section>';
  panels.slice(1, -1).forEach(function (p, i) {
    if (!p || (!p.body && !p.photo)) return;
    out += '<section class="reading-piece"><h2>' + esc(p.h || ('Page ' + (i + 2))) + '</h2>' +
      (p.photo && pics[p.photo] ? '<img src="' + esc(pics[p.photo]) + '" alt="">' : '') +
      '<p>' + esc(p.body || '') + '</p></section>';
  });
  var back = panels[panels.length - 1];
  if (back && back.body) out += '<footer class="reading-foot"><p>' + esc(back.body) + '</p></footer>';
  return out + '</article>';
}

// What the press is about to commit, judged against what is already on the
// shelf. The draft on screen is never the issue that just went up, so anything
// that spends paper, ink or a file asks first.
function lastPublished() {
  return state.issues.length ? state.issues[state.issues.length - 1] : null;
}

function confirmSheet(what) {
  if (!sheetIsBlank()) return true;
  var last = lastPublished();
  return confirm('This sheet is empty — it is the draft for issue \u2116' + pressState().issue + '.' +
    (last ? '\n\nIssue \u2116' + last.no + ' is published. Print that from the shelf instead.' : '') +
    '\n\n' + what + ' anyway?');
}


// ---------- the view ----------
var openIssueNo = null;

function issueByNo(no) {
  return state.issues.find(function (i) { return i.no === no; });
}

function renderShelf() {
  var list = document.getElementById('shelflist');
  if (!list) return;
  var issues = state.issues.slice().sort(function (x, y) {
    return (parseInt(y.no, 10) || 0) - (parseInt(x.no, 10) || 0);
  });

  if (!issues.length) {
    list.innerHTML = '<p class="sub">Nothing published yet. Assemble an issue at the desk and ring the bell; ' +
      'it lands here and stays exactly as it shipped.</p>';
  } else {
    list.innerHTML = issues.map(function (iss) {
      return '<div class="shelf-row">' +
        '<span class="shelf-no">№' + esc(iss.no) + '</span>' +
        '<span class="shelf-meta"><b>' + esc(iss.title) + '</b>' +
        '<small>' + esc(fmtDay(iss.ts)) + ' · edited by ' + esc(nameOf(iss.editor)) +
        ' · ' + esc(formatOf(iss.format).label) + ' · ' + (iss.pieces || []).length + ' pieces</small></span>' +
        '<button class="btn quiet" data-readissue="' + esc(iss.no) + '">READ</button>' +
        '<button class="btn quiet" data-reprintissue="' + esc(iss.no) + '">REPRINT</button>' +
        '<button class="btn quiet" data-pdfissue="' + esc(iss.no) + '">PDF</button>' +
        '<button class="btn quiet" data-exportissue="' + esc(iss.no) + '">EXPORT</button>' +
        '</div>';
    }).join('');
  }

  var count = document.getElementById('shelfcount');
  if (count) {
    count.textContent = issues.length === 0 ? 'no issues yet'
      : issues.length + ' issue' + (issues.length === 1 ? '' : 's') + ' on the shelf';
  }
  if (openIssueNo && !issueByNo(openIssueNo)) openIssueNo = null;
  renderReader();
}

function renderReader() {
  var box = document.getElementById('shelfreader');
  if (!box) return;
  if (!openIssueNo) { box.innerHTML = ''; box.classList.remove('on'); return; }
  var iss = issueByNo(openIssueNo);
  if (!iss) return;
  box.classList.add('on');
  box.innerHTML = '<div class="reader-bar"><span>Reading №' + esc(iss.no) + '</span>' +
    '<button class="btn quiet" id="closereader">CLOSE</button></div>' + readingHtml(iss);
}

function readIssue(no) {
  openIssueNo = openIssueNo === no ? null : no;
  renderReader();
  var box = document.getElementById('shelfreader');
  if (box && openIssueNo) box.scrollIntoView({ block: 'start' });
}

// One print path. Whatever is going to paper — the draft, a numbered test
// sheet, a back issue — is imposed into the print zone and handed to the
// browser, and the zone is emptied again when the dialog closes. Opening a
// back issue this way never costs the draft, because the draft is not what
// is being printed.
function printSheet(panels, format, hand, url, testing, note, gen) {
  var zone = document.getElementById('reprintzone');
  if (!zone) return;
  zone.innerHTML = staticSheetHtml(panels, format, hand, null, url, gen);
  zone.classList.toggle('testing', !!testing);
  var style = document.getElementById('pagerule');
  if (style) style.textContent = '@page { size: ' + paperOf(format).css + '; margin: 0; }';
  document.body.classList.add('reprinting');
  if (note) toast(note);
  window.print();
  setTimeout(endPrinting, 800);
}

function reprintIssue(no) {
  var iss = issueByNo(no);
  if (!iss) return;
  printSheet(iss.panels, iss.format, iss.hand, issueUrl(iss.no), false,
    'Reprinting \u2116' + iss.no + ' \u2014 your draft is untouched', iss.gen);
}

// The keyboard shortcut prints the sheet too. Somebody who presses print on
// the pages view gets the imposed sheet, not a grid of upright pages.
// Ctrl-P from anywhere prints the sheet. Printing is about paper and paper
// is the imposed sheet, wherever somebody happened to be standing when the
// thought struck them; the alternative, which this used to do, was to hand
// the browser a blank page unless they were on the press.
window.addEventListener('beforeprint', function () {
  if (document.body.classList.contains('reprinting')) return;
  var ps = pressState();
  var zone = document.getElementById('reprintzone');
  if (!zone) return;
  capturePanels();
  zone.innerHTML = staticSheetHtml(ps.panels, ps.format, ps.hand, null, issueUrl(ps.issue), genOf(ps), ps.issue);
  document.body.classList.add('reprinting');
});

// Not every browser fires afterprint, and a cancelled dialog may not either.
// A print zone left populated keeps body.reprinting set, and the guard above
// would then print that stale sheet for ever, so clearing it is on a timer as
// well as on the event.
function endPrinting() {
  document.body.classList.remove('reprinting');
  var zone = document.getElementById('reprintzone');
  if (zone) { zone.innerHTML = ''; zone.classList.remove('testing'); }
  var style = document.getElementById('pagerule');
  if (style) style.textContent = '@page { size: ' + paperOf(pressState().format).css + '; margin: 0; }';
}
window.addEventListener('afterprint', endPrinting);
