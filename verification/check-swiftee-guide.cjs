/* Drives the real lesson and checks that Swiftee plays the right expression at
   each teaching moment, that every state plays its full start → loop → stop
   triad, and that swapping expressions never moves her on screen.
     node verification/check-swiftee-guide.cjs
   Runs in real time, not on a virtual clock: the sprite is driven by
   requestAnimationFrame, which headless Chrome barely ticks while virtual time
   is in play, so a virtual-time run would freeze her on her first frame. The
   report comes back over the console channel for the same reason — there is no
   --dump-dom moment to aim at. Speech is stubbed so lines finish instantly;
   the lesson keeps input locked until narration ends, so without the stub no
   answer could ever be given. Everything else is the page as it ships. */
const fs = require('fs'), cp = require('child_process'), assert = require('assert');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN_MS = 150000;

const hook = `<script>
(function () {
  /* ---- instant speech, so the lesson's input gate opens ---- */
  function stubVoice() {
    window.PolygonRecordedVoice = { find: function () { return null; }, play: function () {} };
  }
  stubVoice();
  /* The helmet loads the real recorded-voice player after this script runs, and
     it cannot play in headless Chrome — so hold the stub until the page settles. */
  var restub = setInterval(stubVoice, 100);
  setTimeout(function () { clearInterval(restub); }, 20000);
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  try {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel: function () {}, speak: function (u) {
        setTimeout(function () { if (u.onstart) u.onstart(); }, 5);
        setTimeout(function () { if (u.onend) u.onend({ elapsedTime: 1.1 }); }, 1100);
      } } });
  } catch (e) { window.__stubErr = String(e); }

  var report = { steps: [] }, log = [], cellBoxes = [], spriteBoxes = [], done = false;
  var ticks = 0, mostPainted = 0;
  function canvas() { return document.querySelector('canvas[aria-label]'); }
  function game() { return window.__poly; }

  /* Sample the frame on screen, the fixed cell it lives in, and the sprite's own
     layout box inside that cell. Both boxes must hold still for every frame of
     every expression — the wrapper's fly-in and speaking lean are transforms on
     a separate element, so they cannot disturb this. */
  setInterval(function () {
    var c = canvas(); if (!c) return;
    var cell = c.parentElement.parentElement.getBoundingClientRect();
    if (cell.width) cellBoxes.push([Math.round(cell.left * 10) / 10, Math.round(cell.top * 10) / 10,
                                    Math.round(cell.width * 10) / 10, Math.round(cell.height * 10) / 10]);
    /* Skip samples taken before layout: an unlaid canvas reports its 300x150
       default, which says nothing about whether she holds still. */
    if (c.offsetWidth) spriteBoxes.push([c.offsetLeft, c.offsetTop, c.offsetWidth, c.offsetHeight, c.width, c.height]);
    /* A re-render hands back a blank canvas until the sprite's next draw, so
       take the busiest frame seen rather than whatever one instant holds.
       Sampled only briefly: reading the canvas back is slow enough to jank the
       animation this check is measuring. */
    if (++ticks % 10 === 0 && ticks < 400) mostPainted = Math.max(mostPainted, painted());
  }, 20);

  function painted() {
    var c = canvas(); if (!c) return -1;
    try {
      var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = 0;
      for (var i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
      return n;
    } catch (e) { report.paintError = String(e); return -1; }
  }

  /* ---- a tiny sequencer: each step waits for a condition, then acts ---- */
  var mark = null;
  function begin(name) { end(); mark = { step: name, from: log.length }; report.steps.push(mark); }
  function end() { if (mark) mark.clips = log.slice(mark.from); }
  function when(cond, then, label) {
    var tries = 0;
    (function poll() {
      if (done) return;
      if (cond()) { then(); return; }
      if (++tries > 600) { report.stalled = label; finish(); return; }
      setTimeout(poll, 25);
    })();
  }
  function idle(ms, then) { setTimeout(then, ms); }
  function interactive() { var g = game(); return g && g.state.interactive && !g.locked(); }
  /* The lesson's own answer handler, which is exactly what the Open/Closed
     controls call. The existing checks in this folder drive the component the
     same way — the template renders a conditional role attribute as empty, so
     the controls cannot be found by role in the DOM. */
  function answer(val) { game().choose(val); return true; }
  /* CFU 3 is a tap-one question, so a wrong figure can be tried again — the
     open/closed screens reveal the answer and advance after a single miss. */
  function tapFigure(i) { game().tapCard(i)(); }
  function goStep(sc, then) {
    var g = game(), k = g.steps().findIndex(function (s) { return s.sc === sc; });
    g.setState({ k: k }, function () { g.runStep(k, false); then(); });
  }

  var rafTicks = 0;
  (function spin() { rafTicks++; requestAnimationFrame(spin); })();

  function finish() {
    if (done) return; done = true;
    end();
    var g = game();
    report.rafTicks = rafTicks;
    report.paintedPixels = mostPainted;
    report.stubErr = window.__stubErr || null;
    report.gameState = g ? { k: g.state.k, interactive: g.state.interactive, speaking: g.state.speaking,
      magicReveal: g.state.magicReveal, voiceError: g.state.voiceError,
      voiceLocked: !!g._voiceLocked, locked: g.locked() } : null;
    var cell0 = JSON.stringify(cellBoxes[0]), sprite0 = JSON.stringify(spriteBoxes[0]);
    report.cellStable = cellBoxes.every(function (b) { return JSON.stringify(b) === cell0; });
    report.spriteStable = spriteBoxes.every(function (b) { return JSON.stringify(b) === sprite0; });
    report.cellBox = cellBoxes[0]; report.spriteBox = spriteBoxes[0]; report.samples = cellBoxes.length;
    report.clipLog = log;
    console.log('SWIFTEE_REPORT ' + btoa(unescape(encodeURIComponent(JSON.stringify(report)))));
  }
  window.onerror = function (msg, src, line) { report.pageError = msg + ' @' + line; finish(); };
  setTimeout(function () { report.timedOut = true; finish(); }, 130000);

  when(function () { return game() && game().state.ready && canvas(); }, function () {
    stubVoice();
    var sprite = game().guide.sprite;
    /* Record frames from the sprite itself rather than polling the canvas: a
       short clip such as curious_start lasts 400ms and a polling sampler can
       miss it entirely if the main thread janks. */
    var realDraw = sprite.draw.bind(sprite);
    sprite.draw = function () {
      realDraw();
      var clip = sprite.seg && sprite.seg.clip;
      if (clip && log[log.length - 1] !== clip) log.push(clip);
    };
    /* The sprite holds its last frame until a clip's sheet has arrived, so wait
       for every sheet rather than racing the network. */
    sprite.preload(Object.keys(window.SWIFTEE.clips));
    when(function () {
      var im = sprite.images, keys = Object.keys(im);
      return keys.length === Object.keys(window.SWIFTEE.clips).length &&
             keys.every(function (k) { return im[k].complete && im[k].naturalWidth > 0; });
    }, function () {
      /* 1. a fresh screen: she flies in, then talks the line on the sign */
      begin('screen-enter');
      goStep('S2', function () {
        when(interactive, function () {

          /* 2. a question that can be retried: first wrong figure */
          goStep('C3', function () {
          when(interactive, function () {
          begin('wrong-1');
          tapFigure(0);
          when(interactive, function () { idle(900, function () {

            /* 3. wrong again on the same question: she reads as stuck */
            begin('wrong-2');
            tapFigure(1);
            when(interactive, function () { idle(900, function () {

              /* 4. right at last, after a struggle */
              begin('correct');
              tapFigure(3);
              idle(3200, function () {

                /* 5. left alone on a question: the hand hint first, then she
                   drifts into a daydream */
                begin('idle');
                goStep('S3', function () {
                  when(interactive, function () {
                    idle(38000, function () {

                      /* 6. and the finale */
                      begin('lesson-end');
                      goStep('END', function () { idle(12000, finish); });
                    });
                  }, 'S3 never unlocked');
                });
              });
            }); }, 'no unlock after the second wrong answer');
          }); }, 'no unlock after the first wrong answer');
          }, 'CFU 3 never unlocked'); });
        }, 'S2 never unlocked');
      });
    }, 'the sheets never finished loading');
  }, 'the lesson never booted');
})();
<\/script>`;

