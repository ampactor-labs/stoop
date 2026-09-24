// ---------- the self-carrying issue ----------
// An exported issue is the reading view, the imposed sheet, the shelf, and a
// working press for the next issue, in one file: the app's own HTML plus a
// seed it boots from. The press is a flat cost of about 230 KB, typeface
// included; test/08-weight.js is where that is measured and held.
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

// The issue in hand carries every photograph it uses. Back issues carry their
// covers: each has its own file with the rest, and carrying every photograph
// of every issue made a file grow with the shelf until it was too big to send.
function photosForFile(issues, no) {
  var out = photosFor(issues.filter(function (i) { return i.no === no; }));
  issues.forEach(function (i) {
    if (i.no === no) return;
    var got = photosFor([{ panels: [(i.panels || [])[0]] }]);
    Object.keys(got).forEach(function (id) { out[id] = got[id]; });
  });
  return out;
}

// Everything the running page put in the DOM comes back out; what ships is the
// app as built plus a seed. Rendered lists are rebuilt on boot, so carrying
// them would only add weight and staleness.
var DYNAMIC = ['loglist', 'desktray', 'shelflist', 'shelfreader', 'sheetzone', 'phototray',
  'reprintzone', 'toast', 'importstatus', 'landing', 'inspector', 'stamps', 'roster',
  'logfilters', 'pressstatus', 'fitmeter', 'deskhead', 'shelfcount', 'addhint', 'backupstatus', 'shelfnudge'];

function pageWithSeed(seed) {
  var doc = document.documentElement.cloneNode(true);
  // Emptying a container is not enough: a toast that was showing at export
  // time carries display:block inline, and the file shipped an empty orange
  // box that never went away. The same goes for anything the running page
  // hung on body, such as the test-sheet overlay. What ships is the page as
  // built, not the page as it happened to be at the moment of export.
  DYNAMIC.forEach(function (id) {
    var el = doc.querySelector('#' + id);
    if (el) { el.innerHTML = ''; el.removeAttribute('style'); }
  });
  var cloneBody = doc.querySelector('body');
  if (cloneBody) { cloneBody.removeAttribute('class'); cloneBody.removeAttribute('data-drawer'); }
  var lamp = doc.querySelector('#flash');
  if (lamp) lamp.classList.remove('go');
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
  downloadBlob(name, new Blob([html], { type: 'text/html' }));
}

function downloadBlob(name, blob) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

// The copier's lamp sweeps the pages once. Half a second; it is the one
// moment in the whole loop that should feel like a machine did something.
function copierFlash() {
  var f = document.getElementById('flash');
  if (!f) return;
  f.classList.remove('go');
  void f.offsetWidth;
  f.classList.add('go');
}

function exportIssueFile(no) {
  if (!issueByNo(no)) { toast('No such issue on the shelf'); return; }
  copierFlash();
  download(sceneSlug() + '-' + no + '.html', issueFileHtml(no));
  toast('\u2116' + no + ' is a file now. It is also the press.');
}

function issueFileHtml(no) {
  // The shelf travels up to and including this issue: a reader who is handed
  // №03 gets №01 and №02 with it, because a zine you cannot read back is a
  // stream with extra steps.
  var upTo = state.issues.filter(function (i) {
    return (parseInt(i.no, 10) || 0) <= (parseInt(no, 10) || 0);
  });
  return pageWithSeed({
    stoop: 'issue', version: 1, no: no,
    people: people, address: state.address || '', zine: state.zine || '',
    issues: upTo,
    // The cycle handed on follows the issue in the file, not the shelf it left
    // behind. Somebody given №01 is holding the desk for №02, whatever number
    // the exporting scene has since reached.
    cycle: nextCycleAfter(no),
    photos: photosForFile(upTo, no),
    open: '#shelf', read: no
  });
}

