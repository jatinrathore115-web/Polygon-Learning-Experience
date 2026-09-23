const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','screen-46');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9376,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.playbackRate=5;return play.call(this);};});
  await page.goto('http://127.0.0.1:9376/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);await page.mouse.click(700,80);
  // Exercise interaction gates without relying on the host's speech service.
  await page.evaluate(()=>{
   __poly._guideGreeted=true;__poly.advance=()=>{window.finished=true;};
   __poly.speak=function(text,cb){this.prepareNarratorReveal(text);this.storyVoiceStart();this.setState({wordReveal:'complete'});this.later(cb,100);};
  });
  const ready=()=>page.waitForFunction(()=>!__poly.locked()&&!__poly.state.speaking&&__poly.state.storyControls&&__poly.state.storyContent);
  const go=async k=>{await page.evaluate(k=>{window.finished=false;__poly.setState({k,sortAt:{}});__poly.runStep(k,false);},k);await ready();await page.waitForTimeout(1200);};
  const sample=()=>page.evaluate(()=>{
   const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const v=__poly.renderVals();return {board:box(document.querySelector('.story-board')),guide:box(document.querySelector('.swiftee-wrap')),dialogue:box(document.querySelector('.dialogue-box')),cards:[...document.querySelectorAll('.story-surface svg')].map(e=>box(e.parentElement)),zones:v.targets.map(t=>t.style),background:getComputedStyle(document.querySelector('.boundary-background')).opacity};
  });
  const compare=(s,ref)=>{
   assert.deepEqual(s.board,ref.board);assert.deepEqual(s.guide,ref.guide);assert.deepEqual(s.zones,ref.zones);
   assert(Math.abs(s.dialogue.right-ref.dialogue.right)<1);assert(Math.abs(s.dialogue.bottom-ref.dialogue.bottom)<1);
   assert.equal(s.cards.length,4);assert.equal(s.background,'1');
   for(const c of s.cards){assert(Math.abs(c.w-ref.cards[0].w)<0.1);assert(Math.abs(c.y-ref.cards[0].y)<0.1);assert(c.x>s.board.x&&c.right<s.board.right);}
   assert(Math.abs((s.cards[0].x+s.cards[3].right)/2-(s.board.x+s.board.w/2))<1);
  };
  await go(42);let ref=await sample();await go(45);compare(await sample(),ref);
  await page.screenshot({path:path.join(out,'initial.png')});
  const cards=page.locator('.story-surface svg').locator('..');
  const drag=async(i,name,inspect)=>{const a=await cards.nth(i).boundingBox(),b=await page.getByRole('button',{name,exact:true}).boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:14});if(inspect){await page.waitForTimeout(100);await inspect();}await page.mouse.up();};
  await drag(0,'Heptagon');await page.waitForFunction(()=>__poly.state.attempts>0);await ready();assert(await page.evaluate(()=>__poly.state.sortAt[0]===undefined));
  for(const i of [0,2]){await drag(i,'Hexagon');await page.waitForFunction(i=>__poly.state.sortAt[i]!==undefined,i);await page.waitForTimeout(600);}
  const before=await page.evaluate(()=>JSON.stringify(__poly.sortPlaces(__poly.state.sortAt)));
  await drag(1,'Hexagon',async()=>{
   assert.equal(await page.evaluate(()=>__poly.renderVals().callouts.length),0,'No third preview slot in a full area');
   assert.equal(await page.evaluate(()=>__poly.renderVals().zoneAStyle.animation),'none');
  });
  await page.waitForFunction(()=>__poly.state.wrong===1&&__poly.state.draggingFigure===null);
  assert.equal(await page.evaluate(()=>JSON.stringify(__poly.sortPlaces(__poly.state.sortAt))),before);
  assert(await page.evaluate(()=>__poly.renderVals().cards[1].wrap.animation.startsWith('wrongTap')));
  await page.waitForTimeout(650);
  for(const i of [1,3]){await drag(i,'Heptagon');await page.waitForFunction(i=>__poly.state.sortAt[i]!==undefined,i);await page.waitForTimeout(600);}
  await page.waitForFunction(()=>window.finished);await page.screenshot({path:path.join(out,'completed.png')});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1024,height:768});
  await go(42);ref=await sample();await go(45);compare(await sample(),ref);
  await cards.first().focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Hexagon',exact:true}).focus();await page.keyboard.press('Space');await page.waitForFunction(()=>__poly.state.sortAt[0]===0);
  assert.deepEqual(errors,[]);console.log('PASS Screen 46 matches Screen 43; four centered figures, drag/drop, wrong retry, completion, tablet and keyboard verified.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
