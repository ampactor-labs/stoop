// ---------- the inspector ----------
// Geometry is done by hand on the sheet. Everything that is not geometry —
// which voice, how big, black or knocked out, what order things stack in —
// lives here, in one strip, rather than in a popover floating over a panel
// that might itself be upside down.
var pastePage = 1;

function pasteTargetLabel() {
  var ps = pressState();
  return 'page ' + pastePage + ' of ' + ps.panels.length;
}

function inspectorButtons(el) {
  var b = [];
  if (el.kind === 'text') {
    b.push(['elvoice', VOICE_LABEL[voiceOf(el)]]);
    b.push(['elsmaller', 'A−']);
    b.push(['elbigger', 'A+']);
    b.push(['elink', el.ink === 'white' ? 'KNOCKED OUT' : 'BLACK ON WHITE']);
  }
  if (el.kind === 'box') b.push(['elink', el.ink === 'white' ? 'OUTLINE' : 'SOLID']);
  if (el.kind === 'photo') b.push(['elcrop', el.crop ? 'FILLING THE BOX' : 'WHOLE FRAME']);
  if (el.kind === 'photo' && photoMeta[el.photo]) {
    b.push(['elphlight', 'LIGHTER'], ['elphdark', 'DARKER'], ['elphscreen', SCREEN_LABEL[photoMeta[el.photo].style]]);
  }
  var at = findEl(el.id);
  var pages = pressState().panels.length;
  if (at && at.page > 1) b.push(['elprevpage', '\u25c0 PAGE ' + (at.page - 1)]);
  if (at && at.page < pages) b.push(['elnextpage', 'PAGE ' + (at.page + 1) + ' \u25b6']);
  b.push(['eldup', 'DUPLICATE']);
  b.push(['elfront', 'FRONT']);
  b.push(['elback', 'BACK']);
  b.push(['elstraight', 'STRAIGHTEN']);
  b.push(['eldrop', 'REMOVE']);
  return b.map(function (pair) {
    return '<button class="btn quiet" data-' + pair[0] + '="' + esc(el.id) + '">' + esc(pair[1]) + '</button>';
  }).join('');
}

function renderInspector() {
  var box = document.getElementById('inspector');
  if (!box) return;
  var hint = document.getElementById('addhint');
  if (hint) {
    hint.textContent = pasteTargetLabel() + ' \u00b7 drag \u00b7 double-click to type \u00b7 drop anything';
  }

  var el = selectedEl();
  var page = panelOfPage(pastePage);
  if (!el && page && page.photo && photoMeta[page.photo]) {
    // The page's own photograph, the one a piece brought or the cover's.
    var m = photoMeta[page.photo];
    box.className = 'inspector on';
    box.innerHTML = '<div class="insp-head"><b>PAGE PHOTO</b><span class="sub">page ' + pastePage + '</span></div>' +
      '<div class="press-actions">' + [['pgphlight', 'LIGHTER'], ['pgphdark', 'DARKER'], ['pgphscreen', SCREEN_LABEL[m.style]]]
        .map(function (pair) {
          return '<button class="btn quiet" data-' + pair[0] + '="' + pastePage + '">' + pair[1] + '</button>';
        }).join('') + '</div>';
    return;
  }
  if (!el) {
    box.className = 'inspector';
    box.innerHTML = '';
    return;
  }
  box.className = 'inspector on';
  var rot = Math.round(el.rot || 0);
  box.innerHTML = '<div class="insp-head"><b>' + esc(el.kind.toUpperCase()) + '</b>' +
    '<span class="sub">' + rot + '° · ' + Math.round(el.w * 100) + '×' +
    Math.round(el.h * 100) + ' of the panel</span></div>' +
    '<div class="press-actions">' + inspectorButtons(el) + '</div>' +
    (el.kind === 'text' && (voiceOf(el) === 'ransom' || voiceOf(el) === 'marker')
      ? '<textarea class="text-input" id="ransomtext" rows="2" placeholder="' +
        (voiceOf(el) === 'ransom' ? 'Cut the letters from a magazine' : 'Write it with the fat pen') +
        '">' + esc(el.text || '') + '</textarea>'
      : '') +
    (el.kind === 'photo'
      ? '<input class="text-input" id="alttext" maxlength="200" placeholder="What is in it, for anyone who cannot see it" value="' +
        esc(el.alt || '') + '">'
      : '');
}

function addToPasteup(kind) {
  if (kind === 'photo') {
    // A photograph comes from the device, through the same intake as a drop.
    var input = document.getElementById('pastephotofile');
    if (input) input.click();
    return;
  }
  var extra = {};
  if (kind === 'text') extra.text = 'NEW CUTTING';
  addEl(pastePage, kind, extra);
  renderPress();
  toast(kind === 'text' ? 'Type into it, or change its voice below' : 'Drag it where you want it');
}

