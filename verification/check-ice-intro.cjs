/* Blizzard intro: storm build-up, layering, input gating, handoff and cleanup.

   The filmstrip pass freezes every intro animation and seeks it, so each frame
   is the exact moment it claims to be rather than whenever a screenshot
   happened to land. Frames go to verification/output/ice-intro/.
   Run: node verification/check-ice-intro.cjs */
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'output', 'ice-intro');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => { res.writeHead(err ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(err ? 'Not found' : data); });
});
const URL_BASE = 'http://127.0.0.1:9352';

/* The beats of the storm, in ms along the intro's own timeline. */
const FRAMES = [
  [80, 'a-dark'], [520, 'b-reveal'], [900, 'c-first-snow'], [1500, 'd-building'],
  [2300, 'e-wind'], [2950, 'f-gust'], [3150, 'g-flash'], [3700, 'h-peak'],
  [4200, 'i-peak-late'], [4800, 'j-settling'], [5450, 'k-handoff']
];

/* Which layers must be dark, alive or gone at each beat: the build-up is the
   whole point, so it is asserted rather than eyeballed. */
const LAYERS = ['.intro-bg', '.ambient-haze', '.snow-back', '.ground-drift', '.snow-mid',
  '.wind-back', '.wind-front', '.snow-front', '.snow-burst', '.gust-one', '.gust-two',
  '.ice-vignette', '.whiteout-flash'];

const opacityAt = () => Object.fromEntries(['.intro-bg', '.ambient-haze', '.snow-back', '.ground-drift',
  '.snow-mid', '.wind-back', '.wind-front', '.snow-front', '.snow-burst', '.gust-one', '.gust-two',
  '.ice-vignette', '.whiteout-flash'].map(sel => {
    const el = document.querySelector('#ice-intro ' + sel);
    return [sel, el ? +(+getComputedStyle(el).opacity).toFixed(3) : null];
  }));

async function filmstrip(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  /* Keep the overlay past its own removal timer so the strip can be finished,
     and stop the lesson repainting underneath a frozen frame. */
  await page.addInitScript(() => {
    const remove = Node.prototype.removeChild;
    Node.prototype.removeChild = function (child) {
      if (child && child.id === 'ice-intro') return child;
      return remove.call(this, child);
    };
  });
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ice-intro.is-running', { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__introAnims = document.getAnimations().filter(a => {
      const el = a.effect && a.effect.target;
      return el && el.closest && el.closest('#ice-intro');
    });
    window.__introAnims.forEach(a => a.pause());
  });

  const strip = [];
  for (const [at, label] of FRAMES) {
    await page.evaluate(t => { window.__introAnims.forEach(a => { try { a.currentTime = t; } catch (e) {} }); }, at);
    await page.waitForTimeout(60);
    strip.push({ at, label, opacity: await page.evaluate(opacityAt) });
    await page.screenshot({ path: path.join(out, label + '.png') });
  }
  const anims = await page.evaluate(() => window.__introAnims.length);
  await page.close();
  return { strip, anims };
}

async function lifecycle(browser, size) {
  const page = await browser.newPage({ viewport: size });
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => { if (!/favicon/.test(r.url())) failed.push(r.url() + ' :: ' + (r.failure() || {}).errorText); });

  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ice-intro.is-running', { timeout: 8000 });
  const born = Date.now();

  /* Halfway through: the storm owns the screen and the lesson is held. */
  await page.waitForTimeout(2600);
  const during = await page.evaluate(() => ({
    topAtCentre: (document.elementFromPoint(innerWidth / 2, innerHeight / 2) || {}).id || '',
    particles: document.querySelectorAll('#ice-intro i').length,
    phase: window.__poly ? window.__poly.state.phase : null,
    narr: window.__poly ? window.__poly.state.narr : null,
    speaking: window.__poly ? window.__poly.state.speaking : null,
    boardReady: window.__poly ? window.__poly.state.ready : null,
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    scrollH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight
  }));

  await page.waitForFunction(() => !document.getElementById('ice-intro'), null, { timeout: 15000 });
  const lifetime = Date.now() - born;

  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({
    introInDom: !!document.getElementById('ice-intro'),
    strayAnimations: document.getAnimations().filter(a => {
      const el = a.effect && a.effect.target;
      return el && el.closest && (el.id === 'ice-intro' || (el.closest('#ice-intro')));
    }).length,
    phase: window.__poly.state.phase,
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth
  }));
  await page.close();
  return { tag: size.width + 'x' + size.height, lifetime, during, after, errors, failed };
}

