// ---------- a scene's own faces ----------
// A scene can add a typeface of its own. It is kept in the browser's store
// beside the photographs, added to the page as an @font-face rule in a
// style element of its own, and so rides in every issue file the way Anton
// and Knewave do; the PDF writer parses and embeds it through the same
// TrueType path. Each face is a voice, named from its name table. A face
// with PostScript outlines (most .otf) cannot be embedded here and is
// refused with a sentence saying why; a file that is not a face, or is cut
// short, fails closed. There is no ceiling on what a file weighs, so a
// heavy face is the scene's call, and the badge says what it costs.
var FONT_STORE = 'fonts';
var ownFaces = [];

function ownFace(voice) {
  if (typeof voice !== 'string' || voice.indexOf('face:') !== 0) return null;
  var id = voice.slice(5);
  return ownFaces.filter(function (f) { return f.id === id; })[0] || null;
}
function ownVoiceIds() { return ownFaces.map(function (f) { return 'face:' + f.id; }); }
function ownFaceLabel(voice) { var f = ownFace(voice); return f ? f.name.toUpperCase() : 'SANS'; }
function ownFaceStyle(voice) { var f = ownFace(voice); return f ? ";font-family:'" + f.name.replace(/['\"]/g, '') + "'" : ''; }

// The family name, from the name table's Windows record, or the file's.
function faceNameOf(bytes, fallback) {
  try {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (var i = 0, n = dv.getUint16(4); i < n; i++) {
      var at = 12 + i * 16;
      if (String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]) !== 'name') continue;
      var off = dv.getUint32(at + 8), count = dv.getUint16(off + 2), strings = off + dv.getUint16(off + 4);
      var best = '';
      for (var r = 0; r < count; r++) {
        var rec = off + 6 + r * 12;
        var nameId = dv.getUint16(rec + 6);
        if (dv.getUint16(rec) !== 3 || (nameId !== 1 && nameId !== 4)) continue;
        var len = dv.getUint16(rec + 8), so = strings + dv.getUint16(rec + 10), s = '';
        for (var k = 0; k + 1 < len; k += 2) s += String.fromCharCode(dv.getUint16(so + k));
        if (nameId === 1 || !best) best = s;
      }
      if (best) return best;
    }
  } catch (e) {}
  return String(fallback || 'Face').replace(/\.[a-z0-9]+$/i, '');
}

// A face's id comes from its bytes, so the same face has the same id on
// every device it reaches, and a cutting set in it on one is set in it on
// the next.
function faceId(bytes) {
  var h = 2166136261;
  for (var i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619) >>> 0; }
  return 'fc' + h.toString(36) + bytes.length.toString(36);
}

function cleanFaceName(s) {
  return String(s || '').replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Face';
}

function faceStyleRule(f) {
  var s = '';
  for (var i = 0; i < f.bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, f.bytes.subarray(i, i + 0x8000));
  return '@font-face{font-family:' + f.name + ';font-display:block;src:url(data:font/ttf;base64,' + btoa(s) + ') format("truetype")}';
}

function renderFaceStyle() {
  var st = document.getElementById('ownfaces');
  if (!st) {
    st = document.createElement('style');
    st.id = 'ownfaces';
    document.head.appendChild(st);
  }
  var want = ownFaces.map(faceStyleRule).join('\n');
  if (st.textContent !== want) st.textContent = want;
}

function renderFaces() {
  var box = document.getElementById('facelist');
  if (!box) return;
  box.innerHTML = ownFaces.length ? ownFaces.map(function (f) {
    return '<div class="sub-row"><span class="meta"><b style="font-family:&quot;' + esc(f.name) + '&quot;">' + esc(f.name) + '</b>' +
      '<small>' + Math.round(f.bytes.length / 1024) + ' KB · a voice on every cutting</small></span>' +
      '<button class="log-del" data-delface="' + esc(f.id) + '" title="Take the face out" aria-label="Remove this face">✕</button></div>';
  }).join('') : '<p class="hint">No faces of your own yet. Anton and Knewave are always here.</p>';
}

// Faces the page itself carries, for a press handed on: the file's style
// element is what the maker's scene had.
function facesFromPage() {
  var st = document.getElementById('ownfaces');
  if (!st) return [];
  var out = [];
  var re = /font-family:([^;]+);[^}]*url\(data:font\/ttf;base64,([^)]+)\)/g;
  var m;
  while ((m = re.exec(st.textContent))) {
    var bin = atob(m[2]);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    out.push({ id: faceId(bytes), name: cleanFaceName(m[1]), bytes: bytes });
  }
  return out;
}

function takeFace(rec) {
  try {
    rec.parsed = parseTrueType(rec.bytes);
    rec.parsed.name = rec.name;
    if (!ownFaces.some(function (f) { return f.id === rec.id; })) ownFaces.push(rec);
    return true;
  } catch (e) { return false; }
}

