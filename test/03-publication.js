// The publication loop, which is the whole point: pieces arrive at a desk, an
// editor sequences them, the bell rings, and the issue lands on a shelf that
// still holds the last one. Every assertion here is one of PLAN.md's gates.
const path = require('path');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

module.exports = async function publication(browser, ok) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(250); };
  await page.goto(APP);
  await page.waitForTimeout(600);

  // A cut is a conversation, not a deletion.
  await go('#desk');
  await page.fill('#piecetitle', 'Night Bus');
  await page.fill('#piecebody', 'Walking home past the substation, the hum was in F.');
  await page.click('#piecesubmitbtn');
  await page.waitForTimeout(200);
  ok('a submitted piece lands in the tray', (await page.locator('#desktray .sub-row').count()) === 3);
  await page.click('[data-cutpiece]');
  await page.waitForTimeout(200);
  ok('cutting keeps the piece, struck through', (await page.locator('#desktray .sub-row.cut').count()) === 1);
  await page.click('[data-restorepiece]');
  await page.waitForTimeout(200);
  ok('restoring brings it back', (await page.locator('#desktray .sub-row.cut').count()) === 0);

  // Assembling flows the tray onto the paper.
  await page.fill('#editornote', 'Three pieces. Read it whole, then go knock on somebody.');
  await page.click('#compileissuebtn');
  await page.waitForTimeout(400);
  await go('#press');
  ok('the tray flows onto the sheet',
     /sodium lamps|substation/i.test(await page.locator('#sheetzone').innerText()));

  // The bell: publish, then publish again. Issue one must survive issue two.
  await go('#desk');
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);
  ok('the desk alternates to the other hand',
     /issue №02/.test(await page.locator('#deskhead').innerText()),
     await page.locator('#deskhead').innerText());

  await go('#desk');
  await page.fill('#piecetitle', 'Ten Bikes, Weeks 3-4');
  await page.fill('#piecebody', 'Number five done: new chain, and the rear wheel finally trued.');
  await page.click('#piecesubmitbtn');
  await page.waitForTimeout(200);
  await page.click('#compileissuebtn');
  await page.waitForTimeout(300);
  await page.click('#buildissuebtn');
  await page.waitForTimeout(600);

  const numbers = await page.evaluate(() =>
    [...document.querySelectorAll('.shelf-row .shelf-no')].map(e => e.textContent).join(','));
  ok('TWO ISSUES COEXIST ON THE SHELF', /№01/.test(numbers) && /№02/.test(numbers), numbers);

  // A back issue keeps its own words rather than the current draft's.
  await page.click('[data-readissue="01"]');
  await page.waitForTimeout(400);
  const reading = await page.locator('.reading').innerText();
  ok('the back issue still holds its own pieces', /sodium lamps|substation/i.test(reading));
  ok('the back issue keeps its editor note', /knock on somebody/i.test(reading));
  // The bell rang from the desk, with the press hidden. A hidden sheet read
  // back through innerText loses every line break, and once did.
  ok('THE BACK COVER KEEPS ITS LINE BREAKS THROUGH THE BELL',
     /\n/.test(await page.locator('.reading-foot p').innerText()),
     JSON.stringify((await page.locator('.reading-foot p').innerText()).slice(0, 40)));
  ok('the reading view is the other substrate, unimposed',
     (await page.locator('.reading .panel').count()) === 0);

  // Changing the vessel must not cost a single typed word. Publishing leaves a
  // blank draft behind by design, so there has to be something on the sheet
  // before there is anything to re-flow.
  await go('#desk');
  await page.fill('#piecetitle', 'Side B: Brownouts');
  await page.fill('#piecebody', 'Five tracks, dubbed to tape for whoever asks, links for the rest.');
  await page.click('#piecesubmitbtn');
  await page.waitForTimeout(200);
  await page.click('#compileissuebtn');
  await page.waitForTimeout(400);

  await go('#press');
  const before = await page.locator('[data-page="2"] .body').innerText();
  await page.selectOption('#formatsel', 'saddle16');
  await page.waitForTimeout(600);
  const after = await page.locator('[data-page="2"] .body').innerText();
  ok('saddle-stitch 16pp imposes onto eight sheet sides',
     (await page.locator('#sheetzone .sheet').count()) === 8,
     'sheets ' + await page.locator('#sheetzone .sheet').count());
  ok('THE SAME PIECES RE-FLOW INTO A NEW FORMAT, NOTHING RETYPED',
     before.trim().length > 0 && before.trim() === after.trim());
  await page.selectOption('#formatsel', 'fold8');
  await page.waitForTimeout(500);

  // A press that silently eats a paragraph is not a press.
  await page.evaluate(() => {
    const b = document.querySelector('[data-page="6"] .body');
    b.focus();
    b.innerText = 'overflowing '.repeat(400);
    b.dispatchEvent(new InputEvent('input', { bubbles: true }));
    b.blur();
  });
  await page.waitForTimeout(900);
  ok('THE FIT METER REPORTS WHAT WILL NOT PRINT',
     /will not print/.test(await page.locator('#fitmeter').innerText()),
     await page.locator('#fitmeter').innerText());
  ok('the over-full page is marked on the sheet', (await page.locator('.panel.over').count()) >= 1);

  ok('no script errors anywhere in the loop', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
};
