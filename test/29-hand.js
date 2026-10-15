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
const FIXTURES = require('./qr-fixtures.json');
const NIGHTBUS = 'https://ampactor.dev/stoop/nightbus/01/';

function fromRuns(runs, n) {
  const rows = Array.from({ length: n }, () => Array(n).fill('0'));
  runs.forEach(([x, y, len]) => { for (let i = 0; i < len; i++) if (rows[y] && x + i < n) rows[y][x + i] = '1'; });
  return rows.map(r => r.join(''));
}

// The sheet's code, read back square by square.
function sheetCode(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('#handsheet .handqr');
    if (!svg) return null;
    const n = Number(svg.getAttribute('viewBox').split(' ')[2]) - 8;
    const runs = [...svg.querySelector('path').getAttribute('d').matchAll(/M(\d+) (\d+)h(\d+)/g)]
      .map(m => [Number(m[1]) - 4, Number(m[2]) - 4, Number(m[3])]);
    return { n, runs, width: svg.getBoundingClientRect().width, label: svg.getAttribute('aria-label') };
  });
}
const seedOf = (html) => JSON.parse((html.match(/<script[^>]*id="stoop-seed"[^>]*>([\s\S]*?)<\/script>/) || ['', 'null'])[1].replace(/<\\\//g, '</'));

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
  const [dl] = await Promise.all([D.page.waitForEvent('download'), D.page.click('#handonbtn').then(() => D.page.click('#handfile'))]);
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

  // ---- the issue's sheet, on a phone held out across a table.
  const want = FIXTURES[NIGHTBUS].matrix;
  const H = await open(browser, true);
  const hp = H.page;
  await hp.goto(APP);
  await hp.waitForTimeout(800);
  await hp.click('#handonbtn');
  await hp.waitForTimeout(300);
  ok('with nothing published, hand it on still says so and opens no sheet',
     !(await hp.evaluate(() => document.body.classList.contains('handing'))) && (await hp.evaluate(() => location.hash)) === '#desk');
  await H.go('#backup');
  await hp.fill('#addressinput', FIXTURES[NIGHTBUS].address);
  await hp.click('#savenamesbtn2');
  await H.go('#desk');
  await hp.click('#compileissuebtn');
  await hp.waitForTimeout(400);
  await hp.click('#buildissuebtn');
  await hp.waitForTimeout(700);
  await hp.click('#handonbtn');
  await hp.waitForTimeout(300);
  let code = await sheetCode(hp);
  let rows = code ? fromRuns(code.runs, code.n) : [];
  ok('HAND IT ON OPENS THE ISSUE\'S SHEET, ITS CODE MOST OF THE PHONE\'S WIDTH', !!code && code.width >= 390 * 0.6 &&
     (await hp.locator('#handsheet .hand-addr').innerText()) === 'ampactor.dev/stoop/nightbus/01/', code && Math.round(code.width) + 'px');
  ok('AND THE CODE IS THE INDEPENDENT ENCODER\'S, SQUARE FOR SQUARE', !!code && code.n === want.length && rows.every((r, i) => r === want[i]),
     code ? 'rows differing ' + rows.filter((r, i) => r !== want[i]).length : 'no code');
  ok('a screen reader hears what it opens', !!code && code.label === 'A code for ' + NIGHTBUS);
  await hp.click('#handfile');
  await hp.waitForTimeout(500);
  let s2 = await H.shared();
  ok('SHARE THE FILE HANDS THE ISSUE ON, AND PUTS THE SHEET AWAY', s2.length === 1 && s2[0].name === 'nightbus-01.html' &&
     s2[0].type === 'text/html' && !(await hp.evaluate(() => document.body.classList.contains('handing'))), JSON.stringify(s2));

  await H.go('#shelf');
  await hp.click('[data-handissue="01"]');
  await hp.waitForTimeout(300);
  ok('every issue on the shelf has the same sheet', !!(await sheetCode(hp)));
  await hp.keyboard.press('Escape');
  await hp.waitForTimeout(200);
  ok('and Escape puts it away', !(await hp.evaluate(() => document.body.classList.contains('handing'))));
  await hp.click('[data-handissue="01"]');
  await hp.waitForTimeout(200);
  await hp.click('#handscrim', { position: { x: 5, y: 5 } });
  await hp.waitForTimeout(200);
  ok('so does a tap outside it', !(await hp.evaluate(() => document.body.classList.contains('handing'))));

  // The file in hand, passed on from its own landing: the same zine, the same seed.
  const D2 = await open(browser, false);
  await D2.page.goto(APP);
  await D2.page.waitForTimeout(700);
  await D2.go('#backup');
  await D2.page.fill('#addressinput', FIXTURES[NIGHTBUS].address);
  await D2.page.fill('#zinename', 'NIGHT BUS');
  await D2.page.click('#savenamesbtn2');
  await D2.go('#desk');
  await D2.page.click('#compileissuebtn');
  await D2.page.waitForTimeout(400);
  await D2.page.click('#buildissuebtn');
  await D2.page.waitForTimeout(600);
  const [fdl] = await Promise.all([D2.page.waitForEvent('download'), D2.page.click('#handonbtn').then(() => D2.page.click('#handfile'))]);
  const held = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-held-')), 'nightbus-01.html');
  await fdl.saveAs(held);
  await D2.go('#shelf');
  const [bdl] = await Promise.all([D2.page.waitForEvent('download'), D2.page.click('[data-pdfissue="01"]')]);
  const bpdf = fs.readFileSync(await bdl.path(), 'latin1');
  ok('THE BACK COVER\'S ADDRESS BREAKS AFTER A SLASH, NEVER MID-WORD', /\(ampactor\.dev\/stoop\/\) Tj/.test(bpdf) &&
     /\(nightbus\/01\/\) Tj/.test(bpdf) && /\(write back:\) Tj/.test(bpdf) && /\(nightbus\/01\/#reply\) Tj/.test(bpdf));
  await D2.go('#press');
  ok('and on screen it may break only there', /stoop\/<wbr>nightbus\/<wbr>\d\d\/<wbr>/.test(await D2.page.locator('#sheetzone .backcover .addr span').first().innerHTML()));
  await D2.ctx.close();
  const L = await open(browser, true);
  await L.page.goto('file://' + held);
  await L.page.waitForTimeout(1000);
  await L.page.click('#landpass');
  await L.page.waitForTimeout(300);
  code = await sheetCode(L.page);
  rows = code ? fromRuns(code.runs, code.n) : [];
  ok('ON THE LANDING, PASS IT ON SHOWS THE CODE OF THE ISSUE IN HAND', !!code && rows.every((r, i) => r === want[i]));
  await L.page.click('#handfile');
  await L.page.waitForTimeout(600);
  const passed = await L.page.evaluate(() => window.__shared);
  ok('AND HANDS ON THE SAME FILE: THE SAME ZINE, THE SAME ISSUE', passed.length === 1 && passed[0].name === 'nightbus-01.html' &&
     passed[0].size > 300000, JSON.stringify(passed));
  const again = await L.page.evaluate(() => new Promise(res => {
    const orig = navigator.share;
    navigator.share = (d) => d.files[0].text().then(t => { res(t); });
    document.getElementById('landpass').click();
    setTimeout(() => document.getElementById('handfile').click(), 50);
  }));
  const a = seedOf(fs.readFileSync(held, 'utf8')), b2 = seedOf(again);
  ok('seed for seed', !!a && !!b2 && JSON.stringify(a) === JSON.stringify(b2), (b2 && b2.zine) + ' ' + (b2 && b2.read));

  // No address, nothing to scan.
  await H.go('#backup');
  await hp.fill('#addressinput', '');
  await hp.click('#savenamesbtn2');
  await H.go('#shelf');
  await hp.click('[data-handissue="01"]');
  await hp.waitForTimeout(300);
  ok('WITHOUT AN ADDRESS THE SHEET SAYS SO AND OFFERS THE FILE', !(await sheetCode(hp)) &&
     /no address yet/.test(await hp.locator('#handsheet').innerText()) && (await hp.locator('#handfile').count()) === 1);
  ok('no script errors handing on', H.errs.length === 0 && L.errs.length === 0, H.errs.concat(L.errs).slice(0, 3).join(' | '));
  await L.ctx.close();
  await H.ctx.close();
};
