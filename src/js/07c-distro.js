// ---------- the distro ----------
// The shelf carries other scenes' issues. A friend's issue file goes under
// THE DISTRO with the roster, the name and the address it came with, kept
// apart from the scene's own issues: it reads, it prints in its own format,
// and it goes out with the site under distro/, so a hosted stoop site is
// also a distro table. Stocked by hand, listing only what its keeper
// carries, served from the keeper's own folder. Nothing anywhere lists
// scenes; there are only shelves that carry one another.

var openCarried = null;

function distroSlug(entry) {
  var a = String(entry.address || '').replace(/\/+$/, '');
  var last = a.split('/').filter(Boolean).pop();
  var name = last || entry.zine || 'zine';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'zine';
}

// Names from the roster the file came with, never from this scene's.
function distroNameFn(entry) {
  var roster = entry.people || [];
  return function (id) {
    var p = roster.filter(function (x) { return x && x.id === id; })[0];
    if (p) return String(p.name);
    if (id === 'both') return roster.length === 2 ? 'Both' : 'Together';
    return id === 'anon' ? 'Anonymous' : 'Someone';
  };
}

function distroUrl(entry) {
  var a = String(entry.address || '').replace(/\/+$/, '');
  return a ? (/^https?:\/\//.test(a) ? a : 'https://' + a) + '/' + entry.issue.no + '/' : '';
}

function carriedById(id) {
  return state.distro.filter(function (e) { return e.id === id; })[0] || null;
}

// A carried issue as a file of its own: the issue with the roster, the name
// and the address of the scene that made it, so anyone who opens it from
// the distro is holding that scene's press and can hand it on from there.
function distroSeed(entry) {
  return { stoop: 'issue', version: 1, no: entry.issue.no,
    people: entry.people || [], address: entry.address || '', zine: entry.zine || '',
    issues: [entry.issue], cycle: entry.cycle || nextCycleAfter(entry.issue.no),
    photos: photosFor([entry.issue]), open: '#shelf', read: entry.issue.no };
}

function carrySeed(seed) {
  if (!seed || seed.stoop !== 'issue') { toast('That file is not a stoop issue'); return; }
  var no = seed.read || seed.no;
  var iss = normalize({ issues: seed.issues || [] }).issues.filter(function (i) { return i && i.no === no; })[0];
  if (!iss) { toast('That file carries no issue to shelve'); return; }
  if (seedIsOurs(seed)) {
    toast('That is this scene’s own №' + no + '. It is on the shelf already; the distro is for other people’s.');
    return;
  }
  var photos = seed.photos || {};
  Object.keys(photos).forEach(function (id) { if (!photoCache[id]) photoPut(id, photos[id]); });
  var entry = {
    id: uid('dz'), ts: Date.now(), issue: iss,
    zine: String(seed.zine || 'STOOP ZINE').slice(0, 40),
    address: String(seed.address || '').slice(0, 200),
    people: (seed.people || []).filter(function (p) { return p && p.id && p.name; })
      .map(function (p) { return { id: String(p.id), name: String(p.name).slice(0, 24) }; }),
    cycle: seed.cycle && typeof seed.cycle === 'object' ? seed.cycle : null
  };
  var key = function (e) { return distroSlug(e) + '/' + e.issue.no; };
  var was = state.distro.filter(function (e) { return key(e) === key(entry); })[0];
  if (was) state.distro.splice(state.distro.indexOf(was), 1, entry); else state.distro.push(entry);
  saveState();
  renderShelf();
  toast((was ? 'Replaced ' : 'Carrying ') + entry.zine + ' №' + iss.no + ', edited by ' +
    distroNameFn(entry)(iss.editor) + '. It goes out with the site.');
}

function carryFile(file) {
  var reader = new FileReader();
  reader.onload = function (e) { carrySeed(seedFromHtml(String(e.target.result))); };
  reader.onerror = function () { toast('Could not read that file'); };
  reader.readAsText(file);
}

// Dropping is done at once and can be taken back while the toast is up; the
// photographs it carried are swept once it cannot.
function dropCarried(id) {
  var at = state.distro.map(function (e) { return e.id; }).indexOf(id);
  if (at < 0) return;
  var gone = state.distro.splice(at, 1)[0];
  if (openCarried === id) openCarried = null;
  saveState();
  renderShelf();
  toast('Dropped ' + gone.zine + ' №' + gone.issue.no + '.', function () {
    state.distro.splice(Math.min(at, state.distro.length), 0, gone);
    saveState();
    renderShelf();
  });
  setTimeout(sweepPhotos, 6500);
}

function renderDistro() {
  var list = document.getElementById('distrolist');
  if (!list) return;
  var entries = state.distro.slice().sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); });
  list.innerHTML = entries.length ? entries.map(function (e) {
    var who = distroNameFn(e);
    return '<div class="shelf-row" data-carried="' + esc(e.id) + '">' +
      '<span class="shelf-no">№' + esc(e.issue.no) + '</span>' +
      '<span class="shelf-meta"><b>' + esc(e.zine) + '</b><small>' + esc(fmtDay(e.issue.ts)) + ' · edited by ' +
      esc(who(e.issue.editor)) + (e.address ? ' · ' + esc(e.address) : '') + ' · ' +
      esc(formatOf(e.issue.format).label) + '</small></span>' +
      '<button class="btn quiet" data-readcarried="' + esc(e.id) + '">READ</button>' +
      '<button class="btn quiet" data-pdfcarried="' + esc(e.id) + '">PDF</button>' +
      '<button class="btn quiet" data-shopcarried="' + esc(e.id) + '">SHOP PDF</button>' +
      '<button class="log-del" data-dropcarried="' + esc(e.id) + '" title="Drop it from the distro" aria-label="Drop this zine">✕</button>' +
      '</div>';
  }).join('') : '<p class="hint">Nothing carried yet. Carry a friend’s issue file and it sits here as theirs.</p>';
  var box = document.getElementById('distroreader');
  if (!box) return;
  var open = openCarried && carriedById(openCarried);
  if (!open) { box.innerHTML = ''; box.classList.remove('on'); return; }
  box.classList.add('on');
  box.innerHTML = '<div class="reader-bar"><span>Reading ' + esc(open.zine) + ' №' + esc(open.issue.no) + '</span>' +
    '<button class="btn quiet" data-closecarried>CLOSE</button></div>' +
    readHtml(open.issue, distroUrl(open), distroNameFn(open));
  fitReads();
}

