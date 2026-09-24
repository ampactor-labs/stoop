// The edges people walk into. Every check here is a bug somebody could hit
// without trying: a byline that named a pair that did not exist, a pull that
// doubled the tray, pieces that vanished at the bell without being printed,
// a back cover a format change buried, Backspace in a text box deleting a
// cutting, and a friend's zine that opened to a blank page. Each is driven
// the way a person would drive it, not by calling the function underneath.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { cutoutFile } = require('./fixture.js');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

async function open(browser, dir) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(APP);
  await page.waitForTimeout(700);
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  const roster = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_people') || '[]'));
  const scrap = async (text) => {
    await go('#scraps');
    await page.fill('#loginput', text);
    await page.click('#logaddbtn');
    await page.waitForTimeout(150);
  };
  const piece = async (title) => {
    await go('#desk');
    await page.fill('#piecetitle', title);
    await page.fill('#piecebody', title + ' has a body of a few words.');
    await page.click('#piecesubmitbtn');
    await page.waitForTimeout(120);
  };
  const tray = () => page.locator('#desktray').innerText();
  const text = (sel) => page.locator(sel).innerText();
  const undo = async () => {
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
  };
  return { ctx, page, errs, go, store, roster, scrap, piece, tray, text, undo, dir };
}

module.exports = async function edges(browser, ok) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-edges-'));
  const A = await open(browser, dir);
  const { page, go, store, scrap, piece, tray, text } = A;

  // ---- bylines. A scene of one has nobody to be "both" with.
  await scrap('bus was late again');
  await scrap('saw a fox on 5th');
  const chips = await page.locator('#logfilters .chip').allInnerTexts();
  ok('a scene of one is not offered a "Both" byline', !chips.some(c => /both|together/i.test(c)), chips.join(','));
  await page.click('#authortoggle');
  await page.waitForTimeout(150);
  ok('and the author toggle offers them or nobody, never "Both"', (await text('#authorname')) === 'Anonymous',
     await text('#authorname'));
  await page.click('#authortoggle');
  await page.waitForTimeout(150);
  await go('#desk');
  await page.click('#drawsourcesbtn');
  await page.waitForTimeout(250);
  ok('ONE PERSON\'S SCRAPS ARE SIGNED BY THEM, NOT "BOTH"', /SCRAPS\s*— me/.test(await tray()),
     (await tray()).split('\n').filter(l => /SCRAPS|—/.test(l)).join(' | '));

  // ---- pulling twice draws nothing twice; a new scrap joins the column.
  const piecesOnce = (await store()).pieces.length;
  await page.click('#drawsourcesbtn');
  await page.waitForTimeout(250);
  ok('PULLING TWICE DOES NOT DOUBLE THE TRAY', (await store()).pieces.length === piecesOnce,
     piecesOnce + ' then ' + (await store()).pieces.length);
  await scrap('the laundromat is open late');
  await go('#desk');
  await page.click('#drawsourcesbtn');
  await page.waitForTimeout(250);
  const columns = (await store()).pieces.filter(p => p.title === 'SCRAPS');
  ok('a new scrap joins the SCRAPS column already waiting',
     columns.length === 1 && /laundromat/.test(columns[0].body), columns.length + ' column(s)');

  // ---- a scene of three: "Together", never "Both".
  await go('#backup');
  for (const n of ['Kel', 'Ro']) {
    await page.fill('#newperson', n);
    await page.click('#addpersonbtn');
    await page.waitForTimeout(150);
  }
  await go('#scraps');
  const chips3 = (await page.locator('#logfilters .chip').allTextContents()).map(c => c.toLowerCase());
  ok('a scene of three calls joint work "Together"', chips3.includes('together') && !chips3.includes('both'),
     chips3.join(','));
  while ((await text('#authorname')) !== 'Kel') { await page.click('#authortoggle'); await page.waitForTimeout(100); }
  await scrap('kel was here');
  await go('#desk');
  await page.click('#drawsourcesbtn');
  await page.waitForTimeout(250);
  ok('A COLUMN SEVERAL PEOPLE WROTE IS SIGNED "TOGETHER"', /SCRAPS\s*— Together/.test(await tray()));

  // ---- the paper this issue will have: a cutting with words on it.
  await go('#press');
  const p3 = page.locator('[data-page="3"]');
  await p3.scrollIntoViewIfNeeded();
  await p3.click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(200);
  await page.dblclick('[data-page="3"] .el.sel');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('WORDS ON A CUTTING');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // ---- a backup taken before the bell, merged back after it.
  await go('#backup');
  const [bdl] = await Promise.all([page.waitForEvent('download'), page.click('#exportbtn')]);
  const backup = path.join(dir, 'before-the-bell.json');
  await bdl.saveAs(backup);

  // ---- the bell. Eight live pieces, six inner pages: two do not run.
  for (const t of ['Four', 'Five', 'Six', 'Seven', 'Eight']) await piece(t);
  const live = (await store()).pieces.filter(p => !p.cut).length;
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(400);
  // One more cutting after the compile, so undo has a compiled sheet to reach for.
  await go('#press');
  await page.locator('[data-page="7"]').scrollIntoViewIfNeeded();
  await page.locator('[data-page="7"]').click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="rule"]');
  await page.waitForTimeout(200);
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(700);
  let s = await store();
  const shipped = s.issues[0].pieces.length;
  const waiting = s.pieces.filter(p => !p.cut).length;
  ok('PIECES THAT DID NOT FIT WAIT FOR THE NEXT ISSUE',
     live === 8 && shipped === 6 && waiting === 2, `live ${live}, shipped ${shipped}, waiting ${waiting}`);

  // ---- undo does not reach back past the bell.
  await go('#press');
  await A.undo();
  ok('undo after the bell cannot paste the shipped issue onto the new draft',
     !(await store()).press.panels.slice(1, -1).some(p => (p.body || '').trim()));

  // ---- a collage is not an empty sheet.
  await p3.scrollIntoViewIfNeeded();
  await p3.click({ position: { x: 6, y: 6 } });
  await page.click('#stampbtn');
  await page.waitForTimeout(150);
  await page.click('[data-stamp="copy"]');
  await page.waitForTimeout(250);
  ok('A PAGE OF CUTTINGS IS NOT CALLED EMPTY', !/This sheet is empty/.test(await text('#pressstatus')),
     await text('#pressstatus'));

  // ---- the printed sheet says which issue it is.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForTimeout(150);
  const no = await page.locator('#reprintzone .cover .no').innerText().catch(() => '');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  ok('THE PRINTED COVER CARRIES ITS ISSUE NUMBER', no === '№02', JSON.stringify(no));

  // ---- the reading view keeps the words on cuttings.
  await go('#shelf');
  await page.click('[data-readissue="01"]');
  await page.waitForTimeout(250);
  ok('the reading view keeps the words on cuttings', /WORDS ON A CUTTING/.test(await text('#shelfreader')));

  // ---- merging the old backup does not put published pieces back.
  await page.setInputFiles('#importfile', backup);
  await page.waitForTimeout(600);
  s = await store();
  ok('MERGING AN OLD BACKUP DOES NOT RESURRECT PUBLISHED PIECES',
     s.pieces.filter(p => !p.cut).length === 2, s.pieces.filter(p => !p.cut).map(p => p.title).join(','));

  // ---- recompiling after a cut empties the page the cut piece had.
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(300);
  await page.locator('[data-cutpiece]').first().click();
  await page.waitForTimeout(150);
  await page.click('#compileissuebtn');
  await page.waitForTimeout(300);
  s = await store();
  ok('a recompile clears the page a cut piece left behind',
     !s.press.panels[2].h && !s.press.panels[2].body, JSON.stringify(s.press.panels[2].h));

  // ---- a piece can be sent.
  const [pdl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-piecebundle]').first().click()]);
  ok('A PIECE IN THE TRAY CAN BE SENT AS A FILE', /^piece-[a-z0-9-]+\.html$/.test(pdl.suggestedFilename()),
     pdl.suggestedFilename());

  // ---- format changes keep the back cover last and set pages aside.
  await go('#press');
  await page.locator('[data-page="8"] .body').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('BACK WORDS');
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(200);
  await page.selectOption('#formatsel', 'saddle16');
  await page.waitForTimeout(500);
  ok('GROWING THE FORMAT KEEPS THE BACK COVER AT THE BACK',
     /BACK WORDS/.test(await text('[data-page="16"] .body')) && !/BACK WORDS/.test(await text('[data-page="8"] .body')));
  await page.locator('[data-page="12"] .body').click();
  await page.keyboard.type('PAGE TWELVE');
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(200);
  await page.selectOption('#formatsel', 'fold8');
  await page.waitForTimeout(500);
  ok('SHRINKING SAYS WHAT IT SET ASIDE, AND KEEPS THE BACK COVER',
     /set aside/.test(await text('#pressstatus')) && /BACK WORDS/.test(await text('[data-page="8"] .body')),
     await text('#pressstatus'));
  await page.selectOption('#formatsel', 'saddle16');
  await page.waitForTimeout(500);
  ok('AND GIVES THE PAGE BACK WHERE IT WAS', /PAGE TWELVE/.test(await text('[data-page="12"] .body')));
  await page.selectOption('#formatsel', 'fold8');
  await page.waitForTimeout(400);

  // ---- the fit meter counts paragraphs.
  await page.locator('[data-page="4"] .body').evaluate(el => { el.focus(); el.innerText = 'x\n'.repeat(80); });
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(300);
  ok('THE FIT METER COUNTS A PAGE OF SHORT LINES', /over/.test(await text('[data-page="4"] .fitwarn')),
     JSON.stringify(await text('[data-page="4"] .fitwarn')));

  // ---- undoing a cutting does not take back words typed since.
  const p5 = page.locator('[data-page="5"]');
  await p5.scrollIntoViewIfNeeded();
  await p5.click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="box"]');
  await page.waitForTimeout(200);
  await page.locator('[data-page="6"] .body').click();
  await page.keyboard.type('typed after the box');
  await A.undo();
  const boxes = await page.locator('[data-page="5"] .el-box').count();
  ok('UNDO TAKES BACK THE TYPING FIRST, NOT THE BOX AND THE TYPING TOGETHER',
     boxes === 1 && !/typed after/.test(await text('[data-page="6"] .body')), 'boxes ' + boxes);

  // ---- Backspace in a text box is a Backspace.
  await p5.click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(200);
  await page.click('[data-elvoice]'); await page.click('[data-elvoice]');   // marker
  await page.waitForTimeout(150);
  const before = await page.locator('[data-page="5"] .el').count();
  await page.click('#ransomtext');
  await page.keyboard.press('End');
  await page.keyboard.type('ab');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);
  ok('BACKSPACE IN THE MARKER\'S TEXT BOX DOES NOT DELETE THE CUTTING',
     (await page.locator('[data-page="5"] .el').count()) === before &&
     /NEW CUTTINGa$/.test(await page.inputValue('#ransomtext')), await page.inputValue('#ransomtext'));
  await scrap('');
  await page.fill('#loginput', 'hello');
  await page.press('#loginput', 'Backspace');
  ok('nor does one in the scraps box, behind the drawer',
     (await page.locator('[data-page="5"] .el').count()) === before && (await page.inputValue('#loginput')) === 'hell');

  // ---- a cut-out photograph comes in as a square, not a blob.
  await page.setInputFiles('#photofile', cutoutFile());
  await page.waitForTimeout(1800);
  const dark = await page.evaluate(async () => {
    const img = document.querySelector('#loglist .log-photo');
    if (!img) return -1;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++;
    return n / (d.length / 4);
  });
  ok('A TRANSPARENT CUT-OUT COMES IN WHITE AROUND ITS INK', dark > 0.02 && dark < 0.1,
     'dark share ' + dark.toFixed(3));

  // ---- a file dropped off the page does not replace the press.
  const caught = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'x.png', { type: 'image/png' }));
    const over = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true });
    const drop = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true });
    document.querySelector('header').dispatchEvent(over);
    document.querySelector('header').dispatchEvent(drop);
    return over.defaultPrevented && drop.defaultPrevented;
  });
  ok('a file dropped off the page is caught, not opened in place of the press', caught);

  // ---- Enter in the zine-name field saves it.
  await go('#backup');
  await page.fill('#zinename', 'NIGHT BUS');
  await page.press('#zinename', 'Enter');
  await page.waitForTimeout(200);
  ok('ENTER IN THE ZINE NAME SAVES IT', (await store()).zine === 'NIGHT BUS', (await store()).zine);

  // ---- a replace with a broken roster keeps somebody at the desk.
  const broken = path.join(dir, 'broken.json');
  fs.writeFileSync(broken, JSON.stringify({ people: [{}], logs: [null, { id: 'z', text: 'kept', ts: 1 }] }));
  await page.evaluate(() => { document.getElementById('importfile').dataset.mode = 'replace'; });
  await page.setInputFiles('#importfile', broken);
  await page.waitForTimeout(500);
  ok('a replace with a broken roster and a null record leaves a working press',
     (await A.roster()).length >= 1 && (await store()).logs.length === 1);
  ok('no script errors through all of it', A.errs.length === 0, A.errs.slice(0, 3).join(' | '));
  await A.ctx.close();

  // ---- a friend's zine, opened on a machine that runs its own.
  const F = await open(browser, dir);
  await F.page.click('#barzine');
  await F.page.keyboard.press('Control+A');
  await F.page.keyboard.type('FRIEND ZINE');
  await F.page.keyboard.press('Enter');
  await F.go('#desk');
  await F.page.click('#compileissuebtn');
  await F.page.waitForTimeout(300);
  await F.page.click('#buildissuebtn');
  await F.page.waitForTimeout(500);
  const [fdl] = await Promise.all([F.page.waitForEvent('download'), F.page.click('#handonbtn')]);
  const file = path.join(dir, 'friend-01.html');
  await fdl.saveAs(file);
  await F.ctx.close();

  const M = await open(browser, dir);
  await M.go('#backup');
  await M.page.fill('#newperson', 'Dee');
  await M.page.click('#addpersonbtn');
  await M.page.waitForTimeout(150);
  await M.page.goto('file://' + file);
  await M.page.waitForTimeout(900);
  ok('A FRIEND\'S ZINE OPENS TO THEIR ISSUE, NOT A BLANK PAGE',
     /FRIEND ZINE/.test(await M.text('#landing')), (await M.text('#landing')).slice(0, 60));
  const mine = await M.roster();
  ok('and their scene is not seated at this desk', mine.length === 2 && mine.some(p => p.name === 'Dee'),
     mine.map(p => p.name).join(','));
  await M.page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await M.page.waitForTimeout(150);
  const held = await M.page.locator('#reprintzone .cover h3').innerText().catch(() => '');
  await M.page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  ok('PRINTING FROM THE LANDING PRINTS THE ISSUE IN HAND', held === 'FRIEND ZINE', JSON.stringify(held));
  ok('no script errors on the second machine', M.errs.length === 0, M.errs.slice(0, 3).join(' | '));
  await M.ctx.close();
};
