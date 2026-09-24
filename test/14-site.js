// The site. Every back cover's code points at <address>/<no>/, and this is
// the folder that makes it land: each issue as the page its code leads to, a
// printer's PDF beside it, the newest at the root. The zip is read back with
// node's own zlib, entry by entry, because a hand-written archive either
// opens everywhere or is a file somebody cannot open.
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

function unzip(buf) {
  const out = {};
  const errors = [];
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) return { out, errors: ['no end record'] };
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) { errors.push('central entry ' + i + ' misplaced'); break; }
    const method = buf.readUInt16LE(at + 10);
    const crc = buf.readUInt32LE(at + 16);
    const csize = buf.readUInt32LE(at + 20);
    const size = buf.readUInt32LE(at + 24);
    const nlen = buf.readUInt16LE(at + 28);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nlen);
    if (buf.readUInt32LE(local) !== 0x04034b50) errors.push(name + ': local header misplaced');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    if (data.length !== size) errors.push(name + ': size ' + data.length + ' not ' + size);
    if ((zlib.crc32(data) >>> 0) !== crc) errors.push(name + ': crc mismatch');
    out[name] = data;
    at += 46 + nlen;
  }
  return { out, errors };
}

module.exports = async function site(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(280); };
  await page.goto(APP);
  await page.waitForTimeout(700);

  await go('#backup');
  await page.fill('#zinename', 'NIGHT BUS');
  await page.fill('#addressinput', 'nightbus.neocities.org');
  await page.click('#savenamesbtn2');
  await page.waitForTimeout(200);
  for (let n = 0; n < 2; n++) {
    await go('#desk');
    await page.click('#compileissuebtn');
    await page.waitForTimeout(300);
    await page.click('#buildissuebtn');
    await page.waitForTimeout(500);
  }

  await go('#shelf');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sitebtn')]);
  ok('the site downloads as one zip named for the scene', dl.suggestedFilename() === 'nightbus-neocities-org-site.zip' ||
     /-site\.zip$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const buf = fs.readFileSync(await dl.path());
  const { out, errors } = unzip(buf);
  const names = Object.keys(out).sort();
  const root = names[0].split('/')[0] + '/';
  ok('EVERY ENTRY OPENS AND CHECKS OUT', errors.length === 0 && names.length === 7, errors[0] || names.join(', '));
  ok('THE NEWEST IS THE FRONT DOOR, AND AT latest/',
     !!out[root + 'index.html'] && out[root + 'index.html'].equals(out[root + 'latest/index.html']) &&
     /"read":"02"/.test(out[root + 'index.html'].toString('utf8')));
  ok('EACH ISSUE IS AT THE ADDRESS ITS CODE POINTS AT',
     /"read":"01"/.test((out[root + '01/index.html'] || '').toString()) &&
     /"read":"02"/.test((out[root + '02/index.html'] || '').toString()));
  ok('with a printer\'s PDF beside it', ['01', '02'].every(n => (out[root + n + '/sheet.pdf'] || Buffer.alloc(0))
     .toString('latin1', 0, 8) === '%PDF-1.4'));
  const readme = (out[root + 'README.txt'] || '').toString();
  ok('and a note on where to put it', /nightbus\.neocities\.org\/01\//.test(readme), readme.split('\n').slice(-3).join(' '));
  ok('the pages name no host of their own', !/(src|href)="https?:/.test(out[root + '02/index.html'].toString()));
  ok('smaller than the files it holds', buf.length < names.reduce((a, n) => a + out[n].length, 0) * 0.7,
     Math.round(buf.length / 1024) + ' KB zipped');

  // The front door opened from the unzipped folder is the newest issue.
  const unz = fs.mkdtempSync(path.join(require('os').tmpdir(), 'stoop-site-'));
  for (const n of names) {
    fs.mkdirSync(path.join(unz, path.dirname(n)), { recursive: true });
    fs.writeFileSync(path.join(unz, n), out[n]);
  }
  const reader = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await reader.goto('file://' + path.join(unz, root, 'index.html'));
  await reader.waitForTimeout(900);
  ok('OPENED FROM THE FOLDER, THE FRONT DOOR IS №02', /№02/.test(await reader.locator('#landing .read-meta').innerText()),
     await reader.locator('#landing .read-meta').innerText());
  ok('no script errors making the site', errs.length === 0, errs.slice(0, 3).join(' | '));
  await reader.context().close();
  await ctx.close();
};
