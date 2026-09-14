require('fs').mkdirSync('verification/output', { recursive: true });
/* The four-up compare screens, and in particular the line that names the
   boundaries.
     node verification/check-boundaries.cjs
   "Look! The boundaries of the shapes are different too." has to show what it
   names, on every figure, while it is being said — a one-shot that finishes
   before the sentence does leaves the word with nothing to point at. So all
   four boundaries draw on together and then hold, and the sign's text arrives
   a word at a time. The first half is read out of the view builder; the second
   half is measured in a real browser, because whether the light is still on
   four seconds later is a question about CSS, not about a style object. */
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), assert = require('assert');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const html = fs.readFileSync('index.html', 'utf8');
const fail = [];
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail.push(msg); };

/* ------------------------------------------------------------------ view ---- */
const ctx = {
  window: { speechSynthesis: { cancel() {}, speak() {} } },
  SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
  document: { documentElement: { clientWidth: 1920, clientHeight: 1080 } },
  React: { createRef: () => ({ current: null }) },
  DCLogic: class { setState(v, cb) { Object.assign(this.state, typeof v === 'function' ? v(this.state) : v); if (cb) cb(); } },
  setTimeout, clearTimeout
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('polygon-data.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('assets/swiftee/swiftee-sheets.js', 'utf8'), ctx);
vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1] + '\nglobalThis.Game=Component;', ctx);

const g = new ctx.Game();
g.P = ctx.window.POLY; g.svgRefs = {}; g.state.ready = true; g.later = () => {}; g.sfx = () => {};
const steps = g.steps();
const boundK = steps.findIndex(s => s.sc === 'S6' && s.ph === 'bound');
assert(boundK >= 0, 'the boundaries step is gone');
const LINE = steps[boundK].narr;
check(/boundaries of the shapes are different/i.test(LINE),
  'the line that names them is still "' + LINE + '"');

function phase(ph) {
  const k = steps.findIndex(s => s.sc === 'S6' && s.ph === ph);
  Object.assign(g.state, { k, phase: ph, tracing: false, hlKind: null,
    dd: [null, null, null, null], ddWrong: [false, false, false, false] });
  return g.renderVals();
}
const lit = card => card.traceStyle && card.traceStyle.opacity === 1;

const bound = phase('bound');
check(bound.cards.length === 4, 'the screen shows all ' + bound.cards.length + ' figures');
check(bound.cards.every(lit), 'every one of them has its boundary lit, not just one');
check(new Set(bound.cards.map(c => JSON.stringify(c.traceStyle))).size === 1,
  'all four are lit the same way, so the line names one idea rather than four');

const style = bound.cards[0].traceStyle;
check(style.strokeDashoffset === 0,
  'their resting state is fully drawn, so nothing can leave a boundary half-lit');
check(/^boundDraw \d+ms[\s\S]*?\bboth\b/.test(style.animation || ''),
  'the draw-on plays over the top of that: ' + (style.animation || 'nothing'));
check(/boundLit [^,]*infinite/.test(style.animation || ''),
  'and then it holds, glowing, instead of finishing before the sentence does');
