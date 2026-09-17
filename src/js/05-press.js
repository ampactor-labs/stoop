// ---------- the press ----------
// The sheet is drawn from the imposition, never hardcoded: change the format
// and the same panels re-flow onto different paper. The DOM is rebuilt only
// when the layout changes, and text is painted in place, because re-rendering
// under the caret fights the cursor on every keystroke.
var armedPhoto = null;
var sheetSig = '';

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
function panelHtml(slot, pages) {
  var page = slot.page;
  var cover = page === 1 ? ' cover' : (page === pages ? ' backcover' : '');
  return '<div class="panel' + cover + (slot.flip ? ' flip' : '') + '" data-page="' + page + '">' +
    '<div class="pgtag">p. ' + page + '</div>' +
    '<h3 contenteditable="true"></h3>' +
    (page === 1 ? '<div class="no">№<span id="issueno" contenteditable="true">01</span></div><div class="rule"></div>' : '') +
    '<div class="body" contenteditable="true"></div>' +
    '<div class="fitwarn"></div>' +
    '<div class="testnum"><b>' + page + '</b><small>' + esc(pageLabel(page, pages)) + '</small></div>' +
    '</div>';
}

function layoutSheets() {
  var ps = pressState();
  var plan = impose(ps.format, ps.hand);
  var paper = paperOf(ps.format);
  var pages = plan.format.pages;
  var sig = ps.format + '/' + ps.hand;
  var zone = document.getElementById('sheetzone');
  if (!zone) return plan;

  if (sig !== sheetSig) {
    zone.innerHTML = plan.sheets.map(function (sheet, i) {
      return '<div class="sheetwrap"><div class="sheetlabel">' + esc(sheet.side) + '</div>' +
        '<div class="sheet" data-sheet="' + i + '" style="width:' + paper.w + ';height:' + paper.h +
        ';--cols:' + sheet.cols + ';--rows:' + sheet.rows + '">' +
        sheet.slots.map(function (s) { return panelHtml(s, pages); }).join('') +
        '</div></div>';
    }).join('');
    sheetSig = sig;
  }

  fitSheets(zone);
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

// A sheet is eleven inches wide and the column it sits in is not. Scale it to
// fit rather than making somebody scroll sideways to see their own back cover.
// zoom rather than transform, because zoom takes part in layout: a scaled
// sheet leaves no hole under itself, and the caret lands where it is aimed.
// Print resets it — paper is already the right size.
function fitSheets(zone) {
  zone.style.setProperty('--fit', 1);
  var sheet = zone.querySelector('.sheet');
  if (!sheet) return;
  var natural = sheet.getBoundingClientRect().width;
  if (!natural) return;
  var room = zone.clientWidth - 2;
  zone.style.setProperty('--fit', Math.min(1, room / natural));
}

var fitTimer = null;
window.addEventListener('resize', function () {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(function () {
    var zone = document.getElementById('sheetzone');
    if (zone && zone.querySelector('.sheet')) { fitSheets(zone); checkFit(); }
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
  layoutSheets();
  paintPanels();
  checkFit();
  pressStatus();
  renderTray();
  renderInspector();
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

function pressStatus() {
  var el = document.getElementById('pressstatus');
  if (!el) return;
  var last = lastPublished();
  var blank = sheetIsBlank();
  el.textContent = (blank ? 'This sheet is empty. ' : '') +
    'You are looking at the draft for issue \u2116' + pressState().issue + '.' +
    (last ? ' Issue \u2116' + last.no + ' is published — print that one from the shelf.' : '');
  el.classList.toggle('bad', blank);
}

// ---------- the fit meter ----------
// The panel clips what does not fit, because a printer will too — but it must
// not do so silently. Binary search the word list for the last line that fits:
// about nine reflows per over-full panel, on demand rather than per keystroke.
function measureOverflow(body) {
  if (body.scrollHeight <= body.clientHeight + 1) return 0;
  var original = body.innerText;
  var words = original.split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  var lo = 0, hi = words.length;
  while (lo < hi) {
    var mid = Math.ceil((lo + hi) / 2);
    body.innerText = words.slice(0, mid).join(' ');
    if (body.scrollHeight <= body.clientHeight + 1) lo = mid; else hi = mid - 1;
  }
  body.innerText = original;
  return words.length - lo;
}

function checkFit() {
  var zone = document.getElementById('sheetzone');
  if (!zone) return 0;
  var active = document.activeElement;
  var total = 0;
  zone.querySelectorAll('.panel').forEach(function (el) {
    var body = el.querySelector('.body');
    var warn = el.querySelector('.fitwarn');
    if (!body || !warn) return;
    if (el.contains(active)) return;
    var over = measureOverflow(body);
    total += over;
    el.classList.toggle('over', over > 0);
    warn.textContent = over > 0 ? over + ' word' + (over === 1 ? '' : 's') + ' over' : '';
  });
  var meter = document.getElementById('fitmeter');
  if (meter) {
    meter.textContent = total > 0
      ? total + ' word' + (total === 1 ? '' : 's') + ' will not print. Cut, or move them to another page.'
      : 'Everything fits on the paper.';
    meter.classList.toggle('bad', total > 0);
  }
  return total;
}

// ---------- editing ----------
function capturePanels() {
  var ps = pressState();
  var zone = document.getElementById('sheetzone');
  if (!zone) return;
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

function toggleTestSheet() {
  var zone = document.getElementById('sheetzone');
  var btn = document.getElementById('testsheetbtn');
  if (!zone) return;
  var on = !zone.classList.contains('testing');
  zone.classList.toggle('testing', on);
  if (btn) {
    btn.textContent = 'TEST SHEET: ' + (on ? 'ON' : 'OFF');
    btn.classList.toggle('on', on);
  }
}

function clearSheet() {
  var ps = pressState();
  ps.panels.forEach(function (p) { p.body = ''; p.photo = null; });
  savePress();
  renderPress();
  toast('Cleared the sheet');
}
