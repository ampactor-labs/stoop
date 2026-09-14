// ---------- photos ----------
// Where they are kept, how they get in, and how one lands on a page. A
// photograph in this app exists in order to end up on paper.

// ---------- photo store ----------
// Photos live in IndexedDB (localStorage caps out around 5 MB); the state
// above holds only their ids. Everything is dithered to 1-bit on intake, so
// a full-page photo is tens of kilobytes and prints on any copier.
var PHOTO_DB = 'stoop_photos';
var PHOTO_STORE = 'photos';
var photoCache = {};

function openPhotoDb() {
  return new Promise(function (resolve, reject) {
    if (!window.indexedDB) { reject(new Error('no indexeddb')); return; }
    var req = indexedDB.open(PHOTO_DB, 1);
    req.onupgradeneeded = function () {
      if (!req.result.objectStoreNames.contains(PHOTO_STORE)) req.result.createObjectStore(PHOTO_STORE);
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function photoTx(mode, fn) {
  return openPhotoDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(PHOTO_STORE, mode);
      var req = fn(tx.objectStore(PHOTO_STORE));
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
  }).catch(function () {});
}

// Drop photo blobs no entry or zine panel points at any more.
function collectPhotoRefs() {
  var live = {};
  function keep(p) { if (p && p.photo) live[p.photo] = 1; }
  state.logs.forEach(keep);
  state.pieces.forEach(keep);
  if (state.press && state.press.panels) state.press.panels.forEach(keep);
  // A back issue is the archive. Sweeping a photo out from under a published
  // issue would rewrite history, so every shelved panel pins its photo.
  state.issues.forEach(function (iss) {
    (iss.panels || []).forEach(keep);
    (iss.pieces || []).forEach(keep);
  });
  return live;
}
function sweepPhotos() {
  var live = collectPhotoRefs();
  Object.keys(photoCache).forEach(function (id) { if (!live[id]) photoDel(id); });
}


// ---------- the intake ----------
// DESIGN.md: "images ship dithered (1-bit and riso-grain, which is also the
// print bridge)". One pipeline serves both ends of that sentence: the screen
// gets the scene's aesthetic, and the printer gets pure black and white, which
// is the only thing a photocopier can honestly reproduce anyway.
var PHOTO_MAX_EDGE = 1000;
var PHOTO_CONTRAST = 1.15;

function readImage(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('not an image')); };
      img.src = reader.result;
    };
    reader.onerror = function () { reject(reader.error); };
    reader.readAsDataURL(file);
  });
}

// Floyd–Steinberg: threshold each pixel, push the error to the neighbours that
// have not been decided yet. Grain instead of banding, and it survives a copier.
function ditherToBitmap(img) {
  var scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.width, img.height));
  var w = Math.max(1, Math.round(img.width * scale));
  var h = Math.max(1, Math.round(img.height * scale));

  var canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  var imageData = ctx.getImageData(0, 0, w, h);
  var d = imageData.data;
  var gray = new Float32Array(w * h);

  for (var i = 0; i < w * h; i++) {
    var lum = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    gray[i] = Math.max(0, Math.min(255, (lum - 128) * PHOTO_CONTRAST + 128));
  }

  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var idx = y * w + x;
      var old = gray[idx];
      var next = old < 128 ? 0 : 255;
      var err = old - next;
      gray[idx] = next;
      if (x + 1 < w) gray[idx + 1] += err * 7 / 16;
      if (y + 1 < h) {
        if (x > 0) gray[idx + w - 1] += err * 3 / 16;
        gray[idx + w] += err * 5 / 16;
        if (x + 1 < w) gray[idx + w + 1] += err * 1 / 16;
      }
    }
  }

  for (var p = 0; p < w * h; p++) {
    var v = gray[p] < 128 ? 0 : 255;
    d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = v;
    d[p * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

// Returns the new photo ids, in the order the files were chosen.
function intakePhotos(fileList) {
  var files = Array.prototype.slice.call(fileList).filter(function (f) {
    return /^image\//.test(f.type);
  });
  if (!files.length) return Promise.resolve([]);
  toast(files.length > 1 ? 'Dithering ' + files.length + ' photos…' : 'Dithering photo…');

  return files.reduce(function (chain, file) {
    return chain.then(function (ids) {
      return readImage(file)
        .then(function (img) {
          var id = uid('ph');
          return photoPut(id, ditherToBitmap(img)).then(function () { return ids.concat(id); });
        })
        .catch(function () { toast('Skipped a file that is not an image'); return ids; });
    });
  }, Promise.resolve([]));
}

// ---------- the photo tray ----------
function renderTray() {
  var tray = document.getElementById('phototray');
  if (!tray) return;
  var ids = state.logs.slice().sort(function (x, y) { return y.ts - x.ts; })
    .filter(function (l) { return l.photo && photoCache[l.photo]; })
    .map(function (l) { return l.photo; });

  if (!ids.length) {
    tray.innerHTML = '<span class="sub">No photos yet. Add some from the log, then drop them into panels here.</span>';
    return;
  }
  tray.innerHTML = ids.map(function (id) {
    return '<img class="tray-photo' + (armedPhoto === id ? ' armed' : '') +
      '" data-traypic="' + esc(id) + '" src="' + esc(photoCache[id]) + '" alt="">';
  }).join('');
}

function armPhoto(id) {
  armedPhoto = armedPhoto === id ? null : id;
  renderTray();
  var hint = document.getElementById('trayhint');
  if (hint) {
    hint.textContent = armedPhoto
      ? 'Photo armed — now click the panel you want it on.'
      : 'Click a photo to arm it, then click a panel to place it.';
    hint.classList.toggle('on', !!armedPhoto);
  }
}

function placePhoto(page) {
  if (!armedPhoto) return false;
  var ps = pressState();
  if (!ps.panels[page - 1]) return false;
  ps.panels[page - 1].photo = armedPhoto;
  armPhoto(null);
  savePress();
  renderPress();
  toast('Placed photo on p.' + page);
  return true;
}
