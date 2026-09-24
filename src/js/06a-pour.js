// ---------- flowing pieces onto the pages ----------
// Split from the desk for the line ceiling: this is the part that pours the
// tray into the pages the press shows.
// Pieces flow into the pages between the covers. The vessel is whatever
// format the press is set to, which is why changing format re-flows an issue
// instead of forcing a retype.
// What a page said when the pieces were flowed onto it, whitespace aside, so a
// round trip through the page on screen does not count as an edit.
function pourMark(p) {
  return String(hash32((String(p.h || '') + ' ' + String(p.body || '')).replace(/\s+/g, ' ').trim()));
}

function compileIssue() {
  var ps = pressState();
  var c = cycleState();
  var pieces = livePieces();
  var pages = formatOf(ps.format).pages;
  var inner = pages - 2;

  // A page changed by hand since the last flow is somebody's work. Say which,
  // and ask before pouring over it.
  var edited = [];
  (ps.ran || []).forEach(function (r) {
    var p = ps.panels[r.page - 1];
    if (p && p.poured && p.poured !== pourMark(p) && edited.indexOf(r.page) < 0) edited.push(r.page);
  });
  if (edited.length && !confirm((edited.length > 1 ? 'Pages ' : 'Page ') + edited.join(', ') +
    ' changed by hand since the pieces were last flowed on. Flow them again and replace ' +
    (edited.length > 1 ? 'those pages?' : 'that page?'))) return;
  pasteMark();
  ps.issue = c.no;
  ps.panels[0].h = state.zine || ps.title || 'STOOP ZINE';

  // A piece too long for its page runs on to the next one. Pages the last
  // flow filled and this one does not are emptied; handwork and cuttings are
  // left alone.
  layoutPages();
  var ran = pourPieces(ps, pieces, pages);
  var filled = {};
  ran.forEach(function (r) { filled[r.page] = 1; });
  (ps.ran || []).forEach(function (r) {
    var panel = ps.panels[r.page - 1];
    if (!panel || filled[r.page] || r.page >= pages) return;
    panel.h = '';
    panel.body = '';
    panel.photo = null;
  });
  ps.ran = ran;
  ps.ran.forEach(function (r) { ps.panels[r.page - 1].poured = pourMark(ps.panels[r.page - 1]); });

  var note = document.getElementById('editornote');
  ps.panels[pages - 1].h = 'BACK COVER';
  ps.panels[pages - 1].body = 'Issue №' + c.no + '\nEdited by ' + nameOf(c.editor) + '.\n\n' +
    ((note && note.value.trim()) ? note.value.trim() + '\n\n' : '') +
    'Made on a stoop. Take one, leave one.';

  var newest = state.logs.slice().sort(function (x, y) { return y.ts - x.ts; })
    .filter(function (l) { return l.photo && photoCache[l.photo]; })[0];
  if (newest && !ps.panels[0].photo) ps.panels[0].photo = newest.photo;

  savePress();
  renderPress();
  var ranIds = {};
  ran.forEach(function (r) { ranIds[r.id] = 1; });
  var over = pieces.filter(function (p) { return !ranIds[p.id]; }).length;
  toast(over > 0
    ? 'Compiled. ' + over + ' piece(s) did not fit — cut some, or use a bigger format'
    : 'Compiled issue №' + c.no + ' from ' + pieces.length + ' piece(s)');
}


// The press is on screen behind the desk, so the page itself is the ruler: a
// piece is poured into its page, and if it does not fit, the words that do
// stay with a line saying where the rest went. A few words over is a trim for
// the editor, which the fit meter asks for, not a page of its own.
var RUN_ON_MIN = 12;
function pourPieces(ps, pieces, pages) {
  var ran = [];
  var page = 2;
  pieces.forEach(function (piece) {
    var rest = piece.body;
    var first = true;
    while (page < pages) {
      var panel = ps.panels[page - 1];
      panel.h = first ? piece.title.toUpperCase() : piece.title.toUpperCase() + ', CONTINUED';
      panel.photo = first ? (piece.photo || null) : null;
      ran.push({ page: page, id: piece.id });
      var cut = page < pages - 1 ? runOnAt(page, panel, rest) : -1;
      if (cut < 0) { panel.body = rest; page++; break; }
      panel.body = rest.slice(0, cut).replace(/\s+$/, '') + '\n\n(continued on p. ' + (page + 1) + ')';
      rest = rest.slice(cut).replace(/^\s+/, '');
      first = false;
      page++;
    }
  });
  return ran;
}

// Where to break `text` so the start of it, and the line saying where the
// rest went, fits on the page; -1 when it fits whole or nearly.
function runOnAt(page, panel, text) {
  var zone = document.getElementById('sheetzone');
  var el = zone && zone.offsetParent && zone.querySelector('[data-page="' + page + '"]');
  var body = el && el.querySelector('.body');
  if (!body) return -1;
  paintFace(el, { h: panel.h, body: '', photo: panel.photo }, page, null);
  var fits = function (t) {
    body.innerText = t;
    return body.scrollHeight <= body.clientHeight + 1;
  };
  var ends = [];
  var re = /\S+/g;
  var m;
  while ((m = re.exec(text))) ends.push(m.index + m[0].length);
  var tail = '\n\n(continued on p. ' + (page + 1) + ')';
  var at = -1;
  if (!fits(text)) {
    var lo = 0, hi = ends.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (fits(text.slice(0, ends[mid - 1]) + tail)) lo = mid; else hi = mid - 1;
    }
    if (ends.length - lo >= RUN_ON_MIN) at = lo ? ends[lo - 1] : 0;
  }
  body.innerText = '';
  return at;
}
