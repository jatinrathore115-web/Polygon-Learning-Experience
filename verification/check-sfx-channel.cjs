const fs=require('fs'),vm=require('vm');
const fixture=fs.readFileSync('verification/check-voice-gate.cjs','utf8').split('let g=game(4);')[0];
const context={require,console,setTimeout,clearTimeout};vm.createContext(context);
vm.runInContext(fixture+`
const g=game(30);g.sfx=ctx.Game.prototype.sfx;g.unlockAudio=()=>{};
const pending=[],osc=[];const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
const ac={currentTime:0,createOscillator(){const o={frequency:param(),connect(){},disconnect(){},start(){o.started=true},stop(){o.stops=(o.stops||0)+1}};osc.push(o);return o;},createGain(){return {gain:param(),connect(){},disconnect(){}}}};
g.withAudio=fn=>pending.push(fn);g.sfx('ok');g.sfx('no');pending.splice(0).forEach(fn=>fn(ac));
assert.equal(osc.length,2,'Delayed old success must not play after newer error');
g.withAudio=fn=>fn(ac);g.sfx('ok');assert(osc.slice(0,2).every(o=>o.stops===2),'Previous effect stops');
assert.equal(g._sfxVoices.size,3);g.stopSfx();assert.equal(g._sfxVoices.size,0);
console.log('PASS: stale sound callbacks suppressed, latest answer replaces previous effect, cleanup stops active voices.');
`,context);
