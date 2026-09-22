// ---------- direct manipulation ----------
// Pages are zoomed to fit the column, which is the only difficulty here.
// Every gesture works in panel-local pixels taken from the live bounding box,
// and that absorbs the zoom for free.
var grab = null;
var GRID = 1 / 24;

function panelLocal(panelEl, cx, cy) {
  var r = panelEl.getBoundingClientRect();
  return { x: cx - r.left, y: cy - r.top, w: r.width, h: r.height };
}

function snap(v, on) {
  return on ? Math.round(v / GRID) * GRID : v;
}

function clamp01(v, span) {
  return Math.max(-0.25, Math.min(1.25 - span, v));
}

function startGrab(ev, mode, elNode) {
  var panelEl = elNode.closest('.panel');
  var hit = findEl(elNode.getAttribute('data-el'));
  if (!panelEl || !hit) return;
  var p = panelLocal(panelEl, ev.clientX, ev.clientY);
  pasteMark();
  grab = {
    mode: mode,
    id: hit.el.id,
    panelEl: panelEl,
    start: p,
    from: { x: hit.el.x, y: hit.el.y, w: hit.el.w, h: hit.el.h, rot: hit.el.rot || 0 },
    moved: false
  };
  if (mode === 'rot') {
    var cx = (hit.el.x + hit.el.w / 2) * p.w;
    var cy = (hit.el.y + hit.el.h / 2) * p.h;
    grab.angle0 = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI;
  }
  ev.preventDefault();
}

function moveGrab(ev) {
  if (!grab) return;
  var p = panelLocal(grab.panelEl, ev.clientX, ev.clientY);
  var f = grab.from;
  var fine = ev.altKey;
  grab.moved = true;

  if (grab.mode === 'move') {
    var dx = (p.x - grab.start.x) / p.w;
    var dy = (p.y - grab.start.y) / p.h;
    updateEl(grab.id, {
      x: clamp01(snap(f.x + dx, !fine), f.w),
      y: clamp01(snap(f.y + dy, !fine), f.h)
    });
  } else if (grab.mode === 'size') {
    // The delta is turned back through the element's own rotation, so dragging
    // the corner of a crooked cutting grows it along its own edges.
    var a = -(f.rot || 0) * Math.PI / 180;
    var mx = p.x - grab.start.x;
    var my = p.y - grab.start.y;
    var rx = mx * Math.cos(a) - my * Math.sin(a);
    var ry = mx * Math.sin(a) + my * Math.cos(a);
    updateEl(grab.id, {
      w: Math.max(0.04, snap(f.w + rx / p.w, !fine)),
      h: Math.max(0.015, snap(f.h + ry / p.h, !fine))
    });
  } else if (grab.mode === 'rot') {
    var ccx = (f.x + f.w / 2) * p.w;
    var ccy = (f.y + f.h / 2) * p.h;
    var now = Math.atan2(p.y - ccy, p.x - ccx) * 180 / Math.PI;
    var rot = f.rot + (now - grab.angle0);
    if (ev.shiftKey) rot = Math.round(rot / 15) * 15;
    else if (Math.abs(rot) < 1.5) rot = 0;          // straight is findable by hand
    updateEl(grab.id, { rot: Math.round(rot * 10) / 10 });
  }
  paintOnePanel(grab.panelEl);
}

function endGrab() {
  if (!grab) return;
  // A gesture that never moved is a click; it should not cost an undo step.
  if (!grab.moved) pasteUndo.pop();
  grab = null;
  renderPress();
}

function paintOnePanel(panelEl) {
  var page = Number(panelEl.getAttribute('data-page'));
  var panel = panelOfPage(page);
  if (panel) paintPasteup(panelEl, panel);
  renderInspector();
}

// Repainting a panel swaps its paste-up layer wholesale, so any node captured
// before a repaint is detached and every call on it silently does nothing.
// Anything that selects and then acts has to ask the document again.
function liveEl(id) {
  return document.querySelector('.el[data-el="' + id + '"]');
}

function selectEl(id) {
  pasteSel = id;
  var zone = document.getElementById('sheetzone');
  if (zone) {
    zone.querySelectorAll('.panel').forEach(function (p) {
      var page = Number(p.getAttribute('data-page'));
      var panel = panelOfPage(page);
      if (panel) paintPasteup(p, panel);
    });
  }
  renderInspector();
}

