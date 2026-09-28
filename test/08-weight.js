// What an issue file weighs, and where the weight goes.
//
// Every exported issue carries the whole press inside it, and every
// photograph on its pages, in colour and at print resolution. There is no
// budget here: a file is as heavy as the zine it carries, and a zine full of
// photographs is a heavy file, the way it is a heavy stack of paper. What
// this suite holds a file to is carrying each thing once, carrying nothing
// the zine does not need, and never carrying the camera's own notes. The
// numbers are printed with each check, so anybody can see what a file costs.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const KB = 1024;

// Photographs with the tonal range of photographs, bigger than print needs,
// each carrying the kind of note a phone writes into a picture: where it was.
const NOTE = 'GPS 51.5072N 0.1276W SECRET-LOCATION';
function withNote(jpeg) {
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from(NOTE, 'latin1')]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(body.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, body, jpeg.subarray(2)]);
}

async function makeJpegs(page, count, dir) {
  const b64 = await page.evaluate((n) => {
    const made = [];
    for (let k = 0; k < n; k++) {
      const c = document.createElement('canvas');
      c.width = 3000; c.height = 2250;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 2250);
      g.addColorStop(0, '#e8c3a5'); g.addColorStop(0.5, '#5b8f76'); g.addColorStop(1, '#1d1f44');
      x.fillStyle = g; x.fillRect(0, 0, 3000, 2250);
      for (let i = 0; i < 400; i++) {
        x.fillStyle = 'rgba(' + ((i * 37 + k * 29) % 255) + ',' + ((i * 91 + k * 7) % 255) +
          ',' + ((i * 53) % 255) + ',0.45)';
        x.fillRect((i * 173 + k * 11) % 3000, (i * 97 + k * 5) % 2250, 90 + (i % 260), 60 + (i % 200));
      }
      made.push(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
    }
    return made;
  }, count);
  return b64.map((d, i) => {
    const f = path.join(dir, 'shot-' + i + '.jpg');
    fs.writeFileSync(f, withNote(Buffer.from(d, 'base64')));
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
  // One click glues a photograph to the page last touched.
  for (let i = 0; i < tray.length && i < 8; i++) {
    await page.click('[data-page="' + (i + 1) + '"]');
    await page.waitForTimeout(110);
    await page.click('[data-traypic="' + tray[i] + '"]');
    await page.waitForTimeout(150);
  }
  const placed = await page.locator('.el-photo').count();

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

  // The press rides once, as built: the file less its seed is the page that
  // was built, give or take the document wrapper.
  const seedOf = (html) => (html.match(/<script[^>]*id="stoop-seed"[^>]*>([\s\S]*?)<\/script>/) || ['', ''])[1];
  const built = fs.statSync(path.resolve(__dirname, '..', 'artifact', 'index.html')).size;
  const pressBytes = bareBytes - Buffer.byteLength(seedOf(bare.html));
  ok('THE PRESS RIDES IN THE FILE ONCE, AS BUILT', Math.abs(pressBytes - built) < 8 * KB,
     Math.round(pressBytes / KB) + ' KB in the file, ' + Math.round(built / KB) + ' KB built');

  const seed = JSON.parse(seedOf(full.html).replace(/<\\\//g, '</'));
  const shots = Object.keys(seed.photos || {}).map(k => seed.photos[k]);
  const photoBytes = shots.reduce((a, u) => a + u.length, 0);
  ok('the issue carries its photographs', shots.length === 8, shots.length + ' in the seed');
  ok('EACH PHOTOGRAPH RIDES ONCE, AND IS MOST OF WHAT A FULL ISSUE WEIGHS',
     fullBytes - bareBytes - photoBytes < 16 * KB,
     Math.round(photoBytes / shots.length / KB) + ' KB a photograph, ' + Math.round(fullBytes / KB) +
       ' KB the full issue, ' + Math.round(bareBytes / KB) + ' KB with none');

  // A JPEG's frame header says its size and how many colours it carries.
  const frame = (url) => {
    const b = Buffer.from(url.split(',')[1], 'base64');
    for (let i = 2; i + 9 < b.length;) {
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), comps: b[i + 9], bytes: b };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  };
  const frames = shots.map(u => /^data:image\/jpeg;base64,/.test(u) ? frame(u) : null);
  ok('A PHOTOGRAPH RIDES IN COLOUR, AS JPEG', frames.every(f => f && f.comps === 3),
     frames.map(f => f ? f.comps : 'x').join(' '));
  ok('AT PRINT RESOLUTION: 2400 PIXELS ON THE LONG EDGE, FROM 3000',
     frames.every(f => f && f.w === 2400 && f.h === 1800), frames.map(f => f ? f.w + 'x' + f.h : 'x').join(' '));
  ok('AND THE CAMERA\'S OWN NOTES, WHERE IT WAS TAKEN AMONG THEM, NEVER RIDE IN A FILE',
     !full.html.includes(NOTE) && frames.every(f => f && !f.bytes.includes('Exif') && !f.bytes.includes('SECRET')));

  ok('no script errors while weighing', errs.length === 0, errs.slice(0, 3).join(' | '));
  fs.rmSync(dir, { recursive: true, force: true });
};
