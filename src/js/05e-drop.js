// ---------- things that land on the sheet ----------
// The sheet accepts what is dropped on it. A photograph dragged in from the
// desktop is dithered and glued down where it fell; text dragged or pasted in
// becomes a cutting there. No tray, no arming, no button to press first: the
// paper is the interface, and putting a thing on paper means putting it on
// the paper.

function dropPoint(panelEl, ev) {
  var p = panelLocal(panelEl, ev.clientX, ev.clientY);
  return { x: p.x / p.w, y: p.y / p.h };
}

function acceptFiles(page, files, at) {
  intakePhotos(files).then(function (ids) {
    ids.forEach(function (id, i) {
      addEl(page, 'photo', { photo: id, at: at ? { x: at.x + i * 0.05, y: at.y + i * 0.05 } : null });
    });
    if (!ids.length) return;
    renderPress();
    toast(ids.length === 1 ? 'Glued down' : ids.length + ' photographs glued down');
  });
}

function acceptText(page, text, at) {
  var t = String(text || '').trim();
  if (!t) return;
  // A line is a headline; a paragraph is typewriter copy.
  addEl(page, 'text', { text: t.slice(0, 4000), voice: t.length > 70 ? 'type' : 'head', at: at });
  renderPress();
  toast('Cutting glued down');
}

// A file dropped off a page would replace the press in the browser.
function draggingFiles(ev) {
  var types = ev.dataTransfer && ev.dataTransfer.types;
  return !!types && Array.prototype.indexOf.call(types, 'Files') >= 0;
}

document.addEventListener('dragover', function (ev) {
  var panel = ev.target.closest && ev.target.closest('#sheetzone .panel');
  if (!panel) {
    if (draggingFiles(ev)) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'none'; }
    return;
  }
  ev.preventDefault();
  panel.classList.add('dropping');
});

document.addEventListener('dragleave', function (ev) {
  var panel = ev.target.closest && ev.target.closest('.panel');
  if (panel) panel.classList.remove('dropping');
});

document.addEventListener('drop', function (ev) {
  var panel = ev.target.closest && ev.target.closest('#sheetzone .panel');
  if (!panel) {
    if (draggingFiles(ev)) { ev.preventDefault(); toast('Drop it on a page'); }
    return;
  }
  ev.preventDefault();
  panel.classList.remove('dropping');
  var page = Number(panel.getAttribute('data-page'));
  var at = dropPoint(panel, ev);
  var dt = ev.dataTransfer;
  if (!dt) return;
  if (dt.files && dt.files.length) { acceptFiles(page, dt.files, at); return; }
  var text = dt.getData('text/plain');
  if (text) acceptText(page, text, at);
});

// Paste lands on the panel last touched, unless a caret has somewhere better
// to put it.
// Behind a drawer nothing lands unseen; over the scraps a photo is a scrap.
document.addEventListener('paste', function (ev) {
  var a = document.activeElement;
  if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
  var zone = document.getElementById('sheetzone');
  if (!zone || !zone.offsetParent) return;
  var cd = ev.clipboardData;
  if (!cd) return;
  var files = [];
  for (var i = 0; cd.items && i < cd.items.length; i++) {
    if (cd.items[i].kind === 'file') files.push(cd.items[i].getAsFile());
  }
  var drawer = document.body.getAttribute('data-drawer');
  if (drawer) {
    if (drawer === 'scraps' && files.length) {
      ev.preventDefault();
      intakePhotos(files).then(function (ids) { if (ids.length) addLog(ids); renderTray(); });
    }
    return;
  }
  if (files.length) { ev.preventDefault(); acceptFiles(pastePage, files, null); return; }
  var text = cd.getData('text/plain');
  if (text) { ev.preventDefault(); acceptText(pastePage, text, null); }
});

// + PHOTO on the press: the device's picker, then the same path as a drop.
var pasteInput = document.getElementById('pastephotofile');
if (pasteInput) {
  pasteInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files.length) acceptFiles(pastePage, e.target.files, null);
    e.target.value = '';
  });
}
