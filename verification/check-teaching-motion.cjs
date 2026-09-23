const fs=require('fs'),vm=require('vm'),assert=require('assert');const html=fs.readFileSync('index.html','utf8');const c={window:{},React:{createRef:()=>({current:null})},DCLogic:class{},setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),c);vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',c);const g=new c.Game();g.P=c.window.POLY;
assert(html.includes('fill="{{ a.fill }}"'));assert(!html.includes("a.fill ||"));
for(const phase of ['sides','vertex','angle']){g.state.phase=phase;g.state.voiceElapsedMs=null;let v={};g.viewParts(v,{});assert.equal(v.callouts.at(-1).style.animationPlayState,'paused');assert(parseFloat(v.callouts.at(-1).style.animationDelay)>0);g.state.voiceElapsedMs=5000;v={};g.viewParts(v,{});assert(parseFloat(v.callouts.at(-1).style.animationDelay)<0);if(phase==='angle'){assert.equal(v.cards[0].arcs[1].fill,'none');assert.equal(v.cards[0].arcs[0].fill,'rgba(21,156,168,.14)');assert.equal(v.cards[0].arcs[0].style.animationName,'cueFade');}}
c.window.matchMedia=()=>({matches:true});let v={};g.viewParts(v,{});assert(!v.cards[0].arcs[0].style.animationName);assert(!v.callouts.at(-1).style.animationName);console.log('PASS: explicit SVG fills, audio-clock cue sequencing, stationary shading, reduced motion.');
vm.runInContext(fs.readFileSync('voiceovers/recordings.js','utf8'),c);
vm.runInContext(fs.readFileSync('voiceovers/recorded-player.js','utf8'),c);
c.window.matchMedia=()=>({matches:false});
for(const phase of ['sides','vertex','angle']){
  const step=g.steps().find(s=>s.sc==='S11'&&s.ph===phase);g.state.phase=phase;g.state.voiceElapsedMs=0;
  const v={};g.viewParts(v,step);
  const recording=c.window.PolygonRecordedVoice.find(step.narr);
  const word=recording.words.find(w=>w.word.toLowerCase().replace(/[^a-z]/g,'')===(phase==='sides'?'sides':phase));
  assert.equal(parseFloat(v.callouts.at(-1).style.animationDelay),word.start*1000);
  const shaft=parseFloat(v.leaders.at(-1).style.width);assert(shaft>=(phase==='sides'?20:50)&&shaft<=60);
  assert.equal(v.cards[0].wrap.width,'750px');
  for(const label of v.callouts){
    const left=parseFloat(label.style.left),top=parseFloat(label.style.top);
    assert(left-100>=0&&left+100<=1570&&top-42>=0&&top+42<=701,'label stays inside the content area');
  }
  if(phase==='vertex'){
    assert(v.cards[0].hl.every(h=>h.color!==v.cards[0].stroke),'meeting sides contrast with the outline');
    const edges=v.cards[0].hl[0].style;
    assert(parseFloat(edges.animationDelay)+parseFloat(edges.animationDuration)<=parseFloat(v.cards[0].dots[0].style.animationDelay));
    assert.equal(v.cards[0].dots[0].style.animationDelay,v.callouts.at(-1).style.animationDelay);
  }
  if(phase!=='sides'){
    const end=g.fig('pentagon').pts[2].join(' ');
    assert(v.cards[0].hl.every(h=>h.d.trim().endsWith(end)));
    assert.equal(v.cards[0].hl[0].style.animationDelay,v.cards[0].hl[1].style.animationDelay);
  }else assert.notEqual(v.cards[0].hl[0].color,v.cards[0].stroke);
}
console.log('PASS: recorded concept timestamps, converging edges, distinct side highlight, balanced arrows.');
