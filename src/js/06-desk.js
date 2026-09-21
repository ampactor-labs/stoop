// ---------- the desk ----------
// Exactly one person holds the final cut on any given issue, and the desk goes
// round whoever is on the roster, in order: alone it is always yours, at two
// it alternates, at four it comes back every fourth issue. Nobody administers
// it.
var PIECE_KINDS = ['essay', 'photos', 'log', 'mix', 'recipe', 'letters'];

function cycleState() {
  if (!state.cycle) state.cycle = { no: '01', bell: Date.now() + 6048e5, editor: 'a' };
  var c = state.cycle;
  if (!c.no) c.no = '01';
  if (typeof c.bell !== 'number') c.bell = Date.now() + 6048e5;
  if (personIds().indexOf(c.editor) < 0) c.editor = editorFor(c.no);
  return c;
}

function editorFor(no) {
  var ids = personIds();
  return ids[((parseInt(no, 10) || 1) - 1) % ids.length] || 'a';
}

function lastIssueTs() {
  return state.issues.reduce(function (max, iss) { return Math.max(max, iss.ts || 0); }, 0);
}

function livePieces() {
  return state.pieces.filter(function (p) { return !p.cut; })
    .sort(function (x, y) { return x.ts - y.ts; });
}

// ---------- submissions ----------
function addPiece(fields) {
  var piece = {
    id: uid('pc'),
    kind: PIECE_KINDS.indexOf(fields.kind) >= 0 ? fields.kind : 'essay',
    byline: fields.byline || currentAuthor,
    title: (fields.title || 'Untitled').trim(),
    body: (fields.body || '').trim(),
    photo: fields.photo || null,
    cut: false,
    ts: Date.now()
  };
  state.pieces.push(piece);
  saveState();
  return piece;
}

function submitPiece() {
  var t = document.getElementById('piecetitle');
  var b = document.getElementById('piecebody');
  var k = document.getElementById('piecekind');
  if (!t || !t.value.trim()) { toast('A piece needs a title'); return; }
  addPiece({ title: t.value, body: b ? b.value : '', kind: k ? k.value : 'essay' });
  t.value = '';
  if (b) b.value = '';
  renderDesk();
  toast('Submitted to the desk');
}

// A cut is a conversation, not a deletion: the maker keeps the piece and it
// can run next cycle. Nothing here removes anybody's work.
function cutPiece(id, cut) {
  var p = state.pieces.find(function (x) { return x.id === id; });
  if (!p) return;
  p.cut = !!cut;
  saveState();
  renderDesk();
  toast(cut ? 'Cut — it keeps, and it can run next cycle' : 'Restored to the tray');
}

function dropPiece(id) {
  state.pieces = state.pieces.filter(function (x) { return x.id !== id; });
  saveState();
  sweepPhotos();
  renderDesk();
}

// ---------- minting pieces from what was already written ----------
// The log, the journal and the projects are sources, not destinations. This
// draws from them once per cycle: only what was written since the last issue
// shipped, so issue two never reprints issue one.
function draftFromSources() {
  var since = lastIssueTs();
  var fresh = function (item) { return (item.ts || 0) > since; };
  var made = 0;

  var logs = state.logs.filter(function (l) { return fresh(l) && l.text; })
    .sort(function (x, y) { return x.ts - y.ts; });
  if (logs.length) {
    addPiece({
      kind: 'log', title: 'The Week', byline: 'both',
      body: logs.slice(0, 6).map(function (l) { return '• [' + nameOf(l.author) + '] ' + l.text; }).join('\n\n'),
      photo: (state.logs.filter(function (l) { return fresh(l) && l.photo && photoCache[l.photo]; })[0] || {}).photo
    });
    made++;
  }

  state.journal.filter(fresh).sort(function (x, y) { return x.ts - y.ts; }).forEach(function (j) {
    addPiece({ kind: 'essay', title: j.title, byline: j.author, body: j.body });
    made++;
  });

  var projects = state.projects.filter(fresh);
  if (projects.length) {
    addPiece({
      kind: 'log', title: 'Projects', byline: 'both',
      body: projects.map(function (p) { return '★ ' + p.title + '\n' + p.desc; }).join('\n\n')
    });
    made++;
  }

  renderDesk();
  toast(made ? 'Drew ' + made + ' piece(s) from the log, journal and projects' :
    'Nothing new since the last issue. Write something, then draw again.');
}

