// ---------- a PDF, written by hand ----------
// A browser print dialog decides margins, scale and paper somewhere the press
// cannot see, and a sheet that comes out at 94% does not fold. A PDF fixes all
// three, and is also what a copy shop will accept.
//
// Written rather than fetched, per the zero-external-requests law. Only what
// this press puts on paper is supported: a few of the standard fourteen
// fonts, which need no embedding, the press's own two faces, and photographs
// in colour or in the two tones of a photocopy.

var PT_PER_PX = 0.75;     // CSS pixels at 96dpi into PDF points at 72dpi
var PT_PER_IN = 72;

// The standard fonts speak WinAnsi. Anything outside it becomes a character
// that prints rather than a mystery box.
var PDF_SUBS = {
  '\u2014': '\x97', '\u2013': '\x96', '\u2018': '\x91', '\u2019': '\x92',
  '\u201c': '\x93', '\u201d': '\x94', '\u2022': '\x95', '\u2026': '\x85',
  '\u2116': 'No.', '\u00b7': '-', '\u2605': '*', '\u2715': 'x',
  '\u00a0': ' ', '\u2713': 'v'
};

function pdfSafe(s) {
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (PDF_SUBS[ch]) { out += PDF_SUBS[ch]; continue; }
    var code = s.charCodeAt(i);
    if (code === 9) { out += '    '; continue; }
    if (code < 32 || code === 127 || (code > 128 && code < 161) || code > 255) { out += code < 32 ? ' ' : '?'; continue; }
    out += ch;
  }
  return out;
}

// The page's own face carries № at 128, where WinAnsi keeps a euro the
// subset does not; a standard face spells it out through PDF_SUBS.
function faceText(face, text) {
  return face && face.face && face.face.glyphOf(0x2116) ? String(text).replace(/\u2116/g, '\x80') : String(text);
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

// Helvetica and Times-Roman, the plain faces of the sans and serif voices,
// from their standard metrics; the screen sets them in Arial and Times New
// Roman, which were drawn to the same widths.
var HELV_W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
var TIMES_W = [250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541];

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
// A photograph kept as JPEG goes into the PDF as the same bytes: a PDF
// reader decodes JPEG itself, so the colour on paper is the colour on screen
// with nothing re-encoded on the way. Anything else is drawn and read back.
// Two tones pack eight to a byte, the same black and white the photocopier
// will make, as a stencil the ink is poured through; colour goes in as red, green and blue, with its transparency
// beside it as a mask, so a cut-out stays cut out on paper too.
function deflate(bytes) {
  if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
  try {
    var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  } catch (e) { return Promise.resolve(null); }
}

function rasterOf(dataUrl) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight;
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve({ w: w, h: h, d: ctx.getImageData(0, 0, w, h).data });
    };
    img.onerror = function () { resolve(null); };
    img.src = dataUrl;
  });
}

function twoTone(d) {
  for (var i = 0; i < d.length; i += 4) {
    var v = d[i];
    if ((v !== 0 && v !== 255) || d[i + 1] !== v || d[i + 2] !== v || d[i + 3] !== 255) return false;
  }
  return true;
}

