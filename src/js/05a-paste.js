// ---------- the paste-up ----------
// A zine is not a document. It is a board somebody glued things onto and then
// photocopied, and its grammar is overlap, tilt, mixed type and grain. The
// flowed text on a panel — h and body — is the editorial substrate: it comes
// from the desk and re-flows when the format changes. Everything in els is the
// paste-up on top of it, placed by hand, at any angle, over anything.
//
// Positions are fractions of the panel, never points. A panel is a different
// size in every format, and a paste-up that only worked at Letter fold-8 would
// break the one promise the press already makes: change the vessel, retype
// nothing. Fractions move with the panel, so a collage survives the change the
// same way a paragraph does.

var VOICES = ['type', 'head', 'ransom', 'hand'];
var VOICE_SIZE = { type: 11.5, head: 20, ransom: 15, hand: 14 };
var VOICE_LABEL = { type: 'TYPEWRITER', head: 'HEADLINE', ransom: 'RANSOM', hand: 'HAND' };
var pasteSel = null;
// A text cutting is a thing you move until you say otherwise. Editable text
// under the pointer would eat the drag, so typing is a mode you enter on a
// double click and leave on Escape, the way every other canvas works.
var pasteEditing = null;

function elsOf(panel) {
  if (!panel) return [];
  if (!Array.isArray(panel.els)) panel.els = [];
  return panel.els;
}

function panelOfPage(page) {
  return pressState().panels[page - 1] || null;
}

function findEl(id) {
  var ps = pressState();
  for (var i = 0; i < ps.panels.length; i++) {
    var els = elsOf(ps.panels[i]);
    for (var j = 0; j < els.length; j++) {
      if (els[j].id === id) return { el: els[j], panel: ps.panels[i], page: i + 1, at: j };
    }
  }
  return null;
}

function selectedEl() {
  var hit = pasteSel ? findEl(pasteSel) : null;
  return hit ? hit.el : null;
}

// ---------- undo ----------
// Direct manipulation without undo is a dare, not a tool. The whole panel
// array is snapshotted, which is cheap next to the photographs it points at
// and means a step never half-applies. Typing is snapshotted once per editing
// session rather than per keystroke, on the way into the field.
var pasteUndo = [];
var pasteRedo = [];
var UNDO_DEPTH = 50;

function snapshot() {
  return JSON.stringify(pressState().panels);
}

function pasteMark() {
  pasteUndo.push(snapshot());
  if (pasteUndo.length > UNDO_DEPTH) pasteUndo.shift();
  pasteRedo.length = 0;
}

function pasteRestore(json) {
  var ps = pressState();
  ps.panels = JSON.parse(json);
  savePress();
  if (pasteSel && !findEl(pasteSel)) pasteSel = null;
  pageSig = '';
  renderPress();
}

function pasteUndoStep() {
  if (!pasteUndo.length) { toast('Nothing to undo'); return; }
  pasteRedo.push(snapshot());
  pasteRestore(pasteUndo.pop());
  toast('Undo');
}

function pasteRedoStep() {
  if (!pasteRedo.length) { toast('Nothing to redo'); return; }
  pasteUndo.push(snapshot());
  pasteRestore(pasteRedo.pop());
  toast('Redo');
}

// ---------- adding ----------
var PASTE_DEFAULTS = {
  text: { w: 0.52, h: 0.16 },
  photo: { w: 0.55, h: 0.34 },
  rule: { w: 0.66, h: 0.012 },
  box: { w: 0.45, h: 0.26 }
};

function topZ(panel) {
  return elsOf(panel).reduce(function (m, e) { return Math.max(m, e.z || 0); }, 0);
}

// Nothing you tape to a board lands square. A couple of degrees either way is
// the difference between a zine and a memo, so new work arrives slightly
// crooked and the rotate handle resets to straight on a double click.
function crooked(seed) {
  return Math.round(((seed % 100) / 100 - 0.5) * 50) / 10;
}

