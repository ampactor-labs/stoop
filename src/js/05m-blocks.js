// ---------- magazine blocks ----------
// The parts of a magazine made out of the rest of it: page numbers, a
// contents list, the credits, and a line pulled out large. Each lands as an
// ordinary cutting, to be moved, restyled or cut like any other. A page
// number knows which page it is on rather than what it said when it was
// made, so it stays right when the pages move to another format.
var BLOCKS = [['folios', 'PAGE NUMBERS'], ['contents', 'CONTENTS'], ['credits', 'CREDITS'], ['quote', 'PULL QUOTE']];

function isFolio(el) { return !!el && el.kind === 'text' && el.folio === true; }

// The text a cutting shows: its own, or for a page number, the page.
function shownText(el, page) { return isFolio(el) && page ? String(page) : el.text; }

function renderBlockPalette(open) {
  var box = document.getElementById('blocks');
  if (!box) return;
  box.classList.toggle('on', !!open);
  box.innerHTML = open ? BLOCKS.map(function (b) {
    return '<button class="btn quiet" data-block="' + b[0] + '">' + b[1] + '</button>';
  }).join('') : '';
}

// Every page between the covers, numbered at its foot; a second press takes
// the numbers off again.
function toggleFolios() {
  var ps = pressState();
  var inner = ps.panels.slice(1, ps.panels.length - 1);
  var numbered = function (p) { return elsOf(p).some(isFolio); };
  pasteMark();
  if (inner.every(numbered)) {
    inner.forEach(function (p) { p.els = elsOf(p).filter(function (e) { return !isFolio(e); }); });
    return 'Page numbers off';
  }
  inner.forEach(function (p, i) {
    if (numbered(p)) return;
    elsOf(p).push({ id: uid('el'), kind: 'text', voice: 'type', text: String(i + 2), folio: true, size: 9,
      ink: 'black', align: 'center', x: 0.4, y: 0.935, w: 0.2, h: 0.04, rot: 0, z: topZ(p) + 1 });
  });
  return 'Every page between the covers is numbered';
}

function contentsText() {
  var ps = pressState();
  var pages = ps.panels.length;
  var lines = ['CONTENTS', ''];
  ps.panels.forEach(function (p, i) {
    var h = String(p.h || '').trim();
    if (i === 0 || i === pages - 1 || !h || /, CONTINUED$/.test(h) || !(String(p.body || '').trim() || p.photo)) return;
    var title = h.length > 22 ? h.slice(0, 21) + '…' : h;
    var no = String(i + 1);
    lines.push(title + ' ' + new Array(Math.max(3, 27 - title.length - no.length)).join('.') + ' ' + no);
  });
  return lines.join('\n');
}

// Who made the issue, by what they did: the editor, whoever wrote the
// pieces on the pages, and whoever took the photographs on them.
function creditsText() {
  var ps = pressState();
  var ranIds = Array.isArray(ps.ran) ? ps.ran.map(function (r) { return r.id; }) : null;
  var pieces = livePieces().filter(function (p) { return !ranIds || ranIds.indexOf(p.id) >= 0; });
  var words = [], photos = [];
  var add = function (list, who) { if (who && who !== 'anon' && list.indexOf(who) < 0) list.push(who); };
  pieces.forEach(function (p) {
    if (String(p.body || '').trim()) add(words, p.byline);
    if (p.photo) add(photos, p.byline);
  });
  var rootOf = function (id) { return (photoMeta[id] && photoMeta[id].root) || id; };
  var shown = {};
  ps.panels.forEach(function (p) {
    if (p.photo) shown[rootOf(p.photo)] = 1;
    elsOf(p).forEach(function (e) { if (e.photo) shown[rootOf(e.photo)] = 1; });
  });
  state.logs.forEach(function (l) { if (l.photo && shown[rootOf(l.photo)]) add(photos, l.author); });
  var names = function (list) { return list.map(nameOf).join(', '); };
  var out = ['EDITED BY ' + nameOf(cycleState().editor)];
  if (words.length) out.push('WORDS ' + names(words));
  if (photos.length) out.push('PHOTOS ' + names(photos));
  return out.join('\n');
}

function addBlock(kind) {
  var msg = 'Drag it where you want it';
  if (kind === 'folios') {
    msg = toggleFolios();
    savePress();
  } else {
    var spec = {
      contents: { voice: 'type', text: contentsText(), x: 0.1, y: 0.12, w: 0.8, h: 0.3 },
      credits: { voice: 'sans', text: creditsText(), x: 0.1, y: 0.7, w: 0.8, h: 0.12 },
      quote: { voice: 'serif', text: '“A line worth pulling out.”', x: 0.08, y: 0.4, w: 0.84, h: 0.14, size: 20, align: 'center' }
    }[kind];
    if (!spec) return;
    var el = addEl(pastePage, 'text', { voice: spec.voice, text: spec.text });
    if (!el) return;
    ['x', 'y', 'w', 'h', 'size', 'align'].forEach(function (k) { if (spec[k] !== undefined) el[k] = spec[k]; });
    el.rot = 0;
    savePress();
    msg = kind === 'quote' ? 'Double-click it to write the line' : 'Made from the pages as they are now';
  }
  renderBlockPalette(false);
  renderPress();
  toast(msg);
}

document.addEventListener('click', function (ev) {
  var t = ev.target;
  if (t.closest && t.closest('#blockbtn')) {
    var box = document.getElementById('blocks');
    renderBlockPalette(!(box && box.classList.contains('on')));
    return;
  }
  var pick = t.closest && t.closest('[data-block]');
  if (pick) addBlock(pick.getAttribute('data-block'));
});