document.addEventListener('pointerdown', function (ev) {
  var handle = ev.target.closest && ev.target.closest('.h[data-grab]');
  if (handle) {
    startGrab(ev, handle.getAttribute('data-grab'), handle.closest('.el'));
    return;
  }
  var node = ev.target.closest && ev.target.closest('.el');
  if (node) {
    var id = node.getAttribute('data-el');
    if (id !== pasteSel) {
      pasteEditing = null;
      selectEl(id);
      node = liveEl(id) || node;
    }
    // A cutting being typed into owns its own pointer, or selecting a word
    // inside it would drag the whole thing across the panel instead.
    if (ev.target.isContentEditable) return;
    startGrab(ev, 'move', node);
    return;
  }
  if (ev.target.closest && ev.target.closest('.panel') && (pasteSel || pasteEditing)) {
    pasteEditing = null;
    selectEl(null);
  }
});

document.addEventListener('pointermove', moveGrab);
document.addEventListener('pointerup', endGrab);
document.addEventListener('pointercancel', endGrab);

// Double-clicking the turn handle puts a cutting back on the square.
// Double-clicking a text cutting is how you get into it.
document.addEventListener('dblclick', function (ev) {
  var h = ev.target.closest && ev.target.closest('.h-rot');
  if (h) {
    updateEl(h.closest('.el').getAttribute('data-el'), { rot: 0 }, true);
    renderPress();
    return;
  }
  var node = ev.target.closest && ev.target.closest('.el');
  if (!node) return;
  var hit = findEl(node.getAttribute('data-el'));
  if (!hit || hit.el.kind !== 'text') return;
  if (voiceOf(hit.el) === 'ransom' || voiceOf(hit.el) === 'marker') {
    // These are typed in the inspector; the double-click still has to land
    // somewhere, so it lands there.
    selectEl(hit.el.id);
    var area = document.getElementById('ransomtext');
    if (area) { area.focus(); area.select(); }
    return;
  }
  pasteEditing = hit.el.id;
  selectEl(hit.el.id);
  var live = liveEl(hit.el.id);
  var field = live && live.querySelector('.eltext');
  if (field) {
    field.focus();
    var r = document.createRange();
    r.selectNodeContents(field);
    r.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
});

// Typing into a pasted text element. The model is written on input; the undo
// step is taken once, when the field is first entered.
document.addEventListener('focusin', function (ev) {
  if (ev.target.hasAttribute && ev.target.hasAttribute('data-eltext')) pasteMark();
});
document.addEventListener('input', function (ev) {
  var t = ev.target;
  if (!t.hasAttribute || !t.hasAttribute('data-eltext')) return;
  updateEl(t.getAttribute('data-eltext'), { text: t.innerText });
});

document.addEventListener('keydown', function (ev) {
  var key = ev.key;
  var meta = ev.metaKey || ev.ctrlKey;
  if (meta && (key === 'z' || key === 'Z')) {
    if (document.activeElement && document.activeElement.isContentEditable) return;
    ev.preventDefault();
    if (ev.shiftKey) pasteRedoStep(); else pasteUndoStep();
    return;
  }
  if (key === 'Escape' && pasteEditing) {
    pasteEditing = null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    selectEl(pasteSel);
    return;
  }
  if (key === 'Escape' && document.activeElement && document.activeElement.id === 'ransomtext') {
    document.activeElement.blur();   // out of the field, cutting still chosen
    return;
  }
  if (!pasteSel) return;
  if (document.activeElement && document.activeElement.isContentEditable) return;
  var el = selectedEl();
  if (!el) return;
  var step = ev.shiftKey ? 0.02 : 0.004;
  var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[key]) {
    ev.preventDefault();
    pasteMark();
    updateEl(pasteSel, { x: clamp01(el.x + moves[key][0], el.w), y: clamp01(el.y + moves[key][1], el.h) });
    renderPress();
    return;
  }
  if (key === 'Delete' || key === 'Backspace') { ev.preventDefault(); removeEl(pasteSel); return; }
  if (key === 'Escape') { pasteEditing = null; selectEl(null); return; }
  if (key === ']') { ev.preventDefault(); raiseEl(pasteSel, true); return; }
  if (key === '[') { ev.preventDefault(); raiseEl(pasteSel, false); }
});
