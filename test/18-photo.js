// A photograph as the whole page, and a drawing cleaned up. A cutting can
// fill its page edge to edge; a page's own photograph can fill it behind the
// page's heading and words, which can be white over it; and a drawing
// photographed on a table can have its grey paper made white and its brown
// ink made black without losing its colour.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function photo(browser, ok) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-photo-'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  await page.goto(APP);
  await page.waitForTimeout(700);

  // A drawing on a table: grey-brown paper, brown ink, a green marker.
  const drawing = path.join(dir, 'drawing.jpg');
  fs.writeFileSync(drawing, Buffer.from(await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 900;
    const x = c.getContext('2d');
    x.fillStyle = '#c8c2b4'; x.fillRect(0, 0, 1200, 900);
    x.lineWidth = 18; x.lineCap = 'round';
    x.strokeStyle = '#3a3230';
    for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(100 + i * 160, 120); x.lineTo(180 + i * 150, 760); x.stroke(); }
    x.strokeStyle = '#4f9a5a';
    x.beginPath(); x.moveTo(80, 450); x.bezierCurveTo(400, 250, 800, 650, 1120, 420); x.stroke();
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  }), 'base64'));

  const pixels = () => page.evaluate(async () => {
    const img = document.querySelector('[data-page="2"] .elphoto');
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let white = 0, black = 0, green = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) white++;
      if (d[i] < 50 && d[i + 1] < 50 && d[i + 2] < 50) black++;
      if (d[i + 1] > d[i] + 40 && d[i + 1] > d[i + 2] + 30) green++;
    }
    const n = d.length / 4;
    return { white: white / n, black: black / n, green: green / n };
  });

  await go('#press');
  const p2 = page.locator('#sheetzone [data-page="2"]');
  await p2.scrollIntoViewIfNeeded();
  await p2.click({ position: { x: 6, y: 6 } });
  await page.setInputFiles('#pastephotofile', drawing);
  await page.waitForTimeout(1600);
  const before = await pixels();
  ok('A PHOTOGRAPH OFFERS ITS LOOKS AS A LIST, A CLEAN SCAN AMONG THEM',
     (await page.locator('[data-ellook] option').allInnerTexts()).join(' ') === 'COLOUR B&W GRAIN DOTS HARD CLEAN SCAN');
  await page.selectOption('[data-ellook]', 'scan');
  await page.waitForTimeout(1600);
  const after = await pixels();
  ok('A CLEAN SCAN MAKES THE PAPER WHITE', before.white < 0.05 && after.white > 0.6,
     before.white.toFixed(2) + ' then ' + after.white.toFixed(2));
  ok('the ink black', before.black < 0.01 && after.black > 0.02, before.black.toFixed(3) + ' then ' + after.black.toFixed(3));
  ok('AND KEEPS THE GREEN MARKER GREEN', after.green > 0.005, after.green.toFixed(3));

  // ---- a cutting filling its page.
  await page.click('[data-elfillpage]');
  await page.waitForTimeout(300);
  const el = (await store()).press.panels[1].els.find(e => e.kind === 'photo');
  const box = await page.locator('#sheetzone [data-page="2"] .el-photo').boundingBox();
  const pb = await p2.boundingBox();
  ok('FILL THE PAGE PUTS THE PHOTOGRAPH EDGE TO EDGE, UNDER EVERYTHING ELSE',
     el.x === 0 && el.y === 0 && el.w === 1 && el.h === 1 && el.crop === true && !el.rot &&
     Math.abs(box.x - pb.x) < 2 && Math.abs(box.width - pb.width) < 2 && Math.abs(box.height - pb.height) < 2,
     JSON.stringify({ x: el.x, y: el.y, w: el.w, h: el.h }));

  // ---- the cover's own photograph filling the cover, its title on top.
  await go('#scraps');
  await page.setInputFiles('#photofile', drawing);
  await page.waitForTimeout(1600);
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(500);
  await go('#press');
  const cover = page.locator('#sheetzone [data-page="1"]');
  await cover.scrollIntoViewIfNeeded();
  await cover.click({ position: { x: 4, y: 300 } });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(200);
  ok('THE PAGE OFFERS ITS PHOTOGRAPH THE WHOLE PAGE', /PHOTO ABOVE THE WORDS/.test(await page.locator('#inspector').innerText()));
  await page.click('[data-pgphfill="1"]');
  await page.waitForTimeout(300);
  const shot = await cover.locator('.panel-photo').boundingBox();
  const cb = await cover.boundingBox();
  // The photograph is taken out of the flow and the words stacked above it.
  const onTop = await page.evaluate(() => {
    const h = getComputedStyle(document.querySelector('#sheetzone [data-page="1"] h3'));
    const b = getComputedStyle(document.querySelector('#sheetzone [data-page="1"] .body'));
    const p = getComputedStyle(document.querySelector('#sheetzone [data-page="1"] .panel-photo'));
    return p.position === 'absolute' && p.zIndex === 'auto' && h.position === 'relative' && h.zIndex === '1' && b.zIndex === '1';
  });
  ok('A PAGE PHOTOGRAPH CAN FILL THE PAGE, ITS TITLE ON TOP',
     Math.abs(shot.width - cb.width) < 2 && Math.abs(shot.height - cb.height) < 2 && onTop);
  await page.click('[data-pgletters="1"]');
  await page.waitForTimeout(250);
  ok('AND THE PAGE\'S LETTERS CAN BE WHITE OVER IT',
     (await page.evaluate(() => getComputedStyle(document.querySelector('#sheetzone [data-page="1"] h3')).color)) === 'rgb(255, 255, 255)');

  // ---- the same on paper.
  await go('#paper');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const pdf = fs.readFileSync(await dl.path(), 'latin1');
  const draws = [...pdf.matchAll(/q ([\d.]+) 0 0 ([\d.]+) [\d.-]+ [\d.-]+ cm (?:1 g 0 0 1 1 re f [^\n]*\n)?\/Im\d+ Do Q/g)]
    .map(m => [Number(m[1]), Number(m[2])]);
  ok('ON PAPER THE COVER PHOTOGRAPH COVERS THE WHOLE PAGE', draws.some(([w, h]) => w >= 197.9 && h >= 305.9),
     draws.map(d => d.map(v => Math.round(v)).join('x')).join(' '));
  ok('and the cover is set in white', /1 g 1 G\n[^Q]*\(STOOP ZINE\) Tj/.test(pdf) && /q 2\.25 w 1 G /.test(pdf));

  // ---- and in the file handed on.
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  const [hdl] = await Promise.all([page.waitForEvent('download'), page.click('#handonbtn')]);
  const file = path.join(dir, 'issue.html');
  await hdl.saveAs(file);
  const other = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await other.goto('file://' + file);
  await other.waitForTimeout(900);
  const cls = await other.locator('#landing [data-readpage="1"]').getAttribute('class');
  ok('A FRIEND OPENING THE FILE SEES THE PHOTOGRAPH COVER, IN WHITE LETTERS',
     /photofill/.test(cls) && /letterswhite/.test(cls), cls);
  await other.context().close();

  ok('no script errors around photographs', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
