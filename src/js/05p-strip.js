// ---------- the pages strip, and the zoom ----------
// The whole zine in one row above the table: a chip a page, the page being
// worked on marked, a dot for a page printed on a colour. Click a chip and
// the table scrolls to that page and the sheet turns to it; drag a chip onto
// another and the page moves there, covers staying where covers are. The
// zoom fits a spread to the window, or a page to the width, or nothing at
// all; fitPages reads it.
var pressZoom = 'fit';
var ZOOMS = [['fit', 'FIT'], ['page', 'PAGE'], ['full', '100%']];

function chipLabel(p, page, pages) {
  if (page === 1) return 'cover';
  if (page === pages) return 'back';
  var h = String(p.h || '').trim();
  return h.length > 14 ? h.slice(0, 13) + '…' : h;
}

function renderStrip() {
  var strip = document.getElementById('pagestrip');
  if (!strip) return;
  var ps = pressState();
  var n = ps.panels.length;
  strip.innerHTML = ps.panels.map(function (p, i) {
    var page = i + 1;
    return '<button class="pchip' + (page === pastePage ? ' here' : '') + '" data-gopage="' + page +
      '" title="Page ' + page + (page > 1 && page < n ? ' · drag to move it' : '') + '">' +
      '<b>' + page + '</b><small>' + esc(chipLabel(p, page, n)) + '</small>' +
      (fillOf(p) ? '<i class="dot" style="background:' + fillOf(p) + '"></i>' : '') + '</button>';
  }).join('');
  var z = document.getElementById('zoom');
  if (z) {
    z.innerHTML = ZOOMS.map(function (o) {
      return '<button class="btn quiet tiny' + (pressZoom === o[0] ? ' on' : '') + '" data-zoom="' + o[0] +
        '" title="Zoom">' + o[1] + '</button>';
    }).join('');
  }
}

function goPage(page) {
  var el = document.querySelector('#sheetzone [data-page="' + page + '"]');
  if (!el) return;
  pastePage = page;
  pasteSel = null;
  renderPress();
  el.scrollIntoView({ block: 'center' });
}

// A page moves with everything on it; the pieces flowed onto the pages are
// told where they went, so the next flow still knows which page is whose.
function movePage(from, to) {
  var ps = pressState();
  var n = ps.panels.length;
  if (from === to || from <= 1 || from >= n || to <= 1 || to >= n) return;
  pasteMark();
  var order = [];
  for (var i = 1; i <= n; i++) order.push(i);
  order.splice(from - 1, 1);
  order.splice(to - 1, 0, from);
  var map = {};
  order.forEach(function (old, at) { map[old] = at + 1; });
  ps.panels = order.map(function (old) { return ps.panels[old - 1]; });
  (ps.ran || []).forEach(function (r) { r.page = map[r.page] || r.page; });
  pastePage = to;
  pasteSel = null;
  savePress();
  renderPress();
  toast('Page ' + from + ' is now page ' + to);
}

var stripDrag = null;
document.addEventListener('pointerdown', function (ev) {
  var chip = ev.target.closest && ev.target.closest('#pagestrip .pchip');
  if (!chip || ev.button) return;
  stripDrag = { from: Number(chip.getAttribute('data-gopage')), x: ev.clientX, y: ev.clientY, moved: false, chip: chip };
  chip.setPointerCapture && chip.setPointerCapture(ev.pointerId);
});

document.addEventListener('pointermove', function (ev) {
  if (!stripDrag) return;
  if (!stripDrag.moved && Math.hypot(ev.clientX - stripDrag.x, ev.clientY - stripDrag.y) < 6) return;
  stripDrag.moved = true;
  stripDrag.chip.classList.add('dragging');
  var over = document.elementFromPoint(ev.clientX, ev.clientY);
  var target = over && over.closest && over.closest('#pagestrip .pchip');
  document.querySelectorAll('#pagestrip .pchip.drop').forEach(function (c) { c.classList.remove('drop'); });
  if (target && target !== stripDrag.chip) target.classList.add('drop');
  stripDrag.to = target ? Number(target.getAttribute('data-gopage')) : null;
});

document.addEventListener('pointerup', function (ev) {
  if (!stripDrag) return;
  var d = stripDrag;
  stripDrag = null;
  d.chip.classList.remove('dragging');
  document.querySelectorAll('#pagestrip .pchip.drop').forEach(function (c) { c.classList.remove('drop'); });
  if (d.moved) {
    if (d.to) movePage(d.from, d.to);
  } else {
    goPage(d.from);
  }
});

document.addEventListener('click', function (ev) {
  var z = ev.target.closest && ev.target.closest('[data-zoom]');
  if (!z) return;
  pressZoom = z.getAttribute('data-zoom');
  var zone = document.getElementById('sheetzone');
  if (zone) { fitPages(zone); checkFit(); }
  renderStrip();
});
