// A code glued anywhere. A cutting can be a QR code for any link or text,
// drawn from the press's own encoder in the cutting's ink. Here it is read
// back square by square, from the screen and from the PDF, and compared with
// the fixtures an independent encoder made, so a code that looks right but
// scans wrong cannot pass.
const path = require('path');
const fs = require('fs');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const FIXTURES = JSON.parse(fs.readFileSync(path.join(__dirname, 'qr-fixtures.json'), 'utf8'));

// Runs of dark squares, as the SVG path and the PDF draw them, back into rows.
function fromRuns(runs, n) {
  const rows = Array.from({ length: n }, () => Array(n).fill('0'));
  runs.forEach(([x, y, len]) => { for (let i = 0; i < len; i++) if (rows[y] && x + i < n) rows[y][x + i] = '1'; });
  return rows.map(r => r.join(''));
}

module.exports = async function code(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  await page.goto(APP);
  await page.waitForTimeout(700);

  const text = Object.keys(FIXTURES)[0];
  const want = FIXTURES[text].matrix;

  await go('#backup');
  await page.fill('#addressinput', FIXTURES[text].address);
  await page.click('#savenamesbtn2');
  await page.waitForTimeout(200);
  await go('#press');
  const p3 = page.locator('#sheetzone [data-page="3"]');
  await p3.scrollIntoViewIfNeeded();
  await p3.click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="qr"]');
  await page.waitForTimeout(250);
  ok('A NEW CODE SAYS THE SCENE\'S ADDRESS UNTIL TOLD OTHERWISE',
     (await page.inputValue('#qrtext')) === 'https://' + FIXTURES[text].address);
  await page.fill('#qrtext', text);
  await page.waitForTimeout(250);

  const onScreen = await page.evaluate(() => {
    const svg = document.querySelector('#sheetzone [data-page="3"] .elqr');
    const n = Number(svg.getAttribute('viewBox').split(' ')[2]) - 8;
    const runs = [...svg.querySelector('path').getAttribute('d').matchAll(/M(\d+) (\d+)h(\d+)/g)]
      .map(m => [Number(m[1]) - 4, Number(m[2]) - 4, Number(m[3])]);
    return { n, runs };
  });
  const screenRows = fromRuns(onScreen.runs, onScreen.n);
  ok('THE CODE ON SCREEN IS THE INDEPENDENT ENCODER\'S, SQUARE FOR SQUARE',
     onScreen.n === want.length && screenRows.every((r, i) => r === want[i]),
     'size ' + onScreen.n + ', rows differing ' + screenRows.filter((r, i) => r !== want[i]).length);

  await page.click('.swatch[title="PINK"]');
  await page.waitForTimeout(200);
  ok('a code prints in its ink', (await page.evaluate(() =>
    getComputedStyle(document.querySelector('#sheetzone [data-page="3"] .elqr')).color)) === 'rgb(255, 72, 176)');

  await go('#paper');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const pdf = fs.readFileSync(await dl.path(), 'latin1');
  const block = /1\.000 0\.282 0\.690 rg [^\n]*\nq 1 g ([\d.]+) ([\d.]+) ([\d.]+) [\d.]+ re f Q\n((?:[\d.]+ [\d.]+ [\d.]+ [\d.]+ re\n)+)f\n/.exec(pdf);
  let paperRows = [];
  if (block) {
    const x0 = Number(block[1]), y0 = Number(block[2]), size = Number(block[3]);
    const n = want.length + 8, cell = size / n, top = y0 + size;
    const runs = block[4].trim().split('\n').map(l => l.split(' ').map(Number)).map(([x, y, w]) =>
      [Math.round((x - x0) / cell) - 4, Math.round((top - y) / cell) - 5, Math.round(w / cell)]);
    paperRows = fromRuns(runs, want.length);
  }
  ok('AND ON PAPER, IN PINK, SQUARE FOR SQUARE', !!block && paperRows.every((r, i) => r === want[i]),
     block ? 'rows differing ' + paperRows.filter((r, i) => r !== want[i]).length : 'no code found');

  await go('#press');
  await page.locator('#sheetzone [data-page="3"] .el-qr').click();
  await page.fill('#qrtext', 'x'.repeat(300));
  await page.waitForTimeout(250);
  ok('A CODE TAKES AS MUCH AS A CODE CAN HOLD, AND STILL DRAWS',
     (await page.inputValue('#qrtext')).length === 270 &&
     (await page.locator('#sheetzone [data-page="3"] .elqr').count()) === 1);
  await page.fill('#qrtext', text);
  await page.waitForTimeout(200);

  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(400);
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  await go('#shelf');
  await page.click('[data-readissue="01"]');
  await page.waitForTimeout(250);
  const pagesView = await page.locator('#shelfreader .elqr').count();
  await page.click('#shelfreader [data-readmode="text"]');
  await page.waitForTimeout(250);
  ok('THE CODE IS ON THE SHELF, AND THE TEXT VIEW SAYS WHAT IT OPENS',
     pagesView === 1 && (await page.locator('#shelfreader').innerText()).includes('A code for ' + text));

  ok('no script errors around codes', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
