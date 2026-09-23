const fs=require('fs'),vm=require('vm'),assert=require('assert');const html=fs.readFileSync('index.html','utf8');let frames=[];const ctx={window:{matchMedia:()=>({matches:false})},document:{documentElement:{clientWidth:1920,clientHeight:1080}},React:{createRef:()=>({current:null})},DCLogic:class{setState(v,cb){Object.assign(this.state,typeof v==='function'?v(this.state):v);if(cb)cb();}},setTimeout,clearTimeout,requestAnimationFrame:f=>frames.push(f)};vm.createContext(ctx);vm.runInContext(fs.readFileSync('responsive-layout.js','utf8'),ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',ctx);
const g=new ctx.Game();g.P=ctx.window.POLY;g.svgRefs={};g.state.ready=true;g.state.k=1;g.state.phase='draw';g.state.drawing=true;g.later=()=>{};g.sfx=()=>{};let distance=0,done=0;const path={style:{},getTotalLength:()=>1000,getPointAtLength:d=>{distance=d;return{x:d,y:d};}},dot={setAttribute(){}};g.svgRefs[0]={current:{querySelector:s=>s==='[data-trace]'?path:dot}};g.runDraw(2000,()=>done++);
for(const time of [100,600,1100,1600]){frames.shift()(time);assert(Math.abs(distance/10+Number(path.style.strokeDashoffset)-100)<1e-9);assert(distance>=0&&distance<=1000);}
assert.equal(g.drawProgress,.84375);frames.shift()(2100);assert.equal(done,1);assert(g.state.drawn&&!g.state.drawing&&!g.state.tracing);let c=g.renderVals().cards[0];assert.equal(c.pathClass,'created-shape');assert.equal(c.gStyle.animation,'none');/* The teaching phases share one box, so the point, the drawing, the close-up and
   the trace never shift by a pixel between them. The question is deliberately
   not in that group: it needs the lower third for its Open and Closed controls,
   and it re-reveals the shape with the magic animation, so the smaller box
   arrives with the reveal rather than as a jump. check-point-intro.cjs holds the
   numbers for both. */
const position=[c.wrap.left,c.wrap.top,c.wrap.width,c.wrap.height];
for(const ph of ['point','closer','trace']){g.state.phase=ph;const v=g.renderVals();if(ph==='point'){assert.equal(v.cards.length,0);continue;}assert.deepEqual([v.cards[0].wrap.left,v.cards[0].wrap.top,v.cards[0].wrap.width,v.cards[0].wrap.height],position,ph+' moved the shape');}
g.state.phase='ask';c=g.renderVals().cards[0];assert.notDeepEqual([c.wrap.left,c.wrap.top,c.wrap.width,c.wrap.height],position,'the question no longer makes room for its controls');
assert(Number(String(c.wrap.height).replace('px',''))<Number(String(position[3]).replace('px','')),'the question box should be the smaller one');
g.state.phase='draw';
ctx.window.matchMedia=()=>({matches:true});g.runDraw(2000,()=>done++);assert.equal(done,2);assert.equal(frames.length,0);
ctx.window.matchMedia=()=>({matches:false});g.runDraw(2000,()=>done++);g.gen=1;frames.shift()(3000);assert.equal(done,2);
for(let k=0;k<g.steps().length;k++){g.state.k=k;g.state.phase=g.steps()[k].ph||'';g.renderVals();}
console.log('PASS: synchronized eased stroke/light, exact completion, fixed geometry, reduced motion, cancellation, and 47 lesson views.');
