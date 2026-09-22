const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? '' : data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(9376, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    await page.goto('http://127.0.0.1:9376/?intro=0');
    await page.waitForFunction(() => window.__poly?.state.ready);
    await page.evaluate(() => {
      const g = __poly;
      g.timers.forEach(clearTimeout); g._stopRecordedVoice?.(); g._guideGreeted = true;
      g.narrate = text => {
        window.narratedAt = performance.now();
        g.prepareNarratorReveal(text); g.setState({ wordReveal: 'complete' });
      };
    });
    const go = async screen => page.evaluate(screen => {
      window.narratedAt = null; window.enteredAt = performance.now();
      __poly.setState({ k: screen - 1 }); __poly.runStep(screen - 1, false);
    }, screen);
    for (const [from, to] of [[31, 32], [33, 34], [35, 36], [34, 33]]) {
      await go(from); await page.waitForTimeout(1450);
      await go(to); await page.waitForTimeout(180);
      assert(await page.evaluate(() => !__poly.state.storyDialogue && window.narratedAt === null), `${from} → ${to}: dialogue waits during movement`);
      await page.waitForTimeout(1120);
      assert(await page.evaluate(() => __poly.state.storyDialogue && window.narratedAt - window.enteredAt >= 900), `${from} → ${to}: narration follows arrival`);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await go(31); await page.waitForTimeout(100);
    await go(32); await page.waitForTimeout(100);
    assert(await page.evaluate(() => __poly.state.storyDialogue && window.narratedAt !== null && window.narratedAt - window.enteredAt < 300), 'Reduced motion skips the travel delay');
    console.log('PASS comparison entry/exit, backward navigation, left-lane return, and reduced-motion dialogue timing.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