check(/@keyframes boundDraw \{ from \{ stroke-dashoffset: 100/.test(html),
  'the draw-on starts from an explicit empty, not from whatever was there before');
check(bound.cards.every(c => c.traceD && c.traceD.length > 0),
  'each light follows that figure\'s own boundary');

/* The neighbouring phases must not inherit it. */
['open', 'closed', 'sc'].forEach(ph => {
  check(phase(ph).cards.every(c => !lit(c)),
    'the "' + ph + '" step leaves the boundaries alone');
});

/* The words arrive one at a time, paused until the voice starts. */
Object.assign(g.state, { k: boundK, phase: 'bound' });
g.speak(LINE, () => {});
const words = g.narratorParts().filter(p => p.style.display === 'inline-block');
check(words.length === LINE.trim().split(/\s+/).length,
  'the sign carries all ' + words.length + ' words of the line');
check(words.every(p => p.style.animationPlayState === 'paused'),
  'each one waits for the voice rather than running ahead of it');
check(words.every((p, i) => p.style.animation.indexOf(' ' + i * 110 + 'ms ') > 0),
  'and they arrive one after another, not all at once');

/* Reduced motion: lit, but nothing moving. */
ctx.window.matchMedia = (q) => ({ matches: /reduce/.test(q) });
const still = phase('bound');
check(still.cards.every(lit), 'prefers-reduced-motion: the boundaries are still lit');
check(still.cards.every(c => !c.traceStyle.animation), 'and nothing about them animates');
delete ctx.window.matchMedia;

/* --------------------------------------------------------------- browser ---- */
/* Runs on the real clock: a virtual one starves the animation timeline, so the
   light would look half-drawn however long the budget was. The voice is stubbed
   and held stubbed, because headless Chrome blocks the recording and the
   "Play voiceover" fallback that appears instead re-renders the board. */
const hook = `<script>
(function () {
  function stub() {
    window.PolygonRecordedVoice = { find: function () { return null; }, play: function () {} };
  }
  stub();
  setInterval(stub, 80);
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  try {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel: function () {}, speak: function (u) {
        setTimeout(function () { if (u.onstart) u.onstart(); }, 5);
        setTimeout(function () { if (u.onend) u.onend({ elapsedTime: 4.2 }); }, 4200);
      } } });
  } catch (e) {}

  var report = {}, done = false;
  function finish() {
    if (done) return; done = true;
    console.log('BOUNDS ' + btoa(unescape(encodeURIComponent(JSON.stringify(report)))));
  }
  window.onerror = function (m, src, line) { report.pageError = m + ' @' + line; finish(); };
  setTimeout(function () { report.timedOut = true; finish(); }, 40000);

  var tries = 0;
  (function poll() {
    if (done) return;
    var g = window.__poly;
    if (g && g.state.ready) {
      g.advance = function () {};            /* hold the step open to measure it */
      var k = ${boundK};
      g.setState({ k: k }, function () {
        g.runStep(k, false);
        setTimeout(function () {
          var paths = Array.prototype.slice.call(document.querySelectorAll('[data-trace]'));
          report.count = paths.length;
          report.phase = g.state.phase;
          report.voiceError = g.state.voiceError || '';
          report.lit = paths.map(function (p) {
            var cs = getComputedStyle(p);
            return {
              offset: Math.round(parseFloat(cs.strokeDashoffset) * 100) / 100,
              opacity: cs.opacity, stroke: cs.stroke,
              anims: (p.getAnimations ? p.getAnimations() : []).map(function (a) {
                return (a.animationName || 'transition') + ':' + a.playState;
              })
            };
          });
          finish();
        }, 4000);
      });
      return;
    }
    if (++tries > 600) { report.stalled = 'never booted'; finish(); return; }
    setTimeout(poll, 25);
  })();
})();
<\/script>`;

fs.writeFileSync('bounds-check.html', html.replace('</body>', hook + '</body>'));
let out = '';
try {
  cp.execFileSync(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', '--mute-audio', '--allow-file-access-from-files', '--enable-logging=stderr',
    '--user-data-dir=' + process.env.TEMP + '/polygon-bounds-check', '--window-size=1920,1080',
    'file:///' + process.cwd().split('\\').join('/') + '/bounds-check.html'],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) { out = (e.stderr || '') + (e.stdout || ''); }
finally { fs.unlinkSync('bounds-check.html'); }

const m = out.match(/BOUNDS ([A-Za-z0-9+/=]+)/);
assert(m, 'the browser run produced no report');
const r = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
fs.writeFileSync('verification/output/boundaries-results.json', JSON.stringify(r, null, 2));
assert(!r.pageError, 'the page threw: ' + r.pageError);
assert(!r.stalled, 'the run stalled: ' + r.stalled);

check(r.phase === 'bound', 'four seconds on, the lesson is still on the boundaries step');
check(r.count === 4, 'the browser finds ' + r.count + ' boundary lights');
check(r.lit.every(p => p.offset === 0),
  'each has finished drawing and stayed drawn: dash offsets ' + r.lit.map(p => p.offset).join(', '));
check(r.lit.every(p => Number(p.opacity) === 1),
  'and none of them faded out after their lap');
check(r.lit.every(p => p.anims.some(a => /^boundLit:running/.test(a))),
  'the glow is still running on all four');
check(new Set(r.lit.map(p => p.stroke)).size === 1,
  'all four are the same colour on screen: ' + r.lit[0].stroke);

if (fail.length) { console.error('\n' + fail.length + ' check(s) failed'); process.exit(1); }
console.log('\nall checks passed');
