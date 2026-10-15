// ---------- the scene's kit ----------
// The stamps a press ships with are a starter kit. The scene's own are
// whatever it has made: a bat drawn once with the pen, a cut-out photograph,
// a ransom-note logo. KEEP AS A STAMP puts a cutting in the kit; the STAMP
// palette offers it after the starters; placing it glues down a copy. The
// kit is kept with the scene, rides in every issue file the scene hands on
// and in its backups, so the press somebody is handed offers the same kit.

function kitOf() {
  if (!Array.isArray(state.kit)) state.kit = [];
  return state.kit;
}

// Only what a cutting is, never where it was: no id, no place, no stack.
function kitTemplate(el) {
  var t = JSON.parse(JSON.stringify(el));
  ['id', 'x', 'y', 'z', 'ghost', 'folio', 'lines'].forEach(function (k) { delete t[k]; });
  t.rot = 0;
  return t;
}

function cleanKit(raw) {
  return (Array.isArray(raw) ? raw : []).filter(function (k) {
    return k && typeof k.id === 'string' && k.el && typeof k.el === 'object' &&
      ['draw', 'photo', 'text', 'stamp', 'box', 'rule', 'qr'].indexOf(k.el.kind) >= 0;
  }).map(function (k) {
    return { id: k.id.slice(0, 40), name: String(k.name || 'stamp').slice(0, 40), el: k.el, ts: k.ts || 0 };
  });
}

function kitName(el) {
  if (el.kind === 'draw') return 'drawing';
  if (el.kind === 'photo') return el.alt ? String(el.alt).slice(0, 30) : 'cut-out';
  if (el.kind === 'text') return String(el.text || 'words').split(/\s+/).slice(0, 3).join(' ');
  return el.kind;
}

function keepAsStamp(id) {
  var hit = findEl(id);
  if (!hit || isFolio(hit.el)) return;
  kitOf().push({ id: uid('kt'), name: kitName(hit.el), el: kitTemplate(hit.el), ts: Date.now() });
  saveState();
  renderPress();
  toast('Kept as a stamp. It is under STAMP, and it rides in every file this scene hands on.');
}

function placeKit(id) {
  var k = kitOf().filter(function (x) { return x.id === id; })[0];
  var panel = panelOfPage(pastePage);
  if (!k || !panel) return;
  pasteMark();
  var el = JSON.parse(JSON.stringify(k.el));
  el.id = uid('el');
  el.w = Math.min(el.w || 0.3, 1.2);
  el.h = Math.min(el.h || 0.2, 1.2);
  el.x = Math.max(-0.1, 0.5 - el.w / 2);
  el.y = Math.max(-0.1, 0.4 - el.h / 2);
  el.z = topZ(panel) + 1;
  if (!el.colour && inkForPage(panel) && el.kind !== 'photo' && el.kind !== 'qr') el.colour = inkForPage(panel);
  elsOf(panel).push(el);
  pasteSel = el.id;
  savePress();
}

function forgetKit(id) {
  state.kit = kitOf().filter(function (x) { return x.id !== id; });
  saveState();
  renderStampPalette(true);
  setTimeout(sweepPhotos, 500);
}

// The scene's own, after the starters, each drawn the way it prints.
function kitPaletteHtml() {
  return kitOf().map(function (k) {
    var ar = Math.max(0.3, Math.min(4, (k.el.w || 0.3) / (k.el.h || 0.2) / 1.5));
    return '<span class="kitstamp"><button class="stampbtn" data-kit="' + esc(k.id) + '" title="' + esc(k.name) +
      '" aria-label="' + esc(k.name) + ', a stamp of this scene’s" style="aspect-ratio:' + ar.toFixed(2) + '">' +
      '<span class="el el-' + esc(k.el.kind) + '" style="position:relative;display:block;width:100%;height:100%;' +
      (inkOf(k.el) ? '--ink:' + inkOf(k.el) : '') + '">' + elBody(k.el, photoCache, false, false) + '</span></button>' +
      '<button class="log-del" data-unkit="' + esc(k.id) + '" title="Forget this stamp" aria-label="Forget this stamp">✕</button></span>';
  }).join('');
}

document.addEventListener('click', function (ev) {
  var t = ev.target, el;
  if (!t.closest) return;
  if ((el = t.closest('[data-elkeep]'))) { keepAsStamp(el.getAttribute('data-elkeep')); return; }
  if ((el = t.closest('[data-unkit]'))) { forgetKit(el.getAttribute('data-unkit')); return; }
  if ((el = t.closest('[data-kit]'))) {
    placeKit(el.getAttribute('data-kit'));
    renderStampPalette(false);
    renderPress();
    toast('Stamped. Drag it, turn it.');
  }
});
