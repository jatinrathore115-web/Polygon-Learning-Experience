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

/* Sheet layers are read by their opacity; particle layers no longer fade as
   sheets, so they are read by how much snow is actually on screen. */
const SHEETS = ['.intro-bg', '.ambient-haze', '.snow-back', '.wind-back', '.wind-front',
  '.gust-one', '.gust-two', '.ice-vignette', '.whiteout-flash'];
const FIELDS = ['.snow-mid', '.snow-front', '.snow-burst', '.ground-drift'];

const sampleAt = ([sheets, fields]) => ({
  opacity: Object.fromEntries(sheets.map(sel => {
    const el = document.querySelector('#ice-intro ' + sel);
    return [sel, el ? +(+getComputedStyle(el).opacity).toFixed(3) : null];
  })),
  snow: Object.fromEntries(fields.map(sel => {
    let n = 0;
    document.querySelectorAll('#ice-intro ' + sel + ' i').forEach(el => {
      const r = el.getBoundingClientRect();
      if (+getComputedStyle(el).opacity > 0.05 &&
          r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight) n++;
    });
    return [sel, n];
  }))
});

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
    strip.push(Object.assign({ at: at, label: label },
      await page.evaluate(sampleAt, [SHEETS, FIELDS])));
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

  /* Timed from inside the page: polling from Node measures how busy the main
     thread is, not how long the cinematic ran. */
  await page.addInitScript(() => {
    window.__introMarks = {};
    const watch = new MutationObserver(() => {
      const el = document.getElementById('ice-intro');
      if (el && el.classList.contains('is-running') && !window.__introMarks.start) {
        window.__introMarks.start = performance.now();
      }
      if (!el && window.__introMarks.start && !window.__introMarks.end) {
        window.__introMarks.end = performance.now();
      }
    });
    const attach = () => {
      if (!document.documentElement) { setTimeout(attach, 0); return; }
      watch.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    };
    attach();
  });
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ice-intro.is-running', { timeout: 8000 });

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
    scrollH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight,
    /* A drifting tiled sheet must still cover the screen at BOTH ends of its
       travel, or a bare corner of un-snowed background slides into view. */
    dustGaps: [...document.querySelectorAll('#ice-intro .dust')].map(el => {
      const cs = getComputedStyle(el);
      const tx = parseFloat(cs.getPropertyValue('--tx'));
      const ty = parseFloat(cs.getPropertyValue('--ty'));
      const x = el.offsetLeft, y = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
      const covers = (dx, dy) => x + dx <= 0 && y + dy <= 0 &&
        x + dx + w >= innerWidth && y + dy + h >= innerHeight;
      return covers(0, 0) && covers(tx, ty) ? null : { tx, ty, x, y, w, h };
    }).filter(Boolean)
  }));

  await page.waitForFunction(() => !document.getElementById('ice-intro'), null, { timeout: 15000 });
  const marks = await page.evaluate(() => window.__introMarks);
  const lifetime = Math.round(marks.end - marks.start);

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


/* Records what the intro asks of Web Audio, so the wind can be checked without
   anyone having to listen to it. */
const AUDIO_SPY = () => {
  window.__audio = { contexts: 0, closed: 0, sources: 0, ramps: [], masterSets: [] };
  const Real = window.AudioContext || window.webkitAudioContext;
  if (!Real) return;
  const Patched = function () {
    const ctx = new Real();
    window.__audio.contexts++;
    const close = ctx.close.bind(ctx);
    ctx.close = () => { window.__audio.closed++; return close(); };
    const makeGain = ctx.createGain.bind(ctx);
    ctx.createGain = () => {
      const g = makeGain();
      const ramp = g.gain.linearRampToValueAtTime.bind(g.gain);
      g.gain.linearRampToValueAtTime = (v, t) => { window.__audio.ramps.push(+v.toFixed(4)); return ramp(v, t); };
      return g;
    };
    const makeSrc = ctx.createBufferSource.bind(ctx);
    ctx.createBufferSource = () => { window.__audio.sources++; return makeSrc(); };
    return ctx;
  };
  window.AudioContext = Patched;
  window.webkitAudioContext = Patched;
};

