const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'output', 'launch');
fs.mkdirSync(out, { recursive: true });
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server = http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});
});
(async()=>{
  await new Promise(r=>server.listen(9350,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=document-user-activation-required']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:810},ignoreHTTPSErrors:true});
    const errors=[],failed=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
    await page.goto('http://127.0.0.1:9350',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__poly?.state.ready,{timeout:30000});
    await page.waitForTimeout(5000);
    const startup=await page.evaluate(()=>({k:__poly.state.k,error:__poly.state.voiceError,interactive:__poly.state.interactive,content:__poly.state.storyContent,text:document.body.innerText}));
    await page.screenshot({path:path.join(out,'startup.png')});
    console.log('STARTUP',JSON.stringify(startup));
    await page.mouse.click(700,200);
    await page.waitForTimeout(1000);
    // Rendering audit isolates each screen; interactive paths are tested separately.
    await page.evaluate(()=>{const g=__poly;g.timers.forEach(clearTimeout);g._stopRecordedVoice?.();g.later=()=>0;});
    const screens=[];
    for(let k=0;k<47;k++){
      await page.evaluate(k=>{const g=__poly,s=g.steps()[k];g.setState({k});g.runStep(k,false);g.prepareNarratorReveal(g.instructionPages(s.narr)[0]);g._voiceLocked=false;g.setState({wordReveal:'complete',storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false,magicReveal:false,drawn:!(s.sc==='S1'&&['point','draw'].includes(s.ph)),reveal:true,nums:s.count||0,voiceElapsedMs:10000});},k);
      await page.waitForTimeout(300);
      screens.push(await page.evaluate(()=>({k:__poly.state.k+1,question:__poly.step().q,buttons:[...document.querySelectorAll('.game-action')].map(e=>({text:e.innerText,label:e.getAttribute('aria-label'),role:e.getAttribute('role'),tab:e.getAttribute('tabindex')})),text:document.querySelector('.narrator-text').innerText})));
      if([0,4,8,10,15,17,22,23,25,29,34,39,42,45,46].includes(k)) await page.screenshot({path:path.join(out,'screen-'+(k+1)+'.png')});
    }
    fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify({startup,errors,failed,screens},null,2));
    console.log('AUDIT',JSON.stringify({screens:screens.length,errors,failed,firstButtons:screens[4].buttons}));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
