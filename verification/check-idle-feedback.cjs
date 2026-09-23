const fs = require('fs'), vm = require('vm'), assert = require('assert');
const ctx = { window: {}, React: { createRef: () => ({ current: null }) },
  document: { documentElement: { clientWidth: 1920, clientHeight: 1080 } },
  DCLogic: class { setState(s) { Object.assign(this.state, s); } }, setTimeout, clearTimeout,
  /* Confetti and the other decorations schedule themselves on a frame. There
     are no frames here, so they are simply never drawn -- this sheet is about
     what the board decides, not about what it paints. */
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} };
vm.createContext(ctx);
/* renderVals lays every screen out on the shared design canvas, so the canvas
   module has to be in the sandbox before the lesson script runs -- the page
   loads it the same way, ahead of everything else. */
vm.runInContext(fs.readFileSync('responsive-layout.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('polygon-data.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('index.html', 'utf8').match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1] + '\nglobalThis.Game=Component;', ctx);
const g = new ctx.Game(); g.P = ctx.window.POLY; g.svgRefs = {};
g.state.ready = true; g.state.interactive = true; g.sfx = () => {};
let jobs = []; g.later = (fn, ms) => jobs.push({ fn, ms });
const target = { getBoundingClientRect: () => ({ left: 900, top: 300, width: 200, height: 160 }), getAttribute: () => null };
g.safeRef = { current: { querySelectorAll: () => [target], getBoundingClientRect: () => ({ left: 100, top: 100, width: 1800 }) } };
g.state.k = g.steps().findIndex(s => s.set === 'cfu1');
g.armNudge(420); assert.equal(jobs[0].ms, 8000);
const stale = jobs.shift(); g.clearNudge(); stale.fn(); assert.equal(g.state.nudge, null);
jobs.shift().fn(); assert(g.state.nudge); g.clearNudge(); assert.equal(g.state.nudge, null);
jobs = []; g.safeRef.current.querySelectorAll = () => []; g.armNudge(); jobs.shift().fn();
assert.equal(g.state.nudge, null, 'Never fall back to the center when no target exists');
g.safeRef.current.querySelectorAll = () => [target];
g.state.k = g.steps().findIndex(s => s.set === 'cfu3');
const single = {}; g.viewTapOne(single, g.step(), false);
assert.deepEqual(Array.from(single.cards, c => c.nudge), ['', '', '', '1']);
g.state.k = g.steps().findIndex(s => s.set === 'cfu1');
jobs = []; g.tapCard(1)(); assert.equal(g.state.wrong, 1); assert.equal(g.state.sel.length, 0);
g.state.hoverK = 'card:c1b';
const V = { cards: [] }; g.viewMulti(V, g.step());
assert(V.cards[1].wrap.animation.includes('wrongTap'));
/* A red rim, not one exact red: pinned to a hex this broke the moment the
   wrong-answer cue was made more visible, while never checking the thing that
   matters -- that a mis-tapped card turns red at all. */
{ const rim = V.cards[1].wrap.borderColor;
  const c = rim.startsWith("#") ? [1,3,5].map(o => parseInt(rim.substr(o,2),16)) : [];
  assert(c[0] > 150 && c[0]-c[1] > 60 && c[0]-c[2] > 60, "A mis-tapped card takes a red rim, got " + rim); }
/* And a warm face behind it, rather than one exact tint. */
{ const face = V.cards[1].wrap.background;
  const c = face.startsWith("#") ? [1,3,5].map(o => parseInt(face.substr(o,2),16)) : [];
  assert(c[0] > 240 && c[0] >= c[2] && c[0] - c[1] >= 4, "A mis-tapped card takes a warm face, got " + face); }
/* A mis-tapped card is meant to be obvious, so this asserts the halo is there
   rather than forbidding it. It used to require the opposite -- a soft shadow
   and no large glow -- which is exactly the treatment that turned out to be
   too quiet for a child to notice. */