document.addEventListener('click', function (ev) {
  var t = ev.target;
  var hit = function (sel) { return t.closest && t.closest(sel); };
  var el;

  if ((el = hit('[data-addel]'))) { addToPasteup(el.getAttribute('data-addel')); return; }
  if (hit('#undobtn')) { pasteUndoStep(); return; }
  if (hit('#redobtn')) { pasteRedoStep(); return; }
  if ((el = hit('[data-elvoice]'))) { cycleVoice(el.getAttribute('data-elvoice')); return; }
  if ((el = hit('[data-elsmaller]'))) { resizeText(el.getAttribute('data-elsmaller'), -2); return; }
  if ((el = hit('[data-elbigger]'))) { resizeText(el.getAttribute('data-elbigger'), 2); return; }
  if ((el = hit('[data-elink]'))) { toggleInk(el.getAttribute('data-elink')); return; }
  if ((el = hit('[data-elcrop]'))) { toggleCrop(el.getAttribute('data-elcrop')); return; }
  if ((el = hit('[data-elfront]'))) { raiseEl(el.getAttribute('data-elfront'), true); return; }
  if ((el = hit('[data-elback]'))) { raiseEl(el.getAttribute('data-elback'), false); return; }
  if ((el = hit('[data-elstraight]'))) {
    updateEl(el.getAttribute('data-elstraight'), { rot: 0 }, true);
    renderPress();
    return;
  }
  if ((el = hit('[data-eldrop]'))) { removeEl(el.getAttribute('data-eldrop')); return; }
  if ((el = hit('[data-eldup]'))) { duplicateEl(el.getAttribute('data-eldup')); return; }
  if ((el = hit('[data-elprevpage]'))) { moveElToPage(el.getAttribute('data-elprevpage'), -1); return; }
  if ((el = hit('[data-elnextpage]'))) { moveElToPage(el.getAttribute('data-elnextpage'), 1); return; }
  var shot = hit('[data-elphlight],[data-elphdark],[data-elphscreen],[data-pgphlight],[data-pgphdark],[data-pgphscreen]');
  if (shot) rescreenFrom(shot);
});

// A second of the same cutting, a little down and to the right, on top.
function duplicateEl(id) {
  var hit = findEl(id);
  if (!hit) return;
  pasteMark();
  var copy = JSON.parse(JSON.stringify(hit.el));
  copy.id = uid('el');
  copy.x = hit.el.x + 0.04;
  copy.y = hit.el.y + 0.04;
  copy.z = topZ(hit.panel) + 1;
  hit.panel.els.push(copy);
  pasteSel = copy.id;
  savePress();
  renderPress();
  toast('Duplicated');
}

// The same place on the next or previous page.
function moveElToPage(id, dir) {
  var hit = findEl(id);
  var ps = pressState();
  var to = hit && hit.page + dir;
  if (!hit || to < 1 || to > ps.panels.length) return;
  pasteMark();
  hit.panel.els.splice(hit.at, 1);
  hit.el.z = topZ(ps.panels[to - 1]) + 1;
  elsOf(ps.panels[to - 1]).push(hit.el);
  pastePage = to;
  pasteSel = hit.el.id;
  savePress();
  renderPress();
  toast('Moved to page ' + to);
}

// Lighter, darker, or the next screen, for a photo cutting or a page's photo.
function rescreenFrom(btn) {
  var a = Array.prototype.filter.call(btn.attributes, function (x) { return /^data-(elph|pgph)/.test(x.name); })[0];
  var kind = a.name.replace('data-', '');
  var onPage = kind.indexOf('pgph') === 0;
  var hitEl = onPage ? null : findEl(a.value);
  var panel = onPage ? panelOfPage(Number(a.value)) : null;
  var photo = onPage ? panel && panel.photo : hitEl && hitEl.el.photo;
  var meta = photo && photoMeta[photo];
  if (!meta) return;
  var change = /light$/.test(kind) ? { exp: 1 } : /dark$/.test(kind) ? { exp: -1 }
    : { style: SCREENS[(SCREENS.indexOf(meta.style) + 1) % SCREENS.length] };
  toast('Screening\u2026');
  rescreen(photo, change).then(function (id) {
    if (!id) return;
    pasteMark();
    if (onPage) panel.photo = id; else hitEl.el.photo = id;
    savePress();
    renderPress();
    var m = photoMeta[id];
    toast(SCREEN_LABEL[m.style] + (m.exp ? ' \u00b7 ' + (m.exp > 0 ? 'lighter ' : 'darker ') + Math.abs(m.exp) : ''));
  }).catch(function (e) { toast('Could not screen it again: ' + e.message); });
}

// Repaint as it is typed, so the cutting grows and records its breaks.
// A photograph's description: read aloud by screen readers, and printed
// under it in the text view.
document.addEventListener('input', function (ev) {
  if (ev.target.id !== 'alttext' || !pasteSel) return;
  updateEl(pasteSel, { alt: ev.target.value.trim() });
  var node = liveEl(pasteSel);
  var img = node && node.querySelector('img');
  if (img) img.alt = ev.target.value.trim();
});

document.addEventListener('input', function (ev) {
  if (ev.target.id !== 'ransomtext' || !pasteSel) return;
  updateEl(pasteSel, { text: ev.target.value });
  // The panel only: rebuilding the inspector would destroy this very field.
  var node = liveEl(pasteSel);
  var panelEl = node && node.closest('.panel');
  var panel = panelEl && panelOfPage(Number(panelEl.getAttribute('data-page')));
  if (panel) paintPasteup(panelEl, panel);
});

// Which panel a new cutting lands on is simply the last one touched.
document.addEventListener('pointerdown', function (ev) {
  var p = ev.target.closest && ev.target.closest('.panel');
  if (!p) return;
  var page = Number(p.getAttribute('data-page'));
  if (page && page !== pastePage) { pastePage = page; renderInspector(); }
});
