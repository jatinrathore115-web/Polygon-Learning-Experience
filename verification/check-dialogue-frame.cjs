const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','dialogue-frame');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(p,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.mp3':'audio/mpeg'})[path.extname(p)]||'application/octet-stream'});res.end(err?'Missing':data);});});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9372,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:810},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:9372/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
  await page.evaluate(()=>{const g=__poly;g.timers.forEach(clearTimeout);g._stopRecordedVoice?.();g.later=()=>0;g._guideGreeted=true;});
  const results=[];
  for(const viewport of [{width:1440,height:810},{width:1024,height:768}]){
  await page.setViewportSize(viewport);
  for(let n=1;n<=47;n++){
   await page.evaluate(n=>{const g=__poly,k=n-1;g.setState({k});g.runStep(k,false);g.prepareNarratorReveal(g.instructionPages(g.steps()[k].narr)[0]);g._voiceLocked=false;g.setState({wordReveal:'complete',storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false,boundaryTravel:false,polygonTravel:false,reveal:true,voiceElapsedMs:10000});},n);
   await page.waitForTimeout(220);
   const result=await page.evaluate(n=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
    const d=document.querySelector('.dialogue-box'),dr=rect(d),surface=document.querySelector('.story-surface');
    const overlaps=[...surface.querySelectorAll('svg,[role="button"],[role="group"]')].filter(e=>{const r=rect(e),s=getComputedStyle(e);return s.display!=='none'&&r.w&&r.h&&r.x<dr.right&&r.right>dr.x&&r.y<dr.bottom&&r.bottom>dr.y;}).map(e=>({tag:e.tagName,box:rect(e)}));
    const count=n===24?rect(surface.querySelector('[role="group"]')):null;
    const check=n===24?rect([...surface.querySelectorAll('.ice-button')].find(e=>e.textContent.trim()==='Check')):null;
    return{screen:n,dialogue:dr,text:d.innerText,board:rect(document.querySelector('.story-board')),overlaps,
      count,check,figure:n===24?rect(surface.querySelector('svg path')):null,
      overflow:(()=>{const t=d.querySelector('.dialogue-text');return t.scrollWidth>t.clientWidth+2||t.scrollHeight>t.clientHeight+2;})()};
   },n);
   assert.equal(result.overlaps.length,0,'Screen '+n+' dialogue clears learning content');
   assert(!result.overflow,'Screen '+n+' dialogue text fits '+JSON.stringify(result));
   assert(result.dialogue.y>=0&&result.dialogue.right<=viewport.width&&result.dialogue.bottom<=viewport.height,'Dialogue stays within the viewport');
   if(n===24){
    assert(Math.abs(result.count.x+result.count.w/2-result.figure.x-result.figure.w/2)<1,'Stepper is centred on the figure');
    assert(result.count.y>result.figure.bottom+20,'Stepper clears the visible polygon');
    assert(result.check.x>result.count.right+10,'Check sits beside the controls');
    assert(Math.abs(result.count.y+result.count.h/2-result.check.y-result.check.h/2)<1,'Check aligns vertically even when disabled');
   }
   if(viewport.width===1440){results.push(result);await page.screenshot({path:path.join(out,'screen-'+n+'.png')});}
   // Later narration pages use the same layout and must remain readable too.
   const pages=await page.evaluate(()=>__poly.instructionPages(__poly.step().narr));
   for(const text of pages.slice(1)){
    await page.evaluate(text=>{__poly.prepareNarratorReveal(text);__poly.setState({wordReveal:'complete'});},text);
    await page.waitForTimeout(20);
    assert(await page.evaluate(()=>{const e=document.querySelector('.dialogue-box'),r=e.getBoundingClientRect(),t=e.querySelector('.dialogue-text');return r.top>=0&&r.bottom<=innerHeight&&t.scrollHeight<=t.clientHeight+2&&t.scrollWidth<=t.clientWidth+2;}),'Later dialogue page fits on Screen '+n);
   }
  }
  }
  fs.writeFileSync(path.join(out,'bounds.json'),JSON.stringify(results,null,2));
  const montage=await browser.newPage({viewport:{width:1600,height:1000}});
  await montage.setContent('<style>body{margin:0;background:#082854;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font:16px sans-serif;color:white}figure{margin:0}img{width:100%}figcaption{padding:4px}</style>'+results.map(r=>'<figure><figcaption>Screen '+r.screen+'</figcaption><img src="http://127.0.0.1:9372/verification/output/dialogue-frame/screen-'+r.screen+'.png"></figure>').join(''));
  await montage.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await montage.screenshot({path:path.join(out,'overview.png'),fullPage:true});
  console.log(JSON.stringify({screens:results.length,viewports:2,dialoguePages:true,counterAlignment:true,overlaps:results.filter(r=>r.overlaps.length),errors}));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
