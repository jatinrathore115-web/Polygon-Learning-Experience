require('fs').mkdirSync('verification/output', { recursive: true });
const fs=require('fs'),vm=require('vm'),assert=require('assert');const html=fs.readFileSync('index.html','utf8');let spoken=[],timers=[];
const ctx={window:{speechSynthesis:{cancel(){},speak(u){spoken.push(u);}}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},document:{documentElement:{clientWidth:1920,clientHeight:1080}},React:{createRef:()=>({current:null})},DCLogic:class{setState(v,cb){Object.assign(this.state,typeof v==='function'?v(this.state):v);if(this.componentDidUpdate)this.componentDidUpdate();if(cb)cb();}},setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',ctx);
function game(k){const g=new ctx.Game();g.P=ctx.window.POLY;g.svgRefs={};g.state.ready=true;g.state.k=k;g.state.phase=g.step().ph||'';g.later=f=>timers.push(f);g.sfx=()=>{};g.armNudge=()=>{};return g;}
function drain(g){let cap=100;while(g._voiceReading&&--cap){spoken.at(-1).onstart();spoken.at(-1).onend();}assert(cap>0);}
let g=game(4);g.narrate(g.step().narr,{});assert(g.locked());assert.equal(g.safeStyle().pointerEvents,'none');g.choose('closed');assert.equal(g.state.ok,null);const first=spoken.at(-1);first.onstart();for(const timer of timers)timer();assert(g.locked());first.onend();assert.equal(spoken.at(-1),first);assert(!g.locked());assert.equal(g.safeStyle().pointerEvents,'auto');
// An error, or an obsolete utterance completing after replay, must never unlock.
g.narrate('Retry test',{});const failed=spoken.at(-1);failed.onerror();failed.onend();assert(g.locked());assert(g._voiceRetry&&!g.state.voiceError,'a blocked line arms a silent retry, it does not stop to ask for a tap');g.unlockAudio({isTrusted:true,type:'pointerup'});const retry=spoken.at(-1);assert.notEqual(retry,failed,'A game tap should retry blocked narration without a button');failed.onend();assert(g.locked());retry.onstart();retry.onend();assert(!g.locked());
g.narrate('Old',{});const old=spoken.at(-1);g.narrate('New',{});old.onend();assert(g.locked());drain(g);
/* A missing voice reads on instead of stopping: the line stays up, input stays
   locked until its reading time is up, and a retry stays armed so the learner's
   next touch brings the sound back. What it must never do is put a prompt on
   screen asking to be tapped. */
const synth=ctx.window.speechSynthesis;ctx.window.speechSynthesis=null;g.narrate('Unavailable',{});assert(g.locked()&&g._voiceRetry&&!g.state.voiceError);ctx.window.speechSynthesis=synth;
// Labels, buttons and changing counters never enqueue speech.
spoken=[];g=game(41);g.narrate(g.step().narr,{});drain(g);assert.equal(spoken.length,g.instructionPages(g.step().narr).length);assert.equal(spoken.map(u=>u.text).join(' '),g.step().narr);
g=game(23);g.narrate(g.step().narr,{});drain(g);let count=spoken.length;g.bump(0,1)();assert(!g.locked());assert.equal(g.state.cnt[0],5);assert.equal(spoken.length,count);
// Actual drag handler is inert while narration is playing.
g=game(26);g.narrate(g.step().narr,{});g.handleDown(0)({preventDefault(){},stopPropagation(){}});assert.equal(g.state.userPts,null);drain(g);assert(!g.locked());
// Opening a dropdown does not speak its options or re-lock input.
g=game(13);g.narrate(g.step().narr,{});drain(g);count=spoken.length;g.ddToggle(0)();assert(!g.locked());assert.equal(spoken.length,count);
// A timed advance waits for audio, while a user click cannot queue a skip.
g=game(4);g.narrate(g.step().narr,{});g.advance({type:'click'});assert(!g._advanceAfterVoice);g.advance();assert(g._advanceAfterVoice);let advances=0;g.advance=()=>advances++;drain(g);assert.equal(advances,1);
// Audio from a discarded screen cannot release the next screen's lock.
g=game(4);g.narrate(g.step().narr,{});const discarded=spoken.at(-1);g.gen=(g.gen||0)+1;discarded.onend();assert(g.locked());
// Across all screens, only the brown-panel line is spoken, even with labels revealed.
const coverage=[];for(let k=0;k<47;k++){const h=game(k);h.state.drawn=true;h.state.reveal=true;spoken=[];h.narrate(h.step().narr,{});drain(h);assert.equal(spoken.map(u=>u.text).join(' '),h.state.narr);coverage.push({step:k+1,narration:h.state.narr});}
fs.writeFileSync('verification/output/voice-coverage.json',JSON.stringify(coverage,null,2));console.log('PASS: narrator-only speech on 47 screens, strict audio-end gate, errors/retry, stale events, silent labels/counters/options and drag lock.');

for(const row of JSON.parse(fs.readFileSync('voiceovers/narrator-lines.json','utf8'))){
 const h=game(4), pages=h.instructionPages(row.text);
 assert.equal(pages.join(' '),row.text.replace(/\s+/g,' ').trim());
 /* a page must fit the sign, which now means one line or two — pages wider
    than that used to be the rule, and splitting a line that already fits made
    the instruction blink mid-sentence when the pager swapped pages */
 pages.forEach(page=>assert(h.signFits(page),'page does not fit the sign: '+page));
 spoken=[];h.narrate(row.text,{});
 for(let i=0;i<pages.length;i++){assert(h.locked());assert.equal(h.state.narrPage,pages[i]);const u=spoken.at(-1);u.onstart();u.onend();}
 assert(!h.locked());
}
console.log('PASS: all 75 recording lines fit the sign as whole pages with exact wording, synchronized speech and locking through the final phrase.');