// ---------- the site ----------
// distro/index.html is a plain page of what the scene carries, each with
// who made it and where it lives, in words; the issue pages beside it are
// the issues themselves, with their own scenes' seeds.
function distroPageHtml() {
  var rows = state.distro.slice().sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); }).map(function (e) {
    var dir = distroSlug(e) + '/' + e.issue.no + '/';
    return '<div class="row"><b>' + esc(e.zine) + ' №' + esc(e.issue.no) + '</b> — edited by ' +
      esc(distroNameFn(e)(e.issue.editor)) + ', ' + esc(fmtDay(e.issue.ts)) +
      (e.address ? ', lives at ' + esc(e.address) : '') + '<br><a href="' + esc(dir) + '">read it</a> · <a href="' +
      esc(dir + 'sheet.pdf') + '">the PDF</a></div>';
  }).join('');
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(state.zine || 'STOOP ZINE') + ' — the distro</title><style>body{margin:0 auto;max-width:640px;padding:2rem 1rem;' +
    'background:#f3ead8;color:#1d1a16;font-family:\'Courier New\',monospace;line-height:1.45}h1{font-family:Impact,\'Arial Black\',sans-serif;' +
    'font-size:2.4rem;margin:0 0 .3rem}p{margin:.4rem 0 1.4rem}.row{border-top:2px solid #1d1a16;padding:.8rem 0}a{color:#155d80;font-weight:bold}' +
    '</style></head><body><h1>THE DISTRO</h1><p>What ' + esc(state.zine || 'STOOP ZINE') + ' carries. Each is somebody else’s zine, made on ' +
    'their own press; the page it opens is theirs to hand on.</p>' + rows + '<p><a href="../">back to the shelf</a></p></body></html>\n';
}

// ---------- events ----------
document.addEventListener('click', function (ev) {
  var t = ev.target;
  var el;
  if (t.closest && t.closest('#carrybtn')) { document.getElementById('carryfile').click(); return; }
  if ((el = t.closest && t.closest('[data-readcarried]'))) {
    var id = el.getAttribute('data-readcarried');
    openCarried = openCarried === id ? null : id;
    renderDistro();
    var box = document.getElementById('distroreader');
    if (box && openCarried) box.scrollIntoView({ block: 'start' });
    return;
  }
  if (t.closest && t.closest('[data-closecarried]')) { openCarried = null; renderDistro(); return; }
  if ((el = t.closest && t.closest('[data-pdfcarried]'))) {
    var e = carriedById(el.getAttribute('data-pdfcarried'));
    if (e) savePdf(e.issue.panels, e.issue.format, e.issue.hand, distroUrl(e), e.issue.no, distroSlug(e) + '-' + e.issue.no + '.pdf', e.issue.gen);
    return;
  }
  if ((el = t.closest && t.closest('[data-shopcarried]'))) {
    var s = carriedById(el.getAttribute('data-shopcarried'));
    if (s) saveShopPdf(s.issue.panels, s.issue.format, distroUrl(s), s.issue.no, distroSlug(s) + '-' + s.issue.no + '-shop.pdf', s.issue.gen);
    return;
  }
  if ((el = t.closest && t.closest('[data-dropcarried]'))) dropCarried(el.getAttribute('data-dropcarried'));
  if (t.closest && t.closest('[data-readmode]') && openCarried) renderDistro();
});

var carryInput = document.getElementById('carryfile');
if (carryInput) {
  carryInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) carryFile(e.target.files[0]);
    e.target.value = '';
  });
}
