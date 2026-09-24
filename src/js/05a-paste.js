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

var VOICES = ['type', 'head', 'marker', 'stencil', 'ransom'];
var VOICE_SIZE = { type: 11.5, head: 20, marker: 18, stencil: 22, ransom: 15 };
var VOICE_LABEL = { type: 'TYPEWRITER', head: 'HEADLINE', marker: 'MARKER', stencil: 'STENCIL', ransom: 'RANSOM' };
// Issues made before the marker existed called their pen voice "hand".
function voiceOf(el) { return el.voice === 'hand' ? 'marker' : (el.voice || 'type'); }
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
  var ps = pressState();
  return JSON.stringify({ format: ps.format, panels: ps.panels, spare: ps.spare || [] });
}

function pasteMark() {
  pasteUndo.push(snapshot());
  if (pasteUndo.length > UNDO_DEPTH) pasteUndo.shift();
  pasteRedo.length = 0;
}

function pasteRestore(json) {
  var ps = pressState();
  var snap = JSON.parse(json);
  if (Array.isArray(snap)) snap = { format: ps.format, panels: snap, spare: ps.spare };
  if (FORMATS[snap.format]) ps.format = snap.format;
  ps.panels = snap.panels;
  ps.spare = snap.spare || [];
  savePress();
  if (pasteSel && !findEl(pasteSel)) pasteSel = null;
  pageSig = '';
  renderPress();
}

// A new draft or a replaced store starts its own history.
function forgetUndo() {
  pasteUndo.length = 0;
  pasteRedo.length = 0;
  flowSnap = null;
  pasteSel = null;
  pasteEditing = null;
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

// Typing into a page or a cutting's text box is a step too: the state is
// taken on the way into the field and kept once something is typed.
var flowSnap = null;
function isFlowField(t) {
  return !!t && (t.id === 'ransomtext' || t.id === 'issueno' ||
    (!!t.closest && !!t.closest('#sheetzone') && /^(H3)$/.test(t.tagName)) ||
    (!!t.classList && t.classList.contains('body') && !!t.closest && !!t.closest('#sheetzone')));
}
document.addEventListener('focusin', function (ev) { if (isFlowField(ev.target)) flowSnap = snapshot(); });
document.addEventListener('input', function (ev) {
  if (!flowSnap || !isFlowField(ev.target)) return;
  pasteUndo.push(flowSnap);
  if (pasteUndo.length > UNDO_DEPTH) pasteUndo.shift();
  pasteRedo.length = 0;
  flowSnap = null;
}, true);

// ---------- adding ----------
var PASTE_DEFAULTS = {
  text: { w: 0.52, h: 0.16 },
  photo: { w: 0.55, h: 0.34 },
  rule: { w: 0.66, h: 0.012 },
  box: { w: 0.45, h: 0.26 },
  stamp: { w: 0.3, h: 0.12 }
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
  if (kind === 'stamp') {
    el.stamp = (extra && extra.stamp) || 'free';
    var st = STAMPS[el.stamp] || PASTE_DEFAULTS.stamp;
    el.w = st.w; el.h = st.h;
    el.rot = crooked(els.length * 53 + page * 7) * 2;
  }
  if (extra && extra.at) {
    el.x = Math.max(-0.2, Math.min(1, extra.at.x - el.w / 2));
    el.y = Math.max(-0.2, Math.min(1, extra.at.y - el.h / 2));
  }
  els.push(el);
  pasteSel = el.id;
  // The new cutting has the keyboard: arrows nudge it, not a caret in the page.
  var a = document.activeElement;
  if (a && a.blur && a.closest && a.closest('#sheetzone')) a.blur();
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
function updateEl(id, fields, mark, quiet) {
  var hit = findEl(id);
  if (!hit) return;
  if (mark) pasteMark();
  Object.keys(fields).forEach(function (k) { hit.el[k] = fields[k]; });
  if (!quiet) savePress();
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
  var next = VOICES[(VOICES.indexOf(voiceOf(hit.el)) + 1) % VOICES.length];
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
