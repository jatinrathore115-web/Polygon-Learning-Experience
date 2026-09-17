const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','screen-22');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9368,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9368/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.mouse.click(700,100);
    await page.evaluate(()=>{
      const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);
      g._guideGreeted=true;g._lastSc='S11';
      g.setState({k:20,phase:'vertex',storyContent:true,guideHidden:false,guideFlying:false,boundaryTravel:false});
      g.advance=()=>{window.advanceRequested={speaking:g.state.speaking,words:g.state.wordReveal};};
      const start=g.storyVoiceStart.bind(g);g.storyVoiceStart=()=>{window.voiceDuringTravel=g.state.boundaryTravel;start();};
    });
    await page.waitForTimeout(1000);
    await page.evaluate(()=>{__poly.setState({k:21});__poly.runStep(21,false);});
    await page.waitForFunction(()=>window.advanceRequested);
    assert(await page.evaluate(()=>!voiceDuringTravel&&!advanceRequested.speaking&&advanceRequested.words==='complete'));
    const sample=()=>page.evaluate(()=>{
      const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
      const label=t=>[...document.querySelectorAll('.story-surface div')].find(e=>e.textContent.trim()===t&&e.style.position==='absolute');
      return{board:rect(document.querySelector('.story-board')),guide:rect(document.querySelector('.swiftee-wrap')),
        figure:rect(document.querySelector('.story-surface svg path')),dialogue:rect(document.querySelector('.dialogue-box')),
        bg:rect(document.querySelector('.boundary-background')),labels:['Side','Vertex','Angle'].map(t=>({text:t,...rect(label(t)),opacity:getComputedStyle(label(t)).opacity}))};
    });
    const check=s=>{
      assert(Math.abs(s.board.x+s.board.w/2-(s.bg.x+s.bg.w/2))<1,'Centered board');
      for(const r of [s.guide,s.figure,s.dialogue,...s.labels])assert(r.x>s.board.x&&r.right<s.board.right&&r.y>s.board.y&&r.bottom<s.board.bottom,'Content inside board');
      assert(s.dialogue.right<s.figure.x&&s.guide.right<s.figure.x,'Left teaching column clears the figure');
      assert(s.dialogue.bottom<s.guide.y,'Dialogue clears Swiftee');
      assert(s.labels.every(l=>l.opacity==='1'),'All three teaching labels visible at completion');
      assert(Math.abs(s.bg.w/s.bg.h-16/9)<.01);
    };
    await page.screenshot({path:path.join(out,'screen-22.png')});check(await sample());
    const angle=page.getByText('Angle',{exact:true});
    const labelOpacity=()=>angle.evaluate(e=>{while(e&&e.style.position!=='absolute')e=e.parentElement;return getComputedStyle(e).opacity;});
    await page.evaluate(()=>__poly.setState({voiceElapsedMs:0}));
    assert.equal(await labelOpacity(),'0','Angle cue waits for the spoken concept');
    await page.evaluate(()=>__poly.setState({voiceElapsedMs:6000}));
    assert.equal(await labelOpacity(),'1');
    for(const viewport of [{width:1920,height:1080},{width:1024,height:768}]){
      await page.setViewportSize(viewport);await page.waitForTimeout(200);check(await sample());
    }
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>__poly.setState({voiceElapsedMs:0}));
    check(await sample());
    await page.getByRole('button',{name:'Next',exact:true}).click();await page.waitForFunction(()=>__poly.state.k===22);
    await page.getByRole('button',{name:'Back',exact:true}).click();await page.waitForFunction(()=>__poly.state.k===21);
    assert(await page.evaluate(()=>!__poly.state.boundaryTravel));assert.deepEqual(errors,[]);
    console.log(JSON.stringify({screen:22,referenceLayout:true,allLabelsInsideBoard:true,voiceSynchronized:true,responsive:true,reducedMotion:true,navigation:true,errors}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
