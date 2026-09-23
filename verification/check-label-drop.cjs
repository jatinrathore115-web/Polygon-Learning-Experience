const fs=require('fs'),vm=require('vm'),assert=require('assert');const events={};let animation,placed;
const c={React:{createRef:()=>({current:null})},window:{addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k]},DCLogic:class{setState(s,cb){Object.assign(this.state,s);if(cb)cb()}},setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){}};vm.createContext(c);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),c);vm.runInContext(fs.readFileSync('index.html','utf8').match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',c);const g=new c.Game();g.P=c.window.POLY;g.locked=()=>false;g.clearNudge=()=>{};g.sfx=()=>{};g.hitTarget=k=>()=>placed=k;
const target={getAttribute:()=> 'side',getBoundingClientRect:()=>({left:300,top:300,right:512,bottom:376,width:212,height:76})};g.safeRef={current:{getBoundingClientRect:()=>({width:1585}),querySelectorAll:()=>[target]}};
const ghost={style:{},parentElement:{getBoundingClientRect:()=>({left:0,top:0,width:1980})},animate(frames,options){animation={frames,options,cancel(){}};return animation;}};g.ghostRef={current:ghost};
const event=(x,y)=>({pointerId:1,button:0,clientX:x,clientY:y,preventDefault(){},currentTarget:{getBoundingClientRect:()=>({left:600,top:600,width:200,height:78})}});
g.dragLabel('Side')(event(700,639));events.pointermove(event(290,330));events.pointerup(event(290,330));assert.equal(placed,undefined);assert.equal(animation.options.duration,240);animation.onfinish();assert.equal(placed,'side');assert.equal(ghost.style.opacity,'0');
placed=undefined;g.state.placed={};g.dragLabel('Angle')(event(700,639));events.pointermove(event(330,330));events.pointerup(event(330,330));assert.equal(animation.options.duration,300);animation.onfinish();assert.equal(placed,'side');
const v={};g.viewLabels(v,{});assert.equal(v.cards[0].dots.length,1);assert(v.cards[0].arcs[1].d.includes(' A'));assert.equal(v.cards[0].arcs[1].fill,'none');console.log('PASS: tolerant drops, delayed placement after snap, return animation, neutral vertex and circular angle cues.');
let sounds=0;g.sfx=()=>sounds++;g.armStage2=()=>{};g.state.placed={side:'Side'};g._labelClickUntil=0;g.pickChip('Side')();assert.equal(sounds,0);g._labelClickUntil=Infinity;g.pickChip('Angle')();assert.equal(sounds,0);g._labelClickUntil=0;g.pickChip('Angle')();assert.equal(sounds,1);
/* Screen 23's short, non-interactive arrows connect each socket to its feature. */
const layout={};g.viewLabels(layout,{});
assert.equal(layout.leaders.length,3,'Each socket has one arrow');
for(const line of layout.leaders){
 assert.equal(line.style.background,g.labelTheme(line.labelKey).color);
 assert.equal(line.style.pointerEvents,'none','Arrows cannot intercept label drops');
 assert(parseFloat(line.style.width)>0&&parseFloat(line.style.width)<150,'Arrows remain short');
 const angle=parseFloat(line.style.transform.slice(7));
 assert(line.labelKey==='side'?Math.abs(angle)===180:line.labelKey==='vertex'?angle>0&&angle<30:angle<0&&angle>-30,'Arrow points from socket towards its feature');
}
assert.equal(layout.targets.length,3,'Three sockets remain');
for(const target of layout.targets){const t=target.style;
  assert(Number.isFinite(parseFloat(t.left))&&Number.isFinite(parseFloat(t.top)),'Socket is placed at a real position');
  assert(parseFloat(t.width)>0&&parseFloat(t.height)>0,'Socket has a real size');
  assert(!/dashed/.test(t.border),'Sockets are not drawn with broken lines');}
/* A socket still has to read as somewhere to drop rather than a button to
   press: it is sunk into the board, where a label tile stands off it. */
assert(layout.targets.every(target=>/inset/.test(target.style.boxShadow)),'Empty sockets are recessed');
console.log('PASS: used/suppressed options remain silent; valid option responds immediately.');
