/* The open-or-closed screens, checked as geometry rather than by eye.
     node verification/check-open-closed.cjs
   One thing has to be true once one of these questions is answered. When the
   sign says there is a gap in the boundary, the gap itself has to be marked on
   the shape --- the learner cannot be asked to take the sentence on trust. A
   closed boundary is the other half of that contract: nothing is drawn on it,
   because there is nothing to point at, and recolouring an outline the learner
   has just read correctly only obscures the thing the question was about. Both
   are numbers here, so a later change cannot quietly drop or reverse them. */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');
const ctx = {
  window: {}, document: { documentElement: { clientWidth: 1920, clientHeight: 1080 } },
  React: { createRef: () => ({ current: null }) },
  DCLogic: class { setState(s) { Object.assign(this.state, typeof s === 'function' ? s(this.state) : s); } },
  setTimeout, clearTimeout
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('responsive-layout.js','utf8'),ctx);vm.runInContext(fs.readFileSync('polygon-data.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('assets/swiftee/swiftee-sheets.js', 'utf8'), ctx);
vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1] + '\nglobalThis.Game=Component;', ctx);

const g = new ctx.Game();
g.P = ctx.window.POLY; g.svgRefs = {}; g.state.ready = true;
const FIG = ctx.window.POLY.FIG;
const steps = g.steps();
const fail = [];
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail.push(msg); };
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1 : tol);

/* Every open-or-closed question in the lesson, with the figure it shows. */
const questions = steps.map((s, k) => ({ k, s })).filter(o => o.s.q === 'oc');
check(questions.length === 5, 'the lesson still has ' + questions.length + ' open-or-closed questions');

function answered(k, state) {
  Object.assign(g.state, {
    k, phase: steps[k].ph || '', ok: null, ocReveal: null, wrong: null,
    tracing: false, drawn: true, drawing: false, penAt: null, magicReveal: false
  }, state || {});
  const v = g.renderVals();
  return { v, card: v.cards[v.cards.length - 1] };
}
/* The dashed span is the only highlight that is not the figure's own outline. */
const spanOf = card => card.hl.find(h => /^M[-\d. ]+L[-\d. ]+$/.test(h.d));
const sweepOf = card => card.hl.find(h => h.style && /sealSweep/.test(h.style.animation || ''));

/* ---- the loose ends are read from the figure, and agree with the data ---- */
Object.keys(FIG).forEach(name => {
  const F = FIG[name], ends = g.gapEnds(name);
  if (F.closed) { if (ends) check(false, name + ' is closed but reports loose ends'); return; }
  if (!F.gap) return;               /* only the authored ones can be cross-checked */
  const mid = ends && [(ends[0][0] + ends[1][0]) / 2, (ends[0][1] + ends[1][1]) / 2];
  check(!!ends && near(mid[0], F.gap.x, 3) && near(mid[1], F.gap.y, 5),
    name + ': the ends found in the outline straddle the gap the data marks — midpoint ('
    + (mid ? mid.map(n => n.toFixed(0)).join(', ') : '?') + ') vs (' + F.gap.x + ', ' + F.gap.y + ')');
});

/* ---- nothing is marked before the learner answers ---- */
const fresh = answered(questions[1].k);
check(fresh.card.hl.length === 0 && fresh.card.dots.length === 0,
  'an unanswered question carries no marks at all');

