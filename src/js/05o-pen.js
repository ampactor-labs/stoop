// ---------- the pen ----------
// Half the zines on a coffee-shop table are drawn by hand. PEN draws on a
// page. A stroke is a cutting like any other: it moves, turns, scales,
// takes an ink, reaches the paper as lines, and rides in the file as
// points. Pen mode is entered by the button and left by Escape, the way
// typing is, so a finger still scrolls when it is off. Strokes are kept in
// fractions of the cutting's own box, with a base width in pixels and,
// from a pen that reports pressure, a multiple of it per point.
var penMode = false;
var penTarget = null;     // the draw cutting the next stroke joins
var penStroke = null;     // the stroke under the pointer, in page fractions
var PEN_WIDTH = 2.5;

function setPen(on, targetId) {
  penMode = !!on;
  penTarget = on ? (targetId || null) : null;
  penStroke = null;
  document.body.toggleAttribute('data-pen', penMode);
  var b = document.getElementById('penbtn');
  if (b) b.classList.toggle('on', penMode);
  if (penMode) {
    pasteEditing = null;
    var a = document.activeElement;
    if (a && a.blur && a.closest && a.closest('#sheetzone')) a.blur();
    toast('Draw on a page. Escape puts the pen down.');
  }
  renderInspector();
  var hint = document.getElementById('addhint');
  if (hint && penMode) hint.textContent = 'draw on a page \u00b7 every stroke joins the drawing \u00b7 Escape puts the pen down';
}

// Width from pressure where a pen reports it; a mouse reports a half.
function penWeight(ev) {
  var p = typeof ev.pressure === 'number' && ev.pressure > 0 ? ev.pressure : 0.5;
  return Math.max(0.3, Math.min(2, Math.round(p * 2 * 10) / 10));
}

function pageFraction(panelEl, ev) {
  var p = panelLocal(panelEl, ev.clientX, ev.clientY);
  return [Math.round(p.x / p.w * 1e4) / 1e4, Math.round(p.y / p.h * 1e4) / 1e4, penWeight(ev)];
}

// The strokes of a cutting, in page fractions and back: the box is refitted
// to everything drawn after each stroke, so the cutting is as big as the
// drawing and its handles land on it.
function strokesOnPage(el) {
  return (el.strokes || []).map(function (s) {
    return s.map(function (pt) { return [el.x + pt[0] * el.w, el.y + pt[1] * el.h, pt[2]]; });
  });
}

function refitDraw(el, strokes) {
  var xs = [], ys = [];
  strokes.forEach(function (s) { s.forEach(function (pt) { xs.push(pt[0]); ys.push(pt[1]); }); });
  var pad = 0.012;
  var x0 = Math.min.apply(null, xs) - pad, y0 = Math.min.apply(null, ys) - pad;
  var w = Math.max(0.03, Math.max.apply(null, xs) + pad - x0), h = Math.max(0.03, Math.max.apply(null, ys) + pad - y0);
  var r4 = function (v) { return Math.round(v * 1e4) / 1e4; };
  el.x = r4(x0); el.y = r4(y0); el.w = r4(w); el.h = r4(h);
  el.strokes = strokes.map(function (s) {
    return s.map(function (pt) {
      return [Math.round((pt[0] - x0) / w * 1e4) / 1e4, Math.round((pt[1] - y0) / h * 1e4) / 1e4, pt[2]];
    });
  });
}

function commitStroke(page, stroke) {
  if (stroke.length < 2) stroke.push([stroke[0][0] + 0.002, stroke[0][1] + 0.002, stroke[0][2]]);
  var panel = panelOfPage(page);
  if (!panel) return;
  pasteMark();
  var hit = penTarget && findEl(penTarget);
  var el = hit && hit.page === page ? hit.el : null;
  if (!el) {
    el = { id: uid('el'), kind: 'draw', x: 0, y: 0, w: 1, h: 1, rot: 0, z: topZ(panel) + 1, pen: PEN_WIDTH, strokes: [] };
    elsOf(panel).push(el);
  }
  refitDraw(el, strokesOnPage(el).concat([stroke]));
  penTarget = el.id;
  pasteSel = el.id;
  savePress();
  renderPress();
}

// ---------- on screen ----------
// Runs of one width become one polyline, so a mouse's stroke is a single
// path and a pen's is a few. Widths stay in pixels whatever the box does.
function strokeRuns(stroke) {
  var runs = [];
  stroke.forEach(function (pt, i) {
    var last = runs[runs.length - 1];
    if (last && last.w === pt[2]) { last.pts.push(pt); return; }
    var run = { w: pt[2], pts: last ? [last.pts[last.pts.length - 1], pt] : [pt] };
    if (i === 0) run.pts = [pt];
    runs.push(run);
  });
  return runs;
}

