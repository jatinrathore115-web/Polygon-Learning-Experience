const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? '' : data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(9377, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:9377/?intro=0');
    await page.waitForFunction(() => window.__poly?.state.ready);
    await page.evaluate(() => {
      __poly.timers.forEach(clearTimeout); __poly._stopRecordedVoice?.();
      __poly._guideGreeted = true; __poly.narrate = () => {};
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    const setup = async (screen, patch = {}) => {
      await page.evaluate(({ screen, patch }) => {
        const g = __poly; g.setState({ k: screen - 1 }); g.runStep(screen - 1, false);
        g.timers.forEach(clearTimeout); g._nudgeToken = (g._nudgeToken || 0) + 1;
        g._voiceLocked = false;
        g.setState({ interactive: true, storyContent: true, storyControls: true, speaking: false, ocWords: { open:true, closed:true },
          magicReveal: false, boundaryTravel: false, polygonTravel: false, checked: false,
          sortAt: {}, pickedFig: null, chip: null, placed: {}, sel: [], ok: null, nudge: null, showHand: false, ...patch });
      }, { screen, patch });
      await page.clock.fastForward(1200); // Let the content and controls settle first.
      await page.evaluate(() => __poly.armNudge());
    };
    const shown = () => page.evaluate(() => !!(__poly.state.nudge || __poly.state.showHand));
    const aligned = () => page.evaluate(() => {
      const g = __poly, box = document.querySelector('.story-surface');
      const target = [...box.querySelectorAll('[data-nudge="1"]')].find(e => e.getAttribute('aria-disabled') !== 'true' && getComputedStyle(e).pointerEvents !== 'none');
      if (!target || !g.state.nudge) return false;
      const b = target.getBoundingClientRect(), p = box.getBoundingClientRect(), scale = p.width / box.offsetWidth;
      return Math.abs(p.left + g.state.nudge.x * scale - b.left - b.width / 2) < 1 &&
        Math.abs(p.top + g.state.nudge.y * scale - b.top - b.height / 2) < 1;
    });
    const screens = await page.evaluate(() => __poly.steps().flatMap((s, i) => s.q ? [i + 1] : []));
    for (const screen of screens) {
      await setup(screen);
      await page.clock.fastForward(7999); assert(!await shown(), `Screen ${screen}: no early hint`);
      await page.clock.fastForward(1); assert(await shown(), `Screen ${screen}: hint at eight seconds`);
      if (screen !== 27) assert(await aligned(), `Screen ${screen}: hand points to the target`);
      await page.evaluate(() => __poly.clearNudge()); assert(!await shown(), 'Activity clears the hint');
    }
    for (const [screen, patch, selector] of [
      [23, { chip: 'Vertex' }, '[data-label-target="vertex"]'],
      [43, { pickedFig: 1 }, '[data-nudge="1"]'],
      [45, { sel: [0, 1, 3] }, '[data-nudge="1"]'],
      [19, { sel: [1] }, '[data-nudge="1"]']
    ]) {
      await setup(screen, patch); await page.clock.fastForward(8000);
      assert(await shown() && await aligned(), `Screen ${screen}: next-step hint`);
      assert.equal(await page.locator(selector).first().getAttribute('data-nudge'), '1');
      if (screen === 45) assert.equal((await page.locator(selector).first().innerText()).trim(), 'Check');
    }
    await setup(19); await page.clock.fastForward(8000); await page.clock.fastForward(2900);
    assert(!await shown(), 'Hint ends after two gentle taps');
    await page.clock.fastForward(7999); assert(!await shown(), 'Repeat leaves eight seconds of quiet');
    await page.clock.fastForward(1); assert(await shown(), 'Hint repeats if still idle');
    await setup(43, { sortAt: { 0: 0, 1: 1 } }); await page.clock.fastForward(8000);
    assert(!await shown(), 'Selection cap prevents more hints');
    await setup(19, { speaking: true }); await page.clock.fastForward(8000);
    assert(!await shown(), 'No hint during narration');
    await setup(19); await page.evaluate(() => { __poly._sortDragCleanup = () => {}; });
    await page.clock.fastForward(8000); assert(!await shown(), 'No hint during a drag');
    await page.evaluate(() => { __poly._sortDragCleanup = null; });
    await setup(19); await page.evaluate(() => { __poly.gen++; });
    await page.clock.fastForward(8000); assert(!await shown(), 'Old screen timers cannot show a hint');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(19); await page.clock.fastForward(8000);
    assert.equal(await page.locator('.idle-hand').last().evaluate(e => getComputedStyle(e).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await setup(19);
    await new Promise(resolve => setTimeout(resolve, 1200)); // CSS entrance motion uses the real render clock.
    await page.clock.fastForward(8000);
    assert.equal(await page.locator('.idle-hand').last().evaluate(e => getComputedStyle(e).animationName), 'nudgeTap');
    await page.locator('[data-nudge="1"]').first().click();
    assert(!await shown(), 'An actual option tap immediately removes the hand');
    await page.clock.fastForward(7999); assert(!await shown(), 'The next option gets a fresh eight-second interval');
    await page.clock.fastForward(1); assert(await shown() && await aligned(), 'The next correct option receives the hint');
    await page.setViewportSize({ width: 1024, height: 768 });
    await setup(24, { cnt: [5, 4] }); await new Promise(resolve => setTimeout(resolve, 1200));
    await page.clock.fastForward(8000); assert(await aligned(), 'Tablet-sized Check target remains aligned');
    console.log(`PASS ${screens.length} interactive screens: eight-second timing, target alignment, next-step hints, activity reset, repeat, completion/voice/drag guards, navigation cancellation, and reduced motion.`);
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
