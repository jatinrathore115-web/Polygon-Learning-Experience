const fs = require('fs'), vm = require('vm'), assert = require('assert');
const ctx = { window: {}, React: { createRef: () => ({ current: null }) },
  document: { documentElement: { clientWidth: 1920, clientHeight: 1080 } },
  DCLogic: class { setState(s) { Object.assign(this.state, s); } }, setTimeout, clearTimeout };
vm.createContext(ctx);
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
assert.equal(V.cards[1].wrap.borderColor, '#da9279');
assert.equal(V.cards[1].wrap.background, '#fff8f3');
assert(!V.cards[1].wrap.boxShadow.includes('24px'), 'Incorrect feedback uses a soft shadow without a large glow');
const oldReset = jobs.find(j => j.ms === 650);
const firstAnimation = V.cards[1].wrap.animation;
g.tapCard(1)(); g.viewMulti(V, g.step());
assert.notEqual(V.cards[1].wrap.animation, firstAnimation, 'Each incorrect tap replays the wiggle');
oldReset.fn(); assert.equal(g.state.wrong, 1, 'An old timeout cannot clear fresh feedback');
jobs.filter(j => j.ms === 650).at(-1).fn(); assert.equal(g.state.wrong, null);
g.tapCard(0)(); assert(g.state.sel.includes(0));
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
g.state.k = g.steps().findIndex(s => s.set === 'cfu1');
g.state.checked = true; g.state.sel = [0,2];
const complete = {}; g.viewMulti(complete, g.step());
assert.equal(complete.nudgeCheck, '1'); assert.equal(complete.checkLabel, 'Next');
jobs=[]; g.armNudge(); jobs.shift().fn(); assert(g.state.nudge, 'Completed activities can hint Next');
g.state.checked = false; g.state.sel = []; g.state.ok = null;
const empty = g.renderVals(); assert.equal(empty.checkDisabled, true); assert.equal(empty.check, null);
const attempts = g.state.attempts; g.check(); assert.equal(g.state.attempts, attempts);
g.state.sel = [0,2]; let advanced = 0;
g.advance = () => advanced++; g.feedback = (text, then) => then();
g.react = g.confetti = () => {}; g.check();
assert.equal(g.state.checked, true); assert.equal(advanced, 0, 'Success waits for Next');
g.check(); assert.equal(advanced, 1);
ctx.document.documentElement = {clientWidth:390,clientHeight:844};
const mobile = g.renderVals(); assert.equal(mobile.viewportStyle.overflow, 'auto');
assert(mobile.scalerStyle.zoom >= 0.55);
const hit = g.counterHitStyle(); assert(parseFloat(hit.width) * mobile.scalerStyle.zoom >= 44);
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
console.log('PASS: hints, replay feedback, counter direction, empty Check gate, deliberate Next, mobile reading scale/touch targets, and option descriptions.');
