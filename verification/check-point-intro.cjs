/* Screen 1's point intro, checked as geometry rather than by eye.
     node verification/check-point-intro.cjs
   The brief for this screen was: the point sits where the finished shape will be
   centred, not high in the frame; the composition is tight rather than a small
   mark on a wide white board; and the point-to-shape draw does not jump. Each of
   those is a number here, so a later layout change cannot quietly undo them.
   The component is built in a VM, the same way check-interactions.cjs does it —
   no browser is needed to read the styles the view builder produces. */
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
const steps = g.steps();
const px = v => parseFloat(String(v));
function view(phase, extra) {
  const k = steps.findIndex(s => s.sc === 'S1' && s.ph === phase);
  assert(k >= 0, 'no S1 phase "' + phase + '"');
  Object.assign(g.state, { k, phase }, extra || {});
  return g.renderVals();
}
/* The safe area is the white board's usable rectangle; the view builder lays
   everything out inside it. */
const SAFE = { w: 1570, h: 701 };
const fail = [];
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail.push(msg); };
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1.5 : tol);

/* ---- the point ---- */
const point = view('point');
const dot = point.leaders.find(l => l.style.width === '62px');
assert(dot, 'the point phase renders no mark');
const dotX = px(dot.style.left), dotY = px(dot.style.top);

/* ---- the finished shape, in the same phase group ---- */
const drawn = view('draw', { drawn: true, drawing: false, penAt: null });
const card = drawn.cards[0];
const box = { x: px(card.wrap.left), y: px(card.wrap.top), w: px(card.wrap.width), h: px(card.wrap.height) };
/* Where the leaf's own bounding box lands inside that card, which is what the
   learner reads as the centre of the shape. */
const F = ctx.window.POLY.FIG.leaf;
const xs = F.pts.map(p => p[0]), ys = F.pts.map(p => p[1]);
const bb = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
const shapeMid = g.mapPt(box, F.vb, [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2]);
const shapeTop = g.mapPt(box, F.vb, [bb.x0, bb.y0])[1];
const shapeBottom = g.mapPt(box, F.vb, [bb.x0, bb.y1])[1];

check(near(dotX, shapeMid[0]) && near(dotY, shapeMid[1]),
  'the point sits exactly where the finished shape is centred: point ('
  + dotX.toFixed(0) + ', ' + dotY.toFixed(0) + ') vs shape centre ('
  + shapeMid[0].toFixed(0) + ', ' + shapeMid[1].toFixed(0) + ')');

check(dotY > shapeTop + 100,
  'the point is no longer up at the shape\'s top vertex: it is '
  + (dotY - shapeTop).toFixed(0) + 'px below it');

check(near(dotY, SAFE.h / 2, 30),
  'and it is on the board\'s own centre line, within '
  + Math.abs(dotY - SAFE.h / 2).toFixed(0) + 'px of it');

/* ---- the composition claims the board rather than floating in it ---- */
const ring = point.leaders.find(l => l.style.border);
check(!!ring && near(px(ring.style.width), shapeBottom - shapeTop, 6),
  'the ripples settle at the height the shape will fill: ring '
  + px(ring.style.width).toFixed(0) + 'px vs shape ' + (shapeBottom - shapeTop).toFixed(0) + 'px');

const shapeH = shapeBottom - shapeTop;
check(shapeH / SAFE.h > 0.6,
  'the shape fills ' + (100 * shapeH / SAFE.h).toFixed(0) + '% of the board\'s height');

/* ---- the introductory board stays free of redundant captions ---- */
check(point.callouts.length === 0 && drawn.callouts.length === 0,
  'the Point and Shape captions are hidden');

/* ---- the point does not blink from one place to another ---- */
const penAt = (at) => {
  const v = view('draw', { drawn: false, drawing: false, penAt: at });
  const pen = v.leaders.find(l => l.style.width === '62px');
  assert(pen, 'no travelling mark at penAt=' + at);
  return pen;
};
const atCentre = penAt('centre'), atVertex = penAt('vertex');
check(near(px(atCentre.style.left), dotX) && near(px(atCentre.style.top), dotY),
  'the draw begins with the mark exactly where the point phase left it');
const origin = g.mapPt(box, F.vb, F.pts[0]);
check(near(px(atVertex.style.left), origin[0]) && near(px(atVertex.style.top), origin[1]),
  'and it ends on the shape\'s first vertex, where the outline starts');
check(/left .*cubic-bezier/.test(atCentre.style.transition || '') && /top /.test(atCentre.style.transition || ''),
  'it travels between the two rather than cutting: ' + (atCentre.style.transition || 'no transition'));
check(px(atVertex.arrowStyle.transform.match(/[\d.]+/)[0]) < 0.7,
  'and shrinks into the pen light as it arrives');

/* ---- the question keeps room for its controls ---- */
const ask = view('ask', { drawn: true });
const askCard = ask.cards[0];
const askBox = { x: px(askCard.wrap.left), y: px(askCard.wrap.top), w: px(askCard.wrap.width), h: px(askCard.wrap.height) };
const askBottom = g.mapPt(askBox, F.vb, [bb.x0, bb.y1])[1];
const buttonsTop = px(ask.choiceRowStyle.top); // Answer row follows the fitted card.
check(ask.showChoice === true, 'the question shows its Open and Closed controls');
check(buttonsTop - askBottom > 60,
  'and the shape clears them by ' + (buttonsTop - askBottom).toFixed(0) + 'px');

/* ---- reduced motion ---- */
ctx.window.matchMedia = (q) => ({ matches: /reduce/.test(q) });
const still = view('point');
check(!still.leaders.some(l => (l.style.animation || '').indexOf('pointRing') >= 0),
  'prefers-reduced-motion: the ripples are not drawn at all');
const stillDot = still.leaders.find(l => l.style.width === '62px');
check(!stillDot.style.animation && !stillDot.arrowStyle.animation,
  'and the mark neither appears nor breathes, it is simply there');
delete ctx.window.matchMedia;

/* The opening nine numbered screens share one whiteboard frame. */
const frames = [];
for (let k = 0; k < 9; k++) {
  Object.assign(g.state, { k, phase: steps[k].ph || '', drawn: true });
  const board = g.renderVals().boardStyle;
  frames.push(['left','top','width','height'].map(key => board[key]).join('|'));
}
check(new Set(frames).size === 1, 'Screens 1–9 use the same shifted board size and position');

if (fail.length) { console.error('\n' + fail.length + ' check(s) failed'); process.exit(1); }
console.log('\nall checks passed');