/* ---- a gap is marked, wherever the sentence about it can appear ---- */
questions.filter(o => o.s.ans === 'open').forEach(o => {
  const ends = g.gapEnds(o.s.fig);
  assert(ends, o.s.fig + ' has no loose ends to mark');
  /* Wrong answer: the sign reads "There is a gap in its boundary." */
  const revealed = answered(o.k, { ocReveal: 'open', wrong: 'closed' });
  const dots = revealed.card.dots;
  check(dots.length >= 5, o.s.fig + ': a dotted line marks the missing span — ' + dots.length + ' dots');
  /* Every dot sits on the straight run between the two places the boundary
     stops, so the dotted line traces the gap and not some other path. */
  const dx = ends[1][0] - ends[0][0], dy = ends[1][1] - ends[0][1];
  const len = Math.hypot(dx, dy);
  const offLine = dots.filter(d =>
    Math.abs((d.x - ends[0][0]) * dy - (d.y - ends[0][1]) * dx) / len > 2);
  check(offLine.length === 0,
    o.s.fig + ': and every dot lies on the run between the two places the boundary stops');
  /* Strictly between the ends: the loose ends stay bare so the opening itself
     is still the clearest thing on the shape. */
  const gapDots = dots.filter(d => d.dot === 'gap');
  const atEnd = gapDots.filter(d => ends.some(e => near(d.x, e[0], 6) && near(d.y, e[1], 6)));
  check(atEnd.length === 0, o.s.fig + ': with the dotted run stopping short of both loose ends');
  /* The ends themselves are ringed once the dots have run out, so the eye
     finishes on the break rather than on the last dot. Unfilled, so the
     boundary underneath still shows through. */
  const rings = dots.filter(d => d.dot === 'gap-end');
  check(rings.length === 2 && rings.every(r => r.fill === 'none'
        && ends.some(e => near(r.x, e[0], 2) && near(r.y, e[1], 2))),
    o.s.fig + ': and both loose ends marked where the boundary stops');
  /* They arrive one after another, so the gap is drawn rather than appearing. */
  /* The delay is the second time in the shorthand, after the easing; matching
     the first one just re-reads the duration for every dot. */
  /* Read the delay out of the shorthand without pinning the easing: the dots
     run linear now, because the pen they continue is moving at a steady pace. */
  const delays = gapDots.map(d => parseFloat((/gapDotReveal\s+\d+ms\s+\S+\s+(\d+)ms/.exec(d.style.animation || '') || [0, 0])[1]));
  check(/gapDotReveal/.test(gapDots[0].style.animation || '')
        && delays.every((v, i) => i === 0 || v > delays[i - 1]),
    o.s.fig + ': revealed in order along the gap, not all at once');
  /* They pick up where the boundary trace stops, close enough behind it to
     read as the same pen carrying on rather than a second effect starting.
     The solid half is the screen's own trace, so nothing is stroked over the
     figure a second time -- one line, one journey. */
  const traceMs = g.constants ? g.constants.OC_TRACE_MS : 1000;
  check(delays[0] >= traceMs && delays[0] <= traceMs + 80,
    o.s.fig + ': with the dots picking up as the trace lands (' + delays[0] + 'ms after a ' + traceMs + 'ms trace)');
  check(revealed.card.hl.length === 0,
    o.s.fig + ': and no second stroke drawn over the boundary');
  /* One colour for the whole gesture: the dots are the trace continued, so a
     different ink would make them read as an unrelated diagram. */
  check(gapDots.every(d => d.fill === rings[0].stroke),
    o.s.fig + ': the dotted continuation is the same blue as the trace');
  /* Right answer: the same marks, so being right still shows why. */
  const correct = answered(o.k, { ok: 'open' });
  check(correct.card.dots.length === dots.length,
    o.s.fig + ': answering "Open" correctly shows the same gap');
  check(!sweepOf(correct.card), o.s.fig + ': and never the closed-boundary lap');
});

/* ---- a closed boundary is left unmarked ---- */
/* There is no gap to point at, so nothing is drawn on top of a boundary the
   learner has just read correctly. The answer is confirmed off the shape —
   the tick on the button, the chime, Swiftee's reaction and her spoken line —
   and the figure stays exactly the figure the question asked about. A future
   change that paints the outline green on a correct answer fails here. */
questions.filter(o => o.s.ans === 'closed').forEach(o => {
  const correct = answered(o.k, { ok: 'closed' });
  check(correct.card.hl.length === 0,
    o.s.fig + ': a correct "Closed" leaves the shape unmarked — ' + correct.card.hl.length + ' highlight(s)');
  check(!correct.card.pathStyle || !correct.card.pathStyle.animation,
    o.s.fig + ': and the outline itself neither glows nor pulses');
  check(correct.card.dots.length === 0, o.s.fig + ': with no gap marks, because there is no gap');
  /* The outline keeps the colour it was drawn in, so being right does not
     recolour the boundary the question was about. */
  check(correct.card.stroke === answered(o.k).card.stroke,
    o.s.fig + ': drawn in the same colour it was asked in');

  /* Wrong answer on a closed figure gets the blue trace, which runs the whole
     way round and is the thing that shows the boundary closing. */
  const revealed = answered(o.k, { ocReveal: 'closed', wrong: 'open', tracing: true, traceMs: 1800 });
  check(revealed.card.traceStyle && revealed.card.traceStyle.opacity !== 0,
    o.s.fig + ': a revealed answer is shown closing by the trace');
  check(revealed.card.hl.length === 0,
    o.s.fig + ': and nothing is stacked on top of it');
});

/* ---- reduced motion ---- */
ctx.window.matchMedia = (q) => ({ matches: /reduce/.test(q) });
const stillGap = answered(questions.find(o => o.s.ans === 'open').k, { ocReveal: 'open' });
check(stillGap.card.dots.length >= 5,
  'prefers-reduced-motion: the gap is still marked, it simply does not move');
check(!stillGap.card.dots.some(d => { const a = (d.style || {}).animation; return a && a !== 'none'; }),
  'and none of its marks animate');
const stillSeal = answered(questions.find(o => o.s.ans === 'closed').k, { ok: 'closed' });
check(!(stillSeal.card.pathStyle || {}).animation && !sweepOf(stillSeal.card),
  'and a closed boundary stays unmarked here too');
delete ctx.window.matchMedia;

if (fail.length) { console.error('\n' + fail.length + ' check(s) failed'); process.exit(1); }
console.log('\nall checks passed');
