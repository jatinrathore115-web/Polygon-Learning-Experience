const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});
});
(async()=>{
  await new Promise(r=>server.listen(9395,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const baseline=new Map(),errors=[];
    // Same physical display under 100%, 125%, 150%, 200% and 300% effective scaling.
    for(const density of [1,1.25,1.5,2,3]){
      const page=await browser.newPage({viewport:{width:1920/density,height:1080/density},deviceScaleFactor:density,reducedMotion:'reduce'});
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:9395/?intro=0');
      await page.waitForFunction(()=>window.__poly?.state.ready);
      await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
      await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g.later=()=>0;g.narrate=()=>{};g._guideGreeted=true;});
      for(const k of [4,13,22,40,42,44]){
        await page.evaluate(k=>{
          const g=__poly;g.setState({k});g.runStep(k,false);g.prepareNarratorReveal(g.step().narr);
          g.setState({storyContent:true,storyDialogue:true,storyControls:true,drawn:true,guideHidden:false,guideFlying:false,
            magicReveal:false,interactive:true,speaking:false,wordReveal:'complete',ocWords:{open:true,closed:true}});
        },k);
        await page.waitForFunction(k=>document.querySelector('#polygon-screen-navigator').shadowRoot.querySelector('#toggle').textContent.endsWith(' '+(k+1)),k);
        const geometry=await page.evaluate(()=>{
          const stage=document.querySelector('[data-lesson]'),r=stage.getBoundingClientRect(),s=r.width/1980;
          const nav=document.querySelector('#polygon-screen-navigator').shadowRoot;
          return [...document.querySelectorAll('.lesson-background,.story-board,.dialogue-box,.swiftee-wrap,.story-surface svg,.story-controls .game-action'),
            nav.querySelector('#toggle'),nav.querySelector('#back'),nav.querySelector('#next')].map(e=>{
            const b=e.getBoundingClientRect();return [(b.x-r.x)/s,(b.y-r.y)/s,b.width/s,b.height/s,getComputedStyle(e).fontSize];
          });
        });
        if(!baseline.has(k))baseline.set(k,geometry);
        const expected=baseline.get(k);
        assert.equal(geometry.length,expected.length);
        geometry.forEach((box,i)=>{for(let j=0;j<4;j++)assert(Math.abs(box[j]-expected[i][j])<.2,`Screen ${k+1}: anchor ${i}/${j} changed at ${density}x`);assert.equal(box[4],expected[i][4]);});
      }
      await page.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: six layout families maintain identical canvas-relative bounds and typography across five effective display/zoom scales (100–300%).');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