function addEl(page, kind, extra) {
  var panel = panelOfPage(page);
  if (!panel) return null;
  pasteMark();
  var els = elsOf(panel);
  var size = PASTE_DEFAULTS[kind] || PASTE_DEFAULTS.text;
  // Each new cutting lands clear of the last one. A small offset buries them
  // in a pile and the fourth thing you add looks like it did not arrive.
  var nudge = (els.length % 6) * 0.075;
  var el = {
    id: uid('el'),
    kind: kind,
    x: Math.min(0.9 - size.w, 0.12 + nudge),
    y: Math.min(0.9 - size.h, 0.16 + nudge),
    w: size.w,
    h: size.h,
    rot: kind === 'rule' ? 0 : crooked(els.length * 37 + page * 13),
    z: topZ(panel) + 1
  };
  if (kind === 'text') {
    el.voice = (extra && extra.voice) || 'type';
    el.text = (extra && extra.text) || '';
    el.size = VOICE_SIZE[el.voice];
    el.ink = 'black';
  }
  if (kind === 'photo') el.photo = extra && extra.photo;
  if (kind === 'box') el.ink = (extra && extra.ink) || 'black';
  if (extra && extra.at) {
    el.x = Math.max(-0.2, Math.min(1, extra.at.x - el.w / 2));
    el.y = Math.max(-0.2, Math.min(1, extra.at.y - el.h / 2));
  }
  els.push(el);
  pasteSel = el.id;
  savePress();
  return el;
}

function removeEl(id) {
  var hit = findEl(id);
  if (!hit) return;
  pasteMark();
  hit.panel.els.splice(hit.at, 1);
  if (pasteSel === id) pasteSel = null;
  savePress();
  renderPress();
}

// ---------- changing one ----------
function updateEl(id, fields, mark) {
  var hit = findEl(id);
  if (!hit) return;
  if (mark) pasteMark();
  Object.keys(fields).forEach(function (k) { hit.el[k] = fields[k]; });
  savePress();
}

function raiseEl(id, toFront) {
  var hit = findEl(id);
  if (!hit) return;
  pasteMark();
  var els = elsOf(hit.panel);
  if (toFront) {
    hit.el.z = topZ(hit.panel) + 1;
  } else {
    var low = els.reduce(function (m, e) { return Math.min(m, e.z || 0); }, 0);
    hit.el.z = low - 1;
  }
  savePress();
  renderPress();
}

function cycleVoice(id) {
  var hit = findEl(id);
  if (!hit || hit.el.kind !== 'text') return;
  var next = VOICES[(VOICES.indexOf(hit.el.voice) + 1) % VOICES.length];
  updateEl(id, { voice: next, size: VOICE_SIZE[next] }, true);
  renderPress();
  toast(VOICE_LABEL[next]);
}

function resizeText(id, by) {
  var hit = findEl(id);
  if (!hit || hit.el.kind !== 'text') return;
  updateEl(id, { size: Math.max(6, Math.min(96, (hit.el.size || 12) + by)) }, true);
  renderPress();
}

// A photograph on the paste-up can be any shape the panel allows, so the
// element remembers whether it is showing the whole frame or filling its box.
function toggleCrop(id) {
  var hit = findEl(id);
  if (!hit || hit.el.kind !== 'photo') return;
  updateEl(id, { crop: !hit.el.crop }, true);
  renderPress();
  toast(hit.el.crop ? 'Filling the box — edges cropped' : 'Whole frame, letterboxed');
}

// Black on white or white on black. A knocked-out headline over a photograph
// is half the visual grammar of the form and costs nothing to print.
function toggleInk(id) {
  var hit = findEl(id);
  if (!hit || (hit.el.kind !== 'text' && hit.el.kind !== 'box')) return;
  updateEl(id, { ink: hit.el.ink === 'white' ? 'black' : 'white' }, true);
  renderPress();
}
