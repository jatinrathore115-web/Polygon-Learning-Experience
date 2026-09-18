const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','learning-layout');
const screens=[24,25,26,27,28,29,30,31,32,34,35];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9370,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9370/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.mouse.click(700,80);
    await page.evaluate(()=>{
      const g=__poly;g.timers.forEach(clearTimeout);g._stopRecordedVoice?.();
      g._testLater=g.later;g._testAdvance=g.advance;g.later=()=>0;g._guideGreeted=true;
    });
    const show=async(number)=>{
      await page.evaluate(number=>{
        const g=__poly,k=number-1,s=g.steps()[k];g.setState({k});g.runStep(k,false);
        const pts=g.fig('pentagon').pts.map(p=>p.slice());pts[0]=[pts[0][0]-28,pts[0][1]+30];pts[3]=[pts[3][0]+14,pts[3][1]-10];
        g.prepareNarratorReveal(g.instructionPages(s.narr)[0]);g._voiceLocked=false;
        g.setState({wordReveal:'complete',storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false,
          boundaryTravel:false,reveal:true,nums:s.count||([25,32].includes(number)?5:0),numsB:number===32?5:0,
          userPts:number>=28&&number<=32?pts:null,voiceElapsedMs:10000});
      },number);
      await page.waitForTimeout(1000);
    };
    const inspect=()=>page.evaluate(()=>{
      const b=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};
      const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width&&r.height;};
      return{board:b(document.querySelector('.story-board')),guide:b(document.querySelector('.swiftee-wrap')),dialogue:b(document.querySelector('.dialogue-box')),
        figures:[...document.querySelectorAll('.story-surface svg')].map(e=>b(e.parentElement)),
        figureInk:[...document.querySelectorAll('.story-surface svg')].map(e=>e.querySelector('path')).filter(Boolean).map(b),
        controls:[...document.querySelectorAll('.story-surface [role="group"],.story-surface [role="button"]')].filter(visible).map(b),
        labels:[...document.querySelectorAll('.story-surface div')].filter(e=>visible(e)&&['Before','After','Triangle','Quadrilateral','5 sides'].includes(e.textContent.trim())&&e.childElementCount===0).map(b),
        screen:window.__poly.state.k+1,
        stepper:document.querySelector('.story-surface [role="group"]')?b(document.querySelector('.story-surface [role="group"]')):null};
    });
    const check=s=>{
      const inside=r=>r.x>=s.board.x-1&&r.right<=s.board.right+1&&r.y>=s.board.y-1&&r.bottom<=s.board.bottom+1;
      for(const r of [s.guide,s.dialogue,...s.figures,...s.controls,...s.labels])assert(inside(r),'Content stays inside the board: '+JSON.stringify(r));
      /* Content must not crowd the bubble. Not "must sit to its right": the
         comparison screens put Swiftee between the two figures on purpose, so
         what matters is a real gap on whichever side she is, not a column. */
      for(const r of s.figures)assert(r.right<=s.dialogue.x-30||r.x>=s.dialogue.right+30,
        'Learning content crowds the dialogue: screen '+s.screen+' figure '+Math.round(r.x)+'-'+Math.round(r.right)+' vs bubble '+Math.round(s.dialogue.x)+'-'+Math.round(s.dialogue.right));
      for(const r of s.controls)assert(r.y>=Math.max(...(s.figureInk.length?s.figureInk:s.figures).map(f=>f.bottom))-2,'Controls stay below the visible figure');
      if([24,31].includes(s.screen)){
        const figure=s.figures.at(-1),stepper=s.stepper;
        assert(Math.abs(stepper.x+stepper.w/2-figure.x-figure.w/2)<1,'The counter itself is centred on its figure');
        for(const control of s.controls)assert(control.right<=s.board.right-24,'Controls leave breathing room inside the board edge');
      }
    };
    await show(22);await page.waitForTimeout(1400);const baseline=await inspect();
    for(const n of screens){
      await show(n);const s=await inspect();check(s);assert.deepEqual(s.board,baseline.board);
      /* Swiftee holds one spot across the teaching screens, with one deliberate
         exception: on the comparison she steps between the two pentagons,
         because the line she speaks is about both of them. */
      if(n===32)assert(Math.abs((s.guide.x+s.guide.right)/2-(s.board.x+s.board.right)/2)<40,
        'On the comparison screen Swiftee stands between the figures, not in the corner');
      else assert.deepEqual(s.guide,baseline.guide);
      await page.screenshot({path:path.join(out,'screen-'+n+'.png')});
    }
    const montage=await browser.newPage({viewport:{width:1440,height:1200}});
    await montage.setContent('<style>body{margin:0;background:#082854;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font:16px sans-serif;color:white}figure{margin:0}img{width:100%}figcaption{padding:5px}</style>'+screens.map(n=>'<figure><figcaption>Screen '+n+'</figcaption><img src="http://127.0.0.1:9370/verification/output/learning-layout/screen-'+n+'.png"></figure>').join(''));
    await montage.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await montage.screenshot({path:path.join(out,'overview.png'),fullPage:true});await montage.close();
    await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1024,height:768});
    for(const n of screens){await show(n);check(await inspect());}
    if(process.env.LAYOUT_ONLY==='1'){
      assert.deepEqual(errors,[]);console.log(JSON.stringify({screens,layout:true,responsive:true,reducedMotion:true,errors}));return;
    }
    // Restore real timers, narration, and automatic progression for the changed activities.
    await page.setViewportSize({width:1440,height:810});await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{const g=__poly;g.later=g._testLater;g.advance=()=>{window.completed=g.state.k;};});
    const run=async(number)=>{
      await page.evaluate(number=>{const g=__poly;window.completed=null;g.setState({k:number-1,dragged:false,userPts:null});g.runStep(number-1,false);},number);
      await page.waitForFunction(()=>!__poly.locked()&&!__poly.state.speaking&&__poly.state.storyControls);
    };
    await run(24);
    const plus=page.getByRole('button',{name:'Increase number of sides',exact:true});
    const checkButton=page.getByRole('button',{name:'Check',exact:true});
    await plus.click();
    assert.equal(await page.locator('.story-surface [role="status"]').getAttribute('aria-label'),'1 side');
    await checkButton.click();
    await page.waitForFunction(()=>document.querySelector('.story-surface [data-feedback="incorrect"]'));
    assert.equal(await checkButton.getAttribute('aria-disabled'),'true','Lock Check during corrective narration');
    assert(await checkButton.evaluate(e=>getComputedStyle(e).boxShadow.includes('241, 91, 99')),'Incorrect Check displays the red feedback halo');
    await page.waitForFunction(()=>!__poly.locked()&&!__poly.state.speaking&&__poly.state.wrong===null);
    assert.equal(await checkButton.getAttribute('data-feedback'),'','Retry clears stale feedback');
    for(let i=0;i<4;i++)await plus.click();
    await checkButton.click();
    await page.waitForFunction(()=>document.querySelector('.story-surface [data-feedback="correct"]'));
    assert(await checkButton.evaluate(e=>getComputedStyle(e).boxShadow.includes('57, 207, 114')),'Correct Check displays the green feedback halo');
    await page.waitForFunction(()=>window.completed===23);
    await run(27);
    const handle=page.locator('.game-handle').first();const r=await handle.boundingBox();assert(r);
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2-100,r.y+r.height/2+60,{steps:8});await page.mouse.up();
    await page.waitForFunction(()=>__poly.state.dragged&&window.completed===26);
    const dragged=await page.evaluate(()=>__poly.state.userPts);
    await page.evaluate(()=>{window.completed=null;__poly.runStep(26,false);});
    await page.waitForFunction(()=>!__poly.locked()&&!__poly.state.speaking);
    assert.equal(await page.evaluate(()=>__poly.state.dragged),false,'Revisiting the drag lesson re-arms completion');
    const idleHandle=await handle.boundingBox();
    await page.mouse.click(idleHandle.x+idleHandle.width/2,idleHandle.y+idleHandle.height/2);await page.waitForTimeout(800);
    assert(await page.evaluate(()=>!__poly.state.dragged&&window.completed===null),'Clicking an already deformed vertex does not complete the activity');
    const again=await handle.boundingBox();
    await page.mouse.move(again.x+again.width/2,again.y+again.height/2);await page.mouse.down();
    await page.mouse.move(again.x+again.width/2+100,again.y+again.height/2-60,{steps:8});await page.mouse.up();
    await page.waitForFunction(()=>__poly.state.dragged&&window.completed===26);
    await run(31);await page.evaluate(pts=>__poly.setState({userPts:pts}),dragged);
    // The After counter starts at nothing, so the learner counts all five up.
    for(let i=0;i<5;i++)await plus.click();
    assert.equal(await page.evaluate(()=>__poly.state.cnt[1]),5,'Five taps on + count five sides');
    await page.getByRole('button',{name:'Check',exact:true}).click();await page.waitForFunction(()=>window.completed===30);
    for(const number of [25,26,28,29,30,32,34,35]){
      await page.evaluate(number=>{const g=__poly;window.completed=null;g.setState({k:number-1});g.runStep(number-1,false);},number);
      if(number===35){
        await page.waitForFunction(()=>!!__poly.state.morph);
        assert(await page.evaluate(()=>__poly.state.nums===0&&!__poly.state.speaking),'Explain and count only after the shape settles');
        await page.screenshot({path:path.join(out,'screen-35-transition.png')});
      }
      await page.waitForFunction(n=>window.completed===n-1,number);
      assert.equal(await page.evaluate(()=>__poly.state.voiceError),'');
      if([25,32,34,35].includes(number))assert.equal(await page.evaluate(()=>__poly.state.nums),number===34?3:number===35?4:5);
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({screens,layout:true,responsive:true,reducedMotion:true,realNarration:true,counting:true,vertexDrag:true,automaticCompletion:true,errors}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
