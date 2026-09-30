// The pen. A drag in pen mode leaves one cutting with its points inside its
// box; a second stroke without putting the pen down joins it; the drawing
// takes an ink on screen and on paper, where it is lines with round caps in
// that ink; moving the cutting moves the drawing; Escape puts the pen down
// and a drag moves things again; and the file handed on shows it.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function pen(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  const drawOn = () => store().then(s => (s.press.panels[1].els || []).filter(e => e.kind === 'draw'));
  const drag = async (x0, y0, x1, y1) => {
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2 + 20, { steps: 6 });
    await page.mouse.move(x1, y1, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
  };
  await page.goto(APP);
  await page.waitForTimeout(700);
  await go('#press');
  const p2 = page.locator('#sheetzone [data-page="2"]');
  await p2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = await p2.boundingBox();

  await page.click('#penbtn');
  ok('PEN IS A MODE: THE BUTTON LIGHTS AND THE PAGE SAYS SO', (await page.evaluate(() => document.body.hasAttribute('data-pen'))) &&
     (await page.locator('#penbtn.on').count()) === 1 && /Escape puts the pen down/.test(await page.locator('#addhint').innerText()));

  // ---- one stroke, one cutting, points inside its box.
  await drag(box.x + box.width * 0.2, box.y + box.height * 0.3, box.x + box.width * 0.6, box.y + box.height * 0.5);
  let draws = await drawOn();
  const inside = (el) => el.strokes.every(s => s.every(p => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1 && p[2] > 0));
  ok('A DRAG IN PEN MODE LEAVES ONE CUTTING WITH ITS POINTS INSIDE ITS BOX', draws.length === 1 && draws[0].strokes.length === 1 &&
     draws[0].strokes[0].length >= 3 && inside(draws[0]) && draws[0].x > 0.1 && draws[0].x < 0.25 && draws[0].w > 0.3 && draws[0].w < 0.5,
     JSON.stringify(draws.map(d => [d.x, d.y, d.w, d.h, d.strokes.map(s => s.length)])));
  ok('and it is drawn as a line with round caps, in the ink', (await page.locator('#sheetzone [data-page="2"] .el-draw svg polyline').count()) === 1 &&
     (await page.locator('#sheetzone [data-page="2"] .el-draw svg').getAttribute('stroke-linecap')) === 'round');

  // ---- a second stroke, starting on the first, joins it rather than dragging it.
  const first = draws[0];
  await drag(box.x + box.width * 0.4, box.y + box.height * 0.4, box.x + box.width * 0.7, box.y + box.height * 0.75);
  draws = await drawOn();
  ok('A SECOND STROKE JOINS THE SAME CUTTING, AND THE BOX GROWS TO HOLD IT', draws.length === 1 && draws[0].strokes.length === 2 && inside(draws[0]) &&
     draws[0].h > first.h && Math.abs(draws[0].x - first.x) < 0.02, JSON.stringify(draws.map(d => [d.x, d.y, d.w, d.h])));
  ok('undo takes back one stroke, not the drawing', await (async () => {
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    const d = await drawOn();
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(250);
    return d.length === 1 && d[0].strokes.length === 1 && (await drawOn())[0].strokes.length === 2;
  })());

  // ---- Escape puts the pen down; the drawing takes an ink and moves as one.
  await page.keyboard.press('Escape');
  ok('ESCAPE PUTS THE PEN DOWN', !(await page.evaluate(() => document.body.hasAttribute('data-pen'))) && (await page.locator('#penbtn.on').count()) === 0);
  const el = page.locator('#sheetzone [data-page="2"] .el-draw');
  await el.click();
  await page.waitForTimeout(200);
  ok('the sheet offers the pen\'s width and the inks', (await page.locator('#inspector [data-elthicker]').count()) === 1 &&
     (await page.locator('#inspector [data-elcolour]').count()) >= 8);
  await page.click('[data-elcolour][title="BLUE"]');
  await page.waitForTimeout(200);
  const stroke = await page.locator('#sheetzone [data-page="2"] .el-draw svg polyline').first().evaluate(p => getComputedStyle(p).stroke);
  ok('THE DRAWING TAKES AN INK', stroke === 'rgb(0, 120, 191)' && (await drawOn())[0].colour === '#0078bf', stroke);
  const beforeMove = (await drawOn())[0];
  const eb = await el.boundingBox();
  await drag(eb.x + eb.width / 2, eb.y + eb.height / 2, eb.x + eb.width / 2 + 60, eb.y + eb.height / 2 + 30);
  const afterMove = (await drawOn())[0];
  ok('MOVING THE CUTTING MOVES THE DRAWING, WITH THE PEN DOWN', afterMove.x > beforeMove.x + 0.05 && afterMove.strokes.length === 2 &&
     JSON.stringify(afterMove.strokes) === JSON.stringify(beforeMove.strokes), beforeMove.x + ' -> ' + afterMove.x);

  // ---- on paper: lines with round caps and joins, in the ink.
  await go('#paper');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const pdf = fs.readFileSync(await dl.path(), 'latin1');
  const m = /0\.000 0\.471 0\.749 rg 0\.000 0\.471 0\.749 RG\nq 1 J 1 j\n([\d.]+) w ([\d. ml]+) S\n([\d.]+) w ([\d. ml]+) S\nQ/.exec(pdf);
  ok('ON PAPER THE DRAWING IS TWO STROKES OF LINES WITH ROUND CAPS, IN THE INK', !!m && Math.abs(parseFloat(m[1]) - 1.875) < 0.01 &&
     (m[2].match(/ l/g) || []).length >= 2 && / m /.test(m[2]), m ? m[1] + ' w, ' + (m[2].match(/ l/g) || []).length + ' segments' : 'no stroke ops');

  // ---- the file handed on shows it.
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  const [idl] = await Promise.all([page.waitForEvent('download'), page.click('#handonbtn')]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-pen-'));
  const file = path.join(dir, 'issue.html');
  await idl.saveAs(file);
  const reader = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await reader.goto('file://' + file);
  await reader.waitForTimeout(900);
  ok('THE FILE HANDED ON SHOWS THE DRAWING, IN ITS INK', (await reader.locator('#landing .el-draw svg polyline').count()) === 2 &&
     (await reader.locator('#landing .el-draw svg polyline').first().evaluate(p => getComputedStyle(p).stroke)) === 'rgb(0, 120, 191)');
  await reader.context().close();
  ok('no script errors drawing', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
