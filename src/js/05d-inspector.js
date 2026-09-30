// ---------- the inspector ----------
// Geometry is done by hand on the sheet. Everything that is not geometry —
// which voice, how big, knocked out or not, which ink, what order things
// stack in — lives here, in one strip, rather than in a popover floating
// over a panel that might itself be upside down.
var pastePage = 1;

function pasteTargetLabel() {
  var ps = pressState();
  return 'page ' + pastePage + ' of ' + ps.panels.length;
}

// The sheet is three groups in a fixed order, so hands learn where things
// are: what a cutting is, how it looks, where it sits, and REMOVE alone at
// the foot. Each group folds; the fold is remembered until the page reloads,
// and a phone starts with the last one folded.
var groupOpen = null;
function groupsDefault() {
  var phone = window.matchMedia && matchMedia('(max-width: 640px)').matches;
  return { what: true, look: true, where: !phone, page: !phone };
}

function btnRow(pairs, key) {
  return pairs.map(function (pair) {
    return '<button class="btn quiet" data-' + pair[0] + '="' + esc(String(key)) + '">' + esc(pair[1]) + '</button>';
  }).join('');
}

function groupHtml(name, title, inner) {
  if (!inner) return '';
  if (!groupOpen) groupOpen = groupsDefault();
  return '<details class="group" data-group="' + name + '"' + (groupOpen[name] ? ' open' : '') + '><summary>' + title +
    '</summary><div class="groupbody">' + inner + '</div></details>';
}

function whatHtml(el) {
  var out = '';
  if (el.kind === 'text') out += voiceSelect(el);
  if (el.kind === 'photo' && photoMeta[el.photo]) out += lookSelect('ellook', el.id, photoMeta[el.photo].style);
  if (el.kind === 'text' && (voiceOf(el) === 'ransom' || voiceOf(el) === 'marker')) {
    out += '<textarea class="text-input" id="ransomtext" rows="2" placeholder="' +
      (voiceOf(el) === 'ransom' ? 'Cut the letters from a magazine' : 'Write it with the fat pen') +
      '">' + esc(el.text || '') + '</textarea>';
  }
  if (el.kind === 'qr') {
    out += '<input class="text-input" id="qrtext" maxlength="270" placeholder="A link, a phone number, anything to scan" value="' +
      esc(el.text || '') + '">';
  }
  if (el.kind === 'photo') {
    out += '<input class="text-input" id="alttext" maxlength="200" placeholder="What is in it, for anyone who cannot see it" value="' +
      esc(el.alt || '') + '">';
  }
  return out;
}

function lookHtml(el) {
  var b = [];
  if (el.kind === 'text') {
    b.push(['elsmaller', 'A\u2212'], ['elbigger', 'A+']);
    b = b.concat(typeButtons(el));
    b.push(['elink', el.ink === 'white' ? 'KNOCKED OUT' : 'ON THE PAGE']);
  }
  if (el.kind === 'box') b.push(['elink', el.ink === 'white' ? 'SOLID' : 'OUTLINE']);
  if (el.kind === 'photo') b.push(['elcrop', el.crop ? 'FILLING THE BOX' : 'WHOLE FRAME'], ['elfillpage', 'FILL THE PAGE']);
  if (el.kind === 'photo' && photoMeta[el.photo]) b.push(['elphlight', 'LIGHTER'], ['elphdark', 'DARKER']);
  return btnRow(b, el.id) + inkSwatches(el);
}

function whereHtml(el) {
  var b = [];
  var at = findEl(el.id);
  var pages = pressState().panels.length;
  if (at && at.page > 1) b.push(['elprevpage', '\u25c0 PAGE ' + (at.page - 1)]);
  if (at && at.page < pages) b.push(['elnextpage', 'PAGE ' + (at.page + 1) + ' \u25b6']);
  b.push(['eldup', 'DUPLICATE'], ['elfront', 'FRONT'], ['elback', 'BACK'], ['elstraight', 'STRAIGHTEN']);
  return btnRow(b, el.id);
}

