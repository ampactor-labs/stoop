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
    ps.panels = fitPanels(ps.panels, pages);
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
function panelHtml(page, pages) {
  var cover = page === 1 ? ' cover' : (page === pages ? ' backcover' : '');
  return '<div class="panel' + cover + '" data-page="' + page + '">' +
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

  if (ps.format !== pageSig) {
    var first = plan.sheets[0];
    var pw = (paper.wpt / first.cols).toFixed(2);
    var ph = (paper.hpt / first.rows).toFixed(2);
    var spreads = [[1]];
    for (var p = 2; p < pages; p += 2) spreads.push([p, p + 1]);
    spreads.push([pages]);
    zone.innerHTML = '<div class="pages" style="--pw:' + pw + 'pt;--ph:' + ph + 'pt">' +
      spreads.map(function (sp, i) {
        var kind = i === 0 ? ' cover' : (i === spreads.length - 1 ? ' backcover' : '');
        return '<div class="spread' + kind + '">' +
          sp.map(function (pg) { return panelHtml(pg, pages); }).join('') + '</div>';
      }).join('') + '</div>';
    pageSig = ps.format;
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

// A spread is two pages wide and the column it sits in may not be. Scale to
// fit rather than making somebody scroll sideways to see their own centre
// spread. zoom rather than transform, because zoom takes part in layout: a
// scaled run leaves no hole under itself, and the caret lands where aimed.
function fitPages(zone) {
  zone.style.setProperty('--fit', 1);
  var run = zone.querySelector('.pages');
  if (!run) return;
  var natural = run.getBoundingClientRect().width;
  if (!natural) return;
  var room = zone.clientWidth - 2;
  zone.style.setProperty('--fit', Math.min(1, room / natural));
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
      if (img.getAttribute('src') !== photoCache[panel.photo]) img.src = photoCache[panel.photo];
      if (!drop) {
        drop = document.createElement('button');
        drop.className = 'panel-unpic';
        drop.textContent = '✕';
        drop.title = 'Remove this photo';
        drop.setAttribute('data-delpanelpic', String(i + 1));
        el.appendChild(drop);
      }
    } else {
      if (img) img.remove();
      if (drop) drop.remove();
    }

    paintPasteup(el, panel);
  });

  var num = document.getElementById('issueno');
  if (num && num !== active && num.innerText !== ps.issue) num.innerText = ps.issue;
  paintAddress(zone, ps.panels.length, issueUrl(ps.issue));
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

// Ringing the bell archives the issue and starts the next one, so the sheet on
// screen is never the issue that just went to the shelf. Say so, because the
// obvious order — write it, publish it, print it — otherwise hands somebody
// fifty blank copies.
function sheetIsBlank() {
  return pressState().panels.every(function (p) {
    return !String(p.body || '').trim() && !p.photo;
  });
}

// Speaks only once there is a published issue to be confused with. A blank
// press on first open is not a warning, it is a blank press.
function pressStatus() {
  var el = document.getElementById('pressstatus');
  if (!el) return;
  var last = lastPublished();
  var blank = sheetIsBlank();
  if (!last) { el.textContent = ''; el.classList.remove('bad'); return; }
  el.textContent = (blank ? 'This sheet is empty. ' : '') +
    'You are looking at the draft for issue \u2116' + pressState().issue + '.' +
    ' Issue \u2116' + last.no + ' is published \u2014 print that one from the shelf.';
  el.classList.toggle('bad', blank);
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
  if (!FORMATS[id]) return;
  ps.format = id;
  ps.panels = fitPanels(ps.panels, formatOf(id).pages);
  savePress();
  renderPress();
  toast(formatOf(id).label + ' — print a test sheet before committing paper');
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
  printSheet(ps.panels, ps.format, ps.hand, issueUrl(ps.issue), false, null, genOf(ps));
}

function printTestSheet() {
  var ps = pressState();
  printSheet(ps.panels, ps.format, ps.hand, null, true,
    'Fold the test sheet and read the numbers in order. Shuffled? SWAP FOLD and test again.');
}

function clearSheet() {
  var ps = pressState();
  pasteMark();
  ps.panels.forEach(function (p) { p.body = ''; p.photo = null; p.els = []; });
  savePress();
  renderPress();
  toast('Cleared the pages');
}
