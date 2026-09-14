/* The open-or-closed screens, checked as geometry rather than by eye.
     node verification/check-open-closed.cjs
   Two things have to be true once one of these questions is answered. When the
   sign says there is a gap in the boundary, the gap itself has to be marked on
   the shape — the learner cannot be asked to take the sentence on trust. And a
   boundary that is closed has to be shown closing: a light running the whole
   way round and arriving back where it started is the thing that makes it
   closed, so a correct "Closed" earns that lap rather than only a button
   outline. Both are numbers here, so a later change cannot quietly drop them. */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');
const ctx = {
  window: {}, document: { documentElement: { clientWidth: 1920, clientHeight: 1080 } },
  React: { createRef: () => ({ current: null }) },
  DCLogic: class { setState(s) { Object.assign(this.state, typeof s === 'function' ? s(this.state) : s); } },
  setTimeout, clearTimeout
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('polygon-data.js', 'utf8'), ctx);
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
  const span = spanOf(revealed.card);
  check(!!span, o.s.fig + ': the missing span is drawn when the sign says there is a gap');
  const n = span ? span.d.match(/-?\d*\.?\d+/g).map(Number) : [];
  check(span && near(n[0], ends[0][0]) && near(n[1], ends[0][1]) && near(n[2], ends[1][0]) && near(n[3], ends[1][1]),
    o.s.fig + ': and it runs between the two places the boundary actually stops');
  check(span && /dash/i.test(JSON.stringify(span.style)),
    o.s.fig + ': dashed, so it can never be mistaken for boundary');
  const caps = revealed.card.dots.filter(d => d.fill === '#ffffff');
  check(caps.length === 2
        && ends.every(e => caps.some(c => near(c.x, e[0]) && near(c.y, e[1]))),
    o.s.fig + ': both loose ends are capped');
  check(revealed.card.dots.filter(d => d.fill !== '#ffffff').length === 2,
    o.s.fig + ': and each cap has a halo drawing the eye to it');
  /* Right answer: the same marks, so being right still shows why. */
  const correct = answered(o.k, { ok: 'open' });
  check(!!spanOf(correct.card) && correct.card.dots.length === 4,
    o.s.fig + ': answering "Open" correctly shows the same gap');
  check(!sweepOf(correct.card), o.s.fig + ': and never the closed-boundary lap');
});

/* ---- a closed boundary is shown closing ---- */
questions.filter(o => o.s.ans === 'closed').forEach(o => {
  const correct = answered(o.k, { ok: 'closed' });
  const sweep = sweepOf(correct.card);
  check(!!sweep, o.s.fig + ': a correct "Closed" runs a light round the boundary');
  check(sweep && sweep.d === g.figD(o.s.fig),
    o.s.fig + ': the light follows the whole outline, not a piece of it');
  check(sweep && /^\d+ \d+$/.test(sweep.style.strokeDasharray || '')
        && sweep.style.strokeDashoffset === 100,
    o.s.fig + ': as one bright segment travelling a full lap');
  check(!!correct.card.pathStyle && /sealGlow/.test(correct.card.pathStyle.animation || ''),
    o.s.fig + ': and the outline itself glows while it runs');
  check(correct.card.dots.length === 0, o.s.fig + ': with no gap marks, because there is no gap');

  /* Wrong answer on a closed figure already gets the blue trace, which runs the
     same lap for the same reason, so nothing is stacked on top of it. */
  const revealed = answered(o.k, { ocReveal: 'closed', wrong: 'open', tracing: true, traceMs: 1800 });
  check(!sweepOf(revealed.card), o.s.fig + ': a revealed answer leaves that lap to the trace');
  check(revealed.card.traceStyle && revealed.card.traceStyle.opacity !== 0,
    o.s.fig + ': and the trace is the thing that runs');
});

/* ---- the light must not be left parked on the shape ---- */
const sealKeyframe = html.match(/@keyframes sealSweep \{([^}]*\}[^}]*)*?\s*\}/);
check(/100% \{[^}]*opacity: 0/.test(html.match(/@keyframes sealSweep \{[\s\S]*?\n/)[0]),
  'the lap ends invisible rather than parking a bright segment on the boundary');

/* ---- reduced motion ---- */
ctx.window.matchMedia = (q) => ({ matches: /reduce/.test(q) });
const stillGap = answered(questions.find(o => o.s.ans === 'open').k, { ocReveal: 'open' });
check(!!spanOf(stillGap.card) && stillGap.card.dots.length === 4,
  'prefers-reduced-motion: the gap is still marked, it simply does not move');
check(!stillGap.card.dots.some(d => (d.style || {}).animation),
  'and none of its marks animate');
const stillSeal = answered(questions.find(o => o.s.ans === 'closed').k, { ok: 'closed' });
check(!(stillSeal.card.pathStyle || {}).animation && !sweepOf(stillSeal.card),
  'the closed boundary neither pulses nor runs its light');
delete ctx.window.matchMedia;

if (fail.length) { console.error('\n' + fail.length + ' check(s) failed'); process.exit(1); }
console.log('\nall checks passed');
