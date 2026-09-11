const fs=require('fs'),vm=require('vm'),assert=require('assert');const html=fs.readFileSync('index.html','utf8');let frames=[];const ctx={window:{matchMedia:()=>({matches:false})},document:{documentElement:{clientWidth:1920,clientHeight:1080}},React:{createRef:()=>({current:null})},DCLogic:class{setState(v,cb){Object.assign(this.state,typeof v==='function'?v(this.state):v);if(cb)cb();}},setTimeout,clearTimeout,requestAnimationFrame:f=>frames.push(f)};vm.createContext(ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',ctx);

let starts=[],contexts=[];
const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
const node=()=>({gain:param(),frequency:param(),Q:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){},disconnect(){},start(t){starts.push(t)},stop(){}});
class AudioContext {
 constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=100;this.destination={};contexts.push(this);}
 createGain(){return node()} createDynamicsCompressor(){return node()} createOscillator(){return node()}
 createBiquadFilter(){return node()} createBufferSource(){return node()}
 createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)}}
 resume(){return new Promise(resolve=>{(this.pending||(this.pending=[])).push(resolve)})}
 finish(){this.state='running';this.currentTime=12;this.pending.splice(0).forEach(f=>f())}
}
ctx.window.AudioContext=AudioContext;
(async()=>{
 const g=new ctx.Game();g.state.muted=false;
 g.sfx('party');assert.equal(starts.length,0,'No scheduling on suspended clock');
 contexts[0].finish();await new Promise(setImmediate);
 assert.equal(starts.length,5);assert(starts.every(t=>t>=12));assert.equal(g._sfxOutput.gain.value,2);
 starts=[];g._ac.state='interrupted';g.sfx('tap');g.gen=(g.gen||0)+1;g._ac.finish();await new Promise(setImmediate);assert.equal(starts.length,0,'Stale screen effects discarded');
 g._ac.state='closed';g.sfx('snap');assert.equal(contexts.length,2);g._ac.finish();await new Promise(setImmediate);assert.equal(starts.length,2);
 starts=[];g._ac.state='suspended';g.startDrawingSound(2000);g.stopDrawingSound();g._ac.finish();await new Promise(setImmediate);assert.equal(starts.length,0,'Cancelled drawing does not start late');
 g.startDrawingSound(2000);assert(g._drawingSound);g.stopDrawingSound();assert(!g._drawingSound);

 starts=[];frames=[];g._ac.state='suspended';g.svgRefs={0:{current:{querySelector:s=>s==='[data-trace]'?{style:{},getTotalLength:()=>100,getPointAtLength:d=>({x:d,y:0})}:{setAttribute(){}}}}};g.later=()=>{};
 let completed=0;g.runDraw(2000,()=>completed++);
 assert.equal(frames.length,0,'Leaf waits for audio readiness');assert.equal(starts.length,0);
 g._ac.finish();await new Promise(setImmediate);assert.equal(frames.length,1);
 frames.shift()(100);assert.equal(starts.length,1,'Drawing sound starts on first leaf frame');assert(g._drawingSound);
 frames.shift()(2100);assert.equal(completed,1);assert(!g._drawingSound,'Drawing sound ends with the leaf');
 starts=[];g.state.muted=true;g.sfx('party');assert.equal(starts.length,0);
 console.log('PASS: audio resume timing, interruption, closed-context recovery, stale effects, drawing cancellation, mute and output gain.');
})().catch(e=>{console.error(e);process.exitCode=1});