fs.writeFileSync('swiftee-check.html', fs.readFileSync('index.html', 'utf8').replace('</body>', hook + '</body>'));
let out = '';
try {
  out = cp.execFileSync(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', '--mute-audio', '--allow-file-access-from-files', '--enable-logging=stderr',
    '--user-data-dir=' + process.env.TEMP + '/polygon-swiftee-check',
    '--window-size=1920,1080',
    'file:///' + process.cwd().split('\\').join('/') + '/swiftee-check.html'],
    { encoding: 'utf8', windowsHide: true, timeout: RUN_MS, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) { out = (e.stderr || '') + (e.stdout || ''); }
finally { fs.unlinkSync('swiftee-check.html'); }

const m = out.match(/SWIFTEE_REPORT ([A-Za-z0-9+/=]+)/);
assert(m, 'the page produced no report — the run did not finish');
const r = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
fs.writeFileSync('verification/swiftee-guide-results.json', JSON.stringify(r, null, 2));
assert(!r.pageError, 'the page threw: ' + r.pageError);
assert(!r.stalled, 'the run stalled: ' + r.stalled + ' — ' + JSON.stringify(r.gameState));

const step = name => (r.steps.find(s => s.step === name) || {}).clips || [];
const has = (name, clip) => step(name).includes(clip);
const fail = [];
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail.push(msg); };

