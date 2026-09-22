const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');let utterances=[],timers=[],reduced=false;
const ctx={window:{matchMedia:()=>({matches:reduced}),speechSynthesis:{cancel(){},speak(u){utterances.push(u);}}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},document:{documentElement:{clientWidth:1920,clientHeight:1080}},React:{createRef:()=>({current:null})},DCLogic:class{setState(v,cb){Object.assign(this.state,typeof v==='function'?v(this.state):v);if(cb)cb();}},setTimeout:()=>0,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);
vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',ctx);
const g=new ctx.Game();g.P=ctx.window.POLY;g.state.ready=true;g.state.k=18;g.later=f=>timers.push(f);g.sfx=g.armNudge=()=>{};
const words=()=>g.narratorParts().filter(p=>p.style.display==='inline-block');
const visible=()=>words().filter(p=>p.style.opacity===1).length;
for(const step of g.steps()){
 g.speak(step.narr,()=>{});assert.equal(visible(),0,'Waiting words stay hidden');
 const u=utterances.at(-1),tokens=[...step.narr.matchAll(/\S+/g)];u.onstart();
 for(let i=0;i<tokens.length;i++){
  u.onboundary({name:'word',charIndex:tokens[i].index});
  assert.equal(visible(),i+1,'Every TTS boundary reveals exactly the spoken prefix');
  assert(words().every(p=>p.style.animation==='none'),'Boundary-timed text has no delayed fade');
  for(const timer of timers.splice(0))timer();
  assert.equal(visible(),i+1,'Wall-clock callbacks cannot reveal the rest of a playing sentence');
 }
 u.onpause();assert(words().every(p=>p.style.animationPlayState==='paused'));u.onresume();
 u.onend({elapsedTime:7});assert.equal(visible(),tokens.length);
}
g.speak('Old sentence.',()=>{});const stale=utterances.at(-1);g.speak('New line.',()=>{});stale.onboundary({name:'word',charIndex:4});stale.onend();assert.equal(visible(),0);
utterances.at(-1).onerror();assert.equal(visible(),2,'Audio failure leaves a readable instruction');
g.prepareNarratorReveal('Space  preserved.');assert.equal(g.narratorParts().map(p=>p.text).join(''),'Space  preserved.');
let media=[];ctx.Audio=class{constructor(){this.currentTime=0;this.duration=NaN;this.paused=true;media.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){}load(){}};
vm.runInContext(fs.readFileSync('voiceovers/recordings.js','utf8'),ctx);vm.runInContext(fs.readFileSync('voiceovers/recorded-player.js','utf8'),ctx);
let boundaries=0;
for(const entry of ctx.window.POLYGON_RECORDINGS){
 const starts=ctx.window.PolygonRecordedVoice.wordStarts(entry,entry.text);assert(starts,'Validated alignment: '+entry.text);
 const pages=g.instructionPages(entry.text),counts=pages.map(p=>p.match(/\S+/g).length);
 g.speak(entry.text,()=>{});const audio=media.at(-1);audio.duration=entry.duration;audio.onplaying();
 for(const time of [...new Set(starts)].flatMap(t=>[Math.max(0,t-.001),t])){
  audio.currentTime=time;audio.ontimeupdate();
  const total=starts.filter(t=>t<=time).length;let page=0,offset=0;
  while(page<pages.length-1&&Math.max(0,total-1)>=offset+counts[page])offset+=counts[page++];
  assert.equal(g.state.narrPage,pages[page]);assert.equal(visible(),Math.max(0,total-offset),'MP3 cue: '+entry.text+' @ '+time);
  const before=visible();for(const timer of timers.splice(0))timer();assert.equal(visible(),before);
  boundaries++;
 }
 audio.paused=true;audio.onpause();const before=visible();audio.ontimeupdate();assert.equal(visible(),before);
 audio.paused=false;audio.onplaying();audio.currentTime=entry.duration;audio.onended();assert.equal(g.state.narrPage,pages.at(-1));assert.equal(visible(),counts.at(-1));
}
reduced=true;g.speak('Look! A point.',()=>{});const a=media.at(-1);a.onplaying();a.currentTime=.34;a.ontimeupdate();assert.equal(visible(),1,'Reduced motion preserves word timing');
assert(!html.includes('.narrator-text span { animation:none !important; opacity:1 !important;'));
console.log('PASS: all 47 TTS lines and 75 recording alignments ('+boundaries+' boundary checks), pauses, final pages, no early reveal, stale events, readable errors and reduced motion.');
