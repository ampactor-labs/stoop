// Making things. A photo comes in colour; a dark one can be lightened after
// the fact, turned black and white, or screened as grain, dots or hard
// contrast, from an original kept on this device. A cutting can be duplicated and moved
// to another page, a long piece runs on to the next page instead of being
// cut off, and the pages show where a home printer stops reaching.
const path = require('path');
const fs = require('fs');
const { photoFile } = require('./fixture.js');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function craft(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  await page.goto(APP);
  await page.waitForTimeout(700);

  // ---- photographs: lighter, darker, black and white, and three screens.
  const p2 = page.locator('[data-page="2"]');
  await p2.scrollIntoViewIfNeeded();
  await p2.click({ position: { x: 6, y: 6 } });
  await page.setInputFiles('#pastephotofile', photoFile());
  await page.waitForTimeout(1500);
  const dark = () => page.evaluate(async () => {
    const img = document.querySelector('[data-page="2"] .elphoto');
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, mid = 0, colour = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 128) n++;
      if (d[i] > 0 && d[i] < 255) mid++;
      if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 24) colour++;
    }
    return { share: n / (d.length / 4), mid, colour, src: img.src.slice(0, 64) };
  });
  const photoId = async () => (await store()).press.panels[1].els.find(e => e.kind === 'photo').photo;
  const first = await photoId();
  const before = await dark();
  ok('a photograph can be lightened, darkened or given another look, and starts in colour',
     /LIGHTER/.test(await page.locator('#inspector').innerText()) && /COLOUR/.test(await page.locator('#inspector').innerText()) &&
     before.colour > 1000, 'colour pixels ' + before.colour);
  await page.click('[data-elphlight]');
  await page.waitForTimeout(1200);
  const lighter = await dark();
  const second = await photoId();
  ok('LIGHTER MAKES LESS INK, AND A NEW PHOTOGRAPH', lighter.share < before.share - 0.03 && second !== first,
     before.share.toFixed(3) + ' then ' + lighter.share.toFixed(3));
  await page.click('[data-elphdark]');
  await page.waitForTimeout(1200);
  ok('darker again gives back the photograph already made', (await photoId()) === first);
  await page.click('[data-elphscreen]');
  await page.waitForTimeout(1200);
  const grey = await dark();
  ok('B&W IS THE PHOTOGRAPH IN GREYS, ITS TONES KEPT',
     /B&W/.test(await page.locator('[data-elphscreen]').innerText()) && grey.colour === 0 && grey.mid > 1000,
     'colour ' + grey.colour + ', grey ' + grey.mid);
  await page.click('[data-elphscreen]');
  await page.waitForTimeout(1200);
  ok('grain is the copier\'s dither', /GRAIN/.test(await page.locator('[data-elphscreen]').innerText()) &&
     (await dark()).mid === 0);
  await page.click('[data-elphscreen]');
  await page.waitForTimeout(1200);
  const dots = await dark();
  const depth = (url) => Buffer.from(url.split(',')[1], 'base64')[24];
  ok('DOTS IS A HALFTONE, AND STILL ONLY TWO TONES, STORED AT ONE BIT A PIXEL',
     /DOTS/.test(await page.locator('[data-elphscreen]').innerText()) && dots.mid === 0 &&
     /^data:image\/png/.test(dots.src) && depth(dots.src) === 1, 'grey pixels ' + dots.mid + ', ' + dots.src.slice(0, 22));
  await page.click('[data-elphscreen]');
  await page.waitForTimeout(1200);
  ok('hard is the copier with the contrast up', /HARD/.test(await page.locator('[data-elphscreen]').innerText()));
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  ok('and undo steps back through them', /DOTS/.test(await page.locator('[data-elphscreen]').innerText()));

  // A photograph can say what is in it.
  await page.locator('[data-page="2"] .el-photo').click();
  await page.fill('#alttext', 'a bus shelter at night, one light out');
  await page.waitForTimeout(200);
  ok('A PHOTOGRAPH CAN SAY WHAT IS IN IT, FOR ANYONE WHO CANNOT SEE IT',
     (await page.locator('[data-page="2"] .elphoto').getAttribute('alt')) === 'a bus shelter at night, one light out');

  // The cover's own photograph has the same controls.
  await go('#scraps');
  await page.setInputFiles('#photofile', photoFile());
  await page.waitForTimeout(1500);
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(400);
  await go('#press');
  const cover = page.locator('[data-page="1"]');
  await cover.scrollIntoViewIfNeeded();
  await cover.click({ position: { x: 6, y: 300 } });
  await page.waitForTimeout(200);
  const coverBefore = (await store()).press.panels[0].photo;
  await page.click('[data-pgphlight]');
  await page.waitForTimeout(1200);
  ok('THE COVER PHOTOGRAPH CAN BE LIGHTENED TOO', (await store()).press.panels[0].photo !== coverBefore);

  // The originals stay on the device.
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#handonbtn')]);
  const html = fs.readFileSync(await dl.path(), 'utf8');
  const seed = JSON.parse(/<script type="application\/json" id="stoop-seed">([\s\S]*?)<\/script>/.exec(html)[1].replace(/<\\\//g, '</'));
  const refs = new Set();
  const iss = seed.issues[seed.issues.length - 1];
  (iss.panels || []).forEach(p => { if (p.photo) refs.add(p.photo); (p.els || []).forEach(e => e.photo && refs.add(e.photo)); });
  (iss.pieces || []).forEach(p => p.photo && refs.add(p.photo));
  const carried = Object.keys(seed.photos);
  ok('THE FILE CARRIES THE LOOKS ON ITS PAGES, NOT EVERY ONE TRIED ON THE WAY',
     !carried.includes(second) && carried.every(id => refs.has(id)) &&
     carried.some(id => /^data:image\/png/.test(seed.photos[id])) && carried.some(id => /^data:image\/jpeg/.test(seed.photos[id])),
     carried.length + ' photos: ' + carried.map(id => seed.photos[id].slice(11, 15)).join(' '));
  await go('#shelf');
  await page.click('[data-readissue="01"]');
  await page.waitForTimeout(250);
  await page.click('#shelfreader [data-readmode="text"]');
  await page.waitForTimeout(250);
  ok('and the text view prints it under the photograph',
     /a bus shelter at night/.test(await page.locator('#shelfreader figcaption').innerText().catch(() => '')));
  const file = path.join(require('os').tmpdir(), 'stoop-craft-issue.html');
  fs.writeFileSync(file, html);
  const other = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  other.on('dialog', d => d.accept());
  await other.goto('file://' + file);
  await other.waitForTimeout(900);
  await other.click('#landmake');
  await other.waitForTimeout(300);
  await other.evaluate(() => { location.hash = '#press'; });
  await other.waitForTimeout(300);
  await other.locator('[data-page="3"]').scrollIntoViewIfNeeded();
  await other.locator('[data-page="3"]').click({ position: { x: 6, y: 6 } });
  await other.locator('[data-traypic]').first().click();
  await other.waitForTimeout(300);
  ok('a photograph that came in a file offers no exposure, having no original here',
     /REMOVE/.test(await other.locator('#inspector').innerText()) && !/LIGHTER/.test(await other.locator('#inspector').innerText()));
  await other.context().close();

  // ---- a long piece runs on, and nothing is lost on the way.
  await go('#desk');
  const words = Array.from({ length: 300 }, (_, i) => 'w' + i).join(' ');
  await page.fill('#piecetitle', 'The Long One');
  await page.fill('#piecebody', words);
  await page.click('#piecesubmitbtn');
  await page.waitForTimeout(200);
  await page.click('#compileissuebtn');
  await page.waitForTimeout(600);
  let ps = (await store()).press;
  const runs = ps.panels.filter(p => /^THE LONG ONE/.test(p.h || ''));
  const joined = runs.map(p => p.body.replace(/\n\n\(continued on p\. \d+\)$/, '')).join(' ').split(/\s+/);
  ok('A LONG PIECE RUNS ON TO THE NEXT PAGE', runs.length >= 2 && /continued on p\. \d+\)$/.test(runs[0].body) &&
     /, CONTINUED$/.test(runs[1].h), runs.map(p => p.h).join(' / '));
  ok('and every word of it arrives, in order', joined.join(' ') === words, joined.length + ' words');
  await go('#press');
  const warns = (await page.locator('#sheetzone .fitwarn').allInnerTexts()).filter(Boolean);
  ok('nothing on a run-on page is over', warns.length === 0, warns.join(','));

  // ---- where the printer stops reaching.
  const edges = () => page.evaluate(() => [1, 2, 8].map(n => {
    const r = document.querySelector('#sheetzone [data-page="' + n + '"] .reach');
    return ['top', 'right', 'bottom', 'left'].filter(k => r.style[k] === '18pt').join('+');
  }).join(' '));
  const a = await edges();
  ok('THE PAGES SHOW WHERE A HOME PRINTER STOPS REACHING', a === 'right+bottom bottom+left bottom', a);
  await go('#paper');
  await page.click('#swaplayoutbtn');
  await page.waitForTimeout(300);
  await go('#press');
  const b = await edges();
  ok('and move with the fold', b !== a && /\+/.test(b), b);
  await go('#paper');
  await page.click('#swaplayoutbtn');
  await page.waitForTimeout(300);

  // ---- duplicate, move to a page, and a drag across the gutter.
  await go('#press');
  const p5 = page.locator('[data-page="5"]');
  await p5.scrollIntoViewIfNeeded();
  await p5.click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="box"]');
  await page.waitForTimeout(200);
  await page.keyboard.press('Control+d');
  await page.waitForTimeout(200);
  ok('CTRL-D DUPLICATES A CUTTING', (await page.locator('[data-page="5"] .el-box:not(.ghost)').count()) === 2);
  await page.click('[data-eldup]');
  await page.waitForTimeout(200);
  await page.click('[data-elnextpage]');
  await page.waitForTimeout(200);
  ok('and one can be sent to the next page', (await page.locator('[data-page="5"] .el-box:not(.ghost)').count()) === 2 &&
     (await page.locator('[data-page="6"] .el-box:not(.ghost)').count()) === 1);
  const box = page.locator('[data-page="6"] .el-box:not(.ghost)');
  await box.scrollIntoViewIfNeeded();
  const before6 = (await box.boundingBox()).y;
  await box.click();
  await page.waitForTimeout(250);
  const after6 = (await box.boundingBox()).y;
  ok('CLICKING A CUTTING ON A LOWER PAGE LEAVES THE VIEW WHERE IT WAS', Math.abs(after6 - before6) < 2,
     Math.round(before6) + 'px then ' + Math.round(after6) + 'px');
  const bb = await box.boundingBox();
  const pb = await page.locator('[data-page="6"]').boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(pb.x + pb.width * 1.05, bb.y + bb.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  ps = (await store()).press;
  const moved = ps.panels[5].els.find(e => e.kind === 'box');
  ok('A CUTTING DRAGS ACROSS THE GUTTER ONTO THE FACING PAGE', moved.x + moved.w > 1.1 &&
     (await page.locator('[data-page="7"] .el-box.ghost').count()) === 1, 'x ' + moved.x.toFixed(2));

  ok('no script errors while making things', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
