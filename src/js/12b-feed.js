// ---------- the site's feed, catalogue and cover ----------
// What MAKE THE SITE writes beside the issues so the shelf is machine-
// readable: an Atom feed of issue drops, a catalogue in the columns a
// library uses, and each cover as a JPEG for a shared link to show. The
// card itself is 05n-card.js; this is what the site makes of it.

function siteBase() {
  var a = (state.address || '').replace(/\/+$/, '');
  return a ? (/^https?:\/\//.test(a) ? a : 'https://' + a) + '/' : '';
}

// The bell in a feed reader: one entry per issue, the reading page as its
// link and the printer's PDF as its enclosure. No ranking, no counts, no
// scroll; a list of drops, newest first, which is what a feed was before
// the word meant something else.
function feedXml(issues, sizes) {
  var base = siteBase();
  var idOf = function (no) { return base ? base + no + '/' : 'urn:stoop:' + sceneSlug() + ':' + no; };
  var when = function (ts) { return new Date(ts || Date.now()).toISOString(); };
  var newest = issues.reduce(function (m, i) { return Math.max(m, i.ts || 0); }, 0);
  var entries = issues.slice().reverse().map(function (iss) {
    var c = cardOf(iss);
    return '  <entry>\n    <title>' + esc(c.title) + '</title>\n    <id>' + esc(idOf(iss.no)) + '</id>\n' +
      '    <link rel="alternate" type="text/html" href="' + esc(base + iss.no + '/') + '"/>\n' +
      '    <link rel="enclosure" type="application/pdf" href="' + esc(base + iss.no + '/sheet.pdf') + '"' +
      (sizes && sizes[iss.no] ? ' length="' + sizes[iss.no] + '"' : '') + '/>\n' +
      '    <published>' + when(iss.ts) + '</published>\n    <updated>' + when(iss.ts) + '</updated>\n' +
      '    <author><name>' + esc(c.editor) + '</name></author>\n' +
      '    <summary>' + esc(c.blurb) + '</summary>\n  </entry>\n';
  }).join('');
  return '<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n' +
    '  <title>' + esc(state.zine || 'STOOP ZINE') + '</title>\n' +
    '  <id>' + esc(base || 'urn:stoop:' + sceneSlug()) + '</id>\n' +
    '  <link rel="self" type="application/atom+xml" href="' + esc(base + 'feed.xml') + '"/>\n' +
    (base ? '  <link rel="alternate" type="text/html" href="' + esc(base) + '"/>\n' : '') +
    '  <updated>' + when(newest) + '</updated>\n' + entries + '</feed>\n';
}

// The shelf as a library would catalogue it: the twelve elements as
// columns, one row per issue, quoted the way every spreadsheet reads.
function catalogCsv(issues) {
  var cell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
  var rows = [['Title', 'Creators', 'Publisher', 'Contributors', 'Date of publication', 'Physical description',
    'Language', 'Place of publication', 'Subjects', 'See also', 'Freedoms and restrictions', 'Union ID']];
  issues.forEach(function (iss) {
    var c = cardOf(iss);
    rows.push([c.title, c.creators.join('; '), c.publisher, c.contributors.join('; '), c.date, c.physical,
      c.language, c.place, c.subjects.join('; '), c.seeAlso, c.rights, c.unionId]);
  });
  return '﻿' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n';
}

// The cover photograph as a JPEG beside the issue, for a shared link to
// show. A photograph the scene keeps as a JPEG goes as it is; anything else
// is drawn once, on white.
function coverJpeg(issue) {
  var src = photoCache[coverPhotoId(issue)];
  if (!src) return Promise.resolve(null);
  if (/^data:image\/jpeg;base64,/.test(src)) return Promise.resolve(b64Bytes(src));
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      var g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0);
      c.toBlob(function (b) {
        if (!b) { resolve(null); return; }
        b.arrayBuffer().then(function (buf) { resolve(new Uint8Array(buf)); });
      }, 'image/jpeg', 0.85);
    };
    img.onerror = function () { resolve(null); };
    img.src = src;
  });
}
