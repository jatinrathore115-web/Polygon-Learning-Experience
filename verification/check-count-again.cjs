const fs = require('fs'), vm = require('vm');
const fixture = fs.readFileSync('verification/check-voice-gate.cjs','utf8').split('let g=game(4);')[0];
const context = {require,console,setTimeout,clearTimeout};
vm.createContext(context);
vm.runInContext(fixture + `
vm.runInContext(fs.readFileSync('responsive-layout.js','utf8'),ctx);
function setup(reduced=false) {
  const g=game(30), pending=[];
  g.state.interactive=true;g.state.cnt=[5,0];g.gen=1;
  g.clearNudge=()=>{};g.guide.onInteractionStart=()=>{};
  g.reducedMotion=()=>reduced;g.later=(fn,ms)=>pending.push({fn,ms});
  let advances=0;g.advance=()=>advances++;
  const view=()=>{const v={};g.viewBA(v,g.step());g.decorate(v);return v;};
  return {g,pending,view,advances:()=>advances};
}
const t=setup();
for(let i=0;i<=5;i++) {
  const v=t.view();assert.equal(t.g.state.cnt[1],i);
  assert.equal(v.showCheck,false);assert.equal(v.check,null);
  assert.equal(v.counters[0].max,5);
  assert.equal(v.counters[0].plusDisabled,i===5);
  if(i<5)t.g.bump(1,1)();
}
assert(t.view().cards[1].hl.some(h=>h.style.animation==='polygonRevealGlow 700ms ease-in-out 340ms 1 both'));
t.g.bump(1,1)();t.g.bump(1,-1)();assert.equal(t.g.state.cnt[1],5);
assert.equal(t.pending.length,1);assert.equal(t.pending[0].ms,1040);
t.pending.shift().fn();assert.equal(t.g.state.count2Pulsing,false);
assert.equal(t.advances(),0);assert.equal(t.pending[0].ms,3000);
t.pending.shift().fn();assert.equal(t.advances(),1);
const stale=setup();for(let i=0;i<5;i++)stale.g.bump(1,1)();
stale.g.gen++;stale.pending.shift().fn();assert.equal(stale.pending.length,0);
const reduced=setup(true);for(let i=0;i<5;i++)reduced.g.bump(1,1)();
assert.equal(reduced.pending[0].ms,0);
assert(!reduced.view().cards[1].hl.some(h=>(h.style.animation||'').includes('polygonRevealGlow')));
reduced.pending.shift().fn();assert.equal(reduced.pending[0].ms,3000);
console.log('PASS: Screen 31 caps at five, disables Plus, pulses once, waits three seconds after pulse, hides Check, guards stale timers and respects reduced motion.');
`,context);
