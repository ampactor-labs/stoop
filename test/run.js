// The browser suites. check.sh enforces the laws about the file; these prove
// the app behaves, which no amount of grepping can. Optional by design: they
// need Playwright and a browser, and check.sh stays instant and dependency
// free so the pre-commit hook can run on every commit.
//
//   npm install playwright && node test/run.js
//
// PLAYWRIGHT_CHROMIUM overrides the browser binary when the installed
// Playwright and the available Chromium are different builds.
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.error('These suites need Playwright:\n\n    npm install playwright\n');
  process.exit(2);
}

const suites = [
  ['features', require('./01-features.js')],
  ['robustness', require('./02-robustness.js')],
  ['publication', require('./03-publication.js')],
  ['self-carrying issue', require('./04-selfcarry.js')],
  ['qr', require('./05-qr.js')],
  ['pdf', require('./06-pdf.js')],
  ['a scene of four', require('./07-scene.js')],
  ['weight', require('./08-weight.js')],
  ['paste-up', require('./09-pasteup.js')],
  ['typeface', require('./10-typeface.js')],
  ['edges', require('./11-edges.js')],
  ['the loop', require('./12-loop.js')],
  ['pages as made', require('./13-pages.js')],
  ['the site', require('./14-site.js')],
  ['making things', require('./15-craft.js')]
];

(async () => {
  const launch = {};
  if (process.env.PLAYWRIGHT_CHROMIUM) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM;

  let browser;
  try {
    browser = await chromium.launch(launch);
  } catch (e) {
    console.error('Could not start Chromium: ' + e.message);
    console.error('Install one with `npx playwright install chromium`, or point');
    console.error('PLAYWRIGHT_CHROMIUM at an existing binary.');
    process.exit(2);
  }

  const results = [];
  for (const [name, suite] of suites) {
    console.log('\n' + name);
    const ok = (label, passed, detail) => {
      results.push({ passed });
      console.log('  ' + (passed ? 'PASS' : 'FAIL') + '  ' + label + (detail ? '   [' + detail + ']' : ''));
    };
    try {
      await suite(browser, ok);
    } catch (e) {
      ok(name + ' suite crashed', false, e.message);
    }
  }

  await browser.close();
  const failed = results.filter(r => !r.passed).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
