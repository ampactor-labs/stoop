// The loop between people, closed. An issue is handed on, somebody makes a
// piece from the file and sends it back, and the editor opens it. Each hop
// used to lose something: the sender's name, the piece itself, or a page of
// somebody else's issue riding along in the file.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  const answers = [];   // queued replies to prompts and confirms; empty means accept
  const asked = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', async d => {
    asked.push(d.message());
    const a = answers.shift();
    if (a === false) await d.dismiss();
    else await d.accept(typeof a === 'string' ? a : undefined);
  });
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  const toastText = () => page.evaluate(() => {
    const t = document.getElementById('toast');
    return t && t.style.display !== 'none' ? t.innerText : '';
  });
  return { ctx, page, errs, answers, asked, go, store, toastText };
}

module.exports = async function loop(browser, ok) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-loop-'));

  // ---- the editor makes №01 and hands it on.
  const E = await open(browser);
  await E.page.goto(APP);
  await E.page.waitForTimeout(700);
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const script = /<script>\n\(function\(\)\{([\s\S]*)\}\)\(\);\n<\/script>/.exec(src);
  ok('the shipped press carries code, not the notes on it',
     !!script && !/^\s*\/\//m.test(script[1]));
  const hint = await E.page.evaluate(() =>
    getComputedStyle(document.querySelector('#sheetzone .cover .body'), '::before').content);
  ok('the empty cover says "anything · type · drop" with its spaces', /anything · type · drop/.test(hint), hint);

  await E.page.click('#barzine');
  await E.page.keyboard.press('Control+A');
  await E.page.keyboard.type('NIGHT BUS');
  await E.page.keyboard.press('Enter');
  await E.go('#desk');
  await E.page.click('#compileissuebtn');
  await E.page.waitForTimeout(400);

  // ---- a hand edit is not flowed over without asking.
  await E.go('#press');
  const body2 = E.page.locator('[data-page="2"] .body');
  await body2.click();
  await E.page.keyboard.press('End');
  await E.page.keyboard.type(' HAND EDIT.');
  await E.page.evaluate(() => document.activeElement.blur());
  await E.page.waitForTimeout(300);
  await E.go('#desk');
  E.answers.push(false);
  await E.page.click('#compileissuebtn');
  await E.page.waitForTimeout(300);
  await E.go('#press');
  ok('FLOWING AGAIN ASKS BEFORE REPLACING A PAGE CHANGED BY HAND',
     /changed by hand/.test(E.asked[E.asked.length - 1] || '') && /HAND EDIT/.test(await body2.innerText()),
     E.asked[E.asked.length - 1]);
  await E.go('#desk');
  E.answers.push(true);
  await E.page.click('#compileissuebtn');
  await E.page.waitForTimeout(300);
  await E.go('#press');
  ok('and replaces it when told to', !/HAND EDIT/.test(await body2.innerText()));

  // ---- deletes can be taken back.
  await E.go('#scraps');
  await E.page.fill('#loginput', 'a scrap to lose');
  await E.page.click('#logaddbtn');
  await E.page.waitForTimeout(150);
  await E.page.locator('[data-dellog]').first().click();
  await E.page.waitForTimeout(150);
  const gone = (await E.store()).logs.length;
  await E.page.click('.toast-undo');
  await E.page.waitForTimeout(200);
  ok('A DELETED SCRAP COMES BACK WITH UNDO', gone === 0 && (await E.store()).logs.length === 1);
  await E.go('#desk');
  const pieces = (await E.store()).pieces.length;
  await E.page.locator('[data-droppiece]').first().click();
  await E.page.waitForTimeout(150);
  await E.page.click('.toast-undo');
  await E.page.waitForTimeout(200);
  ok('and so does a piece removed from the tray', (await E.store()).pieces.length === pieces);

  // ---- a cutting over the edge is clipped by its page in the PDF.
  await E.go('#press');
  const p3 = E.page.locator('[data-page="3"]');
  await p3.scrollIntoViewIfNeeded();
  await p3.click({ position: { x: 6, y: 6 } });
  await E.page.click('[data-addel="box"]');
  await E.page.waitForTimeout(200);
  await E.go('#paper');
  const [pdl] = await Promise.all([E.page.waitForEvent('download'), E.page.click('#pdfzinebtn')]);
  const pdf = fs.readFileSync(await pdl.path(), 'latin1');
  ok('EVERY PAGE CLIPS WHAT HANGS OVER ITS EDGE IN THE PDF', (pdf.match(/ re W n\n/g) || []).length >= 8,
     'clips ' + (pdf.match(/ re W n\n/g) || []).length);

  await E.go('#desk');
  await E.page.click('#buildissuebtn');
  await E.page.waitForTimeout(600);
  const [idl] = await Promise.all([E.page.waitForEvent('download'), E.page.click('#handonbtn')]);
  const issueFile = path.join(dir, 'nightbus-01.html');
  await idl.saveAs(issueFile);

  // ---- a reader makes a piece from the file, and says who they are.
  const R = await open(browser);
  await R.page.goto('file://' + issueFile);
  await R.page.waitForTimeout(900);
  R.answers.push('Dee');
  await R.page.click('#landmake');
  await R.page.waitForTimeout(400);
  ok('MAKING FROM A FILE ASKS WHO IS WRITING', /Who is writing/.test(R.asked[0] || '') &&
     (await R.page.locator('#authorname').innerText()) === 'Dee', await R.page.locator('#authorname').innerText());
  await R.page.fill('#piecetitle', 'From the laundromat');
  await R.page.fill('#piecebody', 'Somebody pinned the first issue to the board by the dryers.');
  await R.page.click('#piecesubmitbtn');
  await R.page.waitForTimeout(200);
  const row = R.page.locator('#desktray .sub-row', { hasText: 'From the laundromat' });
  const [sdl] = await Promise.all([R.page.waitForEvent('download'), row.locator('[data-piecebundle]').click()]);
  const pieceFile = path.join(dir, sdl.suggestedFilename());
  await sdl.saveAs(pieceFile);
  const pieceHtml = fs.readFileSync(pieceFile, 'utf8');
  ok('the piece is signed by who wrote it', /^piece-dee-/.test(sdl.suggestedFilename()), sdl.suggestedFilename());
  ok('A FILE CARRIES NO PAGE OF WHATEVER ISSUE WAS ON SCREEN', /<div id="landing"><\/div>/.test(pieceHtml),
     Math.round(pieceHtml.length / 1024) + ' KB');
  await R.ctx.close();

  // ---- the editor opens the piece file, and the piece is in the tray.
  await E.page.goto('file://' + pieceFile);
  await E.page.waitForTimeout(900);
  const tray = await E.page.locator('#desktray').innerText();
  ok('OPENING A PIECE FILE PUTS THE PIECE IN THE TRAY', /From the laundromat\s*— Dee/.test(tray),
     tray.split('\n').filter(l => /laundromat|—/.test(l)).join(' | '));
  ok('and says so', /Took in/.test(await E.toastText()), await E.toastText());
  const people = await E.page.evaluate(() => JSON.parse(localStorage.getItem('stoop_people') || '[]').map(p => p.name));
  ok('only the person who signed it joins the roster', people.join(',') === 'me,Dee', people.join(','));
  await E.page.goto('file://' + pieceFile);
  await E.page.waitForTimeout(900);
  const again = (await E.store()).pieces.filter(p => p.title === 'From the laundromat').length;
  ok('opening it twice takes it in once', again === 1 && /already in the tray/.test(await E.toastText()),
     await E.toastText());
  ok('no script errors around the loop', E.errs.length === 0, E.errs.slice(0, 3).join(' | '));
  await E.ctx.close();
};
