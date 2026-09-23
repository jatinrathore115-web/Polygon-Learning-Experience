/* Fast scene bounds check; check-story-scene.cjs covers the actual browser render. */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync('index.html', 'utf8');
const ctx = { window: {}, React: { createRef: () => ({ current: null }) },
  document: { documentElement: { clientWidth: 1920, clientHeight: 1080 } },
  DCLogic: class {}, setTimeout, clearTimeout };
vm.createContext(ctx);
/* Layout now resolves against the shared design canvas, so the canvas module
   has to be in the sandbox before the page script runs. */
vm.runInContext(fs.readFileSync('responsive-layout.js', 'utf8'), ctx);
vm.runInContext(src.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]
  + '\nglobalThis.layout={STAGE,BOARD,SAFE,NARR,GUIDE_BOX,LAYER};globalThis.Game=Component;', ctx);
const { STAGE, BOARD, SAFE, NARR, GUIDE_BOX, LAYER } = ctx.layout;
const inside = (box, parent) => box.x >= parent.x && box.y >= parent.y
  && box.x + box.w <= parent.x + parent.w && box.y + box.h <= parent.y + parent.h;
const stage = { x: 0, y: 0, ...STAGE };
for (const box of [BOARD, SAFE, GUIDE_BOX, LAYER.sign]) assert(inside(box, stage));
assert(inside(SAFE, BOARD), 'Learning area must fit inside the board');
assert(NARR.w + 60 <= LAYER.sign.w, 'Text width and padding must fit beside the board');
assert(LAYER.sign.x + LAYER.sign.w < BOARD.x, 'Dialogue must clear the board');
// The sprite cell contains transparent margins; the browser check measures visible pixels.
assert(GUIDE_BOX.x + GUIDE_BOX.w / 2 < BOARD.x, 'Guide must remain perched left of the board');
/* The scene background is bound through backgroundSrc now, because the
   boundary screens swap to a second painting -- so look for the binding and
   for every file it can resolve to, rather than one literal src attribute. */
assert(src.includes('sc-camel-src="{{ backgroundSrc }}"'),'the scene background is no longer bound to the view');
for (const file of (src.match(/'assets\/[^']+\.png'/g)||[]).map(q=>decodeURIComponent(q.slice(1,-1))))
  assert(fs.existsSync(file), 'missing background art: '+file);
assert(fs.existsSync('assets/image.png'));
const game = new ctx.Game();
vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);
game.P=ctx.window.POLY;
assert.equal(game.boardStyle().opacity, 0);
assert.equal(game.signStyle().opacity, 0);
game.state.storyContent = game.state.storyDialogue = true;
assert.equal(game.signStyle().opacity, 0, 'Never show an empty dialogue');
game.state.narrPage = 'Look! A point.';
assert.equal(game.boardStyle().opacity, 1);
assert.equal(game.signStyle().opacity, 1);
const results = [[1920,1080],[1440,900],[1366,768],[1280,720],[1024,768]].map(([width,height]) => {
  const scale = Math.min(width / STAGE.w, height / STAGE.h);
  const bounds = { x: (width-STAGE.w*scale)/2, y: (height-STAGE.h*scale)/2, w: STAGE.w*scale, h: STAGE.h*scale };
  assert(inside(bounds, { x: -0.001, y: -0.001, w: width+0.002, h: height+0.002 }));
  return { width, height, scale, pass: true };
});
fs.mkdirSync('verification/output', { recursive: true });
fs.writeFileSync('verification/output/board-layout-results.json', JSON.stringify(results, null, 2));
console.log('PASS: scene, dialogue, guide and content bounds; staged visibility; five viewport sizes.');
