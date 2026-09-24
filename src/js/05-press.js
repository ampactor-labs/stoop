// ---------- the press ----------
// The press shows pages: right way up, in reading order, paired as facing
// spreads. Nobody making a zine thinks in printer slots, and half of those
// are upside down. The imposition is a property of paper and is applied on
// the way to it, in the PDF and in the printed sheet, never on the surface
// being edited. The DOM is rebuilt only when the format changes, and text is
// painted in place, because re-rendering under the caret fights the cursor.
var pageSig = '';

function pressState() {
  if (!state.press) {
    state.press = { format: 'fold8', hand: 'A', issue: '01', title: 'STOOP ZINE', panels: [] };
  }
  var ps = state.press;
  if (!ps.format || !FORMATS[ps.format]) ps.format = 'fold8';
  if (ps.hand !== 'B') ps.hand = 'A';
  if (!ps.issue) ps.issue = '01';
  var pages = formatOf(ps.format).pages;
  if (!Array.isArray(ps.panels) || ps.panels.length !== pages) {
    var fit = fitPanels(ps.panels, pages, ps.spare);
    ps.panels = fit.panels;
    ps.spare = fit.spare;
  }
  return ps;
}

function savePress() {
  pressState().ts = Date.now();
  saveState();
}

function setPanel(page, body) {
  var ps = pressState();
  if (ps.panels[page - 1]) ps.panels[page - 1].body = body;
}

// ---------- drawing the sheet ----------
function panelHtml(page, pages, edges) {
  var cover = page === 1 ? ' cover' : (page === pages ? ' backcover' : '');
  return '<div class="panel' + cover + '" data-page="' + page + '">' + reachHtml(edges) +
    '<div class="pgtag">p. ' + page + '</div>' +
    '<h3 contenteditable="true"></h3>' +
    (page === 1 ? '<div class="no">№<span id="issueno" contenteditable="true">01</span></div><div class="rule"></div>' : '') +
    '<div class="body" contenteditable="true"></div>' +
    '<div class="fitwarn"></div>' +
    '</div>';
}

// Pages in reading order: the cover on its own, then facing pairs, then the
// back cover. A panel is the size it will print at, in points, so the fit
// meter measures real paper; the whole run is zoomed to the column.
function layoutPages() {
  var ps = pressState();
  var plan = impose(ps.format, ps.hand);
  var paper = paperOf(ps.format);
  var pages = plan.format.pages;
  var zone = document.getElementById('sheetzone');
  if (!zone) return plan;

  if (ps.format + ps.hand !== pageSig) {
    var size = pageSize(ps.format);
    var spreads = spreadsOf(pages);
    var edges = outerEdges(plan);
    zone.innerHTML = '<div class="pages" style="--pw:' + size.pw + 'pt;--ph:' + size.ph + 'pt">' +
      spreads.map(function (sp, i) {
        var kind = i === 0 ? ' cover' : (i === spreads.length - 1 ? ' backcover' : '');
        return '<div class="spread' + kind + '">' +
          sp.map(function (pg) { return panelHtml(pg, pages, edges[pg]); }).join('') + '</div>';
      }).join('') + '</div>';
    pageSig = ps.format + ps.hand;
  }

  fitPages(zone);
  var style = document.getElementById('pagerule');
  if (style) style.textContent = '@page { size: ' + paper.css + '; margin: 0; }';
  var sel = document.getElementById('formatsel');
  if (sel && sel.value !== ps.format) sel.value = ps.format;
  var btn = document.getElementById('swaplayoutbtn');
  if (btn) {
    btn.textContent = 'SWAP FOLD (' + ps.hand + ')';
    btn.disabled = !plan.format.folds;
  }
  return plan;
}

// A page is 2.75 inches wide, which at 96dpi is 264 pixels: a postage stamp
// on any real screen, with 8-point body type. So the run is scaled to fill
// the column rather than only ever shrinking to fit it, bounded by the height
// so a page never grows taller than the window it is being read in. zoom
// rather than transform, because zoom takes part in layout: a scaled run
// leaves no hole under itself, and the caret lands where it is aimed.
// Measuring at scale one shrinks the page for a moment, and the browser
// pulls the scroll back to fit the shorter page; without putting it back,
// every repaint threw somebody working on page six up to page three.
function fitPages(zone) {
  var sx = window.scrollX, sy = window.scrollY;
  zone.style.setProperty('--fit', 1);
  var run = zone.querySelector('.pages');
  var box = run && run.getBoundingClientRect();
  var panel = run && run.querySelector('.panel');
  if (box && box.width && panel) {
    var byWidth = (zone.clientWidth - 2) / box.width;
    var byHeight = (window.innerHeight * 0.82) / panel.getBoundingClientRect().height;
    zone.style.setProperty('--fit', Math.max(0.2, Math.min(byWidth, byHeight)));
  }
  if (window.scrollY !== sy || window.scrollX !== sx) window.scrollTo(sx, sy);
}

var fitTimer = null;
window.addEventListener('resize', function () {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(function () {
    var zone = document.getElementById('sheetzone');
    if (zone && zone.querySelector('.pages')) { fitPages(zone); checkFit(); }
  }, 150);
});

// Paint text without touching a node the caret is inside.
function paintPanels() {
  var ps = pressState();
  var zone = document.getElementById('sheetzone');
  if (!zone) return;
  var active = document.activeElement;

  ps.panels.forEach(function (panel, i) {
    var el = zone.querySelector('[data-page="' + (i + 1) + '"]');
    if (!el) return;
    paintFace(el, panel, i + 1, active);
    paintPasteup(el, panel);
  });

  var num = document.getElementById('issueno');
  if (num && num !== active && num.innerText !== ps.issue) num.innerText = ps.issue;
  paintAddress(zone, ps.panels.length, issueUrl(ps.issue));
}

