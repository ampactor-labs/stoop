// ---------- type ----------
// How a line of type sits in its cutting: which voice it speaks in, which
// way it lines up, whether it is set in capitals, and whether its letters are
// solid or drawn as outlines, the way a headline over a photograph often is.
// Each is checked against the few values it can take, because a file from
// anywhere else puts them straight into a class name.
var ALIGNS = ['left', 'center', 'right'];
var ALIGN_LABEL = { left: 'ALIGN LEFT', center: 'CENTRED', right: 'ALIGN RIGHT' };

function alignOf(el) { return el && (el.align === 'center' || el.align === 'right') ? el.align : 'left'; }

// Headline and stencil are capitals unless told otherwise; the other voices
// are as typed unless told otherwise.
function capsOf(el) {
  if (el && typeof el.caps === 'boolean') return el.caps;
  var v = voiceOf(el || {});
  return v === 'head' || v === 'stencil';
}

function outlined(el) { return !!el && el.outline === true; }

// Letters can be set close, spaced a little, the way a headline in capitals
// often is, or spaced wide, the way a label or a date is: a fraction of an
// em after every letter. Ransom and marker space their own letters.
var TRACKS = [0, 0.06, 0.3];
var TRACK_LABEL = ['SET CLOSE', 'SPACED', 'WIDE SPACED'];
function trackOf(el) {
  var t = Number(el && el.track);
  var v = voiceOf(el || {});
  return v !== 'ransom' && v !== 'marker' && t > 0 ? Math.min(0.5, Math.round(t * 100) / 100) : 0;
}
function trackStyle(el) { return trackOf(el) ? ';letter-spacing:' + trackOf(el) + 'em' : ''; }
function trackStep(el) {
  var at = TRACKS.filter(function (t) { return t <= trackOf(el); }).length - 1;
  return { label: TRACK_LABEL[at], next: TRACKS[(at + 1) % TRACKS.length] };
}

function typeClass(el) {
  return (voiceOf(el) !== 'ransom' && alignOf(el) !== 'left' ? ' al-' + alignOf(el) : '') +
    (capsOf(el) ? ' caps' : ' nocaps') + (outlined(el) ? ' outline' : '');
}

function typeButtons(el) {
  var b = [];
  if (voiceOf(el) !== 'ransom') b.push(['elalign', ALIGN_LABEL[alignOf(el)]]);
  b.push(['elcaps', capsOf(el) ? 'CAPITALS' : 'AS TYPED']);
  b.push(['eloutline', outlined(el) ? 'OUTLINE' : 'SOLID LETTERS']);
  if (voiceOf(el) !== 'ransom' && voiceOf(el) !== 'marker') b.push(['eltrack', trackStep(el).label]);
  return b;
}

// Seven voices are too many to cycle through with one button, so they are a
// list, each named for what it looks like.
function voiceSelect(el) {
  return '<select class="voicesel" data-elvoicesel="' + esc(el.id) + '" aria-label="Voice">' + VOICES.concat(ownVoiceIds()).map(function (v) {
    return '<option value="' + esc(v) + '"' + (voiceOf(el) === v ? ' selected' : '') + '>' + esc(VOICE_LABEL[v] || ownFaceLabel(v)) + '</option>';
  }).join('') + '</select>';
}

function setVoice(id, next) {
  var hit = findEl(id);
  if (!hit || hit.el.kind !== 'text' || (VOICES.indexOf(next) < 0 && !ownFace(next))) return;
  var own = ownFace(next);
  updateEl(id, { voice: next, size: VOICE_SIZE[next] || 14, family: own ? own.name : undefined }, true);
  renderPress();
  toast(VOICE_LABEL[next] || ownFaceLabel(next));
}

document.addEventListener('change', function (ev) {
  var s = ev.target.closest && ev.target.closest('[data-elvoicesel]');
  if (s) setVoice(s.getAttribute('data-elvoicesel'), s.value);
});

document.addEventListener('click', function (ev) {
  var t = ev.target.closest && ev.target.closest('[data-elalign],[data-elcaps],[data-eloutline],[data-eltrack]');
  if (!t) return;
  var hit;
  if (t.hasAttribute('data-elalign')) {
    hit = findEl(t.getAttribute('data-elalign'));
    if (hit) updateEl(hit.el.id, { align: ALIGNS[(ALIGNS.indexOf(alignOf(hit.el)) + 1) % ALIGNS.length] }, true);
  } else if (t.hasAttribute('data-elcaps')) {
    hit = findEl(t.getAttribute('data-elcaps'));
    if (hit) updateEl(hit.el.id, { caps: !capsOf(hit.el) }, true);
  } else if (t.hasAttribute('data-eltrack')) {
    hit = findEl(t.getAttribute('data-eltrack'));
    if (hit) updateEl(hit.el.id, { track: trackStep(hit.el).next || undefined }, true);
  } else {
    hit = findEl(t.getAttribute('data-eloutline'));
    if (hit) updateEl(hit.el.id, { outline: outlined(hit.el) ? undefined : true }, true);
  }
  if (hit) renderPress();
});

// ---------- type, on paper ----------
// Where a line starts in its cutting, for the way the cutting lines up; the
// screen insets its lines a little from either edge, and so does this.
function alignX(el, g, lw) {
  var a = alignOf(el);
  if (a === 'center') return g.x + (g.w - lw) / 2;
  if (a === 'right') return g.x + g.w - 2 - lw;
  return g.x + 2;
}

// Spaced letters on paper: PDF's character spacing, in points after every
// letter, which the screen's letter-spacing also puts after the last.
function trackOps(el, size) { return trackOf(el) ? (trackOf(el) * size).toFixed(2) + ' Tc ' : ''; }
function trackedWidth(el, face, line, size) {
  return runWidth(face, line, size) + trackOf(el) * size * pdfSafe(faceText(face, line)).length;
}

// Letters drawn as outlines are stroked, not filled: text render mode 1, at
// the width the screen strokes them, a little under a twentieth of the size.
function textMode(el) { return outlined(el) ? '1 Tr ' : ''; }
function strokeFor(el) { return outlined(el) ? (ptSize(el) * 0.045).toFixed(2) + ' w\n' : ''; }

// The letters in a knocked-out block are paper, which is white unless the ink
// itself is white, when they are black.
function knockLetters(el) { return inkOf(el) === '#ffffff' && !plateInk ? '0 g 0 G\n' : '1 g 1 G\n'; }
