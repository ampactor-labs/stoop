// What the app promises, proven in a real browser: names, photos, the press,
// and sync between two devices. Run with `node test/run.js`.
const path = require('path');
const { photoFile } = require('./fixture.js');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function features(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(250); };

  await page.goto(APP);
  await page.waitForTimeout(500);

  // Renaming reaches every surface, and past entries keep their author.
  await go('#backup');
  await page.fill('[data-personid="a"]', 'Ampactor');
  await page.click('#savenamesbtn');
  await page.waitForTimeout(200);
  await page.fill('#newperson', 'JJ');
  await page.click('#addpersonbtn');
  await page.waitForTimeout(200);
  const bId = await page.evaluate(() => document.querySelectorAll('[data-personid]')[1].getAttribute('data-personid'));
  await page.fill('[data-personid="' + bId + '"]', 'JJ');
  await page.click('#savenamesbtn');
  await page.waitForTimeout(250);
  ok('rename reaches the filter chips', (await page.locator('[data-logfilter="' + bId + '"]').innerText()).trim() === 'JJ');
  ok('rename reaches the author toggle', (await page.locator('#authorname').innerText()).trim() === 'Ampactor');

  // The joint-author filter matches the joint-author entries.
  await go('#log');
  await page.click('[data-logfilter="both"]');
  await page.waitForTimeout(200);
  ok('the joint filter on a fresh log selects nothing, cleanly',
     (await page.locator('.log-card').count()) === 0 && errs.length === 0);
  await page.click('[data-logfilter="all"]');
  await page.waitForTimeout(150);

  // Photos: real intake, dithered to two levels, small enough to keep.
  await page.fill('#loginput', 'First test photo from the workbench');
  await page.setInputFiles('#photofile', photoFile());
  await page.waitForTimeout(1800);
  ok('a photo lands in the log', (await page.locator('.log-photo').count()) === 1);

  const shot = await page.evaluate(() => {
    const img = document.querySelector('.log-photo');
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const levels = new Set();
    for (let i = 0; i < d.length; i += 4) levels.add(d[i]);
    return { levels: [...levels].sort((a, b) => a - b), bytes: img.src.length };
  });
  ok('the photo is genuinely 1-bit', shot && shot.levels.length === 2 && shot.levels[0] === 0 && shot.levels[1] === 255,
     shot ? 'levels=' + JSON.stringify(shot.levels) : 'no image');
  ok('the photo is small enough to keep', shot && shot.bytes < 120000,
     shot ? Math.round(shot.bytes / 1024) + ' KB' : '');

  await page.reload();
  await page.waitForTimeout(1200);
  ok('the photo survives a reload', (await page.locator('.log-photo').count()) === 1);

  // The press compiles, carries a photo, and keeps what was typed. The log is
  // a source now: it is drawn into a piece at the desk, then flowed onto paper.
  await go('#desk');
  await page.click('#drawsourcesbtn');
  await page.waitForTimeout(350);
  await page.click('#compileissuebtn');
  await page.waitForTimeout(400);
  await go('#press');
  const sheetText = await page.locator('#sheetzone').innerText();
  ok('compile pulls the log onto the sheet', /workbench/i.test(sheetText));
  ok('compile puts the newest photo on the cover', (await page.locator('[data-page="1"] .panel-photo').count()) === 1);

  await page.evaluate(() => {
    const el = document.querySelector('[data-page="6"] .body');
    el.focus();
    el.innerText = 'Tacos at the corner place. Ask for the green sauce.';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.blur();
  });
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForTimeout(1200);
  await go('#press');
  ok('panel text survives a reload', /green sauce/.test(await page.locator('[data-page="6"] .body').innerText()));
  ok('a placed photo survives a reload', (await page.locator('[data-page="1"] .panel-photo').count()) === 1);

  // The imposition is the one the hand kit in press/ uses, and it belongs to
  // paper. On screen the pages read in order, right way up; what reaches the
  // printer is the imposed sheet. window.print is stubbed so the print zone
  // stays populated for inspection, and print media is emulated to prove it
  // is the only thing that would come out.
  const onScreen = await page.evaluate(() =>
    [...document.querySelectorAll('#sheetzone .panel')].map(el => +el.dataset.page));
  ok('THE PRESS SHOWS PAGES IN READING ORDER, RIGHT WAY UP',
     JSON.stringify(onScreen) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]) &&
     (await page.locator('#sheetzone .panel.flip').count()) === 0, JSON.stringify(onScreen));
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await go('#paper');
  await page.click('#printzinebtn');
  await page.waitForTimeout(300);
  const slots = await page.evaluate(() =>
    [...document.querySelectorAll('#reprintzone .sheet .panel')].map(el => +el.dataset.page));
  ok('THE PRINTED SHEET IMPOSES AS PRESET A',
     JSON.stringify(slots) === JSON.stringify([5, 4, 3, 2, 6, 7, 8, 1]), JSON.stringify(slots));
  ok('and the browser was actually asked to print',
     await page.evaluate(() => window.__printed === true));
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(250);
  const printed = await page.evaluate(() => {
    const vis = el => !!(el && el.checkVisibility && el.checkVisibility());
    return {
      sheet: vis(document.querySelector('#reprintzone .sheet')),
      pages: vis(document.querySelector('#sheetzone .pages')),
      chrome: vis(document.querySelector('header.chrome')),
      tray: vis(document.querySelector('.tray-box')),
      actions: vis(document.querySelector('.press-actions'))
    };
  });
  ok('PRINT SHOWS THE IMPOSED SHEET ALONE, NEVER THE PAGES',
     printed.sheet && !printed.pages && !printed.chrome && !printed.tray && !printed.actions,
     JSON.stringify(printed));
  await page.emulateMedia({ media: 'screen' });

  // Two devices, one notebook: export here, merge there, lose nothing.
  await go('#backup');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportbtn')]);
  const backup = path.join(require('os').tmpdir(), 'stoop-test-backup.json');
  await download.saveAs(backup);
  const raw = JSON.parse(require('fs').readFileSync(backup, 'utf8'));
  ok('the backup carries photos', Object.keys(raw.photos || {}).length === 1);

  const other = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const p2 = await other.newPage();
  p2.on('pageerror', e => errs.push('second device: ' + e.message));
  await p2.goto(APP);
  await p2.waitForTimeout(600);
  await p2.evaluate(() => { location.hash = '#log'; });
  await p2.waitForTimeout(250);
  await p2.fill('#loginput', 'A note only this device has');
  await p2.click('#logaddbtn');
  await p2.waitForTimeout(200);
  await p2.evaluate(() => { location.hash = '#backup'; });
  await p2.waitForTimeout(250);
  await p2.click('#mergebtn');
  await p2.setInputFiles('#importfile', backup);
  await p2.waitForTimeout(1300);
  await p2.evaluate(() => { location.hash = '#log'; });
  await p2.waitForTimeout(350);
  const merged = await p2.locator('#loglist').innerText();
  ok('merge keeps this device\'s own note', /only this device has/.test(merged));
  ok('merge brings the other device across', /workbench/i.test(merged));
  ok('merge carries the photo across', (await p2.locator('.log-photo').count()) === 1);


  ok('no script errors anywhere', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
  await other.close();
};
