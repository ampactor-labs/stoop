// ---------- photos ----------
// Where they are kept, how they get in, and how one lands on a page. A
// photograph in this app exists in order to end up on paper.

// ---------- photo store ----------
// Photos live in IndexedDB (localStorage caps out around 5 MB); the state
// above holds only their ids. Everything is dithered to 1-bit on intake, so
// a full-page photo is tens of kilobytes and prints on any copier.
var PHOTO_DB = 'stoop_photos';
var PHOTO_STORE = 'photos';
// Beside the photographs, on this device only and never in a file: each
// one's greyscale original, and how it was screened from it.
var META_STORE = 'meta';
var MASTER_STORE = 'masters';
var photoCache = {};
var photoMeta = {};

function openPhotoDb() {
  return new Promise(function (resolve, reject) {
    if (!window.indexedDB) { reject(new Error('no indexeddb')); return; }
    var req = indexedDB.open(PHOTO_DB, 2);
    req.onupgradeneeded = function () {
      [PHOTO_STORE, META_STORE, MASTER_STORE].forEach(function (name) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      });
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function photoTx(mode, fn, store) {
  return openPhotoDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(store || PHOTO_STORE, mode);
      var req = fn(tx.objectStore(store || PHOTO_STORE));
      tx.oncomplete = function () { resolve(req && req.result); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

function photoPut(id, dataUrl) {
  photoCache[id] = dataUrl;
  return photoTx('readwrite', function (s) { return s.put(dataUrl, id); })
    .catch(function () { toast('Photo kept in memory only — storage unavailable'); });
}
function photoDel(id) {
  delete photoCache[id];
  return photoTx('readwrite', function (s) { return s.delete(id); }).catch(function () {});
}
function photoLoadAll() {
  return openPhotoDb().then(function (db) {
    return new Promise(function (resolve) {
      var tx = db.transaction(PHOTO_STORE, 'readonly');
      var store = tx.objectStore(PHOTO_STORE);
      var keys = store.getAllKeys();
      var vals = store.getAll();
      tx.oncomplete = function () {
        (keys.result || []).forEach(function (k, i) { photoCache[k] = vals.result[i]; });
        resolve();
      };
      tx.onerror = function () { resolve(); };
    });
  }).then(function () {
    return photoTx('readonly', function (s) { return s.getAllKeys(); }, META_STORE).then(function (keys) {
      return photoTx('readonly', function (s) { return s.getAll(); }, META_STORE).then(function (vals) {
        (keys || []).forEach(function (k, i) { photoMeta[k] = vals[i]; });
      });
    });
  }).catch(function () {});
}

// Drop photo blobs no entry or zine panel points at any more.
function collectPhotoRefs() {
  var live = {};
  function keep(p) {
    if (!p) return;
    if (p.photo) live[p.photo] = 1;
    (p.els || []).forEach(function (e) { if (e && e.photo) live[e.photo] = 1; });
  }
  state.logs.forEach(keep);
  state.pieces.forEach(keep);
  if (state.press && state.press.panels) state.press.panels.forEach(keep);
  // Set-aside pages and undo history can still come back.
  if (state.press && state.press.spare) state.press.spare.forEach(keep);
  (pasteUndo || []).concat(pasteRedo || []).forEach(function (snap) {
    String(snap).replace(/"photo":"([^"]+)"/g, function (m, id) { live[id] = 1; return m; });
  });
  // A back issue is the archive. Sweeping a photo out from under a published
  // issue would rewrite history, so every shelved panel pins its photo.
  state.issues.forEach(function (iss) {
    (iss.panels || []).forEach(keep);
    (iss.pieces || []).forEach(keep);
  });
  return live;
}
// An original goes when no photograph screened from it is left.
function sweepPhotos() {
  var live = collectPhotoRefs();
  Object.keys(photoCache).forEach(function (id) { if (!live[id]) photoDel(id); });
  var roots = {};
  Object.keys(photoMeta).forEach(function (id) {
    if (!live[id]) {
      delete photoMeta[id];
      photoTx('readwrite', function (s) { return s.delete(id); }, META_STORE).catch(function () {});
    } else {
      roots[photoMeta[id].root] = 1;
    }
  });
  photoTx('readonly', function (s) { return s.getAllKeys(); }, MASTER_STORE).then(function (keys) {
    (keys || []).forEach(function (k) {
      if (!roots[k]) photoTx('readwrite', function (s) { return s.delete(k); }, MASTER_STORE).catch(function () {});
    });
  }).catch(function () {});
}


// ---------- the photo strip ----------
// Every photograph the scene has, as thumbs above the pages. One click glues
// one to the page last touched, as a cutting; drag it where it goes. There is
// nothing to arm and no second click, because a photograph on the strip is
// already the thing you want on the page.
function renderTray() {
  var tray = document.getElementById('phototray');
  if (!tray) return;
  var ids = state.logs.slice().sort(function (x, y) { return y.ts - x.ts; })
    .filter(function (l) { return l.photo && photoCache[l.photo]; })
    .map(function (l) { return l.photo; });
  Object.keys(photoCache).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
  tray.innerHTML = ids.map(function (id) {
    return '<img class="tray-photo" data-traypic="' + esc(id) + '" src="' + esc(photoCache[id]) +
      '" alt="" title="Glue this to the page">';
  }).join('');
}

function placeFromTray(id) {
  if (!photoCache[id]) return;
  addEl(pastePage, 'photo', { photo: id });
  renderPress();
  toast('Glued to page ' + pastePage + ' \u2014 drag it where it goes');
}
