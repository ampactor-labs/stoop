// Riso plates. An issue with a blue headline, a black body, a colour
// photograph and a pink page yields exactly two plates: the blue drum holds
// the headline and nothing else, the black drum the body and the photograph
// as greyscale and not the headline; the preview overprints both with
// Multiply, and the note names page 3 as pink stock.
const path = require('path');
const fs = require('fs');
const { photoFile } = require('./fixture.js');
const { unzip } = require('./14-site.js');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function riso(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const streamsOf = (pdf) => [...pdf.matchAll(/<<\/Length \d+>>\nstream\n([\s\S]*?)\nendstream/g)].map(m => m[1]);
  await page.goto(APP);
  await page.waitForTimeout(700);

  await go('#backup');
  await page.fill('#addressinput', 'nightbus.org');
  await page.click('#savenamesbtn2');
  await go('#scraps');
  await page.setInputFiles('#photofile', photoFile());
  await page.waitForTimeout(1500);
  await go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(500);
  await go('#press');

  // A blue headline on page 2, a colour photograph on page 4, pink stock on 3.
  const p2 = page.locator('#sheetzone [data-page="2"]');
  await p2.scrollIntoViewIfNeeded();
  await p2.click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(200);
  await page.selectOption('[data-elvoicesel]', 'head');
  await page.waitForTimeout(150);
  await page.dblclick('#sheetzone [data-page="2"] .el');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('SLOW BLUE');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.click('#sheetzone [data-page="2"] .el');
  await page.click('[data-elcolour][title="BLUE"]');
  await page.waitForTimeout(200);
  const p4 = page.locator('#sheetzone [data-page="4"]');
  await p4.scrollIntoViewIfNeeded();
  await p4.click({ position: { x: 6, y: 6 } });
  await page.click('#phototray [data-traypic]');
  await page.waitForTimeout(300);
  const p3 = page.locator('#sheetzone [data-page="3"]');
  await p3.scrollIntoViewIfNeeded();
  await p3.click({ position: { x: 6, y: 400 } });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.click('[data-pgfill="3"][title="PINK"]');
  await page.waitForTimeout(200);
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')).press.panels.map(p => (p.els || []).map(e => e.kind + ':' + (e.colour || '') + ':' + (e.text || '')).join(' ')));
  ok('the sheet holds a blue headline and a photograph', /text:#0078bf:SLOW BLUE/.test(model[1]) && /photo/.test(model[3]), model.join(' | '));

  await go('#paper');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#risobtn')]);
  ok('the plates come as one zip named for the issue', /-01-riso\.zip$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const { out, errors } = unzip(fs.readFileSync(await dl.path()));
  const names = Object.keys(out).sort();
  ok('A BLUE HEADLINE, A BLACK BODY AND A PINK PAGE YIELD EXACTLY TWO PLATES, A PREVIEW AND A NOTE',
     errors.length === 0 && names.join(' ') === 'black.pdf blue.pdf plates.txt preview.pdf', errors[0] || names.join(' '));
  const blue = (out['blue.pdf'] || Buffer.alloc(0)).toString('latin1');
  const black = (out['black.pdf'] || Buffer.alloc(0)).toString('latin1');
  const bluePages = streamsOf(blue).filter(s => /re W n/.test(s));
  const blackPages = streamsOf(black).filter(s => /re W n/.test(s));
  ok('EACH PLATE IS THE PAGES IN READING ORDER, ONE TO A SHEET', bluePages.length === 8 && blackPages.length === 8 &&
     (blue.match(/\/Type\/Page\/Parent/g) || []).length === 8, bluePages.length + ' and ' + blackPages.length);
  ok('THE BLUE PLATE HOLDS THE HEADLINE AND NOTHING ELSE',
     /\(SLOW BLUE\) Tj/.test(bluePages[1]) && !/THE SEAM/.test(bluePages[1]) && !/\(NIGHT BUS\) Tj/.test(bluePages[0]) &&
     bluePages.filter(s => /Tj/.test(s)).length === 1 && !/\/Im\d+ Do/.test(blue), bluePages[1].slice(0, 200).replace(/\n/g, ' '));
  ok('THE BLACK PLATE HOLDS THE BODY, THE COVER AND THE ADDRESS, AND NOT THE HEADLINE',
     /THE SEAM/.test(blackPages[1]) && /\(NIGHT BUS\) Tj|\(STOOP ZINE\) Tj/.test(blackPages[0]) && /nightbus\.org/.test(blackPages[7]) &&
     !/\(SLOW BLUE\) Tj/.test(black));
  ok('and the colour photograph, as greyscale', /\/BitsPerComponent 8\/ColorSpace\/DeviceGray/.test(black) && !/DeviceRGB/.test(black) &&
     /\/Im\d+ Do/.test(blackPages[3]), (black.match(/\/Type\/XObject\/Subtype\/Image[^>]*/g) || []).join(' | ').slice(0, 300));
  ok('A PLATE IS GREYSCALE THROUGHOUT: NO COLOUR IS SET ANYWHERE ON IT', !/ rg/.test(blue) && !/ rg/.test(black) && !/ RG/.test(blue));
  ok('with bleed and no crop marks', (blue.match(/\/MediaBox\[0\.00 0\.00 216\.00 324\.00\]\/BleedBox\[0\.00 0\.00 216\.00 324\.00\]\/TrimBox\[9\.00 9\.00 207\.00 315\.00\]/g) || []).length === 8 &&
     !/q 0\.25 w 0 G/.test(blue) && !/q 0\.25 w 0 G/.test(black));
  ok('the pink page prints on stock, not on a plate', !/re f/.test(bluePages[2]) && !/0\.976 0\.776 0\.827 rg/.test(black));

  const preview = (out['preview.pdf'] || Buffer.alloc(0)).toString('latin1');
  ok('THE PREVIEW OVERPRINTS EVERY PLATE IN ITS INK WITH MULTIPLY',
     /\/ExtGState<<\/GS1<<\/BM\/Multiply>>>>/.test(preview) && (preview.match(/\/Group<<\/S\/Transparency\/CS\/DeviceRGB\/I true>>/g) || []).length === 16 &&
     /0\.000 0\.471 0\.749 rg 0\.000 0\.471 0\.749 RG/.test(preview) && /\(SLOW BLUE\) Tj/.test(preview) &&
     /0\.976 0\.776 0\.827 rg/.test(preview) && (preview.match(/q \/GS1 gs \/P\d+ Do Q/g) || []).length === 16);
  const note = (out['plates.txt'] || Buffer.alloc(0)).toString('utf8');
  ok('AND THE NOTE NAMES THE DRUMS, THEIR PAGES AND THE STOCK', /black\.pdf/.test(note) && /blue\.pdf\s+the blue drum: pages 2\n/.test(note) &&
     /page 3: print on pink stock/.test(note) && /no crop marks/.test(note), note.split('\n').slice(-3).join(' | '));

  // The shelf offers the same for any issue that has shipped.
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  await go('#shelf');
  const [sdl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('[data-risoissue="01"]')]);
  const shelved = unzip(fs.readFileSync(await sdl.path()));
  ok('A SHIPPED ISSUE SEPARATES FROM THE SHELF', shelved.errors.length === 0 && Object.keys(shelved.out).sort().join(' ') === 'black.pdf blue.pdf plates.txt preview.pdf');

  // And the ordinary PDF is untouched by the filter afterwards.
  const [odl] = await Promise.all([page.waitForEvent('download'), page.click('[data-pdfissue="01"]')]);
  const plain = fs.readFileSync(await odl.path(), 'latin1');
  ok('the ordinary PDF still prints the headline in blue and the page in pink', /0\.000 0\.471 0\.749 rg/.test(plain) && /0\.976 0\.776 0\.827 rg/.test(plain) && /DeviceRGB/.test(plain));
  ok('no script errors separating', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
