// The table. The page is the first thing on the screen and the biggest, on
// a laptop and on a phone; the tools sit beside it, not on top of it; the
// whole zine is one strip of chips a click or a drag away; the nav runs in
// the order the cycle runs; and on a phone nothing the press puts on screen
// gets between a thumb and the bell.
const path = require('path');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function frame(browser, ok) {
  // ---- a laptop.
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(300); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  const box = (p, sel) => p.locator(sel).first().evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }; });
  await page.goto(APP);
  await page.waitForTimeout(800);

  const cover = await box(page, '#sheetzone [data-page="1"]');
  ok('THE COVER IS ON SCREEN WITHOUT SCROLLING, AND IS THE BIGGEST THING ON IT',
     cover.top >= 0 && cover.bottom <= 900 && cover.top < 200 && cover.h > 450,
     'top ' + Math.round(cover.top) + ', bottom ' + Math.round(cover.bottom) + ', ' + Math.round(cover.h) + ' tall');
  const nav = await page.locator('header.chrome [data-nav]').allInnerTexts();
  ok('THE NAV RUNS THE WAY THE CYCLE RUNS', nav.map(t => t.trim()).join(' ') === 'scraps desk press paper shelf scene', nav.join(' '));
  ok('the bar says whose turn it is and when the bell rings',
     /№01 · .*turn · .*bell/.test(await page.locator('#cycleline').innerText()), await page.locator('#cycleline').innerText());
  const rail = await box(page, '.rail');
  ok('the tools are a rail beside the page, not a strip above it', rail.right < cover.left && rail.h > 300);

  // ---- the strip.
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(500);
  await go('#press');
  ok('EVERY PAGE IS A CHIP IN THE STRIP', (await page.locator('#pagestrip .pchip').count()) === 8 &&
     /THE SEAM/i.test(await page.locator('#pagestrip .pchip[data-gopage="2"]').innerText()));
  await page.click('#pagestrip .pchip[data-gopage="5"]');
  await page.waitForTimeout(400);
  const p5 = await box(page, '#sheetzone [data-page="5"]');
  ok('A CHIP TAKES THE TABLE TO ITS PAGE AND THE SHEET TURNS TO IT',
     p5.top >= 0 && p5.bottom <= 900 && /PAGE 5/.test(await page.locator('#inspector').innerText()) &&
     (await page.locator('#pagestrip .pchip.here').getAttribute('data-gopage')) === '5',
     'page 5 top ' + Math.round(p5.top));

  const before = (await store()).press;
  const seam = before.panels[1].h, bench = before.panels[2].h;
  const c3 = await box(page, '#pagestrip .pchip[data-gopage="3"]');
  const c5 = await box(page, '#pagestrip .pchip[data-gopage="5"]');
  await page.mouse.move(c3.left + c3.w / 2, c3.top + c3.h / 2);
  await page.mouse.down();
  await page.mouse.move(c5.left + c5.w / 2, c5.top + c5.h / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = (await store()).press;
  ok('DRAGGING A CHIP MOVES THE PAGE, WITH ITS WORDS, AND THE PIECE KNOWS WHERE IT WENT',
     after.panels[4].h === bench && after.panels[1].h === seam && after.panels[2].h === '' &&
     after.ran.some(r => r.page === 5) && !after.ran.some(r => r.page === 3),
     after.panels.map(p => p.h || '·').join(' | '));
  ok('and the covers stay where covers are', after.panels[0].h === before.panels[0].h && after.panels[7].h === before.panels[7].h);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  ok('undo puts it back', (await store()).press.panels[2].h === bench);

  // ---- the zoom.
  const zoomOf = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#sheetzone .pages')).zoom) || 1);
  const fit = await zoomOf();
  await page.click('[data-zoom="full"]');
  await page.waitForTimeout(200);
  const full = await zoomOf();
  await page.click('[data-zoom="page"]');
  await page.waitForTimeout(200);
  const big = await zoomOf();
  await page.click('[data-zoom="fit"]');
  ok('FIT, PAGE AND 100% ARE THREE SIZES', Math.abs(full - 1) < 0.01 && big > fit && fit !== full,
     'fit ' + fit.toFixed(2) + ', page ' + big.toFixed(2) + ', full ' + full);
  ok('no script errors on the laptop', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();

  // ---- a phone.
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await pctx.newPage();
  const perrs = [];
  phone.on('pageerror', e => perrs.push(e.message));
  phone.on('dialog', d => d.accept());
  const pgo = async (h) => { await phone.evaluate(x => { location.hash = x; }, h); await phone.waitForTimeout(300); };
  await phone.goto(APP);
  await phone.waitForTimeout(800);
  const pcover = await box(phone, '#sheetzone [data-page="1"]');
  const tabs = await box(phone, '#phonetabs');
  const prail = await box(phone, '.rail');
  ok('ON A PHONE THE COVER IS ON SCREEN, ABOVE THE TOOLS AND THE TABS',
     pcover.top >= 0 && pcover.bottom <= Math.min(tabs.top, prail.top) + 1 && pcover.w > 330,
     'cover ' + Math.round(pcover.top) + '–' + Math.round(pcover.bottom) + ', rail from ' + Math.round(prail.top) + ', tabs from ' + Math.round(tabs.top));
  ok('the tabs are the cycle, in the thumb zone', (await phone.locator('#phonetabs [data-nav]').allInnerTexts()).map(t => t.trim()).join(' ') === 'scraps desk press paper shelf scene' &&
     tabs.bottom <= 844 && tabs.top > 700);

  await phone.locator('#sheetzone [data-page="2"]').scrollIntoViewIfNeeded();
  await phone.locator('#sheetzone [data-page="2"]').click({ position: { x: 6, y: 6 } });
  await phone.click('[data-addel="text"]');
  await phone.waitForTimeout(300);
  const sheet = await box(phone, '#inspector');
  ok('A SELECTED CUTTING\'S SHEET TAKES LESS THAN HALF THE SCREEN', sheet.h <= 844 * 0.45 && sheet.bottom <= prail.top + 1,
     Math.round(sheet.h) + 'px of 844');

  await pgo('#desk');
  ok('the tab for the open drawer is marked', (await phone.locator('#phonetabs [data-nav].here').getAttribute('data-nav')) === 'desk');
  let reachable = true;
  try { await phone.click('#buildissuebtn', { trial: true, timeout: 3000 }); } catch (e) { reachable = false; }
  ok('THE BELL IS REACHABLE ON A PHONE WHILE A CUTTING IS SELECTED', reachable);
  await pgo('#press');
  ok('no script errors on the phone', perrs.length === 0, perrs.slice(0, 3).join(' | '));
  await pctx.close();
};
