const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','launch');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{const type={'.js':'text/javascript','.css':'text/css','.html':'text/html','.mp3':'audio/mpeg','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';res.writeHead(err?404:200,{'Content-Type':type});res.end(err?'Not found':data);});
});
(async()=>{
 await new Promise(r=>server.listen(9351,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=document-user-activation-required']});
 let page;
 try{
  page=await browser.newPage({viewport:{width:1440,height:810},hasTouch:true});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Accelerate real audio, preserving its clock, word events and end gates.
  await page.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.playbackRate=6;return play.call(this);};});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto('http://127.0.0.1:9351/?preview=1');
  await page.waitForFunction(()=>window.__poly?.state.ready);
  await page.mouse.click(700,200);
  const ready=async(k)=>{await page.waitForFunction(k=>__poly.state.k===k&&!__poly.locked()&&__poly.state.storyControls,k,{timeout:60000});await page.locator('.story-surface[data-controls="ready"]').waitFor();};
  const jump=async(k)=>{await page.getByRole('button',{name:/^Screens/}).click();await page.getByRole('button',{name:new RegExp('^'+(k+1)+'\\. ')}).click();await ready(k);};
  const tailOnly=process.env.REVIEW_FROM==='40';
  if(!tailOnly){
  await ready(4); // Entire point -> drawing -> boundary -> first question sequence.
  console.log('PASS introduction reached first question through actual audio');
  const open=page.getByRole('button',{name:'Open',exact:true});
  await page.evaluate(()=>{const g=__poly,feedback=g.feedback;g.feedback=function(...args){const result=feedback.apply(this,args);window.__reviewFeedback={wrong:this.state.wrong,locked:this.locked()};return result;};});
  await open.press('Enter');
  await page.waitForFunction(()=>window.__reviewFeedback?.wrong==='open');
  assert(await page.evaluate(()=>__reviewFeedback.locked),'Feedback must gate a second answer');
  // An incorrect answer reveals the correct choice, explains it, then advances.
  await ready(5);
  console.log('PASS wrong answer, keyboard activation, recovery and correct advance');
  for(const [k,answer]of [[5,'Open'],[6,'Closed'],[7,'Open'],[8,'Closed']]){
    await ready(k);
    const choice=page.getByRole('button',{name:answer,exact:true});
    await choice.waitFor({state:'visible'});
    await page.waitForFunction(text=>[...document.querySelectorAll('.game-primary')].some(e=>e.innerText===text&&e.tabIndex===0),answer);
    await choice.click();
    await page.waitForFunction(k=>__poly.state.k!==k||!!__poly.state.ok||!!__poly.state.ocReveal,k);
    console.log('PASS open/closed screen '+(k+1));
  }
  await ready(13);
  console.log('PASS all five open/closed questions and comparison narration');
  fs.writeFileSync(path.join(out,'live-controls.json'),JSON.stringify(await page.locator('[role="button"]').evaluateAll(es=>es.map(e=>({text:e.innerText,label:e.getAttribute('aria-label'),tab:e.tabIndex}))),null,2));
  await page.screenshot({path:path.join(out,'classification-live.png')});
  for(const [i,answer] of ['Straight','Straight','Curved','Curved'].entries()){
    await page.getByRole('button',{name:'Figure '+(i+1)+': '+answer,exact:true}).click();
    await page.waitForTimeout(1700);
  }
  await ready(15);
  await page.locator('.story-surface > .game-action').first().click();
  await ready(18);
  for(const i of [2,4])await page.locator('.story-surface > .game-action').nth(i).click();
  await ready(22);
  await page.getByText('Drag a label, or tap a label then a ?.',{exact:true}).waitFor();
  for(const name of ['Left question-mark target','Lower-right question-mark target','Upper-right question-mark target'])
    assert.equal(await page.getByRole('button',{name,exact:true}).count(),1,'Each label target needs a distinct accessible name');
  const side=page.getByRole('button',{name:'Side',exact:true});
  await side.dragTo(page.locator('[data-label-target="side"]'));
  await page.waitForFunction(()=>__poly.state.placed.side==='Side');
  await page.waitForFunction(()=>![...document.querySelectorAll('[role="button"]')].some(e=>e.innerText==='Side'),'Placed labels must stop acting as choices');
  for(const name of ['Vertex','Angle']){
    await page.getByRole('button',{name,exact:true}).press('Enter');
    assert.equal(await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
    await page.locator('[data-label-target="'+name.toLowerCase()+'"]').click();
  }
  await ready(23);
  console.log('PASS classification, polygon selection and label drag/drop');
  assert(await page.evaluate(()=>__poly.state.cnt[0]===0),'Count starts at zero');
  for(let i=0;i<5;i++)await page.getByRole('button',{name:'Increase number of sides'}).click();
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await ready(26);
  const handle=page.locator('.game-handle').first(),b=await handle.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2-65,b.y+b.height/2+35,{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>__poly.state.dragged);
  await ready(30);
  console.log('PASS count controls, animated side count, vertex drag and automatic progression');
  await page.getByRole('button',{name:'Increase number of sides'}).last().click();
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await ready(35);
  for(const i of [0,2,3])await page.locator('.story-surface > .game-action').nth(i).click();
  await ready(40);
  console.log('PASS before/after counting, quadrilateral selection and polygon naming sequence');
  }else await jump(40);
  await page.waitForFunction(()=>__poly.state.k===40&&__poly.state.n===8,null,{timeout:60000});
  await ready(41);
  for(const i of [0,2])await page.locator('.story-surface > .game-action').nth(i).click();
  await page.getByRole('button',{name:'Check',exact:true}).click();await ready(42);
  for(const [i,zone]of [0,1,0,0,1].entries()){
    const card=page.locator('.story-surface > .game-action').filter({has:page.locator('svg')}).first();
    if(i===0)await card.dragTo(page.getByRole('button',{name:'POLYGONS',exact:true}));
    else{await card.click();await page.getByRole('button',{name:zone?'NOT POLYGONS':'POLYGONS',exact:true}).click();}
    await page.waitForFunction(n=>Object.keys(__poly.state.sortAt).length===n,i+1);
  }
  await ready(43);
  await page.locator('.story-surface > .game-action').nth(3).click();await ready(44);
  for(const i of [0,1,3])await page.locator('.story-surface > .game-action').nth(i).click();
  await page.getByRole('button',{name:'Check',exact:true}).click();await ready(45);
  for(const [i,zone]of [0,1,0,1].entries()){
    await page.locator('.story-surface > .game-action').filter({has:page.locator('svg')}).first().click();
    await page.getByRole('button',{name:zone?'HEPTAGON':'HEXAGON',exact:true}).click();
    await page.waitForFunction(n=>Object.keys(__poly.state.sortAt).length===n,i+1);
  }
  await ready(46);
  await page.screenshot({path:path.join(out,'completed-playthrough.png')});
  await page.getByRole('button',{name:'Play again',exact:true}).click();
  await page.waitForFunction(()=>__poly.state.k===0);
  await page.setViewportSize({width:390,height:844});
  await jump(23);
  const phonePlus=page.getByRole('button',{name:'Increase number of sides'});
  await phonePlus.scrollIntoViewIfNeeded();await phonePlus.tap();
  assert(await page.evaluate(()=>__poly.state.cnt[0]===1),'Phone touch must increment the count');
  await page.screenshot({path:path.join(out,'phone-counting.png')});
  await page.setViewportSize({width:844,height:390});
  await phonePlus.tap();
  assert(await page.evaluate(()=>__poly.state.cnt[0]===2),'Controls must still work after rotation');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert(await page.locator('.scene-snow').evaluate(e=>getComputedStyle(e).display==='none'),'Reduced motion stops snow');
  assert(!errors.length,errors.join('\n'));
  fs.writeFileSync(path.join(out,tailOnly?'final-challenges.json':'playthrough.json'),JSON.stringify({screens:tailOnly?7:47,completed:true,restarted:true,externalNetworkBlocked:true,keyboard:true,dragDrop:true,errors},null,2));
  console.log(tailOnly?'PASS final challenges and restart':'PASS Playwright complete 47-screen playthrough, wrong-answer recovery, keyboard, drag/drop, counting, deformation, sorting and restart');
 }catch(e){if(page){console.log('FAILED STATE',await page.evaluate(()=>({k:__poly.state.k,voiceError:__poly.state.voiceError,locked:__poly.locked(),ok:__poly.state.ok,ocReveal:__poly.state.ocReveal,controls:__poly.state.storyControls,text:document.body.innerText})));await page.screenshot({path:path.join(out,'failure.png')});}throw e;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