async function audioRun(browser, gestureRequired) {
  const browserForRun = gestureRequired ? await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--autoplay-policy=document-user-activation-required']
  }) : browser;
  const page = await browserForRun.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(AUDIO_SPY);
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ice-intro.is-running', { timeout: 8000 });
  await page.waitForTimeout(700);
  if (gestureRequired) await page.mouse.click(640, 360);   // the learner's first tap
  await page.waitForTimeout(2600);
  const mid = await page.evaluate(() => window.__audio);
  await page.waitForFunction(() => !document.getElementById('ice-intro'), null, { timeout: 15000 });
  await page.waitForTimeout(900);
  const end = await page.evaluate(() => window.__audio);
  await page.close();
  if (gestureRequired) await browserForRun.close();
  return { mid, end };
}

/* With the artwork held back, the storm must wait for it rather than blowing
   across a black screen. */
async function slowArtworkRun(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    window.__startedAt = null;
    const watch = new MutationObserver(() => {
      const el = document.getElementById('ice-intro');
      if (el && el.classList.contains('is-running') && window.__startedAt === null) {
        window.__startedAt = performance.now();
      }
    });
    const attach = () => {
      if (!document.documentElement) { setTimeout(attach, 0); return; }
      watch.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    };
    attach();
  });
  await page.route('**/INTRO*IMAGE.png', async route => {
    await new Promise(r => setTimeout(r, 1200));
    await route.continue();
  });
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ice-intro.is-running', { timeout: 12000 });
  const timing = await page.evaluate(() => {
    const entry = performance.getEntriesByType('resource').find(e => /INTRO/.test(e.name));
    return { startedAt: window.__startedAt, artworkDone: entry ? entry.responseEnd : null };
  });
  await page.waitForFunction(() => !document.getElementById('ice-intro'), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const phase = await page.evaluate(() => window.__poly.state.phase);
  await page.close();
  return { timing, phase };
}

async function reducedMotionRun(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ice-intro.is-running', { timeout: 8000 });
  const born = Date.now();
  await page.waitForTimeout(3400);
  const during = await page.evaluate(() => {
    const cam = document.querySelector('#ice-intro .intro-cam');
    const burst = document.querySelector('#ice-intro .snow-burst');
    return {
      particles: document.querySelectorAll('#ice-intro i').length,
      camAnimations: cam.getAnimations().length,
      burstFlakes: burst ? burst.querySelectorAll('i').length : -1,
      flash: +getComputedStyle(document.querySelector('#ice-intro .whiteout-flash')).opacity,
      bgVisible: +getComputedStyle(document.querySelector('#ice-intro .intro-bg')).opacity
    };
  });
  await page.screenshot({ path: path.join(out, 'reduced-motion.png') });
  await page.waitForFunction(() => !document.getElementById('ice-intro'), null, { timeout: 15000 });
  const lifetime = Date.now() - born;
  await page.waitForTimeout(800);
  const phase = await page.evaluate(() => window.__poly.state.phase);
  await page.screenshot({ path: path.join(out, 'lesson-after-intro.png') });
  await page.close();
  return { during, lifetime, phase, errors };
}

