// The file shows the zine as it was made. Somebody handed an issue sees the
// pages, cuttings and stamps where they were glued, and a photograph run
// across the gutter shows on both pages: on screen, in the file, in the
// browser's print and in the PDF. Back issues ride with their covers only,
// so a file does not grow with the shelf until nobody can send it.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { photoFile, cutoutFile } = require('./fixture.js');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function pages(browser, ok) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-pages-'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  await page.goto(APP);
  await page.waitForTimeout(700);

  // №01: a scrap photograph for the cover, and another glued to page 2 and
  // pushed over the gutter into page 3.
  await go('#scraps');
  await page.setInputFiles('#photofile', photoFile());
  await page.waitForTimeout(1500);
  await go('#press');
  const p2 = page.locator('[data-page="2"]');
  await p2.scrollIntoViewIfNeeded();
  await p2.click({ position: { x: 6, y: 6 } });
  await page.setInputFiles('#pastephotofile', cutoutFile());
  await page.waitForTimeout(1500);
  for (let i = 0; i < 25; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(300);
  ok('A CUTTING RUN OVER THE GUTTER SHOWS ON THE FACING PAGE',
     (await page.locator('[data-page="3"] .el.ghost.el-photo').count()) === 1);
  await p2.click({ position: { x: 6, y: 6 } });
  await page.click('#stampbtn');
  await page.waitForTimeout(150);
  await page.click('[data-stamp="takeone"]');
  await page.waitForTimeout(200);

  let s = await store();
  const inner = s.press.panels[1].els.find(e => e.kind === 'photo').photo;
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(400);
  s = await store();
  const cover1 = s.press.panels[0].photo;

  // The PDF draws the photograph on both pages of the spread.
  await go('#paper');
  const [pdl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const pdf = fs.readFileSync(await pdl.path(), 'latin1');
  const draws = (pdf.match(/ Do Q/g) || []).length;
  ok('THE PDF PRINTS IT ACROSS BOTH PAGES', draws === 3, draws + ' image draws (cover, cutting, overhang)');

  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);

  // The browser's print of the back issue carries the overhang too.
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.click('[data-reprintissue="01"]');
  await page.waitForTimeout(150);
  ok('and so does the browser\'s print of the back issue',
     (await page.locator('#reprintzone .panel[data-page="3"] .el.ghost').count()) === 1);
  await page.waitForTimeout(900);

  // №02: a new cover photograph, and hand it on.
  await go('#scraps');
  await page.setInputFiles('#photofile', photoFile());
  await page.waitForTimeout(1500);
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(400);
  await go('#press');
  const p4 = page.locator('[data-page="4"]');
  await p4.scrollIntoViewIfNeeded();
  await p4.click({ position: { x: 6, y: 6 } });
  await page.click('#stampbtn');
  await page.waitForTimeout(150);
  await page.click('[data-stamp="star"]');
  await page.waitForTimeout(200);
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  s = await store();
  const cover2 = s.issues.find(i => i.no === '02').panels[0].photo;
  const [hdl] = await Promise.all([page.waitForEvent('download'), page.click('#handonbtn')]);
  const file = path.join(dir, 'issue-02.html');
  await hdl.saveAs(file);
  const html = fs.readFileSync(file, 'utf8');
  const seed = JSON.parse(/<script type="application\/json" id="stoop-seed">([\s\S]*?)<\/script>/.exec(html)[1].replace(/<\\\//g, '</'));
  const carried = Object.keys(seed.photos);
  ok('THE ISSUE IN HAND CARRIES ITS PHOTOGRAPHS', carried.includes(cover2), carried.length + ' photo(s)');
  ok('A BACK ISSUE RIDES WITH ITS COVER, NOT EVERY PHOTOGRAPH',
     carried.includes(cover1) && !carried.includes(inner),
     'cover of №01 ' + carried.includes(cover1) + ', inside of №01 ' + carried.includes(inner));
  await ctx.close();

  // Somebody opens the file on a phone.
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const phone = await pctx.newPage();
  const perrs = [];
  phone.on('pageerror', e => perrs.push(e.message));
  await phone.goto('file://' + file);
  await phone.waitForTimeout(1000);
  ok('THE FILE OPENS ON THE PAGES AS MADE', (await phone.locator('#landing .readrun .panel').count()) === 8,
     (await phone.locator('#landing .readrun .panel').count()) + ' pages');
  ok('stamps and all', (await phone.locator('#landing .readrun .el-stamp').count()) >= 1);
  const coverWidth = await phone.locator('#landing .readrun .panel.cover').evaluate(el => el.getBoundingClientRect().width);
  ok('a page fills the phone', coverWidth > 330, Math.round(coverWidth) + 'px of 390');
  await phone.click('#landing [data-readmode="text"]');
  await phone.waitForTimeout(200);
  ok('and the text is one tap away', (await phone.locator('#landing .reading').count()) === 1 &&
     (await phone.locator('#landing .readrun').count()) === 0);

  // The back issue read from the file: its inside photograph is not here.
  await phone.click('#landshelf');
  await phone.waitForTimeout(400);
  await phone.click('[data-readissue="01"]');
  await phone.waitForTimeout(400);
  await phone.click('#shelfreader [data-readmode="pages"]');
  await phone.waitForTimeout(300);
  ok('A BACK ISSUE\'S MISSING PHOTOGRAPH SHOWS AS A PLACE, AND SAYS WHERE IT IS',
     /photo in its own issue file/.test(await phone.locator('#shelfreader').innerText()));
  ok('no script errors, on either machine', errs.length === 0 && perrs.length === 0,
     errs.concat(perrs).slice(0, 3).join(' | '));
  await pctx.close();
};
