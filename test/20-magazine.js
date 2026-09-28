// The parts of a magazine made out of the rest of it. Page numbers that know
// which page they are on, a contents list and credits made from the pages as
// they stand, and a pulled quote, each an ordinary cutting afterwards.
const path = require('path');
const fs = require('fs');
const { photoFile } = require('./fixture.js');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function magazine(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  const block = async (name) => {
    await page.click('#blockbtn');
    await page.click('[data-block="' + name + '"]');
    await page.waitForTimeout(250);
  };
  await page.goto(APP);
  await page.waitForTimeout(700);

  await go('#scraps');
  await page.setInputFiles('#photofile', photoFile());
  await page.waitForTimeout(1500);
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(500);
  await go('#press');
  const p2 = page.locator('#sheetzone [data-page="2"]');
  await p2.scrollIntoViewIfNeeded();
  await p2.click({ position: { x: 6, y: 6 } });
  await page.click('#blockbtn');
  ok('A BLOCK IS PAGE NUMBERS, CONTENTS, CREDITS OR A PULL QUOTE',
     (await page.locator('#blocks [data-block]').allInnerTexts()).join(' ') === 'PAGE NUMBERS CONTENTS CREDITS PULL QUOTE');
  await page.click('#blockbtn');

  // ---- page numbers.
  await block('folios');
  const shown = await page.evaluate(() => [2, 3, 4, 5, 6, 7].map(n =>
    [...document.querySelectorAll('#sheetzone [data-page="' + n + '"] .el-text .eltext')].map(e => e.innerText.trim())));
  ok('EVERY PAGE BETWEEN THE COVERS IS NUMBERED', shown.every((texts, i) => texts.includes(String(i + 2))),
     JSON.stringify(shown));
  ok('and the covers are not', (await page.locator('#sheetzone [data-page="1"] .el-text').count()) === 0 &&
     (await page.locator('#sheetzone [data-page="8"] .el-text').count()) === 0);

  const folioOn3 = page.locator('#sheetzone [data-page="3"] .el-text').filter({ hasText: /^3$/ });
  await folioOn3.click();
  await page.click('[data-elnextpage]');
  await page.waitForTimeout(250);
  const moved = await page.evaluate(() => [...document.querySelectorAll('#sheetzone [data-page="4"] .el-text .eltext')]
    .map(e => e.innerText.trim()));
  ok('A PAGE NUMBER MOVED TO ANOTHER PAGE SAYS THAT PAGE', moved.filter(t => t === '4').length === 2, moved.join(','));
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(250);

  await go('#paper');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const pdf = fs.readFileSync(await dl.path(), 'latin1');
  const nums = [2, 3, 4, 5, 6, 7].filter(n => new RegExp('BT /F1 6\\.75 Tf 1 0 0 1 [\\d.]+ [\\d.]+ Tm \\(' + n + '\\) Tj').test(pdf));
  ok('AND ON PAPER', nums.length === 6, 'numbered ' + nums.join(','));
  await go('#press');

  // ---- contents and credits, from the pages as they are.
  await p2.click({ position: { x: 6, y: 6 } });
  await block('contents');
  let ps = (await store()).press;
  const contents = ps.panels[1].els.find(e => e.kind === 'text' && /^CONTENTS/.test(e.text || ''));
  const titled = ps.panels.map((p, i) => ({ h: p.h, page: i + 1 })).filter(p => p.page > 1 && p.page < ps.panels.length &&
    ps.panels[p.page - 1].body && p.h && !/, CONTINUED$/.test(p.h));
  ok('THE CONTENTS LIST EVERY PIECE AND THE PAGE IT IS ON',
     !!contents && titled.length > 0 && titled.every(t => new RegExp(t.h.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]*\\.+ ' + t.page + '(\\n|$)').test(contents.text)),
     contents ? contents.text.replace(/\n/g, ' / ') : 'none');

  await block('credits');
  ps = (await store()).press;
  const credits = ps.panels[1].els.find(e => e.kind === 'text' && /^EDITED BY/.test(e.text || ''));
  const name = await page.locator('#authorname').innerText();
  ok('THE CREDITS SAY WHO EDITED, WHO WROTE AND WHO TOOK THE PHOTOGRAPHS',
     !!credits && /\nWORDS \S/.test(credits.text) && new RegExp('\\nPHOTOS [^\\n]*' + name).test(credits.text),
     credits ? credits.text.replace(/\n/g, ' / ') : 'none');

  await block('quote');
  ps = (await store()).press;
  const quote = ps.panels[1].els.find(e => e.kind === 'text' && /A line worth pulling out/.test(e.text || ''));
  ok('A PULL QUOTE IS SERIF, CENTRED, LARGE', !!quote && quote.voice === 'serif' && quote.align === 'center' && quote.size >= 18);

  // ---- a second press takes the numbers off, and the text view never read them.
  await block('folios');
  ps = (await store()).press;
  ok('PAGE NUMBERS COME OFF AS THEY WENT ON', ps.panels.every(p => !(p.els || []).some(e => e.folio)));
  await block('folios');
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  await go('#shelf');
  await page.click('[data-readissue="01"]');
  await page.waitForTimeout(250);
  await page.click('#shelfreader [data-readmode="text"]');
  await page.waitForTimeout(250);
  ok('the text view does not read out page numbers',
     (await page.locator('#shelfreader .reading-cut').allInnerTexts()).every(t => !/^\d+$/.test(t.trim())));

  ok('no script errors around blocks', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