// A page's heading, words and photograph, painted without touching whatever
// the caret is in. The photograph takes its room from its header at once.
function paintFace(el, panel, page, active) {
  var head = el.querySelector('h3');
  var body = el.querySelector('.body');
  if (head && head !== active && head.innerText !== panel.h) head.innerText = panel.h;
  if (body && body !== active && body.innerText !== panel.body) body.innerText = panel.body;

  var img = el.querySelector('.panel-photo');
  var drop = el.querySelector('.panel-unpic');
  if (panel.photo && photoCache[panel.photo]) {
    if (!img) {
      img = document.createElement('img');
      img.className = 'panel-photo';
      el.insertBefore(img, body);
    }
    if (img.getAttribute('src') !== photoCache[panel.photo]) {
      var size = pngSize(photoCache[panel.photo]);
      img.style.aspectRatio = size ? size.w + ' / ' + size.h : '';
      img.src = photoCache[panel.photo];
    }
    if (!drop) {
      drop = document.createElement('button');
      drop.className = 'panel-unpic';
      drop.textContent = '✕';
      drop.title = 'Remove this photo';
      drop.setAttribute('data-delpanelpic', String(page));
      el.appendChild(drop);
    }
  } else {
    if (img) img.remove();
    if (drop) drop.remove();
  }
}

// The back cover carries the address as text and as a code, so somebody who
// finds the paper can reach the archive. The two substrates point at each
// other or the loop is open.
function paintAddress(zone, lastPage, url) {
  var last = zone.querySelector('[data-page="' + lastPage + '"]');
  if (!last) return;
  var tag = last.querySelector('.addr');
  if (!url) { if (tag) tag.remove(); return; }
  if (!tag) {
    tag = document.createElement('div');
    tag.className = 'addr';
    last.appendChild(tag);
  }
  if (tag.getAttribute('data-url') === url) return;
  tag.setAttribute('data-url', url);
  tag.innerHTML = '<img class="qr" src="' + esc(qrDataUrl(url, 3)) + '" alt="">' +
    '<span>' + esc(url.replace(/^https?:\/\//, '')) + '</span>';
}

function renderPress() {
  layoutPages();
  paintPanels();
  checkFit();
  pressStatus();
  renderTray();
  renderInspector();
  renderGen();
}

// ---------- editing ----------
// Reads the sheet back into the model. Only while the press is on screen:
// innerText on an element nobody can see falls back to textContent, where a
// line break is a <br> that contributes nothing, and a back cover captured
// from the desk came out with every newline deleted and was archived that
// way. Nothing can have been typed into a hidden sheet, so there is nothing
// to capture from one.
function capturePanels() {
  var ps = pressState();
  var zone = document.getElementById('sheetzone');
  if (!zone || !zone.offsetParent) return;
  ps.panels.forEach(function (panel, i) {
    var el = zone.querySelector('[data-page="' + (i + 1) + '"]');
    if (!el) return;
    var head = el.querySelector('h3');
    var body = el.querySelector('.body');
    if (head) panel.h = head.innerText.trim();
    if (body) panel.body = body.innerText.replace(/\n{3,}/g, '\n\n').trimEnd();
  });
  var num = document.getElementById('issueno');
  if (num) ps.issue = num.innerText.trim().replace(/^№/, '') || '01';
  ps.title = ps.panels[0] ? ps.panels[0].h : ps.title;
  savePress();
  checkFit();
}

function setFormat(id) {
  var ps = pressState();
  if (!FORMATS[id] || id === ps.format) return;
  pasteMark();
  ps.format = id;
  var fit = fitPanels(ps.panels, formatOf(id).pages, ps.spare);
  ps.panels = fit.panels;
  ps.spare = fit.spare;
  savePress();
  renderPress();
  var aside = fit.spare.filter(panelHasWork).length;
  toast(aside
    ? formatOf(id).label + ' \u2014 ' + aside + ' page(s) set aside until there is room'
    : formatOf(id).label + ' \u2014 print a test sheet before committing paper');
}

function swapLayout() {
  var ps = pressState();
  if (!formatOf(ps.format).folds) { toast('Saddle-stitch has one imposition; there is no hand to swap'); return; }
  ps.hand = ps.hand === 'A' ? 'B' : 'A';
  savePress();
  renderPress();
  toast('Fold layout ' + ps.hand + ' — print a test sheet before committing');
}

// Paper is where the imposition lives. Both of these render the imposed
// sheet into the print zone and hand it to the browser. The pages on screen
// are never what prints.
function printDraft() {
  capturePanels();
  if (!confirmSheet('Print')) return;
  var ps = pressState();
  printSheet(ps.panels, ps.format, ps.hand, issueUrl(ps.issue), false, null, genOf(ps), ps.issue);
}

function printTestSheet() {
  var ps = pressState();
  printSheet(ps.panels, ps.format, ps.hand, null, true,
    'Fold the test sheet and read the numbers in order. Shuffled? SWAP FOLD and test again.', 0, ps.issue);
}

function clearSheet() {
  var ps = pressState();
  pasteMark();
  ps.panels.forEach(function (p) { p.body = ''; p.photo = null; p.els = []; });
  savePress();
  renderPress();
  toast('Cleared the pages');
}
