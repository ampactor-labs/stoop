// ---------- drawing the paste-up ----------
// One renderer serves the editable press, the shelf, and the exported issue,
// because an issue that looked different on the machine it was made on would
// make the self-carrying file a lie.

function hash32(s) {
  var h = 2166136261;
  for (var i = 0; i < String(s).length; i++) {
    h ^= String(s).charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Ransom note. Every character is cut from a different magazine, which means
// a different face, size, tilt and sometimes a knocked-out block. The jitter
// is derived from the element's id and the character's position rather than
// from a random number, so the letters sit in exactly the same places on the
// screen, in the PDF, and on the machine that opens the issue next week.
// One description of the cut letters, read by the screen and by the PDF
// writer. If these two derived the jitter separately they would drift, and a
// press whose paper does not match its screen is not a press.
function ransomSpec(text) {
  return String(text || '').split('').map(function (ch, i) {
    // Unsigned shifts throughout: hash32 fills all 32 bits, and >> would read
    // the top bit as a sign for half of all characters, which lands a negative
    // face index and a negative type size.
    var r = hash32(i + ':' + ch + ':' + (i * 7));
    return {
      ch: ch,
      tilt: (r % 15) - 7,
      scale: 0.78 + ((r >>> 5) % 55) / 100,
      inv: ((r >>> 11) % 5) === 0,
      face: (r >>> 13) % 4
    };
  });
}

// Marker: every word written a little differently, the way a hand does.
function markerSpec(text) {
  return String(text || '').split(/(\s+)/).map(function (w, i) {
    if (!w.trim()) return { ch: w, space: true };
    var r = hash32('m' + i + ':' + w);
    return { ch: w, tilt: ((r % 9) - 4) * 0.6, scale: 0.94 + ((r >>> 5) % 13) / 100 };
  });
}

function markerHtml(text) {
  return markerSpec(text).map(function (w) {
    if (w.space) return /\n/.test(w.ch) ? '<br>' : ' ';
    return '<span class="rm" style="transform:rotate(' + w.tilt.toFixed(1) + 'deg);font-size:' +
      w.scale.toFixed(2) + 'em">' + esc(w.ch) + '</span>';
  }).join('');
}

function ransomHtml(text) {
  return ransomSpec(text).map(function (c) {
    if (c.ch === ' ') return ' ';
    if (c.ch === '\n') return '<br>';
    return '<span class="rn f' + c.face + (c.inv ? ' inv' : '') +
      '" style="transform:rotate(' + c.tilt + 'deg);font-size:' + c.scale.toFixed(2) + 'em">' +
      esc(c.ch) + '</span>';
  }).join('');
}

function elGeom(el) {
  return 'left:' + (el.x * 100).toFixed(3) + '%;top:' + (el.y * 100).toFixed(3) + '%;' +
    'width:' + (el.w * 100).toFixed(3) + '%;height:' + (el.h * 100).toFixed(3) + '%;' +
    'transform:rotate(' + (el.rot || 0) + 'deg);z-index:' + (el.z || 0) + ';';
}

function elBody(el, pics, editable, editing) {
  if (el.kind === 'rule') return '<div class="elrule"></div>';
  if (el.kind === 'box') return '';
  if (el.kind === 'stamp') return stampHtml(el);
  if (el.kind === 'photo') {
    var src = el.photo && pics[el.photo];
    // A back issue's photographs ride in that issue's own file, not in every
    // later one; the place they were glued still shows.
    if (!src) return '<div class="elmissing">' + (editable ? 'photo' : 'photo in its own issue file') + '</div>';
    return '<img class="elphoto' + (el.crop ? ' fill' : '') + '" src="' + esc(src) + '" alt="">';
  }
  var voice = voiceOf(el);
  var cls = 'eltext v-' + voice + (el.ink === 'white' ? ' knock' : '');
  var style = 'font-size:' + (el.size || 12) + 'px';
  if (voice === 'ransom') {
    return '<div class="' + cls + '" style="' + style + '">' + ransomHtml(el.text) + '</div>';
  }
  if (voice === 'marker') {
    return '<div class="' + cls + '" style="' + style + '">' + markerHtml(el.text) + '</div>';
  }
  // Type, headline and stencil are edited where they sit. Ransom and marker
  // are per-piece markup, and typing into that fights the caret on every
  // keystroke, so they are edited in the inspector instead.
  return '<div class="' + cls + '" style="' + style + '"' +
    (editable && editing ? ' contenteditable="true"' : '') +
    (editable ? ' data-eltext="' + esc(el.id) + '"' : '') +
    '>' + esc(el.text || '') + '</div>';
}

function elHtml(el, pics, editable, selected) {
  var editing = editable && el.id === pasteEditing;
  return '<div class="el el-' + el.kind + (el.ink === 'white' ? ' inkwhite' : '') + (el.ghost ? ' ghost' : '') +
    (selected ? ' sel' : '') + (editing ? ' editing' : '') +
    '" data-el="' + esc(el.id) + '" style="' + elGeom(el) + '">' +
    elBody(el, pics, editable, editing) +
    (selected ? '<span class="h h-rot" data-grab="rot" title="Drag to turn, double-click to straighten"></span>' +
                '<span class="h h-size" data-grab="size" title="Drag to resize"></span>' : '') +
    '</div>';
}

function pasteupHtml(panel, pics, editable, ghosts) {
  var els = elsOf(panel).concat(ghosts || []).sort(function (a, b) { return (a.z || 0) - (b.z || 0); });
  if (!els.length && !editable) return '';
  return '<div class="pasteup">' + els.map(function (e) {
    return elHtml(e, pics || photoCache, editable && !e.ghost, editable && !e.ghost && e.id === pasteSel);
  }).join('') + '</div>';
}

// A cutting run over the gutter of a facing pair shows on both pages, each
// drawing its neighbour's overhang as though the two were one sheet, which on
// the one-sheet fold they are. aspect is a page's height over its width.
function facingPage(page, pages) {
  if (page <= 1 || page >= pages) return 0;
  var other = page % 2 === 0 ? page + 1 : page - 1;
  return other > 1 && other < pages ? other : 0;
}

function spreadGhosts(panels, page, aspect) {
  var other = facingPage(page, panels.length);
  var from = other && panels[other - 1];
  if (!from || !Array.isArray(from.els)) return [];
  var onLeft = other < page;
  return from.els.filter(function (e) {
    var t = (e.rot || 0) * Math.PI / 180;
    var half = (Math.abs(e.w * Math.cos(t)) + Math.abs(e.h * aspect * Math.sin(t))) / 2;
    var cx = e.x + e.w / 2;
    return onLeft ? cx + half > 1 : cx - half < 0;
  }).map(function (e) {
    var g = JSON.parse(JSON.stringify(e));
    g.x = e.x + (onLeft ? -1 : 1);
    g.ghost = true;
    return g;
  });
}

function pressAspect() {
  var size = pageSize(pressState().format);
  return size.ph / size.pw;
}

// A cutting is a piece of paper with words on it: it is as tall as the words.
// Anything else silently swallows a line, which is the failure the fit meter
// exists to prevent for flowed text, and the paste-up owes the same honesty.
// The height is measured from the layout the browser actually performed and
// written back, so the model, the screen and the PDF agree on one number.
// Where the browser actually broke the lines, recorded so any reader of the
// file breaks where the maker saw it break. Ransom flows per character.
function measureLines(node, voice) {
  if (!node || node.contains(document.activeElement)) return null;
  var marks = voice === 'marker' ? node.querySelectorAll('.rm') : null;
  var restore = null;
  if (!marks || !marks.length) {
    var text = node.innerText;
    if (!text.trim()) return [];
    restore = node.innerHTML;
    node.innerHTML = text.split(/(\s+)/).map(function (w) {
      return /^\s*$/.test(w) ? esc(w) : '<span class="lw">' + esc(w) + '</span>';
    }).join('');
    marks = node.querySelectorAll('.lw');
  }
  var lines = [], top = null;
  Array.prototype.forEach.call(marks, function (s) {
    var t = Math.round(s.offsetTop);
    if (top === null || Math.abs(t - top) > 2) { lines.push([]); top = t; }
    lines[lines.length - 1].push(s.textContent);
  });
  if (restore !== null) node.innerHTML = restore;
  return lines.map(function (l) { return l.join(' '); });
}

function growTextEls(panelEl, panel) {
  var ph = panelEl.clientHeight;
  if (!ph) return false;
  var grew = false;
  elsOf(panel).forEach(function (el) {
    if (el.kind !== 'text') return;
    var host = panelEl.querySelector('[data-el="' + el.id + '"]');
    var node = host && host.querySelector('.eltext');
    if (!node) return;
    var need = node.scrollHeight / ph;
    if (need > el.h + 0.004) {
      el.h = Math.min(1.5, need);
      host.style.height = (el.h * 100).toFixed(3) + '%';
      grew = true;
    }
    if (voiceOf(el) !== 'ransom') {
      var lines = measureLines(node, voiceOf(el));
      if (lines && JSON.stringify(lines) !== JSON.stringify(el.lines || null)) {
        el.lines = lines;
        grew = true;
      }
    }
  });
  return grew;
}

// The editable sheet repaints the paste-up in place. Rebuilding it wholesale
// on every keystroke would drop the caret out of whatever is being typed into,
// so a layer whose shape has not changed is left alone.
function paintPasteup(panelEl, panel) {
  var ghosts = spreadGhosts(pressState().panels, Number(panelEl.getAttribute('data-page')), pressAspect());
  var want = pasteupHtml(panel, photoCache, true, ghosts);
  var layer = panelEl.querySelector('.pasteup');
  var typing = document.activeElement;
  if (layer && typing && layer.contains(typing)) {
    // Geometry can still move under the caret; text cannot be touched.
    elsOf(panel).forEach(function (el) {
      var node = layer.querySelector('[data-el="' + el.id + '"]');
      if (node && node.getAttribute('style') !== elGeom(el)) node.setAttribute('style', elGeom(el));
      if (node) node.classList.toggle('sel', el.id === pasteSel);
    });
    return;
  }
  if (!layer) {
    panelEl.insertAdjacentHTML('beforeend', want);
  } else if (layer.outerHTML !== want) {
    layer.outerHTML = want;
  }
  if (growTextEls(panelEl, panel)) savePress();
}
