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
  try { localStorage.setItem('stoop_last_backup', String(Date.now())); } catch (e) {}
  keepStorage();
  renderBackupStatus();
}

// This browser is the only copy until a backup exists, and a browser may
// clear a site's storage to make room, or, in Safari, after a week without a
// visit. Ask it to keep ours, once there is something worth keeping, and say
// plainly when the last backup was.
function keepStorage() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) {}
}

function lastBackup() {
  try { return Number(localStorage.getItem('stoop_last_backup')) || 0; } catch (e) { return 0; }
}

function backupAge() {
  var t = lastBackup();
  if (!t) return 'never';
  var days = Math.floor((Date.now() - t) / 864e5);
  return days < 1 ? 'today' : days + ' day' + (days === 1 ? '' : 's') + ' ago';
}

function renderBackupStatus() {
  var el = document.getElementById('backupstatus');
  if (el) el.textContent = 'Last backup: ' + backupAge() + '.';
  var nudge = document.getElementById('shelfnudge');
  if (!nudge) return;
  var stale = !lastBackup() || Date.now() - lastBackup() > 14 * 864e5;
  nudge.innerHTML = state.issues.length && stale
    ? 'Everything here lives in this browser and nowhere else. Last backup: ' + esc(backupAge()) +
      '. <button class="btn quiet" id="nudgebackup">BACK IT UP</button>'
    : '';
}
document.addEventListener('click', function (ev) {
  if (ev.target.closest && ev.target.closest('#nudgebackup')) exportBackup();
});

function wasPublished(id) {
  return state.issues.some(function (i) {
    return (i.pieces || []).some(function (p) { return p && p.id === id; });
  });
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
    forgetUndo();
    state.logs = incoming.logs;
    state.pieces = incoming.pieces;
    state.issues = incoming.issues;
    state.cycle = incoming.cycle;
    state.address = incoming.address;
    state.zine = incoming.zine;
    state.press = incoming.press;
  } else {
    var count = function () {
      return state.logs.length +
        state.pieces.length + state.issues.length;
    };
    var before = count();
    state.logs = mergeList(state.logs, incoming.logs);
    // Issues are keyed by number and never overwritten: a published issue is
    // history, and the copy already on the shelf wins.
    incoming.issues.forEach(function (iss) {
      if (!state.issues.some(function (x) { return x.no === iss.no; })) state.issues.push(iss);
    });
    // A piece already published elsewhere must not return to the tray.
    state.pieces = mergeList(state.pieces, incoming.pieces)
      .filter(function (p) { return !wasPublished(p.id); });
    if (!state.address) state.address = incoming.address;
    if (!state.zine || state.zine === 'STOOP ZINE') state.zine = incoming.zine;
    mergePeople(raw && raw.people);
    if (incoming.press && (!state.press || (incoming.press.ts || 0) > (state.press.ts || 0))) {
      state.press = incoming.press;
    }
    var after = count();
    added = Math.max(0, after - before) + added;
  }

  var roster = Array.isArray(raw && raw.people)
    ? raw.people.filter(function (p) { return p && p.id && p.name; }) : [];
  if (mode === 'replace' && roster.length) {
    people = roster;
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
  forgetUndo();
  state = JSON.parse(JSON.stringify(defaultData));
  state.pieces.forEach(function (p) { p.byline = people[0].id; });
  state.cycle = { no: '01', bell: Date.now() + 6048e5, editor: people[0].id };
  saveState();
  sweepPhotos();
  renderAll();
  toast('Reset to defaults');
}

// Enter in any settings field saves them all, the zine's name included.
function saveNameFields() {
  var zn = document.getElementById('zinename');
  var was = state.zine;
  if (zn && zn.value.trim()) state.zine = zn.value.trim().slice(0, 40);
  var cover = pressState().panels[0];
  if (state.zine !== was && cover && (!cover.h || cover.h === was)) cover.h = state.zine;
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
  if (!confirm('Clear everything on this device \u2014 scraps, pieces and every published issue \u2014 and start blank?')) return;
  forgetUndo();
  state = normalize({ cycle: { no: '01', bell: Date.now() + 6048e5, editor: people[0].id },
    address: state.address, zine: state.zine });
  saveState();
  sweepPhotos();
  renderAll();
  toast('Empty. The first issue is yours alone.');
}
