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
      const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g.originalNarrate=g.narrate;g.narrate=()=>{};
      g._guideGreeted=true;g._boundaryAt=true;
    });
    const start=()=>page.evaluate(()=>{
      const g=__poly;g.setState({k:13});g.runStep(13,false);g._voiceLocked=false;
      g.prepareNarratorReveal(g.step().narr);
      g.setState({storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false,wordReveal:'complete'});
    });
    const enabled=()=>page.locator('[data-sequence-state="active"][aria-disabled="false"]');
    await start();await page.waitForTimeout(1100);
    await page.evaluate(()=>__poly.setState({storyControls:false,interactive:false,speaking:true,boundaryFocus:'all',boundaryPulseMs:1000,boundaryPulseStart:0,boundaryPulseElapsed:400}));
    await page.waitForTimeout(1100);
    const introStyles=await page.locator('.story-surface svg').evaluateAll(es=>es.map(e=>{
      const s=getComputedStyle(e.parentElement);
      return {animation:s.animationName,border:s.borderColor,outline:s.outlineStyle};
    }));
    assert(introStyles.every(s=>['none','storyArrive'].includes(s.animation)&&s.border==='rgb(168, 207, 232)'&&s.outline==='none'),'Default narration state: '+JSON.stringify(introStyles));
    assert.equal(await page.locator('.preview-choice').count(),2,'First pair is visible from the beginning');
    assert(await page.locator('.preview-choice').evaluateAll(es=>es.every(e=>{
      const s=getComputedStyle(e);return e.getAttribute('aria-disabled')==='true' && e.tabIndex===-1 && s.opacity==='1' && s.getPropertyValue('--button-face').trim()===s.getPropertyValue('--concept-button-face').trim();
    })),'Initial choices stay solid yellow but wait for narration before accepting input');
    await start();await page.waitForTimeout(1100);
    /* One figure is asked about at a time, so only that figure offers answers.
       The figures still waiting show no buttons at all: a second row of choices
       under a figure nobody is being asked about is just something else to tap
       by mistake. */
    assert.equal(await enabled().count(),2);
    assert.equal(await page.locator('[data-sequence-state="pending"]').count(),0,'Waiting figures offer no buttons');
    assert.equal(await page.getByRole('button',{name:/^Figure [234]:/}).count(),0,'Only the figure in hand can be answered');
    /* Nothing is blurred. These are boundaries the learner is being asked to
       compare, and a blurred boundary cannot be compared -- the waiting ones
       stay fully drawn and simply wait in blue. */
    const filters=await page.locator('.story-surface svg').evaluateAll(es=>es.map(e=>getComputedStyle(e.parentElement).filter));
    assert.deepEqual(filters,['none','none','none','none'],'No figure is blurred');
    const strokes=await page.locator('.story-surface svg').evaluateAll(es=>es.map(e=>e.querySelector('path').getAttribute('stroke')));
    assert(strokes.slice(1).every(s=>s==='#7fb2d9'),'Figures awaiting their turn wait in blue: '+strokes);
    assert(strokes[0]!=='#7fb2d9','The figure in hand keeps its own colour');
    /* The answer row clears the figures rather than sitting on them. */
    const gap=await page.evaluate(()=>{
      const cards=[...document.querySelectorAll('.story-surface svg')].map(s=>s.closest('div').getBoundingClientRect());
      const btn=[...document.querySelectorAll('.story-surface [role="button"]')].filter(e=>/Straight|Curved/.test(e.textContent)).map(e=>e.getBoundingClientRect());
      return Math.min(...btn.map(b=>b.top))-Math.max(...cards.map(c=>c.bottom));
    });
    assert(gap>8,'Answer buttons clear the figures above them, gap '+gap.toFixed(0)+'px');
    /* Straight is offered first, then Curved, rather than both at once. */
    const delays=await enabled().evaluateAll(es=>es.map(e=>getComputedStyle(e).animationDelay));
    assert.deepEqual(delays,['0s','0.17s'],'The two choices arrive one after the other');
    await page.evaluate(()=>{__poly.ddPick(2,'Curved')();});
    assert(await page.evaluate(()=>__poly.state.dd.every(v=>v===null)),'Future cards reject direct activation');
    await page.screenshot({path:path.join(out,'first-figure.png')});
    // Hold correction speech so the question cannot change before feedback ends.
    await page.evaluate(()=>{
      __poly.feedback=(text,done)=>{window.correctionDone=done;__poly.setState({narr:text,interactive:false});};
      __poly.narrate=__poly.originalNarrate;
      __poly.speak=(text,done)=>{__poly.prepareNarratorReveal(text);__poly.setState({wordReveal:'complete'},done);};
    });
    await page.getByRole('button',{name:'Figure 1: Curved',exact:true}).click();
    assert(await page.evaluate(()=>!__poly.state.ddRetryQuestion&&__poly.state.narr.includes("isn't curved")));
    await page.evaluate(()=>correctionDone());
    await page.waitForFunction(()=>__poly.state.narr==='Is the boundary straight or curved?');
    assert.equal((await page.locator('.dialogue-box').innerText()).replace(/\s+/g,' ').trim(),'Is the boundary straight or curved?');
    assert(await page.evaluate(()=>__poly.state.ddActive===0&&__poly.state.dd[0]===null));
    const truth=['Straight','Straight','Curved','Curved'];
    for(let i=0;i<4;i++){
      await page.mouse.move(20,80);
      await page.waitForTimeout(650);
      const pairAlignment=await page.evaluate(i=>{
        const card=document.querySelectorAll('.story-surface svg')[i].parentElement.getBoundingClientRect();
        const buttons=[...document.querySelectorAll('[data-sequence-state="active"]')].map(e=>e.getBoundingClientRect());
        const board=document.querySelector('.story-board').getBoundingClientRect();
        return {offset:(buttons[0].left+buttons[1].right)/2-(card.left+card.right)/2,
          inside:buttons.every(b=>b.left>board.left&&b.right<board.right),baseline:buttons[0].top-buttons[1].top};
      },i);
      assert(Math.abs(pairAlignment.offset)<.1,'Both buttons center on figure '+(i+1));
      assert(Math.abs(pairAlignment.baseline)<.1&&pairAlignment.inside,'Pair shares a baseline and fits the board: '+JSON.stringify(pairAlignment));
      const choice=page.getByRole('button',{name:'Figure '+(i+1)+': '+truth[i],exact:true});
      const originalBox=await choice.boundingBox();
      const originalFigure=await page.locator('.story-surface svg').nth(i).boundingBox();
      await choice.focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-sequence-state="complete"]').count(),i+1);
      assert.equal(await page.getByRole('button',{name:new RegExp('^Figure '+(i+1)+':')}).count(),1,'Replace both choices with one result');
      /* The earned answer is confirmed by the button itself, not by a tick
         printed in front of the word. Asserted on the state the button
         reports rather than the colours it happens to be painted in, so a
         restyle of the button system cannot silently drop the confirmation
         -- only actually failing to mark the answer correct can. */
      assert(await page.evaluate(i=>{const t=__poly.renderVals().targets.find(x=>x.label.indexOf('Figure '+(i+1)+': ')===0);
        return !!t&&t.feedback==='correct'&&t.sequenceState==='complete';},i),
        'The settled answer reads as correct');
      assert(!/[✓✔]/.test(await choice.innerText()),'and carries no tick');
      if(i<3){
        await page.waitForFunction(i=>__poly.state.ddActive===i+1&&!__poly.locked(),i);
        assert(await page.evaluate(i=>{
          const v=__poly.renderVals(),t=v.targets.find(x=>x.label.startsWith('Figure '+(i+1)+': '));
          const c=v.cards[i];
          return !!t && !t.selected && t.feedback==='' && t.disabled && c.wrap.opacity===1 && c.wrap.transform==='none' && !c.wrap.boxShadow.includes('23,156,211');
        },i),'Completed figure and answer remain visible in their default state');
        const answerBox=await choice.boundingBox();
        const cardBox=await page.locator('.story-surface svg').nth(i).evaluate(e=>{const r=e.parentElement.getBoundingClientRect();return {x:r.x,width:r.width};});
        assert(Math.abs(answerBox.x+answerBox.width/2-cardBox.x-cardBox.width/2)<1,'Accepted answer is centered below its own card');
        assert(Math.abs(answerBox.y-originalBox.y)<.1,'Answer baseline stays fixed');
        assert(Math.abs(answerBox.width-originalBox.width)<.1,'Answer width stays fixed');
        assert.equal(await page.locator('.story-surface svg').nth(i).locator('path').first().getAttribute('stroke'),'#7fb2d9','Completed figure returns to muted blue');
        assert(await choice.evaluate(e=>{const s=getComputedStyle(e);return e.classList.contains('completed-answer')&&s.opacity==='1'&&s.color==='rgb(53, 90, 112)'&&s.getPropertyValue('--button-face').trim()!==s.getPropertyValue('--concept-button-face').trim();}),'Completed answer uses a readable neutral blue face');
        assert.deepEqual(await page.locator('.story-surface svg').nth(i).boundingBox(),originalFigure,'The completed figure never moves or resizes');
        assert.equal(await page.locator('.story-surface svg').count(),4);
        assert.equal(await page.locator('[data-sequence-state="complete"]').count(),i+1);
        assert.equal(await enabled().count(),2);
        assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Figure '+(i+2)+': Straight');
        if(i===1){
          await page.getByRole('button',{name:'Figure 3: Straight',exact:true}).click();
          await page.evaluate(()=>correctionDone());
          await page.waitForFunction(()=>__poly.state.narr==='Is the boundary straight or curved?');
          assert(await page.evaluate(()=>__poly.state.ddActive===2&&__poly.state.dd[0]==='Straight'&&__poly.state.dd[1]==='Straight'));
        }
        if(i===0)await page.screenshot({path:path.join(out,'second-figure.png')});
      }
    }
    await page.waitForFunction(()=>__poly.state.k===14);
    assert.equal(await page.locator('[data-sequence-state="complete"]').count(),4);
    assert(await page.locator('[data-sequence-state="complete"]').evaluateAll(es=>es.every(e=>{
      const s=getComputedStyle(e);return s.opacity==='1'&&s.filter==='none'
        &&s.getPropertyValue('--button-face').trim()===s.getPropertyValue('--concept-button-face').trim();
    })),'Screen 15 answer labels use the full yellow face from the start');
    assert(await page.evaluate(()=>__poly.renderVals().targets.every(t=>t.feedback===''&&!t.selected)),'All four completed answers are neutral');
    await page.screenshot({path:path.join(out,'completed.png')});
    await start();await page.getByRole('button',{name:'Figure 1: Straight',exact:true}).click();
    await start();await page.waitForTimeout(1100);
    assert(await page.evaluate(()=>__poly.state.ddActive===0&&__poly.state.dd.every(v=>v===null)),'Re-entry cancels pending focus handoff');
    assert(await page.evaluate(()=>!__poly.state.ddRetryQuestion&&__poly.state.ddConfirmed===null),'Re-entry resets the retry prompt and confirmation');
    await page.emulateMedia({reducedMotion:'reduce'});await start();
    assert.equal(await enabled().first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
    assert.deepEqual(errors,[]);
    console.log('PASS: sequential guards, waiting figures in blue and unblurred, staggered choices clear of the figures, one checked result, keyboard handoff, all four figures, re-entry cancellation and reduced motion.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
