// Longer booklets. A saddle-stitched signature can run from eight pages to
// thirty-two, on Letter or A4, and the sheets have to nest: on each printed
// side the two pages add up to one more than the page count, the higher on
// the left of each front and the lower on the left of each back. The pages
// are numbered here and read back from the PDF, sheet by sheet.
const path = require('path');
const fs = require('fs');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function booklet(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  await page.goto(APP);
  await page.waitForTimeout(700);
  await go('#press');

  const offered = await page.locator('#formatsel option').evaluateAll(os => os.map(o => o.value));
  const sizes = [8, 12, 16, 20, 24, 28, 32];
  ok('A BOOKLET RUNS FROM EIGHT PAGES TO THIRTY-TWO, ON LETTER OR A4',
     sizes.every(n => offered.includes('saddle' + n) && offered.includes('saddle' + n + 'a4')), offered.join(' '));

  for (const [format, n, paperW] of [['saddle32', 32, '792.00'], ['saddle20a4', 20, '841.89']]) {
    await page.selectOption('#formatsel', format);
    await page.waitForTimeout(700);
    ok(format + ' shows its ' + n + ' pages', (await page.locator('#sheetzone .panel[data-page]').count()) === n);
    // Numbered once, at thirty-two pages; at twenty the numbers came along
    // with their pages and say the pages they are on now.
    if (n === 32) {
      await page.locator('#sheetzone [data-page="2"]').click({ position: { x: 6, y: 6 } });
      await page.click('#blockbtn');
      await page.click('[data-block="folios"]');
      await page.waitForTimeout(300);
    }
    await go('#paper');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
    const pdf = fs.readFileSync(await dl.path(), 'latin1');
    await go('#press');

    // One content stream per printed side, in order; the folios in each,
    // left to right.
    const streams = [...pdf.matchAll(/<<\/Length \d+>>\nstream\n([\s\S]*?)\nendstream/g)].map(m => m[1])
      .filter(s => /re W n/.test(s));
    const sides = streams.map(s => [...s.matchAll(/BT \/F1 6\.75 Tf 1 0 0 1 ([\d.]+) [\d.]+ Tm \((\d+)\) Tj/g)]
      .map(m => ({ x: Number(m[1]), n: Number(m[2]) })).sort((a, b) => a.x - b.x).map(f => f.n));
    const wrong = [];
    sides.forEach((nums, i) => {
      const k = Math.floor(i / 2);
      const want = i % 2 === 0 ? [n - 2 * k, 1 + 2 * k] : [2 + 2 * k, n - 1 - 2 * k];
      // The covers carry no number, so the first front shows neither.
      const shown = want.filter(p => p > 1 && p < n);
      if (nums.join(',') !== shown.join(',')) wrong.push(i + ': ' + nums.join(',') + ' not ' + shown.join(','));
    });
    ok('THE ' + n + '-PAGE SHEETS NEST: EVERY SIDE CARRIES THE RIGHT PAIR, IN THE RIGHT ORDER',
       sides.length === n / 2 && wrong.length === 0, sides.length + ' sides; ' + (wrong.slice(0, 3).join(' | ') || 'all right'));
    ok('on its own paper', new RegExp('/MediaBox\\[0 0 ' + paperW.replace('.', '\\.')).test(pdf));
  }

  // ---- creep. From three sheets up, each inner sheet's pages walk toward
  // the spine by a folded sheet's thickness for every sheet outside them.
  await page.selectOption('#formatsel', 'saddle16');
  await page.waitForTimeout(700);
  await go('#paper');
  const [cdl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const cpdf = fs.readFileSync(await cdl.path(), 'latin1');
  await go('#press');
  const csides = [...cpdf.matchAll(/<<\/Length \d+>>\nstream\n([\s\S]*?)\nendstream/g)].map(m => m[1]).filter(s => /re W n/.test(s));
  const creepOf = (side) => [...side.matchAll(/re W n\nq 1 0 0 1 (-?[\d.]+) 0 cm\n/g)].map(m => Number(m[1]));
  ok('INNER SHEETS CREEP TOWARD THE SPINE, 0.57 POINTS A SHEET', csides.length === 8 &&
     creepOf(csides[2]).join(',') === '0.57,-0.57' && creepOf(csides[3]).join(',') === '0.57,-0.57' &&
     creepOf(csides[6]).join(',') === '1.71,-1.71', csides.map(s => creepOf(s).join('/')).join(' | '));
  ok('and the outer sheet stays where it was printed', creepOf(csides[0]).length === 0 && creepOf(csides[1]).length === 0);
  const ocheck = await (async () => {
    await page.selectOption('#formatsel', 'saddle8');
    await page.waitForTimeout(500);
    await go('#paper');
    const [odl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
    const o = fs.readFileSync(await odl.path(), 'latin1');
    await go('#press');
    return !/re W n\nq 1 0 0 1 -?[\d.]+ 0 cm\n/.test(o);
  })();
  ok('two sheets do not creep', ocheck);

  // ---- a folded card: one sheet folded once, the saddle of a single sheet.
  ok('A FOLDED CARD IS OFFERED ON EITHER PAPER', offered.includes('card4') && offered.includes('card4a4'));
  await page.selectOption('#formatsel', 'card4');
  await page.waitForTimeout(700);
  ok('the card shows its four pages, in four chips', (await page.locator('#sheetzone .panel[data-page]').count()) === 4 &&
     (await page.locator('#pagestrip .pchip').count()) === 4);
  // The numbers put on at thirty-two pages came along with pages 2 and 3.
  await go('#paper');
  const [kdl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const kpdf = fs.readFileSync(await kdl.path(), 'latin1');
  await go('#press');
  const ksides = [...kpdf.matchAll(/<<\/Length \d+>>\nstream\n([\s\S]*?)\nendstream/g)].map(m => m[1]).filter(s => /re W n/.test(s))
    .map(s => [...s.matchAll(/BT \/F1 6\.75 Tf 1 0 0 1 ([\d.]+) [\d.]+ Tm \((\d+)\) Tj/g)].map(m => ({ x: Number(m[1]), n: Number(m[2]) }))
      .sort((a, b) => a.x - b.x).map(f => f.n).join(','));
  ok('THE CARD IS ONE SHEET: THE COVERS OUTSIDE, TWO AND THREE INSIDE, LEFT TO RIGHT', ksides.length === 2 && ksides[0] === '' && ksides[1] === '2,3' &&
     /\/MediaBox\[0 0 792\.00 612\.00\]/.test(kpdf), ksides.join(' | '));

  ok('no script errors around booklets', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
