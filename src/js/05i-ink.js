// ---------- ink ----------
// A cutting is printed in black unless it says otherwise, and what it says is
// a colour: the letters, the block a knocked-out line sits in, a box, a rule,
// a stamp, or the dark half of a photograph screened to two tones, the way a
// riso prints a screen in whatever drum is loaded. The palette is the drums
// a print shop is likely to have; a file from anywhere else may name any
// colour, and is checked here because it goes straight into a style.
var INKS = [['BLACK', ''], ['RED', '#e8403b'], ['PINK', '#ff48b0'], ['ORANGE', '#ff6c2f'],
  ['YELLOW', '#ffd200'], ['GREEN', '#00a95c'], ['BLUE', '#0078bf'], ['PURPLE', '#765ba7']];

function inkOf(el) {
  var c = el && el.colour;
  return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : '';
}

function inkRgb(hex) {
  return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16) / 255; });
}

function twoTonePhoto(src) {
  var i = imageInfo(src);
  return !!i && i.type === 'png' && i.depth === 1;
}

// A two-tone photograph in a colour: black becomes the ink and white stays
// paper. One filter per colour, kept beside the copier's generations and
// made the first time a colour is asked for.
function inkFilter(hex) {
  var id = 'ink-' + hex.slice(1);
  var defs = document.getElementById('gen1');
  if (!document.getElementById(id) && defs && defs.parentNode) {
    var rgb = inkRgb(hex);
    var f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    f.setAttribute('id', id);
    f.setAttribute('color-interpolation-filters', 'sRGB');
    var m = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    m.setAttribute('type', 'matrix');
    m.setAttribute('values', rgb.map(function (c, n) {
      var row = [0, 0, 0, 0, c.toFixed(4)];
      row[n] = (1 - c).toFixed(4);
      return row.join(' ');
    }).join('  ') + '  0 0 0 1 0');
    f.appendChild(m);
    defs.parentNode.appendChild(f);
  }
  return 'filter:url(#' + id + ')';
}

// The PDF sets the ink once for the whole cutting, fill and stroke.
function pdfInk(el) {
  var hex = inkOf(el);
  if (!hex) return '0 g 0 G\n';
  var c = inkRgb(hex).map(function (v) { return v.toFixed(3); }).join(' ');
  return c + ' rg ' + c + ' RG\n';
}

function inkable(el) {
  if (el.kind === 'photo') return twoTonePhoto(photoCache[el.photo]);
  return el.kind === 'text' || el.kind === 'box' || el.kind === 'rule' || el.kind === 'stamp';
}

function inkSwatches(el) {
  if (!inkable(el)) return '';
  var now = inkOf(el);
  return '<div class="swatches"><span class="sub">INK</span>' + INKS.map(function (ink) {
    return '<button class="swatch' + (ink[1] === now ? ' on' : '') + '" data-elcolour="' + esc(el.id) +
      '" data-c="' + ink[1] + '" title="' + ink[0] + '" aria-label="' + ink[0] + ' ink" style="background:' +
      (ink[1] || '#000') + '"></button>';
  }).join('') + '</div>';
}

document.addEventListener('click', function (ev) {
  var b = ev.target.closest && ev.target.closest('[data-elcolour]');
  if (!b) return;
  var c = b.getAttribute('data-c');
  updateEl(b.getAttribute('data-elcolour'), { colour: c || undefined }, true);
  renderPress();
  var name = INKS.filter(function (ink) { return ink[1] === c; })[0];
  toast((name ? name[0] : 'BLACK') + ' ink');
});