check(r.paintedPixels > 2000, 'the sheets load and blit: ' + r.paintedPixels + ' opaque pixels drawn');
check(r.cellStable, 'her cell never moves across ' + r.samples + ' samples: ' + JSON.stringify(r.cellBox));
check(r.spriteStable, 'the sprite fills that cell unchanged: ' + JSON.stringify(r.spriteBox));
check(has('screen-enter', 'flapping'), 'new screen: she flies in — ' + step('screen-enter').join(' → '));
check(has('screen-enter', 'talking'), 'instruction: she talks the line while it is on the sign');
check(has('screen-enter', 'blinking'), 'instruction over: she settles to watching the learner');
check(has('wrong-1', 'confused'), 'first wrong answer: confused, never punishing — ' + step('wrong-1').join(' → '));
check(has('wrong-2', 'puzzleing'), 'wrong again: puzzled, the learner is stuck — ' + step('wrong-2').join(' → '));
check(has('correct', 'relieved'), 'right after a struggle: relieved — ' + step('correct').join(' → '));
check(has('idle', 'curious'), 'the hand hint appears: she leans in, curious — ' + step('idle').join(' → '));
check(has('idle', 'daydreaming'), 'left alone much longer: she daydreams');
check(has('lesson-end', 'proud') && has('lesson-end', 'celebrating'),
      'lesson complete: proud, then celebrating — ' + step('lesson-end').join(' → '));

/* No loop may be cut straight into another: each state plays its stop clip. */
const triads = { talking: ['talk_start', 'talk_stop'], confused: ['confused_start', 'confused_stop'],
  puzzleing: ['puzzle_start', 'puzzle_stop'], relieved: ['relieved_start', 'relieved_stop'],
  curious: ['curious_start', 'curious_stop'], daydreaming: ['daydream_start', 'daydreaming_stop'],
  proud: ['proud_start', 'proud_stop'] };
Object.keys(triads).forEach(state => {
  if (!r.clipLog.includes(state)) return;
  check(triads[state].every(c => r.clipLog.includes(c)), state + ' plays its full start → loop → stop triad');
});


/* ---------------------------------------------------------------------------
   REDUCED-MOTION run. She must still change expression — that is the feedback —
   but nothing may loop: every pose is held on one frame.
   ------------------------------------------------------------------------ */
