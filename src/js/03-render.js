var activeLogFilter = 'all';

// The roster is drawn, not written into the HTML: a scene of four needs four
// chips and four options, and nobody should have to edit a view file to get
// them.
// Work signed together keeps a chip to find it by, even on a roster of one.
function filterIds() {
  var ids = authorIds();
  if (ids.indexOf('both') < 0 && state.logs.some(function (l) { return l.author === 'both'; })) ids.push('both');
  return ids;
}

function renderNames() {
  if (activeLogFilter !== 'all' && filterIds().indexOf(activeLogFilter) < 0) activeLogFilter = 'all';
  var el = document.getElementById('authorname');
  if (el) el.textContent = nameOf(currentAuthor);

  var chips = document.getElementById('logfilters');
  if (chips) {
    chips.innerHTML = '<button class="chip' + (activeLogFilter === 'all' ? ' on' : '') +
      '" data-logfilter="all">all</button>' +
      filterIds().map(function (id) {
        return '<button class="chip' + (activeLogFilter === id ? ' on' : '') +
          '" data-logfilter="' + esc(id) + '">' + esc(nameOf(id)) + '</button>';
      }).join('');
  }

  renderRoster();
}

// Somebody who has already written something keeps their seat: removing them
// would orphan a byline, and ensurePeople would only put them back as
// "Someone".
function personHasWork(id) {
  var by = function (x) { return x.author === id || x.byline === id; };
  return state.logs.some(by) || state.pieces.some(by) ||
    state.issues.some(function (i) { return i.editor === id || (i.pieces || []).some(by); });
}

function renderRoster() {
  var box = document.getElementById('roster');
  if (!box || box.contains(document.activeElement)) return;
  box.innerHTML = people.map(function (p) {
    var used = personHasWork(p.id);
    return '<div class="person">' +
      '<input class="text-input" data-personid="' + esc(p.id) + '" maxlength="24" value="' +
      esc(p.name) + '">' +
      (used || people.length < 2
        ? '<span class="sub">' + (used ? 'in the archive' : '') + '</span>'
        : '<button class="btn quiet" data-delperson="' + esc(p.id) + '">REMOVE</button>') +
      '</div>';
  }).join('');
}

function toggleAuthor() {
  var ids = authorIds();
  currentAuthor = ids[(ids.indexOf(currentAuthor) + 1) % ids.length];
  rememberAuthor();
  renderNames();
  toast('Now writing as ' + nameOf(currentAuthor));
}

function photoTag(id, cls) {
  var src = photoCache[id];
  if (!src) return '';
  return '<img class="' + cls + '" src="' + esc(src) + '" alt="">';
}

// ---------- scraps ----------
// One stream. A scrap is a line, or a page with a title, or a photograph, by
// somebody, on a day. The desk draws pieces from it once a cycle. There used
// to be three of these (log, journal, projects) and they were one idea.
function renderLogs() {
  var list = document.getElementById('loglist');
  if (!list) return;
  var rows = state.logs.slice().sort(function (x, y) { return y.ts - x.ts; })
    .filter(function (l) { return activeLogFilter === 'all' || l.author === activeLogFilter; });

  if (!rows.length) {
    list.innerHTML = '<div class="paper sub" style="text-align:center;">Nothing here yet.</div>';
    return;
  }
  list.innerHTML = rows.map(function (l) {
    return '<div class="log-card author-' + esc(l.author) + '">' +
      '<div class="log-meta"><span><span class="log-author">' + esc(nameOf(l.author)) +
      '</span> \u00b7 ' + esc(fmtStamp(l.ts)) + '</span>' +
      '<button class="log-del" data-dellog="' + esc(l.id) + '" title="Delete">\u2715</button></div>' +
      (l.title ? '<h3 class="log-title">' + esc(l.title) + '</h3>' : '') +
      (l.photo ? photoTag(l.photo, 'log-photo') : '') +
      (l.text ? '<div class="log-body">' + esc(l.text) + '</div>' : '') +
      '</div>';
  }).join('');
}

function addLog(photoIds) {
  var inp = document.getElementById('loginput');
  var tt = document.getElementById('scraptitle');
  var ids = photoIds || [];
  var text = inp ? inp.value.trim() : '';
  var title = tt ? tt.value.trim() : '';
  if (!text && !title && !ids.length) return;

  if (ids.length) {
    ids.forEach(function (pid, i) {
      state.logs.push({
        id: uid('l'), author: currentAuthor, tag: 'photo',
        title: i === 0 ? title : '', text: i === 0 ? text : '', photo: pid, ts: Date.now() + i
      });
    });
  } else {
    state.logs.push({ id: uid('l'), author: currentAuthor, tag: 'scrap', title: title, text: text, ts: Date.now() });
  }
  if (inp) inp.value = '';
  if (tt) tt.value = '';
  saveState();
  renderLogs();
  toast(ids.length ? 'Kept ' + ids.length + ' photo(s)' : 'Kept');
}

// Gone at once, back with UNDO while the toast is up; its photograph is only
// swept once nothing can bring it back.
function deleteLog(id) {
  var at = state.logs.findIndex(function (l) { return l.id === id; });
  if (at < 0) return;
  var gone = state.logs.splice(at, 1)[0];
  saveState(); renderLogs(); renderTray();
  toast('Scrap deleted.', function () {
    state.logs.splice(Math.min(at, state.logs.length), 0, gone);
    saveState(); renderLogs(); renderTray();
  });
  setTimeout(sweepPhotos, 6500);
}

function renderAll() {
  renderNames();
  renderBar();
  if (typeof fillSettings === 'function') fillSettings();
  renderLogs();
  renderDesk();
  renderShelf();
  renderPress();
}
