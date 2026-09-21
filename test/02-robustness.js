// The states a notebook actually reaches after a year: storage half-eaten, a
// backup from an older version, a photo that did not come across, everything
// deleted. None of them may cost the user their words.
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function robustness(browser, ok) {
  // A context seeded with whatever localStorage we want to simulate.
  async function withSeed(seed) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    if (seed) {
      await page.goto(APP);
      await page.evaluate(seed);
    }
    await page.goto(APP);
    await page.waitForTimeout(800);
    return { page, errs, ctx };
  }
  const go = async (page, hash) => {
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForTimeout(300);
  };

  {
    const { page, errs, ctx } = await withSeed(() => localStorage.setItem('stoop_data_v3', '{not json at all'));
    await go(page, '#press');
    ok('corrupt storage falls back to a blank press, not a blank screen',
       (await page.locator('#sheetzone .panel').count()) === 8 && errs.length === 0);
    await ctx.close();
  }

  {
    const { page, errs, ctx } = await withSeed(() => localStorage.setItem('stoop_data_v3', JSON.stringify({
      logs: [{ id: 'x', author: 'a', tag: 'moment', text: 'lonely', ts: Date.now() }]
    })));
    await go(page, '#projects');
    const projects = await page.locator('#projectlist').innerText();
    await go(page, '#journal');
    const journal = await page.locator('#journallist').innerText();
    ok('a backup missing whole collections renders empty states',
       /No active projects/.test(projects) && /No journal entries/.test(journal) && errs.length === 0);
    await ctx.close();
  }

  {
    const { page, errs, ctx } = await withSeed(() => {
      localStorage.removeItem('stoop_data_v3');
      localStorage.setItem('stoop_data_v2', JSON.stringify({
        logs: [{ id: 'o1', author: 'Together', tag: 'idea', text: 'legacy joint note', time: 'Aug 24 · 4:30 PM' },
               { id: 'o2', author: 'Suds', tag: 'moment', text: 'legacy solo note', time: 'Aug 24 · 5:00 PM' }],
        projects: [{ id: 'op', title: 'legacy project', desc: 'from a v2 file' }],
        journal: []
      }));
    });
    await go(page, '#log');
    await page.click('[data-logfilter="both"]');
    await page.waitForTimeout(250);
    ok('a v2 "Together" entry migrates and stays filterable',
       (await page.locator('.log-card').count()) === 1 &&
       /legacy joint/.test(await page.locator('#loglist').innerText()));
    await go(page, '#projects');
    ok('a v2 entry survives the upgrade', /legacy project/.test(await page.locator('#projectlist').innerText()));
    ok('the v2 upgrade throws nothing', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  {
    const { page, errs, ctx } = await withSeed(() => localStorage.setItem('stoop_data_v3', JSON.stringify({
      logs: [{ id: 'g1', author: 'a', tag: 'photo', text: 'caption without its picture', photo: 'ph_missing', ts: Date.now() }],
      projects: [], journal: [],
      press: { format: 'fold8', hand: 'A', issue: '01', ts: 1, panels: Array.from({ length: 8 }, () => ({ h: 'H', body: 'B', photo: 'ph_missing' })) }
    })));
    const logImgs = await page.locator('.log-photo').count();
    const text = await page.locator('#loglist').innerText();
    await go(page, '#press');
    ok('photo references with no blob degrade to text',
       logImgs === 0 && (await page.locator('.panel-photo').count()) === 0 &&
       /caption without/.test(text) && errs.length === 0);
    await ctx.close();
  }

  {
    const { page, errs, ctx } = await withSeed(null);
    await go(page, '#log');
    for (let i = 0; i < 8; i++) {
      if (!(await page.locator('[data-dellog]').count())) break;
      await page.locator('[data-dellog]').first().click();
      await page.waitForTimeout(120);
    }
    const empty = await page.locator('#loglist').innerText();
    await page.fill('#loginput', 'back from empty');
    await page.click('#logaddbtn');
    await page.waitForTimeout(250);
    ok('an emptied log shows a state and still accepts posts',
       /Nothing here yet/.test(empty) && (await page.locator('.log-card').count()) === 1 && errs.length === 0);
    await ctx.close();
  }

  // The sheet merges by its stamp like every other record: newer wins, and an
  // older backup imported afterwards cannot walk it back.
  {
    const sheet = (issue, ts, label) => ({
      version: 4, logs: [], projects: [], journal: [], pieces: [], issues: [], photos: {},
      press: { format: 'fold8', hand: 'A', issue, ts, panels: Array.from({ length: 8 }, () => ({ h: label, body: label, photo: null })) }
    });
    const older = path.join(os.tmpdir(), 'stoop-older.json');
    const newer = path.join(os.tmpdir(), 'stoop-newer.json');
    fs.writeFileSync(older, JSON.stringify(sheet('99', 1000, 'OLD')));
    fs.writeFileSync(newer, JSON.stringify(sheet('42', 9e14, 'NEW')));

    const { page, errs, ctx } = await withSeed(null);
    const mergeFile = async (f) => {
      await go(page, '#backup');
      await page.click('#mergebtn');
      await page.setInputFiles('#importfile', f);
      await page.waitForTimeout(700);
    };
    const issue = async () => { await go(page, '#press'); return (await page.locator('#issueno').innerText()).trim(); };
    await mergeFile(older); await issue();
    await mergeFile(newer);
    const afterNewer = await issue();
    await mergeFile(older);
    const afterOlderAgain = await issue();
    ok('the newer sheet wins and an older one cannot clobber it',
       afterNewer === '42' && afterOlderAgain === '42',
       JSON.stringify({ afterNewer, afterOlderAgain }));
    ok('merging a sheet throws nothing', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  {
    const { page, ctx } = await withSeed(null);
    const leaked = await page.evaluate(() =>
      ['state', 'names', 'importBackup', 'compileZine', 'photoCache', 'renderAll', 'PRESET_A']
        .filter(k => k in window));
    ok('the bundle leaks no globals', leaked.length === 0, leaked.join(',') || 'none');
    await ctx.close();
  }

  // A phone is where the photos come from, so the page must not scroll sideways.
  {
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 851 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(APP);
    await page.waitForTimeout(600);
    const pressOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await go(page, '#notebook');
    const drawerOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok('no sideways scroll on a phone, pages or drawer', !pressOverflow && !drawerOverflow && errs.length === 0,
       JSON.stringify({ pressOverflow, drawerOverflow }));
    await ctx.close();
  }
};
