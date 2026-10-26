// Colour, without being asked for. A cutting can be printed in any of the
// drums a print shop has, and the colour on screen is the colour in the PDF
// and in the file handed on. A photograph screened to two tones prints its
// dark half in the ink and leaves the light half paper. A colour a file
// names is checked before it reaches a style.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { photoFile } = require('./fixture.js');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

// Pixels of a screenshot, counted in the page that took it.
async function blueShare(page, png) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let blue = 0, black = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 2] > d[i] + 60) blue++;
      if (d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) black++;
    }
    return { blue: blue / (d.length / 4), black: black / (d.length / 4) };
  }, png.toString('base64'));
}

module.exports = async function colour(browser, ok) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-colour-'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  const style = (sel, prop) => page.evaluate(([s, p]) => {
    const n = document.querySelector(s);
    return n ? getComputedStyle(n)[p] : '';
  }, [sel, prop]);
  const ink = async (name) => { await page.click('.swatch[title="' + name + '"]'); await page.waitForTimeout(150); };
  await page.goto(APP);
  await page.waitForTimeout(700);

  // ---- cuttings in ink.
  await go('#press');
  const p2 = page.locator('[data-page="2"]');
  await p2.scrollIntoViewIfNeeded();
  await p2.click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(150);
  ok('A CUTTING OFFERS ITS INKS, AND ANY OTHER COLOUR', (await page.locator('#inspector button.swatch').count()) === 9 &&
     (await page.locator('#inspector .swatch.pick input[type="color"]').count()) === 1,
     (await page.locator('#inspector button.swatch').count()) + ' swatches');
  await page.selectOption('[data-elvoicesel]', 'head');
  await ink('PINK');
  ok('A HEADLINE IN PINK IS PINK', (await style('[data-page="2"] .el-text .eltext', 'color')) === 'rgb(255, 72, 176)',
     await style('[data-page="2"] .el-text .eltext', 'color'));

  await page.click('[data-addel="text"]');
  await page.waitForTimeout(150);
  await page.click('[data-elink]');
  await ink('BLUE');
  const knock = '[data-page="2"] .eltext.knock';
  ok('a knocked-out line sits in a blue block, its letters paper',
     (await style(knock, 'backgroundColor')) === 'rgb(0, 120, 191)' && (await style(knock, 'color')) === 'rgb(255, 255, 255)');

  await page.click('[data-addel="box"]');
  await page.waitForTimeout(150);
  await ink('ORANGE');
  ok('a box is drawn in its ink', (await style('[data-page="2"] .el-box', 'borderTopColor')) === 'rgb(255, 108, 47)');

  await page.click('#stampbtn');
  await page.click('[data-stamp="free"]');
  await page.waitForTimeout(150);
  await ink('PURPLE');
  ok('so is a stamp', (await style('[data-page="2"] .elstamp', 'color')) === 'rgb(118, 91, 167)');

  await ink('BLACK');
  const back = (await store()).press.panels[1].els.find(e => e.kind === 'stamp');
  ok('BLACK TAKES THE COLOUR OFF, RATHER THAN STORING BLACK', back && !('colour' in back), JSON.stringify(back && back.colour));
  await ink('PURPLE');

  // ---- a photograph screened to two tones, printed in blue.
  const p3 = page.locator('[data-page="3"]');
  await p3.scrollIntoViewIfNeeded();
  await p3.click({ position: { x: 6, y: 6 } });
  await page.setInputFiles('#pastephotofile', photoFile());
  await page.waitForTimeout(1500);
  ok('a colour photograph brings its own colours and offers no ink',
     (await page.locator('#inspector .swatch').count()) === 0);
  await page.selectOption('[data-ellook]', 'grain');
  await page.waitForTimeout(1200);
  ok('screened to grain, it does', (await page.locator('#inspector button.swatch').count()) === 8);
  await ink('BLUE');
  await page.waitForTimeout(300);
  const shot = page.locator('[data-page="3"] .el-photo');
  await page.evaluate(() => { const s = document.querySelector('.sel'); if (s) s.classList.remove('sel'); });
  const seen = await blueShare(page, await shot.screenshot());
  ok('A SCREENED PHOTOGRAPH IN BLUE IS BLUE AND PAPER, NOT BLACK', seen.blue > 0.3 && seen.black < 0.01,
     'blue ' + seen.blue.toFixed(2) + ', black ' + seen.black.toFixed(3));

  // ---- a page printed on a colour.
  await p3.click({ position: { x: 6, y: 300 } });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(150);
  ok('A PAGE WITH NOTHING CHOSEN OFFERS ITS COLOUR', /PAGE COLOUR/.test(await page.locator('#inspector').innerText()));
  await page.click('[data-pgfill="3"][title="YELLOW"]');
  await page.waitForTimeout(200);
  ok('AND IS PRINTED ON IT', (await style('#sheetzone [data-page="3"]', 'backgroundColor')) === 'rgb(251, 238, 138)',
     await style('#sheetzone [data-page="3"]', 'backgroundColor'));
  ok('a page colour prints in a browser too, not dropped as a background',
     (await style('#sheetzone [data-page="3"]', 'printColorAdjust')) === 'exact');

  // ---- the same inks on paper.
  await go('#paper');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const pdf = fs.readFileSync(await dl.path(), 'latin1');
  ok('THE PDF SETS THE HEADLINE IN PINK', /1\.000 0\.282 0\.690 rg[^Q]*?\/F7 [\d.]+ Tf[^\n]*Tj/.test(pdf));
  ok('and the knocked-out block in blue with white letters', /0\.000 0\.471 0\.749 rg [^Q]*? re f\n1 g 1 G\n/.test(pdf));
  ok('THE SCREENED PHOTOGRAPH RIDES AS A STENCIL, POURED IN BLUE OVER WHITE',
     /\/ImageMask true\/BitsPerComponent 1/.test(pdf) &&
     /cm 1 g 0 0 1 1 re f 0\.000 0\.471 0\.749 rg 0\.000 0\.471 0\.749 RG\n\/Im\d+ Do/.test(pdf));
  ok('the stamp in purple', /0\.463 0\.357 0\.655 rg 0\.463 0\.357 0\.655 RG/.test(pdf));
  ok('AND THE YELLOW PAGE A YELLOW GROUND, LAID FIRST INSIDE ITS EDGE',
     /re W n\n0\.984 0\.933 0\.541 rg [\d. ]+ re f 0 g\n/.test(pdf));

  // ---- a colour from a file is checked before it reaches a style.
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('stoop_data_v4'));
    const el = d.press.panels[1].els.find(e => e.kind === 'box');
    el.colour = 'red;background:url(x)';
    localStorage.setItem('stoop_data_v4', JSON.stringify(d));
  });
  await page.reload();
  await page.waitForTimeout(900);
  await go('#press');
  const styled = await page.locator('[data-page="2"] .el-box').getAttribute('style');
  ok('A COLOUR THAT IS NOT A COLOUR IS IGNORED, NOT OBEYED', !/background|--ink/.test(styled), styled);

  // ---- the inks ride in the file.
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(500);
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  const [hdl] = await Promise.all([page.waitForEvent('download'), page.click('#handonbtn').then(() => page.click('#handfile'))]);
  const file = path.join(dir, 'issue.html');
  await hdl.saveAs(file);
  const other = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await other.goto('file://' + file);
  await other.waitForTimeout(900);
  const landed = await other.evaluate(() => [...document.querySelectorAll('#landing .eltext')]
    .map(n => getComputedStyle(n).color));
  ok('A FRIEND OPENING THE FILE SEES THE PINK', landed.includes('rgb(255, 72, 176)'), landed.join(' '));
  ok('and the yellow page', (await other.evaluate(() => {
    const n = document.querySelector('#landing [data-readpage="3"]');
    return n ? getComputedStyle(n).backgroundColor : '';
  })) === 'rgb(251, 238, 138)');
  await other.context().close();

  // ---- a page printed at night: the letters turn white by themselves, and so
  // does anything new glued on it.
  await go('#press');
  const p5 = page.locator('#sheetzone [data-page="5"]');
  await p5.scrollIntoViewIfNeeded();
  await p5.click({ position: { x: 6, y: 300 } });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(150);
  await page.click('[data-pgfill="5"][title="NIGHT"]');
  await page.waitForTimeout(200);
  ok('A NIGHT PAGE READS IN WHITE BY ITSELF', (await style('#sheetzone [data-page="5"]', 'backgroundColor')) === 'rgb(29, 26, 22)' &&
     (await style('#sheetzone [data-page="5"] h3', 'color')) === 'rgb(255, 255, 255)' &&
     (await page.locator('[data-pgletters="5"][data-c="#ffffff"].on').count()) === 1, await style('#sheetzone [data-page="5"] h3', 'color'));
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(250);
  const night = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')).press.panels[4]);
  ok('and anything new glued on it is printed white', ((await night()).els || []).slice(-1)[0].colour === '#ffffff');
  await go('#paper');
  const [ndl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const npdf = fs.readFileSync(await ndl.path(), 'latin1');
  ok('ON PAPER: A NIGHT GROUND, AND THE PAGE\'S OWN LETTERS IN WHITE',
     /0\.114 0\.102 0\.086 rg [\d. ]+ re f 0 g\n(?:q -1 0 0 -1 [^\n]+\n)?1 g 1 G\n/.test(npdf));
  await go('#press');
  await p5.click({ position: { x: 6, y: 300 } });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(150);
  await page.click('[data-pgletters="5"][title="BLACK"]');
  await page.waitForTimeout(200);
  ok('BLACK LETTERS ON A NIGHT PAGE IF SOMEBODY ASKS', (await night()).letters === 'black' &&
     (await style('#sheetzone [data-page="5"] h3', 'color')) !== 'rgb(255, 255, 255)');
  await page.click('[data-pgletters="5"][title="WHITE"]');
  await page.waitForTimeout(200);
  ok('and asking for white leaves the night to choose', !('letters' in (await night())) &&
     (await style('#sheetzone [data-page="5"] h3', 'color')) === 'rgb(255, 255, 255)');

  // ---- a zine's own colours: letters in a colour picked once, and the
  // colour offered in every row after.
  await page.locator('[data-pick="pgletters"][data-for="5"]').fill('#e2d6c8');
  await page.waitForTimeout(250);
  ok('THE PAGE\'S LETTERS CAN BE ANY COLOUR', (await night()).letters === '#e2d6c8' &&
     (await style('#sheetzone [data-page="5"] h3', 'color')) === 'rgb(226, 214, 200)' &&
     (await style('#sheetzone [data-page="5"] .body', 'color')) === 'rgb(226, 214, 200)');
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(250);
  ok('and anything new glued on it takes that colour', ((await night()).els || []).slice(-1)[0].colour === '#e2d6c8');
  ok('A COLOUR PICKED ONCE IS OFFERED IN EVERY ROW', (await page.locator('#inspector button.swatch[data-elcolour][data-c="#e2d6c8"]').count()) === 1);
  await page.locator('#inspector [data-pick="elcolour"]').fill('#773fa8');
  await page.waitForTimeout(250);
  ok('and a cutting can be any colour too', ((await night()).els || []).slice(-1)[0].colour === '#773fa8' &&
     (await page.locator('#inspector button.swatch.on[data-c="#773fa8"]').count()) === 1);
  await page.keyboard.press('Escape');
  await p5.click({ position: { x: 6, y: 300 } });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(150);
  await page.locator('[data-pick="pgfill"][data-for="5"]').fill('#0a0a0a');
  await page.waitForTimeout(250);
  ok('A PAGE CAN BE PRINTED ON ANY COLOUR, ITS LETTERS KEEPING THEIRS', (await night()).fill === '#0a0a0a' &&
     (await style('#sheetzone [data-page="5"]', 'backgroundColor')) === 'rgb(10, 10, 10)' &&
     (await style('#sheetzone [data-page="5"] h3', 'color')) === 'rgb(226, 214, 200)' &&
     /page 5\s*#0a0a0a \u00b7 #e2d6c8 letters/i.test(await page.locator('#inspector').innerText()));
  await go('#paper');
  const [cdl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const cpdf = fs.readFileSync(await cdl.path(), 'latin1');
  ok('ON PAPER: THE GROUND AND THE LETTERS IN THEIR COLOURS',
     /0\.039 0\.039 0\.039 rg [\d. ]+ re f 0 g\n(?:q -1 0 0 -1 [^\n]+\n)?0\.886 0\.839 0\.784 rg 0\.886 0\.839 0\.784 RG\n/.test(cpdf));

  ok('no script errors around colour', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
