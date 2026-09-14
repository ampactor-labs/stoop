var activeLogFilter = 'all';

// The roster is drawn, not written into the HTML: a scene of four needs four
// chips and four options, and nobody should have to edit a view file to get
// them.
function renderNames() {
  var el = document.getElementById('authorname');
  if (el) el.textContent = nameOf(currentAuthor);

  var chips = document.getElementById('logfilters');
  if (chips) {
    chips.innerHTML = '<button class="chip' + (activeLogFilter === 'all' ? ' on' : '') +
      '" data-logfilter="all">all</button>' +
      authorIds().map(function (id) {
        return '<button class="chip' + (activeLogFilter === id ? ' on' : '') +
          '" data-logfilter="' + esc(id) + '">' + esc(nameOf(id)) + '</button>';
      }).join('');
  }

  var jAuth = document.getElementById('journalauthor');
  if (jAuth && document.activeElement !== jAuth) {
    var want = jAuth.value || currentAuthor;
    jAuth.innerHTML = authorIds().map(function (id) {
      return '<option value="' + esc(id) + '">\u270d ' + esc(nameOf(id)) + '</option>';
    }).join('');
    jAuth.value = authorIds().indexOf(want) >= 0 ? want : currentAuthor;
  }
  renderRoster();
}

// Somebody who has already written something keeps their seat: removing them
// would orphan a byline, and ensurePeople would only put them back as
// "Someone".
function personHasWork(id) {
  var by = function (x) { return x.author === id || x.byline === id; };
  return state.logs.some(by) || state.journal.some(by) || state.pieces.some(by) ||
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
  localStorage.setItem(AUTHOR_KEY, currentAuthor);
  renderNames();
  toast('Now writing as ' + nameOf(currentAuthor));
}

function photoTag(id, cls) {
  var src = photoCache[id];
  if (!src) return '';
  return '<img class="' + cls + '" src="' + esc(src) + '" alt="">';
}

// ---------- log ----------
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
      '</span> · <span class="tag cold">' + esc(l.tag) + '</span> · ' + esc(fmtStamp(l.ts)) + '</span>' +
      '<button class="log-del" data-dellog="' + esc(l.id) + '" title="Delete">✕</button></div>' +
      (l.photo ? photoTag(l.photo, 'log-photo') : '') +
      (l.text ? '<div class="log-body">' + esc(l.text) + '</div>' : '') +
      '</div>';
  }).join('');
}

function addLog(photoIds) {
  var inp = document.getElementById('loginput');
  var tag = document.getElementById('logtag');
  var ids = photoIds || [];
  var text = inp ? inp.value.trim() : '';
  if (!text && !ids.length) return;

  if (ids.length) {
    ids.forEach(function (pid, i) {
      state.logs.push({
        id: uid('l'), author: currentAuthor, tag: 'photo',
        text: i === 0 ? text : '', photo: pid, ts: Date.now() + i
      });
    });
  } else {
    state.logs.push({
      id: uid('l'), author: currentAuthor,
      tag: (tag && tag.value) || 'moment', text: text, ts: Date.now()
    });
  }
  if (inp) inp.value = '';
  saveState();
  renderLogs();
  toast(ids.length ? 'Added ' + ids.length + ' photo(s)' : 'Posted to log');
}

// ---------- projects ----------
function renderProjects() {
  var list = document.getElementById('projectlist');
  if (!list) return;
  if (!state.projects.length) {
    list.innerHTML = '<div class="sub" style="padding:1rem;">No active projects. Start one above.</div>';
    return;
  }
  list.innerHTML = state.projects.map(function (p) {
    return '<div class="project-card"><h3>' + esc(p.title) + '</h3><p>' + esc(p.desc) + '</p>' +
      '<div class="project-card-foot"><span>Updated ' + esc(fmtDay(p.ts)) + '</span>' +
      '<button class="log-del" data-delproject="' + esc(p.id) + '">DELETE</button></div></div>';
  }).join('');
}

function addProject() {
  var t = document.getElementById('projecttitle');
  var d = document.getElementById('projectdesc');
  if (!t || !t.value.trim()) return;
  state.projects.unshift({
    id: uid('p'), title: t.value.trim(), desc: (d && d.value.trim()) || '', ts: Date.now()
  });
  t.value = '';
  if (d) d.value = '';
  saveState();
  renderProjects();
  toast('Created project');
}

// ---------- journal ----------
function renderJournal() {
  var list = document.getElementById('journallist');
  if (!list) return;
  if (!state.journal.length) {
    list.innerHTML = '<div class="paper sub" style="text-align:center;">No journal entries yet.</div>';
    return;
  }
  list.innerHTML = state.journal.slice().sort(function (x, y) { return y.ts - x.ts; })
    .map(function (j) {
      return '<div class="journal-card"><div class="journal-card-head"><h2>' + esc(j.title) + '</h2>' +
        '<span class="sub">' + esc(nameOf(j.author)) + ' · ' + esc(fmtDay(j.ts)) +
        ' <button class="log-del" data-deljournal="' + esc(j.id) + '">✕</button></span></div>' +
        '<div class="journal-card-body">' + esc(j.body) + '</div></div>';
    }).join('');
}

function addJournal() {
  var t = document.getElementById('journaltitle');
  var a = document.getElementById('journalauthor');
  var b = document.getElementById('journalbody');
  if (!t || !t.value.trim() || !b || !b.value.trim()) { toast('Needs a title and some words'); return; }
  state.journal.unshift({
    id: uid('j'), author: (a && a.value) || currentAuthor,
    title: t.value.trim(), body: b.value.trim(), ts: Date.now()
  });
  t.value = '';
  b.value = '';
  saveState();
  renderJournal();
  toast('Saved journal entry');
}

function renderAll() {
  renderNames();
  if (typeof fillSettings === 'function') fillSettings();
  renderLogs();
  renderProjects();
  renderJournal();
  renderDesk();
  renderShelf();
  renderPress();
}
