// ---------- the imposition solver ----------
// A format is a page count and a piece of paper; the imposition is computed
// from those two, not eyeballed. PRESET_A and PRESET_B are the exception and
// stay literal: they are the two fold handednesses of the one-cut eight-pager,
// they are the same two the hand kit in press/ offers, and check.sh holds all
// four arrays equal. An imposition that disagrees with the kit is a stack of
// misfolded paper.
//
// Slot order is position on the printed sheet: 0..3 is the top row left to
// right, printed upside down; 4..7 is the bottom row.
var PRESET_A = [5, 4, 3, 2, 6, 7, 8, 1];
var PRESET_B = [2, 3, 4, 5, 1, 8, 7, 6];

// Swapping the fold hand reverses each row. The test suite asserts this
// against PRESET_B rather than trusting the comment.
function oneCutMap(hand) {
  if (hand !== 'B') return PRESET_A.slice();
  return PRESET_A.slice(0, 4).reverse().concat(PRESET_A.slice(4).reverse());
}

// Saddle stitch: sheets nest inside each other, so sheet k carries the k-th
// pages in from each end. Four pages per sheet, two per side, which is why
// the page count rounds up to a multiple of four.
function saddleSheets(pages) {
  var n = Math.ceil(pages / 4) * 4;
  var out = [];
  for (var k = 0; k < n / 4; k++) {
    out.push({
      side: 'front ' + (k + 1), cols: 2, rows: 1,
      slots: [{ page: n - 2 * k, flip: false }, { page: 1 + 2 * k, flip: false }]
    });
    out.push({
      side: 'back ' + (k + 1), cols: 2, rows: 1,
      slots: [{ page: 2 + 2 * k, flip: false }, { page: n - 1 - 2 * k, flip: false }]
    });
  }
  return out;
}

// Paper, in the units the printer thinks in. Landscape throughout: the one-cut
// fold needs it, and a saddle signature is two portrait pages side by side.
var PAPER = {
  letter: { w: '11in', h: '8.5in', wpt: 792, hpt: 612, css: 'letter landscape', label: 'Letter' },
  a4: { w: '297mm', h: '210mm', wpt: 841.89, hpt: 595.28, css: 'A4 landscape', label: 'A4' }
};

var FORMATS = {
  fold8: {
    label: 'One sheet · 8 panels · one cut · Letter',
    kind: 'onecut', pages: 8, paper: 'letter', folds: true
  },
  fold8a4: {
    label: 'One sheet · 8 panels · one cut · A4',
    kind: 'onecut', pages: 8, paper: 'a4', folds: true
  },
  saddle8: {
    label: 'Saddle-stitch · 8 pages · 2 sheets · Letter',
    kind: 'saddle', pages: 8, paper: 'letter', folds: false
  },
  saddle12: {
    label: 'Saddle-stitch · 12 pages · 3 sheets · Letter',
    kind: 'saddle', pages: 12, paper: 'letter', folds: false
  },
  saddle16: {
    label: 'Saddle-stitch · 16 pages · 4 sheets · Letter',
    kind: 'saddle', pages: 16, paper: 'letter', folds: false
  },
  saddle16a4: {
    label: 'Saddle-stitch · 16 pages · 4 sheets · A4',
    kind: 'saddle', pages: 16, paper: 'a4', folds: false
  }
};

var FORMAT_IDS = ['fold8', 'fold8a4', 'saddle8', 'saddle12', 'saddle16', 'saddle16a4'];

function formatOf(id) { return FORMATS[id] || FORMATS.fold8; }
function paperOf(id) { return PAPER[formatOf(id).paper]; }

// The whole imposition, as data. Everything that draws a sheet — the press,
// the exported issue, the print stylesheet — reads this and nothing else.
function impose(formatId, hand) {
  var f = formatOf(formatId);
  if (f.kind === 'saddle') return { format: f, id: formatId, sheets: saddleSheets(f.pages) };
  var map = oneCutMap(hand);
  return {
    format: f, id: formatId,
    sheets: [{
      side: 'only', cols: 4, rows: 2,
      slots: map.map(function (page, slot) { return { page: page, flip: slot < 4 }; })
    }]
  };
}

// What each page is for, so a fresh sheet is never eight blank rectangles.
// Beyond page 8 the seeds run out and the pages are simply numbered, which is
// the honest state of a signature nobody has written yet.
// A fresh page is blank. The cover carries the zine's name and nothing else;
// the nudge to click and type is drawn by the press, not stored in the page,
// so it never reaches paper and never has to be deleted.
function seedPanel(i) {
  return { h: i === 0 ? (state && state.zine) || 'STOOP ZINE' : '', body: '', photo: null };
}

// Resize a panel array to a format without losing what was written. Growing
// pads with seeds; shrinking keeps the low pages, because the cover and the
// early spreads are the ones somebody actually filled in.
function fitPanels(panels, pages) {
  var out = [];
  for (var i = 0; i < pages; i++) {
    out.push(panels && panels[i] ? panels[i] : seedPanel(i));
  }
  return out;
}

// The sheet a new cycle starts on: the section headings survive as prompts,
// the body text does not. Seeded bodies on a fresh draft are what made a
// freshly published issue look printable when it was empty.
function blankPanels(pages) {
  var out = [];
  for (var i = 0; i < pages; i++) out.push({ h: seedPanel(i).h, body: '', photo: null });
  return out;
}

// The page label under a test-sheet number. Covers are worth naming; the
// middle of a signature is not.
function pageLabel(page, pages) {
  if (page === 1) return 'front cover';
  if (page === pages) return 'back cover';
  if (pages === 8 && (page === 4 || page === 5)) return 'center spread';
  return 'p.' + page;
}