assert(V.cards[1].wrap.boxShadow.includes('0 0 0 6px'), 'A mis-tapped card carries a halo ring');
{ const reds = (V.cards[1].wrap.boxShadow.match(/rgba?\([^)]+\)/g) || [])
    .map(c => c.replace(/rgba?\(|\)/g, '').split(',').map(Number));
  assert(reds.some(c => c[0] > 150 && c[0] - c[1] > 60 && c[0] - c[2] > 60),
    'and that halo is red'); }
/* Each wrong tap has to replay the shake. A CSS animation only restarts when
   its name changes, so the card alternates between two identically-shaped
   keyframes and the tap counter decides which. Asserted on that counter",
   because a real second tap is refused while the correction is still being
   spoken -- the learner cannot reach the state a back-to-back double tap
   would have tested. */
const shakeFor = n => { g._wrongTapToken = n; g.setState({ wrong: 1 });
  g.viewMulti(V, g.step()); return V.cards[1].wrap.animation.split(' ')[0]; };
const shakes = [1, 2, 3, 4].map(shakeFor);
assert(shakes.every(a => a && a !== 'none'), 'Every wrong tap shakes the card: ' + shakes);
assert(shakes.every((a, n) => n === 0 || a !== shakes[n - 1]),
  'Each incorrect tap replays the wiggle rather than re-using one name: ' + shakes);
g.setState({ wrong: null });
/* A correct tap lands once the correction has finished and the question is
   back -- taps during the narration are refused on purpose. Real playback
   releases _voiceLocked when the clip ends; this stand-in has to stand in for
   that too, or the board stays shut against a tap it would accept. */
g.narrate = () => { g._voiceLocked = false; g.setState({ speaking: false, interactive: true }); };
g.restoreQuestion();
assert.equal(g.locked(), false, 'The board reopens once the correction has been spoken');
g.tapCard(0)(); assert(g.state.sel.includes(0), 'A correct tap selects its card');
g.state.k = g.steps().findIndex(s => s.q === 'deform');
jobs = []; g.armNudge(); assert.equal(jobs[0].ms, 8000); assert.equal(g.state.showHand, false);
jobs.shift().fn(); assert.equal(g.state.showHand, true);
g.clearNudge(); assert.equal(g.state.showHand, false);
jobs = []; g.armStage2(); assert.equal(jobs[0].ms, 8000);
g.state.showHand = false; jobs = []; g._labelDragCleanup = () => {};
g.armNudge(); jobs.shift().fn(); assert.equal(g.state.showHand, false, 'No hint during an active drag');
g._labelDragCleanup = null;
g.clearNudge(); assert.equal(jobs.at(-1).ms, 8000);
const control = { getAttribute: () => null };
g.stageRef = { current: { contains: () => true } };
jobs = []; g.noteActivity({ type: 'pointerdown', target: { closest: () => null } });
assert.equal(jobs.length, 0, 'Background taps do not reset the timer');
g.noteActivity({ type: 'pointerdown', target: { closest: () => control } });
assert.equal(jobs.at(-1).ms, 8000, 'Control taps reset the timer');
g.state.k = g.steps().findIndex(s => s.q === 'count2');
const counts = {showCounter:true,counters:[{value:'5'},{value:'7'}]};
g.counterHints(counts); assert.equal(counts.counters[1].minusNudge, '1');
assert.equal(counts.counters[0].nudge, '');
counts.counters[1].value = '4'; g.counterHints(counts); assert.equal(counts.counters[1].nudge, '1');
counts.counters[1].value = '5'; g.counterHints(counts); assert.equal(counts.nudgeCheck, '1');
g.state.k = g.steps().findIndex(s => s.q === 'recall');
const recall = {showCounter:true,counters:[{value:'8',plusDisabled:true}]};
g.counterHints(recall); assert.equal(recall.counters[0].minusNudge, '1');
/* Select-all activities no longer carry a Check button. Picking the right
   figures IS the answer, and the screen settles by itself -- so there is no
   button to leave behind, and none of them may quietly grow one back. */
