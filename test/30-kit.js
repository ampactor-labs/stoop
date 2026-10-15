// The scene's kit. BAT and MOON join the starter stamps and print as filled
// paths. A pen drawing kept as a stamp lands again on other pages as copies
// of itself; it survives a reload and a backup; and the press somebody is
// handed offers it too, because the kit rides in the file.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function kit(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  const pageAt = (n) => page.locator('#sheetzone [data-page="' + n + '"]');
  const touch = async (n) => {
    await pageAt(n).scrollIntoViewIfNeeded();
    await pageAt(n).click({ position: { x: 6, y: 6 } });
    await page.waitForTimeout(150);
  };
  await page.goto(APP);
  await page.waitForTimeout(700);
  await go('#press');

  // ---- the starters.
  await touch(2);
  await page.click('#stampbtn');
  ok('BAT AND MOON JOIN THE STARTER STAMPS', (await page.locator('#stamps [data-stamp="bat"]').count()) === 1 &&
     (await page.locator('#stamps [data-stamp="moon"]').count()) === 1);
  await page.click('#stamps [data-stamp="bat"]');
  await page.waitForTimeout(250);
  ok('a bat lands on the page', ((await store()).press.panels[1].els || []).some(e => e.kind === 'stamp' && e.stamp === 'bat'));

  // ---- her bat, drawn once.
  await page.keyboard.press('Escape');
  await pageAt(2).evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  const box = await pageAt(2).boundingBox();
  await page.click('#penbtn');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.6, { steps: 6 });
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.locator('#sheetzone [data-page="2"] .el-draw').click();
  await page.waitForTimeout(200);
  await page.click('[data-elkeep]');
  await page.waitForTimeout(250);
  let kept = (await store()).kit;
  const drawn = ((await store()).press.panels[1].els || []).filter(e => e.kind === 'draw')[0];
  ok('KEEP AS A STAMP PUTS THE DRAWING IN THE SCENE\'S KIT, AND NOTHING ABOUT WHERE IT WAS',
     kept.length === 1 && kept[0].el.kind === 'draw' && kept[0].name === 'drawing' && !('id' in kept[0].el) && !('x' in kept[0].el) &&
     JSON.stringify(kept[0].el.strokes) === JSON.stringify(drawn.strokes), JSON.stringify(kept.map(k => [k.name, Object.keys(k.el)])));

  for (const n of [3, 4]) {
    await touch(n);
    await page.click('#stampbtn');
    await page.click('#stamps [data-kit]');
    await page.waitForTimeout(250);
  }
  const panels = (await store()).press.panels;
  const copies = [panels[2], panels[3]].map(p => (p.els || []).filter(e => e.kind === 'draw')[0]);
  ok('THE STAMP LANDS ON OTHER PAGES AS COPIES OF ITSELF', copies.every(c => c && JSON.stringify(c.strokes) === JSON.stringify(drawn.strokes)) &&
     copies[0].id !== copies[1].id && copies[0].id !== drawn.id);

  await page.reload();
  await page.waitForTimeout(900);
  await go('#press');
  await touch(5);
  await page.click('#stampbtn');
  ok('it is still in the kit after a reload, named for what it is', (await page.locator('#stamps [data-kit]').count()) === 1 &&
     (await page.locator('#stamps [data-kit]').getAttribute('title')) === 'drawing');
  await page.click('#stampbtn');

  // ---- on paper, the bat is a filled path.
  await go('#paper');
  const [pdl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const pdf = fs.readFileSync(await pdl.path(), 'latin1');
  ok('THE BAT PRINTS AS ONE FILLED PATH', /[\d.]+ [\d.]+ m(?: [\d.]+ [\d.]+ l){40,} f\n/.test(pdf));

  // ---- a backup carries the kit.
  await go('#backup');
  const [bdl] = await Promise.all([page.waitForEvent('download'), page.click('#exportbtn')]);
  const backup = JSON.parse(fs.readFileSync(await bdl.path(), 'utf8'));
  ok('a backup carries the kit', backup.kit.length === 1 && backup.kit[0].el.kind === 'draw');

  // ---- the press somebody is handed offers the same kit.
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(400);
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  const [idl] = await Promise.all([page.waitForEvent('download'), page.click('#handonbtn').then(() => page.click('#handfile'))]);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-kit-')), 'issue.html');
  await idl.saveAs(file);
  ok('the file carries the kit', /"kit":\[\{"id":"kt_/.test(fs.readFileSync(file, 'utf8')));
  const other = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  const oerrs = [];
  other.on('pageerror', e => oerrs.push(e.message));
  other.on('dialog', d => d.accept('Ro'));
  await other.goto('file://' + file);
  await other.waitForTimeout(1000);
  await other.click('#landmake');
  await other.waitForTimeout(400);
  await other.evaluate(() => { location.hash = '#press'; });
  await other.waitForTimeout(400);
  await other.locator('#sheetzone [data-page="2"]').click({ position: { x: 6, y: 6 } });
  await other.click('#stampbtn');
  ok('AND THE PRESS SOMEBODY IS HANDED OFFERS IT', (await other.locator('#stamps [data-kit]').count()) === 1);
  await other.click('#stamps [data-kit]');
  await other.waitForTimeout(250);
  const theirs = await other.evaluate(() => (JSON.parse(localStorage.getItem('stoop_data_v4')).press.panels[1].els || []).filter(e => e.kind === 'draw')[0]);
  ok('and stamps the same drawing', !!theirs && JSON.stringify(theirs.strokes) === JSON.stringify(drawn.strokes));
  await other.context().close();

  // ---- forgetting it.
  await go('#press');
  await touch(6);
  await page.click('#stampbtn');
  await page.click('#stamps [data-unkit]');
  await page.waitForTimeout(250);
  ok('a stamp can be forgotten, and the drawings already glued stay', (await store()).kit.length === 0 &&
     (await page.locator('#stamps [data-kit]').count()) === 0 &&
     (await store()).issues[0].panels.filter(p => (p.els || []).some(e => e.kind === 'draw')).length === 3);
  ok('no script errors with a kit', errs.length === 0 && oerrs.length === 0, errs.concat(oerrs).slice(0, 3).join(' | '));
  await ctx.close();
};
