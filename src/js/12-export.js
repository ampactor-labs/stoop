// ---------- the self-carrying issue ----------
// An exported issue is the reading view, the imposed sheet, the shelf, and a
// working press for the next issue, in one file: the app's own HTML plus a
// seed it boots from. The press is a flat cost of about 143 KB, which is two
// photographs' worth; test/08-weight.js is where that is measured and held.
// SEED_ID lives in 01-store.js, where the store can see it.

function sceneSlug() {
  var a = (state.address || '').replace(/\/+$/, '');
  var last = a.split('/').filter(Boolean).pop();
  var name = last || state.zine || 'stoop';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'stoop';
}

function issueUrl(no) {
  var a = (state.address || '').replace(/\/+$/, '');
  if (!a) return '';
  return (/^https?:\/\//.test(a) ? a : 'https://' + a) + '/' + no + '/';
}

function nextCycleAfter(no) {
  var n = String((parseInt(no, 10) || 1) + 1);
  var padded = n.length < 2 ? '0' + n : n;
  return { no: padded, editor: editorFor(padded), bell: Date.now() + 6048e5 };
}

function photosFor(objs) {
  var out = {};
  objs.forEach(function (o) {
    (o.panels || []).concat(o.pieces || []).forEach(function (p) {
      if (!p) return;
      if (p.photo && photoCache[p.photo]) out[p.photo] = photoCache[p.photo];
      (p.els || []).forEach(function (e) {
        if (e && e.photo && photoCache[e.photo]) out[e.photo] = photoCache[e.photo];
      });
    });
    if (o.photo && photoCache[o.photo]) out[o.photo] = photoCache[o.photo];
  });
  return out;
}

// Everything the running page put in the DOM comes back out; what ships is the
// app as built plus a seed. Rendered lists are rebuilt on boot, so carrying
// them would only add weight and staleness.
var DYNAMIC = ['loglist', 'journallist', 'projectlist', 'desktray', 'shelflist',
  'shelfreader', 'sheetzone', 'phototray', 'reprintzone', 'toast', 'importstatus'];

function pageWithSeed(seed) {
  var doc = document.documentElement.cloneNode(true);
  DYNAMIC.forEach(function (id) {
    var el = doc.querySelector('#' + id);
    if (el) el.innerHTML = '';
  });
  var old = doc.querySelector('#' + SEED_ID);
  if (old) old.parentNode.removeChild(old);

  var body = doc.querySelector('body') || doc;
  var script = document.createElement('script');
  script.type = 'application/json';
  script.id = SEED_ID;
  // The seed is parsed before the app's own script runs, so it must come first.
  script.textContent = JSON.stringify(seed).replace(/<\//g, '<\\/');
  body.insertBefore(script, body.firstChild);
  return '<!doctype html>\n' + doc.outerHTML;
}

function download(name, html) {
  var blob = new Blob([html], { type: 'text/html' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function exportIssueFile(no) {
  var iss = issueByNo(no);
  if (!iss) { toast('No such issue on the shelf'); return; }
  // The shelf travels up to and including this issue: a reader who is handed
  // №03 gets №01 and №02 with it, because a zine you cannot read back is a
  // stream with extra steps.
  var upTo = state.issues.filter(function (i) {
    return (parseInt(i.no, 10) || 0) <= (parseInt(no, 10) || 0);
  });
  var html = pageWithSeed({
    stoop: 'issue', version: 1, no: no,
    people: people, address: state.address || '', zine: state.zine || '',
    issues: upTo,
    // The cycle handed on follows the issue in the file, not the shelf it left
    // behind. Somebody given №01 is holding the desk for №02, whatever number
    // the exporting scene has since reached.
    cycle: nextCycleAfter(no),
    photos: photosFor(upTo),
    open: '#shelf', read: no
  });
  download(sceneSlug() + '-' + no + '.html', html);
  toast('Issue №' + no + ' exported — the file is the press as well');
}

// A contributor opens the issue file, writes a piece, and sends back a few
// kilobytes. No server anywhere in that loop.
function exportPieceBundle(id) {
  var piece = state.pieces.find(function (p) { return p.id === id; });
  if (!piece) return;
  var html = pageWithSeed({
    stoop: 'piece', version: 1,
    people: people, address: state.address || '', zine: state.zine || '',
    pieces: [piece], photos: photosFor([piece]), open: '#desk'
  });
  download('piece-' + nameOf(piece.byline).toLowerCase().replace(/[^a-z0-9]+/g, '-') +
    '-' + piece.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '.html', html);
  toast('Piece exported — send it to whoever holds the desk');
}

// Reading a bundle back: pull the seed out of the file rather than trusting
// anything else about it, and merge by id so importing twice is harmless.
function seedFromHtml(text) {
  var re = new RegExp('<script[^>]*id="' + SEED_ID + '"[^>]*>([\\s\\S]*?)<\\/script>');
  var m = text.match(re);
  if (!m) return null;
  try { return JSON.parse(m[1].replace(/<\\\//g, '</')); } catch (e) { return null; }
}

function importSeed(seed) {
  if (!seed || !seed.stoop) { toast('That file is not a stoop issue or piece'); return; }
  var photos = seed.photos || {};
  Object.keys(photos).forEach(function (pid) {
    if (!photoCache[pid]) photoPut(pid, photos[pid]);
  });

  var addedPieces = 0, addedIssues = 0;
  (seed.pieces || []).forEach(function (p) {
    if (!p || !p.id) return;
    if (state.pieces.some(function (x) { return x.id === p.id; })) return;
    state.pieces.push(p);
    addedPieces++;
  });
  (seed.issues || []).forEach(function (i) {
    if (!i || !i.no) return;
    if (state.issues.some(function (x) { return x.no === i.no; })) return;
    state.issues.push(i);
    addedIssues++;
  });
  if (seed.address && !state.address) state.address = seed.address;
  if (seed.zine && (!state.zine || state.zine === 'STOOP ZINE')) state.zine = seed.zine;
  mergePeople(seed.people);
  ensurePeople();

  saveState();
  renderAll();
  var msg = 'Took in ' + addedIssues + ' issue(s) and ' + addedPieces + ' piece(s)';
  toast(msg);
  var status = document.getElementById('importstatus');
  if (status) status.textContent = msg + '.';
}

function handleBundleFile(file) {
  var reader = new FileReader();
  reader.onload = function (e) { importSeed(seedFromHtml(String(e.target.result))); };
  reader.onerror = function () { toast('Could not read that file'); };
  reader.readAsText(file);
}

// ---------- booting from a seed ----------
// A file handed to somebody who has never opened this app should show them the
// issue, not an empty notebook. A device that already has its own work keeps
// it: the seed is merged, never imposed.
function readSeed() {
  var el = document.getElementById(SEED_ID);
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch (e) { return null; }
}

function hydrateFromSeed(seed) {
  if (!seed) return;
  var photos = seed.photos || {};
  var ids = Object.keys(photos).filter(function (id) { return !photoCache[id]; });
  ids.forEach(function (id) { photoPut(id, photos[id]); });

  // The roster rides along so a byline in the file still has a name on it.
  mergePeople(seed.people);
  if (seed.names && seed.names.a && seed.names.b) {
    mergePeople([{ id: 'a', name: String(seed.names.a) }, { id: 'b', name: String(seed.names.b) }]);
  }
  ensurePeople();
  if (seed.read) openIssueNo = seed.read;
  if (!location.hash) {
    if (seed.stoop === 'issue' && seed.read) location.hash = '#issue';
    else if (seed.open) location.hash = seed.open;
  }
}
