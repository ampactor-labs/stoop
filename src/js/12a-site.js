// ---------- the site ----------
// Every back cover's code points at <address>/<no>/, and nothing used to put
// anything there. This writes the folder that does: each issue as the page
// its code leads to, a printer's PDF beside it, and the newest at the root,
// zipped, for any host that serves plain files or for a thumb drive. Nothing
// in it names its own host, so it works wherever it lands.

function dosTime(d) { return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff; }
function dosDate(d) { return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff; }

function deflateRaw(bytes) {
  if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
  try {
    var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); })
      .catch(function () { return null; });
  } catch (e) { return Promise.resolve(null); }
}

// A plain zip: a local header and the bytes for each file, then the central
// directory, then its end record. Deflated where the browser can and it
// helps, stored otherwise; every unzip there is reads both.
function zipFiles(files) {
  var now = new Date();
  var t = dosTime(now), d = dosDate(now);
  var enc = new TextEncoder();
  return files.reduce(function (chain, f) {
    return chain.then(function (done) {
      return deflateRaw(f.data).then(function (z) {
        var packed = !!z && z.length < f.data.length;
        done.push({ name: enc.encode(f.name), data: packed ? z : f.data, method: packed ? 8 : 0,
          crc: crc32(f.data), size: f.data.length });
        return done;
      });
    });
  }, Promise.resolve([])).then(function (entries) {
    var parts = [], central = [], offset = 0;
    entries.forEach(function (e) {
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(8, e.method, true); h.setUint16(10, t, true); h.setUint16(12, d, true);
      h.setUint32(14, e.crc, true); h.setUint32(18, e.data.length, true); h.setUint32(22, e.size, true);
      h.setUint16(26, e.name.length, true);
      parts.push(new Uint8Array(h.buffer), e.name, e.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true); c.setUint16(10, e.method, true); c.setUint16(12, t, true);
      c.setUint16(14, d, true); c.setUint32(16, e.crc, true); c.setUint32(20, e.data.length, true);
      c.setUint32(24, e.size, true); c.setUint16(28, e.name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), e.name);
      offset += 30 + e.name.length + e.data.length;
    });
    var cdSize = central.reduce(function (a, p) { return a + p.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  });
}

function siteReadme(latest) {
  var where = (state.address || '').replace(/\/+$/, '');
  return (state.zine || 'STOOP ZINE') + ' — the site\n\n' +
    'Put what is in this folder on any host that serves plain files: Neocities,\n' +
    'Netlify Drop, GitHub Pages, a friend\'s server, a thumb drive. Nothing in it\n' +
    'names its own host, so it works wherever it lands.\n\n' +
    '  index.html      №' + latest.no + ', the newest, and the shelf behind it\n' +
    '  latest/         the same, at an address that never changes\n' +
    '  01/, 02/ ...    each issue, the page its back cover\'s code points at\n' +
    '  01/sheet.pdf    that issue imposed for a printer, at its exact paper size\n\n' +
    (where
      ? 'The back covers point at ' + where + '/01/ and so on, so this folder has to be\n' +
        'what ' + where + '/ serves for the codes to land.\n'
      : 'No address is set, so the back covers carry none. Set one under SCENE and\n' +
        'the next issue\'s back cover points here.\n');
}

function publishSite() {
  var issues = state.issues.slice().sort(function (x, y) {
    return (parseInt(x.no, 10) || 0) - (parseInt(y.no, 10) || 0);
  });
  if (!issues.length) { toast('Nothing published yet — ring the bell first'); return Promise.resolve(); }
  var root = sceneSlug() + '/';
  var enc = new TextEncoder();
  var latest = issues[issues.length - 1];
  var front = enc.encode(issueFileHtml(latest.no));
  var files = [
    { name: root + 'index.html', data: front },
    { name: root + 'latest/index.html', data: front },
    { name: root + 'README.txt', data: enc.encode(siteReadme(latest)) }
  ];
  toast('Making the site…');
  copierFlash();
  var chain = Promise.resolve();
  issues.forEach(function (iss) {
    files.push({ name: root + iss.no + '/index.html', data: enc.encode(issueFileHtml(iss.no)) });
    chain = chain.then(function () {
      return buildSheetPdf(iss.panels, iss.format, iss.hand, issueUrl(iss.no), iss.no, iss.gen);
    }).then(function (blob) { return blob.arrayBuffer(); }).then(function (buf) {
      files.push({ name: root + iss.no + '/sheet.pdf', data: new Uint8Array(buf) });
    });
  });
  return chain.then(function () {
    files.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return zipFiles(files);
  }).then(function (blob) {
    downloadBlob(sceneSlug() + '-site.zip', blob);
    toast('The site: ' + issues.length + ' issue(s) and a PDF of each. Unzip it onto any host.');
  }).catch(function (e) { toast('Could not make the site: ' + e.message); });
}

document.addEventListener('click', function (ev) {
  if (ev.target.closest && ev.target.closest('#sitebtn')) publishSite();
});
