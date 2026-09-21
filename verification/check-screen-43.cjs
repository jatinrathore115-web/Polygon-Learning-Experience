const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','screen-43');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9374,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.playbackRate=5;return play.call(this);};});
  await page.goto('http://127.0.0.1:9374/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);await page.mouse.click(700,80);
  await page.evaluate(()=>{__poly._guideGreeted=true;__poly.advance=()=>{window.finished=true;};});
  const go=async(k)=>{await page.evaluate(k=>{__poly.setState({k,sortAt:{},pickedFig:null});__poly.runStep(k,false);},k);await page.waitForFunction(()=>!__poly.locked()&&!__poly.state.speaking&&__poly.state.storyControls);await page.waitForTimeout(1100);};
  const sample=()=>page.evaluate(()=>{
   const b=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const v=__poly.renderVals();return{board:b(document.querySelector('.story-board')),guide:b(document.querySelector('.swiftee-wrap')),dialogue:b(document.querySelector('.dialogue-box')),
    surface:b(document.querySelector('.story-surface')),cards:[...document.querySelectorAll('.story-surface svg')].map(e=>b(e.parentElement)),zones:v.targets.map(t=>t.style),bgOpacity:getComputedStyle(document.querySelector('.boundary-background')).opacity};
  });
  await go(13);const reference=await sample();
  await go(42);let s=await sample();
  assert.deepEqual(s.board,reference.board);assert.deepEqual(s.guide,reference.guide);assert.equal(s.dialogue.x,reference.dialogue.x);assert.equal(s.dialogue.w,reference.dialogue.w);assert(Math.abs(s.dialogue.bottom-reference.dialogue.bottom)<1);
  assert.equal(s.cards.length,5);assert.equal(s.bgOpacity,'1');
  const checkBounds=s=>{for(const c of s.cards)assert(c.x>s.board.x&&c.right<s.board.right&&c.y>s.board.y&&c.bottom<s.board.bottom-12);assert(s.dialogue.bottom<s.board.y);for(const z of s.zones){const scale=s.surface.w/1570;assert(s.surface.y+(parseFloat(z.top)+parseFloat(z.height))*scale<s.board.bottom-24);}};
  checkBounds(s);await page.screenshot({path:path.join(out,'initial.png')});
  const drag=async(index,zone)=>{
   const card=page.locator('.story-surface svg').nth(index).locator('..');const from=await card.boundingBox();
   const target=await page.getByRole('button',{name:zone,exact:true}).boundingBox();assert(target);
   await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:14});await page.mouse.up();
  };
  // Wrong group returns the circle; a retry must remain possible.
  await drag(1,'NOT POLYGONS');await page.waitForFunction(()=>__poly.state.sortAt[1]===1);await page.waitForTimeout(600);
  await drag(0,'NOT POLYGONS');await page.waitForFunction(()=>__poly.state.attempts>0);await page.waitForFunction(()=>!__poly.locked()&&!__poly.state.speaking);assert(await page.evaluate(()=>__poly.state.sortAt[0]===undefined));
  for(const i of [0,2,3,4]){await drag(i,i===4?'NOT POLYGONS':'POLYGONS');await page.waitForFunction(i=>__poly.state.sortAt[i]!==undefined,i);await page.waitForTimeout(600);}
  await page.waitForFunction(()=>window.finished);checkBounds(await sample());await page.screenshot({path:path.join(out,'completed.png')});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1024,height:768});await go(42);checkBounds(await sample());
  assert.equal(await page.locator('.story-board').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  const first=page.locator('.story-surface .game-action').filter({has:page.locator('svg')}).first();
  await first.focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'POLYGONS',exact:true}).focus();await page.keyboard.press('Space');
  await page.waitForFunction(()=>__poly.state.sortAt[0]===0);
  // Confirm the already implemented 17–19 composition and exact reference set.
  await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g.later=()=>0;});
  for(const k of [16,17,18]){
   await page.evaluate(k=>{const g=__poly;g.setState({k});g.runStep(k,false);g.prepareNarratorReveal(g.step().narr);g.setState({wordReveal:'complete',storyContent:true,storyDialogue:true,storyControls:true,polygonTravel:false});},k);await page.waitForTimeout(80);
   s=await sample();assert(s.guide.right<Math.min(...s.cards.map(c=>c.x)));assert(s.dialogue.right<Math.min(...s.cards.map(c=>c.x)));
   if(k===18){assert.equal(s.cards.length,4);assert.deepEqual(await page.evaluate(()=>__poly.sets().p19.map(f=>f[0])),['p19a','p19c','p19e','p19d']);}
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({screen:43,matchedScreen14:true,dragDrop:true,wrongRetry:true,completion:true,tablet:true,reducedMotion:true,existingScreens17to19:true,errors}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
