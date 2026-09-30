// The distro. A friend's issue file goes on the shelf as theirs, with the
// roster, name and address it came with, without touching the scene's own
// issues or roster; it reads and prints in its own format; the site carries
// it under distro/ while the feed and the catalogue leave it out; and
// dropping it sweeps its photographs.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { photoFile } = require('./fixture.js');
const { unzip } = require('./14-site.js');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  const photosKept = () => page.evaluate(() => new Promise(res => {
    const r = indexedDB.open('stoop_photos');
    r.onsuccess = () => { const q = r.result.transaction('photos').objectStore('photos').count(); q.onsuccess = () => res(q.result); };
    r.onerror = () => res(-1);
  }));
  return { ctx, page, errs, go, store, photosKept };
}

module.exports = async function distro(browser, ok) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-distro-'));

  // ---- Dee's scene makes NIGHT BUS №01 as a stitched booklet, and hands it on.
  const D = await open(browser);
  await D.page.goto(APP);
  await D.page.waitForTimeout(700);
  await D.go('#backup');
  await D.page.fill('[data-personid="a"]', 'Dee');
  await D.page.fill('#zinename', 'NIGHT BUS');
  await D.page.fill('#addressinput', 'nightbus.org');
  await D.page.click('#savenamesbtn2');
  await D.go('#scraps');
  await D.page.setInputFiles('#photofile', photoFile());
  await D.page.waitForTimeout(1500);
  await D.go('#press');
  await D.page.selectOption('#formatsel', 'saddle8');
  await D.page.waitForTimeout(300);
  await D.go('#desk');
  await D.page.click('#compileissuebtn');
  await D.page.waitForTimeout(500);
  await D.page.click('#buildissuebtn');
  await D.page.waitForTimeout(600);
  const [ddl] = await Promise.all([D.page.waitForEvent('download'), D.page.click('#handonbtn')]);
  const file = path.join(dir, 'nightbus-01.html');
  await ddl.saveAs(file);
  await D.ctx.close();

  // ---- Kim's scene carries it.
  const K = await open(browser);
  const page = K.page;
  await page.goto(APP);
  await page.waitForTimeout(700);
  await K.go('#backup');
  await page.fill('#zinename', 'SPLIT LIP');
  await page.fill('#addressinput', 'splitlip.org');
  await page.click('#savenamesbtn2');
  await K.go('#shelf');
  const before = await K.photosKept();
  await page.setInputFiles('#carryfile', file);
  await page.waitForTimeout(900);
  const row = page.locator('#distrolist .shelf-row');
  ok('A FRIEND\'S ISSUE GOES ON THE SHELF AS THEIRS', (await row.count()) === 1 &&
     /NIGHT BUS/.test(await row.innerText()) && /№01/.test(await row.innerText()) && /edited by Dee/.test(await row.innerText()) &&
     /nightbus\.org/.test(await row.innerText()) && /Saddle-stitch/.test(await row.innerText()), await row.innerText().catch(() => 'no row'));
  const st = await K.store();
  ok('WITHOUT TOUCHING THE SCENE\'S OWN ISSUES OR ROSTER', st.issues.length === 0 && st.distro.length === 1 && st.distro[0].zine === 'NIGHT BUS' &&
     st.distro[0].people.map(p => p.name).join() === 'Dee' && st.zine === 'SPLIT LIP' &&
     (await page.evaluate(() => JSON.parse(localStorage.getItem('stoop_people')).map(p => p.name).join())) === 'me' &&
     (await page.locator('#authorname').innerText()) === 'me');
  ok('and brought its photographs', (await K.photosKept()) === before + 1, (await K.photosKept()) + ' kept');

  await page.click('[data-readcarried]');
  await page.waitForTimeout(400);
  const meta = await page.locator('#distroreader.on .read-meta').innerText();
  ok('IT READS, UNDER ITS OWN NAME AND EDITOR', /NIGHT BUS · №01 · .* · edited by Dee/.test(meta) &&
     (await page.locator('#distroreader .panel img.panel-photo, #distroreader .panel .el-photo img').count()) >= 1, meta);
  const [pdl] = await Promise.all([page.waitForEvent('download'), page.click('[data-pdfcarried]')]);
  const pdf = fs.readFileSync(await pdl.path(), 'latin1');
  ok('AND PRINTS IN ITS OWN FORMAT, NOT THE SHELF\'S', /^%PDF-1\.4/.test(pdf) && (pdf.match(/\/Type\/Page\/Parent/g) || []).length === 4 &&
     /\/MediaBox\[0 0 792\.00 612\.00\]/.test(pdf) && /nightbus\.org/.test(pdf) && pdl.suggestedFilename() === 'nightbus-org-01.pdf',
     (pdf.match(/\/Type\/Page\/Parent/g) || []).length + ' pages, ' + pdl.suggestedFilename());

  // ---- the site carries it; the feed and the catalogue do not.
  await K.go('#desk');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(300);
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  await K.go('#shelf');
  const [sdl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sitebtn')]);
  const { out, errors } = unzip(fs.readFileSync(await sdl.path()));
  const names = Object.keys(out).sort();
  const root = names[0].split('/')[0] + '/';
  const carried = (out[root + 'distro/nightbus-org/01/index.html'] || Buffer.alloc(0)).toString('utf8');
  ok('THE SITE CARRIES THE DISTRO, EACH ZINE AS ITS OWN SCENE\'S FILE', errors.length === 0 &&
     !!out[root + 'distro/index.html'] && /"zine":"NIGHT BUS"/.test(carried) && /"read":"01"/.test(carried) &&
     /"name":"Dee"/.test(carried) && /"address":"nightbus.org"/.test(carried) &&
     !/SPLIT LIP/.test((carried.match(/<script[^>]*id="stoop-seed"[^>]*>([\s\S]*?)<\/script>/) || ['', ''])[1]) &&
     (out[root + 'distro/nightbus-org/01/sheet.pdf'] || Buffer.alloc(0)).toString('latin1', 0, 5) === '%PDF-',
     errors[0] || names.join(', '));
  const listing = (out[root + 'distro/index.html'] || Buffer.alloc(0)).toString('utf8');
  ok('with a page saying who made each and where it lives', /NIGHT BUS №01/.test(listing) && /edited by Dee/.test(listing) &&
     /lives at nightbus\.org/.test(listing) && /href="nightbus-org\/01\/"/.test(listing) && !/href="https?:/.test(listing));
  ok('and its card names its own scene', /"isPartOf":\{"@type":"Periodical","name":"NIGHT BUS"/.test(carried) &&
     /"editor":\{"@type":"Person","name":"Dee"\}/.test(carried) && /"url":"https:\/\/nightbus\.org\/01\/"/.test(carried));
  const feed = (out[root + 'feed.xml'] || Buffer.alloc(0)).toString('utf8');
  const csv = (out[root + 'catalog.csv'] || Buffer.alloc(0)).toString('utf8');
  ok('THE FEED AND THE CATALOGUE ARE THIS SCENE\'S ALONE', feed.split('<entry>').length - 1 === 1 && !/NIGHT BUS/.test(feed) &&
     csv.trim().split('\r\n').length === 2 && !/NIGHT BUS/.test(csv) && /SPLIT LIP/.test(csv));
  ok('the README says where the distro is', /distro\//.test((out[root + 'README.txt'] || '').toString()));

  // ---- the backup carries it, and dropping it sweeps what it brought.
  const [bdl] = await Promise.all([page.waitForEvent('download'), (async () => { await K.go('#backup'); await page.click('#exportbtn'); })()]);
  const backup = JSON.parse(fs.readFileSync(await bdl.path(), 'utf8'));
  ok('a backup carries the distro, photographs and all', backup.distro.length === 1 && backup.distro[0].zine === 'NIGHT BUS' &&
     Object.keys(backup.photos).length >= 1);
  await K.go('#shelf');
  await page.click('[data-dropcarried]');
  await page.waitForTimeout(7200);
  ok('DROP TAKES IT OFF THE SHELF AND SWEEPS ITS PHOTOGRAPHS', (await page.locator('#distrolist .shelf-row').count()) === 0 &&
     (await K.store()).distro.length === 0 && (await K.photosKept()) === before, (await K.photosKept()) + ' kept');
  ok('no script errors carrying', K.errs.length === 0, K.errs.slice(0, 3).join(' | '));
  await K.ctx.close();
};
