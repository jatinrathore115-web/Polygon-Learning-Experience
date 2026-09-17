const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','polygon-selection');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9367,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9367/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.mouse.click(700,100);
    await page.evaluate(()=>{
      const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);
      g._guideGreeted=true;g._polygonAt=true;g._boundaryAt=false;g._lastSc='S9';
      g.setState({k:17,storyContent:true,guideHidden:false,guideFlying:false,polygonTravel:false});
    });
    await page.waitForTimeout(1100);
    await page.evaluate(async()=>{await Promise.all([document.querySelector('.story-board'),document.querySelector('.swiftee-wrap').parentElement].flatMap(e=>e.getAnimations().map(a=>a.finished.catch(()=>{}))));});
    const geometry=()=>page.evaluate(()=>{
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
      return {board:box(document.querySelector('.story-board')),guide:box(document.querySelector('.swiftee-wrap')),
        dialogue:box(document.querySelector('.dialogue-box')),cards:[...document.querySelectorAll('.story-surface svg')].map(e=>box(e.parentElement)),
        bg:box(document.querySelector('.boundary-background'))};
    });
    const before=await geometry();
    await page.evaluate(()=>{__poly.setState({k:18});__poly.runStep(18,false);});
    await page.waitForFunction(()=>__poly.state.k===18&&!__poly.locked()&&__poly.state.storyControls&&!__poly.state.speaking);
    await page.waitForTimeout(350);
    const initial=await geometry();assert.deepEqual(initial.board,before.board);assert.deepEqual(initial.guide,before.guide);
    assert.equal(initial.cards.length,5,'Preserve all existing figures');
    const validate=s=>{
      assert(Math.abs(s.board.x+s.board.w/2-(s.bg.x+s.bg.w/2))<1,'Centered board');
      for(const c of s.cards)assert(c.x>s.board.x&&c.right<s.dialogue.x&&c.y>s.board.y&&c.bottom<s.board.bottom,'Cards stay inside board and clear of dialogue');
      for(let i=0;i<s.cards.length;i++)for(let j=i+1;j<s.cards.length;j++){
        const a=s.cards[i],b=s.cards[j];assert(a.right<b.x||b.right<a.x||a.bottom<b.y||b.bottom<a.y,'Cards do not overlap');
      }
      assert(s.guide.right<s.board.right&&s.guide.bottom<s.board.bottom,'Guide remains inside board');
      assert(Math.abs(s.bg.w/s.bg.h-16/9)<.01,'Preserve stage aspect ratio');
    };
    validate(initial);await page.screenshot({path:path.join(out,'screen-19.png')});
    assert.equal(await page.locator('.story-surface').getByRole('button',{name:'Next',exact:true}).count(),0,'No extra Next inside the activity');
    assert(!await page.locator('body').innerText().then(t=>/Select all that apply|\d of \d found/.test(t)),'Remove extra selection text');
    const cards=page.locator('.story-surface .game-action').filter({has:page.locator('svg')});
    await cards.nth(0).click();
    assert.equal(await cards.nth(0).evaluate(e=>getComputedStyle(e).outlineStyle),'none','Pointer selection has no dark focus outline');
    await page.waitForFunction(()=>!__poly.locked()&&__poly.state.wrong===null&&!__poly.state.speaking);
    assert(await page.evaluate(()=>__poly.state.sel.length===0),'Incorrect option is not retained');
    await page.keyboard.press('Tab');await cards.nth(2).focus();
    assert.equal(await cards.nth(2).evaluate(e=>getComputedStyle(e).outlineColor),'rgb(49, 185, 222)','Keyboard focus uses ice blue');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    assert(await page.evaluate(()=>String(__poly.state.sel)==='2'));
    assert.equal(await cards.nth(2).getAttribute('aria-pressed'),'true');
    assert((await cards.nth(2).innerText()).includes('âœ“'));
    for(const viewport of [{width:1920,height:1080},{width:1024,height:768}]){
      await page.setViewportSize(viewport);await page.waitForTimeout(200);validate(await geometry());
    }
    await page.setViewportSize({width:1440,height:810});
    await page.evaluate(()=>{
      const advance=__poly.advance.bind(__poly);
      window.advanceEvents=[];
      __poly.advance=()=>{advanceEvents.push({k:__poly.state.k,speaking:__poly.state.speaking,wordReveal:__poly.state.wordReveal});advance();};
    });
    await cards.nth(4).focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>__poly.state.checked&&!__poly.locked()&&!__poly.state.speaking);
    assert.equal(await page.locator('.story-surface').getByRole('button',{name:'Next',exact:true}).count(),0);
    await page.screenshot({path:path.join(out,'completed.png')});
    await page.waitForFunction(()=>__poly.state.k===19);
    assert(await page.evaluate(()=>advanceEvents.some(e=>e.k===18&&!e.speaking&&e.wordReveal==='complete')),'Advance only after actual success narration ends');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{__poly.setState({k:18});__poly.runStep(18,false);});
    assert(await page.evaluate(()=>!__poly.state.polygonTravel));
    // Other selection activities use the same completion path. Hold narration
    // callbacks explicitly to prove that answers cannot advance before speech ends.
    await page.evaluate(()=>{
      const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);
      window.testVoices=[];window.pendingVoice=null;
      g.narrate=(text,opts={})=>{
        testVoices.push(text);pendingVoice=opts.then||null;
        g._voiceLocked=true;g.setState({narr:text,speaking:true,interactive:false});
      };
      window.finishTestVoice=()=>{
        const done=pendingVoice;pendingVoice=null;
        g._voiceLocked=false;g.setState({speaking:false,interactive:true,storyControls:true});done?.();
      };
    });
    for(const scene of ['S18','C1','C4']){
      const index=await page.evaluate(scene=>{
        const g=__poly,k=g.steps().findIndex(s=>s.sc===scene);testVoices=[];
        g.setState({k});g.runStep(k,false);return k;
      },scene);
      await page.waitForFunction(()=>testVoices.length>0);
      await page.evaluate(()=>{
        const g=__poly;finishTestVoice();g.step().correct.forEach(i=>g.tapCard(i)());
        if(g.step().check)g.check();
      });
      assert(await page.evaluate(index=>__poly.state.k===index&&__poly.state.speaking,index));
      assert.equal(await page.locator('.story-surface').getByRole('button',{name:'Next',exact:true}).count(),0);
      await page.evaluate(()=>finishTestVoice());
      await page.waitForFunction(index=>__poly.state.k===index+1,index);
    }
    const recall=await page.evaluate(()=>{
      const g=__poly,k=g.steps().findIndex(s=>s.q==='recall');testVoices=[];
      g.setState({k});g.runStep(k,false);return k;
    });
    await page.waitForFunction(()=>testVoices.length===1);
    await page.evaluate(()=>finishTestVoice());
    for(let n=3;n<=8;n++){
      await page.waitForFunction(n=>testVoices.at(-1)?.startsWith('A polygon with '+n+' sides'),n);
      assert(await page.evaluate(()=>!!PolygonRecordedVoice.find(testVoices.at(-1))),'Recall reuses an available voice recording');
      assert.equal(await page.locator('.story-surface').getByRole('button',{name:'Next',exact:true}).count(),0);
      await page.evaluate(()=>finishTestVoice());
    }
    await page.waitForFunction(recall=>__poly.state.k===recall+1,recall);
    // Navigating back during the reading pause cancels the queued advance.
    await page.evaluate(()=>{
      const g=__poly;g.setState({k:18});g.runStep(18,false);
      g.later(g.advance,420);g.setState({k:17});g.runStep(17,false);
    });
    await page.waitForTimeout(600);assert(await page.evaluate(()=>__poly.state.k===17));
    assert.deepEqual(errors,[]);console.log(JSON.stringify({screen:19,preservedFiveFigures:true,continuousLayout:true,wrongAnswer:true,iceBlueKeyboardFocus:true,noNextButtons:true,noExtraText:true,autoAdvanceAfterVoice:true,responsive:true,reducedMotion:true,errors}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
