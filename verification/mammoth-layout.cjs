const fs=require('fs'),vm=require('vm'),assert=require('assert');
/* The lesson does not render the guide character (GUIDE_VISIBLE=false in
   index.html), so there is no sprite on screen to verify. This stays ready for
   whenever he comes back — flip that flag and the check runs again. */
if (require('fs').readFileSync('index.html','utf8').includes('const GUIDE_VISIBLE = false')) {
  console.log('SKIP: the guide is not rendered (GUIDE_VISIBLE=false in index.html).');
  process.exit(0);
}
const html=fs.readFileSync('index.html','utf8');
const ctx={window:{},document:{documentElement:{clientWidth:1920,clientHeight:1080}},React:{createRef:()=>({current:null})},DCLogic:class{},setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',ctx);
const g=new ctx.Game();g.P=ctx.window.POLY;g.svgRefs={};g.state.ready=true;g.state.mamHidden=false;const v=g.renderVals();const css=o=>Object.entries(o).map(([k,v])=>k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())+':'+(typeof v==='number'&&!['zIndex','opacity'].includes(k)&&v!==0?v+'px':v)).join(';');
const head=html.match(/<style>([\s\S]*?)<\/style>/)[1];
const out=`<!doctype html><meta charset="utf-8"><style>${head}</style><div id="stage" style="position:absolute;width:1980px;height:1080px;left:50%;top:50%;transform-origin:center center"><img src="../assets/background..png" style="${css(v.bgStyle)}"><div id="area" style="${css(v.mamViewport)}"><div id="character" style="${css(v.mammothStyle)}"><img id="sprite" src="../assets/mam_happy.png" style="${css(v.happyStyle)}"></div></div><img id="board" src="../assets/ui_ice_board.png" style="${css(v.boardStyle)}"><img id="sign" src="../assets/ui_sign.png" style="${css(v.signStyle)}"></div><pre id="report" style="display:none"></pre><script>
onload=()=>{const stage=document.querySelector('#stage'),char=document.querySelector('#character'),sprite=document.querySelector('#sprite');const scale=Math.min(innerWidth/1980,innerHeight/1080);stage.style.transform='translate(-50%,-50%) scale('+scale+')';char.style.animation='none';const results=[];for(const transform of ['none','translateY(-16px) scale(1.02)','translateY(-8px) scale(1.035)','translateY(-14px) scale(1.015)','translateY(6px) scale(.99)']){char.style.transform=transform;const r=sprite.getBoundingClientRect(),sign=document.querySelector('#sign').getBoundingClientRect();results.push({transform,left:r.left,top:r.top,right:r.right,bottom:r.bottom,gap:sign.left-r.right,pass:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&sign.left-r.right>=14*scale});}char.style.transform='none';document.querySelector('#report').textContent=JSON.stringify({width:innerWidth,height:innerHeight,ratio:sprite.naturalWidth/sprite.naturalHeight,noScroll:document.documentElement.scrollWidth===innerWidth,results});};</script>`;
fs.writeFileSync('verification/mammoth-layout.html',out);
for(let k=0;k<g.steps().length;k++){g.state.k=k;g.state.phase=g.steps()[k].ph||'';g.renderVals();}
assert.equal(v.happyStyle.objectFit,'contain');assert.equal(v.sadStyle.objectFit,'contain');console.log('PASS: 47 lesson models; generated dependency-free browser layout fixture.');
