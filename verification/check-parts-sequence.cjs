const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','parts-sequence');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9369,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9369/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.mouse.click(700,100);
    await page.evaluate(()=>{
      const g=__poly;g._guideGreeted=true;
      const advance=g.advance.bind(g);g.advance=()=>{
        if(g.state.k>=19&&g.state.k<=21)window.partsCompleted=g.state.k;else advance();
      };
      g.setState({k:19});g.runStep(19,false);
    });
    const boxes=()=>page.evaluate(()=>{
      const b=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};
      return{board:b(document.querySelector('.story-board')),guide:b(document.querySelector('.swiftee-wrap')),
        dialogue:b(document.querySelector('.dialogue-box')),figure:b(document.querySelector('.story-surface svg path')),
        targets:[...document.querySelectorAll('[data-label-target]')].map(b),
        chips:[...document.querySelectorAll('.story-surface [aria-disabled]')].filter(e=>e.textContent.match(/^(Side|Vertex|Angle)$/)).map(b)};
    });
    let baseline;
    for(let k=19;k<=21;k++){
      await page.waitForFunction(k=>window.partsCompleted===k,k);
      const s=await boxes();
      if(!baseline)baseline=s;
      else{assert.deepEqual(s.board,baseline.board);assert.deepEqual(s.guide,baseline.guide);assert.deepEqual(s.figure,baseline.figure);}
      assert(s.dialogue.right<s.figure.x&&s.guide.bottom<s.board.bottom);
      await page.screenshot({path:path.join(out,'screen-'+(k+1)+'.png')});
      await page.getByRole('button',{name:'Next',exact:true}).click();
      assert(await page.evaluate(()=>!__poly.state.boundaryTravel),'No repeated flight between explanations');
    }
    await page.waitForFunction(()=>__poly.state.k===22&&__poly.state.narr===__poly.step().narr&&__poly.state.wordReveal==='complete'&&!__poly.locked()&&__poly.state.storyControls&&!__poly.state.speaking);
    await page.waitForTimeout(500);
    const validate=s=>{
      for(const r of [s.guide,s.figure,s.dialogue,...s.targets,...s.chips])assert(r.x>s.board.x&&r.right<s.board.right&&r.y>s.board.y&&r.bottom<s.board.bottom,'Content fits inside the board');
      for(const r of s.targets)assert(r.x>s.dialogue.right,'Targets clear the dialogue');
      for(const r of s.chips)assert(r.y>s.figure.bottom,'Label tray clears the figure');
    };
    await page.screenshot({path:path.join(out,'screen-23.png')});
    let labels=await boxes();assert.deepEqual(labels.board,baseline.board);assert.deepEqual(labels.guide,baseline.guide);validate(labels);
    const side=page.locator('[data-label-target="side"]');
    assert.equal(await page.getByText('Drag a label, or tap a label then a ?.',{exact:true}).count(),0,'No instruction text above the figure');
    for(const [name,color] of [['Side','rgb(233, 151, 18)'],['Vertex','rgb(128, 81, 201)'],['Angle','rgb(21, 156, 168)']]){
      assert.equal(await page.getByRole('button',{name,exact:true}).evaluate(e=>getComputedStyle(e).borderTopColor),color,'Choice uses its teaching colour');
      assert.equal(await page.locator('[data-label-target="'+name.toLowerCase()+'"]').evaluate(e=>getComputedStyle(e).borderTopColor),color,'Socket matches its tile');
    }
    /* An empty socket still has to read as somewhere to drop rather than a
       button to press, but not by being drawn with a broken line -- three
       dashed rims around the figure made the shape look like a diagram. The
       distinction is depth instead: the socket is sunk into the board and the
       label tile stands off it. */
    assert.equal(await side.evaluate(e=>getComputedStyle(e).borderTopStyle),'solid','Sockets are not drawn with broken lines');
    const depth=await page.evaluate(()=>({
      socket:getComputedStyle(document.querySelector('[data-label-target="side"]')).boxShadow,
      tile:getComputedStyle([...document.querySelectorAll('[data-label-chip]')].find(e=>e.textContent.trim()==='Side')).boxShadow
    }));
    assert(/inset/.test(depth.socket),'Empty socket is recessed: '+depth.socket);
    assert(!/^inset/.test(depth.tile.trim()),'Label tile stands off the board: '+depth.tile);
    const stationary=await side.boundingBox();await side.hover();await page.waitForTimeout(200);
    assert.deepEqual(await side.boundingBox(),stationary,'Hover must not detach sockets from their pointers');
    await page.evaluate(()=>__poly.armNudge());
    await page.waitForFunction(()=>!!__poly.state.nudge);
    assert(await page.evaluate(()=>{
      const safe=document.querySelector('.story-surface').getBoundingClientRect(),tile=document.querySelector('[data-label-chip="Side"]').getBoundingClientRect();
      const p=__poly.state.nudge,scale=safe.width/1980;
      return Math.abs(safe.left+p.x*scale-(tile.left+tile.width/2))<1&&Math.abs(safe.top+p.y*scale-(tile.top+tile.height/2))<1;
    }),'Idle hint points at the tile on the full-width board');
    await side.click();
    assert(await page.evaluate(()=>__poly.state.labelPrompt&&!__poly.state.chip),'An empty target gently prompts label selection');
    await page.getByRole('button',{name:'Side',exact:true}).press('Enter');
    await page.waitForFunction(()=>document.activeElement?.getAttribute('data-label-target')==='side');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!__poly.state.chip&&document.activeElement?.getAttribute('data-label-chip')==='Side');
    assert(await page.locator('.story-surface svg').first().evaluate(e=>!getComputedStyle(e.parentElement).transitionProperty.match(/left|top|width|height/)),'Figure geometry and annotation anchors must change together');
    await page.getByRole('button',{name:'Side',exact:true}).dragTo(page.locator('[data-label-target="side"]'));
    await page.waitForFunction(()=>__poly.state.placed.side==='Side');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-label-target="side"]')).backgroundColor==='rgb(255, 225, 138)');
    assert.equal(await side.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 225, 138)','Completed Side matches the amber teaching annotation');
    assert.equal(await side.getAttribute('tabindex'),'-1','Completed annotations leave the tab order');
    await page.getByRole('button',{name:'Angle',exact:true}).press('Enter');
    const vertex=page.locator('[data-label-target="vertex"]');
    await vertex.press('Enter');
    assert.equal(await vertex.getAttribute('data-feedback'),'incorrect');
    assert.equal(await vertex.evaluate(e=>getComputedStyle(e).borderTopStyle),'solid','Wrong feedback is visible on the socket');
    await page.waitForFunction(()=>!__poly.locked()&&!__poly.state.speaking&&!__poly.state.badPlace);
    assert(await page.evaluate(()=>__poly.state.k===22&&__poly.state.placed.side==='Side'&&!__poly.state.placed.vertex),'A wrong placement preserves progress and allows another try');
    for(const name of ['Vertex','Angle']){
      await page.getByRole('button',{name,exact:true}).press('Enter');
      await page.locator('[data-label-target="'+name.toLowerCase()+'"]').press('Enter');
      if(name==='Vertex')await page.waitForFunction(()=>document.activeElement?.getAttribute('data-label-chip')==='Angle');
    }
    await page.waitForFunction(()=>Object.keys(__poly.state.placed).length===3);
    await page.waitForTimeout(350);
    assert.equal(await vertex.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(223, 197, 255)');
    assert.equal(await page.locator('[data-label-target="angle"]').evaluate(e=>getComputedStyle(e).outlineStyle),'none','Completed keyboard target has no stale native focus outline');
    assert.equal(await page.getByText('Drag a label, or tap a label then a ?.',{exact:true}).count(),0,'Completed activity hides obsolete instructions');
    await page.screenshot({path:path.join(out,'screen-23-complete.png')});
    await page.waitForFunction(()=>__poly.state.k===23);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{__poly.setState({k:22});__poly.runStep(22,false);});
    await page.waitForFunction(()=>!__poly.locked()&&!__poly.state.speaking);
    for(const viewport of [{width:1920,height:1080},{width:1024,height:768}]){
      await page.setViewportSize(viewport);await page.waitForTimeout(200);validate(await boxes());
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({screens:[20,21,22,23],persistentLayout:true,narration:true,dragAndKeyboardLabels:true,automaticCompletion:true,responsive:true,reducedMotion:true,errors}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
