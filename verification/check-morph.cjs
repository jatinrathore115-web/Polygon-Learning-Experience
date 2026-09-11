const fs = require('fs'), vm = require('vm'), assert = require('assert');
let now = 0, id = 0, reduced = false;
const frames = new Map(), updates = [];
const ctx = {
  window: { matchMedia: () => ({ matches: reduced }) },
  React: { createRef: () => ({ current: null }) },
  DCLogic: class { setState(s) { updates.push(s); Object.assign(this.state, s); } },
  performance: { now: () => now },
  requestAnimationFrame: f => { frames.set(++id, f); return id; },
  cancelAnimationFrame: i => frames.delete(i), setTimeout, clearTimeout
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('polygon-data.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('index.html', 'utf8').match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1] + '\nglobalThis.Game=Component;', ctx);
const g = new ctx.Game(); g.P = ctx.window.POLY;
g.stopDrawingSound = g.clearNudge = g.sfx = () => {}; g.locked = () => false;
const shape = n => g.recallPoints(n);
function frame(time) { now = time; const work = [...frames.values()]; frames.clear(); work.forEach(f => f(time)); }
function hasCorners(outline, corners) {
  corners.forEach(p => assert(outline.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6), 'Every original corner is retained'));
}
// The counter and starting geometry must be committed together, before any RAF.
g.bumpN(1)(); assert.equal(g.state.n, 5); hasCorners(g.state.morph, shape(4));
assert(updates[0].n === 5 && updates[0].morph);
frame(200); const visible = g.state.morph.map(p => [...p]);
const previousSpeed = g._morphVelocity.map(p => [...p]);
assert(previousSpeed.some(v => Math.hypot(...v) > 0.01));
assert.equal(g.state.recallNameN, 4, 'Do not name an unfinished polygon');
const stale = [...frames.values()][0];
g.bumpN(1)(); hasCorners(g.state.morph, visible); assert.equal(frames.size, 1);
visible.forEach((p, i) => {
  const j = g.state.morph.findIndex(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6);
  assert(Math.hypot(g._morphVelocity[j][0] - previousSpeed[i][0], g._morphVelocity[j][1] - previousSpeed[i][1]) < 1e-6, 'Retarget preserves velocity');
});
const current = g.state.morph; stale(); assert.strictEqual(g.state.morph, current);
frame(720); assert.equal(g.state.morph, null); assert.equal(g.state.n, 6);
assert.equal(g.state.recallNameN, 6);
for (let n = 3; n <= 8; n++) {
  const pts = shape(n);
  assert.equal(pts[0][1], pts[n - 1][1], 'All polygons retain a horizontal top side');
}
// Check exact final silhouettes for every supported pair, including 5 and 7 sides.
for (let from = 3; from <= 8; from++) for (let to = 3; to <= 8; to++) {
  g.morphTo(shape(from), shape(to), 520); hasCorners(g.state.morph, shape(from));
  updates.length = 0; frame(now + 520);
  hasCorners(updates[0].morph, shape(to)); assert.equal(g.state.morph, null);
}
let done = 0; g.morphTo(shape(3), shape(4), 520, () => done++);
g.cancelMorph(); assert.equal(frames.size, 0); assert.equal(done, 0);
g.state.morph = null;
reduced = true; g.morphTo(shape(4), shape(5), 520, () => done++, { n: 5 });
assert.equal(frames.size, 0); assert.equal(g.state.morph, null); assert.equal(done, 1);
reduced = false; g.morphTo(shape(5), shape(6), 520, () => done++);
g.gen = (g.gen || 0) + 1; frame(now + 520); assert.equal(done, 1);
console.log('PASS: atomic start, interrupted morph continuity, stale-frame cancellation, all 36 exact endpoints, reduced motion, and navigation safety.');

