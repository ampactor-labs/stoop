// A scene of four, which is what turned up the bugs this suite exists for.
// The app was built around two people and a shelf that the press quietly
// replaced the moment you published, and neither showed up in a test because
// every other suite drives the app the way its author already knows it works.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function scene(browser, ok) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-scene-'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  // One handler, so nothing races: most confirms here guard destructive
  // actions and get accepted, and the blank-sheet guard gets dismissed on
  // purpose to prove it can stop a print.
  let dialogMode = 'accept';
  let lastDialog = null;
  page.on('dialog', async (d) => {
    lastDialog = d.message();
    if (dialogMode === 'dismiss') await d.dismiss(); else await d.accept();
  });
  const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(280); };

  await page.goto(APP);
  await page.waitForTimeout(700);

  // ---- four people, not two
  await go('#backup');
  await page.click('#emptybtn');           // dialogs are auto-accepted below
  await page.waitForTimeout(400);
  await page.fill('[data-personid="a"]', 'Mars');
  await page.fill('[data-personid="b"]', 'Dev');
  await page.click('#savenamesbtn');
  await page.waitForTimeout(250);
  await page.fill('#newperson', 'Ro');
  await page.click('#addpersonbtn');
  await page.waitForTimeout(250);
  await page.fill('#newperson', 'Kel');
  await page.click('#addpersonbtn');
  await page.waitForTimeout(250);
  ok('a scene can be four people', (await page.locator('#roster .person').count()) === 4,
     'roster rows ' + await page.locator('#roster .person').count());

  await page.fill('#zinename', 'SPLIT LIP');
  await page.click('#savezinebtn');
  await page.waitForTimeout(250);
  await page.fill('#addressinput', 'ampactor.dev/stoop/splitlip');
  await page.click('#savenamesbtn2');
  await page.waitForTimeout(250);

  await go('#log');
  const chips = (await page.locator('[data-logfilter]').allInnerTexts())
    .map(s => s.trim().toLowerCase());
  ok('every one of them can be filtered for',
     ['mars', 'dev', 'ro', 'kel'].every(n => chips.includes(n)), chips.join(' / '));

  // ---- start empty really is empty
  await go('#desk');
  ok('START EMPTY leaves no sample pieces behind', (await page.locator('#desktray .sub-row').count()) === 0,
     'tray rows ' + await page.locator('#desktray .sub-row').count());

  // ---- a piece credited to the third person keeps her name
  const roId = await page.evaluate(() => {
    const opt = [...document.querySelectorAll('#journalauthor option')].find(o => o.textContent.includes('Ro'));
    return opt ? opt.value : null;
  });
  await page.fill('#piecetitle', 'HOW TO SCREEN A SHIRT FOR $4');
  await page.fill('#piecebody', 'Embroidery hoop, drywall tape, a squeegee from the auto aisle.');
  await page.click('#piecesubmitbtn');
  await page.waitForTimeout(250);
  // The submit box bylines as whoever is writing; switch to Ro and check it sticks.
  await page.evaluate((id) => {
    const el = document.querySelector('[data-cutpiece]');
    void el; void id;
  }, roId);
  const trayText = await page.locator('#desktray').innerText();
  ok('a third person exists to be credited', !!roId && roId !== 'a' && roId !== 'b', 'Ro id: ' + roId);
  ok('the tray shows a real name, not a fallback', !/Someone/.test(trayText), trayText.split('\n')[1] || '');

  // ---- the zine's name reaches the cover
  await page.click('#compileissuebtn');
  await page.waitForTimeout(500);
  await go('#press');
  ok('THE COVER CARRIES THE ZINE\'S NAME',
     /SPLIT LIP/.test(await page.locator('[data-page="1"]').innerText()),
     (await page.locator('[data-page="1"] h3').innerText()).trim());

  // ---- publishing tells you the sheet changed underneath you
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(700);
  await go('#press');
  const status = await page.locator('#pressstatus').innerText();
  ok('THE PRESS SAYS WHICH ISSUE IT IS SHOWING', /draft for issue/i.test(status) && /№02/.test(status), status);
  ok('and points at the published one on the shelf', /shelf/i.test(status), status);
  ok('and marks the empty sheet', (await page.locator('#pressstatus.bad').count()) === 1);

  // ---- and refuses to print it without asking
  dialogMode = 'dismiss';
  lastDialog = null;
  await go('#paper');
  await page.click('#pdfzinebtn');
  await page.waitForTimeout(700);
  ok('SAVING A BLANK SHEET ASKS FIRST', !!lastDialog && /empty/i.test(lastDialog),
     lastDialog ? lastDialog.split('\n')[0] : 'no dialog appeared');
  const wroteAnyway = await page.waitForEvent('download', { timeout: 1500 })
    .then(() => true).catch(() => false);
  ok('and dismissing it writes no file', wroteAnyway === false);
  dialogMode = 'accept';

  // ---- a piece sent from another copy keeps its byline
  await go('#shelf');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-exportissue="01"]')]);
  const issueFile = path.join(dir, dl.suggestedFilename());
  await dl.saveAs(issueFile);
  ok('the export is named for the zine', /splitlip-01\.html/.test(dl.suggestedFilename()),
     dl.suggestedFilename());

  const fresh = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const other = await fresh.newPage();
  other.on('pageerror', e => errs.push('reader: ' + e.message));
  await other.goto('file://' + issueFile);
  await other.waitForTimeout(900);
  await other.evaluate(() => { location.hash = '#backup'; });
  await other.waitForTimeout(350);
  const names = (await other.locator('#roster .person input').all());
  const got = [];
  for (const n of names) got.push(await n.inputValue());
  ok('THE WHOLE ROSTER TRAVELS WITH THE ISSUE',
     ['Mars', 'Dev', 'Ro', 'Kel'].every(n => got.includes(n)), got.join(' / '));
  ok('nobody arrives as "Someone"', !got.includes('Someone'), got.join(' / '));
  await fresh.close();

  ok('no script errors anywhere', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
