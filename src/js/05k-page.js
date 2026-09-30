// ---------- the page itself ----------
// A photograph can be the whole page. A cutting fills it edge to edge, under
// every other cutting; a page's own photograph, the one a piece brought or
// the cover's, can fill it behind the page's heading and words, the way a
// photo zine's cover is a photograph with its title on it. Over a dark
// photograph the page's letters can be white.
function photoFills(panel) { return !!panel && panel.photoFill === true && !!panel.photo; }
function whiteLetters(panel) { return !!panel && panel.letters === 'white'; }

function pageClass(panel) {
  return (photoFills(panel) ? ' photofill' : '') + (whiteLetters(panel) ? ' letterswhite' : '');
}

function fillPageWith(id) {
  var hit = findEl(id);
  if (!hit || hit.el.kind !== 'photo') return;
  pasteMark();
  var low = elsOf(hit.panel).reduce(function (m, e) { return Math.min(m, e.z || 0); }, 0);
  hit.el.x = 0; hit.el.y = 0; hit.el.w = 1; hit.el.h = 1; hit.el.rot = 0;
  hit.el.crop = true;
  hit.el.z = low - 1;
  savePress();
  renderPress();
  toast((hit.panel.body || '').trim() ? 'It fills the page, and covers the page\u2019s own words'
    : 'It fills the page, under everything glued on it');
}

function pageButtons(page) {
  var panel = panelOfPage(page);
  if (!panel) return '';
  var b = [];
  if (panel.photo) b.push(['pgphfill', photoFills(panel) ? 'PHOTO FILLS THE PAGE' : 'PHOTO ABOVE THE WORDS']);
  b.push(['pgletters', whiteLetters(panel) ? 'WHITE LETTERS' : 'BLACK LETTERS']);
  return b.map(function (pair) {
    return '<button class="btn quiet" data-' + pair[0] + '="' + page + '">' + pair[1] + '</button>';
  }).join('');
}

document.addEventListener('click', function (ev) {
  var t = ev.target.closest && ev.target.closest('[data-elfillpage],[data-pgphfill],[data-pgletters]');
  if (!t) return;
  if (t.hasAttribute('data-elfillpage')) { fillPageWith(t.getAttribute('data-elfillpage')); return; }
  var fill = t.hasAttribute('data-pgphfill');
  var panel = panelOfPage(Number(t.getAttribute(fill ? 'data-pgphfill' : 'data-pgletters')));
  if (!panel) return;
  pasteMark();
  if (fill) {
    if (photoFills(panel)) delete panel.photoFill; else panel.photoFill = true;
  } else if (whiteLetters(panel)) {
    delete panel.letters;
  } else {
    panel.letters = 'white';
  }
  savePress();
  renderPress();
});

// ---------- the page itself, on paper ----------
// The page's photograph over the whole page, cropped to it as the screen's
// object-fit: cover crops it, under the heading and the words.
function pdfPhotoFill(panel, box, images) {
  var pic = photoFills(panel) && images[panel.photo];
  if (!pic || plateInk) return '';
  var ar = pic.w / pic.h;
  var b = box.bleed || 0;
  var iw = box.w + 2 * b, ih = iw / ar;
  if (ih < box.h + 2 * b) { ih = box.h + 2 * b; iw = ih * ar; }
  var cx = box.left + box.w / 2, cy = box.top - box.h / 2;
  return 'q ' + iw.toFixed(2) + ' 0 0 ' + ih.toFixed(2) + ' ' + (cx - iw / 2).toFixed(2) + ' ' +
    (cy - ih / 2).toFixed(2) + ' cm ' + pdfImageOps(pic) + ' Q\n';
}