// The verb on the bar. Whatever was published last is what you hand on; a
// draft is not an issue until the bell has rung for it.
function handOn() {
  var last = lastPublished();
  if (!last) {
    toast('Nothing published yet \u2014 assemble an issue at the desk and ring the bell');
    location.hash = '#desk';
    return;
  }
  exportIssueFile(last.no);
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
  var slug = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  download(['piece', slug(nameOf(piece.byline)), slug(piece.title).slice(0, 24)].filter(Boolean).join('-') + '.html', html);
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

  var addedIssues = 0;
  normalize({ issues: seed.issues || [] }).issues.forEach(function (i) {
    if (!i || !i.no) return;
    if (state.issues.some(function (x) { return x.no === i.no; })) return;
    state.issues.push(i);
    addedIssues++;
  });
  var addedPieces = takePieces(seed).length;
  if (seed.address && !state.address) state.address = seed.address;
  if (seed.zine && (!state.zine || state.zine === 'STOOP ZINE')) state.zine = seed.zine;
  if (seed.stoop === 'issue') mergePeople(seed.people);
  ensurePeople();

  saveState();
  renderAll();
  var msg = 'Took in ' + addedIssues + ' issue(s) and ' + addedPieces + ' piece(s)';
  toast(msg);
  var status = document.getElementById('importstatus');
  if (status) status.textContent = msg + '.';
}

// Pieces from a file join the tray, unless they are there already or have
// run. Only the people who signed them join the roster; a contributor's
// file carries their whole scene, and the rest of it is not news here.
function takePieces(seed) {
  var took = [];
  var signed = {};
  normalize({ pieces: seed.pieces || [] }).pieces.forEach(function (p) {
    if (!p.id || state.pieces.some(function (x) { return x.id === p.id; }) || wasPublished(p.id)) return;
    state.pieces.push(p);
    signed[p.byline] = 1;
    took.push(p);
  });
  mergePeople((seed.people || []).filter(function (x) { return x && signed[x.id]; }));
  return took;
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

// The file's photos always load so its issue can be shown. Its people and
// issues join this device only if the file is this scene's own; a stranger's
// zine is shown, not merged (settings takes it in on purpose).
function seedIsOurs(seed) {
  return stateFromSeed || (seed.issues || []).some(function (i) {
    return i && state.issues.some(function (x) { return x.no === i.no && x.ts === i.ts; });
  });
}

function hydrateFromSeed(seed) {
  if (!seed) return;
  var photos = seed.photos || {};
  var ids = Object.keys(photos).filter(function (id) { return !photoCache[id]; });
  ids.forEach(function (id) { photoPut(id, photos[id]); });

  // A piece file opened on the desk's own machine takes itself in: opening
  // it is what the editor meant, and there is nothing else to do with it.
  if (seed.stoop === 'piece' && !stateFromSeed) {
    var took = takePieces(seed);
    ensurePeople();
    saveState();
    var first = normalize({ pieces: seed.pieces || [] }).pieces[0];
    if (took.length) {
      toast('Took in \u201c' + took[0].title + '\u201d from ' + nameOf(took[0].byline) + '. It is in the tray.');
    } else if (first) {
      toast('\u201c' + first.title + '\u201d is already ' + (wasPublished(first.id) ? 'in an issue.' : 'in the tray.'));
    }
  }

  if (seedIsOurs(seed)) {
    // The roster rides along so a byline in the file still has a name on it.
    mergePeople(seed.people);
    if (seed.names && seed.names.a && seed.names.b) {
      mergePeople([{ id: 'a', name: String(seed.names.a) }, { id: 'b', name: String(seed.names.b) }]);
    }
    var took = 0;
    normalize({ issues: seed.issues || [] }).issues.forEach(function (i) {
      if (i.no && !issueByNo(i.no)) { state.issues.push(i); took++; }
    });
    if (took) saveState();
    ensurePeople();
  }
  if (seed.read) openIssueNo = seed.read;
  if (!location.hash) {
    if (seed.stoop === 'issue' && seed.read) location.hash = '#issue';
    else if (seed.open) location.hash = seed.open;
  }
}
