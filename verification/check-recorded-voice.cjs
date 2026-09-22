const fs=require('fs'),vm=require('vm'),assert=require('assert');const html=fs.readFileSync('index.html','utf8');let spoken=[],timers=[];
const ctx={window:{speechSynthesis:{cancel(){},speak(u){spoken.push(u);}}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},document:{documentElement:{clientWidth:1920,clientHeight:1080}},React:{createRef:()=>({current:null})},DCLogic:class{setState(v,cb){Object.assign(this.state,typeof v==='function'?v(this.state):v);if(this.componentDidUpdate)this.componentDidUpdate();if(cb)cb();}},setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',ctx);
function game(k){const g=new ctx.Game();g.P=ctx.window.POLY;g.svgRefs={};g.state.ready=true;g.state.k=k;g.state.phase=g.step().ph||'';g.later=f=>timers.push(f);g.sfx=()=>{};g.armNudge=()=>{};return g;}
function drain(g){let cap=100;while(g._voiceReading&&--cap){spoken.at(-1).onstart();spoken.at(-1).onend();}assert(cap>0);}

let media=[],frames=[];
ctx.requestAnimationFrame=f=>{frames.push(f);return frames.length};ctx.cancelAnimationFrame=()=>{};
ctx.Audio=class {constructor(src){this.src=src;this.duration=6;this.currentTime=0;this.paused=true;media.push(this)} play(){this.paused=false;return Promise.resolve()} pause(){this.paused=true} removeAttribute(){} load(){} };
vm.runInContext(fs.readFileSync('voiceovers/recordings.js','utf8'),ctx);vm.runInContext(fs.readFileSync('voiceovers/recorded-player.js','utf8'),ctx);
const rows=JSON.parse(fs.readFileSync('voiceovers/narrator-lines.json','utf8'));
const missing=rows.filter(r=>!ctx.window.PolygonRecordedVoice.find(r.text)).map(r=>r.id);
assert.deepEqual(missing,['N016','F003','F023']);
// Audit the live lesson, not just the historical narration export.
for(const step of game(0).steps())for(const text of [step.narr,...Object.values(step.fb||{})]) {
  const recording=ctx.window.PolygonRecordedVoice.find(text);
  assert(recording,'Every current instruction and feedback line has portable audio: '+text);
  assert(ctx.window.PolygonRecordedVoice.wordStarts(recording,text),'Every live recording has matching word cues: '+text);
}
for(const row of ctx.window.POLYGON_RECORDINGS){
  assert(fs.existsSync(decodeURIComponent(row.src)));
  const starts=ctx.window.PolygonRecordedVoice.wordStarts(row,row.text);
  assert(starts && starts.length===(row.text.match(/\S+/g)||[]).length,row.text);
  assert(starts.every(time=>time>=0 && time<row.duration),row.text);
}
const g=game(4);g.narrate(g.step().narr,{});assert.equal(spoken.length,0);assert(g.locked());const a=media.at(-1);assert.equal(g.state.wordReveal,'waiting');
a.onplaying();assert.equal(g.state.revealedWords,0);a.currentTime=3;a.ontimeupdate();assert(g.state.revealedWords>1);assert(g.locked());
a.onended();assert(!g.locked());assert.equal(g.state.wordReveal,'complete');
g.state.k=g.steps().findIndex(s=>s.sc==='S9');g.narrate(rows.find(r=>r.id==='N018').text,{});const b=media.at(-1);b.onplaying();const first=g.state.narrPage;b.currentTime=5.5;b.ontimeupdate();assert.equal(g.state.narrPage,first,'A fitting sentence remains on one page');assert(g.state.revealedWords>5,'The later words continue revealing');assert(g.locked());
const old=b.onended;g.narrate('Look! A point.',{});old();assert(g.locked());assert(b.paused);media.at(-1).onerror();assert.equal(g.state.wordReveal,'complete','Failed audio leaves the instruction readable');assert(g._voiceRetry);assert(g.locked());g.retryVoice();assert.equal(g.state.wordReveal,'waiting');
console.log('PASS: every current lesson prompt and configured feedback has local audio and word cues; historical export lookup, continuous long lines, end gate, cancellation, failure and retry.');

const entry=ctx.window.PolygonRecordedVoice.find('Look! A point.');entry.words=[{word:'Look!',start:.4},{word:'A',start:.9},{word:'point.',start:1.8}];
g.narrate('Look! A point.',{});const aligned=media.at(-1);aligned.onplaying();assert.equal(g.state.revealedWords,0);
for(const [time,count]of [[.39,0],[.4,1],[.89,1],[.9,2],[1.79,2],[1.8,3]]){aligned.currentTime=time;aligned.ontimeupdate();assert.equal(g.state.revealedWords,count);}
assert.equal(ctx.window.PolygonRecordedVoice.wordStarts({words:[{word:'Wrong',start:0}]},'Look! A point.'),null);
console.log('PASS: exact timestamp boundaries, leading silence, spoken pauses and mismatched-alignment rejection.');

const fallback=game(15);fallback.narrate('Select all the shapes made using only straight lines.',{});
const utterance=spoken.at(-1);utterance.onstart();utterance.onboundary({name:'word',charIndex:7});
assert.equal(fallback.state.revealedWords,2);assert.equal(fallback.state.wordReveal,'recorded');
utterance.onboundary({name:'word',charIndex:11});assert.equal(fallback.state.revealedWords,3);
console.log('PASS: all recording alignments validated; speech fallback uses word-boundary events.');
