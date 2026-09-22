// The page and the paper share a face. The press carries one typeface inside
// itself and hands it to the PDF, so a headline on screen and the same
// headline on paper are set from the same outlines and the same advances.
// This suite checks the three places that can drift: the bytes (the font in
// the PDF is the font in the page), the widths (the screen's ruler and the
// PDF's /Widths agree), and the baseline (the writer puts the first line
// where the browser does).
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const FONT = path.resolve(__dirname, '..', 'src', 'fonts', 'anton-press.ttf');

// Just enough TrueType to read the vertical metrics the browser uses.
function metrics(buf) {
  const n = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < n; i++) {
    const at = 12 + i * 16;
    tables[buf.toString('latin1', at, at + 4)] = buf.readUInt32BE(at + 8);
  }
  return {
    upm: buf.readUInt16BE(tables.head + 18),
    ascent: buf.readInt16BE(tables.hhea + 4),
    descent: buf.readInt16BE(tables.hhea + 6)
  };
}

const SUBS = { '—': 0x97, '–': 0x96, '‘': 0x91, '’': 0x92, '“': 0x93,
  '”': 0x94, '•': 0x95, '…': 0x85, '№': 0x80 };
function pdfWidth(widths, text, size) {
  let total = 0;
  for (const ch of text) {
    const code = SUBS[ch] || ch.charCodeAt(0);
    total += widths[code - 32] / 1000 * size;
  }
  return total;
}

module.exports = async function typeface(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(300); };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-face-'));
  const fontBytes = fs.readFileSync(FONT);
  const m = metrics(fontBytes);

  await page.goto(APP);
  await page.waitForTimeout(700);

  // The face is in the page, and the browser is actually using it.
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('20px Anton');
  });
  ok('THE PAGE CARRIES ITS OWN TYPEFACE, AND THE BROWSER HAS IT', loaded);

  // Where the browser puts the first baseline at line-height 1, against the
  // writer's formula: half the leading, then an ascent down.
  const probe = await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;top:0;left:0;font:100px/1 Anton;';
    d.innerHTML = 'HEAD<span style="display:inline-block;height:0;vertical-align:baseline"></span>';
    document.body.appendChild(d);
    const y = d.lastChild.offsetTop - d.offsetTop;
    d.remove();
    return y;
  });
  const content = (m.ascent - m.descent) / m.upm;
  const expected = 100 * ((1 - content) / 2 + m.ascent / m.upm);
  ok('THE FIRST BASELINE SITS WHERE THE WRITER SAYS IT DOES',
     Math.abs(probe - expected) <= 1.5, `browser ${probe}px, formula ${expected.toFixed(1)}px`);

  // A headline on the cover, then the sheet as a PDF.
  await go('#desk');
  await page.fill('#piecetitle', 'The Seam');
  await page.fill('#piecebody', 'Orange behind you — white ahead. “Everybody” walked the orange way…');
  await page.click('#piecesubmitbtn');
  await page.waitForTimeout(250);
  await page.click('#drawsourcesbtn');
  await page.waitForTimeout(300);
  await page.click('#compileissuebtn');
  await page.waitForTimeout(600);
  await go('#press');
  await go('#press');
  await page.selectOption('#formatsel', 'fold8');
  await page.waitForTimeout(500);
  await go('#paper');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const file = path.join(dir, 'issue.pdf');
  await dl.saveAs(file);
  const pdf = fs.readFileSync(file);
  const s = pdf.toString('latin1');

  // The bytes: the embedded font file inflates to exactly the file in src/fonts.
  const ff = /\/Length1 (\d+)\/Filter\/FlateDecode\/Length (\d+)>>\s*stream\r?\n/.exec(s);
  let same = false;
  if (ff) {
    const start = ff.index + ff[0].length;
    const packed = pdf.subarray(start, start + Number(ff[2]));
    try { same = zlib.inflateSync(packed).equals(fontBytes); } catch (e) { same = false; }
  }
  ok('THE FONT IN THE PDF IS THE FONT IN THE PAGE, BYTE FOR BYTE',
     ff && Number(ff[1]) === fontBytes.length && same,
     ff ? `Length1 ${ff[1]}, file ${fontBytes.length}, inflated equal: ${same}` : 'no FontFile2 stream');
  ok('declared as an embedded TrueType subset with WinAnsi plus №',
     /\/Subtype\/TrueType\/BaseFont\/STOOPP\+Anton\/FirstChar 32\/LastChar 255\/Widths\[/.test(s) &&
     /\/Differences\[128\/numero\]/.test(s) && /\/FontFile2 \d+ 0 R/.test(s));
  ok('the sheet registers it as F7 and sets the cover headline in it',
     /\/F7 \d+ 0 R/.test(s) && /\/F7 [\d.]+ Tf[^\n]*\(THE SEAM\) Tj/.test(s));
  ok('the issue number on paper is № in the face, not "No."',
     /\/F7 [\d.]+ Tf[^\n]*\(\x8001\) Tj/.test(s) && !/\(No\.01\) Tj/.test(s));

  // The widths: the screen's ruler against the PDF's /Widths, for text that
  // crosses into WinAnsi's high half.
  const wm = /\/Widths\[([^\]]+)\]/.exec(s);
  const widths = wm ? wm[1].trim().split(/\s+/).map(Number) : [];
  const samples = ['THE SEAM', 'NIGHT BUS №01', 'ORANGE — WHITE “AHEAD”…', 'Wavy quoted ‘thing’ • 34'];
  const screen = await page.evaluate((samples) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '100px Anton';
    return samples.map(t => c.measureText(t).width);
  }, samples);
  const drift = samples.map((t, i) => Math.abs(screen[i] - pdfWidth(widths, t, 100)) / screen[i]);
  ok('THE SCREEN AND THE PDF MEASURE EVERY SAMPLE THE SAME',
     widths.length === 224 && drift.every(d => d < 0.01),
     'drift ' + drift.map(d => (d * 100).toFixed(2) + '%').join(', '));

  // The face rides inside the handed-on issue, so the file still looks like
  // this on a machine that never had it.
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  const [hdl] = await Promise.all([page.waitForEvent('download'), page.click('#handonbtn')]);
  const handed = fs.readFileSync(await hdl.path(), 'utf8');
  ok('THE HANDED-ON ISSUE CARRIES THE FACE WITH IT',
     /@font-face\{font-family:Anton;[^}]*data:font\/ttf;base64,/.test(handed));

  ok('no script errors around the typeface', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
