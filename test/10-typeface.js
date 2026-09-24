// The page and the paper share their faces. The press carries Anton for its
// headlines and Knewave for its marker inside itself, as WOFF, and hands them
// to the PDF unpacked, so a line on screen and the same line on paper are set
// from the same outlines and the same advances. This suite checks the three
// places that can drift, for both faces: the bytes (every table in the PDF's
// font is the table the page carries), the widths (the screen's ruler and the
// PDF's /Widths agree), and the baseline (the writer puts the first line
// where the browser does).
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const FONTS = path.resolve(__dirname, '..', 'src', 'fonts');

// A WOFF's tables, unpacked, by tag.
function woffTables(buf) {
  const n = buf.readUInt16BE(12);
  const out = {};
  for (let i = 0; i < n; i++) {
    const at = 44 + i * 20;
    const tag = buf.toString('latin1', at, at + 4);
    const off = buf.readUInt32BE(at + 4), comp = buf.readUInt32BE(at + 8), orig = buf.readUInt32BE(at + 12);
    const raw = buf.subarray(off, off + comp);
    out[tag] = comp < orig ? zlib.inflateSync(raw) : raw;
  }
  return out;
}

// A TrueType file's tables, by tag.
function sfntTables(buf) {
  const n = buf.readUInt16BE(4);
  const out = {};
  for (let i = 0; i < n; i++) {
    const at = 12 + i * 16;
    out[buf.toString('latin1', at, at + 4)] = buf.subarray(buf.readUInt32BE(at + 8), buf.readUInt32BE(at + 8) + buf.readUInt32BE(at + 12));
  }
  return out;
}

function metrics(t) {
  return { upm: t.head.readUInt16BE(18), ascent: t.hhea.readInt16BE(4), descent: t.hhea.readInt16BE(6) };
}

const SUBS = { '—': 0x97, '–': 0x96, '‘': 0x91, '’': 0x92, '“': 0x93,
  '”': 0x94, '•': 0x95, '…': 0x85, '№': 0x80 };
function pdfWidth(widths, text, size) {
  let total = 0;
  for (const ch of text) {
    const code = SUBS[ch] || ch.charCodeAt(0);
    total += widths[code - 32] / 1000 * size;
  }
  return total;
}

