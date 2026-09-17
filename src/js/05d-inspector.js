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
    b.push(['elvoice', VOICE_LABEL[el.voice || 'type']]);
    b.push(['elsmaller', 'A−']);
    b.push(['elbigger', 'A+']);
    b.push(['elink', el.ink === 'white' ? 'KNOCKED OUT' : 'BLACK ON WHITE']);
  }
  if (el.kind === 'box') b.push(['elink', el.ink === 'white' ? 'OUTLINE' : 'SOLID']);
  if (el.kind === 'photo') b.push(['elcrop', el.crop ? 'FILLING THE BOX' : 'WHOLE FRAME']);
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
  if (hint) hint.textContent = 'Adding to ' + pasteTargetLabel() + '.';

  var el = selectedEl();
  if (!el) {
    box.className = 'inspector';
    box.innerHTML = '<span class="sub">Nothing selected. Click something on the sheet, ' +
      'or add a cutting above. Drag to move, double-click a text cutting to type ' +
      'into it, Escape to come back out. Arrow keys nudge, [ and ] change what is ' +
      'on top, Alt drags off the grid, Shift turns in steps of fifteen.</span>';
    return;
  }
  box.className = 'inspector on';
  var rot = Math.round(el.rot || 0);
  box.innerHTML = '<div class="insp-head"><b>' + esc(el.kind.toUpperCase()) + '</b>' +
    '<span class="sub">' + rot + '° · ' + Math.round(el.w * 100) + '×' +
    Math.round(el.h * 100) + ' of the panel</span></div>' +
    '<div class="press-actions">' + inspectorButtons(el) + '</div>' +
    (el.kind === 'text' && el.voice === 'ransom'
      ? '<textarea class="text-input" id="ransomtext" rows="2" ' +
        'placeholder="Cut the letters from a magazine">' + esc(el.text || '') + '</textarea>'
      : '');
}

// A photograph arrives from the tray: whatever is armed, or the most recent
// one, because making somebody arm a photo before they can place one is a
// step that teaches nothing.
function pastePhotoId() {
  if (armedPhoto && photoCache[armedPhoto]) return armedPhoto;
  var recent = state.logs.slice().sort(function (x, y) { return y.ts - x.ts; })
    .filter(function (l) { return l.photo && photoCache[l.photo]; })[0];
  if (recent) return recent.photo;
  var any = Object.keys(photoCache);
  return any.length ? any[0] : null;
}

function addToPasteup(kind) {
  var extra = {};
  if (kind === 'photo') {
    extra.photo = pastePhotoId();
    if (!extra.photo) { toast('No photos yet — add one from the log first'); return; }
  }
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
  if ((el = hit('[data-eldrop]'))) { removeEl(el.getAttribute('data-eldrop')); }
});

document.addEventListener('input', function (ev) {
  if (ev.target.id !== 'ransomtext' || !pasteSel) return;
  updateEl(pasteSel, { text: ev.target.value });
  var zone = document.getElementById('sheetzone');
  var node = zone && zone.querySelector('[data-el="' + pasteSel + '"] .eltext');
  if (node) node.innerHTML = ransomHtml(ev.target.value);
});

// Which panel a new cutting lands on is simply the last one touched.
document.addEventListener('pointerdown', function (ev) {
  var p = ev.target.closest && ev.target.closest('.panel');
  if (!p) return;
  var page = Number(p.getAttribute('data-page'));
  if (page && page !== pastePage) { pastePage = page; renderInspector(); }
});
