// The catalogue card. Six elements read off the issue and six typed once at
// the desk; the typed ones survive the bell and reappear on the next issue.
// The card prints as a colophon, rides in the file's head as JSON-LD, goes
// to the site as an Atom feed and a catalogue with a cover beside each
// issue, and the back cover carries a line that opens the press at the
// piece form for whoever types it in.
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
  const answers = [];
  const asked = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', async d => {
    asked.push(d.message());
    const a = answers.shift();
    if (a === false) await d.dismiss();
    else await d.accept(typeof a === 'string' ? a : undefined);
  });
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('stoop_data_v4')));
  const toastText = () => page.evaluate(() => {
    const t = document.getElementById('toast');
    return t && t.style.display !== 'none' ? t.innerText : '';
  });
  return { ctx, page, errs, answers, asked, go, store, toastText };
}

module.exports = async function card(browser, ok) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-card-'));
  const E = await open(browser);
  const page = E.page;
  await page.goto(APP);
  await page.waitForTimeout(700);

  await E.go('#backup');
  await page.fill('#zinename', 'NIGHT BUS');
  await page.fill('#addressinput', 'nightbus.org');
  await page.click('#savenamesbtn2');
  await page.fill('#newperson', 'Dee');
  await page.click('#addpersonbtn');
  await page.waitForTimeout(200);
  await E.go('#scraps');
  await page.setInputFiles('#photofile', photoFile());
  await page.waitForTimeout(1500);

  // ---- the desk: the derived line and the typed six.
  await E.go('#desk');
  const derived = await page.locator('#cardderived').innerText();
  ok('THE CARD READS THE TITLE, THE EDITOR, THE PUBLISHER, THE DATE AND THE PAPER OFF THE ISSUE',
     /^NIGHT BUS №01 · edited by me · NIGHT BUS · \d{4}-\d\d-\d\d · 2\.75 × 4\.25 in, 8 pages, one sheet folded and cut\.$/.test(derived), derived);
  await page.fill('#card-place', 'Oakland');
  await page.fill('#card-language', 'English');
  await page.fill('#card-subjects', 'night buses, the 800');
  await page.fill('#card-rights', 'Copy it, credit it');
  await page.fill('#card-seeAlso', 'the 51A zine');
  await page.click('#savecardbtn');
  await page.waitForTimeout(200);
  const kept = (await E.store()).card;
  ok('THE TYPED SIX ARE KEPT', kept.place === 'Oakland' && kept.subjects === 'night buses, the 800' && kept.rights === 'Copy it, credit it' &&
     !('unionId' in kept), JSON.stringify(kept));

  // A piece by the other person, so the creators are two.
  await page.click('#authortoggle');
  await page.fill('#piecetitle', 'The 800 at 3am');
  await page.fill('#piecebody', 'Nobody on it but the driver and me and a man with a ladder.');
  await page.click('#piecesubmitbtn');
  await page.click('#authortoggle');
  await page.click('#authortoggle');
  await page.click('#authortoggle');
  await page.waitForTimeout(200);
  await page.click('#compileissuebtn');
  await page.waitForTimeout(500);
  ok('and the creators are whoever wrote', /edited by me, words by Dee/.test(await page.locator('#cardderived').innerText()),
     await page.locator('#cardderived').innerText());

  // ---- the colophon, on the back cover, and the cover photograph.
  await E.go('#press');
  const p1 = page.locator('#sheetzone [data-page="1"]');
  await p1.click({ position: { x: 6, y: 6 } });
  await page.click('#phototray [data-traypic]');
  await page.waitForTimeout(300);
  const p8 = page.locator('#sheetzone [data-page="8"]');
  await p8.scrollIntoViewIfNeeded();
  await p8.click({ position: { x: 6, y: 6 } });
  await page.click('#blockbtn');
  await page.click('[data-block="colophon"]');
  await page.waitForTimeout(300);
  const colophon = await page.locator('#sheetzone [data-page="8"] .el-text .eltext').first().innerText();
  ok('A COLOPHON BLOCK LAYS THE CARD OUT AS A CUTTING',
     /^NIGHT BUS №01\nEdited by me\. Words by Dee\.\nPublished by NIGHT BUS, Oakland, \d{4}-\d\d-\d\d\.\n2\.75 × 4\.25 in, 8 pages, one sheet folded and cut\.\nIn English\. Subjects: night buses, the 800\.\nCopy it, credit it\nSee also: the 51A zine\nnightbus\.org\/01\/\nUnion ID: ________$/.test(colophon), colophon.replace(/\n/g, ' | '));
  const reply = await page.locator('#sheetzone [data-page="8"] .addr .reply').innerText();
  ok('THE BACK COVER SAYS WHERE TO WRITE BACK', reply === 'write back: nightbus.org/01/#reply', reply);

  await E.go('#paper');
  const [pdl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const pdf = fs.readFileSync(await pdl.path(), 'latin1');
  ok('the colophon prints', /\(Union ID: ________\) Tj/.test(pdf) && /\(Published by NIGHT BUS, Oakland, [^)]*\) Tj/.test(pdf));
  ok('and so does the write-back line', /\(write back:\) Tj/.test(pdf) && /\(nightbus\.org\/01\/#reply\) Tj/.test(pdf));

  // ---- the bell: the card goes with the issue, and stays for the next.
  await E.go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  const shelved = (await E.store()).issues[0];
  ok('AT THE BELL THE ISSUE TAKES THE CARD AS TYPED', shelved.card && shelved.card.place === 'Oakland' && shelved.card.subjects === 'night buses, the 800');
  await E.go('#desk');
  ok('AND THE TYPED SIX ARE STILL THERE FOR №02', (await page.inputValue('#card-place')) === 'Oakland' &&
     /^NIGHT BUS №02 · edited by Dee/.test(await page.locator('#cardderived').innerText()), await page.locator('#cardderived').innerText());

  // ---- the file: the card in its head.
  const [idl] = await Promise.all([page.waitForEvent('download'), page.click('#handonbtn')]);
  const issueFile = path.join(dir, 'nightbus-01.html');
  await idl.saveAs(issueFile);
  const html = fs.readFileSync(issueFile, 'utf8');
  const ld = (html.match(/<script type="application\/ld\+json" id="stoop-card">([\s\S]*?)<\/script>/) || ['', ''])[1];
  let rec = null;
  try { rec = JSON.parse(ld); } catch (e) {}
  ok('THE FILE CARRIES THE CARD AS JSON-LD THAT PARSES AND NAMES THE ISSUE', !!rec && rec['@type'] === 'PublicationIssue' &&
     rec.issueNumber === '01' && rec.name === 'NIGHT BUS №01' && rec.isPartOf['@type'] === 'Periodical' && rec.isPartOf.name === 'NIGHT BUS' &&
     rec.url === 'https://nightbus.org/01/' && rec.image === 'https://nightbus.org/01/cover.jpg' && rec.locationCreated.name === 'Oakland' &&
     rec.keywords === 'night buses, the 800' && rec.author.map(a => a.name).join(',') === 'me,Dee' && rec.editor.name === 'me' &&
     rec.numberOfPages === 8 && rec.inLanguage === 'English' && rec.conditionsOfAccess === 'Copy it, credit it' && !('identifier' in rec),
     ld.slice(0, 200));
  ok('and the tags a shared link needs', /<meta property="og:title" content="NIGHT BUS №01"/.test(html) &&
     /<meta property="og:url" content="https:\/\/nightbus\.org\/01\/"/.test(html) &&
     /<meta property="og:image" content="https:\/\/nightbus\.org\/01\/cover\.jpg"/.test(html) &&
     (html.match(/id="stoop-card"/g) || []).length === 1);

  // ---- the site: a feed, a catalogue and a cover beside each issue.
  await page.click('#compileissuebtn');
  await page.waitForTimeout(300);
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  await E.go('#shelf');
  const [sdl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sitebtn')]);
  const { out, errors } = unzip(fs.readFileSync(await sdl.path()));
  const names = Object.keys(out).sort();
  const root = names[0].split('/')[0] + '/';
  const feed = (out[root + 'feed.xml'] || Buffer.alloc(0)).toString('utf8');
  const entries = feed.split('<entry>').length - 1;
  ok('THE SITE CARRIES AN ATOM FEED WITH AN ENTRY PER ISSUE, THE PDF AS ITS ENCLOSURE', errors.length === 0 &&
     /^<\?xml version="1\.0" encoding="utf-8"\?>\n<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/.test(feed) && entries === 2 &&
     /<title>NIGHT BUS<\/title>/.test(feed) && /<id>https:\/\/nightbus\.org\/<\/id>/.test(feed) &&
     /<link rel="alternate" type="text\/html" href="https:\/\/nightbus\.org\/02\/"\/>/.test(feed) &&
     new RegExp('<link rel="enclosure" type="application/pdf" href="https://nightbus\\.org/01/sheet\\.pdf" length="' + out[root + '01/sheet.pdf'].length + '"/>').test(feed) &&
     /<updated>\d{4}-\d\d-\d\dT[\d:.]+Z<\/updated>/.test(feed), errors[0] || feed.slice(0, 300).replace(/\n/g, ' '));
  ok('newest first, and the first entry is №02', /<entry>\n\s*<title>NIGHT BUS №02<\/title>/.test(feed));
  const csv = (out[root + 'catalog.csv'] || Buffer.alloc(0)).toString('utf8');
  const rows = csv.replace(/^﻿/, '').trim().split('\r\n');
  ok('AND A CATALOGUE IN THE TWELVE COLUMNS, ONE ROW PER ISSUE', csv.charCodeAt(0) === 0xfeff &&
     rows[0] === '"Title","Creators","Publisher","Contributors","Date of publication","Physical description","Language","Place of publication","Subjects","See also","Freedoms and restrictions","Union ID"' &&
     rows.length === 3 && /^"NIGHT BUS №01","me; Dee","NIGHT BUS","",".*","2\.75 × 4\.25 in, 8 pages, one sheet folded and cut","English","Oakland","night buses; the 800","the 51A zine","Copy it, credit it",""$/.test(rows[1]),
     rows.join(' | ').slice(0, 400));
  // Both covers carry a photograph: №01 was given one by hand, and pouring
  // №02 put the scene's newest on its cover. 14-site covers the shelf with
  // no photographs, where no cover.jpg is written.
  const jpgs = ['01', '02'].map(n => out[root + n + '/cover.jpg']);
  ok('WITH THE COVER PHOTOGRAPH AS A JPEG BESIDE EACH ISSUE THAT HAS ONE', jpgs.every(j => !!j && j[0] === 0xff && j[1] === 0xd8),
     names.join(', '));
  ok('and each issue page carries its own card', /"issueNumber":"02"/.test(out[root + '02/index.html'].toString()) &&
     /"issueNumber":"01"/.test(out[root + '01/index.html'].toString()));
  ok('no script errors making the card', E.errs.length === 0, E.errs.slice(0, 3).join(' | '));
  await E.ctx.close();

  // ---- the reply: the file at #reply opens on the piece form.
  const R = await open(browser);
  R.answers.push('Dee');
  await R.page.goto('file://' + issueFile + '#reply');
  await R.page.waitForTimeout(1200);
  const where = await R.page.evaluate(() => ({
    drawer: document.body.getAttribute('data-drawer'), landing: document.body.classList.contains('landing'),
    focus: document.activeElement && document.activeElement.id, kind: document.getElementById('piecekind').value,
    who: document.getElementById('authorname').innerText }));
  ok('OPENED AT #reply, THE FILE ASKS WHO IS WRITING AND OPENS THE PRESS ON THE PIECE FORM',
     /Who is writing/.test(R.asked[0] || '') && where.drawer === 'desk' && !where.landing && where.focus === 'piecetitle' &&
     where.kind === 'letters' && where.who === 'Dee', JSON.stringify(where));
  ok('and says what it is for', /Writing back to №01/.test(await R.toastText()), await R.toastText());
  await R.page.fill('#piecetitle', 'Re: the 800');
  await R.page.fill('#piecebody', 'I was the man with the ladder.');
  await R.page.click('#piecesubmitbtn');
  await R.page.waitForTimeout(200);
  const row = R.page.locator('#desktray .sub-row', { hasText: 'Re: the 800' });
  const [rdl] = await Promise.all([R.page.waitForEvent('download'), row.locator('[data-piecebundle]').click()]);
  ok('THE REPLY ENDS AT SEND, SIGNED', /^piece-dee-re-the-800/.test(rdl.suggestedFilename()), rdl.suggestedFilename());
  ok('no script errors replying', R.errs.length === 0, R.errs.slice(0, 3).join(' | '));
  await R.ctx.close();
};