function packBitmap(r, gen) {
  var w = r.w, h = r.h, d = r.d;
  var rowBytes = Math.ceil(w / 8);
  var out = new Uint8Array(rowBytes * h);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      // 1 is white in DeviceGray.
      if (d[(y * w + x) * 4] >= 128) out[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  // A copy of a copy: dust lands as black, thin things drop out as white,
  // from a fixed seed so every print of the issue wears the same marks.
  if (gen) {
    var flips = Math.floor(w * h * gen * 0.004);
    for (var k = 0; k < flips; k++) {
      var hr = hash32('dust' + k);
      var px = hr % w, py = (hr >>> 12) % h;
      var byteAt = py * rowBytes + (px >> 3), bit = 0x80 >> (px & 7);
      if ((hr >>> 28) & 1) out[byteAt] &= ~bit; else out[byteAt] |= bit;
    }
  }
  return out;
}

function pdfImageStream(doc, head, bytes) {
  return deflate(bytes).then(function (packed) {
    return doc.stream(head + (packed ? '/Filter/FlateDecode' : ''), packed || bytes);
  });
}

function pdfAddColour(doc, r) {
  var n = r.w * r.h, d = r.d;
  var rgb = new Uint8Array(n * 3), alpha = new Uint8Array(n), clear = false;
  for (var i = 0; i < n; i++) {
    rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2];
    alpha[i] = d[i * 4 + 3];
    if (alpha[i] < 255) clear = true;
  }
  var size = '/Type/XObject/Subtype/Image/Width ' + r.w + '/Height ' + r.h + '/BitsPerComponent 8';
  var mask = clear ? pdfImageStream(doc, size + '/ColorSpace/DeviceGray', alpha) : Promise.resolve(0);
  return mask.then(function (m) {
    return pdfImageStream(doc, size + '/ColorSpace/DeviceRGB' + (m ? '/SMask ' + m + ' 0 R' : ''), rgb);
  });
}

// For a riso's black drum a colour photograph goes as one grey channel,
// the luminance a drum would print, with its transparency beside it.
function pdfAddGrey(doc, r) {
  var n = r.w * r.h, d = r.d;
  var grey = new Uint8Array(n), alpha = new Uint8Array(n), clear = false;
  for (var i = 0; i < n; i++) {
    grey[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
    alpha[i] = d[i * 4 + 3];
    if (alpha[i] < 255) clear = true;
  }
  var size = '/Type/XObject/Subtype/Image/Width ' + r.w + '/Height ' + r.h + '/BitsPerComponent 8/ColorSpace/DeviceGray';
  var mask = clear ? pdfImageStream(doc, size, alpha) : Promise.resolve(0);
  return mask.then(function (m) { return pdfImageStream(doc, size + (m ? '/SMask ' + m + ' 0 R' : ''), grey); });
}

function pdfAddJpeg(doc, dataUrl) {
  var info = imageInfo(dataUrl);
  if (!info || !info.w) return null;
  var space = info.comps === 1 ? '/DeviceGray' : info.comps === 4 ? '/DeviceCMYK/Decode[1 0 1 0 1 0 1 0]' : '/DeviceRGB';
  var num = doc.stream('/Type/XObject/Subtype/Image/Width ' + info.w + '/Height ' + info.h +
    '/ColorSpace' + space + '/BitsPerComponent 8/Filter/DCTDecode', b64Bytes(dataUrl));
  return { num: num, w: info.w, h: info.h };
}

// Drawing an image into the unit square its cm has placed. A stencil is
// laid over white, because a cutting is opaque paper, then poured in its ink.
function pdfImageOps(pic, ink) {
  return (pic.mask ? '1 g 0 0 1 1 re f ' + (ink || '0 g ') : '') + '/Im' + pic.num + ' Do';
}

function pdfAddImage(doc, dataUrl, gen, grey) {
  var jpeg = /^data:image\/jpeg;/.test(dataUrl || '');
  if (jpeg && (!grey || (imageInfo(dataUrl) || {}).comps === 1)) return Promise.resolve(pdfAddJpeg(doc, dataUrl));
  return rasterOf(dataUrl).then(function (r) {
    if (!r) return null;
    // Two tones ride as a stencil: black is where the ink goes, in whatever
    // ink is set when it is drawn, so one photograph can print in any drum.
    var mask = twoTone(r.d);
    var made = mask
      ? pdfImageStream(doc, '/Type/XObject/Subtype/Image/Width ' + r.w + '/Height ' + r.h +
          '/ImageMask true/BitsPerComponent 1', packBitmap(r, gen))
      : (grey ? pdfAddGrey(doc, r) : pdfAddColour(doc, r));
    return made.then(function (num) { return { num: num, w: r.w, h: r.h, mask: mask }; });
  });
}