(async () => {
  await new Promise(r => server.listen(9352, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const film = await filmstrip(browser);
    const runs = [];
    for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 },
                        { width: 900, height: 620 }, { width: 820, height: 1180 }]) {
      runs.push(await lifecycle(browser, size));
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ film, runs }, null, 2));

    const frame = label => film.strip.find(f => f.label === label);
    const at = label => frame(label).opacity;      // sheet layers
    const snow = label => frame(label).snow;       // flakes actually on screen
    assert(film.anims > 100, 'expected a populated storm, saw ' + film.anims + ' animations');

    /* 0.0-0.4s: a dark screen, then the artwork, and nothing else yet. */
    assert(at('a-dark')['.intro-bg'] < 0.05, 'scene must open dark, bg was ' + at('a-dark')['.intro-bg']);
    assert(at('a-dark')['.snow-back'] === 0, 'no distant snow before the reveal');
    assert(snow('a-dark')['.snow-mid'] === 0, 'no falling snow before the reveal');
    assert(at('b-reveal')['.intro-bg'] > 0.9, 'background must be fully revealed by 0.52s');

    /* 0.4-2.0s: the storm arrives back-to-front and stays that way. */
    assert(at('c-first-snow')['.snow-back'] > 0 && snow('c-first-snow')['.snow-mid'] === 0,
      'distant snow must arrive before falling snow');
    assert(snow('d-building')['.snow-mid'] > 0 && snow('d-building')['.snow-front'] === 0,
      'mid snow must arrive before front snow');
    assert(at('e-wind')['.wind-back'] > 0 && snow('e-wind')['.ground-drift'] > 0,
      'wind mist and ground drift must be alive by 2.3s');

    /* 2.8-4.3s: gust, whiteout, then the blizzard peak. */
    assert(at('f-gust')['.gust-one'] > 0.3, 'the main gust must be crossing at 2.95s');
    assert(at('f-gust')['.gust-one'] < 0.99, 'the gust must never be a solid white wall');
    assert(at('g-flash')['.whiteout-flash'] > 0 && at('g-flash')['.whiteout-flash'] <= 0.12,
      'whiteout must be present but gentle, was ' + at('g-flash')['.whiteout-flash']);
    for (const layer of ['.snow-back', '.wind-front']) {
      assert(at('h-peak')[layer] > 0.4, 'at the peak ' + layer + ' should be strong, was ' + at('h-peak')[layer]);
    }
    const peak = snow('h-peak');
    const FLOOR = { '.snow-mid': 60, '.snow-front': 14, '.snow-burst': 13, '.ground-drift': 12 };
    for (const layer in FLOOR) {
      assert(peak[layer] >= FLOOR[layer], 'thin blizzard: ' + layer + ' had ' + peak[layer] +
        ' flakes on screen at the peak, wanted ' + FLOOR[layer]);
    }
    assert(at('i-peak-late')['.gust-two'] > 0, 'second, weaker gust must follow');

    /* 4.3-5.8s: it settles, then hands over. */
    const settling = snow('j-settling');
    assert(settling['.snow-front'] < peak['.snow-front'], 'foreground snow must reduce as the storm settles');
    assert(at('j-settling')['.wind-front'] < at('h-peak')['.wind-front'], 'wind mist must drop before the handoff');
    assert(settling['.snow-burst'] < peak['.snow-burst'], 'peak streaks must die away');
    assert(snow('k-handoff')['.snow-front'] <= settling['.snow-front'], 'the storm must keep thinning into the handoff');
    assert(at('k-handoff')['.intro-bg'] > 0.9, 'the artwork must stay clear through the crossfade');
    console.log('PASS storm builds back-to-front, peaks, settles and hands over');

    for (const r of runs) {
      assert.deepStrictEqual(r.errors, [], r.tag + ' page errors: ' + r.errors.join(' | '));
      assert.deepStrictEqual(r.failed, [], r.tag + ' failed requests: ' + r.failed.join(' | '));
      assert(Math.abs(r.lifetime - 5890) < 180, r.tag + ' intro ran ' + r.lifetime + 'ms, expected ~5.9s');
      assert.strictEqual(r.during.topAtCentre, 'ice-intro', r.tag + ' intro must sit above the lesson and eat input');
      assert(r.during.particles > 55, r.tag + ' thin storm: ' + r.during.particles + ' particles');
      assert(r.during.boardReady, r.tag + ' the board must be laid out to crossfade into');
      assert(!r.during.phase, r.tag + ' lesson screen 1 started under the intro');
      assert(!r.during.narr && !r.during.speaking, r.tag + ' narration played under the intro');
      assert(r.during.scrollW <= r.during.clientW && r.during.scrollH <= r.during.clientH, r.tag + ' the storm created a scrollbar');
      assert.deepStrictEqual(r.during.dustGaps, [], r.tag + ' a dust sheet leaves the screen uncovered: ' + JSON.stringify(r.during.dustGaps));
      assert(!r.after.introInDom, r.tag + ' intro DOM left behind');
      assert.strictEqual(r.after.strayAnimations, 0, r.tag + ' intro animations still running after cleanup');
      assert.strictEqual(r.after.phase, 'point', r.tag + ' lesson did not begin screen 1 after the handoff');
      console.log('PASS ' + r.tag + '  lifetime ' + r.lifetime + 'ms, ' + r.during.particles + ' particles, clean handoff');
    }
    /* ---- wind audio, with and without the browser wanting a gesture ---- */
    for (const gestureRequired of [false, true]) {
      const label = gestureRequired ? 'gesture-gated audio' : 'audio allowed to start';
      const a = await audioRun(browser, gestureRequired);
      /* The lesson opens its own context on the learner's first tap, so two is
         legitimate; what matters is that the intro opens one and closes the
         one it opened. */
      assert(a.mid.contexts >= 1 && a.mid.contexts <= 2, label + ': ' + a.mid.contexts + ' audio contexts');
      assert(a.mid.sources >= 3, label + ': wind needs body, howl and gust sources, saw ' + a.mid.sources);
      assert(a.mid.ramps.length > 3, label + ': the wind envelope was never scheduled');
      const peak = Math.max.apply(null, a.mid.ramps);
      assert(peak > 0.3 && peak < 0.6, label + ': wind peak ' + peak + ' is outside a gentle range');
      assert(a.end.ramps[a.end.ramps.length - 1] < 0.01, label + ': wind must be faded out, not cut');
      assert.strictEqual(a.end.closed, 1, label + ': the audio context must be closed on cleanup');
      console.log('PASS ' + label + ' — peak ' + peak + ', faded and closed');
    }

    /* ---- reduced motion: calmer, but the same length and the same handoff ---- */
    const calm = await reducedMotionRun(browser);
    assert.deepStrictEqual(calm.errors, [], 'reduced motion page errors: ' + calm.errors.join(' | '));
    assert.strictEqual(calm.during.camAnimations, 0, 'reduced motion must not move the camera');
    assert.strictEqual(calm.during.burstFlakes, 0, 'reduced motion must not fire peak streaks');
    assert.strictEqual(calm.during.flash, 0, 'reduced motion must not flash');
    assert(calm.during.bgVisible > 0.9, 'reduced motion must still show the scene');
    assert(calm.during.particles > 20, 'reduced motion should still snow, saw ' + calm.during.particles);
    assert(Math.abs(calm.lifetime - 5860) < 700, 'reduced motion changed the intro length: ' + calm.lifetime + 'ms');
    assert.strictEqual(calm.phase, 'point', 'reduced motion must still hand over to the lesson');
    console.log('PASS reduced motion — calm, same length, clean handoff (' + calm.during.particles + ' flakes)');

    /* ---- the reveal waits for the artwork ---- */
    const slow = await slowArtworkRun(browser);
    assert(slow.timing.artworkDone > 1000, 'the artwork delay did not take effect');
    assert(slow.timing.startedAt >= slow.timing.artworkDone,
      'the storm started ' + Math.round(slow.timing.artworkDone - slow.timing.startedAt) +
      'ms before the artwork had loaded');
    assert.strictEqual(slow.phase, 'point', 'a slow background must still hand over to the lesson');
    console.log('PASS reveal waits for the artwork (' + Math.round(slow.timing.startedAt) + 'ms, artwork at ' + Math.round(slow.timing.artworkDone) + 'ms)');

    console.log('Filmstrip: ' + path.relative(root, out));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
