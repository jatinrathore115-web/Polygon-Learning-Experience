const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','opening-feedback');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.wav':'audio/wav','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'missing':data);});
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9363,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9363/index.html?intro=0');
    await page.waitForFunction(()=>window.__poly?.state.ready&&__poly._drawingBuffer);
    await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g.later=()=>0;g.narrate=()=>{};});
    const show=async k=>{
      await page.evaluate(k=>{__poly.setState({k});__poly.runStep(k,false);},k);
      await page.evaluate(()=>{const g=__poly;g._voiceLocked=false;g.prepareNarratorReveal(g.step().narr);g.setState({wordReveal:'complete',drawn:true,tracing:false,magicReveal:false,storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false,pressK:null,hoverK:null});});
      await page.waitForTimeout(1250);
    };
    for(let k=1;k<9;k++){
      await show(k);await page.mouse.move(10,200);
      const card=page.locator('.story-surface svg').first().locator('..');
      const appearance=()=>card.evaluate(e=>[e,...e.querySelectorAll('svg,g,path')].map(n=>{
        const c=getComputedStyle(n);return [c.transform,c.filter,c.fill,c.stroke,c.background,c.boxShadow];
      }));
      const before=await appearance();await card.hover();await page.waitForTimeout(200);
      assert.deepEqual(await appearance(),before,'Figure hover changes screen '+(k+1));
    }
    // Real buffer playback follows the actual drawing, not a timeout-only imitation.
    await show(1);await page.mouse.click(10,200);
    await page.evaluate(()=>{const g=__poly;g.setState({drawing:true,drawn:false,penAt:null});g.runDraw(1000,()=>window.drawingFinished=true);});
    await page.waitForFunction(()=>!!__poly._drawingSound);
    assert(await page.evaluate(()=>__poly._drawingSound.source.buffer===__poly._drawingBuffer));
    await page.waitForFunction(()=>window.drawingFinished);
    assert(await page.evaluate(()=>!__poly._drawingSound));
    await page.evaluate(()=>{const g=__poly;g.startDrawingSound(2000);g.stopDrawingSound();g.state.muted=true;g.startDrawingSound(2000);});
    assert(await page.evaluate(()=>!__poly._drawingSound));await page.evaluate(()=>__poly.setState({muted:false}));
    await show(4);
    // Hold narration completion to inspect the answer, then release automatic progression.
    await page.evaluate(()=>{
      __poly.feedback=(text,done)=>{__poly.setState({interactive:false});window.feedbackDone=done;};
      __poly.later=(fn,ms)=>{const id=setTimeout(fn,ms);__poly.timers.push(id);return id;};
    });
    await page.getByRole('button',{name:'Open',exact:true}).click();
    assert(await page.evaluate(()=>__poly.state.wrong==='open'&&__poly.state.k===4&&!__poly.state.interactive));
    assert((await page.getByRole('button',{name:'Open',exact:true}).innerText()).startsWith('×'));
    assert((await page.getByRole('button',{name:'Closed',exact:true}).innerText()).startsWith('✓'),'Reveal the correct answer');
    await page.waitForFunction(()=>__poly.state.tracing);
    const traceAppearance=()=>page.locator('.story-surface [data-trace]').first().evaluate(e=>{
      const c=getComputedStyle(e);return {stroke:c.stroke,width:c.strokeWidth,animation:c.animationName,duration:c.animationDuration,filter:c.filter};
    });
    const incorrectTrace=await traceAppearance();
    await page.waitForTimeout(350);await page.screenshot({path:path.join(out,'incorrect.png')});
    await page.evaluate(()=>window.feedbackDone());
    assert(await page.evaluate(()=>__poly.state.k===4&&__poly.state.ocReveal==='closed'),'Keep feedback visible during the reading pause');
    await page.waitForFunction(()=>__poly.state.k===5);
    await show(4);
    await page.getByRole('button',{name:'Closed',exact:true}).press('Enter');
    assert((await page.getByRole('button',{name:'Closed',exact:true}).innerText()).startsWith('✓'));
    assert(await page.evaluate(()=>{
      const marks=__poly.ocMarks('leaf');return !marks.pathStyle&&!marks.hl.length&&!__poly.state.fx.some(f=>f.kind==='conf');
    }));
    await page.waitForFunction(()=>__poly.state.tracing);
    assert.deepEqual(await traceAppearance(),incorrectTrace,'Correct and incorrect use the same blue tracing treatment');
    assert.equal(await page.evaluate(()=>__poly.renderVals().cards[0].fill),'rgba(75,210,245,.07)');
    await page.waitForTimeout(350);await page.screenshot({path:path.join(out,'correct.png')});
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.getByRole('button',{name:'Closed',exact:true}).evaluate(e=>getComputedStyle(e).animationName),'none');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({hoverStable:true,recordingDecoded:true,drawingSynchronized:true,muteAndStop:true,correctAnswerRevealed:true,automaticProgression:true,matchingBlueTrace:true,subtleFill:true,success:true,reducedMotion:true,errors}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