// ---------- assembling ----------
// Pieces flow into the pages between the covers. The vessel is whatever
// format the press is set to, which is why changing format re-flows an issue
// instead of forcing a retype.
function compileIssue() {
  var ps = pressState();
  var c = cycleState();
  var pieces = livePieces();
  var pages = formatOf(ps.format).pages;
  var inner = pages - 2;

  ps.issue = c.no;
  ps.panels[0].h = state.zine || ps.title || 'STOOP ZINE';

  pieces.slice(0, inner).forEach(function (piece, i) {
    var panel = ps.panels[i + 1];
    if (!panel) return;
    panel.h = piece.title.toUpperCase();
    panel.body = piece.body;
    if (piece.photo) panel.photo = piece.photo;
  });
  for (var j = pieces.length; j < inner; j++) {
    if (ps.panels[j + 1]) ps.panels[j + 1].body = '';
  }

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

// The bell. Publishing archives the sheet to the shelf whole, so the back
// issue reprints exactly as it shipped, and starts the next cycle clean.
function buildIssue() {
  var ps = pressState();
  var c = cycleState();
  capturePanels();

  if (state.issues.some(function (i) { return i.no === ps.issue; })) {
    if (!confirm('Issue №' + ps.issue + ' is already on the shelf. Replace it?')) return;
    state.issues = state.issues.filter(function (i) { return i.no !== ps.issue; });
  }

  var note = document.getElementById('editornote');
  state.issues.push({
    no: ps.issue,
    title: (ps.panels[0] && ps.panels[0].h) || state.zine || 'STOOP ZINE',
    format: ps.format,
    hand: ps.hand,
    editor: c.editor,
    note: note ? note.value.trim() : '',
    panels: JSON.parse(JSON.stringify(ps.panels)),
    pieces: JSON.parse(JSON.stringify(livePieces())),
    ts: Date.now()
  });

  // The tray empties; cut pieces stay for next cycle, which is the promise a
  // cut makes. Published pieces are in the issue now and leave the desk.
  state.pieces = state.pieces.filter(function (p) { return p.cut; });

  var next = String((parseInt(ps.issue, 10) || 1) + 1);
  c.no = next.length < 2 ? '0' + next : next;
  c.editor = editorFor(c.no);
  c.bell = Date.now() + 6048e5;
  if (note) note.value = '';

  ps.issue = c.no;
  ps.panels = blankPanels(formatOf(ps.format).pages);
  ps.panels[0].h = state.zine || 'STOOP ZINE';
  savePress();
  renderAll();
  location.hash = '#shelf';
  toast('Issue №' + state.issues[state.issues.length - 1].no + ' is on the shelf. ' +
    nameOf(c.editor) + ' has the desk for №' + c.no + '.');
}

// ---------- the view ----------
function fmtBell(ts) {
  var days = Math.ceil((ts - Date.now()) / 864e5);
  if (days < 0) return 'the bell has rung — ' + (-days) + ' day(s) ago';
  if (days === 0) return 'the bell rings today';
  return days + ' day(s) to the bell';
}

function renderDesk() {
  var c = cycleState();
  var head = document.getElementById('deskhead');
  if (head) {
    head.textContent = 'issue №' + c.no + ' · ' + nameOf(c.editor) + "'s turn · " + fmtBell(c.bell);
  }
  var bell = document.getElementById('bellinput');
  if (bell && document.activeElement !== bell) {
    bell.value = new Date(c.bell - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  }

  var tray = document.getElementById('desktray');
  if (!tray) return;
  var all = state.pieces.slice().sort(function (x, y) { return x.ts - y.ts; });
  if (!all.length) {
    tray.innerHTML = '<p class="sub">The tray is empty. Submit a piece, or draw from the log and journal.</p>';
    return;
  }
  var n = 0;
  tray.innerHTML = all.map(function (p) {
    var ord = p.cut ? '–' : String(++n);
    return '<div class="sub-row' + (p.cut ? ' cut' : '') + '">' +
      '<span class="ord">' + ord + '</span>' +
      '<span class="meta"><b>' + esc(p.title) + '</b> — ' + esc(nameOf(p.byline)) +
      '<small>' + esc(p.kind) + ' · ' + p.body.split(/\s+/).filter(Boolean).length + ' words</small></span>' +
      '<button class="subbtn" data-' + (p.cut ? 'restore' : 'cut') + 'piece="' + esc(p.id) + '">' +
      (p.cut ? 'RESTORE' : 'CUT') + '</button>' +
      '<button class="log-del" data-droppiece="' + esc(p.id) + '" title="Remove entirely">✕</button>' +
      '</div>';
  }).join('');
}