function drawSvg(el) {
  var pen = el.pen || PEN_WIDTH;
  var body = (el.strokes || []).map(function (s) {
    return strokeRuns(s).map(function (run) {
      var pts = run.pts.length === 1 ? run.pts.concat([run.pts[0]]) : run.pts;
      return '<polyline points="' + pts.map(function (p) { return (p[0] * 100).toFixed(2) + ',' + (p[1] * 100).toFixed(2); }).join(' ') +
        '" stroke-width="' + (pen * run.w).toFixed(2) + '"/>';
    }).join('');
  }).join('');
  return '<svg class="drawsvg" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="currentColor" ' +
    'stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">' + body + '</svg>';
}

// The stroke under the pointer, drawn on the panel until it is committed.
function paintLiveStroke(panelEl) {
  var live = panelEl.querySelector('.penlive');
  if (!penStroke) { if (live) live.remove(); return; }
  if (!live) {
    live = document.createElement('div');
    live.className = 'penlive';
    panelEl.appendChild(live);
  }
  live.innerHTML = drawSvg({ x: 0, y: 0, w: 1, h: 1, strokes: [penStroke], pen: PEN_WIDTH });
}

// ---------- on paper ----------
function pdfElDraw(el, g) {
  var pen = (el.pen || PEN_WIDTH) * PT;
  var ops = 'q 1 J 1 j\n';
  (el.strokes || []).forEach(function (s) {
    strokeRuns(s).forEach(function (run) {
      var pts = run.pts.length === 1 ? run.pts.concat([run.pts[0]]) : run.pts;
      ops += (pen * run.w).toFixed(2) + ' w ' + pts.map(function (p, i) {
        return (g.x + p[0] * g.w).toFixed(2) + ' ' + (g.top - p[1] * g.h).toFixed(2) + (i ? ' l' : ' m');
      }).join(' ') + ' S\n';
    });
  });
  return ops + 'Q\n';
}

// ---------- events ----------
// In pen mode the pointer draws, whatever it lands on, so the paste-up's own
// pointer handling is stopped on the way down.
document.addEventListener('pointerdown', function (ev) {
  if (!penMode) return;
  var panelEl = ev.target.closest && ev.target.closest('#sheetzone .panel');
  if (!panelEl) return;
  ev.stopPropagation();
  ev.preventDefault();
  if (panelEl.setPointerCapture) { try { panelEl.setPointerCapture(ev.pointerId); } catch (e) {} }
  pastePage = Number(panelEl.getAttribute('data-page'));
  penStroke = [pageFraction(panelEl, ev)];
  paintLiveStroke(panelEl);
}, true);

document.addEventListener('pointermove', function (ev) {
  if (!penMode || !penStroke) return;
  var panelEl = document.querySelector('#sheetzone [data-page="' + pastePage + '"]');
  if (!panelEl) return;
  ev.stopPropagation();
  var pt = pageFraction(panelEl, ev);
  var last = penStroke[penStroke.length - 1];
  if (Math.abs(pt[0] - last[0]) < 0.003 && Math.abs(pt[1] - last[1]) < 0.003) return;
  penStroke.push(pt);
  paintLiveStroke(panelEl);
}, true);

function endStroke(ev) {
  if (!penMode || !penStroke) return;
  ev.stopPropagation();
  var stroke = penStroke;
  penStroke = null;
  var panelEl = document.querySelector('#sheetzone [data-page="' + pastePage + '"]');
  if (panelEl) paintLiveStroke(panelEl);
  commitStroke(pastePage, stroke);
}
document.addEventListener('pointerup', endStroke, true);
document.addEventListener('pointercancel', endStroke, true);

document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape' && penMode) { setPen(false); ev.stopPropagation(); }
}, true);

document.addEventListener('click', function (ev) {
  var t = ev.target;
  var el;
  if (t.closest && t.closest('#penbtn')) { setPen(!penMode); return; }
  if ((el = t.closest && t.closest('[data-elpenmore]'))) { setPen(true, el.getAttribute('data-elpenmore')); return; }
  if ((el = t.closest && t.closest('[data-elthinner],[data-elthicker]'))) {
    var thinner = el.hasAttribute('data-elthinner');
    var id = el.getAttribute(thinner ? 'data-elthinner' : 'data-elthicker');
    var hit = findEl(id);
    if (!hit) return;
    updateEl(id, { pen: Math.max(0.5, Math.min(24, Math.round(((hit.el.pen || PEN_WIDTH) + (thinner ? -0.5 : 0.5)) * 10) / 10)) }, true);
    renderPress();
  }
});
