// The keystone. An exported issue is opened in a browser that has never seen
// this app — no localStorage, no IndexedDB, nothing — and has to be the
// reading view, the archive, and a working press for the next issue. If this
// suite passes, credible exit is a file rather than a promise.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function selfcarry(browser, ok) {
  const errs = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-issue-'));

  // ---- the scene that publishes
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('publisher: ' + e.message));
  const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(250); };

  await page.goto(APP);
  await page.waitForTimeout(600);
  await go('#backup');
  await page.fill('#addressinput', 'ampactor.dev/stoop/nightbus');
  await page.click('#savenamesbtn2');
  await page.waitForTimeout(200);

  await go('#desk');
  await page.fill('#piecetitle', 'The Seam');
  await page.fill('#piecebody', 'Orange behind you, white ahead, and everyone walked the orange way.');
  await page.click('#piecesubmitbtn');
  await page.waitForTimeout(200);
  await page.fill('#editornote', 'One issue, handed over as a file.');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(400);

  // The paper points at the archive, or the loop is open.
  await go('#press');
  ok('the back cover carries a scannable code', (await page.locator('.backcover .addr .qr').count()) === 1);
  ok('the back cover carries the address in text',
     /ampactor\.dev\/stoop\/nightbus/.test(await page.locator('.backcover .addr span').innerText()));

  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);

  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-exportissue="01"]')
  ]);
  const file = path.join(dir, dl.suggestedFilename());
  await dl.saveAs(file);
  const html = fs.readFileSync(file, 'utf8');
  ok('the file is named for its scene and issue', /nightbus-01\.html/.test(dl.suggestedFilename()),
     dl.suggestedFilename());
  ok('the file reaches for nothing on any network', !/(src|href)="https?:/.test(html));
  // What this file weighs, and why, is test/08-weight.js. Here it only has to
  // be a file rather than a download: an issue of plain text is the press and
  // almost nothing else, which is the fixed cost every issue pays.
  ok('an issue of text is the press and little else',
     html.length < 192 * 1024, Math.round(html.length / 1024) + ' KB');
  await ctx.close();

  // ---- the machine that has never seen stoop
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
  const other = await fresh.newPage();
  other.on('pageerror', e => errs.push('reader: ' + e.message));
  const go2 = async (hash) => { await other.evaluate(h => { location.hash = h; }, hash); await other.waitForTimeout(250); };

  await other.goto('file://' + file);
  await other.waitForTimeout(900);
  ok('THE FILE OPENS AS THE ISSUE, NOT AS AN APP',
     (await other.evaluate(() => location.hash)) === '#issue',
     await other.evaluate(() => location.hash));
  ok('and nothing half-shown from the machine that made it',
     (await other.evaluate(() => getComputedStyle(document.getElementById('toast')).display)) === 'none');
  ok('with no chrome around it',
     (await other.evaluate(() => getComputedStyle(document.querySelector('header.chrome')).display)) === 'none');
  ok('the issue reads',
     /orange behind you|handed over as a file/i.test(await other.locator('#landing .reading').innerText()));
  ok('and the press it rode in offers itself',
     /MAKE №02/.test(await other.locator('#landmake').innerText()),
     await other.locator('#landmake').innerText());
  await other.click('#landmake');
  await other.waitForTimeout(350);
  ok('MAKE №02 lands you at the desk, chrome back on',
     (await other.evaluate(() => location.hash + ' ' + document.body.classList.contains('landing'))) === '#desk false');
  await go2('#shelf');
  ok('the archive travelled with it', (await other.locator('.shelf-row').count()) === 1);

  // And now the claim that matters: it is a press, not a document.
  await go2('#desk');
  ok('the desk holds the next issue', /issue №02/.test(await other.locator('#deskhead').innerText()),
     await other.locator('#deskhead').innerText());
  await other.fill('#piecetitle', 'Written Inside The Issue');
  await other.fill('#piecebody', 'No server was involved in the making of this page.');
  await other.click('#piecesubmitbtn');
  await other.waitForTimeout(250);
  await other.click('#compileissuebtn');
  await other.waitForTimeout(400);
  await go2('#press');
  ok('the press inside the file composes',
     /No server was involved/.test(await other.locator('#sheetzone').innerText()));
  await go2('#desk');
  await other.click('#buildissuebtn');
  await other.waitForTimeout(700);
  ok('ISSUE TWO WAS MADE FROM THE FILE ALONE', (await other.locator('.shelf-row').count()) === 2,
     'shelf rows ' + await other.locator('.shelf-row').count());

  const [dl2] = await Promise.all([
    other.waitForEvent('download'),
    other.click('[data-exportissue="02"]')
  ]);
  const onward = path.join(dir, dl2.suggestedFilename());
  await dl2.saveAs(onward);
  const html2 = fs.readFileSync(onward, 'utf8');
  ok('the new issue hands on a press of its own',
     /id="stoop-seed"/.test(html2) && /function buildIssue/.test(html2));
  ok('and carries both back issues with it',
     /"no":"01"/.test(html2) && /"no":"02"/.test(html2));

  ok('no script errors on either machine', errs.length === 0, errs.slice(0, 3).join(' | '));
  await fresh.close();
};
