const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const assert = require('assert');
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
    let styledButtons=0;
    const showScreen=async(k,patch={})=>{
      await page.evaluate(({k,patch})=>{const g=__poly,s=g.steps()[k];g.setState({k});g.runStep(k,false);g.prepareNarratorReveal(g.instructionPages(s.narr)[0]);g._voiceLocked=false;g.setState({wordReveal:'complete',storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false,magicReveal:false,drawn:!(s.sc==='S1'&&['point','draw'].includes(s.ph)),reveal:true,nums:s.count||0,voiceElapsedMs:10000,...patch});},{k,patch});
      await page.waitForTimeout(300);
    };
    for(let k=0;k<47;k++){
      await showScreen(k);
      screens.push(await page.evaluate(()=>({k:__poly.state.k+1,question:__poly.step().q,buttons:[...document.querySelectorAll('.game-action')].map(e=>({text:e.innerText,label:e.getAttribute('aria-label'),role:e.getAttribute('role'),tab:e.getAttribute('tabindex')})),text:document.querySelector('.narrator-text').innerText})));
      const buttonAudit=await page.evaluate(()=>{
        const buttons=[...document.querySelectorAll('.story-surface .ice-button')].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden');
        return buttons.map(e=>{
          const cs=getComputedStyle(e),box=e.getBoundingClientRect();
          const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let node;const bounds=[];
          while(node=walker.nextNode())if(node.textContent.trim()){const range=document.createRange();range.selectNodeContents(node);bounds.push(range.getBoundingClientRect());}
          return {text:e.innerText,white:cs.color==='rgb(255, 255, 255)',rim:cs.backgroundImage.includes('gradient'),
            fits:bounds.every(r=>r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1)};
        });
      });
      styledButtons+=buttonAudit.length;
      assert(buttonAudit.every(b=>b.white&&b.rim&&b.fits),'Button style/text fit on screen '+(k+1)+': '+JSON.stringify(buttonAudit));
      assert(await page.evaluate(()=>__poly.step().q!=='sort'||__poly.renderVals().targets.every(t=>!t.actionClass.includes('ice-button'))),'Sort drop areas must keep visible headers and dashed outlines');
      if([0,4,5,8,10,13,15,17,22,23,25,29,34,39,42,45,46].includes(k)) await page.screenshot({path:path.join(out,'screen-'+(k+1)+'.png')});
    }
    const states=[];
    for(const [name,k,patch]of [
      ['correct',4,{ok:'closed',interactive:false}],
      ['incorrect',4,{wrong:'open',ocReveal:'closed',interactive:false}],
      ['disabled',23,{cnt:[0,0]}],
      ['enabled',23,{cnt:[2,0]}]
    ]){
      await showScreen(k,patch);await page.waitForTimeout(300);
      if(name==='incorrect')assert.equal(await page.getByRole('button',{name:'Open',exact:true}).evaluate(e=>getComputedStyle(e).opacity),'1','Incorrect answer text must not fade');
      if(name==='disabled')assert.equal(await page.locator('[aria-disabled="true"]').filter({hasText:'Check'}).count(),1);
      await page.screenshot({path:path.join(out,'buttons-'+name+'.png')});
      states.push(name);
    }
    await showScreen(4);
    await page.getByRole('button',{name:'Open',exact:true}).focus();
    await page.keyboard.press('Tab');
    assert(await page.getByRole('button',{name:'Closed',exact:true}).evaluate(e=>e.matches(':focus-visible')),'Keyboard focus must be visible');
    await page.screenshot({path:path.join(out,'buttons-focus.png')});
    const nav=page.locator('#polygon-screen-navigator');
    await nav.locator('#toggle').click();
    assert.equal(await nav.locator('#list button').count(),47);
    assert(await nav.locator('button').evaluateAll(es=>es.every(e=>e.classList.contains('ice-button')&&getComputedStyle(e).color==='rgb(255, 255, 255)')),'Navigator shares white text and button style');
    await page.screenshot({path:path.join(out,'buttons-navigator.png')});
    await nav.locator('#close').click();
    await page.setViewportSize({width:390,height:844});
    await showScreen(23,{cnt:[2,0]});
    const plus=page.getByRole('button',{name:'Increase number of sides'});
    await plus.scrollIntoViewIfNeeded();
    const hit=await plus.locator('span').boundingBox();
    assert(hit.width>=43.9&&hit.height>=43.9,'Phone counter hit area must remain at least 44px');
    await page.screenshot({path:path.join(out,'buttons-phone.png')});
    assert.equal(errors.length,0,errors.join('\n'));
    assert.equal(failed.length,0,JSON.stringify(failed));
    fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify({startup,errors,failed,screens,buttonStates:states,keyboardFocus:true,phoneHitArea:hit},null,2));
    console.log('AUDIT',JSON.stringify({screens:screens.length,styledButtons,errors,failed,buttonStates:states,keyboardFocus:true,phoneHitArea:hit}));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
