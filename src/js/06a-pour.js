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

  // A page takes its piece whole. Pages the last compile filled and this one
  // does not are emptied; handwork and cuttings are left alone.
  var ran = pieces.slice(0, inner);
  ran.forEach(function (piece, i) {
    var panel = ps.panels[i + 1];
    if (!panel) return;
    panel.h = piece.title.toUpperCase();
    panel.body = piece.body;
    panel.photo = piece.photo || null;
  });
  (ps.ran || []).forEach(function (r) {
    var panel = ps.panels[r.page - 1];
    if (!panel || r.page - 2 < ran.length || r.page >= pages) return;
    panel.h = '';
    panel.body = '';
    panel.photo = null;
  });
  ps.ran = ran.map(function (piece, i) { return { page: i + 2, id: piece.id }; });
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
  var over = pieces.length - inner;
  toast(over > 0
    ? 'Compiled. ' + over + ' piece(s) did not fit — cut some, or use a bigger format'
    : 'Compiled issue №' + c.no + ' from ' + pieces.length + ' piece(s)');
}

