// The paste-up. A zine is a board things got glued to, and the claims that
// matter are that you can put a thing anywhere, that it survives a change of
// format, and that it reaches the paper. A WYSIWYG whose output does not
// print is a mockup with extra steps.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function pasteup(browser, ok) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-paste-'));
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const geom = (sel) => page.evaluate((s) => {
    const e = document.querySelector(s);
    return e ? { left: e.style.left, top: e.style.top, transform: e.style.transform } : null;
  }, sel);

  await page.goto(APP);
  await page.waitForTimeout(700);
  await go('#press');

  // ---- a cutting lands on the panel you were last looking at
  await page.click('[data-page="1"]');
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(350);
  ok('a cutting lands on the panel', (await page.locator('[data-page="1"] .el').count()) === 1);
  ok('and it comes up selected, with handles',
     (await page.locator('[data-page="1"] .el.sel .h-rot').count()) === 1);

  // ---- dragging moves it, and the model is in fractions of the panel
  // The sheet sits well below the fold; a gesture has to be aimed at pixels
  // that are actually on screen or it lands on nothing.
  const before = await geom('[data-page="1"] .el');
  await page.locator('[data-page="1"] .el').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  let box = await page.locator('[data-page="1"] .el').first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 45, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await geom('[data-page="1"] .el');
  ok('DRAGGING MOVES IT', after.left !== before.left && after.top !== before.top,
     before.left + ' -> ' + after.left);
  ok('and the position is a fraction of the panel, not a pixel',
     /%$/.test(after.left) && /%$/.test(after.top), after.left + ' / ' + after.top);

  // ---- no page is ever shown upside down while it is being worked on
  ok('NO PAGE ON THE PRESS IS UPSIDE DOWN',
     (await page.locator('#sheetzone .panel.flip').count()) === 0 &&
     (await page.evaluate(() => [...document.querySelectorAll('#sheetzone .panel')]
        .every(p => getComputedStyle(p).transform === 'none'))));
  await page.click('[data-page="5"]');
  await page.click('[data-addel="box"]');
  await page.waitForTimeout(350);
  const fBefore = await geom('[data-page="5"] .el');
  await page.locator('[data-page="5"] .el').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const fbox = await page.locator('[data-page="5"] .el').first().boundingBox();
  await page.mouse.move(fbox.x + fbox.width / 2, fbox.y + fbox.height / 2);
  await page.mouse.down();
  await page.mouse.move(fbox.x + fbox.width / 2 + 80, fbox.y + fbox.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const fAfter = await geom('[data-page="5"] .el');
  ok('and dragging right on any page goes right',
     parseFloat(fAfter.left) > parseFloat(fBefore.left), fBefore.left + ' -> ' + fAfter.left);

  // ---- a text cutting is moved by default and typed into on purpose
  await page.dblclick('[data-page="1"] .el');
  await page.waitForTimeout(300);
  ok('DOUBLE-CLICK PUTS YOU INSIDE A TEXT CUTTING',
     (await page.locator('[data-page="1"] .el.editing').count()) === 1);
  await page.keyboard.type(' ZINE');
  await page.waitForTimeout(300);
  ok('and typing reaches the model',
     /ZINE/.test(await page.locator('[data-page="1"] .el .eltext').innerText()),
     await page.locator('[data-page="1"] .el .eltext').innerText());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok('and Escape comes back out to moving it',
     (await page.locator('.el.editing').count()) === 0);

  // ---- voices, and the ransom note
  await page.click('[data-page="1"] .el');
  await page.waitForTimeout(200);
  // Five voices, in order. Walk them and check the two new ones on the way.
  await page.click('[data-elvoice]'); await page.waitForTimeout(200);   // head
  await page.click('[data-elvoice]'); await page.waitForTimeout(250);   // marker
  await page.fill('#ransomtext', 'no gods no masters'); await page.waitForTimeout(300);
  const markerWords = await page.evaluate(() => [...document.querySelectorAll('[data-page="1"] .v-marker .rm')]
    .map(s => s.style.transform));
  ok('MARKER TURNS EVERY WORD BY ITS OWN SMALL ANGLE',
     markerWords.length === 4 && new Set(markerWords).size > 1, markerWords.join(' '));
  await page.click('[data-elvoice]'); await page.waitForTimeout(250);   // stencil
  ok('STENCIL CUTS BRIDGES THROUGH THE LETTERS',
     /repeating-linear-gradient/.test(await page.evaluate(() => {
       const s = getComputedStyle(document.querySelector('[data-page="1"] .v-stencil'));
       return s.maskImage || s.webkitMaskImage || '';
     })));
  await page.click('[data-elvoice]'); await page.waitForTimeout(250);   // ransom
  ok('the voice cycles to the ransom note',
     (await page.locator('[data-elvoice]').innerText()).trim() === 'RANSOM',
     await page.locator('[data-elvoice]').innerText());
  await page.fill('#ransomtext', 'SPLIT LIP');
  await page.waitForTimeout(400);
  const cut = await page.evaluate(() => [...document.querySelectorAll('[data-page="1"] .rn')]
    .map(s => s.className + '|' + s.style.transform + '|' + s.style.fontSize));
  ok('every letter is cut from somewhere else', cut.length === 8, cut.length + ' letters');
  ok('and no letter came out with a negative size or an unknown face',
     cut.every(c => !/-\d*\.?\d+em/.test(c) && /\bf[0-3]\b/.test(c)), cut[0]);
  ok('the letters are not all identical',
     new Set(cut.map(c => c.split('|')[0])).size > 1,
     [...new Set(cut.map(c => c.split('|')[0]))].join(' '));

  // ---- stamps: one geometry on screen and on paper
  await page.click('[data-page="3"]');
  await page.click('#stampbtn'); await page.waitForTimeout(200);
  ok('the stamp palette shows every stamp', (await page.locator('#stamps [data-stamp]').count()) === 9);
  await page.click('[data-stamp="copy"]'); await page.waitForTimeout(300);
  ok('A STAMP IS A CUTTING',
     (await page.locator('[data-page="3"] .el-stamp .stampsvg').count()) === 1 &&
     /PHOTOCOPY THIS/.test(await page.locator('[data-page="3"] .el-stamp').innerText()));
  await page.click('[data-page="3"]');
  await page.click('#stampbtn'); await page.waitForTimeout(200);
  await page.click('[data-stamp="barcode"]'); await page.waitForTimeout(300);
  ok('and a barcode is a pile of bars from a hash',
     (await page.locator('[data-page="3"] .el-stamp svg rect').count()) > 12);

  // ---- generation: the copier's wear, on screen, in the issue, on paper
  await page.click('#genbtn'); await page.waitForTimeout(150);
  await page.click('#genbtn'); await page.waitForTimeout(200);
  ok('GEN 2 IS A COPY OF A COPY',
     (await page.evaluate(() => document.querySelector('#sheetzone .pages').getAttribute('data-gen'))) === '2' &&
     /copy of a copy/i.test(await page.locator('#genbtn').innerText()));
  ok('and the wear is a filter on every page but the one being typed into',
     /url\("?#gen2"?\)/.test(await page.evaluate(() => getComputedStyle(document.querySelector('[data-page="4"]')).filter)));

  // ---- undo and redo
  const elCount = () => page.evaluate(() => document.querySelectorAll('.el').length);
  const had = await elCount();
  await page.click('[data-addel="rule"]');
  await page.waitForTimeout(300);
  ok('a rule is a cutting too', (await elCount()) === had + 1);
  await page.click('#undobtn');
  await page.waitForTimeout(350);
  ok('UNDO TAKES IT BACK', (await elCount()) === had);
  await page.click('#redobtn');
  await page.waitForTimeout(350);
  ok('and redo puts it back', (await elCount()) === had + 1);

  // ---- the sheet accepts what lands on it, where it lands
  const target = page.locator('[data-page="7"]');
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const tb = await target.boundingBox();
  const dtText = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'NO GODS NO MASTERS');
    return dt;
  });
  await page.dispatchEvent('[data-page="7"]', 'drop', {
    dataTransfer: dtText, clientX: tb.x + tb.width * 0.7, clientY: tb.y + tb.height * 0.7
  });
  await page.waitForTimeout(400);
  const dropped = await geom('[data-page="7"] .el');
  ok('TEXT DROPPED ON A PANEL IS A CUTTING WHERE IT LANDED',
     dropped && parseFloat(dropped.left) > 30 && parseFloat(dropped.top) > 40,
     dropped ? dropped.left + ' / ' + dropped.top : 'nothing landed');
  ok('and a short line arrives as a headline',
     (await page.locator('[data-page="7"] .eltext.v-head').count()) === 1);

  const dtFile = await page.evaluateHandle(async () => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#000');
    x.fillStyle = g; x.fillRect(0, 0, 400, 300);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'drop.jpg', { type: 'image/jpeg' }));
    return dt;
  });
  await page.dispatchEvent('[data-page="7"]', 'drop', {
    dataTransfer: dtFile, clientX: tb.x + tb.width * 0.3, clientY: tb.y + tb.height * 0.3
  });
  await page.waitForTimeout(1800);
  ok('A PHOTOGRAPH DROPPED ON A PANEL IS DITHERED AND GLUED DOWN',
     (await page.locator('[data-page="7"] .el-photo .elphoto').count()) === 1);

  // ---- the promise the whole press is built on
  const keep = await geom('[data-page="1"] .el');
  await page.selectOption('#formatsel', 'saddle16');
  await page.waitForTimeout(700);
  const kept = await geom('[data-page="1"] .el');
  ok('A PASTE-UP SURVIVES A CHANGE OF FORMAT',
     kept && kept.left === keep.left && kept.top === keep.top,
     keep.left + ' -> ' + (kept ? kept.left : 'gone'));
  await page.selectOption('#formatsel', 'fold8');
  await page.waitForTimeout(600);

  // ---- and it reaches the paper
  // A headline long enough to wrap, on a page nothing else has touched, so
  // the check below always has exactly one to measure.
  await page.click('[data-page="4"]');
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(250);
  await page.click('[data-elvoice]');            // typewriter -> headline
  await page.waitForTimeout(200);
  await page.dblclick('[data-page="4"] .el.sel');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('the substation hums in F all night long');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  // Line boxes, not box height: the cutting grows to hold its words, so
  // scrollHeight over lineHeight counts the box and not the lines in it.
  const headline = await page.evaluate(() => {
    const t = document.querySelector('[data-page="4"] .v-head');
    const words = t.innerText.trim().split(/\s+/).filter(Boolean);
    const keep = t.innerHTML;
    t.innerHTML = words.map(w => '<span class="lw">' + w + '</span>').join(' ');
    const tops = [...t.querySelectorAll('.lw')].map(s => Math.round(s.offsetTop));
    t.innerHTML = keep;
    return {
      words: words.map(w => w.toUpperCase()),
      lines: new Set(tops).size
    };
  });

  await go('#paper');
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 25000 }),
    page.click('#pdfzinebtn')
  ]);
  const pdf = path.join(dir, 'sheet.pdf');
  await dl.saveAs(pdf);
  const raw = fs.readFileSync(pdf, 'latin1');
  ok('THE PASTE-UP REACHES THE PDF', raw.length > 2000 && /%PDF/.test(raw));

  // A headline wraps where the browser wrapped it. The paper cannot know
  // which faces this machine has, so it does not guess: it draws the breaks
  // the screen recorded. Checked by word, so a one-word line still counts.
  const runs = (raw.match(/\(([^)]*)\) Tj/g) || []).map(s => s.slice(1, -4)).filter(Boolean);
  const onPaper = runs.filter(t => t.split(' ').every(w => headline.words.includes(w)));
  const paperWords = onPaper.join(' ').split(/\s+/).filter(Boolean);
  ok('A HEADLINE BREAKS ON PAPER WHERE IT BROKE ON SCREEN',
     headline.lines > 1 && onPaper.length === headline.lines,
     'screen ' + headline.lines + ', paper ' + onPaper.length + ' ' + JSON.stringify(onPaper));
  ok('and not one word is lost on the way',
     paperWords.length === headline.words.length,
     paperWords.length + ' of ' + headline.words.length + ' words');
  ok('and the cut letters bring their own faces with them',
     /Times-Bold/.test(raw) && /Courier-Bold/.test(raw) && /Helvetica-BoldOblique/.test(raw));
  ok('THE STAMP IS ON THE PAPER, AS PATHS AND AS ITS WORDS',
     /\(PHOTOCOPY THIS\) Tj/.test(raw) && (raw.match(/ re f\n/g) || []).length > 12);
  ok('and gen 2 threw toner over the panels', (raw.match(/ re /g) || []).length > 8 * 100,
     (raw.match(/ re /g) || []).length + ' rects');

  // ---- and it travels
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(800);
  const [dl2] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-exportissue="01"]')
  ]);
  const file = path.join(dir, dl2.suggestedFilename());
  await dl2.saveAs(file);
  const html = fs.readFileSync(file, 'utf8');
  ok('the exported issue carries the paste-up', /"els":\[/.test(html));
  ok('and remembers which generation it was printed at', /"gen":2/.test(html));

  const fresh = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const other = await fresh.newPage();
  other.on('pageerror', e => errs.push('reader: ' + e.message));
  await other.goto('file://' + file);
  await other.waitForTimeout(900);
  await other.click('[data-reprintissue="01"]').catch(() => {});
  await other.waitForTimeout(300);
  ok('AND IT IS THERE ON THE MACHINE THAT OPENS THE FILE',
     (await other.locator('#shelfreader, .shelf-row').count()) > 0);
  const carried = await other.evaluate(() => {
    const s = document.getElementById('stoop-seed');
    const seed = JSON.parse(s.textContent);
    const panels = (seed.issues[0] || {}).panels || [];
    return panels.reduce((n, p) => n + ((p.els || []).length), 0);
  });
  ok('with every cutting still on it', carried >= 3, carried + ' cuttings in the seed');
  const photoTravelled = await other.evaluate(() => {
    const seed = JSON.parse(document.getElementById('stoop-seed').textContent);
    const panels = (seed.issues[0] || {}).panels || [];
    const ids = [];
    panels.forEach(p => (p.els || []).forEach(e => { if (e.kind === 'photo') ids.push(e.photo); }));
    return ids.length > 0 && ids.every(id => seed.photos && seed.photos[id]);
  });
  ok('AND A GLUED-DOWN PHOTOGRAPH TRAVELS WITH IT', photoTravelled);
  await fresh.close();

  ok('no script errors anywhere in the paste-up', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
  fs.rmSync(dir, { recursive: true, force: true });
};
