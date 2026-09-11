const fs=require('fs'),vm=require('vm'),assert=require('assert');const html=fs.readFileSync('index.html','utf8');let spoken=[],timers=[];
const ctx={window:{speechSynthesis:{cancel(){},speak(u){spoken.push(u);}}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},document:{documentElement:{clientWidth:1920,clientHeight:1080}},React:{createRef:()=>({current:null})},DCLogic:class{setState(v,cb){Object.assign(this.state,typeof v==='function'?v(this.state):v);if(this.componentDidUpdate)this.componentDidUpdate();if(cb)cb();}},setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',ctx);
function game(k){const g=new ctx.Game();g.P=ctx.window.POLY;g.svgRefs={};g.state.ready=true;g.state.k=k;g.state.phase=g.step().ph||'';g.later=f=>timers.push(f);g.sfx=()=>{};g.armNudge=()=>{};return g;}
function drain(g){let cap=100;while(g._voiceReading&&--cap){spoken.at(-1).onstart();spoken.at(-1).onend();}assert(cap>0);}

const g=game(4);
const words=()=>g.narratorParts().filter(p=>p.style.display==='inline-block');
for(const step of g.steps()) {
 g.speak(step.narr,()=>{});
 assert.equal(g.narratorParts().map(p=>p.text).join('').toLowerCase(),step.narr.toLowerCase());
 assert.equal(words().length,step.narr.trim().split(/\s+/).length);
 words().forEach((p,i)=>{assert.equal(p.style.animationPlayState,'paused');assert(p.style.animation.includes('220ms ease-in '+i*110+'ms both'));});
 const keys=words().map(p=>p.key).join();
 spoken.at(-1).onstart();assert(words().every(p=>p.style.animationPlayState==='running'));
 assert.equal(words().map(p=>p.key).join(),keys);
 spoken.at(-1).onend({elapsedTime:3});assert(words().every(p=>p.style.animation==='none'));
}
g.speak('...and these two shapes are closed.',()=>{},3000);
assert(words()[0].text==='...and');assert.equal(words().at(-1).text,'closed.');
assert(words().at(-1).style.animation.includes('2780ms both'));
const old=spoken.at(-1),oldKey=words()[0].key;
g.speak('New line.',()=>{});const fresh=spoken.at(-1);old.onstart();old.onend({elapsedTime:4});
assert.equal(g.state.wordReveal,'waiting');assert.equal(g.state.narrPage,'New line.');assert.notEqual(words()[0].key,oldKey);
fresh.onstart();fresh.onerror();assert.equal(g.state.wordReveal,'complete');
g.retryVoice();assert.equal(g.state.wordReveal,'waiting');spoken.at(-1).onstart();assert.equal(g.state.wordReveal,'playing');
g.prepareNarratorReveal('Space  preserved.',2000);assert.equal(g.narratorParts().map(p=>p.text).join(''),'Space  preserved.');
assert(html.includes('.narrator-text span { animation:none !important; opacity:1 !important; transform:none !important; }'));
console.log('PASS: 47 lines, VO-start gate, 110ms stagger, 220ms fade, duration distribution, punctuation/spaces, completion, stale cancellation and retry.');
