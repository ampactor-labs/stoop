// A scene's own faces. Liberation Sans from the test machine is taken in
// and becomes a voice; a cutting set in it measures the same on screen and
// in the PDF's width table; the PDF embeds it as a TrueType subset; the
// file handed on carries its @font-face and a stranger's browser sets the
// cutting in it; a backup carries it; a face with PostScript outlines and a
// file cut short are each refused with a sentence.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const TTF = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';

module.exports = async function faces(browser, ok) {
  if (!fs.existsSync(TTF)) { ok('Liberation Sans is on this machine to test with', false, TTF + ' missing'); return; }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const toastText = () => page.evaluate(() => document.getElementById('toast').innerText);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-faces-'));
  await page.goto(APP);
  await page.waitForTimeout(700);

  // ---- refusals first: a PostScript face, and a file cut short.
  await go('#backup');
  const otto = path.join(dir, 'cff.otf');
  fs.writeFileSync(otto, Buffer.concat([Buffer.from('OTTO'), Buffer.alloc(400)]));
  await page.setInputFiles('#fontfile', otto);
  await page.waitForTimeout(500);
  ok('A FACE WITH POSTSCRIPT OUTLINES IS REFUSED, WITH A SENTENCE SAYING WHY', /PostScript outlines/.test(await toastText()) &&
     (await page.locator('#facelist [data-delface]').count()) === 0, await toastText());
  const cut = path.join(dir, 'cut.ttf');
  fs.writeFileSync(cut, fs.readFileSync(TTF).subarray(0, 300));
  await page.setInputFiles('#fontfile', cut);
  await page.waitForTimeout(500);
  ok('A FILE CUT SHORT FAILS CLOSED', /Could not read that face/.test(await toastText()) &&
     (await page.locator('#facelist [data-delface]').count()) === 0 && errs.length === 0, await toastText());

  // ---- the real thing.
  await page.setInputFiles('#fontfile', TTF);
  await page.waitForTimeout(900);
  ok('LIBERATION SANS IS TAKEN IN AND NAMED FROM ITS OWN NAME TABLE', /Liberation Sans is a voice now/.test(await toastText()) &&
     (await page.locator('#facelist').innerText()).indexOf('Liberation Sans') >= 0 &&
     (await page.evaluate(() => document.fonts.check('12px "Liberation Sans"'))), await toastText());
  const ownStyle = await page.evaluate(() => (document.getElementById('ownfaces') || {}).textContent || '');
  ok('and is on the page as an @font-face rule', /@font-face\{font-family:Liberation Sans;[^}]*url\(data:font\/ttf;base64,/.test(ownStyle));

  await go('#press');
  const p2 = page.locator('#sheetzone [data-page="2"]');
  await p2.scrollIntoViewIfNeeded();
  await p2.click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(200);
  const options = await page.locator('[data-elvoicesel] option').allInnerTexts();
  ok('THE FACE IS A VOICE', options.join(' ') === 'TYPEWRITER HEADLINE MARKER STENCIL RANSOM SANS SERIF LIBERATION SANS', options.join(' '));
  const value = await page.locator('[data-elvoicesel] option').last().getAttribute('value');
  await page.selectOption('[data-elvoicesel]', value);
  await page.waitForTimeout(250);
  const set = await page.evaluate(() => {
    const t = document.querySelector('#sheetzone [data-page="2"] .eltext');
    return { family: getComputedStyle(t).fontFamily, size: parseFloat(getComputedStyle(t).fontSize), text: t.innerText };
  });
  ok('a cutting set in it is drawn in it', /Liberation Sans/.test(set.family) && set.text === 'NEW CUTTING', set.family);
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')).press.panels[1].els[0]);
  ok('and the file will say which face, by id and by name', /^face:/.test(model.voice) && model.family === 'Liberation Sans', JSON.stringify([model.voice, model.family]));

  // ---- the same on paper: the width table is the face's own advances.
  await go('#paper');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const pdf = fs.readFileSync(await dl.path(), 'latin1');
  const font = /<<\/Type\/Font\/Subtype\/TrueType\/BaseFont\/STOOPF\+LiberationSans\/FirstChar 32\/LastChar 255\/Widths\[([\d ]+)\]/.exec(pdf);
  ok('THE PDF EMBEDS IT AS TRUETYPE', !!font && /\/FontName\/STOOPF\+LiberationSans\/Flags 32/.test(pdf) && /\/FontFile2 \d+ 0 R/.test(pdf) &&
     /BT \/F11 [\d.]+ Tf [^\n]*\(NEW CUTTING\) Tj/.test(pdf));
  const widths = font ? font[1].split(' ').map(Number) : [];
  const fromTable = 'NEW CUTTING'.split('').reduce((a, ch) => a + widths[ch.charCodeAt(0) - 32] / 1000 * set.size, 0);
  const onScreen = await page.evaluate((size) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = size + 'px "Liberation Sans"';
    return c.measureText('NEW CUTTING').width;
  }, set.size);
  ok('AND THE SCREEN\'S RULER AGREES WITH ITS WIDTH TABLE', widths.length === 224 && Math.abs(fromTable - onScreen) < onScreen * 0.01,
     fromTable.toFixed(2) + ' from the table, ' + onScreen.toFixed(2) + ' on screen');

  // ---- a backup carries it, and so does the file handed on.
  const [bdl] = await Promise.all([page.waitForEvent('download'), (async () => { await go('#backup'); await page.click('#exportbtn'); })()]);
  const backup = JSON.parse(fs.readFileSync(await bdl.path(), 'utf8'));
  ok('a backup carries the face', backup.faces.length === 1 && backup.faces[0].name === 'Liberation Sans' && backup.faces[0].data.length > 100000);
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  const [idl] = await Promise.all([page.waitForEvent('download'), page.click('#handonbtn')]);
  const file = path.join(dir, 'issue.html');
  await idl.saveAs(file);
  const html = fs.readFileSync(file, 'utf8');
  ok('THE FILE HANDED ON CARRIES THE FACE', /<style id="ownfaces">@font-face\{font-family:Liberation Sans;/.test(html) && html.length > 400000);
  const reader = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const rerrs = [];
  reader.on('pageerror', e => rerrs.push(e.message));
  reader.on('dialog', d => d.accept('Kim'));
  await reader.goto('file://' + file);
  await reader.waitForTimeout(1200);
  const stranger = await reader.evaluate(() => ({
    has: document.fonts.check('12px "Liberation Sans"'),
    family: getComputedStyle(document.querySelector('#landing .eltext')).fontFamily }));
  ok('AND A STRANGER\'S BROWSER SETS THE CUTTING IN IT', stranger.has && /Liberation Sans/.test(stranger.family), JSON.stringify(stranger));
  await reader.click('#landmake');
  await reader.waitForTimeout(400);
  await reader.evaluate(() => { location.hash = '#press'; });
  await reader.waitForTimeout(400);
  await reader.locator('#sheetzone [data-page="2"]').click({ position: { x: 6, y: 6 } });
  await reader.click('[data-addel="text"]');
  await reader.waitForTimeout(200);
  ok('and the press they were handed offers the face as a voice', (await reader.locator('[data-elvoicesel] option').allInnerTexts()).indexOf('LIBERATION SANS') >= 0 &&
     rerrs.length === 0, rerrs.slice(0, 2).join(' | '));
  await reader.context().close();

  // ---- removing it.
  await go('#backup');
  await page.click('#facelist [data-delface]');
  await page.waitForTimeout(300);
  ok('a face can be taken out again', (await page.locator('#facelist [data-delface]').count()) === 0 &&
     !/Liberation/.test(await page.evaluate(() => document.getElementById('ownfaces').textContent)));
  ok('no script errors with a face of its own', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
