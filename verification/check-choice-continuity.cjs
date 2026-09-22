const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','choice-continuity');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9375,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.playbackRate=5;return play.call(this);};});
  await page.goto('http://127.0.0.1:9375/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);await page.mouse.click(700,80);
  await page.evaluate(()=>{__poly._guideGreeted=true;__poly.advance=()=>{window.finished=__poly.state.k;};});
  const ready=()=>page.waitForFunction(()=>!__poly.locked()&&!__poly.state.speaking&&__poly.state.storyControls);
  const go=async(k)=>{await page.evaluate(k=>{window.finished=null;__poly.setState({k});__poly.runStep(k,false);},k);await ready();await page.waitForTimeout(1000);};
  const sample=()=>page.evaluate(()=>{
   const b=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const check=[...document.querySelectorAll('.story-surface .ice-button')].find(e=>e.innerText==='Check');
   return{board:b(document.querySelector('.story-board')),guide:b(document.querySelector('.swiftee-wrap')),dialogue:b(document.querySelector('.dialogue-box')),
    cards:[...document.querySelectorAll('.story-surface svg')].map(e=>b(e.parentElement)),check:check?b(check):null};
  });
  const validate=(s,ref,n)=>{
   assert.deepEqual(s.board,ref.board);assert.deepEqual(s.guide,ref.guide);assert(s.dialogue.x>s.board.x&&s.dialogue.right<s.cards[0].x);assert(Math.abs(s.dialogue.bottom-ref.dialogue.bottom)<1);
   assert.equal(s.cards.length,n);
   for(const c of s.cards)assert(c.x>s.dialogue.right+20&&c.right<s.board.right-20&&c.y>s.board.y+20&&c.bottom<s.board.bottom-20,'Cards stay in the right lane with breathing room');
   for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=s.cards[i],b=s.cards[j];assert(a.right<b.x||b.right<a.x||a.bottom<b.y||b.bottom<a.y);}
   if(n===4&&!s.check)assert.deepEqual(s.cards,ref.cards);
   if(s.check){assert(s.check.y>Math.max(...s.cards.map(c=>c.bottom))+20);assert(s.check.bottom<s.board.bottom-20);}
  };
  await go(41);let ref=await sample();await page.screenshot({path:path.join(out,'screen-42.png')});
  await go(43);validate(await sample(),ref,4);await page.screenshot({path:path.join(out,'screen-44.png')});
  const cards=page.locator('.story-surface .game-action').filter({has:page.locator('svg')});
  await cards.nth(0).click();await page.waitForFunction(()=>__poly.state.attempts>0);await ready();assert(await page.evaluate(()=>__poly.state.ok===null));
  await cards.nth(3).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.finished===43);
  await go(44);validate(await sample(),ref,4);await page.screenshot({path:path.join(out,'screen-45.png')});
  const check=page.getByRole('button',{name:'Check',exact:true});
  const appearance=()=>cards.evaluateAll(es=>es.map(e=>({
   background:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow,
   artwork:[...e.querySelectorAll('svg path')].map(p=>[p.getAttribute('d'),p.getAttribute('fill'),p.getAttribute('stroke')])
  })));
  const original=await appearance();
  assert.equal(await page.locator('.story-surface .ice-button').getAttribute('aria-disabled'),'true');
  await cards.nth(2).click();await page.mouse.move(20,780);await page.waitForTimeout(300);
  let selected=await appearance();
  assert.equal(selected[2].background,original[2].background,'Incorrect selection preserves the card face');
  assert(!selected[2].shadow.includes('35, 170, 92'),'An incorrect selection does not receive success feedback');
  await check.click();await page.waitForFunction(()=>__poly.state.attempts>0);await ready();
  assert(await page.evaluate(()=>!__poly.state.checked));await cards.nth(2).click();
  for(const i of [0,1])await cards.nth(i).click();
  await page.mouse.move(20,780);await page.waitForTimeout(300);selected=await appearance();
  for(let i=0;i<4;i++){
   assert.equal(selected[i].background,original[i].background,'Selection never tints the card face');
   assert.deepEqual(selected[i].artwork,original[i].artwork,'Selection preserves shape geometry and colors');
   assert.equal(selected[i].shadow.includes('35, 170, 92'),[0,1].includes(i),'Only correct selections have a green underglow');
  }
  await cards.nth(0).click();await page.mouse.move(20,780);await page.waitForTimeout(300);
  assert(!(await appearance())[0].shadow.includes('35, 170, 92'),'Deselecting removes the success glow');
  await cards.nth(0).click();await page.mouse.move(20,780);await page.waitForTimeout(300);
  await page.screenshot({path:path.join(out,'screen-45-selected.png')});
  await check.click();await page.waitForFunction(()=>window.finished===44);
  assert(await page.evaluate(()=>__poly.state.checked));
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1024,height:768});
  await go(41);ref=await sample();
  for(const [k,n]of [[43,4],[44,4]]){await go(k);validate(await sample(),ref,n);assert.equal(await page.locator('.story-board').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({screens:[42,44,45],sharedComposition:true,allOptions:true,wrongRetry:true,keyboard:true,checkSubmission:true,completion:true,tablet:true,reducedMotion:true,errors}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
