// ---------- the intake, and the look ----------
// A photograph goes on the page as it was taken: in colour, at print
// resolution. The camera's own file never does. It is redrawn, which leaves
// behind the location and everything else a phone writes into a picture, and
// the redrawn original stays on this device. Every other look is made from
// that original, so nothing is lost by trying one: lighter or darker, black
// and white, or screened to pure black and white the way a photocopier would,
// as grain, as halftone dots, or as hard contrast.
//
// 2400 pixels is the tallest page stoop makes, eight and a half inches of a
// half-letter booklet, at about 280 to the inch: past what a copier or a
// laser printer resolves in a photograph. The screens are made at 1000,
// because the grain is the point and finer grain is only grey.
var PHOTO_MAX_EDGE = 2400;
var SCREEN_MAX_EDGE = 1000;
var PHOTO_QUALITY = 0.9;
var PHOTO_CONTRAST = 1.15;
var LOOKS = ['colour', 'grey', 'grain', 'dots', 'hard'];
var LOOK_LABEL = { colour: 'COLOUR', grey: 'B&W', grain: 'GRAIN', dots: 'DOTS', hard: 'HARD' };

function isScreen(look) { return look === 'grain' || look === 'dots' || look === 'hard'; }

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

function canvasAt(img, edge, paper) {
  var scale = Math.min(1, edge / Math.max(img.width, img.height));
  var canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  var ctx = canvas.getContext('2d');
  if (paper) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas: canvas, ctx: ctx, w: canvas.width, h: canvas.height };
}

// A cut-out keeps its transparency, so a sticker laid over coloured paper or
// another photograph looks like a sticker; it is kept as PNG, which can say
// so. Everything else is a photograph and is kept as JPEG.
function hasClear(c) {
  var d = c.ctx.getImageData(0, 0, c.w, c.h).data;
  for (var i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

function encoded(c, clear) {
  return clear ? c.canvas.toDataURL('image/png') : c.canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
}

// Lighter and darker are a curve, not a shift: white stays paper and black
// stays ink, and what moves is everything between.
function toneCurve(exp) {
  var gamma = Math.pow(0.78, exp);
  var lut = new Uint8ClampedArray(256);
  for (var i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(i / 255, gamma));
  return lut;
}

function tonePhoto(img, exp, look) {
  var c = canvasAt(img, PHOTO_MAX_EDGE, false);
  var clear = hasClear(c);
  if (exp || look === 'grey') {
    var data = c.ctx.getImageData(0, 0, c.w, c.h);
    var d = data.data;
    var lut = toneCurve(exp);
    for (var i = 0; i < d.length; i += 4) {
      if (look === 'grey') {
        d[i] = d[i + 1] = d[i + 2] = lut[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])];
      } else {
        d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
      }
    }
    c.ctx.putImageData(data, 0, 0);
  }
  return encoded(c, clear);
}

// Greyscale for a screen, over paper: a clear pixel would otherwise read as
// black and a cut-out would come in as a blob.
function greyFrom(img) {
  var c = canvasAt(img, SCREEN_MAX_EDGE, true);
  var d = c.ctx.getImageData(0, 0, c.w, c.h).data;
  var g = new Float32Array(c.w * c.h);
  for (var i = 0; i < c.w * c.h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return { w: c.w, h: c.h, g: g };
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

// One look of an original. Colour as it came is the original itself, so
// going back to it costs nothing and loses nothing.
function lookOf(src, img, exp, look) {
  if (isScreen(look)) return screenPhoto(greyFrom(img), exp, look);
  if (look === 'colour' && !exp) return Promise.resolve(src);
  return Promise.resolve(tonePhoto(img, exp, look));
}

function keepMeta(id, meta) {
  photoMeta[id] = meta;
  return photoTx('readwrite', function (s) { return s.put(meta, id); }, META_STORE).catch(function () {});
}

// Returns the new photo ids, in the order the files were chosen.
function intakePhotos(fileList) {
  var files = Array.prototype.slice.call(fileList).filter(function (f) {
    return /^image\//.test(f.type);
  });
  if (!files.length) return Promise.resolve([]);
  toast(files.length > 1 ? 'Taking in ' + files.length + ' photos…' : 'Taking in the photo…');

  return files.reduce(function (chain, file) {
    return chain.then(function (ids) {
      return readImage(file)
        .then(function (img) {
          var id = uid('ph');
          var master = tonePhoto(img, 0, 'colour');
          return photoPut(id, master)
            .then(function () {
              photoTx('readwrite', function (s) { return s.put(master, id); }, MASTER_STORE).catch(function () {});
              return keepMeta(id, { root: id, exp: 0, style: 'colour' });
            })
            .then(function () { return ids.concat(id); });
        })
        .catch(function () { toast('Skipped a file that is not an image'); return ids; });
    });
  }, Promise.resolve([]));
}

// A new look of the same original is a new photograph with its own id, so an
// issue already on the shelf keeps the one it was printed with. The same
// settings twice give back the photograph already made.
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
  var src;
  return photoTx('readonly', function (s) { return s.get(meta.root); }, MASTER_STORE).then(function (got) {
    if (!got) throw new Error('its original is not on this device');
    src = got;
    return loadImage(src);
  }).then(function (img) {
    return lookOf(src, img, next.exp, next.style);
  }).then(function (url) {
    var id = uid('ph');
    return photoPut(id, url).then(function () { return keepMeta(id, next); }).then(function () { return id; });
  }).then(function (id) { screening = false; return id; }, function (e) { screening = false; throw e; });
}
