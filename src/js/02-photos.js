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
  function keep(p) {
    if (!p) return;
    if (p.photo) live[p.photo] = 1;
    (p.els || []).forEach(function (e) { if (e && e.photo) live[e.photo] = 1; });
  }
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

  var rowBytes = Math.ceil(w / 8);
  var bits = new Uint8Array(rowBytes * h);
  for (var by = 0; by < h; by++) {
    for (var bx = 0; bx < w; bx++) {
      // 1 is white, matching greyscale PNG and the PDF's DeviceGray.
      if (d[(by * w + bx) * 4] >= 128) bits[by * rowBytes + (bx >> 3)] |= 0x80 >> (bx & 7);
    }
  }
  return png1bit(w, h, bits).then(function (url) {
    return url || canvas.toDataURL('image/png');
  });
}

// ---------- storing two tones in two tones ----------
// The dither leaves exactly two values in the image. The browser's own encoder
// does not care: toDataURL writes whatever the canvas holds, which is 32-bit
// RGBA, and a photograph comes out about five times the size of the black and
// white it actually contains. That surcharge is not paid once — it is paid
// again in every issue file the photograph rides in, and an issue file is the
// thing people hand to each other. So the intake writes the PNG itself, at the
// one bit per pixel the picture is made of. pdfAddImage has always packed the
// same bits this way for the printer; this is the screen's copy catching up.
var CRC_TABLE = (function () {
  var t = new Int32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(bytes) {
  var c = -1;
  for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  var out = new Uint8Array(12 + data.length);
  var view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (var i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function png1bit(w, h, bits) {
  var rowBytes = Math.ceil(w / 8);
  var raw = new Uint8Array((rowBytes + 1) * h);
  for (var y = 0; y < h; y++) {
    // Filter 0. The other four predict from neighbouring pixels, and dither
    // grain is exactly the signal nothing can predict; they cost bytes here.
    raw[y * (rowBytes + 1)] = 0;
    raw.set(bits.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  }
  return deflate(raw).then(function (z) {
    if (!z) return null;
    var ihdr = new Uint8Array(13);
    var v = new DataView(ihdr.buffer);
    v.setUint32(0, w);
    v.setUint32(4, h);
    ihdr[8] = 1;  // one bit per sample
    ihdr[9] = 0;  // greyscale, no palette to carry
    var parts = [
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', z),
      pngChunk('IEND', new Uint8Array(0))
    ];
    var file = new Uint8Array(parts.reduce(function (a, q) { return a + q.length; }, 0));
    var at = 0;
    parts.forEach(function (q) { file.set(q, at); at += q.length; });
    var s = '';
    for (var i = 0; i < file.length; i += 8192) {
      s += String.fromCharCode.apply(null, file.subarray(i, i + 8192));
    }
    return 'data:image/png;base64,' + btoa(s);
  }).catch(function () { return null; });
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
          return ditherToBitmap(img)
            .then(function (url) { return photoPut(id, url); })
            .then(function () { return ids.concat(id); });
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
