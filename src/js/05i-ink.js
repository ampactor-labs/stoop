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
// way a colour printer lays a ground. On the light ones the page's own type
// stays black; on NIGHT the letters turn white by themselves, and so does
// anything new glued onto it, because black on black is not a choice
// anybody makes. The letters can be told any colour, and then anything new
// glued onto the page takes that colour too.
var FILLS = [['WHITE', ''], ['PINK', '#f9c6d3'], ['YELLOW', '#fbee8a'], ['BLUE', '#bcdcf2'],
  ['GREEN', '#c7e8c0'], ['ORANGE', '#fbc08e'], ['LAVENDER', '#d9cdef'], ['KRAFT', '#d8b98f'], ['NIGHT', '#1d1a16']];

function fillOf(panel) {
  var c = panel && panel.fill;
  return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : '';
}

function luminance(hex) {
  var c = inkRgb(hex);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function darkFill(panel) { var hex = fillOf(panel); return !!hex && luminance(hex) < 0.4; }
// What a new cutting on this page is printed in: the page's letters when
// they are a colour, white when black would vanish.
function inkForPage(panel) { return inkLetters(panel) || (darkFill(panel) ? '#ffffff' : ''); }

// A zine's own colours: whatever its pages, its cuttings and its kit are
// printed in that is not one of the drums, from the draft and the last issue
// out. A file from a scene with a palette of its own offers that palette in
// every row, and a colour picked once is offered everywhere after.
function zineColours() {
  var stock = INKS.concat(FILLS).map(function (c) { return c[1]; });
  var out = [];
  var add = function (hex) { if (hex && stock.indexOf(hex) < 0 && out.indexOf(hex) < 0 && out.length < 12) out.push(hex); };
  var last = state.issues.length ? state.issues[state.issues.length - 1].panels || [] : [];
  pressState().panels.concat(last).forEach(function (p) {
    add(fillOf(p));
    add(inkLetters(p));
    elsOf(p).forEach(function (e) { add(inkOf(e)); });
  });
  (state.kit || []).forEach(function (k) { add(inkOf(k.el)); });
  return out;
}

function colourName(hex) {
  var known = INKS.concat(FILLS).filter(function (c) { return c[1] === hex; })[0];
  if (!hex) return 'BLACK';
  return known ? known[0] : hex.toUpperCase();
}

// A row of swatches: the stock, the zine's own, and one more for any colour
// at all, which is the browser's own picker under a plus.
function swatchRow(label, stock, attr, at, now) {
  var own = zineColours().map(function (hex) { return [hex.toUpperCase(), hex]; });
  return '<div class="swatches"><span class="sub">' + label + '</span>' + stock.concat(own).map(function (c) {
    return '<button class="swatch' + (c[1] === now ? ' on' : '') + '" data-' + attr + '="' + esc(at) + '" data-c="' + c[1] +
      '" title="' + c[0] + '" aria-label="' + c[0] + ' ' + label.toLowerCase() + '" style="background:' +
      (c[1] || (attr === 'pgfill' ? '#fff' : '#000')) + '"></button>';
  }).join('') + '<label class="swatch pick" title="ANOTHER COLOUR">+<input type="color" data-pick="' + attr + '" data-for="' +
    esc(at) + '" value="' + (now || '#000000') + '" aria-label="Another colour"></label></div>';
}

function fillAttr(panel) {
  var css = (fillOf(panel) ? 'background:' + fillOf(panel) + ';' : '') + (inkLetters(panel) ? '--letters:' + inkLetters(panel) : '');
  return css ? ' style="' + css + '"' : '';
}

function fillSwatches(page) {
  var panel = panelOfPage(page);
  return swatchRow('PAGE COLOUR', FILLS, 'pgfill', page, fillOf(panel)) +
    swatchRow('LETTERS', [['BLACK', ''], ['WHITE', '#ffffff']], 'pgletters', page, lettersOf(panel));
}

// Out into the bleed, when the page has one.
function pdfFill(panel, box) {
  var hex = fillOf(panel);
  if (!hex) return '';
  var b = box.bleed || 0;
  return inkRgb(hex).map(function (v) { return v.toFixed(3); }).join(' ') + ' rg ' + (box.left - b).toFixed(2) + ' ' +
    (box.top - box.h - b).toFixed(2) + ' ' + (box.w + 2 * b).toFixed(2) + ' ' + (box.h + 2 * b).toFixed(2) + ' re f 0 g\n';
}

// The PDF sets the ink once for the whole cutting, fill and stroke. While a
// riso plate is being drawn (11e-pdf-riso.js) every ink on the plate is
// black, or its own colour in the preview; white stays white, being paper.
var plateInk = null;
var plateTint = false;
function pdfInk(el) {
  var hex = inkOf(el);
  if (plateInk !== null && hex !== '#ffffff') hex = plateTint ? plateInk : '';
  return pdfColour(hex);
}
function pdfColour(hex) {
  if (!hex) return '0 g 0 G\n';
  var c = inkRgb(hex).map(function (v) { return v.toFixed(3); }).join(' ');
  return c + ' rg ' + c + ' RG\n';
}
// The page's own letters: on a riso plate they are drawn the way the
// plate draws its ink, black, or its colour in the preview; white is paper
// on every drum.
function pdfLetters(panel) {
  var hex = lettersOf(panel);
  return hex === '#ffffff' ? '1 g 1 G\n' : pdfColour(plateInk !== null ? (plateTint ? plateInk : '') : hex);
}

function inkable(el) {
  if (el.kind === 'photo') return twoTonePhoto(photoCache[el.photo]);
  return el.kind === 'text' || el.kind === 'box' || el.kind === 'rule' || el.kind === 'stamp' || el.kind === 'qr' || el.kind === 'draw';
}

function inkSwatches(el) {
  if (!inkable(el)) return '';
  var now = inkOf(el);
  // White is for type and rules laid over a photograph; a screen printed
  // in white would be a white rectangle.
  var inks = el.kind === 'photo' || el.kind === 'qr' ? INKS.filter(function (ink) { return ink[1] !== '#ffffff'; }) : INKS;
  return swatchRow('INK', inks, 'elcolour', el.id, now);
}

function setFill(page, hex) {
  var panel = panelOfPage(page);
  if (!panel) return;
  pasteMark();
  if (hex) panel.fill = hex; else delete panel.fill;
  savePress();
  renderPress();
  toast(colourName(hex) + ' page');
}

function setInk(id, hex) {
  updateEl(id, { colour: hex || undefined }, true);
  renderPress();
  toast(colourName(hex) + ' ink');
}

document.addEventListener('click', function (ev) {
  var b = ev.target.closest && ev.target.closest('button[data-pgfill],button[data-elcolour]');
  if (!b) return;
  if (b.hasAttribute('data-pgfill')) setFill(Number(b.getAttribute('data-pgfill')), b.getAttribute('data-c') || '');
  else setInk(b.getAttribute('data-elcolour'), b.getAttribute('data-c') || '');
});

document.addEventListener('change', function (ev) {
  var p = ev.target.closest && ev.target.closest('[data-pick]');
  var hex = p && String(p.value).toLowerCase();
  if (!p || !/^#[0-9a-f]{6}$/.test(hex)) return;
  var at = p.getAttribute('data-for');
  var what = p.getAttribute('data-pick');
  if (what === 'pgfill') setFill(Number(at), hex);
  else if (what === 'pgletters') setLetters(Number(at), hex);
  else setInk(at, hex);
});
