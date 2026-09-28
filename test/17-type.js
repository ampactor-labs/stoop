// Type, the way a magazine sets it. A cutting can speak in plain sans and
// serif as well as the zine's own voices, line up left, centred or right,
// be set in capitals or as typed, and be drawn as outlines, in white over a
// photograph if need be. Each of those has to reach the PDF as it looks on
// screen, and none of them may carry anything a file says into a class name.
const path = require('path');
const fs = require('fs');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

// Helvetica and Times-Roman from their standard metrics, codes 32 to 126,
// an independent copy of what the PDF writer uses.
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const TIMES = [250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541];
const width = (table, text) => [...text].reduce((a, ch) => a + table[ch.charCodeAt(0) - 32], 0) / 10;

module.exports = async function type(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const style = (sel, prop) => page.evaluate(([s, p]) => {
    const n = document.querySelector(s);
    return n ? getComputedStyle(n)[p] : '';
  }, [sel, prop]);
  const pdf = async () => {
    await go('#paper');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
    const s = fs.readFileSync(await dl.path(), 'latin1');
    await go('#press');
    return s;
  };
  await page.goto(APP);
  await page.waitForTimeout(700);

  // ---- the plain faces, measured the same on screen and on paper.
  const drift = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    const m = (font, t) => { c.font = '100px ' + font; return c.measureText(t).width; };
    return {
      sans: m("Arial, Helvetica, 'Liberation Sans', sans-serif", 'The last bus, 4am? Maybe.'),
      serif: m("'Times New Roman', Times, 'Liberation Serif', serif", 'The last bus, 4am? Maybe.')
    };
  });
  const dSans = Math.abs(drift.sans - width(HELV, 'The last bus, 4am? Maybe.')) / drift.sans;
  const dSerif = Math.abs(drift.serif - width(TIMES, 'The last bus, 4am? Maybe.')) / drift.serif;
  ok('THE SCREEN AND THE PDF MEASURE SANS AND SERIF THE SAME', dSans < 0.01 && dSerif < 0.01,
     (dSans * 100).toFixed(2) + '%, ' + (dSerif * 100).toFixed(2) + '%');

  await go('#press');
  const p2 = page.locator('[data-page="2"]');
  await p2.scrollIntoViewIfNeeded();
  await p2.click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(200);
  ok('THE VOICES ARE A LIST, SANS AND SERIF AMONG THEM',
     (await page.locator('[data-elvoicesel] option').allInnerTexts()).join(' ') ===
       'TYPEWRITER HEADLINE MARKER STENCIL RANSOM SANS SERIF');
  await page.selectOption('[data-elvoicesel]', 'sans');
  await page.waitForTimeout(250);
  ok('a sans cutting is set in the sans', /Arial|Liberation Sans/.test(await style('[data-page="2"] .eltext', 'fontFamily')));

  // ---- lining up: the same cutting, three ways.
  const xs = {};
  for (const a of ['left', 'center', 'right']) {
    const s = await pdf();
    const m = /BT \/F9 [\d.]+ Tf 1 0 0 1 ([\d.]+) [\d.]+ Tm \(NEW CUTTING\) Tj/.exec(s);
    xs[a] = m ? Number(m[1]) : NaN;
    if (a === 'left') ok('SANS REACHES THE PDF AS HELVETICA', /\/BaseFont\/Helvetica\/Encoding/.test(s) && !!m);
    if (a !== 'right') {
      await page.locator('[data-page="2"] .el-text').click();
      await page.click('[data-elalign]');
      await page.waitForTimeout(200);
    }
  }
  ok('CENTRED AND RIGHT MOVE THE LINE ACROSS ITS CUTTING, ON PAPER',
     xs.left < xs.center && xs.center < xs.right && Math.abs(xs.center - (xs.left + xs.right) / 2) < 0.6,
     JSON.stringify(xs));
  ok('and on screen', (await style('[data-page="2"] .eltext', 'textAlign')) === 'right');

  // ---- outlines.
  await page.click('[data-eloutline]');
  await page.waitForTimeout(200);
  ok('OUTLINED LETTERS ARE A STROKE WITH NOTHING INSIDE',
     parseFloat(await style('[data-page="2"] .eltext', 'webkitTextStrokeWidth')) > 0 &&
     (await style('[data-page="2"] .eltext', 'color')) === 'rgba(0, 0, 0, 0)');
  let s = await pdf();
  ok('and are stroked on paper, not filled', /[\d.]+ w\n[^Q]*BT 1 Tr \/F9 [\d.]+ Tf[^\n]*\(NEW CUTTING\) Tj/.test(s));

  // ---- capitals, and as typed.
  await page.locator('[data-page="2"] .el-text').click();
  await page.selectOption('[data-elvoicesel]', 'marker');
  await page.waitForTimeout(200);
  await page.fill('#ransomtext', 'ask Dee');
  await page.waitForTimeout(250);
  await page.click('[data-eloutline]');
  await page.click('[data-elcaps]');
  await page.waitForTimeout(250);
  ok('A MARKER CAN BE SET IN CAPITALS', (await style('[data-page="2"] .eltext', 'textTransform')) === 'uppercase');
  s = await pdf();
  ok('and is, on paper', /\(ASK\) Tj/.test(s) && /\(DEE\) Tj/.test(s) && !/\(ask\) Tj/.test(s));
  await page.locator('[data-page="2"] .el-text').click();
  await page.selectOption('[data-elvoicesel]', 'head');
  await page.waitForTimeout(200);
  await page.click('[data-elcaps]');
  await page.waitForTimeout(250);
  ok('A HEADLINE CAN BE AS TYPED', (await style('[data-page="2"] .eltext', 'textTransform')) === 'none');
  s = await pdf();
  ok('and is, on paper', /\/F7 [\d.]+ Tf[^\n]*\(ask Dee\) Tj/.test(s));

  // ---- serif, and white over a photograph.
  await page.locator('[data-page="2"] .el-text').click();
  await page.selectOption('[data-elvoicesel]', 'serif');
  await page.waitForTimeout(200);
  await page.click('[data-elink]');
  await page.click('.swatch[title="WHITE"]');
  await page.waitForTimeout(250);
  ok('A WHITE BLOCK KNOCKS OUT BLACK LETTERS', (await style('[data-page="2"] .eltext', 'backgroundColor')) === 'rgb(255, 255, 255)' &&
     (await style('[data-page="2"] .eltext', 'color')) === 'rgb(0, 0, 0)');
  await page.click('[data-elink]');
  await page.waitForTimeout(200);
  ok('and white letters on the page are white', (await style('[data-page="2"] .eltext', 'color')) === 'rgb(255, 255, 255)');
  s = await pdf();
  ok('SERIF REACHES THE PDF AS TIMES, IN WHITE',
     /\/BaseFont\/Times-Roman\//.test(s) && /1\.000 1\.000 1\.000 rg[^Q]*BT \/F10 [\d.]+ Tf/.test(s));

  // ---- a coloured cutting keeps its colour while it is typed into.
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(200);
  await page.click('.swatch[title="PINK"]');
  await page.waitForTimeout(200);
  const pink = page.locator('[data-page="2"] .el.sel');
  await pink.dblclick();
  await page.keyboard.press('End');
  await page.keyboard.type(' more');
  await page.waitForTimeout(250);
  ok('A PINK CUTTING STAYS PINK WHILE IT IS TYPED INTO',
     (await page.evaluate(() => getComputedStyle(document.activeElement).color)) === 'rgb(255, 72, 176)',
     await page.evaluate(() => getComputedStyle(document.activeElement).color));
  await page.keyboard.press('Escape');

  // ---- what a file says is checked before it becomes a class.
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('stoop_data_v4'));
    const el = d.press.panels[1].els[0];
    el.align = 'x" onmouseover="alert(1)';
    el.outline = 'yes';
    el.caps = 'yes';
    localStorage.setItem('stoop_data_v4', JSON.stringify(d));
  });
  await page.reload();
  await page.waitForTimeout(900);
  await go('#press');
  const cls = await page.locator('[data-page="2"] .eltext').first().getAttribute('class');
  ok('AN ALIGNMENT OR OUTLINE THAT IS NOT ONE IS IGNORED', !/onmouseover|al-|outline/.test(cls) &&
     (await page.locator('[data-page="2"] [onmouseover]').count()) === 0, cls);

  ok('no script errors around type', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