module.exports = async function typeface(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(300); };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stoop-face-'));
  const faces = {
    Anton: woffTables(fs.readFileSync(path.join(FONTS, 'anton-press.woff'))),
    Knewave: woffTables(fs.readFileSync(path.join(FONTS, 'knewave-press.woff')))
  };

  await page.goto(APP);
  await page.waitForTimeout(700);

  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load('20px Knewave');
    return document.fonts.check('20px Anton') && document.fonts.check('20px Knewave');
  });
  ok('THE PAGE CARRIES BOTH ITS FACES, AND THE BROWSER HAS THEM', loaded);

  // Where the browser puts the first baseline at line-height 1, against the
  // writer's formula: half the leading, then an ascent down.
  for (const family of ['Anton', 'Knewave']) {
    const probe = await page.evaluate((family) => {
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;top:0;left:0;font:100px/1 ' + family + ';';
      d.innerHTML = 'Head<span style="display:inline-block;height:0;vertical-align:baseline"></span>';
      document.body.appendChild(d);
      const y = d.lastChild.offsetTop - d.offsetTop;
      d.remove();
      return y;
    }, family);
    const m = metrics(faces[family]);
    const content = (m.ascent - m.descent) / m.upm;
    const expected = 100 * ((1 - content) / 2 + m.ascent / m.upm);
    ok('THE FIRST BASELINE OF ' + family.toUpperCase() + ' SITS WHERE THE WRITER SAYS IT DOES',
       Math.abs(probe - expected) <= 1.5, `browser ${probe}px, formula ${expected.toFixed(1)}px`);
  }

  // A headline on the cover and a marker cutting, then the sheet as a PDF.
  await go('#desk');
  await page.fill('#piecetitle', 'The Seam');
  await page.fill('#piecebody', 'Orange behind you — white ahead. “Everybody” walked the orange way…');
  await page.click('#piecesubmitbtn');
  await page.waitForTimeout(250);
  await page.click('#compileissuebtn');
  await page.waitForTimeout(600);
  await go('#press');
  const p3 = page.locator('[data-page="3"]');
  await p3.scrollIntoViewIfNeeded();
  await p3.click({ position: { x: 6, y: 6 } });
  await page.click('[data-addel="text"]');
  await page.waitForTimeout(200);
  await page.click('[data-elvoice]');
  await page.click('[data-elvoice]');
  await page.fill('#ransomtext', 'ask Dee');
  await page.waitForTimeout(300);
  await go('#paper');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfzinebtn')]);
  const file = path.join(dir, 'issue.pdf');
  await dl.saveAs(file);
  const pdf = fs.readFileSync(file);
  const s = pdf.toString('latin1');

  // The bytes: each embedded font file unpacks to the tables the page carries.
  const embedded = [];
  const re = /\/Length1 (\d+)\/Filter\/FlateDecode\/Length (\d+)>>\s*stream\r?\n/g;
  let mm;
  while ((mm = re.exec(s))) {
    const start = mm.index + mm[0].length;
    embedded.push(sfntTables(zlib.inflateSync(pdf.subarray(start, start + Number(mm[2])))));
  }
  const same = (a, b) => Object.keys(b).every(tag => a[tag] && a[tag].equals(b[tag])) && Object.keys(a).length === Object.keys(b).length;
  ok('THE FONTS IN THE PDF ARE THE FONTS IN THE PAGE, TABLE FOR TABLE',
     embedded.length === 2 && embedded.some(t => same(t, faces.Anton)) && embedded.some(t => same(t, faces.Knewave)),
     embedded.length + ' embedded');
  ok('declared as embedded TrueType subsets, Anton with its №',
     /\/BaseFont\/STOOPP\+Anton\/FirstChar 32\/LastChar 255\/Widths\[/.test(s) &&
     /\/BaseFont\/STOOPM\+Knewave\/FirstChar 32\/LastChar 255\/Widths\[/.test(s) &&
     /\/Differences\[128\/numero\]/.test(s));
  ok('the cover headline is set in Anton as F7', /\/F7 \d+ 0 R/.test(s) && /\/F7 [\d.]+ Tf[^\n]*\(THE SEAM\) Tj/.test(s));
  ok('THE MARKER IS SET IN KNEWAVE AS F8, ON PAPER AS ON SCREEN',
     /\/F8 \d+ 0 R/.test(s) && /\/F8 [\d.]+ Tf[^\n]*\((ask|Dee)\) Tj/.test(s));
  ok('the issue number on paper is № in the face, not "No."',
     /\/F7 [\d.]+ Tf[^\n]*\(\x8001\) Tj/.test(s) && !/\(No\.01\) Tj/.test(s));

  // The widths: the screen's ruler against each face's /Widths.
  for (const [family, base, samples] of [
    ['Anton', 'STOOPP\\+Anton', ['THE SEAM', 'NIGHT BUS №01', 'ORANGE — WHITE “AHEAD”…', 'Wavy quoted ‘thing’ • 34']],
    ['Knewave', 'STOOPM\\+Knewave', ['ask Dee', 'the 4am bus — a rumour…', '“Quoted” and ‘quoted’ • 42']]
  ]) {
    const wm = new RegExp('/BaseFont/' + base + '/FirstChar 32/LastChar 255/Widths\\[([^\\]]+)\\]').exec(s);
    const widths = wm ? wm[1].trim().split(/\s+/).map(Number) : [];
    const screen = await page.evaluate(({ family, samples }) => {
      const c = document.createElement('canvas').getContext('2d');
      c.font = '100px ' + family;
      return samples.map(t => c.measureText(t).width);
    }, { family, samples });
    const drift = samples.map((t, i) => Math.abs(screen[i] - pdfWidth(widths, t, 100)) / screen[i]);
    ok('THE SCREEN AND THE PDF MEASURE ' + family.toUpperCase() + ' THE SAME',
       widths.length === 224 && drift.every(d => d < 0.01), 'drift ' + drift.map(d => (d * 100).toFixed(2) + '%').join(', '));
  }

  // The faces ride inside the handed-on issue.
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  const [hdl] = await Promise.all([page.waitForEvent('download'), page.click('#handonbtn')]);
  const handed = fs.readFileSync(await hdl.path(), 'utf8');
  ok('THE HANDED-ON ISSUE CARRIES BOTH FACES WITH IT',
     /@font-face\{font-family:Anton;[^}]*data:font\/woff;base64,/.test(handed) &&
     /@font-face\{font-family:Knewave;[^}]*data:font\/woff;base64,/.test(handed));

  ok('no script errors around the typefaces', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
