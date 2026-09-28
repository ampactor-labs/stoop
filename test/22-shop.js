// The PDF a print shop wants: every page on its own sheet of the file, in
// reading order, trimmed to the page's size with an eighth of an inch of
// bleed around it and crop marks beyond that, and anything that reaches the
// page's edge carried on into the bleed.
const path = require('path');
const fs = require('fs');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function shop(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  await page.goto(APP);
  await page.waitForTimeout(700);

  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(500);
  await go('#press');
  const p3 = page.locator('#sheetzone [data-page="3"]');
  await p3.scrollIntoViewIfNeeded();
  await p3.click({ position: { x: 6, y: 400 } });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.click('[data-pgfill="3"][title="YELLOW"]');
  await page.waitForTimeout(200);

  await go('#paper');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfshopbtn')]);
  const pdf = fs.readFileSync(await dl.path(), 'latin1');
  const streams = [...pdf.matchAll(/<<\/Length \d+>>\nstream\n([\s\S]*?)\nendstream/g)].map(m => m[1])
    .filter(s => /re W n/.test(s));
  ok('A PRINT SHOP GETS EVERY PAGE ON ITS OWN, IN READING ORDER',
     /-shop\.pdf$/.test(dl.suggestedFilename()) && streams.length === 8 &&
     /THE SEAM/.test(streams[1]) && /WORKBENCH/.test(streams[2]) && /BACK COVER/.test(streams[7]),
     streams.length + ' pages');

  // Letter, one cut: a page is a quarter of the sheet's width and half its
  // height, 198 by 306 points; the bleed is 9 more a side and the marks 18.
  const boxes = [...pdf.matchAll(/\/MediaBox\[([^\]]+)\]\/BleedBox\[([^\]]+)\]\/TrimBox\[([^\]]+)\]/g)];
  ok('TRIMMED TO THE PAGE, WITH AN EIGHTH OF AN INCH OF BLEED AND ROOM FOR MARKS',
     boxes.length === 8 && boxes.every(b => b[1] === '0.00 0.00 252.00 360.00' && b[2] === '18.00 18.00 234.00 342.00' &&
       b[3] === '27.00 27.00 225.00 333.00'), boxes[0] ? boxes[0].slice(1).join(' | ') : 'none');
  ok('A PAGE COLOUR RUNS ON INTO THE BLEED',
     /q 18\.00 18\.00 216\.00 324\.00 re W n\n0\.984 0\.933 0\.541 rg 18\.00 18\.00 216\.00 324\.00 re f/.test(streams[2]));
  ok('and every page ends with its crop marks, two hairlines at each corner',
     streams.every(s => /q 0\.25 w 0 G\n(?:[\d. ]+ m [\d. ]+ l S [\d. ]+ m [\d. ]+ l S\n){4}Q\n$/.test(s)));

  // The shelf offers the same for any issue that has shipped.
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  await go('#shelf');
  const [sdl] = await Promise.all([page.waitForEvent('download'), page.click('[data-shopissue="01"]')]);
  const shelved = fs.readFileSync(await sdl.path(), 'latin1');
  ok('A SHIPPED ISSUE CAN GO TO A PRINT SHOP FROM THE SHELF',
     /^%PDF-1\.4/.test(shelved) && (shelved.match(/\/TrimBox\[/g) || []).length === 8 && /0\.984 0\.933 0\.541 rg/.test(shelved));

  ok('no script errors around the shop', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