const rmHook = `<script>
(function () {
  function stubVoice() {
    window.PolygonRecordedVoice = { find: function () { return null; }, play: function () {} };
  }
  stubVoice();
  var restub = setInterval(stubVoice, 100);
  setTimeout(function () { clearInterval(restub); }, 20000);
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  try {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel: function () {}, speak: function (u) {
        setTimeout(function () { if (u.onstart) u.onstart(); }, 5);
        setTimeout(function () { if (u.onend) u.onend({ elapsedTime: 1.1 }); }, 1100); } } });
  } catch (e) {}

  var report = { reducedMotion: null, frames: {}, clips: [] }, done = false;
  function canvas() { return document.querySelector('canvas[aria-label]'); }
  function game() { return window.__poly; }
  function finish() {
    if (done) return; done = true;
    report.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    console.log('SWIFTEE_RM ' + btoa(unescape(encodeURIComponent(JSON.stringify(report)))));
  }
  window.onerror = function (msg, src, line) { report.pageError = msg + ' @' + line; finish(); };
  setTimeout(finish, 60000);

  /* Record every frame index each clip is ever drawn at. */
  setInterval(function () {
    var c = canvas(); if (!c || !c.dataset.clip) return;
    var k = c.dataset.clip;
    (report.frames[k] = report.frames[k] || {})[c.dataset.frame] = 1;
    if (report.clips[report.clips.length - 1] !== k) report.clips.push(k);
  }, 20);

  var tries = 0;
  (function poll() {
    if (done) return;
    var g = game();
    if (g && g.state.ready && canvas()) {
      g.guide.sprite.preload(Object.keys(window.SWIFTEE.clips));
      setTimeout(function () {
        var k = g.steps().findIndex(function (x) { return x.sc === 'C3'; });
        g.setState({ k: k }, function () {
          g.runStep(k, false);
          setTimeout(function () { g.tapCard(0)(); setTimeout(finish, 6000); }, 5000);
        });
      }, 4000);
      return;
    }
    if (++tries > 600) { report.stalled = 'never booted'; finish(); return; }
    setTimeout(poll, 25);
  })();
})();
<\/script>`;

fs.writeFileSync('swiftee-rm.html', fs.readFileSync('index.html', 'utf8').replace('</body>', rmHook + '</body>'));
let rmOut = '';
try {
  rmOut = cp.execFileSync(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', '--mute-audio', '--allow-file-access-from-files', '--enable-logging=stderr',
    '--force-prefers-reduced-motion',
    '--user-data-dir=' + process.env.TEMP + '/polygon-swiftee-rm',
    '--window-size=1920,1080',
    'file:///' + process.cwd().split('\\').join('/') + '/swiftee-rm.html'],
    { encoding: 'utf8', windowsHide: true, timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) { rmOut = (e.stderr || '') + (e.stdout || ''); }
finally { fs.unlinkSync('swiftee-rm.html'); }

const rmMatch = rmOut.match(/SWIFTEE_RM ([A-Za-z0-9+/=]+)/);
assert(rmMatch, 'the reduced-motion run produced no report');
const rm = JSON.parse(Buffer.from(rmMatch[1], 'base64').toString('utf8'));
fs.writeFileSync('verification/swiftee-reduced-motion-results.json', JSON.stringify(rm, null, 2));
assert(!rm.pageError, 'the reduced-motion run threw: ' + rm.pageError);
assert(!rm.stalled, 'the reduced-motion run stalled: ' + rm.stalled);

console.log('\n-- prefers-reduced-motion --');
check(rm.reducedMotion === true, 'the run really is in reduced-motion mode');
const looping = Object.keys(rm.frames).filter(k => Object.keys(rm.frames[k]).length > 1);
check(looping.length === 0, 'no expression animates: every clip is held on one frame'
  + (looping.length ? ' — these looped: ' + looping.join(', ') : ''));
check(rm.clips.includes('confused'), 'a wrong answer still changes her face — ' + rm.clips.join(' → '));

if (fail.length) { console.error('\n' + fail.length + ' check(s) failed'); process.exit(1); }
console.log('\nall checks passed; frame logs in verification/swiftee-guide-results.json and swiftee-reduced-motion-results.json');
