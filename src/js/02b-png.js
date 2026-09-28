// ---------- what a picture is, from its first bytes ----------
// A page lays out around a photograph before the browser has decoded it, so
// its size is read from the file's own header; measuring a page for a piece
// to run on depends on the photograph already taking its room. The PDF
// writer reads the same header to know what it is embedding.
var sizeSeen = new Map();

function b64Bytes(url, chars) {
  var at = url.indexOf(',') + 1;
  var s = atob(chars ? url.slice(at, at + chars) : url.slice(at));
  var out = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// The frame header of a JPEG, found by walking its segments; a phone's
// JPEG can carry tens of kilobytes of notes before it.
function jpegFrame(b) {
  var i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    var m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { w: (b[i + 7] << 8) | b[i + 8], h: (b[i + 5] << 8) | b[i + 6], comps: b[i + 9] };
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

function imageInfo(url) {
  if (!url || url.slice(0, 5) !== 'data:') return null;
  if (sizeSeen.has(url)) return sizeSeen.get(url);
  var info = null;
  try {
    if (/^data:image\/png;base64,/.test(url)) {
      var p = b64Bytes(url, 44);
      var at = function (i) { return ((p[i] << 24) | (p[i + 1] << 16) | (p[i + 2] << 8) | p[i + 3]) >>> 0; };
      info = { type: 'png', w: at(16), h: at(20), depth: p[24], colour: p[25] };
    } else if (/^data:image\/jpeg;base64,/.test(url)) {
      var f = jpegFrame(b64Bytes(url, 4096)) || jpegFrame(b64Bytes(url));
      if (f) info = { type: 'jpeg', w: f.w, h: f.h, comps: f.comps };
    }
  } catch (e) { info = null; }
  if (sizeSeen.size > 400) sizeSeen.clear();
  sizeSeen.set(url, info);
  return info;
}

function imageSize(url) {
  var i = imageInfo(url);
  return i && i.w && i.h ? { w: i.w, h: i.h } : null;
}

// ---------- storing two tones in two tones ----------
// A screen leaves exactly two values in the image. The browser's own encoder
// does not care: toDataURL writes whatever the canvas holds, which is 32-bit
// RGBA, five times the size of the black and white it actually contains. So
// a screened photograph is written here, at the one bit per pixel it is made
// of, the same bits pdfAddImage packs for the printer.
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