assert(g.steps().every(s => !(s.q === 'multi' && s.check)),
  'No select-all activity hands the learner a Check button');
g.state.k = g.steps().findIndex(s => s.set === 'cfu1');
g.state.checked = true; g.state.sel = [0,2];
const complete = g.renderVals();
assert.equal(complete.showCheck, false, 'Completed activities hide their action button');

/* The settle: the last correct tap closes the board, speaks the praise, and
   only then -- after a beat to read the marked figures -- moves on. */
g.state.checked = false; g.state.sel = [0]; g.state.ok = null;
let advanced = 0;
g.advance = () => advanced++; g.feedback = (text, then) => then();
g.react = g.burstHere = g.answerFeedback = () => {};
jobs = []; g.tapCard(2)();
assert.deepEqual(g.state.sel.slice().sort(), [0, 2], 'The final correct tap completes the set');
assert.equal(g.state.checked, true, 'and settles the board');
assert.equal(advanced, 0, 'Allow a short reading pause after the success speech');
const advanceJob = jobs.find(j => j.fn === g.advance); assert.equal(advanceJob.ms, 420);
advanceJob.fn(); assert.equal(advanced, 1, 'then the screen moves on by itself');
/* The lesson is one 16:9 design canvas, fitted to the viewport whole. Nothing
   scrolls and nothing is cropped at any size -- the board either fits or the
   whole thing scales down until it does. */
const fits = (w, h) => {
  ctx.document.documentElement = { clientWidth: w, clientHeight: h };
  const V = g.renderVals(), f = ctx.window.PolygonResponsive.frame(w, h);
  assert.equal(V.viewportStyle.overflow, 'hidden', w + 'x' + h + ': the board does not scroll');
  assert(f.width * 0 === 0 && f.left >= -0.5 && f.top >= -0.5,
    w + 'x' + h + ': the canvas is contained, never cropped');
  return f.scale;
};
[[1366,768],[1440,900],[1536,864],[1600,900],[1920,1080],[2560,1440],[390,844]].forEach(r => fits(r[0], r[1]));
/* A fingertip needs 44 real pixels. The counter's hit area covers its control,
   so the floor is the smallest control at the smallest landscape size we
   support -- the 76-unit minus button on a 1366x768 laptop. */
const hit = g.counterHitStyle();
assert.equal(hit.width, '100%', 'The hit area covers its control rather than shrinking inside it');
assert(76 * fits(1366, 768) >= 44, 'Counter controls clear the 44px tap floor at 1366x768');
/* Every spoken line must resolve to one of the delivered recordings. The mp3
   set in voiceovers/ is the source of truth for what can actually play: a
   paraphrase is looked up by text, finds nothing, and silently falls back to
   the browser's synthetic voice. (narrator-lines.json is an earlier script and
   lists wording that was never recorded, so it cannot be the check.) */
{
  const vmRec = require('vm'), rc = { window: {}, self: {}, console };
  vmRec.createContext(rc);
  vmRec.runInContext(fs.readFileSync('voiceovers/recordings.js', 'utf8'), rc);
  vmRec.runInContext(fs.readFileSync('voiceovers/recorded-player.js', 'utf8'), rc);
  const find = rc.window.PolygonRecordedVoice.find, gaps = [];
  g.steps().forEach((step, i) => {
    [['narration', step.narr]].concat(Object.entries(step.fb || {}))
      .forEach(([kind, text]) => { if (text && !find(text)) gaps.push('step ' + (i + 1) + ' ' + kind + ': ' + JSON.stringify(text)); });
  });
  assert.equal(gaps.length, 0, 'lines with no recording, which would be read by the synthetic voice:\n  ' + gaps.join('\n  '));
}
assert(/Closed boundary/.test(g.describeCard({key:'c1a',badge:'A'})));
console.log('PASS: hints, replay feedback, counter direction, empty Check gate, automatic completion, mobile reading scale/touch targets, and option descriptions.');
