// What an issue file weighs, and why the number is what it is.
//
// Every exported issue carries the whole press inside it, so two costs ride in
// every file anyone hands to anyone: the press, once, and each photograph. The
// ceilings below are not derived from any law of physics — they are ratchets,
// set above what the current build actually measures, so that a regression has
// to be a decision instead of an accident. Their job is to keep an issue file
// the kind of thing you send without thinking about it.
//
// Measured on the build this was written against:
//
//     press, fixed          143 KB     the same in every issue, photos or not
//     per photograph         83 KB     1000px long edge, 1-bit, deflated
//     text, 8 pages           7 KB
//     full 8-page issue     818 KB     a photograph on every page
//
// The per-photograph number is the one with a principle under it: a dithered
// photograph has exactly two tones, so it is stored at one bit per pixel. It
// used to be stored as 32-bit RGBA at 486 KB, which is the same picture at
// roughly six times the price, paid again in every file it travelled in.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const KB = 1024;

// Photographs with the tonal range of photographs. Flat colour dithers to
// almost nothing and would flatter every number here.
async function makeJpegs(page, count, dir) {
  const b64 = await page.evaluate((n) => {
    const made = [];
    for (let k = 0; k < n; k++) {
      const c = document.createElement('canvas');
      c.width = 1600; c.height = 1200;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 1200);
      g.addColorStop(0, '#e8eef5'); g.addColorStop(0.5, '#8b8f96'); g.addColorStop(1, '#1d1f24');
      x.fillStyle = g; x.fillRect(0, 0, 1600, 1200);
      for (let i = 0; i < 400; i++) {
        x.fillStyle = 'rgba(' + ((i * 37 + k * 29) % 255) + ',' + ((i * 91 + k * 7) % 255) +
          ',' + ((i * 53) % 255) + ',0.45)';
        x.fillRect((i * 173 + k * 11) % 1600, (i * 97 + k * 5) % 1200, 50 + (i % 140), 30 + (i % 110));
      }
      made.push(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
    }
    return made;
  }, count);
  return b64.map((d, i) => {
    const f = path.join(dir, 'shot-' + i + '.jpg');
    fs.writeFileSync(f, Buffer.from(d, 'base64'));
    return f;
  });
}

// Publish one issue with `photos` photographs on it and hand back the file.
async function publish(browser, errs, dir, photos) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };

  await page.goto(APP);
  await page.waitForTimeout(700);

  if (photos > 0) {
    await go('#log');
    await page.setInputFiles('#photofile', await makeJpegs(page, photos, dir));
    await page.waitForTimeout(900 + photos * 500);
  }

  await go('#desk');
  const words = 'The substation hums in F and the sodium lamps buzz over the lot where everyone ' +
    'waits for the last bus out of the north end. Somebody wrote on the transformer housing in ' +
    'silver paint pen four years ago and nobody has painted over it yet. ';
  for (let i = 0; i < 6; i++) {
    await page.fill('#piecetitle', 'Piece ' + (i + 1));
    await page.fill('#piecebody', words.repeat(2));
    await page.click('#piecesubmitbtn');
    await page.waitForTimeout(140);
  }
  await page.click('#compileissuebtn');
  await page.waitForTimeout(500);

  await go('#press');
  const tray = await page.evaluate(() =>
    [...document.querySelectorAll('[data-traypic]')].map(e => e.getAttribute('data-traypic')));
  for (let i = 0; i < tray.length && i < 8; i++) {
    await page.click('[data-traypic="' + tray[i] + '"]');
    await page.waitForTimeout(110);
    await page.click('[data-page="' + (i + 1) + '"]');
    await page.waitForTimeout(150);
  }
  const placed = await page.locator('.panel-photo').count();

  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(800);
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-exportissue="01"]')
  ]);
  const file = path.join(dir, photos + '-' + dl.suggestedFilename());
  await dl.saveAs(file);
  await ctx.close();
  return { placed, html: fs.readFileSync(file, 'utf8') };
}

module.exports = async function weight(browser, ok) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-weight-'));
  const errs = [];

  const bare = await publish(browser, errs, dir, 0);
  const full = await publish(browser, errs, dir, 8);
  const bareBytes = Buffer.byteLength(bare.html);
  const fullBytes = Buffer.byteLength(full.html);

  ok('every page of the full issue carries a photograph', full.placed === 8, full.placed + ' placed');

  // The fixed term. check.sh ratchets the built fragment at 192 KB without a
  // browser; this measures the same thing from the other side, the press as
  // it actually rides in a file, which is the file less the seed it carries.
  // Comparing the whole bare file against the same number once put the
  // document wrapper and the seed on the wrong side of the ledger.
  const seedOf = (html) => (html.match(/<script[^>]*id="stoop-seed"[^>]*>([\s\S]*?)<\/script>/) || ['', ''])[1];
  const pressBytes = bareBytes - Buffer.byteLength(seedOf(bare.html));
  ok('the press is a fixed cost, and it has not crept',
     pressBytes < 192 * KB, Math.round(pressBytes / KB) + ' KB, ratchet 192 KB');

  // The marginal term, and the one with a principle under it.
  const perPhoto = (fullBytes - bareBytes) / full.placed;
  ok('A PHOTOGRAPH COSTS WHAT A 1-BIT PHOTOGRAPH COSTS',
     perPhoto < 120 * KB, Math.round(perPhoto / KB) + ' KB each, ratchet 120 KB');

  // Not a proxy for anything: the actual file, at its heaviest.
  ok('A FULL ISSUE IS UNDER A MEGABYTE',
     fullBytes < 1024 * KB, Math.round(fullBytes / KB) + ' KB, ceiling 1024 KB');

  // The structural version of the same claim: two tones, stored in one bit.
  // A PNG header says this outright, so the check does not depend on a size.
  const seed = JSON.parse(seedOf(full.html));
  const shots = Object.keys(seed.photos || {}).map(k => seed.photos[k]);
  const headers = shots.map((url) => {
    const png = Buffer.from(url.split(',')[1], 'base64');
    // IHDR data starts 8 bytes of signature + 8 of length/type in.
    return { depth: png[24], colour: png[25] };
  });
  ok('the issue carries its photographs', shots.length === 8, shots.length + ' in the seed');
  ok('AND STORES THEM AT ONE BIT PER PIXEL, GREYSCALE',
     headers.length > 0 && headers.every(h => h.depth === 1 && h.colour === 0),
     headers.map(h => h.depth + '/' + h.colour).join(' '));

  ok('no script errors while weighing', errs.length === 0, errs.slice(0, 3).join(' | '));
  fs.rmSync(dir, { recursive: true, force: true });
};