function pageSheetHtml(page) {
  var panel = panelOfPage(page);
  var m = panel.photo && photoMeta[panel.photo];
  var fillName = FILLS.filter(function (f) { return f[1] === fillOf(panel); })[0];
  var summary = '<b>PAGE ' + page + '</b><span class="sub">' + (fillName ? fillName[0].toLowerCase() : 'white') +
    ' \u00b7 ' + (whiteLetters(panel) ? 'white' : 'black') + ' letters' + (panel.photo ? ' \u00b7 a photo' : '') + '</span>';
  var inner = (m ? lookSelect('pglook', page, m.style) + btnRow([['pgphlight', 'LIGHTER'], ['pgphdark', 'DARKER']], page) : '') +
    pageButtons(page) + fillSwatches(page);
  return groupHtml('page', summary, inner);
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
  if (!el && page) {
    // The page itself: its colour, its letters, and its own photograph, the
    // one a piece brought or the cover's.
    box.className = 'inspector on page';
    box.innerHTML = pageSheetHtml(pastePage);
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
    '<span class="sub">' + rot + '\u00b0 \u00b7 ' + Math.round(el.w * 100) + '\u00d7' +
    Math.round(el.h * 100) + ' of the panel</span>' +
    '<button class="btn quiet tiny sheetdone" data-closesheet="1" title="Done with this cutting">DONE</button></div>' +
    groupHtml('what', 'WHAT IT IS', whatHtml(el)) +
    groupHtml('look', 'HOW IT LOOKS', lookHtml(el)) +
    groupHtml('where', 'WHERE IT SITS', whereHtml(el)) +
    '<div class="sheetfoot"><button class="btn quiet danger" data-eldrop="' + esc(el.id) + '">REMOVE</button></div>';
}

document.addEventListener('toggle', function (ev) {
  var g = ev.target.closest && ev.target.closest('#inspector .group');
  if (!g) return;
  if (!groupOpen) groupOpen = groupsDefault();
  groupOpen[g.getAttribute('data-group')] = g.open;
}, true);

document.addEventListener('click', function (ev) {
  if (!(ev.target.closest && ev.target.closest('[data-closesheet]'))) return;
  pasteSel = null;
  renderPress();
});

function addToPasteup(kind) {
  if (kind === 'photo') {
    // A photograph comes from the device, through the same intake as a drop.
    var input = document.getElementById('pastephotofile');
    if (input) input.click();
    return;
  }
  var extra = {};
  if (kind === 'text') extra.text = 'NEW CUTTING';
  if (kind === 'qr') extra.text = defaultCodeText();
  addEl(pastePage, kind, extra);
  renderPress();
  toast(kind === 'text' ? 'Type into it, or change its voice below'
    : kind === 'qr' ? 'Type what it should open below' : 'Drag it where you want it');
}

document.addEventListener('click', function (ev) {
  var t = ev.target;
  var hit = function (sel) { return t.closest && t.closest(sel); };
  var el;

  if ((el = hit('[data-addel]'))) { addToPasteup(el.getAttribute('data-addel')); return; }
  if (hit('#undobtn')) { pasteUndoStep(); return; }
  if (hit('#redobtn')) { pasteRedoStep(); return; }
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
  var shot = hit('[data-elphlight],[data-elphdark],[data-pgphlight],[data-pgphdark]');
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

// The looks a photograph can take, as a list, for a cutting or a page.
function lookSelect(kind, key, now) {
  return '<select class="voicesel" data-' + kind + '="' + esc(String(key)) + '" aria-label="Look">' + LOOKS.map(function (l) {
    return '<option value="' + l + '"' + (l === now ? ' selected' : '') + '>' + LOOK_LABEL[l] + '</option>';
  }).join('') + '</select>';
}

document.addEventListener('change', function (ev) {
  var s = ev.target.closest && ev.target.closest('[data-ellook],[data-pglook]');
  if (!s || LOOKS.indexOf(s.value) < 0) return;
  var onPage = s.hasAttribute('data-pglook');
  rescreenOn(onPage, s.getAttribute(onPage ? 'data-pglook' : 'data-ellook'), { style: s.value });
});

// Lighter or darker, for a photo cutting or a page's photo.
function rescreenFrom(btn) {
  var a = Array.prototype.filter.call(btn.attributes, function (x) { return /^data-(elph|pgph)/.test(x.name); })[0];
  var kind = a.name.replace('data-', '');
  rescreenOn(kind.indexOf('pgph') === 0, a.value, /light$/.test(kind) ? { exp: 1 } : { exp: -1 });
}

function rescreenOn(onPage, key, change) {
  var hitEl = onPage ? null : findEl(key);
  var panel = onPage ? panelOfPage(Number(key)) : null;
  var photo = onPage ? panel && panel.photo : hitEl && hitEl.el.photo;
  var meta = photo && photoMeta[photo];
  if (!meta) return;
  toast('Redoing the photo\u2026');
  rescreen(photo, change).then(function (id) {
    if (!id) return;
    pasteMark();
    if (onPage) panel.photo = id; else hitEl.el.photo = id;
    savePress();
    renderPress();
    var m = photoMeta[id];
    toast(LOOK_LABEL[m.style] + (m.exp ? ' \u00b7 ' + (m.exp > 0 ? 'lighter ' : 'darker ') + Math.abs(m.exp) : ''));
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
