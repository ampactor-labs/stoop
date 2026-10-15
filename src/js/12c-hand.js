// ---------- handing on ----------
// Everything that leaves the device leaves here: an issue file, a piece, a
// PDF, plates, a site, a backup, a calendar entry. On a phone the system's
// share sheet is how things leave (AirDrop to the person in front of you,
// Messages, Mail, Files), and a download lands in a folder nobody opens; so
// on a phone that can share files, a file is shared. Anywhere else it is
// saved as it always was.

function saveBlob(name, blob) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function shareable(file) {
  try {
    return !!(navigator.share && navigator.canShare && window.matchMedia &&
      matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [file] }));
  } catch (e) { return false; }
}

// note, when given, rides along as the share's text: who the file is for.
// A share needs a tap it can call its own, and a PDF or a zip can take
// longer to write than a tap lasts; then the toast offers a fresh one.
function handOver(name, blob, note) {
  var file = null;
  try { file = new File([blob], name, { type: blob.type || 'application/octet-stream' }); } catch (e) {}
  if (!file || !shareable(file)) { saveBlob(name, blob); return; }
  var data = { files: [file], title: name };
  if (note) data.text = note;
  var fallback = function (e) { if (!e || e.name !== 'AbortError') saveBlob(name, blob); };
  navigator.share(data).catch(function (e) {
    if (e && e.name === 'AbortError') return;
    toast(name + ' is ready.', function () { navigator.share(data).catch(fallback); }, 'SHARE');
  });
}

// Where pieces go: the scene's contact, if it has one, in words.
function contactLine() {
  var c = String(state.contact || '').trim();
  return c ? 'Send it to ' + c + '.' : '';
}

// ---------- the issue's sheet ----------
// One place an issue leaves from, whichever issue it is: the newest from the
// bar, any of the shelf's, a zine the distro carries, or the file in hand on
// its landing. At the top is the issue's address as a code big enough to
// scan off a phone held out across a table; under it the file, which is the
// zine and the press, and the issue's paper. Choosing one puts the sheet
// away; the code is what stays up while somebody scans.
var handSubject = null;

// What a subject is: its issue, its address, its file, its name on disk,
// and whether it is this scene's own.
function handOf(subject) {
  var s = subject || {};
  if (s.kind === 'held') {
    var held = fileIssue();
    if (!held) return null;
    var slug = distroSlug({ address: landingSeed.address, zine: landingSeed.zine, issue: held });
    return { issue: held, url: landingUrl(held), zine: landingSeed.zine || 'STOOP ZINE', own: false,
      name: slug + '-' + held.no + '.html', html: function () { return pageWithSeed(landingSeed); } };
  }
  if (s.kind === 'carried') {
    var e = carriedById(s.id);
    if (!e) return null;
    return { issue: e.issue, url: distroUrl(e), zine: e.zine, own: false,
      name: distroSlug(e) + '-' + e.issue.no + '.html', html: function () { return pageWithSeed(distroSeed(e)); } };
  }
  var iss = issueByNo(s.no);
  if (!iss) return null;
  return { issue: iss, url: issueUrl(iss.no), zine: state.zine || 'STOOP ZINE', own: true,
    name: sceneSlug() + '-' + iss.no + '.html', html: function () { return issueFileHtml(iss.no); } };
}

function handCode(url) {
  var m = url && qrOf(url);
  if (!m) return '';
  var n = m.length + 8;
  return '<svg class="handqr" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="' +
    esc('A code for ' + url) + '"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path fill="#000" d="' +
    qrRuns(m).map(function (r) { return 'M' + (r[0] + 4) + ' ' + (r[1] + 4) + 'h' + r[2] + 'v1h-' + r[2] + 'z'; }).join('') +
    '"/></svg>';
}

function renderHand() {
  var box = document.getElementById('handsheet');
  if (!box) return;
  var h = handSubject && handOf(handSubject);
  document.body.classList.toggle('handing', !!h);
  if (!h) { box.innerHTML = ''; return; }
  var code = handCode(h.url);
  box.innerHTML = '<div class="hand-head"><b>№' + esc(h.issue.no) + '</b><span>' + esc(h.zine) + '</span>' +
    '<button class="btn quiet" data-closehand>CLOSE</button></div>' +
    (code
      ? '<div class="hand-code">' + code + '</div><p class="hand-addr">' + esc(h.url.replace(/^https?:\/\//, '')) + '</p>' +
        '<p class="hint">Scan it to open this issue. The page it opens is also the press.</p>'
      : '<p class="hint">This scene has no address yet, so there is nothing to scan. The file is the whole zine and the press: hand that on.</p>') +
    '<div class="press-actions hand-verbs">' +
    '<button class="btn done" id="handfile">SHARE THE FILE</button>' +
    '<button class="btn quiet" data-handout="pdf">PDF</button>' +
    '<button class="btn quiet" data-handout="shop">SHOP PDF</button>' +
    (h.own ? '<button class="btn quiet" data-handout="riso">RISO</button>' : '') +
    '</div>';
}

function openHand(subject) {
  handSubject = subject;
  if (!handOf(subject)) { handSubject = null; toast('That issue is not here'); return; }
  renderHand();
}
function closeHand() { handSubject = null; renderHand(); }

function handOut(what) {
  var h = handOf(handSubject);
  closeHand();
  if (!h) return;
  var i = h.issue, base = h.name.replace(/\.html$/, '');
  if (what === 'file') {
    copierFlash();
    handOver(h.name, new Blob([h.html()], { type: 'text/html' }), h.own ? contactLine() : '');
    toast('№' + i.no + ' is a file now. It is also the press.');
  } else if (what === 'pdf') {
    savePdf(i.panels || [], i.format, i.hand, h.url, i.no, base + '.pdf', i.gen);
  } else if (what === 'shop') {
    saveShopPdf(i.panels || [], i.format, h.url, i.no, base + '-shop.pdf', i.gen);
  } else if (what === 'riso') {
    saveRisoPlates(i.panels || [], i.format, h.url, i.no, i.gen);
  }
}

document.addEventListener('click', function (ev) {
  var t = ev.target, el;
  if (!t.closest) return;
  if (t.closest('[data-closehand]') || t.closest('#handscrim')) { closeHand(); return; }
  if (t.closest('#handfile')) { handOut('file'); return; }
  if ((el = t.closest('[data-handout]'))) { handOut(el.getAttribute('data-handout')); return; }
  if ((el = t.closest('[data-handissue]'))) { openHand({ kind: 'issue', no: el.getAttribute('data-handissue') }); return; }
  if ((el = t.closest('[data-handcarried]'))) { openHand({ kind: 'carried', id: el.getAttribute('data-handcarried') }); return; }
  if (t.closest('#landpass')) openHand(fileIssue() && landingIssue() === fileIssue() ? { kind: 'held' } : { kind: 'issue', no: landingIssue().no });
});
document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && handSubject) { closeHand(); ev.stopPropagation(); } }, true);
