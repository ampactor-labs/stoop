// ---------- the intake, and the screen ----------
// DESIGN.md: "images ship dithered (1-bit and riso-grain, which is also the
// print bridge)". A photograph arrives, is kept on this device as a small
// greyscale original, and is screened to pure black and white from it: the
// only thing a photocopier can honestly reproduce. Keeping the original is
// what lets a dark phone photo be lightened later, or screened as halftone
// dots or hard photocopy contrast instead of grain, without the camera file.
var PHOTO_MAX_EDGE = 1000;
var PHOTO_CONTRAST = 1.15;
var SCREENS = ['grain', 'dots', 'hard'];
var SCREEN_LABEL = { grain: 'GRAIN', dots: 'DOTS', hard: 'HARD' };

function loadImage(src) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = function () { reject(new Error('not an image')); };
    img.src = src;
  });
}

function readImage(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { loadImage(reader.result).then(resolve, reject); };
    reader.onerror = function () { reject(reader.error); };
    reader.readAsDataURL(file);
  });
}

// Greyscale at the size it is kept, over paper: transparent pixels would
// otherwise read as black and a cut-out would come in as a blob.
function greyFrom(img) {
  var scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.width, img.height));
  var w = Math.max(1, Math.round(img.width * scale));
  var h = Math.max(1, Math.round(img.height * scale));
  var canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  var data = ctx.getImageData(0, 0, w, h);
  var d = data.data;
  var g = new Float32Array(w * h);
  for (var i = 0; i < w * h; i++) {
    g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g[i];
  }
  ctx.putImageData(data, 0, 0);
  return { w: w, h: h, g: g, canvas: canvas };
}

// Exposure is a step of a fifth of the way from grey to white or black.
// Grain is Floyd–Steinberg: each pixel's error pushed to the neighbours not
// yet decided. Dots is a halftone screen at forty-five degrees. Hard is the
// copier with the contrast all the way up.
function screenBits(grey, exp, style) {
  var w = grey.w, h = grey.h;
  var g = new Float32Array(w * h);
  for (var i = 0; i < w * h; i++) {
    g[i] = Math.max(0, Math.min(255, (grey.g[i] - 128) * PHOTO_CONTRAST + 128 + exp * 26));
  }
  var cell = Math.max(4, Math.round(Math.max(w, h) / 140));
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var idx = y * w + x;
      var old = g[idx];
      if (style === 'hard') { g[idx] = old < 128 ? 0 : 255; continue; }
      if (style === 'dots') {
        var u = (x + y) / (cell * 1.414), v = (x - y) / (cell * 1.414);
        var t = (Math.cos(u * 2 * Math.PI) + Math.cos(v * 2 * Math.PI) + 2) / 4 * 255;
        g[idx] = old > t ? 255 : 0;
        continue;
      }
      var next = old < 128 ? 0 : 255;
      var err = old - next;
      g[idx] = next;
      if (x + 1 < w) g[idx + 1] += err * 7 / 16;
      if (y + 1 < h) {
        if (x > 0) g[idx + w - 1] += err * 3 / 16;
        g[idx + w] += err * 5 / 16;
        if (x + 1 < w) g[idx + w + 1] += err * 1 / 16;
      }
    }
  }
  var rowBytes = Math.ceil(w / 8);
  var bits = new Uint8Array(rowBytes * h);
  for (var by = 0; by < h; by++) {
    for (var bx = 0; bx < w; bx++) {
      // 1 is white, matching greyscale PNG and the PDF's DeviceGray.
      if (g[by * w + bx] >= 128) bits[by * rowBytes + (bx >> 3)] |= 0x80 >> (bx & 7);
    }
  }
  return bits;
}

// Without a deflater the browser's own encoder stands in, at many times the
// size; the pixels are the same two tones either way.
function screenPhoto(grey, exp, style) {
  var bits = screenBits(grey, exp, style);
  return png1bit(grey.w, grey.h, bits).then(function (url) {
    if (url) return url;
    var c = document.createElement('canvas');
    c.width = grey.w;
    c.height = grey.h;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(grey.w, grey.h);
    var rowBytes = Math.ceil(grey.w / 8);
    for (var i = 0; i < grey.w * grey.h; i++) {
      var x = i % grey.w, y = (i / grey.w) | 0;
      var v = bits[y * rowBytes + (x >> 3)] & (0x80 >> (x & 7)) ? 255 : 0;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
}

function keepMeta(id, meta) {
  photoMeta[id] = meta;
  return photoTx('readwrite', function (s) { return s.put(meta, id); }, META_STORE).catch(function () {});
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
          var grey = greyFrom(img);
          var master = grey.canvas.toDataURL('image/jpeg', 0.85);
          return screenPhoto(grey, 0, 'grain')
            .then(function (url) { return photoPut(id, url); })
            .then(function () {
              photoTx('readwrite', function (s) { return s.put(master, id); }, MASTER_STORE).catch(function () {});
              return keepMeta(id, { root: id, exp: 0, style: 'grain' });
            })
            .then(function () { return ids.concat(id); });
        })
        .catch(function () { toast('Skipped a file that is not an image'); return ids; });
    });
  }, Promise.resolve([]));
}

// A new screening of the same original is a new photograph with its own id,
// so an issue already on the shelf keeps the one it was printed with. The
// same settings twice give back the photograph already made.
var screening = false;
function rescreen(oldId, change) {
  var meta = photoMeta[oldId];
  if (!meta || screening) return Promise.resolve(null);
  var next = { root: meta.root, exp: Math.max(-4, Math.min(4, meta.exp + (change.exp || 0))), style: change.style || meta.style };
  var have = Object.keys(photoMeta).filter(function (id) {
    var m = photoMeta[id];
    return m.root === next.root && m.exp === next.exp && m.style === next.style && photoCache[id];
  })[0];
  if (have) return Promise.resolve(have);
  screening = true;
  return photoTx('readonly', function (s) { return s.get(meta.root); }, MASTER_STORE).then(function (src) {
    if (!src) throw new Error('its original is not on this device');
    return loadImage(src);
  }).then(function (img) {
    return screenPhoto(greyFrom(img), next.exp, next.style);
  }).then(function (url) {
    var id = uid('ph');
    return photoPut(id, url).then(function () { return keepMeta(id, next); }).then(function () { return id; });
  }).then(function (id) { screening = false; return id; }, function (e) { screening = false; throw e; });
}
