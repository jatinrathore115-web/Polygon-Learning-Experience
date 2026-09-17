const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','sequential-classification');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9365,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9365/index.html?intro=0');
    await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.evaluate(()=>{
      const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g.narrate=()=>{};
      g._guideGreeted=true;g._boundaryAt=true;
    });
    const start=()=>page.evaluate(()=>{
      const g=__poly;g.setState({k:13});g.runStep(13,false);g._voiceLocked=false;
      g.prepareNarratorReveal(g.step().narr);
      g.setState({storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false,wordReveal:'complete'});
    });
    const enabled=()=>page.locator('[data-sequence-state="active"][aria-disabled="false"]');
    await start();await page.waitForTimeout(1100);
    assert.equal(await enabled().count(),2);
    assert.equal(await page.locator('[data-sequence-state="pending"]').count(),6);
    assert(await page.locator('[data-sequence-state="pending"]').evaluateAll(es=>es.every(e=>e.tabIndex===-1&&getComputedStyle(e).filter.includes('blur'))));
    const filters=await page.locator('.story-surface svg').evaluateAll(es=>es.map(e=>getComputedStyle(e.parentElement).filter));
    assert.deepEqual(filters,['none','blur(3px)','blur(3px)','blur(3px)']);
    await page.evaluate(()=>{__poly.ddPick(2,'Curved')();document.querySelector('[aria-label="Figure 4: Curved"]').click();});
    assert(await page.evaluate(()=>__poly.state.dd.every(v=>v===null)),'Future cards reject direct activation');
    await page.screenshot({path:path.join(out,'first-figure.png')});
    const truth=['Straight','Straight','Curved','Curved'];
    for(let i=0;i<4;i++){
      const choice=page.getByRole('button',{name:'Figure '+(i+1)+': '+truth[i],exact:true});
      await choice.focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-sequence-state="complete"]').count(),i+1);
      assert.equal(await page.getByRole('button',{name:new RegExp('^Figure '+(i+1)+':')}).count(),1,'Replace both choices with one result');
      assert((await choice.innerText()).startsWith('✓'));
      if(i<3){
        await page.waitForFunction(i=>__poly.state.ddActive===i+1&&!__poly.locked(),i);
        assert.equal(await enabled().count(),2);
        assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Figure '+(i+2)+': Straight');
        if(i===0)await page.screenshot({path:path.join(out,'second-figure.png')});
      }
    }
    await page.waitForFunction(()=>__poly.state.k===14);
    assert.equal(await page.locator('[data-sequence-state="complete"]').count(),4);
    await page.screenshot({path:path.join(out,'completed.png')});
    await start();await page.getByRole('button',{name:'Figure 1: Straight',exact:true}).click();
    await start();await page.waitForTimeout(1100);
    assert(await page.evaluate(()=>__poly.state.ddActive===0&&__poly.state.dd.every(v=>v===null)),'Re-entry cancels pending focus handoff');
    await page.emulateMedia({reducedMotion:'reduce'});await start();
    assert.equal(await enabled().first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
    assert.deepEqual(errors,[]);
    console.log('PASS: sequential guards, blur, one checked result, keyboard handoff, all four figures, re-entry cancellation and reduced motion.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
