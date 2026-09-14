// ---------- carrying the notebook between devices ----------
// Two people means two browsers, and a backup that replaces the other person's
// work is not a sync, it is a coin flip. Import merges by id and keeps the
// newer copy of anything held in both. Sending it both ways leaves the two
// devices agreeing, which is as much as a file on a thumb drive can promise.
var BACKUP_VERSION = 4;

function exportBackup() {
  var live = collectPhotoRefs();
  var photos = {};
  Object.keys(live).forEach(function (id) { if (photoCache[id]) photos[id] = photoCache[id]; });

  var payload = {
    version: BACKUP_VERSION,
    exported: new Date().toISOString(),
    people: people,
    logs: state.logs,
    projects: state.projects,
    journal: state.journal,
    pieces: state.pieces,
    issues: state.issues,
    cycle: state.cycle,
    address: state.address,
    zine: state.zine,
    press: state.press,
    photos: photos
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'stoop-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  toast('Backup downloaded — photos included');
}

function mergeList(mine, theirs) {
  var byId = {};
  mine.forEach(function (item) { byId[item.id] = item; });
  theirs.forEach(function (item) {
    if (!item || !item.id) return;
    var existing = byId[item.id];
    if (!existing || (item.ts || 0) > (existing.ts || 0)) byId[item.id] = item;
  });
  return Object.keys(byId).map(function (k) { return byId[k]; });
}

function importBackup(raw, mode) {
  var incoming = normalize(raw);
  var photos = (raw && raw.photos) || {};
  var added = 0;

  Object.keys(photos).forEach(function (id) {
    if (!photoCache[id]) { photoPut(id, photos[id]); added++; }
  });

  if (mode === 'replace') {
    state.logs = incoming.logs;
    state.projects = incoming.projects;
    state.journal = incoming.journal;
    state.pieces = incoming.pieces;
    state.issues = incoming.issues;
    state.cycle = incoming.cycle;
    state.address = incoming.address;
    state.zine = incoming.zine;
    state.press = incoming.press;
  } else {
    var count = function () {
      return state.logs.length + state.projects.length + state.journal.length +
        state.pieces.length + state.issues.length;
    };
    var before = count();
    state.logs = mergeList(state.logs, incoming.logs);
    state.projects = mergeList(state.projects, incoming.projects);
    state.journal = mergeList(state.journal, incoming.journal);
    state.pieces = mergeList(state.pieces, incoming.pieces);
    // Issues are keyed by number and never overwritten: a published issue is
    // history, and the copy already on the shelf wins.
    incoming.issues.forEach(function (iss) {
      if (!state.issues.some(function (x) { return x.no === iss.no; })) state.issues.push(iss);
    });
    if (!state.address) state.address = incoming.address;
    if (!state.zine || state.zine === 'STOOP ZINE') state.zine = incoming.zine;
    mergePeople(raw && raw.people);
    if (incoming.press && (!state.press || (incoming.press.ts || 0) > (state.press.ts || 0))) {
      state.press = incoming.press;
    }
    var after = count();
    added = Math.max(0, after - before) + added;
  }

  if (mode === 'replace' && Array.isArray(raw && raw.people) && raw.people.length) {
    people = raw.people.filter(function (p) { return p && p.id && p.name; });
    savePeople();
  } else {
    mergePeople(raw && raw.people);
  }
  // A backup written before the roster existed carries two names instead.
  if (raw && raw.names && raw.names.a && raw.names.b) {
    mergePeople([{ id: 'a', name: String(raw.names.a) }, { id: 'b', name: String(raw.names.b) }]);
  }
  ensurePeople();

  saveState();
  renderAll();
  var status = document.getElementById('importstatus');
  var msg = mode === 'replace'
    ? 'Replaced everything with the backup.'
    : 'Merged. ' + added + ' new item(s) came across.';
  if (status) status.textContent = msg;
  toast(msg);
}

function handleImportFile(file, mode) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch (err) {
      toast('That file is not readable JSON');
      return;
    }
    if (!parsed || typeof parsed !== 'object') { toast('That file is not a stoop backup'); return; }
    if (mode === 'replace' &&
      !confirm('Replace everything on this device with the backup? Merge is usually what you want.')) return;
    importBackup(parsed, mode);
  };
  reader.onerror = function () { toast('Could not read that file'); };
  reader.readAsText(file);
}

function resetData() {
  if (!confirm('Reset to sample data? Everything on this device will be replaced.')) return;
  state = JSON.parse(JSON.stringify(defaultData));
  saveState();
  sweepPhotos();
  renderAll();
  toast('Reset to defaults');
}

function saveNameFields() {
  document.querySelectorAll('[data-personid]').forEach(function (input) {
    var p = personById(input.getAttribute('data-personid'));
    if (p) p.name = input.value.trim() || p.name;
  });
  savePeople();
  var addr = document.getElementById('addressinput');
  if (addr) state.address = addr.value.trim();
  saveState();
  renderAll();
  toast('Saved');
}

// Start empty is the opposite of reset: no sample pieces, nothing borrowed.
function startEmpty() {
  if (!confirm('Clear everything on this device — logs, journal, projects, pieces and every published issue — and start with a blank press?')) return;
  state = normalize({ cycle: { no: '01', bell: Date.now() + 6048e5, editor: people[0].id },
    address: state.address, zine: state.zine });
  saveState();
  sweepPhotos();
  renderAll();
  toast('Empty. The first issue is yours alone.');
}
