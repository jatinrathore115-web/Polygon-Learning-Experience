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
  await page.evaluate(()=>{
   __poly._guideGreeted=true;__poly.advance=()=>{window.finished=true;};window.sounds=[];__poly.sfx=name=>sounds.push(name);
   // Keep narration gates asynchronous without depending on host speech services.
   __poly.speak=function(text,cb){this.prepareNarratorReveal(text);this.storyVoiceStart();this.setState({wordReveal:'complete'});this.later(cb,text===this.step().fb?.ok?1400:100);};
  });
  const go=async(k)=>{await page.evaluate(k=>{__poly.setState({k,sortAt:{},pickedFig:null});__poly.runStep(k,false);},k);await page.waitForFunction(()=>!__poly.locked()&&!__poly.state.speaking&&__poly.state.storyControls);await page.waitForTimeout(1100);};
  const sample=()=>page.evaluate(()=>{
   const b=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const v=__poly.renderVals();return{board:b(document.querySelector('.story-board')),guide:b(document.querySelector('.swiftee-wrap')),dialogue:b(document.querySelector('.dialogue-box')),
    surface:b(document.querySelector('.story-surface')),cards:[...document.querySelectorAll('.story-surface svg')].map(e=>b(e.parentElement)),zones:v.targets.map(t=>t.style),bgOpacity:getComputedStyle(document.querySelector('.boundary-background') || document.querySelector('.story-board')).opacity};
  });
  await go(13);const reference=await sample();
  const sortIndex=await page.evaluate(()=>__poly.steps().findIndex(s=>s.sc==='C2'));
  await go(sortIndex);let s=await sample();
  assert.deepEqual(s.board,reference.board);assert.deepEqual(s.guide,reference.guide);assert(Math.abs(s.dialogue.right-reference.dialogue.right)<1);assert(Math.abs(s.dialogue.bottom-reference.dialogue.bottom)<1);
  assert.equal(s.cards.length,4);assert.equal(s.bgOpacity,'1');
  assert.deepEqual(await page.evaluate(()=>__poly.step().answer),[0,1,0,1]);
  const checkBounds=s=>{for(const c of s.cards)assert(c.x>s.board.x&&c.right<s.board.right&&c.y>s.board.y&&c.bottom<s.board.bottom-12);assert(s.dialogue.bottom<s.board.y);for(const z of s.zones){const scale=s.surface.w/1570;assert(s.surface.y+(parseFloat(z.top)+parseFloat(z.height))*scale<s.board.bottom-24);}};
  checkBounds(s);await page.screenshot({path:path.join(out,'initial.png')});
  const drag=async(index,zone)=>{
   const card=page.locator('.story-surface svg').nth(index).locator('..');const from=await card.boundingBox();
   const target=await page.getByRole('button',{name:zone,exact:true}).boundingBox();assert(target);
   await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:14});await page.mouse.up();
  };
  // A wrong drop returns home with a short wiggle, original face and incorrect SFX.
  await drag(1,'Polygon');await page.waitForFunction(()=>__poly.state.wrong===1);
  assert(await page.evaluate(()=>{
   const g=__poly,c=g.renderVals().cards[1],base=g.cardStyleFor(null);
   return g.state.sortAt[1]===undefined&&!g.locked()&&c.wrap.background==='#fff0e9'&&c.wrap.borderColor==='#cf6b58'&&sounds.includes('no');
  }));
  assert.match(await page.locator('.story-surface svg').nth(1).locator('..').evaluate(e=>getComputedStyle(e).animationName),/wrongTap/);
  await page.waitForTimeout(500);
  await drag(0,'Polygon');await page.waitForFunction(()=>__poly.state.sortAt[0]===0);await page.waitForTimeout(600);
  await drag(2,'Polygon');await page.waitForFunction(()=>__poly.state.sortAt[2]===0);await page.waitForTimeout(600);
  assert(await page.evaluate(()=>__poly.sortZoneFull(0)&&!__poly.sortZoneFull(1)&&!__poly.locked()&&!__poly.state.checked),'Two polygons fill only their own category');
  // A third item cannot enter that full category or add a preview slot.
  await drag(1,'Polygon');await page.waitForFunction(()=>__poly.state.wrong===1);
  assert(await page.evaluate(()=>Object.keys(__poly.state.sortAt).length===2&&__poly.renderVals().callouts.length===0));
  await page.waitForTimeout(600);
  // Placed shapes are immutable even when another category is still empty.
  assert(await page.locator('.story-surface svg').nth(0).locator('..').evaluate(e=>getComputedStyle(e).pointerEvents==='none'));
  await page.evaluate(()=>{__poly.dragFigure(0)({button:0});});
  assert(await page.evaluate(()=>__poly.state.draggingFigure===null&&__poly.state.sortAt[0]===0));
  await drag(1,'Not a polygon');await page.waitForFunction(()=>__poly.state.sortAt[1]===1);await page.waitForTimeout(600);
  assert(await page.evaluate(()=>!__poly.state.checked&&!__poly.sortLimitReached()),'Three shapes do not finish the activity');
  await drag(3,'Not a polygon');await page.waitForFunction(()=>__poly.state.sortAt[3]===1);
  assert(await page.evaluate(()=>__poly.state.checked&&__poly.sortLimitReached()&&sounds.filter(n=>n==='ok').length===4));
  await page.waitForFunction(()=>window.finished);checkBounds(await sample());await page.screenshot({path:path.join(out,'completed.png')});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1024,height:768});await go(sortIndex);checkBounds(await sample());
  assert.equal(await page.locator('.story-board').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  // Keyboard sorting follows the same capacity and correctness rules, in another order.
  for(const [index,zone] of [[1,'Not a polygon'],[3,'Not a polygon'],[0,'Polygon'],[2,'Polygon']]) {
   const card=page.locator('.story-surface svg').nth(index).locator('..');
   await card.focus();await page.keyboard.press('Enter');
   await page.getByRole('button',{name:zone,exact:true}).focus();await page.keyboard.press('Space');
   await page.waitForFunction(index=>__poly.state.sortAt[index]!==undefined,index);
  }
  assert(await page.evaluate(()=>__poly.state.checked&&Object.keys(__poly.state.sortAt).length===4));
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
