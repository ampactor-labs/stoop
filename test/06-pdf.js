// The PDF, checked as a file rather than as a picture. A hand-rolled writer
// fails in three classic ways — an xref offset that misses its object, a
// /Length that disagrees with its stream, and a transform that never lands —
// and all three make a file that some readers open and others reject. So this
// suite parses the bytes instead of trusting them.
//
// The content streams are deliberately uncompressed, which keeps them
// readable here and costs a few kilobytes on a file that exists to be printed.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const { photoFile } = require('./fixture.js');

function parse(buf) {
  const s = buf.toString('latin1');
  const out = { header: s.slice(0, 8), pages: [], errors: [] };

  out.pageCount = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
  out.mediaBoxes = (s.match(/\/MediaBox\[([^\]]+)\]/g) || []).map(m => m.slice(10, -1));
  out.flips = (s.match(/-1 0 0 -1 /g) || []).length;
  out.oneBitImages = (s.match(/\/BitsPerComponent 1\b/g) || []).length;

  // Every xref offset must land exactly on its own object header. The table is
  // found by the newline in front of it, because "startxref" ends in the same
  // five letters and comes later in the file.
  const xrefAt = s.lastIndexOf('\nxref\n') + 1;
  const startxref = /startxref\s+(\d+)/.exec(s);
  out.startxrefPointsAtXref = !!startxref && Number(startxref[1]) === xrefAt;
  out.xrefChecked = 0;
  s.slice(xrefAt).split('\n').forEach((row) => {
    const m = /^(\d{10}) 00000 n/.exec(row);
    if (!m) return;
    out.xrefChecked++;
    const at = Number(m[1]);
    const expect = out.xrefChecked + ' 0 obj';
    if (s.slice(at, at + expect.length) !== expect) {
      out.errors.push(`xref row ${out.xrefChecked} points at ` +
        `${JSON.stringify(s.slice(at, at + 16))}, wanted ${expect}`);
    }
  });

  // Every /Length must match the bytes actually between stream and endstream.
  const re = /\/Length (\d+)>>\s*stream\r?\n/g;
  let m;
  out.streamsChecked = 0;
  while ((m = re.exec(s)) !== null) {
    const declared = Number(m[1]);
    const start = m.index + m[0].length;
    const end = s.indexOf('\nendstream', start);
    if (end < 0) { out.errors.push('a stream never ends'); continue; }
    if (end - start !== declared) {
      out.errors.push(`/Length says ${declared}, stream holds ${end - start}`);
    }
    out.streamsChecked++;
  }
  return out;
}

module.exports = async function pdf(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(300); };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-pdf-'));

  await page.goto(APP);
  await page.waitForTimeout(700);
  await go('#backup');
  await page.fill('#addressinput', 'ampactor.dev/stoop/nightbus');
  await page.click('#savenamesbtn2');
  await page.waitForTimeout(200);

  // A real photograph, so the 1-bit image path is exercised rather than skipped.
  await go('#log');
  await page.fill('#loginput', 'Workbench photo for the cover');
  await page.setInputFiles('#photofile', photoFile());
  await page.waitForTimeout(1800);

  await go('#desk');
  await page.fill('#piecetitle', 'The Seam');
  await page.fill('#piecebody', 'Orange behind you, white ahead — and everybody walked the orange way.');
  await page.click('#piecesubmitbtn');
  await page.waitForTimeout(250);
  await page.click('#drawsourcesbtn');
  await page.waitForTimeout(300);
  await page.click('#compileissuebtn');
  await page.waitForTimeout(600);

  async function save(format, name) {
    await go('#press');
    await go('#press');
    await page.selectOption('#formatsel', format);
    await page.waitForTimeout(600);
    await go('#paper');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
    const file = path.join(dir, name);
    await dl.saveAs(file);
    return parse(fs.readFileSync(file));
  }

  const letter = await save('fold8', 'letter.pdf');
  ok('the file is a PDF', letter.header === '%PDF-1.4', letter.header);
  ok('one sheet, one page', letter.pageCount === 1, 'pages ' + letter.pageCount);
  ok('the page is letter landscape in points', /^0 0 792\.00 612\.00$/.test(letter.mediaBoxes[0]),
     letter.mediaBoxes[0]);
  ok('THE TOP ROW IS ROTATED FOR THE FOLD', letter.flips === 4, 'flip transforms ' + letter.flips);
  ok('the photograph and the code ride as 1-bit images', letter.oneBitImages === 2,
     '1-bit images ' + letter.oneBitImages);
  ok('every xref offset lands on its object', letter.errors.length === 0 && letter.xrefChecked > 4,
     letter.errors[0] || ('checked ' + letter.xrefChecked));
  ok('startxref points at the table', letter.startxrefPointsAtXref);
  ok('every stream /Length matches its bytes', letter.streamsChecked > 0 &&
     !letter.errors.some(e => /Length/.test(e)), letter.errors.find(e => /Length/.test(e)) || 'ok');

  const a4 = await save('fold8a4', 'a4.pdf');
  ok('A4 lands at its real point size', /^0 0 841\.89 595\.28$/.test(a4.mediaBoxes[0]), a4.mediaBoxes[0]);

  const saddle = await save('saddle8', 'saddle.pdf');
  ok('saddle-stitch writes one page per printed side', saddle.pageCount === 4,
     'pages ' + saddle.pageCount);
  ok('a saddle signature rotates nothing', saddle.flips === 0, 'flips ' + saddle.flips);
  ok('the signature is structurally sound', saddle.errors.length === 0, saddle.errors[0] || '');

  // The flyer: portrait, and the tear strip is a comb of dashed cuts with the
  // address turned on its side in every tab.
  await go('#press');
  await go('#press');
  await page.selectOption('#formatsel', 'fold8');
  await page.waitForTimeout(500);
  await go('#paper');
  const [fdl] = await Promise.all([page.waitForEvent('download'), page.click('#flyerbtn')]);
  const flyerFile = path.join(dir, 'flyer.pdf');
  await fdl.saveAs(flyerFile);
  const raw = fs.readFileSync(flyerFile).toString('latin1');
  const flyer = parse(fs.readFileSync(flyerFile));
  ok('the flyer is one portrait page', flyer.pageCount === 1 &&
     /^0 0 612 792$/.test(flyer.mediaBoxes[0]), flyer.mediaBoxes[0]);
  ok('the flyer is structurally sound', flyer.errors.length === 0, flyer.errors[0] || '');
  ok('the tear strip is cut with dashed rules', (raw.match(/\[4 3\] 0 d/g) || []).length >= 9,
     'dashed rules ' + (raw.match(/\[4 3\] 0 d/g) || []).length);
  ok('EVERY TAB CARRIES THE ADDRESS, TURNED ON ITS SIDE',
     (raw.match(/0 1 -1 0 /g) || []).length === 8,
     'rotated tabs ' + (raw.match(/0 1 -1 0 /g) || []).length);

  ok('no script errors while writing PDFs', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
