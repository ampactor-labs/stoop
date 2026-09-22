// ---------- the press's face, on paper ----------
// The page sets its headlines in the one typeface it ships, and the paper
// embeds those same bytes, so the two cannot differ. This reads enough of a
// TrueType file to describe it to a PDF — units per em, ascent and descent,
// the bounding box, every glyph's advance, and the map from character to
// glyph — and nothing else. The bytes come back out of the stylesheet the
// build put them in, so the font is stored once.
var pressFace = null;

function fontBytesFromPage() {
  var css = Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
  var m = /font-family:Anton;[^}]*url\(data:font\/ttf;base64,([^)]+)\)/.exec(css);
  if (!m) return null;
  var bin = atob(m[1]);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// WinAnsi's high half, for the punctuation the subset carries, plus № in
// the euro's seat at 128 (declared to the PDF as a Differences entry).
// Everything else in 128–159 has no glyph here and measures as notdef.
var WINANSI_HIGH = { 0x80: 0x2116, 0x85: 0x2026, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014 };
function winAnsiToUnicode(code) {
  return WINANSI_HIGH[code] || (code < 128 || code >= 160 ? code : 0);
}

function parseTrueType(bytes) {
  var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  var tables = {};
  for (var i = 0, n = dv.getUint16(4); i < n; i++) {
    var at = 12 + i * 16;
    tables[String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3])] =
      { off: dv.getUint32(at + 8), len: dv.getUint32(at + 12) };
  }
  var head = tables.head.off, hhea = tables.hhea.off, hmtx = tables.hmtx.off;
  var numH = dv.getUint16(hhea + 34);
  var cmap = tables.cmap.off, sub = 0;
  for (var j = 0, m = dv.getUint16(cmap + 2); j < m; j++) {
    var rec = cmap + 4 + j * 8;
    if (dv.getUint16(rec) === 3 && dv.getUint16(rec + 2) === 1) sub = cmap + dv.getUint32(rec + 4);
  }
  // cmap format 4: segments of contiguous codes, each with a delta or a
  // range into the glyph array.
  var glyphOf = function () { return 0; };
  if (sub && dv.getUint16(sub) === 4) {
    var segX2 = dv.getUint16(sub + 6), seg = segX2 / 2;
    var ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    glyphOf = function (c) {
      for (var s = 0; s < seg; s++) {
        if (c > dv.getUint16(ends + s * 2)) continue;
        var start = dv.getUint16(starts + s * 2);
        if (c < start) return 0;
        var delta = dv.getInt16(deltas + s * 2), ro = dv.getUint16(ranges + s * 2);
        if (!ro) return (c + delta) & 0xffff;
        var g = dv.getUint16(ranges + s * 2 + ro + (c - start) * 2);
        return g ? (g + delta) & 0xffff : 0;
      }
      return 0;
    };
  }
  var os2 = tables['OS/2'];
  var f = {
    bytes: bytes,
    upm: dv.getUint16(head + 18),
    bbox: [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)],
    ascent: dv.getInt16(hhea + 4),
    descent: dv.getInt16(hhea + 6),
    capHeight: os2 && os2.len >= 90 ? dv.getInt16(os2.off + 88) : 0,
    glyphOf: glyphOf
  };
  f.advance = function (g) { return dv.getUint16(hmtx + Math.min(g, numH - 1) * 4); };
  if (!f.capHeight) f.capHeight = Math.round(f.ascent * 0.7);
  // Advance of every WinAnsi code from 32 to 255, in thousandths of an em:
  // the PDF's /Widths array and the wrapper's width table, from one source.
  f.widths = [];
  for (var c = 32; c <= 255; c++) f.widths.push(Math.round(f.advance(f.glyphOf(winAnsiToUnicode(c))) * 1000 / f.upm));
  return f;
}

// The face, parsed once. Null on a page that carries none (an issue file
// written before the press had one), in which case Helvetica-Bold stands in.
function pressFaceLoaded() {
  if (pressFace === null) {
    var bytes = fontBytesFromPage();
    pressFace = bytes ? parseTrueType(bytes) : false;
  }
  return pressFace || null;
}

// Embed as a simple TrueType font: WinAnsi codes look up glyphs through the
// font's own (3,1) cmap. Resolves to the font object's number.
function pdfEmbedFace(doc, f) {
  var k = 1000 / f.upm;
  return deflate(f.bytes).then(function (packed) {
    var file = doc.stream('/Length1 ' + f.bytes.length + (packed ? '/Filter/FlateDecode' : ''), packed || f.bytes);
    var desc = doc.obj(['<</Type/FontDescriptor/FontName/STOOPP+Anton/Flags 32/FontBBox[' +
      f.bbox.map(function (v) { return Math.round(v * k); }).join(' ') + ']/ItalicAngle 0/Ascent ' +
      Math.round(f.ascent * k) + '/Descent ' + Math.round(f.descent * k) + '/CapHeight ' +
      Math.round(f.capHeight * k) + '/StemV 140/FontFile2 ' + file + ' 0 R>>']);
    return doc.obj(['<</Type/Font/Subtype/TrueType/BaseFont/STOOPP+Anton/FirstChar 32/LastChar 255/Widths[' +
      f.widths.join(' ') + ']/Encoding<</Type/Encoding/BaseEncoding/WinAnsiEncoding/Differences[128/numero]>>' +
      '/FontDescriptor ' + desc + ' 0 R>>']);
  });
}

// Where the browser puts the first baseline: the face's content area is
// centred in the line box, and the baseline sits an ascent below its top.
function faceBaseline(f, size, lead) {
  var content = (f.ascent - f.descent) / f.upm;
  return size * ((lead / size - content) / 2 + f.ascent / f.upm);
}
