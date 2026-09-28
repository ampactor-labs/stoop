// ---------- ink ----------
// A cutting is printed in black unless it says otherwise, and what it says is
// a colour: the letters, the block a knocked-out line sits in, a box, a rule,
// a stamp, or the dark half of a photograph screened to two tones, the way a
// riso prints a screen in whatever drum is loaded. The palette is the drums
// a print shop is likely to have; a file from anywhere else may name any
// colour, and is checked here because it goes straight into a style.
var INKS = [['BLACK', ''], ['RED', '#e8403b'], ['PINK', '#ff48b0'], ['ORANGE', '#ff6c2f'],
  ['YELLOW', '#ffd200'], ['GREEN', '#00a95c'], ['BLUE', '#0078bf'], ['PURPLE', '#765ba7'], ['WHITE', '#ffffff']];

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

// A page can be printed on a colour: a flood under everything on it, the
// way a colour printer lays a ground. Light colours only, so the page's own
// type stays black on it and legible.
var FILLS = [['WHITE', ''], ['PINK', '#f9c6d3'], ['YELLOW', '#fbee8a'], ['BLUE', '#bcdcf2'],
  ['GREEN', '#c7e8c0'], ['ORANGE', '#fbc08e'], ['LAVENDER', '#d9cdef'], ['KRAFT', '#d8b98f']];

function fillOf(panel) {
  var c = panel && panel.fill;
  return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : '';
}

function fillAttr(panel) {
  return fillOf(panel) ? ' style="background:' + fillOf(panel) + '"' : '';
}

function fillSwatches(page) {
  var now = fillOf(panelOfPage(page));
  return '<div class="swatches"><span class="sub">PAGE COLOUR</span>' + FILLS.map(function (f) {
    return '<button class="swatch' + (f[1] === now ? ' on' : '') + '" data-pgfill="' + page + '" data-c="' + f[1] +
      '" title="' + f[0] + '" aria-label="' + f[0] + ' page" style="background:' + (f[1] || '#fff') + '"></button>';
  }).join('') + '</div>';
}

// Out into the bleed, when the page has one.
function pdfFill(panel, box) {
  var hex = fillOf(panel);
  if (!hex) return '';
  var b = box.bleed || 0;
  return inkRgb(hex).map(function (v) { return v.toFixed(3); }).join(' ') + ' rg ' + (box.left - b).toFixed(2) + ' ' +
    (box.top - box.h - b).toFixed(2) + ' ' + (box.w + 2 * b).toFixed(2) + ' ' + (box.h + 2 * b).toFixed(2) + ' re f 0 g\n';
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
  return el.kind === 'text' || el.kind === 'box' || el.kind === 'rule' || el.kind === 'stamp' || el.kind === 'qr';
}

function inkSwatches(el) {
  if (!inkable(el)) return '';
  var now = inkOf(el);
  // White is for type and rules laid over a photograph; a screen printed
  // in white would be a white rectangle.
  var inks = el.kind === 'photo' || el.kind === 'qr' ? INKS.filter(function (ink) { return ink[1] !== '#ffffff'; }) : INKS;
  return '<div class="swatches"><span class="sub">INK</span>' + inks.map(function (ink) {
    return '<button class="swatch' + (ink[1] === now ? ' on' : '') + '" data-elcolour="' + esc(el.id) +
      '" data-c="' + ink[1] + '" title="' + ink[0] + '" aria-label="' + ink[0] + ' ink" style="background:' +
      (ink[1] || '#000') + '"></button>';
  }).join('') + '</div>';
}

document.addEventListener('click', function (ev) {
  var f = ev.target.closest && ev.target.closest('[data-pgfill]');
  if (f) {
    var panel = panelOfPage(Number(f.getAttribute('data-pgfill')));
    if (!panel) return;
    pasteMark();
    if (f.getAttribute('data-c')) panel.fill = f.getAttribute('data-c'); else delete panel.fill;
    savePress();
    renderPress();
    toast(f.getAttribute('title') + ' page');
    return;
  }
  var b = ev.target.closest && ev.target.closest('[data-elcolour]');
  if (!b) return;
  var c = b.getAttribute('data-c');
  updateEl(b.getAttribute('data-elcolour'), { colour: c || undefined }, true);
  renderPress();
  var name = INKS.filter(function (ink) { return ink[1] === c; })[0];
  toast((name ? name[0] : 'BLACK') + ' ink');
});
