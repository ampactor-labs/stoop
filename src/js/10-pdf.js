// ---------- a PDF, written by hand ----------
// A browser print dialog decides margins, scale and paper somewhere the press
// cannot see, and a sheet that comes out at 94% does not fold. A PDF fixes all
// three, and is also what a copy shop will accept.
//
// Written rather than fetched, per the zero-external-requests law. Only what
// this press puts on paper is supported: two of the standard fourteen fonts,
// which need no embedding, and 1-bit images, which are the only kind the
// intake produces.

var PT_PER_PX = 0.75;     // CSS pixels at 96dpi into PDF points at 72dpi
var PT_PER_IN = 72;

// The standard fonts speak WinAnsi. Anything outside it becomes a character
// that prints rather than a mystery box.
var PDF_SUBS = {
  '—': '-', '–': '-', '‘': "'", '’': "'",
  '“': '"', '”': '"', '№': 'No.', '·': '-',
  '•': '*', '★': '*', '✕': 'x', '…': '...',
  ' ': ' ', '✓': 'v'
};

function pdfSafe(s) {
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (PDF_SUBS[ch]) { out += PDF_SUBS[ch]; continue; }
    var code = s.charCodeAt(i);
    if (code === 9) { out += '    '; continue; }
    if (code < 32 || (code > 126 && code < 161) || code > 255) { out += code < 32 ? ' ' : '?'; continue; }
    out += ch;
  }
  return out;
}

function pdfEsc(s) {
  return pdfSafe(s).replace(/([\\()])/g, '\\$1');
}

function pdfBytes(str) {
  var out = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

// ---------- metrics ----------
// Courier is 600/1000 for every glyph, which is why the body text wraps
// exactly. Helvetica-Bold is not, so it carries a table; headings are short
// and shrink to fit rather than spilling.
var COURIER_W = 0.6;
var HELV_BOLD_W = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975,
  722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778,
  722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611,
  556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556,
  333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

function helvBoldWidth(text, size) {
  var total = 0;
  var s = pdfSafe(text);
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    total += (c >= 32 && c <= 126) ? HELV_BOLD_W[c - 32] : 556;
  }
  return total * size / 1000;
}

// Monospace wrapping, newlines respected: the body is typed, not flowed.
function wrapMono(text, size, width) {
  var cols = Math.max(4, Math.floor(width / (size * COURIER_W)));
  var lines = [];
  String(text || '').split('\n').forEach(function (para) {
    if (!para.length) { lines.push(''); return; }
    var line = '';
    para.split(/(\s+)/).forEach(function (bit) {
      if (!bit.length) return;
      if ((line + bit).length <= cols) { line += bit; return; }
      if (line.trim().length) lines.push(line.replace(/\s+$/, ''));
      while (bit.length > cols) { lines.push(bit.slice(0, cols)); bit = bit.slice(cols); }
      line = /^\s+$/.test(bit) ? '' : bit;
    });
    lines.push(line.replace(/\s+$/, ''));
  });
  return lines;
}

// ---------- the document ----------
function pdfDoc() {
  var objects = [];
  return {
    obj: function (chunks) { objects.push(chunks); return objects.length; },
    // A page tree has to name its kids and the kids have to name the tree, so
    // one object is reserved first and filled in once the pages exist.
    replace: function (num, chunks) { objects[num - 1] = chunks; },
    stream: function (dict, data) {
      return this.obj(['<<' + dict + '/Length ' + data.length + '>>\nstream\n', data, '\nendstream']);
    },
    // Offsets are counted in bytes as they are written, because an xref table
    // that disagrees with the file by one byte is a file no reader will open.
    build: function (root) {
      var parts = [], at = 0, offsets = [];
      function push(chunk) {
        var b = typeof chunk === 'string' ? pdfBytes(chunk) : chunk;
        parts.push(b);
        at += b.length;
      }
      push('%PDF-1.4\n%âãÏÓ\n');
      objects.forEach(function (chunks, i) {
        offsets[i + 1] = at;
        push((i + 1) + ' 0 obj\n');
        chunks.forEach(push);
        push('\nendobj\n');
      });
      var xrefAt = at;
      var count = objects.length + 1;
      var xref = 'xref\n0 ' + count + '\n0000000000 65535 f \n';
      for (var i = 1; i < count; i++) {
        xref += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
      }
      push(xref);
      push('trailer\n<</Size ' + count + '/Root ' + root + ' 0 R>>\nstartxref\n' + xrefAt + '\n%%EOF\n');
      return new Blob(parts, { type: 'application/pdf' });
    }
  };
}

// ---------- images ----------
// Everything this press prints is already 1-bit, so the samples pack eight to
// a byte and the PDF carries the same black and white the photocopier will.
function deflate(bytes) {
  if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
  try {
    var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  } catch (e) { return Promise.resolve(null); }
}

function packBitmap(dataUrl, gen) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight;
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var d = ctx.getImageData(0, 0, w, h).data;
      var rowBytes = Math.ceil(w / 8);
      var out = new Uint8Array(rowBytes * h);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          // 1 is white in DeviceGray; the sample byte is the red channel
          // because the intake already collapsed the image to grey.
          if (d[(y * w + x) * 4] >= 128) out[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
      // A copy of a copy: dust lands as black, thin things drop out as white,
      // from a fixed seed so every print of the issue wears the same marks.
      if (gen) {
        var flips = Math.floor(w * h * gen * 0.004);
        for (var k = 0; k < flips; k++) {
          var r = hash32('dust' + k);
          var px = r % w, py = (r >>> 12) % h;
          var byteAt = py * rowBytes + (px >> 3), bit = 0x80 >> (px & 7);
          if ((r >>> 28) & 1) out[byteAt] &= ~bit; else out[byteAt] |= bit;
        }
      }
      resolve({ w: w, h: h, bits: out });
    };
    img.onerror = function () { resolve(null); };
    img.src = dataUrl;
  });
}

function pdfAddImage(doc, dataUrl, gen) {
  return packBitmap(dataUrl, gen).then(function (bm) {
    if (!bm) return null;
    return deflate(bm.bits).then(function (packed) {
      var dict = '/Type/XObject/Subtype/Image/Width ' + bm.w + '/Height ' + bm.h +
        '/ColorSpace/DeviceGray/BitsPerComponent 1' + (packed ? '/Filter/FlateDecode' : '');
      var num = doc.stream(dict, packed || bm.bits);
      return { num: num, w: bm.w, h: bm.h };
    });
  });
}
