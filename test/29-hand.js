// Handing on. On a phone that can share files, everything that leaves the
// press leaves through the share sheet (stubbed here, since a test cannot
// tap AirDrop); a PDF that takes longer to write than a tap lasts offers a
// fresh tap; a laptop still downloads. The scene's contact goes wherever a
// piece is sent from: the share's text, the colophon, the file's last
// page and the reply from paper.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const CONTACT = 'bats@cuddlecast.example';

function stubShare() {
  window.__shared = [];
  window.__refuse = 0;
  navigator.canShare = () => true;
  navigator.share = (d) => {
    if (window.__refuse > 0) {
      window.__refuse--;
      const e = new Error('a share needs its own tap');
      e.name = 'NotAllowedError';
      return Promise.reject(e);
    }
    const f = d.files[0];
    return f.text().then(t => {
      window.__shared.push({ name: f.name, type: f.type, size: f.size, text: d.text || '', head: t.slice(0, 15) });
    });
  };
}

async function open(browser, phone) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true }
    : { viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(stubShare);
  const page = await ctx.newPage();
  const errs = [], downloads = [], asked = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('download', d => downloads.push(d));
  page.on('dialog', d => { asked.push(d.message()); d.accept(asked.length === 1 ? 'Ro' : undefined); });
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(300); };
  const shared = () => page.evaluate(() => window.__shared);
  return { ctx, page, errs, downloads, asked, go, shared };
}

module.exports = async function hand(browser, ok) {
  // ---- a phone.
  const P = await open(browser, true);
  const page = P.page;
  await page.goto(APP);
  await page.waitForTimeout(800);
  await P.go('#backup');
  await page.fill('#zinename', 'CUDDLECAST');
  await page.fill('#addressinput', 'cuddlecast.example');
  await page.fill('#contactinput', CONTACT);
  await page.click('#savenamesbtn3');
  await page.waitForTimeout(200);
  ok('THE SCENE KEEPS WHERE PIECES GO', (await page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')).contact)) === CONTACT);

  await P.go('#desk');
  await page.fill('#piecetitle', 'The 800 at 3am');
  await page.fill('#piecebody', 'A bat over the river, and nobody else.');
  await page.click('#piecesubmitbtn');
  await page.waitForTimeout(200);
  await page.locator('#desktray .sub-row', { hasText: 'The 800 at 3am' }).locator('[data-piecebundle]').click();
  await page.waitForTimeout(500);
  let s = await P.shared();
  ok('ON A PHONE, SEND OPENS THE SHARE SHEET WITH THE PIECE AS A FILE', s.length === 1 && /^piece-me-the-800-at-3am\.html$/.test(s[0].name) &&
     s[0].type === 'text/html' && s[0].head === '<!doctype html>' && P.downloads.length === 0, JSON.stringify(s));
  ok('and the share says where it goes', s[0] && s[0].text.indexOf('Send it to ' + CONTACT) >= 0, s[0] && s[0].text);

  // ---- a PDF takes longer to write than a tap lasts.
  await page.evaluate(() => { window.__refuse = 1; });
  await P.go('#paper');
  await page.click('#pdfzinebtn');
  await page.waitForTimeout(2500);
  const offer = await page.evaluate(() => { const t = document.getElementById('toast'); return t && t.style.display !== 'none' ? t.innerText : ''; });
  ok('A FILE THAT OUTLIVED ITS TAP OFFERS A FRESH ONE', /is ready\./.test(offer) && /SHARE/.test(offer), offer);
  await page.click('#toast .toast-undo');
  await page.waitForTimeout(500);
  s = await P.shared();
  ok('and the tap shares it', s.length === 2 && /\.pdf$/.test(s[1].name) && s[1].type === 'application/pdf' && s[1].head.indexOf('%PDF-1.4') === 0,
     JSON.stringify(s.slice(1)));

  await P.go('#backup');
  await page.click('#exportbtn');
  await page.waitForTimeout(500);
  s = await P.shared();
  ok('a backup is shared too', s.length === 3 && /^stoop-\d{4}-\d\d-\d\d\.json$/.test(s[2].name) && P.downloads.length === 0, s[2] && s[2].name);

  // ---- the contact in the colophon.
  await P.go('#press');
  await page.locator('#sheetzone [data-page="8"]').scrollIntoViewIfNeeded();
  await page.locator('#sheetzone [data-page="8"]').click({ position: { x: 6, y: 6 } });
  await page.click('#blockbtn');
  await page.click('[data-block="colophon"]');
  await page.waitForTimeout(300);
  ok('THE COLOPHON SAYS WHERE TO WRITE', (await page.locator('#sheetzone [data-page="8"] .el-text .eltext').last().innerText()).indexOf('Write to ' + CONTACT) >= 0);
  ok('no script errors on the phone', P.errs.length === 0, P.errs.slice(0, 3).join(' | '));
  await P.ctx.close();

  // ---- a laptop downloads, as it always did; the file carries the contact.
  const D = await open(browser, false);
  await D.page.goto(APP);
  await D.page.waitForTimeout(700);
  await D.go('#backup');
  await D.page.fill('#addressinput', 'cuddlecast.example');
  await D.page.fill('#contactinput', CONTACT);
  await D.page.click('#savenamesbtn3');
  await D.go('#desk');
  await D.page.click('#compileissuebtn');
  await D.page.waitForTimeout(400);
  await D.page.click('#buildissuebtn');
  await D.page.waitForTimeout(600);
  const [dl] = await Promise.all([D.page.waitForEvent('download'), D.page.click('#handonbtn')]);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-hand-')), 'issue.html');
  await dl.saveAs(file);
  ok('A LAPTOP STILL DOWNLOADS', (await D.shared()).length === 0 && /"contact":"bats@cuddlecast\.example"/.test(fs.readFileSync(file, 'utf8')));
  await D.ctx.close();

  // ---- a stranger holding the file, and writing back from the paper.
  const R = await open(browser, true);
  await R.page.goto('file://' + file);
  await R.page.waitForTimeout(1000);
  ok('THE FILE\'S LAST WORD SAYS WHERE TO WRITE BACK', (await R.page.locator('#landing .landing-note').innerText()).indexOf('Write back to ' + CONTACT) >= 0);
  await R.page.goto('file://' + file + '#reply');
  await R.page.waitForTimeout(1200);
  const said = await R.page.evaluate(() => document.getElementById('toast').innerText);
  ok('AND THE REPLY FROM PAPER SAYS WHERE TO SEND IT', said.indexOf('send it to ' + CONTACT) >= 0, said);
  ok('no script errors writing back', R.errs.length === 0, R.errs.slice(0, 3).join(' | '));
  await R.ctx.close();
};