// Loaded before the first paint with the photographs, so a cutting set in a
// face of the scene's own is drawn in it from the start.
function faceLoadAll() {
  return openPhotoDb().then(function (db) {
    return new Promise(function (resolve) {
      var tx = db.transaction(FONT_STORE, 'readonly');
      var keys = tx.objectStore(FONT_STORE).getAllKeys();
      var vals = tx.objectStore(FONT_STORE).getAll();
      tx.oncomplete = function () {
        (keys.result || []).forEach(function (k, i) {
          var v = vals.result[i];
          if (v && v.bytes) takeFace({ id: String(k), name: cleanFaceName(v.name), bytes: new Uint8Array(v.bytes) });
        });
        resolve();
      };
      tx.onerror = function () { resolve(); };
    });
  }).catch(function () {}).then(function () {
    facesFromPage().forEach(function (f) {
      if (!ownFaces.some(function (o) { return o.id === f.id; })) takeFace(f);
    });
    renderFaceStyle();
    renderFaces();
  });
}

// ---------- taking one in ----------
function sfntKind(bytes) {
  var tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (tag === 'OTTO') return 'cff';
  if (tag === 'wOFF') return String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === 'OTTO' ? 'cff' : 'woff';
  if (tag === 'true' || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) return 'ttf';
  return '';
}

function addFaceFile(file) {
  return file.arrayBuffer().then(function (buf) {
    var bytes = new Uint8Array(buf);
    var kind = sfntKind(bytes);
    if (kind === 'cff') {
      toast('That face has PostScript outlines, which the press cannot put in a PDF. A TrueType .ttf, or a .woff of one, works.');
      return;
    }
    if (!kind) { toast('That is not a typeface the press can read. A TrueType .ttf, or a .woff of one, works.'); return; }
    return (kind === 'woff' ? woffToSfnt(bytes) : Promise.resolve(bytes)).then(function (sfnt) {
      var rec = { id: faceId(sfnt), name: cleanFaceName(faceNameOf(sfnt, file.name)), bytes: sfnt };
      if (ownFaces.some(function (f) { return f.id === rec.id; })) { toast(rec.name + ' is here already.'); return; }
      if (!takeFace(rec)) { toast('Could not read that face: its tables are not where a TrueType keeps them, so it was not taken in.'); return; }
      return photoTx('readwrite', function (s) { return s.put({ name: rec.name, bytes: rec.bytes.buffer }, rec.id); }, FONT_STORE)
        .catch(function () { toast('Face kept in memory only — storage unavailable'); })
        .then(function () {
          facesReady = null;
          renderFaceStyle();
          renderFaces();
          renderPress();
          toast(rec.name + ' is a voice now. It rides in every file and every PDF this press writes.');
        });
    }).catch(function () { toast('Could not read that face, so it was not taken in.'); });
  });
}

function removeFace(id) {
  ownFaces = ownFaces.filter(function (f) { return f.id !== id; });
  photoTx('readwrite', function (s) { return s.delete(id); }, FONT_STORE).catch(function () {});
  facesReady = null;
  renderFaceStyle();
  renderFaces();
  renderPress();
  toast('Face removed. Cuttings set in it fall back to the sans until it is added again.');
}

// ---------- on paper ----------
// Every face used on the pages, embedded once and given a font key of its
// own past the standard ones; the fragment goes into the page's resources.
function pdfOwnFaces(doc, panels) {
  var used = [];
  panels.forEach(function (p) {
    elsOf(p).forEach(function (e) {
      var f = e.kind === 'text' && ownFace(e.voice);
      if (f && used.indexOf(f) < 0) used.push(f);
    });
  });
  var chain = Promise.resolve('');
  used.forEach(function (f, i) {
    chain = chain.then(function (res) {
      f.parsed.own = true;
      return pdfEmbedFace(doc, f.parsed).then(function (n) { f.fkey = 'F' + (11 + i); return res + '/' + f.fkey + ' ' + n + ' 0 R'; });
    });
  });
  return chain;
}

// ---------- backups ----------
function facesForBackup() {
  return ownFaces.map(function (f) {
    var s = '';
    for (var i = 0; i < f.bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, f.bytes.subarray(i, i + 0x8000));
    return { id: f.id, name: f.name, data: btoa(s) };
  });
}

function takeFacesFromBackup(list) {
  (Array.isArray(list) ? list : []).forEach(function (f) {
    if (!f || !f.id || !f.data || ownFaces.some(function (o) { return o.id === f.id; })) return;
    try {
      var bin = atob(f.data);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var rec = { id: String(f.id), name: cleanFaceName(f.name), bytes: bytes };
      if (takeFace(rec)) photoTx('readwrite', function (s) { return s.put({ name: rec.name, bytes: rec.bytes.buffer }, rec.id); }, FONT_STORE).catch(function () {});
    } catch (e) {}
  });
  facesReady = null;
  renderFaceStyle();
  renderFaces();
}

document.addEventListener('click', function (ev) {
  var t = ev.target;
  if (t.closest && t.closest('#fontbtn')) { document.getElementById('fontfile').click(); return; }
  var del = t.closest && t.closest('[data-delface]');
  if (del) removeFace(del.getAttribute('data-delface'));
});
var fontInput = document.getElementById('fontfile');
if (fontInput) {
  fontInput.addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    files.reduce(function (chain, f) { return chain.then(function () { return addFaceFile(f); }); }, Promise.resolve());
    e.target.value = '';
  });
}
