const fs=require('fs'), path=require('path'), http=require('http'), assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});
});
(async()=>{
  await new Promise(r=>server.listen(9379,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:810}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9379/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g._guideGreeted=true;
      g.narrate=(text,opts)=>{g._voiceLocked=false;g.prepareNarratorReveal(text);g.setState({speaking:false,interactive:true,storyContent:true,storyDialogue:true,storyControls:true,wordReveal:'complete'});opts?.then?.();};
    });
    const start=async()=>{await page.evaluate(()=>{__poly.setState({k:40});__poly.runStep(40,false);});await page.waitForFunction(()=>__poly.state.k===40&&!__poly.locked()&&__poly.state.storyControls);};
    await start();
    const plus=page.getByRole('button',{name:'Increase number of sides',exact:true});
    const minus=page.getByRole('button',{name:'Decrease number of sides',exact:true});
    const names={3:'Triangle',4:'Quadrilateral',5:'Pentagon',6:'Hexagon',7:'Heptagon',8:'Octagon'};
    const verify=async n=>{
      await page.waitForFunction(n=>__poly.state.n===n&&__poly.state.morph===null,n);
      assert.equal(await page.getByRole('status',{name:n+' sides',exact:true}).innerText(),String(n));
      assert(await page.getByText(names[n],{exact:true}).isVisible());
      const layout=await page.evaluate(name=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
        const label=[...document.querySelectorAll('.story-surface div')].find(e=>e.textContent.trim()===name);
        return {board:rect(document.querySelector('.story-board')), label:rect(label),
          counter:rect(document.querySelector('[role="group"][aria-label="Number of sides"]'))};
      },names[n]);
      assert(layout.label.bottom<layout.counter.y,'Name stays clear of controls');
      assert(layout.counter.bottom<layout.board.bottom && layout.counter.x>layout.board.x && layout.counter.right<layout.board.right,'Controls stay inside board');
    };
    await verify(3);await minus.click();
    assert(await page.evaluate(()=>__poly.state.n===3&&__poly.state.recallLimit===-1),'Lower limit gives feedback without changing shape');
    assert.match(await minus.evaluate(e=>getComputedStyle(e).animationName),/wrongTap/);
    for(let n=4;n<=8;n++){await plus.click();await verify(n);}
    await plus.click();assert(await page.evaluate(()=>__poly.state.n===8&&__poly.state.recallLimit===1),'Upper limit');
    for(let n=7;n>=3;n--){await minus.click();await verify(n);}
    // Rapid input retargets the visible outline without resetting it.
    await page.evaluate(()=>{__poly.bumpN(1)();window.firstOutline=JSON.stringify(__poly.state.morph);});
    await page.waitForTimeout(100);
    assert(await page.evaluate(()=>JSON.stringify(__poly.state.morph)!==firstOutline&&__poly.state.recallNameN===__poly.state.n));
    await page.evaluate(()=>{__poly.bumpN(1)();__poly.bumpN(1)();__poly.bumpN(-1)();});await verify(5);
    await plus.focus();await page.keyboard.press('Enter');await verify(6);
    await page.setViewportSize({width:1024,height:768});await verify(6);
    await page.emulateMedia({reducedMotion:'reduce'});await minus.click();await verify(5);
    assert(await page.evaluate(()=>__poly.state.morph===null),'Reduced motion uses direct updates');
    await start();await verify(3);
    const out=path.join(__dirname,'output','recall-stepper');fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,'screen-41-triangle.png')});
    await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>__poly.state.n),3,'No automatic review or advancement');
    assert.deepEqual(errors,[]);
    console.log('PASS: triangle start, all forward/reverse steps, both limits, smooth retargeting, synchronized labels/counts, keyboard, tablet layout, reduced motion and re-entry.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
