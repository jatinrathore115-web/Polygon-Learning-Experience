const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'output', 'polygon-intro');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server = http.createServer((req,res)=>{
  const file = path.resolve(root, '.' + (decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html')));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  await new Promise(r=>server.listen(9366,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:810}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9366/?intro=0');
    await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.mouse.click(700,100);
    await page.evaluate(()=>{
      const g=__poly; g.timers.forEach(clearTimeout);g._stopRecordedVoice?.();
      g._guideGreeted=true;g._boundaryAt=true;g._lastSc='S7';
      g.setState({k:15,storyContent:true,guideHidden:false,guideFlying:false,boundaryTravel:false});
      window.introVoices=[];
      const start=g.storyVoiceStart.bind(g);g.storyVoiceStart=(...args)=>{
        if(g.polygonIntroScene())introVoices.push({k:g.state.k,travel:g.state.polygonTravel,time:performance.now()});
        return start(...args);
      };
      const advance=g.advance.bind(g);g.advance=()=>{if(g.state.k!==17)advance();};
    });
    await page.waitForTimeout(1000);
    await page.locator('.story-board').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})));});
    const precedingBoard=await page.locator('.story-board').boundingBox();
    await page.evaluate(()=>{window.entryTime=performance.now();__poly.setState({k:16});__poly.runStep(16,false);});
    await page.waitForTimeout(450);
    assert(await page.evaluate(()=>__poly.state.polygonTravel&&!__poly.state.speaking),'Flight precedes narration');
    assert.equal(await page.locator('.story-board').evaluate(e=>getComputedStyle(e).opacity),'1','Board remains visible through transition');
    const movingBoard=await page.locator('.story-board').boundingBox();
    assert(Math.abs(movingBoard.x-precedingBoard.x)<1&&Math.abs(movingBoard.width-precedingBoard.width)<1,'Keep the board horizontal alignment continuous from Screen 16: '+JSON.stringify({precedingBoard,movingBoard}));
    assert(await page.locator('.swiftee-wrap').evaluate(e=>getComputedStyle(e).animationName==='polygonPerchLanding'&&getComputedStyle(e).opacity==='1'),'Swiftee flies directly from the existing perch without disappearing');
    await page.screenshot({path:path.join(out,'arrival.png')});
    await page.waitForFunction(()=>__poly.state.k===16&&__poly.state.reveal&&!__poly.state.polygonTravel);
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(out,'screen-17.png')});
    const sample=()=>page.evaluate(()=>{
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};
      const svg=document.querySelector('.story-surface svg');
      const p=svg.querySelector('path'),style=getComputedStyle(p);
      return {board:box(document.querySelector('.story-board')),guide:box(document.querySelector('.swiftee-wrap')),
        figure:box(svg),dialogue:box(document.querySelector('.dialogue-box')),stroke:style.stroke,fill:style.fill,
        bg:box(document.querySelector('.boundary-background')),surface:box(document.querySelector('.story-surface'))};
    });
    const a=await sample();assert.equal(a.fill,'rgb(251, 224, 232)');assert.equal(a.stroke,'rgb(233, 54, 144)');
    await page.waitForFunction(()=>__poly.state.k===17&&!__poly.state.speaking&&__poly.state.reveal&&introVoices.some(v=>v.k===17)&&__poly.state.wordReveal==='complete',null,{timeout:25000});
    await page.waitForTimeout(800);
    const b=await sample();assert.equal(b.fill,'rgb(220, 238, 222)');assert.equal(b.stroke,'rgb(36, 159, 96)');
    assert.deepEqual(a.board,b.board);assert.deepEqual(a.guide,b.guide);
    for(const s of [a,b]){
      assert(Math.abs(s.board.x+s.board.w/2-(s.bg.x+s.bg.w/2))<1&&Math.abs(s.board.y+s.board.h/2-(s.bg.y+s.bg.h/2))<1,'Board itself is perfectly centered on both axes');
      assert(s.figure.x>s.board.x&&s.figure.right<s.board.x+s.board.w/2&&s.figure.y>s.board.y&&s.figure.bottom<s.board.bottom,'Figure stays inside the left half of the board');
      assert(s.guide.x>s.board.x&&s.guide.right<s.board.right&&s.guide.y>s.board.y&&s.guide.bottom<s.board.bottom,'Guide settles inside the board');
      assert(s.dialogue.x>s.figure.right&&s.dialogue.right<s.board.right&&s.dialogue.y>s.board.y&&s.dialogue.bottom<s.guide.y,'Dialogue clears both the figure and guide');
      assert(Math.abs(s.bg.w/s.bg.h-16/9)<.01,'Preserve 16:9');
      assert(s.figure.right<1440&&s.board.bottom<810,'Composition fits the screen');
    }
    assert(await page.evaluate(()=>introVoices.length>=2&&introVoices.every(v=>!v.travel)&&introVoices[0].time-entryTime>=1100),'Actual voice starts after landing');
    await page.screenshot({path:path.join(out,'screen-18.png')});
    // Leaving during flight cancels pending landing and narration callbacks.
    await page.evaluate(()=>{__poly._polygonAt=false;__poly.setState({k:16});__poly.runStep(16,false);});
    await page.waitForTimeout(150);
    await page.evaluate(()=>{__poly.setState({k:15});__poly.runStep(15,false);});
    await page.waitForTimeout(1400);
    assert(await page.evaluate(()=>__poly.state.k===15&&!__poly.state.polygonTravel&&!__poly.state.narr.includes('We call this')));
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{__poly.setState({k:17});__poly.runStep(17,false);});
    await page.waitForTimeout(100);
    assert(await page.evaluate(()=>!__poly.state.polygonTravel));
    assert.equal(await page.locator('.story-board').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
    for(const viewport of [{width:1920,height:1080},{width:1024,height:768}]){
      await page.setViewportSize(viewport);await page.waitForTimeout(150);
      const s=await sample();assert(s.figure.right<=viewport.width&&s.board.bottom<=viewport.height);assert(Math.abs(s.bg.w/s.bg.h-16/9)<.01);
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({screens:[17,18],centeredBoard:true,figureInsideLeft:true,guideInsideBottomRight:true,continuousTransition:true,voiceAfterLanding:true,pastelFillDarkerOutline:true,navigationCancellation:true,reducedMotion:true,errors}));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