(async () => {
  await new Promise(r => server.listen(9352, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const film = await filmstrip(browser);
    const runs = [];
    for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 900, height: 620 }]) {
      runs.push(await lifecycle(browser, size));
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ film, runs }, null, 2));

    const at = label => film.strip.find(f => f.label === label).opacity;
    assert(film.anims > 100, 'expected a populated storm, saw ' + film.anims + ' animations');

    /* 0.0-0.4s: a dark screen, then the artwork, and nothing else yet. */
    assert(at('a-dark')['.intro-bg'] < 0.05, 'scene must open dark, bg was ' + at('a-dark')['.intro-bg']);
    assert(at('a-dark')['.snow-back'] === 0 && at('a-dark')['.snow-mid'] === 0, 'no snow before the reveal');
    assert(at('b-reveal')['.intro-bg'] > 0.9, 'background must be fully revealed by 0.52s');

    /* 0.4-2.0s: the storm arrives back-to-front and stays that way. */
    assert(at('c-first-snow')['.snow-back'] > 0 && at('c-first-snow')['.snow-mid'] === 0,
      'back snow must arrive before mid snow');
    assert(at('d-building')['.snow-mid'] > 0 && at('d-building')['.snow-front'] === 0,
      'mid snow must arrive before front snow');
    assert(at('e-wind')['.wind-back'] > 0 && at('e-wind')['.ground-drift'] > 0,
      'wind mist and ground drift must be alive by 2.3s');

    /* 2.8-4.3s: gust, whiteout, then the blizzard peak. */
    assert(at('f-gust')['.gust-one'] > 0.3, 'the main gust must be crossing at 2.95s');
    assert(at('f-gust')['.gust-one'] < 0.99, 'the gust must never be a solid white wall');
    assert(at('g-flash')['.whiteout-flash'] > 0 && at('g-flash')['.whiteout-flash'] <= 0.12,
      'whiteout must be present but gentle, was ' + at('g-flash')['.whiteout-flash']);
    const peak = at('h-peak');
    for (const layer of ['.snow-back', '.snow-mid', '.snow-front', '.snow-burst', '.wind-front', '.ground-drift']) {
      assert(peak[layer] > 0.4, 'at the peak ' + layer + ' should be strong, was ' + peak[layer]);
    }
    assert(at('i-peak-late')['.gust-two'] > 0, 'second, weaker gust must follow');

    /* 4.3-5.8s: it settles, then hands over. */
    const settling = at('j-settling');
    assert(settling['.snow-front'] < peak['.snow-front'], 'foreground snow must reduce as the storm settles');
    assert(settling['.wind-front'] < peak['.wind-front'], 'wind mist must drop before the handoff');
    assert(settling['.snow-burst'] < peak['.snow-burst'], 'peak streaks must die away');
    assert(at('k-handoff')['.intro-bg'] > 0.9, 'the artwork must stay clear through the crossfade');
    console.log('PASS storm builds back-to-front, peaks, settles and hands over');

    for (const r of runs) {
      assert.deepStrictEqual(r.errors, [], r.tag + ' page errors: ' + r.errors.join(' | '));
      assert.deepStrictEqual(r.failed, [], r.tag + ' failed requests: ' + r.failed.join(' | '));
      assert(Math.abs(r.lifetime - 5890) < 700, r.tag + ' intro ran ' + r.lifetime + 'ms, expected ~5.9s');
      assert.strictEqual(r.during.topAtCentre, 'ice-intro', r.tag + ' intro must sit above the lesson and eat input');
      assert(r.during.particles > 55, r.tag + ' thin storm: ' + r.during.particles + ' particles');
      assert(r.during.boardReady, r.tag + ' the board must be laid out to crossfade into');
      assert(!r.during.phase, r.tag + ' lesson screen 1 started under the intro');
      assert(!r.during.narr && !r.during.speaking, r.tag + ' narration played under the intro');
      assert(r.during.scrollW <= r.during.clientW && r.during.scrollH <= r.during.clientH, r.tag + ' the storm created a scrollbar');
      assert(!r.after.introInDom, r.tag + ' intro DOM left behind');
      assert.strictEqual(r.after.strayAnimations, 0, r.tag + ' intro animations still running after cleanup');
      assert.strictEqual(r.after.phase, 'point', r.tag + ' lesson did not begin screen 1 after the handoff');
      console.log('PASS ' + r.tag + '  lifetime ' + r.lifetime + 'ms, ' + r.during.particles + ' particles, clean handoff');
    }
    console.log('Filmstrip: ' + path.relative(root, out));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
