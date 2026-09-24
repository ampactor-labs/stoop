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
  if (fields.from) piece.from = fields.from;
  if (fields.scraps) piece.scraps = true;
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
  var at = state.pieces.findIndex(function (x) { return x.id === id; });
  if (at < 0) return;
  var gone = state.pieces.splice(at, 1)[0];
  saveState();
  renderDesk();
  toast('\u201c' + gone.title + '\u201d removed.', function () {
    state.pieces.splice(Math.min(at, state.pieces.length), 0, gone);
    saveState();
    renderDesk();
  });
  setTimeout(sweepPhotos, 6500);
}

// ---------- minting pieces from scraps ----------
// Scraps are a source, not a destination. Once a cycle the desk draws what
// was written since the last issue shipped, so issue two never reprints
// issue one. A scrap with a title, or a long one, is a piece of its own; the
// short ones run together as one piece, the way a log column does.
// A piece remembers its scraps (`from`), so pulling twice draws nothing twice,
// and new short scraps join the waiting SCRAPS column. The column is signed by
// whoever wrote it, or as made together when several did.
function draftFromSources() {
  var since = lastIssueTs();
  var drawn = {};
  state.pieces.forEach(function (p) { (p.from || []).forEach(function (id) { drawn[id] = 1; }); });
  var fresh = state.logs.filter(function (l) {
    return (l.ts || 0) > since && !drawn[l.id] && (l.text || l.title || l.photo);
  }).sort(function (x, y) { return x.ts - y.ts; });
  var made = 0;
  var short = [];

  fresh.forEach(function (l) {
    var own = l.title || (l.text || '').length > 280;
    if (own) {
      addPiece({ kind: 'essay', title: l.title || (l.text || '').slice(0, 40), byline: l.author,
        body: l.text || '', photo: l.photo, from: [l.id] });
      made++;
    } else {
      short.push(l);
    }
  });
  var joined = 0;
  if (short.length) {
    var column = state.pieces.filter(function (p) { return p.scraps && !p.cut; })[0];
    var who = {};
    short.forEach(function (l) { who[l.author] = 1; });
    if (column) who[column.byline] = 1;
    var hands = Object.keys(who);
    var byline = hands.length === 1 ? hands[0] : 'both';
    var bullets = short.filter(function (l) { return l.text; })
      .map(function (l) { return '\u2022 [' + nameOf(l.author) + '] ' + l.text; }).join('\n\n');
    var pic = (short.filter(function (l) { return l.photo && photoCache[l.photo]; })[0] || {}).photo;
    var ids = short.map(function (l) { return l.id; });
    if (column) {
      column.body = [column.body, bullets].filter(Boolean).join('\n\n');
      column.byline = byline;
      column.from = (column.from || []).concat(ids);
      if (!column.photo && pic) column.photo = pic;
      saveState();
      joined = short.length;
    } else {
      addPiece({ kind: 'log', title: 'SCRAPS', byline: byline, body: bullets, photo: pic, from: ids, scraps: true });
      made++;
    }
  }

  renderDesk();
  toast(made || joined
    ? [made ? 'Pulled in ' + made + ' piece(s)' : '', joined ? joined + ' scrap(s) joined SCRAPS' : '']
      .filter(Boolean).join(', ')
    : 'Nothing new since the last issue. Keep something, then pull again.');
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

  // What shipped is what was compiled; pieces that did not fit stay.
  var live = livePieces();
  var ranIds = Array.isArray(ps.ran) ? ps.ran.map(function (r) { return r.id; }) : null;
  var shipped = ranIds ? live.filter(function (p) { return ranIds.indexOf(p.id) >= 0; }) : live;
  var held = live.length - shipped.length;

  var note = document.getElementById('editornote');
  state.issues.push({
    no: ps.issue,
    title: (ps.panels[0] && ps.panels[0].h) || state.zine || 'STOOP ZINE',
    format: ps.format,
    hand: ps.hand,
    gen: genOf(ps),
    editor: c.editor,
    note: note ? note.value.trim() : '',
    panels: JSON.parse(JSON.stringify(ps.panels)),
    pieces: JSON.parse(JSON.stringify(shipped)),
    ts: Date.now()
  });

  // Cut pieces stay for next cycle, which is the promise a cut makes.
  state.pieces = state.pieces.filter(function (p) { return shipped.indexOf(p) < 0; });

  var next = String((parseInt(ps.issue, 10) || 1) + 1);
  c.no = next.length < 2 ? '0' + next : next;
  c.editor = editorFor(c.no);
  c.bell = Date.now() + 6048e5;
  if (note) note.value = '';

  ps.issue = c.no;
  ps.panels = blankPanels(formatOf(ps.format).pages);
  ps.panels[0].h = state.zine || 'STOOP ZINE';
  ps.spare = [];
  ps.ran = null;
  forgetUndo();
  savePress();
  keepStorage();
  renderAll();
  location.hash = '#shelf';
  toast('Issue №' + state.issues[state.issues.length - 1].no + ' is on the shelf. ' +
    nameOf(c.editor) + ' has the desk for №' + c.no + '.' +
    (held ? ' ' + held + ' piece(s) that did not fit wait in the tray.' : ''));
}

// The bell where people already keep their days: a calendar file with a
// reminder the day before. No server is told anything; the file is handed
// round like the zine.
function bellIcs() {
  var c = cycleState();
  var stamp = function (t) { return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''); };
  var text = function (s) { return String(s).replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n'); };
  var zine = state.zine || 'STOOP ZINE';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//stoop//press//EN', 'BEGIN:VEVENT',
    'UID:' + sceneSlug() + '-' + c.no + '@stoop', 'DTSTAMP:' + stamp(Date.now()), 'DTSTART:' + stamp(c.bell),
    'DURATION:PT1H', 'SUMMARY:' + text(zine + ' \u2116' + c.no + ': the bell'),
    'DESCRIPTION:' + text('Pieces to ' + nameOf(c.editor) + ' by now. The issue goes to the shelf when the bell rings.'),
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + text('The bell rings tomorrow'), 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
document.addEventListener('click', function (ev) {
  if (!ev.target.closest || !ev.target.closest('#icsbtn')) return;
  downloadBlob(sceneSlug() + '-' + cycleState().no + '-bell.ics', new Blob([bellIcs()], { type: 'text/calendar' }));
  toast('The bell, as a calendar event, with a reminder the day before');
});

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
    tray.innerHTML = '<p class="sub">Empty. Submit a piece, or pull in the new scraps.</p>';
    return;
  }
  var n = 0;
  tray.innerHTML = all.map(function (p) {
    var ord = p.cut ? '–' : String(++n);
    return '<div class="sub-row' + (p.cut ? ' cut' : '') + '">' +
      '<span class="ord">' + ord + '</span>' +
      '<span class="meta"><b>' + esc(p.title) + '</b> — ' + esc(nameOf(p.byline)) +
      '<small>' + esc(p.kind) + ' · ' + String(p.body || '').split(/\s+/).filter(Boolean).length + ' words</small></span>' +
      '<button class="subbtn" data-' + (p.cut ? 'restore' : 'cut') + 'piece="' + esc(p.id) + '">' +
      (p.cut ? 'RESTORE' : 'CUT') + '</button>' +
      '<button class="subbtn" data-piecebundle="' + esc(p.id) + '" title="Save it as a file to send to whoever holds the desk">SEND</button>' +
      '<button class="log-del" data-droppiece="' + esc(p.id) + '" title="Remove entirely">✕</button>' +
      '</div>';
  }).join('');
}
